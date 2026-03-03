/**
 * render_worker.js — P1 Render Worker (pure JavaScript, no WASM)
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
  PLOT_W, PLOT_H, POINTER_X, POINTER_Y,
  i32ToF32,
  FBUF_HDR_BYTES,
  FBUF_VIEW_LEN, FBUF_VIS_BARS, FBUF_START_BAR,
  FBUF_CANVAS_W, FBUF_CANVAS_H,
  FBUF_PRICE_MIN, FBUF_PRICE_MAX, FBUF_FLAGS,
  FBUF_TIME_OFF, FBUF_OPEN_OFF, FBUF_HIGH_OFF, FBUF_LOW_OFF, FBUF_CLOSE_OFF, FBUF_VOL_OFF,
  FCTRL_READY, FCTRL_ACK,
  INDSAB_ARENA_LEN, INDSAB_CMD_COUNT,
  INDSAB_CMD_BASE, INDSAB_CMD_STRIDE, INDSAB_CMD_ARENA_OFFSET, INDSAB_CMD_BAR_COUNT,
  INDSAB_CMD_FLAG_MASK, INDSAB_CMD_STYLE,
  INDSAB_ARENA_OFF,
} from './shared_protocol.js';

// DPR is set from the main thread's init message (self.devicePixelRatio is
// unreliable in Workers — may be undefined or 1 depending on browser version).
let DPR = Math.ceil(self.devicePixelRatio || 2);

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
  const d = new Date(ms), m = d.getUTCMonth() + 1, dy = d.getUTCDate();
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

/**
 * Read SMA values at bar index `idx` from the EP arena in indSab.
 * Populates _popupData.sma20/sma50/sma100 (names are legacy but represent SMA1/2/3).
 * Zero-allocation: reads directly from Float32Array view on the existing SAB.
 * @param {number} idx bar index within the visible window
 */
function _readSmaPop(idx) {
  if (!_indSabRef) { _popupData.sma20 = NaN; _popupData.sma50 = NaN; _popupData.sma100 = NaN; return; }
  const hdr = new DataView(_indSabRef);
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
  // Read values from arena section of indSab
  const arenaLen = hdr.getUint32(INDSAB_ARENA_LEN, true);
  const arenaView = new Float32Array(_indSabRef, INDSAB_ARENA_OFF, arenaLen);
  _popupData.sma20  = (idx < _smaBarCount[0] && _smaArenaOff[0] + idx < arenaLen) ? arenaView[_smaArenaOff[0] + idx] : NaN;
  _popupData.sma50  = (idx < _smaBarCount[1] && _smaArenaOff[1] + idx < arenaLen) ? arenaView[_smaArenaOff[1] + idx] : NaN;
  _popupData.sma100 = (idx < _smaBarCount[2] && _smaArenaOff[2] + idx < arenaLen) ? arenaView[_smaArenaOff[2] + idx] : NaN;
}

