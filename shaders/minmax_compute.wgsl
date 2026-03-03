// minmax_compute: GPU-parallel atomic min/max scan over high/low channels
//
// IEEE 754 positive f32 preserves sort order when reinterpreted as u32,
// so atomicMax/atomicMin on bitcast<u32> values gives correct f32 extrema.
//
// Storage layout of `ohlcv`:  [open×len | high×len | low×len | close×len]
// Output layout of `mm`:      [mm[0] = atomicMax(high), mm[1] = atomicMin(low)]
//
// Caller must pre-initialise mm before dispatch:
//   mm[0] = bitcast<u32>(0.0)           (identity for atomicMax)
//   mm[1] = bitcast<u32>(f32::MAX)      (identity for atomicMin)
//
// Params (16 B uniform):
//   offset 0: len (u32) — number of bars in the view window

// No subgroups extension — use per-thread atomics directly.
// Each thread reads its own bar and atomicMax/atomicMin into the shared mm[].
// This is slightly more atomic contention than subgroup reduction but fully
// portable across all WebGPU implementations.

struct Params {
    total_len     : u32,
    start_index   : u32,
    visible_count : u32,
    _pad          : u32,
}

@group(0) @binding(0) var<storage, read>       ohlcv : array<f32>;
@group(0) @binding(1) var<storage, read_write> mm    : array<atomic<u32>>;
@group(0) @binding(2) var<uniform>             p     : Params;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) g: vec3<u32>) {
    let i = g.x;
    if i >= p.visible_count { return; }

    let data_idx = p.start_index + i;
    let high_val = ohlcv[p.total_len + data_idx];
    let low_val  = ohlcv[p.total_len * 2u + data_idx];

    // IEEE 754 positive f32 sort order is preserved as u32 → atomic compare works.
    atomicMax(&mm[0], bitcast<u32>(high_val));
    atomicMin(&mm[1], bitcast<u32>(low_val));
}
