export type I18nStrings = Record<string, { en: string; ja: string }>;

export const INDICATOR_I18N: I18nStrings = {
  // Phase 1
  'indicator.sma.name': { en: 'SMA', ja: '単純移動平均 (SMA)' },
  'indicator.sma.param.period': { en: 'Period', ja: '期間' },
  'indicator.ema.name': { en: 'EMA', ja: '指数平滑移動平均 (EMA)' },
  'indicator.ema.param.period': { en: 'Period', ja: '期間' },
  'indicator.bb.name': { en: 'Bollinger Bands', ja: 'ボリンジャーバンド' },
  'indicator.bb.param.period': { en: 'Period', ja: '期間' },
  'indicator.bb.param.stdDev': { en: 'Std Dev', ja: '標準偏差' },
  'indicator.volume.name': { en: 'Volume', ja: '出来高' },
  'indicator.volume.param.maPeriod': { en: 'MA Period', ja: 'MA期間' },
  'indicator.pivot_points.name': { en: 'Pivot Points', ja: 'ピボットポイント' },

  // Phase 2
  'indicator.rsi.name': { en: 'RSI', ja: 'RSI (相対力指数)' },
  'indicator.rsi.param.period': { en: 'Period', ja: '期間' },
  'indicator.atr.name': { en: 'ATR', ja: 'ATR (平均真の範囲)' },
  'indicator.atr.param.period': { en: 'Period', ja: '期間' },
  'indicator.macd.name': { en: 'MACD', ja: 'MACD' },
  'indicator.macd.param.fastPeriod': { en: 'Fast Period', ja: '短期期間' },
  'indicator.macd.param.slowPeriod': { en: 'Slow Period', ja: '長期期間' },
  'indicator.macd.param.signalPeriod': { en: 'Signal Period', ja: 'シグナル期間' },
  'indicator.adx.name': { en: 'ADX', ja: 'ADX (平均方向性指数)' },
  'indicator.adx.param.period': { en: 'Period', ja: '期間' },
  'indicator.trade_markers.name': { en: 'Trade Markers', ja: 'トレードマーカー' },

  // Phase 3
  'indicator.vwap.name': { en: 'VWAP', ja: '出来高加重平均価格 (VWAP)' },
  'indicator.vwap.param.period': { en: 'Period', ja: '期間' },
  'indicator.vol_ratio.name': { en: 'Vol Ratio', ja: '出来高比率' },
  'indicator.vol_ratio.param.period': { en: 'Period', ja: '期間' },
  'indicator.percent_b.name': { en: '%B', ja: '%B' },
  'indicator.percent_b.param.period': { en: 'Period', ja: '期間' },
  'indicator.percent_b.param.stdDev': { en: 'Std Dev', ja: '標準偏差' },
  'indicator.bb_width.name': { en: 'BB Width', ja: 'バンド幅' },
  'indicator.bb_width.param.period': { en: 'Period', ja: '期間' },
  'indicator.bb_width.param.stdDev': { en: 'Std Dev', ja: '標準偏差' },

  // Phase 4
  'indicator.obv.name': { en: 'OBV', ja: 'オンバランスボリューム (OBV)' },
  'indicator.cmf.name': { en: 'CMF', ja: 'チャイキンマネーフロー (CMF)' },
  'indicator.cmf.param.period': { en: 'Period', ja: '期間' },
  'indicator.mfi.name': { en: 'MFI', ja: 'マネーフロー指標 (MFI)' },
  'indicator.mfi.param.period': { en: 'Period', ja: '期間' },
  'indicator.kaufman_patterns.name': { en: 'Kaufman Patterns', ja: 'カウフマン戦略' },
  'indicator.squeeze_alert.name': { en: 'Squeeze Alert', ja: 'スクイーズアラート' },
  'indicator.squeeze_alert.param.period': { en: 'Period', ja: '期間' },
  'indicator.squeeze_alert.param.stdDev': { en: 'Std Dev', ja: '標準偏差' },
  'indicator.squeeze_alert.param.threshold': { en: 'Threshold', ja: 'しきい値' },
  'indicator.divergence.name': { en: 'Divergence', ja: 'ダイバージェンス' },
  'indicator.divergence.param.period': { en: 'Period', ja: '期間' },
};

export const t = (key: string, locale: 'en' | 'ja' = 'ja'): string => {
  return INDICATOR_I18N[key]?.[locale] ?? key;
};
