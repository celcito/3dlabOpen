import { Point2D } from '../types';
import { distance, simplifyPointsRDP } from './drawingPrecision';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export type BezierNodeMode = 'corner' | 'smooth' | 'symmetric';

export interface BezierAnchor {
  pos: Point2D;
  handleIn: Point2D | null;
  handleOut: Point2D | null;
  mode: BezierNodeMode;
}

/**
 * Evaluates a cubic Bézier curve at parameter t in [0, 1]
 */
export function evaluateCubicBezier(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;

  return [
    a * p0[0] + b * cp1[0] + c * cp2[0] + d * p3[0],
    a * p0[1] + b * cp1[1] + c * cp2[1] + d * p3[1],
  ];
}

/**
 * Samples points along a single cubic Bézier segment between two anchors
 */
export function sampleBezierSegment(
  a0: BezierAnchor,
  a1: BezierAnchor,
  steps: number = 20
): Point2D[] {
  const p0 = a0.pos;
  const p3 = a1.pos;
  const cp1 = a0.handleOut;
  const cp2 = a1.handleIn;

  // Pure straight line segment if neither handle exists
  if (!cp1 && !cp2) {
    return [p0, p3];
  }

  const c1 = cp1 || p0;
  const c2 = cp2 || p3;
  const pts: Point2D[] = [];

  for (let i = 0; i <= steps; i++) {
    pts.push(evaluateCubicBezier(p0, c1, c2, p3, i / steps));
  }

  return pts;
}

/**
 * Evaluates a full list of Bézier anchors into a dense 2D polyline for rendering and 3D extrusion
 */
export function sampleBezierPath(
  anchors: BezierAnchor[],
  isClosed: boolean,
  stepsPerSegment: number = 20
): Point2D[] {
  if (anchors.length === 0) return [];
  if (anchors.length === 1) return [anchors[0].pos];

  const result: Point2D[] = [];
  const segCount = isClosed ? anchors.length : anchors.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a0 = anchors[i];
    const a1 = anchors[(i + 1) % anchors.length];
    const segPts = sampleBezierSegment(a0, a1, stepsPerSegment);

    if (i === 0) {
      result.push(...segPts);
    } else {
      // Avoid duplicating junction vertex
      result.push(...segPts.slice(1));
    }
  }

  return result;
}

/**
 * Converts a polyline (e.g. from freehand drawing) into smooth editable Cubic Bézier anchors
 */
