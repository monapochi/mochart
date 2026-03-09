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
const WORKER_BUILD_VERSION = '20260309b';
const WASM_GLUE_VERSION = '20260309b';
const WASM_MODULE_PATHS = [
  `../pkg/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
  `../pkg/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
];
const WASM_BINARY_PATHS = [
  `../pkg/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
  `../pkg/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
];
let WasmModule = null; // will hold the imported module namespace
let _wasmInitPromise = null; // ensures __wbg_init runs at most once per worker
let _workerInitState = 0; // 0=idle, 1=initializing, 2=ready

import {
  STRIDE, WAKE, READY, START_BAR, VIS_BARS,
  PLOT_W, PLOT_H, FLAGS, SUBPIXEL_PAN_X,
  DIRTY, GPU_DIRTY, HUD_DIRTY,
  i32ToF32,
  FRAME_MAX_BARS,
  FBUF_START_BAR, FBUF_VIS_BARS, FBUF_VIEW_LEN,
  FBUF_PRICE_MIN, FBUF_PRICE_MAX,
  FBUF_CANVAS_W, FBUF_CANVAS_H, FBUF_CANDLE_W,
  FBUF_FLAGS, FBUF_SEQ, FBUF_TOTAL_BARS,
  FBUF_FRAME_START_BAR,
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
  INDSAB_OVERLAY_STD430_OFF, INDSAB_OVERLAY_STD430_WORDS, INDSAB_OVERLAY_REV_OFF,
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

// Last known SMA periods from UI control (used as base when plan is rebuilt).
let _sma1 = 5;
let _sma2 = 25;
let _sma3 = 75;
let _useLegacyDefaultIndicators = true;
let _baseIndicators = [];

// Dynamic indicators added from API messages.
// Kept as logical configs; plan is rebuilt from this list when changed.
/** @type {Array<{
 *  id: string | number,
 *  kind: number,
 *  period: number,
 *  pane: number,
 *  style: number,
 *  r: number,
 *  g: number,
 *  b: number,
 *  a: number,
 *  lineWidth: number,
 *  slow?: number,
 *  signal?: number,
 *  stdDev?: number,
 * }>} */
let _extraIndicators = [];

/** @type {Map<string | number, number>} */
let _extraClientToSlotId = new Map();

/** @type {number} */ let workerSlotId = 0;

// Annotation state keeps only id->kind in JS; aggregate counters live in Rust.
const ANN_KIND_MARKER = 0;
const ANN_KIND_HLINE = 1;
const ANN_KIND_ZONE = 2;
const ANN_KIND_TEXT = 3;
const ANN_KIND_EVENT = 4;
/** @type {Map<string, number>} */ const _annKindById = new Map();
/** @type {number} */ let _overlayRevision = 0;
/** @type {Uint32Array|null} */ let _overlayScratchWords = null;

const KIND_TO_U8 = Object.freeze({ SMA: 0, EMA: 1, BB: 2, RSI: 3, MACD: 4, ATR: 5, OBV: 6, VOLUME: 7 });
const STYLE_TO_U8 = Object.freeze({ LINE: 0, THICKLINE: 1, HISTOGRAM: 2, BAND: 3 });
const PANE_TO_U8 = Object.freeze({ MAIN: 0, SUB1: 1, SUB2: 2 });
/** @type {number} */ let _paneGapPx = 8;
/** @type {number[]} */ let _paneWeights = [3, 1, 1];

function _toKindU8(kind) {
  if (typeof kind === 'number') return kind & 0xff;
  if (typeof kind === 'string') return KIND_TO_U8[kind.toUpperCase()] ?? 0;
  return 0;
}

function _toStyleU8(style) {
  if (typeof style === 'number') return style & 0xff;
  if (typeof style === 'string') return STYLE_TO_U8[style.toUpperCase()] ?? 1; // ThickLine default
  return 1;
}

function _toPaneU8(pane) {
  if (typeof pane === 'number') return pane & 0xff;
  if (typeof pane === 'string') {
    const mapped = PANE_TO_U8[pane.toUpperCase()];
    if (mapped != null) return mapped;
    if (pane.startsWith('pane-')) {
      const idx = Number.parseInt(pane.slice(5), 10);
      if (Number.isFinite(idx) && idx >= 0) return idx & 0xff;
    }
  }
  return 0;
}

function _sanitizeExtraIndicator(msg) {
  return {
    id: msg.id,
    kind: _toKindU8(msg.kind),
    period: (msg.period | 0) > 0 ? (msg.period | 0) : 14,
    pane: _toPaneU8(msg.pane),
    style: _toStyleU8(msg.style),
    r: Number.isFinite(msg.r) ? msg.r : 0.2,
    g: Number.isFinite(msg.g) ? msg.g : 0.6,
    b: Number.isFinite(msg.b) ? msg.b : 0.9,
    a: Number.isFinite(msg.a) ? msg.a : 1.0,
    lineWidth: Number.isFinite(msg.lineWidth) ? msg.lineWidth : 1.5,
    slow: (msg.slow | 0) > 0 ? (msg.slow | 0) : undefined,
    signal: (msg.signal | 0) > 0 ? (msg.signal | 0) : undefined,
    stdDev: Number.isFinite(msg.stdDev) ? msg.stdDev : undefined,
  };
}

function _isForCurrentSlot(message) {
  if (message == null || message.slotId == null) return true;
  return ((message.slotId | 0) >>> 0) === workerSlotId;
}

function _decodeAnnotationKind(value) {
  if (typeof value !== 'string') return ANN_KIND_EVENT;
  const k = value.toLowerCase();
  if (k === 'marker') return ANN_KIND_MARKER;
  if (k === 'hline') return ANN_KIND_HLINE;
  if (k === 'zone') return ANN_KIND_ZONE;
  if (k === 'text') return ANN_KIND_TEXT;
  return ANN_KIND_EVENT;
}

function _resetAnnState() {
  _annKindById.clear();
  if (WasmModule && typeof WasmModule.overlay_reset_state === 'function') {
    WasmModule.overlay_reset_state();
  }
}

function _syncAnnStatsToRustAndSab() {
  if (!WasmModule || !wasmMemory || !indHdrView) return;
  if (typeof WasmModule.overlay_pack_state_std430_ptr !== 'function') return;
  const ptr = WasmModule.overlay_pack_state_std430_ptr();
  if (!Number.isFinite(ptr) || ptr <= 0) return;

  const wordBase = ptr >>> 2;
  if (!_overlayScratchWords || _overlayScratchWords.buffer !== wasmMemory.buffer) {
    _overlayScratchWords = new Uint32Array(wasmMemory.buffer);
  }

  for (let i = 0; i < INDSAB_OVERLAY_STD430_WORDS; i++) {
    indHdrView.setUint32(INDSAB_OVERLAY_STD430_OFF + i * 4, _overlayScratchWords[wordBase + i] >>> 0, true);
  }
  _overlayRevision = (_overlayRevision + 1) >>> 0;
  indHdrView.setUint32(INDSAB_OVERLAY_REV_OFF, _overlayRevision, true);
}

function _applyAnnAdd(message) {
  const ann = message.annotation;
  if (!ann || typeof ann !== 'object') return;

  const nextKind = _decodeAnnotationKind(ann.type);
  const id = typeof ann.id === 'string' ? ann.id : undefined;

  if (id) {
    const prevKind = _annKindById.get(id);
    if (prevKind != null) {
      if (typeof WasmModule.overlay_update_kind === 'function') {
        WasmModule.overlay_update_kind(prevKind, nextKind);
      }
    } else if (typeof WasmModule.overlay_add_kind === 'function') {
      WasmModule.overlay_add_kind(nextKind);
    }
    _annKindById.set(id, nextKind);
  } else if (typeof WasmModule.overlay_add_kind === 'function') {
    WasmModule.overlay_add_kind(nextKind);
  }
  _syncAnnStatsToRustAndSab();
}

function _applyAnnUpdate(message) {
  const id = typeof message.id === 'string' ? message.id : undefined;
  if (!id) return;
  const prevKind = _annKindById.get(id);
  if (prevKind == null) return;

  const patch = message.patch;
  if (!patch || typeof patch !== 'object' || !('type' in patch)) return;

  const nextKind = _decodeAnnotationKind(patch.type);
  if (nextKind === prevKind) return;

  if (typeof WasmModule.overlay_update_kind === 'function') {
    WasmModule.overlay_update_kind(prevKind, nextKind);
  }
  _annKindById.set(id, nextKind);
  _syncAnnStatsToRustAndSab();
}

function _applyAnnRemove(message) {
  const id = typeof message.id === 'string' ? message.id : undefined;
  if (!id) return;
  const prevKind = _annKindById.get(id);
  if (prevKind == null) return;
  _annKindById.delete(id);
  if (typeof WasmModule.overlay_remove_kind === 'function') {
    WasmModule.overlay_remove_kind(prevKind);
  }
  _syncAnnStatsToRustAndSab();
}

function _applyAnnBulk(message) {
  const anns = Array.isArray(message.annotations) ? message.annotations : [];
  _resetAnnState();

  for (let i = 0; i < anns.length; i++) {
    const ann = anns[i];
    if (!ann || typeof ann !== 'object') continue;
    const kind = _decodeAnnotationKind(ann.type);
    const id = typeof ann.id === 'string' ? ann.id : undefined;
    if (id) _annKindById.set(id, kind);
    if (typeof WasmModule.overlay_add_kind === 'function') {
      WasmModule.overlay_add_kind(kind);
    }
  }

  _syncAnnStatsToRustAndSab();
}

function _applyAnnClear() {
  _resetAnnState();
  _syncAnnStatsToRustAndSab();
}

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
    // @zero_alloc_allow: Recreate cached views only after wasm memory.grow detaches the previous buffer.
    _wasmF32 = new Float32Array(buf);
    // @zero_alloc_allow: Recreate cached views only after wasm memory.grow detaches the previous buffer.
    _wasmF64 = new Float64Array(buf);
  }
}

