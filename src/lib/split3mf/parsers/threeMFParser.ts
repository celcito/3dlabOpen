import * as THREE from "three";
import JSZip from "jszip";

export interface ParsedThreeMF {
  geometry: THREE.BufferGeometry;
  regionMask?: Uint8Array;
  suggestedColors?: string[];
  objects: { name: string; color?: string }[];
}

interface MatColor {
  id: number;
  name: string;
  color: string;
}

/**
 * Parses a .3mf file (ZIP + XML core spec) and returns a merged geometry plus
 * a per-vertex group mask derived from <basematerials> pid/pindex references.
 * Multi-build files are limited to the first build (V1 decision).
 */
export async function parseThreeMF(arrayBuffer: ArrayBuffer): Promise<ParsedThreeMF> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const modelEntry = zip.file("3D/3dmodel.model");
  if (!modelEntry) {
    throw new Error("Invalid 3MF: missing 3D/3dmodel.model");
  }
  const xml = await modelEntry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Invalid 3MF XML");

  const model = doc.querySelector("model");
  const unit = model?.getAttribute("unit") || "millimeter";

  const materials = collectMaterials(doc);
  const objects = collectObjects(doc, materials);

  // Build selection from the first <build> only.
  const build = doc.querySelector("build");
  const buildItems: { objectid: number; transform?: number[] }[] = [];
  build?.querySelectorAll("item").forEach((item) => {
    const id = Number(item.getAttribute("objectid"));
    if (Number.isNaN(id)) return;
    const t = item.getAttribute("transform");
    buildItems.push({
      objectid: id,
      transform: t ? t.trim().split(/\s+/).map(Number) : undefined,
    });
  });
  if (buildItems.length === 0) {
    // No build section: fall back to every object, identity transform.
    objects.forEach((o) => buildItems.push({ objectid: o.id }));
  }

  const parts: { obj: ParsedObject; transform?: number[] }[] = [];
  for (const item of buildItems) {
    const obj = objects.find((o) => o.id === item.objectid);
    if (obj) parts.push({ obj, transform: item.transform });
  }
  // Include any object referenced as a <component> child too.
  collectComponentReferences(doc, objects, parts);

  const merged = mergeParts(parts, unit, materials);
  return merged;
}

interface ParsedObject {
  id: number;
  name: string;
  vertices: number[];
  triangles: number[][];
  materials: number[] | null;
  parentTransform?: number[];
}

function collectMaterials(doc: Document): MatColor[] {
  const result: MatColor[] = [];
  doc.querySelectorAll("basematerials").forEach((bm) => {
    const baseId = Number(bm.getAttribute("id")) || 0;
    bm.querySelectorAll("base").forEach((base, idx) => {
      const color = base.getAttribute("displaycolor") || base.getAttribute("color") || "#888888";
      result.push({
        id: baseId + idx,
        name: base.getAttribute("name") || `Mat ${baseId}-${idx}`,
        color: normalizeColor(color),
      });
    });
  });
  return result;
}

function collectObjects(doc: Document, materials: MatColor[]): ParsedObject[] {
  const objects: ParsedObject[] = [];
  doc.querySelectorAll("object").forEach((el) => {
    const id = Number(el.getAttribute("id"));
    if (Number.isNaN(id)) return;
    const type = el.getAttribute("type");
    if (type && type !== "model") return; // skip color/mesh-less resource objects

    const mesh = el.querySelector(":scope > mesh");
    const vertices: number[] = [];
    const triangles: number[][] = [];

    mesh?.querySelectorAll("vertices > vertex").forEach((v) => {
      vertices.push(Number(v.getAttribute("x")), Number(v.getAttribute("y")), Number(v.getAttribute("z")));
    });

    // pid on <triangle> → per-triangle material. pindex on <vertex> → per-vertex.
    const vertexPids: (number | null)[] = [];
    mesh?.querySelectorAll("vertices > vertex").forEach((v) => {
      const pid = v.getAttribute("pid");
      const pindex = v.getAttribute("pindex");
      if (pid !== null && pindex !== null) {
        const baseId = Number(pid);
        vertexPids.push(baseId + Number(pindex));
      } else if (pid !== null) {
        vertexPids.push(Number(pid));
      } else {
        vertexPids.push(null);
      }
    });

    const trianglePids: (number | null)[] = [];
    mesh?.querySelectorAll("triangles > triangle").forEach((t) => {
      triangles.push([
        Number(t.getAttribute("v1")),
        Number(t.getAttribute("v2")),
        Number(t.getAttribute("v3")),
      ]);
      const pid = t.getAttribute("pid");
      if (pid !== null) {
        const pindex = t.getAttribute("pindex");
        trianglePids.push(pindex !== null ? Number(pid) + Number(pindex) : Number(pid));
      } else {
        trianglePids.push(null);
      }
    });

    // Effective material id per vertex: per-vertex pid wins, else per-triangle.
    const perVertexMats: (number | null)[] = new Array(vertices.length / 3).fill(null);
    triangles.forEach((tri, ti) => {
      const matId = trianglePids[ti] ?? vertexPids[tri[0]] ?? null;
      if (matId === null) return;
      tri.forEach((vi) => { if (perVertexMats[vi] === null) perVertexMats[vi] = matId; });
    });
    // Backfill from vertex pids for vertices never referenced (rare).
    vertexPids.forEach((pid, vi) => { if (perVertexMats[vi] === null) perVertexMats[vi] = pid; });

    objects.push({
      id,
      name: el.getAttribute("name") || `Object ${id}`,
      vertices,
      triangles,
      materials: perVertexMats,
    });
  });
  return objects;
}

