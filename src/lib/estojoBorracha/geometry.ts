import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as ClipperLib from 'clipper-lib';
import { csgUnion, csgSubtract, csgIntersect } from '../fastener/boolean';
import { isPointInsidePolygon } from '../pencilTopper/contourExtractor';
import { signedVolume } from '../fastener/threads';
import type { GeneratedEstojo, EstojoBorrachaConfig } from '../../types/estojoBorracha';
import { computeDerived, FIXO, type EstojoDerived } from './presets';

// ---------------------------------------------------------------------------
// Helpers 2D — todas as formas vivem no plano (x, z) do OpenSCAD.
// ---------------------------------------------------------------------------

const SEG = 24;

/** Círculo como polígono CCW centrado em (cx, cy). */
function circlePoints(cx: number, cy: number, r: number, seg = SEG): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Convex hull (monotone chain) — pontos de entrada em qualquer ordem. */
function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (pts.length <= 1) return pts;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Garante orientação CCW (THREE.Shape outer). */
function ensureCCW(pts: [number, number][]): [number, number][] {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return area < 0 ? [...pts].reverse() : pts;
}

function shapeFrom(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  const ccw = ensureCCW(pts);
  s.moveTo(ccw[0][0], ccw[0][1]);
  for (let i = 1; i < ccw.length; i++) s.lineTo(ccw[i][0], ccw[i][1]);
  s.closePath();
  return s;
}

const CLIPPER_SCALE = 1000;

/**
 * União 2D de vários polígonos via clipper. Devolve os contornos resultantes
 * (com possíveis buracos). Usado p/ fundir o perfil interno da caixa numa
 * única forma antes de extrudar — evita a união 3D degenerada da divisória
 * diagonal com o piso/paredes, que o manifold resolve em malha não-estanque.
 */
function unionPolygons2D(polys: [number, number][][]): { outer: [number, number][][]; holes: [number, number][][] } {
  const subject: ClipperLib.Path[] = [];
  for (const poly of polys) {
    const path: ClipperLib.Path = poly.map(([x, y]) => ({ X: Math.round(x * CLIPPER_SCALE), Y: Math.round(y * CLIPPER_SCALE) }));
    subject.push(path);
  }
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  const solution: ClipperLib.Path[] = [];
  clipper.Execute(ClipperLib.ClipType.ctUnion, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

  // Classifica contornos por contenção (paridade) p/ separar outer de holes.
  const polysOut: [number, number][][] = solution.map((p) => p.map(({ X, Y }) => [X / CLIPPER_SCALE, Y / CLIPPER_SCALE] as [number, number]));
  const outer: [number, number][][] = [];
  const holes: [number, number][][] = [];
  for (let i = 0; i < polysOut.length; i++) {
    let depth = 0;
    for (let j = 0; j < polysOut.length; j++) {
      if (i === j) continue;
      if (isPointInsidePolygon({ x: polysOut[i][0][0], y: polysOut[i][0][1] }, polysOut[j].map(([x, y]) => ({ x, y })))) depth++;
    }
    if (depth % 2 === 0) outer.push(polysOut[i]);
    else holes.push(polysOut[i]);
  }
  return { outer, holes };
}

function buildShapeWithHoles(outer: [number, number][], holes: [number, number][][]): THREE.Shape {
  const s = shapeFrom(outer);
  for (const h of holes) {
    if (h.length < 3) continue;
    if (isPointInsidePolygon({ x: h[0][0], y: h[0][1] }, outer.map(([x, y]) => ({ x, y })))) {
      const hp = ensureCCW(h);
      const path = new THREE.Path();
      path.moveTo(hp[0][0], hp[0][1]);
      for (let i = 1; i < hp.length; i++) path.lineTo(hp[i][0], hp[i][1]);
      path.closePath();
      s.holes.push(path);
    }
  }
  return s;
}

/** Retângulo de canto vivo. */
function rectPts(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** Footprint arredondado (cantos verticais; topo/piso planos) = rrect do .scad. */
function roundedRectPts(x0: number, y0: number, x1: number, y1: number, r: number): [number, number][] {
  const rr = Math.max(0, Math.min(r, Math.min(x1 - x0, y1 - y0) / 2));
  if (rr <= 0) return rectPts(x0, y0, x1, y1);
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [x1 - rr, y0 + rr, -Math.PI / 2], // bottom-right
    [x1 - rr, y1 - rr, 0], // top-right
    [x0 + rr, y1 - rr, Math.PI / 2], // top-left
    [x0 + rr, y0 + rr, Math.PI], // bottom-left
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= SEG / 4; i++) {
      const a = start + (i / (SEG / 4)) * (Math.PI / 2);
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Extrusão — mapeia o plano (x,z) do OpenSCAD para as coordenadas do three.
// ---------------------------------------------------------------------------

/** Extrude uma forma 2D (coords = (x, z) do OpenSCAD) ao longo de Y, de y0 a y1. */
function extrudeAlongY(pts: [number, number][], y0: number, y1: number, holes?: [number, number][][]): THREE.BufferGeometry {
  const shape = shapeFrom(pts);
  if (holes) for (const h of holes) shape.holes.push(new THREE.Path(ensureCCW(h).map(([x, y]) => new THREE.Vector2(x, y))));
  const depth = Math.max(1e-4, y1 - y0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: SEG });
  geo.rotateX(Math.PI / 2); // (X,Y,Z) -> (X,-Z,Y)
  geo.translate(0, y1, 0); // agora ocupa y1..y0 em Y, (x,z) no lugar
  return geo;
}

/** Extrude ao longo de Z (footprint da caixa/plugue), de 0 a depth. */
function extrudeAlongZ(pts: [number, number][], depth: number): THREE.BufferGeometry {
  const shape = shapeFrom(pts);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: SEG });
}

