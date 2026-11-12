import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GeneratedPenHolder, PenHolderConfig } from '../../types/penHolder';
import { buildThreeShapes, extractContoursFromImageData } from '../pencilTopper/contourExtractor';
import { ensureGoogleFont } from '../fonts/googleFonts';
import { signedVolume } from '../fastener/threads';
import { CUP_FLOOR_MIN, CUP_WALL_MIN, RIM_MIN } from './presets';

const pxPerMm = 20;
const mmPerPixel = 1 / pxPerMm;

/** Dilatação mínima da silhueta (mm) — abaixo disso a letra não "engorda" o suficiente. */
const MIN_OUTLINE_MM = 1.5;
/** Dilatação mínima da cavidade (mm) — garante canal interno mesmo com parede grossa. */
const MIN_CAVITY_MM = 0.6;
/** Parede mínima efetiva (mm) entre cavidade e exterior. */
const MIN_WALL_MM = 0.4;

export interface HolderMetrics {
  /** Dilatação efetiva da silhueta (mm), já com mínimos aplicados. */
  outlineMm: number;
  /** Dilatação da cavidade (mm) — silhouette erodida por dentro. */
  cavityDilation: number;
  /** Parede efetiva (mm) = outlineMm − cavityDilation ≥ MIN_WALL_MM. */
  cavityMarginMm: number;
  /** Altura das paredes entre piso e aro (mm). */
  freeHeight: number;
  /** True quando a parede pedida era maior que o contorno permite (cavidade limitada). */
  wallClamped: boolean;
}

/**
 * Métricas puras do extrude (testável em jsdom, sem canvas).
 * outline efetivo = max(1.5, outlineSize × fontWeightScale); cavidade = outline − parede,
 * com piso/teto de MIN_CAVITY_MM/MIN_WALL_MM para garantir peça válida em qualquer faixa.
 */
export function computeHolderMetrics(config: PenHolderConfig): HolderMetrics {
  const outlineMm = Math.max(MIN_OUTLINE_MM, config.outlineSize * (config.fontWeightScale || 1));
  const wall = Math.max(CUP_WALL_MIN, config.wallThickness);
  const floor = Math.max(CUP_FLOOR_MIN, config.floorThickness);
  const rim = Math.max(RIM_MIN, config.rimThickness);

  const desired = outlineMm - wall;
  const upper = Math.max(MIN_CAVITY_MM, outlineMm - MIN_WALL_MM);
  const cavityDilation = Math.min(Math.max(MIN_CAVITY_MM, desired), upper);
  const cavityMarginMm = outlineMm - cavityDilation;

  const freeHeight = Math.max(1, config.cupHeight - floor - rim);
  return {
    outlineMm,
    cavityDilation,
    cavityMarginMm,
    freeHeight,
    wallClamped: desired < MIN_CAVITY_MM,
  };
}

export function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontStyle: string,
  charOffsets: number[],
  textStartXPx: number,
  baselineYPx: number,
  lineWidthPx: number
): void {
  ctx.font = fontStyle;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lineWidthPx;
  for (let i = 0; i < text.length; i++) {
    const cx = textStartXPx + charOffsets[i];
    ctx.strokeText(text[i], cx, baselineYPx);
    ctx.fillText(text[i], cx, baselineYPx);
  }
}

/**
 * Corrige winding de uma malha fechada (padrão M3 do threeMfAnalyzer):
 * BFS pela orientação por aresta + sinal pelo volume assinado.
 * O `ExtrudeGeometry` com `holes` (cavidade do porta-canetas) emite faces de lado
 * dos furos com orientação trocada — o analisador reclamaria B4.
 * Trabalha com geometria non-indexed (padrão do ExtrudeGeometry).
 * Exportado para reuso (ex.: `lib/thermoform/geometry.ts`).
 */
