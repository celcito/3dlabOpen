import * as THREE from "three";
import type { SplitState, RegionId } from "../state/splitTypes";
import { capBoundaries } from "../engines/capEngine";
import { findBoundaryEdges, planConnectorPlacements, connectorArea } from "../engines/connectorEngine";
import { fusePlug } from "../engines/connectorFusion";
import { exportThreeMF, mergePieces } from "./threeMFExporter";
import { exportGLB } from "./glbExporter";
import { exportOBJ } from "./objExporter";
import { exportSTL } from "./stlExporter";
import type { ExportPiece } from "./types";

export * from "./types";
export { exportThreeMF, mergePieces } from "./threeMFExporter";
export { exportGLB } from "./glbExporter";
export { exportOBJ, buildObjAndMtl } from "./objExporter";
export { exportSTL } from "./stlExporter";

const BASE_COLOR = "#e0e0e0";

/**
 * Splits the state's geometry into one `ExportPiece` per region id present in
 * the region mask. Each piece is an indexed sub-geometry of its region.
 */
export function splitPieces(state: SplitState): ExportPiece[] {
  if (!state.geometry || !state.regionMask) return [];
  const { positions, indices } = state.geometry;
  const mask = state.regionMask;
  if (!indices || indices.length === 0) return [];

  const present = new Set<RegionId>();
  for (let t = 0; t < indices.length; t += 3) {
    const g = dominantRegion(mask, indices[t], indices[t + 1], indices[t + 2]);
    if (g !== undefined) present.add(g);
  }

  const regionById = new Map(state.regions.map((r) => [r.id, r]));
  const ids = Array.from(present).sort((a, b) => a - b);
  const pieces: ExportPiece[] = [];

  for (const id of ids) {
    const triRes: number[] = [];
    for (let t = 0; t < indices.length; t += 3) {
      const i0 = indices[t], i1 = indices[t + 1], i2 = indices[t + 2];
      const g = dominantRegion(mask, i0, i1, i2);
      if (g !== id) continue;
      triRes.push(i0, i1, i2);
    }
    if (triRes.length === 0) continue;

    const local = new Map<number, number>();
    const pos: number[] = [];
    const gIdx: number[] = [];
    for (const vi of triRes) {
      let out = local.get(vi);
      if (out === undefined) {
        out = pos.length / 3;
        local.set(vi, out);
        pos.push(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
      }
      gIdx.push(out);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setIndex(gIdx);
    geometry.computeVertexNormals();

    const region = regionById.get(id);
    pieces.push({
      geometry,
      color: region ? region.color : BASE_COLOR,
      name: region ? region.name : `region_${id}`,
    });
  }
  return pieces;
}

function dominantRegion(mask: Uint8Array, i0: number, i1: number, i2: number): RegionId | undefined {
  const a = mask[i0] || 0;
  const b = mask[i1] || 0;
  const c = mask[i2] || 0;
  if (a !== 0) return a;
  if (b !== 0) return b;
  if (c !== 0) return c;
  return a; // all zero
}

/**
 * Applies caps (per region) and/or connector plugs to the pieces. Returns new
 * pieces (originals are left untouched).
 */
export function applyPieceMods(state: SplitState, pieces: ExportPiece[], options: SplitExportOptionsShim): ExportPiece[] {
  let out = pieces.map((p) => ({ ...p, geometry: p.geometry.clone() }));

  if (options.capPieces && state.geometry) {
    out = out.map((p) => {
      const geo = p.geometry;
      const cap = capBoundaries({
        method: state.capConfig.method,
        thickness: state.capConfig.thickness,
        resolution: state.capConfig.resolution,
        positions: (geo.attributes.position as THREE.BufferAttribute).array as Float32Array,
        indices: Array.from(geo.index!.array as ArrayLike<number>),
        regionMask: new Uint8Array((geo.attributes.position as THREE.BufferAttribute).count).fill(1),
        regionIds: null,
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(cap.positions, 3));
      g.setIndex(cap.indices);
      g.computeVertexNormals();
      return { ...p, geometry: g };
    });
  }

  if (options.includeConnectors && state.connectorConfig.type !== "none" && state.geometry) {
    const { positions, indices } = state.geometry;
    const mask = state.regionMask!;
    const edges = findBoundaryEdges(new Float32Array(positions), indices, mask);
    if (edges.length > 0) {
      const placements = planConnectorPlacements(
        edges,
        Math.min(4, edges.length),
        {
          type: state.connectorConfig.type,
          areaPercent: state.connectorConfig.areaPercent,
          depthMm: state.connectorConfig.depthMm,
          socketToleranceMm: state.connectorConfig.socketToleranceMm,
          side: state.connectorConfig.side,
        }
      );
      const area = connectorArea(state.connectorConfig.areaPercent, state.connectorConfig.type, edges);
      for (const pl of placements) {
        const fp: FusionPlacement = {
          point: pl.point,
          direction: pl.direction,
          up: pl.up,
          area,
          depth: state.connectorConfig.depthMm,
          toleranceMm: state.connectorConfig.socketToleranceMm,
          regionA: pl.regionA,
          regionB: pl.regionB,
        };
        out = out.map((p) =>
          p.geometry.attributes.position.count > 0
            ? { ...p, geometry: fusePlug(p.geometry, fp, { type: state.connectorConfig.type, depthMm: state.connectorConfig.depthMm, socketToleranceMm: state.connectorConfig.socketToleranceMm }) }
            : p
        );
      }
    }
  }

  return out;
}

type FusionPlacement = {
  point: THREE.Vector3;
  direction: THREE.Vector3;
  up: THREE.Vector3;
  area: number;
  depth: number;
  toleranceMm: number;
  regionA: number;
  regionB: number;
};

export interface SplitExportOptionsShim {
  format: "3mf" | "obj" | "glb" | "stl";
  includeConnectors: boolean;
  capPieces: boolean;
  filename?: string;
}

/**
 * Dispatcher: builds pieces from state, optionally mods them, then exports to
 * the requested format. Always resolves to a Blob (zip for obj).
 */
export async function exportSplit(state: SplitState, options: SplitExportOptionsShim): Promise<Blob> {
  const basePieces = splitPieces(state);
  const pieces = applyPieceMods(state, basePieces, options);
  const filename = options.filename ?? "split";

  switch (options.format) {
    case "3mf":
      return exportThreeMF({ pieces, filename });
    case "glb":
      return exportGLB({ pieces, filename });
    case "obj":
      return exportOBJ({ pieces, filename });
    case "stl":
      return exportSTL({ pieces, filename });
    default:
      throw new Error(`Unsupported format: ${(options as { format: string }).format}`);
  }
}

export type { ExportPiece };