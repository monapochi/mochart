# 実験セッション結果サマリー & mochart-wasm-new 改良プラン

> **日付**: 2026-03-01  
> **ブランチ**: `experiment/talc-compression`  
> **対象クレート**: `crates/mochart-wasm-new` (4,080 行 Rust, WebGPU レンダラー + データストア)

---

## 1. セッション概要

ヒープスナップショット解析を起点に、現行 `wasm-bindgen` + `wee_alloc`（暗黙 system alloc）ベースの
WASM バイナリに対し、以下 3 軸で性能改善の余地を定量評価した。

| 軸 | 実験内容 | 状態 |
|----|----------|------|
| **Raw WASM (no-bindgen)** | `extern "C"` エクスポートのみの cdylib を手動 JS ブートストラップで測定 | ✅ 完了 |
| **カスタムアロケータ (bump)** | Bump allocator プロトタイプ (8 MiB 固定ヒープ) で alloc latency を測定 | ✅ 完了 |
| **カスタムアロケータ (talc)** | talc 4.4.3 (`no_std` + `lock_api`) で実 alloc/dealloc + ストレス測定 | ✅ 完了 |

---

## 2. 定量結果

### 2.1 バイナリサイズ

| ビルド | .wasm サイズ | 備考 |
|--------|-------------|------|
| **mochart-wasm-new (本番, wasm-bindgen)** | **166 KB** (170,387 bytes) | std + wasm-bindgen |
| wasm-bindgen JS グルー | 67 KB (68,903 bytes) | |
| minimal (system alloc) | 21,735 B (~21 KB) | std, release |
| minimal_bump (8 MiB bump) | 12,045 B (~12 KB) | std + custom bump |
| **minimal_talc** | **4,746 B (~4.7 KB)** | **no_std + talc 4.4.3 + opt-level=z + LTO** |

> 💡 wasm-bindgen のグルー JS だけで 67 KB。Raw WASM では不要。
> 💡 talc + no_std + LTO で **バイナリサイズ 78% 削減** (system alloc 比)。

### 2.2 起動時間（Module インスタンス化）

| 方式 | 測定環境 | 平均 |
|------|----------|------|
| **Raw WASM** (Module + Instance) | Node.js | **0.45 ms** |
| **Raw WASM** (10k init 付き) | Node.js | **0.10 ms** (instantiate) + **0.16 ms** (call) |
| **wasm-bindgen** import + `default()` | Headless Chromium | **8.4 ms** (import) + **12.3 ms** (init) |

> 💡 wasm-bindgen 経由は **約 46× 遅い**（20.7 ms vs 0.45 ms）。  
> JS グルーの動的 import と wasm-bindgen 初期化（テーブル生成、文字列デコード等）が支配的。

### 2.3 engine_init (10,000 bars) — 3-Way アロケータ比較

全バリアントを同一ワークロードに統一して再計測:
- **6 SoA channels** (time/open/high/low/close/volume) × `Vec<f32>` × 10,000 要素
- 合成データ充填 + チェックサム計算 + Drop（実 alloc/dealloc サイクル）

| バリアント | instantiate (ms) | engine_init call (ms) | 合計 (ms) |
|-----------|------------------|-----------------------|-----------|
| **minimal** (system alloc) | 0.102 | 0.255 | 0.357 |
| **minimal_bump** (8 MiB bump) | 0.136 | 0.229 | 0.365 |
| **minimal_talc** (talc 4.4.3) | **0.087** | **0.189** | **0.276** |

> talc は system alloc 比 **26% 高速**、bump 比 **17% 高速**（engine_init 単体）。
> インスタンス化も talc が最速（バイナリサイズ最小のため）。

### 2.4 Allocation Stress Bench (200 iterations, same instance, 10k bars)

同一インスタンスで `engine_init(10000)` を 200 回連続呼び出し。alloc+fill+dealloc の繰り返し耐性を検証。

| バリアント | Avg (ms) | p50 (ms) | p99 (ms) | Min (ms) | Max (ms) | Status |
|-----------|----------|----------|----------|----------|----------|--------|
| system alloc | 0.195 | 0.169 | 0.767 | 0.139 | 0.858 | ✅ 200/200 |
| bump | — | — | — | — | — | ❌ OOM crash (~33 calls) |
| **talc** | **0.186** | **0.157** | 0.792 | **0.138** | 0.873 | **✅ 200/200** |

- bump は dealloc no-op → 8 MiB arena が ~33 回 (240 KB/call × 33 ≈ 7.9 MB) で枯渇し `rust_oom` でクラッシュ
- talc は実 dealloc 対応で 200 回安定稼働（**5% 高速**, system alloc 比）
- p99 テイルレイテンシは両者同等（GC / OS スケジューリング等の外部要因）

### 2.5 ヒープ解析の知見

- Chrome DevTools スナップショットの大部分は **ブラウザ拡張由来の ExternalStringData** で水増しされていた。
- クリーンプロファイルで再取得すると約 **5 MB 削減**。
- WASM 本体のメモリ改善は、アロケータ戦略とデータ圧縮（Delta-Delta エンコーディング — store.rs で既に実装済み）の両面から攻める必要がある。

---

## 3. 主要な発見と改善機会

### 3.1 wasm-bindgen のオーバーヘッドは無視できない

| コスト項目 | サイズ/時間 |
|-----------|------------|
| JS グルーファイル | +67 KB |
| import + init 時間 | +20 ms |
| 文字列テーブル初期化 | init 時間に包含 |
| `#[wasm_bindgen]` 関数ごとのラッパー | 関数数に比例 |

**結論**: パフォーマンスクリティカルなデータパス（`ingest`, `compute_*`, `render`）は
`extern "C"` + 薄い JS ラッパーに移行し、wasm-bindgen は **利便性の高い初期化 API のみ**に限定すべき。

### 3.2 アロケータ最適化の余地

| アロケータ | 特性 | 適合シナリオ |
|-----------|------|-------------|
| System (default) | 汎用。free が可能 | 一般的な用途 |
| **Bump** | 超高速 alloc（ポインタ加算のみ）。個別 free 不可 | フレーム単位のスクラッチバッファ |
| **talc** | 汎用 + 高速。free 可能。WASM 対応 | 長寿命データ + 頻繁な割当/解放 |
| **wee_alloc** | 小バイナリ。低速で断片化しやすい | 非推奨（sunset 予定） |

**結論**: `OhlcvStore` のような長寿命データは talc、フレームごとの一時バッファは Bump の **二層アロケータ** が最適。

### 3.3 データ圧縮は既に基盤がある

`store.rs` の Delta-Delta エンコーディング + ブロックスナップショットは実装済み。
追加で **ビットパッキング** を導入すれば、1M bars の圧縮メモリを大幅に削減できる。

---

## 4. mochart-wasm-new 改良プラン

### Phase 1: Thin JS Wrapper + Hot Path の Raw 化（1-2 日）

**目標**: wasm-bindgen の起動オーバーヘッドを排除し、データパスを高速化する。

```
現在: JS → wasm-bindgen glue (67KB) → wasm exports
将来: JS → thin wrapper (< 2KB) → extern "C" exports
```

| タスク | 詳細 |
|--------|------|
| 1-1. `extern "C"` API レイヤー追加 | `store.rs` の ingest/view/compute を `#[no_mangle] pub extern "C" fn` で公開 |
| 1-2. 薄い JS ラッパー作成 | `WebAssembly.instantiateStreaming` + `memory.buffer` ビュー管理 |
| 1-3. `#[wasm_bindgen]` を段階的に削除 | まず data path のみ。renderer は Phase 2 で対応 |
| 1-4. ベンチ比較 | 起動時間・フレームレイテンシを現行 wasm-bindgen 版と比較 |

**期待効果**: 起動 -20 ms、グルー JS -67 KB、data ingest/compute のコールオーバーヘッド削減。

### Phase 2: 二層アロケータ導入（2-3 日）

**目標**: alloc/free パターンに最適なアロケータを使い分け、ピークメモリとフラグメンテーションを削減する。

| タスク | 詳細 |
|--------|------|
| 2-1. talc を `#[global_allocator]` に設定 | `Cargo.toml` に `talc = "4.4"` を追加。wee_alloc を除去 |
| 2-2. フレームスクラッチ用 Bump アリーナ追加 | `scratch_buf` を Bump アリーナで管理。フレーム終了で一括リセット |
| 2-3. `memory.grow` 計測 | カスタムフックで grow 回数を記録し、改善前後で比較 |
| 2-4. ストレステスト | 200 回連続 `engine_init` + `compute_sma` で alloc 特性を比較 |

**期待効果**: alloc latency -20〜40%、memory.grow 回数削減、フラグメンテーション低減。

### Phase 3: データ圧縮強化（3-5 日）

**目標**: Delta-Delta エンコーディングにビットパッキングを追加し、1M bars のメモリ使用量を半減する。

| タスク | 詳細 |
|--------|------|
| 3-1. ビットパッキング実装 | Delta 値の分布を分析し、可変長ビットパッキング（Simple-8b or Frame of Reference）を適用 |
| 3-2. SIMD デコードカーネル | `wasm32` SIMD intrinsics で view window 解凍を高速化 |
| 3-3. ブロックサイズチューニング | block_size を 256/512/1024/2048 で比較し最適値を決定 |
| 3-4. メモリ削減ベンチ | 1M bars での圧縮率と解凍レイテンシをトレードオフ評価 |

**期待効果**: 1M bars 基準で **圧縮メモリ 50%+ 削減**（現 ~24 MB → ~10-12 MB）。

### Phase 4: WebGPU レンダラー最適化（並行可能）

| タスク | 詳細 |
|--------|------|
| 4-1. GPU バッファ直接書き込み | `mappedAtCreation` + Bump アリーナから直接 memcpy |
| 4-2. ダブルバッファリング | front renders / back receives で stall を排除 |
| 4-3. Compute shader プリパス | visible range の min/max を GPU 側で計算（既存 sma_compute.rs を拡張） |

---

## 5. 優先度マトリクス

```
影響度 高 ┃ Phase 1 (Raw化)      Phase 3 (圧縮)
         ┃
         ┃ Phase 2 (Allocator)  Phase 4 (GPU最適化)
影響度 低 ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           工数 小                工数 大
```

**推奨実行順序**: Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1 は **最大の ROI**（工数 1-2 日で起動 -20 ms、バイナリ -67 KB）を持ち、
Phase 2〜3 の基盤にもなるため最優先。

---

## 6. 成功基準（再掲 + 定量目標）

| 指標 | 現状 | 目標 |
|------|------|------|
| .wasm + グルー合計 | 233 KB | **< 180 KB** (-23%) |
| 起動時間 (import + init) | ~21 ms | **< 2 ms** (-90%) |
| 1M bars ピークメモリ | ~24 MB (推定) | **< 15 MB** (-37%) |
| memory.grow 回数 (10k ingest) | 未測定 | ベースライン策定後 -30% |
| FPS (1M bars visible) | 60 fps (目標維持) | **≥ 60 fps** (劣化なし) |

---

## 7. リポジトリ成果物

このセッションで作成・更新されたファイル:

| ファイル | 内容 |
|----------|------|
| `experiments/raw-wasm/minimal/` | Raw WASM プロトタイプ (extern "C" exports) |
| `experiments/raw-wasm/minimal_bump/` | Bump アロケータプロトタイプ |
| `experiments/raw-wasm/minimal_talc/` | talc 4.4.3 アロケータプロトタイプ (no_std, ビルド+ベンチ完了) |
| `experiments/raw-wasm/bench_bindgen/` | wasm-bindgen ブラウザベンチ (Puppeteer) |
| `experiments/bench_pipeline/instantiate_bench.cjs` | Module+Instance ベンチ |
| `experiments/bench_pipeline/init_bench.cjs` | engine_init ベンチ (warm-up 付) |
| `experiments/bench_pipeline/alloc_stress_bench.cjs` | 連続割当ストレスベンチ |
| `experiments/results/*.json` | 全定量結果 |
| `experiments/results/bench_report.md` | ベンチレポート |
| `docs/EXPERIMENT_SESSION_RESULTS.md` | **本書** |

---

## 8. アーキテクチャレビュー（設計検討結果）

> **日付**: 2026-03-01（同セッション継続）  
> 実験結果を踏まえ、改良プラン (§4) に対する深掘り検討を実施。

### 8.1 Phase 1 (Raw 化) スコープの修正

