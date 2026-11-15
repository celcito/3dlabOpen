import { Point2D, Path2D } from '../types';

/**
 * Computes bounding box for a path [minX, minY, maxX, maxY]
 */
export function getBounds(points: Point2D[]): [number, number, number, number] {
  if (points.length === 0) return [0, 0, 0, 0];
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
  return [minX, minY, maxX, maxY];
}

/**
 * Calculates polygon orientation area (positive = counter-clockwise)
 */
export function polygonArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return area / 2;
}

/**
 * Ensures a closed loop path is counter-clockwise
 */
export function ensureCCW(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  if (polygonArea(points) < 0) {
    return [...points].reverse();
  }
  return points;
}

/**
 * Smooths a polygon or polyline using Chaikin's corner cutting
 */
export function smoothPath(points: Point2D[], iterations: number = 2, closed: boolean = true): Point2D[] {
  if (points.length < 3) return points;
  let current = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const next: Point2D[] = [];
    const n = current.length;
    const limit = closed ? n : n - 1;

    for (let i = 0; i < limit; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % n];

      // Q = 0.75 P0 + 0.25 P1
      // R = 0.25 P0 + 0.75 P1
      const q: Point2D = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
      const r: Point2D = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];

      if (!closed && i === 0) {
        next.push(p0);
      }
      next.push(q);
      next.push(r);
      if (!closed && i === limit - 1) {
        next.push(p1);
      }
    }
    current = next;
  }
  return current;
}

/**
 * Rescales and centers a path to fit exactly inside targetWidth x targetHeight (in mm)
 */
export function scaleAndCenterPath(
  path: Path2D,
  targetWidth: number,
  targetHeight: number,
  sourceBounds?: [number, number, number, number]
): Path2D {
  if (path.length === 0) return [];
  const [minX, minY, maxX, maxY] = sourceBounds || getBounds(path);
  const srcW = Math.max(0.001, maxX - minX);
  const srcH = Math.max(0.001, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const scaleX = targetWidth / srcW;
  const scaleY = targetHeight / srcH;

  return path.map(([x, y]) => [
    (x - centerX) * scaleX,
    (centerY - y) * scaleY, // Invert Y so positive Y is up in 3D
  ]);
}

/**
 * Computes parallel offset polygon for a closed loop (outward if offset > 0, inward if offset < 0)
 */
export function offsetClosedPolygon(points: Point2D[], offset: number): Point2D[] {
  const n = points.length;
  if (n < 3) return points;

  // Ensure points are CCW so outward offset is always to the right of travel
  const ccw = ensureCCW(points);
  const normals: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const p1 = ccw[i];
    const p2 = ccw[(i + 1) % n];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular vector pointing outward for CCW
    normals.push([dy / len, -dx / len]);
  }

  const offsetPoints: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prevNorm = normals[(i - 1 + n) % n];
    const currNorm = normals[i];

    // Average normal at vertex
    let nx = prevNorm[0] + currNorm[0];
    let ny = prevNorm[1] + currNorm[1];
    const nLen = Math.hypot(nx, ny);

    if (nLen > 0.001) {
      nx /= nLen;
      ny /= nLen;
    } else {
      nx = currNorm[0];
      ny = currNorm[1];
    }

    // Miter limit to avoid runaway spikes
    const dot = currNorm[0] * nx + currNorm[1] * ny;
    const miter = Math.min(2.5, Math.max(0.5, 1 / (dot || 1)));

    offsetPoints.push([
      ccw[i][0] + nx * offset * miter,
      ccw[i][1] + ny * offset * miter,
    ]);
  }

  return offsetPoints;
}

/**
 * Expands an open or closed polyline into a solid ribbon polygon with thickness
 */
export function expandLineToRibbon(points: Point2D[], thickness: number, closed: boolean = false): Point2D[] {
  const n = points.length;
  if (n < 2) return [];

  const half = thickness / 2;
  const leftSide: Point2D[] = [];
  const rightSide: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    let dx = 0;
    let dy = 0;

    if (i === 0) {
      if (closed) {
        dx = points[1][0] - points[n - 1][0];
        dy = points[1][1] - points[n - 1][1];
      } else {
        dx = points[1][0] - points[0][0];
        dy = points[1][1] - points[0][1];
      }
    } else if (i === n - 1) {
      if (closed) {
        dx = points[0][0] - points[n - 2][0];
        dy = points[0][1] - points[n - 2][1];
      } else {
        dx = points[n - 1][0] - points[n - 2][0];
        dy = points[n - 1][1] - points[n - 2][1];
      }
    } else {
      dx = points[i + 1][0] - points[i - 1][0];
      dy = points[i + 1][1] - points[i - 1][1];
    }

    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    leftSide.push([points[i][0] + nx * half, points[i][1] + ny * half]);
    rightSide.push([points[i][0] - nx * half, points[i][1] - ny * half]);
  }

  if (closed) {
    return [...leftSide, ...rightSide];
  } else {
    // Round endcaps on open lines
    return [...leftSide, ...rightSide.reverse()];
  }
}

/**
 * Checks if a 2D point is inside a closed polygon (Ray-casting)
 */
export function isPointInPolygon(point: Point2D, vs: Point2D[]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
