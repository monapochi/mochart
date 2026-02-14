import type { RendererLayout, RendererViewportOptions, ViewportRenderer } from '../renderer';

export class CanvasRenderer implements ViewportRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || this.canvas.width || 800;
    const h = this.canvas.clientHeight || this.canvas.height || 600;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, w, h);
  }

  private niceStep(range: number, targetTicks: number) {
    const raw = range / targetTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / pow;
    const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
    return nice * pow;
  }

  private formatPrice(v: number) {
    const abs = Math.abs(v);
    const digits = abs < 1 ? 4 : abs < 10 ? 3 : abs < 100 ? 2 : 2;
    return v.toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  drawSeries(seriesId: string, data: Array<any>, options?: RendererViewportOptions & {
    outlineColor?: string;
    wickColor?: string;
    upColor?: string;
    downColor?: string;
    background?: string;
    font?: string;
    gridColor?: string;
    axisLabelColor?: string;
    targetXTicks?: number;
    targetYTicks?: number;
  }) {
    if (!data || data.length === 0) return;
    // prepare canvas
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // layout
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;

    // visible window: allow override via options.startIndex/options.visibleCount
    const defaultMaxVisible = options?.maxVisibleBars ?? 200;
    const rightMarginBars = (options as any)?.rightMarginBars ?? 0;
    const visibleCount = Math.min(options?.visibleCount ?? defaultMaxVisible, data.length);
    let startRaw = typeof options?.startIndex === 'number' ? options!.startIndex : Math.max(0, data.length - visibleCount);
    if (startRaw < 0) startRaw = 0;
    if (startRaw + visibleCount > data.length) startRaw = Math.max(0, data.length - visibleCount);
    const startFloor = Math.floor(startRaw);
    const startFrac = startRaw - startFloor;
    const visible = data.slice(startFloor, Math.min(data.length, startFloor + visibleCount + 1));
    
    // Total slots includes right margin for empty space
    const totalSlots = visibleCount + rightMarginBars;

    // compute visible price range
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const d of visible) { if (d.low < min) min = d.low; if (d.high > max) max = d.high; }
    if (!isFinite(min) || !isFinite(max)) return;
    const range = Math.max(max - min, Math.max(1e-9, Math.abs(max) * 0.001));
    const padRatio = options?.paddingRatio ?? 0.05;
    const basePad = range * padRatio;
    const minPaddingPx = options?.minPaddingPx ?? 6;
    const minPaddingPrice = (range / Math.max(1, plotH)) * minPaddingPx;
    const pad = Math.max(basePad, minPaddingPrice);
    const yMin = min - pad;
    const yMax = max + pad;

    const priceToY = (p: number) => {
      const t = (p - yMin) / (yMax - yMin || 1);
      return plotY + (1 - t) * plotH;
    };

    // clear background
    this.ctx.fillStyle = options?.background ?? '#ffffff';
    this.ctx.fillRect(0, 0, w, h);

    // Y ticks (nice numbers)
    const targetYTicks = options?.targetYTicks ?? 5;
    const step = this.niceStep(yMax - yMin, targetYTicks);
    const firstTick = Math.ceil(yMin / step) * step;
    const ticks: number[] = [];
    for (let v = firstTick; v <= yMax + 1e-12; v += step) ticks.push(v);

    // draw grid and Y labels
    this.ctx.font = options?.font ?? '12px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = options?.axisLabelColor ?? '#222222';
    this.ctx.strokeStyle = options?.gridColor ?? '#e6e6e6';
    this.ctx.lineWidth = 1;
    for (const t of ticks) {
      const y = priceToY(t);
      // grid
      this.ctx.beginPath();
      this.ctx.moveTo(plotX, y);
      this.ctx.lineTo(plotX + plotW, y);
      this.ctx.stroke();
      // label
      this.ctx.fillStyle = options?.axisLabelColor ?? '#222222';
      this.ctx.fillText(this.formatPrice(t), plotX - 8, y);
    }

    // draw Y axis line
    this.ctx.strokeStyle = options?.axisLabelColor ?? '#222222';
    this.ctx.beginPath(); this.ctx.moveTo(plotX, plotY); this.ctx.lineTo(plotX, plotY + plotH); this.ctx.stroke();

    // X ticks: choose approx targetXTicks
    const targetXTicks = options?.targetXTicks ?? 6;
    const windowFirstIdx = Math.max(0, Math.min(data.length - 1, Math.floor(startRaw)));
    const windowLastIdx = Math.max(0, Math.min(data.length - 1, Math.floor(startRaw + visibleCount - 1)));
    const visibleFromTime = data[windowFirstIdx]?.time ?? visible[0].time;
    const visibleToTime = data[windowLastIdx]?.time ?? visible[Math.max(0, visible.length - 1)].time;
    const spanMs = visibleToTime - visibleFromTime || 1;
    // simple strategy: pick evenly spaced indices
    const xTicks: Array<{time:number, idx:number}> = [];
    for (let i = 0; i < targetXTicks; i++) {
      const frac = i / (targetXTicks - 1);
      const localIdx = Math.round(frac * Math.max(0, visibleCount - 1));
      const dataIdx = Math.max(0, Math.min(data.length - 1, Math.round(startRaw + localIdx)));
      xTicks.push({ time: data[dataIdx].time, idx: dataIdx });
    }

    // draw candles
    const stepX = plotW / Math.max(1, totalSlots - 1);
    const candleW = Math.max(2, Math.min(Math.floor(stepX * 0.7), 40));
    const outlineColor = options?.outlineColor || '#222222';
    const wickColor = options?.wickColor || outlineColor;
    const upColor = options?.upColor || '#2e7d32';
    const downColor = options?.downColor || '#d32f2f';

    // clip to plot area
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(plotX, plotY, plotW, plotH);
    this.ctx.clip();

    for (let i = 0; i < visible.length; i++) {
      const d = visible[i];
      const x = plotX + (i - startFrac) * stepX;
      const yOpen = priceToY(d.open);
      const yClose = priceToY(d.close);
      const yHigh = priceToY(d.high);
      const yLow = priceToY(d.low);
      const top = Math.min(yOpen, yClose);
      const bottom = Math.max(yOpen, yClose);

      // wick
      this.ctx.strokeStyle = wickColor; this.ctx.lineWidth = 1;
      this.ctx.beginPath(); this.ctx.moveTo(x + 0.5, yHigh); this.ctx.lineTo(x + 0.5, yLow); this.ctx.stroke();

      // body
      if (d.close > d.open) {
        this.ctx.fillStyle = upColor;
        this.ctx.fillRect(x - candleW/2, top, candleW, Math.max(1, bottom - top));
        this.ctx.strokeStyle = outlineColor; this.ctx.lineWidth = 1; this.ctx.strokeRect(x - candleW/2, top, candleW, Math.max(1, bottom - top));
      } else if (d.close < d.open) {
        this.ctx.fillStyle = downColor;
        this.ctx.fillRect(x - candleW/2, top, candleW, Math.max(1, bottom - top));
        this.ctx.strokeStyle = outlineColor; this.ctx.lineWidth = 1; this.ctx.strokeRect(x - candleW/2, top, candleW, Math.max(1, bottom - top));
      } else {
        // equal -> crosshair
        const cy = (yOpen + yClose) / 2;
        const hx = candleW * 0.9;
        this.ctx.strokeStyle = outlineColor; this.ctx.lineWidth = 1.5;
        this.ctx.beginPath(); this.ctx.moveTo(x - hx/2, cy); this.ctx.lineTo(x + hx/2, cy); this.ctx.moveTo(x, cy - hx/2); this.ctx.lineTo(x, cy + hx/2); this.ctx.stroke();
      }
    }
    this.ctx.restore();

    // draw X axis ticks and labels
    const dateFormat = (t: number) => {
      const dt = new Date(t);
      if (spanMs > 365 * 24 * 3600 * 1000) return dt.toLocaleDateString();
      if (spanMs > 7 * 24 * 3600 * 1000) return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    this.ctx.fillStyle = options?.axisLabelColor ?? '#222222';
    this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'top'; this.ctx.font = options?.font ?? '12px sans-serif';
    for (const t of xTicks) {
      const localIdx = t.idx - startRaw;
      const x = plotX + localIdx * stepX;
      // tick
      this.ctx.beginPath(); this.ctx.moveTo(x + 0.5, plotY + plotH); this.ctx.lineTo(x + 0.5, plotY + plotH + 6); this.ctx.stroke();
      // label
      this.ctx.fillText(dateFormat(t.time), x, plotY + plotH + 4 + 2);
    }

    // draw X axis baseline
    this.ctx.strokeStyle = options?.axisLabelColor ?? '#222222';
    this.ctx.beginPath(); this.ctx.moveTo(plotX, plotY + plotH); this.ctx.lineTo(plotX + plotW, plotY + plotH); this.ctx.stroke();
  }

  getLayout(data: Array<any>, options?: RendererViewportOptions): RendererLayout {
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;

    const defaultMaxVisible = options?.maxVisibleBars ?? 200;
    const rightMarginBars = options?.rightMarginBars ?? 0;
    const visibleCount = Math.min(options?.visibleCount ?? defaultMaxVisible, data.length);
    let startRaw = typeof options?.startIndex === 'number' ? options!.startIndex : Math.max(0, data.length - visibleCount);
    if (startRaw < 0) startRaw = 0;
    if (startRaw + visibleCount > data.length) startRaw = Math.max(0, data.length - visibleCount);
    const startFloor = Math.floor(startRaw);
    const visible = data.slice(startFloor, Math.min(data.length, startFloor + visibleCount + 1));
    
    const totalSlots = visibleCount + rightMarginBars;

    // compute visible price range
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const d of visible) { if (d.low < min) min = d.low; if (d.high > max) max = d.high; }
    const range = Math.max(max - min, Math.max(1e-9, Math.abs(max) * 0.001));
    const padRatio = options?.paddingRatio ?? 0.05;
    const basePad = range * padRatio;
    const minPaddingPx = options?.minPaddingPx ?? 6;
    const minPaddingPrice = (range / Math.max(1, plotH)) * minPaddingPx;
    const pad = Math.max(basePad, minPaddingPrice);
    const yMin = min - pad;
    const yMax = max + pad;

    const stepX = plotW / Math.max(1, totalSlots - 1);
    const candleW = Math.max(2, Math.min(Math.floor(stepX * 0.7), 40));

    return { plotX, plotY, plotW, plotH, gutterLeft, gutterTop, xAxisHeight, startIndex: startFloor, startIndexRaw: startRaw, visibleCount, stepX, candleW, yMin, yMax, rightMarginBars };
  }

  mapClientToData(clientX: number, clientY: number, data: Array<any>, options?: RendererViewportOptions) {
    const layout = this.getLayout(data, options);
    const { plotX, plotY, plotW, plotH, startIndex, visibleCount, stepX, yMin, yMax } = layout;
    const startRaw = (layout as any).startIndexRaw ?? startIndex;
    const startFrac = startRaw - Math.floor(startRaw);
    const localX = clientX - plotX;
    const localY = clientY - plotY;
    if (localX < -10 || localX > plotW + 10 || localY < -10 || localY > plotH + 10) return null;
    const idxFloat = (localX / stepX) + startFrac;
    const idx = Math.round(idxFloat);
    const clamped = Math.max(0, Math.min(visibleCount - 1, idx));
    const dataIdx = startIndex + clamped;
    const point = data[dataIdx];
    if (!point) return null;
    const x = plotX + (clamped - startFrac) * stepX;
    const priceAtY = yMin + (1 - (localY / plotH)) * (yMax - yMin || 0);
    return { index: dataIdx, localIndex: clamped, time: point.time, point, x, y: plotY + localY, priceAtY };
  }

  drawCrosshairAt(clientX: number, clientY: number, data: Array<any>, options?: RendererViewportOptions) {
    const layout = this.getLayout(data, options);
    const { plotX, plotY, plotW, plotH, startIndex, visibleCount, stepX, yMin, yMax } = layout as any;
    const mapped = this.mapClientToData(clientX, clientY, data, options);
    if (!mapped) return;
    const x = mapped.x;
    
    // Clamp Y to plot area
    const clampedY = Math.max(plotY, Math.min(plotY + plotH, clientY));
    
    // Calculate price at current Y position
    const t = 1 - (clampedY - plotY) / plotH;
    const priceAtY = yMin + t * (yMax - yMin);

    this.ctx.save();
    this.ctx.strokeStyle = options?.color ?? '#666666';
    this.ctx.lineWidth = options?.lineWidth ?? 1;
    // vertical line at candle
    this.ctx.beginPath(); this.ctx.moveTo(x + 0.5, plotY); this.ctx.lineTo(x + 0.5, plotY + plotH); this.ctx.stroke();
    // horizontal line at cursor Y position
    this.ctx.beginPath(); this.ctx.moveTo(plotX, clampedY + 0.5); this.ctx.lineTo(plotX + plotW, clampedY + 0.5); this.ctx.stroke();
    
    // Draw price label on Y axis
    const labelText = this.formatPrice(priceAtY);
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    const labelPadding = 4;
    const labelWidth = this.ctx.measureText(labelText).width + labelPadding * 2;
    const labelHeight = 16;
    const labelX = plotX - 4;
    const labelY = clampedY;
    
    // Background for label
    this.ctx.fillStyle = options?.color ?? '#666666';
    this.ctx.fillRect(labelX - labelWidth, labelY - labelHeight / 2, labelWidth, labelHeight);
    
    // Label text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(labelText, labelX - labelPadding, labelY);
    
    this.ctx.restore();
  }

  updateBuffers(_seriesId: string, _data: Float32Array, _offset?: number) {
    // no-op for canvas renderer
  }

  partialUpdateBuffers(_seriesId: string, _patches: Array<{offset:number; data:Float32Array}>) {
    // no-op
  }

  destroy() {
    // nothing to clean up
  }
}
