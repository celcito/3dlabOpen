import * as THREE from 'three';
import type {
  GeneratedThermoformKit,
  ThermoformConfig,
  ThermoformPartBuild,
  ThermoformPartId,
} from '../../types/thermoform';
import { fixWinding } from '../penHolder/geometry';
import {
  bboxOfRings,
  clampErosionMax,
  offsetOutline,
  outlineFromPathData,
  polygonArea,
  resolveOutline,
  ringPerimeter,
  samplePerimeter,
  type ThermoformOutline,
} from './outlines';
import { activeStemPathData, getPreset } from './presets';

/** EMBED casca×casca (mm) — mesmo valor do porta-canetas (STATE 2026-10-13). */
const EMBED = 0.4;
const LOFT_SECTIONS = 16;
const LAYOUT_MARGIN = 10;

function ensureCcw(ring: number[][]): number[][] {
  return polygonArea(ring) < 0 ? [...ring].reverse() : ring;
}

export function outlineToShape(outline: ThermoformOutline): THREE.Shape | null {
  if (outline.outer.length < 3) return null;
  const shape = new THREE.Shape(ensureCcw(outline.outer).map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of outline.holes) {
    if (hole.length < 3) continue;
    // Furos em orientação oposta à externa.
    const ring = polygonArea(hole) > 0 ? [...hole].reverse() : hole;
    shape.holes.push(new THREE.Path(ring.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  return shape;
}

/** Extrusão fechada (cascas com furo passam por `fixWinding`). */
export function extrudeOutline(outline: ThermoformOutline, height: number): THREE.BufferGeometry | null {
  const shape = outlineToShape(outline);
  if (!shape || height <= 0) return null;
  const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geom.computeVertexNormals();
  if (outline.holes.length > 0) fixWinding(geom);
  return geom;
}

function outlineToPoly(outline: ThermoformOutline): ThermoformOutline {
  return { outer: outline.outer, holes: [] };
}

/** Reamostra um ring fechado em `count` pontos uniformes por comprimento de arco (CCW). */
function resampleRing(ring: number[][], count: number): number[][] {
  const ccw = ensureCcw(ring);
  const n = ccw.length;
  const out: number[][] = [];
  if (n < 3 || count < 3) return ccw;

  // Cumsum de arco com ponto final = primeiro (fechado).
  const xs: number[] = [ccw[0][0]];
  const ys: number[] = [ccw[0][1]];
  const cum: number[] = [0];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % n];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    xs.push(b[0]);
    ys.push(b[1]);
    cum.push(total);
  }
  if (total <= 1e-9) return ccw;

  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (seg < cum.length - 2 && cum[seg + 1] < target) seg++;
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 1e-12 ? (target - cum[seg]) / segLen : 0;
    out.push([xs[seg] + (xs[seg + 1] - xs[seg]) * t, ys[seg] + (ys[seg + 1] - ys[seg]) * t]);
  }

  // Quebra pontos colineares exatos (amostragem sobre segmentos retos) —
  // ear-clipping geraria faces de área 0 nos caps do loft.
  const m = out.length;
  // EPS acima da precisão float32 do STL (~7e-6 mm em |xy|≈55) — pontos a
  // ~1e-4 mm da reta colapsam para colinearidade exata na exportação.
  const COLLINEAR_EPS = 1e-3;
  const NUDGE = 1e-3;
  for (let i = 0; i < m; i++) {
    const a = out[(i - 1 + m) % m];
    const b = out[i];
    const c = out[(i + 1) % m];
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    const cross = (b[0] - a[0]) * dy - (b[1] - a[1]) * dx;
    if (Math.abs(cross) / len < COLLINEAR_EPS) {
      // Sinal alternado: trechos retos longos têm vários pontos colineares
      // seguidos — mesmo deslocamento manteria o zig-zag colinear.
      const dir = i % 2 === 0 ? 1 : -1;
      b[0] += ((dy / len) * NUDGE) * dir;
      b[1] += ((-dx / len) * NUDGE) * dir;
    }
  }
  return out;
}

