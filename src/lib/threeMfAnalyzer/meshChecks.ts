import * as THREE from "three";
import type { Issue, MeshStats, RawModel, RawObject, WorldMesh } from "./types";
import { RULES, SOURCES, unitToMm } from "./rules";

const SNAP = RULES.M1_WELD_SNAP_MM.value;
const BED = RULES.B6_BED_MM.value;
const SMALL_BED = RULES.B6_SMALL_BED_MM.value;
const Z_TOL = RULES.B6_Z_TOLERANCE.value;
const DEGENERATE_DOUBLE_AREA = 1e-10;
const MAX_OVERLAY_SEGMENTS = 20_000;
const BED_CONTACT_MM = 0.2;

/* ------------------------------------------------------------------ *
 * Transform helpers (3MF de 12 valores ↔ three.js)
 * ------------------------------------------------------------------ */

/**
 * Converte o transform de 12 valores do 3MF (convenção de vetor-linha,
 * `m00 m01 m02 m10 … m22 tx ty tz`) para a matriz-coluna do three.js.
 */
export function transformToMatrix(values?: number[]): THREE.Matrix4 {
  if (!values || values.length === 0) return new THREE.Matrix4();
  if (values.length === 12) {
    const [a, b, c, d, e, f, g, h, i, tx, ty, tz] = values;
    return new THREE.Matrix4().set(a, d, g, tx, b, e, h, ty, c, f, i, tz, 0, 0, 0, 1);
  }
  return new THREE.Matrix4().fromArray(values);
}

/** Matriz-coluna do three.js → 12 valores do 3MF. */
export function matrixToTransform(m: THREE.Matrix4): number[] {
  const e = m.elements;
  return [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10], e[12], e[13], e[14]];
}

