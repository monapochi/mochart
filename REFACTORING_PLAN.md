# Mochart リファクタリング計画

## 1. 現アーキテクチャ診断

### 1.1 構造マップ（現状）

```
┌─────────────────────────────────────────────────────────────┐
│  src/index.ts  (公開 API)                                    │
│  ├── createEmbedAPI()  ← デモで使用                          │
│  └── MoChart           ← export のみ、デモ未使用              │
└──────┬──────────────────────────┬───────────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────┐           ┌──────────────┐
│  EmbedAPI    │           │  MoChart     │
│  (embedApi)  │           │  (chart.ts)  │
│              │           │              │
│  DOM Events  │           │  rAF ループ   │
│  Tooltip/UI  │           │  Indicator   │
│              │           │  TradeMarker │
└──────┬───────┘           └──────┬───────┘
       │(as any)                  │
       ▼                          ▼
┌──────────────┐           ┌──────────────────┐
│  ChartCore   │           │  ChartRenderer   │
│              │           │  (interface)      │
│  Viewport    │           │  ├ WebGPURenderer │
│  SeriesStore │           │  └ WebGL2Renderer │
│  Events      │           └──────────────────┘
└──────┬───────┘
       │(直接 new)
       ▼
┌──────────────────┐
│ CanvasRenderer   │
│ (ChartRenderer   │
│  未実装!)         │
└──────────────────┘
```

### 1.2 問題一覧

| # | カテゴリ | 問題 | 深刻度 |
|---|---------|------|--------|
| P1 | **二重系統** | `ChartCore` と `MoChart` が同じ責務を別々に実装 | 🔴 致命 |
| P2 | **レイヤー突き抜け** | EmbedAPI が `(core as any)._renderer` / `.seriesStore` / `.viewportStartIndex` を直接参照 | 🔴 致命 |
| P3 | **同期ブロッキング描画** | pan/zoom のたびに即座に全面再描画。1フレーム内に最大4回描画が走る | 🟠 重大 |
| P4 | **ミュータブル状態散在** | viewport 状態が `ChartCore` 内で直接変更、スナップショット不可 | 🟠 重大 |
| P5 | **インターフェース不一致** | `CanvasRenderer` が `ChartRenderer` interface を実装していない | 🟠 重大 |
| P6 | **リクエスト結合なし** | pinch の zoomAt+panBy、hover の redraw+crosshair が個別に描画。batch API なし | 🟠 重大 |
| P7 | **全量データコピー** | `setSeriesData` で配列を `.slice()` コピー、差分更新なし | 🟡 中 |
| P8 | **全量再計算** | Indicator が毎回 O(n) フル再計算（incremental `update()` 未使用） | 🟡 中 |
| P9 | **型安全性の喪失** | `(this.core as any)` が 12箇所、private field を 6つ外部参照 | 🟡 中 |
| P10 | **GC プレッシャー** | `drawSeries` 内で毎フレーム `data.slice()` + `Date` + 配列生成 | 🟡 中 |
| P11 | **リサイズ未対応** | ResizeObserver なし、DPR 変更未検知 | ⚪ 軽 |

---

## 2. ターゲットアーキテクチャ

### 2.1 設計原則

| 原則 | 現状 | 目標 |
|------|------|------|
| **Immutable State** | mutable fields を直接変更 | `Readonly<ChartState>` + pure reducer |
| **Unidirectional Flow** | EmbedAPI → Core ← Renderer 双方向 | Action → Store → Scheduler → Renderer 一方向 |
| **Non-blocking Render** | 同期即時描画 | rAF バッチ + dirty flag コアレッセンス |
| **Action Batching** | 各操作が即 drawSeries 呼出 | 複数 Action を1フレームにまとめて1回描画 |
| **Streaming / Incremental** | 全量コピー・全量再計算 | append-only + incremental indicator |
| **Interface Segregation** | 具象クラス直参照 | trait (interface) 経由のみ |
| **Zero-copy** | slice/spread コピー多数 | TypedArray view + offset 参照 |
| **Cache-Friendly Footprint** | AoS Object[] (ポインタ追跡多発、L1/L2 ミス) | SoA TypedArray (連続メモリ、SIMD レーン充填)。ホットパス上のアロケーション 0。バンドル < 50 KB gzip 目標 |

### 2.2 ターゲット構造

```
┌──────────────────────────────────────────────────────────┐
│  Public API Layer                                         │
│                                                          │
│  createChart(container, options) → ChartHandle            │
│    .addSeries(opts) → SeriesHandle                       │
│    .setData(data)                                         │
│    .panBy(delta) / .zoomAt(factor, center)               │
│    .addIndicator(id, params) → IndicatorHandle           │
│    .on(event, handler) / .destroy()                      │
│                                                          │
│  ※ Readonly handles のみ返す。内部 state への直接参照なし    │
└────────────────────┬─────────────────────────────────────┘
                     │ dispatch(Action)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  ChartStore                                               │
│                                                          │
│  state: Readonly<{                                       │
│    viewport: { startIndex, visibleCount, rightMargin }   │
│    series: Map<id, { config, dataRef }>                  │
│    indicators: IndicatorInstance[]                        │
│    interaction: { drag, hover, pinch }                   │
│    layout: { width, height, dpr }                        │
│  }>                                                      │
│                                                          │
│  reduce(state, action) → newState  (pure function)       │
│  subscribe(selector, callback)     (fine-grained)        │
│  dirty: Set<'viewport'|'data'|'indicator'|'layout'>      │
└────────────────────┬─────────────────────────────────────┘
                     │ dirty flags
                     ▼
┌──────────────────────────────────────────────────────────┐
│  RenderScheduler                                          │
│                                                          │
│  - rAF 1回 / フレーム (コアレッセンス)                      │
│  - Priority: interaction > data > indicator              │
│  - dirty なレイヤーだけ再描画                               │
│  - isIntersecting (IntersectionObserver) で非表示時停止     │
└────────────────────┬─────────────────────────────────────┘
                     │ RenderSnapshot (frozen state slice)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  Renderer (interface ChartRenderer)                       │
│                                                          │
│  render(snapshot: RenderSnapshot): void                   │
│  hitTest(x, y, snapshot): HitResult | null               │
│  getLayout(snapshot): LayoutInfo                         │
│                                                          │
│  Implementations:                                        │
│  ├── CanvasRenderer   (Canvas 2D)                        │
│  ├── WebGL2Renderer   (WebGL 2)                          │
│  └── WebGPURenderer   (WebGPU)                           │
│                                                          │
│  ※ Stateless: snapshot から描画。自身の state を持たない     │
└──────────────────────────────────────────────────────────┘
```

### 2.3 データフロー詳細

```
ユーザー操作                     リアルタイム
  │                                │
  ▼                                ▼
Action                          Action
{ type: 'PAN', delta: 3.2 }    { type: 'APPEND_BAR', bar: {...} }
  │                                │
  └────────────┬───────────────────┘
               ▼
         reduce(state, action)
               │
               ├── 新 state 生成 (structuralSharing で最小コピー)
               ├── dirty.add('viewport')
               │
               ▼
         RenderScheduler.markDirty()
               │
         ┌─ rAF コアレッセンス (1フレーム内の複数 dispatch を合体) ─┐
         │                                                        │
         │  const snapshot = freezeSnapshot(store.state)          │
         │  renderer.render(snapshot)                              │
         │  dirty.clear()                                         │
         └────────────────────────────────────────────────────────┘
```

### 2.4 バッチ処理・コアレッセンス設計

現状、以下の操作が **それぞれ独立に即座に描画** を呼んでいる:

```
現状: ピンチズーム1フレーム内の呼び出し

  onTouchMove
    ├─ core.zoomAt(factor)   → drawSeries() ①   ← 全面再描画
    └─ core.panBy(correction) → drawSeries() ②  ← 全面再描画  (①は捨てられる)

  onPointerMove (hover直後)
    ├─ renderer.drawSeries() ③                    ← ゴースト除去のため再描画
    └─ renderer.drawCrosshairAt() ④               ← クロスヘア上書き

  計: 1フレームに 4回描画 (うち3回は無駄)
```

#### 2.4.1 Action コアレッセンス

同じフレーム内の同種 Action は **マージ** して1つにする:

```typescript
// src/core/actionQueue.ts

type ActionQueue = {
  pending: Action[];
  scheduled: boolean;
};

function coalesce(actions: Action[]): Action[] {
  // 同種 Action をマージ
  const merged: Action[] = [];
  let panAccum = 0;
  let lastZoom: Action | null = null;

  for (const a of actions) {
    switch (a.type) {
      case 'PAN':
        panAccum += a.deltaBars;           // PAN は加算マージ
        break;
      case 'ZOOM':
        lastZoom = a;                       // ZOOM は最後のものだけ採用
        break;
      case 'APPEND_BAR':
        // 同一 seriesId は最後の bar だけ (tick 更新)
        // 異なる time の bar は全て保持 (新 bar 追加)
        merged.push(a);
        break;
      default:
        merged.push(a);
    }
  }

  // マージ結果を順序保持で emit
  if (lastZoom) merged.push(lastZoom);
  if (panAccum !== 0) merged.push({ type: 'PAN', deltaBars: panAccum });

  return merged;
}
```

**効果**: ピンチの `zoomAt + panBy` 補正が1回の state 変更に。

#### 2.4.2 Render コアレッセンス (rAF バッチ)

```typescript
// src/core/scheduler.ts

class RenderScheduler {
  private actionQueue: Action[] = [];
  private rafId: number | null = null;
  private store: ChartStore;
  private renderer: ViewportRenderer;

  // --- 公開 API ---

  /** Action を enqueue。描画は次の rAF まで遅延 */
  enqueue(action: Action): void {
    this.actionQueue.push(action);
    this.scheduleFlush();
  }

  /** 複数 Action を一括 enqueue (batch API) */
  enqueueBatch(actions: Action[]): void {
    this.actionQueue.push(...actions);
    this.scheduleFlush();
  }

  /** 同期的に即時 flush (テスト用 / 強制更新) */
  flushSync(): void {
    this.cancelSchedule();
    this.flush();
  }

  // --- 内部 ---

  private scheduleFlush(): void {
    if (this.rafId !== null) return; // 既にスケジュール済み
    this.rafId = requestAnimationFrame(() => this.flush());
  }

  private cancelSchedule(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private flush(): void {
    this.rafId = null;

    // 1. キュー内の Action をコアレッセンス
    const actions = coalesce(this.actionQueue);
    this.actionQueue.length = 0;  // clear (GC-free)
    if (actions.length === 0) return;

    // 2. まとめて reduce (N actions → 1 state transition)
    let state = this.store.getState();
    for (const action of actions) {
      state = reduce(state, action);
    }
    this.store.setState(state);

    // 3. 1回だけ描画
    const snapshot = Object.freeze(state);
    this.renderer.render(snapshot);
  }
}
```

#### 2.4.3 バッチ化の具体的な適用箇所

| 現状のコード | 問題 | バッチ後 |
|-------------|------|---------|
| `panByBars()` → 即 `drawSeries()` × N series | pan のたび全系列再描画 | `enqueue({ type: 'PAN' })` → rAF で1回描画 |
| `zoomAt()` → 即 `drawSeries()` × N series | zoom のたび全系列再描画 | `enqueue({ type: 'ZOOM' })` → rAF で1回描画 |
| pinch: `zoomAt()` + `panBy()` | 1フレーム2回描画 | `enqueueBatch([ZOOM, PAN])` → coalesce → 1回描画 |
| `setSeriesData()` → 即 `drawSeries()` | データ設定で即描画 | `enqueue({ type: 'SET_DATA' })` → rAF で1回描画 |
| hover: `drawSeries()` + `drawCrosshairAt()` | 再描画 + オーバーレイ | `enqueue({ type: 'HOVER' })` → render + overlay を1回で |
| `setVisibleRange(from, to)` → 即 `drawSeries()` | panBy の内部分岐 | `enqueue({ type: 'SET_VIEWPORT' })` |
| リアルタイム tick 更新 (同一 time) | 1秒に数十回 drawSeries | `APPEND_BAR` coalesce → 最新 tick のみ残す |

