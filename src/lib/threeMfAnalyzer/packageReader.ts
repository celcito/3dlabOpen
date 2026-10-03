import JSZip from "jszip";
import type {
  AnalysisResult,
  BuildItem,
  Issue,
  PackageInfo,
  PackageKind,
  RawDocument,
  RawModel,
  RawObject,
} from "./types";
import { SOURCES } from "./rules";
import { resolveWorldMeshes, runMeshChecks } from "./meshChecks";
import { runSettingsChecks } from "./settingsChecks";
import { runProfileChecks } from "./profiles";

const CAD_APPLICATIONS = ["fusion", "solidworks", "onshape", "freecad", "openscad", "rhino", "inventor", "catia"];

const KIND_LABEL: Record<PackageKind, string> = {
  bambu: "Projeto Bambu Studio",
  prusa: "Projeto PrusaSlicer",
  cura: "Projeto Cura",
  cad: "Export de CAD",
  model: "Modelo 3MF puro",
};

export interface ReadResult {
  info: PackageInfo;
  issues: Issue[];
}

/** Lê o pacote (JSZip, só as entradas necessárias), classifica e monta o modelo cru. */
export async function readPackage(buffer: ArrayBuffer): Promise<ReadResult> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

  const corePath = findModelPath(names);
  if (!corePath) {
    throw new Error('Pacote 3MF inválido: não contém "3D/3dmodel.model" nem nenhum .model');
  }

  const coreDoc = parseModelXml(await zip.files[corePath].async("string"), corePath);
  const docs: RawDocument[] = [{ path: corePath, doc: coreDoc, dirty: false }];

  // Bambu guarda malhas grandes em 3D/Objects/object_*.model e deixa só
  // referências de <component> no modelo central.
  const referenced = new Set<string>();
  coreDoc.querySelectorAll("component").forEach((component) => {
    const path =
      component.getAttribute("p:path") ||
      component.getAttributeNS("http://schemas.microsoft.com/3dmanufacturing/production/2015/06", "path");
    if (path) referenced.add(path.replace(/^\/+/, ""));
  });
  for (const path of referenced) {
    const entry = findEntry(zip, path);
    if (!entry) continue;
    try {
      docs.push({ path: entry.name, doc: parseModelXml(await entry.async("string"), entry.name), dirty: false });
    } catch {
      // Alguns pacotes terceiros usam sufixo .model em arquivos que não são modelo.
    }
  }

  const model = collectModel(corePath, docs);
  const { projectSettings } = await readProjectSettings(zip);
  const application = readApplication(coreDoc);
  const kind = detectKind(names, projectSettings, application);

  const info: PackageInfo = {
    kind,
    kindLabel: KIND_LABEL[kind],
    application,
    unit: model.unit,
    model,
    projectSettings,
    hasModelSettings: names.includes("Metadata/model_settings.config"),
    hasSliceInfo: names.includes("Metadata/SliceInfo.config"),
    plateGcodePaths: names.filter((n) => /Metadata\/plate_.*\.gcode$/i.test(n)),
    colors: collectColors(docs, projectSettings),
    objectNames: model.objects.map((o) => o.name),
  };

  return { info, issues: buildPackageIssues(info, corePath) };
}

/** Análise completa: A (pacote) + B (malha) + C (impressão). */
export async function analyzePackage(buffer: ArrayBuffer): Promise<{ info: PackageInfo; result: AnalysisResult }> {
  const { info, issues } = await readPackage(buffer);
  const meshes = resolveWorldMeshes(info.model);
  const mesh = runMeshChecks(meshes);
  issues.push(...mesh.issues);
  if (info.projectSettings) {
    issues.push(
      ...runSettingsChecks({
        settings: info.projectSettings,
        kind: info.kind,
        hasOverhang: mesh.hasOverhang,
        touchingBed: mesh.touchingBed,
        footprint: mesh.footprint,
        height: mesh.height,
        modelColors: info.colors.length,
      })
    );
    issues.push(
      ...runProfileChecks({
        settings: info.projectSettings,
        objects: mesh.objects,
      })
    );
  }
  const result: AnalysisResult = {
    issues,
    objects: mesh.objects,
    totalTriangles: mesh.totalTriangles,
    meshes,
    boundarySegments: mesh.boundarySegments,
    overhangTriangles: mesh.overhangTriangles,
    highlights: mesh.highlights,
  };
  return { info, result };
}