export function polylineToBezierAnchors(
  points: Point2D[],
  isClosed: boolean,
  simplifyEpsilon: number = 1.4
): BezierAnchor[] {
  if (points.length < 2) return [];

  // Remove duplicate closing point if present
  let basePts = [...points];
  if (isClosed && basePts.length > 2 && distance(basePts[0], basePts[basePts.length - 1]) < 0.8) {
    basePts = basePts.slice(0, basePts.length - 1);
  }

  // Simplify dense freehand points into clean key anchors
  let keyPts = basePts.length > 6 ? simplifyPointsRDP(basePts, simplifyEpsilon) : basePts;
  if (keyPts.length < 2) keyPts = basePts.slice(0, 2);

  const n = keyPts.length;
  const anchors: BezierAnchor[] = [];

  for (let i = 0; i < n; i++) {
    const curr = keyPts[i];
    const prev = isClosed ? keyPts[(i - 1 + n) % n] : i > 0 ? keyPts[i - 1] : null;
    const next = isClosed ? keyPts[(i + 1) % n] : i < n - 1 ? keyPts[i + 1] : null;

    let handleIn: Point2D | null = null;
    let handleOut: Point2D | null = null;
    let mode: BezierNodeMode = 'smooth';

    if (prev && next) {
      // Check corner sharpness via dot product
      const vInX = curr[0] - prev[0];
      const vInY = curr[1] - prev[1];
      const vOutX = next[0] - curr[0];
      const vOutY = next[1] - curr[1];
      const lenIn = Math.hypot(vInX, vInY) || 1;
      const lenOut = Math.hypot(vOutX, vOutY) || 1;

      const dot = (vInX / lenIn) * (vOutX / lenOut) + (vInY / lenIn) * (vOutY / lenOut);

      // Sharp angle (< ~105 degrees) becomes corner anchor
      if (dot < -0.25) {
        mode = 'corner';
        handleIn = [
          curr[0] - (vInX / lenIn) * Math.min(lenIn * 0.25, 4),
          curr[1] - (vInY / lenIn) * Math.min(lenIn * 0.25, 4),
        ];
        handleOut = [
          curr[0] + (vOutX / lenOut) * Math.min(lenOut * 0.25, 4),
          curr[1] + (vOutY / lenOut) * Math.min(lenOut * 0.25, 4),
        ];
      } else {
        // Smooth tangent along prev -> next
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        const tLen = Math.hypot(tx, ty) || 1;
        const ux = tx / tLen;
        const uy = ty / tLen;

        const dIn = lenIn * 0.32;
        const dOut = lenOut * 0.32;

        handleIn = [
          Math.max(0, Math.min(100, curr[0] - ux * dIn)),
          Math.max(0, Math.min(100, curr[1] - uy * dIn)),
        ];
        handleOut = [
          Math.max(0, Math.min(100, curr[0] + ux * dOut)),
          Math.max(0, Math.min(100, curr[1] + uy * dOut)),
        ];
      }
    } else if (next) {
      mode = 'corner';
      handleOut = [
        curr[0] + (next[0] - curr[0]) * 0.25,
        curr[1] + (next[1] - curr[1]) * 0.25,
      ];
    } else if (prev) {
      mode = 'corner';
      handleIn = [
        curr[0] - (curr[0] - prev[0]) * 0.25,
        curr[1] - (curr[1] - prev[1]) * 0.25,
      ];
    }

    anchors.push({
      pos: curr,
      handleIn,
      handleOut,
      mode,
    });
  }

  return anchors;
}

/**
 * Updates a control handle on an anchor while enforcing its mode (corner, smooth, symmetric)
 */
export function updateAnchorHandle(
  anchor: BezierAnchor,
  which: 'in' | 'out',
  newHandlePos: Point2D
): BezierAnchor {
  const clamped: Point2D = [
    Math.max(0, Math.min(100, newHandlePos[0])),
    Math.max(0, Math.min(100, newHandlePos[1])),
  ];

  const dx = clamped[0] - anchor.pos[0];
  const dy = clamped[1] - anchor.pos[1];
  const draggedLen = Math.hypot(dx, dy);

  if (anchor.mode === 'corner') {
    return {
      ...anchor,
      handleIn: which === 'in' ? clamped : anchor.handleIn,
      handleOut: which === 'out' ? clamped : anchor.handleOut,
    };
  }

  const oppWhich = which === 'in' ? 'out' : 'in';
  const existingOpp = oppWhich === 'in' ? anchor.handleIn : anchor.handleOut;

  let oppHandle: Point2D | null = existingOpp;

  if (draggedLen > 0.01) {
    if (anchor.mode === 'symmetric') {
      oppHandle = [
        Math.max(0, Math.min(100, anchor.pos[0] - dx)),
        Math.max(0, Math.min(100, anchor.pos[1] - dy)),
      ];
    } else if (anchor.mode === 'smooth') {
      const oppLen = existingOpp ? distance(anchor.pos, existingOpp) : draggedLen;
      const ux = -dx / draggedLen;
      const uy = -dy / draggedLen;
      oppHandle = [
        Math.max(0, Math.min(100, anchor.pos[0] + ux * oppLen)),
        Math.max(0, Math.min(100, anchor.pos[1] + uy * oppLen)),
      ];
    }
  }

  return {
    ...anchor,
    handleIn: which === 'in' ? clamped : oppHandle,
    handleOut: which === 'out' ? clamped : oppHandle,
  };
}

