/**
 * Gera `public/models/Estojo_Giz_Cera_open.3mf` a partir do template
 * `public/models/Pencil_Maglama_cortado_open.3mf`.
 *
 * Uso: node_modules/.bin/tsx scripts/genEstojoGiz.ts
 *
 * Monta as 2 peças (corpo cilíndrico vazado + tampa cônica com saia roscada),
 * valida que as malhas saem 2-manifold, reescreve no ZIP só o que descreve
 * geometria e placas e revalida o 3MF já gravado. O perfil de corte
 * (`project_settings.config`) e a base OPC (`[Content_Types].xml`) são copiados
 * byte a byte do template.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import * as THREE from 'three';
import {
  buildInternalThreadRemoval,
  buildThreadedRod,
  countBoundaryEdges,
  isWatertight,
  signedVolume,
} from '../src/lib/fastener/threads';
import { csgSubtract, csgUnion } from '../src/lib/fastener/boolean';
import { setManifoldWasmUrl } from '../src/lib/split3mf/engines/manifoldLoader';

const ROOT = process.cwd();
const TEMPLATE = 'public/models/Pencil_Maglama_cortado_open.3mf';
const OUTPUT = 'public/models/Estojo_Giz_Cera_open.3mf';

// --- Dimensões (spec.md M2/M3/M4) ------------------------------------------
const OUTER_R = 57.5; // Ø115
const BODY_HALF = 22; // corpo z ∈ [-22, 22]
const CAVITY_R = 53.5; // Ø107 interno
const FLOOR_H = 4; // fundo de 4 mm → cavidade parte de z = -18
const PITCH = 4;
const TURNS = 3;
const CLEARANCE = 0.4;
const ROD_MAJOR = 106.6;
const THREAD_OVERRUN = 1; // avança 1 mm acima da borda p/ não deixar face coplanar
const FLANGE_H = 3;
const CONE_H = 16;
const THREAD_SEGMENTS = 96;
const STEPS_PER_PITCH = 16;
const CIRCLE_SEGMENTS = 128;

/**
 * A tampa sobe 10 mm na montagem: o espigão entra no corpo de z=10 a z=22
 * (M3). Por isso a região roscada começa em `LID_THREAD_BASE_Z`, não na base
 * do corpo.
 */
const LID_THREAD_BASE_Z = 10;
const THREAD_LEN = TURNS * PITCH + THREAD_OVERRUN;
const FLANGE_Z0 = LID_THREAD_BASE_Z + TURNS * PITCH; // 22
const FLANGE_Z1 = FLANGE_Z0 + FLANGE_H; // 25
const CONE_Z1 = FLANGE_Z1 + CONE_H; // 41

// --- Empacotamento (design.md §6) ------------------------------------------
const BODY_BUILD_ID = 2;
const BODY_MESH_ID = 1;
const LID_BUILD_ID = 4;
const LID_MESH_ID = 3;
const BODY_CELL: [number, number] = [90, 90];
const LID_CELL: [number, number] = [306, 90];
const BODY_IDENTIFY_ID = 195;
const LID_IDENTIFY_ID = 184;
const BODY_NAME = 'Estojo_corpo_cilindrico.stl';
const LID_NAME = 'Estojo_ponta_conica.stl';
const SOURCE_FILE_NAME = 'Estojo_Giz_Cera_open.3mf';

const CORE_MODEL = '3D/3dmodel.model';
const MODEL_SETTINGS = 'Metadata/model_settings.config';
const CORE_RELS = '3D/_rels/3dmodel.model.rels';
const ROOT_RELS = '_rels/.rels';
const PROJECT_SETTINGS = 'Metadata/project_settings.config';

const UUIDS = {
  build: '2c7c17d8-22b5-4d84-8835-1976022ee001',
  bodyObject: '00000002-61cb-4c03-9d28-80fed5dfa001',
  bodyComponent: '00000003-61cb-4c03-9d28-80fed5dfa001',
  bodyMesh: '00000001-61cb-4c03-9d28-80fed5dfa001',
  bodyItem: '00000002-b1ec-4553-aec9-835e5b724001',
  lidObject: '00000002-61cb-4c03-9d28-80fed5dfa002',
  lidComponent: '00000003-61cb-4c03-9d28-80fed5dfa002',
  lidMesh: '00000001-61cb-4c03-9d28-80fed5dfa002',
  lidItem: '00000004-b1ec-4553-aec9-835e5b724002',
  bodyPart: '5bcfd0a8-4821-4589-8fbd-acdfe8b0d001',
  lidPart: '98e225bf-9464-4e7a-8220-d81843102001',
};