**問題**: §4 Phase 1 の「`#[wasm_bindgen]` を段階的に削除」は **renderer.rs に対して実行不可能**。

定量根拠:

| 項目 | 数値 |
|------|------|
| `#[wasm_bindgen]` 合計 | 48 箇所 |
| うち renderer.rs | 33 箇所 (69%) |
| web_sys WebGPU 型の使用 | 36 種類 (GpuDevice, GpuBuffer, GpuRenderPipeline 等) |
| JS interop 参照行 (renderer.rs) | 240 行 |
| JsCast/dyn_into/unchecked_ref | 76 箇所 |
| WasmRenderer の Option\<JsValue\> フィールド | 28 個 |

renderer.rs は web_sys 経由で WebGPU API を直接操作しており、wasm-bindgen を除去するには
36 種類の WebGPU 型すべてに対して手動 FFI ラッパーを書く必要がある。
これは「wasm-bindgen の劣化版を再実装する」ことと等価で、**負の ROI**。

**修正方針**: Phase 1 のスコープを **store.rs + indicators.rs のデータパスのみ** に限定。
renderer.rs の wasm-bindgen は維持する。

### 8.2 wasm-bindgen WebGPU 依存の分析

WebGPU 操作から wasm-bindgen を排除する 3 つの代替案を検討:

| 案 | 概要 | 判定 |
|----|------|------|
| **A: Raw extern "C" + JS ラッパー** | 36 WebGPU 型に手動 FFI | ❌ wasm-bindgen の劣化再実装。負の ROI |
| **B: wgpu クレート** | Rust ネイティブ WebGPU 抽象化 | ❌ バイナリ 1 MB+ 増。50 KB バジェット超過 |
| **C: Architecture Inversion** | レンダラーを JS/TS 側に移し、Rust = データエンジンのみ | ✅ 正解だが R7 統合と同時期に実施すべき |

**結論**: 短期は wasm-bindgen + talc を維持。中長期（R7）でアーキテクチャ反転を実施。

### 8.3 ドキュメント誤りの指摘

- §4 Phase 2 タスク 2-1「wee_alloc を除去」→ **Cargo.toml に wee_alloc は存在しない**（暗黙の system alloc）。修正が必要。
- §2.2 の「約 46× 遅い」比較は Node.js vs Chromium (異環境比較) → 同一環境での再測定が必要。

### 8.4 推奨実行順序の変更

```
元の推奨:   Phase 1 → Phase 2 → Phase 3 → Phase 4
修正推奨:   Phase 2 (talc) → Phase 1 (data path 限定) → Phase 3 → Phase 4
```

**理由**: Phase 2 (talc 導入) は Cargo.toml 1 行 + アロケータ宣言のみで **即効果**（-26% alloc latency）。
Phase 1 は scope 再定義が必要なため先に Phase 2 を完了させる。

---

## 9. 定量パフォーマンスモデル

### 9.1 FFI オーバーヘッド（1 フレームあたり）

現行の `draw_candles_auto` ホットパス（renderer.rs L706-898）の FFI コスト:

```
現行アーキテクチャ (wasm-bindgen 経由):
  22 FFI round trips × ~120 ns/call ≈ 2.6 μs / frame

ハイブリッド Zero-Copy 案:
  ~3 FFI calls (prepare_frame + writeBuffer + submit) × ~15 ns ≈ 0.04 μs / frame

16.6 ms フレームバジェットに対して:
  現行: 0.016% → Zero-Copy: 0.0002%
  → いずれも無視できるレベル。FFI は真のボトルネックではない。
```

### 9.2 D-Cache ヒット率

```
200 visible bars (典型的な描画範囲):
  6 channels × 200 bars × 4 bytes = 4.8 KB → L1 キャッシュ (32-64 KB) に完全収容

SoA sequential access pattern:
  → ハードウェアプリフェッチャーが最適化
  → アーキテクチャ変更で D-Cache 挙動に差は出ない
```

### 9.3 実質的なメリット（アーキテクチャ反転時）

| 項目 | 現行 | 反転後 | 差分 |
|------|------|--------|------|
| 起動時間 | ~21 ms | ~1 ms | **-20 ms** (初回のみ) |
| バンドルサイズ | 233 KB | ~35 KB | **-198 KB** |
| per-frame 実行時間 | - | - | **差なし** (実質的に) |

→ **「毎フレームの速度」ではなく「起動とバンドル」が主な改善軸**。

---

## 10. ハイブリッド Zero-Copy FDB 設計

> wasm-bindgen を init/config に残しつつ、per-frame データパスを zero-copy 化する設計。

### 10.1 三層アーキテクチャ

```
┌─ Init Layer ─────────────────────────────────────────────┐
│  wasm-bindgen: new_renderer(), configure_pipeline(), …   │
│  実行タイミング: 起動時 1 回 + resize 時                   │
│  オーバーヘッド: 許容 (数 ms, 低頻度)                      │
└──────────────────────────────────────────────────────────┘

┌─ Data Layer (per-frame, zero-copy) ─────────────────────┐
│  Rust: prepare_frame() → FDB (64B) + SoA view ptrs      │
│  JS:   queue.writeBuffer(buf, off,                       │
│           wasm.memory.buffer, ptr, byteLen)               │
│  Float32Array 生成ゼロ。wasm linear memory を直接参照。   │
└──────────────────────────────────────────────────────────┘

┌─ Command Layer ─────────────────────────────────────────┐
│  wasm-bindgen: record_and_submit() (GPU コマンド記録)     │
│  BindGroup は dirty 時のみ再生成 (キャッシュ)             │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Frame Descriptor Buffer (FDB)

WASM linear memory 上に配置する 64 バイトの per-frame メタデータ構造体:

```rust
#[repr(C, align(8))]
pub struct FrameDescriptor {
    // SoA channel pointers (wasm linear memory offset)
    open_ptr:   u32,    // 0
    high_ptr:   u32,    // 4
    low_ptr:    u32,    // 8
    close_ptr:  u32,    // 12
    volume_ptr: u32,    // 16

    // View window metadata
    bar_count:  u32,    // 20
    price_min:  f32,    // 24
    price_max:  f32,    // 28

    // Candle metrics (CSS px)
    body_width: f32,    // 32
    bar_step:   f32,    // 36

    // Frame info
    frame_seq:  u32,    // 40  — monotonic sequence (double-write 検知)
    dirty_mask: u32,    // 44  — bit0: price, bit1: volume, bit2: indicators
    _pad:       [u32; 4], // 48-63 — 将来拡張用
}                       // total: 64 bytes
```

### 10.3 JS 側ホットパス（変更後のイメージ）

```javascript
// render_worker.js — per-frame hot path (変更後)

function renderFrame(store, renderer, fdbPtr) {
  // 1. Rust 側で decompress + FDB 更新
  store.prepare_frame(startBar, visBars, plotW, plotH);

  // 2. FDB を DataView で読み取り (zero-alloc, 64B のみ)
  const mem = wasm.memory.buffer;
  const dv = cachedDataView;  // 起動時に 1 回だけ生成
  const openPtr   = dv.getUint32(fdbPtr, true);
  const barCount  = dv.getUint32(fdbPtr + 20, true);
  const byteLen   = barCount * 4;

  // 3. queue.writeBuffer 5-arg form (zero Float32Array creation)
  device.queue.writeBuffer(openBuf,  0, mem, openPtr,  byteLen);
  device.queue.writeBuffer(highBuf,  0, mem, highPtr,  byteLen);
  device.queue.writeBuffer(lowBuf,   0, mem, lowPtr,   byteLen);
  device.queue.writeBuffer(closeBuf, 0, mem, closePtr, byteLen);

  // 4. BindGroup はキャッシュ済み (dirty 時のみ再生成)
  if (dirtyMask & 0x1) rebuildPriceBindGroup();

  // 5. GPU コマンド記録 + submit
  renderer.record_and_submit();
}
```

### 10.4 期待効果

| 指標 | 現行 | FDB 適用後 | 削減率 |
|------|------|-----------|--------|
| 一時 JS オブジェクト / frame | ~60-80 | ~20 | **-67%** |
| Float32Array 生成 / frame | 5-6 | 0 | **-100%** |
| BindGroup 再生成 / frame | 毎フレーム | dirty 時のみ | **-80%** (典型値) |
| GPU buffer upload 回数 | 変化なし | 変化なし | — |
| 実装工数 | — | ~3 日 | — |

---

## 11. 共有メモリ並列パイプライン設計 (Shared-Memory Parallel Pipeline)

> SharedArrayBuffer + WASM 共有メモリで追加メモリ ≈ 0 の 2-Worker パイプライン並列アーキテクチャ。

### 11.1 検討した 3 案

| 案 | 構成 | メモリ増 | 並列度 | 判定 |
|----|------|---------|--------|------|
| **A: 3-Worker 分割** | Data + Render + Indicator | +WASM×2 = +332 KB | 3 core | ❌ メモリ爆発 |
| **B: Parallel Pipeline (2-Worker + 共有 WASM Memory)** | Data Worker (WASM) + Render Worker (pure JS) | **≈ 0** | 2 core | **✅ 推奨** |
| **C: Single Worker Pipeline** | 1 Worker 内でフレームパイプライン | 0 | 1 core | △ 低リスク/低リワード |

### 11.2 Parallel Pipeline アーキテクチャ

```
┌─ Main Thread ──────────────────────────────────────────┐
│  chart_host.js (既存)                                    │
│  役割: DOM イベント → SAB ctrl → Atomics.notify          │
│  WASM: なし, Canvas: なし, GPU: なし                      │
└───────────┬──────────────────────────────────────────────┘
            │ SharedArrayBuffer (ctrl: 64B, 既存)
            ▼
┌─ Data Worker ──────────────────────────────────────────┐
│  WASM instance (OhlcvStore + indicators.rs)              │
│  WebAssembly.Memory({ shared: true, initial, maximum })  │
│                                                          │
│  役割:                                                    │
│    1. decompress_view_window (Delta-Delta → SoA f32)     │
│    2. compute_sma / compute_ema / compute_rsi            │
│    3. prepare_frame() → FDB 書き込み                      │
│    4. Atomics.notify(renderCtrl, FRAME_READY)            │
│                                                          │
│  出力: WASM linear memory 上の SoA + FDB (zero-copy)     │
└───────────┬──────────────────────────────────────────────┘
            │ SharedArrayBuffer (WASM memory, zero-copy)
            │ + Atomics (FRAME_READY / FRAME_CONSUMED)
            ▼
┌─ Render Worker ────────────────────────────────────────┐
│  JS + WebGPU (WASM なし)                                 │
│  OffscreenCanvas + WebGPU                                │
│                                                          │
│  役割:                                                    │
│    1. Atomics.waitAsync(FRAME_READY)                     │
│    2. DataView で FDB 読み取り (64B)                       │
│    3. queue.writeBuffer(buf, off, sharedMem, ptr, len)   │
│    4. GPU パイプライン管理 + Compute/Render Pass 発行     │
│    5. Atomics.store(FRAME_CONSUMED)                      │
│                                                          │
│  ※ 現行 renderer.rs (Rust/wasm-bindgen) の WebGPU        │
│    コマンドエンコーディングロジックを JS に移植する必要あり │
│  ※ §8.2 案C (Architecture Inversion) に相当する工数  │
│  WASM: なし → メモリ追加 0, 起動即座                      │
└────────────────────────────────────────────────────────┘
```

### 11.3 メモリバジェット

```
現行 (Single Worker):
  WASM Memory  : 2-4 MB (grow 後)
  JS heap      : ~2 MB
  GPU buffers  : ~1 MB
  SAB ctrl     : 64 B
  ─────────────────────
  合計          : ~5-7 MB

Parallel Pipeline (2-Worker):
  WASM Memory  : 2-4 MB (shared, 追加 0)
  Data Worker JS: ~0.5 MB
  Render Worker JS: ~1.5 MB (GPU command buffers)
  GPU buffers  : ~1 MB (変化なし)
  SAB ctrl     : 64 + 16 B = 80 B
  ─────────────────────────────
  合計          : ~5-7 MB (≈ 変化なし)
```

### 11.4 パイプライン並行性

```
現行 (逐次):
  Frame N:  [decompress 0.8ms][indicators 0.4ms][GPU upload 0.1ms][render 1.2ms]
            ├──────────── 2.5 ms ──────────────────────────────────────────────┤

