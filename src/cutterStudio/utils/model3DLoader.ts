import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import JSZip from 'jszip';

export interface Parsed3DModelInfo {
  geometry: THREE.BufferGeometry;
  fileName: string;
  fileSize: number;
  vertexCount: number;
  faceCount: number;
  dimensions: { width: number; height: number; depth: number };
}

/**
 * Loads and parses an STL or OBJ file from an ArrayBuffer / File
 */
export async function parse3DModelFile(file: File): Promise<Parsed3DModelInfo> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  let geometry: THREE.BufferGeometry;

  if (extension === 'stl') {
    const loader = new STLLoader();
    geometry = loader.parse(buffer);
  } else if (extension === 'obj') {
    const text = new TextDecoder().decode(buffer);
    const loader = new OBJLoader();
    const group = loader.parse(text);

    // Merge all child mesh geometries in the OBJ group
    const geos: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        geos.push((child as THREE.Mesh).geometry.clone());
      }
    });

    if (geos.length === 0) {
      throw new Error('O arquivo OBJ não contém geometrias válidas.');
    } else if (geos.length === 1) {
      geometry = geos[0];
    } else {
      // Merge BufferGeometries
      geometry = mergeGeometries(geos);
    }
  } else {
    throw new Error(`Formato .${extension} não suportado. Por favor, envie um arquivo .STL ou .OBJ.`);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const box = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  const posAttr = geometry.getAttribute('position');
  const vertexCount = posAttr ? posAttr.count : 0;
  const faceCount = geometry.index ? geometry.index.count / 3 : Math.floor(vertexCount / 3);

  return {
    geometry,
    fileName: file.name,
    fileSize: file.size,
    vertexCount,
    faceCount,
    dimensions: {
      width: Math.round(size.x * 10) / 10,
      height: Math.round(size.y * 10) / 10,
      depth: Math.round(size.z * 10) / 10,
    },
  };
}

/**
 * Merges multiple BufferGeometries into a single one
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geometries.map((g) => (g.index ? g.toNonIndexed() : g.clone()));
  let totalVertices = 0;

  for (const g of nonIndexed) {
    const pos = g.getAttribute('position');
    if (pos) totalVertices += pos.count;
  }

  const mergedPos = new Float32Array(totalVertices * 3);
  let offset = 0;

  for (const g of nonIndexed) {
    const pos = g.getAttribute('position');
    if (pos) {
      mergedPos.set(pos.array, offset);
      offset += pos.array.length;
    }
    g.dispose();
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  result.computeVertexNormals();
  return result;
}

/**
 * Exports a THREE.Mesh to an STL binary or ASCII blob
 */
export function exportMeshToSTL(mesh: THREE.Mesh, binary: boolean = true): Blob {
  const exporter = new STLExporter();
  const output = exporter.parse(mesh, { binary });
  return new Blob([output], { type: binary ? 'application/octet-stream' : 'text/plain' });
}

/**
 * Triggers browser download for a Blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Creates and downloads a ZIP package with all parts of the mold + instructions
 */
export async function exportMoldPackageZip(
  modelName: string,
  meshes: {
    singleMold?: THREE.Mesh | null;
    partA?: THREE.Mesh | null;
    partB?: THREE.Mesh | null;
    originalRef?: THREE.Mesh | null;
  },
  dimensions: { width: number; height: number; depth: number }
) {
  const zip = new JSZip();
  const folder = zip.folder(`Molde_3D_${modelName.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  if (!folder) return;

  const exporter = new STLExporter();
  const toBuffer = (d: string | DataView): string | Uint8Array => {
    if (typeof d === 'string') return d;
    return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  };

  if (meshes.singleMold) {
    const stlData = exporter.parse(meshes.singleMold, { binary: true });
    folder.file('Molde_Cavidade_Unica.stl', toBuffer(stlData));
  }

  if (meshes.partA) {
    const stlData = exporter.parse(meshes.partA, { binary: true });
    folder.file('Molde_Parte_A_Base.stl', toBuffer(stlData));
  }

  if (meshes.partB) {
    const stlData = exporter.parse(meshes.partB, { binary: true });
    folder.file('Molde_Parte_B_Tampa_Com_Pinos.stl', toBuffer(stlData));
  }

  if (meshes.originalRef) {
    const stlData = exporter.parse(meshes.originalRef, { binary: true });
    folder.file('Objeto_Original_Referencia.stl', toBuffer(stlData));
  }

  // Guia de Uso de Moldes para Impressão 3D
  const instructions = `=====================================================
GUIA PRÁTICO: IMPRESSÃO E USO DE MOLDES 3D
Modelo: ${modelName}
Dimensões da Caixa do Molde: ${dimensions.width} x ${dimensions.height} x ${dimensions.depth} mm
=====================================================

1. PARÂMETROS RECOMENDADOS PARA FATIAR NO SLICER (Bambu Studio, Cura, PrusaSlicer, Orca):
   - Material recomendado: PETG ou PLA (para alimentos, use PLA atóxico/Food Safe certificado).
   - Altura de Camada (Layer Height): 0.16mm ou 0.20mm (quanto menor, mais suave a cavidade).
   - Perímetros / Paredes (Walls): 4 a 5 paredes (essencial para que o molde seja impermeável).
   - Topo e Fundo (Top/Bottom Layers): 5 camadas sólidas.
   - Preenchimento (Infill): 20% a 30% Giroide ou Grade.
   - Suportes: Desativados (o molde é desenhado para imprimir diretamente sobre a mesa).

2. USO PARA DESPEJO DE SILICONE (Fôrma Flexível RTV):
   - Aplique uma camada fina de spray desmoldante de silicone ou cera automotiva na cavidade 3D.
   - Misture o silicone RTV (Platina ou Estanho) lentamente para evitar bolhas.
   - Despeje o silicone em fio fino a partir do ponto mais fundo da cavidade.

3. USO PARA CHOCOLATE, GESSO, RESINA E SABONETE:
   - Se impresso em PLA para contato com alimentos, use papel celofane, manteiga de cacau ou fita desmoldante.
   - Em moldes bipartidos, use elásticos ou grampos de aperto nas abas para vedar bem a partição antes de injetar pelo funil superior.

Cookie3D Studio - Criador de Moldes 3D
`;

  folder.file('LEIA-ME_Guia_de_Impressao_e_Moldes.txt', instructions);

  const zipContent = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipContent, `Kit_Molde_3D_${modelName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
}
