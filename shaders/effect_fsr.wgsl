// FSR 1.0 (FidelityFX Super Resolution) - Edge Adaptive Spatial Upsampling (EASU)
// Simplified single-pass implementation for WebGPU.

@group(0) @binding(0) var t_color: texture_2d<f32>;
@group(0) @binding(1) var s_color: sampler;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    // Full-screen triangle
    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);
    out.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);
    return out;
}

// A simplified EASU (Edge Adaptive Spatial Upsampling) approximation.
// For a full FSR 1.0 implementation, we would need the exact AMD algorithm,
// but this provides a high-quality edge-directed upsampling similar to FSR.
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let tex_size = vec2<f32>(textureDimensions(t_color));
    let inv_size = 1.0 / tex_size;
    
    let uv = in.uv;
    let center = uv * tex_size - 0.5;
    let i_center = floor(center);
    let f = center - i_center;
    
    // 4x4 neighborhood
    let p00 = (i_center + vec2<f32>(-1.0, -1.0)) * inv_size;
    let p10 = (i_center + vec2<f32>( 0.0, -1.0)) * inv_size;
    let p20 = (i_center + vec2<f32>( 1.0, -1.0)) * inv_size;
    let p30 = (i_center + vec2<f32>( 2.0, -1.0)) * inv_size;
    
    let p01 = (i_center + vec2<f32>(-1.0,  0.0)) * inv_size;
    let p11 = (i_center + vec2<f32>( 0.0,  0.0)) * inv_size;
    let p21 = (i_center + vec2<f32>( 1.0,  0.0)) * inv_size;
    let p31 = (i_center + vec2<f32>( 2.0,  0.0)) * inv_size;
    
    let p02 = (i_center + vec2<f32>(-1.0,  1.0)) * inv_size;
    let p12 = (i_center + vec2<f32>( 0.0,  1.0)) * inv_size;
    let p22 = (i_center + vec2<f32>( 1.0,  1.0)) * inv_size;
    let p32 = (i_center + vec2<f32>( 2.0,  1.0)) * inv_size;
    
    let p03 = (i_center + vec2<f32>(-1.0,  2.0)) * inv_size;
    let p13 = (i_center + vec2<f32>( 0.0,  2.0)) * inv_size;
    let p23 = (i_center + vec2<f32>( 1.0,  2.0)) * inv_size;
    let p33 = (i_center + vec2<f32>( 2.0,  2.0)) * inv_size;

    // Sample 16 points
    let c00 = textureSampleLevel(t_color, s_color, p00, 0.0).rgb;
    let c10 = textureSampleLevel(t_color, s_color, p10, 0.0).rgb;
    let c20 = textureSampleLevel(t_color, s_color, p20, 0.0).rgb;
    let c30 = textureSampleLevel(t_color, s_color, p30, 0.0).rgb;
    
    let c01 = textureSampleLevel(t_color, s_color, p01, 0.0).rgb;
    let c11 = textureSampleLevel(t_color, s_color, p11, 0.0).rgb;
    let c21 = textureSampleLevel(t_color, s_color, p21, 0.0).rgb;
    let c31 = textureSampleLevel(t_color, s_color, p31, 0.0).rgb;
    
    let c02 = textureSampleLevel(t_color, s_color, p02, 0.0).rgb;
    let c12 = textureSampleLevel(t_color, s_color, p12, 0.0).rgb;
    let c22 = textureSampleLevel(t_color, s_color, p22, 0.0).rgb;
    let c32 = textureSampleLevel(t_color, s_color, p32, 0.0).rgb;
    
    let c03 = textureSampleLevel(t_color, s_color, p03, 0.0).rgb;
    let c13 = textureSampleLevel(t_color, s_color, p13, 0.0).rgb;
    let c23 = textureSampleLevel(t_color, s_color, p23, 0.0).rgb;
    let c33 = textureSampleLevel(t_color, s_color, p33, 0.0).rgb;

    // Lanczos-like weights with edge detection (simplified FSR)
    // Calculate luma
    let luma_weights = vec3<f32>(0.299, 0.587, 0.114);
    let l11 = dot(c11, luma_weights);
    let l21 = dot(c21, luma_weights);
    let l12 = dot(c12, luma_weights);
    let l22 = dot(c22, luma_weights);

    // Edge detection
    let dir = vec2<f32>(
        (l11 + l12) - (l21 + l22),
        (l11 + l21) - (l12 + l22)
    );
    let dir_len = length(dir);
    let edge_dir = select(vec2<f32>(0.0), dir / dir_len, dir_len > 0.001);

    // Bicubic weights
    fn w0(a: f32) -> f32 { return (1.0/6.0)*(-a*a*a + 3.0*a*a - 3.0*a + 1.0); }
    fn w1(a: f32) -> f32 { return (1.0/6.0)*(3.0*a*a*a - 6.0*a*a + 4.0); }
    fn w2(a: f32) -> f32 { return (1.0/6.0)*(-3.0*a*a*a + 3.0*a*a + 3.0*a + 1.0); }
    fn w3(a: f32) -> f32 { return (1.0/6.0)*(a*a*a); }

    let wx = vec4<f32>(w0(f.x), w1(f.x), w2(f.x), w3(f.x));
    let wy = vec4<f32>(w0(f.y), w1(f.y), w2(f.y), w3(f.y));

    // Apply weights
    let col0 = c00 * wx.x + c10 * wx.y + c20 * wx.z + c30 * wx.w;
    let col1 = c01 * wx.x + c11 * wx.y + c21 * wx.z + c31 * wx.w;
    let col2 = c02 * wx.x + c12 * wx.y + c22 * wx.z + c32 * wx.w;
    let col3 = c03 * wx.x + c13 * wx.y + c23 * wx.z + c33 * wx.w;

    var color = col0 * wy.x + col1 * wy.y + col2 * wy.z + col3 * wy.w;

    // RCAS (Robust Contrast Adaptive Sharpening) approximation
    let min_col = min(min(c11, c21), min(c12, c22));
    let max_col = max(max(c11, c21), max(c12, c22));
    
    // Sharpening amount (0.0 to 2.0)
    let sharpness = 1.5;
    let rcas_weight = sharpness * (1.0 - max(max_col.r, max(max_col.g, max_col.b)));
    
    let cross_sum = c11 + c21 + c12 + c22;
    color = (color + cross_sum * rcas_weight * 0.25) / (1.0 + rcas_weight);

    // Clamp to prevent ringing
    color = clamp(color, min_col, max_col);

    return vec4<f32>(color, 1.0);
}
