import * as THREE from 'three';
import { ModelLineart, ModelSettings } from '../types';

export interface PrinterBedPreset {
  id: string;
  name: string;
  brand: string;
  widthMm: number; // X axis
  depthMm: number; // Y axis
  heightMm: number; // Z axis
  isRound?: boolean;
}

export const PRINTER_BED_PRESETS: PrinterBedPreset[] = [
  { id: 'bambu_x1', name: 'Bambu Lab X1 / P1S / P1P / A1', brand: 'Bambu Lab', widthMm: 256, depthMm: 256, heightMm: 256 },
  { id: 'ender_3', name: 'Creality Ender 3 / V2 / S1 / V3', brand: 'Creality', widthMm: 220, depthMm: 220, heightMm: 250 },
  { id: 'prusa_mk4', name: 'Original Prusa MK3S+ / MK4 / MK4S', brand: 'Prusa', widthMm: 250, depthMm: 210, heightMm: 220 },
  { id: 'k1_max', name: 'Creality K1 Max / CR-10 / Artillery', brand: 'Grandes Formatos', widthMm: 300, depthMm: 300, heightMm: 300 },
  { id: 'neptune_4', name: 'Elegoo Neptune 4 / Anycubic Kobra 2', brand: 'Elegoo / Anycubic', widthMm: 225, depthMm: 225, heightMm: 265 },
  { id: 'a1_mini', name: 'Bambu Lab A1 Mini', brand: 'Bambu Lab', widthMm: 180, depthMm: 180, heightMm: 180 },
  { id: 'voron_350', name: 'Voron 2.4 / Trident (350mm)', brand: 'Voron', widthMm: 350, depthMm: 350, heightMm: 350 },
  { id: 'custom', name: 'Tamanho Personalizado', brand: 'Custom', widthMm: 220, depthMm: 220, heightMm: 200 },
];

export type BedItemPart = 'cutter' | 'stamp';

export interface BedItem {
  id: string;
  model: ModelLineart;
  settings: ModelSettings;
  part: BedItemPart;
  label: string;
  // Dimensions in mm
  widthMm: number;
  depthMm: number;
  // Position on bed in mm (0,0 is center of bed)
  posX: number;
  posY: number;
  rotationDeg: number; // 0, 90, 180, 270
  // Validation
  isOutOfBounds: boolean;
  colorHex: string;
}

export interface NestingOptions {
  bedWidthMm: number;
  bedDepthMm: number;
  spacingMm: number; // Spacing between items (default 5mm)
  marginMm: number; // Margin from bed edges (default 6mm)
  allowRotation: boolean; // Allow 90° rotation
}

export interface NestingResult {
  items: BedItem[];
  allFit: boolean;
  occupancyPercent: number;
  totalFilamentGrams: number;
  totalTimeMinutes: number;
  totalCount: number;
}

/**
 * Packs multiple items on a rectangular 2D build plate using a shelf / best-fit bin packing algorithm
 */
