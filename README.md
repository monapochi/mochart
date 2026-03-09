# Mochart

High-performance financial charting library for the web.

> **WebGPU-First** — GPU Compute + GPU Render の統合パイプラインで、大量データでもリアルタイム 60fps。

## Features

- 🕯 **Multiple chart types** — Candlestick, Line, Area, Bar
- 📊 **20+ built-in indicators** — SMA, EMA, Bollinger Bands, RSI, MACD, ATR, VWAP, OBV, MFI, CMF, ADX, and more
- 🖥 **Multi-renderer** — Canvas 2D / WebGL2 / WebGPU with automatic fallback
- ⚡ **GPU-accelerated computation** — Indicator calculation via WGSL Compute Shader
- 📈 **Real-time streaming** — Append-only data with O(1) updates
- 🎯 **Cache-friendly SoA data** — Columnar TypedArray layout, L1 cache-fitting visible window
- 🌐 **i18n** — Built-in internationalization support
- 🔔 **Alerts** — Runtime alert API with cooldown handling
- 📦 **Zero-dependency** — No external runtime dependencies

## Install

```bash
npm install mochart
```

## Fast Path By Default

The recommended npm integration is the default path:

```js
import { createChart } from 'mochart';

const chart = createChart(document.getElementById('chart'), {
  data: ohlcvBars,
  visibleBars: 120,
  height: 420,
});
```

This uses Mochart's worker-backed path without app-side worker construction.

If a bundler has unusual worker URL rewriting, you can still inject workers explicitly:

```js
import { createChart } from 'mochart';
import RenderWorker from 'mochart/worker/render?worker';
import DataWorker from 'mochart/worker/data?worker';

const chart = createChart(document.getElementById('chart'), {
  data: ohlcvBars,
  sharedRenderWorker: new RenderWorker({ type: 'module' }),
  dataWorker: new DataWorker({ type: 'module' }),
});
```

For a full runnable example, see `examples/npm-vanilla-sample/`.

## WASM Asset Base Override

Mochart resolves WASM assets automatically, but if your deployment copies the package files into a custom static asset folder, set a global base URL before the first chart is created.

```js
globalThis.__MOCHART_ASSET_BASE_URL__ = '/vendor/mochart/';
```

The directory should contain:

- `mochart_wasm_bg.wasm`
- `mochart_wasm_new_bg.wasm`

If you use worker-backed rendering, your page must also serve COOP/COEP headers so `SharedArrayBuffer` is available:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

For a local file dependency setup under Vite, add `server.fs.allow` entries for `dist/pkg` and `dist/demo`, because Vite otherwise blocks the symlinked WASM and worker files.

## Sample Smoke Test

To verify the npm vanilla sample end-to-end:

```bash
npm run verify:sample:npm-vanilla
```

This starts the Vite sample server on a free local port, opens the page with Puppeteer, waits for the chart canvases, and fails if page errors or console errors are detected.

## Quick Start

```typescript
import { createChart } from 'mochart';

const chart = createChart(document.getElementById('chart')!, {
  theme: 'dark',
});

if (chart.backend === 'core') {
  const seriesId = await chart.addSeries({ type: 'candlestick', name: 'main' });
  await chart.setSeriesData(seriesId, ohlcvData);
  chart.panByBars(16);
}

const engineChart = createChart(document.getElementById('gpu-chart') as HTMLCanvasElement, {
  data: ohlcvData,
  config: { indicators: [] },
});

if (engineChart.backend === 'engine') {
  engineChart.addIndicator('sma', { period: 20 });
  engineChart.addIndicator('bb', { period: 20, stdDev: 2 });
}

await chart.destroy();
await engineChart.destroy();
```

## Renderers

| Renderer | Best for | Fallback |
|----------|----------|----------|
| **WebGPU** | Large datasets, GPU compute | WebGL2 |
| **WebGL2** | Broad browser support | Canvas |
| **Canvas 2D** | Universal compatibility | — |

The best available renderer is automatically selected at runtime via `createChart()`.

## Built-in Indicators

### Phase 1 — Trend & Volatility
SMA, EMA, Bollinger Bands, Volume, Pivot Points

### Phase 2 — Momentum & Signals
RSI, MACD, ATR, ADX, Trade Markers

### Phase 3 — Volume & Breadth
VWAP, Bollinger %B, BB Width, Volume Ratio

### Phase 4 — Advanced
OBV, MFI, CMF, Kaufman Patterns, Divergence, Squeeze Alert

## Performance

Designed for cache-friendly, zero-GC hot paths:

| Data size | Memory (SoA) | Cache level |
|-----------|-------------|-------------|
| 1,000 bars (1 screen) | 24 KB | L1 |
| 10,000 bars | 240 KB | L2 |
| 1,000,000 bars (10 years) | 24 MB | L3 |

## API

```typescript
type ChartHandle = CoreChartHandle | EngineChartHandle;

interface CoreChartHandle {
  backend: 'core';
  addSeries(options: Record<string, unknown>): Promise<string>;
  setSeriesData(seriesId: string, data: unknown[], partial?: boolean): Promise<void>;
  panByBars(deltaBars: number): void;
  zoomAt(factor: number, centerIndex?: number, centerRatio?: number): void;
  setViewport(fromIndex: number, toIndex: number): void;
  getVisibleRange(): { from: number; to: number; rightMarginBars?: number } | null;
  on(event: string, cb: (payload?: unknown) => void): void;
  off(event: string, cb?: (payload?: unknown) => void): void;
  flush(): void;
  resize(): void;
  destroy(): Promise<void>;
}

interface EngineChartHandle {
  backend: 'engine';
  setData(data: OhlcvPoint[]): void;
  setConfig(config: ChartConfig): void;
  addIndicator(id: string, params?: Record<string, unknown>): string;
  removeIndicator(instanceId: string): void;
  updateParams(instanceId: string, params: Record<string, unknown>): void;
  toggleVisibility(instanceId: string): void;
  getIndicatorComputeDiagnostics(): IndicatorComputeDiagnostics;
  onDiagnostics(callback: (diagnostics: IndicatorComputeDiagnostics) => void): () => void;
  destroy(): Promise<void>;
}
```

## License

**Business Source License 1.1** — See [LICENSE](./LICENSE) for details.

### Additional Use Grant

Free for:
- Personal and non-commercial use
- Organizations with **10 or fewer employees**

For commercial licensing, please contact the author.

### Change License

This software will be available under the **MIT License** on **2030-02-14** (Change Date).

---

Copyright © 2026 monapochi. All rights reserved.
