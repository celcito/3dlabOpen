import { zipSync } from 'fflate';
import type * as THREE from 'three';
import { exportToBinarySTL } from '../pencilTopper/stlExporter';

export interface ThermoformStlPart {
  /** Nome do arquivo (sem extensão) — ex.: `mold`, `press`, `folha`, `encaixe`. */
  id: string;
  /** Cascas fechadas da peça (empilhadas a z=0, como no export solto). */
  geoms: THREE.BufferGeometry[];
}

/** Zip com um STL binário por peça (`[X4]`). */
export function exportThermoformStlZip(parts: ThermoformStlPart[]): Blob {
  const files: Record<string, Uint8Array> = {};
  for (const part of parts) {
    if (!part.geoms.length) continue;
    const buffer = exportToBinarySTL(part.geoms);
    files[`${part.id}.stl`] = new Uint8Array(buffer);
  }
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: 'application/zip' });
}
