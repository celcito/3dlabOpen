import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface ParsedGLB {
  geometry: THREE.BufferGeometry;
  suggestedColors?: string[];
  objects: { name: string; color?: string }[];
}

function geometryFromPrimitive(prim: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = prim.index ? prim.clone() : prim.toNonIndexed();
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  return g;
}

/**
 * Parses a .glb (binary glTF 2.0) into a single merged geometry, preserving
 * vertex colors when present.
 */
export async function parseGLB(arrayBuffer: ArrayBuffer): Promise<ParsedGLB> {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(arrayBuffer, "");
  const meshes: THREE.BufferGeometry[] = [];
  const objects: { name: string; color?: string }[] = [];
  const suggestedColors: string[] = [];

  gltf.scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const geometry = geometryFromPrimitive(mesh.geometry);
    geometry.applyMatrix4(mesh.matrixWorld);

    // Pull vertex colors (most slicer-exported GLBs store them in the geometry).
    const colorAttr = geometry.getAttribute("color");
    if (colorAttr && colorAttr.count > 0 && suggestedColors.length === 0) {
      const c = new THREE.Color();
      const first = new THREE.Color(colorAttr.getX(0), colorAttr.getY(0), colorAttr.getZ(0));
      suggestedColors.push("#" + first.getHexString());
    }

    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color =
      material && "color" in material && material.color instanceof THREE.Color
        ? "#" + material.color.getHexString()
        : suggestedColors[0];

    objects.push({ name: mesh.name || `Mesh ${objects.length + 1}`, color });
    meshes.push(geometry);
  });

  if (meshes.length === 0) throw new Error("GLB contains no mesh primitives");

  const merged = meshes.length === 1
    ? meshes[0]
    : BufferGeometryUtils.mergeGeometries(meshes, false);

  merged.computeVertexNormals();
  merged.center();
  merged.computeBoundingBox();

  return { geometry: merged, suggestedColors, objects };
}