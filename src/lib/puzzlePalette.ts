/**
 * Fase 2 of the paint palette: extract dominant artwork colors with a pure,
 * deterministic k-means++ (fixed seed) and merge them with the user's
 * filament slots (user slots keep priority; total capped at 16 = AMS 1-4).
 */

import type { ImagePixels } from "./puzzlePaintBake";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface PaletteSlot {
  name: string; // "Filamento 1"…"slot5" | "Auto_1"…"Auto_N"
  color: string; // "#RRGGBB"
  base: boolean; // true = slot da cor base (extruder/laterais)
}

export interface MergePaletteOptions {
  /** Auto colors closer than this RGB distance to an existing slot are skipped. */
  dedupDistance?: number;
  /** Total palette cap (16 = AMS slots 1-4 + virtuais). */
  cap?: number;
}

const DEFAULT_SEED = 0x5eed1234;
const MAX_SAMPLES = 10_000;
const ITERATIONS = 12;
const DEFAULT_DEDUP_DISTANCE = 30;
const DEFAULT_CAP = 16;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist2(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** Deterministic stride sampling capped at 10k pixels. */
function samplePixels(pixels: ImagePixels): Rgb[] {
  const total = Math.max(0, Math.floor(pixels.width) * Math.floor(pixels.height));
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLES));
  const samples: Rgb[] = [];
  for (let i = 0; i < total; i += stride) {
    const idx = i * 4;
    samples.push({
      r: pixels.data[idx],
      g: pixels.data[idx + 1],
      b: pixels.data[idx + 2],
    });
  }
  return samples;
}

/**
 * Deterministic k-means++ over the image pixels (≤10k samples, ~12 iterations).
 * Empty clusters are discarded, so ≤ k colors are returned (K = 0 → []).
 */
export function kmeansPalette(
  pixels: ImagePixels,
  k: number,
  seed: number = DEFAULT_SEED
): Rgb[] {
  if (!Number.isFinite(k) || k < 1) return [];
  const samples = samplePixels(pixels);
  if (samples.length === 0) return [];

  const rand = mulberry32(seed);
  const targetK = Math.min(Math.floor(k), samples.length);

  // k-means++ seeding
  const centroids: Rgb[] = [{ ...samples[Math.floor(rand() * samples.length)] }];
  while (centroids.length < targetK) {
    const weights = samples.map(s => {
      let min = Infinity;
      for (const c of centroids) {
        const d = dist2(s, c);
        if (d < min) min = d;
      }
      return min;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) break; // todas as cores já cobertas → clusters extras vazios
    const threshold = rand() * total;
    let acc = 0;
    let picked = samples.length - 1;
    for (let i = 0; i < samples.length; i++) {
      acc += weights[i];
      if (acc >= threshold) {
        picked = i;
        break;
      }
    }
    centroids.push({ ...samples[picked] });
  }

  // Lloyd iterations; empty clusters keep their centroid until the final cull.
  const counts = new Array<number>(centroids.length).fill(0);
  let assignments = new Int32Array(samples.length).fill(-1);
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    let changed = false;
    for (let i = 0; i < samples.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(samples[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
      const sum = sums[best];
      sum.r += samples[i].r;
      sum.g += samples[i].g;
      sum.b += samples[i].b;
      sum.n += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c].n > 0) {
        centroids[c] = {
          r: Math.round(sums[c].r / sums[c].n),
          g: Math.round(sums[c].g / sums[c].n),
          b: Math.round(sums[c].b / sums[c].n),
        };
      }
      counts[c] = sums[c].n;
    }
    if (!changed) break;
  }

  return centroids.filter((_, c) => counts[c] > 0);
}

/**
 * Merge user filament slots with automatically extracted colors.
 * User slots always come first (priority) and auto colors are deduplicated
 * against everything already in the palette; total is capped.
 */
export function mergePalette(
  userSlots: readonly PaletteSlot[],
  autoColors: readonly Rgb[],
  options: MergePaletteOptions = {}
): PaletteSlot[] {
  const dedupDistance = options.dedupDistance ?? DEFAULT_DEDUP_DISTANCE;
  const cap = options.cap ?? DEFAULT_CAP;

  const result: PaletteSlot[] = [];
  for (const slot of userSlots) {
    if (result.length >= cap) break;
    result.push({ ...slot });
  }

  let autoIndex = 0;
  for (const color of autoColors) {
    if (result.length >= cap) break;
    const duplicated = result.some(slot => {
      const [r, g, b] = hexToRgb(slot.color);
      const dr = color.r - r;
      const dg = color.g - g;
      const db = color.b - b;
      return Math.sqrt(dr * dr + dg * dg + db * db) < dedupDistance;
    });
    if (duplicated) continue;
    autoIndex += 1;
    result.push({ name: `Auto_${autoIndex}`, color: rgbToHex(color), base: false });
  }

  return result;
}

function rgbToHex(color: Rgb): string {
  const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to2(color.r)}${to2(color.g)}${to2(color.b)}`.toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