async function ensureWasmInitialized() {
  if (!WasmModule) {
    let loaded = null;
    let lastError = null;
    for (let i = 0; i < WASM_MODULE_PATHS.length; i++) {
      const candidate = new URL(WASM_MODULE_PATHS[i], import.meta.url).href;
      try {
        loaded = await import(candidate);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!loaded) {
      throw lastError ?? new Error('failed to import mochart_wasm_new.js');
    }
    WasmModule = loaded;
  }
  const initFn = WasmModule.default ?? WasmModule.init ?? null;
  if (!initFn) {
    wasmMemory = WasmModule.memory;
    return WasmModule;
  }
  if (!_wasmInitPromise) {
    _wasmInitPromise = (async () => {
      let lastError = null;
      for (let i = 0; i < WASM_BINARY_PATHS.length; i++) {
        const candidate = new URL(WASM_BINARY_PATHS[i], import.meta.url).href;
        try {
          const response = await fetch(candidate);
          if (!response.ok) {
            lastError = new Error(`HTTP ${response.status} for ${candidate}`);
            continue;
          }
          return await initFn({ module_or_path: response });
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError ?? new Error('failed to load mochart_wasm_new_bg.wasm');
    })();
  }
  try {
    const wasmExports = await _wasmInitPromise;
    wasmMemory = wasmExports.memory;
    return wasmExports;
  } catch (err) {
    _wasmInitPromise = null;
    throw err;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function buildPlan(sma1, sma2, sma3) {
  if (plan && plan.free) {
    plan.free();
  }
  plan = new WasmModule.ExecutionPlan();
  if (_useLegacyDefaultIndicators) {
    plan.add_indicator(/*SMA*/0, sma1, /*pane*/0, /*ThickLine*/1, 0.00, 0.56, 0.73, 1.0, 1.5);
    plan.add_indicator(/*SMA*/0, sma2, /*pane*/0, /*ThickLine*/1, 1.00, 0.76, 0.03, 1.0, 1.5);
    plan.add_indicator(/*SMA*/0, sma3, /*pane*/0, /*ThickLine*/1, 0.91, 0.12, 0.39, 1.0, 1.5);
    plan.add_indicator(/*RSI*/3, 14,  /*pane*/1, /*ThickLine*/1, 0.61, 0.35, 0.71, 1.0, 1.5);
    plan.add_indicator(/*MACD*/4, 12, /*pane*/1, /*ThickLine*/1, 0.16, 0.50, 0.73, 1.0, 1.5);
    plan.add_indicator(/*Volume*/7, 0, /*pane*/2, /*Histogram*/2, 0.20, 0.60, 0.90, 0.8, 1.0);
  } else {
    for (let i = 0; i < _baseIndicators.length; i++) {
      const base = _baseIndicators[i];
      const slotId = plan.add_indicator(base.kind, base.period, base.pane, base.style, base.r, base.g, base.b, base.a, base.lineWidth);
      if (base.kind === 4) {
        plan.set_macd_params(slotId, base.period, base.slow ?? 26, base.signal ?? 9);
      } else if (base.kind === 2 && Number.isFinite(base.stdDev)) {
        plan.set_bb_params(slotId, base.stdDev);
      }
    }
  }

  // Add dynamic extra indicators requested by API messages.
  _extraClientToSlotId.clear();
  for (let i = 0; i < _extraIndicators.length; i++) {
    const e = _extraIndicators[i];
    const slotId = plan.add_indicator(e.kind, e.period, e.pane, e.style, e.r, e.g, e.b, e.a, e.lineWidth);
    if (e.kind === 4) {
      plan.set_macd_params(slotId, e.period, e.slow ?? 26, e.signal ?? 9);
    } else if (e.kind === 2 && Number.isFinite(e.stdDev)) {
      plan.set_bb_params(slotId, e.stdDev);
    }
    _extraClientToSlotId.set(e.id, slotId);
  }

  plan.compile(200);   // initial compile with default vis_count; recompiles if vis_bars changes

  // Map slot_id → FLAGS bitmask (0 = always render).
  // This must match the order of add_indicator() calls above.
  slotFlagMask = new Uint32Array(64);
  if (_useLegacyDefaultIndicators) {
    slotFlagMask[0] = 1;
    slotFlagMask[1] = 2;
    slotFlagMask[2] = 4;
    slotFlagMask[3] = 32;
    slotFlagMask[4] = 64;
    slotFlagMask[5] = 128;
  }
}

self.onmessage = async (evt) => {
  if (evt.data.type !== 'init' && !_isForCurrentSlot(evt.data)) {
    return;
  }

  if (evt.data.type === 'ann_add') {
    _applyAnnAdd(evt.data);
    return;
  }

  if (evt.data.type === 'ann_update') {
    _applyAnnUpdate(evt.data);
    return;
  }

  if (evt.data.type === 'ann_remove') {
    _applyAnnRemove(evt.data);
    return;
  }

  if (evt.data.type === 'ann_bulk') {
    _applyAnnBulk(evt.data);
    return;
  }

  if (evt.data.type === 'ann_clear') {
    _applyAnnClear();
    return;
  }

  if (evt.data.type === 'pane_config') {
    const nextGap = Number(evt.data.gap);
    if (Number.isFinite(nextGap) && nextGap >= 0) {
      _paneGapPx = nextGap;
    }
    const nextWeights = evt.data.weights;
    if (Array.isArray(nextWeights) && nextWeights.length > 0) {
      const clean = new Array(nextWeights.length);
      for (let i = 0; i < nextWeights.length; i++) {
        const w = Number(nextWeights[i]);
        clean[i] = Number.isFinite(w) && w > 0 ? w : 1;
      }
      _paneWeights = clean;
    }
    return;
  }

  if (evt.data.type === 'set_data_binary') {
    if (!WasmModule || !wasmMemory) return;
    try {
      const { store: nextStore, barCount } = ingestBinaryOhlcvBuffer(evt.data.data, wasmMemory);
      if (store && store.free) store.free();
      store = nextStore;
      totalBars = barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: 'data_set', source: 'binary', bars: barCount });
    } catch (err) {
      self.postMessage({ type: 'error', message: `set_data_binary failed: ${String(err)}` });
    }
    return;
  }

  if (evt.data.type === 'set_data_soa') {
    if (!WasmModule || !wasmMemory) return;
    try {
      const { store: nextStore, barCount } = ingestSoaPayload(evt.data, wasmMemory);
      if (store && store.free) store.free();
      store = nextStore;
      totalBars = barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: 'data_set', source: 'soa', bars: barCount });
    } catch (err) {
      self.postMessage({ type: 'error', message: `set_data_soa failed: ${String(err)}` });
    }
    return;
  }

  if (evt.data.type === 'set_data_url') {
    if (!WasmModule || !wasmMemory) return;
    try {
      const { url } = evt.data;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
      const contentType = resp.headers.get('content-type') || '';

      let next;
      if (contentType.includes('application/json') || contentType.includes('text/json')) {
        const json = await resp.json();
        next = ingestJsonBars(json, wasmMemory);
      } else {
        const ab = await resp.arrayBuffer();
        next = ingestBinaryOhlcvBuffer(ab, wasmMemory);
      }

      if (store && store.free) store.free();
      store = next.store;
      totalBars = next.barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: 'data_set', source: 'url', bars: next.barCount });
    } catch (err) {
      self.postMessage({ type: 'error', message: `set_data_url failed: ${String(err)}` });
    }
    return;
  }

  if (evt.data.type === 'update_sma') {
    if (plan && WasmModule) {
      _sma1 = (evt.data.sma1 | 0) > 0 ? (evt.data.sma1 | 0) : _sma1;
      _sma2 = (evt.data.sma2 | 0) > 0 ? (evt.data.sma2 | 0) : _sma2;
      _sma3 = (evt.data.sma3 | 0) > 0 ? (evt.data.sma3 | 0) : _sma3;
      buildPlan(_sma1, _sma2, _sma3);
      // Wait for next frame request to re-execute and render
    }
    return;
  }

  if (evt.data.type === 'ep_add') {
    if (!plan || !WasmModule) return;
    if (evt.data.id === undefined || evt.data.id === null) return;

    const spec = _sanitizeExtraIndicator(evt.data);
    const exists = _extraIndicators.findIndex((x) => x.id === spec.id);
    if (exists >= 0) _extraIndicators[exists] = spec;
    else _extraIndicators.push(spec);

    buildPlan(_sma1, _sma2, _sma3);
    const vis = Math.max(1, Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS) || 200);
    plan.compile(vis);

    self.postMessage({ type: 'ep_added', id: spec.id, slotId: _extraClientToSlotId.get(spec.id) ?? -1 });
    return;
  }

  if (evt.data.type === 'ep_update') {
    if (!plan || !WasmModule) return;
    const id = evt.data.id;
    if (id === undefined || id === null) return;
    const idx = _extraIndicators.findIndex((x) => x.id === id);
    if (idx < 0) {
      self.postMessage({ type: 'ep_error', id, message: 'indicator not found' });
      return;
    }

    const cur = _extraIndicators[idx];
    const next = _sanitizeExtraIndicator({ ...cur, ...evt.data, id });
    _extraIndicators[idx] = next;

    buildPlan(_sma1, _sma2, _sma3);
    const vis = Math.max(1, Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS) || 200);
    plan.compile(vis);

    self.postMessage({ type: 'ep_updated', id, slotId: _extraClientToSlotId.get(id) ?? -1 });
    return;
  }

  if (evt.data.type === 'ep_remove') {
    if (!plan || !WasmModule) return;
    const id = evt.data.id;
    if (id === undefined || id === null) return;

    const before = _extraIndicators.length;
    _extraIndicators = _extraIndicators.filter((x) => x.id !== id);
    if (_extraIndicators.length === before) {
      self.postMessage({ type: 'ep_error', id, message: 'indicator not found' });
      return;
    }

    buildPlan(_sma1, _sma2, _sma3);
    const vis = Math.max(1, Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS) || 200);
    plan.compile(vis);

    self.postMessage({ type: 'ep_removed', id });
    return;
  }

  if (evt.data.type !== 'init') return;
  if (_workerInitState === 2) {
    if (totalBars > 0) self.postMessage({ type: 'ready', bars: totalBars });
    return;
  }
  if (_workerInitState === 1) return;
  _workerInitState = 1;

  const descriptor = evt.data.descriptor ?? {
    slotId: 0,
    ctrl: evt.data.ctrl,
    frameCtrl: evt.data.frameCtrl,
    frameBuf: evt.data.frameBuf,
    indSab: evt.data.indSab,
  };
  workerSlotId = ((descriptor.slotId | 0) >>> 0);
  const ctrlBuf = descriptor.ctrl;
  const frameCtrlBuf = descriptor.frameCtrl;
  const frameBuf = descriptor.frameBuf;
  const indSabBuf = descriptor.indSab;
  // Use authoritative DPR from main thread
  if (typeof evt.data.dpr === 'number' && evt.data.dpr >= 1) {
    DPR = Math.ceil(evt.data.dpr);
  }
  console.log(
    '[data_worker] init |',
    `slot=${workerSlotId}`,
    `dpr=${DPR}`,
    `worker=${WORKER_BUILD_VERSION}`,
    `wasmGlue=${WASM_GLUE_VERSION}`,
    `host=${evt.data.buildVersion ?? 'n/a'}`,
  );
  ctrl      = new Int32Array(ctrlBuf);
  frameCtrl = new Int32Array(frameCtrlBuf);
  frameSAB  = frameBuf;
  indSab    = indSabBuf;
  fdbView   = new DataView(frameBuf, 0, FBUF_HDR_BYTES);
  indHdrView = new DataView(indSab);
  _overlayRevision = 0;

  // Pre-allocate max-capacity destination views — created once, reused every frame.
  _dstOpen  = new Float32Array(frameSAB, FBUF_OPEN_OFF,  FRAME_MAX_BARS);
  _dstHigh  = new Float32Array(frameSAB, FBUF_HIGH_OFF,  FRAME_MAX_BARS);
  _dstLow   = new Float32Array(frameSAB, FBUF_LOW_OFF,   FRAME_MAX_BARS);
  _dstClose = new Float32Array(frameSAB, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
  _dstVol   = new Float32Array(frameSAB, FBUF_VOL_OFF,   FRAME_MAX_BARS);
  _dstTime  = new Float64Array(frameSAB, FBUF_TIME_OFF,  FRAME_MAX_BARS);

  try {
    // 1. Dynamically import and initialize WASM module (exactly once per worker)
    await ensureWasmInitialized();

    _useLegacyDefaultIndicators = evt.data.skipDefaultIndicators !== true;
    _baseIndicators = [];
    if (!_useLegacyDefaultIndicators && Array.isArray(evt.data.initialIndicators)) {
      for (let i = 0; i < evt.data.initialIndicators.length; i++) {
        _baseIndicators.push(_sanitizeExtraIndicator({
          ...evt.data.initialIndicators[i],
          id: `base_${i}`,
        }));
      }
    }

    // 2. Fetch OHLCV binary and ingest (uses WasmModule.OhlcvStore)
    if (evt.data.skipDefaultData === true) {
      store = new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024);
      totalBars = 0;
    } else {
      const { store: s, barCount } = await loadBinaryOhlcv('../MSFT.bin', wasmMemory);
      store     = s;
      totalBars = barCount;
      console.log(`[data_worker] ingested ${barCount} bars`);
    }

    // 3. Create ExecutionPlan with indicators.
    //    SMA 1/2/3 mirror the existing FLAGS bit 0/1/2 toggles.
    //    RSI(14) on Sub1, MACD(12,26,9) on Sub1 — new FLAGS bits 5/6.
    //    Kind: SMA=0, EMA=1, BB=2, RSI=3, MACD=4, ATR=5, OBV=6
    //    Style: Line=0, ThickLine=1, Histogram=2, Band=3
    buildPlan(_sma1, _sma2, _sma3);
    _syncAnnStatsToRustAndSab();
    console.log('[data_worker] ExecutionPlan compiled |',
      'slots:', plan.slot_count(), '| revision:', plan.revision());

    // 4. Report ready
    self.postMessage({ type: 'ready', bars: totalBars });

    // 5. Begin data loop
    _workerInitState = 2;
    dataLoop();
  } catch (err) {
    _workerInitState = 0;
    console.error('[data_worker] init failed:', err);
    self.postMessage({ type: 'error', message: String(err) });
  }
};

