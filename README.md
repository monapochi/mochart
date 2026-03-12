# Mochart

High-performance financial charting library for the web.

## Install

```bash
npm install mochart
```

## Basic Usage

```ts
import { createChart } from 'mochart';

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
import { createChart, IndicatorKind } from 'mochart';

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

- The default path uses Mochart's worker-backed runtime.
- If your app serves assets from a custom location, set `globalThis.__MOCHART_ASSET_BASE_URL__` before creating the chart.
- Worker-backed rendering requires `SharedArrayBuffer`, so your page must be served with COOP/COEP enabled.

## License

Mochart is licensed under the [Business Source License 1.1](./LICENSE).

- **Non-commercial / small teams**: Free to use (individuals and organizations with fewer than 10 employees).
- **Commercial use**: Requires a separate commercial license. Contact us via [GitHub Issues](https://github.com/monapochi/mochart/issues).
- **Change Date**: Each version converts to MIT License four years after its first public release.

> **Note (Alpha stage)**: License enforcement is deferred while Mochart is in pre-alpha. Non-commercial use is unrestricted during this period. Non-commercial builds display a "Powered by Mochart" watermark.
