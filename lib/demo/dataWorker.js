var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// crates/mochart-wasm-new/src/demo/shared_protocol.js
var STRIDE = 16;
var WAKE = 0;
var READY = 1;
var START_BAR = 2;
var VIS_BARS = 3;
var PLOT_W = 4;
var PLOT_H = 5;
var POINTER_X = 6;
var POINTER_Y = 7;
var FLAGS = 8;
var DIRTY = 9;
var SUBPIXEL_PAN_X = 10;
var GPU_DIRTY = 1;
var HUD_DIRTY = 2;
var _cvt = new DataView(new ArrayBuffer(4));
function i32ToF32(i) {
  _cvt.setInt32(0, i, true);
  return _cvt.getFloat32(0, true);
}
var FRAME_MAX_BARS = 4096;
var FBUF_START_BAR = 0;
var FBUF_VIS_BARS = 4;
var FBUF_VIEW_LEN = 8;
var FBUF_FLAGS = 12;
var FBUF_SEQ = 36;
var FBUF_TOTAL_BARS = 40;
var FBUF_PRICE_MIN = 48;
var FBUF_PRICE_MAX = 52;
var FBUF_CANVAS_W = 56;
var FBUF_CANVAS_H = 60;
var FBUF_CANDLE_W = 64;
var FBUF_FRAME_START_BAR = 88;
var FBUF_HDR_BYTES = 128;
var _FBUF_F32_STRIDE = FRAME_MAX_BARS * 4;
var FBUF_OPEN_OFF = FBUF_HDR_BYTES + 0 * _FBUF_F32_STRIDE;
var FBUF_HIGH_OFF = FBUF_HDR_BYTES + 1 * _FBUF_F32_STRIDE;
var FBUF_LOW_OFF = FBUF_HDR_BYTES + 2 * _FBUF_F32_STRIDE;
var FBUF_CLOSE_OFF = FBUF_HDR_BYTES + 3 * _FBUF_F32_STRIDE;
var FBUF_VOL_OFF = FBUF_HDR_BYTES + 4 * _FBUF_F32_STRIDE;
var FBUF_SMA20_OFF = FBUF_HDR_BYTES + 5 * _FBUF_F32_STRIDE;
var FBUF_SMA50_OFF = FBUF_HDR_BYTES + 6 * _FBUF_F32_STRIDE;
var FBUF_SMA100_OFF = FBUF_HDR_BYTES + 7 * _FBUF_F32_STRIDE;
var FBUF_TIME_OFF = FBUF_HDR_BYTES + 5 * _FBUF_F32_STRIDE;
var _FRAME_TIME_BYTES = FRAME_MAX_BARS * 8;
var FRAME_BUF_BYTES = FBUF_TIME_OFF + _FRAME_TIME_BYTES;
var FCTRL_READY = 0;
var FCTRL_ACK = 1;
var INDSAB_SEQ_OFF = 0;
var INDSAB_ARENA_LEN = 4;
var INDSAB_CMD_COUNT = 8;
var INDSAB_REVISION = 12;
var INDSAB_OVERLAY_STD430_OFF = 3072;
var INDSAB_OVERLAY_STD430_WORDS = 8;
var INDSAB_OVERLAY_REV_OFF = INDSAB_OVERLAY_STD430_OFF + INDSAB_OVERLAY_STD430_WORDS * 4;
var MAX_RENDER_CMDS = 32;
var MAX_ARENA_F32 = FRAME_MAX_BARS * MAX_RENDER_CMDS;
var INDSAB_HDR_BYTES = 4096;
var INDSAB_CMD_BASE = 16;
var INDSAB_CMD_STRIDE = 64;
var INDSAB_CMD_SLOT_ID = 0;
var INDSAB_CMD_ARENA_OFFSET = 4;
var INDSAB_CMD_BAR_COUNT = 8;
var INDSAB_CMD_WARMUP = 12;
var INDSAB_CMD_COLOR_R = 16;
var INDSAB_CMD_COLOR_G = 20;
var INDSAB_CMD_COLOR_B = 24;
var INDSAB_CMD_COLOR_A = 28;
var INDSAB_CMD_STYLE = 32;
var INDSAB_CMD_PANE = 36;
var INDSAB_CMD_BAND_ALT_OFF = 40;
var INDSAB_CMD_LINE_WIDTH = 44;
var INDSAB_CMD_FLAG_MASK = 48;
var INDSAB_CMD_VALUE_MIN = 52;
var INDSAB_CMD_VALUE_MAX = 56;
var INDSAB_ARENA_OFF = INDSAB_HDR_BYTES;
var INDSAB_BYTES = INDSAB_ARENA_OFF + MAX_ARENA_F32 * 4;

