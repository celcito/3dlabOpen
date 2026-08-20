import { describe, it, expect } from "vitest";
import { traceImageData } from "../traceImage";
import * as THREE from "three";

/** Build a synthetic ImageData with a colored shape + text label. */
function makeSyntheticImageData(): ImageData {
  if (typeof document === "undefined") throw new Error("jsdom required");
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = "#fcd34d";
  ctx.fillRect(40, 50, 120, 100);
  ctx.fillStyle = "#1d4ed8";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("T", 95, 120);
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(50, 60);
  ctx.lineTo(150, 140);
  ctx.stroke();
  return ctx.getImageData(0, 0, 200, 200);
}

describe("traceImageData", () => {
  it("extracts outer silhouette + inner details from raster", () => {
    const data = makeSyntheticImageData();
    const result = traceImageData(data, 200, 200, 60, { numberOfColors: 4, pathOmit: 4 });

    expect(result.outer).toBeTruthy();
    expect(result.widthMm).toBeCloseTo(60, 1);
    expect(result.heightMm).toBeGreaterThan(0);
    expect(result.details.length).toBeGreaterThanOrEqual(1);
    expect(result.svg).toContain("<svg");
  }, 30_000);

  it("imageFrame is the full image rectangle and encloses the silhouette", () => {
    const data = makeSyntheticImageData();
    const result = traceImageData(data, 200, 200, 60, { numberOfColors: 4, pathOmit: 4 });

    const frameBox = new THREE.Box2();
    result.imageFrame.getPoints().forEach((p) => frameBox.expandByPoint(p));
    const frameSize = frameBox.getSize(new THREE.Vector2());
    const outerBox = new THREE.Box2();
    result.outer.getPoints().forEach((p) => outerBox.expandByPoint(p));
    // 200x200 source → square frame (possibly rotated), scaled to the same
    // coordinate space as outer. It must be at least as big as the silhouette.
    expect(frameSize.x).toBeCloseTo(frameSize.y, 1);
    expect(frameSize.x * frameSize.y).toBeGreaterThanOrEqual(
      (outerBox.max.x - outerBox.min.x) * (outerBox.max.y - outerBox.min.y)
    );
    expect(frameBox.containsBox(outerBox)).toBe(true);
  }, 30_000);

  it("auto-rotates to portrait when source is landscape", () => {
    if (typeof document === "undefined") throw new Error("jsdom required");
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 300, 100);
    ctx.fillStyle = "#000000";
    ctx.fillRect(20, 20, 260, 60);
    const data = ctx.getImageData(0, 0, 300, 100);
    const result = traceImageData(data, 300, 100, 80);

    // After rotation, height should be ≥ width.
    expect(result.heightMm).toBeGreaterThanOrEqual(result.widthMm * 0.9);
  }, 30_000);

  it("keeps the drawing palette as coloured regions + a background colour", () => {
    const data = makeSyntheticImageData();
    const result = traceImageData(data, 200, 200, 60, { numberOfColors: 4, pathOmit: 4 });

    expect(result.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.regions.length).toBeGreaterThanOrEqual(1);
    const regionShapes = result.regions.reduce((n, r) => n + r.shapes.length, 0);
    expect(regionShapes).toBeGreaterThan(0);
    // All region colours are well-formed hex strings.
    for (const region of result.regions) {
      expect(region.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(region.shapes.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it("recovers a colour fully nested inside another colour", () => {
    if (typeof document === "undefined") throw new Error("jsdom required");
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = "#fcd34d";
    ctx.fillRect(40, 50, 120, 100);
    ctx.fillStyle = "#e61414";
    ctx.fillRect(60, 70, 40, 40);
    const data = ctx.getImageData(0, 0, 200, 200);

    const result = traceImageData(data, 200, 200, 60, { numberOfColors: 4, pathOmit: 4 });
    const reds = result.regions.filter((r) => /e61414|fcd34d|1d4ed8|7c2d12/i.test(r.color));
    expect(reds.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("antialiased edges do not spawn grey fringe regions", () => {
    if (typeof document === "undefined") throw new Error("jsdom required");
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 300, 300);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 20;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(150, 260);
    ctx.bezierCurveTo(50, 170, 70, 60, 150, 150);
    ctx.bezierCurveTo(230, 60, 250, 170, 150, 260);
    ctx.stroke();

    const result = traceImageData(ctx.getImageData(0, 0, 300, 300), 300, 300, 60, { numberOfColors: 4, pathOmit: 4 });
    // A single-colour outline must collapse to ~1 region, not dozens of
    // antialiased grey slivers.
    expect(result.regions.length).toBeLessThanOrEqual(2);
    const slivers = result.regions.reduce((n, r) => n + r.shapes.length, 0);
    expect(slivers).toBeLessThanOrEqual(5);
  }, 30_000);
});