/** Aplica a matriz aos vértices crus (espaço do modelo, sem escala de unidade). */
export function transformVertices(vertices: number[], matrix: THREE.Matrix4): number[] {
  const out = new Array<number>(vertices.length);
  const p = new THREE.Vector3();
  for (let i = 0; i < vertices.length; i += 3) {
    p.set(vertices[i], vertices[i + 1], vertices[i + 2]).applyMatrix4(matrix);
    out[i] = p.x;
    out[i + 1] = p.y;
    out[i + 2] = p.z;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Mundo (transforms + unidade → mm)
 * ------------------------------------------------------------------ */

export function resolveWorldMeshes(model: RawModel): WorldMesh[] {
  const byId = new Map<number, RawObject>();
  for (const obj of model.objects) if (!byId.has(obj.id)) byId.set(obj.id, obj);

  const scale = unitToMm(model.unit);
  const out: WorldMesh[] = [];

  const starts: { id: number; matrix: THREE.Matrix4 }[] = model.buildItems.length
    ? model.buildItems.map((item) => ({ id: item.objectid, matrix: transformToMatrix(item.transform) }))
    : model.objects.map((obj) => ({ id: obj.id, matrix: new THREE.Matrix4() }));

  const walk = (id: number, parent: THREE.Matrix4, stack: Set<number>) => {
    if (stack.has(id)) return;
    const obj = byId.get(id);
    if (!obj) return;
    const next = new Set(stack).add(id);
    if (obj.vertices.length > 0 && obj.triangles.length > 0) out.push(toWorldMesh(obj, parent, scale));
    for (const component of obj.components) {
      walk(component.objectid, parent.clone().multiply(transformToMatrix(component.transform)), next);
    }
  };
  starts.forEach((start) => walk(start.id, start.matrix, new Set()));
  return out;
}

function toWorldMesh(obj: RawObject, matrix: THREE.Matrix4, scale: number): WorldMesh {
  const count = obj.vertices.length / 3;
  const positions = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.set(obj.vertices[i * 3], obj.vertices[i * 3 + 1], obj.vertices[i * 3 + 2]).applyMatrix4(matrix);
    positions[i * 3] = p.x * scale;
    positions[i * 3 + 1] = p.y * scale;
    positions[i * 3 + 2] = p.z * scale;
  }
  return { name: obj.name, positions, indices: new Uint32Array(obj.triangles), matrix: matrix.toArray() };
}

/* ------------------------------------------------------------------ *
 * Checagens B1–B9
 * ------------------------------------------------------------------ */

export interface MeshCheckResult {
  issues: Issue[];
  objects: MeshStats[];
  totalTriangles: number;
  boundarySegments: Float32Array;
  overhangTriangles: Float32Array;
  highlights: { min: [number, number, number]; max: [number, number, number]; kind: "offBed" | "floating" | "below" }[];
  hasOverhang: boolean;
  touchingBed: boolean;
  footprint: number;
  height: number;
}

export function runMeshChecks(meshes: WorldMesh[], model?: RawModel): MeshCheckResult {
  const issues: Issue[] = [];
  const objects: MeshStats[] = [];
  const boundary: number[] = [];
  const overhang: number[] = [];
  const highlights: MeshCheckResult["highlights"] = [];

  let totalTriangles = 0;
  let totalBoundary = 0;
  let totalNonManifold = 0;
  let totalDegenerate = 0;
  let totalDuplicates = 0;
  let totalVolume = 0;
  let totalInconsistent = 0;
  let totalOverhangArea = 0;
  let totalArea = 0;
  let globalMin: [number, number, number] = [Infinity, Infinity, Infinity];
  let globalMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let touchingBed = false;

  for (const mesh of meshes) {
    const analysis = analyzeMesh(mesh);
    totalTriangles += analysis.triangles;
    totalBoundary += analysis.boundaryEdges;
    totalNonManifold += analysis.nonManifoldEdges;
    totalDegenerate += analysis.degenerate;
    totalDuplicates += analysis.duplicates;
    totalVolume += analysis.volume;
    totalInconsistent += analysis.inconsistent;
    totalOverhangArea += analysis.overhangArea;
    totalArea += analysis.area;

    for (let i = 0; i < 3; i++) {
      globalMin[i] = Math.min(globalMin[i], analysis.min[i]);
      globalMax[i] = Math.max(globalMax[i], analysis.max[i]);
    }
    if (Math.abs(analysis.min[2]) <= Z_TOL) touchingBed = true;

    const floating = analysis.min[2] > Z_TOL;
    const below = analysis.min[2] < -Z_TOL;
    const offBed = isOffBed(analysis.min, analysis.max);
    if (floating || below || offBed) {
      highlights.push({
        min: analysis.min,
        max: analysis.max,
        kind: below ? "below" : floating ? "floating" : "offBed",
      });
    }

    objects.push({
      name: mesh.name,
      triangles: analysis.triangles,
      boundaryEdges: analysis.boundaryEdges,
      nonManifoldEdges: analysis.nonManifoldEdges,
      degenerate: analysis.degenerate,
      duplicates: analysis.duplicates,
      volume: analysis.volume,
      min: analysis.min,
      max: analysis.max,
      floating,
      belowBed: below,
      offBed,
      overhangArea: analysis.overhangArea,
      overhangRatio: analysis.area > 0 ? analysis.overhangArea / analysis.area : 0,
    });

    appendLimited(boundary, analysis.boundarySegments, MAX_OVERLAY_SEGMENTS * 6);
    if (analysis.triangles <= 60_000) appendLimited(overhang, analysis.overhangTriangles, 60_000 * 9);
  }

  const finite = meshes.length > 0;
  const span: [number, number, number] = finite
    ? [globalMax[0] - globalMin[0], globalMax[1] - globalMin[1], globalMax[2] - globalMin[2]]
    : [0, 0, 0];

  pushStructuralIssues(issues, {
    totalTriangles,
    totalBoundary,
    totalNonManifold,
    totalDegenerate,
    totalDuplicates,
    totalVolume,
    totalInconsistent,
    objects,
    meshCount: meshes.length,
    model,
  });

  if (finite) {
    const offBedCount = objects.filter((o) => o.offBed).length;
    const floatingCount = objects.filter((o) => o.floating).length;
    const belowCount = objects.filter((o) => o.belowBed).length;
    const tightForSmall = objects.filter(
      (o) => o.min[0] < -SMALL_BED / 2 || o.max[0] > SMALL_BED / 2 || o.min[1] < -SMALL_BED / 2 || o.max[1] > SMALL_BED / 2
    ).length;
    if (offBedCount > 0 || floatingCount > 0 || belowCount > 0) {
      issues.push({
        id: "B6",
        category: "mesh",
        severity: offBedCount > 0 ? "error" : "warning",
        title: "Peças fora da mesa de impressão",
        detail:
          `${offBedCount} fora da área de ${BED}×${BED} mm · ${floatingCount} flutuando · ${belowCount} abaixo de Z=0` +
          `${tightForSmall > offBedCount ? ` · ${tightForSmall} não cabem no A1 mini (${SMALL_BED}×${SMALL_BED} mm)` : ""}. ` +
          `Envolvente: ${fmt(span[0])}×${fmt(span[1])}×${fmt(span[2])} mm.`,
        hint:
          offBedCount > 0
            ? "Reposicione a peça ou verifique a unidade (A3) — a cama A1/P1/X1 tem 256×256 mm."
            : "Ative M6 para assentar a peça em Z=0; peças flutuantes geram suporte desnecessário.",
        source: SOURCES.bed,
        fixId: offBedCount > 0 ? undefined : "M6",
      });
    }

    const overhangArea = totalOverhangArea;
    const ratio = totalArea > 0 ? overhangArea / totalArea : 0;
    if (overhangArea > 1) {
      issues.push({
        id: "B7",
        category: "mesh",
        severity: "warning",
        title: "Overhang acima do limite sem suporte",
        detail: `${fmt(overhangArea)} mm² (${(ratio * 100).toFixed(1)}% da superfície) com ângulo > ${
          RULES.B7_OVERHANG_PLA_DEG.value
        }° (PLA) / > ${RULES.B7_OVERHANG_PETG_DEG.value}° (PETG).`,
        hint: "Gire a peça, adicione chanfro de 45° ou ligue suportes (S2) no slicer.",
        source: SOURCES.overhangDesign,
        fixId: "S2",
      });
    }

    const minSpan = Math.min(span[0], span[1], span[2]);
    if (minSpan > 0 && minSpan < RULES.B8_MIN_DIMENSION_MM.value) {
      issues.push({
        id: "B8",
        category: "mesh",
        severity: "warning",
        title: "Dimensão mínima abaixo de 0,8 mm",
        detail: `Menor eixo da envolvente = ${fmt(minSpan)} mm (< 2 perímetros @ bico 0,4 mm).`,
        hint: "Aumente a espessura da parede no modelo ou use bico de 0,25 mm com cuidado.",
        source: SOURCES.wallDesign,
      });
    }
  }

  return {
    issues,
    objects,
    totalTriangles,
    boundarySegments: new Float32Array(boundary),
    overhangTriangles: new Float32Array(overhang),
    highlights,
    hasOverhang: totalOverhangArea > 1,
    touchingBed,
    footprint: finite ? Math.min(span[0], span[1]) : 0,
    height: finite ? span[2] : 0,
  };
}

function pushStructuralIssues(
  issues: Issue[],
  data: {
    totalTriangles: number;
    totalBoundary: number;
    totalNonManifold: number;
    totalDegenerate: number;
    totalDuplicates: number;
    totalVolume: number;
    totalInconsistent: number;
    objects: MeshStats[];
    meshCount: number;
    model?: RawModel;
  }
): void {
  const { totalBoundary, totalNonManifold, totalDegenerate, totalDuplicates } = data;

  const empty = data.model?.objects.filter((o) => o.triangles.length === 0 && o.components.length === 0) ?? [];
  if (empty.length > 0) {
    issues.push({
      id: "B9",
      category: "mesh",
      severity: "error",
      title: `${empty.length} objeto(s) vazio(s)`,
      detail: `Sem triângulos: ${empty.map((o) => o.name).slice(0, 5).join(", ")}${empty.length > 5 ? "…" : ""}.`,
      hint: "M7 remove os objetos vazios e as referências a eles.",
      source: SOURCES.manifold,
      fixId: "M7",
    });
  }

  if (data.meshCount === 0) {
    if (empty.length === 0) {
      issues.push({
        id: "B9",
        category: "mesh",
        severity: "error",
        title: "Nenhum triângulo renderizável",
        detail: "O build não resolve para nenhuma malha com triângulos.",
        hint: "O arquivo não tem geometria utilizável — re-exporte o modelo da fonte.",
        source: SOURCES.manifold,
      });
    }
    return;
  }

  if (totalBoundary > RULES.B1_MAX_BOUNDARY_EDGES.value) {
    issues.push({
      id: "B1",
      category: "mesh",
      severity: "error",
      title: `${totalBoundary} aresta(s) de contorno (malha aberta)`,
      detail: "A malha não é estanque: existem bordas compartilhadas por apenas 1 face.",
      hint:
        "M1 (weld) corrige vértices duplicados; se o buraco for real, use Blender 3D-Print Toolbox ou 3D Builder para preencher.",
      source: SOURCES.manifold,
      fixId: "M1",
    });
  }

  if (totalNonManifold > 0) {
    issues.push({
      id: "B2",
      category: "mesh",
      severity: "error",
      title: `${totalNonManifold} aresta(s) não-manifold`,
      detail: `Arestas compartilhadas por mais de ${RULES.B2_MAX_FACES_PER_EDGE.value} faces — o fatiador não consegue fechar o volume.`,
      hint:
        "M1/M2 resolvem sobreposição de vértices; persistindo, separe as peças no Blender (3D-Print Toolbox) ou no 3D Builder.",
      source: SOURCES.manifold,
      fixId: "M1",
    });
  }

  if (totalDegenerate > RULES.B3_MAX_BAD_TRIANGLES.value || totalDuplicates > RULES.B3_MAX_BAD_TRIANGLES.value) {
    issues.push({
      id: "B3",
      category: "mesh",
      severity: "warning",
      title: `${totalDegenerate} degenerado(s) e ${totalDuplicates} duplicado(s)`,
      detail: "Triângulos de área zero ou repetidos sobrecarregam o slicer e quebram o cálculo de normais.",
      hint: "M2 remove esse lixo preservando os materiais por triângulo.",
      source: SOURCES.manifold,
      fixId: "M2",
    });
  }

  if (data.totalVolume < 0 || data.totalInconsistent > 0) {
    issues.push({
      id: "B4",
      category: "mesh",
      severity: "error",
      title: "Normais/winding inconsistente",
      detail:
        data.totalVolume < 0
          ? "Volume assinado negativo: as faces apalam para dentro (o slicer trata o vazio como sólido)."
          : `${data.totalInconsistent} par(es) de faces adjacentes percorrem a mesma aresta na mesma direção.`,
      hint: "M3 propaga a orientação por componente e corrige o sinal pelo volume assinado.",
      source: SOURCES.manifold,
      fixId: "M3",
    });
  }

  if (data.totalTriangles > RULES.B5_MAX_TRIANGLES.value) {
    issues.push({
      id: "B5",
      category: "mesh",
      severity: "warning",
      title: `${data.totalTriangles.toLocaleString("pt-BR")} triângulos`,
      detail: `Acima de ${RULES.B5_MAX_TRIANGLES.value.toLocaleString("pt-BR")} — anti-pattern "too many triangles": fatiamento lento.`,
      hint: "Decime a malha no Blender (Decimate) para < 500k sem perda visível.",
      source: SOURCES.antiPatterns,
    });
  }
}

function isOffBed(min: [number, number, number], max: [number, number, number]): boolean {
  const half = BED / 2;
  return min[0] < -half || max[0] > half || min[1] < -half || max[1] > half;
}

function fmt(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "—";
}

/* ------------------------------------------------------------------ *
 * Análise de uma malha
 * ------------------------------------------------------------------ */

interface MeshAnalysis {
  name: string;
  triangles: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  degenerate: number;
  duplicates: number;
  volume: number;
  inconsistent: number;
  min: [number, number, number];
  max: [number, number, number];
  area: number;
  overhangArea: number;
  boundarySegments: number[];
  overhangTriangles: number[];
}

function analyzeMesh(mesh: WorldMesh): MeshAnalysis {
  const { positions, indices } = mesh;
  const weld = weldVertices(positions);
  const triCount = Math.floor(indices.length / 3);

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }

  // Filtra degenerados/duplicados e guarda as arestas na base canônica (weld).
  const ca: number[] = [];
  const cb: number[] = [];
  const cc: number[] = [];
  const valid: number[] = [];
  let degenerate = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  const vc = weld.count;

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    const a = weld.map[i0];
    const b = weld.map[i1];
    const c = weld.map[i2];
    if (a === b || b === c || a === c) {
      degenerate++;
      continue;
    }
    const p0 = i0 * 3;
    const p1 = i1 * 3;
    const p2 = i2 * 3;
    const ux = positions[p1] - positions[p0];
    const uy = positions[p1 + 1] - positions[p0 + 1];
    const uz = positions[p1 + 2] - positions[p0 + 2];
    const vx = positions[p2] - positions[p0];
    const vy = positions[p2 + 1] - positions[p0 + 1];
    const vz = positions[p2 + 2] - positions[p0 + 2];
    const doubleArea = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (!(doubleArea > DEGENERATE_DOUBLE_AREA)) {
      degenerate++;
      continue;
    }
    const lo = Math.min(a, b, c);
    const hi = Math.max(a, b, c);
    const mid = a + b + c - lo - hi;
    const key = `${lo}:${mid}:${hi}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    ca.push(a);
    cb.push(b);
    cc.push(c);
    valid.push(i0, i1, i2);
  }

  const used = ca.length;
  const edgeCount = new Map<number, number>();
  const edgeFace = new Map<number, number>();
  const edgeDir = new Map<number, number>();
  const pairA: number[] = [];
  const pairB: number[] = [];
  const pairSame: number[] = [];
  const ekey = (x: number, y: number) => (x < y ? x * vc + y : y * vc + x);

  for (let f = 0; f < used; f++) {
    const tri = [ca[f], cb[f], cc[f]];
    for (let e = 0; e < 3; e++) {
      const u = tri[e];
      const v = tri[(e + 1) % 3];
      const key = ekey(u, v);
      const prev = edgeCount.get(key);
      if (prev === undefined) {
        edgeCount.set(key, 1);
        edgeFace.set(key, f);
        edgeDir.set(key, u < v ? 1 : -1);
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

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  const boundarySegments: number[] = [];
  for (const [key, count] of edgeCount) {
    if (count === 1) {
      boundaryEdges++;
      if (boundarySegments.length < MAX_OVERLAY_SEGMENTS * 6) {
        const u = Math.floor(key / vc);
        pushPoint(boundarySegments, positions, weld.rev[u]);
        pushPoint(boundarySegments, positions, weld.rev[key - u * vc]);
      }
    } else if (count > RULES.B2_MAX_FACES_PER_EDGE.value) {
      nonManifoldEdges++;
    }
  }

  const inconsistent = propagateOrientation(used, pairA, pairB, pairSame);
  const volume = signedVolume(positions, valid);

  let area = 0;
  let overhangArea = 0;
  const overhangTriangles: number[] = [];
  // Limiar PLA 50°: face voltada para baixo com angle(normal, +Z) > 90° + 50°.
  const threshold = Math.PI / 2 + (RULES.B7_OVERHANG_PLA_DEG.value * Math.PI) / 180;
  for (let f = 0; f < used; f++) {
    const i0 = valid[f * 3] * 3;
    const i1 = valid[f * 3 + 1] * 3;
    const i2 = valid[f * 3 + 2] * 3;
    const ux = positions[i1] - positions[i0];
    const uy = positions[i1 + 1] - positions[i0 + 1];
    const uz = positions[i1 + 2] - positions[i0 + 2];
    const vx = positions[i2] - positions[i0];
    const vy = positions[i2 + 1] - positions[i0 + 1];
    const vz = positions[i2 + 2] - positions[i0 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;
    area += len / 2;
    if (nz >= 0) continue;
    const triMinZ = Math.min(positions[i0 + 2], positions[i1 + 2], positions[i2 + 2]);
    if (triMinZ <= min[2] + BED_CONTACT_MM) continue;
    if (Math.acos(Math.max(-1, Math.min(1, nz / len))) > threshold) {
      overhangArea += len / 2;
      if (overhangTriangles.length < 60_000 * 9) {
        overhangTriangles.push(
          positions[i0], positions[i0 + 1], positions[i0 + 2],
          positions[i1], positions[i1 + 1], positions[i1 + 2],
          positions[i2], positions[i2 + 1], positions[i2 + 2]
        );
      }
    }
  }

  return {
    name: mesh.name,
    triangles: used,
    boundaryEdges,
    nonManifoldEdges,
    degenerate,
    duplicates,
    volume,
    inconsistent,
    min,
    max,
    area,
    overhangArea,
    boundarySegments,
    overhangTriangles,
  };
}

function pushPoint(out: number[], positions: Float32Array, index: number): void {
  out.push(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
}

function appendLimited(out: number[], source: number[], limit: number): void {
  for (let i = 0; i < source.length && out.length < limit; i++) out.push(source[i]);
}

/** Agrupa vértices pela posição com snap de 0,1 µm (M1 da skill 3d-print). */
function weldVertices(positions: Float32Array): { map: Uint32Array; count: number; rev: Int32Array } {
  const count = positions.length / 3;
  const map = new Uint32Array(count);
  const lookup = new Map<string, number>();
  const rev: number[] = [];
  const factor = 1 / SNAP;
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(positions[i * 3] * factor)}:${Math.round(positions[i * 3 + 1] * factor)}:${Math.round(
      positions[i * 3 + 2] * factor
    )}`;
    let id = lookup.get(key);
    if (id === undefined) {
      id = rev.length;
      lookup.set(key, id);
      rev.push(i);
    }
    map[i] = id;
  }
  return { map, count: rev.length, rev: Int32Array.from(rev) };
}

