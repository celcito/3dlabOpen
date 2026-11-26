import * as THREE from 'three';
import JSZip from 'jszip';

/**
 * Converts a Three.js Mesh or BufferGeometry to a binary STL ArrayBuffer
 */
export function exportToBinarySTL(meshOrGeometry: THREE.Mesh | THREE.BufferGeometry): ArrayBuffer {
  const geometry =
    meshOrGeometry instanceof THREE.Mesh
      ? meshOrGeometry.geometry
      : meshOrGeometry;

  // Ensure non-indexed triangles for straightforward facet export
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = nonIndexed.getAttribute('position');

  if (!positions) {
    throw new Error('Geometry does not have position attribute.');
  }

  const trianglesCount = Math.floor(positions.count / 3);
  const bufferSize = 84 + trianglesCount * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 1. 80-byte ASCII Header
  const header = 'Cookie3D Studio - STL Export for 3D Printing (Watertight Manifold)';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0x20);
  }

  // 2. 32-bit unsigned integer triangle count
  view.setUint32(80, trianglesCount, true);

  // 3. Facets data (50 bytes each)
  let offset = 84;
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < trianglesCount; i++) {
    const idx = i * 3;

    pA.fromBufferAttribute(positions, idx);
    pB.fromBufferAttribute(positions, idx + 1);
    pC.fromBufferAttribute(positions, idx + 2);

    // Compute facet normal
    cb.subVectors(pC, pB);
    ab.subVectors(pA, pB);
    cb.cross(ab).normalize();
    normal.copy(cb);

    // Normal vector (3x float32)
    view.setFloat32(offset, normal.x, true);
    view.setFloat32(offset + 4, normal.y, true);
    view.setFloat32(offset + 8, normal.z, true);

    // Vertex 1 (3x float32)
    view.setFloat32(offset + 12, pA.x, true);
    view.setFloat32(offset + 16, pA.y, true);
    view.setFloat32(offset + 20, pA.z, true);

    // Vertex 2 (3x float32)
    view.setFloat32(offset + 24, pB.x, true);
    view.setFloat32(offset + 28, pB.y, true);
    view.setFloat32(offset + 32, pB.z, true);

    // Vertex 3 (3x float32)
    view.setFloat32(offset + 36, pC.x, true);
    view.setFloat32(offset + 40, pC.y, true);
    view.setFloat32(offset + 44, pC.z, true);

    // Attribute byte count (uint16 = 0)
    view.setUint16(offset + 48, 0, true);

    offset += 50;
  }

  return buffer;
}

/**
 * Triggers browser download for a Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Downloads a single mesh as STL
 */
export function downloadMeshSTL(mesh: THREE.Mesh, filename: string): void {
  const stlBuffer = exportToBinarySTL(mesh);
  const blob = new Blob([stlBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, filename.endsWith('.stl') ? filename : `${filename}.stl`);
}

/**
 * Bundles Cutter, Stamp, and 3D printing guide into a single ZIP
 */
export async function downloadCompleteKitZip(
  cutterMesh: THREE.Mesh | null,
  stampMesh: THREE.Mesh | null,
  modelName: string,
  settingsSummary: string,
  pdfBlob?: Blob
): Promise<void> {
  const zip = new JSZip();
  const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (cutterMesh) {
    const cutterBuffer = exportToBinarySTL(cutterMesh);
    zip.file(`Cortador_${safeName}.stl`, cutterBuffer);
  }

  if (stampMesh) {
    const stampBuffer = exportToBinarySTL(stampMesh);
    zip.file(`Carimbo_${safeName}.stl`, stampBuffer);
  }

  if (pdfBlob) {
    zip.file(`Ficha_Producao_3D_${safeName}.pdf`, pdfBlob);
  }

  // Helpful 3D Printing Recipe readme
  const readmeContent = `=== GUIA DE IMPRESSÃO 3D - COOKIE3D STUDIO ===
Modelo: ${modelName}
Data: ${new Date().toLocaleDateString('pt-BR')}

CONFIGURAÇÕES RECOMENDADAS NO FATIADOR (BAMBU STUDIO / CURA / PRUSASLICER / ORCA):
-------------------------------------------------------------------------
1. ORIENTAÇÃO NA MESA:
   - Cortador: Imprimir com a borda de corte apontando para CIMA e a aba/lip larga apoiada na mesa (mesa de impressão).
   - Carimbo: Imprimir com a placa plana apoiada na mesa e o puxador/linhas apontando para cima (ou virado com suportes mínimos se necessário).

2. PARÂMETROS DE IMPRESSÃO:
   - Bico (Nozzle): 0.4 mm (ou 0.2 mm para detalhes ultra-finos de carimbo)
   - Altura de Camada (Layer Height): 0.20 mm (ou 0.16 mm no carimbo para relevos perfeitos)
   - Paredes / Perímetros: 3 a 4 voltas (Garante lâmina 100% sólida e resistente)
   - Preenchimento (Infill): 15% a 20% (Padrão Gyroid ou Grid)
   - Suportes: NÃO NECESSITA de suportes na maioria dos modelos!

3. SEGURANÇA ALIMENTAR (FOOD SAFE):
   - Materiais recomendados: PLA ou PETG (preferencialmente certificados para contato com alimentos ou grau virgem).
   - Dica dos Confeiteiros Profissionais:
     a) Você pode aplicar uma camada fina de filme plástico PVC sobre a massa antes de pressionar o carimbo para facilidade total de limpeza.
     b) Passe o cortador e o carimbo em farinha de trigo ou amido de milho antes de cortar para a massa soltar suavemente sem grudar.
     c) Lavar apenas em água fria ou morna com detergente neutro (NÃO colocar em lava-louças para evitar deformação térmica do PLA).

Configurações aplicadas:
${settingsSummary}

Boas fornadas e ótimas impressões!
Cookie3D Studio
`;

  zip.file('LEIA-ME_DICAS_IMPRESSAO_3D.txt', readmeContent);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `Kit_Cortador_Carimbo_${safeName}.zip`);
}