/* ------------------------------------------------------------------ *
 * Pacote / metadados (A1–A5)
 * ------------------------------------------------------------------ */

function buildPackageIssues(info: PackageInfo, corePath: string): Issue[] {
  const issues: Issue[] = [];

  issues.push({
    id: "A1",
    category: "package",
    severity: "info",
    title: "Pacote 3MF válido",
    detail:
      corePath === "3D/3dmodel.model"
        ? 'Modelo central em "3D/3dmodel.model".'
        : `Modelo central em "${corePath}" (heurística de fallback).`,
    hint: "Nada a fazer.",
    source: SOURCES.packageStructure,
  });

  issues.push({
    id: "A2",
    category: "package",
    severity: "info",
    title: `Tipo detectado: ${info.kindLabel}`,
    detail:
      info.kind === "bambu"
        ? `Projeto fatiado — ${info.plateGcodePaths.length} placa(s) de G-code embutido.`
        : `Classificado pela estrutura do ZIP e pelo metadado Application ("${info.application || "—"}").`,
    hint:
      info.kind === "bambu"
        ? "Alterar a configuração invalida o G-code fatiado (ver S4)."
        : "Sem configuração de slicer: as checagens de impressão serão ignoradas.",
    source: SOURCES.packageStructure,
  });

  if (info.unit !== "millimeter") {
    issues.push({
      id: "A3",
      category: "package",
      severity: "warning",
      title: `Unidade do modelo: ${info.unit}`,
      detail: `As coordenadas estão em "${info.unit}" — o slicer assume mm e a peça sai com escala errada${
        info.unit === "inch" ? " (25,4×)" : ""
      }.`,
      hint: "Ative a correção M5 para converter vértices e translações para millimeter.",
      source: SOURCES.formats,
      fixId: "M5",
    });
  }

  issues.push({
    id: "A4",
    category: "package",
    severity: "info",
    title: "Metadados do pacote",
    detail: `Application: ${info.application || "—"} · ${info.objectNames.length} objeto(s) · ${info.colors.length} cor(es).`,
    hint: "Nomes, cores e thumbnails são preservados no export.",
    source: SOURCES.formats,
  });

  if (info.kind === "bambu" && !info.hasModelSettings) {
    issues.push({
      id: "A5",
      category: "package",
      severity: "warning",
      title: "Projeto Bambu sem model_settings.config",
      detail: 'Falta "Metadata/model_settings.config" — o Bambu Studio não recupera a atribuição de placas/objetos.',
      hint: "Reabrir e salvar no Bambu Studio regenera o arquivo; o export preserva o resto do pacote.",
      source: SOURCES.packageStructure,
    });
  }

  return issues;
}

function detectKind(names: string[], settings: Record<string, unknown> | null, application: string): PackageKind {
  const has = (n: string) => names.includes(n);
  if (settings || has("Metadata/SliceInfo.config") || names.some((n) => /Metadata\/plate_.*\.gcode$/i.test(n))) {
    return "bambu";
  }
  if (has("Metadata/Slic3r_PE.config") || has("Metadata/Slic3r_PE_model.config")) return "prusa";
  if (names.some((n) => n.startsWith("Cura/"))) return "cura";
  const app = application.toLowerCase();
  if (CAD_APPLICATIONS.some((key) => app.includes(key))) return "cad";
  return "model";
}

function readApplication(doc: Document): string {
  let value = "";
  doc.querySelectorAll("metadata").forEach((meta) => {
    if ((meta.getAttribute("name") || "").toLowerCase() === "application") {
      value = meta.textContent?.trim() || value;
    }
  });
  return value;
}

function collectColors(docs: RawDocument[], settings: Record<string, unknown> | null): string[] {
  const colors = new Set<string>();
  docs.forEach(({ doc }) => {
    doc.querySelectorAll("base").forEach((base) => {
      const raw = base.getAttribute("displaycolor") || base.getAttribute("color");
      if (raw) colors.add(normalizeColor(raw));
    });
  });
  const filament = settings?.filament_colour;
  if (Array.isArray(filament)) filament.forEach((c) => typeof c === "string" && colors.add(normalizeColor(c)));
  return [...colors];
}

