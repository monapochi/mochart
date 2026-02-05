import type { OhlcvPoint } from '../core/types';
import type {
  IndicatorDefinition,
  IndicatorResult,
  IndicatorValue,
  MultiSeriesOutput,
} from '../core/indicatorTypes';
import { SCHEMA_VERSION } from '../core/indicatorTypes';
import type { IndicatorRegistry } from '../core/indicators';

const ok = (value: MultiSeriesOutput): IndicatorResult<MultiSeriesOutput> => ({ ok: true, value });
const fail = (message: string): IndicatorResult<MultiSeriesOutput> => ({
  ok: false,
  error: { code: 'COMPUTATION_ERROR', message },
});

export const OBV: IndicatorDefinition<{}, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'obv',
  name: 'OBV',
  nameKey: 'indicator.obv.name',
  category: 'volume',
  pane: 'sub1',
  outputs: [{ name: 'obv', color: '#3F51B5', style: 'line', lineWidth: 1.2, zLayer: 30 }],
  params: {},
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: () => 1,
  calculate(data) {
    try {
      const obv: IndicatorValue[] = [];
      let current = 0;
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          obv.push(null);
          continue;
        }
        if (data[i].close > data[i - 1].close) {
          current += data[i].volume;
        } else if (data[i].close < data[i - 1].close) {
          current -= data[i].volume;
        }
        obv.push(current);
      }
      return ok({ obv });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const CMF: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'cmf',
  name: 'CMF',
  nameKey: 'indicator.cmf.name',
  category: 'volume',
  pane: 'sub1',
  outputs: [{ name: 'cmf', color: '#8BC34A', style: 'line', lineWidth: 1.2, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 21, label: 'Period', min: 2, max: 200 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const cmf: IndicatorValue[] = [];
      let sumMFV = 0;
      let sumVol = 0;
      for (let i = 0; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const close = data[i].close;
        const volume = data[i].volume;
        const range = high - low;
        const mfm = range === 0 ? 0 : ((close - low) - (high - close)) / range;
        const mfv = mfm * volume;
        sumMFV += mfv;
        sumVol += volume;
        if (i >= period) {
          const prev = data[i - period];
          const prevRange = prev.high - prev.low;
          const prevMfm = prevRange === 0 ? 0 : ((prev.close - prev.low) - (prev.high - prev.close)) / prevRange;
          sumMFV -= prevMfm * prev.volume;
          sumVol -= prev.volume;
        }
        if (i < period - 1 || sumVol === 0) {
          cmf.push(null);
        } else {
          cmf.push(sumMFV / sumVol);
        }
      }
      return ok({ cmf });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const MFI: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'mfi',
  nameKey: 'indicator.mfi.name',
  name: 'MFI',
  category: 'volume',
  pane: 'sub1',
  outputs: [{ name: 'mfi', color: '#FF7043', style: 'line', lineWidth: 1.2, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 14, label: 'Period', min: 2, max: 200 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const mfi: IndicatorValue[] = [];
      let posSum = 0;
      let negSum = 0;
      const typicalPrices = data.map((d) => (d.high + d.low + d.close) / 3);
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          mfi.push(null);
          continue;
        }
        const tp = typicalPrices[i];
        const prevTp = typicalPrices[i - 1];
        const mf = tp * data[i].volume;
        if (tp > prevTp) posSum += mf;
        else if (tp < prevTp) negSum += mf;

        if (i >= period) {
          const oldTp = typicalPrices[i - period];
          const oldPrevTp = typicalPrices[i - period - 1];
          const oldMf = oldTp * data[i - period].volume;
          if (oldTp > oldPrevTp) posSum -= oldMf;
          else if (oldTp < oldPrevTp) negSum -= oldMf;
        }

        if (i < period) {
          mfi.push(null);
        } else {
          const ratio = negSum === 0 ? 100 : posSum / negSum;
          mfi.push(100 - 100 / (1 + ratio));
        }
      }
      return ok({ mfi });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const KaufmanPatterns: IndicatorDefinition<{}, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  nameKey: 'indicator.kaufman_patterns.name',
  id: 'kaufman_patterns',
  name: 'Kaufman Patterns',
  category: 'custom',
  pane: 'main',
  outputs: [{ name: 'kaufman', color: '#FFC107', style: 'marker', zLayer: 40 }],
  params: {},
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: () => 2,
  calculate() {
    return ok({ kaufman: [] });
  },
};

export const SqueezeAlert: IndicatorDefinition<{ period: number; stdDev: number; threshold: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'squeeze_alert',
  name: 'Squeeze Alert',
  nameKey: 'indicator.squeeze_alert.name',
  category: 'volatility',
  pane: 'main',
  outputs: [{ name: 'squeeze', color: '#FF9800', style: 'marker', zLayer: 40 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', min: 0.5, max: 4.0, step: 0.1 },
    threshold: { type: 'number', default: 0.04, label: 'Threshold', min: 0.01, max: 0.2, step: 0.01 },
  },
  alerts: [
    {
      id: 'squeeze_found',
      name: 'Squeeze Detected',
      severity: 'warning',
      cooldown: 60,
      condition: (values) => values['squeeze'] !== null,
      message: (values, bar: any) => `Squeeze detected at price ${bar.close}`,
    },
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev, threshold }) {
    try {
      const squeeze: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          squeeze.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        const width = sma > 0 ? (upper - lower) / sma : 0;
        squeeze.push(width < threshold ? data[i].close : null);
      }
      return ok({ squeeze });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const Divergence: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'divergence',
  name: 'Divergence',
  nameKey: 'indicator.divergence.name',
  category: 'custom',
  pane: 'main',
  outputs: [{ name: 'divergence', color: '#FFC107', style: 'marker', zLayer: 40 }],
  params: {
    period: { type: 'number', default: 14, label: 'Period', min: 2, max: 50 },
  },
  alerts: [
    {
      id: 'divergence_found',
      name: 'Divergence Detected',
      severity: 'warning',
      cooldown: 60,
      condition: (values) => values['divergence'] !== null,
      message: (values, bar: any) => `Divergence detected at price ${bar.close}`,
    },
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const rsi: number[] = [];
      let avgGain = 0;
      let avgLoss = 0;
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          rsi.push(NaN);
          continue;
        }
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i < period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          rsi.push(NaN);
        } else if (i === period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        } else {
          avgGain = (avgGain * (period - 1) + gain) / period;
          avgLoss = (avgLoss * (period - 1) + loss) / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        }
      }
      const divergence: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period + 2) {
          divergence.push(null);
          continue;
        }
        const prev = i - 2;
        const priceHigher = data[i].close > data[prev].close;
        const rsiLower = rsi[i] < rsi[prev];
        divergence.push(priceHigher && rsiLower ? data[i].close : null);
      }
      return ok({ divergence });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const Phase4Indicators = [OBV, CMF, MFI, KaufmanPatterns, SqueezeAlert, Divergence] as const;

export const registerPhase4Indicators = (registry: IndicatorRegistry): void => {
  Phase4Indicators.forEach((indicator) => registry.register(indicator as IndicatorDefinition<any, any>));
};
