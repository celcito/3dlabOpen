import * as THREE from 'three';
import { ModelSettings, Point2D } from '../types';
import { polygonArea } from './vectorMath';

/**
 * Ramer-Douglas-Peucker polygon simplification
 */
function simplifyPolygon(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 4) return points;

  function getSqDist(p1: Point2D, p2: Point2D): number {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }

  function getSqSegDist(p: Point2D, p1: Point2D, p2: Point2D): number {
    let x = p1[0];
    let y = p1[1];
    let dx = p2[0] - x;
    let dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2[0];
        y = p2[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  }

  const sqTolerance = tolerance * tolerance;

  function simplifyDPStep(pts: Point2D[], first: number, last: number, simplified: Point2D[]) {
    let maxSqDist = sqTolerance;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (index !== -1) {
      if (index - first > 1) simplifyDPStep(pts, first, index, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, simplified);
    }
  }

  const result: Point2D[] = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, result);
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Tests if point p is inside polygon
 */
function isPointInPolygon(p: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const x = p[0];
  const y = p[1];
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Traces binary grid into closed loops using Marching Squares
 */
function traceGridMarchingSquares(grid: Uint8Array, width: number, height: number): Point2D[][] {
  // Edge key helper:
  // Horizontal edge between (x, y) and (x+1, y): key = `H_${x}_${y}`
  // Vertical edge between (x, y) and (x, y+1): key = `V_${x}_${y}`
  interface DirectedSegment {
    fromKey: string;
    toKey: string;
    fromPt: Point2D;
    toPt: Point2D;
  }

  const segments: DirectedSegment[] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = grid[y * width + x];
      const tr = grid[y * width + (x + 1)];
      const br = grid[(y + 1) * width + (x + 1)];
      const bl = grid[(y + 1) * width + x];

      const caseIndex = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (caseIndex === 0 || caseIndex === 15) continue;

      const topKey = `H_${x}_${y}`;
      const bottomKey = `H_${x}_${y + 1}`;
      const leftKey = `V_${x}_${y}`;
      const rightKey = `V_${x + 1}_${y}`;

      const topPt: Point2D = [x + 0.5, y];
      const bottomPt: Point2D = [x + 0.5, y + 1];
      const leftPt: Point2D = [x, y + 0.5];
      const rightPt: Point2D = [x + 1, y + 0.5];

      switch (caseIndex) {
        case 1: // BL
          segments.push({ fromKey: bottomKey, toKey: leftKey, fromPt: bottomPt, toPt: leftPt });
          break;
        case 2: // BR
          segments.push({ fromKey: rightKey, toKey: bottomKey, fromPt: rightPt, toPt: bottomPt });
          break;
        case 3: // BL + BR
          segments.push({ fromKey: rightKey, toKey: leftKey, fromPt: rightPt, toPt: leftPt });
          break;
        case 4: // TR
          segments.push({ fromKey: topKey, toKey: rightKey, fromPt: topPt, toPt: rightPt });
          break;
        case 5: // TR + BL (saddle)
          segments.push({ fromKey: topKey, toKey: rightKey, fromPt: topPt, toPt: rightPt });
          segments.push({ fromKey: bottomKey, toKey: leftKey, fromPt: bottomPt, toPt: leftPt });
          break;
        case 6: // TR + BR
          segments.push({ fromKey: topKey, toKey: bottomKey, fromPt: topPt, toPt: bottomPt });
          break;
        case 7: // TR + BR + BL
          segments.push({ fromKey: topKey, toKey: leftKey, fromPt: topPt, toPt: leftPt });
          break;
        case 8: // TL
          segments.push({ fromKey: leftKey, toKey: topKey, fromPt: leftPt, toPt: topPt });
          break;
        case 9: // TL + BL
          segments.push({ fromKey: bottomKey, toKey: topKey, fromPt: bottomPt, toPt: topPt });
          break;
        case 10: // TL + BR (saddle)
          segments.push({ fromKey: leftKey, toKey: topKey, fromPt: leftPt, toPt: topPt });
          segments.push({ fromKey: rightKey, toKey: bottomKey, fromPt: rightPt, toPt: bottomPt });
          break;
        case 11: // TL + BR + BL
          segments.push({ fromKey: rightKey, toKey: topKey, fromPt: rightPt, toPt: topPt });
          break;
        case 12: // TL + TR
          segments.push({ fromKey: leftKey, toKey: rightKey, fromPt: leftPt, toPt: rightPt });
          break;
        case 13: // TL + TR + BL
          segments.push({ fromKey: bottomKey, toKey: rightKey, fromPt: bottomPt, toPt: rightPt });
          break;
        case 14: // TL + TR + BR
          segments.push({ fromKey: leftKey, toKey: bottomKey, fromPt: leftPt, toPt: bottomPt });
          break;
      }
    }
  }

  // Connect segments into closed loops
  const adj = new Map<string, { toKey: string; pt: Point2D }>();
  for (const seg of segments) {
    adj.set(seg.fromKey, { toKey: seg.toKey, pt: seg.fromPt });
  }

  const loops: Point2D[][] = [];
  const visited = new Set<string>();

  for (const [startKey, entry] of adj) {
    if (visited.has(startKey)) continue;

    const loop: Point2D[] = [entry.pt];
    visited.add(startKey);
    let currKey = entry.toKey;
    let guard = 0;

    while (currKey && currKey !== startKey && guard++ < 15000) {
      visited.add(currKey);
      const nextEntry = adj.get(currKey);
      if (!nextEntry) break;
      loop.push(nextEntry.pt);
      currKey = nextEntry.toKey;
    }

    // Only keep valid loops with at least 4 vertices
    if (loop.length >= 4) {
      loops.push(loop);
    }
  }

  return loops;
}

