/**
 * render_worker.js — Legacy split-path render worker (pure JavaScript, no WASM)
 *
 * Compatibility note:
 *   This file remains only for the old data_worker/render_worker split pipeline.
 *   The crate demo's primary runtime path is unified_worker.js.
 *
 * Receives SoA + FDB frame data from data_worker via SharedArrayBuffer (frameBuf).
 * Renders candles + SMA indicators via WebGPU, draws HUD via Canvas 2D.
 *
 * No WASM.  No OhlcvStore.  GPU command encoding is entirely in JS (Architecture Inversion).
 *
 * Message protocol (from main thread):
 *   { type: 'init', gpuCanvas, hudCanvas, ctrl, frameCtrl, frameBuf }
 *
 * Message protocol (to main thread):
 *   { type: 'ready', format }   — GPU init complete
 *   { type: 'perf', ... }       — every 16 active frames
 *   { type: 'error', message }  — on failure
 */

import { GpuRenderer } from './gpu_renderer.js';
import {
  STRIDE, WAKE, READY, DIRTY, GPU_DIRTY, HUD_DIRTY,
  PLOT_W, PLOT_H, POINTER_X, POINTER_Y, SUBPIXEL_PAN_X, RIGHT_MARGIN_BARS,
  i32ToF32,
  FRAME_MAX_BARS,
  FBUF_HDR_BYTES,
  FBUF_VIEW_LEN, FBUF_VIS_BARS, FBUF_START_BAR, FBUF_FRAME_START_BAR,
  FBUF_VIEW_OPEN_PTR, FBUF_VIEW_HIGH_PTR, FBUF_VIEW_LOW_PTR, FBUF_VIEW_CLOSE_PTR, FBUF_VIEW_VOL_PTR, FBUF_VIEW_TIME_PTR,
  FBUF_CANVAS_W, FBUF_CANVAS_H,
  FBUF_PRICE_MIN, FBUF_PRICE_MAX, FBUF_FLAGS,
  FBUF_TIME_OFF, FBUF_OPEN_OFF, FBUF_HIGH_OFF, FBUF_LOW_OFF, FBUF_CLOSE_OFF, FBUF_VOL_OFF,
  FCTRL_READY, FCTRL_ACK,
  INDSAB_ARENA_LEN, INDSAB_CMD_COUNT,
  INDSAB_CMD_BASE, INDSAB_CMD_STRIDE, INDSAB_CMD_ARENA_OFFSET, INDSAB_CMD_BAR_COUNT,
  INDSAB_CMD_FLAG_MASK, INDSAB_CMD_STYLE,
  INDSAB_ARENA_OFF,
  INDSAB_OVERLAY_STD430_OFF, INDSAB_OVERLAY_STD430_WORDS, INDSAB_OVERLAY_REV_OFF,
} from './shared_protocol.js';

const _gpuViewportShift = { panOffsetPx: 0, extraLeftBars: 0, rightMarginBars: 0 };

// DPR is set from the main thread's init message (self.devicePixelRatio is
// unreliable in Workers — may be undefined or 1 depending on browser version).
// Math.round instead of Math.ceil: avoids 2x over-render on 1.25x/1.5x DPR displays.
let DPR = Math.round(self.devicePixelRatio || 1);

const LEGEND_ENTRIES = [
  { bit: 1, label: 'SMA 5',  color: '#00BCD4' },
  { bit: 2, label: 'SMA 25',  color: '#FFC107' },
  { bit: 4, label: 'SMA 75', color: '#E91E63' },
  { bit: 16, label: 'HM', color: '#888888' },
];

let smaPeriods = { sma1: 5, sma2: 25, sma3: 75 };
// Pre-computed prefix strings used in hot crosshair-tooltip loop (avoids per-frame template literals)
let smaPrefix1 = 'SMA 5:', smaPrefix2 = 'SMA 25:', smaPrefix3 = 'SMA 75:';

// ── Runtime scalars (avoid per-frame allocation) ─────────────────────────────
const _r64 = new Float64Array(6);
const R_LAST_GPU_MS = 0;
const R_CACHED_PMIN = 1;
const R_CACHED_PMAX = 2;
const R_HUD_MS      = 3;
const R_FRAME_MS    = 4;
_r64[R_CACHED_PMIN] = NaN;
_r64[R_CACHED_PMAX] = NaN;

// ── Latency ring buffers (64 samples) ────────────────────────────────────────
const STATS_SIZE   = 64;
const _statsGpu    = new Float32Array(STATS_SIZE);
const _statsHud    = new Float32Array(STATS_SIZE);
const _statsFrame  = new Float32Array(STATS_SIZE);
let   _statsHead   = 0;
let   _statsFilled = 0;
const _sortScratch = new Float32Array(STATS_SIZE);
const PERF_POST_INTERVAL_MS = 500;
let _lastPerfPostTs = 0;

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
let _memPeakJsMB = 0;

