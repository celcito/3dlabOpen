import * as THREE from "three";
import {
  segmentByColor,
  type ClusterOptions,
  type RegionStats,
  type SegmentGeometry,
} from "./colorCluster";

export interface GpuSegmenterOptions extends ClusterOptions {
  /** Force CPU path even when WebGL2 is available. */
  forceCpu?: boolean;
  /** Minimum VRAM in MB to use GPU path. */
  minVramMb?: number;
}

export interface GpuInfo {
  available: boolean;
  webgl2: boolean;
  vramMb: number;
  renderer: string;
}

const DEFAULT_MIN_VRAM = 256;

/**
 * Detects WebGL2 availability and estimates VRAM (MB) from the renderer
 * info string. Returns a conservative default when unavailable.
 */
export function detectGpu(): GpuInfo {
  if (typeof document === "undefined") {
    return { available: false, webgl2: false, vramMb: 0, renderer: "no-dom" };
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) {
      return { available: false, webgl2: false, vramMb: 0, renderer: "no-webgl2" };
    }
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const vramMb = estimateVram(renderer);
    return { available: true, webgl2: true, vramMb, renderer };
  } catch {
    return { available: false, webgl2: false, vramMb: 0, renderer: "error" };
  }
}

/**
 * Parses VRAM from common renderer strings ("4.0 GB", "2.5 GiB", "8192 MB").
 * Falls back to a platform heuristic when unknown.
 */
export function estimateVram(renderer: string): number {
  const lower = renderer.toLowerCase();
  const match = lower.match(/([\d.]+)\s*(gb|gib|mb|mib)/);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2];
    if (unit === "gb" || unit === "gib") return Math.round(value * 1024);
    return Math.round(value);
  }
  // Apple Silicon / integrated vendors without explicit VRAM.
  if (/apple|intel|llvmpipe|swiftshader|software/.test(lower)) return 1536;
  if (/nvidia|geforce|quadro|rtx|gtx/.test(lower)) return 8192;
  if (/amd|radeon|firepro/.test(lower)) return 8192;
  return 4096;
}

/**
 * Runs a WebGL2 color quantization pass over vertex colors and reads the
 * quantized RGB values back for the CPU connectivity pass. WebGL2 only;
 * caller must check `detectGpu()` first.
 *
 * Returns normalized quantized RGB colors, or null when the GPU path fails.
 */
export function gpuSmoothColors(
  colors: Float32Array,
  threshold: number,
  gl: WebGL2RenderingContext
): Float32Array | null {
  try {
    const vertexCount = colors.length / 3;
    const texW = Math.ceil(Math.sqrt(vertexCount));
    const texH = Math.ceil(vertexCount / texW);

    const data = new Float32Array(texW * texH * 4);
    for (let i = 0; i < vertexCount; i++) {
      data[i * 4] = colors[i * 3];
      data[i * 4 + 1] = colors[i * 3 + 1];
      data[i * 4 + 2] = colors[i * 3 + 2];
      data[i * 4 + 3] = 1;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, texW, texH, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const vs = `#version 300 es
      in vec2 position;
      out vec2 vUv;
      void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

    const fs = `#version 300 es
      precision highp float;
      uniform sampler2D uColors;
      in vec2 vUv;
       out vec4 outColor;
       void main() {
         vec3 c = texture(uColors, vUv).rgb;
         outColor = vec4(c, 1.0);
       }`;

    const program = compileProgram(gl, vs, fs);
    if (!program) return null;

    const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "uColors"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    const fbo = gl.createFramebuffer();
    const outTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, outTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    gl.viewport(0, 0, texW, texH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const out = new Uint8Array(texW * texH * 4);
    gl.readPixels(0, 0, texW, texH, gl.RGBA, gl.UNSIGNED_BYTE, out);

    // Clean up.
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(outTex);
    gl.deleteTexture(tex);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);

    const quantized = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const x = i % texW;
      const y = Math.floor(i / texW);
      const readback = ((texH - 1 - y) * texW + x) * 4;
      quantized[i * 3] = out[readback] / 255;
      quantized[i * 3 + 1] = out[readback + 1] / 255;
      quantized[i * 3 + 2] = out[readback + 2] / 255;
    }
    void threshold;
    return quantized;
  } catch {
    return null;
  }
}

function compileProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const compile = (type: number, src: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

/**
 * Segments a geometry by vertex color. Uses the GPU color quantization pass
 * when WebGL2 is available with enough VRAM, then CPU connectivity labeling.
 * Returns the same RegionStats shape either way.
 */
export function segmentGeometry(
  geometry: THREE.BufferGeometry,
  options: GpuSegmenterOptions = {}
): RegionStats {
  const segmentGeometry: SegmentGeometry = {
    colors: geometry.getAttribute("color")
      ? new Float32Array(geometry.getAttribute("color").array as ArrayLike<number>)
      : undefined,
    indices: geometry.index ? new Uint32Array(geometry.index.array as ArrayLike<number>) : null,
    vertexCount: geometry.getAttribute("position").count,
  };
  return segmentColors(segmentGeometry, options);
}

/**
 * Segments raw vertex colors into regions. GPU-accelerated when available.
 */
export function segmentColors(
  geometry: SegmentGeometry,
  options: GpuSegmenterOptions = {}
): RegionStats {
  const threshold = options.threshold ?? 8.0;
  const colors = geometry.colors;

  // No color data → single empty region (all zero).
  if (!colors || colors.length === 0) {
    return {
      regionMask: new Uint8Array(geometry.vertexCount),
      regionCount: 0,
      regionSizes: [],
      boundaryEdgeCount: 0,
      regionColors: [],
    };
  }

  const gpu = detectGpu();
  const minVram = options.minVramMb ?? DEFAULT_MIN_VRAM;
  const useGpu = !options.forceCpu && gpu.available && gpu.webgl2 && gpu.vramMb >= minVram;

  if (useGpu) {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (gl) {
      const quantized = gpuSmoothColors(colors, threshold, gl);
      if (quantized) {
        return segmentByColor(quantized, geometry, { threshold, minRegionSize: options.minRegionSize });
      }
    }
  }

  return segmentByColor(colors, geometry, { threshold, minRegionSize: options.minRegionSize });
}
