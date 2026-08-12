import * as THREE from "three";
import type { ExportPiece } from "./types";

export interface STLExportInput {
  pieces: ExportPiece[];
  filename?: string;
}

/**
 * Binary STL: geometry has no color, so all pieces are flattened into a single
 * binary STL whose header records piece names.
 */
export async function exportSTL(input: STLExportInput): Promise<Blob> {
  const { pieces, filename = "split" } = input;

  const triangles: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; normal: THREE.Vector3 }[] = [];

  for (const piece of pieces) {
    const geo = piece.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const idx = geo.index?.array;
    const readTri = (i0: number, i1: number, i2: number) => {
      const a = v3At(pos, i0);
      const b = v3At(pos, i1);
      const c = v3At(pos, i2);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      triangles.push({ a, b, c, normal: n });
    };
    if (idx) {
      for (let t = 0; t < idx.length; t += 3) readTri(idx[t] as number, idx[t + 1] as number, idx[t + 2] as number);
    } else {
      for (let t = 0; t < pos.count; t += 3) readTri(t, t + 1, t + 2);
    }
  }

  const header = `split3mf:${pieces.map((p) => sanitizeName(p.name)).join(",")}`.padEnd(80, " ").slice(0, 80);
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const dv = new DataView(buffer);
  for (let i = 0; i < 80; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, triangles.length, true);

  let off = 84;
  for (const t of triangles) {
    dv.setFloat32(off, t.normal.x, true);
    dv.setFloat32(off + 4, t.normal.y, true);
    dv.setFloat32(off + 8, t.normal.z, true);
    dv.setFloat32(off + 12, t.a.x, true);
    dv.setFloat32(off + 16, t.a.y, true);
    dv.setFloat32(off + 20, t.a.z, true);
    dv.setFloat32(off + 24, t.b.x, true);
    dv.setFloat32(off + 28, t.b.y, true);
    dv.setFloat32(off + 32, t.b.z, true);
    dv.setFloat32(off + 36, t.c.x, true);
    dv.setFloat32(off + 40, t.c.y, true);
    dv.setFloat32(off + 44, t.c.z, true);
    dv.setUint16(off + 48, 0, true);
    off += 50;
  }

  return filename ? new File([buffer], `${filename}.stl`, { type: "model/stl" }) : new Blob([buffer], { type: "model/stl" });
}

function v3At(pos: THREE.BufferAttribute, i: number): THREE.Vector3 {
  return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_") || "piece";
}