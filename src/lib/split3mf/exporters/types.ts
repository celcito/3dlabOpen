import type { BufferGeometry } from "three";

export interface ExportPiece {
  geometry: BufferGeometry;
  regionId: number;
  color: string;
  name: string;
}
