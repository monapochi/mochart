# 2026-04-22 — ライン/エリア系列実装で抽出した設計原則

> 対象: `crates/mochart-wasm-new/` 系列描画パイプライン
> 文体: 設計原則カタログ (今後の系列追加・GPU パス追加で再利用する判断基準)

---

## 0. なぜこの文書を残すか

ライン/エリア系列の実装は機能としては小さいが、その過程で **「Mochart の高速化が
どの抽象に依存しているか」** がはっきり可視化された。今後 (Donchian、Heikin-Ashi、
ボリュームプロファイル拡張など) 系列を追加するたびに同じ設計判断が現れるため、
**1 度限りの実装ノートではなく原則カタログ** として固定する。

---

## 1. 原則 1 — 「データレイアウト所有権」を 1 か所に集約する

### 1.1 観測

- OHLCV は SoA `[O|H|L|C|V]` で 1 本のストレージバッファに乗っている
- ライン/エリアは **`close_f32_offset = viewLen * 3`** という offset を uniform で渡すだけで
  追加 GPU 転送なしに描画できた
- `vertexBuffer` も `indexBuffer` も新規作成不要 (TRIANGLE_LIST + `vertex_index` 算術)

### 1.2 原則

> **GPU 上の系列データは "新しい系列" のために再アップロードしない。
> 既存 SoA のオフセットだけを uniform で表現せよ。**

### 1.3 反例 (やってはいけないこと)

- ❌ ライン用に「close だけの Float32Array」を別バッファとしてアップロードする
- ❌ エリア用に baseline 線分用の頂点バッファを作る
- ❌ シェーダーに渡すデータを JS で詰め直す (offset 1 つで済む)

### 1.4 適用範囲

- 今後の系列 (Heikin-Ashi、Renko、Kagi、HLC bars、Baseline series) は
  **すべてこの SoA + offset uniform の延長で書ける** ことを前提にする
- HA だけは「OHLC を再計算」する必要があるので、**WGSL compute pre-pass**
  で派生 SoA を別バッファに書き、同じパターンで line/area を再利用する

---

## 2. 原則 2 — 「描画を増やす」のではなく「render pass を分岐」する

### 2.1 観測

- candle / line / area は **同じ render pass の中で** `setPipeline` を切り替えるだけ
- area + line を重ねるケースは **同一 pass 内で 2 ドロー** (area → line)
- フレーム毎の `beginRenderPass` / `endPass` の数は系列を増やしても **1** のまま

### 2.2 原則

> **新しい系列 = 新しい pipeline + 新しい uniform。
> 新しい render pass を作らない。**

### 2.3 理由

- `beginRenderPass` は load/store と clear のコストを毎回払う (depth/MSAA を含む)
- pass 内ドロー追加は WebGPU 検証 + JS→GPU コマンドバッファ追記のみ
- pass 数を抑えると後で **render bundle 化** が容易 (バンドル境界 = pass 境界)

### 2.4 反例

- ❌ ライン専用に `commandEncoder.beginRenderPass({ ... clear })` を 2 本目として作る
- ❌ オーバーレイ系列のために MSAA texture を専用に確保する

---

## 3. 原則 3 — uniform は「フレーム共通」と「系列固有」を分離する

### 3.1 観測

- candle / line / area の uniform に **`plot_w/h, price_min/max, offset_slots, view_len, total_slots`** が完全重複
- 系列固有値は line: `line_width_px, color, close_offset` / area: `top_color, bottom_color, close_offset`

### 3.2 原則

> **Uniform は 2 階層に分ける。`@group(0)` = フレーム共通 (1 本)、`@group(1)` = 系列固有 (1 本/系列)。
> 重複フィールドはフレーム共通側だけが書き込む。**

### 3.3 効果

- `writeBuffer` 呼び出し: 系列数 × 1 → 1 + 系列数の "差分のみ"
- `createBindGroup` の永続化が容易 (`@group(0)` は init で 1 度だけ作って固定)
- WGSL のレイアウト変更時に系列ごとに修正が要らない

### 3.4 タイミング

- 本リリースでは **未実装** (line/area が独立 64B/96B uniform)
- β1 までに統合 (詳細は β1 ロードマップ §3 参照)

---

## 4. 原則 4 — JS→GPU の境界では「整数化されたインデックス空間」を使う

### 4.1 観測

