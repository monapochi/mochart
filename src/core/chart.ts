// Core chart class: data management, series API and wiring to renderer
export interface ChartCoreOptions {
  width?: number;
  height?: number;
  locale?: string;
  theme?: 'light' | 'dark';
  /** Default visible period in days (e.g., 90 for 3 months). If not set, shows maxVisibleBars. */
  defaultVisibleDays?: number;
  /** Right margin in days for whitespace after latest data (e.g., 14-21 for 2-3 weeks) */
  rightMarginDays?: number;
}

export interface SeriesOptions {
  id?: string;
  type?: 'candlestick' | 'line' | 'bar' | 'area';
  color?: string;
  name?: string;
  // Rendering colors (optional)
  outlineColor?: string; // frame and outline (color A)
  wickColor?: string; // wick color (color A)
  upColor?: string; // fill when close >= open (bull) (color B)
  downColor?: string; // fill when close < open (bear) (color C)
}

import { CanvasRenderer } from '../renderer/canvas/canvasRenderer';

// Minimal ChartCore skeleton to be expanded.
export class ChartCore {
  private container: HTMLElement;
  private options: ChartCoreOptions;

  // internal series store: id -> {options, data}
  private seriesStore: Map<string, { options: SeriesOptions; data: any[] }> = new Map();
  // viewport state (indices relative to series data)
  private viewportStartIndex: number = 0;
  private viewportVisibleCount: number = 200;
  private rightMarginBars: number = 0;

  private getEffectiveRightMarginBars(len?: number, start?: number, visibleCount?: number): number {
    if (this.rightMarginBars <= 0) return 0;
    const dataLen = typeof len === 'number' ? len : this.getDataLength();
    const from = typeof start === 'number' ? start : this.viewportStartIndex;
    const visible = typeof visibleCount === 'number' ? visibleCount : this.viewportVisibleCount;
    const maxStartNoMargin = Math.max(0, dataLen - visible);
    const atLatestEdge = from >= maxStartNoMargin;
    return atLatestEdge ? this.rightMarginBars : 0;
  }

  // simple event emitter
  private listeners: Map<string, Set<(payload?: any) => void>> = new Map();

  constructor(container: HTMLElement, options?: ChartCoreOptions) {
    if (!container) throw new Error('Container element required');
    this.container = container;
    this.options = options ?? {};
    // initialize canvas renderer: prefer an existing canvas inside container
    try {
      const canvas = (this.container.tagName.toLowerCase() === 'canvas')
        ? (this.container as unknown as HTMLCanvasElement)
        : (this.container.querySelector('canvas') as HTMLCanvasElement) ?? this.createCanvas();
      (this as any)._renderer = new CanvasRenderer(canvas);
    } catch (e) {
      console.warn('CanvasRenderer init failed', e);
    }
  }

