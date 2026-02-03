var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// src/renderer/canvas/canvasRenderer.ts
class CanvasRenderer {
  canvas;
  ctx;
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("2D context not available");
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
  niceStep(range, targetTicks) {
    const raw = range / targetTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / pow;
    const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
    return nice * pow;
  }
  formatPrice(v) {
    const abs = Math.abs(v);
    const digits = abs < 1 ? 4 : abs < 10 ? 3 : abs < 100 ? 2 : 2;
    return v.toLocaleString(undefined, { maximumFractionDigits: digits });
  }
  drawSeries(seriesId, data, options) {
    if (!data || data.length === 0)
      return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gutterLeft = options?.yAxisGutterPx ?? 56;
    const gutterRight = 8;
    const gutterTop = 8;
    const xAxisHeight = options?.xAxisHeightPx ?? 26;
    const plotX = gutterLeft;
    const plotY = gutterTop;
    const plotW = w - gutterLeft - gutterRight;
    const plotH = h - gutterTop - xAxisHeight - 6;
    const defaultMaxVisible = options?.maxVisibleBars ?? 200;
    const visibleCount = Math.min(options?.visibleCount ?? defaultMaxVisible, data.length);
    let start = typeof options?.startIndex === "number" ? options.startIndex : Math.max(0, data.length - visibleCount);
    if (start < 0)
      start = 0;
    if (start + visibleCount > data.length)
      start = Math.max(0, data.length - visibleCount);
    const visible = data.slice(start, Math.min(data.length, start + visibleCount));
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const d of visible) {
      if (d.low < min)
        min = d.low;
      if (d.high > max)
        max = d.high;
    }
    if (!isFinite(min) || !isFinite(max))
      return;
    const padRatio = options?.paddingRatio ?? 0.05;
    const pad = (max - min) * padRatio;
    const yMin = min - Math.max(pad, options?.minPaddingPx ?? 6);
    const yMax = max + Math.max(pad, options?.minPaddingPx ?? 6);
    const priceToY = (p) => {
      const t = (p - yMin) / (yMax - yMin || 1);
      return plotY + (1 - t) * plotH;
    };
    this.ctx.fillStyle = options?.background ?? "#ffffff";
    this.ctx.fillRect(0, 0, w, h);
    const targetYTicks = options?.targetYTicks ?? 5;
    const step = this.niceStep(yMax - yMin, targetYTicks);
    const firstTick = Math.ceil(yMin / step) * step;
    const ticks = [];
    for (let v = firstTick;v <= yMax + 0.000000000001; v += step)
      ticks.push(v);
    this.ctx.font = options?.font ?? "12px sans-serif";
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = options?.axisLabelColor ?? "#222222";
    this.ctx.strokeStyle = options?.gridColor ?? "#e6e6e6";
    this.ctx.lineWidth = 1;
    for (const t of ticks) {
      const y = priceToY(t);
      this.ctx.beginPath();
      this.ctx.moveTo(plotX, y);
      this.ctx.lineTo(plotX + plotW, y);
      this.ctx.stroke();
      this.ctx.fillStyle = options?.axisLabelColor ?? "#222222";
      this.ctx.fillText(this.formatPrice(t), plotX - 8, y);
    }
    this.ctx.strokeStyle = options?.axisLabelColor ?? "#222222";
    this.ctx.beginPath();
    this.ctx.moveTo(plotX, plotY);
    this.ctx.lineTo(plotX, plotY + plotH);
    this.ctx.stroke();
    const targetXTicks = options?.targetXTicks ?? 6;
    const visibleFromTime = visible[0].time;
    const visibleToTime = visible[visible.length - 1].time;
    const spanMs = visibleToTime - visibleFromTime || 1;
    const xTicks = [];
    for (let i = 0;i < targetXTicks; i++) {
      const frac = i / (targetXTicks - 1);
      const idx = Math.round(frac * (visible.length - 1));
      xTicks.push({ time: visible[idx].time, idx: start + idx });
    }
    const stepX = plotW / Math.max(1, visible.length - 1);
    const candleW = Math.max(2, Math.min(Math.floor(stepX * 0.7), 40));
    const outlineColor = options?.outlineColor || "#222222";
    const wickColor = options?.wickColor || outlineColor;
    const upColor = options?.upColor || "#2e7d32";
    const downColor = options?.downColor || "#d32f2f";
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(plotX, plotY, plotW, plotH);
    this.ctx.clip();
    for (let i = 0;i < visible.length; i++) {
      const d = visible[i];
      const x = plotX + i * stepX;
      const yOpen = priceToY(d.open);
      const yClose = priceToY(d.close);
      const yHigh = priceToY(d.high);
      const yLow = priceToY(d.low);
      const top = Math.min(yOpen, yClose);
      const bottom = Math.max(yOpen, yClose);
      this.ctx.strokeStyle = wickColor;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 0.5, yHigh);
      this.ctx.lineTo(x + 0.5, yLow);
      this.ctx.stroke();
      if (d.close > d.open) {
        this.ctx.fillStyle = upColor;
        this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
        this.ctx.strokeStyle = outlineColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
      } else if (d.close < d.open) {
        this.ctx.fillStyle = downColor;
        this.ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
        this.ctx.strokeStyle = outlineColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - candleW / 2, top, candleW, Math.max(1, bottom - top));
      } else {
        const cy = (yOpen + yClose) / 2;
        const hx = candleW * 0.9;
        this.ctx.strokeStyle = outlineColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x - hx / 2, cy);
        this.ctx.lineTo(x + hx / 2, cy);
        this.ctx.moveTo(x, cy - hx / 2);
        this.ctx.lineTo(x, cy + hx / 2);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
    const dateFormat = (t) => {
      const dt = new Date(t);
      if (spanMs > 365 * 24 * 3600 * 1000)
        return dt.toLocaleDateString();
      if (spanMs > 7 * 24 * 3600 * 1000)
        return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };
    this.ctx.fillStyle = options?.axisLabelColor ?? "#222222";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "top";
    this.ctx.font = options?.font ?? "12px sans-serif";
    for (const t of xTicks) {
      const localIdx = t.idx - start;
      const x = plotX + localIdx * stepX;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 0.5, plotY + plotH);
      this.ctx.lineTo(x + 0.5, plotY + plotH + 6);
      this.ctx.stroke();
      this.ctx.fillText(dateFormat(t.time), x, plotY + plotH + 4 + 2);
    }
    this.ctx.strokeStyle = options?.axisLabelColor ?? "#222222";
    this.ctx.beginPath();
    this.ctx.moveTo(plotX, plotY + plotH);
    this.ctx.lineTo(plotX + plotW, plotY + plotH);
    this.ctx.stroke();
  }
  getLayout(data, options) {
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
    const visibleCount = Math.min(options?.visibleCount ?? defaultMaxVisible, data.length);
    let start = typeof options?.startIndex === "number" ? options.startIndex : Math.max(0, data.length - visibleCount);
    if (start < 0)
      start = 0;
    if (start + visibleCount > data.length)
      start = Math.max(0, data.length - visibleCount);
    const visible = data.slice(start, Math.min(data.length, start + visibleCount));
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const d of visible) {
      if (d.low < min)
        min = d.low;
      if (d.high > max)
        max = d.high;
    }
    const padRatio = options?.paddingRatio ?? 0.05;
    const pad = (max - min) * padRatio;
    const yMin = min - Math.max(pad, options?.minPaddingPx ?? 6);
    const yMax = max + Math.max(pad, options?.minPaddingPx ?? 6);
    const stepX = plotW / Math.max(1, visible.length - 1);
    const candleW = Math.max(2, Math.min(Math.floor(stepX * 0.7), 40));
    return { plotX, plotY, plotW, plotH, gutterLeft, gutterTop, xAxisHeight, startIndex: start, visibleCount: visible.length, stepX, candleW, yMin, yMax };
  }
  mapClientToData(clientX, clientY, data, options) {
    const layout = this.getLayout(data, options);
    const { plotX, plotY, plotW, plotH, startIndex, visibleCount, stepX, yMin, yMax } = layout;
    const localX = clientX - plotX;
    const localY = clientY - plotY;
    if (localX < -10 || localX > plotW + 10 || localY < -10 || localY > plotH + 10)
      return null;
    const idxFloat = localX / stepX;
    const idx = Math.round(idxFloat);
    const clamped = Math.max(0, Math.min(visibleCount - 1, idx));
    const dataIdx = startIndex + clamped;
    const point = data[dataIdx];
    if (!point)
      return null;
    const x = plotX + clamped * stepX;
    const priceAtY = yMin + (1 - localY / plotH) * (yMax - yMin || 0);
    return { index: dataIdx, localIndex: clamped, time: point.time, point, x, y: plotY + localY, priceAtY };
  }
  drawCrosshairAt(clientX, clientY, data, options) {
    const layout = this.getLayout(data, options);
    const { plotX, plotY, plotW, plotH, startIndex, visibleCount, stepX } = layout;
    const mapped = this.mapClientToData(clientX, clientY, data, options);
    if (!mapped)
      return;
    const x = mapped.x;
    const priceY = (() => {
      const { yMin, yMax } = layout;
      const p = mapped.point.close;
      const t = (p - yMin) / (yMax - yMin || 1);
      return plotY + (1 - t) * plotH;
    })();
    this.ctx.save();
    this.ctx.strokeStyle = options?.color ?? "#666666";
    this.ctx.lineWidth = options?.lineWidth ?? 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, plotY);
    this.ctx.lineTo(x + 0.5, plotY + plotH);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(plotX, priceY + 0.5);
    this.ctx.lineTo(plotX + plotW, priceY + 0.5);
    this.ctx.stroke();
    this.ctx.fillStyle = options?.color ?? "#666666";
    this.ctx.beginPath();
    this.ctx.arc(x, priceY, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }
  updateBuffers(_seriesId, _data, _offset) {}
  partialUpdateBuffers(_seriesId, _patches) {}
  destroy() {}
}