Parallel Pipeline (2-Worker):
  Data Worker:  [decompress N+1][indicators N+1]  [decompress N+2]...
  Render Worker:              [upload N][render N]  [upload N+1][render N+1]
                              ├── 1.3 ms ──────┤

  フレームレイテンシ: 2.5 ms → 1.3 ms (Render Worker のみ)
  スループット: 変化なし (同じワーク量、ただし 2 コアで並列)
```

1M bars + 高負荷インジケーターで **-40〜50% フレームレイテンシ** を期待。
通常 200 bars では改善幅は小さい（元々 2.5 ms ≪ 16.6 ms）。

### 11.5 SharedArrayBuffer + WASM Shared Memory の要件

```
// Data Worker: WASM Memory を shared で生成
const memory = new WebAssembly.Memory({
  initial: 64,     // 4 MB
  maximum: 256,    // 16 MB
  shared: true,    // ★ 必須
});

// Render Worker: 同じ memory を postMessage で受け取り
// → new Float32Array(memory.buffer, ptr, len) で直接参照
// → queue.writeBuffer(buf, off, memory.buffer, ptr, byteLen) で GPU 転送
//
// ⚠️ writeBuffer + SharedArrayBuffer 互換性:
//   WebGPU 仕様の AllowSharedBufferSource の扱いはブラウザ実装依存。
//   Chrome 120+ では動作確認済みだが、Firefox/Safari では未検証。
//   非対応の場合は `new Uint8Array(sharedMem, ptr, len)` でコピーを挟む
//   フォールバックが必要。P1 実装時に全主要ブラウザで検証必須。

// COOP/COEP ヘッダ必須:
// Cross-Origin-Opener-Policy: same-origin
// Cross-Origin-Embedder-Policy: require-corp
```

### 11.6 Atomics プロトコル（Worker 間）

```
// 既存 SAB ctrl (chart_host ↔ render_worker): 16 slots × 4 bytes = 64 bytes
// 追加 SAB ctrl (data_worker ↔ render_worker): 4 slots × 4 bytes = 16 bytes

const FRAME_SEQ    = 0;  // Data Worker が monotonic increment
const FRAME_READY  = 1;  // Data Worker → Render Worker
const FRAME_ACK    = 2;  // Render Worker → Data Worker
const DATA_LOCK    = 3;  // SoA 書き込み中ロック (0=free, 1=writing)

// Data Worker:
Atomics.store(ctrl, DATA_LOCK, 1);   // SoA 書き込み開始
store.prepare_frame(...);             // decompress + FDB 更新
Atomics.store(ctrl, DATA_LOCK, 0);   // SoA 書き込み完了
Atomics.add(ctrl, FRAME_SEQ, 1);     // sequence increment
Atomics.store(ctrl, FRAME_READY, 1);
Atomics.notify(ctrl, FRAME_READY);

// Render Worker:
await Atomics.waitAsync(ctrl, FRAME_READY, 0).value;
while (Atomics.load(ctrl, DATA_LOCK) === 1) { /* spin */ }
// → FDB 読み取り + GPU upload + render
Atomics.store(ctrl, FRAME_READY, 0);
Atomics.store(ctrl, FRAME_ACK, 1);
Atomics.notify(ctrl, FRAME_ACK);
```

---

## 12. 改訂実装計画

元の Phase 1-4 (§4) を、レビュー結果に基づき以下のように再編:

### P0: Zero-Copy FDB 基盤 (§10 実装, ~3 日)

**前提**: 現行 Single Worker アーキテクチャ内で FDB を導入。Parallel Pipeline 分割の前段階。

| # | タスク | ファイル |
|---|--------|----------|
| 0-1 | Rust: `FrameDescriptor` 構造体 + `prepare_frame()` + `fdb_ptr()` 追加 | store.rs |
| 0-2 | Rust: `ensure_storage()` + `storage_buffer_handle()` 追加 | renderer.rs |
| 0-3 | Rust: `record_and_submit()` (GPU コマンドのみ、data upload なし) 追加 | renderer.rs |
| 0-4 | JS: render_worker.js ホットパスを FDB ベースに書き換え | render_worker.js |
| 0-5 | JS: BindGroup キャッシュ (dirty-flag ベース) | render_worker.js |
| 0-6 | ベンチ: 一時 JS オブジェクト数、フレームレイテンシ測定 | scripts/ |

**成功基準**: Float32Array 生成 0/frame, 一時オブジェクト < 25/frame

### P1: Parallel Pipeline 分割 (§11 実装, ~5 日)

**前提**: P0 完了後。FDB が Worker 間通信プロトコルになる。

| # | タスク | ファイル |
|---|--------|----------|
| 1-1 | WASM Memory を `shared: true` で生成 | data_worker.js (新規) |
| 1-2 | Data Worker: WASM init + decompress + indicator + FDB ループ | data_worker.js |
| 1-3 | Render Worker: WASM 依存除去、pure JS GPU ループ | render_worker.js (改修) |
| 1-4 | Atomics プロトコル実装 (§11.6) | shared_protocol.js (拡張) |
| 1-5 | chart_host.js: Worker 2 本の起動・接続管理 | chart_host.js (改修) |
| 1-6 | パイプラインベンチ: 1M bars でのフレームレイテンシ測定 | scripts/ |

**成功基準**: 1M bars フレームレイテンシ -40% (vs P0 Single Worker)

### P2: talc アロケータ導入 (§4 Phase 2 改訂, ~1 日)

> P0/P1 と並行可能。独立したタスク。

| # | タスク |
|---|--------|
| 2-1 | Cargo.toml に `talc = "4.4"` 追加 + `#[global_allocator]` 宣言 |
| 2-2 | ストレステスト再実行 (200 回連続 engine_init) |
| 2-3 | ベンチ比較 (system alloc vs talc, 本番ワークロード) |

**成功基準**: alloc latency -20% 以上、200/200 安定

### P3: Multi-Indicator パイプライン (将来, ~3 日)

> P1 完了後のオプション。Data Worker 内でインジケーターを並列計算。

| # | タスク |
|---|--------|
| 3-1 | インジケーター間の依存グラフ解析 |
| 3-2 | 独立インジケーターの並列実行 (Web Worker pool or wasm threads) |
| 3-3 | FDB 拡張: indicator dirty mask + ptr array |

---

## 13. 優先度マトリクス（改訂版）

```
影響度 高 ┃ P0 (FDB Zero-Copy)   P1 (Parallel Pipeline)
         ┃
         ┃ P2 (talc)            P3 (Multi-Indicator)
影響度 低 ┃
         ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           工数 小                工数 大
```

**推奨実行順序**: P2 (即効, 1 日) → P0 (3 日) → P1 (5 日) → P3 (オプション)

P2 は独立タスクのため P0 と並行して着手可能。

---

## 14. キャッシュ最適化メモリレイアウト設計

> §10 の FDB 設計を発展させ、WASM リニアメモリ上で
> **「頻繁に更新される SoA」と「低頻度の Descriptor」を物理的に分離**する。

### 14.1 現行設計の問題

現在の `OhlcvStore` は各チャネルを **独立した `Vec<f32>`** で管理している:

```rust
// store.rs — 現行
view_open:   Vec<f32>,  // ヒープ上のどこか
view_high:   Vec<f32>,  // ヒープ上の別の場所
view_low:    Vec<f32>,  // さらに別の場所
view_close:  Vec<f32>,  //  ...
view_volume: Vec<f32>,  //  ...
```

**問題点**:

| # | 問題 | 影響 |
|---|------|------|
| 1 | Vec が独立 → チャネル間にギャップ | GPU upload が 5 個の `writeBuffer` に分割される (5 DMA コマンド) |
| 2 | Vec realloc でアドレスが変わる | JS 側の ptr キャッシュが毎フレーム無効化リスク |
| 3 | FDB を追加しても Vec 群と同じヒープ領域 | FDB がキャッシュセット競合で SoA streaming write に evict される |
| 4 | `memory.grow()` 後のビュー再取得 | 全 ptr が一斉に無効化、リカバリが複雑 |

### 14.2 設計原則

```
原則 1: ホットデータ（SoA）は per-channel 連続配置 → 単一 DMA で GPU 転送
原則 2: FDB は SoA と異なるページに配置 → キャッシュセット競合を排除
原則 3: コールドデータ（圧縮列、ブロックスナップショット）は別領域 → ホットラインを汚染しない
原則 4: ダブルバッファ（Slot 0/1）は異なるページ範囲 → Worker 間 false sharing ゼロ
原則 5: アドレスは Arena 確保時に一度だけ決定 → Vec realloc と無関係
```

### 14.3 FrameArena — メモリマップ

```
WASM Linear Memory
──────────────────────────────────────────────────────────────────

     0x0000 ┌──────────────────────────────────────────────┐
            │ Rust Runtime                                 │
            │  stack, static data, talc heap metadata      │
            │  compressed columns (Vec<i32>), blocks,      │
            │  ingest buffers, scratch_buf                  │
            │  → talc #[global_allocator] が管理            │
            │  → render ホットパスでは触らない (Cold Zone)   │
     A      ├══════════════ 64 KB page boundary ═══════════┤
            │                                              │
            │  ╔══ Control Page (1 page = 64 KB) ════════╗ │
            │  ║                                          ║ │
            │  ║  +0x0000  ArenaHeader (64B)              ║ │  ← cache line 0
            │  ║    active_slot  : u32  (0 or 1)          ║ │
            │  ║    bar_capacity : u32                     ║ │
            │  ║    soa_stride   : u32  (bytes per ch)    ║ │
            │  ║    soa_channels : u32  (= 5)             ║ │
            │  ║    slot0_offset : u32  (from arena base) ║ │
            │  ║    slot1_offset : u32                     ║ │
            │  ║    ind0_offset  : u32                     ║ │
            │  ║    ind1_offset  : u32                     ║ │
            │  ║    frame_seq    : u32  (monotonic)        ║ │
            │  ║    _reserved    : [u32; 7]                ║ │
            │  ║                                          ║ │
            │  ║  +0x0040  FrameDescriptor[0] (64B)       ║ │  ← cache line 1
            │  ║    bar_count, price_min, price_max,       ║ │
            │  ║    body_width, bar_step, dirty_mask, …    ║ │
            │  ║                                          ║ │
            │  ║  +0x0080  FrameDescriptor[1] (64B)       ║ │  ← cache line 2
            │  ║    [同構造]                               ║ │
            │  ║                                          ║ │
            │  ║  +0x00C0  [padding → page end]           ║ │
            │  ║    ★ 残り 65,344B は未使用                ║ │
            │  ║    → 将来のメタデータ拡張用に予約          ║ │
            │  ╚══════════════════════════════════════════╝ │
            │                                              │
  A+64KB    ├══════════════ page boundary ═════════════════┤
            │                                              │
            │  ╔══ SoA Slot 0 (read by Render Worker) ═══╗ │
            │  ║                                          ║ │
            │  ║  open [0 .. cap)     cap × 4B            ║ │  ← streaming sequential read
            │  ║  high [0 .. cap)     cap × 4B            ║ │
            │  ║  low  [0 .. cap)     cap × 4B            ║ │
            │  ║  close[0 .. cap)     cap × 4B            ║ │
            │  ║  vol  [0 .. cap)     cap × 4B            ║ │
            │  ║                                          ║ │
            │  ║  Total: cap × 5 × 4 bytes                ║ │
            │  ║  pad to next page boundary               ║ │
            │  ╚══════════════════════════════════════════╝ │
            │                                              │
  A+64KB+S  ├══════════════ page boundary ═════════════════┤
            │                                              │
            │  ╔══ SoA Slot 1 (written by Data Worker) ══╗ │
            │  ║  [同構造: open|high|low|close|vol]       ║ │  ← streaming sequential write
            │  ╚══════════════════════════════════════════╝ │
            │                                              │
  A+64KB+2S ├══════════════ page boundary ═════════════════┤
            │                                              │
            │  ╔══ Indicator Slot 0 ═════════════════════╗ │
            │  ║  sma [0..cap)  ema [0..cap)  rsi[0..cap)║ │
            │  ╚══════════════════════════════════════════╝ │
            │                                              │
            │  ╔══ Indicator Slot 1 ═════════════════════╗ │
            │  ║  [同構造]                                ║ │
            │  ╚══════════════════════════════════════════╝ │
            │                                              │
            └──────────────────────────────────────────────┘

S = ceil(cap × 5 × 4, 65536)  // SoA slot size, page-aligned
```

