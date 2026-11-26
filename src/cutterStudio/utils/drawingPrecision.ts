import { Point2D } from '../types';

/**
 * Calculates Euclidean distance between two 2D points
 */
export function distance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

/**
 * Snaps a point [x, y] (in 0..100 coordinate space) to a grid spacing
 */
export function snapToGrid(point: Point2D, gridSize: number = 5): Point2D {
  if (gridSize <= 0) return point;
  const snappedX = Math.round(point[0] / gridSize) * gridSize;
  const snappedY = Math.round(point[1] / gridSize) * gridSize;
  return [
    Math.max(0, Math.min(100, snappedX)),
    Math.max(0, Math.min(100, snappedY)),
  ];
}

/**
 * Checks if a polyline forms a closed loop (start and end within threshold distance)
 */
export function isLoopClosed(points: Point2D[], thresholdPercent: number = 6): boolean {
  if (points.length < 3) return false;
  const start = points[0];
  const end = points[points.length - 1];
  return distance(start, end) <= thresholdPercent;
}

/**
 * Closes a loop by connecting end back to start if within threshold, or snapping end to start
 */
export function closeLoop(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  const result = [...points];
  const start = result[0];
  const end = result[result.length - 1];
  if (distance(start, end) > 0.001) {
    result.push([start[0], start[1]]);
  }
  return result;
}

/**
 * Ramer-Douglas-Peucker algorithm to simplify polyline and remove jitter
 */
export function simplifyPointsRDP(points: Point2D[], epsilon: number = 0.8): Point2D[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from line between first and last
  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  const lineLenSq = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    let d: number;
    if (lineLenSq === 0) {
      d = distance(p, start);
    } else {
      // Perpendicular distance to line
      const t = Math.max(0, Math.min(1, ((p[0] - start[0]) * (end[0] - start[0]) + (p[1] - start[1]) * (end[1] - start[1])) / lineLenSq));
      const projX = start[0] + t * (end[0] - start[0]);
      const projY = start[1] + t * (end[1] - start[1]);
      d = distance(p, [projX, projY]);
    }

    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPointsRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyPointsRDP(points.slice(index), epsilon);
    return [...left.slice(0, left.length - 1), ...right];
  } else {
    return [start, end];
  }
}

/**
 * Chaikin smoothing algorithm with customizable corner-cutting
 */
export function chaikinSmooth(points: Point2D[], iterations: number = 2, closed: boolean = false): Point2D[] {
  if (points.length < 3) return points;
  let current = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const next: Point2D[] = [];
    const n = current.length;
    const limit = closed ? n : n - 1;

    if (!closed) {
      next.push(current[0]);
    }

    for (let i = 0; i < limit; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % n];

      const q: Point2D = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
      const r: Point2D = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];

      next.push(q);
      next.push(r);
    }

    if (!closed) {
      next.push(current[n - 1]);
    }

    current = next;
  }

  return current;
}

/**
 * Catmull-Rom spline interpolation for silky smooth organic curves
 */
export function catmullRomSpline(points: Point2D[], numSegmentsPerSpan: number = 4, closed: boolean = false): Point2D[] {
  if (points.length < 3) return points;
  const pts = [...points];
  if (closed) {
    pts.unshift(points[points.length - 1]);
    pts.push(points[0]);
    pts.push(points[1]);
  } else {
    pts.unshift(points[0]);
    pts.push(points[points.length - 1]);
  }

  const result: Point2D[] = [];
  const limit = closed ? points.length : points.length - 1;

  for (let i = 1; i <= limit; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];

    for (let s = 0; s < numSegmentsPerSpan; s++) {
      const t = s / numSegmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );

      const y = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );

      result.push([x, y]);
    }
  }

  if (!closed && points.length > 0) {
    result.push(points[points.length - 1]);
  }

  return result;
}

/**
 * Stabilizer / Exponential moving average filter for interactive drawing
 */
export class StrokeStabilizer {
  private lastX: number = 0;
  private lastY: number = 0;
  private weight: number; // 0 = no smoothing, 0.8 = heavy stabilizer

  constructor(weight: number = 0.4) {
    this.weight = Math.max(0, Math.min(0.9, weight));
  }

  public setWeight(weight: number) {
    this.weight = Math.max(0, Math.min(0.9, weight));
  }

  public reset(startX: number, startY: number) {
    this.lastX = startX;
    this.lastY = startY;
  }

  public filter(rawX: number, rawY: number): Point2D {
    if (this.weight === 0) {
      this.lastX = rawX;
      this.lastY = rawY;
      return [rawX, rawY];
    }
    this.lastX = this.lastX * this.weight + rawX * (1 - this.weight);
    this.lastY = this.lastY * this.weight + rawY * (1 - this.weight);
    return [this.lastX, this.lastY];
  }
}

/**
 * Generates regular polygon vertices (triangle, pentagon, hexagon, octagon, star)
 */
export function generateRegularPolygon(center: Point2D, radius: number, sides: number, rotationDeg: number = 0): Point2D[] {
  const points: Point2D[] = [];
  const rotRad = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const angle = rotRad + (i * 2 * Math.PI) / sides - Math.PI / 2;
    points.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ]);
  }
  // Close loop
  points.push([points[0][0], points[0][1]]);
  return points;
}

/**
 * Generates an ellipse / circle
 */
export function generateEllipse(center: Point2D, rx: number, ry: number, segments: number = 40): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    points.push([
      center[0] + rx * Math.cos(angle),
      center[1] + ry * Math.sin(angle),
    ]);
  }
  points.push([points[0][0], points[0][1]]);
  return points;
}

/**
 * Generates a rectangle with optional rounded corners
 */
export function generateRectangle(p1: Point2D, p2: Point2D, cornerRadius: number = 0): Point2D[] {
  const minX = Math.min(p1[0], p2[0]);
  const maxX = Math.max(p1[0], p2[0]);
  const minY = Math.min(p1[1], p2[1]);
  const maxY = Math.max(p1[1], p2[1]);

  if (cornerRadius <= 0) {
    return [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ];
  }

  const r = Math.min(cornerRadius, (maxX - minX) / 2, (maxY - minY) / 2);
  const points: Point2D[] = [];
  const corners = [
    { cx: maxX - r, cy: minY + r, start: -Math.PI / 2, end: 0 },
    { cx: maxX - r, cy: maxY - r, start: 0, end: Math.PI / 2 },
    { cx: minX + r, cy: maxY - r, start: Math.PI / 2, end: Math.PI },
    { cx: minX + r, cy: minY + r, start: Math.PI, end: (3 * Math.PI) / 2 },
  ];

  for (const c of corners) {
    for (let step = 0; step <= 4; step++) {
      const angle = c.start + (step / 4) * (c.end - c.start);
      points.push([c.cx + r * Math.cos(angle), c.cy + r * Math.sin(angle)]);
    }
  }
  points.push([points[0][0], points[0][1]]);
  return points;
}

/**
 * Calculates area of polygon to determine which path is the largest outer perimeter
 */
export function calculatePolygonArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return Math.abs(area) / 2;
}
