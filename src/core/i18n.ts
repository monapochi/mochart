export type I18nStrings = Record<string, { en: string; ja: string }>;

export const INDICATOR_I18N: I18nStrings = {
  'indicator.bb.name': { en: 'Bollinger Bands', ja: 'ボリンジャーバンド' },
  'indicator.rsi.name': { en: 'RSI', ja: 'RSI（相対力指数）' },
  'indicator.adx.name': { en: 'ADX', ja: 'ADX（平均方向性指数）' },
  'indicator.macd.name': { en: 'MACD', ja: 'MACD' },
  'indicator.atr.name': { en: 'ATR', ja: 'ATR' },
  'indicator.volume.name': { en: 'Volume', ja: '出来高' },
  'indicator.sma.name': { en: 'SMA', ja: '単純移動平均線' },
  'indicator.ema.name': { en: 'EMA', ja: '指数平滑移動平均線' },
  'indicator.pivot_points.name': { en: 'Pivot Points', ja: 'ピボットポイント' },
  'indicator.trade_markers.name': { en: 'Trade Markers', ja: 'トレードマーカー' },
  'indicator.vwap.name': { en: 'VWAP', ja: 'VWAP' },
  'indicator.vol_ratio.name': { en: 'Vol Ratio', ja: '出来高レシオ' },
  'indicator.percent_b.name': { en: '%B', ja: '%B' },
  'indicator.bb_width.name': { en: 'BB Width', ja: 'バンド幅' },
  'indicator.obv.name': { en: 'OBV', ja: 'オンバランスボリューム' },
  'indicator.cmf.name': { en: 'CMF', ja: 'チャイキンマネーフロー' },
  'indicator.mfi.name': { en: 'MFI', ja: 'マネーフローインデックス' },
  'indicator.kaufman_patterns.name': { en: 'Kaufman Patterns', ja: 'カウフマン・パターン' },
  'indicator.squeeze_alert.name': { en: 'Squeeze Alert', ja: 'スクイーズアラート' },
  'indicator.divergence.name': { en: 'Divergence', ja: 'ダイバージェンス' },
};

export const t = (key: string, locale: 'en' | 'ja' = 'ja'): string => {
  return INDICATOR_I18N[key]?.[locale] ?? key;
};