function normalizeColor(raw: string): string {
  const c = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toUpperCase();
  if (/^#[0-9a-fA-F]{8}$/.test(c)) return c.slice(0, 7).toUpperCase();
  if (/^0x[0-9a-fA-F]{6}$/.test(c)) return `#${c.slice(2)}`.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c}`.toUpperCase();
  return "#888888";
}

async function readProjectSettings(
  zip: JSZip
): Promise<{ projectSettings: Record<string, unknown> | null }> {
  const entry = zip.file("Metadata/project_settings.config");
  if (!entry) return { projectSettings: null };
  try {
    const parsed = JSON.parse(await entry.async("string"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { projectSettings: parsed as Record<string, unknown> };
    }
  } catch {
    // Config não-JSON (alguns slicers gravam INI) — tratado como ausente.
  }
  return { projectSettings: null };
}

/* ------------------------------------------------------------------ *
 * Modelo cru (sem geometry.center(), sem perder transforms)
 * ------------------------------------------------------------------ */

function collectModel(corePath: string, docs: RawDocument[]): RawModel {
  const objects: RawObject[] = [];
  docs.forEach(({ path, doc }) => {
    doc.querySelectorAll("object").forEach((el) => {
      const id = Number(el.getAttribute("id"));
      if (Number.isNaN(id)) return;
      const mesh = el.querySelector(":scope > mesh");
      const vertices: number[] = [];
      const triangles: number[] = [];
      mesh?.querySelectorAll(":scope > vertices > vertex").forEach((v) => {
        vertices.push(Number(v.getAttribute("x")), Number(v.getAttribute("y")), Number(v.getAttribute("z")));
      });
      mesh?.querySelectorAll(":scope > triangles > triangle").forEach((t) => {
        triangles.push(Number(t.getAttribute("v1")), Number(t.getAttribute("v2")), Number(t.getAttribute("v3")));
      });
      const components: { objectid: number; transform?: number[] }[] = [];
      el.querySelectorAll(":scope > components > component").forEach((component) => {
        const objectid = Number(component.getAttribute("objectid"));
        if (Number.isNaN(objectid)) return;
        const transform = component.getAttribute("transform");
        components.push({ objectid, transform: transform ? transform.trim().split(/\s+/).map(Number) : undefined });
      });
      objects.push({
        docPath: path,
        id,
        name: el.getAttribute("name") || `Object ${id}`,
        element: el,
        meshElement: mesh,
        vertices,
        triangles,
        components,
      });
    });
  });

  const core = docs.find((d) => d.path === corePath) ?? docs[0];
  const buildItems: BuildItem[] = [];
  core.doc.querySelectorAll("build > item").forEach((item) => {
    const objectid = Number(item.getAttribute("objectid"));
    if (Number.isNaN(objectid)) return;
    const transform = item.getAttribute("transform");
    buildItems.push({ objectid, transform: transform ? transform.trim().split(/\s+/).map(Number) : undefined });
  });

  return {
    corePath,
    docs,
    unit: core.doc.querySelector("model")?.getAttribute("unit") || "millimeter",
    objects,
    buildItems,
  };
}

/* ------------------------------------------------------------------ *
 * Auxiliares ZIP/XML
 * ------------------------------------------------------------------ */

function findEntry(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const target = path.toLowerCase();
  return Object.values(zip.files).find((e) => !e.dir && e.name.toLowerCase() === target) ?? null;
}

/** Mesma heurística de `threeMFParser.ts:109-118`. */
function findModelPath(names: string[]): string | null {
  if (names.includes("3D/3dmodel.model")) return "3D/3dmodel.model";
  const candidates = names.filter((n) => n.toLowerCase().endsWith(".model"));
  return candidates.find((n) => n.toLowerCase().includes("3d/")) ?? candidates[0] ?? null;
}

function parseModelXml(xml: string, path: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror") || !doc.querySelector("model")) {
    throw new Error(`3MF com XML de modelo inválido: ${path}`);
  }
  return doc;
}
