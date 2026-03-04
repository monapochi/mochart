/**
 * data_worker.js — Data Worker for Mochart P1 Parallel Pipeline
 *
 * Role: owns the WASM instance (OhlcvStore + ExecutionPlan).
 *   1. Fetch OHLCV binary and ingest into OhlcvStore.
 *   2. Wait for viewport events from main thread (SharedArrayBuffer ctrl).
 *   3. Decompress view window + execute ExecutionPlan (all indicators, CPU-side).
 *   4. Copy WASM arena + render-cmd metadata to indSAB.
 *   5. Copy OHLCV SoA + FDB scalars into frameBuf (SharedArrayBuffer).
 *   6. Signal render_worker via frameCtrl Atomics.notify.
 *
 * No WebGPU, no Canvas 2D — pure data processing.
 *
 * Message protocol (from main thread):
 *   { type: 'init', ctrl: SharedArrayBuffer, frameCtrl: SharedArrayBuffer,
 *     frameBuf: SharedArrayBuffer, indSab: SharedArrayBuffer }
 *
 * Message protocol (to main thread):
 *   { type: 'ready', bars: number }   — after successful fetch + ingest
 *   { type: 'error', message: string } — on failure
 */

// Dynamically import the wasm pkg at runtime so we can catch module evaluation
// errors and surface them to the main thread. The static import previously
// executed during module evaluation and could throw before our global
// handlers were registered.
const WASM_MODULE_PATH = '../pkg/mochart_wasm_new.js';
let WasmModule = null; // will hold the imported module namespace

import {
  STRIDE, WAKE, READY, START_BAR, VIS_BARS,
  PLOT_W, PLOT_H, FLAGS,
  DIRTY, GPU_DIRTY, HUD_DIRTY,
  i32ToF32,
  FRAME_MAX_BARS,
  FBUF_START_BAR, FBUF_VIS_BARS, FBUF_VIEW_LEN,
  FBUF_PRICE_MIN, FBUF_PRICE_MAX,
  FBUF_CANVAS_W, FBUF_CANVAS_H, FBUF_CANDLE_W,
  FBUF_FLAGS, FBUF_SEQ, FBUF_TOTAL_BARS,
  FBUF_HDR_BYTES,
  FBUF_OPEN_OFF, FBUF_HIGH_OFF, FBUF_LOW_OFF, FBUF_CLOSE_OFF, FBUF_VOL_OFF,
  FBUF_TIME_OFF,
  FCTRL_READY,
  // indSAB
  INDSAB_SEQ_OFF, INDSAB_ARENA_LEN, INDSAB_CMD_COUNT, INDSAB_REVISION,
  INDSAB_CMD_BASE, INDSAB_CMD_STRIDE,
  INDSAB_CMD_SLOT_ID, INDSAB_CMD_ARENA_OFFSET, INDSAB_CMD_BAR_COUNT, INDSAB_CMD_WARMUP,
  INDSAB_CMD_COLOR_R, INDSAB_CMD_COLOR_G, INDSAB_CMD_COLOR_B, INDSAB_CMD_COLOR_A,
  INDSAB_CMD_STYLE, INDSAB_CMD_PANE, INDSAB_CMD_BAND_ALT_OFF, INDSAB_CMD_LINE_WIDTH,
  INDSAB_CMD_FLAG_MASK, INDSAB_CMD_VALUE_MIN, INDSAB_CMD_VALUE_MAX,
  INDSAB_ARENA_OFF,
} from './shared_protocol.js';

// DPR is set from the main thread's init message (self.devicePixelRatio is
// unreliable in Workers — may be undefined or 1 depending on browser version).
let DPR = Math.ceil(self.devicePixelRatio || 2);

// Global handlers to surface unexpected errors to the main thread
self.addEventListener('error', (ev) => {
  try {
    const msg = ev.message || String(ev);
    console.error('[data_worker] global error:', ev);
    self.postMessage({ type: 'error', message: String(msg) });
  } catch (e) {
    // swallow
  }
});

