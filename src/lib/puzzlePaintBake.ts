/**
 * Bakes the artwork into per-triangle paint states for Bambu Studio's
 * `paint_color` attribute (3MF color painting), replacing the UV texture
 * path that Bambu ignores on 3MF files.
 *
 * Front triangles are detected with the same UV-span heuristic used by
 * `subdivideFrontFaces` (span > 0.02); sides/back have degenerate UVs and
 * stay on the base color (state 0 = no `paint_color`).
 */

import * as THREE from "three";
import { rasterizeToPngDataUrl } from "./threeMfExporter";

export interface ImagePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

/** Anything with a `#RRGGBB` color — structurally compatible with PaletteSlot. */
export interface PaintColor {
  color: string;
}

/** UV span above this threshold = front face carrying the artwork. */
const FRONT_UV_SPAN = 0.02;

/**
 * Load an image (PNG/JPEG/SVG data URL, blob or http) and rasterize it to
 * raw RGBA pixels via canvas. Rejects when the image cannot be decoded.
 *
 * SVG / non-base64 data URLs (arte procedural) don't decode reliably in
 * `Image`, so they are rasterized through `rasterizeToPngDataUrl` first.
 */
export async function loadImagePixels(url: string): Promise<ImagePixels> {
  let src = url;
  if (url.startsWith("data:") && !/^data:image\/(png|jpeg|jpg);base64,/i.test(url)) {
    src = (await rasterizeToPngDataUrl(url)) ?? url;
  }
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url.slice(0, 80)}`));
    img.src = src;
  });

  const width = Math.max(1, img.naturalWidth || img.width || 1);
  const height = Math.max(1, img.naturalHeight || img.height || 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

/**
 * Bake one paint state per triangle of `geometry` (in serialization order).
 * Returns a Uint8Array of length = triangle count; 0 means "not painted"
 * (sides/back keep the base extruder), 1..16 is the 1-based palette slot.
 *
 * Triangles are sampled at their UV centroid (V flipped: UV v=0 is the image
 * bottom, like THREE textures with flipY). Geometries without UVs or an empty
 * palette yield all zeros.
 */
export function bakePaintForGeometry(
  geometry: THREE.BufferGeometry,
  pixels: ImagePixels,
  palette: readonly PaintColor[]
): Uint8Array {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = geom.getAttribute("position");
  const uvAttr = geom.getAttribute("uv");
  const triCount = posAttr ? Math.floor(posAttr.count / 3) : 0;
  const states = new Uint8Array(triCount);

  if (!posAttr || !uvAttr || uvAttr.count !== posAttr.count || palette.length === 0) {
    return states;
  }

  const colors = palette.map(p => hexToRgb(p.color));

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const u0 = uvAttr.getX(i0);
    const v0 = uvAttr.getY(i0);
    const u1 = uvAttr.getX(i0 + 1);
    const v1 = uvAttr.getY(i0 + 1);
    const u2 = uvAttr.getX(i0 + 2);
    const v2 = uvAttr.getY(i0 + 2);

    const uvSpan =
      Math.max(u0, u1, u2) - Math.min(u0, u1, u2) +
      Math.max(v0, v1, v2) - Math.min(v0, v1, v2);
    if (uvSpan <= FRONT_UV_SPAN) continue; // side/back shell → base color

    const u = (u0 + u1 + u2) / 3;
    const v = (v0 + v1 + v2) / 3;
    const x = clampInt(Math.floor(u * pixels.width), 0, pixels.width - 1);
    const y = clampInt(Math.floor((1 - v) * pixels.height), 0, pixels.height - 1);
    const idx = (y * pixels.width + x) * 4;

    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < colors.length; c++) {
      const dr = pixels.data[idx] - colors[c][0];
      const dg = pixels.data[idx + 1] - colors[c][1];
      const db = pixels.data[idx + 2] - colors[c][2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    states[t] = best + 1;
  }

  return states;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
