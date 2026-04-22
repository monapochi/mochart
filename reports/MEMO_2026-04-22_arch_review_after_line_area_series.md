# 2026-04-22 — ライン/エリアチャート実装後のアーキテクチャ精査メモ

> 対象: `crates/mochart-wasm-new/` (LP デモ + WebGPU レンダラー本体)
> 文体: ストーリーメモ (問い → 検証 → 発見 → 解釈 → 次の行動)

---

## 0. 端緒 — 「ローソク足以外の系列」を入れたら何が見えたか

ユーザー要件は「close 価格のラインチャート」「エリアチャート」の追加だった。
本来はわずか 2 種類の WGSL とブランチの追加で済む話のはずだが、実装を進める過程で
**SoA ストレージバッファを再利用するだけで GPU 転送がゼロになる** ことが
偶然観測できた (新規 vertex/instance バッファを一切作らない)。これは
「**既に確保されているメモリレイアウトをどこまで使い回せるか**」が
今後の高速化・省メモリの主軸になる、という強いシグナルだった。

そこで本メモは以下を記録する:

1. 今回入れたライン/エリア系列の実装サマリ
2. その実装の中で見えた、現アーキテクチャの「使い回せる資産」と「漏れている資産」
3. 高速化 / メモリフットプリント / セキュリティの 3 軸での改善提案
4. 優先度付き次アクション

---

## 1. 入れた変更の要約 (ライン/エリア)

### 1.1 シェーダー (新規 2 本)

- `src/shaders/series_line.wgsl` — TRIANGLE_LIST、6 verts/segment、64B uniform
  - `close_f32_offset` を uniform で受け取り、**既存の OHLCV ストレージバッファを共有**
  - スクリーンピクセル空間で perpendicular を取り、線幅は等方
  - フラグメントで 1px SDF AA
- `src/shaders/series_area.wgsl` — TRIANGLE_LIST、6 verts/segment、96B uniform
  - close と baseline (price_min) で四角形を組む
  - vec4 の `top_color` / `bottom_color` で縦方向グラデ

### 1.2 レンダラー (`gpu_renderer.js`)

- `SERIES_TYPE_CANDLE/LINE/AREA = 0/1/2` をエクスポート
- 既存の candle render pass を `if (this.seriesType === CANDLE) {…} else {…}` で分岐
- `setSeriesType()` / `setSeriesStyle()` を追加
- **新規 GPU リソース**: パイプライン 2 本 + uniform バッファ 2 本 (160B 合計) のみ
  - **頂点バッファなし、インデックスバッファなし、新規ストレージバッファなし**

### 1.3 ワーカー (`unified_worker.js`)

- `set_series_type` / `set_series_style` メッセージを追加し、`gpuRenderer` に委譲

### 1.4 デモ UI (`chart_host.ts` + `index.html`)

- `<select id="seriesType">` を追加し、`change` で `setSeriesType()` を呼ぶ

### 1.5 検証結果

| 項目 | 結果 |
| --- | --- |
| `bunx tsc --noEmit` | OK (warning 0) |
| `bun test` | 122 pass / 0 fail |
| `bun run check:zero-alloc` | 違反なし |
| `bun run check:zero-copy` | OK |
| `bun run build:wasm` | release ビルド成功 |

---

## 2. 観測 — 実装中に見えた「資産マップ」

### 2.1 既に "ゼロコピー" になっている資産

| 資産 | 場所 | ライン/エリアでの再利用 |
| --- | --- | --- |
| OHLCV SoA ストレージバッファ (`[O\|H\|L\|C\|V]`) | `gpu_renderer.js#storageBuf` | ✅ そのまま `@binding(1)` に |
| price_min / price_max | FDB から uniform に流し込み済 | ✅ uniform に複製 |
| view window (`offsetSlots`, `viewLen`, `totalSlots`) | FDB | ✅ uniform に複製 |
| サンプル形式設定 (MSAA texture, depth) | `gpu_renderer.js` | ✅ そのまま使用 |

