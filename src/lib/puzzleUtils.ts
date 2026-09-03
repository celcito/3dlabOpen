/**
 * High-precision Puzzle & Memory Game vector & raster generation utilities.
 * Handles jigsaw Bezier spline calculation, mold overlays, SVG cutting vectors,
 * and Memory Game print sheets.
 */

export interface PuzzleMoldResult {
  cleanImage: string;
  imageWithMoldPNG: string;
  imageWithMoldSVG: string;
  moldSVGOnly: string;
  cleanImageSVG: string;
  pieceCount: number;
  rows: number;
  cols: number;
  width: number;
  height: number;
}

export interface MemorySheetResult {
  memorySheetPNG: string;
  memorySheetSVG: string;
  cardCount: number;
  pairsCount: number;
}

export type MoldShapeType = "rect" | "square" | "circle" | "egg" | "heart" | "star" | "hexagon" | "shield";

interface Point {
  x: number;
  y: number;
}

export type CutStyleType = "classic" | "organic" | "wave" | "round" | "spiral" | "victorian" | "mixed";

export interface EdgeSegment {
  type: "L" | "C";
  points: number[];
}

export interface JigsawEdgeOptions {
  tabSize?: number;
  tabType?: CutStyleType;
  irregularity?: number;
  seed?: number;
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

// Generate Jigsaw Edge Path segments for SVG, Canvas 2D & THREE 3D
export function getJigsawEdgePoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  tabDir: number, // 0 = straight line, 1 = tab out, -1 = tab in
  options: JigsawEdgeOptions = {}
): EdgeSegment[] {
  if (tabDir === 0) {
    return [{ type: "L", points: [endX, endY] }];
  }

  const {
    tabSize = 0.28,
    tabType = "classic",
    irregularity = 0.35,
    seed = 1,
  } = options;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx);

  const t = (u: number, v: number): [number, number] => {
    const su = u * len;
    const sv = v * len * tabDir * tabSize;
    const rx = su * Math.cos(ang) - sv * Math.sin(ang);
    const ry = su * Math.sin(ang) + sv * Math.cos(ang);
    return [startX + rx, startY + ry];
  };

  // Pseudo-random variations for this specific edge
  const r1 = seededRandom(seed * 13.1 + 7.3);
  const r2 = seededRandom(seed * 29.7 + 19.1);
  const r3 = seededRandom(seed * 47.3 + 31.9);
  const r4 = seededRandom(seed * 61.1 + 53.7);

  // Resolve actual style if mixed
  let activeStyle = tabType;
  if (tabType === "mixed") {
    if (r1 < 0.20) activeStyle = "classic";
    else if (r1 < 0.38) activeStyle = "organic";
    else if (r1 < 0.55) activeStyle = "spiral";
    else if (r1 < 0.72) activeStyle = "victorian";
    else if (r1 < 0.86) activeStyle = "wave";
    else activeStyle = "round";
  }

  // Base center offset and neck variations
  const uCenter = 0.50 + (r2 - 0.5) * 0.16 * irregularity;
  const scaleBulb = 1.0 + (r3 - 0.5) * 0.25 * irregularity;
  const skew = (r4 - 0.5) * 0.12 * irregularity;

  if (activeStyle === "wave") {
    const p1 = t(0.12, 0);
    const c1 = t(0.30, 0.45 * scaleBulb);
    const c2 = t(0.70, -0.45 * scaleBulb);
    const p2 = t(0.88, 0);
    const p3 = t(1, 0);
    return [
      { type: "L", points: [p1[0], p1[1]] },
      { type: "C", points: [c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]] },
      { type: "L", points: [p3[0], p3[1]] },
    ];
  } else if (activeStyle === "round") {
    const halfWidth = 0.14 * scaleBulb;
    const p1 = t(Math.max(0.1, uCenter - halfWidth - 0.05), 0);
    const c1 = t(uCenter - halfWidth, 0.45 * scaleBulb);
    const c2 = t(uCenter + halfWidth, 0.45 * scaleBulb);
    const p2 = t(Math.min(0.9, uCenter + halfWidth + 0.05), 0);
    const pEnd = t(1, 0);
    return [
      { type: "L", points: [p1[0], p1[1]] },
      { type: "C", points: [c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]] },
      { type: "L", points: [pEnd[0], pEnd[1]] },
    ];
  } else if (activeStyle === "organic") {
    const nw = (0.12 + 0.04 * (r3 - 0.5)) * scaleBulb;
    const bw = (0.24 + 0.06 * (r2 - 0.5)) * scaleBulb;
    const h = 0.95 * scaleBulb;

    const p0 = t(Math.max(0.08, uCenter - nw - 0.15), 0);
    const c1 = t(uCenter - nw - 0.08, 0.05 * skew);
    const c2 = t(uCenter - nw, 0.18 * h);
    const p1 = t(uCenter - nw * 0.7, 0.28 * h);

    const c3 = t(uCenter - bw, 0.45 * h);
    const c4 = t(uCenter - bw * 0.4 + skew, 1.05 * h);
    const p2 = t(uCenter + skew * 0.5, 1.02 * h);

    const c5 = t(uCenter + bw * 0.4 + skew, 1.02 * h);
    const c6 = t(uCenter + bw, 0.42 * h);
    const p3 = t(uCenter + nw * 0.7, 0.28 * h);

    const c7 = t(uCenter + nw, 0.18 * h);
    const c8 = t(uCenter + nw + 0.08, 0);
    const p4 = t(Math.min(0.92, uCenter + nw + 0.15), 0);
    const pEnd = t(1, 0);

    return [
      { type: "L", points: [p0[0], p0[1]] },
      { type: "C", points: [c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]] },
      { type: "C", points: [c3[0], c3[1], c4[0], c4[1], p2[0], p2[1]] },
      { type: "C", points: [c5[0], c5[1], c6[0], c6[1], p3[0], p3[1]] },
      { type: "C", points: [c7[0], c7[1], c8[0], c8[1], p4[0], p4[1]] },
      { type: "L", points: [pEnd[0], pEnd[1]] },
    ];
  } else if (activeStyle === "spiral") {
    const nw = 0.10 * scaleBulb;
    const bw = 0.26 * scaleBulb;
    const h = 0.92 * scaleBulb;

    const p0 = t(Math.max(0.1, uCenter - nw - 0.18), 0);
    const c1 = t(uCenter - nw - 0.06, 0.08);
    const c2 = t(uCenter - nw - 0.08, 0.42 * h);
    const p1 = t(uCenter - nw * 0.3, 0.65 * h);

    const c3 = t(uCenter - 0.02, 0.95 * h);
    const c4 = t(uCenter + bw * 0.6, 1.08 * h);
    const p2 = t(uCenter + bw, 0.70 * h);

    const c5 = t(uCenter + bw * 0.9, 0.38 * h);
    const c6 = t(uCenter + nw + 0.05, 0.12);
    const p3 = t(Math.min(0.9, uCenter + nw + 0.18), 0);
    const pEnd = t(1, 0);

    return [
      { type: "L", points: [p0[0], p0[1]] },
      { type: "C", points: [c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]] },
      { type: "C", points: [c3[0], c3[1], c4[0], c4[1], p2[0], p2[1]] },
      { type: "C", points: [c5[0], c5[1], c6[0], c6[1], p3[0], p3[1]] },
      { type: "L", points: [pEnd[0], pEnd[1]] },
    ];
  } else if (activeStyle === "victorian") {
    const nw = 0.08 * scaleBulb;
    const bw = 0.28 * scaleBulb;
    const h = 0.96 * scaleBulb;

    const p0 = t(Math.max(0.1, uCenter - nw - 0.16), 0);
    const c1 = t(uCenter - nw - 0.04, 0);
    const c2 = t(uCenter - nw - 0.02, 0.22 * h);
    const p1 = t(uCenter - nw, 0.30 * h);

    const c3 = t(uCenter - bw, 0.40 * h);
    const c4 = t(uCenter - bw * 0.6, 0.98 * h);
    const p2 = t(uCenter, 0.98 * h);

    const c5 = t(uCenter + bw * 0.6, 0.98 * h);
    const c6 = t(uCenter + bw, 0.40 * h);
    const p3 = t(uCenter + nw, 0.30 * h);

    const c7 = t(uCenter + nw + 0.02, 0.22 * h);
    const c8 = t(uCenter + nw + 0.04, 0);
    const p4 = t(Math.min(0.9, uCenter + nw + 0.16), 0);
    const pEnd = t(1, 0);

    return [
      { type: "L", points: [p0[0], p0[1]] },
      { type: "C", points: [c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]] },
      { type: "C", points: [c3[0], c3[1], c4[0], c4[1], p2[0], p2[1]] },
      { type: "C", points: [c5[0], c5[1], c6[0], c6[1], p3[0], p3[1]] },
      { type: "C", points: [c7[0], c7[1], c8[0], c8[1], p4[0], p4[1]] },
      { type: "L", points: [pEnd[0], pEnd[1]] },
    ];
  } else {
    // Classic interlocking tab
    const nw = (0.12 + (r3 - 0.5) * 0.04 * irregularity) * scaleBulb;
    const bw = (0.24 + (r2 - 0.5) * 0.06 * irregularity) * scaleBulb;
    const h = 0.90 * scaleBulb;

    const p1 = t(Math.max(0.08, uCenter - nw - 0.12), 0);
    const c1 = t(uCenter - nw - 0.04, 0);
    const c2 = t(uCenter - nw, 0.18 * h);
    const p2 = t(uCenter - nw * 0.9, 0.25 * h);

    const c3 = t(uCenter - bw, 0.38 * h);
    const c4 = t(uCenter - bw * 0.4 + skew, 0.95 * h);
    const p3 = t(uCenter + skew * 0.5, 0.95 * h);

    const c5 = t(uCenter + bw * 0.4 + skew, 0.95 * h);
    const c6 = t(uCenter + bw, 0.38 * h);
    const p4 = t(uCenter + nw * 0.9, 0.25 * h);

    const c7 = t(uCenter + nw, 0.18 * h);
    const c8 = t(uCenter + nw + 0.04, 0);
    const p5 = t(Math.min(0.92, uCenter + nw + 0.12), 0);

    const pEnd = t(1, 0);

    return [
      { type: "L", points: [p1[0], p1[1]] },
      { type: "C", points: [c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]] },
      { type: "C", points: [c3[0], c3[1], c4[0], c4[1], p3[0], p3[1]] },
      { type: "C", points: [c5[0], c5[1], c6[0], c6[1], p4[0], p4[1]] },
      { type: "C", points: [c7[0], c7[1], c8[0], c8[1], p5[0], p5[1]] },
      { type: "L", points: [pEnd[0], pEnd[1]] },
    ];
  }
}

