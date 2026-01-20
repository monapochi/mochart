import type { ChartConfig, ChartColors, OhlcvPoint } from '../../core/types';
import type { ChartRenderer } from '../renderer';

const DEFAULT_COLORS: ChartColors = {
  up: [1.0, 0.0, 0.0, 1.0],
  down: [0.0, 0.7, 0.0, 1.0],
  wick: [0.0, 0.0, 0.0, 1.0],
  outline: [0.0, 0.0, 0.0, 1.0],
  background: [1.0, 1.0, 1.0, 1.0],
};

export class WebGL2Renderer implements ChartRenderer {
  private gl!: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private buffer!: WebGLBuffer;
  private data: OhlcvPoint[] = [];
  private config: ChartConfig = {};
  private colors: ChartColors = DEFAULT_COLORS;

  private aCoordinates = -1;
  private uTranslation: WebGLUniformLocation | null = null;
  private uScale: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uColor: WebGLUniformLocation | null = null;

  initialize(canvas: HTMLCanvasElement): void {
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 is not supported in this environment.');
    }

    this.gl = gl;
    this.program = this.createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.buffer = this.createBuffer(gl);

    this.aCoordinates = gl.getAttribLocation(this.program, 'a_coordinates');
    this.uTranslation = gl.getUniformLocation(this.program, 'u_translation');
    this.uScale = gl.getUniformLocation(this.program, 'u_scale');
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.uColor = gl.getUniformLocation(this.program, 'u_color');

    gl.useProgram(this.program);
  }

  setData(data: OhlcvPoint[]): void {
    this.data = data;
    this.uploadData();
  }

  setConfig(config: ChartConfig): void {
    this.config = config;
    this.colors = {
      ...DEFAULT_COLORS,
      ...(config.colors ?? {}),
    };
  }

  setIndicatorSegments(_segments: Float32Array): void {
    // TODO: WebGL2 indicator rendering
  }

  render(): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.buffer) return;

    this.resize();

    gl.clearColor(...this.colors.background);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.aCoordinates);
    gl.vertexAttribPointer(this.aCoordinates, 3, gl.FLOAT, false, 0, 0);

    if (this.uScale) gl.uniform2fv(this.uScale, new Float32Array([0.23, 5.0]));
    if (this.uResolution) gl.uniform2fv(this.uResolution, new Float32Array([gl.drawingBufferWidth, gl.drawingBufferHeight]));

    const stride = 6;

    for (let c = 0; c < this.data.length; c++) {
      if (this.uTranslation) gl.uniform2fv(this.uTranslation, new Float32Array([(c + 1) * 25, 0]));

      if (this.uColor) gl.uniform4fv(this.uColor, new Float32Array(this.colors.wick));
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, c * stride + 4, 2);

      const isUp = this.data[c].open < this.data[c].close;
      if (this.uColor) gl.uniform4fv(this.uColor, new Float32Array(isUp ? this.colors.up : this.colors.down));
      gl.drawArrays(gl.TRIANGLE_FAN, c * stride, 4);

      if (this.uColor) gl.uniform4fv(this.uColor, new Float32Array(this.colors.outline));
      gl.drawArrays(gl.LINE_LOOP, c * stride, 4);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  resize(): void {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    if (canvas.clientWidth !== canvas.width) canvas.width = canvas.clientWidth;
    if (canvas.clientHeight !== canvas.height) canvas.height = canvas.clientHeight;
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
  }

  private uploadData(): void {
    const gl = this.gl;
    const vertices = this.createVertices(this.data);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private createVertices(data: OhlcvPoint[]): number[] {
    return data
      .map((d) => [
        -19, d.open, 0,
        21, d.open, 0,
        21, d.close, 0,
        -19, d.close, 0,
        1, d.high, 0,
        1, d.low, 0,
      ])
      .reduce((a, b) => a.concat(b), [] as number[]);
  }

  private createBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create WebGL buffer.');
    }
    return buffer;
  }

  private createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vs);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fs);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program.');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${info ?? 'unknown error'}`);
    }

    return program;
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader.');

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${info ?? 'unknown error'}`);
    }

    return shader;
  }
}

const VERTEX_SHADER = `#version 300 es
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

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 outColor;

void main() {
  outColor = u_color;
}
`;
