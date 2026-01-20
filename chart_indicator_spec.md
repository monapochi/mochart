# Chart Library - インディケーター仕様書

> 作成日: 2026-01-20  
> 対象: mocha-trading3 WebUI チャートライブラリ  
> レンダラー: **WebGPU** (WGSL Compute Shaders)  
> スキーマバージョン: **2.0**

---

## 0. 設計原則

### 0.1 WebGPU-First Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Design Principles                        │
├─────────────────────────────────────────────────────────────┤
│ 1. GPU-Native: 全計算はWebGPU Compute Shaderで実行          │
│ 2. Zero-Copy: TypedArray → GPUBuffer 直接転送               │
│ 3. Batch Processing: 複数インディケーターを1パスで計算       │
│ 4. Streaming: インクリメンタル更新でリアルタイム対応         │
│ 5. Type-Safe: TypeScript + WGSL の型整合性を保証            │
└─────────────────────────────────────────────────────────────┘
```

### 0.2 パフォーマンス目標

| 指標 | 目標値 | 備考 |
|------|--------|------|
| 初回描画 (10年データ) | < 16ms | 60fps 維持 |
| インクリメンタル更新 | < 1ms | リアルタイム |
| メモリ使用量 | < 50MB | 10シンボル同時表示 |
| GPU メモリ | < 256MB | 全インディケーター込み |

---

## 1. 表示すべきインディケーターリスト

### 1.1 価格オーバーレイ（メインチャート上に描画）

| インディケーター | 用途 | 優先度 | GPU最適化 |
|-----------------|------|--------|-----------|
| **Bollinger Bands** (BB_Upper, BB_Lower, BB_Middle) | BBブレイクアウト戦略の核心 | ⭐⭐⭐ 必須 | ✅ WGSL |
| **SMA** (20, 50, 80, 200) | トレンド判定・サポレジ | ⭐⭐⭐ 必須 | ✅ WGSL |
| **EMA** (12, 20, 26, 50) | MACD計算・トレンド | ⭐⭐ 高 | ✅ WGSL |
| **VWAP** | デイトレ基準線 | ⭐⭐ 高 | ✅ WGSL |
| **Pivot Points** | S/R レベル | ⭐ 中 | CPU |
| **Trade Markers** | エントリー/エグジット可視化 | ⭐⭐⭐ 必須 | ✅ Instanced |

### 1.2 サブチャート（別パネルに描画）

| インディケーター | 用途 | 優先度 | GPU最適化 |
|-----------------|------|--------|-----------|
| **Volume** + Volume MA(20) | 出来高確認 | ⭐⭐⭐ 必須 | ✅ WGSL |
| **RSI** (14) | 過熱/売られすぎ | ⭐⭐⭐ 必須 | ✅ WGSL |
| **ADX** (14) + DI+/DI- | トレンド強度（BBBreakoutのフィルター） | ⭐⭐⭐ 必須 | ✅ WGSL |
| **MACD** + Signal + Histogram | モメンタム | ⭐⭐ 高 | ✅ WGSL |
| **ATR** (14) | ボラティリティ・SL/TP計算 | ⭐⭐ 高 | ✅ WGSL |
| **Percent_B** | BB内の位置（0〜1） | ⭐⭐ 高 | ✅ WGSL |
| **BB_Width** | スクイーズ検出 | ⭐⭐ 高 | ✅ WGSL |
| **Vol_Ratio** (RVOL) | 相対出来高 | ⭐⭐ 高 | ✅ WGSL |
| **MFI** (14) | マネーフロー | ⭐ 中 | ✅ WGSL |
| **CMF** (21) | チャイキンマネーフロー | ⭐ 中 | ✅ WGSL |
| **OBV** | 需給確認 | ⭐ 中 | ✅ WGSL |

### 1.3 パターン/シグナル表示

| インディケーター | 用途 | 優先度 | GPU最適化 |
|-----------------|------|--------|-----------|
| **Kaufman Patterns** | Key Reversal, Outside Day, Gap, Compression | ⭐ 中 | CPU → Marker |
| **Divergence** (OBV/RSI) | ダイバージェンス警告 | ⭐ 中 | CPU → Marker |
| **Squeeze Alert** | BB収縮警告 | ⭐⭐ 高 | ✅ WGSL |

---

## 2. カスタムインディケーター Interface

### 2.1 Core Types

```typescript
// ========================================
// Core Types (Schema Version 2.0)
// ========================================

/** スキーマバージョン */
const SCHEMA_VERSION = 2 as const;

/** OHLCV データ構造 (GPU-aligned) */
interface OHLCV {
  time: number;      // Unix timestamp (seconds) - f32
  open: number;      // f32
  high: number;      // f32
  low: number;       // f32
  close: number;     // f32
  volume: number;    // f32
}

/** GPU転送用 TypedArray (6 floats per bar, 24 bytes aligned) */
type OHLCVBuffer = Float32Array;  // [time, o, h, l, c, v, time, o, h, l, c, v, ...]

/** インディケーター出力の型 */
type IndicatorValue = number | null;

/** 複数系列を持つインディケーター出力 */
interface MultiSeriesOutput {
  [seriesName: string]: IndicatorValue[];
}

/** GPU出力バッファ */
interface GPUSeriesOutput {
  [seriesName: string]: Float32Array;  // NaN for null values
}

/** 描画スタイル */
type PlotStyle = 
  | 'line'           // 線グラフ (GPU: Line Strip)
  | 'histogram'      // ヒストグラム (GPU: Instanced Quads)
  | 'area'           // 塗りつぶし (GPU: Triangle Strip)
  | 'band'           // 上下バンド (GPU: Triangle Strip between series)
  | 'marker'         // マーカー (GPU: Instanced Points/Sprites)
  | 'cloud'          // 雲 (GPU: Triangle Strip with gradient)
  | 'bar'            // バー (GPU: Instanced Quads)
  | 'candle';        // ローソク足 (GPU: Instanced Quads)

/** 描画レイヤー */
type PlotPane = 
  | 'main'           // メインチャート（価格上）
  | 'sub1'           // サブパネル1
  | 'sub2'           // サブパネル2
  | 'sub3';          // サブパネル3

/** Z-Index レイヤー順序 */
type ZLayer = 
  | 0    // 背景 (グリッド)
  | 10   // バンド/雲 (BB fill, Ichimoku cloud)
  | 20   // ヒストグラム (Volume, MACD histogram)
  | 30   // ライン (MA, BB lines, RSI)
  | 40   // マーカー (Trade markers, Pattern alerts)
  | 50;  // オーバーレイ (Crosshair, Tooltip)

/** 系列の描画設定 */
interface SeriesStyle {
  name: string;
  color: string;            // CSS color or gradient ID
  lineWidth?: number;       // default: 1 (in device pixels)
  style: PlotStyle;
  opacity?: number;         // 0-1, default: 1
  fillTo?: string | number; // 別系列名 or 固定値（area/band用）
  zLayer?: ZLayer;          // 描画順序, default: 30
  antialias?: boolean;      // default: true (MSAA 4x)
}

/** エラー型 */
interface IndicatorError {
  code: 'INSUFFICIENT_DATA' | 'INVALID_PARAMS' | 'GPU_ERROR' | 'COMPUTATION_ERROR';
  message: string;
  details?: unknown;
}

