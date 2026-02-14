import { describe, expect, test } from "bun:test";
import { ChartCore } from "../src/core/chart";
import { createEmbedAPI } from "../src/core/embedApi";
import type { OhlcvPoint } from "../src/core/types";

type FakeCtx = {
  setTransform: (...args: any[]) => void;
  clearRect: (...args: any[]) => void;
  fillRect: (...args: any[]) => void;
  beginPath: (...args: any[]) => void;
  moveTo: (...args: any[]) => void;
  lineTo: (...args: any[]) => void;
  stroke: (...args: any[]) => void;
  fillText: (...args: any[]) => void;
  measureText: (text: string) => { width: number };
  strokeRect: (...args: any[]) => void;
  save: (...args: any[]) => void;
  restore: (...args: any[]) => void;
  clip: (...args: any[]) => void;
  rect: (...args: any[]) => void;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
};

const createFakeCanvas = (): HTMLCanvasElement => {
  const ctx: FakeCtx = {
    setTransform: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fillText: () => {},
    measureText: (text: string) => ({ width: text.length * 6 }),
    strokeRect: () => {},
    save: () => {},
    restore: () => {},
    clip: () => {},
    rect: () => {},
    font: "12px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
  };

  const canvas: Partial<HTMLCanvasElement> = {
    tagName: "canvas",
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    style: { width: "800px", height: "600px" } as CSSStyleDeclaration,
    getContext: ((kind: string) => (kind === "2d" ? (ctx as unknown as CanvasRenderingContext2D) : null)) as any,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  };

  return canvas as HTMLCanvasElement;
};

const ensureWindow = () => {
  const g = globalThis as any;
  if (!g.window) {
    g.window = {
      devicePixelRatio: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  } else {
    g.window.devicePixelRatio = g.window.devicePixelRatio ?? 1;
    g.window.addEventListener = g.window.addEventListener ?? (() => {});
    g.window.removeEventListener = g.window.removeEventListener ?? (() => {});
  }
};

const generateData = (length: number): OhlcvPoint[] =>
  Array.from({ length }, (_, i) => ({
    time: i * 60_000,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 101 + i,
    volume: 1000 + i,
  }));

describe("ChartCore public accessor APIs", () => {
  test("should expose primary-series and renderer delegate methods", async () => {
    ensureWindow();
    const canvas = createFakeCanvas();
    const core = new ChartCore(canvas as unknown as HTMLElement, {});

    const seriesId = await core.addSeries({ id: "main", type: "candlestick" });
    await core.setSeriesData(seriesId, generateData(80));

    expect(core.getPrimarySeriesId()).toBe("main");
    expect(core.getPrimaryData().length).toBe(80);
    expect(core.getPrimarySeriesOptions()?.type).toBe("candlestick");
    expect(core.getSeriesEntry("main")?.data.length).toBe(80);
    expect(typeof core.getRawStartIndex()).toBe("number");

    const layout = core.getLayout();
    expect(layout).toBeTruthy();
    expect(layout!.plotW).toBeGreaterThan(0);

    const mapped = core.mapClientToData(300, 300);
    expect(mapped).toBeTruthy();
    expect(mapped!.index).toBeGreaterThanOrEqual(0);

    expect(() => core.drawCrosshair(300, 300)).not.toThrow();
    expect(() => core.redraw()).not.toThrow();
  });
});

describe("EmbedAPI viewport controls", () => {
  test("should manipulate viewport through embed convenience methods", async () => {
    ensureWindow();
    const embed = createEmbedAPI();
    const canvas = createFakeCanvas();

    const core = await embed.create(canvas as unknown as HTMLElement, {
      attachEvents: false,
      enableTooltip: false,
      showLegend: false,
    });

    const seriesId = await core.addSeries({ id: "main", type: "candlestick" });
    await core.setSeriesData(seriesId, generateData(200));

    (embed as any).setViewport(20, 69);
    const afterSet = core.getVisibleRange();
    expect(afterSet?.from).toBe(20);
    expect(afterSet?.to).toBe(69);

    (embed as any).panBy(10);
    const afterPan = core.getVisibleRange();
    expect(afterPan?.from).toBe(30);

    const visibleBeforeZoom = (afterPan!.to - afterPan!.from) + 1;
    (embed as any).zoomAt(1.2);
    const afterZoom = core.getVisibleRange();
    const visibleAfterZoom = (afterZoom!.to - afterZoom!.from) + 1;
    expect(visibleAfterZoom).toBeGreaterThanOrEqual(visibleBeforeZoom);

    await embed.destroy();
  });
});
