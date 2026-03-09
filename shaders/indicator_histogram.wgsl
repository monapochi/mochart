// indicator_histogram.wgsl — Arena-backed histogram renderer
//
// Renders MACD histogram bars or volume bars.  Each bar is drawn as a
// quad (2 triangles, 6 vertices) from the zero line to the indicator value.
//
// Positive values use `pos_color`, negative values use `neg_color`.
//
// Topology : TRIANGLE_LIST
// Vertex count: (bar_count - warmup) * 6
//
// ── Uniform layout (96 B, std140-compatible) ──────────────────────────────
//   offset  0: plot_w        f32
//   offset  4: plot_h        f32
//   offset  8: candle_w      f32 — slot width = plot_w / bar_count
//   offset 12: value_min     f32 — visible value range min (for Y scaling)
//   offset 16: value_max     f32 — visible value range max
//   offset 20: zero_level    f32 — value that maps to the zero-line (usually 0.0)
//   offset 24: arena_offset  u32
//   offset 28: warmup_bars   u32
//   offset 32: pos_color     vec4<f32>  (16-byte aligned) — color for value > 0
//   offset 48: neg_color     vec4<f32>  — color for value < 0
//   offset 64: bar_count     u32
//   offset 68: bar_gap       f32 — fractional gap between bars [0, 1); 0.1 = 10% gap
//   offset 72: _pad0         u32
//   offset 76: _pad1         u32

struct Uniforms {
    plot_w       : f32,
    plot_h       : f32,
    candle_w     : f32,
    value_min    : f32,
    value_max    : f32,
    zero_level   : f32,
    arena_offset : u32,
    warmup_bars  : u32,
    pos_color    : vec4<f32>,   // offset 32
    neg_color    : vec4<f32>,   // offset 48
    bar_count    : u32,         // offset 64
    bar_gap      : f32,
    slots        : u32,
    offset_slots : f32,
}

@group(0) @binding(0) var<uniform>       u     : Uniforms;
@group(1) @binding(0) var<storage, read> arena : array<f32>;

struct VOut {
    @builtin(position) pos   : vec4<f32>,
    @location(0)       color : vec4<f32>,
}

// Quad corner positions:
//   6 verts → 2 triangles covering (x_left, y_bottom, x_right, y_top)
//   tri0: (0,0), (1,0), (1,1)   tri1: (0,0), (1,1), (0,1)
// UV[i] → (col, row) where col∈{0,1}, row∈{0,1}
const UV_COL = array<u32, 6>(0u, 1u, 1u,  0u, 1u, 0u);
const UV_ROW = array<u32, 6>(0u, 0u, 1u,  0u, 1u, 1u);

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
    var out: VOut;

    let bar_idx = vi / 6u + u.warmup_bars;
    if bar_idx >= u.bar_count {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.color = vec4<f32>(0.0);
        return out;
    }

    let val = arena[u.arena_offset + bar_idx];
    // Clip NaN (NaN ≠ NaN)
    if !(val == val) {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.color = vec4<f32>(0.0);
        return out;
    }

    let value_range = max(u.value_max - u.value_min, 1e-6);

    let slots       = u.slots;
    let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
    let slot_w      = u.plot_w / logical_len;

    let gap_px      = slot_w * u.bar_gap;
    let bar_w       = max(slot_w - gap_px, 1.0);

    // X extents of bar
    let x_left  = (f32(bar_idx) - u.offset_slots) * slot_w + gap_px * 0.5;
    let x_right = x_left + bar_w;

    // Y extents — value → pixel Y (Y increases top→bottom)
    let y_zero = (1.0 - (u.zero_level - u.value_min) / value_range) * u.plot_h;
    let y_val  = (1.0 - (val           - u.value_min) / value_range) * u.plot_h;

    let y_top    = min(y_zero, y_val);
    let y_bottom = max(y_zero, y_val);

    // Corner selection
    let col = UV_COL[vi % 6u];
    let row = UV_ROW[vi % 6u];
    let px  = select(x_left,  x_right,  col == 1u);
    let py  = select(y_top,   y_bottom, row == 1u);

    out.pos   = vec4<f32>(px / u.plot_w * 2.0 - 1.0, 1.0 - py / u.plot_h * 2.0, 0.0, 1.0);
    out.color = select(u.neg_color, u.pos_color, val >= u.zero_level);
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    // Premultiplied alpha
    let a = in.color.a;
    return vec4<f32>(in.color.rgb * a, a);
}
