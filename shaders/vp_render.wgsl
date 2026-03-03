// vp_render.wgsl
// Renders a volume profile histogram as horizontal bars on the right side of the chart.
//
// Each draw instance corresponds to one price bin (bin 0 = lowest price at bottom).
// JS calls: pass.draw(6, num_bins) — 6 verts × num_bins instances.
//
// vp_buffer layout (produced by volume_profile.wgsl):
//   vp_buffer[0 .. num_bins-1] : u32 volume counts per bin
//   vp_buffer[num_bins]        : u32 max count across all bins (atomicMax tracking)

struct Uniforms {
    // 0..15
    plot_w:   f32,   // physical canvas width  (pixels)
    plot_h:   f32,   // physical canvas height (pixels)
    num_bins: u32,   // number of price bins
    _pad0:    u32,
    // 16..31
    panel_x:  f32,   // left edge of VP panel (pixels from left)
    panel_w:  f32,   // maximum bar width  (pixels)
    r:        f32,   // bar fill color R
    g:        f32,   // bar fill color G
    // 32..47
    b:        f32,   // bar fill color B
    a:        f32,   // bar fill color A (base opacity)
    _pad1:    u32,
    _pad2:    u32,
}

@group(0) @binding(0) var<uniform>         u:       Uniforms;
@group(0) @binding(1) var<storage, read>   vp_bins: array<u32>;

struct VertexOut {
    @builtin(position) pos:   vec4<f32>,
    @location(0)       alpha: f32,
}

@vertex
fn vs_main(
    @builtin(vertex_index)   vi: u32,
    @builtin(instance_index) ii: u32,
) -> VertexOut {
    let bin_idx   = ii;
    let count     = vp_bins[bin_idx];
    let max_count = vp_bins[u.num_bins];   // stored at vp_buffer[num_bins]

    // Normalized bar length in [0.0, 1.0].  0 when max is 0 to avoid div-by-zero.
    let norm = select(0.0, f32(count) / f32(max_count), max_count > 0u);

    // Vertical extents for this bin (bin 0 is at the bottom of the chart).
    let bar_h = u.plot_h / f32(u.num_bins);
    let y_bot = u.plot_h - f32(bin_idx)       * bar_h;
    let y_top = u.plot_h - f32(bin_idx + 1u)  * bar_h;

    // Horizontal extents: bars grow leftward from panel_x + panel_w.
    let bar_right = u.panel_x + u.panel_w;
    let bar_left  = u.panel_x + u.panel_w * (1.0 - norm);

    // 6 vertices forming 2 CCW triangles (TL, TR, BL | TR, BR, BL)
    var px: f32;
    var py: f32;
    switch (vi) {
        case 0u: { px = bar_left;  py = y_top; }
        case 1u: { px = bar_right; py = y_top; }
        case 2u: { px = bar_left;  py = y_bot; }
        case 3u: { px = bar_right; py = y_top; }
        case 4u: { px = bar_right; py = y_bot; }
        case 5u: { px = bar_left;  py = y_bot; }
        default: { px = 0.0;       py = 0.0;   }
    }

    // Pixel → NDC  (y-axis flipped: pixel top = NDC +1)
    let ndc_x = (px / u.plot_w) *  2.0 - 1.0;
    let ndc_y = (py / u.plot_h) * -2.0 + 1.0;

    var out: VertexOut;
    out.pos   = vec4<f32>(ndc_x, ndc_y, 0.0, 1.0);
    out.alpha = norm;
    return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
    // Premultiplied alpha output (canvas is configured with alphaMode = "premultiplied").
    let aa = u.a * in.alpha;
    return vec4<f32>(u.r * aa, u.g * aa, u.b * aa, aa);
}
