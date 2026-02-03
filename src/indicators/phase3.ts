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

export const VWAP: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'vwap',
  name: 'VWAP',
  nameKey: 'indicator.vwap.name',
  category: 'volume',
  pane: 'main',
  outputs: [{ name: 'vwap', color: '#6D4C41', style: 'line', lineWidth: 1.5, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', labelKey: 'indicator.vwap.param.period', min: 2, max: 200 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const vwap: IndicatorValue[] = [];
      let pvSum = 0;
      let vSum = 0;
      for (let i = 0; i < data.length; i++) {
        const typical = (data[i].high + data[i].low + data[i].close) / 3;
        pvSum += typical * data[i].volume;
        vSum += data[i].volume;

        if (i >= period) {
          const prev = data[i - period];
          const prevTypical = (prev.high + prev.low + prev.close) / 3;
          pvSum -= prevTypical * prev.volume;
          vSum -= prev.volume;
        }

        if (i < period - 1 || vSum === 0) {
          vwap.push(null);
        } else {
          vwap.push(pvSum / vSum);
        }
      }
      return ok({ vwap });
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
      var pv_sum: f32 = 0.0;
      var v_sum: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        let high = ohlcv[i * 6u + 2u];
        let low = ohlcv[i * 6u + 3u];
        let close = ohlcv[i * 6u + 4u];
        let volume = ohlcv[i * 6u + 5u];
        let typical = (high + low + close) / 3.0;
        pv_sum += typical * volume;
        v_sum += volume;
        if (i >= period) {
          let j = i - period;
          let h = ohlcv[j * 6u + 2u];
          let l = ohlcv[j * 6u + 3u];
          let c = ohlcv[j * 6u + 4u];
          let v = ohlcv[j * 6u + 5u];
          let t = (h + l + c) / 3.0;
          pv_sum -= t * v;
          v_sum -= v;
        }
        if (i < period - 1u || v_sum == 0.0) {
          output[i] = bitcast<f32>(0x7FC00000u);
        } else {
          output[i] = pv_sum / v_sum;
        }
      }
    }
  `,
};

export const VolRatio: IndicatorDefinition<{ period: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'vol_ratio',
  name: 'Vol Ratio',
  nameKey: 'indicator.vol_ratio.name',
  category: 'volume',
  pane: 'sub1',
  outputs: [{ name: 'volRatio', color: '#00897B', style: 'line', lineWidth: 1.2, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', labelKey: 'indicator.vol_ratio.param.period', min: 2, max: 200 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period }) {
    try {
      const volRatio: IndicatorValue[] = [];
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i].volume;
        if (i >= period) sum -= data[i - period].volume;
        if (i < period - 1) {
          volRatio.push(null);
        } else {
          const avg = sum / period;
          volRatio.push(avg === 0 ? 0 : data[i].volume / avg);
        }
      }
      return ok({ volRatio });
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
      var sum: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        let vol = ohlcv[i * 6u + 5u];
        sum += vol;
        if (i >= period) {
          sum -= ohlcv[(i - period) * 6u + 5u];
        }
        if (i < period - 1u) {
          output[i] = bitcast<f32>(0x7FC00000u);
        } else {
          let avg = sum / f32(period);
          output[i] = select(vol / avg, 0.0, avg == 0.0);
        }
      }
    }
  `,
};

export const PercentB: IndicatorDefinition<{ period: number; stdDev: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  id: 'percent_b',
  nameKey: 'indicator.percent_b.name',
  name: '%B',
  category: 'volatility',
  pane: 'sub1',
  outputs: [{ name: 'percentB', color: '#673AB7', style: 'line', lineWidth: 1.3, zLayer: 30 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', labelKey: 'indicator.percent_b.param.period', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', labelKey: 'indicator.percent_b.param.stdDev', min: 0.5, max: 4.0, step: 0.1 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev }) {
    try {
      const percentB: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          percentB.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        const bandwidth = upper - lower;
        percentB.push(bandwidth > 0 ? (data[i].close - lower) / bandwidth : 0.5);
      }
      return ok({ percentB });
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
        output[idx] = bitcast<f32>(0x7FC00000u);
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
      let upper = sma + params.std_dev * std;
      let lower = sma - params.std_dev * std;
      let width = upper - lower;
      let close = ohlcv[idx * 6u + 4u];
      output[idx] = select((close - lower) / width, 0.5, width == 0.0);
    }
  `,
};

export const BBWidth: IndicatorDefinition<{ period: number; stdDev: number }, OhlcvPoint> = {
  schemaVersion: SCHEMA_VERSION,
  nameKey: 'indicator.bb_width.name',
  id: 'bb_width',
  name: 'BB Width',
  category: 'volatility',
  pane: 'sub1',
  outputs: [{ name: 'width', color: '#00BCD4', style: 'area', opacity: 0.5, fillTo: 0, zLayer: 20 }],
  params: {
    period: { type: 'number', default: 20, label: 'Period', labelKey: 'indicator.bb_width.param.period', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', labelKey: 'indicator.bb_width.param.stdDev', min: 0.5, max: 4.0, step: 0.1 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  calculate(data, { period, stdDev }) {
    try {
      const width: IndicatorValue[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          width.push(null);
          continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const closes = slice.map((d) => d.close);
        const sma = closes.reduce((a, b) => a + b, 0) / period;
        const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        width.push(sma > 0 ? (upper - lower) / sma : 0);
      }
      return ok({ width });
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
        output[idx] = bitcast<f32>(0x7FC00000u);
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
      let upper = sma + params.std_dev * std;
      let lower = sma - params.std_dev * std;
      output[idx] = select((upper - lower) / sma, 0.0, sma == 0.0);
    }
  `,
};

export const Phase3Indicators = [VWAP, VolRatio, PercentB, BBWidth] as const;

export const registerPhase3Indicators = (registry: IndicatorRegistry): void => {
  Phase3Indicators.forEach((indicator) => registry.register(indicator as IndicatorDefinition<any, any>));
};
