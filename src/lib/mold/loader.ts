import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MoldBounds } from '../../types/mold';

export interface ParsedModel {
  geometry: THREE.BufferGeometry;
  fileName: string;
  sizeLabel: string;
  triangles: number;
  dimensions: MoldBounds;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lê um STL (binário ou ASCII) ou OBJ e devolve uma única geometria. */
export async function parseModelFile(file: File): Promise<ParsedModel> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const buffer = await file.arrayBuffer();

  let geometry: THREE.BufferGeometry;

  if (extension === 'stl') {
    geometry = new STLLoader().parse(buffer);
  } else if (extension === 'obj') {
    const group = new OBJLoader().parse(new TextDecoder().decode(buffer));
    const geos: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) geos.push(mesh.geometry.clone());
    });

    if (geos.length === 0) throw new Error('O arquivo OBJ não contém malhas válidas.');
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) throw new Error('Não foi possível unir as malhas do OBJ.');
    geometry = merged;
  } else {
    throw new Error(`Formato .${extension} não suportado. Envie um arquivo .STL ou .OBJ.`);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const size = new THREE.Vector3();
  geometry.boundingBox?.getSize(size);
  const position = geometry.getAttribute('position');
  const triangles = geometry.index ? geometry.index.count / 3 : (position?.count ?? 0) / 3;

  return {
    geometry,
    fileName: file.name,
    sizeLabel: formatFileSize(file.size),
    triangles: Math.round(triangles),
    dimensions: {
      width: Math.round(size.x * 10) / 10,
      height: Math.round(size.y * 10) / 10,
      depth: Math.round(size.z * 10) / 10,
    },
  };
}
