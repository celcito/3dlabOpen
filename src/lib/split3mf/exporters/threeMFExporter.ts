import * as THREE from "three";
import { ThreeMFExporter } from "../../ThreeMFExporter";
import type { ExportPiece } from "./types";

export interface ThreeMFExportInput {
  pieces: ExportPiece[];
  filename?: string;
}

/**
 * Multi-object 3MF export: one `<object>` per piece, each referencing a color
 * resource. Reuses the existing `src/lib/ThreeMFExporter` by merging pieces into
 * a single indexed geometry and tagging per-vertex groups.
 */
export async function exportThreeMF(input: ThreeMFExportInput): Promise<Blob> {
  const { pieces, filename = "split" } = input;
  const merged = mergePieces(pieces);
  const exporter = new ThreeMFExporter();
  return exporter
    .parse(merged.geometry, merged.vertexGroups, merged.groups)
    .then((blob) => {
      return filename ? new File([blob], `${filename}.3mf`, { type: "application/vnd.ms-package.3dmanufacturing-3dmodel" }) : blob;
    });
}

type Merged = {
  geometry: THREE.BufferGeometry;
  vertexGroups: Uint8Array;
  groups: { id: number; color: string; name: string }[];
};

/**
 * Merges per-piece indexed geometries into one indexed geometry. Group id for a
 * vertex is `pieceIndex + 1` (id 0 reserved for unpainted base, as in the
 * original exporter).
 */
export function mergePieces(pieces: ExportPiece[]): Merged {
  const mergedPos: number[] = [];
  const mergedIdx: number[] = [];
  const groupIds: number[] = [];
  const groups: { id: number; color: string; name: string }[] = [];

  pieces.forEach((piece, pi) => {
    const geo = piece.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index?.array ?? rangeTriangles(pos.count);
    if (!pos) return;
    const base = mergedPos.length / 3;
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      mergedPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      groupIds.push(pi + 1);
    }
    for (let i = 0; i < idx.length; i++) {
      mergedIdx.push((idx[i] as number) + base);
    }
    groups.push({ id: pi + 1, color: piece.color, name: piece.name });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mergedPos, 3));
  geometry.setIndex(mergedIdx);

  return { geometry, vertexGroups: new Uint8Array(groupIds), groups };
}

function rangeTriangles(vertexCount: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < vertexCount; i += 3) out.push(i, i + 1, i + 2);
  return out;
}