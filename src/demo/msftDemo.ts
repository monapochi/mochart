import { createEmbedAPI } from '../core/embedApi';

export async function runDemo(container: HTMLElement) {
  const api = createEmbedAPI();
  const core = await api.create(container, { width: container.clientWidth, height: container.clientHeight });

  const seriesId = await core.addSeries({ type: 'candlestick', name: 'MSFT' });

  // load fixture
  const resp = await fetch('/fixtures/MSFT.json');
  const data = await resp.json();

  // convert to library expected format (identity here)
  await core.setSeriesData(seriesId, data as any[]);

  return { api, seriesId };
}
