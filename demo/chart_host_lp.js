/**
 * chart_host.js — Main Thread controller for Mochart WASM Demo
 *
 * Responsibilities (ONLY):
 *   1. Transfer OffscreenCanvas ownership to the Render Worker.
 *   2. Load OHLCV data and forward it to the Worker once.
 *   3. On each rAF tick, write the current viewport into SharedArrayBuffer
 *      and wake the Worker via Atomics.notify.
 *
 * This file NEVER calls Canvas 2D, WebGPU, or WASM APIs directly.
 * All rendering happens in the Render Worker.
 */

import {
  STRIDE, WAKE, READY, START_BAR, VIS_BARS,
  PLOT_W, PLOT_H, POINTER_X, POINTER_Y, FLAGS,
  DIRTY, GPU_DIRTY, HUD_DIRTY, AT_RIGHT_EDGE,
  f32ToI32, allocCtrlBuf, allocFrameBuf, allocFrameCtrl, allocIndSab,
  FRAME_MAX_BARS,
} from './shared_protocol.js';

// ── Canvas setup ──────────────────────────────────────────────────────────
const gpuCanvas = document.getElementById('chart-gpu');
const hudCanvas = document.getElementById('chart-hud');

// Set physical canvas size before transferring to OffscreenCanvas.
// Without this the default 300×150 buffer is CSS-stretched → blurry on load.
// After transferControlToOffscreen() the main thread can no longer resize.
{
  const dpr = Math.ceil(window.devicePixelRatio || 1);
  const initW = Math.round((gpuCanvas.clientWidth  || 800) * dpr);
  const initH = Math.round((gpuCanvas.clientHeight || 400) * dpr);
  gpuCanvas.width  = initW;
  gpuCanvas.height = initH;
  hudCanvas.width  = initW;
  hudCanvas.height = initH;
}

// Transfer GPU/HUD canvas ownership to the Worker.
// After this, the Main Thread can no longer draw to them, but can still read
// clientWidth/clientHeight for event-to-viewport mapping.
const gpuOff = gpuCanvas.transferControlToOffscreen();
const hudOff = hudCanvas.transferControlToOffscreen();

// ── SharedArrayBuffer (N=1 chart) ─────────────────────────────────────────
const ctrlBuf  = allocCtrlBuf(1);
const ctrl     = new Int32Array(ctrlBuf);
ctrl[POINTER_X] = f32ToI32(-1.0);
ctrl[POINTER_Y] = f32ToI32(-1.0);

// ── P1: FDB SharedArrayBuffers ──────────────────────────────────────────────
// frameBuf  : SoA OhlcvStore snapshot + FDB header (written by data_worker)
// frameCtrl : render-ready handshake (data_worker → render_worker)
// indSab    : EP indicator arena + render-cmd table (data_worker → render_worker)
//
// indSab is right-sized at init based on the known indicator configuration:
//   6 indicators with 8 total output slots (SMA×3=3, RSI=1, MACD=3, Vol=1).
//   Arena = FRAME_MAX_BARS × 8 output slots, 16-byte aligned per slot.
//   This yields ~128 KB vs the legacy 528 KB upper-bound allocation (75% saving).
const EP_OUTPUT_SLOTS = 8;  // SMA×3(1ea) + RSI(1) + MACD(3) + Volume(1)
const EP_ARENA_F32    = ((FRAME_MAX_BARS * EP_OUTPUT_SLOTS + 3) & ~3);

const frameBuf  = allocFrameBuf();
const frameCtrl = allocFrameCtrl();
const indSab    = allocIndSab(EP_ARENA_F32);

// ── Workers ─────────────────────────────────────────────────────────────────
// data_worker  : WASM only (OhlcvStore + ExecutionPlan) — decompresses view,
//                executes EP indicators, writes frameBuf + indSab
// render_worker: pure JS + WebGPU — reads frameBuf + indSab, encodes GPU commands, draws HUD
const renderWorker = new Worker('./render_worker.js', { type: 'module' });
const dataWorker   = new Worker('./data_worker.js',   { type: 'module' });

