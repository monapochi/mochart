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

export const SMA: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'sma',
  name: 'SMA',
  category: 'trend',
  pane: 'main',
  outputs: [{ name: 'sma', color: '#4ECDC4', style: 'line', lineWidth: 1, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', min: 2, max: 200 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const sma: IndicatorValue[] = [];
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= period) sum -= data[i - period].close;
        if (i < period - 1) {
          sma.push(null);
        } else {
          sma.push(sum / period);
        }
      }
      return ok({ sma });
    } catch (e) {
      return fail(String(e));
    }
  },
  wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      if (idx < params.period - 1u) {
        output[idx] = bitcast<f32>(0x7FC00000u);
        return;
      }
      var sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        sum += ohlcv[close_idx];
      }
      output[idx] = sum / f32(params.period);
    }
  `,
};

export const EMA: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'ema',
  name: 'EMA',
  category: 'trend',
  pane: 'main',
  outputs: [{ name: 'ema', color: '#FFB703', style: 'line', lineWidth: 1, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', min: 2, max: 200 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const ema: IndicatorValue[] = [];
      const k = 2 / (period + 1);
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          ema.push(data[i].close);
          continue;
        }
        const prev = ema[i - 1] ?? data[i - 1].close;
        ema.push(data[i].close * k + (prev as number) * (1 - k));
      }
      for (let i = 0; i < period - 1; i++) {
        ema[i] = null;
      }
      return ok({ ema });
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
      let n = params.data_len;
      if (n == 0u) { return; }
      let k = 2.0 / (f32(params.period) + 1.0);
      output[0u] = ohlcv[4u];
      for (var i: u32 = 1u; i < n; i++) {
        let close = ohlcv[i * 6u + 4u];
        output[i] = close * k + output[i - 1u] * (1.0 - k);
      }
      for (var i: u32 = 0u; i < params.period - 1u && i < n; i++) {
        output[i] = bitcast<f32>(0x7FC00000u);
      }
    }
  `,
};

export const BollingerBands: IndicatorDefinition<{ period: number; stdDev: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'bb',
  name: 'Bollinger Bands',
  category: 'volatility',
  pane: 'main',
  outputs: [
    { name: 'upper', color: '#2196F3', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'middle', color: '#9E9E9E', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'lower', color: '#2196F3', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'fill', color: 'rgba(33,150,243,0.1)', style: 'band', fillTo: 'lower', zLayer: 10 },
  ],
  params: {
    period: { type: 'number', default: 20, label: 'Period', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', min: 0.5, max: 4.0, step: 0.1 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev }) {
    try {
      const upper: IndicatorValue[] = [];
      const middle: IndicatorValue[] = [];
      const lower: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          upper.push(null);
          middle.push(null);
          lower.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        middle.push(sma);
        upper.push(sma + stdDev * std);
        lower.push(sma - stdDev * std);
      }
      return ok({ upper, middle, lower, fill: upper });
    } catch (e) {
      return fail(String(e));
    }
  },
  wgslSource: `
    struct Params { period: u32, std_dev: f32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      if (idx < params.period - 1u) {
        output[idx * 3u + 0u] = bitcast<f32>(0x7FC00000u);
        output[idx * 3u + 1u] = bitcast<f32>(0x7FC00000u);
        output[idx * 3u + 2u] = bitcast<f32>(0x7FC00000u);
        return;
      }
      var sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        sum += ohlcv[close_idx];
      }
      let sma = sum / f32(params.period);
      var var_sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        let diff = ohlcv[close_idx] - sma;
        var_sum += diff * diff;
      }
      let std = sqrt(var_sum / f32(params.period));
      output[idx * 3u + 0u] = sma + params.std_dev * std;
      output[idx * 3u + 1u] = sma;
      output[idx * 3u + 2u] = sma - params.std_dev * std;
    }
  `,
};

export const Volume: IndicatorDefinition<{ maPeriod: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'volume',
  name: 'Volume',
  category: 'volume',
  pane: 'sub1',
  outputs: [
    { name: 'volume', color: '#90CAF9', style: 'bar', opacity: 0.8, zLayer: 20 },
    { name: 'volumeMA', color: '#1565C0', style: 'line', lineWidth: 1, zLayer: 30 },
  ],
  params: {
    maPeriod: { type: 'number', default: 20, label: 'MA Period', min: 5, max: 50 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ maPeriod }) => maPeriod - 1,
  calculate(data, { maPeriod }) {
    try {
      const volume: IndicatorValue[] = data.map((d) => d.volume);
      const volumeMA: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < maPeriod - 1) {
          volumeMA.push(null);
        } else {
          const slice = data.slice(i - maPeriod + 1, i + 1);
          const avg = slice.reduce((a, b) => a + b.volume, 0) / maPeriod;
          volumeMA.push(avg);
        }
      }
      return ok({ volume, volumeMA });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const PivotPoints: IndicatorDefinition<{}, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'pivot_points',
  name: 'Pivot Points',
  category: 'trend',
  pane: 'main',
  outputs: [
    { name: 'pivot', color: '#607D8B', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'r1', color: '#8BC34A', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 's1', color: '#F44336', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'r2', color: '#4CAF50', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 's2', color: '#E57373', style: 'line', lineWidth: 1, zLayer: 30 },
  ],
  params: {},
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: () => 1,
  calculate(data) {
    try {
      const pivot: IndicatorValue[] = [];
      const r1: IndicatorValue[] = [];
      const s1: IndicatorValue[] = [];
      const r2: IndicatorValue[] = [];
      const s2: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          pivot.push(null);
          r1.push(null);
          s1.push(null);
          r2.push(null);
          s2.push(null);
          continue;
        }
        const prev = data[i - 1];
        const p = (prev.high + prev.low + prev.close) / 3;
        const r1v = 2 * p - prev.low;
        const s1v = 2 * p - prev.high;
        const r2v = p + (prev.high - prev.low);
        const s2v = p - (prev.high - prev.low);
        pivot.push(p);
        r1.push(r1v);
        s1.push(s1v);
        r2.push(r2v);
        s2.push(s2v);
      }
      return ok({ pivot, r1, s1, r2, s2 });
    } catch (e) {
      return fail(String(e));
    }
  },
};

export const Phase1Indicators = [Volume, SMA, EMA, BollingerBands, PivotPoints] as const;

export const registerPhase1Indicators = (registry: IndicatorRegistry): void => {
  Phase1Indicators.forEach((indicator) => registry.register(indicator as IndicatorDefinition<any, any>));
};
