import JSZip from 'jszip';
import * as THREE from 'three';
import { MODEL_URL } from './presets';

export interface PencilPart {
  objectId: number;
  meshPath: string;
  meshObjectId: number;
  name: string;
  extruder: number;
  geometry: THREE.BufferGeometry;
  /** transform de <assemble> (12 números, convenção 3MF); identidade se ausente */
  assembleTransform: number[];
  /** transform do <item> do <build> (posição na prancha) */
  buildTransform: number[];
}

export interface PencilPackage {
  source: ArrayBuffer;
  bodyObjectId: number;
  bodyPart: PencilPart;
  parts: PencilPart[];
  filamentColors: string[];
}

const BODY_NAME_PREFIXES = ['Pencil_Main_Body', 'Pencil_corpo_hexagonal'];

const CORE_MODEL = '3D/3dmodel.model';
const MODEL_SETTINGS = 'Metadata/model_settings.config';
const PROJECT_SETTINGS = 'Metadata/project_settings.config';

export async function fetchPencilPackage(
  modelUrl: string = MODEL_URL,
  bodyNamePrefixes: string[] = BODY_NAME_PREFIXES
): Promise<PencilPackage> {
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o modelo do lápis (HTTP ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return loadPencilPackage(buffer, bodyNamePrefixes);
}

export async function loadPencilPackage(
  buffer: ArrayBuffer,
  bodyNamePrefixes: string[] = BODY_NAME_PREFIXES
): Promise<PencilPackage> {
  const zip = await JSZip.loadAsync(buffer);
  const coreEntry = zip.file(CORE_MODEL);
  if (!coreEntry) throw new Error('Pacote 3MF sem 3D/3dmodel.model');

  const coreDoc = parseXml(await coreEntry.async('string'), CORE_MODEL);
  const components = collectComponents(coreDoc);
  const buildItems = collectBuildItems(coreDoc);
  const settings = await readModelSettings(zip);
  const filamentColors = await readFilamentColors(zip);

  const xmlCache = new Map<string, string>();
  const parts: PencilPart[] = [];
  for (const item of buildItems) {
    const itemComponents = components.get(item.objectid);
    if (!itemComponents) continue;
    const meta = settings.objects.get(item.objectid);

    for (const component of itemComponents) {
      if (settings.negativePartIds.has(component.objectid)) continue;

      let xml = xmlCache.get(component.path);
      if (xml === undefined) {
        const entry = zip.file(component.path) || findEntryIgnoreCase(zip, component.path);
        if (!entry) continue;
        xml = await entry.async('string');
        xmlCache.set(component.path, xml);
      }

      const geometry = parseMesh(xml, component.objectid);
      if (!geometry) continue;

      parts.push({
        objectId: item.objectid,
        meshPath: component.path,
        meshObjectId: component.objectid,
        name: meta?.name || `object_${item.objectid}`,
        extruder: meta?.extruder || 1,
        geometry,
        assembleTransform: settings.assemble.get(item.objectid) || identityTransform(item.transform),
        buildTransform: identityTransform(item.transform),
      });
    }
  }

  if (parts.length === 0) throw new Error('Pacote 3MF sem peças legíveis');

  const bodyPart =
    parts.find((part) => bodyNamePrefixes.some((prefix) => part.name.startsWith(prefix))) ||
    parts[parts.length - 1];

  return {
    source: buffer,
    bodyObjectId: bodyPart.objectId,
    bodyPart,
    parts,
    filamentColors,
  };
}

/**
 * Converte os 12 números do `transform` 3MF (como o Bambu lê: colunas 0-2 +
 * translação 9-11) para uma `Matrix4` do three.
 */
export function transformMatrix(transform: number[]): THREE.Matrix4 {
  const a = transform.length === 12 ? transform : identityTransform();
  return new THREE.Matrix4().set(
    a[0], a[3], a[6], a[9],
    a[1], a[4], a[7], a[10],
    a[2], a[5], a[8], a[11],
    0, 0, 0, 1
  );
}

function identityTransform(buildTransform?: number[]): number[] {
  if (buildTransform && buildTransform.length === 12) return [...buildTransform];
  return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
}

function parseXml(xml: string, path: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`XML inválido em ${path}`);
  return doc;
}

function collectComponents(doc: Document): Map<number, { path: string; objectid: number }[]> {
  const map = new Map<number, { path: string; objectid: number }[]>();
  doc.querySelectorAll('object').forEach((object) => {
    const id = Number(object.getAttribute('id'));
    if (Number.isNaN(id)) return;
    const list: { path: string; objectid: number }[] = [];
    object.querySelectorAll('component').forEach((component) => {
      const raw =
        component.getAttribute('p:path') ||
        component.getAttributeNS('http://schemas.microsoft.com/3dmanufacturing/production/2015/06', 'path');
      const objectid = Number(component.getAttribute('objectid'));
      if (!raw || Number.isNaN(objectid)) return;
      list.push({ path: raw.replace(/^\/+/, ''), objectid });
    });
    if (list.length > 0) map.set(id, list);
  });
  return map;
}

