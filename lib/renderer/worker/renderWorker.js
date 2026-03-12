var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/renderer/candleLayout.ts
var BODY_WIDTH_RATIO = 0.5;
var MIN_BODY_WIDTH_PX = 1;
var MAX_BODY_WIDTH_PX = 40;
var WICK_WIDTH_PX = 1;
var DEFAULT_PADDING_RATIO = 0.05;
var DEFAULT_MIN_PADDING_PX = 6;
function computePaddedPriceRange(rawMin, rawMax, plotHeightPx, paddingRatio = DEFAULT_PADDING_RATIO, minPaddingPx = DEFAULT_MIN_PADDING_PX) {
  if (!isFinite(rawMin) || !isFinite(rawMax)) {
    return { min: 0, max: 1, range: 1 };
  }
  const rawRange = Math.max(rawMax - rawMin, Math.max(0.000000001, Math.abs(rawMax) * 0.001));
  const basePad = rawRange * paddingRatio;
  const minPaddingPrice = rawRange / Math.max(1, plotHeightPx) * minPaddingPx;
  const pad = Math.max(basePad, minPaddingPrice);
  const min = rawMin - pad;
  const max = rawMax + pad;
  return { min, max, range: max - min || 1 };
}
function computeCandleMetrics(totalSlots, plotWidthPx) {
  const stepPx = plotWidthPx / Math.max(1, totalSlots - 1);
  const bodyWidthPx = Math.max(MIN_BODY_WIDTH_PX, Math.min(Math.floor(stepPx * BODY_WIDTH_RATIO), MAX_BODY_WIDTH_PX));
  return { stepPx, bodyWidthPx, wickWidthPx: WICK_WIDTH_PX };
}
function computeRendererLayout(canvasWidth, canvasHeight, options) {
  const gutterLeft = options?.yAxisGutterPx ?? 56;
  const gutterRight = 8;
  const gutterTop = 8;
  const xAxisHeight = options?.xAxisHeightPx ?? 26;
  const plotX = gutterLeft;
  const plotY = gutterTop;
  const plotW = Math.max(1, canvasWidth - gutterLeft - gutterRight);
  const plotH = Math.max(1, canvasHeight - gutterTop - xAxisHeight - 6);
  return {
    gutterLeft,
    gutterTop,
    gutterRight,
    xAxisHeight,
    plotX,
    plotY,
    plotW,
    plotH
  };
}

// src/renderer/worker/protocol.ts
var WORKER_RENDER_SCHEMA_VERSION = 1;
var WORKER_HUD_OVERLAY_SCHEMA_VERSION = 1;
function normalizeWorkerHudOverlaySnapshot(input) {
  if (!input)
    return;
  const markerCount = Number.isFinite(input.markerCount) ? Math.max(0, Math.floor(input.markerCount)) : 0;
  const hlineCount = Number.isFinite(input.hlineCount) ? Math.max(0, Math.floor(input.hlineCount)) : 0;
  const zoneCount = Number.isFinite(input.zoneCount) ? Math.max(0, Math.floor(input.zoneCount)) : 0;
  const textCount = Number.isFinite(input.textCount) ? Math.max(0, Math.floor(input.textCount)) : 0;
  const eventCount = Number.isFinite(input.eventCount) ? Math.max(0, Math.floor(input.eventCount)) : 0;
  let fallbackKindMask = 0;
  if (markerCount > 0)
    fallbackKindMask |= 1 << 0;
  if (hlineCount > 0)
    fallbackKindMask |= 1 << 1;
  if (zoneCount > 0)
    fallbackKindMask |= 1 << 2;
  if (textCount > 0)
    fallbackKindMask |= 1 << 3;
  if (eventCount > 0)
    fallbackKindMask |= 1 << 4;
  const totalFallback = markerCount + hlineCount + zoneCount + textCount + eventCount;
  const totalCount = Number.isFinite(input.totalCount) ? Math.max(0, Math.floor(input.totalCount)) : totalFallback;
  const kindMask = Number.isFinite(input.kindMask) ? Math.max(0, Math.floor(input.kindMask)) : fallbackKindMask;
  const version = Number.isFinite(input.version) ? Math.max(1, Math.floor(input.version)) : WORKER_HUD_OVERLAY_SCHEMA_VERSION;
  return {
    version,
    markerCount,
    hlineCount,
    zoneCount,
    textCount,
    eventCount,
    totalCount,
    kindMask
  };
}

// src/renderer/worker/sharedFrameBuffer.ts
var CONTROL_LENGTH = 3;