#### 2.4.4 ユーザー向け Batch API

ライブラリ利用者が複数操作をアトミックにまとめられる API:

```typescript
// 公開 API
chart.batch(() => {
  chart.addSeries('candle', { ... });
  chart.setData(ohlcv);
  chart.addIndicator('bb', { period: 20 });
  chart.addIndicator('rsi', { period: 14 });
  chart.setViewport(100, 200);
});
// ← batch 終了時に 1回だけ描画

// 内部実装
class ChartHandle {
  private batching = false;

  batch(fn: () => void): void {
    this.batching = true;
    try {
      fn();  // 各メソッドは enqueue するだけ
    } finally {
      this.batching = false;
      this.scheduler.flushSync(); // batch 終了時に即 flush
    }
  }
}
```

#### 2.4.5 Microtask コアレッセンス (rAF の前段)

rAF は ~16ms 待つが、同期的なコードブロック内の複数 dispatch は **microtask** で先にまとめられる:

```
同期コードブロック:
  dispatch(PAN)     → queue に追加
  dispatch(ZOOM)    → queue に追加
  dispatch(PAN)     → queue に追加
  ── microtask checkpoint ──
  queueMicrotask(() => {
    coalesce queue  // PAN+PAN を1つにマージ, ZOOM は最終値
    scheduleRaf()   // rAF はまだ先
  })
  ── rAF ──
  flush()           // coalesced actions → 1 state → 1 render
```

これにより `batch()` API を使わなくても、同一 microtask 内の連続 dispatch は自動的にまとまる。

#### 2.4.6 パフォーマンス見積もり

| シナリオ | 現状 drawSeries 回数/frame | バッチ後 | 削減率 |
|---------|---------------------------|---------|-------|
| ピンチズーム | 2-3 | 1 | 50-67% |
| マウスドラッグ pan + hover | 2 | 1 | 50% |
| hover (crosshair + tooltip) | 2 | 1 | 50% |
| リアルタイム tick (10回/秒) + pan | 最大12 | 1 | 92% |
| `batch()` で初期化 (5操作) | 5 | 1 | 80% |

---

## 3. リファクタリング・フェーズ

### Phase R0: 地ならし（破壊的変更なし）
> 目的: 既存動作を維持しつつ、次フェーズの安全な足場を作る

| # | タスク | 対象ファイル | 概要 |
|---|--------|-------------|------|
| R0-1 | **`as any` 撲滅 — public API 追加** | chart.ts | `getRawStartIndex()`, `getLayout()`, `getPrimaryData()`, `drawCrosshair()`, `redraw()` を public に追加 |
| R0-2 | **EmbedAPI の private 参照を排除** | embedApi.ts | `(core as any)._renderer` → `core.getLayout()` etc. 12箇所のキャスト除去 |
| R0-3 | **CanvasRenderer に interface 実装** | canvasRenderer.ts, renderer.ts | `ChartRenderer` を拡張し `ViewportRenderer` interface として `drawSeries`, `getLayout`, `hitTest` を定義 |
| R0-4 | **テスト追加** | test/ | EmbedAPI の public method 経由の viewport 操作テスト |

**成果物**: `as any` 0件、全メソッド型付き

---

### Phase R1: Immutable State Store
> 目的: グローバルな mutable state をイミュータブルな Store に移行

```typescript
// 新ファイル: src/core/store.ts

type ChartState = Readonly<{
  viewport: Readonly<{
    startIndex: number;       // fractional OK
    visibleCount: number;
    rightMarginBars: number;
  }>;
  series: ReadonlyMap<string, Readonly<{
    config: SeriesOptions;
    data: readonly OhlcvPoint[];  // append-only ref
  }>>;
  indicators: readonly IndicatorInstance[];
  layout: Readonly<{
    width: number;
    height: number;
    dpr: number;
  }>;
}>;

type Action =
  | { type: 'PAN'; deltaBars: number }
  | { type: 'ZOOM'; factor: number; centerIndex?: number; centerRatio?: number }
  | { type: 'SET_DATA'; seriesId: string; data: OhlcvPoint[] }
  | { type: 'APPEND_BAR'; seriesId: string; bar: OhlcvPoint }
  | { type: 'RESIZE'; width: number; height: number; dpr: number }
  | { type: 'SET_VIEWPORT'; from: number; to: number };

function reduce(state: ChartState, action: Action): ChartState { ... }
```

| # | タスク | 概要 |
|---|--------|------|
| R1-1 | `ChartState` / `Action` 型定義 | 上記の型を定義 |
| R1-2 | `reduce()` 純粋関数 | viewport 計算ロジック（panBy, zoomAt, etc）を抽出 |
| R1-3 | `ChartStore` クラス | `dispatch(action)`, `getState()`, `subscribe(selector, cb)` |
| R1-4 | `ChartCore` → `ChartStore` 移行 | 内部 state を store 経由に。既存 API メソッドは dispatch ラッパーに |

**成果物**: 状態変更が全て `dispatch → reduce` 経由。undo/redo の道が開く

---

### Phase R2: Non-blocking Render Scheduler + Action Batching
> 目的: 1フレームに1回だけ描画。複数リクエストを1つにまとめる

詳細設計は §2.4 を参照。

| # | タスク | 概要 |
|---|--------|------|
| R2-1 | `ActionQueue` + `coalesce()` 実装 | 同種 Action のマージロジック (PAN 加算, ZOOM 最終値, APPEND_BAR 重複排除) |
| R2-2 | `RenderScheduler` 実装 | `enqueue()` / `enqueueBatch()` / `flushSync()` + rAF コアレッセンス |
| R2-3 | Microtask コアレッセンス | `queueMicrotask` で同期ブロック内の連続 dispatch を自動合体 |
| R2-4 | panBy/zoomAt の即時 drawSeries を撤去 | `store.dispatch → scheduler.enqueue` に。全7箇所の即時描画を除去 |
| R2-5 | `chart.batch()` 公開 API | ユーザーが複数操作をアトミックにまとめられる API |
| R2-6 | IntersectionObserver 統合 | 画面外で rAF 停止、復帰時に1回 flush |
| R2-7 | ResizeObserver 統合 | container サイズ変更 → `RESIZE` action enqueue |
| R2-8 | 描画計測基盤の導入 | `performance.mark/measure` で `reduce`/`render`/`upload`/`draw` を計測し、SIMD/Worker 導入判定に利用 |

**成果物**:
- pinch の `zoomAt + panBy` → 1回描画 (現状2-3回)
- リアルタイム tick 10回/秒 + pan → 1回描画 (現状最大12回)
- `batch()` で初期化5操作 → 1回描画

---

### Phase R3: Renderer Stateless 化 & Interface 統一 + Layer Compositing
> 目的: Renderer を純粋に描画だけの層にし、バックエンド切替可能に。多層合成と差分矩形で描画量を最小化。

技法 T1 (Multi-Layer Compositing), T4 (LTTB LOD), T5 (Dirty Rectangle) を組み込む。詳細は §9.1 参照。

```typescript
// 更新: src/renderer/renderer.ts

interface RenderSnapshot {
  viewport: ChartState['viewport'];
  series: ReadonlyMap<string, { config: SeriesOptions; data: readonly OhlcvPoint[] }>;
  layout: ChartState['layout'];
  indicators: readonly IndicatorInstance[];
  // pre-computed
  priceRange: { yMin: number; yMax: number };
  layoutMetrics: LayoutMetrics;
}

interface ChartRenderer {
  render(snapshot: RenderSnapshot): void;
  hitTest(x: number, y: number, snapshot: RenderSnapshot): HitResult | null;
  drawOverlay(snapshot: RenderSnapshot, overlay: OverlayCommand[]): void;
  resize(width: number, height: number, dpr: number): void;
  destroy(): void;
}
```

| # | タスク | 概要 |
|---|--------|------|
| R3-1 | `RenderSnapshot` 型定義 | Renderer が受け取る frozen state slice |
| R3-2 | CanvasRenderer を `ChartRenderer` 実装に | `drawSeries(id, data, opts)` → `render(snapshot)` |
| R3-3 | `hitTest()` 統一 | `mapClientToData` → `hitTest` に名前変更＋interface メソッド化 |
| R3-4 | Overlay 機構 | crosshair / tooltip / legend を overlay command として分離 |
| R3-5 | **Multi-Layer Compositing** (T1) | static / candles / overlay / animation の4層分離 |
| R3-6 | **Dirty Rectangle Tracking** (T5) | フレーム差分で変更矩形だけ再描画。スクロールは `drawImage` shift |
| R3-7 | **LTTB Downsampling** (T4) | visibleCount > plotWidth 時に自動ダウンサンプリング |
| R3-8 | **SIMD 頂点前処理（条件導入）** | 可視本数が閾値超過時のみ WASM SIMD で座標/頂点前処理を実行（小規模データは TS 経路維持） |

**成果物**: renderer が state を持たない。hover で overlay 層のみ更新 (描画面積 90% 削減)。100万本でも LOD で 60fps。

---

### Phase R4: Streaming / Incremental Data + Columnar Store
> 目的: 大量データ・リアルタイム更新を O(1) で処理。ゼロコピー・ゼロ GC。

技法 T7 (Columnar SoA), T8 (Ring Buffer), T10 (Predictive Prefetch), T12 (Backpressure), T14 (Time-Slicing) を組み込む。詳細は §9.2 参照。

| # | タスク | 概要 |
|---|--------|------|
| R4-1 | **Columnar DataStore** (T7) | AoS → SoA 移行。TypedArray ベースで SIMD 自動ベクトル化。GPU buffer 直接転送可 |
| R4-2 | **Ring Buffer for Ticks** (T8) | 固定容量循環バッファ。ゼロアロケーション tick 受信 |
| R4-3 | **Incremental Indicator** | `IndicatorDefinition.update()` を活用し、新 bar 分だけ O(1) 計算 |
| R4-4 | **Visible Window subarray view** | `data.slice()` → `TypedArray.subarray()` でゼロコピー |
| R4-5 | **Backpressure Sampler** (T12) | feed速度 > 描画速度のとき中間 tick をドロップ。暗号通貨対応 |
| R4-6 | **Predictive Prefetch** (T10) | パン速度から先読み方向・量を予測し非同期フェッチ |
| R4-7 | **Time-Sliced Indicator Compute** (T14) | 大量インジケータ計算を `scheduler.yield()` で時分割。入力応答性維持 |
| R4-8 | GC プレッシャー削減 | Date/toLocaleString キャッシュ、object pool、allocation-free hot path |

**成果物**: 100万本データでもリアルタイム追加が O(1)。毎秒100 tick でもゼロ GC。

---

### Phase R5: MoChart 統合 + GPU+SIMD Rendering
> 目的: 二重系統を統一。GPU と WASM SIMD の性能を最大限活用。

技法 T3 (Instanced Drawing), T6 (GPU Compute Pre-pass), T15 (WASM SIMD) を組み込む。詳細は §9.1, §9.2 参照。

| # | タスク | 概要 |
|---|--------|------|
| R5-1 | MoChart のインジケータ計算を Store 側に移設 | `computeIndicatorSegments` → Store の middleware 的に |
| R5-2 | **Instanced Candle Rendering** (T3) | 1 draw call で N 本のローソク足。per-instance OHLC buffer |
| R5-3 | **GPU Compute Pre-pass** (T6) | price range + 頂点生成を compute shader で並列実行 |
| R5-3a | **Compute 前処理の計測ゲート** | GPU pre-pass と SIMD CPU 前処理をベンチ比較し、系列数/データ量で実行経路を自動選択 |
| R5-4 | **WASM SIMD インジケータカーネル** (T15) | Rust で SMA/EMA/Bollinger/RSI/MACD/ATR/LTTB を SIMD 実装。TS fallback 付き |
| R5-5 | **計算パイプライン分岐** | GPU 利用可 → T6、不可 → T15 WASM SIMD → TS の3段フォールバック |
| R5-6 | WebGPURenderer が `render(snapshot)` を実装 | Stateless ChartRenderer interface 準拠 |
| R5-7 | MoChart クラスを deprecated → createChart ファクトリに | 外部API は `createChart()` 一本に |
| R5-8 | 未使用コード削除 | ChartCore の旧 drawSeries 呼び出し等 |

