Mochart Plan (2026-02-05)

Status
- Core TS library structure created.
- WebGL2 fallback renderer implemented.
- WebGPU renderer implemented with candle rendering, line rendering, and compute shader execution.
- Indicator registry + phases 1–4 CPU implementations added.
- WGSL compute sources added for key indicators.
- Sub-pane layout and trade marker rendering implemented.
- Alerts runtime API wiring and cooldown handling implemented (`MoChart.evaluateAlerts`).
- i18n support integrated into indicators (`nameKey` property).
- Basic test harness established (`bun test`).

Current Implementation Summary
- Rendering: WebGPU candles + indicator lines (line-list), WebGL2 candles.
- Indicators (CPU): SMA, EMA, BB, Volume, RSI, ADX, ATR, MACD, VWAP, Vol_Ratio, %B, BB_Width, OBV, CMF, MFI, Kaufman Patterns, Trade Markers, Pivot Points, Divergence, Squeeze Alert.
- Indicators (GPU): SMA, EMA, BB, RSI, ATR, MACD, ADX, VWAP, Vol_Ratio, %B, BB_Width (wgslSource).
- Trade markers: shape support added.
- Dependency ordering and GPU input buffer reuse implemented.

Completed Items from Spec
- Pivot Points indicator (CPU).
- Divergence and Squeeze alert indicators (marker outputs + alert triggers).
- Alerts runtime API wiring and cooldown handling.
- i18n string table usage with `nameKey` support.
- Test scaffolding for indicator correctness (`test/indicators.test.ts`).

Planned Next Steps
1) Optional: true batched GPU compute execution (single-pass groups).
2) Expand unit test coverage for complex indicators (MACD, ADX).
3) Implement UI to display fired alerts.
4) Implement UI for changing language (i18n).

Notes
- WebGPU types are intentionally loose to avoid DOM type requirements.
- GPU compute currently runs per-indicator; batch execution can be layered later.