/**
 * Computes weight, filament length, and estimated print time based on mesh volume and infill %
 */
export function estimatePrintParameters(
  cutterMesh: THREE.Mesh | null,
  stampMesh: THREE.Mesh | null,
  infillPercent: number = 20
) {
  let cutterVolumeMm3 = 0;
  let stampVolumeMm3 = 0;
  let totalTriangles = 0;

  function estimateMeshVolume(mesh: THREE.Mesh): number {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return 0;
    const size = new THREE.Vector3();
    box.getSize(size);
    // Approximate volume based on solid shell perimeters and fill
    const shellVolume = 2 * (size.x * size.y + size.y * size.z + size.z * size.x) * 1.6;
    const baseVolume = size.x * size.y * 2.5;
    return Math.max(1000, (shellVolume + baseVolume) * 0.6);
  }

  // Realistic infill factor for 3D printing:
  // Parts have solid exterior walls (~55% of volume in thin cookie cutters & plates).
  // The interior infill accounts for the remaining ~45% of core volume.
  // Baseline is 20% infill: (0.55 + 0.45 * 0.20) = 0.64
  const clampedInfill = Math.max(10, Math.min(100, infillPercent));
  const infillMultiplier = (0.55 + 0.45 * (clampedInfill / 100)) / 0.64;

  if (cutterMesh) {
    cutterVolumeMm3 = estimateMeshVolume(cutterMesh) * infillMultiplier;
    const nonIndexed = cutterMesh.geometry.index
      ? cutterMesh.geometry.toNonIndexed()
      : cutterMesh.geometry;
    totalTriangles += (nonIndexed.getAttribute('position')?.count || 0) / 3;
  }

  if (stampMesh) {
    stampVolumeMm3 = estimateMeshVolume(stampMesh) * infillMultiplier;
    const nonIndexed = stampMesh.geometry.index
      ? stampMesh.geometry.toNonIndexed()
      : stampMesh.geometry;
    totalTriangles += (nonIndexed.getAttribute('position')?.count || 0) / 3;
  }

  // PLA density approx 1.24 g/cm3 (1240 kg/m3) -> 0.00124 g/mm3
  const cutterWeightGrams = Math.max(8, Math.round(cutterVolumeMm3 * 0.00124));
  const stampWeightGrams = Math.max(10, Math.round(stampVolumeMm3 * 0.00124));
  const totalWeightGrams = cutterWeightGrams + stampWeightGrams;

  // 1.75mm PLA filament weighs ~3g per meter
  const filamentMeters = parseFloat((totalWeightGrams / 3).toFixed(1));

  // Print time estimation at standard 50-60mm/s:
  // Scales with total extruded material and raster path density
  const timeInfillScale = 0.8 + 0.2 * (clampedInfill / 20);
  const printTimeMinutes = Math.max(16, Math.round(totalWeightGrams * 1.65 * timeInfillScale));

  return {
    cutterWeightGrams,
    stampWeightGrams,
    totalWeightGrams,
    printTimeMinutes,
    filamentMeters,
    trianglesCount: Math.round(totalTriangles),
  };
}