function capIndices(contour: number[][]): { positions: number[][]; indices: number[] } {
  const ccw = ensureCcw(contour);
  const contourVecs = ccw.map(([x, y]) => new THREE.Vector2(x, y));
  const faces = THREE.ShapeUtils.triangulateShape(contourVecs, []);
  const positions = ccw.map(([x, y]) => [x, y] as number[]);
  const indices: number[] = [];
  for (const f of faces) indices.push(f[0], f[1], f[2]);
  return { positions, indices };
}

/**
 * Sólido fechado por loft: seções (rings já reamostrados no mesmo M) + caps.
 * Normais para fora (rings CCW, strip subindo +Z).
 */
export function buildLoftSolid(sections: number[][][], zHeights: number[]): THREE.BufferGeometry | null {
  if (sections.length < 2) return null;
  const m = sections[0].length;
  if (m < 3) return null;
  if (sections.some((s) => s.length !== m)) return null;

  const positions: number[] = [];
  const indices: number[] = [];

  // Vértices das seções (em z).
  for (let k = 0; k < sections.length; k++) {
    const z = zHeights[k];
    for (const [x, y] of sections[k]) positions.push(x, y, z);
  }
  const base = (k: number, i: number) => k * m + (i % m);

  // Strip entre seções consecutivas.
  for (let k = 0; k < sections.length - 1; k++) {
    for (let i = 0; i < m; i++) {
      const a = base(k, i);
      const a2 = base(k, i + 1);
      const b = base(k + 1, i);
      const b2 = base(k + 1, i + 1);
      indices.push(a, a2, b2, a, b2, b);
    }
  }

  // Cap inferior (normal −Z ⇒ winding invertido) e superior (+Z).
  const bottom = capIndices(sections[0]);
  const bottomOffset = positions.length / 3;
  for (const [x, y] of bottom.positions) positions.push(x, y, zHeights[0]);
  for (let i = 0; i < bottom.indices.length; i += 3) {
    indices.push(bottomOffset + bottom.indices[i], bottomOffset + bottom.indices[i + 2], bottomOffset + bottom.indices[i + 1]);
  }

  const top = capIndices(sections[sections.length - 1]);
  const topOffset = positions.length / 3;
  for (const [x, y] of top.positions) positions.push(x, y, zHeights[zHeights.length - 1]);
  for (let i = 0; i < top.indices.length; i += 3) {
    indices.push(topOffset + top.indices[i], topOffset + top.indices[i + 1], topOffset + top.indices[i + 2]);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Razão de erosão do domo: preset ou padrão 10% para SVG custom. */
function domeErosionRatio(config: ThermoformConfig): number {
  if (config.svgPathData) return 0.1;
  return getPreset(config.preset).maxErosionRatio;
}

/** Mold: laje + domo puffy (loft erodido, com EMBED na laje). */
export function buildMold(outline: ThermoformOutline, config: ThermoformConfig): THREE.BufferGeometry[] {
  const geoms: THREE.BufferGeometry[] = [];
  const slab = extrudeOutline(outline, config.baseThickness);
  if (slab) geoms.push(slab);

  const poly = outlineToPoly(outline);
  const deltaMax = clampErosionMax(poly, config.sizeMm, domeErosionRatio(config));
  if (deltaMax <= 0.05 || config.domeHeight <= 0) return geoms;

  const z0 = config.baseThickness - EMBED;
  const zTop = config.baseThickness + config.domeHeight;
  const sections: number[][][] = [];
  const zHeights: number[] = [];
  const baseRing = ensureCcw(poly.outer);

  for (let k = 0; k <= LOFT_SECTIONS; k++) {
    const t = k / LOFT_SECTIONS;
    // Perfil hemisférico: δ=0 na base (flush com a laje, parede vertical),
    // δmax no topo com tangente horizontal (ápice arredondado). A fórmula
    // √(1−t²) direta inverte o domo (funil com undercut).
    const delta = deltaMax * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    let ring: number[][];
    if (k === 0) {
      ring = baseRing;
    } else {
      const eroded = offsetOutline(poly, -delta);
      if (!eroded || eroded.outer.length < 3) break;
      ring = eroded.outer;
    }
    sections.push(resampleRing(ring, Math.max(64, baseRing.length * 2)));
    zHeights.push(z0 + (zTop - z0) * t);
    if (k === LOFT_SECTIONS) break;
  }

  if (sections.length >= 2) {
    const dome = buildLoftSolid(sections, zHeights);
    if (dome) geoms.push(dome);
  }
  return geoms;
}

/** Press: anel com flange (flange largo + parede estreita embutida). */
export function buildPress(outline: ThermoformOutline, config: ThermoformConfig): THREE.BufferGeometry[] {
  const geoms: THREE.BufferGeometry[] = [];

  const flangeOuter = offsetOutline(outlineToPoly(outline), config.flangeThickness);
  if (flangeOuter) {
    const flange = extrudeOutline({ outer: flangeOuter.outer, holes: [outline.outer] }, config.flangeThickness);
    if (flange) geoms.push(flange);
  }

  const wallOuter = offsetOutline(outlineToPoly(outline), config.ringWallThickness);
  if (wallOuter) {
    // Parede embutida EMBED na flange; topo = flange + ringHeight.
    const wallHeight = config.ringHeight + EMBED;
    const wall = extrudeOutline({ outer: wallOuter.outer, holes: [outline.outer] }, wallHeight);
    if (wall) {
      wall.translate(0, 0, config.flangeThickness - EMBED);
      geoms.push(wall);
    }
  }
  return geoms;
}

/** Folha: piso + aro embutido (duas cascas fechadas no mesmo objeto). */
export function buildSheet(outline: ThermoformOutline, config: ThermoformConfig): THREE.BufferGeometry[] {
  const geoms: THREE.BufferGeometry[] = [];
  const floor = extrudeOutline(outline, config.floorThickness);
  if (floor) geoms.push(floor);

  const rimInner = offsetOutline(outlineToPoly(outline), -config.rimWidth);
  if (rimInner && rimInner.outer.length >= 3) {
    const rimHeight = config.rimHeight + EMBED;
    const rim = extrudeOutline({ outer: outline.outer, holes: [rimInner.outer] }, rimHeight);
    if (rim) {
      rim.translate(0, 0, config.floorThickness - EMBED);
      geoms.push(rim);
    }
  }
  return geoms;
}

/**
 * Perfil em U (planta) de um clipe: barra `clipThickness`, fala `clipGap × (W − t)`,
 * boca voltada para +y local. Contorno único (sem furo — a fala é aberta).
 */
function clipProfile(config: ThermoformConfig): number[][] {
  const L = config.clipLength;
  const W = config.clipWidth;
  const t = Math.min(config.clipThickness, W / 2);
  const g = Math.min(config.clipGap, L - 2 * Math.min(1, t));
  const hw = L / 2;
  const hg = g / 2;
  // CCW em y-up.
  return [
    [-hw, 0],
    [hw, 0],
    [hw, W],
    [hg, W],
    [hg, t],
    [-hg, t],
    [-hg, W],
    [-hw, W],
  ];
}

/** Encaixes: clipes em U ao longo do perímetro, boca para fora, fala centrada na borda. */
export function buildClips(
  outline: ThermoformOutline,
  config: ThermoformConfig,
  opts?: { bottomOnly?: boolean }
): THREE.BufferGeometry[] {
  if (config.clipCount <= 0) return [];
  const profile = clipProfile(config);
  const total = ringPerimeter(outline.outer);
  let samples = samplePerimeter(
    outline.outer,
    Math.max(config.clipLength * 2, total / (config.clipCount + 1))
  );
  if (opts?.bottomOnly) {
    const box = bboxOfRings([outline.outer]);
    const cutoff = box.minY + 0.45 * (box.maxY - box.minY);
    samples = samples.filter((s) => s.y < cutoff);
  }
  if (samples.length === 0) return [];

  // Escolhe clipCount amostras o mais uniformes possível.
  const chosen: typeof samples = [];
  const stride = samples.length / config.clipCount;
  for (let i = 0; i < config.clipCount; i++) {
    const idx = Math.min(samples.length - 1, Math.floor(i * stride + stride / 2));
    chosen.push(samples[idx]);
  }

  // Centro do clipe: fala centrada na borda (y local do centro da fala → 0).
  const slotDepth = Math.max(0.2, config.clipWidth - config.clipThickness);
  const yCenter = config.clipThickness + slotDepth / 2;

  const geoms: THREE.BufferGeometry[] = [];
  for (const s of chosen) {
    const ring: number[][] = profile.map(([xl, yl]) => {
      const y = yl - yCenter;
      // x ao longo da tangente t̂ = (−ny, nx); y ao longo da normal n̂.
      return [s.x + xl * -s.ny + y * s.nx, s.y + xl * s.nx + y * s.ny];
    });
    const geom = extrudeOutline({ outer: ring, holes: [] }, config.clipThickness);
    if (geom) geoms.push(geom);
  }
  return geoms;
}

/** Altura do cabo/talo como fração do sizeMm. */
const STEM_HEIGHT_RATIO = 0.28;

/**
 * Cabo da fruta: perfil U (mesmas dims dos clipes) ancorado no topo do perímetro
 * + silhueta do talo extrudada para fora do U — duas cascas fechadas (EMBED).
 */
export function buildStem(
  outline: ThermoformOutline,
  config: ThermoformConfig,
  stemPathData: string
): THREE.BufferGeometry[] {
  const geoms: THREE.BufferGeometry[] = [];
  const total = ringPerimeter(outline.outer);
  const samples = samplePerimeter(outline.outer, Math.max(config.clipLength, total / 24));
  if (samples.length === 0) return geoms;

  // Amostra mais alta (max y) = topo da fruta.
  let top = samples[0];
  for (const s of samples) if (s.y > top.y) top = s;

  // Cascas 1: slot U idêntico aos clipes, posicionado no topo com boca para fora.
  const profile = clipProfile(config);
  const slotDepth = Math.max(0.2, config.clipWidth - config.clipThickness);
  const yCenter = config.clipThickness + slotDepth / 2;
  const slotRing = profile.map(([xl, yl]) => {
    const y = yl - yCenter;
    return [top.x + xl * -top.ny + y * top.nx, top.y + xl * top.nx + y * top.ny];
  });
  const slotGeom = extrudeOutline({ outer: slotRing, holes: [] }, config.clipThickness);
  if (slotGeom) geoms.push(slotGeom);

  // Cascas 2: silhueta do talo, ponta alinhada à normal externa do topo.
  const stemSpan = config.sizeMm * STEM_HEIGHT_RATIO;
  const stemOutline = outlineFromPathData(stemPathData, stemSpan);
  if (stemOutline) {
    const stemBox = bboxOfRings([stemOutline.outer]);
    const stemHeight = stemBox.maxY - stemBox.minY;
    if (stemHeight > 1e-6) {
      const cx = (stemBox.minX + stemBox.maxX) / 2;
      const cy = (stemBox.minY + stemBox.maxY) / 2;

      // Base do talo: face externa do U menos EMBED (talo embutido no U).
      const outerFace = config.clipWidth - yCenter;
      const baseX = top.x + (outerFace - EMBED) * top.nx;
      const baseY = top.y + (outerFace - EMBED) * top.ny;
      const centerX = baseX + (stemHeight / 2) * top.nx;
      const centerY = baseY + (stemHeight / 2) * top.ny;

      // Rotação que leva (0,1) do talo (ponta pós y-flip) para n̂ do topo.
      const theta = Math.atan2(-top.nx, top.ny);
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const stemRing = stemOutline.outer.map(([x, y]) => {
        const lx = x - cx;
        const ly = y - cy;
        return [centerX + lx * cos - ly * sin, centerY + lx * sin + ly * cos];
      });
      // Extrusão em flangeThickness (não clipThickness) para rigidez do talo.
      const stemGeom = extrudeOutline({ outer: stemRing, holes: [] }, config.flangeThickness);
      if (stemGeom) geoms.push(stemGeom);
    }
  }
  return geoms;
}

function unionBBox(geoms: THREE.BufferGeometry[]): { minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number } {
  const box = new THREE.Box3();
  for (const g of geoms) {
    g.computeBoundingBox();
    if (g.boundingBox) box.union(g.boundingBox);
  }
  if (box.isEmpty()) return { minX: -1, minY: -1, maxX: 1, maxY: 1, minZ: 0, maxZ: 1 };
  return { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z };
}

function translatePart(geoms: THREE.BufferGeometry[], dx: number, dy: number): void {
  for (const g of geoms) g.translate(dx, dy, 0);
}

/**
 * Gera o kit completo (toggle por peça respeitado), com layout em grade:
 * mold · press · folha numa linha, encaixes numa segunda linha (margem 10 mm).
 */
export function generateThermoformKit(config: ThermoformConfig): GeneratedThermoformKit | null {
  const outline = resolveOutline(config);
  if (!outline) return null;

  const stemPathData = activeStemPathData(config);
  const isFruit = Boolean(stemPathData);

  const builds: { id: ThermoformPartId; geoms: THREE.BufferGeometry[] }[] = [];
  if (config.parts.mold) {
    const geoms = buildMold(outline, config);
    if (geoms.length) builds.push({ id: 'mold', geoms });
  }
  if (config.parts.press) {
    const geoms = buildPress(outline, config);
    if (geoms.length) builds.push({ id: 'press', geoms });
  }
  if (config.parts.folha) {
    const geoms = buildSheet(outline, config);
    if (geoms.length) builds.push({ id: 'folha', geoms });
  }
  if (config.parts.encaixe) {
    const geoms = buildClips(outline, config, isFruit ? { bottomOnly: true } : undefined);
    if (geoms.length) builds.push({ id: 'encaixe', geoms });
  }
  if (isFruit && stemPathData && config.parts.cabo) {
    const geoms = buildStem(outline, config, stemPathData);
    if (geoms.length) builds.push({ id: 'cabo', geoms });
  }
  if (builds.length === 0) return null;

  // Layout: peças principais numa linha; encaixes na linha de baixo.
  const main = builds.filter((b) => b.id !== 'encaixe');
  const clips = builds.filter((b) => b.id === 'encaixe');

  let x = 0;
  let rowHeight = 0;
  for (const b of main) {
    const box = unionBBox(b.geoms);
    translatePart(b.geoms, x - box.minX, -box.minY);
    const w = box.maxX - box.minX;
    rowHeight = Math.max(rowHeight, box.maxY - box.minY);
    x += w + LAYOUT_MARGIN;
  }

  let clipX = 0;
  if (clips.length) {
    const startY = rowHeight + LAYOUT_MARGIN;
    const boxAll = unionBBox(clips.flatMap((b) => b.geoms));
    const h = boxAll.maxY - boxAll.minY;
    for (const b of clips) {
      const box = unionBBox(b.geoms);
      translatePart(b.geoms, clipX - box.minX, startY - box.minY);
      clipX += box.maxX - box.minX + 2;
    }
    rowHeight = startY + h;
  }

  const all = builds.flatMap((b) => b.geoms);
  const box = unionBBox(all);
  const parts: ThermoformPartBuild[] = builds.map((b) => ({ id: b.id, geoms: b.geoms }));

  return {
    parts,
    dimensions: {
      dimX: box.maxX - box.minX,
      dimY: box.maxY - box.minY,
      dimZ: box.maxZ - Math.min(0, box.minZ),
      partCount: parts.length,
    },
  };
}
