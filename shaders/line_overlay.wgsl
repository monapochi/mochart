// line_overlay.wgsl — インジケータ折れ線オーバーレイ (LINE_STRIP)
//
// Uniform layout (48 bytes, 16-byte aligned):
//   offset  0: plot_w    f32  — プロット幅 (CSS pixels)
//   offset  4: candle_w  f32  — ローソク足幅 (CSS pixels)
//   offset  8: price_min f32  — 下端価格
//   offset 12: price_max f32  — 上端価格
//   offset 16: color     vec4<f32> — RGBA [0,1]
//   offset 32: bar_count u32  — 有効バー数 (= view_len)
//   offset 36: nan_start u32  — ウォームアップ長 (先頭 N 頂点をクリップ外へ)
//   offset 40: _pad[2]   u32
//
// Storage layout:
//   values[]: array<f32> — インジケータ値 (NaN = nan_start 未満で処理)

struct Uniforms {
    plot_w:    f32,
    candle_w:  f32,
    price_min: f32,
    price_max: f32,
    color:     vec4<f32>,
    bar_count: u32,
    nan_start: u32,
    _pad0:     u32,
    _pad1:     u32,
}

@group(0) @binding(0) var<uniform>         u:      Uniforms;
@group(0) @binding(1) var<storage, read>   values: array<f32>;

struct VOut {
    @builtin(position) pos:   vec4<f32>,
    @location(0)       alpha: f32,
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VOut {
    var out: VOut;

    // ウォームアップ期間 (vi < nan_start) の頂点は最初の有効頂点と同じ位置に折りたたむ。
    // LINE_STRIP で NDC 外へ飛ばすと、次の有効頂点との間に画面端から伸びる
    // 可視セグメントが生成されてしまうため、縮退セグメント (長さ 0) にして隠す。
    let idx        = select(vi, u.nan_start, vi < u.nan_start);
    let is_warmup  = vi < u.nan_start;

    let v = values[idx];

    // 価格 → NDC Y  (price_min → -1, price_max → +1)
    let price_range = max(u.price_max - u.price_min, 1e-6);
    let y_ndc = (v - u.price_min) / price_range * 2.0 - 1.0;

    // バーセンター → NDC X  (ローソク足と同じ: (idx + 0.5) * slot_w)
    let slot_w = u.plot_w / f32(u.bar_count);
    let x_px   = (f32(idx) + 0.5) * slot_w;
    let x_ndc  = (x_px / u.plot_w) * 2.0 - 1.0;

    out.pos   = vec4<f32>(x_ndc, y_ndc, 0.0, 1.0);
    out.alpha = select(1.0, 0.0, is_warmup); // ウォームアップ頂点は透明
    return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    return vec4<f32>(u.color.rgb, u.color.a * in.alpha);
}
