# 2026-04-22 — Mochart β1 リリース ロードマップ

> 対象: `@monasche/mochart` を **0.1.0-alpha.16** から **0.1.0-beta.1** に進めるための作業計画
> 前提: ライン/エリア系列実装が完了し、コア描画機能の幅は揃った

---

## 0. β1 の定義 (Definition of Done)

以下 4 つが揃った時点で **0.1.0-beta.1** を切る:

1. **F1: ディレクトリ命名整理** — npm パッケージとして公開しても自然な階層
2. **F2: デッドコードの archive 化** — 削除ではなく「履歴アーカイブ + ビルド除外」
3. **F3: API ドキュメントの公開** — TypeDoc + デモ統合の Web サイト
4. **F4: フレームワーク向けコンポーネント** — Solid / React / Vue 用の薄いラッパー

各フィーチャーは **独立 PR** として進められるよう設計する。

---

## F1 — ディレクトリ命名整理 (`crates/.../src/demo` 問題)

### 1.1 問題

- `crates/mochart-wasm-new/src/demo/` の名前が **"デモ専用" を示唆** するが、
  実際にはこの中の `render_worker.js` / `data_worker.js` / `unified_worker.js` /
  `gpu_renderer.js` / `chart_host.ts` は **本番ライブラリのランタイム本体**
- npm 公開時 (`dist/demo/unifiedWorker.js`) の path も "demo" を含み、
  利用者から見て「デモを import している」ように誤解される
- LP 用の HTML/UI は別ディレクトリに分けるべき

### 1.2 改名後の構造 (提案)

> **命名根拠**: Windows アプリ慣習で候補となるのは `lib/` / `runtime/` / `bin/`。
> Mochart の対象は **能動的に動くワーカー/レンダラー本体** であり、`.NET` の
> `Microsoft.NETCore.App/<version>/` や `Microsoft.WindowsAppRuntime` と同じ意味づけになる
> `runtime/` を採用する。`lib/` は意味としては許容範囲だが「再利用部品集」のニュアンスが強い。

```
crates/mochart-wasm-new/src/
  runtime/                ← 旧 demo/ から「ランタイム本体」だけ移動
    gpu_renderer.js
    render_worker.js
    data_worker.js
    unified_worker.js
    chart_host.ts         ← ホストブリッジ (ライブラリ利用者も触る)
    mochart_engine.ts
    webgpu_candles.ts
    shared_protocol.js
    generated_shaders.js
  examples/
    lp/                   ← LP / GitHub Pages 用 HTML/CSS/UI 専用
      index.html
      controls.css
      lp_bootstrap.ts     ← 旧 chart_host.ts から UI バインドだけ抽出

src/
  demo/   →  src/runtime/   ← npm 側 re-export を runtime に改名
    unifiedWorker.ts (再エクスポート)
    renderWorker.ts (再エクスポート)
    dataWorker.ts (再エクスポート)
```

`@monasche/mochart` の export map もリネーム:

```diff
-  "./worker/data": { "import": "./dist/demo/unifiedWorker.js" }
+  "./worker/data": { "import": "./dist/runtime/unifiedWorker.js" }
```

### 1.3 影響範囲 (grep 結果ベース、26 ファイル)

- ビルド系: `package.json`, `scripts/build-docs.sh`, `scripts/build-publish.sh`,
  `scripts/build-wasm-shared.sh`, `tools/wgsl-bundle.config.json`,
  `tools/zero-alloc-checker.ts` の起動引数
- TS 側: `src/demo/*.ts` (re-export), `src/api/workers/*`, `index.html` (LP 用)
- テスト: `test/p1SharedProtocolFdb.test.ts` ほか
- ドキュメント: `.github/copilot-instructions.md` (パス対応表), 各 `MEMO_*.md`,
  `PLAN_*.md`

### 1.4 PR 分割 (リスク低減)