// ---------------------------------------------------------------------------
// CSG — reutiliza manifold via fastener/boolean (async).
// ---------------------------------------------------------------------------

async function unionAll(geoms: THREE.BufferGeometry[]): Promise<THREE.BufferGeometry> {
  if (geoms.length === 0) throw new Error('unionAll: lista vazia');
  let acc = geoms[0];
  for (let i = 1; i < geoms.length; i++) {
    acc = (await csgUnion(acc, geoms[i])).geometry;
  }
  return acc;
}

async function subtract(a: THREE.BufferGeometry, cuts: THREE.BufferGeometry[]): Promise<THREE.BufferGeometry> {
  let acc = a;
  for (const c of cuts) acc = (await csgSubtract(acc, c)).geometry;
  return acc;
}

// ---------------------------------------------------------------------------
// Formas 2D específicas do mecanismo
// ---------------------------------------------------------------------------

/** buraco2d: círculo (raio rh) com topo plano em z = 0.8·rh (sem suporte). */
function buraco2d(rh: number): [number, number][] {
  const seg = 24;
  const topAngle = Math.asin(0.8); // ~53.13°
  const start = topAngle;
  const end = topAngle - (2 * Math.PI - 2 * topAngle); // varre a parte de baixo
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = start + (i / seg) * (end - start);
    pts.push([rh * Math.cos(a), rh * Math.sin(a)]);
  }
  return pts; // fecha com a corda superior (topo plano)
}

