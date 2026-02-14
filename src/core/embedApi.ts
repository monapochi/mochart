// Embed API for external integrations (Next.js friendly, SSR-safe)
import type { ChartCore, ChartCoreOptions } from './chart';

export type EventHandler = (payload?: any) => void;

export interface ChartEmbedOptions extends ChartCoreOptions {
  enableTooltip?: boolean;
  showLegend?: boolean;
  enableCrosshair?: boolean;
  attachEvents?: boolean;
  smoothScroll?: boolean;
  symbol?: string;
  tooltipFormatter?: (point: any, index: number) => string;
}

export interface ChartEmbedAPI {
  create(container: HTMLElement, options?: ChartEmbedOptions): Promise<ChartCore>;
  connectFeed(adapter: any): Promise<void>;
  disconnectFeed(): Promise<void>;
  on(event: string, handler: EventHandler): void;
  off(event: string, handler?: EventHandler): void;
  destroy(): Promise<void>;
}

type ListenerBag = {
  onPointerDown: (ev: PointerEvent) => void;
  onPointerMove: (ev: PointerEvent) => void;
  onPointerUp: (ev: PointerEvent) => void;
  onWheel: (ev: WheelEvent) => void;
  onTouchStart: (ev: TouchEvent) => void;
  onTouchMove: (ev: TouchEvent) => void;
  onTouchEnd: (ev: TouchEvent) => void;
  onLostPointerCapture: () => void;
};