| PR | 内容 | 検証 |
| --- | --- | --- |
| PR-1a | `crates/.../src/demo/` → `crates/.../src/runtime/` を `git mv` で改名のみ | tsc / bun test / build:wasm |
| PR-1b | LP HTML/CSS を `crates/.../examples/lp/` に分離 | dev サーバ手動確認 |
| PR-1c | `src/demo/*.ts` → `src/runtime/*.ts`、export map 更新、後方互換 alias を 1 リリース分残す | npm pack 結果の path 確認 |
| PR-1d | `.github/copilot-instructions.md` の対応表を更新 | レビューのみ |

> **後方互換**: β1 では `dist/demo/*` の旧 path も併存させる (deprecation warning のみ)。
> `0.1.0-beta.2` か正式 `1.0.0` で削除。

### 1.4-bis デプロイ成果物の除外ルール (test/bench/archive を絶対に含めない)

`runtime/` フォルダおよび npm publish 成果物に **テスト・ベンチ・実験コードを混入させない**
ための多重防御を入れる:

#### 1.4-bis-1 ソースツリー側のルール

- `runtime/` 直下には **`*.test.ts` / `*.test.js` / `*.bench.*` / `__tests__/` を置かない**
- テストは従来通り **リポジトリルート `test/`** にのみ配置 (現状維持)
- 実験コード・退避コードは `_archive/` (F2 参照) にのみ配置

#### 1.4-bis-2 ビルドツール側のホワイトリスト/ブロックリスト

| ツール | 対応 |
| --- | --- |
| `package.json` `files` | `["dist/"]` 等の **明示ホワイトリスト** を維持 (現状 OK)。`src/` を絶対に含めない |
| `bun build` エントリ | `src/index.ts` / `src/runtime/unifiedWorker.ts` 等を明示。glob 展開は使わない (現状 OK) |
| `tools/generate_wgsl_bundle.cjs` | 入力リストは `tools/wgsl-bundle.config.json` の明示列挙。`*.wgsl` glob にしない |
| `scripts/build-publish.sh` | publish ディレクトリは **明示 cp** のみ。`cp -r runtime/` のような再帰コピー禁止 |
| `scripts/build-docs.sh` | LP デプロイの `cp` も明示パス列挙。`runtime/` 内の任意ファイルを含めない |

#### 1.4-bis-3 ビルド後の検証 (CI で自動実行)

新規スクリプト `tools/verify_publish_artifacts.sh` を追加し、`build:publish` の直後に実行:

```bash
#!/usr/bin/env bash
set -euo pipefail
PUBLISH_DIR="${1:-publish}"

# Forbidden patterns inside publish artifact
FORBIDDEN=(
  "*.test.js" "*.test.ts" "*.test.d.ts"
  "*.bench.js" "*.spec.js"
  "__tests__" "__mocks__"
  "_archive" "experiment"
  "*.map"           # sourcemap (publish ビルドは --no-sourcemap だが念のため)
  "tsconfig*.json" "bunfig.toml"
)

FOUND=0
for pat in "${FORBIDDEN[@]}"; do
  if find "$PUBLISH_DIR" -name "$pat" | grep -q .; then
    echo "ERROR: forbidden pattern found in $PUBLISH_DIR: $pat"
    find "$PUBLISH_DIR" -name "$pat"
    FOUND=1
  fi
done

# Sanity check: total size must stay reasonable (<10 MB) for npm
SIZE_KB=$(du -sk "$PUBLISH_DIR" | cut -f1)
if [[ $SIZE_KB -gt 10240 ]]; then
  echo "ERROR: publish artifact too large: ${SIZE_KB} KB > 10240 KB"
  FOUND=1
fi

if [[ $FOUND -ne 0 ]]; then
  echo "publish artifact validation failed"
  exit 1
fi
echo "publish artifact OK (size: ${SIZE_KB} KB)"
```

`package.json` に統合:

```json
"build:publish": "bash scripts/build-publish.sh && bash tools/verify_publish_artifacts.sh publish",
"build:all": "... && bash tools/verify_publish_artifacts.sh dist"
```

