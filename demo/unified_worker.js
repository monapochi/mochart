/**
 * unified_worker.js — Single-owner worker for Mochart canvas-worker mode
 *
 * Owns WASM store/ExecutionPlan, WebGPU renderer, HUD canvas, and the single
 * rAF/v-sync loop. This removes the data/render ownership split and therefore
 * eliminates frameBuf entirely.
 */

import { GpuRenderer } from './gpu_renderer.js';
import {
  STRIDE, WAKE, READY, START_BAR, VIS_BARS,
  PLOT_W, PLOT_H, POINTER_X, POINTER_Y, FLAGS, DIRTY,
  GPU_DIRTY, HUD_DIRTY, SUBPIXEL_PAN_X, RIGHT_MARGIN_BARS,
  i32ToF32,
  FRAME_MAX_BARS,
  INDSAB_SEQ_OFF, INDSAB_ARENA_LEN, INDSAB_CMD_COUNT, INDSAB_REVISION,
  INDSAB_CMD_BASE, INDSAB_CMD_STRIDE,
  INDSAB_CMD_SLOT_ID, INDSAB_CMD_ARENA_OFFSET, INDSAB_CMD_BAR_COUNT, INDSAB_CMD_WARMUP,
  INDSAB_CMD_COLOR_R, INDSAB_CMD_COLOR_G, INDSAB_CMD_COLOR_B, INDSAB_CMD_COLOR_A,
  INDSAB_CMD_STYLE, INDSAB_CMD_PANE, INDSAB_CMD_BAND_ALT_OFF, INDSAB_CMD_LINE_WIDTH,
  INDSAB_CMD_FLAG_MASK, INDSAB_CMD_VALUE_MIN, INDSAB_CMD_VALUE_MAX,
  INDSAB_ARENA_OFF,
  INDSAB_OVERLAY_STD430_OFF, INDSAB_OVERLAY_STD430_WORDS, INDSAB_OVERLAY_REV_OFF,
} from './shared_protocol.js';

const WORKER_BUILD_VERSION = '20260311a';
const WASM_GLUE_VERSION = '20260311a';
const WASM_MODULE_PATHS = [
  `../pkg/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
  `../pkg/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
];
const WASM_BINARY_PATHS = [
  `../pkg/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
  `../pkg/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
];
const WASM_MODULE_PATHS_SHARED = [
  `../../../../src/pkg-shared/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
  `../pkg-shared/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
];
const WASM_BINARY_PATHS_SHARED = [
  `../../../../src/pkg-shared/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
  `../pkg-shared/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
];

let WasmModule = null;
let _wasmInitPromise = null;
let _workerInitState = 0;

let DPR = Math.round(self.devicePixelRatio || 1);
const _gpuViewportShift = { panOffsetPx: 0, extraLeftBars: 0, rightMarginBars: 0 };

self.addEventListener('error', (ev) => {
  try {
    self.postMessage({ type: 'error', message: String(ev.message || ev) });
  } catch {}
});

self.addEventListener('unhandledrejection', (ev) => {
  try {
    const reason = ev.reason ? (ev.reason.stack || String(ev.reason)) : 'unknown';
    self.postMessage({ type: 'error', message: String(reason) });
  } catch {}
});

/** @type {Int32Array} */ let ctrl;
/** @type {OhlcvStore} */ let store;
/** @type {ExecutionPlan} */ let plan;
/** @type {WebAssembly.Memory} */ let wasmMemory;
/** @type {GpuRenderer} */ let gpuRenderer;
/** @type {OffscreenCanvas} */ let gpuCanvas;
/** @type {OffscreenCanvas} */ let hudCanvas;
/** @type {OffscreenCanvasRenderingContext2D} */ let hud;
/** @type {SharedArrayBuffer} */ let indSab;
/** @type {DataView} */ let indHdrView;
/** @type {number} */ let workerSlotId = 0;
/** @type {{enabled?: boolean, reason?: string | null} | null} */ let _sharedWasmCapability = null;
const _frameState = {
  startBar: 0,
  visBars: 0,
  viewLen: 0,
  flags: 0,
  frameSeq: 0,
  totalBars: 0,
  priceMin: 0,
  priceMax: 1,
  physW: 0,
  physH: 0,
  candleW: 1,
  frameStartBar: 0,
  timePtr: 0,
};
let totalBars = 0;
let frameSeq = 0;

let _sma1 = 5;
let _sma2 = 25;
let _sma3 = 75;
let _useLegacyDefaultIndicators = true;
let _baseIndicators = [];
let _extraIndicators = [];
let _extraClientToSlotId = new Map();

const ANN_KIND_MARKER = 0;
const ANN_KIND_HLINE = 1;
const ANN_KIND_ZONE = 2;
const ANN_KIND_TEXT = 3;
const ANN_KIND_EVENT = 4;
const _annKindById = new Map();
let _overlayRevision = 0;
let _overlayScratchWords = null;

const KIND_TO_U8 = Object.freeze({ SMA: 0, EMA: 1, BB: 2, RSI: 3, MACD: 4, ATR: 5, OBV: 6, VOLUME: 7 });
const STYLE_TO_U8 = Object.freeze({ LINE: 0, THICKLINE: 1, HISTOGRAM: 2, BAND: 3 });
const PANE_TO_U8 = Object.freeze({ MAIN: 0, SUB1: 1, SUB2: 2 });
let _paneGapPx = 8;
let _paneWeights = [3, 1, 1];

const _r64 = new Float64Array(6);
const R_LAST_GPU_MS = 0;
const R_CACHED_PMIN = 1;
const R_CACHED_PMAX = 2;
const R_WASM_MS = 3;
const R_HUD_MS = 4;
const R_FRAME_MS = 5;
_r64[R_CACHED_PMIN] = NaN;
_r64[R_CACHED_PMAX] = NaN;

const STATS_SIZE = 64;
const PERF_POST_INTERVAL_MS = 500;
const _statsWasm = new Float32Array(STATS_SIZE);
const _statsGpu = new Float32Array(STATS_SIZE);
const _statsHud = new Float32Array(STATS_SIZE);
const _statsFrame = new Float32Array(STATS_SIZE);
const _sortScratch = new Float32Array(STATS_SIZE);
let _statsHead = 0;
let _statsFilled = 0;
let _lastPerfPostTs = 0;
let _memPeakJsMB = 0;

const LEGEND_ENTRIES = [
  { bit: 1, label: 'SMA 5', color: '#00BCD4' },
  { bit: 2, label: 'SMA 25', color: '#FFC107' },
  { bit: 4, label: 'SMA 75', color: '#E91E63' },
  { bit: 16, label: 'HM', color: '#888888' },
];
let smaPrefix1 = 'SMA 5:';
let smaPrefix2 = 'SMA 25:';
let smaPrefix3 = 'SMA 75:';

let _lastWasmBuf = null;
let _wasmF32 = null;
let _wasmF64 = null;
let _activeOpenPtr = -1;
let _activeHighPtr = -1;
let _activeLowPtr = -1;
let _activeClosePtr = -1;
let _activeVolPtr = -1;
let _activeTimePtr = -1;
let _activeViewCap = 0;
let _fbOpen = null;
let _fbHigh = null;
let _fbLow = null;
let _fbClose = null;
let _fbVol = null;
let _fbTime = null;