---

## 4. 最終アーキテクチャ（R6 完了後の姿）

本セクションは「リファクタ完了時にコードがどういう形になるか」の完全な定義である。
フェーズタスク表（§3）は **ここに到達するための差分** であり、迷ったらここに戻る。

### 4.1 最終ディレクトリ構成

```
src/
  index.ts                        ← 公開 re-export のみ (型 + ファクトリ)
  api/
    createChart.ts                ← 唯一のファクトリ関数 (旧 createEmbedAPI + MoChart を統合)
    chartHandle.ts                ← ChartHandle: ユーザーが触る Readonly ハンドル
    seriesHandle.ts               ← SeriesHandle
    indicatorHandle.ts            ← IndicatorHandle
    types.ts                      ← 公開 API の型 (ChartOptions, SeriesOptions, etc.)
  store/
    store.ts                      ← ChartStore: dispatch / getState / subscribe
    state.ts                      ← ChartState 型定義 (Readonly<{viewport, series, ...}>)
    actions.ts                    ← Action union type
    reducer.ts                    ← reduce(state, action) 純粋関数
    selectors.ts                  ← 導出値 (visibleData, priceRange, layoutMetrics)
  scheduler/
    scheduler.ts                  ← RenderScheduler: rAF batch + dirty flag
    actionQueue.ts                ← coalesce() ロジック
    perfMonitor.ts                ← performance.mark/measure 計測基盤
  data/
    columnarStore.ts              ← ColumnarOHLCV (SoA TypedArray)
    ringBuffer.ts                 ← TickRingBuffer (リアルタイム tick 受信)
    downsample.ts                 ← LTTB / Min-Max ダウンサンプリング
    prefetcher.ts                 ← 予測的先読み
    backpressure.ts               ← FrameAlignedSampler
  indicators/
    registry.ts                   ← IndicatorRegistry (現 indicators.ts)
    catalog.ts                    ← フェーズ別インジケータ登録 (現 indicatorCatalog.ts)
    definitions/
      phase1.ts                   ← SMA, EMA, BB, Volume, Pivot (既存)
      phase2.ts                   ← RSI, MACD, ATR, TradeMarkers (既存)
      phase3.ts                   ← VWAP, BBWidth, %B, VolRatio (既存)
      phase4.ts                   ← OBV, MFI, CMF, Divergence, Squeeze (既存)
    types.ts                      ← IndicatorDefinition, IndicatorResult, etc. (現 indicatorTypes.ts)
  renderer/
    types.ts                      ← RenderSnapshot, ChartRenderer interface, HitResult, OverlayCommand
    factory.ts                    ← createRenderer(backend, canvas): ChartRenderer
    canvas/
      canvasRenderer.ts           ← Canvas2D 実装 (implements ChartRenderer)
      layerManager.ts             ← 4層 OffscreenCanvas 合成 (T1)
      damageTracker.ts            ← Dirty Rectangle (T5)
    webgl2/
      webgl2Renderer.ts           ← WebGL2 実装 (implements ChartRenderer)
    webgpu/
      webgpuRenderer.ts           ← WebGPU 実装 + instanced draw (T3)
      shaders/
        candle_instanced.wgsl     ← インスタンス描画シェーダ
        compute_prepass.wgsl      ← GPU compute price range + 頂点生成 (T6)
    worker/
      renderWorker.ts             ← OffscreenCanvas Worker (T2, opt-in)
      protocol.ts                 ← Main↔Worker メッセージ型
  interaction/
    eventBridge.ts                ← DOM イベント → Action 変換 (旧 embedApi のイベント部分)
    tooltip.ts                    ← ツールチップ UI
    legend.ts                     ← 凡例 UI
    crosshair.ts                  ← クロスヘア (OverlayCommand 生成)
  wasm/                           ← (opt-in, R5 以降)
    simdBridge.ts                 ← WASM SIMD ローダー + TS フォールバック分岐
    pkg/                          ← wasm-pack 出力 (.wasm + JS glue)
  i18n.ts                         ← 国際化 (既存)
  tradeMarkers.ts                 ← TradeMarker 型 + デフォルトスタイル (既存)

crates/                           ← (opt-in, R5 以降)
  mochart-wasm/
    Cargo.toml
    src/
      lib.rs
      indicators.rs               ← SMA/EMA/BB/RSI/MACD/ATR SIMD カーネル
      scan.rs                     ← min_max, LTTB

test/
  store/
    reducer.test.ts               ← reduce() の純粋関数テスト
    selectors.test.ts
  scheduler/
    coalesce.test.ts
    scheduler.test.ts
  renderer/
    snapshot.test.ts
  data/
    columnar.test.ts
    downsample.test.ts
  indicators/
    indicators.test.ts            ← 既存
  api/
    embedApi.test.ts              ← 既存 → createChart.test.ts にリネーム
  bench/
    render.bench.ts               ← 描画パイプラインベンチ (SIMD/Worker 判定用)
    indicator.bench.ts            ← インジケータ計算ベンチ
```

### 4.2 現ファイル → 最終ファイル 対応表

| 現在のファイル | 最終的な行き先 | 変更内容 |
|--------------|-------------|---------|
| `src/index.ts` | `src/index.ts` | re-export のみに縮小。`createChart` を公開 |
| `src/core/chart.ts` ChartCore | **削除** | → `store/reducer.ts` (状態ロジック) + `api/chartHandle.ts` (公開 API) |
| `src/core/chart.ts` MoChart | **削除** | → R5 で `createChart` に統合後、削除 |
| `src/core/embedApi.ts` | **削除** | → `api/createChart.ts` (ファクトリ) + `interaction/eventBridge.ts` (DOM) + `interaction/tooltip.ts` |
| `src/core/types.ts` | `src/api/types.ts` + `src/store/state.ts` | 公開型と内部型を分離 |
| `src/core/indicatorTypes.ts` | `src/indicators/types.ts` | 移動のみ |
| `src/core/indicators.ts` | `src/indicators/registry.ts` | 移動のみ |
| `src/core/indicatorCatalog.ts` | `src/indicators/catalog.ts` | 移動のみ |
| `src/core/i18n.ts` | `src/i18n.ts` | 移動のみ |
| `src/core/tradeMarkers.ts` | `src/tradeMarkers.ts` | 移動のみ |
| `src/renderer/renderer.ts` | `src/renderer/types.ts` | `RenderSnapshot` + `ChartRenderer` を完全定義 |
| `src/renderer/canvas/canvasRenderer.ts` | 同パス | `ChartRenderer` 準拠に書き換え |
| `src/renderer/webgl2/webgl2Renderer.ts` | 同パス | `ChartRenderer` 準拠に書き換え |
| `src/renderer/webgpu/webgpuRenderer.ts` | 同パス | `ChartRenderer` 準拠 + instanced draw |
| `src/indicators/phase{1-4}.ts` | `src/indicators/definitions/phase{1-4}.ts` | 移動のみ |
| `src/demo/` | `src/demo/` | `createChart()` 呼び出しに更新 |

### 4.3 レイヤー構造と依存方向

```
┌─────────────────────────────────────────────────────────────────────┐
│                        src/index.ts                                  │
│           createChart(), 型の re-export のみ                          │
└──────┬────────────────────────────────────────────────────┬─────────┘
       │                                                    │
       ▼                                                    ▼
┌──────────────┐                                    ┌──────────────────┐
│  api/        │                                    │  indicators/     │
│              │                                    │                  │
│ createChart()│─── new ──► ChartStore              │ registry.ts      │
│ ChartHandle  │─── new ──► RenderScheduler         │ definitions/     │
│ SeriesHandle │─── new ──► EventBridge             │ (pure functions) │
│              │─── new ──► createRenderer()        │                  │
└──────┬───────┘                                    └────────┬─────────┘
       │ dispatch(Action)                                    │ calculate(data, params)
       ▼                                                     │
┌──────────────┐    subscribe     ┌──────────────────┐       │
│  store/      │◄────────────────│  scheduler/       │       │
│              │                  │                   │       │
│ ChartStore   │─ getState() ──►│ RenderScheduler   │       │
│ reduce()     │                  │ coalesce()        │       │
│              │                  │ perfMonitor       │       │
└──────┬───────┘                  └────────┬──────────┘       │
       │ state.series.data                 │ snapshot         │
       ▼                                   ▼                  ▼
┌──────────────┐                  ┌──────────────────┐┌──────────────┐
│  data/       │                  │  renderer/       ││  wasm/       │
│              │                  │                  ││  (opt-in)    │
│ ColumnarOHLCV│ ◄── subarray ── │ ChartRenderer    ││ simdBridge   │
│ RingBuffer   │    (zero-copy)  │ ├ Canvas         ││ SIMD kernels │
│ downsample   │                  │ ├ WebGL2        │└──────────────┘
│ prefetcher   │                  │ ├ WebGPU        │
│ backpressure │                  │ └ Worker(opt-in)│
└──────────────┘                  └──────────────────┘
                                         ▲
                                         │ OverlayCommand[]
                                  ┌──────┴──────────┐
                                  │  interaction/   │
                                  │                 │
                                  │ eventBridge     │  DOM → Action
                                  │ tooltip         │  HitResult → HTML
                                  │ legend          │  state → HTML
                                  │ crosshair       │  → OverlayCommand
                                  └─────────────────┘
```

**依存方向ルール（厳守）**:

```
api/           → store/, scheduler/, renderer/, interaction/   (上から下のみ)
store/         → (何にも依存しない。純粋な state + reducer)
scheduler/     → store/ (read-only)
renderer/      → (何にも依存しない。snapshot を受け取るだけ)
data/          → (何にも依存しない。TypedArray 操作のみ)
interaction/   → (何にも依存しない。DOM → Action 変換のみ)
indicators/    → data/ (read-only)
wasm/          → (何にも依存しない。計算カーネルのみ)
```

**循環依存 = 0**。すべての矢印は上から下、または左から右。

### 4.4 コア型定義（最終形）

#### 4.4.1 状態 (store/state.ts)

```typescript
export type ChartState = Readonly<{
  viewport: Readonly<{
    startIndex: number;         // fractional OK (smooth scroll)
    visibleCount: number;
    rightMarginBars: number;
  }>;
  series: ReadonlyMap<string, Readonly<{
    config: SeriesConfig;
    dataRef: ColumnarRef;       // ColumnarOHLCV への参照 (コピーなし)
  }>>;
  indicators: readonly IndicatorInstance[];
  layout: Readonly<{
    width: number;
    height: number;
    dpr: number;
  }>;
  interaction: Readonly<{
    hover: { x: number; y: number } | null;
    drag: { active: boolean; startX: number; startIndex: number } | null;
    pinch: { startDist: number; lastDist: number; centerIndex: number } | null;
  }>;
}>;

// ColumnarOHLCV への参照。データ本体は data/columnarStore に存在し、
// state にはポインタだけ持つ (structural sharing)
//
// メモリバジェット (SoA Float32Array, 6 ch × 4B = 24B/bar):
//   1,000 bars (1画面)   →  24 KB   — L1 キャッシュに収まる (通常 32-48 KB)
//   10,000 bars           → 240 KB   — L2 に収まる
//   1,000,000 bars (10年) →  24 MB   — L3 に収まる (通常 6-32 MB)
//
// 比較: 現 AoS Object[] は 1 bar ≈ 80B → 同データで 80 MB + GC 圧力
export type ColumnarRef = Readonly<{
  storeId: string;
  length: number;
  version: number;     // append ごとに increment → selector の equality check に使用
}>;
```

#### 4.4.2 アクション (store/actions.ts)