// ── Worker init messages ─────────────────────────────────────────────────────
// DPR must be sourced from the Main Thread — Worker's self.devicePixelRatio
// may be undefined in older browsers or always 1 in headless contexts.
const DPR = Math.ceil(window.devicePixelRatio || 1);

// render_worker gets the OffscreenCanvas (transferred) + all SABs
renderWorker.postMessage(
  { type: 'init', gpuCanvas: gpuOff, hudCanvas: hudOff, ctrl: ctrlBuf, frameCtrl, frameBuf, indSab, dpr: DPR },
  [gpuOff, hudOff],
);
// data_worker gets ctrl (viewport commands) + all SABs — no canvas needed
dataWorker.postMessage({ type: 'init', ctrl: ctrlBuf, frameCtrl, frameBuf, indSab, dpr: DPR });

// Send initial SMA periods to workers (read from inputs if present).
try {
  const p1 = parseInt(document.getElementById('sma1_period')?.value, 10) || 5;
  const p2 = parseInt(document.getElementById('sma2_period')?.value, 10) || 25;
  const p3 = parseInt(document.getElementById('sma3_period')?.value, 10) || 75;
  dataWorker.postMessage({ type: 'update_sma', sma1: p1, sma2: p2, sma3: p3 });
  renderWorker.postMessage({ type: 'update_sma_periods', sma1: p1, sma2: p2, sma3: p3 });
} catch (e) { /* best-effort */ }

// ── Worker message routing ──────────────────────────────────────────────────
// data_worker  → 'ready' (bars after WASM ingest), 'error'
// render_worker → 'ready' (format after GPU init), 'perf', 'error'

// Latest perf data received from render_worker (every 16 active frames).
// Structure: { wasm, gpu, hud, frame } — each: { ewma, p50, p95 }
let lastPerfData = null;

// Baseline snapshot saved to localStorage ('S' key).
const BASELINE_KEY = 'mochart_perf_baseline';
let baseline = (() => {
  try { return JSON.parse(localStorage.getItem(BASELINE_KEY) || 'null'); }
  catch { return null; }
})();

/** @param {string} src  prefix for console / diagEl */
function makeOnMessage(src) {
  return (evt) => {
    const diagEl = document.getElementById('diagnostics');
    if (evt.data?.type === 'ready') {
      if (evt.data.bars != null) {
        // data_worker reports true bar count after WASM ingest.
        console.log(`[chart_host] ${src} ready — ${evt.data.bars} bars`);
        totalBars = evt.data.bars;
        visBars   = Math.min(200, totalBars);
        // Automatically add right margin offset on initial load
        const rightMarginBars = Math.floor(visBars * 0.2);
        startBar  = Math.max(0, totalBars - visBars + rightMarginBars);
      } else {
        // render_worker reports GPU texture format after WebGPU init.
        console.log(`[chart_host] ${src} ready — format: ${evt.data.format}`);
      }
    } else if (evt.data?.type === 'perf') {
      lastPerfData = evt.data;
    } else if (evt.data?.type === 'error') {
      const msg = evt.data.message ?? 'unknown error';
      console.error(`[chart_host] ${src} error:`, msg);
      if (diagEl) { diagEl.style.color = '#f44'; diagEl.textContent = `${src} error: ${msg}`; }
    }
  };
}

renderWorker.onmessage = makeOnMessage('render_worker');
dataWorker.onmessage   = makeOnMessage('data_worker');

function makeOnError(src) {
  return (ev) => {
    const diagEl = document.getElementById('diagnostics');
    const msg = ev.message ?? String(ev);
    console.error(`[chart_host] ${src} uncaught error:`, ev);
    if (diagEl) { diagEl.style.color = '#f44'; diagEl.textContent = `${src} error: ${msg}`; }
  };
}
renderWorker.onerror = makeOnError('render_worker');
dataWorker.onerror   = makeOnError('data_worker');

// ── Viewport state ────────────────────────────────────────────────────────
// TOTAL_BARS is initially estimated (200 bars visible); updated to the true
// count when Worker sends { type:'ready', bars } after fetch + ingest.
let totalBars = 200;
// Expose a stable const alias used throughout the rAF loop.
// We rebind via the let so rAF expressions ref totalBars directly.

const INITIAL_BARS  = 200;