export function autoNestBedItems(
  items: BedItem[],
  options: NestingOptions
): NestingResult {
  if (items.length === 0) {
    return {
      items: [],
      allFit: true,
      occupancyPercent: 0,
      totalFilamentGrams: 0,
      totalTimeMinutes: 0,
      totalCount: 0,
    };
  }

  const { bedWidthMm, bedDepthMm, spacingMm, marginMm, allowRotation } = options;
  const usableWidth = bedWidthMm - marginMm * 2;
  const usableDepth = bedDepthMm - marginMm * 2;

  // Clone items to avoid mutating input directly
  const toPack = items.map((item) => {
    return {
      ...item,
      // Effective footprint
      w: item.widthMm + spacingMm,
      h: item.depthMm + spacingMm,
      rot: 0,
    };
  });

  // Sort descending by maximum dimension, then by area (Best Fit Decreasing)
  toPack.sort((a, b) => {
    const maxA = Math.max(a.w, a.h);
    const maxB = Math.max(b.w, b.h);
    if (Math.abs(maxA - maxB) > 0.001) return maxB - maxA;
    return b.w * b.h - a.w * a.h;
  });

  // Shelf-first 2D Packing
  let currentShelfY = 0;
  let currentShelfHeight = 0;
  let currentX = 0;

  const placedItems: { item: BedItem; x: number; y: number; rot: number; w: number; h: number }[] = [];

  for (const item of toPack) {
    let itemW = item.w;
    let itemH = item.h;
    let rot = 0;

    // Check if rotating 90° fits better across the shelf width
    if (allowRotation) {
      if (currentX + itemW > usableWidth && currentX + itemH <= usableWidth) {
        // Rotated fits on current shelf
        itemW = item.h;
        itemH = item.w;
        rot = 90;
      }
    }

    // If it doesn't fit horizontally on the current shelf, wrap to next shelf
    if (currentX + itemW > usableWidth) {
      currentShelfY += currentShelfHeight;
      currentX = 0;
      currentShelfHeight = 0;

      // Re-evaluate orientation for fresh shelf
      if (allowRotation && item.w > item.h && item.h + spacingMm <= usableWidth) {
        // Lay flatter if beneficial
        itemW = item.w;
        itemH = item.h;
        rot = 0;
      }
    }

    // Place item on current shelf
    placedItems.push({
      item: { ...item },
      x: currentX + itemW / 2,
      y: currentShelfY + itemH / 2,
      rot,
      w: itemW - spacingMm,
      h: itemH - spacingMm,
    });

    currentX += itemW;
    currentShelfHeight = Math.max(currentShelfHeight, itemH);
  }

  // Calculate bounding box of the packed cluster
  let minClusterX = Infinity;
  let maxClusterX = -Infinity;
  let minClusterY = Infinity;
  let maxClusterY = -Infinity;

  for (const p of placedItems) {
    minClusterX = Math.min(minClusterX, p.x - p.w / 2);
    maxClusterX = Math.max(maxClusterX, p.x + p.w / 2);
    minClusterY = Math.min(minClusterY, p.y - p.h / 2);
    maxClusterY = Math.max(maxClusterY, p.y + p.h / 2);
  }

  const clusterCenterX = (minClusterX + maxClusterX) / 2;
  const clusterCenterY = (minClusterY + maxClusterY) / 2;

  // Center the cluster on the bed (0,0 is center of bed in 3D scene)
  let allFit = true;
  let totalItemsArea = 0;

  const resultItems: BedItem[] = placedItems.map((p) => {
    const finalPosX = p.x - clusterCenterX;
    const finalPosY = p.y - clusterCenterY;

    // Boundary check: is the item within printable boundaries?
    const halfW = p.w / 2;
    const halfH = p.h / 2;
    const isOutOfBounds =
      Math.abs(finalPosX) + halfW > bedWidthMm / 2 - marginMm ||
      Math.abs(finalPosY) + halfH > bedDepthMm / 2 - marginMm;

    if (isOutOfBounds) {
      allFit = false;
    }

    totalItemsArea += p.w * p.h;

    return {
      ...p.item,
      posX: finalPosX,
      posY: finalPosY,
      rotationDeg: p.rot,
      widthMm: p.w,
      depthMm: p.h,
      isOutOfBounds,
    };
  });

  const bedArea = bedWidthMm * bedDepthMm;
  const occupancyPercent = Math.min(100, Math.round((totalItemsArea / (bedArea || 1)) * 100));

  // Quick estimation: roughly ~18g per cutter, ~22g per stamp, ~45min per cutter, ~55min per stamp
  let totalFilamentGrams = 0;
  let totalTimeMinutes = 0;

  resultItems.forEach((it) => {
    const baseW = it.part === 'cutter' ? 18 : 22;
    const scaleFactor = (it.widthMm * it.depthMm) / (75 * 75);
    totalFilamentGrams += Math.round(baseW * scaleFactor);
    totalTimeMinutes += Math.round((it.part === 'cutter' ? 42 : 50) * scaleFactor);
  });

  return {
    items: resultItems,
    allFit,
    occupancyPercent,
    totalFilamentGrams,
    totalTimeMinutes,
    totalCount: resultItems.length,
  };
}

/**
 * Exports multiple positioned 3D meshes as a single unified Plate STL file
 */
export function exportPlateMeshesToSTL(positionedMeshes: THREE.Mesh[]): ArrayBuffer {
  // Compute total triangle count across all meshes
  let totalTriangles = 0;
  const processedGeometries: THREE.BufferGeometry[] = [];

  for (const mesh of positionedMeshes) {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry.clone();
    geom.applyMatrix4(mesh.matrixWorld);

    const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
    const pos = nonIndexed.getAttribute('position');
    if (pos) {
      totalTriangles += Math.floor(pos.count / 3);
      processedGeometries.push(nonIndexed);
    }
  }

  const bufferSize = 84 + totalTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 1. ASCII Header
  const header = 'Cookie3D Studio - Batch Print Bed Plate STL (Combined)';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0x20);
  }

  // 2. Triangle count
  view.setUint32(80, totalTriangles, true);

  // 3. Facets
  let offset = 84;
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (const geom of processedGeometries) {
    const positions = geom.getAttribute('position');
    const trianglesCount = Math.floor(positions.count / 3);

    for (let i = 0; i < trianglesCount; i++) {
      const idx = i * 3;
      pA.fromBufferAttribute(positions, idx);
      pB.fromBufferAttribute(positions, idx + 1);
      pC.fromBufferAttribute(positions, idx + 2);

      cb.subVectors(pC, pB);
      ab.subVectors(pA, pB);
      cb.cross(ab).normalize();
      normal.copy(cb);

      view.setFloat32(offset, normal.x, true);
      view.setFloat32(offset + 4, normal.y, true);
      view.setFloat32(offset + 8, normal.z, true);

      view.setFloat32(offset + 12, pA.x, true);
      view.setFloat32(offset + 16, pA.y, true);
      view.setFloat32(offset + 20, pA.z, true);

      view.setFloat32(offset + 24, pB.x, true);
      view.setFloat32(offset + 28, pB.y, true);
      view.setFloat32(offset + 32, pB.z, true);

      view.setFloat32(offset + 36, pC.x, true);
      view.setFloat32(offset + 40, pC.y, true);
      view.setFloat32(offset + 44, pC.z, true);

      view.setUint16(offset + 48, 0, true);
      offset += 50;
    }
  }

  return buffer;
}
