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

  const n = points.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: number[] = [0, n - 1];
  while (stack.length > 0) {
    const end = stack.pop()!;
    const start = stack.pop()!;
    if (end <= start + 1) continue;

    let maxDist = 0;
    let index = -1;
    const s = points[start];
    const e = points[end];
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], s, e);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push(start, index, index, end);
    }
  }

  const result: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

function perpendicularDistance(p: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

/**
 * Aresta máxima (mm) usada na densificação antes do Chaikin. O corte de canto do
 * Chaikin é proporcional ao comprimento da aresta (25% dela): sem densificar,
 * um lado longo de 40 mm virava canto cortado de 10 mm — hexágono/octógono/
 * escudo saíam deformados e tortos (até 4,3 mm de desvio, pior nos cantos).
 * Com arestas de no máximo 1 mm, o suavizado só mata o degrau do raster e o
 * formato se mantém (corte ≤ ~0,3 mm por iteração).
 */
const CHAIKIN_MAX_EDGE_MM = 1;
/** Re-simplificação pós-Chaikin para remover os pontos inseridos na densificação. */
const CHAIKIN_RESIMPLIFY_MM = 0.05;

function densifyClosed(points: Point2D[], maxEdge: number): Point2D[] {
  const n = points.length;
  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / maxEdge));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * Suavização Chaikin de um contorno FECHADO: normaliza o ponto final duplicado,
 * densifica as arestas, aplica o Chaikin como anel (i → i+1 % n) e re-simplifica
 * para ponto único nas retas. O laço em anel também elimina a assimetria da
 * versão anterior, que tratava o contorno como polilinha aberta e deixava um
 * buraco/chorda maior no ponto inicial do traçado.
 */
export function chaikinSmooth(
  points: Point2D[],
  iterations: number = 2,
  resimplifyMm: number = CHAIKIN_RESIMPLIFY_MM
): Point2D[] {
  if (points.length < 3) return points;

  let ring = points;
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) ring = ring.slice(0, -1);
  }
  if (ring.length < 3) return ring;

  let cur = densifyClosed(ring, CHAIKIN_MAX_EDGE_MM);
  for (let iter = 0; iter < iterations; iter++) {
    const n = cur.length;
    const next: Point2D[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const p = cur[i];
      const q = cur[(i + 1) % n];
      next[2 * i] = { x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 };
      next[2 * i + 1] = { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 };
    }
    cur = next;
  }
  const simplified = simplifyPolygon(cur, resimplifyMm);
  return simplified.length >= 3 ? simplified : cur;
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

export function computeEnclosedEmptyMask(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const count = width * height;
  const solid = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    solid[i] = data[i * 4 + 3] > 120 ? 1 : 0;
  }

  const outside = new Uint8Array(count);
  const stack = new Int32Array(count);
  let sp = 0;

  const seed = (i: number) => {
    if (!solid[i] && !outside[i]) {
      outside[i] = 1;
      stack[sp++] = i;
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (sp > 0) {
    const i = stack[--sp];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (y > 0) seed(i - width);
    if (y < height - 1) seed(i + width);
  }

  const mask = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (!solid[i] && !outside[i]) mask[i] = 1;
  }
  return mask;
}

export function punchMask(imageData: ImageData, mask: Uint8Array): void {
  const { data } = imageData;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    data[i * 4] = 0;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 0;
  }
}

export interface ContourExtractOptions {
  /** Aplica Chaikin nas bordas (arredonda cantos). Padrão: true. */
  chaikin?: boolean;
  /** Número mínimo de pontos brutos do contorno. Padrão: 6. */
  minContourLength?: number;
  /** Área mínima em mm² após simplificação. Padrão: dinâmico (0.05 / 0.2). */
  minAreaMm2?: number;
  /** Tolerância (mm) da re-simplificação pós-Chaikin. Menor = curvas mais fiéis e menos facetadas. Padrão: 0.05. */
  resimplifyMm?: number;
}

export function extractContoursFromImageData(
  imageData: ImageData,
  mmPerPixel: number,
  offsetX: number,
  offsetY: number,
  simplifyToleranceMm: number = 0.35,
  options: ContourExtractOptions = {}
): { outer: Point2D[][]; holes: Point2D[][] } {
  const chaikin = options.chaikin ?? true;
  const resimplifyMm = options.resimplifyMm;
  const minContourLength = options.minContourLength ?? 6;
  const fixedMinArea = options.minAreaMm2;
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const solid = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    solid[i] = data[i * 4 + 3] > 120 ? 1 : 0;
  }

  const isSolid = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && solid[y * width + x] === 1;

  const rawContours: Point2D[][] = [];

  const dirs: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (solid[idx] === 0 || visited[idx] === 1) continue;

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

      if (contour.length >= minContourLength) {
        contour.push({ ...contour[0] });
        if (fixedMinArea !== undefined) {
          const simplified = simplifyPolygon(contour, simplifyToleranceMm);
          if (simplified.length >= 4 && Math.abs(polygonArea(simplified)) > fixedMinArea) {
            rawContours.push(simplified);
          }
        } else {
          const area = Math.abs(polygonArea(contour));
          const minArea = area < 1.0 ? 0.05 : 0.2;
          const simplified = simplifyPolygon(contour, simplifyToleranceMm * (area < 1.0 ? 0.5 : 1.0));
          if (simplified.length >= 4 && Math.abs(polygonArea(simplified)) > minArea) {
            rawContours.push(simplified);
          }
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
      if (!chaikin) {
        holes.push(poly);
      } else {
        const holeArea = Math.abs(polygonArea(poly));
        holes.push(chaikinSmooth(poly, holeArea < 1.0 ? 1 : 2, resimplifyMm));
      }
    } else {
      if (!chaikin) {
        outer.push(poly);
      } else {
        outer.push(chaikinSmooth(poly, 2, resimplifyMm));
      }
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
