# Mochart

High-performance financial charting library for the web. WebGPU + Rust/WASM. 1M+ bars at 60 fps.

<p align="center">
  <a href="https://monapochi.github.io/mochart/demo/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20Live%20Demo-WebGPU%20%2B%20Rust%2FWASM-4f46e5?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

> **[→ Open Live Demo](https://monapochi.github.io/mochart/demo/)** — WebGPU-powered candle chart rendering 1M+ OHLCV bars at 60 fps with SMA / EMA / BB / RSI / MACD indicators. Runs entirely in the browser via Rust/WASM data engine.

---

There are already many excellent charting libraries out there that are polished, well-documented, and easy to drop in — so first of all, **thank you** for even taking the time to look at this one.

Mochart is something different. It's built for people who enjoy squeezing every last cycle out of the machine: raw WebGPU draw calls, Rust/WASM data kernels, zero-copy `SharedArrayBuffer` pipelines, and hand-tuned WGSL shaders. It is not trying to be the easiest chart library. It is trying to be the fastest.

That said — it's still early. There are known issues. Setup is genuinely non-trivial. If you're the kind of old-school hacker who gets excited about raw GPU pipelines, hand-rolled WASM kernels, and pushing the browser to its absolute limits, you're very welcome to try it. Pull requests and bug reports are always appreciated.

For everyone else: nothing wrong with picking something battle-tested. Come back in a few versions.

---

> ⚠️ **Alpha stage — Setup is non-trivial**
>
> Mochart is currently in **early alpha**. Integration requires several steps beyond a simple `npm install`:
>
> - **WebGPU browser requirement**: Chrome 113+ / Edge 113+ / Safari 18+ (macOS/iOS) required. Firefox does not yet support WebGPU in stable releases.
> - **Worker instantiation**: The chart's GPU renderer and data engine run inside a Web Worker. You must instantiate and pass the Worker explicitly — the bundler setup differs per tool (Vite, webpack, Rollup, esbuild). See [Worker Setup](#worker-setup) below.
> - **Cross-origin isolation (COOP/COEP)**: `SharedArrayBuffer` is required for zero-copy data transfer. Your server must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers — or you must integrate a Service Worker shim. This can break third-party scripts (ads, analytics, OAuth popups) that rely on cross-origin access.
> - **WASM asset serving**: `.wasm` files must be served with `Content-Type: application/wasm` for streaming instantiation. Some dev servers (e.g. Vite without config) fall back to `ArrayBuffer` mode with a console warning.
>
> **Recommendation**: Think of Mochart at this stage as a racing car — it is fast, but rough around the edges and not yet road-legal. It is best suited for experimental projects and technical evaluation. If you need something stable for production today, please check back in a few versions.

---

## Install

```bash
npm install @monasche/mochart
```

## Worker Setup

Mochart's data engine and GPU renderer run in a dedicated Worker. You must start it and pass it to `createChart` via the `worker` option — **the chart will not load data without this**.

The Worker entry point is `@monasche/mochart/worker/data` (resolves to `dist/demo/unifiedWorker.js`).
Each bundler has a different way to instantiate Workers.

> **⚠️ Important rule for React / Vue:**
> In component-based frameworks, do not create `new Worker()` indiscriminately inside the render cycle or `useEffect` without proper cleanup, as this causes memory leaks. Either create the Worker once as a module-level singleton, or terminate it on unmount (`worker.terminate()`).

### Vite

```ts
import { createChart } from '@monasche/mochart';
import UnifiedWorker from '@monasche/mochart/worker/data?worker';
// ?worker tells Vite to bundle this as a separate Worker chunk

const chart = createChart(document.getElementById('chart')!, {
  worker: new UnifiedWorker(),
  width: 960,
  height: 480,
});
```

### webpack 5 / rspack

```ts
import { createChart } from '@monasche/mochart';

// webpack 5 / rspack recognizes new Worker(new URL(..., import.meta.url))
// and automatically creates a separate Worker chunk.
const worker = new Worker(
  new URL('@monasche/mochart/worker/data', import.meta.url),
  { type: 'module' }
);

const chart = createChart(document.getElementById('chart')!, {
  worker: worker,
  width: 960,
  height: 480,
});
```

### Rollup / Rollup-based (Astro, SvelteKit, etc.)

Use the [`@rollup/plugin-url`](https://github.com/rollup/plugins/tree/master/packages/url) or [`rollup-plugin-web-worker-loader`](https://github.com/darionco/rollup-plugin-web-worker-loader), or use the same `new URL` pattern:

```ts
const worker = new Worker(
  new URL('@monasche/mochart/worker/data', import.meta.url),
  { type: 'module' }
);
```

### esbuild

esbuild does not natively bundle Workers from `new URL`. Reference the pre-built file directly and copy it to your output directory:

```ts
// Copy node_modules/@monasche/mochart/dist/demo/unifiedWorker.js
// to your public/output directory, then:
const worker = new Worker('/assets/unifiedWorker.js', { type: 'module' });
```

### Vanilla (no bundler)

```html
<script type="module">
  import { createChart } from '/node_modules/@monasche/mochart/dist/index.js';

  const worker = new Worker(
    '/node_modules/@monasche/mochart/dist/demo/unifiedWorker.js',
    { type: 'module' }
  );

  const chart = createChart(document.getElementById('chart'), {
    worker: worker,
    width: 960,
    height: 480,
  });
</script>
```

## Basic Usage

```ts
import { createChart } from '@monasche/mochart';

const data = [
  { time: 1704067200, open: 100, high: 105, low: 98, close: 103, volume: 1200 },
  { time: 1704153600, open: 103, high: 108, low: 101, close: 106, volume: 980 },
];

const chart = createChart(document.getElementById('chart')!, {
  data,
  width: 960,
  height: 480,
  visibleBars: 120,
  symbol: 'AAPL',   // optional — displayed in top-left corner of the chart
});
```

> **`symbol` is optional.** If omitted, no ticker label is shown. Pass any string to display it.

## Data Format

Mochart accepts OHLCV data in either object or tuple form.

```ts
const objectBars = [
  { time: 1704067200, open: 100, high: 105, low: 98, close: 103, volume: 1200 },
];

const tupleBars = [
  [1704067200, 100, 105, 98, 103, 1200],
];
```

`time` can be either Unix seconds or milliseconds.

## Indicators

```ts
import { createChart, IndicatorKind } from '@monasche/mochart';

const chart = createChart(document.getElementById('chart')!, {
  data,
  indicators: [
    {
      kind: IndicatorKind.SMA,
      period: 20,
      pane: 'main',
      color: [0.0, 0.74, 0.83, 1.0],
    },
    {
      kind: IndicatorKind.RSI,
      period: 14,
      pane: 'sub1',
      color: [1.0, 0.76, 0.03, 1.0],
    },
  ],
});
```

## Common Operations

```ts
chart.setData(data);
chart.panByBars(20);
chart.zoomAt(1.2);

chart.on('crosshair', (event) => {
  console.log(event.time, event.price);
});

chart.on('viewportChange', (event) => {
  console.log(event.startBar, event.visibleBars, event.totalBars);
});
```

## Notes

### SharedArrayBuffer & COOP/COEP

Mochart's worker-backed runtime uses `SharedArrayBuffer` for zero-copy data transfer between the main thread and the render/data workers. Browsers require the page to be **cross-origin isolated** to use `SharedArrayBuffer`.

> **`coi-serviceworker.js` is NOT included in the npm package.** You must provide cross-origin isolation yourself via one of the options below.

**Option A — Set HTTP headers on your server (recommended)**

Add these headers to every response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Example: Vite (`vite.config.ts`)

```ts
export default {
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
};
```

**Option B — Use `coi-serviceworker.js` for static hosting (GitHub Pages, Netlify, etc.)**

When you cannot control HTTP headers, a Service Worker can inject them on the client side.

1. Download [`coi-serviceworker.js`](https://cdn.jsdelivr.net/gh/gzuidhof/coi-serviceworker/coi-serviceworker.js) and place it in your site root (same directory as your HTML file).
2. Add the script tag as the **first** `<script>` in `<head>`:

```html
<head>
  <!-- Must be listed first, before any other scripts -->
  <script src="coi-serviceworker.js"></script>
  <!-- Do NOT add ?v= or other query params — Chrome rejects SW registration with query strings -->
</head>
```

3. Guard your app initialization with `crossOriginIsolated`, since the first page load installs the SW and reloads automatically:

```ts
if (window.crossOriginIsolated) {
  // Safe to use SharedArrayBuffer — start the chart
  const chart = createChart(el, { data });
} else {
  // First visit: coi-serviceworker.js is installing and will reload the page.
  // No action needed here.
}
```

> On first load the Service Worker installs and reloads the page automatically. After the reload `crossOriginIsolated` will be `true` and Mochart will work normally.

### Asset base URL

If your app serves assets from a custom location, set `globalThis.__MOCHART_ASSET_BASE_URL__` before creating the chart:

```ts
globalThis.__MOCHART_ASSET_BASE_URL__ = '/static/mochart/';
const chart = createChart(el, { data });
```

## License

Mochart is licensed under the [Business Source License 1.1](./LICENSE).

- **Non-commercial / small teams**: Free to use (individuals and organizations with fewer than 10 employees).
- **Commercial use**: Requires a separate commercial license. Contact us via [GitHub Issues](https://github.com/monapochi/mochart/issues).
- **Change Date**: Each version converts to MIT License four years after its first public release.

> **Note (Alpha stage)**: License enforcement is deferred while Mochart is in pre-alpha. Non-commercial use is unrestricted during this period. Non-commercial builds display a "Powered by Mochart" watermark.
