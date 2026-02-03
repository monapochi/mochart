// WebGPU renderer interface skeleton. Concrete implementation to follow.
export interface WebGPUBackend {
  init(canvas: HTMLCanvasElement): Promise<void>;
  drawSeries(seriesId: string, data: Float32Array): void;
  updateBuffers(seriesId: string, data: Float32Array, offset?: number): void;
  partialUpdateBuffers(seriesId: string, patches: Array<{offset:number; data:Float32Array}>): void;
  resizeViewport(width: number, height: number): void;
  destroy(): void;
}

export class WebGPUStub implements WebGPUBackend {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    // Try to initialize WebGPU; graceful fallback if unavailable
    if (!('gpu' in navigator)) {
      console.warn('WebGPU not supported in this environment');
      return;
    }
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) { console.warn('No GPU adapter found'); return; }
      const device = await adapter.requestDevice();
      this.device = device;
      this.context = (canvas.getContext('webgpu') as unknown) as GPUCanvasContext;
      // Configure basic swapChain format if available
      const format = navigator.userAgent.includes('Firefox') ? 'bgra8unorm' : 'rgba8unorm';
      try { this.context.configure({ device, format }); } catch (e) { /* ignore if unsupported */ }
      console.info('WebGPU initialized');
    } catch (e) {
      console.warn('WebGPU initialization failed', e);
    }
  }

  drawSeries(_seriesId: string, _data: Float32Array): void { /* to be implemented */ }
  updateBuffers(_seriesId: string, _data: Float32Array, _offset?: number): void { /* to be implemented */ }
  partialUpdateBuffers(_seriesId: string, _patches: Array<{offset:number; data:Float32Array}>): void { /* to be implemented */ }
  resizeViewport(_width: number, _height: number): void { /* to be implemented */ }
  destroy(): void {
    if (this.device) { /* device cleanup if needed */ }
    this.device = null;
    this.context = null;
  }
}

import type { ChartConfig, ChartColors, OhlcvPoint } from '../../core/types';
import type { ChartRenderer } from '../renderer';

type GPUAdapter = unknown;
type GPUDevice = {
  queue: { submit: (commands: unknown[]) => void; writeBuffer?: (buffer: any, offset: number, data: ArrayBufferView) => void };
  createCommandEncoder: () => any;
  createRenderPipeline: (descriptor: any) => any;
  createShaderModule: (descriptor: any) => any;
  createBuffer: (descriptor: any) => any;
  createComputePipeline: (descriptor: any) => any;
  createBindGroup: (descriptor: any) => any;
};
type GPUCanvasContext = { configure: (options: any) => void; getCurrentTexture: () => { createView: () => any } };
type GPUTextureFormat = string;

type WebGPUContext = {
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
};

const DEFAULT_COLORS: ChartColors = {
  up: [0.0, 0.7, 0.0, 1.0],
  down: [1.0, 0.0, 0.0, 1.0],
  wick: [0.0, 0.0, 0.0, 1.0],
  outline: [0.0, 0.0, 0.0, 1.0],
  background: [1.0, 1.0, 1.0, 1.0],
};

export class WebGPURenderer implements ChartRenderer {
  private data: OhlcvPoint[] = [];
  private config: ChartConfig = {};
  private colors: ChartColors = DEFAULT_COLORS;
  private context: WebGPUContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private initPromise: Promise<void> | null = null;
  private pipeline: any = null;
  private vertexBuffer: any = null;
  private vertexCount = 0;
  private linePipeline: any = null;
  private indicatorBuffer: any = null;
  private indicatorCount = 0;
  private indicatorBufferSize = 0;
  private vertexBufferSize = 0;