#### 1.4-bis-4 `.npmignore` は使わない方針

- `.npmignore` を作ると `package.json` の `files` を **上書き** してしまうので使わない
- ホワイトリスト (`files`) を **唯一の権威ソース** とする

#### 1.4-bis-5 PR 追加 (F1 と同時に)

| PR | 内容 | 検証 |
| --- | --- | --- |
| PR-1e | `tools/verify_publish_artifacts.sh` を追加し `build:publish` / `build:all` に組み込む | local: 既存 publish/ で実行して通る |


### 1.5 手動 / 自動の判断

- `git mv` + sed による一括置換: **シェル 1 つで完結する** (ファイル数は多いが機械的)
- ただし import パスの相対深度が変わる箇所があり (`../../../../`)、CI を必ず通す
- 実行は **本ロードマップ承認後の単独 PR** で。本ターンでは計画化のみ

---

## F2 — デッドコードの archive 化 (削除しない方針)

### 2.1 ユーザー要求

> "デッドコードは消すというより何処かに保存するかビルドの際に削除されるようにしたい"

→ **2 系統で対応**:
1. **コード自体は残したい** (将来の参考、A/B 比較、論文・ブログ素材) → アーカイブディレクトリに退避
2. **本番バンドルからは確実に消す** → ビルド時 tree-shake または `_archive/` ディレクトリ全体を `bun build` の入力から除外

### 2.2 アーカイブディレクトリ規約

```
_archive/
  README.md                    ← なぜ残してあるかの index
  2026-Q1/
    motion_blur_experiment/
      README.md                ← 何を試して何が起きたか
      old_motion_blur.wgsl
      old_motion_blur.js
    legacy_uniform_pool/
      README.md
      _uniPool_field.js.snippet
    legacy_sma_gpu_buffer/
      README.md
      old_sma_buffer.js.snippet
```

ルール:
- アーカイブされたコードは **`.ts`/`.js` 拡張子を `.snippet` または `.md` にしない**
  (ビルドの誤検出を防ぐ)。生のソースコードのまま `.js`/`.ts` で残し、
  `_archive/` 全体を bundler 入力から除外する
- 各サブディレクトリに **必ず `README.md`** を置き、退避日・退避理由・関連 PR/メモを記す
- アーカイブされたコードは **CI のテスト対象外** (`bunfig.toml` / `tsconfig.json` で除外)

### 2.3 ビルド/解析からの除外設定

| ツール | 設定 |
| --- | --- |
| `tsconfig.json` (tsc) | `"exclude": ["_archive/**"]` |
| `bunfig.toml` (bun test) | `[test] exclude = ["_archive/**"]` |
| `bun build` | エントリポイントに `_archive/` を含めない (現状で OK、念のため glob 確認) |
| `tools/zero-alloc-checker.ts` | path フィルタに `_archive/` 除外を入れる |
| `scripts/build-docs.sh` | `cp` 系で `_archive/` を含めないことを確認 |
| ESLint (将来導入時) | `ignorePatterns: ["_archive/**"]` |

### 2.4 移行手順 (β1 の中で 1 PR)

1. 候補洗い出し (semantic_search + 0 件参照 grep)
   - `_uniPool` 系の旧プール
   - Phase 8 で compute tier に置き換わった legacy SMA 用 GPU バッファ確保コード
   - `motion_blur` 実験コード (もし `experiment/motion-blur` ブランチが既に消えていれば
     復元して `_archive/` に格納)
2. `git mv` で `_archive/2026-Q?/<topic>/` に移動
3. 各サブディレクトリに `README.md` (退避理由 + 関連 MEMO へのリンク)
4. `tsconfig.json` / `bunfig.toml` の exclude 追加
5. `bun run build:all` の出力サイズが減っていることを確認 (`du -sh dist/`)

### 2.5 アーカイブ to "削除" のサイクル

- **β1**: archive に退避するだけ (削除しない)
- **1.0.0**: アーカイブを **別ブランチ `archive/pre-1.0`** に切り出して main から削除
- **以降**: 必要になった時点でブランチから `git show` で参照可能

