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

**成果物**:
- pinch の `zoomAt + panBy` → 1回描画 (現状2-3回)
- リアルタイム tick 10回/秒 + pan → 1回描画 (現状最大12回)
- `batch()` で初期化5操作 → 1回描画

---

### Phase R3: Renderer Stateless 化 & Interface 統一
> 目的: Renderer を純粋に描画だけの層にし、バックエンド切替可能に

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

**成果物**: `new CanvasRenderer(canvas)` → `createRenderer('canvas', canvas)` ファクトリ。renderer が state を持たない

---

### Phase R4: Streaming / Incremental Data
> 目的: 大量データ・リアルタイム更新を O(1) で処理

| # | タスク | 概要 |
|---|--------|------|
| R4-1 | Append-only DataStore | `pushBar(bar)` は配列末尾追加のみ。slice コピー廃止 |
| R4-2 | Incremental indicator | `IndicatorDefinition.update()` を活用し、新 bar 分だけ計算 |
| R4-3 | Visible window TypedArray view | `data.slice(start, end)` → `ArrayBuffer` の `subarray()` |
| R4-4 | GC プレッシャー削減 | drawSeries 内の Date/toLocaleString キャッシュ、object pool |

**成果物**: 10万本データでもリアルタイム追加が O(1)

---

### Phase R5: MoChart 統合 & クリーンアップ
> 目的: 二重系統を統一

| # | タスク | 概要 |
|---|--------|------|
| R5-1 | MoChart のインジケータ計算を Store 側に移設 | `computeIndicatorSegments` → Store の middleware 的に |
| R5-2 | MoChart のWebGPU描画を ChartRenderer 実装として統合 | WebGPURenderer が `render(snapshot)` を実装 |
| R5-3 | MoChart クラスを deprecated → createChart ファクトリに | 外部API は `createChart()` 一本に |
| R5-4 | 未使用コード削除 | ChartCore の旧 drawSeries 呼び出し等 |

---

## 4. 最終アーキテクチャ

```
User Code
─────────
  const chart = Mochart.createChart(container, { renderer: 'auto' })
  chart.addSeries('candle', { ... })
  chart.setData(ohlcv)
  chart.addIndicator('bb', { period: 20 })

Internal Flow
─────────────
  ┌─────────┐    Action    ┌───────────┐    dirty    ┌───────────┐
  │ Public   │ ──────────► │ ChartStore │ ─────────► │ Render    │
  │ API      │             │ (reducer)  │            │ Scheduler │
  │ (Handle) │ ◄────────── │            │            │ (rAF)     │
  └─────────┘  subscribe   └───────────┘            └─────┬─────┘
                                                          │
                    ┌─────────────────────────────────────┘
                    │  frozen RenderSnapshot
                    ▼
              ┌───────────┐
              │ Renderer  │  stateless
              │ (Canvas/  │  render(snapshot) → pixels
              │  WebGL2/  │  hitTest(x,y,snapshot) → result
              │  WebGPU)  │
              └───────────┘
```

### 依存関係ルール

```
Public API  →  ChartStore  →  (nothing)
Public API  →  RenderScheduler  →  ChartStore (read-only), Renderer
Renderer    →  (nothing. snapshot を受け取るだけ)
Indicators  →  DataStore (read-only)
```

**循環依存 = 0**。どの層も下の層だけに依存する。

---

## 5. 設計比較: Before / After

| 観点 | Before (現状) | After (目標) |
|------|--------------|-------------|
| **状態管理** | mutable fields scattered | Immutable store + pure reducer |
| **描画タイミング** | 即時・複数回/frame | rAF batch, 1回/frame |
| **リクエスト結合** | 各操作が独立に描画 | Action coalesce + batch() API |
| **データ更新** | 全量 slice コピー | append-only, zero-copy view |
| **リアルタイム tick** | 毎 tick drawSeries | coalesce: 同一 time は最終値のみ |
| **インジケータ更新** | O(n) full recalc | O(1) incremental update |
| **レイヤー結合** | API→Core→Renderer 透過 (as any) | strict interface boundary |
| **Renderer 切替** | 不可能 (concrete 直結) | Factory, runtime switchable |
| **テスタビリティ** | 困難 (DOM + mutable state) | reducer は pure func でユニットテスト可 |
| **Undo/Redo** | 不可能 | state history で可能 |
| **SSR 安全性** | DOM 依存が Core に混入 | Store は純粋 JS、DOM は API 層のみ |

---

## 6. 実行スケジュール

```
R0 (地ならし)         ███░░░░░░░░░░░  ~ 密結合の解消
R1 (Immutable Store)  ░░░███░░░░░░░░  ~ Reducer パターン導入
R2 (Render Scheduler) ░░░░░░██░░░░░░  ~ 描画パフォーマンス改善
R3 (Renderer統一)     ░░░░░░░░██░░░░  ~ Stateless renderer
R4 (Streaming)        ░░░░░░░░░░██░░  ~ 大量データ対応
R5 (統合)             ░░░░░░░░░░░░██  ~ MoChart + ChartCore 統合
```

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