let startBar = 0;  // will be corrected once Worker reports true bar count
let visBars  = INITIAL_BARS;
let plotW    = gpuCanvas.clientWidth  || 800;
let plotH    = gpuCanvas.clientHeight || 400;
let pointerX = -1;
let pointerY = -1;
let isDragging = false;
let dragLastX  = 0;

// 2本指タッチジェスチャー状態
// PAN: 2本指スライド → パン  /  ZOOM: 2本指ピンチ → ズーム（排他ロック）
const PAN_LOCK_PX      = 8;    // 中点移動がこの px を超えたらパンにロック
const PINCH_LOCK_RATIO = 0.03; // 距離変化がこの率を超えたらズームにロック
/** @type {Map<number, PointerEvent>} */
const touchPtrs    = new Map();
let touchGesture   = /** @type {'none'|'pan'|'zoom'} */ ('none');
let touchInitDist  = 0;
let touchInitMidX  = 0;

// Cache checkbox elements — queried once, read every rAF tick.
const cbSma1 = /** @type {HTMLInputElement} */ (document.getElementById('sma1_enable'));
const cbSma2 = /** @type {HTMLInputElement} */ (document.getElementById('sma2_enable'));
const cbSma3 = /** @type {HTMLInputElement} */ (document.getElementById('sma3_enable'));
const cbHeatmap = /** @type {HTMLInputElement} */ (document.getElementById('heatmap'));
const cbRsi     = /** @type {HTMLInputElement} */ (document.getElementById('rsi'));
const cbMacd    = /** @type {HTMLInputElement} */ (document.getElementById('macd'));
const cbVolume  = /** @type {HTMLInputElement} */ (document.getElementById('volume'));

const inSma1 = /** @type {HTMLInputElement} */ (document.getElementById('sma1_period'));
const inSma2 = /** @type {HTMLInputElement} */ (document.getElementById('sma2_period'));
const inSma3 = /** @type {HTMLInputElement} */ (document.getElementById('sma3_period'));

function smaFlags() {
  return (cbSma1.checked  ? 1 : 0)
       | (cbSma2.checked  ? 2 : 0)
       | (cbSma3.checked ? 4 : 0)
       | (cbHeatmap.checked ? 16 : 0)
       | (cbRsi?.checked  ? 32 : 0)
       | (cbMacd?.checked ? 64 : 0)
       | (cbVolume?.checked ? 128 : 0);
}

// Force next frame redraw from main thread (used by UI event handlers).
function scheduleRender() {
  prevStart = Number.NaN;
  prevVis   = Number.NaN;
  prevFlags = Number.NaN;
  prevPlotW = Number.NaN;
  prevPlotH = Number.NaN;
  prevPtrX  = Number.NaN;
  prevPtrY  = Number.NaN;
}

function updateSMA() {
  const p1 = parseInt(inSma1.value, 10) || 5;
  const p2 = parseInt(inSma2.value, 10) || 25;
  const p3 = parseInt(inSma3.value, 10) || 75;
  dataWorker.postMessage({ type: 'update_sma', sma1: p1, sma2: p2, sma3: p3 });
  renderWorker.postMessage({ type: 'update_sma_periods', sma1: p1, sma2: p2, sma3: p3 });
  scheduleRender();
}

inSma1.addEventListener('change', updateSMA);
inSma2.addEventListener('change', updateSMA);
inSma3.addEventListener('change', updateSMA);

[cbSma1, cbSma2, cbSma3, cbHeatmap, cbRsi, cbMacd, cbVolume].forEach(cb => {
  if (cb) cb.addEventListener('change', scheduleRender);
});

/**
 * Returns true when the viewport is showing the newest (right-most) bars.
 * In this state the renderer will add a right-side future margin.
 */
function isAtRightEdge() {
  return startBar + visBars >= totalBars;
}

function clampViewport() {
  visBars  = Math.max(10, Math.min(visBars,  Math.min(totalBars, FRAME_MAX_BARS)));
  // Right margin: allow panning past the newest bar by 20% of the visible area
  // so the latest price action is easy to read.
  const rightMarginBars = Math.floor(visBars * 0.2);
  startBar = Math.max(0,  Math.min(startBar, totalBars - visBars + rightMarginBars));
}