### 14.4 キャッシュ動作の分析

**前提**: L1 D-cache = 64 KB, 64B line, 8-way set associative (128 sets)

```
Cache set index = (byte_address ÷ 64) mod 128  (bits [6:12])
```

**Control Page vs SoA Page のキャッシュセット干渉**:

```
ArenaHeader  (A + 0x0000) → set = (A÷64) mod 128         = S₀
FDB[0]       (A + 0x0040) → set = (A÷64 + 1) mod 128     = S₁
FDB[1]       (A + 0x0080) → set = (A÷64 + 2) mod 128     = S₂

SoA slot 0   (A + 0x10000) → set = (A÷64 + 1024) mod 128 = S₀  ← ArenaHeader と同セット
SoA[line 1]  (A + 0x10040) → set = S₁                           ← FDB[0] と同セット
SoA[line 2]  (A + 0x10080) → set = S₂                           ← FDB[1] と同セット
```

64 KB page offset は 128 sets の倍数 (1024 lines ÷ 8-way = 128) なので、
**同一オフセット位置は同じキャッシュセットにマップされる**。

ただし、8-way 連想度により:

```
200 visible bars (典型):
  5 ch × 200 bars × 4B = 4,000B = 62.5 cache lines
  → 62/128 = 48% のセットにしか触れない
  → FDB のセットに 1 本のみ conflict → 8-way で eviction なし ✅

2,000 visible bars:
  5 ch × 2,000 × 4B = 40,000B = 625 lines
  → 625/128 ≈ 4.9 lines/set 平均 → FDB のセットに ~5 conflict
  → 8-way で余裕 (8 - 5 = 3 ways 空き) ✅

10,000 visible bars:
  5 ch × 10,000 × 4B = 200 KB → L1 (64 KB) を超過
  → SoA は streaming access → prefetcher が L2 から供給
  → FDB は 1 line のみ → L1 に留まる (LRU で evict されにくい) ✅
```

**結論**: ページレベル分離で十分。FDB がホットラインから evict されるリスクは実質ゼロ。

### 14.4a WASM リニアメモリ 3 ゾーン設計

FrameArena の配置をさらに厳密に制御するため、WASM リニアメモリ全体を
**3 つのアドレスゾーン** に分割する。

```
WASM Linear Memory (grow 可能)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─── Low Address (Static) ─────────────────────────────────┐
│                                                          │
│  0x00000  Rust runtime (stack, static data)              │
│  0x10000  ★ FrameDescriptor × 2 slots (128B, 固定)       │
│  0x10080  Uniform データ (viewport params, 64B)           │
│  0x100C0  [reserved → page end]                          │
│                                                          │
│  特性: アドレス固定、JS 側でハードコード可能              │
│        FDB pointer = 0x10000 を定数として埋め込める       │
│        → get_fdb_ptr() 呼び出し不要                       │
│                                                          │
├─── Middle Address (Dynamic) ─────────────────────────────┤
│                                                          │
│  0x20000  SoA Slot 0: open|high|low|close|vol × cap     │
│  0x20000+S SoA Slot 1: [同構造]                          │
│  0x20000+2S Indicator Slot 0: sma|ema|rsi × cap         │
│  0x20000+2S+I Indicator Slot 1: [同構造]                 │
│                                                          │
│  特性: CPU キャッシュの主戦場                              │
│        streaming sequential access で prefetcher 最適化  │
│        ページ境界アラインで FDB とのセット競合を回避       │
│                                                          │
├─── High Address (Heap) ──────────────────────────────────┤
│                                                          │
│  talc managed heap →                                     │
│    圧縮列 (Vec<i32> × 6ch, Delta-Delta encoded)          │
│    ブロックスナップショット (Vec<i32>)                     │
│    一時計算バッファ (scratch_buf 等)                       │
│    ingest staging buffers                                │
│                                                          │
│  特性: 低頻度アクセス (ingest / viewport change 時のみ)   │
│        memory.grow() で拡張される領域                     │
│        SoA ホットパスのキャッシュラインを汚染しない        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**ゾーン分離の利点**:

| ゾーン | アクセス頻度 | キャッシュ特性 | Worker |
|--------|-------------|---------------|--------|
| Low (Static) | 1 回/frame (FDB 読み書き) | L1 常駐 (1-2 lines) | Data Worker: 書き / Render Worker: 読み |
| Middle (Dynamic) | N bars/frame (SoA streaming) | L1-L2 streaming | Data Worker: 書き / Render Worker: GPU upload |
| High (Heap) | ~0/frame (ingest 時のみ) | L2-L3 (コールド) | Data Worker のみ |

#### FDB ポインタ固定 — `link_section` アプローチ

Rust の `#[link_section]` または カスタムアロケータを用いて、
FDB を **WASM リニアメモリの固定アドレス (例: `0x10000`)** に配置する。

```rust
// アプローチ 1: link_section で static 変数として配置
//   → wasm-ld の --section-start オプションと組み合わせ
#[link_section = ".fdb"]
#[used]
static mut FDB_SLOTS: [FrameDescriptor; 2] = [FrameDescriptor::ZERO; 2];

// wasm-ld: --section-start=.fdb=0x10000
// → FDB_SLOTS は常に 0x10000 に配置される
```

```rust
// アプローチ 2: カスタム固定アドレスアロケータ
//   → WASM memory の特定ページを予約し、直接ポインタを返す
impl FrameArena {
    pub const FDB_BASE: usize = 0x10000;  // 固定

    pub fn fdb_ptr_const() -> *const FrameDescriptor {
        Self::FDB_BASE as *const FrameDescriptor
    }
}
```

**JS 側のメリット**:

```javascript
// 従来: 毎回 WASM 関数を呼んで FDB ポインタを取得
const fdbPtr = store.get_fdb_ptr();  // ← FFI overhead ~50 ns
const fdb = new DataView(memory.buffer, fdbPtr, 128);

// 新: FDB アドレスは定数 — WASM 呼び出しゼロ
const FDB_BASE = 0x10000;  // JS 側でハードコード (Rust と共有する定数)
const fdb = new DataView(memory.buffer, FDB_BASE, 128);
// → get_fdb_ptr() 呼び出しが完全に不要
// → JS 初期化コードがさらに削れる
```

**注意点**:
- `link_section` で WASM のセクション配置を制御するには `wasm-ld` のリンカオプションが必要
- **推奨: アプローチ 2 (定数ポインタ)** — 実装が簡潔で wasm-ld 依存がない。
  `link_section` はフォールバックとして保持するが、優先はしない。
- いずれの場合も、Rust と JS で **同一の定数値を共有** するプロトコルが必要
  (例: `shared_constants.js` を自動生成)

### 14.5 FrameArena — Rust 実装設計

```rust
use std::alloc::{alloc_zeroed, dealloc, Layout};

const PAGE: usize = 65536;           // WASM page = 64 KB
const CACHE_LINE: usize = 64;
const SOA_CHANNELS: usize = 5;       // open, high, low, close, volume
const INDICATOR_SLOTS: usize = 3;    // sma, ema, rsi

/// WASM リニアメモリ上のキャッシュ最適化フレームアリーナ。
///
/// 確保後はアドレスが固定 ── Vec realloc や memory.grow に影響されない。
/// JS 側は ArenaHeader から全オフセットを取得でき、per-frame の ptr 再取得が不要。
pub struct FrameArena {
    base: *mut u8,
    layout: Layout,
    bar_capacity: usize,
    soa_slot_bytes: usize,   // page-aligned slot size
    ind_slot_bytes: usize,
}

/// Page-aligned, cache-line-aligned arena header (64B).
/// JS が DataView 1 回で全オフセットを取得する。
#[repr(C, align(64))]
pub struct ArenaHeader {
    pub active_slot:   u32,   //  0: ping-pong index (0 or 1)
    pub bar_capacity:  u32,   //  4: max bars per slot
    pub soa_stride:    u32,   //  8: bytes per channel = cap × 4
    pub soa_channels:  u32,   // 12: = 5
    pub slot0_offset:  u32,   // 16: SoA slot 0 offset from arena base
    pub slot1_offset:  u32,   // 20: SoA slot 1 offset
    pub ind0_offset:   u32,   // 24: indicator slot 0 offset
    pub ind1_offset:   u32,   // 28: indicator slot 1 offset
    pub frame_seq:     u32,   // 32: monotonic sequence number
    pub _reserved:     [u32; 7], // 36-63: future use
}

/// Per-frame metadata (64B = 1 cache line).
/// Data Worker が書き込み、Render Worker が読み取る。
#[repr(C, align(64))]
pub struct FrameDescriptor {
    pub bar_count:   u32,     //  0: actual bars in this frame
    pub price_min:   f32,     //  4: padded min (for Y-axis scaling)
    pub price_max:   f32,     //  8: padded max
    pub body_width:  f32,     // 12: candle body width (CSS px)
    pub bar_step:    f32,     // 16: bar-to-bar step (CSS px)
    pub dirty_mask:  u32,     // 20: bit0=price, bit1=volume, bit2=indicators
    pub frame_seq:   u32,     // 24: matches ArenaHeader.frame_seq
    pub soa_byte_len: u32,    // 28: bar_count × SOA_CHANNELS × 4 (bulk upload size)
    pub _pad:        [u32; 8], // 32-63
}

impl FrameArena {
    /// bar_capacity 本分の SoA + インジケーター × ダブルバッファを確保。
    ///
    /// レイアウト:
    ///   [Control Page 64KB] [SoA Slot0 S bytes] [SoA Slot1 S bytes]
    ///   [Ind Slot0 I bytes] [Ind Slot1 I bytes]
    pub fn new(bar_capacity: usize) -> Self {
        let soa_raw   = bar_capacity * SOA_CHANNELS * 4;
        let soa_slot  = (soa_raw + PAGE - 1) & !(PAGE - 1);      // page-align
        let ind_raw   = bar_capacity * INDICATOR_SLOTS * 4;
        let ind_slot  = (ind_raw + PAGE - 1) & !(PAGE - 1);

        let total = PAGE                     // control page
                  + soa_slot * 2             // SoA double-buffer
                  + ind_slot * 2;            // indicator double-buffer

        let layout = Layout::from_size_align(total, PAGE)
            .expect("FrameArena layout");

        let base = unsafe { alloc_zeroed(layout) };
        assert!(!base.is_null(), "FrameArena alloc failed");

        let arena = Self {
            base,
            layout,
            bar_capacity,
            soa_slot_bytes: soa_slot,
            ind_slot_bytes: ind_slot,
        };

        // ArenaHeader を書き込む
        let header = arena.header_mut();
        header.active_slot  = 0;
        header.bar_capacity = bar_capacity as u32;
        header.soa_stride   = (bar_capacity * 4) as u32;
        header.soa_channels = SOA_CHANNELS as u32;
        header.slot0_offset = PAGE as u32;
        header.slot1_offset = (PAGE + soa_slot) as u32;
        header.ind0_offset  = (PAGE + soa_slot * 2) as u32;
        header.ind1_offset  = (PAGE + soa_slot * 2 + ind_slot) as u32;
        header.frame_seq    = 0;

        arena
    }

    // ── Accessors ──

    pub fn base_ptr(&self) -> *const u8 { self.base }

    fn header_mut(&self) -> &mut ArenaHeader {
        unsafe { &mut *(self.base as *mut ArenaHeader) }
    }

    pub fn header(&self) -> &ArenaHeader {
        unsafe { &*(self.base as *const ArenaHeader) }
    }

    /// active slot (Render Worker が読む側) の FDB
    pub fn fdb_front(&self) -> &FrameDescriptor {
        let slot = self.header().active_slot as usize;
        self.fdb(slot)
    }

    /// back slot (Data Worker が書く側) の FDB
    pub fn fdb_back_mut(&self) -> &mut FrameDescriptor {
        let slot = 1 - self.header().active_slot as usize;
        unsafe { &mut *(self.fdb_ptr(slot) as *mut FrameDescriptor) }
    }

    fn fdb(&self, slot: usize) -> &FrameDescriptor {
        unsafe { &*(self.fdb_ptr(slot) as *const FrameDescriptor) }
    }

    fn fdb_ptr(&self, slot: usize) -> *const u8 {
        unsafe { self.base.add(CACHE_LINE + slot * CACHE_LINE) }
    }

    /// back SoA slot の channel ポインタ (decompress 書き込み先)
    pub fn back_soa_channel_mut(&self, channel: usize) -> &mut [f32] {
        let slot = 1 - self.header().active_slot as usize;
        let offset = if slot == 0 {
            self.header().slot0_offset as usize
        } else {
            self.header().slot1_offset as usize
        };
        let ch_offset = offset + channel * self.bar_capacity * 4;
        unsafe {
            std::slice::from_raw_parts_mut(
                self.base.add(ch_offset) as *mut f32,
                self.bar_capacity,
            )
        }
    }

    /// Slot swap — Data Worker が decompress 完了後に呼ぶ。
    /// Atomics ストアと組み合わせて使用。
    pub fn swap_slots(&self) {
        let h = self.header_mut();
        h.active_slot = 1 - h.active_slot;
        h.frame_seq += 1;
    }
}

impl Drop for FrameArena {
    fn drop(&mut self) {
        unsafe { dealloc(self.base, self.layout); }
    }
}
```

