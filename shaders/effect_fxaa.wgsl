// FXAA (Fast Approximate Anti-Aliasing) Shader
// Based on NVIDIA FXAA 3.11 by Timothy Lottes
//
// All textureSample → textureSampleLevel(..., 0.0) to satisfy WGSL uniform
// control flow requirement (textureSample is forbidden in non-uniform branches).

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    // Fullscreen triangle
    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);
    out.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);
    return out;
}

@group(0) @binding(0) var t_color: texture_2d<f32>;
@group(0) @binding(1) var s_color: sampler;

// FXAA Parameters — tuned for financial charts (sharp lines, DPR<2 only path)
//
// EDGE_THRESHOLD:  0.125 (ultra) → 0.250 (high)  — ignore subtle gradients,
//                  preserve fine candle edges.
// SUBPIX_CAP:      0.75 → 0.50  — halve subpixel blending to reduce blur.
// SUBPIX_TRIM:     0.125 → 0.25 — trim low-contrast subpixel AA earlier.
const FXAA_EDGE_THRESHOLD: f32 = 0.250;
const FXAA_EDGE_THRESHOLD_MIN: f32 = 0.03125;
const FXAA_SEARCH_STEPS: i32 = 10;
const FXAA_SEARCH_ACCELERATION: i32 = 1;
const FXAA_SEARCH_THRESHOLD: f32 = 0.25;
const FXAA_SUBPIX_CAP: f32 = 0.50;
const FXAA_SUBPIX_TRIM: f32 = 0.25;

fn rgb2luma(rgb: vec3<f32>) -> f32 {
    return dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
}

