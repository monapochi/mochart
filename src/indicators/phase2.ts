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

export const RSI: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'rsi',
  name: 'RSI',
  nameKey: 'indicator.rsi.name',
  category: 'momentum',
  pane: 'sub1',
  outputs: [{ name: 'rsi', color: '#9C27B0', style: 'line', lineWidth: 1.5, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 14, label: 'Period', min: 2, max: 50 },
  },
  yRange: { min: 0, max: 100 },
  horizontalLines: [
    { value: 70, color: '#F44336', dashed: true },
    { value: 30, color: '#4CAF50', dashed: true },
    { value: 50, color: '#9E9E9E', dashed: true },
  ],
  complexity: { time: 'O(n)', space: 'O(1)' },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const rsi: IndicatorValue[] = [];
      let avgGain = 0;
      let avgLoss = 0;
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          rsi.push(null);
          continue;
        }
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i < period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          rsi.push(null);
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
      return ok({ rsi });
    } catch (e) {
      return fail(String(e));
    }
  },
  wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      var avg_gain: f32 = 0.0;
      var avg_loss: f32 = 0.0;
      if (n <= period + 1u) { return; }
      for (var i: u32 = 1u; i <= period; i++) {
        let change = ohlcv[i * 6u + 4u] - ohlcv[(i - 1u) * 6u + 4u];
        if (change > 0.0) { avg_gain += change; }
        else { avg_loss -= change; }
      }
      avg_gain /= f32(period);
      avg_loss /= f32(period);
      for (var i: u32 = 0u; i < period; i++) {
        output[i] = bitcast<f32>(0x7FC00000u);
      }
      let rs0 = select(avg_gain / avg_loss, 100.0, avg_loss == 0.0);
      output[period] = 100.0 - 100.0 / (1.0 + rs0);
      for (var i: u32 = period + 1u; i < n; i++) {
        let change = ohlcv[i * 6u + 4u] - ohlcv[(i - 1u) * 6u + 4u];
        let gain = max(change, 0.0);
        let loss = max(-change, 0.0);
        avg_gain = (avg_gain * f32(period - 1u) + gain) / f32(period);
        avg_loss = (avg_loss * f32(period - 1u) + loss) / f32(period);
        let rs = select(avg_gain / avg_loss, 100.0, avg_loss == 0.0);
        output[i] = 100.0 - 100.0 / (1.0 + rs);
      }
    }
  `,
};

export const ATR: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'atr',
  name: 'ATR',
  nameKey: 'indicator.atr.name',
  category: 'volatility',
  pane: 'sub1',
  outputs: [{ name: 'atr', color: '#795548', style: 'line', lineWidth: 1.5, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 14, label: 'Period', min: 5, max: 50 },
  },
  complexity: { time: 'O(n)', space: 'O(1)' },
  warmupPeriod: ({ period }) => period,
  calculate(data, { period }) {
    try {
      const atr: IndicatorValue[] = [];
      let atrSum = 0;
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          atr.push(null);
          continue;
        }
        const tr = Math.max(
          data[i].high - data[i].low,
          Math.abs(data[i].high - data[i - 1].close),
          Math.abs(data[i].low - data[i - 1].close)
        );
        if (i < period) {
          atrSum += tr;
          atr.push(null);
        } else if (i === period) {
          atrSum += tr;
          atr.push(atrSum / period);
        } else {
          const prevATR = (atr[i - 1] ?? 0) as number;
          atr.push((prevATR * (period - 1) + tr) / period);
        }
      }
      return ok({ atr });
    } catch (e) {
      return fail(String(e));
    }
  },
  wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      if (n == 0u) { return; }
      output[0u] = bitcast<f32>(0x7FC00000u);
      var atr_sum: f32 = 0.0;
      for (var i: u32 = 1u; i < n; i++) {
        let high = ohlcv[i * 6u + 2u];
        let low = ohlcv[i * 6u + 3u];
        let prev_close = ohlcv[(i - 1u) * 6u + 4u];
        let tr = max(high - low, max(abs(high - prev_close), abs(low - prev_close)));
        if (i < period) {
          atr_sum += tr;
          output[i] = bitcast<f32>(0x7FC00000u);
        } else if (i == period) {
          atr_sum += tr;
          output[i] = atr_sum / f32(period);
        } else {
          let prev_atr = output[i - 1u];
          output[i] = (prev_atr * f32(period - 1u) + tr) / f32(period);
        }
      }
    }
  `,
};

export const MACD: IndicatorDefinition<
  { fastPeriod: number; slowPeriod: number; signalPeriod: number },
  OhlcvPoint
> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'macd',
  nameKey: 'indicator.macd.name',
  name: 'MACD',
  category: 'momentum',
  pane: 'sub2',
  dependencies: ['ema'],
  outputs: [
    { name: 'macd', color: '#2196F3', style: 'line', lineWidth: 1.5, zLayer: 30 },
    { name: 'signal', color: '#FF9800', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'histogram', color: '#4CAF50', style: 'histogram', opacity: 0.7, zLayer: 20 },
  ],
  params: {
    fastPeriod: { type: 'number', default: 12, label: 'Fast Period', min: 2, max: 50 },
    slowPeriod: { type: 'number', default: 26, label: 'Slow Period', min: 5, max: 100 },
    signalPeriod: { type: 'number', default: 9, label: 'Signal Period', min: 2, max: 50 },
  },
  horizontalLines: [{ value: 0, color: '#9E9E9E', dashed: false }],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ slowPeriod, signalPeriod }) => slowPeriod + signalPeriod - 1,
  calculate(data, { fastPeriod, slowPeriod, signalPeriod }) {
    try {
      const ema = (values: number[], period: number): number[] => {
        const result: number[] = [];
        const k = 2 / (period + 1);
        for (let i = 0; i < values.length; i++) {
          if (i === 0) result.push(values[i]);
          else result.push(values[i] * k + result[i - 1] * (1 - k));
        }
        return result;
      };
      const closes = data.map((d) => d.close);
      const fastEma = ema(closes, fastPeriod);
      const slowEma = ema(closes, slowPeriod);
      const macdLine = fastEma.map((f, i) => f - slowEma[i]);
      const signalLine = ema(macdLine, signalPeriod);
      const histogram = macdLine.map((m, i) => m - signalLine[i]);
      const warmup = slowPeriod + signalPeriod - 1;
      return ok({
        macd: macdLine.map((v, i) => (i < warmup ? null : v)),
        signal: signalLine.map((v, i) => (i < warmup ? null : v)),
        histogram: histogram.map((v, i) => (i < warmup ? null : v)),
      });
    } catch (e) {
      return fail(String(e));
    }
  },
  wgslSource: `
    struct Params { fast: u32, slow: u32, signal: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>; // macd, signal, hist packed
    @compute @workgroup_size(1)
    fn main() {
      let n = params.data_len;
      if (n == 0u) { return; }
      let k_fast = 2.0 / (f32(params.fast) + 1.0);
      let k_slow = 2.0 / (f32(params.slow) + 1.0);
      let k_sig = 2.0 / (f32(params.signal) + 1.0);
      var ema_fast: f32 = ohlcv[4u];
      var ema_slow: f32 = ohlcv[4u];
      var sig: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        let close = ohlcv[i * 6u + 4u];
        if (i > 0u) {
          ema_fast = close * k_fast + ema_fast * (1.0 - k_fast);
          ema_slow = close * k_slow + ema_slow * (1.0 - k_slow);
        }
        let macd = ema_fast - ema_slow;
        if (i == 0u) {
          sig = macd;
        } else {
          sig = macd * k_sig + sig * (1.0 - k_sig);
        }
        let hist = macd - sig;
        output[i * 3u + 0u] = macd;
        output[i * 3u + 1u] = sig;
        output[i * 3u + 2u] = hist;
      }
      let warmup = params.slow + params.signal - 1u;
      for (var i: u32 = 0u; i < warmup && i < n; i++) {
        output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
        output[i * 3u + 1u] = bitcast<f32>(0x7FC00000u);
        output[i * 3u + 2u] = bitcast<f32>(0x7FC00000u);
      }
    }
  `,
};