### 14.6 単一 DMA 転送 — 5ch を 1 回で GPU へ

旧設計と新設計の比較:

```javascript
// ── 旧: 5× writeBuffer (renderer.rs L753-758) ──────────
// Float32Array 5 個生成 + 5 DMA コマンド
unsafe {
    let ov = Float32Array::view(store.view_open_ptr(),  len);  // tmp object #1
    let hv = Float32Array::view(store.view_high_ptr(),  len);  // tmp object #2
    let lv = Float32Array::view(store.view_low_ptr(),   len);  // tmp object #3
    let cv = Float32Array::view(store.view_close_ptr(), len);  // tmp object #4
    let vv = Float32Array::view(store.view_volume_ptr(),len);  // tmp object #5
    queue.write_buffer(sb, 0,         &ov);  // DMA #1
    queue.write_buffer(sb, stride,    &hv);  // DMA #2
    queue.write_buffer(sb, stride*2,  &lv);  // DMA #3
    queue.write_buffer(sb, stride*3,  &cv);  // DMA #4
    queue.write_buffer(sb, stride*4,  &vv);  // DMA #5
}

// ── 新: 1× writeBuffer (FrameArena 連続 SoA) ──────────
// JS 側で直接 memory.buffer を参照、Float32Array 生成ゼロ
const hdr = cachedHeaderView;   // DataView (起動時 1 回生成)
const activeSlot = hdr.getUint32(0, true);
const slotOffset = hdr.getUint32(activeSlot === 0 ? 16 : 20, true);
const fdb = cachedFdbView[activeSlot];  // DataView (起動時 2 個生成)
const barCount   = fdb.getUint32(0, true);
const soaByteLen = fdb.getUint32(28, true);  // barCount × 5 × 4

// ★ 単一 DMA: arena 内の連続 5ch を丸ごと GPU に転送
const arenaAbsPtr = arenaBasePtr + slotOffset;
device.queue.writeBuffer(storageBuf, 0,
    wasm.memory.buffer, arenaAbsPtr, soaByteLen);
```

**効果**:

| 項目 | 旧 (5× writeBuffer) | 新 (1× writeBuffer) |
|------|---------------------|---------------------|
| DMA コマンド数 | 5 | **1** |
| Float32Array 生成 | 5 / frame | **0** |
| GPU command encoder overhead | 5× dispatch | **1× dispatch** |
| CPU→GPU 転送帯域 | 同じ (データ量は同一) | 同じ |
| JS 一時オブジェクト | +5 | **+0** |

### 14.7 ダブルバッファと Worker 間 False Sharing 回避

```
                  Data Worker               Render Worker
                  ───────────               ─────────────
Frame N:         write → Slot 1 (back)     read ← Slot 0 (front)
                           │                       │
                           ▼                       ▼
                  Atomics.store(swap)       Atomics.waitAsync
                           │                       │
Frame N+1:       write → Slot 0 (back)     read ← Slot 1 (front)
```

**False sharing が起きない理由**:
- Slot 0 と Slot 1 は **異なるページ範囲** に配置されている
- あるフレーム中、Data Worker は back slot のみ書き込み、
  Render Worker は front slot のみ読み取り
- 同一キャッシュラインを同時に read/write する瞬間が存在しない
- swap は `ArenaHeader.active_slot` (4 bytes, Atomics 経由) のみ

### 14.8 メモリオーバーヘッド見積もり

```
bar_capacity = 4,096 (典型: visible 200-2000 + 余裕)

Control Page:             64 KB  (うち 192B 使用、残り予約)
SoA Slot × 2:   4096 × 5 × 4 × 2 =  160 KB  → page-align: 192 KB (3 pages × 2)
Ind Slot × 2:   4096 × 3 × 4 × 2 =   96 KB  → page-align: 128 KB (2 pages × 2)
────────────────────────────────────────────────
合計: 384 KB

現行 (Vec<f32> × 6ch + indicator + scratch, 4096 bars):
  6 × 4096 × 4 + 4096 × 4 + 4096 × 8 ≈ 146 KB (ダブルバッファなし)

差分: +238 KB (ダブルバッファ + ページアライメントパディング)
      → 全体メモリ (~5 MB) の 4.7% — 許容範囲
```

### 14.9 memory.grow() への耐性

```
問題: WebAssembly.Memory.grow() 後、既存の ArrayBuffer が detach される。

現行 Vec 方式:
  grow() → Vec 内部ポインタは有効 (WASM 視点) だが
  JS 側の Float32Array view は detach → 全 ptr を再取得する必要

FrameArena 方式:
  grow() → arena 自体は alloc 時に確保済み (grow で移動しない)
  JS 側は memory.buffer (ArrayBuffer) を再取得するだけで十分
  ArenaHeader 内のオフセットは不変 → ptr 再計算不要

  // JS recover after grow:
  const mem = wasm.memory.buffer;            // 新しい ArrayBuffer
  cachedHeaderView = new DataView(mem, arenaBasePtr, 64);
  cachedFdbView[0] = new DataView(mem, arenaBasePtr + 64, 64);
  cachedFdbView[1] = new DataView(mem, arenaBasePtr + 128, 64);
  // SoA オフセットは Header から読み直すだけ — 値は同じ
```

### 14.10 FrameDescriptor 改訂

§10.2 の FDB を FrameArena 対応に更新:

```rust
/// Per-frame metadata — 1 cache line (64B) に収まる。
/// Data Worker が back slot の FDB に書き込み、
/// swap 後に Render Worker が front slot の FDB を読む。
#[repr(C, align(64))]
pub struct FrameDescriptor {
    // View window info
    pub bar_count:     u32,    //  0: actual visible bars this frame
    pub price_min:     f32,    //  4: padded price min
    pub price_max:     f32,    //  8: padded price max

    // Candle metrics (CSS px)
    pub body_width:    f32,    // 12
    pub bar_step:      f32,    // 16

    // Frame control
    pub dirty_mask:    u32,    // 20: bit0=price, bit1=volume, bit2=indicators
    pub frame_seq:     u32,    // 24: monotonic (double-write detection)
    pub soa_byte_len:  u32,    // 28: bar_count × 5 × 4 (★ bulk upload size)

    // Indicator metadata
    pub ind_count:     u32,    // 32: active indicator count (0-3)
    pub ind_byte_len:  u32,    // 36: bar_count × ind_count × 4

    pub _pad:          [u32; 6], // 40-63: future use (alignment fill)
}                               // total: 64 bytes = 1 cache line
```

**§10.2 との差分**:
- `open_ptr` / `high_ptr` 等の個別ポインタを **削除** — Arena の連続レイアウトにより不要。
  JS は `ArenaHeader.slot_offset + channel × soa_stride` で算出。
- `soa_byte_len` を追加 — 単一 `writeBuffer` の第 5 引数に直接渡せる。
- `ind_count` / `ind_byte_len` を追加 — インジケーターも bulk upload 対応。

### 14.11 改訂パフォーマンス見積もり

| 指標 | §10 FDB 設計 | §14 Arena 設計 | 改善 |
|------|-------------|---------------|------|
| writeBuffer 呼び出し / frame | 5 (ch別) | **1** (bulk) | **-80%** |
| Float32Array 生成 / frame | 0 | 0 | — |
| 一時 JS オブジェクト / frame | ~20 | **~10** | **-50%** |
| Worker 間 false sharing | あり得る | **ゼロ** (保証) | — |
| memory.grow 後の復旧 | ptr 全再取得 | **DataView 3 個再生成** | 大幅簡素化 |
| 追加メモリ | ~0 | +238 KB | 許容 (4.7%) |
| GPU BindGroup 再生成 | dirty 時のみ | dirty 時のみ | — |
| 実装工数 | ~3 日 | ~4 日 (+1 日) | — |

---

## 15. 改訂実装計画 v2 (Arena ベース)

§12 の P0 を Arena 設計に更新:

### P0-v2: FrameArena + Zero-Copy Bulk Upload (~4 日)

| # | タスク | ファイル | 変更概要 |
|---|--------|----------|----------|
| 0-1 | `FrameArena` 構造体実装 | store.rs (新モジュール arena.rs 推奨) | alloc/drop, header/fdb accessors, slot swap |
| 0-2 | `OhlcvStore` に arena 統合 | store.rs | `decompress_view_window` の出力先を arena back slot に変更 |
| 0-3 | `prepare_frame()` 追加 | store.rs | decompress → minmax → FDB 書き込み → slot swap を一括実行 |
| 0-4 | `arena_base_ptr()` エクスポート | lib.rs | JS が ArenaHeader を読むための起点 |
| 0-5 | render_worker.js 改修 | render_worker.js | 5× writeBuffer → 1× bulk writeBuffer, DataView キャッシュ |
| 0-6 | renderer.rs: data upload 分離 | renderer.rs | `draw_candles_auto` から SoA upload を除去、`record_and_submit` に分割 |
| 0-7 | ベンチ: DMA 回数, JS オブジェクト数, フレームレイテンシ | scripts/ | — |

**成功基準**:
- writeBuffer 呼び出し: 5 → 1 / frame
- Float32Array 生成: 0 / frame
- 一時 JS オブジェクト < 15 / frame
- フレームレイテンシ劣化なし (regression gate)

### P1 への接続

FrameArena のダブルバッファ + `active_slot` swap は、
そのまま P1 (Parallel Pipeline) の Worker 間通信プロトコルになる:

```
P0 (Single Worker):   decompress → swap → read FDB → bulk upload → render
                      └──── 同一 Worker 内で逐次実行 ────────────────────┘

P1 (Parallel Pipeline): [Data Worker: decompress → swap → notify]
                                          ↓ Atomics
                      [Render Worker: read FDB → bulk upload → render]
                      └── 2 Worker でパイプライン並列 ──────────────────┘
```

P0 で Arena API を確定しておけば、P1 は Worker 分割 + Atomics 追加のみ。

---

## 16. 計算カーネル最適化 — SIMD / アンローリング / Prefix Sum

> **現状**: ホットパス (`decompress_view_window`, `indicators::sma/ema/rsi`,
> `view_price_min/max`, GPU `sma_compute.wgsl`) はすべて**素朴なスカラー逐次ループ**。
> WASM SIMD intrinsics、手動アンローリング、parallel prefix sum のいずれも未適用。

### 16.1 現状の確認

| コード | 現行実装 | 問題 |
|--------|----------|------|
| `decompress_view_window` (store.rs L296-328) | 6ch 逐次 Delta-Delta decode: `state_delta += dd[i]; state += state_delta` | **逐次依存チェーン** — SIMD 化不可（チャネル間は独立だがチャネル内は逐次） |
| `indicators::sma` (indicators.rs L17-42) | スカラー sliding window: `sum += in[i] - in[i-period]` | SIMD horizontal sum で **4-wide** 化可能 |
| `indicators::ema` (indicators.rs L57-82) | スカラー recurrence: `v = α·in + (1-α)·prev` | 逐次依存。ただし **4-unroll + ILP** で latency hiding 可能 |
| `view_price_min/max` (store.rs L483-510) | スカラー for ループ | `f32x4_min/max` reduction で **4× throughput** |
| `sma_compute.wgsl` (GPU) | per-thread ナイーブ `for j in [start..end]` sum | O(N×P) — workgroup prefix sum で O(N log P) |
| `minmax_compute.wgsl` (GPU) | per-thread `atomicMax/Min` | 機能的に正しいが atomic 競合大 — workgroup reduction で改善可 |

