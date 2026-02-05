export const SCHEMA_VERSION = 2 as const;

type GPUDevice = unknown;

export type IndicatorValue = number | null;

export type PlotStyle =
  | 'line'
  | 'histogram'
  | 'area'
  | 'band'
  | 'marker'
  | 'cloud'
  | 'bar'
  | 'candle';

export type PlotPane = 'main' | 'sub1' | 'sub2' | 'sub3';

export type ZLayer = 0 | 10 | 20 | 30 | 40 | 50;

export type SeriesStyle = {
  name: string;
  color: string;
  lineWidth?: number;
  style: PlotStyle;
  opacity?: number;
  fillTo?: string | number;
  zLayer?: ZLayer;
  antialias?: boolean;
};

export type IndicatorParamSchema<T> = {
  [K in keyof T]: {
    type: 'number' | 'string' | 'boolean' | 'select';
    default: T[K];
    label: string;
    description?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: unknown; label: string }[];
  };
};

export type IndicatorError = {
  code: 'INSUFFICIENT_DATA' | 'INVALID_PARAMS' | 'GPU_ERROR' | 'COMPUTATION_ERROR';
  message: string;
  details?: unknown;
};

export type IndicatorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: IndicatorError };

export type MultiSeriesOutput = Record<string, IndicatorValue[]>;

export type IndicatorAlert = {
  id: string;
  name: string;
  condition: (
    values: Record<string, IndicatorValue>,
    bar: unknown,
    prevValues?: Record<string, IndicatorValue>
  ) => boolean;
  message: (values: Record<string, IndicatorValue>, bar: unknown) => string;
  severity: 'info' | 'warning' | 'critical';
  cooldown?: number;
};

export type IndicatorDefinition<TParams = Record<string, unknown>, TBar = unknown> = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  nameKey?: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'custom';
  pane: PlotPane;
  outputs: SeriesStyle[];
  params: IndicatorParamSchema<TParams>;
  dependencies?: string[];
  calculate: (data: TBar[], params: TParams) => IndicatorResult<MultiSeriesOutput>;
  calculateGPU?: (
    buffer: Float32Array,
    params: TParams,
    device: GPUDevice
  ) => Promise<IndicatorResult<Record<string, Float32Array>>>;
  wgslSource?: string;
  update?: (
    prevState: unknown,
    newBar: TBar,
    params: TParams
  ) => IndicatorResult<{ state: unknown; values: Record<string, IndicatorValue> }>;
  yRange?: { min: number; max: number };
  horizontalLines?: { value: number; color: string; dashed?: boolean }[];
  alerts?: IndicatorAlert[];
  complexity: {
    time: 'O(n)' | 'O(n log n)' | 'O(n²)';
    space: 'O(1)' | 'O(n)' | 'O(n²)';
  };
  warmupPeriod: (params: TParams) => number;
};