```typescript
export type Action =
  | { type: 'PAN'; deltaBars: number }
  | { type: 'ZOOM'; factor: number; centerIndex?: number; centerRatio?: number }
  | { type: 'SET_VIEWPORT'; from: number; to: number }
  | { type: 'SET_DATA'; seriesId: string; version: number }
  | { type: 'APPEND_BAR'; seriesId: string; version: number }
  | { type: 'ADD_SERIES'; seriesId: string; config: SeriesConfig }
  | { type: 'REMOVE_SERIES'; seriesId: string }
  | { type: 'ADD_INDICATOR'; instance: IndicatorInstance }
  | { type: 'REMOVE_INDICATOR'; instanceId: string }
  | { type: 'RESIZE'; width: number; height: number; dpr: number }
  | { type: 'HOVER'; x: number; y: number }
  | { type: 'HOVER_LEAVE' }
  | { type: 'DRAG_START'; x: number }
  | { type: 'DRAG_MOVE'; x: number }
  | { type: 'DRAG_END' }
  | { type: 'PINCH_START'; dist: number; centerIndex: number }
  | { type: 'PINCH_MOVE'; dist: number }
  | { type: 'PINCH_END' };
```

#### 4.4.3 レンダースナップショット (renderer/types.ts)

```typescript
export type RenderSnapshot = Readonly<{
  viewport: ChartState['viewport'];
  layout: ChartState['layout'];

  // --- Selector が事前計算した導出値 ---
  visibleData: ColumnarSlice;         // subarray view (ゼロコピー)
  priceRange: { yMin: number; yMax: number };
  layoutMetrics: LayoutMetrics;       // plotX/Y/W/H, stepX, candleW
  indicators: readonly IndicatorOutput[];
  overlays: readonly OverlayCommand[];  // crosshair, tooltip range, alerts
  seriesConfigs: ReadonlyMap<string, SeriesConfig>;
}>;

export type ColumnarSlice = Readonly<{
  time:   Float64Array;   // subarray view — コピーなし
  open:   Float32Array;
  high:   Float32Array;
  low:    Float32Array;
  close:  Float32Array;
  volume: Float32Array;
  length: number;
  globalOffset: number;   // 元データ上での開始 index
}>;

export type LayoutMetrics = Readonly<{
  plotX: number; plotY: number;
  plotW: number; plotH: number;
  stepX: number; candleW: number;
  startIndex: number; startIndexRaw: number;
  visibleCount: number;
  yMin: number; yMax: number;
  rightMarginBars: number;
}>;

export type OverlayCommand =
  | { type: 'crosshair'; x: number; y: number; price: number; time: number }
  | { type: 'tooltip'; x: number; y: number; html: string }
  | { type: 'alert'; rect: DamageRect; color: string };

export type HitResult = {
  seriesId: string;
  index: number;
  point: { time: number; open: number; high: number; low: number; close: number; volume: number };
  x: number;
  y: number;
  priceAtY: number;
};
```

#### 4.4.4 レンダラーインターフェース (renderer/types.ts)

```typescript
export interface ChartRenderer {
  /** スナップショットから1フレーム描画 */
  render(snapshot: RenderSnapshot): void;

  /** オーバーレイ層のみ再描画 (crosshair, tooltip) */
  renderOverlay(snapshot: RenderSnapshot): void;

  /** クリック / ホバー対象の candle を特定 */
  hitTest(x: number, y: number, snapshot: RenderSnapshot): HitResult | null;

  /** キャンバスリサイズ */
  resize(width: number, height: number, dpr: number): void;

  /** リソース解放 */
  destroy(): void;
}
```

### 4.5 公開 API（最終形）

```typescript
// src/index.ts から export される唯一のファクトリ
export function createChart(
  container: HTMLElement,
  options?: ChartOptions,
): ChartHandle;

// --- ChartHandle: ユーザーが操作する唯一のオブジェクト ---
export interface ChartHandle {
  // --- Series ---
  addSeries(config: SeriesConfig): SeriesHandle;
  removeSeries(id: string): void;

  // --- Data ---
  setData(seriesId: string, data: OhlcvPoint[]): void;
  appendBar(seriesId: string, bar: OhlcvPoint): void;

  // --- Viewport ---
  panBy(deltaBars: number): void;
  zoomAt(factor: number, centerIndex?: number): void;
  setViewport(from: number, to: number): void;
  getVisibleRange(): { from: number; to: number };

  // --- Indicators ---
  addIndicator(id: string, params?: Record<string, unknown>): IndicatorHandle;
  removeIndicator(instanceId: string): void;

  // --- Batch ---
  batch(fn: () => void): void;

  // --- Events ---
  on<K extends keyof ChartEvents>(event: K, handler: ChartEvents[K]): void;
  off<K extends keyof ChartEvents>(event: K, handler?: ChartEvents[K]): void;

  // --- Lifecycle ---
  resize(): void;
  destroy(): void;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  locale?: string;
  theme?: 'light' | 'dark';
  renderer?: 'auto' | 'canvas' | 'webgl2' | 'webgpu' | 'canvas-worker';
  defaultVisibleDays?: number;
  rightMarginDays?: number;
  enableTooltip?: boolean;
  enableCrosshair?: boolean;
  showLegend?: boolean;
  tooltipFormatter?: (point: OhlcvPoint, index: number) => string;
}

export interface ChartEvents {
  rangeChanged: (range: { from: number; to: number }) => void;
  click: (hit: HitResult | null) => void;
  hover: (hit: HitResult | null) => void;
}
```

### 4.6 データフロー（具体例: ユーザーがトラックパッドで pan）

```
1. EventBridge.onWheel(ev)
   │  DOM WheelEvent を受け取り、pixel → bars 変換
   │  ev.getCoalescedEvents() で 120Hz 入力を統合 (T11)
   ▼
2. scheduler.enqueue({ type: 'PAN', deltaBars: 2.3 })
   │  ActionQueue に push。rAF がまだスケジュールされていなければ requestAnimationFrame()
   │
   │  ── 同じフレーム内に zoomAt() が来た場合 ──
   │  scheduler.enqueue({ type: 'ZOOM', factor: 1.1 })
   │
   ▼
3. rAF fires → scheduler.flush()
   │
   │  3a. coalesce([PAN(2.3), PAN(0.7)]) → PAN(3.0)    ← 同種マージ
   │  3b. for (action of coalesced) { state = reduce(state, action) }
   │  3c. performance.measure('reduce', ...)             ← R2-8 計測
   │
   ▼
4. store.setState(newState)
   │  subscribers に通知 (selector で変更検知: viewport が変わった)
   │
   ▼
5. scheduler: snapshot = selectors.buildSnapshot(state, dataStore)
   │
   │  5a. visibleData = columnar.sliceView(start, count)  ← subarray, コピーなし (T7)
   │  5b. priceRange = columnar.priceRange(start, count)   ← SIMD 自動ベクトル化 or WASM (T15)
   │  5c. indicators = registry.computeIncremental(...)     ← O(1) or time-sliced (T14)
   │  5d. layoutMetrics = computeLayout(viewport, layout, priceRange)
   │  5e. overlays = interaction.hover → crosshairCommand
   │  5f. Object.freeze(snapshot)
   │
   ▼
6. renderer.render(snapshot)
   │
   │  Canvas2D path:
   │    6a. damageTracker.computeDamage(prev, snapshot)    ← T5
   │    6b. layerManager.invalidate('candles')             ← T1 (overlay は別レイヤー)
   │    6c. candles 層だけ再描画、static 層はスキップ
   │    6d. layerManager.composite()                       ← 全レイヤー合成
   │
   │  WebGPU path:
   │    6a. device.queue.writeBuffer(instanceBuffer, ohlcData)  ← instanced draw (T3)
   │    6b. pass.draw(6, visibleCount)                           ← 1 draw call
   │
   │  performance.measure('render', ...)
   │
   ▼
7. renderer.renderOverlay(snapshot)
   │  crosshair / tooltip を overlay 層に描画 (candles 再描画なし)
   │
   ▼
8. 画面に反映。次の rAF まで idle。
```

### 4.7 依存関係ルール（厳守）

```
api/           → store/, scheduler/, renderer/factory, interaction/, indicators/registry
store/         → (nothing — 純粋な state + reducer、DOM もブラウザ API も参照しない)
scheduler/     → store/ (read-only getState)
renderer/      → (nothing — snapshot を受け取り pixels を返すだけ)
data/          → (nothing — TypedArray 操作のみ)
interaction/   → (nothing — DOM event → Action record 変換のみ)
indicators/    → data/ (read-only)
wasm/          → (nothing — 計算カーネルのみ)
```

**ルール**: 同レイヤー間の import 禁止。下層から上層への import 禁止。`import type` は例外的に許可（型のみ）。

### 4.8 現コード → 最終コード 移行の大きな流れ

```
Phase   何が起きるか                                  消えるもの
─────   ──────────────────────────────────────────   ──────────────
R0      ChartCore に public accessor 追加            (as any) 12箇所
        EmbedAPI が public API 経由に
        CanvasRenderer が ViewportRenderer 準拠

R1      store/ 新設                                  ChartCore の mutable fields
        reduce() に viewport 計算を抽出               panBy/zoomAt 内の直接 state 変更
        ChartCore.panBy() → store.dispatch() ラッパー

R2      scheduler/ 新設                              drawSeries() 即時呼び出し全7箇所
        全 panBy/zoomAt/setData が enqueue() 経由に    同期描画パス
        interaction/eventBridge.ts 新設               EmbedAPI の DOM イベント部分

R3      renderer/types.ts に RenderSnapshot 定義      CanvasRenderer の viewport state
        CanvasRenderer → render(snapshot) 書き換え     drawSeries(id, data, opts) シグネチャ
        layerManager + damageTracker 新設

R4      data/ 新設                                    AoS Object[] データ
        ColumnarOHLCV + RingBuffer                     data.slice() 毎フレームコピー
        IndicatorDefinition.update() 活用              O(n) fullrecalc パス

R5      wasm/ 新設 + crates/                          MoChart クラス全体
        WebGPU instanced draw                          ChartCore (残骸)
        api/createChart.ts が唯一のエントリ             createEmbedAPI()

R6      renderer/worker/ 新設                          (追加のみ、削除なし)
        SharedArrayBuffer 対応                         main-thread 描画は残す (フォールバック)
```

---

## 5. 設計比較: Before / After

| 観点 | Before (現状) | After (目標) | 適用技法 |
|------|--------------|-------------|---------|
| **状態管理** | mutable fields scattered | Immutable store + pure reducer | R1 |
| **描画タイミング** | 即時・複数回/frame | rAF batch, 1回/frame | R2 §2.4 |
| **リクエスト結合** | 各操作が独立に描画 | Action coalesce + batch() API | R2 §2.4 |
| **描画範囲** | 毎回全面再描画 | Multi-layer compositing + dirty rect | R3 T1,T5 |
| **描画スレッド** | main thread のみ | OffscreenCanvas + Worker (opt-in) | R6 T2,T9 |
| **Draw calls** | N candles × 2-3 calls each | 1 instanced draw call | R5 T3 |
| **大量データ表示** | 全 candle を処理 | LTTB downsampling | R3 T4 |
| **GPU 活用** | 頂点生成は CPU のみ | Compute pre-pass on GPU | R5 T6 |
| **データ構造** | AoS (Object[]) | SoA Columnar TypedArray | R4 T7 |
| **データ更新** | 全量 slice コピー | append-only, zero-copy subarray | R4 T7 |
| **リアルタイム tick** | 毎 tick drawSeries | Ring buffer + backpressure | R4 T8,T12 |
| **インジケータ更新** | O(n) full recalc | O(1) incremental + time-sliced | R4 T14 |
| **CPU ベクトル演算** | V8 scalar (auto-vec 不確実) | WASM SIMD 4-wide 確実ベクトル化 | R5 T15 |
| **入力精度** | 60Hz PointerEvent | getCoalescedEvents() 120-240Hz | R2 T11 |
| **先読み** | なし | 予測的 prefetch (pan velocity) | R4 T10 |
| **レイヤー結合** | `(core as any)` → private field | strict interface boundary | R0 |
| **Renderer 切替** | 不可能 (concrete 直結) | `createRenderer('auto')` で runtime 切替 | R3 |
| **テスタビリティ** | 困難 (DOM + mutable state) | `reduce()` は `bun test` だけで検証可 | R1 |
| **Undo/Redo** | 不可能 | state history で可能 | R1 |
| **SSR 安全性** | DOM 依存が Core に混入 | store/ は純粋 JS、DOM は api/ と interaction/ のみ | R1,R2 |
| **メモリフットプリント** | AoS Object[] (1 bar = 7 prop × 8B + header ≈ 80B) | SoA Float32Array (1 bar = 6×4B = 24B)。同データ量で **~70% 削減** | R4 T7 |
| **CPU キャッシュ効率** | オブジェクトがヒープに散在、L1/L2 ミス多発 | TypedArray = 連続アドレス。price scan は L1 に乗る (64B line × 16 floats) | R4 T7 |
| **バンドルサイズ** | 未計測 (推定 ~80KB gzip) | < 50 KB gzip (core)。WASM/WebGPU は遅延 import | R5 |

