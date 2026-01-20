export type OhlcvPoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorInstance = {
  id: string;
  instanceId: string;
  enabled?: boolean;
  params?: Record<string, unknown>;
};

export type ChartColors = {
  up: [number, number, number, number];
  down: [number, number, number, number];
  wick: [number, number, number, number];
  outline: [number, number, number, number];
  background: [number, number, number, number];
};

export type ChartConfig = {
  indicators?: IndicatorInstance[];
  colors?: Partial<ChartColors>;
  tradeMarkers?: import('./tradeMarkers').TradeMarker[];
};

export type ChartOptions = {
  data: OhlcvPoint[];
  config?: ChartConfig;
};
