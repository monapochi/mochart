# 【開発エピソード】Mochart WebGPU版：「5〜10倍高速化」の幻想と、真に必要な「1行のrAF」

本ドキュメントは、2026-03-04のMochartペアプログラミング・セッションにおけるアーキテクチャ見直しの記録です。
「とにかくSIMD化すれば速くなるはずだ」という直感を冷静な分析で打ち砕き、ユーザー体験（UX）に直結する真のボトルネックへフォーカスを定めた一連のプロセスを、エンジニアリングの教訓として残します。

---

## エピソード1：魅力的な「高速化プラン」の到来

ある日、プロジェクトの Next Steps として以下の3つの魅力的な改善プランが提案されました。

1. **indicators.rs（SMA/EMA/BB/RSI/MACD）を Rust SIMD に移行** → インジケーター計算が 5–10× 高速化？
2. **PriceRangeScan を WASM SIMD に移行** → min/max スキャンが 3–4× 高速化？
3. **vsync問題の根本解決** → `render_worker` での `requestAnimationFrame`（rAF）への移行によるレンダリングタイミングの最適化

Rust と WASM を採用している以上、「SIMD 移行」という響きにはロマンがあります。「5〜10倍高速化できるなら今すぐやるしかないだろう」──直感的にはそう思えました。

しかし、実行に移す前にコードベースの実態とアルゴリズムの特性を分析した結果、残酷な真実が判明します。

---

## エピソード2：「5倍高速化」の幻想とアルゴリズムの壁

### 幻想その1：インジケーターのSIMD化
現在のインジケーター実装（`crates/mochart-wasm-new/src/indicators.rs`）を調べてみると、以下のアルゴリズムが使われていました。

- **SMA / EMA / RSI / MACD**：これらは「前の計算結果」に依存する**逐次依存チェーン**の構造を持っています（典型的な例： `sum += input[i] - input[i-period]` や `prev = alpha * current + (1 - alpha) * prev`）。

**SIMD（Single Instruction Multiple Data）**は「独立した複数のデータ」を同時に処理するデータ並列化技術です。前のデータの結果が確定しないと次が計算できない逐次依存のアルゴリズムでは、データ並列化の恩恵をほぼ受けられません。「5〜10倍高速化」は現実には不可能な**誤った期待値**だったのです。
（唯一Bollinger Bandsのσ計算部分はSIMD化可能でしたが、全体から見ればごく一部に過ぎませんでした）

### 幻想その2：スキャンのSIMD化
`view_price_min()` および `max()` における配列のスキャンは、並列 Reduction として SIMD に最適です。理論上は確かに「3〜4倍」の高速化が見込めます。

しかし、実行時間をプロファイルしてみると衝撃の事実が判明します。
対象となるデータは画面に表示されている View Window（約 200〜2000 bars）のみ。スカラー版のループでも**1μs 未満**で完了していました。
1フレームの持ち時間（60fps）は **16.6ms (16,666μs)** です。つまり、全体バジェットの **0.01% 未満** の処理を4倍速くしたところで、ユーザーには全く違いがわかりません。ROI（投資対効果）が低すぎたのです。

---

## エピソード3：真のボトルネック「vsync アライメント問題」

華々しい「SIMD最適化」のプランを見送り、我々の目は最後の地味なプランに向かいました。
**「vsync 問題の根本解決（render_worker での rAF 利用）」** です。

これまでの `render_worker.js` のメインループは以下のようになっていました。

```javascript
// ❌ 旧実装：非同期ウェイトによるディスコネクトなループ
async function renderLoop() {
  while (true) {
    // data_worker からのシグナルを待つ
    await Atomics.waitAsync(frameCtrl, FCTRL_READY, lastFrameReadyVal).value;
    lastFrameReadyVal = Atomics.load(frameCtrl, FCTRL_READY);
    // ... 描画処理 ...
  }
}
```

このアプローチには致命的な欠陥がありました。
`Atomics.waitAsync` はディスプレイの垂直同期（vsync）とは**完全に無関係**に関数から復帰します。
`data_worker` がフレームを猛スピードで生成し続けると、ディスプレイが1回の画面更新を行う間（16.6ms）に、`render_worker` が**無駄に複数回 GPU へ Submit してしまう**（あるいはタイミングがズレてティアリングが発生する）という問題が起きていたのです。

---

## エピソード4：「1行のrAF」による世界の調和

Chrome 124 以降、OffscreenCanvas と組み合わせて Worker 内でも `requestAnimationFrame` が使えるようになっています。

私たちは `Atomics.waitAsync` を捨てて、`requestAnimationFrame` を使って「ディスプレイの更新タイミングに合わせたポーリング」へ設計を反転させました。

```javascript
// ✅ 新実装：ディスプレイ（vsync）と調和したポーリングループ
function renderLoop() {
  let lastFrameReadyVal = 0;

  function renderFrame() {
    // 次のディスプレイ更新タイミングで呼ばれるように予約する
    if (self.requestAnimationFrame) {
      self.requestAnimationFrame(renderFrame);
    } else {
      setTimeout(renderFrame, 16);
    }

    // 新しいフレームデータが来ているかポーリング（ノンブロッキング）で確認
    const currentReadyVal = Atomics.load(frameCtrl, FCTRL_READY);
    if (currentReadyVal === lastFrameReadyVal) return;
    lastFrameReadyVal = currentReadyVal;

    // ... 描画処理 ...
  }
  
  renderFrame();
}
```

### 結果
- **ティアリングの解消**: GPU への Submit タイミングがディスプレイの vsync にピタリと揃いました。
- **無駄なオーバーヘッドの消滅**: 1フレーム間に複数回レンダリングする無駄な電力が削られました。
- **「ヌルヌル動く」手触り**: 最終的にユーザー体験を最も大きく変えたのは、SIMD などの複雑な計算命令ではなく、ブラウザの描画パイプラインとの「調和（アライメント）」でした。

---

## 学びのまとめ

- **「SIMD = 速い」という思考停止を疑う**：アルゴリズムの依存関係（逐次的か並列可能か）を評価せずに最適化に飛びつかない。
- **ROI（投資対効果）を計算する**：1μs を 0.2μs に縮めても、16,666μs のバジェットの中では「誤差」でしかない。ボトルネック以外を最適化しても意味はない。
- **システム境界との同期が最も重要**：GPUにピクセルを渡す最後の出口（vsync アライメント）がズレていれば、どれだけ前段を高速化しても画面はカクつく。

「高速化」とは単に処理速度（CPU時間）を上げることではありません。ユーザーの目に「滑らかで快適だ」と感じさせるためのエンジニアリングこそが、我々の最終目標です。