let _dstArena = null;
let _dstArenaCap = 0;
let _indSabArenaCap = 0;
let _pendingIndSabResize = 0;
let slotFlagMask = null;

const _popupData = { open: 0, high: 0, low: 0, close: 0, vol: 0, sma20: 0, sma50: 0, sma100: 0, time: 0 };
const _frameDescriptor = {
  startBar: 0,
  visBars: 0,
  viewLen: 0,
  flags: 0,
  timePtr: 0,
  frameSeq: 0,
  totalBars: 0,
  priceMin: 0,
  priceMax: 1,
  physW: 0,
  physH: 0,
  candleW: 1,
  frameStartBar: 0,
};
const _indSabResizeMsg = { type: 'ind_sab_resize', slotId: 0, arenaF32Count: 0 };
const _perfMsg = {
  type: 'perf',
  wasm: { ewma: 0, p50: 0, p95: 0 },
  gpu: { ewma: 0, p50: 0, p95: 0 },
  hud: { ewma: 0, p50: 0, p95: 0 },
  frame: { ewma: 0, p50: 0, p95: 0 },
  mem: { jsHeapUsedMB: 0, jsHeapTotalMB: 0, wasmMB: 0, peakJsHeapMB: 0, peakWasmMB: 0 },
};
let _smaArenaOff = [0, 0, 0];
let _smaBarCount = [0, 0, 0];
let _smaCachedRevision = -1;
let _indArenaView = null;
let _indArenaViewLen = 0;
let _overlayRevSeen = -1;
const _overlaySummaryWords = new Uint32Array(INDSAB_OVERLAY_STD430_WORDS);
const _dateCache = new Map();
const DATE_CACHE_MAX = 512;
const _dashArray1 = [3, 4];
const _dashArrayEmpty = [];
const _dashArrayCrosshair = [4, 4];
const _popupCache = {
  lastBarTime: NaN,
  lastFlags: -1,
  lines: ['', '', '', '', '', '', ''],
  widths: [0, 0, 0, 0, 0, 0, 0],
  lineCount: 0,
};
const _priceLabelCache = { last: NaN, str: '' };

function percentile(buf, n, pct) {
  _sortScratch.set(buf.subarray(0, n));
  const arr = _sortScratch;
  for (let i = 1; i < n; i++) {
    const v = arr[i]; let j = i - 1;
    while (j >= 0 && arr[j] > v) { arr[j + 1] = arr[j]; j--; }
    arr[j + 1] = v;
  }
  return arr[Math.min(n - 1, Math.floor((pct / 100) * n))];
}

function isoDateStr(ms) {
  let s = _dateCache.get(ms);
  if (s !== undefined) return s;
  // @zero_alloc_allow: Date formatting is cached by timestamp and rebuilt only on cache miss.
  const d = new Date(ms);
  const m = d.getUTCMonth() + 1;
  const dy = d.getUTCDate();
  // @zero_alloc_allow: Formatted ISO date strings are cached by timestamp and reused across frames.
  s = `${d.getUTCFullYear()}-${m < 10 ? '0' : ''}${m}-${dy < 10 ? '0' : ''}${dy}`;
  if (_dateCache.size >= DATE_CACHE_MAX) _dateCache.delete(_dateCache.keys().next().value);
  _dateCache.set(ms, s);
  return s;
}

function formatVolume(v) {
  // @zero_alloc_allow: HUD volume labels are formatted lazily for display text only.
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  // @zero_alloc_allow: HUD volume labels are formatted lazily for display text only.
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  // @zero_alloc_allow: HUD volume labels are formatted lazily for display text only.
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  // @zero_alloc_allow: HUD volume labels are formatted lazily for display text only.
  return v.toString();
}

function _toKindU8(kind) {
  if (typeof kind === 'number') return kind & 0xff;
  if (typeof kind === 'string') return KIND_TO_U8[kind.toUpperCase()] ?? 0;
  return 0;
}

function _toStyleU8(style) {
  if (typeof style === 'number') return style & 0xff;
  if (typeof style === 'string') return STYLE_TO_U8[style.toUpperCase()] ?? 1;
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
      if (typeof WasmModule.overlay_update_kind === 'function') WasmModule.overlay_update_kind(prevKind, nextKind);
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
  if (typeof WasmModule.overlay_update_kind === 'function') WasmModule.overlay_update_kind(prevKind, nextKind);
  _annKindById.set(id, nextKind);
  _syncAnnStatsToRustAndSab();
}

function _applyAnnRemove(message) {
  const id = typeof message.id === 'string' ? message.id : undefined;
  if (!id) return;
  const prevKind = _annKindById.get(id);
  if (prevKind == null) return;
  _annKindById.delete(id);
  if (typeof WasmModule.overlay_remove_kind === 'function') WasmModule.overlay_remove_kind(prevKind);
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
    if (typeof WasmModule.overlay_add_kind === 'function') WasmModule.overlay_add_kind(kind);
  }
  _syncAnnStatsToRustAndSab();
}

function _applyAnnClear() {
  _resetAnnState();
  _syncAnnStatsToRustAndSab();
}

function _refreshWasmViews() {
  const buf = wasmMemory.buffer;
  if (buf !== _lastWasmBuf) {
    _lastWasmBuf = buf;
    // @zero_alloc_allow: Recreate cached views only after wasm memory.grow detaches the previous buffer.
    _wasmF32 = new Float32Array(buf);
    // @zero_alloc_allow: Recreate cached views only after wasm memory.grow detaches the previous buffer.
    _wasmF64 = new Float64Array(buf);
    _activeOpenPtr = -1;
    _activeHighPtr = -1;
    _activeLowPtr = -1;
    _activeClosePtr = -1;
    _activeVolPtr = -1;
    _activeTimePtr = -1;
    _activeViewCap = 0;
  }
}

function _refreshActiveFrameViews(viewLen) {
  const openPtr = store.view_open_ptr() >>> 0;
  const highPtr = store.view_high_ptr() >>> 0;
  const lowPtr = store.view_low_ptr() >>> 0;
  const closePtr = store.view_close_ptr() >>> 0;
  const volPtr = store.view_volume_ptr() >>> 0;
  const timePtr = store.view_time_ptr() >>> 0;
  const requiredCap = Math.max(1, viewLen);
  const changed = _fbOpen == null
    || openPtr !== _activeOpenPtr
    || highPtr !== _activeHighPtr
    || lowPtr !== _activeLowPtr
    || closePtr !== _activeClosePtr
    || volPtr !== _activeVolPtr
    || timePtr !== _activeTimePtr
    || requiredCap > _activeViewCap;
  if (!changed) return;
  _activeOpenPtr = openPtr;
  _activeHighPtr = highPtr;
  _activeLowPtr = lowPtr;
  _activeClosePtr = closePtr;
  _activeVolPtr = volPtr;
  _activeTimePtr = timePtr;
  _activeViewCap = requiredCap;
  // @zero_alloc_allow: Rebind active frame views only when source pointers change or capacity grows.
  _fbOpen = new Float32Array(wasmMemory.buffer, openPtr, requiredCap);
  // @zero_alloc_allow: Rebind active frame views only when source pointers change or capacity grows.
  _fbHigh = new Float32Array(wasmMemory.buffer, highPtr, requiredCap);
  // @zero_alloc_allow: Rebind active frame views only when source pointers change or capacity grows.
  _fbLow = new Float32Array(wasmMemory.buffer, lowPtr, requiredCap);
  // @zero_alloc_allow: Rebind active frame views only when source pointers change or capacity grows.
  _fbClose = new Float32Array(wasmMemory.buffer, closePtr, requiredCap);
  // @zero_alloc_allow: Rebind active frame views only when source pointers change or capacity grows.
  _fbVol = new Float32Array(wasmMemory.buffer, volPtr, requiredCap);
  // @zero_alloc_allow: Rebind active frame views only when source pointers change or capacity grows.
  _fbTime = new Float64Array(wasmMemory.buffer, timePtr, requiredCap);
  gpuRenderer.setFrameViews(_fbOpen, _fbHigh, _fbLow, _fbClose, _fbVol);
}

