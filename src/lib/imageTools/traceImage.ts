import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
// imagetracerjs ships as a UMD bundle without typed declarations.
// The default export exposes the synchronous imagedataToSVG() we need.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import ImageTracer from "imagetracerjs";

export interface TraceOptions {
  /** Quantize to this many colors before tracing. Default 5. */
  numberOfColors: number;
  /** Drop paths whose pixel area is below this threshold. Default 8. */
  pathOmit: number;
  /** Remove the dominant edge color (background) before tracing. Default true. */
  removeBackground: boolean;
  /** Invert luminance (useful for dark shapes on light bg). Default false. */
  invert?: boolean;
}

/** Max number of inner detail paths returned to the 3D pipeline. Excess
 *  details (noise) are dropped to keep STL/memory manageable. */
const MAX_DETAIL_PATHS = 32;

/** Max colour regions returned (bounds the per-colour tracing cost). */
const MAX_REGION_COLORS = 10;

/** A group of traced shapes painted with the same quantized colour. Used to
 *  keep the drawing's palette so each colour can become a filament. */
export interface TracedRegion {
  color: string;
  shapes: THREE.Shape[];
}

export interface TracedImage {
  /** Outer silhouette of the shape. */
  outer: THREE.Shape;
  /** Full image bounds as a rectangle in the same coordinate space as `outer`
   *  (the "square background" of the image). Used as the base slab when the
   *  user chooses to keep the background instead of following the silhouette. */
  imageFrame: THREE.Shape;
  /** Inner detail shapes (text, lines, etc.) — for engraving/relief.
   *  Capped at MAX_DETAIL_PATHS, keeping the largest by bounding-box area. */
  details: THREE.Shape[];
  /** Coloured inner regions, grouped by fill colour (background excluded).
   *  Each entry can become a separate filament in a multi-colour export. */
  regions: TracedRegion[];
  /** Hex colour of the detected background/border (used as the base slab). */
  backgroundColor: string;
  /** Width and height in millimetres (after scaling to targetWidthMm). */
  widthMm: number;
  heightMm: number;
  /** The traced SVG (kept for download/debug). */
  svg: string;
  /** Pixel size of the intermediate canvas used for tracing. */
  pixelSize: { width: number; height: number };
}

const DEFAULT_OPTIONS: TraceOptions = {
  numberOfColors: 8,
  pathOmit: 64,
  removeBackground: true,
  invert: false,
};

/** Max side length (px) used when resizing the raster for tracing. Higher
 *  values preserve finer detail at the cost of trace time and SVG size. */
const MAX_TRACE_DIM = 1024;

/**
 * Drop consecutive points that are closer than `tol` (sub-pixel trace noise)
 * and the redundant closing point. Near-duplicate vertices make
 * ExtrudeGeometry emit zero-area triangles that manifold rejects as
 * "Not manifold".
 */
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

/** Flatten the sub-paths of a parsed SVG path into one Shape (or Path for holes). */
function pathToShape(path: { subPaths: { getPoints: (divisions: number) => THREE.Vector2[] }[]; userData?: unknown }): THREE.Shape | null {
  // Use a moderate subdivision (24) — enough to keep extruded edges smooth
  // without ballooning memory on images with hundreds of small paths.
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

function bboxOfShape(shape: THREE.Shape): { width: number; height: number; area: number; minX: number; minY: number } {
  const box = new THREE.Box2();
  shape.getPoints().forEach((p) => box.expandByPoint(p));
  const size = new THREE.Vector2();
  box.getSize(size);
  return { width: size.x, height: size.y, area: size.x * size.y, minX: box.min.x, minY: box.min.y };
}

/** Apply an in-place transform to every control point of a Shape's curves
 *  (outer + holes). `getPoints()` only returns fresh copies, so mutating its
 *  output would silently do nothing — we must touch the stored curves. */
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

/** Decode a File / HTMLImageElement into an HTMLImageElement. */
async function fileToImage(file: File | HTMLImageElement): Promise<HTMLImageElement> {
  if (file instanceof HTMLImageElement) return file;
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Falha ao carregar a imagem."));
    i.src = url;
  });
  // Keep the object URL alive for the lifetime of the image — revoke after
  // the caller has finished drawing it onto a canvas.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return img;
}

