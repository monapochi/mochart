// WGSL Bit-Unpack Prototype
// Stage 1 only: unpack zigzag-encoded single-delta words into an i32 delta lane.
// The block base value and prefix-sum reconstruction run in later passes.

struct UnpackConfig {
    count: u32,
    bit_width: u32,
    base_value: i32,
    tick_size: f32,
    base_price: f32,
};

@group(0) @binding(0) var<uniform> config: UnpackConfig;
@group(0) @binding(1) var<storage, read> packed_data: array<u32>;
@group(0) @binding(2) var<storage, read_write> delta_out: array<i32>;

fn zigzag_decode_u32(value: u32) -> i32 {
    let shifted = i32(value >> 1u);
    let sign = -i32(value & 1u);
    return shifted ^ sign;
}

@compute @workgroup_size(256)
fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;

    if (idx >= config.count) {
        return;
    }

    // Delta lane stores N-1 entries for a block. The first absolute value lives in
    // block metadata (`base_value`) and is injected by the prefix-sum pass.
    if (config.bit_width == 0u) {
        delta_out[idx] = 0i;
        return;
    }

    let bit_start = idx * config.bit_width;
    let word_idx = bit_start / 32u;
    let shift = bit_start % 32u;

    var encoded = packed_data[word_idx] >> shift;
    let bits_in_first_word = 32u - shift;

    if (config.bit_width > bits_in_first_word) {
        let next_word = packed_data[word_idx + 1u];
        encoded = encoded | (next_word << bits_in_first_word);
    }

    let mask = select((1u << config.bit_width) - 1u, 0xffffffffu, config.bit_width == 32u);
    encoded = encoded & mask;

    delta_out[idx] = zigzag_decode_u32(encoded);
}