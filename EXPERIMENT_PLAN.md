Experiment Plan: Raw Wasm, no_std+talc, in-place compression, thin JS wrapper
=======================================================================

目的
----
この実験は、現在の `wasm-bindgen` + `wee_alloc` ベースラインに対し、以下の方針で性能/メモリ改善が得られるかを検証する。

- 低オーバーヘッドなバイナリロード（Raw Wasm）
- ランタイム割当を最適化するための `no_std` と `talc` アロケータの導入
- 圧縮済みデータのインプレース参照（デコード手法の比較）
- 必要最小限の JS ラッパー（`wasm-bindgen` を使わない薄い wrapper）
- `wee_alloc` の扱い（置換 or 継続）の評価

成功基準
---------
- バイナリサイズ（.wasm）: >=10% 削減 を望ましい指標とする。
- 起動時間（instantiate）: 同等か改善。
- 実行時ピークメモリ: 明確な改善（例: -10% 以上）またはメモリ割当パターンの改善（memory.grow の発生頻度削減）。
- 実ワークロード（データ ingest + 毎フレーム描画）で、FPS に著しい劣化がないこと。

実験マトリクス
----------------
各組み合わせでベンチを取る。

Matrix axes:
- Build type: wasm-bindgen baseline | RawWasm
- Allocator: wee_alloc | talc | system (default)
- Data ingest: uncompressed (current binary) | LZ4 in-place | zstd streaming
- Wrapper: wasm-bindgen (baseline) | thin JS wrapper

主要観測指標
- .wasm size (bytes)
- instantiate time (ms)
- time to first usable frame (ms)
- peak RSS / wasm memory usage (MB)
- memory.grow count and sizes
- alloc/free throughput (ops/s) under heavy ingest
- frame latency and FPS under standard workload

作業ステップ（高レベル）
----------------------
1. マトリクス確定 & ベンチ仕様書作成（トレースポイント・測定方法）
2. Raw Wasm prototype
   - Rust crate を `extern "C"` エクスポートのみでビルド（`wasm32-unknown-unknown`）
   - 手動JSブートストラップ: `WebAssembly.instantiateStreaming` → exports 呼び出し → memory.view 管理
   - API: `init(ptr,len)` / `ingest(ptr,len)` / `render(frameArgs...)` の最小セット
3. no_std + talc allocator prototype
   - 小型 no_std crate を作り talc を allocator に設定
   - alloc/free 性能テスト (多量連続 ingest、ランダム小割当)
4. 圧縮データの in-place アプローチ
   - LZ4 と zstd を試す
   - a) WASM 内でインプレースデコード（low-level decoder を組込む）
   - b) JS 側でデコードして直接 wasm.memory に書き込む（zero-copy 近似）
   - 比較: デコードピークメモリ、CPU、total ingest latency
5. Thin JS wrapper
   - `init()` (instantiate + cache views) と `ptr/len` helpers を提供
   - メモリビューのキャッシュ / refresh on memory.grow
6. wee_alloc の評価
   - 同一ワークロードで wee_alloc vs talc vs system を比較
7. ベンチ & 自動化
   - `experiments/bench_runner.sh` を用意して測定自動化
8. レポート作成

リスクと対策
----------------
- 手動 glue は型安全性を弱める → 広範なユニットテストと型契約ドキュメントを用意
- no_std のデバッグ難度 → ログや統計はJS側で収集する（WASM 側は minimal）
- 圧縮は CPU を増やす可能性がある → 圧縮率とデコードコストのトレードオフ表を作成

実験スケジュール（目安）
- Week 1: マトリクス確定、RawWasm プロトタイプの実装とベンチ
- Week 2: no_std + talc 実装、圧縮 in-place の PoC
- Week 3: ベンチ取り、解析、レポート

出力物
- `docs/EXPERIMENT_PLAN.md`（本書）
- `experiments/raw-wasm/` （プロトタイプ + README）
- `experiments/talc-compression/` （プロトタイプ + README）
- `experiments/bench_runner.sh`（ベンチ自動化スクリプト）
- `experiments/results/*.json`（定量結果）

---
作成者: Mochart チーム
日付: 2026-02-28

追記: 実装タスクの優先度と詳細
----------------------------
本実験は並列で進めるが、短期優先度は以下の通り。

- 優先度高 (Day 1): `Thin JS Wrapper` 実装
   - 理由: API 層を先に固めることで、以降の wasm 側変更（allocator 置換や RawWasm）を透過的に評価できる。
   - 成果物: `experiments/raw-wasm/prototype/js/chart_wrapper.js` と `chart_wasm.d.ts`。

- 優先度中 (Day 2): `Bump allocator`（proto）実装
   - 理由: 実データ取り込み時の alloc 挙動を早期に観測するため。バイナリサイズ・alloc latency に直結。
   - 成果物: `experiments/talc-compression/proto_allocator` に bump allocator API を追加。

- 優先度低 (Day 3): 圧縮 in-place の PoC とベンチ自動化

各タスクは `experiments/results/` に json 形式で計測結果を保存し、最後に比較レポートを作成する。