// ── Date string cache ─────────────────────────────────────────────────────────
const _dateCache = new Map();
const DATE_CACHE_MAX = 512;
function isoDateStr(ms) {
  let s = _dateCache.get(ms);
  if (s !== undefined) return s;
  // @zero_alloc_allow: Date parsing and string formatting is cached immediately
  const d = new Date(ms), m = d.getUTCMonth() + 1, dy = d.getUTCDate();
  // @zero_alloc_allow: Template string required for formatting, but is cached
  s = `${d.getUTCFullYear()}-${m<10?'0':''}${m}-${dy<10?'0':''}${dy}`;
  if (_dateCache.size >= DATE_CACHE_MAX) _dateCache.delete(_dateCache.keys().next().value);
  _dateCache.set(ms, s);
  return s;
}

// ── Worker-global state ───────────────────────────────────────────────────────
/** @type {OffscreenCanvas} */                    let gpuCanvas;
/** @type {OffscreenCanvas} */                    let hudCanvas;
/** @type {OffscreenCanvasRenderingContext2D} */   let hud;
/** @type {Int32Array} */                          let ctrl;
/** @type {Int32Array} */                          let frameCtrl;
/** @type {SharedArrayBuffer} */                   let frameBuf;
/** @type {DataView} */                            let fdbHdr;
/** @type {GpuRenderer} */                         let gpuRenderer;
/** @type {{enabled?: boolean, reason?: string | null} | null} */ let _sharedWasmCapability = null;
/** @type {number} */ let _sharedWasmFdbBase = 0;
/** @type {SharedArrayBuffer|null} */ let _sharedWasmMemory = null;
/** @type {number} */ let _sharedOpenPtr = -1;
/** @type {number} */ let _sharedHighPtr = -1;
/** @type {number} */ let _sharedLowPtr = -1;
/** @type {number} */ let _sharedClosePtr = -1;
/** @type {number} */ let _sharedVolPtr = -1;
/** @type {number} */ let _sharedTimePtr = -1;
/** @type {number} */ let _sharedViewCap = 0;

// ── Pre-allocated SoA views on frameBuf (FRAME_MAX_BARS capacity) ─────────
// Created once at init; used for tooltip OHLCV reads and date axis.
// Avoids 6× per-hover + 1× per-frame TypedArray allocation in the rAF loop.
/** @type {Float32Array} */ let _fbOpen;
/** @type {Float32Array} */ let _fbHigh;
/** @type {Float32Array} */ let _fbLow;
/** @type {Float32Array} */ let _fbClose;
/** @type {Float32Array} */ let _fbVol;
/** @type {Float64Array} */ let _fbTime;

function _syncGpuRendererFrameViews() {
  if (!gpuRenderer) return;
  gpuRenderer.setFrameViews(_fbOpen, _fbHigh, _fbLow, _fbClose, _fbVol);
}

