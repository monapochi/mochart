/* @ts-self-types="./mochart_wasm_new.d.ts" */

/**
 * チャートのビューポート状態。JS から `wasm_bindgen` 経由で操作する。
 */
export class ChartViewport {
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
    /**
     * カーソル位置からクロスヘア情報を計算して返す。
     *
     * - `x_px`, `y_px`: CSS ピクセル座標
     * - `price_min`, `price_max`: 現在の表示価格レンジ
     * - `plot_height_px`: プロット領域の高さ (CSS px)
     *
     * 戻り値: `CrosshairResult`（bar インデックス、価格、NDC 座標）
     * @param {number} x_px
     * @param {number} y_px
     * @param {number} price_min
     * @param {number} price_max
     * @param {number} plot_height_px
     * @returns {CrosshairResult}
     */
    crosshair(x_px, y_px, price_min, price_max, plot_height_px) {
        const ret = wasm.chartviewport_crosshair(this.__wbg_ptr, x_px, y_px, price_min, price_max, plot_height_px);
        return CrosshairResult.__wrap(ret);
    }
    /**
     * 新規ビューポートを作成する。
     *
     * - `visible_bars` はデータ全体の末尾から数えた初期表示数。
     * - `plot_width_px` は CSS ピクセル単位のキャンバス幅。
     * @param {number} total_bars
     * @param {number} visible_bars
     * @param {number} plot_width_px
     */
    constructor(total_bars, visible_bars, plot_width_px) {
        const ret = wasm.chartviewport_new(total_bars, visible_bars, plot_width_px);
        this.__wbg_ptr = ret >>> 0;
        ChartViewportFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * ポインタ移動による水平パン（CSS ピクセル差分、右移動が正）。
     *
     * `delta_px > 0` → 過去方向へスクロール（start_bar 減少）。
     * `delta_px < 0` → 未来方向へスクロール（start_bar 増加）。
     * @param {number} delta_px
     */
    pan_px(delta_px) {
        wasm.chartviewport_pan_px(this.__wbg_ptr, delta_px);
    }
    /**
     * @returns {number}
     */
    plot_width_px() {
        const ret = wasm.chartviewport_plot_width_px(this.__wbg_ptr);
        return ret;
    }
    /**
     * キャンバスリサイズ時にプロット幅を更新する。
     * @param {number} px
     */
    set_plot_width(px) {
        wasm.chartviewport_set_plot_width(this.__wbg_ptr, px);
    }
    /**
     * 総バー数を更新する（リアルタイムデータ追加時）。
     * @param {number} n
     */
    set_total_bars(n) {
        wasm.chartviewport_set_total_bars(this.__wbg_ptr, n);
    }
    /**
     * @returns {number}
     */
    start_bar() {
        const ret = wasm.chartviewport_start_bar(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    total_bars() {
        const ret = wasm.chartviewport_total_bars(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    visible_bars() {
        const ret = wasm.chartviewport_visible_bars(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * ホイール / ピンチによるズーム。
     *
     * - `factor > 1.0` → ズームイン（visible_bars 減少）
     * - `factor < 1.0` → ズームアウト（visible_bars 増加）
     * - `center_px`: ズームの中心 X 座標 (CSS px)。その位置のバーが画面に残るよう調整。
     * @param {number} factor
     * @param {number} center_px
     */
    zoom(factor, center_px) {
        wasm.chartviewport_zoom(this.__wbg_ptr, factor, center_px);
    }
}
if (Symbol.dispose) ChartViewport.prototype[Symbol.dispose] = ChartViewport.prototype.free;

/**
 * `ChartViewport::crosshair()` の戻り値。JS 側で `Canvas 2D` HUD 描画に使う。
 */
export class CrosshairResult {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CrosshairResult.prototype);
        obj.__wbg_ptr = ptr;
        CrosshairResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CrosshairResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_crosshairresult_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    bar_idx() {
        const ret = wasm.crosshairresult_bar_idx(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    price() {
        const ret = wasm.crosshairresult_price(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    x_ndc() {
        const ret = wasm.crosshairresult_x_ndc(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    y_ndc() {
        const ret = wasm.crosshairresult_y_ndc(this.__wbg_ptr);
        return ret;
    }
    /**
     * バーインデックス（OhlcvStore の絶対インデックス）
     * @returns {number}
     */
    get bar_idx() {
        const ret = wasm.__wbg_get_crosshairresult_bar_idx(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * カーソル位置の価格
     * @returns {number}
     */
    get price() {
        const ret = wasm.__wbg_get_crosshairresult_price(this.__wbg_ptr);
        return ret;
    }
    /**
     * カーソル X の NDC 座標 [-1, 1]
     * @returns {number}
     */
    get x_ndc() {
        const ret = wasm.__wbg_get_crosshairresult_x_ndc(this.__wbg_ptr);
        return ret;
    }
    /**
     * カーソル Y の NDC 座標 [-1, 1]
     * @returns {number}
     */
    get y_ndc() {
        const ret = wasm.__wbg_get_crosshairresult_y_ndc(this.__wbg_ptr);
        return ret;
    }
    /**
     * バーインデックス（OhlcvStore の絶対インデックス）
     * @param {number} arg0
     */
    set bar_idx(arg0) {
        wasm.__wbg_set_crosshairresult_bar_idx(this.__wbg_ptr, arg0);
    }
    /**
     * カーソル位置の価格
     * @param {number} arg0
     */
    set price(arg0) {
        wasm.__wbg_set_crosshairresult_price(this.__wbg_ptr, arg0);
    }
    /**
     * カーソル X の NDC 座標 [-1, 1]
     * @param {number} arg0
     */
    set x_ndc(arg0) {
        wasm.__wbg_set_crosshairresult_x_ndc(this.__wbg_ptr, arg0);
    }
    /**
     * カーソル Y の NDC 座標 [-1, 1]
     * @param {number} arg0
     */
    set y_ndc(arg0) {
        wasm.__wbg_set_crosshairresult_y_ndc(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) CrosshairResult.prototype[Symbol.dispose] = CrosshairResult.prototype.free;

/**
 * CPU-First indicator execution plan.
 *
 * ## Lifecycle
 * ```text
 * let mut plan = ExecutionPlan::new();
 * plan.add_indicator(IndicatorKind::Sma as u8, 20, 3, 0, ...);  // close, main
 * plan.add_indicator(IndicatorKind::Macd as u8, 12, ...);        // fast
 * plan.set_macd_params(macd_id, 12, 26, 9);
 * plan.compile(200);  // visible_count = 200
 * loop {
 *     store.decompress_view_window(start, visible);
 *     plan.execute(&store);
 *     // arena_ptr() / arena_len() ready for GPU upload
 * }
 * ```
 */
export class ExecutionPlan {
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
    /**
     * Add an indicator to the plan.
     *
     * Returns a `slot_id` (0–63) that identifies this indicator for future
     * `set_*_params()`, `remove_indicator()`, and applyOptions operations.
     *
     * For MACD and BB, the returned id refers to the **first** sub-slot.
     * Call `set_macd_params()` / `set_bb_params()` after to customise.
     *
     * # Arguments
     * - `kind`        — `IndicatorKind as u8`
     * - `period`      — primary period (or fast period for MACD)
     * - `pane`        — `PaneId as u8`
     * - `render_style`— `RenderStyle as u8`
     * - `r/g/b/a`     — RGBA colour [0, 1]
     * - `line_width`  — screen pixels
     * @param {number} kind
     * @param {number} period
     * @param {number} pane
     * @param {number} render_style
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {number} a
     * @param {number} line_width
     * @returns {number}
     */
    add_indicator(kind, period, pane, render_style, r, g, b, a, line_width) {
        const ret = wasm.executionplan_add_indicator(this.__wbg_ptr, kind, period, pane, render_style, r, g, b, a, line_width);
        return ret;
    }
    /**
     * Arena size in bytes (= `arena_len() × 4`).  Convenience for JS-side
     * `SharedArrayBuffer` allocation sizing.
     * @returns {number}
     */
    arena_byte_size() {
        const ret = wasm.executionplan_arena_byte_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Number of valid f32 elements in the arena (updated by `compile()`).
     * @returns {number}
     */
    arena_len() {
        const ret = wasm.executionplan_arena_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Pointer to the arena's first f32 element (WASM linear memory address).
     *
     * Use `new Float32Array(wasm.memory.buffer, plan.arena_ptr(), plan.arena_len())`
     * to create a zero-copy view. Refresh the view after any call that may
     * trigger `memory.grow()` (i.e. after `compile()` when arena size increases).
     * @returns {number}
     */
    arena_ptr() {
        const ret = wasm.executionplan_arena_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Compile the execution plan for `visible_count` visible bars.
     *
     * This is an O(N) operation (N = slot count) and must be called:
     * - After any `add_indicator()` / `remove_indicator()` call
     * - Whenever `visible_count` changes (pan/zoom alters visible bar count)
     * @param {number} visible_count
     */
    compile(visible_count) {
        wasm.executionplan_compile(this.__wbg_ptr, visible_count);
    }
    /**
     * Execute all indicators in topological order.
     *
     * Writes results to the arena at the pre-computed offsets.
     * Caller must have called `store.decompress_view_window()` beforehand.
     *
     * **Zero per-frame allocation**: scratch buffers are grown only when
     * `visible_count` or `period` increases (amortised O(1)).
     * @param {OhlcvStore} store
     */
    execute(store) {
        _assertClass(store, OhlcvStore);
        wasm.executionplan_execute(this.__wbg_ptr, store.__wbg_ptr);
    }
    /**
     * Whether `compile(new_visible_count)` must be re-run.
     *
     * Returns `true` if `new_visible_count ≠ current visible_count`
     * (pan/zoom changed the number of visible bars).
     * @param {number} new_visible_count
     * @returns {boolean}
     */
    needs_recompile(new_visible_count) {
        const ret = wasm.executionplan_needs_recompile(this.__wbg_ptr, new_visible_count);
        return ret !== 0;
    }
    /**
     * Creates an empty execution plan.
     */
    constructor() {
        const ret = wasm.executionplan_new();
        this.__wbg_ptr = ret >>> 0;
        ExecutionPlanFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Remove an indicator from the plan.
     *
     * Requires `compile()` to be called again to rebuild the arena layout.
     * @param {number} slot_id
     * @returns {boolean}
     */
    remove_indicator(slot_id) {
        const ret = wasm.executionplan_remove_indicator(this.__wbg_ptr, slot_id);
        return ret !== 0;
    }
    /**
     * Arena f32 element offset for render command at `idx`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_arena_offset(idx) {
        const ret = wasm.executionplan_render_cmd_arena_offset(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * For `Band` style: alternate arena offset (second line of the band).
     * Zero for non-Band styles.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_band_alt_offset(idx) {
        const ret = wasm.executionplan_render_cmd_band_alt_offset(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * Total bar count (= visible_count) for render command at `idx`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_bar_count(idx) {
        const ret = wasm.executionplan_render_cmd_bar_count(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * RGBA colour [r, g, b, a] pointer for render command at `idx`.
     *
     * Returns a `*const f32` to a 4-element array inside `render_cmds`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_color_ptr(idx) {
        const ret = wasm.executionplan_render_cmd_color_ptr(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * Number of GPU draw commands generated by the last `compile()` call.
     * @returns {number}
     */
    render_cmd_count() {
        const ret = wasm.executionplan_render_cmd_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Line width in screen pixels for render command at `idx`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_line_width(idx) {
        const ret = wasm.executionplan_render_cmd_line_width(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * `PaneId as u8` for render command at `idx`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_pane(idx) {
        const ret = wasm.executionplan_render_cmd_pane(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * `slot_id` of render command at index `idx`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_slot_id(idx) {
        const ret = wasm.executionplan_render_cmd_slot_id(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * `RenderStyle as u8` for render command at `idx`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_style(idx) {
        const ret = wasm.executionplan_render_cmd_style(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * Sub-slot index within a multi-output indicator (0=first, 1=second, ...).
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_sub_slot(idx) {
        const ret = wasm.executionplan_render_cmd_sub_slot(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * Finite max value of the indicator output (padding applied). See `render_cmd_value_min`.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_value_max(idx) {
        const ret = wasm.executionplan_render_cmd_value_max(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * Finite min value of the indicator output (padding applied, NaN warmup excluded).
     * Updated after each `execute()`. Used for sub-pane / histogram Y-domain scaling.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_value_min(idx) {
        const ret = wasm.executionplan_render_cmd_value_min(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * Number of warmup (NaN) bars at the head of the output slice.
     * @param {number} idx
     * @returns {number}
     */
    render_cmd_warmup(idx) {
        const ret = wasm.executionplan_render_cmd_warmup(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * Plan revision counter.  Increments on every `compile()` call.
     *
     * JS can cache GPU pipelines and bind groups until this changes.
     * @returns {number}
     */
    revision() {
        const ret = wasm.executionplan_revision(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Override Bollinger Bands standard-deviation multiplier.
     *
     * Must be called before `compile()`.
     * @param {number} slot_id
     * @param {number} std_dev
     */
    set_bb_params(slot_id, std_dev) {
        wasm.executionplan_set_bb_params(this.__wbg_ptr, slot_id, std_dev);
    }
    /**
     * Override MACD-specific parameters.
     *
     * Must be called before `compile()`.
     * @param {number} slot_id
     * @param {number} fast
     * @param {number} slow
     * @param {number} signal
     */
    set_macd_params(slot_id, fast, slow, signal) {
        wasm.executionplan_set_macd_params(this.__wbg_ptr, slot_id, fast, slow, signal);
    }
    /**
     * Number of logical indicator slots (not output slots).
     * @returns {number}
     */
    slot_count() {
        const ret = wasm.executionplan_slot_count(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) ExecutionPlan.prototype[Symbol.dispose] = ExecutionPlan.prototype.free;

/**
 * 固定小数点量子化とDelta-Deltaエンコーディングを備えたデータストア
 *
 * JS側から `ptr/len` API を通じてデータを投入し、
 * 描画に必要な可視領域（View Window）のみをオンデマンドで解凍します。
 */
export class OhlcvStore {
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
    /**
     * JS側で Ingestion Buffer に書き込んだ後、この関数を呼んで圧縮・保存する
     * @param {number} count
     */
    commit_ingestion(count) {
        wasm.ohlcvstore_commit_ingestion(this.__wbg_ptr, count);
    }
    /**
     * View Window の close に対して EMA を計算し、indicator_buf に格納する。
     *
     * view_start の手前に `period-1` 本以上の履歴がある場合は pre-history を
     * シードに使用し、`indicator_valid_start = 0`（全バーが有効）にする。
     * @param {number} period
     */
    compute_ema(period) {
        wasm.ohlcvstore_compute_ema(this.__wbg_ptr, period);
    }
    /**
     * View Window の close に対して RSI を計算し、indicator_buf に格納する。
     * @param {number} period
     */
    compute_rsi(period) {
        wasm.ohlcvstore_compute_rsi(this.__wbg_ptr, period);
    }
    /**
     * View Window の close に対して SMA を計算し、indicator_buf に格納する。
     * `decompress_view_window()` 呼び出し後に使うこと。
     *
     * view_start の手前に `period-1` 本以上の履歴がある場合は pre-history を
     * シードに使用し、`indicator_valid_start = 0`（全バーが有効）にする。
     * @param {number} period
     */
    compute_sma(period) {
        wasm.ohlcvstore_compute_sma(this.__wbg_ptr, period);
    }
    /**
     * Decompress the entire dataset into a single contiguous buffer.
     * Layout: [open×len | high×len | low×len | close×len]
     *
     * Uses proper delta-delta decoding (two prefix sums) matching the
     * encoding in `push_internal()` and `decompress_view_window()`.
     * @returns {Float32Array}
     */
    decompress_all_ohlc() {
        const ret = wasm.ohlcvstore_decompress_all_ohlc(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 指定された範囲を解凍し、View Window バッファに展開する
     * @param {number} start
     * @param {number} count
     */
    decompress_view_window(start, count) {
        wasm.ohlcvstore_decompress_view_window(this.__wbg_ptr, start, count);
    }
    /**
     * Ingestion staging buffers を解放する。
     *
     * `commit_ingestion()` の完了後、ingest_* は quantized columns に
     * エンコード済みであり RAM 上に重複保持する必要はない。
     * VRAM への upload 経路: binary fetch → ingest_* → quantized → view_* → GPUBuffer。
     * この呼び出しにより ingest 段の RAM (~`ingest_capacity × 28 B`) を即時解放できる。
     *
     * # Safety
     * `ingest_*_ptr()` を呼び出しているライブ JS TypedArray ビューが存在する間は
     * 呼び出してはならない。`TypedArray.set()` 完了 → `commit_ingestion()` 完了後に呼ぶこと。
     */
    free_ingest_buffers() {
        wasm.ohlcvstore_free_ingest_buffers(this.__wbg_ptr);
    }
    /**
     * View window scratch buffers を解放する。
     *
     * `view_*` は `decompress_view_window()` → GPU upload のパイプラインで
     * 生成される per-frame scratch に過ぎない。GPU upload (write_buffer) が
     * 完了した時点で VRAM が正規コピーとなり、RAM 側は不要となる。
     *
     * CPU がVRAM のデータを読み戻す場合は `GPUBuffer (MAP_READ | COPY_SRC)`
     * + `mapAsync()` を用いる。Unified Memory (Apple Silicon M系) では
     * `mapAsync` は物理コピーが発生しないため真のゼロコピーとなる。
     *
     * # Note
     * 次の `decompress_view_window()` 呼び出し時に再割り当てされる。
     * 毎フレーム呼ぶグレーターには向かない。データ切り替えや store 破棄時に使用する。
     */
    free_view_buffers() {
        wasm.ohlcvstore_free_view_buffers(this.__wbg_ptr);
    }
    /**
     * indicator_buf の有効要素数（view_len と一致）
     * @returns {number}
     */
    indicator_len() {
        const ret = wasm.ohlcvstore_indicator_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * indicator_buf の先頭ポインタを返す（GPU 転送 / JS view 用）
     * @returns {number}
     */
    indicator_ptr() {
        const ret = wasm.ohlcvstore_indicator_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * ウォームアップ長（先頭 N 要素が NaN）
     * @returns {number}
     */
    indicator_valid_start() {
        const ret = wasm.ohlcvstore_indicator_valid_start(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    ingest_close_ptr() {
        const ret = wasm.ohlcvstore_ingest_close_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    ingest_high_ptr() {
        const ret = wasm.ohlcvstore_ingest_high_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    ingest_low_ptr() {
        const ret = wasm.ohlcvstore_ingest_low_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    ingest_open_ptr() {
        const ret = wasm.ohlcvstore_ingest_open_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    ingest_time_ptr() {
        const ret = wasm.ohlcvstore_ingest_time_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    ingest_volume_ptr() {
        const ret = wasm.ohlcvstore_ingest_volume_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 全データ件数を取得
     * @returns {number}
     */
    len() {
        const ret = wasm.ohlcvstore_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} tick_size
     * @param {number} base_price
     * @param {number} ingest_capacity
     * @param {number} block_size
     */
    constructor(tick_size, base_price, ingest_capacity, block_size) {
        const ret = wasm.ohlcvstore_new(tick_size, base_price, ingest_capacity, block_size);
        this.__wbg_ptr = ret >>> 0;
        OhlcvStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * FDB (Frame Descriptor Buffer) のスロット 0 に現在のフレーム情報を書き込む。
     *
     * `decompress_view_window()` の**直後**に呼び出すこと。
     * JS はこの呼び出し後、`DataView` を通じて FDB をゼロ FFI で読める。
     *
     * # Arguments
     * - `canvas_w`: 物理ピクセル幅（= chartAreaW）
     * - `canvas_h`: 物理ピクセル高
     * - `candle_w`: ローソク足ボディの物理ピクセル幅
     * - `flags`:   ビットマスク（SMA20=1, SMA50=2, SMA100=4 など）
     *
     * # Safety (internal)
     * `FDB_ALIGNED` は WASM 単一スレッドでのみ変更される `static mut` 構造体。
     * 再帰呼び出しはなく、並行書き込みも発生しない。
     * @param {number} canvas_w
     * @param {number} canvas_h
     * @param {number} candle_w
     * @param {number} flags
     */
    prepare_frame(canvas_w, canvas_h, candle_w, flags) {
        wasm.ohlcvstore_prepare_frame(this.__wbg_ptr, canvas_w, canvas_h, candle_w, flags);
    }
    /**
     * @returns {number}
     */
    view_close_ptr() {
        const ret = wasm.ohlcvstore_view_close_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    view_high_ptr() {
        const ret = wasm.ohlcvstore_view_high_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    view_len() {
        const ret = wasm.ohlcvstore_indicator_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    view_low_ptr() {
        const ret = wasm.ohlcvstore_view_low_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    view_open_ptr() {
        const ret = wasm.ohlcvstore_view_open_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * View Window 内の high の最大値をスキャンして返す（ゼロアロケーション、SIMD向け4-wideリダクション）
     * `decompress_view_window()` の呼び出し後に使用すること。
     * @returns {number}
     */
    view_price_max() {
        const ret = wasm.ohlcvstore_view_price_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * View Window 内の low の最小値をスキャンして返す（ゼロアロケーション、SIMD向け4-wideリダクション）
     * `decompress_view_window()` の呼び出し後に使用すること。
     *
     * # SIMD Auto-Vectorization Note
     * 4 要素のアキュムレータを使い、forward sequential access の独立レーンで
     * min を並列蓄積する。rustc (LLVM) は wasm32-unknown-unknown ターゲットでも
     * この 4-wide reduction パターンを v128/f32x4_min に変換する。
     * ループの trip count が 4 の倍数でない端数は最終 scalar reduction で処理。
     * @returns {number}
     */
    view_price_min() {
        const ret = wasm.ohlcvstore_view_price_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    view_time_ptr() {
        const ret = wasm.ohlcvstore_view_time_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    view_volume_ptr() {
        const ret = wasm.ohlcvstore_view_volume_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) OhlcvStore.prototype[Symbol.dispose] = OhlcvStore.prototype.free;

export class WasmRenderer {
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
    /**
     * @param {string} _canvas_id
     */
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
if (Symbol.dispose) WasmRenderer.prototype[Symbol.dispose] = WasmRenderer.prototype.free;

/**
 * Returns the WASM linear memory byte offset of the Frame Descriptor Buffer (FDB slot 0).
 *
 * Call **once** during Worker initialization and store the result in a JS constant.
 * The address is stable for the entire lifetime of the WASM instance.
 *
 * ```js
 * const FDB_BASE = fdb_ptr();
 * // Per-frame read (after store.prepare_frame()):
 * const fdbView = new DataView(wasmMemory.buffer, FDB_BASE, 64);
 * const viewLen = fdbView.getUint32(28, true);
 * const pmin    = fdbView.getFloat32(32, true);
 * const pmax    = fdbView.getFloat32(36, true);
 * ```
 * @returns {number}
 */
export function fdb_ptr() {
    const ret = wasm.fdb_ptr();
    return ret >>> 0;
}

/**
 * WASM ロード確認用ヘルパー。
 * @returns {string}
 */
export function hello() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.hello();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * 指定 id の `<canvas>` が存在することを確認するスモークテスト用ヘルパー。
 * @param {string} canvas_id
 * @returns {any}
 */
export function init_winit_canvas(canvas_id) {
    const ptr0 = passStringToWasm0(canvas_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.init_winit_canvas(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
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
        __wbg_call_389efe28435a9388: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
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
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_e628e89ab3b1c95f: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_a621d3dfbb60d0ce: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_f8727f0cf888e0bd: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./mochart_wasm_new_bg.js": import0,
    };
}

const ChartViewportFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_chartviewport_free(ptr >>> 0, 1));
const CrosshairResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_crosshairresult_free(ptr >>> 0, 1));
const ExecutionPlanFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_executionplan_free(ptr >>> 0, 1));
const OhlcvStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ohlcvstore_free(ptr >>> 0, 1));
const WasmRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmrenderer_free(ptr >>> 0, 1));

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

let cachedFloat32ArrayMemory0 = null;
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

let cachedUint8ArrayMemory0 = null;
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

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
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
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
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
        module_or_path = new URL('mochart_wasm_new_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
