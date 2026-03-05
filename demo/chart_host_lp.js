/**
 * chart_host_lp.js — Landing Page chart host (real MSFT data)
 *
 * Derived from chart_host.js with the following LP-specific changes:
 *   • No SMA checkbox / period input wiring (all indicators enabled by default)
 *   • Worker status routed to window._lpOnReady / _lpOnPerf / _lpOnProgress
 *   • No baseline save / JSON export keyboard shortcuts
 *   • Pane config sent once at init; no UI sliders
 *
 * Worker files are served from the same directory (docs/demo/).
 * WASM pkg files are served from docs/pkg/ (copied by scripts/build-docs.sh).
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

{
  const dpr   = Math.round(window.devicePixelRatio || 1);
  const initW = Math.round((gpuCanvas.clientWidth  || window.innerWidth)  * dpr);
  const initH = Math.round((gpuCanvas.clientHeight || window.innerHeight) * dpr);
  gpuCanvas.width  = initW;
  gpuCanvas.height = initH;
  hudCanvas.width  = initW;
  hudCanvas.height = initH;
}

const gpuOff = gpuCanvas.transferControlToOffscreen();
const hudOff = hudCanvas.transferControlToOffscreen();

// ── SharedArrayBuffer ─────────────────────────────────────────────────────
const ctrlBuf  = allocCtrlBuf(1);
const ctrl     = new Int32Array(ctrlBuf);
ctrl[POINTER_X] = f32ToI32(-1.0);
ctrl[POINTER_Y] = f32ToI32(-1.0);

// EP has SMA×3 + RSI + MACD×3 + Volume = 8 output slots (same as demo).
const EP_OUTPUT_SLOTS = 8;
const EP_ARENA_F32    = ((FRAME_MAX_BARS * EP_OUTPUT_SLOTS + 3) & ~3);

const frameBuf  = allocFrameBuf();
const frameCtrl = allocFrameCtrl();
const indSab    = allocIndSab(EP_ARENA_F32);

// ── Workers ──────────────────────────────────────────────────────────────
// import.meta.url を基準に絶対URL文字列を生成して Worker に渡す (末尾スラッシュ問題の回避)
const WORKER_VERSION = '20260306a';
const renderWorker = new Worker(new URL(`./render_worker.js?v=${WORKER_VERSION}`, import.meta.url).href, { type: 'module' });
const dataWorker   = new Worker(new URL(`./data_worker.js?v=${WORKER_VERSION}`, import.meta.url).href, { type: 'module' });

const DPR = Math.round(window.devicePixelRatio || 1);

// ── Init messages ─────────────────────────────────────────────────────────
// Notify loading progress (30% = workers initialising).
window._lpOnProgress?.(30, 'Loading WebGPU renderer…');

renderWorker.postMessage(
  { type: 'init', gpuCanvas: gpuOff, hudCanvas: hudOff,
    ctrl: ctrlBuf, frameCtrl, frameBuf, indSab, dpr: DPR },
  [gpuOff, hudOff],
);

dataWorker.postMessage({
  type: 'init',
  ctrl: ctrlBuf, frameCtrl, frameBuf, indSab, dpr: DPR,
});

// Set default SMA periods to the same values as the demo.
dataWorker.postMessage({ type: 'update_sma', sma1: 5, sma2: 25, sma3: 75 });
renderWorker.postMessage({ type: 'update_sma_periods', sma1: 5, sma2: 25, sma3: 75 });

// Pane layout (same defaults as demo).
renderWorker.postMessage({ type: 'config', paneConfig: { gap: 2, main: 7.0, sub1: 1.5, sub2: 1.5 } });

// ── Worker message routing ────────────────────────────────────────────────
let lastPerfData = null;

function makeOnMessage(src) {
  return (evt) => {
    if (evt.data?.type === 'ready') {
      if (evt.data.bars != null) {
        // data_worker: WASM ingest complete.
        console.log(`[lp_host] ${src} ready — ${evt.data.bars.toLocaleString()} bars`);
        totalBars = evt.data.bars;
        visBars   = Math.min(200, totalBars);
        const rightMarginBars = Math.floor(visBars * 0.2);
        startBar  = Math.max(0, totalBars - visBars + rightMarginBars);
        // Notify LP index.html: hide loading overlay, update bar count display.
        window._lpOnReady?.(totalBars);
        scheduleRender();
      } else {
        // render_worker: WebGPU init complete.
        console.log(`[lp_host] ${src} ready — format: ${evt.data.format}`);
        window._lpOnProgress?.(70, 'Generating 1,000,000 bars via Rust WASM…');
      }
    } else if (evt.data?.type === 'perf') {
      lastPerfData = evt.data;
      // Feed live stats to the LP overlay.
      if (lastPerfData?.frame?.ewma > 0 && frameMsEwma > 0) {
        const fps      = 1000 / frameMsEwma;
        const renderMs = lastPerfData.frame.ewma;
        window._lpOnPerf?.(fps, renderMs);
      }
    } else if (evt.data?.type === 'error') {
      const msg = evt.data.message ?? 'unknown error';
      console.error(`[lp_host] ${src} error:`, msg);
    }
  };
}

renderWorker.onmessage = makeOnMessage('render_worker');
dataWorker.onmessage   = makeOnMessage('data_worker');

function makeOnError(src) {
  return (ev) => console.error(`[lp_host] ${src} uncaught:`, ev);
}
renderWorker.onerror = makeOnError('render_worker');
dataWorker.onerror   = makeOnError('data_worker');

// ── Viewport state ────────────────────────────────────────────────────────
let totalBars   = 200;
let startBar    = 0;
let visBars     = 200;
let plotW       = gpuCanvas.clientWidth  || window.innerWidth;
let plotH       = gpuCanvas.clientHeight || window.innerHeight;
let pointerX    = -1;
let pointerY    = -1;
let isDragging  = false;
let dragLastX   = 0;

const PAN_LOCK_PX      = 8;
const PINCH_LOCK_RATIO = 0.03;
/** @type {Map<number, PointerEvent>} */
const touchPtrs  = new Map();
let touchGesture = /** @type {'none'|'pan'|'zoom'} */ ('none');
let touchInitDist  = 0;
let touchInitMidX  = 0;

