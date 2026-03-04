/**
 * shared_protocol.js — SharedArrayBuffer layout for Mochart WASM demo
 *
 * Layout per chart (STRIDE × 4 bytes = 64 bytes):
 *
 *   Offset  Field       Type       Description
 *   ──────  ─────────── ─────────  ──────────────────────────────────────────
 *   0       WAKE        i32        Frame counter. Main writes, Worker reads.
 *                                  Atomics.notify wakes the Worker.
 *   1       READY       i32        Completion counter. Worker writes after render.
 *   2       START_BAR   i32        First visible bar index (integer).
 *   3       VIS_BARS    i32        Number of visible bars (integer).
 *   4       PLOT_W      f32→i32    Canvas CSS width in pixels (bitwise i32).
 *   5       PLOT_H      f32→i32    Canvas CSS height in pixels (bitwise i32).
 *   6       POINTER_X   f32→i32    Pointer X in CSS px, or -1 when absent.
 *   7       POINTER_Y   f32→i32    Pointer Y in CSS px, or -1 when absent.
 *   8       FLAGS       i32        Bitfield: bit0=sma20, bit1=sma50, bit2=sma100, bit3=at_right, bit4=heatmap
 *   9-15    (reserved)  —          Future use (e.g. zoom target, layout hints).
 *
 * Float values (PLOT_W/H, POINTER_X/Y) are stored as their raw IEEE-754 bit
 * pattern cast to i32. Use f32ToI32 / i32ToF32 to convert.
 * This avoids Float32Array aliasing issues with Atomics (Atomics only works on
 * Int32Array / BigInt64Array).
 */

/** Int32 slots per chart (= 64 bytes). Keep as power-of-two. */
export const STRIDE = 16;

// Field offsets within one chart's stride block:
export const WAKE      = 0;
export const READY     = 1;
export const START_BAR = 2;
export const VIS_BARS  = 3;
export const PLOT_W    = 4;
export const PLOT_H    = 5;
export const POINTER_X = 6;
export const POINTER_Y = 7;
export const FLAGS     = 8;
/**
 * DIRTY — bitfield written by Main Thread before Atomics.notify.
 *   bit 0 (GPU_DIRTY = 1): candles + indicator lines must be re-rendered.
 *               Triggered by startBar / visBars / plotW / plotH / flags change.
 *   bit 1 (HUD_DIRTY = 2): axes / crosshair / legend must be redrawn.
 *               Always set when GPU_DIRTY; also set on pointer move alone.
 * Both zero → Worker received a spurious wake (should not occur), skip frame.
 */
export const DIRTY     = 9;
export const GPU_DIRTY = 1;  // bit 0
export const HUD_DIRTY = 2;  // bit 1

/**
 * FLAGS bitfield definitions:
 *   bits 0-2: SMA indicator toggles (sma20=1, sma50=2, sma100=4)
 *   bit 3 (AT_RIGHT_EDGE = 0x08): viewport is at the newest bar (right edge).
 *     When set, the renderer adds a right-side future margin (~10% of width).
 *     Cleared when the user pans left (away from the right edge).
 */
export const AT_RIGHT_EDGE = 0x08;  // FLAGS bit 3

// ── f32 ↔ i32 bitwise conversion (no allocation) ─────────────────────────
// Atomics.store/load only accepts Int32Array, so floats are stored as raw bits.

const _cvt = new DataView(new ArrayBuffer(4));

/** Pack an f32 into its IEEE-754 bit pattern as a signed i32. */
export function f32ToI32(f) {
  _cvt.setFloat32(0, f, /*littleEndian=*/true);
  return _cvt.getInt32(0, /*littleEndian=*/true);
}

/** Unpack a signed i32 back to its IEEE-754 f32 value. */
export function i32ToF32(i) {
  _cvt.setInt32(0, i, /*littleEndian=*/true);
  return _cvt.getFloat32(0, /*littleEndian=*/true);
}

