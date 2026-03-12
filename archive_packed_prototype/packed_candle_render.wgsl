// packed_candle_render.wgsl — packed-direct instanced candle renderer
//
// Reads OHLC directly from packed blocks (FOR/base + single-delta + zigzag +
// fixed-width bit-pack) without requiring storageBuf.  Each vertex invocation
// decodes its bar's OHLC via inline prefix-sum over the packed delta stream.
//
// This is a *prototype* for evaluating storageBuf elimination ROI.
// Tradeoff: eliminates CPU→GPU writeBuffer × 5ch, but incurs O(local_idx)
// decode work per vertex in the GPU pipeline.
//
// Bindings:
//   @binding(0) uniform  Uniforms       — candle layout + packed decode params
//   @binding(1) storage  metas[]        — per-block channel metadata
//   @binding(2) storage  packed_data[]  — packed bitstream payload
//   @binding(3) storage  mm[]           — GPU-computed minmax [atomicMax(high), atomicMin(low)]
//
// Data flow:
//   instance_index → (block_idx, local_idx) → prefix-sum(delta[0..local_idx-1])
//   → absolute i32 → f32 via (price_scale, price_offset) → NDC candle geometry

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

struct Uniforms {
    pw              : f32,
    cw              : f32,
    block_count     : u32,
    first_bar_offset: u32,

    visible_count   : u32,
    ph              : f32,
    border_width    : f32,
    offset_slots    : f32,

    bull_color      : vec4<f32>,
    bear_color      : vec4<f32>,
    wick_color      : vec4<f32>,
    border_color    : vec4<f32>,

    price_scale     : f32,
    price_offset    : f32,
    _pad0           : f32,
    _pad1           : f32,
}

@group(0) @binding(0) var<uniform>       u           : Uniforms;
@group(0) @binding(1) var<storage, read> metas       : array<BlockMeta>;
@group(0) @binding(2) var<storage, read> packed_data : array<u32>;
@group(0) @binding(3) var<storage, read> mm          : array<u32>;

const BLOCK_SIZE: u32 = 1024u;

// ── Bit extraction (identical to packed_minmax_compute.wgsl) ──────────────

fn zigzag_decode_u32(value: u32) -> i32 {
    let shifted = i32(value >> 1u);
    let sign    = -i32(value & 1u);
    return shifted ^ sign;
}

fn extract_bits(bit_start: u32, bit_width: u32) -> u32 {
    if (bit_width == 0u) { return 0u; }
    let word_idx         = bit_start / 32u;
    let shift            = bit_start % 32u;
    var encoded          = packed_data[word_idx] >> shift;
    let bits_in_first    = 32u - shift;
    if (bit_width > bits_in_first) {
        encoded = encoded | (packed_data[word_idx + 1u] << bits_in_first);
    }
    let mask = select((1u << bit_width) - 1u, 0xffffffffu, bit_width == 32u);
    return encoded & mask;
}

// ── Per-bar channel decode via sequential prefix-sum ──────────────────────
// O(local_idx) per channel.  Worst-case 1023 extract_bits per call.

fn decode_channel(block_idx: u32, local_idx: u32, ch: u32) -> f32 {
    let bm       = metas[block_idx];
    let cm       = bm.channels[ch];
    var acc      = cm.base_value;
    let bw       = cm.bit_width;
    if (bw > 0u && local_idx > 0u) {
        let bit_base = bm.payload_word_offset * 32u + cm.payload_bit_offset;
        for (var i = 0u; i < local_idx; i = i + 1u) {
            acc = acc + zigzag_decode_u32(extract_bits(bit_base + i * bw, bw));
        }
    }
    return f32(acc) * u.price_scale + u.price_offset;
}

// ── Vertex output ──────────────────────────────────────────────────────────

struct VOut {
    @builtin(position)              position : vec4<f32>,
    @location(0) @interpolate(flat) flags    : u32,
    @location(1) @interpolate(flat) bh_px    : f32,
    @location(2)                    rel_y    : f32,
    @location(3)                    body_xn  : f32,
}

// ── Vertex shader ──────────────────────────────────────────────────────────

