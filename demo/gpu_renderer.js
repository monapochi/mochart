/**
 * gpu_renderer.js — Pure-JavaScript WebGPU renderer (P1 Architecture Inversion)
 *
 * Ports the WebGPU rendering logic from renderer.rs (Rust/wasm-bindgen) to
 * pure JS, enabling the Render Worker to be fully WASM-free.
 *
 * Pipeline:
 *   1. minmax_compute: GPU atomic min/max on high/low channels → mm[2] buffer
 *   2. candles_auto_render: instanced candle draw reading GPU-computed mm
 *   3. EP indicator draws (× render_cmd_count): arena-backed indicator overlays
 *      Styles: ThickLine (indicator_render.wgsl), Histogram (indicator_histogram.wgsl),
 *              Band fill (indicator_band.wgsl)
 *
 * All GPU buffers are lazily allocated and grown when capacity is exceeded.
 * No CPU readback in the render loop (JS readback = zero).
 */

import {
  FRAME_MAX_BARS,
  FBUF_HDR_BYTES,
  FBUF_OPEN_OFF, FBUF_HIGH_OFF, FBUF_LOW_OFF, FBUF_CLOSE_OFF, FBUF_VOL_OFF,
  FBUF_SMA20_OFF, FBUF_SMA50_OFF, FBUF_SMA100_OFF,
  FBUF_START_BAR, FBUF_VIS_BARS, FBUF_VIEW_LEN, FBUF_CANVAS_W, FBUF_CANVAS_H, FBUF_CANDLE_W,
  FBUF_PRICE_MIN, FBUF_PRICE_MAX, FBUF_FLAGS,
  // indSAB
  INDSAB_HDR_BYTES,
  INDSAB_SEQ_OFF, INDSAB_ARENA_LEN, INDSAB_CMD_COUNT, INDSAB_REVISION,
  INDSAB_CMD_BASE, INDSAB_CMD_STRIDE,
  INDSAB_CMD_ARENA_OFFSET, INDSAB_CMD_BAR_COUNT, INDSAB_CMD_WARMUP,
  INDSAB_CMD_COLOR_R, INDSAB_CMD_COLOR_G, INDSAB_CMD_COLOR_B, INDSAB_CMD_COLOR_A,
  INDSAB_CMD_STYLE, INDSAB_CMD_PANE, INDSAB_CMD_BAND_ALT_OFF, INDSAB_CMD_LINE_WIDTH,
  INDSAB_CMD_FLAG_MASK, INDSAB_CMD_VALUE_MIN, INDSAB_CMD_VALUE_MAX,
  INDSAB_ARENA_OFF,
} from './shared_protocol.js';

// ── Render style constants (must match execution_plan.rs RenderStyle) ─────
const STYLE_LINE       = 0;
const STYLE_THICK_LINE = 1;
const STYLE_HISTOGRAM  = 2;
const STYLE_BAND       = 3;

// ── WGSL shader source paths (relative to this module's URL) ─────────────
const SHADERS_BASE = '../shaders/';

