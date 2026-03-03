// volume_profile.wgsl
// Computes a volume profile histogram on the GPU

@group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
@group(0) @binding(1) var<storage, read_write> profile_bins: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: Params;

struct Params {
    total_len: u32,
    start_index: u32,
    visible_count: u32,
    num_bins: u32,
    price_min: f32,
    price_max: f32,
    _pad1: u32,
    _pad2: u32,
}

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.visible_count) {
        return;
    }

    let data_idx = params.start_index + idx;
    
    // Layout: [open×len | high×len | low×len | close×len | volume×len]
    let close_offset = params.total_len * 3u;
    let vol_offset = params.total_len * 4u;
    
    let close = ohlcv[close_offset + data_idx];
    let vol = ohlcv[vol_offset + data_idx];
    
    if (close < params.price_min || close > params.price_max) {
        return;
    }
    
    // Calculate bin index
    let price_range = params.price_max - params.price_min;
    let normalized = (close - params.price_min) / price_range;
    var bin_idx = u32(normalized * f32(params.num_bins));
    
    if (bin_idx >= params.num_bins) {
        bin_idx = params.num_bins - 1u;
    }
    
    // Add volume to bin (using atomic add, assuming volume is scaled to u32)
    // For simplicity, we just add 1 per trade or scale volume
    let vol_u32 = u32(vol);
    atomicAdd(&profile_bins[bin_idx], vol_u32);

    // Track global maximum at vp_buffer[num_bins] for normalisation in vp_render.wgsl.
    // vp_buffer must be allocated as (num_bins + 1) × 4 bytes.
    atomicMax(&profile_bins[params.num_bins], vol_u32);
}