`writeBuffer` が **1 フレームに 1 回も増えない** のは、ストレージバッファに既に
close 列が乗っているおかげ。ここが今回最大の発見。

### 2.2 「漏れている資産」 — まだ毎フレーム作っている/触っているもの

実装中に grep + 目視で確認できた範囲のリスト (フォローアップ候補):

1. **`createBindGroup` の頻度** — pane/series ごとに毎フレーム作っているように見える箇所がある
   → dynamic offset + 単一 bind group でフレーム数 × N の GC 圧と検証コストを削れる
2. **uniform バッファの重複** — candle/series_line/series_area で `plot_w/h/price_min/price_max/offset_slots/...` が完全に重複
   → 共通 uniform 用の "shared frame uniform" を 1 本立てて `@group(0)` に固定すれば全シェーダーが共有可能
3. **legacy SMA 用 GPU バッファ** — Phase 8 の compute tier 化の過渡期で、CPU 側 SMA 結果と GPU 側でダブルバッファになっている疑いがある
   (今回は触っていないが、後述 §3 で扱う)
4. **`_uniPool` 等の旧プールが残っている可能性** — `gpu_renderer.js` を縦に追ったときに、
   現在 0 件参照のフィールドがいくつかあった (`new ArrayBuffer` の名残)
   → デッドコード掃除の対象

### 2.3 セキュリティ面の現状

| 項目 | 現状 |
| --- | --- |
| WGSL の動的構築 | **無し** (全シェーダーが `generated_shaders.js` に base64 で焼き込み済み) |
| `eval` / `new Function` | grep で **0 件** |
| postMessage origin 検証 | 同一オリジン Worker 前提のため未実装 (一般論としては OK) |
| `set_data_url` のサイズ/MIME ガード | **未確認 → §3 で扱う** |
| COOP/COEP ヘッダ (SAB 前提) | 開発サーバーでは設定されている。`docs/` (GitHub Pages) では確認要 |
| 依存パッケージの pinning | `package.json` は概ね `^` 範囲指定 → lockfile (bun.lockb) で固定 |

---

## 3. 改善提案 — 高速化 / メモリ / セキュリティ

優先度は **(高/中/低) × (効果/工数)** で判定。

### 3.1 高速化

#### [高/低] (P1) 共有 frame uniform の導入

- 現在: candle / series_line / series_area が **各々 64〜96B の uniform を別バッファに書き込み**、
  `plot_w/h, price_min/max, offset_slots, view_len, total_slots` を **3 重で重複保持**
- 提案: `@group(0) @binding(0) frame: FrameUniform` を 1 本作り全シェーダーで共有。
  個別の系列固有値 (line_width / colors / close_offset) のみ `@group(1)` に。
- 効果: `writeBuffer` 呼び出しを 3 → 1 に。`createBindGroup` 候補を共通化。
- 注意: WGSL の binding 番号変更は generated_shaders 再生成 + bind group desc 更新が必要

#### [高/中] (P2) `createBindGroup` の毎フレーム生成を撲滅

- 仮説: pane/series 切り替えで `device.createBindGroup({...})` を毎フレーム呼んでいる箇所がある
- 検証: `gpu_renderer.js` を `device.createBindGroup` で grep し、render pass 内/外を分類
- 提案:
  - リソースが変わらない bind group は **init() で一度だけ作って永続化**
  - リソースが変わるもの (extra slots など) は **dynamic offset** で 1 つの bind group を流用
- 効果: フレームあたりの JS allocation/GC 圧低下、WebGPU 検証コストも削減

#### [中/中] (P3) Render bundle 化

- 候補: candle 1 draw + 系列 1 draw のような **静的な描画コマンド列**
- `GPURenderBundleEncoder` で 1 度だけエンコードし、毎フレーム `executeBundles([bundle])` を呼ぶ
- 効果: `setPipeline` / `setBindGroup` / `draw` の 3 命令分の JS→GPU コマンドエンコード時間を削減
- 注意: viewport 依存が大きい (resize 時にバンドル作り直し) ため、resize ハンドラに紐付ける必要あり