// --- Geometria -------------------------------------------------------------

/** Cilindro ao longo de +Z com base em `z0` e topo em `z1`. */
function cylinderZ(radius: number, z0: number, z1: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, z1 - z0, CIRCLE_SEGMENTS, 1, false);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, (z0 + z1) / 2);
  return geometry;
}

/** Cone com base (raio `radius`) em `z0` e ápice em `z1`. */
function coneZ(radius: number, z0: number, z1: number): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(radius, z1 - z0, CIRCLE_SEGMENTS);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, (z0 + z1) / 2);
  return geometry;
}

/** Pino roscado externo ao longo de +Z com base em `z0`. */
function externalThreadZ(z0: number): THREE.BufferGeometry {
  const geometry = buildThreadedRod({
    major: ROD_MAJOR,
    pitch: PITCH,
    length: THREAD_LEN,
    segments: THREAD_SEGMENTS,
    stepsPerPitch: STEPS_PER_PITCH,
    clearance: 0,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, z0);
  return geometry;
}

/** Sólido de remoção da rosca interna, alinhado ao pino (mesma fase). */
function internalThreadZ(z0: number): THREE.BufferGeometry {
  const geometry = buildInternalThreadRemoval({
    holeDiameter: ROD_MAJOR,
    pitch: PITCH,
    length: THREAD_LEN,
    segments: THREAD_SEGMENTS,
    stepsPerPitch: STEPS_PER_PITCH,
    clearance: CLEARANCE,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, z0);
  return geometry;
}

/** Corpo: cilindro Ø115×44 − cavidade Ø107 (4 mm de fundo) − rosca interna. */
async function buildBody(): Promise<THREE.BufferGeometry> {
  const outer = cylinderZ(OUTER_R, -BODY_HALF, BODY_HALF);
  const cavity = cylinderZ(CAVITY_R, -BODY_HALF + FLOOR_H, BODY_HALF + 2);
  const hollowed = await csgSubtract(outer, cavity);
  return (await csgSubtract(hollowed.geometry, internalThreadZ(LID_THREAD_BASE_Z))).geometry;
}

/** Tampa: pino roscado Ø106,6 × 13 ∪ flange Ø115×3 ∪ cone Ø115×16. */
async function buildLid(): Promise<THREE.BufferGeometry> {
  const rod = externalThreadZ(LID_THREAD_BASE_Z);
  const flange = cylinderZ(OUTER_R, FLANGE_Z0, FLANGE_Z1);
  const cone = coneZ(OUTER_R, FLANGE_Z1, CONE_Z1);
  const head = await csgUnion(flange, cone);
  return (await csgUnion(head.geometry, rod)).geometry;
}

// --- Validação -------------------------------------------------------------

function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  return Math.floor((index ? index.count : geometry.getAttribute('position').count) / 3);
}

function boxOf(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return (geometry.boundingBox as THREE.Box3).clone();
}

function fmtBox(box: THREE.Box3): string {
  const f = (n: number) => n.toFixed(3);
  return `[${f(box.min.x)}, ${f(box.min.y)}, ${f(box.min.z)}] .. [${f(box.max.x)}, ${f(box.max.y)}, ${f(box.max.z)}]`;
}

function validateParts(parts: { label: string; geometry: THREE.BufferGeometry }[]): boolean {
  let failed = false;
  const assembled = new THREE.Box3();

  for (const part of parts) {
    const boundary = countBoundaryEdges(part.geometry);
    const watertight = isWatertight(part.geometry);
    const volume = signedVolume(part.geometry);
    const box = boxOf(part.geometry);
    assembled.union(box);
    const ok = boundary === 0 && watertight && volume > 0;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'OK     ' : 'FALHA '} ${part.label}: tris=${triangleCount(part.geometry)} ` +
        `boundary=${boundary} watertight=${watertight} vol=${volume.toFixed(2)} mm³`
    );
    console.log(`        bbox ${fmtBox(box)}`);
  }

  const size = assembled.getSize(new THREE.Vector3());
  const ok =
    Math.abs(size.x - 115) < 0.05 && Math.abs(size.y - 115) < 0.05 && Math.abs(size.z - 63) < 0.05;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'OK     ' : 'FALHA '} montado (M3): ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)} mm`
  );
  return !failed;
}