self.addEventListener('unhandledrejection', (ev) => {
  try {
    console.error('[data_worker] unhandledrejection:', ev);
    const reason = ev.reason ? (ev.reason.stack || String(ev.reason)) : 'unknown';
    self.postMessage({ type: 'error', message: String(reason) });
  } catch (e) {
    // swallow
  }
});

// ── Module-level state ────────────────────────────────────────────────────
/** @type {Int32Array} */   let ctrl;
/** @type {Int32Array} */   let frameCtrl;
/** @type {DataView} */     let fdbView;       // DataView on frameBuf header
/** @type {OhlcvStore} */   let store;
/** @type {ExecutionPlan} */ let plan;
/** @type {WebAssembly.Memory} */ let wasmMemory;
/** Total ingested bar count (set once after fetch). */
let totalBars = 0;
/** Monotone frame counter written to FBUF_SEQ and FCTRL_READY. */
let frameSeq = 0;

// ── Typed array views on frameBuf (set once at init, zero-alloc per frame) ──
/** @type {SharedArrayBuffer} */ let frameSAB;
/** @type {SharedArrayBuffer} */ let indSab;
/** @type {DataView} */          let indHdrView;  // DataView on entire indSAB
/** @type {Uint32Array|null} */  let slotFlagMask = null;  // slot_id → FLAGS bitmask (0=always render)

// ── Pre-allocated SoA destination views (FRAME_MAX_BARS capacity) ──────────
// Created once when frameSAB is received; .set(src) copies exactly src.length
// elements, so the over-sized view is safe. Eliminates 6× TypedArray per frame.
/** @type {Float32Array} */ let _dstOpen;
/** @type {Float32Array} */ let _dstHigh;
/** @type {Float32Array} */ let _dstLow;
/** @type {Float32Array} */ let _dstClose;
/** @type {Float32Array} */ let _dstVol;
/** @type {Float64Array} */ let _dstTime;

// ── Cached WASM memory views (refreshed only when memory.buffer identity changes) ──
// After memory.grow(), the old ArrayBuffer is detached; we must detect and
// recreate views. This avoids 6× TypedArray construction per frame in steady state.
/** @type {ArrayBuffer|null} */   let _lastWasmBuf = null;
/** @type {Float32Array|null} */  let _wasmF32 = null;
/** @type {Float64Array|null} */  let _wasmF64 = null;

// Cached indSAB arena destination view — re-created only when arenaLen grows.
/** @type {Float32Array|null} */  let _dstArena = null;
/** @type {number} */             let _dstArenaCap = 0;