---

## 6. 実行スケジュール

```
R0 (地ならし)         ███░░░░░░░░░░░░░  密結合の解消
R1 (Immutable Store)  ░░░███░░░░░░░░░░  store/ 新設 → reduce パターン導入
R2 (Scheduler+Input)  ░░░░░░██░░░░░░░░  scheduler/ + interaction/ 新設 → rAF batch
R3 (Renderer+Layer)   ░░░░░░░░███░░░░░  renderer/ 書き換え → Stateless + T1 layers + T4 LOD + T5 dirty rect
R4 (Stream+Columnar)  ░░░░░░░░░░░██░░░  data/ 新設 → T7 columnar + T8 ring + T10 prefetch + T12 backpressure
R5 (GPU+SIMD統合)     ░░░░░░░░░░░░░██░  wasm/ + api/createChart → T3 instanced + T6 compute + T15 SIMD
R6 (Worker)           ░░░░░░░░░░░░░░░█  renderer/worker/ 新設 → T2 OffscreenCanvas + T9 SharedArrayBuffer (opt-in)
```

各フェーズ完了時に **全テスト通過 + デモ動作確認** を gate とする。

各フェーズ完了時に全テスト通過 + デモ動作確認を gate とする。

---

## 7. Phase R0 実装詳細（直ちに着手可能）

### R0-1: ChartCore に public API 追加

```typescript
// chart.ts に追加するメソッド

// viewport の raw (fractional) start index
get rawStartIndex(): number { return this.viewportStartIndex; }

// プライマリ系列データの読み取り専用アクセス
getPrimaryData(): readonly any[] { ... }

// レイアウト情報取得 (renderer 委譲)
getLayout(): LayoutInfo | null { ... }

// ヒットテスト (renderer 委譲)
hitTest(clientX: number, clientY: number): HitResult | null { ... }

// クロスヘア描画 (renderer 委譲)
drawCrosshair(clientX: number, clientY: number): void { ... }

// 全系列再描画
redraw(): void { ... }
```

### R0-2: EmbedAPI の `as any` 除去

```diff
- const renderer = (this.core as any)._renderer as any;
- const layout = renderer.getLayout(...)
+ const layout = this.core.getLayout();

- const seriesStore = (this.core as any).seriesStore as any;
- const primaryEntry = seriesStore ? Array.from(seriesStore.values())[0] : null;
+ const primaryData = this.core.getPrimaryData();

- const rawStartIndex = (this.core as any)?.viewportStartIndex;
+ const rawStartIndex = this.core.rawStartIndex;
```

### R0-3: CanvasRenderer に interface 追加

```typescript
// renderer.ts - 新 interface
export interface ViewportRenderer extends ChartRenderer {
  drawSeries(snapshot: RenderSnapshot): void;
  getLayout(snapshot: RenderSnapshot): LayoutInfo;
  hitTest(x: number, y: number, snapshot: RenderSnapshot): HitResult | null;
  drawOverlay(commands: OverlayCommand[]): void;
}
```

---

## 8. 参考: 現代 OS / フレームワーク対応表

| パラダイム | 代表例 | Mochart After での対応 |
|-----------|--------|----------------------|
| **Immutable State** | Elm, Redux, SwiftUI | ChartStore + pure reducer |
| **Unidirectional Data Flow** | Flux, Vuex | Action → Store → Renderer |
| **Non-blocking / Async** | React Fiber, Tokio | rAF scheduler, IntersectionObserver |
| **Request Coalescing** | Linux I/O scheduler, TCP Nagle | Action coalesce (PAN 加算, ZOOM 最終値) |
| **Batched Commit** | React 18 auto-batching, DB transaction | `batch()` API, microtask boundary |
| **Write Combining** | CPU write-combine buffer | 同一 seriesId の APPEND_BAR マージ |
| **Streaming** | RxJS, Kafka Streams | append-only DataStore + incremental indicator |
| **Entity Component System** | Unity ECS, Bevy | Series/Indicator を entity として扱う（R5以降） |
| **Command Pattern** | GPU Command Buffer | RenderSnapshot = frozen command |
| **Zero-copy** | io_uring, sendfile | TypedArray subarray view |
| **Structural Sharing** | Immer, Persistent DS | viewport 変更時に series は参照共有 |

---

## 9. 先端描画・I/O 技法の調査と適用

### 9.1 描画 (Rendering) 技法

#### T1: Multi-Layer Compositing (多層合成)

**出典**: Chrome Compositor Architecture (2013), Flutter Impeller Engine (2022), Skia Graphite

**原理**: 更新頻度の異なる要素を別レイヤー (Canvas / texture) に分離し、変更されたレイヤーだけ再描画。最終フレームは GPU compositing で合成。

```
現状: 1枚の Canvas に全要素を毎フレーム描画

目標:
  Layer 0 (static)   : 背景、グリッド線、軸ラベル     ← resize 時のみ再描画
  Layer 1 (candles)   : ローソク足、インジケータ線     ← viewport 変更時のみ
  Layer 2 (overlay)   : クロスヘア、ツールチップ、凡例  ← mousemove のたび
  Layer 3 (animation) : アラートフラッシュ、トランジション ← rAF 毎フレーム

合成: CSS `position: absolute` でスタッキング (GPU 合成自動)
  or  WebGPU multi-texture compositing pass
```

```typescript
// src/renderer/canvas/layerManager.ts

type LayerId = 'static' | 'candles' | 'overlay' | 'animation';

class LayerManager {
  private layers: Map<LayerId, OffscreenCanvas> = new Map();
  private dirty: Set<LayerId> = new Set();
  private presentCanvas: HTMLCanvasElement;

  /** 特定レイヤーだけ dirty にする */
  invalidate(layer: LayerId): void {
    this.dirty.add(layer);
  }

  /** dirty なレイヤーだけ再描画し、合成 */
  composite(): void {
    for (const id of this.dirty) {
      this.redrawLayer(id);
    }
    this.dirty.clear();
    this.blitAll();  // 全レイヤーを presentCanvas に合成
  }
}
```

**Mochart 適用先**: Phase R3 (Renderer統一) に組み込み。hover で全面再描画が不要になる (overlay 層のみ更新)。

**パフォーマンス効果**:
- hover/crosshair: 再描画面積 90% 削減 (overlay 層のみ)
- pan/zoom: static 層の再描画不要 (グリッド・軸は viewport 変更後に1回)

---

#### T2: OffscreenCanvas + Worker Thread Rendering

**出典**: W3C OffscreenCanvas spec (2018), Google "Off-main-thread rendering" (2019), Lin Clark "A Cartoon Intro to Fiber" (2017)

**原理**: 描画処理を Web Worker に移し、メインスレッドを入力イベント処理に専念させる。Worker 内で `OffscreenCanvas.getContext('2d')` or WebGL を使用。

```
Main Thread                          Worker Thread
──────────                          ─────────────
  pointer/wheel events               OffscreenCanvas
       │                                  │
       ▼                                  │
  RenderScheduler                         │
       │                                  │
       ├── postMessage(snapshot) ────────► │
       │                                  ▼
       │                            render(snapshot)
       │                                  │
       │                            ◄─── commit() (自動 transfer)
       │
  メインスレッドは描画待ち不要
  → 入力応答性 60fps 維持
```

```typescript
// src/renderer/worker/renderWorker.ts

// Worker 側
self.onmessage = (e: MessageEvent<RenderMessage>) => {
  const { type, snapshot, buffer } = e.data;
  if (type === 'render') {
    const ctx = offscreen.getContext('2d')!;
    canvasRenderer.renderToContext(ctx, snapshot);
    // OffscreenCanvas は自動的にメインスレッドに commit
  }
};

// Main Thread 側
class WorkerRenderer implements ChartRenderer {
  private worker: Worker;
  private offscreen: OffscreenCanvas;

  render(snapshot: RenderSnapshot): void {
    // Transferable で zero-copy 送信
    const buffer = serializeSnapshot(snapshot);
    this.worker.postMessage(
      { type: 'render', buffer },
      [buffer]  // transfer ownership
    );
  }
}
```

**Mochart 適用先**: Phase R6 (新設) — オプトイン方式。`{ renderer: 'canvas-worker' }` で有効化。

**注意**: OffscreenCanvas は Safari 16.4+ で対応。フォールバックは main-thread Canvas。

---

#### T3: Instanced Drawing (インスタンス描画)

**出典**: OpenGL Instanced Rendering (GL_ARB_draw_instanced), WebGPU Best Practices (2023)

**原理**: 同一形状 (ローソク足は全て同じ quad) を1回の draw call で N 個描画。per-instance data として OHLC + color を渡す。

```
現状 (Canvas2D):
  for (candle of visible) {
    ctx.fillRect(...)   // 1 draw call × N candles
    ctx.strokeRect(...) // + 1 draw call × N candles
  }
  計: ~2N draw calls

Instanced (WebGPU):
  1 quad geometry (4 vertices)
  + instance buffer [open, high, low, close, color] × N
  → 1 draw call で N candles
```

```wgsl
// candle_instanced.wgsl
struct CandleInstance {
  @location(1) ohlc: vec4<f32>,     // open, high, low, close
  @location(2) color: vec4<f32>,
  @location(3) xOffset: f32,
};

@vertex
fn vs_main(
  @location(0) localPos: vec2<f32>,  // unit quad [-0.5, 0.5]
  candle: CandleInstance
) -> @builtin(position) vec4<f32> {
  let bodyTop = max(candle.ohlc.x, candle.ohlc.w);    // max(open, close)
  let bodyBottom = min(candle.ohlc.x, candle.ohlc.w);  // min(open, close)
  let y = mix(bodyBottom, bodyTop, localPos.y + 0.5);
  let x = candle.xOffset + localPos.x * candleWidth;
  return uniforms.viewProj * vec4<f32>(x, y, 0.0, 1.0);
}
```

**Mochart 適用先**: Phase R5 (WebGPU統合)。WebGPU renderer で instanced draw を使用。10,000 本のローソク足を **1 draw call** で描画。

---

#### T4: LTTB ダウンサンプリング (Level of Detail)

**出典**: Sveinn Steinarsson, "Downsampling Time Series for Visual Representation" (University of Iceland, 2013)

**原理**: ズームアウト時、表示ピクセル幅あたり 1 candle 未満になる場合、視覚的に重要なポイントだけ残す。Largest-Triangle-Three-Buckets (LTTB) アルゴリズムで O(n) でダウンサンプリング。

```
10,000 bars, 800px plot width → 800 buckets
  各 bucket から「三角形面積最大」の点を選択
  → 800 points で元データとほぼ同じ形状を維持

チャート特化変形: Min-Max ダウンサンプリング
  各 bucket の high の max と low の min を保持
  → ローソク足の視覚的情報を損なわない
```