#### [中/低] (P4) Indirect draw への移行

- 現状: `draw(6, viewLen-1)` のように **JS 側で `viewLen` を毎フレーム計算して渡している**
- 提案: `viewLen` を GPU バッファに書き、`drawIndirect` で読ませる
- 効果: zoom/pan で `viewLen` が変わるときの JS→GPU 同期点を 1 つ削減
- ROI 評価: 1 ドローあたり数 μs 程度。Phase 9 の "GPU compute engine" に組み込んだほうが効く

#### [低/中] (P5) ライン/エリアの GPU compute による事前リダクション

- 1M バー regime で line を引くなら、**LTTB をシェーダー化** して visible window だけリサンプリング
- WGSL compute → 動的サンプル数を indirect draw に流す
- 効果: bar > pixel 領域で大幅高速化
- ただし: 現状の bar = pixel 等倍ローソク表示で支配的なボトルネックではない (ROI は限定的)

#### 注意 — やっても効かない/やってはいけないもの

- ❌ **ライン描画の SIMD 化を JS で実装する** — JS ホットパス自体が `draw()` を呼ぶだけで仕事をしていない
- ❌ **Worker をさらに増やす** — 現在 SAB と Atomics で十分同期できている
- ❌ **ライン描画にモーションブラー的処理** — 過去の `experiment/motion-blur` の教訓 (知覚効果ゼロ)

### 3.2 メモリフットプリント

#### [高/低] (M1) デッドコード除去 — 旧 uniform プール / legacy SMA バッファ

- `gpu_renderer.js` 内で 0 件参照のフィールドを掃除
- 旧 SMA 用 GPU バッファ (Phase 8 で compute tier 化された分) が残っていないか確認

#### [中/低] (M2) `series_line` / `series_area` の uniform を 1 本に統合

- §3.1 (P1) と連動。**uniform バッファ 2 本 → 1 本**、ABI を `#[repr(C, align(16))]` 相当の配置に整える
- 削減量: 64 + 96 = 160B → 96B 程度 (1 系列あたり数十 B のオーダーだが、pane 数 × 系列数で効く)

#### [中/中] (M3) ストレージバッファのサブビュー (offset/size) で複製を避ける

- 既に `close_f32_offset` で内部オフセットを表現できているので、**サブバッファを切り出さない方針** を維持
- 一方、Phase 8 で compute 結果を別バッファに書いている部分は **ring buffer 化** して上限を切れる

#### [低/中] (M4) WASM サイズ削減

- `Cargo.toml` に `[profile.release] lto = "fat"`, `opt-level = "z"` を試す (現状 `"s"` の可能性)
- `wee_alloc` は GC 挙動を悪化させるので **採用しない** (Rust 標準アロケータ + `Vec::with_capacity` で十分)

#### [中/低] (M5) SAB 右サイズ化監査

- `_indSab` などのワーカー間共有バッファが **最大 N バー前提で確保しっぱなし** になっていないか確認
- ライン/エリア用に追加リソースを足していないので、現状増分なし

### 3.3 セキュリティ

#### [高/低] (S1) `set_data_url` のサイズ / Content-Type ガード

- 現状: ユーザー指定 URL からデータを取得する経路 (`set_data_url`) のサイズ上限が確認できていない
- 提案:
  - `Content-Length` ヘッダで先に判定し、上限超 (例: 256 MiB) なら拒否
  - `Content-Type` を `application/octet-stream` 等のホワイトリストに制限
  - 503/4xx 時の例外で worker が落ちないよう catch して `error` メッセージに変換 (現状 OK だが要確認)

#### [高/低] (S2) postMessage の入力検証 (defensive)

- 現状: worker は `evt.data.type` で分岐し、各フィールドを `| 0` 等で正規化している箇所が多いが、
  `set_series_style` のように **任意 object を受け取る** API は今回追加した
- 提案: `setSeriesStyle()` 側で:
  - 配列長を 4 に制限、各要素を `Math.min(1, Math.max(0, +v || 0))` で clamp
  - `lineWidthPx` を `Math.min(16, Math.max(0.5, +v || 1.5))` で clamp
