import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { RawModel } from "./types";

const CONTENT_TYPES = "[Content_Types].xml";
const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';
const STALE_SLICE = /^(Metadata\/plate_\d+\.gcode|Metadata\/SliceInfo\.config|SliceInfo\.config)$/;

export interface ExportOptions {
  model: RawModel | null;
  settings: Record<string, unknown> | null;
  removeStaleSlice: boolean;
}

/**
 * Reescreve o `.3mf` preservando todo o resto do ZIP: só os documentos de modelo
 * marcados como dirty e `project_settings.config` são substituídos.
 */
export function exportFixed3mf(source: ArrayBuffer, options: ExportOptions): Blob {
  const entries = unzipSync(new Uint8Array(source));
  const names = Object.keys(entries);

  if (options.removeStaleSlice) {
    for (const name of names) if (STALE_SLICE.test(name)) delete entries[name];
  }

  if (options.model) {
    for (const doc of options.model.docs) {
      if (!doc.dirty) continue;
      entries[doc.path] = strToU8(serializeXml(doc.doc));
    }
  }

  if (options.settings) {
    const path = names.find((name) => name.endsWith("Metadata/project_settings.config"));
    if (path) entries[path] = strToU8(JSON.stringify(options.settings));
  }

  if (options.removeStaleSlice && CONTENT_TYPES in entries) {
    entries[CONTENT_TYPES] = strToU8(sanitizeContentTypes(strFromU8(entries[CONTENT_TYPES])));
  }

  const bytes = zipSync(entries, { level: 6 });
  return new Blob([bytes], { type: "model/3mf" });
}

/** Remove os `Default`/`Override` que apontavam para arquivos já apagados. */
function sanitizeContentTypes(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (!root || root.nodeName === "parsererror") return xml;
  Array.from(root.children).forEach((el) => {
    const extension = el.getAttribute("Extension");
    const partName = el.getAttribute("PartName");
    const stale =
      (el.nodeName === "Default" && extension === "gcode") ||
      (el.nodeName === "Override" && partName !== null && STALE_SLICE.test(partName.replace(/^\//, "")));
    if (stale) el.remove();
  });
  return serializeXml(doc);
}

/**
 * O XMLSerializer do Chrome já emite a declaração XML quando o documento de
 * origem tinha uma — concatenar a nossa duplicaria e o reparse falharia.
 */
function serializeXml(doc: Document): string {
  const body = new XMLSerializer().serializeToString(doc).replace(/^\s*<\?xml[\s\S]*?\?>\s*/, "");
  return `${XML_DECL}\n${body}`;
}
