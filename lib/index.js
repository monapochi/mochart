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

// src/pkg/mochart_wasm.js
var exports_mochart_wasm = {};
__export(exports_mochart_wasm, {
  williams_r_f32: () => williams_r_f32,
  wasm_ready: () => wasm_ready,
  validate_ptr_len_f32: () => validate_ptr_len_f32,
  stochastic_f32: () => stochastic_f32,
  sma_ptr: () => sma_ptr,
  sma_inplace_ptr: () => sma_inplace_ptr,
  sma_f32_ptr: () => sma_f32_ptr,
  sma_f32_len: () => sma_f32_len,
  sma_f32: () => sma_f32,
  rsi_f32: () => rsi_f32,
  obv_f32: () => obv_f32,
  nearest_index: () => nearest_index,
  min_max_f32_ptr: () => min_max_f32_ptr,
  min_max_f32: () => min_max_f32,
  mfi_f32: () => mfi_f32,
  macd_f32: () => macd_f32,
  lttb_downsample_ptr: () => lttb_downsample_ptr,
  lttb_downsample_len: () => lttb_downsample_len,
  lttb_downsample: () => lttb_downsample,
  initSync: () => initSync,
  ema_ptr: () => ema_ptr,
  ema_f32_ptr: () => ema_f32_ptr,
  ema_f32_len: () => ema_f32_len,
  ema_f32: () => ema_f32,
  default: () => __wbg_init2,
  cci_f32: () => cci_f32,
  bollinger_f32: () => bollinger_f32,
  atr_f32: () => atr_f32,
  adx_f32: () => adx_f32,
  WasmRingBuffer: () => WasmRingBuffer,
  WasmColumnarStore: () => WasmColumnarStore,
  MochartEngine: () => MochartEngine
});