@vertex
fn vs_main(
    @builtin(vertex_index)   vi : u32,
    @builtin(instance_index) ii : u32,
) -> VOut {
    // ── Map instance → (block, local) ─────────────────────────────────────
    let global_idx = u.first_bar_offset + ii;
    let block_idx  = global_idx / BLOCK_SIZE;
    let local_idx  = global_idx % BLOCK_SIZE;

    // ── Decode OHLC from packed blocks ────────────────────────────────────
    let o = decode_channel(block_idx, local_idx, 0u);
    let h = decode_channel(block_idx, local_idx, 1u);
    let l = decode_channel(block_idx, local_idx, 2u);
    let c = decode_channel(block_idx, local_idx, 3u);

    // ── Price range from GPU minmax buffer ────────────────────────────────
    let raw_pmax = bitcast<f32>(mm[0]);
    let raw_pmin = bitcast<f32>(mm[1]);
    let raw_pr   = max(raw_pmax - raw_pmin, 1e-6);
    let pad      = max(raw_pr * 0.05, 6.0 / max(u.ph, 1.0) * raw_pr);
    let pmin     = raw_pmin - pad;
    let pmax     = raw_pmax + pad;
    let pr       = pmax - pmin;
    let pr_inv   = 1.0 / pr;

    let px_price = pr / max(u.ph, 1.0);

    // Doji: body < 1.5px → inflate to 1.5px centred on mid
    let is_doji  = abs(c - o) < 1.5 * px_price;
    let mid      = (o + c) * 0.5;
    let body_bot = select(min(o, c), mid - 0.75 * px_price, is_doji);
    let body_top = select(max(o, c), mid + 0.75 * px_price, is_doji);
    let body_h   = body_top - body_bot;
    let bh_px    = body_h * pr_inv * u.ph;

    // Quad UV via bit arithmetic (avoids array<vec2,6> register pressure)
    let j  = vi % 6u;
    let ux = select(-0.5, 0.5, j == 1u || j >= 4u);
    let uy = select(0.0,  1.0, j >= 2u && j != 4u);

    var y_price : f32;
    var x_off   : f32;
    var rel_y   : f32;
    var body_xn : f32;
    var is_wick : u32;

    if vi < 6u {
        // Body quad
        y_price = mix(body_bot, body_top, uy);
        x_off   = ux * u.cw;
        rel_y   = uy;
        body_xn = ux;
        is_wick = 0u;
    } else {
        // Wick quad
        y_price = mix(l, h, uy);
        x_off   = ux;
        rel_y   = (y_price - body_bot) / body_h;
        body_xn = 0.0;
        is_wick = 1u;
    }

    let bull  = u32(c >= o);
    let flags = is_wick | (bull << 1u);

    let y  = (y_price - pmin) * pr_inv * 2.0 - 1.0;

    let logical_len = max(f32(u.visible_count), 1.0);
    let cx = (f32(ii) + 0.5 - u.offset_slots) * (u.pw / logical_len);
    let x  = (cx + x_off) / u.pw * 2.0 - 1.0;

    var out : VOut;
    out.position = vec4<f32>(x, y, 0.0, 1.0);
    out.flags    = flags;
    out.bh_px    = bh_px;
    out.rel_y    = rel_y;
    out.body_xn  = body_xn;
    return out;
}

// ── Fragment shader (identical to candles_auto_render.wgsl) ───────────────

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    let is_wick    = (in.flags & 1u) != 0u;
    let bull       = (in.flags >> 1u) != 0u;
    let body_color = select(u.bear_color, u.bull_color, bull);

    if is_wick {
        if in.rel_y >= 0.0 && in.rel_y <= 1.0 {
            return body_color;
        }
        return u.wick_color;
    }

    let bw   = u.border_width;
    let cw   = u.cw;
    let bh   = in.bh_px;
    let on_lr = cw > 2.0 * bw && abs(in.body_xn) * cw >= cw * 0.5 - bw;
    let on_tb = bh > 2.0 * bw && (
        in.rel_y * bh < bw || (1.0 - in.rel_y) * bh < bw
    );

    if on_lr || on_tb {
        return u.border_color;
    }

    return body_color;
}
