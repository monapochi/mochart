import { createEmbedAPI } from '../core/embedApi';
import MSFT from '../../fixtures/MSFT.json';

async function init() {
  console.log('Initializing Mochart Demo...');
  const container = document.querySelector('div.chart') as HTMLElement;
  if (!container) {
    console.error('Container not found');
    return;
  }

  // Clear any existing canvas (if any placeholder exists)
  // container.innerHTML = ''; 

  try {
    const embed = createEmbedAPI();
    const core = await embed.create(container, { enableTooltip: true, showLegend: true, symbol: 'MSFT' });
    
    const seriesId = await core.addSeries({ 
      id: 'msft', 
      type: 'candlestick', 
      name: 'MSFT', 
      upColor: '#2e7d32', 
      downColor: '#d32f2f', 
      outlineColor: '#222222' 
    });

    const data = (MSFT as any).default ?? MSFT;
    if (Array.isArray(data)) {
      await core.setSeriesData(seriesId, data);
      console.log(`Loaded ${data.length} candlesticks`);
    } else {
      console.error('Invalid fixture data format');
    }

    // Expose for debugging
    (window as any).__demoEmbed = embed;
    (window as any).__demoChartCore = core;
    
  } catch (e) {
    console.error('Failed to initialize chart:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