// ── Data loop ─────────────────────────────────────────────────────────────
/** @zero_alloc */
async function dataLoop() {
  const ci = workerSlotId;
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
    const panOffsetPx = i32ToF32(Atomics.load(ctrl, ci * STRIDE + SUBPIXEL_PAN_X));

    if (plotW < 4 || plotH < 4 || visBars < 1) continue;

    const physW = Math.round(plotW * DPR);
    const physH = Math.round(plotH * DPR);

    // ── Decompress view window ──────────────────────────────────────────
    const hasSubpixelPan = Math.abs(panOffsetPx) > 1e-3;
    const frameStartBar = hasSubpixelPan ? Math.max(0, startBar - 1) : startBar;
    const frameVisibleBars = hasSubpixelPan ? Math.min(FRAME_MAX_BARS, visBars + 2) : visBars;
    store.decompress_view_window(frameStartBar, frameVisibleBars);
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
    fdbView.setUint32 (FBUF_FRAME_START_BAR, frameStartBar, true);
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
      // @zero_alloc_allow: Arena destination view is recreated only when plan output grows after recompile.
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

function ingestBinaryOhlcvBuffer(ab, memory) {
  const N = new Uint32Array(ab, 0, 1)[0] || 0;
  if (N <= 0) {
    const emptyStore = new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024);
    return { store: emptyStore, barCount: 0 };
  }

  const OFF_TIME   = 8;
  const OFF_OPEN   = 8 + N * 8;
  const OFF_HIGH   = OFF_OPEN   + N * 4;
  const OFF_LOW    = OFF_HIGH   + N * 4;
  const OFF_CLOSE  = OFF_LOW    + N * 4;
  const OFF_VOLUME = OFF_CLOSE  + N * 4;

  const srcClose = new Float32Array(ab, OFF_CLOSE, N);
  const tickSize = estimateTickSize(srcClose);
  const basePrice = srcClose[0] ?? 100.0;

  const nextStore = new WasmModule.OhlcvStore(tickSize, basePrice, N + 64, 1024);

  new Float64Array(memory.buffer, nextStore.ingest_time_ptr(), N).set(new Float64Array(ab, OFF_TIME, N));
  new Float32Array(memory.buffer, nextStore.ingest_open_ptr(), N).set(new Float32Array(ab, OFF_OPEN, N));
  new Float32Array(memory.buffer, nextStore.ingest_high_ptr(), N).set(new Float32Array(ab, OFF_HIGH, N));
  new Float32Array(memory.buffer, nextStore.ingest_low_ptr(), N).set(new Float32Array(ab, OFF_LOW, N));
  new Float32Array(memory.buffer, nextStore.ingest_close_ptr(), N).set(srcClose);
  new Float32Array(memory.buffer, nextStore.ingest_volume_ptr(), N).set(new Float32Array(ab, OFF_VOLUME, N));

  nextStore.commit_ingestion(N);
  nextStore.free_ingest_buffers();
  return { store: nextStore, barCount: N };
}

