import type { FixId, RawModel, RawObject, RepairResult } from "./types";
import { RULES, unitToMm } from "./rules";
import { transformToMatrix, transformVertices } from "./meshChecks";

const MESH_FIXES: FixId[] = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];
const SNAP = RULES.M1_WELD_SNAP_MM.value;
const AREA_EPS = 1e-10;
const Z_EPS = RULES.M6_Z_EPSILON_MM.value;

export function applyMeshRepairs(model: RawModel, enabled: FixId[]): RepairResult {
  const on = new Set(enabled.filter((id) => id.startsWith("M")));
  const applied: FixId[] = [];
  const notes: string[] = [];

  for (const fix of MESH_FIXES) {
    if (!on.has(fix)) continue;
    let did = false;
    switch (fix) {
      case "M1": did = weldObjects(model, notes); break;
      case "M2": did = removeBadTriangles(model, notes); break;
      case "M3": did = fixWinding(model, notes); break;
      case "M4": did = bakeBuildTransforms(model, notes); break;
      case "M5": did = convertToMillimeters(model, notes); break;
      case "M6": did = seatOnBed(model, notes); break;
      case "M7": did = removeEmptyObjects(model, notes); break;
    }
    if (did) applied.push(fix);
  }

  return { applied, notes };
}

/* ------------------------------------------------------------------ */

interface MeshDom {
  verticesEl: Element;
  vertexEls: Element[];
  trianglesEl: Element;
  triangleEls: Element[];
}

function meshDom(obj: RawObject): MeshDom | null {
  const mesh = obj.meshElement;
  if (!mesh) return null;
  const verticesEl = mesh.querySelector(":scope > vertices");
  const trianglesEl = mesh.querySelector(":scope > triangles");
  if (!verticesEl || !trianglesEl) return null;
  return {
    verticesEl,
    vertexEls: Array.from(verticesEl.children),
    trianglesEl,
    triangleEls: Array.from(trianglesEl.children),
  };
}

/** Reread os arrays do objeto a partir do DOM (repares anteriores podem tê-lo alterado). */
function syncObject(obj: RawObject): void {
  const dom = meshDom(obj);
  obj.vertices = [];
  obj.triangles = [];
  if (!dom) return;
  for (const v of dom.vertexEls) {
    obj.vertices.push(Number(v.getAttribute("x")), Number(v.getAttribute("y")), Number(v.getAttribute("z")));
  }
  for (const t of dom.triangleEls) {
    obj.triangles.push(Number(t.getAttribute("v1")), Number(t.getAttribute("v2")), Number(t.getAttribute("v3")));
  }
}

function markDirty(model: RawModel, obj: RawObject): void {
  const doc = model.docs.find((d) => d.path === obj.docPath);
  if (doc) doc.dirty = true;
}

function eachMeshObject(model: RawModel, fn: (obj: RawObject) => void): void {
  for (const obj of model.objects) if (obj.meshElement) fn(obj);
}

/* M1 — weld de vértices (snap 0,1 µm) */
function weldObjects(model: RawModel, notes: string[]): boolean {
  let any = false;
  const factor = 1 / SNAP;
  eachMeshObject(model, (obj) => {
    const dom = meshDom(obj);
    if (!dom || dom.vertexEls.length === 0) return;

    const remap = new Map<string, number>();
    const representative: number[] = [];
    const newIndex = new Int32Array(dom.vertexEls.length);
    let merged = false;
    dom.vertexEls.forEach((vertexEl, i) => {
      const x = Number(vertexEl.getAttribute("x"));
      const y = Number(vertexEl.getAttribute("y"));
      const z = Number(vertexEl.getAttribute("z"));
      const key = `${Math.round(x * factor)}:${Math.round(y * factor)}:${Math.round(z * factor)}`;
      let id = remap.get(key);
      if (id === undefined) {
        id = representative.length;
        remap.set(key, id);
        representative.push(i);
      } else {
        merged = true;
      }
      newIndex[i] = id;
    });
    if (!merged) return;

    const clones = representative.map((i) => dom.vertexEls[i].cloneNode(true));
    dom.verticesEl.replaceChildren(...clones);

    let remapped = 0;
    for (const triangleEl of dom.triangleEls) {
      for (const attr of ["v1", "v2", "v3"]) {
        const raw = triangleEl.getAttribute(attr);
        if (raw === null) continue;
        const mapped = newIndex[Number(raw)];
        if (mapped !== undefined && String(mapped) !== raw) {
          triangleEl.setAttribute(attr, String(mapped));
          remapped++;
        }
      }
    }
    if (remapped > 0) {
      markDirty(model, obj);
      any = true;
    }
  });
  if (any) notes.push("M1: vértices duplicados unidos (snap 0,1 µm).");
  return any;
}

