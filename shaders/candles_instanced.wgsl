// candles_instanced.wgsl — instanced multi-candle renderer (JS-supplied price range)
//
// Optimizations:
//   - No storage reads in fragment shader  (was: 2×open/close reads per frag)
//   - No position.y → price reconstruction (was: divide + 3 muls per wick frag)
//   - No array LUTs in vertex shader       (was: 2×array<vec2,6> register pressure)
//   - pr_inv precomputed                   (1 division instead of 2 for NDC)
//   - Single rel_y varying is dual-purpose:
//       body verts: [0,1] bottom→top      (top/bottom border detection)
//       wick verts: (y_price-body_bot)/bh  (wick suppression, no position.y)
//   - bull/is_wick packed into one flags u32 (saves an inter-stage slot)
//
// Storage buffer layout: [open×len | high×len | low×len | close×len] (f32)
//
// Uniforms (96 B):
//   offset  0: min, max, plot_width, candle_width  (4×f32)
//   offset 16: len(u32), plot_h, border_width, _pad
//   offset 32: bull_color, bear_color, wick_color, border_color  (4×vec4<f32>)

struct Uniforms {
    min          : f32,
    max          : f32,
    plot_width   : f32,
    candle_width : f32,
    len          : u32,
    plot_h       : f32,
    border_width : f32,
    _p0          : u32,
    bull_color   : vec4<f32>,
    bear_color   : vec4<f32>,
    wick_color   : vec4<f32>,
    border_color : vec4<f32>,
}

@group(0) @binding(0) var<uniform>       uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> data     : array<f32>;

struct VOut {
    @builtin(position)              position : vec4<f32>,
    // bit 0 = is_wick, bit 1 = bull — packed to save an inter-stage slot
    @location(0) @interpolate(flat) flags    : u32,
    // body height in pixels — flat per-instance constant for T/B border check
    @location(1) @interpolate(flat) bh_px    : f32,
    // body-relative y [0,1]:
    //   body verts → uy           (top/bottom border detection)
    //   wick verts → (y-bot)/bh   (wick suppression without position.y)
    @location(2)                    rel_y    : f32,
    // body-relative x [-0.5, +0.5]; 0.0 for wick (left/right border check)
    @location(3)                    body_xn  : f32,
}

@vertex
fn vs_main(
    @builtin(vertex_index)   vi : u32,
    @builtin(instance_index) ii : u32,
) -> VOut {
    let len   = uniforms.len;
    let open  = data[ii];
    let high  = data[len + ii];
    let low   = data[len * 2u + ii];
    let close = data[len * 3u + ii];

    let pr       = max(uniforms.max - uniforms.min, 1e-6);
    let pr_inv   = 1.0 / pr;                        // precompute: 1 div shared
    let px_price = pr / max(uniforms.plot_h, 1.0);

    // Doji: body height < 1.5px → inflate to 1.5px centred on mid-price
    let is_doji  = abs(close - open) < 1.5 * px_price;
    let mid      = (open + close) * 0.5;
    let body_bot = select(min(open, close), mid - 0.75 * px_price, is_doji);
    let body_top = select(max(open, close), mid + 0.75 * px_price, is_doji);
    let body_h   = body_top - body_bot;             // >= 1.5 * px_price guaranteed

    // Body height in pixels — flat varying for T/B border check in fragment
    let bh_px = body_h * pr_inv * uniforms.plot_h;

    // Quad UVs via bit arithmetic — avoids array<vec2,6> register pressure.
    // Two-triangle CCW quad: 0:(-½,0) 1:(+½,0) 2:(-½,1) 3:(-½,1) 4:(+½,0) 5:(+½,1)
    let j  = vi % 6u;
    let ux = select(-0.5, 0.5, j == 1u || j >= 4u);  // x ∈ {-½, +½}
    let uy = select(0.0,  1.0, j >= 2u && j != 4u);  // y ∈ {0,  1}

    var y_price : f32;
    var x_off   : f32;
    var rel_y   : f32;
    var body_xn : f32;
    var is_wick : u32;

    if vi < 6u {
        // ── Body quad ─────────────────────────────────────────────────────
        y_price = mix(body_bot, body_top, uy);
        x_off   = ux * uniforms.candle_width;
        rel_y   = uy;           // [0,1]: interpolated bottom→top
        body_xn = ux;           // [-½,+½]: interpolated left→right
        is_wick = 0u;
    } else {
        // ── Wick quad  ─────────────────────────────────────────────────────
        y_price = mix(low, high, uy);
        x_off   = ux;           // ±0.5 px fixed width
        // rel_y encodes position relative to body; fragment suppresses without
        // reconstructing y_price from position.y (avoids a division per-fragment)
        rel_y   = (y_price - body_bot) / body_h;
        body_xn = 0.0;          // unused for wick border check
        is_wick = 1u;
    }

    let bull  = u32(close >= open);
    let flags = is_wick | (bull << 1u);

    let y  = (y_price - uniforms.min) * pr_inv * 2.0 - 1.0;  // pr_inv reused
    // Calculate x based on slots variable (_p0) instead of len
    let slots = uniforms._p0;
    let logical_len = select(f32(len), f32(slots), slots > 0u);
    let cx = (f32(ii) + 0.5) * (uniforms.plot_width / logical_len);
    let x  = (cx + x_off) / uniforms.plot_width * 2.0 - 1.0;

    var out : VOut;
    out.position = vec4<f32>(x, y, 0.0, 1.0);
    out.flags    = flags;
    out.bh_px    = bh_px;
    out.rel_y    = rel_y;
    out.body_xn  = body_xn;
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    // Unpack flags — zero storage/buffer reads in this shader stage
    let is_wick    = (in.flags & 1u) != 0u;
    let bull       = (in.flags >> 1u) != 0u;
    let body_color = select(uniforms.bear_color, uniforms.bull_color, bull);

    // ── Wick: suppress fragment inside body y-range ───────────────────────
    // rel_y == (y_this_frag - body_bot) / body_h, set per-vertex in VS:
    //   [0, 1] = inside body → draw body colour (no "skewered" look)
    //   outside = actual wick  → draw wick colour
    if is_wick {
        if in.rel_y >= 0.0 && in.rel_y <= 1.0 {
            return body_color;
        }
        return uniforms.wick_color;
    }

    // ── Body: 4-sided border (wglchart.js LINE_LOOP equivalent) ──────────
    let bw = uniforms.border_width;
    let cw = uniforms.candle_width;
    let bh = in.bh_px;

    let on_lr = cw > 2.0 * bw && abs(in.body_xn) * cw >= cw * 0.5 - bw;
    let on_tb = bh > 2.0 * bw && (
        in.rel_y * bh < bw || (1.0 - in.rel_y) * bh < bw
    );

    if on_lr || on_tb {
        return uniforms.border_color;
    }

    return body_color;
}