function _refreshSharedFrameViews(viewLen) {
  if (!_sharedWasmMemory || !fdbHdr) return false;
  const openPtr = fdbHdr.getUint32(FBUF_VIEW_OPEN_PTR, true);
  const highPtr = fdbHdr.getUint32(FBUF_VIEW_HIGH_PTR, true);
  const lowPtr = fdbHdr.getUint32(FBUF_VIEW_LOW_PTR, true);
  const closePtr = fdbHdr.getUint32(FBUF_VIEW_CLOSE_PTR, true);
  const volPtr = fdbHdr.getUint32(FBUF_VIEW_VOL_PTR, true);
  const timePtr = fdbHdr.getUint32(FBUF_VIEW_TIME_PTR, true);
  const requiredCap = Math.max(1, viewLen);
  const changed = _fbOpen == null
    || openPtr !== _sharedOpenPtr
    || highPtr !== _sharedHighPtr
    || lowPtr !== _sharedLowPtr
    || closePtr !== _sharedClosePtr
    || volPtr !== _sharedVolPtr
    || timePtr !== _sharedTimePtr
    || requiredCap > _sharedViewCap;
  if (!changed) return true;
  if (openPtr === 0 || highPtr === 0 || lowPtr === 0 || closePtr === 0 || volPtr === 0 || timePtr === 0) return false;
  _sharedOpenPtr = openPtr;
  _sharedHighPtr = highPtr;
  _sharedLowPtr = lowPtr;
  _sharedClosePtr = closePtr;
  _sharedVolPtr = volPtr;
  _sharedTimePtr = timePtr;
  _sharedViewCap = requiredCap;
  // @zero_alloc_allow: Rebind shared WASM views only when source pointers change or capacity grows.
  _fbOpen = new Float32Array(_sharedWasmMemory, openPtr, requiredCap);
  // @zero_alloc_allow: Rebind shared WASM views only when source pointers change or capacity grows.
  _fbHigh = new Float32Array(_sharedWasmMemory, highPtr, requiredCap);
  // @zero_alloc_allow: Rebind shared WASM views only when source pointers change or capacity grows.
  _fbLow = new Float32Array(_sharedWasmMemory, lowPtr, requiredCap);
  // @zero_alloc_allow: Rebind shared WASM views only when source pointers change or capacity grows.
  _fbClose = new Float32Array(_sharedWasmMemory, closePtr, requiredCap);
  // @zero_alloc_allow: Rebind shared WASM views only when source pointers change or capacity grows.
  _fbVol = new Float32Array(_sharedWasmMemory, volPtr, requiredCap);
  // @zero_alloc_allow: Rebind shared WASM views only when source pointers change or capacity grows.
  _fbTime = new Float64Array(_sharedWasmMemory, timePtr, requiredCap);
  _syncGpuRendererFrameViews();
  return true;
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Reusable object to avoid garbage collection on pointer hover
const _popupData = { open: 0, high: 0, low: 0, close: 0, vol: 0, sma20: 0, sma50: 0, sma100: 0 };

// ── EP arena SMA reader (Tier 2: replaces legacy frameBuf SMA channel reads) ─
// The EP arena in indSab carries all indicator output. For the tooltip we need
// SMA values at a specific bar index. The cmd table tells us each SMA's arena_offset.
// SMA render cmds are style=ThickLine(1), flag_mask=1/2/4 for the 3 SMA lines.
// Cache the arena offsets (updated when revision changes).
let _smaArenaOff = [0, 0, 0];       // arena f32 offset for SMA1, SMA2, SMA3
let _smaBarCount = [0, 0, 0];       // bar_count per SMA (for bounds check)
let _smaCachedRevision = -1;
/** @type {SharedArrayBuffer|null} */ let _indSabRef = null;
/** @type {DataView|null} */          let _indSabHdr = null;  // cached DataView on indSab header
/** @type {Float32Array|null} */      let _indArenaView = null;  // cached max-capacity arena view
/** @type {number} */                 let _indArenaViewLen = 0;  // current cached arena capacity
/** @type {number} */                 let workerSlotId = 0;
/** @type {number} */                 let _overlayRevSeen = -1;
const _overlaySummaryWords = new Uint32Array(INDSAB_OVERLAY_STD430_WORDS);

/**
 * Read SMA values at bar index `idx` from the EP arena in indSab.
 * Populates _popupData.sma20/sma50/sma100 (names are legacy but represent SMA1/2/3).
 * Zero-allocation: reads directly from Float32Array view on the existing SAB.
 * @param {number} idx bar index within the visible window
 */
function _readSmaPop(idx) {
  if (!_indSabRef || !_indSabHdr) { _popupData.sma20 = NaN; _popupData.sma50 = NaN; _popupData.sma100 = NaN; return; }
  const hdr = _indSabHdr;
  const rev = hdr.getUint32(12, true);  // INDSAB_REVISION
  // Refresh cached offsets on revision change
  if (rev !== _smaCachedRevision) {
    _smaCachedRevision = rev;
    const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
    // Walk cmd table to find SMA lines by flag_mask (1, 2, 4)
    _smaArenaOff[0] = _smaArenaOff[1] = _smaArenaOff[2] = 0;
    _smaBarCount[0] = _smaBarCount[1] = _smaBarCount[2] = 0;
    for (let ci = 0; ci < cmdCount; ci++) {
      const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
      const flagMask = hdr.getUint32(base + INDSAB_CMD_FLAG_MASK, true);
      const style    = hdr.getUint32(base + INDSAB_CMD_STYLE, true);
      if (style !== 1) continue;  // ThickLine only
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
  // Read values from arena section of indSab using cached view.
  // Re-create _indArenaView only when arena length grows (rare: plan recompile).
  const arenaLen = hdr.getUint32(INDSAB_ARENA_LEN, true);
  if (!_indArenaView || arenaLen > _indArenaViewLen) {
    // @zero_alloc_allow: View recreation is guarded and amortized to O(1)
    _indArenaView = new Float32Array(_indSabRef, INDSAB_ARENA_OFF, arenaLen);
    _indArenaViewLen = arenaLen;
  }
  _popupData.sma20  = (idx < _smaBarCount[0] && _smaArenaOff[0] + idx < arenaLen) ? _indArenaView[_smaArenaOff[0] + idx] : NaN;
  _popupData.sma50  = (idx < _smaBarCount[1] && _smaArenaOff[1] + idx < arenaLen) ? _indArenaView[_smaArenaOff[1] + idx] : NaN;
  _popupData.sma100 = (idx < _smaBarCount[2] && _smaArenaOff[2] + idx < arenaLen) ? _indArenaView[_smaArenaOff[2] + idx] : NaN;
}

function _readOverlaySummary() {
  if (!_indSabHdr) return _overlaySummaryWords;
  const rev = _indSabHdr.getUint32(INDSAB_OVERLAY_REV_OFF, true);
  if (rev === _overlayRevSeen) return _overlaySummaryWords;
  _overlayRevSeen = rev;
  for (let i = 0; i < INDSAB_OVERLAY_STD430_WORDS; i++) {
    _overlaySummaryWords[i] = _indSabHdr.getUint32(INDSAB_OVERLAY_STD430_OFF + i * 4, true);
  }
  return _overlaySummaryWords;
}

self.onmessage = async (evt) => {
    if (evt.data.type === 'set_shared_wasm_memory') {
      const nextWasmMemory = evt.data.wasmMemory;
      const nextFdbBase = Math.max(0, (evt.data.fdbBase | 0) >>> 0);
      if (!(nextWasmMemory instanceof SharedArrayBuffer) || nextFdbBase === 0) return;
      _sharedWasmMemory = nextWasmMemory;
      _sharedWasmFdbBase = nextFdbBase;
      fdbHdr = new DataView(nextWasmMemory, nextFdbBase, FBUF_HDR_BYTES);
      _sharedOpenPtr = -1;
      _sharedHighPtr = -1;
      _sharedLowPtr = -1;
      _sharedClosePtr = -1;
      _sharedVolPtr = -1;
      _sharedTimePtr = -1;
      _sharedViewCap = 0;
      return;
    }
    if (evt.data.type === 'set_ind_sab') {
      const nextIndSab = evt.data.indSab;
      if (!nextIndSab || !gpuRenderer) return;
      gpuRenderer.setIndSab(nextIndSab);
      _indSabRef = nextIndSab;
      _indSabHdr = new DataView(nextIndSab);
      _indArenaView = null;
      _indArenaViewLen = 0;
      _smaCachedRevision = -1;
      _overlayRevSeen = -1;
      return;
    }
    if (evt.data.type === 'update_sma_periods') {
      smaPeriods.sma1 = evt.data.sma1;
      smaPeriods.sma2 = evt.data.sma2;
      smaPeriods.sma3 = evt.data.sma3;
      LEGEND_ENTRIES[0].label = 'SMA ' + evt.data.sma1;
      LEGEND_ENTRIES[1].label = 'SMA ' + evt.data.sma2;
      LEGEND_ENTRIES[2].label = 'SMA ' + evt.data.sma3;
      smaPrefix1 = 'SMA ' + evt.data.sma1 + ':';
      smaPrefix2 = 'SMA ' + evt.data.sma2 + ':';
      smaPrefix3 = 'SMA ' + evt.data.sma3 + ':';
      return;
  }
  if (evt.data.type === 'config') {
    if (gpuRenderer && evt.data.paneConfig) {
      gpuRenderer.setPaneConfig(evt.data.paneConfig);
      _r64[R_CACHED_PMIN] = NaN; // force redraw GPU pass
      // We also need HUD to redraw its axes. It relies on hudDirty, which is sent by main thread.
    }
    return;
  }
  if (evt.data.type !== 'init') return;
  const descriptor = evt.data.descriptor ?? {
    slotId: 0,
    ctrl: evt.data.ctrl,
    frameCtrl: evt.data.frameCtrl,
    frameBuf: evt.data.frameBuf,
    indSab: evt.data.indSab,
    wasmMemory: null,
    fdbBase: 0,
  };
  const { gpuCanvas: gc, hudCanvas: hc } = evt.data;
  workerSlotId = ((descriptor.slotId | 0) >>> 0);
  const ctrlBuf = descriptor.ctrl;
  const frcBuf = descriptor.frameCtrl;
  const fsBuf = descriptor.frameBuf;
  const indSab = descriptor.indSab;
  _sharedWasmCapability = evt.data.sharedWasmCapability ?? null;
  _sharedWasmFdbBase = Math.max(0, (descriptor.fdbBase | 0) >>> 0);
  _sharedWasmMemory = descriptor.wasmMemory instanceof SharedArrayBuffer ? descriptor.wasmMemory : null;
  // Use authoritative DPR from main thread
  if (typeof evt.data.dpr === 'number' && evt.data.dpr >= 1) {
    DPR = Math.round(evt.data.dpr);
  }
  console.log('[render_worker] DPR:', DPR, 'slot:', workerSlotId, 'sharedWasm:', _sharedWasmCapability?.enabled ? 'capable' : 'disabled', 'fdbBase:', _sharedWasmFdbBase);
  gpuCanvas  = gc; hudCanvas = hc;
  ctrl       = new Int32Array(ctrlBuf);
  frameCtrl  = new Int32Array(frcBuf);
  frameBuf   = fsBuf;
  fdbHdr     = _sharedWasmMemory && _sharedWasmFdbBase > 0
    ? new DataView(_sharedWasmMemory, _sharedWasmFdbBase, FBUF_HDR_BYTES)
    : new DataView(fsBuf, 0, FBUF_HDR_BYTES);

  // Pre-allocate max-capacity SoA views on frameBuf (created once, used every hover/frame)
  _fbOpen  = new Float32Array(fsBuf, FBUF_OPEN_OFF,  FRAME_MAX_BARS);
  _fbHigh  = new Float32Array(fsBuf, FBUF_HIGH_OFF,  FRAME_MAX_BARS);
  _fbLow   = new Float32Array(fsBuf, FBUF_LOW_OFF,   FRAME_MAX_BARS);
  _fbClose = new Float32Array(fsBuf, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
  _fbVol   = new Float32Array(fsBuf, FBUF_VOL_OFF,   FRAME_MAX_BARS);
  _fbTime  = new Float64Array(fsBuf, FBUF_TIME_OFF,  FRAME_MAX_BARS);

  try {
    gpuRenderer = new GpuRenderer();
    gpuRenderer.dpr = DPR;
    const { format } = await gpuRenderer.init(gpuCanvas);
    // Pre-allocate SoA views on frameBuf for zero-alloc GPU upload
    gpuRenderer.setLegacyFrameBufViews(fsBuf);
    _syncGpuRendererFrameViews();
    // Wire up EP indicator arena if data_worker provides one
    if (indSab) {
      gpuRenderer.setIndSab(indSab);
      _indSabRef = indSab;              // cache for _readSmaPop tooltip helper
      _indSabHdr = new DataView(indSab); // single DataView, reused every hover
    }
    hud = hudCanvas.getContext('2d');
    if (!hud) throw new Error('Failed to get Canvas 2D context');
    self.postMessage({ type: 'ready', format });
    renderLoop();
  } catch (err) {
    console.error('[render_worker] init failed:', err);
    self.postMessage({ type: 'error', message: String(err) });
  }
};

// ── Render loop ───────────────────────────────────────────────────────────────
function renderLoop() {
  let lastFrameReadyVal = 0;
  const hudHasCommit = typeof hud.commit === 'function';
  let firstFrame = true;

  /** @zero_alloc */
  function renderFrame() {
    if (self.requestAnimationFrame) {
      self.requestAnimationFrame(renderFrame);
    } else {
      setTimeout(renderFrame, 16);
    }

    // Check if data_worker produced a new frame
    const currentReadyVal = Atomics.load(frameCtrl, FCTRL_READY);
    if (currentReadyVal === lastFrameReadyVal) return;
    lastFrameReadyVal = currentReadyVal;

    // Read FDB header
    const viewLen = fdbHdr.getUint32 (FBUF_VIEW_LEN, true);
    const physW   = fdbHdr.getFloat32(FBUF_CANVAS_W, true);
    const physH   = fdbHdr.getFloat32(FBUF_CANVAS_H, true);
    const flags   = fdbHdr.getUint32 (FBUF_FLAGS,    true);
    if (_sharedWasmMemory) {
      _refreshSharedFrameViews(viewLen);
    }

    const ci = workerSlotId;
    const dirtyBits = Atomics.load(ctrl, ci * STRIDE + DIRTY);
    const gpuDirty  = (dirtyBits & GPU_DIRTY) !== 0;
    const hudDirty  = (dirtyBits & HUD_DIRTY)  !== 0;

    if (viewLen < 1 || physW < 4 || physH < 4) {
      Atomics.store(frameCtrl, FCTRL_ACK, lastFrameReadyVal);
      return;
    }

    // Resize if needed
    if (gpuCanvas.width !== physW || gpuCanvas.height !== physH) {
      // @zero_alloc_allow: setSize may reconfigure GPU resources only on resize, not per steady-state frame.
      gpuRenderer.setSize(gpuCanvas, physW, physH);
      hudCanvas.width  = physW;
      hudCanvas.height = physH;
      _r64[R_CACHED_PMIN] = NaN;   // force redraw after resize
    }

    const t0_frame = performance.now();
    let t_gpu_ms = 0, t_hud_ms = 0;

    // ── GPU pass ─────────────────────────────────────────────────────────────
    if (gpuDirty || isNaN(_r64[R_CACHED_PMIN])) {
      const t0_gpu = performance.now();
      try {
        const panOffsetPx = i32ToF32(Atomics.load(ctrl, ci * STRIDE + SUBPIXEL_PAN_X));
        const frameStartBar = fdbHdr.getUint32(FBUF_FRAME_START_BAR, true);
        // @zero_alloc_allow: drawGpu internals are audited separately; keep renderFrame gate focused on worker-frame allocations.
        _gpuViewportShift.panOffsetPx = panOffsetPx;
        _gpuViewportShift.extraLeftBars = Math.max(0, fdbHdr.getUint32(FBUF_START_BAR, true) - frameStartBar);
        _gpuViewportShift.rightMarginBars = Math.max(0, Atomics.load(ctrl, ci * STRIDE + RIGHT_MARGIN_BARS));
        const [pMin, pMax] = gpuRenderer.drawGpu(fdbHdr, viewLen, _gpuViewportShift);
        _r64[R_CACHED_PMIN] = pMin;
        _r64[R_CACHED_PMAX] = pMax;
        if (firstFrame) {
          firstFrame = false;
          console.log('[render_worker] FIRST GPU FRAME | viewLen:', viewLen, '| physW:', physW, 'physH:', physH);
        }
      } catch (e) { console.error('[render_worker] GPU pass error:', e); }
      t_gpu_ms = performance.now() - t0_gpu;
      _r64[R_LAST_GPU_MS] = _r64[R_LAST_GPU_MS] * 0.9 + t_gpu_ms * 0.1;
    }

    // ── HUD pass ─────────────────────────────────────────────────────────────
    if (hudDirty) {
      const t0_hud = performance.now();
      try {
        const pMin = _r64[R_CACHED_PMIN], pMax = _r64[R_CACHED_PMAX];
        const plotW = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_W));
        const plotH = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_H));
        const ptrX  = i32ToF32(Atomics.load(ctrl, ci * STRIDE + POINTER_X));
        const ptrY  = i32ToF32(Atomics.load(ctrl, ci * STRIDE + POINTER_Y));
        const visBc = Atomics.load(ctrl, ci * STRIDE + 3);
        const rightMarginBars = Math.max(0, Atomics.load(ctrl, ci * STRIDE + RIGHT_MARGIN_BARS));
        const totalSlots = Math.max(1, visBc + rightMarginBars);
        const panOffsetPx = i32ToF32(Atomics.load(ctrl, ci * STRIDE + SUBPIXEL_PAN_X));
        const logicalStartBar = fdbHdr.getUint32(FBUF_START_BAR, true);
        const frameStartBar = fdbHdr.getUint32(FBUF_FRAME_START_BAR, true);

        hud.setTransform(DPR, 0, 0, DPR, 0, 0);
        hud.clearRect(0, 0, plotW, plotH);
        if (!isNaN(pMin)) {
          // We pass the raw paneLayout directly to drawing functions to avoid
          // intermediate object allocations. The functions will apply DPR locally.
          const layout = gpuRenderer.paneLayout;
          drawPriceAxis(hud, plotW, plotH, pMin, pMax, layout);
          drawDateAxis(hud, plotW, plotH, viewLen);
          if (ptrX >= 0 && ptrY >= 0 && ptrX < plotW && ptrY < plotH) {
            const chartAreaW = plotW - 60;
            const barStep = chartAreaW / totalSlots;
            const offsetSlots = (logicalStartBar - frameStartBar) + (panOffsetPx / Math.max(1e-6, barStep));
            const lIdx = Math.max(0, Math.min(viewLen - 1, Math.floor(ptrX / Math.max(1e-6, barStep) + offsetSlots)));
            let dateLabel = '';
            let popupData = null;
            if (viewLen > 0 && lIdx < viewLen) {
              dateLabel = isoDateStr(_fbTime[lIdx]);
              _popupData.open  = _fbOpen[lIdx];
              _popupData.high  = _fbHigh[lIdx];
              _popupData.low   = _fbLow[lIdx];
              _popupData.close = _fbClose[lIdx];
              _popupData.vol   = _fbVol[lIdx];
              // Attach stable identity for popup-cache invalidation.
              _popupData.time = _fbTime[lIdx];
              // SMA values read from EP arena (no legacy frameBuf SMA channels)
              _readSmaPop(lIdx);
              popupData = _popupData;
            }
            drawCrosshair(hud, plotW, plotH, ptrX, ptrY, pMin, pMax, layout, dateLabel, popupData, flags);
          }
          drawLegend(hud, flags, _readOverlaySummary());
          if (layout) drawPaneBorders(hud, plotW, layout);
        }
        if (hudHasCommit) hud.commit();
      } catch (e) { console.error('[render_worker] HUD error:', e); }
      t_hud_ms = performance.now() - t0_hud;
      _r64[R_HUD_MS] = _r64[R_HUD_MS] * 0.9 + t_hud_ms * 0.1;
    }

    // ── Stats ─────────────────────────────────────────────────────────────────
    const frameMs = performance.now() - t0_frame;
    _r64[R_FRAME_MS] = _r64[R_FRAME_MS] * 0.9 + frameMs * 0.1;
    _statsGpu[_statsHead]   = t_gpu_ms;
    _statsHud[_statsHead]   = t_hud_ms;
    _statsFrame[_statsHead] = frameMs;
    _statsHead = (_statsHead + 1) % STATS_SIZE;
    if (_statsFilled < STATS_SIZE) _statsFilled++;

    if (_statsFilled > 0 && (t0_frame - _lastPerfPostTs) >= PERF_POST_INTERVAL_MS) {
      _lastPerfPostTs = t0_frame;
      const n = _statsFilled;
      const jsHeapUsedMB  = (performance.memory?.usedJSHeapSize  ?? 0) / 1048576;
      const jsHeapTotalMB = (performance.memory?.totalJSHeapSize ?? 0) / 1048576;
      if (jsHeapUsedMB > _memPeakJsMB) _memPeakJsMB = jsHeapUsedMB;
      // @zero_alloc_allow: Reporting metrics every few seconds to main thread, unavoidable boundary clone
      self.postMessage({
        type: 'perf',
        wasm:  { ewma: 0, p50: 0, p95: 0 },
        gpu:   { ewma: _r64[R_LAST_GPU_MS], p50: percentile(_statsGpu,   n, 50), p95: percentile(_statsGpu,   n, 95) },
        hud:   { ewma: _r64[R_HUD_MS],      p50: percentile(_statsHud,   n, 50), p95: percentile(_statsHud,   n, 95) },
        frame: { ewma: _r64[R_FRAME_MS],    p50: percentile(_statsFrame, n, 50), p95: percentile(_statsFrame, n, 95) },
        visBars: fdbHdr.getUint32(FBUF_VIS_BARS, true),
        mem: { jsHeapUsedMB, jsHeapTotalMB, wasmMB: 0, peakJsHeapMB: _memPeakJsMB, peakWasmMB: 0 },
      });
    }
    Atomics.store(frameCtrl, FCTRL_ACK, lastFrameReadyVal);
  }
  
  renderFrame();
}