---

## F3 — API ドキュメントの公開

### 3.1 要件

- TypeScript 公開 API (`@monasche/mochart` の `index.ts` / `vanilla.ts` / `runtime/*` 公開分) を
  網羅した参照ドキュメント
- LP デモ (現 `docs/`) と同じドメインで同居 (GitHub Pages 1 サイトで完結)
- 検索 (algolia 等) は β1 段階では入れない (オーバーエンジニアリング)
- バージョンは "latest のみ" (β 期間中は履歴管理コスト > 価値)

### 3.2 推奨スタック

| 候補 | 採否 | 理由 |
| --- | --- | --- |
| **TypeDoc + typedoc-plugin-markdown** | ✅ 採用 | TS の JSDoc から直接 .md 生成。GitHub Pages と相性良い |
| Docusaurus | △ | 機能過剰。チャート関連の文章ガイドが少ないうちは過剰投資 |
| VitePress | ✅ 採用 (見出し用) | `docs-site/` を 1 つだけ立て、TypeDoc 出力を取り込む |
| Storybook | × | コンポーネント中心ではなく API 中心なので不適 |
| TSDoc + custom site | × | 自作維持コスト高 |

### 3.3 サイト構成 (案)

```
https://<gh-pages-domain>/
  /                    ← LP (現状維持)
  /demo/               ← LP デモ (現状維持)
  /docs/               ← VitePress サイト (新規)
    /                  ← Getting Started
    /guide/            ← コンセプト解説 (SoA ストレージ、zero-alloc 原則、設計原則カタログ)
    /api/              ← TypeDoc 生成の API リファレンス
    /examples/         ← フレームワーク別サンプル (F4 と同期)
    /design-notes/     ← docs/reports/ から選定した記事 (ストーリーメモ)
```

### 3.4 ビルド統合

- `package.json` に `docs:build` スクリプト追加
  ```json
  "docs:build": "typedoc --out docs-site/api src/index.ts src/vanilla.ts && vitepress build docs-site"
  ```
- `scripts/build-docs.sh` に `bun run docs:build` を追加 (現 LP コピーと並列)
- GitHub Actions: main マージで自動デプロイ (既存の Pages workflow に乗せる)

### 3.5 公開 API 整備 (前提条件)

TypeDoc が機能するには **JSDoc が必要**。β1 までに以下に最低限の JSDoc を入れる:

- `src/index.ts` の全 export
- `src/vanilla.ts` の `createMochart()` / 関連型
- `runtime/chart_host.ts` の `setSeriesType` / `setSeriesStyle` / `setIndicators` 系

JSDoc テンプレート (例):

```ts
/**
 * Switch the main-pane series rendering mode.
 *
 * @param seriesType - 0 = Candle, 1 = Line, 2 = Area
 * @remarks
 * Cheap operation: reuses the existing OHLCV storage buffer on the GPU.
 * No additional WebGPU upload happens.
 *
 * @example
 * ```ts
 * chart.setSeriesType(2); // switch to area chart
 * ```
 */
setSeriesType(seriesType: 0 | 1 | 2): void;
```

### 3.6 PR 分割

| PR | 内容 |
| --- | --- |
| PR-3a | TypeDoc + VitePress 雛形 (`docs-site/`) を追加し、CI で build できる状態にする |
| PR-3b | 公開 API への JSDoc 追記 (4 ファイル程度) |
| PR-3c | `scripts/build-docs.sh` に `docs:build` を統合し、Pages にデプロイ |
| PR-3d | `guide/` 以下のコンセプト記事執筆 (3 本: zero-alloc, SoA, render pass philosophy) |

---

## F4 — フレームワーク向けコンポーネント

### 4.1 リポジトリ構造の選択

#### 案 A: monorepo (推奨)