function collectBuildItems(doc: Document): { objectid: number; transform?: number[] }[] {
  const items: { objectid: number; transform?: number[] }[] = [];
  doc.querySelectorAll('build > item').forEach((item) => {
    const id = Number(item.getAttribute('objectid'));
    if (Number.isNaN(id)) return;
    const raw = item.getAttribute('transform');
    items.push({ objectid: id, transform: raw ? raw.trim().split(/\s+/).map(Number) : undefined });
  });
  return items;
}

function isolateObject(xml: string, objectid: number): string {
  const tag = `<object id="${objectid}"`;
  const start = xml.indexOf(tag);
  if (start === -1) return '';
  const contentStart = xml.indexOf('>', start);
  if (contentStart === -1) return '';
  const end = xml.indexOf('</object>', contentStart);
  if (end === -1) return '';
  return xml.slice(contentStart + 1, end);
}

function parseMesh(xml: string, objectid: number): THREE.BufferGeometry | null {
  const objectXml = isolateObject(xml, objectid);
  if (!objectXml) return null;

  const vertexTags = objectXml.match(/<vertex\b[^>]*\/>/g);
  const triangleTags = objectXml.match(/<triangle\b[^>]*\/>/g);
  if (!vertexTags || !triangleTags) return null;

  const positions = new Float32Array(vertexTags.length * 3);
  vertexTags.forEach((tag, index) => {
    const attrs = readAttributes(tag);
    positions[index * 3] = Number(attrs.x);
    positions[index * 3 + 1] = Number(attrs.y);
    positions[index * 3 + 2] = Number(attrs.z);
  });

  const indices = new Uint32Array(triangleTags.length * 3);
  triangleTags.forEach((tag, index) => {
    const attrs = readAttributes(tag);
    indices[index * 3] = Number(attrs.v1);
    indices[index * 3 + 1] = Number(attrs.v2);
    indices[index * 3 + 2] = Number(attrs.v3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function readAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)="([^"]*)"/g;
  let match = re.exec(tag);
  while (match) {
    attrs[match[1]] = match[2];
    match = re.exec(tag);
  }
  return attrs;
}

interface ObjectMeta {
  name: string;
  extruder: number;
}

async function readModelSettings(zip: JSZip): Promise<{
  objects: Map<number, ObjectMeta>;
  assemble: Map<number, number[]>;
  negativePartIds: Set<number>;
}> {
  const objects = new Map<number, ObjectMeta>();
  const assemble = new Map<number, number[]>();
  const negativePartIds = new Set<number>();

  const entry = zip.file(MODEL_SETTINGS);
  if (!entry) return { objects, assemble, negativePartIds };

  const doc = parseXml(await entry.async('string'), MODEL_SETTINGS);
  doc.querySelectorAll('object').forEach((object) => {
    const id = Number(object.getAttribute('id'));
    if (Number.isNaN(id)) return;
    let name = '';
    let extruder = 1;
    Array.from(object.children).forEach((child) => {
      if (child.tagName === 'metadata') {
        const key = child.getAttribute('key');
        const value = child.getAttribute('value') || '';
        if (key === 'name') name = value;
        if (key === 'extruder') extruder = Number(value) || 1;
      }
      if (child.tagName === 'part' && child.getAttribute('subtype') === 'negative_part') {
        const partId = Number(child.getAttribute('id'));
        if (!Number.isNaN(partId)) negativePartIds.add(partId);
      }
    });
    objects.set(id, { name, extruder });
  });

  doc.querySelectorAll('assemble > assemble_item').forEach((item) => {
    if (!item.hasAttribute('instance_id')) return;
    const id = Number(item.getAttribute('object_id'));
    const raw = item.getAttribute('transform');
    if (Number.isNaN(id) || !raw) return;
    assemble.set(id, raw.trim().split(/\s+/).map(Number));
  });

  return { objects, assemble, negativePartIds };
}

async function readFilamentColors(zip: JSZip): Promise<string[]> {
  const entry = zip.file(PROJECT_SETTINGS);
  if (!entry) return [];
  try {
    const parsed = JSON.parse(await entry.async('string')) as Record<string, unknown>;
    const colors = parsed.filament_colour;
    return Array.isArray(colors) ? colors.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function findEntryIgnoreCase(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const normalized = path.toLowerCase();
  return (
    Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase() === normalized) ?? null
  );
}