// --- XML -------------------------------------------------------------------

/** 9 dígitos significativos são o mínimo que fazem round-trip de float32. */
function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const n = Number(value.toPrecision(9));
  return Object.is(n, -0) ? '0' : String(n);
}

function meshInner(geometry: THREE.BufferGeometry): string {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangles = triangleCount(geometry);

  const out: string[] = ['\n    <vertices>\n'];
  for (let i = 0; i < position.count; i++) {
    out.push(
      `     <vertex x="${fmtNumber(position.getX(i))}" y="${fmtNumber(position.getY(i))}" z="${fmtNumber(
        position.getZ(i)
      )}"/>\n`
    );
  }
  out.push('    </vertices>\n    <triangles>\n');
  for (let t = 0; t < triangles; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    out.push(`     <triangle v1="${a}" v2="${b}" v3="${c}"/>\n`);
  }
  out.push('    </triangles>\n   ');
  return out.join('');
}

const MODEL_NS =
  'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
  'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ' +
  'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" ' +
  'requiredextensions="p"';

function meshFileXml(geometry: THREE.BufferGeometry, objectId: number, uuid: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<model unit="millimeter" xml:lang="en-US" ${MODEL_NS}>`,
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>',
    ' <resources>',
    `  <object id="${objectId}" p:UUID="${uuid}" type="model">`,
    '   <mesh>',
    meshInner(geometry),
    '   </mesh>',
    '  </object>',
    ' </resources>',
    ' <build/>',
    '</model>',
    '',
  ].join('\n');
}

function componentXml(buildId: number, meshId: number, uuidObject: string, uuidComponent: string): string[] {
  return [
    `  <object id="${buildId}" p:UUID="${uuidObject}" type="model">`,
    '   <components>',
    `    <component p:path="/3D/Objects/object_${meshId}.model" objectid="${meshId}" p:UUID="${uuidComponent}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`,
    '   </components>',
    '  </object>',
  ];
}

function rootModelXml(): string {
  const items = [
    `  <item objectid="${BODY_BUILD_ID}" p:UUID="${UUIDS.bodyItem}" transform="1 0 0 0 1 0 0 0 1 ${BODY_CELL[0]} ${BODY_CELL[1]} ${BODY_HALF}" printable="1"/>`,
    `  <item objectid="${LID_BUILD_ID}" p:UUID="${UUIDS.lidItem}" transform="1 0 0 0 1 0 0 0 1 ${LID_CELL[0]} ${LID_CELL[1]} ${-LID_THREAD_BASE_Z}" printable="1"/>`,
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<model unit="millimeter" xml:lang="en-US" ${MODEL_NS}>`,
    ' <metadata name="Application">BambuStudio-02.08.02.61</metadata>',
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>',
    ' <metadata name="CopyRight">[]</metadata>',
    ' <metadata name="Copyright">[]</metadata>',
    ` <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>`,
    ' <metadata name="Origin">original</metadata>',
    ' <metadata name="Title">Estojo de Giz de Cera</metadata>',
    ' <resources>',
    ...componentXml(BODY_BUILD_ID, BODY_MESH_ID, UUIDS.bodyObject, UUIDS.bodyComponent),
    ...componentXml(LID_BUILD_ID, LID_MESH_ID, UUIDS.lidObject, UUIDS.lidComponent),
    ' </resources>',
    ` <build p:UUID="${UUIDS.build}">`,
    ...items,
    ' </build>',
    '</model>',
    '',
  ].join('\n');
}

function partXml(
  buildId: number,
  meshId: number,
  name: string,
  faces: number,
  uuid: string
): string {
  return [
    `  <object id="${buildId}">`,
    `    <metadata key="name" value="${name}"/>`,
    '    <metadata key="extruder" value="1"/>',
    `    <metadata face_count="${faces}"/>`,
    `    <part id="${meshId}" subtype="normal_part" uuid="${uuid}">`,
    `      <metadata key="name" value="${name}"/>`,
    '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>',
    `      <metadata key="source_file" value="${SOURCE_FILE_NAME}"/>`,
    '      <metadata key="source_object_id" value="0"/>',
    '      <metadata key="source_volume_id" value="0"/>',
    '      <metadata key="source_offset_x" value="0"/>',
    '      <metadata key="source_offset_y" value="0"/>',
    '      <metadata key="source_offset_z" value="0"/>',
    `      <mesh_stat face_count="${faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>`,
    '    </part>',
    '  </object>',
  ].join('\n');
}

