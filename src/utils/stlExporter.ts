import * as THREE from 'three';

export function exportToBinarySTL(
  parts: { geom: THREE.BufferGeometry; zOffset: number }[]
): ArrayBuffer {
  let totalTriangles = 0;
  for (const part of parts) {
    if (part.geom.index) {
      totalTriangles += part.geom.index.count / 3;
    } else {
      totalTriangles += part.geom.attributes.position.count / 3;
    }
  }

  const buffer = new ArrayBuffer(84 + 50 * totalTriangles);
  const view = new DataView(buffer);

  view.setUint32(80, totalTriangles, true);

  let offset = 84;
  let triangleIndex = 0;

  for (const part of parts) {
    const geom = part.geom;
    const position = geom.attributes.position;
    const index = geom.index;
    const zOffset = part.zOffset || 0;

    if (index) {
      const idx = index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i];
        const b = idx[i + 1];
        const c = idx[i + 2];

        const ax = position.getX(a);
        const ay = position.getY(a);
        const az = position.getZ(a) + zOffset;
        const bx = position.getX(b);
        const by = position.getY(b);
        const bz = position.getZ(b) + zOffset;
        const cx = position.getX(c);
        const cy = position.getY(c);
        const cz = position.getZ(c) + zOffset;

        writeTriangle(view, offset, ax, ay, az, bx, by, bz, cx, cy, cz);
        offset += 50;
        triangleIndex++;
      }
    } else {
      const count = position.count;
      for (let i = 0; i < count; i += 3) {
        const ax = position.getX(i);
        const ay = position.getY(i);
        const az = position.getZ(i) + zOffset;
        const bx = position.getX(i + 1);
        const by = position.getY(i + 1);
        const bz = position.getZ(i + 1) + zOffset;
        const cx = position.getX(i + 2);
        const cy = position.getY(i + 2);
        const cz = position.getZ(i + 2) + zOffset;

        writeTriangle(view, offset, ax, ay, az, bx, by, bz, cx, cy, cz);
        offset += 50;
        triangleIndex++;
      }
    }
  }

  return buffer;
}

function writeTriangle(
  view: DataView,
  offset: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number
): void {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;

  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  const invLen = len > 0 ? 1 / len : 0;

  view.setFloat32(offset, nx * invLen, true);
  view.setFloat32(offset + 4, ny * invLen, true);
  view.setFloat32(offset + 8, nz * invLen, true);

  view.setFloat32(offset + 12, ax, true);
  view.setFloat32(offset + 16, ay, true);
  view.setFloat32(offset + 20, az, true);

  view.setFloat32(offset + 24, bx, true);
  view.setFloat32(offset + 28, by, true);
  view.setFloat32(offset + 32, bz, true);

  view.setFloat32(offset + 36, cx, true);
  view.setFloat32(offset + 40, cy, true);
  view.setFloat32(offset + 44, cz, true);

  view.setUint16(offset + 48, 0, true);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}