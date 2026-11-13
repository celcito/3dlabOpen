import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GeneratedPenHolder, PenHolderConfig } from '../../types/penHolder';
import { buildThreeShapes, extractContoursFromImageData } from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';
import { signedVolume } from '../fastener/threads';
import { CUP_FLOOR_MIN, CUP_WALL_MIN, RIM_MIN } from './presets';
import { computeHolderMetrics, drawSilhouette, fixWinding, generatePenHolderModel } from './geometry';

const pxPerMm = 20;
const mmPerPixel = 1 / pxPerMm;
/** Sobreposição entre cascas (mm) — evita faces coincidentes sem precisar de CSG. */
const EMBED = 0.4;

/** Preenche contraformas (furos de a, e, o…) — fica só o contorno externo, sólido. */
function fillHoles(solid: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (!solid[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < solid.length; i++) if (!outside[i]) solid[i] = 1;
}

/** Distância ao fundo (chamfer 3-4): ~3 unidades por pixel. Serve para "encolher" a silhueta pela espessura da parede. */
function chamferDistance(solid: Uint8Array, w: number, h: number): Uint16Array {
  const INF = 60000;
  const d = new Uint16Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = solid[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Estende cada coluna para cima em `extraPx` (varredura vertical): o topo sobe, a base não muda. */
function raiseTop(solid: Uint8Array, w: number, h: number, extraPx: number): Uint8Array {
  const out = solid.slice();
  for (let x = 0; x < w; x++) {
    let since = Infinity; // linhas desde o último pixel sólido abaixo
    for (let y = h - 1; y >= 0; y--) {
      if (solid[y * w + x]) since = 0;
      else if (since !== Infinity) since++;
      if (since <= extraPx) out[y * w + x] = 1;
    }
  }
  return out;
}

function toImageData(solid: Uint8Array, w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  for (let i = 0; i < solid.length; i++) if (solid[i]) img.data[i * 4 + 3] = 255;
  return img;
}

/**
 * Células (compartimentos) alinhadas às letras: as aberturas seguem o contorno encolhido do nome,
 * separadas por divisórias nos vãos entre letras. Letras estreitas (l, i) são juntadas à vizinha
 * até a célula ter largura mínima para uma caneta.
 */
function planCells(
  occupied: Uint8Array, letterGapsPx: number[], dividerPx: number, minCellPx: number
): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x <= occupied.length; x++) {
    const on = x < occupied.length && occupied[x] === 1;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { runs.push([start, x]); start = -1; }
  }
  const cells: Array<[number, number]> = [];
  for (const [a, b] of runs) {
    const cuts = letterGapsPx.filter(g => g > a + dividerPx && g < b - dividerPx);
    let from = a;
    const segs: Array<[number, number]> = [];
    for (const g of cuts) {
      segs.push([from, Math.round(g - dividerPx / 2)]);
      from = Math.round(g + dividerPx / 2);
    }
    segs.push([from, b]);
    // junta segmentos estreitos com o vizinho (removendo a divisória entre eles)
    const merged: Array<[number, number]> = [];
    for (const s of segs) {
      const last = merged[merged.length - 1];
      if (last && last[1] - last[0] < minCellPx) last[1] = s[1];
      else merged.push([s[0], s[1]]);
    }
    if (merged.length > 1) {
      const last = merged[merged.length - 1];
      if (last[1] - last[0] < minCellPx) { merged[merged.length - 2][1] = last[1]; merged.pop(); }
    }
    for (const m of merged) if (m[1] - m[0] >= minCellPx * 0.8) cells.push(m);
  }
  return cells;
}

/**
 * Layout "extrusão do nome": o corpo é a silhueta 2D do nome (dilatada) extrudada em profundidade,
 * com o nome em relevo na face frontal (-Y). Por dentro, células abertas no topo seguem o contorno
 * das letras, separadas por divisórias. Espaço do fatiador: Z = altura, base em Z = 0.
 */
export async function generateNameTrayModel(config: PenHolderConfig): Promise<GeneratedPenHolder> {
  const text = config.text.trim() || 'Nome';
  const metrics = computeHolderMetrics(config);
  const L = Math.max(10, config.letterHeight);
  const fontPx = L * pxPerMm;

  try {
    if (!config.customFontName) await ensureGoogleFont(config.fontFamily);
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${fontPx}px "${config.fontFamily}"`);
      await document.fonts.load(`bold ${fontPx}px "${config.fontFamily}"`);
    }
  } catch {
    // fallback
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Falha ao inicializar Canvas 2D');

  const isDisplay = ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers', 'SEGA LOGO FONT'].includes(config.fontFamily);
  const fontStyle = `${isDisplay ? 'normal' : 'bold'} ${fontPx}px "${config.fontFamily}", sans-serif`;
  ctx.font = fontStyle;

  const spacingPx = Math.max(0, config.letterSpacing ?? 1.8) * pxPerMm;
  const offsets: number[] = [];
  let textWidthPx = 0;
  for (const ch of text) {
    offsets.push(textWidthPx);
    textWidthPx += ctx.measureText(ch).width + spacingPx;
  }
  textWidthPx -= spacingPx;

  const outlinePx = metrics.outlineMm * pxPerMm;
  const pad = Math.ceil(outlinePx * 2.5 + 28);
  const w = Math.ceil(textWidthPx + pad * 2);
  const extraMm = Math.max(0, config.extraHeight ?? 30);
  const extraPx = Math.round(extraMm * pxPerMm);
  const h = Math.ceil(fontPx + pad * 2 + extraPx * 2);
  canvas.width = w;
  canvas.height = h;
  const cx = w / 2;
  const cy = h / 2;
  const startX = cx - textWidthPx / 2;
  const baseline = cy + fontPx * 0.32;

  const draw = (strokePx: number): ImageData => {
    ctx.clearRect(0, 0, w, h);
    drawSilhouette(ctx, text, fontStyle, offsets, startX, baseline, strokePx);
    return ctx.getImageData(0, 0, w, h);
  };

  // 1) Silhueta externa sólida (nome dilatado, sem furos)
  const silData = draw(outlinePx * 2);
  const sil = new Uint8Array(w * h);
  for (let i = 0; i < sil.length; i++) sil[i] = silData.data[i * 4 + 3] > 120 ? 1 : 0;
  fillHoles(sil, w, h);
  // Corpo traseiro/células mais alto que a frente: o nome fica na altura normal, as paredes sobem para caber canetas.
  const tall = raiseTop(sil, w, h, extraPx);

  // 2) Nome fiel (com contraformas) para o relevo
  const name = extractContoursFromImageData(draw(1), mmPerPixel, cx, cy, 0.2);

  // 3) Células: contorno encolhido pela parede -> colunas ocupadas acima do fundo
  const wall = Math.max(CUP_WALL_MIN, config.wallThickness);
  const floor = Math.max(CUP_FLOOR_MIN, config.floorThickness);
  const wallPx = wall * pxPerMm;
  const dist = chamferDistance(tall, w, h);
  let bottomRow = 0;
  for (let y = h - 1; y >= 0 && !bottomRow; y--) {
    for (let x = 0; x < w; x++) if (tall[y * w + x]) { bottomRow = y; break; }
  }
  const floorLine = Math.max(0, Math.round(bottomRow - floor * pxPerMm));
  const occupied = new Uint8Array(w);
  for (let y = 0; y < floorLine; y++) {
    for (let x = 0; x < w; x++) if (dist[y * w + x] >= wallPx * 3) occupied[x] = 1;
  }
  const letterGaps = offsets.slice(1).map(o => startX + o - spacingPx / 2);
  const minCellPx = Math.max(4, config.minCellWidth ?? 10) * pxPerMm;
  const cells = planCells(occupied, letterGaps, wallPx, minCellPx);

  // 4) Miolo: silhueta menos as células (acima do fundo) = paredes + divisórias + fundo
  const core = tall.slice();
  for (const [a, b] of cells) {
    for (let y = 0; y < floorLine; y++) core.fill(0, y * w + a, y * w + b);
  }

  const depth = Math.max(config.trayDepth ?? L * 0.9, 2 * wall + 10);
  const rim = Math.max(RIM_MIN, config.rimThickness);
  const opts = { bevelEnabled: false, curveSegments: 12 } as const;
  const sample = (solid: Uint8Array) => extractContoursFromImageData(toImageData(solid, w, h), mmPerPixel, cx, cy, 0.2);
  const silC = sample(sil);
  const tallC = sample(tall);
  const coreC = sample(core);
  if (silC.outer.length === 0) throw new Error('Silhueta do nome vazia');

  // Camadas ao longo da profundidade t (t = 0 atrás; t = depth na frente); depois rotateX deixa o nome de pé.
  const layer = (shapes: THREE.Shape[], t0: number, len: number, holes: boolean) => {
    const g = new THREE.ExtrudeGeometry(shapes, { ...opts, depth: len });
    g.translate(0, 0, t0);
    if (holes) fixWinding(g);
    return g;
  };
  const back = layer(buildThreeShapes(tallC.outer, []), 0, wall, false);
  const front = layer(buildThreeShapes(silC.outer, []), depth - wall, wall, false);
  const body = layer(buildThreeShapes(coreC.outer, coreC.holes), wall - EMBED, depth - 2 * wall + 2 * EMBED, true);
  const relief = layer(buildThreeShapes(name.outer, name.holes), depth - EMBED, rim + EMBED, true);
  const all = [back, front, body, relief];
  for (const g of all) g.rotateX(Math.PI / 2);

  front.computeBoundingBox();
  const fb = front.boundingBox as THREE.Box3;
  const dx = -(fb.min.x + fb.max.x) / 2;
  const dz = -fb.min.z;
  for (const g of all) g.translate(dx, 0, dz);

  const corpoGeom = BufferGeometryUtils.mergeGeometries([back, front, body], false);
  if (!corpoGeom) throw new Error('Falha ao combinar as geometrias do corpo');

  const volumeMm3 = all.reduce((s, g) => s + signedVolume(g), 0);
  const volumeCm3 = Math.max(0.1, Number((volumeMm3 / 1000).toFixed(1)));
  const weightGrams = Number((volumeCm3 * 1.24).toFixed(1));

  corpoGeom.computeBoundingBox();
  relief.computeBoundingBox();
  const size = new THREE.Vector3();
  (corpoGeom.boundingBox as THREE.Box3).clone().union(relief.boundingBox as THREE.Box3).getSize(size);

  const mat = (color: string, roughness: number, metalness: number) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
  const corpoMesh = new THREE.Mesh(corpoGeom, mat(config.baseColor, 0.35, 0.08));
  corpoMesh.name = '1_Porta_Canetas_Nome';
  const rimMesh = new THREE.Mesh(relief, mat(config.reliefColor, 0.28, 0.12));
  rimMesh.name = '2_Nome_Relevo';
  for (const m of [corpoMesh, rimMesh]) { m.castShadow = true; m.receiveShadow = true; }

  return {
    corpoMesh,
    rimMesh,
    dimensions: {
      dimX: Number(size.x.toFixed(1)),
      dimY: Number(size.y.toFixed(1)),
      dimZ: Number(size.z.toFixed(1)),
      volumeCm3,
      weightGrams,
      printTimeMinutes: Math.max(12, Math.round(weightGrams * 2.8 + 8)),
      nameWidthMm: Number((fb.max.x - fb.min.x).toFixed(1)),
      bodyCount: cells.length,
      cavityMarginMm: Number(wall.toFixed(1)),
    },
  };
}

/** Ponto único de entrada: 'cup' = copo antigo (silhueta do nome); padrão = extrusão do nome com células. */
export function generatePenHolder(config: PenHolderConfig): Promise<GeneratedPenHolder> {
  return config.layout === 'cup' ? generatePenHolderModel(config) : generateNameTrayModel(config);
}