export const ADX: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'adx',
  nameKey: 'indicator.adx.name',
  name: 'ADX',
  category: 'trend',
  pane: 'sub1',
  outputs: [
    { name: 'adx', color: '#FF5722', style: 'line', lineWidth: 2, zLayer: 30 },
    { name: 'plusDI', color: '#4CAF50', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'minusDI', color: '#F44336', style: 'line', lineWidth: 1, zLayer: 30 },
  ],
  params: {
    period: { type: 'number', default: 14, label: 'Period', min: 5, max: 50 },
  },
  yRange: { min: 0, max: 100 },
  horizontalLines: [
    { value: 25, color: '#9E9E9E', dashed: true },
    { value: 50, color: '#FF9800', dashed: true },
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period * 2 - 1,
  calculate(data, { period }) {
    try {
      const adx: IndicatorValue[] = [];
      const plusDI: IndicatorValue[] = [];
      const minusDI: IndicatorValue[] = [];
      const tr: number[] = [];
      const plusDM: number[] = [];
      const minusDM: number[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          tr.push(data[i].high - data[i].low);
          plusDM.push(0);
          minusDM.push(0);
          adx.push(null);
          plusDI.push(null);
          minusDI.push(null);
          continue;
        }
        const high = data[i].high;
        const low = data[i].low;
        const prevHigh = data[i - 1].high;
        const prevLow = data[i - 1].low;
        const prevClose = data[i - 1].close;
        const trValue = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        tr.push(trValue);
        const upMove = high - prevHigh;
        const downMove = prevLow - low;
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        if (i < period) {
          adx.push(null);
          plusDI.push(null);
          minusDI.push(null);
          continue;
        }
        let smoothTR = 0;
        let smoothPlusDM = 0;
        let smoothMinusDM = 0;
        if (i === period) {
          for (let j = 1; j <= period; j++) {
            smoothTR += tr[j];
            smoothPlusDM += plusDM[j];
            smoothMinusDM += minusDM[j];
          }
        } else {
          const prevSmoothTR = tr.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothTR = prevSmoothTR - prevSmoothTR / period + tr[i];
          const prevSmoothPlusDM = plusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothPlusDM = prevSmoothPlusDM - prevSmoothPlusDM / period + plusDM[i];
          const prevSmoothMinusDM = minusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothMinusDM = prevSmoothMinusDM - prevSmoothMinusDM / period + minusDM[i];
        }
        const pdi = smoothTR > 0 ? (100 * smoothPlusDM) / smoothTR : 0;
        const mdi = smoothTR > 0 ? (100 * smoothMinusDM) / smoothTR : 0;
        plusDI.push(pdi);
        minusDI.push(mdi);
        const diSum = pdi + mdi;
        const dx = diSum > 0 ? (100 * Math.abs(pdi - mdi)) / diSum : 0;
        if (i < period * 2 - 1) {
          adx.push(null);
        } else if (i === period * 2 - 1) {
          let dxSum = 0;
          for (let j = period; j < period * 2; j++) {
            const pdiJ = plusDI[j] ?? 0;
            const mdiJ = minusDI[j] ?? 0;
            const sumJ = pdiJ + mdiJ;
            dxSum += sumJ > 0 ? (100 * Math.abs(pdiJ - mdiJ)) / sumJ : 0;
          }
          adx.push(dxSum / period);
        } else {
          const prevADX = (adx[i - 1] ?? 0) as number;
          adx.push((prevADX * (period - 1) + dx) / period);
        }
      }
      return ok({ adx, plusDI, minusDI });
    } catch (e) {
      return fail(String(e));
    }
  },
  wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>; // adx, plusDI, minusDI packed
    @compute @workgroup_size(1)
    fn main() {
      let n = params.data_len;
      if (n == 0u) { return; }
      var smooth_tr: f32 = 0.0;
      var smooth_plus: f32 = 0.0;
      var smooth_minus: f32 = 0.0;
      var prev_adx: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        if (i == 0u) {
          output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 1u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 2u] = bitcast<f32>(0x7FC00000u);
          continue;
        }
        let high = ohlcv[i * 6u + 2u];
        let low = ohlcv[i * 6u + 3u];
        let prev_high = ohlcv[(i - 1u) * 6u + 2u];
        let prev_low = ohlcv[(i - 1u) * 6u + 3u];
        let prev_close = ohlcv[(i - 1u) * 6u + 4u];
        let tr = max(high - low, max(abs(high - prev_close), abs(low - prev_close)));
        let up_move = high - prev_high;
        let down_move = prev_low - low;
        let plus_dm = select(up_move, 0.0, up_move > down_move && up_move > 0.0);
        let minus_dm = select(down_move, 0.0, down_move > up_move && down_move > 0.0);
        if (i <= params.period) {
          smooth_tr += tr;
          smooth_plus += plus_dm;
          smooth_minus += minus_dm;
          output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 1u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 2u] = bitcast<f32>(0x7FC00000u);
          continue;
        }
        smooth_tr = smooth_tr - (smooth_tr / f32(params.period)) + tr;
        smooth_plus = smooth_plus - (smooth_plus / f32(params.period)) + plus_dm;
        smooth_minus = smooth_minus - (smooth_minus / f32(params.period)) + minus_dm;
        let pdi = select((100.0 * smooth_plus) / smooth_tr, 0.0, smooth_tr == 0.0);
        let mdi = select((100.0 * smooth_minus) / smooth_tr, 0.0, smooth_tr == 0.0);
        let di_sum = pdi + mdi;
        let dx = select((100.0 * abs(pdi - mdi)) / di_sum, 0.0, di_sum == 0.0);
        if (i < params.period * 2u - 1u) {
          output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
        } else if (i == params.period * 2u - 1u) {
          prev_adx = dx;
          output[i * 3u + 0u] = prev_adx;
        } else {
          prev_adx = (prev_adx * f32(params.period - 1u) + dx) / f32(params.period);
          output[i * 3u + 0u] = prev_adx;
        }
        output[i * 3u + 1u] = pdi;
        output[i * 3u + 2u] = mdi;
      }
    }
  `,
};

export const TradeMarkers: IndicatorDefinition<{}, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  nameKey: 'indicator.trade_markers.name',
  id: 'trade_markers',
  name: 'Trade Markers',
  category: 'custom',
  pane: 'main',
  outputs: [{ name: 'markers', color: '#FFC107', style: 'marker', zLayer: 40 }],
  params: {},
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: () => 0,
  calculate() {
    return ok({ markers: [] });
  },
};

export const Phase2Indicators = [RSI, ADX, ATR, MACD, TradeMarkers] as const;

export const registerPhase2Indicators = (registry: IndicatorRegistry): void => {
  Phase2Indicators.forEach((indicator) => registry.register(indicator as IndicatorDefinition<any, any>));
};