function ingestSoaPayload(payload, memory) {
  const N = (payload.count | 0) >>> 0;
  if (N === 0) {
    const emptyStore = new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024);
    return { store: emptyStore, barCount: 0 };
  }

  const time = new Float64Array(payload.time);
  const open = new Float32Array(payload.open);
  const high = new Float32Array(payload.high);
  const low = new Float32Array(payload.low);
  const close = new Float32Array(payload.close);
  const volume = new Float32Array(payload.volume);

  const tickSize = estimateTickSize(close);
  const basePrice = close[0] ?? 100.0;
  const nextStore = new WasmModule.OhlcvStore(tickSize, basePrice, N + 64, 1024);

  new Float64Array(memory.buffer, nextStore.ingest_time_ptr(), N).set(time.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_open_ptr(), N).set(open.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_high_ptr(), N).set(high.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_low_ptr(), N).set(low.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_close_ptr(), N).set(close.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_volume_ptr(), N).set(volume.subarray(0, N));

  nextStore.commit_ingestion(N);
  nextStore.free_ingest_buffers();
  return { store: nextStore, barCount: N };
}

function ingestJsonBars(json, memory) {
  const arr = Array.isArray(json) ? json : [];
  const N = arr.length;
  const time = new Float64Array(N);
  const open = new Float32Array(N);
  const high = new Float32Array(N);
  const low = new Float32Array(N);
  const close = new Float32Array(N);
  const volume = new Float32Array(N);

  const isTuple = N > 0 && Array.isArray(arr[0]);
  for (let i = 0; i < N; i++) {
    if (isTuple) {
      const t = arr[i];
      const tv = Number(t[0] ?? 0);
      time[i] = tv < 1e12 ? tv * 1000 : tv;
      open[i] = Number(t[1] ?? 0);
      high[i] = Number(t[2] ?? 0);
      low[i] = Number(t[3] ?? 0);
      close[i] = Number(t[4] ?? 0);
      volume[i] = Number(t[5] ?? 0);
    } else {
      const o = arr[i] ?? {};
      const tv = Number(o.time ?? 0);
      time[i] = tv < 1e12 ? tv * 1000 : tv;
      open[i] = Number(o.open ?? 0);
      high[i] = Number(o.high ?? 0);
      low[i] = Number(o.low ?? 0);
      close[i] = Number(o.close ?? 0);
      volume[i] = Number(o.volume ?? 0);
    }
  }

  return ingestSoaPayload({ count: N, time: time.buffer, open: open.buffer, high: high.buffer, low: low.buffer, close: close.buffer, volume: volume.buffer }, memory);
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