class SharedOhlcvFrameBuffer {
  capacity = 0;
  generation = 0;
  channels;
  constructor(initialCapacity = 0) {
    this.channels = this.allocateChannels(Math.max(0, initialCapacity));
    this.capacity = Math.max(0, initialCapacity);
  }
  getCapacity() {
    return this.capacity;
  }
  getGeneration() {
    return this.generation;
  }
  getDescriptor() {
    return {
      capacity: this.capacity,
      timeBuffer: this.channels.time.buffer,
      openBuffer: this.channels.open.buffer,
      highBuffer: this.channels.high.buffer,
      lowBuffer: this.channels.low.buffer,
      closeBuffer: this.channels.close.buffer,
      volumeBuffer: this.channels.volume.buffer,
      controlBuffer: this.channels.control.buffer
    };
  }
  writeFrame(data, startIndex, visibleCount) {
    const requiredCount = Math.max(0, Math.floor(visibleCount));
    const resized = this.ensureCapacity(requiredCount);
    const channels = this.channels;
    const start = Math.max(0, Math.floor(startIndex));
    const clampedCount = Math.max(0, Math.min(requiredCount, data.length - start));
    for (let i = 0;i < clampedCount; i++) {
      const bar = data[start + i];
      channels.time[i] = bar.time;
      channels.open[i] = bar.open;
      channels.high[i] = bar.high;
      channels.low[i] = bar.low;
      channels.close[i] = bar.close;
      channels.volume[i] = bar.volume;
    }
    Atomics.store(channels.control, 1, start);
    Atomics.store(channels.control, 2, clampedCount);
    const frameId = Atomics.add(channels.control, 0, 1) + 1;
    Atomics.notify(channels.control, 0);
    return { frameId, resized };
  }
  writeFrameFromColumnar(data, startIndex, visibleCount) {
    const requiredCount = Math.max(0, Math.floor(visibleCount));
    const resized = this.ensureCapacity(requiredCount);
    const channels = this.channels;
    const start = Math.max(0, Math.floor(startIndex));
    const clampedCount = Math.max(0, Math.min(requiredCount, data.length - start));
    if (clampedCount > 0) {
      channels.time.set(data.time.subarray(start, start + clampedCount), 0);
      channels.open.set(data.open.subarray(start, start + clampedCount), 0);
      channels.high.set(data.high.subarray(start, start + clampedCount), 0);
      channels.low.set(data.low.subarray(start, start + clampedCount), 0);
      channels.close.set(data.close.subarray(start, start + clampedCount), 0);
      channels.volume.set(data.volume.subarray(start, start + clampedCount), 0);
    }
    Atomics.store(channels.control, 1, start);
    Atomics.store(channels.control, 2, clampedCount);
    const frameId = Atomics.add(channels.control, 0, 1) + 1;
    Atomics.notify(channels.control, 0);
    return { frameId, resized };
  }
  ensureCapacity(requiredCount) {
    if (requiredCount <= this.capacity)
      return false;
    let nextCapacity = Math.max(16, this.capacity);
    while (nextCapacity < requiredCount) {
      nextCapacity *= 2;
    }
    const prev = this.channels;
    const next = this.allocateChannels(nextCapacity);
    next.time.set(prev.time.subarray(0, this.capacity));
    next.open.set(prev.open.subarray(0, this.capacity));
    next.high.set(prev.high.subarray(0, this.capacity));
    next.low.set(prev.low.subarray(0, this.capacity));
    next.close.set(prev.close.subarray(0, this.capacity));
    next.volume.set(prev.volume.subarray(0, this.capacity));
    next.control[0] = prev.control[0] ?? 0;
    this.channels = next;
    this.capacity = nextCapacity;
    this.generation++;
    return true;
  }
  allocateChannels(capacity) {
    if (typeof SharedArrayBuffer === "undefined") {
      throw new Error("SharedArrayBuffer is not available in this environment");
    }
    return {
      time: new Float64Array(new SharedArrayBuffer(Math.max(1, capacity) * Float64Array.BYTES_PER_ELEMENT), 0, Math.max(1, capacity)),
      open: new Float32Array(new SharedArrayBuffer(Math.max(1, capacity) * Float32Array.BYTES_PER_ELEMENT), 0, Math.max(1, capacity)),
      high: new Float32Array(new SharedArrayBuffer(Math.max(1, capacity) * Float32Array.BYTES_PER_ELEMENT), 0, Math.max(1, capacity)),
      low: new Float32Array(new SharedArrayBuffer(Math.max(1, capacity) * Float32Array.BYTES_PER_ELEMENT), 0, Math.max(1, capacity)),
      close: new Float32Array(new SharedArrayBuffer(Math.max(1, capacity) * Float32Array.BYTES_PER_ELEMENT), 0, Math.max(1, capacity)),
      volume: new Float32Array(new SharedArrayBuffer(Math.max(1, capacity) * Float32Array.BYTES_PER_ELEMENT), 0, Math.max(1, capacity)),
      control: new Int32Array(new SharedArrayBuffer(CONTROL_LENGTH * Int32Array.BYTES_PER_ELEMENT), 0, CONTROL_LENGTH)
    };
  }
}
function createSharedViews(descriptor) {
  const capacity = Math.max(1, descriptor.capacity);
  return {
    time: new Float64Array(descriptor.timeBuffer, 0, capacity),
    open: new Float32Array(descriptor.openBuffer, 0, capacity),
    high: new Float32Array(descriptor.highBuffer, 0, capacity),
    low: new Float32Array(descriptor.lowBuffer, 0, capacity),
    close: new Float32Array(descriptor.closeBuffer, 0, capacity),
    volume: new Float32Array(descriptor.volumeBuffer, 0, capacity),
    control: new Int32Array(descriptor.controlBuffer, 0, CONTROL_LENGTH)
  };
}