function _writeFrameState(descriptor) {
  _frameState.startBar = descriptor.startBar;
  _frameState.visBars = descriptor.visBars;
  _frameState.viewLen = descriptor.viewLen;
  _frameState.flags = descriptor.flags;
  _frameState.frameSeq = descriptor.frameSeq;
  _frameState.totalBars = descriptor.totalBars;
  _frameState.priceMin = descriptor.priceMin;
  _frameState.priceMax = descriptor.priceMax;
  _frameState.physW = descriptor.physW;
  _frameState.physH = descriptor.physH;
  _frameState.candleW = descriptor.candleW;
  _frameState.frameStartBar = descriptor.frameStartBar;
  _frameState.timePtr = descriptor.timePtr;
}

async function ensureWasmInitialized() {
  const modulePaths = _sharedWasmCapability?.enabled ? [...WASM_MODULE_PATHS_SHARED, ...WASM_MODULE_PATHS] : WASM_MODULE_PATHS;
  const binaryPaths = _sharedWasmCapability?.enabled ? [...WASM_BINARY_PATHS_SHARED, ...WASM_BINARY_PATHS] : WASM_BINARY_PATHS;
  if (!WasmModule) {
    let loaded = null;
    let lastError = null;
    for (let i = 0; i < modulePaths.length; i++) {
      const candidate = new URL(modulePaths[i], import.meta.url).href;
      try {
        loaded = await import(candidate);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!loaded) throw lastError ?? new Error('failed to import mochart_wasm_new.js');
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
      for (let i = 0; i < binaryPaths.length; i++) {
        const candidate = new URL(binaryPaths[i], import.meta.url).href;
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

function buildPlan(sma1, sma2, sma3) {
  if (plan && plan.free) plan.free();
  plan = new WasmModule.ExecutionPlan();
  if (_useLegacyDefaultIndicators) {
    plan.add_indicator(0, sma1, 0, 1, 0.00, 0.56, 0.73, 1.0, 1.5);
    plan.add_indicator(0, sma2, 0, 1, 1.00, 0.76, 0.03, 1.0, 1.5);
    plan.add_indicator(0, sma3, 0, 1, 0.91, 0.12, 0.39, 1.0, 1.5);
    plan.add_indicator(3, 14, 1, 1, 0.61, 0.35, 0.71, 1.0, 1.5);
    plan.add_indicator(4, 12, 1, 1, 0.16, 0.50, 0.73, 1.0, 1.5);
    plan.add_indicator(7, 0, 2, 2, 0.20, 0.60, 0.90, 0.8, 1.0);
  } else {
    for (let i = 0; i < _baseIndicators.length; i++) {
      const base = _baseIndicators[i];
      const slotId = plan.add_indicator(base.kind, base.period, base.pane, base.style, base.r, base.g, base.b, base.a, base.lineWidth);
      if (base.kind === 4) plan.set_macd_params(slotId, base.period, base.slow ?? 26, base.signal ?? 9);
      else if (base.kind === 2 && Number.isFinite(base.stdDev)) plan.set_bb_params(slotId, base.stdDev);
    }
  }
  _extraClientToSlotId.clear();
  for (let i = 0; i < _extraIndicators.length; i++) {
    const e = _extraIndicators[i];
    const slotId = plan.add_indicator(e.kind, e.period, e.pane, e.style, e.r, e.g, e.b, e.a, e.lineWidth);
    if (e.kind === 4) plan.set_macd_params(slotId, e.period, e.slow ?? 26, e.signal ?? 9);
    else if (e.kind === 2 && Number.isFinite(e.stdDev)) plan.set_bb_params(slotId, e.stdDev);
    _extraClientToSlotId.set(e.id, slotId);
  }
  plan.compile(200);
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

function _writeIndSab(_visBars, revision) {
  if (!plan || !indHdrView || !wasmMemory) return;
  const arenaLen = plan.arena_len();
  if (arenaLen > _indSabArenaCap) {
    if (_pendingIndSabResize !== arenaLen) {
      _pendingIndSabResize = arenaLen;
      _indSabResizeMsg.slotId = workerSlotId;
      _indSabResizeMsg.arenaF32Count = arenaLen;
      self.postMessage(_indSabResizeMsg);
    }
    return;
  }
  _pendingIndSabResize = 0;
  const arenaPtr = plan.arena_ptr() >>> 0;
  const arenaOff = arenaPtr >> 2;
  _refreshWasmViews();
  if (!_dstArena || arenaLen > _dstArenaCap) {
    // @zero_alloc_allow: Arena destination view is recreated only when plan output grows after recompile.
    _dstArena = new Float32Array(indSab, INDSAB_ARENA_OFF, arenaLen);
    _dstArenaCap = arenaLen;
  }
  _dstArena.set(_wasmF32.subarray(arenaOff, arenaOff + arenaLen));
  const cmdCount = plan.render_cmd_count();
  for (let ci = 0; ci < cmdCount; ci++) {
    const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
    const colorPtr = plan.render_cmd_color_ptr(ci) >>> 0;
    const colorOff = colorPtr >> 2;
    indHdrView.setUint32(base + INDSAB_CMD_SLOT_ID,       plan.render_cmd_slot_id(ci),          true);
    indHdrView.setUint32(base + INDSAB_CMD_ARENA_OFFSET,  plan.render_cmd_arena_offset(ci),     true);
    indHdrView.setUint32(base + INDSAB_CMD_BAR_COUNT,     plan.render_cmd_bar_count(ci),        true);
    indHdrView.setUint32(base + INDSAB_CMD_WARMUP,        plan.render_cmd_warmup(ci),           true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_R,      _wasmF32[colorOff],                   true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_G,      _wasmF32[colorOff + 1],               true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_B,      _wasmF32[colorOff + 2],               true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_A,      _wasmF32[colorOff + 3],               true);
    indHdrView.setUint32(base + INDSAB_CMD_STYLE,         plan.render_cmd_style(ci),            true);
    indHdrView.setUint32(base + INDSAB_CMD_PANE,          plan.render_cmd_pane(ci),             true);
    indHdrView.setUint32(base + INDSAB_CMD_BAND_ALT_OFF,  plan.render_cmd_band_alt_offset(ci),  true);
    indHdrView.setFloat32(base + INDSAB_CMD_LINE_WIDTH,   plan.render_cmd_line_width(ci),       true);
    indHdrView.setUint32(base + INDSAB_CMD_FLAG_MASK,     slotFlagMask ? slotFlagMask[plan.render_cmd_slot_id(ci)] : 0, true);
    indHdrView.setFloat32(base + INDSAB_CMD_VALUE_MIN,    plan.render_cmd_value_min(ci),        true);
    indHdrView.setFloat32(base + INDSAB_CMD_VALUE_MAX,    plan.render_cmd_value_max(ci),        true);
  }
  indHdrView.setUint32(INDSAB_ARENA_LEN, arenaLen, true);
  indHdrView.setUint32(INDSAB_CMD_COUNT, cmdCount, true);
  indHdrView.setUint32(INDSAB_REVISION, revision, true);
  indHdrView.setUint32(INDSAB_SEQ_OFF, frameSeq, true);
}

function loadBinaryOhlcv(url) {
  return fetch(url).then((resp) => {
    if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
    return resp.arrayBuffer();
  }).then((ab) => ingestBinaryOhlcvBuffer(ab));
}

function ingestBinaryOhlcvBuffer(ab) {
  const N = new Uint32Array(ab, 0, 1)[0] || 0;
  if (N <= 0) return { store: new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024), barCount: 0 };
  const nextStore = new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024);
  const ingested = nextStore.ingest_binary_ohlcv(new Uint8Array(ab));
  return { store: nextStore, barCount: ingested | 0 };
}

function ingestSoaPayload(message, memory) {
  const count = Math.max(0, message.count | 0);
  if (count === 0) return { store: new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024), barCount: 0 };
  const time = new Float64Array(message.time);
  const open = new Float32Array(message.open);
  const high = new Float32Array(message.high);
  const low = new Float32Array(message.low);
  const close = new Float32Array(message.close);
  const volume = new Float32Array(message.volume);
  const nextStore = new WasmModule.OhlcvStore(0.01, 100.0, count + 64, 1024);
  new Float64Array(memory.buffer, nextStore.ingest_time_ptr(), count).set(time.subarray(0, count));
  new Float32Array(memory.buffer, nextStore.ingest_open_ptr(), count).set(open.subarray(0, count));
  new Float32Array(memory.buffer, nextStore.ingest_high_ptr(), count).set(high.subarray(0, count));
  new Float32Array(memory.buffer, nextStore.ingest_low_ptr(), count).set(low.subarray(0, count));
  new Float32Array(memory.buffer, nextStore.ingest_close_ptr(), count).set(close.subarray(0, count));
  new Float32Array(memory.buffer, nextStore.ingest_volume_ptr(), count).set(volume.subarray(0, count));
  return finalizeIngestedStore(nextStore, count);
}

function ingestJsonBars(json, memory) {
  const arr = Array.isArray(json) ? json : [];
  const count = arr.length;
  const time = new Float64Array(count);
  const open = new Float32Array(count);
  const high = new Float32Array(count);
  const low = new Float32Array(count);
  const close = new Float32Array(count);
  const volume = new Float32Array(count);
  const isTuple = count > 0 && Array.isArray(arr[0]);
  for (let i = 0; i < count; i++) {
    if (isTuple) {
      const tuple = arr[i];
      const timeValue = Number(tuple[0] ?? 0);
      time[i] = timeValue < 1e12 ? timeValue * 1000 : timeValue;
      open[i] = Number(tuple[1] ?? 0);
      high[i] = Number(tuple[2] ?? 0);
      low[i] = Number(tuple[3] ?? 0);
      close[i] = Number(tuple[4] ?? 0);
      volume[i] = Number(tuple[5] ?? 0);
    } else {
      const bar = arr[i] ?? {};
      const timeValue = Number(bar.time ?? 0);
      time[i] = timeValue < 1e12 ? timeValue * 1000 : timeValue;
      open[i] = Number(bar.open ?? 0);
      high[i] = Number(bar.high ?? 0);
      low[i] = Number(bar.low ?? 0);
      close[i] = Number(bar.close ?? 0);
      volume[i] = Number(bar.volume ?? 0);
    }
  }
  return ingestSoaPayload({ count, time: time.buffer, open: open.buffer, high: high.buffer, low: low.buffer, close: close.buffer, volume: volume.buffer }, memory);
}

function finalizeIngestedStore(store, count) {
  store.configure_price_scale_from_ingest(count);
  store.commit_ingestion(count);
  store.free_ingest_buffers();
  return { store, barCount: count };
}

function niceStep(range, ticks) {
  const raw = range / Math.max(1, ticks);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const r = raw / pow;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * pow;
}

function drawPriceAxis(ctx, w, h, yMin, yMax, layout) {
  const plotW = w - 60;
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : h;
  const step = niceStep(yMax - yMin, 5);
  if (!isFinite(step) || step <= 0) return;
  const first = Math.ceil(yMin / step) * step;
  ctx.save();
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = first; v <= yMax + 1e-9; v += step) {
    const y = boundY + (1 - (v - yMin) / (yMax - yMin)) * boundH;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.setLineDash(_dashArray1);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    ctx.setLineDash(_dashArrayEmpty);
    ctx.fillStyle = '#555';
    // @zero_alloc_allow: Axis labels allocate strings for Canvas text and are not part of the GPU hot path.
    ctx.fillText(v.toFixed(2), w - 4, y);
  }
  ctx.restore();
}

function drawDateAxis(ctx, w, h, viewLen) {
  if (viewLen === 0) return;
  const plotW = w - 60;
  const logicalStartBar = _frameState.startBar;
  const frameStartBar = _frameState.frameStartBar;
  const visBars = Math.max(1, _frameState.visBars);
  const rightMarginBars = Math.max(0, Atomics.load(ctrl, workerSlotId * STRIDE + RIGHT_MARGIN_BARS));
  const totalSlots = Math.max(1, visBars + rightMarginBars);
  const panOffsetPx = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + SUBPIXEL_PAN_X));
  const slotW = plotW / totalSlots;
  const offsetSlots = (logicalStartBar - frameStartBar) + (panOffsetPx / Math.max(1e-6, slotW));
  const times = _fbTime;
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const TICKS = 6;
  for (let i = 0; i < TICKS; i++) {
    const frac = i / (TICKS - 1);
    const localSlot = frac * Math.max(0, totalSlots - 1);
    const idx = Math.max(0, Math.min(viewLen - 1, Math.round(localSlot + offsetSlots)));
    const x = ((localSlot + 0.5) - (panOffsetPx / Math.max(1e-6, slotW))) * slotW;
    ctx.fillText(isoDateStr(times[idx]), x, h - 2);
  }
  ctx.restore();
}

