import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as ClipperLib from 'clipper-lib';
import type { ThermoformConfig } from '../../types/thermoform';
import { getPreset } from './presets';

const CLIPPER_SCALE = 1000;
const CURVE_SEGMENTS = 24;

/** Contorno em mm, centrado na origem, convenção y-up. */
export interface ThermoformOutline {
  outer: number[][];
  holes: number[][][];
}

export interface PerimeterSample {
  x: number;
  y: number;
  /** Normal externa (unidade). */
  nx: number;
  ny: number;
  arclen: number;
}

/** Área assinada (shoelace); positiva = CCW em y-up. */
export function polygonArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function ringPerimeter(ring: number[][]): number {
  let per = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return per;
}

export function bboxOfRings(rings: number[][][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

function dedupeClosing(ring: number[][]): number[][] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) return ring.slice(0, -1);
  return ring;
}

function normalizeRings(
  outer: number[][],
  holes: number[][][],
  sizeMm: number
): ThermoformOutline {
  const box = bboxOfRings([outer, ...holes]);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const scale = span > 1e-9 ? sizeMm / span : 1;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const map = (ring: number[][]) =>
    dedupeClosing(ring.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale]));
  return { outer: map(outer), holes: holes.map(map) };
}

function shapeToRings(shape: THREE.Shape): { outer: number[][]; holes: number[][][] } {
  // SVGLoader trabalha em y-down; inverte para a convenção y-up do app.
  const outer = dedupeClosing(shape.getPoints(CURVE_SEGMENTS).map((p) => [p.x, -p.y]));
  const holes = shape.holes.map((h) =>
    dedupeClosing(h.getPoints(CURVE_SEGMENTS).map((p) => [p.x, -p.y]))
  );
  return { outer, holes };
}

/**
 * Interpreta markup SVG e devolve o **maior contorno externo** (furos preservados),
 * normalizado para o maior lado = `sizeMm`, centrado na origem.
 */
export function outlineFromSvgMarkup(svgMarkup: string, sizeMm: number): ThermoformOutline | null {
  if (!svgMarkup || !svgMarkup.trim()) return null;

  let shapes: THREE.Shape[];
  try {
    const data = new SVGLoader().parse(svgMarkup);
    shapes = [];
    data.paths.forEach((path) => {
      SVGLoader.createShapes(path).forEach((s) => shapes.push(s));
    });
  } catch (err) {
    console.warn('Falha ao interpretar SVG:', err);
    return null;
  }
  if (shapes.length === 0) return null;

  let best: { outer: number[][]; holes: number[][][] } | null = null;
  let bestArea = 0;
  for (const shape of shapes) {
    const rings = shapeToRings(shape);
    if (rings.outer.length < 3) continue;
    const area = Math.abs(polygonArea(rings.outer));
    if (area > bestArea) {
      bestArea = area;
      best = rings;
    }
  }
  if (!best) return null;

  const outline = normalizeRings(best.outer, best.holes, sizeMm);
  return outline.outer.length >= 3 ? outline : null;
}

/** Path data (convenção SVG) → outline normalizado. */
export function outlineFromPathData(pathData: string, sizeMm: number): ThermoformOutline | null {
  if (!pathData || !pathData.trim()) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${pathData}" fill="#000000"/></svg>`;
  return outlineFromSvgMarkup(svg, sizeMm);
}

/**
 * Resolve o outline da config: SVG importado (markup completo ou path data, se presente)
 * senão o preset.
 */
export function resolveOutline(config: ThermoformConfig): ThermoformOutline | null {
  const src = config.svgPathData?.trim();
  if (src) {
    if (src.startsWith('<')) return outlineFromSvgMarkup(src, config.sizeMm);
    return outlineFromPathData(src, config.sizeMm);
  }
  return outlineFromPathData(getPreset(config.preset).pathData, config.sizeMm);
}

function toClipperPath(ring: number[][], forcePositiveOrientation: boolean): ClipperLib.Path {
  const path: ClipperLib.Path = ring.map(([x, y]) => ({
    X: Math.round(x * CLIPPER_SCALE),
    Y: Math.round(y * CLIPPER_SCALE),
  }));
  const isPositive = ClipperLib.Clipper.Orientation(path);
  if (isPositive !== forcePositiveOrientation) path.reverse();
  return path;
}

function fromClipperPath(path: ClipperLib.Path): number[][] {
  return path.map((p) => [p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE]);
}

function pointInRing(pt: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/**
 * Erosão (`delta < 0`) / dilatação (`delta > 0`) do contorno via `ClipperOffset` (jtRound).
 * Furos são erodidos junto (expandidos fisicamente) — o furo encolhe no mesmo delta.
 * Retorna null se o contorno colapsar.
 */
export function offsetOutline(outline: ThermoformOutline, deltaMm: number): ThermoformOutline | null {
  if (Math.abs(deltaMm) < 1e-9) {
    return { outer: outline.outer.map((p) => [p[0], p[1]]), holes: outline.holes.map((h) => h.map((p) => [p[0], p[1]])) };
  }

  const co = new ClipperLib.ClipperOffset(2, 0.25 * CLIPPER_SCALE);
  co.AddPath(toClipperPath(outline.outer, true), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  for (const hole of outline.holes) {
    co.AddPath(toClipperPath(hole, false), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  }

  const solution: ClipperLib.Path[] = [];
  co.Execute(solution, deltaMm * CLIPPER_SCALE);
  if (solution.length === 0) return null;

  const rings = solution.map(fromClipperPath).filter((r) => r.length >= 3);
  if (rings.length === 0) return null;

  let outer = rings[0];
  let outerArea = 0;
  for (const ring of rings) {
    const area = Math.abs(polygonArea(ring));
    if (area > outerArea) {
      outerArea = area;
      outer = ring;
    }
  }
  const holes = rings.filter((r) => r !== outer && pointInRing(r[0], outer));
  return { outer, holes };
}

/**
 * Clamp da erosão máxima do domo: fração do `sizeMm` limitada pela "espessura média"
 * do contorno (2·área/perímetro) — evita colapsar corte de coração e braços de estrela.
 */
export function clampErosionMax(outline: ThermoformOutline, sizeMm: number, maxRatio: number): number {
  const area = Math.abs(polygonArea(outline.outer));
  const per = ringPerimeter(outline.outer);
  const meanWidth = per > 1e-9 ? (2 * area) / per : 0;
  return Math.max(0, Math.min(sizeMm * maxRatio, meanWidth * 0.5 - 0.05));
}

function ensureCcw(ring: number[][]): number[][] {
  return polygonArea(ring) < 0 ? [...ring].reverse() : ring;
}

/** Amostra o perímetro com normais externas, a cada `spacing` mm de arco. */
export function samplePerimeter(outer: number[][], spacing: number): PerimeterSample[] {
  const ring = ensureCcw(outer);
  const n = ring.length;
  const samples: PerimeterSample[] = [];
  if (n < 3 || spacing <= 0) return samples;

  let acc = 0;
  let nextAt = spacing / 2;
  let total = ringPerimeter(ring);
  if (total <= 1e-9) return samples;

  // Evita loop infinito se o espaçamento for maior que o perímetro.
  if (nextAt >= total) nextAt = total / 2;

  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    while (acc + len >= nextAt && nextAt < total) {
      const t = (nextAt - acc) / len;
      samples.push({
        x: a[0] + dx * t,
        y: a[1] + dy * t,
        nx: dy / len,
        ny: -dx / len,
        arclen: nextAt,
      });
      nextAt += spacing;
    }
    acc += len;
  }
  return samples;
}