// Reverses a set of path segments perfectly for complementary piece edges
export function reverseEdgeSegments(
  segments: { type: "L" | "C"; points: number[] }[],
  origStartX: number,
  origStartY: number
): { type: "L" | "C"; points: number[] }[] {
  if (!segments || segments.length === 0) return [];

  const pts: [number, number][] = [[origStartX, origStartY]];
  for (const seg of segments) {
    if (seg.type === "L") {
      pts.push([seg.points[0], seg.points[1]]);
    } else {
      pts.push([seg.points[4], seg.points[5]]);
    }
  }

  const reversed: { type: "L" | "C"; points: number[] }[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const prevPt = pts[i];
    if (seg.type === "L") {
      reversed.push({ type: "L", points: [prevPt[0], prevPt[1]] });
    } else {
      reversed.push({
        type: "C",
        points: [
          seg.points[2],
          seg.points[3],
          seg.points[0],
          seg.points[1],
          prevPt[0],
          prevPt[1],
        ],
      });
    }
  }

  return reversed;
}

// Convert edge segments to SVG path 'd' string
function segmentsToSvgD(startX: number, startY: number, segments: { type: "L" | "C"; points: number[] }[]): string {
  let d = `M ${startX.toFixed(2)} ${startY.toFixed(2)} `;
  for (const seg of segments) {
    if (seg.type === "L") {
      d += `L ${seg.points[0].toFixed(2)} ${seg.points[1].toFixed(2)} `;
    } else if (seg.type === "C") {
      d += `C ${seg.points[0].toFixed(2)} ${seg.points[1].toFixed(2)}, ${seg.points[2].toFixed(2)} ${seg.points[3].toFixed(2)}, ${seg.points[4].toFixed(2)} ${seg.points[5].toFixed(2)} `;
    }
  }
  return d;
}

