# WASM ptr/len API — 具体設計

目的
- Rust 側が大容量データの単一所有者となり、JS/TS 側は ptr/len を受け取って `TypedArray` ビューを作りゼロコピーで参照する。
- 安全性・安定性のためのメモリ寿命ルールを明確化し、移行手順とテストを提示する。

前提
- `wasm-bindgen` を用いて Rust ↔ JS を接続する。
- Rust の線形メモリ（`WebAssembly.Memory`）上に `Vec<T>` 等を配置する。
- `memory.grow()` の発生は JS 側へ通知が必要となる（`refreshViews()`）。

用語
- owner: Rust（`ColumnarStore` / `RingBuffer` 等）
- view: JS が作る `TypedArray`（例: `new Float32Array(wasm.memory.buffer, ptr, len)`）

設計方針（要約）
1. API はすべて ptr/len ベースで公開する（例: `open_ptr() -> usize`, `len() -> usize`）。
2. Rust は「ポインタはミューテーションが発生するまで安定」とする。ただし `Vec` の再割当てが起こる可能性があるため、JS 側はミューテートの直後に `refreshViews()` を呼んで再バインドを行うことを契約とする。
3. 永続的なポインタ安定性が必要な場合は Rust 側で固定キャパシティまたは double-buffer strategy を採用する。
4. コピーが必要な場合は明示 API（`to_snapshot()` など）を提供する。

API 仕様

Rust (wasm-bindgen) 側エクスポート例

- Columnar store:
  - `pub fn len(&self) -> usize`
  - `pub fn open_ptr(&self) -> usize`  // pointer to f32
  - `pub fn high_ptr(&self) -> usize`
  - `pub fn low_ptr(&self) -> usize`
  - `pub fn close_ptr(&self) -> usize`
  - `pub fn time_ptr(&self) -> usize`  // pointer to f64
  - `pub fn reserve(&mut self, additional: usize)` // pre-reserve to avoid realloc
  - `pub fn push(&mut self, time: f64, open: f32, high: f32, low: f32, close: f32, volume: f32)`
  - `pub fn clear(&mut self)`
  - `pub fn snapshot_to_js(&self) -> JsValue` // explicit copy if needed

注意点: `open_ptr()` などは `usize`(ptr) を返す。JS 側で `len = engine.len()` を取って `new Float32Array(memory.buffer, ptr, len)` を作る。

JS 側使用例

```ts
const len = engine.len();
const ptr = engine.open_ptr();
const open = new Float32Array(wasm.memory.buffer, ptr, len);
// use open (zero-copy) for read-only operations this frame
```

メモリ寿命ルール（重要）

- ルールA: Rust のミューテート（`push`, `reserve`, `clear` など）は、内部 `Vec` の再割当て（ポインタ変更）を引き起こす可能性がある。
- ルールB: JS はミューテートを行う呼び出し後に、**直ちに** `refreshViews()` を呼んで再読み込みすること。
- ルールC: JS が `TypedArray` を長期に保持する必要がある場合は `snapshot_to_js()` を呼んで明示的なコピーを作る。

実装パターン（選択肢）

1. Conservative (推奨初期実装)
   - Rust は通常の `Vec<T>` を使う。
   - API 契約で「ミューテート後は JS が `refreshViews()` を呼ぶ」ことを強制し、リファクタ時に問題が発生したら `reserve()` を積極的に使う。
   - Pros: 実装が簡単。既存コードの移行が容易。
   - Cons: JS が誤ってサブシーケンスを長期保持すると壊れるリスク（契約で防止）。

2. Stable-ptr (より堅牢)
   - Rust 側で ring-buffer や preallocated capacity を使い、内部ポインタが再割当されないようにする。
   - Pros: JS 側の安全性が高い（長期参照可）。
   - Cons: 実装コストとメモリオーバーヘッド。容量管理が必要。

3. Double-buffer / snapshot-on-write
   - 書き込みが発生したら新しいバッファへ書き込み、古いバッファは読み取り中のJSが使えるようにする。リファレンスカウントや世代番号で管理。
   - Pros: 高速で破壊的再割当問題を解決。
   - Cons: 複雑。実装難易度が高い。

推薦: まずは (1) Conservative を採用し、Hot-path（毎フレーム読み取り）では `reserve()` を適切に使い、問題が顕在化したら (2) または (3) を導入する。

API 変更の移行手順

1. Rust: `ColumnarStore` に ptr/len を返す getter を追加。
2. TS: 既存の `WasmEngineColumnarView` を ptr/len で TypedArray を返すように統一。
3. テスト: memory.grow および Vec 再割当のシナリオをユニットテストで検証。
4. CI: `tools/check_zero_copy.sh` を使い、生成物に不許可のコピーが混入しないことを確認。

テストケース（推奨）

- WasmEngineColumnarView > view reflects underlying wasm memory after `push` when `refreshViews()` is called.
- WasmEngineColumnarView > snapshot_to_js produces an array equal to view contents but independent of subsequent pushes.
- Integration: perform `N` pushes causing `Vec` reallocation; ensure `refreshViews()` re-binds views and subsequent reads are correct.

注意: wasm-bindgen 生成コードについて
- `wasm-bindgen` のデフォルトパターンは Rust 側が `Vec<T>` を返すと glue が `getArray...FromWasm0(...).slice()` のようにコピーし、Rust の free を呼ぶ。これはゼロコピーを阻害する。
- 解決法: ワークフローを `wasm-bindgen` の出力がコピーするパターンを採らないように Rust 側エクスポートを変える（所有権を JS に移さない ptr/len スタイル）。

追加の安全策
- `wasmSharedMemory.refreshViews(views)` を利用して `DataView` / typed-array の再生成を行う。
- Glue 側（`src/pkg/mochart_wasm.js`）で `getFloat32ArrayMemory0()` 等のキャッシュ検出を強化して既に適用済み（buffer 検査）。

まとめ
- 短期: ptr/len API を導入し、JS の利用契約（ミューテート後は refresh）を厳格にする。テストで検証する。
- 中期: 使用状況に応じて stable-ptr または double-buffer を導入してポインタ安定性を保証する。

次のアクション候補
- 私が Rust 側に追加すべき具体的な関数シグネチャのパッチ案を作る（`crates/mochart-wasm-new/src/lib.rs` の変更草案）。
- TS 側の `WasmEngineColumnarView` を ptr/len パターンで統一するパッチを作る。

どちらを先に進めますか？
