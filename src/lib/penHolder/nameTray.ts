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
/** Sobreposição entre cascas (mm) — evita faces coincidentes/não-manifold sem CSG. */
const EMBED = 0.4;

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/**
 * Layout "placa + bandeja": o nome fica de pé na frente (-Y), com aro de relevo colorido na face frontal,
 * e uma bandeja com divisórias atrás (+Y). Espaço do fatiador: Z = altura, base em Z = 0.
 */
export async function generateNameTrayModel(config: PenHolderConfig): Promise<GeneratedPenHolder> {
  const text = config.text.trim() || 'Nome';
  const metrics = computeHolderMetrics(config);
  const fontPx = Math.max(10, config.letterHeight) * pxPerMm;

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
  canvas.width = Math.ceil(textWidthPx + pad * 2);
  canvas.height = Math.ceil(fontPx + pad * 2);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const startX = cx - textWidthPx / 2;
  const baseline = cy + fontPx * 0.32;

  const read = (strokePx: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSilhouette(ctx, text, fontStyle, offsets, startX, baseline, strokePx);
    return extractContoursFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), mmPerPixel, cx, cy, 0.2);
  };
  const footprint = read(outlinePx * 2); // silhueta dilatada, contraformas preenchidas
  const name = read(1); // nome fiel, com contraformas (a, e, o…)
  if (footprint.outer.length === 0) throw new Error('Silhueta do nome vazia');

  const plateDepth = config.plateDepth ?? 8;
  const rim = Math.max(RIM_MIN, config.rimThickness);
  const wall = Math.max(CUP_WALL_MIN, config.wallThickness);
  const floor = Math.max(CUP_FLOOR_MIN, config.floorThickness);
  const trayDepth = config.trayDepth ?? 40;
  const trayHeight = config.trayHeight ?? 90;
  const frontH = Math.min(config.frontWallHeight ?? 20, trayHeight);
  const n = Math.max(1, Math.round(config.compartments ?? 4));

  // Placa do nome e relevo: extrude em Z e depois deitado (rotateX) para o nome ficar de pé, lendo de -Y.
  const plate = new THREE.ExtrudeGeometry(buildThreeShapes(footprint.outer, []), {
    depth: plateDepth, bevelEnabled: false, curveSegments: 12,
  });
  const relief = new THREE.ExtrudeGeometry(buildThreeShapes(name.outer, name.holes), {
    depth: rim + EMBED, bevelEnabled: false, curveSegments: 12,
  });
  relief.translate(0, 0, plateDepth - EMBED);
  fixWinding(relief);
  plate.rotateX(Math.PI / 2);
  relief.rotateX(Math.PI / 2);

  plate.computeBoundingBox();
  const pb = plate.boundingBox as THREE.Box3;
  const dx = -(pb.min.x + pb.max.x) / 2;
  const dz = -pb.min.z;
  plate.translate(dx, 0, dz);
  relief.translate(dx, 0, dz);
  const width = pb.max.x - pb.min.x;
  const x0 = -width / 2;
  const x1 = width / 2;

  const inner = width - 2 * wall;
  const parts: THREE.BufferGeometry[] = [
    plate,
    box(x0, x1, -EMBED, trayDepth, 0, floor), // fundo
    box(x0, x1, -EMBED, wall, floor - EMBED, frontH), // parede frontal baixa
    box(x0, x1, trayDepth - wall, trayDepth, floor - EMBED, trayHeight), // parede traseira
    box(x0, x0 + wall, -EMBED, trayDepth, floor - EMBED, trayHeight), // lateral esq.
    box(x1 - wall, x1, -EMBED, trayDepth, floor - EMBED, trayHeight), // lateral dir.
  ];
  for (let i = 1; i < n; i++) {
    const x = x0 + wall + (inner * i) / n - wall / 2;
    parts.push(box(x, x + wall, wall - EMBED, trayDepth - wall + EMBED, floor - EMBED, trayHeight * (i % 2 ? 0.7 : 0.85)));
  }

  const corpoGeom = BufferGeometryUtils.mergeGeometries(parts, false);
  if (!corpoGeom) throw new Error('Falha ao combinar as geometrias do corpo');

  const volumeMm3 = parts.reduce((s, g) => s + signedVolume(g), 0) + signedVolume(relief);
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
      nameWidthMm: Number(width.toFixed(1)),
      bodyCount: footprint.outer.length,
      cavityMarginMm: Number(wall.toFixed(1)),
    },
  };
}

/** Ponto único de entrada: 'cup' = copo antigo (silhueta do nome); padrão = placa + bandeja. */
export function generatePenHolder(config: PenHolderConfig): Promise<GeneratedPenHolder> {
  return config.layout === 'cup' ? generatePenHolderModel(config) : generateNameTrayModel(config);
}
