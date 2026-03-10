var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// crates/mochart-wasm-new/src/demo/shared_protocol.js
var STRIDE = 16;
var WAKE = 0;
var READY = 1;
var START_BAR = 2;
var VIS_BARS = 3;
var PLOT_W = 4;
var PLOT_H = 5;
var POINTER_X = 6;
var POINTER_Y = 7;
var FLAGS = 8;
var DIRTY = 9;
var SUBPIXEL_PAN_X = 10;
var RIGHT_MARGIN_BARS = 11;
var GPU_DIRTY = 1;
var HUD_DIRTY = 2;
var _cvt = new DataView(new ArrayBuffer(4));
function i32ToF32(i) {
  _cvt.setInt32(0, i, true);
  return _cvt.getFloat32(0, true);
}
var FRAME_MAX_BARS = 4096;
var FBUF_START_BAR = 0;
var FBUF_VIS_BARS = 4;
var FBUF_VIEW_LEN = 8;
var FBUF_FLAGS = 12;
var FBUF_SEQ = 36;
var FBUF_TOTAL_BARS = 40;
var FBUF_PRICE_MIN = 48;
var FBUF_PRICE_MAX = 52;
var FBUF_CANVAS_W = 56;
var FBUF_CANVAS_H = 60;
var FBUF_CANDLE_W = 64;
var FBUF_FRAME_START_BAR = 88;
var FBUF_HDR_BYTES = 128;
var _FBUF_F32_STRIDE = FRAME_MAX_BARS * 4;
var FBUF_OPEN_OFF = FBUF_HDR_BYTES + 0 * _FBUF_F32_STRIDE;
var FBUF_HIGH_OFF = FBUF_HDR_BYTES + 1 * _FBUF_F32_STRIDE;
var FBUF_LOW_OFF = FBUF_HDR_BYTES + 2 * _FBUF_F32_STRIDE;
var FBUF_CLOSE_OFF = FBUF_HDR_BYTES + 3 * _FBUF_F32_STRIDE;
var FBUF_VOL_OFF = FBUF_HDR_BYTES + 4 * _FBUF_F32_STRIDE;
var FBUF_SMA20_OFF = FBUF_HDR_BYTES + 5 * _FBUF_F32_STRIDE;
var FBUF_SMA50_OFF = FBUF_HDR_BYTES + 6 * _FBUF_F32_STRIDE;
var FBUF_SMA100_OFF = FBUF_HDR_BYTES + 7 * _FBUF_F32_STRIDE;
var FBUF_TIME_OFF = FBUF_HDR_BYTES + 5 * _FBUF_F32_STRIDE;
var _FRAME_TIME_BYTES = FRAME_MAX_BARS * 8;
var FRAME_BUF_BYTES = FBUF_TIME_OFF + _FRAME_TIME_BYTES;
var FCTRL_READY = 0;
var FCTRL_ACK = 1;
var INDSAB_SEQ_OFF = 0;
var INDSAB_ARENA_LEN = 4;
var INDSAB_CMD_COUNT = 8;
var INDSAB_REVISION = 12;
var INDSAB_OVERLAY_STD430_OFF = 3072;
var INDSAB_OVERLAY_STD430_WORDS = 8;
var INDSAB_OVERLAY_REV_OFF = INDSAB_OVERLAY_STD430_OFF + INDSAB_OVERLAY_STD430_WORDS * 4;
var MAX_RENDER_CMDS = 32;
var MAX_ARENA_F32 = FRAME_MAX_BARS * MAX_RENDER_CMDS;
var INDSAB_HDR_BYTES = 4096;
var INDSAB_CMD_BASE = 16;
var INDSAB_CMD_STRIDE = 64;
var INDSAB_CMD_SLOT_ID = 0;
var INDSAB_CMD_ARENA_OFFSET = 4;
var INDSAB_CMD_BAR_COUNT = 8;
var INDSAB_CMD_WARMUP = 12;
var INDSAB_CMD_COLOR_R = 16;
var INDSAB_CMD_COLOR_G = 20;
var INDSAB_CMD_COLOR_B = 24;
var INDSAB_CMD_COLOR_A = 28;
var INDSAB_CMD_STYLE = 32;
var INDSAB_CMD_PANE = 36;
var INDSAB_CMD_BAND_ALT_OFF = 40;
var INDSAB_CMD_LINE_WIDTH = 44;
var INDSAB_CMD_FLAG_MASK = 48;
var INDSAB_CMD_VALUE_MIN = 52;
var INDSAB_CMD_VALUE_MAX = 56;
var INDSAB_ARENA_OFF = INDSAB_HDR_BYTES;
var INDSAB_BYTES = INDSAB_ARENA_OFF + MAX_ARENA_F32 * 4;