function plateXml(plateId: number, buildId: number, identifyId: number): string {
  return [
    '  <plate>',
    `    <metadata key="plater_id" value="${plateId}"/>`,
    '    <metadata key="plater_name" value=""/>',
    '    <metadata key="locked" value="false"/>',
    '    <metadata key="filament_map_mode" value="Auto For Flush"/>',
    '    <metadata key="filament_maps" value="1 1 1 1 1"/>',
    '    <metadata key="filament_volume_maps" value="0 0 0 0 0"/>',
    '    <model_instance>',
    `      <metadata key="object_id" value="${buildId}"/>`,
    '      <metadata key="instance_id" value="0"/>',
    `      <metadata key="identify_id" value="${identifyId}"/>`,
    '    </model_instance>',
    '  </plate>',
  ].join('\n');
}

function modelSettingsXml(body: THREE.BufferGeometry, lid: THREE.BufferGeometry): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    partXml(BODY_BUILD_ID, BODY_MESH_ID, BODY_NAME, triangleCount(body), UUIDS.bodyPart),
    partXml(LID_BUILD_ID, LID_MESH_ID, LID_NAME, triangleCount(lid), UUIDS.lidPart),
    plateXml(1, BODY_BUILD_ID, BODY_IDENTIFY_ID),
    plateXml(2, LID_BUILD_ID, LID_IDENTIFY_ID),
    '</config>',
    '',
  ].join('\n');
}

function coreRelsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ` <Relationship Target="/3D/Objects/object_${BODY_MESH_ID}.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`,
    ` <Relationship Target="/3D/Objects/object_${LID_MESH_ID}.model" Id="rel-2" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`,
    '</Relationships>',
    '',
  ].join('\n');
}

/** Mantém só o relationship do modelo — os de miniatura apontam para PNGs removidos. */
function rootRelsXml(templateBytes: Uint8Array): string {
  return (
    strFromU8(templateBytes)
      .split('\n')
      .filter((line) => !line.includes('.png'))
      .join('\n')
  );
}

// --- Pacote ----------------------------------------------------------------

const DROP_PATTERNS = [
  /^3D\/Objects\/.*\.model$/,
  /^Metadata\/plate_.*\.json$/,
  /^Metadata\/.*\.png$/,
  /^Metadata\/assembly_model\.json$/,
  /^Metadata\/cut_information\.xml$/,
  /^Metadata\/filament_sequence\.json$/,
];

function shouldDrop(name: string): boolean {
  return DROP_PATTERNS.some((pattern) => pattern.test(name));
}

