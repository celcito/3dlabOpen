import * as THREE from "three";
import type { ExportPiece } from "./types";

export interface OBJExportInput {
  pieces: ExportPiece[];
  filename?: string;
}

interface OBJResult {
  obj: string;
  mtl: string;
}

const MATERIAL_PREFIX = "piece";

/**
 * OBJ + .mtl export grouped by color: each piece becomes its own `o`/`usemtl`
 * group and gets a `newmtl` entry in the accompanying MTL file.
 */
export function buildObjAndMtl(pieces: ExportPiece[]): OBJResult {
  const objLines: string[] = ["# exported by split3mf"];
  const mtlLines: string[] = ["# exported by split3mf"];
  let vertexOffset = 1;

  pieces.forEach((piece, i) => {
    const geo = piece.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const idx = geo.index?.array;
    const matName = `${MATERIAL_PREFIX}_${i}`;
    const color = new THREE.Color(piece.color);

    objLines.push(`\no ${sanitizeName(piece.name)}`);
    objLines.push(`usemtl ${matName}`);
    for (let v = 0; v < pos.count; v++) {
      objLines.push(`v ${fmt(pos.getX(v))} ${fmt(pos.getY(v))} ${fmt(pos.getZ(v))}`);
    }
    if (idx) {
      for (let t = 0; t < idx.length; t += 3) {
        objLines.push(`f ${vertexOffset + idx[t]} ${vertexOffset + idx[t + 1]} ${vertexOffset + idx[t + 2]}`);
      }
    } else {
      for (let t = 0; t < pos.count; t += 3) {
        objLines.push(`f ${vertexOffset + t} ${vertexOffset + t + 1} ${vertexOffset + t + 2}`);
      }
    }
    vertexOffset += pos.count;

    mtlLines.push(`\nnewmtl ${matName}`);
    mtlLines.push(`Kd ${color.r.toFixed(6)} ${color.g.toFixed(6)} ${color.b.toFixed(6)}`);
    mtlLines.push(`Ka 0 0 0`);
    mtlLines.push(`Ks 0 0 0`);
  });

  return { obj: objLines.join("\n"), mtl: mtlLines.join("\n") };
}

export async function exportOBJ(input: OBJExportInput): Promise<Blob> {
  const { pieces, filename = "split" } = input;
  const { obj, mtl } = buildObjAndMtl(pieces);
  // Bundle .obj + .mtl in a single zip so the material travels with the model.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(`${filename}.obj`, obj);
  zip.file(`${filename}.mtl`, mtl);
  const blob = await zip.generateAsync({ type: "blob" });
  return filename ? new File([blob], `${filename}_obj.zip`, { type: "application/zip" }) : blob;
}

function fmt(n: number): string {
  return n.toFixed(6).replace(/\.?0+$/, "");
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_") || "piece";
}