/**
 * Changes an anchor's mode and aligns or creates tangent handles when switching to smooth/symmetric
 */
export function setAnchorMode(
  anchors: BezierAnchor[],
  index: number,
  mode: BezierNodeMode,
  isClosed: boolean
): BezierAnchor[] {
  const n = anchors.length;
  if (index < 0 || index >= n) return anchors;

  return anchors.map((anc, idx) => {
    if (idx !== index) return anc;

    if (mode === 'corner') {
      return { ...anc, mode: 'corner' };
    }

    // Determine tangent direction
    let ux = 1;
    let uy = 0;

    if (anc.handleOut && distance(anc.pos, anc.handleOut) > 0.2) {
      const len = distance(anc.pos, anc.handleOut);
      ux = (anc.handleOut[0] - anc.pos[0]) / len;
      uy = (anc.handleOut[1] - anc.pos[1]) / len;
    } else if (anc.handleIn && distance(anc.pos, anc.handleIn) > 0.2) {
      const len = distance(anc.pos, anc.handleIn);
      ux = (anc.pos[0] - anc.handleIn[0]) / len;
      uy = (anc.pos[1] - anc.handleIn[1]) / len;
    } else {
      const prev = isClosed ? anchors[(idx - 1 + n) % n]?.pos : idx > 0 ? anchors[idx - 1]?.pos : null;
      const next = isClosed ? anchors[(idx + 1) % n]?.pos : idx < n - 1 ? anchors[idx + 1]?.pos : null;
      if (prev && next) {
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        const tLen = Math.hypot(tx, ty) || 1;
        ux = tx / tLen;
        uy = ty / tLen;
      } else if (next) {
        const tx = next[0] - anc.pos[0];
        const ty = next[1] - anc.pos[1];
        const tLen = Math.hypot(tx, ty) || 1;
        ux = tx / tLen;
        uy = ty / tLen;
      } else if (prev) {
        const tx = anc.pos[0] - prev[0];
        const ty = anc.pos[1] - prev[1];
        const tLen = Math.hypot(tx, ty) || 1;
        ux = tx / tLen;
        uy = ty / tLen;
      }
    }

    const lenIn = anc.handleIn ? Math.max(2, distance(anc.pos, anc.handleIn)) : 6;
    const lenOut = anc.handleOut ? Math.max(2, distance(anc.pos, anc.handleOut)) : 6;
    const symLen = (lenIn + lenOut) / 2;

    const finalInLen = mode === 'symmetric' ? symLen : lenIn;
    const finalOutLen = mode === 'symmetric' ? symLen : lenOut;

    return {
      ...anc,
      mode,
      handleIn: [
        Math.max(0, Math.min(100, anc.pos[0] - ux * finalInLen)),
        Math.max(0, Math.min(100, anc.pos[1] - uy * finalInLen)),
      ],
      handleOut: [
        Math.max(0, Math.min(100, anc.pos[0] + ux * finalOutLen)),
        Math.max(0, Math.min(100, anc.pos[1] + uy * finalOutLen)),
      ],
    };
  });
}

/**
 * Inserts a new Bézier anchor along the closest curve segment using De Casteljau subdivision
 * so the curve geometry stays virtually identical!
 */
