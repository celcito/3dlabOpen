/**
 * Bakes the artwork into per-triangle paint states for Bambu Studio's
 * `paint_color` attribute (3MF color painting), replacing the UV texture
 * path that Bambu ignores on 3MF files.
 *
 * Front triangles are the ones carrying real UVs (see `hasArtworkUV`); sides/back
 * have UVs pinned to (0,0) and stay on the base color (state 0 = no `paint_color`).
 * The UV *span* can't be used for this: fine triangles have a tiny span but are
 * still artwork.
 */

import * as THREE from "three";
import { rasterizeToPngDataUrl } from "./threeMfExporter";
import { hasArtworkUV } from "./puzzleSubdivideFront";

export interface ImagePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

/** Anything with a `#RRGGBB` color — structurally compatible with PaletteSlot. */
export interface PaintColor {
  color: string;
}

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

  const labs = palette.map(p => rgbToLab(hexToRgb(p.color)));
  const sample = (u: number, v: number): [number, number, number] => {
    const x = clampInt(Math.floor(u * pixels.width), 0, pixels.width - 1);
    const y = clampInt(Math.floor((1 - v) * pixels.height), 0, pixels.height - 1);
    const idx = (y * pixels.width + x) * 4;
    return [pixels.data[idx], pixels.data[idx + 1], pixels.data[idx + 2]];
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const u0 = uvAttr.getX(i0);
    const v0 = uvAttr.getY(i0);
    const u1 = uvAttr.getX(i0 + 1);
    const v1 = uvAttr.getY(i0 + 1);
    const u2 = uvAttr.getX(i0 + 2);
    const v2 = uvAttr.getY(i0 + 2);

    if (!hasArtworkUV(u0, v0, u1, v1, u2, v2)) continue; // side/back shell → base color

    // Cor do triângulo = média de 4 amostras (centróide + 3 pontos a meio caminho
    // dos vértices): menos ruído que um único pixel quando o triângulo cobre vários.
    const cu = (u0 + u1 + u2) / 3;
    const cv = (v0 + v1 + v2) / 3;
    const pts: Array<[number, number]> = [
      [cu, cv],
      [(cu + u0) / 2, (cv + v0) / 2],
      [(cu + u1) / 2, (cv + v1) / 2],
      [(cu + u2) / 2, (cv + v2) / 2],
    ];
    let r = 0, g = 0, b = 0;
    for (const [u, v] of pts) {
      const px = sample(u, v);
      r += px[0]; g += px[1]; b += px[2];
    }
    const lab = rgbToLab([r / pts.length, g / pts.length, b / pts.length]);

    // Slot mais próximo em CIE Lab (distância perceptual, melhor que RGB).
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < labs.length; c++) {
      const dl = lab[0] - labs[c][0];
      const da = lab[1] - labs[c][1];
      const db = lab[2] - labs[c][2];
      const dist = dl * dl + da * da + db * db;
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

/** sRGB (0..255) → CIE Lab (D65). */
function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