// src/renderer/worker/geometryPreprocess.ts
var FLOATS_PER_POINT = 6;
function toY(value, min, max, height) {
  const range = max - min || 1;
  const ratio = (value - min) / range;
  return height - ratio * height;
}
function computeRange(accessors) {
  if (accessors.count <= 0)
    return { min: 0, max: 1 };
  let min = accessors.getLow(0);
  let max = accessors.getHigh(0);
  for (let i = 1;i < accessors.count; i++) {
    const low = accessors.getLow(i);
    const high = accessors.getHigh(i);
    if (low < min)
      min = low;
    if (high > max)
      max = high;
  }
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }
  return { min, max };
}
function preprocessCandleGeometry(accessors) {
  const count = Math.max(0, accessors.count);
  if (count === 0) {
    return {
      buffer: new Float32Array(0),
      count: 0,
      bodyWidth: 1,
      wickWidth: 1,
      stepX: 1,
      min: 0,
      max: 1
    };
  }
  const { width, height, rightMarginBars } = accessors;
  const visibleCount = Math.max(1, Math.floor(accessors.visibleCount ?? count));
  const startFraction = accessors.startFraction ?? 0;
  const sampleStride = count > width ? Math.ceil(count / Math.max(1, Math.floor(width))) : 1;
  const renderCount = Math.ceil(count / sampleStride);
  const totalSlots = Math.max(1, Math.floor(visibleCount) + Math.max(0, rightMarginBars));
  const stepX = width / Math.max(1, totalSlots - 1);
  const bodyWidth = Math.max(1, stepX * 0.65);
  const wickWidth = Math.max(1, stepX * 0.15);
  const { min, max } = computeRange(accessors);
  const buffer = new Float32Array(renderCount * FLOATS_PER_POINT);
  let writeIndex = 0;
  let slot = 0;
  for (let sourceIndex = 0;sourceIndex < count; sourceIndex += sampleStride) {
    const open = accessors.getOpen(sourceIndex);
    const close = accessors.getClose(sourceIndex);
    const high = accessors.getHigh(sourceIndex);
    const low = accessors.getLow(sourceIndex);
    const xCenter = (slot - startFraction) * stepX;
    buffer[writeIndex++] = xCenter;
    buffer[writeIndex++] = toY(open, min, max, height);
    buffer[writeIndex++] = toY(close, min, max, height);
    buffer[writeIndex++] = toY(high, min, max, height);
    buffer[writeIndex++] = toY(low, min, max, height);
    buffer[writeIndex++] = close >= open ? 1 : 0;
    slot++;
  }
  return {
    buffer,
    count: slot,
    bodyWidth,
    wickWidth,
    stepX,
    min,
    max
  };
}

