// src/api/workerBridge.ts
var STRIDE = 16;
var WAKE = 0;
var START_BAR = 2;
var VIS_BARS = 3;
var PLOT_W = 4;
var PLOT_H = 5;
var POINTER_X = 6;
var POINTER_Y = 7;
var FLAGS = 8;
var DIRTY = 9;
var SUBPIXEL_PAN_X = 10;
var RIGHT_MARGIN_BARS = 11;
var GPU_DIRTY = 1;
var HUD_DIRTY = 2;
var AT_RIGHT_EDGE = 8;
var INDSAB_HDR_BYTES = 4096;
var FRAME_MAX_BARS = 16384;
var MAX_RENDER_CMDS = 8;
var MAX_ARENA_F32 = FRAME_MAX_BARS * MAX_RENDER_CMDS;
var _cvt = new DataView(new ArrayBuffer(4));
function f32ToI32(f) {
  _cvt.setFloat32(0, f, true);
  return _cvt.getInt32(0, true);
}
var MIN_VISIBLE_BARS = 10;
var DEFAULT_VISIBLE_BARS = 200;
var RIGHT_MARGIN_RATIO = 0.1;
function allocIndSab(arenaF32Count) {
  if (typeof SharedArrayBuffer === "undefined") {
    throw new Error("[Mochart] SharedArrayBuffer is unavailable. " + "Your page must be cross-origin-isolated: " + 'add "Cross-Origin-Opener-Policy: same-origin" and ' + '"Cross-Origin-Embedder-Policy: require-corp" response headers. ' + "See https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated");
  }
  const arenaBytes = (arenaF32Count != null ? arenaF32Count : MAX_ARENA_F32) * 4;
  return new SharedArrayBuffer(INDSAB_HDR_BYTES + arenaBytes);
}

