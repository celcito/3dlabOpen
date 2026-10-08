import { unzipSync, zipSync, strToU8 } from 'fflate';
import type { BufferGeometry } from 'three';

const ROOT_MODEL_PATH = '3D/3dmodel.model';
const SETTINGS_PATH = 'Metadata/model_settings.config';
const STALE_SLICE_CACHE = 'Metadata/plate_5.json';
const SOURCE_FILE_NAME = 'Pencil_Maglama_cortado_open.3mf';

export const LETTER_OBJECT_ID = 14;
export const LETTER_PART_ID = 13;
export const LETTER_PLATE_ID = 6;
export const LETTER_IDENTIFY_ID = 2500;
/** Célula livre da grade de placas (Δ ≈ 216): coluna 2, linha 1. */
export const LETTER_ITEM_TRANSFORM = '1 0 0 0 1 0 0 0 1 522 -126 0';

export interface PersonalizedPencilExport {
  /** pacote `.3mf` original, já carregado */
  source: ArrayBuffer;
  /** corpo após a subtração do texto */
  bodyGraved: BufferGeometry;
  /** letras inlay (centradas em X/Y, minZ = 0) */
  letters: BufferGeometry;
  /** extruder 1..5 das letras */
  filamentIndex: number;
  /** texto gravado, usado só como rótulo da peça */
  text: string;
  /** entrada da malha do corpo dentro do pacote */
  bodyMeshPath: string;
  /** id do `<object>` do corpo dentro de `bodyMeshPath` */
  bodyMeshObjectId: number;
  /** id do corpo em `model_settings.config` */
  bodyObjectId: number;
  /** nome do arquivo de origem gravado nas letras (padrão: hex) */
  sourceFileName?: string;
  /** cache de fatiamento obsoleto a apagar do ZIP (padrão: hex) */
  staleSliceCache?: string;
  /** `plater_id` criado para as letras (padrão: hex) */
  letterPlateId?: number;
  /** `<item>` das letras no `3dmodel.model` (padrão: hex) */
  letterItemTransform?: string;
}

export function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return index.count / 3;
  return geometry.getAttribute('position').count / 3;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Object.is(value, -0) ? '0' : String(value);
}