/** Resize + return the prepared ImageData (background removal + inversion
 *  happen later, inside traceImageData, so direct callers can use them too). */
async function prepareImageData(file: File | HTMLImageElement): Promise<{ data: ImageData; width: number; height: number }> {
  const img = await fileToImage(file);
  const scale = Math.min(1, MAX_TRACE_DIM / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D não disponível neste navegador.");
  ctx.drawImage(img, 0, 0, width, height);

  return { data: ctx.getImageData(0, 0, width, height), width, height };
}

/** Parse the `rgb(r,g,b)` / `rgba(...)` fill strings imagetracerjs emits. */
function parseRgb(fill: string | undefined): { r: number; g: number; b: number } | null {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(fill || "");
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function colorDist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Average colour of the four image edges (skipping near-white pixels). */
function sampleBorderColor(data: Uint8ClampedArray, width: number, height: number): { r: number; g: number; b: number } | null {
  let r = 0, g = 0, b = 0, n = 0;
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum > 240) return; // skip already-bright pixels (avoid bias)
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  };
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y++) { sample(0, y); sample(width - 1, y); }
  if (n === 0) return null;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/** Replace pixels close to the dominant border color with white (background).
 *  Returns the sampled border colour so the caller can later filter traced
 *  paths that are still painted with the background fill. */
function removeBackgroundColor(data: Uint8ClampedArray, width: number, height: number): { r: number; g: number; b: number } | null {
  const bg = sampleBorderColor(data, width, height);
  if (!bg) return null; // entire image is already very light — nothing to remove

  const tol = 48;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bg.r, dg = data[i + 1] - bg.g, db = data[i + 2] - bg.b;
    if (dr * dr + dg * dg + db * db <= tol * tol) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
  }
  return bg;
}

function invertLuminance(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = gray < 128 ? 255 : 0;
    data[i] = v; data[i + 1] = v; data[i + 2] = v;
  }
}

/** Working height for colour-region tracing. The reliefs are extruded from
 *  these shapes, so sub-pixel detail at this reduced scale is plenty. */
const REGION_MAX_DIM = 480;
/** Colours closer than this (rectilinear distance) are treated as one. */
const REGION_COLOR_TOL = 56;
/** Antialiased fringe colours closer than this to the background are snapped
 *  away instead of becoming their own noisy relief. */
const REGION_BG_TOL = 96;

/**
 * Extract one `TracedRegion` per distinct drawing colour by tracing a binary
 * mask of each colour layer.
 *
 * Region colours come from a histogram of the source pixels. Every
 * non-background pixel is then snapped to its nearest region colour, so the
 * antialiased gradient between a drawing colour and the background is
 * absorbed by the anchor colour instead of spawning dozens of near-identical
 * grey slivers. Tracing each colour on its own mask recovers regions that a
 * single combined trace drops — e.g. a colour fully nested inside another.
 */
function buildColorRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: { numberOfColors: number; pathOmit: number },
  borderColor: { r: number; g: number; b: number } | null
): { regions: TracedRegion[]; backgroundColor: string } {
  const factor = Math.max(1, Math.ceil(Math.max(width, height) / REGION_MAX_DIM));
  const rw = Math.max(1, Math.floor(width / factor));
  const rh = Math.max(1, Math.floor(height / factor));

  // Background mask: pixels near the sampled border colour (or near-white).
  const bg = borderColor ?? { r: 255, g: 255, b: 255 };
  const dist3 = (r: number, g: number, b: number, c: { r: number; g: number; b: number }) =>
    Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b);
  const isBg = (i: number) => dist3(data[i], data[i + 1], data[i + 2], bg) < REGION_COLOR_TOL;

  // 1) Quantised colour histogram of non-background pixels (5 bits/channel).
  const bucket = (v: number) => v >> 3;
  const hist = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < width * height * 4; i += 4) {
    if (isBg(i)) continue;
    const k = (bucket(data[i]) << 10) | (bucket(data[i + 1]) << 5) | bucket(data[i + 2]);
    const e = hist.get(k);
    if (e) { e.count++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2]; }
    else hist.set(k, { count: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
  }

  // 2) Distinct colours: buckets by pixel count; merge close ones, drop the
  //    background fringes, cap to the user's colour budget (and a hard cap).
  //    Collect a few extra candidates first so antialiasing fringes don't eat
  //    the budget; they are removed right after.
  const maxColors = Math.max(1, Math.min(opts.numberOfColors, MAX_REGION_COLORS));
  const colors: { r: number; g: number; b: number }[] = [];
  const distinct = Array.from(hist.values())
    .map((e) => ({ r: e.r / e.count, g: e.g / e.count, b: e.b / e.count, count: e.count }))
    .sort((a, b) => b.count - a.count);
  for (const c of distinct) {
    if (c.count < opts.pathOmit) continue;
    if (dist3(c.r, c.g, c.b, bg) < REGION_BG_TOL) continue;
    const close = colors.some((a) => dist3(c.r, c.g, c.b, a) < REGION_COLOR_TOL);
    if (close) continue;
    colors.push({ r: c.r, g: c.g, b: c.b });
    if (colors.length >= maxColors + 4) break;
  }
  if (colors.length === 0) return { regions: [], backgroundColor: rgbToHex(bg) };

  // Drop antialiased fringe colours: a colour that lies between the
  // background and an already-accepted (darker) colour, with a roughly
  // consistent mixing ratio, is just the soft edge of that colour.
  const luminance = (c: { r: number; g: number; b: number }) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const isBlend = (c: { r: number; g: number; b: number }, a: { r: number; g: number; b: number }) => {
    let tMin = 2, tMax = -1, tCount = 0;
    for (const ch of ["r", "g", "b"] as const) {
      const denom = bg[ch] - a[ch];
      if (Math.abs(denom) < 1) continue;
      const t = (c[ch] - a[ch]) / denom;
      if (t < 0 || t > 1) return false;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
      tCount++;
    }
    return tCount > 0 && tMax - tMin < 0.35;
  };
  const kept: { r: number; g: number; b: number }[] = [];
  for (const c of [...colors].sort((a, b) => luminance(a) - luminance(b))) {
    if (kept.some((a) => isBlend(c, a))) continue;
    kept.push(c);
    if (kept.length >= maxColors) break;
  }
  if (kept.length === 0) return { regions: [], backgroundColor: rgbToHex(bg) };
  colors.length = 0;
  colors.push(...kept);

  // 3) Snap every non-background pixel to its nearest region colour and build
  //    per-colour masks at reduced resolution (1 = colour present in block).
  const masks = colors.map(() => new Uint8Array(rw * rh));
  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const sx = rx * factor + dx, sy = ry * factor + dy;
          if (sx >= width || sy >= height) continue;
          const i = (sy * width + sx) * 4;
          if (isBg(i)) continue;
          let best = 0;
          let bestD = Infinity;
          for (let c = 0; c < colors.length; c++) {
            const d = dist3(data[i], data[i + 1], data[i + 2], colors[c]);
            if (d < bestD) { bestD = d; best = c; }
          }
          masks[best][ry * rw + rx] = 1;
        }
      }
    }
  }

  // 4) Trace each mask (black on white) and scale the shapes back to pixels.
  const regions: TracedRegion[] = [];
  const parser = new SVGLoader();
  for (let c = 0; c < colors.length; c++) {
    let present = 0;
    for (let i = 0; i < masks[c].length; i++) if (masks[c][i]) present++;
    if (present === 0) continue;

    const mask = new Uint8ClampedArray(rw * rh * 4);
    for (let i = 0; i < rw * rh; i++) {
      const v = masks[c][i] ? 0 : 255;
      mask[i * 4] = v; mask[i * 4 + 1] = v; mask[i * 4 + 2] = v; mask[i * 4 + 3] = 255;
    }
    const svg = ImageTracer.imagedataToSVG({ data: mask, width: rw, height: rh }, {
      numberofcolors: 2,
      pathomit: opts.pathOmit,
      ltres: 1,
      qtres: 1,
      strokewidth: 0,
      roundcoords: 1,
      blurradius: 0,
    });

    const parsed = parser.parse(svg);
    const shapes: THREE.Shape[] = [];
    for (const path of parsed.paths) {
      // The mask is black-on-white: only the black (traced colour) paths
      // belong to this region. White paths are the background frame and the
      // holes left by other colours — drop them so they never become reliefs.
      const style = (path.userData as { style?: { fill?: string } } | undefined)?.style;
      const fill = parseRgb(style?.fill);
      if (!fill || fill.r + fill.g + fill.b > 300) continue;
      const shape = pathToShape(path);
      if (shape) shapes.push(shape);
    }
    if (shapes.length === 0) continue;
    for (const shape of shapes) {
      transformShape(shape, (p) => { p.y = -p.y; });
      // Scale back from the reduced tracing grid to full pixel space.
      if (factor > 1) transformShape(shape, (p) => { p.x *= factor; p.y *= factor; });
    }
    regions.push({ color: rgbToHex(colors[c]), shapes });
  }

  return { regions, backgroundColor: rgbToHex(bg) };
}