/** Refresh cached WASM memory views if the backing buffer has been detached. */
function _refreshWasmViews() {
  const buf = wasmMemory.buffer;
  if (buf !== _lastWasmBuf) {
    _lastWasmBuf = buf;
    _wasmF32 = new Float32Array(buf);
    _wasmF64 = new Float64Array(buf);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function buildPlan(sma1, sma2, sma3) {
  if (plan && plan.free) {
    plan.free();
  }
  plan = new WasmModule.ExecutionPlan();
  plan.add_indicator(/*SMA*/0, sma1, /*pane*/0, /*ThickLine*/1, 0.00, 0.56, 0.73, 1.0, 1.5);
  plan.add_indicator(/*SMA*/0, sma2, /*pane*/0, /*ThickLine*/1, 1.00, 0.76, 0.03, 1.0, 1.5);
  plan.add_indicator(/*SMA*/0, sma3, /*pane*/0, /*ThickLine*/1, 0.91, 0.12, 0.39, 1.0, 1.5);
  plan.add_indicator(/*RSI*/3, 14,  /*pane*/1, /*ThickLine*/1, 0.61, 0.35, 0.71, 1.0, 1.5);
  plan.add_indicator(/*MACD*/4, 12, /*pane*/1, /*ThickLine*/1, 0.16, 0.50, 0.73, 1.0, 1.5);
  plan.add_indicator(/*Volume*/7, 0, /*pane*/2, /*Histogram*/2, 0.20, 0.60, 0.90, 0.8, 1.0);
  plan.compile(200);   // initial compile with default vis_count; recompiles if vis_bars changes

  // Map slot_id → FLAGS bitmask (0 = always render).
  // This must match the order of add_indicator() calls above.
  slotFlagMask = new Uint32Array(64);
  slotFlagMask[0] = 1;   // SMA1   → FLAGS bit 0
  slotFlagMask[1] = 2;   // SMA2   → FLAGS bit 1
  slotFlagMask[2] = 4;   // SMA3   → FLAGS bit 2
  slotFlagMask[3] = 32;  // RSI14  → FLAGS bit 5 (0x20)
  slotFlagMask[4] = 64;  // MACD   → FLAGS bit 6 (0x40)
  slotFlagMask[5] = 128; // Volume → FLAGS bit 7 (0x80)
}

self.onmessage = async (evt) => {
  if (evt.data.type === 'update_sma') {
    if (plan && WasmModule) {
      buildPlan(evt.data.sma1, evt.data.sma2, evt.data.sma3);
      // Wait for next frame request to re-execute and render
    }
    return;
  }
  if (evt.data.type !== 'init') return;
  const { ctrl: ctrlBuf, frameCtrl: frameCtrlBuf, frameBuf, indSab: indSabBuf } = evt.data;
  // Use authoritative DPR from main thread
  if (typeof evt.data.dpr === 'number' && evt.data.dpr >= 1) {
    DPR = Math.ceil(evt.data.dpr);
  }
  console.log('[data_worker] DPR:', DPR);
  ctrl      = new Int32Array(ctrlBuf);
  frameCtrl = new Int32Array(frameCtrlBuf);
  frameSAB  = frameBuf;
  indSab    = indSabBuf;
  fdbView   = new DataView(frameBuf, 0, FBUF_HDR_BYTES);
  indHdrView = new DataView(indSab);

  // Pre-allocate max-capacity destination views — created once, reused every frame.
  _dstOpen  = new Float32Array(frameSAB, FBUF_OPEN_OFF,  FRAME_MAX_BARS);
  _dstHigh  = new Float32Array(frameSAB, FBUF_HIGH_OFF,  FRAME_MAX_BARS);
  _dstLow   = new Float32Array(frameSAB, FBUF_LOW_OFF,   FRAME_MAX_BARS);
  _dstClose = new Float32Array(frameSAB, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
  _dstVol   = new Float32Array(frameSAB, FBUF_VOL_OFF,   FRAME_MAX_BARS);
  _dstTime  = new Float64Array(frameSAB, FBUF_TIME_OFF,  FRAME_MAX_BARS);

  try {
    // 1. Dynamically import and initialize WASM module
    WasmModule = await import(WASM_MODULE_PATH);
    // `WasmModule` may export a default init() function (wasm-bindgen glue)
    const initFn = WasmModule.default ?? WasmModule.init ?? null;
    const wasmExports = initFn ? await initFn() : WasmModule;
    wasmMemory = wasmExports.memory;

    // 2. Fetch OHLCV binary and ingest (uses WasmModule.OhlcvStore)
    const { store: s, barCount } = await loadBinaryOhlcv('../MSFT.bin', wasmMemory);
    store     = s;
    totalBars = barCount;
    console.log(`[data_worker] ingested ${barCount} bars`);

    // 3. Create ExecutionPlan with indicators.
    //    SMA 1/2/3 mirror the existing FLAGS bit 0/1/2 toggles.
    //    RSI(14) on Sub1, MACD(12,26,9) on Sub1 — new FLAGS bits 5/6.
    //    Kind: SMA=0, EMA=1, BB=2, RSI=3, MACD=4, ATR=5, OBV=6
    //    Style: Line=0, ThickLine=1, Histogram=2, Band=3
    buildPlan(5, 25, 75);
    console.log('[data_worker] ExecutionPlan compiled |',
      'slots:', plan.slot_count(), '| revision:', plan.revision());

    // 4. Report ready
    self.postMessage({ type: 'ready', bars: barCount });

    // 5. Begin data loop
    dataLoop();
  } catch (err) {
    console.error('[data_worker] init failed:', err);
    self.postMessage({ type: 'error', message: String(err) });
  }
};

// ── Data loop ─────────────────────────────────────────────────────────────
async function dataLoop() {
  const ci = 0;
  let lastWake = 0;

  while (true) {
    // Wait for main thread to increment WAKE via Atomics.notify
    await Atomics.waitAsync(ctrl, ci * STRIDE + WAKE, lastWake).value;
    lastWake = Atomics.load(ctrl, ci * STRIDE + WAKE);

    // Read dirty bits
    const dirtyBits = Atomics.load(ctrl, ci * STRIDE + DIRTY);
    if (!((dirtyBits & GPU_DIRTY) || (dirtyBits & HUD_DIRTY))) continue;

    // Read viewport
    const startBar = Atomics.load(ctrl, ci * STRIDE + START_BAR);
    const visBars  = Atomics.load(ctrl, ci * STRIDE + VIS_BARS);
    const plotW    = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_W));
    const plotH    = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_H));
    const flags    = Atomics.load(ctrl, ci * STRIDE + FLAGS);

    if (plotW < 4 || plotH < 4 || visBars < 1) continue;

    const physW = Math.round(plotW * DPR);
    const physH = Math.round(plotH * DPR);

    // ── Decompress view window ──────────────────────────────────────────
    store.decompress_view_window(startBar, visBars);
    const viewLen = store.view_len();

    // Candle width: 80% of slot in physical pixels, clamped [2px, 40px]
    const candleW = visBars > 0
      ? Math.max(2 * DPR, Math.min(40 * DPR, (physW / visBars) * 0.8))
      : 2 * DPR;

    const priceMin = store.view_price_min();
    const priceMax = store.view_price_max();

    // ── ExecutionPlan: recompile if visible bar count changed ───────────
    if (plan.needs_recompile(viewLen)) {
      plan.compile(viewLen);
    }

    // ── ExecutionPlan: execute all indicators CPU-side ──────────────────
    // execute() internally decompresses the pre-history window for each
    // indicator's warmup, then writes results into the WASM arena.
    // execute() uses only range-read APIs (decompress_*_range_to / view_*_slice)
    // and never calls decompress_view_window(), so the view window remains valid.
    if (viewLen > 0) {
      plan.execute(store);
      _writeIndSab(visBars, plan.revision());
    }

    const viewLen2 = viewLen;

    // ── Copy SoA to frameBuf (zero-alloc destination, cached WASM views) ────
    if (viewLen2 > 0) {
      _refreshWasmViews();
      // Source pointers are byte offsets; shift to f32/f64 element indices.
      const oOff = store.view_open_ptr()   >> 2;
      const hOff = store.view_high_ptr()   >> 2;
      const lOff = store.view_low_ptr()    >> 2;
      const cOff = store.view_close_ptr()  >> 2;
      const vOff = store.view_volume_ptr() >> 2;
      const tOff = store.view_time_ptr()   >> 3;  // f64 → /8
      // .set(src) copies src.length elements into the pre-allocated dst.
      // subarray() returns a lightweight view (no data copy, ~64B object).
      _dstOpen .set(_wasmF32.subarray(oOff, oOff + viewLen2));
      _dstHigh .set(_wasmF32.subarray(hOff, hOff + viewLen2));
      _dstLow  .set(_wasmF32.subarray(lOff, lOff + viewLen2));
      _dstClose.set(_wasmF32.subarray(cOff, cOff + viewLen2));
      _dstVol  .set(_wasmF32.subarray(vOff, vOff + viewLen2));
      _dstTime .set(_wasmF64.subarray(tOff, tOff + viewLen2));
    }

    // ── Write FDB header ───────────────────────────────────────────────
    frameSeq++;
    fdbView.setUint32 (FBUF_START_BAR,  startBar,  true);
    fdbView.setUint32 (FBUF_VIS_BARS,   visBars,   true);
    fdbView.setUint32 (FBUF_VIEW_LEN,   viewLen2,  true);
    fdbView.setFloat32(FBUF_PRICE_MIN,  priceMin,  true);
    fdbView.setFloat32(FBUF_PRICE_MAX,  priceMax,  true);
    fdbView.setFloat32(FBUF_CANVAS_W,   physW,     true);
    fdbView.setFloat32(FBUF_CANVAS_H,   physH,     true);
    fdbView.setFloat32(FBUF_CANDLE_W,   candleW,   true);
    fdbView.setUint32 (FBUF_FLAGS,      flags,     true);
    fdbView.setUint32 (FBUF_SEQ,        frameSeq,  true);
    fdbView.setUint32 (FBUF_TOTAL_BARS, totalBars, true);

    // ── Signal render_worker — frame is ready ─────────────────────────
    Atomics.store(frameCtrl, FCTRL_READY, frameSeq);
    Atomics.notify(frameCtrl, FCTRL_READY);

    // Signal main thread that this data frame is consumed
    Atomics.store(ctrl, ci * STRIDE + READY, lastWake);
    Atomics.notify(ctrl, ci * STRIDE + READY);
  }
}