- 効果: 異常値で GPU validation エラーを起こさない、ピクセル飽和を防ぐ

#### [中/低] (S3) COOP/COEP ヘッダ確認 (GitHub Pages デプロイ)

- LP (`docs/`) を GitHub Pages で配信している場合、**SAB が動かない可能性**
- 検証: `docs/index.html` にロードされる際に `crossOriginIsolated === true` になるか
- 必要なら `_headers` (Cloudflare Pages) や `meta http-equiv` で COOP/COEP を設定

#### [中/低] (S4) Supply chain — `cargo-vet` / `cargo-deny` の導入

- Rust 側依存 (wgpu, wasm-bindgen, naga) の audit を CI に組み込む
- 今後 GPU compute 経路を強化する際にエコシステムが薄い領域に踏み込むため、早めに守りを入れたい

#### [低/中] (S5) WGSL bundle の整合性検証

- `generated_shaders.js` を base64 で焼いているので **ランタイムでは改ざん検出していない**
- 提案 (任意): SRI 的に sha256 を埋めておき、起動時に照合 → 改ざんを検出したら起動拒否
- ただし、配信元 (CDN) が改ざんされると script 自体が差し替わるため、本質的価値は限定的

---

## 4. 解釈 — このリリースで変わったアーキテクチャの傾き

- **「データはストレージバッファに 1 回置けばいい」** という路線が更に強化された。
  ライン/エリアは追加 GPU 転送を 1 バイトも増やさず実装できた。
- 一方、**uniform レイアウトと bind group 構成は系列ごとに肥大化** している。
  今後 indicator overlay (ボリンジャー、Donchian など) を増やすたびに重複が広がるので、
  P1 (共有 frame uniform) と P2 (bind group 永続化) は **次の系列追加と同時にやる** のが筋。
- セキュリティは "攻撃面が増えていない" という意味では今回問題なし。ただし
  `setSeriesStyle()` で初めて任意 object を受け取るようになったので、S2 の clamp は
  本リリースに合わせて入れたい。

---

## 5. 次のアクション (優先順)

1. **(本リリースに付ける)** S2: `setSeriesStyle()` のフィールド clamp を `chart_host.ts` か `unified_worker.js` で入れる
2. **(次のスプリント)** P1 + M2: 共有 frame uniform への統合 (line/area から先に着手)
3. **(次のスプリント)** P2: `createBindGroup` の頻度監査 + 永続化
4. **(次の次)** M1: gpu_renderer のデッドコード掃除
5. **(任意)** S1: `set_data_url` のサイズ/Content-Type ガード
6. **(Phase 9 と同期)** P3 (render bundle), P4 (indirect draw), P5 (LTTB compute)

---

## 6. 関連ファイル

- 実装:
  - [crates/mochart-wasm-new/src/shaders/series_line.wgsl](../../crates/mochart-wasm-new/src/shaders/series_line.wgsl)
  - [crates/mochart-wasm-new/src/shaders/series_area.wgsl](../../crates/mochart-wasm-new/src/shaders/series_area.wgsl)
  - [crates/mochart-wasm-new/src/demo/gpu_renderer.js](../../crates/mochart-wasm-new/src/demo/gpu_renderer.js)
  - [crates/mochart-wasm-new/src/demo/unified_worker.js](../../crates/mochart-wasm-new/src/demo/unified_worker.js)
  - [crates/mochart-wasm-new/src/demo/chart_host.ts](../../crates/mochart-wasm-new/src/demo/chart_host.ts)
  - [crates/mochart-wasm-new/src/demo/index.html](../../crates/mochart-wasm-new/src/demo/index.html)
- 関連メモ:
  - [docs/MEMO_2026-03-03_motion_blur_experiment.md](../MEMO_2026-03-03_motion_blur_experiment.md) — "効かない最適化" の教訓
  - [docs/MEMO_2026-03-04_vsync_raf_migration.md](../MEMO_2026-03-04_vsync_raf_migration.md) — ROI 第一の教訓
