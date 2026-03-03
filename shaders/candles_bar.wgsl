// candles_bar.wgsl — OHLC bar chart renderer
//
// Visual spec:
//   - Vertical line from Low to High
//   - Left horizontal tick for Open
//   - Right horizontal tick for Close
//   - Bull: green (#2e7d32)
//   - Bear: red (#d32f2f)

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

    // 18 vertices per instance: 
    // 0-5: Vertical line (Low to High)
    // 6-11: Open tick (Left)
    // 12-17: Close tick (Right)

    var y_price  : f32;
    var x_offset : f32;

    let tick_w = max(uniforms.candle_width * 0.5, 1.0);
    let line_w = 1.0; // 1px line width

    if vi < 6u {
        // Vertical line
        var v = array<vec2<f32>, 6>(
            vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
            vec2<f32>(-0.5, 1.0), vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0)
        );
        let p = v[vi];
        y_price = mix(low, high, p.y);
        x_offset = p.x * line_w;
    } else if vi < 12u {
        // Open tick (Left)
        var v = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -0.5), vec2<f32>(0.0, -0.5), vec2<f32>(-1.0, 0.5),
            vec2<f32>(-1.0, 0.5), vec2<f32>(0.0, -0.5), vec2<f32>(0.0, 0.5)
        );
        let p = v[vi - 6u];
        y_price = open + p.y * px_price * line_w;
        x_offset = p.x * tick_w;
    } else {
        // Close tick (Right)
        var v = array<vec2<f32>, 6>(
            vec2<f32>(0.0, -0.5), vec2<f32>(1.0, -0.5), vec2<f32>(0.0, 0.5),
            vec2<f32>(0.0, 0.5), vec2<f32>(1.0, -0.5), vec2<f32>(1.0, 0.5)
        );
        let p = v[vi - 12u];
        y_price = close + p.y * px_price * line_w;
        x_offset = p.x * tick_w;
    }

    let y  = (y_price - uniforms.min) / price_range * 2.0 - 1.0;
    let cx = (f32(ii) + 0.5) * (uniforms.plot_width / f32(len));
    let x  = (cx + x_offset) / uniforms.plot_width * 2.0 - 1.0;

    var out : VOut;
    out.position   = vec4<f32>(x, y, 0.0, 1.0);
    out.ii         = ii;
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

    return vec4<f32>(color, 1.0);
}
