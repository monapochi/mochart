export type I18nStrings = Record<string, { en: string; ja: string }>;

export const INDICATOR_I18N: I18nStrings = {
  'indicator.bb.name': { en: 'Bollinger Bands', ja: 'ボリンジャーバンド' },
  'indicator.rsi.name': { en: 'RSI', ja: 'RSI（相対力指数）' },
  'indicator.adx.name': { en: 'ADX', ja: 'ADX（平均方向性指数）' },
  'indicator.macd.name': { en: 'MACD', ja: 'MACD' },
  'indicator.atr.name': { en: 'ATR', ja: 'ATR' },
  'indicator.volume.name': { en: 'Volume', ja: '出来高' },
};

export const t = (key: string, locale: 'en' | 'ja' = 'ja'): string => {
  return INDICATOR_I18N[key]?.[locale] ?? key;
};