/* M2 — remove degenerados e duplicados */
function removeBadTriangles(model: RawModel, notes: string[]): boolean {
  let any = false;
  eachMeshObject(model, (obj) => {
    syncObject(obj);
    const dom = meshDom(obj);
    if (!dom || dom.triangleEls.length === 0) return;

    const seen = new Set<string>();
    const doomed: Element[] = [];
    for (let t = 0; t < dom.triangleEls.length; t++) {
      const a = obj.triangles[t * 3];
      const b = obj.triangles[t * 3 + 1];
      const c = obj.triangles[t * 3 + 2];
      const pa = a * 3;
      const pb = b * 3;
      const pc = c * 3;
      const area = crossDouble(obj.vertices, pa, pb, pc);
      const isDegenerate = a === b || b === c || a === c || !(area > AREA_EPS);
      const lo = Math.min(a, b, c);
      const hi = Math.max(a, b, c);
      const mid = a + b + c - lo - hi;
      const key = `${lo}:${mid}:${hi}`;
      if (isDegenerate || seen.has(key)) {
        doomed.push(dom.triangleEls[t]);
        continue;
      }
      seen.add(key);
    }
    if (doomed.length === 0) return;
    doomed.forEach((el) => el.remove());
    markDirty(model, obj);
    any = true;
    notes.push(`M2: ${doomed.length} triângulo(s) removido(s) em "${obj.name}".`);
  });
  if (any) eachMeshObject(model, syncObject);
  return any;
}

/* M3 — winding/normais (BFS + volume assinado) */
function fixWinding(model: RawModel, notes: string[]): boolean {
  let any = false;
  eachMeshObject(model, (obj) => {
    syncObject(obj);
    const dom = meshDom(obj);
    if (!dom || dom.triangleEls.length === 0) return;

    const faces = dom.triangleEls.length;
    const positions = obj.vertices;
    const weld = weldIndices(positions);
    const canon: [number, number, number][] = new Array(faces);
    for (let f = 0; f < faces; f++) {
      canon[f] = [weld.map[obj.triangles[f * 3]], weld.map[obj.triangles[f * 3 + 1]], weld.map[obj.triangles[f * 3 + 2]]];
    }

    const { pairA, pairB, pairSame } = buildAdjacency(canon, weld.count);
    const flip = bfsFlip(faces, pairA, pairB, pairSame);

    let volume = signedVolume(positions, obj.triangles, flip);
    if (volume < 0) for (let f = 0; f < faces; f++) flip[f] = flip[f] ? 0 : 1;

    const conflict = pairSame.some((_, k) => {
      const expected = flip[pairA[k]] ^ pairSame[k];
      return flip[pairB[k]] !== expected;
    });
    const inverted = volume < 0;
    if (!inverted && !conflict && flip.every((f) => f === 0)) return;

    let changed = 0;
    for (let f = 0; f < faces; f++) {
      if (!flip[f]) continue;
      const el = dom.triangleEls[f];
      const v2 = el.getAttribute("v2");
      const v3 = el.getAttribute("v3");
      el.setAttribute("v2", v3 ?? "0");
      el.setAttribute("v3", v2 ?? "0");
      changed++;
    }
    if (changed > 0) {
      markDirty(model, obj);
      any = true;
      notes.push(`M3: ${changed} face(s) reorientada(s) em "${obj.name}".`);
    }
  });
  if (any) eachMeshObject(model, syncObject);
  return any;
}