// Draw segments on Canvas 2D
function drawSegmentsOnCanvas(ctx: CanvasRenderingContext2D, startX: number, startY: number, segments: { type: "L" | "C"; points: number[] }[]) {
  ctx.moveTo(startX, startY);
  for (const seg of segments) {
    if (seg.type === "L") {
      ctx.lineTo(seg.points[0], seg.points[1]);
    } else if (seg.type === "C") {
      ctx.bezierCurveTo(seg.points[0], seg.points[1], seg.points[2], seg.points[3], seg.points[4], seg.points[5]);
    }
  }
}

// Shape generator for custom mold outlines (Egg, Heart, Circle, etc.)
function getShapeSvgPath(shape: MoldShapeType, w: number, h: number): string {
  const hw = w / 2;
  const hh = h / 2;
  const cx = hw;
  const cy = hh;

  switch (shape) {
    case "egg": {
      // Natural organic egg curve: narrow rounded top, wide body, broad bottom
      const yTop = cy - hh * 0.96;
      const yMid = cy + hh * 0.15;
      const yBot = cy + hh * 0.96;
      const topCpW = hw * 0.52;
      const maxW = hw * 0.96;
      const botCpW = hw * 0.58;

      return `M ${cx} ${yTop}
        C ${cx + topCpW} ${yTop}, ${cx + maxW} ${cy - hh * 0.35}, ${cx + maxW} ${yMid}
        C ${cx + maxW} ${cy + hh * 0.65}, ${cx + botCpW} ${yBot}, ${cx} ${yBot}
        C ${cx - botCpW} ${yBot}, ${cx - maxW} ${cy + hh * 0.65}, ${cx - maxW} ${yMid}
        C ${cx - maxW} ${cy - hh * 0.35}, ${cx - topCpW} ${yTop}, ${cx} ${yTop} Z`;
    }
    case "circle": {
      const r = Math.min(hw, hh) * 0.96;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case "heart": {
      const s = Math.min(w, h) / 100 * 0.9;
      return `M ${cx} ${cy - 20 * s}
        C ${cx} ${cy - 40 * s}, ${cx - 20 * s}, ${cy - 50 * s}, ${cx - 40 * s}, ${cy - 50 * s}
        C ${cx - 70 * s}, ${cy - 50 * s}, ${cx - 70 * s}, ${cy - 20 * s}, ${cx - 70 * s}, ${cy - 20 * s}
        C ${cx - 70 * s}, ${cy + 10 * s}, ${cx - 50 * s}, ${cy + 35 * s}, ${cx}, ${cy + 60 * s}
        C ${cx + 50 * s}, ${cy + 35 * s}, ${cx + 70 * s}, ${cy + 10 * s}, ${cx + 70 * s}, ${cy - 20 * s}
        C ${cx + 70 * s}, ${cy - 20 * s}, ${cx + 70 * s}, ${cy - 50 * s}, ${cx + 40 * s}, ${cy - 50 * s}
        C ${cx + 20 * s}, ${cy - 50 * s}, ${cx}, ${cy - 40 * s}, ${cx}, ${cy - 20 * s} Z`;
    }
    case "hexagon": {
      const r = Math.min(hw, hh) * 0.95;
      let d = "";
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3 - Math.PI / 6;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        d += (i === 0 ? `M ${px.toFixed(2)} ${py.toFixed(2)} ` : `L ${px.toFixed(2)} ${py.toFixed(2)} `);
      }
      return d + "Z";
    }
    case "star": {
      const rOuter = Math.min(hw, hh) * 0.96;
      const rInner = rOuter * 0.45;
      let d = "";
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const ang = (i * Math.PI) / 5 - Math.PI / 2;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        d += (i === 0 ? `M ${px.toFixed(2)} ${py.toFixed(2)} ` : `L ${px.toFixed(2)} ${py.toFixed(2)} `);
      }
      return d + "Z";
    }
    case "shield": {
      const pad = hw * 0.08;
      return `M ${pad} ${pad} L ${w - pad} ${pad} L ${w - pad} ${cy} Q ${w - pad} ${h - pad} ${cx} ${h - pad} Q ${pad} ${h - pad} ${pad} ${cy} Z`;
    }
    case "square":
    case "rect":
    default: {
      const r = Math.min(12, Math.min(w, h) * 0.05);
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
    }
  }
}