/**
 * Generates watertight 3D Text Shapes from user input text and settings
 */
export function generate3DTextShapes(
  settings: ModelSettings,
  forceNoMirror: boolean = false
): THREE.Shape[] {
  const text = (settings.customText || '').trim();
  if (!text) return [];

  // Resolution of rendering canvas
  const canvasW = 500;
  const canvasH = 500;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Fill black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Set font
  let fontFamilyStr = 'sans-serif';
  if (settings.textFont === 'cursive') {
    fontFamilyStr = '"Brush Script MT", "Caveat", "Dancing Script", "Pacifico", "Segoe Script", cursive';
  } else if (settings.textFont === 'serif') {
    fontFamilyStr = '"Playfair Display", "Times New Roman", "Georgia", serif';
  } else if (settings.textFont === 'rounded') {
    fontFamilyStr = '"Comfortaa", "Quicksand", "Arial Rounded MT Bold", sans-serif';
  } else {
    fontFamilyStr = '"Arial Black", "Montserrat", "Outfit", "Impact", sans-serif';
  }

  // Base font size in px
  const basePx = Math.round(settings.textSize * 2.2);
  const lines = text.split('\n');
  const maxLineChars = Math.max(...lines.map((l) => l.length), 1);

  // Auto-scale to ensure text fits inside 78% of stamp area
  const maxAllowedWidth = canvasW * 0.78;
  const estimatedWidth = maxLineChars * (basePx * 0.62);
  const scaleDown = estimatedWidth > maxAllowedWidth ? maxAllowedWidth / estimatedWidth : 1;
  const finalPx = Math.max(20, Math.round(basePx * scaleDown));

  ctx.font = `bold ${finalPx}px ${fontFamilyStr}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  // Reinforce thin strokes so 3D print slices cleanly
  ctx.lineWidth = Math.max(1.8, Math.round(finalPx * 0.055));

  const lineHeight = finalPx * 1.25;
  const totalTextHeight = lines.length * lineHeight;
  // Center Y + user vertical offset (scaled to canvas coordinates)
  const centerY = canvasH / 2 - (settings.textOffsetY / (settings.targetHeight || 75)) * canvasH;
  const startY = centerY - totalTextHeight / 2 + lineHeight / 2;

  ctx.save();
  const shouldMirror = settings.mirrorText && !forceNoMirror;
  if (shouldMirror) {
    ctx.translate(canvasW, 0);
    ctx.scale(-1, 1);
  }

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    ctx.strokeText(line, canvasW / 2, y);
    ctx.fillText(line, canvasW / 2, y);
  });
  ctx.restore();

  // Extract pixel data
  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;

  // Build binary grid with 1px border padding
  const gridW = canvasW;
  const gridH = canvasH;
  const binaryGrid = new Uint8Array(gridW * gridH);

  for (let y = 1; y < gridH - 1; y++) {
    for (let x = 1; x < gridW - 1; x++) {
      const idx = (y * gridW + x) * 4;
      // High contrast threshold
      if (data[idx] > 110 || data[idx + 1] > 110 || data[idx + 2] > 110) {
        binaryGrid[y * gridW + x] = 1;
      }
    }
  }

  // Trace loops using Marching Squares
  const rawLoops = traceGridMarchingSquares(binaryGrid, gridW, gridH);

  interface LoopInfo {
    points: Point2D[];
    area: number;
    isOuter: boolean;
  }

  const loopInfos: LoopInfo[] = [];

  for (const raw of rawLoops) {
    // Simplify loops
    const simplified = simplifyPolygon(raw, 0.7);
    if (simplified.length < 4) continue;

    const area = polygonArea(simplified);
    // Ignore micro-specks (less than 12 sq pixels)
    if (Math.abs(area) < 12) continue;

    // Marching squares convention: inside on left -> CCW (area > 0) is outer boundary
    loopInfos.push({
      points: simplified,
      area,
      isOuter: area > 0,
    });
  }

  const outerLoops = loopInfos.filter((l) => l.isOuter);
  const holeLoops = loopInfos.filter((l) => !l.isOuter);

  // Group holes under their enclosing outer loop
  const shapes: THREE.Shape[] = [];

  // Helper to map canvas pixel [0..canvasW, 0..canvasH] to 3D millimeter space [-W/2..W/2, -H/2..H/2]
  const toMillimeters = (pt: Point2D): [number, number] => {
    const mmX = ((pt[0] / canvasW) - 0.5) * settings.targetWidth;
    const mmY = (0.5 - (pt[1] / canvasH)) * settings.targetHeight;
    return [mmX, mmY];
  };

  for (const outer of outerLoops) {
    const mmOuter = outer.points.map(toMillimeters);
    const shape = new THREE.Shape();
    shape.moveTo(mmOuter[0][0], mmOuter[0][1]);
    for (let i = 1; i < mmOuter.length; i++) {
      shape.lineTo(mmOuter[i][0], mmOuter[i][1]);
    }
    shape.closePath();

    // Check which holes belong inside this outer loop
    for (const hole of holeLoops) {
      // Test the first point of the hole
      if (isPointInPolygon(hole.points[0], outer.points)) {
        const mmHole = hole.points.map(toMillimeters);
        const holePath = new THREE.Path();
        holePath.moveTo(mmHole[0][0], mmHole[0][1]);
        for (let i = 1; i < mmHole.length; i++) {
          holePath.lineTo(mmHole[i][0], mmHole[i][1]);
        }
        holePath.closePath();
        shape.holes.push(holePath);
      }
    }

    shapes.push(shape);
  }

  return shapes;
}

/**
 * Traces text contours into normalized 0-100 coordinate loops for SVG / 2D path usage
 */
export function traceTextContoursNormalized(
  text: string,
  fontFamily: 'cursive' | 'bold' | 'serif' | 'rounded' = 'bold',
  fontSizeRel: number = 24,
  offsetYRel: number = 0,
  mirror: boolean = false
): Point2D[][] {
  const clean = (text || '').trim();
  if (!clean) return [];

  const canvasW = 400;
  const canvasH = 400;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  let fontStyleString = 'bold 36px sans-serif';
  if (fontFamily === 'cursive') {
    fontStyleString = 'italic bold 38px "Brush Script MT", "Caveat", "Dancing Script", cursive';
  } else if (fontFamily === 'serif') {
    fontStyleString = 'bold 36px "Times New Roman", "Playfair Display", Georgia, serif';
  } else if (fontFamily === 'rounded') {
    fontStyleString = 'bold 36px "Comfortaa", "Comic Sans MS", Arial Rounded MT Bold, sans-serif';
  } else {
    fontStyleString = 'bold 36px "Arial Black", "Montserrat", "Outfit", sans-serif';
  }

  const actualPx = Math.round(fontSizeRel * 1.6);
  ctx.font = fontStyleString.replace(/\d+px/, `${actualPx}px`);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, Math.round(actualPx * 0.055));

  const lines = clean.split('\n');
  const lineHeight = actualPx * 1.25;
  const startY = 200 + offsetYRel * 2 - ((lines.length - 1) * lineHeight) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(canvasW, 0);
    ctx.scale(-1, 1);
  }

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    ctx.strokeText(line, canvasW / 2, y);
    ctx.fillText(line, canvasW / 2, y);
  });
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;
  const binaryGrid = new Uint8Array(canvasW * canvasH);

  for (let y = 1; y < canvasH - 1; y++) {
    for (let x = 1; x < canvasW - 1; x++) {
      const idx = (y * canvasW + x) * 4;
      if (data[idx] > 110) {
        binaryGrid[y * canvasW + x] = 1;
      }
    }
  }

  const rawLoops = traceGridMarchingSquares(binaryGrid, canvasW, canvasH);
  const normalizedLoops: Point2D[][] = [];

  for (const raw of rawLoops) {
    const simplified = simplifyPolygon(raw, 0.7);
    if (simplified.length < 4) continue;
    if (Math.abs(polygonArea(simplified)) < 12) continue;

    normalizedLoops.push(
      simplified.map(([px, py]) => [(px / canvasW) * 100, (py / canvasH) * 100])
    );
  }

  return normalizedLoops;
}