export function fixWinding(geometry: THREE.BufferGeometry): void {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return;
  const vertexCount = posAttr.count;
  const faces = vertexCount / 3;
  if (!Number.isInteger(faces) || faces === 0) return;

  // Weld por posição exata + lista de faces (a, b, c) em IDs weldados.
  const weldMap = new Map<string, number>();
  const remap = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const key = `${posAttr.getX(i)},${posAttr.getY(i)},${posAttr.getZ(i)}`;
    let id = weldMap.get(key);
    if (id === undefined) {
      id = weldMap.size;
      weldMap.set(key, id);
    }
    remap[i] = id;
  }
  const vc = weldMap.size;

  const edgeCount = new Map<number, number>();
  const edgeDir = new Map<number, number>();
  const edgeFace = new Map<number, number>();
  const pairA: number[] = [];
  const pairB: number[] = [];
  const pairSame: number[] = [];
  for (let f = 0; f < faces; f++) {
    const a = remap[f * 3];
    const b = remap[f * 3 + 1];
    const c = remap[f * 3 + 2];
    const edges: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of edges) {
      const key = u < v ? u * vc + v : v * vc + u;
      const prev = edgeCount.get(key);
      if (prev === undefined) {
        edgeCount.set(key, 1);
        edgeDir.set(key, u < v ? 1 : -1);
        edgeFace.set(key, f);
      } else {
        edgeCount.set(key, prev + 1);
        if (prev === 1) {
          const dir = u < v ? 1 : -1;
          pairA.push(edgeFace.get(key)!);
          pairB.push(f);
          pairSame.push(edgeDir.get(key)! === dir ? 1 : 0);
        }
      }
    }
  }
  if (pairA.length === 0) return;

  // BFS por componente: face adjacente precisa percorrer a aresta compartilhada
  // em direção oposta (same=1 ⇒ uma das duas precisa virar).
  const flip = new Uint8Array(faces);
  const adj: number[][] = Array.from({ length: faces }, () => []);
  for (let k = 0; k < pairA.length; k++) {
    adj[pairA[k]].push(k);
    adj[pairB[k]].push(k);
  }
  const visited = new Uint8Array(faces);
  for (let seed = 0; seed < faces; seed++) {
    if (visited[seed]) continue;
    visited[seed] = 1;
    flip[seed] = 0;
    const queue = [seed];
    while (queue.length) {
      const current = queue.pop()!;
      for (const k of adj[current]) {
        const other = pairA[k] === current ? pairB[k] : pairA[k];
        if (visited[other]) continue;
        visited[other] = 1;
        flip[other] = flip[current] ^ pairSame[k];
        queue.push(other);
      }
    }
  }

  // Sinal global pelo volume assinado (antes de aplicar flips).
  let volume = 0;
  for (let f = 0; f < faces; f++) {
    const ax = posAttr.getX(f * 3);
    const ay = posAttr.getY(f * 3);
    const az = posAttr.getZ(f * 3);
    const bx = posAttr.getX(f * 3 + 1);
    const by = posAttr.getY(f * 3 + 1);
    const bz = posAttr.getZ(f * 3 + 1);
    const cx = posAttr.getX(f * 3 + 2);
    const cy = posAttr.getY(f * 3 + 2);
    const cz = posAttr.getZ(f * 3 + 2);
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  if (volume < 0) for (let f = 0; f < faces; f++) flip[f] = flip[f] ? 0 : 1;

  // Aplica os flips: em non-indexed, virar a face = trocar os vértices 1 e 2 do buffer.
  let changed = 0;
  for (let f = 0; f < faces; f++) {
    if (!flip[f]) continue;
    changed++;
    const i1 = (f * 3 + 1) * 3;
    const i2 = (f * 3 + 2) * 3;
    for (let k = 0; k < 3; k++) {
      const tmp = posAttr.array[i1 + k];
      posAttr.array[i1 + k] = posAttr.array[i2 + k];
      posAttr.array[i2 + k] = tmp;
    }
  }
  if (changed > 0) {
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}

export interface PenHolderShellGeometries {
  floorGeom: THREE.BufferGeometry;
  wallsGeom: THREE.BufferGeometry;
  rimGeom: THREE.BufferGeometry;
  nameWidthMm: number;
  /** Quantas cascas disjuntas a silhueta gerou (letras separadas = peças separadas). */
  bodyCount: number;
}

/**
 * Constrói as 3 cascas do extrude no espaço do fatiador (Z = altura, minZ = 0).
 * - Footprint: silhueta dilatada por outlineMm, contraformas preenchidas (sem punchMask).
 * - Cavidade: mesma silhueta dilatada menos (parede) → holes do footprint.
 * - Piso (sólido) + paredes (anel) + aro colorido (anel, cor 2) empilhados em Z.
 */
export async function buildPenHolderShellGeometries(
  config: PenHolderConfig
): Promise<PenHolderShellGeometries> {
  const text = config.text.trim() || 'Nome';
  const metrics = computeHolderMetrics(config);
  const targetFontHeightPx = Math.max(10, config.letterHeight) * pxPerMm;

  try {
    if (!config.customFontName) await ensureGoogleFont(config.fontFamily);
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${targetFontHeightPx}px "${config.fontFamily}"`);
      await document.fonts.load(`bold ${targetFontHeightPx}px "${config.fontFamily}"`);
    }
  } catch {
    // fallback
  }

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Falha ao inicializar Canvas 2D');

  // SEGA LOGO FONT tem um único peso; bold sintético engrossa os traços e fecha os filetes internos do logo.
  const isCursiveOrDisplay = ['Pacifico', 'Lobster', 'Dancing Script', 'Chewy', 'Bangers', 'SEGA LOGO FONT'].includes(config.fontFamily);
  const fontWeight = isCursiveOrDisplay ? 'normal' : 'bold';
  const fontStyle = `${fontWeight} ${targetFontHeightPx}px "${config.fontFamily}", sans-serif`;
  mctx.font = fontStyle;

  const letterSpacingPx = Math.max(0.0, config.letterSpacing ?? 1.8) * pxPerMm;
  let textWidthPx = 0;
  const charOffsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    charOffsets.push(textWidthPx);
    textWidthPx += mctx.measureText(text[i]).width + letterSpacingPx;
  }
  if (text.length > 0) textWidthPx -= letterSpacingPx;

  const outlinePx = metrics.outlineMm * pxPerMm;
  const cavityPx = metrics.cavityDilation * pxPerMm;

  const paddingPx = Math.ceil(outlinePx * 2.5 + 28);
  const canvasWidth = Math.ceil(textWidthPx + paddingPx * 2);
  const canvasHeight = Math.ceil(targetFontHeightPx + paddingPx * 2);

  const drawCanvas = document.createElement('canvas');
  drawCanvas.width = canvasWidth;
  drawCanvas.height = canvasHeight;
  const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Erro ao inicializar contexto 2D');

  const centerX = canvasWidth / 2;
  const centerYCanvas = canvasHeight / 2;
  const textStartXPx = centerX - textWidthPx / 2;
  const textBaselineY = centerYCanvas + targetFontHeightPx * 0.32;

  // 1) Footprint: silhueta dilatada, SEM punchMask (contraformas preenchidas = cavidade única).
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  drawSilhouette(ctx, text, fontStyle, charOffsets, textStartXPx, textBaselineY, outlinePx * 2);
  const footprintData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const footprintContours = extractContoursFromImageData(footprintData, mmPerPixel, centerX, centerYCanvas, 0.2);
  const footprintOuter = footprintContours.outer;
  if (footprintOuter.length === 0) throw new Error('Silhueta do nome vazia');

  // 2) Cavidade: mesma silhueta com dilatação menor (outline − parede), sem contraformas.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  drawSilhouette(ctx, text, fontStyle, charOffsets, textStartXPx, textBaselineY, cavityPx * 2);
  const cavityData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const cavityContours = extractContoursFromImageData(cavityData, mmPerPixel, centerX, centerYCanvas, 0.2);

  // 3) Shapes: piso = footprint sólido; paredes/aro = footprint com cavidade como hole.
  const floorShapes = buildThreeShapes(footprintOuter, []);
  const wallShapes = buildThreeShapes(footprintOuter, cavityContours.outer);
  if (floorShapes.length === 0) throw new Error('Falha ao construir contornos do porta-canetas');

  const floor = Math.max(CUP_FLOOR_MIN, config.floorThickness);
  const rim = Math.min(Math.max(RIM_MIN, config.rimThickness), Math.max(RIM_MIN, config.cupHeight - floor - 1));
  const freeHeight = metrics.freeHeight;

  // 4) Extrusões (sem bevel: casca limpa, sem balanço).
  // Embed: as paredes descem 0.4 mm dentro do piso. Sem isso, piso e paredes
  // compartilhariam exatamente os mesmos vértices no plano de contato — o fatiador
  // solda as 2 cascas em arestas com 4 faces (não-manifold, B2/B4 no analisador).
  // Com o embed, os vértices não coincidem e cada casca fecha sozinha; o merge
  // fica com sobreposição volumétrica de 0.4 mm (mesmo princípio do copo embutido
  // da Rodada 1, D5/D10 — sem CSG).
  const EMBED = 0.4;
  const floorGeom = new THREE.ExtrudeGeometry(floorShapes, {
    depth: floor,
    bevelEnabled: false,
    curveSegments: 12,
  });
  const wallsGeom = new THREE.ExtrudeGeometry(wallShapes, {
    depth: freeHeight + EMBED,
    bevelEnabled: false,
    curveSegments: 12,
  });
  const rimGeom = new THREE.ExtrudeGeometry(wallShapes, {
    depth: rim,
    bevelEnabled: false,
    curveSegments: 12,
  });
  wallsGeom.translate(0, 0, floor - EMBED);
  rimGeom.translate(0, 0, floor + freeHeight);
  // ExtrudeGeometry com holes emite faces de lado dos furos com winding trocado (B4).
  fixWinding(wallsGeom);
  fixWinding(rimGeom);

  // 5) Alinhamento: centro X/Y = 0, base em minZ = 0 (as 3 cascas compartilham o footprint).
  floorGeom.computeBoundingBox();
  const box = floorGeom.boundingBox || new THREE.Box3();
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const minZ = box.min.z;
  floorGeom.translate(-cx, -cy, -minZ);
  wallsGeom.translate(-cx, -cy, -minZ);
  rimGeom.translate(-cx, -cy, -minZ);

  floorGeom.computeBoundingBox();
  const aligned = floorGeom.boundingBox || new THREE.Box3();
  const nameWidthMm = Number((aligned.max.x - aligned.min.x).toFixed(1));

  return { floorGeom, wallsGeom, rimGeom, nameWidthMm, bodyCount: footprintOuter.length };
}

export async function generatePenHolderModel(config: PenHolderConfig): Promise<GeneratedPenHolder> {
  const { floorGeom, wallsGeom, rimGeom, nameWidthMm, bodyCount } =
    await buildPenHolderShellGeometries(config);

  // Merge do corpo (piso + paredes) em uma única malha/cor; aro fica isolado (cor 2).
  const corpoGeom = BufferGeometryUtils.mergeGeometries([floorGeom, wallsGeom], false);
  if (!corpoGeom) throw new Error('Falha ao combinar as geometrias do corpo');

  const metrics = computeHolderMetrics(config);

  // Dimensões por volume assinado das cascas (D9).
  const volumeMm3 = signedVolume(floorGeom) + signedVolume(wallsGeom) + signedVolume(rimGeom);
  const volumeCm3 = Math.max(0.1, Number((volumeMm3 / 1000).toFixed(1)));
  const weightGrams = Number((volumeCm3 * 1.24).toFixed(1));
  const printTimeMinutes = Math.max(12, Math.round(weightGrams * 2.8 + 8));

  corpoGeom.computeBoundingBox();
  rimGeom.computeBoundingBox();
  const totalBox = (corpoGeom.boundingBox || new THREE.Box3())
    .clone()
    .union(rimGeom.boundingBox || new THREE.Box3());
  const size = new THREE.Vector3();
  totalBox.getSize(size);

  const dimensions = {
    dimX: Number(size.x.toFixed(1)),
    dimY: Number(size.y.toFixed(1)),
    dimZ: Number(size.z.toFixed(1)),
    volumeCm3,
    weightGrams,
    printTimeMinutes,
    nameWidthMm,
    bodyCount,
    cavityMarginMm: Number(metrics.cavityMarginMm.toFixed(1)),
  };

  const corpoMesh = new THREE.Mesh(
    corpoGeom,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.baseColor),
      roughness: 0.35,
      metalness: 0.08,
    })
  );
  corpoMesh.name = '1_Porta_Canetas_Nome';
  corpoMesh.castShadow = true;
  corpoMesh.receiveShadow = true;

  const rimMesh = new THREE.Mesh(
    rimGeom,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.reliefColor),
      roughness: 0.28,
      metalness: 0.12,
    })
  );
  rimMesh.name = '2_Aro_Colorido';
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;

  return { corpoMesh, rimMesh, dimensions };
}