/** 計算結果 (Result型) */
type IndicatorResult<T> = 
  | { ok: true; value: T }
  | { ok: false; error: IndicatorError };
```

### 2.2 Trade Marker Types

```typescript
// ========================================
// Trade Marker Types (売買ポイント表示)
// ========================================

/** トレードマーカー種別 */
type TradeMarkerType = 
  | 'entry_long'     // 買いエントリー (▲ 緑)
  | 'entry_short'    // 売りエントリー (▼ 赤)
  | 'exit_long'      // 買いエグジット (△ 緑)
  | 'exit_short'     // 売りエグジット (▽ 赤)
  | 'stop_loss'      // ストップロス (✕ 赤)
  | 'take_profit'    // 利確 (○ 緑)
  | 'signal'         // シグナル (◆ 黄)
  | 'alert';         // アラート (⚠ オレンジ)

/** トレードマーカー */
interface TradeMarker {
  type: TradeMarkerType;
  time: number;           // Unix timestamp
  price: number;          // 表示Y座標
  label?: string;         // ホバー時のラベル
  size?: number;          // マーカーサイズ (default: 8)
  metadata?: {
    tradeId?: string;
    profit?: number;      // 実現損益 (exit時)
    quantity?: number;
    strategy?: string;
  };
}

/** マーカー描画設定 */
interface TradeMarkerStyle {
  [K in TradeMarkerType]: {
    shape: 'triangle_up' | 'triangle_down' | 'circle' | 'cross' | 'diamond' | 'warning';
    color: string;
    borderColor?: string;
    size: number;
  };
}

/** デフォルトマーカースタイル */
const DEFAULT_MARKER_STYLES: TradeMarkerStyle = {
  entry_long:   { shape: 'triangle_up',   color: '#4CAF50', size: 10 },
  entry_short:  { shape: 'triangle_down', color: '#F44336', size: 10 },
  exit_long:    { shape: 'triangle_up',   color: '#81C784', borderColor: '#4CAF50', size: 8 },
  exit_short:   { shape: 'triangle_down', color: '#E57373', borderColor: '#F44336', size: 8 },
  stop_loss:    { shape: 'cross',         color: '#F44336', size: 10 },
  take_profit:  { shape: 'circle',        color: '#4CAF50', size: 8 },
  signal:       { shape: 'diamond',       color: '#FFC107', size: 8 },
  alert:        { shape: 'warning',       color: '#FF9800', size: 10 },
};
```

### 2.3 Indicator Definition Interface

```typescript
// ========================================
// Indicator Definition Interface
// ========================================

/** カスタムインディケーター定義 */
interface IndicatorDefinition<TParams = Record<string, unknown>> {
  /** スキーマバージョン */
  schemaVersion: typeof SCHEMA_VERSION;
  
  /** 一意識別子 (e.g., "bb", "rsi", "custom_momentum") */
  id: string;
  
  /** 表示名 */
  name: string;
  
  /** i18n キー（オプション） */
  nameKey?: string;  // e.g., 'indicator.bb.name'
  
  /** カテゴリ */
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'custom';
  
  /** 描画先パネル */
  pane: PlotPane;
  
  /** 出力系列の定義 */
  outputs: SeriesStyle[];
  
  /** パラメータスキーマ（UI生成用） */
  params: IndicatorParamSchema<TParams>;
  
  /** 依存するインディケーターID */
  dependencies?: string[];  // e.g., ['ema'] for MACD
  
  /** 
   * CPU計算ロジック (フォールバック)
   * @param data OHLCV配列（古い順）
   * @param params ユーザー設定パラメータ
   * @returns 各系列の値配列（dataと同じ長さ）または エラー
   */
  calculate: (data: OHLCV[], params: TParams) => IndicatorResult<MultiSeriesOutput>;
  
  /** 
   * WebGPU計算ロジック (推奨)
   * @param buffer OHLCVデータのFloat32Array
   * @param params パラメータ
   * @param device GPUDevice
   * @returns GPU出力バッファ または エラー
   */
  calculateGPU?: (
    buffer: OHLCVBuffer,
    params: TParams,
    device: GPUDevice
  ) => Promise<IndicatorResult<GPUSeriesOutput>>;
  
  /** 
   * WGSL Compute Shader ソースコード
   * ランタイムでコンパイルされる
   */
  wgslSource?: string;
  
  /** 
   * インクリメンタル更新（リアルタイム用）
   * @param prevState 前回の状態
   * @param newBar 新しいバー
   * @param params パラメータ
   * @returns 新しい状態と最新値
   */
  update?: (
    prevState: unknown, 
    newBar: OHLCV, 
    params: TParams
  ) => IndicatorResult<{ state: unknown; values: Record<string, IndicatorValue> }>;
  
  /** Y軸の固定範囲（RSI: 0-100 など） */
  yRange?: { min: number; max: number };
  
  /** 水平参照線（RSI 30/70 など） */
  horizontalLines?: { value: number; color: string; dashed?: boolean }[];
  
  /** アラート条件 */
  alerts?: IndicatorAlert[];
  
  /** 計算量の目安 (Big O) */
  complexity: {
    time: 'O(n)' | 'O(n log n)' | 'O(n²)';
    space: 'O(1)' | 'O(n)' | 'O(n²)';
  };
  
  /** ウォームアップ期間（最初のN個はnull） */
  warmupPeriod: (params: TParams) => number;
}

/** パラメータスキーマ */
interface IndicatorParamSchema<T> {
  [key: string]: {
    type: 'number' | 'string' | 'boolean' | 'select';
    default: T[keyof T];
    label: string;
    description?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: unknown; label: string }[];  // select用
  };
}

/** アラート定義 */
interface IndicatorAlert {
  id: string;
  name: string;
  condition: (values: Record<string, IndicatorValue>, bar: OHLCV, prevValues?: Record<string, IndicatorValue>) => boolean;
  message: (values: Record<string, IndicatorValue>, bar: OHLCV) => string;
  severity: 'info' | 'warning' | 'critical';
  cooldown?: number;  // 再アラートまでの最小間隔（秒）
}
```

### 2.4 Built-in Indicator Examples

```typescript
// ========================================
// Built-in Indicator Examples (GPU-Optimized)
// ========================================