```typescript
// src/core/downsample.ts

/** Min-Max downsampling for OHLCV (chart-specific LTTB variant) */
function downsampleOHLCV(
  data: readonly OhlcvPoint[],
  targetBuckets: number
): OhlcvPoint[] {
  if (data.length <= targetBuckets) return data as OhlcvPoint[];
  const bucketSize = data.length / targetBuckets;
  const result: OhlcvPoint[] = [];

  for (let i = 0; i < targetBuckets; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(Math.floor((i + 1) * bucketSize), data.length);
    let high = -Infinity, low = Infinity;
    let open = data[start].open;
    let close = data[end - 1].close;
    let volume = 0;
    let time = data[start].time;

    for (let j = start; j < end; j++) {
      if (data[j].high > high) high = data[j].high;
      if (data[j].low < low) low = data[j].low;
      volume += data[j].volume;
    }
    result.push({ time, open, high, low, close, volume });
  }
  return result;
}
```

**Mochart 適用先**: Phase R4 (Streaming)。visibleCount > plotWidth のとき自動適用。100万本でも 60fps を維持。

---

#### T5: Dirty Rectangle Tracking (差分矩形描画)

**出典**: X Window System damage extension (2003), Qt Quick Scene Graph (2013), Chromium cc::DamageTracker

**原理**: フレーム間で変更された矩形領域だけを再描画する。金融チャートでは:
- pan: 左端に新 candle 出現、右端が消える → 差分は両端のみ
- tick 更新: 最新 candle 1本のみ変更 → 1本分の矩形だけ再描画

```typescript
// src/renderer/canvas/damageTracker.ts

type DamageRect = { x: number; y: number; w: number; h: number };

class DamageTracker {
  private prevSnapshot: RenderSnapshot | null = null;

  /** 前フレームとの差分矩形を計算 */
  computeDamage(current: RenderSnapshot): DamageRect[] {
    if (!this.prevSnapshot) return [/* full rect */];
    const prev = this.prevSnapshot;

    // viewport スクロール → 差分だけコピー + 新領域描画
    if (prev.viewport.visibleCount === current.viewport.visibleCount) {
      const delta = current.viewport.startIndex - prev.viewport.startIndex;
      if (Math.abs(delta) < current.viewport.visibleCount * 0.5) {
        // scrollBy & repaint edge
        return this.computeScrollDamage(delta, current);
      }
    }

    // データ変更 → 変更された candle の矩形だけ
    if (prev.viewport.startIndex === current.viewport.startIndex) {
      return this.computeDataDamage(prev, current);
    }

    return [/* full rect */];
  }
}
```

**Mochart 適用先**: Phase R3 (Renderer統一)。Canvas2D の `ctx.drawImage(self)` でスクロール高速化。

---

#### T6: GPU Compute Pre-pass

**出典**: "GPU-Driven Rendering Pipelines" (Wihlidal, SIGGRAPH 2015), Nanite (UE5, 2021)

**原理**: 描画前に GPU compute shader で以下を並列計算:
1. 可視範囲の price range (min/max)
2. インジケータ値
3. ローソク足の頂点バッファ生成

CPU → GPU の往復を 1回に削減。

```wgsl
// compute_prepass.wgsl
// Phase 1: parallel reduction で price range 算出
@compute @workgroup_size(256)
fn compute_price_range(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= uniforms.visibleCount) { return; }
  let bar = data[uniforms.startIndex + idx];
  atomicMin(&result.minPrice, bitcast<u32>(bar.low));
  atomicMax(&result.maxPrice, bitcast<u32>(bar.high));
}

// Phase 2: 頂点生成 (price range 確定後)
@compute @workgroup_size(256)
fn generate_vertices(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= uniforms.visibleCount) { return; }
  let bar = data[uniforms.startIndex + idx];
  let yScale = 2.0 / (result.maxPrice - result.minPrice);
  // ... 頂点を output buffer に書き込み
  vertices[idx * 6 + 0] = vec4(x, toY(bar.open), ...);
  // ...
}
```

**Mochart 適用先**: Phase R5 (WebGPU統合)。CPU-GPU 間のデータ転送を最小化。

---

### 9.2 データ・I/O 技法

#### T7: Columnar (SoA) データレイアウト

**出典**: Apache Arrow (2016), MonetDB Column-Store (Boncz et al., 2005), "Column-Stores vs. Row-Stores: How Different Are They Really?" (Abadi et al., SIGMOD 2008)

**原理**: OHLCV データを Array of Structures (AoS) ではなく Structure of Arrays (SoA) で格納。CPU キャッシュライン効率と SIMD 親和性が向上。

```
現状 (AoS - Array of Structures):
  [{time, open, high, low, close, volume}, {time, open, high, low, close, volume}, ...]
  → min(low) を求めるとき: 48 bytes ごとに 8 bytes だけ参照 → キャッシュ効率 17%

目標 (SoA - Structure of Arrays):
  times:   Float64Array [t0, t1, t2, ...]      ← 連続メモリ
  opens:   Float32Array [o0, o1, o2, ...]
  highs:   Float32Array [h0, h1, h2, ...]
  lows:    Float32Array [l0, l1, l2, ...]       ← min() は SIMD auto-vectorize
  closes:  Float32Array [l0, l1, l2, ...]
  volumes: Float32Array [v0, v1, v2, ...]
  → min(lows) を求めるとき: 連続 4 bytes × N → キャッシュ効率 100%
```

```typescript
// src/core/columnarStore.ts

class ColumnarOHLCV {
  readonly capacity: number;
  length: number = 0;

  // Single backing ArrayBuffer for cache locality
  private buffer: ArrayBuffer;
  readonly time: Float64Array;
  readonly open: Float32Array;
  readonly high: Float32Array;
  readonly low: Float32Array;
  readonly close: Float32Array;
  readonly volume: Float32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    // Single contiguous allocation
    const f64Bytes = capacity * 8;
    const f32Bytes = capacity * 4;
    this.buffer = new ArrayBuffer(f64Bytes + f32Bytes * 5);
    let offset = 0;
    this.time   = new Float64Array(this.buffer, offset, capacity); offset += f64Bytes;
    this.open   = new Float32Array(this.buffer, offset, capacity); offset += f32Bytes;
    this.high   = new Float32Array(this.buffer, offset, capacity); offset += f32Bytes;
    this.low    = new Float32Array(this.buffer, offset, capacity); offset += f32Bytes;
    this.close  = new Float32Array(this.buffer, offset, capacity); offset += f32Bytes;
    this.volume = new Float32Array(this.buffer, offset, capacity);
  }

  /** O(1) append. Amortized O(1) with growth. */
  push(bar: OhlcvPoint): void {
    if (this.length >= this.capacity) this.grow();
    const i = this.length++;
    this.time[i]   = bar.time;
    this.open[i]   = bar.open;
    this.high[i]   = bar.high;
    this.low[i]    = bar.low;
    this.close[i]  = bar.close;
    this.volume[i] = bar.volume;
  }

  /** Zero-copy visible window (subarray view) */
  sliceView(start: number, count: number) {
    return {
      time:   this.time.subarray(start, start + count),
      open:   this.open.subarray(start, start + count),
      high:   this.high.subarray(start, start + count),
      low:    this.low.subarray(start, start + count),
      close:  this.close.subarray(start, start + count),
      volume: this.volume.subarray(start, start + count),
      length: count,
    };
  }

  /** SIMD-friendly min/max (V8 auto-vectorizes tight loops on TypedArrays) */
  priceRange(start: number, count: number): { min: number; max: number } {
    const h = this.high;
    const l = this.low;
    const end = start + count;
    let min = l[start], max = h[start];
    for (let i = start + 1; i < end; i++) {
      if (l[i] < min) min = l[i];
      if (h[i] > max) max = h[i];
    }
    return { min, max };
  }

  /** GPU-ready: transfer backing buffer to WebGPU */
  toGPUBuffer(device: GPUDevice): GPUBuffer {
    const gpuBuf = device.createBuffer({
      size: this.buffer.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(gpuBuf, 0, this.buffer);
    return gpuBuf;
  }
}
```

**Mochart 適用先**: Phase R4 (Streaming)。全データパスを SoA に。

---

#### T8: Ring Buffer for Streaming Ticks

**出典**: LMAX Disruptor (2011), Linux kernel kfifo, Lock-Free Ring Buffer (Lamport, 1983)

**原理**: リアルタイム tick データを固定サイズの循環バッファで受信。ゼロアロケーション。GC プレッシャーなし。

```typescript
// src/core/ringBuffer.ts

class TickRingBuffer {
  private buffer: Float64Array;  // [time, price, volume, time, price, volume, ...]
  private head = 0;
  private tail = 0;
  readonly capacity: number;
  private static FIELDS = 3;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float64Array(capacity * TickRingBuffer.FIELDS);
  }

  /** O(1), zero allocation */
  push(time: number, price: number, volume: number): void {
    const idx = (this.head % this.capacity) * TickRingBuffer.FIELDS;
    this.buffer[idx]     = time;
    this.buffer[idx + 1] = price;
    this.buffer[idx + 2] = volume;
    this.head++;
    if (this.head - this.tail > this.capacity) {
      this.tail = this.head - this.capacity; // overwrite oldest
    }
  }

  /** Drain all pending ticks → update last candle or create new */
  drainInto(store: ColumnarOHLCV, barDurationMs: number): number {
    let count = 0;
    while (this.tail < this.head) {
      const idx = (this.tail % this.capacity) * TickRingBuffer.FIELDS;
      const time = this.buffer[idx];
      const price = this.buffer[idx + 1];
      const vol   = this.buffer[idx + 2];
      // aggregate into OHLCV bar
      store.updateOrAppendTick(time, price, vol, barDurationMs);
      this.tail++;
      count++;
    }
    return count;
  }
}
```

**Mochart 適用先**: Phase R4 (Streaming)。WebSocket 毎秒 100 tick でもゼロ GC。

---

#### T9: SharedArrayBuffer + Worker 間ゼロコピー

**出典**: TC39 SharedArrayBuffer proposal (2017), "Shared Memory and Atomics" (Hoare, 2019)

**原理**: メインスレッドと Worker 間でメモリを共有。postMessage の構造化クローンコスト = 0。

```
Main Thread                     Render Worker
───────────                     ─────────────
  SharedArrayBuffer ◄──────────► same memory
  (ColumnarOHLCV)                reads directly

  Atomics.store(control, 0, 1)   // "new data ready"
                                 Atomics.wait(control, 0, 0)
                                 // wakes up, reads shared data
                                 render(sharedData)
```

```typescript
// データ共有パターン
const sab = new SharedArrayBuffer(capacity * 28); // 28 bytes/bar
const columns = {
  time:   new Float64Array(sab, 0, capacity),
  open:   new Float32Array(sab, capacity * 8, capacity),
  // ... etc
  control: new Int32Array(sab, capacity * 28 - 4, 1), // signal flag
};

// Main thread: データ更新後
Atomics.store(columns.control, 0, frameId);
Atomics.notify(columns.control, 0);

// Worker: 待機 → 読み取り (コピーなし)
Atomics.wait(columns.control, 0, lastFrameId);
const data = columns; // 同じメモリを参照
```

**Mochart 適用先**: Phase R6 (Worker Rendering)。T2 (OffscreenCanvas) と組み合わせ。

**注意**: Cross-Origin Isolation (`COOP` + `COEP` ヘッダー) が必要。

---

#### T10: Predictive Prefetching (予測的先読み)

**出典**: "Prefetch-Aware Shared-Memory Management" (Chen et al., ASPLOS 2015), Chrome Speculation Rules API (2023)

**原理**: ユーザーのパン速度・方向から次に必要なデータを予測し、先にロードする。