// LP flags: enable all indicators as a showcase (except heatmap, which is cluttered)
// bit 1=SMA1  2=SMA2  4=SMA3  16=Heatmap  32=RSI  64=MACD  128=Volume
const LP_FLAGS_DEFAULT = 1 | 2 | 4 | 32 | 64 | 128; // Removed 16 (Heatmap)

function smaFlags() {
  return LP_FLAGS_DEFAULT | (isAtRightEdge() ? AT_RIGHT_EDGE : 0);
}

function scheduleRender() {
  prevStart = Number.NaN;
  prevVis   = Number.NaN;
  prevFlags = Number.NaN;
  prevPlotW = Number.NaN;
  prevPlotH = Number.NaN;
  prevPtrX  = Number.NaN;
  prevPtrY  = Number.NaN;
}

function isAtRightEdge() {
  return startBar + visBars >= totalBars;
}

function clampViewport() {
  visBars  = Math.max(10, Math.min(visBars, Math.min(totalBars, FRAME_MAX_BARS)));
  const rightMarginBars = Math.floor(visBars * 0.2);
  startBar = Math.max(0, Math.min(startBar, totalBars - visBars + rightMarginBars));
}

// ── Interaction ───────────────────────────────────────────────────────────
gpuCanvas.style.cursor      = 'crosshair';
gpuCanvas.style.touchAction = 'none';

gpuCanvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') {
    isDragging = true;
    dragLastX  = e.offsetX;
    gpuCanvas.setPointerCapture(e.pointerId);
  } else if (e.pointerType === 'touch') {
    touchPtrs.set(e.pointerId, e);
    if (touchPtrs.size === 2) {
      const [a, b]  = [...touchPtrs.values()];
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
    const delta    = Math.round((dragLastX - e.offsetX) / pxPerBar);
    if (delta !== 0) {
      startBar += delta;
      clampViewport();
      dragLastX = e.offsetX;
    }
  } else if (e.pointerType === 'touch') {
    if (!touchPtrs.has(e.pointerId)) return;
    const prev = touchPtrs.get(e.pointerId);
    touchPtrs.set(e.pointerId, e);
    if (touchPtrs.size !== 2) return;

    const [a, b]   = [...touchPtrs.values()];
    const currDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const currMidX = (a.clientX + b.clientX) / 2;

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
        const fracMid  = Math.max(0, Math.min(1, currMidX / plotW));
        const centerBar = startBar + fracMid * visBars;
        const ratio    = currDist / prevDist;
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
      const pxPerBar  = plotW / visBars;
      const delta     = Math.round((prevMidX - currMidX) / pxPerBar);
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
gpuCanvas.addEventListener('pointerleave', () => { pointerX = -1; pointerY = -1; });

const FEWER_BARS = 0.85;
const MORE_BARS  = 1.0 / 0.85;
gpuCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor     = e.deltaY > 0 ? MORE_BARS : FEWER_BARS;
  const centerFrac = plotW > 0 ? e.offsetX / plotW : 0.5;
  const centerBar  = startBar + centerFrac * visBars;
  visBars  = Math.round(visBars * factor);
  startBar = Math.round(centerBar - centerFrac * visBars);
  clampViewport();
}, { passive: false });

new ResizeObserver(() => {
  plotW = gpuCanvas.clientWidth  || window.innerWidth;
  plotH = gpuCanvas.clientHeight || window.innerHeight;
}).observe(gpuCanvas);

// ── rAF loop ──────────────────────────────────────────────────────────────
let frameId      = 0;
let lastTs       = 0;
let frameMsEwma  = 0;

let prevStart  = -1;
let prevVis    = -1;
let prevFlags  = -1;
let prevPlotW  = -1;
let prevPlotH  = -1;
let prevPtrX   = -2;
let prevPtrY   = -2;

function tick(ts) {
  requestAnimationFrame(tick);

  const dt = ts - lastTs;
  lastTs   = ts;
  if (dt > 0 && dt < 1000) {
    frameMsEwma = frameMsEwma === 0 ? dt : frameMsEwma * 0.9 + dt * 0.1;
  }

  const curFlags = smaFlags();
  const gpuDirty =
    startBar !== prevStart ||
    visBars  !== prevVis   ||
    plotW    !== prevPlotW ||
    plotH    !== prevPlotH ||
    curFlags !== prevFlags;
  const hudDirty = pointerX !== prevPtrX || pointerY !== prevPtrY;

  if (!gpuDirty && !hudDirty) {
    // idle — emit live stat update to LP overlay every 16 frames
    if ((frameId & 15) === 0 && frameMsEwma > 0) {
      window._lpOnPerf?.(1000 / frameMsEwma, lastPerfData?.frame?.ewma || frameMsEwma);
    }
    return;
  }

  prevStart = startBar;
  prevVis   = visBars;
  prevPlotW = plotW;
  prevPlotH = plotH;
  prevFlags = curFlags;
  prevPtrX  = pointerX;
  prevPtrY  = pointerY;

  const dirtyBits = (gpuDirty ? GPU_DIRTY | HUD_DIRTY : 0) | (hudDirty ? HUD_DIRTY : 0);

  const ci = 0;
  Atomics.store(ctrl, ci * STRIDE + START_BAR, startBar);
  Atomics.store(ctrl, ci * STRIDE + VIS_BARS,  visBars);
  Atomics.store(ctrl, ci * STRIDE + PLOT_W,    f32ToI32(plotW));
  Atomics.store(ctrl, ci * STRIDE + PLOT_H,    f32ToI32(plotH));
  Atomics.store(ctrl, ci * STRIDE + POINTER_X, f32ToI32(pointerX));
  Atomics.store(ctrl, ci * STRIDE + POINTER_Y, f32ToI32(pointerY));
  Atomics.store(ctrl, ci * STRIDE + FLAGS,     curFlags);
  Atomics.store(ctrl, ci * STRIDE + DIRTY,     dirtyBits);
  Atomics.store(ctrl, ci * STRIDE + WAKE,     ++frameId);
  Atomics.notify(ctrl, ci * STRIDE + WAKE);

  if ((frameId & 15) === 0 && frameMsEwma > 0) {
    window._lpOnPerf?.(1000 / frameMsEwma, lastPerfData?.frame?.ewma || frameMsEwma);
  }
}

requestAnimationFrame(tick);
