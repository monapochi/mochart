/**
 * chart_host_lp.js — Landing Page chart host through the public Mochart API.
 *
 * This file intentionally does not talk to demo workers directly.
 * It loads the npm-like library bundle copied into docs/lib/ and validates that
 * the LP can run through createChart() just like an external consumer.
 */

const LP_BUILD_VERSION = '20260310a';
const PERF_INTERVAL_MS = 250;
const DEFAULT_VISIBLE_BARS = 200;
const DEFAULT_PANES = { gap: 2, weights: [7, 1.5, 1.5] };
const COLOR_SMA_1 = [0.121, 0.466, 0.705, 1.0];
const COLOR_SMA_2 = [1.0, 0.498, 0.054, 1.0];
const COLOR_SMA_3 = [0.173, 0.627, 0.173, 1.0];
const COLOR_RSI = [0.58, 0.2, 0.89, 1.0];
const COLOR_MACD = [0.98, 0.75, 0.18, 1.0];
const COLOR_VOLUME = [0.45, 0.68, 0.94, 0.72];

async function loadMochartModule() {
  const candidates = [
    new URL('../lib/index.js', import.meta.url).href,
    new URL('../../dist/index.js', import.meta.url).href,
  ];

  let lastError = null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      return await import(candidates[i]);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Failed to load Mochart public bundle');
}

function createIndicatorConfigs(Mochart) {
  return [
    {
      kind: Mochart.IndicatorKind.SMA,
      period: 5,
      pane: 'main',
      style: Mochart.RenderStyle.ThickLine,
      color: COLOR_SMA_1,
      lineWidth: 1.75,
      enabled: true,
    },
    {
      kind: Mochart.IndicatorKind.SMA,
      period: 25,
      pane: 'main',
      style: Mochart.RenderStyle.ThickLine,
      color: COLOR_SMA_2,
      lineWidth: 1.75,
      enabled: true,
    },
    {
      kind: Mochart.IndicatorKind.SMA,
      period: 75,
      pane: 'main',
      style: Mochart.RenderStyle.ThickLine,
      color: COLOR_SMA_3,
      lineWidth: 1.75,
      enabled: true,
    },
    {
      kind: Mochart.IndicatorKind.RSI,
      period: 14,
      pane: 'sub1',
      style: Mochart.RenderStyle.ThickLine,
      color: COLOR_RSI,
      lineWidth: 1.5,
      enabled: true,
    },
    {
      kind: Mochart.IndicatorKind.MACD,
      period: 12,
      slow: 26,
      signal: 9,
      pane: 'sub1',
      style: Mochart.RenderStyle.ThickLine,
      color: COLOR_MACD,
      lineWidth: 1.5,
      enabled: true,
    },
    {
      kind: Mochart.IndicatorKind.Volume,
      period: 1,
      pane: 'sub2',
      style: Mochart.RenderStyle.Histogram,
      color: COLOR_VOLUME,
      lineWidth: 1.0,
      enabled: true,
    },
  ];
}

async function init() {
  window._lpOnProgress?.(20, 'Loading Mochart public bundle…');

  const hero = document.getElementById('hero');
  if (!(hero instanceof HTMLElement)) {
    throw new Error('hero container not found');
  }

  const chartRoot = document.getElementById('chart-host');
  if (!(chartRoot instanceof HTMLElement)) {
    throw new Error('chart host not found');
  }

  const Mochart = await loadMochartModule();
  window._lpOnProgress?.(45, 'Starting worker-backed chart…');

  const chart = Mochart.createChart(chartRoot, {
    renderer: 'canvas-worker',
    dataUrl: new URL('../MSFT.bin', import.meta.url).href,
    visibleBars: DEFAULT_VISIBLE_BARS,
    panes: DEFAULT_PANES,
  });

  const indicatorConfigs = createIndicatorConfigs(Mochart);
  for (let i = 0; i < indicatorConfigs.length; i++) {
    chart.addIndicator(indicatorConfigs[i]);
  }

  chart.setPaneConfig(DEFAULT_PANES);
  window._lpOnProgress?.(70, 'Fetching binary OHLCV and warming workers…');

  let ready = false;
  chart.on('viewportChange', (event) => {
    if (ready || event.totalBars < 1) return;
    ready = true;
    window._lpOnReady?.(event.totalBars);
  });

  const perfTimer = window.setInterval(() => {
    const perf = chart.getPerformanceMetrics();
    if (perf?.frame?.ewma && perf.frame.ewma > 0) {
      window._lpOnPerf?.(1000 / perf.frame.ewma, perf.frame.ewma);
    }

    if (!ready) {
      const range = chart.getVisibleRangeView();
      const totalBars = range[2];
      if (totalBars > 0) {
        ready = true;
        window._lpOnReady?.(totalBars);
      }
    }
  }, PERF_INTERVAL_MS);

  window.addEventListener('beforeunload', () => {
    window.clearInterval(perfTimer);
    chart.destroy();
  }, { once: true });

  console.log('[lp_host] ready via public createChart()', { build: LP_BUILD_VERSION });
}


init().catch((error) => {
  console.error('[lp_host] init failed:', error);
  window._lpOnProgress?.(100, 'Failed to start Mochart demo');
});