// ── EP arena → indSAB write ───────────────────────────────────────────────
/**
 * Copy the ExecutionPlan arena from WASM memory into indSAB, then write the
 * render-cmd table and header scalars.
 *
 * Reads WASM memory after plan.execute() so views must be refreshed each call
 * (wasm memory may have grown since last invocation).
 *
 * @param {number} _visBars  visible bar count (informational)
 * @param {number} revision  plan revision counter
 */
function _writeIndSab(_visBars, revision) {
  const arenaLen = plan.arena_len();
  const cmdCount = plan.render_cmd_count();

  // Copy WASM arena → indSAB arena section
  // Reuse cached WASM F32 view (refreshed by _refreshWasmViews in dataLoop)
  if (arenaLen > 0) {
    const arenaPtr  = plan.arena_ptr();
    const arenaIdx  = arenaPtr >> 2;  // byte → f32 element index
    _refreshWasmViews();
    if (arenaLen > _dstArenaCap) {
      _dstArena    = new Float32Array(indSab, INDSAB_ARENA_OFF, arenaLen);
      _dstArenaCap = arenaLen;
    }
    _dstArena.set(_wasmF32.subarray(arenaIdx, arenaIdx + arenaLen));
  }

  // Write render cmd records into header
  for (let ci = 0; ci < cmdCount; ci++) {
    const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
    // Color: 4 × f32 in WASM memory at color_ptr — use cached wasm view
    const colorPtr = plan.render_cmd_color_ptr(ci);
    const colorIdx = colorPtr >> 2;  // byte → f32 element index

    indHdrView.setUint32 (base + INDSAB_CMD_SLOT_ID,      plan.render_cmd_slot_id(ci),       true);
    indHdrView.setUint32 (base + INDSAB_CMD_ARENA_OFFSET, plan.render_cmd_arena_offset(ci),  true);
    indHdrView.setUint32 (base + INDSAB_CMD_BAR_COUNT,    plan.render_cmd_bar_count(ci),     true);
    indHdrView.setUint32 (base + INDSAB_CMD_WARMUP,       plan.render_cmd_warmup(ci),        true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_R,      _wasmF32[colorIdx],                true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_G,      _wasmF32[colorIdx + 1],            true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_B,      _wasmF32[colorIdx + 2],            true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_A,      _wasmF32[colorIdx + 3],            true);
    indHdrView.setUint32 (base + INDSAB_CMD_STYLE,        plan.render_cmd_style(ci),           true);
    indHdrView.setUint32 (base + INDSAB_CMD_PANE,         plan.render_cmd_pane(ci),            true);
    indHdrView.setUint32 (base + INDSAB_CMD_BAND_ALT_OFF, plan.render_cmd_band_alt_offset(ci), true);
    indHdrView.setFloat32(base + INDSAB_CMD_LINE_WIDTH,   plan.render_cmd_line_width(ci) * DPR, true);
    // flag_mask: which FLAGS bit(s) must be set to render this cmd (0 = always show)
    const slotId = plan.render_cmd_slot_id(ci);
    const flagMask = (slotFlagMask && slotId < slotFlagMask.length) ? slotFlagMask[slotId] : 0;
    indHdrView.setUint32 (base + INDSAB_CMD_FLAG_MASK,    flagMask,                            true);
    indHdrView.setFloat32(base + INDSAB_CMD_VALUE_MIN,    plan.render_cmd_value_min(ci),       true);
    indHdrView.setFloat32(base + INDSAB_CMD_VALUE_MAX,    plan.render_cmd_value_max(ci),       true);
  }

  // Header scalars — write last so render_worker sees a consistent snapshot
  indHdrView.setUint32(INDSAB_ARENA_LEN, arenaLen,  true);
  indHdrView.setUint32(INDSAB_CMD_COUNT, cmdCount,  true);
  indHdrView.setUint32(INDSAB_REVISION,  revision,  true);
  indHdrView.setUint32(INDSAB_SEQ_OFF,   frameSeq,  true);
}

