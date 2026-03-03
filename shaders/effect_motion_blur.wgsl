// effect_motion_blur.wgsl — temporal blending for motion blur
//
// Blends the current frame with the previous frame.

struct Uniforms {
    alpha : f32,
    _pad1 : f32,
    _pad2 : f32,
    _pad3 : f32,
}

@group(0) @binding(0) var current_tex : texture_2d<f32>;
@group(0) @binding(1) var prev_tex    : texture_2d<f32>;
@group(0) @binding(2) var tex_sampler : sampler;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

struct VOut {
    @builtin(position) position : vec4<f32>,
    @location(0)       uv       : vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
    // Fullscreen triangle
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    var uv = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0)
    );
    
    var out: VOut;
    out.position = vec4<f32>(pos[vi], 0.0, 1.0);
    out.uv = uv[vi];
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    let current = textureSample(current_tex, tex_sampler, in.uv);
    let prev    = textureSample(prev_tex, tex_sampler, in.uv);
    
    // Blend: current * (1 - alpha) + prev * alpha
    let blended = mix(current, prev, uniforms.alpha);
    
    return blended;
}