/**
 * Allocate a new SharedArrayBuffer large enough for `n` charts.
 * @param {number} n Number of charts (default 1).
 * @returns {SharedArrayBuffer}
 */
export function allocCtrlBuf(n = 1) {
  return new SharedArrayBuffer(STRIDE * 4 * n);
}

// ── Frame SAB (data_worker → render_worker, zero-copy SoA transfer) ──────
//
// Fixed-capacity SharedArrayBuffer shared between data_worker (write) and
// render_worker (read).  Updated every frame; render_worker waits on
// frameCtrl before reading.
//
// Layout (EP mode — legacy SMA channels removed):
//   Bytes 0-127:  FDB header (scalar fields, 4 bytes each unless noted)
//   Bytes 128+:   SoA float32 channels (open/high/low/close/vol)
//   Bytes 128+5×stride: Time channel (float64, 8 bytes each)
//
// Legacy layout (SMA channels present) is retained via FBUF_SMA*_OFF constants
// but allocFrameBuf() now uses the compact layout by default.

/** Maximum visible bars supported (must equal or exceed any visBars value). */
export const FRAME_MAX_BARS = 4096;

// ── FDB header byte offsets (128B, #[repr(C, align(16))]) ─────────────────
// Must match Rust FrameDescriptor layout in store.rs exactly.
// vec4<u32> #0 (bytes 0-15)
export const FBUF_START_BAR  =  0;  // u32 — first visible bar index
export const FBUF_VIS_BARS   =  4;  // u32 — requested visible bar count
export const FBUF_VIEW_LEN   =  8;  // u32 — actual decompressed bar count
export const FBUF_FLAGS      = 12;  // u32 — indicator toggle flags
// vec4<u32> #1 (bytes 16-31) — WASM view pointers (internal, not read by JS)
// view_open_ptr=16, view_high_ptr=20, view_low_ptr=24, view_close_ptr=28
// vec4<u32> #2 (bytes 32-47)
// view_vol_ptr=32
export const FBUF_SEQ        = 36;  // u32 — monotone frame counter
export const FBUF_TOTAL_BARS = 40;  // u32 — store.len() (total ingested bars)
// _pad0=44
// vec4<f32> #3 (bytes 48-63)
export const FBUF_PRICE_MIN  = 48;  // f32 — view_price_min()
export const FBUF_PRICE_MAX  = 52;  // f32 — view_price_max()
export const FBUF_CANVAS_W   = 56;  // f32 — physical canvas width (px)
export const FBUF_CANVAS_H   = 60;  // f32 — physical canvas height (px)
// vec4<f32/u32> #4 (bytes 64-79)
export const FBUF_CANDLE_W   = 64;  // f32 — candle body width (px)
export const FBUF_DPR        = 68;  // f32 — device pixel ratio
export const FBUF_CACHE_VALID = 72; // u32 — bitmask of valid caches
export const FBUF_DIRTY_START = 76; // u32 — dirty range start bar
// vec4<u32> #5 (bytes 80-95)
export const FBUF_DIRTY_END      = 80;  // u32 — dirty range end bar
export const FBUF_INDICATOR_GEN  = 84;  // u32 — indicator generation counter
// bytes 88-127 reserved

export const FBUF_HDR_BYTES = 128;

