import * as THREE from 'three';

export interface Point2D {
  x: number;
  y: number;
}

export interface PolygonContour {
  points: Point2D[];
  isHole: boolean;
}

export function simplifyPolygon(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolygon(points.slice(0, index + 1), tolerance);
    const right = simplifyPolygon(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

function perpendicularDistance(p: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

export function chaikinSmooth(points: Point2D[], iterations: number = 2): Point2D[] {
  if (points.length < 3) return points;
  
  let result = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Point2D[] = [];
    
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      
      smoothed.push({
        x: p0.x * 0.75 + p1.x * 0.25,
        y: p0.y * 0.75 + p1.y * 0.25,
      });
      smoothed.push({
        x: p0.x * 0.25 + p1.x * 0.75,
        y: p0.y * 0.25 + p1.y * 0.75,
      });
    }
    
    if (result.length > 0 && result[0].x === result[result.length - 1].x && result[0].y === result[result.length - 1].y) {
      const last = smoothed[smoothed.length - 1];
      smoothed.push({ x: last.x, y: last.y });
    }
    
    result = smoothed;
  }
  
  return result;
}

export function polygonArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

export function isPointInsidePolygon(point: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function extractContoursFromImageData(
  imageData: ImageData,
  mmPerPixel: number,
  offsetX: number,
  offsetY: number,
  simplifyToleranceMm: number = 0.35
): { outer: Point2D[][]; holes: Point2D[][] } {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);

  const isSolid = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4 + 3] > 120;
  };

  const rawContours: Point2D[][] = [];

  const dirs: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (!isSolid(x, y) || visited[idx] === 1) continue;

      let isBoundary = false;
      for (const [dx, dy] of dirs) {
        if (!isSolid(x + dx, y + dy)) {
          isBoundary = true;
          break;
        }
      }

      if (!isBoundary) continue;

      const contour: Point2D[] = [];
      let cx = x;
      let cy = y;
      let dirIndex = 0;
      const startX = cx;
      const startY = cy;
      let steps = 0;
      const maxSteps = width * height;

      do {
        contour.push({
          x: (cx - offsetX) * mmPerPixel,
          y: -(cy - offsetY) * mmPerPixel,
        });
        visited[cy * width + cx] = 1;

        let foundNext = false;
        const searchStart = (dirIndex + 5) % 8;
        for (let i = 0; i < 8; i++) {
          const checkDir = (searchStart + i) % 8;
          const nx = cx + dirs[checkDir][0];
          const ny = cy + dirs[checkDir][1];

          if (isSolid(nx, ny)) {
            cx = nx;
            cy = ny;
            dirIndex = checkDir;
            foundNext = true;
            break;
          }
        }

        if (!foundNext) break;
        steps++;
      } while ((cx !== startX || cy !== startY) && steps < maxSteps);

      if (contour.length >= 6) {
        contour.push({ ...contour[0] });
        const area = Math.abs(polygonArea(contour));
        const minArea = area < 1.0 ? 0.05 : 0.2;
        const simplified = simplifyPolygon(contour, simplifyToleranceMm * (area < 1.0 ? 0.5 : 1.0));
        if (simplified.length >= 4 && Math.abs(polygonArea(simplified)) > minArea) {
          rawContours.push(simplified);
        }
      }
    }
  }

  const outer: Point2D[][] = [];
  const holes: Point2D[][] = [];

  for (const poly of rawContours) {
    const testPoint = poly[0];
    let enclosureCount = 0;

    for (const other of rawContours) {
      if (other !== poly && isPointInsidePolygon(testPoint, other)) {
        enclosureCount++;
      }
    }

    if (enclosureCount % 2 === 1) {
      const holeArea = Math.abs(polygonArea(poly));
      holes.push(chaikinSmooth(poly, holeArea < 1.0 ? 1 : 2));
    } else {
      outer.push(chaikinSmooth(poly, 2));
    }
  }

  return { outer, holes };
}

export function buildThreeShapes(
  outerContours: Point2D[][],
  holesContours: Point2D[][]
): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];

  for (const outer of outerContours) {
    if (outer.length < 3) continue;

    const shape = new THREE.Shape();
    shape.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) {
      shape.lineTo(outer[i].x, outer[i].y);
    }
    shape.closePath();

    for (const hole of holesContours) {
      if (hole.length < 3) continue;
      if (isPointInsidePolygon(hole[0], outer)) {
        const holePath = new THREE.Path();
        holePath.moveTo(hole[0].x, hole[0].y);
        for (let j = 1; j < hole.length; j++) {
          holePath.lineTo(hole[j].x, hole[j].y);
        }
        holePath.closePath();
        shape.holes.push(holePath);
      }
    }

    shapes.push(shape);
  }

  return shapes;
}
