# 【開発エピソード】JSブリッジの「薄肉化手術」と、3つの提案の再検討

本ドキュメントは、2026-03-04のMochartペアプログラミング・セッションにおける
「極限性能チューニング」の記録です。前日のモーションブラー実験と vsync rAF 移行から
得た **ドメイン第一原則** を instructions に刻んだ上で、その原則のレンズを通して
過去の提案を再検討し、さらに JS/WASM ブリッジの per-frame アロケーションを
一掃する「薄肉化手術」を実施した記録です。

---

## エピソード1：「ドメイン第一原則」を instructions に刻む

前日の2つの教訓――

1. **モーションブラー実験**: 7フェーズの試行 → 知覚効果ゼロ。
   「画面上のピクセルが移動する」のか「別のコンテンツが再描画される」のかで、
   最適化の理論が根本的に変わる。
2. **vsync rAF 移行**: 地味な1行の変更がユーザー体験を最も大きく変えた。
   μs単位のCPU最適化よりも、ブラウザ描画パイプラインとの「調和」が王道。

――これらを `.github/copilot-instructions.md` の Engineering Principle に
**Domain-First Optimization Principle** として3つの問いの形で追記しました。

> 1. ドメインの物理モデルを理解しているか？
> 2. ボトルネックはどこにあるか？ ROI は十分か？
> 3. 正しいアルゴリズムが正しい体験を生むか？

以後、「SIMD = 速い」「GPU = 速い」という思考停止で提案に飛びつくことを明確に禁止し、
**計測 → ボトルネック特定 → 改善** の順を制度化しました。

---

## エピソード2：過去の3つの提案を再検討する

ドメイン第一原則の3つの問いに通し、以前の提案を冷静に再検討します。

### 提案1: vsync rAF 移行 → ✅ 実装済み・正しかった

**問い1**: render_worker が vsync と無関係なタイミングで GPU Submit していた。
これはチャート描画のドメインモデル――「16.6ms に1回、ディスプレイが画面を更新する」
――を無視した設計だった。

**問い2**: ボトルネックは CPU 計算ではなく「出口のアライメント」。
すべての前段処理を高速化しても、最後の出口がズレていれば画面はカクつく。
ROI は∞――コスト（1行の `requestAnimationFrame`）に対して、
ユーザー体感改善は全処理中で最大だった。

**問い3**: ユーザーの目に「ヌルヌル」と映った。体感として正しい。

**結論**: 3つの問いすべてをパスした唯一の提案。すでに実装済み。

### 提案2: BB の σ 計算を O(n) 算法に変更（Welford のオンラインアルゴリズム）→ ✅ 実装済みだった

**問い1**: Bollinger Bands の標準偏差は滑動窓の分散計算。
ナイーブ実装では各窓で Σ(x-μ)² を再計算し O(n×period) になる。
Welford のオンラインアルゴリズムは窓のスライドで mean と M2 を
差分更新し O(n) に落とせる。これはドメインの数学モデルに忠実な改善。

**問い2**: 実はすでに実装済みだった。`indicators.rs` の `bb()` 関数を検査すると、
Welford のスライディングウィンドウ分散が正しく実装されている：

```rust
// Slide window
for i in period..n {
    let x_add = input[i] as f64;
    let x_rem = input[i - period] as f64;
    let mean_old = mean;
    mean += (x_add - x_rem) / period_f64;
    m2 += (x_add - x_rem) * (x_add - mean + x_rem - mean_old);
    // ...
}
```

初期窓は Welford の蓄積体（O(period)）、以降は1要素あたり O(1) の差分更新。
全体で O(n) が実現されている。さらに f64 精度で蓄積し f32 にダウンキャストする
Kahan 的な精度保護もある。

**問い3**: この最適化は計算量のオーダーを変えるため、period が大きい場合
（例: 200日BB）に計測可能な差が出る。ただし view window サイズ（200〜2000 bars）では
絶対時間の差は μs オーダーであり、ユーザーの目には見えない。

**結論**: アルゴリズムとして正しい改善。すでに実装済みでアクション不要。
「SIMD で高速化」ではなく「アルゴリズムのオーダーを下げる」が正解――
ドメイン第一原則の模範解答。

