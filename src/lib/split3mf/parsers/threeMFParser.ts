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
  const modelEntry = findModelEntry(zip);
  if (!modelEntry) {
    throw new Error("3MF sem arquivo de modelo 3D (.model)");
  }
  const xml = await modelEntry.async("string");
  const doc = parseModelXml(xml);

  const model = doc.querySelector("model");
  const unit = model?.getAttribute("unit") || "millimeter";

  // Bambu Studio stores large meshes in 3D/Objects/object_*.model and keeps
  // only component references in the package's core model.
  const modelDocs = [doc];
  const referencedPaths = new Set<string>();
  doc.querySelectorAll("component").forEach((component) => {
    const path = component.getAttribute("p:path") || component.getAttributeNS("http://schemas.microsoft.com/3dmanufacturing/production/2015/06", "path");
    if (path) referencedPaths.add(normalizeZipPath(path));
  });
  for (const path of referencedPaths) {
    const entry = zip.file(path) ?? findZipEntry(zip, path);
    if (!entry || entry === modelEntry) continue;
    const externalXml = await entry.async("string");
    try {
      modelDocs.push(parseModelXml(externalXml));
    } catch {
      // Metadata files can use the .model suffix in third-party packages.
    }
  }

  const materials = modelDocs.flatMap((modelDoc) => collectMaterials(modelDoc));
  const objects = modelDocs.flatMap((modelDoc) => collectObjects(modelDoc, materials));

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
  const appendObject = (objectId: number, parentTransform?: number[], stack = new Set<number>()) => {
    if (stack.has(objectId)) return;
    const obj = objects.find((candidate) => candidate.id === objectId);
    if (!obj) return;
    const nextStack = new Set(stack).add(objectId);
    if (obj.vertices.length > 0 && obj.triangles.length > 0) {
      parts.push({ obj, transform: parentTransform });
    }
    for (const component of obj.components) {
      appendObject(component.objectid, composeTransform(parentTransform, component.transform), nextStack);
    }
  };
  for (const item of buildItems) appendObject(item.objectid, item.transform);

  const merged = mergeParts(parts, unit, materials);
  return merged;
}

function normalizeZipPath(path: string): string {
  return path.replace(/^\/+/, "");
}

function findZipEntry(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const normalized = path.toLowerCase();
  return Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase() === normalized) ?? null;
}

function parseModelXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror") || !doc.querySelector("model")) {
    throw new Error("3MF com XML de modelo inválido");
  }
  return doc;
}

function findModelEntry(zip: JSZip): JSZip.JSZipObject | null {
  const exact = zip.file("3D/3dmodel.model");
  if (exact) return exact;

  // Some slicers change the case or store the core model under another 3D path.
  const candidates = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith(".model")
  );
  return candidates.find((entry) => entry.name.toLowerCase().includes("3d/")) ?? candidates[0] ?? null;
}

interface ParsedObject {
  id: number;
  name: string;
  vertices: number[];
  triangles: number[][];
  materials: number[] | null;
  triangleMaterials: (number | null)[];
  components: { objectid: number; transform?: number[] }[];
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

    // Keep the effective material per triangle so shared vertices can be split
    // at material seams during merge.
    const perVertexMats: (number | null)[] = new Array(vertices.length / 3).fill(null);
    const triangleMaterials = triangles.map((tri, ti) => trianglePids[ti] ?? vertexPids[tri[0]] ?? null);
    triangleMaterials.forEach((matId, ti) => {
      if (matId === null) return;
      triangles[ti].forEach((vi) => { if (perVertexMats[vi] === null) perVertexMats[vi] = matId; });
    });
    // Backfill from vertex pids for vertices never referenced (rare).
    vertexPids.forEach((pid, vi) => { if (perVertexMats[vi] === null) perVertexMats[vi] = pid; });

    const components: { objectid: number; transform?: number[] }[] = [];
    el.querySelectorAll(":scope > components > component").forEach((component) => {
      const objectid = Number(component.getAttribute("objectid"));
      if (Number.isNaN(objectid)) return;
      const transform = component.getAttribute("transform");
      components.push({
        objectid,
        transform: transform ? transform.trim().split(/\s+/).map(Number) : undefined,
      });
    });

    objects.push({
      id,
      name: el.getAttribute("name") || `Object ${id}`,
      vertices,
      triangles,
      materials: perVertexMats,
      triangleMaterials,
      components,
    });
  });
  return objects;
}

function composeTransform(parent?: number[], child?: number[]): number[] | undefined {
  if (!parent && !child) return undefined;
  const parentMatrix = toMatrix4(parent);
  const childMatrix = toMatrix4(child);
  return new THREE.Matrix4().multiplyMatrices(parentMatrix, childMatrix).toArray();
}

function toMatrix4(values?: number[]): THREE.Matrix4 {
  if (!values || values.length === 0) return new THREE.Matrix4();
  if (values.length === 12) {
    // 3MF stores transforms as nine row-major rotation/scale values followed
    // by the translation vector: m00 m01 m02 m10 ... m22 tx ty tz.
    return new THREE.Matrix4().set(
      values[0], values[1], values[2], values[9],
      values[3], values[4], values[5], values[10],
      values[6], values[7], values[8], values[11],
      0, 0, 0, 1
    );
  }
  return new THREE.Matrix4().fromArray(values);
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
    const matrix = toMatrix4(transform);
    const unitScale = unitToMeters(unit);
    const localRegionForMat = new Map<number, number>();
    const localVertexByMaterial = new Map<string, number>();
    const transformedVertices: number[] = [];

    const v = new THREE.Vector3();
    for (let i = 0; i < obj.vertices.length; i += 3) {
      v.set(obj.vertices[i], obj.vertices[i + 1], obj.vertices[i + 2]);
      if (unitScale !== 1) v.multiplyScalar(unitScale);
      v.applyMatrix4(matrix);
      transformedVertices.push(v.x, v.y, v.z);
    }

    for (let ti = 0; ti < obj.triangles.length; ti++) {
      const tri = obj.triangles[ti];
      const matId = obj.triangleMaterials[ti] ?? null;
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
      const outputTriangle: number[] = [];
      for (const sourceVertex of tri) {
        const key = `${sourceVertex}:${matId ?? 0}`;
        let outputVertex = localVertexByMaterial.get(key);
        if (outputVertex === undefined) {
          outputVertex = positions.length / 3;
          localVertexByMaterial.set(key, outputVertex);
          const offset = sourceVertex * 3;
          positions.push(
            transformedVertices[offset],
            transformedVertices[offset + 1],
            transformedVertices[offset + 2]
          );
          regionMask.push(regionId);
        }
        outputTriangle.push(outputVertex);
      }
      indices.push(outputTriangle[0], outputTriangle[1], outputTriangle[2]);
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
