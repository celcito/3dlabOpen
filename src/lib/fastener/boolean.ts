import * as THREE from "three";
import { loadManifold } from "../split3mf/engines/manifoldLoader";

export interface BooleanResult {
  geometry: THREE.BufferGeometry;
  status: string;
}

/**
 * Welds coincident vertices (by grid snapping) and flattens triangles to a
 * plain vertex/index buffer. Manifold requires every shared vertex to share
 * an index; three.js primitives duplicate corner vertices and even
 * `mergeVertices` fails to collapse them in some versions.
 */
function weldVertices(g: THREE.BufferGeometry, tol = 1e-4): { vertProperties: Float32Array; triVerts: Uint32Array } {
  const p = g.attributes.position;
  const index = g.index;
  const tris: number[][] = [];
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      tris.push([index.getX(i), index.getX(i + 1), index.getX(i + 2)]);
    }
  } else {
    for (let i = 0; i < p.count; i += 3) tris.push([i, i + 1, i + 2]);
  }
  const key = (x: number, y: number, z: number) => `${Math.round(x / tol)},${Math.round(y / tol)},${Math.round(z / tol)}`;
  const map = new Map<string, number>();
  const verts: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    if (!map.has(k)) {
      map.set(k, verts.length / 3);
      verts.push(p.getX(i), p.getY(i), p.getZ(i));
    }
  }
  const out: number[] = [];
  for (const tri of tris) {
    for (const v of tri) out.push(map.get(key(p.getX(v), p.getY(v), p.getZ(v)))!);
  }
  return { vertProperties: new Float32Array(verts), triVerts: new Uint32Array(out) };
}

async function runBoolean(
  a: THREE.BufferGeometry,
  b: THREE.BufferGeometry,
  fn: (x: import("manifold-3d").Manifold, y: import("manifold-3d").Manifold) => import("manifold-3d").Manifold
): Promise<BooleanResult> {
  const mod = await loadManifold();
  const da = weldVertices(a);
  const db = weldVertices(b);
  let am: import("manifold-3d").Manifold;
  let bm: import("manifold-3d").Manifold;
  try {
    am = new mod.Manifold(new mod.Mesh({ numProp: 3, vertProperties: da.vertProperties, triVerts: da.triVerts }));
  } catch (err) {
    throw new Error(
      `csg input mesh "a" is not manifold (${(err as Error).message}) — the source geometry has ` +
        `degenerate/self-intersecting triangles; use a simpler silhouette or tighten the weld tolerance.`,
      { cause: err }
    );
  }
  try {
    bm = new mod.Manifold(new mod.Mesh({ numProp: 3, vertProperties: db.vertProperties, triVerts: db.triVerts }));
  } catch (err) {
    am.delete();
    throw new Error(
      `csg input mesh "b" is not manifold (${(err as Error).message}) — the cutting tool geometry is broken.`,
      { cause: err }
    );
  }

  // Bail out loudly if either input is already broken (not manifold /
  // self-intersecting / etc.) instead of feeding garbage into the boolean
  // and silently returning whatever comes out the other end.
  const aStatus = am.status();
  const bStatus = bm.status();
  if (aStatus !== "NoError" || bStatus !== "NoError") {
    am.delete();
    bm.delete();
    throw new Error(
      `csg input geometry is not manifold (a: ${aStatus}, b: ${bStatus}) — the shape likely has ` +
        `unwelded or degenerate triangles; check the tolerance in weldVertices or the source geometry.`
    );
  }

  const res = fn(am, bm);
  const status = res.status();
  const mesh = res.getMesh();

  am.delete();
  bm.delete();

  if (status !== "NoError") {
    res.delete();
    throw new Error(
      `csg boolean operation failed with status "${status}" — the result geometry would be invalid/corrupted. ` +
        `This usually means the input meshes weren't properly welded before being handed to Manifold.`
    );
  }

  const vp = mesh.vertProperties;
  const triVerts = mesh.triVerts;
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(Array.from(vp), 3));
  out.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1));
  out.computeVertexNormals();

  res.delete();
  return { geometry: out, status };
}

export function csgUnion(a: THREE.BufferGeometry, b: THREE.BufferGeometry): Promise<BooleanResult> {
  return runBoolean(a, b, (x, y) => x.add(y));
}

export function csgSubtract(a: THREE.BufferGeometry, b: THREE.BufferGeometry): Promise<BooleanResult> {
  return runBoolean(a, b, (x, y) => x.subtract(y));
}

export function csgIntersect(a: THREE.BufferGeometry, b: THREE.BufferGeometry): Promise<BooleanResult> {
  return runBoolean(a, b, (x, y) => x.intersect(y));
}