/**
 * Creates a procedural fallback artwork image if loading fails
 */
function createFallbackImage(width: number = 800, height: number = 800): HTMLImageElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#4F46E5");
    grad.addColorStop(0.5, "#EC4899");
    grad.addColorStop(1, "#06B6D4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative rings
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Vértice 3D Puzzle Studio", width / 2, height / 2);
  }
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  return img;
}

/**
 * Loads an image from a source URL or data URL with zero failures
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(createFallbackImage(800, 800));
      return;
    }

    const img = new Image();
    const isRemote = src.startsWith("http://") || src.startsWith("https://");

    if (isRemote) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => resolve(img);

    img.onerror = () => {
      // If remote image with CORS failed, try without CORS as second attempt
      if (isRemote && img.crossOrigin) {
        const retry = new Image();
        retry.onload = () => resolve(retry);
        retry.onerror = () => {
          // If still fails, resolve with safe procedural image
          resolve(createFallbackImage(800, 800));
        };
        retry.src = src;
      } else {
        // Safe procedural image fallback
        resolve(createFallbackImage(800, 800));
      }
    };

    img.src = src;
  });
}

/**
 * Generates the 2D Puzzle Mold overlays, SVGs, and cutting paths.
 */
export async function generatePuzzleMold(
  imageSrc: string,
  rows: number = 3,
  cols: number = 3,
  options: {
    tabSize?: number;
    tabType?: CutStyleType;
    irregularity?: number;
    seed?: number;
    moldShape?: MoldShapeType;
    showBorder?: boolean;
    lineColor?: string;
    lineWidth?: number;
  } = {}
): Promise<PuzzleMoldResult> {
  const {
    tabSize = 0.28,
    tabType = "classic",
    irregularity = 0.35,
    seed = 42,
    moldShape = "rect",
    showBorder = true,
    lineColor = "#FFFFFF",
    lineWidth = 2.5,
  } = options;

  const img = await loadImage(imageSrc);
  const width = img.naturalWidth || 800;
  const height = img.naturalHeight || 800;

  // Build grid of random tabs based on seed
  const edgesH: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows) row.push(0);
      else {
        const rnd = seededRandom(seed * 73.7 + r * 37.1 + c * 13.9);
        row.push(rnd > 0.5 ? 1 : -1);
      }
    }
    edgesH.push(row);
  }

  const edgesV: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c <= cols; c++) {
      if (c === 0 || c === cols) row.push(0);
      else {
        const rnd = seededRandom(seed * 89.3 + r * 19.7 + c * 43.1);
        row.push(rnd > 0.5 ? 1 : -1);
      }
    }
    edgesV.push(row);
  }

  const pieceW = width / cols;
  const pieceH = height / rows;

  // Pre-calculate canonical segments for all edges
  const segsH: EdgeSegment[][][] = [];
  for (let r = 0; r <= rows; r++) {
    const rowSegs: EdgeSegment[][] = [];
    const y = r * pieceH;
    for (let c = 0; c < cols; c++) {
      const x1 = c * pieceW;
      const x2 = (c + 1) * pieceW;
      const edgeSeed = seed * 1000 + r * 31 + c;
      const s = getJigsawEdgePoints(x1, y, x2, y, edgesH[r][c], {
        tabSize,
        tabType,
        irregularity,
        seed: edgeSeed,
      });
      rowSegs.push(s);
    }
    segsH.push(rowSegs);
  }

  const segsV: EdgeSegment[][][] = [];
  for (let r = 0; r < rows; r++) {
    const rowSegs: EdgeSegment[][] = [];
    for (let c = 0; c <= cols; c++) {
      const x = c * pieceW;
      const y1 = r * pieceH;
      const y2 = (r + 1) * pieceH;
      const edgeSeed = seed * 2000 + r * 47 + c;
      const s = getJigsawEdgePoints(x, y1, x, y2, edgesV[r][c], {
        tabSize,
        tabType,
        irregularity,
        seed: edgeSeed,
      });
      rowSegs.push(s);
    }
    segsV.push(rowSegs);
  }

  // 1. RENDER PNG WITH MOLD ON CANVAS
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context não disponível");

  // If custom mold shape, clip base image to the shape
  const shapePath = moldShape !== "rect" ? new Path2D(getShapeSvgPath(moldShape, width, height)) : null;

  if (shapePath) {
    ctx.save();
    ctx.clip(shapePath);
    ctx.drawImage(img, 0, 0, width, height);
    ctx.restore();

    // Stroke the outer mold contour
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth * 1.5;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;
    ctx.stroke(shapePath);
    ctx.restore();
  } else {
    // Standard rectangle
    ctx.drawImage(img, 0, 0, width, height);
  }

  // Draw Jigsaw Lines with high contrast glow
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Pass 1: Dark outline shadow
  ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
  ctx.lineWidth = lineWidth + 2;

  // Horizontal edges
  for (let r = 1; r < rows; r++) {
    const y = r * pieceH;
    for (let c = 0; c < cols; c++) {
      const x1 = c * pieceW;
      ctx.beginPath();
      drawSegmentsOnCanvas(ctx, x1, y, segsH[r][c]);
      ctx.stroke();
    }
  }

  // Vertical edges
  for (let c = 1; c < cols; c++) {
    const x = c * pieceW;
    for (let r = 0; r < rows; r++) {
      const y1 = r * pieceH;
      ctx.beginPath();
      drawSegmentsOnCanvas(ctx, x, y1, segsV[r][c]);
      ctx.stroke();
    }
  }

  // Pass 2: Main bright crisp line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;

  // Horizontal edges
  for (let r = 1; r < rows; r++) {
    const y = r * pieceH;
    for (let c = 0; c < cols; c++) {
      const x1 = c * pieceW;
      ctx.beginPath();
      drawSegmentsOnCanvas(ctx, x1, y, segsH[r][c]);
      ctx.stroke();
    }
  }

  // Vertical edges
  for (let c = 1; c < cols; c++) {
    const x = c * pieceW;
    for (let r = 0; r < rows; r++) {
      const y1 = r * pieceH;
      ctx.beginPath();
      drawSegmentsOnCanvas(ctx, x, y1, segsV[r][c]);
      ctx.stroke();
    }
  }

  // Outer border if requested
  if (showBorder) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth * 1.2;
    if (shapePath) {
      ctx.stroke(shapePath);
    } else {
      ctx.strokeRect(0, 0, width, height);
    }
  }

  ctx.restore();
  let imageWithMoldPNG = "";
  try {
    imageWithMoldPNG = canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Canvas toDataURL fallback:", e);
    imageWithMoldPNG = imageSrc;
  }

  // 2. GENERATE PURE VECTOR CUTTING PATHS (SVG)
  let svgPathsD = "";

  // Horizontal lines
  for (let r = 1; r < rows; r++) {
    const y = r * pieceH;
    for (let c = 0; c < cols; c++) {
      const x1 = c * pieceW;
      svgPathsD += segmentsToSvgD(x1, y, segsH[r][c]) + " ";
    }
  }

  // Vertical lines
  for (let c = 1; c < cols; c++) {
    const x = c * pieceW;
    for (let r = 0; r < rows; r++) {
      const y1 = r * pieceH;
      svgPathsD += segmentsToSvgD(x, y1, segsV[r][c]) + " ";
    }
  }

  const shapeOutlineD = getShapeSvgPath(moldShape, width, height);

  // Pure Vector Mold SVG (ideal for Laser / Cricut / CNC / 3D Extrude)
  const moldSVGOnly = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}px" height="${height}px">
  <title>Molde de Corte Quebra-Cabeça ${cols}x${rows}</title>
  <g id="Mold-Outer-Border" fill="none" stroke="#FF0000" stroke-width="1.5">
    <path d="${shapeOutlineD}" />
  </g>
  <g id="Jigsaw-Interlocking-Cut-Lines" fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="${svgPathsD}" />
  </g>
