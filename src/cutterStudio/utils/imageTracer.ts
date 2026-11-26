import { ModelLineart, Path2D, Point2D } from '../types';
import { getBounds, smoothPath, offsetClosedPolygon } from './vectorMath';
import { traceTextContoursNormalized } from './text3DGenerator';

/**
 * Traces contours from an image element using canvas pixel analysis
 */
export async function traceImageToLineart(
  imageElement: HTMLImageElement,
  threshold: number = 128,
  invert: boolean = false,
  detailSensitivity: number = 0.5
): Promise<{ outerPerimeter: Path2D; innerDetails: Path2D[] }> {
  const canvas = document.createElement('canvas');
  const maxDim = 200; // Fast and smooth contour grid
  const scale = Math.min(maxDim / imageElement.naturalWidth, maxDim / imageElement.naturalHeight);
  const w = Math.round(imageElement.naturalWidth * scale);
  const h = Math.round(imageElement.naturalHeight * scale);

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.drawImage(imageElement, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Create binary grid (true = dark / lineart pixel)
  const grid: boolean[][] = [];
  for (let y = 0; y < h; y++) {
    grid[y] = [];
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 30) {
        // Transparent is background
        grid[y][x] = invert;
      } else {
        const brightness = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        grid[y][x] = invert ? brightness > threshold : brightness < threshold;
      }
    }
  }

  // 1. Trace outer perimeter (convex/concave hull boundary)
  const outerContour: Point2D[] = [];
  const steps = 48;
  const cx = w / 2;
  const cy = h / 2;

  // Ray-march outwards from center in 360 degrees to find the outermost perimeter
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let maxDist = 0;
    const maxRadius = Math.hypot(w, h) / 2;

    for (let r = maxRadius; r >= 5; r -= 1.5) {
      const px = Math.round(cx + dx * r);
      const py = Math.round(cy + dy * r);
      if (px >= 0 && px < w && py >= 0 && py < h && grid[py][px]) {
        maxDist = r;
        break;
      }
    }

    if (maxDist > 0) {
      // Normalize to 0-100 coordinate box
      outerContour.push([
        ((cx + dx * maxDist) / w) * 100,
        ((cy + dy * maxDist) / h) * 100,
      ]);
    }
  }

  // If outer contour was too small or empty, fallback to rounded rectangle
  let finalOuter: Path2D = outerContour;
  if (finalOuter.length < 8) {
    finalOuter = [
      [20, 20], [80, 20], [90, 30], [90, 70],
      [80, 80], [20, 80], [10, 70], [10, 30]
    ];
  } else {
    finalOuter = smoothPath(finalOuter, 2, true);
  }

  // 2. Extract inner detail lines using horizontal & vertical scan passes
  const innerDetails: Path2D[] = [];
  const visited = new Set<string>();
  const stride = Math.max(3, Math.round(6 * (1.1 - detailSensitivity)));

  for (let y = 10; y < h - 10; y += stride) {
    let currentLine: Point2D[] = [];
    for (let x = 10; x < w - 10; x++) {
      const key = `${x},${y}`;
      if (grid[y][x] && !visited.has(key)) {
        visited.add(key);
        // Only consider if not right on the edge
        const normX = (x / w) * 100;
        const normY = (y / h) * 100;
        currentLine.push([normX, normY]);
      } else {
        if (currentLine.length >= 4) {
          innerDetails.push(smoothPath(currentLine, 1, false));
        }
        currentLine = [];
      }
    }
    if (currentLine.length >= 4) {
      innerDetails.push(smoothPath(currentLine, 1, false));
    }
  }

  return {
    outerPerimeter: finalOuter,
    innerDetails: innerDetails.slice(0, 35), // Keep top 35 clean detail lines
  };
}

/**
 * Vectorizes custom text into clean closed vector loops for 3D stamp embossing
 */
export function vectorizeText(
  text: string,
  fontFamily: 'cursive' | 'bold' | 'serif' | 'rounded' = 'bold',
  fontSizeRel: number = 24,
  offsetYRel: number = 0,
  mirror: boolean = false
): Path2D[] {
  return traceTextContoursNormalized(text, fontFamily, fontSizeRel, offsetYRel, mirror);
}

/**
 * Creates custom text plaque model with text debossed inside a shape frame
 */
export function generateTextPlaqueModel(
  text: string,
  frameShape: 'circle' | 'rounded_rect' | 'oval' | 'scalloped' | 'heart',
  fontFamily: 'cursive' | 'bold' | 'serif' | 'rounded' = 'bold'
): ModelLineart {
  let outerPerimeter: Path2D = [];

  if (frameShape === 'circle') {
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      outerPerimeter.push([50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44]);
    }
  } else if (frameShape === 'oval') {
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      outerPerimeter.push([50 + Math.cos(a) * 45, 50 + Math.sin(a) * 32]);
    }
  } else if (frameShape === 'heart') {
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      outerPerimeter.push([50 + (x * 46) / 16, 48 + (y * 46) / 16]);
    }
  } else if (frameShape === 'scalloped') {
    const total = 12 * 4;
    for (let i = 0; i < total; i++) {
      const a = (i / total) * Math.PI * 2;
      const wave = (Math.cos(a * 12) + 1) / 2;
      const r = 38 + wave * 8;
      outerPerimeter.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
  } else {
    // Rounded rect
    outerPerimeter = [
      [14, 25], [86, 25], [92, 31], [92, 69],
      [86, 75], [14, 75], [8, 69], [8, 31]
    ];
  }

  // Draw text on hidden canvas and extract stroke ribbons
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 300;
  textCanvas.height = 300;
  const ctx = textCanvas.getContext('2d');
  const innerDetails: Path2D[] = [];

  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Auto font size based on text length
    const cleanText = text.trim() || 'Amor';
    const lines = cleanText.split('\n');
    const maxLineLength = Math.max(...lines.map(l => l.length));
    const fontSize = Math.min(48, Math.max(22, Math.floor(220 / maxLineLength)));

    ctx.font = `bold ${fontSize}px sans-serif`;

    const lineHeight = fontSize * 1.25;
    const startY = 150 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, idx) => {
      ctx.fillText(line, 150, startY + idx * lineHeight);
    });

    const imgData = ctx.getImageData(0, 0, 300, 300);
    const data = imgData.data;

    // Scan text lines
    for (let y = 30; y < 270; y += 7) {
      let currentSeg: Point2D[] = [];
      for (let x = 30; x < 270; x += 3) {
        const idx = (y * 300 + x) * 4;
        if (data[idx] > 128) {
          currentSeg.push([(x / 300) * 100, (y / 300) * 100]);
        } else {
          if (currentSeg.length >= 3) {
            innerDetails.push(currentSeg);
          }
          currentSeg = [];
        }
      }
      if (currentSeg.length >= 3) {
        innerDetails.push(currentSeg);
      }
    }
  }

  // Add decorative inner frame contour
  const innerBorder = offsetClosedPolygon(outerPerimeter, -5);
  if (innerBorder.length > 3) {
    innerDetails.push(innerBorder);
  }

  return {
    id: `custom_text_${Date.now()}`,
    name: text.trim().slice(0, 24) || 'Texto Personalizado',
    category: 'frames',
    categoryLabel: 'Personalizado',
    description: `Carimbo e cortador personalizado com o texto "${text}".`,
    iconName: 'Type',
    outerPerimeter,
    innerDetails,
  };
}
