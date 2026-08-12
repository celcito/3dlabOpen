import type { ParsedSplitFile } from "../state/splitTypes";
import { parseThreeMF } from "./threeMFParser";
import { parseGLB } from "./glbParser";
import { parseOBJ } from "./objParser";

const MAX_FILE_SIZE = 200 * 1024 * 1024;

const EXT_THE_MF: Record<string, "3mf" | "glb" | "obj" | null> = {
  "3mf": "3mf",
  glb: "glb",
  obj: "obj",
  mtl: "obj",
};

export function detectExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 * Dispatches a split-3MF supported file to the right parser using extension,
 * with magic-byte sniffing as a fallback for mislabeled files.
 */
export async function parseSplitFile(file: File): Promise<ParsedSplitFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(file.size / 1024 / 1024)} MB). Hard limit is 200 MB.`);
  }
  if (file.size > 50 * 1024 * 1024) {
    console.warn("Large file (>50 MB) — processing may be slow.");
  }

  const buf = await file.arrayBuffer();
  const ext = detectExtension(file.name);

  // Extension is authoritative; magic bytes only rescue mislabeled 3MF/GLB.
  const kind = EXT_THE_MF[ext] ?? sniffKind(buf);

  if (kind === "3mf") {
    const parsed = await parseThreeMF(buf);
    return {
      geometry: parsed.geometry,
      regionMask: parsed.regionMask,
      suggestedColors: parsed.suggestedColors,
      fileName: file.name,
    };
  }

  if (kind === "glb") {
    const parsed = await parseGLB(buf);
    return {
      geometry: parsed.geometry,
      suggestedColors: parsed.suggestedColors,
      fileName: file.name,
    };
  }

  if (kind === "obj") {
    const text = new TextDecoder().decode(buf);
    const parsed = await parseOBJ(text);
    return {
      geometry: parsed.geometry,
      regionMask: parsed.regionMask,
      suggestedColors: parsed.suggestedColors,
      fileName: file.name,
    };
  }

  throw new Error(`Unsupported format ".${ext}". Use .3mf, .glb, or .obj`);
}

function sniffKind(buf: ArrayBuffer): "3mf" | "glb" | null {
  if (buf.byteLength < 4) return null;
  if (isZipMagic(buf)) return "3mf";
  if (isGlbMagic(buf)) return "glb";
  return null;
}

export function isZipMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const dv = new DataView(buf);
  return (
    dv.getUint8(0) === 0x50 &&
    dv.getUint8(1) === 0x4b &&
    dv.getUint8(2) === 0x03 &&
    dv.getUint8(3) === 0x04
  );
}

// 0x676c5446 = "glTF" as big-endian uint32 (magic per glTF 2.0 spec).
export function isGlbMagic(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const dv = new DataView(buf);
  return dv.getUint32(0, false) === 0x676c5446;
}