export function insertBezierAnchorOnSegment(
  anchors: BezierAnchor[],
  isClosed: boolean,
  clickPt: Point2D
): { anchors: BezierAnchor[]; index: number } | null {
  if (anchors.length < 2) return null;

  const segCount = isClosed ? anchors.length : anchors.length - 1;
  let bestSeg = -1;
  let bestT = 0.5;
  let minDist = Infinity;

  for (let i = 0; i < segCount; i++) {
    const a0 = anchors[i];
    const a1 = anchors[(i + 1) % anchors.length];
    const p0 = a0.pos;
    const cp1 = a0.handleOut || p0;
    const cp2 = a1.handleIn || a1.pos;
    const p3 = a1.pos;

    for (let step = 1; step < 24; step++) {
      const t = step / 24;
      const sample = evaluateCubicBezier(p0, cp1, cp2, p3, t);
      const d = distance(clickPt, sample);
      if (d < minDist) {
        minDist = d;
        bestSeg = i;
        bestT = t;
      }
    }
  }

  if (minDist > 4.5 || bestSeg === -1) return null;

  const nextIdx = (bestSeg + 1) % anchors.length;
  const a0 = anchors[bestSeg];
  const a1 = anchors[nextIdx];
  const p0 = a0.pos;
  const p1 = a0.handleOut || a0.pos;
  const p2 = a1.handleIn || a1.pos;
  const p3 = a1.pos;

  // De Casteljau split at bestT
  const lerp = (u: Point2D, v: Point2D, t: number): Point2D => [
    u[0] + (v[0] - u[0]) * t,
    u[1] + (v[1] - u[1]) * t,
  ];

  const q0 = lerp(p0, p1, bestT);
  const q1 = lerp(p1, p2, bestT);
  const q2 = lerp(p2, p3, bestT);
  const r0 = lerp(q0, q1, bestT);
  const r1 = lerp(q1, q2, bestT);
  const s = lerp(r0, r1, bestT);

  const isStraight = !a0.handleOut && !a1.handleIn;
  const newAnchor: BezierAnchor = {
    pos: s,
    handleIn: isStraight ? null : r0,
    handleOut: isStraight ? null : r1,
    mode: isStraight ? 'corner' : 'smooth',
  };

  const updated = anchors.map((a, idx) => {
    if (idx === bestSeg && !isStraight) {
      return { ...a, handleOut: q0 };
    }
    if (idx === nextIdx && !isStraight) {
      return { ...a, handleIn: q2 };
    }
    return a;
  });

  updated.splice(bestSeg + 1, 0, newAnchor);
  return { anchors: updated, index: bestSeg + 1 };
}

/**
 * Translates an anchor along with its handles
 */
export function moveBezierAnchor(
  anchor: BezierAnchor,
  newPos: Point2D
): BezierAnchor {
  const clamped: Point2D = [
    Math.max(0, Math.min(100, newPos[0])),
    Math.max(0, Math.min(100, newPos[1])),
  ];
  const dx = clamped[0] - anchor.pos[0];
  const dy = clamped[1] - anchor.pos[1];

  return {
    ...anchor,
    pos: clamped,
    handleIn: anchor.handleIn
      ? [
          Math.max(0, Math.min(100, anchor.handleIn[0] + dx)),
          Math.max(0, Math.min(100, anchor.handleIn[1] + dy)),
        ]
      : null,
    handleOut: anchor.handleOut
      ? [
          Math.max(0, Math.min(100, anchor.handleOut[0] + dx)),
          Math.max(0, Math.min(100, anchor.handleOut[1] + dy)),
        ]
      : null,
  };
}

/**
 * Applies an arbitrary point transformation to every anchor and handle
 */
export function transformBezierAnchors(
  anchors: BezierAnchor[],
  fn: (pt: Point2D) => Point2D
): BezierAnchor[] {
  return anchors.map((a) => ({
    ...a,
    pos: fn(a.pos),
    handleIn: a.handleIn ? fn(a.handleIn) : null,
    handleOut: a.handleOut ? fn(a.handleOut) : null,
  }));
}

/**
 * Calculates bounding box of a point set
 */