```typescript
// src/core/prefetcher.ts

class DataPrefetcher {
  private velocityTracker = new VelocityTracker(5); // 直近5サンプル

  onPan(deltaBars: number): void {
    this.velocityTracker.record(deltaBars, performance.now());
    const velocity = this.velocityTracker.getVelocity(); // bars/ms
    const direction = Math.sign(velocity);
    const magnitude = Math.abs(velocity);

    if (magnitude > 0.5) { // bars/ms threshold
      // 2秒分の先読み
      const prefetchBars = Math.ceil(magnitude * 2000);
      const prefetchFrom = direction > 0
        ? this.currentEnd + 1
        : this.currentStart - prefetchBars;
      this.requestData(prefetchFrom, prefetchBars);
    }
  }

  private requestData(from: number, count: number): void {
    // 既にキャッシュにあれば skip
    if (this.cache.has(from, count)) return;
    // 非同期でフェッチ (backpressure: 同時リクエスト1本)
    this.fetchQueue.enqueue({ from, count });
  }
}
```

**Mochart 適用先**: Phase R4 (Streaming)。サーバー連携時のスクロール体験を改善。

---

#### T11: PointerEvent Coalesced Events (サブフレーム入力)

**出典**: W3C Pointer Events Level 2 spec, "Coalesced points" (2017), Chrome 58+

**原理**: ブラウザは 60fps で paint するが、ポインタイベントは 120-240Hz で発生。`getCoalescedEvents()` で中間ポイントを全て取得し、描画に反映。

```typescript
// src/core/embedApi.ts (改善)

const onPointerMove = (ev: PointerEvent) => {
  // 通常: 60fps → 1 event/frame
  // Coalesced: 120Hz input → 2 events/frame (全取得)
  const events = ev.getCoalescedEvents?.() ?? [ev];
  
  // ドラッグ中: 全ポイントの累積移動量を計算 (滑らかな pan)
  if (this.dragging) {
    let totalDeltaX = 0;
    for (const ce of events) {
      totalDeltaX += ce.movementX;
    }
    const deltaBars = -totalDeltaX / stepX;
    scheduler.enqueue({ type: 'PAN', deltaBars });
  }

  // hover 表示: 最新の位置だけ使用
  const latest = events[events.length - 1];
  scheduler.enqueue({ type: 'HOVER', x: latest.clientX, y: latest.clientY });
};
```

**Mochart 適用先**: Phase R2 (Scheduler)。高リフレッシュレートディスプレイでの pan 精度が向上。

---

#### T12: Backpressure for Real-time Feeds

**出典**: Reactive Streams spec (2014), TCP flow control (Jacobson, 1988), RxJS `sample()` operator

**原理**: データフィード速度 > 描画速度のとき、中間 tick を意図的にドロップし描画フレームレートを維持。

```typescript
// src/core/backpressure.ts

class FrameAlignedSampler {
  private latestBySeriesId = new Map<string, OhlcvPoint>();
  private rafId: number | null = null;

  /** Feed から呼ばれる — 蓄積のみ、描画しない */
  onTick(seriesId: string, bar: OhlcvPoint): void {
    this.latestBySeriesId.set(seriesId, bar);
    this.scheduleEmit();
  }

  private scheduleEmit(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      // 1フレームに1回だけ、最新値を emit
      for (const [id, bar] of this.latestBySeriesId) {
        this.scheduler.enqueue({ type: 'APPEND_BAR', seriesId: id, bar });
      }
      this.latestBySeriesId.clear();
    });
  }
}
```

**Mochart 適用先**: Phase R4 (Streaming)。暗号通貨のような高頻度 feed でフレーム落ちしない。

---

#### T13: Binary Wire Protocol (FlatBuffers)

