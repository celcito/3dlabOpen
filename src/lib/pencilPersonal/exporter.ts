import { unzipSync, zipSync, strToU8 } from 'fflate';
import type { BufferGeometry } from 'three';

const BODY_MESH_PATH = '3D/Objects/object_6.model';
const ROOT_MODEL_PATH = '3D/3dmodel.model';
const SETTINGS_PATH = 'Metadata/model_settings.config';

export const LETTER_OBJECT_ID = 14;
export const LETTER_PART_ID = 13;
export const LETTER_PLATE_ID = 7;
export const LETTER_IDENTIFY_ID = 1801;
/** Célula livre da grade de placas (Δ ≈ 216): coluna 1, linha 3. */
export const LETTER_ITEM_TRANSFORM = '1 0 0 0 1 0 0 0 1 90 -342 0';

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
function replaceBodyMesh(xml: string, geometry: BufferGeometry): string {
  const start = xml.indexOf('<mesh>');
  const end = xml.indexOf('</mesh>', start);
  if (start === -1 || end === -1) throw new Error('object_6.model sem <mesh>');
  return `${xml.slice(0, start)}<mesh>${meshInner(geometry)}</mesh>${xml.slice(end + '</mesh>'.length)}`;
}

function buildRootModel(xml: string, letters: BufferGeometry): string {
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

  const item = `  <item objectid="${LETTER_OBJECT_ID}" transform="${LETTER_ITEM_TRANSFORM}" printable="1"/>\n`;

  return (
    xml.slice(0, resourceEnd) + objects + xml.slice(resourceEnd, buildEnd) + item + xml.slice(buildEnd)
  );
}

function lettersSettingsXml(geometry: BufferGeometry, filamentIndex: number, text: string): string {
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
    '      <metadata key="source_file" value="Pencil_Maglama_cortado.3mf"/>\n',
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

function lettersPlateXml(): string {
  return [
    '  <plate>\n',
    `    <metadata key="plater_id" value="${LETTER_PLATE_ID}"/>\n`,
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

/** Atualiza o `face_count` do objeto do corpo (object id 8) após o CSG. */
function updateBodyFaceCount(xml: string, faces: number): string {
  const start = xml.indexOf('<object id="8">');
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
  text: string
): string {
  let out = updateBodyFaceCount(xml, triangleCount(bodyGraved));

  const objectBlock = lettersSettingsXml(letters, filamentIndex, text);
  const plateStart = out.indexOf('  <plate>');
  if (plateStart === -1) {
    const configEnd = out.lastIndexOf('</config>');
    out = out.slice(0, configEnd) + objectBlock + out.slice(configEnd);
  } else {
    out = out.slice(0, plateStart) + objectBlock + out.slice(plateStart);
  }

  const plateBlock = lettersPlateXml();
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
 * Copy-ZIP: mudam somente `object_6.model` (malha gravada), `3dmodel.model`
 * (objeto das letras + `<item>`) e `model_settings.config` (objeto + placa 7).
 * Todo o resto é reescrito byte a byte idêntico.
 */
export function exportPersonalizedPencil(params: PersonalizedPencilExport): Blob {
  const entries = unzipSync(new Uint8Array(params.source));

  const body = entries[BODY_MESH_PATH];
  const root = entries[ROOT_MODEL_PATH];
  const settings = entries[SETTINGS_PATH];
  if (!body || !root || !settings) {
    throw new Error('Pacote 3MF sem as entradas esperadas (object_6 / 3dmodel / model_settings)');
  }

  entries[BODY_MESH_PATH] = strToU8(
    replaceBodyMesh(decodeUtf8(body), params.bodyGraved)
  );
  entries[ROOT_MODEL_PATH] = strToU8(buildRootModel(decodeUtf8(root), params.letters));
  entries[SETTINGS_PATH] = strToU8(
    injectSettings(
      decodeUtf8(settings),
      params.bodyGraved,
      params.letters,
      params.filamentIndex,
      params.text
    )
  );

  const bytes = zipSync(entries, { level: 6 });
  return new Blob([bytes as unknown as BlobPart], { type: 'model/3mf' });
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
