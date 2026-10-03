import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MedalConfig, GeneratedMedal } from '../../types/medal';
import type { Model3DDimensions } from '../../types/pencilTopper';
import {
  extractContoursFromImageData,
  computeEnclosedEmptyMask,
  isPointInsidePolygon,
  polygonArea,
  punchMask,
} from '../pencilTopper/contourExtractor';
import type { Point2D } from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';

const pxPerMm = 20;
const mmPerPixel = 1 / pxPerMm;
const CANVAS_ALPHA_THRESHOLD = 120;
const TAU = Math.PI * 2;

/** Profundidade da pegada da alça dentro do corpo, em frações do raio da alça. */
const HANDLE_OVERLAP = 0.45;
/** Teto dessa profundidade em relação ao raio do corpo — AC MED-004.6. */
const HANDLE_MAX_OVERLAP_OF_R = 0.35;
/** ≥ 2 mm de sobreposiçãoXY — AC MED-004.5. */
const HANDLE_MIN_OVERLAP_MM = 2;
const HANDLE_MIN_WALL = 1.2;
/** Reforço (pescoço) da alça sobre o corpo — AC MED-004.7. */
const GUSSET_FLARE = 1.3;
/** Folga do reforço até o contorno do corpo. */
const GUSSET_EDGE_MARGIN_MM = 0.5;
/**
 * Ponto de controle vertical do flanco (0 = topo, 1 = base). Define o ângulo de
 * chegada na base do reforço: muito perto de 1 a curva fica tangente à base e a
 * ponta do canto é perdida no raster/contorno.
 */
const GUSSET_CTRL_FRAC = 0.3;
/**
 * Raio de filete nos cantos inferiores do reforço: um canto vivo ali vira uma
 * cunha finíssima que o raster descarta e o contorno arredonda (perda de ~3 mm
 * na largura útil e desalinhamento com o recorte da base).
 */
const GUSSET_FILLET_MM = 3;
const PAD_MM = 5;
const MAX_ARC_SPAN_RAD = (150 * Math.PI) / 180;
const MIN_ARC_FONT_MM = 2.5;
const ART_DIAMETER_FRACTION = 0.55;

interface PointMm {
  x: number;
  y: number;
}

export interface HandleLayout {
  outerR: number;
  slotW: number;
  slotH: number;
  holeR: number;
  mode: Exclude<MedalConfig['handleMode'], 'nenhuma'>;
  /** Centro da alça em mm (y para cima). */
  cy: number;
  /** Menor distância da origem até a pegada da alça. */
  innerRadius: number;
  /** Reforço (pescoço) trapezoidal da alça dentro do corpo, em mm. */
  gusset: GussetLayout;
}

/** Pescoço que alarga a junção alça ↔ corpo (AC MED-004.7). */
export interface GussetLayout {
  yTop: number;
  yBot: number;
  wTop: number;
  wBot: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a arte'));
    img.src = src;
  });
}

function trimImageAlpha(img: HTMLImageElement): {
  src: HTMLCanvasElement | HTMLImageElement;
  width: number;
  height: number;
} {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return { src: img, width: w, height: h };

  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return { src: img, width: w, height: h };
  pctx.drawImage(img, 0, 0);
  const data = pctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= CANVAS_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { src: img, width: w, height: h };

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const dst = document.createElement('canvas');
  dst.width = cw;
  dst.height = ch;
  const dctx = dst.getContext('2d');
  if (!dctx) return { src: img, width: w, height: h };
  dctx.drawImage(img, -minX, -minY);
  return { src: dst, width: cw, height: ch };
}

function countSolidPixels(data: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > CANVAS_ALPHA_THRESHOLD) count++;
  }
  return count;
}