export function getPathBounds(points: Point2D[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }
  let minX = points[0][0];
  let maxX = points[0][0];
  let minY = points[0][1];
  let maxY = points[0][1];

  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Rotates a 2D point around an origin point by angle in radians
 */
export function rotatePoint(p: Point2D, center: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  return [
    center[0] + dx * cos - dy * sin,
    center[1] + dx * sin + dy * cos,
  ];
}

/**
 * Translates points by delta (dx, dy)
 */
export function translatePath(points: Point2D[], dx: number, dy: number): Point2D[] {
  return points.map(([x, y]) => [
    Math.max(0, Math.min(100, x + dx)),
    Math.max(0, Math.min(100, y + dy)),
  ]);
}

/**
 * Scales points relative to center
 */
export function scalePath(points: Point2D[], scaleX: number, scaleY: number, origin?: Point2D): Point2D[] {
  const center = origin || [
    points.reduce((acc, p) => acc + p[0], 0) / (points.length || 1),
    points.reduce((acc, p) => acc + p[1], 0) / (points.length || 1),
  ];

  return points.map(([x, y]) => [
    Math.max(0, Math.min(100, center[0] + (x - center[0]) * scaleX)),
    Math.max(0, Math.min(100, center[1] + (y - center[1]) * scaleY)),
  ]);
}

/**
 * Rotates points relative to center
 */
export function rotatePath(points: Point2D[], angleDeg: number, origin?: Point2D): Point2D[] {
  const angleRad = (angleDeg * Math.PI) / 180;
  const center = origin || [
    points.reduce((acc, p) => acc + p[0], 0) / (points.length || 1),
    points.reduce((acc, p) => acc + p[1], 0) / (points.length || 1),
  ];

  return points.map((p) => {
    const rotated = rotatePoint(p, center, angleRad);
    return [
      Math.max(0, Math.min(100, rotated[0])),
      Math.max(0, Math.min(100, rotated[1])),
    ];
  });
}

/**
 * Flips points horizontally or vertically around path center
 */
export function flipPath(points: Point2D[], flipH: boolean, flipV: boolean, boundsOverride?: BoundingBox): Point2D[] {
  const bounds = boundsOverride || getPathBounds(points);
  return points.map(([x, y]) => {
    const newX = flipH ? bounds.maxX - (x - bounds.minX) : x;
    const newY = flipV ? bounds.maxY - (y - bounds.minY) : y;
    return [newX, newY];
  });
}

/**
 * Centers a path inside the 100x100 canvas space
 */
export function centerPathInCanvas(points: Point2D[]): Point2D[] {
  const bounds = getPathBounds(points);
  const dx = 50 - bounds.centerX;
  const dy = 50 - bounds.centerY;
  return translatePath(points, dx, dy);
}

/**
 * Inserts a new node into the closest segment along the path
 */
export function insertNodeOnPath(points: Point2D[], clickPt: Point2D): { points: Point2D[]; index: number } | null {
  if (points.length < 2) return null;

  let bestSegmentIndex = -1;
  let minDistance = Infinity;
  let bestProjection: Point2D = [0, 0];

  const count = points.length;
  for (let i = 0; i < count; i++) {
    const nextIdx = (i + 1) % count;
    if (nextIdx === 0 && distance(points[0], points[count - 1]) > 0.1) {
      break;
    }

    const p1 = points[i];
    const p2 = points[nextIdx];

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) continue;

    const t = Math.max(0, Math.min(1, ((clickPt[0] - p1[0]) * dx + (clickPt[1] - p1[1]) * dy) / lenSq));
    const proj: Point2D = [p1[0] + t * dx, p1[1] + t * dy];
    const d = distance(clickPt, proj);

    if (d < minDistance) {
      minDistance = d;
      bestSegmentIndex = i;
      bestProjection = proj;
    }
  }

  if (minDistance <= 5 && bestSegmentIndex !== -1) {
    const updated = [...points];
    updated.splice(bestSegmentIndex + 1, 0, bestProjection);
    return { points: updated, index: bestSegmentIndex + 1 };
  }

  return null;
}

/**
 * Offset Path (Illustrator / Inkscape Outset & Inset)
 * Expands or shrinks closed contour by delta percentage
 */
