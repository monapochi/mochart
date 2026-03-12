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

// src/index.ts
var exports_src = {};
__export(exports_src, {
  wasmRunIndicatorKernel: () => wasmRunIndicatorKernel,
  wasmNearestIndex: () => wasmNearestIndex,
  wasmMinMax: () => wasmMinMax,
  wasmLttbDownsample: () => wasmLttbDownsample,
  toColumnarInputs: () => toColumnarInputs,
  t: () => t,
  registerPhase4Indicators: () => registerPhase4Indicators,
  registerPhase3Indicators: () => registerPhase3Indicators,
  registerPhase2Indicators: () => registerPhase2Indicators,
  registerPhase1Indicators: () => registerPhase1Indicators,
  getWasmKernelAvailability: () => getWasmKernelAvailability,
  createWasmRingBuffer: () => createWasmRingBuffer,
  createWasmColumnarStore: () => createWasmColumnarStore,
  createChartManager: () => createChartManager,
  createChart: () => createChart,
  Volume: () => Volume,
  VolRatio: () => VolRatio,
  VWAP: () => VWAP,
  TradeMarkers: () => TradeMarkers,
  SqueezeAlert: () => SqueezeAlert,
  SMA: () => SMA,
  RenderStyle: () => RenderStyle,
  RSI: () => RSI,
  PivotPoints: () => PivotPoints,
  Phase4Indicators: () => Phase4Indicators,
  Phase3Indicators: () => Phase3Indicators,
  Phase2Indicators: () => Phase2Indicators,
  Phase1Indicators: () => Phase1Indicators,
  PercentB: () => PercentB,
  OBV: () => OBV,
  NoopWasmRingBuffer: () => NoopWasmRingBuffer,
  NoopWasmColumnarStore: () => NoopWasmColumnarStore,
  MFI: () => MFI,
  MACD: () => MACD,
  KaufmanPatterns: () => KaufmanPatterns,
  IndicatorKind: () => IndicatorKind,
  InMemoryIndicatorRegistry: () => InMemoryIndicatorRegistry,
  INDICATOR_PHASES: () => INDICATOR_PHASES,
  INDICATOR_I18N: () => INDICATOR_I18N,
  EMA: () => EMA,
  Divergence: () => Divergence,
  DEFAULT_MARKER_STYLES: () => DEFAULT_MARKER_STYLES,
  CMF: () => CMF,
  BollingerBands: () => BollingerBands,
  BBWidth: () => BBWidth,
  ATR: () => ATR,
  ADX: () => ADX
});

// src/core/store/types.ts
var REQUIRED_INITIAL_STATE = {
  viewport: {
    startIndex: 0,
    visibleCount: 100,
    rightMargin: 50
  },
  layout: {
    width: 800,
    height: 400,
    dpr: 1
  },
  interaction: {
    hover: null,
    drag: null,
    pinch: null
  },
  data: {
    totalBars: 0,
    version: 0
  }
};

// src/core/store/actions.ts
var ActionType = {
  PAN: "PAN",
  ZOOM: "ZOOM",
  SET_VIEWPORT: "SET_VIEWPORT",
  SET_RIGHT_MARGIN: "SET_RIGHT_MARGIN",
  RESIZE: "RESIZE",
  SET_TOTAL_BARS: "SET_TOTAL_BARS",
  START_DRAG: "START_DRAG",
  DRAG: "DRAG",
  END_DRAG: "END_DRAG",
  START_PINCH: "START_PINCH",
  PINCH: "PINCH",
  END_PINCH: "END_PINCH",
  HOVER: "HOVER",
  LEAVE: "LEAVE"
};

// src/core/store/assertNever.ts
function assertNever(x) {
  throw new Error(`Unexpected action: ${x.type}`);
}

// src/core/store/reducer.ts
var MIN_VISIBLE_BARS = 5;
function chartReducer(state, action) {
  switch (action.type) {
    case ActionType.PAN: {
      const { deltaBars } = action;
      const { startIndex } = state.viewport;
      const { totalBars } = state.data;
      let newStartIndex = startIndex + deltaBars;
      const maxIndex = Math.max(0, totalBars - MIN_VISIBLE_BARS);
      if (newStartIndex < 0)
        newStartIndex = 0;
      if (newStartIndex > maxIndex)
        newStartIndex = maxIndex;
      if (newStartIndex === startIndex)
        return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          startIndex: newStartIndex
        }
      };
    }
    case ActionType.ZOOM: {
      const { factor, centerX } = action;
      const { visibleCount, startIndex } = state.viewport;
      const { totalBars } = state.data;
      let newVisibleCount = visibleCount * factor;
      if (newVisibleCount < MIN_VISIBLE_BARS)
        newVisibleCount = MIN_VISIBLE_BARS;
      if (newVisibleCount > totalBars)
        newVisibleCount = totalBars;
      const centerBarIndex = startIndex + visibleCount * centerX;
      let newStartIndex = centerBarIndex - newVisibleCount * centerX;
      if (newStartIndex < 0)
        newStartIndex = 0;
      const maxIndex = Math.max(0, totalBars - MIN_VISIBLE_BARS);
      if (newStartIndex > maxIndex)
        newStartIndex = maxIndex;
      if (newStartIndex === startIndex && newVisibleCount === visibleCount)
        return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          startIndex: newStartIndex,
          visibleCount: newVisibleCount
        }
      };
    }
    case ActionType.SET_VIEWPORT: {
      if (state.viewport.startIndex === action.startIndex && state.viewport.visibleCount === action.visibleCount)
        return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          startIndex: action.startIndex,
          visibleCount: action.visibleCount
        }
      };
    }
    case ActionType.SET_RIGHT_MARGIN: {
      if (state.viewport.rightMargin === action.rightMargin)
        return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          rightMargin: action.rightMargin
        }
      };
    }
    case ActionType.RESIZE: {
      if (state.layout.width === action.width && state.layout.height === action.height && state.layout.dpr === action.dpr)
        return state;
      return {
        ...state,
        layout: {
          width: action.width,
          height: action.height,
          dpr: action.dpr
        }
      };
    }
    case ActionType.SET_TOTAL_BARS: {
      return {
        ...state,
        data: {
          ...state.data,
          totalBars: action.count,
          version: state.data.version + 1
        }
      };
    }
    case ActionType.HOVER: {
      const prev = state.interaction.hover;
      if (prev && prev.x === action.x && prev.y === action.y)
        return state;
      return {
        ...state,
        interaction: {
          ...state.interaction,
          hover: { x: action.x, y: action.y }
        }
      };
    }
    case ActionType.LEAVE: {
      if (state.interaction.hover === null)
        return state;
      return {
        ...state,
        interaction: {
          ...state.interaction,
          hover: null
        }
      };
    }
    case ActionType.START_DRAG:
      return {
        ...state,
        interaction: {
          ...state.interaction,
          drag: { startX: action.x, startStartIndex: state.viewport.startIndex }
        }
      };
    case ActionType.DRAG: {
      if (!state.interaction.drag)
        return state;
      const { drag } = state.interaction;
      const deltaPixels = action.x - drag.startX;
      const { width } = state.layout;
      const { visibleCount } = state.viewport;
      const barsPerPixel = visibleCount / width;
      const deltaBars = -deltaPixels * barsPerPixel;
      let newStartIndex = drag.startStartIndex + deltaBars;
      const { totalBars } = state.data;
      if (newStartIndex < 0)
        newStartIndex = 0;
      const maxIndex = Math.max(0, totalBars - MIN_VISIBLE_BARS);
      if (newStartIndex > maxIndex)
        newStartIndex = maxIndex;
      if (newStartIndex === state.viewport.startIndex)
        return state;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          startIndex: newStartIndex
        }
      };
    }
    case ActionType.END_DRAG:
      return {
        ...state,
        interaction: {
          ...state.interaction,
          drag: null
        }
      };
    case ActionType.START_PINCH:
      return {
        ...state,
        interaction: {
          ...state.interaction,
          pinch: {
            startScale: action.scale,
            centerX: action.centerX,
            startVisibleCount: state.viewport.visibleCount
          }
        }
      };
    case ActionType.PINCH: {
      if (!state.interaction.pinch)
        return state;
      const { pinch } = state.interaction;
      const { totalBars } = state.data;
      const scaleDelta = action.scale / pinch.startScale;
      let newVisibleCount = pinch.startVisibleCount / scaleDelta;
      if (newVisibleCount < MIN_VISIBLE_BARS)
        newVisibleCount = MIN_VISIBLE_BARS;
      if (newVisibleCount > totalBars)
        newVisibleCount = totalBars;
      const relativeCenter = action.centerX / state.layout.width;
      const newStartIndex = state.viewport.startIndex + state.viewport.visibleCount * relativeCenter - newVisibleCount * relativeCenter;
      const maxIndex = Math.max(0, totalBars - MIN_VISIBLE_BARS);
      let clampedStartIndex = newStartIndex;
      if (clampedStartIndex < 0)
        clampedStartIndex = 0;
      if (clampedStartIndex > maxIndex)
        clampedStartIndex = maxIndex;
      return {
        ...state,
        viewport: {
          ...state.viewport,
          visibleCount: newVisibleCount,
          startIndex: clampedStartIndex
        }
      };
    }
    case ActionType.END_PINCH:
      return {
        ...state,
        interaction: {
          ...state.interaction,
          pinch: null
        }
      };
    default:
      return assertNever(action);
  }
}

// src/core/store/store.ts
class ChartStore {
  state;
  listeners = new Set;
  middlewares = new Set;
  constructor(initialState = {}) {
    this.state = {
      ...REQUIRED_INITIAL_STATE,
      ...initialState,
      viewport: {
        ...REQUIRED_INITIAL_STATE.viewport,
        ...initialState.viewport || {}
      },
      layout: {
        ...REQUIRED_INITIAL_STATE.layout,
        ...initialState.layout || {}
      }
    };
  }
  getState() {
    return this.state;
  }
  dispatch(action) {
    const previousState = this.state;
    this.state = chartReducer(previousState, action);
    const changed = this.state !== previousState;
    if (changed) {
      this.notify();
    }
    if (this.middlewares.size > 0) {
      const payload = {
        action,
        prevState: previousState,
        nextState: this.state,
        changed
      };
      for (const middleware of this.middlewares) {
        middleware(payload);
      }
    }
    return changed;
  }
  use(middleware) {
    this.middlewares.add(middleware);
    return () => {
      this.middlewares.delete(middleware);
    };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  select(selector) {
    return selector(this.state);
  }
  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }
  reset() {
    this.state = REQUIRED_INITIAL_STATE;
    this.notify();
  }
}

// src/core/actionQueue.ts
var KEEP_LAST_TYPES = new Set([
  ActionType.ZOOM,
  ActionType.SET_VIEWPORT,
  ActionType.SET_RIGHT_MARGIN,
  ActionType.RESIZE,
  ActionType.SET_TOTAL_BARS,
  ActionType.DRAG,
  ActionType.PINCH,
  ActionType.HOVER
]);
function coalesce(actions) {
  if (actions.length <= 1)
    return actions;
  const result = [];
  let panIndex = null;
  const latestIndices = new Map;
  for (const action of actions) {
    if (action.type === ActionType.PAN) {
      if (panIndex === null) {
        panIndex = result.length;
        result.push(action);
      } else {
        const current = result[panIndex];
        if (current.type === ActionType.PAN) {
          result[panIndex] = { type: ActionType.PAN, deltaBars: current.deltaBars + action.deltaBars };
        }
      }
      continue;
    }
    if (KEEP_LAST_TYPES.has(action.type)) {
      const existing = latestIndices.get(action.type);
      if (existing === undefined) {
        latestIndices.set(action.type, result.length);
        result.push(action);
      } else {
        result[existing] = action;
      }
      continue;
    }
    result.push(action);
  }
  return result;
}

// src/core/scheduler.ts
class RenderScheduler {
  applyActions;
  render;
  perfTracker;
  pendingActions = [];
  microtaskScheduled = false;
  rafId = null;
  paused = false;
  requestFrame(cb) {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(cb);
    }
    return setTimeout(cb, 16);
  }
  cancelFrame(id) {
    if (typeof cancelAnimationFrame === "function" && typeof id === "number") {
      cancelAnimationFrame(id);
      return;
    }
    clearTimeout(id);
  }
  constructor(applyActions, render, perfTracker) {
    this.applyActions = applyActions;
    this.render = render;
    this.perfTracker = perfTracker;
  }
  enqueue(action) {
    this.pendingActions.push(action);
    this.scheduleMicrotask();
  }
  enqueueBatch(actions) {
    if (actions.length === 0)
      return;
    const len = actions.length;
    for (let i = 0;i < len; i++) {
      this.pendingActions.push(actions[i]);
    }
    this.scheduleMicrotask();
  }
  flushSync() {
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
    const changed = this.flushActions();
    if (changed) {
      this.render();
    }
  }
  pause() {
    this.paused = true;
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }
  resume() {
    this.paused = false;
    this.scheduleRender();
  }
  destroy() {
    this.pendingActions = [];
    this.microtaskScheduled = false;
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }
  scheduleMicrotask() {
    if (this.microtaskScheduled)
      return;
    this.microtaskScheduled = true;
    queueMicrotask(() => {
      this.microtaskScheduled = false;
      const changed = this.flushActions();
      if (changed) {
        this.scheduleRender();
      }
    });
  }
  flushActions() {
    if (this.pendingActions.length === 0)
      return false;
    const merged = coalesce(this.pendingActions);
    this.pendingActions = [];
    if (!this.perfTracker) {
      return this.applyActions(merged);
    }
    return this.perfTracker.measure("reduce", () => this.applyActions(merged));
  }
  scheduleRender() {
    if (this.paused || this.rafId !== null)
      return;
    this.rafId = this.requestFrame(() => {
      this.rafId = null;
      if (!this.paused) {
        if (!this.perfTracker) {
          this.render();
          return;
        }
        this.perfTracker.measure("render", () => this.render());
      }
    });
  }
}

// src/core/perf.ts
function createZeroStats() {
  return { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
}

class PerformanceTracker {
  enabled = true;
  sequence = 0;
  stats = {
    reduce: createZeroStats(),
    render: createZeroStats(),
    draw: createZeroStats(),
    upload: createZeroStats()
  };
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  isEnabled() {
    return this.enabled;
  }
  reset() {
    this.stats = {
      reduce: createZeroStats(),
      render: createZeroStats(),
      draw: createZeroStats(),
      upload: createZeroStats()
    };
  }
  measure(metric, fn) {
    if (!this.enabled) {
      return fn();
    }
    const perf = typeof performance !== "undefined" ? performance : null;
    const startMark = perf ? `mochart:${metric}:start:${this.sequence}` : "";
    const endMark = perf ? `mochart:${metric}:end:${this.sequence}` : "";
    const measureName = perf ? `mochart:${metric}:measure:${this.sequence}` : "";
    this.sequence += 1;
    if (!perf) {
      const start = Date.now();
      const result = fn();
      this.record(metric, Date.now() - start);
      return result;
    }
    perf.mark(startMark);
    try {
      return fn();
    } finally {
      perf.mark(endMark);
      perf.measure(measureName, startMark, endMark);
      const entries = perf.getEntriesByName(measureName, "measure");
      const duration = entries.length > 0 ? entries[entries.length - 1].duration : 0;
      this.record(metric, duration);
      perf.clearMeasures(measureName);
      perf.clearMarks(startMark);
      perf.clearMarks(endMark);
    }
  }
  getSnapshot() {
    return {
      reduce: this.buildReadonlyStats(this.stats.reduce),
      render: this.buildReadonlyStats(this.stats.render),
      draw: this.buildReadonlyStats(this.stats.draw),
      upload: this.buildReadonlyStats(this.stats.upload)
    };
  }
  buildReadonlyStats(stats) {
    const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;
    return {
      count: stats.count,
      totalMs: stats.totalMs,
      avgMs,
      maxMs: stats.maxMs,
      lastMs: stats.lastMs
    };
  }
  record(metric, durationMs) {
    if (!Number.isFinite(durationMs))
      return;
    const target = this.stats[metric];
    target.count += 1;
    target.totalMs += durationMs;
    target.lastMs = durationMs;
    if (durationMs > target.maxMs) {
      target.maxMs = durationMs;
    }
  }
}

// src/core/store/indicatorComputeStore.ts
var GPU_NULL_SENTINEL_THRESHOLD = -100000000000000000000000000000;

class IndicatorComputeStore {
  indicatorRuntimeCache = new Map;
  getStats() {
    return {
      cacheEntries: this.indicatorRuntimeCache.size
    };
  }
  reset() {
    this.indicatorRuntimeCache.clear();
  }
  compute(instance, def, data) {
    const prepared = this.prepareCompute(instance, def, data);
    const cached = this.tryReadCache(prepared);
    if (cached)
      return cached;
    const incremental = this.tryIncremental(prepared);
    if (incremental)
      return incremental;
    return this.computeAndCache(prepared);
  }
  async computeAsync(instance, def, data) {
    const prepared = this.prepareCompute(instance, def, data);
    const cached = this.tryReadCache(prepared);
    if (cached)
      return cached;
    const incremental = this.tryIncremental(prepared);
    if (incremental)
      return incremental;
    return this.computeAndCache(prepared);
  }
  prepareCompute(instance, def, data) {
    const params = instance.params ?? {};
    const paramsKey = JSON.stringify(params);
    const dataLength = data.length;
    let lastTime = -1;
    if (dataLength > 0) {
      if (data instanceof Array) {
        lastTime = data[dataLength - 1].time;
      } else {
        lastTime = data.time[dataLength - 1];
      }
    }
    const cache = this.indicatorRuntimeCache.get(instance.instanceId);
    return {
      instance,
      def,
      data,
      params,
      paramsKey,
      dataLength,
      lastTime,
      cache
    };
  }
  tryReadCache(prepared) {
    const { def, paramsKey, dataLength, lastTime, cache } = prepared;
    if (cache && cache.indicatorId === def.id && cache.paramsKey === paramsKey && cache.dataLength === dataLength && cache.lastTime === lastTime) {
      return { ok: true, value: cache.values };
    }
    return null;
  }
  tryIncremental(prepared) {
    const { instance, def, data, params, paramsKey, dataLength, lastTime, cache } = prepared;
    if (def.update && cache && cache.indicatorId === def.id && cache.paramsKey === paramsKey && cache.dataLength + 1 === dataLength && dataLength > 0) {
      const nextBar = data instanceof Array ? data[dataLength - 1] : data.getAt(dataLength - 1);
      if (!nextBar)
        return null;
      const incremental = def.update(cache.state, nextBar, params);
      if (incremental.ok) {
        const nextValues = {};
        for (const output of def.outputs) {
          const prevSeries = cache.values[output.name] ?? [];
          const nextValue = incremental.value.values[output.name] ?? null;
          nextValues[output.name] = [...prevSeries, nextValue];
        }
        this.indicatorRuntimeCache.set(instance.instanceId, {
          indicatorId: def.id,
          paramsKey,
          dataLength,
          lastTime,
          values: nextValues,
          state: incremental.value.state
        });
        return { ok: true, value: nextValues };
      }
    }
    return null;
  }
  computeAndCache(prepared) {
    const { instance, def, data, params, paramsKey, dataLength, lastTime } = prepared;
    const full = def.calculate(data, params);
    if (!full.ok)
      return full;
    this.indicatorRuntimeCache.set(instance.instanceId, {
      indicatorId: def.id,
      paramsKey,
      dataLength,
      lastTime,
      values: full.value,
      state: this.deriveIncrementalState(def, full.value, params, data)
    });
    return full;
  }
  clampNumberParam(raw, fallback, min, max) {
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value))
      return fallback;
    return Math.max(min, Math.min(max, value));
  }
  extractCloseValues(data) {
    if ("close" in data) {
      return data.close;
    }
    const out = new Float32Array(data.length);
    for (let i = 0;i < data.length; i++) {
      out[i] = data[i].close;
    }
    return out;
  }
  floatSeriesToIndicatorValues(source) {
    const out = new Array(source.length);
    for (let i = 0;i < source.length; i++) {
      const v = source[i];
      out[i] = Number.isFinite(v) && v > GPU_NULL_SENTINEL_THRESHOLD ? v : null;
    }
    return out;
  }
  deriveIncrementalState(def, values, params, data) {
    if (def.id === "sma") {
      const period = Number(params.period ?? 20);
      const safePeriod = Math.max(2, Number.isFinite(period) ? period : 20);
      const start = Math.max(0, data.length - safePeriod);
      const windowLength = data.length - start;
      const window2 = new Array(windowLength);
      let sum = 0;
      if (data instanceof Array) {
        for (let i = 0;i < windowLength; i++) {
          const close = data[start + i].close;
          window2[i] = close;
          sum += close;
        }
      } else {
        const closeArr = data.close;
        for (let i = 0;i < windowLength; i++) {
          const close = closeArr[start + i];
          window2[i] = close;
          sum += close;
        }
      }
      return { window: window2, sum };
    }
    if (def.id === "ema") {
      const emaSeries = values.ema;
      const fallback = data.length > 0 ? data instanceof Array ? data[data.length - 1].close : data.close[data.length - 1] : 0;
      let lastNonNull = null;
      if (emaSeries) {
        for (let i = emaSeries.length - 1;i >= 0; i--) {
          const value = emaSeries[i];
          if (value != null) {
            lastNonNull = value;
            break;
          }
        }
      }
      return {
        last: typeof lastNonNull === "number" ? lastNonNull : fallback,
        index: Math.max(0, data.length - 1)
      };
    }
    return null;
  }
}

// src/core/indicators.ts
var GPU_EXCLUDED_INDICATOR_IDS = new Set([
  "ema",
  "rsi",
  "macd",
  "atr",
  "adx",
  "vwap",
  "vol_ratio"
]);

