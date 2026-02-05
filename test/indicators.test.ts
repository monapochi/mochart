import { describe, expect, test } from "bun:test";
import { SMA, PivotPoints } from "../src/indicators/phase1";
import type { OhlcvPoint } from "../src/core/types";

const generateData = (length: number): OhlcvPoint[] => 
  Array.from({ length }, (_, i) => ({
    time: i * 60000,
    open: 100,
    high: 110,
    low: 90,
    close: 100 + i, // Linear uptrend: 100, 101, 102...
    volume: 1000,
  }));

describe("SMA Indicator", () => {
  test("should calculate simple moving average correctly", () => {
    const data = generateData(10); // 0..9 closes: 100..109
    const period = 5;
    // Window 0-4: 100+101+102+103+104 = 510 / 5 = 102. (Index 4)
    // Window 1-5: 101+102+103+104+105 = 515 / 5 = 103. (Index 5)
    
    const result = SMA.calculate(data, { period });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sma = result.value.sma;
    expect(sma.length).toBe(10);
    expect(sma[0]).toBe(null);
    expect(sma[3]).toBe(null);
    expect(sma[4]).toBe(102);
    expect(sma[5]).toBe(103);
    expect(sma[9]).toBe(107);
  });
});

describe("Pivot Points Indicator", () => {
  test("should calculate pivot points based on previous bar", () => {
    const data = generateData(3);
    // Bar 0: H=110, L=90, C=100. P = (110+90+100)/3 = 100.
    // Bar 1 should have P=100 from Bar 0.
    
    const result = PivotPoints.calculate(data, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pivot = result.value.pivot;
    expect(pivot[0]).toBe(null);
    expect(pivot[1]).toBe(100);
    
    // Bar 1: H=110, L=90, C=101. P = (110+90+101)/3 = 301/3 = 100.333...
    // Bar 2 should have P=100.333...
    expect(pivot[2]).toBeCloseTo(100.333, 3);
  });
});
