import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { ExportPiece } from "./types";

export interface GLBExportInput {
  pieces: ExportPiece[];
  filename?: string;
}

/**
 * GLB export via GLTFExporter: one mesh per piece with a vertex-color attribute
 * (KHR_materials_unlit). The scene root keeps each mesh independent so slicers
 * see separate solid bodies.
 */
export async function exportGLB(input: GLBExportInput): Promise<Blob> {
  const { pieces, filename = "split" } = input;
  const root = new THREE.Group();
  root.name = "split3mf";

  pieces.forEach((piece, i) => {
    const geo = piece.geometry.clone();
    const count = geo.attributes.position.count;
    const color = new THREE.Color(piece.color);
    const colors = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) {
      colors[v * 3] = color.r;
      colors[v * 3 + 1] = color.g;
      colors[v * 3 + 2] = color.b;
    }
    const existing = geo.getAttribute("color");
    if (existing && existing.count === count) {
      const arr = existing.array as Float32Array;
      for (let v = 0; v < count * 3; v++) arr[v] = colors[v];
    } else {
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `${piece.name}_${i}`;
    root.add(mesh);
  });

  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(root, (out) => resolve(out as ArrayBuffer), reject, { binary: true });
  });
  return filename ? new File([result], `${filename}.glb`, { type: "model/gltf-binary" }) : new Blob([result], { type: "model/gltf-binary" });
}