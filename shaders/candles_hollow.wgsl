// candles_hollow.wgsl — hollow candle renderer
//
// Visual spec:
//   - Bull body: hollow (transparent inside), green outline (#2e7d32)
//   - Bear body: filled red (#d32f2f)
//   - Wick: matches body outline color
//   - Anti-aliasing: via 4× MSAA at pipeline level

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
    @location(3)                        body_y_px  : f32,
    @location(4) @interpolate(flat)     body_h_px  : f32,
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
    let px_price = price_range / max(uniforms.plot_h, 1.0);

    let is_doji  = abs(close - open) < 1.5 * px_price;
    let mid      = (open + close) * 0.5;
    let body_bot = select(min(open, close), mid - 0.75 * px_price, is_doji);
    let body_top = select(max(open, close), mid + 0.75 * px_price, is_doji);

    var bv = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
        vec2<f32>(-0.5, 1.0), vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0)
    );
    var wv = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
        vec2<f32>(-0.5, 1.0), vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0)
    );

    var y_price  : f32;
    var x_offset : f32;
    var is_wick  : u32;
    var body_x   : f32;
    var body_y   : f32;

    let body_h_px = (body_top - body_bot) / px_price;

    if vi < 6u {
        let p     = bv[vi];
        y_price   = mix(body_bot, body_top, p.y);
        x_offset  = p.x * uniforms.candle_width;
        is_wick   = 0u;
        body_x    = p.x * uniforms.candle_width;
        body_y    = p.y * body_h_px;
    } else {
        let p     = wv[(vi - 6u) % 6u];
        y_price   = mix(low, high, p.y);
        x_offset  = p.x;
        is_wick   = 1u;
        body_x    = 0.0;
        body_y    = 0.0;
    }

    let y  = (y_price - uniforms.min) / price_range * 2.0 - 1.0;
    let cx = (f32(ii) + 0.5) * (uniforms.plot_width / f32(len));
    let x  = (cx + x_offset) / uniforms.plot_width * 2.0 - 1.0;

    var out : VOut;
    out.position   = vec4<f32>(x, y, 0.0, 1.0);
    out.ii         = ii;
    out.is_wick    = is_wick;
    out.body_x_px  = body_x;
    out.body_y_px  = body_y;
    out.body_h_px  = body_h_px;
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    let len   = uniforms.len;
    let ii    = in.ii;
    let open  = data[ii];
    let close = data[len * 3u + ii];

    let bull = close >= open;
    let color = select(
        vec3<f32>(0.824, 0.184, 0.184),  // bear  #d32f2f
        vec3<f32>(0.180, 0.490, 0.196),  // bull  #2e7d32
        bull
    );

    if in.is_wick == 1u {
        return vec4<f32>(color, 1.0);
    }

    let cw = uniforms.candle_width;
    let border_w = 1.0;

    if bull {
        // Hollow body for bull
        let is_border_x = abs(in.body_x_px) >= cw * 0.5 - border_w;
        let is_border_y = in.body_y_px <= border_w || in.body_y_px >= in.body_h_px - border_w;
        
        if is_border_x || is_border_y {
            return vec4<f32>(color, 1.0);
        } else {
            discard; // Transparent inside
        }
    }

    // Filled body for bear
    if cw > 2.0 && abs(in.body_x_px) >= cw * 0.5 - border_w {
        return vec4<f32>(color * 0.8, 1.0); // Slightly darker border for bear
    }

    return vec4<f32>(color, 1.0);
}