/** BFS (CSR): faces que compartilham aresta devem percorrê-la em direções opostas. */
function propagateOrientation(faces: number, pairA: number[], pairB: number[], pairSame: number[]): number {
  if (faces === 0 || pairA.length === 0) return 0;

  const degree = new Int32Array(faces + 1);
  for (let k = 0; k < pairA.length; k++) {
    degree[pairA[k]] += 2;
    degree[pairB[k]] += 2;
  }
  const start = new Int32Array(faces + 1);
  for (let f = 0; f < faces; f++) start[f + 1] = start[f] + degree[f];
  const cursor = start.slice(0, faces);
  const neighbor = new Int32Array(start[faces]);
  const same = new Int32Array(start[faces]);
  for (let k = 0; k < pairA.length; k++) {
    const a = pairA[k];
    const b = pairB[k];
    const s = pairSame[k];
    neighbor[cursor[a]] = b;
    same[cursor[a]++] = s;
    neighbor[cursor[b]] = a;
    same[cursor[b]++] = s;
  }

  const flip = new Int8Array(faces).fill(-1);
  const queue = new Int32Array(faces);
  let conflicts = 0;
  for (let root = 0; root < faces; root++) {
    if (flip[root] !== -1) continue;
    flip[root] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = root;
    while (head < tail) {
      const current = queue[head++];
      for (let k = start[current]; k < start[current + 1]; k++) {
        const other = neighbor[k];
        const expected = flip[current] ^ same[k];
        if (flip[other] === -1) {
          flip[other] = expected;
          queue[tail++] = other;
        } else if (flip[other] !== expected) {
          conflicts++;
        }
      }
    }
  }
  return conflicts;
}

function signedVolume(positions: Float32Array, indices: number[]): number {
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}