  initialize(canvas: HTMLCanvasElement): void {
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU is not supported in this environment.');
    }
    this.canvas = canvas;
    this.initPromise = this.initWebGPU();
  }

  setData(data: OhlcvPoint[]): void {
    this.data = data;
    this.buildGeometry();
  }

  setConfig(config: ChartConfig): void {
    this.config = config;
    this.colors = {
      ...DEFAULT_COLORS,
      ...(config.colors ?? {}),
    };
    this.buildGeometry();
  }

  setIndicatorSegments(segments: Float32Array): void {
    if (!this.context) return;
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
        usage: (window as any).GPUBufferUsage.VERTEX | (window as any).GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(this.indicatorBuffer.getMappedRange()).set(segments);
      this.indicatorBuffer.unmap();
      this.indicatorBufferSize = segments.byteLength;
    } else if (device.queue.writeBuffer) {
      device.queue.writeBuffer(this.indicatorBuffer, 0, segments);
    }
  }

  render(): void {
    if (!this.context) return;
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
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: {
            r: this.colors.background[0],
            g: this.colors.background[1],
            b: this.colors.background[2],
            a: this.colors.background[3],
          },
        },
      ],
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

  resize(): void {
    if (!this.context || !this.canvas) return;
    const { device, context: gpuContext, format } = this.context;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    gpuContext.configure({ device, format, alphaMode: 'premultiplied' });
  }

  destroy(): void {
    this.context = null;
    this.canvas = null;
    this.pipeline = null;
    this.vertexBuffer = null;
    this.vertexCount = 0;
  }

  private async initWebGPU(): Promise<void> {
    if (!this.canvas) return;
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) {
      throw new Error('WebGPU adapter not available.');
    }
    const device = await adapter.requestDevice();
    const context = this.canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    if (!context) {
      throw new Error('Failed to acquire WebGPU canvas context.');
    }
    const format = (navigator as any).gpu.getPreferredCanvasFormat() as GPUTextureFormat;
    context.configure({ device, format, alphaMode: 'premultiplied' });
    this.context = { adapter, device, context, format };
    this.pipeline = this.createPipeline(device, format);
    this.linePipeline = this.createLinePipeline(device, format);
    this.buildGeometry();
  }

  async computeIndicatorGPU(
    wgslSource: string,
    params: ArrayBuffer,
    data: Float32Array,
    outputLength: number
  ): Promise<Float32Array | null> {
    if (!this.context) return null;
    const { device } = this.context;

    const shader = device.createShaderModule({ code: wgslSource });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    });

    const inputBuffer = device.createBuffer({
      size: data.byteLength,
      usage: (window as any).GPUBufferUsage.STORAGE | (window as any).GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(inputBuffer.getMappedRange()).set(data);
    inputBuffer.unmap();

    const uniformBuffer = device.createBuffer({
      size: params.byteLength,
      usage: (window as any).GPUBufferUsage.UNIFORM | (window as any).GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint8Array(uniformBuffer.getMappedRange()).set(new Uint8Array(params));
    uniformBuffer.unmap();

    const outputBuffer = device.createBuffer({
      size: outputLength * 4,
      usage: (window as any).GPUBufferUsage.STORAGE | (window as any).GPUBufferUsage.COPY_SRC,
    });
    const readback = device.createBuffer({
      size: outputLength * 4,
      usage: (window as any).GPUBufferUsage.MAP_READ | (window as any).GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } },
      ],
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

    await readback.mapAsync((window as any).GPUMapMode.READ);
    const result = readback.getMappedRange();
    const output = new Float32Array(result.slice(0));
    readback.unmap();
    return output;
  }

  createInputBuffer(data: Float32Array): any {
    if (!this.context) return null;
    const { device } = this.context;
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: (window as any).GPUBufferUsage.STORAGE | (window as any).GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }

  updateInputBuffer(buffer: any, data: Float32Array): void {
    if (!this.context || !buffer) return;
    const { device } = this.context;
    if (device.queue.writeBuffer) {
      device.queue.writeBuffer(buffer, 0, data);
    }
  }

  async computeIndicatorGPUWithInput(
    wgslSource: string,
    params: ArrayBuffer,
    inputBuffer: any,
    outputLength: number,
    dataLen: number
  ): Promise<Float32Array | null> {
    if (!this.context || !inputBuffer) return null;
    const { device } = this.context;

    const shader = device.createShaderModule({ code: wgslSource });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    });

    const uniformBuffer = device.createBuffer({
      size: params.byteLength,
      usage: (window as any).GPUBufferUsage.UNIFORM | (window as any).GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint8Array(uniformBuffer.getMappedRange()).set(new Uint8Array(params));
    uniformBuffer.unmap();

    const outputBuffer = device.createBuffer({
      size: outputLength * 4,
      usage: (window as any).GPUBufferUsage.STORAGE | (window as any).GPUBufferUsage.COPY_SRC,
    });
    const readback = device.createBuffer({
      size: outputLength * 4,
      usage: (window as any).GPUBufferUsage.MAP_READ | (window as any).GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } },
      ],
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

    await readback.mapAsync((window as any).GPUMapMode.READ);
    const result = readback.getMappedRange();
    const output = new Float32Array(result.slice(0));
    readback.unmap();
    return output;
  }

  private getWorkgroupSize(wgslSource: string): number {
    const match = wgslSource.match(/workgroup_size\((\d+)\)/);
    if (!match) return 256;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : 256;
  }

  private createPipeline(device: GPUDevice, format: GPUTextureFormat): any {
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
      `,
    });

    return device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shader,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module: shader,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private createLinePipeline(device: GPUDevice, format: GPUTextureFormat): any {
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
      `,
    });

    return device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shader,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module: shader,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'line-list' },
    });
  }

  private buildGeometry(): void {
    if (!this.context || !this.data.length) return;

    const { device } = this.context;
    const count = this.data.length;
    const minPrice = Math.min(...this.data.map((d) => d.low));
    const maxPrice = Math.max(...this.data.map((d) => d.high));
    const range = maxPrice - minPrice || 1;
    const candleWidth = 2 / Math.max(1, count);
    const wickWidth = candleWidth * 0.2;

    // compensate for non-square canvas: scale X coordinates so candles keep correct aspect
    const canvas = this.canvas as HTMLCanvasElement;
    const aspectCorrection = canvas && canvas.width && canvas.height ? canvas.height / canvas.width : 1;

    const vertices: number[] = [];
    const colorUp = this.colors.up;
    const colorDown = this.colors.down;
    const colorWick = this.colors.wick;

    const toX = (i: number) => (-1 + candleWidth * i + candleWidth * 0.5) * aspectCorrection;
    const toY = (price: number) => ((price - minPrice) / range) * 2 - 1;

    for (let i = 0; i < count; i++) {
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

      // body quad (two triangles)
      pushQuad(vertices, x - bodyHalf, bottom, x + bodyHalf, top, bodyColor);
      // wick quad (thin)
      pushQuad(vertices, x - wickHalf, lowY, x + wickHalf, highY, colorWick);
    }

    const data = new Float32Array(vertices);
    this.vertexCount = data.length / 6;
    if (!this.vertexBuffer || this.vertexBufferSize !== data.byteLength) {
      this.vertexBuffer = device.createBuffer({
        size: data.byteLength,
        usage: (window as any).GPUBufferUsage.VERTEX | (window as any).GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(this.vertexBuffer.getMappedRange()).set(data);
      this.vertexBuffer.unmap();
      this.vertexBufferSize = data.byteLength;
    } else if (device.queue.writeBuffer) {
      device.queue.writeBuffer(this.vertexBuffer, 0, data);
    }
  }
}

const pushQuad = (
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number, number]
) => {
  // tri 1
  out.push(x0, y0, ...color);
  out.push(x1, y0, ...color);
  out.push(x1, y1, ...color);
  // tri 2
  out.push(x0, y0, ...color);
  out.push(x1, y1, ...color);
  out.push(x0, y1, ...color);
};