### 16.2 適用計画

#### S1: WASM SIMD — min/max reduction + SMA 4-wide (~1 日)

**対象**: `view_price_min/max`, `indicators::sma`

```rust
// ── view_price_min SIMD 版 ──
#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

pub fn view_price_min_simd(data: &[f32]) -> f32 {
    let n = data.len();
    let mut i = 0;
    let mut acc = f32x4_splat(f32::MAX);

    // メインループ: 4-wide SIMD reduction
    while i + 4 <= n {
        let v = v128_load(data[i..].as_ptr() as *const v128);
        acc = f32x4_min(acc, v);
        i += 4;
    }

    // Horizontal reduction: 4 lanes → scalar
    let mut min_val = f32::MAX;
    for lane in 0..4 {
        let v = f32x4_extract_lane::<{ lane }>(acc); // const generic
        if v < min_val { min_val = v; }
    }

    // テイル処理: 残り 0-3 要素
    while i < n {
        if data[i] < min_val { min_val = data[i]; }
        i += 1;
    }
    min_val
}
```

```rust
// ── SMA 4-wide sliding window ──
// 4 本の SMA を同時計算するのではなく、
// 入力を 4-wide で読み sum を SIMD accumulate。
// period 幅の sliding window を SIMD で rotate。

pub fn sma_simd(input: &[f32], period: usize, output: &mut [f32]) {
    // ウォームアップ: NaN fill (スカラー)
    let warmup = (period - 1).min(input.len());
    for o in output[..warmup].iter_mut() { *o = f32::NAN; }
    if input.len() < period { return; }

    // 初期ウィンドウ合計: SIMD reduction
    let mut sum = 0.0f32;
    let mut j = 0;
    while j + 4 <= period {
        let v = unsafe { v128_load(input[j..].as_ptr() as *const v128) };
        // horizontal add: f32x4 → scalar
        sum += f32x4_extract_lane::<0>(v) + f32x4_extract_lane::<1>(v)
             + f32x4_extract_lane::<2>(v) + f32x4_extract_lane::<3>(v);
        j += 4;
    }
    while j < period { sum += input[j]; j += 1; }
    let inv_p = 1.0 / period as f32;
    output[period - 1] = sum * inv_p;

    // スライディング: スカラー差分 (add/sub は逐次依存、SIMD 化の余地小)
    for i in period..input.len() {
        sum += input[i] - input[i - period];
        output[i] = sum * inv_p;
    }
}
```

**期待効果**: min/max **4× throughput**、SMA 初期ウィンドウ **4× throughput**、スライディング部は変化なし（逐次依存）。

#### S2: Delta-Delta デコード — チャネル分離 + 手動 4-unroll (~2 日)

**対象**: `decompress_view_window` (store.rs)

**問題の本質**: Delta-Delta は `state[i] = state[i-1] + delta[i]` — **チャネル内に逐次依存**があり、
1 チャネルを SIMD で並列化することは原理的に不可能（prefix sum が必要）。

**しかし**: 現行はオープン/ハイ/ロー/クローズ/ボリュームの **5 チャネルを 1 ループ内で interleave** している。
チャネル間は完全独立なので、**チャネルを分離**すれば CPU のスーパースカラーパイプラインが活用できる。

```rust
// ── 現行: 6ch interleaved (ILP 阻害) ──
for i in 0..safe_count {
    state_time_delta += self.time[idx];      // dep chain A
    state_time += state_time_delta;           // dep chain A
    state_open_delta += self.open[idx];       // dep chain B (独立だが interleave で ILP 低下)
    state_open += state_open_delta;           // dep chain B
    // ... × 6
    self.view_open[i] = dequantize(state_open);  // FP 変換 + store (dep chain B がブロック)
}

// ── 改善: チャネル分離 + 4-unroll ──
// OHLCV 5ch を個別ループに分離。各チャネルは独立した dep chain。
// CPU の OoO 実行で他チャネルの dep chain が flight 中の latency を hide。
// さらに 4-iteration アンロールで loop overhead を 1/4 に削減。

fn decode_channel_i32(
    encoded: &[i32], start: usize, count: usize,
    init_state: i32, init_delta: i32,
    output: &mut [f32], tick_size: f64, base_price: f64,
) {
    let mut state = init_state;
    let mut delta = init_delta;
    let mut i = 0;

    // ── 4-unroll main loop ──
    let end4 = count & !3;  // count を 4 の倍数に切り捨て
    while i < end4 {
        let idx0 = start + i;
        // 4 iterations unrolled — 各 iteration は前の state に依存するが、
        // dequantize (FP mul+add) の latency を次の integer add が hide する。
        delta += encoded[idx0];
        state += delta;
        output[i] = (state as f64 * tick_size + base_price) as f32;

        delta += encoded[idx0 + 1];
        state += delta;
        output[i + 1] = (state as f64 * tick_size + base_price) as f32;

        delta += encoded[idx0 + 2];
        state += delta;
        output[i + 2] = (state as f64 * tick_size + base_price) as f32;

        delta += encoded[idx0 + 3];
        state += delta;
        output[i + 3] = (state as f64 * tick_size + base_price) as f32;

        i += 4;
    }

    // ── テイル処理 ──
    while i < count {
        delta += encoded[start + i];
        state += delta;
        output[i] = (state as f64 * tick_size + base_price) as f32;
        i += 1;
    }
}

// decompress_view_window: 5ch を個別に呼び出し
// → 同一ループ内の register pressure が 12 変数 → 2 変数に低減
// → L1 icache footprint も縮小
decode_channel_i32(&self.open,  safe_start, safe_count,
                   state_open, state_open_delta,
                   &mut view_open, self.tick_size, self.base_price);
decode_channel_i32(&self.high,  safe_start, safe_count,
                   state_high, state_high_delta,
                   &mut view_high, self.tick_size, self.base_price);
// ... close, low, volume
```

**期待効果**:
- Register pressure: 12 state 変数 → 2 → **spill 排除**
- ILP: 4-unroll で integer add / FP mul の latency hiding → **1.5-2× throughput**
- L1 icache: ループ本体が ~1/3 に縮小

#### S3: GPU Prefix Sum SMA (~2 日)

**対象**: `sma_compute.wgsl`

現行は per-thread ナイーブ O(N × P) — `period=200` で 200 回ルー プ/thread。
**Hillis-Steele inclusive scan** (workgroup shared memory) で O(N log₂ P) に改善。

```wgsl
// ── sma_prefix_sum.wgsl — workgroup prefix sum + sliding window ──

var<workgroup> shared: array<f32, 256>;  // workgroup_size = 256

@compute @workgroup_size(256)
fn cs(@builtin(local_invocation_id) lid: vec3<u32>,
      @builtin(workgroup_id)        wid: vec3<u32>) {

    let global_idx = wid.x * 256u + lid.x;
    if global_idx >= p.visible_count + p.period - 1u { return; }

    // Step 1: Load close values into shared memory
    let data_idx = p.start_index + global_idx;
    shared[lid.x] = ohlcv[p.close_offset + data_idx];
    workgroupBarrier();

    // Step 2: Hillis-Steele inclusive prefix sum (in-place)
    // O(N log N) work, O(log N) depth — fits in shared memory
    for (var stride = 1u; stride < 256u; stride = stride << 1u) {
        let val = select(0.0, shared[lid.x - stride], lid.x >= stride);
        workgroupBarrier();
        shared[lid.x] += val;
        workgroupBarrier();
    }

    // Step 3: SMA = (prefix[i] - prefix[i - period]) / period
    // (workgroup 内で period 幅のスライド差分)
    let output_idx = global_idx;
    if output_idx < p.period - 1u {
        out[output_idx] = 0.0;  // warmup: NaN or 0
        return;
    }
    let prefix_end   = shared[lid.x];
    let prefix_start = select(0.0, shared[lid.x - p.period], lid.x >= p.period);
    out[output_idx - p.period + 1u] = (prefix_end - prefix_start) / f32(p.period);
}
```

**期待効果**: period=200 のとき **計算量 200×N → 8×N (log₂ 256 = 8)**、~25× スループット改善。

> ⚠️ workgroup 境界をまたぐ prefix sum は multi-pass (grid-level scan) が必要。
> visible bars < 10,000 では single workgroup × 複数 dispatch で十分。
> 1M bars visible は LTTB ダウンサンプル後なので workgroup 内に収まる。

#### S4: GPU Workgroup Reduction min/max (~0.5 日)

**対象**: `minmax_compute.wgsl`

現行は per-thread `atomicMax/Min` — 全スレッドが 1 つの atomic に競合。
**Workgroup reduction** (shared memory tree reduction) で atomic を workgroup あたり 1 回に削減。

```wgsl
var<workgroup> sh_max: array<u32, 64>;
var<workgroup> sh_min: array<u32, 64>;

@compute @workgroup_size(64)
fn cs(@builtin(local_invocation_id) lid: vec3<u32>,
      @builtin(global_invocation_id) gid: vec3<u32>) {

    // Load
    let i = gid.x;
    if i < p.visible_count {
        sh_max[lid.x] = bitcast<u32>(ohlcv[p.total_len + i]);
        sh_min[lid.x] = bitcast<u32>(ohlcv[p.total_len * 2u + i]);
    } else {
        sh_max[lid.x] = 0u;
        sh_min[lid.x] = 0x7F7FFFFFu;
    }
    workgroupBarrier();

    // Tree reduction (log₂ 64 = 6 steps)
    for (var s = 32u; s > 0u; s = s >> 1u) {
        if lid.x < s {
            sh_max[lid.x] = max(sh_max[lid.x], sh_max[lid.x + s]);
            sh_min[lid.x] = min(sh_min[lid.x], sh_min[lid.x + s]);
        }
        workgroupBarrier();
    }

    // Only thread 0 writes to global atomic — 1 atomic op per workgroup
    if lid.x == 0u {
        atomicMax(&mm[0], sh_max[0]);
        atomicMin(&mm[1], sh_min[0]);
    }
}
```

**期待効果**: atomic 競合 N/64 → **N/64² (workgroups)**、10,000 bars で atomic ops 10,000 → ~3。

### 16.3 ビルド設定の修正

WASM SIMD を Rust 側で有効にするための設定:

```toml
# crates/mochart-wasm-new/.cargo/config.toml (新規作成)
[target.wasm32-unknown-unknown]
rustflags = ["-C", "target-feature=+simd128"]
```

```bash
# scripts/build_wasm.sh — 変更なし（既に --enable-simd あり）
wasm-opt "${OUT_DIR}/mochart_wasm_bg.wasm" -Oz --enable-simd -o ...
```

> `+simd128` により LLVM が `std::arch::wasm32::*` intrinsics を
> WASM SIMD 命令 (`v128.load`, `f32x4.min` 等) にコンパイルする。

### 16.4 実装優先度と効果見積もり

| Phase | 対象 | 技法 | 計算量改善 | 実測期待 | 工数 |
|-------|------|------|-----------|---------|------|
| **S1** | min/max, SMA 初期窓 | WASM SIMD f32x4 | O(N) → O(N/4) | **3-4× throughput** | 1 日 |
| **S2** | decompress_view_window | チャネル分離 + 4-unroll | O(N) → O(N) (定数改善) | **1.5-2× throughput** | 2 日 |
| **S3** | GPU SMA | prefix sum (Hillis-Steele) | O(N×P) → O(N log P) | **10-25× throughput** (|P|=200) | 2 日 |
| **S4** | GPU minmax | workgroup reduction | O(N) atomics → O(N/64) | **atomic 競合 -98%** | 0.5 日 |

**推奨順序**: S1 (即効, SIMD flag + 2 関数) → S4 (GPU, 半日) → S2 (decompress, 本丸) → S3 (GPU SMA, prefix sum)

### 16.5 改訂全体スケジュール (v3)

```
        Week 1              Week 2              Week 3
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ P2: talc (1d)│   │ P0-v2: Arena │   │ P1: Parallel │
  │ S1: SIMD (1d)│   │  (4d, cont.  │   │  Pipeline(5d)│
  │ S4: GPU  (.5)│   │   from W1)   │   │              │
  │ P0-v2: Arena │   │ S2: unroll   │   │ S3: GPU SMA  │
  │  (start, 4d) │   │  (2d)        │   │  prefix (2d) │
  └──────────────┘   └──────────────┘   └──────────────┘

合計: ~18 日 (3 週間)
  P2 (1d) + S1 (1d) + S4 (0.5d) + P0-v2 (4d) + S2 (2d)
  + P1 (5d) + S3 (2d) + バッファ (2.5d)
```

