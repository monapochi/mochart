// src/renderer/webgl2/webgl2Renderer.ts
var DEFAULT_COLORS = {
  up: [0, 0.7, 0, 1],
  down: [1, 0, 0, 1],
  wick: [0, 0, 0, 1],
  outline: [0, 0, 0, 1],
  background: [1, 1, 1, 1]
};

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
  setIndicatorSegments(_segments) {
  }
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
var VERTEX_SHADER = `#version 300 es
in vec3 a_coordinates;
uniform vec2 u_translation;
uniform vec2 u_scale;
uniform vec2 u_resolution;

void main() {
  vec2 pos = (a_coordinates.xy * u_scale + u_translation + vec2(0.5, 0.5)) / u_resolution;
  pos.x = pos.x - 1.0;
  gl_Position = vec4(pos, a_coordinates.z, 1.0);
}
`;
var FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}
`;

// src/renderer/webgpu/webgpuRenderer.ts
var DEFAULT_COLORS2 = {
  up: [0, 0.7, 0, 1],
  down: [1, 0, 0, 1],
  wick: [0, 0, 0, 1],
  outline: [0, 0, 0, 1],
  background: [1, 1, 1, 1]
};

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
var pushQuad = (out, x0, y0, x1, y1, color) => {
  out.push(x0, y0, ...color);
  out.push(x1, y0, ...color);
  out.push(x1, y1, ...color);
  out.push(x0, y0, ...color);
  out.push(x1, y1, ...color);
  out.push(x0, y1, ...color);
};

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
var ok = (value) => ({ ok: true, value });
var fail = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var SMA = {
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
var EMA = {
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
var BollingerBands = {
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
var Volume = {
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
var PivotPoints = {
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
var Phase1Indicators = [Volume, SMA, EMA, BollingerBands, PivotPoints];
var registerPhase1Indicators = (registry) => {
  Phase1Indicators.forEach((indicator) => registry.register(indicator));
};

// src/indicators/phase2.ts
var ok2 = (value) => ({ ok: true, value });
var fail2 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var RSI = {
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
var ATR = {
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
var MACD = {
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
var ADX = {
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
var TradeMarkers = {
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
var Phase2Indicators = [RSI, ADX, ATR, MACD, TradeMarkers];
var registerPhase2Indicators = (registry) => {
  Phase2Indicators.forEach((indicator) => registry.register(indicator));
};

// src/indicators/phase3.ts
var ok3 = (value) => ({ ok: true, value });
var fail3 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var VWAP = {
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
var VolRatio = {
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
var PercentB = {
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
var BBWidth = {
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
var Phase3Indicators = [VWAP, VolRatio, PercentB, BBWidth];
var registerPhase3Indicators = (registry) => {
  Phase3Indicators.forEach((indicator) => registry.register(indicator));
};

// src/indicators/phase4.ts
var ok4 = (value) => ({ ok: true, value });
var fail4 = (message) => ({
  ok: false,
  error: { code: "COMPUTATION_ERROR", message }
});
var OBV = {
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
var CMF = {
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
var MFI = {
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
var KaufmanPatterns = {
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
var SqueezeAlert = {
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
var Divergence = {
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
var Phase4Indicators = [OBV, CMF, MFI, KaufmanPatterns, SqueezeAlert, Divergence];
var registerPhase4Indicators = (registry) => {
  Phase4Indicators.forEach((indicator) => registry.register(indicator));
};

// src/core/tradeMarkers.ts
var DEFAULT_MARKER_STYLES = {
  entry_long: { shape: "triangle_up", color: "#4CAF50", size: 10 },
  entry_short: { shape: "triangle_down", color: "#F44336", size: 10 },
  exit_long: { shape: "triangle_up", color: "#81C784", borderColor: "#4CAF50", size: 8 },
  exit_short: { shape: "triangle_down", color: "#E57373", borderColor: "#F44336", size: 8 },
  stop_loss: { shape: "cross", color: "#F44336", size: 10 },
  take_profit: { shape: "circle", color: "#4CAF50", size: 8 },
  signal: { shape: "diamond", color: "#FFC107", size: 8 },
  alert: { shape: "warning", color: "#FF9800", size: 10 }
};

// src/core/chart.ts
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
// src/core/i18n.ts
var INDICATOR_I18N = {
  "indicator.bb.name": { en: "Bollinger Bands", ja: "\u30DC\u30EA\u30F3\u30B8\u30E3\u30FC\u30D0\u30F3\u30C9" },
  "indicator.rsi.name": { en: "RSI", ja: "RSI\uFF08\u76F8\u5BFE\u529B\u6307\u6570\uFF09" },
  "indicator.adx.name": { en: "ADX", ja: "ADX\uFF08\u5E73\u5747\u65B9\u5411\u6027\u6307\u6570\uFF09" },
  "indicator.macd.name": { en: "MACD", ja: "MACD" },
  "indicator.atr.name": { en: "ATR", ja: "ATR" },
  "indicator.volume.name": { en: "Volume", ja: "\u51FA\u6765\u9AD8" }
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
export {
  t,
  registerPhase4Indicators,
  registerPhase3Indicators,
  registerPhase2Indicators,
  registerPhase1Indicators,
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
  CMF,
  BollingerBands,
  BBWidth,
  ATR,
  ADX
};

//# debugId=F89B943443F7F8AF64756e2164756e21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL3JlbmRlcmVyL3dlYmdsMi93ZWJnbDJSZW5kZXJlci50cyIsICIuLi9zcmMvcmVuZGVyZXIvd2ViZ3B1L3dlYmdwdVJlbmRlcmVyLnRzIiwgIi4uL3NyYy9jb3JlL2luZGljYXRvcnMudHMiLCAiLi4vc3JjL2NvcmUvaW5kaWNhdG9yVHlwZXMudHMiLCAiLi4vc3JjL2luZGljYXRvcnMvcGhhc2UxLnRzIiwgIi4uL3NyYy9pbmRpY2F0b3JzL3BoYXNlMi50cyIsICIuLi9zcmMvaW5kaWNhdG9ycy9waGFzZTMudHMiLCAiLi4vc3JjL2luZGljYXRvcnMvcGhhc2U0LnRzIiwgIi4uL3NyYy9jb3JlL3RyYWRlTWFya2Vycy50cyIsICIuLi9zcmMvY29yZS9jaGFydC50cyIsICIuLi9zcmMvY29yZS9pMThuLnRzIiwgIi4uL3NyYy9jb3JlL2luZGljYXRvckNhdGFsb2cudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiaW1wb3J0IHR5cGUgeyBDaGFydENvbmZpZywgQ2hhcnRDb2xvcnMsIE9obGN2UG9pbnQgfSBmcm9tICcuLi8uLi9jb3JlL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgQ2hhcnRSZW5kZXJlciB9IGZyb20gJy4uL3JlbmRlcmVyJztcblxuY29uc3QgREVGQVVMVF9DT0xPUlM6IENoYXJ0Q29sb3JzID0ge1xuICB1cDogWzAuMCwgMC43LCAwLjAsIDEuMF0sXG4gIGRvd246IFsxLjAsIDAuMCwgMC4wLCAxLjBdLFxuICB3aWNrOiBbMC4wLCAwLjAsIDAuMCwgMS4wXSxcbiAgb3V0bGluZTogWzAuMCwgMC4wLCAwLjAsIDEuMF0sXG4gIGJhY2tncm91bmQ6IFsxLjAsIDEuMCwgMS4wLCAxLjBdLFxufTtcblxuZXhwb3J0IGNsYXNzIFdlYkdMMlJlbmRlcmVyIGltcGxlbWVudHMgQ2hhcnRSZW5kZXJlciB7XG4gIHByaXZhdGUgZ2whOiBXZWJHTDJSZW5kZXJpbmdDb250ZXh0O1xuICBwcml2YXRlIHByb2dyYW0hOiBXZWJHTFByb2dyYW07XG4gIHByaXZhdGUgYnVmZmVyITogV2ViR0xCdWZmZXI7XG4gIHByaXZhdGUgZGF0YTogT2hsY3ZQb2ludFtdID0gW107XG4gIHByaXZhdGUgY29uZmlnOiBDaGFydENvbmZpZyA9IHt9O1xuICBwcml2YXRlIGNvbG9yczogQ2hhcnRDb2xvcnMgPSBERUZBVUxUX0NPTE9SUztcblxuICBwcml2YXRlIGFDb29yZGluYXRlcyA9IC0xO1xuICBwcml2YXRlIHVUcmFuc2xhdGlvbjogV2ViR0xVbmlmb3JtTG9jYXRpb24gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB1U2NhbGU6IFdlYkdMVW5pZm9ybUxvY2F0aW9uIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdVJlc29sdXRpb246IFdlYkdMVW5pZm9ybUxvY2F0aW9uIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgdUNvbG9yOiBXZWJHTFVuaWZvcm1Mb2NhdGlvbiB8IG51bGwgPSBudWxsO1xuXG4gIGluaXRpYWxpemUoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IGdsID0gY2FudmFzLmdldENvbnRleHQoJ3dlYmdsMicpO1xuICAgIGlmICghZ2wpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignV2ViR0wyIGlzIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBlbnZpcm9ubWVudC4nKTtcbiAgICB9XG5cbiAgICB0aGlzLmdsID0gZ2w7XG4gICAgdGhpcy5wcm9ncmFtID0gdGhpcy5jcmVhdGVQcm9ncmFtKGdsLCBWRVJURVhfU0hBREVSLCBGUkFHTUVOVF9TSEFERVIpO1xuICAgIHRoaXMuYnVmZmVyID0gdGhpcy5jcmVhdGVCdWZmZXIoZ2wpO1xuXG4gICAgdGhpcy5hQ29vcmRpbmF0ZXMgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sICdhX2Nvb3JkaW5hdGVzJyk7XG4gICAgdGhpcy51VHJhbnNsYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLCAndV90cmFuc2xhdGlvbicpO1xuICAgIHRoaXMudVNjYWxlID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgJ3Vfc2NhbGUnKTtcbiAgICB0aGlzLnVSZXNvbHV0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgJ3VfcmVzb2x1dGlvbicpO1xuICAgIHRoaXMudUNvbG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgJ3VfY29sb3InKTtcblxuICAgIGdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcbiAgfVxuXG4gIHNldERhdGEoZGF0YTogT2hsY3ZQb2ludFtdKTogdm9pZCB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB0aGlzLnVwbG9hZERhdGEoKTtcbiAgfVxuXG4gIHNldENvbmZpZyhjb25maWc6IENoYXJ0Q29uZmlnKTogdm9pZCB7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy5jb2xvcnMgPSB7XG4gICAgICAuLi5ERUZBVUxUX0NPTE9SUyxcbiAgICAgIC4uLihjb25maWcuY29sb3JzID8/IHt9KSxcbiAgICB9O1xuICB9XG5cbiAgc2V0SW5kaWNhdG9yU2VnbWVudHMoX3NlZ21lbnRzOiBGbG9hdDMyQXJyYXkpOiB2b2lkIHtcbiAgICAvLyBUT0RPOiBXZWJHTDIgaW5kaWNhdG9yIHJlbmRlcmluZ1xuICB9XG5cbiAgcmVuZGVyKCk6IHZvaWQge1xuICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICBpZiAoIWdsIHx8ICF0aGlzLnByb2dyYW0gfHwgIXRoaXMuYnVmZmVyKSByZXR1cm47XG5cbiAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgZ2wuY2xlYXJDb2xvciguLi50aGlzLmNvbG9ycy5iYWNrZ3JvdW5kKTtcbiAgICBnbC5jbGVhckRlcHRoKDEuMCk7XG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQpO1xuXG4gICAgZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLmJ1ZmZlcik7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkodGhpcy5hQ29vcmRpbmF0ZXMpO1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIodGhpcy5hQ29vcmRpbmF0ZXMsIDMsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICBpZiAodGhpcy51U2NhbGUpIGdsLnVuaWZvcm0yZnYodGhpcy51U2NhbGUsIG5ldyBGbG9hdDMyQXJyYXkoWzAuMjMsIDUuMF0pKTtcbiAgICBpZiAodGhpcy51UmVzb2x1dGlvbikgZ2wudW5pZm9ybTJmdih0aGlzLnVSZXNvbHV0aW9uLCBuZXcgRmxvYXQzMkFycmF5KFtnbC5kcmF3aW5nQnVmZmVyV2lkdGgsIGdsLmRyYXdpbmdCdWZmZXJIZWlnaHRdKSk7XG5cbiAgICBjb25zdCBzdHJpZGUgPSA2O1xuXG4gICAgZm9yIChsZXQgYyA9IDA7IGMgPCB0aGlzLmRhdGEubGVuZ3RoOyBjKyspIHtcbiAgICAgIGlmICh0aGlzLnVUcmFuc2xhdGlvbikgZ2wudW5pZm9ybTJmdih0aGlzLnVUcmFuc2xhdGlvbiwgbmV3IEZsb2F0MzJBcnJheShbKGMgKyAxKSAqIDI1LCAwXSkpO1xuXG4gICAgICBpZiAodGhpcy51Q29sb3IpIGdsLnVuaWZvcm00ZnYodGhpcy51Q29sb3IsIG5ldyBGbG9hdDMyQXJyYXkodGhpcy5jb2xvcnMud2ljaykpO1xuICAgICAgZ2wubGluZVdpZHRoKDEpO1xuICAgICAgZ2wuZHJhd0FycmF5cyhnbC5MSU5FUywgYyAqIHN0cmlkZSArIDQsIDIpO1xuXG4gICAgICBjb25zdCBpc1VwID0gdGhpcy5kYXRhW2NdLm9wZW4gPCB0aGlzLmRhdGFbY10uY2xvc2U7XG4gICAgICBpZiAodGhpcy51Q29sb3IpIGdsLnVuaWZvcm00ZnYodGhpcy51Q29sb3IsIG5ldyBGbG9hdDMyQXJyYXkoaXNVcCA/IHRoaXMuY29sb3JzLnVwIDogdGhpcy5jb2xvcnMuZG93bikpO1xuICAgICAgZ2wuZHJhd0FycmF5cyhnbC5UUklBTkdMRV9GQU4sIGMgKiBzdHJpZGUsIDQpO1xuXG4gICAgICBpZiAodGhpcy51Q29sb3IpIGdsLnVuaWZvcm00ZnYodGhpcy51Q29sb3IsIG5ldyBGbG9hdDMyQXJyYXkodGhpcy5jb2xvcnMub3V0bGluZSkpO1xuICAgICAgZ2wuZHJhd0FycmF5cyhnbC5MSU5FX0xPT1AsIGMgKiBzdHJpZGUsIDQpO1xuICAgIH1cblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBudWxsKTtcbiAgfVxuXG4gIHJlc2l6ZSgpOiB2b2lkIHtcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcyBhcyBIVE1MQ2FudmFzRWxlbWVudDtcbiAgICBpZiAoY2FudmFzLmNsaWVudFdpZHRoICE9PSBjYW52YXMud2lkdGgpIGNhbnZhcy53aWR0aCA9IGNhbnZhcy5jbGllbnRXaWR0aDtcbiAgICBpZiAoY2FudmFzLmNsaWVudEhlaWdodCAhPT0gY2FudmFzLmhlaWdodCkgY2FudmFzLmhlaWdodCA9IGNhbnZhcy5jbGllbnRIZWlnaHQ7XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICBpZiAodGhpcy5wcm9ncmFtKSBnbC5kZWxldGVQcm9ncmFtKHRoaXMucHJvZ3JhbSk7XG4gICAgaWYgKHRoaXMuYnVmZmVyKSBnbC5kZWxldGVCdWZmZXIodGhpcy5idWZmZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGxvYWREYXRhKCk6IHZvaWQge1xuICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICBjb25zdCB2ZXJ0aWNlcyA9IHRoaXMuY3JlYXRlVmVydGljZXModGhpcy5kYXRhKTtcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy5idWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KHZlcnRpY2VzKSwgZ2wuU1RBVElDX0RSQVcpO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBudWxsKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlVmVydGljZXMoZGF0YTogT2hsY3ZQb2ludFtdKTogbnVtYmVyW10ge1xuICAgIHJldHVybiBkYXRhXG4gICAgICAubWFwKChkKSA9PiBbXG4gICAgICAgIC0xOSwgZC5vcGVuLCAwLFxuICAgICAgICAyMSwgZC5vcGVuLCAwLFxuICAgICAgICAyMSwgZC5jbG9zZSwgMCxcbiAgICAgICAgLTE5LCBkLmNsb3NlLCAwLFxuICAgICAgICAxLCBkLmhpZ2gsIDAsXG4gICAgICAgIDEsIGQubG93LCAwLFxuICAgICAgXSlcbiAgICAgIC5yZWR1Y2UoKGEsIGIpID0+IGEuY29uY2F0KGIpLCBbXSBhcyBudW1iZXJbXSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJ1ZmZlcihnbDogV2ViR0wyUmVuZGVyaW5nQ29udGV4dCk6IFdlYkdMQnVmZmVyIHtcbiAgICBjb25zdCBidWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBpZiAoIWJ1ZmZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gY3JlYXRlIFdlYkdMIGJ1ZmZlci4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHJvZ3JhbShnbDogV2ViR0wyUmVuZGVyaW5nQ29udGV4dCwgdnM6IHN0cmluZywgZnM6IHN0cmluZyk6IFdlYkdMUHJvZ3JhbSB7XG4gICAgY29uc3QgdmVydGV4U2hhZGVyID0gdGhpcy5jb21waWxlU2hhZGVyKGdsLCBnbC5WRVJURVhfU0hBREVSLCB2cyk7XG4gICAgY29uc3QgZnJhZ21lbnRTaGFkZXIgPSB0aGlzLmNvbXBpbGVTaGFkZXIoZ2wsIGdsLkZSQUdNRU5UX1NIQURFUiwgZnMpO1xuXG4gICAgY29uc3QgcHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcbiAgICBpZiAoIXByb2dyYW0pIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGNyZWF0ZSBXZWJHTCBwcm9ncmFtLicpO1xuXG4gICAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIHZlcnRleFNoYWRlcik7XG4gICAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiAgICBnbC5saW5rUHJvZ3JhbShwcm9ncmFtKTtcblxuICAgIGlmICghZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcbiAgICAgIGNvbnN0IGluZm8gPSBnbC5nZXRQcm9ncmFtSW5mb0xvZyhwcm9ncmFtKTtcbiAgICAgIGdsLmRlbGV0ZVByb2dyYW0ocHJvZ3JhbSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb2dyYW0gbGluayBmYWlsZWQ6ICR7aW5mbyA/PyAndW5rbm93biBlcnJvcid9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb2dyYW07XG4gIH1cblxuICBwcml2YXRlIGNvbXBpbGVTaGFkZXIoZ2w6IFdlYkdMMlJlbmRlcmluZ0NvbnRleHQsIHR5cGU6IG51bWJlciwgc291cmNlOiBzdHJpbmcpOiBXZWJHTFNoYWRlciB7XG4gICAgY29uc3Qgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHR5cGUpO1xuICAgIGlmICghc2hhZGVyKSB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBjcmVhdGUgc2hhZGVyLicpO1xuXG4gICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcbiAgICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cbiAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgY29uc3QgaW5mbyA9IGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKTtcbiAgICAgIGdsLmRlbGV0ZVNoYWRlcihzaGFkZXIpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTaGFkZXIgY29tcGlsZSBmYWlsZWQ6ICR7aW5mbyA/PyAndW5rbm93biBlcnJvcid9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxufVxuXG5jb25zdCBWRVJURVhfU0hBREVSID0gYCN2ZXJzaW9uIDMwMCBlc1xuaW4gdmVjMyBhX2Nvb3JkaW5hdGVzO1xudW5pZm9ybSB2ZWMyIHVfdHJhbnNsYXRpb247XG51bmlmb3JtIHZlYzIgdV9zY2FsZTtcbnVuaWZvcm0gdmVjMiB1X3Jlc29sdXRpb247XG5cbnZvaWQgbWFpbigpIHtcbiAgdmVjMiBwb3MgPSAoYV9jb29yZGluYXRlcy54eSAqIHVfc2NhbGUgKyB1X3RyYW5zbGF0aW9uICsgdmVjMigwLjUsIDAuNSkpIC8gdV9yZXNvbHV0aW9uO1xuICBwb3MueCA9IHBvcy54IC0gMS4wO1xuICBnbF9Qb3NpdGlvbiA9IHZlYzQocG9zLCBhX2Nvb3JkaW5hdGVzLnosIDEuMCk7XG59XG5gO1xuXG5jb25zdCBGUkFHTUVOVF9TSEFERVIgPSBgI3ZlcnNpb24gMzAwIGVzXG5wcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcbnVuaWZvcm0gdmVjNCB1X2NvbG9yO1xub3V0IHZlYzQgb3V0Q29sb3I7XG5cbnZvaWQgbWFpbigpIHtcbiAgb3V0Q29sb3IgPSB1X2NvbG9yO1xufVxuYDtcbiIsCiAgImltcG9ydCB0eXBlIHsgQ2hhcnRDb25maWcsIENoYXJ0Q29sb3JzLCBPaGxjdlBvaW50IH0gZnJvbSAnLi4vLi4vY29yZS90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IENoYXJ0UmVuZGVyZXIgfSBmcm9tICcuLi9yZW5kZXJlcic7XG5cbnR5cGUgR1BVQWRhcHRlciA9IHVua25vd247XG50eXBlIEdQVURldmljZSA9IHtcbiAgcXVldWU6IHsgc3VibWl0OiAoY29tbWFuZHM6IHVua25vd25bXSkgPT4gdm9pZDsgd3JpdGVCdWZmZXI/OiAoYnVmZmVyOiBhbnksIG9mZnNldDogbnVtYmVyLCBkYXRhOiBBcnJheUJ1ZmZlclZpZXcpID0+IHZvaWQgfTtcbiAgY3JlYXRlQ29tbWFuZEVuY29kZXI6ICgpID0+IGFueTtcbiAgY3JlYXRlUmVuZGVyUGlwZWxpbmU6IChkZXNjcmlwdG9yOiBhbnkpID0+IGFueTtcbiAgY3JlYXRlU2hhZGVyTW9kdWxlOiAoZGVzY3JpcHRvcjogYW55KSA9PiBhbnk7XG4gIGNyZWF0ZUJ1ZmZlcjogKGRlc2NyaXB0b3I6IGFueSkgPT4gYW55O1xuICBjcmVhdGVDb21wdXRlUGlwZWxpbmU6IChkZXNjcmlwdG9yOiBhbnkpID0+IGFueTtcbiAgY3JlYXRlQmluZEdyb3VwOiAoZGVzY3JpcHRvcjogYW55KSA9PiBhbnk7XG59O1xudHlwZSBHUFVDYW52YXNDb250ZXh0ID0geyBjb25maWd1cmU6IChvcHRpb25zOiBhbnkpID0+IHZvaWQ7IGdldEN1cnJlbnRUZXh0dXJlOiAoKSA9PiB7IGNyZWF0ZVZpZXc6ICgpID0+IGFueSB9IH07XG50eXBlIEdQVVRleHR1cmVGb3JtYXQgPSBzdHJpbmc7XG5cbnR5cGUgV2ViR1BVQ29udGV4dCA9IHtcbiAgYWRhcHRlcjogR1BVQWRhcHRlcjtcbiAgZGV2aWNlOiBHUFVEZXZpY2U7XG4gIGNvbnRleHQ6IEdQVUNhbnZhc0NvbnRleHQ7XG4gIGZvcm1hdDogR1BVVGV4dHVyZUZvcm1hdDtcbn07XG5cbmNvbnN0IERFRkFVTFRfQ09MT1JTOiBDaGFydENvbG9ycyA9IHtcbiAgdXA6IFswLjAsIDAuNywgMC4wLCAxLjBdLFxuICBkb3duOiBbMS4wLCAwLjAsIDAuMCwgMS4wXSxcbiAgd2ljazogWzAuMCwgMC4wLCAwLjAsIDEuMF0sXG4gIG91dGxpbmU6IFswLjAsIDAuMCwgMC4wLCAxLjBdLFxuICBiYWNrZ3JvdW5kOiBbMS4wLCAxLjAsIDEuMCwgMS4wXSxcbn07XG5cbmV4cG9ydCBjbGFzcyBXZWJHUFVSZW5kZXJlciBpbXBsZW1lbnRzIENoYXJ0UmVuZGVyZXIge1xuICBwcml2YXRlIGRhdGE6IE9obGN2UG9pbnRbXSA9IFtdO1xuICBwcml2YXRlIGNvbmZpZzogQ2hhcnRDb25maWcgPSB7fTtcbiAgcHJpdmF0ZSBjb2xvcnM6IENoYXJ0Q29sb3JzID0gREVGQVVMVF9DT0xPUlM7XG4gIHByaXZhdGUgY29udGV4dDogV2ViR1BVQ29udGV4dCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpbml0UHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHBpcGVsaW5lOiBhbnkgPSBudWxsO1xuICBwcml2YXRlIHZlcnRleEJ1ZmZlcjogYW55ID0gbnVsbDtcbiAgcHJpdmF0ZSB2ZXJ0ZXhDb3VudCA9IDA7XG4gIHByaXZhdGUgbGluZVBpcGVsaW5lOiBhbnkgPSBudWxsO1xuICBwcml2YXRlIGluZGljYXRvckJ1ZmZlcjogYW55ID0gbnVsbDtcbiAgcHJpdmF0ZSBpbmRpY2F0b3JDb3VudCA9IDA7XG4gIHByaXZhdGUgaW5kaWNhdG9yQnVmZmVyU2l6ZSA9IDA7XG4gIHByaXZhdGUgdmVydGV4QnVmZmVyU2l6ZSA9IDA7XG5cbiAgaW5pdGlhbGl6ZShjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50KTogdm9pZCB7XG4gICAgaWYgKCEoJ2dwdScgaW4gbmF2aWdhdG9yKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJHUFUgaXMgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGVudmlyb25tZW50LicpO1xuICAgIH1cbiAgICB0aGlzLmNhbnZhcyA9IGNhbnZhcztcbiAgICB0aGlzLmluaXRQcm9taXNlID0gdGhpcy5pbml0V2ViR1BVKCk7XG4gIH1cblxuICBzZXREYXRhKGRhdGE6IE9obGN2UG9pbnRbXSk6IHZvaWQge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgdGhpcy5idWlsZEdlb21ldHJ5KCk7XG4gIH1cblxuICBzZXRDb25maWcoY29uZmlnOiBDaGFydENvbmZpZyk6IHZvaWQge1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMuY29sb3JzID0ge1xuICAgICAgLi4uREVGQVVMVF9DT0xPUlMsXG4gICAgICAuLi4oY29uZmlnLmNvbG9ycyA/PyB7fSksXG4gICAgfTtcbiAgICB0aGlzLmJ1aWxkR2VvbWV0cnkoKTtcbiAgfVxuXG4gIHNldEluZGljYXRvclNlZ21lbnRzKHNlZ21lbnRzOiBGbG9hdDMyQXJyYXkpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkgcmV0dXJuO1xuICAgIGNvbnN0IHsgZGV2aWNlIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgdGhpcy5pbmRpY2F0b3JDb3VudCA9IHNlZ21lbnRzLmxlbmd0aCAvIDY7XG4gICAgaWYgKHRoaXMuaW5kaWNhdG9yQ291bnQgPT09IDApIHtcbiAgICAgIHRoaXMuaW5kaWNhdG9yQnVmZmVyID0gbnVsbDtcbiAgICAgIHRoaXMuaW5kaWNhdG9yQnVmZmVyU2l6ZSA9IDA7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghdGhpcy5pbmRpY2F0b3JCdWZmZXIgfHwgdGhpcy5pbmRpY2F0b3JCdWZmZXJTaXplICE9PSBzZWdtZW50cy5ieXRlTGVuZ3RoKSB7XG4gICAgICB0aGlzLmluZGljYXRvckJ1ZmZlciA9IGRldmljZS5jcmVhdGVCdWZmZXIoe1xuICAgICAgICBzaXplOiBzZWdtZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgICB1c2FnZTogKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLlZFUlRFWCB8ICh3aW5kb3cgYXMgYW55KS5HUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCxcbiAgICAgICAgbWFwcGVkQXRDcmVhdGlvbjogdHJ1ZSxcbiAgICAgIH0pO1xuICAgICAgbmV3IEZsb2F0MzJBcnJheSh0aGlzLmluZGljYXRvckJ1ZmZlci5nZXRNYXBwZWRSYW5nZSgpKS5zZXQoc2VnbWVudHMpO1xuICAgICAgdGhpcy5pbmRpY2F0b3JCdWZmZXIudW5tYXAoKTtcbiAgICAgIHRoaXMuaW5kaWNhdG9yQnVmZmVyU2l6ZSA9IHNlZ21lbnRzLmJ5dGVMZW5ndGg7XG4gICAgfSBlbHNlIGlmIChkZXZpY2UucXVldWUud3JpdGVCdWZmZXIpIHtcbiAgICAgIGRldmljZS5xdWV1ZS53cml0ZUJ1ZmZlcih0aGlzLmluZGljYXRvckJ1ZmZlciwgMCwgc2VnbWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcigpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkgcmV0dXJuO1xuICAgIGNvbnN0IHsgZGV2aWNlLCBjb250ZXh0OiBncHVDb250ZXh0IH0gPSB0aGlzLmNvbnRleHQ7XG5cbiAgICB0aGlzLnJlc2l6ZSgpO1xuXG4gICAgaWYgKCF0aGlzLnBpcGVsaW5lIHx8ICF0aGlzLnZlcnRleEJ1ZmZlciB8fCB0aGlzLnZlcnRleENvdW50ID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZW5jb2RlciA9IGRldmljZS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xuICAgIGNvbnN0IHRleHR1cmVWaWV3ID0gZ3B1Q29udGV4dC5nZXRDdXJyZW50VGV4dHVyZSgpLmNyZWF0ZVZpZXcoKTtcbiAgICBjb25zdCBwYXNzID0gZW5jb2Rlci5iZWdpblJlbmRlclBhc3Moe1xuICAgICAgY29sb3JBdHRhY2htZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgdmlldzogdGV4dHVyZVZpZXcsXG4gICAgICAgICAgbG9hZE9wOiAnY2xlYXInLFxuICAgICAgICAgIHN0b3JlT3A6ICdzdG9yZScsXG4gICAgICAgICAgY2xlYXJWYWx1ZToge1xuICAgICAgICAgICAgcjogdGhpcy5jb2xvcnMuYmFja2dyb3VuZFswXSxcbiAgICAgICAgICAgIGc6IHRoaXMuY29sb3JzLmJhY2tncm91bmRbMV0sXG4gICAgICAgICAgICBiOiB0aGlzLmNvbG9ycy5iYWNrZ3JvdW5kWzJdLFxuICAgICAgICAgICAgYTogdGhpcy5jb2xvcnMuYmFja2dyb3VuZFszXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHBhc3Muc2V0UGlwZWxpbmUodGhpcy5waXBlbGluZSk7XG4gICAgcGFzcy5zZXRWZXJ0ZXhCdWZmZXIoMCwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgIHBhc3MuZHJhdyh0aGlzLnZlcnRleENvdW50LCAxLCAwLCAwKTtcblxuICAgIGlmICh0aGlzLmxpbmVQaXBlbGluZSAmJiB0aGlzLmluZGljYXRvckJ1ZmZlciAmJiB0aGlzLmluZGljYXRvckNvdW50ID4gMCkge1xuICAgICAgcGFzcy5zZXRQaXBlbGluZSh0aGlzLmxpbmVQaXBlbGluZSk7XG4gICAgICBwYXNzLnNldFZlcnRleEJ1ZmZlcigwLCB0aGlzLmluZGljYXRvckJ1ZmZlcik7XG4gICAgICBwYXNzLmRyYXcodGhpcy5pbmRpY2F0b3JDb3VudCwgMSwgMCwgMCk7XG4gICAgfVxuICAgIHBhc3MuZW5kKCk7XG4gICAgZGV2aWNlLnF1ZXVlLnN1Ym1pdChbZW5jb2Rlci5maW5pc2goKV0pO1xuICB9XG5cbiAgcmVzaXplKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb250ZXh0IHx8ICF0aGlzLmNhbnZhcykgcmV0dXJuO1xuICAgIGNvbnN0IHsgZGV2aWNlLCBjb250ZXh0OiBncHVDb250ZXh0LCBmb3JtYXQgfSA9IHRoaXMuY29udGV4dDtcbiAgICBjb25zdCBkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyB8fCAxO1xuICAgIGNvbnN0IHdpZHRoID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcih0aGlzLmNhbnZhcy5jbGllbnRXaWR0aCAqIGRwcikpO1xuICAgIGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IodGhpcy5jYW52YXMuY2xpZW50SGVpZ2h0ICogZHByKSk7XG4gICAgaWYgKHRoaXMuY2FudmFzLndpZHRoID09PSB3aWR0aCAmJiB0aGlzLmNhbnZhcy5oZWlnaHQgPT09IGhlaWdodCkgcmV0dXJuO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy5jYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgIGdwdUNvbnRleHQuY29uZmlndXJlKHsgZGV2aWNlLCBmb3JtYXQsIGFscGhhTW9kZTogJ3ByZW11bHRpcGxpZWQnIH0pO1xuICB9XG5cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuICAgIHRoaXMuY2FudmFzID0gbnVsbDtcbiAgICB0aGlzLnBpcGVsaW5lID0gbnVsbDtcbiAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG4gICAgdGhpcy52ZXJ0ZXhDb3VudCA9IDA7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGluaXRXZWJHUFUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLmNhbnZhcykgcmV0dXJuO1xuICAgIGNvbnN0IGFkYXB0ZXIgPSBhd2FpdCAobmF2aWdhdG9yIGFzIGFueSkuZ3B1LnJlcXVlc3RBZGFwdGVyKCk7XG4gICAgaWYgKCFhZGFwdGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYkdQVSBhZGFwdGVyIG5vdCBhdmFpbGFibGUuJyk7XG4gICAgfVxuICAgIGNvbnN0IGRldmljZSA9IGF3YWl0IGFkYXB0ZXIucmVxdWVzdERldmljZSgpO1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCd3ZWJncHUnKSBhcyB1bmtub3duIGFzIEdQVUNhbnZhc0NvbnRleHQ7XG4gICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBhY3F1aXJlIFdlYkdQVSBjYW52YXMgY29udGV4dC4nKTtcbiAgICB9XG4gICAgY29uc3QgZm9ybWF0ID0gKG5hdmlnYXRvciBhcyBhbnkpLmdwdS5nZXRQcmVmZXJyZWRDYW52YXNGb3JtYXQoKSBhcyBHUFVUZXh0dXJlRm9ybWF0O1xuICAgIGNvbnRleHQuY29uZmlndXJlKHsgZGV2aWNlLCBmb3JtYXQsIGFscGhhTW9kZTogJ3ByZW11bHRpcGxpZWQnIH0pO1xuICAgIHRoaXMuY29udGV4dCA9IHsgYWRhcHRlciwgZGV2aWNlLCBjb250ZXh0LCBmb3JtYXQgfTtcbiAgICB0aGlzLnBpcGVsaW5lID0gdGhpcy5jcmVhdGVQaXBlbGluZShkZXZpY2UsIGZvcm1hdCk7XG4gICAgdGhpcy5saW5lUGlwZWxpbmUgPSB0aGlzLmNyZWF0ZUxpbmVQaXBlbGluZShkZXZpY2UsIGZvcm1hdCk7XG4gICAgdGhpcy5idWlsZEdlb21ldHJ5KCk7XG4gIH1cblxuICBhc3luYyBjb21wdXRlSW5kaWNhdG9yR1BVKFxuICAgIHdnc2xTb3VyY2U6IHN0cmluZyxcbiAgICBwYXJhbXM6IEFycmF5QnVmZmVyLFxuICAgIGRhdGE6IEZsb2F0MzJBcnJheSxcbiAgICBvdXRwdXRMZW5ndGg6IG51bWJlclxuICApOiBQcm9taXNlPEZsb2F0MzJBcnJheSB8IG51bGw+IHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgeyBkZXZpY2UgfSA9IHRoaXMuY29udGV4dDtcblxuICAgIGNvbnN0IHNoYWRlciA9IGRldmljZS5jcmVhdGVTaGFkZXJNb2R1bGUoeyBjb2RlOiB3Z3NsU291cmNlIH0pO1xuICAgIGNvbnN0IHBpcGVsaW5lID0gZGV2aWNlLmNyZWF0ZUNvbXB1dGVQaXBlbGluZSh7XG4gICAgICBsYXlvdXQ6ICdhdXRvJyxcbiAgICAgIGNvbXB1dGU6IHsgbW9kdWxlOiBzaGFkZXIsIGVudHJ5UG9pbnQ6ICdtYWluJyB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgaW5wdXRCdWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IGRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgIHVzYWdlOiAod2luZG93IGFzIGFueSkuR1BVQnVmZmVyVXNhZ2UuU1RPUkFHRSB8ICh3aW5kb3cgYXMgYW55KS5HUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCxcbiAgICAgIG1hcHBlZEF0Q3JlYXRpb246IHRydWUsXG4gICAgfSk7XG4gICAgbmV3IEZsb2F0MzJBcnJheShpbnB1dEJ1ZmZlci5nZXRNYXBwZWRSYW5nZSgpKS5zZXQoZGF0YSk7XG4gICAgaW5wdXRCdWZmZXIudW5tYXAoKTtcblxuICAgIGNvbnN0IHVuaWZvcm1CdWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IHBhcmFtcy5ieXRlTGVuZ3RoLFxuICAgICAgdXNhZ2U6ICh3aW5kb3cgYXMgYW55KS5HUFVCdWZmZXJVc2FnZS5VTklGT1JNIHwgKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxuICAgICAgbWFwcGVkQXRDcmVhdGlvbjogdHJ1ZSxcbiAgICB9KTtcbiAgICBuZXcgVWludDhBcnJheSh1bmlmb3JtQnVmZmVyLmdldE1hcHBlZFJhbmdlKCkpLnNldChuZXcgVWludDhBcnJheShwYXJhbXMpKTtcbiAgICB1bmlmb3JtQnVmZmVyLnVubWFwKCk7XG5cbiAgICBjb25zdCBvdXRwdXRCdWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IG91dHB1dExlbmd0aCAqIDQsXG4gICAgICB1c2FnZTogKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLlNUT1JBR0UgfCAod2luZG93IGFzIGFueSkuR1BVQnVmZmVyVXNhZ2UuQ09QWV9TUkMsXG4gICAgfSk7XG4gICAgY29uc3QgcmVhZGJhY2sgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IG91dHB1dExlbmd0aCAqIDQsXG4gICAgICB1c2FnZTogKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLk1BUF9SRUFEIHwgKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxuICAgIH0pO1xuXG4gICAgY29uc3QgYmluZEdyb3VwID0gZGV2aWNlLmNyZWF0ZUJpbmRHcm91cCh7XG4gICAgICBsYXlvdXQ6IHBpcGVsaW5lLmdldEJpbmRHcm91cExheW91dCgwKSxcbiAgICAgIGVudHJpZXM6IFtcbiAgICAgICAgeyBiaW5kaW5nOiAwLCByZXNvdXJjZTogeyBidWZmZXI6IGlucHV0QnVmZmVyIH0gfSxcbiAgICAgICAgeyBiaW5kaW5nOiAxLCByZXNvdXJjZTogeyBidWZmZXI6IHVuaWZvcm1CdWZmZXIgfSB9LFxuICAgICAgICB7IGJpbmRpbmc6IDIsIHJlc291cmNlOiB7IGJ1ZmZlcjogb3V0cHV0QnVmZmVyIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBlbmNvZGVyID0gZGV2aWNlLmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XG4gICAgY29uc3QgcGFzcyA9IGVuY29kZXIuYmVnaW5Db21wdXRlUGFzcygpO1xuICAgIHBhc3Muc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgIHBhc3Muc2V0QmluZEdyb3VwKDAsIGJpbmRHcm91cCk7XG5cbiAgICBjb25zdCB3b3JrZ3JvdXBTaXplID0gdGhpcy5nZXRXb3JrZ3JvdXBTaXplKHdnc2xTb3VyY2UpO1xuICAgIGNvbnN0IGRhdGFMZW4gPSBkYXRhLmxlbmd0aCAvIDY7XG4gICAgY29uc3Qgd29ya2dyb3VwQ291bnQgPSBNYXRoLmNlaWwoZGF0YUxlbiAvIHdvcmtncm91cFNpemUpO1xuICAgIHBhc3MuZGlzcGF0Y2hXb3JrZ3JvdXBzKHdvcmtncm91cENvdW50KTtcbiAgICBwYXNzLmVuZCgpO1xuXG4gICAgZW5jb2Rlci5jb3B5QnVmZmVyVG9CdWZmZXIob3V0cHV0QnVmZmVyLCAwLCByZWFkYmFjaywgMCwgb3V0cHV0TGVuZ3RoICogNCk7XG4gICAgZGV2aWNlLnF1ZXVlLnN1Ym1pdChbZW5jb2Rlci5maW5pc2goKV0pO1xuXG4gICAgYXdhaXQgcmVhZGJhY2subWFwQXN5bmMoKHdpbmRvdyBhcyBhbnkpLkdQVU1hcE1vZGUuUkVBRCk7XG4gICAgY29uc3QgcmVzdWx0ID0gcmVhZGJhY2suZ2V0TWFwcGVkUmFuZ2UoKTtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KHJlc3VsdC5zbGljZSgwKSk7XG4gICAgcmVhZGJhY2sudW5tYXAoKTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG5cbiAgY3JlYXRlSW5wdXRCdWZmZXIoZGF0YTogRmxvYXQzMkFycmF5KTogYW55IHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgeyBkZXZpY2UgfSA9IHRoaXMuY29udGV4dDtcbiAgICBjb25zdCBidWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IGRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgIHVzYWdlOiAod2luZG93IGFzIGFueSkuR1BVQnVmZmVyVXNhZ2UuU1RPUkFHRSB8ICh3aW5kb3cgYXMgYW55KS5HUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCxcbiAgICAgIG1hcHBlZEF0Q3JlYXRpb246IHRydWUsXG4gICAgfSk7XG4gICAgbmV3IEZsb2F0MzJBcnJheShidWZmZXIuZ2V0TWFwcGVkUmFuZ2UoKSkuc2V0KGRhdGEpO1xuICAgIGJ1ZmZlci51bm1hcCgpO1xuICAgIHJldHVybiBidWZmZXI7XG4gIH1cblxuICB1cGRhdGVJbnB1dEJ1ZmZlcihidWZmZXI6IGFueSwgZGF0YTogRmxvYXQzMkFycmF5KTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNvbnRleHQgfHwgIWJ1ZmZlcikgcmV0dXJuO1xuICAgIGNvbnN0IHsgZGV2aWNlIH0gPSB0aGlzLmNvbnRleHQ7XG4gICAgaWYgKGRldmljZS5xdWV1ZS53cml0ZUJ1ZmZlcikge1xuICAgICAgZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKGJ1ZmZlciwgMCwgZGF0YSk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgY29tcHV0ZUluZGljYXRvckdQVVdpdGhJbnB1dChcbiAgICB3Z3NsU291cmNlOiBzdHJpbmcsXG4gICAgcGFyYW1zOiBBcnJheUJ1ZmZlcixcbiAgICBpbnB1dEJ1ZmZlcjogYW55LFxuICAgIG91dHB1dExlbmd0aDogbnVtYmVyLFxuICAgIGRhdGFMZW46IG51bWJlclxuICApOiBQcm9taXNlPEZsb2F0MzJBcnJheSB8IG51bGw+IHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCB8fCAhaW5wdXRCdWZmZXIpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IHsgZGV2aWNlIH0gPSB0aGlzLmNvbnRleHQ7XG5cbiAgICBjb25zdCBzaGFkZXIgPSBkZXZpY2UuY3JlYXRlU2hhZGVyTW9kdWxlKHsgY29kZTogd2dzbFNvdXJjZSB9KTtcbiAgICBjb25zdCBwaXBlbGluZSA9IGRldmljZS5jcmVhdGVDb21wdXRlUGlwZWxpbmUoe1xuICAgICAgbGF5b3V0OiAnYXV0bycsXG4gICAgICBjb21wdXRlOiB7IG1vZHVsZTogc2hhZGVyLCBlbnRyeVBvaW50OiAnbWFpbicgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVuaWZvcm1CdWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IHBhcmFtcy5ieXRlTGVuZ3RoLFxuICAgICAgdXNhZ2U6ICh3aW5kb3cgYXMgYW55KS5HUFVCdWZmZXJVc2FnZS5VTklGT1JNIHwgKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxuICAgICAgbWFwcGVkQXRDcmVhdGlvbjogdHJ1ZSxcbiAgICB9KTtcbiAgICBuZXcgVWludDhBcnJheSh1bmlmb3JtQnVmZmVyLmdldE1hcHBlZFJhbmdlKCkpLnNldChuZXcgVWludDhBcnJheShwYXJhbXMpKTtcbiAgICB1bmlmb3JtQnVmZmVyLnVubWFwKCk7XG5cbiAgICBjb25zdCBvdXRwdXRCdWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IG91dHB1dExlbmd0aCAqIDQsXG4gICAgICB1c2FnZTogKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLlNUT1JBR0UgfCAod2luZG93IGFzIGFueSkuR1BVQnVmZmVyVXNhZ2UuQ09QWV9TUkMsXG4gICAgfSk7XG4gICAgY29uc3QgcmVhZGJhY2sgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcbiAgICAgIHNpemU6IG91dHB1dExlbmd0aCAqIDQsXG4gICAgICB1c2FnZTogKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLk1BUF9SRUFEIHwgKHdpbmRvdyBhcyBhbnkpLkdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxuICAgIH0pO1xuXG4gICAgY29uc3QgYmluZEdyb3VwID0gZGV2aWNlLmNyZWF0ZUJpbmRHcm91cCh7XG4gICAgICBsYXlvdXQ6IHBpcGVsaW5lLmdldEJpbmRHcm91cExheW91dCgwKSxcbiAgICAgIGVudHJpZXM6IFtcbiAgICAgICAgeyBiaW5kaW5nOiAwLCByZXNvdXJjZTogeyBidWZmZXI6IGlucHV0QnVmZmVyIH0gfSxcbiAgICAgICAgeyBiaW5kaW5nOiAxLCByZXNvdXJjZTogeyBidWZmZXI6IHVuaWZvcm1CdWZmZXIgfSB9LFxuICAgICAgICB7IGJpbmRpbmc6IDIsIHJlc291cmNlOiB7IGJ1ZmZlcjogb3V0cHV0QnVmZmVyIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBlbmNvZGVyID0gZGV2aWNlLmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XG4gICAgY29uc3QgcGFzcyA9IGVuY29kZXIuYmVnaW5Db21wdXRlUGFzcygpO1xuICAgIHBhc3Muc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgIHBhc3Muc2V0QmluZEdyb3VwKDAsIGJpbmRHcm91cCk7XG4gICAgY29uc3Qgd29ya2dyb3VwU2l6ZSA9IHRoaXMuZ2V0V29ya2dyb3VwU2l6ZSh3Z3NsU291cmNlKTtcbiAgICBjb25zdCB3b3JrZ3JvdXBDb3VudCA9IE1hdGguY2VpbChkYXRhTGVuIC8gd29ya2dyb3VwU2l6ZSk7XG4gICAgcGFzcy5kaXNwYXRjaFdvcmtncm91cHMod29ya2dyb3VwQ291bnQpO1xuICAgIHBhc3MuZW5kKCk7XG4gICAgZW5jb2Rlci5jb3B5QnVmZmVyVG9CdWZmZXIob3V0cHV0QnVmZmVyLCAwLCByZWFkYmFjaywgMCwgb3V0cHV0TGVuZ3RoICogNCk7XG4gICAgZGV2aWNlLnF1ZXVlLnN1Ym1pdChbZW5jb2Rlci5maW5pc2goKV0pO1xuXG4gICAgYXdhaXQgcmVhZGJhY2subWFwQXN5bmMoKHdpbmRvdyBhcyBhbnkpLkdQVU1hcE1vZGUuUkVBRCk7XG4gICAgY29uc3QgcmVzdWx0ID0gcmVhZGJhY2suZ2V0TWFwcGVkUmFuZ2UoKTtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KHJlc3VsdC5zbGljZSgwKSk7XG4gICAgcmVhZGJhY2sudW5tYXAoKTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRXb3JrZ3JvdXBTaXplKHdnc2xTb3VyY2U6IHN0cmluZyk6IG51bWJlciB7XG4gICAgY29uc3QgbWF0Y2ggPSB3Z3NsU291cmNlLm1hdGNoKC93b3JrZ3JvdXBfc2l6ZVxcKChcXGQrKVxcKS8pO1xuICAgIGlmICghbWF0Y2gpIHJldHVybiAyNTY7XG4gICAgY29uc3QgdmFsdWUgPSBOdW1iZXIobWF0Y2hbMV0pO1xuICAgIHJldHVybiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpICYmIHZhbHVlID4gMCA/IHZhbHVlIDogMjU2O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQaXBlbGluZShkZXZpY2U6IEdQVURldmljZSwgZm9ybWF0OiBHUFVUZXh0dXJlRm9ybWF0KTogYW55IHtcbiAgICBjb25zdCBzaGFkZXIgPSBkZXZpY2UuY3JlYXRlU2hhZGVyTW9kdWxlKHtcbiAgICAgIGNvZGU6IGBcbiAgICAgICAgc3RydWN0IFZTT3V0IHtcbiAgICAgICAgICBAYnVpbHRpbihwb3NpdGlvbikgcG9zaXRpb246IHZlYzQ8ZjMyPixcbiAgICAgICAgICBAbG9jYXRpb24oMCkgY29sb3I6IHZlYzQ8ZjMyPixcbiAgICAgICAgfTtcblxuICAgICAgICBAdmVydGV4XG4gICAgICAgIGZuIHZzX21haW4oQGxvY2F0aW9uKDApIHBvczogdmVjMjxmMzI+LCBAbG9jYXRpb24oMSkgY29sb3I6IHZlYzQ8ZjMyPikgLT4gVlNPdXQge1xuICAgICAgICAgIHZhciBvdXQ6IFZTT3V0O1xuICAgICAgICAgIG91dC5wb3NpdGlvbiA9IHZlYzQ8ZjMyPihwb3MsIDAuMCwgMS4wKTtcbiAgICAgICAgICBvdXQuY29sb3IgPSBjb2xvcjtcbiAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICB9XG5cbiAgICAgICAgQGZyYWdtZW50XG4gICAgICAgIGZuIGZzX21haW4oQGxvY2F0aW9uKDApIGNvbG9yOiB2ZWM0PGYzMj4pIC0+IEBsb2NhdGlvbigwKSB2ZWM0PGYzMj4ge1xuICAgICAgICAgIHJldHVybiBjb2xvcjtcbiAgICAgICAgfVxuICAgICAgYCxcbiAgICB9KTtcblxuICAgIHJldHVybiBkZXZpY2UuY3JlYXRlUmVuZGVyUGlwZWxpbmUoe1xuICAgICAgbGF5b3V0OiAnYXV0bycsXG4gICAgICB2ZXJ0ZXg6IHtcbiAgICAgICAgbW9kdWxlOiBzaGFkZXIsXG4gICAgICAgIGVudHJ5UG9pbnQ6ICd2c19tYWluJyxcbiAgICAgICAgYnVmZmVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGFycmF5U3RyaWRlOiAyNCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IFtcbiAgICAgICAgICAgICAgeyBzaGFkZXJMb2NhdGlvbjogMCwgb2Zmc2V0OiAwLCBmb3JtYXQ6ICdmbG9hdDMyeDInIH0sXG4gICAgICAgICAgICAgIHsgc2hhZGVyTG9jYXRpb246IDEsIG9mZnNldDogOCwgZm9ybWF0OiAnZmxvYXQzMng0JyB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIGZyYWdtZW50OiB7XG4gICAgICAgIG1vZHVsZTogc2hhZGVyLFxuICAgICAgICBlbnRyeVBvaW50OiAnZnNfbWFpbicsXG4gICAgICAgIHRhcmdldHM6IFt7IGZvcm1hdCB9XSxcbiAgICAgIH0sXG4gICAgICBwcmltaXRpdmU6IHsgdG9wb2xvZ3k6ICd0cmlhbmdsZS1saXN0JyB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVMaW5lUGlwZWxpbmUoZGV2aWNlOiBHUFVEZXZpY2UsIGZvcm1hdDogR1BVVGV4dHVyZUZvcm1hdCk6IGFueSB7XG4gICAgY29uc3Qgc2hhZGVyID0gZGV2aWNlLmNyZWF0ZVNoYWRlck1vZHVsZSh7XG4gICAgICBjb2RlOiBgXG4gICAgICAgIHN0cnVjdCBWU091dCB7XG4gICAgICAgICAgQGJ1aWx0aW4ocG9zaXRpb24pIHBvc2l0aW9uOiB2ZWM0PGYzMj4sXG4gICAgICAgICAgQGxvY2F0aW9uKDApIGNvbG9yOiB2ZWM0PGYzMj4sXG4gICAgICAgIH07XG5cbiAgICAgICAgQHZlcnRleFxuICAgICAgICBmbiB2c19tYWluKEBsb2NhdGlvbigwKSBwb3M6IHZlYzI8ZjMyPiwgQGxvY2F0aW9uKDEpIGNvbG9yOiB2ZWM0PGYzMj4pIC0+IFZTT3V0IHtcbiAgICAgICAgICB2YXIgb3V0OiBWU091dDtcbiAgICAgICAgICBvdXQucG9zaXRpb24gPSB2ZWM0PGYzMj4ocG9zLCAwLjAsIDEuMCk7XG4gICAgICAgICAgb3V0LmNvbG9yID0gY29sb3I7XG4gICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgfVxuXG4gICAgICAgIEBmcmFnbWVudFxuICAgICAgICBmbiBmc19tYWluKEBsb2NhdGlvbigwKSBjb2xvcjogdmVjNDxmMzI+KSAtPiBAbG9jYXRpb24oMCkgdmVjNDxmMzI+IHtcbiAgICAgICAgICByZXR1cm4gY29sb3I7XG4gICAgICAgIH1cbiAgICAgIGAsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGV2aWNlLmNyZWF0ZVJlbmRlclBpcGVsaW5lKHtcbiAgICAgIGxheW91dDogJ2F1dG8nLFxuICAgICAgdmVydGV4OiB7XG4gICAgICAgIG1vZHVsZTogc2hhZGVyLFxuICAgICAgICBlbnRyeVBvaW50OiAndnNfbWFpbicsXG4gICAgICAgIGJ1ZmZlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBhcnJheVN0cmlkZTogMjQsXG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBbXG4gICAgICAgICAgICAgIHsgc2hhZGVyTG9jYXRpb246IDAsIG9mZnNldDogMCwgZm9ybWF0OiAnZmxvYXQzMngyJyB9LFxuICAgICAgICAgICAgICB7IHNoYWRlckxvY2F0aW9uOiAxLCBvZmZzZXQ6IDgsIGZvcm1hdDogJ2Zsb2F0MzJ4NCcgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBmcmFnbWVudDoge1xuICAgICAgICBtb2R1bGU6IHNoYWRlcixcbiAgICAgICAgZW50cnlQb2ludDogJ2ZzX21haW4nLFxuICAgICAgICB0YXJnZXRzOiBbeyBmb3JtYXQgfV0sXG4gICAgICB9LFxuICAgICAgcHJpbWl0aXZlOiB7IHRvcG9sb2d5OiAnbGluZS1saXN0JyB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZEdlb21ldHJ5KCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb250ZXh0IHx8ICF0aGlzLmRhdGEubGVuZ3RoKSByZXR1cm47XG5cbiAgICBjb25zdCB7IGRldmljZSB9ID0gdGhpcy5jb250ZXh0O1xuICAgIGNvbnN0IGNvdW50ID0gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICBjb25zdCBtaW5QcmljZSA9IE1hdGgubWluKC4uLnRoaXMuZGF0YS5tYXAoKGQpID0+IGQubG93KSk7XG4gICAgY29uc3QgbWF4UHJpY2UgPSBNYXRoLm1heCguLi50aGlzLmRhdGEubWFwKChkKSA9PiBkLmhpZ2gpKTtcbiAgICBjb25zdCByYW5nZSA9IG1heFByaWNlIC0gbWluUHJpY2UgfHwgMTtcbiAgICBjb25zdCBjYW5kbGVXaWR0aCA9IDIgLyBNYXRoLm1heCgxLCBjb3VudCk7XG4gICAgY29uc3Qgd2lja1dpZHRoID0gY2FuZGxlV2lkdGggKiAwLjI7XG5cbiAgICAvLyBjb21wZW5zYXRlIGZvciBub24tc3F1YXJlIGNhbnZhczogc2NhbGUgWCBjb29yZGluYXRlcyBzbyBjYW5kbGVzIGtlZXAgY29ycmVjdCBhc3BlY3RcbiAgICBjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhcyBhcyBIVE1MQ2FudmFzRWxlbWVudDtcbiAgICBjb25zdCBhc3BlY3RDb3JyZWN0aW9uID0gY2FudmFzICYmIGNhbnZhcy53aWR0aCAmJiBjYW52YXMuaGVpZ2h0ID8gY2FudmFzLmhlaWdodCAvIGNhbnZhcy53aWR0aCA6IDE7XG5cbiAgICBjb25zdCB2ZXJ0aWNlczogbnVtYmVyW10gPSBbXTtcbiAgICBjb25zdCBjb2xvclVwID0gdGhpcy5jb2xvcnMudXA7XG4gICAgY29uc3QgY29sb3JEb3duID0gdGhpcy5jb2xvcnMuZG93bjtcbiAgICBjb25zdCBjb2xvcldpY2sgPSB0aGlzLmNvbG9ycy53aWNrO1xuXG4gICAgY29uc3QgdG9YID0gKGk6IG51bWJlcikgPT4gKC0xICsgY2FuZGxlV2lkdGggKiBpICsgY2FuZGxlV2lkdGggKiAwLjUpICogYXNwZWN0Q29ycmVjdGlvbjtcbiAgICBjb25zdCB0b1kgPSAocHJpY2U6IG51bWJlcikgPT4gKChwcmljZSAtIG1pblByaWNlKSAvIHJhbmdlKSAqIDIgLSAxO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICBjb25zdCBkID0gdGhpcy5kYXRhW2ldO1xuICAgICAgY29uc3QgeCA9IHRvWChpKTtcbiAgICAgIGNvbnN0IGJvZHlIYWxmID0gY2FuZGxlV2lkdGggKiAwLjQgKiBhc3BlY3RDb3JyZWN0aW9uO1xuICAgICAgY29uc3Qgd2lja0hhbGYgPSB3aWNrV2lkdGggKiAwLjUgKiBhc3BlY3RDb3JyZWN0aW9uO1xuICAgICAgY29uc3Qgb3BlblkgPSB0b1koZC5vcGVuKTtcbiAgICAgIGNvbnN0IGNsb3NlWSA9IHRvWShkLmNsb3NlKTtcbiAgICAgIGNvbnN0IGhpZ2hZID0gdG9ZKGQuaGlnaCk7XG4gICAgICBjb25zdCBsb3dZID0gdG9ZKGQubG93KTtcbiAgICAgIGNvbnN0IHRvcCA9IE1hdGgubWF4KG9wZW5ZLCBjbG9zZVkpO1xuICAgICAgY29uc3QgYm90dG9tID0gTWF0aC5taW4ob3BlblksIGNsb3NlWSk7XG4gICAgICBjb25zdCBib2R5Q29sb3IgPSBkLmNsb3NlID49IGQub3BlbiA/IGNvbG9yVXAgOiBjb2xvckRvd247XG5cbiAgICAgIC8vIGJvZHkgcXVhZCAodHdvIHRyaWFuZ2xlcylcbiAgICAgIHB1c2hRdWFkKHZlcnRpY2VzLCB4IC0gYm9keUhhbGYsIGJvdHRvbSwgeCArIGJvZHlIYWxmLCB0b3AsIGJvZHlDb2xvcik7XG4gICAgICAvLyB3aWNrIHF1YWQgKHRoaW4pXG4gICAgICBwdXNoUXVhZCh2ZXJ0aWNlcywgeCAtIHdpY2tIYWxmLCBsb3dZLCB4ICsgd2lja0hhbGYsIGhpZ2hZLCBjb2xvcldpY2spO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRpY2VzKTtcbiAgICB0aGlzLnZlcnRleENvdW50ID0gZGF0YS5sZW5ndGggLyA2O1xuICAgIGlmICghdGhpcy52ZXJ0ZXhCdWZmZXIgfHwgdGhpcy52ZXJ0ZXhCdWZmZXJTaXplICE9PSBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gZGV2aWNlLmNyZWF0ZUJ1ZmZlcih7XG4gICAgICAgIHNpemU6IGRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgICAgdXNhZ2U6ICh3aW5kb3cgYXMgYW55KS5HUFVCdWZmZXJVc2FnZS5WRVJURVggfCAod2luZG93IGFzIGFueSkuR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXG4gICAgICAgIG1hcHBlZEF0Q3JlYXRpb246IHRydWUsXG4gICAgICB9KTtcbiAgICAgIG5ldyBGbG9hdDMyQXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXIuZ2V0TWFwcGVkUmFuZ2UoKSkuc2V0KGRhdGEpO1xuICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXIudW5tYXAoKTtcbiAgICAgIHRoaXMudmVydGV4QnVmZmVyU2l6ZSA9IGRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9IGVsc2UgaWYgKGRldmljZS5xdWV1ZS53cml0ZUJ1ZmZlcikge1xuICAgICAgZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKHRoaXMudmVydGV4QnVmZmVyLCAwLCBkYXRhKTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgcHVzaFF1YWQgPSAoXG4gIG91dDogbnVtYmVyW10sXG4gIHgwOiBudW1iZXIsXG4gIHkwOiBudW1iZXIsXG4gIHgxOiBudW1iZXIsXG4gIHkxOiBudW1iZXIsXG4gIGNvbG9yOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlciwgbnVtYmVyXVxuKSA9PiB7XG4gIC8vIHRyaSAxXG4gIG91dC5wdXNoKHgwLCB5MCwgLi4uY29sb3IpO1xuICBvdXQucHVzaCh4MSwgeTAsIC4uLmNvbG9yKTtcbiAgb3V0LnB1c2goeDEsIHkxLCAuLi5jb2xvcik7XG4gIC8vIHRyaSAyXG4gIG91dC5wdXNoKHgwLCB5MCwgLi4uY29sb3IpO1xuICBvdXQucHVzaCh4MSwgeTEsIC4uLmNvbG9yKTtcbiAgb3V0LnB1c2goeDAsIHkxLCAuLi5jb2xvcik7XG59O1xuIiwKICAiaW1wb3J0IHR5cGUgeyBJbmRpY2F0b3JEZWZpbml0aW9uIH0gZnJvbSAnLi9pbmRpY2F0b3JUeXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kaWNhdG9yUmVnaXN0cnkge1xuICByZWdpc3RlcihpbmRpY2F0b3I6IEluZGljYXRvckRlZmluaXRpb248YW55LCBhbnk+KTogdm9pZDtcbiAgZ2V0KGlkOiBzdHJpbmcpOiBJbmRpY2F0b3JEZWZpbml0aW9uIHwgdW5kZWZpbmVkO1xuICBsaXN0QWxsKCk6IEluZGljYXRvckRlZmluaXRpb25bXTtcbiAgbGlzdEJ5Q2F0ZWdvcnkoY2F0ZWdvcnk6IEluZGljYXRvckRlZmluaXRpb25bJ2NhdGVnb3J5J10pOiBJbmRpY2F0b3JEZWZpbml0aW9uW107XG4gIGxpc3RHUFVFbmFibGVkKCk6IEluZGljYXRvckRlZmluaXRpb25bXTtcbiAgcmVzb2x2ZURlcGVuZGVuY2llcyhpZHM6IHN0cmluZ1tdKTogSW5kaWNhdG9yRGVmaW5pdGlvbltdO1xufVxuXG5leHBvcnQgY2xhc3MgSW5NZW1vcnlJbmRpY2F0b3JSZWdpc3RyeSBpbXBsZW1lbnRzIEluZGljYXRvclJlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBkZWZzID0gbmV3IE1hcDxzdHJpbmcsIEluZGljYXRvckRlZmluaXRpb24+KCk7XG5cbiAgcmVnaXN0ZXIoZGVmaW5pdGlvbjogSW5kaWNhdG9yRGVmaW5pdGlvbjxhbnksIGFueT4pOiB2b2lkIHtcbiAgICB0aGlzLmRlZnMuc2V0KGRlZmluaXRpb24uaWQsIGRlZmluaXRpb24pO1xuICB9XG5cbiAgZ2V0KGlkOiBzdHJpbmcpOiBJbmRpY2F0b3JEZWZpbml0aW9uIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5kZWZzLmdldChpZCk7XG4gIH1cblxuICBsaXN0QWxsKCk6IEluZGljYXRvckRlZmluaXRpb25bXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5kZWZzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGxpc3RCeUNhdGVnb3J5KGNhdGVnb3J5OiBJbmRpY2F0b3JEZWZpbml0aW9uWydjYXRlZ29yeSddKTogSW5kaWNhdG9yRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gdGhpcy5saXN0QWxsKCkuZmlsdGVyKChkZWYpID0+IGRlZi5jYXRlZ29yeSA9PT0gY2F0ZWdvcnkpO1xuICB9XG5cbiAgbGlzdEdQVUVuYWJsZWQoKTogSW5kaWNhdG9yRGVmaW5pdGlvbltdIHtcbiAgICByZXR1cm4gdGhpcy5saXN0QWxsKCkuZmlsdGVyKChkZWYpID0+IEJvb2xlYW4oZGVmLmNhbGN1bGF0ZUdQVSB8fCBkZWYud2dzbFNvdXJjZSkpO1xuICB9XG5cbiAgcmVzb2x2ZURlcGVuZGVuY2llcyhpZHM6IHN0cmluZ1tdKTogSW5kaWNhdG9yRGVmaW5pdGlvbltdIHtcbiAgICBjb25zdCByZXNvbHZlZDogSW5kaWNhdG9yRGVmaW5pdGlvbltdID0gW107XG4gICAgY29uc3QgdmlzaXRpbmcgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBjb25zdCB2aXNpdCA9IChpZDogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAodmlzaXRlZC5oYXMoaWQpKSByZXR1cm47XG4gICAgICBpZiAodmlzaXRpbmcuaGFzKGlkKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENpcmN1bGFyIGRlcGVuZGVuY3kgZGV0ZWN0ZWQgZm9yIGluZGljYXRvcjogJHtpZH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGVmID0gdGhpcy5nZXQoaWQpO1xuICAgICAgaWYgKCFkZWYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmRpY2F0b3Igbm90IGZvdW5kOiAke2lkfWApO1xuICAgICAgfVxuXG4gICAgICB2aXNpdGluZy5hZGQoaWQpO1xuICAgICAgZm9yIChjb25zdCBkZXAgb2YgZGVmLmRlcGVuZGVuY2llcyA/PyBbXSkge1xuICAgICAgICB2aXNpdChkZXApO1xuICAgICAgfVxuICAgICAgdmlzaXRpbmcuZGVsZXRlKGlkKTtcbiAgICAgIHZpc2l0ZWQuYWRkKGlkKTtcbiAgICAgIHJlc29sdmVkLnB1c2goZGVmKTtcbiAgICB9O1xuXG4gICAgaWRzLmZvckVhY2godmlzaXQpO1xuICAgIHJldHVybiByZXNvbHZlZDtcbiAgfVxufVxuIiwKICAiZXhwb3J0IGNvbnN0IFNDSEVNQV9WRVJTSU9OID0gMiBhcyBjb25zdDtcblxudHlwZSBHUFVEZXZpY2UgPSB1bmtub3duO1xuXG5leHBvcnQgdHlwZSBJbmRpY2F0b3JWYWx1ZSA9IG51bWJlciB8IG51bGw7XG5cbmV4cG9ydCB0eXBlIFBsb3RTdHlsZSA9XG4gIHwgJ2xpbmUnXG4gIHwgJ2hpc3RvZ3JhbSdcbiAgfCAnYXJlYSdcbiAgfCAnYmFuZCdcbiAgfCAnbWFya2VyJ1xuICB8ICdjbG91ZCdcbiAgfCAnYmFyJ1xuICB8ICdjYW5kbGUnO1xuXG5leHBvcnQgdHlwZSBQbG90UGFuZSA9ICdtYWluJyB8ICdzdWIxJyB8ICdzdWIyJyB8ICdzdWIzJztcblxuZXhwb3J0IHR5cGUgWkxheWVyID0gMCB8IDEwIHwgMjAgfCAzMCB8IDQwIHwgNTA7XG5cbmV4cG9ydCB0eXBlIFNlcmllc1N0eWxlID0ge1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbG9yOiBzdHJpbmc7XG4gIGxpbmVXaWR0aD86IG51bWJlcjtcbiAgc3R5bGU6IFBsb3RTdHlsZTtcbiAgb3BhY2l0eT86IG51bWJlcjtcbiAgZmlsbFRvPzogc3RyaW5nIHwgbnVtYmVyO1xuICB6TGF5ZXI/OiBaTGF5ZXI7XG4gIGFudGlhbGlhcz86IGJvb2xlYW47XG59O1xuXG5leHBvcnQgdHlwZSBJbmRpY2F0b3JQYXJhbVNjaGVtYTxUPiA9IHtcbiAgW0sgaW4ga2V5b2YgVF06IHtcbiAgICB0eXBlOiAnbnVtYmVyJyB8ICdzdHJpbmcnIHwgJ2Jvb2xlYW4nIHwgJ3NlbGVjdCc7XG4gICAgZGVmYXVsdDogVFtLXTtcbiAgICBsYWJlbDogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIG1pbj86IG51bWJlcjtcbiAgICBtYXg/OiBudW1iZXI7XG4gICAgc3RlcD86IG51bWJlcjtcbiAgICBvcHRpb25zPzogeyB2YWx1ZTogdW5rbm93bjsgbGFiZWw6IHN0cmluZyB9W107XG4gIH07XG59O1xuXG5leHBvcnQgdHlwZSBJbmRpY2F0b3JFcnJvciA9IHtcbiAgY29kZTogJ0lOU1VGRklDSUVOVF9EQVRBJyB8ICdJTlZBTElEX1BBUkFNUycgfCAnR1BVX0VSUk9SJyB8ICdDT01QVVRBVElPTl9FUlJPUic7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZGV0YWlscz86IHVua25vd247XG59O1xuXG5leHBvcnQgdHlwZSBJbmRpY2F0b3JSZXN1bHQ8VD4gPVxuICB8IHsgb2s6IHRydWU7IHZhbHVlOiBUIH1cbiAgfCB7IG9rOiBmYWxzZTsgZXJyb3I6IEluZGljYXRvckVycm9yIH07XG5cbmV4cG9ydCB0eXBlIE11bHRpU2VyaWVzT3V0cHV0ID0gUmVjb3JkPHN0cmluZywgSW5kaWNhdG9yVmFsdWVbXT47XG5cbmV4cG9ydCB0eXBlIEluZGljYXRvckFsZXJ0ID0ge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbmRpdGlvbjogKFxuICAgIHZhbHVlczogUmVjb3JkPHN0cmluZywgSW5kaWNhdG9yVmFsdWU+LFxuICAgIGJhcjogdW5rbm93bixcbiAgICBwcmV2VmFsdWVzPzogUmVjb3JkPHN0cmluZywgSW5kaWNhdG9yVmFsdWU+XG4gICkgPT4gYm9vbGVhbjtcbiAgbWVzc2FnZTogKHZhbHVlczogUmVjb3JkPHN0cmluZywgSW5kaWNhdG9yVmFsdWU+LCBiYXI6IHVua25vd24pID0+IHN0cmluZztcbiAgc2V2ZXJpdHk6ICdpbmZvJyB8ICd3YXJuaW5nJyB8ICdjcml0aWNhbCc7XG4gIGNvb2xkb3duPzogbnVtYmVyO1xufTtcblxuZXhwb3J0IHR5cGUgSW5kaWNhdG9yRGVmaW5pdGlvbjxUUGFyYW1zID0gUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIFRCYXIgPSB1bmtub3duPiA9IHtcbiAgc2NoZW1hVmVyc2lvbjogdHlwZW9mIFNDSEVNQV9WRVJTSU9OO1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIG5hbWVLZXk/OiBzdHJpbmc7XG4gIGNhdGVnb3J5OiAndHJlbmQnIHwgJ21vbWVudHVtJyB8ICd2b2xhdGlsaXR5JyB8ICd2b2x1bWUnIHwgJ2N1c3RvbSc7XG4gIHBhbmU6IFBsb3RQYW5lO1xuICBvdXRwdXRzOiBTZXJpZXNTdHlsZVtdO1xuICBwYXJhbXM6IEluZGljYXRvclBhcmFtU2NoZW1hPFRQYXJhbXM+O1xuICBkZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgY2FsY3VsYXRlOiAoZGF0YTogVEJhcltdLCBwYXJhbXM6IFRQYXJhbXMpID0+IEluZGljYXRvclJlc3VsdDxNdWx0aVNlcmllc091dHB1dD47XG4gIGNhbGN1bGF0ZUdQVT86IChcbiAgICBidWZmZXI6IEZsb2F0MzJBcnJheSxcbiAgICBwYXJhbXM6IFRQYXJhbXMsXG4gICAgZGV2aWNlOiBHUFVEZXZpY2VcbiAgKSA9PiBQcm9taXNlPEluZGljYXRvclJlc3VsdDxSZWNvcmQ8c3RyaW5nLCBGbG9hdDMyQXJyYXk+Pj47XG4gIHdnc2xTb3VyY2U/OiBzdHJpbmc7XG4gIHVwZGF0ZT86IChcbiAgICBwcmV2U3RhdGU6IHVua25vd24sXG4gICAgbmV3QmFyOiBUQmFyLFxuICAgIHBhcmFtczogVFBhcmFtc1xuICApID0+IEluZGljYXRvclJlc3VsdDx7IHN0YXRlOiB1bmtub3duOyB2YWx1ZXM6IFJlY29yZDxzdHJpbmcsIEluZGljYXRvclZhbHVlPiB9PjtcbiAgeVJhbmdlPzogeyBtaW46IG51bWJlcjsgbWF4OiBudW1iZXIgfTtcbiAgaG9yaXpvbnRhbExpbmVzPzogeyB2YWx1ZTogbnVtYmVyOyBjb2xvcjogc3RyaW5nOyBkYXNoZWQ/OiBib29sZWFuIH1bXTtcbiAgYWxlcnRzPzogSW5kaWNhdG9yQWxlcnRbXTtcbiAgY29tcGxleGl0eToge1xuICAgIHRpbWU6ICdPKG4pJyB8ICdPKG4gbG9nIG4pJyB8ICdPKG7CsiknO1xuICAgIHNwYWNlOiAnTygxKScgfCAnTyhuKScgfCAnTyhuwrIpJztcbiAgfTtcbiAgd2FybXVwUGVyaW9kOiAocGFyYW1zOiBUUGFyYW1zKSA9PiBudW1iZXI7XG59O1xuIiwKICAiaW1wb3J0IHR5cGUgeyBPaGxjdlBvaW50IH0gZnJvbSAnLi4vY29yZS90eXBlcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEluZGljYXRvckRlZmluaXRpb24sXG4gIEluZGljYXRvclJlc3VsdCxcbiAgSW5kaWNhdG9yVmFsdWUsXG4gIE11bHRpU2VyaWVzT3V0cHV0LFxufSBmcm9tICcuLi9jb3JlL2luZGljYXRvclR5cGVzJztcbmltcG9ydCB7IFNDSEVNQV9WRVJTSU9OIH0gZnJvbSAnLi4vY29yZS9pbmRpY2F0b3JUeXBlcyc7XG5pbXBvcnQgdHlwZSB7IEluZGljYXRvclJlZ2lzdHJ5IH0gZnJvbSAnLi4vY29yZS9pbmRpY2F0b3JzJztcblxuY29uc3Qgb2sgPSAodmFsdWU6IE11bHRpU2VyaWVzT3V0cHV0KTogSW5kaWNhdG9yUmVzdWx0PE11bHRpU2VyaWVzT3V0cHV0PiA9PiAoeyBvazogdHJ1ZSwgdmFsdWUgfSk7XG5jb25zdCBmYWlsID0gKG1lc3NhZ2U6IHN0cmluZyk6IEluZGljYXRvclJlc3VsdDxNdWx0aVNlcmllc091dHB1dD4gPT4gKHtcbiAgb2s6IGZhbHNlLFxuICBlcnJvcjogeyBjb2RlOiAnQ09NUFVUQVRJT05fRVJST1InLCBtZXNzYWdlIH0sXG59KTtcblxuZXhwb3J0IGNvbnN0IFNNQTogSW5kaWNhdG9yRGVmaW5pdGlvbjx7IHBlcmlvZDogbnVtYmVyIH0sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICdzbWEnLFxuICBuYW1lOiAnU01BJyxcbiAgY2F0ZWdvcnk6ICd0cmVuZCcsXG4gIHBhbmU6ICdtYWluJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ3NtYScsIGNvbG9yOiAnIzRFQ0RDNCcsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMSwgekxheWVyOiAzMCB9XSxcbiAgcGFyYW1zOiB7XG4gICAgcGVyaW9kOiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAyMCwgbGFiZWw6ICdQZXJpb2QnLCBtaW46IDIsIG1heDogMjAwIH0sXG4gIH0sXG4gIGNvbXBsZXhpdHk6IHsgdGltZTogJ08obiknLCBzcGFjZTogJ08obiknIH0sXG4gIHdhcm11cFBlcmlvZDogKHsgcGVyaW9kIH0pID0+IHBlcmlvZCAtIDEsXG4gIGNhbGN1bGF0ZShkYXRhLCB7IHBlcmlvZCB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNtYTogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgbGV0IHN1bSA9IDA7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3VtICs9IGRhdGFbaV0uY2xvc2U7XG4gICAgICAgIGlmIChpID49IHBlcmlvZCkgc3VtIC09IGRhdGFbaSAtIHBlcmlvZF0uY2xvc2U7XG4gICAgICAgIGlmIChpIDwgcGVyaW9kIC0gMSkge1xuICAgICAgICAgIHNtYS5wdXNoKG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNtYS5wdXNoKHN1bSAvIHBlcmlvZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IHNtYSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbiAgd2dzbFNvdXJjZTogYFxuICAgIHN0cnVjdCBQYXJhbXMgeyBwZXJpb2Q6IHUzMiwgZGF0YV9sZW46IHUzMiB9O1xuICAgIEBncm91cCgwKSBAYmluZGluZygwKSB2YXI8c3RvcmFnZSwgcmVhZD4gb2hsY3Y6IGFycmF5PGYzMj47XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDEpIHZhcjx1bmlmb3JtPiBwYXJhbXM6IFBhcmFtcztcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMikgdmFyPHN0b3JhZ2UsIHJlYWRfd3JpdGU+IG91dHB1dDogYXJyYXk8ZjMyPjtcbiAgICBAY29tcHV0ZSBAd29ya2dyb3VwX3NpemUoMjU2KVxuICAgIGZuIG1haW4oQGJ1aWx0aW4oZ2xvYmFsX2ludm9jYXRpb25faWQpIGdpZDogdmVjMzx1MzI+KSB7XG4gICAgICBsZXQgaWR4ID0gZ2lkLng7XG4gICAgICBpZiAoaWR4ID49IHBhcmFtcy5kYXRhX2xlbikgeyByZXR1cm47IH1cbiAgICAgIGlmIChpZHggPCBwYXJhbXMucGVyaW9kIC0gMXUpIHtcbiAgICAgICAgb3V0cHV0W2lkeF0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgc3VtOiBmMzIgPSAwLjA7XG4gICAgICBmb3IgKHZhciBqOiB1MzIgPSAwdTsgaiA8IHBhcmFtcy5wZXJpb2Q7IGorKykge1xuICAgICAgICBsZXQgY2xvc2VfaWR4ID0gKGlkeCAtIHBhcmFtcy5wZXJpb2QgKyAxdSArIGopICogNnUgKyA0dTtcbiAgICAgICAgc3VtICs9IG9obGN2W2Nsb3NlX2lkeF07XG4gICAgICB9XG4gICAgICBvdXRwdXRbaWR4XSA9IHN1bSAvIGYzMihwYXJhbXMucGVyaW9kKTtcbiAgICB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgRU1BOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ2VtYScsXG4gIG5hbWU6ICdFTUEnLFxuICBjYXRlZ29yeTogJ3RyZW5kJyxcbiAgcGFuZTogJ21haW4nLFxuICBvdXRwdXRzOiBbeyBuYW1lOiAnZW1hJywgY29sb3I6ICcjRkZCNzAzJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLCB6TGF5ZXI6IDMwIH1dLFxuICBwYXJhbXM6IHtcbiAgICBwZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDIwLCBsYWJlbDogJ1BlcmlvZCcsIG1pbjogMiwgbWF4OiAyMDAgfSxcbiAgfSxcbiAgY29tcGxleGl0eTogeyB0aW1lOiAnTyhuKScsIHNwYWNlOiAnTyhuKScgfSxcbiAgd2FybXVwUGVyaW9kOiAoeyBwZXJpb2QgfSkgPT4gcGVyaW9kIC0gMSxcbiAgY2FsY3VsYXRlKGRhdGEsIHsgcGVyaW9kIH0pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW1hOiBJbmRpY2F0b3JWYWx1ZVtdID0gW107XG4gICAgICBjb25zdCBrID0gMiAvIChwZXJpb2QgKyAxKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgIGVtYS5wdXNoKGRhdGFbaV0uY2xvc2UpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHByZXYgPSBlbWFbaSAtIDFdID8/IGRhdGFbaSAtIDFdLmNsb3NlO1xuICAgICAgICBlbWEucHVzaChkYXRhW2ldLmNsb3NlICogayArIChwcmV2IGFzIG51bWJlcikgKiAoMSAtIGspKTtcbiAgICAgIH1cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGVyaW9kIC0gMTsgaSsrKSB7XG4gICAgICAgIGVtYVtpXSA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2soeyBlbWEgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhaWwoU3RyaW5nKGUpKTtcbiAgICB9XG4gIH0sXG4gIHdnc2xTb3VyY2U6IGBcbiAgICBzdHJ1Y3QgUGFyYW1zIHsgcGVyaW9kOiB1MzIsIGRhdGFfbGVuOiB1MzIgfTtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMCkgdmFyPHN0b3JhZ2UsIHJlYWQ+IG9obGN2OiBhcnJheTxmMzI+O1xuICAgIEBncm91cCgwKSBAYmluZGluZygxKSB2YXI8dW5pZm9ybT4gcGFyYW1zOiBQYXJhbXM7XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDIpIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBvdXRwdXQ6IGFycmF5PGYzMj47XG4gICAgQGNvbXB1dGUgQHdvcmtncm91cF9zaXplKDEpXG4gICAgZm4gbWFpbigpIHtcbiAgICAgIGxldCBuID0gcGFyYW1zLmRhdGFfbGVuO1xuICAgICAgaWYgKG4gPT0gMHUpIHsgcmV0dXJuOyB9XG4gICAgICBsZXQgayA9IDIuMCAvIChmMzIocGFyYW1zLnBlcmlvZCkgKyAxLjApO1xuICAgICAgb3V0cHV0WzB1XSA9IG9obGN2WzR1XTtcbiAgICAgIGZvciAodmFyIGk6IHUzMiA9IDF1OyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIGxldCBjbG9zZSA9IG9obGN2W2kgKiA2dSArIDR1XTtcbiAgICAgICAgb3V0cHV0W2ldID0gY2xvc2UgKiBrICsgb3V0cHV0W2kgLSAxdV0gKiAoMS4wIC0gayk7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBpOiB1MzIgPSAwdTsgaSA8IHBhcmFtcy5wZXJpb2QgLSAxdSAmJiBpIDwgbjsgaSsrKSB7XG4gICAgICAgIG91dHB1dFtpXSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICB9XG4gICAgfVxuICBgLFxufTtcblxuZXhwb3J0IGNvbnN0IEJvbGxpbmdlckJhbmRzOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXI7IHN0ZERldjogbnVtYmVyIH0sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICdiYicsXG4gIG5hbWU6ICdCb2xsaW5nZXIgQmFuZHMnLFxuICBjYXRlZ29yeTogJ3ZvbGF0aWxpdHknLFxuICBwYW5lOiAnbWFpbicsXG4gIG91dHB1dHM6IFtcbiAgICB7IG5hbWU6ICd1cHBlcicsIGNvbG9yOiAnIzIxOTZGMycsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMSwgekxheWVyOiAzMCB9LFxuICAgIHsgbmFtZTogJ21pZGRsZScsIGNvbG9yOiAnIzlFOUU5RScsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMSwgekxheWVyOiAzMCB9LFxuICAgIHsgbmFtZTogJ2xvd2VyJywgY29sb3I6ICcjMjE5NkYzJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAnZmlsbCcsIGNvbG9yOiAncmdiYSgzMywxNTAsMjQzLDAuMSknLCBzdHlsZTogJ2JhbmQnLCBmaWxsVG86ICdsb3dlcicsIHpMYXllcjogMTAgfSxcbiAgXSxcbiAgcGFyYW1zOiB7XG4gICAgcGVyaW9kOiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAyMCwgbGFiZWw6ICdQZXJpb2QnLCBtaW46IDUsIG1heDogMTAwIH0sXG4gICAgc3RkRGV2OiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAyLjAsIGxhYmVsOiAnU3RkIERldicsIG1pbjogMC41LCBtYXg6IDQuMCwgc3RlcDogMC4xIH0sXG4gIH0sXG4gIGNvbXBsZXhpdHk6IHsgdGltZTogJ08obiknLCBzcGFjZTogJ08obiknIH0sXG4gIHdhcm11cFBlcmlvZDogKHsgcGVyaW9kIH0pID0+IHBlcmlvZCAtIDEsXG4gIGNhbGN1bGF0ZShkYXRhLCB7IHBlcmlvZCwgc3RkRGV2IH0pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdXBwZXI6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGNvbnN0IG1pZGRsZTogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgY29uc3QgbG93ZXI6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA8IHBlcmlvZCAtIDEpIHtcbiAgICAgICAgICB1cHBlci5wdXNoKG51bGwpO1xuICAgICAgICAgIG1pZGRsZS5wdXNoKG51bGwpO1xuICAgICAgICAgIGxvd2VyLnB1c2gobnVsbCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2xpY2UgPSBkYXRhLnNsaWNlKGkgLSBwZXJpb2QgKyAxLCBpICsgMSk7XG4gICAgICAgIGNvbnN0IGNsb3NlcyA9IHNsaWNlLm1hcCgoZCkgPT4gZC5jbG9zZSk7XG4gICAgICAgIGNvbnN0IHNtYSA9IGNsb3Nlcy5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIHBlcmlvZDtcbiAgICAgICAgY29uc3QgdmFyaWFuY2UgPSBjbG9zZXMucmVkdWNlKChhLCBiKSA9PiBhICsgKGIgLSBzbWEpICoqIDIsIDApIC8gcGVyaW9kO1xuICAgICAgICBjb25zdCBzdGQgPSBNYXRoLnNxcnQodmFyaWFuY2UpO1xuICAgICAgICBtaWRkbGUucHVzaChzbWEpO1xuICAgICAgICB1cHBlci5wdXNoKHNtYSArIHN0ZERldiAqIHN0ZCk7XG4gICAgICAgIGxvd2VyLnB1c2goc21hIC0gc3RkRGV2ICogc3RkKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IHVwcGVyLCBtaWRkbGUsIGxvd2VyLCBmaWxsOiB1cHBlciB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbiAgd2dzbFNvdXJjZTogYFxuICAgIHN0cnVjdCBQYXJhbXMgeyBwZXJpb2Q6IHUzMiwgc3RkX2RldjogZjMyLCBkYXRhX2xlbjogdTMyIH07XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDApIHZhcjxzdG9yYWdlLCByZWFkPiBvaGxjdjogYXJyYXk8ZjMyPjtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMSkgdmFyPHVuaWZvcm0+IHBhcmFtczogUGFyYW1zO1xuICAgIEBncm91cCgwKSBAYmluZGluZygyKSB2YXI8c3RvcmFnZSwgcmVhZF93cml0ZT4gb3V0cHV0OiBhcnJheTxmMzI+O1xuICAgIEBjb21wdXRlIEB3b3JrZ3JvdXBfc2l6ZSgyNTYpXG4gICAgZm4gbWFpbihAYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCkgZ2lkOiB2ZWMzPHUzMj4pIHtcbiAgICAgIGxldCBpZHggPSBnaWQueDtcbiAgICAgIGlmIChpZHggPj0gcGFyYW1zLmRhdGFfbGVuKSB7IHJldHVybjsgfVxuICAgICAgaWYgKGlkeCA8IHBhcmFtcy5wZXJpb2QgLSAxdSkge1xuICAgICAgICBvdXRwdXRbaWR4ICogM3UgKyAwdV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICBvdXRwdXRbaWR4ICogM3UgKyAxdV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICBvdXRwdXRbaWR4ICogM3UgKyAydV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgc3VtOiBmMzIgPSAwLjA7XG4gICAgICBmb3IgKHZhciBqOiB1MzIgPSAwdTsgaiA8IHBhcmFtcy5wZXJpb2Q7IGorKykge1xuICAgICAgICBsZXQgY2xvc2VfaWR4ID0gKGlkeCAtIHBhcmFtcy5wZXJpb2QgKyAxdSArIGopICogNnUgKyA0dTtcbiAgICAgICAgc3VtICs9IG9obGN2W2Nsb3NlX2lkeF07XG4gICAgICB9XG4gICAgICBsZXQgc21hID0gc3VtIC8gZjMyKHBhcmFtcy5wZXJpb2QpO1xuICAgICAgdmFyIHZhcl9zdW06IGYzMiA9IDAuMDtcbiAgICAgIGZvciAodmFyIGo6IHUzMiA9IDB1OyBqIDwgcGFyYW1zLnBlcmlvZDsgaisrKSB7XG4gICAgICAgIGxldCBjbG9zZV9pZHggPSAoaWR4IC0gcGFyYW1zLnBlcmlvZCArIDF1ICsgaikgKiA2dSArIDR1O1xuICAgICAgICBsZXQgZGlmZiA9IG9obGN2W2Nsb3NlX2lkeF0gLSBzbWE7XG4gICAgICAgIHZhcl9zdW0gKz0gZGlmZiAqIGRpZmY7XG4gICAgICB9XG4gICAgICBsZXQgc3RkID0gc3FydCh2YXJfc3VtIC8gZjMyKHBhcmFtcy5wZXJpb2QpKTtcbiAgICAgIG91dHB1dFtpZHggKiAzdSArIDB1XSA9IHNtYSArIHBhcmFtcy5zdGRfZGV2ICogc3RkO1xuICAgICAgb3V0cHV0W2lkeCAqIDN1ICsgMXVdID0gc21hO1xuICAgICAgb3V0cHV0W2lkeCAqIDN1ICsgMnVdID0gc21hIC0gcGFyYW1zLnN0ZF9kZXYgKiBzdGQ7XG4gICAgfVxuICBgLFxufTtcblxuZXhwb3J0IGNvbnN0IFZvbHVtZTogSW5kaWNhdG9yRGVmaW5pdGlvbjx7IG1hUGVyaW9kOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ3ZvbHVtZScsXG4gIG5hbWU6ICdWb2x1bWUnLFxuICBjYXRlZ29yeTogJ3ZvbHVtZScsXG4gIHBhbmU6ICdzdWIxJyxcbiAgb3V0cHV0czogW1xuICAgIHsgbmFtZTogJ3ZvbHVtZScsIGNvbG9yOiAnIzkwQ0FGOScsIHN0eWxlOiAnYmFyJywgb3BhY2l0eTogMC44LCB6TGF5ZXI6IDIwIH0sXG4gICAgeyBuYW1lOiAndm9sdW1lTUEnLCBjb2xvcjogJyMxNTY1QzAnLCBzdHlsZTogJ2xpbmUnLCBsaW5lV2lkdGg6IDEsIHpMYXllcjogMzAgfSxcbiAgXSxcbiAgcGFyYW1zOiB7XG4gICAgbWFQZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDIwLCBsYWJlbDogJ01BIFBlcmlvZCcsIG1pbjogNSwgbWF4OiA1MCB9LFxuICB9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IG1hUGVyaW9kIH0pID0+IG1hUGVyaW9kIC0gMSxcbiAgY2FsY3VsYXRlKGRhdGEsIHsgbWFQZXJpb2QgfSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB2b2x1bWU6IEluZGljYXRvclZhbHVlW10gPSBkYXRhLm1hcCgoZCkgPT4gZC52b2x1bWUpO1xuICAgICAgY29uc3Qgdm9sdW1lTUE6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA8IG1hUGVyaW9kIC0gMSkge1xuICAgICAgICAgIHZvbHVtZU1BLnB1c2gobnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3Qgc2xpY2UgPSBkYXRhLnNsaWNlKGkgLSBtYVBlcmlvZCArIDEsIGkgKyAxKTtcbiAgICAgICAgICBjb25zdCBhdmcgPSBzbGljZS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLnZvbHVtZSwgMCkgLyBtYVBlcmlvZDtcbiAgICAgICAgICB2b2x1bWVNQS5wdXNoKGF2Zyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IHZvbHVtZSwgdm9sdW1lTUEgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhaWwoU3RyaW5nKGUpKTtcbiAgICB9XG4gIH0sXG59O1xuXG5leHBvcnQgY29uc3QgUGl2b3RQb2ludHM6IEluZGljYXRvckRlZmluaXRpb248e30sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICdwaXZvdF9wb2ludHMnLFxuICBuYW1lOiAnUGl2b3QgUG9pbnRzJyxcbiAgY2F0ZWdvcnk6ICd0cmVuZCcsXG4gIHBhbmU6ICdtYWluJyxcbiAgb3V0cHV0czogW1xuICAgIHsgbmFtZTogJ3Bpdm90JywgY29sb3I6ICcjNjA3RDhCJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAncjEnLCBjb2xvcjogJyM4QkMzNEEnLCBzdHlsZTogJ2xpbmUnLCBsaW5lV2lkdGg6IDEsIHpMYXllcjogMzAgfSxcbiAgICB7IG5hbWU6ICdzMScsIGNvbG9yOiAnI0Y0NDMzNicsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMSwgekxheWVyOiAzMCB9LFxuICAgIHsgbmFtZTogJ3IyJywgY29sb3I6ICcjNENBRjUwJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAnczInLCBjb2xvcjogJyNFNTczNzMnLCBzdHlsZTogJ2xpbmUnLCBsaW5lV2lkdGg6IDEsIHpMYXllcjogMzAgfSxcbiAgXSxcbiAgcGFyYW1zOiB7fSxcbiAgY29tcGxleGl0eTogeyB0aW1lOiAnTyhuKScsIHNwYWNlOiAnTyhuKScgfSxcbiAgd2FybXVwUGVyaW9kOiAoKSA9PiAxLFxuICBjYWxjdWxhdGUoZGF0YSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwaXZvdDogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgY29uc3QgcjE6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGNvbnN0IHMxOiBJbmRpY2F0b3JWYWx1ZVtdID0gW107XG4gICAgICBjb25zdCByMjogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgY29uc3QgczI6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgIHBpdm90LnB1c2gobnVsbCk7XG4gICAgICAgICAgcjEucHVzaChudWxsKTtcbiAgICAgICAgICBzMS5wdXNoKG51bGwpO1xuICAgICAgICAgIHIyLnB1c2gobnVsbCk7XG4gICAgICAgICAgczIucHVzaChudWxsKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcmV2ID0gZGF0YVtpIC0gMV07XG4gICAgICAgIGNvbnN0IHAgPSAocHJldi5oaWdoICsgcHJldi5sb3cgKyBwcmV2LmNsb3NlKSAvIDM7XG4gICAgICAgIGNvbnN0IHIxdiA9IDIgKiBwIC0gcHJldi5sb3c7XG4gICAgICAgIGNvbnN0IHMxdiA9IDIgKiBwIC0gcHJldi5oaWdoO1xuICAgICAgICBjb25zdCByMnYgPSBwICsgKHByZXYuaGlnaCAtIHByZXYubG93KTtcbiAgICAgICAgY29uc3QgczJ2ID0gcCAtIChwcmV2LmhpZ2ggLSBwcmV2Lmxvdyk7XG4gICAgICAgIHBpdm90LnB1c2gocCk7XG4gICAgICAgIHIxLnB1c2gocjF2KTtcbiAgICAgICAgczEucHVzaChzMXYpO1xuICAgICAgICByMi5wdXNoKHIydik7XG4gICAgICAgIHMyLnB1c2goczJ2KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IHBpdm90LCByMSwgczEsIHIyLCBzMiB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBQaGFzZTFJbmRpY2F0b3JzID0gW1ZvbHVtZSwgU01BLCBFTUEsIEJvbGxpbmdlckJhbmRzLCBQaXZvdFBvaW50c10gYXMgY29uc3Q7XG5cbmV4cG9ydCBjb25zdCByZWdpc3RlclBoYXNlMUluZGljYXRvcnMgPSAocmVnaXN0cnk6IEluZGljYXRvclJlZ2lzdHJ5KTogdm9pZCA9PiB7XG4gIFBoYXNlMUluZGljYXRvcnMuZm9yRWFjaCgoaW5kaWNhdG9yKSA9PiByZWdpc3RyeS5yZWdpc3RlcihpbmRpY2F0b3IgYXMgSW5kaWNhdG9yRGVmaW5pdGlvbjxhbnksIGFueT4pKTtcbn07XG4iLAogICJpbXBvcnQgdHlwZSB7IE9obGN2UG9pbnQgfSBmcm9tICcuLi9jb3JlL3R5cGVzJztcbmltcG9ydCB0eXBlIHtcbiAgSW5kaWNhdG9yRGVmaW5pdGlvbixcbiAgSW5kaWNhdG9yUmVzdWx0LFxuICBJbmRpY2F0b3JWYWx1ZSxcbiAgTXVsdGlTZXJpZXNPdXRwdXQsXG59IGZyb20gJy4uL2NvcmUvaW5kaWNhdG9yVHlwZXMnO1xuaW1wb3J0IHsgU0NIRU1BX1ZFUlNJT04gfSBmcm9tICcuLi9jb3JlL2luZGljYXRvclR5cGVzJztcbmltcG9ydCB0eXBlIHsgSW5kaWNhdG9yUmVnaXN0cnkgfSBmcm9tICcuLi9jb3JlL2luZGljYXRvcnMnO1xuXG5jb25zdCBvayA9ICh2YWx1ZTogTXVsdGlTZXJpZXNPdXRwdXQpOiBJbmRpY2F0b3JSZXN1bHQ8TXVsdGlTZXJpZXNPdXRwdXQ+ID0+ICh7IG9rOiB0cnVlLCB2YWx1ZSB9KTtcbmNvbnN0IGZhaWwgPSAobWVzc2FnZTogc3RyaW5nKTogSW5kaWNhdG9yUmVzdWx0PE11bHRpU2VyaWVzT3V0cHV0PiA9PiAoe1xuICBvazogZmFsc2UsXG4gIGVycm9yOiB7IGNvZGU6ICdDT01QVVRBVElPTl9FUlJPUicsIG1lc3NhZ2UgfSxcbn0pO1xuXG5leHBvcnQgY29uc3QgUlNJOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ3JzaScsXG4gIG5hbWU6ICdSU0knLFxuICBjYXRlZ29yeTogJ21vbWVudHVtJyxcbiAgcGFuZTogJ3N1YjEnLFxuICBvdXRwdXRzOiBbeyBuYW1lOiAncnNpJywgY29sb3I6ICcjOUMyN0IwJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLjUsIHpMYXllcjogMzAgfV0sXG4gIHBhcmFtczoge1xuICAgIHBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMTQsIGxhYmVsOiAnUGVyaW9kJywgbWluOiAyLCBtYXg6IDUwIH0sXG4gIH0sXG4gIHlSYW5nZTogeyBtaW46IDAsIG1heDogMTAwIH0sXG4gIGhvcml6b250YWxMaW5lczogW1xuICAgIHsgdmFsdWU6IDcwLCBjb2xvcjogJyNGNDQzMzYnLCBkYXNoZWQ6IHRydWUgfSxcbiAgICB7IHZhbHVlOiAzMCwgY29sb3I6ICcjNENBRjUwJywgZGFzaGVkOiB0cnVlIH0sXG4gICAgeyB2YWx1ZTogNTAsIGNvbG9yOiAnIzlFOUU5RScsIGRhc2hlZDogdHJ1ZSB9LFxuICBdLFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKDEpJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QsXG4gIGNhbGN1bGF0ZShkYXRhLCB7IHBlcmlvZCB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJzaTogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgbGV0IGF2Z0dhaW4gPSAwO1xuICAgICAgbGV0IGF2Z0xvc3MgPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgcnNpLnB1c2gobnVsbCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hhbmdlID0gZGF0YVtpXS5jbG9zZSAtIGRhdGFbaSAtIDFdLmNsb3NlO1xuICAgICAgICBjb25zdCBnYWluID0gY2hhbmdlID4gMCA/IGNoYW5nZSA6IDA7XG4gICAgICAgIGNvbnN0IGxvc3MgPSBjaGFuZ2UgPCAwID8gLWNoYW5nZSA6IDA7XG4gICAgICAgIGlmIChpIDwgcGVyaW9kKSB7XG4gICAgICAgICAgYXZnR2FpbiArPSBnYWluIC8gcGVyaW9kO1xuICAgICAgICAgIGF2Z0xvc3MgKz0gbG9zcyAvIHBlcmlvZDtcbiAgICAgICAgICByc2kucHVzaChudWxsKTtcbiAgICAgICAgfSBlbHNlIGlmIChpID09PSBwZXJpb2QpIHtcbiAgICAgICAgICBhdmdHYWluICs9IGdhaW4gLyBwZXJpb2Q7XG4gICAgICAgICAgYXZnTG9zcyArPSBsb3NzIC8gcGVyaW9kO1xuICAgICAgICAgIGNvbnN0IHJzID0gYXZnTG9zcyA9PT0gMCA/IDEwMCA6IGF2Z0dhaW4gLyBhdmdMb3NzO1xuICAgICAgICAgIHJzaS5wdXNoKDEwMCAtIDEwMCAvICgxICsgcnMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhdmdHYWluID0gKGF2Z0dhaW4gKiAocGVyaW9kIC0gMSkgKyBnYWluKSAvIHBlcmlvZDtcbiAgICAgICAgICBhdmdMb3NzID0gKGF2Z0xvc3MgKiAocGVyaW9kIC0gMSkgKyBsb3NzKSAvIHBlcmlvZDtcbiAgICAgICAgICBjb25zdCBycyA9IGF2Z0xvc3MgPT09IDAgPyAxMDAgOiBhdmdHYWluIC8gYXZnTG9zcztcbiAgICAgICAgICByc2kucHVzaCgxMDAgLSAxMDAgLyAoMSArIHJzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IHJzaSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbiAgd2dzbFNvdXJjZTogYFxuICAgIHN0cnVjdCBQYXJhbXMgeyBwZXJpb2Q6IHUzMiwgZGF0YV9sZW46IHUzMiB9O1xuICAgIEBncm91cCgwKSBAYmluZGluZygwKSB2YXI8c3RvcmFnZSwgcmVhZD4gb2hsY3Y6IGFycmF5PGYzMj47XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDEpIHZhcjx1bmlmb3JtPiBwYXJhbXM6IFBhcmFtcztcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMikgdmFyPHN0b3JhZ2UsIHJlYWRfd3JpdGU+IG91dHB1dDogYXJyYXk8ZjMyPjtcbiAgICBAY29tcHV0ZSBAd29ya2dyb3VwX3NpemUoMSlcbiAgICBmbiBtYWluKCkge1xuICAgICAgbGV0IHBlcmlvZCA9IHBhcmFtcy5wZXJpb2Q7XG4gICAgICBsZXQgbiA9IHBhcmFtcy5kYXRhX2xlbjtcbiAgICAgIHZhciBhdmdfZ2FpbjogZjMyID0gMC4wO1xuICAgICAgdmFyIGF2Z19sb3NzOiBmMzIgPSAwLjA7XG4gICAgICBpZiAobiA8PSBwZXJpb2QgKyAxdSkgeyByZXR1cm47IH1cbiAgICAgIGZvciAodmFyIGk6IHUzMiA9IDF1OyBpIDw9IHBlcmlvZDsgaSsrKSB7XG4gICAgICAgIGxldCBjaGFuZ2UgPSBvaGxjdltpICogNnUgKyA0dV0gLSBvaGxjdlsoaSAtIDF1KSAqIDZ1ICsgNHVdO1xuICAgICAgICBpZiAoY2hhbmdlID4gMC4wKSB7IGF2Z19nYWluICs9IGNoYW5nZTsgfVxuICAgICAgICBlbHNlIHsgYXZnX2xvc3MgLT0gY2hhbmdlOyB9XG4gICAgICB9XG4gICAgICBhdmdfZ2FpbiAvPSBmMzIocGVyaW9kKTtcbiAgICAgIGF2Z19sb3NzIC89IGYzMihwZXJpb2QpO1xuICAgICAgZm9yICh2YXIgaTogdTMyID0gMHU7IGkgPCBwZXJpb2Q7IGkrKykge1xuICAgICAgICBvdXRwdXRbaV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgfVxuICAgICAgbGV0IHJzMCA9IHNlbGVjdChhdmdfZ2FpbiAvIGF2Z19sb3NzLCAxMDAuMCwgYXZnX2xvc3MgPT0gMC4wKTtcbiAgICAgIG91dHB1dFtwZXJpb2RdID0gMTAwLjAgLSAxMDAuMCAvICgxLjAgKyByczApO1xuICAgICAgZm9yICh2YXIgaTogdTMyID0gcGVyaW9kICsgMXU7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgbGV0IGNoYW5nZSA9IG9obGN2W2kgKiA2dSArIDR1XSAtIG9obGN2WyhpIC0gMXUpICogNnUgKyA0dV07XG4gICAgICAgIGxldCBnYWluID0gbWF4KGNoYW5nZSwgMC4wKTtcbiAgICAgICAgbGV0IGxvc3MgPSBtYXgoLWNoYW5nZSwgMC4wKTtcbiAgICAgICAgYXZnX2dhaW4gPSAoYXZnX2dhaW4gKiBmMzIocGVyaW9kIC0gMXUpICsgZ2FpbikgLyBmMzIocGVyaW9kKTtcbiAgICAgICAgYXZnX2xvc3MgPSAoYXZnX2xvc3MgKiBmMzIocGVyaW9kIC0gMXUpICsgbG9zcykgLyBmMzIocGVyaW9kKTtcbiAgICAgICAgbGV0IHJzID0gc2VsZWN0KGF2Z19nYWluIC8gYXZnX2xvc3MsIDEwMC4wLCBhdmdfbG9zcyA9PSAwLjApO1xuICAgICAgICBvdXRwdXRbaV0gPSAxMDAuMCAtIDEwMC4wIC8gKDEuMCArIHJzKTtcbiAgICAgIH1cbiAgICB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgQVRSOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ2F0cicsXG4gIG5hbWU6ICdBVFInLFxuICBjYXRlZ29yeTogJ3ZvbGF0aWxpdHknLFxuICBwYW5lOiAnc3ViMScsXG4gIG91dHB1dHM6IFt7IG5hbWU6ICdhdHInLCBjb2xvcjogJyM3OTU1NDgnLCBzdHlsZTogJ2xpbmUnLCBsaW5lV2lkdGg6IDEuNSwgekxheWVyOiAzMCB9XSxcbiAgcGFyYW1zOiB7XG4gICAgcGVyaW9kOiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAxNCwgbGFiZWw6ICdQZXJpb2QnLCBtaW46IDUsIG1heDogNTAgfSxcbiAgfSxcbiAgY29tcGxleGl0eTogeyB0aW1lOiAnTyhuKScsIHNwYWNlOiAnTygxKScgfSxcbiAgd2FybXVwUGVyaW9kOiAoeyBwZXJpb2QgfSkgPT4gcGVyaW9kLFxuICBjYWxjdWxhdGUoZGF0YSwgeyBwZXJpb2QgfSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBhdHI6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGxldCBhdHJTdW0gPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgYXRyLnB1c2gobnVsbCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdHIgPSBNYXRoLm1heChcbiAgICAgICAgICBkYXRhW2ldLmhpZ2ggLSBkYXRhW2ldLmxvdyxcbiAgICAgICAgICBNYXRoLmFicyhkYXRhW2ldLmhpZ2ggLSBkYXRhW2kgLSAxXS5jbG9zZSksXG4gICAgICAgICAgTWF0aC5hYnMoZGF0YVtpXS5sb3cgLSBkYXRhW2kgLSAxXS5jbG9zZSlcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGkgPCBwZXJpb2QpIHtcbiAgICAgICAgICBhdHJTdW0gKz0gdHI7XG4gICAgICAgICAgYXRyLnB1c2gobnVsbCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaSA9PT0gcGVyaW9kKSB7XG4gICAgICAgICAgYXRyU3VtICs9IHRyO1xuICAgICAgICAgIGF0ci5wdXNoKGF0clN1bSAvIHBlcmlvZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcHJldkFUUiA9IChhdHJbaSAtIDFdID8/IDApIGFzIG51bWJlcjtcbiAgICAgICAgICBhdHIucHVzaCgocHJldkFUUiAqIChwZXJpb2QgLSAxKSArIHRyKSAvIHBlcmlvZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IGF0ciB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbiAgd2dzbFNvdXJjZTogYFxuICAgIHN0cnVjdCBQYXJhbXMgeyBwZXJpb2Q6IHUzMiwgZGF0YV9sZW46IHUzMiB9O1xuICAgIEBncm91cCgwKSBAYmluZGluZygwKSB2YXI8c3RvcmFnZSwgcmVhZD4gb2hsY3Y6IGFycmF5PGYzMj47XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDEpIHZhcjx1bmlmb3JtPiBwYXJhbXM6IFBhcmFtcztcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMikgdmFyPHN0b3JhZ2UsIHJlYWRfd3JpdGU+IG91dHB1dDogYXJyYXk8ZjMyPjtcbiAgICBAY29tcHV0ZSBAd29ya2dyb3VwX3NpemUoMSlcbiAgICBmbiBtYWluKCkge1xuICAgICAgbGV0IHBlcmlvZCA9IHBhcmFtcy5wZXJpb2Q7XG4gICAgICBsZXQgbiA9IHBhcmFtcy5kYXRhX2xlbjtcbiAgICAgIGlmIChuID09IDB1KSB7IHJldHVybjsgfVxuICAgICAgb3V0cHV0WzB1XSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICB2YXIgYXRyX3N1bTogZjMyID0gMC4wO1xuICAgICAgZm9yICh2YXIgaTogdTMyID0gMXU7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgbGV0IGhpZ2ggPSBvaGxjdltpICogNnUgKyAydV07XG4gICAgICAgIGxldCBsb3cgPSBvaGxjdltpICogNnUgKyAzdV07XG4gICAgICAgIGxldCBwcmV2X2Nsb3NlID0gb2hsY3ZbKGkgLSAxdSkgKiA2dSArIDR1XTtcbiAgICAgICAgbGV0IHRyID0gbWF4KGhpZ2ggLSBsb3csIG1heChhYnMoaGlnaCAtIHByZXZfY2xvc2UpLCBhYnMobG93IC0gcHJldl9jbG9zZSkpKTtcbiAgICAgICAgaWYgKGkgPCBwZXJpb2QpIHtcbiAgICAgICAgICBhdHJfc3VtICs9IHRyO1xuICAgICAgICAgIG91dHB1dFtpXSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaSA9PSBwZXJpb2QpIHtcbiAgICAgICAgICBhdHJfc3VtICs9IHRyO1xuICAgICAgICAgIG91dHB1dFtpXSA9IGF0cl9zdW0gLyBmMzIocGVyaW9kKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgcHJldl9hdHIgPSBvdXRwdXRbaSAtIDF1XTtcbiAgICAgICAgICBvdXRwdXRbaV0gPSAocHJldl9hdHIgKiBmMzIocGVyaW9kIC0gMXUpICsgdHIpIC8gZjMyKHBlcmlvZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgTUFDRDogSW5kaWNhdG9yRGVmaW5pdGlvbjxcbiAgeyBmYXN0UGVyaW9kOiBudW1iZXI7IHNsb3dQZXJpb2Q6IG51bWJlcjsgc2lnbmFsUGVyaW9kOiBudW1iZXIgfSxcbiAgT2hsY3ZQb2ludFxuPiA9IHtcbiAgc2NoZW1hVmVyc2lvbjogU0NIRU1BX1ZFUlNJT04sXG4gIGlkOiAnbWFjZCcsXG4gIG5hbWU6ICdNQUNEJyxcbiAgY2F0ZWdvcnk6ICdtb21lbnR1bScsXG4gIHBhbmU6ICdzdWIyJyxcbiAgZGVwZW5kZW5jaWVzOiBbJ2VtYSddLFxuICBvdXRwdXRzOiBbXG4gICAgeyBuYW1lOiAnbWFjZCcsIGNvbG9yOiAnIzIxOTZGMycsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMS41LCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAnc2lnbmFsJywgY29sb3I6ICcjRkY5ODAwJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAnaGlzdG9ncmFtJywgY29sb3I6ICcjNENBRjUwJywgc3R5bGU6ICdoaXN0b2dyYW0nLCBvcGFjaXR5OiAwLjcsIHpMYXllcjogMjAgfSxcbiAgXSxcbiAgcGFyYW1zOiB7XG4gICAgZmFzdFBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMTIsIGxhYmVsOiAnRmFzdCBQZXJpb2QnLCBtaW46IDIsIG1heDogNTAgfSxcbiAgICBzbG93UGVyaW9kOiB7IHR5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAyNiwgbGFiZWw6ICdTbG93IFBlcmlvZCcsIG1pbjogNSwgbWF4OiAxMDAgfSxcbiAgICBzaWduYWxQZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDksIGxhYmVsOiAnU2lnbmFsIFBlcmlvZCcsIG1pbjogMiwgbWF4OiA1MCB9LFxuICB9LFxuICBob3Jpem9udGFsTGluZXM6IFt7IHZhbHVlOiAwLCBjb2xvcjogJyM5RTlFOUUnLCBkYXNoZWQ6IGZhbHNlIH1dLFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHNsb3dQZXJpb2QsIHNpZ25hbFBlcmlvZCB9KSA9PiBzbG93UGVyaW9kICsgc2lnbmFsUGVyaW9kIC0gMSxcbiAgY2FsY3VsYXRlKGRhdGEsIHsgZmFzdFBlcmlvZCwgc2xvd1BlcmlvZCwgc2lnbmFsUGVyaW9kIH0pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW1hID0gKHZhbHVlczogbnVtYmVyW10sIHBlcmlvZDogbnVtYmVyKTogbnVtYmVyW10gPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG4gICAgICAgIGNvbnN0IGsgPSAyIC8gKHBlcmlvZCArIDEpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChpID09PSAwKSByZXN1bHQucHVzaCh2YWx1ZXNbaV0pO1xuICAgICAgICAgIGVsc2UgcmVzdWx0LnB1c2godmFsdWVzW2ldICogayArIHJlc3VsdFtpIC0gMV0gKiAoMSAtIGspKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcbiAgICAgIGNvbnN0IGNsb3NlcyA9IGRhdGEubWFwKChkKSA9PiBkLmNsb3NlKTtcbiAgICAgIGNvbnN0IGZhc3RFbWEgPSBlbWEoY2xvc2VzLCBmYXN0UGVyaW9kKTtcbiAgICAgIGNvbnN0IHNsb3dFbWEgPSBlbWEoY2xvc2VzLCBzbG93UGVyaW9kKTtcbiAgICAgIGNvbnN0IG1hY2RMaW5lID0gZmFzdEVtYS5tYXAoKGYsIGkpID0+IGYgLSBzbG93RW1hW2ldKTtcbiAgICAgIGNvbnN0IHNpZ25hbExpbmUgPSBlbWEobWFjZExpbmUsIHNpZ25hbFBlcmlvZCk7XG4gICAgICBjb25zdCBoaXN0b2dyYW0gPSBtYWNkTGluZS5tYXAoKG0sIGkpID0+IG0gLSBzaWduYWxMaW5lW2ldKTtcbiAgICAgIGNvbnN0IHdhcm11cCA9IHNsb3dQZXJpb2QgKyBzaWduYWxQZXJpb2QgLSAxO1xuICAgICAgcmV0dXJuIG9rKHtcbiAgICAgICAgbWFjZDogbWFjZExpbmUubWFwKCh2LCBpKSA9PiAoaSA8IHdhcm11cCA/IG51bGwgOiB2KSksXG4gICAgICAgIHNpZ25hbDogc2lnbmFsTGluZS5tYXAoKHYsIGkpID0+IChpIDwgd2FybXVwID8gbnVsbCA6IHYpKSxcbiAgICAgICAgaGlzdG9ncmFtOiBoaXN0b2dyYW0ubWFwKCh2LCBpKSA9PiAoaSA8IHdhcm11cCA/IG51bGwgOiB2KSksXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbiAgd2dzbFNvdXJjZTogYFxuICAgIHN0cnVjdCBQYXJhbXMgeyBmYXN0OiB1MzIsIHNsb3c6IHUzMiwgc2lnbmFsOiB1MzIsIGRhdGFfbGVuOiB1MzIgfTtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMCkgdmFyPHN0b3JhZ2UsIHJlYWQ+IG9obGN2OiBhcnJheTxmMzI+O1xuICAgIEBncm91cCgwKSBAYmluZGluZygxKSB2YXI8dW5pZm9ybT4gcGFyYW1zOiBQYXJhbXM7XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDIpIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBvdXRwdXQ6IGFycmF5PGYzMj47IC8vIG1hY2QsIHNpZ25hbCwgaGlzdCBwYWNrZWRcbiAgICBAY29tcHV0ZSBAd29ya2dyb3VwX3NpemUoMSlcbiAgICBmbiBtYWluKCkge1xuICAgICAgbGV0IG4gPSBwYXJhbXMuZGF0YV9sZW47XG4gICAgICBpZiAobiA9PSAwdSkgeyByZXR1cm47IH1cbiAgICAgIGxldCBrX2Zhc3QgPSAyLjAgLyAoZjMyKHBhcmFtcy5mYXN0KSArIDEuMCk7XG4gICAgICBsZXQga19zbG93ID0gMi4wIC8gKGYzMihwYXJhbXMuc2xvdykgKyAxLjApO1xuICAgICAgbGV0IGtfc2lnID0gMi4wIC8gKGYzMihwYXJhbXMuc2lnbmFsKSArIDEuMCk7XG4gICAgICB2YXIgZW1hX2Zhc3Q6IGYzMiA9IG9obGN2WzR1XTtcbiAgICAgIHZhciBlbWFfc2xvdzogZjMyID0gb2hsY3ZbNHVdO1xuICAgICAgdmFyIHNpZzogZjMyID0gMC4wO1xuICAgICAgZm9yICh2YXIgaTogdTMyID0gMHU7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgbGV0IGNsb3NlID0gb2hsY3ZbaSAqIDZ1ICsgNHVdO1xuICAgICAgICBpZiAoaSA+IDB1KSB7XG4gICAgICAgICAgZW1hX2Zhc3QgPSBjbG9zZSAqIGtfZmFzdCArIGVtYV9mYXN0ICogKDEuMCAtIGtfZmFzdCk7XG4gICAgICAgICAgZW1hX3Nsb3cgPSBjbG9zZSAqIGtfc2xvdyArIGVtYV9zbG93ICogKDEuMCAtIGtfc2xvdyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IG1hY2QgPSBlbWFfZmFzdCAtIGVtYV9zbG93O1xuICAgICAgICBpZiAoaSA9PSAwdSkge1xuICAgICAgICAgIHNpZyA9IG1hY2Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2lnID0gbWFjZCAqIGtfc2lnICsgc2lnICogKDEuMCAtIGtfc2lnKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaGlzdCA9IG1hY2QgLSBzaWc7XG4gICAgICAgIG91dHB1dFtpICogM3UgKyAwdV0gPSBtYWNkO1xuICAgICAgICBvdXRwdXRbaSAqIDN1ICsgMXVdID0gc2lnO1xuICAgICAgICBvdXRwdXRbaSAqIDN1ICsgMnVdID0gaGlzdDtcbiAgICAgIH1cbiAgICAgIGxldCB3YXJtdXAgPSBwYXJhbXMuc2xvdyArIHBhcmFtcy5zaWduYWwgLSAxdTtcbiAgICAgIGZvciAodmFyIGk6IHUzMiA9IDB1OyBpIDwgd2FybXVwICYmIGkgPCBuOyBpKyspIHtcbiAgICAgICAgb3V0cHV0W2kgKiAzdSArIDB1XSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgIG91dHB1dFtpICogM3UgKyAxdV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICBvdXRwdXRbaSAqIDN1ICsgMnVdID0gYml0Y2FzdDxmMzI+KDB4N0ZDMDAwMDB1KTtcbiAgICAgIH1cbiAgICB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgQURYOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ2FkeCcsXG4gIG5hbWU6ICdBRFgnLFxuICBjYXRlZ29yeTogJ3RyZW5kJyxcbiAgcGFuZTogJ3N1YjEnLFxuICBvdXRwdXRzOiBbXG4gICAgeyBuYW1lOiAnYWR4JywgY29sb3I6ICcjRkY1NzIyJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAyLCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAncGx1c0RJJywgY29sb3I6ICcjNENBRjUwJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLCB6TGF5ZXI6IDMwIH0sXG4gICAgeyBuYW1lOiAnbWludXNESScsIGNvbG9yOiAnI0Y0NDMzNicsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMSwgekxheWVyOiAzMCB9LFxuICBdLFxuICBwYXJhbXM6IHtcbiAgICBwZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDE0LCBsYWJlbDogJ1BlcmlvZCcsIG1pbjogNSwgbWF4OiA1MCB9LFxuICB9LFxuICB5UmFuZ2U6IHsgbWluOiAwLCBtYXg6IDEwMCB9LFxuICBob3Jpem9udGFsTGluZXM6IFtcbiAgICB7IHZhbHVlOiAyNSwgY29sb3I6ICcjOUU5RTlFJywgZGFzaGVkOiB0cnVlIH0sXG4gICAgeyB2YWx1ZTogNTAsIGNvbG9yOiAnI0ZGOTgwMCcsIGRhc2hlZDogdHJ1ZSB9LFxuICBdLFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QgKiAyIC0gMSxcbiAgY2FsY3VsYXRlKGRhdGEsIHsgcGVyaW9kIH0pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYWR4OiBJbmRpY2F0b3JWYWx1ZVtdID0gW107XG4gICAgICBjb25zdCBwbHVzREk6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGNvbnN0IG1pbnVzREk6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGNvbnN0IHRyOiBudW1iZXJbXSA9IFtdO1xuICAgICAgY29uc3QgcGx1c0RNOiBudW1iZXJbXSA9IFtdO1xuICAgICAgY29uc3QgbWludXNETTogbnVtYmVyW10gPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgIHRyLnB1c2goZGF0YVtpXS5oaWdoIC0gZGF0YVtpXS5sb3cpO1xuICAgICAgICAgIHBsdXNETS5wdXNoKDApO1xuICAgICAgICAgIG1pbnVzRE0ucHVzaCgwKTtcbiAgICAgICAgICBhZHgucHVzaChudWxsKTtcbiAgICAgICAgICBwbHVzREkucHVzaChudWxsKTtcbiAgICAgICAgICBtaW51c0RJLnB1c2gobnVsbCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaGlnaCA9IGRhdGFbaV0uaGlnaDtcbiAgICAgICAgY29uc3QgbG93ID0gZGF0YVtpXS5sb3c7XG4gICAgICAgIGNvbnN0IHByZXZIaWdoID0gZGF0YVtpIC0gMV0uaGlnaDtcbiAgICAgICAgY29uc3QgcHJldkxvdyA9IGRhdGFbaSAtIDFdLmxvdztcbiAgICAgICAgY29uc3QgcHJldkNsb3NlID0gZGF0YVtpIC0gMV0uY2xvc2U7XG4gICAgICAgIGNvbnN0IHRyVmFsdWUgPSBNYXRoLm1heChcbiAgICAgICAgICBoaWdoIC0gbG93LFxuICAgICAgICAgIE1hdGguYWJzKGhpZ2ggLSBwcmV2Q2xvc2UpLFxuICAgICAgICAgIE1hdGguYWJzKGxvdyAtIHByZXZDbG9zZSlcbiAgICAgICAgKTtcbiAgICAgICAgdHIucHVzaCh0clZhbHVlKTtcbiAgICAgICAgY29uc3QgdXBNb3ZlID0gaGlnaCAtIHByZXZIaWdoO1xuICAgICAgICBjb25zdCBkb3duTW92ZSA9IHByZXZMb3cgLSBsb3c7XG4gICAgICAgIHBsdXNETS5wdXNoKHVwTW92ZSA+IGRvd25Nb3ZlICYmIHVwTW92ZSA+IDAgPyB1cE1vdmUgOiAwKTtcbiAgICAgICAgbWludXNETS5wdXNoKGRvd25Nb3ZlID4gdXBNb3ZlICYmIGRvd25Nb3ZlID4gMCA/IGRvd25Nb3ZlIDogMCk7XG4gICAgICAgIGlmIChpIDwgcGVyaW9kKSB7XG4gICAgICAgICAgYWR4LnB1c2gobnVsbCk7XG4gICAgICAgICAgcGx1c0RJLnB1c2gobnVsbCk7XG4gICAgICAgICAgbWludXNESS5wdXNoKG51bGwpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzbW9vdGhUUiA9IDA7XG4gICAgICAgIGxldCBzbW9vdGhQbHVzRE0gPSAwO1xuICAgICAgICBsZXQgc21vb3RoTWludXNETSA9IDA7XG4gICAgICAgIGlmIChpID09PSBwZXJpb2QpIHtcbiAgICAgICAgICBmb3IgKGxldCBqID0gMTsgaiA8PSBwZXJpb2Q7IGorKykge1xuICAgICAgICAgICAgc21vb3RoVFIgKz0gdHJbal07XG4gICAgICAgICAgICBzbW9vdGhQbHVzRE0gKz0gcGx1c0RNW2pdO1xuICAgICAgICAgICAgc21vb3RoTWludXNETSArPSBtaW51c0RNW2pdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcmV2U21vb3RoVFIgPSB0ci5zbGljZShpIC0gcGVyaW9kLCBpKS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKTtcbiAgICAgICAgICBzbW9vdGhUUiA9IHByZXZTbW9vdGhUUiAtIHByZXZTbW9vdGhUUiAvIHBlcmlvZCArIHRyW2ldO1xuICAgICAgICAgIGNvbnN0IHByZXZTbW9vdGhQbHVzRE0gPSBwbHVzRE0uc2xpY2UoaSAtIHBlcmlvZCwgaSkucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG4gICAgICAgICAgc21vb3RoUGx1c0RNID0gcHJldlNtb290aFBsdXNETSAtIHByZXZTbW9vdGhQbHVzRE0gLyBwZXJpb2QgKyBwbHVzRE1baV07XG4gICAgICAgICAgY29uc3QgcHJldlNtb290aE1pbnVzRE0gPSBtaW51c0RNLnNsaWNlKGkgLSBwZXJpb2QsIGkpLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApO1xuICAgICAgICAgIHNtb290aE1pbnVzRE0gPSBwcmV2U21vb3RoTWludXNETSAtIHByZXZTbW9vdGhNaW51c0RNIC8gcGVyaW9kICsgbWludXNETVtpXTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwZGkgPSBzbW9vdGhUUiA+IDAgPyAoMTAwICogc21vb3RoUGx1c0RNKSAvIHNtb290aFRSIDogMDtcbiAgICAgICAgY29uc3QgbWRpID0gc21vb3RoVFIgPiAwID8gKDEwMCAqIHNtb290aE1pbnVzRE0pIC8gc21vb3RoVFIgOiAwO1xuICAgICAgICBwbHVzREkucHVzaChwZGkpO1xuICAgICAgICBtaW51c0RJLnB1c2gobWRpKTtcbiAgICAgICAgY29uc3QgZGlTdW0gPSBwZGkgKyBtZGk7XG4gICAgICAgIGNvbnN0IGR4ID0gZGlTdW0gPiAwID8gKDEwMCAqIE1hdGguYWJzKHBkaSAtIG1kaSkpIC8gZGlTdW0gOiAwO1xuICAgICAgICBpZiAoaSA8IHBlcmlvZCAqIDIgLSAxKSB7XG4gICAgICAgICAgYWR4LnB1c2gobnVsbCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaSA9PT0gcGVyaW9kICogMiAtIDEpIHtcbiAgICAgICAgICBsZXQgZHhTdW0gPSAwO1xuICAgICAgICAgIGZvciAobGV0IGogPSBwZXJpb2Q7IGogPCBwZXJpb2QgKiAyOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHBkaUogPSBwbHVzRElbal0gPz8gMDtcbiAgICAgICAgICAgIGNvbnN0IG1kaUogPSBtaW51c0RJW2pdID8/IDA7XG4gICAgICAgICAgICBjb25zdCBzdW1KID0gcGRpSiArIG1kaUo7XG4gICAgICAgICAgICBkeFN1bSArPSBzdW1KID4gMCA/ICgxMDAgKiBNYXRoLmFicyhwZGlKIC0gbWRpSikpIC8gc3VtSiA6IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGFkeC5wdXNoKGR4U3VtIC8gcGVyaW9kKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBwcmV2QURYID0gKGFkeFtpIC0gMV0gPz8gMCkgYXMgbnVtYmVyO1xuICAgICAgICAgIGFkeC5wdXNoKChwcmV2QURYICogKHBlcmlvZCAtIDEpICsgZHgpIC8gcGVyaW9kKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9rKHsgYWR4LCBwbHVzREksIG1pbnVzREkgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhaWwoU3RyaW5nKGUpKTtcbiAgICB9XG4gIH0sXG4gIHdnc2xTb3VyY2U6IGBcbiAgICBzdHJ1Y3QgUGFyYW1zIHsgcGVyaW9kOiB1MzIsIGRhdGFfbGVuOiB1MzIgfTtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMCkgdmFyPHN0b3JhZ2UsIHJlYWQ+IG9obGN2OiBhcnJheTxmMzI+O1xuICAgIEBncm91cCgwKSBAYmluZGluZygxKSB2YXI8dW5pZm9ybT4gcGFyYW1zOiBQYXJhbXM7XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDIpIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBvdXRwdXQ6IGFycmF5PGYzMj47IC8vIGFkeCwgcGx1c0RJLCBtaW51c0RJIHBhY2tlZFxuICAgIEBjb21wdXRlIEB3b3JrZ3JvdXBfc2l6ZSgxKVxuICAgIGZuIG1haW4oKSB7XG4gICAgICBsZXQgbiA9IHBhcmFtcy5kYXRhX2xlbjtcbiAgICAgIGlmIChuID09IDB1KSB7IHJldHVybjsgfVxuICAgICAgdmFyIHNtb290aF90cjogZjMyID0gMC4wO1xuICAgICAgdmFyIHNtb290aF9wbHVzOiBmMzIgPSAwLjA7XG4gICAgICB2YXIgc21vb3RoX21pbnVzOiBmMzIgPSAwLjA7XG4gICAgICB2YXIgcHJldl9hZHg6IGYzMiA9IDAuMDtcbiAgICAgIGZvciAodmFyIGk6IHUzMiA9IDB1OyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIGlmIChpID09IDB1KSB7XG4gICAgICAgICAgb3V0cHV0W2kgKiAzdSArIDB1XSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgICAgb3V0cHV0W2kgKiAzdSArIDF1XSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgICAgb3V0cHV0W2kgKiAzdSArIDJ1XSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGhpZ2ggPSBvaGxjdltpICogNnUgKyAydV07XG4gICAgICAgIGxldCBsb3cgPSBvaGxjdltpICogNnUgKyAzdV07XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBvaGxjdlsoaSAtIDF1KSAqIDZ1ICsgMnVdO1xuICAgICAgICBsZXQgcHJldl9sb3cgPSBvaGxjdlsoaSAtIDF1KSAqIDZ1ICsgM3VdO1xuICAgICAgICBsZXQgcHJldl9jbG9zZSA9IG9obGN2WyhpIC0gMXUpICogNnUgKyA0dV07XG4gICAgICAgIGxldCB0ciA9IG1heChoaWdoIC0gbG93LCBtYXgoYWJzKGhpZ2ggLSBwcmV2X2Nsb3NlKSwgYWJzKGxvdyAtIHByZXZfY2xvc2UpKSk7XG4gICAgICAgIGxldCB1cF9tb3ZlID0gaGlnaCAtIHByZXZfaGlnaDtcbiAgICAgICAgbGV0IGRvd25fbW92ZSA9IHByZXZfbG93IC0gbG93O1xuICAgICAgICBsZXQgcGx1c19kbSA9IHNlbGVjdCh1cF9tb3ZlLCAwLjAsIHVwX21vdmUgPiBkb3duX21vdmUgJiYgdXBfbW92ZSA+IDAuMCk7XG4gICAgICAgIGxldCBtaW51c19kbSA9IHNlbGVjdChkb3duX21vdmUsIDAuMCwgZG93bl9tb3ZlID4gdXBfbW92ZSAmJiBkb3duX21vdmUgPiAwLjApO1xuICAgICAgICBpZiAoaSA8PSBwYXJhbXMucGVyaW9kKSB7XG4gICAgICAgICAgc21vb3RoX3RyICs9IHRyO1xuICAgICAgICAgIHNtb290aF9wbHVzICs9IHBsdXNfZG07XG4gICAgICAgICAgc21vb3RoX21pbnVzICs9IG1pbnVzX2RtO1xuICAgICAgICAgIG91dHB1dFtpICogM3UgKyAwdV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICAgIG91dHB1dFtpICogM3UgKyAxdV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICAgIG91dHB1dFtpICogM3UgKyAydV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHNtb290aF90ciA9IHNtb290aF90ciAtIChzbW9vdGhfdHIgLyBmMzIocGFyYW1zLnBlcmlvZCkpICsgdHI7XG4gICAgICAgIHNtb290aF9wbHVzID0gc21vb3RoX3BsdXMgLSAoc21vb3RoX3BsdXMgLyBmMzIocGFyYW1zLnBlcmlvZCkpICsgcGx1c19kbTtcbiAgICAgICAgc21vb3RoX21pbnVzID0gc21vb3RoX21pbnVzIC0gKHNtb290aF9taW51cyAvIGYzMihwYXJhbXMucGVyaW9kKSkgKyBtaW51c19kbTtcbiAgICAgICAgbGV0IHBkaSA9IHNlbGVjdCgoMTAwLjAgKiBzbW9vdGhfcGx1cykgLyBzbW9vdGhfdHIsIDAuMCwgc21vb3RoX3RyID09IDAuMCk7XG4gICAgICAgIGxldCBtZGkgPSBzZWxlY3QoKDEwMC4wICogc21vb3RoX21pbnVzKSAvIHNtb290aF90ciwgMC4wLCBzbW9vdGhfdHIgPT0gMC4wKTtcbiAgICAgICAgbGV0IGRpX3N1bSA9IHBkaSArIG1kaTtcbiAgICAgICAgbGV0IGR4ID0gc2VsZWN0KCgxMDAuMCAqIGFicyhwZGkgLSBtZGkpKSAvIGRpX3N1bSwgMC4wLCBkaV9zdW0gPT0gMC4wKTtcbiAgICAgICAgaWYgKGkgPCBwYXJhbXMucGVyaW9kICogMnUgLSAxdSkge1xuICAgICAgICAgIG91dHB1dFtpICogM3UgKyAwdV0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT0gcGFyYW1zLnBlcmlvZCAqIDJ1IC0gMXUpIHtcbiAgICAgICAgICBwcmV2X2FkeCA9IGR4O1xuICAgICAgICAgIG91dHB1dFtpICogM3UgKyAwdV0gPSBwcmV2X2FkeDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmV2X2FkeCA9IChwcmV2X2FkeCAqIGYzMihwYXJhbXMucGVyaW9kIC0gMXUpICsgZHgpIC8gZjMyKHBhcmFtcy5wZXJpb2QpO1xuICAgICAgICAgIG91dHB1dFtpICogM3UgKyAwdV0gPSBwcmV2X2FkeDtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXRbaSAqIDN1ICsgMXVdID0gcGRpO1xuICAgICAgICBvdXRwdXRbaSAqIDN1ICsgMnVdID0gbWRpO1xuICAgICAgfVxuICAgIH1cbiAgYCxcbn07XG5cbmV4cG9ydCBjb25zdCBUcmFkZU1hcmtlcnM6IEluZGljYXRvckRlZmluaXRpb248e30sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICd0cmFkZV9tYXJrZXJzJyxcbiAgbmFtZTogJ1RyYWRlIE1hcmtlcnMnLFxuICBjYXRlZ29yeTogJ2N1c3RvbScsXG4gIHBhbmU6ICdtYWluJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ21hcmtlcnMnLCBjb2xvcjogJyNGRkMxMDcnLCBzdHlsZTogJ21hcmtlcicsIHpMYXllcjogNDAgfV0sXG4gIHBhcmFtczoge30sXG4gIGNvbXBsZXhpdHk6IHsgdGltZTogJ08obiknLCBzcGFjZTogJ08obiknIH0sXG4gIHdhcm11cFBlcmlvZDogKCkgPT4gMCxcbiAgY2FsY3VsYXRlKCkge1xuICAgIHJldHVybiBvayh7IG1hcmtlcnM6IFtdIH0pO1xuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IFBoYXNlMkluZGljYXRvcnMgPSBbUlNJLCBBRFgsIEFUUiwgTUFDRCwgVHJhZGVNYXJrZXJzXSBhcyBjb25zdDtcblxuZXhwb3J0IGNvbnN0IHJlZ2lzdGVyUGhhc2UySW5kaWNhdG9ycyA9IChyZWdpc3RyeTogSW5kaWNhdG9yUmVnaXN0cnkpOiB2b2lkID0+IHtcbiAgUGhhc2UySW5kaWNhdG9ycy5mb3JFYWNoKChpbmRpY2F0b3IpID0+IHJlZ2lzdHJ5LnJlZ2lzdGVyKGluZGljYXRvciBhcyBJbmRpY2F0b3JEZWZpbml0aW9uPGFueSwgYW55PikpO1xufTtcbiIsCiAgImltcG9ydCB0eXBlIHsgT2hsY3ZQb2ludCB9IGZyb20gJy4uL2NvcmUvdHlwZXMnO1xuaW1wb3J0IHR5cGUge1xuICBJbmRpY2F0b3JEZWZpbml0aW9uLFxuICBJbmRpY2F0b3JSZXN1bHQsXG4gIEluZGljYXRvclZhbHVlLFxuICBNdWx0aVNlcmllc091dHB1dCxcbn0gZnJvbSAnLi4vY29yZS9pbmRpY2F0b3JUeXBlcyc7XG5pbXBvcnQgeyBTQ0hFTUFfVkVSU0lPTiB9IGZyb20gJy4uL2NvcmUvaW5kaWNhdG9yVHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBJbmRpY2F0b3JSZWdpc3RyeSB9IGZyb20gJy4uL2NvcmUvaW5kaWNhdG9ycyc7XG5cbmNvbnN0IG9rID0gKHZhbHVlOiBNdWx0aVNlcmllc091dHB1dCk6IEluZGljYXRvclJlc3VsdDxNdWx0aVNlcmllc091dHB1dD4gPT4gKHsgb2s6IHRydWUsIHZhbHVlIH0pO1xuY29uc3QgZmFpbCA9IChtZXNzYWdlOiBzdHJpbmcpOiBJbmRpY2F0b3JSZXN1bHQ8TXVsdGlTZXJpZXNPdXRwdXQ+ID0+ICh7XG4gIG9rOiBmYWxzZSxcbiAgZXJyb3I6IHsgY29kZTogJ0NPTVBVVEFUSU9OX0VSUk9SJywgbWVzc2FnZSB9LFxufSk7XG5cbmV4cG9ydCBjb25zdCBWV0FQOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ3Z3YXAnLFxuICBuYW1lOiAnVldBUCcsXG4gIGNhdGVnb3J5OiAndm9sdW1lJyxcbiAgcGFuZTogJ21haW4nLFxuICBvdXRwdXRzOiBbeyBuYW1lOiAndndhcCcsIGNvbG9yOiAnIzZENEM0MScsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMS41LCB6TGF5ZXI6IDMwIH1dLFxuICBwYXJhbXM6IHtcbiAgICBwZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDIwLCBsYWJlbDogJ1BlcmlvZCcsIG1pbjogMiwgbWF4OiAyMDAgfSxcbiAgfSxcbiAgY29tcGxleGl0eTogeyB0aW1lOiAnTyhuKScsIHNwYWNlOiAnTyhuKScgfSxcbiAgd2FybXVwUGVyaW9kOiAoeyBwZXJpb2QgfSkgPT4gcGVyaW9kIC0gMSxcbiAgY2FsY3VsYXRlKGRhdGEsIHsgcGVyaW9kIH0pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdndhcDogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgbGV0IHB2U3VtID0gMDtcbiAgICAgIGxldCB2U3VtID0gMDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0eXBpY2FsID0gKGRhdGFbaV0uaGlnaCArIGRhdGFbaV0ubG93ICsgZGF0YVtpXS5jbG9zZSkgLyAzO1xuICAgICAgICBwdlN1bSArPSB0eXBpY2FsICogZGF0YVtpXS52b2x1bWU7XG4gICAgICAgIHZTdW0gKz0gZGF0YVtpXS52b2x1bWU7XG5cbiAgICAgICAgaWYgKGkgPj0gcGVyaW9kKSB7XG4gICAgICAgICAgY29uc3QgcHJldiA9IGRhdGFbaSAtIHBlcmlvZF07XG4gICAgICAgICAgY29uc3QgcHJldlR5cGljYWwgPSAocHJldi5oaWdoICsgcHJldi5sb3cgKyBwcmV2LmNsb3NlKSAvIDM7XG4gICAgICAgICAgcHZTdW0gLT0gcHJldlR5cGljYWwgKiBwcmV2LnZvbHVtZTtcbiAgICAgICAgICB2U3VtIC09IHByZXYudm9sdW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGkgPCBwZXJpb2QgLSAxIHx8IHZTdW0gPT09IDApIHtcbiAgICAgICAgICB2d2FwLnB1c2gobnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdndhcC5wdXNoKHB2U3VtIC8gdlN1bSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IHZ3YXAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhaWwoU3RyaW5nKGUpKTtcbiAgICB9XG4gIH0sXG4gIHdnc2xTb3VyY2U6IGBcbiAgICBzdHJ1Y3QgUGFyYW1zIHsgcGVyaW9kOiB1MzIsIGRhdGFfbGVuOiB1MzIgfTtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMCkgdmFyPHN0b3JhZ2UsIHJlYWQ+IG9obGN2OiBhcnJheTxmMzI+O1xuICAgIEBncm91cCgwKSBAYmluZGluZygxKSB2YXI8dW5pZm9ybT4gcGFyYW1zOiBQYXJhbXM7XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDIpIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBvdXRwdXQ6IGFycmF5PGYzMj47XG4gICAgQGNvbXB1dGUgQHdvcmtncm91cF9zaXplKDEpXG4gICAgZm4gbWFpbigpIHtcbiAgICAgIGxldCBwZXJpb2QgPSBwYXJhbXMucGVyaW9kO1xuICAgICAgbGV0IG4gPSBwYXJhbXMuZGF0YV9sZW47XG4gICAgICB2YXIgcHZfc3VtOiBmMzIgPSAwLjA7XG4gICAgICB2YXIgdl9zdW06IGYzMiA9IDAuMDtcbiAgICAgIGZvciAodmFyIGk6IHUzMiA9IDB1OyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIGxldCBoaWdoID0gb2hsY3ZbaSAqIDZ1ICsgMnVdO1xuICAgICAgICBsZXQgbG93ID0gb2hsY3ZbaSAqIDZ1ICsgM3VdO1xuICAgICAgICBsZXQgY2xvc2UgPSBvaGxjdltpICogNnUgKyA0dV07XG4gICAgICAgIGxldCB2b2x1bWUgPSBvaGxjdltpICogNnUgKyA1dV07XG4gICAgICAgIGxldCB0eXBpY2FsID0gKGhpZ2ggKyBsb3cgKyBjbG9zZSkgLyAzLjA7XG4gICAgICAgIHB2X3N1bSArPSB0eXBpY2FsICogdm9sdW1lO1xuICAgICAgICB2X3N1bSArPSB2b2x1bWU7XG4gICAgICAgIGlmIChpID49IHBlcmlvZCkge1xuICAgICAgICAgIGxldCBqID0gaSAtIHBlcmlvZDtcbiAgICAgICAgICBsZXQgaCA9IG9obGN2W2ogKiA2dSArIDJ1XTtcbiAgICAgICAgICBsZXQgbCA9IG9obGN2W2ogKiA2dSArIDN1XTtcbiAgICAgICAgICBsZXQgYyA9IG9obGN2W2ogKiA2dSArIDR1XTtcbiAgICAgICAgICBsZXQgdiA9IG9obGN2W2ogKiA2dSArIDV1XTtcbiAgICAgICAgICBsZXQgdCA9IChoICsgbCArIGMpIC8gMy4wO1xuICAgICAgICAgIHB2X3N1bSAtPSB0ICogdjtcbiAgICAgICAgICB2X3N1bSAtPSB2O1xuICAgICAgICB9XG4gICAgICAgIGlmIChpIDwgcGVyaW9kIC0gMXUgfHwgdl9zdW0gPT0gMC4wKSB7XG4gICAgICAgICAgb3V0cHV0W2ldID0gYml0Y2FzdDxmMzI+KDB4N0ZDMDAwMDB1KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvdXRwdXRbaV0gPSBwdl9zdW0gLyB2X3N1bTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgYCxcbn07XG5cbmV4cG9ydCBjb25zdCBWb2xSYXRpbzogSW5kaWNhdG9yRGVmaW5pdGlvbjx7IHBlcmlvZDogbnVtYmVyIH0sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICd2b2xfcmF0aW8nLFxuICBuYW1lOiAnVm9sIFJhdGlvJyxcbiAgY2F0ZWdvcnk6ICd2b2x1bWUnLFxuICBwYW5lOiAnc3ViMScsXG4gIG91dHB1dHM6IFt7IG5hbWU6ICd2b2xSYXRpbycsIGNvbG9yOiAnIzAwODk3QicsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMS4yLCB6TGF5ZXI6IDMwIH1dLFxuICBwYXJhbXM6IHtcbiAgICBwZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDIwLCBsYWJlbDogJ1BlcmlvZCcsIG1pbjogMiwgbWF4OiAyMDAgfSxcbiAgfSxcbiAgY29tcGxleGl0eTogeyB0aW1lOiAnTyhuKScsIHNwYWNlOiAnTyhuKScgfSxcbiAgd2FybXVwUGVyaW9kOiAoeyBwZXJpb2QgfSkgPT4gcGVyaW9kIC0gMSxcbiAgY2FsY3VsYXRlKGRhdGEsIHsgcGVyaW9kIH0pIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgdm9sUmF0aW86IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGxldCBzdW0gPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHN1bSArPSBkYXRhW2ldLnZvbHVtZTtcbiAgICAgICAgaWYgKGkgPj0gcGVyaW9kKSBzdW0gLT0gZGF0YVtpIC0gcGVyaW9kXS52b2x1bWU7XG4gICAgICAgIGlmIChpIDwgcGVyaW9kIC0gMSkge1xuICAgICAgICAgIHZvbFJhdGlvLnB1c2gobnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgYXZnID0gc3VtIC8gcGVyaW9kO1xuICAgICAgICAgIHZvbFJhdGlvLnB1c2goYXZnID09PSAwID8gMCA6IGRhdGFbaV0udm9sdW1lIC8gYXZnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9rKHsgdm9sUmF0aW8gfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhaWwoU3RyaW5nKGUpKTtcbiAgICB9XG4gIH0sXG4gIHdnc2xTb3VyY2U6IGBcbiAgICBzdHJ1Y3QgUGFyYW1zIHsgcGVyaW9kOiB1MzIsIGRhdGFfbGVuOiB1MzIgfTtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMCkgdmFyPHN0b3JhZ2UsIHJlYWQ+IG9obGN2OiBhcnJheTxmMzI+O1xuICAgIEBncm91cCgwKSBAYmluZGluZygxKSB2YXI8dW5pZm9ybT4gcGFyYW1zOiBQYXJhbXM7XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDIpIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBvdXRwdXQ6IGFycmF5PGYzMj47XG4gICAgQGNvbXB1dGUgQHdvcmtncm91cF9zaXplKDEpXG4gICAgZm4gbWFpbigpIHtcbiAgICAgIGxldCBwZXJpb2QgPSBwYXJhbXMucGVyaW9kO1xuICAgICAgbGV0IG4gPSBwYXJhbXMuZGF0YV9sZW47XG4gICAgICB2YXIgc3VtOiBmMzIgPSAwLjA7XG4gICAgICBmb3IgKHZhciBpOiB1MzIgPSAwdTsgaSA8IG47IGkrKykge1xuICAgICAgICBsZXQgdm9sID0gb2hsY3ZbaSAqIDZ1ICsgNXVdO1xuICAgICAgICBzdW0gKz0gdm9sO1xuICAgICAgICBpZiAoaSA+PSBwZXJpb2QpIHtcbiAgICAgICAgICBzdW0gLT0gb2hsY3ZbKGkgLSBwZXJpb2QpICogNnUgKyA1dV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkgPCBwZXJpb2QgLSAxdSkge1xuICAgICAgICAgIG91dHB1dFtpXSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGF2ZyA9IHN1bSAvIGYzMihwZXJpb2QpO1xuICAgICAgICAgIG91dHB1dFtpXSA9IHNlbGVjdCh2b2wgLyBhdmcsIDAuMCwgYXZnID09IDAuMCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgUGVyY2VudEI6IEluZGljYXRvckRlZmluaXRpb248eyBwZXJpb2Q6IG51bWJlcjsgc3RkRGV2OiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ3BlcmNlbnRfYicsXG4gIG5hbWU6ICclQicsXG4gIGNhdGVnb3J5OiAndm9sYXRpbGl0eScsXG4gIHBhbmU6ICdzdWIxJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ3BlcmNlbnRCJywgY29sb3I6ICcjNjczQUI3Jywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLjMsIHpMYXllcjogMzAgfV0sXG4gIHBhcmFtczoge1xuICAgIHBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMjAsIGxhYmVsOiAnUGVyaW9kJywgbWluOiA1LCBtYXg6IDEwMCB9LFxuICAgIHN0ZERldjogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMi4wLCBsYWJlbDogJ1N0ZCBEZXYnLCBtaW46IDAuNSwgbWF4OiA0LjAsIHN0ZXA6IDAuMSB9LFxuICB9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QgLSAxLFxuICBjYWxjdWxhdGUoZGF0YSwgeyBwZXJpb2QsIHN0ZERldiB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBlcmNlbnRCOiBJbmRpY2F0b3JWYWx1ZVtdID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGkgPCBwZXJpb2QgLSAxKSB7XG4gICAgICAgICAgcGVyY2VudEIucHVzaChudWxsKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzbGljZSA9IGRhdGEuc2xpY2UoaSAtIHBlcmlvZCArIDEsIGkgKyAxKTtcbiAgICAgICAgY29uc3QgY2xvc2VzID0gc2xpY2UubWFwKChkKSA9PiBkLmNsb3NlKTtcbiAgICAgICAgY29uc3Qgc21hID0gY2xvc2VzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gcGVyaW9kO1xuICAgICAgICBjb25zdCB2YXJpYW5jZSA9IGNsb3Nlcy5yZWR1Y2UoKGEsIGIpID0+IGEgKyAoYiAtIHNtYSkgKiogMiwgMCkgLyBwZXJpb2Q7XG4gICAgICAgIGNvbnN0IHN0ZCA9IE1hdGguc3FydCh2YXJpYW5jZSk7XG4gICAgICAgIGNvbnN0IHVwcGVyID0gc21hICsgc3RkRGV2ICogc3RkO1xuICAgICAgICBjb25zdCBsb3dlciA9IHNtYSAtIHN0ZERldiAqIHN0ZDtcbiAgICAgICAgY29uc3QgYmFuZHdpZHRoID0gdXBwZXIgLSBsb3dlcjtcbiAgICAgICAgcGVyY2VudEIucHVzaChiYW5kd2lkdGggPiAwID8gKGRhdGFbaV0uY2xvc2UgLSBsb3dlcikgLyBiYW5kd2lkdGggOiAwLjUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9rKHsgcGVyY2VudEIgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhaWwoU3RyaW5nKGUpKTtcbiAgICB9XG4gIH0sXG4gIHdnc2xTb3VyY2U6IGBcbiAgICBzdHJ1Y3QgUGFyYW1zIHsgcGVyaW9kOiB1MzIsIHN0ZF9kZXY6IGYzMiwgZGF0YV9sZW46IHUzMiB9O1xuICAgIEBncm91cCgwKSBAYmluZGluZygwKSB2YXI8c3RvcmFnZSwgcmVhZD4gb2hsY3Y6IGFycmF5PGYzMj47XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDEpIHZhcjx1bmlmb3JtPiBwYXJhbXM6IFBhcmFtcztcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMikgdmFyPHN0b3JhZ2UsIHJlYWRfd3JpdGU+IG91dHB1dDogYXJyYXk8ZjMyPjtcbiAgICBAY29tcHV0ZSBAd29ya2dyb3VwX3NpemUoMjU2KVxuICAgIGZuIG1haW4oQGJ1aWx0aW4oZ2xvYmFsX2ludm9jYXRpb25faWQpIGdpZDogdmVjMzx1MzI+KSB7XG4gICAgICBsZXQgaWR4ID0gZ2lkLng7XG4gICAgICBpZiAoaWR4ID49IHBhcmFtcy5kYXRhX2xlbikgeyByZXR1cm47IH1cbiAgICAgIGlmIChpZHggPCBwYXJhbXMucGVyaW9kIC0gMXUpIHtcbiAgICAgICAgb3V0cHV0W2lkeF0gPSBiaXRjYXN0PGYzMj4oMHg3RkMwMDAwMHUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgc3VtOiBmMzIgPSAwLjA7XG4gICAgICBmb3IgKHZhciBqOiB1MzIgPSAwdTsgaiA8IHBhcmFtcy5wZXJpb2Q7IGorKykge1xuICAgICAgICBsZXQgY2xvc2VfaWR4ID0gKGlkeCAtIHBhcmFtcy5wZXJpb2QgKyAxdSArIGopICogNnUgKyA0dTtcbiAgICAgICAgc3VtICs9IG9obGN2W2Nsb3NlX2lkeF07XG4gICAgICB9XG4gICAgICBsZXQgc21hID0gc3VtIC8gZjMyKHBhcmFtcy5wZXJpb2QpO1xuICAgICAgdmFyIHZhcl9zdW06IGYzMiA9IDAuMDtcbiAgICAgIGZvciAodmFyIGo6IHUzMiA9IDB1OyBqIDwgcGFyYW1zLnBlcmlvZDsgaisrKSB7XG4gICAgICAgIGxldCBjbG9zZV9pZHggPSAoaWR4IC0gcGFyYW1zLnBlcmlvZCArIDF1ICsgaikgKiA2dSArIDR1O1xuICAgICAgICBsZXQgZGlmZiA9IG9obGN2W2Nsb3NlX2lkeF0gLSBzbWE7XG4gICAgICAgIHZhcl9zdW0gKz0gZGlmZiAqIGRpZmY7XG4gICAgICB9XG4gICAgICBsZXQgc3RkID0gc3FydCh2YXJfc3VtIC8gZjMyKHBhcmFtcy5wZXJpb2QpKTtcbiAgICAgIGxldCB1cHBlciA9IHNtYSArIHBhcmFtcy5zdGRfZGV2ICogc3RkO1xuICAgICAgbGV0IGxvd2VyID0gc21hIC0gcGFyYW1zLnN0ZF9kZXYgKiBzdGQ7XG4gICAgICBsZXQgd2lkdGggPSB1cHBlciAtIGxvd2VyO1xuICAgICAgbGV0IGNsb3NlID0gb2hsY3ZbaWR4ICogNnUgKyA0dV07XG4gICAgICBvdXRwdXRbaWR4XSA9IHNlbGVjdCgoY2xvc2UgLSBsb3dlcikgLyB3aWR0aCwgMC41LCB3aWR0aCA9PSAwLjApO1xuICAgIH1cbiAgYCxcbn07XG5cbmV4cG9ydCBjb25zdCBCQldpZHRoOiBJbmRpY2F0b3JEZWZpbml0aW9uPHsgcGVyaW9kOiBudW1iZXI7IHN0ZERldjogbnVtYmVyIH0sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICdiYl93aWR0aCcsXG4gIG5hbWU6ICdCQiBXaWR0aCcsXG4gIGNhdGVnb3J5OiAndm9sYXRpbGl0eScsXG4gIHBhbmU6ICdzdWIxJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ3dpZHRoJywgY29sb3I6ICcjMDBCQ0Q0Jywgc3R5bGU6ICdhcmVhJywgb3BhY2l0eTogMC41LCBmaWxsVG86IDAsIHpMYXllcjogMjAgfV0sXG4gIHBhcmFtczoge1xuICAgIHBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMjAsIGxhYmVsOiAnUGVyaW9kJywgbWluOiA1LCBtYXg6IDEwMCB9LFxuICAgIHN0ZERldjogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMi4wLCBsYWJlbDogJ1N0ZCBEZXYnLCBtaW46IDAuNSwgbWF4OiA0LjAsIHN0ZXA6IDAuMSB9LFxuICB9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QgLSAxLFxuICBjYWxjdWxhdGUoZGF0YSwgeyBwZXJpb2QsIHN0ZERldiB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdpZHRoOiBJbmRpY2F0b3JWYWx1ZVtdID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGkgPCBwZXJpb2QgLSAxKSB7XG4gICAgICAgICAgd2lkdGgucHVzaChudWxsKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzbGljZSA9IGRhdGEuc2xpY2UoaSAtIHBlcmlvZCArIDEsIGkgKyAxKTtcbiAgICAgICAgY29uc3QgY2xvc2VzID0gc2xpY2UubWFwKChkKSA9PiBkLmNsb3NlKTtcbiAgICAgICAgY29uc3Qgc21hID0gY2xvc2VzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gcGVyaW9kO1xuICAgICAgICBjb25zdCB2YXJpYW5jZSA9IGNsb3Nlcy5yZWR1Y2UoKGEsIGIpID0+IGEgKyAoYiAtIHNtYSkgKiogMiwgMCkgLyBwZXJpb2Q7XG4gICAgICAgIGNvbnN0IHN0ZCA9IE1hdGguc3FydCh2YXJpYW5jZSk7XG4gICAgICAgIGNvbnN0IHVwcGVyID0gc21hICsgc3RkRGV2ICogc3RkO1xuICAgICAgICBjb25zdCBsb3dlciA9IHNtYSAtIHN0ZERldiAqIHN0ZDtcbiAgICAgICAgd2lkdGgucHVzaChzbWEgPiAwID8gKHVwcGVyIC0gbG93ZXIpIC8gc21hIDogMCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2soeyB3aWR0aCB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbiAgd2dzbFNvdXJjZTogYFxuICAgIHN0cnVjdCBQYXJhbXMgeyBwZXJpb2Q6IHUzMiwgc3RkX2RldjogZjMyLCBkYXRhX2xlbjogdTMyIH07XG4gICAgQGdyb3VwKDApIEBiaW5kaW5nKDApIHZhcjxzdG9yYWdlLCByZWFkPiBvaGxjdjogYXJyYXk8ZjMyPjtcbiAgICBAZ3JvdXAoMCkgQGJpbmRpbmcoMSkgdmFyPHVuaWZvcm0+IHBhcmFtczogUGFyYW1zO1xuICAgIEBncm91cCgwKSBAYmluZGluZygyKSB2YXI8c3RvcmFnZSwgcmVhZF93cml0ZT4gb3V0cHV0OiBhcnJheTxmMzI+O1xuICAgIEBjb21wdXRlIEB3b3JrZ3JvdXBfc2l6ZSgyNTYpXG4gICAgZm4gbWFpbihAYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCkgZ2lkOiB2ZWMzPHUzMj4pIHtcbiAgICAgIGxldCBpZHggPSBnaWQueDtcbiAgICAgIGlmIChpZHggPj0gcGFyYW1zLmRhdGFfbGVuKSB7IHJldHVybjsgfVxuICAgICAgaWYgKGlkeCA8IHBhcmFtcy5wZXJpb2QgLSAxdSkge1xuICAgICAgICBvdXRwdXRbaWR4XSA9IGJpdGNhc3Q8ZjMyPigweDdGQzAwMDAwdSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBzdW06IGYzMiA9IDAuMDtcbiAgICAgIGZvciAodmFyIGo6IHUzMiA9IDB1OyBqIDwgcGFyYW1zLnBlcmlvZDsgaisrKSB7XG4gICAgICAgIGxldCBjbG9zZV9pZHggPSAoaWR4IC0gcGFyYW1zLnBlcmlvZCArIDF1ICsgaikgKiA2dSArIDR1O1xuICAgICAgICBzdW0gKz0gb2hsY3ZbY2xvc2VfaWR4XTtcbiAgICAgIH1cbiAgICAgIGxldCBzbWEgPSBzdW0gLyBmMzIocGFyYW1zLnBlcmlvZCk7XG4gICAgICB2YXIgdmFyX3N1bTogZjMyID0gMC4wO1xuICAgICAgZm9yICh2YXIgajogdTMyID0gMHU7IGogPCBwYXJhbXMucGVyaW9kOyBqKyspIHtcbiAgICAgICAgbGV0IGNsb3NlX2lkeCA9IChpZHggLSBwYXJhbXMucGVyaW9kICsgMXUgKyBqKSAqIDZ1ICsgNHU7XG4gICAgICAgIGxldCBkaWZmID0gb2hsY3ZbY2xvc2VfaWR4XSAtIHNtYTtcbiAgICAgICAgdmFyX3N1bSArPSBkaWZmICogZGlmZjtcbiAgICAgIH1cbiAgICAgIGxldCBzdGQgPSBzcXJ0KHZhcl9zdW0gLyBmMzIocGFyYW1zLnBlcmlvZCkpO1xuICAgICAgbGV0IHVwcGVyID0gc21hICsgcGFyYW1zLnN0ZF9kZXYgKiBzdGQ7XG4gICAgICBsZXQgbG93ZXIgPSBzbWEgLSBwYXJhbXMuc3RkX2RldiAqIHN0ZDtcbiAgICAgIG91dHB1dFtpZHhdID0gc2VsZWN0KCh1cHBlciAtIGxvd2VyKSAvIHNtYSwgMC4wLCBzbWEgPT0gMC4wKTtcbiAgICB9XG4gIGAsXG59O1xuXG5leHBvcnQgY29uc3QgUGhhc2UzSW5kaWNhdG9ycyA9IFtWV0FQLCBWb2xSYXRpbywgUGVyY2VudEIsIEJCV2lkdGhdIGFzIGNvbnN0O1xuXG5leHBvcnQgY29uc3QgcmVnaXN0ZXJQaGFzZTNJbmRpY2F0b3JzID0gKHJlZ2lzdHJ5OiBJbmRpY2F0b3JSZWdpc3RyeSk6IHZvaWQgPT4ge1xuICBQaGFzZTNJbmRpY2F0b3JzLmZvckVhY2goKGluZGljYXRvcikgPT4gcmVnaXN0cnkucmVnaXN0ZXIoaW5kaWNhdG9yIGFzIEluZGljYXRvckRlZmluaXRpb248YW55LCBhbnk+KSk7XG59O1xuIiwKICAiaW1wb3J0IHR5cGUgeyBPaGxjdlBvaW50IH0gZnJvbSAnLi4vY29yZS90eXBlcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEluZGljYXRvckRlZmluaXRpb24sXG4gIEluZGljYXRvclJlc3VsdCxcbiAgSW5kaWNhdG9yVmFsdWUsXG4gIE11bHRpU2VyaWVzT3V0cHV0LFxufSBmcm9tICcuLi9jb3JlL2luZGljYXRvclR5cGVzJztcbmltcG9ydCB7IFNDSEVNQV9WRVJTSU9OIH0gZnJvbSAnLi4vY29yZS9pbmRpY2F0b3JUeXBlcyc7XG5pbXBvcnQgdHlwZSB7IEluZGljYXRvclJlZ2lzdHJ5IH0gZnJvbSAnLi4vY29yZS9pbmRpY2F0b3JzJztcblxuY29uc3Qgb2sgPSAodmFsdWU6IE11bHRpU2VyaWVzT3V0cHV0KTogSW5kaWNhdG9yUmVzdWx0PE11bHRpU2VyaWVzT3V0cHV0PiA9PiAoeyBvazogdHJ1ZSwgdmFsdWUgfSk7XG5jb25zdCBmYWlsID0gKG1lc3NhZ2U6IHN0cmluZyk6IEluZGljYXRvclJlc3VsdDxNdWx0aVNlcmllc091dHB1dD4gPT4gKHtcbiAgb2s6IGZhbHNlLFxuICBlcnJvcjogeyBjb2RlOiAnQ09NUFVUQVRJT05fRVJST1InLCBtZXNzYWdlIH0sXG59KTtcblxuZXhwb3J0IGNvbnN0IE9CVjogSW5kaWNhdG9yRGVmaW5pdGlvbjx7fSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ29idicsXG4gIG5hbWU6ICdPQlYnLFxuICBjYXRlZ29yeTogJ3ZvbHVtZScsXG4gIHBhbmU6ICdzdWIxJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ29idicsIGNvbG9yOiAnIzNGNTFCNScsIHN0eWxlOiAnbGluZScsIGxpbmVXaWR0aDogMS4yLCB6TGF5ZXI6IDMwIH1dLFxuICBwYXJhbXM6IHt9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICgpID0+IDEsXG4gIGNhbGN1bGF0ZShkYXRhKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG9idjogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgbGV0IGN1cnJlbnQgPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgb2J2LnB1c2gobnVsbCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGFbaV0uY2xvc2UgPiBkYXRhW2kgLSAxXS5jbG9zZSkge1xuICAgICAgICAgIGN1cnJlbnQgKz0gZGF0YVtpXS52b2x1bWU7XG4gICAgICAgIH0gZWxzZSBpZiAoZGF0YVtpXS5jbG9zZSA8IGRhdGFbaSAtIDFdLmNsb3NlKSB7XG4gICAgICAgICAgY3VycmVudCAtPSBkYXRhW2ldLnZvbHVtZTtcbiAgICAgICAgfVxuICAgICAgICBvYnYucHVzaChjdXJyZW50KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IG9idiB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBDTUY6IEluZGljYXRvckRlZmluaXRpb248eyBwZXJpb2Q6IG51bWJlciB9LCBPaGxjdlBvaW50PiA9IHtcbiAgc2NoZW1hVmVyc2lvbjogU0NIRU1BX1ZFUlNJT04sXG4gIGlkOiAnY21mJyxcbiAgbmFtZTogJ0NNRicsXG4gIGNhdGVnb3J5OiAndm9sdW1lJyxcbiAgcGFuZTogJ3N1YjEnLFxuICBvdXRwdXRzOiBbeyBuYW1lOiAnY21mJywgY29sb3I6ICcjOEJDMzRBJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLjIsIHpMYXllcjogMzAgfV0sXG4gIHBhcmFtczoge1xuICAgIHBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMjEsIGxhYmVsOiAnUGVyaW9kJywgbWluOiAyLCBtYXg6IDIwMCB9LFxuICB9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QgLSAxLFxuICBjYWxjdWxhdGUoZGF0YSwgeyBwZXJpb2QgfSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjbWY6IEluZGljYXRvclZhbHVlW10gPSBbXTtcbiAgICAgIGxldCBzdW1NRlYgPSAwO1xuICAgICAgbGV0IHN1bVZvbCA9IDA7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaGlnaCA9IGRhdGFbaV0uaGlnaDtcbiAgICAgICAgY29uc3QgbG93ID0gZGF0YVtpXS5sb3c7XG4gICAgICAgIGNvbnN0IGNsb3NlID0gZGF0YVtpXS5jbG9zZTtcbiAgICAgICAgY29uc3Qgdm9sdW1lID0gZGF0YVtpXS52b2x1bWU7XG4gICAgICAgIGNvbnN0IHJhbmdlID0gaGlnaCAtIGxvdztcbiAgICAgICAgY29uc3QgbWZtID0gcmFuZ2UgPT09IDAgPyAwIDogKChjbG9zZSAtIGxvdykgLSAoaGlnaCAtIGNsb3NlKSkgLyByYW5nZTtcbiAgICAgICAgY29uc3QgbWZ2ID0gbWZtICogdm9sdW1lO1xuICAgICAgICBzdW1NRlYgKz0gbWZ2O1xuICAgICAgICBzdW1Wb2wgKz0gdm9sdW1lO1xuICAgICAgICBpZiAoaSA+PSBwZXJpb2QpIHtcbiAgICAgICAgICBjb25zdCBwcmV2ID0gZGF0YVtpIC0gcGVyaW9kXTtcbiAgICAgICAgICBjb25zdCBwcmV2UmFuZ2UgPSBwcmV2LmhpZ2ggLSBwcmV2LmxvdztcbiAgICAgICAgICBjb25zdCBwcmV2TWZtID0gcHJldlJhbmdlID09PSAwID8gMCA6ICgocHJldi5jbG9zZSAtIHByZXYubG93KSAtIChwcmV2LmhpZ2ggLSBwcmV2LmNsb3NlKSkgLyBwcmV2UmFuZ2U7XG4gICAgICAgICAgc3VtTUZWIC09IHByZXZNZm0gKiBwcmV2LnZvbHVtZTtcbiAgICAgICAgICBzdW1Wb2wgLT0gcHJldi52b2x1bWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkgPCBwZXJpb2QgLSAxIHx8IHN1bVZvbCA9PT0gMCkge1xuICAgICAgICAgIGNtZi5wdXNoKG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNtZi5wdXNoKHN1bU1GViAvIHN1bVZvbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IGNtZiB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBNRkk6IEluZGljYXRvckRlZmluaXRpb248eyBwZXJpb2Q6IG51bWJlciB9LCBPaGxjdlBvaW50PiA9IHtcbiAgc2NoZW1hVmVyc2lvbjogU0NIRU1BX1ZFUlNJT04sXG4gIGlkOiAnbWZpJyxcbiAgbmFtZTogJ01GSScsXG4gIGNhdGVnb3J5OiAndm9sdW1lJyxcbiAgcGFuZTogJ3N1YjEnLFxuICBvdXRwdXRzOiBbeyBuYW1lOiAnbWZpJywgY29sb3I6ICcjRkY3MDQzJywgc3R5bGU6ICdsaW5lJywgbGluZVdpZHRoOiAxLjIsIHpMYXllcjogMzAgfV0sXG4gIHBhcmFtczoge1xuICAgIHBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMTQsIGxhYmVsOiAnUGVyaW9kJywgbWluOiAyLCBtYXg6IDIwMCB9LFxuICB9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QsXG4gIGNhbGN1bGF0ZShkYXRhLCB7IHBlcmlvZCB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1maTogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgbGV0IHBvc1N1bSA9IDA7XG4gICAgICBsZXQgbmVnU3VtID0gMDtcbiAgICAgIGNvbnN0IHR5cGljYWxQcmljZXMgPSBkYXRhLm1hcCgoZCkgPT4gKGQuaGlnaCArIGQubG93ICsgZC5jbG9zZSkgLyAzKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgIG1maS5wdXNoKG51bGwpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRwID0gdHlwaWNhbFByaWNlc1tpXTtcbiAgICAgICAgY29uc3QgcHJldlRwID0gdHlwaWNhbFByaWNlc1tpIC0gMV07XG4gICAgICAgIGNvbnN0IG1mID0gdHAgKiBkYXRhW2ldLnZvbHVtZTtcbiAgICAgICAgaWYgKHRwID4gcHJldlRwKSBwb3NTdW0gKz0gbWY7XG4gICAgICAgIGVsc2UgaWYgKHRwIDwgcHJldlRwKSBuZWdTdW0gKz0gbWY7XG5cbiAgICAgICAgaWYgKGkgPj0gcGVyaW9kKSB7XG4gICAgICAgICAgY29uc3Qgb2xkVHAgPSB0eXBpY2FsUHJpY2VzW2kgLSBwZXJpb2RdO1xuICAgICAgICAgIGNvbnN0IG9sZFByZXZUcCA9IHR5cGljYWxQcmljZXNbaSAtIHBlcmlvZCAtIDFdO1xuICAgICAgICAgIGNvbnN0IG9sZE1mID0gb2xkVHAgKiBkYXRhW2kgLSBwZXJpb2RdLnZvbHVtZTtcbiAgICAgICAgICBpZiAob2xkVHAgPiBvbGRQcmV2VHApIHBvc1N1bSAtPSBvbGRNZjtcbiAgICAgICAgICBlbHNlIGlmIChvbGRUcCA8IG9sZFByZXZUcCkgbmVnU3VtIC09IG9sZE1mO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGkgPCBwZXJpb2QpIHtcbiAgICAgICAgICBtZmkucHVzaChudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCByYXRpbyA9IG5lZ1N1bSA9PT0gMCA/IDEwMCA6IHBvc1N1bSAvIG5lZ1N1bTtcbiAgICAgICAgICBtZmkucHVzaCgxMDAgLSAxMDAgLyAoMSArIHJhdGlvKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvayh7IG1maSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFpbChTdHJpbmcoZSkpO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBLYXVmbWFuUGF0dGVybnM6IEluZGljYXRvckRlZmluaXRpb248e30sIE9obGN2UG9pbnQ+ID0ge1xuICBzY2hlbWFWZXJzaW9uOiBTQ0hFTUFfVkVSU0lPTixcbiAgaWQ6ICdrYXVmbWFuX3BhdHRlcm5zJyxcbiAgbmFtZTogJ0thdWZtYW4gUGF0dGVybnMnLFxuICBjYXRlZ29yeTogJ2N1c3RvbScsXG4gIHBhbmU6ICdtYWluJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ2thdWZtYW4nLCBjb2xvcjogJyNGRkMxMDcnLCBzdHlsZTogJ21hcmtlcicsIHpMYXllcjogNDAgfV0sXG4gIHBhcmFtczoge30sXG4gIGNvbXBsZXhpdHk6IHsgdGltZTogJ08obiknLCBzcGFjZTogJ08obiknIH0sXG4gIHdhcm11cFBlcmlvZDogKCkgPT4gMixcbiAgY2FsY3VsYXRlKCkge1xuICAgIHJldHVybiBvayh7IGthdWZtYW46IFtdIH0pO1xuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IFNxdWVlemVBbGVydDogSW5kaWNhdG9yRGVmaW5pdGlvbjx7IHBlcmlvZDogbnVtYmVyOyBzdGREZXY6IG51bWJlcjsgdGhyZXNob2xkOiBudW1iZXIgfSwgT2hsY3ZQb2ludD4gPSB7XG4gIHNjaGVtYVZlcnNpb246IFNDSEVNQV9WRVJTSU9OLFxuICBpZDogJ3NxdWVlemVfYWxlcnQnLFxuICBuYW1lOiAnU3F1ZWV6ZSBBbGVydCcsXG4gIGNhdGVnb3J5OiAndm9sYXRpbGl0eScsXG4gIHBhbmU6ICdtYWluJyxcbiAgb3V0cHV0czogW3sgbmFtZTogJ3NxdWVlemUnLCBjb2xvcjogJyNGRjk4MDAnLCBzdHlsZTogJ21hcmtlcicsIHpMYXllcjogNDAgfV0sXG4gIHBhcmFtczoge1xuICAgIHBlcmlvZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMjAsIGxhYmVsOiAnUGVyaW9kJywgbWluOiA1LCBtYXg6IDEwMCB9LFxuICAgIHN0ZERldjogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMi4wLCBsYWJlbDogJ1N0ZCBEZXYnLCBtaW46IDAuNSwgbWF4OiA0LjAsIHN0ZXA6IDAuMSB9LFxuICAgIHRocmVzaG9sZDogeyB0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogMC4wNCwgbGFiZWw6ICdUaHJlc2hvbGQnLCBtaW46IDAuMDEsIG1heDogMC4yLCBzdGVwOiAwLjAxIH0sXG4gIH0sXG4gIGNvbXBsZXhpdHk6IHsgdGltZTogJ08obiknLCBzcGFjZTogJ08obiknIH0sXG4gIHdhcm11cFBlcmlvZDogKHsgcGVyaW9kIH0pID0+IHBlcmlvZCAtIDEsXG4gIGNhbGN1bGF0ZShkYXRhLCB7IHBlcmlvZCwgc3RkRGV2LCB0aHJlc2hvbGQgfSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzcXVlZXplOiBJbmRpY2F0b3JWYWx1ZVtdID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGkgPCBwZXJpb2QgLSAxKSB7XG4gICAgICAgICAgc3F1ZWV6ZS5wdXNoKG51bGwpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNsaWNlID0gZGF0YS5zbGljZShpIC0gcGVyaW9kICsgMSwgaSArIDEpO1xuICAgICAgICBjb25zdCBjbG9zZXMgPSBzbGljZS5tYXAoKGQpID0+IGQuY2xvc2UpO1xuICAgICAgICBjb25zdCBzbWEgPSBjbG9zZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCkgLyBwZXJpb2Q7XG4gICAgICAgIGNvbnN0IHZhcmlhbmNlID0gY2xvc2VzLnJlZHVjZSgoYSwgYikgPT4gYSArIChiIC0gc21hKSAqKiAyLCAwKSAvIHBlcmlvZDtcbiAgICAgICAgY29uc3Qgc3RkID0gTWF0aC5zcXJ0KHZhcmlhbmNlKTtcbiAgICAgICAgY29uc3QgdXBwZXIgPSBzbWEgKyBzdGREZXYgKiBzdGQ7XG4gICAgICAgIGNvbnN0IGxvd2VyID0gc21hIC0gc3RkRGV2ICogc3RkO1xuICAgICAgICBjb25zdCB3aWR0aCA9IHNtYSA+IDAgPyAodXBwZXIgLSBsb3dlcikgLyBzbWEgOiAwO1xuICAgICAgICBzcXVlZXplLnB1c2god2lkdGggPCB0aHJlc2hvbGQgPyBkYXRhW2ldLmNsb3NlIDogbnVsbCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2soeyBzcXVlZXplIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWlsKFN0cmluZyhlKSk7XG4gICAgfVxuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IERpdmVyZ2VuY2U6IEluZGljYXRvckRlZmluaXRpb248eyBwZXJpb2Q6IG51bWJlciB9LCBPaGxjdlBvaW50PiA9IHtcbiAgc2NoZW1hVmVyc2lvbjogU0NIRU1BX1ZFUlNJT04sXG4gIGlkOiAnZGl2ZXJnZW5jZScsXG4gIG5hbWU6ICdEaXZlcmdlbmNlJyxcbiAgY2F0ZWdvcnk6ICdjdXN0b20nLFxuICBwYW5lOiAnbWFpbicsXG4gIG91dHB1dHM6IFt7IG5hbWU6ICdkaXZlcmdlbmNlJywgY29sb3I6ICcjRkZDMTA3Jywgc3R5bGU6ICdtYXJrZXInLCB6TGF5ZXI6IDQwIH1dLFxuICBwYXJhbXM6IHtcbiAgICBwZXJpb2Q6IHsgdHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IDE0LCBsYWJlbDogJ1BlcmlvZCcsIG1pbjogMiwgbWF4OiA1MCB9LFxuICB9LFxuICBjb21wbGV4aXR5OiB7IHRpbWU6ICdPKG4pJywgc3BhY2U6ICdPKG4pJyB9LFxuICB3YXJtdXBQZXJpb2Q6ICh7IHBlcmlvZCB9KSA9PiBwZXJpb2QsXG4gIGNhbGN1bGF0ZShkYXRhLCB7IHBlcmlvZCB9KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJzaTogbnVtYmVyW10gPSBbXTtcbiAgICAgIGxldCBhdmdHYWluID0gMDtcbiAgICAgIGxldCBhdmdMb3NzID0gMDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgIHJzaS5wdXNoKE5hTik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2hhbmdlID0gZGF0YVtpXS5jbG9zZSAtIGRhdGFbaSAtIDFdLmNsb3NlO1xuICAgICAgICBjb25zdCBnYWluID0gY2hhbmdlID4gMCA/IGNoYW5nZSA6IDA7XG4gICAgICAgIGNvbnN0IGxvc3MgPSBjaGFuZ2UgPCAwID8gLWNoYW5nZSA6IDA7XG4gICAgICAgIGlmIChpIDwgcGVyaW9kKSB7XG4gICAgICAgICAgYXZnR2FpbiArPSBnYWluIC8gcGVyaW9kO1xuICAgICAgICAgIGF2Z0xvc3MgKz0gbG9zcyAvIHBlcmlvZDtcbiAgICAgICAgICByc2kucHVzaChOYU4pO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IHBlcmlvZCkge1xuICAgICAgICAgIGF2Z0dhaW4gKz0gZ2FpbiAvIHBlcmlvZDtcbiAgICAgICAgICBhdmdMb3NzICs9IGxvc3MgLyBwZXJpb2Q7XG4gICAgICAgICAgY29uc3QgcnMgPSBhdmdMb3NzID09PSAwID8gMTAwIDogYXZnR2FpbiAvIGF2Z0xvc3M7XG4gICAgICAgICAgcnNpLnB1c2goMTAwIC0gMTAwIC8gKDEgKyBycykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF2Z0dhaW4gPSAoYXZnR2FpbiAqIChwZXJpb2QgLSAxKSArIGdhaW4pIC8gcGVyaW9kO1xuICAgICAgICAgIGF2Z0xvc3MgPSAoYXZnTG9zcyAqIChwZXJpb2QgLSAxKSArIGxvc3MpIC8gcGVyaW9kO1xuICAgICAgICAgIGNvbnN0IHJzID0gYXZnTG9zcyA9PT0gMCA/IDEwMCA6IGF2Z0dhaW4gLyBhdmdMb3NzO1xuICAgICAgICAgIHJzaS5wdXNoKDEwMCAtIDEwMCAvICgxICsgcnMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgZGl2ZXJnZW5jZTogSW5kaWNhdG9yVmFsdWVbXSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpIDwgcGVyaW9kICsgMikge1xuICAgICAgICAgIGRpdmVyZ2VuY2UucHVzaChudWxsKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcmV2ID0gaSAtIDI7XG4gICAgICAgIGNvbnN0IHByaWNlSGlnaGVyID0gZGF0YVtpXS5jbG9zZSA+IGRhdGFbcHJldl0uY2xvc2U7XG4gICAgICAgIGNvbnN0IHJzaUxvd2VyID0gcnNpW2ldIDwgcnNpW3ByZXZdO1xuICAgICAgICBkaXZlcmdlbmNlLnB1c2gocHJpY2VIaWdoZXIgJiYgcnNpTG93ZXIgPyBkYXRhW2ldLmNsb3NlIDogbnVsbCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2soeyBkaXZlcmdlbmNlIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWlsKFN0cmluZyhlKSk7XG4gICAgfVxuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IFBoYXNlNEluZGljYXRvcnMgPSBbT0JWLCBDTUYsIE1GSSwgS2F1Zm1hblBhdHRlcm5zLCBTcXVlZXplQWxlcnQsIERpdmVyZ2VuY2VdIGFzIGNvbnN0O1xuXG5leHBvcnQgY29uc3QgcmVnaXN0ZXJQaGFzZTRJbmRpY2F0b3JzID0gKHJlZ2lzdHJ5OiBJbmRpY2F0b3JSZWdpc3RyeSk6IHZvaWQgPT4ge1xuICBQaGFzZTRJbmRpY2F0b3JzLmZvckVhY2goKGluZGljYXRvcikgPT4gcmVnaXN0cnkucmVnaXN0ZXIoaW5kaWNhdG9yIGFzIEluZGljYXRvckRlZmluaXRpb248YW55LCBhbnk+KSk7XG59O1xuIiwKICAiZXhwb3J0IHR5cGUgVHJhZGVNYXJrZXJUeXBlID1cbiAgfCAnZW50cnlfbG9uZydcbiAgfCAnZW50cnlfc2hvcnQnXG4gIHwgJ2V4aXRfbG9uZydcbiAgfCAnZXhpdF9zaG9ydCdcbiAgfCAnc3RvcF9sb3NzJ1xuICB8ICd0YWtlX3Byb2ZpdCdcbiAgfCAnc2lnbmFsJ1xuICB8ICdhbGVydCc7XG5cbmV4cG9ydCB0eXBlIFRyYWRlTWFya2VyID0ge1xuICB0eXBlOiBUcmFkZU1hcmtlclR5cGU7XG4gIHRpbWU6IG51bWJlcjtcbiAgcHJpY2U6IG51bWJlcjtcbiAgbGFiZWw/OiBzdHJpbmc7XG4gIHNpemU/OiBudW1iZXI7XG4gIG1ldGFkYXRhPzoge1xuICAgIHRyYWRlSWQ/OiBzdHJpbmc7XG4gICAgcHJvZml0PzogbnVtYmVyO1xuICAgIHF1YW50aXR5PzogbnVtYmVyO1xuICAgIHN0cmF0ZWd5Pzogc3RyaW5nO1xuICB9O1xufTtcblxuZXhwb3J0IHR5cGUgVHJhZGVNYXJrZXJTdHlsZSA9IHtcbiAgc2hhcGU6ICd0cmlhbmdsZV91cCcgfCAndHJpYW5nbGVfZG93bicgfCAnY2lyY2xlJyB8ICdjcm9zcycgfCAnZGlhbW9uZCcgfCAnd2FybmluZyc7XG4gIGNvbG9yOiBzdHJpbmc7XG4gIGJvcmRlckNvbG9yPzogc3RyaW5nO1xuICBzaXplOiBudW1iZXI7XG59O1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9NQVJLRVJfU1RZTEVTOiBSZWNvcmQ8VHJhZGVNYXJrZXJUeXBlLCBUcmFkZU1hcmtlclN0eWxlPiA9IHtcbiAgZW50cnlfbG9uZzogeyBzaGFwZTogJ3RyaWFuZ2xlX3VwJywgY29sb3I6ICcjNENBRjUwJywgc2l6ZTogMTAgfSxcbiAgZW50cnlfc2hvcnQ6IHsgc2hhcGU6ICd0cmlhbmdsZV9kb3duJywgY29sb3I6ICcjRjQ0MzM2Jywgc2l6ZTogMTAgfSxcbiAgZXhpdF9sb25nOiB7IHNoYXBlOiAndHJpYW5nbGVfdXAnLCBjb2xvcjogJyM4MUM3ODQnLCBib3JkZXJDb2xvcjogJyM0Q0FGNTAnLCBzaXplOiA4IH0sXG4gIGV4aXRfc2hvcnQ6IHsgc2hhcGU6ICd0cmlhbmdsZV9kb3duJywgY29sb3I6ICcjRTU3MzczJywgYm9yZGVyQ29sb3I6ICcjRjQ0MzM2Jywgc2l6ZTogOCB9LFxuICBzdG9wX2xvc3M6IHsgc2hhcGU6ICdjcm9zcycsIGNvbG9yOiAnI0Y0NDMzNicsIHNpemU6IDEwIH0sXG4gIHRha2VfcHJvZml0OiB7IHNoYXBlOiAnY2lyY2xlJywgY29sb3I6ICcjNENBRjUwJywgc2l6ZTogOCB9LFxuICBzaWduYWw6IHsgc2hhcGU6ICdkaWFtb25kJywgY29sb3I6ICcjRkZDMTA3Jywgc2l6ZTogOCB9LFxuICBhbGVydDogeyBzaGFwZTogJ3dhcm5pbmcnLCBjb2xvcjogJyNGRjk4MDAnLCBzaXplOiAxMCB9LFxufTtcbiIsCiAgImltcG9ydCB0eXBlIHsgQ2hhcnRDb25maWcsIENoYXJ0T3B0aW9ucywgSW5kaWNhdG9ySW5zdGFuY2UsIE9obGN2UG9pbnQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgQ2hhcnRSZW5kZXJlciB9IGZyb20gJy4uL3JlbmRlcmVyL3JlbmRlcmVyJztcbmltcG9ydCB7IFdlYkdMMlJlbmRlcmVyIH0gZnJvbSAnLi4vcmVuZGVyZXIvd2ViZ2wyL3dlYmdsMlJlbmRlcmVyJztcbmltcG9ydCB7IFdlYkdQVVJlbmRlcmVyIH0gZnJvbSAnLi4vcmVuZGVyZXIvd2ViZ3B1L3dlYmdwdVJlbmRlcmVyJztcbmltcG9ydCB0eXBlIHsgSW5kaWNhdG9yRGVmaW5pdGlvbiB9IGZyb20gJy4vaW5kaWNhdG9yVHlwZXMnO1xuaW1wb3J0IHsgSW5NZW1vcnlJbmRpY2F0b3JSZWdpc3RyeSB9IGZyb20gJy4vaW5kaWNhdG9ycyc7XG5pbXBvcnQgeyByZWdpc3RlclBoYXNlMUluZGljYXRvcnMgfSBmcm9tICcuLi9pbmRpY2F0b3JzL3BoYXNlMSc7XG5pbXBvcnQgeyByZWdpc3RlclBoYXNlMkluZGljYXRvcnMgfSBmcm9tICcuLi9pbmRpY2F0b3JzL3BoYXNlMic7XG5pbXBvcnQgeyByZWdpc3RlclBoYXNlM0luZGljYXRvcnMgfSBmcm9tICcuLi9pbmRpY2F0b3JzL3BoYXNlMyc7XG5pbXBvcnQgeyByZWdpc3RlclBoYXNlNEluZGljYXRvcnMgfSBmcm9tICcuLi9pbmRpY2F0b3JzL3BoYXNlNCc7XG5pbXBvcnQgeyBERUZBVUxUX01BUktFUl9TVFlMRVMsIHR5cGUgVHJhZGVNYXJrZXIgfSBmcm9tICcuL3RyYWRlTWFya2Vycyc7XG5cbmV4cG9ydCBjbGFzcyBNb0NoYXJ0IHtcbiAgcHJpdmF0ZSByZW5kZXJlcjogQ2hhcnRSZW5kZXJlcjtcbiAgcHJpdmF0ZSBkYXRhOiBPaGxjdlBvaW50W107XG4gIHByaXZhdGUgY29uZmlnOiBDaGFydENvbmZpZztcbiAgcHJpdmF0ZSByYWZJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcmVnaXN0cnkgPSBuZXcgSW5NZW1vcnlJbmRpY2F0b3JSZWdpc3RyeSgpO1xuICBwcml2YXRlIGluZGljYXRvckluc3RhbmNlczogSW5kaWNhdG9ySW5zdGFuY2VbXSA9IFtdO1xuICBwcml2YXRlIHRyYWRlTWFya2VyczogVHJhZGVNYXJrZXJbXSA9IFtdO1xuICBwcml2YXRlIGFsZXJ0Q2FsbGJhY2tzOiBBcnJheTwoYWxlcnQ6IHsgaW5kaWNhdG9ySWQ6IHN0cmluZzsgYWxlcnRJZDogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmcgfSkgPT4gdm9pZD4gPSBbXTtcbiAgcHJpdmF0ZSBsYXN0QWxlcnRBdCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgY29uc3RydWN0b3IoY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCwgb3B0aW9uczogQ2hhcnRPcHRpb25zKSB7XG4gICAgdGhpcy5kYXRhID0gb3B0aW9ucy5kYXRhO1xuICAgIHRoaXMuY29uZmlnID0gb3B0aW9ucy5jb25maWcgPz8ge307XG4gICAgdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMgPSB0aGlzLmNvbmZpZy5pbmRpY2F0b3JzID8/IFtdO1xuICAgIHRoaXMudHJhZGVNYXJrZXJzID0gdGhpcy5jb25maWcudHJhZGVNYXJrZXJzID8/IFtdO1xuXG4gICAgcmVnaXN0ZXJQaGFzZTFJbmRpY2F0b3JzKHRoaXMucmVnaXN0cnkpO1xuICAgIHJlZ2lzdGVyUGhhc2UySW5kaWNhdG9ycyh0aGlzLnJlZ2lzdHJ5KTtcbiAgICByZWdpc3RlclBoYXNlM0luZGljYXRvcnModGhpcy5yZWdpc3RyeSk7XG4gICAgcmVnaXN0ZXJQaGFzZTRJbmRpY2F0b3JzKHRoaXMucmVnaXN0cnkpO1xuXG4gICAgdGhpcy5yZW5kZXJlciA9ICdncHUnIGluIG5hdmlnYXRvciA/IG5ldyBXZWJHUFVSZW5kZXJlcigpIDogbmV3IFdlYkdMMlJlbmRlcmVyKCk7XG4gICAgdGhpcy5yZW5kZXJlci5pbml0aWFsaXplKGNhbnZhcyk7XG4gICAgdGhpcy5yZW5kZXJlci5zZXRDb25maWcodGhpcy5jb25maWcpO1xuICAgIHRoaXMucmVuZGVyZXIuc2V0RGF0YSh0aGlzLmRhdGEpO1xuICAgIHRoaXMucmVidWlsZEluZGljYXRvclNlZ21lbnRzKCk7XG5cbiAgICB0aGlzLnN0YXJ0KCk7XG4gIH1cblxuICBzdGFydCgpOiB2b2lkIHtcbiAgICBjb25zdCB0aWNrID0gKCkgPT4ge1xuICAgICAgdGhpcy5yZW5kZXJlci5yZW5kZXIoKTtcbiAgICAgIHRoaXMucmFmSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLnJhZklkID09PSBudWxsKSB7XG4gICAgICB0aGlzLnJhZklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIH1cbiAgfVxuXG4gIHN0b3AoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmFmSWQgIT09IG51bGwpIHtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMucmFmSWQpO1xuICAgICAgdGhpcy5yYWZJZCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgc2V0RGF0YShkYXRhOiBPaGxjdlBvaW50W10pOiB2b2lkIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIHRoaXMucmVuZGVyZXIuc2V0RGF0YShkYXRhKTtcbiAgICB0aGlzLnJlYnVpbGRJbmRpY2F0b3JTZWdtZW50cygpO1xuICB9XG5cbiAgc2V0Q29uZmlnKGNvbmZpZzogQ2hhcnRDb25maWcpOiB2b2lkIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmluZGljYXRvckluc3RhbmNlcyA9IGNvbmZpZy5pbmRpY2F0b3JzID8/IFtdO1xuICAgIHRoaXMudHJhZGVNYXJrZXJzID0gY29uZmlnLnRyYWRlTWFya2VycyA/PyBbXTtcbiAgICB0aGlzLnJlbmRlcmVyLnNldENvbmZpZyhjb25maWcpO1xuICAgIHRoaXMucmVidWlsZEluZGljYXRvclNlZ21lbnRzKCk7XG4gIH1cblxuICByZWdpc3RlckluZGljYXRvcjxUPihkZWZpbml0aW9uOiBJbmRpY2F0b3JEZWZpbml0aW9uPFQ+KTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3RyeS5yZWdpc3RlcihkZWZpbml0aW9uKTtcbiAgfVxuXG4gIGFkZEluZGljYXRvcihpZDogc3RyaW5nLCBwYXJhbXM/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHN0cmluZyB7XG4gICAgY29uc3QgaW5zdGFuY2VJZCA9IGBpbmRfJHtjcnlwdG8ucmFuZG9tVVVJRCgpfWA7XG4gICAgdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMgPSBbXG4gICAgICAuLi50aGlzLmluZGljYXRvckluc3RhbmNlcyxcbiAgICAgIHsgaWQsIGluc3RhbmNlSWQsIHBhcmFtcywgZW5hYmxlZDogdHJ1ZSB9LFxuICAgIF07XG4gICAgdGhpcy5zZXRDb25maWcoeyAuLi50aGlzLmNvbmZpZywgaW5kaWNhdG9yczogdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMgfSk7XG4gICAgcmV0dXJuIGluc3RhbmNlSWQ7XG4gIH1cblxuICByZW1vdmVJbmRpY2F0b3IoaW5zdGFuY2VJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMgPSB0aGlzLmluZGljYXRvckluc3RhbmNlcy5maWx0ZXIoKGluZCkgPT4gaW5kLmluc3RhbmNlSWQgIT09IGluc3RhbmNlSWQpO1xuICAgIHRoaXMuc2V0Q29uZmlnKHsgLi4udGhpcy5jb25maWcsIGluZGljYXRvcnM6IHRoaXMuaW5kaWNhdG9ySW5zdGFuY2VzIH0pO1xuICB9XG5cbiAgdXBkYXRlUGFyYW1zKGluc3RhbmNlSWQ6IHN0cmluZywgcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHZvaWQge1xuICAgIHRoaXMuaW5kaWNhdG9ySW5zdGFuY2VzID0gdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMubWFwKChpbmQpID0+XG4gICAgICBpbmQuaW5zdGFuY2VJZCA9PT0gaW5zdGFuY2VJZCA/IHsgLi4uaW5kLCBwYXJhbXMgfSA6IGluZFxuICAgICk7XG4gICAgdGhpcy5zZXRDb25maWcoeyAuLi50aGlzLmNvbmZpZywgaW5kaWNhdG9yczogdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMgfSk7XG4gIH1cblxuICB0b2dnbGVWaXNpYmlsaXR5KGluc3RhbmNlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuaW5kaWNhdG9ySW5zdGFuY2VzID0gdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMubWFwKChpbmQpID0+XG4gICAgICBpbmQuaW5zdGFuY2VJZCA9PT0gaW5zdGFuY2VJZCA/IHsgLi4uaW5kLCBlbmFibGVkOiAhaW5kLmVuYWJsZWQgfSA6IGluZFxuICAgICk7XG4gICAgdGhpcy5zZXRDb25maWcoeyAuLi50aGlzLmNvbmZpZywgaW5kaWNhdG9yczogdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMgfSk7XG4gIH1cblxuICBnZXRBY3RpdmVJbmRpY2F0b3JzKCk6IEluZGljYXRvckluc3RhbmNlW10ge1xuICAgIHJldHVybiB0aGlzLmluZGljYXRvckluc3RhbmNlcztcbiAgfVxuXG4gIGFkZFRyYWRlTWFya2VycyhtYXJrZXJzOiBUcmFkZU1hcmtlcltdKTogdm9pZCB7XG4gICAgdGhpcy50cmFkZU1hcmtlcnMgPSBbLi4udGhpcy50cmFkZU1hcmtlcnMsIC4uLm1hcmtlcnNdO1xuICAgIHRoaXMuc2V0Q29uZmlnKHsgLi4udGhpcy5jb25maWcsIHRyYWRlTWFya2VyczogdGhpcy50cmFkZU1hcmtlcnMgfSk7XG4gIH1cblxuICBjbGVhclRyYWRlTWFya2VycygpOiB2b2lkIHtcbiAgICB0aGlzLnRyYWRlTWFya2VycyA9IFtdO1xuICAgIHRoaXMuc2V0Q29uZmlnKHsgLi4udGhpcy5jb25maWcsIHRyYWRlTWFya2VyczogW10gfSk7XG4gIH1cblxuICBvbkFsZXJ0KGNhbGxiYWNrOiAoYWxlcnQ6IHsgaW5kaWNhdG9ySWQ6IHN0cmluZzsgYWxlcnRJZDogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmcgfSkgPT4gdm9pZCk6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuYWxlcnRDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuYWxlcnRDYWxsYmFja3MgPSB0aGlzLmFsZXJ0Q2FsbGJhY2tzLmZpbHRlcigoY2IpID0+IGNiICE9PSBjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVidWlsZEluZGljYXRvclNlZ21lbnRzKCk6IHZvaWQge1xuICAgIGNvbnN0IHNlZ21lbnRzID0gdGhpcy5jb21wdXRlSW5kaWNhdG9yU2VnbWVudHMoKTtcbiAgICB0aGlzLnJlbmRlcmVyLnNldEluZGljYXRvclNlZ21lbnRzKHNlZ21lbnRzKTtcbiAgICB2b2lkIHRoaXMucmVidWlsZEluZGljYXRvclNlZ21lbnRzR1BVKCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlYnVpbGRJbmRpY2F0b3JTZWdtZW50c0dQVSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoISh0aGlzLnJlbmRlcmVyIGluc3RhbmNlb2YgV2ViR1BVUmVuZGVyZXIpKSByZXR1cm47XG4gICAgY29uc3Qgc2VnbWVudHMgPSBhd2FpdCB0aGlzLmNvbXB1dGVJbmRpY2F0b3JTZWdtZW50c0dQVSh0aGlzLnJlbmRlcmVyKTtcbiAgICBpZiAoc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbmRlcmVyLnNldEluZGljYXRvclNlZ21lbnRzKHNlZ21lbnRzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNvbXB1dGVJbmRpY2F0b3JTZWdtZW50cygpOiBGbG9hdDMyQXJyYXkge1xuICAgIGlmICghdGhpcy5kYXRhLmxlbmd0aCB8fCB0aGlzLmluZGljYXRvckluc3RhbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBuZXcgRmxvYXQzMkFycmF5KCk7XG4gICAgfVxuXG4gICAgY29uc3QgY291bnQgPSB0aGlzLmRhdGEubGVuZ3RoO1xuICAgIGNvbnN0IHN0ZXAgPSAyIC8gTWF0aC5tYXgoMSwgY291bnQgLSAxKTtcbiAgICBjb25zdCB0b1ggPSAoaTogbnVtYmVyKSA9PiAtMSArIHN0ZXAgKiBpO1xuXG4gICAgY29uc3QgbWFpblJhbmdlID0ge1xuICAgICAgbWluOiBNYXRoLm1pbiguLi50aGlzLmRhdGEubWFwKChkKSA9PiBkLmxvdykpLFxuICAgICAgbWF4OiBNYXRoLm1heCguLi50aGlzLmRhdGEubWFwKChkKSA9PiBkLmhpZ2gpKSxcbiAgICB9O1xuICAgIGNvbnN0IHN1YlJhbmdlczogUmVjb3JkPCdzdWIxJyB8ICdzdWIyJyB8ICdzdWIzJywgeyBtaW46IG51bWJlcjsgbWF4OiBudW1iZXIgfT4gPSB7XG4gICAgICBzdWIxOiB7IG1pbjogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLCBtYXg6IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSB9LFxuICAgICAgc3ViMjogeyBtaW46IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSwgbWF4OiBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkgfSxcbiAgICAgIHN1YjM6IHsgbWluOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIG1heDogTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZIH0sXG4gICAgfTtcbiAgICBjb25zdCBwYW5lTGF5b3V0OiBSZWNvcmQ8J21haW4nIHwgJ3N1YjEnIHwgJ3N1YjInIHwgJ3N1YjMnLCB7IHRvcDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9PiA9IHtcbiAgICAgIG1haW46IHsgdG9wOiAwLCBoZWlnaHQ6IDAuNiB9LFxuICAgICAgc3ViMTogeyB0b3A6IDAuNiwgaGVpZ2h0OiAwLjE1IH0sXG4gICAgICBzdWIyOiB7IHRvcDogMC43NSwgaGVpZ2h0OiAwLjE1IH0sXG4gICAgICBzdWIzOiB7IHRvcDogMC45LCBoZWlnaHQ6IDAuMSB9LFxuICAgIH07XG5cbiAgICBjb25zdCB1cGRhdGVSYW5nZSA9IChwYW5lOiAnc3ViMScgfCAnc3ViMicgfCAnc3ViMycsIHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHJhbmdlID0gc3ViUmFuZ2VzW3BhbmVdO1xuICAgICAgcmFuZ2UubWluID0gTWF0aC5taW4ocmFuZ2UubWluLCB2YWx1ZSk7XG4gICAgICByYW5nZS5tYXggPSBNYXRoLm1heChyYW5nZS5tYXgsIHZhbHVlKTtcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiB0aGlzLmluZGljYXRvckluc3RhbmNlcykge1xuICAgICAgaWYgKGluc3RhbmNlLmVuYWJsZWQgPT09IGZhbHNlKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlZiA9IHRoaXMucmVnaXN0cnkuZ2V0KGluc3RhbmNlLmlkKTtcbiAgICAgIGlmICghZGVmIHx8IGRlZi5wYW5lID09PSAnbWFpbicpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcGFyYW1zID0gKGluc3RhbmNlLnBhcmFtcyA/PyB7fSkgYXMgYW55O1xuICAgICAgY29uc3QgcmVzdWx0ID0gZGVmLmNhbGN1bGF0ZSh0aGlzLmRhdGEsIHBhcmFtcyk7XG4gICAgICBpZiAoIXJlc3VsdC5vaykgY29udGludWU7XG4gICAgICBmb3IgKGNvbnN0IG91dHB1dCBvZiBkZWYub3V0cHV0cykge1xuICAgICAgICBjb25zdCBzZXJpZXMgPSByZXN1bHQudmFsdWVbb3V0cHV0Lm5hbWVdO1xuICAgICAgICBpZiAoIXNlcmllcykgY29udGludWU7XG4gICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2Ygc2VyaWVzKSB7XG4gICAgICAgICAgaWYgKHZhbHVlID09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgICAgIHVwZGF0ZVJhbmdlKGRlZi5wYW5lLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVSYW5nZSA9IChwYW5lOiAnc3ViMScgfCAnc3ViMicgfCAnc3ViMycpID0+IHtcbiAgICAgIGNvbnN0IHJhbmdlID0gc3ViUmFuZ2VzW3BhbmVdO1xuICAgICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUocmFuZ2UubWluKSB8fCAhTnVtYmVyLmlzRmluaXRlKHJhbmdlLm1heCkpIHtcbiAgICAgICAgcmFuZ2UubWluID0gMDtcbiAgICAgICAgcmFuZ2UubWF4ID0gMTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZS5taW4gPT09IHJhbmdlLm1heCkge1xuICAgICAgICByYW5nZS5taW4gLT0gMTtcbiAgICAgICAgcmFuZ2UubWF4ICs9IDE7XG4gICAgICB9XG4gICAgfTtcblxuICAgIG5vcm1hbGl6ZVJhbmdlKCdzdWIxJyk7XG4gICAgbm9ybWFsaXplUmFuZ2UoJ3N1YjInKTtcbiAgICBub3JtYWxpemVSYW5nZSgnc3ViMycpO1xuXG4gICAgY29uc3QgdG9QYW5lWSA9IChwYW5lOiAnbWFpbicgfCAnc3ViMScgfCAnc3ViMicgfCAnc3ViMycsIHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IGxheW91dCA9IHBhbmVMYXlvdXRbcGFuZV07XG4gICAgICBjb25zdCB0b3BOZGMgPSAxIC0gMiAqIGxheW91dC50b3A7XG4gICAgICBjb25zdCBib3R0b21OZGMgPSAxIC0gMiAqIChsYXlvdXQudG9wICsgbGF5b3V0LmhlaWdodCk7XG4gICAgICBsZXQgbWluID0gbWFpblJhbmdlLm1pbjtcbiAgICAgIGxldCBtYXggPSBtYWluUmFuZ2UubWF4O1xuICAgICAgaWYgKHBhbmUgIT09ICdtYWluJykge1xuICAgICAgICBtaW4gPSBzdWJSYW5nZXNbcGFuZV0ubWluO1xuICAgICAgICBtYXggPSBzdWJSYW5nZXNbcGFuZV0ubWF4O1xuICAgICAgfVxuICAgICAgY29uc3QgcmF0aW8gPSAodmFsdWUgLSBtaW4pIC8gKG1heCAtIG1pbik7XG4gICAgICByZXR1cm4gYm90dG9tTmRjICsgKHRvcE5kYyAtIGJvdHRvbU5kYykgKiByYXRpbztcbiAgICB9O1xuXG4gICAgY29uc3QgdmVydGljZXM6IG51bWJlcltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIHRoaXMuaW5kaWNhdG9ySW5zdGFuY2VzKSB7XG4gICAgICBpZiAoaW5zdGFuY2UuZW5hYmxlZCA9PT0gZmFsc2UpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgZGVmID0gdGhpcy5yZWdpc3RyeS5nZXQoaW5zdGFuY2UuaWQpO1xuICAgICAgaWYgKCFkZWYgfHwgZGVmLnBhbmUgIT09ICdtYWluJykgY29udGludWU7XG4gICAgICBjb25zdCBwYXJhbXMgPSAoaW5zdGFuY2UucGFyYW1zID8/IHt9KSBhcyBhbnk7XG4gICAgICBjb25zdCByZXN1bHQgPSBkZWYuY2FsY3VsYXRlKHRoaXMuZGF0YSwgcGFyYW1zKTtcbiAgICAgIGlmICghcmVzdWx0Lm9rKSBjb250aW51ZTtcblxuICAgICAgZm9yIChjb25zdCBvdXRwdXQgb2YgZGVmLm91dHB1dHMpIHtcbiAgICAgICAgaWYgKG91dHB1dC5zdHlsZSAhPT0gJ2xpbmUnKSBjb250aW51ZTtcbiAgICAgICAgY29uc3Qgc2VyaWVzID0gcmVzdWx0LnZhbHVlW291dHB1dC5uYW1lXTtcbiAgICAgICAgaWYgKCFzZXJpZXMpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBjb2xvciA9IHRoaXMucGFyc2VDb2xvcihvdXRwdXQuY29sb3IpO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHNlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IHByZXYgPSBzZXJpZXNbaSAtIDFdO1xuICAgICAgICAgIGNvbnN0IGN1ciA9IHNlcmllc1tpXTtcbiAgICAgICAgICBpZiAocHJldiA9PSBudWxsIHx8IGN1ciA9PSBudWxsKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCB4MCA9IHRvWChpIC0gMSk7XG4gICAgICAgICAgY29uc3QgeTAgPSB0b1BhbmVZKCdtYWluJywgcHJldik7XG4gICAgICAgICAgY29uc3QgeDEgPSB0b1goaSk7XG4gICAgICAgICAgY29uc3QgeTEgPSB0b1BhbmVZKCdtYWluJywgY3VyKTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHgwLCB5MCwgLi4uY29sb3IpO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeDEsIHkxLCAuLi5jb2xvcik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5ldmFsdWF0ZUFsZXJ0cyhkZWYsIHJlc3VsdC52YWx1ZSwgdGhpcy5kYXRhW3RoaXMuZGF0YS5sZW5ndGggLSAxXSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiB0aGlzLmluZGljYXRvckluc3RhbmNlcykge1xuICAgICAgaWYgKGluc3RhbmNlLmVuYWJsZWQgPT09IGZhbHNlKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlZiA9IHRoaXMucmVnaXN0cnkuZ2V0KGluc3RhbmNlLmlkKTtcbiAgICAgIGlmICghZGVmIHx8IGRlZi5wYW5lID09PSAnbWFpbicpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcGFyYW1zID0gKGluc3RhbmNlLnBhcmFtcyA/PyB7fSkgYXMgYW55O1xuICAgICAgY29uc3QgcmVzdWx0ID0gZGVmLmNhbGN1bGF0ZSh0aGlzLmRhdGEsIHBhcmFtcyk7XG4gICAgICBpZiAoIXJlc3VsdC5vaykgY29udGludWU7XG5cbiAgICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIGRlZi5vdXRwdXRzKSB7XG4gICAgICAgIGNvbnN0IHNlcmllcyA9IHJlc3VsdC52YWx1ZVtvdXRwdXQubmFtZV07XG4gICAgICAgIGlmICghc2VyaWVzKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLnBhcnNlQ29sb3Iob3V0cHV0LmNvbG9yKTtcbiAgICAgICAgaWYgKG91dHB1dC5zdHlsZSA9PT0gJ2xpbmUnKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBzZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXYgPSBzZXJpZXNbaSAtIDFdO1xuICAgICAgICAgICAgY29uc3QgY3VyID0gc2VyaWVzW2ldO1xuICAgICAgICAgICAgaWYgKHByZXYgPT0gbnVsbCB8fCBjdXIgPT0gbnVsbCkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCB4MCA9IHRvWChpIC0gMSk7XG4gICAgICAgICAgICBjb25zdCB5MCA9IHRvUGFuZVkoZGVmLnBhbmUsIHByZXYpO1xuICAgICAgICAgICAgY29uc3QgeDEgPSB0b1goaSk7XG4gICAgICAgICAgICBjb25zdCB5MSA9IHRvUGFuZVkoZGVmLnBhbmUsIGN1cik7XG4gICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHgwLCB5MCwgLi4uY29sb3IpO1xuICAgICAgICAgICAgdmVydGljZXMucHVzaCh4MSwgeTEsIC4uLmNvbG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAob3V0cHV0LnN0eWxlID09PSAnaGlzdG9ncmFtJyB8fCBvdXRwdXQuc3R5bGUgPT09ICdiYXInKSB7XG4gICAgICAgICAgY29uc3QgYmFzZVkgPSB0b1BhbmVZKGRlZi5wYW5lLCAwKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBzZXJpZXNbaV07XG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCB4ID0gdG9YKGkpO1xuICAgICAgICAgICAgY29uc3QgeSA9IHRvUGFuZVkoZGVmLnBhbmUsIHZhbHVlKTtcbiAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goeCwgYmFzZVksIC4uLmNvbG9yKTtcbiAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goeCwgeSwgLi4uY29sb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAob3V0cHV0LnN0eWxlID09PSAnbWFya2VyJykge1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHNlcmllc1tpXTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IHggPSB0b1goaSk7XG4gICAgICAgICAgICBjb25zdCB5ID0gdG9QYW5lWShkZWYucGFuZSwgdmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5wdXNoTWFya2VyU2hhcGUodmVydGljZXMsIHgsIHksIDAuMDEsICdkaWFtb25kJywgY29sb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLnRyYWRlTWFya2Vycy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG1hcmtlclNpemUgPSAwLjAxO1xuICAgICAgZm9yIChjb25zdCBtYXJrZXIgb2YgdGhpcy50cmFkZU1hcmtlcnMpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmZpbmROZWFyZXN0SW5kZXgobWFya2VyLnRpbWUpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgeCA9IHRvWChpbmRleCk7XG4gICAgICAgIGNvbnN0IHkgPSB0b1BhbmVZKCdtYWluJywgbWFya2VyLnByaWNlKTtcbiAgICAgICAgY29uc3Qgc3R5bGUgPSBERUZBVUxUX01BUktFUl9TVFlMRVNbbWFya2VyLnR5cGVdO1xuICAgICAgICBjb25zdCBjb2xvciA9IHRoaXMucGFyc2VDb2xvcihzdHlsZS5jb2xvcik7XG4gICAgICAgIGNvbnN0IHNpemUgPSAobWFya2VyLnNpemUgPz8gc3R5bGUuc2l6ZSkgKiBtYXJrZXJTaXplO1xuICAgICAgICB0aGlzLnB1c2hNYXJrZXJTaGFwZSh2ZXJ0aWNlcywgeCwgeSwgc2l6ZSwgc3R5bGUuc2hhcGUsIGNvbG9yKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0aWNlcyk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNvbXB1dGVJbmRpY2F0b3JTZWdtZW50c0dQVShyZW5kZXJlcjogV2ViR1BVUmVuZGVyZXIpOiBQcm9taXNlPEZsb2F0MzJBcnJheT4ge1xuICAgIGlmICghdGhpcy5kYXRhLmxlbmd0aCB8fCB0aGlzLmluZGljYXRvckluc3RhbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBuZXcgRmxvYXQzMkFycmF5KCk7XG4gICAgfVxuXG4gICAgY29uc3QgY291bnQgPSB0aGlzLmRhdGEubGVuZ3RoO1xuICAgIGNvbnN0IHN0ZXAgPSAyIC8gTWF0aC5tYXgoMSwgY291bnQgLSAxKTtcbiAgICBjb25zdCB0b1ggPSAoaTogbnVtYmVyKSA9PiAtMSArIHN0ZXAgKiBpO1xuXG4gICAgY29uc3QgbWFpblJhbmdlID0ge1xuICAgICAgbWluOiBNYXRoLm1pbiguLi50aGlzLmRhdGEubWFwKChkKSA9PiBkLmxvdykpLFxuICAgICAgbWF4OiBNYXRoLm1heCguLi50aGlzLmRhdGEubWFwKChkKSA9PiBkLmhpZ2gpKSxcbiAgICB9O1xuICAgIGNvbnN0IHN1YlJhbmdlczogUmVjb3JkPCdzdWIxJyB8ICdzdWIyJyB8ICdzdWIzJywgeyBtaW46IG51bWJlcjsgbWF4OiBudW1iZXIgfT4gPSB7XG4gICAgICBzdWIxOiB7IG1pbjogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLCBtYXg6IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSB9LFxuICAgICAgc3ViMjogeyBtaW46IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSwgbWF4OiBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkgfSxcbiAgICAgIHN1YjM6IHsgbWluOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIG1heDogTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZIH0sXG4gICAgfTtcbiAgICBjb25zdCBwYW5lTGF5b3V0OiBSZWNvcmQ8J21haW4nIHwgJ3N1YjEnIHwgJ3N1YjInIHwgJ3N1YjMnLCB7IHRvcDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9PiA9IHtcbiAgICAgIG1haW46IHsgdG9wOiAwLCBoZWlnaHQ6IDAuNiB9LFxuICAgICAgc3ViMTogeyB0b3A6IDAuNiwgaGVpZ2h0OiAwLjE1IH0sXG4gICAgICBzdWIyOiB7IHRvcDogMC43NSwgaGVpZ2h0OiAwLjE1IH0sXG4gICAgICBzdWIzOiB7IHRvcDogMC45LCBoZWlnaHQ6IDAuMSB9LFxuICAgIH07XG5cbiAgICBjb25zdCB1cGRhdGVSYW5nZSA9IChwYW5lOiAnc3ViMScgfCAnc3ViMicgfCAnc3ViMycsIHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHJhbmdlID0gc3ViUmFuZ2VzW3BhbmVdO1xuICAgICAgcmFuZ2UubWluID0gTWF0aC5taW4ocmFuZ2UubWluLCB2YWx1ZSk7XG4gICAgICByYW5nZS5tYXggPSBNYXRoLm1heChyYW5nZS5tYXgsIHZhbHVlKTtcbiAgICB9O1xuXG4gICAgY29uc3QgZGF0YUJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5kYXRhLmxlbmd0aCAqIDYpO1xuICAgIHRoaXMuZGF0YS5mb3JFYWNoKChiYXIsIGkpID0+IHtcbiAgICAgIGNvbnN0IG9mZnNldCA9IGkgKiA2O1xuICAgICAgZGF0YUJ1ZmZlcltvZmZzZXQgKyAwXSA9IGJhci50aW1lO1xuICAgICAgZGF0YUJ1ZmZlcltvZmZzZXQgKyAxXSA9IGJhci5vcGVuO1xuICAgICAgZGF0YUJ1ZmZlcltvZmZzZXQgKyAyXSA9IGJhci5oaWdoO1xuICAgICAgZGF0YUJ1ZmZlcltvZmZzZXQgKyAzXSA9IGJhci5sb3c7XG4gICAgICBkYXRhQnVmZmVyW29mZnNldCArIDRdID0gYmFyLmNsb3NlO1xuICAgICAgZGF0YUJ1ZmZlcltvZmZzZXQgKyA1XSA9IGJhci52b2x1bWU7XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb21wdXRlT3V0cHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCAobnVtYmVyIHwgbnVsbClbXT4+KCk7XG4gICAgY29uc3QgaW5wdXRCdWZmZXIgPSByZW5kZXJlci5jcmVhdGVJbnB1dEJ1ZmZlcihkYXRhQnVmZmVyKTtcblxuICAgIGNvbnN0IG9yZGVyZWRJbnN0YW5jZXMgPSB0aGlzLm9yZGVySW5zdGFuY2VzQnlEZXBlbmRlbmNpZXMoKTtcblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2Ygb3JkZXJlZEluc3RhbmNlcykge1xuICAgICAgaWYgKGluc3RhbmNlLmVuYWJsZWQgPT09IGZhbHNlKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGRlZiA9IHRoaXMucmVnaXN0cnkuZ2V0KGluc3RhbmNlLmlkKTtcbiAgICAgIGlmICghZGVmIHx8ICFkZWYud2dzbFNvdXJjZSkgY29udGludWU7XG4gICAgICBjb25zdCBwYXJhbXMgPSAoaW5zdGFuY2UucGFyYW1zID8/IHt9KSBhcyBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+O1xuICAgICAgY29uc3Qgc2VyaWVzQ291bnQgPSBkZWYub3V0cHV0cy5sZW5ndGg7XG4gICAgICBjb25zdCBwYXJhbUJ1ZmZlciA9IHRoaXMuYnVpbGRVbmlmb3JtUGFyYW1zKGRlZi5pZCwgcGFyYW1zLCB0aGlzLmRhdGEubGVuZ3RoKTtcbiAgICAgIGNvbnN0IG91dHB1dCA9IGF3YWl0IHJlbmRlcmVyLmNvbXB1dGVJbmRpY2F0b3JHUFVXaXRoSW5wdXQoXG4gICAgICAgIGRlZi53Z3NsU291cmNlLFxuICAgICAgICBwYXJhbUJ1ZmZlcixcbiAgICAgICAgaW5wdXRCdWZmZXIsXG4gICAgICAgIHRoaXMuZGF0YS5sZW5ndGggKiBzZXJpZXNDb3VudCxcbiAgICAgICAgdGhpcy5kYXRhLmxlbmd0aFxuICAgICAgKTtcbiAgICAgIGlmICghb3V0cHV0KSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHNlcmllc01hcDogUmVjb3JkPHN0cmluZywgKG51bWJlciB8IG51bGwpW10+ID0ge307XG4gICAgICBmb3IgKGxldCBzID0gMDsgcyA8IHNlcmllc0NvdW50OyBzKyspIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IGRlZi5vdXRwdXRzW3NdLm5hbWU7XG4gICAgICAgIHNlcmllc01hcFtuYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgcyA9IDA7IHMgPCBzZXJpZXNDb3VudDsgcysrKSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBvdXRwdXRbaSAqIHNlcmllc0NvdW50ICsgc107XG4gICAgICAgICAgc2VyaWVzTWFwW2RlZi5vdXRwdXRzW3NdLm5hbWVdLnB1c2goTnVtYmVyLmlzTmFOKHZhbHVlKSA/IG51bGwgOiB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbXB1dGVPdXRwdXRzLnNldChpbnN0YW5jZS5pbnN0YW5jZUlkLCBzZXJpZXNNYXApO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMpIHtcbiAgICAgIGlmIChpbnN0YW5jZS5lbmFibGVkID09PSBmYWxzZSkgY29udGludWU7XG4gICAgICBjb25zdCBkZWYgPSB0aGlzLnJlZ2lzdHJ5LmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWRlZiB8fCBkZWYucGFuZSA9PT0gJ21haW4nKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHNlcmllcyA9IGNvbXB1dGVPdXRwdXRzLmdldChpbnN0YW5jZS5pbnN0YW5jZUlkKTtcbiAgICAgIGlmICghc2VyaWVzKSBjb250aW51ZTtcbiAgICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIGRlZi5vdXRwdXRzKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IHNlcmllc1tvdXRwdXQubmFtZV07XG4gICAgICAgIGlmICghdmFsdWVzKSBjb250aW51ZTtcbiAgICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgY29udGludWU7XG4gICAgICAgICAgdXBkYXRlUmFuZ2UoZGVmLnBhbmUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZVJhbmdlID0gKHBhbmU6ICdzdWIxJyB8ICdzdWIyJyB8ICdzdWIzJykgPT4ge1xuICAgICAgY29uc3QgcmFuZ2UgPSBzdWJSYW5nZXNbcGFuZV07XG4gICAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShyYW5nZS5taW4pIHx8ICFOdW1iZXIuaXNGaW5pdGUocmFuZ2UubWF4KSkge1xuICAgICAgICByYW5nZS5taW4gPSAwO1xuICAgICAgICByYW5nZS5tYXggPSAxO1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlLm1pbiA9PT0gcmFuZ2UubWF4KSB7XG4gICAgICAgIHJhbmdlLm1pbiAtPSAxO1xuICAgICAgICByYW5nZS5tYXggKz0gMTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbm9ybWFsaXplUmFuZ2UoJ3N1YjEnKTtcbiAgICBub3JtYWxpemVSYW5nZSgnc3ViMicpO1xuICAgIG5vcm1hbGl6ZVJhbmdlKCdzdWIzJyk7XG5cbiAgICBjb25zdCB0b1BhbmVZID0gKHBhbmU6ICdtYWluJyB8ICdzdWIxJyB8ICdzdWIyJyB8ICdzdWIzJywgdmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgbGF5b3V0ID0gcGFuZUxheW91dFtwYW5lXTtcbiAgICAgIGNvbnN0IHRvcE5kYyA9IDEgLSAyICogbGF5b3V0LnRvcDtcbiAgICAgIGNvbnN0IGJvdHRvbU5kYyA9IDEgLSAyICogKGxheW91dC50b3AgKyBsYXlvdXQuaGVpZ2h0KTtcbiAgICAgIGxldCBtaW4gPSBtYWluUmFuZ2UubWluO1xuICAgICAgbGV0IG1heCA9IG1haW5SYW5nZS5tYXg7XG4gICAgICBpZiAocGFuZSAhPT0gJ21haW4nKSB7XG4gICAgICAgIG1pbiA9IHN1YlJhbmdlc1twYW5lXS5taW47XG4gICAgICAgIG1heCA9IHN1YlJhbmdlc1twYW5lXS5tYXg7XG4gICAgICB9XG4gICAgICBjb25zdCByYXRpbyA9ICh2YWx1ZSAtIG1pbikgLyAobWF4IC0gbWluKTtcbiAgICAgIHJldHVybiBib3R0b21OZGMgKyAodG9wTmRjIC0gYm90dG9tTmRjKSAqIHJhdGlvO1xuICAgIH07XG5cbiAgICBjb25zdCB2ZXJ0aWNlczogbnVtYmVyW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgdGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMpIHtcbiAgICAgIGlmIChpbnN0YW5jZS5lbmFibGVkID09PSBmYWxzZSkgY29udGludWU7XG4gICAgICBjb25zdCBkZWYgPSB0aGlzLnJlZ2lzdHJ5LmdldChpbnN0YW5jZS5pZCk7XG4gICAgICBpZiAoIWRlZikgY29udGludWU7XG4gICAgICBjb25zdCBzZXJpZXMgPSBjb21wdXRlT3V0cHV0cy5nZXQoaW5zdGFuY2UuaW5zdGFuY2VJZCk7XG4gICAgICBpZiAoIXNlcmllcykgY29udGludWU7XG4gICAgICBmb3IgKGNvbnN0IG91dHB1dCBvZiBkZWYub3V0cHV0cykge1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBzZXJpZXNbb3V0cHV0Lm5hbWVdO1xuICAgICAgICBpZiAoIXZhbHVlcykgY29udGludWU7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gdGhpcy5wYXJzZUNvbG9yKG91dHB1dC5jb2xvcik7XG4gICAgICAgIGlmIChvdXRwdXQuc3R5bGUgPT09ICdsaW5lJykge1xuICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwcmV2ID0gdmFsdWVzW2kgLSAxXTtcbiAgICAgICAgICAgIGNvbnN0IGN1ciA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgIGlmIChwcmV2ID09IG51bGwgfHwgY3VyID09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgeDAgPSB0b1goaSAtIDEpO1xuICAgICAgICAgICAgY29uc3QgeTAgPSB0b1BhbmVZKGRlZi5wYW5lLCBwcmV2KTtcbiAgICAgICAgICAgIGNvbnN0IHgxID0gdG9YKGkpO1xuICAgICAgICAgICAgY29uc3QgeTEgPSB0b1BhbmVZKGRlZi5wYW5lLCBjdXIpO1xuICAgICAgICAgICAgdmVydGljZXMucHVzaCh4MCwgeTAsIC4uLmNvbG9yKTtcbiAgICAgICAgICAgIHZlcnRpY2VzLnB1c2goeDEsIHkxLCAuLi5jb2xvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG91dHB1dC5zdHlsZSA9PT0gJ2hpc3RvZ3JhbScgfHwgb3V0cHV0LnN0eWxlID09PSAnYmFyJykge1xuICAgICAgICAgIGNvbnN0IGJhc2VZID0gdG9QYW5lWShkZWYucGFuZSwgMCk7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgaWYgKHZhbHVlID09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgeCA9IHRvWChpKTtcbiAgICAgICAgICAgIGNvbnN0IHkgPSB0b1BhbmVZKGRlZi5wYW5lLCB2YWx1ZSk7XG4gICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHgsIGJhc2VZLCAuLi5jb2xvcik7XG4gICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHgsIHksIC4uLmNvbG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG91dHB1dC5zdHlsZSA9PT0gJ21hcmtlcicpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gbnVsbCkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCB4ID0gdG9YKGkpO1xuICAgICAgICAgICAgY29uc3QgeSA9IHRvUGFuZVkoZGVmLnBhbmUsIHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXMucHVzaE1hcmtlclNoYXBlKHZlcnRpY2VzLCB4LCB5LCAwLjAxLCAnZGlhbW9uZCcsIGNvbG9yKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZhbHVhdGVBbGVydHMoZGVmLCBzZXJpZXMsIHRoaXMuZGF0YVt0aGlzLmRhdGEubGVuZ3RoIC0gMV0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgRmxvYXQzMkFycmF5KHZlcnRpY2VzKTtcbiAgfVxuXG4gIHByaXZhdGUgb3JkZXJJbnN0YW5jZXNCeURlcGVuZGVuY2llcygpOiBJbmRpY2F0b3JJbnN0YW5jZVtdIHtcbiAgICBjb25zdCBpZHMgPSBBcnJheS5mcm9tKG5ldyBTZXQodGhpcy5pbmRpY2F0b3JJbnN0YW5jZXMubWFwKChpbmQpID0+IGluZC5pZCkpKTtcbiAgICBsZXQgb3JkZXJlZElkczogc3RyaW5nW10gPSBbXTtcbiAgICB0cnkge1xuICAgICAgb3JkZXJlZElkcyA9IHRoaXMucmVnaXN0cnkucmVzb2x2ZURlcGVuZGVuY2llcyhpZHMpLm1hcCgoZGVmKSA9PiBkZWYuaWQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgb3JkZXJlZElkcyA9IGlkcztcbiAgICB9XG4gICAgY29uc3Qgb3JkZXJNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIG9yZGVyZWRJZHMuZm9yRWFjaCgoaWQsIGluZGV4KSA9PiBvcmRlck1hcC5zZXQoaWQsIGluZGV4KSk7XG4gICAgcmV0dXJuIFsuLi50aGlzLmluZGljYXRvckluc3RhbmNlc10uc29ydChcbiAgICAgIChhLCBiKSA9PiAob3JkZXJNYXAuZ2V0KGEuaWQpID8/IDApIC0gKG9yZGVyTWFwLmdldChiLmlkKSA/PyAwKVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkVW5pZm9ybVBhcmFtcyhpZDogc3RyaW5nLCBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sIGRhdGFMZW46IG51bWJlcik6IEFycmF5QnVmZmVyIHtcbiAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMTYpO1xuICAgIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcbiAgICBjb25zdCBzZXRVMzIgPSAob2Zmc2V0OiBudW1iZXIsIHZhbHVlOiBudW1iZXIpID0+IHZpZXcuc2V0VWludDMyKG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgIGNvbnN0IHNldEYzMiA9IChvZmZzZXQ6IG51bWJlciwgdmFsdWU6IG51bWJlcikgPT4gdmlldy5zZXRGbG9hdDMyKG9mZnNldCwgdmFsdWUsIHRydWUpO1xuXG4gICAgc3dpdGNoIChpZCkge1xuICAgICAgY2FzZSAnYmInOlxuICAgICAgY2FzZSAncGVyY2VudF9iJzpcbiAgICAgIGNhc2UgJ2JiX3dpZHRoJzpcbiAgICAgICAgc2V0VTMyKDAsIHBhcmFtcy5wZXJpb2QgPz8gMjApO1xuICAgICAgICBzZXRGMzIoNCwgcGFyYW1zLnN0ZERldiA/PyAyKTtcbiAgICAgICAgc2V0VTMyKDgsIGRhdGFMZW4pO1xuICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgICAgY2FzZSAnbWFjZCc6XG4gICAgICAgIHNldFUzMigwLCBwYXJhbXMuZmFzdFBlcmlvZCA/PyAxMik7XG4gICAgICAgIHNldFUzMig0LCBwYXJhbXMuc2xvd1BlcmlvZCA/PyAyNik7XG4gICAgICAgIHNldFUzMig4LCBwYXJhbXMuc2lnbmFsUGVyaW9kID8/IDkpO1xuICAgICAgICBzZXRVMzIoMTIsIGRhdGFMZW4pO1xuICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgICAgY2FzZSAnYWR4JzpcbiAgICAgIGNhc2UgJ2F0cic6XG4gICAgICBjYXNlICdyc2knOlxuICAgICAgY2FzZSAnc21hJzpcbiAgICAgIGNhc2UgJ2VtYSc6XG4gICAgICBjYXNlICd2d2FwJzpcbiAgICAgIGNhc2UgJ3ZvbF9yYXRpbyc6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBzZXRVMzIoMCwgcGFyYW1zLnBlcmlvZCA/PyAxNCk7XG4gICAgICAgIHNldFUzMig0LCBkYXRhTGVuKTtcbiAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHBhcnNlQ29sb3IoY29sb3I6IHN0cmluZyk6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdIHtcbiAgICBpZiAoY29sb3Iuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICBjb25zdCBoZXggPSBjb2xvci5yZXBsYWNlKCcjJywgJycpO1xuICAgICAgY29uc3QgdmFsID0gcGFyc2VJbnQoaGV4Lmxlbmd0aCA9PT0gMyA/IGhleC5zcGxpdCgnJykubWFwKChjKSA9PiBjICsgYykuam9pbignJykgOiBoZXgsIDE2KTtcbiAgICAgIGNvbnN0IHIgPSAoKHZhbCA+PiAxNikgJiAyNTUpIC8gMjU1O1xuICAgICAgY29uc3QgZyA9ICgodmFsID4+IDgpICYgMjU1KSAvIDI1NTtcbiAgICAgIGNvbnN0IGIgPSAodmFsICYgMjU1KSAvIDI1NTtcbiAgICAgIHJldHVybiBbciwgZywgYiwgMV07XG4gICAgfVxuICAgIGNvbnN0IHJnYmEgPSBjb2xvci5tYXRjaCgvcmdiYT9cXCgoW14pXSspXFwpL2kpO1xuICAgIGlmIChyZ2JhKSB7XG4gICAgICBjb25zdCBwYXJ0cyA9IHJnYmFbMV0uc3BsaXQoJywnKS5tYXAoKHApID0+IHBhcnNlRmxvYXQocC50cmltKCkpKTtcbiAgICAgIGNvbnN0IFtyLCBnLCBiLCBhID0gMV0gPSBwYXJ0cztcbiAgICAgIHJldHVybiBbciAvIDI1NSwgZyAvIDI1NSwgYiAvIDI1NSwgYV07XG4gICAgfVxuICAgIHJldHVybiBbMSwgMSwgMSwgMV07XG4gIH1cblxuICBwcml2YXRlIGV2YWx1YXRlQWxlcnRzKFxuICAgIGRlZjogSW5kaWNhdG9yRGVmaW5pdGlvbjxhbnksIGFueT4sXG4gICAgc2VyaWVzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXIgfCBudWxsIHwgKG51bWJlciB8IG51bGwpW10+LFxuICAgIGJhcjogT2hsY3ZQb2ludFxuICApIHtcbiAgICBpZiAoIWRlZi5hbGVydHMgfHwgZGVmLmFsZXJ0cy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICBjb25zdCBsYXN0SW5kZXggPSB0aGlzLmRhdGEubGVuZ3RoIC0gMTtcbiAgICBjb25zdCB2YWx1ZXM6IFJlY29yZDxzdHJpbmcsIG51bWJlciB8IG51bGw+ID0ge307XG4gICAgY29uc3QgcHJldlZhbHVlczogUmVjb3JkPHN0cmluZywgbnVtYmVyIHwgbnVsbD4gPSB7fTtcblxuICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIGRlZi5vdXRwdXRzKSB7XG4gICAgICBjb25zdCBvdXRwdXRTZXJpZXMgPSBzZXJpZXNbb3V0cHV0Lm5hbWVdIGFzIChudW1iZXIgfCBudWxsKVtdIHwgdW5kZWZpbmVkO1xuICAgICAgaWYgKCFvdXRwdXRTZXJpZXMpIGNvbnRpbnVlO1xuICAgICAgdmFsdWVzW291dHB1dC5uYW1lXSA9IG91dHB1dFNlcmllc1tsYXN0SW5kZXhdID8/IG51bGw7XG4gICAgICBwcmV2VmFsdWVzW291dHB1dC5uYW1lXSA9IG91dHB1dFNlcmllc1tsYXN0SW5kZXggLSAxXSA/PyBudWxsO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgYWxlcnQgb2YgZGVmLmFsZXJ0cykge1xuICAgICAgY29uc3Qga2V5ID0gYCR7ZGVmLmlkfToke2FsZXJ0LmlkfWA7XG4gICAgICBjb25zdCBsYXN0QXQgPSB0aGlzLmxhc3RBbGVydEF0LmdldChrZXkpID8/IDA7XG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKGFsZXJ0LmNvb2xkb3duICYmIG5vdyAtIGxhc3RBdCA8IGFsZXJ0LmNvb2xkb3duICogMTAwMCkgY29udGludWU7XG4gICAgICBpZiAoYWxlcnQuY29uZGl0aW9uKHZhbHVlcywgYmFyLCBwcmV2VmFsdWVzKSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gYWxlcnQubWVzc2FnZSh2YWx1ZXMsIGJhcik7XG4gICAgICAgIHRoaXMubGFzdEFsZXJ0QXQuc2V0KGtleSwgbm93KTtcbiAgICAgICAgdGhpcy5hbGVydENhbGxiYWNrcy5mb3JFYWNoKChjYikgPT4gY2IoeyBpbmRpY2F0b3JJZDogZGVmLmlkLCBhbGVydElkOiBhbGVydC5pZCwgbWVzc2FnZSB9KSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmaW5kTmVhcmVzdEluZGV4KHRpbWU6IG51bWJlcik6IG51bWJlciB7XG4gICAgbGV0IGJlc3QgPSAtMTtcbiAgICBsZXQgYmVzdERpZmYgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGRpZmYgPSBNYXRoLmFicyh0aGlzLmRhdGFbaV0udGltZSAtIHRpbWUpO1xuICAgICAgaWYgKGRpZmYgPCBiZXN0RGlmZikge1xuICAgICAgICBiZXN0RGlmZiA9IGRpZmY7XG4gICAgICAgIGJlc3QgPSBpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmVzdDtcbiAgfVxuXG4gIHByaXZhdGUgcHVzaE1hcmtlclNoYXBlKFxuICAgIG91dDogbnVtYmVyW10sXG4gICAgeDogbnVtYmVyLFxuICAgIHk6IG51bWJlcixcbiAgICBzaXplOiBudW1iZXIsXG4gICAgc2hhcGU6ICd0cmlhbmdsZV91cCcgfCAndHJpYW5nbGVfZG93bicgfCAnY2lyY2xlJyB8ICdjcm9zcycgfCAnZGlhbW9uZCcgfCAnd2FybmluZycsXG4gICAgY29sb3I6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdXG4gICkge1xuICAgIGNvbnN0IGxpbmUgPSAoeDA6IG51bWJlciwgeTA6IG51bWJlciwgeDE6IG51bWJlciwgeTE6IG51bWJlcikgPT4ge1xuICAgICAgb3V0LnB1c2goeDAsIHkwLCAuLi5jb2xvcik7XG4gICAgICBvdXQucHVzaCh4MSwgeTEsIC4uLmNvbG9yKTtcbiAgICB9O1xuXG4gICAgc3dpdGNoIChzaGFwZSkge1xuICAgICAgY2FzZSAndHJpYW5nbGVfdXAnOiB7XG4gICAgICAgIGNvbnN0IHRvcCA9IFt4LCB5ICsgc2l6ZV07XG4gICAgICAgIGNvbnN0IGxlZnQgPSBbeCAtIHNpemUsIHkgLSBzaXplXTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBbeCArIHNpemUsIHkgLSBzaXplXTtcbiAgICAgICAgbGluZSh0b3BbMF0sIHRvcFsxXSwgbGVmdFswXSwgbGVmdFsxXSk7XG4gICAgICAgIGxpbmUobGVmdFswXSwgbGVmdFsxXSwgcmlnaHRbMF0sIHJpZ2h0WzFdKTtcbiAgICAgICAgbGluZShyaWdodFswXSwgcmlnaHRbMV0sIHRvcFswXSwgdG9wWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICd0cmlhbmdsZV9kb3duJzoge1xuICAgICAgICBjb25zdCBib3R0b20gPSBbeCwgeSAtIHNpemVdO1xuICAgICAgICBjb25zdCBsZWZ0ID0gW3ggLSBzaXplLCB5ICsgc2l6ZV07XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gW3ggKyBzaXplLCB5ICsgc2l6ZV07XG4gICAgICAgIGxpbmUoYm90dG9tWzBdLCBib3R0b21bMV0sIGxlZnRbMF0sIGxlZnRbMV0pO1xuICAgICAgICBsaW5lKGxlZnRbMF0sIGxlZnRbMV0sIHJpZ2h0WzBdLCByaWdodFsxXSk7XG4gICAgICAgIGxpbmUocmlnaHRbMF0sIHJpZ2h0WzFdLCBib3R0b21bMF0sIGJvdHRvbVsxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnZGlhbW9uZCc6IHtcbiAgICAgICAgY29uc3QgdG9wID0gW3gsIHkgKyBzaXplXTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBbeCArIHNpemUsIHldO1xuICAgICAgICBjb25zdCBib3R0b20gPSBbeCwgeSAtIHNpemVdO1xuICAgICAgICBjb25zdCBsZWZ0ID0gW3ggLSBzaXplLCB5XTtcbiAgICAgICAgbGluZSh0b3BbMF0sIHRvcFsxXSwgcmlnaHRbMF0sIHJpZ2h0WzFdKTtcbiAgICAgICAgbGluZShyaWdodFswXSwgcmlnaHRbMV0sIGJvdHRvbVswXSwgYm90dG9tWzFdKTtcbiAgICAgICAgbGluZShib3R0b21bMF0sIGJvdHRvbVsxXSwgbGVmdFswXSwgbGVmdFsxXSk7XG4gICAgICAgIGxpbmUobGVmdFswXSwgbGVmdFsxXSwgdG9wWzBdLCB0b3BbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ2NpcmNsZSc6IHtcbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSAxMjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50czsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgYTAgPSAoaSAvIHNlZ21lbnRzKSAqIE1hdGguUEkgKiAyO1xuICAgICAgICAgIGNvbnN0IGExID0gKChpICsgMSkgLyBzZWdtZW50cykgKiBNYXRoLlBJICogMjtcbiAgICAgICAgICBjb25zdCB4MCA9IHggKyBNYXRoLmNvcyhhMCkgKiBzaXplO1xuICAgICAgICAgIGNvbnN0IHkwID0geSArIE1hdGguc2luKGEwKSAqIHNpemU7XG4gICAgICAgICAgY29uc3QgeDEgPSB4ICsgTWF0aC5jb3MoYTEpICogc2l6ZTtcbiAgICAgICAgICBjb25zdCB5MSA9IHkgKyBNYXRoLnNpbihhMSkgKiBzaXplO1xuICAgICAgICAgIGxpbmUoeDAsIHkwLCB4MSwgeTEpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnd2FybmluZyc6IHtcbiAgICAgICAgY29uc3QgdG9wID0gW3gsIHkgKyBzaXplXTtcbiAgICAgICAgY29uc3QgbGVmdCA9IFt4IC0gc2l6ZSwgeSAtIHNpemVdO1xuICAgICAgICBjb25zdCByaWdodCA9IFt4ICsgc2l6ZSwgeSAtIHNpemVdO1xuICAgICAgICBsaW5lKHRvcFswXSwgdG9wWzFdLCBsZWZ0WzBdLCBsZWZ0WzFdKTtcbiAgICAgICAgbGluZShsZWZ0WzBdLCBsZWZ0WzFdLCByaWdodFswXSwgcmlnaHRbMV0pO1xuICAgICAgICBsaW5lKHJpZ2h0WzBdLCByaWdodFsxXSwgdG9wWzBdLCB0b3BbMV0pO1xuICAgICAgICBsaW5lKHgsIHkgLSBzaXplICogMC4yLCB4LCB5ICsgc2l6ZSAqIDAuNCk7XG4gICAgICAgIGxpbmUoeCwgeSAtIHNpemUgKiAwLjYsIHgsIHkgLSBzaXplICogMC41NSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnY3Jvc3MnOlxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICBsaW5lKHggLSBzaXplLCB5LCB4ICsgc2l6ZSwgeSk7XG4gICAgICAgIGxpbmUoeCwgeSAtIHNpemUsIHgsIHkgKyBzaXplKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMucmVuZGVyZXIuZGVzdHJveSgpO1xuICB9XG59XG4iLAogICJleHBvcnQgdHlwZSBJMThuU3RyaW5ncyA9IFJlY29yZDxzdHJpbmcsIHsgZW46IHN0cmluZzsgamE6IHN0cmluZyB9PjtcblxuZXhwb3J0IGNvbnN0IElORElDQVRPUl9JMThOOiBJMThuU3RyaW5ncyA9IHtcbiAgJ2luZGljYXRvci5iYi5uYW1lJzogeyBlbjogJ0JvbGxpbmdlciBCYW5kcycsIGphOiAn44Oc44Oq44Oz44K444Oj44O844OQ44Oz44OJJyB9LFxuICAnaW5kaWNhdG9yLnJzaS5uYW1lJzogeyBlbjogJ1JTSScsIGphOiAnUlNJ77yI55u45a++5Yqb5oyH5pWw77yJJyB9LFxuICAnaW5kaWNhdG9yLmFkeC5uYW1lJzogeyBlbjogJ0FEWCcsIGphOiAnQURY77yI5bmz5Z2H5pa55ZCR5oCn5oyH5pWw77yJJyB9LFxuICAnaW5kaWNhdG9yLm1hY2QubmFtZSc6IHsgZW46ICdNQUNEJywgamE6ICdNQUNEJyB9LFxuICAnaW5kaWNhdG9yLmF0ci5uYW1lJzogeyBlbjogJ0FUUicsIGphOiAnQVRSJyB9LFxuICAnaW5kaWNhdG9yLnZvbHVtZS5uYW1lJzogeyBlbjogJ1ZvbHVtZScsIGphOiAn5Ye65p2l6auYJyB9LFxufTtcblxuZXhwb3J0IGNvbnN0IHQgPSAoa2V5OiBzdHJpbmcsIGxvY2FsZTogJ2VuJyB8ICdqYScgPSAnamEnKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuIElORElDQVRPUl9JMThOW2tleV0/Lltsb2NhbGVdID8/IGtleTtcbn07XG4iLAogICJleHBvcnQgdHlwZSBJbmRpY2F0b3JQaGFzZSA9ICdwaGFzZTEnIHwgJ3BoYXNlMicgfCAncGhhc2UzJyB8ICdwaGFzZTQnO1xuXG5leHBvcnQgY29uc3QgSU5ESUNBVE9SX1BIQVNFUzogUmVjb3JkPEluZGljYXRvclBoYXNlLCBzdHJpbmdbXT4gPSB7XG4gIHBoYXNlMTogWyd2b2x1bWUnLCAnc21hJywgJ2VtYScsICdiYicsICdjYW5kbGVzJ10sXG4gIHBoYXNlMjogWydyc2knLCAnYWR4JywgJ2F0cicsICdtYWNkJywgJ3RyYWRlX21hcmtlcnMnXSxcbiAgcGhhc2UzOiBbJ3Z3YXAnLCAndm9sX3JhdGlvJywgJ3BlcmNlbnRfYicsICdiYl93aWR0aCddLFxuICBwaGFzZTQ6IFsnb2J2JywgJ2NtZicsICdtZmknLCAna2F1Zm1hbl9wYXR0ZXJucyddLFxufTtcbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFHQSxJQUFNLGlCQUE4QjtBQUFBLEVBQ2xDLElBQUksQ0FBQyxHQUFLLEtBQUssR0FBSyxDQUFHO0FBQUEsRUFDdkIsTUFBTSxDQUFDLEdBQUssR0FBSyxHQUFLLENBQUc7QUFBQSxFQUN6QixNQUFNLENBQUMsR0FBSyxHQUFLLEdBQUssQ0FBRztBQUFBLEVBQ3pCLFNBQVMsQ0FBQyxHQUFLLEdBQUssR0FBSyxDQUFHO0FBQUEsRUFDNUIsWUFBWSxDQUFDLEdBQUssR0FBSyxHQUFLLENBQUc7QUFDakM7QUFFTztBQUFBLE1BQU0sZUFBd0M7QUFBQSxFQUMzQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQSxPQUFxQixDQUFDO0FBQUEsRUFDdEIsU0FBc0IsQ0FBQztBQUFBLEVBQ3ZCLFNBQXNCO0FBQUEsRUFFdEIsZ0JBQWU7QUFBQSxFQUNmLGVBQTRDO0FBQUEsRUFDNUMsU0FBc0M7QUFBQSxFQUN0QyxjQUEyQztBQUFBLEVBQzNDLFNBQXNDO0FBQUEsRUFFOUMsVUFBVSxDQUFDLFFBQWlDO0FBQzFDLFVBQU0sS0FBSyxPQUFPLFdBQVcsUUFBUTtBQUNyQyxTQUFLLElBQUk7QUFDUCxZQUFNLElBQUksTUFBTSw4Q0FBOEM7QUFBQSxJQUNoRTtBQUVBLFNBQUssS0FBSztBQUNWLFNBQUssVUFBVSxLQUFLLGNBQWMsSUFB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LElBQUksTUFBTSxHQUFHLElBQUksSUFBSTtBQUFBLE1BQy9CO0FBQUE7QUFBQTtBQUFBLEVBSUosT0FBTyxHQUFTO0FBQ2QsU0FBSyxLQUFLO0FBQ1YsU0FBSyxTQUFTLFFBQVE7QUFBQTtBQUUxQjs7QUNwcUJPLElBQU0saUJBQThCO0FBQUEsRUFDekMscUJBQXFCLEVBQUUsSUFBSSxtQkFBbUIsSUFBSSx5REFBVztBQUFBLEVBQzdELHNCQUFzQixFQUFFLElBQUksT0FBTyxJQUFJLGdEQUFZO0FBQUEsRUFDbkQsc0JBQXNCLEVBQUUsSUFBSSxPQUFPLElBQUksNERBQWM7QUFBQSxFQUNyRCx1QkFBdUIsRUFBRSxJQUFJLFFBQVEsSUFBSSxPQUFPO0FBQUEsRUFDaEQsc0JBQXNCLEVBQUUsSUFBSSxPQUFPLElBQUksTUFBTTtBQUFBLEVBQzdDLHlCQUF5QixFQUFFLElBQUksVUFBVSxJQUFJLHFCQUFLO0FBQ3BEO0FBRU8sSUFBTSxJQUFJLENBQUMsS0FBYSxTQUFzQixTQUFpQjtBQUNwRSxTQUFPLGVBQWUsT0FBTyxXQUFXO0FBQUE7O0FDVm5DLElBQU0sbUJBQXFEO0FBQUEsRUFDaEUsUUFBUSxDQUFDLFVBQVUsT0FBTyxPQUFPLE1BQU0sU0FBUztBQUFBLEVBQ2hELFFBQVEsQ0FBQyxPQUFPLE9BQU8sT0FBTyxRQUFRLGVBQWU7QUFBQSxFQUNyRCxRQUFRLENBQUMsUUFBUSxhQUFhLGFBQWEsVUFBVTtBQUFBLEVBQ3JELFFBQVEsQ0FBQyxPQUFPLE9BQU8sT0FBTyxrQkFBa0I7QUFDbEQ7IiwKICAiZGVidWdJZCI6ICJGODlCOTQzNDQzRjdGOEFGNjQ3NTZlMjE2NDc1NmUyMSIsCiAgIm5hbWVzIjogW10KfQ==
