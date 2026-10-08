import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import type { BufferGeometry } from 'three';
import { loadPencilPackage } from '../package';
import { generatePencilPersonal } from '../geometry';
import { setManifoldWasmUrl } from '../../split3mf/engines/manifoldLoader';
import { countBoundaryEdges, isWatertight, signedVolume } from '../../fastener/threads';
import { DEFAULT_PENCIL_PERSONAL_CONFIG } from '../presets';
import { loadEstojoOnce } from './helpers';

interface MeshReport {
  triangles: number;
  vertices: number;
  edges: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  duplicatedDirectedEdges: number;
  euler: number;
}

/** Equivalente a validate_mesh.py: fechada (toda aresta com par) + 2-manifold. */
function checkClosedManifold(geometry: BufferGeometry): MeshReport {
  const indexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = indexed.getAttribute('position');
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;

  const directed = new Map<string, number>();
  const undirected = new Map<string, number>();
  const vertices = new Set<string>();

  for (let i = 0; i < pos.count; i += 3) {
    const ids = [0, 1, 2].map((o) => key(pos.getX(i + o), pos.getY(i + o), pos.getZ(i + o)));
    ids.forEach((id) => vertices.add(id));
    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      if (a === b) continue;
      directed.set(`${a}|${b}`, (directed.get(`${a}|${b}`) || 0) + 1);
      const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
      undirected.set(pair, (undirected.get(pair) || 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let duplicatedDirectedEdges = 0;
  let nonManifoldEdges = 0;
  undirected.forEach((count, pair) => {
    if (count !== 2) nonManifoldEdges++;
    const [a, b] = pair.split('|');
    const ab = directed.get(`${a}|${b}`) || 0;
    const ba = directed.get(`${b}|${a}`) || 0;
    if (ab === 0 || ba === 0) boundaryEdges++;
    if (ab > 1 || ba > 1) duplicatedDirectedEdges++;
  });

  const triangles = pos.count / 3;
  return {
    triangles,
    vertices: vertices.size,
    edges: undirected.size,
    boundaryEdges,
    nonManifoldEdges,
    duplicatedDirectedEdges,
    euler: vertices.size - undirected.size + triangles,
  };
}

beforeAll(() => {
  // Node/vitest não resolve o asset ?url do Vite; aponta para o arquivo real.
  setManifoldWasmUrl('file://' + path.join(process.cwd(), 'node_modules/manifold-3d/manifold.wasm'));
});

describe('gate de malha (validate_mesh.py)', () => {
  it('bodyOriginal, bodyGraved e letters são fechadas, 2-manifold e com volume positivo', async () => {
    const buffer = readFileSync('public/models/Pencil_Maglama_cortado_open.3mf');
    const pkg = await loadPencilPackage(new Uint8Array(buffer).buffer.slice(0));
    const generated = await generatePencilPersonal(
      pkg.bodyPart.geometry,
      DEFAULT_PENCIL_PERSONAL_CONFIG
    );

    expect(generated.wallThickness).toBeGreaterThan(0);
    expect(generated.clampedDepth).toBeGreaterThan(0);
    expect(generated.textWidth).toBeGreaterThan(0);
    expect(generated.textTooWide).toBe(false);

    const original = checkClosedManifold(pkg.bodyPart.geometry);
    const body = checkClosedManifold(generated.bodyGraved);
    const letters = checkClosedManifold(generated.letters);

    const meshes = [
      ['bodyOriginal', pkg.bodyPart.geometry, original],
      ['bodyGraved', generated.bodyGraved, body],
      ['letters', generated.letters, letters],
    ] as const;

    for (const [name, geometry, report] of meshes) {
      expect(report.boundaryEdges, `${name}: arestas abertas`).toBe(0);
      expect(report.nonManifoldEdges, `${name}: arestas não-manifold`).toBe(0);
      expect(report.duplicatedDirectedEdges, `${name}: arestas duplicadas`).toBe(0);
      expect(signedVolume(geometry), `${name}: volume`).toBeGreaterThan(0);
    }
  }, 180000);
});

describe('gate de malha do estojo [AC-04]', () => {
  it('corpo e tampa saem fechadas e 2-manifold', async () => {
    const pkg = await loadEstojoOnce();
    expect(pkg.parts).toHaveLength(2);

    for (const part of pkg.parts) {
      expect(countBoundaryEdges(part.geometry), `${part.name}: arestas abertas`).toBe(0);
      expect(isWatertight(part.geometry), `${part.name}: fechada`).toBe(true);
      expect(signedVolume(part.geometry), `${part.name}: volume`).toBeGreaterThan(0);
    }
  }, 120000);
});