### 16.6 成功基準（全体改訂）

| 指標 | 現状 | §14 Arena のみ | + §16 全 S phases | 改善率 |
|------|------|---------------|-------------------|--------|
| writeBuffer / frame | 5 | 1 | 1 | -80% |
| Float32Array / frame | 5 | 0 | 0 | -100% |
| decompress (200 bars, CPU) | ~0.8 ms (*) | ~0.8 ms | **~0.4 ms** (S2) | -50% |
| min/max scan (200 bars, CPU) | ~0.02 ms | ~0.02 ms | **~0.005 ms** (S1) | -75% |
| GPU SMA (200 bars, P=200) | ~0.5 ms (*) | ~0.5 ms | **~0.02 ms** (S3) | -96% |
| GPU minmax atomics | N ops | N ops | **N/64 ops** (S4) | -98% |
| alloc latency | baseline | baseline | **-26%** (P2 talc) | -26% |
| 1M bars フレームレイテンシ | ~2.5 ms | ~2.0 ms | **~1.0 ms** (P1+S*) | -60% |

(*) 推定値 — P0 ベンチで正確なベースラインを測定

---

## 17. GPU Compute 全面活用 — VRAM-Resident パイプライン設計

> 現行の per-frame パイプラインは **CPU decompress → CPU upload → GPU render** の
> 3 段構成で、CPU↔GPU 間のデータ往復が最大のボトルネック。
> Compute Shader を全面活用し、可能な限り **VRAM 内で完結** させる設計を検討する。

### 17.1 現行パイプライン — CPU 依存度の棚卸し

```
render_worker.js per-frame パイプライン:

  ① store.decompress_view_window(start, vis)     ← CPU (WASM): Delta-Delta decode
  ② store.view_price_min() / view_price_max()    ← CPU (WASM): sequential scan
  ③ renderer.draw_candles_auto(store, ...)        ← CPU→GPU: 5× writeBuffer upload
     ├─ GPU compute: minmax (atomic)
     └─ GPU render:  instanced candles
  ④ renderer.draw_sma_line(store, period, ...)    ← CPU→GPU: close upload + lookback
     ├─ GPU compute: SMA (per-thread naive)
     └─ GPU render:  thick line overlay
  ⑤ renderer.draw_volume_profile_heatmap(...)     ← GPU compute: atomic histogram
     └─ GPU render:  heatmap bars
  ⑥ renderer.present_frame()                     ← GPU render: FXAA/FSR post-pass
```

| ステップ | どこで | 何をしている | GPU 移行可能？ |
|----------|--------|-------------|---------------|
| ① decompress | CPU (WASM) | Delta-Delta decode → SoA f32 | ✅ → G1 |
| ② min/max | CPU (WASM) | sequential scan → scalar | ✅ (既に GPU で再計算) → 削除可能 |
| ③ upload | CPU → GPU | 5× writeBuffer (4.8 KB typical) | ✅ → G1 で不要に |
| ④ SMA lookback upload | CPU → GPU | close channel + pre-history | ✅ → G2 で不要に |
| ④ SMA compute | GPU | per-thread naive O(N×P) | ✅ → S3 prefix sum |
| ⑤ volume profile | GPU | atomic histogram | ✅ (既に GPU) |
| ⑥ post-process | GPU | FXAA/FSR | ✅ (既に GPU) |

**結論**: ①②③ を GPU compute に移行すれば、**per-frame の CPU→GPU 転送がゼロ**になる。

### 17.2 GPU-Resident パイプライン (目標状態)

```
┌─ CPU (初期化・低頻度, フレーム外) ──────────────────────────────┐
│                                                                  │
│  ingest():  binary fetch → SoA f32 write → GPUBuffer upload     │
│             (圧縮データ全体を VRAM に常駐 ── 1 回のみ)           │
│                                                                  │
│  viewport change: startBar, visBars を uniform に書き込み        │
│             (16B writeBuffer, 1 回/viewport change)              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ GPU per-frame (全 compute + render, CPU→GPU 転送ゼロ) ────────┐
│                                                                  │
│  Pass 1: decompress compute                                     │
│    圧縮 i32 列 (VRAM) → SoA f32 view window (VRAM)             │
│    Delta-Delta decode を GPU parallel prefix sum で実行          │
│                                                                  │
│  Pass 2: minmax compute                                         │
│    SoA high/low (VRAM) → min/max (VRAM)                         │
│    workgroup tree reduction (既存改良 S4)                        │
│                                                                  │
│  Pass 3: SMA/EMA/RSI compute                                   │
│    SoA close (VRAM) → indicator arrays (VRAM)                   │
│    prefix sum SMA (S3) + parallel EMA + parallel RSI            │
│                                                                  │
│  Pass 4: volume profile compute                                 │
│    SoA close+volume (VRAM) → histogram bins (VRAM)              │
│    (既存、変更なし)                                              │
│                                                                  │
│  Pass 5: render (single command buffer)                         │
│    candles instanced + indicator overlays + VP heatmap           │
│    FXAA/FSR post-pass → swapchain present                       │
│                                                                  │
│  全パス: single queue.submit() — ゼロ CPU readback              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 17.3 新規 Compute Shader 設計

#### G1: Delta-Delta Decode on GPU (最重要)

**これが compute shader 全面活用の鍵**。
Delta-Delta decode は 2 段の prefix sum: `delta[i] = Σdd[0..i]`, `value[i] = Σdelta[0..i]`。

```
DD (delta-of-delta):  [3, -1,  2,  0, -2,  1, ...]   ← VRAM に常駐
                         ↓ prefix sum #1
Delta:                [3,  2,  4,  4,  2,  3, ...]
                         ↓ prefix sum #2
Value (quantized):    [3,  5,  9, 13, 15, 18, ...]
                         ↓ dequantize (parallel, embarrassingly)
Price (f32):          [100.03, 100.05, 100.09, ...]
```

**Blelloch scan (work-efficient parallel prefix sum)**:

```wgsl
// decompress_compute.wgsl — 2-pass Blelloch scan + dequantize

struct Params {
    start_index:    u32,   // global index into compressed buffer
    visible_count:  u32,   // bars to decompress
    block_snapshot: u32,   // index into snapshot buffer
    tick_size:      f32,   // dequantization scale
    base_price:     f32,   // dequantization offset
    _pad:           vec3<u32>,
}

@group(0) @binding(0) var<storage, read>       dd_encoded : array<i32>;  // Delta-Delta i32
@group(0) @binding(1) var<storage, read>       snapshots  : array<i32>;  // BlockSnapshot values
@group(0) @binding(2) var<storage, read_write> soa_out    : array<f32>;  // decoded SoA f32
@group(0) @binding(3) var<uniform>             p          : Params;

var<workgroup> temp: array<i32, 512>;  // shared memory for scan

// ── Up-sweep (reduce) phase ──
// ── Down-sweep (distribute) phase ──
// → Standard Blelloch scan implementation

@compute @workgroup_size(256)
fn scan_pass1(@builtin(local_invocation_id) lid: vec3<u32>,
              @builtin(workgroup_id) wid: vec3<u32>) {
    let gid = wid.x * 256u + lid.x;
    if gid >= p.visible_count { return; }

    let data_idx = p.start_index + gid;

    // Load delta-of-delta and do first prefix sum in shared memory
    temp[lid.x * 2u]     = dd_encoded[data_idx * 2u];
    temp[lid.x * 2u + 1u] = dd_encoded[data_idx * 2u + 1u];
    workgroupBarrier();

    // Up-sweep
    for (var d = 1u; d < 512u; d = d << 1u) {
        let idx = (lid.x + 1u) * d * 2u - 1u;
        if idx < 512u {
            temp[idx] += temp[idx - d];
        }
        workgroupBarrier();
    }

    // Down-sweep
    if lid.x == 0u { temp[511] = 0; }
    workgroupBarrier();
    for (var d = 256u; d > 0u; d = d >> 1u) {
        let idx = (lid.x + 1u) * d * 2u - 1u;
        if idx < 512u {
            let t = temp[idx - d];
            temp[idx - d] = temp[idx];
            temp[idx] += t;
        }
        workgroupBarrier();
    }

    // inclusive convert: add original value
    // ... (convert exclusive → inclusive)
}

@compute @workgroup_size(256)
fn scan_pass2_and_dequantize(
    @builtin(local_invocation_id) lid: vec3<u32>,
    @builtin(workgroup_id) wid: vec3<u32>,
) {
    // Second prefix sum (delta → value) + dequantize
    // value_i32 = prefix_sum(delta)
    // Apply same Blelloch scan, then:
    let q = /* scanned value */;
    soa_out[gid] = f32(q) * p.tick_size + p.base_price;
}
```

**multi-workgroup scan**: visible_count > 256 の場合は 3-pass scheme:
1. per-workgroup scan → workgroup sums buffer
2. scan workgroup sums (1 workgroup で十分、256 workgroups = 65K bars まで)
3. add scanned sums back to each workgroup

#### G2: EMA on GPU (parallel scan ベース)

EMA (`y[i] = α·x[i] + (1-α)·y[i-1]`) は first-order IIR filter — 逐次依存。
しかし **parallel scan で厳密に計算可能**:

```
EMA 漸化式を行列形式に変換:
  [y[i], 1] = [x[i], 1] × [[α, 0], [(1-α), 1]]

→ 2×2 行列の結合法則 → prefix product (parallel scan over 2×2 matrices)
→ O(N log N) work, O(log N) depth
```

```wgsl
// ema_compute.wgsl — parallel first-order IIR filter via matrix scan

struct Mat2x2 {
    a00: f32, a01: f32,
    a10: f32, a11: f32,
}

fn mat_mul(a: Mat2x2, b: Mat2x2) -> Mat2x2 {
    return Mat2x2(
        a.a00 * b.a00 + a.a01 * b.a10,
        a.a00 * b.a01 + a.a01 * b.a11,
        a.a10 * b.a00 + a.a11 * b.a10,
        a.a10 * b.a01 + a.a11 * b.a11,
    );
}

var<workgroup> shared_mat: array<Mat2x2, 256>;

@compute @workgroup_size(256)
fn ema_scan(@builtin(local_invocation_id) lid: vec3<u32>,
            @builtin(workgroup_id) wid: vec3<u32>) {
    let gid = wid.x * 256u + lid.x;
    let alpha = p.alpha;

    // 各要素を 2×2 行列として表現
    // M_i = [[alpha * x[i],  0],
    //        [(1-alpha),     1]]
    // → scan(mat_mul, M_0..M_n) の (0,0) 要素が EMA[i]
    if gid < p.visible_count {
        let x = close[p.start_index + gid];
        shared_mat[lid.x] = Mat2x2(alpha * x, 0.0, 1.0 - alpha, 1.0);
    } else {
        shared_mat[lid.x] = Mat2x2(1.0, 0.0, 0.0, 1.0);  // identity
    }
    workgroupBarrier();

    // Hillis-Steele inclusive scan over Mat2x2
    for (var stride = 1u; stride < 256u; stride = stride << 1u) {
        var prev = Mat2x2(1.0, 0.0, 0.0, 1.0);
        if lid.x >= stride {
            prev = shared_mat[lid.x - stride];
        }
        workgroupBarrier();
        if lid.x >= stride {
            shared_mat[lid.x] = mat_mul(prev, shared_mat[lid.x]);
        }
        workgroupBarrier();
    }

    // EMA[i] = shared_mat[lid.x].a00 + seed * shared_mat[lid.x].a10
    if gid < p.visible_count {
        ema_out[gid] = shared_mat[lid.x].a00 + p.seed * shared_mat[lid.x].a10;
    }
}
```

**計算量**: O(N × 8) flops (2×2 mat mul × log N steps) vs 逐次 O(N × 3) flops。
定数は大きいが、**GPU の massive parallelism でスループットは圧倒的** (特に N > 1K)。

#### G3: RSI on GPU (diff + parallel partition + scan)

RSI は `diff → partition(gain/loss) → EMA → division`:

```wgsl
// rsi_compute.wgsl — 3 dispatch pipeline