```
packages/
  core/                 ← 現 src/ をここに移管 (publish 名: @monasche/mochart)
  solid/                ← @monasche/mochart-solid
  react/                ← @monasche/mochart-react
  vue/                  ← @monasche/mochart-vue
```

- ビルド: pnpm workspaces or bun workspaces
- core を peer dependency に。各フレームワーク版は **完全に薄いラッパー (< 200 LOC)** を目標
- 採用理由: バージョン同期が容易、内部 API を相互参照できる、CI 1 本

#### 案 B: 別リポジトリ

- 採否: **却下**。バージョン同期コストが高すぎる、issue 分散

### 4.2 各バインディングの最小 API (共通)

```ts
// 公約: 全フレームワークで以下を提供する
type MochartProps = {
  data: OhlcvBars | (() => Promise<OhlcvBars>);
  seriesType?: 'candle' | 'line' | 'area';
  indicators?: IndicatorConfig[];
  width?: number;
  height?: number;
  onCrosshair?: (info: CrosshairInfo) => void;
  onClick?: (info: ClickInfo) => void;
};
```

**設計原則**:
- リアクティブ更新の最小単位は **`data` の差し替え** と **`seriesType` の変更**
- 内部では `chart.setSeriesType()` / `chart.setIndicators()` を呼ぶだけ
  (再生成しない、props 変更で破壊しない)
- ライフサイクル: mount で `createMochart()`、unmount で `destroy()`
- **絶対に zero-alloc 不変条件を壊さない** ため、props は **referentially stable** を要求し、
  毎レンダで `data` 配列を作り直すと警告を console.warn (DEV モードのみ)

### 4.3 各フレームワーク実装方針

#### Solid (`@monasche/mochart-solid`)

```tsx
import { createMochart } from '@monasche/mochart/vanilla';
import { onMount, onCleanup, createEffect } from 'solid-js';

export function Mochart(props: MochartProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let chart: ReturnType<typeof createMochart> | undefined;

  onMount(() => {
    if (!canvasRef) return;
    chart = createMochart(canvasRef, { ... });
  });

  createEffect(() => { chart?.setData(props.data); });
  createEffect(() => { chart?.setSeriesType(seriesTypeNumber(props.seriesType)); });

  onCleanup(() => chart?.destroy());

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}
```

- 規模見込み: ~120 LOC
- Solid の signal は ref を変えないので zero-alloc 友達。最も相性が良い

#### React (`@monasche/mochart-react`)

```tsx
import { createMochart } from '@monasche/mochart/vanilla';
import { useEffect, useRef } from 'react';

export function Mochart(props: MochartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ReturnType<typeof createMochart> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = createMochart(canvasRef.current, { ... });
    return () => chartRef.current?.destroy();
  }, []);

  useEffect(() => { chartRef.current?.setData(props.data); }, [props.data]);
  useEffect(() => { chartRef.current?.setSeriesType(seriesTypeNumber(props.seriesType)); }, [props.seriesType]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}
```

- 規模見込み: ~180 LOC
- 注意: React.StrictMode で `useEffect` が 2 回走る。**2 回目で `destroy()` が走った後も
  チャートが復活する** ように `chartRef.current` の null チェックを徹底
- Concurrent Mode 対応のため `useSyncExternalStore` でクロスヘア情報を購読する選択肢あり (β1 では非対応)

#### Vue 3 (`@monasche/mochart-vue`)

```vue
<script setup lang="ts">
import { createMochart } from '@monasche/mochart/vanilla';
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';

const props = defineProps<MochartProps>();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: ReturnType<typeof createMochart> | null = null;

onMounted(() => {
  if (canvasRef.value) chart = createMochart(canvasRef.value, { ... });
});

watch(() => props.data, (d) => chart?.setData(d));
watch(() => props.seriesType, (t) => chart?.setSeriesType(seriesTypeNumber(t)));

onBeforeUnmount(() => chart?.destroy());
</script>
<template><canvas ref="canvasRef" style="width: 100%; height: 100%" /></template>
```