// crates/mochart-wasm-new/src/demo/generated_shaders.js
var MINMAX_COMPUTE_WGSL = `struct Params {
total_len : u32,
start_index : u32,
visible_count : u32,
_pad : u32,
}
@group(0) @binding(0) var<storage, read> ohlcv : array<f32>;
@group(0) @binding(1) var<storage, read_write> mm : array<atomic<u32>>;
@group(0) @binding(2) var<uniform> p : Params;
@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) g: vec3<u32>) {
let i = g.x;
if i >= p.visible_count { return; }
let data_idx = p.start_index + i;
let high_val = ohlcv[p.total_len + data_idx];
let low_val = ohlcv[p.total_len * 2u + data_idx];
atomicMax(&mm[0], bitcast<u32>(high_val));
atomicMin(&mm[1], bitcast<u32>(low_val));
}`;
var CANDLES_AUTO_RENDER_WGSL = `struct Uniforms {
pw : f32,
cw : f32,
total_len : u32,
start_index : u32,
visible_count: u32,
ph : f32,
border_width : f32,
offset_slots : f32,
bull_color : vec4<f32>,
bear_color : vec4<f32>,
wick_color : vec4<f32>,
border_color : vec4<f32>,
}
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> ohlcv: array<f32>;
@group(0) @binding(2) var<storage, read> mm : array<u32>;
struct VOut {
@builtin(position) position : vec4<f32>,
@location(0) @interpolate(flat) flags : u32,
@location(1) @interpolate(flat) bh_px : f32,
@location(2) rel_y : f32,
@location(3) body_xn : f32,
}
@vertex
fn vs_main(
@builtin(vertex_index) vi : u32,
@builtin(instance_index) ii : u32,
) -> VOut {
let L = u.total_len;
let data_idx = u.start_index + ii;
let raw_pmax = bitcast<f32>(mm[0]);
let raw_pmin = bitcast<f32>(mm[1]);
let raw_pr = max(raw_pmax - raw_pmin, 1e-6);
let pad = max(raw_pr * 0.05, 6.0 / max(u.ph, 1.0) * raw_pr);
let pmin = raw_pmin - pad;
let pmax = raw_pmax + pad;
let pr = pmax - pmin;
let pr_inv = 1.0 / pr;
let o = ohlcv[data_idx];
let h = ohlcv[L + data_idx];
let l = ohlcv[L * 2u + data_idx];
let c = ohlcv[L * 3u + data_idx];
let px_price = pr / max(u.ph, 1.0);
let is_doji = abs(c - o) < 1.5 * px_price;
let mid = (o + c) * 0.5;
let body_bot = select(min(o, c), mid - 0.75 * px_price, is_doji);
let body_top = select(max(o, c), mid + 0.75 * px_price, is_doji);
let body_h = body_top - body_bot;
let bh_px = body_h * pr_inv * u.ph;
let j = vi % 6u;
let ux = select(-0.5, 0.5, j == 1u || j >= 4u);
let uy = select(0.0, 1.0, j >= 2u && j != 4u);
var y_price : f32;
var x_off : f32;
var rel_y : f32;
var body_xn : f32;
var is_wick : u32;
if vi < 6u {
y_price = mix(body_bot, body_top, uy);
x_off = ux * u.cw;
rel_y = uy;
body_xn = ux;
is_wick = 0u;
} else {
y_price = mix(l, h, uy);
x_off = ux;
rel_y = (y_price - body_bot) / body_h;
body_xn = 0.0;
is_wick = 1u;
}
let bull = u32(c >= o);
let flags = is_wick | (bull << 1u);
let y = (y_price - pmin) * pr_inv * 2.0 - 1.0;
let logical_len = max(f32(u.visible_count), 1.0);
let cx = (f32(ii) + 0.5 - u.offset_slots) * (u.pw / logical_len);
let x = (cx + x_off) / u.pw * 2.0 - 1.0;
var out : VOut;
out.position = vec4<f32>(x, y, 0.0, 1.0);
out.flags = flags;
out.bh_px = bh_px;
out.rel_y = rel_y;
out.body_xn = body_xn;
return out;
}
@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
let is_wick = (in.flags & 1u) != 0u;
let bull = (in.flags >> 1u) != 0u;
let body_color = select(u.bear_color, u.bull_color, bull);
if is_wick {
if in.rel_y >= 0.0 && in.rel_y <= 1.0 {
return body_color;
}
return u.wick_color;
}
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
}`;
var LINE_THICK_WGSL = `struct Uniforms {
plot_w : f32,
plot_h : f32,
candle_w : f32,
price_min : f32,
price_max : f32,
line_width_px : f32,
_pad0 : u32,
_pad1 : u32,
color : vec4<f32>,
bar_count : u32,
nan_start : u32,
slots : u32,
offset_slots : f32,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> values: array<f32>;
struct VOut {
@builtin(position) pos : vec4<f32>,
@location(0) alpha : f32,
@location(1) dist_px : f32,
}
const ENDPOINT = array<u32, 6>(0u, 0u, 1u, 1u, 0u, 1u);
const SIGN = array<f32, 6>(1.0, -1.0, 1.0, 1.0, -1.0, -1.0);
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
var out: VOut;
let seg_idx = vi / 6u;
let corn = vi % 6u;
let i0 = seg_idx;
let i1 = seg_idx + 1u;
if i0 < u.nan_start {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.alpha = 0.0;
return out;
}
let price_range = max(u.price_max - u.price_min, 1e-6);
let slots = u.slots;
let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
let slot_w = u.plot_w / logical_len;
let x0_px = (f32(i0) + 0.5 - u.offset_slots) * slot_w;
let x1_px = (f32(i1) + 0.5 - u.offset_slots) * slot_w;
let v0 = values[i0];
let v1 = values[i1];
let y0_px = (1.0 - (v0 - u.price_min) / price_range) * u.plot_h;
let y1_px = (1.0 - (v1 - u.price_min) / price_range) * u.plot_h;
let dx = x1_px - x0_px;
let dy = y1_px - y0_px;
let len_sq = dx * dx + dy * dy;
let inv_len = select(0.0, inverseSqrt(len_sq), len_sq > 1e-12);
let hw = u.line_width_px * 0.5;
let hw_ext = hw + 0.5;
let perp_x = -dy * inv_len * hw_ext;
let perp_y = dx * inv_len * hw_ext;
let use_p1 = ENDPOINT[corn];
let sgn = SIGN[corn];
let base_x = select(x0_px, x1_px, use_p1 == 1u);
let base_y = select(y0_px, y1_px, use_p1 == 1u);
let px = base_x + perp_x * sgn;
let py = base_y + perp_y * sgn;
let x_ndc = px / u.plot_w * 2.0 - 1.0;
let y_ndc = 1.0 - py / u.plot_h * 2.0;
out.pos = vec4<f32>(x_ndc, y_ndc, 0.0, 1.0);
out.alpha = 1.0;
out.dist_px = SIGN[corn] * hw_ext;
return out;
}
@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
let hw = u.line_width_px * 0.5;
let coverage = 1.0 - smoothstep(hw - 0.5, hw + 0.5, abs(in.dist_px));
let a = u.color.a * coverage;
return vec4<f32>(u.color.rgb * a, a);
}`;
var SMA_COMPUTE_WGSL = `struct Params {
total_len : u32,
start_index : u32,
visible_count : u32,
period : u32,
close_offset : u32,
_pad0 : u32,
_pad1 : u32,
_pad2 : u32,
}
@group(0) @binding(0) var<storage, read> ohlcv : array<f32>;
@group(0) @binding(1) var<storage, read_write> out : array<f32>;
@group(0) @binding(2) var<uniform> p : Params;
@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) g: vec3<u32>) {
let i = g.x;
if i >= p.visible_count { return; }
let data_idx = p.start_index + i;
var sum = 0.0;
var count = 0u;
let start_j = max(0i, i32(data_idx) - i32(p.period) + 1i);
let end_j = i32(data_idx);
for (var j = start_j; j <= end_j; j = j + 1i) {
sum += ohlcv[p.close_offset + u32(j)];
count += 1u;
}
out[i] = select(0.0, sum / f32(count), count > 0u);
}`;
var VOLUME_PROFILE_WGSL = `@group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
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
let close_offset = params.total_len * 3u;
let vol_offset = params.total_len * 4u;
let close = ohlcv[close_offset + data_idx];
let vol = ohlcv[vol_offset + data_idx];
if (close < params.price_min || close > params.price_max) {
return;
}
let price_range = params.price_max - params.price_min;
let normalized = (close - params.price_min) / price_range;
var bin_idx = u32(normalized * f32(params.num_bins));
if (bin_idx >= params.num_bins) {
bin_idx = params.num_bins - 1u;
}
let vol_u32 = u32(vol);
atomicAdd(&profile_bins[bin_idx], vol_u32);
atomicMax(&profile_bins[params.num_bins], vol_u32);
}`;
var VP_RENDER_WGSL = `struct Uniforms {
plot_w: f32,
plot_h: f32,
num_bins: u32,
_pad0: u32,
panel_x: f32,
panel_w: f32,
r: f32,
g: f32,
b: f32,
a: f32,
_pad1: u32,
_pad2: u32,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> vp_bins: array<u32>;
struct VertexOut {
@builtin(position) pos: vec4<f32>,
@location(0) alpha: f32,
}
@vertex
fn vs_main(
@builtin(vertex_index) vi: u32,
@builtin(instance_index) ii: u32,
) -> VertexOut {
let bin_idx = ii;
let count = vp_bins[bin_idx];
let max_count = vp_bins[u.num_bins];
let norm = select(0.0, f32(count) / f32(max_count), max_count > 0u);
let bar_h = u.plot_h / f32(u.num_bins);
let y_bot = u.plot_h - f32(bin_idx) * bar_h;
let y_top = u.plot_h - f32(bin_idx + 1u) * bar_h;
let bar_right = u.panel_x + u.panel_w;
let bar_left = u.panel_x + u.panel_w * (1.0 - norm);
var px: f32;
var py: f32;
switch (vi) {
case 0u: { px = bar_left; py = y_top; }
case 1u: { px = bar_right; py = y_top; }
case 2u: { px = bar_left; py = y_bot; }
case 3u: { px = bar_right; py = y_top; }
case 4u: { px = bar_right; py = y_bot; }
case 5u: { px = bar_left; py = y_bot; }
default: { px = 0.0; py = 0.0; }
}
let ndc_x = (px / u.plot_w) * 2.0 - 1.0;
let ndc_y = (py / u.plot_h) * -2.0 + 1.0;
var out: VertexOut;
out.pos = vec4<f32>(ndc_x, ndc_y, 0.0, 1.0);
out.alpha = norm;
return out;
}
@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
let aa = u.a * in.alpha;
return vec4<f32>(u.r * aa, u.g * aa, u.b * aa, aa);
}`;
var INDICATOR_RENDER_WGSL = `struct Uniforms {
plot_w : f32,
plot_h : f32,
candle_w : f32,
price_min : f32,
price_max : f32,
line_width_px : f32,
arena_offset : u32,
warmup_bars : u32,
color : vec4<f32>,
bar_count : u32,
slots : u32,
_pad1 : u32,
offset_slots : f32,
}
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(1) @binding(0) var<storage, read> arena : array<f32>;
struct VOut {
@builtin(position) pos : vec4<f32>,
@location(0) alpha : f32,
@location(1) dist_px : f32,
}
const ENDPOINT = array<u32, 6>(0u, 0u, 1u, 1u, 0u, 1u);
const SIGN = array<f32, 6>(1.0, -1.0, 1.0, 1.0, -1.0, -1.0);
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
var out: VOut;
let seg_idx = vi / 6u;
let corn = vi % 6u;
let bar0 = seg_idx + u.warmup_bars;
let bar1 = bar0 + 1u;
if bar1 >= u.bar_count {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.alpha = 0.0;
return out;
}
let v0 = arena[u.arena_offset + bar0];
let v1 = arena[u.arena_offset + bar1];
if !( v0 == v0 && v1 == v1 ) {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.alpha = 0.0;
return out;
}
let price_range = max(u.price_max - u.price_min, 1e-6);
let slots = u.slots;
let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
let slot_w = u.plot_w / logical_len;
let x0_px = (f32(bar0) + 0.5 - u.offset_slots) * slot_w;
let x1_px = (f32(bar1) + 0.5 - u.offset_slots) * slot_w;
let y0_px = (1.0 - (v0 - u.price_min) / price_range) * u.plot_h;
let y1_px = (1.0 - (v1 - u.price_min) / price_range) * u.plot_h;
let dx = x1_px - x0_px;
let dy = y1_px - y0_px;
let len_sq = dx * dx + dy * dy;
let inv_len = select(0.0, inverseSqrt(len_sq), len_sq > 1e-12);
let hw = u.line_width_px * 0.5;
let hw_ext = hw + 0.5;
let perp_x = -dy * inv_len * hw_ext;
let perp_y = dx * inv_len * hw_ext;
let use_p1 = ENDPOINT[corn];
let sgn = SIGN[corn];
let base_x = select(x0_px, x1_px, use_p1 == 1u);
let base_y = select(y0_px, y1_px, use_p1 == 1u);
let px = base_x + perp_x * sgn;
let py = base_y + perp_y * sgn;
out.pos = vec4<f32>(px / u.plot_w * 2.0 - 1.0, 1.0 - py / u.plot_h * 2.0, 0.0, 1.0);
out.alpha = 1.0;
out.dist_px = SIGN[corn] * hw_ext;
return out;
}
@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
let hw = u.line_width_px * 0.5;
let coverage = 1.0 - smoothstep(hw - 0.5, hw + 0.5, abs(in.dist_px));
let a = u.color.a * in.alpha * coverage;
return vec4<f32>(u.color.rgb * a, a);
}`;
var INDICATOR_HISTOGRAM_WGSL = `struct Uniforms {
plot_w : f32,
plot_h : f32,
candle_w : f32,
value_min : f32,
value_max : f32,
zero_level : f32,
arena_offset : u32,
warmup_bars : u32,
pos_color : vec4<f32>,
neg_color : vec4<f32>,
bar_count : u32,
bar_gap : f32,
slots : u32,
offset_slots : f32,
}
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(1) @binding(0) var<storage, read> arena : array<f32>;
struct VOut {
@builtin(position) pos : vec4<f32>,
@location(0) color : vec4<f32>,
}
const UV_COL = array<u32, 6>(0u, 1u, 1u, 0u, 1u, 0u);
const UV_ROW = array<u32, 6>(0u, 0u, 1u, 0u, 1u, 1u);
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
var out: VOut;
let bar_idx = vi / 6u + u.warmup_bars;
if bar_idx >= u.bar_count {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.color = vec4<f32>(0.0);
return out;
}
let val = arena[u.arena_offset + bar_idx];
if !(val == val) {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.color = vec4<f32>(0.0);
return out;
}
let value_range = max(u.value_max - u.value_min, 1e-6);
let slots = u.slots;
let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
let slot_w = u.plot_w / logical_len;
let gap_px = slot_w * u.bar_gap;
let bar_w = max(slot_w - gap_px, 1.0);
let x_left = (f32(bar_idx) - u.offset_slots) * slot_w + gap_px * 0.5;
let x_right = x_left + bar_w;
let y_zero = (1.0 - (u.zero_level - u.value_min) / value_range) * u.plot_h;
let y_val = (1.0 - (val - u.value_min) / value_range) * u.plot_h;
let y_top = min(y_zero, y_val);
let y_bottom = max(y_zero, y_val);
let col = UV_COL[vi % 6u];
let row = UV_ROW[vi % 6u];
let px = select(x_left, x_right, col == 1u);
let py = select(y_top, y_bottom, row == 1u);
out.pos = vec4<f32>(px / u.plot_w * 2.0 - 1.0, 1.0 - py / u.plot_h * 2.0, 0.0, 1.0);
out.color = select(u.neg_color, u.pos_color, val >= u.zero_level);
return out;
}
@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
let a = in.color.a;
return vec4<f32>(in.color.rgb * a, a);
}`;
var INDICATOR_BAND_WGSL = `struct Uniforms {
plot_w : f32,
plot_h : f32,
candle_w : f32,
price_min : f32,
price_max : f32,
arena_offset_upper : u32,
arena_offset_lower : u32,
warmup_bars : u32,
fill_color : vec4<f32>,
bar_count : u32,
slots : u32,
_pad1 : u32,
offset_slots : f32,
}
@group(0) @binding(0) var<uniform> u : Uniforms;
@group(1) @binding(0) var<storage, read> arena : array<f32>;
struct VOut {
@builtin(position) pos : vec4<f32>,
@location(0) color : vec4<f32>,
}
const BAR_SEL = array<u32, 6>(0u, 1u, 1u, 0u, 1u, 0u);
const BAND_SEL = array<u32, 6>(0u, 0u, 1u, 0u, 1u, 1u);
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
var out: VOut;
let seg_idx = vi / 6u;
let bar_i = seg_idx + u.warmup_bars;
let bar_j = bar_i + 1u;
if bar_j >= u.bar_count {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.color = vec4<f32>(0.0);
return out;
}
let v_idx = vi % 6u;
let bar = select(bar_i, bar_j, BAR_SEL[v_idx] == 1u);
let is_lower = BAND_SEL[v_idx] == 1u;
var val: f32;
if is_lower {
val = arena[u.arena_offset_lower + bar];
} else {
val = arena[u.arena_offset_upper + bar];
}
if !(val == val) {
out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0);
out.color = vec4<f32>(0.0);
return out;
}
let price_range = max(u.price_max - u.price_min, 1e-6);
let slots = u.slots;
let logical_len = select(f32(u.bar_count), f32(slots), slots > 0u);
let slot_w = u.plot_w / logical_len;
let x = (f32(bar) + 0.5 - u.offset_slots) * slot_w;
let y = (1.0 - (val - u.price_min) / price_range) * u.plot_h;
out.pos = vec4<f32>(x / u.plot_w * 2.0 - 1.0, 1.0 - y / u.plot_h * 2.0, 0.0, 1.0);
out.color = u.fill_color;
return out;
}
@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
let a = in.color.a;
return vec4<f32>(in.color.rgb * a, a);
}`;

// crates/mochart-wasm-new/src/demo/gpu_renderer.js
var STYLE_HISTOGRAM = 2;
var STYLE_BAND = 3;

