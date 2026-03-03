// draw_candle: single-candle debug renderer
//
// Uniforms layout (32 B):
//   offset  0: min_price  (f32)
//   offset  4: max_price  (f32)
//   offset  8: open       (f32)
//   offset 12: high       (f32)
//   offset 16: low        (f32)
//   offset 20: close      (f32)
//   offset 24: center_x   (f32)  — NDC x of candle centre
//   offset 28: width      (f32)  — NDC half-width

struct Candle {
    min   : f32,
    max   : f32,
    open  : f32,
    high  : f32,
    low   : f32,
    close : f32,
    cx    : f32,
    w     : f32,
}

@group(0) @binding(0) var<uniform> candle: Candle;

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
    var verts = array<vec2<f32>, 6>(
        vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
        vec2<f32>(-0.5, 1.0), vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0)
    );
    let p = verts[vi];
    let y = (mix(candle.min, candle.max, p.y) - candle.min) / (candle.max - candle.min) * 2.0 - 1.0;
    let x = candle.cx + p.x * candle.w;
    return vec4<f32>(x, y, 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    if candle.close >= candle.open {
        return vec4<f32>(0.0, 0.8, 0.0, 1.0); // bullish — green
    }
    return vec4<f32>(0.8, 0.0, 0.0, 1.0); // bearish — red
}
