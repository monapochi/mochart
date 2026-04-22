# 2026-04-22 — β1 監査フォローアップ：壊れたまま merge されていた wrapper たち

## 問い／端緒

β1 ロードマップに基づいて F2 (dead-code archive)、F3 (VitePress docs-site)、
F4a/b/c (Solid / React / Vue wrapper) を順に実装し main へ merge した。
「実装終わったから審査してほしい」という立場で監査を依頼したら、思ったより深刻な不整合が4件見つかった。

その後、修正を「実装してください」と依頼した際の経緯をここに記録する。

---

## 検証経緯

### 第一発見：wrapper が一切インストールできない

```
error: Workspace dependency "@monasche/mochart" not found
Searched in "./*"
error: @monasche/mochart@workspace:* failed to resolve
```

wrapper の `package.json` は `"@monasche/mochart": "workspace:*"` を `devDependencies` に持ちながら、
root `package.json` に `"workspaces"` フィールドが存在しなかった。
`bun install` は `./*` を探索するが、root 自身 (`@monasche/mochart`) は workspaces の対象外という扱いになるため、
どこを探しても見つからない。

最初の修正試行では root に `"workspaces": ["packages/*"]` を追加したが、
bun は root パッケージ自身を sibling workspace として解決しない仕様のためまだ失敗した。
「root のパッケージは workspace:* で解決できない」という bun の制約に気づいた時点で方針を変える。

正解は「`devDependencies` から `@monasche/mochart` を完全に削除し、
`peerDependencies: ">=0.1.0-alpha.0"` のみにとどめる」だった。
local typecheck は `tsconfig#paths → ../../dist/index.d.ts` で解決する。
`bun run build:types` が先に `dist/index.d.ts` を生成し、
各 wrapper の build script の先頭でそれを呼ぶことで依存順序を保証した。

### 第二発見：docs の Getting Started がまるごと phantom API

```ts
import { createMochart } from '@monasche/mochart/vanilla';  // ← 存在しない
const chart = await createMochart(canvas, { seriesType: 'candle' });
chart.setSeriesType('line');  // ← IChartApi に存在しない
```

実 API は `createChart(container: HTMLElement, options?: CreateChartOptions): IChartApi`。
引数は `canvas` ではなく `container`（内部で `<canvas>` を挿入する）、
`seriesType` オプションも `setSeriesType` メソッドも存在しない。

これはロードマップ策定時の API 設計（案）が実装前の状態で docs に書かれてしまったもの。
書き直しの方針: 既存の JSDoc (`createChart.ts` lines 544–570) を正として、
`Worker` + `OffscreenCanvas` パスの最短コードを載せる。

### 第三発見：indicator diff の key が浅すぎる

```ts
// before — kind と period しか見ていない
function indicatorKey(cfg: IndicatorConfig): string {
  const period = (cfg as { period?: number }).period ?? '';
  return `${cfg.kind}:${period}`;
}
```

`IndicatorConfig` には `pane`, `slow`, `signal`, `stdDev`, `style`, `color`, `lineWidth`, `enabled` がある。
MACD の slow/signal が変わっても、BB の stdDev が変わっても、
同じ kind/period なら「同じインジケータ」と見なされ add/remove がスキップされる。

修正: 全 discriminating field を `|` 区切りで結合。
`new Object()` などは使わず、文字列連結のみで allocation-free に実装。

### 第四発見：ロードマップが「これから書く設計書」のまま公開されていた

PR-3c (Pages deploy 統合)、PR-4a (full monorepo)、PR-4e (examples) はロードマップ上では
完了条件として書かれていたが、実装は行われておらず、
`docs-site/README.md` には存在しない GitHub Pages URL が記載されていた。

対応は「削除より追記」: ロードマップ冒頭に「実装ノート」セクションを新設し、
仕様変更・保留・β1 前の残タスクを一覧化。
URL の誤記は今回のスコープ外とし TODO 表に記録して終えた。

---

## 発見

### bun workspace と root パッケージの解決

bun の workspaces は「リポジトリ内の別パッケージ間」を解決するものであり、
root 自身を workspace メンバーとして認識させる方法はない。
`src/` が `@monasche/mochart` 本体である限り、
wrapper は `workspace:*` を devDependencies に持てない。
**解: peer-only 宣言 + dist dts を paths で解決**。

### "インストールできない private パッケージ" 問題のパターン

今回のように「開発中に private:true で書いて、workspaces なしに workspace:* を貼る」という
構成は、npm/bun どちらでも黙って通ってしまう。
install を実際に試さない限り見つからないので、**CI で `bun install && bun run build` を wrapper ごとに回す** 必要がある。

### キー設計の重要性

reactive diff 系のコードで key 関数の仕様が甘いと、
ユーザーは「なぜ変わらないんだ」と悩み、原因を特定しにくい。
`IndicatorConfig` のような「後から field が増える型」に対する key は、
型定義の全 field を網羅するか、型に `id: string` を要求する設計にすべきだった。

---

## 解釈

"動いているように見えた"のは全て手元でテストを走らせていなかったから。
- wrapper build: `bunx tsc -p packages/solid/tsconfig.json` を一度も実行していなかった
- docs: 実際に `createChart` を使ったコードを書いたことがなかった
- indicator diff: MACD や BB を同一 pane で複数インスタンス試していなかった

「PR ごとに CI を通す」という原則の前に、「PR 内で自分で通す」がある。

ロードマップを「未来の設計」から「現状把握 + 残タスク整理」に切り替えた瞬間、
ドキュメントが生きたものになった。

---

## 次の行動

| 優先度 | タスク |
|---|---|
| 高 | PR-3c: `scripts/build-docs.sh` に docs-site VitePress ビルドを統合し Pages に乗せる |
| 高 | `src/webgpu/createWebGpuChart.ts:318` の `WasmRenderer.new` 型エラー解消 |
| 中 | PR-4e: `examples/with-{solid,react,vue}/` に最小サンプル (各 1 ファイル) |
| 中 | `docs-site/README.md` の「未公開の URL」を削除または条件付き注釈に変更 |
| 低 | wrapper の `bun run build` を CI に組み込む (今は root の tsc からは invisible) |