/* M4 — assa os transforms de <build> nos vértices */
function bakeBuildTransforms(model: RawModel, notes: string[]): boolean {
  if (model.buildItems.length === 0) return false;

  const refCount = new Map<number, number>();
  const count = (id: number) => refCount.set(id, (refCount.get(id) ?? 0) + 1);
  model.buildItems.forEach((item) => count(item.objectid));
  model.objects.forEach((obj) => obj.components.forEach((c) => count(c.objectid)));

  const byId = new Map<number, RawObject>();
  for (const obj of model.objects) if (!byId.has(obj.id)) byId.set(obj.id, obj);

  let any = false;
  model.buildItems.forEach((item, index) => {
    if (!item.transform || isIdentity(item.transform)) return;
    const obj = byId.get(item.objectid);
    if (!obj || obj.triangles.length === 0 || obj.components.length > 0) return;
    if ((refCount.get(item.objectid) ?? 0) !== 1) return;

    syncObject(obj);
    obj.vertices = transformVertices(obj.vertices, transformToMatrix(item.transform));
    writeVertices(obj, obj.vertices);
    model.buildItems[index] = { objectid: item.objectid };
    const doc = model.docs.find((d) => d.path === obj.docPath);
    const coreDoc = model.docs[0];
    const itemEl = coreDoc.doc.querySelectorAll("build > item")[index];
    itemEl?.removeAttribute("transform");
    if (doc) doc.dirty = true;
    coreDoc.dirty = true;
    any = true;
  });

  if (any) notes.push("M4: transforms de <build> assados nos vértices.");
  return any;
}

/* M5 — converte para unit="millimeter" */
function convertToMillimeters(model: RawModel, notes: string[]): boolean {
  const factor = unitToMm(model.unit);
  if (factor === 1) return false;

  model.docs.forEach((entry) => {
    const doc = entry.doc;
    doc.querySelector("model")?.setAttribute("unit", "millimeter");
    doc.querySelectorAll("item, component").forEach((el) => {
      const raw = el.getAttribute("transform");
      if (!raw) return;
      const values = raw.trim().split(/\s+/).map(Number);
      if (values.length !== 12 || values.some((v) => Number.isNaN(v))) return;
      values[9] *= factor;
      values[10] *= factor;
      values[11] *= factor;
      el.setAttribute("transform", values.join(" "));
    });
    doc.querySelectorAll("object").forEach((el) => {
      el.querySelectorAll(":scope > mesh > vertices > vertex").forEach((v) => {
        v.setAttribute("x", String(Number(v.getAttribute("x")) * factor));
        v.setAttribute("y", String(Number(v.getAttribute("y")) * factor));
        v.setAttribute("z", String(Number(v.getAttribute("z")) * factor));
      });
    });
    entry.dirty = true;
  });

  notes.push(`M5: unidade "${model.unit}" → millimeter (fator ${factor}).`);
  model.unit = "millimeter";
  return true;
}