// src/renderer/webgl2/webgl2Renderer.ts
class WebGL2Renderer {
  gl;
  program;
  buffer;
  data = [];
  config = {};
  colors = DEFAULT_COLORS;
  aCoordinates = -1;
  uTranslation = null;
  uScale = null;
  uResolution = null;
  uColor = null;
  initialize(canvas) {
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 is not supported in this environment.");
    }
    this.gl = gl;
    this.program = this.createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.buffer = this.createBuffer(gl);
    this.aCoordinates = gl.getAttribLocation(this.program, "a_coordinates");
    this.uTranslation = gl.getUniformLocation(this.program, "u_translation");
    this.uScale = gl.getUniformLocation(this.program, "u_scale");
    this.uResolution = gl.getUniformLocation(this.program, "u_resolution");
    this.uColor = gl.getUniformLocation(this.program, "u_color");
    gl.useProgram(this.program);
  }
  setData(data) {
    this.data = data;
    this.uploadData();
  }
  setConfig(config) {
    this.config = config;
    this.colors = {
      ...DEFAULT_COLORS,
      ...config.colors ?? {}
    };
  }
  setIndicatorSegments(_segments) {}
  render() {
    const gl = this.gl;
    if (!gl || !this.program || !this.buffer)
      return;
    this.resize();
    gl.clearColor(...this.colors.background);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.aCoordinates);
    gl.vertexAttribPointer(this.aCoordinates, 3, gl.FLOAT, false, 0, 0);
    if (this.uScale)
      gl.uniform2fv(this.uScale, new Float32Array([0.23, 5]));
    if (this.uResolution)
      gl.uniform2fv(this.uResolution, new Float32Array([gl.drawingBufferWidth, gl.drawingBufferHeight]));
    const stride = 6;
    for (let c = 0;c < this.data.length; c++) {
      if (this.uTranslation)
        gl.uniform2fv(this.uTranslation, new Float32Array([(c + 1) * 25, 0]));
      if (this.uColor)
        gl.uniform4fv(this.uColor, new Float32Array(this.colors.wick));
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, c * stride + 4, 2);
      const isUp = this.data[c].open < this.data[c].close;
      if (this.uColor)
        gl.uniform4fv(this.uColor, new Float32Array(isUp ? this.colors.up : this.colors.down));
      gl.drawArrays(gl.TRIANGLE_FAN, c * stride, 4);
      if (this.uColor)
        gl.uniform4fv(this.uColor, new Float32Array(this.colors.outline));
      gl.drawArrays(gl.LINE_LOOP, c * stride, 4);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  resize() {
    const canvas = this.gl.canvas;
    if (canvas.clientWidth !== canvas.width)
      canvas.width = canvas.clientWidth;
    if (canvas.clientHeight !== canvas.height)
      canvas.height = canvas.clientHeight;
  }
  destroy() {
    const gl = this.gl;
    if (this.program)
      gl.deleteProgram(this.program);
    if (this.buffer)
      gl.deleteBuffer(this.buffer);
  }
  uploadData() {
    const gl = this.gl;
    const vertices = this.createVertices(this.data);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  createVertices(data) {
    return data.map((d) => [
      -19,
      d.open,
      0,
      21,
      d.open,
      0,
      21,
      d.close,
      0,
      -19,
      d.close,
      0,
      1,
      d.high,
      0,
      1,
      d.low,
      0
    ]).reduce((a, b) => a.concat(b), []);
  }
  createBuffer(gl) {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create WebGL buffer.");
    }
    return buffer;
  }
  createProgram(gl, vs, fs) {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vs);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram();
    if (!program)
      throw new Error("Failed to create WebGL program.");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${info ?? "unknown error"}`);
    }
    return program;
  }
  compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
      throw new Error("Failed to create shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${info ?? "unknown error"}`);
    }
    return shader;
  }
}
var DEFAULT_COLORS, VERTEX_SHADER = `#version 300 es
in vec3 a_coordinates;
uniform vec2 u_translation;
uniform vec2 u_scale;
uniform vec2 u_resolution;

void main() {
  vec2 pos = (a_coordinates.xy * u_scale + u_translation + vec2(0.5, 0.5)) / u_resolution;
  pos.x = pos.x - 1.0;
  gl_Position = vec4(pos, a_coordinates.z, 1.0);
}
`, FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}
`;
var init_webgl2Renderer = __esm(() => {
  DEFAULT_COLORS = {
    up: [0, 0.7, 0, 1],
    down: [1, 0, 0, 1],
    wick: [0, 0, 0, 1],
    outline: [0, 0, 0, 1],
    background: [1, 1, 1, 1]
  };
});

// src/renderer/webgpu/webgpuRenderer.ts
class WebGPURenderer {
  data = [];
  config = {};
  colors = DEFAULT_COLORS2;
  context = null;
  canvas = null;
  initPromise = null;
  pipeline = null;
  vertexBuffer = null;
  vertexCount = 0;
  linePipeline = null;
  indicatorBuffer = null;
  indicatorCount = 0;
  indicatorBufferSize = 0;
  vertexBufferSize = 0;
  initialize(canvas) {
    if (!("gpu" in navigator)) {
      throw new Error("WebGPU is not supported in this environment.");
    }
    this.canvas = canvas;
    this.initPromise = this.initWebGPU();
  }
  setData(data) {
    this.data = data;
    this.buildGeometry();
  }
  setConfig(config) {
    this.config = config;
    this.colors = {
      ...DEFAULT_COLORS2,
      ...config.colors ?? {}
    };
    this.buildGeometry();
  }
  setIndicatorSegments(segments) {
    if (!this.context)
      return;
    const { device } = this.context;
    this.indicatorCount = segments.length / 6;
    if (this.indicatorCount === 0) {
      this.indicatorBuffer = null;
      this.indicatorBufferSize = 0;
      return;
    }
    if (!this.indicatorBuffer || this.indicatorBufferSize !== segments.byteLength) {
      this.indicatorBuffer = device.createBuffer({
        size: segments.byteLength,
        usage: window.GPUBufferUsage.VERTEX | window.GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Float32Array(this.indicatorBuffer.getMappedRange()).set(segments);
      this.indicatorBuffer.unmap();
      this.indicatorBufferSize = segments.byteLength;
    } else if (device.queue.writeBuffer) {
      device.queue.writeBuffer(this.indicatorBuffer, 0, segments);
    }
  }
  render() {
    if (!this.context)
      return;
    const { device, context: gpuContext } = this.context;
    this.resize();
    if (!this.pipeline || !this.vertexBuffer || this.vertexCount === 0) {
      return;
    }
    const encoder = device.createCommandEncoder();
    const textureView = gpuContext.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: "clear",
          storeOp: "store",
          clearValue: {
            r: this.colors.background[0],
            g: this.colors.background[1],
            b: this.colors.background[2],
            a: this.colors.background[3]
          }
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.draw(this.vertexCount, 1, 0, 0);
    if (this.linePipeline && this.indicatorBuffer && this.indicatorCount > 0) {
      pass.setPipeline(this.linePipeline);
      pass.setVertexBuffer(0, this.indicatorBuffer);
      pass.draw(this.indicatorCount, 1, 0, 0);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  resize() {
    if (!this.context || !this.canvas)
      return;
    const { device, context: gpuContext, format } = this.context;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === width && this.canvas.height === height)
      return;
    this.canvas.width = width;
    this.canvas.height = height;
    gpuContext.configure({ device, format, alphaMode: "premultiplied" });
  }
  destroy() {
    this.context = null;
    this.canvas = null;
    this.pipeline = null;
    this.vertexBuffer = null;
    this.vertexCount = 0;
  }
  async initWebGPU() {
    if (!this.canvas)
      return;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU adapter not available.");
    }
    const device = await adapter.requestDevice();
    const context = this.canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Failed to acquire WebGPU canvas context.");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "premultiplied" });
    this.context = { adapter, device, context, format };
    this.pipeline = this.createPipeline(device, format);
    this.linePipeline = this.createLinePipeline(device, format);
    this.buildGeometry();
  }
  async computeIndicatorGPU(wgslSource, params, data, outputLength) {
    if (!this.context)
      return null;
    const { device } = this.context;
    const shader = device.createShaderModule({ code: wgslSource });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: shader, entryPoint: "main" }
    });
    const inputBuffer = device.createBuffer({
      size: data.byteLength,
      usage: window.GPUBufferUsage.STORAGE | window.GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(inputBuffer.getMappedRange()).set(data);
    inputBuffer.unmap();
    const uniformBuffer = device.createBuffer({
      size: params.byteLength,
      usage: window.GPUBufferUsage.UNIFORM | window.GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint8Array(uniformBuffer.getMappedRange()).set(new Uint8Array(params));
    uniformBuffer.unmap();
    const outputBuffer = device.createBuffer({
      size: outputLength * 4,
      usage: window.GPUBufferUsage.STORAGE | window.GPUBufferUsage.COPY_SRC
    });
    const readback = device.createBuffer({
      size: outputLength * 4,
      usage: window.GPUBufferUsage.MAP_READ | window.GPUBufferUsage.COPY_DST
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const workgroupSize = this.getWorkgroupSize(wgslSource);
    const dataLen = data.length / 6;
    const workgroupCount = Math.ceil(dataLen / workgroupSize);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readback, 0, outputLength * 4);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(window.GPUMapMode.READ);
    const result = readback.getMappedRange();
    const output = new Float32Array(result.slice(0));
    readback.unmap();
    return output;
  }
  createInputBuffer(data) {
    if (!this.context)
      return null;
    const { device } = this.context;
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: window.GPUBufferUsage.STORAGE | window.GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }
  updateInputBuffer(buffer, data) {
    if (!this.context || !buffer)
      return;
    const { device } = this.context;
    if (device.queue.writeBuffer) {
      device.queue.writeBuffer(buffer, 0, data);
    }
  }
  async computeIndicatorGPUWithInput(wgslSource, params, inputBuffer, outputLength, dataLen) {
    if (!this.context || !inputBuffer)
      return null;
    const { device } = this.context;
    const shader = device.createShaderModule({ code: wgslSource });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: shader, entryPoint: "main" }
    });
    const uniformBuffer = device.createBuffer({
      size: params.byteLength,
      usage: window.GPUBufferUsage.UNIFORM | window.GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint8Array(uniformBuffer.getMappedRange()).set(new Uint8Array(params));
    uniformBuffer.unmap();
    const outputBuffer = device.createBuffer({
      size: outputLength * 4,
      usage: window.GPUBufferUsage.STORAGE | window.GPUBufferUsage.COPY_SRC
    });
    const readback = device.createBuffer({
      size: outputLength * 4,
      usage: window.GPUBufferUsage.MAP_READ | window.GPUBufferUsage.COPY_DST
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const workgroupSize = this.getWorkgroupSize(wgslSource);
    const workgroupCount = Math.ceil(dataLen / workgroupSize);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readback, 0, outputLength * 4);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(window.GPUMapMode.READ);
    const result = readback.getMappedRange();
    const output = new Float32Array(result.slice(0));
    readback.unmap();
    return output;
  }
  getWorkgroupSize(wgslSource) {
    const match = wgslSource.match(/workgroup_size\((\d+)\)/);
    if (!match)
      return 256;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : 256;
  }
  createPipeline(device, format) {
    const shader = device.createShaderModule({
      code: `
        struct VSOut {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        };

        @vertex
        fn vs_main(@location(0) pos: vec2<f32>, @location(1) color: vec4<f32>) -> VSOut {
          var out: VSOut;
          out.position = vec4<f32>(pos, 0.0, 1.0);
          out.color = color;
          return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
          return color;
        }
      `
    });
    return device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x4" }
            ]
          }
        ]
      },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [{ format }]
      },
      primitive: { topology: "triangle-list" }
    });
  }
  createLinePipeline(device, format) {
    const shader = device.createShaderModule({
      code: `
        struct VSOut {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        };

        @vertex
        fn vs_main(@location(0) pos: vec2<f32>, @location(1) color: vec4<f32>) -> VSOut {
          var out: VSOut;
          out.position = vec4<f32>(pos, 0.0, 1.0);
          out.color = color;
          return out;
        }

        @fragment
        fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
          return color;
        }
      `
    });
    return device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x4" }
            ]
          }
        ]
      },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [{ format }]
      },
      primitive: { topology: "line-list" }
    });
  }
  buildGeometry() {
    if (!this.context || !this.data.length)
      return;
    const { device } = this.context;
    const count = this.data.length;
    const minPrice = Math.min(...this.data.map((d) => d.low));
    const maxPrice = Math.max(...this.data.map((d) => d.high));
    const range = maxPrice - minPrice || 1;
    const candleWidth = 2 / Math.max(1, count);
    const wickWidth = candleWidth * 0.2;
    const canvas = this.canvas;
    const aspectCorrection = canvas && canvas.width && canvas.height ? canvas.height / canvas.width : 1;
    const vertices = [];
    const colorUp = this.colors.up;
    const colorDown = this.colors.down;
    const colorWick = this.colors.wick;
    const toX = (i) => (-1 + candleWidth * i + candleWidth * 0.5) * aspectCorrection;
    const toY = (price) => (price - minPrice) / range * 2 - 1;
    for (let i = 0;i < count; i++) {
      const d = this.data[i];
      const x = toX(i);
      const bodyHalf = candleWidth * 0.4 * aspectCorrection;
      const wickHalf = wickWidth * 0.5 * aspectCorrection;
      const openY = toY(d.open);
      const closeY = toY(d.close);
      const highY = toY(d.high);
      const lowY = toY(d.low);
      const top = Math.max(openY, closeY);
      const bottom = Math.min(openY, closeY);
      const bodyColor = d.close >= d.open ? colorUp : colorDown;
      pushQuad(vertices, x - bodyHalf, bottom, x + bodyHalf, top, bodyColor);
      pushQuad(vertices, x - wickHalf, lowY, x + wickHalf, highY, colorWick);
    }
    const data = new Float32Array(vertices);
    this.vertexCount = data.length / 6;
    if (!this.vertexBuffer || this.vertexBufferSize !== data.byteLength) {
      this.vertexBuffer = device.createBuffer({
        size: data.byteLength,
        usage: window.GPUBufferUsage.VERTEX | window.GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Float32Array(this.vertexBuffer.getMappedRange()).set(data);
      this.vertexBuffer.unmap();
      this.vertexBufferSize = data.byteLength;
    } else if (device.queue.writeBuffer) {
      device.queue.writeBuffer(this.vertexBuffer, 0, data);
    }
  }
}
var DEFAULT_COLORS2, pushQuad = (out, x0, y0, x1, y1, color) => {
  out.push(x0, y0, ...color);
  out.push(x1, y0, ...color);
  out.push(x1, y1, ...color);
  out.push(x0, y0, ...color);
  out.push(x1, y1, ...color);
  out.push(x0, y1, ...color);
};
var init_webgpuRenderer = __esm(() => {
  DEFAULT_COLORS2 = {
    up: [0, 0.7, 0, 1],
    down: [1, 0, 0, 1],
    wick: [0, 0, 0, 1],
    outline: [0, 0, 0, 1],
    background: [1, 1, 1, 1]
  };
});

// src/core/indicators.ts
class InMemoryIndicatorRegistry {
  defs = new Map;
  register(definition) {
    this.defs.set(definition.id, definition);
  }
  get(id) {
    return this.defs.get(id);
  }
  listAll() {
    return Array.from(this.defs.values());
  }
  listByCategory(category) {
    return this.listAll().filter((def) => def.category === category);
  }
  listGPUEnabled() {
    return this.listAll().filter((def) => Boolean(def.calculateGPU || def.wgslSource));
  }
  resolveDependencies(ids) {
    const resolved = [];
    const visiting = new Set;
    const visited = new Set;
    const visit = (id) => {
      if (visited.has(id))
        return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected for indicator: ${id}`);
      }
      const def = this.get(id);
      if (!def) {
        throw new Error(`Indicator not found: ${id}`);
      }
      visiting.add(id);
      for (const dep of def.dependencies ?? []) {
        visit(dep);
      }
      visiting.delete(id);
      visited.add(id);
      resolved.push(def);
    };
    ids.forEach(visit);
    return resolved;
  }
}