### 提案3: data_worker → render_worker の SoA memcpy 削減 → ⚠️ 要設計検討

**問い1**: 現在の data_worker は毎フレーム、WASM メモリ上の6チャネル SoA を
frameBuf (SharedArrayBuffer) にコピーしている：

```
Open   :  viewLen × 4B = 最大 16,384B
High   :  viewLen × 4B = 最大 16,384B
Low    :  viewLen × 4B = 最大 16,384B
Close  :  viewLen × 4B = 最大 16,384B
Volume :  viewLen × 4B = 最大 16,384B
Time   :  viewLen × 8B = 最大 32,768B
合計   :  最大 ~112KB / frame
```

典型的な表示（500 bars）でも ~14KB のメモリコピーが毎フレーム走る。
これは「WASM メモリを render_worker が直接参照できない」というアーキテクチャ制約に起因する。

**問い2**: `TypedArray.set()` + `subarray()` によるバルクコピーは V8 内部で
`memcpy` に JIT 化される。14KB の memcpy は L1 キャッシュに収まり、
現代 CPU では **~1-2μs** で完了する。16,666μs のフレームバジェットの 0.01%。

しかしこれは **CPU 時間** の話。真のコストは2点ある：

- **メモリバス帯域**: 112KB/frame × 60fps = ~6.7MB/s。モバイルでは帯域が貴重。
- **キャッシュ汚染**: render_worker 側で GPU upload 直前に同じデータを
  frameBuf から読み直すため、L1/L2 を2回汚す（write + read）。

**問い3**: ユーザーの目に見えるか？ 60fps のデスクトップでは恐らく No。
120fps のモバイルや 1M bars のフルデータでは No ではない可能性がある。

**設計代替案（将来課題）**:

```
案A: WASM メモリの view window 領域を render_worker に公開
  → WebAssembly.Memory は SharedArrayBuffer にできる（shared:true, maximum 指定）
  → render_worker が wasm.memory.buffer から直接 subarray() で参照
  → data_worker 側の 6ch memcpy が消滅（ゼロコピー）
  
案B: frameBuf を WASM の linear memory 内に配置
  → WASM 側が decompress 先を frameBuf の SAB 上のアドレスに直接書く
  → data_worker は FDB ヘッダーのみ更新（128B）
  
案C: GPU Buffer を mappedAtCreation で直接書き込み
  → render_worker 側で WASM メモリから GPU Buffer への転送を1回にする
  → ただし WebGPU の mapAsync は非同期でフレームバジェットに収まらない可能性
```

**結論**: 現時点では ROI が低い（~2μs / 16,666μs）ため優先度は低いが、
アーキテクチャ的に **WASM shared memory** ベースのゼロコピー設計（案A/B）は
将来の 120fps / モバイル対応で検討すべき唯一の構造的改善。
現在のセッションでは実装しない。

---

## エピソード3：JSブリッジの「薄肉化手術」

3つの提案の再検討と並行して、ドメイン第一原則の**問い2**（ROI）に基づく
もう一つの改善を実施しました。JS/WASM ブリッジの per-frame アロケーション一掃です。

### 症状: 毎フレーム ~30個の TypedArray / DataView 生成

プロファイリングで判明した事実：

- `data_worker.js`: 毎フレーム 6+ 個の `new Float32Array(wasmMemory.buffer, ...)`
- `render_worker.js`: 毎フレーム 8+ 個の `new Float32Array/Float64Array(frameBuf, ...)`
- `gpu_renderer.js`: 毎フレーム 6+ 個の `new ArrayBuffer`, `new DataView`, `new Uint32Array`

各 TypedArray は V8 ランタイムで ~64B のオブジェクトヘッダを割り当て、
GC の Minor GC（Scavenge）サイクルに含まれます。
60fps で ~30 個 = 1,800 オブジェクト/秒。これ自体は微小ですが、
**ゼロアロケーション・ポリシー** に違反しており、GC ジッタの潜在リスクとなっていました。

### 手術内容

#### Rust 側（Task 1-2: std140/std430 + SIMD SoA）

