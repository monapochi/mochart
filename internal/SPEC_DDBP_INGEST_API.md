# DDBP Ingest API — 内部仕様書 (Non-Public)

> **Status**: Implemented  
> **Date**: 2026-04-07  
> **Visibility**: Internal only — この API は非公開。外部ドキュメント・README には記載しない。

## 概要

Delta-Delta Bit-Packed (DDBP) Ingest API は、**すでにクライアント側で Mochart の内部圧縮形式
(delta-delta encode + zigzag + fixed-width bit-pack) に従って圧縮済みの OHLCV データ**を、
再圧縮なしで OhlcvStore に直接取り込むための内部 API。

### データフロー比較

```
通常パス:
  Raw OHLCV  ──→  push_internal()  ──→  dd encode + zigzag + bitpack  ──→  packed_blocks  ──→  GPU shader unpack (visible window)

DDBP Ingest パス:
  Packed OHLCV  ──→  ingest_packed_ohlcv()  ──→  packed_blocks に直接 adopt  ──→  GPU shader unpack (visible window)
                                                   (再圧縮なし)
```

## Payload 仕様

### Flat Buffer Layout

3 本の TypedArray を Worker に Transfer する：

| Buffer | TypedArray | 内容 |
|--------|-----------|------|
| `time` | `Float64Array` | ミリ秒タイムスタンプ（raw、非圧縮） |
| `blockMeta` | `Uint32Array` | ブロックメタデータ配列 (stride = 17 u32 / block) |
| `blockWords` | `Uint32Array` | 全ブロックのパック済みペイロードワード（連結） |

### スカラーパラメータ

| フィールド | 型 | 説明 |
|------------|-----|------|
| `count` | `number` | 総バー数 (`time.length`) |
| `blockSize` | `number` | 1 ブロックのバー数 (通常 1024、Store と一致必須) |
| `tickSize` | `number` (f64) | 量子化刻み幅 (> 0, finite) |
| `basePrice` | `number` (f64) | 量子化基準価格 (finite) |

### blockMeta Stride (`PACKED_INGEST_META_STRIDE = 17`)

1 ブロックあたり 17 個の `u32` で構成：

```
offset  field
------  -----
[0]     bar_count          — このブロックのバー数
[1]     open.base_value    — (as i32)
[2]     open.bit_width
[3]     open.payload_bit_offset
[4]     high.base_value
[5]     high.bit_width
[6]     high.payload_bit_offset
[7]     low.base_value
[8]     low.bit_width
[9]     low.payload_bit_offset
[10]    close.base_value
[11]    close.bit_width
[12]    close.payload_bit_offset
[13]    volume.base_value
[14]    volume.bit_width
[15]    volume.payload_bit_offset
[16]    word_count         — このブロックのペイロード u32 ワード数
```

チャネル順は固定: **open, high, low, close, volume** (OHLCV)。

### 制約条件

- Store は **空でなければならない** (`len == 0 && packed_blocks.is_empty() && push_buf_len == 0`)
- `bar_count <= block_size`
- **partial block (bar_count < block_size) は最終ブロックのみ** 許可
- `blockMeta.length % 17 === 0`
- `sum(word_count for all blocks) <= blockWords.length`
- `sum(bar_count for all blocks) === count`

### Full Block vs Partial Block の処理

- **Full block** (`bar_count == block_size`): `PackedOhlcvBlock` として `packed_blocks` に直接 adopt。
  `packed_words` は `to_vec()` で所有権を取得するが、**再圧縮は一切行わない**。
- **Partial tail block** (`bar_count < block_size`): `decomp_scratch` に一時展開し、
  `push_buf_*` に delta-delta 値として格納。後続の `push()` でバーが追加され
  block_size に達した時点で `flush_push_buf()` によりパックされる。

### Time Lane の処理

Time はすべてのケースで **delta-delta encode をローカルに再実行** する。
理由: `self.time: Vec<i64>` は dd-encoded i64 で格納されており、GPU decode パスや
`decompress_view_window()` がこの形式を前提としているため。
Time の dd encode は per-bar O(1) の加減算のみで、OHLCV チャネルの bitpack 処理と
比較すると無視できるコスト。

## JS/TS 側インターフェース

### Worker Message (`set_data_ddbp`)

```typescript
interface DataWorkerSetDataDdbp {
  type: 'set_data_ddbp';
  count: number;
  blockSize: number;
  tickSize: number;
  basePrice: number;
  time: ArrayBufferLike;         // Transfer 対象
  timeByteOffset: number;        // TypedArray view の byteOffset
  timeLength: number;            // TypedArray view の element count
  blockMeta: ArrayBufferLike;
  blockMetaByteOffset: number;
  blockMetaLength: number;
  blockWords: ArrayBufferLike;
  blockWordsByteOffset: number;
  blockWordsLength: number;
}
```

Worker 側では `byteOffset` / `length` から `new Float64Array(buf, off, len)` で
TypedArray view を再構築する。これにより、送信元で subarray view を使っていた場合でも
正しいデータ範囲を参照できる。

### Hidden API (`__setDataDdbp`)

```typescript
// 非公開 — enumerable: false
const api = createChart(container, options);
(api as any).__setDataDdbp({
  count: 10240,
  blockSize: 1024,
  tickSize: 0.01,
  basePrice: 100.0,
  time: new Float64Array(timestamps),
  blockMeta: new Uint32Array(metaFlatArray),
  blockWords: new Uint32Array(packedPayload),
});
```

`Object.defineProperty` で `enumerable: false, configurable: false, writable: false` として
IChartApi に追加。`Object.keys()` / `for...in` / JSON.stringify には現れない。

Transfer は自動: 3 つの TypedArray の underlying `ArrayBuffer` が Transferable として
Worker に渡される。共有 buffer の重複 Transfer も自動回避。

## ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `crates/mochart-wasm-new/src/bitpack.rs` | `PackedOhlcvBlockRef<'a>`, `unpack_ohlcv_block_ref_into()` |
| `crates/mochart-wasm-new/src/store.rs` | `ingest_packed_ohlcv()`, `ingest_packed_ohlcv_slices()`, テスト |
| `src/api/workerProtocol.ts` | `DataWorkerSetDataDdbp` 型定義 |
| `src/api/createChart.ts` | `InternalPackedDdbpInput`, `__setDataDdbp` hidden property |
| `crates/mochart-wasm-new/src/demo/unified_worker.js` | `ingestPackedDdbpPayload()`, `set_data_ddbp` handler |
| `crates/mochart-wasm-new/src/demo/data_worker.js` | 同上 (legacy worker) |

## Rust API

```rust
// crates/mochart-wasm-new/src/store.rs

/// WASM エントリポイント
#[wasm_bindgen]
pub fn ingest_packed_ohlcv(
    &mut self,
    time_ms: &[f64],       // ミリ秒タイムスタンプ
    block_meta: &[u32],    // stride=17 のフラットメタ配列
    block_words: &[u32],   // パック済みペイロードワード
    tick_size: f64,
    base_price: f64,
) -> Result<usize, JsValue>
```
