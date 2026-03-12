/**
 * chart_host_lp.js — Landing Page chart host (WebGPU native path)
 *
 * Uses unified_worker.js + GpuRenderer for native WebGPU rendering.
 * Communicates with the Worker via SharedArrayBuffer + Atomics (same as chart_host.ts).
 * Stripped-down version of UnifiedDemoHost for the minimal LP hero section.
 */

import {
  allocCtrlBuf,
  allocIndSab,
  AT_RIGHT_EDGE,
  DIRTY,
  FLAGS,
  GPU_DIRTY,
  HUD_DIRTY,
  PLOT_H,
  PLOT_W,
  POINTER_X,
  POINTER_Y,
  READY,
  RIGHT_MARGIN_BARS,
  START_BAR,
  STRIDE,
  SUBPIXEL_PAN_X,
  VIS_BARS,
  WAKE,
  f32ToI32,
  i32ToF32,
} from './shared_protocol.js';

const LP_BUILD_VERSION = '20260311a';
const PERF_INTERVAL_MS = 250;
const DEFAULT_VISIBLE_BARS = 200;
const RIGHT_MARGIN_RATIO = 0.1;
const MIN_VISIBLE_BARS = 20;
const MAX_DISPLAY_FPS = 120;
const PANE_CONFIG = { gap: 2, weights: [7, 1.5, 1.5] };

// Indicator flags: sma1=1 | sma2=2 | sma3=4 | rsi=32 | macd=64 | volume=128
const LP_INDICATOR_FLAGS = 1 | 2 | 4 | 32 | 64 | 128;

function createCanvas(id) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
}

class LpDemoHost {
  constructor(container) {
    this.container = container;
    this.slotId = 0;
    this.destroyed = false;
    this.ready = false;
    this.totalBars = 0;
    this.visibleBars = DEFAULT_VISIBLE_BARS;
    this.rawStartBar = 0;
    this.atRightEdge = true;
    this.plotW = 0;
    this.plotH = 0;
    this.pointerX = -1;
    this.pointerY = -1;
    this.pendingGpuDirty = true;
    this.pendingHudDirty = true;
    this.dragPointerId = -1;
    this.dragOriginX = 0;
    this.dragOriginStartBar = 0;
    this.perf = {};
    this.gpuFormat = '';

    // Previous state for dirty detection
    this.prevStartBar = NaN;
    this.prevVisibleBars = NaN;
    this.prevPlotW = NaN;
    this.prevPlotH = NaN;
    this.prevPointerX = NaN;
    this.prevPointerY = NaN;
    this.prevFlags = NaN;
    this.prevPanOffsetPx = NaN;
    this.prevRightMarginBars = NaN;

    // Create GPU + HUD canvases
    this.gpuCanvas = createCanvas('lp-chart-gpu');
    this.hudCanvas = createCanvas('lp-chart-hud');
    container.appendChild(this.gpuCanvas);
    container.appendChild(this.hudCanvas);

    // Allocate shared memory
    this.ctrlBuffer = allocCtrlBuf(1);
    this.ctrl = new Int32Array(this.ctrlBuffer);
    this.indSab = allocIndSab();

    this.ctrl[this.slotId * STRIDE + POINTER_X] = f32ToI32(-1);
    this.ctrl[this.slotId * STRIDE + POINTER_Y] = f32ToI32(-1);

    // Launch unified worker
    this.worker = new Worker(new URL('./unified_worker.js', import.meta.url), { type: 'module' });
    this._bindWorker();
    this._bindViewport();
    this._measureContainer();
    this._startWorker();
    this._postPaneConfig();
    this._scheduleWake(true, true);

    this.perfTimer = window.setInterval(() => this._reportPerf(), PERF_INTERVAL_MS);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    window.clearInterval(this.perfTimer);
    this.worker.terminate();
  }

  _bindWorker() {
    this.worker.addEventListener('message', (event) => {
      if (this.destroyed) return;
      const msg = event.data;
      if (msg?.type === 'ready') {
        this.ready = true;
        this.totalBars = Math.max(0, msg.bars | 0);
        this.gpuFormat = typeof msg.format === 'string' ? msg.format : this.gpuFormat;
        this._clampViewport();
        this._postSmaPeriods();
        this._postPaneConfig();
        this._scheduleWake(true, true);
        window._lpOnReady?.(this.totalBars);
        return;
      }
      if (msg?.type === 'data_set') {
        this.totalBars = Math.max(0, msg.bars | 0);
        this._clampViewport();
        this._scheduleWake(true, true);
        if (!this.ready) {
          this.ready = true;
          window._lpOnReady?.(this.totalBars);
        }
        return;
      }
      if (msg?.type === 'ind_sab_resize') {
        this.indSab = allocIndSab(msg.arenaF32Count);
        this.worker.postMessage({ type: 'set_ind_sab', slotId: this.slotId, indSab: this.indSab });
        this._scheduleWake(true, true);
        return;
      }
      if (msg?.type === 'perf') {
        this.perf = {
          wasm: msg.wasm,
          gpu: msg.gpu,
          hud: msg.hud,
          frame: msg.frame,
        };
        return;
      }
      if (msg?.type === 'error') {
        console.error('[lp_host] worker error:', msg.message);
      }
    });
  }

