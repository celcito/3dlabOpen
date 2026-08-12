import * as THREE from "three";
import type { SplitState } from "../state/splitTypes";

export interface DisplayGeometryRequest {
  geometry: SplitState["geometry"];
  regionMask: Uint8Array | null;
  regions: SplitState["regions"];
  rawColors?: Float32Array | null;
}

const BASE_COLOR = new THREE.Color("#e0e0e0");

/**
 * Builds a THREE.BufferGeometry from split state. When a region mask is
 * present, vertex colors reflect region colors (0 = base gray).
 */
export function buildDisplayGeometry(req: DisplayGeometryRequest): THREE.BufferGeometry {
  const { geometry, regionMask, regions, rawColors } = req;
  const out = new THREE.BufferGeometry();

  if (!geometry) return out;

  out.setAttribute("position", new THREE.BufferAttribute(geometry.positions, 3));

  if (geometry.normals) {
    out.setAttribute("normal", new THREE.BufferAttribute(geometry.normals, 3));
  } else {
    out.computeVertexNormals();
  }

  if (regionMask) {
    const colors = new Float32Array(geometry.positions.length);
    const regionColor = new Map<number, THREE.Color>();
    regionColor.set(0, BASE_COLOR);
    for (const r of regions) regionColor.set(r.id, new THREE.Color(r.color));
    for (let vi = 0; vi < regionMask.length; vi++) {
      const c = regionColor.get(regionMask[vi]) ?? BASE_COLOR;
      colors[vi * 3] = c.r;
      colors[vi * 3 + 1] = c.g;
      colors[vi * 3 + 2] = c.b;
    }
    out.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  } else if (rawColors && rawColors.length >= geometry.positions.length) {
    out.setAttribute("color", new THREE.BufferAttribute(rawColors, 3));
  } else if (geometry.colors) {
    out.setAttribute("color", new THREE.BufferAttribute(geometry.colors, 3));
  }

  if (geometry.indices) {
    out.setIndex(new THREE.BufferAttribute(geometry.indices, 1));
  } else {
    out.toNonIndexed();
  }

  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export function centerAndFit(geometry: THREE.BufferGeometry, target: number): THREE.Vector3 {
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;
  const scale = target / (radius || 1);
  geometry.center();
  geometry.scale(scale, scale, scale);
  return new THREE.Vector3(scale, scale, scale);
}