// Factory that returns a minimal API object. Implementation lives in src/core/chart.ts
export function createEmbedAPI(): ChartEmbedAPI {
  // Concrete embed API implementation: owns DOM event wiring and tooltip
  class ChartEmbed implements ChartEmbedAPI {
    private core: ChartCore | null = null;
    private container: HTMLElement | null = null;
    private handlers: Map<string, Set<EventHandler>> = new Map();
    private tooltipEl: HTMLElement | null = null;
    private legendEl: HTMLElement | null = null;
    private pointerId: number | null = null;
    private dragging = false;
    private dragStartX = 0;
    private dragStartIndex = 0;
    private opts: ChartEmbedOptions = {};
    private listenersRef: ListenerBag | null = null;
    // touch pinch state
    private _pinchStartDist: number | null = null;
    private _pinchLastDist: number | null = null;
    private _pinchStartCenterClientX: number | null = null;
    private _pinchStartCenterIndex: number | undefined = undefined;
    private _pinchStartCenterRatio: number | undefined = undefined;
    private _wheelPanRemainderPx: number = 0;

    async create(container: HTMLElement, options?: ChartEmbedOptions): Promise<ChartCore> {
      const mod = await import('./chart');
      this.container = container;
      this.opts = options ?? {};
      this.core = new mod.ChartCore(container, options);
      // proxy core events
      this.core.on('rangeChanged', (p) => this.emit('rangeChanged', p));
      this.core.on('seriesUpdated', (p) => this.emit('seriesUpdated', p));
      // attach DOM events if requested
      if (this.opts.attachEvents !== false) this.attachEvents();
      if (this.opts.enableTooltip) this.enableTooltip(true);
      if (this.opts.showLegend) this._ensureLegend();
      return this.core;
    }

    private getCanvas(): HTMLCanvasElement | null {
      if (!this.container) return null;
      if (this.container.tagName.toLowerCase() === 'canvas') return this.container as unknown as HTMLCanvasElement;
      const c = this.container.querySelector('canvas');
      return c as HTMLCanvasElement | null;
    }

    private attachEvents() {
      const canvas = this.getCanvas();
      if (!canvas || !this.core) return;

      const onPointerDown = (ev: PointerEvent) => {
        canvas.setPointerCapture(ev.pointerId);
        this.pointerId = ev.pointerId;
        this.dragging = true;
        this.dragStartX = ev.clientX;
        const vr = this.core!.getVisibleRange();
        this.dragStartIndex = vr ? vr.from : 0;
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (!this.core) return;
        if (this.dragging && this.pointerId === ev.pointerId) {
          const primaryData = this._getPrimarySeriesData();
          const vr = this.core!.getVisibleRange();
          const dragOpts = vr && typeof vr.from === 'number' && typeof vr.to === 'number'
            ? { ...this.opts, startIndex: vr.from, visibleCount: vr.to - vr.from + 1, rightMarginBars: vr.rightMarginBars ?? 0 }
            : this.opts;
          const layout = this.core.getLayout(dragOpts);
          const stepX = layout ? layout.stepX : 10;
          const dx = ev.clientX - this.dragStartX;
          const deltaIndex = Math.round(-dx / stepX);
          const targetIndex = this.dragStartIndex + deltaIndex;
          const currentFrom = this.core!.getVisibleRange()?.from ?? 0;
          if (targetIndex !== currentFrom) {
            this.core!.panBy(targetIndex - currentFrom);
          }
          return;
        }
        // hover: crosshair and tooltip are independent
        if (!this.dragging) {
          const rect = canvas.getBoundingClientRect();
          const mx = ev.clientX - rect.left;
          const my = ev.clientY - rect.top;
          const data = this._getPrimarySeriesData();
          
          // Get current viewport and create opts with it
          const vr = this.core!.getVisibleRange();
          const viewportOpts = vr && typeof vr.from === 'number' && typeof vr.to === 'number'
            ? { ...this.opts, startIndex: vr.from, visibleCount: vr.to - vr.from + 1, rightMarginBars: vr.rightMarginBars ?? 0 }
            : this.opts;
          
          const mapped = this.core.mapClientToData(mx, my, viewportOpts);
          const layout = this.core.getLayout(viewportOpts);
          
          // Check if cursor is in plot area
          const inPlotArea = layout && mx >= layout.plotX && mx <= layout.plotX + layout.plotW
            && my >= layout.plotY && my <= layout.plotY + layout.plotH;
          
          const primarySeriesId = this.core.getPrimarySeriesId();
          const entry = primarySeriesId ? this.core.getSeriesEntry(primarySeriesId) : null;
          
          // Always redraw series first
          if (primarySeriesId) {
            this.core.redraw();
          }
          
          // Crosshair: show when in plot area (independent of tooltip)
          const enableCrosshair = this.opts.enableCrosshair !== false; // default true
          if (enableCrosshair && inPlotArea && mapped) {
            this.core.drawCrosshair(mx, my, viewportOpts);
          }
          
          // Tooltip: completely independent, show when over candle
          if (this.tooltipEl && this.opts.enableTooltip && inPlotArea && mapped) {
            const candleW = layout ? layout.candleW : 10;
            const dx = Math.abs(mx - mapped.x);
            const horizHit = dx <= (candleW / 2 + 4);
            let vertHit = true;
            if (layout && typeof layout.yMin === 'number' && typeof layout.yMax === 'number') {
              const { plotY, plotH, yMin, yMax } = layout as any;
              const priceToY = (p: number) => {
                const t = (p - yMin) / (yMax - yMin || 1);
                return plotY + (1 - t) * plotH;
              };
              const yHigh = priceToY(mapped.point.high);
              const yLow = priceToY(mapped.point.low);
              const top = Math.min(yHigh, yLow);
              const bottom = Math.max(yHigh, yLow);
              const vertTol = 6;
              vertHit = (my >= top - vertTol && my <= bottom + vertTol);
            }
            
            if (horizHit && vertHit) {
              const p = mapped.point;
              const html = this.opts.tooltipFormatter ? this.opts.tooltipFormatter(p, mapped.index) : `<div style="font-weight:600">${new Date(mapped.time).toLocaleDateString()}</div><div>O ${p.open}</div><div>H ${p.high}</div><div>L ${p.low}</div><div>C ${p.close}</div><div>V ${p.volume.toLocaleString()}</div>`;
              this.tooltipEl.innerHTML = html;
              
              const containerRect = this.container!.getBoundingClientRect();
              this.tooltipEl.style.display = 'block';
              this.tooltipEl.style.left = '0px';
              this.tooltipEl.style.top = '0px';
              const tipRect = this.tooltipEl.getBoundingClientRect();
              const tipW = tipRect.width;
              const tipH = tipRect.height;
              const clientXRel = ev.clientX - containerRect.left;
              const clientYRel = ev.clientY - containerRect.top;
              let left = clientXRel + 12;
              let top = clientYRel + 12;
              const canvasMidY = rect.height / 2;
              if (ev.clientY - rect.top > canvasMidY) {
                top = clientYRel - tipH - 12;
              }
              if (left + tipW > containerRect.width - 6) left = Math.max(6, clientXRel - tipW - 12);
              if (left < 6) left = 6;
              if (top < 6) top = 6;
              this.tooltipEl.style.left = left + 'px';
              this.tooltipEl.style.top = top + 'px';
            } else {
              this.tooltipEl.style.display = 'none';
            }
          } else if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
          }
          
          // Update legend with hovered candle info (independent)
          if (this.legendEl && mapped) {
            const p = mapped.point;
            this._updateLegend(`${this.opts.symbol ?? ''}`, `C ${p.close}` + ` (${new Date(mapped.time).toLocaleDateString()})`);
          }
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (this.pointerId !== ev.pointerId) return;
        try { canvas.releasePointerCapture(ev.pointerId); } catch {};
        this.dragging = false; this.pointerId = null;
      };

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        if (!this.core) return;
        const rect = canvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const mx = cx;
        const vr = this.core!.getVisibleRange();
        const rawStartIndex = this.core.getRawStartIndex();
        const wheelOpts = vr && typeof vr.from === 'number' && typeof vr.to === 'number'
          ? { ...this.opts, startIndex: (typeof rawStartIndex === 'number' ? rawStartIndex : vr.from), visibleCount: vr.to - vr.from + 1, rightMarginBars: vr.rightMarginBars ?? 0 }
          : this.opts;

        if (ev.ctrlKey) {
          // Pinch-to-zoom on Mac trackpad (or Ctrl+wheel on mouse)
          this._wheelPanRemainderPx = 0;
          const mapped = this.core.mapClientToData(mx, rect.height / 2, wheelOpts);
          const centerIndex = mapped ? mapped.index : undefined;
          const factor = ev.deltaY < 0 ? 1 / 1.15 : 1.15;
          this.core.zoomAt(factor, centerIndex);
        } else {
          // Two-finger slide / wheel scroll: pan only (avoid unintended zoom)
          const primaryData = this._getPrimarySeriesData();
          const layout = this.core.getLayout(wheelOpts);
          const stepX = layout ? layout.stepX : 10;
          const dominantDelta = Math.abs(ev.deltaX) >= Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
          const smoothScroll = this.opts.smoothScroll !== false;
          if (smoothScroll) {
            this._wheelPanRemainderPx = 0;
            const deltaBars = dominantDelta / Math.max(1e-6, stepX);
            if (deltaBars !== 0) this.core.panByBars(deltaBars);
          } else {
            const accumulatedPx = this._wheelPanRemainderPx + dominantDelta;
            const deltaIndex = accumulatedPx > 0
              ? Math.floor(accumulatedPx / stepX)
              : Math.ceil(accumulatedPx / stepX);
            this._wheelPanRemainderPx = accumulatedPx - deltaIndex * stepX;
            if (deltaIndex !== 0) {
              this.core.panBy(deltaIndex);
            }
          }
        }
      };

      // touch events: support pinch-zoom
      const onTouchStart = (ev: TouchEvent) => {
        if (!canvas || !this.core) return;
        if (ev.touches.length === 2) {
          ev.preventDefault();
          const t0 = ev.touches[0];
          const t1 = ev.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          this._pinchStartDist = Math.hypot(dx, dy);
          this._pinchLastDist = this._pinchStartDist;
          this._pinchStartCenterClientX = (t0.clientX + t1.clientX) / 2 - canvas.getBoundingClientRect().left;
          const vr = this.core!.getVisibleRange();
          const touchOpts = vr && typeof vr.from === 'number' && typeof vr.to === 'number'
            ? { ...this.opts, startIndex: vr.from, visibleCount: vr.to - vr.from + 1, rightMarginBars: vr.rightMarginBars ?? 0 }
            : this.opts;
          const layout = this.core.getLayout(touchOpts);
          if (layout && typeof this._pinchStartCenterClientX === 'number') {
            const localX = this._pinchStartCenterClientX - layout.plotX;
            const slot = localX / Math.max(1e-6, layout.stepX);
            const slotsDenom = Math.max(1, (layout.visibleCount + (layout.rightMarginBars ?? 0) - 1));
            this._pinchStartCenterRatio = Math.max(0, Math.min(1, slot / slotsDenom));
          } else {
            this._pinchStartCenterRatio = undefined;
          }
          const rect = canvas.getBoundingClientRect();
          const mapped = this.core.mapClientToData(this._pinchStartCenterClientX, rect.height / 2, touchOpts);
          this._pinchStartCenterIndex = mapped ? mapped.index : undefined;
        }
      };

      const onTouchMove = (ev: TouchEvent) => {
        if (!canvas || !this.core) return;
        if (ev.touches.length === 2 && this._pinchStartDist && this._pinchLastDist) {
          ev.preventDefault();
          const t0 = ev.touches[0];
          const t1 = ev.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          const dist = Math.hypot(dx, dy);
          const factor = this._pinchLastDist > 0 ? dist / this._pinchLastDist : 1;
          const clamped = Math.max(0.8, Math.min(1.25, factor));
          this.core.zoomAt(1 / clamped, this._pinchStartCenterIndex, this._pinchStartCenterRatio);
          if (typeof this._pinchStartCenterClientX === 'number' && typeof this._pinchStartCenterIndex === 'number') {
            const vr = this.core.getVisibleRange();
            const touchOpts = vr && typeof vr.from === 'number' && typeof vr.to === 'number'
              ? { ...this.opts, startIndex: vr.from, visibleCount: vr.to - vr.from + 1, rightMarginBars: vr.rightMarginBars ?? 0 }
              : this.opts;
            const rect = canvas.getBoundingClientRect();
            const mappedAfter = this.core.mapClientToData(this._pinchStartCenterClientX, rect.height / 2, touchOpts);
            if (mappedAfter) {
              const correction = this._pinchStartCenterIndex - mappedAfter.index;
              if (correction !== 0) this.core.panBy(correction);
            }
          }
          this._pinchLastDist = dist;
        }
      };

      const onTouchEnd = (ev: TouchEvent) => {
        if (ev.touches.length < 2) {
          this._pinchStartDist = null;
          this._pinchLastDist = null;
          this._pinchStartCenterClientX = null;
          this._pinchStartCenterIndex = undefined;
          this._pinchStartCenterRatio = undefined;
        }
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);
      canvas.addEventListener('touchcancel', onTouchEnd);

      // handle lost pointer capture (e.g., when window loses focus)
      const onLostPointerCapture = () => {
        this.dragging = false;
        this.pointerId = null;
      };
      canvas.addEventListener('lostpointercapture', onLostPointerCapture);

      // store listeners for later detach
      this.listenersRef = { onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd, onLostPointerCapture };
    }

    private _getPrimarySeriesData() {
      if (!this.core) return [];
      return Array.from(this.core.getPrimaryData());
    }

    enableTooltip(v: boolean) {
      this.opts.enableTooltip = !!v;
      if (!this.container) return;
      if (v) {
        if (!this.tooltipEl) this.tooltipEl = this._createTooltip();
        this.tooltipEl.style.display = 'none';
      } else {
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';
      }
    }

    private _ensureLegend() {
      if (!this.container) return;
      if (!this.legendEl) this.legendEl = this._createLegend();
      // update initial content
      this._updateLegend(this.opts.symbol ?? '', '');
    }

    private _createLegend() {
      if (!this.container) throw new Error('No container');
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.left = '8px';
      div.style.top = '8px';
      div.style.pointerEvents = 'none';
      div.style.background = 'rgba(255,255,255,0.85)';
      div.style.color = '#000';
      div.style.padding = '6px 8px';
      div.style.borderRadius = '4px';
      div.style.font = '12px sans-serif';
      div.style.zIndex = '900';
      this.container.appendChild(div);
      return div;
    }

    private _updateLegend(left: string, right: string) {
      if (!this.legendEl) return;
      this.legendEl.innerHTML = `<div style="font-weight:600">${left}</div><div style="opacity:0.85">${right}</div>`;
    }

    private _createTooltip() {
      if (!this.container) throw new Error('No container');
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.pointerEvents = 'none';
      div.style.background = 'rgba(0,0,0,0.8)';
      div.style.color = '#fff';
      div.style.padding = '6px 8px';
      div.style.borderRadius = '4px';
      div.style.font = '12px sans-serif';
      div.style.display = 'none';
      div.style.zIndex = '1000';
      this.container.appendChild(div);
      return div;
    }

    on(event: string, handler: EventHandler) {
      const set = this.handlers.get(event) ?? new Set();
      set.add(handler);
      this.handlers.set(event, set);
    }
    off(event: string, handler?: EventHandler) {
      if (!this.handlers.has(event)) return;
      if (!handler) { this.handlers.delete(event); return; }
      this.handlers.get(event)!.delete(handler);
    }

    private emit(event: string, payload?: any) {
      const set = this.handlers.get(event);
      if (!set) return;
      for (const cb of Array.from(set)) cb(payload);
    }

    async connectFeed(adapter: any): Promise<void> {
      if (!this.core) throw new Error('Chart not created');
      await this.core.connectFeed(adapter);
    }
    async disconnectFeed(): Promise<void> {
      if (!this.core) return;
      await this.core.disconnectFeed();
    }

    async destroy(): Promise<void> {
      // detach events
      const canvas = this.getCanvas();
      const l = this.listenersRef;
      if (canvas && l) {
        canvas.removeEventListener('pointerdown', l.onPointerDown);
        window.removeEventListener('pointermove', l.onPointerMove);
        window.removeEventListener('pointerup', l.onPointerUp);
        canvas.removeEventListener('wheel', l.onWheel as EventListener);
        canvas.removeEventListener('touchstart', l.onTouchStart as EventListener);
        canvas.removeEventListener('touchmove', l.onTouchMove as EventListener);
        canvas.removeEventListener('touchend', l.onTouchEnd as EventListener);
        canvas.removeEventListener('touchcancel', l.onTouchEnd as EventListener);
        canvas.removeEventListener('lostpointercapture', l.onLostPointerCapture);
      }
      if (this.tooltipEl && this.tooltipEl.parentElement) this.tooltipEl.parentElement.removeChild(this.tooltipEl);
      if (this.legendEl && this.legendEl.parentElement) this.legendEl.parentElement.removeChild(this.legendEl);
      if (this.core) await this.core.destroy();
      this.handlers.clear();
      this.core = null; this.container = null; this.tooltipEl = null;
      this.listenersRef = null;
    }

    // public convenience methods
    setViewport(from: number, to: number) { this.core?.setViewport(from, to); }
    panBy(deltaIndex: number) { this.core?.panBy(deltaIndex); }
    zoomAt(factor: number, centerIndex?: number) { this.core?.zoomAt(factor, centerIndex); }
    attach(container: HTMLElement) { this.container = container; }
    detach() { /* no-op: events removal in destroy */ }
  }

  return new ChartEmbed();
}
