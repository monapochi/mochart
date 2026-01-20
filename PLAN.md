Mochart Plan (2026-01-20)

Status
- Core TS library structure created.
- WebGL2 fallback renderer implemented.
- WebGPU renderer implemented with candle rendering, line rendering, and compute shader execution.
- Indicator registry + phases 1–4 CPU implementations added.
- WGSL compute sources added for key indicators.
- Sub-pane layout and trade marker rendering implemented.

Current Implementation Summary
- Rendering: WebGPU candles + indicator lines (line-list), WebGL2 candles.
- Indicators (CPU): SMA, EMA, BB, Volume, RSI, ADX, ATR, MACD, VWAP, Vol_Ratio, %B, BB_Width, OBV, CMF, MFI, Kaufman Patterns, Trade Markers.
- Indicators (GPU): SMA, EMA, BB, RSI, ATR, MACD, ADX, VWAP, Vol_Ratio, %B, BB_Width (wgslSource).
- Trade markers: shape support added.
- Dependency ordering and GPU input buffer reuse implemented.

Remaining Items from Spec
- Pivot Points indicator (CPU).
- Divergence and Squeeze alert indicators (marker outputs).
- Alerts runtime API wiring and cooldown handling.
- i18n string table usage.
- Test scaffolding for indicator correctness.
- Optional: true batched GPU compute execution (single-pass groups).

Planned Next Steps
1) Add Pivot Points CPU indicator (main overlay).
2) Add Divergence/Squeeze alert indicators (marker outputs) and marker rendering from indicator outputs.
3) Implement alert subscription API + cooldown handling.
4) Add i18n module (simple dictionary + helper).
5) Add minimal test harness (indicator unit tests) if needed.

Notes
- WebGPU types are intentionally loose to avoid DOM type requirements.
- GPU compute currently runs per-indicator; batch execution can be layered later.
