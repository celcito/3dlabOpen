export type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const value = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 };
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

/**
 * CIE76 color difference (ΔE).
 * 0 = identical, ~1 = barely perceptible, > 8 = clearly different.
 */
export function deltaE(a: RGB, b: RGB): number {
  const dr = (a.r - b.r) / 255;
  const dg = (a.g - b.g) / 255;
  const db = (a.b - b.b) / 255;
  return Math.sqrt(dr * dr + dg * dg + db * db) * 100;
}

export function colorsClose(hexA: string, hexB: string, threshold = 8.0): boolean {
  return deltaE(hexToRgb(hexA), hexToRgb(hexB)) < threshold;
}

export function colorHexFromRGBArray(arr: Float32Array, index: number): string {
  const r = arr[index * 3];
  const g = arr[index * 3 + 1];
  const b = arr[index * 3 + 2];
  return rgbToHex(r * 255, g * 255, b * 255);
}