function _readSmaPop(idx) {
  if (!indSab || !indHdrView) { _popupData.sma20 = NaN; _popupData.sma50 = NaN; _popupData.sma100 = NaN; return; }
  const hdr = indHdrView;
  const rev = hdr.getUint32(INDSAB_REVISION, true);
  if (rev !== _smaCachedRevision) {
    _smaCachedRevision = rev;
    const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
    _smaArenaOff[0] = _smaArenaOff[1] = _smaArenaOff[2] = 0;
    _smaBarCount[0] = _smaBarCount[1] = _smaBarCount[2] = 0;
    for (let ci = 0; ci < cmdCount; ci++) {
      const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
      const flagMask = hdr.getUint32(base + INDSAB_CMD_FLAG_MASK, true);
      const style = hdr.getUint32(base + INDSAB_CMD_STYLE, true);
      if (style !== 1) continue;
      let si = -1;
      if (flagMask === 1) si = 0;
      else if (flagMask === 2) si = 1;
      else if (flagMask === 4) si = 2;
      if (si >= 0) {
        _smaArenaOff[si] = hdr.getUint32(base + INDSAB_CMD_ARENA_OFFSET, true);
        _smaBarCount[si] = hdr.getUint32(base + INDSAB_CMD_BAR_COUNT, true);
      }
    }
  }
  const arenaLen = hdr.getUint32(INDSAB_ARENA_LEN, true);
  if (!_indArenaView || arenaLen > _indArenaViewLen) {
    // @zero_alloc_allow: Arena view is recreated only when indicator arena capacity grows after recompile.
    _indArenaView = new Float32Array(indSab, INDSAB_ARENA_OFF, arenaLen);
    _indArenaViewLen = arenaLen;
  }
  _popupData.sma20 = (idx < _smaBarCount[0] && _smaArenaOff[0] + idx < arenaLen) ? _indArenaView[_smaArenaOff[0] + idx] : NaN;
  _popupData.sma50 = (idx < _smaBarCount[1] && _smaArenaOff[1] + idx < arenaLen) ? _indArenaView[_smaArenaOff[1] + idx] : NaN;
  _popupData.sma100 = (idx < _smaBarCount[2] && _smaArenaOff[2] + idx < arenaLen) ? _indArenaView[_smaArenaOff[2] + idx] : NaN;
}

