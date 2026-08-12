import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, deltaE, colorsClose, colorHexFromRGBArray } from "../deltaE";

describe("deltaE (CIE76)", () => {
  it("returns 0 for identical colors", () => {
    expect(deltaE(hexToRgb("#ff0000"), hexToRgb("#ff0000"))).toBe(0);
  });

  it("returns > 8 for drastically different colors", () => {
    expect(deltaE(hexToRgb("#000000"), hexToRgb("#ffffff"))).toBeGreaterThan(8);
  });

  it("converts short and long hex forms", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("round-trips rgb <-> hex", () => {
    const hex = rgbToHex(24, 120, 250);
    expect(hex.length).toBe(7);
    expect(hexToRgb(hex)).toEqual({ r: 24, g: 120, b: 250 });
  });

  it("clamps out-of-range rgb values", () => {
    expect(hexToRgb(rgbToHex(-5, 300, 100))).toEqual({ r: 0, g: 255, b: 100 });
  });

  it("colorsClose uses the threshold", () => {
    expect(colorsClose("#ffffff", "#fffefe", 8)).toBe(true);
    expect(colorsClose("#000000", "#ffffff", 8)).toBe(false);
  });

  it("reads color from Float32Array normalized to 0..1", () => {
    const arr = new Float32Array([1, 0, 0, 0, 1, 0]);
    expect(colorHexFromRGBArray(arr, 0)).toBe("#ff0000");
    expect(colorHexFromRGBArray(arr, 1)).toBe("#00ff00");
  });
});