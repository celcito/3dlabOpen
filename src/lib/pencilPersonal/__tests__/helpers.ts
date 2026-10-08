import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPencilPackage, type PencilPackage } from '../package';
import { VARIANTS } from '../presets';

const MODEL_PATH = resolve(__dirname, '../../../../public/models/Pencil_Maglama_cortado_open.3mf');
const ESTOJO_PATH = resolve(__dirname, '../../../../public/models/Estojo_Giz_Cera_open.3mf');

let cached: Promise<PencilPackage> | null = null;

export function loadModelOnce(): Promise<PencilPackage> {
  if (!cached) {
    const nodeBuffer = readFileSync(MODEL_PATH);
    // cópia no realm do jsdom: JSZip valida instanceof ArrayBuffer
    const buffer = new Uint8Array(nodeBuffer).buffer as ArrayBuffer;
    cached = loadPencilPackage(buffer);
  }
  return cached;
}

let estojoCached: Promise<PencilPackage> | null = null;

export function loadEstojoOnce(): Promise<PencilPackage> {
  if (!estojoCached) {
    const nodeBuffer = readFileSync(ESTOJO_PATH);
    const buffer = new Uint8Array(nodeBuffer).buffer as ArrayBuffer;
    estojoCached = loadPencilPackage(buffer, VARIANTS['estojo-giz'].bodyNamePrefixes);
  }
  return estojoCached;
}