/**
 * Trace a raster image into a 2D outline + detail shapes, normalised to mm.
 *
 *   - Outer silhouette = the largest contour by bounding-box area.
 *   - Inner details = everything else (text, line decorations, etc.).
 *   - If the natural aspect is wider than tall, the result is rotated so the
 *     silhouette stands vertically (suitable for a handle).
 */
export async function traceImage(
  file: File | HTMLImageElement,
  targetWidthMm: number,
  rawOptions: Partial<TraceOptions> = {}
): Promise<TracedImage> {
  const { data, width, height } = await prepareImageData(file);
  return traceImageData(data, width, height, targetWidthMm, rawOptions);
}

/**
 * Trace from an already-prepared ImageData (useful in tests where loading
 * an Image element is impractical).
 */
export function traceImageData(
  data: ImageData,
  pixelWidth: number,
  pixelHeight: number,
  targetWidthMm: number,
  rawOptions: Partial<TraceOptions> = {}
): TracedImage {
  const opts: TraceOptions = { ...DEFAULT_OPTIONS, ...rawOptions };

  let borderColor: { r: number; g: number; b: number } | null = null;
  if (opts.removeBackground) {
    borderColor = removeBackgroundColor(data.data, pixelWidth, pixelHeight);
  } else {
    borderColor = sampleBorderColor(data.data, pixelWidth, pixelHeight);
  }
  if (opts.invert) {
    invertLuminance(data.data);
  }

  const svg: string = ImageTracer.imagedataToSVG(data, {
    numberofcolors: opts.numberOfColors,
    pathomit: opts.pathOmit,
    ltres: 1,
    qtres: 1,
    strokewidth: 0,
    roundcoords: 1,
    mincolorratio: 0.008,
    blurradius: 0,
    blurdelta: 20,
  });

  const parsed = new SVGLoader().parse(svg);
  if (!parsed.paths.length) throw new Error("Nenhum contorno encontrado na imagem.");

  const candidates: THREE.Shape[] = [];
  const fills: ({ r: number; g: number; b: number } | null)[] = [];
  for (const path of parsed.paths) {
    const shape = pathToShape(path);
    if (!shape) continue;
    candidates.push(shape);
    const style = (path.userData as { style?: { fill?: string } } | undefined)?.style;
    fills.push(parseRgb(style?.fill));
  }
  if (candidates.length === 0) throw new Error("Falha ao interpretar os contornos da imagem.");

  // Flip Y (SVG Y-down → Three Y-up).
  for (const shape of candidates) transformShape(shape, (p) => { p.y = -p.y; });

  const measured = candidates
    .map((shape, i) => ({ shape, bbox: bboxOfShape(shape), fill: fills[i] }))
    .sort((a, b) => b.bbox.area - a.bbox.area);

  // Pick the true silhouette. imagetracerjs always emits a path painted with
  // the border/background fill — usually the largest: the full image frame
  // with the object cut out as a hole. Selecting that one produces a hollow
  // "frame" mesh whose hole is full of sub-pixel wiggle, which extrudes into
  // degenerate, non-manifold triangles. Drop frame-sized background paths:
  // either they carry the drawing as a hole (a real background frame) or
  // their fill matches the sampled border/white. A full-bleed drawing that
  // covers ~the whole image with no hole is kept (fallback keeps it too).
  const imageArea = pixelWidth * pixelHeight;
  const WHITE = { r: 255, g: 255, b: 255 };
  const isFrame = (m: (typeof measured)[number]) => m.bbox.area > imageArea * 0.88;
  const isBackgroundFrame = (m: (typeof measured)[number]) =>
    isFrame(m) &&
    (m.shape.holes.length > 0 ||
      (m.fill &&
        ((borderColor && colorDist(m.fill, borderColor) < 60) ||
          (opts.removeBackground && colorDist(m.fill, WHITE) < 60))));
  const nonBg = measured.filter((m) => !isBackgroundFrame(m));
  const ordered = nonBg.length > 0 ? nonBg : measured;

  const outer = ordered[0].shape;
  // Cap details so the 3D pipeline (CSG / extrude / STL) stays performant.
  const detailEntries = ordered.slice(1, MAX_DETAIL_PATHS + 1);
  const details = detailEntries.map((entry) => entry.shape);

  // Group the drawing colours into per-colour regions. A single combined
  // trace loses colours fully nested inside another colour, so we instead
  // trace each quantised colour layer separately (black on white mask).
  const colorRegions = buildColorRegions(
    data.data,
    pixelWidth,
    pixelHeight,
    { numberOfColors: opts.numberOfColors, pathOmit: opts.pathOmit },
    borderColor
  );
  const regions = colorRegions.regions;
  const backgroundColor = colorRegions.backgroundColor;

  const outerBbox = ordered[0].bbox;
  const scale = targetWidthMm / Math.max(0.001, outerBbox.width);
  // The full image bounds as a rectangle (Y-down pixel space, flipped to the
  // same orientation as the traced shapes). Transformed exactly like outer so
  // it stays aligned with the drawing when kept as the base.
  const imageFrame = new THREE.Shape();
  imageFrame.moveTo(0, 0);
  imageFrame.lineTo(pixelWidth, 0);
  imageFrame.lineTo(pixelWidth, -pixelHeight);
  imageFrame.lineTo(0, -pixelHeight);
  imageFrame.closePath();
  // Transform every shape exactly once (outer + frame + details + every region shape).
  const transformSet = new Set<THREE.Shape>([outer, imageFrame, ...details, ...regions.flatMap((r) => r.shapes)]);
  for (const shape of transformSet) transformShape(shape, (p) => { p.x *= scale; p.y *= scale; });

  const finalOuter = bboxOfShape(outer);
  if (finalOuter.width > finalOuter.height) {
    for (const shape of transformSet) transformShape(shape, (p) => { const x = p.x; p.x = -p.y; p.y = x; });
  }

  const rotatedOuter = bboxOfShape(outer);
  return {
    outer,
    imageFrame,
    details,
    regions,
    backgroundColor,
    widthMm: targetWidthMm,
    heightMm: rotatedOuter.height,
    svg,
    pixelSize: { width: pixelWidth, height: pixelHeight },
  };
}