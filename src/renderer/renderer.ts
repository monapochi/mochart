import type { ChartConfig, OhlcvPoint } from '../core/types';

export interface ChartRenderer {
  initialize(canvas: HTMLCanvasElement): void;
  setData(data: OhlcvPoint[]): void;
  setConfig(config: ChartConfig): void;
  setIndicatorSegments(segments: Float32Array): void;
  render(): void;
  resize(): void;
  destroy(): void;
}