/* M6 — assenta em Z=0 */
function seatOnBed(model: RawModel, notes: string[]): boolean {
  eachMeshObject(model, syncObject);
  const byId = new Map<number, RawObject>();
  for (const obj of model.objects) if (!byId.has(obj.id)) byId.set(obj.id, obj);

  const subtreeMinZ = (id: number, matrix: ReturnType<typeof transformToMatrix>, stack = new Set<number>()): number => {
    if (stack.has(id)) return Infinity;
    const obj = byId.get(id);
    if (!obj || obj.vertices.length === 0) return Infinity;
    const next = new Set(stack).add(id);
    let min = Infinity;
    if (obj.triangles.length > 0) {
      const world = transformVertices(obj.vertices, matrix);
      for (let i = 2; i < world.length; i += 3) if (world[i] < min) min = world[i];
    }
    for (const component of obj.components) {
      const child = subtreeMinZ(component.objectid, matrix.clone().multiply(transformToMatrix(component.transform)), next);
      if (child < min) min = child;
    }
    return min;
  };

  let any = false;
  const coreDoc = model.docs[0];

  if (model.buildItems.length > 0) {
    const refs = new Map<number, number>();
    model.buildItems.forEach((item) => refs.set(item.objectid, (refs.get(item.objectid) ?? 0) + 1));
    const itemEls = Array.from(coreDoc.doc.querySelectorAll("build > item"));

    model.buildItems.forEach((item, index) => {
      const matrix = transformToMatrix(item.transform);
      const minZ = subtreeMinZ(item.objectid, matrix);
      if (!Number.isFinite(minZ) || Math.abs(minZ) <= Z_EPS) return;
      const delta = -minZ;

      if (item.transform || (refs.get(item.objectid) ?? 0) > 1) {
        const values = item.transform ? [...item.transform] : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
        if (values.length !== 12) return;
        values[11] += delta;
        item.transform = values;
        itemEls[index]?.setAttribute("transform", values.join(" "));
      } else {
        const obj = byId.get(item.objectid);
        if (!obj) return;
        for (let i = 2; i < obj.vertices.length; i += 3) obj.vertices[i] += delta;
        writeVertices(obj, obj.vertices);
        markDirty(model, obj);
      }
      any = true;
    });
    if (any) coreDoc.dirty = true;
  } else {
    eachMeshObject(model, (obj) => {
      if (obj.triangles.length === 0 || obj.vertices.length === 0) return;
      let minZ = Infinity;
      for (let i = 2; i < obj.vertices.length; i += 3) if (obj.vertices[i] < minZ) minZ = obj.vertices[i];
      if (Math.abs(minZ) <= Z_EPS) return;
      for (let i = 2; i < obj.vertices.length; i += 3) obj.vertices[i] -= minZ;
      writeVertices(obj, obj.vertices);
      markDirty(model, obj);
      any = true;
    });
  }

  if (any) notes.push("M6: peças assentadas em Z=0.");
  return any;
}

/* M7 — remove objetos vazios */
function removeEmptyObjects(model: RawModel, notes: string[]): boolean {
  eachMeshObject(model, syncObject);
  const emptyIds = new Set<number>();
  for (const obj of model.objects) {
    if (obj.triangles.length === 0 && obj.components.length === 0) emptyIds.add(obj.id);
  }
  let any = false;

  if (emptyIds.size > 0) {
    for (const obj of model.objects) {
      if (emptyIds.has(obj.id)) {
        obj.element.remove();
        markDirty(model, obj);
        any = true;
        notes.push(`M7: objeto vazio "${obj.name}" removido.`);
      }
    }
    model.objects = model.objects.filter((obj) => !emptyIds.has(obj.id));
  }

  const alive = new Set(model.objects.map((o) => o.id));
  const coreDoc = model.docs[0];
  Array.from(coreDoc.doc.querySelectorAll("build > item")).forEach((el) => {
    const id = Number(el.getAttribute("objectid"));
    if (!alive.has(id) || emptyIds.has(id)) {
      el.remove();
      coreDoc.dirty = true;
      any = true;
    }
  });
  for (const obj of model.objects) {
    const before = obj.components.length;
    obj.components = obj.components.filter((c) => alive.has(c.objectid));
    if (obj.components.length !== before) {
      const componentsEl = obj.element.querySelector(":scope > components");
      Array.from(componentsEl?.children ?? []).forEach((el) => {
        const id = Number(el.getAttribute("objectid"));
        if (!alive.has(id)) el.remove();
      });
      markDirty(model, obj);
      any = true;
    }
  }
  return any;
}