// ── DOM Events → SharedArrayBuffer ───────────────────────────────────────
// The GPU canvas captures pointer events even though it's OffscreenCanvas —
// the DOM element itself still receives events; only drawing is off-thread.
//
// Use e.offsetX / e.offsetY (canvas-local CSS px) rather than
// e.clientX / e.clientY (viewport-relative) so that coordinates are correct
// regardless of where the canvas is positioned on the page.

// Show crosshair cursor for usability feedback
gpuCanvas.style.cursor = 'crosshair';
// Disable native touch gestures so wheel + pointer events are fully handled here
gpuCanvas.style.touchAction = 'none';

// ── マウスドラッグパン ────────────────────────────────────────────────────
// pointerType === 'mouse' のみ対象。タッチとの混在を防ぐ。

gpuCanvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') {
    isDragging = true;
    dragLastX  = e.offsetX;
    gpuCanvas.setPointerCapture(e.pointerId);
  } else if (e.pointerType === 'touch') {
    touchPtrs.set(e.pointerId, e);
    if (touchPtrs.size === 2) {
      const [a, b] = [...touchPtrs.values()];
      touchInitDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      touchInitMidX = (a.clientX + b.clientX) / 2;
      touchGesture  = 'none';
    }
  }
});

gpuCanvas.addEventListener('pointermove', (e) => {
  pointerX = e.offsetX;
  pointerY = e.offsetY;

  if (e.pointerType === 'mouse') {
    if (!isDragging) return;
    const pxPerBar = plotW / visBars;
    const delta = Math.round((dragLastX - e.offsetX) / pxPerBar);
    if (delta !== 0) {
      startBar  += delta;
      clampViewport();
      dragLastX  = e.offsetX;
    }
  } else if (e.pointerType === 'touch') {
    if (!touchPtrs.has(e.pointerId)) return;
    const prev = touchPtrs.get(e.pointerId);
    touchPtrs.set(e.pointerId, e);
    if (touchPtrs.size !== 2) return;

    const [a, b]   = [...touchPtrs.values()];
    const currDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const currMidX = (a.clientX + b.clientX) / 2;

    // ジェスチャー種別を初回のみ決定（ロック）
    if (touchGesture === 'none') {
      if (touchInitDist > 0 && Math.abs(currDist / touchInitDist - 1) >= PINCH_LOCK_RATIO) {
        touchGesture = 'zoom';
      } else if (Math.abs(currMidX - touchInitMidX) >= PAN_LOCK_PX) {
        touchGesture = 'pan';
      }
    }

    if (touchGesture === 'zoom') {
      const [pa, pb] = [
        e.pointerId === a.pointerId ? prev : a,
        e.pointerId === b.pointerId ? prev : b,
      ];
      const prevDist = Math.hypot(pb.clientX - pa.clientX, pb.clientY - pa.clientY);
      if (prevDist > 0) {
        const fracMid = Math.max(0, Math.min(1, currMidX / plotW));
        const centerBar = startBar + fracMid * visBars;
        const ratio = currDist / prevDist;
        visBars  = Math.round(visBars / ratio);
        startBar = Math.round(centerBar - fracMid * visBars);
        clampViewport();
      }
    } else if (touchGesture === 'pan') {
      const [pa, pb] = [
        e.pointerId === a.pointerId ? prev : a,
        e.pointerId === b.pointerId ? prev : b,
      ];
      const prevMidX = (pa.clientX + pb.clientX) / 2;
      const pxPerBar = plotW / visBars;
      const delta    = Math.round((prevMidX - currMidX) / pxPerBar);
      if (delta !== 0) {
        startBar += delta;
        clampViewport();
      }
    }
  }
});

gpuCanvas.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') {
    isDragging = false;
  } else if (e.pointerType === 'touch') {
    touchPtrs.delete(e.pointerId);
    if (touchPtrs.size < 2) touchGesture = 'none';
  }
});
gpuCanvas.addEventListener('pointercancel', (e) => {
  if (e.pointerType === 'mouse') {
    isDragging = false;
  } else if (e.pointerType === 'touch') {
    touchPtrs.delete(e.pointerId);
    touchGesture = 'none';
  }
});
gpuCanvas.addEventListener('pointerleave',  () => { pointerX = -1; pointerY = -1; });


