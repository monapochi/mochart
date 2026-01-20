import type { ChartConfig, ChartOptions, IndicatorInstance, OhlcvPoint } from './types';
import type { ChartRenderer } from '../renderer/renderer';
import { WebGL2Renderer } from '../renderer/webgl2/webgl2Renderer';
import { WebGPURenderer } from '../renderer/webgpu/webgpuRenderer';
import type { IndicatorDefinition } from './indicatorTypes';
import { InMemoryIndicatorRegistry } from './indicators';
import { registerPhase1Indicators } from '../indicators/phase1';
import { registerPhase2Indicators } from '../indicators/phase2';
import { registerPhase3Indicators } from '../indicators/phase3';
import { registerPhase4Indicators } from '../indicators/phase4';
import { DEFAULT_MARKER_STYLES, type TradeMarker } from './tradeMarkers';

export class MoChart {
  private renderer: ChartRenderer;
  private data: OhlcvPoint[];
  private config: ChartConfig;
  private rafId: number | null = null;
  private registry = new InMemoryIndicatorRegistry();
  private indicatorInstances: IndicatorInstance[] = [];
  private tradeMarkers: TradeMarker[] = [];
  private alertCallbacks: Array<(alert: { indicatorId: string; alertId: string; message: string }) => void> = [];
  private lastAlertAt = new Map<string, number>();

  constructor(canvas: HTMLCanvasElement, options: ChartOptions) {
    this.data = options.data;
    this.config = options.config ?? {};
    this.indicatorInstances = this.config.indicators ?? [];
    this.tradeMarkers = this.config.tradeMarkers ?? [];

    registerPhase1Indicators(this.registry);
    registerPhase2Indicators(this.registry);
    registerPhase3Indicators(this.registry);
    registerPhase4Indicators(this.registry);

    this.renderer = 'gpu' in navigator ? new WebGPURenderer() : new WebGL2Renderer();
    this.renderer.initialize(canvas);
    this.renderer.setConfig(this.config);
    this.renderer.setData(this.data);
    this.rebuildIndicatorSegments();

    this.start();
  }

  start(): void {
    const tick = () => {
      this.renderer.render();
      this.rafId = requestAnimationFrame(tick);
    };

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(tick);
    }
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setData(data: OhlcvPoint[]): void {
    this.data = data;
    this.renderer.setData(data);
    this.rebuildIndicatorSegments();
  }

  setConfig(config: ChartConfig): void {
    this.config = config;
    this.indicatorInstances = config.indicators ?? [];
    this.tradeMarkers = config.tradeMarkers ?? [];
    this.renderer.setConfig(config);
    this.rebuildIndicatorSegments();
  }

  registerIndicator<T>(definition: IndicatorDefinition<T>): void {
    this.registry.register(definition);
  }

  addIndicator(id: string, params?: Record<string, unknown>): string {
    const instanceId = `ind_${crypto.randomUUID()}`;
    this.indicatorInstances = [
      ...this.indicatorInstances,
      { id, instanceId, params, enabled: true },
    ];
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
    return instanceId;
  }

  removeIndicator(instanceId: string): void {
    this.indicatorInstances = this.indicatorInstances.filter((ind) => ind.instanceId !== instanceId);
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
  }

  updateParams(instanceId: string, params: Record<string, unknown>): void {
    this.indicatorInstances = this.indicatorInstances.map((ind) =>
      ind.instanceId === instanceId ? { ...ind, params } : ind
    );
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
  }

  toggleVisibility(instanceId: string): void {
    this.indicatorInstances = this.indicatorInstances.map((ind) =>
      ind.instanceId === instanceId ? { ...ind, enabled: !ind.enabled } : ind
    );
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
  }

  getActiveIndicators(): IndicatorInstance[] {
    return this.indicatorInstances;
  }

  addTradeMarkers(markers: TradeMarker[]): void {
    this.tradeMarkers = [...this.tradeMarkers, ...markers];
    this.setConfig({ ...this.config, tradeMarkers: this.tradeMarkers });
  }

  clearTradeMarkers(): void {
    this.tradeMarkers = [];
    this.setConfig({ ...this.config, tradeMarkers: [] });
  }