class WorkerBridge {
  worker;
  ctrl;
  ctrlBuf;
  indSab;
  slotId = 0;
  dpr;
  gpuCanvas;
  hudCanvas;
  _perfMetrics = null;
  ready = false;
  destroyed = false;
  totalBars = 0;
  visibleBars;
  rawStartBar = 0;
  atRightEdge = true;
  plotW = 0;
  plotH = 0;
  pointerX = -1;
  pointerY = -1;
  pendingGpuDirty = true;
  pendingHudDirty = true;
  dragPointerId = -1;
  dragOriginX = 0;
  dragOriginStartBar = 0;
  prevStartBar = NaN;
  prevVisibleBars = NaN;
  prevPlotW = NaN;
  prevPlotH = NaN;
  prevPointerX = NaN;
  prevPointerY = NaN;
  prevFlags = NaN;
  prevPanOffsetPx = NaN;
  prevRightMarginBars = NaN;
  indicatorFlags = 0;
  resizeObserver = null;
  callbacks;
  pendingMessages = [];
  constructor(container, worker, opts = {}, callbacks = {}) {
    this.worker = worker;
    this.callbacks = callbacks;
    this.dpr = Math.round(opts.dpr ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1));
    this.visibleBars = opts.visibleBars ?? DEFAULT_VISIBLE_BARS;
    this.gpuCanvas = document.createElement("canvas");
    this.hudCanvas = document.createElement("canvas");
    const baseStyle = "position:absolute;top:0;left:0;width:100%;height:100%;";
    this.gpuCanvas.style.cssText = baseStyle + "z-index:0;";
    this.hudCanvas.style.cssText = baseStyle + "z-index:1;pointer-events:none;";
    container.style.position = container.style.position || "relative";
    container.append(this.gpuCanvas, this.hudCanvas);
    this.ctrlBuf = new SharedArrayBuffer(STRIDE * 4);
    this.ctrl = new Int32Array(this.ctrlBuf);
    this.indSab = allocIndSab();
    Atomics.store(this.ctrl, this.slotId * STRIDE + POINTER_X, f32ToI32(-1));
    Atomics.store(this.ctrl, this.slotId * STRIDE + POINTER_Y, f32ToI32(-1));
    this.measureContainer(opts.width, opts.height);
    this.bindWorkerMessages();
    this.bindInteraction();
    this.resizeObserver = new ResizeObserver(() => {
      this.measureContainer();
      this.scheduleWake(true, true);
    });
    this.resizeObserver.observe(container);
    this.initWorker(opts);
  }
  initWorker(opts) {
    const gpuOffscreen = this.gpuCanvas.transferControlToOffscreen();
    const hudOffscreen = this.hudCanvas.transferControlToOffscreen();
    this.worker.postMessage({
      type: "init",
      descriptor: {
        slotId: this.slotId,
        ctrl: this.ctrlBuf,
        indSab: this.indSab
      },
      indSab: this.indSab,
      gpuCanvas: gpuOffscreen,
      hudCanvas: hudOffscreen,
      dpr: this.dpr,
      skipDefaultData: true,
      skipDefaultIndicators: opts.skipDefaultIndicators !== false,
      ticker: opts.ticker ?? ""
    }, [gpuOffscreen, hudOffscreen]);
  }
  bindWorkerMessages() {
    this.worker.addEventListener("message", (evt) => {
      if (this.destroyed)
        return;
      const msg = evt.data;
      if (!msg || typeof msg.type !== "string")
        return;
      if (msg.type === "ready") {
        this.ready = true;
        this.totalBars = Math.max(0, msg.bars | 0);
        this.clampViewport();
        this.scheduleWake(true, true);
        this.callbacks.onReady?.(this.totalBars, msg.format ?? "");
        for (const { msg: m, transfer } of this.pendingMessages) {
          this.worker.postMessage(m, transfer);
        }
        this.pendingMessages = [];
        return;
      }
      if (msg.type === "data_set") {
        this.totalBars = Math.max(0, msg.bars | 0);
        this.clampViewport();
        this.scheduleWake(true, true);
        this.callbacks.onDataSet?.(this.totalBars);
        return;
      }
      if (msg.type === "ind_sab_resize") {
        this.indSab = allocIndSab(msg.arenaF32Count);
        this.postToWorker({ type: "set_ind_sab", slotId: this.slotId, indSab: this.indSab });
        this.scheduleWake(true, true);
        return;
      }
      if (msg.type === "crosshair") {
        this.callbacks.onCrosshair?.(msg.payload);
        return;
      }
      if (msg.type === "click") {
        this.callbacks.onClick?.(msg.payload);
        return;
      }
      if (msg.type === "error" || msg.type === "ep_error") {
        this.callbacks.onError?.(String(msg.message ?? "unknown worker error"));
        return;
      }
      if (msg.type === "perf") {
        this._perfMetrics = {
          wasm: msg.wasm ?? { ewma: 0, p50: 0, p95: 0 },
          gpu: msg.gpu ?? { ewma: 0, p50: 0, p95: 0 },
          hud: msg.hud ?? { ewma: 0, p50: 0, p95: 0 },
          frame: msg.frame ?? { ewma: 0, p50: 0, p95: 0 }
        };
        return;
      }
    });
  }
  getPerformanceMetrics() {
    return this._perfMetrics;
  }
  postToWorker(msg, transfer) {
    if (this.destroyed)
      return;
    if (!this.ready) {
      this.pendingMessages.push({ msg, transfer });
      return;
    }
    this.worker.postMessage(msg, transfer);
  }
  bindInteraction() {
    const gpu = this.gpuCanvas;
    gpu.style.pointerEvents = "auto";
    gpu.addEventListener("pointerdown", (e) => {
      if (e.button !== 0)
        return;
      const p = this.getLocalPoint(e);
      this.dragPointerId = e.pointerId;
      this.dragOriginX = p.x;
      this.dragOriginStartBar = this.rawStartBar;
      this.pointerX = p.x;
      this.pointerY = p.y;
      gpu.setPointerCapture(e.pointerId);
      this.scheduleWake(false, true);
    });
    gpu.addEventListener("pointermove", (e) => {
      const p = this.getLocalPoint(e);
      this.pointerX = p.x;
      this.pointerY = p.y;
      if (this.dragPointerId === e.pointerId) {
        this.atRightEdge = false;
        const slotWidth = this.getSlotWidth();
        const deltaBars = (p.x - this.dragOriginX) / Math.max(0.000001, slotWidth);
        this.rawStartBar = this.dragOriginStartBar - deltaBars;
        this.clampViewport();
        this.scheduleWake(true, true);
        return;
      }
      this.scheduleWake(false, true);
    });
    const stopDrag = (e) => {
      if (this.dragPointerId !== e.pointerId)
        return;
      this.dragPointerId = -1;
      if (gpu.hasPointerCapture(e.pointerId)) {
        gpu.releasePointerCapture(e.pointerId);
      }
    };
    gpu.addEventListener("pointerup", stopDrag);
    gpu.addEventListener("pointercancel", stopDrag);
    gpu.addEventListener("pointerleave", () => {
      this.pointerX = -1;
      this.pointerY = -1;
      this.scheduleWake(false, true);
    });
    gpu.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = this.getLocalPoint(e);
      const currentVisible = this.visibleBars;
      const zoomCoeff = e.ctrlKey ? 0.04 : 0.0015;
      const nextVisible = Math.max(MIN_VISIBLE_BARS, Math.min(Math.max(MIN_VISIBLE_BARS, this.totalBars || currentVisible || DEFAULT_VISIBLE_BARS), Math.round(currentVisible * Math.exp(e.deltaY * zoomCoeff))));
      if (nextVisible === currentVisible)
        return;
      const chartAreaWidth = Math.max(1, this.plotW - 60);
      const oldRightMargin = this.atRightEdge ? Math.max(0, Math.round(currentVisible * RIGHT_MARGIN_RATIO)) : 0;
      const oldStep = chartAreaWidth / Math.max(1, currentVisible + oldRightMargin);
      const anchorRaw = this.rawStartBar + p.x / Math.max(0.000001, oldStep);
      const nextRightMargin = this.atRightEdge ? Math.max(0, Math.round(nextVisible * RIGHT_MARGIN_RATIO)) : 0;
      const nextStep = chartAreaWidth / Math.max(1, nextVisible + nextRightMargin);
      this.atRightEdge = false;
      this.visibleBars = nextVisible;
      this.rawStartBar = anchorRaw - p.x / Math.max(0.000001, nextStep);
      this.clampViewport();
      this.pointerX = p.x;
      this.pointerY = p.y;
      this.scheduleWake(true, true);
    }, { passive: false });
  }
  measureContainer(width, height) {
    if (width != null && height != null) {
      this.plotW = Math.max(1, Math.round(width));
      this.plotH = Math.max(1, Math.round(height));
    } else {
      const rect = this.gpuCanvas.parentElement?.getBoundingClientRect();
      if (rect) {
        this.plotW = Math.max(1, Math.round(rect.width));
        this.plotH = Math.max(1, Math.round(rect.height));
      }
    }
  }
  getLocalPoint(e) {
    const rect = this.gpuCanvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, e.clientX - rect.left), Math.max(0, rect.width - 1)),
      y: Math.min(Math.max(0, e.clientY - rect.top), Math.max(0, rect.height - 1))
    };
  }
  getSlotWidth() {
    const chartAreaWidth = Math.max(1, this.plotW - 60);
    const rightMarginBars = this.atRightEdge ? Math.max(0, Math.round(this.visibleBars * RIGHT_MARGIN_RATIO)) : 0;
    return chartAreaWidth / Math.max(1, this.visibleBars + rightMarginBars);
  }
  clampViewport() {
    const maxVisible = Math.max(MIN_VISIBLE_BARS, this.totalBars || DEFAULT_VISIBLE_BARS);
    this.visibleBars = Math.max(MIN_VISIBLE_BARS, Math.min(this.visibleBars | 0, maxVisible));
    const maxStartBar = Math.max(0, this.totalBars - this.visibleBars);
    if (this.atRightEdge) {
      this.rawStartBar = maxStartBar;
    }
    if (!Number.isFinite(this.rawStartBar))
      this.rawStartBar = maxStartBar;
    if (this.rawStartBar < 0)
      this.rawStartBar = 0;
    if (this.rawStartBar > maxStartBar)
      this.rawStartBar = maxStartBar;
    this.atRightEdge = this.totalBars <= this.visibleBars || this.rawStartBar >= maxStartBar - 0.000001;
    if (this.atRightEdge)
      this.rawStartBar = maxStartBar;
  }
  scheduleWake(gpuDirty, hudDirty) {
    if (this.destroyed)
      return;
    this.pendingGpuDirty = this.pendingGpuDirty || gpuDirty;
    this.pendingHudDirty = this.pendingHudDirty || hudDirty;
    this.publishCtrlState();
  }
  setIndicatorFlags(flags) {
    this.indicatorFlags = flags;
  }
  publishCtrlState() {
    if (this.destroyed)
      return;
    this.clampViewport();
    const rightMarginBars = this.atRightEdge ? Math.max(0, Math.round(this.visibleBars * RIGHT_MARGIN_RATIO)) : 0;
    const startBar = Math.floor(this.rawStartBar);
    const barRemainder = this.rawStartBar - startBar;
    const panOffsetPx = barRemainder * this.getSlotWidth();
    const flags = this.indicatorFlags | (this.atRightEdge ? AT_RIGHT_EDGE : 0);
    const nextGpuDirty = this.pendingGpuDirty || startBar !== this.prevStartBar || this.visibleBars !== this.prevVisibleBars || this.plotW !== this.prevPlotW || this.plotH !== this.prevPlotH || flags !== this.prevFlags || panOffsetPx !== this.prevPanOffsetPx || rightMarginBars !== this.prevRightMarginBars;
    const nextHudDirty = this.pendingHudDirty || nextGpuDirty || this.pointerX !== this.prevPointerX || this.pointerY !== this.prevPointerY;
    this.pendingGpuDirty = false;
    this.pendingHudDirty = false;
    if (!nextGpuDirty && !nextHudDirty)
      return;
    const base = this.slotId * STRIDE;
    Atomics.store(this.ctrl, base + START_BAR, startBar);
    Atomics.store(this.ctrl, base + VIS_BARS, this.visibleBars);
    Atomics.store(this.ctrl, base + PLOT_W, f32ToI32(this.plotW));
    Atomics.store(this.ctrl, base + PLOT_H, f32ToI32(this.plotH));
    Atomics.store(this.ctrl, base + POINTER_X, f32ToI32(this.pointerX));
    Atomics.store(this.ctrl, base + POINTER_Y, f32ToI32(this.pointerY));
    Atomics.store(this.ctrl, base + FLAGS, flags);
    Atomics.store(this.ctrl, base + SUBPIXEL_PAN_X, f32ToI32(panOffsetPx));
    Atomics.store(this.ctrl, base + RIGHT_MARGIN_BARS, rightMarginBars);
    Atomics.store(this.ctrl, base + DIRTY, (nextGpuDirty ? GPU_DIRTY | HUD_DIRTY : 0) | (nextHudDirty ? HUD_DIRTY : 0));
    const wake = Atomics.load(this.ctrl, base + WAKE) + 1 | 0;
    Atomics.store(this.ctrl, base + WAKE, wake);
    Atomics.notify(this.ctrl, base + WAKE);
    this.prevStartBar = startBar;
    this.prevVisibleBars = this.visibleBars;
    this.prevPlotW = this.plotW;
    this.prevPlotH = this.plotH;
    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
    this.prevFlags = flags;
    this.prevPanOffsetPx = panOffsetPx;
    this.prevRightMarginBars = rightMarginBars;
  }
  panByBars(deltaBars) {
    this.atRightEdge = false;
    this.rawStartBar += deltaBars;
    this.clampViewport();
    this.scheduleWake(true, true);
  }
  zoomAt(factor, centerX) {
    const cx = centerX ?? this.plotW * 0.5;
    const currentVisible = this.visibleBars;
    const nextVisible = Math.max(MIN_VISIBLE_BARS, Math.min(Math.max(MIN_VISIBLE_BARS, this.totalBars || DEFAULT_VISIBLE_BARS), Math.round(currentVisible * factor)));
    if (nextVisible === currentVisible)
      return;
    const chartAreaWidth = Math.max(1, this.plotW - 60);
    const oldRM = this.atRightEdge ? Math.max(0, Math.round(currentVisible * RIGHT_MARGIN_RATIO)) : 0;
    const oldStep = chartAreaWidth / Math.max(1, currentVisible + oldRM);
    const anchorRaw = this.rawStartBar + cx / Math.max(0.000001, oldStep);
    const nextRM = this.atRightEdge ? Math.max(0, Math.round(nextVisible * RIGHT_MARGIN_RATIO)) : 0;
    const nextStep = chartAreaWidth / Math.max(1, nextVisible + nextRM);
    this.atRightEdge = false;
    this.visibleBars = nextVisible;
    this.rawStartBar = anchorRaw - cx / Math.max(0.000001, nextStep);
    this.clampViewport();
    this.scheduleWake(true, true);
  }
  setViewport(startBar, visBars) {
    this.atRightEdge = false;
    this.rawStartBar = startBar;
    this.visibleBars = Math.max(MIN_VISIBLE_BARS, visBars);
    this.clampViewport();
    this.scheduleWake(true, true);
  }
  resize() {
    this.measureContainer();
    this.scheduleWake(true, true);
  }
  destroy() {
    if (this.destroyed)
      return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.worker.postMessage({ type: "destroy", slotId: this.slotId });
    this.destroyed = true;
    this.gpuCanvas.remove();
    this.hudCanvas.remove();
  }
}