function _readOverlaySummary() {
  if (!indHdrView) return _overlaySummaryWords;
  const rev = indHdrView.getUint32(INDSAB_OVERLAY_REV_OFF, true);
  if (rev === _overlayRevSeen) return _overlaySummaryWords;
  _overlayRevSeen = rev;
  for (let i = 0; i < INDSAB_OVERLAY_STD430_WORDS; i++) {
    _overlaySummaryWords[i] = indHdrView.getUint32(INDSAB_OVERLAY_STD430_OFF + i * 4, true);
  }
  return _overlaySummaryWords;
}

function drawCrosshair(ctx, w, h, px, py, yMin, yMax, layout, dateLabel = '', popupData = null, flags = 0) {
  const plotW = w - 60;
  const clampedX = Math.min(px, plotW);
  const DATE_BADGE_H = 16;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.40)';
  ctx.setLineDash(_dashArrayCrosshair);
  ctx.beginPath(); ctx.moveTo(clampedX, 0); ctx.lineTo(clampedX, dateLabel ? h - DATE_BADGE_H : h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(plotW, py); ctx.stroke();
  ctx.setLineDash(_dashArrayEmpty);
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : h;
  if (py >= boundY && py <= boundY + boundH) {
    const price = yMax - ((py - boundY) / boundH) * (yMax - yMin);
    ctx.fillStyle = '#ddd'; ctx.fillRect(plotW + 1, py - 9, 58, 18);
    ctx.fillStyle = '#222'; ctx.font = '10px monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    if (_priceLabelCache.last !== price) {
      _priceLabelCache.last = price;
      // @zero_alloc_allow: Price label strings are cached and rebuilt only when the hovered price changes.
      _priceLabelCache.str = price.toFixed(2);
    }
    ctx.fillText(_priceLabelCache.str, w - 4, py);
  }
  if (dateLabel) {
    ctx.font = '10px monospace';
    const tw = ctx.measureText(dateLabel).width;
    const bw = tw + 8;
    const bx = Math.max(0, Math.min(clampedX - bw / 2, plotW - bw));
    const by = h - DATE_BADGE_H;
    ctx.fillStyle = '#ddd'; ctx.fillRect(bx, by, bw, DATE_BADGE_H);
    ctx.fillStyle = '#222'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(dateLabel, bx + 4, by + DATE_BADGE_H / 2);
  }
  if (popupData && py >= boundY && py <= boundY + boundH && px <= plotW) {
    const cursorPrice = yMax - ((py - boundY) / boundH) * (yMax - yMin);
    const hitMargin = 15 * (yMax - yMin) / Math.max(1, boundH);
    let hit = false;
    if (cursorPrice >= popupData.low - hitMargin && cursorPrice <= popupData.high + hitMargin) hit = true;
    if (!hit && (flags & 1) && !Number.isNaN(popupData.sma20) && Math.abs(cursorPrice - popupData.sma20) < hitMargin) hit = true;
    if (!hit && (flags & 2) && !Number.isNaN(popupData.sma50) && Math.abs(cursorPrice - popupData.sma50) < hitMargin) hit = true;
    if (!hit && (flags & 4) && !Number.isNaN(popupData.sma100) && Math.abs(cursorPrice - popupData.sma100) < hitMargin) hit = true;
    if (hit) {
      const barTime = Number.isFinite(popupData.time) ? popupData.time : NaN;
      if (_popupCache.lastBarTime !== barTime || _popupCache.lastFlags !== flags) {
        _popupCache.lastBarTime = barTime;
        _popupCache.lastFlags = flags;
        _popupCache.lines[0] = 'Date: ' + dateLabel;
        // @zero_alloc_allow: Popup strings are rebuilt only when the hovered bar or flags change.
        _popupCache.lines[1] = 'O: ' + popupData.open.toFixed(2) + '  H: ' + popupData.high.toFixed(2);
        // @zero_alloc_allow: Popup strings are rebuilt only when the hovered bar or flags change.
        _popupCache.lines[2] = 'L: ' + popupData.low.toFixed(2) + '  C: ' + popupData.close.toFixed(2);
        _popupCache.lines[3] = 'Vol: ' + formatVolume(popupData.vol);
        const hasSma20 = (flags & 1) && !Number.isNaN(popupData.sma20) && popupData.sma20 > 0;
        const hasSma50 = (flags & 2) && !Number.isNaN(popupData.sma50) && popupData.sma50 > 0;
        const hasSma100 = (flags & 4) && !Number.isNaN(popupData.sma100) && popupData.sma100 > 0;
        _popupCache.lineCount = 4 + (hasSma20 ? 1 : 0) + (hasSma50 ? 1 : 0) + (hasSma100 ? 1 : 0);
        // @zero_alloc_allow: Indicator popup strings are rebuilt only when the hovered bar or flags change.
        _popupCache.lines[4] = hasSma20 ? (smaPrefix1 + ' ' + popupData.sma20.toFixed(2)) : '';
        // @zero_alloc_allow: Indicator popup strings are rebuilt only when the hovered bar or flags change.
        _popupCache.lines[5] = hasSma50 ? (smaPrefix2 + ' ' + popupData.sma50.toFixed(2)) : '';
        // @zero_alloc_allow: Indicator popup strings are rebuilt only when the hovered bar or flags change.
        _popupCache.lines[6] = hasSma100 ? (smaPrefix3 + ' ' + popupData.sma100.toFixed(2)) : '';
        ctx.font = '11px monospace';
        for (let i = 0; i < 7; i++) _popupCache.widths[i] = _popupCache.lines[i] ? ctx.measureText(_popupCache.lines[i]).width : 0;
      }
      let maxTw = 0;
      for (let i = 0; i < _popupCache.lineCount; i++) maxTw = Math.max(maxTw, _popupCache.widths[i] || 0);
      const boxW = maxTw + 12;
      const boxH = _popupCache.lineCount * 16 + 8;
      const boxX = (px + 10 + boxW < plotW) ? px + 10 : px - 10 - boxW;
      const boxY = Math.max(boundY + 4, Math.min(py - boxH / 2, boundY + boundH - boxH - 4));
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.setLineDash(_dashArrayEmpty);
      ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 4); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      let row = 0;
      for (let i = 0; i < _popupCache.lineCount; i++) {
        if (i === 4) ctx.fillStyle = '#00BCD4';
        else if (i === 5) ctx.fillStyle = '#FFC107';
        else if (i === 6) ctx.fillStyle = '#E91E63';
        else ctx.fillStyle = '#222';
        const text = _popupCache.lines[i];
        if (text) ctx.fillText(text, boxX + 6, boxY + 6 + row * 16);
        row++;
      }
    }
  }
  ctx.restore();
}

