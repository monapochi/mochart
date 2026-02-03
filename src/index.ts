export { createEmbedAPI } from './core/embedApi';
export { ChartCore } from './core/chart';

// Export embed API types
export type { ChartEmbedAPI, EventHandler } from './core/embedApi';
// Convenience default export
export default {
  createEmbedAPI: (await import('./core/embedApi')).createEmbedAPI
};
export { MoChart } from './core/chart';
export type { ChartConfig, ChartOptions, OhlcvPoint, IndicatorInstance } from './core/types';
export type {
	IndicatorDefinition,
	IndicatorError,
	IndicatorParamSchema,
	IndicatorResult,
	IndicatorValue,
	MultiSeriesOutput,
	PlotPane,
	PlotStyle,
	SeriesStyle,
} from './core/indicatorTypes';
export type { TradeMarker, TradeMarkerType } from './core/tradeMarkers';
export { DEFAULT_MARKER_STYLES } from './core/tradeMarkers';
export { INDICATOR_I18N, t } from './core/i18n';
export { INDICATOR_PHASES } from './core/indicatorCatalog';
export {
	BollingerBands,
	EMA,
	Phase1Indicators,
	PivotPoints,
	SMA,
	Volume,
	registerPhase1Indicators,
} from './indicators/phase1';
export {
	BBWidth,
	PercentB,
	Phase3Indicators,
	VWAP,
	VolRatio,
	registerPhase3Indicators,
} from './indicators/phase3';
export {
	ADX,
	ATR,
	MACD,
	Phase2Indicators,
	RSI,
	TradeMarkers,
	registerPhase2Indicators,
} from './indicators/phase2';
export {
	CMF,
	Divergence,
	MFI,
	OBV,
	KaufmanPatterns,
	Phase4Indicators,
	SqueezeAlert,
	registerPhase4Indicators,
} from './indicators/phase4';
export { InMemoryIndicatorRegistry } from './core/indicators';
