import type { BufferGeometry } from "three";

export interface ExportPiece {
  geometry: BufferGeometry;
  color: string;
  name: string;
}