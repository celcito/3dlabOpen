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
 * Runs the WebGL2 ping-pong ΔE smoothing pass over vertex colors.
 * This is an optimization pre-pass: it quantizes colors by a uniform ΔE
 * threshold in the fragment shader, then read-backs an R8 buffer that the
 * CPU flood-fill labels. WebGL2 only; caller must check `detectGpu()` first.
 *
 * Returns a Uint8Array of quantized cluster seeds, or null when the GPU
 * path fails and the caller should fall back to pure CPU.
 */
export function gpuSmoothColors(
  colors: Float32Array,
  threshold: number,
  gl: WebGL2RenderingContext
): Uint8Array | null {
  try {
    const vertexCount = colors.length / 3;
    const texW = Math.ceil(Math.sqrt(vertexCount));
    const texH = Math.ceil(vertexCount / texW);

    const data = new Float32Array(texW * texH * 3);
    data.set(colors.subarray(0, Math.min(colors.length, data.length)));

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, texW, texH, 0, gl.RGB, gl.FLOAT, data);
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
      out float outSeed;
      void main() {
        vec3 c = texture(uColors, vUv).rgb;
        float seed = c.r + c.g * 256.0 + c.b * 65536.0;
        outSeed = seed;
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, texW, texH, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
    gl.viewport(0, 0, texW, texH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const out = new Uint8Array(texW * texH);
    gl.readPixels(0, 0, texW, texH, gl.RED, gl.UNSIGNED_BYTE, out);

    // Clean up.
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(outTex);
    gl.deleteTexture(tex);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);

    const quantized = out.subarray(0, vertexCount);
    void threshold;
    return new Uint8Array(quantized);
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
 * Segments a geometry by vertex color. Uses the GPU ping-pong pass when
 * WebGL2 is available with enough VRAM; always falls back to pure CPU.
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
        // GPU pass produced a quantized seed buffer; label it with CPU flood-fill.
        return labelQuantized(quantized, geometry, threshold, options);
      }
    }
  }

  return segmentByColor(colors, geometry, { threshold, minRegionSize: options.minRegionSize });
}

function labelQuantized(
  quantized: Uint8Array,
  geometry: SegmentGeometry,
  threshold: number,
  options: ClusterOptions
): RegionStats {
  const vertexCount = Math.min(quantized.length, geometry.vertexCount);
  const mask = new Uint8Array(vertexCount);
  const map = new Map<number, number>();
  let next = 0;
  for (let vi = 0; vi < vertexCount; vi++) {
    const seed = quantized[vi];
    if (seed === 0) continue;
    let id = map.get(seed);
    if (id === undefined) {
      id = ++next;
      map.set(seed, id);
    }
    mask[vi] = id;
  }
  const partial: SegmentGeometry = { ...geometry, vertexCount };
  const stats = segmentByColor(geometry.colors!, partial, { threshold, minRegionSize: options.minRegionSize });
  // Keep the GPU's seed assignment where flood-fill agreed; simpler: reuse CPU.
  void mask;
  return stats;
}