// FEWER_BARS: visBars を減らす (ズームイン: ローソク拡大) factor < 1
// MORE_BARS:  visBars を増やす (ズームアウト: ローソク縮小) factor > 1
const FEWER_BARS = 0.85;
const MORE_BARS  = 1.0 / 0.85;  // ≈ 1.17647
gpuCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  // deltaY > 0: scroll down / trackpad pinch-in  → zoom out (more bars)
  // deltaY < 0: scroll up  / trackpad pinch-out → zoom in  (fewer bars)
  const factor     = e.deltaY > 0 ? MORE_BARS : FEWER_BARS;
  const centerFrac = plotW > 0 ? e.offsetX / plotW : 0.5;
  const centerBar  = startBar + centerFrac * visBars;
  visBars  = Math.round(visBars * factor);
  startBar = Math.round(centerBar - centerFrac * visBars);
  clampViewport();
}, { passive: false });

// Keep plotW/H in sync with CSS layout changes
new ResizeObserver(() => {
  plotW = gpuCanvas.clientWidth  || 800;
  plotH = gpuCanvas.clientHeight || 400;
}).observe(gpuCanvas);

// ── rAF VSync loop ────────────────────────────────────────────────────────
// Runs at display refresh rate (VSync).
// Writes current viewport to SAB, then wakes the Worker with Atomics.notify.
// The Worker renders one frame per notification.

let frameId      = 0;
let lastTs       = 0;
let frameMsEwma  = 0;
const DIAG_UPDATE_INTERVAL_MS = 250;
let lastDiagUpdateTs = -1;
let lastDiagPerfRef = null;
let lastDiagIdle = false;
let lastDiagFps = '—';
let lastDiagText = '';

// Previous-frame snapshot for dirty detection
let prevStart  = -1;
let prevVis    = -1;
let prevFlags  = -1;
let prevPlotW  = -1;
let prevPlotH  = -1;
let prevPtrX   = -2;  // -2 ≠ initial pointerX(-1) to force first HUD draw
let prevPtrY   = -2;

const diagEl = document.getElementById('diagnostics');

/**
 * Format one phase's stats as "ewma(p50/p95)" in ms.
 * @param {{ewma:number, p50:number, p95:number}} s
 */
function fmtPhase(s) {
  return `${s.ewma.toFixed(1)}(${s.p50.toFixed(1)}/${s.p95.toFixed(1)})`;
}

/**
 * Build the diagnostics string from the latest perf data.
 * Shows a Δ vs baseline when a baseline is saved.
 * @param {number} fps
 * @param {boolean} idle
 */
function buildDiagText(fps, idle) {
  const p = lastPerfData;
  if (!p) return `WASM+WebGPU | — | ${fps}fps | ${idle ? 'idle' : 'active'}`;

  const memStr = p.mem
    ? ` | mem: JS ${p.mem.jsHeapUsedMB.toFixed(1)}/${p.mem.jsHeapTotalMB.toFixed(1)}MB (peak ${ (p.mem.peakJsHeapMB||0).toFixed(1) }MB) WASM ${p.mem.wasmMB.toFixed(1)}MB (peak ${(p.mem.peakWasmMB||0).toFixed(1)}MB)`
    : '';
  const core = `WASM+WebGPU | frame:${fmtPhase(p.frame)}ms `
    + `| wasm:${fmtPhase(p.wasm)} gpu:${fmtPhase(p.gpu)} hud:${fmtPhase(p.hud)}`
    + memStr
    + ` | ${fps}fps | ${idle ? 'idle' : 'active'}`;

  if (!baseline) return core + ' │ [S]=save baseline  [E]=export JSON';

  // Δ vs baseline (frame p50 + memory comparison)
  const delta = p.frame.p50 - baseline.frame.p50;
  const sign  = delta >= 0 ? '+' : '';
  const color = Math.abs(delta) > 1 ? (delta > 0 ? ' ⚠️' : ' ✅') : '';
  const memDeltaStr = (p.mem && baseline.mem)
    ? ` ΔJS:${(p.mem.jsHeapUsedMB - baseline.mem.jsHeapUsedMB >= 0 ? '+' : '')}${(p.mem.jsHeapUsedMB - baseline.mem.jsHeapUsedMB).toFixed(1)}MB`
    : '';
  return core + ` | Δp50:${sign}${delta.toFixed(1)}ms${memDeltaStr} vs baseline${color}  [E]=export`;
}