// src/renderer/overlay/displayPrimitives.ts
function computeNiceStep(range, targetTicks) {
  const safeRange = Math.max(range, 0.000000001);
  const raw = safeRange / Math.max(1, targetTicks);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / pow;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return nice * pow;
}
function drawYAxisGridAndLabels(ctx, params) {
  const {
    plotX,
    plotY,
    plotW,
    plotH,
    yMin,
    yMax,
    axisColor,
    gridColor,
    formatPrice
  } = params;
  const targetYTicks = params.targetYTicks ?? 5;
  const priceToY = (price) => {
    const t = (price - yMin) / (yMax - yMin || 1);
    return plotY + (1 - t) * plotH;
  };
  const step = computeNiceStep(yMax - yMin, targetYTicks);
  const firstTick = Math.ceil(yMin / step) * step;
  ctx.font = params.font ?? "12px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = axisColor;
  for (let tick = firstTick;tick <= yMax + 0.000000000001; tick += step) {
    const y = priceToY(tick);
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();
    ctx.fillText(formatPrice(tick), plotX - 8, y);
  }
  ctx.strokeStyle = axisColor;
  ctx.beginPath();
  ctx.moveTo(plotX, plotY);
  ctx.lineTo(plotX, plotY + plotH);
  ctx.stroke();
}
function drawXAxisTicksAndLabels(ctx, params) {
  const {
    plotX,
    plotY,
    plotW,
    plotH,
    stepX,
    visibleCount,
    axisColor,
    getLabelAtLocalIndex
  } = params;
  const targetXTicks = params.targetXTicks ?? 6;
  ctx.fillStyle = axisColor;
  ctx.font = params.font ?? "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1;
  for (let i = 0;i < targetXTicks; i++) {
    const frac = targetXTicks <= 1 ? 0 : i / (targetXTicks - 1);
    const localIdx = Math.round(frac * Math.max(0, visibleCount - 1));
    const x = plotX + localIdx * stepX;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, plotY + plotH);
    ctx.lineTo(x + 0.5, plotY + plotH + 6);
    ctx.stroke();
    ctx.fillText(getLabelAtLocalIndex(localIdx), x, plotY + plotH + 6);
  }
  ctx.beginPath();
  ctx.moveTo(plotX, plotY + plotH);
  ctx.lineTo(plotX + plotW, plotY + plotH);
  ctx.stroke();
}
function drawHudTag(ctx, params) {
  const paddingX = params.paddingX ?? 4;
  const tagHeight = params.height ?? 16;
  const textColor = params.textColor ?? "#ffffff";
  ctx.font = params.font ?? "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(params.text).width;
  const tagWidth = textWidth + paddingX * 2;
  ctx.fillStyle = params.backgroundColor;
  ctx.fillRect(params.anchorX - tagWidth, params.centerY - tagHeight / 2, tagWidth, tagHeight);
  ctx.fillStyle = textColor;
  ctx.fillText(params.text, params.anchorX - paddingX, params.centerY);
}

// src/renderer/overlay/crosshairOverlay.ts
function drawCrosshairOverlay(ctx, params) {
  const {
    plotX,
    plotY,
    plotW,
    plotH,
    x,
    clampedY,
    strokeColor,
    lineWidth,
    labelText
  } = params;
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, plotY);
  ctx.lineTo(x + 0.5, plotY + plotH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotX, clampedY + 0.5);
  ctx.lineTo(plotX + plotW, clampedY + 0.5);
  ctx.stroke();
  if (labelText.length > 0) {
    drawHudTag(ctx, {
      anchorX: plotX - 4,
      centerY: clampedY,
      text: labelText,
      backgroundColor: strokeColor,
      textColor: "#ffffff",
      font: "11px sans-serif",
      paddingX: 4,
      height: 16
    });
  }
  ctx.restore();
}