</svg>`;

  // SVG with Embedded Image + Cutting Vectors
  const imageWithMoldSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}px" height="${height}px">
  <title>Quebra-Cabeça com Molde ${cols}x${rows}</title>
  <defs>
    <clipPath id="moldShapeClip">
      <path d="${shapeOutlineD}" />
    </clipPath>
  </defs>
  <g id="Artwork" clip-path="url(#moldShapeClip)">
    <image href="${imageSrc}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />
  </g>
  <g id="Outer-Border" fill="none" stroke="${lineColor}" stroke-width="${lineWidth * 1.5}">
    <path d="${shapeOutlineD}" />
  </g>
  <g id="Cut-Lines" fill="none" stroke="${lineColor}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${svgPathsD}" />
  </g>
</svg>`;

  // Clean SVG
  const cleanImageSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}px" height="${height}px">
  <title>Arte Quebra-Cabeça Limpa</title>
  <image href="${imageSrc}" x="0" y="0" width="${width}" height="${height}" />
</svg>`;

  return {
    cleanImage: imageSrc,
    imageWithMoldPNG,
    imageWithMoldSVG,
    moldSVGOnly,
    cleanImageSVG,
    pieceCount: rows * cols,
    rows,
    cols,
    width,
    height,
  };
}

/**
 * Generates an A4 / Printable Grid Card Sheet for Memory Game (Jogo da Memória)
 */
export async function generateMemoryGameSheet(
  cardImages: string[],
  options: {
    title?: string;
    cardSize?: number;
    gap?: number;
    showBackCard?: boolean;
    rounded?: number;
  } = {}
): Promise<MemorySheetResult> {
  if (cardImages.length === 0) {
    throw new Error("Pelo menos 1 imagem de carta é necessária.");
  }

  const {
    title = "Jogo da Memória • Vértice Studio",
    cardSize = 220,
    gap = 20,
    rounded = 16,
  } = options;

  // Duplicate cards to form pairs
  const pairImages: string[] = [];
  for (const img of cardImages) {
    pairImages.push(img, img);
  }

  const totalCards = pairImages.length;
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(totalCards))));
  const rows = Math.ceil(totalCards / cols);

  const paddingX = 40;
  const paddingY = 60;
  const headerHeight = 70;

  const sheetWidth = paddingX * 2 + cols * cardSize + (cols - 1) * gap;
  const sheetHeight = paddingY * 2 + headerHeight + rows * cardSize + (rows - 1) * gap;

  // 1. Draw Memory Game Sheet on Canvas
  const canvas = document.createElement("canvas");
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context não disponível");

  // Background
  ctx.fillStyle = "#FAFAFA";
  ctx.fillRect(0, 0, sheetWidth, sheetHeight);

  // Header Title
  ctx.fillStyle = "#18181B";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, sheetWidth / 2, paddingY + 25);

  ctx.fillStyle = "#71717A";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${cardImages.length} Pares (${totalCards} Cartas) • Recorte nas linhas pontilhadas`, sheetWidth / 2, paddingY + 48);

  // Load all images
  const loadedCards: HTMLImageElement[] = await Promise.all(
    pairImages.map(src => loadImage(src))
  );

  // Draw Cards
  let svgCardsContent = "";

  for (let i = 0; i < totalCards; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = paddingX + c * (cardSize + gap);
    const y = paddingY + headerHeight + r * (cardSize + gap);

    const img = loadedCards[i];
    const pairId = Math.floor(i / 2) + 1;

    // Card white background with shadow
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, cardSize, cardSize, rounded);
    ctx.fill();
    ctx.restore();

    // Clip image to rounded rect
    ctx.save();
    roundRect(ctx, x + 8, y + 8, cardSize - 16, cardSize - 16, rounded - 4);
    ctx.clip();
    ctx.drawImage(img, x + 8, y + 8, cardSize - 16, cardSize - 16);
    ctx.restore();

    // Dashed cut guide border
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 1.8;
    roundRect(ctx, x, y, cardSize, cardSize, rounded);
    ctx.stroke();

    // Pair badge
    ctx.fillStyle = "#00E5FF";
    ctx.beginPath();
    ctx.arc(x + cardSize - 16, y + 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${pairId}`, x + cardSize - 16, y + 16);

    ctx.restore();

    // SVG Card
    svgCardsContent += `
    <g id="Card-${i + 1}" transform="translate(${x}, ${y})">
      <rect width="${cardSize}" height="${cardSize}" rx="${rounded}" fill="#FFFFFF" stroke="#00E5FF" stroke-width="1.5" stroke-dasharray="4,4" />
      <image href="${pairImages[i]}" x="8" y="8" width="${cardSize - 16}" height="${cardSize - 16}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cardClip)" />
      <circle cx="${cardSize - 16}" cy="16" r="11" fill="#00E5FF" />
      <text x="${cardSize - 16}" y="19" fill="#000000" font-size="9" font-weight="bold" text-anchor="middle">${pairId}</text>
    </g>`;
  }

  const memorySheetPNG = canvas.toDataURL("image/png");

  // SVG Sheet
  const memorySheetSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${sheetWidth} ${sheetHeight}" width="${sheetWidth}px" height="${sheetHeight}px">
  <title>${title}</title>
  <defs>
    <clipPath id="cardClip">
      <rect width="${cardSize - 16}" height="${cardSize - 16}" rx="${rounded - 4}" />
    </clipPath>
  </defs>
  <rect width="${sheetWidth}" height="${sheetHeight}" fill="#FAFAFA" />
  <text x="${sheetWidth / 2}" y="${paddingY + 25}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#18181B" text-anchor="middle">${title}</text>
  <text x="${sheetWidth / 2}" y="${paddingY + 48}" font-family="sans-serif" font-size="12" fill="#71717A" text-anchor="middle">${cardImages.length} Pares (${totalCards} Cartas) • Recorte nas linhas pontilhadas</text>
  <g id="Memory-Cards-Grid">
    ${svgCardsContent}
  </g>
</svg>`;

  return {
    memorySheetPNG,
    memorySheetSVG,
    cardCount: totalCards,
    pairsCount: cardImages.length,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
