struct ChannelMeta {
    base_value: i32,
    bit_width: u32,
    payload_bit_offset: u32,
    _pad: u32,
}

struct BlockMeta {
    bar_count: u32,
    payload_word_offset: u32,
    payload_word_len: u32,
    _pad: u32,
    channels: array<ChannelMeta, 5>,
}

struct Params {
    block_count: u32,
    first_bar_offset: u32,
    visible_count: u32,
    _pad0: u32,
    price_scale: f32,
    price_offset: f32,
    _pad1: f32,
    _pad2: f32,
}

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> metas: array<BlockMeta>;
@group(0) @binding(2) var<storage, read> packed_data: array<u32>;
@group(0) @binding(3) var<storage, read_write> mm: array<atomic<u32>>;

var<workgroup> high_values: array<i32, 1024>;
var<workgroup> low_values: array<i32, 1024>;
var<workgroup> visible_base: u32;
var<workgroup> visible_start: u32;

fn zigzag_decode_u32(value: u32) -> i32 {
    let shifted = i32(value >> 1u);
    let sign = -i32(value & 1u);
    return shifted ^ sign;
}

fn extract_bits(bit_start: u32, bit_width: u32) -> u32 {
    if (bit_width == 0u) {
        return 0u;
    }

    let word_idx = bit_start / 32u;
    let shift = bit_start % 32u;
    var encoded = packed_data[word_idx] >> shift;
    let bits_in_first_word = 32u - shift;

    if (bit_width > bits_in_first_word) {
        encoded = encoded | (packed_data[word_idx + 1u] << bits_in_first_word);
    }

    let mask = select((1u << bit_width) - 1u, 0xffffffffu, bit_width == 32u);
    return encoded & mask;
}

@compute @workgroup_size(256)
fn cs(
    @builtin(workgroup_id) workgroup_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
) {
    let block_idx = workgroup_id.x;
    if (block_idx >= p.block_count) {
        return;
    }

    let lane = local_id.x;
    let block_meta = metas[block_idx];
    let bar_count = block_meta.bar_count;
    if (bar_count == 0u) {
        return;
    }

    if (lane == 0u) {
        visible_start = select(0u, p.first_bar_offset, block_idx == 0u);
        var base = 0u;
        if (block_idx > 0u) {
            base = metas[0].bar_count - p.first_bar_offset;
            var idx = 1u;
            loop {
                if (idx >= block_idx) {
                    break;
                }
                base = base + metas[idx].bar_count;
                idx = idx + 1u;
            }
        }
        visible_base = base;
    }
    workgroupBarrier();

    let high_meta = block_meta.channels[1];
    let low_meta = block_meta.channels[2];
    let block_payload_bit_base = block_meta.payload_word_offset * 32u;

    var idx = lane;
    loop {
        if (idx >= bar_count) {
            break;
        }
        if (idx == 0u) {
            high_values[0] = high_meta.base_value;
            low_values[0] = low_meta.base_value;
        } else {
            let delta_idx = idx - 1u;
            let high_word = extract_bits(
                block_payload_bit_base + high_meta.payload_bit_offset + delta_idx * high_meta.bit_width,
                high_meta.bit_width,
            );
            let low_word = extract_bits(
                block_payload_bit_base + low_meta.payload_bit_offset + delta_idx * low_meta.bit_width,
                low_meta.bit_width,
            );
            high_values[idx] = zigzag_decode_u32(high_word);
            low_values[idx] = zigzag_decode_u32(low_word);
        }
        idx = idx + 256u;
    }
    workgroupBarrier();

    var stride = 1u;
    loop {
        if (stride >= bar_count) {
            break;
        }

        idx = lane;
        loop {
            if (idx >= bar_count) {
                break;
            }
            if (idx >= stride) {
                high_values[idx] = high_values[idx] + high_values[idx - stride];
                low_values[idx] = low_values[idx] + low_values[idx - stride];
            }
            idx = idx + 256u;
        }
        workgroupBarrier();
        stride = stride * 2u;
    }

    idx = lane;
    loop {
        if (idx >= bar_count) {
            break;
        }
        if (idx >= visible_start) {
            let vis_idx = visible_base + (idx - visible_start);
            if (vis_idx < p.visible_count) {
                let high_price = f32(high_values[idx]) * p.price_scale + p.price_offset;
                let low_price = f32(low_values[idx]) * p.price_scale + p.price_offset;
                atomicMax(&mm[0], bitcast<u32>(high_price));
                atomicMin(&mm[1], bitcast<u32>(low_price));
            }
        }
        idx = idx + 256u;
    }
}