  // Event emitter helpers
  on(event: string, cb: (payload?: any) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(cb);
    this.listeners.set(event, set);
  }
  off(event: string, cb?: (payload?: any) => void) {
    if (!this.listeners.has(event)) return;
    if (!cb) { this.listeners.delete(event); return; }
    this.listeners.get(event)!.delete(cb);
  }
  private emit(event: string, payload?: any) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of Array.from(set)) cb(payload);
  }

  // Feed adapter contract: adapter should implement subscribe/unsubscribe or similar
  async connectFeed(adapter: any): Promise<void> {
    // basic wiring: adapter.subscribe(seriesId, callback)
    if (!adapter) throw new Error('Adapter required');
    if (typeof adapter.subscribe !== 'function') {
      console.warn('Adapter does not implement subscribe/unsubscribe — storing adapter only');
      // store adapter for future use
      (this as any)._adapter = adapter;
      return;
    }
    (this as any)._adapter = adapter;
    // subscribe all series if adapter supports it
    for (const seriesId of this.seriesStore.keys()) {
      try {
        adapter.subscribe(seriesId, (point: any) => this.pushRealtime(seriesId, point));
      } catch (e) {
        console.warn('subscribe failed for', seriesId, e);
      }
    }
    this.emit('realtimeConnected');
  }

  async disconnectFeed(): Promise<void> {
    const adapter = (this as any)._adapter;
    if (adapter && typeof adapter.unsubscribe === 'function') {
      for (const seriesId of this.seriesStore.keys()) {
        try { adapter.unsubscribe(seriesId); } catch {};
      }
    }
    delete (this as any)._adapter;
    this.emit('realtimeDisconnected');
  }

  async addSeries(options: SeriesOptions): Promise<string> {
    const id = options.id ?? `series_${Math.random().toString(36).slice(2,9)}`;
    if (this.seriesStore.has(id)) throw new Error(`Series ${id} already exists`);
    this.seriesStore.set(id, { options, data: [] });
    this.emit('seriesAdded', { id, options });
    return id;
  }

  async setSeriesData(seriesId: string, data: any[], partial = false): Promise<void> {
    const entry = this.seriesStore.get(seriesId);
    if (!entry) throw new Error(`Series ${seriesId} not found`);
    if (partial) {
      // merge partial at the end
      entry.data.splice(entry.data.length - data.length, data.length, ...data);
    } else {
      entry.data = data.slice();
      // Apply default viewport settings on fresh data load
      this.applyDefaultViewport(data);
    }
    this.seriesStore.set(seriesId, entry);
    // emit update
    this.emit('seriesUpdated', { seriesId, length: entry.data.length });
    // render immediately on canvas renderer if available
    const renderer = (this as any)._renderer;
    if (renderer && typeof renderer.drawSeries === 'function') {
      const effectiveRightMarginBars = this.getEffectiveRightMarginBars();
      try {
        renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount, rightMarginBars: effectiveRightMarginBars }));
      } catch (e) { console.warn(e); }
    }
  }

  private applyDefaultViewport(data: any[]): void {
    if (data.length === 0) return;
    
    const defaultVisibleDays = this.options.defaultVisibleDays;
    const rightMarginDays = this.options.rightMarginDays ?? 0;
    
    if (defaultVisibleDays && data.length >= 2) {
      // Estimate average bar duration from data
      const firstTime = data[0].time;
      const lastTime = data[data.length - 1].time;
      const totalMs = lastTime - firstTime;
      const avgBarMs = totalMs / (data.length - 1);
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Calculate visible count based on days
      const visibleBars = Math.ceil((defaultVisibleDays * msPerDay) / avgBarMs);
      const marginBars = Math.ceil((rightMarginDays * msPerDay) / avgBarMs);
      
      // Set viewport to show last N bars with right margin
      this.viewportVisibleCount = Math.min(data.length, visibleBars);
      this.viewportStartIndex = Math.max(0, data.length - visibleBars);
      this.rightMarginBars = marginBars;
    } else {
      // Default behavior: show last 200 bars
      this.viewportVisibleCount = Math.min(200, data.length);
      this.viewportStartIndex = Math.max(0, data.length - this.viewportVisibleCount);
      this.rightMarginBars = 0;
    }
  }

  private getDataLength(): number {
    let max = 0;
    for (const v of this.seriesStore.values()) {
      if (v.data && v.data.length > max) max = v.data.length;
    }
    return max;
  }

  private createCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const w = ((this.options.width ?? this.container.clientWidth) || 800) as number;
    const h = ((this.options.height ?? this.container.clientHeight) || 600) as number;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    this.container.appendChild(c);
    return c;
  }

  private emitRangeChanged(): void {
    const len = this.getDataLength();
    if (len === 0) return;
    const from = Math.max(0, Math.min(len - 1, Math.floor(this.viewportStartIndex)));
    const to = Math.max(0, Math.min(len - 1, from + this.viewportVisibleCount - 1));
    this.emit('rangeChanged', { from, to });
  }

  async updateSeries(seriesId: string, patch: { index: number; point: any }[]): Promise<void> {
    const entry = this.seriesStore.get(seriesId);
    if (!entry) throw new Error(`Series ${seriesId} not found`);
    for (const p of patch) {
      if (p.index < 0 || p.index >= entry.data.length) continue;
      entry.data[p.index] = p.point;
    }
    this.emit('seriesUpdated', { seriesId, patch });
  }

  async pushRealtime(seriesId: string, point: any): Promise<void> {
    const entry = this.seriesStore.get(seriesId);
    if (!entry) throw new Error(`Series ${seriesId} not found`);
    const last = entry.data[entry.data.length - 1];
    if (!last || last.time !== point.time) {
      entry.data.push(point);
    } else {
      // replace last
      entry.data[entry.data.length - 1] = point;
    }
    this.emit('realtime', { seriesId, point });
    this.emit('seriesUpdated', { seriesId, realtime: true });
  }

  getVisibleRange(): { from: number; to: number; rightMarginBars?: number } | null {
    const len = this.getDataLength();
    if (len === 0) return null;
    const from = Math.max(0, Math.min(len - 1, Math.floor(this.viewportStartIndex)));
    const to = Math.max(0, Math.min(len - 1, from + this.viewportVisibleCount - 1));
    return { from, to, rightMarginBars: this.getEffectiveRightMarginBars(len, from, this.viewportVisibleCount) };
  }

  setVisibleRange(from: number, to: number): void {
    // programmatic pan/zoom by indices
    const len = this.getDataLength();
    if (len === 0) return;
    const f = Math.max(0, Math.min(len - 1, from));
    const t = Math.max(0, Math.min(len - 1, to));
    this.viewportStartIndex = Math.min(f, t);
    this.viewportVisibleCount = Math.max(1, t - f + 1);
    this.emitRangeChanged();
    // force redraw of all series
    const renderer = (this as any)._renderer;
    if (renderer && typeof renderer.drawSeries === 'function') {
      const effectiveRightMarginBars = this.getEffectiveRightMarginBars();
      for (const [seriesId, entry] of this.seriesStore.entries()) {
        try { renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount, rightMarginBars: effectiveRightMarginBars })); } catch (e) { console.warn(e); }
      }
    }
  }

  setViewport(fromIndex: number, toIndex: number): void {
    this.setVisibleRange(fromIndex, toIndex);
  }

  panBy(deltaIndex: number): void {
    this.panByBars(deltaIndex);
  }

  panByBars(deltaBars: number): void {
    const len = this.getDataLength();
    if (len === 0) return;
    const maxStart = Math.max(0, len - this.viewportVisibleCount);
    this.viewportStartIndex = Math.max(0, Math.min(maxStart, this.viewportStartIndex + deltaBars));
    this.emitRangeChanged();
    const renderer = (this as any)._renderer;
    if (renderer && typeof renderer.drawSeries === 'function') {
      const effectiveRightMarginBars = this.getEffectiveRightMarginBars();
      for (const [seriesId, entry] of this.seriesStore.entries()) {
        try { renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount, rightMarginBars: effectiveRightMarginBars })); } catch (e) { console.warn(e); }
      }
    }
  }

  zoomAt(factor: number, centerIndex?: number, centerRatio?: number): void {
    const len = this.getDataLength();
    if (len === 0) return;
    const minVisible = 5;
    let newCount = Math.max(minVisible, Math.min(len, Math.round(this.viewportVisibleCount * factor)));
    // determine center
    const center = typeof centerIndex === 'number' ? centerIndex : Math.min(len - 1, this.viewportStartIndex + Math.floor(this.viewportVisibleCount / 2));
    const rightMargin = Math.max(0, this.getEffectiveRightMarginBars(len, this.viewportStartIndex, this.viewportVisibleCount));
    const prevSlots = Math.max(1, this.viewportVisibleCount + rightMargin - 1);
    const computedRel = (center - this.viewportStartIndex) / prevSlots;
    const rel = typeof centerRatio === 'number'
      ? Math.max(0, Math.min(1, centerRatio))
      : Math.max(0, Math.min(1, computedRel));
    const newSlots = Math.max(1, newCount + rightMargin - 1);
    let newStart = center - (rel * newSlots);
    newStart = Math.max(0, Math.min(len - newCount, newStart));
    this.viewportStartIndex = newStart;
    this.viewportVisibleCount = newCount;
    this.emitRangeChanged();
    const renderer = (this as any)._renderer;
    if (renderer && typeof renderer.drawSeries === 'function') {
      const effectiveRightMarginBars = this.getEffectiveRightMarginBars();
      for (const [seriesId, entry] of this.seriesStore.entries()) {
        try { renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount, rightMarginBars: effectiveRightMarginBars })); } catch (e) { console.warn(e); }
      }
    }
  }

  applyOptions(options: ChartCoreOptions): void {
    Object.assign(this.options, options);
    this.emit('optionsChanged', this.options);
  }

  resize(): void {
    // handle container resize
    this.emit('resize');
  }

  async destroy(): Promise<void> {
    // cleanup
    await this.disconnectFeed();
    this.seriesStore.clear();
    this.listeners.clear();
  }
}

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
