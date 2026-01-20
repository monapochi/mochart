export type IndicatorPhase = 'phase1' | 'phase2' | 'phase3' | 'phase4';

export const INDICATOR_PHASES: Record<IndicatorPhase, string[]> = {
  phase1: ['volume', 'sma', 'ema', 'bb', 'candles'],
  phase2: ['rsi', 'adx', 'atr', 'macd', 'trade_markers'],
  phase3: ['vwap', 'vol_ratio', 'percent_b', 'bb_width'],
  phase4: ['obv', 'cmf', 'mfi', 'kaufman_patterns'],
};