/* ------------------------------------------------------------------ *
 * Auxiliares
 * ------------------------------------------------------------------ */

function crossDouble(v: number[], a: number, b: number, c: number): number {
  const ux = v[b] - v[a];
  const uy = v[b + 1] - v[a + 1];
  const uz = v[b + 2] - v[a + 2];
  const vx = v[c] - v[a];
  const vy = v[c + 1] - v[a + 1];
  const vz = v[c + 2] - v[a + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function writeVertices(obj: RawObject, vertices: number[]): void {
  const dom = meshDom(obj);
  if (!dom) return;
  dom.vertexEls.forEach((el, i) => {
    el.setAttribute("x", String(vertices[i * 3]));
    el.setAttribute("y", String(vertices[i * 3 + 1]));
    el.setAttribute("z", String(vertices[i * 3 + 2]));
  });
}

function isIdentity(values: number[]): boolean {
  if (values.length === 12) {
    return (
      values[0] === 1 && values[1] === 0 && values[2] === 0 &&
      values[3] === 0 && values[4] === 1 && values[5] === 0 &&
      values[6] === 0 && values[7] === 0 && values[8] === 1 &&
      values[9] === 0 && values[10] === 0 && values[11] === 0
    );
  }
  return false;
}

function weldIndices(positions: number[]): { map: Int32Array; count: number } {
  const factor = 1 / SNAP;
  const lookup = new Map<string, number>();
  const map = new Int32Array(positions.length / 3);
  for (let i = 0; i < map.length; i++) {
    const key = `${Math.round(positions[i * 3] * factor)}:${Math.round(positions[i * 3 + 1] * factor)}:${Math.round(
      positions[i * 3 + 2] * factor
    )}`;
    let id = lookup.get(key);
    if (id === undefined) {
      id = lookup.size;
      lookup.set(key, id);
    }
    map[i] = id;
  }
  return { map, count: lookup.size };
}

function buildAdjacency(canon: [number, number, number][], vc: number) {
  const edgeCount = new Map<number, number>();
  const edgeFace = new Map<number, number>();
  const edgeDir = new Map<number, number>();
  const pairA: number[] = [];
  const pairB: number[] = [];
  const pairSame: number[] = [];
  const ekey = (x: number, y: number) => (x < y ? x * vc + y : y * vc + x);

  for (let f = 0; f < canon.length; f++) {
    const tri = canon[f];
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
  return { pairA, pairB, pairSame };
}

function bfsFlip(faces: number, pairA: number[], pairB: number[], pairSame: number[]): Uint8Array {
  const flip = new Uint8Array(faces);
  if (pairA.length === 0) return flip;

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

  const seen = new Uint8Array(faces);
  const queue = new Int32Array(faces);
  for (let root = 0; root < faces; root++) {
    if (seen[root]) continue;
    seen[root] = 1;
    flip[root] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = root;
    while (head < tail) {
      const current = queue[head++];
      for (let k = start[current]; k < start[current + 1]; k++) {
        const other = neighbor[k];
        const expected = flip[current] ^ same[k];
        if (!seen[other]) {
          seen[other] = 1;
          flip[other] = expected;
          queue[tail++] = other;
        }
      }
    }
  }
  return flip;
}

function signedVolume(positions: number[], indices: number[], flip: Uint8Array): number {
  let vol = 0;
  for (let f = 0; f < flip.length; f++) {
    let i0 = indices[f * 3];
    let i1 = indices[f * 3 + 1];
    let i2 = indices[f * 3 + 2];
    if (flip[f]) {
      const tmp = i1;
      i1 = i2;
      i2 = tmp;
    }
    const a = i0 * 3;
    const b = i1 * 3;
    const c = i2 * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}