// src/renderer/worker/renderWorker.ts
var canvas = null;
var ctx = null;
var lastPayload = null;
var lastSharedPayload = null;
var sharedViews = null;
var currentDpr = 1;
var rafId = null;
var pendingOverlay = null;
var overlayPrimitiveRevision = -1;
var overlayPrimitives = [];
var currentChartId = -1;
var chartStates = new Map;
function makeChartState() {
  return {
    canvas: null,
    ctx: null,
    lastPayload: null,
    lastSharedPayload: null,
    sharedViews: null,
    currentDpr: 1,
    rafId: null,
    pendingOverlay: null,
    overlayPrimitiveRevision: -1,
    overlayPrimitives: [],
    hudSummaryCache: { key: "", text: "" }
  };
}
function activateChartState(chartId) {
  let state = chartStates.get(chartId);
  if (!state) {
    state = makeChartState();
    chartStates.set(chartId, state);
  }
  currentChartId = chartId;
  canvas = state.canvas;
  ctx = state.ctx;
  lastPayload = state.lastPayload;
  lastSharedPayload = state.lastSharedPayload;
  sharedViews = state.sharedViews;
  currentDpr = state.currentDpr;
  rafId = state.rafId;
  pendingOverlay = state.pendingOverlay;
  overlayPrimitiveRevision = state.overlayPrimitiveRevision;
  overlayPrimitives = state.overlayPrimitives;
  hudSummaryCache = state.hudSummaryCache;
  return state;
}
function persistActiveChartState() {
  if (currentChartId < 0)
    return;
  const state = chartStates.get(currentChartId);
  if (!state)
    return;
  state.canvas = canvas;
  state.ctx = ctx;
  state.lastPayload = lastPayload;
  state.lastSharedPayload = lastSharedPayload;
  state.sharedViews = sharedViews;
  state.currentDpr = currentDpr;
  state.rafId = rafId;
  state.pendingOverlay = pendingOverlay;
  state.overlayPrimitiveRevision = overlayPrimitiveRevision;
  state.overlayPrimitives = overlayPrimitives;
  state.hudSummaryCache = hudSummaryCache;
}
var BACKGROUND = "#ffffff";
var UP = "#00b359";
var DOWN = "#d93636";
var WICK = "#2a2a2a";
var AXIS = "#222222";
var GRID = "#e6e6e6";
var HUD_SUMMARY_BG = "rgba(0,0,0,0.64)";
var WATERMARK_TEXT = "Mochart alpha - not for redistribution";
var EMPTY_DASH = [];
function resolveTimeToX(time, firstTime, spanMs, plotX, plotW) {
  const t = spanMs > 0 ? (time - firstTime) / spanMs : 0;
  const clamped = Math.max(0, Math.min(1, t));
  return plotX + clamped * plotW;
}
function resolvePriceToY(price, yMin, yMax, plotY, plotH) {
  const den = Math.max(0.000001, yMax - yMin);
  const t = (price - yMin) / den;
  const clamped = Math.max(0, Math.min(1, t));
  return plotY + (1 - clamped) * plotH;
}
function drawOverlayPrimitives(renderCtx, primitives, firstTime, spanMs, yMin, yMax, plotX, plotY, plotW, plotH) {
  if (primitives.length === 0)
    return;
  for (let i = 0;i < primitives.length; i++) {
    const p = primitives[i];
    if (p.type === "zone") {
      const x1 = resolveTimeToX(p.time, firstTime, spanMs, plotX, plotW);
      const x2 = resolveTimeToX(p.timeEnd, firstTime, spanMs, plotX, plotW);
      const y1 = resolvePriceToY(p.priceEnd ?? yMax, yMin, yMax, plotY, plotH);
      const y2 = resolvePriceToY(p.price ?? yMin, yMin, yMax, plotY, plotH);
      renderCtx.fillStyle = p.colorCss ?? "rgba(80,80,80,0.14)";
      renderCtx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.max(1, Math.abs(y2 - y1)));
      continue;
    }
    if (p.type === "hline") {
      const lx1 = p.time != null ? resolveTimeToX(p.time, firstTime, spanMs, plotX, plotW) : plotX;
      const lx2 = p.timeEnd != null ? resolveTimeToX(p.timeEnd, firstTime, spanMs, plotX, plotW) : plotX + plotW;
      const ly = resolvePriceToY(p.price, yMin, yMax, plotY, plotH);
      renderCtx.strokeStyle = p.colorCss ?? "rgba(40,40,40,0.8)";
      renderCtx.lineWidth = 1;
      if (p.dash && p.dash.length > 0) {
        renderCtx.setLineDash(p.dash);
      } else {
        renderCtx.setLineDash(EMPTY_DASH);
      }
      renderCtx.beginPath();
      renderCtx.moveTo(lx1, ly);
      renderCtx.lineTo(lx2, ly);
      renderCtx.stroke();
      renderCtx.setLineDash(EMPTY_DASH);
      continue;
    }
    if (p.type === "marker") {
      const mx = resolveTimeToX(p.time, firstTime, spanMs, plotX, plotW);
      const my = resolvePriceToY(p.price, yMin, yMax, plotY, plotH);
      renderCtx.strokeStyle = p.colorCss ?? "rgba(20,20,20,0.9)";
      renderCtx.fillStyle = p.colorCss ?? "rgba(20,20,20,0.9)";
      renderCtx.lineWidth = 1;
      if (p.shape === "arrow_down") {
        renderCtx.beginPath();
        renderCtx.moveTo(mx, my + 5);
        renderCtx.lineTo(mx - 4, my - 3);
        renderCtx.lineTo(mx + 4, my - 3);
        renderCtx.closePath();
        renderCtx.fill();
      } else {
        renderCtx.beginPath();
        renderCtx.moveTo(mx, my - 5);
        renderCtx.lineTo(mx - 4, my + 3);
        renderCtx.lineTo(mx + 4, my + 3);
        renderCtx.closePath();
        renderCtx.fill();
      }
    }
  }
}
var hudSummaryCache = {
  key: "",
  text: ""
};
var DATE_FORMATTER_SHORT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
var DATE_FORMATTER_FULL = new Intl.DateTimeFormat(undefined);
function assertNeverMessage(x) {
  throw new Error(`Unexpected worker message: ${x.type}`);
}
function formatPrice(value) {
  const abs = Math.abs(value);
  const digits = abs < 1 ? 4 : abs < 10 ? 3 : 2;
  return value.toFixed(digits);
}
function formatDateLabel(time, spanMs) {
  return spanMs > 365 * 24 * 3600 * 1000 ? DATE_FORMATTER_FULL.format(new Date(time)) : DATE_FORMATTER_SHORT.format(new Date(time));
}
function formatHudSummary(hud) {
  if (!hud)
    return "";
  const total = hud.totalCount;
  if (total <= 0)
    return "";
  const key = `${hud.totalCount}|${hud.kindMask}|${hud.markerCount}|${hud.hlineCount}|${hud.zoneCount}|${hud.textCount}|${hud.eventCount}`;
  if (hudSummaryCache.key === key)
    return hudSummaryCache.text;
  hudSummaryCache.key = key;
  hudSummaryCache.text = `ANN ${total} M${hud.markerCount} H${hud.hlineCount} Z${hud.zoneCount} T${hud.textCount} E${hud.eventCount}`;
  return hudSummaryCache.text;
}
function normalizeRenderPayload(payload) {
  const schemaVersion = Number.isFinite(payload.schemaVersion) ? Math.max(1, Math.floor(payload.schemaVersion)) : WORKER_RENDER_SCHEMA_VERSION;
  return {
    ...payload,
    schemaVersion,
    hudOverlay: normalizeWorkerHudOverlaySnapshot(payload.hudOverlay)
  };
}
function normalizeSharedRenderPayload(payload) {
  const schemaVersion = Number.isFinite(payload.schemaVersion) ? Math.max(1, Math.floor(payload.schemaVersion)) : WORKER_RENDER_SCHEMA_VERSION;
  return {
    ...payload,
    schemaVersion,
    hudOverlay: normalizeWorkerHudOverlaySnapshot(payload.hudOverlay)
  };
}
function drawHudSummaryTag(renderCtx, plotX, plotY, plotW, hud) {
  const text = formatHudSummary(hud);
  if (!text)
    return;
  drawHudTag(renderCtx, {
    anchorX: plotX + plotW - 6,
    centerY: plotY + 10,
    text,
    backgroundColor: HUD_SUMMARY_BG,
    textColor: "#ffffff",
    font: "10px monospace",
    paddingX: 4,
    height: 14
  });
}
function drawWatermark(renderCtx, width, height) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  renderCtx.save();
  renderCtx.translate(cx, cy);
  renderCtx.rotate(-Math.PI / 6);
  renderCtx.textAlign = "center";
  renderCtx.textBaseline = "middle";
  renderCtx.font = "600 18px sans-serif";
  renderCtx.fillStyle = "rgba(24,24,24,0.14)";
  renderCtx.fillText(WATERMARK_TEXT, 0, 0);
  renderCtx.restore();
}
function renderCrosshair(payload) {
  if (!ctx || !canvas)
    return;
  const width = canvas.width / Math.max(1, currentDpr);
  const height = canvas.height / Math.max(1, currentDpr);
  drawCrosshairOverlay(ctx, {
    plotX: 0,
    plotY: 0,
    plotW: width,
    plotH: height,
    x: payload.clientX,
    clampedY: payload.clientY,
    priceAtY: payload.clientY,
    strokeColor: "rgba(0,0,0,0.45)",
    lineWidth: 1,
    labelText: ""
  });
}
function waitForSharedFrame(targetFrameId) {
  if (!sharedViews)
    return;
  const control = sharedViews.control;
  let current = Atomics.load(control, 0);
  if (current >= targetFrameId)
    return;
  if (typeof Atomics.wait === "function") {
    while (current < targetFrameId) {
      Atomics.wait(control, 0, current, 1);
      current = Atomics.load(control, 0);
    }
    return;
  }
  while (current < targetFrameId) {
    current = Atomics.load(control, 0);
  }
}
function isColumnarData(data) {
  return data.time instanceof Float64Array;
}
function renderFrame(payload) {
  if (!ctx || !canvas)
    return;
  const width = Math.max(1, Math.floor(payload.layout.width));
  const height = Math.max(1, Math.floor(payload.layout.height));
  const dpr = payload.layout.dpr || 1;
  currentDpr = dpr;
  const targetWidth = Math.max(1, Math.floor(width * dpr));
  const targetHeight = Math.max(1, Math.floor(height * dpr));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  const layout = computeRendererLayout(width, height);
  const { plotX, plotY, plotW, plotH } = layout;
  const data = payload.data;
  const isColumnar = isColumnarData(data);
  const dataLen = isColumnar ? data.length : data.length;
  if (dataLen === 0) {
    lastPayload = payload;
    return;
  }
  const start = Math.max(0, Math.floor(payload.viewport.startIndex));
  const startFraction = Math.max(0, payload.viewport.startIndex - start);
  const visibleCount = Math.max(1, Math.floor(payload.viewport.visibleCount));
  const end = Math.min(dataLen, start + visibleCount + 1);
  if (start >= end) {
    lastPayload = payload;
    return;
  }
  const cData = isColumnar ? data : null;
  const aData = !isColumnar ? data : null;
  const geometry = preprocessCandleGeometry({
    count: end - start,
    width: plotW,
    height: plotH,
    visibleCount,
    startFraction,
    rightMarginBars: payload.viewport.rightMarginBars,
    getOpen: isColumnar ? (i) => cData.open[start + i] : (i) => aData[start + i].open,
    getHigh: isColumnar ? (i) => cData.high[start + i] : (i) => aData[start + i].high,
    getLow: isColumnar ? (i) => cData.low[start + i] : (i) => aData[start + i].low,
    getClose: isColumnar ? (i) => cData.close[start + i] : (i) => aData[start + i].close
  });
  const priceRange = computePaddedPriceRange(geometry.min, geometry.max, plotH);
  const yMin = priceRange.min;
  const yMax = priceRange.max;
  drawYAxisGridAndLabels(ctx, {
    plotX,
    plotY,
    plotW,
    plotH,
    yMin,
    yMax,
    targetYTicks: 5,
    font: "12px sans-serif",
    axisColor: AXIS,
    gridColor: GRID,
    formatPrice
  });
  const getTime = (index) => {
    const safeIndex = Math.max(0, Math.min(dataLen - 1, index));
    return isColumnar ? cData.time[safeIndex] : aData[safeIndex].time;
  };
  const firstTime = getTime(start);
  const lastTime = getTime(Math.max(start, end - 1));
  const spanMs = Math.max(1, lastTime - firstTime);
  drawOverlayPrimitives(ctx, overlayPrimitives, firstTime, spanMs, yMin, yMax, plotX, plotY, plotW, plotH);
  drawXAxisTicksAndLabels(ctx, {
    plotX,
    plotY,
    plotW,
    plotH,
    stepX: geometry.stepX,
    visibleCount,
    targetXTicks: 6,
    font: "12px sans-serif",
    axisColor: AXIS,
    getLabelAtLocalIndex: (localIdx) => {
      const totalLen = isColumnar ? cData.length : aData.length;
      const idx = Math.max(0, Math.min(totalLen - 1, start + localIdx));
      return formatDateLabel(isColumnar ? cData.time[idx] : aData[idx].time, spanMs);
    }
  });
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotX, plotY, plotW, plotH);
  ctx.clip();
  for (let i = 0;i < geometry.count; i++) {
    const offset = i * 6;
    const xCenter = plotX + geometry.buffer[offset + 0];
    const yOpen = plotY + geometry.buffer[offset + 1];
    const yClose = plotY + geometry.buffer[offset + 2];
    const yHigh = plotY + geometry.buffer[offset + 3];
    const yLow = plotY + geometry.buffer[offset + 4];
    const isUp = geometry.buffer[offset + 5] === 1;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyH = Math.max(1, bodyBottom - bodyTop);
    ctx.fillStyle = WICK;
    ctx.fillRect(xCenter - geometry.wickWidth * 0.5, yHigh, geometry.wickWidth, Math.max(1, yLow - yHigh));
    ctx.fillStyle = isUp ? UP : DOWN;
    ctx.fillRect(xCenter - geometry.bodyWidth * 0.5, bodyTop, geometry.bodyWidth, bodyH);
  }
  ctx.restore();
  drawHudSummaryTag(ctx, plotX, plotY, plotW, payload.hudOverlay);
  drawWatermark(ctx, width, height);
  lastPayload = payload;
  try {
    self.postMessage?.({ type: "frameDone", chartId: currentChartId });
  } catch {}
}
function renderSharedFrame(payload) {
  if (!ctx || !canvas || !sharedViews)
    return;
  const views = sharedViews;
  waitForSharedFrame(payload.frameId);
  const width = Math.max(1, Math.floor(payload.layout.width));
  const height = Math.max(1, Math.floor(payload.layout.height));
  const dpr = payload.layout.dpr || 1;
  currentDpr = dpr;
  const targetWidth = Math.max(1, Math.floor(width * dpr));
  const targetHeight = Math.max(1, Math.floor(height * dpr));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  const layout = computeRendererLayout(width, height);
  const { plotX, plotY, plotW, plotH } = layout;
  const visibleCount = Math.max(1, Math.floor(payload.viewport.visibleCount));
  const visibleCountActual = Math.max(0, Atomics.load(views.control, 2));
  if (visibleCountActual === 0) {
    lastSharedPayload = payload;
    return;
  }
  const startFloor = Math.max(0, Math.floor(payload.viewport.startIndex));
  const startFraction = Math.max(0, payload.viewport.startIndex - startFloor);
  const geometry = preprocessCandleGeometry({
    count: visibleCountActual,
    width: plotW,
    height: plotH,
    visibleCount,
    startFraction,
    rightMarginBars: payload.viewport.rightMarginBars,
    getOpen: (i) => views.open[i],
    getHigh: (i) => views.high[i],
    getLow: (i) => views.low[i],
    getClose: (i) => views.close[i]
  });
  const priceRange = computePaddedPriceRange(geometry.min, geometry.max, plotH);
  const yMin = priceRange.min;
  const yMax = priceRange.max;
  drawYAxisGridAndLabels(ctx, {
    plotX,
    plotY,
    plotW,
    plotH,
    yMin,
    yMax,
    targetYTicks: 5,
    font: "12px sans-serif",
    axisColor: AXIS,
    gridColor: GRID,
    formatPrice
  });
  const firstTime = views.time[0] ?? 0;
  const lastTime = views.time[Math.max(0, visibleCountActual - 1)] ?? firstTime;
  const spanMs = Math.max(1, lastTime - firstTime);
  drawXAxisTicksAndLabels(ctx, {
    plotX,
    plotY,
    plotW,
    plotH,
    stepX: geometry.stepX,
    visibleCount,
    targetXTicks: 6,
    font: "12px sans-serif",
    axisColor: AXIS,
    getLabelAtLocalIndex: (localIdx) => {
      const source = localIdx - Math.floor(startFraction);
      const idx = Math.max(0, Math.min(visibleCountActual - 1, source));
      return formatDateLabel(views.time[idx] ?? firstTime, spanMs);
    }
  });
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotX, plotY, plotW, plotH);
  ctx.clip();
  for (let i = 0;i < geometry.count; i++) {
    const offset = i * 6;
    const xCenter = plotX + geometry.buffer[offset + 0];
    const yOpen = plotY + geometry.buffer[offset + 1];
    const yClose = plotY + geometry.buffer[offset + 2];
    const yHigh = plotY + geometry.buffer[offset + 3];
    const yLow = plotY + geometry.buffer[offset + 4];
    const isUp = geometry.buffer[offset + 5] === 1;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyH = Math.max(1, bodyBottom - bodyTop);
    ctx.fillStyle = WICK;
    ctx.fillRect(xCenter - geometry.wickWidth * 0.5, yHigh, geometry.wickWidth, Math.max(1, yLow - yHigh));
    ctx.fillStyle = isUp ? UP : DOWN;
    ctx.fillRect(xCenter - geometry.bodyWidth * 0.5, bodyTop, geometry.bodyWidth, bodyH);
  }
  ctx.restore();
  drawHudSummaryTag(ctx, plotX, plotY, plotW, payload.hudOverlay);
  drawWatermark(ctx, width, height);
  lastSharedPayload = payload;
  try {
    self.postMessage?.({ type: "frameDone", chartId: currentChartId });
  } catch {}
}
function scheduleRender(chartId) {
  const state = activateChartState(chartId);
  if (state.rafId !== null) {
    persistActiveChartState();
    return;
  }
  const cb = () => {
    activateChartState(chartId);
    rafId = null;
    if (lastPayload) {
      renderFrame(lastPayload);
    } else if (lastSharedPayload) {
      renderSharedFrame(lastSharedPayload);
    }
    if (pendingOverlay) {
      renderCrosshair(pendingOverlay);
      pendingOverlay = null;
    }
    persistActiveChartState();
  };
  if (typeof requestAnimationFrame === "function") {
    rafId = requestAnimationFrame(cb);
  } else {
    rafId = setTimeout(cb, 16);
  }
  persistActiveChartState();
}
self.onmessage = (event) => {
  const msg = event.data;
  activateChartState(msg.chartId);
  switch (msg.type) {
    case "init": {
      canvas = msg.canvas;
      ctx = canvas.getContext("2d");
      break;
    }
    case "initShared": {
      sharedViews = createSharedViews(msg.descriptor);
      break;
    }
    case "render": {
      lastPayload = normalizeRenderPayload(msg.payload);
      persistActiveChartState();
      scheduleRender(msg.chartId);
      return;
    }
    case "renderShared": {
      lastSharedPayload = normalizeSharedRenderPayload(msg.payload);
      persistActiveChartState();
      scheduleRender(msg.chartId);
      return;
    }
    case "ann_bulk": {
      if (msg.payload.revision >= overlayPrimitiveRevision) {
        overlayPrimitiveRevision = msg.payload.revision;
        overlayPrimitives = msg.payload.primitives;
      }
      break;
    }
    case "ann_clear": {
      overlayPrimitiveRevision = -1;
      overlayPrimitives = [];
      persistActiveChartState();
      scheduleRender(msg.chartId);
      return;
    }
    case "overlay": {
      pendingOverlay = msg.payload;
      persistActiveChartState();
      scheduleRender(msg.chartId);
      return;
    }
    case "clearOverlay": {
      pendingOverlay = null;
      persistActiveChartState();
      scheduleRender(msg.chartId);
      return;
    }
    case "destroy": {
      if (rafId !== null) {
        if (typeof cancelAnimationFrame === "function")
          cancelAnimationFrame(rafId);
        else
          clearTimeout(rafId);
      }
      chartStates.delete(msg.chartId);
      currentChartId = -1;
      return;
    }
    default:
      assertNeverMessage(msg);
  }
  persistActiveChartState();
};

//# debugId=969DE68C80E5F57864756E2164756E21
//# sourceMappingURL=renderWorker.js.map