- `FrameDescriptor` を 64B → 128B `#[repr(C, align(16))]` に拡張。
  vec4 境界でフィールドをグルーピングし、GPU uniform buffer への
  JS 側での再パッキングを不要化。
- `view_price_min()` / `view_price_max()` を 4-wide accumulator パターンに書き換え。
  TurboFan / LLVM の auto-vectorization ヒント。
- SMA に Kahan 補償加算 + inv_period 乗算、EMA に branch-free FMA 形式を適用。
- `decompress_view_window()` 内部ループを raw pointer 書き込みに変更し、
  bounds-check を elimination。

#### JS 側（Task 3-4: ブリッジ薄肉化 + FDB 拡張）

| ファイル | Before | After |
|---|---|---|
| `shared_protocol.js` | FDB 64B オフセット | 128B レイアウト + 新フィールド 6 個 |
| `data_worker.js` | 毎フレーム 6× dest `new Float32Array` + WASM view 再生成 | init 時プリアロケート + `_refreshWasmViews()` detach 検出 |
| `render_worker.js` | 毎フレーム 8× `new Float32/64Array(frameBuf)` + `new DataView(indSab)` | init 時 max-capacity views + arena view amortized cache |
| `gpu_renderer.js` | 毎フレーム `new ArrayBuffer(96/64/48)` + `new DataView` + `draws.push({})` | 8 個のクラスフィールド DataView + 32-slot pre-allocated draw pool |

#### 追加修正（サブエージェント検証で発見）

- `data_worker.js` `_writeIndSab()`: arena コピーの `new Float32Array(indSab, ...)` →
  `_dstArena` / `_dstArenaCap` amortized キャッシュ（arenaLen 増大時のみ再生成）
- `render_worker.js` `formatVolume()`: 到達不能 `ctx.restore()` 除去
- `gpu_renderer.js` `_drawIndicatorCmds()`: `const draws = []` + N × `push({...})` →
  32-element `_drawPool` プリアロケーション + index-based for ループ
- `gpu_renderer.js` `computeVolumeProfileOnGpu()`: `new DataView(pbuf)` →
  `_vpParamsDv` フィールドキャッシュ
- `gpu_renderer.js` Phase 2 ループ: `for-of` destructuring → `for (let di = 0; ...)` 
  （iterator オブジェクト生成回避）

### Rust ビルド品質

- 警告: 5 → 0（`unused_unsafe`, `unused_mut`, `dead_code`, `mixed_script_confusables` を解消）
- `package.json` の build script が前回セッションで不正変更されていたのを revert
- 最終ビルド: ゼロ警告、exit 0

---

## エピソード4（エピローグ）：ドメイン第一原則の実践結果

今回のセッションで、ドメイン第一原則は3つの形で実践されました。

1. **「正しいアルゴリズムを選ぶ」（BB Welford）**: 
   SIMD ではなく、計算量のオーダーを下げることが本質だった。
   ――そしてすでに実装済みだった。正しい設計は過去の自分が守っていた。

2. **「ROI を計算してから手を動かす」（SoA memcpy 削減）**:
   ~2μs / 16,666μs の処理を最適化するより、将来の shared WASM memory 設計を
   検討する方が投資対効果が高い。今日は手を出さない。

3. **「ゼロアロケーションは制度であり、例外を許さない」（JS ブリッジ薄肉化）**:
   1個 64B の TypedArray は「微小」だが、ポリシー違反を30箇所放置すれば
   GC ジッタの不確実性が蓄積する。マイクロな改善の積み重ねが
   deterministic なフレームタイミングを保証する。

> 「高速化」とは、処理速度を上げることではない。
> ユーザーの目に「滑らかで快適だ」と感じさせるための、
> ドメインに根ざしたエンジニアリングである。

---

**ブランチ**: `feat/execution-plan-engine`  
**変更ファイル**: `lib.rs`, `store.rs`, `indicators.rs`, `execution_plan.rs`,
                 `shared_protocol.js`, `data_worker.js`, `render_worker.js`, `gpu_renderer.js`,
                 `.github/copilot-instructions.md`  
**instructions 追記**: Domain-First Optimization Principle（3つの問い）  
**所要時間**: 2セッション（Rust/JS 実装 + 検証・修正・MEMO）