function buildBodyShape(shape: MedalConfig['bodyShape'], r: number): THREE.Shape {
  const s = new THREE.Shape();

  if (shape === 'hexagonal' || shape === 'octogonal') {
    const sides = shape === 'hexagonal' ? 6 : 8;
    for (let k = 0; k < sides; k++) {
      const a = (k * TAU) / sides;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }

  if (shape === 'escudo') {
    const w = 0.85 * r;
    s.moveTo(-w, r * 0.98);
    s.lineTo(w, r * 0.98);
    s.lineTo(w, 0.2 * r);
    s.quadraticCurveTo(w, -0.65 * r, 0, -r);
    s.quadraticCurveTo(-w, -0.65 * r, -w, 0.2 * r);
    s.closePath();
    return s;
  }

  s.absarc(0, 0, r, 0, TAU, false);
  return s;
}

function bodyPolygon(shape: MedalConfig['bodyShape'], r: number): PointMm[] {
  const pts: PointMm[] = buildBodyShape(shape, r)
    .getPoints(128)
    .map((p) => ({ x: p.x, y: p.y }));
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first.x - last.x) > 1e-6 || Math.abs(first.y - last.y) > 1e-6) {
      pts.push({ ...first });
    }
  }
  return pts;
}

/** Altura do contorno do corpo em x = 0 (apoio da alça). */
function topYAtCenter(pts: PointMm[]): number {
  let best = -Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.x >= 0 && b.x <= 0) {
      const t = Math.abs(b.x - a.x) < 1e-9 ? 0 : a.x / (a.x - b.x);
      best = Math.max(best, a.y + t * (b.y - a.y));
    } else if (b.x >= 0 && a.x <= 0) {
      const t = Math.abs(a.x - b.x) < 1e-9 ? 0 : b.x / (b.x - a.x);
      best = Math.max(best, b.y + t * (a.y - b.y));
    }
  }
  return Number.isFinite(best) ? best : 0;
}

/** Meia-largura do corpo na horizontal y = y (0 se a linha não corta o polígono). */
function bodyHalfWidthAt(pts: PointMm[], y: number): number {
  let best = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a.y >= y) === (b.y >= y)) continue;
    const t = (y - a.y) / (b.y - a.y);
    best = Math.max(best, Math.abs(a.x + t * (b.x - a.x)));
  }
  return best;
}

/**
 * Reforço entre alça e corpo (AC MED-004.7): pescoço trapezoidal que nasce no
 * diâmetro da alça (tangente ao círculo) e alarga até o fundo da pegada.
 * `yBot` = fundo do círculo → `innerRadius` intacto (texto de arco superior não muda).
 */
function computeGussetLayout(bodyPts: PointMm[], cy: number, outerR: number): GussetLayout {
  const yTop = cy;
  const yBot = cy - outerR;
  const wTop = outerR;
  const edge = bodyHalfWidthAt(bodyPts, yBot);
  const wBot = Math.max(wTop, Math.min(outerR * GUSSET_FLARE, edge - GUSSET_EDGE_MARGIN_MM));
  return { yTop, yBot, wTop, wBot };
}

export function computeHandleLayout(
  config: MedalConfig,
  bodyTopY: number,
  r: number,
  bodyPts: PointMm[]
): HandleLayout | null {
  if (config.handleMode === 'nenhuma') return null;

  const wall = Math.max(HANDLE_MIN_WALL, config.handleWall);
  let outerR: number;
  let slotW = 0;
  let slotH = 0;
  let holeR = 0;

  if (config.handleMode === 'passante') {
    slotW = config.ribbonWidth;
    slotH = config.slotHeight;
    outerR = Math.max(slotW, slotH) / 2 + wall;
  } else {
    holeR = config.holeDiameter / 2;
    outerR = holeR + wall;
  }

  // AC MED-004.6 — a pegada não invade mais que 35% do raio do corpo.
  outerR = Math.min(outerR, (HANDLE_MAX_OVERLAP_OF_R / HANDLE_OVERLAP) * r);
  // AC MED-004.5 — sobreposiçãoXY ≥ 2 mm.
  outerR = Math.max(outerR, HANDLE_MIN_OVERLAP_MM / HANDLE_OVERLAP);
  if (!Number.isFinite(outerR) || outerR <= 0) return null;

  if (config.handleMode === 'passante') {
    const maxHalf = outerR - HANDLE_MIN_WALL;
    if (Math.max(slotW, slotH) / 2 > maxHalf) {
      const scale = (2 * maxHalf) / Math.max(slotW, slotH);
      slotW = Math.max(2, slotW * scale);
      slotH = Math.max(1, slotH * scale);
    }
  } else {
    holeR = Math.max(1, Math.min(holeR, outerR - HANDLE_MIN_WALL));
  }

  const cy = bodyTopY + (1 - HANDLE_OVERLAP) * outerR;
  return {
    outerR,
    slotW,
    slotH,
    holeR,
    mode: config.handleMode,
    cy,
    innerRadius: Math.max(1, cy - outerR),
    gusset: computeGussetLayout(bodyPts, cy, outerR),
  };
}

