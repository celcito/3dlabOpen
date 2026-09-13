import * as THREE from 'three';

export function extractContoursFromImageData(
  imgData: ImageData,
  mmPerPixel: number,
  centerXPx: number,
  centerYPx: number,
  simplifyTolerance: number
): { outer: THREE.Shape[]; holes: THREE.Path[] } {
  const { data, width, height } = imgData;
  const visited = new Uint8Array(width * height);

  function isBlack(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    return data[idx] < 128;
  }

  function traceContour(startX: number, startY: number): { x: number; y: number }[] {
    const contour: { x: number; y: number }[] = [];
    let x = startX;
    let y = startY;
    let dir = 0;

    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];

    do {
      contour.push({ x, y });
      visited[y * width + x] = 1;

      let found = false;
      for (let i = 0; i < 8; i++) {
        const nextDir = (dir + 6 + i) % 8;
        const nx = x + directions[nextDir][0];
        const ny = y + directions[nextDir][1];
        if (isBlack(nx, ny)) {
          x = nx;
          y = ny;
          dir = nextDir;
          found = true;
          break;
        }
      }
      if (!found) break;
    } while (x !== startX || y !== startY);

    return contour;
  }

  const contours: { x: number; y: number }[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBlack(x, y) && !visited[y * width + x]) {
        contours.push(traceContour(x, y));
      }
    }
  }

  const outer: THREE.Shape[] = [];
  const holes: THREE.Path[] = [];

  for (const contour of contours) {
    if (contour.length < 10) continue;

    const shape = new THREE.Shape();
    const mmContour = contour.map(p => ({
      x: (p.x - centerXPx) * mmPerPixel,
      y: -(p.y - centerYPx) * mmPerPixel,
    }));

    shape.moveTo(mmContour[0].x, mmContour[0].y);
    for (let i = 1; i < mmContour.length; i++) {
      shape.lineTo(mmContour[i].x, mmContour[i].y);
    }
    shape.closePath();

    const area = Math.abs(polygonArea(mmContour));
    if (area > 20) {
      outer.push(shape);
    } else {
      const path = new THREE.Path();
      path.moveTo(mmContour[0].x, mmContour[0].y);
      for (let i = 1; i < mmContour.length; i++) {
        path.lineTo(mmContour[i].x, mmContour[i].y);
      }
      path.closePath();
      holes.push(path);
    }
  }

  return { outer, holes };
}

function polygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j].x * points[i].y - points[i].x * points[j].y;
  }
  return area / 2;
}

export function buildThreeShapes(outer: THREE.Shape[], holes: THREE.Path[]): THREE.Shape[] {
  return outer.map(shape => {
    for (const hole of holes) {
      shape.holes.push(hole);
    }
    return shape;
  });
}