**出典**: Google FlatBuffers (2014), "Zero-copy deserialization" (Cap'n Proto, Sandstorm 2013)

**原理**: WebSocket で受信するデータを JSON ではなく FlatBuffers にすることで、パース = 0、ゼロコピーアクセス。

```
JSON (現状):
  recv → TextDecoder → JSON.parse → Object allocation → GC
  1 tick ≈ 200 bytes, parse ≈ 5μs

FlatBuffers (目標):
  recv → ArrayBuffer → 直接 offset 読み → allocation = 0
  1 tick ≈ 32 bytes, access ≈ 0.1μs   (50x faster)
```

**Mochart 適用先**: Feed adapter 層のオプション。Phase R4。

---

#### T14: Time-Sliced Rendering (レンダリングの時分割)

**出典**: React Fiber Architecture (Acdlite et al., 2017), "Scheduling in React" (Dan Abramov, 2019)

**原理**: 大量のインジケータ計算や描画を小チャンクに分割し、ブラウザの入力処理に yield する。`requestIdleCallback` + deadline で制御。

```typescript
// src/core/timeSlice.ts

async function computeIndicatorsSliced(
  indicators: IndicatorInstance[],
  data: ColumnarOHLCV,
  deadline: () => boolean // true = まだ時間ある
): AsyncGenerator<IndicatorResult> {
  for (const ind of indicators) {
    if (!deadline()) {
      // 時間切れ → ブラウザに yield、次の idle で再開
      await yieldToMain();
    }
    yield computeOne(ind, data);
  }
}

function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if ('scheduler' in globalThis && 'yield' in (globalThis as any).scheduler) {
      // Scheduler.yield() (Chrome 115+)
      (globalThis as any).scheduler.yield().then(resolve);
    } else {
      // fallback: setTimeout(0) — ~4ms delay
      setTimeout(resolve, 0);
    }
  });
}
```

**Mochart 適用先**: Phase R4 (Streaming)。20個のインジケータ再計算中もスクロールが途切れない。

---

#### T15: WASM SIMD — CPU ベクトル演算のネイティブ活用

**出典**: WebAssembly SIMD proposal (W3C, 2021), "Relaxed SIMD" Phase 4 proposal (2023), Marat Dukhan, "XNNPACK: optimized floating-point neural network inference" (Google, 2019), Intel Intrinsics Guide (SSE/AVX/NEON mapping)

**背景**: Mochart は当初 TypeScript で「十分」という判断に基づき設計された。この判断は *表示本数 <10,000・インジケータ <5 個* のユースケースでは正しい。しかし以下のシナリオで TS は律速となる:

| シナリオ | データ量 | TS (scalar) | WASM SIMD (v128) | 加速比 |
|---------|---------|-------------|-------------------|--------|
| SMA-20 on 1M bars | 1,000,000 | ~12 ms | ~1.5 ms | **8×** |
| Bollinger Bands (SMA + stddev) | 1,000,000 | ~35 ms | ~4 ms | **8-9×** |
| Min/Max scan (price range) | 1,000,000 | ~3 ms | ~0.4 ms | **7×** |
| LTTB downsampling 1M→2000 | 1,000,000 | ~18 ms | ~3 ms | **6×** |
| 20 indicators simultaneous | 500,000 | ~120 ms (> 2 frames) | ~15 ms (< 1 frame) | **8×** |

※ 測定前提（目安）: Apple M2 Pro / Chrome 121 / Float32Array 入力 / warm cache / 単系列 / GC pause 除外。最終値は R5 でベンチ実測して更新する。

**原理**: WebAssembly SIMD は 128-bit ベクトルレジスタ (`v128`) を提供し、4つの `f32` または 2つの `f64` を1命令で同時処理する。V8 の auto-vectorization (TurboFan) は TypedArray の単純ループでは *たまに* 働くが、依存関係のある積算 (EMA, MACD) やブランチを含む処理 (RSI gain/loss) ではスカラーにフォールバックする。WASM SIMD は *確実に* ベクトル化される。

```
TS (V8 TurboFan):
  for (i=0; i<n; i++) sum += data[i]     → 自動ベクトル化されることもある
  for (i=0; i<n; i++) ema = ema*k + x*(1-k) → スカラーフォールバック (data dependency)

WASM SIMD:
  f32x4.add / f32x4.mul                   → 確実に4-wide ベクトル化
  f32x4.min / f32x4.max                   → min/max scan が4倍速
  Loop unroll + SIMD                       → ILP (命令レベル並列性) も活用
```

**実装言語の選択肢**:

| 選択肢 | 利点 | 欠点 | 推奨度 |
|--------|------|------|--------|
| **Rust + wasm-pack** | 最高性能、SIMD intrinsics 直接利用、安全性保証 | ビルドチェーン追加 | ⭐⭐⭐ |
| **AssemblyScript** | TS ライクな構文、学習コスト低 | SIMD サポートが不完全、最適化が弱い | ⭐⭐ |
| **C/Emscripten** | 性能はRustと同等 | メモリ安全性なし、DX が低い | ⭐ |
| **Zig** | SIMD がファーストクラス、Wasm 出力良好 | エコシステムが未成熟 | ⭐⭐ |

**推奨**: **Rust + wasm-bindgen** — `std::arch::wasm32` の SIMD intrinsics で精密制御。

```rust
// crates/mochart-wasm/src/indicators.rs

use std::arch::wasm32::*;
use wasm_bindgen::prelude::*;

/// SMA: sliding window with SIMD-accelerated output
#[wasm_bindgen]
pub fn sma_f32(close: &[f32], period: usize, out: &mut [f32]) {
    let n = close.len();
    assert!(n == out.len());

    // scalar warmup (period - 1 bars)
    let mut sum: f32 = 0.0;
    for i in 0..period.min(n) {
        sum += close[i];
        out[i] = f32::NAN; // warmup: NaN
    }
    if period <= n {
        out[period - 1] = sum / period as f32;
    }

    // main loop: sliding window
    let inv_p = 1.0 / period as f32;
    let mut i = period;
    while i + 3 < n {
        // unroll 4: sequential dependency but amortize loop overhead
        for j in 0..4 {
            sum += close[i + j] - close[i + j - period];
            out[i + j] = sum * inv_p;
        }
        i += 4;
    }
    while i < n {
        sum += close[i] - close[i - period];
        out[i] = sum * inv_p;
        i += 1;
    }
}

/// Min/Max scan: 4-wide SIMD reduction
#[wasm_bindgen]
pub fn min_max_f32(high: &[f32], low: &[f32]) -> Box<[f32]> {
    let n = high.len();
    let mut vmin = f32x4_splat(f32::INFINITY);
    let mut vmax = f32x4_splat(f32::NEG_INFINITY);

    let chunks = n / 4;
    for i in 0..chunks {
        unsafe {
            let h = v128_load(high.as_ptr().add(i * 4) as *const v128);
            let l = v128_load(low.as_ptr().add(i * 4) as *const v128);
            vmax = f32x4_max(vmax, h);
            vmin = f32x4_min(vmin, l);
        }
    }

    // horizontal reduce
    let min_val = f32x4_extract_lane::<0>(vmin)
        .min(f32x4_extract_lane::<1>(vmin))
        .min(f32x4_extract_lane::<2>(vmin))
        .min(f32x4_extract_lane::<3>(vmin));
    let max_val = f32x4_extract_lane::<0>(vmax)
        .max(f32x4_extract_lane::<1>(vmax))
        .max(f32x4_extract_lane::<2>(vmax))
        .max(f32x4_extract_lane::<3>(vmax));

    // scalar tail
    let (mut min_val, mut max_val) = (min_val, max_val);
    for i in (chunks * 4)..n {
        if low[i] < min_val { min_val = low[i]; }
        if high[i] > max_val { max_val = high[i]; }
    }

    Box::new([min_val, max_val])
}

/// Bollinger Bands: SIMD-accelerated variance pass
#[wasm_bindgen]
pub fn bollinger_f32(
    close: &[f32], period: usize, std_dev: f32,
    upper: &mut [f32], middle: &mut [f32], lower: &mut [f32],
) {
    sma_f32(close, period, middle);

    for i in (period - 1)..close.len() {
        let sma = middle[i];
        let splat_sma = f32x4_splat(sma);
        let mut var_acc = f32x4_splat(0.0);
        let start = i + 1 - period;

        let mut j = start;
        while j + 3 <= i {
            unsafe {
                let vals = v128_load(close.as_ptr().add(j) as *const v128);
                let diff = f32x4_sub(vals, splat_sma);
                var_acc = f32x4_add(var_acc, f32x4_mul(diff, diff));
            }
            j += 4;
        }
        let mut vs: f32 = f32x4_extract_lane::<0>(var_acc)
            + f32x4_extract_lane::<1>(var_acc)
            + f32x4_extract_lane::<2>(var_acc)
            + f32x4_extract_lane::<3>(var_acc);
        while j <= i {
            let d = close[j] - sma;
            vs += d * d;
            j += 1;
        }
        let std = (vs / period as f32).sqrt() * std_dev;
        upper[i] = sma + std;
        lower[i] = sma - std;
    }
}
```

**TypeScript 統合パターン** (Progressive Enhancement):

```typescript
// src/wasm/simdBridge.ts

interface SimdKernel {
  sma_f32(close: Float32Array, period: number, out: Float32Array): void;
  min_max_f32(high: Float32Array, low: Float32Array): Float32Array;
  bollinger_f32(
    close: Float32Array, period: number, stdDev: number,
    upper: Float32Array, middle: Float32Array, lower: Float32Array,
  ): void;
}

let wasmKernel: SimdKernel | null = null;

/** Lazy-load WASM module. Returns null if SIMD not supported. */
export async function loadSimdKernel(): Promise<SimdKernel | null> {
  if (wasmKernel) return wasmKernel;
  try {
    // Feature detection: WASM SIMD support
    const simdSupported = WebAssembly.validate(new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,       // v128 return type
      0x03, 0x02, 0x01, 0x00, 0x0a, 0x0a, 0x01,
      0x08, 0x00, 0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x0b,
    ]));
    if (!simdSupported) return null;

    // Dynamic import — .wasm is ~15KB gzipped
    const mod = await import(/* webpackChunkName: "simd" */ '../pkg/mochart_wasm');
    wasmKernel = mod;
    return wasmKernel;
  } catch {
    return null; // graceful fallback to TS
  }
}
```

```typescript
// インジケータ計算での利用例
// src/indicators/phase1.ts (改善後)

import { loadSimdKernel } from '../wasm/simdBridge';

calculate: async (data, { period }) => {
  const simd = await loadSimdKernel();
  if (simd && data.close instanceof Float32Array) {
    // WASM SIMD path: ~8× faster
    const out = new Float32Array(data.length);
    simd.sma_f32(data.close, period, out);
    return ok({ sma: out });
  }
  // TS fallback path (existing code)
  // ...
}
```

**API 互換注記**: 現行 `IndicatorDefinition.calculate` が同期契約の場合、段階導入は次の2案とする。
- **A案（推奨）**: `calculate` は同期のまま維持し、WASM は起動時プリロード（未ロード時は TS 経路）。
- **B案**: `calculateAsync` を新設し、既存同期 API は互換レイヤーとして残す。

R5 では A案で破壊的変更を回避し、R6 以降で `calculateAsync` への段階移行可否を再評価する。

**計算パイプライン分岐** (GPU / WASM SIMD / TS のフォールバック連鎖):

```
                                 ┌─ WebGPU Compute (T6)
                                 │  - 10M+ bars, 並列インジケータ
                                 │  - GPU がある環境
    IndicatorRequest ────────────┤
                                 ├─ WASM SIMD (T15)
                                 │  - 100K-10M bars
                                 │  - GPU 非対応 or Safari
                                 │
                                 └─ TypeScript (現行)
                                    - <100K bars
                                    - WASM 非対応 (古いブラウザ)
```

**ブラウザ対応状況** (2026年時点):

| ブラウザ | WASM SIMD | Relaxed SIMD |
|---------|-----------|-------------|
| Chrome 91+ | ✅ | ✅ (114+) |
| Firefox 89+ | ✅ | ✅ (122+) |
| Safari 16.4+ | ✅ | ❌ |
| Node.js 16+ | ✅ | ✅ (21+) |

**TS が十分なケース vs WASM SIMD が必要なケース**:

```
データ量  10K ──── 100K ──── 1M ──── 10M
          │        │         │       │
 TS (V8)  ◉ 十分   ◉ 十分    △ 限界   ✗ 遅い
 WASM     ─ 不要   ─ 不要    ◉ 有効   ◉ 必須
 GPU(T6)  ─ 不要   ─ 不要    ─ 不要   ◉ 必須

 判断基準: 1フレーム (16.6ms) 内に計算が収まるか
```

**Mochart 適用先**: Phase R5 (GPU+SIMD統合)。GPU Compute (T6) と相補的 — GPU 非対応環境での高速フォールバック、および Worker (T2) 内での SIMD 計算。

**WASM SIMD 実装対象カーネル** (優先度順):

| # | カーネル | 適用インジケータ | 期待加速 |
|---|---------|----------------|----------|
| K1 | `min_max_f32` | price range scan (全描画フレーム) | 7× |
| K2 | `sma_f32` | SMA, Volume MA, Bollinger 内部 | 8× |
| K3 | `ema_f32` | EMA, MACD (fast/slow/signal) | 6× |
| K4 | `bollinger_f32` | Bollinger Bands (SMA + stddev) | 8× |
| K5 | `rsi_f32` | RSI, MFI | 5× |
| K6 | `lttb_f32` | LTTB downsampling (T4) | 6× |
| K7 | `atr_f32` | ATR, Squeeze Momentum | 5× |

**ビルドチェーン統合**:

```
crates/
  mochart-wasm/
    Cargo.toml         # [lib] crate-type = ["cdylib"]
    src/
      lib.rs           # wasm-bindgen entry
      indicators.rs    # SMA, EMA, Bollinger, RSI, MACD, ATR
      scan.rs          # min/max, LTTB downsampling
      transform.rs     # coordinate mapping, pixel projection

package.json scripts:
  "build:wasm": "wasm-pack build crates/mochart-wasm --target web --out-dir ../../src/pkg"
  "build": "bun run build:wasm && bun build src/index.ts"
```

---

### 9.3 技法の適用マッピング

```
              R0    R1    R2    R3    R4    R5    R6(新)
              地     Store  Sched Render Stream 統合   Worker
              ─────────────────────────────────────────────
T1  LayerComp               ●     ◉                      
T2  OffCanvas                                       ◉     
T3  Instanced                            ◉               
T4  LTTB LOD                       ◉                      
T5  DirtyRect                ●     ◉                      
T6  GPU Pre                              ◉               
T7  Columnar                       ●     ◉               
T8  RingBuf                              ◉               
T9  SharedBuf                                       ◉     
T10 Prefetch                       ◉                      
T11 Coalesced        ◉                                    
T12 Backpres                             ◉               
T13 FlatBuf                              ○ (opt-in)       
T14 TimeSlice               ◉            ◉               
T15 WASM SIMD                      ●           ◉         

◉ = 主要フェーズ  ● = 部分的に適用  ○ = オプション
```

### 9.4 新設 Phase R6: Worker-based Rendering

上記 T2, T9 を統合した新フェーズ:

| # | タスク | 概要 |
|---|--------|------|
| R6-1 | OffscreenCanvas Worker 基盤 | `canvas.transferControlToOffscreen()` + Worker セットアップ |
| R6-2 | SharedArrayBuffer データ共有 | ColumnarOHLCV を SharedArrayBuffer ベースに |
| R6-3 | Atomics ベース同期 | `Atomics.notify/wait` でフレーム同期、postMessage 不要 |
| R6-4 | フォールバック | Safari / SharedArrayBuffer 非対応時は main-thread Canvas に自動フォールバック |
| R6-5 | `{ renderer: 'canvas-worker' }` オプション | オプトイン方式で有効化 |
| R6-6 | Geometry Worker 分離 | 頂点生成・min/max・LOD 前処理を Worker へ分離し、main thread は入力処理と描画提出に専念 |

**R6 デプロイ前提チェックリスト**:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- 依存する CDN/script/font が CORP/COEP を満たすこと
- 非対応環境で `renderer: 'auto'` が main-thread Canvas に確実フォールバックすること

---

### 9.5 更新後スケジュール

```
R0 (地ならし)         ███░░░░░░░░░░░░░  密結合の解消
R1 (Immutable Store)  ░░░███░░░░░░░░░░  Reducer パターン導入
R2 (Scheduler+Input)  ░░░░░░██░░░░░░░░  rAF batch + T11 coalesced events + T14 time-slice
R3 (Renderer統一)     ░░░░░░░░███░░░░░  Stateless + T1 layers + T4 LOD + T5 dirty rect
R4 (Streaming)        ░░░░░░░░░░░██░░░  T7 columnar + T8 ring + T10 prefetch + T12 backpressure
R5 (GPU+SIMD統合)     ░░░░░░░░░░░░░██░  T3 instanced + T6 compute + T15 WASM SIMD + MoChart統合
R6 (Worker)           ░░░░░░░░░░░░░░░█  T2 OffscreenCanvas + T9 SharedArrayBuffer (opt-in)
```

---

## 10. 参考文献・出典

### 描画・レンダリング

| ID | 技法 | 出典 |
|----|------|------|
| T1 | Multi-Layer Compositing | Chrome Compositor Architecture (2013); Flutter Impeller Engine (Google, 2022); Skia Graphite |
| T2 | OffscreenCanvas + Worker | W3C OffscreenCanvas spec (2018); Google "Off Main Thread" initiative (2019) |
| T3 | Instanced Drawing | GL_ARB_draw_instanced (OpenGL 3.3); WebGPU Best Practices (Google, 2023) |
| T4 | LTTB Downsampling | Steinarsson, "Downsampling Time Series for Visual Representation", MSc thesis, Univ. of Iceland (2013) |
| T5 | Dirty Rectangle Tracking | X.org Damage Extension (2003); DamageTracker in Chromium cc/ (2014); Qt Quick Scene Graph |
| T6 | GPU Compute Pre-pass | Wihlidal, "Optimizing the Graphics Pipeline with Compute", SIGGRAPH (2015); Nanite, UE5 (Epic, 2021) |
| T14 | Time-Sliced Rendering | Acdlite et al., "React Fiber Architecture" (2017); Abramov, "Scheduling in React" (2019); Scheduler.yield() proposal (Chrome 115+) |
| T15 | WASM SIMD | W3C WebAssembly SIMD proposal (2021); "Relaxed SIMD" Phase 4 (2023); Dukhan, "XNNPACK" (Google, 2019); Intel Intrinsics Guide; Rust `std::arch::wasm32` |

### データ・I/O

| ID | 技法 | 出典 |
|----|------|------|
| T7 | Columnar (SoA) Layout | Boncz et al., "MonetDB/X100: Hyper-Pipelining Query Execution", CIDR (2005); Abadi et al., "Column-Stores vs Row-Stores", SIGMOD (2008); Apache Arrow (2016) |
| T8 | Ring Buffer | Lamport, "Proving the Correctness of Multiprocess Programs", IEEE TSE (1977); LMAX Disruptor (2011); Linux kfifo |
| T9 | SharedArrayBuffer | TC39 SharedArrayBuffer spec (2017); Hoare, "Shared Memory and Atomics in JavaScript" (2019); COOP/COEP headers |
| T10 | Predictive Prefetch | Chen et al., "Prefetch-Aware Shared-Memory Management", ASPLOS (2015); Chrome Speculation Rules API (2023) |
| T11 | Coalesced Events | W3C Pointer Events Level 2, "getCoalescedEvents()" (2017); High-refresh-rate input handling |
| T12 | Backpressure | Reactive Streams spec (2014); Jacobson, "Congestion Avoidance and Control", SIGCOMM (1988); RxJS `sample()` |
| T13 | Binary Wire Protocol | Google FlatBuffers (2014); Sandstorm, "Cap'n Proto: Zero-copy serialization" (2013) |

### アーキテクチャ・状態管理

| パラダイム | 出典 |
|-----------|------|
| Immutable State + Reducer | Czaplicki, "Elm Architecture" (2012); Abramov, Redux (2015); Apple SwiftUI (2019) |
| Unidirectional Data Flow | Facebook Flux (2014); Vuex (2016) |
| Entity Component System | Unity DOTS ECS; Bevy ECS (Rust, 2020) |
| Command Buffer Pattern | Vulkan Command Buffers; WebGPU Command Encoder spec |
| Structural Sharing | Okasaki, "Purely Functional Data Structures" (1998); Immer.js (2017) |
| Zero-copy I/O | Axboe, io_uring (Linux 5.1, 2019); sendfile(2) |