function polygonPath(ctx: CanvasRenderingContext2D, pts: PointMm[], cx: number, cy: number): void {
  ctx.beginPath();
  appendPolygonPath(ctx, pts, cx, cy);
}

function appendPolygonPath(ctx: CanvasRenderingContext2D, pts: PointMm[], cx: number, cy: number): void {
  for (let i = 0; i < pts.length; i++) {
    const x = cx + pts[i].x * pxPerMm;
    const y = cy - pts[i].y * pxPerMm;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function handleCanvasPoint(cx: number, cy: number, handle: HandleLayout): { x: number; y: number } {
  return { x: cx, y: cy - handle.cy * pxPerMm };
}

/**
 * Path do reforço (pescoço) em coordenadas de canvas, ancorado no centro da alça.
 * Lados nascem verticais (tangentes ao círculo), terminam em cantos filetados
 * (raio GUSSET_FILLET_MM) e a base é horizontal.
 */
function gussetPath(ctx: CanvasRenderingContext2D, center: { x: number; y: number }, handle: HandleLayout): void {
  const g = handle.gusset;
  const X = (x: number) => center.x + x * pxPerMm;
  const Y = (y: number) => center.y - (y - handle.cy) * pxPerMm;
  const fillet = Math.min(GUSSET_FILLET_MM, g.wBot * 0.5);
  const yEnd = g.yBot + fillet;
  const ctrl = g.yTop + (yEnd - g.yTop) * GUSSET_CTRL_FRAC;
  const top = Y(g.yTop);
  const bot = Y(g.yBot);
  ctx.moveTo(X(-g.wTop), top);
  ctx.lineTo(X(g.wTop), top);
  ctx.quadraticCurveTo(X(g.wTop), Y(ctrl), X(g.wBot), Y(yEnd));
  ctx.quadraticCurveTo(X(g.wBot), bot, X(g.wBot - fillet), bot);
  ctx.lineTo(X(-(g.wBot - fillet)), bot);
  ctx.quadraticCurveTo(X(-g.wBot), bot, X(-g.wBot), Y(yEnd));
  ctx.quadraticCurveTo(X(-g.wTop), Y(ctrl), X(-g.wTop), top);
  ctx.closePath();
}

function eraseHandleFootprint(ctx: CanvasRenderingContext2D, cx: number, cy: number, handle: HandleLayout | null): void {
  if (!handle) return;
  const p = handleCanvasPoint(cx, cy, handle);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(p.x, p.y, handle.outerR * pxPerMm, 0, TAU);
  gussetPath(ctx, p, handle);
  ctx.fill();
  ctx.restore();
}

function punchHandleOpening(ctx: CanvasRenderingContext2D, cx: number, cy: number, handle: HandleLayout): void {
  const p = handleCanvasPoint(cx, cy, handle);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  if (handle.mode === 'furo-redondo') {
    ctx.arc(p.x, p.y, handle.holeR * pxPerMm, 0, TAU);
  } else {
    const w = handle.slotW * pxPerMm;
    const h = handle.slotH * pxPerMm;
    ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, Math.min(h, w) * 0.35);
  }
  ctx.fill();
  ctx.restore();
}

function fontWeightFor(family: string): 'bold' | 'normal' {
  return ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers'].includes(family) ? 'normal' : 'bold';
}

function fontString(sizePx: number, family: string, weight: 'bold' | 'normal'): string {
  return `${weight} ${sizePx}px "${family}", sans-serif`;
}

function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radiusPx: number,
  sizePx: number,
  family: string,
  weight: 'bold' | 'normal',
  side: 'top' | 'bottom',
  stroked: boolean
): void {
  const trimmed = text.trim();
  if (!trimmed || radiusPx <= 0) return;

  ctx.font = fontString(sizePx, family, weight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  if (stroked) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, 0.5 * pxPerMm);
  }

  const chars = Array.from(trimmed);
  const gapPx = sizePx * 0.06;
  const widths = chars.map((c) => ctx.measureText(c).width);

  let count = 0;
  let totalAngle = 0;
  while (count < chars.length) {
    const gap = count < chars.length - 1 ? gapPx : 0;
    const angle = (widths[count] + gap) / radiusPx;
    if (totalAngle + angle > MAX_ARC_SPAN_RAD && count > 0) break;
    totalAngle += angle;
    count++;
  }
  if (count === 0) return;

  let cursor = -totalAngle / 2;
  for (let i = 0; i < count; i++) {
    const angle = widths[i] / radiusPx;
    const theta = cursor + angle / 2;
    cursor += angle;

    ctx.save();
    if (side === 'top') {
      ctx.translate(cx + radiusPx * Math.sin(theta), cy - radiusPx * Math.cos(theta));
      ctx.rotate(theta);
    } else {
      ctx.translate(cx + radiusPx * Math.sin(theta), cy + radiusPx * Math.cos(theta));
      ctx.rotate(-theta);
    }
    if (stroked) ctx.strokeText(chars[i], 0, 0);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();

    cursor += (i < count - 1 ? gapPx : 0) / radiusPx;
  }
}