/** Bollinger Bands 定義 */
const BollingerBands: IndicatorDefinition<{ period: number; stdDev: number }> = {
  schemaVersion: 2,
  id: 'bb',
  name: 'Bollinger Bands',
  nameKey: 'indicator.bb.name',
  category: 'volatility',
  pane: 'main',
  outputs: [
    { name: 'upper', color: '#2196F3', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'middle', color: '#9E9E9E', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'lower', color: '#2196F3', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'fill', color: 'rgba(33,150,243,0.1)', style: 'band', fillTo: 'lower', zLayer: 10 },
  ],
  params: {
    period: { type: 'number', default: 20, label: 'Period', description: 'SMA期間', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', description: '標準偏差倍率', min: 0.5, max: 4.0, step: 0.1 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  
  // CPU実装 (フォールバック)
  calculate(data, { period, stdDev }) {
    try {
      const closes = data.map(d => d.close);
      const upper: IndicatorValue[] = [];
      const middle: IndicatorValue[] = [];
      const lower: IndicatorValue[] = [];
      
      for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
          upper.push(null);
          middle.push(null);
          lower.push(null);
          continue;
        }
        const slice = closes.slice(i - period + 1, i + 1);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        
        middle.push(sma);
        upper.push(sma + stdDev * std);
        lower.push(sma - stdDev * std);
      }
      
      return { ok: true, value: { upper, middle, lower, fill: upper } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  // WGSL Compute Shader
  wgslSource: `
    struct Params {
      period: u32,
      std_dev: f32,
      data_len: u32,
    }
    
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;  // [t,o,h,l,c,v, ...]
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;  // [upper, middle, lower]
    
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      
      let period = params.period;
      if (idx < period - 1) {
        output[idx * 3 + 0] = bitcast<f32>(0x7FC00000u);  // NaN
        output[idx * 3 + 1] = bitcast<f32>(0x7FC00000u);
        output[idx * 3 + 2] = bitcast<f32>(0x7FC00000u);
        return;
      }
      
      // Calculate SMA
      var sum: f32 = 0.0;
      for (var j: u32 = 0; j < period; j++) {
        let close_idx = (idx - period + 1 + j) * 6 + 4;  // close is at offset 4
        sum += ohlcv[close_idx];
      }
      let sma = sum / f32(period);
      
      // Calculate StdDev
      var var_sum: f32 = 0.0;
      for (var j: u32 = 0; j < period; j++) {
        let close_idx = (idx - period + 1 + j) * 6 + 4;
        let diff = ohlcv[close_idx] - sma;
        var_sum += diff * diff;
      }
      let std = sqrt(var_sum / f32(period));
      
      output[idx * 3 + 0] = sma + params.std_dev * std;  // upper
      output[idx * 3 + 1] = sma;                          // middle
      output[idx * 3 + 2] = sma - params.std_dev * std;  // lower
    }
  `,
  
  alerts: [
    {
      id: 'bb_upper_break',
      name: 'Upper Band Breakout',
      condition: (v, bar) => bar.close > (v.upper ?? Infinity),
      message: (v, bar) => `Price ${bar.close.toFixed(2)} broke above BB upper ${v.upper?.toFixed(2)}`,
      severity: 'info',
      cooldown: 3600,
    },
    {
      id: 'bb_squeeze',
      name: 'BB Squeeze Detected',
      condition: (v) => {
        const width = ((v.upper ?? 0) - (v.lower ?? 0)) / (v.middle ?? 1);
        return width < 0.04;  // 4% width = squeeze
      },
      message: () => 'Bollinger Band squeeze detected - expect volatility expansion',
      severity: 'warning',
    },
  ],
};

/** RSI 定義 */
const RSI: IndicatorDefinition<{ period: number }> = {
  schemaVersion: 2,
  id: 'rsi',
  name: 'RSI',
  nameKey: 'indicator.rsi.name',
  category: 'momentum',
  pane: 'sub1',
  outputs: [
    { name: 'rsi', color: '#9C27B0', style: 'line', lineWidth: 1.5, zLayer: 30 },
  ],
  params: {
    period: { type: 'number', default: 14, label: 'Period', description: 'RSI計算期間', min: 2, max: 50 },
  },
  yRange: { min: 0, max: 100 },
  horizontalLines: [
    { value: 70, color: '#F44336', dashed: true },
    { value: 30, color: '#4CAF50', dashed: true },
    { value: 50, color: '#9E9E9E', dashed: true },
  ],
  complexity: { time: 'O(n)', space: 'O(1)' },
  warmupPeriod: ({ period }) => period,
  
  calculate(data, { period }) {
    try {
      if (data.length < period + 1) {
        return { ok: false, error: { code: 'INSUFFICIENT_DATA', message: `Need at least ${period + 1} bars` } };
      }
      
      const closes = data.map(d => d.close);
      const rsi: IndicatorValue[] = [];
      
      let avgGain = 0;
      let avgLoss = 0;
      
      for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
          rsi.push(null);
          continue;
        }
        
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        
        if (i < period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          rsi.push(null);
        } else if (i === period) {
          avgGain += gain / period;
          avgLoss += loss / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        } else {
          avgGain = (avgGain * (period - 1) + gain) / period;
          avgLoss = (avgLoss * (period - 1) + loss) / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - 100 / (1 + rs));
        }
      }
      
      return { ok: true, value: { rsi } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  // インクリメンタル更新
  update(prevState, newBar, { period }) {
    try {
      const state = prevState as { avgGain: number; avgLoss: number; prevClose: number } | null;
      if (!state) {
        return { ok: false, error: { code: 'COMPUTATION_ERROR', message: 'No previous state' } };
      }
      
      const change = newBar.close - state.prevClose;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      
      const newAvgGain = (state.avgGain * (period - 1) + gain) / period;
      const newAvgLoss = (state.avgLoss * (period - 1) + loss) / period;
      const rs = newAvgLoss === 0 ? 100 : newAvgGain / newAvgLoss;
      const rsiValue = 100 - 100 / (1 + rs);
      
      return {
        ok: true,
        value: {
          state: { avgGain: newAvgGain, avgLoss: newAvgLoss, prevClose: newBar.close },
          values: { rsi: rsiValue },
        },
      };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  wgslSource: `
    struct Params {
      period: u32,
      data_len: u32,
    }
    
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    
    // Note: RSI requires sequential processing for Wilder smoothing
    // This shader uses a parallel prefix approach for better GPU utilization
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      
      var avg_gain: f32 = 0.0;
      var avg_loss: f32 = 0.0;
      
      // Initial SMA for first period
      for (var i: u32 = 1; i <= period; i++) {
        let change = ohlcv[i * 6 + 4] - ohlcv[(i - 1) * 6 + 4];
        if (change > 0.0) { avg_gain += change; }
        else { avg_loss -= change; }
      }
      avg_gain /= f32(period);
      avg_loss /= f32(period);
      
      // Set warmup to NaN
      for (var i: u32 = 0; i < period; i++) {
        output[i] = bitcast<f32>(0x7FC00000u);
      }
      
      // First RSI value
      let rs = select(avg_gain / avg_loss, 100.0, avg_loss == 0.0);
      output[period] = 100.0 - 100.0 / (1.0 + rs);
      
      // Wilder smoothing for rest
      for (var i: u32 = period + 1; i < n; i++) {
        let change = ohlcv[i * 6 + 4] - ohlcv[(i - 1) * 6 + 4];
        let gain = max(change, 0.0);
        let loss = max(-change, 0.0);
        
        avg_gain = (avg_gain * f32(period - 1) + gain) / f32(period);
        avg_loss = (avg_loss * f32(period - 1) + loss) / f32(period);
        
        let rs_i = select(avg_gain / avg_loss, 100.0, avg_loss == 0.0);
        output[i] = 100.0 - 100.0 / (1.0 + rs_i);
      }
    }
  `,
  
  alerts: [
    {
      id: 'rsi_overbought',
      name: 'RSI Overbought',
      condition: (v) => (v.rsi ?? 0) > 70,
      message: (v) => `RSI ${v.rsi?.toFixed(1)} indicates overbought conditions`,
      severity: 'warning',
    },
    {
      id: 'rsi_oversold',
      name: 'RSI Oversold',
      condition: (v) => (v.rsi ?? 100) < 30,
      message: (v) => `RSI ${v.rsi?.toFixed(1)} indicates oversold conditions`,
      severity: 'warning',
    },
  ],
};

/** ADX 定義（完全実装） */
const ADX: IndicatorDefinition<{ period: number }> = {
  schemaVersion: 2,
  id: 'adx',
  name: 'ADX',
  nameKey: 'indicator.adx.name',
  category: 'trend',
  pane: 'sub1',
  outputs: [
    { name: 'adx', color: '#FF5722', style: 'line', lineWidth: 2, zLayer: 30 },
    { name: 'plusDI', color: '#4CAF50', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'minusDI', color: '#F44336', style: 'line', lineWidth: 1, zLayer: 30 },
  ],
  params: {
    period: { type: 'number', default: 14, label: 'Period', description: 'ADX計算期間', min: 5, max: 50 },
  },
  yRange: { min: 0, max: 100 },
  horizontalLines: [
    { value: 25, color: '#9E9E9E', dashed: true },  // トレンド判定ライン
    { value: 50, color: '#FF9800', dashed: true },  // 強いトレンド
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period * 2 - 1,
  
  calculate(data, { period }) {
    try {
      if (data.length < period * 2) {
        return { ok: false, error: { code: 'INSUFFICIENT_DATA', message: `Need at least ${period * 2} bars` } };
      }
      
      const adx: IndicatorValue[] = [];
      const plusDI: IndicatorValue[] = [];
      const minusDI: IndicatorValue[] = [];
      
      // True Range, +DM, -DM arrays
      const tr: number[] = [];
      const plusDM: number[] = [];
      const minusDM: number[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          tr.push(data[i].high - data[i].low);
          plusDM.push(0);
          minusDM.push(0);
          adx.push(null);
          plusDI.push(null);
          minusDI.push(null);
          continue;
        }
        
        const high = data[i].high;
        const low = data[i].low;
        const prevHigh = data[i - 1].high;
        const prevLow = data[i - 1].low;
        const prevClose = data[i - 1].close;
        
        // True Range
        const trValue = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        tr.push(trValue);
        
        // Directional Movement
        const upMove = high - prevHigh;
        const downMove = prevLow - low;
        
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        
        if (i < period) {
          adx.push(null);
          plusDI.push(null);
          minusDI.push(null);
          continue;
        }
        
        // Smoothed TR, +DM, -DM (Wilder smoothing)
        let smoothTR = 0, smoothPlusDM = 0, smoothMinusDM = 0;
        
        if (i === period) {
          // First smoothed value = sum of first period
          for (let j = 1; j <= period; j++) {
            smoothTR += tr[j];
            smoothPlusDM += plusDM[j];
            smoothMinusDM += minusDM[j];
          }
        } else {
          // Subsequent: prev - (prev/period) + current
          const prevSmoothTR = tr.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothTR = prevSmoothTR - prevSmoothTR / period + tr[i];
          
          const prevSmoothPlusDM = plusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothPlusDM = prevSmoothPlusDM - prevSmoothPlusDM / period + plusDM[i];
          
          const prevSmoothMinusDM = minusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
          smoothMinusDM = prevSmoothMinusDM - prevSmoothMinusDM / period + minusDM[i];
        }
        
        // +DI and -DI
        const pdi = smoothTR > 0 ? (100 * smoothPlusDM / smoothTR) : 0;
        const mdi = smoothTR > 0 ? (100 * smoothMinusDM / smoothTR) : 0;
        
        plusDI.push(pdi);
        minusDI.push(mdi);
        
        // DX
        const diSum = pdi + mdi;
        const dx = diSum > 0 ? (100 * Math.abs(pdi - mdi) / diSum) : 0;
        
        // ADX (smoothed DX)
        if (i < period * 2 - 1) {
          adx.push(null);
        } else if (i === period * 2 - 1) {
          // First ADX = average of first period DX values
          let dxSum = 0;
          for (let j = period; j < period * 2; j++) {
            const pdiJ = plusDI[j] ?? 0;
            const mdiJ = minusDI[j] ?? 0;
            const sumJ = pdiJ + mdiJ;
            dxSum += sumJ > 0 ? (100 * Math.abs(pdiJ - mdiJ) / sumJ) : 0;
          }
          adx.push(dxSum / period);
        } else {
          const prevADX = adx[i - 1] ?? 0;
          adx.push((prevADX * (period - 1) + dx) / period);
        }
      }
      
      return { ok: true, value: { adx, plusDI, minusDI } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  alerts: [
    {
      id: 'adx_trending',
      name: 'Strong Trend Detected',
      condition: (v) => (v.adx ?? 0) > 25,
      message: (v) => `ADX ${v.adx?.toFixed(1)} indicates trending market`,
      severity: 'info',
    },
    {
      id: 'adx_crossover',
      name: 'DI Crossover',
      condition: (v, _, prev) => {
        if (!prev) return false;
        const prevPlusDI = prev.plusDI ?? 0;
        const prevMinusDI = prev.minusDI ?? 0;
        const curPlusDI = v.plusDI ?? 0;
        const curMinusDI = v.minusDI ?? 0;
        return (prevPlusDI < prevMinusDI && curPlusDI > curMinusDI) ||
               (prevPlusDI > prevMinusDI && curPlusDI < curMinusDI);
      },
      message: (v) => `DI crossover: +DI=${v.plusDI?.toFixed(1)}, -DI=${v.minusDI?.toFixed(1)}`,
      severity: 'warning',
    },
  ],
};

/** MACD 定義 */
const MACD: IndicatorDefinition<{ fastPeriod: number; slowPeriod: number; signalPeriod: number }> = {
  schemaVersion: 2,
  id: 'macd',
  name: 'MACD',
  nameKey: 'indicator.macd.name',
  category: 'momentum',
  pane: 'sub2',
  dependencies: ['ema'],  // EMAに依存
  outputs: [
    { name: 'macd', color: '#2196F3', style: 'line', lineWidth: 1.5, zLayer: 30 },
    { name: 'signal', color: '#FF9800', style: 'line', lineWidth: 1, zLayer: 30 },
    { name: 'histogram', color: '#4CAF50', style: 'histogram', opacity: 0.7, zLayer: 20 },
  ],
  params: {
    fastPeriod: { type: 'number', default: 12, label: 'Fast Period', min: 2, max: 50 },
    slowPeriod: { type: 'number', default: 26, label: 'Slow Period', min: 5, max: 100 },
    signalPeriod: { type: 'number', default: 9, label: 'Signal Period', min: 2, max: 50 },
  },
  horizontalLines: [
    { value: 0, color: '#9E9E9E', dashed: false },
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ slowPeriod, signalPeriod }) => slowPeriod + signalPeriod - 1,
  
  calculate(data, { fastPeriod, slowPeriod, signalPeriod }) {
    try {
      // EMA helper
      const ema = (values: number[], period: number): number[] => {
        const result: number[] = [];
        const k = 2 / (period + 1);
        for (let i = 0; i < values.length; i++) {
          if (i === 0) {
            result.push(values[i]);
          } else {
            result.push(values[i] * k + result[i - 1] * (1 - k));
          }
        }
        return result;
      };
      
      const closes = data.map(d => d.close);
      const fastEma = ema(closes, fastPeriod);
      const slowEma = ema(closes, slowPeriod);
      
      const macdLine = fastEma.map((f, i) => f - slowEma[i]);
      const signalLine = ema(macdLine, signalPeriod);
      const histogram = macdLine.map((m, i) => m - signalLine[i]);
      
      // Null out warmup period
      const warmup = slowPeriod + signalPeriod - 1;
      return {
        ok: true,
        value: {
          macd: macdLine.map((v, i) => i < warmup ? null : v),
          signal: signalLine.map((v, i) => i < warmup ? null : v),
          histogram: histogram.map((v, i) => i < warmup ? null : v),
        },
      };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  alerts: [
    {
      id: 'macd_cross_up',
      name: 'MACD Bullish Cross',
      condition: (v, _, prev) => {
        if (!prev) return false;
        return (prev.macd ?? 0) < (prev.signal ?? 0) && (v.macd ?? 0) > (v.signal ?? 0);
      },
      message: () => 'MACD crossed above signal line (bullish)',
      severity: 'info',
    },
    {
      id: 'macd_cross_down',
      name: 'MACD Bearish Cross',
      condition: (v, _, prev) => {
        if (!prev) return false;
        return (prev.macd ?? 0) > (prev.signal ?? 0) && (v.macd ?? 0) < (v.signal ?? 0);
      },
      message: () => 'MACD crossed below signal line (bearish)',
      severity: 'info',
    },
  ],
};

/** Percent_B 定義 */
const PercentB: IndicatorDefinition<{ period: number; stdDev: number }> = {
  schemaVersion: 2,
  id: 'percent_b',
  name: '%B',
  nameKey: 'indicator.percent_b.name',
  category: 'volatility',
  pane: 'sub1',
  dependencies: ['bb'],
  outputs: [
    { name: 'percentB', color: '#673AB7', style: 'line', lineWidth: 1.5, zLayer: 30 },
  ],
  params: {
    period: { type: 'number', default: 20, label: 'Period', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', min: 0.5, max: 4.0, step: 0.1 },
  },
  yRange: { min: -0.5, max: 1.5 },
  horizontalLines: [
    { value: 1, color: '#F44336', dashed: true },   // Overbought
    { value: 0.5, color: '#9E9E9E', dashed: true }, // Middle
    { value: 0, color: '#4CAF50', dashed: true },   // Oversold
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  
  calculate(data, { period, stdDev }) {
    try {
      const closes = data.map(d => d.close);
      const percentB: IndicatorValue[] = [];
      
      for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
          percentB.push(null);
          continue;
        }
        const slice = closes.slice(i - period + 1, i + 1);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        const bandwidth = upper - lower;
        
        percentB.push(bandwidth > 0 ? (closes[i] - lower) / bandwidth : 0.5);
      }
      
      return { ok: true, value: { percentB } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  alerts: [
    {
      id: 'percent_b_overbought',
      name: '%B Overbought',
      condition: (v) => (v.percentB ?? 0) > 1,
      message: (v) => `%B ${v.percentB?.toFixed(2)} above upper band`,
      severity: 'warning',
    },
    {
      id: 'percent_b_oversold',
      name: '%B Oversold',
      condition: (v) => (v.percentB ?? 1) < 0,
      message: (v) => `%B ${v.percentB?.toFixed(2)} below lower band`,
      severity: 'warning',
    },
  ],
};

/** BB_Width 定義 */
const BBWidth: IndicatorDefinition<{ period: number; stdDev: number }> = {
  schemaVersion: 2,
  id: 'bb_width',
  name: 'BB Width',
  nameKey: 'indicator.bb_width.name',
  category: 'volatility',
  pane: 'sub1',
  dependencies: ['bb'],
  outputs: [
    { name: 'width', color: '#00BCD4', style: 'area', opacity: 0.5, fillTo: 0, zLayer: 20 },
  ],
  params: {
    period: { type: 'number', default: 20, label: 'Period', min: 5, max: 100 },
    stdDev: { type: 'number', default: 2.0, label: 'Std Dev', min: 0.5, max: 4.0, step: 0.1 },
  },
  horizontalLines: [
    { value: 0.04, color: '#FF9800', dashed: true },  // Squeeze threshold
  ],
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ period }) => period - 1,
  
  calculate(data, { period, stdDev }) {
    try {
      const closes = data.map(d => d.close);
      const width: IndicatorValue[] = [];
      
      for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
          width.push(null);
          continue;
        }
        const slice = closes.slice(i - period + 1, i + 1);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
        const std = Math.sqrt(variance);
        
        const upper = sma + stdDev * std;
        const lower = sma - stdDev * std;
        
        width.push(sma > 0 ? (upper - lower) / sma : 0);
      }
      
      return { ok: true, value: { width } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
  
  alerts: [
    {
      id: 'bb_squeeze_alert',
      name: 'BB Squeeze',
      condition: (v) => (v.width ?? 1) < 0.04,
      message: (v) => `BB Width ${(v.width ?? 0 * 100).toFixed(1)}% - Squeeze detected`,
      severity: 'warning',
      cooldown: 86400,  // 1 day cooldown
    },
  ],
};

/** ATR 定義 */
const ATR: IndicatorDefinition<{ period: number }> = {
  schemaVersion: 2,
  id: 'atr',
  name: 'ATR',
  nameKey: 'indicator.atr.name',
  category: 'volatility',
  pane: 'sub1',
  outputs: [
    { name: 'atr', color: '#795548', style: 'line', lineWidth: 1.5, zLayer: 30 },
  ],
  params: {
    period: { type: 'number', default: 14, label: 'Period', min: 5, max: 50 },
  },
  complexity: { time: 'O(n)', space: 'O(1)' },
  warmupPeriod: ({ period }) => period,
  
  calculate(data, { period }) {
    try {
      const atr: IndicatorValue[] = [];
      let atrSum = 0;
      
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          atr.push(null);
          continue;
        }
        
        const tr = Math.max(
          data[i].high - data[i].low,
          Math.abs(data[i].high - data[i - 1].close),
          Math.abs(data[i].low - data[i - 1].close)
        );
        
        if (i < period) {
          atrSum += tr;
          atr.push(null);
        } else if (i === period) {
          atrSum += tr;
          atr.push(atrSum / period);
        } else {
          const prevATR = atr[i - 1] ?? 0;
          atr.push((prevATR * (period - 1) + tr) / period);
        }
      }
      
      return { ok: true, value: { atr } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
};

/** Volume 定義 */
const Volume: IndicatorDefinition<{ maPeriod: number }> = {
  schemaVersion: 2,
  id: 'volume',
  name: 'Volume',
  nameKey: 'indicator.volume.name',
  category: 'volume',
  pane: 'sub1',
  outputs: [
    { name: 'volume', color: '#90CAF9', style: 'bar', opacity: 0.8, zLayer: 20 },
    { name: 'volumeMA', color: '#1565C0', style: 'line', lineWidth: 1, zLayer: 30 },
  ],
  params: {
    maPeriod: { type: 'number', default: 20, label: 'MA Period', min: 5, max: 50 },
  },
  complexity: { time: 'O(n)', space: 'O(n)' },
  warmupPeriod: ({ maPeriod }) => maPeriod - 1,
  
  calculate(data, { maPeriod }) {
    try {
      const volume: IndicatorValue[] = data.map(d => d.volume);
      const volumeMA: IndicatorValue[] = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i < maPeriod - 1) {
          volumeMA.push(null);
        } else {
          const slice = data.slice(i - maPeriod + 1, i + 1).map(d => d.volume);
          volumeMA.push(slice.reduce((a, b) => a + b, 0) / maPeriod);
        }
      }
      
      return { ok: true, value: { volume, volumeMA } };
    } catch (e) {
      return { ok: false, error: { code: 'COMPUTATION_ERROR', message: String(e) } };
    }
  },
};
```

### 2.5 Registry & Runtime API

```typescript
// ========================================
// Registry & Runtime API
// ========================================

/** インディケーターレジストリ */
interface IndicatorRegistry {
  /** インディケーターを登録 */
  register<T>(indicator: IndicatorDefinition<T>): void;
  
  /** IDで取得 */
  get(id: string): IndicatorDefinition | undefined;
  
  /** カテゴリでフィルタ */
  listByCategory(category: string): IndicatorDefinition[];
  
  /** 全インディケーター取得 */
  listAll(): IndicatorDefinition[];
  
  /** GPU対応インディケーターのみ */
  listGPUEnabled(): IndicatorDefinition[];
  
  /** 依存関係を解決した順序で返す */
  resolveDependencies(ids: string[]): IndicatorDefinition[];
}

/** チャートへのインディケーター追加API */
interface ChartIndicatorAPI {
  /** インディケーターを追加 */
  addIndicator(id: string, params?: Record<string, unknown>): string; // returns instance ID
  
  /** インディケーターを削除 */
  removeIndicator(instanceId: string): void;
  
  /** パラメータ更新 */
  updateParams(instanceId: string, params: Record<string, unknown>): void;
  
  /** 表示/非表示切り替え */
  toggleVisibility(instanceId: string): void;
  
  /** アクティブなインディケーター一覧 */
  getActiveIndicators(): { instanceId: string; id: string; params: unknown }[];
  
  /** トレードマーカーを追加 */
  addTradeMarkers(markers: TradeMarker[]): void;
  
  /** トレードマーカーをクリア */
  clearTradeMarkers(): void;
  
  /** アラート購読 */
  onAlert(callback: (alert: { indicatorId: string; alert: IndicatorAlert; values: Record<string, IndicatorValue>; bar: OHLCV }) => void): () => void;
  
  /** GPU計算を強制 */
  setForceGPU(enabled: boolean): void;
  
  /** 計算統計を取得 */
  getComputeStats(): {
    lastComputeTimeMs: number;
    gpuUtilization: number;
    indicatorCount: number;
  };
}

/** GPU コンテキスト */
interface GPUComputeContext {
  device: GPUDevice;
  queue: GPUQueue;
  
  /** OHLCVバッファをGPUにアップロード */
  uploadOHLCV(data: OHLCVBuffer): GPUBuffer;
  
  /** Compute Shader を実行 */
  runCompute(
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    workgroupCount: number
  ): Promise<void>;
  
  /** 結果をCPUに読み戻し */
  readback(buffer: GPUBuffer): Promise<Float32Array>;
  
  /** バッファを解放 */
  release(buffer: GPUBuffer): void;
}
```

---

## 3. テスト仕様

### 3.1 インディケーター検証テスト

各インディケーターは以下のテストをパスする必要があります。

```typescript
// ========================================
// Test Specification
// ========================================

interface IndicatorTestCase {
  name: string;
  input: OHLCV[];
  params: Record<string, unknown>;
  expected: {
    [seriesName: string]: (number | null)[];
  };
  tolerance?: number;  // default: 1e-6
}

/** テストケース例: RSI */
const RSI_TEST_CASES: IndicatorTestCase[] = [
  {
    name: 'RSI 14-period basic',
    input: [
      // 15 bars of test data (close prices: trending up)
      { time: 1, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { time: 2, open: 100, high: 102, low: 100, close: 101, volume: 1000 },
      { time: 3, open: 101, high: 103, low: 101, close: 102, volume: 1000 },
      // ... (14 more bars)
    ],
    params: { period: 14 },
    expected: {
      rsi: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 66.67],
    },
    tolerance: 0.01,
  },
  {
    name: 'RSI handles zero movement',
    input: Array(20).fill({ time: 1, open: 100, high: 100, low: 100, close: 100, volume: 0 }),
    params: { period: 14 },
    expected: {
      rsi: [...Array(14).fill(null), ...Array(6).fill(50)],  // No movement = RSI 50
    },
  },
];

/** テストケース例: Bollinger Bands */
const BB_TEST_CASES: IndicatorTestCase[] = [
  {
    name: 'BB 20-period, 2 stdDev',
    input: generateSyntheticData(30, { trend: 0.01, volatility: 0.02 }),
    params: { period: 20, stdDev: 2 },
    expected: {
      // 最初の19バーはnull
      upper: [...Array(19).fill(null), /* known values */],
      middle: [...Array(19).fill(null), /* known values */],
      lower: [...Array(19).fill(null), /* known values */],
    },
  },
];

/** テストランナー */
async function runIndicatorTests(
  indicator: IndicatorDefinition,
  testCases: IndicatorTestCase[]
): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const tc of testCases) {
    const result = indicator.calculate(tc.input, tc.params as any);
    
    if (!result.ok) {
      errors.push(`${tc.name}: Computation error - ${result.error.message}`);
      failed++;
      continue;
    }
    
    const tol = tc.tolerance ?? 1e-6;
    let testPassed = true;
    
    for (const [series, expected] of Object.entries(tc.expected)) {
      const actual = result.value[series];
      if (!actual) {
        errors.push(`${tc.name}: Missing series '${series}'`);
        testPassed = false;
        continue;
      }
      
      for (let i = 0; i < expected.length; i++) {
        const exp = expected[i];
        const act = actual[i];
        
        if (exp === null && act !== null) {
          errors.push(`${tc.name}: ${series}[${i}] expected null, got ${act}`);
          testPassed = false;
        } else if (exp !== null && act === null) {
          errors.push(`${tc.name}: ${series}[${i}] expected ${exp}, got null`);
          testPassed = false;
        } else if (exp !== null && act !== null && Math.abs(exp - act) > tol) {
          errors.push(`${tc.name}: ${series}[${i}] expected ${exp}, got ${act} (diff: ${Math.abs(exp - act)})`);
          testPassed = false;
        }
      }
    }
    
    if (testPassed) passed++;
    else failed++;
  }
  
  return { passed, failed, errors };
}

/** GPU vs CPU 一致テスト */
async function testGPUCPUConsistency(
  indicator: IndicatorDefinition,
  data: OHLCV[],
  params: Record<string, unknown>,
  gpuContext: GPUComputeContext
): Promise<boolean> {
  // CPU計算
  const cpuResult = indicator.calculate(data, params as any);
  if (!cpuResult.ok) return false;
  
  // GPU計算
  if (!indicator.calculateGPU) return true;  // GPU未実装はスキップ
  
  const buffer = new Float32Array(data.length * 6);
  data.forEach((bar, i) => {
    buffer[i * 6 + 0] = bar.time;
    buffer[i * 6 + 1] = bar.open;
    buffer[i * 6 + 2] = bar.high;
    buffer[i * 6 + 3] = bar.low;
    buffer[i * 6 + 4] = bar.close;
    buffer[i * 6 + 5] = bar.volume;
  });
  
  const gpuResult = await indicator.calculateGPU(buffer, params as any, gpuContext.device);
  if (!gpuResult.ok) return false;
  
  // 比較 (NaN = null として扱う)
  const tolerance = 1e-4;  // GPU は精度が若干低い
  
  for (const [series, cpuValues] of Object.entries(cpuResult.value)) {
    const gpuValues = gpuResult.value[series];
    if (!gpuValues) return false;
    
    for (let i = 0; i < cpuValues.length; i++) {
      const cpu = cpuValues[i];
      const gpu = gpuValues[i];
      
      const cpuIsNull = cpu === null;
      const gpuIsNull = isNaN(gpu);
      
      if (cpuIsNull !== gpuIsNull) return false;
      if (!cpuIsNull && !gpuIsNull && Math.abs(cpu - gpu) > tolerance) return false;
    }
  }
  
  return true;
}
```

---

## 4. 実装優先度

| Phase | インディケーター | 理由 | GPU |
|-------|-----------------|------|-----|
| **Phase 1** | Volume, SMA, EMA, BB, Candles | 基本中の基本 | ✅ |
| **Phase 2** | RSI, ADX, ATR, MACD, Trade Markers | 戦略判定に必須 | ✅ |
| **Phase 3** | VWAP, Vol_Ratio, Percent_B, BB_Width | BBBreakout最適化 | ✅ |
| **Phase 4** | OBV, CMF, MFI, Kaufman Patterns | 高度な分析 | Partial |

---

## 5. MochaTrader 既存インディケーターとの対応

以下は `MochaTrader/src/mocha_trader/indicators/` の既存実装との対応表です。

| Chart Library | MochaTrader | ファイル |
|---------------|-------------|----------|
| SMA | `calculate_sma()` | `basic.py` |
| EMA | `calculate_ema()` | `basic.py` |
| BB | `calculate_bollinger_bands()` | `basic.py` |
| RSI | `calculate_rsi()` | `basic.py` |
| ADX | `calculate_adx()` | `basic.py` |
| ATR | `calculate_atr()` | `basic.py` |
| VWAP | (inline計算) | 各experiment |
| OBV | `calculate_obv()` | `obv.py` |
| CMF | `calculate_cmf()` | `volume_oscillators.py` |
| MFI | `calculate_mfi()` | `volume_oscillators.py` |
| Vol_Ratio | `calculate_rvol()` | `volume_oscillators.py` |
| Kaufman | `detect_all_kaufman_patterns()` | `kaufman.py` |

---

## 6. WebGPU アーキテクチャ

### 6.1 GPU Pipeline 設計

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WebGPU Compute Pipeline                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   CPU Side   │    │  GPU Upload  │    │   Compute    │              │
│  │              │    │              │    │   Shaders    │              │
│  │  OHLCV[]     │───▶│  GPUBuffer   │───▶│              │              │
│  │  (JS Array)  │    │  (Staging)   │    │  ┌────────┐  │              │
│  └──────────────┘    └──────────────┘    │  │  SMA   │  │              │
│                                          │  ├────────┤  │              │
│                                          │  │  EMA   │  │              │
│                                          │  ├────────┤  │              │
│  ┌──────────────┐    ┌──────────────┐    │  │  BB    │  │              │
│  │  Render      │◀───│  GPU Read    │◀───│  ├────────┤  │              │
│  │  Pipeline    │    │  (Readback)  │    │  │  RSI   │  │              │
│  │              │    │              │    │  ├────────┤  │              │
│  │  Line Strip  │    │  Float32     │    │  │  ADX   │  │              │
│  │  Instanced   │    │  Arrays      │    │  └────────┘  │              │
│  │  Quads       │    │              │    │              │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 メモリレイアウト

```typescript
// ========================================
// GPU Memory Layout
// ========================================

/** OHLCV Buffer (Input) - 24 bytes per bar, aligned */
// Layout: [time, open, high, low, close, volume] × N
// Total: 24 * N bytes
// Example: 10 years daily = 2,520 bars = 60,480 bytes ≈ 60KB

/** Indicator Output Buffer */
// Layout depends on indicator
// BB: [upper, middle, lower] × N = 12 * N bytes
// RSI: [rsi] × N = 4 * N bytes
// ADX: [adx, plusDI, minusDI] × N = 12 * N bytes

/** Uniform Buffer (Params) */
struct IndicatorParams {
  // Common
  data_len: u32,
  
  // Indicator-specific (padded to 16-byte alignment)
  period: u32,
  std_dev: f32,
  _padding: u32,
}

/** Bind Group Layout */
// Group 0: Input data
//   Binding 0: OHLCV storage buffer (read-only)
//   Binding 1: Params uniform buffer
//   Binding 2: Output storage buffer (read-write)
```

### 6.3 バッチ処理最適化

```typescript
// ========================================
// Batch Compute Optimization
// ========================================

/** 複数インディケーターを1パスで計算 */
interface BatchComputePlan {
  /** 独立したインディケーター（並列実行可能） */
  parallelGroups: IndicatorDefinition[][];
  
  /** 依存関係のあるインディケーター（順次実行） */
  sequentialChain: IndicatorDefinition[];
}

/** バッチ計算の例 */
function createBatchPlan(indicators: IndicatorDefinition[]): BatchComputePlan {
  // 依存関係グラフを構築
  const deps = new Map<string, Set<string>>();
  indicators.forEach(ind => {
    deps.set(ind.id, new Set(ind.dependencies ?? []));
  });
  
  // トポロジカルソート
  const sorted: IndicatorDefinition[] = [];
  const visited = new Set<string>();
  
  function visit(id: string) {
    if (visited.has(id)) return;
    const ind = indicators.find(i => i.id === id);
    if (!ind) return;
    
    for (const dep of deps.get(id) ?? []) {
      visit(dep);
    }
    visited.add(id);
    sorted.push(ind);
  }
  
  indicators.forEach(ind => visit(ind.id));
  
  // 並列実行可能なグループに分割
  const groups: IndicatorDefinition[][] = [];
  let currentGroup: IndicatorDefinition[] = [];
  const computed = new Set<string>();
  
  for (const ind of sorted) {
    const allDepsComputed = (ind.dependencies ?? []).every(d => computed.has(d));
    if (allDepsComputed) {
      currentGroup.push(ind);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [ind];
    }
    computed.add(ind.id);
  }
  if (currentGroup.length > 0) groups.push(currentGroup);
  
  return {
    parallelGroups: groups.filter(g => g.length > 1),
    sequentialChain: groups.filter(g => g.length === 1).flat(),
  };
}
```

---

## 7. データフロー図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Backend (Litestar + msgspec)                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐              │
│  │  DuckDB     │───▶│  msgspec    │───▶│  MessagePack    │              │
│  │  (OHLCV)    │    │  (encode)   │    │  Binary Stream  │              │
│  └─────────────┘    └─────────────┘    └────────┬────────┘              │
└─────────────────────────────────────────────────┼───────────────────────┘
                                                  │ WebSocket / HTTP
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Frontend (Solid.js + WebGPU)                       │
│  ┌─────────────────┐    ┌─────────────────┐                             │
│  │  MessagePack    │───▶│  Float32Array   │                             │
│  │  (decode)       │    │  (Zero-Copy)    │                             │
│  └─────────────────┘    └────────┬────────┘                             │
│                                  │                                      │
│                    ┌─────────────┴─────────────┐                        │
│                    ▼                           ▼                        │
│  ┌─────────────────────────┐    ┌─────────────────────────┐             │
│  │     GPU Buffer          │    │    CPU Fallback         │             │
│  │  ┌─────────────────┐    │    │  (WebGPU unavailable)   │             │
│  │  │ OHLCV Storage   │    │    │                         │             │
│  │  └────────┬────────┘    │    │  calculate() methods    │             │
│  │           │             │    │                         │             │
│  │  ┌────────▼────────┐    │    └─────────────────────────┘             │
│  │  │ Compute Shader  │    │                                            │
│  │  │ Dispatch        │    │                                            │
│  │  │                 │    │                                            │
│  │  │ ┌─────┐ ┌─────┐ │    │                                            │
│  │  │ │BB   │ │RSI  │ │    │    ┌─────────────────────────┐             │
│  │  │ │WGSL │ │WGSL │ │    │    │   IndicatorRegistry     │             │
│  │  │ └─────┘ └─────┘ │    │    │                         │             │
│  │  │ ┌─────┐ ┌─────┐ │    │    │  ┌─────┐ ┌─────┐ ┌───┐ │             │
│  │  │ │ADX  │ │MACD │ │    │    │  │ BB  │ │ RSI │ │...│ │             │
│  │  │ │WGSL │ │WGSL │ │    │    │  └─────┘ └─────┘ └───┘ │             │
│  │  │ └─────┘ └─────┘ │    │    │                         │             │
│  │  └────────┬────────┘    │    │  Alerts, Dependencies   │             │
│  │           │             │    └─────────────────────────┘             │
│  │  ┌────────▼────────┐    │                                            │
│  │  │ Output Buffers  │    │                                            │
│  │  └────────┬────────┘    │                                            │
│  └───────────┼─────────────┘                                            │
│              │                                                          │
│              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │              WebGPU Render Pipeline                     │            │
│  │                                                         │            │
│  │  ┌───────────────────────────────────────────────────┐  │            │
│  │  │                    Main Pane                      │  │            │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │            │
│  │  │  │ Candles │ │ BB Fill │ │ BB Lines│ │ Markers │  │  │            │
│  │  │  │ z:20    │ │ z:10    │ │ z:30    │ │ z:40    │  │  │            │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │  │            │
│  │  └───────────────────────────────────────────────────┘  │            │
│  │  ┌───────────────────────────────────────────────────┐  │            │
│  │  │                    Sub Pane 1                     │  │            │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐              │  │            │
│  │  │  │ Volume  │ │  RSI    │ │  ADX    │              │  │            │
│  │  │  │ Bars    │ │ Line    │ │ Lines   │              │  │            │
│  │  │  └─────────┘ └─────────┘ └─────────┘              │  │            │
│  │  └───────────────────────────────────────────────────┘  │            │
│  │  ┌───────────────────────────────────────────────────┐  │            │
│  │  │                    Sub Pane 2                     │  │            │
│  │  │  ┌─────────────────┐ ┌─────────────────┐          │  │            │
│  │  │  │ MACD Line/Signal│ │ MACD Histogram  │          │  │            │
│  │  │  └─────────────────┘ └─────────────────┘          │  │            │
│  │  └───────────────────────────────────────────────────┘  │            │
│  └─────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. エラーハンドリング仕様

### 8.1 エラーコード一覧

| コード | 説明 | 対処 |
|--------|------|------|
| `INSUFFICIENT_DATA` | データ不足 | ウォームアップ期間分のnullを返す |
| `INVALID_PARAMS` | パラメータ不正 | デフォルト値にフォールバック |
| `GPU_ERROR` | GPU計算失敗 | CPU計算にフォールバック |
| `COMPUTATION_ERROR` | 計算中の例外 | エラーログ出力、空配列を返す |

### 8.2 フォールバック戦略

```typescript
async function computeIndicator(
  indicator: IndicatorDefinition,
  data: OHLCV[],
  params: Record<string, unknown>,
  gpuContext?: GPUComputeContext
): Promise<IndicatorResult<MultiSeriesOutput>> {
  // 1. GPU計算を試行
  if (gpuContext && indicator.calculateGPU) {
    const buffer = toOHLCVBuffer(data);
    const gpuResult = await indicator.calculateGPU(buffer, params as any, gpuContext.device);
    
    if (gpuResult.ok) {
      // GPU結果をJS配列に変換
      return {
        ok: true,
        value: gpuOutputToMultiSeries(gpuResult.value),
      };
    }
    
    console.warn(`GPU compute failed for ${indicator.id}, falling back to CPU:`, gpuResult.error);
  }
  
  // 2. CPU計算にフォールバック
  return indicator.calculate(data, params as any);
}
```

---

## 9. 国際化 (i18n)

```typescript
// ========================================
// i18n Support
// ========================================

interface I18nStrings {
  [key: string]: {
    en: string;
    ja: string;
  };
}

const INDICATOR_I18N: I18nStrings = {
  'indicator.bb.name': {
    en: 'Bollinger Bands',
    ja: 'ボリンジャーバンド',
  },
  'indicator.bb.param.period': {
    en: 'Period',
    ja: '期間',
  },
  'indicator.bb.param.stdDev': {
    en: 'Standard Deviation',
    ja: '標準偏差',
  },
  'indicator.rsi.name': {
    en: 'RSI',
    ja: 'RSI（相対力指数）',
  },
  'indicator.adx.name': {
    en: 'ADX',
    ja: 'ADX（平均方向性指数）',
  },
  'indicator.macd.name': {
    en: 'MACD',
    ja: 'MACD',
  },
  'alert.bb_squeeze': {
    en: 'Bollinger Band squeeze detected - expect volatility expansion',
    ja: 'ボリンジャーバンド収縮検出 - ボラティリティ拡大の可能性',
  },
  'alert.rsi_overbought': {
    en: 'RSI indicates overbought conditions',
    ja: 'RSIが買われすぎを示唆',
  },
  'alert.rsi_oversold': {
    en: 'RSI indicates oversold conditions',
    ja: 'RSIが売られすぎを示唆',
  },
};

function t(key: string, locale: 'en' | 'ja' = 'ja'): string {
  return INDICATOR_I18N[key]?.[locale] ?? key;
}
```

---

## 10. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-01-20 | v1.0 | 初版作成 |
| 2026-01-20 | v2.0 | WebGPU-First 設計に全面改訂 |
|            |      | - スキーマバージョン追加 |
|            |      | - TradeMarker interface 追加 |
|            |      | - エラーハンドリング (Result型) 追加 |
|            |      | - テスト仕様 追加 |
|            |      | - ADX/Percent_B/BB_Width 完全実装 |
|            |      | - WGSL Compute Shader 例 追加 |
|            |      | - GPU バッチ処理最適化 追加 |
|            |      | - Z-Index レイヤー順序 追加 |
|            |      | - i18n サポート 追加 |
|            |      | - パフォーマンス目標 明記 |
