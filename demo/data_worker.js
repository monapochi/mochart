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

// ── Typed array views on frameBuf (set in dataLoop) ───────────────────────
/** @type {SharedArrayBuffer} */ let frameSAB;
/** @type {SharedArrayBuffer} */ let indSab;
/** @type {DataView} */          let indHdrView;  // DataView on entire indSAB
/** @type {Uint32Array|null} */  let slotFlagMask = null;  // slot_id → FLAGS bitmask (0=always render)

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

  try {
    // 1. Dynamically import and initialize WASM module
    WasmModule = await import(WASM_MODULE_PATH);
    // `WasmModule` may export a default init() function (wasm-bindgen glue)
    const initFn = WasmModule.default ?? WasmModule.init ?? null;
    const wasmExports = initFn ? await initFn() : WasmModule;
    wasmMemory = wasmExports.memory;

    // 2. Load OHLCV data: synthetic (1M bars) or binary fixture
    const useSynthetic = evt.data.synthetic === true;
    const dataFile     = evt.data.dataFile || '../MSFT.bin';
    const targetN      = (evt.data.barCount | 0) || 1_000_000;
    const { store: s, barCount } = useSynthetic
      ? loadSyntheticOhlcv(targetN, wasmMemory)
      : await loadBinaryOhlcv(new URL(dataFile, import.meta.url).href, wasmMemory, targetN);
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

    // ── Copy SoA to frameBuf ───────────────────────────────────────────
    if (viewLen2 > 0) {
      const mem = wasmMemory.buffer;
      new Float32Array(frameSAB, FBUF_OPEN_OFF,  viewLen2).set(new Float32Array(mem, store.view_open_ptr(),   viewLen2));
      new Float32Array(frameSAB, FBUF_HIGH_OFF,  viewLen2).set(new Float32Array(mem, store.view_high_ptr(),   viewLen2));
      new Float32Array(frameSAB, FBUF_LOW_OFF,   viewLen2).set(new Float32Array(mem, store.view_low_ptr(),    viewLen2));
      new Float32Array(frameSAB, FBUF_CLOSE_OFF, viewLen2).set(new Float32Array(mem, store.view_close_ptr(),  viewLen2));
      new Float32Array(frameSAB, FBUF_VOL_OFF,   viewLen2).set(new Float32Array(mem, store.view_volume_ptr(), viewLen2));
      new Float64Array(frameSAB, FBUF_TIME_OFF,  viewLen2).set(new Float64Array(mem, store.view_time_ptr(),   viewLen2));
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
  // NOTE: rebuild view from memory.buffer each time (memory may have grown)
  if (arenaLen > 0) {
    const arenaPtr  = plan.arena_ptr();
    const srcArena  = new Float32Array(wasmMemory.buffer, arenaPtr, arenaLen);
    const dstArena  = new Float32Array(indSab, INDSAB_ARENA_OFF, arenaLen);
    dstArena.set(srcArena);
  }

  // Write render cmd records into header
  for (let ci = 0; ci < cmdCount; ci++) {
    const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
    // Color: 4 × f32 in WASM memory at color_ptr
    const colorPtr = plan.render_cmd_color_ptr(ci);
    const color    = new Float32Array(wasmMemory.buffer, colorPtr, 4);

    indHdrView.setUint32 (base + INDSAB_CMD_SLOT_ID,      plan.render_cmd_slot_id(ci),       true);
    indHdrView.setUint32 (base + INDSAB_CMD_ARENA_OFFSET, plan.render_cmd_arena_offset(ci),  true);
    indHdrView.setUint32 (base + INDSAB_CMD_BAR_COUNT,    plan.render_cmd_bar_count(ci),     true);
    indHdrView.setUint32 (base + INDSAB_CMD_WARMUP,       plan.render_cmd_warmup(ci),        true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_R,      color[0],                          true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_G,      color[1],                          true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_B,      color[2],                          true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_A,      color[3],                          true);
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
async function loadBinaryOhlcv(url, memory, targetN = 0) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
  const ab = await resp.arrayBuffer();
  const baseN = new Uint32Array(ab, 0, 1)[0];

  const OFF_TIME   = 8;
  const OFF_OPEN   = 8 + baseN * 8;
  const OFF_HIGH   = OFF_OPEN   + baseN * 4;
  const OFF_LOW    = OFF_HIGH   + baseN * 4;
  const OFF_CLOSE  = OFF_LOW    + baseN * 4;
  const OFF_VOLUME = OFF_CLOSE  + baseN * 4;

  const srcTime   = new Float64Array(ab, OFF_TIME,   baseN);
  const srcOpen   = new Float32Array(ab, OFF_OPEN,   baseN);
  const srcHigh   = new Float32Array(ab, OFF_HIGH,   baseN);
  const srcLow    = new Float32Array(ab, OFF_LOW,    baseN);
  const srcClose  = new Float32Array(ab, OFF_CLOSE,  baseN);
  const srcVolume = new Float32Array(ab, OFF_VOLUME, baseN);

  const N = targetN > baseN ? targetN : baseN;

  const tickSize  = estimateTickSize(srcClose);
  const basePrice = srcClose[0] ?? 100.0;

  const newStore  = new WasmModule.OhlcvStore(tickSize, basePrice, N + 64, 1024);

  const dstTime   = new Float64Array(memory.buffer, newStore.ingest_time_ptr(),   N);
  const dstOpen   = new Float32Array(memory.buffer, newStore.ingest_open_ptr(),   N);
  const dstHigh   = new Float32Array(memory.buffer, newStore.ingest_high_ptr(),   N);
  const dstLow    = new Float32Array(memory.buffer, newStore.ingest_low_ptr(),    N);
  const dstClose  = new Float32Array(memory.buffer, newStore.ingest_close_ptr(),  N);
  const dstVolume = new Float32Array(memory.buffer, newStore.ingest_volume_ptr(), N);

  let offset = 0;
  
  while (offset < N) {
    const chunkN = Math.min(baseN, N - offset);

    if (offset === 0) {
      dstTime.set(srcTime.subarray(0, chunkN), offset);
      dstOpen.set(srcOpen.subarray(0, chunkN), offset);
      dstHigh.set(srcHigh.subarray(0, chunkN), offset);
      dstLow.set(srcLow.subarray(0, chunkN), offset);
      dstClose.set(srcClose.subarray(0, chunkN), offset);
      dstVolume.set(srcVolume.subarray(0, chunkN), offset);
    } else {
      // Connect seams visually by continuing the price and time
      const timeDelta = dstTime[offset - 1] - srcTime[0] + (srcTime[1] - srcTime[0] || 60000);
      const priceDelta = dstClose[offset - 1] - srcOpen[0];

      for (let i = 0; i < chunkN; i++) {
        dstTime[offset + i]   = srcTime[i] + timeDelta;
        dstOpen[offset + i]   = srcOpen[i] + priceDelta;
        dstHigh[offset + i]   = srcHigh[i] + priceDelta;
        dstLow[offset + i]    = srcLow[i] + priceDelta;
        dstClose[offset + i]  = srcClose[i] + priceDelta;
        dstVolume[offset + i] = srcVolume[i];
      }
    }
    offset += chunkN;
  }

  newStore.commit_ingestion(N);
  newStore.free_ingest_buffers();

  return { store: newStore, barCount: N };
}

// ── Synthetic OHLCV generator ─────────────────────────────────────────────
/**
 * Generate n bars of synthetic OHLCV data (geometric random walk).
 * Zero per-bar allocation: pre-allocates typed arrays once.
 * @param {number} n  - bar count (e.g. 1_000_000)
 * @param {WebAssembly.Memory} memory
 * @returns {{ store: OhlcvStore, barCount: number }}
 */
function loadSyntheticOhlcv(n, memory) {
  const times   = new Float64Array(n);
  const opens   = new Float32Array(n);
  const highs   = new Float32Array(n);
  const lows    = new Float32Array(n);
  const closes  = new Float32Array(n);
  const volumes = new Float32Array(n);

  // Start 20 years ago at 1-minute bars
  const BAR_MS  = 60 * 1000;           // 1-minute candles
  const t0      = Date.now() - n * BAR_MS;
  let price     = 100.0;
  let t         = t0;

  // Seeded LCG for reproducible demo look (no Math.random allocation per bar)
  let rng = 0xDEADBEEF >>> 0;
  const rand = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 0x100000000;
  };

  for (let i = 0; i < n; i++) {
    const ret   = (rand() - 0.5) * 0.004;   // ~0.4% vol per bar
    const open  = price;
    price      *= (1.0 + ret);
    const hl    = price * (rand() * 0.003 + 0.001);
    const high  = Math.max(open, price) + hl;
    const low   = Math.min(open, price) - hl;
    times[i]    = t;
    opens[i]    = open;
    highs[i]    = high;
    lows[i]     = low;
    closes[i]   = price;
    volumes[i]  = 50000 + rand() * 450000;
    t          += BAR_MS;
  }

  const tickSize  = 0.01;
  const basePrice = closes[0];
  const newStore  = new WasmModule.OhlcvStore(tickSize, basePrice, n + 64, 1024);

  new Float64Array(memory.buffer, newStore.ingest_time_ptr(),   n).set(times);
  new Float32Array(memory.buffer, newStore.ingest_open_ptr(),   n).set(opens);
  new Float32Array(memory.buffer, newStore.ingest_high_ptr(),   n).set(highs);
  new Float32Array(memory.buffer, newStore.ingest_low_ptr(),    n).set(lows);
  new Float32Array(memory.buffer, newStore.ingest_close_ptr(),  n).set(closes);
  new Float32Array(memory.buffer, newStore.ingest_volume_ptr(), n).set(volumes);

  newStore.commit_ingestion(n);
  newStore.free_ingest_buffers();

  return { store: newStore, barCount: n };
}

function estimateTickSize(closes) {  let minDiff = Infinity;
  const n = Math.min(closes.length, 100);
  for (let i = 1; i < n; i++) {
    const d = Math.abs(closes[i] - closes[i - 1]);
    if (d > 1e-9 && d < minDiff) minDiff = d;
  }
  if (!isFinite(minDiff)) return 0.01;
  const mag = 10 ** (-Math.floor(Math.log10(Math.max(minDiff, 1e-9))));
  return Math.round(minDiff * mag) / mag;
}
