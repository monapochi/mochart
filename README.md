# Mochart

High-performance financial charting library for the web. WebGPU + Rust/WASM. 1M+ bars at 60 fps.

<p align="center">
  <a href="https://monapochi.github.io/mochart/demo/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20Live%20Demo-WebGPU%20%2B%20Rust%2FWASM-4f46e5?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

> **[→ Open Live Demo](https://monapochi.github.io/mochart/demo/)** — WebGPU-powered candle chart rendering 1M+ OHLCV bars at 60 fps with SMA / EMA / BB / RSI / MACD indicators. Runs entirely in the browser via Rust/WASM data engine.

## Install

```bash
npm install @monasche/mochart
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
});
```

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
2. Add the script tag as the **first** `<script>` in `<head>` — before any other scripts:

```html
<head>
  <!-- Must be listed first, before any other scripts -->
  <script src="coi-serviceworker.js"></script>
  <!-- Do NOT add ?v= or other query params to the src — Chrome will reject the SW registration -->
</head>
```

> On first load the Service Worker installs and reloads the page automatically. After the reload `crossOriginIsolated` will be `true` and `SharedArrayBuffer` will be available.

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