function drawPaneBorders(ctx, plotW, layout) {
  if (!layout) return;
  ctx.save();
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.setLineDash(_dashArrayEmpty);
  const gap = (layout.gap || 0) / DPR;
  if (layout.sub1 && gap > 0) {
    const yTop = layout.sub1.y / DPR - gap;
    const yBot = layout.sub1.y / DPR;
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, yTop, plotW + 60, gap);
    ctx.beginPath(); ctx.moveTo(0, yTop); ctx.lineTo(plotW + 60, yTop); ctx.moveTo(0, yBot); ctx.lineTo(plotW + 60, yBot); ctx.stroke();
  }
  if (layout.sub2 && gap > 0) {
    const yTop = layout.sub2.y / DPR - gap;
    const yBot = layout.sub2.y / DPR;
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, yTop, plotW + 60, gap);
    ctx.beginPath(); ctx.moveTo(0, yTop); ctx.lineTo(plotW + 60, yTop); ctx.moveTo(0, yBot); ctx.lineTo(plotW + 60, yBot); ctx.stroke();
  }
  ctx.restore();
}

function drawLegend(ctx, flags, overlaySummary) {
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#222';
  ctx.fillText('MSFT', 8, 8);
  ctx.font = '11px sans-serif';
  let x = 52;
  for (let i = 0; i < LEGEND_ENTRIES.length; i++) {
    const { bit, label, color } = LEGEND_ENTRIES[i];
    if (!(flags & bit)) continue;
    ctx.fillStyle = color;
    ctx.fillText(label, x, 9);
    x += ctx.measureText(label).width + 12;
  }
  if (_r64[R_LAST_GPU_MS] > 0) {
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    // @zero_alloc_allow: Debug legend text is generated for HUD display only.
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
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    // @zero_alloc_allow: Overlay summary text is generated for HUD display only.
    ctx.fillText(`ANN ${total} M${marker} H${hline} Z${zone} T${text} E${event}`, x, 9);
  }
  // Watermark — displayed on non-commercial builds (BSL free tier)
  const _ww = ctx.canvas.width / DPR;
  const _wh = ctx.canvas.height / DPR;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(100,100,100,0.35)';
  ctx.fillText('Powered by Mochart α', _ww - 6, _wh - 6);
  ctx.restore();
}

function buildPointerPayload(x, y) {
  const plotW = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + PLOT_W));
  const plotH = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + PLOT_H));
  const viewLen = _frameState.viewLen;
  if (viewLen < 1 || !_fbTime) return null;
  const flags = _frameState.flags;
  const pMin = _r64[R_CACHED_PMIN];
  const pMax = _r64[R_CACHED_PMAX];
  const layout = gpuRenderer?.paneLayout;
  const rightMarginBars = Math.max(0, Atomics.load(ctrl, workerSlotId * STRIDE + RIGHT_MARGIN_BARS));
  const totalSlots = Math.max(1, _frameState.visBars + rightMarginBars);
  const panOffsetPx = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + SUBPIXEL_PAN_X));
  const logicalStartBar = _frameState.startBar;
  const frameStartBar = _frameState.frameStartBar;
  const chartAreaW = plotW - 60;
  const barStep = chartAreaW / totalSlots;
  const offsetSlots = (logicalStartBar - frameStartBar) + (panOffsetPx / Math.max(1e-6, barStep));
  const localIndex = Math.max(0, Math.min(viewLen - 1, Math.floor(x / Math.max(1e-6, barStep) + offsetSlots)));
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : plotH;
  const price = pMax - ((y - boundY) / Math.max(1, boundH)) * (pMax - pMin);
  _popupData.open = _fbOpen[localIndex];
  _popupData.high = _fbHigh[localIndex];
  _popupData.low = _fbLow[localIndex];
  _popupData.close = _fbClose[localIndex];
  _popupData.vol = _fbVol[localIndex];
  _popupData.time = _fbTime[localIndex];
  _readSmaPop(localIndex);
  return {
    barIndex: Math.max(0, frameStartBar + localIndex),
    price,
    time: _fbTime[localIndex],
    ohlcv: {
      open: _fbOpen[localIndex],
      high: _fbHigh[localIndex],
      low: _fbLow[localIndex],
      close: _fbClose[localIndex],
      volume: _fbVol[localIndex],
    },
    x,
    y,
  };
}