- ライン/エリアの座標は **`(slot_index, close_value)`** から計算
- `slot_index` は uniform `offset_slots` + `vertex_index` 算術で完全に決定可能
- view window のスクロールは uniform 1 つの書き換えで済む

### 4.2 原則

> **シェーダーが扱う x 軸はピクセルでも秒でもなく "slot index"。
> 時間軸/価格軸の物理単位への変換はシェーダーのフラグメント側または最終 vertex 計算でのみ行う。**

### 4.3 適用例 (今後)

- crosshair の x 座標: `slot_index` ベースで GPU に送ると pan/zoom と完全同期
- インジケーター overlay (ボリンジャー上下バンド): SMA バッファに対する slot offset で参照

---

## 5. 原則 5 — 「効かない最適化」を見極めるチェックリスト

ライン/エリア実装中に何度も「ここを SIMD 化したい」「Worker 増やしたい」という
誘惑があったが、過去メモ (`MEMO_2026-03-03_motion_blur_experiment.md`,
`MEMO_2026-03-04_vsync_raf_migration.md`) の教訓に従い **すべて見送った**。
判断基準を残す:

### 5.1 着手前の 3 問

1. **その処理は 16.6 ms フレーム予算の何 %?**
   - 1 ms 未満なら 4× 速くしても体感ゼロ。後回し。
2. **ボトルネックは CPU/GPU/帯域のどれ?**
   - GPU が暇 (`requestAnimationFrame` 間隔が安定 16.7 ms) なら CPU を削る価値が薄い
3. **その最適化は "今動いている zero-alloc / zero-copy 不変条件" を壊さないか?**
   - 壊すなら高速化ではなく退化。

### 5.2 既知の "効かない最適化"

| 案 | 理由 |
| --- | --- |
| ライン描画の SIMD 化 (JS 側) | JS は draw を呼ぶだけ。仕事をしていない |
| Worker をさらに細分化 | SAB + Atomics で同期は十分。分割は GC 圧を上げる |
| close 列を専用バッファに切り出す | 既存 SoA で済む。アップロード倍増 |
| モーションブラー的処理 | 過去実験で知覚効果ゼロ確認済 |

---

## 6. 原則 6 — セキュリティは "攻撃面を増やさない" を最優先

### 6.1 観測

- WGSL は **全部 base64 で焼き込み** (`generated_shaders.js`)。動的構築なし
- `eval` / `new Function` は grep で 0 件
- worker の `evt.data.*` は基本 `| 0` や `Number()` で正規化済

### 6.2 原則

> **新しい API を追加するときは、それが "任意 object を受け取るか" を必ず自問せよ。
> Yes なら境界で clamp + 型チェック。**

### 6.3 本リリースでの違反 (要修正)

- `setSeriesStyle({ lineColor, areaTopColor, areaBottomColor, lineWidthPx })`
  - 配列長/要素レンジ/数値レンジの clamp が **未実装**
  - β1 ロードマップ §6 で対応

---

## 7. まとめ — 「Mochart らしさ」のチェックリスト

新しい系列・新しい GPU パスを追加するときに以下を全部満たしているか確認する:

- [ ] 既存 SoA ストレージバッファを再利用しているか (新規アップロードを増やしていないか)
- [ ] 同一 render pass にドローを追加できているか (新しい pass を作っていないか)
- [ ] uniform の重複フィールドを増やしていないか (フレーム共通分離原則)
- [ ] シェーダー側で座標を slot index ベースで扱っているか
- [ ] zero-alloc / zero-copy 検査 (`bun run check:zero-alloc` / `check:zero-copy`) を通るか
- [ ] 任意 object を受け取る API を新設したなら、境界で clamp / 型ガードを入れたか

---

## 8. 関連ドキュメント

- 実装メモ: [docs/reports/MEMO_2026-04-22_arch_review_after_line_area_series.md](MEMO_2026-04-22_arch_review_after_line_area_series.md)
- β1 ロードマップ: [docs/reports/PLAN_2026-04-22_beta1_roadmap.md](PLAN_2026-04-22_beta1_roadmap.md)
- 教訓: [docs/MEMO_2026-03-03_motion_blur_experiment.md](../MEMO_2026-03-03_motion_blur_experiment.md)
- 教訓: [docs/MEMO_2026-03-04_vsync_raf_migration.md](../MEMO_2026-03-04_vsync_raf_migration.md)