function geometryFromMeshXml(xml: string): THREE.BufferGeometry {
  const vertices = [...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)];
  const triangles = [...xml.matchAll(/<triangle v1="([^"]+)" v2="([^"]+)" v3="([^"]+)"\/>/g)];
  const positions = new Float32Array(vertices.length * 3);
  vertices.forEach((match, i) => {
    positions[i * 3] = Number(match[1]);
    positions[i * 3 + 1] = Number(match[2]);
    positions[i * 3 + 2] = Number(match[3]);
  });
  const index = new Uint32Array(triangles.length * 3);
  triangles.forEach((match, i) => {
    index[i * 3] = Number(match[1]);
    index[i * 3 + 1] = Number(match[2]);
    index[i * 3 + 2] = Number(match[3]);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}

/** Reabre o 3MF gravado e confere que a round-trip de texto preservou a malha. */
function verifyPackage(
  bytes: Uint8Array,
  expected: { label: string; name: string }[]
): boolean {
  const zip = unzipSync(bytes);
  let failed = false;

  for (const entry of expected) {
    const file = zip[`3D/Objects/${entry.name}`];
    if (!file) {
      console.log(`FALHA ${entry.label}: ${entry.name} ausente`);
      failed = true;
      continue;
    }
    const geometry = geometryFromMeshXml(strFromU8(file));
    const boundary = countBoundaryEdges(geometry);
    const watertight = isWatertight(geometry);
    const volume = signedVolume(geometry);
    const ok = boundary === 0 && watertight && volume > 0;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'OK     ' : 'FALHA '} round-trip ${entry.label}: tris=${triangleCount(geometry)} ` +
        `boundary=${boundary} watertight=${watertight} vol=${volume.toFixed(2)} mm³`
    );
  }

  for (const required of [
    '[Content_Types].xml',
    ROOT_RELS,
    CORE_MODEL,
    CORE_RELS,
    MODEL_SETTINGS,
    PROJECT_SETTINGS,
    'Metadata/slice_info.config',
  ]) {
    if (!zip[required]) {
      console.log(`FALHA entrada obrigatória ausente: ${required}`);
      failed = true;
    }
  }

  const leftovers = Object.keys(zip).filter(
    (name) => name.startsWith('Metadata/plate_') || name.endsWith('.png')
  );
  if (leftovers.length > 0) {
    console.log(`FALHA entradas que deveriam ter saído: ${leftovers.join(', ')}`);
    failed = true;
  }

  const expectedObjects = expected.map((entry) => `3D/Objects/${entry.name}`).sort();
  const actualObjects = Object.keys(zip)
    .filter((name) => name.startsWith('3D/Objects/'))
    .sort();
  if (JSON.stringify(actualObjects) !== JSON.stringify(expectedObjects)) {
    console.log(
      `FALHA 3D/Objects inesperado: [${actualObjects.join(', ')}] != [${expectedObjects.join(', ')}]`
    );
    failed = true;
  }

  const rootRels = strFromU8(zip[ROOT_RELS] as Uint8Array);
  if (rootRels.includes('.png')) {
    console.log('FALHA _rels/.rels ainda referencia miniaturas');
    failed = true;
  }

  return !failed;
}

async function main(): Promise<void> {
  setManifoldWasmUrl(`file://${path.join(ROOT, 'node_modules/manifold-3d/manifold.wasm')}`);

  console.log('Montando geometria…');
  const body = await buildBody();
  const lid = await buildLid();

  if (!validateParts([{ label: 'corpo', geometry: body }, { label: 'tampa', geometry: lid }])) {
    console.error('FALHA: malha inválida — nada foi gravado.');
    process.exit(1);
  }

  const template = unzipSync(new Uint8Array(readFileSync(path.join(ROOT, TEMPLATE))));
  const templateRootRels = template[ROOT_RELS];
  if (!templateRootRels) throw new Error('template sem _rels/.rels');
  if (!template[PROJECT_SETTINGS]) throw new Error(`template sem ${PROJECT_SETTINGS}`);

  const entries: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(template)) {
    if (shouldDrop(name)) continue;
    entries[name] = data;
  }

  entries[CORE_MODEL] = strToU8(rootModelXml());
  entries[MODEL_SETTINGS] = strToU8(modelSettingsXml(body, lid));
  entries[CORE_RELS] = strToU8(coreRelsXml());
  entries[ROOT_RELS] = strToU8(rootRelsXml(templateRootRels));
  entries[`3D/Objects/object_${BODY_MESH_ID}.model`] = strToU8(
    meshFileXml(body, BODY_MESH_ID, UUIDS.bodyMesh)
  );
  entries[`3D/Objects/object_${LID_MESH_ID}.model`] = strToU8(
    meshFileXml(lid, LID_MESH_ID, UUIDS.lidMesh)
  );

  const bytes = zipSync(entries, { level: 6 });
  const clean = verifyPackage(bytes, [
    { label: 'corpo', name: `object_${BODY_MESH_ID}.model` },
    { label: 'tampa', name: `object_${LID_MESH_ID}.model` },
  ]);
  if (!clean) {
    console.error('FALHA: 3MF reaberto inconsistente — nada foi gravado.');
    process.exit(1);
  }

  writeFileSync(path.join(ROOT, OUTPUT), bytes);
  console.log(
    `Gravado: ${OUTPUT} (${(bytes.length / 1024).toFixed(0)} KiB, ${Object.keys(entries).length} entradas)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