// ── OHLCV loader (same as render_worker.js) ───────────────────────────────
async function loadBinaryOhlcv(url, memory) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
  const ab = await resp.arrayBuffer();
  const N  = new Uint32Array(ab, 0, 1)[0];

  const OFF_TIME   = 8;
  const OFF_OPEN   = 8 + N * 8;
  const OFF_HIGH   = OFF_OPEN   + N * 4;
  const OFF_LOW    = OFF_HIGH   + N * 4;
  const OFF_CLOSE  = OFF_LOW    + N * 4;
  const OFF_VOLUME = OFF_CLOSE  + N * 4;

  const srcClose  = new Float32Array(ab, OFF_CLOSE, N);
  const tickSize  = estimateTickSize(srcClose);
  const basePrice = srcClose[0] ?? 100.0;

  const newStore  = new WasmModule.OhlcvStore(tickSize, basePrice, N + 64, 1024);

  new Float64Array(memory.buffer, newStore.ingest_time_ptr(),   N).set(new Float64Array(ab, OFF_TIME,   N));
  new Float32Array(memory.buffer, newStore.ingest_open_ptr(),   N).set(new Float32Array(ab, OFF_OPEN,   N));
  new Float32Array(memory.buffer, newStore.ingest_high_ptr(),   N).set(new Float32Array(ab, OFF_HIGH,   N));
  new Float32Array(memory.buffer, newStore.ingest_low_ptr(),    N).set(new Float32Array(ab, OFF_LOW,    N));
  new Float32Array(memory.buffer, newStore.ingest_close_ptr(),  N).set(srcClose);
  new Float32Array(memory.buffer, newStore.ingest_volume_ptr(), N).set(new Float32Array(ab, OFF_VOLUME, N));

  newStore.commit_ingestion(N);
  newStore.free_ingest_buffers();

  return { store: newStore, barCount: N };
}

function estimateTickSize(closes) {
  let minDiff = Infinity;
  const n = Math.min(closes.length, 100);
  for (let i = 1; i < n; i++) {
    const d = Math.abs(closes[i] - closes[i - 1]);
    if (d > 1e-9 && d < minDiff) minDiff = d;
  }
  if (!isFinite(minDiff)) return 0.01;
  const mag = 10 ** (-Math.floor(Math.log10(Math.max(minDiff, 1e-9))));
  return Math.round(minDiff * mag) / mag;
}