function renderLoop() {
  let lastWake = 0;
  const hudHasCommit = typeof hud.commit === 'function';
  let firstFrame = true;

  /** @zero_alloc */
  function renderFrame() {
    if (self.requestAnimationFrame) self.requestAnimationFrame(renderFrame);
    else setTimeout(renderFrame, 16);

    const currentWake = Atomics.load(ctrl, workerSlotId * STRIDE + WAKE);
    if (currentWake === lastWake) return;
    lastWake = currentWake;

    const dirtyBits = Atomics.load(ctrl, workerSlotId * STRIDE + DIRTY);
    const gpuDirty = (dirtyBits & GPU_DIRTY) !== 0;
    const hudDirty = (dirtyBits & HUD_DIRTY) !== 0;
    if (!gpuDirty && !hudDirty) return;

    const startBar = Atomics.load(ctrl, workerSlotId * STRIDE + START_BAR);
    const visBars = Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS);
    const plotW = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + PLOT_W));
    const plotH = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + PLOT_H));
    const flags = Atomics.load(ctrl, workerSlotId * STRIDE + FLAGS);
    const panOffsetPx = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + SUBPIXEL_PAN_X));
    const rightMarginBars = Math.max(0, Atomics.load(ctrl, workerSlotId * STRIDE + RIGHT_MARGIN_BARS));
    if (plotW < 4 || plotH < 4 || visBars < 1) return;

    const physW = Math.round(plotW * DPR);
    const physH = Math.round(plotH * DPR);
    const t0_frame = performance.now();
    const t0_wasm = t0_frame;

    const hasSubpixelPan = Math.abs(panOffsetPx) > 1e-3;
    const frameStartBar = hasSubpixelPan ? Math.max(0, startBar - 1) : startBar;
    const frameVisibleBars = hasSubpixelPan ? Math.min(FRAME_MAX_BARS, visBars + 2) : visBars;
    store.decompress_view_window(frameStartBar, frameVisibleBars);
    const viewLen = store.view_len();
    const totalSlots = Math.max(1, visBars + rightMarginBars);
    const candleW = totalSlots > 0 ? Math.max(1, Math.min(40 * DPR, (physW / totalSlots) * 0.8)) : 2 * DPR;
    const priceMin = store.view_price_min();
    const priceMax = store.view_price_max();
    if (plan.needs_recompile(viewLen)) plan.compile(viewLen);
    if (viewLen > 0) {
      plan.execute(store);
      _writeIndSab(visBars, plan.revision());
    }
    const viewLen2 = Math.min(viewLen, FRAME_MAX_BARS);
    _refreshWasmViews();
    if (viewLen2 > 0) _refreshActiveFrameViews(viewLen2);
    frameSeq++;
    _frameDescriptor.startBar = startBar;
    _frameDescriptor.visBars = visBars;
    _frameDescriptor.viewLen = viewLen2;
    _frameDescriptor.flags = flags;
    _frameDescriptor.timePtr = viewLen2 > 0 ? (store.view_time_ptr() >>> 0) : 0;
    _frameDescriptor.frameSeq = frameSeq;
    _frameDescriptor.totalBars = totalBars;
    _frameDescriptor.priceMin = priceMin;
    _frameDescriptor.priceMax = priceMax;
    _frameDescriptor.physW = physW;
    _frameDescriptor.physH = physH;
    _frameDescriptor.candleW = candleW;
    _frameDescriptor.frameStartBar = frameStartBar;
    _writeFrameState(_frameDescriptor);
    const t_wasm_ms = performance.now() - t0_wasm;
    _r64[R_WASM_MS] = _r64[R_WASM_MS] * 0.9 + t_wasm_ms * 0.1;

    if (gpuCanvas.width !== physW || gpuCanvas.height !== physH) {
      gpuRenderer.setSize(gpuCanvas, physW, physH);
      hudCanvas.width = physW;
      hudCanvas.height = physH;
      _r64[R_CACHED_PMIN] = NaN;
    }

    let t_gpu_ms = 0;
    let t_hud_ms = 0;
    if ((gpuDirty || Number.isNaN(_r64[R_CACHED_PMIN])) && viewLen2 > 0) {
      const t0_gpu = performance.now();
      try {
        _gpuViewportShift.panOffsetPx = panOffsetPx;
        _gpuViewportShift.extraLeftBars = Math.max(0, _frameState.startBar - frameStartBar);
        _gpuViewportShift.rightMarginBars = rightMarginBars;
        const out = gpuRenderer.drawGpuDirect(_frameState, viewLen2, _gpuViewportShift);
        _r64[R_CACHED_PMIN] = out[0];
        _r64[R_CACHED_PMAX] = out[1];
        if (firstFrame) {
          firstFrame = false;
          console.log('[unified_worker] FIRST GPU FRAME | viewLen:', viewLen2, '| physW:', physW, 'physH:', physH);
        }
      } catch (e) {
        console.error('[unified_worker] GPU pass error:', e);
      }
      t_gpu_ms = performance.now() - t0_gpu;
      _r64[R_LAST_GPU_MS] = _r64[R_LAST_GPU_MS] * 0.9 + t_gpu_ms * 0.1;
    }

    if (hudDirty) {
      const t0_hud = performance.now();
      try {
        const pMin = _r64[R_CACHED_PMIN];
        const pMax = _r64[R_CACHED_PMAX];
        const ptrX = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + POINTER_X));
        const ptrY = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + POINTER_Y));
        hud.setTransform(DPR, 0, 0, DPR, 0, 0);
        hud.clearRect(0, 0, plotW, plotH);
        if (!Number.isNaN(pMin)) {
          const layout = gpuRenderer.paneLayout;
          drawPriceAxis(hud, plotW, plotH, pMin, pMax, layout);
          drawDateAxis(hud, plotW, plotH, viewLen2);
          if (ptrX >= 0 && ptrY >= 0 && ptrX < plotW && ptrY < plotH) {
            const chartAreaW = plotW - 60;
            const barStep = chartAreaW / totalSlots;
            const offsetSlots = (startBar - frameStartBar) + (panOffsetPx / Math.max(1e-6, barStep));
            const lIdx = Math.max(0, Math.min(viewLen2 - 1, Math.floor(ptrX / Math.max(1e-6, barStep) + offsetSlots)));
            let dateLabel = '';
            let popupData = null;
            if (viewLen2 > 0 && lIdx < viewLen2) {
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
          if (layout) drawPaneBorders(hud, plotW, layout);
        }
        if (hudHasCommit) hud.commit();
      } catch (e) {
        console.error('[unified_worker] HUD error:', e);
      }
      t_hud_ms = performance.now() - t0_hud;
      _r64[R_HUD_MS] = _r64[R_HUD_MS] * 0.9 + t_hud_ms * 0.1;
    }

    const frameMs = performance.now() - t0_frame;
    _r64[R_FRAME_MS] = _r64[R_FRAME_MS] * 0.9 + frameMs * 0.1;
    _statsWasm[_statsHead] = t_wasm_ms;
    _statsGpu[_statsHead] = t_gpu_ms;
    _statsHud[_statsHead] = t_hud_ms;
    _statsFrame[_statsHead] = frameMs;
    _statsHead = (_statsHead + 1) % STATS_SIZE;
    if (_statsFilled < STATS_SIZE) _statsFilled++;
    if (_statsFilled > 0 && (t0_frame - _lastPerfPostTs) >= PERF_POST_INTERVAL_MS) {
      _lastPerfPostTs = t0_frame;
      const n = _statsFilled;
      const jsHeapUsedMB = (performance.memory?.usedJSHeapSize ?? 0) / 1048576;
      const jsHeapTotalMB = (performance.memory?.totalJSHeapSize ?? 0) / 1048576;
      if (jsHeapUsedMB > _memPeakJsMB) _memPeakJsMB = jsHeapUsedMB;
      _perfMsg.wasm.ewma = _r64[R_WASM_MS];
      _perfMsg.wasm.p50 = percentile(_statsWasm, n, 50);
      _perfMsg.wasm.p95 = percentile(_statsWasm, n, 95);
      _perfMsg.gpu.ewma = _r64[R_LAST_GPU_MS];
      _perfMsg.gpu.p50 = percentile(_statsGpu, n, 50);
      _perfMsg.gpu.p95 = percentile(_statsGpu, n, 95);
      _perfMsg.hud.ewma = _r64[R_HUD_MS];
      _perfMsg.hud.p50 = percentile(_statsHud, n, 50);
      _perfMsg.hud.p95 = percentile(_statsHud, n, 95);
      _perfMsg.frame.ewma = _r64[R_FRAME_MS];
      _perfMsg.frame.p50 = percentile(_statsFrame, n, 50);
      _perfMsg.frame.p95 = percentile(_statsFrame, n, 95);
      _perfMsg.mem.jsHeapUsedMB = jsHeapUsedMB;
      _perfMsg.mem.jsHeapTotalMB = jsHeapTotalMB;
      _perfMsg.mem.wasmMB = 0;
      _perfMsg.mem.peakJsHeapMB = _memPeakJsMB;
      _perfMsg.mem.peakWasmMB = 0;
      self.postMessage(_perfMsg);
    }
    Atomics.store(ctrl, workerSlotId * STRIDE + READY, lastWake);
    Atomics.notify(ctrl, workerSlotId * STRIDE + READY);
  }

  renderFrame();
}