/** pino2d: círculo (raio pd/2) em (passo,0) com base plana em z = -0.4·pd. */
function pino2d(passo: number, pd: number): [number, number][] {
  const r = pd / 2;
  const seg = 24;
  const baseAngle = Math.asin(-0.8); // onde z = -0.4·pd
  const start = baseAngle;
  const end = baseAngle + (2 * Math.PI - 2 * Math.abs(baseAngle)); // varre por cima
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = start + (i / seg) * (end - start);
    pts.push([passo + r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts; // fecha com a corda inferior (base plana)
}

/** orelha2d: hull(círculo r=re em (passo,0), aba vertical fina em xc1). */
function orelha2d(passo: number, re: number, gx: number): [number, number][] {
  const xc1 = passo - re - gx;
  const cloud: [number, number][] = [...circlePoints(passo, 0, re, SEG), [xc1, -re], [xc1, re]];
  return convexHull(cloud);
}

/** hull(círculo r=re em (cx,0), retângulo [rx0,-re,rx1,re]). */
function hullCircleRect(cx: number, re: number, rx0: number, rx1: number): [number, number][] {
  const cloud: [number, number][] = [
    ...circlePoints(cx, 0, re, SEG),
    [rx0, -re],
    [rx1, -re],
    [rx1, re],
    [rx0, re],
  ];
  return convexHull(cloud);
}

// ---------------------------------------------------------------------------
// CAIXA
// ---------------------------------------------------------------------------

/** Caminho do sulco (pontos-centro em (x,z)) para a parede lateral. */
function sulcoPath(d: EstojoDerived): [number, number][] {
  const pts: [number, number][] = [
    [d.x_p0 - 0.3, d.zt],
    [d.xa, d.zt],
  ];
  for (let a = 10; a <= 90; a += 10) {
    const rad = (a * Math.PI) / 180;
    pts.push([d.xa + d.R * Math.sin(rad), d.zc + d.R * Math.cos(rad)]);
  }
  pts.push([d.xa + d.R, -1]);
  return pts;
}

/** Sulco como sólido 3D manifold: varre o caminho com raio gw/2 (tubo). */
function sulcoSolid(d: EstojoDerived, y0: number, y1: number): THREE.BufferGeometry {
  const path = sulcoPath(d);
  const radius = d.gw / 2;
  const outline = sweepPathPolygon(path, radius);
  return extrudeAlongY(outline, y0, y1);
}

/**
 * Contorno manifold de um tubo de raio `r` ao longo de uma polilinha:
 * lado esquerdo (normais +90°) sentido direto, cápsula nas pontas,
 * lado direito sentido inverso.
 */
function sweepPathPolygon(path: [number, number][], r: number): [number, number][] {
  const pts: [number, number][] = [];
  const n = path.length;
  const normal = (i: number): [number, number] => {
    // média das direções dos segmentos adjacentes, normalizada
    let dx = 0;
    let dz = 0;
    if (i > 0) {
      dx += path[i][0] - path[i - 1][0];
      dz += path[i][1] - path[i - 1][1];
    }
    if (i < n - 1) {
      dx += path[i + 1][0] - path[i][0];
      dz += path[i + 1][1] - path[i][1];
    }
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len]; // normal à esquerda
  };
  // lado esquerdo (sentido direto)
  for (let i = 0; i < n; i++) {
    const [nx, nz] = normal(i);
    pts.push([path[i][0] + nx * r, path[i][1] + nz * r]);
  }
  // cápsula na ponta final
  const end = path[n - 1];
  const endN = normal(n - 1);
  const endAng = Math.atan2(endN[1], endN[0]);
  for (let i = 1; i < 12; i++) {
    const a = endAng - (i / 12) * Math.PI;
    pts.push([end[0] + r * Math.cos(a), end[1] + r * Math.sin(a)]);
  }
  // lado direito (sentido inverso)
  for (let i = n - 1; i >= 0; i--) {
    const [nx, nz] = normal(i);
    pts.push([path[i][0] - nx * r, path[i][1] - nz * r]);
  }
  // cápsula na ponta inicial
  const start = path[0];
  const startN = normal(0);
  const startAng = Math.atan2(startN[1], startN[0]);
  for (let i = 1; i < 12; i++) {
    const a = startAng + Math.PI + (i / 12) * Math.PI;
    pts.push([start[0] + r * Math.cos(a), start[1] + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * perfil_interno (piso + frente + fundo + divisória 45°) no plano (x,z).
 * Os 4 polígonos são fundidos em 2D (clipper) e extrudados numa única malha
 * — evita a união 3D degenerada da divisória diagonal com piso/paredes.
 */
function perfilInternoSolid(d: EstojoDerived, y0: number, y1: number): THREE.BufferGeometry {
  const F = FIXO;
  const piso = rectPts(0, 0, d.xa + d.Rd, F.fl);
  const frente = rectPts(0, 0, F.fw, d.alturaTotal);
  const fundo = rectPts(d.xa + d.Ro, 0, d.xa + d.Ro + F.bw, d.alturaTotal);
  const div: [number, number][] = [
    [d.xa, d.ztc],
    [d.xa + d.Rd, d.zc],
    [d.xa + d.Rd, -1], // desce abaixo do piso p/ não gerar face coplanar degenerada
    [d.xa + d.Rd - F.pw, -1],
    [d.xa + d.Rd - F.pw, d.zc - d.mch + F.pw],
    [d.xa - d.mch, d.ztc],
  ];
  const { outer, holes } = unionPolygons2D([piso, frente, fundo, div]);
  const geoms: THREE.BufferGeometry[] = [];
  for (const o of outer) {
    const shape = buildShapeWithHoles(o, holes);
    const depth = Math.max(1e-4, y1 - y0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: SEG });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y1, 0);
    geoms.push(geo);
  }
  if (geoms.length === 0) throw new Error('perfil interno vazio');
  return geoms.length === 1 ? geoms[0] : (BufferGeometryUtils.mergeGeometries(geoms, false) as THREE.BufferGeometry);
}

async function buildCaixa(d: EstojoDerived): Promise<THREE.BufferGeometry> {
  const F = FIXO;
  const Hb = d.Hb;
  // paredes laterais (cubos ao longo de y)
  const wall0 = new THREE.BoxGeometry(d.Xo, F.gd + 3, Hb).translate(d.Xo / 2, (F.gd + 3) / 2, Hb / 2);
  const wall1 = new THREE.BoxGeometry(d.Xo, F.gd + 3, Hb).translate(d.Xo / 2, d.Yo - (F.gd + 3) / 2, Hb / 2);
  // Sobreposição de 1 mm entre o perfil interno e as paredes laterais: 0.01
  // gera face coplanar degenerada. A parede já ocupa esse trecho, então 1 mm é seguro.
  const OVERLAP = 1.0;
  const perfil = perfilInternoSolid(d, d.wy - OVERLAP, d.Yo - d.wy + OVERLAP);

  const innerUnion = await unionAll([wall0, wall1, perfil]);

  // sulcos removidos das paredes (y-bands)
  const sulcoA = sulcoSolid(d, d.wy - F.gd, d.wy + 0.01);
  const sulcoB = sulcoSolid(d, d.Yo - d.wy - 0.01, d.Yo - d.wy + F.gd);
  const carved = await subtract(innerUnion, [sulcoA, sulcoB]);

  // recorta pelo footprint arredondado (extrudado em Z)
  const footprint = extrudeAlongZ(roundedRectPts(0, 0, d.Xo, d.Yo, d.raioCanto), Hb);
  // footprint está em (x,y,z); a caixa "carved" também. intersect.
  const result = await csgIntersect(carved, footprint);
  return result.geometry;
}

// ---------------------------------------------------------------------------
// PLUGUE
// ---------------------------------------------------------------------------

async function buildPlugue(d: EstojoDerived): Promise<THREE.BufferGeometry> {
  const F = FIXO;
  const cx0 = d.xa + d.Rd + 0.2;
  const cx1 = d.xa + d.Ro - 0.2;
  const gx0 = d.xa + d.R - d.gw / 2 + 0.2;
  const gx1 = d.xa + d.R + d.gw / 2 - 0.2;
  const body = new THREE.BoxGeometry(cx1 - cx0, d.Yo - 2 * d.wy - 0.4, F.ph).translate(
    (cx0 + cx1) / 2,
    d.Yo / 2,
    F.ph / 2
  );
  const tab = new THREE.BoxGeometry(gx1 - gx0, d.Yo - 2 * d.wy + 2 * F.gd - 0.4, F.ph).translate(
    (gx0 + gx1) / 2,
    d.Yo / 2,
    F.ph / 2
  );
  const union = await unionAll([body, tab]);
  const footprint = extrudeAlongZ(roundedRectPts(0, 0, d.Xo, d.Yo, d.raioCanto), F.ph);
  return (await csgIntersect(union, footprint)).geometry;
}

// ---------------------------------------------------------------------------
// CAPA
// ---------------------------------------------------------------------------

/** capa_perfil: C invertido (base viva, cantos superiores arredondados, cavity viva). */
function capaPerfilPts(d: EstojoDerived, t: number, f: number): [number, number][] {
  const co = d.raioCanto + t;
  const x0 = -f - t;
  const x1 = d.Xo + f + t;
  const yTop = d.Hb + f;
  // outer: base viva (retângulo), lados sobem, cantos superiores arredondados
  const outer: [number, number][] = [
    [x0, 0],
    [x1, 0],
    [x1, yTop - co],
  ];
  // canto superior direito (arco)
  for (let i = 0; i <= SEG / 4; i++) {
    const a = (i / (SEG / 4)) * (Math.PI / 2);
    outer.push([x1 - co + co * Math.cos(a), yTop - co + co * Math.sin(a)]);
  }
  outer.push([x0 + co, yTop]);
  // canto superior esquerdo (arco)
  for (let i = 0; i <= SEG / 4; i++) {
    const a = Math.PI / 2 + (i / (SEG / 4)) * (Math.PI / 2);
    outer.push([x0 + co + co * Math.cos(a), yTop - co + co * Math.sin(a)]);
  }
  outer.push([x0, yTop - co]);
  return outer;
}

async function buildCapa(d: EstojoDerived, config: EstojoBorrachaConfig): Promise<{ geom: THREE.BufferGeometry; nameWidth: number }> {
  const t = FIXO.capaEsp;
  const f = FIXO.capaFolga;
  const y0 = d.Yo / 2 - d.capaLargEff / 2;
  const y1 = d.Yo / 2 + d.capaLargEff / 2;

  const outer = capaPerfilPts(d, t, f);
  const cavity = rectPts(-f, -f, d.Xo + f, d.Hb + f); // cavidade viva
  // a cavidade é um notch aberto no topo → construímos o perfil como regiões
  // (esquerda + base + direita) em vez de hole (que exigiria fechar o topo).
  const leftWall = rectPts(-f - t, -f - t, -f, d.Hb + f);
  const rightWall = rectPts(d.Xo + f, -f - t, d.Xo + f + t, d.Hb + f);
  const floorBand = rectPts(-f - t, -f - t, d.Xo + f + t, -f);
  // cantos superiores arredondados (pequenas peças hull) p/ suavizar
  const co = d.raioCanto + t;
  const body = await unionAll([
    extrudeAlongY(leftWall, y0, y1),
    extrudeAlongY(rightWall, y0, y1),
    extrudeAlongY(floorBand, y0, y1),
  ]);

  // nome
  const text = config.text.trim();
  let nameWidth = 0;
  if (!text) return { geom: body, nameWidth };

  const { buildTextExtrusion } = await import('./textGeometry');
  const prof = config.textoProf;
  const frontX = -f - t; // face frontal da parede esquerda
  const textGeom = await buildTextExtrusion(text, {
    fontFamily: config.fontFamily,
    height: config.letterHeight,
    fontWeightScale: config.fontWeightScale,
    // plano (y,z) da face frontal; extrusão ao longo de X
    centerX: d.Yo / 2,
    centerZ: d.Hb / 2,
    faceX: frontX,
  });
  if (!textGeom) return { geom: body, nameWidth };
  textGeom.computeBoundingBox();
  const tb = textGeom.boundingBox!;
  nameWidth = Number((tb.max.y - tb.min.y).toFixed(1)); // largura ao longo de Y

  if (prof < 0) {
    const cut = textGeom.clone();
    // vaza da face p/ dentro: desloca para dentro (+X) e alonga
    cut.translate(Math.abs(prof) - 0.05, 0, 0);
    const hollow = await subtract(body, [cut]);
    return { geom: hollow, nameWidth };
  }
  // relevo embutido 0,4 na parede
  const emboss = textGeom.clone();
  emboss.translate(0.4, 0, 0);
  const relief = await unionAll([body, emboss]);
  return { geom: relief, nameWidth };
}

// ---------------------------------------------------------------------------
// PORTA (plana, print-in-place) — a mais complexa
// ---------------------------------------------------------------------------

async function buildRipa(d: EstojoDerived, i: number): Promise<THREE.BufferGeometry> {
  const F = FIXO;
  const re = d.re;
  const passo = F.passo;
  const Ly = d.Ly;
  const xc0 = re + F.gx;
  const xc1 = passo - re - F.gx;
  const primeira = i === 0;
  const ultima = i === d.nRipas - 1;

  const positives: THREE.BufferGeometry[] = [];
  const negatives: THREE.BufferGeometry[] = [];

  // núcleo
  positives.push(extrudeAlongY(rectPts(xc0, -re, xc1, re), 0, Ly));

  // cabeça (primeira ripa)
  if (primeira) {
    positives.push(extrudeAlongY(hullCircleRect(0, re, 0, xc0 + 0.5), 0, Ly));
  }

  // lingueta com furos cegos (não-primeira)
  if (!primeira) {
    const slab = hullCircleRect(0, re, 0, xc0 + 0.5);
    positives.push(extrudeAlongY(slab, F.e + F.gy, Ly - F.e - F.gy));
    // furos cegos de cada ponta
    const rh = F.pd / 2 + F.folga;
    const buraco = buraco2d(rh);
    negatives.push(extrudeAlongY(buraco, F.e + F.gy - 0.01, F.e + F.gy + F.hd));
    negatives.push(extrudeAlongY(buraco, Ly - F.e - F.gy - F.hd, Ly - F.e - F.gy + 0.01));
  }

  // cauda (última ripa)
  if (ultima) {
    positives.push(extrudeAlongY(hullCircleRect(passo, re, xc1 - 0.5, passo), 0, Ly));
  }

  // garfo: orelhas + pinos (não-última)
  if (!ultima) {
    const orelha = orelha2d(passo, re, F.gx);
    positives.push(extrudeAlongY(orelha, 0, F.e));
    positives.push(extrudeAlongY(orelha, Ly - F.e, Ly));
    const pino = pino2d(passo, F.pd);
    positives.push(extrudeAlongY(pino, F.e - 0.01, F.e + F.gy + F.hd - 0.6));
    positives.push(extrudeAlongY(pino, Ly - F.e - F.gy - F.hd + 0.6, Ly - F.e + 0.01));
  }

  // pinos-guia (correm nos sulcos)
  positives.push(extrudeAlongY(circlePoints(passo, 0, F.pegD / 2, 16), -d.pl, 0.01));
  positives.push(extrudeAlongY(circlePoints(passo, 0, F.pegD / 2, 16), Ly - 0.01, Ly + d.pl));
  if (primeira) {
    positives.push(extrudeAlongY(circlePoints(0, 0, F.pegD / 2, 16), -d.pl, 0.01));
    positives.push(extrudeAlongY(circlePoints(0, 0, F.pegD / 2, 16), Ly - 0.01, Ly + d.pl));
    // puxador: square([xc1-xc0-1, 4]) em z, a partir de re-0.01
    positives.push(
      extrudeAlongY(rectPts(xc0 + 0.5, re - 0.01, xc0 + 0.5 + (xc1 - xc0 - 1), re - 0.01 + 4), Ly / 2 - 30, Ly / 2 + 30)
    );
  }

  let ripa = await unionAll(positives);
  if (negatives.length) ripa = await subtract(ripa, negatives);
  return ripa;
}

async function buildPorta(d: EstojoDerived): Promise<THREE.BufferGeometry> {
  const re = d.re;
  const passo = FIXO.passo;
  const ripas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < d.nRipas; i++) {
    const ripa = await buildRipa(d, i);
    ripa.translate(i * passo, 0, re);
    ripas.push(ripa);
  }
  return unionAll(ripas);
}

// ---------------------------------------------------------------------------
// Modelo completo
// ---------------------------------------------------------------------------

function finalize(geom: THREE.BufferGeometry, name: string): THREE.Mesh {
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 }));
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export async function generateEstojoModel(config: EstojoBorrachaConfig): Promise<GeneratedEstojo> {
  const d = computeDerived(config);

  const caixaGeom = await buildCaixa(d);
  const portaGeom = await buildPorta(d);
  const plugueGeom = await buildPlugue(d);
  const { geom: capaGeom, nameWidth } = await buildCapa(d, config);

  const caixaMesh = finalize(caixaGeom, '1_Caixa');
  caixaMesh.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(config.caixaColor), roughness: 0.45, metalness: 0.05 });
  const portaMesh = finalize(portaGeom, '2_Porta');
  portaMesh.material = caixaMesh.material.clone();
  const plugueMesh = finalize(plugueGeom, '3_Plugue');
  plugueMesh.material = caixaMesh.material.clone();
  const capaMesh = finalize(capaGeom, '4_Capa');
  capaMesh.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(config.capaColor), roughness: 0.4, metalness: 0.05 });

  // dimensões
  const volume =
    signedVolume(caixaGeom) + signedVolume(portaGeom) + signedVolume(plugueGeom) + signedVolume(capaGeom);
  const volumeCm3 = Math.max(0.1, Number((volume / 1000).toFixed(1)));
  const weightGrams = Number((volumeCm3 * 1.24).toFixed(1));
  const printTimeMinutes = Math.max(20, Math.round(weightGrams * 3.2 + 12));

  const totalBox = new THREE.Box3();
  for (const g of [caixaGeom, portaGeom, plugueGeom, capaGeom]) {
    g.computeBoundingBox();
    totalBox.union(g.boundingBox!);
  }
  const size = new THREE.Vector3();
  totalBox.getSize(size);

  const dimensions = {
    dimX: Number(size.x.toFixed(1)),
    dimY: Number(size.y.toFixed(1)),
    dimZ: Number(size.z.toFixed(1)),
    volumeCm3,
    weightGrams,
    printTimeMinutes,
    cursoMax: Number(d.curso_max.toFixed(1)),
    nameWidthMm: nameWidth,
  };

  return { caixaMesh, portaMesh, plugueMesh, capaMesh, dimensions };
}