  _startWorker() {
    const gpuOffscreen = this.gpuCanvas.transferControlToOffscreen();
    const hudOffscreen = this.hudCanvas.transferControlToOffscreen();
    this.worker.postMessage({
      type: 'init',
      descriptor: { slotId: this.slotId, ctrl: this.ctrlBuffer, indSab: this.indSab },
      indSab: this.indSab,
      gpuCanvas: gpuOffscreen,
      hudCanvas: hudOffscreen,
      dpr: window.devicePixelRatio || 1,
    }, [gpuOffscreen, hudOffscreen]);
  }

  _bindViewport() {
    this.resizeObserver = new ResizeObserver(() => {
      this._measureContainer();
      this._scheduleWake(true, true);
    });
    this.resizeObserver.observe(this.container);

    this.hudCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const pt = this._localPoint(e);
      this.dragPointerId = e.pointerId;
      this.dragOriginX = pt.x;
      this.dragOriginStartBar = this.rawStartBar;
      this.pointerX = pt.x;
      this.pointerY = pt.y;
      this.hudCanvas.setPointerCapture(e.pointerId);
      this._scheduleWake(false, true);
    });

    this.hudCanvas.addEventListener('pointermove', (e) => {
      const pt = this._localPoint(e);
      this.pointerX = pt.x;
      this.pointerY = pt.y;
      if (this.dragPointerId === e.pointerId) {
        const slotW = this._slotWidth();
        const deltaBars = (pt.x - this.dragOriginX) / Math.max(1e-6, slotW);
        this.rawStartBar = this.dragOriginStartBar - deltaBars;
        this._clampViewport();
        this._scheduleWake(true, true);
        return;
      }
      this._scheduleWake(false, true);
    });

    const stopDrag = (e) => {
      if (this.dragPointerId !== e.pointerId) return;
      this.dragPointerId = -1;
      if (this.hudCanvas.hasPointerCapture(e.pointerId)) {
        this.hudCanvas.releasePointerCapture(e.pointerId);
      }
    };
    this.hudCanvas.addEventListener('pointerup', stopDrag);
    this.hudCanvas.addEventListener('pointercancel', stopDrag);
    this.hudCanvas.addEventListener('pointerleave', () => {
      this.pointerX = -1;
      this.pointerY = -1;
      this._scheduleWake(false, true);
    });

    this.hudCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const pt = this._localPoint(e);
      const cur = this.visibleBars;
      // ctrlKey: trackpad pinch-to-zoom (deltaY ≈ 1–10, needs higher coefficient)
      // Regular: mouse wheel / trackpad scroll (deltaY ≈ 50–150)
      const zoomCoeff = e.ctrlKey ? 0.04 : 0.0015;
      const next = Math.max(
        MIN_VISIBLE_BARS,
        Math.min(
          Math.max(MIN_VISIBLE_BARS, this.totalBars || cur || DEFAULT_VISIBLE_BARS),
          Math.round(cur * Math.exp(e.deltaY * zoomCoeff)),
        ),
      );
      if (next === cur) return;
      const chartW = Math.max(1, this.plotW - 60);
      const oldRM = this.atRightEdge ? Math.max(0, Math.round(cur * RIGHT_MARGIN_RATIO)) : 0;
      const oldStep = chartW / Math.max(1, cur + oldRM);
      const anchor = this.rawStartBar + pt.x / Math.max(1e-6, oldStep);
      const nextRM = this.atRightEdge ? Math.max(0, Math.round(next * RIGHT_MARGIN_RATIO)) : 0;
      const nextStep = chartW / Math.max(1, next + nextRM);
      this.visibleBars = next;
      this.rawStartBar = anchor - pt.x / Math.max(1e-6, nextStep);
      this._clampViewport();
      this.pointerX = pt.x;
      this.pointerY = pt.y;
      this._scheduleWake(true, true);
    }, { passive: false });
  }

  _postPaneConfig() {
    this.worker.postMessage({
      type: 'pane_config',
      slotId: this.slotId,
      gap: PANE_CONFIG.gap,
      weights: PANE_CONFIG.weights,
    });
  }

  _postSmaPeriods() {
    this.worker.postMessage({
      type: 'update_sma_periods',
      slotId: this.slotId,
      sma1: 5,
      sma2: 25,
      sma3: 75,
    });
  }

  _measureContainer() {
    const rect = this.container.getBoundingClientRect();
    this.plotW = Math.max(1, Math.round(rect.width));
    this.plotH = Math.max(1, Math.round(rect.height));
  }

  _localPoint(e) {
    const rect = this.hudCanvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, e.clientX - rect.left), Math.max(0, rect.width - 1)),
      y: Math.min(Math.max(0, e.clientY - rect.top), Math.max(0, rect.height - 1)),
    };
  }

  _slotWidth() {
    const chartW = Math.max(1, this.plotW - 60);
    const rm = this.atRightEdge ? Math.max(0, Math.round(this.visibleBars * RIGHT_MARGIN_RATIO)) : 0;
    return chartW / Math.max(1, this.visibleBars + rm);
  }

  _clampViewport() {
    const maxVis = Math.max(MIN_VISIBLE_BARS, this.totalBars || DEFAULT_VISIBLE_BARS);
    this.visibleBars = Math.max(MIN_VISIBLE_BARS, Math.min(this.visibleBars | 0, maxVis));
    const maxStart = Math.max(0, this.totalBars - this.visibleBars);
    if (!Number.isFinite(this.rawStartBar)) this.rawStartBar = maxStart;
    if (this.rawStartBar < 0) this.rawStartBar = 0;
    if (this.rawStartBar > maxStart) this.rawStartBar = maxStart;
    this.atRightEdge = this.totalBars <= this.visibleBars || this.rawStartBar >= maxStart - 1e-6;
    if (this.atRightEdge) this.rawStartBar = maxStart;
  }

  _scheduleWake(gpuDirty, hudDirty) {
    if (this.destroyed) return;
    this.pendingGpuDirty = this.pendingGpuDirty || gpuDirty;
    this.pendingHudDirty = this.pendingHudDirty || hudDirty;
    this._publishCtrl();
  }

  _publishCtrl() {
    if (this.destroyed) return;
    this._clampViewport();
    const rm = this.atRightEdge ? Math.max(0, Math.round(this.visibleBars * RIGHT_MARGIN_RATIO)) : 0;
    const startBar = Math.floor(this.rawStartBar);
    const remainder = this.rawStartBar - startBar;
    const panPx = remainder * this._slotWidth();
    const flags = LP_INDICATOR_FLAGS | (this.atRightEdge ? AT_RIGHT_EDGE : 0);

    const nextGpu = this.pendingGpuDirty
      || startBar !== this.prevStartBar
      || this.visibleBars !== this.prevVisibleBars
      || this.plotW !== this.prevPlotW
      || this.plotH !== this.prevPlotH
      || flags !== this.prevFlags
      || panPx !== this.prevPanOffsetPx
      || rm !== this.prevRightMarginBars;
    const nextHud = this.pendingHudDirty || nextGpu
      || this.pointerX !== this.prevPointerX
      || this.pointerY !== this.prevPointerY;

    this.pendingGpuDirty = false;
    this.pendingHudDirty = false;
    if (!nextGpu && !nextHud) return;

    const base = this.slotId * STRIDE;
    Atomics.store(this.ctrl, base + START_BAR, startBar);
    Atomics.store(this.ctrl, base + VIS_BARS, this.visibleBars);
    Atomics.store(this.ctrl, base + PLOT_W, f32ToI32(this.plotW));
    Atomics.store(this.ctrl, base + PLOT_H, f32ToI32(this.plotH));
    Atomics.store(this.ctrl, base + POINTER_X, f32ToI32(this.pointerX));
    Atomics.store(this.ctrl, base + POINTER_Y, f32ToI32(this.pointerY));
    Atomics.store(this.ctrl, base + FLAGS, flags);
    Atomics.store(this.ctrl, base + SUBPIXEL_PAN_X, f32ToI32(panPx));
    Atomics.store(this.ctrl, base + RIGHT_MARGIN_BARS, rm);
    Atomics.store(this.ctrl, base + DIRTY, (nextGpu ? (GPU_DIRTY | HUD_DIRTY) : 0) | (nextHud ? HUD_DIRTY : 0));
    const wake = (Atomics.load(this.ctrl, base + WAKE) + 1) | 0;
    Atomics.store(this.ctrl, base + WAKE, wake);
    Atomics.notify(this.ctrl, base + WAKE);

    this.prevStartBar = startBar;
    this.prevVisibleBars = this.visibleBars;
    this.prevPlotW = this.plotW;
    this.prevPlotH = this.plotH;
    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
    this.prevFlags = flags;
    this.prevPanOffsetPx = panPx;
    this.prevRightMarginBars = rm;
  }

  _reportPerf() {
    if (this.perf?.frame?.ewma && this.perf.frame.ewma > 0) {
      window._lpOnPerf?.(Math.min(MAX_DISPLAY_FPS, 1000 / this.perf.frame.ewma), this.perf.frame.ewma);
    }
  }
}

function init() {
  window._lpOnProgress?.(20, 'Initializing WebGPU demo…');

  const container = document.getElementById('chart-host');
  if (!(container instanceof HTMLElement)) throw new Error('chart-host not found');

  window._lpOnProgress?.(45, 'Starting unified worker…');

  const host = new LpDemoHost(container);

  window._lpOnProgress?.(70, 'Loading WASM + OHLCV data…');

  window.addEventListener('beforeunload', () => host.destroy(), { once: true });

  console.log('[lp_host] WebGPU native path via unified_worker', { build: LP_BUILD_VERSION });
}

init();