// crates/mochart-wasm-new/src/demo/data_worker.js
var WORKER_BUILD_VERSION = "20260309b";
var WASM_GLUE_VERSION = "20260309b";
var WASM_MODULE_PATHS = [
  `../../../../src/pkg/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`,
  `../pkg/mochart_wasm_new.js?v=${WASM_GLUE_VERSION}`
];
var WASM_BINARY_PATHS = [
  `../../../../src/pkg/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`,
  `../pkg/mochart_wasm_new_bg.wasm?v=${WASM_GLUE_VERSION}`
];
var WasmModule = null;
var _wasmInitPromise = null;
var _workerInitState = 0;
var DPR = Math.ceil(self.devicePixelRatio || 2);
self.addEventListener("error", (ev) => {
  try {
    const msg = ev.message || String(ev);
    console.error("[data_worker] global error:", ev);
    self.postMessage({ type: "error", message: String(msg) });
  } catch (e) {}
});
self.addEventListener("unhandledrejection", (ev) => {
  try {
    console.error("[data_worker] unhandledrejection:", ev);
    const reason = ev.reason ? ev.reason.stack || String(ev.reason) : "unknown";
    self.postMessage({ type: "error", message: String(reason) });
  } catch (e) {}
});
var ctrl;
var frameCtrl;
var fdbView;
var store;
var plan;
var wasmMemory;
var totalBars = 0;
var frameSeq = 0;
var _sma1 = 5;
var _sma2 = 25;
var _sma3 = 75;
var _useLegacyDefaultIndicators = true;
var _baseIndicators = [];
var _extraIndicators = [];
var _extraClientToSlotId = new Map;
var workerSlotId = 0;
var ANN_KIND_MARKER = 0;
var ANN_KIND_HLINE = 1;
var ANN_KIND_ZONE = 2;
var ANN_KIND_TEXT = 3;
var ANN_KIND_EVENT = 4;
var _annKindById = new Map;
var _overlayRevision = 0;
var _overlayScratchWords = null;
var KIND_TO_U8 = Object.freeze({ SMA: 0, EMA: 1, BB: 2, RSI: 3, MACD: 4, ATR: 5, OBV: 6, VOLUME: 7 });
var STYLE_TO_U8 = Object.freeze({ LINE: 0, THICKLINE: 1, HISTOGRAM: 2, BAND: 3 });
var PANE_TO_U8 = Object.freeze({ MAIN: 0, SUB1: 1, SUB2: 2 });
var _paneGapPx = 8;
var _paneWeights = [3, 1, 1];
function _toKindU8(kind) {
  if (typeof kind === "number")
    return kind & 255;
  if (typeof kind === "string")
    return KIND_TO_U8[kind.toUpperCase()] ?? 0;
  return 0;
}
function _toStyleU8(style) {
  if (typeof style === "number")
    return style & 255;
  if (typeof style === "string")
    return STYLE_TO_U8[style.toUpperCase()] ?? 1;
  return 1;
}
function _toPaneU8(pane) {
  if (typeof pane === "number")
    return pane & 255;
  if (typeof pane === "string") {
    const mapped = PANE_TO_U8[pane.toUpperCase()];
    if (mapped != null)
      return mapped;
    if (pane.startsWith("pane-")) {
      const idx = Number.parseInt(pane.slice(5), 10);
      if (Number.isFinite(idx) && idx >= 0)
        return idx & 255;
    }
  }
  return 0;
}
function _sanitizeExtraIndicator(msg) {
  return {
    id: msg.id,
    kind: _toKindU8(msg.kind),
    period: (msg.period | 0) > 0 ? msg.period | 0 : 14,
    pane: _toPaneU8(msg.pane),
    style: _toStyleU8(msg.style),
    r: Number.isFinite(msg.r) ? msg.r : 0.2,
    g: Number.isFinite(msg.g) ? msg.g : 0.6,
    b: Number.isFinite(msg.b) ? msg.b : 0.9,
    a: Number.isFinite(msg.a) ? msg.a : 1,
    lineWidth: Number.isFinite(msg.lineWidth) ? msg.lineWidth : 1.5,
    slow: (msg.slow | 0) > 0 ? msg.slow | 0 : undefined,
    signal: (msg.signal | 0) > 0 ? msg.signal | 0 : undefined,
    stdDev: Number.isFinite(msg.stdDev) ? msg.stdDev : undefined
  };
}
function _isForCurrentSlot(message) {
  if (message == null || message.slotId == null)
    return true;
  return (message.slotId | 0) >>> 0 === workerSlotId;
}
function _decodeAnnotationKind(value) {
  if (typeof value !== "string")
    return ANN_KIND_EVENT;
  const k = value.toLowerCase();
  if (k === "marker")
    return ANN_KIND_MARKER;
  if (k === "hline")
    return ANN_KIND_HLINE;
  if (k === "zone")
    return ANN_KIND_ZONE;
  if (k === "text")
    return ANN_KIND_TEXT;
  return ANN_KIND_EVENT;
}
function _resetAnnState() {
  _annKindById.clear();
  if (WasmModule && typeof WasmModule.overlay_reset_state === "function") {
    WasmModule.overlay_reset_state();
  }
}
function _syncAnnStatsToRustAndSab() {
  if (!WasmModule || !wasmMemory || !indHdrView)
    return;
  if (typeof WasmModule.overlay_pack_state_std430_ptr !== "function")
    return;
  const ptr = WasmModule.overlay_pack_state_std430_ptr();
  if (!Number.isFinite(ptr) || ptr <= 0)
    return;
  const wordBase = ptr >>> 2;
  if (!_overlayScratchWords || _overlayScratchWords.buffer !== wasmMemory.buffer) {
    _overlayScratchWords = new Uint32Array(wasmMemory.buffer);
  }
  for (let i = 0;i < INDSAB_OVERLAY_STD430_WORDS; i++) {
    indHdrView.setUint32(INDSAB_OVERLAY_STD430_OFF + i * 4, _overlayScratchWords[wordBase + i] >>> 0, true);
  }
  _overlayRevision = _overlayRevision + 1 >>> 0;
  indHdrView.setUint32(INDSAB_OVERLAY_REV_OFF, _overlayRevision, true);
}
function _applyAnnAdd(message) {
  const ann = message.annotation;
  if (!ann || typeof ann !== "object")
    return;
  const nextKind = _decodeAnnotationKind(ann.type);
  const id = typeof ann.id === "string" ? ann.id : undefined;
  if (id) {
    const prevKind = _annKindById.get(id);
    if (prevKind != null) {
      if (typeof WasmModule.overlay_update_kind === "function") {
        WasmModule.overlay_update_kind(prevKind, nextKind);
      }
    } else if (typeof WasmModule.overlay_add_kind === "function") {
      WasmModule.overlay_add_kind(nextKind);
    }
    _annKindById.set(id, nextKind);
  } else if (typeof WasmModule.overlay_add_kind === "function") {
    WasmModule.overlay_add_kind(nextKind);
  }
  _syncAnnStatsToRustAndSab();
}
function _applyAnnUpdate(message) {
  const id = typeof message.id === "string" ? message.id : undefined;
  if (!id)
    return;
  const prevKind = _annKindById.get(id);
  if (prevKind == null)
    return;
  const patch = message.patch;
  if (!patch || typeof patch !== "object" || !("type" in patch))
    return;
  const nextKind = _decodeAnnotationKind(patch.type);
  if (nextKind === prevKind)
    return;
  if (typeof WasmModule.overlay_update_kind === "function") {
    WasmModule.overlay_update_kind(prevKind, nextKind);
  }
  _annKindById.set(id, nextKind);
  _syncAnnStatsToRustAndSab();
}
function _applyAnnRemove(message) {
  const id = typeof message.id === "string" ? message.id : undefined;
  if (!id)
    return;
  const prevKind = _annKindById.get(id);
  if (prevKind == null)
    return;
  _annKindById.delete(id);
  if (typeof WasmModule.overlay_remove_kind === "function") {
    WasmModule.overlay_remove_kind(prevKind);
  }
  _syncAnnStatsToRustAndSab();
}
function _applyAnnBulk(message) {
  const anns = Array.isArray(message.annotations) ? message.annotations : [];
  _resetAnnState();
  for (let i = 0;i < anns.length; i++) {
    const ann = anns[i];
    if (!ann || typeof ann !== "object")
      continue;
    const kind = _decodeAnnotationKind(ann.type);
    const id = typeof ann.id === "string" ? ann.id : undefined;
    if (id)
      _annKindById.set(id, kind);
    if (typeof WasmModule.overlay_add_kind === "function") {
      WasmModule.overlay_add_kind(kind);
    }
  }
  _syncAnnStatsToRustAndSab();
}
function _applyAnnClear() {
  _resetAnnState();
  _syncAnnStatsToRustAndSab();
}
var frameSAB;
var indSab;
var indHdrView;
var slotFlagMask = null;
var _dstOpen;
var _dstHigh;
var _dstLow;
var _dstClose;
var _dstVol;
var _dstTime;
var _lastWasmBuf = null;
var _wasmF32 = null;
var _wasmF64 = null;
var _dstArena = null;
var _dstArenaCap = 0;
function _refreshWasmViews() {
  const buf = wasmMemory.buffer;
  if (buf !== _lastWasmBuf) {
    _lastWasmBuf = buf;
    _wasmF32 = new Float32Array(buf);
    _wasmF64 = new Float64Array(buf);
  }
}
async function ensureWasmInitialized() {
  if (!WasmModule) {
    let loaded = null;
    let lastError = null;
    for (let i = 0;i < WASM_MODULE_PATHS.length; i++) {
      const candidate = new URL(WASM_MODULE_PATHS[i], import.meta.url).href;
      try {
        loaded = await import(candidate);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!loaded) {
      throw lastError ?? new Error("failed to import mochart_wasm_new.js");
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
      for (let i = 0;i < WASM_BINARY_PATHS.length; i++) {
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
      throw lastError ?? new Error("failed to load mochart_wasm_new_bg.wasm");
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
  if (plan && plan.free) {
    plan.free();
  }
  plan = new WasmModule.ExecutionPlan;
  if (_useLegacyDefaultIndicators) {
    plan.add_indicator(0, sma1, 0, 1, 0, 0.56, 0.73, 1, 1.5);
    plan.add_indicator(0, sma2, 0, 1, 1, 0.76, 0.03, 1, 1.5);
    plan.add_indicator(0, sma3, 0, 1, 0.91, 0.12, 0.39, 1, 1.5);
    plan.add_indicator(3, 14, 1, 1, 0.61, 0.35, 0.71, 1, 1.5);
    plan.add_indicator(4, 12, 1, 1, 0.16, 0.5, 0.73, 1, 1.5);
    plan.add_indicator(7, 0, 2, 2, 0.2, 0.6, 0.9, 0.8, 1);
  } else {
    for (let i = 0;i < _baseIndicators.length; i++) {
      const base = _baseIndicators[i];
      const slotId = plan.add_indicator(base.kind, base.period, base.pane, base.style, base.r, base.g, base.b, base.a, base.lineWidth);
      if (base.kind === 4) {
        plan.set_macd_params(slotId, base.period, base.slow ?? 26, base.signal ?? 9);
      } else if (base.kind === 2 && Number.isFinite(base.stdDev)) {
        plan.set_bb_params(slotId, base.stdDev);
      }
    }
  }
  _extraClientToSlotId.clear();
  for (let i = 0;i < _extraIndicators.length; i++) {
    const e = _extraIndicators[i];
    const slotId = plan.add_indicator(e.kind, e.period, e.pane, e.style, e.r, e.g, e.b, e.a, e.lineWidth);
    if (e.kind === 4) {
      plan.set_macd_params(slotId, e.period, e.slow ?? 26, e.signal ?? 9);
    } else if (e.kind === 2 && Number.isFinite(e.stdDev)) {
      plan.set_bb_params(slotId, e.stdDev);
    }
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
self.onmessage = async (evt) => {
  if (evt.data.type !== "init" && !_isForCurrentSlot(evt.data)) {
    return;
  }
  if (evt.data.type === "ann_add") {
    _applyAnnAdd(evt.data);
    return;
  }
  if (evt.data.type === "ann_update") {
    _applyAnnUpdate(evt.data);
    return;
  }
  if (evt.data.type === "ann_remove") {
    _applyAnnRemove(evt.data);
    return;
  }
  if (evt.data.type === "ann_bulk") {
    _applyAnnBulk(evt.data);
    return;
  }
  if (evt.data.type === "ann_clear") {
    _applyAnnClear();
    return;
  }
  if (evt.data.type === "pane_config") {
    const nextGap = Number(evt.data.gap);
    if (Number.isFinite(nextGap) && nextGap >= 0) {
      _paneGapPx = nextGap;
    }
    const nextWeights = evt.data.weights;
    if (Array.isArray(nextWeights) && nextWeights.length > 0) {
      const clean = new Array(nextWeights.length);
      for (let i = 0;i < nextWeights.length; i++) {
        const w = Number(nextWeights[i]);
        clean[i] = Number.isFinite(w) && w > 0 ? w : 1;
      }
      _paneWeights = clean;
    }
    return;
  }
  if (evt.data.type === "set_data_binary") {
    if (!WasmModule || !wasmMemory)
      return;
    try {
      const { store: nextStore, barCount } = ingestBinaryOhlcvBuffer(evt.data.data);
      if (store && store.free)
        store.free();
      store = nextStore;
      totalBars = barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: "data_set", source: "binary", bars: barCount });
    } catch (err) {
      self.postMessage({ type: "error", message: `set_data_binary failed: ${String(err)}` });
    }
    return;
  }
  if (evt.data.type === "set_data_soa") {
    if (!WasmModule || !wasmMemory)
      return;
    try {
      const { store: nextStore, barCount } = ingestSoaPayload(evt.data, wasmMemory);
      if (store && store.free)
        store.free();
      store = nextStore;
      totalBars = barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: "data_set", source: "soa", bars: barCount });
    } catch (err) {
      self.postMessage({ type: "error", message: `set_data_soa failed: ${String(err)}` });
    }
    return;
  }
  if (evt.data.type === "set_data_url") {
    if (!WasmModule || !wasmMemory)
      return;
    try {
      const { url } = evt.data;
      const resp = await fetch(url);
      if (!resp.ok)
        throw new Error(`fetch ${url}: ${resp.status}`);
      const contentType = resp.headers.get("content-type") || "";
      let next;
      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        const json = await resp.json();
        next = ingestJsonBars(json, wasmMemory);
      } else {
        const ab = await resp.arrayBuffer();
        next = ingestBinaryOhlcvBuffer(ab);
      }
      if (store && store.free)
        store.free();
      store = next.store;
      totalBars = next.barCount;
      buildPlan(_sma1, _sma2, _sma3);
      self.postMessage({ type: "data_set", source: "url", bars: next.barCount });
    } catch (err) {
      self.postMessage({ type: "error", message: `set_data_url failed: ${String(err)}` });
    }
    return;
  }
  if (evt.data.type === "update_sma") {
    if (plan && WasmModule) {
      _sma1 = (evt.data.sma1 | 0) > 0 ? evt.data.sma1 | 0 : _sma1;
      _sma2 = (evt.data.sma2 | 0) > 0 ? evt.data.sma2 | 0 : _sma2;
      _sma3 = (evt.data.sma3 | 0) > 0 ? evt.data.sma3 | 0 : _sma3;
      buildPlan(_sma1, _sma2, _sma3);
    }
    return;
  }
  if (evt.data.type === "ep_add") {
    if (!plan || !WasmModule)
      return;
    if (evt.data.id === undefined || evt.data.id === null)
      return;
    const spec = _sanitizeExtraIndicator(evt.data);
    const exists = _extraIndicators.findIndex((x) => x.id === spec.id);
    if (exists >= 0)
      _extraIndicators[exists] = spec;
    else
      _extraIndicators.push(spec);
    buildPlan(_sma1, _sma2, _sma3);
    const vis = Math.max(1, Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS) || 200);
    plan.compile(vis);
    self.postMessage({ type: "ep_added", id: spec.id, slotId: _extraClientToSlotId.get(spec.id) ?? -1 });
    return;
  }
  if (evt.data.type === "ep_update") {
    if (!plan || !WasmModule)
      return;
    const id = evt.data.id;
    if (id === undefined || id === null)
      return;
    const idx = _extraIndicators.findIndex((x) => x.id === id);
    if (idx < 0) {
      self.postMessage({ type: "ep_error", id, message: "indicator not found" });
      return;
    }
    const cur = _extraIndicators[idx];
    const next = _sanitizeExtraIndicator({ ...cur, ...evt.data, id });
    _extraIndicators[idx] = next;
    buildPlan(_sma1, _sma2, _sma3);
    const vis = Math.max(1, Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS) || 200);
    plan.compile(vis);
    self.postMessage({ type: "ep_updated", id, slotId: _extraClientToSlotId.get(id) ?? -1 });
    return;
  }
  if (evt.data.type === "ep_remove") {
    if (!plan || !WasmModule)
      return;
    const id = evt.data.id;
    if (id === undefined || id === null)
      return;
    const before = _extraIndicators.length;
    _extraIndicators = _extraIndicators.filter((x) => x.id !== id);
    if (_extraIndicators.length === before) {
      self.postMessage({ type: "ep_error", id, message: "indicator not found" });
      return;
    }
    buildPlan(_sma1, _sma2, _sma3);
    const vis = Math.max(1, Atomics.load(ctrl, workerSlotId * STRIDE + VIS_BARS) || 200);
    plan.compile(vis);
    self.postMessage({ type: "ep_removed", id });
    return;
  }
  if (evt.data.type !== "init")
    return;
  if (_workerInitState === 2) {
    if (totalBars > 0)
      self.postMessage({ type: "ready", bars: totalBars });
    return;
  }
  if (_workerInitState === 1)
    return;
  _workerInitState = 1;
  const descriptor = evt.data.descriptor ?? {
    slotId: 0,
    ctrl: evt.data.ctrl,
    frameCtrl: evt.data.frameCtrl,
    frameBuf: evt.data.frameBuf,
    indSab: evt.data.indSab
  };
  workerSlotId = (descriptor.slotId | 0) >>> 0;
  const ctrlBuf = descriptor.ctrl;
  const frameCtrlBuf = descriptor.frameCtrl;
  const frameBuf = descriptor.frameBuf;
  const indSabBuf = descriptor.indSab;
  if (typeof evt.data.dpr === "number" && evt.data.dpr >= 1) {
    DPR = Math.ceil(evt.data.dpr);
  }
  console.log("[data_worker] init |", `slot=${workerSlotId}`, `dpr=${DPR}`, `worker=${WORKER_BUILD_VERSION}`, `wasmGlue=${WASM_GLUE_VERSION}`, `host=${evt.data.buildVersion ?? "n/a"}`);
  ctrl = new Int32Array(ctrlBuf);
  frameCtrl = new Int32Array(frameCtrlBuf);
  frameSAB = frameBuf;
  indSab = indSabBuf;
  fdbView = new DataView(frameBuf, 0, FBUF_HDR_BYTES);
  indHdrView = new DataView(indSab);
  _overlayRevision = 0;
  _dstOpen = new Float32Array(frameSAB, FBUF_OPEN_OFF, FRAME_MAX_BARS);
  _dstHigh = new Float32Array(frameSAB, FBUF_HIGH_OFF, FRAME_MAX_BARS);
  _dstLow = new Float32Array(frameSAB, FBUF_LOW_OFF, FRAME_MAX_BARS);
  _dstClose = new Float32Array(frameSAB, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
  _dstVol = new Float32Array(frameSAB, FBUF_VOL_OFF, FRAME_MAX_BARS);
  _dstTime = new Float64Array(frameSAB, FBUF_TIME_OFF, FRAME_MAX_BARS);
  try {
    await ensureWasmInitialized();
    _useLegacyDefaultIndicators = evt.data.skipDefaultIndicators !== true;
    _baseIndicators = [];
    if (!_useLegacyDefaultIndicators && Array.isArray(evt.data.initialIndicators)) {
      for (let i = 0;i < evt.data.initialIndicators.length; i++) {
        _baseIndicators.push(_sanitizeExtraIndicator({
          ...evt.data.initialIndicators[i],
          id: `base_${i}`
        }));
      }
    }
    if (evt.data.skipDefaultData === true) {
      store = new WasmModule.OhlcvStore(0.01, 100, 64, 1024);
      totalBars = 0;
    } else {
      const { store: s, barCount } = await loadBinaryOhlcv("/fixtures/MSFT.bin");
      store = s;
      totalBars = barCount;
      console.log(`[data_worker] ingested ${barCount} bars`);
    }
    buildPlan(_sma1, _sma2, _sma3);
    _syncAnnStatsToRustAndSab();
    console.log("[data_worker] ExecutionPlan compiled |", "slots:", plan.slot_count(), "| revision:", plan.revision());
    self.postMessage({ type: "ready", bars: totalBars });
    _workerInitState = 2;
    dataLoop();
  } catch (err) {
    _workerInitState = 0;
    console.error("[data_worker] init failed:", err);
    self.postMessage({ type: "error", message: String(err) });
  }
};
async function dataLoop() {
  const ci = workerSlotId;
  let lastWake = 0;
  while (true) {
    await Atomics.waitAsync(ctrl, ci * STRIDE + WAKE, lastWake).value;
    lastWake = Atomics.load(ctrl, ci * STRIDE + WAKE);
    const dirtyBits = Atomics.load(ctrl, ci * STRIDE + DIRTY);
    if (!(dirtyBits & GPU_DIRTY || dirtyBits & HUD_DIRTY))
      continue;
    const startBar = Atomics.load(ctrl, ci * STRIDE + START_BAR);
    const visBars = Atomics.load(ctrl, ci * STRIDE + VIS_BARS);
    const plotW = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_W));
    const plotH = i32ToF32(Atomics.load(ctrl, ci * STRIDE + PLOT_H));
    const flags = Atomics.load(ctrl, ci * STRIDE + FLAGS);
    const panOffsetPx = i32ToF32(Atomics.load(ctrl, ci * STRIDE + SUBPIXEL_PAN_X));
    if (plotW < 4 || plotH < 4 || visBars < 1)
      continue;
    const physW = Math.round(plotW * DPR);
    const physH = Math.round(plotH * DPR);
    const hasSubpixelPan = Math.abs(panOffsetPx) > 0.001;
    const frameStartBar = hasSubpixelPan ? Math.max(0, startBar - 1) : startBar;
    const frameVisibleBars = hasSubpixelPan ? Math.min(FRAME_MAX_BARS, visBars + 2) : visBars;
    store.decompress_view_window(frameStartBar, frameVisibleBars);
    const viewLen = store.view_len();
    const candleW = visBars > 0 ? Math.max(2 * DPR, Math.min(40 * DPR, physW / visBars * 0.8)) : 2 * DPR;
    const priceMin = store.view_price_min();
    const priceMax = store.view_price_max();
    if (plan.needs_recompile(viewLen)) {
      plan.compile(viewLen);
    }
    if (viewLen > 0) {
      plan.execute(store);
      _writeIndSab(visBars, plan.revision());
    }
    const viewLen2 = viewLen;
    if (viewLen2 > 0) {
      _refreshWasmViews();
      const oOff = store.view_open_ptr() >> 2;
      const hOff = store.view_high_ptr() >> 2;
      const lOff = store.view_low_ptr() >> 2;
      const cOff = store.view_close_ptr() >> 2;
      const vOff = store.view_volume_ptr() >> 2;
      const tOff = store.view_time_ptr() >> 3;
      _dstOpen.set(_wasmF32.subarray(oOff, oOff + viewLen2));
      _dstHigh.set(_wasmF32.subarray(hOff, hOff + viewLen2));
      _dstLow.set(_wasmF32.subarray(lOff, lOff + viewLen2));
      _dstClose.set(_wasmF32.subarray(cOff, cOff + viewLen2));
      _dstVol.set(_wasmF32.subarray(vOff, vOff + viewLen2));
      _dstTime.set(_wasmF64.subarray(tOff, tOff + viewLen2));
    }
    frameSeq++;
    fdbView.setUint32(FBUF_START_BAR, startBar, true);
    fdbView.setUint32(FBUF_VIS_BARS, visBars, true);
    fdbView.setUint32(FBUF_VIEW_LEN, viewLen2, true);
    fdbView.setUint32(FBUF_FRAME_START_BAR, frameStartBar, true);
    fdbView.setFloat32(FBUF_PRICE_MIN, priceMin, true);
    fdbView.setFloat32(FBUF_PRICE_MAX, priceMax, true);
    fdbView.setFloat32(FBUF_CANVAS_W, physW, true);
    fdbView.setFloat32(FBUF_CANVAS_H, physH, true);
    fdbView.setFloat32(FBUF_CANDLE_W, candleW, true);
    fdbView.setUint32(FBUF_FLAGS, flags, true);
    fdbView.setUint32(FBUF_SEQ, frameSeq, true);
    fdbView.setUint32(FBUF_TOTAL_BARS, totalBars, true);
    Atomics.store(frameCtrl, FCTRL_READY, frameSeq);
    Atomics.notify(frameCtrl, FCTRL_READY);
    Atomics.store(ctrl, ci * STRIDE + READY, lastWake);
    Atomics.notify(ctrl, ci * STRIDE + READY);
  }
}
function _writeIndSab(_visBars, revision) {
  const arenaLen = plan.arena_len();
  const cmdCount = plan.render_cmd_count();
  if (arenaLen > 0) {
    const arenaPtr = plan.arena_ptr();
    const arenaIdx = arenaPtr >> 2;
    _refreshWasmViews();
    if (arenaLen > _dstArenaCap) {
      _dstArena = new Float32Array(indSab, INDSAB_ARENA_OFF, arenaLen);
      _dstArenaCap = arenaLen;
    }
    _dstArena.set(_wasmF32.subarray(arenaIdx, arenaIdx + arenaLen));
  }
  for (let ci = 0;ci < cmdCount; ci++) {
    const base = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
    const colorPtr = plan.render_cmd_color_ptr(ci);
    const colorIdx = colorPtr >> 2;
    indHdrView.setUint32(base + INDSAB_CMD_SLOT_ID, plan.render_cmd_slot_id(ci), true);
    indHdrView.setUint32(base + INDSAB_CMD_ARENA_OFFSET, plan.render_cmd_arena_offset(ci), true);
    indHdrView.setUint32(base + INDSAB_CMD_BAR_COUNT, plan.render_cmd_bar_count(ci), true);
    indHdrView.setUint32(base + INDSAB_CMD_WARMUP, plan.render_cmd_warmup(ci), true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_R, _wasmF32[colorIdx], true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_G, _wasmF32[colorIdx + 1], true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_B, _wasmF32[colorIdx + 2], true);
    indHdrView.setFloat32(base + INDSAB_CMD_COLOR_A, _wasmF32[colorIdx + 3], true);
    indHdrView.setUint32(base + INDSAB_CMD_STYLE, plan.render_cmd_style(ci), true);
    indHdrView.setUint32(base + INDSAB_CMD_PANE, plan.render_cmd_pane(ci), true);
    indHdrView.setUint32(base + INDSAB_CMD_BAND_ALT_OFF, plan.render_cmd_band_alt_offset(ci), true);
    indHdrView.setFloat32(base + INDSAB_CMD_LINE_WIDTH, plan.render_cmd_line_width(ci) * DPR, true);
    const slotId = plan.render_cmd_slot_id(ci);
    const flagMask = slotFlagMask && slotId < slotFlagMask.length ? slotFlagMask[slotId] : 0;
    indHdrView.setUint32(base + INDSAB_CMD_FLAG_MASK, flagMask, true);
    indHdrView.setFloat32(base + INDSAB_CMD_VALUE_MIN, plan.render_cmd_value_min(ci), true);
    indHdrView.setFloat32(base + INDSAB_CMD_VALUE_MAX, plan.render_cmd_value_max(ci), true);
  }
  indHdrView.setUint32(INDSAB_ARENA_LEN, arenaLen, true);
  indHdrView.setUint32(INDSAB_CMD_COUNT, cmdCount, true);
  indHdrView.setUint32(INDSAB_REVISION, revision, true);
  indHdrView.setUint32(INDSAB_SEQ_OFF, frameSeq, true);
}
async function loadBinaryOhlcv(url) {
  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(`fetch ${url}: ${resp.status}`);
  const ab = await resp.arrayBuffer();
  return ingestBinaryOhlcvBuffer(ab);
}
function ingestBinaryOhlcvBuffer(ab) {
  const N = new Uint32Array(ab, 0, 1)[0] || 0;
  if (N <= 0) {
    const emptyStore = new WasmModule.OhlcvStore(0.01, 100, 64, 1024);
    return { store: emptyStore, barCount: 0 };
  }
  const nextStore = new WasmModule.OhlcvStore(0.01, 100, 64, 1024);
  const ingested = nextStore.ingest_binary_ohlcv(new Uint8Array(ab));
  return { store: nextStore, barCount: ingested | 0 };
}
function ingestSoaPayload(payload, memory) {
  const N = (payload.count | 0) >>> 0;
  if (N === 0) {
    const emptyStore = new WasmModule.OhlcvStore(0.01, 100, 64, 1024);
    return { store: emptyStore, barCount: 0 };
  }
  const time = new Float64Array(payload.time);
  const open = new Float32Array(payload.open);
  const high = new Float32Array(payload.high);
  const low = new Float32Array(payload.low);
  const close = new Float32Array(payload.close);
  const volume = new Float32Array(payload.volume);
  const nextStore = new WasmModule.OhlcvStore(0.01, 100, N + 64, 1024);
  new Float64Array(memory.buffer, nextStore.ingest_time_ptr(), N).set(time.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_open_ptr(), N).set(open.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_high_ptr(), N).set(high.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_low_ptr(), N).set(low.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_close_ptr(), N).set(close.subarray(0, N));
  new Float32Array(memory.buffer, nextStore.ingest_volume_ptr(), N).set(volume.subarray(0, N));
  return finalizeIngestedStore(nextStore, N);
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
  for (let i = 0;i < N; i++) {
    if (isTuple) {
      const t = arr[i];
      const tv = Number(t[0] ?? 0);
      time[i] = tv < 1000000000000 ? tv * 1000 : tv;
      open[i] = Number(t[1] ?? 0);
      high[i] = Number(t[2] ?? 0);
      low[i] = Number(t[3] ?? 0);
      close[i] = Number(t[4] ?? 0);
      volume[i] = Number(t[5] ?? 0);
    } else {
      const o = arr[i] ?? {};
      const tv = Number(o.time ?? 0);
      time[i] = tv < 1000000000000 ? tv * 1000 : tv;
      open[i] = Number(o.open ?? 0);
      high[i] = Number(o.high ?? 0);
      low[i] = Number(o.low ?? 0);
      close[i] = Number(o.close ?? 0);
      volume[i] = Number(o.volume ?? 0);
    }
  }
  return ingestSoaPayload({ count: N, time: time.buffer, open: open.buffer, high: high.buffer, low: low.buffer, close: close.buffer, volume: volume.buffer }, memory);
}
function finalizeIngestedStore(store2, count) {
  store2.configure_price_scale_from_ingest(count);
  store2.commit_ingestion(count);
  store2.free_ingest_buffers();
  return { store: store2, barCount: count };
}

//# debugId=5D2550E691818C0564756E2164756E21
//# sourceMappingURL=dataWorker.js.map