function drawCenterText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  sizePx: number,
  family: string,
  weight: 'bold' | 'normal',
  stroked: boolean
): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  ctx.font = fontString(sizePx, family, weight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  if (stroked) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, 0.5 * pxPerMm);
    ctx.strokeText(trimmed, cx, cy);
  }
  ctx.fillText(trimmed, cx, cy);
}

/**
 * Remove o ponto de fechamento duplicado (primeiro == último) e vértices
 * colineares: eles não mudam o contorno, mas a triangulação das caps gera
 * triângulos de área zero (falha no validador de malha).
 */
function cleanLoop(pts: Point2D[]): Point2D[] {
  let out = pts;
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) out = out.slice(0, -1);
  }
  if (out.length < 4) return out;
  const kept = out.filter((p, i) => {
    const a = out[(i + out.length - 1) % out.length];
    const c = out[(i + 1) % out.length];
    const cross = (p.x - a.x) * (c.y - a.y) - (p.y - a.y) * (c.x - a.x);
    return Math.abs(cross) >= 2e-6;
  });
  return kept.length >= 3 ? kept : out;
}

/**
 * Constrói shapes a partir dos contornos, atribuindo cada furo apenas ao outer
 * imediatamente contido (menor área). Diferente de buildThreeShapes, que adiciona
 * o furo a todos os outers que o contêm e gera furos aninhados (não-manifold)
 * quando há anéis concêntricos (ex.: passador de fita com canal duplo).
 */
function buildMedalShapes(outerContours: Point2D[][], holesContours: Point2D[][]): THREE.Shape[] {
  const outers = outerContours.map(cleanLoop).filter((o) => o.length >= 3);
  const holes = holesContours.map(cleanLoop).filter((h) => h.length >= 3);
  const areas = outers.map((o) => Math.abs(polygonArea(o)));

  const shapes: THREE.Shape[] = outers.map((outer) => {
    const shape = new THREE.Shape();
    shape.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
    shape.closePath();
    return shape;
  });

  for (const hole of holes) {
    let best = -1;
    for (let i = 0; i < outers.length; i++) {
      if (!isPointInsidePolygon(hole[0], outers[i])) continue;
      if (best === -1 || areas[i] < areas[best]) best = i;
    }
    if (best === -1) continue;
    const holePath = new THREE.Path();
    holePath.moveTo(hole[0].x, hole[0].y);
    for (let j = 1; j < hole.length; j++) holePath.lineTo(hole[j].x, hole[j].y);
    holePath.closePath();
    shapes[best].holes.push(holePath);
  }

  return shapes;
}