- 規模見込み: ~140 LOC
- Vue は reactivity proxy が data 配列を踏むと **意図しないリアクティブ化** が起きるので、
  `markRaw(data)` を内部で適用 (TypedArray は元から proxy 化されないが OHLCV plain 配列を
  入力に許す場合は要注意)

### 4.4 共通ユーティリティ (peer 内部)

```
packages/core/src/integrations/
  seriesTypeMapping.ts   ← 'candle'/'line'/'area' → 0/1/2
  propsContract.ts       ← 共通 MochartProps 型 + DEV ガード
  ssr.ts                 ← 'no-canvas' 環境で no-op を返す helper
```

→ 各フレームワーク版は core の同じ helper を import するため、API ドリフトを防げる。

### 4.5 SSR 対応

- 全フレームワークで **canvas は `typeof window === 'undefined'` のときに mount しない**
- React は `useEffect` 内、Solid は `onMount` 内、Vue は `onMounted` 内なのでデフォルトで安全
- ドキュメントに「SSR ハイドレーション後に DOM が見えてからレンダリング開始」と明記

### 4.6 PR 分割

| PR | 内容 |
| --- | --- |
| PR-4a | monorepo 化 (`packages/core/` への移管、bun workspaces 設定) |
| PR-4b | `@monasche/mochart-solid` (フィーチャー最小、ライン/エリア対応含む) |
| PR-4c | `@monasche/mochart-react` |
| PR-4d | `@monasche/mochart-vue` |
| PR-4e | 各フレームワークの公式サンプル (`examples/with-{framework}/`) |

---

## 5. β1 リリースまでのマイルストーン

| 順序 | フィーチャー | 推定 PR 数 | 並行可能? |
| --- | --- | --- | --- |
| M1 | F1: ディレクトリ命名整理 | 4 | 単独 (構造変更が前提) |
| M2 | F2: デッドコード archive | 1-2 | F1 の後 (パスが安定してから) |
| M3 | F3: API ドキュメント (雛形 + JSDoc) | 4 | F1 の後 (path 安定が前提) |
| M4 | F4: monorepo 化 + Solid | 2 | F1/F2 の後 |
| M5 | F4: React + Vue | 2 | M4 の後 |
| M6 | β1 リリースタグ + CHANGELOG | 1 | 全部の後 |

---

## 6. 既存リリースから引き継ぐ TODO (本ターンで着手しない)

ライン/エリア実装で見つかった残課題、β1 までに **必ず** 入れるもの:

- **S2 (高/低)**: `setSeriesStyle()` の引数 clamp + 型ガード (本ロードマップ §0 で要求した F1〜F4 のうちどこかに混ぜる)
- **P1 (高/低)**: 共有 frame uniform 統合 (line/area から先に)
- **P2 (高/中)**: `createBindGroup` の毎フレーム生成監査と永続化

詳細は `MEMO_2026-04-22_arch_review_after_line_area_series.md` を参照。

---

## 7. β1 で **やらない** こと

スコープを膨張させない明示リスト:

- ❌ 新インジケーター追加 (Donchian, Heikin-Ashi など)
- ❌ Phase 9 GPU compute engine の本格実装
- ❌ モバイルタッチ操作の高度化 (pinch-zoom 以上の gestures)
- ❌ クラウド同期 / アカウント機能
- ❌ Web Components 版 (Solid/React/Vue で十分)

---

## 8. 関連ドキュメント

- 設計原則: [docs/reports/MEMO_2026-04-22_design_points_line_area_series.md](MEMO_2026-04-22_design_points_line_area_series.md)
- アーキレビュー: [docs/reports/MEMO_2026-04-22_arch_review_after_line_area_series.md](MEMO_2026-04-22_arch_review_after_line_area_series.md)
- 既存ロードマップ: [PLAN_PUBLIC_API_ROADMAP.md](../../PLAN_PUBLIC_API_ROADMAP.md)
- 既存ロードマップ: [PLAN_MOCHART_WASM_NEW.md](../../PLAN_MOCHART_WASM_NEW.md)