class MochartEngine {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    MochartEngineFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_mochartengine_free(ptr, 0);
  }
  close_buffer() {
    const ret = wasm2.mochartengine_close_buffer(this.__wbg_ptr);
    return takeObject(ret);
  }
  close_ptr() {
    const ret = wasm2.mochartengine_close_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  compute_sma(name, period) {
    const ptr0 = passStringToWasm02(name, wasm2.__wbindgen_export2, wasm2.__wbindgen_export4);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.mochartengine_compute_sma(this.__wbg_ptr, ptr0, len0, period);
  }
  dispatch_compute(wgsl_code, entry_point, workgroup_x) {
    const ptr0 = passStringToWasm02(wgsl_code, wasm2.__wbindgen_export2, wasm2.__wbindgen_export4);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passStringToWasm02(entry_point, wasm2.__wbindgen_export2, wasm2.__wbindgen_export4);
    const len1 = WASM_VECTOR_LEN2;
    wasm2.mochartengine_dispatch_compute(this.__wbg_ptr, ptr0, len0, ptr1, len1, workgroup_x);
  }
  high_buffer() {
    const ret = wasm2.mochartengine_high_buffer(this.__wbg_ptr);
    return takeObject(ret);
  }
  high_ptr() {
    const ret = wasm2.mochartengine_high_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  hit_test(x, plot_x, plot_w, start, count) {
    const ret = wasm2.mochartengine_hit_test(this.__wbg_ptr, x, plot_x, plot_w, start, count);
    return ret;
  }
  indicator_len(name) {
    const ptr0 = passStringToWasm02(name, wasm2.__wbindgen_export2, wasm2.__wbindgen_export4);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.mochartengine_indicator_len(this.__wbg_ptr, ptr0, len0);
    return ret >>> 0;
  }
  indicator_ptr(name) {
    const ptr0 = passStringToWasm02(name, wasm2.__wbindgen_export2, wasm2.__wbindgen_export4);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.mochartengine_indicator_ptr(this.__wbg_ptr, ptr0, len0);
    return ret >>> 0;
  }
  init_webgpu(device, context) {
    wasm2.mochartengine_init_webgpu(this.__wbg_ptr, addHeapObject(device), addHeapObject(context));
  }
  len() {
    const ret = wasm2.mochartengine_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  low_buffer() {
    const ret = wasm2.mochartengine_low_buffer(this.__wbg_ptr);
    return takeObject(ret);
  }
  low_ptr() {
    const ret = wasm2.mochartengine_low_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  min_max_close_in_range(start, end) {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.mochartengine_min_max_close_in_range(retptr, this.__wbg_ptr, start, end);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  min_max_indicator_in_range(name, start, end) {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm02(name, wasm2.__wbindgen_export2, wasm2.__wbindgen_export4);
      const len0 = WASM_VECTOR_LEN2;
      wasm2.mochartengine_min_max_indicator_in_range(retptr, this.__wbg_ptr, ptr0, len0, start, end);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v2 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v2;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  min_max_price_in_range(start, end) {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.mochartengine_min_max_price_in_range(retptr, this.__wbg_ptr, start, end);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  constructor() {
    const ret = wasm2.mochartengine_new();
    this.__wbg_ptr = ret >>> 0;
    MochartEngineFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  open_buffer() {
    const ret = wasm2.mochartengine_open_buffer(this.__wbg_ptr);
    return takeObject(ret);
  }
  open_ptr() {
    const ret = wasm2.mochartengine_open_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  push_data(time, open, high, low, close, volume) {
    wasm2.mochartengine_push_data(this.__wbg_ptr, time, open, high, low, close, volume);
  }
  time_ptr() {
    const ret = wasm2.mochartengine_time_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  update_tail(time, open, high, low, close, volume) {
    wasm2.mochartengine_update_tail(this.__wbg_ptr, time, open, high, low, close, volume);
  }
  upload_to_gpu() {
    wasm2.mochartengine_upload_to_gpu(this.__wbg_ptr);
  }
  volume_buffer() {
    const ret = wasm2.mochartengine_volume_buffer(this.__wbg_ptr);
    return takeObject(ret);
  }
  volume_ptr() {
    const ret = wasm2.mochartengine_volume_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
}

class WasmColumnarStore {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    WasmColumnarStoreFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_wasmcolumnarstore_free(ptr, 0);
  }
  clear() {
    wasm2.wasmcolumnarstore_clear(this.__wbg_ptr);
  }
  close_ptr() {
    const ret = wasm2.wasmcolumnarstore_close_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  high_ptr() {
    const ret = wasm2.wasmcolumnarstore_high_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  len() {
    const ret = wasm2.wasmcolumnarstore_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  low_ptr() {
    const ret = wasm2.wasmcolumnarstore_low_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  min_max_close_in_range(start, end) {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmcolumnarstore_min_max_close_in_range(retptr, this.__wbg_ptr, start, end);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  constructor(capacity) {
    const ret = wasm2.wasmcolumnarstore_new(capacity);
    this.__wbg_ptr = ret >>> 0;
    WasmColumnarStoreFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  open_ptr() {
    const ret = wasm2.wasmcolumnarstore_open_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  push(time, open, high, low, close, volume) {
    wasm2.wasmcolumnarstore_push(this.__wbg_ptr, time, open, high, low, close, volume);
  }
  reserve(additional) {
    wasm2.wasmcolumnarstore_reserve(this.__wbg_ptr, additional);
  }
  time_ptr() {
    const ret = wasm2.wasmcolumnarstore_time_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  volume_ptr() {
    const ret = wasm2.wasmcolumnarstore_volume_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
}

class WasmRingBuffer {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    WasmRingBufferFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_wasmringbuffer_free(ptr, 0);
  }
  clear() {
    wasm2.wasmringbuffer_clear(this.__wbg_ptr);
  }
  close() {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmringbuffer_close(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  high() {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmringbuffer_high(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  is_full() {
    const ret = wasm2.wasmringbuffer_is_full(this.__wbg_ptr);
    return ret !== 0;
  }
  len() {
    const ret = wasm2.wasmringbuffer_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  low() {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmringbuffer_low(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  constructor(capacity) {
    const ret = wasm2.wasmringbuffer_new(capacity);
    this.__wbg_ptr = ret >>> 0;
    WasmRingBufferFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  open() {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmringbuffer_open(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  push(time, open, high, low, close, volume) {
    wasm2.wasmringbuffer_push(this.__wbg_ptr, time, open, high, low, close, volume);
  }
  time() {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmringbuffer_time(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF64FromWasm0(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 8, 8);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
  volume() {
    try {
      const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
      wasm2.wasmringbuffer_volume(retptr, this.__wbg_ptr);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var v1 = getArrayF32FromWasm02(r0, r1).slice();
      wasm2.__wbindgen_export3(r0, r1 * 4, 4);
      return v1;
    } finally {
      wasm2.__wbindgen_add_to_stack_pointer(16);
    }
  }
}
function adx_f32(high, low, close, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(high, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(low, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN2;
    wasm2.adx_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v4 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v4;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function atr_f32(high, low, close, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(high, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(low, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN2;
    wasm2.atr_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v4 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v4;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function bollinger_f32(values, period, std_dev) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.bollinger_f32(retptr, ptr0, len0, period, std_dev);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v2 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v2;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function cci_f32(high, low, close, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(high, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(low, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN2;
    wasm2.cci_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v4 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v4;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function ema_f32(values, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.ema_f32(retptr, ptr0, len0, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v2 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v2;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function ema_f32_len() {
  const ret = wasm2.ema_f32_len();
  return ret >>> 0;
}
function ema_f32_ptr(values, period) {
  const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.ema_f32_ptr(ptr0, len0, period);
  return ret >>> 0;
}
function ema_ptr(ptr, len, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    wasm2.ema_ptr(retptr, ptr, len, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v1 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v1;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function lttb_downsample(times, values, threshold) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF64ToWasm0(times, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    wasm2.lttb_downsample(retptr, ptr0, len0, ptr1, len1, threshold);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v3 = getArrayU32FromWasm0(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v3;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function lttb_downsample_len() {
  const ret = wasm2.lttb_downsample_len();
  return ret >>> 0;
}
function lttb_downsample_ptr(times, values, threshold) {
  const ptr0 = passArrayF64ToWasm0(times, wasm2.__wbindgen_export2);
  const len0 = WASM_VECTOR_LEN2;
  const ptr1 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
  const len1 = WASM_VECTOR_LEN2;
  const ret = wasm2.lttb_downsample_ptr(ptr0, len0, ptr1, len1, threshold);
  return ret >>> 0;
}
function macd_f32(values, fast, slow, signal) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.macd_f32(retptr, ptr0, len0, fast, slow, signal);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v2 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v2;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function mfi_f32(high, low, close, volume, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(high, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(low, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN2;
    const ptr3 = passArrayF32ToWasm0(volume, wasm2.__wbindgen_export2);
    const len3 = WASM_VECTOR_LEN2;
    wasm2.mfi_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v5 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v5;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function min_max_f32(values) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.min_max_f32(retptr, ptr0, len0);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v2 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v2;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function min_max_f32_ptr(ptr, len) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    wasm2.min_max_f32_ptr(retptr, ptr, len);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v1 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v1;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function nearest_index(times, target) {
  const ptr0 = passArrayF64ToWasm0(times, wasm2.__wbindgen_export2);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.nearest_index(ptr0, len0, target);
  return ret;
}
function obv_f32(close, volume) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(volume, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    wasm2.obv_f32(retptr, ptr0, len0, ptr1, len1);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v3 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v3;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function rsi_f32(values, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.rsi_f32(retptr, ptr0, len0, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v2 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v2;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function sma_f32(values, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.sma_f32(retptr, ptr0, len0, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v2 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v2;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function sma_f32_len() {
  const ret = wasm2.sma_f32_len();
  return ret >>> 0;
}
function sma_f32_ptr(values, period) {
  const ptr0 = passArrayF32ToWasm0(values, wasm2.__wbindgen_export2);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.sma_f32_ptr(ptr0, len0, period);
  return ret >>> 0;
}
function sma_inplace_ptr(dest_ptr, src_ptr, len, period) {
  wasm2.sma_inplace_ptr(dest_ptr, src_ptr, len, period);
}
function sma_ptr(ptr, len, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    wasm2.sma_ptr(retptr, ptr, len, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v1 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v1;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function stochastic_f32(high, low, close, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(high, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(low, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN2;
    wasm2.stochastic_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v4 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v4;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function validate_ptr_len_f32(ptr, len) {
  const ret = wasm2.validate_ptr_len_f32(ptr, len);
  return ret !== 0;
}
function wasm_ready() {
  const ret = wasm2.wasm_ready();
  return ret !== 0;
}
function williams_r_f32(high, low, close, period) {
  try {
    const retptr = wasm2.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passArrayF32ToWasm0(high, wasm2.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF32ToWasm0(low, wasm2.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF32ToWasm0(close, wasm2.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN2;
    wasm2.williams_r_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    var v4 = getArrayF32FromWasm02(r0, r1).slice();
    wasm2.__wbindgen_export3(r0, r1 * 4, 4);
    return v4;
  } finally {
    wasm2.__wbindgen_add_to_stack_pointer(16);
  }
}
function __wbg_get_imports2() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
      throw new Error(getStringFromWasm02(arg0, arg1));
    },
    __wbg_beginComputePass_42e9a9da563482ff: function(arg0) {
      const ret = getObject(arg0).beginComputePass();
      return addHeapObject(ret);
    },
    __wbg_createBuffer_2734875696a2a960: function(arg0, arg1) {
      const ret = getObject(arg0).createBuffer(getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_createCommandEncoder_9a4b87afd5ee393e: function(arg0) {
      const ret = getObject(arg0).createCommandEncoder();
      return addHeapObject(ret);
    },
    __wbg_createComputePipeline_f1c600498d741da7: function(arg0, arg1) {
      const ret = getObject(arg0).createComputePipeline(getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_createShaderModule_476b7eaa2403e9ff: function(arg0, arg1) {
      const ret = getObject(arg0).createShaderModule(getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_destroy_f3e2f26920d0ed32: function(arg0) {
      getObject(arg0).destroy();
    },
    __wbg_dispatchWorkgroups_79bc228f9c9118eb: function(arg0, arg1, arg2, arg3) {
      getObject(arg0).dispatchWorkgroups(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
    },
    __wbg_end_cb241de09cc48109: function(arg0) {
      getObject(arg0).end();
    },
    __wbg_finish_e1fd3acdab2f4fee: function(arg0) {
      const ret = getObject(arg0).finish();
      return addHeapObject(ret);
    },
    __wbg_new_361308b2356cecd0: function() {
      const ret = new Object;
      return addHeapObject(ret);
    },
    __wbg_new_3eb36ae241fe6f44: function() {
      const ret = new Array;
      return addHeapObject(ret);
    },
    __wbg_push_8ffdcb2063340ba5: function(arg0, arg1) {
      const ret = getObject(arg0).push(getObject(arg1));
      return ret;
    },
    __wbg_queue_c3943f5ea1534165: function(arg0) {
      const ret = getObject(arg0).queue;
      return addHeapObject(ret);
    },
    __wbg_setPipeline_9983f14b9f86b96f: function(arg0, arg1) {
      getObject(arg0).setPipeline(getObject(arg1));
    },
    __wbg_set_6cb8631f80447a67: function() {
      return handleError2(function(arg0, arg1, arg2) {
        const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
        return ret;
      }, arguments);
    },
    __wbg_submit_8cbcc62accd78b81: function(arg0, arg1) {
      getObject(arg0).submit(getObject(arg1));
    },
    __wbg_writeBuffer_2da69b04041a93de: function(arg0, arg1, arg2, arg3, arg4) {
      getObject(arg0).writeBuffer(getObject(arg1), arg2, getArrayU8FromWasm0(arg3, arg4));
    },
    __wbindgen_cast_0000000000000001: function(arg0) {
      const ret = arg0;
      return addHeapObject(ret);
    },
    __wbindgen_cast_0000000000000002: function(arg0, arg1) {
      const ret = getStringFromWasm02(arg0, arg1);
      return addHeapObject(ret);
    },
    __wbindgen_object_clone_ref: function(arg0) {
      const ret = getObject(arg0);
      return addHeapObject(ret);
    },
    __wbindgen_object_drop_ref: function(arg0) {
      takeObject(arg0);
    }
  };
  return {
    __proto__: null,
    "./mochart_wasm_bg.js": import0
  };
}
function addHeapObject(obj) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function getArrayF32FromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory02().subarray(ptr / 4, ptr / 4 + len);
}
function getArrayF64FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}
function getArrayU32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory02().subarray(ptr / 1, ptr / 1 + len);
}
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm2.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm2.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function getFloat32ArrayMemory02() {
  if (cachedFloat32ArrayMemory02 === null || cachedFloat32ArrayMemory02.byteLength === 0) {
    cachedFloat32ArrayMemory02 = new Float32Array(wasm2.memory.buffer);
  }
  return cachedFloat32ArrayMemory02;
}
function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm2.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}
function getStringFromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText2(ptr, len);
}
function getUint32ArrayMemory0() {
  if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm2.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}
function getUint8ArrayMemory02() {
  if (cachedUint8ArrayMemory02 === null || cachedUint8ArrayMemory02.byteLength === 0) {
    cachedUint8ArrayMemory02 = new Uint8Array(wasm2.memory.buffer);
  }
  return cachedUint8ArrayMemory02;
}
function getObject(idx) {
  return heap[idx];
}
function handleError2(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm2.__wbindgen_export(addHeapObject(e));
  }
}
function passArrayF32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getFloat32ArrayMemory02().set(arg, ptr / 4);
  WASM_VECTOR_LEN2 = arg.length;
  return ptr;
}
function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
  WASM_VECTOR_LEN2 = arg.length;
  return ptr;
}
function passStringToWasm02(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder2.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory02().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN2 = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory02();
  let offset = 0;
  for (;offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory02().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder2.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN2 = offset;
  return ptr;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
function decodeText2(ptr, len) {
  numBytesDecoded2 += len;
  if (numBytesDecoded2 >= MAX_SAFARI_DECODE_BYTES2) {
    cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder2.decode();
    numBytesDecoded2 = len;
  }
  return cachedTextDecoder2.decode(getUint8ArrayMemory02().subarray(ptr, ptr + len));
}
function __wbg_finalize_init2(instance, module) {
  wasm2 = instance.exports;
  wasmModule2 = module;
  cachedDataViewMemory0 = null;
  cachedFloat32ArrayMemory02 = null;
  cachedFloat64ArrayMemory0 = null;
  cachedUint32ArrayMemory0 = null;
  cachedUint8ArrayMemory02 = null;
  return wasm2;
}
async function __wbg_load2(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
function initSync(module) {
  if (wasm2 !== undefined)
    return wasm2;
  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports2();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init2(instance, module);
}
async function __wbg_init2(module_or_path) {
  if (wasm2 !== undefined)
    return wasm2;
  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (module_or_path === undefined) {
    module_or_path = new URL(/* @vite-ignore */ "mochart_wasm_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports2();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load2(await module_or_path, imports);
  return __wbg_finalize_init2(instance, module);
}
var MochartEngineFinalization, WasmColumnarStoreFinalization, WasmRingBufferFinalization, cachedDataViewMemory0 = null, cachedFloat32ArrayMemory02 = null, cachedFloat64ArrayMemory0 = null, cachedUint32ArrayMemory0 = null, cachedUint8ArrayMemory02 = null, heap, heap_next, cachedTextDecoder2, MAX_SAFARI_DECODE_BYTES2 = 2146435072, numBytesDecoded2 = 0, cachedTextEncoder2, WASM_VECTOR_LEN2 = 0, wasmModule2, wasm2;
var init_mochart_wasm = __esm(() => {
  if (Symbol.dispose)
    MochartEngine.prototype[Symbol.dispose] = MochartEngine.prototype.free;
  if (Symbol.dispose)
    WasmColumnarStore.prototype[Symbol.dispose] = WasmColumnarStore.prototype.free;
  if (Symbol.dispose)
    WasmRingBuffer.prototype[Symbol.dispose] = WasmRingBuffer.prototype.free;
  MochartEngineFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm2.__wbg_mochartengine_free(ptr >>> 0, 1));
  WasmColumnarStoreFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm2.__wbg_wasmcolumnarstore_free(ptr >>> 0, 1));
  WasmRingBufferFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm2.__wbg_wasmringbuffer_free(ptr >>> 0, 1));
  heap = new Array(128).fill(undefined);
  heap.push(undefined, null, true, false);
  heap_next = heap.length;
  cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
  cachedTextDecoder2.decode();
  cachedTextEncoder2 = new TextEncoder;
  if (!("encodeInto" in cachedTextEncoder2)) {
    cachedTextEncoder2.encodeInto = function(arg, view) {
      const buf = cachedTextEncoder2.encode(arg);
      view.set(buf);
      return {
        read: arg.length,
        written: buf.length
      };
    };
  }
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

// src/pkg/mochart_wasm_new.js
class ChartViewport {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ChartViewportFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_chartviewport_free(ptr, 0);
  }
  crosshair_out_ptr() {
    const ret = wasm.chartviewport_crosshair_out_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  is_at_right_edge() {
    const ret = wasm.chartviewport_is_at_right_edge(this.__wbg_ptr);
    return ret !== 0;
  }
  constructor(total_bars, visible_bars, plot_width_px) {
    const ret = wasm.chartviewport_new(total_bars, visible_bars, plot_width_px);
    this.__wbg_ptr = ret >>> 0;
    ChartViewportFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  pan_bars(delta_bars) {
    wasm.chartviewport_pan_bars(this.__wbg_ptr, delta_bars);
  }
  pan_px(delta_px) {
    wasm.chartviewport_pan_px(this.__wbg_ptr, delta_px);
  }
  pan_remainder_px() {
    const ret = wasm.chartviewport_pan_remainder_px(this.__wbg_ptr);
    return ret;
  }
  plot_width_px() {
    const ret = wasm.chartviewport_plot_width_px(this.__wbg_ptr);
    return ret;
  }
  set_plot_width(px) {
    wasm.chartviewport_set_plot_width(this.__wbg_ptr, px);
  }
  set_total_bars(n) {
    wasm.chartviewport_set_total_bars(this.__wbg_ptr, n);
  }
  set_viewport(start_bar, visible_bars) {
    wasm.chartviewport_set_viewport(this.__wbg_ptr, start_bar, visible_bars);
  }
  start_bar() {
    const ret = wasm.chartviewport_start_bar(this.__wbg_ptr);
    return ret >>> 0;
  }
  total_bars() {
    const ret = wasm.chartviewport_total_bars(this.__wbg_ptr);
    return ret >>> 0;
  }
  update_crosshair(x_px, y_px, price_min, price_max, plot_height_px) {
    wasm.chartviewport_update_crosshair(this.__wbg_ptr, x_px, y_px, price_min, price_max, plot_height_px);
  }
  update_crosshair_frame(x_px, y_px, price_min, price_max, plot_height_px, frame_start_bar, view_len) {
    wasm.chartviewport_update_crosshair_frame(this.__wbg_ptr, x_px, y_px, price_min, price_max, plot_height_px, frame_start_bar, view_len);
  }
  visible_bars() {
    const ret = wasm.chartviewport_visible_bars(this.__wbg_ptr);
    return ret >>> 0;
  }
  zoom(factor, center_px) {
    wasm.chartviewport_zoom(this.__wbg_ptr, factor, center_px);
  }
}
if (Symbol.dispose)
  ChartViewport.prototype[Symbol.dispose] = ChartViewport.prototype.free;

class ExecutionPlan {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ExecutionPlanFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_executionplan_free(ptr, 0);
  }
  add_indicator(kind, period, pane, render_style, r, g, b, a, line_width) {
    const ret = wasm.executionplan_add_indicator(this.__wbg_ptr, kind, period, pane, render_style, r, g, b, a, line_width);
    return ret;
  }
  arena_byte_size() {
    const ret = wasm.executionplan_arena_byte_size(this.__wbg_ptr);
    return ret >>> 0;
  }
  arena_len() {
    const ret = wasm.executionplan_arena_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  arena_ptr() {
    const ret = wasm.executionplan_arena_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  compile(visible_count) {
    wasm.executionplan_compile(this.__wbg_ptr, visible_count);
  }
  execute(store) {
    _assertClass(store, OhlcvStore);
    wasm.executionplan_execute(this.__wbg_ptr, store.__wbg_ptr);
  }
  needs_recompile(new_visible_count) {
    const ret = wasm.executionplan_needs_recompile(this.__wbg_ptr, new_visible_count);
    return ret !== 0;
  }
  constructor() {
    const ret = wasm.executionplan_new();
    this.__wbg_ptr = ret >>> 0;
    ExecutionPlanFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  remove_indicator(slot_id) {
    const ret = wasm.executionplan_remove_indicator(this.__wbg_ptr, slot_id);
    return ret !== 0;
  }
  render_cmd_arena_offset(idx) {
    const ret = wasm.executionplan_render_cmd_arena_offset(this.__wbg_ptr, idx);
    return ret >>> 0;
  }
  render_cmd_band_alt_offset(idx) {
    const ret = wasm.executionplan_render_cmd_band_alt_offset(this.__wbg_ptr, idx);
    return ret >>> 0;
  }
  render_cmd_bar_count(idx) {
    const ret = wasm.executionplan_render_cmd_bar_count(this.__wbg_ptr, idx);
    return ret >>> 0;
  }
  render_cmd_color_ptr(idx) {
    const ret = wasm.executionplan_render_cmd_color_ptr(this.__wbg_ptr, idx);
    return ret >>> 0;
  }
  render_cmd_count() {
    const ret = wasm.executionplan_render_cmd_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  render_cmd_line_width(idx) {
    const ret = wasm.executionplan_render_cmd_line_width(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_pane(idx) {
    const ret = wasm.executionplan_render_cmd_pane(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_slot_id(idx) {
    const ret = wasm.executionplan_render_cmd_slot_id(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_style(idx) {
    const ret = wasm.executionplan_render_cmd_style(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_sub_slot(idx) {
    const ret = wasm.executionplan_render_cmd_sub_slot(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_value_max(idx) {
    const ret = wasm.executionplan_render_cmd_value_max(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_value_min(idx) {
    const ret = wasm.executionplan_render_cmd_value_min(this.__wbg_ptr, idx);
    return ret;
  }
  render_cmd_warmup(idx) {
    const ret = wasm.executionplan_render_cmd_warmup(this.__wbg_ptr, idx);
    return ret >>> 0;
  }
  revision() {
    const ret = wasm.executionplan_revision(this.__wbg_ptr);
    return ret >>> 0;
  }
  set_bb_params(slot_id, std_dev) {
    wasm.executionplan_set_bb_params(this.__wbg_ptr, slot_id, std_dev);
  }
  set_macd_params(slot_id, fast, slow, signal) {
    wasm.executionplan_set_macd_params(this.__wbg_ptr, slot_id, fast, slow, signal);
  }
  slot_count() {
    const ret = wasm.executionplan_slot_count(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose)
  ExecutionPlan.prototype[Symbol.dispose] = ExecutionPlan.prototype.free;

class OhlcvStore {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    OhlcvStoreFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_ohlcvstore_free(ptr, 0);
  }
  base_price() {
    const ret = wasm.ohlcvstore_base_price(this.__wbg_ptr);
    return ret;
  }
  commit_ingestion(count) {
    wasm.ohlcvstore_commit_ingestion(this.__wbg_ptr, count);
  }
  compute_ema(period) {
    wasm.ohlcvstore_compute_ema(this.__wbg_ptr, period);
  }
  compute_rsi(period) {
    wasm.ohlcvstore_compute_rsi(this.__wbg_ptr, period);
  }
  compute_sma(period) {
    wasm.ohlcvstore_compute_sma(this.__wbg_ptr, period);
  }
  configure_price_scale_from_ingest(count) {
    wasm.ohlcvstore_configure_price_scale_from_ingest(this.__wbg_ptr, count);
  }
  decompress_all_ohlc() {
    const ret = wasm.ohlcvstore_decompress_all_ohlc(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  decompress_view_window(start, count) {
    wasm.ohlcvstore_decompress_view_window(this.__wbg_ptr, start, count);
  }
  free_ingest_buffers() {
    wasm.ohlcvstore_free_ingest_buffers(this.__wbg_ptr);
  }
  free_view_buffers() {
    wasm.ohlcvstore_free_view_buffers(this.__wbg_ptr);
  }
  indicator_len() {
    const ret = wasm.ohlcvstore_indicator_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  indicator_ptr() {
    const ret = wasm.ohlcvstore_indicator_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  indicator_valid_start() {
    const ret = wasm.ohlcvstore_indicator_valid_start(this.__wbg_ptr);
    return ret >>> 0;
  }
  ingest_binary_ohlcv(bytes) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ohlcvstore_ingest_binary_ohlcv(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
  }
  ingest_close_ptr() {
    const ret = wasm.ohlcvstore_ingest_close_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  ingest_high_ptr() {
    const ret = wasm.ohlcvstore_ingest_high_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  ingest_low_ptr() {
    const ret = wasm.ohlcvstore_ingest_low_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  ingest_open_ptr() {
    const ret = wasm.ohlcvstore_ingest_open_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  ingest_time_ptr() {
    const ret = wasm.ohlcvstore_ingest_time_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  ingest_volume_ptr() {
    const ret = wasm.ohlcvstore_ingest_volume_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  len() {
    const ret = wasm.ohlcvstore_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  constructor(tick_size, base_price, ingest_capacity, block_size) {
    const ret = wasm.ohlcvstore_new(tick_size, base_price, ingest_capacity, block_size);
    this.__wbg_ptr = ret >>> 0;
    OhlcvStoreFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  prepare_frame(canvas_w, canvas_h, candle_w, flags) {
    wasm.ohlcvstore_prepare_frame(this.__wbg_ptr, canvas_w, canvas_h, candle_w, flags);
  }
  tick_size() {
    const ret = wasm.ohlcvstore_tick_size(this.__wbg_ptr);
    return ret;
  }
  view_close_ptr() {
    const ret = wasm.ohlcvstore_view_close_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  view_high_ptr() {
    const ret = wasm.ohlcvstore_view_high_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  view_len() {
    const ret = wasm.ohlcvstore_view_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  view_low_ptr() {
    const ret = wasm.ohlcvstore_view_low_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  view_open_ptr() {
    const ret = wasm.ohlcvstore_view_open_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  view_price_max() {
    const ret = wasm.ohlcvstore_view_price_max(this.__wbg_ptr);
    return ret;
  }
  view_price_min() {
    const ret = wasm.ohlcvstore_view_price_min(this.__wbg_ptr);
    return ret;
  }
  view_time_ptr() {
    const ret = wasm.ohlcvstore_view_time_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  view_volume_ptr() {
    const ret = wasm.ohlcvstore_view_volume_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
}
if (Symbol.dispose)
  OhlcvStore.prototype[Symbol.dispose] = OhlcvStore.prototype.free;

class WasmRenderer {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    WasmRendererFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_wasmrenderer_free(ptr, 0);
  }
  constructor(_canvas_id) {
    const ptr0 = passStringToWasm0(_canvas_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasmrenderer_new(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0] >>> 0;
    WasmRendererFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
}
if (Symbol.dispose)
  WasmRenderer.prototype[Symbol.dispose] = WasmRenderer.prototype.free;
function overlay_pack_std430_ptr(marker_count, hline_count, zone_count, text_count, event_count) {
  const ret = wasm.overlay_pack_std430_ptr(marker_count, hline_count, zone_count, text_count, event_count);
  return ret >>> 0;
}
function overlay_std430_layout_align() {
  const ret = wasm.overlay_std430_layout_align();
  return ret >>> 0;
}
function overlay_std430_layout_bytes() {
  const ret = wasm.overlay_std430_layout_bytes();
  return ret >>> 0;
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_is_undefined_9e4d92534c42d778: function(arg0) {
      const ret = arg0 === undefined;
      return ret;
    },
    __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg_call_389efe28435a9388: function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
      }, arguments);
    },
    __wbg_document_ee35a3d3ae34ef6c: function(arg0) {
      const ret = arg0.document;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_getElementById_e34377b79d7285f6: function(arg0, arg1, arg2) {
      const ret = arg0.getElementById(getStringFromWasm0(arg1, arg2));
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_instanceof_HtmlCanvasElement_3f2f6e1edb1c9792: function(arg0) {
      let result;
      try {
        result = arg0 instanceof HTMLCanvasElement;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_instanceof_Window_ed49b2db8df90359: function(arg0) {
      let result;
      try {
        result = arg0 instanceof Window;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_new_no_args_1c7c842f08d00ebb: function(arg0, arg1) {
      const ret = new Function(getStringFromWasm0(arg0, arg1));
      return ret;
    },
    __wbg_static_accessor_GLOBAL_12837167ad935116: function() {
      const ret = typeof global === "undefined" ? null : global;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_GLOBAL_THIS_e628e89ab3b1c95f: function() {
      const ret = typeof globalThis === "undefined" ? null : globalThis;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_SELF_a621d3dfbb60d0ce: function() {
      const ret = typeof self === "undefined" ? null : self;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_WINDOW_f8727f0cf888e0bd: function() {
      const ret = typeof window === "undefined" ? null : window;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbindgen_cast_0000000000000001: function(arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm.__wbindgen_externrefs;
      let offset = 0;
      try {
        offset = table.grow(4);
      } catch (err) {
        if (table.length < 4) {
          throw err;
        }
      }
      table.set(0, undefined);
      table.set(offset + 0, undefined);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    }
  };
  return {
    __proto__: null,
    "./mochart_wasm_new_bg.js": import0
  };
}
var ChartViewportFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm.__wbg_chartviewport_free(ptr >>> 0, 1));
var ExecutionPlanFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm.__wbg_executionplan_free(ptr >>> 0, 1));
var OhlcvStoreFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm.__wbg_ohlcvstore_free(ptr >>> 0, 1));
var WasmRendererFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {}, unregister: () => {} } : new FinalizationRegistry((ptr) => wasm.__wbg_wasmrenderer_free(ptr >>> 0, 1));
function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_externrefs.set(idx, obj);
  return idx;
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
}
function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
var cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32ArrayMemory0;
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable0(e);
    wasm.__wbindgen_exn_store(idx);
  }
}
function isLikeNone(x) {
  return x === undefined || x === null;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (;offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedTextEncoder = new TextEncoder;
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasm;
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  wasmModule = module;
  cachedFloat32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
async function __wbg_init(module_or_path) {
  if (wasm !== undefined)
    return wasm;
  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (module_or_path === undefined) {
    module_or_path = new URL(/* @vite-ignore */ "mochart_wasm_new_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load(await module_or_path, imports);
  return __wbg_finalize_init(instance, module);
}

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
function buildCandidateUrls(kind) {
  const fileName = WASM_FILE_NAMES[kind];
  const urls = [];
  const overrideBase = resolveOverrideBaseUrl();
  if (overrideBase) {
    urls.push(new URL(fileName, overrideBase));
  }
  for (let index = 0;index < WASM_PATH_CANDIDATES.length; index++) {
    urls.push(new URL(`${WASM_PATH_CANDIDATES[index]}${fileName}`, import.meta.url));
  }
  return urls;
}
async function fetchMochartWasmBytes(kind) {
  const urls = buildCandidateUrls(kind);
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

// src/api/overlay/hudPainter.ts
var OVERLAY_STD430_WORDS = 8;
var OVERLAY_STD430_BYTES = OVERLAY_STD430_WORDS * 4;
var OVERLAY_STD430_ALIGN = 16;
var OVERLAY_KIND_MARKER = 1 << 0;
var OVERLAY_KIND_HLINE = 1 << 1;
var OVERLAY_KIND_ZONE = 1 << 2;
var OVERLAY_KIND_TEXT = 1 << 3;
var OVERLAY_KIND_EVENT = 1 << 4;
var overlayStatsReady = false;
var overlayStatsLoadStarted = false;
var overlayStatsLoadFailed = false;
var overlayStatsInitPromise = null;
var overlayStatsMemory = null;
var overlayPackStd430PtrFn = null;
var overlayScratchWords = null;
var overlayScratchBuffer = null;
function buildKindMask(markerCount, hlineCount, zoneCount, textCount, eventCount) {
  let mask = 0;
  if (markerCount > 0)
    mask |= OVERLAY_KIND_MARKER;
  if (hlineCount > 0)
    mask |= OVERLAY_KIND_HLINE;
  if (zoneCount > 0)
    mask |= OVERLAY_KIND_ZONE;
  if (textCount > 0)
    mask |= OVERLAY_KIND_TEXT;
  if (eventCount > 0)
    mask |= OVERLAY_KIND_EVENT;
  return mask;
}
function startOverlayStatsLoad() {
  if (overlayStatsReady || overlayStatsLoadStarted || overlayStatsLoadFailed) {
    return;
  }
  overlayStatsLoadStarted = true;
  loadOverlayStatsBindings();
}
async function loadOverlayStatsBindings() {
  try {
    const wasmBytes = await fetchMochartWasmBytes("new");
    if (!overlayStatsInitPromise) {
      overlayStatsInitPromise = __wbg_init({ module_or_path: wasmBytes });
    }
    const initOutput = await overlayStatsInitPromise;
    const layoutBytes = overlay_std430_layout_bytes();
    const layoutAlign = overlay_std430_layout_align();
    if (layoutBytes !== OVERLAY_STD430_BYTES || layoutAlign !== OVERLAY_STD430_ALIGN) {
      overlayStatsLoadFailed = true;
      return;
    }
    overlayStatsMemory = initOutput.memory;
    overlayPackStd430PtrFn = overlay_pack_std430_ptr;
    overlayStatsReady = true;
  } catch {
    overlayStatsInitPromise = null;
    overlayStatsLoadFailed = true;
  }
}
function tryReadPackedHudStats(markerCount, hlineCount, zoneCount, textCount, eventCount) {
  if (!overlayStatsReady || !overlayStatsMemory || !overlayPackStd430PtrFn) {
    return null;
  }
  const ptr = overlayPackStd430PtrFn(markerCount, hlineCount, zoneCount, textCount, eventCount);
  if ((ptr & 3) !== 0)
    return null;
  const memoryBuffer = overlayStatsMemory.buffer;
  if (overlayScratchBuffer !== memoryBuffer) {
    overlayScratchWords = new Uint32Array(memoryBuffer);
    overlayScratchBuffer = memoryBuffer;
  }
  if (!overlayScratchWords)
    return null;
  const baseWord = ptr >>> 2;
  if (baseWord + OVERLAY_STD430_WORDS > overlayScratchWords.length)
    return null;
  const packedTotal = overlayScratchWords[baseWord];
  const packedMarker = overlayScratchWords[baseWord + 1];
  const packedHline = overlayScratchWords[baseWord + 2];
  const packedZone = overlayScratchWords[baseWord + 3];
  const packedText = overlayScratchWords[baseWord + 4];
  const packedEvent = overlayScratchWords[baseWord + 5];
  const packedMask = overlayScratchWords[baseWord + 6];
  if (packedMarker !== markerCount || packedHline !== hlineCount || packedZone !== zoneCount || packedText !== textCount || packedEvent !== eventCount) {
    return null;
  }
  return {
    totalCount: packedTotal,
    kindMask: packedMask
  };
}
function buildHudOverlaySnapshot(annotations) {
  startOverlayStatsLoad();
  let markerCount = 0;
  let hlineCount = 0;
  let zoneCount = 0;
  let textCount = 0;
  let eventCount = 0;
  for (let i = 0;i < annotations.length; i++) {
    const ann = annotations[i];
    if (ann.type === "marker")
      markerCount++;
    else if (ann.type === "hline")
      hlineCount++;
    else if (ann.type === "zone")
      zoneCount++;
    else if (ann.type === "text")
      textCount++;
    else if (ann.type === "event")
      eventCount++;
  }
  const fallbackTotal = markerCount + hlineCount + zoneCount + textCount + eventCount;
  const fallbackKindMask = buildKindMask(markerCount, hlineCount, zoneCount, textCount, eventCount);
  const packed = tryReadPackedHudStats(markerCount, hlineCount, zoneCount, textCount, eventCount);
  return {
    markerCount,
    hlineCount,
    zoneCount,
    textCount,
    eventCount,
    totalCount: packed?.totalCount ?? fallbackTotal,
    kindMask: packed?.kindMask ?? fallbackKindMask
  };
}

// src/api/overlay/overlayController.ts
var DEFAULT_ENTRY_COLOR = [0, 0.8, 0.2, 1];
var DEFAULT_EXIT_COLOR = [0.9, 0.2, 0.2, 1];
var DEFAULT_PROFIT_ZONE = [0, 0.8, 0.2, 0.08];
var DEFAULT_LOSS_ZONE = [0.9, 0.2, 0.2, 0.08];
var DEFAULT_SL_COLOR = [0.9, 0.2, 0.2, 0.8];
var DEFAULT_TP_COLOR = [0, 0.8, 0.2, 0.8];
function rgbaToCss(color) {
  if (!color)
    return;
  const r = Math.max(0, Math.min(255, Math.floor(color[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.floor(color[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.floor(color[2] * 255)));
  const a = Math.max(0, Math.min(1, color[3]));
  return `rgba(${r},${g},${b},${a})`;
}
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
function createOverlayController(nextAnnotationId) {
  const annotations = new Map;
  let tradeAnnotationIds = [];
  let hudSnapshot = buildHudOverlaySnapshot([]);
  let overlayRevision = 0;
  const rebuildHudSnapshot = () => {
    const values = [];
    for (const value of annotations.values())
      values.push(value);
    hudSnapshot = buildHudOverlaySnapshot(values);
    overlayRevision += 1;
  };
  const buildOverlayPrimitives = () => {
    const primitives = [];
    for (const ann of annotations.values()) {
      if (!ann.id)
        continue;
      if (ann.type === "marker") {
        primitives.push({
          type: "marker",
          id: ann.id,
          time: ann.time,
          price: ann.price,
          shape: ann.shape,
          color: ann.color,
          colorCss: rgbaToCss(ann.color)
        });
        continue;
      }
      if (ann.type === "hline") {
        primitives.push({
          type: "hline",
          id: ann.id,
          time: ann.time,
          timeEnd: ann.timeEnd,
          price: ann.price,
          color: ann.color,
          colorCss: rgbaToCss(ann.color),
          dash: ann.dash
        });
        continue;
      }
      if (ann.type === "zone") {
        primitives.push({
          type: "zone",
          id: ann.id,
          time: ann.time,
          timeEnd: ann.timeEnd,
          price: ann.price,
          priceEnd: ann.priceEnd,
          color: ann.color,
          colorCss: rgbaToCss(ann.color)
        });
      }
    }
    return primitives;
  };
  const makeAnnotationHandle = (ann) => {
    const id = ann.id ?? nextAnnotationId();
    const stored = { ...ann, id };
    annotations.set(id, stored);
    return {
      id,
      update(patch) {
        const existing = annotations.get(id);
        if (!existing)
          return;
        Object.assign(existing, patch);
      },
      remove() {
        annotations.delete(id);
      }
    };
  };
  const clearTradeRecords = () => {
    for (let i = 0;i < tradeAnnotationIds.length; i++) {
      annotations.delete(tradeAnnotationIds[i]);
    }
    tradeAnnotationIds = [];
    rebuildHudSnapshot();
  };
  return {
    addAnnotation(annotation) {
      const handle = makeAnnotationHandle(annotation);
      rebuildHudSnapshot();
      return handle;
    },
    addAnnotations(annotationsInput) {
      const handles = [];
      for (let i = 0;i < annotationsInput.length; i++) {
        handles.push(makeAnnotationHandle(annotationsInput[i]));
      }
      rebuildHudSnapshot();
      return handles;
    },
    updateAnnotation(id, patch) {
      const existing = annotations.get(id);
      if (!existing)
        return;
      Object.assign(existing, patch);
      rebuildHudSnapshot();
    },
    removeAnnotation(id) {
      annotations.delete(id);
      rebuildHudSnapshot();
    },
    clearAnnotations() {
      annotations.clear();
      tradeAnnotationIds = [];
      rebuildHudSnapshot();
    },
    getAnnotations() {
      const out = [];
      for (const value of annotations.values())
        out.push(value);
      return out;
    },
    getOverlayRevision() {
      return overlayRevision;
    },
    getOverlayPrimitives() {
      return buildOverlayPrimitives();
    },
    getHudSnapshot() {
      return hudSnapshot;
    },
    setTradeRecords(trades, displayOptions) {
      clearTradeRecords();
      const expanded = expandTradeRecords(trades, displayOptions);
      tradeAnnotationIds = [];
      for (let i = 0;i < expanded.length; i++) {
        const handle = makeAnnotationHandle(expanded[i]);
        tradeAnnotationIds.push(handle.id);
      }
      rebuildHudSnapshot();
    },
    clearTradeRecords
  };
}

// src/api/createChart.ts
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
var FRAME_MAX_BARS = 4096;
var FBUF_VIEW_LEN = 8;
var FBUF_TOTAL_BARS = 40;
var FBUF_PRICE_MIN = 48;
var FBUF_PRICE_MAX = 52;
var FBUF_FRAME_START_BAR = 88;
var FBUF_HDR_BYTES = 128;
var FBUF_OPEN_OFF = FBUF_HDR_BYTES + 0 * FRAME_MAX_BARS * 4;
var FBUF_HIGH_OFF = FBUF_HDR_BYTES + 1 * FRAME_MAX_BARS * 4;
var FBUF_LOW_OFF = FBUF_HDR_BYTES + 2 * FRAME_MAX_BARS * 4;
var FBUF_CLOSE_OFF = FBUF_HDR_BYTES + 3 * FRAME_MAX_BARS * 4;
var FBUF_VOL_OFF = FBUF_HDR_BYTES + 4 * FRAME_MAX_BARS * 4;
var FBUF_TIME_OFF = FBUF_HDR_BYTES + 5 * FRAME_MAX_BARS * 8;
var indicatorHandleCounter = 1;
var annotationIdCounter = 1;
var VIEWPORT_CMD_PAN_PX = 1;
var VIEWPORT_CMD_PAN_BARS = 2;
var VIEWPORT_CMD_ZOOM = 3;
var VIEWPORT_CMD_SET_VIEWPORT = 4;
var PENDING_VIEWPORT_COMMAND_CAPACITY = 1024;
function nextAnnotationId() {
  return `ann_${(annotationIdCounter++).toString(36)}`;
}
function allocCtrlBuf() {
  return new SharedArrayBuffer(STRIDE * 4);
}
function allocFrameCtrl() {
  return new SharedArrayBuffer(16);
}
function allocFrameBuf() {
  return new SharedArrayBuffer(FBUF_TIME_OFF + FRAME_MAX_BARS * 8);
}
function allocIndSab() {
  return new SharedArrayBuffer(256 * 1024);
}
var f32Bits = new DataView(new ArrayBuffer(4));
var chartViewportRuntimePromise = null;
function ensureChartViewportRuntime() {
  if (chartViewportRuntimePromise)
    return chartViewportRuntimePromise;
  chartViewportRuntimePromise = (async () => {
    try {
      const wasmBytes = await fetchMochartWasmBytes("new");
      const wasmExports = await __wbg_init({ module_or_path: wasmBytes });
      return { memory: wasmExports.memory };
    } catch (error) {
      console.error("[mochart] ChartViewport init failed:", error);
      return null;
    }
  })();
  return chartViewportRuntimePromise;
}
function f32ToI32(value) {
  f32Bits.setFloat32(0, value, true);
  return f32Bits.getInt32(0, true);
}
function i32ToF32(value) {
  f32Bits.setInt32(0, value, true);
  return f32Bits.getFloat32(0, true);
}
function normalizeTimestamp(time) {
  return time < 1000000000000 ? time * 1000 : time;
}
function normalizePaneTarget(pane) {
  if (typeof pane === "number") {
    if (!Number.isFinite(pane))
      return 0;
    return (pane | 0) & 255;
  }
  if (typeof pane !== "string")
    return "main";
  if (pane === "main" || pane === "sub1" || pane === "sub2")
    return pane;
  if (pane.startsWith("pane-")) {
    const raw = Number.parseInt(pane.slice(5), 10);
    if (Number.isFinite(raw) && raw >= 0)
      return raw & 255;
  }
  return "main";
}
function normalizePaneConfig(config) {
  const gap = Number.isFinite(config.gap) ? Math.max(0, Number(config.gap)) : 8;
  let weights = config.weights;
  if (!weights || weights.length === 0) {
    const main = Number.isFinite(config.main) ? Math.max(0, Number(config.main)) : 3;
    const sub1 = Number.isFinite(config.sub1) ? Math.max(0, Number(config.sub1)) : 1;
    const sub2 = Number.isFinite(config.sub2) ? Math.max(0, Number(config.sub2)) : 1;
    weights = [main, sub1, sub2];
  }
  const clean = new Array(weights.length);
  for (let index = 0;index < weights.length; index++) {
    const weight = Number(weights[index]);
    clean[index] = Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
  return { gap, weights: clean };
}
function toSoaTransferBuffers(input) {
  const arr = input;
  const count = arr.length;
  const time = new Float64Array(count);
  const open = new Float32Array(count);
  const high = new Float32Array(count);
  const low = new Float32Array(count);
  const close = new Float32Array(count);
  const volume = new Float32Array(count);
  const isTuple = count > 0 && Array.isArray(arr[0]);
  for (let index = 0;index < count; index++) {
    if (isTuple) {
      const tuple = arr[index];
      time[index] = normalizeTimestamp(Number(tuple[0] ?? 0));
      open[index] = Number(tuple[1] ?? 0);
      high[index] = Number(tuple[2] ?? 0);
      low[index] = Number(tuple[3] ?? 0);
      close[index] = Number(tuple[4] ?? 0);
      volume[index] = Number(tuple[5] ?? 0);
      continue;
    }
    const bar = arr[index];
    time[index] = normalizeTimestamp(Number(bar.time ?? 0));
    open[index] = Number(bar.open ?? 0);
    high[index] = Number(bar.high ?? 0);
    low[index] = Number(bar.low ?? 0);
    close[index] = Number(bar.close ?? 0);
    volume[index] = Number(bar.volume ?? 0);
  }
  return {
    count,
    time: time.buffer,
    open: open.buffer,
    high: high.buffer,
    low: low.buffer,
    close: close.buffer,
    volume: volume.buffer
  };
}
function indicatorToWorkerPayload(config, id) {
  const color = config.color ?? [0.2, 0.6, 0.9, 1];
  return {
    id,
    kind: config.kind,
    period: config.period,
    slow: config.slow,
    signal: config.signal,
    stdDev: config.stdDev,
    pane: normalizePaneTarget(config.pane),
    style: config.style,
    r: color[0],
    g: color[1],
    b: color[2],
    a: color[3],
    lineWidth: config.lineWidth,
    enabled: config.enabled
  };
}
function buildSurface(container) {
  const root = document.createElement("div");
  root.style.position = "relative";
  root.style.width = "100%";
  root.style.height = "100%";
  root.style.overflow = "hidden";
  const gpuCanvas = document.createElement("canvas");
  gpuCanvas.style.position = "absolute";
  gpuCanvas.style.inset = "0";
  gpuCanvas.style.width = "100%";
  gpuCanvas.style.height = "100%";
  gpuCanvas.style.display = "block";
  const hudCanvas = document.createElement("canvas");
  hudCanvas.style.position = "absolute";
  hudCanvas.style.inset = "0";
  hudCanvas.style.width = "100%";
  hudCanvas.style.height = "100%";
  hudCanvas.style.display = "block";
  hudCanvas.style.pointerEvents = "none";
  root.appendChild(gpuCanvas);
  root.appendChild(hudCanvas);
  container.replaceChildren(root);
  if (container.style.position === "") {
    container.style.position = "relative";
  }
  return { root, gpuCanvas, hudCanvas };
}
function postWorkerMessage(target, message, transfer) {
  target.postMessage(message, transfer ?? []);
}
function addMessageListener(target, listener) {
  target.addEventListener("message", listener);
}
function createChart(container, options) {
  if (typeof Worker === "undefined") {
    throw new Error("Mochart requires Worker support");
  }
  if (typeof HTMLCanvasElement === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) {
    throw new Error("Mochart requires OffscreenCanvas support");
  }
  const resolvedOptions = { ...options ?? {} };
  const { root, gpuCanvas, hudCanvas } = buildSurface(container);
  const ctrlBuf = allocCtrlBuf();
  const frameCtrl = allocFrameCtrl();
  const frameBuf = allocFrameBuf();
  const indSab = allocIndSab();
  const ctrl = new Int32Array(ctrlBuf);
  const frameHeader = new DataView(frameBuf, 0, FBUF_HDR_BYTES);
  const frameOpen = new Float32Array(frameBuf, FBUF_OPEN_OFF, FRAME_MAX_BARS);
  const frameHigh = new Float32Array(frameBuf, FBUF_HIGH_OFF, FRAME_MAX_BARS);
  const frameLow = new Float32Array(frameBuf, FBUF_LOW_OFF, FRAME_MAX_BARS);
  const frameClose = new Float32Array(frameBuf, FBUF_CLOSE_OFF, FRAME_MAX_BARS);
  const frameVol = new Float32Array(frameBuf, FBUF_VOL_OFF, FRAME_MAX_BARS);
  const frameTime = new Float64Array(frameBuf, FBUF_TIME_OFF, FRAME_MAX_BARS);
  const dpr = Math.max(1, Math.ceil(resolvedOptions.dpr ?? window.devicePixelRatio ?? 1));
  const managerSlotId = resolvedOptions.managerSlotId ?? 0;
  const dataWorker = resolvedOptions.dataWorker ?? new Worker(resolvedOptions.dataWorkerUrl ? new URL(resolvedOptions.dataWorkerUrl, import.meta.url) : new URL("./demo/dataWorker.js", import.meta.url), { type: "module" });
  const renderWorker = resolvedOptions.sharedRenderWorker ?? new Worker(resolvedOptions.renderWorkerUrl ? new URL(resolvedOptions.renderWorkerUrl, import.meta.url) : new URL("./demo/renderWorker.js", import.meta.url), { type: "module" });
  const ownsDataWorker = resolvedOptions.dataWorker == null;
  const ownsRenderWorker = resolvedOptions.sharedRenderWorker == null;
  const overlayController = createOverlayController(nextAnnotationId);
  const indicatorConfigs = new Map;
  const listeners = {
    crosshair: new Set,
    click: new Set,
    viewportChange: new Set
  };
  const visibleRangeView = new Int32Array(3);
  const pendingMessages = [];
  const pendingViewportCommandKinds = new Uint8Array(PENDING_VIEWPORT_COMMAND_CAPACITY);
  const pendingViewportCommandArg0 = new Float64Array(PENDING_VIEWPORT_COMMAND_CAPACITY);
  const pendingViewportCommandArg1 = new Float64Array(PENDING_VIEWPORT_COMMAND_CAPACITY);
  let pendingViewportCommandCount = 0;
  let destroyed = false;
  let dataWorkerReady = false;
  let totalBars = 0;
  let visibleBars = Math.max(10, resolvedOptions.visibleBars ?? 200);
  let startBar = 0;
  let paneConfig = resolvedOptions.panes ? normalizePaneConfig(resolvedOptions.panes) : { gap: 8, weights: [3, 1, 1] };
  let latestPerf = null;
  let wakeScheduled = false;
  let pendingGpuDirty = false;
  let pendingHudDirty = false;
  let isDragging = false;
  let dragLastX = 0;
  let activeTouchId = null;
  let touchGesture = "none";
  let touchInitDist = 0;
  let touchInitMidX = 0;
  const touchPointers = new Map;
  let prevStartBar = Number.NaN;
  let prevVisibleBars = Number.NaN;
  let prevPlotW = Number.NaN;
  let prevPlotH = Number.NaN;
  let prevFlags = Number.NaN;
  let prevPointerX = Number.NaN;
  let prevPointerY = Number.NaN;
  let prevPanOffsetPx = Number.NaN;
  let prevRightMarginBars = Number.NaN;
  let viewportSyncDirty = true;
  let rustViewportReady = false;
  let rustViewport = null;
  let rustViewportMemory = null;
  let rustCrosshairView = null;
  const FEWER_BARS = 0.85;
  const MORE_BARS = 1 / FEWER_BARS;
  const PAN_LOCK_PX = 12;
  const TOUCH_PAN_GAIN = 1.5;
  const TOUCH_PAN_LOCK_PX = 6;
  const PINCH_LOCK_RATIO = 0.03;
  const rightMarginRatio = Number.isFinite(resolvedOptions.rightMarginRatio) ? Math.max(0, Number(resolvedOptions.rightMarginRatio)) : 0;
  const refreshRustCrosshairView = () => {
    if (!rustViewport || !rustViewportMemory)
      return;
    if (rustCrosshairView && rustCrosshairView.buffer === rustViewportMemory.buffer)
      return;
    rustCrosshairView = new Float64Array(rustViewportMemory.buffer, rustViewport.crosshair_out_ptr(), 6);
  };
  const syncRustViewportConstraints = () => {
    if (!rustViewport)
      return;
    const plotWidth = Math.max(1, i32ToF32(Atomics.load(ctrl, PLOT_W)));
    rustViewport.set_total_bars(totalBars);
    if (rustViewport.plot_width_px() !== plotWidth) {
      rustViewport.set_plot_width(plotWidth);
      rustCrosshairView = null;
    }
    refreshRustCrosshairView();
  };
  const syncStateFromRustViewport = () => {
    if (!rustViewport)
      return;
    startBar = rustViewport.start_bar();
    visibleBars = rustViewport.visible_bars();
  };
  const syncViewportFromRuntime = () => {
    activateRustViewport();
    if (!rustViewport)
      return false;
    if (!viewportSyncDirty)
      return true;
    syncRustViewportConstraints();
    flushPendingViewportCommands();
    syncStateFromRustViewport();
    viewportSyncDirty = false;
    return true;
  };
  const applyRustViewport = (nextStartBar, nextVisibleBars) => {
    if (!rustViewport)
      return;
    syncRustViewportConstraints();
    rustViewport.set_viewport(Math.max(0, Math.trunc(nextStartBar)), Math.max(1, Math.trunc(nextVisibleBars)));
    syncStateFromRustViewport();
    viewportSyncDirty = false;
  };
  const enqueueViewportCommand = (kind, arg0, arg1) => {
    if (pendingViewportCommandCount >= PENDING_VIEWPORT_COMMAND_CAPACITY) {
      throw new Error("pending viewport command buffer overflow");
    }
    pendingViewportCommandKinds[pendingViewportCommandCount] = kind;
    pendingViewportCommandArg0[pendingViewportCommandCount] = arg0;
    pendingViewportCommandArg1[pendingViewportCommandCount] = arg1;
    pendingViewportCommandCount += 1;
  };
  const applyQueuedViewportCommand = (viewport, kind, arg0, arg1) => {
    switch (kind) {
      case VIEWPORT_CMD_PAN_PX:
        viewport.pan_px(arg0);
        return;
      case VIEWPORT_CMD_PAN_BARS:
        viewport.pan_bars(Math.trunc(arg0));
        return;
      case VIEWPORT_CMD_ZOOM:
        viewport.zoom(1 / arg0, arg1);
        return;
      case VIEWPORT_CMD_SET_VIEWPORT:
        viewport.set_viewport(Math.max(0, Math.trunc(arg0)), Math.max(1, Math.trunc(arg1)));
        return;
    }
  };
  const flushPendingViewportCommands = () => {
    if (!rustViewport || pendingViewportCommandCount === 0)
      return false;
    const prevStartBarValue = rustViewport.start_bar();
    const prevVisibleBarsValue = rustViewport.visible_bars();
    const prevPanOffsetPxValue = rustViewport.pan_remainder_px();
    for (let index = 0;index < pendingViewportCommandCount; index++) {
      applyQueuedViewportCommand(rustViewport, pendingViewportCommandKinds[index], pendingViewportCommandArg0[index], pendingViewportCommandArg1[index]);
    }
    pendingViewportCommandCount = 0;
    syncStateFromRustViewport();
    return startBar !== prevStartBarValue || visibleBars !== prevVisibleBarsValue || rustViewport.pan_remainder_px() !== prevPanOffsetPxValue;
  };
  const applyViewportPanPx = (deltaPx) => {
    if (syncViewportFromRuntime() && rustViewport) {
      const prevStartBarValue = rustViewport.start_bar();
      const prevVisibleBarsValue = rustViewport.visible_bars();
      const prevPanOffsetPxValue = rustViewport.pan_remainder_px();
      rustViewport.pan_px(deltaPx);
      syncStateFromRustViewport();
      if (startBar !== prevStartBarValue || visibleBars !== prevVisibleBarsValue)
        return "applied";
      return rustViewport.pan_remainder_px() !== prevPanOffsetPxValue ? "applied" : "unchanged";
    }
    enqueueViewportCommand(VIEWPORT_CMD_PAN_PX, deltaPx, 0);
    return "queued";
  };
  const applyViewportPanBars = (deltaBars) => {
    if (syncViewportFromRuntime() && rustViewport) {
      const prevStartBarValue = rustViewport.start_bar();
      const prevVisibleBarsValue = rustViewport.visible_bars();
      rustViewport.pan_bars(deltaBars);
      syncStateFromRustViewport();
      return startBar !== prevStartBarValue || visibleBars !== prevVisibleBarsValue ? "applied" : "unchanged";
    }
    enqueueViewportCommand(VIEWPORT_CMD_PAN_BARS, deltaBars, 0);
    return "queued";
  };
  const applyViewportZoom = (factor, centerX) => {
    if (syncViewportFromRuntime() && rustViewport) {
      const prevStartBarValue = rustViewport.start_bar();
      const prevVisibleBarsValue = rustViewport.visible_bars();
      rustViewport.zoom(1 / factor, centerX);
      syncStateFromRustViewport();
      return startBar !== prevStartBarValue || visibleBars !== prevVisibleBarsValue ? "applied" : "unchanged";
    }
    enqueueViewportCommand(VIEWPORT_CMD_ZOOM, factor, centerX);
    return "queued";
  };
  const applyViewportSet = (nextStartBar, nextVisibleBars) => {
    if (syncViewportFromRuntime() && rustViewport) {
      const prevStartBarValue = rustViewport.start_bar();
      const prevVisibleBarsValue = rustViewport.visible_bars();
      applyRustViewport(nextStartBar, nextVisibleBars);
      return startBar !== prevStartBarValue || visibleBars !== prevVisibleBarsValue ? "applied" : "unchanged";
    }
    enqueueViewportCommand(VIEWPORT_CMD_SET_VIEWPORT, nextStartBar, nextVisibleBars);
    return "queued";
  };
  const activateRustViewport = () => {
    if (!rustViewportReady || rustViewport)
      return;
    rustViewport = new ChartViewport(Math.max(1, totalBars), Math.max(1, visibleBars), Math.max(1, i32ToF32(Atomics.load(ctrl, PLOT_W))));
    viewportSyncDirty = true;
    syncRustViewportConstraints();
    if (totalBars > 0) {
      applyRustViewport(startBar, visibleBars);
    }
  };
  const initRustViewport = () => {
    ensureChartViewportRuntime().then((runtime) => {
      if (destroyed || !runtime)
        return;
      rustViewportReady = true;
      rustViewportMemory = runtime.memory;
      activateRustViewport();
      syncViewportFromRuntime();
      if (rustViewport && totalBars > 0) {
        scheduleWake(true, true);
      }
    });
  };
  const emit = (eventName, payload) => {
    const bucket = listeners[eventName];
    for (const callback of bucket) {
      callback(payload);
    }
  };
  const syncVisibleRangeView = () => {
    syncViewportFromRuntime();
    visibleRangeView[0] = startBar;
    visibleRangeView[1] = visibleBars;
    visibleRangeView[2] = totalBars;
    return visibleRangeView;
  };
  const writeVisibleRangeView = () => {
    visibleRangeView[0] = startBar;
    visibleRangeView[1] = visibleBars;
    visibleRangeView[2] = totalBars;
    return visibleRangeView;
  };
  const clampViewport = () => {
    syncViewportFromRuntime();
  };
  const emitViewportChange = () => {
    emit("viewportChange", { startBar, visibleBars, totalBars });
  };
  const publishViewportChange = () => {
    writeVisibleRangeView();
    emitViewportChange();
  };
  const isViewportAtRightEdge = () => {
    return syncViewportFromRuntime() ? rustViewport?.is_at_right_edge() ?? false : false;
  };
  const publishViewportStateToCtrl = (nextFlags, nextPanOffsetPx, nextRightMarginBars, nextGpuDirty, nextHudDirty) => {
    Atomics.store(ctrl, START_BAR, startBar);
    Atomics.store(ctrl, VIS_BARS, visibleBars);
    Atomics.store(ctrl, FLAGS, nextFlags);
    Atomics.store(ctrl, SUBPIXEL_PAN_X, f32ToI32(nextPanOffsetPx));
    Atomics.store(ctrl, RIGHT_MARGIN_BARS, nextRightMarginBars);
    Atomics.store(ctrl, DIRTY, (nextGpuDirty ? GPU_DIRTY | HUD_DIRTY : 0) | (nextHudDirty ? HUD_DIRTY : 0));
    const wake = Atomics.load(ctrl, WAKE) + 1 | 0;
    Atomics.store(ctrl, WAKE, wake);
    Atomics.notify(ctrl, WAKE);
  };
  const postToDataWorker = (message, transfer) => {
    if (destroyed)
      return;
    if (!dataWorkerReady && message.type !== "init") {
      pendingMessages.push({ message, transfer });
      return;
    }
    postWorkerMessage(dataWorker, message, transfer);
  };
  const postPaneConfig = () => {
    const payload = { gap: paneConfig.gap, weights: [...paneConfig.weights] };
    postToDataWorker({ type: "pane_config", slotId: managerSlotId, ...payload });
    postWorkerMessage(renderWorker, { type: "config", paneConfig: payload });
  };
  const postAnnotationBulkSnapshot = () => {
    postToDataWorker({
      type: "ann_bulk",
      slotId: managerSlotId,
      annotations: overlayController.getAnnotations()
    });
  };
  const scheduleWake = (gpuDirty, hudDirty) => {
    if (destroyed)
      return;
    pendingGpuDirty = pendingGpuDirty || gpuDirty;
    pendingHudDirty = pendingHudDirty || hudDirty;
    if (wakeScheduled)
      return;
    wakeScheduled = true;
    requestAnimationFrame(() => {
      wakeScheduled = false;
      if (destroyed)
        return;
      clampViewport();
      const currentFlags = rustViewport?.is_at_right_edge() ? AT_RIGHT_EDGE : 0;
      const currentPlotW = i32ToF32(Atomics.load(ctrl, PLOT_W));
      const currentPlotH = i32ToF32(Atomics.load(ctrl, PLOT_H));
      const currentPointerX = i32ToF32(Atomics.load(ctrl, POINTER_X));
      const currentPointerY = i32ToF32(Atomics.load(ctrl, POINTER_Y));
      const currentPanOffsetPx = rustViewport?.pan_remainder_px() ?? 0;
      const currentRightMarginBars = (currentFlags & AT_RIGHT_EDGE) !== 0 ? Math.max(0, Math.round(visibleBars * rightMarginRatio)) : 0;
      const nextGpuDirty = pendingGpuDirty || startBar !== prevStartBar || visibleBars !== prevVisibleBars || currentPlotW !== prevPlotW || currentPlotH !== prevPlotH || currentFlags !== prevFlags || currentPanOffsetPx !== prevPanOffsetPx || currentRightMarginBars !== prevRightMarginBars;
      const nextHudDirty = pendingHudDirty || nextGpuDirty || currentPointerX !== prevPointerX || currentPointerY !== prevPointerY;
      pendingGpuDirty = false;
      pendingHudDirty = false;
      if (!nextGpuDirty && !nextHudDirty)
        return;
      prevStartBar = startBar;
      prevVisibleBars = visibleBars;
      prevPlotW = currentPlotW;
      prevPlotH = currentPlotH;
      prevFlags = currentFlags;
      prevPointerX = currentPointerX;
      prevPointerY = currentPointerY;
      prevPanOffsetPx = currentPanOffsetPx;
      prevRightMarginBars = currentRightMarginBars;
      publishViewportStateToCtrl(currentFlags, currentPanOffsetPx, currentRightMarginBars, nextGpuDirty, nextHudDirty);
      publishViewportChange();
    });
  };
  const resize = () => {
    if (destroyed)
      return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(resolvedOptions.width ?? (rect.width || 900)));
    const height = Math.max(1, Math.round(resolvedOptions.height ?? (rect.height || 480)));
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    Atomics.store(ctrl, PLOT_W, f32ToI32(width));
    Atomics.store(ctrl, PLOT_H, f32ToI32(height));
    syncRustViewportConstraints();
    scheduleWake(true, true);
  };
  const updatePointerState = (x, y) => {
    Atomics.store(ctrl, POINTER_X, f32ToI32(x));
    Atomics.store(ctrl, POINTER_Y, f32ToI32(y));
    scheduleWake(false, true);
    if (listeners.crosshair.size === 0)
      return;
    const payload = buildCrosshairEvent(x, y);
    if (payload)
      emit("crosshair", payload);
  };
  const clearPointerState = () => {
    Atomics.store(ctrl, POINTER_X, f32ToI32(-1));
    Atomics.store(ctrl, POINTER_Y, f32ToI32(-1));
    scheduleWake(false, true);
  };
  const getPanOffsetPx = () => {
    return syncViewportFromRuntime() ? rustViewport?.pan_remainder_px() ?? 0 : 0;
  };
  const panByPixelDelta = (deltaPx) => {
    if (totalBars <= 0 || !Number.isFinite(deltaPx) || deltaPx === 0)
      return false;
    const result = applyViewportPanPx(deltaPx);
    if (result === "applied") {
      scheduleWake(true, true);
    }
    return result !== "unchanged";
  };
  const buildCrosshairEvent = (x, y) => {
    const plotH = Math.max(1, i32ToF32(Atomics.load(ctrl, PLOT_H)));
    const viewLen = frameHeader.getUint32(FBUF_VIEW_LEN, true);
    if (viewLen < 1)
      return null;
    const frameStartBar = frameHeader.getUint32(FBUF_FRAME_START_BAR, true);
    const priceMin = frameHeader.getFloat32(FBUF_PRICE_MIN, true);
    const priceMax = frameHeader.getFloat32(FBUF_PRICE_MAX, true);
    if (!syncViewportFromRuntime() || !rustViewport)
      return null;
    refreshRustCrosshairView();
    rustViewport.update_crosshair_frame(x, y, priceMin, priceMax, plotH, frameStartBar, viewLen);
    if (!rustCrosshairView)
      return null;
    const barIndex = Math.max(0, rustCrosshairView[0] | 0);
    const localIndex = Math.max(0, Math.min(viewLen - 1, rustCrosshairView[4] | 0));
    return {
      barIndex,
      price: rustCrosshairView[1],
      time: frameTime[localIndex],
      ohlcv: {
        open: frameOpen[localIndex],
        high: frameHigh[localIndex],
        low: frameLow[localIndex],
        close: frameClose[localIndex],
        volume: frameVol[localIndex]
      },
      x,
      y: rustCrosshairView[5]
    };
  };
  const gpuOffscreen = gpuCanvas.transferControlToOffscreen();
  const hudOffscreen = hudCanvas.transferControlToOffscreen();
  postWorkerMessage(renderWorker, {
    type: "init",
    descriptor: {
      slotId: managerSlotId,
      ctrl: ctrlBuf,
      frameCtrl,
      frameBuf,
      indSab
    },
    gpuCanvas: gpuOffscreen,
    hudCanvas: hudOffscreen,
    dpr
  }, [gpuOffscreen, hudOffscreen]);
  addMessageListener(dataWorker, (evt) => {
    const message = evt.data;
    if (destroyed)
      return;
    if (message.type === "ready") {
      dataWorkerReady = true;
      totalBars = message.bars ?? 0;
      viewportSyncDirty = true;
      clampViewport();
      while (pendingMessages.length > 0) {
        const next = pendingMessages.shift();
        if (!next)
          break;
        postWorkerMessage(dataWorker, next.message, next.transfer);
      }
      postPaneConfig();
      scheduleWake(true, true);
      return;
    }
    if (message.type === "data_set") {
      totalBars = message.bars ?? frameHeader.getUint32(FBUF_TOTAL_BARS, true);
      viewportSyncDirty = true;
      clampViewport();
      scheduleWake(true, true);
      return;
    }
    if (message.type === "error") {
      console.error("[mochart:data-worker]", message.message ?? "unknown error");
    }
  });
  addMessageListener(renderWorker, (evt) => {
    const message = evt.data;
    if (message.type === "perf") {
      latestPerf = evt.data;
      return;
    }
    if (message.type === "error") {
      console.error("[mochart:render-worker]", message.message ?? "unknown error");
    }
  });
  postWorkerMessage(dataWorker, {
    type: "init",
    descriptor: {
      slotId: managerSlotId,
      ctrl: ctrlBuf,
      frameCtrl,
      frameBuf,
      indSab
    },
    dpr,
    skipDefaultData: true,
    skipDefaultIndicators: true,
    initialIndicators: resolvedOptions.indicators?.map((indicator, index) => indicatorToWorkerPayload(indicator, index + 1)) ?? []
  });
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);
  root.style.cursor = "crosshair";
  root.style.touchAction = "none";
  root.addEventListener("pointerdown", (event) => {
    const rect = root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (event.pointerType === "mouse") {
      updatePointerState(x, y);
      isDragging = true;
      dragLastX = x;
      root.setPointerCapture(event.pointerId);
      return;
    }
    if (event.pointerType !== "touch")
      return;
    clearPointerState();
    touchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (activeTouchId == null) {
      activeTouchId = event.pointerId;
      dragLastX = x;
    }
    if (touchPointers.size === 2) {
      const pair = touchPointers.values();
      const first = pair.next().value;
      const second = pair.next().value;
      if (first && second) {
        touchInitDist = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        touchInitMidX = (first.clientX + second.clientX) * 0.5;
      }
      touchGesture = "none";
    }
    root.setPointerCapture(event.pointerId);
  });
  root.addEventListener("pointermove", (event) => {
    const rect = root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (event.pointerType === "mouse") {
      updatePointerState(x, y);
      if (!isDragging)
        return;
      if (panByPixelDelta(dragLastX - x)) {
        dragLastX = x;
      }
      return;
    }
    if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId))
      return;
    const prev = touchPointers.get(event.pointerId);
    if (!prev)
      return;
    const prevClientX = prev.clientX;
    const prevClientY = prev.clientY;
    prev.clientX = event.clientX;
    prev.clientY = event.clientY;
    if (touchPointers.size === 1 && activeTouchId === event.pointerId) {
      if (panByPixelDelta((dragLastX - x) * TOUCH_PAN_GAIN)) {
        dragLastX = x;
      }
      return;
    }
    if (touchPointers.size !== 2)
      return;
    const pair = touchPointers.entries();
    const first = pair.next().value;
    const second = pair.next().value;
    if (!first || !second)
      return;
    const [firstId, currentA] = first;
    const [secondId, currentB] = second;
    const prevAClientX = firstId === event.pointerId ? prevClientX : currentA.clientX;
    const prevAClientY = firstId === event.pointerId ? prevClientY : currentA.clientY;
    const prevBClientX = secondId === event.pointerId ? prevClientX : currentB.clientX;
    const prevBClientY = secondId === event.pointerId ? prevClientY : currentB.clientY;
    const currDist = Math.hypot(currentB.clientX - currentA.clientX, currentB.clientY - currentA.clientY);
    const currMidX = (currentA.clientX + currentB.clientX) * 0.5;
    if (touchGesture === "none") {
      if (touchInitDist > 0 && Math.abs(currDist / touchInitDist - 1) >= PINCH_LOCK_RATIO) {
        touchGesture = "zoom";
      } else if (Math.abs(currMidX - touchInitMidX) >= TOUCH_PAN_LOCK_PX) {
        touchGesture = "pan";
      }
    }
    if (touchGesture === "zoom") {
      const prevDist = Math.hypot(prevBClientX - prevAClientX, prevBClientY - prevAClientY);
      if (prevDist > 0) {
        const plotW = Math.max(1, i32ToF32(Atomics.load(ctrl, PLOT_W)));
        const centerX = Math.max(0, Math.min(plotW, currMidX - rect.left));
        api.zoomAt(prevDist / currDist, centerX);
      }
      return;
    }
    if (touchGesture === "pan") {
      const prevMidX = (prevAClientX + prevBClientX) * 0.5;
      if (panByPixelDelta((prevMidX - currMidX) * TOUCH_PAN_GAIN)) {
        touchInitMidX = currMidX;
      }
    }
  });
  root.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") {
      isDragging = false;
      return;
    }
    if (event.pointerType !== "touch")
      return;
    touchPointers.delete(event.pointerId);
    if (activeTouchId === event.pointerId) {
      activeTouchId = touchPointers.size > 0 ? touchPointers.keys().next().value ?? null : null;
      if (activeTouchId != null) {
        const rect = root.getBoundingClientRect();
        const next = touchPointers.get(activeTouchId);
        if (next)
          dragLastX = next.clientX - rect.left;
      }
    }
    if (touchPointers.size < 2)
      touchGesture = "none";
    if (touchPointers.size === 0)
      clearPointerState();
  });
  root.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "mouse") {
      isDragging = false;
      return;
    }
    if (event.pointerType !== "touch")
      return;
    touchPointers.delete(event.pointerId);
    if (activeTouchId === event.pointerId)
      activeTouchId = null;
    touchGesture = "none";
    clearPointerState();
  });
  root.addEventListener("pointerleave", () => {
    clearPointerState();
  });
  root.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    updatePointerState(x, event.clientY - rect.top);
    api.zoomAt(event.deltaY > 0 ? MORE_BARS : FEWER_BARS, x);
  }, { passive: false });
  root.addEventListener("click", (event) => {
    if (listeners.click.size === 0)
      return;
    const rect = root.getBoundingClientRect();
    const payload = buildCrosshairEvent(event.clientX - rect.left, event.clientY - rect.top);
    if (payload)
      emit("click", payload);
  });
  resize();
  initRustViewport();
  const onEvent = (eventName, callback) => {
    const bucket = listeners[eventName];
    bucket.add(callback);
  };
  const offEvent = (eventName, callback) => {
    const bucket = listeners[eventName];
    if (callback) {
      bucket.delete(callback);
      return;
    }
    bucket.clear();
  };
  const api = {
    setData(bars) {
      if (destroyed)
        return;
      const buffers = toSoaTransferBuffers(bars);
      postToDataWorker({
        type: "set_data_soa",
        slotId: managerSlotId,
        count: buffers.count,
        time: buffers.time,
        open: buffers.open,
        high: buffers.high,
        low: buffers.low,
        close: buffers.close,
        volume: buffers.volume
      }, [buffers.time, buffers.open, buffers.high, buffers.low, buffers.close, buffers.volume]);
    },
    setDataBinary(data) {
      if (destroyed)
        return;
      postToDataWorker({ type: "set_data_binary", slotId: managerSlotId, data }, [data]);
    },
    setDataUrl(url) {
      if (destroyed)
        return;
      postToDataWorker({ type: "set_data_url", slotId: managerSlotId, url });
    },
    appendTick(time, open, high, low, close, volume) {
      if (destroyed)
        return;
      api.setData([[time, open, high, low, close, volume]]);
    },
    panByBars(deltaBars) {
      if (destroyed)
        return;
      const nextDeltaBars = Math.trunc(deltaBars);
      if (nextDeltaBars === 0)
        return;
      const result = applyViewportPanBars(nextDeltaBars);
      if (result === "applied") {
        scheduleWake(true, true);
      }
    },
    zoomAt(factor, centerX) {
      if (destroyed || !Number.isFinite(factor) || factor <= 0)
        return;
      const result = applyViewportZoom(factor, centerX);
      if (result === "applied") {
        scheduleWake(true, true);
      }
    },
    setViewport(nextStartBar, nextVisibleBars) {
      if (destroyed)
        return;
      const result = applyViewportSet(nextStartBar, nextVisibleBars);
      if (result === "applied") {
        scheduleWake(true, true);
      }
    },
    getVisibleRangeView() {
      return syncVisibleRangeView();
    },
    getVisibleRangeSnapshot() {
      const view = syncVisibleRangeView();
      return { startBar: view[0], visibleBars: view[1], totalBars: view[2] };
    },
    getVisibleRange() {
      return api.getVisibleRangeSnapshot();
    },
    addIndicator(config) {
      const id = indicatorHandleCounter++;
      indicatorConfigs.set(id, { ...config });
      postToDataWorker({ type: "ep_add", slotId: managerSlotId, ...indicatorToWorkerPayload(config, id) });
      scheduleWake(true, false);
      return {
        id,
        applyOptions(params) {
          api.updateIndicator(id, params);
        },
        remove() {
          api.removeIndicator(id);
        }
      };
    },
    updateIndicator(id, params) {
      const current = indicatorConfigs.get(id);
      if (!current)
        return;
      const nextConfig = { ...current, ...params };
      indicatorConfigs.set(id, nextConfig);
      postToDataWorker({ type: "ep_update", slotId: managerSlotId, ...indicatorToWorkerPayload(nextConfig, id) });
      scheduleWake(true, false);
    },
    removeIndicator(id) {
      if (!indicatorConfigs.has(id))
        return;
      indicatorConfigs.delete(id);
      postToDataWorker({ type: "ep_remove", slotId: managerSlotId, id });
      scheduleWake(true, false);
    },
    getIndicators() {
      return Array.from(indicatorConfigs.values());
    },
    setPaneConfig(config) {
      paneConfig = normalizePaneConfig(config);
      postPaneConfig();
      scheduleWake(true, true);
    },
    resize() {
      resize();
    },
    destroy() {
      if (destroyed)
        return;
      destroyed = true;
      rustViewport?.free();
      resizeObserver.disconnect();
      if (ownsDataWorker && "terminate" in dataWorker) {
        dataWorker.terminate();
      }
      if (ownsRenderWorker) {
        renderWorker.terminate();
      }
      container.replaceChildren();
    },
    on: onEvent,
    off: offEvent,
    addAnnotation(annotation) {
      const handle = overlayController.addAnnotation(annotation);
      postAnnotationBulkSnapshot();
      scheduleWake(false, true);
      return handle;
    },
    addAnnotations(annotations) {
      const handles = overlayController.addAnnotations(annotations);
      postAnnotationBulkSnapshot();
      scheduleWake(false, true);
      return handles;
    },
    updateAnnotation(id, partial) {
      overlayController.updateAnnotation(id, partial);
      postToDataWorker({ type: "ann_update", slotId: managerSlotId, id, patch: partial });
      scheduleWake(false, true);
    },
    removeAnnotation(id) {
      overlayController.removeAnnotation(id);
      postToDataWorker({ type: "ann_remove", slotId: managerSlotId, id });
      scheduleWake(false, true);
    },
    getAnnotations() {
      return overlayController.getAnnotations();
    },
    clearAnnotations(ids) {
      if (ids && ids.length > 0) {
        for (let index = 0;index < ids.length; index++) {
          overlayController.removeAnnotation(ids[index]);
        }
      } else {
        overlayController.clearAnnotations();
      }
      postAnnotationBulkSnapshot();
      scheduleWake(false, true);
    },
    setTradeRecords(trades, displayOptions) {
      overlayController.setTradeRecords(trades, displayOptions);
      postAnnotationBulkSnapshot();
      scheduleWake(false, true);
    },
    clearTradeRecords() {
      overlayController.clearTradeRecords();
      postAnnotationBulkSnapshot();
      scheduleWake(false, true);
    },
    getPerformanceMetrics() {
      return latestPerf;
    }
  };
  if (resolvedOptions.dataUrl) {
    api.setDataUrl(resolvedOptions.dataUrl);
  } else if (resolvedOptions.data && resolvedOptions.data.length > 0) {
    api.setData(resolvedOptions.data);
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
// src/indicators/phase3.ts
var ok2 = (value) => ({ ok: true, value });
var fail2 = (message) => ({
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
      return ok2({ vwap });
    } catch (e) {
      return fail2(String(e));
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
      return ok2({ volRatio });
    } catch (e) {
      return fail2(String(e));
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
      return ok2({ percentB });
    } catch (e) {
      return fail2(String(e));
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
      return ok2({ width });
    } catch (e) {
      return fail2(String(e));
    }
  }
};
var Phase3Indicators = [VWAP, VolRatio, PercentB, BBWidth];
var registerPhase3Indicators = (registry) => {
  Phase3Indicators.forEach((indicator) => registry.register(indicator));
};
// src/indicators/phase2.ts
var ok3 = (value) => ({ ok: true, value });
var fail3 = (message) => ({
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
      return ok3({ rsi });
    } catch (e) {
      return fail3(String(e));
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
      return ok3({ atr });
    } catch (e) {
      return fail3(String(e));
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
      return ok3({
        macd: macdLine.map((v, i) => i < warmup ? null : v),
        signal: signalLine.map((v, i) => i < warmup ? null : v),
        histogram: histogram.map((v, i) => i < warmup ? null : v)
      });
    } catch (e) {
      return fail3(String(e));
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
      return ok3({ adx, plusDI, minusDI });
    } catch (e) {
      return fail3(String(e));
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
    return ok3({ markers: [] });
  }
};
var Phase2Indicators = [RSI, ADX, ATR, MACD, TradeMarkers];
var registerPhase2Indicators = (registry) => {
  Phase2Indicators.forEach((indicator) => registry.register(indicator));
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
// src/wasm/wasmModule.ts
var wasmLoadPromise = null;
async function tryImportModule() {
  try {
    const bindings = await Promise.resolve().then(() => (init_mochart_wasm(), exports_mochart_wasm));
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

//# debugId=D4D14312810B636964756E2164756E21
//# sourceMappingURL=index.js.map