function maybeUpdateDiagnostics(ts, idle) {
  if (lastDiagUpdateTs >= 0 && (ts - lastDiagUpdateTs) < DIAG_UPDATE_INTERVAL_MS) return;
  lastDiagUpdateTs = ts;
  const fps = frameMsEwma > 0 ? (1000 / frameMsEwma).toFixed(0) : '—';
  const perfRef = lastPerfData;
  if (perfRef === lastDiagPerfRef && idle === lastDiagIdle && fps === lastDiagFps) return;
  lastDiagPerfRef = perfRef;
  lastDiagIdle = idle;
  lastDiagFps = fps;
  const nextText = buildDiagText(fps, idle);
  if (nextText !== lastDiagText) {
    lastDiagText = nextText;
    diagEl.textContent = nextText;
  }
}

let lastUpdateTs = 0;
const MAX_FPS = 120;
const MIN_UPDATE_INTERVAL = 1000 / MAX_FPS;

function tick(ts) {
  requestAnimationFrame(tick);

  // EWMA frame-time (always updated — rAF continues even when idle)
  const dt = ts - lastTs;
  lastTs   = ts;
  if (dt > 0 && dt < 1000) {
    frameMsEwma = frameMsEwma === 0 ? dt : frameMsEwma * 0.9 + dt * 0.1;
  }

  // Throttle updates to max 120fps to prevent very high CPU usage on fast pointer moves
  if (ts - lastUpdateTs < MIN_UPDATE_INTERVAL) {
    maybeUpdateDiagnostics(ts, true);
    return;
  }

  // ── Dirty detection ──────────────────────────────────────────────────────
  const curFlags = smaFlags() | (isAtRightEdge() ? AT_RIGHT_EDGE : 0);
  const gpuDirty =
    startBar !== prevStart ||
    visBars  !== prevVis   ||
    plotW    !== prevPlotW ||
    plotH    !== prevPlotH ||
    curFlags !== prevFlags;
  const hudDirty = pointerX !== prevPtrX || pointerY !== prevPtrY;

  if (!gpuDirty && !hudDirty) {
    // Nothing changed — skip notify; Worker awaits next Atomics.waitAsync (non-blocking).
    // Still update diagnostics on a time cadence to avoid per-frame string churn.
    maybeUpdateDiagnostics(ts, true);
    return;
  }

  lastUpdateTs = ts;

  // Update previous-frame snapshot
  prevStart = startBar;
  prevVis   = visBars;
  prevPlotW = plotW;
  prevPlotH = plotH;
  prevFlags = curFlags;
  prevPtrX  = pointerX;
  prevPtrY  = pointerY;

  // Compose dirty bitfield: GPU_DIRTY implies HUD_DIRTY (axes depend on same price range)
  const dirtyBits = (gpuDirty ? GPU_DIRTY | HUD_DIRTY : 0) | (hudDirty ? HUD_DIRTY : 0);

  // Write all viewport fields, then DIRTY, then WAKE (last — triggers Worker)
  const ci = 0;
  Atomics.store(ctrl, ci * STRIDE + START_BAR, startBar);
  Atomics.store(ctrl, ci * STRIDE + VIS_BARS,  visBars);
  Atomics.store(ctrl, ci * STRIDE + PLOT_W,    f32ToI32(plotW));
  Atomics.store(ctrl, ci * STRIDE + PLOT_H,    f32ToI32(plotH));
  Atomics.store(ctrl, ci * STRIDE + POINTER_X, f32ToI32(pointerX));
  Atomics.store(ctrl, ci * STRIDE + POINTER_Y, f32ToI32(pointerY));
  Atomics.store(ctrl, ci * STRIDE + FLAGS,     curFlags);
  Atomics.store(ctrl, ci * STRIDE + DIRTY,     dirtyBits);
  // WAKE must be written last — the Worker wakes on this field.
  Atomics.store(ctrl, ci * STRIDE + WAKE, ++frameId);
  Atomics.notify(ctrl, ci * STRIDE + WAKE);

  // Update diagnostics on a time cadence to avoid per-frame string churn.
  maybeUpdateDiagnostics(ts, false);
}