// ── SoA channel byte offsets (float32, 4 bytes each) ─────────────────────
const _FBUF_F32_STRIDE = FRAME_MAX_BARS * 4;  // bytes per f32 channel (16 384 B)
export const FBUF_OPEN_OFF   = FBUF_HDR_BYTES + 0 * _FBUF_F32_STRIDE;  // 128
export const FBUF_HIGH_OFF   = FBUF_HDR_BYTES + 1 * _FBUF_F32_STRIDE;  // 16 512
export const FBUF_LOW_OFF    = FBUF_HDR_BYTES + 2 * _FBUF_F32_STRIDE;  // 32 896
export const FBUF_CLOSE_OFF  = FBUF_HDR_BYTES + 3 * _FBUF_F32_STRIDE;  // 49 280
export const FBUF_VOL_OFF    = FBUF_HDR_BYTES + 4 * _FBUF_F32_STRIDE;  // 65 664
// Legacy indicator channels — REMOVED in compact EP layout.
// These constants now alias the Time channel region (FBUF_TIME_OFF).
// They are retained ONLY for backward compatibility with gpu_renderer's
// `!this.indSab` fallback path, which is dead code when EP is active.
// DO NOT write to these offsets — they overlap with FBUF_TIME_OFF.
// @deprecated - legacy SMA channels removed; EP indicator data lives in indSAB.
export const FBUF_SMA20_OFF  = FBUF_HDR_BYTES + 5 * _FBUF_F32_STRIDE;  // 82 048 (ALIASES FBUF_TIME_OFF!)
export const FBUF_SMA50_OFF  = FBUF_HDR_BYTES + 6 * _FBUF_F32_STRIDE;  // 98 432
export const FBUF_SMA100_OFF = FBUF_HDR_BYTES + 7 * _FBUF_F32_STRIDE;  // 114 816
// Time channel — compact layout: immediately after vol (ch 5), not ch 8.
// EP mode saves 3 × 16 KB = 48 KB by eliminating legacy SMA channels.
export const FBUF_TIME_OFF   = FBUF_HDR_BYTES + 5 * _FBUF_F32_STRIDE;  // 82 048
const _FRAME_TIME_BYTES = FRAME_MAX_BARS * 8;                            // 32 768 B
/** Total byte size of the frame SharedArrayBuffer (compact EP layout ≈ 112 KB). */
export const FRAME_BUF_BYTES = FBUF_TIME_OFF + _FRAME_TIME_BYTES;       // 114 816 B ≈ 112 KB

/**
 * Allocate the SharedArrayBuffer for frame SoA data (data_worker → render_worker).
 * @returns {SharedArrayBuffer}
 */
export function allocFrameBuf() {
  return new SharedArrayBuffer(FRAME_BUF_BYTES);
}

// ── frameCtrl SAB (data_worker ↔ render_worker, 4 × i32) ──────────────────
//
// Slot  0  FCTRL_READY: data_worker stores seq here; render_worker waitAsync on this.
// Slot  1  FCTRL_ACK:   render_worker stores = READY val when frame consumed.
// Slot  2  FCTRL_SEQ:   replica of READY (human-readable counter).
export const FCTRL_STRIDE = 4;   // i32 slots in frameCtrl SAB
export const FCTRL_READY  = 0;
export const FCTRL_ACK    = 1;
export const FCTRL_SEQ    = 2;

/**
 * Allocate the SharedArrayBuffer for data→render frame synchronisation.
 * @returns {SharedArrayBuffer}
 */
export function allocFrameCtrl() {
  return new SharedArrayBuffer(FCTRL_STRIDE * 4);  // 16 bytes
}

// ── indSAB (data_worker → render_worker, EP indicator arena + render cmds) ────
//
// Single SharedArrayBuffer carrying the ExecutionPlan arena (f32 array) and
// a compact render-command table so render_worker knows what to draw.
//
// Layout:
//   Bytes     0 – INDSAB_HDR_BYTES-1 : Header (scalars + packed render cmds)
//   Bytes INDSAB_HDR_BYTES – end      : f32 arena  (= ExecutionPlan arena)
//
// ── Header scalars (4-byte u32 each) ─────────────────────────────────────────
export const INDSAB_SEQ_OFF   = 0;   // u32 — monotone seq; render_worker Atomics.waitAsync on this
export const INDSAB_ARENA_LEN = 4;   // u32 — f32 count written into the arena section
export const INDSAB_CMD_COUNT = 8;   // u32 — number of render commands
export const INDSAB_REVISION  = 12;  // u32 — plan revision; render_worker rebuilds pipelines if changed

/** Maximum number of render commands (= max indicator slots × sub-slots). */
export const MAX_RENDER_CMDS  = 32;

