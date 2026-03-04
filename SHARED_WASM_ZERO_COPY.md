# SharedArrayBuffer → WASM: Zero-Copy Design & Scaffold

目的
- SharedArrayBuffer を WebAssembly.Memory（共有メモリ）として利用し、JS サイドの `SharedFrameBuffer` を WASM の SIMD カーネルへゼロコピーで渡せる経路を確立する。

設計要点
- WebAssembly.Memory を `shared: true` で生成し、JS 側で `new WebAssembly.Memory({ shared: true, initial, maximum })` を作る。
- wasm モジュールはその `memory` を imports.env.memory として受け取る（wasm-bindgen の出力を書き換えずに直接 WebAssembly.instantiate を使うか、wasm-bindgen のインスタンス化フローをカスタマイズする）。
- Rust 側はポインタ・長さベースのエントリポイントを提供する（例: `ema_ptr(ptr: *const f32, len: usize)`）。JS 側は `new Float32Array(wasm.memory.buffer, ptr, len)` で直接書き込み/読み取りを行う。
- `wasm.memory.grow()` が発生した場合、JS 側の TypedArray ビューは古い ArrayBuffer を参照し続けるため、`refreshViews()` を呼んで再生成する必要がある。

安全性と注意点
- Rust の `from_raw_parts` を使う箇所は `unsafe`。API は「JS が正しい ptr/len を渡す」ことを前提とする。
- メモリオーバーランの検出は難しいため、JS 側で長さ上限やチェックサムを設けることを推奨する。

実装の流れ（短手順）
1. JS: `const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768, shared: true });`
2. JS: instantiate wasm with imports.env.memory = memory (use `WebAssembly.instantiate`/`instantiateStreaming`).
3. Wasm: expose pointer-based kernels (例: `ema_ptr(ptr, len, period)` と `sma_inplace_ptr(dest_ptr, src_ptr, len, period)`)。
4. JS: write data directly into `new Float32Array(memory.buffer, ptr, len)` and call wasm exports.
5. On `memory.grow()`: JS must call `refreshViews()` to re-create all TypedArray views.

Scaffoldされたファイル
- Rust: `crates/mochart-wasm-new/src/shared_memory.rs` — ポインタベースの wasm-bindgen エントリポイント。
- TS: `src/wasm/wasmSharedMemory.ts` — SharedArrayBuffer を持つ `WebAssembly.Memory` 作成・ビュー生成・instantiate ヘルパー。

オフスクリーン表示の最適化（要点）
- dirty-rect: 描画領域の変更を追跡し、`transferToImageBitmap()` を行う際に最小領域だけ転送する（可能であれば sub-image copy を使う）。
- ImageBitmap double-buffer: 2 つの `ImageBitmap` を交互に保管し、前フレームのイメージを保持しつつ新規更新領域のみを転送。
- 転送の条件分岐: 転送メソッドはコスト推定に基づき切替（全面更新なら `transferToImageBitmap`、小領域なら `drawImage` を用いた partial copy）。

次の実装候補
- `SharedFrameBuffer` を WASM 側の固定オフセットに割当てる小さなメモリアロケータを実装すると、JS 側は毎回ポインタを問い合わせるだけで済む。
- `wasm_bindgen` の自動出力を使う場合は、`wasm_bindgen_wbg` の初期化流れを部分的に置き換え、生成された glue をカスタム instantiate で呼ぶ必要がある。

参考コード
- `crates/mochart-wasm-new/src/shared_memory.rs` にポインタベースのラッパーがある。
- `src/wasm/wasmSharedMemory.ts` にメモリ作成と view 管理の補助関数がある。

運用チェックリスト
- SharedArrayBuffer を用いるために、サイトは COOP/COEP ヘッダ（Cross-Origin-Opener-Policy: same-origin, Cross-Origin-Embedder-Policy: require-corp）を正しく設定する必要がある。
- ブラウザ互換性（SharedArrayBuffer と WebAssembly 共有メモリ）を確認する。