self.onmessage = async (evt) => {
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
  const { gpuCanvas: gc, hudCanvas: hc, ctrl: ctrlBuf,
          frameCtrl: frcBuf, frameBuf: fsBuf, indSab } = evt.data;
  // Use authoritative DPR from main thread
  if (typeof evt.data.dpr === 'number' && evt.data.dpr >= 1) {
    DPR = Math.ceil(evt.data.dpr);
  }
  console.log('[render_worker] DPR:', DPR);
  gpuCanvas  = gc; hudCanvas = hc;
  ctrl       = new Int32Array(ctrlBuf);
  frameCtrl  = new Int32Array(frcBuf);
  frameBuf   = fsBuf;
  fdbHdr     = new DataView(fsBuf, 0, FBUF_HDR_BYTES);

  try {
    gpuRenderer = new GpuRenderer();
    gpuRenderer.dpr = DPR;
    const { format } = await gpuRenderer.init(gpuCanvas);
    // Wire up EP indicator arena if data_worker provides one
    if (indSab) {
      gpuRenderer.setIndSab(indSab);
      _indSabRef = indSab;  // cache for _readSmaPop tooltip helper
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
async function renderLoop() {
  let lastFrameReadyVal = 0;
  const hudHasCommit = typeof hud.commit === 'function';
  let firstFrame = true;

  while (true) {
    // Wait for data_worker to signal a new frame
    await Atomics.waitAsync(frameCtrl, FCTRL_READY, lastFrameReadyVal).value;
    lastFrameReadyVal = Atomics.load(frameCtrl, FCTRL_READY);

    // Read FDB header
    const viewLen = fdbHdr.getUint32 (FBUF_VIEW_LEN, true);
    const physW   = fdbHdr.getFloat32(FBUF_CANVAS_W, true);
    const physH   = fdbHdr.getFloat32(FBUF_CANVAS_H, true);
    const flags   = fdbHdr.getUint32 (FBUF_FLAGS,    true);

    const ci = 0;
    const dirtyBits = Atomics.load(ctrl, ci * STRIDE + DIRTY);
    const gpuDirty  = (dirtyBits & GPU_DIRTY) !== 0;
    const hudDirty  = (dirtyBits & HUD_DIRTY)  !== 0;

    if (viewLen < 1 || physW < 4 || physH < 4) continue;

    // Resize if needed
    if (gpuCanvas.width !== physW || gpuCanvas.height !== physH) {
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
        const [pMin, pMax] = gpuRenderer.drawGpu(frameBuf, fdbHdr, viewLen);
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
            const barStep = chartAreaW / Math.max(1, visBc);
            const lIdx = Math.max(0, Math.min(visBc - 1, Math.floor(ptrX / barStep)));
            let dateLabel = '';
            let popupData = null;
            if (viewLen > 0 && lIdx < viewLen) {
              dateLabel = isoDateStr(new Float64Array(frameBuf, FBUF_TIME_OFF, viewLen)[lIdx]);
              _popupData.open = new Float32Array(frameBuf, FBUF_OPEN_OFF, viewLen)[lIdx];
              _popupData.high = new Float32Array(frameBuf, FBUF_HIGH_OFF, viewLen)[lIdx];
              _popupData.low = new Float32Array(frameBuf, FBUF_LOW_OFF, viewLen)[lIdx];
              _popupData.close = new Float32Array(frameBuf, FBUF_CLOSE_OFF, viewLen)[lIdx];
              _popupData.vol = new Float32Array(frameBuf, FBUF_VOL_OFF, viewLen)[lIdx];
              // SMA values read from EP arena (no legacy frameBuf SMA channels)
              _readSmaPop(lIdx);
              popupData = _popupData;
            }
            drawCrosshair(hud, plotW, plotH, ptrX, ptrY, pMin, pMax, layout, dateLabel, popupData, flags);
          }
          drawLegend(hud, flags);
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

    if ((lastFrameReadyVal & 15) === 0 && _statsFilled > 0) {
      const n = _statsFilled;
      const jsHeapUsedMB  = (performance.memory?.usedJSHeapSize  ?? 0) / 1048576;
      const jsHeapTotalMB = (performance.memory?.totalJSHeapSize ?? 0) / 1048576;
      if (jsHeapUsedMB > _memPeakJsMB) _memPeakJsMB = jsHeapUsedMB;
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
}

// ── HUD drawing helpers ───────────────────────────────────────────────────────

function niceStep(range, ticks) {
  const raw = range / Math.max(1, ticks);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const r = raw / pow;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * pow;
}

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
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#555';
    ctx.fillText(v.toFixed(2), w - 4, y);
  }
  ctx.restore();
}

function drawDateAxis(ctx, w, h, viewLen) {
  if (viewLen === 0) return;
  const plotW = w - 60;
  const times = new Float64Array(frameBuf, FBUF_TIME_OFF, viewLen);
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const TICKS = 6;
  for (let i = 0; i < TICKS; i++) {
    const frac = i / (TICKS - 1);
    const idx  = Math.round(frac * (viewLen - 1));
    ctx.fillText(isoDateStr(times[idx]), frac * plotW, h - 2);
  }
  ctx.restore();
}

function drawCrosshair(ctx, w, h, px, py, yMin, yMax, layout, dateLabel = '', popupData = null, flags = 0) {
  const plotW = w - 60, clampedX = Math.min(px, plotW), DATE_BADGE_H = 16;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.40)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(clampedX, 0);
  ctx.lineTo(clampedX, dateLabel ? h - DATE_BADGE_H : h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(plotW, py); ctx.stroke();
  ctx.setLineDash([]);
  
  // Define layout bounds for main pane (for price axis tag)
  const boundY = layout && layout.main ? layout.main.y / DPR : 0;
  const boundH = layout && layout.main ? layout.main.h / DPR : h;

  if (py >= boundY && py <= boundY + boundH) {
    const price = yMax - ((py - boundY) / boundH) * (yMax - yMin);
    ctx.fillStyle = '#ddd'; ctx.fillRect(plotW + 1, py - 9, 58, 18);
    ctx.fillStyle = '#222'; ctx.font = '10px monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(price.toFixed(2), w - 4, py);
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
      const texts = [
        `Date: ${dateLabel}`,
        `O: ${popupData.open.toFixed(2)}  H: ${popupData.high.toFixed(2)}`,
        `L: ${popupData.low.toFixed(2)}  C: ${popupData.close.toFixed(2)}`,
        `Vol: ${formatVolume(popupData.vol)}`
    ];
    
    // Add indicators if they are valid values (not NaN and above a reasonable threshold)
    if ((flags & 1) && !Number.isNaN(popupData.sma20) && popupData.sma20 > 0) {
      texts.push(smaPrefix1 + ' ' + popupData.sma20.toFixed(2));
    }
    if ((flags & 2) && !Number.isNaN(popupData.sma50) && popupData.sma50 > 0) {
      texts.push(smaPrefix2 + ' ' + popupData.sma50.toFixed(2));
    }
    if ((flags & 4) && !Number.isNaN(popupData.sma100) && popupData.sma100 > 0) {
      texts.push(smaPrefix3 + ' ' + popupData.sma100.toFixed(2));
    }

    ctx.font = '11px monospace';
    let maxTw = 0;
    for (const t of texts) maxTw = Math.max(maxTw, ctx.measureText(t).width);
    
    // Position to the left or right of the crosshair to avoid overlap
    const boxW = maxTw + 12;
    const boxH = texts.length * 16 + 8;
    const boxX = (px + 10 + boxW < plotW) ? px + 10 : px - 10 - boxW;
    const boxY = Math.max(boundY + 4, Math.min(py - boxH/2, boundY + boundH - boxH - 4));
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#222';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < texts.length; i++) {
      // Basic syntax highlighting for indicator lines
      if (texts[i].startsWith(smaPrefix1)) {
        ctx.fillStyle = '#00BCD4';
      } else if (texts[i].startsWith(smaPrefix2)) {
        ctx.fillStyle = '#FFC107';
      } else if (texts[i].startsWith(smaPrefix3)) {
        ctx.fillStyle = '#E91E63'; 
      } else {
        ctx.fillStyle = '#222';
      }
      ctx.fillText(texts[i], boxX + 6, boxY + 6 + i * 16);
    }
    }
  }
}

function formatVolume(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toString();
  ctx.restore();
}

function drawPaneBorders(ctx, plotW, layout) {
  if (!layout) return;
  ctx.save();
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  
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

function drawLegend(ctx, flags) {
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
    ctx.fillText(`GPU ~${_r64[R_LAST_GPU_MS].toFixed(1)}ms`, x, 9);
  }
  ctx.restore();
}
