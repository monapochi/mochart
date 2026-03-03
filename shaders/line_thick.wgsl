// line_thick.wgsl — thick indicator line overlay (TRIANGLE_LIST)
//
// Phase A: replaces line_overlay.wgsl (LINE_STRIP, 1px hardware limit).
//
// Each segment [P0, P1] is expanded to 4 corners → 2 triangles (6 vertices).
// The perpendicular vector is computed in SCREEN-PIXEL space to ensure
// isotropic width regardless of plot aspect ratio.
//
// Topology  : TRIANGLE_LIST
// Vertex cnt: (bar_count - 1) * 6
//
// Uniform layout (64 B, std140-compatible):
//   offset  0: plot_w        (f32) — canvas width in CSS px
//   offset  4: plot_h        (f32) — canvas height in CSS px
//   offset  8: candle_w      (f32) — slot width for X centering
//   offset 12: price_min     (f32)
//   offset 16: price_max     (f32)
//   offset 20: line_width_px (f32) — desired line width in screen pixels
//   offset 24: _pad0         (u32)
//   offset 28: _pad1         (u32)
//   offset 32: color         (vec4<f32>) — RGBA [0,1]  ← 16-byte aligned
//   offset 48: bar_count     (u32)
//   offset 52: nan_start     (u32) — warmup bars (head segments are clipped)
//   offset 56: _pad2         (u32)
//   offset 60: _pad3         (u32)

struct Uniforms {
    plot_w        : f32,
    plot_h        : f32,
    candle_w      : f32,
    price_min     : f32,
    price_max     : f32,
    line_width_px : f32,
    _pad0         : u32,
    _pad1         : u32,
    color         : vec4<f32>,   // offset 32 (16-byte aligned)
    bar_count     : u32,
    nan_start     : u32,
    slots         : u32,
    _pad3         : u32,
}

@group(0) @binding(0) var<uniform>       u:      Uniforms;
@group(0) @binding(1) var<storage, read> values: array<f32>;

struct VOut {
    @builtin(position) pos     : vec4<f32>,
    @location(0)       alpha   : f32,
    // Signed distance from the quad centre line in screen pixels.
    // Range: [-hw, +hw].  Used in fs to feather the edge by 1 px (SDF-AA).
    @location(1)       dist_px : f32,
}

// Mapping of the 6 corners of two triangles forming one quad:
//   tri0: corners 0,1,2   tri1: corners 3,4,5
// endpoint: 0 = use P0, 1 = use P1
// sign:    +1 = P + perp, -1 = P - perp
const ENDPOINT = array<u32, 6>(0u, 0u, 1u,  1u, 0u, 1u);
const SIGN     = array<f32, 6>(1.0, -1.0, 1.0,  1.0, -1.0, -1.0);

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
    var out: VOut;
    let seg_idx = vi / 6u;
    let corn    = vi % 6u;
    let i0      = seg_idx;
    let i1      = seg_idx + 1u;

    // Clip entire segment outside NDC if either endpoint is a warmup bar.
    // All 6 verts of the segment get pos = (2,2,0,1) → all clipped.
    if i0 < u.nan_start {
        out.pos   = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.alpha = 0.0;
        return out;
    }

    let price_range = max(u.price_max - u.price_min, 1e-6);
    let slots       = u.slots;
    let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
    let slot_w      = u.plot_w / logical_len;

    // Bar-centre screen-pixel X
    let x0_px = (f32(i0) + 0.5) * slot_w;
    let x1_px = (f32(i1) + 0.5) * slot_w;

    // Price → screen-pixel Y  (screen Y increases downward, NDC Y increases upward)
    let v0    = values[i0];
    let v1    = values[i1];
    let y0_px = (1.0 - (v0 - u.price_min) / price_range) * u.plot_h;
    let y1_px = (1.0 - (v1 - u.price_min) / price_range) * u.plot_h;

    // Direction vector in screen-pixel space
    let dx = x1_px - x0_px;
    let dy = y1_px - y0_px;

    // Safe inverse length (avoid div-by-zero on zero-length segments)
    let len_sq  = dx * dx + dy * dy;
    let inv_len = select(0.0, inverseSqrt(len_sq), len_sq > 1e-12);

    // Perpendicular: rotate direction 90° CW, scale to half line width.
    // Extend the quad by FEATHER (0.5px) on each side so the smoothstep feather
    // zone is actually rasterised — without this the outer half of the feather
    // falls outside the quad and the line looks hard-alias jagged.
    let hw       = u.line_width_px * 0.5;
    let hw_ext   = hw + 0.5;  // quad extends 0.5px beyond the hard edge for AA
    let perp_x   = -dy * inv_len * hw_ext;
    let perp_y   =  dx * inv_len * hw_ext;

    // Select endpoint and perp-side for this corner
    let use_p1  = ENDPOINT[corn];
    let sgn     = SIGN[corn];

    let base_x  = select(x0_px, x1_px, use_p1 == 1u);
    let base_y  = select(y0_px, y1_px, use_p1 == 1u);

    let px = base_x + perp_x * sgn;
    let py = base_y + perp_y * sgn;

    // Screen pixel → NDC  (Y flipped: NDC +1 = screen top)
    let x_ndc = px / u.plot_w * 2.0 - 1.0;
    let y_ndc = 1.0 - py / u.plot_h * 2.0;

    out.pos     = vec4<f32>(x_ndc, y_ndc, 0.0, 1.0);
    out.alpha   = 1.0;
    // Signed perpendicular distance in screen pixels: ±hw_ext at the corners.
    // The fragment shader uses this to compute sub-pixel coverage.
    out.dist_px = SIGN[corn] * hw_ext;
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    // SDF soft edge: 1 px feather centred exactly on the line boundary.
    // abs(dist_px) == hw at the hard edge; the quad is extended so dist_px
    // reaches hw+0.5 — smoothstep spans [hw-0.5, hw+0.5] giving standard
    // sub-pixel anti-aliasing (0.5 coverage at the geometric edge).
    let hw       = u.line_width_px * 0.5;
    let coverage = 1.0 - smoothstep(hw - 0.5, hw + 0.5, abs(in.dist_px));
    // Premultiplied alpha output (alphaMode = "premultiplied").
    let a = u.color.a * coverage;
    return vec4<f32>(u.color.rgb * a, a);
}
