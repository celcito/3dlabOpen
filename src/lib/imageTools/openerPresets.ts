import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { TracedImage, TracedRegion } from "./traceImage";

/**
 * Built-in opener library. Each preset is a drawing that is extruded as a
 * colored relief on a rectangular tab-lifter base — so the opener is always
 * "formato retangular" (unlike an uploaded photo that follows the silhouette).
 *
 * The SVG uses one `<g fill="...">` per drawing colour; every colour becomes
 * a separate region (filament) on the front face, exactly like a traced photo.
 */
export interface OpenerPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  svg: string;
}

/** Portrait ratio of the rectangular base: height = width * OPENR_ASPECT. */
const OPENR_ASPECT = 1.5;
/** Fraction of the base the drawing may occupy (padding around the edges). */
const DRAW_FRACTION = 0.72;

export const OPENER_PRESETS: OpenerPreset[] = [
  {
    id: "butterfly",
    name: "Borboleta",
    icon: "🦋",
    description: "Asas simétricas com corpo central em duas cores",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#8E24AA">
        <path d="M 46 46 C 40 20 12 20 12 42 C 12 60 42 62 46 50 Z"/>
        <path d="M 54 46 C 60 20 88 20 88 42 C 88 60 58 62 54 50 Z"/>
        <path d="M 46 54 C 38 64 24 84 34 90 C 44 94 46 74 46 62 Z"/>
        <path d="M 54 54 C 62 64 76 84 66 90 C 56 94 54 74 54 62 Z"/>
      </g>
      <g fill="#5E35B1">
        <ellipse cx="50" cy="54" rx="4" ry="26"/>
        <circle cx="50" cy="25" r="3.5"/>
        <path d="M 47 22 Q 42 14 38 12" fill="none" stroke="#5E35B1" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 53 22 Q 58 14 62 12" fill="none" stroke="#5E35B1" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>`,
  },
  {
    id: "lips",
    name: "Boca",
    icon: "💋",
    description: "Lábios estilizados em batom",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#D64545">
        <path d="M 50 58 C 38 42 16 46 14 55 C 22 66 38 64 50 70 C 62 64 78 66 86 55 C 84 46 62 42 50 58 Z"/>
        <path d="M 50 70 C 40 74 26 72 20 66 C 30 74 44 76 50 76 Z" fill="#F1948A"/>
      </g>
    </svg>`,
  },
  {
    id: "puppy",
    name: "Cachorrinho",
    icon: "🐶",
    description: "Focinho canino com orelhas caídas",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#B0601A">
        <ellipse cx="24" cy="48" rx="14" ry="26"/>
        <ellipse cx="76" cy="48" rx="14" ry="26"/>
      </g>
      <g fill="#C97B2D">
        <ellipse cx="50" cy="60" rx="30" ry="28"/>
        <ellipse cx="50" cy="78" rx="16" ry="12"/>
      </g>
      <g fill="#3B2A1A">
        <circle cx="38" cy="54" r="4"/>
        <circle cx="62" cy="54" r="4"/>
        <ellipse cx="50" cy="72" rx="5" ry="4"/>
      </g>
    </svg>`,
  },
  {
    id: "kitten",
    name: "Gatinho",
    icon: "🐱",
    description: "Rosto felino com orelhas pontudas",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#ED8936">
        <path d="M 50 36 L 33 14 L 30 32 Z"/>
        <path d="M 50 36 L 67 14 L 70 32 Z"/>
      </g>
      <g fill="#F6AD55">
        <ellipse cx="50" cy="60" rx="32" ry="30"/>
      </g>
      <g fill="#2D3748">
        <ellipse cx="38" cy="54" rx="4" ry="5"/>
        <ellipse cx="62" cy="54" rx="4" ry="5"/>
        <ellipse cx="50" cy="66" rx="5" ry="3.5"/>
        <path d="M 45 62 Q 50 58 55 62" fill="none" stroke="#2D3748" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>`,
  },
  {
    id: "heart",
    name: "Coração",
    icon: "❤️",
    description: "Coração clássico em alto relevo",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#E53E3E">
        <path d="M 50 88 C 22 66 14 42 30 30 C 40 23 48 28 50 36 C 52 28 60 23 70 30 C 86 42 78 66 50 88 Z"/>
        <path d="M 38 40 C 30 42 26 52 32 60 C 36 50 42 46 50 48 C 46 44 42 42 38 40 Z" fill="#FC8181"/>
      </g>
    </svg>`,
  },
  {
    id: "star",
    name: "Estrela",
    icon: "⭐",
    description: "Estrela de cinco pontas",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#F6E05E">
        <path d="M 50 12 L 61 40 L 90 41 L 68 60 L 77 89 L 50 71 L 23 89 L 32 60 L 10 41 L 39 40 Z"/>
        <path d="M 50 24 L 42 46 L 20 47 L 37 61 L 30 83 L 50 68 Z" fill="#FDE68A"/>
      </g>
    </svg>`,
  },
  {
    id: "paw",
    name: "Patinha",
    icon: "🐾",
    description: "Almofadinha e quatro dedinhos",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#A0AEC0">
        <ellipse cx="34" cy="40" rx="9" ry="13"/>
        <ellipse cx="50" cy="31" rx="9" ry="13"/>
        <ellipse cx="66" cy="40" rx="9" ry="13"/>
      </g>
      <g fill="#718096">
        <ellipse cx="50" cy="70" rx="24" ry="19"/>
      </g>
    </svg>`,
  },
  {
    id: "flower",
    name: "Florzinha",
    icon: "🌸",
    description: "Flor de cinco pétalas com miolo",
    svg: `<svg viewBox="0 0 100 100">
      <g fill="#F687B3">
        <ellipse cx="50" cy="28" rx="13" ry="17"/>
        <ellipse cx="50" cy="72" rx="13" ry="17"/>
        <ellipse cx="28" cy="50" rx="17" ry="13"/>
        <ellipse cx="72" cy="50" rx="17" ry="13"/>
        <ellipse cx="38" cy="34" rx="15" ry="11" transform="rotate(45 38 34)"/>
        <ellipse cx="62" cy="66" rx="15" ry="11" transform="rotate(45 62 66)"/>
      </g>
      <g fill="#ED8936">
        <circle cx="50" cy="50" r="13"/>
      </g>
    </svg>`,
  },
];

