// indicator_render.wgsl — Arena-backed thick-line indicator renderer
//
// Renders CPU-computed indicator values (SMA, EMA, RSI, MACD line, signal,
// ATR, OBV, BB bands) from the shared arena storage buffer.
//
// One `draw()` call per indicator output slot.  The per-draw uniform selects
// the arena offset, color, warmup skip, and rendering parameters.
// The arena storage buffer (bind group 1) is shared across all draw calls,
// minimising bind-group churn.
//
// Topology : TRIANGLE_LIST
// Vertex count: (bar_count - warmup - 1) * 6
//        (caller clips to 0 when bar_count ≤ warmup + 1)
//
// ── Uniform layout (64 B, std140-compatible) ──────────────────────────────
//   offset  0: plot_w        f32 — canvas width  in physical pixels
//   offset  4: plot_h        f32 — canvas height in physical pixels
//   offset  8: candle_w      f32 — slot width = plot_w / bar_count (for bar X)
//   offset 12: price_min     f32
//   offset 16: price_max     f32
//   offset 20: line_width_px f32 — desired line width in screen pixels
//   offset 24: arena_offset  u32 — f32 element offset into arena[]
//   offset 28: warmup_bars   u32 — head bars to skip (NaN region)
//   offset 32: color         vec4<f32>  (16-byte aligned)
//   offset 48: bar_count     u32 — total visible bars
//   offset 52: _pad0         u32
//   offset 56: _pad1         u32
//   offset 60: _pad2         u32

struct Uniforms {
    plot_w        : f32,
    plot_h        : f32,
    candle_w      : f32,
    price_min     : f32,
    price_max     : f32,
    line_width_px : f32,
    arena_offset  : u32,
    warmup_bars   : u32,
    color         : vec4<f32>,  // offset 32
    bar_count     : u32,
    slots         : u32,
    _pad1         : u32,
    offset_slots  : f32,
}

@group(0) @binding(0) var<uniform>       u     : Uniforms;
@group(1) @binding(0) var<storage, read> arena : array<f32>;

struct VOut {
    @builtin(position) pos     : vec4<f32>,
    @location(0)       alpha   : f32,
    @location(1)       dist_px : f32,
}

// Two-triangle quad corner table (same as line_thick.wgsl)
const ENDPOINT = array<u32, 6>(0u, 0u, 1u,  1u, 0u, 1u);
const SIGN     = array<f32, 6>(1.0, -1.0, 1.0,  1.0, -1.0, -1.0);

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
    var out: VOut;

    let seg_idx = vi / 6u;        // segment index in [0, bar_count-warmup-2]
    let corn    = vi % 6u;
    // Actual bar indices in the arena (offset by warmup)
    let bar0    = seg_idx + u.warmup_bars;
    let bar1    = bar0 + 1u;

    // Clip if out of range (guard against miscalculated draw count)
    if bar1 >= u.bar_count {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.alpha = 0.0;
        return out;
    }

    let v0 = arena[u.arena_offset + bar0];
    let v1 = arena[u.arena_offset + bar1];

    // Clip NaN segments (NaN comparisons always false → clip both)
    if !( v0 == v0 && v1 == v1 ) {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.alpha = 0.0;
        return out;
    }

    let price_range = max(u.price_max - u.price_min, 1e-6);
    let slots       = u.slots;
    let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
    let slot_w      = u.plot_w / logical_len;

    // Bar-centre pixel X
    let x0_px = (f32(bar0) + 0.5 - u.offset_slots) * slot_w;
    let x1_px = (f32(bar1) + 0.5 - u.offset_slots) * slot_w;

    // Price → pixel Y  (Y increases downward in screen space)
    let y0_px = (1.0 - (v0 - u.price_min) / price_range) * u.plot_h;
    let y1_px = (1.0 - (v1 - u.price_min) / price_range) * u.plot_h;

    // Thick-line perpendicular expansion
    let dx = x1_px - x0_px;
    let dy = y1_px - y0_px;
    let len_sq  = dx * dx + dy * dy;
    let inv_len = select(0.0, inverseSqrt(len_sq), len_sq > 1e-12);
    let hw      = u.line_width_px * 0.5;
    let hw_ext  = hw + 0.5;
    let perp_x  = -dy * inv_len * hw_ext;
    let perp_y  =  dx * inv_len * hw_ext;

    let use_p1 = ENDPOINT[corn];
    let sgn    = SIGN[corn];
    let base_x = select(x0_px, x1_px, use_p1 == 1u);
    let base_y = select(y0_px, y1_px, use_p1 == 1u);
    let px     = base_x + perp_x * sgn;
    let py     = base_y + perp_y * sgn;

    out.pos     = vec4<f32>(px / u.plot_w * 2.0 - 1.0, 1.0 - py / u.plot_h * 2.0, 0.0, 1.0);
    out.alpha   = 1.0;
    out.dist_px = SIGN[corn] * hw_ext;
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    let hw       = u.line_width_px * 0.5;
    let coverage = 1.0 - smoothstep(hw - 0.5, hw + 0.5, abs(in.dist_px));
    let a        = u.color.a * in.alpha * coverage;
    return vec4<f32>(u.color.rgb * a, a);   // premultiplied alpha
}