  onAlert(callback: (alert: { indicatorId: string; alertId: string; message: string }) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      this.alertCallbacks = this.alertCallbacks.filter((cb) => cb !== callback);
    };
  }

  private rebuildIndicatorSegments(): void {
    const segments = this.computeIndicatorSegments();
    this.renderer.setIndicatorSegments(segments);
    void this.rebuildIndicatorSegmentsGPU();
  }

  private async rebuildIndicatorSegmentsGPU(): Promise<void> {
    if (!(this.renderer instanceof WebGPURenderer)) return;
    const segments = await this.computeIndicatorSegmentsGPU(this.renderer);
    if (segments.length) {
      this.renderer.setIndicatorSegments(segments);
    }
  }

  private computeIndicatorSegments(): Float32Array {
    if (!this.data.length || this.indicatorInstances.length === 0) {
      return new Float32Array();
    }

    const count = this.data.length;
    const step = 2 / Math.max(1, count - 1);
    const toX = (i: number) => -1 + step * i;

    const mainRange = {
      min: Math.min(...this.data.map((d) => d.low)),
      max: Math.max(...this.data.map((d) => d.high)),
    };
    const subRanges: Record<'sub1' | 'sub2' | 'sub3', { min: number; max: number }> = {
      sub1: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub2: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub3: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    };
    const paneLayout: Record<'main' | 'sub1' | 'sub2' | 'sub3', { top: number; height: number }> = {
      main: { top: 0, height: 0.6 },
      sub1: { top: 0.6, height: 0.15 },
      sub2: { top: 0.75, height: 0.15 },
      sub3: { top: 0.9, height: 0.1 },
    };

    const updateRange = (pane: 'sub1' | 'sub2' | 'sub3', value: number) => {
      const range = subRanges[pane];
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    };

    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false) continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane === 'main') continue;
      const params = (instance.params ?? {}) as any;
      const result = def.calculate(this.data, params);
      if (!result.ok) continue;
      for (const output of def.outputs) {
        const series = result.value[output.name];
        if (!series) continue;
        for (const value of series) {
          if (value == null) continue;
          updateRange(def.pane, value);
        }
      }
    }

    const normalizeRange = (pane: 'sub1' | 'sub2' | 'sub3') => {
      const range = subRanges[pane];
      if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
        range.min = 0;
        range.max = 1;
      }
      if (range.min === range.max) {
        range.min -= 1;
        range.max += 1;
      }
    };

    normalizeRange('sub1');
    normalizeRange('sub2');
    normalizeRange('sub3');

    const toPaneY = (pane: 'main' | 'sub1' | 'sub2' | 'sub3', value: number) => {
      const layout = paneLayout[pane];
      const topNdc = 1 - 2 * layout.top;
      const bottomNdc = 1 - 2 * (layout.top + layout.height);
      let min = mainRange.min;
      let max = mainRange.max;
      if (pane !== 'main') {
        min = subRanges[pane].min;
        max = subRanges[pane].max;
      }
      const ratio = (value - min) / (max - min);
      return bottomNdc + (topNdc - bottomNdc) * ratio;
    };

    const vertices: number[] = [];

    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false) continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane !== 'main') continue;
      const params = (instance.params ?? {}) as any;
      const result = def.calculate(this.data, params);
      if (!result.ok) continue;

      for (const output of def.outputs) {
        if (output.style !== 'line') continue;
        const series = result.value[output.name];
        if (!series) continue;
        const color = this.parseColor(output.color);
        for (let i = 1; i < series.length; i++) {
          const prev = series[i - 1];
          const cur = series[i];
          if (prev == null || cur == null) continue;
          const x0 = toX(i - 1);
          const y0 = toPaneY('main', prev);
          const x1 = toX(i);
          const y1 = toPaneY('main', cur);
          vertices.push(x0, y0, ...color);
          vertices.push(x1, y1, ...color);
        }
      }

      this.evaluateAlerts(def, result.value, this.data[this.data.length - 1]);
    }

    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false) continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane === 'main') continue;
      const params = (instance.params ?? {}) as any;
      const result = def.calculate(this.data, params);
      if (!result.ok) continue;

      for (const output of def.outputs) {
        const series = result.value[output.name];
        if (!series) continue;
        const color = this.parseColor(output.color);
        if (output.style === 'line') {
          for (let i = 1; i < series.length; i++) {
            const prev = series[i - 1];
            const cur = series[i];
            if (prev == null || cur == null) continue;
            const x0 = toX(i - 1);
            const y0 = toPaneY(def.pane, prev);
            const x1 = toX(i);
            const y1 = toPaneY(def.pane, cur);
            vertices.push(x0, y0, ...color);
            vertices.push(x1, y1, ...color);
          }
        } else if (output.style === 'histogram' || output.style === 'bar') {
          const baseY = toPaneY(def.pane, 0);
          for (let i = 0; i < series.length; i++) {
            const value = series[i];
            if (value == null) continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            vertices.push(x, baseY, ...color);
            vertices.push(x, y, ...color);
          }
        }
        if (output.style === 'marker') {
          for (let i = 0; i < series.length; i++) {
            const value = series[i];
            if (value == null) continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            this.pushMarkerShape(vertices, x, y, 0.01, 'diamond', color);
          }
        }
      }
    }

    if (this.tradeMarkers.length) {
      const markerSize = 0.01;
      for (const marker of this.tradeMarkers) {
        const index = this.findNearestIndex(marker.time);
        if (index < 0) continue;
        const x = toX(index);
        const y = toPaneY('main', marker.price);
        const style = DEFAULT_MARKER_STYLES[marker.type];
        const color = this.parseColor(style.color);
        const size = (marker.size ?? style.size) * markerSize;
        this.pushMarkerShape(vertices, x, y, size, style.shape, color);
      }
    }

    return new Float32Array(vertices);
  }

  private async computeIndicatorSegmentsGPU(renderer: WebGPURenderer): Promise<Float32Array> {
    if (!this.data.length || this.indicatorInstances.length === 0) {
      return new Float32Array();
    }

    const count = this.data.length;
    const step = 2 / Math.max(1, count - 1);
    const toX = (i: number) => -1 + step * i;

    const mainRange = {
      min: Math.min(...this.data.map((d) => d.low)),
      max: Math.max(...this.data.map((d) => d.high)),
    };
    const subRanges: Record<'sub1' | 'sub2' | 'sub3', { min: number; max: number }> = {
      sub1: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub2: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub3: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    };
    const paneLayout: Record<'main' | 'sub1' | 'sub2' | 'sub3', { top: number; height: number }> = {
      main: { top: 0, height: 0.6 },
      sub1: { top: 0.6, height: 0.15 },
      sub2: { top: 0.75, height: 0.15 },
      sub3: { top: 0.9, height: 0.1 },
    };

    const updateRange = (pane: 'sub1' | 'sub2' | 'sub3', value: number) => {
      const range = subRanges[pane];
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    };

    const dataBuffer = new Float32Array(this.data.length * 6);
    this.data.forEach((bar, i) => {
      const offset = i * 6;
      dataBuffer[offset + 0] = bar.time;
      dataBuffer[offset + 1] = bar.open;
      dataBuffer[offset + 2] = bar.high;
      dataBuffer[offset + 3] = bar.low;
      dataBuffer[offset + 4] = bar.close;
      dataBuffer[offset + 5] = bar.volume;
    });

    const computeOutputs = new Map<string, Record<string, (number | null)[]>>();
    const inputBuffer = renderer.createInputBuffer(dataBuffer);

    const orderedInstances = this.orderInstancesByDependencies();

    for (const instance of orderedInstances) {
      if (instance.enabled === false) continue;
      const def = this.registry.get(instance.id);
      if (!def || !def.wgslSource) continue;
      const params = (instance.params ?? {}) as Record<string, number>;
      const seriesCount = def.outputs.length;
      const paramBuffer = this.buildUniformParams(def.id, params, this.data.length);
      const output = await renderer.computeIndicatorGPUWithInput(
        def.wgslSource,
        paramBuffer,
        inputBuffer,
        this.data.length * seriesCount,
        this.data.length
      );
      if (!output) continue;
      const seriesMap: Record<string, (number | null)[]> = {};
      for (let s = 0; s < seriesCount; s++) {
        const name = def.outputs[s].name;
        seriesMap[name] = [];
      }
      for (let i = 0; i < this.data.length; i++) {
        for (let s = 0; s < seriesCount; s++) {
          const value = output[i * seriesCount + s];
          seriesMap[def.outputs[s].name].push(Number.isNaN(value) ? null : value);
        }
      }
      computeOutputs.set(instance.instanceId, seriesMap);
    }

    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false) continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane === 'main') continue;
      const series = computeOutputs.get(instance.instanceId);
      if (!series) continue;
      for (const output of def.outputs) {
        const values = series[output.name];
        if (!values) continue;
        for (const value of values) {
          if (value == null) continue;
          updateRange(def.pane, value);
        }
      }
    }

    const normalizeRange = (pane: 'sub1' | 'sub2' | 'sub3') => {
      const range = subRanges[pane];
      if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
        range.min = 0;
        range.max = 1;
      }
      if (range.min === range.max) {
        range.min -= 1;
        range.max += 1;
      }
    };

    normalizeRange('sub1');
    normalizeRange('sub2');
    normalizeRange('sub3');

    const toPaneY = (pane: 'main' | 'sub1' | 'sub2' | 'sub3', value: number) => {
      const layout = paneLayout[pane];
      const topNdc = 1 - 2 * layout.top;
      const bottomNdc = 1 - 2 * (layout.top + layout.height);
      let min = mainRange.min;
      let max = mainRange.max;
      if (pane !== 'main') {
        min = subRanges[pane].min;
        max = subRanges[pane].max;
      }
      const ratio = (value - min) / (max - min);
      return bottomNdc + (topNdc - bottomNdc) * ratio;
    };

    const vertices: number[] = [];

    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false) continue;
      const def = this.registry.get(instance.id);
      if (!def) continue;
      const series = computeOutputs.get(instance.instanceId);
      if (!series) continue;
      for (const output of def.outputs) {
        const values = series[output.name];
        if (!values) continue;
        const color = this.parseColor(output.color);
        if (output.style === 'line') {
          for (let i = 1; i < values.length; i++) {
            const prev = values[i - 1];
            const cur = values[i];
            if (prev == null || cur == null) continue;
            const x0 = toX(i - 1);
            const y0 = toPaneY(def.pane, prev);
            const x1 = toX(i);
            const y1 = toPaneY(def.pane, cur);
            vertices.push(x0, y0, ...color);
            vertices.push(x1, y1, ...color);
          }
        } else if (output.style === 'histogram' || output.style === 'bar') {
          const baseY = toPaneY(def.pane, 0);
          for (let i = 0; i < values.length; i++) {
            const value = values[i];
            if (value == null) continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            vertices.push(x, baseY, ...color);
            vertices.push(x, y, ...color);
          }
        }
        if (output.style === 'marker') {
          for (let i = 0; i < values.length; i++) {
            const value = values[i];
            if (value == null) continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            this.pushMarkerShape(vertices, x, y, 0.01, 'diamond', color);
          }
        }
      }
      this.evaluateAlerts(def, series, this.data[this.data.length - 1]);
    }

    return new Float32Array(vertices);
  }

  private orderInstancesByDependencies(): IndicatorInstance[] {
    const ids = Array.from(new Set(this.indicatorInstances.map((ind) => ind.id)));
    let orderedIds: string[] = [];
    try {
      orderedIds = this.registry.resolveDependencies(ids).map((def) => def.id);
    } catch {
      orderedIds = ids;
    }
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, index) => orderMap.set(id, index));
    return [...this.indicatorInstances].sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
    );
  }

  private buildUniformParams(id: string, params: Record<string, number>, dataLen: number): ArrayBuffer {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    const setU32 = (offset: number, value: number) => view.setUint32(offset, value, true);
    const setF32 = (offset: number, value: number) => view.setFloat32(offset, value, true);

    switch (id) {
      case 'bb':
      case 'percent_b':
      case 'bb_width':
        setU32(0, params.period ?? 20);
        setF32(4, params.stdDev ?? 2);
        setU32(8, dataLen);
        return buffer;
      case 'macd':
        setU32(0, params.fastPeriod ?? 12);
        setU32(4, params.slowPeriod ?? 26);
        setU32(8, params.signalPeriod ?? 9);
        setU32(12, dataLen);
        return buffer;
      case 'adx':
      case 'atr':
      case 'rsi':
      case 'sma':
      case 'ema':
      case 'vwap':
      case 'vol_ratio':
      default:
        setU32(0, params.period ?? 14);
        setU32(4, dataLen);
        return buffer;
    }
  }

  private parseColor(color: string): [number, number, number, number] {
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const val = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
      const r = ((val >> 16) & 255) / 255;
      const g = ((val >> 8) & 255) / 255;
      const b = (val & 255) / 255;
      return [r, g, b, 1];
    }
    const rgba = color.match(/rgba?\(([^)]+)\)/i);
    if (rgba) {
      const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()));
      const [r, g, b, a = 1] = parts;
      return [r / 255, g / 255, b / 255, a];
    }
    return [1, 1, 1, 1];
  }

  private evaluateAlerts(
    def: IndicatorDefinition<any, any>,
    series: Record<string, number | null | (number | null)[]>,
    bar: OhlcvPoint
  ) {
    if (!def.alerts || def.alerts.length === 0) return;
    const lastIndex = this.data.length - 1;
    const values: Record<string, number | null> = {};
    const prevValues: Record<string, number | null> = {};

    for (const output of def.outputs) {
      const outputSeries = series[output.name] as (number | null)[] | undefined;
      if (!outputSeries) continue;
      values[output.name] = outputSeries[lastIndex] ?? null;
      prevValues[output.name] = outputSeries[lastIndex - 1] ?? null;
    }

    for (const alert of def.alerts) {
      const key = `${def.id}:${alert.id}`;
      const lastAt = this.lastAlertAt.get(key) ?? 0;
      const now = Date.now();
      if (alert.cooldown && now - lastAt < alert.cooldown * 1000) continue;
      if (alert.condition(values, bar, prevValues)) {
        const message = alert.message(values, bar);
        this.lastAlertAt.set(key, now);
        this.alertCallbacks.forEach((cb) => cb({ indicatorId: def.id, alertId: alert.id, message }));
      }
    }
  }

  private findNearestIndex(time: number): number {
    let best = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.data.length; i++) {
      const diff = Math.abs(this.data[i].time - time);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }

  private pushMarkerShape(
    out: number[],
    x: number,
    y: number,
    size: number,
    shape: 'triangle_up' | 'triangle_down' | 'circle' | 'cross' | 'diamond' | 'warning',
    color: [number, number, number, number]
  ) {
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      out.push(x0, y0, ...color);
      out.push(x1, y1, ...color);
    };

    switch (shape) {
      case 'triangle_up': {
        const top = [x, y + size];
        const left = [x - size, y - size];
        const right = [x + size, y - size];
        line(top[0], top[1], left[0], left[1]);
        line(left[0], left[1], right[0], right[1]);
        line(right[0], right[1], top[0], top[1]);
        break;
      }
      case 'triangle_down': {
        const bottom = [x, y - size];
        const left = [x - size, y + size];
        const right = [x + size, y + size];
        line(bottom[0], bottom[1], left[0], left[1]);
        line(left[0], left[1], right[0], right[1]);
        line(right[0], right[1], bottom[0], bottom[1]);
        break;
      }
      case 'diamond': {
        const top = [x, y + size];
        const right = [x + size, y];
        const bottom = [x, y - size];
        const left = [x - size, y];
        line(top[0], top[1], right[0], right[1]);
        line(right[0], right[1], bottom[0], bottom[1]);
        line(bottom[0], bottom[1], left[0], left[1]);
        line(left[0], left[1], top[0], top[1]);
        break;
      }
      case 'circle': {
        const segments = 12;
        for (let i = 0; i < segments; i++) {
          const a0 = (i / segments) * Math.PI * 2;
          const a1 = ((i + 1) / segments) * Math.PI * 2;
          const x0 = x + Math.cos(a0) * size;
          const y0 = y + Math.sin(a0) * size;
          const x1 = x + Math.cos(a1) * size;
          const y1 = y + Math.sin(a1) * size;
          line(x0, y0, x1, y1);
        }
        break;
      }
      case 'warning': {
        const top = [x, y + size];
        const left = [x - size, y - size];
        const right = [x + size, y - size];
        line(top[0], top[1], left[0], left[1]);
        line(left[0], left[1], right[0], right[1]);
        line(right[0], right[1], top[0], top[1]);
        line(x, y - size * 0.2, x, y + size * 0.4);
        line(x, y - size * 0.6, x, y - size * 0.55);
        break;
      }
      case 'cross':
      default: {
        line(x - size, y, x + size, y);
        line(x, y - size, x, y + size);
      }
    }
  }

  destroy(): void {
    this.stop();
    this.renderer.destroy();
  }
}