/** Corpo do `<mesh>` (sem as tags externas), com a indentação do arquivo Bambu. */
function meshInner(geometry: BufferGeometry): string {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const vertexCount = position.count;
  const triangles = triangleCount(geometry);

  const out: string[] = ['\n    <vertices>\n'];
  for (let i = 0; i < vertexCount; i++) {
    out.push(
      `     <vertex x="${fmt(position.getX(i))}" y="${fmt(position.getY(i))}" z="${fmt(
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

/** Troca o `<mesh>` do corpo gravado preservando o resto do documento. */
function replaceBodyMesh(
  xml: string,
  geometry: BufferGeometry,
  meshObjectId: number
): string {
  const tag = `<object id="${meshObjectId}"`;
  const objectStart = xml.indexOf(tag);
  if (objectStart === -1) throw new Error(`malha: objeto ${meshObjectId} ausente`);
  const start = xml.indexOf('<mesh>', objectStart);
  const end = xml.indexOf('</mesh>', objectStart);
  if (start === -1 || end === -1) throw new Error(`malha: objeto ${meshObjectId} sem <mesh>`);
  return `${xml.slice(0, start)}<mesh>${meshInner(geometry)}</mesh>${xml.slice(end + '</mesh>'.length)}`;
}

function removeBlock(xml: string, openTag: string, closeTag: string): string {
  const start = xml.indexOf(openTag);
  if (start === -1) return xml;
  const closeStart = xml.indexOf(closeTag, start);
  if (closeStart === -1) return xml;
  const end = closeStart + closeTag.length;
  let lineStart = start;
  while (lineStart > 0 && xml[lineStart - 1] === ' ') lineStart--;
  if (lineStart > 0 && xml[lineStart - 1] === '\n') lineStart--;
  return xml.slice(0, lineStart) + xml.slice(end);
}

function negativePartIds(settingsXml: string, bodyObjectId: number): number[] {
  const start = settingsXml.indexOf(`<object id="${bodyObjectId}">`);
  if (start === -1) return [];
  const end = settingsXml.indexOf('</object>', start);
  if (end === -1) return [];
  const block = settingsXml.slice(start, end);

  const ids: number[] = [];
  const re = /<part\b[^>]*>/g;
  let match = re.exec(block);
  while (match) {
    if (/\bsubtype="negative_part"/.test(match[0])) {
      const id = /\bid="(\d+)"/.exec(match[0]);
      if (id) ids.push(Number(id[1]));
    }
    match = re.exec(block);
  }
  return ids;
}

function removeComponent(rootXml: string, objectid: number): string {
  const needle = `objectid="${objectid}"`;
  const at = rootXml.indexOf(needle);
  if (at === -1) return rootXml;
  const tagStart = rootXml.lastIndexOf('<component', at);
  if (tagStart === -1) return rootXml;
  const tagEnd = rootXml.indexOf('>', tagStart);
  if (tagEnd === -1) return rootXml;

  const selfClosing = rootXml[tagEnd - 1] === '/';
  let end: number;
  if (selfClosing) {
    end = tagEnd + 1;
  } else {
    const close = rootXml.indexOf('</component>', tagEnd);
    if (close === -1) return rootXml;
    end = close + '</component>'.length;
  }

  let start = tagStart;
  while (start > 0 && rootXml[start - 1] === ' ') start--;
  if (start > 0 && rootXml[start - 1] === '\n') start--;
  return rootXml.slice(0, start) + rootXml.slice(end);
}

/**
 * Remove o negativo nativo do corpo das 3 entradas: o `<part subtype="negative_part">`
 * em `model_settings.config`, o `<component>` correspondente em `3dmodel.model`
 * e o `<object>` inteiro na malha (o `p:UUID` do corpo é preservado).
 */
export function stripNegativeParts(
  settingsXml: string,
  rootXml: string,
  bodyMeshXml: string,
  bodyObjectId: number
): { settingsXml: string; rootXml: string; bodyMeshXml: string } {
  let settings = settingsXml;
  let root = rootXml;
  let mesh = bodyMeshXml;

  for (const id of negativePartIds(settingsXml, bodyObjectId)) {
    settings = removeBlock(settings, `<part id="${id}"`, '</part>');
    root = removeComponent(root, id);
    mesh = removeBlock(mesh, `<object id="${id}"`, '</object>');
  }

  return { settingsXml: settings, rootXml: root, bodyMeshXml: mesh };
}

function buildRootModel(xml: string, letters: BufferGeometry, letterItemTransform: string): string {
  const resourceEnd = xml.lastIndexOf('</resources>');
  const buildEnd = xml.lastIndexOf('</build>');
  if (resourceEnd === -1 || buildEnd === -1) throw new Error('3dmodel.model sem resources/build');

  const objects = [
    `  <object id="${LETTER_PART_ID}" type="model">\n`,
    `   <mesh>${meshInner(letters)}</mesh>\n`,
    '  </object>\n',
    `  <object id="${LETTER_OBJECT_ID}" type="model">\n`,
    '   <components>\n',
    `    <component objectid="${LETTER_PART_ID}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n`,
    '   </components>\n',
    '  </object>\n',
  ].join('');

  const item = `  <item objectid="${LETTER_OBJECT_ID}" transform="${letterItemTransform}" printable="1"/>\n`;

  return (
    xml.slice(0, resourceEnd) + objects + xml.slice(resourceEnd, buildEnd) + item + xml.slice(buildEnd)
  );
}

function lettersSettingsXml(
  geometry: BufferGeometry,
  filamentIndex: number,
  text: string,
  sourceFileName: string
): string {
  const faces = triangleCount(geometry);
  const name = escapeXml(`Letras_${text.trim() || 'Nome'}.stl`);
  const uuid = 'b7f3c1a9-5d24-4e18-9f06-2a8c4d6e7105';
  return [
    `  <object id="${LETTER_OBJECT_ID}">\n`,
    `    <metadata key="name" value="${name}"/>\n`,
    `    <metadata key="extruder" value="${filamentIndex}"/>\n`,
    `    <metadata face_count="${faces}"/>\n`,
    `    <part id="${LETTER_PART_ID}" subtype="normal_part" uuid="${uuid}">\n`,
    `      <metadata key="name" value="${name}"/>\n`,
    '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n',
    `      <metadata key="source_file" value="${escapeXml(sourceFileName)}"/>\n`,
    '      <metadata key="source_object_id" value="0"/>\n',
    '      <metadata key="source_volume_id" value="0"/>\n',
    '      <metadata key="source_offset_x" value="0"/>\n',
    '      <metadata key="source_offset_y" value="0"/>\n',
    '      <metadata key="source_offset_z" value="0"/>\n',
    `      <mesh_stat face_count="${faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n`,
    '    </part>\n',
    '  </object>\n',
  ].join('');
}

function lettersPlateXml(letterPlateId: number): string {
  return [
    '  <plate>\n',
    `    <metadata key="plater_id" value="${letterPlateId}"/>\n`,
    '    <metadata key="plater_name" value=""/>\n',
    '    <metadata key="locked" value="false"/>\n',
    '    <metadata key="filament_map_mode" value="Auto For Flush"/>\n',
    '    <metadata key="filament_maps" value="1 1 1 1 1"/>\n',
    '    <metadata key="filament_volume_maps" value="0 0 0 0 0"/>\n',
    '    <model_instance>\n',
    `      <metadata key="object_id" value="${LETTER_OBJECT_ID}"/>\n`,
    '      <metadata key="instance_id" value="0"/>\n',
    `      <metadata key="identify_id" value="${LETTER_IDENTIFY_ID}"/>\n`,
    '    </model_instance>\n',
    '  </plate>\n',
  ].join('');
}

/** Atualiza o `face_count` do objeto do corpo após o CSG. */
function updateBodyFaceCount(xml: string, faces: number, bodyObjectId: number): string {
  const start = xml.indexOf(`<object id="${bodyObjectId}">`);
  if (start === -1) return xml;
  const end = xml.indexOf('</object>', start);
  if (end === -1) return xml;
  const block = xml.slice(start, end).replace(/face_count="\d+"/g, `face_count="${faces}"`);
  return xml.slice(0, start) + block + xml.slice(end);
}

function injectSettings(
  xml: string,
  bodyGraved: BufferGeometry,
  letters: BufferGeometry,
  filamentIndex: number,
  text: string,
  bodyObjectId: number,
  sourceFileName: string,
  letterPlateId: number
): string {
  let out = updateBodyFaceCount(xml, triangleCount(bodyGraved), bodyObjectId);

  const objectBlock = lettersSettingsXml(letters, filamentIndex, text, sourceFileName);
  const plateStart = out.indexOf('  <plate>');
  if (plateStart === -1) {
    const configEnd = out.lastIndexOf('</config>');
    out = out.slice(0, configEnd) + objectBlock + out.slice(configEnd);
  } else {
    out = out.slice(0, plateStart) + objectBlock + out.slice(plateStart);
  }

  const plateBlock = lettersPlateXml(letterPlateId);
  const assembleStart = out.indexOf('  <assemble>');
  if (assembleStart === -1) {
    const configEnd = out.lastIndexOf('</config>');
    out = out.slice(0, configEnd) + plateBlock + out.slice(configEnd);
  } else {
    out = out.slice(0, assembleStart) + plateBlock + out.slice(assembleStart);
  }

  return out;
}

/**
 * Copy-ZIP: mudam somente a malha do corpo (gravada), `3dmodel.model`
 * (objeto das letras + `<item>`) e `model_settings.config` (negativo removido,
 * `face_count` do corpo + objeto + placa das letras). O cache de fatiamento
 * desatualizado da variante é apagado. Todo o resto é reescrito byte a byte
 * idêntico.
 */
export function exportPersonalizedPencil(params: PersonalizedPencilExport): Blob {
  const sourceFileName = params.sourceFileName ?? SOURCE_FILE_NAME;
  const staleSliceCache = params.staleSliceCache ?? STALE_SLICE_CACHE;
  const letterPlateId = params.letterPlateId ?? LETTER_PLATE_ID;
  const letterItemTransform = params.letterItemTransform ?? LETTER_ITEM_TRANSFORM;

  const entries = unzipSync(new Uint8Array(params.source));

  const body = entries[params.bodyMeshPath];
  const root = entries[ROOT_MODEL_PATH];
  const settings = entries[SETTINGS_PATH];
  if (!body || !root || !settings) {
    throw new Error('Pacote 3MF sem as entradas esperadas (malha do corpo / 3dmodel / model_settings)');
  }

  const stripped = stripNegativeParts(
    decodeUtf8(settings),
    decodeUtf8(root),
    decodeUtf8(body),
    params.bodyObjectId
  );

  entries[params.bodyMeshPath] = strToU8(
    replaceBodyMesh(stripped.bodyMeshXml, params.bodyGraved, params.bodyMeshObjectId)
  );
  entries[ROOT_MODEL_PATH] = strToU8(
    buildRootModel(stripped.rootXml, params.letters, letterItemTransform)
  );
  entries[SETTINGS_PATH] = strToU8(
    injectSettings(
      stripped.settingsXml,
      params.bodyGraved,
      params.letters,
      params.filamentIndex,
      params.text,
      params.bodyObjectId,
      sourceFileName,
      letterPlateId
    )
  );
  delete entries[staleSliceCache];

  const bytes = zipSync(entries, { level: 6 });
  return new Blob([bytes as unknown as BlobPart], { type: 'model/3mf' });
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