/** @param {string} name */
async function fetchShader(name) {
  const url = new URL(SHADERS_BASE + name, import.meta.url).href;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch shader ${name}: ${resp.status}`);
  return resp.text();
}

// ── GpuRenderer ────────────────────────────────────────────────────────────

export class GpuRenderer {
  /** @type {GPUDevice|null}        */ device         = null;
  /** @type {GPUCanvasContext|null} */ context        = null;
  /** @type {string}                */ format         = '';

  // ── Pipelines (lazily created once) ──────────────────────────────────────
  /** @type {GPUComputePipeline|null}  */ minmaxPipeline  = null;
  /** @type {GPURenderPipeline|null}   */ candlePipeline  = null;
  /** @type {GPURenderPipeline|null}   */ linePipeline    = null;
  // EP indicator pipelines — arena-backed
  /** @type {GPURenderPipeline|null}   */ indLinePipeline = null;   // ThickLine / Line
  /** @type {GPURenderPipeline|null}   */ indHistPipeline = null;   // Histogram
  /** @type {GPURenderPipeline|null}   */ indBandPipeline = null;   // Band fill
  /** @type {string} */                  _minmaxWgsl     = '';
  /** @type {string} */                  _candleWgsl     = '';
  /** @type {string} */                  _lineWgsl       = '';
  /** @type {string} */                  _smaWgsl        = '';
  /** @type {string} */                  _vpWgsl         = '';
  /** @type {string} */                  _indLineWgsl    = '';
  /** @type {string} */                  _indHistWgsl    = '';
  /** @type {string} */                  _indBandWgsl    = '';

  // ── GPU buffers (lazily allocated, grown on demand) ───────────────────────
  /** @type {GPUBuffer|null} */ storageBuf      = null;   // [open|high|low|close] × viewLen f32
  /** @type {number}         */ storageBufSize  = 0;      // bytes
  /** @type {GPUBuffer|null} */ mmBuf           = null;   // 8B: [atomicMax(high), atomicMin(low)]
  /** @type {GPUBuffer|null} */ computeParamBuf = null;   // 16B uniform
  /** @type {GPUBuffer|null} */ candleUniBuf    = null;   // 96B uniform
  // SMA line buffers (one set per period index, lazy) — legacy path only
  /** @type {Map<number, {buf: GPUBuffer, size: number}>} */ smaLineBufs = new Map();
  /** @type {GPUBuffer|null} */ lineUniBuf      = null;   // 64B uniform (legacy SMA)
  // EP arena GPU buffer (shared across all indicator draw calls)
  /** @type {GPUBuffer|null} */  arenaGpuBuf     = null;
  /** @type {number}         */  arenaGpuBufSize = 0;      // bytes
  // Per-cmd uniform buffer pool (one 80B GPUBuffer per visible indicator cmd).
  // Grown lazily to MAX_RENDER_CMDS; never shrunk to avoid GC churn.
  /** @type {GPUBuffer[]} */     _uniPool        = [];
  // indSAB reference (set by setIndSab; render_worker transfers on init)
  /** @type {SharedArrayBuffer|null} */ indSab        = null;
  /** @type {DataView|null}           */ _indHdrView   = null;
  /** @type {number}                  */ _indRevision  = -1;   // last revision seen
  // GPU compute resources for Volume Profile
  /** @type {GPUComputePipeline|null} */ vpPipeline = null;
  /** @type {GPUBuffer|null} */ vpBuffer = null;
  /** @type {GPUBuffer|null} */ vpParamsBuf = null;
  
  // ── Reusable CPU buffers for Uniform uploads (avoid per-frame allocation) ──
  _cpData = new Uint32Array(4);       // computeParamBuf (16B)
  _candleUbuf = new ArrayBuffer(96);  // candleUniBuf (96B)
  _candleUbufF32 = new Float32Array(this._candleUbuf);
  _candleUbufU32 = new Uint32Array(this._candleUbuf);
  _lineUbuf = new ArrayBuffer(64);    // lineUniBuf (64B)
  _vpParamsBuf = new ArrayBuffer(32); // vpParamsBuf (32B)
  _vpRenderUbuf = new ArrayBuffer(48);// vpRenderUniforms (48B)
  _indUniBuf = new ArrayBuffer(80);   // EP indicator uniform (80B = max of all shader types)

  // Timestamp query resources
  /** @type {GPUQuerySet|null} */ timestampQuerySet = null;
  /** @type {GPUBuffer|null} */ timestampResolveBuf = null;
  /** @type {GPUBuffer|null} */ timestampReadBuf = null;

  // ── Canvas dimensions ─────────────────────────────────────────────────────
  physW = 0;
  physH = 0;

  /**
   * Initialise WebGPU adapter, device, and canvas context.
   * Fetches shaders and verifies pipeline creation.
   * @param {OffscreenCanvas} gpuCanvas
   * @returns {Promise<{device: GPUDevice, format: string}>}
   */
  async init(gpuCanvas) {
    if (!navigator.gpu) throw new Error('WebGPU not available');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter');

    const features = [];
    if (adapter.features.has('timestamp-query')) features.push('timestamp-query');
    if (adapter.features.has('subgroups'))        features.push('subgroups');

    this.device  = await adapter.requestDevice({ requiredFeatures: features });
    this.format  = navigator.gpu.getPreferredCanvasFormat();
    this.context = gpuCanvas.getContext('webgpu');
    if (!this.context) throw new Error('Failed to get WebGPU context');

    // Configure canvas (will be reconfigured on resize)
    this._configureContext(gpuCanvas.width, gpuCanvas.height);

    // Fetch WGSL shaders (once at init, cached as strings)
    [this._minmaxWgsl, this._candleWgsl, this._lineWgsl, this._smaWgsl, this._vpWgsl, this._vpRenderWgsl,
     this._indLineWgsl, this._indHistWgsl, this._indBandWgsl] = await Promise.all([
      fetchShader('minmax_compute.wgsl'),
      fetchShader('candles_auto_render.wgsl'),
      fetchShader('line_thick.wgsl'),
      fetchShader('sma_compute.wgsl'),
      fetchShader('volume_profile.wgsl'),
      fetchShader('vp_render.wgsl'),
      fetchShader('indicator_render.wgsl'),
      fetchShader('indicator_histogram.wgsl'),
      fetchShader('indicator_band.wgsl'),
    ]);

    // Create pipelines eagerly so first frame has no jank from lazy init
    this.minmaxPipeline  = this._makeComputePipeline(this._minmaxWgsl);
    this.candlePipeline  = this._makeRenderPipeline(this._candleWgsl);
    this.linePipeline    = this._makeRenderPipeline(this._lineWgsl);
    // EP indicator pipelines
    this.indLinePipeline = this._makeRenderPipeline(this._indLineWgsl);
    this.indHistPipeline = this._makeRenderPipeline(this._indHistWgsl);
    this.indBandPipeline = this._makeRenderPipeline(this._indBandWgsl);

    // Device lost handler
    this.device.lost.then(info => {
      console.error('[gpu_renderer] device lost:', info.message);
    });
    this.device.addEventListener('uncapturederror', ev => {
      console.error('[gpu_renderer] uncaptured error:', ev.error?.message ?? ev);
    });

    // ── VRAM Tracker Injection (robust) ──
    // Track GPU buffer allocations to report approximate VRAM usage for debugging.
    // Uses a WeakMap + FinalizationRegistry + explicit unregister on destroy to avoid
    // double-subtraction when buffers are both destroyed and GC-collected.
    const originalCreateBuffer = this.device.createBuffer.bind(this.device);
    this._vramTotalBytes = 0;
    this._vramBufSizes = new WeakMap();
    this._vramRegistry = new FinalizationRegistry(size => {
      // Finalizer runs only for buffers that were not explicitly destroyed/unregistered.
      this._vramTotalBytes -= size;
    });
    this.device.createBuffer = (descriptor) => {
      const buf = originalCreateBuffer(descriptor);
      const size = Number(descriptor && descriptor.size) || 0;
      // Record and account
      this._vramBufSizes.set(buf, size);
      this._vramTotalBytes += size;
      // register with unregister token = buf so we can cancel finalizer when destroyed
      this._vramRegistry.register(buf, size, buf);

      // Monkey-patch destroy to reliably track explicit destroys
      const originalDestroy = buf.destroy.bind(buf);
      buf.destroy = () => {
        const s = this._vramBufSizes.get(buf) || 0;
        if (s) {
          this._vramTotalBytes -= s;
          this._vramBufSizes.delete(buf);
        }
        this._vramRegistry.unregister(buf);
        originalDestroy();
      };
      return buf;
    };
    // ─────────────────────────────────────

    return { device: this.device, format: this.format };
  }

  /**
   * Initialize timestamp query resources (optional).
   * @param {number} capacity
   */
  initTimestampQuery(capacity) {
    if (!this.device) return false;
    try {
      if (!this.device.features || !this.device.features.has('timestamp-query')) return false;
      this.timestampQuerySet = this.device.createQuerySet({ type: 'timestamp', count: capacity });
      this.timestampResolveBuf = this.device.createBuffer({ size: capacity * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
      this.timestampReadBuf = this.device.createBuffer({ size: capacity * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      return true;
    } catch (e) { console.warn('[gpu_renderer] initTimestampQuery failed:', e); return false; }
  }

  /**
   * Resolve a range of timestamps into the read buffer and submit.
   * @param {number} first
   * @param {number} count
   */
  resolveTimestampQuery(first, count) {
    if (!this.device || !this.timestampQuerySet) return;
    const encoder = this.device.createCommandEncoder();
    encoder.resolveQuerySet(this.timestampQuerySet, first, count, this.timestampResolveBuf, 0);
    encoder.copyBufferToBuffer(this.timestampResolveBuf, 0, this.timestampReadBuf, 0, count * 8);
    this.device.queue.submit([encoder.finish()]);
  }

  /**
   * Await and return timestamp results as BigUint64Array.
   * @returns {Promise<BigUint64Array>}
   */
  async getTimestampResults() {
    if (!this.timestampReadBuf) return null;
    const mapMode = typeof GPUMapMode !== 'undefined' ? GPUMapMode.READ : 1;
    await this.timestampReadBuf.mapAsync(mapMode);
    const arrBuf = this.timestampReadBuf.getMappedRange(0);
    // Copy out to avoid lifetime issues
    const copied = arrBuf.slice(0);
    this.timestampReadBuf.unmap();
    return new BigUint64Array(copied);
  }

  /**
   * Resize: set physical canvas size and reconfigure context.
   * @param {OffscreenCanvas} gpuCanvas
   * @param {number} physW
   * @param {number} physH
   */
  setSize(gpuCanvas, physW, physH) {
    if (this.physW === physW && this.physH === physH) return;
    gpuCanvas.width  = physW;
    gpuCanvas.height = physH;
    this.physW = physW;
    this.physH = physH;
    this._configureContext(physW, physH);
  }

  /**
   * Render one GPU frame: candles (minmax compute) + SMA overlay lines.
   * Returns the padded price range [pMin, pMax] for the HUD.
   *
   * @param {SharedArrayBuffer} frameBuf
   * @param {DataView}  fdbHdr   — DataView on frameBuf header (bytes 0-127)
   * @param {number}    viewLen  — actual bar count from FDB
   * @returns {[number, number]}  [paddedMin, paddedMax]
   */
  drawGpu(frameBuf, fdbHdr, viewLen) {
    if (viewLen === 0) return [0, 1];
    const { device } = this;
    const queue = device.queue;

    const startBar = fdbHdr.getUint32 (FBUF_START_BAR, true);
    const visBc    = fdbHdr.getUint32 (FBUF_VIS_BARS,  true);
    const plotW    = fdbHdr.getFloat32(FBUF_CANVAS_W,  true);
    const plotH    = fdbHdr.getFloat32(FBUF_CANVAS_H,  true);
    const candleW  = fdbHdr.getFloat32(FBUF_CANDLE_W,  true);
    const pmin     = fdbHdr.getFloat32(FBUF_PRICE_MIN, true);
    const pmax     = fdbHdr.getFloat32(FBUF_PRICE_MAX, true);
    const flags    = fdbHdr.getUint32 (FBUF_FLAGS,     true);

    const DPR = this.dpr;

    // ── 0. Pane layout (must precede price padding — uses mainH) ─────────
    const paneLayout = this._computePaneLayout(plotH, flags);
    const mainH = paneLayout.main.h;

    // Padded price range (5% + min 6px — uses main pane height, not full canvas)
    const range   = pmax - pmin || 1;
    const pad     = Math.max(range * 0.05, (6 / Math.max(mainH, 1)) * range);
    const paddedMin = pmin - pad;
    const paddedMax = pmax + pad;

    // ── 1. Ensure storage buffer: [open|high|low|close|vol] × viewLen f32 ──────
    const storageNeeded = viewLen * 5 * 4;  // 5 channels × 4 bytes
    if (!this.storageBuf || this.storageBufSize < storageNeeded) {
      this.storageBuf?.destroy();
      this.storageBuf = device.createBuffer({
        size:  storageNeeded,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      this.storageBufSize = storageNeeded;
    }

    // Upload SoA channels from frameBuf (SAB) to storage buffer
    // queue.writeBuffer accepts SharedArrayBuffer via TypedArray views in Chrome
    const stride = viewLen * 4;
    queue.writeBuffer(this.storageBuf,    0, new Float32Array(frameBuf, FBUF_OPEN_OFF,  viewLen));
    queue.writeBuffer(this.storageBuf, stride, new Float32Array(frameBuf, FBUF_HIGH_OFF,  viewLen));
    queue.writeBuffer(this.storageBuf, stride * 2, new Float32Array(frameBuf, FBUF_LOW_OFF,   viewLen));
    queue.writeBuffer(this.storageBuf, stride * 3, new Float32Array(frameBuf, FBUF_CLOSE_OFF, viewLen));
    queue.writeBuffer(this.storageBuf, stride * 4, new Float32Array(frameBuf, FBUF_VOL_OFF,   viewLen));

    // Upload CPU-precomputed SMA values from frameBuf (SAB) into GPU buffers.
    // Skipped when the EP pipeline is active (indSab set) — the arena carries
    // all indicator data and the legacy per-period buffers are not needed.
    if (!this.indSab) {
      try {
        if (flags & 1) this._uploadSmaToBuf(viewLen, FBUF_SMA20_OFF,  frameBuf);
        if (flags & 2) this._uploadSmaToBuf(viewLen, FBUF_SMA50_OFF,  frameBuf);
        if (flags & 4) this._uploadSmaToBuf(viewLen, FBUF_SMA100_OFF, frameBuf);
      } catch (e) { console.warn('[gpu_renderer] SMA upload failed:', e); }
    }

    // ── 2. Minmax buffer (8B): [atomicMax(high_bits), atomicMin(low_bits)] ──
    if (!this.mmBuf) {
      this.mmBuf = device.createBuffer({
        size:  16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }
    // Reset: max_init=0.0 (0x00000000), min_init=f32::MAX (0x7F7FFFFF)
    const mmInit = new Uint32Array([0x00000000, 0x7F7FFFFF, 0, 0]);
    queue.writeBuffer(this.mmBuf, 0, mmInit);

    // ── 3. Compute params buffer (16B uniform) ────────────────────────────
    if (!this.computeParamBuf) {
      // Use 32 bytes to satisfy minBindingSize requirements on some drivers
      this.computeParamBuf = device.createBuffer({
        size:  32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    // { total_len, start_index=0, visible_count, _pad }
    const cpData = new Uint32Array([viewLen, 0, viewLen, 0]);
    queue.writeBuffer(this.computeParamBuf, 0, cpData);

    // ── 4. Candle uniform buffer (96B) ─────────────────────────────────────
    if (!this.candleUniBuf) {
      this.candleUniBuf = device.createBuffer({
        size:  96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    {
      const b = new ArrayBuffer(96);
      const v = new DataView(b);
      v.setFloat32( 0, plotW,   true);  // pw
      v.setFloat32( 4, candleW, true);  // cw
      v.setUint32 ( 8, viewLen, true);  // total_len
      v.setUint32 (12, 0,       true);  // start_index
      v.setUint32 (16, viewLen, true);  // visible_count
      v.setFloat32(20, mainH,   true);  // ph — main pane height (not full canvas)
      v.setFloat32(24, DPR,     true);  // border_width (1.0 CSS px)
      v.setUint32 (28, visBc,   true);  // slots (replace _pad)
      // bull_color: #00AA00 alpha 1
      v.setFloat32(32, 0.00, true); v.setFloat32(36, 0.67, true);
      v.setFloat32(40, 0.00, true); v.setFloat32(44, 1.00, true);
      // bear_color: #CC3333 alpha 1
      v.setFloat32(48, 0.80, true); v.setFloat32(52, 0.20, true);
      v.setFloat32(56, 0.20, true); v.setFloat32(60, 1.00, true);
      // wick_color: rgba(100,100,100,1)
      v.setFloat32(64, 0.39, true); v.setFloat32(68, 0.39, true);
      v.setFloat32(72, 0.39, true); v.setFloat32(76, 1.00, true);
      // border_color: same as wick
      v.setFloat32(80, 0.39, true); v.setFloat32(84, 0.39, true);
      v.setFloat32(88, 0.39, true); v.setFloat32(92, 1.00, true);
      queue.writeBuffer(this.candleUniBuf, 0, b);
    }

    // ── 5. Encode: compute pass + candle render pass ──────────────────────
    const encoder = device.createCommandEncoder();

    // Compute pass: minmax
    {
      const compBGL = this.minmaxPipeline.getBindGroupLayout(0);
      const compBG  = device.createBindGroup({
        layout: compBGL,
        entries: [
          { binding: 0, resource: { buffer: this.storageBuf } },
          { binding: 1, resource: { buffer: this.mmBuf } },
          { binding: 2, resource: { buffer: this.computeParamBuf } },
        ],
      });
      const compPass = encoder.beginComputePass();
      compPass.setPipeline(this.minmaxPipeline);
      compPass.setBindGroup(0, compBG);
      compPass.dispatchWorkgroups(Math.ceil(viewLen / 64));
      compPass.end();
    }

    // Render pass: candles (clears to background)
    {
      const candleBGL = this.candlePipeline.getBindGroupLayout(0);
      const candleBG  = device.createBindGroup({
        layout: candleBGL,
        entries: [
          { binding: 0, resource: { buffer: this.candleUniBuf } },
          { binding: 1, resource: { buffer: this.storageBuf } },
          { binding: 2, resource: { buffer: this.mmBuf } },
        ],
      });
      const swapView = this.context.getCurrentTexture().createView();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view:       swapView,
          loadOp:     'clear',
          storeOp:    'store',
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
        }],
      });
      // Restrict candle drawing to main pane (sub-pane regions stay cleared to white)
      if (mainH < plotH) renderPass.setViewport(0, 0, plotW, mainH, 0, 1);
      renderPass.setPipeline(this.candlePipeline);
      renderPass.setBindGroup(0, candleBG);
      renderPass.draw(12, viewLen);  // 12 verts (6 body + 6 wick), viewLen instances
      renderPass.end();
    }

    queue.submit([encoder.finish()]);

    // ── 6. Indicator overlays ────────────────────────────────────────────────
    if (this.indSab) {
      // EP pipeline: arena-driven draw loop (replaces legacy per-SMA calls).
      this._drawIndicatorCmds(plotW, candleW, paddedMin, paddedMax, paneLayout, flags, visBc);
    } else {
      // Legacy SMA overlay — used when indSab is not set (no EP integration).
      // nanStart heuristic: bars before (period-1) have incomplete history.
      if (flags & 1) this._drawSmaLine(FBUF_SMA20_OFF,  viewLen, Math.max(0, 20  - 1 - startBar), plotW, mainH, candleW, paddedMin, paddedMax, 0.00, 0.56, 0.73, 1.0, DPR * 1.5, visBc);
      if (flags & 2) this._drawSmaLine(FBUF_SMA50_OFF,  viewLen, Math.max(0, 50  - 1 - startBar), plotW, mainH, candleW, paddedMin, paddedMax, 1.00, 0.76, 0.03, 1.0, DPR * 1.5, visBc);
      if (flags & 4) this._drawSmaLine(FBUF_SMA100_OFF, viewLen, Math.max(0, 100 - 1 - startBar), plotW, mainH, candleW, paddedMin, paddedMax, 0.91, 0.12, 0.39, 1.0, DPR * 1.5, visBc);
    }

    // ── 7. Volume Profile Heatmap ─────────────────────────────────────────
    if (flags & 16) {
      const numBins = 70;
      this.computeVolumeProfileOnGpu(viewLen, numBins, paddedMin, paddedMax);
      this._drawVolumeProfileHeatmap(plotW, mainH, numBins, plotW - 120, 120, 0.4, 0.4, 0.9, 0.3);
    }

    return [paddedMin, paddedMax];
  }

  /**
   * Draw one SMA indicator line overlay.
   * Assumes SMA data is already in the GPU buffer (uploaded by _uploadSmaToBuf).
   * @private
   */
  _drawSmaLine(smaByteOff, viewLen, nanStart, plotW, plotH, candleW,
               priceMin, priceMax, r, g, b, a, lineWidthPx, visBc) {
    if (viewLen < 2) return;
    const { device } = this;
    const queue = device.queue;

    // Lookup pre-uploaded SMA GPU buffer
    const entry = this.smaLineBufs.get(smaByteOff);
    if (!entry) return;  // _uploadSmaToBuf wasn't called — skip

    // Lazy allocate line uniform buffer (64B, shared across all lines)
    if (!this.lineUniBuf) {
      this.lineUniBuf = device.createBuffer({
        size:  64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    // Pack 64B line uniforms
    {
      const b = new ArrayBuffer(64);
      const v = new DataView(b);
      v.setFloat32( 0, plotW,       true);  // plot_w
      v.setFloat32( 4, plotH,       true);  // plot_h
      v.setFloat32( 8, candleW,     true);  // candle_w
      v.setFloat32(12, priceMin,    true);  // price_min
      v.setFloat32(16, priceMax,    true);  // price_max
      v.setFloat32(20, lineWidthPx, true);  // line_width_px
      v.setUint32 (24, 0,           true);  // _pad0
      v.setUint32 (28, 0,           true);  // _pad1
      v.setFloat32(32, r, true); v.setFloat32(36, g, true);   // color vec4
      v.setFloat32(40, b, true); v.setFloat32(44, a, true);
      v.setUint32 (48, viewLen,  true);  // bar_count
      v.setUint32 (52, nanStart, true);  // nan_start (warmup bars clipped)
      v.setUint32 (56, visBc,    true);  // slots (_pad2)
      v.setUint32 (60, 0,        true);
      queue.writeBuffer(this.lineUniBuf, 0, b);
    }

    const lineBGL = this.linePipeline.getBindGroupLayout(0);
    const lineBG  = device.createBindGroup({
      layout: lineBGL,
      entries: [
        { binding: 0, resource: { buffer: this.lineUniBuf } },
        { binding: 1, resource: { buffer: entry.buf } },
      ],
    });

    // Current swapchain texture (LoadOp::load — overlay on top of candles)
    const swapView = this.context.getCurrentTexture().createView();
    const encoder  = device.createCommandEncoder();
    const pass     = encoder.beginRenderPass({
      colorAttachments: [{
        view:    swapView,
        loadOp:  'load',
        storeOp: 'store',
      }],
    });
    // Restrict legacy SMA lines to main pane viewport
    pass.setViewport(0, 0, plotW, plotH, 0, 1);
    pass.setPipeline(this.linePipeline);
    pass.setBindGroup(0, lineBG);
    pass.draw((viewLen - 1) * 6);  // (N-1) segments × 6 verts each
    pass.end();
    queue.submit([encoder.finish()]);
  }

  /**
   * Draw the Volume Profile Heatmap.
   * Assumes computeVolumeProfileOnGpu has already populated this.vpBuffer.
   * @private
   */
  _drawVolumeProfileHeatmap(plotW, plotH, numBins, panelX, panelW, r, g, b, a) {
    if (!this.vpBuffer || !this.device) return;
    const { device } = this;
    const queue = device.queue;

    if (!this.vpRenderPipeline) {
      if (!this._vpRenderWgsl) return; // not loaded yet
      this.vpRenderPipeline = this._makeRenderPipeline(this._vpRenderWgsl);
    }

    if (!this.vpRenderUniforms) {
      this.vpRenderUniforms = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    const ubuf = this._vpRenderUbuf;
    const dv = new DataView(ubuf);
    dv.setFloat32(0, plotW, true);
    dv.setFloat32(4, plotH, true);
    dv.setUint32(8, numBins, true);
    // 12 is pad0
    dv.setFloat32(16, panelX, true);
    dv.setFloat32(20, panelW, true);
    dv.setFloat32(24, r, true);
    dv.setFloat32(28, g, true);
    dv.setFloat32(32, b, true);
    dv.setFloat32(36, a, true);
    // 40, 44 are pad1, pad2
    queue.writeBuffer(this.vpRenderUniforms, 0, ubuf);

    const bgl = this.vpRenderPipeline.getBindGroupLayout(0);
    const bg = device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: { buffer: this.vpRenderUniforms } },
        { binding: 1, resource: { buffer: this.vpBuffer } }
      ]
    });

    const swapView = this.context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: swapView,
        loadOp: 'load',
        storeOp: 'store',
      }]
    });
    // Restrict to main pane viewport (plotH may be mainH when sub-panes are active)
    pass.setViewport(0, 0, plotW, plotH, 0, 1);
    pass.setPipeline(this.vpRenderPipeline);
    pass.setBindGroup(0, bg);
    pass.draw(6, numBins);
    pass.end();
    queue.submit([encoder.finish()]);
  }

  // ── EP indicator pipeline ─────────────────────────────────────────────────

  /**
   * Set the indicator SharedArrayBuffer produced by data_worker's EP engine.
   * Called once from render_worker after receiving the init message.
   *
   * When EP is active, legacy SMA GPU resources are no longer needed.
   * Destroys them immediately to reclaim VRAM (Tier 3).
   * @param {SharedArrayBuffer} sab
   */
  setIndSab(sab) {
    this.indSab      = sab;
    this._indHdrView = new DataView(sab);
    // Tier 3: destroy legacy SMA GPU resources — EP arena carries all indicator data
    this._destroyLegacyResources();
  }

  /**
   * Destroy legacy per-SMA GPU buffers and line uniform buffer.
   * Called when EP pipeline is activated (setIndSab) because the arena-backed
   * indicator pipeline supersedes the per-period SMA path entirely.
   *
   * VRAM savings: 3 × viewLen × 4B storage + 64B uniform = ~2.5 KB typical.
   * More importantly, eliminates 3 redundant writeBuffer + drawSmaLine calls.
   * @private
   */
  _destroyLegacyResources() {
    for (const { buf } of this.smaLineBufs.values()) buf.destroy();
    this.smaLineBufs.clear();
    if (this.lineUniBuf) { this.lineUniBuf.destroy(); this.lineUniBuf = null; }
  }

  /**
   * Cap the uniform pool to exactly `count` buffers, destroying any excess.
   * Called after plan revision changes when the number of render commands decreases.
   * Prevents unbounded VRAM growth from past indicator configurations.
   *
   * @param {number} count — target pool size (= render_cmd_count from EP)
   */
  capUniformPool(count) {
    while (this._uniPool.length > count) {
      this._uniPool.pop().destroy();
    }
  }

  /**
   * Ensure the shared arena GPU buffer can hold at least `f32Count` f32 values.
   * Right-sizes: destroys and re-allocates when capacity is exceeded OR when the
   * current buffer is more than 4× larger than needed (VRAM reclaim).
   * @private
   * @param {number} f32Count
   */
  _ensureArenaGpuBuf(f32Count) {
    const needed = f32Count * 4;
    // Keep if within [needed, needed*4] — avoid thrashing on small fluctuations
    if (this.arenaGpuBuf && this.arenaGpuBufSize >= needed && this.arenaGpuBufSize <= needed * 4) return;
    this.arenaGpuBuf?.destroy();
    // Allocate exactly `needed` (no doubling — arena size is stable between recompiles)
    const size = Math.max(needed, 256);  // minimum 256B to avoid 0-size buffer
    this.arenaGpuBuf = this.device.createBuffer({
      size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    // DEV-ONLY: Log VRAM usage for the Arena buffer. Performance impact is zero because 
    // this path is only ever hit during initialization or when recompiling the ExecutionPlan,
    // NEVER inside the tight 60fps render loop.
    // console.log(`[VRAM] Allocated ExecutionPlan Arena GPUBuffer: ${size} bytes (${(size/1024/1024).toFixed(3)} MB)`);
    this.arenaGpuBufSize = size;
  }

  // ── Pane layout ──────────────────────────────────────────────────────────

  /**
   * Configure pane layout ratios and gap.
   * @param {{ main?: number, sub1?: number, sub2?: number, gap?: number }} cfg 
   */
  setPaneConfig(cfg) {
    this.paneConfig = { ...this.paneConfig, ...cfg };
  }

  /**
   * Scan indSAB render-cmd table to discover active sub-panes and compute
   * physical Y-offset / height for each pane region.
   *
   * @private
   * @param {number} plotH  total canvas height (physical px)
   * @param {number} flags  indicator visibility flags
   * @returns {{ main: {y:number,h:number}, sub1: {y:number,h:number}|null, sub2: {y:number,h:number}|null }}
   */
  _computePaneLayout(plotH, flags) {
    let hasSub1 = false, hasSub2 = false;
    if (this.indSab) {
      const hdr      = this._indHdrView;
      const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
      for (let ci = 0; ci < cmdCount; ci++) {
        const base     = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
        const pane     = hdr.getUint32(base + INDSAB_CMD_PANE,      true);
        const flagMask = hdr.getUint32(base + INDSAB_CMD_FLAG_MASK, true);
        const barCount = hdr.getUint32(base + INDSAB_CMD_BAR_COUNT, true);
        // Skip invisible or empty cmds
        if (flagMask !== 0 && (flags & flagMask) === 0) continue;
        if (barCount < 2) continue;
        if (pane === 1) hasSub1 = true;
        else if (pane === 2) hasSub2 = true;
      }
    }

    const config = this.paneConfig || { gap: 2, main: 7.0, sub1: 1.5, sub2: 1.5 };
    
    // Gap and bottom margin are logical CSS pixels conceptually, 
    // but plotH is in physical pixels. We apply DPR scaling here.
    const DPR = this.dpr;
    const gap = (config.gap !== undefined ? config.gap : 2) * DPR;
    // Reserve ~8 CSS pixels at the bottom for the date axis so sub panes don't overlap it.
    const marginBot = (config.marginBot !== undefined ? config.marginBot : 8) * DPR;
    const usableH = Math.max(1, plotH - marginBot);

    let layout;
    if (hasSub1 && hasSub2) {
      const rM = config.main || 7.0;
      const r1 = config.sub1 || 1.5;
      const r2 = config.sub2 || 1.5;
      const total = rM + r1 + r2;
      const usable = usableH - gap * 2;
      const mainH = Math.max(1, Math.round(usable * (rM / total)));
      const sub1H = Math.max(1, Math.round(usable * (r1 / total)));
      const sub2H = Math.max(1, usable - mainH - sub1H);
      layout = {
        main: { y: 0, h: mainH },
        sub1: { y: mainH + gap, h: sub1H },
        sub2: { y: mainH + sub1H + gap * 2, h: sub2H },
      };
    } else if (hasSub1) {
      const rM = config.main || 7.0;
      const r1 = config.sub1 || 1.5;
      const total = rM + r1;
      const usable = usableH - gap;
      const mainH = Math.max(1, Math.round(usable * (rM / total)));
      layout = {
        main: { y: 0, h: mainH },
        sub1: { y: mainH + gap, h: usable - mainH },
        sub2: null,
      };
    } else if (hasSub2) {
      const rM = config.main || 7.0;
      const r2 = config.sub2 || 1.5;
      const total = rM + r2;
      const usable = usableH - gap;
      const mainH = Math.max(1, Math.round(usable * (rM / total)));
      layout = {
        main: { y: 0, h: mainH },
        sub1: null,
        sub2: { y: mainH + gap, h: usable - mainH },
      };
    } else {
      layout = { main: { y: 0, h: usableH }, sub1: null, sub2: null };
    }
    layout.gap = gap;
    
    this.paneLayout = layout;
    return layout;
  }

  /**
   * Read the indSAB render-cmd table and dispatch one GPU draw per cmd.
   * Called from drawGpu() when this.indSab is set.
   * @private
   * @param {number} plotW
   * @param {number} candleW
   * @param {number} priceMin  padded price min
   * @param {number} priceMax  padded price max
   * @param {{ main: {y:number,h:number}, sub1: {y:number,h:number}|null, sub2: {y:number,h:number}|null }} paneLayout
   */
  _drawIndicatorCmds(plotW, candleW, priceMin, priceMax, paneLayout, flags = 0xffffffff, visBc) {
    const hdr      = this._indHdrView;
    const arenaLen = hdr.getUint32(INDSAB_ARENA_LEN, true);
    const cmdCount = hdr.getUint32(INDSAB_CMD_COUNT, true);
    const revision = hdr.getUint32(INDSAB_REVISION,  true);
    if (cmdCount === 0 || arenaLen === 0) return;

    // Tier 4: cap uniform pool when plan revision changes (fewer cmds → free excess)
    if (revision !== this._indRevision) {
      this._indRevision = revision;
      this.capUniformPool(cmdCount);
    }

    const { device } = this;
    const queue = device.queue;

    // Upload arena from indSAB to GPU (single writeBuffer for all indicators)
    this._ensureArenaGpuBuf(arenaLen);
    queue.writeBuffer(
      this.arenaGpuBuf, 0,
      new Float32Array(this.indSab, INDSAB_ARENA_OFF, arenaLen),
    );

    // ── Phase 1: collect visible commands, write per-cmd uniforms ──────────
    // Each cmd needs its own GPUBuffer (different arena_offset / colors per pass).
    const dv = new DataView(this._indUniBuf);
    const draws = [];  // { pipeline, uniBufIdx, uniSize, drawCount }
    let poolIdx = 0;

    for (let ci = 0; ci < cmdCount; ci++) {
      const base       = INDSAB_CMD_BASE + ci * INDSAB_CMD_STRIDE;
      const arenaOff   = hdr.getUint32 (base + INDSAB_CMD_ARENA_OFFSET, true);
      const barCount   = hdr.getUint32 (base + INDSAB_CMD_BAR_COUNT,    true);
      const warmup     = hdr.getUint32 (base + INDSAB_CMD_WARMUP,       true);
      const cr         = hdr.getFloat32(base + INDSAB_CMD_COLOR_R,      true);
      const cg         = hdr.getFloat32(base + INDSAB_CMD_COLOR_G,      true);
      const cb         = hdr.getFloat32(base + INDSAB_CMD_COLOR_B,      true);
      const ca         = hdr.getFloat32(base + INDSAB_CMD_COLOR_A,      true);
      const style      = hdr.getUint32 (base + INDSAB_CMD_STYLE,        true);
      const pane       = hdr.getUint32 (base + INDSAB_CMD_PANE,         true);
      const bandAltOff = hdr.getUint32 (base + INDSAB_CMD_BAND_ALT_OFF, true);
      const lineW      = hdr.getFloat32(base + INDSAB_CMD_LINE_WIDTH,   true);
      const flagMask   = hdr.getUint32 (base + INDSAB_CMD_FLAG_MASK,    true);
      const valueMin   = hdr.getFloat32(base + INDSAB_CMD_VALUE_MIN,    true);
      const valueMax   = hdr.getFloat32(base + INDSAB_CMD_VALUE_MAX,    true);

      // Skip if the indicator's toggle flag is off (0 = always show)
      if (flagMask !== 0 && (flags & flagMask) === 0) continue;
      if (barCount < 2) continue;

      // Y-domain: sub-pane indicators and histograms use their own value range;
      // main-pane lines/bands use the candle price range.
      const useValueDomain = pane !== 0 || style === STYLE_HISTOGRAM;
      const yMin = useValueDomain ? valueMin : priceMin;
      const yMax = useValueDomain ? valueMax : priceMax;

      // Resolve the pane's physical region for viewport + plot_h uniform.
      const paneRegion = pane === 2 ? paneLayout.sub2
                       : pane === 1 ? paneLayout.sub1
                       : paneLayout.main;
      // Skip draws targeting a pane that doesn't exist (no visible indicators in it)
      if (!paneRegion || paneRegion.h < 4) continue;
      const paneH = paneRegion.h;

      let pipeline, uniSize, drawCount;
      if (style === STYLE_HISTOGRAM) {
        const bars = barCount - warmup;
        if (bars < 1) continue;
        this._packHistogramUni(dv, plotW, paneH, candleW, yMin, yMax,
          arenaOff, barCount, warmup, cr, cg, cb, ca, visBc);
        pipeline = this.indHistPipeline; uniSize = 80; drawCount = bars * 6;
      } else if (style === STYLE_BAND) {
        const segs = barCount - warmup - 1;
        if (segs < 1) continue;
        this._packBandUni(dv, plotW, paneH, candleW, yMin, yMax,
          arenaOff, bandAltOff, barCount, warmup, cr, cg, cb, ca, visBc);
        pipeline = this.indBandPipeline; uniSize = 64; drawCount = segs * 6;
      } else {
        const seg = barCount - warmup - 1;
        if (seg < 1) continue;
        this._packThickLineUni(dv, plotW, paneH, candleW, yMin, yMax,
          arenaOff, barCount, warmup, lineW, cr, cg, cb, ca, visBc);
        pipeline = this.indLinePipeline; uniSize = 64; drawCount = seg * 6;
      }

      // Ensure pool slot and write uniforms
      this._ensureUniPool(poolIdx + 1);
      queue.writeBuffer(this._uniPool[poolIdx], 0, this._indUniBuf, 0, uniSize);
      draws.push({ pipeline, uniBufIdx: poolIdx, uniSize, drawCount,
                   vpY: paneRegion.y, vpH: paneRegion.h });
      poolIdx++;
    }

    if (draws.length === 0) return;

    // ── Phase 2: single render pass, N draws (PLAN §4.3 / §8) ────────────
    // One beginRenderPass → N × (setPipeline + setViewport + setBindGroup + draw)
    // → endRenderPass → submit.  Avoids N framebuffer load/store cycles.
    //
    // Bind groups are created per-draw because `layout: 'auto'` pipelines each
    // have their own GPUBindGroupLayout.  The creation cost is negligible.
    const swapView = this.context.getCurrentTexture().createView();
    const encoder  = device.createCommandEncoder();
    const pass     = encoder.beginRenderPass({
      colorAttachments: [{ view: swapView, loadOp: 'load', storeOp: 'store' }],
    });
    for (const { pipeline, uniBufIdx, uniSize, drawCount, vpY, vpH } of draws) {
      const uniBuf = this._uniPool[uniBufIdx];
      const bgl0   = pipeline.getBindGroupLayout(0);
      const bgl1   = pipeline.getBindGroupLayout(1);
      const bg0    = device.createBindGroup({ layout: bgl0, entries: [
        { binding: 0, resource: { buffer: uniBuf, size: uniSize } },
      ]});
      const bg1    = device.createBindGroup({ layout: bgl1, entries: [
        { binding: 0, resource: { buffer: this.arenaGpuBuf } },
      ]});
      pass.setViewport(0, vpY, plotW, vpH, 0, 1);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg0);
      pass.setBindGroup(1, bg1);
      pass.draw(drawCount);
    }
    pass.end();
    queue.submit([encoder.finish()]);

    // ── DEV-ONLY: Report Total VRAM Usage once every 2 seconds ──
    // const mb = (this._vramTotalBytes / 1024 / 1024).toFixed(3);
    // const ts = performance.now();
    // if (!this._lastVramLog || ts - this._lastVramLog > 2000) {
    //   console.log(`[VRAM Tracker] Total GPU Buffer size: ${this._vramTotalBytes} bytes (${mb} MB) | Uniform Pool Size: ${this._uniPool.length}`);
    //   this._lastVramLog = ts;
    // }
  }

  // ── EP uniform pack helpers (pure CPU writes into a shared ArrayBuffer) ───

  /** Pack 64B thick-line uniform into `dv`. */
  _packThickLineUni(dv, plotW, plotH, candleW, priceMin, priceMax,
                    arenaOffset, barCount, warmup, lineWidthPx, r, g, b, a, visBc) {
    dv.setFloat32( 0, plotW,       true);  // plot_w
    dv.setFloat32( 4, plotH,       true);  // plot_h
    dv.setFloat32( 8, candleW,     true);  // candle_w
    dv.setFloat32(12, priceMin,    true);  // price_min
    dv.setFloat32(16, priceMax,    true);  // price_max
    dv.setFloat32(20, lineWidthPx, true);  // line_width_px
    dv.setUint32 (24, arenaOffset, true);  // arena_offset
    dv.setUint32 (28, warmup,      true);  // warmup_bars
    dv.setFloat32(32, r, true); dv.setFloat32(36, g, true);
    dv.setFloat32(40, b, true); dv.setFloat32(44, a, true);
    dv.setUint32 (48, barCount,    true);  // bar_count
    dv.setUint32 (52, visBc, true); dv.setUint32(56, 0, true); dv.setUint32(60, 0, true);
  }

  /** Pack 80B histogram uniform into `dv`. */
  _packHistogramUni(dv, plotW, plotH, candleW, valueMin, valueMax,
                    arenaOffset, barCount, warmup, r, g, b, a, visBc) {
    dv.setFloat32( 0, plotW,       true);
    dv.setFloat32( 4, plotH,       true);
    dv.setFloat32( 8, candleW,     true);
    dv.setFloat32(12, valueMin,    true);
    dv.setFloat32(16, valueMax,    true);
    dv.setFloat32(20, 0.0,         true);  // zero_level
    dv.setUint32 (24, arenaOffset, true);
    dv.setUint32 (28, warmup,      true);
    dv.setFloat32(32, r,       true); dv.setFloat32(36, g,       true);
    dv.setFloat32(40, b,       true); dv.setFloat32(44, a,       true);
    dv.setFloat32(48, r * 0.6, true); dv.setFloat32(52, g * 0.6, true);
    dv.setFloat32(56, b * 0.6, true); dv.setFloat32(60, a,       true);
    dv.setUint32 (64, barCount,    true);
    dv.setFloat32(68, 0.1,         true);  // bar_gap (10%)
    dv.setUint32 (72, visBc, true); dv.setUint32(76, 0, true);
  }

  /** Pack 64B band uniform into `dv`. */
  _packBandUni(dv, plotW, plotH, candleW, priceMin, priceMax,
               arenaOffUpper, arenaOffLower, barCount, warmup, r, g, b, a, visBc) {
    dv.setFloat32( 0, plotW,         true);
    dv.setFloat32( 4, plotH,         true);
    dv.setFloat32( 8, candleW,       true);
    dv.setFloat32(12, priceMin,      true);
    dv.setFloat32(16, priceMax,      true);
    dv.setUint32 (20, arenaOffUpper, true);
    dv.setUint32 (24, arenaOffLower, true);
    dv.setUint32 (28, warmup,        true);
    dv.setFloat32(32, r, true); dv.setFloat32(36, g, true);
    dv.setFloat32(40, b, true); dv.setFloat32(44, a * 0.15, true);  // 15% fill
    dv.setUint32 (48, barCount,      true);
    dv.setUint32 (52, visBc, true); dv.setUint32(56, 0, true); dv.setUint32(60, 0, true);
  }

  /**
   * Ensure `_uniPool` has at least `count` GPUBuffers of 80B each.
   * Only grows — never destroys existing buffers to avoid use-after-free.
   * @param {number} count
   */
  _ensureUniPool(count) {
    while (this._uniPool.length < count) {
      this._uniPool.push(this.device.createBuffer({
        size:  80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: `indUni[${this._uniPool.length}]`,
      }));
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _configureContext(w, h) {
    if (!this.context || !this.device) return;
    this.context.configure({
      device:    this.device,
      format:    this.format,
      alphaMode: 'premultiplied',
    });
  }

  /** @param {string} wgsl @returns {GPUComputePipeline} */
  _makeComputePipeline(wgsl) {
    const mod = this.device.createShaderModule({ code: wgsl });
    return this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: mod, entryPoint: 'cs' },
    });
  }

  /**
   * Upload CPU-precomputed SMA data from frameBuf (SharedArrayBuffer) into a GPU buffer.
   * data_worker already computes SMA with full lookback history via Rust, so the
   * values are correct. This is a simple CPU→GPU memcpy via writeBuffer.
   *
   * Note: GPU Compute SMA is intentionally NOT used here because storageBuf only
   * contains the visible window (no lookback bars). The GPU compute shader would
   * produce incorrect SMA for the first (period-1) bars. When storageBuf is
   * extended with lookback history in a future optimization, this can be revisited.
   *
   * @param {number} viewLen    visible bar count
   * @param {number} smaByteOff byte offset in frameBuf (e.g. FBUF_SMA20_OFF)
   * @param {SharedArrayBuffer} frameBuf
   * @private
   */
  _uploadSmaToBuf(viewLen, smaByteOff, frameBuf) {
    if (!this.device) return;
    const device = this.device;
    const queue = device.queue;
    const needed = viewLen * 4;

    let entry = this.smaLineBufs.get(smaByteOff);
    if (!entry || entry.size < needed) {
      entry?.buf?.destroy();
      const buf = device.createBuffer({
        size:  needed,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      entry = { buf, size: needed };
      this.smaLineBufs.set(smaByteOff, entry);
    }

    // Single memcpy: frameBuf (SAB) → GPU buffer
    queue.writeBuffer(entry.buf, 0, new Float32Array(frameBuf, smaByteOff, viewLen));
  }

  /**
   * Compute Volume Profile on GPU into internal vpBuffer (u32 bins).
   * @param {number} viewLen
   * @param {number} numBins
   * @param {number} priceMin
   * @param {number} priceMax
   */
  computeVolumeProfileOnGpu(viewLen, numBins, priceMin, priceMax) {
    if (!this.device) return;
    const device = this.device;
    const queue = device.queue;
    // Allocate (numBins + 1) entries: bins[0..numBins-1] for histogram,
    // bins[numBins] for atomicMax global-max tracking in volume_profile.wgsl.
    const binCount = numBins + 1;
    const binBytes = binCount * 4;
    if (!this.vpBuffer || this.vpBuffer.size < binBytes) {
      this.vpBuffer?.destroy?.();
      // include COPY_DST so we can write zeros via queue.writeBuffer
      this.vpBuffer = device.createBuffer({ size: binBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    }
    // zero all bins (including the global-max slot)

    // Using writeBuffer with a cached empty buffer or just dynamic allocation? 
    // Usually clearBuffer is best: encoder.clearBuffer()
    // However, writeBuffer is fine, let's optimize the Uint32Array allocation
    if (!this._vpZeroBuf || this._vpZeroBuf.length < binCount) {
        this._vpZeroBuf = new Uint32Array(binCount);
    }
    // since _vpZeroBuf is cached and we only need zeros, slicing/subarray if it's bigger is needed
    queue.writeBuffer(this.vpBuffer, 0, this._vpZeroBuf.subarray(0, binCount));

    // params buffer: total_len, start_index, visible_count, num_bins, price_min(f32), price_max(f32)
    const pbuf = this._vpParamsBuf;
    const dv = new DataView(pbuf);
    dv.setUint32(0, viewLen, true);
    dv.setUint32(4, 0, true);
    dv.setUint32(8, viewLen, true);
    dv.setUint32(12, numBins, true);
    dv.setFloat32(16, priceMin, true);
    dv.setFloat32(20, priceMax, true);
    if (!this.vpParamsBuf) this.vpParamsBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    queue.writeBuffer(this.vpParamsBuf, 0, pbuf);
    if (!this.vpPipeline) this.vpPipeline = this._makeComputePipeline(this._vpWgsl);

    const encoder = device.createCommandEncoder();
    const bgl = this.vpPipeline.getBindGroupLayout(0);
    const bg = device.createBindGroup({ layout: bgl, entries: [
      { binding: 0, resource: { buffer: this.storageBuf } },
      { binding: 1, resource: { buffer: this.vpBuffer } },
      { binding: 2, resource: { buffer: this.vpParamsBuf } },
    ]});
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.vpPipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(viewLen / 64));
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  /** @param {string} wgsl @returns {GPURenderPipeline} */
  _makeRenderPipeline(wgsl) {
    const mod = this.device.createShaderModule({ code: wgsl });
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex:   { module: mod, entryPoint: 'vs_main' },
      fragment: {
        module:  mod,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /** Clean up all GPU resources. */
  destroy() {
    this.storageBuf?.destroy();
    this.mmBuf?.destroy();
    this.computeParamBuf?.destroy();
    this.candleUniBuf?.destroy();
    this.lineUniBuf?.destroy();
    this.arenaGpuBuf?.destroy();
    for (const buf of this._uniPool) buf.destroy();
    this._uniPool = [];
    for (const { buf } of this.smaLineBufs.values()) buf.destroy();
    this.smaLineBufs.clear();
    this.device = null;
  }
}