// Dispatch 1: Diff — embarrassingly parallel
@compute @workgroup_size(256)
fn compute_diff(...) {
    diff[gid] = close[gid + 1] - close[gid];
    gain[gid] = max(diff[gid], 0.0);
    loss[gid] = max(-diff[gid], 0.0);
}

// Dispatch 2: Wilder smoothed average — EMA(gain, period) + EMA(loss, period)
//   → G2 と同じ parallel matrix scan を再利用

// Dispatch 3: RSI = 100 - 100 / (1 + avg_gain / avg_loss)
@compute @workgroup_size(256)
fn compute_rsi(...) {
    let ag = smoothed_gain[gid];
    let al = smoothed_loss[gid];
    rsi_out[gid] = select(100.0, 100.0 - 100.0 / (1.0 + ag / al), al > 1e-10);
}
```

#### G4: LTTB Downsampling on GPU (将来)

> 1M bars visible の場合、pixel-width 以上のデータがある。
> GPU で LTTB (Largest Triangle Three Buckets) ダウンサンプリングを実行し、
> 描画対象を pixel-width に削減。
>
> → 頂点シェーダーへの入力を 1M → ~2K に削減、render pass のコストを **500× 削減**。

### 17.4 VRAM メモリバジェット

```
圧縮データ常駐 (i32 Delta-Delta, 5ch):
  1M bars × 5ch × 4B = 20 MB

解凍済み SoA view window (f32, ダブルバッファ):
  4K bars × 5ch × 4B × 2 slots = 160 KB

ブロックスナップショット (seed values):
  1M bars / 1024 block_size × 12 values × 4B = ~48 KB

インジケーター出力 (3 indicators × ダブルバッファ):
  4K bars × 3 × 4B × 2 = 96 KB

Scan temp buffers (workgroup sums):
  4K bars × 4B × 4 channels = 64 KB

合計: ~20.4 MB (圧縮データが支配的)
────────────────────────────────────────
現行: 20 MB (CPU RAM) + ~200 KB (VRAM)
新: ~0 (CPU RAM) + ~20.4 MB (VRAM)
→ 総メモリ量は同等。CPU RAM が大幅に解放される。
```

### 17.5 バンドル化 — single command buffer per frame

```
現行 (5+ submits per frame):
  submit: upload OHLCV SoA (5× writeBuffer)
  submit: compute minmax
  submit: render candles
  submit: compute SMA + render SMA line   (×3 indicators)
  submit: compute VP + render VP
  submit: present FXAA/FSR

GPU-Resident (1 submit per frame):
  writeBuffer: viewport uniform (16B のみ — startBar, visBars, plotW, plotH)
  commandEncoder:
    ├─ computePass: decompress (Blelloch scan × 5ch)
    ├─ computePass: minmax (workgroup reduction)
    ├─ computePass: SMA prefix sum
    ├─ computePass: EMA matrix scan
    ├─ computePass: RSI diff + scan + combine
    ├─ computePass: volume profile
    ├─ renderPass: candles instanced (VRAM SoA 直読)
    ├─ renderPass: indicator overlays (VRAM 直読)
    ├─ renderPass: VP heatmap
    └─ renderPass: FXAA/FSR → present
  submit: 1 回

Command buffer overhead: 5+ submits → 1 submit = -80% driver overhead
```

### 17.6 CPU の役割の変化

```
現行:                            GPU-Resident 後:
─────────────────────────────    ─────────────────────────────
decompress (WASM)         ✗     viewport uniform write (16B)
min/max scan (WASM)       ✗     HUD rendering (Canvas 2D)
SoA upload (5× DMA)       ✗     DOM event handling
indicator compute (WASM)   ✗     (idle — フレーム中に他のタスク可能)
viewport calc (JS)         ✓
HUD rendering (Canvas 2D)  ✓
DOM event handling          ✓
```

**CPU が per-frame で行う計算は viewport uniform 書き込み (16B) のみ**。
残り 16.6 ms のフレームバジェットを HUD、プリフェッチ、ユーザー入力に使える。

### 17.7 GPU-Resident で不要になる CPU コード

| 現行 CPU コード | 状態 |
|----------------|------|
| `store.decompress_view_window()` | ❌ GPU compute G1 に置換 |
| `store.view_price_min/max()` | ❌ GPU minmax (既存) で代替 — CPU fallback 削除 |
| `store.compute_sma/ema/rsi()` | ❌ GPU compute G2/G3 に置換 |
| `indicators::sma/ema/rsi()` (Rust) | ❌ WGSL に完全移行 |
| render_worker.js の 5× writeBuffer | ❌ 圧縮データが VRAM-resident のため不要 |
| `decompress_close_range()` (pre-history) | ❌ GPU がフル履歴を VRAM に保持 |

**残る CPU コード**:
- `commit_ingestion()` — 新データの圧縮 + VRAM upload (低頻度)
- `push_internal()` — Delta-Delta encoding (低頻度)
- HUD 描画 (Canvas 2D)
- DOM イベントハンドリング

### 17.8 実行可能性の評価

| 要件 | 判定 | 備考 |
|------|------|------|
| VRAM 20 MB 常駐 | ✅ | デスクトップ GPU: 数 GB。モバイル: 下限 ~128 MB |
| Blelloch scan (WGSL) | ✅ | workgroup shared memory + barrier で実装可能 |
| Multi-workgroup scan | ✅ | 3-pass scheme (scan → collect → distribute)。65K bars まで 1-pass |
| 2×2 matrix scan (EMA) | ✅ | f32 精度で十分 (EMA は数値安定) |
| 圧縮データの VRAM upload | ✅ | ingest 時に 1 回。`queue.writeBuffer` で OK |
| i32 → f32 dequantize | ✅ | WGSL `f32(q) * tick + base` — embarrassingly parallel |
| ブロックスナップショット | ✅ | 小バッファ (~48 KB) を uniform/storage で供給 |
| ブラウザ互換性 | ⚠️ | WebGPU 必須。Chrome 113+, Edge 113+, Safari 18.2+ |

### 17.9 段階的移行パス

```
Phase G0 (既存 §16 S3/S4):
  ① minmax → workgroup reduction (S4, 0.5 日)
  ② SMA → prefix sum (S3, 2 日)
  これだけで GPU compute 品質が大幅向上

Phase G1 — decompress on GPU (核心, ~5 日):
  ① 圧縮データ (i32 SoA 5ch) を GPUBuffer に常駐
  ② ブロックスナップショットを GPUBuffer に格納
  ③ Blelloch scan WGSL 実装 (2-pass: DD → Delta → Value)
  ④ dequantize compute pass
  ⑤ render_worker.js: decompress + upload 削除、viewport uniform のみに

Phase G2 — all indicators on GPU (~3 日):
  ① EMA: parallel 2×2 matrix scan (ema_compute.wgsl)
  ② RSI: diff + partition + Wilder scan (rsi_compute.wgsl)
  ③ Bollinger Bands, MACD 等も同パターンで GPU 化
  ④ CPU indicators.rs を GPU フォールバック専用に降格

Phase G3 — single command buffer (~1 日):
  ① 全 compute + render を 1 つの command encoder に統合
  ② submit 回数: 5+ → 1
  ③ GPU timeline profiling で pass 間レイテンシを検証

Phase G4 — GPU LTTB downsampling (将来, ~3 日):
  ① 1M bars → ~2K bars のダウンサンプルを GPU compute で実行
  ② render pass の頂点数を 500× 削減
```

### 17.10 改訂パイプライン比較

| 指標 | 現行 | §16 (SIMD/Unroll) | §17 (GPU-Resident) | 改善率 |
|------|------|-------------------|---------------------|--------|
| CPU→GPU 転送 / frame | 5× writeBuffer (4.8 KB) | 1× writeBuffer (4.8 KB) | **16B uniform のみ** | **-99.7%** |
| CPU 計算 / frame | decompress + minmax + indicators | decompress (optimized) | **ほぼゼロ** | **-99%** |
| GPU submit / frame | 5+ | 5+ | **1** | **-80%** |
| VRAM 使用量 | ~200 KB | ~200 KB + 384 KB arena | ~20 MB (圧縮常駐) | +100× (**トレードオフ**) |
| CPU RAM (WASM) | ~20 MB | ~20 MB | **~0.5 MB** (メタデータのみ) | **-97%** |
| 1M bars フレームレイテンシ | ~2.5 ms | ~1.0 ms | **~0.3 ms** (GPU 内完結) | **-88%** |
| ブラウザ要件 | WebGPU | WebGPU + WASM SIMD | **WebGPU のみ** | WASM SIMD 不要に |

### 17.11 §14 Arena との関係

§14 FrameArena は **GPU-Resident 設計でも有用**:

- **G0-G1 移行期**: CPU decompress を残しつつ Arena で bulk upload → 段階的に GPU compute に置換
- **HUD 用 CPU readback**: 価格ラベル・クロスヘアには CPU 側でもデータが必要
  → Arena の front slot を HUD 描画用に CPU 側で読む (GPU→CPU readback なしで済む)
- **フォールバック パス**: WebGPU compute 非対応環境では CPU (WASM SIMD) にフォールバック
  → Arena + §16 SIMD が フォールバック実装になる

```
Tier 1: GPU-Resident (§17) — 最速。WebGPU compute 必須。
Tier 2: CPU SIMD + Arena (§14+§16) — フォールバック。WASM SIMD 必須。
Tier 3: CPU scalar + Vec (現行) — レガシー。WASM 最低限。
```

---

## 18. 全体実装計画 v4 (最終版)

```
       Week 1                Week 2                Week 3                Week 4
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │ P2: talc (1d)  │   │ P0: Arena      │   │ G1: decompress │   │ G2: EMA/RSI    │
 │ S1: SIMD (1d)  │   │  (cont, 4d)    │   │  on GPU (5d)   │   │  on GPU (3d)   │
 │ S4: GPU min/max│   │ S2: unroll (2d) │   │                │   │ G3: single     │
 │  (0.5d)        │   │ S3: GPU SMA    │   │                │   │  cmd buf (1d)  │
 │ P0: Arena      │   │  prefix (2d)   │   │                │   │                │
 │  (start, 4d)   │   │                │   │                │   │                │
 └────────────────┘   └────────────────┘   └────────────────┘   └────────────────┘

                                           Week 5 (optional)
                                     ┌────────────────┐
                                     │ P1: Parallel    │
                                     │  Pipeline (5d)  │
                                     │ G4: GPU LTTB   │
                                     │  (3d, optional) │
                                     └────────────────┘

合計: ~26 日 (5 週間)
  P2 (1d) + S1 (1d) + S4 (0.5d) + P0 (4d) + S2 (2d) + S3 (2d)
  + G1 (5d) + G2 (3d) + G3 (1d) + P1 (5d) + バッファ (1.5d)
```

### 18.1 依存関係グラフ

```
P2 (talc) ─────────────────────────────────────→ (独立、いつでも可)

S1 (SIMD) ──→ S2 (unroll) ──→ [Tier 2 フォールバック完成]
                                      │
S4 (GPU minmax) ──→ S3 (GPU SMA) ────→ G1 (decompress on GPU)
                                              │
P0 (Arena) ───────────────────────────────────→ G1 (Arena が WriteBuffer 移行期に使用)
                                              │
                                        G2 (EMA/RSI on GPU)
                                              │
                                        G3 (single cmd buf)
                                              │
                                        P1 (Parallel Pipeline) ← GPU-Resident 完成後の
                                              │                 意味が変わる (注 18.2)
                                        G4 (GPU LTTB)
```

### 18.2 P1 (Parallel Pipeline) の位置づけ再評価

GPU-Resident パイプライン (§17) が完了すると:
- CPU の per-frame 負荷がほぼゼロになる
- Worker 分割の主な動機（CPU 計算の並列化）が消滅する

**P1 の新たな意味**:
- **HUD を別 Worker に分離**: Canvas 2D の HUD 描画が GPU submit と同一 Worker だと、
  HUD の複雑化（チャートパネル分割、ツールチップ等）が GPU フレームに影響する
- **ingest パイプライン**: 新データの fetch + compress + VRAM upload を Data Worker で行い、
  Render Worker は GPU フレームに専念する
- **priority**: G1-G3 完了後に必要性を再評価。HUD が軽量なら P1 は不要かもしれない

---

*§17-18 追記: 2026-03-01 — GPU Compute 全面活用 / VRAM-Resident パイプライン設計*