// ── HUD drawing helpers ───────────────────────────────────────────────────────

function niceStep(range, ticks) {
  const raw = range / Math.max(1, ticks);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const r = raw / pow;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * pow;
}

const _dashArray1 = [3, 4];
const _dashArrayEmpty = [];

function drawPriceAxis(ctx, w, h, yMin, yMax, layout) {
  const plotW = w - 60;
  
  // Define layout bounds for main pane
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
    // @zero_alloc_allow: Fast string format required for price labels
    ctx.fillText(v.toFixed(2), w - 4, y);
  }
  ctx.restore();
}

function drawDateAxis(ctx, w, h, viewLen) {
  if (viewLen === 0) return;
  const plotW = w - 60;
  const logicalStartBar = fdbHdr.getUint32(FBUF_START_BAR, true);
  const frameStartBar = fdbHdr.getUint32(FBUF_FRAME_START_BAR, true);
  const visBars = Math.max(1, fdbHdr.getUint32(FBUF_VIS_BARS, true));
  const rightMarginBars = Math.max(0, Atomics.load(ctrl, workerSlotId * STRIDE + RIGHT_MARGIN_BARS));
  const totalSlots = Math.max(1, visBars + rightMarginBars);
  const panOffsetPx = i32ToF32(Atomics.load(ctrl, workerSlotId * STRIDE + SUBPIXEL_PAN_X));
  const slotW = plotW / totalSlots;
  const offsetSlots = (logicalStartBar - frameStartBar) + (panOffsetPx / Math.max(1e-6, slotW));
  // Use pre-allocated _fbTime view (FRAME_MAX_BARS capacity) — zero alloc
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

const _dashArrayCrosshair = [4, 4];

// Caches to avoid repeated string allocations & measureText in drawCrosshair
const _popupCache = {
  lastBarTime: NaN,
  lastFlags: -1,
  lines: ['', '', '', '', '', '', ''],
  widths: [0, 0, 0, 0, 0, 0, 0],
  lineCount: 0,
};

const _priceLabelCache = { last: NaN, str: '' };

function drawCrosshair(ctx, w, h, px, py, yMin, yMax, layout, dateLabel = '', popupData = null, flags = 0) {
  const plotW = w - 60, clampedX = Math.min(px, plotW), DATE_BADGE_H = 16;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.40)';
  ctx.setLineDash(_dashArrayCrosshair);
  ctx.beginPath(); ctx.moveTo(clampedX, 0);
  ctx.lineTo(clampedX, dateLabel ? h - DATE_BADGE_H : h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(plotW, py); ctx.stroke();
  ctx.setLineDash(_dashArrayEmpty);
  
  // Define layout bounds for main pane (for price axis tag)
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : h;

  if (py >= boundY && py <= boundY + boundH) {
    const price = yMax - ((py - boundY) / boundH) * (yMax - yMin);
    ctx.fillStyle = '#ddd'; ctx.fillRect(plotW + 1, py - 9, 58, 18);
    ctx.fillStyle = '#222'; ctx.font = '10px monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    // Cached price label to avoid allocating strings per-frame
    let priceStr;
    if (_priceLabelCache.last !== price) {
      _priceLabelCache.last = price;
      // @zero_alloc_allow: Cached label is rebuilt only when price changes.
      _priceLabelCache.str = price.toFixed(2);
    }
    priceStr = _priceLabelCache.str;
    ctx.fillText(priceStr, w - 4, py);
  }

  if (dateLabel) {
    ctx.font = '10px monospace';
    const tw = ctx.measureText(dateLabel).width, bw = tw + 8;
    const bx = Math.max(0, Math.min(clampedX - bw / 2, plotW - bw));
    const by = h - DATE_BADGE_H;
    ctx.fillStyle = '#ddd'; ctx.fillRect(bx, by, bw, DATE_BADGE_H);
    ctx.fillStyle = '#222'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(dateLabel, bx + 4, by + DATE_BADGE_H / 2);
  }

  // Draw OHLCV + Indicator popup inside the chart area
  if (popupData && py >= boundY && py <= boundY + boundH && px <= plotW) {
    const cursorPrice = yMax - ((py - boundY) / boundH) * (yMax - yMin);
    const hitMargin = 15 * (yMax - yMin) / Math.max(1, boundH);
    let hit = false;
    if (cursorPrice >= popupData.low - hitMargin && cursorPrice <= popupData.high + hitMargin) hit = true;
    if (!hit && (flags & 1) && !Number.isNaN(popupData.sma20) && Math.abs(cursorPrice - popupData.sma20) < hitMargin) hit = true;
    if (!hit && (flags & 2) && !Number.isNaN(popupData.sma50) && Math.abs(cursorPrice - popupData.sma50) < hitMargin) hit = true;
    if (!hit && (flags & 4) && !Number.isNaN(popupData.sma100) && Math.abs(cursorPrice - popupData.sma100) < hitMargin) hit = true;

    if (hit) {
      // Rebuild popup strings only when bar identity or indicator set changes.
      const barTime = Number.isFinite(popupData.time) ? popupData.time : NaN;
      if (_popupCache.lastBarTime !== barTime || _popupCache.lastFlags !== flags) {
        _popupCache.lastBarTime = barTime;
        _popupCache.lastFlags = flags;
        _popupCache.lines[0] = 'Date: ' + dateLabel;
        // @zero_alloc_allow: Popup strings are rebuilt only on bar/flag boundary changes.
        _popupCache.lines[1] = 'O: ' + popupData.open.toFixed(2) + '  H: ' + popupData.high.toFixed(2);
        // @zero_alloc_allow: Popup strings are rebuilt only on bar/flag boundary changes.
        _popupCache.lines[2] = 'L: ' + popupData.low.toFixed(2) + '  C: ' + popupData.close.toFixed(2);
        // @zero_alloc_allow: formatVolume allocates strings intentionally for display text; cached via _popupCache.
        _popupCache.lines[3] = 'Vol: ' + formatVolume(popupData.vol);
        const hasSma20 = (flags & 1) && !Number.isNaN(popupData.sma20) && popupData.sma20 > 0;
        const hasSma50 = (flags & 2) && !Number.isNaN(popupData.sma50) && popupData.sma50 > 0;
        const hasSma100 = (flags & 4) && !Number.isNaN(popupData.sma100) && popupData.sma100 > 0;
        _popupCache.lineCount = 4 + (hasSma20 ? 1 : 0) + (hasSma50 ? 1 : 0) + (hasSma100 ? 1 : 0);
        // @zero_alloc_allow: Indicator text labels are rebuilt only when popup cache invalidates.
        _popupCache.lines[4] = hasSma20 ? (smaPrefix1 + ' ' + popupData.sma20.toFixed(2)) : '';
        // @zero_alloc_allow: Indicator text labels are rebuilt only when popup cache invalidates.
        _popupCache.lines[5] = hasSma50 ? (smaPrefix2 + ' ' + popupData.sma50.toFixed(2)) : '';
        // @zero_alloc_allow: Indicator text labels are rebuilt only when popup cache invalidates.
        _popupCache.lines[6] = hasSma100 ? (smaPrefix3 + ' ' + popupData.sma100.toFixed(2)) : '';
        // measure widths once and cache
        ctx.font = '11px monospace';
        _popupCache.widths[0] = ctx.measureText(_popupCache.lines[0]).width;
        _popupCache.widths[1] = ctx.measureText(_popupCache.lines[1]).width;
        _popupCache.widths[2] = ctx.measureText(_popupCache.lines[2]).width;
        _popupCache.widths[3] = ctx.measureText(_popupCache.lines[3]).width;
        _popupCache.widths[4] = _popupCache.lines[4] ? ctx.measureText(_popupCache.lines[4]).width : 0;
        _popupCache.widths[5] = _popupCache.lines[5] ? ctx.measureText(_popupCache.lines[5]).width : 0;
        _popupCache.widths[6] = _popupCache.lines[6] ? ctx.measureText(_popupCache.lines[6]).width : 0;
      }

      // compute max width from cached widths
      let maxTw = 0;
      for (let i = 0; i < _popupCache.lineCount; i++) {
        maxTw = Math.max(maxTw, _popupCache.widths[i] || 0);
      }
      const lineCount = _popupCache.lineCount;
      const boxW = maxTw + 12;
      const boxH = lineCount * 16 + 8;
      const boxX = (px + 10 + boxW < plotW) ? px + 10 : px - 10 - boxW;
      const boxY = Math.max(boundY + 4, Math.min(py - boxH / 2, boundY + boundH - boxH - 4));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.setLineDash(_dashArrayEmpty);
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let row = 0;
      // draw cached lines
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
}

// @zero_alloc_allow: Fast format path for volume, strings are immutable and cannot be pre-allocated generally without a complex atlas
function formatVolume(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toString();
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
    ctx.beginPath();
    ctx.moveTo(0, yTop); ctx.lineTo(plotW + 60, yTop);
    ctx.moveTo(0, yBot); ctx.lineTo(plotW + 60, yBot);
    ctx.stroke();
  }
  
  if (layout.sub2 && gap > 0) {
    const yTop = layout.sub2.y / DPR - gap;
    const yBot = layout.sub2.y / DPR;
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, yTop, plotW + 60, gap);
    ctx.beginPath();
    ctx.moveTo(0, yTop); ctx.lineTo(plotW + 60, yTop);
    ctx.moveTo(0, yBot); ctx.lineTo(plotW + 60, yBot);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLegend(ctx, flags, overlaySummary) {
  ctx.save();
  ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#222'; ctx.fillText('MSFT', 8, 8);
  ctx.font = '11px sans-serif'; let x = 52;
  for (let i = 0; i < LEGEND_ENTRIES.length; i++) {
    const { bit, label, color } = LEGEND_ENTRIES[i];
    if (!(flags & bit)) continue;
    ctx.fillStyle = color; ctx.fillText(label, x, 9);
    x += ctx.measureText(label).width + 12;
  }
  if (_r64[R_LAST_GPU_MS] > 0) {
    ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(0,0,0,0.45)';
    // @zero_alloc_allow: String formatting for debugging text overlay
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
    // @zero_alloc_allow: Compact HUD text is generated once per frame and bounded.
    ctx.fillText(`ANN ${total} M${marker} H${hline} Z${zone} T${text} E${event}`, x, 9);
  }
  ctx.restore();
}
