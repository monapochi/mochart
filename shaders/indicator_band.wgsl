// indicator_band.wgsl — Arena-backed band/fill renderer
//
// Renders a filled region between two indicator lines (e.g. Bollinger Bands
// upper and lower).  Each segment spans one bar interval and is drawn as a
// quad (2 triangles, 6 vertices) whose four corners are:
//
//   TL = (x_left,  upper[i])
//   TR = (x_right, upper[i+1])
//   BL = (x_left,  lower[i])
//   BR = (x_right, lower[i+1])
//
// Total vertex count: (bar_count - warmup - 1) * 6
//
// ── Uniform layout (80 B, std140-compatible) ──────────────────────────────
//   offset  0: plot_w             f32
//   offset  4: plot_h             f32
//   offset  8: candle_w           f32 — slot px width = plot_w / bar_count
//   offset 12: price_min          f32
//   offset 16: price_max          f32
//   offset 20: arena_offset_upper u32 — arena index for the upper line
//   offset 24: arena_offset_lower u32 — arena index for the lower line  (= band_alt_offset from RenderCmd)
//   offset 28: warmup_bars        u32
//   offset 32: fill_color         vec4<f32>  (16-byte aligned) — semi-transparent fill
//   offset 48: bar_count          u32
//   offset 52: _pad0              u32
//   offset 56: _pad1              u32
//   offset 60: _pad2              u32

struct Uniforms {
    plot_w             : f32,
    plot_h             : f32,
    candle_w           : f32,
    price_min          : f32,
    price_max          : f32,
    arena_offset_upper : u32,
    arena_offset_lower : u32,
    warmup_bars        : u32,
    fill_color         : vec4<f32>,   // offset 32
    bar_count          : u32,         // offset 48
    slots              : u32,
    _pad1              : u32,
    _pad2              : u32,
}

@group(0) @binding(0) var<uniform>       u     : Uniforms;
@group(1) @binding(0) var<storage, read> arena : array<f32>;

struct VOut {
    @builtin(position) pos   : vec4<f32>,
    @location(0)       color : vec4<f32>,
}

// Segment quad layout (6 verts = 2 triangles)
//
//   TL ------- TR
//   |  \        |
//   |    \      |
//   BL ------- BR
//
// tri0: TL, TR, BR   (indices 0,1,2)
// tri1: TL, BR, BL   (indices 3,4,5)
//
// Encoding: each vertex selects (bar_i, bar_j, upper_or_lower)
// bar_i = left bar index, bar_j = right bar index = bar_i+1
//
// vert 0: bar_i  upper  → TL
// vert 1: bar_j  upper  → TR
// vert 2: bar_j  lower  → BR
// vert 3: bar_i  upper  → TL
// vert 4: bar_j  lower  → BR
// vert 5: bar_i  lower  → BL

// Which bar side: 0 = bar_i (left), 1 = bar_j (right)
const BAR_SEL   = array<u32, 6>(0u, 1u, 1u,  0u, 1u, 0u);
// Which band:    0 = upper,         1 = lower
const BAND_SEL  = array<u32, 6>(0u, 0u, 1u,  0u, 1u, 1u);

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
    var out: VOut;

    let seg_idx = vi / 6u;  // segment (bar pair) index, 0-based from warmup
    let bar_i   = seg_idx + u.warmup_bars;
    let bar_j   = bar_i + 1u;

    if bar_j >= u.bar_count {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.color = vec4<f32>(0.0);
        return out;
    }

    let v_idx = vi % 6u;
    let bar   = select(bar_i, bar_j, BAR_SEL[v_idx] == 1u);
    let is_lower = BAND_SEL[v_idx] == 1u;

    var val: f32;
    if is_lower {
        val = arena[u.arena_offset_lower + bar];
    } else {
        val = arena[u.arena_offset_upper + bar];
    }

    // Clip NaN
    if !(val == val) {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.color = vec4<f32>(0.0);
        return out;
    }

    let price_range = max(u.price_max - u.price_min, 1e-6);
    let slots       = u.slots;
    let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
    let slot_w      = u.plot_w / logical_len;
    
    let x           = f32(bar) * slot_w + slot_w * 0.5;  // horizontal centre of bar
    let y           = (1.0 - (val - u.price_min) / price_range) * u.plot_h;

    out.pos   = vec4<f32>(x / u.plot_w * 2.0 - 1.0, 1.0 - y / u.plot_h * 2.0, 0.0, 1.0);
    out.color = u.fill_color;
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    // Premultiplied alpha
    let a = in.color.a;
    return vec4<f32>(in.color.rgb * a, a);
}