// Helper: sample at UV with explicit LOD=0 (no uniform control flow restriction)
fn samp(uv: vec2<f32>) -> vec3<f32> {
    return textureSampleLevel(t_color, s_color, uv, 0.0).rgb;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let tex_size = vec2<f32>(textureDimensions(t_color));
    let inverse_screen_size = 1.0 / tex_size;
    let uv = in.uv;

    let colorCenter = samp(uv);
    let lumaCenter = rgb2luma(colorCenter);

    let lumaDown  = rgb2luma(samp(uv + vec2<f32>( 0.0,  1.0) * inverse_screen_size));
    let lumaUp    = rgb2luma(samp(uv + vec2<f32>( 0.0, -1.0) * inverse_screen_size));
    let lumaLeft  = rgb2luma(samp(uv + vec2<f32>(-1.0,  0.0) * inverse_screen_size));
    let lumaRight = rgb2luma(samp(uv + vec2<f32>( 1.0,  0.0) * inverse_screen_size));

    let lumaMin = min(lumaCenter, min(min(lumaDown, lumaUp), min(lumaLeft, lumaRight)));
    let lumaMax = max(lumaCenter, max(max(lumaDown, lumaUp), max(lumaLeft, lumaRight)));
    let lumaRange = lumaMax - lumaMin;

    if (lumaRange < max(FXAA_EDGE_THRESHOLD_MIN, lumaMax * FXAA_EDGE_THRESHOLD)) {
        return vec4<f32>(colorCenter, 1.0);
    }

    let lumaDownLeft  = rgb2luma(samp(uv + vec2<f32>(-1.0,  1.0) * inverse_screen_size));
    let lumaUpRight   = rgb2luma(samp(uv + vec2<f32>( 1.0, -1.0) * inverse_screen_size));
    let lumaUpLeft    = rgb2luma(samp(uv + vec2<f32>(-1.0, -1.0) * inverse_screen_size));
    let lumaDownRight = rgb2luma(samp(uv + vec2<f32>( 1.0,  1.0) * inverse_screen_size));

    let lumaDownUp    = lumaDown + lumaUp;
    let lumaLeftRight = lumaLeft + lumaRight;

    let lumaLeftCorners  = lumaDownLeft + lumaUpLeft;
    let lumaDownCorners  = lumaDownLeft + lumaDownRight;
    let lumaRightCorners = lumaDownRight + lumaUpRight;
    let lumaUpCorners    = lumaUpRight + lumaUpLeft;

    let edgeHorizontal = abs(-2.0 * lumaLeft + lumaLeftCorners) + abs(-2.0 * lumaCenter + lumaDownUp) * 2.0 + abs(-2.0 * lumaRight + lumaRightCorners);
    let edgeVertical   = abs(-2.0 * lumaUp + lumaUpCorners) + abs(-2.0 * lumaCenter + lumaLeftRight) * 2.0 + abs(-2.0 * lumaDown + lumaDownCorners);

    let isHorizontal = (edgeHorizontal >= edgeVertical);

    let luma1     = select(lumaLeft, lumaDown, isHorizontal);
    let luma2     = select(lumaRight, lumaUp, isHorizontal);
    let gradient1 = luma1 - lumaCenter;
    let gradient2 = luma2 - lumaCenter;

    let is1Steepest  = abs(gradient1) >= abs(gradient2);
    let gradientScaled = 0.25 * max(abs(gradient1), abs(gradient2));

    var stepLength       = select(inverse_screen_size.x, inverse_screen_size.y, isHorizontal);
    var lumaLocalAverage = 0.0;

    if (is1Steepest) {
        stepLength       = -stepLength;
        lumaLocalAverage = 0.5 * (luma1 + lumaCenter);
    } else {
        lumaLocalAverage = 0.5 * (luma2 + lumaCenter);
    }

    var currentUv = uv;
    if (isHorizontal) {
        currentUv.y += stepLength * 0.5;
    } else {
        currentUv.x += stepLength * 0.5;
    }

    let offset = select(vec2<f32>(inverse_screen_size.x, 0.0), vec2<f32>(0.0, inverse_screen_size.y), isHorizontal);

    var uv1 = currentUv - offset;
    var uv2 = currentUv + offset;

    var lumaEnd1 = rgb2luma(samp(uv1)) - lumaLocalAverage;
    var lumaEnd2 = rgb2luma(samp(uv2)) - lumaLocalAverage;

    var reached1    = abs(lumaEnd1) >= gradientScaled;
    var reached2    = abs(lumaEnd2) >= gradientScaled;
    var reachedBoth = reached1 && reached2;

    if (!reached1) { uv1 -= offset; }
    if (!reached2) { uv2 += offset; }

    if (!reachedBoth) {
        for (var i = 2; i < FXAA_SEARCH_STEPS; i++) {
            if (!reached1) {
                lumaEnd1 = rgb2luma(samp(uv1)) - lumaLocalAverage;
            }
            if (!reached2) {
                lumaEnd2 = rgb2luma(samp(uv2)) - lumaLocalAverage;
            }
            reached1    = abs(lumaEnd1) >= gradientScaled;
            reached2    = abs(lumaEnd2) >= gradientScaled;
            reachedBoth = reached1 && reached2;

            if (!reached1) { uv1 -= offset * f32(FXAA_SEARCH_ACCELERATION); }
            if (!reached2) { uv2 += offset * f32(FXAA_SEARCH_ACCELERATION); }

            if (reachedBoth) { break; }
        }
    }

    let distance1 = select(uv.y - uv1.y, uv.x - uv1.x, isHorizontal);
    let distance2 = select(uv2.y - uv.y, uv2.x - uv.x, isHorizontal);

    let isDirection1  = distance1 < distance2;
    let distanceFinal = min(distance1, distance2);
    let edgeThickness = (distance1 + distance2);
    let pixelOffset   = -distanceFinal / edgeThickness + 0.5;

    let isLumaCenterSmaller = lumaCenter < lumaLocalAverage;
    let correctVariation    = ((select(lumaEnd2, lumaEnd1, isDirection1) < 0.0) != isLumaCenterSmaller);
    let finalOffset         = select(0.0, pixelOffset, correctVariation);

    let lumaAverage      = (1.0/12.0) * (2.0 * (lumaDownUp + lumaLeftRight) + lumaLeftCorners + lumaRightCorners);
    let subPixelOffset1  = clamp(abs(lumaAverage - lumaCenter) / lumaRange, 0.0, 1.0);
    let subPixelOffset2  = (-2.0 * subPixelOffset1 + 3.0) * subPixelOffset1 * subPixelOffset1;
    let subPixelOffsetFinal = subPixelOffset2 * subPixelOffset2 * FXAA_SUBPIX_CAP;

    let finalPixelOffset = max(finalOffset, subPixelOffsetFinal);

    var finalUv = uv;
    if (isHorizontal) {
        finalUv.y += finalPixelOffset * stepLength;
    } else {
        finalUv.x += finalPixelOffset * stepLength;
    }

    let finalColor = samp(finalUv);
    return vec4<f32>(finalColor, 1.0);
}