export function offsetPathVector(points: Point2D[], delta: number): Point2D[] {
  const n = points.length;
  if (n < 3) return points;

  const normals: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy) || 1;
    normals.push([dy / len, -dx / len]);
  }

  const result: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prevNorm = normals[(i - 1 + n) % n];
    const currNorm = normals[i];

    let nx = prevNorm[0] + currNorm[0];
    let ny = prevNorm[1] + currNorm[1];
    const nLen = Math.hypot(nx, ny) || 1;
    nx /= nLen;
    ny /= nLen;

    const dot = currNorm[0] * nx + currNorm[1] * ny;
    const miter = Math.min(2.5, Math.max(0.5, 1 / (dot || 1)));

    result.push([
      Math.max(1, Math.min(99, points[i][0] + nx * delta * miter)),
      Math.max(1, Math.min(99, points[i][1] + ny * delta * miter)),
    ]);
  }

  return result;
}

/**
 * Export paths as clean SVG vector file (Illustrator / Inkscape compatible)
 * Uses real cubic Bézier `C` commands when bezierAnchors are present!
 */
export function exportPathsToSVG(
  paths: { points: Point2D[]; isClosed: boolean; isOuter: boolean; bezierAnchors?: BezierAnchor[] }[],
  name: string = 'cookie_cutter_vector'
): string {
  const pathElements = paths.map((p, idx) => {
    let d = '';

    if (p.bezierAnchors && p.bezierAnchors.length >= 2) {
      const anchors = p.bezierAnchors;
      d = `M ${anchors[0].pos[0].toFixed(2)} ${anchors[0].pos[1].toFixed(2)}`;
      const segCount = p.isClosed ? anchors.length : anchors.length - 1;
      for (let i = 0; i < segCount; i++) {
        const a0 = anchors[i];
        const a1 = anchors[(i + 1) % anchors.length];
        if (a0.handleOut || a1.handleIn) {
          const cp1 = a0.handleOut || a0.pos;
          const cp2 = a1.handleIn || a1.pos;
          d += ` C ${cp1[0].toFixed(2)} ${cp1[1].toFixed(2)}, ${cp2[0].toFixed(2)} ${cp2[1].toFixed(2)}, ${a1.pos[0].toFixed(2)} ${a1.pos[1].toFixed(2)}`;
        } else {
          d += ` L ${a1.pos[0].toFixed(2)} ${a1.pos[1].toFixed(2)}`;
        }
      }
    } else {
      if (p.points.length === 0) return '';
      d = p.points.reduce((acc, pt, i) => {
        const command = i === 0 ? 'M' : 'L';
        return `${acc} ${command} ${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`.trim();
      }, '');
    }

    const closedSuffix = p.isClosed ? ' Z' : '';
    const strokeColor = p.isOuter ? '#f59e0b' : '#38bdf8';
    const strokeWidth = p.isOuter ? '1.5' : '1.0';
    const roleClass = p.isOuter ? 'cutter-blade' : 'stamp-emboss';

    return `  <path id="path_${idx}_${roleClass}" class="${roleClass}" d="${d}${closedSuffix}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100mm" height="100mm">
  <!-- Generated by Cookie3D Studio Vector Engine (Illustrator & Inkscape Compatible) -->
  <title>${name}</title>
  <defs>
    <style>
      .cutter-blade { stroke: #f59e0b; stroke-width: 1.5; }
      .stamp-emboss { stroke: #38bdf8; stroke-width: 1.0; }
    </style>
  </defs>
  <rect width="100" height="100" fill="#0f172a" opacity="0.05" />
${pathElements.join('\n')}
</svg>`;
}

/**
 * Downloads string content as a file
 */
export function downloadSVGFile(svgContent: string, filename: string = 'desenho_vetorial.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Quick SVG path string parser into Point2D array
 * Evaluates SVG commands (M, L, H, V, C, S, Q, Z) including smooth Bézier curve sampling
 */
export function parseSvgStringToPaths(svgText: string): Point2D[][] {
  const paths: Point2D[][] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  const svgElem = doc.querySelector('svg');
  let vbX = 0, vbY = 0, vbW = 100, vbH = 100;
  if (svgElem) {
    const vb = svgElem.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        [vbX, vbY, vbW, vbH] = parts;
      }
    } else {
      const w = parseFloat(svgElem.getAttribute('width') || '100');
      const h = parseFloat(svgElem.getAttribute('height') || '100');
      if (w > 0) vbW = w;
      if (h > 0) vbH = h;
    }
  }

  const normalize = (x: number, y: number): Point2D => {
    const pctX = ((x - vbX) / vbW) * 100;
    const pctY = ((y - vbY) / vbH) * 100;
    return [Math.max(0, Math.min(100, pctX)), Math.max(0, Math.min(100, pctY))];
  };

  const parsePathD = (d: string): Point2D[] => {
    const points: Point2D[] = [];
    const commands = d.match(/([a-df-zA-DF-Z])([^a-df-zA-DF-Z]*)/g);
    if (!commands) return [];

    let currX = 0;
    let currY = 0;
    let lastCtrlX = 0;
    let lastCtrlY = 0;

    for (const cmdChunk of commands) {
      const cmd = cmdChunk[0];
      const numbers = cmdChunk.slice(1).trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));

      switch (cmd) {
        case 'M':
          if (numbers.length >= 2) {
            currX = numbers[0];
            currY = numbers[1];
            points.push(normalize(currX, currY));
          }
          break;
        case 'm':
          if (numbers.length >= 2) {
            currX += numbers[0];
            currY += numbers[1];
            points.push(normalize(currX, currY));
          }
          break;
        case 'L':
          for (let i = 0; i < numbers.length; i += 2) {
            currX = numbers[i];
            currY = numbers[i + 1];
            points.push(normalize(currX, currY));
          }
          break;
        case 'l':
          for (let i = 0; i < numbers.length; i += 2) {
            currX += numbers[i];
            currY += numbers[i + 1];
            points.push(normalize(currX, currY));
          }
          break;
        case 'H':
          if (numbers.length >= 1) {
            currX = numbers[0];
            points.push(normalize(currX, currY));
          }
          break;
        case 'h':
          if (numbers.length >= 1) {
            currX += numbers[0];
            points.push(normalize(currX, currY));
          }
          break;
        case 'V':
          if (numbers.length >= 1) {
            currY = numbers[0];
            points.push(normalize(currX, currY));
          }
          break;
        case 'v':
          if (numbers.length >= 1) {
            currY += numbers[0];
            points.push(normalize(currX, currY));
          }
          break;
        case 'C':
        case 'c': {
          const isRel = cmd === 'c';
          for (let i = 0; i + 5 < numbers.length; i += 6) {
            const x1 = isRel ? currX + numbers[i] : numbers[i];
            const y1 = isRel ? currY + numbers[i + 1] : numbers[i + 1];
            const x2 = isRel ? currX + numbers[i + 2] : numbers[i + 2];
            const y2 = isRel ? currY + numbers[i + 3] : numbers[i + 3];
            const x3 = isRel ? currX + numbers[i + 4] : numbers[i + 4];
            const y3 = isRel ? currY + numbers[i + 5] : numbers[i + 5];

            const p0 = normalize(currX, currY);
            const c1 = normalize(x1, y1);
            const c2 = normalize(x2, y2);
            const p3 = normalize(x3, y3);

            for (let s = 1; s <= 12; s++) {
              points.push(evaluateCubicBezier(p0, c1, c2, p3, s / 12));
            }
            lastCtrlX = x2;
            lastCtrlY = y2;
            currX = x3;
            currY = y3;
          }
          break;
        }
        case 'S':
        case 's': {
          const isRel = cmd === 's';
          for (let i = 0; i + 3 < numbers.length; i += 4) {
            const x1 = 2 * currX - lastCtrlX;
            const y1 = 2 * currY - lastCtrlY;
            const x2 = isRel ? currX + numbers[i] : numbers[i];
            const y2 = isRel ? currY + numbers[i + 1] : numbers[i + 1];
            const x3 = isRel ? currX + numbers[i + 2] : numbers[i + 2];
            const y3 = isRel ? currY + numbers[i + 3] : numbers[i + 3];

            const p0 = normalize(currX, currY);
            const c1 = normalize(x1, y1);
            const c2 = normalize(x2, y2);
            const p3 = normalize(x3, y3);

            for (let s = 1; s <= 12; s++) {
              points.push(evaluateCubicBezier(p0, c1, c2, p3, s / 12));
            }
            lastCtrlX = x2;
            lastCtrlY = y2;
            currX = x3;
            currY = y3;
          }
          break;
        }
        case 'Q':
        case 'q': {
          const isRel = cmd === 'q';
          for (let i = 0; i + 3 < numbers.length; i += 4) {
            const qx = isRel ? currX + numbers[i] : numbers[i];
            const qy = isRel ? currY + numbers[i + 1] : numbers[i + 1];
            const x = isRel ? currX + numbers[i + 2] : numbers[i + 2];
            const y = isRel ? currY + numbers[i + 3] : numbers[i + 3];

            const p0 = normalize(currX, currY);
            const q = normalize(qx, qy);
            const p2 = normalize(x, y);

            for (let s = 1; s <= 10; s++) {
              const t = s / 10;
              const mt = 1 - t;
              points.push([
                mt * mt * p0[0] + 2 * mt * t * q[0] + t * t * p2[0],
                mt * mt * p0[1] + 2 * mt * t * q[1] + t * t * p2[1],
              ]);
            }
            lastCtrlX = qx;
            lastCtrlY = qy;
            currX = x;
            currY = y;
          }
          break;
        }
        case 'Z':
        case 'z':
          if (points.length > 0) {
            points.push([points[0][0], points[0][1]]);
          }
          break;
      }
    }
    return points;
  };

  const pathTags = doc.querySelectorAll('path');
  pathTags.forEach((p) => {
    const d = p.getAttribute('d');
    if (d) {
      const pts = parsePathD(d);
      if (pts.length >= 2) paths.push(pts);
    }
  });

  const polyTags = doc.querySelectorAll('polygon, polyline');
  polyTags.forEach((p) => {
    const ptsAttr = p.getAttribute('points');
    if (ptsAttr) {
      const nums = ptsAttr.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      const pts: Point2D[] = [];
      for (let i = 0; i < nums.length; i += 2) {
        pts.push(normalize(nums[i], nums[i + 1]));
      }
      if (p.tagName.toLowerCase() === 'polygon' && pts.length >= 2) {
        pts.push([pts[0][0], pts[0][1]]);
      }
      if (pts.length >= 2) paths.push(pts);
    }
  });

  const circleTags = doc.querySelectorAll('circle');
  circleTags.forEach((c) => {
    const cx = parseFloat(c.getAttribute('cx') || '0');
    const cy = parseFloat(c.getAttribute('cy') || '0');
    const r = parseFloat(c.getAttribute('r') || '0');
    if (r > 0) {
      const pts: Point2D[] = [];
      for (let i = 0; i <= 32; i++) {
        const ang = (i * 2 * Math.PI) / 32;
        pts.push(normalize(cx + r * Math.cos(ang), cy + r * Math.sin(ang)));
      }
      paths.push(pts);
    }
  });

  const rectTags = doc.querySelectorAll('rect');
  rectTags.forEach((r) => {
    const rx = parseFloat(r.getAttribute('x') || '0');
    const ry = parseFloat(r.getAttribute('y') || '0');
    const rw = parseFloat(r.getAttribute('width') || '0');
    const rh = parseFloat(r.getAttribute('height') || '0');
    if (rw > 0 && rh > 0) {
      paths.push([
        normalize(rx, ry),
        normalize(rx + rw, ry),
        normalize(rx + rw, ry + rh),
        normalize(rx, ry + rh),
        normalize(rx, ry),
      ]);
    }
  });

  return paths;
}