function extrude(shapes: THREE.Shape[], depth: number, zOffset: number): THREE.ExtrudeGeometry | null {
  if (shapes.length === 0 || !(depth > 0)) return null;
  const geom = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
  if (zOffset !== 0) geom.translate(0, 0, zOffset);
  geom.computeVertexNormals();
  return geom;
}

function shapesFrom(imageData: ImageData, tolerance: number): THREE.Shape[] {
  const contours = extractContoursFromImageData(
    imageData,
    mmPerPixel,
    imageData.width / 2,
    imageData.height / 2,
    tolerance
  );
  return buildMedalShapes(contours.outer, contours.holes);
}

function makeCanvas(width: number, height: number): { ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');
  return { ctx };
}

export async function generateMedalModel(config: MedalConfig): Promise<GeneratedMedal> {
  const radiusMm = Math.max(1, config.diameter / 2);
  const bodyPts = bodyPolygon(config.bodyShape, radiusMm);
  const handle = computeHandleLayout(config, topYAtCenter(bodyPts), radiusMm, bodyPts);

  const extentTop = Math.max(radiusMm + PAD_MM, handle ? handle.cy + handle.outerR + PAD_MM : 0);
  const extent = Math.max(extentTop, radiusMm + PAD_MM);
  const canvasWidth = Math.ceil((radiusMm + PAD_MM) * 2 * pxPerMm);
  const canvasHeight = Math.ceil(extent * 2 * pxPerMm);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  const rimWidthMm = config.rimEnabled ? Math.max(0.1, config.rimWidth) : 0;
  const rimHeightMm = config.rimEnabled ? Math.max(0.1, config.rimHeight) : 0;
  const decorHeightMm = Math.max(0.2, config.artReliefHeight);
  const raioUtil = Math.max(4, radiusMm - (rimWidthMm > 0 ? rimWidthMm : 0) - 1);

  const family = config.fontFamily || 'Montserrat';
  const weight = fontWeightFor(family);
  const topSizeMm = Math.max(MIN_ARC_FONT_MM, config.topArcSize);
  const bottomSizeMm = Math.max(MIN_ARC_FONT_MM, config.bottomArcSize);
  const centerSizeMm = Math.max(MIN_ARC_FONT_MM, config.centerTextSize);

  try {
    if (!config.customFontName) await ensureGoogleFont(family);
    if (typeof document !== 'undefined' && document.fonts) {
      const px = Math.max(topSizeMm, bottomSizeMm, centerSizeMm) * pxPerMm;
      await document.fonts.load(`${px}px "${family}"`);
      await document.fonts.load(`${weight} ${px}px "${family}"`);
    }
  } catch {
    // fallback silencioso — padrão da ponteira
  }

  let artImage: CanvasImageSource | null = null;
  let artW = 0;
  let artH = 0;
  if (config.artUrl) {
    try {
      const trimmed = trimImageAlpha(await loadImage(config.artUrl));
      artImage = trimmed.src;
      artW = trimmed.width;
      artH = trimmed.height;
    } catch (err) {
      console.warn('Arte indisponível:', err);
    }
  }

  // --- 1) base: corpo − pegada da alça -------------------------------------
  const base = makeCanvas(canvasWidth, canvasHeight);
  base.ctx.fillStyle = '#000000';
  polygonPath(base.ctx, bodyPts, cx, cy);
  base.ctx.fill();
  eraseHandleFootprint(base.ctx, cx, cy, handle);
  const baseImg = base.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const baseShapes = shapesFrom(baseImg, 0.2);

  // --- 2) alça: pegada cheia − abertura ------------------------------------
  const handleCtx = makeCanvas(canvasWidth, canvasHeight).ctx;
  let handleShapes: THREE.Shape[] = [];
  if (handle) {
    const p = handleCanvasPoint(cx, cy, handle);
    handleCtx.fillStyle = '#000000';
    handleCtx.beginPath();
    handleCtx.arc(p.x, p.y, handle.outerR * pxPerMm, 0, TAU);
    handleCtx.fill();
    handleCtx.beginPath();
    gussetPath(handleCtx, p, handle);
    handleCtx.fill();
    punchHandleOpening(handleCtx, cx, cy, handle);
    const handleImg = handleCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    handleShapes = shapesFrom(handleImg, 0.2);
  }
  const handleImg = handleCtx.getImageData(0, 0, canvasWidth, canvasHeight);

  // --- 3) rim do disco -----------------------------------------------------
  const rimCtx = makeCanvas(canvasWidth, canvasHeight).ctx;
  if (rimWidthMm > 0 && rimHeightMm > 0) {
    rimCtx.save();
    polygonPath(rimCtx, bodyPts, cx, cy);
    rimCtx.clip();
    rimCtx.strokeStyle = '#000000';
    rimCtx.lineWidth = rimWidthMm * 2 * pxPerMm;
    rimCtx.lineJoin = 'round';
    rimCtx.stroke();
    rimCtx.restore();
    eraseHandleFootprint(rimCtx, cx, cy, handle);
  }
  const rimImg = rimCtx.getImageData(0, 0, canvasWidth, canvasHeight);

  // --- 4) rim da alça ------------------------------------------------------
  const handleRimCtx = makeCanvas(canvasWidth, canvasHeight).ctx;
  const wantsHandleRim = !!handle && rimWidthMm > 0 && rimHeightMm > 0 && config.rimCoverage === 'geral';
  if (handle && wantsHandleRim) {
    const p = handleCanvasPoint(cx, cy, handle);
    const outerPx = handle.outerR * pxPerMm;
    const innerLimitPx =
      handle.mode === 'furo-redondo'
        ? handle.holeR * pxPerMm
        : (Math.max(handle.slotW, handle.slotH) * pxPerMm) / 2;
    const wallMm = (outerPx - innerLimitPx) / pxPerMm;
    const bandMm = Math.max(0.4, Math.min(rimWidthMm, Math.max(0.4, wallMm / 3)));

    handleRimCtx.save();
    handleRimCtx.beginPath();
    handleRimCtx.arc(p.x, p.y, outerPx, 0, TAU);
    handleRimCtx.clip();
    handleRimCtx.fillStyle = '#000000';
    handleRimCtx.strokeStyle = '#000000';
    handleRimCtx.lineWidth = Math.max(1, bandMm * pxPerMm);

    if (config.rimHandleStyle === 'contorno') {
      handleRimCtx.beginPath();
      handleRimCtx.arc(p.x, p.y, outerPx - handleRimCtx.lineWidth / 2, 0, TAU);
      handleRimCtx.stroke();
    } else if (config.rimHandleStyle === 'macica') {
      handleRimCtx.beginPath();
      handleRimCtx.arc(p.x, p.y, outerPx, 0, TAU);
      handleRimCtx.fill();
      handleRimCtx.globalCompositeOperation = 'destination-out';
      handleRimCtx.beginPath();
      handleRimCtx.arc(p.x, p.y, outerPx - handleRimCtx.lineWidth, 0, TAU);
      handleRimCtx.fill();
      handleRimCtx.globalCompositeOperation = 'source-over';
    } else {
      handleRimCtx.beginPath();
      handleRimCtx.arc(p.x, p.y, outerPx - handleRimCtx.lineWidth / 2, 0, TAU);
      handleRimCtx.stroke();
      handleRimCtx.beginPath();
      handleRimCtx.arc(p.x, p.y, outerPx - handleRimCtx.lineWidth * 2.5, 0, TAU);
      handleRimCtx.stroke();
    }
    handleRimCtx.restore();
    punchHandleOpening(handleRimCtx, cx, cy, handle);
  }
  const handleRimImg = handleRimCtx.getImageData(0, 0, canvasWidth, canvasHeight);

  // --- 5) decor: texto + anéis + arte --------------------------------------
  const decorCtx = makeCanvas(canvasWidth, canvasHeight).ctx;
  const hasArt = !!artImage && artW > 0 && artH > 0;
  const centerOffsetY = hasArt ? radiusMm * 0.32 : 0;

  // A alça ocupa a faixa externa: o arco superior termina antes dela (AC MED-001).
  const topArcMax = handle ? handle.innerRadius - topSizeMm - 0.6 : Infinity;
  const topRadiusMm = Math.max(
    topSizeMm,
    Math.min((config.arcRadiusPct / 100) * raioUtil, raioUtil - topSizeMm, topArcMax)
  );
  const bottomRadiusMm = Math.max(bottomSizeMm, Math.min((config.arcRadiusPct / 100) * raioUtil, raioUtil));

  const paintText = (stroked: boolean) => {
    drawArcText(
      decorCtx,
      config.topText,
      cx,
      cy,
      topRadiusMm * pxPerMm,
      topSizeMm * pxPerMm,
      family,
      weight,
      'top',
      stroked
    );
    drawArcText(
      decorCtx,
      config.bottomText,
      cx,
      cy,
      bottomRadiusMm * pxPerMm,
      bottomSizeMm * pxPerMm,
      family,
      weight,
      'bottom',
      stroked
    );
    drawCenterText(
      decorCtx,
      config.centerText,
      cx,
      cy + centerOffsetY * pxPerMm,
      centerSizeMm * pxPerMm,
      family,
      weight,
      stroked
    );
  };

  paintText(false);
  const counterMask = computeEnclosedEmptyMask(decorCtx.getImageData(0, 0, canvasWidth, canvasHeight));

  decorCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  paintText(true);

  if (config.innerRingCount > 0 && config.innerRingWidth > 0) {
    decorCtx.strokeStyle = '#000000';
    decorCtx.lineWidth = Math.max(1, config.innerRingWidth * pxPerMm);
    const baseRadius = (config.innerRingRadiusPct / 100) * raioUtil;
    for (let i = 0; i < config.innerRingCount; i++) {
      const r = baseRadius * (1 - i * 0.14);
      if (r <= config.innerRingWidth) continue;
      decorCtx.beginPath();
      decorCtx.arc(cx, cy, r * pxPerMm, 0, TAU);
      decorCtx.stroke();
    }
  }

  if (hasArt) {
    const box = config.diameter * ART_DIAMETER_FRACTION * (config.artScale / 100);
    const scale = Math.min(box / artW, box / artH);
    const w = artW * scale;
    const h = artH * scale;
    decorCtx.drawImage(artImage as CanvasImageSource, cx - w / 2, cy - h / 2, w, h);
  }

  const decorImg = decorCtx.getImageData(0, 0, canvasWidth, canvasHeight);
  punchMask(decorImg, counterMask);
  decorCtx.putImageData(decorImg, 0, 0);

  if (rimWidthMm > 0 && rimHeightMm > 0) {
    decorCtx.save();
    decorCtx.globalCompositeOperation = 'destination-out';
    polygonPath(decorCtx, bodyPts, cx, cy);
    decorCtx.strokeStyle = '#000000';
    decorCtx.lineWidth = rimWidthMm * 2 * pxPerMm;
    decorCtx.lineJoin = 'round';
    decorCtx.stroke();
    decorCtx.restore();
  }
  eraseHandleFootprint(decorCtx, cx, cy, handle);

  const decorFinalImg = decorCtx.getImageData(0, 0, canvasWidth, canvasHeight);
  const decorShapes = shapesFrom(decorFinalImg, 0.15);

  // --- 6) extrudes ---------------------------------------------------------
  const safeBaseShapes = baseShapes.length > 0 ? baseShapes : decorShapes;
  const baseGeom = extrude(safeBaseShapes, config.baseThickness, 0);
  const handleGeom = handle && handleShapes.length > 0 ? extrude(handleShapes, config.handleThicknessZ, 0) : null;

  const reliefParts: THREE.BufferGeometry[] = [];
  const rimGeom = extrude(shapesFrom(rimImg, 0.2), rimHeightMm, config.baseThickness);
  if (rimGeom) reliefParts.push(rimGeom);
  const decorGeom = extrude(decorShapes, decorHeightMm, config.baseThickness);
  if (decorGeom) reliefParts.push(decorGeom);
  if (wantsHandleRim) {
    const handleRimGeom = extrude(shapesFrom(handleRimImg, 0.2), rimHeightMm, config.handleThicknessZ);
    if (handleRimGeom) reliefParts.push(handleRimGeom);
  }

  let reliefGeom: THREE.BufferGeometry | null = null;
  if (reliefParts.length === 1) reliefGeom = reliefParts[0];
  else if (reliefParts.length > 1) reliefGeom = BufferGeometryUtils.mergeGeometries(reliefParts, false);

  // --- 7) centralizar XY ---------------------------------------------------
  const all: THREE.BufferGeometry[] = [];
  if (baseGeom) all.push(baseGeom);
  if (handleGeom) all.push(handleGeom);
  if (reliefGeom) all.push(reliefGeom);

  const totalBox = new THREE.Box3();
  for (const g of all) {
    g.computeBoundingBox();
    if (g.boundingBox) totalBox.union(g.boundingBox);
  }
  const midX = (totalBox.min.x + totalBox.max.x) / 2;
  const midY = (totalBox.min.y + totalBox.max.y) / 2;
  for (const g of all) {
    g.translate(-midX, -midY, 0);
    g.computeBoundingBox();
  }

  const finalBox = new THREE.Box3();
  for (const g of all) {
    if (g.boundingBox) finalBox.union(g.boundingBox);
  }
  const size = new THREE.Vector3();
  finalBox.getSize(size);

  const mm2PerPx = mmPerPixel * mmPerPixel;
  const baseAreaMm2 = countSolidPixels(baseImg.data) * mm2PerPx;
  const handleAreaMm2 = countSolidPixels(handleImg.data) * mm2PerPx;
  const rimAreaMm2 = countSolidPixels(rimImg.data) * mm2PerPx;
  const decorAreaMm2 = countSolidPixels(decorFinalImg.data) * mm2PerPx;
  const volumeCm3 = Math.max(
    0.5,
    Number(
      (
        (baseAreaMm2 * config.baseThickness +
          handleAreaMm2 * config.handleThicknessZ +
          rimAreaMm2 * rimHeightMm +
          decorAreaMm2 * decorHeightMm) /
        1000
      ).toFixed(1)
    )
  );
  const weightGrams = Number((volumeCm3 * 1.24).toFixed(1));
  const printTimeMinutes = Math.max(8, Math.round(weightGrams * 2.8 + 8));

  const dimensions: Model3DDimensions = {
    dimX: Number(size.x.toFixed(1)),
    dimY: Number(size.y.toFixed(1)),
    dimZ: Number(size.z.toFixed(1)),
    volumeCm3,
    weightGrams,
    printTimeMinutes,
  };

  const handleColor = config.handleColorSync ? config.rimColor : config.handleColor;

  // Guarda: base vazia é impossível pela UI, mas cai num disco mínimo (design.md).
  const safeBaseGeom =
    baseGeom ??
    (() => {
      const g = new THREE.ExtrudeGeometry([buildBodyShape('redonda', 2)], { depth: config.baseThickness, bevelEnabled: false });
      g.translate(-midX, -midY, 0);
      return g;
    })();

  const baseMesh = new THREE.Mesh(
    safeBaseGeom,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.backgroundColor),
      roughness: 0.4,
      metalness: 0.06,
    })
  );
  baseMesh.name = '1_Base_da_Medalha';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const reliefMesh = reliefGeom
    ? new THREE.Mesh(
        reliefGeom,
        new THREE.MeshStandardMaterial({ color: new THREE.Color(config.rimColor), roughness: 0.28, metalness: 0.14 })
      )
    : undefined;
  if (reliefMesh) {
    reliefMesh.name = '2_Borda_e_Relevo';
    reliefMesh.castShadow = true;
    reliefMesh.receiveShadow = true;
  }

  const handleMesh = handleGeom
    ? new THREE.Mesh(
        handleGeom,
        new THREE.MeshStandardMaterial({ color: new THREE.Color(handleColor), roughness: 0.3, metalness: 0.12 })
      )
    : undefined;
  if (handleMesh) {
    handleMesh.name = '3_Passador_de_Fita';
    handleMesh.castShadow = true;
    handleMesh.receiveShadow = true;
  }

  return { baseMesh, reliefMesh, handleMesh, dimensions };
}