/**
 * Maximum arena f32 values (upper bound for validation).
 * Actual allocation should use `plan.arena_len()` from the ExecutionPlan.
 * @deprecated Use plan.arena_len() for right-sized allocation.
 */
export const MAX_ARENA_F32    = FRAME_MAX_BARS * MAX_RENDER_CMDS;  // 131 072

/** Byte size of the indSAB header section (page-aligned). */
export const INDSAB_HDR_BYTES = 4096;

// ── Render-cmd table (packed in header starting at INDSAB_CMD_BASE) ──────────
//   64 bytes per cmd, layout:
//   +0   slot_id       u32
//   +4   arena_offset  u32   — index into arena array (f32 index, not byte)
//   +8   bar_count     u32
//   +12  warmup        u32   — leading bars to skip (pre-history removed most of these)
//   +16  color_r       f32
//   +20  color_g       f32
//   +24  color_b       f32
//   +28  color_a       f32
//   +32  style         u32   — 0=Line, 1=ThickLine, 2=Histogram, 3=Band
//   +36  pane          u32   — 0=Main, 1=Sub1, 2=Sub2
//   +40  band_alt_off  u32   — arena_offset of lower band (used when style=Band)
//   +44  line_width    f32   — line width in px
//   +48  flag_mask     u32   — FLAGS bitmask bit(s) that must be set to render; 0 = always visible
//   +52  _reserved     12 B
export const INDSAB_CMD_BASE         = 16;   // first cmd at byte 16 in header
export const INDSAB_CMD_STRIDE       = 64;   // bytes per cmd record
export const INDSAB_CMD_SLOT_ID      = 0;
export const INDSAB_CMD_ARENA_OFFSET = 4;
export const INDSAB_CMD_BAR_COUNT    = 8;
export const INDSAB_CMD_WARMUP       = 12;
export const INDSAB_CMD_COLOR_R      = 16;
export const INDSAB_CMD_COLOR_G      = 20;
export const INDSAB_CMD_COLOR_B      = 24;
export const INDSAB_CMD_COLOR_A      = 28;
export const INDSAB_CMD_STYLE        = 32;
export const INDSAB_CMD_PANE         = 36;
export const INDSAB_CMD_BAND_ALT_OFF = 40;
export const INDSAB_CMD_LINE_WIDTH   = 44;
export const INDSAB_CMD_FLAG_MASK    = 48;  // u32 — FLAGS bitmask; 0 = always render
export const INDSAB_CMD_VALUE_MIN    = 52;  // f32 — finite min of output slice (padded)
export const INDSAB_CMD_VALUE_MAX    = 56;  // f32 — finite max of output slice (padded)
// +60..+63 _reserved (4 B)

/** Byte offset where the f32 arena data starts in the indSAB. */
export const INDSAB_ARENA_OFF = INDSAB_HDR_BYTES;

/**
 * Total byte size of the indicator SharedArrayBuffer when using the legacy
 * upper-bound allocation (~528 KB).
 * @deprecated Prefer `allocIndSab(arenaF32Count)` for right-sized allocation.
 */
export const INDSAB_BYTES = INDSAB_ARENA_OFF + MAX_ARENA_F32 * 4;

/**
 * Allocate the SharedArrayBuffer for EP indicator data (data_worker → render_worker).
 *
 * When `arenaF32Count` is provided (from `plan.arena_len()` after compile),
 * the SAB is right-sized to exactly `INDSAB_HDR_BYTES + arenaF32Count * 4` bytes.
 * This can reduce allocation from ~528 KB to ~20 KB for typical configurations.
 *
 * @param {number} [arenaF32Count] — exact arena f32 count from EP compile.
 *   Omit to use the legacy upper-bound allocation (MAX_ARENA_F32).
 * @returns {SharedArrayBuffer}
 */
export function allocIndSab(arenaF32Count) {
  const arenaBytes = (arenaF32Count != null ? arenaF32Count : MAX_ARENA_F32) * 4;
  return new SharedArrayBuffer(INDSAB_ARENA_OFF + arenaBytes);
}