// src/api/createChart.ts
var DEFAULT_ENTRY_COLOR = [0, 0.8, 0.2, 1];
var DEFAULT_EXIT_COLOR = [0.9, 0.2, 0.2, 1];
var DEFAULT_PROFIT_ZONE = [0, 0.8, 0.2, 0.08];
var DEFAULT_LOSS_ZONE = [0.9, 0.2, 0.2, 0.08];
var DEFAULT_SL_COLOR = [0.9, 0.2, 0.2, 0.8];
var DEFAULT_TP_COLOR = [0, 0.8, 0.2, 0.8];
function expandTradeRecords(trades, opts = {}) {
  const showMarkers = opts.showMarkers !== false;
  const showSlTpLines = opts.showSlTpLines !== false;
  const showZones = opts.showZones !== false;
  const showPnl = opts.showPnlLabels !== false;
  const showConf = opts.showConfidence === true;
  const entryColor = opts.entryColor ?? DEFAULT_ENTRY_COLOR;
  const exitColor = opts.exitColor ?? DEFAULT_EXIT_COLOR;
  const profitZone = opts.profitZoneColor ?? DEFAULT_PROFIT_ZONE;
  const lossZone = opts.lossZoneColor ?? DEFAULT_LOSS_ZONE;
  const out = [];
  for (let i = 0;i < trades.length; i++) {
    const t = trades[i];
    const prefix = `trade_${i}`;
    if (showMarkers) {
      out.push({
        type: "marker",
        id: `${prefix}_entry`,
        time: t.entryTime,
        price: t.entryPrice,
        shape: "arrow_up",
        color: entryColor,
        label: t.strategy ?? t.label
      });
    }
    if (showMarkers && t.exitTime != null && t.exitPrice != null) {
      out.push({
        type: "marker",
        id: `${prefix}_exit`,
        time: t.exitTime,
        price: t.exitPrice,
        shape: "arrow_down",
        color: exitColor,
        label: t.exitReason
      });
      if (showPnl && t.pnl != null) {
        const pctStr = t.pnlPercent != null ? ` (${t.pnlPercent > 0 ? "+" : ""}${t.pnlPercent.toFixed(1)}%)` : "";
        const sign = t.pnl >= 0 ? "+" : "";
        out.push({
          type: "text",
          id: `${prefix}_pnl`,
          time: t.exitTime,
          price: t.exitPrice,
          text: `${sign}$${Math.abs(t.pnl).toFixed(0)}${pctStr}`,
          color: t.pnl >= 0 ? entryColor : exitColor,
          anchor: "bottom",
          fontSize: 10
        });
      }
    }
    if (showSlTpLines && t.exitTime != null) {
      if (t.stopLoss != null) {
        out.push({
          type: "hline",
          id: `${prefix}_sl`,
          time: t.entryTime,
          timeEnd: t.exitTime,
          price: t.stopLoss,
          color: DEFAULT_SL_COLOR,
          dash: [4, 4],
          label: "SL"
        });
      }
      if (t.takeProfit != null) {
        out.push({
          type: "hline",
          id: `${prefix}_tp`,
          time: t.entryTime,
          timeEnd: t.exitTime,
          price: t.takeProfit,
          color: DEFAULT_TP_COLOR,
          dash: [4, 4],
          label: "TP"
        });
      }
    }
    if (showZones && t.exitTime != null && t.exitPrice != null) {
      const lo = Math.min(t.entryPrice, t.exitPrice);
      const hi = Math.max(t.entryPrice, t.exitPrice);
      const isProfit = t.pnl != null ? t.pnl >= 0 : t.exitPrice >= t.entryPrice;
      out.push({
        type: "zone",
        id: `${prefix}_zone`,
        time: t.entryTime,
        timeEnd: t.exitTime,
        price: lo,
        priceEnd: hi,
        color: isProfit ? profitZone : lossZone
      });
    }
    if (showConf && t.confidence != null) {
      out.push({
        type: "text",
        id: `${prefix}_conf`,
        time: t.entryTime,
        price: t.entryPrice,
        text: `conf: ${t.confidence.toFixed(2)}`,
        color: [1, 1, 1, 0.8],
        fontSize: 9,
        anchor: "top",
        bgColor: [0.2, 0.2, 0.2, 0.7]
      });
    }
  }
  return out;
}
function normalizeTimeToMs(value) {
  return value < 1000000000000 ? value * 1000 : value;
}
function toSoABuffersFromInput(bars) {
  const arr = bars ?? [];
  const count = arr.length;
  const time = new Float64Array(count);
  const open = new Float32Array(count);
  const high = new Float32Array(count);
  const low = new Float32Array(count);
  const close = new Float32Array(count);
  const volume = new Float32Array(count);
  if (count === 0)
    return { count, time, open, high, low, close, volume };
  const isTuple = Array.isArray(arr[0]);
  for (let i = 0;i < count; i++) {
    if (isTuple) {
      const t = arr[i];
      time[i] = normalizeTimeToMs(Number(t[0] ?? 0));
      open[i] = Number(t[1] ?? 0);
      high[i] = Number(t[2] ?? 0);
      low[i] = Number(t[3] ?? 0);
      close[i] = Number(t[4] ?? 0);
      volume[i] = Number(t[5] ?? 0);
    } else {
      const o = arr[i];
      time[i] = normalizeTimeToMs(Number(o.time ?? 0));
      open[i] = Number(o.open ?? 0);
      high[i] = Number(o.high ?? 0);
      low[i] = Number(o.low ?? 0);
      close[i] = Number(o.close ?? 0);
      volume[i] = Number(o.volume ?? 0);
    }
  }
  return { count, time, open, high, low, close, volume };
}
function createWorkerChart(container, options) {
  let _indicatorHandleCounter = 1;
  let _annotationIdCounter = 1;
  const _annotations = new Map;
  const _indicators = new Map;
  let _tradeAnnotationIds = [];
  const _visibleRangeView = new Int32Array(3);
  const eventListeners = new Map;
  function emit(event, data) {
    const cbs = eventListeners.get(event);
    if (cbs)
      for (const cb of cbs)
        cb(data);
  }
  const callbacks = {};
  const bridge = new WorkerBridge(container, options.worker, {
    width: options.width,
    height: options.height,
    dpr: options.dpr,
    visibleBars: options.visibleBars,
    skipDefaultIndicators: true,
    ticker: options.symbol ?? ""
  }, callbacks);
  callbacks.onReady = () => {
    emit("viewportChange", {
      startBar: Math.floor(bridge.rawStartBar),
      visibleBars: bridge.visibleBars,
      totalBars: bridge.totalBars
    });
  };
  callbacks.onDataSet = () => {
    emit("viewportChange", {
      startBar: Math.floor(bridge.rawStartBar),
      visibleBars: bridge.visibleBars,
      totalBars: bridge.totalBars
    });
  };
  callbacks.onCrosshair = (payload) => {
    emit("crosshair", payload);
  };
  callbacks.onClick = (payload) => {
    emit("click", payload);
  };
  callbacks.onError = (msg) => {
    console.error("[Mochart Worker]", msg);
  };
  function nextAnnotationId() {
    return `ann_${(_annotationIdCounter++).toString(36)}`;
  }
  function makeAnnotationHandle(ann) {
    const id = ann.id ?? nextAnnotationId();
    const stored = { ...ann, id };
    _annotations.set(id, stored);
    return {
      id,
      update(patch) {
        const existing = _annotations.get(id);
        if (!existing)
          return;
        Object.assign(existing, patch);
      },
      remove() {
        _annotations.delete(id);
      }
    };
  }
  const api = {
    setData(bars) {
      const soa = toSoABuffersFromInput(bars);
      bridge.postToWorker({
        type: "set_data_soa",
        count: soa.count,
        time: soa.time.buffer,
        open: soa.open.buffer,
        high: soa.high.buffer,
        low: soa.low.buffer,
        close: soa.close.buffer,
        volume: soa.volume.buffer
      }, [soa.time.buffer, soa.open.buffer, soa.high.buffer, soa.low.buffer, soa.close.buffer, soa.volume.buffer]);
    },
    setDataBinary(data) {
      bridge.postToWorker({ type: "set_data_binary", data }, [data]);
    },
    setDataUrl(url) {
      bridge.postToWorker({ type: "set_data_url", url });
    },
    appendTick() {},
    panByBars(deltaBars) {
      bridge.panByBars(deltaBars);
    },
    zoomAt(factor, centerX) {
      bridge.zoomAt(factor, centerX);
    },
    setViewport(startBar, visibleBars) {
      bridge.setViewport(startBar, visibleBars);
    },
    getVisibleRangeView() {
      _visibleRangeView[0] = Math.floor(bridge.rawStartBar);
      _visibleRangeView[1] = bridge.visibleBars;
      _visibleRangeView[2] = bridge.totalBars;
      return _visibleRangeView;
    },
    getVisibleRangeSnapshot() {
      return {
        startBar: Math.floor(bridge.rawStartBar),
        visibleBars: bridge.visibleBars,
        totalBars: bridge.totalBars
      };
    },
    getVisibleRange() {
      return this.getVisibleRangeSnapshot();
    },
    addIndicator(config) {
      const handleId = _indicatorHandleCounter++;
      const color = config.color || [0.2, 0.6, 0.9, 1];
      _indicators.set(handleId, { ...config });
      bridge.postToWorker({
        type: "ep_add",
        id: handleId.toString(),
        kind: String(config.kind),
        period: config.period,
        pane: String(config.pane),
        style: config.style != null ? String(config.style) : undefined,
        r: color[0],
        g: color[1],
        b: color[2],
        a: color[3],
        lineWidth: config.lineWidth,
        slow: config.slow,
        signal: config.signal,
        stdDev: config.stdDev
      });
      const handle = {
        id: handleId,
        applyOptions(params) {
          api.updateIndicator(handleId, params);
        },
        remove() {
          api.removeIndicator(handleId);
        }
      };
      return handle;
    },
    updateIndicator(id, params) {
      const existing = _indicators.get(id);
      if (existing)
        Object.assign(existing, params);
      const payload = { type: "ep_update", id: id.toString() };
      if (payload.type !== "ep_update")
        return;
      if (params.kind !== undefined)
        payload.kind = String(params.kind);
      if (params.period !== undefined)
        payload.period = params.period;
      if (params.pane !== undefined)
        payload.pane = String(params.pane);
      if (params.style !== undefined)
        payload.style = String(params.style);
      if (params.lineWidth !== undefined)
        payload.lineWidth = params.lineWidth;
      if (params.slow !== undefined)
        payload.slow = params.slow;
      if (params.signal !== undefined)
        payload.signal = params.signal;
      if (params.stdDev !== undefined)
        payload.stdDev = params.stdDev;
      if (params.color) {
        payload.r = params.color[0];
        payload.g = params.color[1];
        payload.b = params.color[2];
        payload.a = params.color[3];
      }
      bridge.postToWorker(payload);
    },
    removeIndicator(id) {
      _indicators.delete(id);
      bridge.postToWorker({ type: "ep_remove", id: id.toString() });
    },
    getIndicators() {
      return Array.from(_indicators.values());
    },
    setPaneConfig(config) {
      bridge.postToWorker({
        type: "pane_config",
        gap: config.gap ?? 2,
        weights: [config.main ?? 7, config.sub1 ?? 1.5, config.sub2 ?? 1.5]
      });
    },
    addAnnotation(annotation) {
      return makeAnnotationHandle(annotation);
    },
    addAnnotations(annotations) {
      return annotations.map((a) => makeAnnotationHandle(a));
    },
    updateAnnotation(id, patch) {
      const existing = _annotations.get(id);
      if (existing)
        Object.assign(existing, patch);
    },
    removeAnnotation(id) {
      _annotations.delete(id);
    },
    clearAnnotations() {
      _annotations.clear();
      _tradeAnnotationIds = [];
    },
    getAnnotations() {
      return Array.from(_annotations.values());
    },
    setTradeRecords(trades, displayOptions) {
      for (const tid of _tradeAnnotationIds)
        _annotations.delete(tid);
      const expanded = expandTradeRecords(trades, displayOptions);
      _tradeAnnotationIds = expanded.map((a) => makeAnnotationHandle(a).id);
    },
    clearTradeRecords() {
      for (const tid of _tradeAnnotationIds)
        _annotations.delete(tid);
      _tradeAnnotationIds = [];
    },
    resize() {
      bridge.resize();
    },
    destroy() {
      bridge.destroy();
    },
    on(event, cb) {
      let set = eventListeners.get(event);
      if (!set) {
        set = new Set;
        eventListeners.set(event, set);
      }
      set.add(cb);
    },
    off(event, cb) {
      if (cb)
        eventListeners.get(event)?.delete(cb);
      else
        eventListeners.delete(event);
    },
    getPerformanceMetrics() {
      return bridge.getPerformanceMetrics();
    }
  };
  Object.defineProperty(api, "__setDataDdbp", {
    enumerable: false,
    configurable: false,
    writable: false,
    value(payload) {
      const transfer = new Array;
      const timeBuffer = payload.time.buffer;
      const blockMetaBuffer = payload.blockMeta.buffer;
      const blockWordsBuffer = payload.blockWords.buffer;
      if (timeBuffer instanceof ArrayBuffer)
        transfer.push(timeBuffer);
      if (blockMetaBuffer instanceof ArrayBuffer && blockMetaBuffer !== timeBuffer)
        transfer.push(blockMetaBuffer);
      if (blockWordsBuffer instanceof ArrayBuffer && blockWordsBuffer !== timeBuffer && blockWordsBuffer !== blockMetaBuffer) {
        transfer.push(blockWordsBuffer);
      }
      bridge.postToWorker({
        type: "set_data_ddbp",
        count: payload.count,
        blockSize: payload.blockSize,
        tickSize: payload.tickSize,
        basePrice: payload.basePrice,
        time: timeBuffer,
        timeByteOffset: payload.time.byteOffset,
        timeLength: payload.time.length,
        blockMeta: blockMetaBuffer,
        blockMetaByteOffset: payload.blockMeta.byteOffset,
        blockMetaLength: payload.blockMeta.length,
        blockWords: blockWordsBuffer,
        blockWordsByteOffset: payload.blockWords.byteOffset,
        blockWordsLength: payload.blockWords.length
      }, transfer);
    }
  });
  if (typeof options.dataUrl === "string" && options.dataUrl.length > 0) {
    api.setDataUrl(options.dataUrl);
  } else if (options.data != null) {
    api.setData(options.data);
  }
  if (Array.isArray(options.indicators)) {
    for (const cfg of options.indicators) {
      api.addIndicator(cfg);
    }
  }
  return api;
}
function createNoopChart() {
  const _annotations = new Map;
  let _annotationIdCounter = 1;
  let _indicatorHandleCounter = 1;
  let _tradeAnnotationIds = [];
  const _visibleRangeView = new Int32Array(3);
  function nextAnnotationId() {
    return `ann_${(_annotationIdCounter++).toString(36)}`;
  }
  function makeAnnotationHandle(ann) {
    const id = ann.id ?? nextAnnotationId();
    const stored = { ...ann, id };
    _annotations.set(id, stored);
    return {
      id,
      update(patch) {
        const existing = _annotations.get(id);
        if (!existing)
          return;
        Object.assign(existing, patch);
      },
      remove() {
        _annotations.delete(id);
      }
    };
  }
  return {
    setData() {},
    setDataBinary() {},
    setDataUrl() {},
    appendTick() {},
    panByBars() {},
    zoomAt() {},
    setViewport() {},
    getVisibleRangeView() {
      return _visibleRangeView;
    },
    getVisibleRangeSnapshot() {
      return { startBar: 0, visibleBars: 0, totalBars: 0 };
    },
    getVisibleRange() {
      return { startBar: 0, visibleBars: 0, totalBars: 0 };
    },
    addIndicator(_config) {
      const id = _indicatorHandleCounter++;
      return { id, applyOptions() {}, remove() {} };
    },
    updateIndicator() {},
    removeIndicator() {},
    getIndicators() {
      return [];
    },
    setPaneConfig() {},
    addAnnotation(annotation) {
      return makeAnnotationHandle(annotation);
    },
    addAnnotations(annotations) {
      return annotations.map((a) => makeAnnotationHandle(a));
    },
    updateAnnotation(id, patch) {
      const existing = _annotations.get(id);
      if (existing)
        Object.assign(existing, patch);
    },
    removeAnnotation(id) {
      _annotations.delete(id);
    },
    clearAnnotations() {
      _annotations.clear();
      _tradeAnnotationIds = [];
    },
    getAnnotations() {
      return Array.from(_annotations.values());
    },
    setTradeRecords(trades, displayOptions) {
      for (const tid of _tradeAnnotationIds)
        _annotations.delete(tid);
      const expanded = expandTradeRecords(trades, displayOptions);
      _tradeAnnotationIds = expanded.map((a) => makeAnnotationHandle(a).id);
    },
    clearTradeRecords() {
      for (const tid of _tradeAnnotationIds)
        _annotations.delete(tid);
      _tradeAnnotationIds = [];
    },
    resize() {},
    destroy() {},
    on(_event, _cb) {},
    off(_event, _cb) {},
    getPerformanceMetrics() {
      return { wasm: { ewma: 0, p50: 0, p95: 0 }, gpu: { ewma: 0, p50: 0, p95: 0 }, hud: { ewma: 0, p50: 0, p95: 0 }, frame: { ewma: 0, p50: 0, p95: 0 } };
    }
  };
}
function createChart(container, options) {
  if (options?.worker) {
    return createWorkerChart(container, options);
  }
  return createNoopChart();
}
// src/api/createChartManager.ts
class ChartSlotPool {
  free = [];
  next = 0;
  acquire() {
    if (this.free.length > 0) {
      return this.free.pop();
    }
    const slot = this.next;
    this.next += 1;
    return slot;
  }
  release(slot) {
    if (!Number.isInteger(slot) || slot < 0)
      return;
    for (let i = 0;i < this.free.length; i++) {
      if (this.free[i] === slot)
        return;
    }
    this.free.push(slot);
  }
}
function createChartManagerWithFactory(options, createChartFn) {
  const maxCharts = options?.maxCharts ?? 16;
  const _charts = new Map;
  const slots = new ChartSlotPool;
  const sharedDataWorker = options?.sharedWorker ?? options?.createWorker?.();
  return {
    createChart(container, chartOptions) {
      if (_charts.size >= maxCharts) {
        throw new Error(`MochartManager: max ${maxCharts} charts exceeded`);
      }
      const slot = slots.acquire();
      const mergedOptions = {
        ...chartOptions ?? {},
        managerSlotId: slot
      };
      if (sharedDataWorker) {
        mergedOptions.worker = sharedDataWorker;
      }
      const chart = createChartFn(container, mergedOptions);
      _charts.set(chart, slot);
      return chart;
    },
    destroyChart(chart) {
      const slot = _charts.get(chart);
      if (slot == null)
        return;
      _charts.delete(chart);
      slots.release(slot);
      chart.destroy();
    },
    destroyAll() {
      for (const [chart, slot] of _charts.entries()) {
        slots.release(slot);
        chart.destroy();
      }
      _charts.clear();
    },
    get activeCount() {
      return _charts.size;
    }
  };
}
function createChartManager(options) {
  return createChartManagerWithFactory(options, createChart);
}
// src/api/IChartApi.ts
var IndicatorKind = {
  SMA: "SMA",
  EMA: "EMA",
  BollingerBands: "BB",
  RSI: "RSI",
  MACD: "MACD",
  ATR: "ATR",
  OBV: "OBV",
  Volume: "Volume"
};
var RenderStyle = {
  Line: "Line",
  ThickLine: "ThickLine",
  Histogram: "Histogram",
  Band: "Band"
};
export {
  createChartManager,
  createChart,
  RenderStyle,
  IndicatorKind
};
