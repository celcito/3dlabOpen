import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { flattenBottomBevel } from '../bevel';

function makeRelief(depth: number, bevelThickness: number) {
  // Letra "O" simplificada: quadrado com furo (testa também contornos internos).
  const shape = new THREE.Shape();
  shape.moveTo(-5, -5);
  shape.lineTo(5, -5);
  shape.lineTo(5, 5);
  shape.lineTo(-5, 5);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-2, -2);
  hole.lineTo(-2, 2);
  hole.lineTo(2, 2);
  hole.lineTo(2, -2);
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry([shape], {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize: 0.25,
    bevelSegments: 4,
  });
}

function signedVolume(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position');
  let v = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

function isClosed(g: THREE.BufferGeometry): boolean {
  const p = g.getAttribute('position');
  const key = (i: number) =>
    `${p.getX(i).toFixed(4)}|${p.getY(i).toFixed(4)}|${p.getZ(i).toFixed(4)}`;
  const edges = new Map<string, number>();
  for (let i = 0; i < p.count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = key(i + k);
      const b = key(i + ((k + 1) % 3));
      const dir = `${a}>${b}`;
      edges.set(dir, (edges.get(dir) ?? 0) + 1);
    }
  }
  for (const [dir, n] of edges) {
    const [a, b] = dir.split('>');
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

describe('flattenBottomBevel', () => {
  it('antes: o bevel inferior fica abaixo de z=0', () => {
    const g = makeRelief(1, 0.22);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.z).toBeCloseTo(-0.22, 5);
  });

  it('depois: fundo reto em z=0, topo inalterado, nenhum vértice abaixo de 0', () => {
    const g = makeRelief(1, 0.22);
    flattenBottomBevel(g);
    const p = g.getAttribute('position');
    let minZ = Infinity;
    for (let i = 0; i < p.count; i++) minZ = Math.min(minZ, p.getZ(i));
    expect(minZ).toBeCloseTo(0, 6);
    expect(minZ).toBeGreaterThanOrEqual(0);
    expect(g.boundingBox!.max.z).toBeCloseTo(1.22, 5);
  });

  it('mantém a malha fechada e com volume positivo', () => {
    const g = makeRelief(0.725, 0.22);
    expect(isClosed(g)).toBe(true);
    const before = signedVolume(g);
    flattenBottomBevel(g);
    expect(isClosed(g)).toBe(true);
    const after = signedVolume(g);
    expect(after).toBeGreaterThan(0);
    // perde só o volume do chanfro inferior
    expect(after).toBeLessThan(before + 1e-6);
    expect(after).toBeGreaterThan(before * 0.7);
  });
});