// src/core/indicatorTypes.ts
var SCHEMA_VERSION = 2;

// src/indicators/phase1.ts
var ok = (value) => ({ ok: true, value }), fail = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
}), SMA, EMA, BollingerBands, Volume, PivotPoints, Phase1Indicators, registerPhase1Indicators = (registry) => {
  Phase1Indicators.forEach((indicator) => registry.register(indicator));
};
var init_phase1 = __esm(() => {
  SMA = {
    schemaVersion: SCHEMA_VERSION,
    id: "sma",
    name: "SMA",
    category: "trend",
    pane: "main",
    outputs: [{ name: "sma", color: "#4ECDC4", style: "line", lineWidth: 1, zLayer: 30 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period }) {
      try {
        const sma = [];
        let sum = 0;
        for (let i = 0;i < data.length; i++) {
          sum += data[i].close;
          if (i >= period)
            sum -= data[i - period].close;
          if (i < period - 1) {
            sma.push(null);
          } else {
            sma.push(sum / period);
          }
        }
        return ok({ sma });
      } catch (e) {
        return fail(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      if (idx < params.period - 1u) {
        output[idx] = bitcast<f32>(0x7FC00000u);
        return;
      }
      var sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        sum += ohlcv[close_idx];
      }
      output[idx] = sum / f32(params.period);
    }
  `
  };
  EMA = {
    schemaVersion: SCHEMA_VERSION,
    id: "ema",
    name: "EMA",
    category: "trend",
    pane: "main",
    outputs: [{ name: "ema", color: "#FFB703", style: "line", lineWidth: 1, zLayer: 30 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period }) {
      try {
        const ema = [];
        const k = 2 / (period + 1);
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            ema.push(data[i].close);
            continue;
          }
          const prev = ema[i - 1] ?? data[i - 1].close;
          ema.push(data[i].close * k + prev * (1 - k));
        }
        for (let i = 0;i < period - 1; i++) {
          ema[i] = null;
        }
        return ok({ ema });
      } catch (e) {
        return fail(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let n = params.data_len;
      if (n == 0u) { return; }
      let k = 2.0 / (f32(params.period) + 1.0);
      output[0u] = ohlcv[4u];
      for (var i: u32 = 1u; i < n; i++) {
        let close = ohlcv[i * 6u + 4u];
        output[i] = close * k + output[i - 1u] * (1.0 - k);
      }
      for (var i: u32 = 0u; i < params.period - 1u && i < n; i++) {
        output[i] = bitcast<f32>(0x7FC00000u);
      }
    }
  `
  };
  BollingerBands = {
    schemaVersion: SCHEMA_VERSION,
    id: "bb",
    name: "Bollinger Bands",
    category: "volatility",
    pane: "main",
    outputs: [
      { name: "upper", color: "#2196F3", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "middle", color: "#9E9E9E", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "lower", color: "#2196F3", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "fill", color: "rgba(33,150,243,0.1)", style: "band", fillTo: "lower", zLayer: 10 }
    ],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
      stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period, stdDev }) {
      try {
        const upper = [];
        const middle = [];
        const lower = [];
        for (let i = 0;i < data.length; i++) {
          if (i < period - 1) {
            upper.push(null);
            middle.push(null);
            lower.push(null);
            continue;
          }
          const slice = data.slice(i - period + 1, i + 1);
          const closes = slice.map((d) => d.close);
          const sma = closes.reduce((a, b) => a + b, 0) / period;
          const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
          const std = Math.sqrt(variance);
          middle.push(sma);
          upper.push(sma + stdDev * std);
          lower.push(sma - stdDev * std);
        }
        return ok({ upper, middle, lower, fill: upper });
      } catch (e) {
        return fail(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, std_dev: f32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      if (idx < params.period - 1u) {
        output[idx * 3u + 0u] = bitcast<f32>(0x7FC00000u);
        output[idx * 3u + 1u] = bitcast<f32>(0x7FC00000u);
        output[idx * 3u + 2u] = bitcast<f32>(0x7FC00000u);
        return;
      }
      var sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        sum += ohlcv[close_idx];
      }
      let sma = sum / f32(params.period);
      var var_sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        let diff = ohlcv[close_idx] - sma;
        var_sum += diff * diff;
      }
      let std = sqrt(var_sum / f32(params.period));
      output[idx * 3u + 0u] = sma + params.std_dev * std;
      output[idx * 3u + 1u] = sma;
      output[idx * 3u + 2u] = sma - params.std_dev * std;
    }
  `
  };
  Volume = {
    schemaVersion: SCHEMA_VERSION,
    id: "volume",
    name: "Volume",
    category: "volume",
    pane: "sub1",
    outputs: [
      { name: "volume", color: "#90CAF9", style: "bar", opacity: 0.8, zLayer: 20 },
      { name: "volumeMA", color: "#1565C0", style: "line", lineWidth: 1, zLayer: 30 }
    ],
    params: {
      maPeriod: { type: "number", default: 20, label: "MA Period", min: 5, max: 50 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ maPeriod }) => maPeriod - 1,
    calculate(data, { maPeriod }) {
      try {
        const volume = data.map((d) => d.volume);
        const volumeMA = [];
        for (let i = 0;i < data.length; i++) {
          if (i < maPeriod - 1) {
            volumeMA.push(null);
          } else {
            const slice = data.slice(i - maPeriod + 1, i + 1);
            const avg = slice.reduce((a, b) => a + b.volume, 0) / maPeriod;
            volumeMA.push(avg);
          }
        }
        return ok({ volume, volumeMA });
      } catch (e) {
        return fail(String(e));
      }
    }
  };
  PivotPoints = {
    schemaVersion: SCHEMA_VERSION,
    id: "pivot_points",
    name: "Pivot Points",
    category: "trend",
    pane: "main",
    outputs: [
      { name: "pivot", color: "#607D8B", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "r1", color: "#8BC34A", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "s1", color: "#F44336", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "r2", color: "#4CAF50", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "s2", color: "#E57373", style: "line", lineWidth: 1, zLayer: 30 }
    ],
    params: {},
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: () => 1,
    calculate(data) {
      try {
        const pivot = [];
        const r1 = [];
        const s1 = [];
        const r2 = [];
        const s2 = [];
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            pivot.push(null);
            r1.push(null);
            s1.push(null);
            r2.push(null);
            s2.push(null);
            continue;
          }
          const prev = data[i - 1];
          const p = (prev.high + prev.low + prev.close) / 3;
          const r1v = 2 * p - prev.low;
          const s1v = 2 * p - prev.high;
          const r2v = p + (prev.high - prev.low);
          const s2v = p - (prev.high - prev.low);
          pivot.push(p);
          r1.push(r1v);
          s1.push(s1v);
          r2.push(r2v);
          s2.push(s2v);
        }
        return ok({ pivot, r1, s1, r2, s2 });
      } catch (e) {
        return fail(String(e));
      }
    }
  };
  Phase1Indicators = [Volume, SMA, EMA, BollingerBands, PivotPoints];
});

// src/indicators/phase2.ts
var ok2 = (value) => ({ ok: true, value }), fail2 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
}), RSI, ATR, MACD, ADX, TradeMarkers, Phase2Indicators, registerPhase2Indicators = (registry) => {
  Phase2Indicators.forEach((indicator) => registry.register(indicator));
};
var init_phase2 = __esm(() => {
  RSI = {
    schemaVersion: SCHEMA_VERSION,
    id: "rsi",
    name: "RSI",
    category: "momentum",
    pane: "sub1",
    outputs: [{ name: "rsi", color: "#9C27B0", style: "line", lineWidth: 1.5, zLayer: 30 }],
    params: {
      period: { type: "number", default: 14, label: "Period", min: 2, max: 50 }
    },
    yRange: { min: 0, max: 100 },
    horizontalLines: [
      { value: 70, color: "#F44336", dashed: true },
      { value: 30, color: "#4CAF50", dashed: true },
      { value: 50, color: "#9E9E9E", dashed: true }
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    warmupPeriod: ({ period }) => period,
    calculate(data, { period }) {
      try {
        const rsi = [];
        let avgGain = 0;
        let avgLoss = 0;
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            rsi.push(null);
            continue;
          }
          const change = data[i].close - data[i - 1].close;
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
        return ok2({ rsi });
      } catch (e) {
        return fail2(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      var avg_gain: f32 = 0.0;
      var avg_loss: f32 = 0.0;
      if (n <= period + 1u) { return; }
      for (var i: u32 = 1u; i <= period; i++) {
        let change = ohlcv[i * 6u + 4u] - ohlcv[(i - 1u) * 6u + 4u];
        if (change > 0.0) { avg_gain += change; }
        else { avg_loss -= change; }
      }
      avg_gain /= f32(period);
      avg_loss /= f32(period);
      for (var i: u32 = 0u; i < period; i++) {
        output[i] = bitcast<f32>(0x7FC00000u);
      }
      let rs0 = select(avg_gain / avg_loss, 100.0, avg_loss == 0.0);
      output[period] = 100.0 - 100.0 / (1.0 + rs0);
      for (var i: u32 = period + 1u; i < n; i++) {
        let change = ohlcv[i * 6u + 4u] - ohlcv[(i - 1u) * 6u + 4u];
        let gain = max(change, 0.0);
        let loss = max(-change, 0.0);
        avg_gain = (avg_gain * f32(period - 1u) + gain) / f32(period);
        avg_loss = (avg_loss * f32(period - 1u) + loss) / f32(period);
        let rs = select(avg_gain / avg_loss, 100.0, avg_loss == 0.0);
        output[i] = 100.0 - 100.0 / (1.0 + rs);
      }
    }
  `
  };
  ATR = {
    schemaVersion: SCHEMA_VERSION,
    id: "atr",
    name: "ATR",
    category: "volatility",
    pane: "sub1",
    outputs: [{ name: "atr", color: "#795548", style: "line", lineWidth: 1.5, zLayer: 30 }],
    params: {
      period: { type: "number", default: 14, label: "Period", min: 5, max: 50 }
    },
    complexity: { time: "O(n)", space: "O(1)" },
    warmupPeriod: ({ period }) => period,
    calculate(data, { period }) {
      try {
        const atr = [];
        let atrSum = 0;
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            atr.push(null);
            continue;
          }
          const tr = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close));
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
        return ok2({ atr });
      } catch (e) {
        return fail2(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      if (n == 0u) { return; }
      output[0u] = bitcast<f32>(0x7FC00000u);
      var atr_sum: f32 = 0.0;
      for (var i: u32 = 1u; i < n; i++) {
        let high = ohlcv[i * 6u + 2u];
        let low = ohlcv[i * 6u + 3u];
        let prev_close = ohlcv[(i - 1u) * 6u + 4u];
        let tr = max(high - low, max(abs(high - prev_close), abs(low - prev_close)));
        if (i < period) {
          atr_sum += tr;
          output[i] = bitcast<f32>(0x7FC00000u);
        } else if (i == period) {
          atr_sum += tr;
          output[i] = atr_sum / f32(period);
        } else {
          let prev_atr = output[i - 1u];
          output[i] = (prev_atr * f32(period - 1u) + tr) / f32(period);
        }
      }
    }
  `
  };
  MACD = {
    schemaVersion: SCHEMA_VERSION,
    id: "macd",
    name: "MACD",
    category: "momentum",
    pane: "sub2",
    dependencies: ["ema"],
    outputs: [
      { name: "macd", color: "#2196F3", style: "line", lineWidth: 1.5, zLayer: 30 },
      { name: "signal", color: "#FF9800", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "histogram", color: "#4CAF50", style: "histogram", opacity: 0.7, zLayer: 20 }
    ],
    params: {
      fastPeriod: { type: "number", default: 12, label: "Fast Period", min: 2, max: 50 },
      slowPeriod: { type: "number", default: 26, label: "Slow Period", min: 5, max: 100 },
      signalPeriod: { type: "number", default: 9, label: "Signal Period", min: 2, max: 50 }
    },
    horizontalLines: [{ value: 0, color: "#9E9E9E", dashed: false }],
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ slowPeriod, signalPeriod }) => slowPeriod + signalPeriod - 1,
    calculate(data, { fastPeriod, slowPeriod, signalPeriod }) {
      try {
        const ema = (values, period) => {
          const result = [];
          const k = 2 / (period + 1);
          for (let i = 0;i < values.length; i++) {
            if (i === 0)
              result.push(values[i]);
            else
              result.push(values[i] * k + result[i - 1] * (1 - k));
          }
          return result;
        };
        const closes = data.map((d) => d.close);
        const fastEma = ema(closes, fastPeriod);
        const slowEma = ema(closes, slowPeriod);
        const macdLine = fastEma.map((f, i) => f - slowEma[i]);
        const signalLine = ema(macdLine, signalPeriod);
        const histogram = macdLine.map((m, i) => m - signalLine[i]);
        const warmup = slowPeriod + signalPeriod - 1;
        return ok2({
          macd: macdLine.map((v, i) => i < warmup ? null : v),
          signal: signalLine.map((v, i) => i < warmup ? null : v),
          histogram: histogram.map((v, i) => i < warmup ? null : v)
        });
      } catch (e) {
        return fail2(String(e));
      }
    },
    wgslSource: `
    struct Params { fast: u32, slow: u32, signal: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>; // macd, signal, hist packed
    @compute @workgroup_size(1)
    fn main() {
      let n = params.data_len;
      if (n == 0u) { return; }
      let k_fast = 2.0 / (f32(params.fast) + 1.0);
      let k_slow = 2.0 / (f32(params.slow) + 1.0);
      let k_sig = 2.0 / (f32(params.signal) + 1.0);
      var ema_fast: f32 = ohlcv[4u];
      var ema_slow: f32 = ohlcv[4u];
      var sig: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        let close = ohlcv[i * 6u + 4u];
        if (i > 0u) {
          ema_fast = close * k_fast + ema_fast * (1.0 - k_fast);
          ema_slow = close * k_slow + ema_slow * (1.0 - k_slow);
        }
        let macd = ema_fast - ema_slow;
        if (i == 0u) {
          sig = macd;
        } else {
          sig = macd * k_sig + sig * (1.0 - k_sig);
        }
        let hist = macd - sig;
        output[i * 3u + 0u] = macd;
        output[i * 3u + 1u] = sig;
        output[i * 3u + 2u] = hist;
      }
      let warmup = params.slow + params.signal - 1u;
      for (var i: u32 = 0u; i < warmup && i < n; i++) {
        output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
        output[i * 3u + 1u] = bitcast<f32>(0x7FC00000u);
        output[i * 3u + 2u] = bitcast<f32>(0x7FC00000u);
      }
    }
  `
  };
  ADX = {
    schemaVersion: SCHEMA_VERSION,
    id: "adx",
    name: "ADX",
    category: "trend",
    pane: "sub1",
    outputs: [
      { name: "adx", color: "#FF5722", style: "line", lineWidth: 2, zLayer: 30 },
      { name: "plusDI", color: "#4CAF50", style: "line", lineWidth: 1, zLayer: 30 },
      { name: "minusDI", color: "#F44336", style: "line", lineWidth: 1, zLayer: 30 }
    ],
    params: {
      period: { type: "number", default: 14, label: "Period", min: 5, max: 50 }
    },
    yRange: { min: 0, max: 100 },
    horizontalLines: [
      { value: 25, color: "#9E9E9E", dashed: true },
      { value: 50, color: "#FF9800", dashed: true }
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period * 2 - 1,
    calculate(data, { period }) {
      try {
        const adx = [];
        const plusDI = [];
        const minusDI = [];
        const tr = [];
        const plusDM = [];
        const minusDM = [];
        for (let i = 0;i < data.length; i++) {
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
          const trValue = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
          tr.push(trValue);
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
          let smoothTR = 0;
          let smoothPlusDM = 0;
          let smoothMinusDM = 0;
          if (i === period) {
            for (let j = 1;j <= period; j++) {
              smoothTR += tr[j];
              smoothPlusDM += plusDM[j];
              smoothMinusDM += minusDM[j];
            }
          } else {
            const prevSmoothTR = tr.slice(i - period, i).reduce((a, b) => a + b, 0);
            smoothTR = prevSmoothTR - prevSmoothTR / period + tr[i];
            const prevSmoothPlusDM = plusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
            smoothPlusDM = prevSmoothPlusDM - prevSmoothPlusDM / period + plusDM[i];
            const prevSmoothMinusDM = minusDM.slice(i - period, i).reduce((a, b) => a + b, 0);
            smoothMinusDM = prevSmoothMinusDM - prevSmoothMinusDM / period + minusDM[i];
          }
          const pdi = smoothTR > 0 ? 100 * smoothPlusDM / smoothTR : 0;
          const mdi = smoothTR > 0 ? 100 * smoothMinusDM / smoothTR : 0;
          plusDI.push(pdi);
          minusDI.push(mdi);
          const diSum = pdi + mdi;
          const dx = diSum > 0 ? 100 * Math.abs(pdi - mdi) / diSum : 0;
          if (i < period * 2 - 1) {
            adx.push(null);
          } else if (i === period * 2 - 1) {
            let dxSum = 0;
            for (let j = period;j < period * 2; j++) {
              const pdiJ = plusDI[j] ?? 0;
              const mdiJ = minusDI[j] ?? 0;
              const sumJ = pdiJ + mdiJ;
              dxSum += sumJ > 0 ? 100 * Math.abs(pdiJ - mdiJ) / sumJ : 0;
            }
            adx.push(dxSum / period);
          } else {
            const prevADX = adx[i - 1] ?? 0;
            adx.push((prevADX * (period - 1) + dx) / period);
          }
        }
        return ok2({ adx, plusDI, minusDI });
      } catch (e) {
        return fail2(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>; // adx, plusDI, minusDI packed
    @compute @workgroup_size(1)
    fn main() {
      let n = params.data_len;
      if (n == 0u) { return; }
      var smooth_tr: f32 = 0.0;
      var smooth_plus: f32 = 0.0;
      var smooth_minus: f32 = 0.0;
      var prev_adx: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        if (i == 0u) {
          output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 1u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 2u] = bitcast<f32>(0x7FC00000u);
          continue;
        }
        let high = ohlcv[i * 6u + 2u];
        let low = ohlcv[i * 6u + 3u];
        let prev_high = ohlcv[(i - 1u) * 6u + 2u];
        let prev_low = ohlcv[(i - 1u) * 6u + 3u];
        let prev_close = ohlcv[(i - 1u) * 6u + 4u];
        let tr = max(high - low, max(abs(high - prev_close), abs(low - prev_close)));
        let up_move = high - prev_high;
        let down_move = prev_low - low;
        let plus_dm = select(up_move, 0.0, up_move > down_move && up_move > 0.0);
        let minus_dm = select(down_move, 0.0, down_move > up_move && down_move > 0.0);
        if (i <= params.period) {
          smooth_tr += tr;
          smooth_plus += plus_dm;
          smooth_minus += minus_dm;
          output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 1u] = bitcast<f32>(0x7FC00000u);
          output[i * 3u + 2u] = bitcast<f32>(0x7FC00000u);
          continue;
        }
        smooth_tr = smooth_tr - (smooth_tr / f32(params.period)) + tr;
        smooth_plus = smooth_plus - (smooth_plus / f32(params.period)) + plus_dm;
        smooth_minus = smooth_minus - (smooth_minus / f32(params.period)) + minus_dm;
        let pdi = select((100.0 * smooth_plus) / smooth_tr, 0.0, smooth_tr == 0.0);
        let mdi = select((100.0 * smooth_minus) / smooth_tr, 0.0, smooth_tr == 0.0);
        let di_sum = pdi + mdi;
        let dx = select((100.0 * abs(pdi - mdi)) / di_sum, 0.0, di_sum == 0.0);
        if (i < params.period * 2u - 1u) {
          output[i * 3u + 0u] = bitcast<f32>(0x7FC00000u);
        } else if (i == params.period * 2u - 1u) {
          prev_adx = dx;
          output[i * 3u + 0u] = prev_adx;
        } else {
          prev_adx = (prev_adx * f32(params.period - 1u) + dx) / f32(params.period);
          output[i * 3u + 0u] = prev_adx;
        }
        output[i * 3u + 1u] = pdi;
        output[i * 3u + 2u] = mdi;
      }
    }
  `
  };
  TradeMarkers = {
    schemaVersion: SCHEMA_VERSION,
    id: "trade_markers",
    name: "Trade Markers",
    category: "custom",
    pane: "main",
    outputs: [{ name: "markers", color: "#FFC107", style: "marker", zLayer: 40 }],
    params: {},
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: () => 0,
    calculate() {
      return ok2({ markers: [] });
    }
  };
  Phase2Indicators = [RSI, ADX, ATR, MACD, TradeMarkers];
});

