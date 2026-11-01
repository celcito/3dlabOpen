import * as THREE from "three";
import { downloadBlob, exportToBinarySTL } from "../pencilTopper/stlExporter";
import { exportThermoformStlZip, type ThermoformStlPart } from "../thermoform/stlKit";
import { exportThermoform3MF, type Thermoform3MFItem } from "../thermoform/threeMfExporter";
import type { Plaque, PlaquePart } from "./plaque";
import { buildPlaqueParts, getPlaqueBounds } from "./plaqueGeometry";

/** Folga entre plaquinhas no 3MF e largura máxima de fileira (mesmo padrão do thermoform). */
export const PLAQUE_LAYOUT_GAP_MM = 5;
export const PLAQUE_LAYOUT_MAX_ROW_MM = 250;

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "plaquinha";
}

function flattenParts(parts: PlaquePart[]): THREE.BufferGeometry[] {
  const geoms: THREE.BufferGeometry[] = [];
  for (const part of parts) {
    for (const geom of part.geoms) geoms.push(geom);
  }
  return geoms;
}

/**
 * Grade de plaquinhas: empacota por largura em fileiras de até 250 mm com 5 mm
 * de folga. Retorna a posição (canto inferior-esquerdo do bbox) de cada peça —
 * o exporter de 3MF não aplica transform por item, então a posição entra
 * **assada** na geometria.
 */
export function packPlaqueLayout(
  sizes: Array<{ width: number; height: number }>,
  gap: number = PLAQUE_LAYOUT_GAP_MM,
  maxRowWidth: number = PLAQUE_LAYOUT_MAX_ROW_MM
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let curX = 0;
  let curY = 0;
  let rowH = 0;
  sizes.forEach((size, i) => {
    if (i > 0 && curX + size.width > maxRowWidth) {
      curX = 0;
      curY -= rowH + gap;
      rowH = 0;
    }
    positions.push({ x: curX, y: curY });
    curX += size.width + gap;
    rowH = Math.max(rowH, size.height);
  });
  return positions;
}

function translated(geoms: THREE.BufferGeometry[], dx: number, dy: number, dz: number): THREE.BufferGeometry[] {
  return geoms.map((g) => {
    const copy = g.clone();
    copy.translate(dx, dy, dz);
    return copy;
  });
}

/** STL único da plaquinha atual (todas as parts em um arquivo). */
export async function buildPlaqueStl(plaque: Plaque): Promise<Blob> {
  const parts = await buildPlaqueParts(plaque);
  const geoms = flattenParts(parts);
  const buffer = exportToBinarySTL(geoms);
  return new Blob([buffer], { type: "application/octet-stream" });
}

/** Zip com 1 STL binário por plaquinha (uma peça colorida por arquivo). */
export async function buildPlaqueStlZip(plaques: Plaque[]): Promise<Blob> {
  const parts: ThermoformStlPart[] = [];
  let index = 0;
  for (const plaque of plaques) {
    const built = await buildPlaqueParts(plaque);
    const geoms = flattenParts(built);
    if (geoms.length === 0) continue;
    index += 1;
    parts.push({ id: sanitizeFileName(`${index}_${plaque.label}`), geoms });
  }
  return exportThermoformStlZip(parts);
}

/** 3MF único multicolor: uma part colorida por objeto, grade com folga de 5 mm. */
export async function buildPlaques3MF(plaques: Plaque[], title: string): Promise<Blob> {
  const builtList: Array<{ plaque: Plaque; parts: PlaquePart[] }> = [];
  for (const plaque of plaques) {
    const parts = await buildPlaqueParts(plaque);
    builtList.push({ plaque, parts });
  }

  const sizes = builtList.map(({ parts }) => {
    const b = getPlaqueBounds(parts);
    return { width: b.maxX - b.minX, height: b.maxY - b.minY };
  });
  const positions = packPlaqueLayout(sizes);

  const items: Thermoform3MFItem[] = [];
  builtList.forEach(({ plaque, parts }, plaqueIdx) => {
    const bounds = getPlaqueBounds(parts);
    const pos = positions[plaqueIdx];
    const dx = pos.x - bounds.minX;
    const dy = pos.y - bounds.minY;
    for (const part of parts) {
      if (part.geoms.length === 0) continue;
      items.push({
        geoms: translated(part.geoms, dx, dy, 0),
        name: `${plaque.label} ${part.name}`,
        color: part.color,
      });
    }
  });

  return exportThermoform3MF(items, title);
}

export async function downloadPlaqueStl(plaque: Plaque, fileName?: string): Promise<void> {
  const blob = await buildPlaqueStl(plaque);
  downloadBlob(blob, fileName ?? `${sanitizeFileName(plaque.label)}.stl`);
}

export async function downloadPlaqueStlZip(plaques: Plaque[], fileName = "plaquinhas.zip"): Promise<void> {
  const blob = await buildPlaqueStlZip(plaques);
  downloadBlob(blob, fileName);
}

export async function downloadPlaque3MF(plaques: Plaque[], fileName = "plaquinhas.3mf"): Promise<void> {
  const blob = await buildPlaques3MF(plaques, "Plaquinhas de Topo de Bolo");
  downloadBlob(blob, fileName);
}