/** Drop consecutive near-duplicate points (sub-pixel SVG noise). */
function dedupeContour(points: THREE.Vector2[], tol = 1e-4): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(p.x - prev.x) < tol && Math.abs(p.y - prev.y) < tol) continue;
    out.push(p);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(last.x - first.x) < tol && Math.abs(last.y - first.y) < tol) out.pop();
  }
  return out;
}

/** SVGLoader sub-paths → a THREE.Shape (first sub-path = contour, rest = holes). */
function pathToShape(path: { subPaths: { getPoints: (d: number) => THREE.Vector2[] }[] }): THREE.Shape | null {
  const subs = path.subPaths
    .map((s) => dedupeContour(s.getPoints(24)))
    .filter((p) => p.length >= 3);
  if (subs.length === 0) return null;
  const outerPoints = subs[0];
  const shape = new THREE.Shape();
  shape.moveTo(outerPoints[0].x, outerPoints[0].y);
  for (let i = 1; i < outerPoints.length; i++) shape.lineTo(outerPoints[i].x, outerPoints[i].y);
  shape.closePath();
  for (let i = 1; i < subs.length; i++) {
    const points = subs[i];
    const hole = new THREE.Path();
    hole.moveTo(points[0].x, points[0].y);
    for (let j = 1; j < points.length; j++) hole.lineTo(points[j].x, points[j].y);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

/** Expand `box` with the control hull of a curve. The hull always contains the
 *  true curve, so a fit computed from it can never overflow the base. */
function expandCurveHull(box: THREE.Box2, curve: THREE.Curve<THREE.Vector2>): void {
  const c = curve as {
    v0?: { x: number; y: number }; v1?: { x: number; y: number };
    v2?: { x: number; y: number }; v3?: { x: number; y: number };
    aX?: number; aY?: number; xRadius?: number; yRadius?: number; aRotation?: number;
    points?: { x: number; y: number }[];
  };
  const push = (x: number, y: number) => box.expandByPoint(new THREE.Vector2(x, y));
  if (c.v0) {
    push(c.v0.x, c.v0.y);
    push(c.v1.x, c.v1.y);
    push(c.v2.x, c.v2.y);
    if (c.v3) push(c.v3.x, c.v3.y);
  } else if (c.aX !== undefined) {
    // EllipseCurve — axis-aligned bounding box of the rotated ellipse.
    const r = c.xRadius ?? 0;
    const r2 = c.yRadius ?? 0;
    const rot = c.aRotation ?? 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const hw = Math.sqrt(r * r * cos * cos + r2 * r2 * sin * sin);
    const hh = Math.sqrt(r * r * sin * sin + r2 * r2 * cos * cos);
    push(c.aX - hw, c.aY - hh);
    push(c.aX + hw, c.aY + hh);
  } else if (c.points) {
    for (const p of c.points) push(p.x, p.y);
  } else if (c.v1) {
    push(c.v1.x, c.v1.y);
    push(c.v2.x, c.v2.y);
  }
}

/** Combined bounding box of a preset drawing, measured from the ORIGINAL
 *  SVG curve hulls (not the sampled polygon) — conservative, so the fit
 *  keeps every rebuilt shape safely inside the rectangular base. */
function drawingBBox(parsed: ReturnType<SVGLoader["parse"]>): { width: number; height: number; minX: number; minY: number; maxX: number; maxY: number } {
  const box = new THREE.Box2();
  for (const path of parsed.paths) {
    for (const sub of path.subPaths) {
      for (const curve of sub.curves) expandCurveHull(box, curve as THREE.Curve<THREE.Vector2>);
    }
  }
  // SVG Y-down → Three Y-up, same as the shapes get.
  const size = new THREE.Vector2();
  box.getSize(size);
  return {
    width: size.x,
    height: size.y,
    minX: box.min.x,
    minY: -box.max.y,
    maxX: box.max.x,
    maxY: -box.min.y,
  };
}

/** Apply an in-place transform to every control point (outer + holes). */
function transformShape(shape: THREE.Shape, fn: (p: { x: number; y: number }) => void): void {
  const apply = (curves: THREE.Curve<THREE.Vector2>[]) => {
    for (const curve of curves) {
      const c = curve as { v1?: { x: number; y: number }; v2?: { x: number; y: number } };
      if (c.v1) fn(c.v1);
      if (c.v2) fn(c.v2);
    }
  };
  apply(shape.curves);
  for (const hole of shape.holes) apply(hole.curves);
}

/** Hex of the SVG fill (SVGLoader may normalise to `#rrggbb`). */
function normalizeFill(fill: string | undefined): string {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(fill || "");
  if (m) {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return "#" + [Number(m[1]), Number(m[2]), Number(m[3])].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
  }
  return (fill || "#ffffff").trim();
}

/**
 * Build a `TracedImage` from a preset: a rectangular `outer` (base) in mm
 * with the drawing scaled to fit inside, grouped per colour as `regions`.
 * The result plugs straight into `buildTabLifterParts` — the base follows the
 * rectangle ("formato retangular") and each colour becomes a relief filament.
 */
export function buildOpenerPreset(preset: OpenerPreset, targetWidthMm: number): TracedImage {
  const parsed = new SVGLoader().parse(preset.svg);

  // Group shapes by fill colour.
  const grouped = new Map<string, THREE.Shape[]>();
  for (const path of parsed.paths) {
    const style = (path.userData as { style?: { fill?: string } } | undefined)?.style;
    const fill = normalizeFill(style?.fill);
    if (fill === "none" || fill === "transparent") continue; // stroked decoration, not relief
    const shape = pathToShape(path);
    if (!shape) continue;
    transformShape(shape, (p) => { p.y = -p.y; }); // SVG Y-down → Three Y-up
    const list = grouped.get(fill);
    if (list) list.push(shape);
    else grouped.set(fill, [shape]);
  }
  if (grouped.size === 0) throw new Error("Nenhum contorno encontrado no preset.");

  // All drawing shapes, for the combined bounding box (hull-based, flipped).
  const allShapes = Array.from(grouped.values()).flat();
  const bbox = drawingBBox(parsed);

  // Rectangular base dimensions (portrait: taller than wide).
  const width = targetWidthMm;
  const height = width * OPENR_ASPECT;

  // Scale the drawing to fit comfortably inside the base, preserving aspect.
  const drawW = width * DRAW_FRACTION;
  const drawH = height * DRAW_FRACTION;
  const scale = Math.min(drawW / bbox.width, drawH / bbox.height);
  const drawCenterX = (bbox.minX + bbox.maxX) / 2;
  const drawCenterY = (bbox.minY + bbox.maxY) / 2;

  const applyTransform = (shape: THREE.Shape) =>
    transformShape(shape, (p) => {
      p.x = (p.x - drawCenterX) * scale + width / 2;
      p.y = (p.y - drawCenterY) * scale + height / 2;
    });
  for (const shape of allShapes) applyTransform(shape);

  // Base = rectangle in the same coordinate frame (base at y=0).
  const outer = new THREE.Shape();
  outer.moveTo(0, 0);
  outer.lineTo(width, 0);
  outer.lineTo(width, height);
  outer.lineTo(0, height);
  outer.closePath();
  const imageFrame = outer.clone();

  const regions: TracedRegion[] = [];
  let id = 1;
  for (const [color, shapes] of grouped) {
    regions.push({ color, shapes });
    id++;
  }

  return {
    outer,
    imageFrame,
    details: [],
    regions,
    backgroundColor: "#f5f3ec",
    widthMm: width,
    heightMm: height,
    svg: preset.svg,
    pixelSize: { width: 100, height: 100 },
  };
}