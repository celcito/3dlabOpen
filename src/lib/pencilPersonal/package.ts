import JSZip from 'jszip';
import * as THREE from 'three';
import { MODEL_URL } from './presets';

export interface PencilPart {
  objectId: number;
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

const CORE_MODEL = '3D/3dmodel.model';
const MODEL_SETTINGS = 'Metadata/model_settings.config';
const PROJECT_SETTINGS = 'Metadata/project_settings.config';

export async function fetchPencilPackage(): Promise<PencilPackage> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o modelo do lápis (HTTP ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return loadPencilPackage(buffer);
}

export async function loadPencilPackage(buffer: ArrayBuffer): Promise<PencilPackage> {
  const zip = await JSZip.loadAsync(buffer);
  const coreEntry = zip.file(CORE_MODEL);
  if (!coreEntry) throw new Error('Pacote 3MF sem 3D/3dmodel.model');

  const coreDoc = parseXml(await coreEntry.async('string'), CORE_MODEL);
  const paths = collectComponentPaths(coreDoc);
  const buildItems = collectBuildItems(coreDoc);
  const settings = await readModelSettings(zip);
  const filamentColors = await readFilamentColors(zip);

  const parts: PencilPart[] = [];
  for (const item of buildItems) {
    const path = paths.get(item.objectid);
    if (!path) continue;
    const entry = zip.file(path) || findEntryIgnoreCase(zip, path);
    if (!entry) continue;

    const xml = await entry.async('string');
    const geometry = parseMesh(xml);
    if (!geometry) continue;

    const meta = settings.objects.get(item.objectid);
    parts.push({
      objectId: item.objectid,
      name: meta?.name || `object_${item.objectid}`,
      extruder: meta?.extruder || 1,
      geometry,
      assembleTransform: settings.assemble.get(item.objectid) || identityTransform(item.transform),
      buildTransform: identityTransform(item.transform),
    });
  }

  if (parts.length === 0) throw new Error('Pacote 3MF sem peças legíveis');

  const bodyPart = parts.find((part) => part.name.startsWith('Pencil_Main_Body')) || parts[parts.length - 1];

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

function collectComponentPaths(doc: Document): Map<number, string> {
  const map = new Map<number, string>();
  doc.querySelectorAll('object').forEach((object) => {
    const id = Number(object.getAttribute('id'));
    const component = object.querySelector('component');
    if (!component || Number.isNaN(id)) return;
    const raw =
      component.getAttribute('p:path') ||
      component.getAttributeNS('http://schemas.microsoft.com/3dmanufacturing/production/2015/06', 'path');
    if (raw) map.set(id, raw.replace(/^\/+/, ''));
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

function parseMesh(xml: string): THREE.BufferGeometry | null {
  const vertexTags = xml.match(/<vertex\b[^>]*\/>/g);
  const triangleTags = xml.match(/<triangle\b[^>]*\/>/g);
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
}> {
  const objects = new Map<number, ObjectMeta>();
  const assemble = new Map<number, number[]>();

  const entry = zip.file(MODEL_SETTINGS);
  if (!entry) return { objects, assemble };

  const doc = parseXml(await entry.async('string'), MODEL_SETTINGS);
  doc.querySelectorAll('object').forEach((object) => {
    const id = Number(object.getAttribute('id'));
    if (Number.isNaN(id)) return;
    let name = '';
    let extruder = 1;
    Array.from(object.children).forEach((child) => {
      if (child.tagName !== 'metadata') return;
      const key = child.getAttribute('key');
      const value = child.getAttribute('value') || '';
      if (key === 'name') name = value;
      if (key === 'extruder') extruder = Number(value) || 1;
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

  return { objects, assemble };
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