class GpuRenderer {
  device = null;
  context = null;
  format = "";
  minmaxPipeline = null;
  candlePipeline = null;
  linePipeline = null;
  indLinePipeline = null;
  indHistPipeline = null;
  indBandPipeline = null;
  _minmaxWgsl = "";
  _candleWgsl = "";
  _lineWgsl = "";
  _smaWgsl = "";
  _vpWgsl = "";
  _indLineWgsl = "";
  _indHistWgsl = "";
  _indBandWgsl = "";
  storageBuf = null;
  storageBufSize = 0;
  mmBuf = null;
  computeParamBuf = null;
  candleUniBuf = null;
  smaLineBufs = new Map;
  lineUniBuf = null;
  arenaGpuBuf = null;
  arenaGpuBufSize = 0;
  _uniPool = [];
  _drawPool = Array.from({ length: 32 }, () => ({ pipeline: null, uniBufIdx: 0, uniSize: 0, drawCount: 0, vpY: 0, vpH: 0 }));
  _drawCount = 0;
  indSab = null;
  _indHdrView = null;
  _indRevision = -1;
  vpPipeline = null;
  vpBuffer = null;
  vpParamsBuf = null;
  _cpData = new Uint32Array(4);
  _mmInit = new Uint32Array([0, 2139095039, 0, 0]);
  _candleUbuf = new ArrayBuffer(96);
  _candleUbufDv = new DataView(this._candleUbuf);
  _candleUbufF32 = new Float32Array(this._candleUbuf);
  _candleUbufU32 = new Uint32Array(this._candleUbuf);
  _lineUbuf = new ArrayBuffer(64);
  _lineUbufDv = new DataView(this._lineUbuf);
  _vpParamsBuf = new ArrayBuffer(32);
  _vpParamsDv = new DataView(this._vpParamsBuf);
  _vpRenderUbuf = new ArrayBuffer(48);
  _vpRenderDv = new DataView(this._vpRenderUbuf);
  _indUniBuf = new ArrayBuffer(80);
  _indUniBufDv = new DataView(this._indUniBuf);
  _cachedLayout = { main: { y: 0, h: 0 }, sub1: { y: 0, h: 0 }, sub2: { y: 0, h: 0 }, gap: 0 };
  _defaultPaneConfig = { gap: 2, main: 7, sub1: 1.5, sub2: 1.5, marginBot: 8 };
  _priceRangeOut = [0, 1];
  _submitCmds = [null];
  _vpZeroBuf = new Uint32Array(128);
  _compBgEntries = [
    { binding: 0, resource: { buffer: null } },
    { binding: 1, resource: { buffer: null } },
    { binding: 2, resource: { buffer: null } }
  ];
  _compBgDesc = { layout: null, entries: this._compBgEntries };
  _candleBgEntries = [
    { binding: 0, resource: { buffer: null } },
    { binding: 1, resource: { buffer: null } },
    { binding: 2, resource: { buffer: null } }
  ];
  _candleBgDesc = { layout: null, entries: this._candleBgEntries };
  _lineBgEntries = [
    { binding: 0, resource: { buffer: null } },
    { binding: 1, resource: { buffer: null } }
  ];
  _lineBgDesc = { layout: null, entries: this._lineBgEntries };
  _vpRenderBgEntries = [
    { binding: 0, resource: { buffer: null } },
    { binding: 1, resource: { buffer: null } }
  ];
  _vpRenderBgDesc = { layout: null, entries: this._vpRenderBgEntries };
  _vpComputeBgEntries = [
    { binding: 0, resource: { buffer: null } },
    { binding: 1, resource: { buffer: null } },
    { binding: 2, resource: { buffer: null } }
  ];
  _vpComputeBgDesc = { layout: null, entries: this._vpComputeBgEntries };
  _indicatorBg0Entries = [{ binding: 0, resource: { buffer: null, size: 0 } }];
  _indicatorBg0Desc = { layout: null, entries: this._indicatorBg0Entries };
  _indicatorBg1Entries = [{ binding: 0, resource: { buffer: null } }];
  _indicatorBg1Desc = { layout: null, entries: this._indicatorBg1Entries };
  _clearColor = { r: 1, g: 1, b: 1, a: 1 };
  _clearPassColorAttachments = [{ view: null, loadOp: "clear", storeOp: "store", clearValue: this._clearColor }];
  _clearPassDesc = { colorAttachments: this._clearPassColorAttachments };
  _loadPassColorAttachments = [{ view: null, loadOp: "load", storeOp: "store" }];
  _loadPassDesc = { colorAttachments: this._loadPassColorAttachments };
  _indArenaView = null;
  _indArenaViewCap = 0;
  _fbOpen = null;
  _fbHigh = null;
  _fbLow = null;
  _fbClose = null;
  _fbVol = null;
  _fbSma20 = null;
  _fbSma50 = null;
  _fbSma100 = null;
  _hasLegacySmaFrameChannels = false;
  timestampQuerySet = null;
  timestampResolveBuf = null;
  timestampReadBuf = null;
  physW = 0;
  physH = 0;
  async init(gpuCanvas) {
    if (!navigator.gpu)
      throw new Error("WebGPU not available");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
      throw new Error("No WebGPU adapter");
    const features = [];
    if (adapter.features.has("timestamp-query"))
      features.push("timestamp-query");
    if (adapter.features.has("subgroups"))
      features.push("subgroups");
    this.device = await adapter.requestDevice({ requiredFeatures: features });
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context = gpuCanvas.getContext("webgpu");
    if (!this.context)
      throw new Error("Failed to get WebGPU context");
    this._configureContext(gpuCanvas.width, gpuCanvas.height);
    this._minmaxWgsl = MINMAX_COMPUTE_WGSL;
    this._candleWgsl = CANDLES_AUTO_RENDER_WGSL;
    this._lineWgsl = LINE_THICK_WGSL;
    this._smaWgsl = SMA_COMPUTE_WGSL;
    this._vpWgsl = VOLUME_PROFILE_WGSL;
    this._vpRenderWgsl = VP_RENDER_WGSL;
    this._indLineWgsl = INDICATOR_RENDER_WGSL;
    this._indHistWgsl = INDICATOR_HISTOGRAM_WGSL;
    this._indBandWgsl = INDICATOR_BAND_WGSL;
    this.minmaxPipeline = this._makeComputePipeline(this._minmaxWgsl);
    this.candlePipeline = this._makeRenderPipeline(this._candleWgsl);
    this.linePipeline = this._makeRenderPipeline(this._lineWgsl);
    this.indLinePipeline = this._makeRenderPipeline(this._indLineWgsl);
    this.indHistPipeline = this._makeRenderPipeline(this._indHistWgsl);
    this.indBandPipeline = this._makeRenderPipeline(this._indBandWgsl);
    this.vpPipeline = this._makeComputePipeline(this._vpWgsl);
    this.vpRenderPipeline = this._makeRenderPipeline(this._vpRenderWgsl);
    this.mmBuf = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.computeParamBuf = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.candleUniBuf = this.device.createBuffer({
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.lineUniBuf = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.vpParamsBuf = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.vpRenderUniforms = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.vpBuffer = this.device.createBuffer({
      size: this._vpZeroBuf.length * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    this.device.lost.then((info) => {
      console.error("[gpu_renderer] device lost:", info.message);
    });
    this.device.addEventListener("uncapturederror", (ev) => {
      console.error("[gpu_renderer] uncaptured error:", ev.error?.message ?? ev);
    });
    const originalCreateBuffer = this.device.createBuffer.bind(this.device);
    this._vramTotalBytes = 0;
    this._vramBufSizes = new WeakMap;
    this._vramRegistry = new FinalizationRegistry((size) => {
      this._vramTotalBytes -= size;
    });
    this.device.createBuffer = (descriptor) => {
      const buf = originalCreateBuffer(descriptor);
      const size = Number(descriptor && descriptor.size) || 0;
      this._vramBufSizes.set(buf, size);
      this._vramTotalBytes += size;
      this._vramRegistry.register(buf, size, buf);
      const originalDestroy = buf.destroy.bind(buf);
      buf.destroy = () => {
        const s = this._vramBufSizes.get(buf) || 0;
        if (s) {
          this._vramTotalBytes -= s;
          this._vramBufSizes.delete(buf);
        }
        this._vramRegistry.unregister(buf);
        originalDestroy();
      };
      return buf;
    };
    return { device: this.device, format: this.format };
  }
  initTimestampQuery(capacity) {
    if (!this.device)
      return false;
    try {
      if (!this.device.features || !this.device.features.has("timestamp-query"))
        return false;
      this.timestampQuerySet = this.device.createQuerySet({ type: "timestamp", count: capacity });
      this.timestampResolveBuf = this.device.createBuffer({ size: capacity * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
      this.timestampReadBuf = this.device.createBuffer({ size: capacity * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      return true;
    } catch (e) {
      console.warn("[gpu_renderer] initTimestampQuery failed:", e);
      return false;
    }
  }
  resolveTimestampQuery(first, count) {
    if (!this.device || !this.timestampQuerySet)
      return;
    const encoder = this.device.createCommandEncoder();
    encoder.resolveQuerySet(this.timestampQuerySet, first, count, this.timestampResolveBuf, 0);
    encoder.copyBufferToBuffer(this.timestampResolveBuf, 0, this.timestampReadBuf, 0, count * 8);
    this.device.queue.submit([encoder.finish()]);
  }
  async getTimestampResults() {
    if (!this.timestampReadBuf)
      return null;
    const mapMode = typeof GPUMapMode !== "undefined" ? GPUMapMode.READ : 1;
    await this.timestampReadBuf.mapAsync(mapMode);
    const arrBuf = this.timestampReadBuf.getMappedRange(0);
    const copied = arrBuf.slice(0);
    this.timestampReadBuf.unmap();
    return new BigUint64Array(copied);
  }
  setSize(gpuCanvas, physW, physH) {
    if (this.physW === physW && this.physH === physH)
      return;
    gpuCanvas.width = physW;
    gpuCanvas.height = physH;
    this.physW = physW;
    this.physH = physH;
    this._configureContext(physW, physH);
  }
  drawGpu(frameBuf, fdbHdr, viewLen, viewportShift = { panOffsetPx: 0, extraLeftBars: 0 }) {
    if (viewLen === 0) {
      this._priceRangeOut[0] = 0;
      this._priceRangeOut[1] = 1;
      return this._priceRangeOut;
    }
    const { device } = this;
    const queue = device.queue;
    const startBar = fdbHdr.getUint32(FBUF_START_BAR, true);
    const visBc = fdbHdr.getUint32(FBUF_VIS_BARS, true);
    const plotW = fdbHdr.getFloat32(FBUF_CANVAS_W, true);
    const plotH = fdbHdr.getFloat32(FBUF_CANVAS_H, true);
    const candleW = fdbHdr.getFloat32(FBUF_CANDLE_W, true);
    const pmin = fdbHdr.getFloat32(FBUF_PRICE_MIN, true);
    const pmax = fdbHdr.getFloat32(FBUF_PRICE_MAX, true);
    const flags = fdbHdr.getUint32(FBUF_FLAGS, true);
    const rightMarginBars = (flags & 8) !== 0 ? Math.max(0, viewportShift.rightMarginBars | 0) : 0;
    const totalSlots = Math.max(1, visBc + rightMarginBars);
    const slotW = plotW / totalSlots;
    const offsetSlots = viewportShift.extraLeftBars + viewportShift.panOffsetPx / Math.max(0.000001, slotW);
    const DPR = this.dpr;
    const paneLayout = this._computePaneLayout(plotH, flags);
    const mainH = paneLayout.main.h;
    const range = pmax - pmin || 1;
    const pad = Math.max(range * 0.05, 6 / Math.max(mainH, 1) * range);
    const paddedMin = pmin - pad;
    const paddedMax = pmax + pad;
    this._priceRangeOut[0] = paddedMin;
    this._priceRangeOut[1] = paddedMax;
    const storageNeeded = viewLen * 5 * 4;
    if (!this.storageBuf || this.storageBufSize < storageNeeded) {
      this.storageBuf?.destroy();
      this.storageBuf = device.createBuffer({
        size: storageNeeded,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      this.storageBufSize = storageNeeded;
    }
    const stride = viewLen * 4;
    queue.writeBuffer(this.storageBuf, 0, this._fbOpen, 0, viewLen);
    queue.writeBuffer(this.storageBuf, stride, this._fbHigh, 0, viewLen);
    queue.writeBuffer(this.storageBuf, stride * 2, this._fbLow, 0, viewLen);
    queue.writeBuffer(this.storageBuf, stride * 3, this._fbClose, 0, viewLen);
    queue.writeBuffer(this.storageBuf, stride * 4, this._fbVol, 0, viewLen);
    if (!this.indSab && this._hasLegacySmaFrameChannels) {
      try {
        if (flags & 1)
          this._uploadSmaToBuf(viewLen, FBUF_SMA20_OFF, frameBuf);
        if (flags & 2)
          this._uploadSmaToBuf(viewLen, FBUF_SMA50_OFF, frameBuf);
        if (flags & 4)
          this._uploadSmaToBuf(viewLen, FBUF_SMA100_OFF, frameBuf);
      } catch (e) {
        console.warn("[gpu_renderer] SMA upload failed:", e);
      }
    }
    queue.writeBuffer(this.mmBuf, 0, this._mmInit);
    this._cpData[0] = viewLen;
    this._cpData[1] = 0;
    this._cpData[2] = viewLen;
    this._cpData[3] = 0;
    queue.writeBuffer(this.computeParamBuf, 0, this._cpData);
    {
      const v = this._candleUbufDv;
      v.setFloat32(0, plotW, true);
      v.setFloat32(4, candleW, true);
      v.setUint32(8, viewLen, true);
      v.setUint32(12, 0, true);
      v.setUint32(16, totalSlots, true);
      v.setFloat32(20, mainH, true);
      v.setFloat32(24, DPR, true);
      v.setFloat32(28, offsetSlots, true);
      v.setFloat32(32, 0, true);
      v.setFloat32(36, 0.67, true);
      v.setFloat32(40, 0, true);
      v.setFloat32(44, 1, true);
      v.setFloat32(48, 0.8, true);
      v.setFloat32(52, 0.2, true);
      v.setFloat32(56, 0.2, true);
      v.setFloat32(60, 1, true);
      v.setFloat32(64, 0.39, true);
      v.setFloat32(68, 0.39, true);
      v.setFloat32(72, 0.39, true);
      v.setFloat32(76, 1, true);
      v.setFloat32(80, 0.39, true);
      v.setFloat32(84, 0.39, true);
      v.setFloat32(88, 0.39, true);
      v.setFloat32(92, 1, true);
      queue.writeBuffer(this.candleUniBuf, 0, this._candleUbuf);
    }
    const encoder = device.createCommandEncoder();
    {
      const compBGL = this.minmaxPipeline.getBindGroupLayout(0);
      this._compBgDesc.layout = compBGL;
      this._compBgEntries[0].resource.buffer = this.storageBuf;
      this._compBgEntries[1].resource.buffer = this.mmBuf;
      this._compBgEntries[2].resource.buffer = this.computeParamBuf;
      const compBG = device.createBindGroup(this._compBgDesc);
      const compPass = encoder.beginComputePass();
      compPass.setPipeline(this.minmaxPipeline);
      compPass.setBindGroup(0, compBG);
      compPass.dispatchWorkgroups(Math.ceil(viewLen / 64));
      compPass.end();
    }
    {
      const candleBGL = this.candlePipeline.getBindGroupLayout(0);
      this._candleBgDesc.layout = candleBGL;
      this._candleBgEntries[0].resource.buffer = this.candleUniBuf;
      this._candleBgEntries[1].resource.buffer = this.storageBuf;
      this._candleBgEntries[2].resource.buffer = this.mmBuf;
      const candleBG = device.createBindGroup(this._candleBgDesc);
      const swapView = this.context.getCurrentTexture().createView();
      this._clearPassColorAttachments[0].view = swapView;
      const renderPass = encoder.beginRenderPass(this._clearPassDesc);
      if (mainH < plotH)
        renderPass.setViewport(0, 0, plotW, mainH, 0, 1);
      renderPass.setPipeline(this.candlePipeline);
      renderPass.setBindGroup(0, candleBG);
      renderPass.draw(12, viewLen);
      renderPass.end();
    }
    this._submitCmds[0] = encoder.finish();
    queue.submit(this._submitCmds);
    if (this.indSab) {
      this._drawIndicatorCmds(plotW, candleW, paddedMin, paddedMax, paneLayout, flags, visBc, offsetSlots);
    } else if (this._hasLegacySmaFrameChannels) {
      if (flags & 1)
        this._drawSmaLine(FBUF_SMA20_OFF, viewLen, Math.max(0, 20 - 1 - startBar), plotW, mainH, candleW, paddedMin, paddedMax, 0, 0.56, 0.73, 1, DPR * 1.5, visBc);
      if (flags & 2)
        this._drawSmaLine(FBUF_SMA50_OFF, viewLen, Math.max(0, 50 - 1 - startBar), plotW, mainH, candleW, paddedMin, paddedMax, 1, 0.76, 0.03, 1, DPR * 1.5, visBc);
      if (flags & 4)
        this._drawSmaLine(FBUF_SMA100_OFF, viewLen, Math.max(0, 100 - 1 - startBar), plotW, mainH, candleW, paddedMin, paddedMax, 0.91, 0.12, 0.39, 1, DPR * 1.5, visBc);
    }
    if (flags & 16) {
      const numBins = 70;
      this.computeVolumeProfileOnGpu(viewLen, numBins, paddedMin, paddedMax);
      this._drawVolumeProfileHeatmap(plotW, mainH, numBins, plotW - 120, 120, 0.4, 0.4, 0.9, 0.3);
    }
    return this._priceRangeOut;
  }
  _drawSmaLine(smaByteOff, viewLen, nanStart, plotW, plotH, candleW, priceMin, priceMax, r, g, b, a, lineWidthPx, visBc) {
    if (viewLen < 2)
      return;
    const { device } = this;
    const queue = device.queue;
    const entry = this.smaLineBufs.get(smaByteOff);
    if (!entry)
      return;
    {
      const v = this._lineUbufDv;
      v.setFloat32(0, plotW, true);
      v.setFloat32(4, plotH, true);
      v.setFloat32(8, candleW, true);
      v.setFloat32(12, priceMin, true);
      v.setFloat32(16, priceMax, true);
      v.setFloat32(20, lineWidthPx, true);
      v.setUint32(24, 0, true);
      v.setUint32(28, 0, true);
      v.setFloat32(32, r, true);
      v.setFloat32(36, g, true);
      v.setFloat32(40, b, true);
      v.setFloat32(44, a, true);
      v.setUint32(48, viewLen, true);
      v.setUint32(52, nanStart, true);
      v.setUint32(56, visBc, true);
      v.setUint32(60, 0, true);
      queue.writeBuffer(this.lineUniBuf, 0, this._lineUbuf);
    }
    const lineBGL = this.linePipeline.getBindGroupLayout(0);
    this._lineBgDesc.layout = lineBGL;
    this._lineBgEntries[0].resource.buffer = this.lineUniBuf;
    this._lineBgEntries[1].resource.buffer = entry.buf;
    const lineBG = device.createBindGroup(this._lineBgDesc);
    const swapView = this.context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    this._loadPassColorAttachments[0].view = swapView;
    const pass = encoder.beginRenderPass(this._loadPassDesc);
    pass.setViewport(0, 0, plotW, plotH, 0, 1);
    pass.setPipeline(this.linePipeline);
    pass.setBindGroup(0, lineBG);
    pass.draw((viewLen - 1) * 6);
    pass.end();
    this._submitCmds[0] = encoder.finish();
    queue.submit(this._submitCmds);
  }
  _drawVolumeProfileHeatmap(plotW, plotH, numBins, panelX, panelW, r, g, b, a) {
    if (!this.vpBuffer || !this.device)
      return;
    const { device } = this;
    const queue = device.queue;
    const ubuf = this._vpRenderUbuf;
    const dv = this._vpRenderDv;
    dv.setFloat32(0, plotW, true);
    dv.setFloat32(4, plotH, true);
    dv.setUint32(8, numBins, true);
    dv.setFloat32(16, panelX, true);
    dv.setFloat32(20, panelW, true);
    dv.setFloat32(24, r, true);
    dv.setFloat32(28, g, true);
    dv.setFloat32(32, b, true);
    dv.setFloat32(36, a, true);
    queue.writeBuffer(this.vpRenderUniforms, 0, ubuf);
    const bgl = this.vpRenderPipeline.getBindGroupLayout(0);
    this._vpRenderBgDesc.layout = bgl;
    this._vpRenderBgEntries[0].resource.buffer = this.vpRenderUniforms;
    this._vpRenderBgEntries[1].resource.buffer = this.vpBuffer;
    const bg = device.createBindGroup(this._vpRenderBgDesc);
    const swapView = this.context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    this._loadPassColorAttachments[0].view = swapView;
    const pass = encoder.beginRenderPass(this._loadPassDesc);
    pass.setViewport(0, 0, plotW, plotH, 0, 1);
    pass.setPipeline(this.vpRenderPipeline);
    pass.setBindGroup(0, bg);
    pass.draw(6, numBins);
    pass.end();
    this._submitCmds[0] = encoder.finish();
    queue.submit(this._submitCmds);
  }
  setIndSab(sab) {
    this.indSab = sab;
    this._indHdrView = new DataView(sab);
    this._destroyLegacyResources();
  }
  setFrameBufViews(fbuf) {
    this._fbOpen = new Float32Array(fbuf, FBUF_OPEN_OFF, FRAME_MAX_BARS);
    this._fbHigh = new Float32Array(fbuf, FBUF_HIGH_OFF, FRAME_MAX_BARS);
    this._fbLow = new Float32Array(fbuf, FBUF_LOW_OFF, FRAME_MAX_BARS);
    this._fbClose = new Float32Array(fbuf, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
    this._fbVol = new Float32Array(fbuf, FBUF_VOL_OFF, FRAME_MAX_BARS);
    const legacySmaBytes = FBUF_SMA100_OFF + FRAME_MAX_BARS * 4;
    this._hasLegacySmaFrameChannels = fbuf.byteLength >= legacySmaBytes;
    if (this._hasLegacySmaFrameChannels) {
      this._fbSma20 = new Float32Array(fbuf, FBUF_SMA20_OFF, FRAME_MAX_BARS);
      this._fbSma50 = new Float32Array(fbuf, FBUF_SMA50_OFF, FRAME_MAX_BARS);
      this._fbSma100 = new Float32Array(fbuf, FBUF_SMA100_OFF, FRAME_MAX_BARS);
    } else {
      this._fbSma20 = null;
      this._fbSma50 = null;
      this._fbSma100 = null;
    }
  }
  _destroyLegacyResources() {
    for (const { buf } of this.smaLineBufs.values())
      buf.destroy();
    this.smaLineBufs.clear();
    if (this.lineUniBuf) {
      this.lineUniBuf.destroy();
      this.lineUniBuf = null;
    }
    this._fbSma20 = null;
    this._fbSma50 = null;
    this._fbSma100 = null;
    this._hasLegacySmaFrameChannels = false;
  }
  capUniformPool(count) {
    while (this._uniPool.length > count) {
      this._uniPool.pop().destroy();
    }
  }
  _ensureArenaGpuBuf(f32Count) {
    const needed = f32Count * 4;
    if (this.arenaGpuBuf && this.arenaGpuBufSize >= needed && this.arenaGpuBufSize <= needed * 4)
      return;
    this.arenaGpuBuf?.destroy();
    const size = Math.max(needed, 256);
    this.arenaGpuBuf = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.arenaGpuBufSize = size;
  }
  setPaneConfig(cfg) {
    this.paneConfig = { ...this.paneConfig, ...cfg };
  }
  _computePaneLayout(plotH, flags) {
    let hasSub1 = false, hasSub2 = false;
    if (this.indSab) {
      const hdr = this._indHdrView;
      const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
      for (let ci = 0;ci < cmdCount; ci++) {
        const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
        const pane = hdr.getUint32(base + INDSAB_CMD_PANE, true);
        const flagMask = hdr.getUint32(base + INDSAB_CMD_FLAG_MASK, true);
        const barCount = hdr.getUint32(base + INDSAB_CMD_BAR_COUNT, true);
        if (flagMask !== 0 && (flags & flagMask) === 0)
          continue;
        if (barCount < 2)
          continue;
        if (pane === 1)
          hasSub1 = true;
        else if (pane === 2)
          hasSub2 = true;
      }
    }
    const config = this.paneConfig || this._defaultPaneConfig;
    const DPR = this.dpr;
    const gap = (config.gap !== undefined ? config.gap : 2) * DPR;
    const marginBot = (config.marginBot !== undefined ? config.marginBot : 8) * DPR;
    const usableH = Math.max(1, plotH - marginBot);
    const layout = this._cachedLayout;
    layout.main.y = 0;
    if (hasSub1 && hasSub2) {
      const rM = config.main || 7;
      const r1 = config.sub1 || 1.5;
      const r2 = config.sub2 || 1.5;
      const total = rM + r1 + r2;
      const usable = usableH - gap * 2;
      const mainH = Math.max(1, Math.round(usable * (rM / total)));
      const sub1H = Math.max(1, Math.round(usable * (r1 / total)));
      const sub2H = Math.max(1, usable - mainH - sub1H);
      layout.main.h = mainH;
      layout.sub1.y = mainH + gap;
      layout.sub1.h = sub1H;
      layout.sub2.y = mainH + sub1H + gap * 2;
      layout.sub2.h = sub2H;
    } else if (hasSub1) {
      const rM = config.main || 7;
      const r1 = config.sub1 || 1.5;
      const total = rM + r1;
      const usable = usableH - gap;
      const mainH = Math.max(1, Math.round(usable * (rM / total)));
      layout.main.h = mainH;
      layout.sub1.y = mainH + gap;
      layout.sub1.h = usable - mainH;
      layout.sub2.y = 0;
      layout.sub2.h = 0;
    } else if (hasSub2) {
      const rM = config.main || 7;
      const r2 = config.sub2 || 1.5;
      const total = rM + r2;
      const usable = usableH - gap;
      const mainH = Math.max(1, Math.round(usable * (rM / total)));
      layout.main.h = mainH;
      layout.sub1.y = 0;
      layout.sub1.h = 0;
      layout.sub2.y = mainH + gap;
      layout.sub2.h = usable - mainH;
    } else {
      layout.main.h = usableH;
      layout.sub1.y = 0;
      layout.sub1.h = 0;
      layout.sub2.y = 0;
      layout.sub2.h = 0;
    }
    layout.gap = gap;
    this.paneLayout = layout;
    return layout;
  }
  _drawIndicatorCmds(plotW, candleW, priceMin, priceMax, paneLayout, flags = 4294967295, visBc, offsetSlots = 0) {
    const hdr = this._indHdrView;
    const arenaLen = hdr.getUint32(INDSAB_ARENA_LEN, true);
    const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
    const revision = hdr.getUint32(INDSAB_REVISION, true);
    if (cmdCount === 0 || arenaLen === 0)
      return;
    if (revision !== this._indRevision) {
      this._indRevision = revision;
      this.capUniformPool(cmdCount);
    }
    const { device } = this;
    const queue = device.queue;
    this._ensureArenaGpuBuf(arenaLen);
    if (!this._indArenaView || arenaLen > this._indArenaViewCap) {
      this._indArenaView = new Float32Array(this.indSab, INDSAB_ARENA_OFF, arenaLen);
      this._indArenaViewCap = arenaLen;
    }
    queue.writeBuffer(this.arenaGpuBuf, 0, this._indArenaView, 0, arenaLen);
    const dv = this._indUniBufDv;
    const draws = this._drawPool;
    let poolIdx = 0;
    for (let ci = 0;ci < cmdCount; ci++) {
      const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
      const arenaOff = hdr.getUint32(base + INDSAB_CMD_ARENA_OFFSET, true);
      const barCount = hdr.getUint32(base + INDSAB_CMD_BAR_COUNT, true);
      const warmup = hdr.getUint32(base + INDSAB_CMD_WARMUP, true);
      const cr = hdr.getFloat32(base + INDSAB_CMD_COLOR_R, true);
      const cg = hdr.getFloat32(base + INDSAB_CMD_COLOR_G, true);
      const cb = hdr.getFloat32(base + INDSAB_CMD_COLOR_B, true);
      const ca = hdr.getFloat32(base + INDSAB_CMD_COLOR_A, true);
      const style = hdr.getUint32(base + INDSAB_CMD_STYLE, true);
      const pane = hdr.getUint32(base + INDSAB_CMD_PANE, true);
      const bandAltOff = hdr.getUint32(base + INDSAB_CMD_BAND_ALT_OFF, true);
      const lineW = hdr.getFloat32(base + INDSAB_CMD_LINE_WIDTH, true);
      const flagMask = hdr.getUint32(base + INDSAB_CMD_FLAG_MASK, true);
      const valueMin = hdr.getFloat32(base + INDSAB_CMD_VALUE_MIN, true);
      const valueMax = hdr.getFloat32(base + INDSAB_CMD_VALUE_MAX, true);
      if (flagMask !== 0 && (flags & flagMask) === 0)
        continue;
      if (barCount < 2)
        continue;
      const useValueDomain = pane !== 0 || style === STYLE_HISTOGRAM;
      const yMin = useValueDomain ? valueMin : priceMin;
      const yMax = useValueDomain ? valueMax : priceMax;
      const paneRegion = pane === 2 ? paneLayout.sub2 : pane === 1 ? paneLayout.sub1 : paneLayout.main;
      if (!paneRegion || paneRegion.h < 4)
        continue;
      const paneH = paneRegion.h;
      let pipeline, uniSize, drawCount;
      if (style === STYLE_HISTOGRAM) {
        const bars = barCount - warmup;
        if (bars < 1)
          continue;
        this._packHistogramUni(dv, plotW, paneH, candleW, yMin, yMax, arenaOff, barCount, warmup, cr, cg, cb, ca, visBc, offsetSlots);
        pipeline = this.indHistPipeline;
        uniSize = 80;
        drawCount = bars * 6;
      } else if (style === STYLE_BAND) {
        const segs = barCount - warmup - 1;
        if (segs < 1)
          continue;
        this._packBandUni(dv, plotW, paneH, candleW, yMin, yMax, arenaOff, bandAltOff, barCount, warmup, cr, cg, cb, ca, visBc, offsetSlots);
        pipeline = this.indBandPipeline;
        uniSize = 64;
        drawCount = segs * 6;
      } else {
        const seg = barCount - warmup - 1;
        if (seg < 1)
          continue;
        this._packThickLineUni(dv, plotW, paneH, candleW, yMin, yMax, arenaOff, barCount, warmup, lineW, cr, cg, cb, ca, visBc, offsetSlots);
        pipeline = this.indLinePipeline;
        uniSize = 64;
        drawCount = seg * 6;
      }
      this._ensureUniPool(poolIdx + 1);
      queue.writeBuffer(this._uniPool[poolIdx], 0, this._indUniBuf, 0, uniSize);
      const d = draws[poolIdx];
      d.pipeline = pipeline;
      d.uniBufIdx = poolIdx;
      d.uniSize = uniSize;
      d.drawCount = drawCount;
      d.vpY = paneRegion.y;
      d.vpH = paneRegion.h;
      poolIdx++;
    }
    if (poolIdx === 0)
      return;
    const swapView = this.context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    this._loadPassColorAttachments[0].view = swapView;
    const pass = encoder.beginRenderPass(this._loadPassDesc);
    for (let di = 0;di < poolIdx; di++) {
      const { pipeline, uniBufIdx, uniSize, drawCount, vpY, vpH } = draws[di];
      const uniBuf = this._uniPool[uniBufIdx];
      const bgl0 = pipeline.getBindGroupLayout(0);
      const bgl1 = pipeline.getBindGroupLayout(1);
      this._indicatorBg0Desc.layout = bgl0;
      this._indicatorBg0Entries[0].resource.buffer = uniBuf;
      this._indicatorBg0Entries[0].resource.size = uniSize;
      const bg0 = device.createBindGroup(this._indicatorBg0Desc);
      this._indicatorBg1Desc.layout = bgl1;
      this._indicatorBg1Entries[0].resource.buffer = this.arenaGpuBuf;
      const bg1 = device.createBindGroup(this._indicatorBg1Desc);
      pass.setViewport(0, vpY, plotW, vpH, 0, 1);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg0);
      pass.setBindGroup(1, bg1);
      pass.draw(drawCount);
    }
    pass.end();
    this._submitCmds[0] = encoder.finish();
    queue.submit(this._submitCmds);
  }
  _packThickLineUni(dv, plotW, plotH, candleW, priceMin, priceMax, arenaOffset, barCount, warmup, lineWidthPx, r, g, b, a, visBc, offsetSlots) {
    dv.setFloat32(0, plotW, true);
    dv.setFloat32(4, plotH, true);
    dv.setFloat32(8, candleW, true);
    dv.setFloat32(12, priceMin, true);
    dv.setFloat32(16, priceMax, true);
    dv.setFloat32(20, lineWidthPx, true);
    dv.setUint32(24, arenaOffset, true);
    dv.setUint32(28, warmup, true);
    dv.setFloat32(32, r, true);
    dv.setFloat32(36, g, true);
    dv.setFloat32(40, b, true);
    dv.setFloat32(44, a, true);
    dv.setUint32(48, barCount, true);
    dv.setUint32(52, visBc, true);
    dv.setUint32(56, 0, true);
    dv.setFloat32(60, offsetSlots, true);
  }
  _packHistogramUni(dv, plotW, plotH, candleW, valueMin, valueMax, arenaOffset, barCount, warmup, r, g, b, a, visBc, offsetSlots) {
    dv.setFloat32(0, plotW, true);
    dv.setFloat32(4, plotH, true);
    dv.setFloat32(8, candleW, true);
    dv.setFloat32(12, valueMin, true);
    dv.setFloat32(16, valueMax, true);
    dv.setFloat32(20, 0, true);
    dv.setUint32(24, arenaOffset, true);
    dv.setUint32(28, warmup, true);
    dv.setFloat32(32, r, true);
    dv.setFloat32(36, g, true);
    dv.setFloat32(40, b, true);
    dv.setFloat32(44, a, true);
    dv.setFloat32(48, r * 0.6, true);
    dv.setFloat32(52, g * 0.6, true);
    dv.setFloat32(56, b * 0.6, true);
    dv.setFloat32(60, a, true);
    dv.setUint32(64, barCount, true);
    dv.setFloat32(68, 0.1, true);
    dv.setUint32(72, visBc, true);
    dv.setFloat32(76, offsetSlots, true);
  }
  _packBandUni(dv, plotW, plotH, candleW, priceMin, priceMax, arenaOffUpper, arenaOffLower, barCount, warmup, r, g, b, a, visBc, offsetSlots) {
    dv.setFloat32(0, plotW, true);
    dv.setFloat32(4, plotH, true);
    dv.setFloat32(8, candleW, true);
    dv.setFloat32(12, priceMin, true);
    dv.setFloat32(16, priceMax, true);
    dv.setUint32(20, arenaOffUpper, true);
    dv.setUint32(24, arenaOffLower, true);
    dv.setUint32(28, warmup, true);
    dv.setFloat32(32, r, true);
    dv.setFloat32(36, g, true);
    dv.setFloat32(40, b, true);
    dv.setFloat32(44, a * 0.15, true);
    dv.setUint32(48, barCount, true);
    dv.setUint32(52, visBc, true);
    dv.setUint32(56, 0, true);
    dv.setFloat32(60, offsetSlots, true);
  }
  _ensureUniPool(count) {
    while (this._uniPool.length < count) {
      this._uniPool.push(this.device.createBuffer({
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: `indUni[${this._uniPool.length}]`
      }));
    }
  }
  _configureContext(w, h) {
    if (!this.context || !this.device)
      return;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied"
    });
  }
  _makeComputePipeline(wgsl) {
    const mod = this.device.createShaderModule({ code: wgsl });
    return this.device.createComputePipeline({
      layout: "auto",
      compute: { module: mod, entryPoint: "cs" }
    });
  }
  _uploadSmaToBuf(viewLen, smaByteOff, frameBuf) {
    if (!this.device)
      return;
    const device = this.device;
    const queue = device.queue;
    const needed = viewLen * 4;
    let entry = this.smaLineBufs.get(smaByteOff);
    if (!entry || entry.size < needed) {
      entry?.buf?.destroy();
      const buf = device.createBuffer({
        size: needed,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      entry = { buf, size: needed };
      this.smaLineBufs.set(smaByteOff, entry);
    }
    const src = smaByteOff === FBUF_SMA20_OFF ? this._fbSma20 : smaByteOff === FBUF_SMA50_OFF ? this._fbSma50 : this._fbSma100;
    if (!src)
      return;
    queue.writeBuffer(entry.buf, 0, src, 0, viewLen);
  }
  computeVolumeProfileOnGpu(viewLen, numBins, priceMin, priceMax) {
    if (!this.device)
      return;
    const device = this.device;
    const queue = device.queue;
    const binCount = numBins + 1;
    const binBytes = binCount * 4;
    if (!this.vpBuffer || this.vpBuffer.size < binBytes) {
      this.vpBuffer?.destroy?.();
      this.vpBuffer = device.createBuffer({ size: binBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    }
    queue.writeBuffer(this.vpBuffer, 0, this._vpZeroBuf.subarray(0, binCount));
    const pbuf = this._vpParamsBuf;
    const dv = this._vpParamsDv;
    dv.setUint32(0, viewLen, true);
    dv.setUint32(4, 0, true);
    dv.setUint32(8, viewLen, true);
    dv.setUint32(12, numBins, true);
    dv.setFloat32(16, priceMin, true);
    dv.setFloat32(20, priceMax, true);
    if (!this.vpParamsBuf) {
      this.vpParamsBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    }
    queue.writeBuffer(this.vpParamsBuf, 0, pbuf);
    const encoder = device.createCommandEncoder();
    const bgl = this.vpPipeline.getBindGroupLayout(0);
    this._vpComputeBgDesc.layout = bgl;
    this._vpComputeBgEntries[0].resource.buffer = this.storageBuf;
    this._vpComputeBgEntries[1].resource.buffer = this.vpBuffer;
    this._vpComputeBgEntries[2].resource.buffer = this.vpParamsBuf;
    const bg = device.createBindGroup(this._vpComputeBgDesc);
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.vpPipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(viewLen / 64));
    pass.end();
    this._submitCmds[0] = encoder.finish();
    device.queue.submit(this._submitCmds);
  }
  _makeRenderPipeline(wgsl) {
    const mod = this.device.createShaderModule({ code: wgsl });
    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs_main" },
      fragment: {
        module: mod,
        entryPoint: "fs_main",
        targets: [{ format: this.format }]
      },
      primitive: { topology: "triangle-list" }
    });
  }
  destroy() {
    this.storageBuf?.destroy();
    this.mmBuf?.destroy();
    this.computeParamBuf?.destroy();
    this.candleUniBuf?.destroy();
    this.lineUniBuf?.destroy();
    this.arenaGpuBuf?.destroy();
    for (const buf of this._uniPool)
      buf.destroy();
    this._uniPool = [];
    for (const { buf } of this.smaLineBufs.values())
      buf.destroy();
    this.smaLineBufs.clear();
    this.device = null;
  }
}

// crates/mochart-wasm-new/src/demo/render_worker.js
var DPR = Math.round(self.devicePixelRatio || 1);
var LEGEND_ENTRIES = [
  { bit: 1, label: "SMA 5", color: "#00BCD4" },
  { bit: 2, label: "SMA 25", color: "#FFC107" },
  { bit: 4, label: "SMA 75", color: "#E91E63" },
  { bit: 16, label: "HM", color: "#888888" }
];
var smaPeriods = { sma1: 5, sma2: 25, sma3: 75 };
var smaPrefix1 = "SMA 5:";
var smaPrefix2 = "SMA 25:";
var smaPrefix3 = "SMA 75:";
var _r64 = new Float64Array(6);
var R_LAST_GPU_MS = 0;
var R_CACHED_PMIN = 1;
var R_CACHED_PMAX = 2;
var R_HUD_MS = 3;
var R_FRAME_MS = 4;
_r64[R_CACHED_PMIN] = NaN;
_r64[R_CACHED_PMAX] = NaN;
var STATS_SIZE = 64;
var _statsGpu = new Float32Array(STATS_SIZE);
var _statsHud = new Float32Array(STATS_SIZE);
var _statsFrame = new Float32Array(STATS_SIZE);
var _statsHead = 0;
var _statsFilled = 0;
var _sortScratch = new Float32Array(STATS_SIZE);
var PERF_POST_INTERVAL_MS = 500;
var _lastPerfPostTs = 0;
function percentile(buf, n, pct) {
  _sortScratch.set(buf.subarray(0, n));
  const arr = _sortScratch;
  for (let i = 1;i < n; i++) {
    const v = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > v) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = v;
  }
  return arr[Math.min(n - 1, Math.floor(pct / 100 * n))];
}
var _memPeakJsMB = 0;
var _dateCache = new Map;
var DATE_CACHE_MAX = 512;
function isoDateStr(ms) {
  let s = _dateCache.get(ms);
  if (s !== undefined)
    return s;
  const d = new Date(ms), m = d.getUTCMonth() + 1, dy = d.getUTCDate();
  s = `${d.getUTCFullYear()}-${m < 10 ? "0" : ""}${m}-${dy < 10 ? "0" : ""}${dy}`;
  if (_dateCache.size >= DATE_CACHE_MAX)
    _dateCache.delete(_dateCache.keys().next().value);
  _dateCache.set(ms, s);
  return s;
}
var gpuCanvas;
var hudCanvas;
var hud;
var ctrl;
var frameCtrl;
var frameBuf;
var fdbHdr;
var gpuRenderer;
var _fbOpen;
var _fbHigh;
var _fbLow;
var _fbClose;
var _fbVol;
var _fbTime;
var _popupData = { open: 0, high: 0, low: 0, close: 0, vol: 0, sma20: 0, sma50: 0, sma100: 0 };
var _smaArenaOff = [0, 0, 0];
var _smaBarCount = [0, 0, 0];
var _smaCachedRevision = -1;
var _indSabRef = null;
var _indSabHdr = null;
var _indArenaView = null;
var _indArenaViewLen = 0;
var workerSlotId = 0;
var _overlayRevSeen = -1;
var _overlaySummaryWords = new Uint32Array(INDSAB_OVERLAY_STD430_WORDS);
function _readSmaPop(idx) {
  if (!_indSabRef || !_indSabHdr) {
    _popupData.sma20 = NaN;
    _popupData.sma50 = NaN;
    _popupData.sma100 = NaN;
    return;
  }
  const hdr = _indSabHdr;
  const rev = hdr.getUint32(12, true);
  if (rev !== _smaCachedRevision) {
    _smaCachedRevision = rev;
    const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
    _smaArenaOff[0] = _smaArenaOff[1] = _smaArenaOff[2] = 0;
    _smaBarCount[0] = _smaBarCount[1] = _smaBarCount[2] = 0;
    for (let ci = 0;ci < cmdCount; ci++) {
      const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
      const flagMask = hdr.getUint32(base + INDSAB_CMD_FLAG_MASK, true);
      const style = hdr.getUint32(base + INDSAB_CMD_STYLE, true);
      if (style !== 1)
        continue;
      let si = -1;
      if (flagMask === 1)
        si = 0;
      else if (flagMask === 2)
        si = 1;
      else if (flagMask === 4)
        si = 2;
      if (si >= 0) {
        _smaArenaOff[si] = hdr.getUint32(base + INDSAB_CMD_ARENA_OFFSET, true);
        _smaBarCount[si] = hdr.getUint32(base + INDSAB_CMD_BAR_COUNT, true);
      }
    }
  }
  const arenaLen = hdr.getUint32(INDSAB_ARENA_LEN, true);
  if (!_indArenaView || arenaLen > _indArenaViewLen) {
    _indArenaView = new Float32Array(_indSabRef, INDSAB_ARENA_OFF, arenaLen);
    _indArenaViewLen = arenaLen;
  }
  _popupData.sma20 = idx < _smaBarCount[0] && _smaArenaOff[0] + idx < arenaLen ? _indArenaView[_smaArenaOff[0] + idx] : NaN;
  _popupData.sma50 = idx < _smaBarCount[1] && _smaArenaOff[1] + idx < arenaLen ? _indArenaView[_smaArenaOff[1] + idx] : NaN;
  _popupData.sma100 = idx < _smaBarCount[2] && _smaArenaOff[2] + idx < arenaLen ? _indArenaView[_smaArenaOff[2] + idx] : NaN;
}
function _readOverlaySummary() {
  if (!_indSabHdr)
    return _overlaySummaryWords;
  const rev = _indSabHdr.getUint32(INDSAB_OVERLAY_REV_OFF, true);
  if (rev === _overlayRevSeen)
    return _overlaySummaryWords;
  _overlayRevSeen = rev;
  for (let i = 0;i < INDSAB_OVERLAY_STD430_WORDS; i++) {
    _overlaySummaryWords[i] = _indSabHdr.getUint32(INDSAB_OVERLAY_STD430_OFF + i * 4, true);
  }
  return _overlaySummaryWords;
}
self.onmessage = async (evt) => {
  if (evt.data.type === "update_sma_periods") {
    smaPeriods.sma1 = evt.data.sma1;
    smaPeriods.sma2 = evt.data.sma2;
    smaPeriods.sma3 = evt.data.sma3;
    LEGEND_ENTRIES[0].label = "SMA " + evt.data.sma1;
    LEGEND_ENTRIES[1].label = "SMA " + evt.data.sma2;
    LEGEND_ENTRIES[2].label = "SMA " + evt.data.sma3;
    smaPrefix1 = "SMA " + evt.data.sma1 + ":";
    smaPrefix2 = "SMA " + evt.data.sma2 + ":";
    smaPrefix3 = "SMA " + evt.data.sma3 + ":";
    return;
  }
  if (evt.data.type === "config") {
    if (gpuRenderer && evt.data.paneConfig) {
      gpuRenderer.setPaneConfig(evt.data.paneConfig);
      _r64[R_CACHED_PMIN] = NaN;
    }
    return;
  }
  if (evt.data.type !== "init")
    return;
  const descriptor = evt.data.descriptor ?? {
    slotId: 0,
    ctrl: evt.data.ctrl,
    frameCtrl: evt.data.frameCtrl,
    frameBuf: evt.data.frameBuf,
    indSab: evt.data.indSab
  };
  const { gpuCanvas: gc, hudCanvas: hc } = evt.data;
  workerSlotId = (descriptor.slotId | 0) >>> 0;
  const ctrlBuf = descriptor.ctrl;
  const frcBuf = descriptor.frameCtrl;
  const fsBuf = descriptor.frameBuf;
  const indSab = descriptor.indSab;
  if (typeof evt.data.dpr === "number" && evt.data.dpr >= 1) {
    DPR = Math.round(evt.data.dpr);
  }
  console.log("[render_worker] DPR:", DPR, "slot:", workerSlotId);
  gpuCanvas = gc;
  hudCanvas = hc;
  ctrl = new Int32Array(ctrlBuf);
  frameCtrl = new Int32Array(frcBuf);
  frameBuf = fsBuf;
  fdbHdr = new DataView(fsBuf, 0, FBUF_HDR_BYTES);
  _fbOpen = new Float32Array(fsBuf, FBUF_OPEN_OFF, FRAME_MAX_BARS);
  _fbHigh = new Float32Array(fsBuf, FBUF_HIGH_OFF, FRAME_MAX_BARS);
  _fbLow = new Float32Array(fsBuf, FBUF_LOW_OFF, FRAME_MAX_BARS);
  _fbClose = new Float32Array(fsBuf, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
  _fbVol = new Float32Array(fsBuf, FBUF_VOL_OFF, FRAME_MAX_BARS);
  _fbTime = new Float64Array(fsBuf, FBUF_TIME_OFF, FRAME_MAX_BARS);
  try {
    gpuRenderer = new GpuRenderer;
    gpuRenderer.dpr = DPR;
    const { format } = await gpuRenderer.init(gpuCanvas);
    gpuRenderer.setFrameBufViews(fsBuf);
    if (indSab) {
      gpuRenderer.setIndSab(indSab);
      _indSabRef = indSab;
      _indSabHdr = new DataView(indSab);
    }
    hud = hudCanvas.getContext("2d");
    if (!hud)
      throw new Error("Failed to get Canvas 2D context");
    self.postMessage({ type: "ready", format });
    renderLoop();
  } catch (err) {
    console.error("[render_worker] init failed:", err);
    self.postMessage({ type: "error", message: String(err) });
  }
};
function renderLoop() {
  let lastFrameReadyVal = 0;
  const hudHasCommit = typeof hud.commit === "function";
  let firstFrame = true;
  function renderFrame() {
    if (self.requestAnimationFrame) {
      self.requestAnimationFrame(renderFrame);
    } else {
      setTimeout(renderFrame, 16);
    }
    const currentReadyVal = Atomics.load(frameCtrl, FCTRL_READY);
    if (currentReadyVal === lastFrameReadyVal)
      return;
    lastFrameReadyVal = currentReadyVal;
    const viewLen = fdbHdr.getUint32(FBUF_VIEW_LEN, true);
    const physW = fdbHdr.getFloat32(FBUF_CANVAS_W, true);
    const physH = fdbHdr.getFloat32(FBUF_CANVAS_H, true);
    const flags = fdbHdr.getUint32(FBUF_FLAGS, true);
    const ci = workerSlotId;
    const dirtyBits = Atomics.load(ctrl, ci * STRIDE + DIRTY);
    const gpuDirty = (dirtyBits & GPU_DIRTY) !== 0;
    const hudDirty = (dirtyBits & HUD_DIRTY) !== 0;
    if (viewLen < 1 || physW < 4 || physH < 4) {
      Atomics.store(frameCtrl, FCTRL_ACK, lastFrameReadyVal);
      return;
    }
    if (gpuCanvas.width !== physW || gpuCanvas.height !== physH) {
      gpuRenderer.setSize(gpuCanvas, physW, physH);
      hudCanvas.width = physW;
      hudCanvas.height = physH;
      _r64[R_CACHED_PMIN] = NaN;
    }
    const t0_frame = performance.now();
    let t_gpu_ms = 0, t_hud_ms = 0;
    if (gpuDirty || isNaN(_r64[R_CACHED_PMIN])) {
      const t0_gpu = performance.now();
      try {
        const panOffsetPx = i32ToF32(Atomics.load(ctrl, ci * STRIDE + SUBPIXEL_PAN_X));
        const frameStartBar = fdbHdr.getUint32(FBUF_FRAME_START_BAR, true);
        const [pMin, pMax] = gpuRenderer.drawGpu(frameBuf, fdbHdr, viewLen, {
          panOffsetPx,
          extraLeftBars: Math.max(0, fdbHdr.getUint32(FBUF_START_BAR, true) - frameStartBar),
          rightMarginBars: Math.max(0, Atomics.load(ctrl, ci * STRIDE + RIGHT_MARGIN_BARS))
        });
        _r64[R_CACHED_PMIN] = pMin;
        _r64[R_CACHED_PMAX] = pMax;
        if (firstFrame) {
          firstFrame = false;
          console.log("[render_worker] FIRST GPU FRAME | viewLen:", viewLen, "| physW:", physW, "physH:", physH);
        }
      } catch (e) {
        console.error("[render_worker] GPU pass error:", e);
      }
      t_gpu_ms = performance.now() - t0_gpu;
      _r64[R_LAST_GPU_MS] = _r64[R_LAST_GPU_MS] * 0.9 + t_gpu_ms * 0.1;
    }
    if (hudDirty) {
      const t0_hud = performance.now();
      try {
        const pMin = _r64[R_CACHED_PMIN], pMax = _r64[R_CACHED_PMAX];
        const plotW = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_W));
        const plotH = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_H));
        const ptrX = i32ToF32(Atomics.load(ctrl, ci * STRIDE + POINTER_X));
        const ptrY = i32ToF32(Atomics.load(ctrl, ci * STRIDE + POINTER_Y));
        const visBc = Atomics.load(ctrl, ci * STRIDE + 3);
        const rightMarginBars = Math.max(0, Atomics.load(ctrl, ci * STRIDE + RIGHT_MARGIN_BARS));
        const totalSlots = Math.max(1, visBc + rightMarginBars);
        const panOffsetPx = i32ToF32(Atomics.load(ctrl, ci * STRIDE + SUBPIXEL_PAN_X));
        const logicalStartBar = fdbHdr.getUint32(FBUF_START_BAR, true);
        const frameStartBar = fdbHdr.getUint32(FBUF_FRAME_START_BAR, true);
        hud.setTransform(DPR, 0, 0, DPR, 0, 0);
        hud.clearRect(0, 0, plotW, plotH);
        if (!isNaN(pMin)) {
          const layout = gpuRenderer.paneLayout;
          drawPriceAxis(hud, plotW, plotH, pMin, pMax, layout);
          drawDateAxis(hud, plotW, plotH, viewLen);
          if (ptrX >= 0 && ptrY >= 0 && ptrX < plotW && ptrY < plotH) {
            const chartAreaW = plotW - 60;
            const barStep = chartAreaW / totalSlots;
            const offsetSlots = logicalStartBar - frameStartBar + panOffsetPx / Math.max(0.000001, barStep);
            const lIdx = Math.max(0, Math.min(viewLen - 1, Math.floor(ptrX / Math.max(0.000001, barStep) + offsetSlots)));
            let dateLabel = "";
            let popupData = null;
            if (viewLen > 0 && lIdx < viewLen) {
              dateLabel = isoDateStr(_fbTime[lIdx]);
              _popupData.open = _fbOpen[lIdx];
              _popupData.high = _fbHigh[lIdx];
              _popupData.low = _fbLow[lIdx];
              _popupData.close = _fbClose[lIdx];
              _popupData.vol = _fbVol[lIdx];
              _popupData.time = _fbTime[lIdx];
              _readSmaPop(lIdx);
              popupData = _popupData;
            }
            drawCrosshair(hud, plotW, plotH, ptrX, ptrY, pMin, pMax, layout, dateLabel, popupData, flags);
          }
          drawLegend(hud, flags, _readOverlaySummary());
          if (layout)
            drawPaneBorders(hud, plotW, layout);
        }
        if (hudHasCommit)
          hud.commit();
      } catch (e) {
        console.error("[render_worker] HUD error:", e);
      }
      t_hud_ms = performance.now() - t0_hud;
      _r64[R_HUD_MS] = _r64[R_HUD_MS] * 0.9 + t_hud_ms * 0.1;
    }
    const frameMs = performance.now() - t0_frame;
    _r64[R_FRAME_MS] = _r64[R_FRAME_MS] * 0.9 + frameMs * 0.1;
    _statsGpu[_statsHead] = t_gpu_ms;
    _statsHud[_statsHead] = t_hud_ms;
    _statsFrame[_statsHead] = frameMs;
    _statsHead = (_statsHead + 1) % STATS_SIZE;
    if (_statsFilled < STATS_SIZE)
      _statsFilled++;
    if (_statsFilled > 0 && t0_frame - _lastPerfPostTs >= PERF_POST_INTERVAL_MS) {
      _lastPerfPostTs = t0_frame;
      const n = _statsFilled;
      const jsHeapUsedMB = (performance.memory?.usedJSHeapSize ?? 0) / 1048576;
      const jsHeapTotalMB = (performance.memory?.totalJSHeapSize ?? 0) / 1048576;
      if (jsHeapUsedMB > _memPeakJsMB)
        _memPeakJsMB = jsHeapUsedMB;
      self.postMessage({
        type: "perf",
        wasm: { ewma: 0, p50: 0, p95: 0 },
        gpu: { ewma: _r64[R_LAST_GPU_MS], p50: percentile(_statsGpu, n, 50), p95: percentile(_statsGpu, n, 95) },
        hud: { ewma: _r64[R_HUD_MS], p50: percentile(_statsHud, n, 50), p95: percentile(_statsHud, n, 95) },
        frame: { ewma: _r64[R_FRAME_MS], p50: percentile(_statsFrame, n, 50), p95: percentile(_statsFrame, n, 95) },
        visBars: fdbHdr.getUint32(FBUF_VIS_BARS, true),
        mem: { jsHeapUsedMB, jsHeapTotalMB, wasmMB: 0, peakJsHeapMB: _memPeakJsMB, peakWasmMB: 0 }
      });
    }
    Atomics.store(frameCtrl, FCTRL_ACK, lastFrameReadyVal);
  }
  renderFrame();
}
function niceStep(range, ticks) {
  const raw = range / Math.max(1, ticks);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 0.000000001)));
  const r = raw / pow;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * pow;
}
var _dashArray1 = [3, 4];
var _dashArrayEmpty = [];
function drawPriceAxis(ctx, w, h, yMin, yMax, layout) {
  const plotW = w - 60;
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : h;
  const step = niceStep(yMax - yMin, 5);
  if (!isFinite(step) || step <= 0)
    return;
  const first = Math.ceil(yMin / step) * step;
  ctx.save();
  ctx.font = "11px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = first;v <= yMax + 0.000000001; v += step) {
    const y = boundY + (1 - (v - yMin) / (yMax - yMin)) * boundH;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.setLineDash(_dashArray1);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();
    ctx.setLineDash(_dashArrayEmpty);
    ctx.fillStyle = "#555";
    ctx.fillText(v.toFixed(2), w - 4, y);
  }
  ctx.restore();
}
function drawDateAxis(ctx, w, h, viewLen) {
  if (viewLen === 0)
    return;
  const plotW = w - 60;
  const logicalStartBar = fdbHdr.getUint32(FBUF_START_BAR, true);
  const frameStartBar = fdbHdr.getUint32(FBUF_FRAME_START_BAR, true);
  const visBars = Math.max(1, fdbHdr.getUint32(FBUF_VIS_BARS, true));
  const rightMarginBars = Math.max(0, Atomics.load(ctrl, workerSlotId * STRIDE + RIGHT_MARGIN_BARS));
  const totalSlots = Math.max(1, visBars + rightMarginBars);
  const panOffsetPx = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + SUBPIXEL_PAN_X));
  const slotW = plotW / totalSlots;
  const offsetSlots = logicalStartBar - frameStartBar + panOffsetPx / Math.max(0.000001, slotW);
  const times = _fbTime;
  ctx.save();
  ctx.font = "11px monospace";
  ctx.fillStyle = "#888";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const TICKS = 6;
  for (let i = 0;i < TICKS; i++) {
    const frac = i / (TICKS - 1);
    const localSlot = frac * Math.max(0, totalSlots - 1);
    const idx = Math.max(0, Math.min(viewLen - 1, Math.round(localSlot + offsetSlots)));
    const x = (localSlot + 0.5 - panOffsetPx / Math.max(0.000001, slotW)) * slotW;
    ctx.fillText(isoDateStr(times[idx]), x, h - 2);
  }
  ctx.restore();
}
var _dashArrayCrosshair = [4, 4];
var _popupCache = {
  lastBarTime: NaN,
  lastFlags: -1,
  lines: ["", "", "", "", "", "", ""],
  widths: [0, 0, 0, 0, 0, 0, 0],
  lineCount: 0
};
var _priceLabelCache = { last: NaN, str: "" };
function drawCrosshair(ctx, w, h, px, py, yMin, yMax, layout, dateLabel = "", popupData = null, flags = 0) {
  const plotW = w - 60, clampedX = Math.min(px, plotW), DATE_BADGE_H = 16;
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.40)";
  ctx.setLineDash(_dashArrayCrosshair);
  ctx.beginPath();
  ctx.moveTo(clampedX, 0);
  ctx.lineTo(clampedX, dateLabel ? h - DATE_BADGE_H : h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.lineTo(plotW, py);
  ctx.stroke();
  ctx.setLineDash(_dashArrayEmpty);
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : h;
  if (py >= boundY && py <= boundY + boundH) {
    const price = yMax - (py - boundY) / boundH * (yMax - yMin);
    ctx.fillStyle = "#ddd";
    ctx.fillRect(plotW + 1, py - 9, 58, 18);
    ctx.fillStyle = "#222";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    let priceStr;
    if (_priceLabelCache.last !== price) {
      _priceLabelCache.last = price;
      _priceLabelCache.str = price.toFixed(2);
    }
    priceStr = _priceLabelCache.str;
    ctx.fillText(priceStr, w - 4, py);
  }
  if (dateLabel) {
    ctx.font = "10px monospace";
    const tw = ctx.measureText(dateLabel).width, bw = tw + 8;
    const bx = Math.max(0, Math.min(clampedX - bw / 2, plotW - bw));
    const by = h - DATE_BADGE_H;
    ctx.fillStyle = "#ddd";
    ctx.fillRect(bx, by, bw, DATE_BADGE_H);
    ctx.fillStyle = "#222";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dateLabel, bx + 4, by + DATE_BADGE_H / 2);
  }
  if (popupData && py >= boundY && py <= boundY + boundH && px <= plotW) {
    const cursorPrice = yMax - (py - boundY) / boundH * (yMax - yMin);
    const hitMargin = 15 * (yMax - yMin) / Math.max(1, boundH);
    let hit = false;
    if (cursorPrice >= popupData.low - hitMargin && cursorPrice <= popupData.high + hitMargin)
      hit = true;
    if (!hit && flags & 1 && !Number.isNaN(popupData.sma20) && Math.abs(cursorPrice - popupData.sma20) < hitMargin)
      hit = true;
    if (!hit && flags & 2 && !Number.isNaN(popupData.sma50) && Math.abs(cursorPrice - popupData.sma50) < hitMargin)
      hit = true;
    if (!hit && flags & 4 && !Number.isNaN(popupData.sma100) && Math.abs(cursorPrice - popupData.sma100) < hitMargin)
      hit = true;
    if (hit) {
      const barTime = Number.isFinite(popupData.time) ? popupData.time : NaN;
      if (_popupCache.lastBarTime !== barTime || _popupCache.lastFlags !== flags) {
        _popupCache.lastBarTime = barTime;
        _popupCache.lastFlags = flags;
        _popupCache.lines[0] = "Date: " + dateLabel;
        _popupCache.lines[1] = "O: " + popupData.open.toFixed(2) + "  H: " + popupData.high.toFixed(2);
        _popupCache.lines[2] = "L: " + popupData.low.toFixed(2) + "  C: " + popupData.close.toFixed(2);
        _popupCache.lines[3] = "Vol: " + formatVolume(popupData.vol);
        const hasSma20 = flags & 1 && !Number.isNaN(popupData.sma20) && popupData.sma20 > 0;
        const hasSma50 = flags & 2 && !Number.isNaN(popupData.sma50) && popupData.sma50 > 0;
        const hasSma100 = flags & 4 && !Number.isNaN(popupData.sma100) && popupData.sma100 > 0;
        _popupCache.lineCount = 4 + (hasSma20 ? 1 : 0) + (hasSma50 ? 1 : 0) + (hasSma100 ? 1 : 0);
        _popupCache.lines[4] = hasSma20 ? smaPrefix1 + " " + popupData.sma20.toFixed(2) : "";
        _popupCache.lines[5] = hasSma50 ? smaPrefix2 + " " + popupData.sma50.toFixed(2) : "";
        _popupCache.lines[6] = hasSma100 ? smaPrefix3 + " " + popupData.sma100.toFixed(2) : "";
        ctx.font = "11px monospace";
        _popupCache.widths[0] = ctx.measureText(_popupCache.lines[0]).width;
        _popupCache.widths[1] = ctx.measureText(_popupCache.lines[1]).width;
        _popupCache.widths[2] = ctx.measureText(_popupCache.lines[2]).width;
        _popupCache.widths[3] = ctx.measureText(_popupCache.lines[3]).width;
        _popupCache.widths[4] = _popupCache.lines[4] ? ctx.measureText(_popupCache.lines[4]).width : 0;
        _popupCache.widths[5] = _popupCache.lines[5] ? ctx.measureText(_popupCache.lines[5]).width : 0;
        _popupCache.widths[6] = _popupCache.lines[6] ? ctx.measureText(_popupCache.lines[6]).width : 0;
      }
      let maxTw = 0;
      for (let i = 0;i < _popupCache.lineCount; i++) {
        maxTw = Math.max(maxTw, _popupCache.widths[i] || 0);
      }
      const lineCount = _popupCache.lineCount;
      const boxW = maxTw + 12;
      const boxH = lineCount * 16 + 8;
      const boxX = px + 10 + boxW < plotW ? px + 10 : px - 10 - boxW;
      const boxY = Math.max(boundY + 4, Math.min(py - boxH / 2, boundY + boundH - boxH - 4));
      ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.setLineDash(_dashArrayEmpty);
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let row = 0;
      for (let i = 0;i < _popupCache.lineCount; i++) {
        if (i === 4)
          ctx.fillStyle = "#00BCD4";
        else if (i === 5)
          ctx.fillStyle = "#FFC107";
        else if (i === 6)
          ctx.fillStyle = "#E91E63";
        else
          ctx.fillStyle = "#222";
        const text = _popupCache.lines[i];
        if (text)
          ctx.fillText(text, boxX + 6, boxY + 6 + row * 16);
        row++;
      }
    }
  }
}
function formatVolume(v) {
  if (v >= 1e9)
    return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6)
    return (v / 1e6).toFixed(2) + "M";
  if (v >= 1000)
    return (v / 1000).toFixed(2) + "K";
  return v.toString();
}
function drawPaneBorders(ctx, plotW, layout) {
  if (!layout)
    return;
  ctx.save();
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  ctx.setLineDash(_dashArrayEmpty);
  const gap = (layout.gap || 0) / DPR;
  if (layout.sub1 && gap > 0) {
    const yTop = layout.sub1.y / DPR - gap;
    const yBot = layout.sub1.y / DPR;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, yTop, plotW + 60, gap);
    ctx.beginPath();
    ctx.moveTo(0, yTop);
    ctx.lineTo(plotW + 60, yTop);
    ctx.moveTo(0, yBot);
    ctx.lineTo(plotW + 60, yBot);
    ctx.stroke();
  }
  if (layout.sub2 && gap > 0) {
    const yTop = layout.sub2.y / DPR - gap;
    const yBot = layout.sub2.y / DPR;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, yTop, plotW + 60, gap);
    ctx.beginPath();
    ctx.moveTo(0, yTop);
    ctx.lineTo(plotW + 60, yTop);
    ctx.moveTo(0, yBot);
    ctx.lineTo(plotW + 60, yBot);
    ctx.stroke();
  }
  ctx.restore();
}
function drawLegend(ctx, flags, overlaySummary) {
  ctx.save();
  ctx.font = "bold 12px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#222";
  ctx.fillText("MSFT", 8, 8);
  ctx.font = "11px sans-serif";
  let x = 52;
  for (let i = 0;i < LEGEND_ENTRIES.length; i++) {
    const { bit, label, color } = LEGEND_ENTRIES[i];
    if (!(flags & bit))
      continue;
    ctx.fillStyle = color;
    ctx.fillText(label, x, 9);
    x += ctx.measureText(label).width + 12;
  }
  if (_r64[R_LAST_GPU_MS] > 0) {
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(`GPU ~${_r64[R_LAST_GPU_MS].toFixed(1)}ms`, x, 9);
    x += 78;
  }
  if (overlaySummary && overlaySummary[0] > 0) {
    const total = overlaySummary[0] >>> 0;
    const marker = overlaySummary[1] >>> 0;
    const hline = overlaySummary[2] >>> 0;
    const zone = overlaySummary[3] >>> 0;
    const text = overlaySummary[4] >>> 0;
    const event = overlaySummary[5] >>> 0;
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(`ANN ${total} M${marker} H${hline} Z${zone} T${text} E${event}`, x, 9);
  }
  ctx.restore();
}

//# debugId=501E66390988FD9364756E2164756E21
//# sourceMappingURL=renderWorker.js.map
