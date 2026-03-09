// candles_auto_render.wgsl — instanced candle renderer reading GPU-computed min/max
//
// Optimizations (identical to candles_instanced.wgsl optimizations):
//   - No storage reads in fragment shader  (was: 2×open/close reads per frag)
//   - No position.y → price reconstruction (was: divide + 3 muls per wick frag)
//   - No array LUTs in vertex shader       (was: 2×array<vec2,6> register pressure)
//   - pr_inv precomputed                   (1 division instead of 2 for NDC)
//   - rel_y dual-purpose varying:
//       body verts → uy [0,1]             (top/bottom border detection)
//       wick verts → (y-body_bot)/body_h  (wick suppression, no position.y)
//   - bull/is_wick packed into flags u32   (saves an inter-stage slot)
//
// pmin/pmax are read from `mm` buffer written by minmax_compute.wgsl in the
// same command buffer — no JS mapAsync readback, no CPU round-trip.
//
// Storage layout of `ohlcv`: [open×total_len | high×total_len | low×total_len | close×total_len]
// `mm` layout:               [mm[0]=bitcast<u32>(max_high), mm[1]=bitcast<u32>(min_low)]
//
// Uniforms (96 B):
//   offset  0: pw (f32), cw (f32), total_len (u32), start_index (u32)
//   offset 16: visible_count (u32), ph (f32), border_width (f32), offset_slots (f32)
//   offset 32: bull_color, bear_color, wick_color, border_color  (4×vec4<f32>)

struct Uniforms {
    pw           : f32,
    cw           : f32,
    total_len    : u32,
    start_index  : u32,
    visible_count: u32,
    ph           : f32,
    border_width : f32,
    offset_slots : f32,
    bull_color   : vec4<f32>,
    bear_color   : vec4<f32>,
    wick_color   : vec4<f32>,
    border_color : vec4<f32>,
}

@group(0) @binding(0) var<uniform>       u    : Uniforms;
@group(0) @binding(1) var<storage, read> ohlcv: array<f32>;
@group(0) @binding(2) var<storage, read> mm   : array<u32>;

struct VOut {
    @builtin(position)              position : vec4<f32>,
    // bit 0 = is_wick, bit 1 = bull — packed to save an inter-stage slot
    @location(0) @interpolate(flat) flags    : u32,
    // body height in pixels — flat per-instance constant for T/B border check
    @location(1) @interpolate(flat) bh_px    : f32,
    // body-relative y [0,1]:
    //   body verts → uy            (top/bottom border detection)
    //   wick verts → (y-bot)/bh    (wick suppression without position.y)
    @location(2)                    rel_y    : f32,
    // body-relative x [-0.5, +0.5]; 0.0 for wick (left/right border check)
    @location(3)                    body_xn  : f32,
}

@vertex
fn vs_main(
    @builtin(vertex_index)   vi : u32,
    @builtin(instance_index) ii : u32,
) -> VOut {
    let L        = u.total_len;
    let data_idx = u.start_index + ii;

    // pmin/pmax from GPU-computed minmax buffer (no JS readback)
    let raw_pmax = bitcast<f32>(mm[0]);
    let raw_pmin = bitcast<f32>(mm[1]);
    let raw_pr   = max(raw_pmax - raw_pmin, 1e-6);

    // Apply 5% + min-6px padding — must match JS padding in gpu_renderer.js
    // so candles and SMA overlay lines share the same price→NDC mapping.
    let pad  = max(raw_pr * 0.05, 6.0 / max(u.ph, 1.0) * raw_pr);
    let pmin = raw_pmin - pad;
    let pmax = raw_pmax + pad;
    let pr   = pmax - pmin;
    let pr_inv = 1.0 / pr;                          // 1 div shared across NDC + rel_y

    let o = ohlcv[data_idx];
    let h = ohlcv[L + data_idx];
    let l = ohlcv[L * 2u + data_idx];
    let c = ohlcv[L * 3u + data_idx];

    let px_price = pr / max(u.ph, 1.0);

    // Doji: body height < 1.5px → inflate to 1.5px centred on mid-price
    let is_doji  = abs(c - o) < 1.5 * px_price;
    let mid      = (o + c) * 0.5;
    let body_bot = select(min(o, c), mid - 0.75 * px_price, is_doji);
    let body_top = select(max(o, c), mid + 0.75 * px_price, is_doji);
    let body_h   = body_top - body_bot;

    let bh_px = body_h * pr_inv * u.ph;

    // Quad UVs via bit arithmetic — avoids array<vec2,6> register pressure.
    // Two-triangle CCW quad: 0:(-½,0) 1:(+½,0) 2:(-½,1) 3:(-½,1) 4:(+½,0) 5:(+½,1)
    let j  = vi % 6u;
    let ux = select(-0.5, 0.5, j == 1u || j >= 4u);
    let uy = select(0.0,  1.0, j >= 2u && j != 4u);

    var y_price : f32;
    var x_off   : f32;
    var rel_y   : f32;
    var body_xn : f32;
    var is_wick : u32;

    if vi < 6u {
        // ── Body quad ─────────────────────────────────────────────────────
        y_price = mix(body_bot, body_top, uy);
        x_off   = ux * u.cw;
        rel_y   = uy;
        body_xn = ux;
        is_wick = 0u;
    } else {
        // ── Wick quad ─────────────────────────────────────────────────────
        y_price = mix(l, h, uy);
        x_off   = ux;          // ±0.5 px fixed width
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

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    // Unpack flags — zero storage/buffer reads in this shader stage
    let is_wick    = (in.flags & 1u) != 0u;
    let bull       = (in.flags >> 1u) != 0u;
    let body_color = select(u.bear_color, u.bull_color, bull);

    // ── Wick: suppress inside body y-range via rel_y (no position.y) ─────
    if is_wick {
        if in.rel_y >= 0.0 && in.rel_y <= 1.0 {
            return body_color;
        }
        return u.wick_color;
    }

    // ── Body: 4-sided border (wglchart.js LINE_LOOP equivalent) ──────────
    let bw = u.border_width;
    let cw = u.cw;
    let bh = in.bh_px;

    let on_lr = cw > 2.0 * bw && abs(in.body_xn) * cw >= cw * 0.5 - bw;
    let on_tb = bh > 2.0 * bw && (
        in.rel_y * bh < bw || (1.0 - in.rel_y) * bh < bw
    );

    if on_lr || on_tb {
        return u.border_color;
    }

    return body_color;
}