self.onmessage = async (evt) => {
  if (evt.data.type !== 'init' && !_isForCurrentSlot(evt.data)) return;

  if (evt.data.type === 'pointer_query' || evt.data.type === 'click_query') {
    const payload = buildPointerPayload(evt.data.x, evt.data.y);
    if (payload) self.postMessage({ type: evt.data.type === 'click_query' ? 'click' : 'crosshair', payload });
    return;
  }
  if (evt.data.type === 'set_ind_sab') {
    if (!evt.data.indSab) return;
    indSab = evt.data.indSab;
    indHdrView = new DataView(indSab);
    _indSabArenaCap = Math.max(0, ((indSab.byteLength - INDSAB_ARENA_OFF) / 4) | 0);
    _pendingIndSabResize = 0;
    _dstArena = null;
    _dstArenaCap = 0;
    _indArenaView = null;
    _indArenaViewLen = 0;
    _smaCachedRevision = -1;
    _overlayRevSeen = -1;
    if (gpuRenderer) gpuRenderer.setIndSab(indSab);
    _syncAnnStatsToRustAndSab();
    return;
  }
  if (evt.data.type === 'ann_add') { _applyAnnAdd(evt.data); return; }
  if (evt.data.type === 'ann_update') { _applyAnnUpdate(evt.data); return; }
  if (evt.data.type === 'ann_remove') { _applyAnnRemove(evt.data); return; }
  if (evt.data.type === 'ann_bulk') { _applyAnnBulk(evt.data); return; }
  if (evt.data.type === 'ann_clear') { _applyAnnClear(); return; }
  if (evt.data.type === 'pane_config') {
    const nextGap = Number(evt.data.gap);
    if (Number.isFinite(nextGap) && nextGap >= 0) _paneGapPx = nextGap;
    const nextWeights = evt.data.weights;
    if (Array.isArray(nextWeights) && nextWeights.length > 0) {
      const clean = new Array(nextWeights.length);
      for (let i = 0; i < nextWeights.length; i++) {
        const w = Number(nextWeights[i]);
        clean[i] = Number.isFinite(w) && w > 0 ? w : 1;
      }
      _paneWeights = clean;
      if (gpuRenderer) gpuRenderer.setPaneConfig({ gap: _paneGapPx, weights: _paneWeights });
    }
    return;
  }
  if (evt.data.type === 'set_data_binary') {
    if (!WasmModule || !wasmMemory) return;
    try {
      const next = ingestBinaryOhlcvBuffer(evt.data.data);
      if (store && store.free) store.free();
      store = next.store;
      totalBars = next.barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: 'data_set', source: 'binary', bars: totalBars, arenaF32Count: plan.arena_len() });
    } catch (err) {
      self.postMessage({ type: 'error', message: `set_data_binary failed: ${String(err)}` });
    }
    return;
  }
  if (evt.data.type === 'set_data_soa') {
    if (!WasmModule || !wasmMemory) return;
    try {
      const next = ingestSoaPayload(evt.data, wasmMemory);
      if (store && store.free) store.free();
      store = next.store;
      totalBars = next.barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: 'data_set', source: 'soa', bars: totalBars, arenaF32Count: plan.arena_len() });
    } catch (err) {
      self.postMessage({ type: 'error', message: `set_data_soa failed: ${String(err)}` });
    }
    return;
  }
  if (evt.data.type === 'set_data_url') {
    if (!WasmModule || !wasmMemory) return;
    try {
      const url = evt.data.url;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
      const contentType = resp.headers.get('content-type') || '';
      const next = (contentType.includes('application/json') || contentType.includes('text/json'))
        ? ingestJsonBars(await resp.json(), wasmMemory)
        : ingestBinaryOhlcvBuffer(await resp.arrayBuffer());
      if (store && store.free) store.free();
      store = next.store;
      totalBars = next.barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: 'data_set', source: 'url', bars: totalBars, arenaF32Count: plan.arena_len() });
    } catch (err) {
      self.postMessage({ type: 'error', message: `set_data_url failed: ${String(err)}` });
    }
    return;
  }
  if (evt.data.type === 'update_sma_periods') {
    _sma1 = (evt.data.sma1 | 0) > 0 ? (evt.data.sma1 | 0) : _sma1;
    _sma2 = (evt.data.sma2 | 0) > 0 ? (evt.data.sma2 | 0) : _sma2;
    _sma3 = (evt.data.sma3 | 0) > 0 ? (evt.data.sma3 | 0) : _sma3;
    LEGEND_ENTRIES[0].label = 'SMA ' + _sma1;
    LEGEND_ENTRIES[1].label = 'SMA ' + _sma2;
    LEGEND_ENTRIES[2].label = 'SMA ' + _sma3;
    smaPrefix1 = 'SMA ' + _sma1 + ':';
    smaPrefix2 = 'SMA ' + _sma2 + ':';
    smaPrefix3 = 'SMA ' + _sma3 + ':';
    buildPlan(_sma1, _sma2, _sma3);
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
    _extraIndicators[idx] = _sanitizeExtraIndicator({ ..._extraIndicators[idx], ...evt.data, id });
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
    if (totalBars > 0) self.postMessage({ type: 'ready', bars: totalBars, arenaF32Count: plan ? plan.arena_len() : 0, format: gpuRenderer?.format });
    return;
  }
  if (_workerInitState === 1) return;
  _workerInitState = 1;

  const descriptor = evt.data.descriptor ?? { slotId: 0, ctrl: evt.data.ctrl, indSab: evt.data.indSab };
  workerSlotId = ((descriptor.slotId | 0) >>> 0);
  ctrl = new Int32Array(descriptor.ctrl);
  indSab = descriptor.indSab;
  indHdrView = new DataView(indSab);
  _indSabArenaCap = Math.max(0, ((indSab.byteLength - INDSAB_ARENA_OFF) / 4) | 0);
  _sharedWasmCapability = evt.data.sharedWasmCapability ?? null;
  if (typeof evt.data.dpr === 'number' && evt.data.dpr >= 1) DPR = Math.round(evt.data.dpr);
  gpuCanvas = evt.data.gpuCanvas;
  hudCanvas = evt.data.hudCanvas;

  try {
    await ensureWasmInitialized();
    gpuRenderer = new GpuRenderer();
    gpuRenderer.dpr = DPR;
    const { format } = await gpuRenderer.init(gpuCanvas);
    gpuRenderer.setIndSab(indSab);
    gpuRenderer.setPaneConfig({ gap: _paneGapPx, weights: _paneWeights });
    hud = hudCanvas.getContext('2d');
    if (!hud) throw new Error('Failed to get Canvas 2D context');
    _useLegacyDefaultIndicators = evt.data.skipDefaultIndicators !== true;
    _baseIndicators = [];
    if (!_useLegacyDefaultIndicators && Array.isArray(evt.data.initialIndicators)) {
      for (let i = 0; i < evt.data.initialIndicators.length; i++) {
        _baseIndicators.push(_sanitizeExtraIndicator({ ...evt.data.initialIndicators[i], id: `base_${i}` }));
      }
    }
    if (evt.data.skipDefaultData === true) {
      store = new WasmModule.OhlcvStore(0.01, 100.0, 64, 1024);
      totalBars = 0;
    } else {
      const next = await loadBinaryOhlcv('../MSFT.bin');
      store = next.store;
      totalBars = next.barCount;
    }
    buildPlan(_sma1, _sma2, _sma3);
    _syncAnnStatsToRustAndSab();
    _workerInitState = 2;
    self.postMessage({ type: 'ready', bars: totalBars, arenaF32Count: plan.arena_len(), format });
    renderLoop();
  } catch (err) {
    _workerInitState = 0;
    console.error('[unified_worker] init failed:', err);
    self.postMessage({ type: 'error', message: String(err) });
  }
};