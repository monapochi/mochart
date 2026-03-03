// candles_instanced.wgsl — instanced multi-candle renderer (JS-supplied price range)
//
// Visual spec (matches src/renderer/canvas/canvasRenderer.ts):
//   - Bull body: #2e7d32  Bear body: #d32f2f          (same as Canvas upColor/downColor)
//   - Wick: always #222222 dark (independent of bull/bear) — matches Canvas wickColor
//   - Body outline: 1px #222222 border on left/right edges when candle_width > 2px
//   - Doji: body height < 1.5px in price space → 1.5px minimum height (centred)
//   - Anti-aliasing: via 4× MSAA at pipeline level
//
// Storage buffer layout: [open×len | high×len | low×len | close×len] (all f32)
//
// Uniforms (32 B):
//   offset  0: min           (f32) — price range lower bound
//   offset  4: max           (f32) — price range upper bound
//   offset  8: plot_width    (f32) — canvas plot width in CSS pixels
//   offset 12: candle_width  (f32) — candle body width in CSS pixels
//   offset 16: len           (u32) — number of visible bars
//   offset 20: plot_h        (f32) — canvas plot height in CSS pixels
//   offset 24: _p0           (u32)
//   offset 28: _p1           (u32)

struct Uniforms {
    min          : f32,
    max          : f32,
    plot_width   : f32,
    candle_width : f32,
    len          : u32,
    plot_h       : f32,
    _p0          : u32,
    _p1          : u32,
}

@group(0) @binding(0) var<uniform>       uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> data     : array<f32>;

struct VOut {
    @builtin(position)                  position   : vec4<f32>,
    @location(0) @interpolate(flat)     ii         : u32,
    @location(1) @interpolate(flat)     is_wick    : u32,
    @location(2)                        body_x_px  : f32,
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

    let price_range = max(uniforms.max - uniforms.min, 1e-6);
    // Price value of 1 screen pixel — used for doji clamping
    let px_price = price_range / max(uniforms.plot_h, 1.0);

    // Doji: body height < 1.5px → inflate to 1.5px centred on mid-price
    let is_doji  = abs(close - open) < 1.5 * px_price;
    let mid      = (open + close) * 0.5;
    let body_bot = select(min(open, close), mid - 0.75 * px_price, is_doji);
    let body_top = select(max(open, close), mid + 0.75 * px_price, is_doji);

    // 12 vertices per instance: 0-5 = body quad, 6-11 = wick quad
    var bv = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
        vec2<f32>(-0.5, 1.0), vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0)
    );
    // Wick: ±0.5 px fixed — not scaled by candle_width
    var wv = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
        vec2<f32>(-0.5, 1.0), vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0)
    );

    var y_price  : f32;
    var x_offset : f32;
    var is_wick  : u32;
    var body_x   : f32;   // pixels from body centre — interpolated for outline detection

    if vi < 6u {
        let p     = bv[vi];
        y_price   = mix(body_bot, body_top, p.y);
        x_offset  = p.x * uniforms.candle_width;
        is_wick   = 0u;
        body_x    = p.x * uniforms.candle_width;
    } else {
        let p     = wv[(vi - 6u) % 6u];
        y_price   = mix(low, high, p.y);
        x_offset  = p.x;  // ±0.5 px — 1px fixed wick
        is_wick   = 1u;
        body_x    = 0.0;
    }

    let y  = (y_price - uniforms.min) / price_range * 2.0 - 1.0;
    let cx = (f32(ii) + 0.5) * (uniforms.plot_width / f32(len));
    let x  = (cx + x_offset) / uniforms.plot_width * 2.0 - 1.0;

    var out : VOut;
    out.position   = vec4<f32>(x, y, 0.0, 1.0);
    out.ii         = ii;
    out.is_wick    = is_wick;
    out.body_x_px  = body_x;
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    let len   = uniforms.len;
    let ii    = in.ii;
    let open  = data[ii];
    let close = data[len * 3u + ii];

    // Wick: always dark #222222 — matches Canvas wickColor/outlineColor
    if in.is_wick == 1u {
        return vec4<f32>(0.133, 0.133, 0.133, 1.0);
    }

    let bull = close >= open;
    let base = select(
        vec3<f32>(0.824, 0.184, 0.184),  // bear  #d32f2f
        vec3<f32>(0.180, 0.490, 0.196),  // bull  #2e7d32
        bull
    );

    // 1px dark border on body left/right edges when candle is wide enough to show it
    let cw = uniforms.candle_width;
    if cw > 2.0 && abs(in.body_x_px) >= cw * 0.5 - 1.0 {
        return vec4<f32>(0.133, 0.133, 0.133, 1.0);  // #222
    }

    return vec4<f32>(base, 1.0);
}
