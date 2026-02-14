import type { ChartConfig, OhlcvPoint } from '../core/types';

export interface RendererViewportOptions {
  startIndex?: number;
  visibleCount?: number;
  rightMarginBars?: number;
  yAxisGutterPx?: number;
  xAxisHeightPx?: number;
  maxVisibleBars?: number;
  paddingRatio?: number;
  minPaddingPx?: number;
  color?: string;
  lineWidth?: number;
}

export interface RendererLayout {
  plotX: number;
  plotY: number;
  plotW: number;
  plotH: number;
  gutterLeft: number;
  gutterTop: number;
  xAxisHeight: number;
  startIndex: number;
  startIndexRaw: number;
  visibleCount: number;
  stepX: number;
  candleW: number;
  yMin: number;
  yMax: number;
  rightMarginBars: number;
}

export interface MapClientToDataResult {
  index: number;
  localIndex: number;
  time: number;
  point: any;
  x: number;
  y: number;
  priceAtY: number;
}

export interface ViewportRenderer {
  drawSeries(seriesId: string, data: Array<any>, options?: RendererViewportOptions): void;
  getLayout(data: Array<any>, options?: RendererViewportOptions): RendererLayout;
  mapClientToData(
    clientX: number,
    clientY: number,
    data: Array<any>,
    options?: RendererViewportOptions,
  ): MapClientToDataResult | null;
  drawCrosshairAt(clientX: number, clientY: number, data: Array<any>, options?: RendererViewportOptions): void;
  resize(): void;
  destroy(): void;
}

export interface ChartRenderer {
  initialize(canvas: HTMLCanvasElement): void;
  setData(data: OhlcvPoint[]): void;
  setConfig(config: ChartConfig): void;
  setIndicatorSegments(segments: Float32Array): void;
  render(): void;
  resize(): void;
  destroy(): void;
}