// src/indicators/phase3.ts
var ok3 = (value) => ({ ok: true, value }), fail3 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
}), VWAP, VolRatio, PercentB, BBWidth, Phase3Indicators, registerPhase3Indicators = (registry) => {
  Phase3Indicators.forEach((indicator) => registry.register(indicator));
};
var init_phase3 = __esm(() => {
  VWAP = {
    schemaVersion: SCHEMA_VERSION,
    id: "vwap",
    name: "VWAP",
    category: "volume",
    pane: "main",
    outputs: [{ name: "vwap", color: "#6D4C41", style: "line", lineWidth: 1.5, zLayer: 30 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period }) {
      try {
        const vwap = [];
        let pvSum = 0;
        let vSum = 0;
        for (let i = 0;i < data.length; i++) {
          const typical = (data[i].high + data[i].low + data[i].close) / 3;
          pvSum += typical * data[i].volume;
          vSum += data[i].volume;
          if (i >= period) {
            const prev = data[i - period];
            const prevTypical = (prev.high + prev.low + prev.close) / 3;
            pvSum -= prevTypical * prev.volume;
            vSum -= prev.volume;
          }
          if (i < period - 1 || vSum === 0) {
            vwap.push(null);
          } else {
            vwap.push(pvSum / vSum);
          }
        }
        return ok3({ vwap });
      } catch (e) {
        return fail3(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      var pv_sum: f32 = 0.0;
      var v_sum: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        let high = ohlcv[i * 6u + 2u];
        let low = ohlcv[i * 6u + 3u];
        let close = ohlcv[i * 6u + 4u];
        let volume = ohlcv[i * 6u + 5u];
        let typical = (high + low + close) / 3.0;
        pv_sum += typical * volume;
        v_sum += volume;
        if (i >= period) {
          let j = i - period;
          let h = ohlcv[j * 6u + 2u];
          let l = ohlcv[j * 6u + 3u];
          let c = ohlcv[j * 6u + 4u];
          let v = ohlcv[j * 6u + 5u];
          let t = (h + l + c) / 3.0;
          pv_sum -= t * v;
          v_sum -= v;
        }
        if (i < period - 1u || v_sum == 0.0) {
          output[i] = bitcast<f32>(0x7FC00000u);
        } else {
          output[i] = pv_sum / v_sum;
        }
      }
    }
  `
  };
  VolRatio = {
    schemaVersion: SCHEMA_VERSION,
    id: "vol_ratio",
    name: "Vol Ratio",
    category: "volume",
    pane: "sub1",
    outputs: [{ name: "volRatio", color: "#00897B", style: "line", lineWidth: 1.2, zLayer: 30 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 2, max: 200 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period }) {
      try {
        const volRatio = [];
        let sum = 0;
        for (let i = 0;i < data.length; i++) {
          sum += data[i].volume;
          if (i >= period)
            sum -= data[i - period].volume;
          if (i < period - 1) {
            volRatio.push(null);
          } else {
            const avg = sum / period;
            volRatio.push(avg === 0 ? 0 : data[i].volume / avg);
          }
        }
        return ok3({ volRatio });
      } catch (e) {
        return fail3(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(1)
    fn main() {
      let period = params.period;
      let n = params.data_len;
      var sum: f32 = 0.0;
      for (var i: u32 = 0u; i < n; i++) {
        let vol = ohlcv[i * 6u + 5u];
        sum += vol;
        if (i >= period) {
          sum -= ohlcv[(i - period) * 6u + 5u];
        }
        if (i < period - 1u) {
          output[i] = bitcast<f32>(0x7FC00000u);
        } else {
          let avg = sum / f32(period);
          output[i] = select(vol / avg, 0.0, avg == 0.0);
        }
      }
    }
  `
  };
  PercentB = {
    schemaVersion: SCHEMA_VERSION,
    id: "percent_b",
    name: "%B",
    category: "volatility",
    pane: "sub1",
    outputs: [{ name: "percentB", color: "#673AB7", style: "line", lineWidth: 1.3, zLayer: 30 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
      stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period, stdDev }) {
      try {
        const percentB = [];
        for (let i = 0;i < data.length; i++) {
          if (i < period - 1) {
            percentB.push(null);
            continue;
          }
          const slice = data.slice(i - period + 1, i + 1);
          const closes = slice.map((d) => d.close);
          const sma = closes.reduce((a, b) => a + b, 0) / period;
          const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
          const std = Math.sqrt(variance);
          const upper = sma + stdDev * std;
          const lower = sma - stdDev * std;
          const bandwidth = upper - lower;
          percentB.push(bandwidth > 0 ? (data[i].close - lower) / bandwidth : 0.5);
        }
        return ok3({ percentB });
      } catch (e) {
        return fail3(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, std_dev: f32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      if (idx < params.period - 1u) {
        output[idx] = bitcast<f32>(0x7FC00000u);
        return;
      }
      var sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        sum += ohlcv[close_idx];
      }
      let sma = sum / f32(params.period);
      var var_sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        let diff = ohlcv[close_idx] - sma;
        var_sum += diff * diff;
      }
      let std = sqrt(var_sum / f32(params.period));
      let upper = sma + params.std_dev * std;
      let lower = sma - params.std_dev * std;
      let width = upper - lower;
      let close = ohlcv[idx * 6u + 4u];
      output[idx] = select((close - lower) / width, 0.5, width == 0.0);
    }
  `
  };
  BBWidth = {
    schemaVersion: SCHEMA_VERSION,
    id: "bb_width",
    name: "BB Width",
    category: "volatility",
    pane: "sub1",
    outputs: [{ name: "width", color: "#00BCD4", style: "area", opacity: 0.5, fillTo: 0, zLayer: 20 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
      stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period, stdDev }) {
      try {
        const width = [];
        for (let i = 0;i < data.length; i++) {
          if (i < period - 1) {
            width.push(null);
            continue;
          }
          const slice = data.slice(i - period + 1, i + 1);
          const closes = slice.map((d) => d.close);
          const sma = closes.reduce((a, b) => a + b, 0) / period;
          const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
          const std = Math.sqrt(variance);
          const upper = sma + stdDev * std;
          const lower = sma - stdDev * std;
          width.push(sma > 0 ? (upper - lower) / sma : 0);
        }
        return ok3({ width });
      } catch (e) {
        return fail3(String(e));
      }
    },
    wgslSource: `
    struct Params { period: u32, std_dev: f32, data_len: u32 };
    @group(0) @binding(0) var<storage, read> ohlcv: array<f32>;
    @group(0) @binding(1) var<uniform> params: Params;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;
    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= params.data_len) { return; }
      if (idx < params.period - 1u) {
        output[idx] = bitcast<f32>(0x7FC00000u);
        return;
      }
      var sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        sum += ohlcv[close_idx];
      }
      let sma = sum / f32(params.period);
      var var_sum: f32 = 0.0;
      for (var j: u32 = 0u; j < params.period; j++) {
        let close_idx = (idx - params.period + 1u + j) * 6u + 4u;
        let diff = ohlcv[close_idx] - sma;
        var_sum += diff * diff;
      }
      let std = sqrt(var_sum / f32(params.period));
      let upper = sma + params.std_dev * std;
      let lower = sma - params.std_dev * std;
      output[idx] = select((upper - lower) / sma, 0.0, sma == 0.0);
    }
  `
  };
  Phase3Indicators = [VWAP, VolRatio, PercentB, BBWidth];
});

// src/indicators/phase4.ts
var ok4 = (value) => ({ ok: true, value }), fail4 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
}), OBV, CMF, MFI, KaufmanPatterns, SqueezeAlert, Divergence, Phase4Indicators, registerPhase4Indicators = (registry) => {
  Phase4Indicators.forEach((indicator) => registry.register(indicator));
};
var init_phase4 = __esm(() => {
  OBV = {
    schemaVersion: SCHEMA_VERSION,
    id: "obv",
    name: "OBV",
    category: "volume",
    pane: "sub1",
    outputs: [{ name: "obv", color: "#3F51B5", style: "line", lineWidth: 1.2, zLayer: 30 }],
    params: {},
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: () => 1,
    calculate(data) {
      try {
        const obv = [];
        let current = 0;
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            obv.push(null);
            continue;
          }
          if (data[i].close > data[i - 1].close) {
            current += data[i].volume;
          } else if (data[i].close < data[i - 1].close) {
            current -= data[i].volume;
          }
          obv.push(current);
        }
        return ok4({ obv });
      } catch (e) {
        return fail4(String(e));
      }
    }
  };
  CMF = {
    schemaVersion: SCHEMA_VERSION,
    id: "cmf",
    name: "CMF",
    category: "volume",
    pane: "sub1",
    outputs: [{ name: "cmf", color: "#8BC34A", style: "line", lineWidth: 1.2, zLayer: 30 }],
    params: {
      period: { type: "number", default: 21, label: "Period", min: 2, max: 200 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period }) {
      try {
        const cmf = [];
        let sumMFV = 0;
        let sumVol = 0;
        for (let i = 0;i < data.length; i++) {
          const high = data[i].high;
          const low = data[i].low;
          const close = data[i].close;
          const volume = data[i].volume;
          const range = high - low;
          const mfm = range === 0 ? 0 : (close - low - (high - close)) / range;
          const mfv = mfm * volume;
          sumMFV += mfv;
          sumVol += volume;
          if (i >= period) {
            const prev = data[i - period];
            const prevRange = prev.high - prev.low;
            const prevMfm = prevRange === 0 ? 0 : (prev.close - prev.low - (prev.high - prev.close)) / prevRange;
            sumMFV -= prevMfm * prev.volume;
            sumVol -= prev.volume;
          }
          if (i < period - 1 || sumVol === 0) {
            cmf.push(null);
          } else {
            cmf.push(sumMFV / sumVol);
          }
        }
        return ok4({ cmf });
      } catch (e) {
        return fail4(String(e));
      }
    }
  };
  MFI = {
    schemaVersion: SCHEMA_VERSION,
    id: "mfi",
    name: "MFI",
    category: "volume",
    pane: "sub1",
    outputs: [{ name: "mfi", color: "#FF7043", style: "line", lineWidth: 1.2, zLayer: 30 }],
    params: {
      period: { type: "number", default: 14, label: "Period", min: 2, max: 200 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period,
    calculate(data, { period }) {
      try {
        const mfi = [];
        let posSum = 0;
        let negSum = 0;
        const typicalPrices = data.map((d) => (d.high + d.low + d.close) / 3);
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            mfi.push(null);
            continue;
          }
          const tp = typicalPrices[i];
          const prevTp = typicalPrices[i - 1];
          const mf = tp * data[i].volume;
          if (tp > prevTp)
            posSum += mf;
          else if (tp < prevTp)
            negSum += mf;
          if (i >= period) {
            const oldTp = typicalPrices[i - period];
            const oldPrevTp = typicalPrices[i - period - 1];
            const oldMf = oldTp * data[i - period].volume;
            if (oldTp > oldPrevTp)
              posSum -= oldMf;
            else if (oldTp < oldPrevTp)
              negSum -= oldMf;
          }
          if (i < period) {
            mfi.push(null);
          } else {
            const ratio = negSum === 0 ? 100 : posSum / negSum;
            mfi.push(100 - 100 / (1 + ratio));
          }
        }
        return ok4({ mfi });
      } catch (e) {
        return fail4(String(e));
      }
    }
  };
  KaufmanPatterns = {
    schemaVersion: SCHEMA_VERSION,
    id: "kaufman_patterns",
    name: "Kaufman Patterns",
    category: "custom",
    pane: "main",
    outputs: [{ name: "kaufman", color: "#FFC107", style: "marker", zLayer: 40 }],
    params: {},
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: () => 2,
    calculate() {
      return ok4({ kaufman: [] });
    }
  };
  SqueezeAlert = {
    schemaVersion: SCHEMA_VERSION,
    id: "squeeze_alert",
    name: "Squeeze Alert",
    category: "volatility",
    pane: "main",
    outputs: [{ name: "squeeze", color: "#FF9800", style: "marker", zLayer: 40 }],
    params: {
      period: { type: "number", default: 20, label: "Period", min: 5, max: 100 },
      stdDev: { type: "number", default: 2, label: "Std Dev", min: 0.5, max: 4, step: 0.1 },
      threshold: { type: "number", default: 0.04, label: "Threshold", min: 0.01, max: 0.2, step: 0.01 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period - 1,
    calculate(data, { period, stdDev, threshold }) {
      try {
        const squeeze = [];
        for (let i = 0;i < data.length; i++) {
          if (i < period - 1) {
            squeeze.push(null);
            continue;
          }
          const slice = data.slice(i - period + 1, i + 1);
          const closes = slice.map((d) => d.close);
          const sma = closes.reduce((a, b) => a + b, 0) / period;
          const variance = closes.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
          const std = Math.sqrt(variance);
          const upper = sma + stdDev * std;
          const lower = sma - stdDev * std;
          const width = sma > 0 ? (upper - lower) / sma : 0;
          squeeze.push(width < threshold ? data[i].close : null);
        }
        return ok4({ squeeze });
      } catch (e) {
        return fail4(String(e));
      }
    }
  };
  Divergence = {
    schemaVersion: SCHEMA_VERSION,
    id: "divergence",
    name: "Divergence",
    category: "custom",
    pane: "main",
    outputs: [{ name: "divergence", color: "#FFC107", style: "marker", zLayer: 40 }],
    params: {
      period: { type: "number", default: 14, label: "Period", min: 2, max: 50 }
    },
    complexity: { time: "O(n)", space: "O(n)" },
    warmupPeriod: ({ period }) => period,
    calculate(data, { period }) {
      try {
        const rsi = [];
        let avgGain = 0;
        let avgLoss = 0;
        for (let i = 0;i < data.length; i++) {
          if (i === 0) {
            rsi.push(NaN);
            continue;
          }
          const change = data[i].close - data[i - 1].close;
          const gain = change > 0 ? change : 0;
          const loss = change < 0 ? -change : 0;
          if (i < period) {
            avgGain += gain / period;
            avgLoss += loss / period;
            rsi.push(NaN);
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
        const divergence = [];
        for (let i = 0;i < data.length; i++) {
          if (i < period + 2) {
            divergence.push(null);
            continue;
          }
          const prev = i - 2;
          const priceHigher = data[i].close > data[prev].close;
          const rsiLower = rsi[i] < rsi[prev];
          divergence.push(priceHigher && rsiLower ? data[i].close : null);
        }
        return ok4({ divergence });
      } catch (e) {
        return fail4(String(e));
      }
    }
  };
  Phase4Indicators = [OBV, CMF, MFI, KaufmanPatterns, SqueezeAlert, Divergence];
});

// src/core/tradeMarkers.ts
var DEFAULT_MARKER_STYLES;
var init_tradeMarkers = __esm(() => {
  DEFAULT_MARKER_STYLES = {
    entry_long: { shape: "triangle_up", color: "#4CAF50", size: 10 },
    entry_short: { shape: "triangle_down", color: "#F44336", size: 10 },
    exit_long: { shape: "triangle_up", color: "#81C784", borderColor: "#4CAF50", size: 8 },
    exit_short: { shape: "triangle_down", color: "#E57373", borderColor: "#F44336", size: 8 },
    stop_loss: { shape: "cross", color: "#F44336", size: 10 },
    take_profit: { shape: "circle", color: "#4CAF50", size: 8 },
    signal: { shape: "diamond", color: "#FFC107", size: 8 },
    alert: { shape: "warning", color: "#FF9800", size: 10 }
  };
});

// src/core/chart.ts
var exports_chart = {};
__export(exports_chart, {
  MoChart: () => MoChart,
  ChartCore: () => ChartCore
});

class ChartCore {
  container;
  options;
  seriesStore = new Map;
  viewportStartIndex = 0;
  viewportVisibleCount = 200;
  listeners = new Map;
  constructor(container, options) {
    if (!container)
      throw new Error("Container element required");
    this.container = container;
    this.options = options ?? {};
    try {
      const canvas = this.container.tagName.toLowerCase() === "canvas" ? this.container : this.container.querySelector("canvas") ?? this.createCanvas();
      this._renderer = new CanvasRenderer(canvas);
    } catch (e) {
      console.warn("CanvasRenderer init failed", e);
    }
  }
  on(event, cb) {
    const set = this.listeners.get(event) ?? new Set;
    set.add(cb);
    this.listeners.set(event, set);
  }
  off(event, cb) {
    if (!this.listeners.has(event))
      return;
    if (!cb) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.get(event).delete(cb);
  }
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set)
      return;
    for (const cb of Array.from(set))
      cb(payload);
  }
  async connectFeed(adapter) {
    if (!adapter)
      throw new Error("Adapter required");
    if (typeof adapter.subscribe !== "function") {
      console.warn("Adapter does not implement subscribe/unsubscribe — storing adapter only");
      this._adapter = adapter;
      return;
    }
    this._adapter = adapter;
    for (const seriesId of this.seriesStore.keys()) {
      try {
        adapter.subscribe(seriesId, (point) => this.pushRealtime(seriesId, point));
      } catch (e) {
        console.warn("subscribe failed for", seriesId, e);
      }
    }
    this.emit("realtimeConnected");
  }
  async disconnectFeed() {
    const adapter = this._adapter;
    if (adapter && typeof adapter.unsubscribe === "function") {
      for (const seriesId of this.seriesStore.keys()) {
        try {
          adapter.unsubscribe(seriesId);
        } catch {}
      }
    }
    delete this._adapter;
    this.emit("realtimeDisconnected");
  }
  async addSeries(options) {
    const id = options.id ?? `series_${Math.random().toString(36).slice(2, 9)}`;
    if (this.seriesStore.has(id))
      throw new Error(`Series ${id} already exists`);
    this.seriesStore.set(id, { options, data: [] });
    this.emit("seriesAdded", { id, options });
    return id;
  }
  async setSeriesData(seriesId, data, partial = false) {
    const entry = this.seriesStore.get(seriesId);
    if (!entry)
      throw new Error(`Series ${seriesId} not found`);
    if (partial) {
      entry.data.splice(entry.data.length - data.length, data.length, ...data);
    } else {
      entry.data = data.slice();
    }
    this.seriesStore.set(seriesId, entry);
    this.emit("seriesUpdated", { seriesId, length: entry.data.length });
    const renderer = this._renderer;
    if (renderer && typeof renderer.drawSeries === "function") {
      try {
        renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount }));
      } catch (e) {
        console.warn(e);
      }
    }
  }
  getDataLength() {
    let max = 0;
    for (const v of this.seriesStore.values()) {
      if (v.data && v.data.length > max)
        max = v.data.length;
    }
    return max;
  }
  createCanvas() {
    const c = document.createElement("canvas");
    const w = (this.options.width ?? this.container.clientWidth) || 800;
    const h = (this.options.height ?? this.container.clientHeight) || 600;
    c.style.width = w + "px";
    c.style.height = h + "px";
    this.container.appendChild(c);
    return c;
  }
  async updateSeries(seriesId, patch) {
    const entry = this.seriesStore.get(seriesId);
    if (!entry)
      throw new Error(`Series ${seriesId} not found`);
    for (const p of patch) {
      if (p.index < 0 || p.index >= entry.data.length)
        continue;
      entry.data[p.index] = p.point;
    }
    this.emit("seriesUpdated", { seriesId, patch });
  }
  async pushRealtime(seriesId, point) {
    const entry = this.seriesStore.get(seriesId);
    if (!entry)
      throw new Error(`Series ${seriesId} not found`);
    const last = entry.data[entry.data.length - 1];
    if (!last || last.time !== point.time) {
      entry.data.push(point);
    } else {
      entry.data[entry.data.length - 1] = point;
    }
    this.emit("realtime", { seriesId, point });
    this.emit("seriesUpdated", { seriesId, realtime: true });
  }
  getVisibleRange() {
    const len = this.getDataLength();
    if (len === 0)
      return null;
    const from = Math.max(0, Math.min(len - 1, this.viewportStartIndex));
    const to = Math.max(0, Math.min(len - 1, this.viewportStartIndex + this.viewportVisibleCount - 1));
    return { from, to };
  }
  setVisibleRange(from, to) {
    const len = this.getDataLength();
    if (len === 0)
      return;
    const f = Math.max(0, Math.min(len - 1, from));
    const t = Math.max(0, Math.min(len - 1, to));
    this.viewportStartIndex = Math.min(f, t);
    this.viewportVisibleCount = Math.max(1, t - f + 1);
    this.emit("rangeChanged", { from: this.viewportStartIndex, to: this.viewportStartIndex + this.viewportVisibleCount - 1 });
    const renderer = this._renderer;
    if (renderer && typeof renderer.drawSeries === "function") {
      for (const [seriesId, entry] of this.seriesStore.entries()) {
        try {
          renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount }));
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }
  setViewport(fromIndex, toIndex) {
    this.setVisibleRange(fromIndex, toIndex);
  }
  panBy(deltaIndex) {
    const len = this.getDataLength();
    if (len === 0)
      return;
    const maxStart = Math.max(0, len - this.viewportVisibleCount);
    this.viewportStartIndex = Math.max(0, Math.min(maxStart, this.viewportStartIndex + deltaIndex));
    this.emit("rangeChanged", { from: this.viewportStartIndex, to: this.viewportStartIndex + this.viewportVisibleCount - 1 });
    const renderer = this._renderer;
    if (renderer && typeof renderer.drawSeries === "function") {
      for (const [seriesId, entry] of this.seriesStore.entries()) {
        try {
          renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount }));
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }
  zoomAt(factor, centerIndex) {
    const len = this.getDataLength();
    if (len === 0)
      return;
    const minVisible = 5;
    let newCount = Math.max(minVisible, Math.min(len, Math.round(this.viewportVisibleCount * factor)));
    const center = typeof centerIndex === "number" ? centerIndex : Math.min(len - 1, this.viewportStartIndex + Math.floor(this.viewportVisibleCount / 2));
    const rel = (center - this.viewportStartIndex) / Math.max(1, this.viewportVisibleCount - 1);
    let newStart = center - Math.round(rel * (newCount - 1));
    newStart = Math.max(0, Math.min(len - newCount, newStart));
    this.viewportStartIndex = newStart;
    this.viewportVisibleCount = newCount;
    this.emit("rangeChanged", { from: this.viewportStartIndex, to: this.viewportStartIndex + this.viewportVisibleCount - 1 });
    const renderer = this._renderer;
    if (renderer && typeof renderer.drawSeries === "function") {
      for (const [seriesId, entry] of this.seriesStore.entries()) {
        try {
          renderer.drawSeries(seriesId, entry.data, Object.assign({}, entry.options, { startIndex: this.viewportStartIndex, visibleCount: this.viewportVisibleCount }));
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }
  applyOptions(options) {
    Object.assign(this.options, options);
    this.emit("optionsChanged", this.options);
  }
  resize() {
    this.emit("resize");
  }
  async destroy() {
    await this.disconnectFeed();
    this.seriesStore.clear();
    this.listeners.clear();
  }
}

class MoChart {
  renderer;
  data;
  config;
  rafId = null;
  registry = new InMemoryIndicatorRegistry;
  indicatorInstances = [];
  tradeMarkers = [];
  alertCallbacks = [];
  lastAlertAt = new Map;
  constructor(canvas, options) {
    this.data = options.data;
    this.config = options.config ?? {};
    this.indicatorInstances = this.config.indicators ?? [];
    this.tradeMarkers = this.config.tradeMarkers ?? [];
    registerPhase1Indicators(this.registry);
    registerPhase2Indicators(this.registry);
    registerPhase3Indicators(this.registry);
    registerPhase4Indicators(this.registry);
    this.renderer = "gpu" in navigator ? new WebGPURenderer : new WebGL2Renderer;
    this.renderer.initialize(canvas);
    this.renderer.setConfig(this.config);
    this.renderer.setData(this.data);
    this.rebuildIndicatorSegments();
    this.start();
  }
  start() {
    const tick = () => {
      this.renderer.render();
      this.rafId = requestAnimationFrame(tick);
    };
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(tick);
    }
  }
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  setData(data) {
    this.data = data;
    this.renderer.setData(data);
    this.rebuildIndicatorSegments();
  }
  setConfig(config) {
    this.config = config;
    this.indicatorInstances = config.indicators ?? [];
    this.tradeMarkers = config.tradeMarkers ?? [];
    this.renderer.setConfig(config);
    this.rebuildIndicatorSegments();
  }
  registerIndicator(definition) {
    this.registry.register(definition);
  }
  addIndicator(id, params) {
    const instanceId = `ind_${crypto.randomUUID()}`;
    this.indicatorInstances = [
      ...this.indicatorInstances,
      { id, instanceId, params, enabled: true }
    ];
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
    return instanceId;
  }
  removeIndicator(instanceId) {
    this.indicatorInstances = this.indicatorInstances.filter((ind) => ind.instanceId !== instanceId);
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
  }
  updateParams(instanceId, params) {
    this.indicatorInstances = this.indicatorInstances.map((ind) => ind.instanceId === instanceId ? { ...ind, params } : ind);
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
  }
  toggleVisibility(instanceId) {
    this.indicatorInstances = this.indicatorInstances.map((ind) => ind.instanceId === instanceId ? { ...ind, enabled: !ind.enabled } : ind);
    this.setConfig({ ...this.config, indicators: this.indicatorInstances });
  }
  getActiveIndicators() {
    return this.indicatorInstances;
  }
  addTradeMarkers(markers) {
    this.tradeMarkers = [...this.tradeMarkers, ...markers];
    this.setConfig({ ...this.config, tradeMarkers: this.tradeMarkers });
  }
  clearTradeMarkers() {
    this.tradeMarkers = [];
    this.setConfig({ ...this.config, tradeMarkers: [] });
  }
  onAlert(callback) {
    this.alertCallbacks.push(callback);
    return () => {
      this.alertCallbacks = this.alertCallbacks.filter((cb) => cb !== callback);
    };
  }
  rebuildIndicatorSegments() {
    const segments = this.computeIndicatorSegments();
    this.renderer.setIndicatorSegments(segments);
    this.rebuildIndicatorSegmentsGPU();
  }
  async rebuildIndicatorSegmentsGPU() {
    if (!(this.renderer instanceof WebGPURenderer))
      return;
    const segments = await this.computeIndicatorSegmentsGPU(this.renderer);
    if (segments.length) {
      this.renderer.setIndicatorSegments(segments);
    }
  }
  computeIndicatorSegments() {
    if (!this.data.length || this.indicatorInstances.length === 0) {
      return new Float32Array;
    }
    const count = this.data.length;
    const step = 2 / Math.max(1, count - 1);
    const toX = (i) => -1 + step * i;
    const mainRange = {
      min: Math.min(...this.data.map((d) => d.low)),
      max: Math.max(...this.data.map((d) => d.high))
    };
    const subRanges = {
      sub1: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub2: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub3: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
    };
    const paneLayout = {
      main: { top: 0, height: 0.6 },
      sub1: { top: 0.6, height: 0.15 },
      sub2: { top: 0.75, height: 0.15 },
      sub3: { top: 0.9, height: 0.1 }
    };
    const updateRange = (pane, value) => {
      const range = subRanges[pane];
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    };
    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false)
        continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane === "main")
        continue;
      const params = instance.params ?? {};
      const result = def.calculate(this.data, params);
      if (!result.ok)
        continue;
      for (const output of def.outputs) {
        const series = result.value[output.name];
        if (!series)
          continue;
        for (const value of series) {
          if (value == null)
            continue;
          updateRange(def.pane, value);
        }
      }
    }
    const normalizeRange = (pane) => {
      const range = subRanges[pane];
      if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
        range.min = 0;
        range.max = 1;
      }
      if (range.min === range.max) {
        range.min -= 1;
        range.max += 1;
      }
    };
    normalizeRange("sub1");
    normalizeRange("sub2");
    normalizeRange("sub3");
    const toPaneY = (pane, value) => {
      const layout = paneLayout[pane];
      const topNdc = 1 - 2 * layout.top;
      const bottomNdc = 1 - 2 * (layout.top + layout.height);
      let min = mainRange.min;
      let max = mainRange.max;
      if (pane !== "main") {
        min = subRanges[pane].min;
        max = subRanges[pane].max;
      }
      const ratio = (value - min) / (max - min);
      return bottomNdc + (topNdc - bottomNdc) * ratio;
    };
    const vertices = [];
    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false)
        continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane !== "main")
        continue;
      const params = instance.params ?? {};
      const result = def.calculate(this.data, params);
      if (!result.ok)
        continue;
      for (const output of def.outputs) {
        if (output.style !== "line")
          continue;
        const series = result.value[output.name];
        if (!series)
          continue;
        const color = this.parseColor(output.color);
        for (let i = 1;i < series.length; i++) {
          const prev = series[i - 1];
          const cur = series[i];
          if (prev == null || cur == null)
            continue;
          const x0 = toX(i - 1);
          const y0 = toPaneY("main", prev);
          const x1 = toX(i);
          const y1 = toPaneY("main", cur);
          vertices.push(x0, y0, ...color);
          vertices.push(x1, y1, ...color);
        }
      }
      this.evaluateAlerts(def, result.value, this.data[this.data.length - 1]);
    }
    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false)
        continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane === "main")
        continue;
      const params = instance.params ?? {};
      const result = def.calculate(this.data, params);
      if (!result.ok)
        continue;
      for (const output of def.outputs) {
        const series = result.value[output.name];
        if (!series)
          continue;
        const color = this.parseColor(output.color);
        if (output.style === "line") {
          for (let i = 1;i < series.length; i++) {
            const prev = series[i - 1];
            const cur = series[i];
            if (prev == null || cur == null)
              continue;
            const x0 = toX(i - 1);
            const y0 = toPaneY(def.pane, prev);
            const x1 = toX(i);
            const y1 = toPaneY(def.pane, cur);
            vertices.push(x0, y0, ...color);
            vertices.push(x1, y1, ...color);
          }
        } else if (output.style === "histogram" || output.style === "bar") {
          const baseY = toPaneY(def.pane, 0);
          for (let i = 0;i < series.length; i++) {
            const value = series[i];
            if (value == null)
              continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            vertices.push(x, baseY, ...color);
            vertices.push(x, y, ...color);
          }
        }
        if (output.style === "marker") {
          for (let i = 0;i < series.length; i++) {
            const value = series[i];
            if (value == null)
              continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            this.pushMarkerShape(vertices, x, y, 0.01, "diamond", color);
          }
        }
      }
    }
    if (this.tradeMarkers.length) {
      const markerSize = 0.01;
      for (const marker of this.tradeMarkers) {
        const index = this.findNearestIndex(marker.time);
        if (index < 0)
          continue;
        const x = toX(index);
        const y = toPaneY("main", marker.price);
        const style = DEFAULT_MARKER_STYLES[marker.type];
        const color = this.parseColor(style.color);
        const size = (marker.size ?? style.size) * markerSize;
        this.pushMarkerShape(vertices, x, y, size, style.shape, color);
      }
    }
    return new Float32Array(vertices);
  }
  async computeIndicatorSegmentsGPU(renderer) {
    if (!this.data.length || this.indicatorInstances.length === 0) {
      return new Float32Array;
    }
    const count = this.data.length;
    const step = 2 / Math.max(1, count - 1);
    const toX = (i) => -1 + step * i;
    const mainRange = {
      min: Math.min(...this.data.map((d) => d.low)),
      max: Math.max(...this.data.map((d) => d.high))
    };
    const subRanges = {
      sub1: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub2: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      sub3: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
    };
    const paneLayout = {
      main: { top: 0, height: 0.6 },
      sub1: { top: 0.6, height: 0.15 },
      sub2: { top: 0.75, height: 0.15 },
      sub3: { top: 0.9, height: 0.1 }
    };
    const updateRange = (pane, value) => {
      const range = subRanges[pane];
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    };
    const dataBuffer = new Float32Array(this.data.length * 6);
    this.data.forEach((bar, i) => {
      const offset = i * 6;
      dataBuffer[offset + 0] = bar.time;
      dataBuffer[offset + 1] = bar.open;
      dataBuffer[offset + 2] = bar.high;
      dataBuffer[offset + 3] = bar.low;
      dataBuffer[offset + 4] = bar.close;
      dataBuffer[offset + 5] = bar.volume;
    });
    const computeOutputs = new Map;
    const inputBuffer = renderer.createInputBuffer(dataBuffer);
    const orderedInstances = this.orderInstancesByDependencies();
    for (const instance of orderedInstances) {
      if (instance.enabled === false)
        continue;
      const def = this.registry.get(instance.id);
      if (!def || !def.wgslSource)
        continue;
      const params = instance.params ?? {};
      const seriesCount = def.outputs.length;
      const paramBuffer = this.buildUniformParams(def.id, params, this.data.length);
      const output = await renderer.computeIndicatorGPUWithInput(def.wgslSource, paramBuffer, inputBuffer, this.data.length * seriesCount, this.data.length);
      if (!output)
        continue;
      const seriesMap = {};
      for (let s = 0;s < seriesCount; s++) {
        const name = def.outputs[s].name;
        seriesMap[name] = [];
      }
      for (let i = 0;i < this.data.length; i++) {
        for (let s = 0;s < seriesCount; s++) {
          const value = output[i * seriesCount + s];
          seriesMap[def.outputs[s].name].push(Number.isNaN(value) ? null : value);
        }
      }
      computeOutputs.set(instance.instanceId, seriesMap);
    }
    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false)
        continue;
      const def = this.registry.get(instance.id);
      if (!def || def.pane === "main")
        continue;
      const series = computeOutputs.get(instance.instanceId);
      if (!series)
        continue;
      for (const output of def.outputs) {
        const values = series[output.name];
        if (!values)
          continue;
        for (const value of values) {
          if (value == null)
            continue;
          updateRange(def.pane, value);
        }
      }
    }
    const normalizeRange = (pane) => {
      const range = subRanges[pane];
      if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
        range.min = 0;
        range.max = 1;
      }
      if (range.min === range.max) {
        range.min -= 1;
        range.max += 1;
      }
    };
    normalizeRange("sub1");
    normalizeRange("sub2");
    normalizeRange("sub3");
    const toPaneY = (pane, value) => {
      const layout = paneLayout[pane];
      const topNdc = 1 - 2 * layout.top;
      const bottomNdc = 1 - 2 * (layout.top + layout.height);
      let min = mainRange.min;
      let max = mainRange.max;
      if (pane !== "main") {
        min = subRanges[pane].min;
        max = subRanges[pane].max;
      }
      const ratio = (value - min) / (max - min);
      return bottomNdc + (topNdc - bottomNdc) * ratio;
    };
    const vertices = [];
    for (const instance of this.indicatorInstances) {
      if (instance.enabled === false)
        continue;
      const def = this.registry.get(instance.id);
      if (!def)
        continue;
      const series = computeOutputs.get(instance.instanceId);
      if (!series)
        continue;
      for (const output of def.outputs) {
        const values = series[output.name];
        if (!values)
          continue;
        const color = this.parseColor(output.color);
        if (output.style === "line") {
          for (let i = 1;i < values.length; i++) {
            const prev = values[i - 1];
            const cur = values[i];
            if (prev == null || cur == null)
              continue;
            const x0 = toX(i - 1);
            const y0 = toPaneY(def.pane, prev);
            const x1 = toX(i);
            const y1 = toPaneY(def.pane, cur);
            vertices.push(x0, y0, ...color);
            vertices.push(x1, y1, ...color);
          }
        } else if (output.style === "histogram" || output.style === "bar") {
          const baseY = toPaneY(def.pane, 0);
          for (let i = 0;i < values.length; i++) {
            const value = values[i];
            if (value == null)
              continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            vertices.push(x, baseY, ...color);
            vertices.push(x, y, ...color);
          }
        }
        if (output.style === "marker") {
          for (let i = 0;i < values.length; i++) {
            const value = values[i];
            if (value == null)
              continue;
            const x = toX(i);
            const y = toPaneY(def.pane, value);
            this.pushMarkerShape(vertices, x, y, 0.01, "diamond", color);
          }
        }
      }
      this.evaluateAlerts(def, series, this.data[this.data.length - 1]);
    }
    return new Float32Array(vertices);
  }
  orderInstancesByDependencies() {
    const ids = Array.from(new Set(this.indicatorInstances.map((ind) => ind.id)));
    let orderedIds = [];
    try {
      orderedIds = this.registry.resolveDependencies(ids).map((def) => def.id);
    } catch {
      orderedIds = ids;
    }
    const orderMap = new Map;
    orderedIds.forEach((id, index) => orderMap.set(id, index));
    return [...this.indicatorInstances].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  }
  buildUniformParams(id, params, dataLen) {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    const setU32 = (offset, value) => view.setUint32(offset, value, true);
    const setF32 = (offset, value) => view.setFloat32(offset, value, true);
    switch (id) {
      case "bb":
      case "percent_b":
      case "bb_width":
        setU32(0, params.period ?? 20);
        setF32(4, params.stdDev ?? 2);
        setU32(8, dataLen);
        return buffer;
      case "macd":
        setU32(0, params.fastPeriod ?? 12);
        setU32(4, params.slowPeriod ?? 26);
        setU32(8, params.signalPeriod ?? 9);
        setU32(12, dataLen);
        return buffer;
      case "adx":
      case "atr":
      case "rsi":
      case "sma":
      case "ema":
      case "vwap":
      case "vol_ratio":
      default:
        setU32(0, params.period ?? 14);
        setU32(4, dataLen);
        return buffer;
    }
  }
  parseColor(color) {
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      const val = parseInt(hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex, 16);
      const r = (val >> 16 & 255) / 255;
      const g = (val >> 8 & 255) / 255;
      const b = (val & 255) / 255;
      return [r, g, b, 1];
    }
    const rgba = color.match(/rgba?\(([^)]+)\)/i);
    if (rgba) {
      const parts = rgba[1].split(",").map((p) => parseFloat(p.trim()));
      const [r, g, b, a = 1] = parts;
      return [r / 255, g / 255, b / 255, a];
    }
    return [1, 1, 1, 1];
  }
  evaluateAlerts(def, series, bar) {
    if (!def.alerts || def.alerts.length === 0)
      return;
    const lastIndex = this.data.length - 1;
    const values = {};
    const prevValues = {};
    for (const output of def.outputs) {
      const outputSeries = series[output.name];
      if (!outputSeries)
        continue;
      values[output.name] = outputSeries[lastIndex] ?? null;
      prevValues[output.name] = outputSeries[lastIndex - 1] ?? null;
    }
    for (const alert of def.alerts) {
      const key = `${def.id}:${alert.id}`;
      const lastAt = this.lastAlertAt.get(key) ?? 0;
      const now = Date.now();
      if (alert.cooldown && now - lastAt < alert.cooldown * 1000)
        continue;
      if (alert.condition(values, bar, prevValues)) {
        const message = alert.message(values, bar);
        this.lastAlertAt.set(key, now);
        this.alertCallbacks.forEach((cb) => cb({ indicatorId: def.id, alertId: alert.id, message }));
      }
    }
  }
  findNearestIndex(time) {
    let best = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0;i < this.data.length; i++) {
      const diff = Math.abs(this.data[i].time - time);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }
  pushMarkerShape(out, x, y, size, shape, color) {
    const line = (x0, y0, x1, y1) => {
      out.push(x0, y0, ...color);
      out.push(x1, y1, ...color);
    };
    switch (shape) {
      case "triangle_up": {
        const top = [x, y + size];
        const left = [x - size, y - size];
        const right = [x + size, y - size];
        line(top[0], top[1], left[0], left[1]);
        line(left[0], left[1], right[0], right[1]);
        line(right[0], right[1], top[0], top[1]);
        break;
      }
      case "triangle_down": {
        const bottom = [x, y - size];
        const left = [x - size, y + size];
        const right = [x + size, y + size];
        line(bottom[0], bottom[1], left[0], left[1]);
        line(left[0], left[1], right[0], right[1]);
        line(right[0], right[1], bottom[0], bottom[1]);
        break;
      }
      case "diamond": {
        const top = [x, y + size];
        const right = [x + size, y];
        const bottom = [x, y - size];
        const left = [x - size, y];
        line(top[0], top[1], right[0], right[1]);
        line(right[0], right[1], bottom[0], bottom[1]);
        line(bottom[0], bottom[1], left[0], left[1]);
        line(left[0], left[1], top[0], top[1]);
        break;
      }
      case "circle": {
        const segments = 12;
        for (let i = 0;i < segments; i++) {
          const a0 = i / segments * Math.PI * 2;
          const a1 = (i + 1) / segments * Math.PI * 2;
          const x0 = x + Math.cos(a0) * size;
          const y0 = y + Math.sin(a0) * size;
          const x1 = x + Math.cos(a1) * size;
          const y1 = y + Math.sin(a1) * size;
          line(x0, y0, x1, y1);
        }
        break;
      }
      case "warning": {
        const top = [x, y + size];
        const left = [x - size, y - size];
        const right = [x + size, y - size];
        line(top[0], top[1], left[0], left[1]);
        line(left[0], left[1], right[0], right[1]);
        line(right[0], right[1], top[0], top[1]);
        line(x, y - size * 0.2, x, y + size * 0.4);
        line(x, y - size * 0.6, x, y - size * 0.55);
        break;
      }
      case "cross":
      default: {
        line(x - size, y, x + size, y);
        line(x, y - size, x, y + size);
      }
    }
  }
  destroy() {
    this.stop();
    this.renderer.destroy();
  }
}
var init_chart = __esm(() => {
  init_webgl2Renderer();
  init_webgpuRenderer();
  init_phase1();
  init_phase2();
  init_phase3();
  init_phase4();
  init_tradeMarkers();
});

// src/core/embedApi.ts
var exports_embedApi = {};
__export(exports_embedApi, {
  createEmbedAPI: () => createEmbedAPI
});
function createEmbedAPI() {

  class ChartEmbed {
    core = null;
    container = null;
    handlers = new Map;
    tooltipEl = null;
    legendEl = null;
    pointerId = null;
    dragging = false;
    dragStartX = 0;
    dragStartIndex = 0;
    opts = {};
    _pinchStartDist = null;
    _pinchStartCenterClientX = null;
    _pinchStartCenterIndex = undefined;
    async create(container, options) {
      const mod = await Promise.resolve().then(() => (init_chart(), exports_chart));
      this.container = container;
      this.opts = options ?? {};
      this.core = new mod.ChartCore(container, options);
      this.core.on("rangeChanged", (p) => this.emit("rangeChanged", p));
      this.core.on("seriesUpdated", (p) => this.emit("seriesUpdated", p));
      if (this.opts.attachEvents !== false)
        this.attachEvents();
      if (this.opts.enableTooltip)
        this.enableTooltip(true);
      if (this.opts.showLegend)
        this._ensureLegend();
      return this.core;
    }
    getCanvas() {
      if (!this.container)
        return null;
      if (this.container.tagName.toLowerCase() === "canvas")
        return this.container;
      const c = this.container.querySelector("canvas");
      return c;
    }
    attachEvents() {
      const canvas = this.getCanvas();
      if (!canvas || !this.core)
        return;
      const renderer = this.core._renderer;
      if (!renderer)
        return;
      const onPointerDown = (ev) => {
        canvas.setPointerCapture(ev.pointerId);
        this.pointerId = ev.pointerId;
        this.dragging = true;
        this.dragStartX = ev.clientX;
        const vr = this.core.getVisibleRange();
        this.dragStartIndex = vr ? vr.from : 0;
      };
      const onPointerMove = (ev) => {
        if (!this.core)
          return;
        if (this.dragging) {
          const seriesStore = this.core.seriesStore;
          const primaryEntry = seriesStore ? Array.from(seriesStore.values())[0] : null;
          const primaryData = primaryEntry?.data ?? [];
          const layout = renderer.getLayout ? renderer.getLayout(primaryData, this.opts) : null;
          const stepX = layout ? layout.stepX : 10;
          const dx = ev.clientX - this.dragStartX;
          const deltaIndex = Math.round(-dx / stepX);
          this.core.panBy(deltaIndex + (this.dragStartIndex - (this.core.getVisibleRange()?.from ?? 0)));
          return;
        }
        if (this.tooltipEl && this.opts.enableTooltip) {
          const rect = canvas.getBoundingClientRect();
          const mx = ev.clientX - rect.left;
          const my = ev.clientY - rect.top;
          const seriesStore = this.core.seriesStore;
          const primaryEntry = seriesStore ? Array.from(seriesStore.values())[0] : null;
          const data = primaryEntry?.data ?? [];
          const mapped = renderer.mapClientToData(mx, my, data, this.opts);
          if (!mapped) {
            this.tooltipEl.style.display = "none";
            return;
          }
          const layout = renderer.getLayout ? renderer.getLayout(data, this.opts) : null;
          const candleW = layout ? layout.candleW : layout ? layout.candleW : 10;
          const dx = Math.abs(mx - mapped.x);
          const horizHit = dx <= candleW / 2 + 4;
          let vertHit = true;
          if (layout && typeof layout.yMin === "number" && typeof layout.yMax === "number") {
            const { plotY, plotH, yMin, yMax } = layout;
            const priceToY = (p2) => {
              const t = (p2 - yMin) / (yMax - yMin || 1);
              return plotY + (1 - t) * plotH;
            };
            const yOpen = priceToY(mapped.point.open);
            const yClose = priceToY(mapped.point.close);
            const yHigh = priceToY(mapped.point.high);
            const yLow = priceToY(mapped.point.low);
            const top2 = Math.min(yOpen, yClose, yHigh);
            const bottom = Math.max(yOpen, yClose, yLow);
            const vertTol = 6;
            vertHit = my >= top2 - vertTol && my <= bottom + vertTol;
          }
          if (!(horizHit && vertHit)) {
            this.tooltipEl.style.display = "none";
            return;
          }
          const p = mapped.point;
          const html = this.opts.tooltipFormatter ? this.opts.tooltipFormatter(p, mapped.index) : `<div style="font-weight:600">${new Date(mapped.time).toLocaleDateString()}</div><div>O ${p.open}</div><div>H ${p.high}</div><div>L ${p.low}</div><div>C ${p.close}</div><div>V ${p.volume.toLocaleString()}</div>`;
          this.tooltipEl.innerHTML = html;
          const containerRect = this.container.getBoundingClientRect();
          this.tooltipEl.style.display = "block";
          this.tooltipEl.style.left = "0px";
          this.tooltipEl.style.top = "0px";
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
          if (left + tipW > containerRect.width - 6)
            left = Math.max(6, clientXRel - tipW - 12);
          if (left < 6)
            left = 6;
          if (top < 6)
            top = 6;
          this.tooltipEl.style.left = left + "px";
          this.tooltipEl.style.top = top + "px";
          const primarySeriesId = Array.from(this.core.seriesStore.keys())[0];
          const entry = this.core.seriesStore.get(primarySeriesId);
          if (renderer && typeof renderer.drawSeries === "function") {
            const vr = this.core.getVisibleRange();
            if (vr && typeof vr.from === "number" && typeof vr.to === "number") {
              renderer.drawSeries(primarySeriesId, entry?.data ?? [], Object.assign({}, entry?.options ?? {}, { startIndex: vr.from, visibleCount: vr.to - vr.from + 1 }));
            } else {
              renderer.drawSeries(primarySeriesId, entry?.data ?? [], Object.assign({}, entry?.options ?? {}));
            }
            renderer.drawCrosshairAt(mx, my, entry?.data ?? [], this.opts);
          }
          if (this.legendEl) {
            this._updateLegend(`${this.opts.symbol ?? ""}`, `C ${p.close} (${new Date(mapped.time).toLocaleDateString()})`);
          }
        }
      };
      const onPointerUp = (ev) => {
        try {
          canvas.releasePointerCapture(ev.pointerId);
        } catch {}
        this.dragging = false;
        this.pointerId = null;
      };
      const onWheel = (ev) => {
        ev.preventDefault();
        if (!this.core)
          return;
        const rect = canvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const mx = cx;
        const mapped = renderer.mapClientToData(mx, rect.height / 2, this._getPrimarySeriesData(), this.opts);
        const centerIndex = mapped ? mapped.index : undefined;
        const factor = ev.deltaY < 0 ? 0.8695652173913044 : 1.15;
        this.core.zoomAt(factor, centerIndex);
      };
      const onTouchStart = (ev) => {
        if (!canvas || !this.core)
          return;
        if (ev.touches.length === 2) {
          ev.preventDefault();
          const t0 = ev.touches[0];
          const t1 = ev.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          this._pinchStartDist = Math.hypot(dx, dy);
          this._pinchStartCenterClientX = (t0.clientX + t1.clientX) / 2 - canvas.getBoundingClientRect().left;
          const mapped = renderer.mapClientToData(this._pinchStartCenterClientX, canvas.height / (window.devicePixelRatio || 1) / 2, this._getPrimarySeriesData(), this.opts);
          this._pinchStartCenterIndex = mapped ? mapped.index : undefined;
        }
      };
      const onTouchMove = (ev) => {
        if (!canvas || !this.core)
          return;
        if (ev.touches.length === 2 && this._pinchStartDist) {
          ev.preventDefault();
          const t0 = ev.touches[0];
          const t1 = ev.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          const dist = Math.hypot(dx, dy);
          const factor = this._pinchStartDist > 0 ? dist / this._pinchStartDist : 1;
          const clamped = Math.max(0.5, Math.min(2.5, factor));
          this.core.zoomAt(1 / clamped, this._pinchStartCenterIndex);
        }
      };
      const onTouchEnd = (ev) => {
        if (ev.touches.length < 2) {
          this._pinchStartDist = null;
          this._pinchStartCenterClientX = null;
          this._pinchStartCenterIndex = undefined;
        }
      };
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd);
      this._listeners = { onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd };
    }
    _getPrimarySeriesData() {
      if (!this.core)
        return [];
      const keys = Array.from(this.core.seriesStore.keys());
      if (keys.length === 0)
        return [];
      const entry = this.core.seriesStore.get(keys[0]);
      return entry?.data ?? [];
    }
    enableTooltip(v) {
      this.opts.enableTooltip = !!v;
      if (!this.container)
        return;
      if (v) {
        if (!this.tooltipEl)
          this.tooltipEl = this._createTooltip();
        this.tooltipEl.style.display = "none";
      } else {
        if (this.tooltipEl)
          this.tooltipEl.style.display = "none";
      }
    }
    _ensureLegend() {
      if (!this.container)
        return;
      if (!this.legendEl)
        this.legendEl = this._createLegend();
      this._updateLegend(this.opts.symbol ?? "", "");
    }
    _createLegend() {
      if (!this.container)
        throw new Error("No container");
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.left = "8px";
      div.style.top = "8px";
      div.style.pointerEvents = "none";
      div.style.background = "rgba(255,255,255,0.85)";
      div.style.color = "#000";
      div.style.padding = "6px 8px";
      div.style.borderRadius = "4px";
      div.style.font = "12px sans-serif";
      div.style.zIndex = "900";
      this.container.appendChild(div);
      return div;
    }
    _updateLegend(left, right) {
      if (!this.legendEl)
        return;
      this.legendEl.innerHTML = `<div style="font-weight:600">${left}</div><div style="opacity:0.85">${right}</div>`;
    }
    _createTooltip() {
      if (!this.container)
        throw new Error("No container");
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.pointerEvents = "none";
      div.style.background = "rgba(0,0,0,0.8)";
      div.style.color = "#fff";
      div.style.padding = "6px 8px";
      div.style.borderRadius = "4px";
      div.style.font = "12px sans-serif";
      div.style.display = "none";
      div.style.zIndex = "1000";
      this.container.appendChild(div);
      return div;
    }
    on(event, handler) {
      const set = this.handlers.get(event) ?? new Set;
      set.add(handler);
      this.handlers.set(event, set);
    }
    off(event, handler) {
      if (!this.handlers.has(event))
        return;
      if (!handler) {
        this.handlers.delete(event);
        return;
      }
      this.handlers.get(event).delete(handler);
    }
    emit(event, payload) {
      const set = this.handlers.get(event);
      if (!set)
        return;
      for (const cb of Array.from(set))
        cb(payload);
    }
    async connectFeed(adapter) {
      if (!this.core)
        throw new Error("Chart not created");
      await this.core.connectFeed(adapter);
    }
    async disconnectFeed() {
      if (!this.core)
        return;
      await this.core.disconnectFeed();
    }
    async destroy() {
      const canvas = this.getCanvas();
      const l = this._listeners;
      if (canvas && l) {
        canvas.removeEventListener("pointerdown", l.onPointerDown);
        canvas.removeEventListener("pointermove", l.onPointerMove);
        window.removeEventListener("pointerup", l.onPointerUp);
        canvas.removeEventListener("wheel", l.onWheel);
        canvas.removeEventListener("touchstart", l.onTouchStart);
        canvas.removeEventListener("touchmove", l.onTouchMove);
        canvas.removeEventListener("touchend", l.onTouchEnd);
      }
      if (this.tooltipEl && this.tooltipEl.parentElement)
        this.tooltipEl.parentElement.removeChild(this.tooltipEl);
      if (this.legendEl && this.legendEl.parentElement)
        this.legendEl.parentElement.removeChild(this.legendEl);
      if (this.core)
        await this.core.destroy();
      this.handlers.clear();
      this.core = null;
      this.container = null;
      this.tooltipEl = null;
    }
    setViewport(from, to) {
      this.core?.setViewport(from, to);
    }
    panBy(deltaIndex) {
      this.core?.panBy(deltaIndex);
    }
    zoomAt(factor, centerIndex) {
      this.core?.zoomAt(factor, centerIndex);
    }
    attach(container) {
      this.container = container;
    }
    detach() {}
  }
  return new ChartEmbed;
}

// src/index.ts
init_chart();
init_chart();
init_tradeMarkers();

// src/core/i18n.ts
var INDICATOR_I18N = {
  "indicator.bb.name": { en: "Bollinger Bands", ja: "ボリンジャーバンド" },
  "indicator.rsi.name": { en: "RSI", ja: "RSI（相対力指数）" },
  "indicator.adx.name": { en: "ADX", ja: "ADX（平均方向性指数）" },
  "indicator.macd.name": { en: "MACD", ja: "MACD" },
  "indicator.atr.name": { en: "ATR", ja: "ATR" },
  "indicator.volume.name": { en: "Volume", ja: "出来高" }
};
var t = (key, locale = "ja") => {
  return INDICATOR_I18N[key]?.[locale] ?? key;
};
// src/core/indicatorCatalog.ts
var INDICATOR_PHASES = {
  phase1: ["volume", "sma", "ema", "bb", "candles"],
  phase2: ["rsi", "adx", "atr", "macd", "trade_markers"],
  phase3: ["vwap", "vol_ratio", "percent_b", "bb_width"],
  phase4: ["obv", "cmf", "mfi", "kaufman_patterns"]
};

// src/index.ts
init_phase1();
init_phase3();
init_phase2();
init_phase4();
var src_default = {
  createEmbedAPI: (await Promise.resolve().then(() => exports_embedApi)).createEmbedAPI
};
export {
  t,
  registerPhase4Indicators,
  registerPhase3Indicators,
  registerPhase2Indicators,
  registerPhase1Indicators,
  src_default as default,
  createEmbedAPI,
  Volume,
  VolRatio,
  VWAP,
  TradeMarkers,
  SqueezeAlert,
  SMA,
  RSI,
  PivotPoints,
  Phase4Indicators,
  Phase3Indicators,
  Phase2Indicators,
  Phase1Indicators,
  PercentB,
  OBV,
  MoChart,
  MFI,
  MACD,
  KaufmanPatterns,
  InMemoryIndicatorRegistry,
  INDICATOR_PHASES,
  INDICATOR_I18N,
  EMA,
  Divergence,
  DEFAULT_MARKER_STYLES,
  ChartCore,
  CMF,
  BollingerBands,
  BBWidth,
  ATR,
  ADX
};

//# debugId=9FD754954A314A7564756E2164756E21
//# sourceMappingURL=index.js.map