function collectComponentReferences(
  doc: Document,
  objects: ParsedObject[],
  parts: { obj: ParsedObject; transform?: number[] }[]
) {
  doc.querySelectorAll("component").forEach((comp) => {
    const id = Number(comp.getAttribute("objectid"));
    if (Number.isNaN(id)) return;
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    if (parts.some((p) => p.obj.id === id)) return;
    const t = comp.getAttribute("transform");
    parts.push({ obj, transform: t ? t.trim().split(/\s+/).map(Number) : undefined });
  });
}

function mergeParts(
  parts: { obj: ParsedObject; transform?: number[] }[],
  unit: string,
  materials: MatColor[]
): ParsedThreeMF {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const materialColors = new Map<number, string>();
  materials.forEach((m) => materialColors.set(m.id, m.color));
  let regionMask: number[] = [];
  const colorById = new Map<number, string>();
  const suggested: string[] = [];
  let nextRegionId = 0;

  for (const { obj, transform } of parts) {
    const matrix = transform ? new THREE.Matrix4().fromArray(transform) : new THREE.Matrix4();
    const unitScale = unitToMeters(unit);
    const baseVertex = positions.length / 3;
    const localRegionForMat = new Map<number, number>();

    const v = new THREE.Vector3();
    for (let i = 0; i < obj.vertices.length; i += 3) {
      v.set(obj.vertices[i], obj.vertices[i + 1], obj.vertices[i + 2]);
      if (unitScale !== 1) v.multiplyScalar(unitScale);
      v.applyMatrix4(matrix);
      positions.push(v.x, v.y, v.z);
    }

    for (let vi = 0; vi < obj.vertices.length / 3; vi++) {
      const matId = obj.materials?.[vi] ?? null;
      let regionId = 0;
      if (matId !== null) {
        if (!localRegionForMat.has(matId)) {
          nextRegionId++;
          localRegionForMat.set(matId, nextRegionId);
          const color = materialColors.get(matId) || "#888888";
          colorById.set(nextRegionId, color);
          if (!suggested.includes(color)) suggested.push(color);
        }
        regionId = localRegionForMat.get(matId)!;
      }
      regionMask.push(regionId);
    }

    for (const tri of obj.triangles) {
      indices.push(baseVertex + tri[0], baseVertex + tri[1], baseVertex + tri[2]);
    }
  }

  if (regionMask.length === 0 || regionMask.every((r) => r === 0)) {
    return {
      geometry: buildGeometry(positions, indices, colors),
      suggestedColors: [],
      objects: [],
    };
  }

  regionMask.forEach((regionId) => {
    const color = colorById.get(regionId) || "#888888";
    const c = new THREE.Color(color);
    colors.push(c.r, c.g, c.b);
  });

  const geometry = buildGeometry(positions, indices, colors);
  const objectList = Array.from(colorById.entries()).map(([id, color]) => ({
    name: `Region ${id}`,
    color,
  }));

  return {
    geometry,
    regionMask: new Uint8Array(regionMask),
    suggestedColors: suggested,
    objects: objectList,
  };
}

function buildGeometry(positions: number[], indices: number[], colors: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length > 0) {
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.center();
  geometry.computeBoundingBox();
  return geometry;
}

function normalizeColor(color: string): string {
  let c = color.trim();
  if (c.startsWith("#")) {
    if (c.length === 9) c = c.slice(0, 7); // #RRGGBBAA → #RRGGBB
    return c;
  }
  // 0xRRGGBB or RRGGBB form used by some slicers.
  if (c.startsWith("0x")) {
    return `#${c.slice(2).padStart(6, "0")}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c}`;
  return "#888888";
}

function unitToMeters(unit: string): number {
  switch (unit) {
    case "micron": return 0.001;
    case "centimeter": return 10;
    case "inch": return 25.4;
    case "foot": return 304.8;
    case "meter": return 1000;
    default: return 1; // millimeter
  }
}