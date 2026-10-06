import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPencilPackage, type PencilPackage } from '../package';

const MODEL_PATH = resolve(__dirname, '../../../../public/models/Pencil_Maglama_cortado.3mf');

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
