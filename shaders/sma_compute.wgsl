// sma_compute: GPU-parallel Simple Moving Average
//
// Params (32 B uniform, std140):
//   total_len     : u32   — total elements in the source buffer
//   start_index   : u32   — index within source buffer where visible bars begin
//   visible_count : u32   — number of bars to emit into out[]
//   period        : u32
//   close_offset  : u32   — offset of the close channel in source buffer
//                           = total_len * 3  for 5-channel SoA (storage_buffer)
//                           = 0              for single-channel close array (sma_src_buf)
//   _pad0..2      : u32   — padding to 32 B

struct Params {
    total_len     : u32,
    start_index   : u32,
    visible_count : u32,
    period        : u32,
    close_offset  : u32,
    _pad0         : u32,
    _pad1         : u32,
    _pad2         : u32,
}

@group(0) @binding(0) var<storage, read>       ohlcv : array<f32>;
@group(0) @binding(1) var<storage, read_write> out   : array<f32>;
@group(0) @binding(2) var<uniform>             p     : Params;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) g: vec3<u32>) {
    let i = g.x;
    if i >= p.visible_count { return; }

    // data_idx: position in the source buffer for this output bar.
    // For a proper SMA(N), the source buffer must contain at least
    // (period-1) bars before start_index.  The lookback is computed on CPU.
    let data_idx = p.start_index + i;

    var sum   = 0.0;
    var count = 0u;

    let start_j = max(0i, i32(data_idx) - i32(p.period) + 1i);
    let end_j   = i32(data_idx);

    for (var j = start_j; j <= end_j; j = j + 1i) {
        sum   += ohlcv[p.close_offset + u32(j)];
        count += 1u;
    }

    out[i] = select(0.0, sum / f32(count), count > 0u);
}