class InMemoryIndicatorRegistry {
  defs = new Map;
  register(definition) {
    this.defs.set(definition.id, definition);
  }
  get(id) {
    return this.defs.get(id);
  }
  listAll() {
    return Array.from(this.defs.values());
  }
  listByCategory(category) {
    return this.listAll().filter((def) => def.category === category);
  }
  listGPUEnabled() {
    return this.listAll().filter((def) => !GPU_EXCLUDED_INDICATOR_IDS.has(def.id) && Boolean(def.calculateGPU || def.wgslSource));
  }
  resolveDependencies(ids) {
    const resolved = [];
    const visiting = new Set;
    const visited = new Set;
    const visit = (id) => {
      if (visited.has(id))
        return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected for indicator: ${id}`);
      }
      const def = this.get(id);
      if (!def) {
        throw new Error(`Indicator not found: ${id}`);
      }
      visiting.add(id);
      for (const dep of def.dependencies ?? []) {
        visit(dep);
      }
      visiting.delete(id);
      visited.add(id);
      resolved.push(def);
    };
    ids.forEach(visit);
    return resolved;
  }
}

// src/core/indicatorTypes.ts
var SCHEMA_VERSION = 2;

// src/indicators/phase1.ts
var ok = (value) => ({ ok: true, value });
var fail = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var SMA = {
  schemaVersion: SCHEMA_VERSION,
  id: "sma",
  name: "SMA",
  nameKey: "indicator.sma.name",
  category: "trend",
  pane: "main",
  outputs: [{ name: "sma", color: "#4ECDC4", style: "line", lineWidth: 1, zLayer: 30 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const sma = [];
      let sum = 0;
      for (let i = 0;i < data.length; i++) {
        sum += data[i].close;
        if (i >= period)
          sum -= data[i - period].close;
        if (i < period - 1) {
          sma.push(null);
        } else {
          sma.push(sum / period);
        }
      }
      return ok({ sma });
    } catch (e) {
      return fail(String(e));
    }
  },
  update(prevState, newBar, { period }) {
    try {
      if (!Number.isFinite(period) || period < 2) {
        return {
          ok: false,
          error: { code: "INVALID_PARAMS", message: "SMA period must be >= 2" }
        };
      }
      const state = prevState;
      if (!state || !Array.isArray(state.window) || !Number.isFinite(state.sum)) {
        return {
          ok: false,
          error: { code: "COMPUTATION_ERROR", message: "SMA incremental state missing" }
        };
      }
      const nextWindow = state.window.slice();
      let nextSum = state.sum;
      nextWindow.push(newBar.close);
      nextSum += newBar.close;
      if (nextWindow.length > period) {
        const removed = nextWindow.shift();
        if (removed != null)
          nextSum -= removed;
      }
      const value = nextWindow.length < period ? null : nextSum / period;
      return {
        ok: true,
        value: {
          state: { window: nextWindow, sum: nextSum },
          values: { sma: value }
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: "COMPUTATION_ERROR", message: String(e) }
      };
    }
  }
};
var EMA = {
  schemaVersion: SCHEMA_VERSION,
  id: "ema",
  name: "EMA",
  nameKey: "indicator.ema.name",
  category: "trend",
  pane: "main",
  outputs: [{ name: "ema", color: "#FFB703", style: "line", lineWidth: 1, zLayer: 30 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const ema = [];
      const k = 2 / (period + 1);
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          ema.push(data[i].close);
          continue;
        }
        const prev = ema[i - 1] ?? data[i - 1].close;
        ema.push(data[i].close * k + prev * (1 - k));
      }
      for (let i = 0;i < period - 1; i++) {
        ema[i] = null;
      }
      return ok({ ema });
    } catch (e) {
      return fail(String(e));
    }
  },
  update(prevState, newBar, { period }) {
    try {
      if (!Number.isFinite(period) || period < 2) {
        return {
          ok: false,
          error: { code: "INVALID_PARAMS", message: "EMA period must be >= 2" }
        };
      }
      const state = prevState;
      if (!state || !Number.isFinite(state.last) || !Number.isFinite(state.index)) {
        return {
          ok: false,
          error: { code: "COMPUTATION_ERROR", message: "EMA incremental state missing" }
        };
      }
      const k = 2 / (period + 1);
      const nextIndex = state.index + 1;
      const nextEma = newBar.close * k + state.last * (1 - k);
      const value = nextIndex < period - 1 ? null : nextEma;
      return {
        ok: true,
        value: {
          state: { last: nextEma, index: nextIndex },
          values: { ema: value }
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: "COMPUTATION_ERROR", message: String(e) }
      };
    }
  }
};
var BollingerBands = {
  schemaVersion: SCHEMA_VERSION,
  id: "bb",
  nameKey: "indicator.bb.name",
  name: "Bollinger Bands",
  category: "volatility",
  pane: "main",
  outputs: [
    { name: "upper", color: "#2196F3", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "middle", color: "#9E9E9E", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "lower", color: "#2196F3", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "fill", color: "rgba(33,150,243,0.1)", style: "band", fillTo: "lower", zLayer: 10 }
  ],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
    stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev }) {
    try {
      const upper = new Array(data.length);
      const middle = new Array(data.length);
      const lower = new Array(data.length);
      if (period <= 0) {
        for (let i = 0;i < data.length; i++) {
          upper[i] = middle[i] = lower[i] = null;
        }
        return ok({ upper, middle, lower, fill: upper });
      }
      let sum = 0;
      let sumSq = 0;
      for (let i = 0;i < Math.min(period - 1, data.length); i++) {
        const v = data[i].close;
        sum += v;
        sumSq += v * v;
        upper[i] = middle[i] = lower[i] = null;
      }
      const window2 = new Array(period);
      let wIndex = 0;
      for (let i = 0;i < period - 1 && i < data.length; i++) {
        window2[i] = data[i].close;
      }
      for (let i = period - 1;i < data.length; i++) {
        const v = data[i].close;
        sum += v;
        sumSq += v * v;
        const evicted = window2[wIndex];
        window2[wIndex] = v;
        wIndex = (wIndex + 1) % period;
        if (i >= period) {
          if (Number.isFinite(evicted)) {
            sum -= evicted;
            sumSq -= evicted * evicted;
          }
        }
        const sma = sum / period;
        const variance = Math.max(0, sumSq / period - sma * sma);
        const std = Math.sqrt(variance);
        middle[i] = sma;
        upper[i] = sma + stdDev * std;
        lower[i] = sma - stdDev * std;
      }
      return ok({ upper, middle, lower, fill: upper });
    } catch (e) {
      return fail(String(e));
    }
  }
};
var Volume = {
  schemaVersion: SCHEMA_VERSION,
  id: "volume",
  nameKey: "indicator.volume.name",
  name: "Volume",
  category: "volume",
  pane: "sub1",
  outputs: [
    { name: "volume", color: "#90CAF9", style: "bar", opacity: 0.8, zLayer: 20 },
    { name: "volumeMA", color: "#1565C0", style: "line", lineWidth: 1, zLayer: 30 }
  ],
  params: {
    maPeriod: { type: "number", default: 20, label: "MA Period", min: 5, max: 50 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ maPeriod }) => maPeriod - 1,
  calculate(data, { maPeriod }) {
    try {
      const volume = new Array(data.length);
      const volumeMA = new Array(data.length);
      if (maPeriod <= 0) {
        for (let i = 0;i < data.length; i++) {
          volume[i] = data[i].volume;
          volumeMA[i] = null;
        }
        return ok({ volume, volumeMA });
      }
      let sum = 0;
      for (let i = 0;i < Math.min(maPeriod - 1, data.length); i++) {
        const v = data[i].volume;
        volume[i] = v;
        sum += v;
        volumeMA[i] = null;
      }
      const window2 = new Array(maPeriod);
      let wIndex = 0;
      for (let i = 0;i < maPeriod - 1 && i < data.length; i++)
        window2[i] = data[i].volume;
      for (let i = maPeriod - 1;i < data.length; i++) {
        const v = data[i].volume;
        volume[i] = v;
        sum += v;
        const evicted = window2[wIndex];
        window2[wIndex] = v;
        wIndex = (wIndex + 1) % maPeriod;
        if (i >= maPeriod) {
          if (Number.isFinite(evicted))
            sum -= evicted;
        }
        volumeMA[i] = sum / maPeriod;
      }
      return ok({ volume, volumeMA });
    } catch (e) {
      return fail(String(e));
    }
  }
};
var PivotPoints = {
  schemaVersion: SCHEMA_VERSION,
  nameKey: "indicator.pivot_points.name",
  id: "pivot_points",
  name: "Pivot Points",
  category: "trend",
  pane: "main",
  outputs: [
    { name: "pivot", color: "#607D8B", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "r1", color: "#8BC34A", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "s1", color: "#F44336", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "r2", color: "#4CAF50", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "s2", color: "#E57373", style: "line", lineWidth: 1, zLayer: 30 }
  ],
  params: {},
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: () => 1,
  calculate(data) {
    try {
      const pivot = [];
      const r1 = [];
      const s1 = [];
      const r2 = [];
      const s2 = [];
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          pivot.push(null);
          r1.push(null);
          s1.push(null);
          r2.push(null);
          s2.push(null);
          continue;
        }
        const prev = data[i - 1];
        const p = (prev.high + prev.low + prev.close) / 3;
        const r1v = 2 * p - prev.low;
        const s1v = 2 * p - prev.high;
        const r2v = p + (prev.high - prev.low);
        const s2v = p - (prev.high - prev.low);
        pivot.push(p);
        r1.push(r1v);
        s1.push(s1v);
        r2.push(r2v);
        s2.push(s2v);
      }
      return ok({ pivot, r1, s1, r2, s2 });
    } catch (e) {
      return fail(String(e));
    }
  }
};
var Phase1Indicators = [Volume, SMA, EMA, BollingerBands, PivotPoints];
var registerPhase1Indicators = (registry) => {
  Phase1Indicators.forEach((indicator) => registry.register(indicator));
};

// src/indicators/phase2.ts
var ok2 = (value) => ({ ok: true, value });
var fail2 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var RSI = {
  schemaVersion: SCHEMA_VERSION,
  id: "rsi",
  name: "RSI",
  nameKey: "indicator.rsi.name",
  category: "momentum",
  pane: "sub1",
  outputs: [{ name: "rsi", color: "#9C27B0", style: "line", lineWidth: 1.5, zLayer: 30 }],
  params: {
    period: { type: "number", default: 14, label: "Period", min: 2, max: 50 }
  },
  yRange: { min: 0, max: 100 },
  horizontalLines: [
    { value: 70, color: "#F44336", dashed: true },
    { value: 30, color: "#4CAF50", dashed: true },
    { value: 50, color: "#9E9E9E", dashed: true }
  ],
  complexity: { time: "O(n)", space: "O(1)" },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const rsi = [];
      let avgGain = 0;
      let avgLoss = 0;
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          rsi.push(null);
          continue;
        }
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i < period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          rsi.push(null);
        } else if (i === period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        } else {
          avgGain = (avgGain * (period - 1) + gain) / period;
          avgLoss = (avgLoss * (period - 1) + loss) / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        }
      }
      return ok2({ rsi });
    } catch (e) {
      return fail2(String(e));
    }
  }
};
var ATR = {
  schemaVersion: SCHEMA_VERSION,
  id: "atr",
  name: "ATR",
  nameKey: "indicator.atr.name",
  category: "volatility",
  pane: "sub1",
  outputs: [{ name: "atr", color: "#795548", style: "line", lineWidth: 1.5, zLayer: 30 }],
  params: {
    period: { type: "number", default: 14, label: "Period", min: 5, max: 50 }
  },
  complexity: { time: "O(n)", space: "O(1)" },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const atr = [];
      let atrSum = 0;
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          atr.push(null);
          continue;
        }
        const tr = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close));
        if (i < period) {
          atrSum += tr;
          atr.push(null);
        } else if (i === period) {
          atrSum += tr;
          atr.push(atrSum / period);
        } else {
          const prevATR = atr[i - 1] ?? 0;
          atr.push((prevATR * (period - 1) + tr) / period);
        }
      }
      return ok2({ atr });
    } catch (e) {
      return fail2(String(e));
    }
  }
};
var MACD = {
  schemaVersion: SCHEMA_VERSION,
  id: "macd",
  nameKey: "indicator.macd.name",
  name: "MACD",
  category: "momentum",
  pane: "sub2",
  dependencies: ["ema"],
  outputs: [
    { name: "macd", color: "#2196F3", style: "line", lineWidth: 1.5, zLayer: 30 },
    { name: "signal", color: "#FF9800", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "histogram", color: "#4CAF50", style: "histogram", opacity: 0.7, zLayer: 20 }
  ],
  params: {
    fastPeriod: { type: "number", default: 12, label: "Fast Period", min: 2, max: 50 },
    slowPeriod: { type: "number", default: 26, label: "Slow Period", min: 5, max: 100 },
    signalPeriod: { type: "number", default: 9, label: "Signal Period", min: 2, max: 50 }
  },
  horizontalLines: [{ value: 0, color: "#9E9E9E", dashed: false }],
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ slowPeriod, signalPeriod }) => slowPeriod + signalPeriod - 1,
  calculate(data, { fastPeriod, slowPeriod, signalPeriod }) {
    try {
      const ema = (values, period) => {
        const result = [];
        const k = 2 / (period + 1);
        for (let i = 0;i < values.length; i++) {
          if (i === 0)
            result.push(values[i]);
          else
            result.push(values[i] * k + result[i - 1] * (1 - k));
        }
        return result;
      };
      const closes = data.map((d) => d.close);
      const fastEma = ema(closes, fastPeriod);
      const slowEma = ema(closes, slowPeriod);
      const macdLine = fastEma.map((f, i) => f - slowEma[i]);
      const signalLine = ema(macdLine, signalPeriod);
      const histogram = macdLine.map((m, i) => m - signalLine[i]);
      const warmup = slowPeriod + signalPeriod - 1;
      return ok2({
        macd: macdLine.map((v, i) => i < warmup ? null : v),
        signal: signalLine.map((v, i) => i < warmup ? null : v),
        histogram: histogram.map((v, i) => i < warmup ? null : v)
      });
    } catch (e) {
      return fail2(String(e));
    }
  }
};
var ADX = {
  schemaVersion: SCHEMA_VERSION,
  id: "adx",
  nameKey: "indicator.adx.name",
  name: "ADX",
  category: "trend",
  pane: "sub1",
  outputs: [
    { name: "adx", color: "#FF5722", style: "line", lineWidth: 2, zLayer: 30 },
    { name: "plusDI", color: "#4CAF50", style: "line", lineWidth: 1, zLayer: 30 },
    { name: "minusDI", color: "#F44336", style: "line", lineWidth: 1, zLayer: 30 }
  ],
  params: {
    period: { type: "number", default: 14, label: "Period", min: 5, max: 50 }
  },
  yRange: { min: 0, max: 100 },
  horizontalLines: [
    { value: 25, color: "#9E9E9E", dashed: true },
    { value: 50, color: "#FF9800", dashed: true }
  ],
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period * 2 - 1,
  calculate(data, { period }) {
    try {
      const adx = [];
      const plusDI = [];
      const minusDI = [];
      const tr = [];
      const plusDM = [];
      const minusDM = [];
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          tr.push(data[i].high - data[i].low);
          plusDM.push(0);
          minusDM.push(0);
          adx.push(null);
          plusDI.push(null);
          minusDI.push(null);
          continue;
        }
        const high = data[i].high;
        const low = data[i].low;
        const prevHigh = data[i - 1].high;
        const prevLow = data[i - 1].low;
        const prevClose = data[i - 1].close;
        const trValue = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        tr.push(trValue);
        const upMove = high - prevHigh;
        const downMove = prevLow - low;
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        if (i < period) {
          adx.push(null);
          plusDI.push(null);
          minusDI.push(null);
          continue;
        }
        let smoothTR = 0;
        let smoothPlusDM = 0;
        let smoothMinusDM = 0;
        if (i === period) {
          for (let j = 1;j <= period; j++) {
            smoothTR += tr[j];
            smoothPlusDM += plusDM[j];
            smoothMinusDM += minusDM[j];
          }
        } else {
          const prevSmoothTR = tr.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothTR = prevSmoothTR - prevSmoothTR / period + tr[i];
          const prevSmoothPlusDM = plusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothPlusDM = prevSmoothPlusDM - prevSmoothPlusDM / period + plusDM[i];
          const prevSmoothMinusDM = minusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothMinusDM = prevSmoothMinusDM - prevSmoothMinusDM / period + minusDM[i];
        }
        const pdi = smoothTR > 0 ? 100 * smoothPlusDM / smoothTR : 0;
        const mdi = smoothTR > 0 ? 100 * smoothMinusDM / smoothTR : 0;
        plusDI.push(pdi);
        minusDI.push(mdi);
        const diSum = pdi + mdi;
        const dx = diSum > 0 ? 100 * Math.abs(pdi - mdi) / diSum : 0;
        if (i < period * 2 - 1) {
          adx.push(null);
        } else if (i === period * 2 - 1) {
          let dxSum = 0;
          for (let j = period;j < period * 2; j++) {
            const pdiJ = plusDI[j] ?? 0;
            const mdiJ = minusDI[j] ?? 0;
            const sumJ = pdiJ + mdiJ;
            dxSum += sumJ > 0 ? 100 * Math.abs(pdiJ - mdiJ) / sumJ : 0;
          }
          adx.push(dxSum / period);
        } else {
          const prevADX = adx[i - 1] ?? 0;
          adx.push((prevADX * (period - 1) + dx) / period);
        }
      }
      return ok2({ adx, plusDI, minusDI });
    } catch (e) {
      return fail2(String(e));
    }
  }
};
var TradeMarkers = {
  schemaVersion: SCHEMA_VERSION,
  nameKey: "indicator.trade_markers.name",
  id: "trade_markers",
  name: "Trade Markers",
  category: "custom",
  pane: "main",
  outputs: [{ name: "markers", color: "#FFC107", style: "marker", zLayer: 40 }],
  params: {},
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: () => 0,
  calculate() {
    return ok2({ markers: [] });
  }
};
var Phase2Indicators = [RSI, ADX, ATR, MACD, TradeMarkers];
var registerPhase2Indicators = (registry) => {
  Phase2Indicators.forEach((indicator) => registry.register(indicator));
};

// src/indicators/phase3.ts
var ok3 = (value) => ({ ok: true, value });
var fail3 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var VWAP = {
  schemaVersion: SCHEMA_VERSION,
  id: "vwap",
  name: "VWAP",
  nameKey: "indicator.vwap.name",
  category: "volume",
  pane: "main",
  outputs: [{ name: "vwap", color: "#6D4C41", style: "line", lineWidth: 1.5, zLayer: 30 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const vwap = [];
      let pvSum = 0;
      let vSum = 0;
      for (let i = 0;i < data.length; i++) {
        const typical = (data[i].high + data[i].low + data[i].close) / 3;
        pvSum += typical * data[i].volume;
        vSum += data[i].volume;
        if (i >= period) {
          const prev = data[i - period];
          const prevTypical = (prev.high + prev.low + prev.close) / 3;
          pvSum -= prevTypical * prev.volume;
          vSum -= prev.volume;
        }
        if (i < period - 1 || vSum === 0) {
          vwap.push(null);
        } else {
          vwap.push(pvSum / vSum);
        }
      }
      return ok3({ vwap });
    } catch (e) {
      return fail3(String(e));
    }
  }
};
var VolRatio = {
  schemaVersion: SCHEMA_VERSION,
  id: "vol_ratio",
  name: "Vol Ratio",
  nameKey: "indicator.vol_ratio.name",
  category: "volume",
  pane: "sub1",
  outputs: [{ name: "volRatio", color: "#00897B", style: "line", lineWidth: 1.2, zLayer: 30 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const volRatio = [];
      let sum = 0;
      for (let i = 0;i < data.length; i++) {
        sum += data[i].volume;
        if (i >= period)
          sum -= data[i - period].volume;
        if (i < period - 1) {
          volRatio.push(null);
        } else {
          const avg = sum / period;
          volRatio.push(avg === 0 ? 0 : data[i].volume / avg);
        }
      }
      return ok3({ volRatio });
    } catch (e) {
      return fail3(String(e));
    }
  }
};
var PercentB = {
  schemaVersion: SCHEMA_VERSION,
  id: "percent_b",
  nameKey: "indicator.percent_b.name",
  name: "%B",
  category: "volatility",
  pane: "sub1",
  outputs: [{ name: "percentB", color: "#673AB7", style: "line", lineWidth: 1.3, zLayer: 30 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
    stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev }) {
    try {
      const percentB = [];
      for (let i = 0;i < data.length; i++) {
        if (i < period - 1) {
          percentB.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        const bandwidth = upper - lower;
        percentB.push(bandwidth > 0 ? (data[i].close - lower) / bandwidth : 0.5);
      }
      return ok3({ percentB });
    } catch (e) {
      return fail3(String(e));
    }
  }
};
var BBWidth = {
  schemaVersion: SCHEMA_VERSION,
  id: "bb_width",
  nameKey: "indicator.bb_width.name",
  name: "BB Width",
  category: "volatility",
  pane: "sub1",
  outputs: [{ name: "width", color: "#00BCD4", style: "area", opacity: 0.5, fillTo: 0, zLayer: 20 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
    stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev }) {
    try {
      const width = [];
      for (let i = 0;i < data.length; i++) {
        if (i < period - 1) {
          width.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        width.push(sma > 0 ? (upper - lower) / sma : 0);
      }
      return ok3({ width });
    } catch (e) {
      return fail3(String(e));
    }
  }
};
var Phase3Indicators = [VWAP, VolRatio, PercentB, BBWidth];
var registerPhase3Indicators = (registry) => {
  Phase3Indicators.forEach((indicator) => registry.register(indicator));
};

// src/indicators/phase4.ts
var ok4 = (value) => ({ ok: true, value });
var fail4 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var OBV = {
  schemaVersion: SCHEMA_VERSION,
  id: "obv",
  name: "OBV",
  nameKey: "indicator.obv.name",
  category: "volume",
  pane: "sub1",
  outputs: [{ name: "obv", color: "#3F51B5", style: "line", lineWidth: 1.2, zLayer: 30 }],
  params: {},
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: () => 1,
  calculate(data) {
    try {
      const obv = [];
      let current = 0;
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          obv.push(null);
          continue;
        }
        if (data[i].close > data[i - 1].close) {
          current += data[i].volume;
        } else if (data[i].close < data[i - 1].close) {
          current -= data[i].volume;
        }
        obv.push(current);
      }
      return ok4({ obv });
    } catch (e) {
      return fail4(String(e));
    }
  }
};
var CMF = {
  schemaVersion: SCHEMA_VERSION,
  id: "cmf",
  name: "CMF",
  nameKey: "indicator.cmf.name",
  category: "volume",
  pane: "sub1",
  outputs: [{ name: "cmf", color: "#8BC34A", style: "line", lineWidth: 1.2, zLayer: 30 }],
  params: {
    period: { type: "number", default: 21, label: "Period", min: 2, max: 200 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const cmf = [];
      let sumMFV = 0;
      let sumVol = 0;
      for (let i = 0;i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const close = data[i].close;
        const volume = data[i].volume;
        const range = high - low;
        const mfm = range === 0 ? 0 : (close - low - (high - close)) / range;
        const mfv = mfm * volume;
        sumMFV += mfv;
        sumVol += volume;
        if (i >= period) {
          const prev = data[i - period];
          const prevRange = prev.high - prev.low;
          const prevMfm = prevRange === 0 ? 0 : (prev.close - prev.low - (prev.high - prev.close)) / prevRange;
          sumMFV -= prevMfm * prev.volume;
          sumVol -= prev.volume;
        }
        if (i < period - 1 || sumVol === 0) {
          cmf.push(null);
        } else {
          cmf.push(sumMFV / sumVol);
        }
      }
      return ok4({ cmf });
    } catch (e) {
      return fail4(String(e));
    }
  }
};
var MFI = {
  schemaVersion: SCHEMA_VERSION,
  id: "mfi",
  nameKey: "indicator.mfi.name",
  name: "MFI",
  category: "volume",
  pane: "sub1",
  outputs: [{ name: "mfi", color: "#FF7043", style: "line", lineWidth: 1.2, zLayer: 30 }],
  params: {
    period: { type: "number", default: 14, label: "Period", min: 2, max: 200 }
  },
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const mfi = [];
      let posSum = 0;
      let negSum = 0;
      const typicalPrices = data.map((d) => (d.high + d.low + d.close) / 3);
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          mfi.push(null);
          continue;
        }
        const tp = typicalPrices[i];
        const prevTp = typicalPrices[i - 1];
        const mf = tp * data[i].volume;
        if (tp > prevTp)
          posSum += mf;
        else if (tp < prevTp)
          negSum += mf;
        if (i >= period) {
          const oldTp = typicalPrices[i - period];
          const oldPrevTp = typicalPrices[i - period - 1];
          const oldMf = oldTp * data[i - period].volume;
          if (oldTp > oldPrevTp)
            posSum -= oldMf;
          else if (oldTp < oldPrevTp)
            negSum -= oldMf;
        }
        if (i < period) {
          mfi.push(null);
        } else {
          const ratio = negSum === 0 ? 100 : posSum / negSum;
          mfi.push(100 - 100 / (1 + ratio));
        }
      }
      return ok4({ mfi });
    } catch (e) {
      return fail4(String(e));
    }
  }
};
var KaufmanPatterns = {
  schemaVersion: SCHEMA_VERSION,
  nameKey: "indicator.kaufman_patterns.name",
  id: "kaufman_patterns",
  name: "Kaufman Patterns",
  category: "custom",
  pane: "main",
  outputs: [{ name: "kaufman", color: "#FFC107", style: "marker", zLayer: 40 }],
  params: {},
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: () => 2,
  calculate() {
    return ok4({ kaufman: [] });
  }
};
var SqueezeAlert = {
  schemaVersion: SCHEMA_VERSION,
  id: "squeeze_alert",
  name: "Squeeze Alert",
  nameKey: "indicator.squeeze_alert.name",
  category: "volatility",
  pane: "main",
  outputs: [{ name: "squeeze", color: "#FF9800", style: "marker", zLayer: 40 }],
  params: {
    period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
    stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 },
    threshold: { type: "number", default: 0.04, label: "Threshold", min: 0.01, max: 0.2, step: 0.01 }
  },
  alerts: [
    {
      id: "squeeze_found",
      name: "Squeeze Detected",
      severity: "warning",
      cooldown: 60,
      condition: (values) => values["squeeze"] !== null,
      message: (values, bar) => `Squeeze detected at price ${bar.close}`
    }
  ],
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev, threshold }) {
    try {
      const squeeze = [];
      for (let i = 0;i < data.length; i++) {
        if (i < period - 1) {
          squeeze.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        const width = sma > 0 ? (upper - lower) / sma : 0;
        squeeze.push(width < threshold ? data[i].close : null);
      }
      return ok4({ squeeze });
    } catch (e) {
      return fail4(String(e));
    }
  }
};
var Divergence = {
  schemaVersion: SCHEMA_VERSION,
  id: "divergence",
  name: "Divergence",
  nameKey: "indicator.divergence.name",
  category: "custom",
  pane: "main",
  outputs: [{ name: "divergence", color: "#FFC107", style: "marker", zLayer: 40 }],
  params: {
    period: { type: "number", default: 14, label: "Period", min: 2, max: 50 }
  },
  alerts: [
    {
      id: "divergence_found",
      name: "Divergence Detected",
      severity: "warning",
      cooldown: 60,
      condition: (values) => values["divergence"] !== null,
      message: (values, bar) => `Divergence detected at price ${bar.close}`
    }
  ],
  complexity: { time: "O(n)", space: "O(n)" },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const rsi = [];
      let avgGain = 0;
      let avgLoss = 0;
      for (let i = 0;i < data.length; i++) {
        if (i === 0) {
          rsi.push(NaN);
          continue;
        }
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i < period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          rsi.push(NaN);
        } else if (i === period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        } else {
          avgGain = (avgGain * (period - 1) + gain) / period;
          avgLoss = (avgLoss * (period - 1) + loss) / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        }
      }
      const divergence = [];
      for (let i = 0;i < data.length; i++) {
        if (i < period + 2) {
          divergence.push(null);
          continue;
        }
        const prev = i - 2;
        const priceHigher = data[i].close > data[prev].close;
        const rsiLower = rsi[i] < rsi[prev];
        divergence.push(priceHigher && rsiLower ? data[i].close : null);
      }
      return ok4({ divergence });
    } catch (e) {
      return fail4(String(e));
    }
  }
};
var Phase4Indicators = [OBV, CMF, MFI, KaufmanPatterns, SqueezeAlert, Divergence];
var registerPhase4Indicators = (registry) => {
  Phase4Indicators.forEach((indicator) => registry.register(indicator));
};

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

// src/renderer/canvas/canvasRenderer.ts
class CanvasRenderer {
  static WATERMARK_TEXT = "Mochart alpha - not for redistribution";
  canvas;
  ctx;
  baseLayerCanvas = null;
  baseLayerCtx = null;
  overlayDirtyRects = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 }
  ];
  overlayDirtyRectCount = 0;
  priceFormatters = new Map;
  dateLabelCache = new Map;
  dateFormatterShort = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  dateFormatterFull = new Intl.DateTimeFormat(undefined);
  dateCacheMaxSize = 4096;
  sampledIndicesBuffer = [];
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("2D context not available");
    this.ctx = ctx;
    this.resize();
  }
  ensureBaseLayer() {
    if (this.baseLayerCanvas && this.baseLayerCtx) {
      return { canvas: this.baseLayerCanvas, ctx: this.baseLayerCtx };
    }
    const ownerDocument = this.canvas.ownerDocument;
    const baseCanvas = ownerDocument ? ownerDocument.createElement("canvas") : this.canvas;
    const baseCtx = baseCanvas.getContext("2d");
    if (!baseCtx)
      throw new Error("2D context not available for base layer");
    this.baseLayerCanvas = baseCanvas;
    this.baseLayerCtx = baseCtx;
    if (baseCanvas !== this.canvas) {
      baseCanvas.width = this.canvas.width;
      baseCanvas.height = this.canvas.height;
      const dpr = window.devicePixelRatio || 1;
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { canvas: baseCanvas, ctx: baseCtx };
  }
  get hasDedicatedBaseLayer() {
    return this.baseLayerCanvas !== null && this.baseLayerCanvas !== this.canvas;
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || this.canvas.width || 800;
    const h = this.canvas.clientHeight || this.canvas.height || 600;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.baseLayerCanvas && this.baseLayerCanvas !== this.canvas) {
      this.baseLayerCanvas.width = Math.floor(w * dpr);
      this.baseLayerCanvas.height = Math.floor(h * dpr);
      this.baseLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  clear() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, w, h);
  }
  formatPrice(v) {
    const abs = Math.abs(v);
    const digits = abs < 1 ? 4 : abs < 10 ? 3 : abs < 100 ? 2 : 2;
    let formatter = this.priceFormatters.get(digits);
    if (!formatter) {
      formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits });
      this.priceFormatters.set(digits, formatter);
    }
    return formatter.format(v);
  }
  formatDateLabel(time, spanMs) {
    const mode = spanMs > 365 * 24 * 3600 * 1000 ? "full" : "short";
    const key = `${mode}:${time}`;
    const cached = this.dateLabelCache.get(key);
    if (cached)
      return cached;
    const date = new Date(time);
    const value = mode === "full" ? this.dateFormatterFull.format(date) : this.dateFormatterShort.format(date);
    if (this.dateLabelCache.size >= this.dateCacheMaxSize) {
      this.dateLabelCache.clear();
    }
    this.dateLabelCache.set(key, value);
    return value;
  }
  lttbSampleIndicesInRange(data, start, end, threshold, out) {
    const n = Math.max(0, end - start);
    out.length = 0;
    if (n <= 0)
      return 0;
    if (threshold >= n || threshold < 3) {
      for (let i = 0;i < n; i++)
        out.push(i);
      return out.length;
    }
    out.push(0);
    const bucketSize = (n - 2) / (threshold - 2);
    let a = 0;
    const base = start;
    for (let i = 0;i < threshold - 2; i++) {
      const rawRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const rawRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
      const rangeStart = Math.max(1, Math.min(n, rawRangeStart));
      const rangeEnd = Math.max(rangeStart, Math.min(n, rawRangeEnd));
      let avgX = 0;
      let avgY = 0;
      const avgRangeLength = Math.max(1, rangeEnd - rangeStart);
      if (rangeEnd > rangeStart) {
        const first = rangeStart;
        const last = rangeEnd - 1;
        avgX = (first + last) * avgRangeLength * 0.5;
        for (let j = rangeStart;j < rangeEnd; j++) {
          const value = data[base + j].close;
          avgY += Number.isFinite(value) ? value : 0;
        }
      } else {
        const fallback = Math.max(0, Math.min(n - 1, rangeStart - 1));
        avgX = fallback;
        const value = data[base + fallback].close;
        avgY = Number.isFinite(value) ? value : 0;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
      const rawCurrentStart = Math.floor(i * bucketSize) + 1;
      const rawCurrentEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n);
      const currentRangeStart = Math.max(1, Math.min(n - 1, rawCurrentStart));
      const currentRangeEnd = Math.max(currentRangeStart + 1, Math.min(n, rawCurrentEnd));
      let maxArea = -1;
      let maxIndex = currentRangeStart;
      const pointA = data[base + a];
      const ax = a;
      const ay = pointA.close;
      for (let j = currentRangeStart;j < currentRangeEnd; j++) {
        const py = data[base + j].close;
        if (!Number.isFinite(py) || !Number.isFinite(ay))
          continue;
        const area = Math.abs((ax - avgX) * (py - ay) - (ax - j) * (avgY - ay));
        if (area > maxArea) {
          maxArea = area;
          maxIndex = j;
        }
      }
      out.push(maxIndex);
      a = maxIndex;
    }
    out.push(n - 1);
    return out.length;
  }
  canUseSimdPreprocess(valuesCount, threshold) {
    if (valuesCount < threshold)
      return false;
    if (typeof WebAssembly === "undefined")
      return false;
    return true;
  }
  render(snapshot) {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const targetW = Math.floor(w * dpr);
    const targetH = Math.floor(h * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.resize();
    }
    const viewportOptions = {
      startIndex: snapshot.viewport.startIndex,
      visibleCount: snapshot.viewport.visibleCount,
      rightMarginBars: snapshot.viewport.rightMarginBars
    };
    const targetSeries = snapshot.primarySeriesId ? snapshot.series.find((s) => s.id === snapshot.primarySeriesId) : snapshot.series[0];
    if (!targetSeries)
      return;
    {
      const drawOptions = {
        ...targetSeries.options ?? {},
        ...viewportOptions
      };
      if (targetSeries.visibleSlice) {
        this.drawSeriesFromVisibleSlice(targetSeries.id, targetSeries.visibleSlice, drawOptions);
      } else {
        this.drawSeries(targetSeries.id, targetSeries.data, drawOptions);
      }
      this.drawWatermark(w, h);
      if (this.hasDedicatedBaseLayer) {
        const { canvas: baseCanvas, ctx: baseCtx } = this.ensureBaseLayer();
        baseCtx.save();
        baseCtx.setTransform(1, 0, 0, 1, 0, 0);
        baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
        baseCtx.drawImage(this.canvas, 0, 0);
        baseCtx.restore();
      }
    }
    this.overlayDirtyRectCount = 0;
  }
  drawWatermark(widthCss, heightCss) {
    const cx = widthCss * 0.5;
    const cy = heightCss * 0.5;
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(-Math.PI / 6);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "600 18px sans-serif";
    this.ctx.fillStyle = "rgba(24,24,24,0.14)";
    this.ctx.fillText(CanvasRenderer.WATERMARK_TEXT, 0, 0);
    this.ctx.restore();
  }
  renderOverlay(snapshot, command) {
    if (command.type !== "crosshair")
      return;
    if (!this.baseLayerCanvas) {
      this.ensureBaseLayer();
    }
    if (this.hasDedicatedBaseLayer) {
      const baseCtx = this.baseLayerCtx;
      const baseCanvas = this.baseLayerCanvas;
      if (this.overlayDirtyRectCount === 0) {
        baseCtx.save();
        baseCtx.setTransform(1, 0, 0, 1, 0, 0);
        baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
        baseCtx.drawImage(this.canvas, 0, 0);
        baseCtx.restore();
      }
    }
    this.restoreOverlayDirtyRects();
    const targetSeries = snapshot.primarySeriesId ? snapshot.series.find((s) => s.id === snapshot.primarySeriesId) : snapshot.series[0];
    if (!targetSeries)
      return;
    const options = {
      ...targetSeries.options ?? {},
      startIndex: snapshot.viewport.startIndex,
      visibleCount: snapshot.viewport.visibleCount,
      rightMarginBars: snapshot.viewport.rightMarginBars,
      ...command.options ?? {}
    };
    const slice = targetSeries.visibleSlice;
    const layout = slice ? this.getLayoutFromSlice(slice, options) : this.getLayout(targetSeries.data, options);
    const mapped = slice ? this.hitTestFromSlice(command.clientX, command.clientY, slice, layout) : this.hitTest(command.clientX, command.clientY, targetSeries.data, options);
    if (!mapped)
      return;
    this.drawCrosshairFromLayout(command.clientX, command.clientY, layout, mapped, options);
    const clampedY = Math.max(layout.plotY, Math.min(layout.plotY + layout.plotH, command.clientY));
    const r0 = this.overlayDirtyRects[0];
    r0.x = Math.max(0, Math.floor(mapped.x - 2));
    r0.y = Math.max(0, Math.floor(layout.plotY));
    r0.w = 4;
    r0.h = Math.ceil(layout.plotH);
    const r1 = this.overlayDirtyRects[1];
    r1.x = Math.max(0, Math.floor(layout.plotX));
    r1.y = Math.max(0, Math.floor(clampedY - 2));
    r1.w = Math.ceil(layout.plotW);
    r1.h = 4;
    const r2 = this.overlayDirtyRects[2];
    r2.x = Math.max(0, Math.floor(layout.plotX - 90));
    r2.y = Math.max(0, Math.floor(clampedY - 12));
    r2.w = 96;
    r2.h = 24;
    this.overlayDirtyRectCount = 3;
  }
  clearOverlay(snapshot) {
    this.restoreOverlayDirtyRects();
    this.overlayDirtyRectCount = 0;
  }
  restoreOverlayDirtyRects() {
    if (!this.baseLayerCanvas || this.baseLayerCanvas === this.canvas)
      return;
    if (this.overlayDirtyRectCount === 0)
      return;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0;i < this.overlayDirtyRectCount; i++) {
      const rect = this.overlayDirtyRects[i];
      const sx = Math.floor(rect.x * dpr);
      const sy = Math.floor(rect.y * dpr);
      const sw = Math.max(1, Math.ceil(rect.w * dpr));
      const sh = Math.max(1, Math.ceil(rect.h * dpr));
      this.ctx.drawImage(this.baseLayerCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
    }
    this.ctx.restore();
  }
  isColumnar(data) {
    return typeof data.sliceView === "function";
  }
  createVisibleSliceForColumnar(data, options) {
    const defaultMaxVisible = options?.maxVisibleBars ?? 200;
    const visibleCount = Math.max(1, Math.min(options?.visibleCount ?? defaultMaxVisible, data.length));
    const startRaw = typeof options?.startIndex === "number" ? options.startIndex : Math.max(0, data.length - visibleCount);
    const startFloor = Math.floor(Math.max(0, startRaw));
    const rightMarginBars = Math.max(0, options?.rightMarginBars ?? 0);
    const sliceLength = visibleCount + rightMarginBars + 2;
    return data.sliceView(startFloor, sliceLength);
  }
  drawSeriesFromVisibleSlice(_seriesId, visible, options) {
    if (visible.length === 0)
      return;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;
    const rightMarginBars = options?.rightMarginBars ?? 0;
    const visibleCount = Math.max(1, options?.visibleCount ?? visible.length);
    const startRaw = typeof options?.startIndex === "number" ? options.startIndex : visible.globalOffset;
    const startFrac = startRaw - Math.floor(startRaw);
    const totalSlots = visibleCount + rightMarginBars;
    const seriesType = options?.type ?? "candlestick";
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let hasInvalidValues = false;
    if (seriesType === "line") {
      for (let i = 0;i < visible.length; i++) {
        const close = visible.close[i];
        if (close < min)
          min = close;
        if (close > max)
          max = close;
      }
    } else {
      for (let i = 0;i < visible.length; i++) {
        const low = visible.low[i];
        const high = visible.high[i];
        if (low < min)
          min = low;
        if (high > max)
          max = high;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      hasInvalidValues = true;
      min = Number.POSITIVE_INFINITY;
      max = Number.NEGATIVE_INFINITY;
      if (seriesType === "line") {
        for (let i = 0;i < visible.length; i++) {
          const close = visible.close[i];
          if (!Number.isFinite(close))
            continue;
          if (close < min)
            min = close;
          if (close > max)
            max = close;
        }
      } else {
        for (let i = 0;i < visible.length; i++) {
          const low = visible.low[i];
          const high = visible.high[i];
          if (!Number.isFinite(low) || !Number.isFinite(high))
            continue;
          if (low < min)
            min = low;
          if (high > max)
            max = high;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max))
      return;
    const hasYOverride = Number.isFinite(options?.yMinOverride) && Number.isFinite(options?.yMaxOverride);
    const padded = hasYOverride ? null : computePaddedPriceRange(min, max, plotH, options?.paddingRatio, options?.minPaddingPx);
    const yMin = hasYOverride ? options?.yMinOverride : padded.min;
    const yMax = hasYOverride ? options?.yMaxOverride : padded.max;
    const priceToY = (price) => {
      const t = (price - yMin) / (yMax - yMin || 1);
      return plotY + (1 - t) * plotH;
    };
    this.ctx.fillStyle = options?.background ?? "#ffffff";
    this.ctx.fillRect(0, 0, w, h);
    drawYAxisGridAndLabels(this.ctx, {
      plotX,
      plotY,
      plotW,
      plotH,
      yMin,
      yMax,
      targetYTicks: options?.targetYTicks ?? 5,
      font: options?.font ?? "12px sans-serif",
      axisColor: options?.axisLabelColor ?? "#222222",
      gridColor: options?.gridColor ?? "#e6e6e6",
      formatPrice: (value) => this.formatPrice(value)
    });
    const { stepPx: stepX, bodyWidthPx: candleW } = computeCandleMetrics(totalSlots, plotW);
    const outlineColor = options?.outlineColor || "#222222";
    const wickColor = options?.wickColor || outlineColor;
    const upColor = options?.upColor || "#2e7d32";
    const downColor = options?.downColor || "#d32f2f";
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(plotX, plotY, plotW, plotH);
    this.ctx.clip();
    const downsampleStep = visibleCount > plotW ? Math.max(1, Math.ceil(visible.length / Math.max(1, Math.floor(plotW)))) : 1;
    if (seriesType === "line") {
      this.ctx.strokeStyle = options?.color || outlineColor;
      this.ctx.lineWidth = Math.max(1, options?.lineWidth ?? 1.5);
      this.ctx.beginPath();
      let started = false;
      for (let i = 0;i < visible.length; i += downsampleStep) {
        const close = visible.close[i];
        if (hasInvalidValues && !Number.isFinite(close))
          continue;
        const x = plotX + (i - startFrac) * stepX;
        const y = priceToY(close);
        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      if (started) {
        this.ctx.stroke();
      }
    } else {
      for (let i = 0;i < visible.length; i += downsampleStep) {
        if (hasInvalidValues && (!Number.isFinite(visible.open[i]) || !Number.isFinite(visible.close[i]) || !Number.isFinite(visible.high[i]) || !Number.isFinite(visible.low[i]))) {
          continue;
        }
        const x = plotX + (i - startFrac) * stepX;
        const yOpen = priceToY(visible.open[i]);
        const yClose = priceToY(visible.close[i]);
        const yHigh = priceToY(visible.high[i]);
        const yLow = priceToY(visible.low[i]);
        const top = Math.min(yOpen, yClose);
        const bottom = Math.max(yOpen, yClose);
        this.ctx.strokeStyle = wickColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 0.5, yHigh);
        this.ctx.lineTo(x + 0.5, yLow);
        this.ctx.stroke();
        if (visible.close[i] > visible.open[i]) {
          this.ctx.fillStyle = upColor;
        } else if (visible.close[i] < visible.open[i]) {
          this.ctx.fillStyle = downColor;
        } else {
          this.ctx.fillStyle = outlineColor;
        }
        this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
        this.ctx.strokeStyle = outlineColor;
        this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
      }
    }
    this.ctx.restore();
    const firstTime = visible.time[0];
    const lastTime = visible.time[Math.max(0, visible.length - 1)];
    const spanMs = lastTime - firstTime || 1;
    drawXAxisTicksAndLabels(this.ctx, {
      plotX,
      plotY,
      plotW,
      plotH,
      stepX,
      visibleCount,
      targetXTicks: options?.targetXTicks ?? 6,
      font: options?.font ?? "12px sans-serif",
      axisColor: options?.axisLabelColor ?? "#222222",
      getLabelAtLocalIndex: (localIdx) => {
        const clamped = Math.max(0, Math.min(visible.length - 1, Math.round(startFrac + localIdx)));
        return this.formatDateLabel(visible.time[clamped], spanMs);
      }
    });
  }
  drawSeries(seriesId, data, options) {
    if (this.isColumnar(data)) {
      const slice = this.createVisibleSliceForColumnar(data, options);
      this.drawSeriesFromVisibleSlice(seriesId, slice, options);
      return;
    }
    const pointData = data;
    if (!pointData || pointData.length === 0)
      return;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;
    const defaultMaxVisible = options?.maxVisibleBars ?? 200;
    const rightMarginBars = options?.rightMarginBars ?? 0;
    const visibleCount = Math.min(options?.visibleCount ?? defaultMaxVisible, pointData.length);
    let startRaw = typeof options?.startIndex === "number" ? options.startIndex : Math.max(0, pointData.length - visibleCount);
    if (startRaw < 0)
      startRaw = 0;
    if (startRaw + visibleCount > pointData.length)
      startRaw = Math.max(0, pointData.length - visibleCount);
    const startFloor = Math.floor(startRaw);
    const startFrac = startRaw - startFloor;
    const visibleStart = startFloor;
    const visibleEnd = Math.min(pointData.length, startFloor + visibleCount + 1);
    const visibleLength = Math.max(0, visibleEnd - visibleStart);
    const seriesType = options?.type ?? "candlestick";
    const totalSlots = visibleCount + rightMarginBars;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let hasInvalidValues = false;
    if (seriesType === "line") {
      for (let idx = visibleStart;idx < visibleEnd; idx++) {
        const d = pointData[idx];
        if (d.close < min)
          min = d.close;
        if (d.close > max)
          max = d.close;
      }
    } else {
      for (let idx = visibleStart;idx < visibleEnd; idx++) {
        const d = pointData[idx];
        if (d.low < min)
          min = d.low;
        if (d.high > max)
          max = d.high;
      }
    }
    if (!isFinite(min) || !isFinite(max)) {
      hasInvalidValues = true;
      min = Number.POSITIVE_INFINITY;
      max = Number.NEGATIVE_INFINITY;
      if (seriesType === "line") {
        for (let idx = visibleStart;idx < visibleEnd; idx++) {
          const d = pointData[idx];
          if (!Number.isFinite(d.close))
            continue;
          if (d.close < min)
            min = d.close;
          if (d.close > max)
            max = d.close;
        }
      } else {
        for (let idx = visibleStart;idx < visibleEnd; idx++) {
          const d = pointData[idx];
          if (!Number.isFinite(d.low) || !Number.isFinite(d.high))
            continue;
          if (d.low < min)
            min = d.low;
          if (d.high > max)
            max = d.high;
        }
      }
    }
    if (!isFinite(min) || !isFinite(max))
      return;
    const hasYOverride = Number.isFinite(options?.yMinOverride) && Number.isFinite(options?.yMaxOverride);
    const padded = hasYOverride ? null : computePaddedPriceRange(min, max, plotH, options?.paddingRatio, options?.minPaddingPx);
    const yMin = hasYOverride ? options?.yMinOverride : padded.min;
    const yMax = hasYOverride ? options?.yMaxOverride : padded.max;
    const priceToY = (p) => {
      const t = (p - yMin) / (yMax - yMin || 1);
      return plotY + (1 - t) * plotH;
    };
    this.ctx.fillStyle = options?.background ?? "#ffffff";
    this.ctx.fillRect(0, 0, w, h);
    drawYAxisGridAndLabels(this.ctx, {
      plotX,
      plotY,
      plotW,
      plotH,
      yMin,
      yMax,
      targetYTicks: options?.targetYTicks ?? 5,
      font: options?.font ?? "12px sans-serif",
      axisColor: options?.axisLabelColor ?? "#222222",
      gridColor: options?.gridColor ?? "#e6e6e6",
      formatPrice: (value) => this.formatPrice(value)
    });
    const targetXTicks = options?.targetXTicks ?? 6;
    const windowFirstIdx = Math.max(0, Math.min(pointData.length - 1, Math.floor(startRaw)));
    const windowLastIdx = Math.max(0, Math.min(pointData.length - 1, Math.floor(startRaw + visibleCount - 1)));
    const visibleFromTime = pointData[windowFirstIdx]?.time ?? pointData[visibleStart]?.time;
    const visibleToTime = pointData[windowLastIdx]?.time ?? pointData[Math.max(visibleStart, visibleEnd - 1)]?.time;
    const spanMs = visibleToTime - visibleFromTime || 1;
    const { stepPx: stepX, bodyWidthPx: candleW } = computeCandleMetrics(totalSlots, plotW);
    const outlineColor = options?.outlineColor || "#222222";
    const wickColor = options?.wickColor || outlineColor;
    const upColor = options?.upColor || "#2e7d32";
    const downColor = options?.downColor || "#d32f2f";
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(plotX, plotY, plotW, plotH);
    this.ctx.clip();
    if (seriesType === "line") {
      const downsampleStep = visibleCount > plotW ? Math.max(1, Math.ceil(visibleLength / Math.max(1, Math.floor(plotW)))) : 1;
      this.ctx.strokeStyle = options?.color || outlineColor;
      this.ctx.lineWidth = Math.max(1, options?.lineWidth ?? 1.5);
      this.ctx.beginPath();
      let started = false;
      for (let i = 0;i < visibleLength; i += downsampleStep) {
        const d = pointData[visibleStart + i];
        if (hasInvalidValues && !Number.isFinite(d.close))
          continue;
        const x = plotX + (i - startFrac) * stepX;
        const y = priceToY(d.close);
        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      if (started) {
        this.ctx.stroke();
      }
      this.ctx.restore();
      drawXAxisTicksAndLabels(this.ctx, {
        plotX,
        plotY,
        plotW,
        plotH,
        stepX,
        visibleCount,
        targetXTicks: options?.targetXTicks ?? 6,
        font: options?.font ?? "12px sans-serif",
        axisColor: options?.axisLabelColor ?? "#222222",
        getLabelAtLocalIndex: (localIdx) => {
          const dataIdx = Math.max(0, Math.min(pointData.length - 1, Math.round(startRaw + localIdx)));
          return this.formatDateLabel(pointData[dataIdx].time, spanMs);
        }
      });
      return;
    }
    const shouldDownsample = visibleCount > plotW;
    if (shouldDownsample) {
      const threshold = Math.max(3, Math.floor(plotW));
      const sampledCount = this.lttbSampleIndicesInRange(pointData, visibleStart, visibleEnd, threshold, this.sampledIndicesBuffer);
      if (hasInvalidValues) {
        for (let k = 0;k < sampledCount; k++) {
          const i = this.sampledIndicesBuffer[k];
          const d = pointData[visibleStart + i];
          if (!Number.isFinite(d.open) || !Number.isFinite(d.close) || !Number.isFinite(d.high) || !Number.isFinite(d.low))
            continue;
          const x = plotX + (i - startFrac) * stepX;
          const yOpen = priceToY(d.open);
          const yClose = priceToY(d.close);
          const yHigh = priceToY(d.high);
          const yLow = priceToY(d.low);
          const top = Math.min(yOpen, yClose);
          const bottom = Math.max(yOpen, yClose);
          this.ctx.strokeStyle = wickColor;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(x + 0.5, yHigh);
          this.ctx.lineTo(x + 0.5, yLow);
          this.ctx.stroke();
          if (d.close > d.open) {
            this.ctx.fillStyle = upColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else if (d.close < d.open) {
            this.ctx.fillStyle = downColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else {
            const cy = (yOpen + yClose) / 2;
            const hx = candleW * 0.9;
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x - hx / 2, cy);
            this.ctx.lineTo(x + hx / 2, cy);
            this.ctx.moveTo(x, cy - hx / 2);
            this.ctx.lineTo(x, cy + hx / 2);
            this.ctx.stroke();
          }
        }
      } else {
        for (let k = 0;k < sampledCount; k++) {
          const i = this.sampledIndicesBuffer[k];
          const d = pointData[visibleStart + i];
          const x = plotX + (i - startFrac) * stepX;
          const yOpen = priceToY(d.open);
          const yClose = priceToY(d.close);
          const yHigh = priceToY(d.high);
          const yLow = priceToY(d.low);
          const top = Math.min(yOpen, yClose);
          const bottom = Math.max(yOpen, yClose);
          this.ctx.strokeStyle = wickColor;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(x + 0.5, yHigh);
          this.ctx.lineTo(x + 0.5, yLow);
          this.ctx.stroke();
          if (d.close > d.open) {
            this.ctx.fillStyle = upColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else if (d.close < d.open) {
            this.ctx.fillStyle = downColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else {
            const cy = (yOpen + yClose) / 2;
            const hx = candleW * 0.9;
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x - hx / 2, cy);
            this.ctx.lineTo(x + hx / 2, cy);
            this.ctx.moveTo(x, cy - hx / 2);
            this.ctx.lineTo(x, cy + hx / 2);
            this.ctx.stroke();
          }
        }
      }
    } else {
      if (hasInvalidValues) {
        for (let i = 0;i < visibleLength; i++) {
          const d = pointData[visibleStart + i];
          if (!Number.isFinite(d.open) || !Number.isFinite(d.close) || !Number.isFinite(d.high) || !Number.isFinite(d.low))
            continue;
          const x = plotX + (i - startFrac) * stepX;
          const yOpen = priceToY(d.open);
          const yClose = priceToY(d.close);
          const yHigh = priceToY(d.high);
          const yLow = priceToY(d.low);
          const top = Math.min(yOpen, yClose);
          const bottom = Math.max(yOpen, yClose);
          this.ctx.strokeStyle = wickColor;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(x + 0.5, yHigh);
          this.ctx.lineTo(x + 0.5, yLow);
          this.ctx.stroke();
          if (d.close > d.open) {
            this.ctx.fillStyle = upColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else if (d.close < d.open) {
            this.ctx.fillStyle = downColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else {
            const cy = (yOpen + yClose) / 2;
            const hx = candleW * 0.9;
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x - hx / 2, cy);
            this.ctx.lineTo(x + hx / 2, cy);
            this.ctx.moveTo(x, cy - hx / 2);
            this.ctx.lineTo(x, cy + hx / 2);
            this.ctx.stroke();
          }
        }
      } else {
        for (let i = 0;i < visibleLength; i++) {
          const d = pointData[visibleStart + i];
          const x = plotX + (i - startFrac) * stepX;
          const yOpen = priceToY(d.open);
          const yClose = priceToY(d.close);
          const yHigh = priceToY(d.high);
          const yLow = priceToY(d.low);
          const top = Math.min(yOpen, yClose);
          const bottom = Math.max(yOpen, yClose);
          this.ctx.strokeStyle = wickColor;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(x + 0.5, yHigh);
          this.ctx.lineTo(x + 0.5, yLow);
          this.ctx.stroke();
          if (d.close > d.open) {
            this.ctx.fillStyle = upColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else if (d.close < d.open) {
            this.ctx.fillStyle = downColor;
            this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
          } else {
            const cy = (yOpen + yClose) / 2;
            const hx = candleW * 0.9;
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x - hx / 2, cy);
            this.ctx.lineTo(x + hx / 2, cy);
            this.ctx.moveTo(x, cy - hx / 2);
            this.ctx.lineTo(x, cy + hx / 2);
            this.ctx.stroke();
          }
        }
      }
    }
    this.ctx.restore();
    drawXAxisTicksAndLabels(this.ctx, {
      plotX,
      plotY,
      plotW,
      plotH,
      stepX,
      visibleCount,
      targetXTicks: options?.targetXTicks ?? 6,
      font: options?.font ?? "12px sans-serif",
      axisColor: options?.axisLabelColor ?? "#222222",
      getLabelAtLocalIndex: (localIdx) => {
        const dataIdx = Math.max(0, Math.min(pointData.length - 1, Math.round(startRaw + localIdx)));
        return this.formatDateLabel(pointData[dataIdx].time, spanMs);
      }
    });
  }
  getLayout(data, options) {
    if (this.isColumnar(data)) {
      return this.getLayoutFromSlice(this.createVisibleSliceForColumnar(data, options), options);
    }
    const pointData = data;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;
    const defaultMaxVisible = options?.maxVisibleBars ?? 200;
    const rightMarginBars = options?.rightMarginBars ?? 0;
    const visibleCount = Math.min(options?.visibleCount ?? defaultMaxVisible, pointData.length);
    let startRaw = typeof options?.startIndex === "number" ? options.startIndex : Math.max(0, pointData.length - visibleCount);
    if (startRaw < 0)
      startRaw = 0;
    if (startRaw + visibleCount > pointData.length)
      startRaw = Math.max(0, pointData.length - visibleCount);
    const startFloor = Math.floor(startRaw);
    const visibleStart = startFloor;
    const visibleEnd = Math.min(pointData.length, startFloor + visibleCount + 1);
    const totalSlots = visibleCount + rightMarginBars;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let idx = visibleStart;idx < visibleEnd; idx++) {
      const d = pointData[idx];
      if (!Number.isFinite(d.low) || !Number.isFinite(d.high))
        continue;
      if (d.low < min)
        min = d.low;
      if (d.high > max)
        max = d.high;
    }
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }
    const padded = computePaddedPriceRange(min, max, plotH, options?.paddingRatio, options?.minPaddingPx);
    const yMin = padded.min;
    const yMax = padded.max;
    const { stepPx: stepX, bodyWidthPx: candleW } = computeCandleMetrics(totalSlots, plotW);
    return { plotX, plotY, plotW, plotH, gutterLeft, gutterTop, xAxisHeight, startIndex: startFloor, startIndexRaw: startRaw, visibleCount, stepX, candleW, yMin, yMax, rightMarginBars };
  }
  hitTest(clientX, clientY, data, options) {
    if (this.isColumnar(data)) {
      const slice = this.createVisibleSliceForColumnar(data, options);
      return this.hitTestFromSlice(clientX, clientY, slice, this.getLayoutFromSlice(slice, options));
    }
    const pointData = data;
    const layout = this.getLayout(pointData, options);
    const { plotX, plotY, plotW, plotH, startIndex, visibleCount, stepX, yMin, yMax } = layout;
    const startRaw = layout.startIndexRaw ?? startIndex;
    const startFrac = startRaw - Math.floor(startRaw);
    const localX = clientX - plotX;
    const localY = clientY - plotY;
    if (localX < -10 || localX > plotW + 10 || localY < -10 || localY > plotH + 10)
      return null;
    const idxFloat = localX / stepX + startFrac;
    const idx = Math.round(idxFloat);
    const clamped = Math.max(0, Math.min(visibleCount - 1, idx));
    const dataIdx = startIndex + clamped;
    const point = pointData[dataIdx];
    if (!point)
      return null;
    const x = plotX + (clamped - startFrac) * stepX;
    const priceAtY = yMin + (1 - localY / plotH) * (yMax - yMin || 0);
    return { index: dataIdx, localIndex: clamped, time: point.time, point, x, y: plotY + localY, priceAtY };
  }
  mapClientToData(clientX, clientY, data, options) {
    return this.hitTest(clientX, clientY, data, options);
  }
  drawCrosshairAt(clientX, clientY, data, options) {
    if (this.isColumnar(data)) {
      const slice = this.createVisibleSliceForColumnar(data, options);
      const layoutFromSlice = this.getLayoutFromSlice(slice, options);
      const mappedFromSlice = this.hitTestFromSlice(clientX, clientY, slice, layoutFromSlice);
      if (!mappedFromSlice)
        return;
      this.drawCrosshairFromLayout(clientX, clientY, layoutFromSlice, mappedFromSlice, options);
      return;
    }
    const pointData = data;
    const layout = this.getLayout(pointData, options);
    const { plotX, plotY, plotW, plotH, yMin, yMax } = layout;
    const mapped = this.hitTest(clientX, clientY, pointData, options);
    if (!mapped)
      return;
    const x = mapped.x;
    const clampedY = Math.max(plotY, Math.min(plotY + plotH, clientY));
    const t = 1 - (clampedY - plotY) / plotH;
    const priceAtY = yMin + t * (yMax - yMin);
    drawCrosshairOverlay(this.ctx, {
      plotX,
      plotY,
      plotW,
      plotH,
      x,
      clampedY,
      priceAtY,
      strokeColor: options?.color ?? "#666666",
      lineWidth: options?.lineWidth ?? 1,
      labelText: this.formatPrice(priceAtY)
    });
  }
  updateBuffers(_seriesId, _data, _offset) {}
  partialUpdateBuffers(_seriesId, _patches) {}
  getLayoutFromSlice(slice, options) {
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;
    const rightMarginBars = options?.rightMarginBars ?? 0;
    const visibleCount = options?.visibleCount ?? slice.length;
    const startRaw = options?.startIndex ?? slice.globalOffset;
    const startFloor = Math.floor(startRaw);
    const totalSlots = visibleCount + rightMarginBars;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0;i < slice.length; i++) {
      const low = slice.low[i];
      const high = slice.high[i];
      if (!Number.isFinite(low) || !Number.isFinite(high))
        continue;
      if (low < min)
        min = low;
      if (high > max)
        max = high;
    }
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }
    const padded = computePaddedPriceRange(min, max, plotH, options?.paddingRatio, options?.minPaddingPx);
    const yMin = padded.min;
    const yMax = padded.max;
    const { stepPx: stepX, bodyWidthPx: candleW } = computeCandleMetrics(totalSlots, plotW);
    return { plotX, plotY, plotW, plotH, gutterLeft, gutterTop, xAxisHeight, startIndex: startFloor, startIndexRaw: startRaw, visibleCount, stepX, candleW, yMin, yMax, rightMarginBars };
  }
  hitTestFromSlice(clientX, clientY, slice, layout) {
    const { plotX, plotY, plotW, plotH, startIndex, visibleCount, stepX, yMin, yMax } = layout;
    const startRaw = layout.startIndexRaw ?? startIndex;
    const startFrac = startRaw - Math.floor(startRaw);
    const localX = clientX - plotX;
    const localY = clientY - plotY;
    if (localX < -10 || localX > plotW + 10 || localY < -10 || localY > plotH + 10)
      return null;
    const idxFloat = localX / stepX + startFrac;
    const idx = Math.round(idxFloat);
    const clamped = Math.max(0, Math.min(visibleCount - 1, idx));
    if (clamped >= slice.length)
      return null;
    const dataIdx = startIndex + clamped;
    const x = plotX + (clamped - startFrac) * stepX;
    const priceAtY = yMin + (1 - localY / plotH) * (yMax - yMin || 0);
    return {
      index: dataIdx,
      localIndex: clamped,
      time: slice.time[clamped],
      point: {
        time: slice.time[clamped],
        open: slice.open[clamped],
        high: slice.high[clamped],
        low: slice.low[clamped],
        close: slice.close[clamped],
        volume: slice.volume[clamped]
      },
      x,
      y: plotY + localY,
      priceAtY
    };
  }
  drawCrosshairFromLayout(clientX, clientY, layout, mapped, options) {
    const { plotX, plotY, plotW, plotH, yMin, yMax } = layout;
    const x = mapped.x;
    const clampedY = Math.max(plotY, Math.min(plotY + plotH, clientY));
    const t = 1 - (clampedY - plotY) / plotH;
    const priceAtY = yMin + t * (yMax - yMin);
    drawCrosshairOverlay(this.ctx, {
      plotX,
      plotY,
      plotW,
      plotH,
      x,
      clampedY,
      priceAtY,
      strokeColor: options?.color ?? "#666666",
      lineWidth: options?.lineWidth ?? 1,
      labelText: this.formatPrice(priceAtY)
    });
  }
  destroy() {
    this.dateLabelCache.clear();
    this.priceFormatters.clear();
  }
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

// src/renderer/worker/workerCanvasRenderer.ts
class WorkerCanvasRenderer {
  static nextChartId = 1;
  canvas;
  helperRenderer;
  helperCanvas;
  workerUrlOverride;
  injectedWorker;
  onStateChange;
  chartId;
  ownsWorker = false;
  fallbackRenderer = null;
  worker = null;
  lastPayload = null;
  sharedFrameBuffer = null;
  sharedGeneration = -1;
  lastState = null;
  awaitingFrame = false;
  awaitingFrameTimer = null;
  lastOverlayRevisionSent = -1;
  constructor(canvas, options) {
    this.canvas = canvas;
    this.helperCanvas = canvas.ownerDocument ? canvas.ownerDocument.createElement("canvas") : canvas;
    this.helperRenderer = new CanvasRenderer(this.helperCanvas);
    this.workerUrlOverride = options?.workerUrl;
    this.injectedWorker = options?.sharedWorker;
    this.onStateChange = options?.onStateChange;
    this.chartId = WorkerCanvasRenderer.nextChartId++;
    if (!this.tryInitializeWorker()) {
      this.fallbackRenderer = new CanvasRenderer(canvas);
      this.publishState("fallback");
      return;
    }
    this.publishState(this.sharedFrameBuffer ? "shared" : "msg");
  }
  render(snapshot) {
    this.syncHelperCanvasSize(snapshot.layout.width, snapshot.layout.height, snapshot.layout.dpr);
    const payload = this.toWorkerPayload(snapshot);
    this.lastPayload = payload;
    if (this.fallbackRenderer) {
      this.fallbackRenderer.render(snapshot);
      return;
    }
    if ((snapshot.overlayRevision ?? 0) !== this.lastOverlayRevisionSent) {
      const primitives = snapshot.overlayPrimitives ?? [];
      this.postMessage({
        type: "ann_bulk",
        chartId: this.chartId,
        payload: {
          revision: snapshot.overlayRevision ?? 0,
          primitives
        }
      });
      this.lastOverlayRevisionSent = snapshot.overlayRevision ?? 0;
    }
    const sharedPayload = this.toSharedWorkerPayload(snapshot);
    if (sharedPayload) {
      this.postMessage({ type: "renderShared", chartId: this.chartId, payload: sharedPayload });
      return;
    }
    if (this.awaitingFrame)
      return;
    const data = payload.data;
    if (data && typeof data === "object" && data.time instanceof Float64Array && data.length > 0) {
      const len = data.length | 0;
      const timeBuf = new Float64Array(len);
      const openBuf = new Float32Array(len);
      const highBuf = new Float32Array(len);
      const lowBuf = new Float32Array(len);
      const closeBuf = new Float32Array(len);
      const volBuf = new Float32Array(len);
      timeBuf.set(data.time.subarray(0, len));
      openBuf.set(data.open.subarray(0, len));
      highBuf.set(data.high.subarray(0, len));
      lowBuf.set(data.low.subarray(0, len));
      closeBuf.set(data.close.subarray(0, len));
      volBuf.set(data.volume.subarray(0, len));
      const transferablePayload = {
        ...payload,
        data: {
          time: timeBuf,
          open: openBuf,
          high: highBuf,
          low: lowBuf,
          close: closeBuf,
          volume: volBuf,
          length: len
        }
      };
      const transfers = [
        timeBuf.buffer,
        openBuf.buffer,
        highBuf.buffer,
        lowBuf.buffer,
        closeBuf.buffer,
        volBuf.buffer
      ];
      this.postMessage({ type: "render", chartId: this.chartId, payload: transferablePayload }, transfers);
      this.awaitingFrame = true;
      this.armAwaitingFrameWatchdog();
      return;
    }
    this.postMessage({ type: "render", chartId: this.chartId, payload });
    this.awaitingFrame = true;
    this.armAwaitingFrameWatchdog();
  }
  renderOverlay(snapshot, command) {
    if (this.fallbackRenderer) {
      this.fallbackRenderer.renderOverlay?.(snapshot, command);
      return;
    }
    if (command.type !== "crosshair")
      return;
    this.postMessage({
      type: "overlay",
      chartId: this.chartId,
      payload: {
        clientX: command.clientX,
        clientY: command.clientY
      }
    });
  }
  clearOverlay(snapshot) {
    if (this.fallbackRenderer) {
      this.fallbackRenderer.clearOverlay?.(snapshot);
      return;
    }
    this.postMessage({ type: "clearOverlay", chartId: this.chartId });
  }
  clear() {
    if (this.fallbackRenderer) {
      this.fallbackRenderer.clear?.();
      return;
    }
    this.postMessage({ type: "ann_clear", chartId: this.chartId });
  }
  drawSeries(seriesId, data, options) {
    if (this.fallbackRenderer) {
      this.fallbackRenderer.drawSeries(seriesId, data, options);
      return;
    }
    this.helperRenderer.drawSeries(seriesId, data, options);
  }
  getLayout(data, options) {
    return this.helperRenderer.getLayout(data, options);
  }
  mapClientToData(clientX, clientY, data, options) {
    return this.helperRenderer.mapClientToData(clientX, clientY, data, options);
  }
  hitTest(clientX, clientY, data, options) {
    return this.helperRenderer.hitTest(clientX, clientY, data, options);
  }
  drawCrosshairAt(clientX, clientY, data, options) {
    if (this.fallbackRenderer) {
      this.fallbackRenderer.drawCrosshairAt(clientX, clientY, data, options);
      return;
    }
    this.postMessage({
      type: "overlay",
      chartId: this.chartId,
      payload: {
        clientX,
        clientY
      }
    });
  }
  resize() {
    if (this.fallbackRenderer) {
      this.fallbackRenderer.resize();
      this.syncHelperCanvasSize();
      return;
    }
    this.syncHelperCanvasSize();
    if (this.lastPayload) {
      this.postMessage({ type: "render", chartId: this.chartId, payload: this.lastPayload });
    }
  }
  destroy() {
    this.postMessage({ type: "destroy", chartId: this.chartId });
    this.clearAwaitingFrameWatchdog();
    if (this.ownsWorker)
      this.worker?.terminate();
    this.worker = null;
    this.fallbackRenderer?.destroy();
    this.helperRenderer.destroy();
  }
  getDebugModeLabel() {
    if (this.fallbackRenderer)
      return "canvas (worker-fallback)";
    const shared = this.sharedFrameBuffer ? "shared" : "msg";
    return `canvas-worker (${shared})`;
  }
  tryInitializeWorker() {
    if (typeof Worker === "undefined")
      return false;
    if (typeof OffscreenCanvas === "undefined")
      return false;
    const transferableCanvas = this.canvas;
    if (typeof transferableCanvas.transferControlToOffscreen !== "function") {
      return false;
    }
    try {
      const worker = this.injectedWorker ?? new Worker(this.resolveWorkerScriptUrl(), { type: "module" });
      const offscreen = transferableCanvas.transferControlToOffscreen();
      const initMessage = { type: "init", chartId: this.chartId, canvas: offscreen };
      worker.postMessage(initMessage, [offscreen]);
      this.worker = worker;
      this.ownsWorker = this.injectedWorker == null;
      this.worker.addEventListener("message", (ev) => {
        const d = ev.data;
        if (d && d.type === "frameDone" && d.chartId === this.chartId) {
          this.awaitingFrame = false;
          this.clearAwaitingFrameWatchdog();
          if (this.lastPayload) {
            this.postMessage({ type: "render", chartId: this.chartId, payload: this.lastPayload });
            this.awaitingFrame = true;
            this.armAwaitingFrameWatchdog();
          }
        }
      });
      if (this.canUseSharedMemory()) {
        this.sharedFrameBuffer = new SharedOhlcvFrameBuffer(0);
        this.sharedGeneration = -1;
      }
      return true;
    } catch {
      this.worker?.terminate();
      this.worker = null;
      this.sharedFrameBuffer = null;
      this.sharedGeneration = -1;
      return false;
    }
  }
  canUseSharedMemory() {
    if (typeof SharedArrayBuffer === "undefined")
      return false;
    if (typeof Atomics === "undefined")
      return false;
    if (typeof globalThis.crossOriginIsolated !== "boolean")
      return false;
    return globalThis.crossOriginIsolated;
  }
  postMessage(message, transfer) {
    if (!this.worker)
      return;
    try {
      if (transfer && transfer.length > 0) {
        this.worker.postMessage(message, transfer);
      } else {
        this.worker.postMessage(message);
      }
    } catch {
      try {
        this.worker.postMessage(message);
      } catch {}
    }
  }
  clearAwaitingFrameWatchdog() {
    if (this.awaitingFrameTimer == null)
      return;
    clearTimeout(this.awaitingFrameTimer);
    this.awaitingFrameTimer = null;
  }
  armAwaitingFrameWatchdog() {
    this.clearAwaitingFrameWatchdog();
    this.awaitingFrameTimer = setTimeout(() => {
      this.awaitingFrame = false;
      this.awaitingFrameTimer = null;
    }, 120);
  }
  resolvePrimaryData(snapshot) {
    const targetSeries = snapshot.primarySeriesId == null ? snapshot.series[0] : snapshot.series.find((series) => series.id === snapshot.primarySeriesId) ?? snapshot.series[0];
    if (!targetSeries) {
      return { data: [], startIndex: snapshot.viewport.startIndex };
    }
    if (targetSeries.visibleSlice) {
      const slice = targetSeries.visibleSlice;
      return {
        data: {
          time: slice.time,
          open: slice.open,
          high: slice.high,
          low: slice.low,
          close: slice.close,
          volume: slice.volume,
          length: slice.length
        },
        startIndex: Math.max(0, snapshot.viewport.startIndex - slice.globalOffset)
      };
    }
    return {
      data: targetSeries.data ?? [],
      startIndex: snapshot.viewport.startIndex
    };
  }
  resolveWorkerScriptUrl() {
    if (this.workerUrlOverride instanceof URL) {
      return this.workerUrlOverride;
    }
    if (typeof this.workerUrlOverride === "string" && this.workerUrlOverride.length > 0) {
      try {
        return new URL(this.workerUrlOverride, import.meta.url);
      } catch {}
    }
    const moduleUrl = new URL(import.meta.url);
    if (moduleUrl.pathname.includes("/src/demo/")) {
      return new URL("/src/renderer/worker/renderWorker.ts", moduleUrl.origin);
    }
    if (moduleUrl.pathname.includes("/src/renderer/worker/")) {
      return new URL("./renderWorker.ts", import.meta.url);
    }
    return new URL("./renderWorker.js", import.meta.url);
  }
  toWorkerPayload(snapshot) {
    const resolved = this.resolvePrimaryData(snapshot);
    const isSlice = snapshot.series[0]?.visibleSlice !== undefined;
    const workerStartIndex = isSlice ? resolved.startIndex : snapshot.viewport.startIndex;
    const normalizedHud = normalizeWorkerHudOverlaySnapshot(snapshot.hudOverlay);
    const hudOverlay = normalizedHud ? {
      ...normalizedHud,
      version: WORKER_HUD_OVERLAY_SCHEMA_VERSION
    } : undefined;
    return {
      schemaVersion: WORKER_RENDER_SCHEMA_VERSION,
      viewport: {
        startIndex: workerStartIndex,
        visibleCount: snapshot.viewport.visibleCount,
        rightMarginBars: snapshot.viewport.rightMarginBars
      },
      layout: {
        width: snapshot.layout.width,
        height: snapshot.layout.height,
        dpr: snapshot.layout.dpr
      },
      hudOverlay,
      data: resolved.data
    };
  }
  toSharedWorkerPayload(snapshot) {
    if (!this.worker || !this.sharedFrameBuffer)
      return null;
    this.publishState("shared");
    const resolved = this.resolvePrimaryData(snapshot);
    const startIndex = Math.max(0, Math.floor(resolved.startIndex));
    const visibleCount = Math.max(1, Math.floor(snapshot.viewport.visibleCount));
    let writeResult;
    if (resolved.data?.time instanceof Float64Array) {
      writeResult = this.sharedFrameBuffer.writeFrameFromColumnar(resolved.data, startIndex, visibleCount);
    } else {
      writeResult = this.sharedFrameBuffer.writeFrame(resolved.data, startIndex, visibleCount);
    }
    if (writeResult.resized || this.sharedGeneration !== this.sharedFrameBuffer.getGeneration()) {
      this.sharedGeneration = this.sharedFrameBuffer.getGeneration();
      this.postMessage({
        type: "initShared",
        chartId: this.chartId,
        descriptor: this.sharedFrameBuffer.getDescriptor()
      });
    }
    const normalizedHud = normalizeWorkerHudOverlaySnapshot(snapshot.hudOverlay);
    const hudOverlay = normalizedHud ? {
      ...normalizedHud,
      version: WORKER_HUD_OVERLAY_SCHEMA_VERSION
    } : undefined;
    return {
      schemaVersion: WORKER_RENDER_SCHEMA_VERSION,
      viewport: {
        startIndex: resolved.startIndex,
        visibleCount: snapshot.viewport.visibleCount,
        rightMarginBars: snapshot.viewport.rightMarginBars
      },
      layout: {
        width: snapshot.layout.width,
        height: snapshot.layout.height,
        dpr: snapshot.layout.dpr
      },
      hudOverlay,
      frameId: writeResult.frameId
    };
  }
  publishState(mode) {
    if (this.lastState === mode)
      return;
    this.lastState = mode;
    this.onStateChange?.(mode);
  }
  syncHelperCanvasSize(width, height, dpr) {
    const resolvedDpr = dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const resolvedWidth = Math.max(1, Math.floor(width ?? this.canvas.clientWidth ?? this.canvas.width ?? 800));
    const resolvedHeight = Math.max(1, Math.floor(height ?? this.canvas.clientHeight ?? this.canvas.height ?? 600));
    this.helperCanvas.style.width = `${resolvedWidth}px`;
    this.helperCanvas.style.height = `${resolvedHeight}px`;
    this.helperCanvas.width = Math.floor(resolvedWidth * resolvedDpr);
    this.helperCanvas.height = Math.floor(resolvedHeight * resolvedDpr);
    this.helperRenderer.resize();
  }
}

// src/util/typedArrayPool.ts
var float32Pools = new Map;
var float64Pools = new Map;
var uint16Pools = new Map;
function getPooledFloat32(size) {
  const bucket = float32Pools.get(size);
  if (bucket && bucket.length > 0)
    return bucket.pop();
  return new Float32Array(size);
}
function releasePooledFloat32(buf) {
  const size = buf.length;
  const bucket = float32Pools.get(size) || [];
  bucket.push(buf);
  float32Pools.set(size, bucket);
}
function getPooledFloat64(size) {
  const bucket = float64Pools.get(size);
  if (bucket && bucket.length > 0)
    return bucket.pop();
  return new Float64Array(size);
}
function releasePooledFloat64(buf) {
  const size = buf.length;
  const bucket = float64Pools.get(size) || [];
  bucket.push(buf);
  float64Pools.set(size, bucket);
}
function getPooledUint16(size) {
  const bucket = uint16Pools.get(size);
  if (bucket && bucket.length > 0)
    return bucket.pop();
  return new Uint16Array(size);
}
function releasePooledUint16(buf) {
  const size = buf.length;
  const bucket = uint16Pools.get(size) || [];
  bucket.push(buf);
  uint16Pools.set(size, bucket);
}

// src/util/float16.ts
function f32ToF16(val) {
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = val;
  const x = u32[0];
  const sign = x >> 16 & 32768;
  const mantissa = x & 8388607;
  const exp = x >> 23 & 255;
  if (exp === 255) {
    if (mantissa)
      return sign | 32256;
    return sign | 31744;
  }
  const halfExp = exp - 127 + 15;
  if (halfExp >= 31)
    return sign | 31744;
  if (halfExp <= 0) {
    if (halfExp < -10)
      return sign;
    let mant = mantissa | 8388608;
    const shift = 14 - halfExp;
    let halfMant = mant >> shift;
    if (mant >> shift - 1 & 1)
      halfMant += 1;
    return sign | halfMant;
  }
  let half = sign | halfExp << 10 | mantissa >> 13;
  if (mantissa & 4096)
    half += 1;
  return half & 65535;
}
function f16ToF32(bits) {
  const s = (bits & 32768) >> 15;
  const e = (bits & 31744) >> 10;
  const f = bits & 1023;
  let out;
  if (e === 0) {
    if (f === 0) {
      out = s ? -0 : 0;
    } else {
      out = (s ? -1 : 1) * f * Math.pow(2, -24);
    }
  } else if (e === 31) {
    out = f ? NaN : s ? -Infinity : Infinity;
  } else {
    out = (s ? -1 : 1) * (1 + f / 1024) * Math.pow(2, e - 15);
  }
  return out;
}
function f32ArrayToF16Buffer(src) {
  const out = new Uint16Array(src.length);
  for (let i = 0;i < src.length; i++)
    out[i] = f32ToF16(src[i]);
  return out;
}
function f16BufferToF32Array(src) {
  const out = new Float32Array(src.length);
  for (let i = 0;i < src.length; i++)
    out[i] = f16ToF32(src[i]);
  return out;
}

// src/data/columnarStore.ts
class ColumnarOHLCV {
  _capacity;
  _length = 0;
  _chunkSize = 2048;
  _time;
  _open;
  _high;
  _low;
  _close;
  _volume;
  _closeQuantized = null;
  _closeQuantScale = 1;
  _closeFloat16 = null;
  _closeChunkQuant = [];
  _closeChunkScale = [];
  _closeChunkOffset = [];
  constructor(initialCapacity = 0) {
    this._capacity = Math.max(0, initialCapacity | 0);
    this._time = getPooledFloat64(this._capacity);
    this._open = getPooledFloat32(this._capacity);
    this._high = getPooledFloat32(this._capacity);
    this._low = getPooledFloat32(this._capacity);
    this._close = getPooledFloat32(this._capacity);
    this._volume = getPooledFloat32(this._capacity);
  }
  setChunkSize(size) {
    this._chunkSize = Math.max(1, size | 0);
  }
  get length() {
    return this._length;
  }
  get capacity() {
    return this._capacity;
  }
  get time() {
    return this._time.subarray(0, this._length);
  }
  get open() {
    return this._open.subarray(0, this._length);
  }
  get high() {
    return this._high.subarray(0, this._length);
  }
  get low() {
    return this._low.subarray(0, this._length);
  }
  get close() {
    return this._close.subarray(0, this._length);
  }
  get volume() {
    return this._volume.subarray(0, this._length);
  }
  setData(data) {
    this.ensureCapacity(data.length);
    this._length = data.length;
    for (let i = 0;i < data.length; i++) {
      const point = data[i];
      this._time[i] = point.time;
      this._open[i] = point.open;
      this._high[i] = point.high;
      this._low[i] = point.low;
      this._close[i] = point.close;
      this._volume[i] = point.volume;
    }
  }
  push(point) {
    this.ensureCapacity(this._length + 1);
    const i = this._length;
    this._time[i] = point.time;
    this._open[i] = point.open;
    this._high[i] = point.high;
    this._low[i] = point.low;
    this._close[i] = point.close;
    this._volume[i] = point.volume;
    this._length = i + 1;
  }
  pushRaw(time, open, high, low, close, volume) {
    this.ensureCapacity(this._length + 1);
    const i = this._length;
    this._time[i] = time;
    this._open[i] = open;
    this._high[i] = high;
    this._low[i] = low;
    this._close[i] = close;
    this._volume[i] = volume;
    this._length = i + 1;
  }
  appendOrUpdateLastRaw(time, open, high, low, close, volume) {
    const lastIndex = this._length - 1;
    if (lastIndex < 0 || this._time[lastIndex] !== time) {
      this.pushRaw(time, open, high, low, close, volume);
      return true;
    }
    this._open[lastIndex] = open;
    this._high[lastIndex] = high;
    this._low[lastIndex] = low;
    this._close[lastIndex] = close;
    this._volume[lastIndex] = volume;
    return false;
  }
  getLastPoint() {
    if (this._length === 0)
      return null;
    const i = this._length - 1;
    return {
      time: this._time[i],
      open: this._open[i],
      high: this._high[i],
      low: this._low[i],
      close: this._close[i],
      volume: this._volume[i]
    };
  }
  appendOrUpdateLast(point) {
    const lastIndex = this._length - 1;
    if (lastIndex < 0 || this._time[lastIndex] !== point.time) {
      this.push(point);
      return true;
    }
    this._open[lastIndex] = point.open;
    this._high[lastIndex] = point.high;
    this._low[lastIndex] = point.low;
    this._close[lastIndex] = point.close;
    this._volume[lastIndex] = point.volume;
    return false;
  }
  getAt(index) {
    if (index < 0 || index >= this._length)
      return null;
    return {
      time: this._time[index],
      open: this._open[index],
      high: this._high[index],
      low: this._low[index],
      close: this._close[index],
      volume: this._volume[index]
    };
  }
  setAt(index, point) {
    if (index < 0 || index >= this._length)
      return false;
    this._time[index] = point.time;
    this._open[index] = point.open;
    this._high[index] = point.high;
    this._low[index] = point.low;
    this._close[index] = point.close;
    this._volume[index] = point.volume;
    return true;
  }
  spliceEnd(data) {
    if (data.length === 0)
      return;
    const overwriteStart = Math.max(0, this._length - data.length);
    const newLength = overwriteStart + data.length;
    this.ensureCapacity(newLength);
    for (let i = 0;i < data.length; i++) {
      const dst = overwriteStart + i;
      const point = data[i];
      this._time[dst] = point.time;
      this._open[dst] = point.open;
      this._high[dst] = point.high;
      this._low[dst] = point.low;
      this._close[dst] = point.close;
      this._volume[dst] = point.volume;
    }
    this._length = newLength;
  }
  sliceView(start, count) {
    const clampedStart = Math.max(0, Math.min(this._length, start | 0));
    const safeCount = Math.max(0, count | 0);
    const end = Math.max(clampedStart, Math.min(this._length, clampedStart + safeCount));
    return {
      time: this._time.subarray(clampedStart, end),
      open: this._open.subarray(clampedStart, end),
      high: this._high.subarray(clampedStart, end),
      low: this._low.subarray(clampedStart, end),
      close: this._close.subarray(clampedStart, end),
      volume: this._volume.subarray(clampedStart, end),
      length: end - clampedStart,
      globalOffset: clampedStart
    };
  }
  toArray() {
    const out = new Array(this._length);
    for (let i = 0;i < this._length; i++) {
      out[i] = {
        time: this._time[i],
        open: this._open[i],
        high: this._high[i],
        low: this._low[i],
        close: this._close[i],
        volume: this._volume[i]
      };
    }
    return out;
  }
  ensureCapacity(required) {
    if (required <= this._capacity)
      return;
    let nextCapacity = Math.max(1, this._capacity);
    while (nextCapacity < required) {
      nextCapacity *= 2;
    }
    const nextTime = getPooledFloat64(nextCapacity);
    const nextOpen = getPooledFloat32(nextCapacity);
    const nextHigh = getPooledFloat32(nextCapacity);
    const nextLow = getPooledFloat32(nextCapacity);
    const nextClose = getPooledFloat32(nextCapacity);
    const nextVolume = getPooledFloat32(nextCapacity);
    nextTime.set(this._time.subarray(0, this._length));
    nextOpen.set(this._open.subarray(0, this._length));
    nextHigh.set(this._high.subarray(0, this._length));
    nextLow.set(this._low.subarray(0, this._length));
    nextClose.set(this._close.subarray(0, this._length));
    nextVolume.set(this._volume.subarray(0, this._length));
    releasePooledFloat64(this._time);
    releasePooledFloat32(this._open);
    releasePooledFloat32(this._high);
    releasePooledFloat32(this._low);
    releasePooledFloat32(this._close);
    releasePooledFloat32(this._volume);
    this._time = nextTime;
    this._open = nextOpen;
    this._high = nextHigh;
    this._low = nextLow;
    this._close = nextClose;
    this._volume = nextVolume;
    this._capacity = nextCapacity;
  }
  quantizeCloseToUint16(scale, offset = 0) {
    if (this._closeQuantized) {
      this._closeQuantScale = scale;
    } else {
      this._closeQuantized = getPooledUint16(this._capacity);
      this._closeQuantScale = scale;
    }
    const q = this._closeQuantized;
    for (let i = 0;i < this._length; i++) {
      const v = Math.round((this._close[i] - offset) * scale);
      q[i] = v < 0 ? 0 : v > 65535 ? 65535 : v;
    }
  }
  dequantizeCloseFromUint16(offset = 0) {
    const q = this._closeQuantized;
    if (!q)
      return false;
    const scale = this._closeQuantScale;
    for (let i = 0;i < this._length; i++) {
      this._close[i] = q[i] / scale + offset;
    }
    return true;
  }
  freeQuantizedClose() {
    if (!this._closeQuantized)
      return;
    releasePooledUint16(this._closeQuantized);
    this._closeQuantized = null;
    this._closeQuantScale = 1;
  }
  quantizeCloseToFloat16() {
    if (this._closeFloat16)
      return;
    const arr = this._close.subarray(0, this._length);
    const f16 = f32ArrayToF16Buffer(arr);
    this._closeFloat16 = f16;
  }
  dequantizeCloseFromFloat16() {
    if (!this._closeFloat16)
      return false;
    const f32 = f16BufferToF32Array(this._closeFloat16);
    this._close.set(f32.subarray(0, this._length));
    return true;
  }
  freeFloat16Close() {
    this._closeFloat16 = null;
  }
  estimateCloseQuantization(bits = 16, margin = 0) {
    const len = this._length;
    if (len === 0)
      return { scale: 1, offset: 0, min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    const close = this._close;
    for (let i = 0;i < len; i++) {
      const v = close[i];
      if (v < min)
        min = v;
      if (v > max)
        max = v;
    }
    const range = Math.max(0, max - min);
    const levels = (1 << bits) - 1;
    const adjRange = range * (1 + margin);
    const scale = adjRange > 0 ? levels / adjRange : 1;
    const offset = min - (adjRange - range) / 2;
    return { scale, offset, min, max };
  }
  quantizeCloseAuto(bits = 16, margin = 0, lowP = 0.01, highP = 0.99) {
    const { scale, offset } = this.estimateCloseQuantizationPercentile(bits, lowP, highP, margin);
    this.quantizeCloseToUint16(scale, offset);
    return { scale, offset };
  }
  quantizeClosePerChunk(bits = 16, margin = 0, lowP = 0.01, highP = 0.99) {
    this.freeChunkQuantization();
    const len = this._length;
    if (len === 0)
      return;
    const chunk = this._chunkSize;
    const chunks = Math.ceil(len / chunk);
    this._closeChunkQuant = new Array(chunks).fill(null);
    this._closeChunkScale = new Array(chunks).fill(1);
    this._closeChunkOffset = new Array(chunks).fill(0);
    for (let c = 0;c < chunks; c++) {
      const s = c * chunk;
      const e = Math.min(len, s + chunk);
      const count = e - s;
      if (count <= 0)
        continue;
      const tmp = getPooledFloat32(count);
      tmp.set(this._close.subarray(s, e));
      tmp.sort();
      const iLow = Math.floor(Math.max(0, Math.min(count - 1, Math.floor(count * lowP))));
      const iHigh = Math.floor(Math.max(0, Math.min(count - 1, Math.floor(count * highP))));
      const min = tmp[iLow];
      const max = tmp[iHigh];
      releasePooledFloat32(tmp);
      const range = Math.max(0, max - min);
      const levels = (1 << bits) - 1;
      const adjRange = range * (1 + margin);
      const scale = adjRange > 0 ? levels / adjRange : 1;
      const offset = min - (adjRange - range) / 2;
      const qbuf = getPooledUint16(count);
      const raw = this._close;
      for (let i = 0;i < count; i++) {
        const v = Math.round((raw[s + i] - offset) * scale);
        qbuf[i] = v < 0 ? 0 : v > 65535 ? 65535 : v;
      }
      this._closeChunkQuant[c] = qbuf;
      this._closeChunkScale[c] = scale;
      this._closeChunkOffset[c] = offset;
    }
  }
  dequantizeChunk(c) {
    if (!this._closeChunkQuant || c < 0 || c >= this._closeChunkQuant.length)
      return false;
    const q = this._closeChunkQuant[c];
    if (!q)
      return false;
    const scale = this._closeChunkScale[c];
    const offset = this._closeChunkOffset[c];
    const s = c * this._chunkSize;
    const count = Math.min(this._chunkSize, this._length - s);
    try {
      const raw = globalThis.__MOCHART_WASM_RAW_EXPORTS__;
      if (raw && typeof raw.dequantize_into_c === "function" && raw.memory && raw.memory.buffer) {
        const buf = raw.memory.buffer;
        if (q.buffer === buf && this._close.buffer === buf) {
          const closeByteOffset = this._close.byteOffset >>> 0;
          const quantByteOffset = q.byteOffset >>> 0;
          raw.dequantize_into_c(closeByteOffset, this._length, s, quantByteOffset, count, scale, offset);
          return true;
        }
      }
    } catch (e) {}
    for (let i = 0;i < count; i++) {
      this._close[s + i] = q[i] / scale + offset;
    }
    return true;
  }
  dequantizeRange(start, count) {
    const len = this._length;
    if (count <= 0 || start >= len)
      return;
    const s = Math.max(0, start | 0);
    const e = Math.min(len, s + (count | 0));
    const chunkStart = Math.floor(s / this._chunkSize);
    const chunkEnd = Math.floor((e - 1) / this._chunkSize);
    for (let c = chunkStart;c <= chunkEnd; c++)
      this.dequantizeChunk(c);
  }
  freeChunkQuantization() {
    if (!this._closeChunkQuant)
      return;
    for (let i = 0;i < this._closeChunkQuant.length; i++) {
      const q = this._closeChunkQuant[i];
      if (q)
        releasePooledUint16(q);
    }
    this._closeChunkQuant = [];
    this._closeChunkScale = [];
    this._closeChunkOffset = [];
  }
  estimateCloseQuantizationPercentile(bits = 16, lowP = 0.01, highP = 0.99, margin = 0) {
    const len = this._length;
    if (len === 0)
      return { scale: 1, offset: 0, min: 0, max: 0 };
    const tmp = getPooledFloat32(len);
    tmp.set(this._close.subarray(0, len));
    tmp.sort();
    const iLow = Math.floor(Math.max(0, Math.min(len - 1, Math.floor(len * lowP))));
    const iHigh = Math.floor(Math.max(0, Math.min(len - 1, Math.floor(len * highP))));
    const min = tmp[iLow];
    const max = tmp[iHigh];
    releasePooledFloat32(tmp);
    const range = Math.max(0, max - min);
    const levels = (1 << bits) - 1;
    const adjRange = range * (1 + margin);
    const scale = adjRange > 0 ? levels / adjRange : 1;
    const offset = min - (adjRange - range) / 2;
    return { scale, offset, min, max };
  }
  estimateCloseMemoryUsage() {
    const floatBytes = this._capacity * 4;
    const quantBytes = this._capacity * 2;
    return { floatBytes, quantBytes, savingBytes: floatBytes - quantBytes };
  }
}

// src/data/backpressure.ts
class FrameAlignedSampler {
  onEmit;
  latestBySeriesId = new Map;
  pendingBySeriesId = new Map;
  frameRequest = null;
  constructor(onEmit) {
    this.onEmit = onEmit;
  }
  push(seriesId, value) {
    this.latestBySeriesId.set(seriesId, value);
    this.scheduleEmit();
  }
  size() {
    return this.latestBySeriesId.size;
  }
  clear() {
    this.latestBySeriesId.clear();
  }
  destroy() {
    if (this.frameRequest != null) {
      if (typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.frameRequest);
      } else {
        clearTimeout(this.frameRequest);
      }
      this.frameRequest = null;
    }
    this.latestBySeriesId.clear();
  }
  scheduleEmit() {
    if (this.frameRequest != null)
      return;
    if (typeof requestAnimationFrame === "function") {
      this.frameRequest = requestAnimationFrame(() => {
        this.frameRequest = null;
        this.flush();
      });
      return;
    }
    this.frameRequest = setTimeout(() => {
      this.frameRequest = null;
      this.flush();
    }, 16);
  }
  flush() {
    if (this.latestBySeriesId.size === 0)
      return;
    const pending = this.pendingBySeriesId;
    pending.clear();
    for (const [seriesId, value] of this.latestBySeriesId) {
      pending.set(seriesId, value);
    }
    this.latestBySeriesId.clear();
    for (const [seriesId, value] of pending) {
      this.onEmit(seriesId, value);
    }
    pending.clear();
  }
}

// src/data/prefetcher.ts
class DataPrefetcher {
  onRequest;
  samples;
  sampleHead = 0;
  sampleCount = 0;
  lastRequestedAt = Number.NEGATIVE_INFINITY;
  sampleSize;
  minVelocityBarsPerMs;
  lookaheadMs;
  minBars;
  maxBars;
  cooldownMs;
  nowProvider;
  constructor(onRequest, options) {
    this.onRequest = onRequest;
    this.sampleSize = Math.max(2, options?.sampleSize ?? 5);
    this.minVelocityBarsPerMs = Math.max(0, options?.minVelocityBarsPerMs ?? 0.02);
    this.lookaheadMs = Math.max(16, options?.lookaheadMs ?? 250);
    this.minBars = Math.max(1, options?.minBars ?? 20);
    this.maxBars = Math.max(this.minBars, options?.maxBars ?? 800);
    this.cooldownMs = Math.max(0, options?.cooldownMs ?? 120);
    this.nowProvider = options?.nowProvider ?? (() => Date.now());
    this.samples = new Array(this.sampleSize);
  }
  recordPan(deltaBars) {
    const now = this.nowProvider();
    const writeIndex = this.sampleHead;
    this.samples[writeIndex] = { deltaBars, at: now };
    this.sampleHead = (writeIndex + 1) % this.sampleSize;
    if (this.sampleCount < this.sampleSize) {
      this.sampleCount++;
    }
    if (this.sampleCount < 2)
      return;
    const firstIndex = this.sampleCount === this.sampleSize ? this.sampleHead : 0;
    const lastIndex = (this.sampleHead + this.sampleSize - 1) % this.sampleSize;
    const first = this.samples[firstIndex];
    const last = this.samples[lastIndex];
    if (!first || !last)
      return;
    const dt = last.at - first.at;
    if (dt <= 0)
      return;
    let deltaSum = 0;
    for (let offset = 0;offset < this.sampleCount; offset++) {
      const index = (firstIndex + offset) % this.sampleSize;
      const sample = this.samples[index];
      if (!sample)
        continue;
      deltaSum += sample.deltaBars;
    }
    const velocity = deltaSum / dt;
    if (Math.abs(velocity) < this.minVelocityBarsPerMs)
      return;
    if (now - this.lastRequestedAt < this.cooldownMs)
      return;
    const predictedBarsRaw = Math.round(Math.abs(velocity) * this.lookaheadMs);
    const bars = Math.max(this.minBars, Math.min(this.maxBars, predictedBarsRaw));
    const direction = velocity >= 0 ? "right" : "left";
    this.lastRequestedAt = now;
    this.onRequest({ direction, bars, velocityBarsPerMs: velocity });
  }
  reset() {
    this.sampleHead = 0;
    this.sampleCount = 0;
    this.lastRequestedAt = Number.NEGATIVE_INFINITY;
  }
}

// src/data/ringBuffer.ts
class TickRingBuffer {
  _capacity;
  _time;
  _open;
  _high;
  _low;
  _close;
  _volume;
  _head = 0;
  _tail = 0;
  _count = 0;
  constructor(capacity = 2048) {
    this._capacity = Math.max(1, capacity | 0);
    this._time = new Float64Array(this._capacity);
    this._open = new Float32Array(this._capacity);
    this._high = new Float32Array(this._capacity);
    this._low = new Float32Array(this._capacity);
    this._close = new Float32Array(this._capacity);
    this._volume = new Float32Array(this._capacity);
  }
  size() {
    return this._count;
  }
  clear() {
    this._head = 0;
    this._tail = 0;
    this._count = 0;
  }
  push(point) {
    const i = this._head;
    this._time[i] = point.time;
    this._open[i] = point.open;
    this._high[i] = point.high;
    this._low[i] = point.low;
    this._close[i] = point.close;
    this._volume[i] = point.volume;
    this._head = (i + 1) % this._capacity;
    if (this._count === this._capacity) {
      this._tail = (this._tail + 1) % this._capacity;
      return;
    }
    this._count++;
  }
  drainTo(target) {
    let drained = 0;
    while (this._count > 0) {
      const i = this._tail;
      target.appendOrUpdateLastRaw(this._time[i], this._open[i], this._high[i], this._low[i], this._close[i], this._volume[i]);
      this._tail = (i + 1) % this._capacity;
      this._count--;
      drained++;
    }
    return drained;
  }
  drain(consumer) {
    let drained = 0;
    while (this._count > 0) {
      const i = this._tail;
      consumer({
        time: this._time[i],
        open: this._open[i],
        high: this._high[i],
        low: this._low[i],
        close: this._close[i],
        volume: this._volume[i]
      });
      this._tail = (i + 1) % this._capacity;
      this._count--;
      drained++;
    }
    return drained;
  }
}

// src/core/chartCore.ts
class ChartCore {
  static INDICATOR_NULL_SENTINEL_THRESHOLD = -100000000000000000000000000000;
  container;
  options;
  renderer = null;
  interactionRenderer = null;
  interactionOverlayCanvas = null;
  adapter = null;
  store;
  scheduler;
  perfTracker = new PerformanceTracker;
  batching = false;
  batchedActions = [];
  currentOverlay = null;
  realtimeFlushScheduled = false;
  realtimeSampler = null;
  prefetcher = null;
  rendererDebugEl = null;
  lifecycleDisposers = [];
  indicatorComputeStore = new IndicatorComputeStore;
  indicatorRegistry = new InMemoryIndicatorRegistry;
  indicatorInstances = [];
  indicatorRecomputeScheduled = false;
  indicatorRecomputeKey = "";
  indicatorRecomputeVersion = 0;
  hudOverlaySnapshotProvider = null;
  overlayRevisionProvider = null;
  overlayPrimitivesProvider = null;
  workerRendererState = null;
  seriesStore = new Map;
  getEffectiveRightMarginBars(len, start, visibleCount) {
    const { rightMargin, startIndex, visibleCount: vc } = this.store.getState().viewport;
    if (rightMargin <= 0)
      return 0;
    const dataLen = typeof len === "number" ? len : this.getDataLength();
    const from = typeof start === "number" ? start : startIndex;
    const visible = typeof visibleCount === "number" ? visibleCount : vc;
    const maxStartNoMargin = Math.max(0, dataLen - visible);
    const atLatestEdge = from >= maxStartNoMargin - 0.001;
    return atLatestEdge ? rightMargin : 0;
  }
  isViewportRenderer(renderer) {
    return typeof renderer.getLayout === "function";
  }
  getViewportRenderer() {
    if (this.renderer && this.isViewportRenderer(this.renderer))
      return this.renderer;
    return this.interactionRenderer;
  }
  ensureInteractionRenderer(baseCanvas) {
    if (this.interactionRenderer)
      return;
    const ownerDocument = this.container.ownerDocument ?? document;
    const overlayCanvas = ownerDocument.createElement("canvas");
    const containerIsCanvas = this.container.tagName.toLowerCase() === "canvas";
    overlayCanvas.style.width = baseCanvas.style.width || `${baseCanvas.clientWidth || baseCanvas.width}px`;
    overlayCanvas.style.height = baseCanvas.style.height || `${baseCanvas.clientHeight || baseCanvas.height}px`;
    if (!containerIsCanvas) {
      const style = typeof getComputedStyle === "function" ? getComputedStyle(this.container) : null;
      if (!style || !style.position || style.position === "static") {
        this.container.style.position = "relative";
      }
      overlayCanvas.style.position = "absolute";
      overlayCanvas.style.left = "0";
      overlayCanvas.style.top = "0";
      overlayCanvas.style.width = "100%";
      overlayCanvas.style.height = "100%";
      overlayCanvas.style.pointerEvents = "none";
      overlayCanvas.style.zIndex = "2";
      this.container.appendChild(overlayCanvas);
      this.interactionOverlayCanvas = overlayCanvas;
    }
    this.interactionRenderer = new CanvasRenderer(containerIsCanvas ? baseCanvas : overlayCanvas);
  }
  clearInteractionOverlay() {
    if (!this.interactionOverlayCanvas || !this.interactionRenderer)
      return;
    const renderer = this.interactionRenderer;
    const snapshot = this.buildRenderSnapshot();
    if (typeof renderer.clearOverlay === "function") {
      renderer.clearOverlay(snapshot);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.interactionOverlayCanvas.getContext("2d");
    if (!ctx)
      return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.interactionOverlayCanvas.width / dpr, this.interactionOverlayCanvas.height / dpr);
  }
  listeners = new Map;
  constructor(container, options) {
    if (!container)
      throw new Error("Container element required");
    this.container = container;
    this.options = options ?? {};
    this.store = new ChartStore({
      layout: {
        width: (this.options.width ?? container.clientWidth) || 800,
        height: (this.options.height ?? container.clientHeight) || 600,
        dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
      }
    });
    this.perfTracker.setEnabled(this.options.enablePerformanceMetrics ?? false);
    this.scheduler = new RenderScheduler((actions) => {
      let changed = false;
      for (const action of actions) {
        changed = this.store.dispatch(action) || changed;
      }
      if (changed) {
        this.emitRangeChanged();
      }
      return changed;
    }, () => this.redraw(), this.perfTracker);
    try {
      const existingCanvas = this.container.tagName.toLowerCase() === "canvas" ? this.container : this.container.querySelector("canvas");
      const canvas = existingCanvas || this.createCanvas();
      this.renderer = this.createRenderer(canvas);
      this.updateRendererDebugBadge();
    } catch (e) {
      console.warn("Renderer init failed", e);
      try {
        const existingCanvas = this.container.tagName.toLowerCase() === "canvas" ? this.container : this.container.querySelector("canvas");
        const canvas = existingCanvas || this.createCanvas();
        this.renderer = new CanvasRenderer(canvas);
        this.interactionRenderer = null;
        this.interactionOverlayCanvas = null;
        this.updateRendererDebugBadge();
      } catch {
        this.renderer = null;
        this.interactionRenderer = null;
        this.interactionOverlayCanvas = null;
      }
    }
    registerPhase1Indicators(this.indicatorRegistry);
    registerPhase2Indicators(this.indicatorRegistry);
    registerPhase3Indicators(this.indicatorRegistry);
    registerPhase4Indicators(this.indicatorRegistry);
  }
  setIndicators(instances) {
    this.indicatorInstances = instances.slice();
    this.indicatorRecomputeKey = "";
    this.scheduleIndicatorRecompute();
  }
  getIndicators() {
    return this.indicatorInstances;
  }
  setHudOverlaySnapshotProvider(provider) {
    this.hudOverlaySnapshotProvider = provider;
  }
  setOverlayPrimitiveProviders(revisionProvider, primitivesProvider) {
    this.overlayRevisionProvider = revisionProvider;
    this.overlayPrimitivesProvider = primitivesProvider;
  }
  scheduleIndicatorRecompute() {
    if (this.indicatorRecomputeScheduled)
      return;
    this.indicatorRecomputeScheduled = true;
    const version = ++this.indicatorRecomputeVersion;
    queueMicrotask(() => {
      this.recomputeIndicatorSegments(version);
    });
  }
  buildIndicatorRecomputeKey() {
    const dataVersion = this.store.getState().data.version;
    const primaryLength = this.getPrimaryColumnar()?.length ?? 0;
    const indicatorsKey = this.indicatorInstances.map((instance) => `${instance.instanceId}:${instance.id}:${JSON.stringify(instance.params ?? {})}:${instance.enabled !== false ? 1 : 0}`).join("|");
    const gpuKey = "cpu";
    return `${dataVersion}|${primaryLength}|${gpuKey}|${indicatorsKey}`;
  }
  async recomputeIndicatorSegments(version) {
    this.indicatorRecomputeScheduled = false;
    if (version !== this.indicatorRecomputeVersion)
      return;
    if (!this.renderer)
      return;
    const hasIndicators = this.indicatorInstances.length > 0;
    const hasLineSeries = Array.from(this.seriesStore.entries()).some(([id, s]) => s.options.type === "line" && id !== this.getPrimarySeriesId());
    if (!hasIndicators && !hasLineSeries)
      return;
    const key = this.buildIndicatorRecomputeKey();
    if (key === this.indicatorRecomputeKey)
      return;
    this.indicatorRecomputeKey = key;
    const data = this.getPrimaryColumnar();
    if (!data || data.length === 0)
      return;
    const drawableSeries = [];
    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false)
        continue;
      const definition = this.indicatorRegistry.get(instance.id);
      if (!definition)
        continue;
      const computed = await this.indicatorComputeStore.computeAsync(instance, definition, data);
      if (!computed.ok)
        continue;
      for (const output of definition.outputs) {
        if (output.style !== "line")
          continue;
        const values = computed.value[output.name];
        if (!values || values.length === 0)
          continue;
        drawableSeries.push({
          values,
          color: this.parseColorToRgba(output.color)
        });
      }
    }
    for (const [id, entry] of this.seriesStore.entries()) {
      if (entry.options.type === "line" && id !== this.getPrimarySeriesId()) {
        drawableSeries.push({
          values: entry.columnar.close,
          color: this.parseColorToRgba(entry.options.color || "#ffffff")
        });
      }
    }
    if (version !== this.indicatorRecomputeVersion)
      return;
    this.redraw();
  }
  parseColorToRgba(color) {
    const fallback = [0.3059, 0.8039, 0.7686, 1];
    if (!color)
      return fallback;
    if (color[0] === "#") {
      if (color.length === 7) {
        const r2 = Number.parseInt(color.slice(1, 3), 16);
        const g2 = Number.parseInt(color.slice(3, 5), 16);
        const b2 = Number.parseInt(color.slice(5, 7), 16);
        if (Number.isFinite(r2) && Number.isFinite(g2) && Number.isFinite(b2)) {
          return [r2 / 255, g2 / 255, b2 / 255, 1];
        }
      }
      if (color.length === 4) {
        const r2 = Number.parseInt(color[1] + color[1], 16);
        const g2 = Number.parseInt(color[2] + color[2], 16);
        const b2 = Number.parseInt(color[3] + color[3], 16);
        if (Number.isFinite(r2) && Number.isFinite(g2) && Number.isFinite(b2)) {
          return [r2 / 255, g2 / 255, b2 / 255, 1];
        }
      }
      return fallback;
    }
    const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbaMatch)
      return fallback;
    const parts = rgbaMatch[1].split(",").map((part) => Number(part.trim()));
    if (parts.length < 3)
      return fallback;
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts.length >= 4 ? parts[3] : 1;
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a)) {
      return fallback;
    }
    const norm = (value) => {
      if (value > 1)
        return Math.max(0, Math.min(1, value / 255));
      return Math.max(0, Math.min(1, value));
    };
    return [norm(r), norm(g), norm(b), Math.max(0, Math.min(1, a))];
  }
  createRenderer(canvas) {
    const backend = this.options.renderer ?? "auto";
    if (backend === "canvas-worker") {
      return new WorkerCanvasRenderer(canvas, {
        workerUrl: this.options.workerUrl,
        sharedWorker: this.options.sharedRenderWorker,
        onStateChange: (mode) => {
          const payload = {
            mode,
            label: mode === "fallback" ? "canvas (worker-fallback)" : `canvas-worker (${mode})`
          };
          this.workerRendererState = payload;
          this.emit("workerRendererStateChanged", payload);
        }
      });
    }
    return new CanvasRenderer(canvas);
  }
  canUseCanvasWorker(canvas) {
    if (typeof Worker === "undefined")
      return false;
    if (typeof OffscreenCanvas === "undefined")
      return false;
    return typeof canvas.transferControlToOffscreen === "function";
  }
  registerLifecycleDisposer(disposer) {
    this.lifecycleDisposers.push(disposer);
  }
  onHostResize(width, height, dpr) {
    this.enqueueAction({
      type: ActionType.RESIZE,
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
      dpr
    });
  }
  onHostVisibilityChange(isVisible) {
    if (isVisible) {
      this.scheduler.resume();
      return;
    }
    this.scheduler.pause();
  }
  getOrCreateRealtimeSampler() {
    if (!this.realtimeSampler) {
      this.realtimeSampler = new FrameAlignedSampler((seriesId, point) => {
        const entry = this.seriesStore.get(seriesId);
        if (!entry)
          return;
        this.getOrCreateRealtimeBuffer(entry).push(point);
        this.scheduleRealtimeFlush();
      });
    }
    return this.realtimeSampler;
  }
  getOrCreatePrefetcher() {
    if (!this.prefetcher) {
      this.prefetcher = new DataPrefetcher((signal) => {
        this.requestPrefetch(signal.direction, signal.bars, signal.velocityBarsPerMs);
      });
    }
    return this.prefetcher;
  }
  getOrCreateRealtimeBuffer(entry) {
    if (!entry.realtimeBuffer) {
      entry.realtimeBuffer = new TickRingBuffer;
    }
    return entry.realtimeBuffer;
  }
  enqueueAction(action) {
    if (this.batching) {
      this.batchedActions.push(action);
      return;
    }
    this.scheduler.enqueue(action);
  }
  enqueueActions(actions) {
    if (actions.length === 0)
      return;
    if (this.batching) {
      const len = actions.length;
      for (let i = 0;i < len; i++) {
        this.batchedActions.push(actions[i]);
      }
      return;
    }
    this.scheduler.enqueueBatch(actions);
  }
  batch(work) {
    this.batching = true;
    try {
      work();
    } finally {
      this.batching = false;
      if (this.batchedActions.length > 0) {
        this.scheduler.enqueueBatch(this.batchedActions);
        this.batchedActions = [];
      }
    }
  }
  on(event, cb) {
    const set = this.listeners.get(event) ?? new Set;
    set.add(cb);
    this.listeners.set(event, set);
  }
  off(event, cb) {
    if (!this.listeners.has(event))
      return;
    if (!cb) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.get(event).delete(cb);
  }
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set)
      return;
    for (const cb of set)
      cb(payload);
  }
  async connectFeed(adapter) {
    if (!adapter)
      throw new Error("Adapter required");
    if (typeof adapter.subscribe !== "function") {
      console.warn("Adapter does not implement subscribe/unsubscribe — storing adapter only");
      this.adapter = adapter;
      return;
    }
    this.adapter = adapter;
    for (const seriesId of this.seriesStore.keys()) {
      try {
        adapter.subscribe(seriesId, (point) => this.pushRealtime(seriesId, point));
      } catch (e) {
        console.warn("subscribe failed for", seriesId, e);
      }
    }
    this.emit("realtimeConnected");
  }
  async disconnectFeed() {
    const adapter = this.adapter;
    if (adapter && typeof adapter.unsubscribe === "function") {
      for (const seriesId of this.seriesStore.keys()) {
        try {
          adapter.unsubscribe(seriesId);
        } catch {}
      }
    }
    this.adapter = null;
    this.emit("realtimeDisconnected");
  }
  async addSeries(options) {
    const id = options.id ?? `series_${Math.random().toString(36).slice(2, 9)}`;
    if (this.seriesStore.has(id))
      throw new Error(`Series ${id} already exists`);
    this.seriesStore.set(id, {
      options,
      columnar: new ColumnarOHLCV(0),
      realtimeBuffer: null
    });
    this.emit("seriesAdded", { id, options });
    return id;
  }
  async setSeriesData(seriesId, data, partial = false) {
    const entry = this.seriesStore.get(seriesId);
    if (!entry)
      throw new Error(`Series ${seriesId} not found`);
    this.perfTracker.measure("upload", () => {
      if (data instanceof ColumnarOHLCV) {
        entry.columnar = data;
        entry.realtimeBuffer?.clear();
        this.applyDefaultViewport(data);
      } else if (partial) {
        entry.columnar.spliceEnd(data);
        entry.realtimeBuffer?.clear();
      } else {
        entry.columnar.setData(data);
        entry.realtimeBuffer?.clear();
        this.applyDefaultViewport(data);
      }
    });
    this.seriesStore.set(seriesId, entry);
    this.enqueueAction({ type: ActionType.SET_TOTAL_BARS, count: this.getDataLength() });
    this.scheduleIndicatorRecompute();
    this.emit("seriesUpdated", { seriesId, length: entry.columnar.length });
  }
  applyDefaultViewport(data) {
    const len = Array.isArray(data) ? data.length : data.length;
    if (len === 0)
      return;
    const defaultVisibleDays = this.options.defaultVisibleDays;
    const rightMarginDays = this.options.rightMarginDays ?? 0;
    let newVisibleCount, newStartIndex, newRightMargin;
    if (defaultVisibleDays && len >= 2) {
      const firstTime = Array.isArray(data) ? data[0].time : data.time[0];
      const lastTime = Array.isArray(data) ? data[len - 1].time : data.time[len - 1];
      const totalMs = lastTime - firstTime;
      const avgBarMs = totalMs / (len - 1);
      const msPerDay = 24 * 60 * 60 * 1000;
      const visibleBars = Math.ceil(defaultVisibleDays * msPerDay / avgBarMs);
      const marginBars = Math.ceil(rightMarginDays * msPerDay / avgBarMs);
      newVisibleCount = Math.min(len, visibleBars);
      newStartIndex = Math.max(0, len - visibleBars);
      newRightMargin = marginBars;
    } else {
      newVisibleCount = Math.min(200, len);
      newStartIndex = Math.max(0, len - newVisibleCount);
      newRightMargin = 0;
    }
    this.enqueueActions([
      {
        type: ActionType.SET_VIEWPORT,
        startIndex: newStartIndex,
        visibleCount: newVisibleCount
      },
      {
        type: ActionType.SET_RIGHT_MARGIN,
        rightMargin: newRightMargin
      }
    ]);
  }
  getDataLength() {
    let max = 0;
    for (const v of this.seriesStore.values()) {
      if (v.columnar.length > max)
        max = v.columnar.length;
    }
    return max;
  }
  createCanvas() {
    const c = document.createElement("canvas");
    const w = (this.options.width ?? this.container.clientWidth) || 800;
    const h = (this.options.height ?? this.container.clientHeight) || 600;
    c.style.width = w + "px";
    c.style.height = h + "px";
    this.container.appendChild(c);
    return c;
  }
  emitRangeChanged() {
    const len = this.getDataLength();
    if (len === 0)
      return;
    const { startIndex, visibleCount } = this.store.getState().viewport;
    const from = Math.max(0, Math.min(len - 1, Math.floor(startIndex)));
    const to = Math.max(0, Math.min(len - 1, from + visibleCount - 1));
    this.emit("rangeChanged", { from, to });
  }
  async updateSeries(seriesId, patch) {
    const entry = this.seriesStore.get(seriesId);
    if (!entry)
      throw new Error(`Series ${seriesId} not found`);
    for (const p of patch) {
      if (p.index < 0 || p.index >= entry.columnar.length)
        continue;
      entry.columnar.setAt(p.index, p.point);
    }
    this.emit("seriesUpdated", { seriesId, patch });
    this.enqueueAction({ type: ActionType.SET_TOTAL_BARS, count: this.getDataLength() });
    this.scheduleIndicatorRecompute();
  }
  async pushRealtime(seriesId, point) {
    if (!this.seriesStore.has(seriesId))
      throw new Error(`Series ${seriesId} not found`);
    this.getOrCreateRealtimeSampler().push(seriesId, point);
  }
  scheduleRealtimeFlush() {
    if (this.realtimeFlushScheduled)
      return;
    this.realtimeFlushScheduled = true;
    queueMicrotask(() => {
      this.realtimeFlushScheduled = false;
      this.flushRealtimeBuffers();
    });
  }
  flushRealtimeBuffers() {
    let hasAnyRealtime = false;
    for (const [seriesId, entry] of this.seriesStore.entries()) {
      const realtimeBuffer = entry.realtimeBuffer;
      if (!realtimeBuffer || realtimeBuffer.size() === 0)
        continue;
      hasAnyRealtime = true;
      const drained = realtimeBuffer.drainTo(entry.columnar);
      if (drained > 0) {
        const lastPoint = entry.columnar.getLastPoint();
        if (lastPoint) {
          this.emit("realtime", { seriesId, point: lastPoint, drained });
          this.emit("seriesUpdated", { seriesId, realtime: true, drained });
        }
      }
    }
    if (hasAnyRealtime) {
      this.enqueueAction({ type: ActionType.SET_TOTAL_BARS, count: this.getDataLength() });
      this.scheduleIndicatorRecompute();
    }
  }
  getVisibleRange() {
    const len = this.getDataLength();
    if (len === 0)
      return null;
    const { startIndex, visibleCount } = this.store.getState().viewport;
    const from = Math.max(0, Math.min(len - 1, Math.floor(startIndex)));
    const to = Math.max(0, Math.min(len - 1, from + visibleCount - 1));
    return { from, to, rightMarginBars: this.getEffectiveRightMarginBars(len, from, visibleCount) };
  }
  setVisibleRange(from, to) {
    const len = this.getDataLength();
    if (len === 0)
      return;
    const f = Math.max(0, Math.min(len - 1, from));
    const t = Math.max(0, Math.min(len - 1, to));
    this.enqueueAction({
      type: ActionType.SET_VIEWPORT,
      startIndex: f,
      visibleCount: Math.max(1, t - f + 1)
    });
  }
  setViewport(fromIndex, toIndex) {
    this.setVisibleRange(fromIndex, toIndex);
  }
  panBy(deltaIndex) {
    this.panByBars(deltaIndex);
  }
  panByBars(deltaBars) {
    this.enqueueAction({ type: ActionType.PAN, deltaBars });
    this.getOrCreatePrefetcher().recordPan(deltaBars);
  }
  requestPrefetch(direction, bars, velocityBarsPerMs) {
    const visible = this.getVisibleRange();
    if (!visible)
      return;
    const request = direction === "right" ? {
      direction,
      from: visible.to + 1,
      to: visible.to + bars,
      count: bars,
      velocityBarsPerMs
    } : {
      direction,
      from: Math.max(0, visible.from - bars),
      to: Math.max(0, visible.from - 1),
      count: bars,
      velocityBarsPerMs
    };
    this.emit("prefetchRequested", request);
    if (!this.adapter || typeof this.adapter.prefetch !== "function")
      return;
    for (const seriesId of this.seriesStore.keys()) {
      try {
        this.adapter.prefetch(seriesId, request);
      } catch (error) {
        console.warn("prefetch failed for", seriesId, error);
      }
    }
  }
  zoomAt(factor, centerIndex, centerRatio) {
    const len = this.getDataLength();
    if (len === 0)
      return;
    let centerX = 0.5;
    if (typeof centerRatio === "number") {
      centerX = centerRatio;
    } else if (typeof centerIndex === "number") {
      const { startIndex, visibleCount } = this.store.getState().viewport;
      centerX = (centerIndex - startIndex) / visibleCount;
    }
    this.enqueueAction({ type: ActionType.ZOOM, factor, centerX });
  }
  applyOptions(options) {
    Object.assign(this.options, options);
    if (options.width || options.height) {
      this.enqueueAction({
        type: ActionType.RESIZE,
        width: options.width ?? this.store.getState().layout.width,
        height: options.height ?? this.store.getState().layout.height,
        dpr: this.store.getState().layout.dpr
      });
    }
    this.updateRendererDebugBadge();
    this.emit("optionsChanged", this.options);
  }
  getRendererModeLabel() {
    const renderer = this.renderer;
    if (!renderer)
      return "none";
    if (renderer instanceof WorkerCanvasRenderer) {
      return renderer.getDebugModeLabel();
    }
    if (renderer instanceof CanvasRenderer) {
      return "canvas";
    }
    return "unknown";
  }
  updateRendererDebugBadge() {
    if (!this.options.debugRendererMode) {
      if (this.rendererDebugEl?.parentElement) {
        this.rendererDebugEl.parentElement.removeChild(this.rendererDebugEl);
      }
      this.rendererDebugEl = null;
      return;
    }
    let mode = this.getRendererModeLabel();
    if (!this.rendererDebugEl) {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.right = "8px";
      el.style.top = "8px";
      el.style.zIndex = "1200";
      el.style.pointerEvents = "none";
      el.style.font = "11px monospace";
      el.style.padding = "4px 6px";
      el.style.borderRadius = "4px";
      el.style.background = "rgba(0,0,0,0.72)";
      el.style.color = "#fff";
      if (this.container.ownerDocument?.defaultView?.getComputedStyle(this.container).position === "static") {
        this.container.style.position = "relative";
      }
      this.container.appendChild(el);
      this.rendererDebugEl = el;
    }
    this.rendererDebugEl.textContent = `renderer: ${mode}`;
  }
  getRawStartIndex() {
    return this.store.getState().viewport.startIndex;
  }
  getRendererMode() {
    return this.getRendererModeLabel();
  }
  getWorkerRendererState() {
    return this.workerRendererState;
  }
  getPrimarySeriesId() {
    const first = this.seriesStore.keys().next();
    return first.done ? null : first.value;
  }
  getPrimaryColumnar() {
    const id = this.getPrimarySeriesId();
    if (!id)
      return null;
    return this.seriesStore.get(id)?.columnar ?? null;
  }
  getPrimaryData() {
    const id = this.getPrimarySeriesId();
    if (!id)
      return [];
    const entry = this.seriesStore.get(id);
    return entry?.columnar.toArray() ?? [];
  }
  getPrimarySeriesOptions() {
    const id = this.getPrimarySeriesId();
    if (!id)
      return null;
    const entry = this.seriesStore.get(id);
    return entry?.options ?? null;
  }
  getSeriesEntry(seriesId) {
    const entry = this.seriesStore.get(seriesId);
    if (!entry)
      return null;
    return { options: entry.options, data: entry.columnar.toArray() };
  }
  getSeriesColumnar(seriesId) {
    const entry = this.seriesStore.get(seriesId);
    return entry?.columnar ?? null;
  }
  getLayout(options) {
    const renderer = this.getViewportRenderer();
    if (!renderer)
      return null;
    const data = this.getPrimaryColumnar();
    if (!data)
      return null;
    const { startIndex, visibleCount } = this.store.getState().viewport;
    const effectiveRightMargin = this.getEffectiveRightMarginBars();
    return renderer.getLayout(data, {
      startIndex,
      visibleCount,
      rightMarginBars: effectiveRightMargin,
      ...options
    });
  }
  mapClientToData(clientX, clientY, options) {
    return this.hitTest(clientX, clientY, options);
  }
  hitTest(clientX, clientY, options) {
    const renderer = this.getViewportRenderer();
    if (!renderer)
      return null;
    const data = this.getPrimaryColumnar();
    if (!data)
      return null;
    const { startIndex, visibleCount } = this.store.getState().viewport;
    const effectiveRightMargin = this.getEffectiveRightMarginBars();
    return renderer.hitTest(clientX, clientY, data, {
      startIndex,
      visibleCount,
      rightMarginBars: effectiveRightMargin,
      ...options
    });
  }
  drawCrosshair(clientX, clientY, options) {
    this.setCrosshairOverlay(clientX, clientY, options);
  }
  setCrosshairOverlay(clientX, clientY, options) {
    const renderer = this.getViewportRenderer();
    if (!renderer)
      return;
    this.currentOverlay = {
      type: "crosshair",
      clientX,
      clientY,
      options
    };
    if (renderer === this.interactionRenderer) {
      renderer.resize();
      this.clearInteractionOverlay();
    }
    const snapshot = this.buildRenderSnapshot();
    if (typeof renderer.renderOverlay === "function") {
      renderer.renderOverlay(snapshot, this.currentOverlay);
      return;
    }
    if (typeof renderer.drawCrosshairAt !== "function")
      return;
    const data = this.getPrimaryColumnar();
    if (!data)
      return;
    const { startIndex, visibleCount } = this.store.getState().viewport;
    const effectiveRightMargin = this.getEffectiveRightMarginBars();
    renderer.drawCrosshairAt(clientX, clientY, data, {
      startIndex,
      visibleCount,
      rightMarginBars: effectiveRightMargin,
      ...options
    });
  }
  clearOverlay() {
    this.currentOverlay = null;
    const renderer = this.getViewportRenderer();
    if (!renderer)
      return;
    if (renderer === this.interactionRenderer) {
      this.clearInteractionOverlay();
      return;
    }
    const snapshot = this.buildRenderSnapshot();
    if (typeof renderer.clearOverlay === "function") {
      renderer.clearOverlay(snapshot);
      return;
    }
    this.redraw();
  }
  buildRenderSnapshot() {
    const effectiveRightMarginBars = this.getEffectiveRightMarginBars();
    const { startIndex, visibleCount } = this.store.getState().viewport;
    const { width, height, dpr } = this.store.getState().layout;
    const startFloor = Math.floor(Math.max(0, startIndex));
    const series = [];
    for (const [id, entry] of this.seriesStore.entries()) {
      series.push({
        id,
        data: [],
        visibleSlice: entry.columnar.sliceView(startFloor, visibleCount + 1),
        options: entry.options
      });
    }
    return {
      viewport: {
        startIndex,
        visibleCount,
        rightMarginBars: effectiveRightMarginBars
      },
      layout: {
        width,
        height,
        dpr
      },
      hudOverlay: this.hudOverlaySnapshotProvider ? this.hudOverlaySnapshotProvider() : undefined,
      overlayRevision: this.overlayRevisionProvider ? this.overlayRevisionProvider() : 0,
      overlayPrimitives: this.overlayPrimitivesProvider ? this.overlayPrimitivesProvider() : undefined,
      primarySeriesId: this.getPrimarySeriesId(),
      series
    };
  }
  redraw() {
    this.perfTracker.measure("draw", () => {
      const renderer = this.renderer;
      if (!renderer)
        return;
      this.scheduleIndicatorRecompute();
      const snapshot = this.buildRenderSnapshot();
      renderer.render(snapshot);
      if (this.isViewportRenderer(renderer) && typeof renderer.drawSeries === "function") {
        const { startIndex, visibleCount } = snapshot.viewport;
        const effectiveRightMarginBars = snapshot.viewport.rightMarginBars;
        const primarySeriesId = this.getPrimarySeriesId();
        const primaryColumnar = primarySeriesId ? this.getSeriesColumnar(primarySeriesId) : null;
        const sharedLayout = primaryColumnar ? renderer.getLayout(primaryColumnar, {
          startIndex,
          visibleCount,
          rightMarginBars: effectiveRightMarginBars
        }) : null;
        for (const [seriesId, entry] of this.seriesStore.entries()) {
          const isPrimarySeries = seriesId === primarySeriesId;
          const useSharedScale = entry.options.independentScale !== true;
          try {
            renderer.drawSeries(seriesId, entry.columnar, {
              ...entry.options,
              startIndex,
              visibleCount,
              rightMarginBars: effectiveRightMarginBars,
              background: isPrimarySeries ? undefined : "rgba(0,0,0,0)",
              yMinOverride: useSharedScale ? sharedLayout?.yMin : undefined,
              yMaxOverride: useSharedScale ? sharedLayout?.yMax : undefined
            });
          } catch (e) {
            console.warn(e);
          }
        }
      }
      const viewportRenderer = this.getViewportRenderer();
      if (!viewportRenderer)
        return;
      if (this.currentOverlay) {
        if (viewportRenderer === this.interactionRenderer) {
          if (this.isViewportRenderer(renderer)) {
            viewportRenderer.resize();
          }
          const data = this.getPrimaryColumnar();
          if (!data)
            return;
          const { startIndex, visibleCount } = snapshot.viewport;
          viewportRenderer.drawCrosshairAt(this.currentOverlay.clientX, this.currentOverlay.clientY, data, {
            startIndex,
            visibleCount,
            rightMarginBars: snapshot.viewport.rightMarginBars,
            ...this.currentOverlay.options ?? {}
          });
        } else if (typeof viewportRenderer.renderOverlay === "function") {
          viewportRenderer.renderOverlay(snapshot, this.currentOverlay);
        }
      } else if (viewportRenderer === this.interactionRenderer) {} else if (typeof viewportRenderer.clearOverlay === "function") {
        viewportRenderer.clearOverlay(snapshot);
      }
    });
  }
  getPerformanceSnapshot() {
    return this.perfTracker.getSnapshot();
  }
  resetPerformanceMetrics() {
    this.perfTracker.reset();
  }
  setPerformanceMetricsEnabled(enabled) {
    this.perfTracker.setEnabled(enabled);
  }
  flush() {
    this.scheduler.flushSync();
  }
  resize() {
    this.interactionRenderer?.resize();
    this.enqueueAction({
      type: ActionType.RESIZE,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      dpr: window.devicePixelRatio || 1
    });
    this.emit("resize");
  }
  async destroy() {
    for (const dispose of this.lifecycleDisposers) {
      try {
        dispose();
      } catch {}
    }
    this.lifecycleDisposers = [];
    this.scheduler.destroy();
    this.realtimeSampler?.destroy();
    this.prefetcher?.reset();
    await this.disconnectFeed();
    this.seriesStore.clear();
    this.listeners.clear();
    if (this.rendererDebugEl?.parentElement) {
      this.rendererDebugEl.parentElement.removeChild(this.rendererDebugEl);
    }
    this.rendererDebugEl = null;
    this.indicatorComputeStore.reset();
    this.indicatorInstances = [];
    this.indicatorRecomputeKey = "";
    this.renderer?.destroy?.();
    this.interactionRenderer?.destroy?.();
    if (this.interactionOverlayCanvas?.parentElement) {
      this.interactionOverlayCanvas.parentElement.removeChild(this.interactionOverlayCanvas);
    }
    this.interactionOverlayCanvas = null;
    this.interactionRenderer = null;
    this.adapter = null;
    this.renderer = null;
  }
}

// src/core/chartUiBindings.ts
function attachChartUiBindings(core, container, options) {
  const interactive = options?.interactive !== false;
  const shouldObserveResize = options?.observeResize ?? interactive;
  const shouldObserveVisibility = options?.observeVisibility ?? interactive;
  const disposers = [];
  if (shouldObserveResize && typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry)
        return;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      core.onHostResize(entry.contentRect.width, entry.contentRect.height, dpr);
    });
    resizeObserver.observe(container);
    disposers.push(() => resizeObserver.disconnect());
  }
  if (shouldObserveVisibility && typeof IntersectionObserver !== "undefined") {
    const intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry)
        return;
      core.onHostVisibilityChange(entry.isIntersecting);
    });
    intersectionObserver.observe(container);
    disposers.push(() => intersectionObserver.disconnect());
  }
  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

// src/interaction/panQuantizer.ts
class PanQuantizer {
  remainderPx = 0;
  reset() {
    this.remainderPx = 0;
  }
  consume(deltaPx, pxPerBar) {
    if (!Number.isFinite(deltaPx) || !Number.isFinite(pxPerBar) || pxPerBar <= 0) {
      return 0;
    }
    const accumulatedPx = this.remainderPx + deltaPx;
    const wholeBars = accumulatedPx >= 0 ? Math.floor(accumulatedPx / pxPerBar) : Math.ceil(accumulatedPx / pxPerBar);
    this.remainderPx = accumulatedPx - wholeBars * pxPerBar;
    return wholeBars;
  }
  getRemainderPx() {
    return this.remainderPx;
  }
  getRemainderBars(pxPerBar) {
    if (!Number.isFinite(pxPerBar) || pxPerBar <= 0) {
      return 0;
    }
    return this.remainderPx / pxPerBar;
  }
}

// src/core/chartInteractionBindings.ts
class ChartInteractionBindings {
  core;
  container;
  opts;
  tooltipEl = null;
  legendEl = null;
  listenersRef = null;
  pointerId = null;
  dragging = false;
  dragStartX = 0;
  dragPanQuantizer = new PanQuantizer;
  _pinchStartDist = null;
  _pinchLastDist = null;
  _pinchStartCenterClientX = null;
  _pinchStartCenterIndex = undefined;
  _pinchStartCenterRatio = undefined;
  _wheelPanRemainderPx = 0;
  constructor(core, container, options) {
    this.core = core;
    this.container = container;
    this.opts = options ?? {};
    const shouldAttach = this.opts.attachEvents ?? this.opts.interactive ?? true;
    if (shouldAttach) {
      this.attachEvents();
    }
    if (this.opts.enableTooltip) {
      this.enableTooltip(true);
    }
    if (this.opts.showLegend) {
      this._ensureLegend();
    }
  }
  getCanvas() {
    if (!this.container)
      return null;
    if (typeof HTMLCanvasElement !== "undefined" && this.container instanceof HTMLCanvasElement) {
      return this.container;
    }
    const hasQuerySelector = typeof this.container.querySelector === "function";
    if (!hasQuerySelector)
      return null;
    return this.container.querySelector("canvas");
  }
  buildViewportOpts(startIndexOverride) {
    const vr = this.core.getVisibleRange();
    if (!vr || typeof vr.from !== "number" || typeof vr.to !== "number") {
      return {};
    }
    return {
      startIndex: typeof startIndexOverride === "number" ? startIndexOverride : vr.from,
      visibleCount: vr.to - vr.from + 1,
      rightMarginBars: vr.rightMarginBars ?? 0
    };
  }
  attachEvents() {
    const canvas = this.getCanvas();
    if (!canvas)
      return;
    const onPointerDown = (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      this.pointerId = ev.pointerId;
      this.dragging = true;
      this.dragStartX = ev.clientX;
      this.dragPanQuantizer.reset();
    };
    const onPointerMove = (ev) => {
      if (this.dragging && this.pointerId === ev.pointerId) {
        const dragOpts = this.buildViewportOpts();
        const layout = this.core.getLayout(dragOpts);
        const stepX = Math.max(layout ? layout.stepX : 10, 0.000001);
        const deltaIndex = this.dragPanQuantizer.consume(this.dragStartX - ev.clientX, stepX);
        this.dragStartX = ev.clientX;
        if (deltaIndex !== 0) {
          this.core.panBy(deltaIndex);
        }
        return;
      }
      if (!this.dragging) {
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const viewportOpts = this.buildViewportOpts();
        const mapped = this.core.mapClientToData(mx, my, viewportOpts);
        const layout = this.core.getLayout(viewportOpts);
        const inPlotArea = layout && mx >= layout.plotX && mx <= layout.plotX + layout.plotW && my >= layout.plotY && my <= layout.plotY + layout.plotH;
        const enableCrosshair = this.opts.enableCrosshair !== false;
        if (enableCrosshair && inPlotArea && mapped) {
          this.core.setCrosshairOverlay(mx, my, viewportOpts);
        } else {
          this.core.clearOverlay();
        }
        if (this.tooltipEl && this.opts.enableTooltip && inPlotArea && mapped) {
          const candleW = layout ? layout.candleW : 10;
          const dx = Math.abs(mx - mapped.x);
          const horizHit = dx <= candleW / 2 + 4;
          let vertHit = true;
          if (layout && typeof layout.yMin === "number" && typeof layout.yMax === "number") {
            const { plotY, plotH, yMin, yMax } = layout;
            const priceToY = (p2) => {
              const t = (p2 - yMin) / (yMax - yMin || 1);
              return plotY + (1 - t) * plotH;
            };
            const p = mapped.point;
            const yHigh = priceToY(p.high);
            const yLow = priceToY(p.low);
            const top = Math.min(yHigh, yLow);
            const bottom = Math.max(yHigh, yLow);
            const vertTol = 6;
            vertHit = my >= top - vertTol && my <= bottom + vertTol;
          }
          if (horizHit && vertHit) {
            const p = mapped.point;
            const html = this.opts.tooltipFormatter ? this.opts.tooltipFormatter(p, mapped.index) : `<div style="font-weight:600">${new Date(mapped.time).toLocaleDateString()}</div><div>O ${p.open}</div><div>H ${p.high}</div><div>L ${p.low}</div><div>C ${p.close}</div><div>V ${p.volume.toLocaleString()}</div>`;
            this.tooltipEl.innerHTML = html;
            const containerRect = this.container.getBoundingClientRect();
            this.tooltipEl.style.display = "block";
            this.tooltipEl.style.left = "0px";
            this.tooltipEl.style.top = "0px";
            const tipRect = this.tooltipEl.getBoundingClientRect();
            const tipW = tipRect.width;
            const tipH = tipRect.height;
            const clientXRel = ev.clientX - containerRect.left;
            const clientYRel = ev.clientY - containerRect.top;
            let left = clientXRel + 12;
            let top = clientYRel + 12;
            const canvasMidY = rect.height / 2;
            if (ev.clientY - rect.top > canvasMidY) {
              top = clientYRel - tipH - 12;
            }
            if (left + tipW > containerRect.width - 6)
              left = Math.max(6, clientXRel - tipW - 12);
            if (left < 6)
              left = 6;
            if (top < 6)
              top = 6;
            this.tooltipEl.style.left = left + "px";
            this.tooltipEl.style.top = top + "px";
          } else {
            this.tooltipEl.style.display = "none";
          }
        } else if (this.tooltipEl) {
          this.tooltipEl.style.display = "none";
        }
        if (this.legendEl && mapped) {
          const p = mapped.point;
          this._updateLegend(`${this.opts.symbol ?? ""}`, `C ${p.close}` + ` (${new Date(mapped.time).toLocaleDateString()})`);
        }
      }
    };
    const onPointerUp = (ev) => {
      if (this.pointerId !== ev.pointerId)
        return;
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {}
      this.dragging = false;
      this.pointerId = null;
      this.dragPanQuantizer.reset();
    };
    const onWheel = (ev) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const mx = cx;
      const rawStartIndex = this.core.getRawStartIndex();
      const wheelOpts = this.buildViewportOpts(rawStartIndex);
      if (ev.ctrlKey) {
        this._wheelPanRemainderPx = 0;
        const mapped = this.core.mapClientToData(mx, rect.height / 2, wheelOpts);
        const centerIndex = mapped ? mapped.index : undefined;
        const factor = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
        this.core.zoomAt(factor, centerIndex);
      } else {
        const layout = this.core.getLayout(wheelOpts);
        const stepX = layout ? layout.stepX : 10;
        const dominantDelta = Math.abs(ev.deltaX) >= Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
        const smoothScroll = this.opts.smoothScroll !== false;
        if (smoothScroll) {
          this._wheelPanRemainderPx = 0;
          const deltaBars = dominantDelta / Math.max(0.000001, stepX);
          if (deltaBars !== 0)
            this.core.panByBars(deltaBars);
        } else {
          const accumulatedPx = this._wheelPanRemainderPx + dominantDelta;
          const deltaIndex = accumulatedPx > 0 ? Math.floor(accumulatedPx / stepX) : Math.ceil(accumulatedPx / stepX);
          this._wheelPanRemainderPx = accumulatedPx - deltaIndex * stepX;
          if (deltaIndex !== 0) {
            this.core.panBy(deltaIndex);
          }
        }
      }
    };
    const onTouchStart = (ev) => {
      if (!canvas)
        return;
      if (ev.touches.length === 2) {
        ev.preventDefault();
        const t0 = ev.touches[0];
        const t1 = ev.touches[1];
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        this._pinchStartDist = Math.hypot(dx, dy);
        this._pinchLastDist = this._pinchStartDist;
        this._pinchStartCenterClientX = (t0.clientX + t1.clientX) / 2 - canvas.getBoundingClientRect().left;
        const touchOpts = this.buildViewportOpts();
        const layout = this.core.getLayout(touchOpts);
        if (layout && typeof this._pinchStartCenterClientX === "number") {
          const localX = this._pinchStartCenterClientX - layout.plotX;
          const slot = localX / Math.max(0.000001, layout.stepX);
          const slotsDenom = Math.max(1, layout.visibleCount + (layout.rightMarginBars ?? 0) - 1);
          this._pinchStartCenterRatio = Math.max(0, Math.min(1, slot / slotsDenom));
        } else {
          this._pinchStartCenterRatio = undefined;
        }
        const rect = canvas.getBoundingClientRect();
        const mapped = this.core.mapClientToData(this._pinchStartCenterClientX, rect.height / 2, touchOpts);
        this._pinchStartCenterIndex = mapped ? mapped.index : undefined;
      }
    };
    const onTouchMove = (ev) => {
      if (!canvas)
        return;
      if (ev.touches.length === 2 && this._pinchStartDist && this._pinchLastDist) {
        ev.preventDefault();
        const t0 = ev.touches[0];
        const t1 = ev.touches[1];
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        const dist = Math.hypot(dx, dy);
        const factor = this._pinchLastDist > 0 ? dist / this._pinchLastDist : 1;
        const clamped = Math.max(0.8, Math.min(1.25, factor));
        this.core.zoomAt(1 / clamped, this._pinchStartCenterIndex, this._pinchStartCenterRatio);
        if (typeof this._pinchStartCenterClientX === "number" && typeof this._pinchStartCenterIndex === "number") {
          const touchOpts = this.buildViewportOpts();
          const rect = canvas.getBoundingClientRect();
          const mappedAfter = this.core.mapClientToData(this._pinchStartCenterClientX, rect.height / 2, touchOpts);
          if (mappedAfter) {
            const correction = this._pinchStartCenterIndex - mappedAfter.index;
            if (correction !== 0)
              this.core.panBy(correction);
          }
        }
        this._pinchLastDist = dist;
      }
    };
    const onTouchEnd = (ev) => {
      if (ev.touches.length < 2) {
        this._pinchStartDist = null;
        this._pinchLastDist = null;
        this._pinchStartCenterClientX = null;
        this._pinchStartCenterIndex = undefined;
        this._pinchStartCenterRatio = undefined;
      }
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);
    const onLostPointerCapture = () => {
      this.dragging = false;
      this.pointerId = null;
      this.dragPanQuantizer.reset();
    };
    canvas.addEventListener("lostpointercapture", onLostPointerCapture);
    this.listenersRef = { onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd, onLostPointerCapture };
  }
  enableTooltip(v) {
    this.opts.enableTooltip = !!v;
    if (!this.container)
      return;
    if (v) {
      if (!this.tooltipEl)
        this.tooltipEl = this._createTooltip();
      this.tooltipEl.style.display = "none";
    } else {
      if (this.tooltipEl)
        this.tooltipEl.style.display = "none";
    }
  }
  _ensureLegend() {
    if (!this.container)
      return;
    if (!this.legendEl)
      this.legendEl = this._createLegend();
    this._updateLegend(this.opts.symbol ?? "", "");
  }
  _createLegend() {
    if (!this.container)
      throw new Error("No container");
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.left = "8px";
    div.style.top = "8px";
    div.style.pointerEvents = "none";
    div.style.background = "rgba(255,255,255,0.85)";
    div.style.color = "#000";
    div.style.padding = "6px 8px";
    div.style.borderRadius = "4px";
    div.style.font = "12px sans-serif";
    div.style.zIndex = "900";
    this.container.appendChild(div);
    return div;
  }
  _updateLegend(left, right) {
    if (!this.legendEl)
      return;
    this.legendEl.innerHTML = `<div style="font-weight:600">${left}</div><div style="opacity:0.85">${right}</div>`;
  }
  _createTooltip() {
    if (!this.container)
      throw new Error("No container");
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.pointerEvents = "none";
    div.style.background = "rgba(0,0,0,0.8)";
    div.style.color = "#fff";
    div.style.padding = "6px 8px";
    div.style.borderRadius = "4px";
    div.style.font = "12px sans-serif";
    div.style.display = "none";
    div.style.zIndex = "1000";
    this.container.appendChild(div);
    return div;
  }
  dispose() {
    const canvas = this.getCanvas();
    const l = this.listenersRef;
    if (canvas && l) {
      canvas.removeEventListener("pointerdown", l.onPointerDown);
      window.removeEventListener("pointermove", l.onPointerMove);
      window.removeEventListener("pointerup", l.onPointerUp);
      canvas.removeEventListener("wheel", l.onWheel);
      canvas.removeEventListener("touchstart", l.onTouchStart);
      canvas.removeEventListener("touchmove", l.onTouchMove);
      canvas.removeEventListener("touchend", l.onTouchEnd);
      canvas.removeEventListener("touchcancel", l.onTouchEnd);
      canvas.removeEventListener("lostpointercapture", l.onLostPointerCapture);
    }
    if (this.tooltipEl && this.tooltipEl.parentElement)
      this.tooltipEl.parentElement.removeChild(this.tooltipEl);
    if (this.legendEl && this.legendEl.parentElement)
      this.legendEl.parentElement.removeChild(this.legendEl);
    this.tooltipEl = null;
    this.legendEl = null;
    this.listenersRef = null;
  }
}

// src/api/createChart.ts
var _indicatorInstanceCounter = 1;
var _indicatorHandleCounter = 1;
var _annotationIdCounter = 1;
function nextAnnotationId() {
  return `ann_${(_annotationIdCounter++).toString(36)}`;
}
function kindToIndicatorId(kind) {
  switch (kind) {
    case "SMA":
      return "sma";
    case "EMA":
      return "ema";
    case "BollingerBands":
      return "bb";
    case "RSI":
      return "rsi";
    case "MACD":
      return "macd";
    case "ATR":
      return "atr";
    case "OBV":
      return "obv";
    case "Volume":
      return "volume";
    default:
      return kind.toLowerCase();
  }
}
function indicatorConfigToInstance(cfg) {
  const id = kindToIndicatorId(cfg.kind);
  const instanceId = `inst_${Date.now().toString(36)}_${(_indicatorInstanceCounter++).toString(36)}`;
  const params = {};
  if (cfg.period != null)
    params.period = cfg.period;
  if (cfg.slow != null)
    params.slow = cfg.slow;
  if (cfg.signal != null)
    params.signal = cfg.signal;
  if (cfg.stdDev != null)
    params.stdDev = cfg.stdDev;
  return { id, instanceId, enabled: cfg.enabled !== false, params };
}
function instanceToConfig(inst) {
  const kindMap = {
    sma: "SMA",
    ema: "EMA",
    bb: "BollingerBands",
    rsi: "RSI",
    macd: "MACD",
    atr: "ATR",
    obv: "OBV",
    volume: "Volume"
  };
  const kind = kindMap[inst.id] ?? inst.id;
  const cfg = {
    kind,
    pane: "main",
    color: [0, 0.5, 0.5, 1]
  };
  if (inst.params) {
    if (inst.params.period != null)
      cfg.period = Number(inst.params.period);
    if (inst.params.slow != null)
      cfg.slow = Number(inst.params.slow);
    if (inst.params.signal != null)
      cfg.signal = Number(inst.params.signal);
    if (inst.params.stdDev != null)
      cfg.stdDev = Number(inst.params.stdDev);
  }
  return cfg;
}
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
function parseBinarySoA(ab) {
  const dv = new DataView(ab);
  const N = new Uint32Array(ab, 0, 1)[0] || 0;
  if (N === 0)
    return [];
  const OFF_TIME = 8;
  const OFF_OPEN = OFF_TIME + N * 8;
  const OFF_HIGH = OFF_OPEN + N * 4;
  const OFF_LOW = OFF_HIGH + N * 4;
  const OFF_CLOSE = OFF_LOW + N * 4;
  const OFF_VOL = OFF_CLOSE + N * 4;
  const times = new Float64Array(ab, OFF_TIME, N);
  const opens = new Float32Array(ab, OFF_OPEN, N);
  const highs = new Float32Array(ab, OFF_HIGH, N);
  const lows = new Float32Array(ab, OFF_LOW, N);
  const closes = new Float32Array(ab, OFF_CLOSE, N);
  const vols = new Float32Array(ab, OFF_VOL, N);
  const out = new Array(N);
  for (let i = 0;i < N; i++) {
    out[i] = { time: Number(times[i]), open: Number(opens[i]), high: Number(highs[i]), low: Number(lows[i]), close: Number(closes[i]), volume: Number(vols[i] ?? 0) };
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
function createChart(container, options) {
  const internalOptions = options;
  const core = new ChartCore(container, internalOptions);
  const disposeUiBindings = attachChartUiBindings(core, container, internalOptions);
  core.registerLifecycleDisposer(disposeUiBindings);
  const interaction = new ChartInteractionBindings(core, container, internalOptions);
  core.registerLifecycleDisposer(() => interaction.dispose());
  let _instances = [];
  const _pendingWorkerIndicators = new Map;
  const _annotations = new Map;
  const _visibleRangeView = new Int32Array(3);
  let _tradeAnnotationIds = [];
  function postDataWorker(message, transfer) {
    if (!options?.dataWorker)
      return;
    options.dataWorker.postMessage(message, transfer);
  }
  if (options?.dataWorker) {
    options.dataWorker.addEventListener("message", (evt) => {
      const data = evt.data;
      if (!data || typeof data.type !== "string")
        return;
      if (data.type === "ep_added") {
        const handleId = Number(data.id);
        if (!Number.isFinite(handleId))
          return;
        const pending = _pendingWorkerIndicators.get(handleId);
        if (!pending)
          return;
        _pendingWorkerIndicators.delete(handleId);
        const inst = indicatorConfigToInstance(pending);
        _instances.push({ ...inst, handleId });
        return;
      }
      if (data.type === "ep_removed") {
        const handleId = Number(data.id);
        if (!Number.isFinite(handleId))
          return;
        _pendingWorkerIndicators.delete(handleId);
        const idx = _instances.findIndex((x) => x.handleId === handleId);
        if (idx >= 0)
          _instances.splice(idx, 1);
      }
    });
  }
  function ensurePrimarySeries() {
    const primary = core.getPrimarySeriesId();
    if (primary)
      return Promise.resolve(primary);
    return core.addSeries({ id: "primary", type: "candlestick" });
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
      if (options?.dataWorker) {
        const soa = toSoABuffersFromInput(bars);
        postDataWorker({
          type: "set_data_soa",
          count: soa.count,
          time: soa.time.buffer,
          open: soa.open.buffer,
          high: soa.high.buffer,
          low: soa.low.buffer,
          close: soa.close.buffer,
          volume: soa.volume.buffer
        }, [soa.time.buffer, soa.open.buffer, soa.high.buffer, soa.low.buffer, soa.close.buffer, soa.volume.buffer]);
        return;
      }
      const arr = bars || [];
      const objs = new Array(arr.length);
      if (arr.length === 0) {
        ensurePrimarySeries().then((id) => core.setSeriesData(id, []));
        return;
      }
      const first = arr[0];
      const isTuple = Array.isArray(first);
      for (let i = 0;i < arr.length; i++) {
        if (isTuple) {
          const t = arr[i];
          const time = Number(t[0]);
          objs[i] = { time, open: Number(t[1]), high: Number(t[2]), low: Number(t[3]), close: Number(t[4]), volume: Number(t[5] ?? 0) };
        } else {
          const o = arr[i];
          objs[i] = { time: Number(o.time), open: Number(o.open), high: Number(o.high), low: Number(o.low), close: Number(o.close), volume: Number(o.volume ?? 0) };
        }
      }
      ensurePrimarySeries().then((id) => core.setSeriesData(id, objs));
    },
    setDataBinary(data) {
      if (options?.dataWorker) {
        postDataWorker({ type: "set_data_binary", data }, [data]);
        return;
      }
      try {
        const parsed = parseBinarySoA(data);
        ensurePrimarySeries().then((id) => core.setSeriesData(id, parsed));
      } catch (e) {
        console.error("setDataBinary parse failed", e);
      }
    },
    setDataUrl(url) {
      if (options?.dataWorker) {
        postDataWorker({ type: "set_data_url", url });
        return;
      }
      (async () => {
        try {
          const r = await fetch(url);
          if (!r.ok)
            throw new Error(`fetch ${url}: ${r.status}`);
          const ct = r.headers.get("content-type") || "";
          if (ct.includes("application/json") || ct.includes("text/json")) {
            const json = await r.json();
            this.setData(json);
            return;
          }
          const ab = await r.arrayBuffer();
          this.setDataBinary(ab);
        } catch (err) {
          console.error("setDataUrl failed", err);
        }
      })();
    },
    appendTick(time, o, h, l, c, v) {
      ensurePrimarySeries().then((id) => core.pushRealtime(id, { time, open: o, high: h, low: l, close: c, volume: v }));
    },
    panByBars(deltaBars) {
      core.panByBars(deltaBars);
    },
    zoomAt(factor, centerX) {
      core.zoomAt(factor, undefined, centerX);
    },
    setViewport(startBar, visibleBars) {
      core.setViewport(startBar, startBar + Math.max(0, visibleBars - 1));
    },
    getVisibleRangeView() {
      const r = core.getVisibleRange();
      if (!r) {
        _visibleRangeView[0] = 0;
        _visibleRangeView[1] = 0;
        _visibleRangeView[2] = 0;
        return _visibleRangeView;
      }
      _visibleRangeView[0] = r.from;
      _visibleRangeView[1] = r.to - r.from + 1;
      _visibleRangeView[2] = core.getPrimaryColumnar()?.length ?? 0;
      return _visibleRangeView;
    },
    getVisibleRangeSnapshot() {
      const r = core.getVisibleRange();
      if (!r)
        return { startBar: 0, visibleBars: 0, totalBars: 0 };
      return { startBar: r.from, visibleBars: r.to - r.from + 1, totalBars: core.getPrimaryColumnar()?.length ?? 0 };
    },
    getVisibleRange() {
      return this.getVisibleRangeSnapshot();
    },
    addIndicator(config) {
      const handleId = _indicatorHandleCounter++;
      if (options?.dataWorker) {
        _pendingWorkerIndicators.set(handleId, config);
        const color = config.color || [0.2, 0.6, 0.9, 1];
        postDataWorker({
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
      } else {
        const inst = indicatorConfigToInstance(config);
        _instances.push({ ...inst, handleId });
        core.setIndicators(_instances);
      }
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
      if (options?.dataWorker) {
        const pending = _pendingWorkerIndicators.get(id);
        if (pending) {
          _pendingWorkerIndicators.set(id, { ...pending, ...params });
        }
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
        postDataWorker(payload);
      } else {
        const idx = _instances.findIndex((x) => x.handleId === id);
        if (idx < 0 || idx >= _instances.length)
          return;
        _instances[idx].params = { ..._instances[idx].params, ...params };
        core.setIndicators(_instances);
      }
    },
    removeIndicator(id) {
      if (options?.dataWorker) {
        _pendingWorkerIndicators.delete(id);
        postDataWorker({ type: "ep_remove", id: id.toString() });
      } else {
        const idx = _instances.findIndex((x) => x.handleId === id);
        if (idx < 0 || idx >= _instances.length)
          return;
        _instances.splice(idx, 1);
        core.setIndicators(_instances);
      }
    },
    getIndicators() {
      if (options?.dataWorker) {
        return _instances.map((i) => instanceToConfig(i));
      }
      try {
        const cur = core.getIndicators();
        if (!cur || cur.length === 0)
          return [];
        return cur.map((c) => instanceToConfig(c));
      } catch {
        return _instances.map((i) => instanceToConfig(i));
      }
    },
    setPaneConfig(_config) {},
    addAnnotation(annotation) {
      return makeAnnotationHandle(annotation);
    },
    addAnnotations(annotations) {
      const handles = new Array(annotations.length);
      for (let i = 0;i < annotations.length; i++) {
        handles[i] = makeAnnotationHandle(annotations[i]);
      }
      return handles;
    },
    updateAnnotation(id, patch) {
      const existing = _annotations.get(id);
      if (!existing)
        return;
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
      for (let i = 0;i < _tradeAnnotationIds.length; i++) {
        _annotations.delete(_tradeAnnotationIds[i]);
      }
      const expanded = expandTradeRecords(trades, displayOptions);
      _tradeAnnotationIds = new Array(expanded.length);
      for (let i = 0;i < expanded.length; i++) {
        const handle = makeAnnotationHandle(expanded[i]);
        _tradeAnnotationIds[i] = handle.id;
      }
    },
    clearTradeRecords() {
      for (let i = 0;i < _tradeAnnotationIds.length; i++) {
        _annotations.delete(_tradeAnnotationIds[i]);
      }
      _tradeAnnotationIds = [];
    },
    resize() {
      core.resize();
    },
    destroy() {
      core.destroy();
    },
    on(event, cb) {
      core.on(event, cb);
    },
    off(event, cb) {
      core.off(event, cb);
    },
    getPerformanceMetrics() {
      const out = { wasm: { ewma: 0, p50: 0, p95: 0 }, gpu: { ewma: 0, p50: 0, p95: 0 }, hud: { ewma: 0, p50: 0, p95: 0 }, frame: { ewma: 0, p50: 0, p95: 0 } };
      return out;
    }
  };
  if (typeof options?.dataUrl === "string" && options.dataUrl.length > 0) {
    api.setDataUrl(options.dataUrl);
  } else if (options?.data != null) {
    api.setData(options.data);
  }
  return api;
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
  const sharedDataWorker = options?.sharedDataWorker ?? options?.createDataWorker?.();
  const sharedRenderWorker = options?.sharedRenderWorker ?? options?.createRenderWorker?.();
  const ownsRenderWorker = options?.sharedRenderWorker == null && sharedRenderWorker != null;
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
        mergedOptions.dataWorker = sharedDataWorker;
      }
      if (sharedRenderWorker) {
        mergedOptions.sharedRenderWorker = sharedRenderWorker;
        if (!mergedOptions.renderer) {
          mergedOptions.renderer = "canvas-worker";
        }
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
      if (ownsRenderWorker) {
        sharedRenderWorker.terminate();
      }
    },
    get activeCount() {
      return _charts.size;
    }
  };
}
function createChartManager(options) {
  return createChartManagerWithFactory(options, createChart);
}
// src/core/tradeMarkers.ts
var DEFAULT_MARKER_STYLES = {
  entry_long: { shape: "triangle_up", color: "#4CAF50", size: 10 },
  entry_short: { shape: "triangle_down", color: "#F44336", size: 10 },
  exit_long: { shape: "triangle_up", color: "#81C784", borderColor: "#4CAF50", size: 8 },
  exit_short: { shape: "triangle_down", color: "#E57373", borderColor: "#F44336", size: 8 },
  stop_loss: { shape: "cross", color: "#F44336", size: 10 },
  take_profit: { shape: "circle", color: "#4CAF50", size: 8 },
  signal: { shape: "diamond", color: "#FFC107", size: 8 },
  alert: { shape: "warning", color: "#FF9800", size: 10 }
};
// src/core/i18n.ts
var INDICATOR_I18N = {
  "indicator.bb.name": { en: "Bollinger Bands", ja: "ボリンジャーバンド" },
  "indicator.rsi.name": { en: "RSI", ja: "RSI（相対力指数）" },
  "indicator.adx.name": { en: "ADX", ja: "ADX（平均方向性指数）" },
  "indicator.macd.name": { en: "MACD", ja: "MACD" },
  "indicator.atr.name": { en: "ATR", ja: "ATR" },
  "indicator.volume.name": { en: "Volume", ja: "出来高" },
  "indicator.sma.name": { en: "SMA", ja: "単純移動平均線" },
  "indicator.ema.name": { en: "EMA", ja: "指数平滑移動平均線" },
  "indicator.pivot_points.name": { en: "Pivot Points", ja: "ピボットポイント" },
  "indicator.trade_markers.name": { en: "Trade Markers", ja: "トレードマーカー" },
  "indicator.vwap.name": { en: "VWAP", ja: "VWAP" },
  "indicator.vol_ratio.name": { en: "Vol Ratio", ja: "出来高レシオ" },
  "indicator.percent_b.name": { en: "%B", ja: "%B" },
  "indicator.bb_width.name": { en: "BB Width", ja: "バンド幅" },
  "indicator.obv.name": { en: "OBV", ja: "オンバランスボリューム" },
  "indicator.cmf.name": { en: "CMF", ja: "チャイキンマネーフロー" },
  "indicator.mfi.name": { en: "MFI", ja: "マネーフローインデックス" },
  "indicator.kaufman_patterns.name": { en: "Kaufman Patterns", ja: "カウフマン・パターン" },
  "indicator.squeeze_alert.name": { en: "Squeeze Alert", ja: "スクイーズアラート" },
  "indicator.divergence.name": { en: "Divergence", ja: "ダイバージェンス" }
};
var t = (key, locale = "ja") => {
  return INDICATOR_I18N[key]?.[locale] ?? key;
};
// src/core/indicatorCatalog.ts
var INDICATOR_PHASES = {
  phase1: ["volume", "sma", "ema", "bb", "candles"],
  phase2: ["rsi", "adx", "atr", "macd", "trade_markers"],
  phase3: ["vwap", "vol_ratio", "percent_b", "bb_width"],
  phase4: ["obv", "cmf", "mfi", "kaufman_patterns"]
};
// src/wasm/assetLocator.ts
var WASM_FILE_NAMES = {
  legacy: "mochart_wasm_bg.wasm",
  new: "mochart_wasm_new_bg.wasm"
};
var WASM_PATH_CANDIDATES = [
  "./pkg/",
  "../pkg/",
  "/src/pkg/",
  "/dist/pkg/"
];
var SHARED_WASM_PATH_CANDIDATES = [
  "./pkg-shared/",
  "../pkg-shared/",
  "/src/pkg-shared/",
  "/dist/pkg-shared/"
];
function resolveOverrideBaseUrl() {
  const host = globalThis;
  const override = host.__MOCHART_ASSET_BASE_URL__;
  if (typeof override !== "string")
    return null;
  const trimmed = override.trim();
  if (trimmed.length === 0)
    return null;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}
function buildCandidateUrls(kind, variant) {
  const fileName = WASM_FILE_NAMES[kind];
  const urls = [];
  const overrideBase = resolveOverrideBaseUrl();
  if (overrideBase) {
    urls.push(new URL(fileName, overrideBase));
  }
  const pathCandidates = variant === "shared-preferred" ? [...SHARED_WASM_PATH_CANDIDATES, ...WASM_PATH_CANDIDATES] : WASM_PATH_CANDIDATES;
  for (let index = 0;index < pathCandidates.length; index++) {
    urls.push(new URL(`${pathCandidates[index]}${fileName}`, import.meta.url));
  }
  return urls;
}
async function fetchMochartWasmBytes(kind, variant = "default") {
  const urls = buildCandidateUrls(kind, variant);
  let lastError = null;
  for (let index = 0;index < urls.length; index++) {
    const url = urls[index];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url.href}`);
        continue;
      }
      return await response.arrayBuffer();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to resolve Mochart WASM asset for ${kind}`);
}

// src/wasm/wasmModule.ts
var wasmLoadPromise = null;
async function tryImportModule() {
  try {
    const bindings = await import("../pkg/mochart_wasm");
    let instance;
    if (typeof bindings.default === "function") {
      const wasmBytes = await fetchMochartWasmBytes("legacy");
      instance = await bindings.default({ module_or_path: wasmBytes });
    } else {
      return null;
    }
    try {
      if (typeof bindings.wasm_ready === "function") {
        const ready = bindings.wasm_ready();
        if (ready !== true) {
          console.debug("[wasm] wasm_ready returned falsy:", ready);
        }
      }
    } catch (e) {
      console.warn("[wasm] wasm_ready threw:", e);
    }
    return { bindings, instance };
  } catch (e) {
    console.warn("[wasm] failed to import/initialize module", e instanceof Error ? e.message : e);
    if (e && e.stack)
      console.debug("[wasm] stack", e.stack);
    return null;
  }
}
async function loadWasmModule() {
  if (!wasmLoadPromise) {
    wasmLoadPromise = tryImportModule();
  }
  return wasmLoadPromise;
}

// src/wasm/wasmColumnar.ts
class NoopWasmColumnarStore {
  _data = [];
  setData(data) {
    this._data = data.slice();
  }
  push(point) {
    this._data.push(point);
  }
  length() {
    return this._data.length;
  }
  toArray() {
    return this._data;
  }
  minMaxCloseInRange(start, end) {
    const safeStart = Math.max(0, Math.min(this._data.length, start | 0));
    const safeEnd = Math.max(safeStart, Math.min(this._data.length, end | 0));
    if (safeStart >= safeEnd)
      return { min: 0, max: 1 };
    let min = this._data[safeStart].close;
    let max = this._data[safeStart].close;
    for (let i = safeStart + 1;i < safeEnd; i++) {
      const value = this._data[i].close;
      if (value < min)
        min = value;
      if (value > max)
        max = value;
    }
    if (min === max) {
      return { min: min - 1, max: max + 1 };
    }
    return { min, max };
  }
}

class WasmColumnarStoreImpl {
  handle;
  memory;
  constructor(handle, memory) {
    this.handle = handle;
    this.memory = memory;
  }
  setData(data) {
    this.handle.clear();
    this.handle.reserve(data.length);
    for (let i = 0;i < data.length; i++) {
      const point = data[i];
      this.handle.push(point.time, point.open, point.high, point.low, point.close, point.volume);
    }
  }
  push(point) {
    this.handle.push(point.time, point.open, point.high, point.low, point.close, point.volume);
  }
  length() {
    return this.handle.len();
  }
  toArray() {
    const len = this.handle.len();
    if (len === 0)
      return [];
    const timePtr = this.handle.time_ptr();
    const openPtr = this.handle.open_ptr();
    const highPtr = this.handle.high_ptr();
    const lowPtr = this.handle.low_ptr();
    const closePtr = this.handle.close_ptr();
    const volumePtr = this.handle.volume_ptr();
    const time = new Float64Array(this.memory.buffer, timePtr, len);
    const open = new Float32Array(this.memory.buffer, openPtr, len);
    const high = new Float32Array(this.memory.buffer, highPtr, len);
    const low = new Float32Array(this.memory.buffer, lowPtr, len);
    const close = new Float32Array(this.memory.buffer, closePtr, len);
    const volume = new Float32Array(this.memory.buffer, volumePtr, len);
    const out = new Array(len);
    for (let i = 0;i < len; i++) {
      out[i] = {
        time: time[i],
        open: open[i],
        high: high[i],
        low: low[i],
        close: close[i],
        volume: volume[i]
      };
    }
    return out;
  }
  minMaxCloseInRange(start, end) {
    const len = this.handle.len();
    const safeStart = Math.max(0, Math.min(len, start | 0));
    const safeEnd = Math.max(safeStart, Math.min(len, end | 0));
    if (safeStart >= safeEnd)
      return { min: 0, max: 1 };
    const minmax = this.handle.min_max_close_in_range(safeStart, safeEnd);
    if (minmax.length < 2)
      return { min: 0, max: 1 };
    const min = minmax[0];
    const max = minmax[1];
    if (min === max) {
      return { min: min - 1, max: max + 1 };
    }
    return { min, max };
  }
}
async function createWasmColumnarStore(capacity = 0) {
  const modResult = await loadWasmModule();
  if (!modResult)
    return new NoopWasmColumnarStore;
  const { bindings, instance } = modResult;
  const wasmWithClasses = bindings;
  if (!wasmWithClasses || typeof wasmWithClasses.WasmColumnarStore !== "function") {
    return new NoopWasmColumnarStore;
  }
  const handle = new wasmWithClasses.WasmColumnarStore(capacity);
  return new WasmColumnarStoreImpl(handle, instance.memory);
}
// src/wasm/wasmRingBuffer.ts
class NoopWasmRingBuffer {
  capacity;
  _items = [];
  constructor(capacity = 2048) {
    this.capacity = capacity;
  }
  push(point) {
    if (this._items.length >= this.capacity) {
      this._items.shift();
    }
    this._items.push(point);
  }
  size() {
    return this._items.length;
  }
  isFull() {
    return this._items.length >= this.capacity;
  }
  clear() {
    this._items = [];
  }
  toArray() {
    return this._items;
  }
}

class WasmRingBufferImpl {
  handle;
  constructor(handle) {
    this.handle = handle;
  }
  push(point) {
    this.handle.push(point.time, point.open, point.high, point.low, point.close, point.volume);
  }
  size() {
    return this.handle.len();
  }
  isFull() {
    return this.handle.is_full();
  }
  clear() {
    this.handle.clear();
  }
  toArray() {
    const time = this.handle.time();
    const open = this.handle.open();
    const high = this.handle.high();
    const low = this.handle.low();
    const close = this.handle.close();
    const volume = this.handle.volume();
    const len = time.length;
    const out = new Array(len);
    for (let i = 0;i < len; i++) {
      out[i] = {
        time: time[i],
        open: open[i],
        high: high[i],
        low: low[i],
        close: close[i],
        volume: volume[i]
      };
    }
    return out;
  }
}
async function createWasmRingBuffer(capacity = 2048) {
  const modResult = await loadWasmModule();
  if (!modResult) {
    return new NoopWasmRingBuffer(capacity);
  }
  const { bindings } = modResult;
  const wasmWithClasses = bindings;
  if (!wasmWithClasses || typeof wasmWithClasses.WasmRingBuffer !== "function") {
    return new NoopWasmRingBuffer(capacity);
  }
  const handle = new wasmWithClasses.WasmRingBuffer(capacity);
  return new WasmRingBufferImpl(handle);
}
// src/wasm/wasmKernels.ts
async function getWasmKernelAvailability() {
  const modResult = await loadWasmModule();
  return { ready: modResult !== null };
}
async function wasmMinMax(values) {
  const modResult = await loadWasmModule();
  if (!modResult)
    return null;
  const { bindings, instance } = modResult;
  if (typeof bindings.min_max_f32_ptr === "function") {
    if (values.buffer === instance.memory.buffer) {
      const ptr = values.byteOffset;
      const len = values.length;
      const res = bindings.min_max_f32_ptr(ptr, len);
      if (res instanceof Float32Array)
        return res;
    }
  }
  return bindings.min_max_f32(values);
}
async function wasmNearestIndex(times, target) {
  const modResult = await loadWasmModule();
  if (!modResult)
    return null;
  const { bindings } = modResult;
  return bindings.nearest_index(times, target);
}
async function wasmLttbDownsample(times, values, threshold) {
  const modResult = await loadWasmModule();
  if (!modResult)
    return null;
  const { bindings, instance } = modResult;
  if (typeof bindings.lttb_downsample_ptr === "function") {
    if (values.buffer === instance.memory.buffer && times.buffer === instance.memory.buffer) {
      const ptrV = values.byteOffset;
      const lenV = values.length;
      const ptrT = times.byteOffset;
      const lenT = times.length;
      const outPtr = bindings.lttb_downsample_ptr(ptrT, lenT, ptrV, lenV, threshold);
      const outLen = bindings.lttb_downsample_len ? bindings.lttb_downsample_len() : 0;
      if (outPtr && outLen)
        return new Uint32Array(instance.memory.buffer, outPtr, outLen);
    }
  }
  return bindings.lttb_downsample(times, values, threshold);
}
async function wasmRunIndicatorKernel(id, input) {
  const modResult = await loadWasmModule();
  if (!modResult)
    return null;
  const { bindings } = modResult;
  switch (id) {
    case "sma": {
      if (!input.values)
        return null;
      if (typeof bindings.sma_ptr === "function" && modResult.instance) {
        const { instance } = modResult;
        if (input.values.buffer === instance.memory.buffer) {
          const ptr = input.values.byteOffset;
          const len = input.values.length;
          const res = bindings.sma_ptr(ptr, len, input.period ?? 14);
          if (res instanceof Float32Array)
            return res;
          return res;
        }
      }
      if (typeof bindings.sma_f32_ptr === "function" && typeof bindings.sma_f32_len === "function") {
        if (modResult.instance && input.values.buffer === modResult.instance.memory.buffer) {
          const { instance } = modResult;
          const ptr = bindings.sma_f32_ptr(input.values, input.period ?? 14);
          const len = bindings.sma_f32_len();
          return new Float32Array(instance.memory.buffer, ptr, len);
        }
      }
      return bindings.sma_f32(input.values, input.period ?? 14);
    }
    case "ema": {
      if (!input.values)
        return null;
      if (typeof bindings.ema_ptr === "function" && modResult.instance) {
        const { instance } = modResult;
        if (input.values.buffer === instance.memory.buffer) {
          const ptr = input.values.byteOffset;
          const len = input.values.length;
          const res = bindings.ema_ptr(ptr, len, input.period ?? 14);
          if (res instanceof Float32Array)
            return res;
          return res;
        }
      }
      if (typeof bindings.ema_f32_ptr === "function" && typeof bindings.ema_f32_len === "function") {
        if (modResult.instance && input.values.buffer === modResult.instance.memory.buffer) {
          const { instance } = modResult;
          const ptr = bindings.ema_f32_ptr(input.values, input.period ?? 14);
          const len = bindings.ema_f32_len();
          return new Float32Array(instance.memory.buffer, ptr, len);
        }
      }
      return bindings.ema_f32(input.values, input.period ?? 14);
    }
    case "bollinger": {
      if (!input.values)
        return null;
      return bindings.bollinger_f32(input.values, input.period ?? 20, input.stdDev ?? 2);
    }
    case "rsi": {
      if (!input.values)
        return null;
      return bindings.rsi_f32(input.values, input.period ?? 14);
    }
    case "macd": {
      if (!input.values)
        return null;
      return bindings.macd_f32(input.values, input.fast ?? 12, input.slow ?? 26, input.signal ?? 9);
    }
    case "atr": {
      if (!input.high || !input.low || !input.close)
        return null;
      return bindings.atr_f32(input.high, input.low, input.close, input.period ?? 14);
    }
    case "obv": {
      if (!input.close || !input.volume)
        return null;
      return bindings.obv_f32(input.close, input.volume);
    }
    case "mfi": {
      if (!input.high || !input.low || !input.close || !input.volume)
        return null;
      return bindings.mfi_f32(input.high, input.low, input.close, input.volume, input.period ?? 14);
    }
    case "stochastic": {
      if (!input.high || !input.low || !input.close)
        return null;
      return bindings.stochastic_f32(input.high, input.low, input.close, input.period ?? 14);
    }
    case "williams_r": {
      if (!input.high || !input.low || !input.close)
        return null;
      return bindings.williams_r_f32(input.high, input.low, input.close, input.period ?? 14);
    }
    case "cci": {
      if (!input.high || !input.low || !input.close)
        return null;
      return bindings.cci_f32(input.high, input.low, input.close, input.period ?? 14);
    }
    case "adx": {
      if (!input.high || !input.low || !input.close)
        return null;
      return bindings.adx_f32(input.high, input.low, input.close, input.period ?? 14);
    }
    default:
      return null;
  }
}
function toColumnarInputs(data) {
  {
    const len = data.length;
    const time = new Float64Array(len);
    const open = new Float32Array(len);
    const high = new Float32Array(len);
    const low = new Float32Array(len);
    const close = new Float32Array(len);
    const volume = new Float32Array(len);
    for (let i = 0;i < len; i++) {
      const point = data[i];
      time[i] = point.time;
      open[i] = point.open;
      high[i] = point.high;
      low[i] = point.low;
      close[i] = point.close;
      volume[i] = point.volume;
    }
    return { time, open, high, low, close, volume };
  }
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
  wasmRunIndicatorKernel,
  wasmNearestIndex,
  wasmMinMax,
  wasmLttbDownsample,
  toColumnarInputs,
  t,
  registerPhase4Indicators,
  registerPhase3Indicators,
  registerPhase2Indicators,
  registerPhase1Indicators,
  getWasmKernelAvailability,
  createWasmRingBuffer,
  createWasmColumnarStore,
  createChartManager,
  createChart,
  Volume,
  VolRatio,
  VWAP,
  TradeMarkers,
  SqueezeAlert,
  SMA,
  RenderStyle,
  RSI,
  PivotPoints,
  Phase4Indicators,
  Phase3Indicators,
  Phase2Indicators,
  Phase1Indicators,
  PercentB,
  OBV,
  NoopWasmRingBuffer,
  NoopWasmColumnarStore,
  MFI,
  MACD,
  KaufmanPatterns,
  IndicatorKind,
  InMemoryIndicatorRegistry,
  INDICATOR_PHASES,
  INDICATOR_I18N,
  EMA,
  Divergence,
  DEFAULT_MARKER_STYLES,
  CMF,
  BollingerBands,
  BBWidth,
  ATR,
  ADX
};

//# debugId=F6BE9494E0A1078C64756E2164756E21
//# sourceMappingURL=index.js.map
