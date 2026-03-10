/* @ts-self-types="./mochart_wasm.d.ts" */

export class MochartEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MochartEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_mochartengine_free(ptr, 0);
    }
    /**
     * @returns {any}
     */
    close_buffer() {
        const ret = wasm.mochartengine_close_buffer(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * @returns {number}
     */
    close_ptr() {
        const ret = wasm.mochartengine_close_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {string} name
     * @param {number} period
     */
    compute_sma(name, period) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export2, wasm.__wbindgen_export4);
        const len0 = WASM_VECTOR_LEN;
        wasm.mochartengine_compute_sma(this.__wbg_ptr, ptr0, len0, period);
    }
    /**
     * WGSL コンピュートシェーダーを実行
     * @param {string} wgsl_code
     * @param {string} entry_point
     * @param {number} workgroup_x
     */
    dispatch_compute(wgsl_code, entry_point, workgroup_x) {
        const ptr0 = passStringToWasm0(wgsl_code, wasm.__wbindgen_export2, wasm.__wbindgen_export4);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(entry_point, wasm.__wbindgen_export2, wasm.__wbindgen_export4);
        const len1 = WASM_VECTOR_LEN;
        wasm.mochartengine_dispatch_compute(this.__wbg_ptr, ptr0, len0, ptr1, len1, workgroup_x);
    }
    /**
     * @returns {any}
     */
    high_buffer() {
        const ret = wasm.mochartengine_high_buffer(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * @returns {number}
     */
    high_ptr() {
        const ret = wasm.mochartengine_high_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} x
     * @param {number} plot_x
     * @param {number} plot_w
     * @param {number} start
     * @param {number} count
     * @returns {number}
     */
    hit_test(x, plot_x, plot_w, start, count) {
        const ret = wasm.mochartengine_hit_test(this.__wbg_ptr, x, plot_x, plot_w, start, count);
        return ret;
    }
    /**
     * @param {string} name
     * @returns {number}
     */
    indicator_len(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export2, wasm.__wbindgen_export4);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mochartengine_indicator_len(this.__wbg_ptr, ptr0, len0);
        return ret >>> 0;
    }
    /**
     * @param {string} name
     * @returns {number}
     */
    indicator_ptr(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export2, wasm.__wbindgen_export4);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mochartengine_indicator_ptr(this.__wbg_ptr, ptr0, len0);
        return ret >>> 0;
    }
    /**
     * TS 側で初期化した GPUDevice と GPUCanvasContext を受け取る
     * @param {any} device
     * @param {any} context
     */
    init_webgpu(device, context) {
        wasm.mochartengine_init_webgpu(this.__wbg_ptr, addHeapObject(device), addHeapObject(context));
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.mochartengine_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {any}
     */
    low_buffer() {
        const ret = wasm.mochartengine_low_buffer(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * @returns {number}
     */
    low_ptr() {
        const ret = wasm.mochartengine_low_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} start
     * @param {number} end
     * @returns {Float32Array}
     */
    min_max_close_in_range(start, end) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.mochartengine_min_max_close_in_range(retptr, this.__wbg_ptr, start, end);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} name
     * @param {number} start
     * @param {number} end
     * @returns {Float32Array}
     */
    min_max_indicator_in_range(name, start, end) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export2, wasm.__wbindgen_export4);
            const len0 = WASM_VECTOR_LEN;
            wasm.mochartengine_min_max_indicator_in_range(retptr, this.__wbg_ptr, ptr0, len0, start, end);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v2 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} start
     * @param {number} end
     * @returns {Float32Array}
     */
    min_max_price_in_range(start, end) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.mochartengine_min_max_price_in_range(retptr, this.__wbg_ptr, start, end);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    constructor() {
        const ret = wasm.mochartengine_new();
        this.__wbg_ptr = ret >>> 0;
        MochartEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {any}
     */
    open_buffer() {
        const ret = wasm.mochartengine_open_buffer(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * OhlcvStore の open 列へのポインタ (ゼロコピー参照)
     * @returns {number}
     */
    open_ptr() {
        const ret = wasm.mochartengine_open_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} time
     * @param {number} open
     * @param {number} high
     * @param {number} low
     * @param {number} close
     * @param {number} volume
     */
    push_data(time, open, high, low, close, volume) {
        wasm.mochartengine_push_data(this.__wbg_ptr, time, open, high, low, close, volume);
    }
    /**
     * @returns {number}
     */
    time_ptr() {
        const ret = wasm.mochartengine_time_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} time
     * @param {number} open
     * @param {number} high
     * @param {number} low
     * @param {number} close
     * @param {number} volume
     */
    update_tail(time, open, high, low, close, volume) {
        wasm.mochartengine_update_tail(this.__wbg_ptr, time, open, high, low, close, volume);
    }
    /**
     * ストアの内容を GPU バッファへ同期
     */
    upload_to_gpu() {
        wasm.mochartengine_upload_to_gpu(this.__wbg_ptr);
    }
    /**
     * @returns {any}
     */
    volume_buffer() {
        const ret = wasm.mochartengine_volume_buffer(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * @returns {number}
     */
    volume_ptr() {
        const ret = wasm.mochartengine_volume_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) MochartEngine.prototype[Symbol.dispose] = MochartEngine.prototype.free;

export class WasmColumnarStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmColumnarStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmcolumnarstore_free(ptr, 0);
    }
    clear() {
        wasm.wasmcolumnarstore_clear(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    close_ptr() {
        const ret = wasm.wasmcolumnarstore_close_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    high_ptr() {
        const ret = wasm.wasmcolumnarstore_high_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.wasmcolumnarstore_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    low_ptr() {
        const ret = wasm.wasmcolumnarstore_low_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} start
     * @param {number} end
     * @returns {Float32Array}
     */
    min_max_close_in_range(start, end) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmcolumnarstore_min_max_close_in_range(retptr, this.__wbg_ptr, start, end);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} capacity
     */
    constructor(capacity) {
        const ret = wasm.wasmcolumnarstore_new(capacity);
        this.__wbg_ptr = ret >>> 0;
        WasmColumnarStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    open_ptr() {
        const ret = wasm.wasmcolumnarstore_open_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} time
     * @param {number} open
     * @param {number} high
     * @param {number} low
     * @param {number} close
     * @param {number} volume
     */
    push(time, open, high, low, close, volume) {
        wasm.wasmcolumnarstore_push(this.__wbg_ptr, time, open, high, low, close, volume);
    }
    /**
     * @param {number} additional
     */
    reserve(additional) {
        wasm.wasmcolumnarstore_reserve(this.__wbg_ptr, additional);
    }
    /**
     * @returns {number}
     */
    time_ptr() {
        const ret = wasm.wasmcolumnarstore_time_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    volume_ptr() {
        const ret = wasm.wasmcolumnarstore_volume_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WasmColumnarStore.prototype[Symbol.dispose] = WasmColumnarStore.prototype.free;

export class WasmRingBuffer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmRingBufferFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmringbuffer_free(ptr, 0);
    }
    clear() {
        wasm.wasmringbuffer_clear(this.__wbg_ptr);
    }
    /**
     * @returns {Float32Array}
     */
    close() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmringbuffer_close(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float32Array}
     */
    high() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmringbuffer_high(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    is_full() {
        const ret = wasm.wasmringbuffer_is_full(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.wasmringbuffer_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Float32Array}
     */
    low() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmringbuffer_low(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} capacity
     */
    constructor(capacity) {
        const ret = wasm.wasmringbuffer_new(capacity);
        this.__wbg_ptr = ret >>> 0;
        WasmRingBufferFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Float32Array}
     */
    open() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmringbuffer_open(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} time
     * @param {number} open
     * @param {number} high
     * @param {number} low
     * @param {number} close
     * @param {number} volume
     */
    push(time, open, high, low, close, volume) {
        wasm.wasmringbuffer_push(this.__wbg_ptr, time, open, high, low, close, volume);
    }
    /**
     * @returns {Float64Array}
     */
    time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmringbuffer_time(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float32Array}
     */
    volume() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmringbuffer_volume(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WasmRingBuffer.prototype[Symbol.dispose] = WasmRingBuffer.prototype.free;

/**
 * @param {Float32Array} high
 * @param {Float32Array} low
 * @param {Float32Array} close
 * @param {number} period
 * @returns {Float32Array}
 */
export function adx_f32(high, low, close, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(high, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(low, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.adx_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} high
 * @param {Float32Array} low
 * @param {Float32Array} close
 * @param {number} period
 * @returns {Float32Array}
 */
export function atr_f32(high, low, close, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(high, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(low, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.atr_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} values
 * @param {number} period
 * @param {number} std_dev
 * @returns {Float32Array}
 */
export function bollinger_f32(values, period, std_dev) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.bollinger_f32(retptr, ptr0, len0, period, std_dev);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} high
 * @param {Float32Array} low
 * @param {Float32Array} close
 * @param {number} period
 * @returns {Float32Array}
 */
export function cci_f32(high, low, close, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(high, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(low, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.cci_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} values
 * @param {number} period
 * @returns {Float32Array}
 */
export function ema_f32(values, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.ema_f32(retptr, ptr0, len0, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @returns {number}
 */
export function ema_f32_len() {
    const ret = wasm.ema_f32_len();
    return ret >>> 0;
}

/**
 * @param {Float32Array} values
 * @param {number} period
 * @returns {number}
 */
export function ema_f32_ptr(values, period) {
    const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ema_f32_ptr(ptr0, len0, period);
    return ret >>> 0;
}

/**
 * @param {number} ptr
 * @param {number} len
 * @param {number} period
 * @returns {Float32Array}
 */
export function ema_ptr(ptr, len, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.ema_ptr(retptr, ptr, len, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float64Array} times
 * @param {Float32Array} values
 * @param {number} threshold
 * @returns {Uint32Array}
 */
export function lttb_downsample(times, values, threshold) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF64ToWasm0(times, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.lttb_downsample(retptr, ptr0, len0, ptr1, len1, threshold);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayU32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @returns {number}
 */
export function lttb_downsample_len() {
    const ret = wasm.lttb_downsample_len();
    return ret >>> 0;
}

/**
 * @param {Float64Array} times
 * @param {Float32Array} values
 * @param {number} threshold
 * @returns {number}
 */
export function lttb_downsample_ptr(times, values, threshold) {
    const ptr0 = passArrayF64ToWasm0(times, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.lttb_downsample_ptr(ptr0, len0, ptr1, len1, threshold);
    return ret >>> 0;
}

/**
 * @param {Float32Array} values
 * @param {number} fast
 * @param {number} slow
 * @param {number} signal
 * @returns {Float32Array}
 */
export function macd_f32(values, fast, slow, signal) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.macd_f32(retptr, ptr0, len0, fast, slow, signal);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} high
 * @param {Float32Array} low
 * @param {Float32Array} close
 * @param {Float32Array} volume
 * @param {number} period
 * @returns {Float32Array}
 */
export function mfi_f32(high, low, close, volume, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(high, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(low, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF32ToWasm0(volume, wasm.__wbindgen_export2);
        const len3 = WASM_VECTOR_LEN;
        wasm.mfi_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v5 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v5;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} values
 * @returns {Float32Array}
 */
export function min_max_f32(values) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.min_max_f32(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} ptr
 * @param {number} len
 * @returns {Float32Array}
 */
export function min_max_f32_ptr(ptr, len) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.min_max_f32_ptr(retptr, ptr, len);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float64Array} times
 * @param {number} target
 * @returns {number}
 */
export function nearest_index(times, target) {
    const ptr0 = passArrayF64ToWasm0(times, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.nearest_index(ptr0, len0, target);
    return ret;
}

/**
 * @param {Float32Array} close
 * @param {Float32Array} volume
 * @returns {Float32Array}
 */
export function obv_f32(close, volume) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(volume, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.obv_f32(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v3 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} values
 * @param {number} period
 * @returns {Float32Array}
 */
export function rsi_f32(values, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.rsi_f32(retptr, ptr0, len0, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} values
 * @param {number} period
 * @returns {Float32Array}
 */
export function sma_f32(values, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.sma_f32(retptr, ptr0, len0, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @returns {number}
 */
export function sma_f32_len() {
    const ret = wasm.sma_f32_len();
    return ret >>> 0;
}

/**
 * @param {Float32Array} values
 * @param {number} period
 * @returns {number}
 */
export function sma_f32_ptr(values, period) {
    const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.sma_f32_ptr(ptr0, len0, period);
    return ret >>> 0;
}

/**
 * @param {number} dest_ptr
 * @param {number} src_ptr
 * @param {number} len
 * @param {number} period
 */
export function sma_inplace_ptr(dest_ptr, src_ptr, len, period) {
    wasm.sma_inplace_ptr(dest_ptr, src_ptr, len, period);
}

/**
 * Example: call from JS with `wasmInstance.exports.sma_ptr(ptr, len, period)`
 * @param {number} ptr
 * @param {number} len
 * @param {number} period
 * @returns {Float32Array}
 */
export function sma_ptr(ptr, len, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.sma_ptr(retptr, ptr, len, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {Float32Array} high
 * @param {Float32Array} low
 * @param {Float32Array} close
 * @param {number} period
 * @returns {Float32Array}
 */
export function stochastic_f32(high, low, close, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(high, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(low, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.stochastic_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * @param {number} ptr
 * @param {number} len
 * @returns {boolean}
 */
export function validate_ptr_len_f32(ptr, len) {
    const ret = wasm.validate_ptr_len_f32(ptr, len);
    return ret !== 0;
}

/**
 * @returns {boolean}
 */
export function wasm_ready() {
    const ret = wasm.wasm_ready();
    return ret !== 0;
}

/**
 * @param {Float32Array} high
 * @param {Float32Array} low
 * @param {Float32Array} close
 * @param {number} period
 * @returns {Float32Array}
 */
export function williams_r_f32(high, low, close, period) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(high, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(low, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm0(close, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.williams_r_f32(retptr, ptr0, len0, ptr1, len1, ptr2, len2, period);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v4 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v4;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
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
            const ret = new Object();
            return addHeapObject(ret);
        },
        __wbg_new_3eb36ae241fe6f44: function() {
            const ret = new Array();
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
        __wbg_set_6cb8631f80447a67: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
            return ret;
        }, arguments); },
        __wbg_submit_8cbcc62accd78b81: function(arg0, arg1) {
            getObject(arg0).submit(getObject(arg1));
        },
        __wbg_writeBuffer_2da69b04041a93de: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).writeBuffer(getObject(arg1), arg2, getArrayU8FromWasm0(arg3, arg4));
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_clone_ref: function(arg0) {
            const ret = getObject(arg0);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./mochart_wasm_bg.js": import0,
    };
}

const MochartEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_mochartengine_free(ptr >>> 0, 1));
const WasmColumnarStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmcolumnarstore_free(ptr >>> 0, 1));
const WasmRingBufferFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmringbuffer_free(ptr >>> 0, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
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
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export(addHeapObject(e));
    }
}

let heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
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

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
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
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL(/* @vite-ignore */ 'mochart_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