requestAnimationFrame(tick);

// ── Keyboard shortcuts ────────────────────────────────────────────
// S — save current perf data as baseline to localStorage
// E — export current + baseline as JSON download
window.addEventListener('keydown', (e) => {
  if (e.key === 'S' || e.key === 's') {
    if (!lastPerfData) { console.warn('[chart_host] no perf data yet'); return; }
    baseline = {
      ts:      new Date().toISOString(),
      bars:    totalBars,
      visBars: lastPerfData.visBars,
      wasm:    lastPerfData.wasm,
      gpu:     lastPerfData.gpu,
      hud:     lastPerfData.hud,
      frame:   lastPerfData.frame,
      mem:     lastPerfData.mem,
    };
    try { localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline)); } catch {}
    console.log('[chart_host] baseline saved:', baseline);
    const memInfo = baseline.mem
      ? ` JS:${baseline.mem.jsHeapUsedMB.toFixed(1)}MB (peak ${ (baseline.mem.peakJsHeapMB||0).toFixed(1) }MB) WASM:${baseline.mem.wasmMB.toFixed(1)}MB (peak ${(baseline.mem.peakWasmMB||0).toFixed(1)}MB)`
      : '';
    diagEl.textContent = '✅ Baseline saved! ' + JSON.stringify({
      frame_p50: baseline.frame.p50.toFixed(2) + 'ms',
      gpu_p50:   baseline.gpu.p50.toFixed(2)   + 'ms',
      wasm_p50:  baseline.wasm.p50.toFixed(2)  + 'ms',
    }) + memInfo;
    setTimeout(() => { diagEl.textContent = buildDiagText('—', true); }, 2000);
  } else if (e.key === 'E' || e.key === 'e') {
    const report = {
      exportedAt: new Date().toISOString(),
      baseline,
      current: lastPerfData ? {
        ts:      new Date().toISOString(),
        bars:    totalBars,
        visBars: lastPerfData.visBars,
        wasm:    lastPerfData.wasm,
        gpu:     lastPerfData.gpu,
        hud:     lastPerfData.hud,
        frame:   lastPerfData.frame,
        mem:     lastPerfData.mem,
      } : null,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mochart_perf_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('[chart_host] perf report exported:', report);
  }
});

// ── Public API (Pane Config) ──────────────────────────────────────────────
window.updatePaneConfig = function(config) {
  renderWorker.postMessage({ type: 'config', paneConfig: config });
  prevStart = -1; // force render next frame
};

// Set initially smaller sub pane sizes
window.updatePaneConfig({ gap: 2, main: 7.0, sub1: 1.5, sub2: 1.5 });

function updateConfigFromUI() {
  const mainWtEl = document.getElementById('mainWt');
  const sub1WtEl = document.getElementById('sub1Wt');
  const sub2WtEl = document.getElementById('sub2Wt');
  const paneGapEl = document.getElementById('paneGap');
  if (mainWtEl && sub1WtEl && sub2WtEl && paneGapEl) {
    const mainR = parseFloat(mainWtEl.value);
    const sub1R = parseFloat(sub1WtEl.value);
    const sub2R = parseFloat(sub2WtEl.value);
    const gapV = parseInt(paneGapEl.value, 10);
    window.updatePaneConfig({ gap: gapV, main: mainR, sub1: sub1R, sub2: sub2R });
  }
}
const mainWtEl = document.getElementById('mainWt');
const sub1WtEl = document.getElementById('sub1Wt');
const sub2WtEl = document.getElementById('sub2Wt');
const paneGapEl = document.getElementById('paneGap');
if (mainWtEl) mainWtEl.addEventListener('input', updateConfigFromUI);
if (sub1WtEl) sub1WtEl.addEventListener('input', updateConfigFromUI);
if (sub2WtEl) sub2WtEl.addEventListener('input', updateConfigFromUI);
if (paneGapEl) paneGapEl.addEventListener('input', updateConfigFromUI);
