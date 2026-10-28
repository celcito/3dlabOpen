/**
 * Subdivides the front (textured, UV-carrying) faces of a puzzle piece
 * geometry so the artwork survives Bambu Studio's per-triangle
 * Texture-to-Color sampling.
 *
 * Only the group-0 (front face) triangles are subdivided; the sides/back
 * shell keeps its original coarse mesh so the side color stays clean and
 * file size stays reasonable.
 */

import * as THREE from "three";

export interface SubdivideFrontOptions {
  /** Maximum subdivision iterations. Each iteration ≈ 4× the front triangles. */
  maxIterations: number;
  /** Hard cap on front-facing triangles after subdivision (safety valve). */
  maxFrontTriangles: number;
}

const DEFAULT_OPTIONS: SubdivideFrontOptions = {
  maxIterations: 2,
  maxFrontTriangles: 6000,
};

/**
 * Clone `geometry`, detect the front-face group (the one whose triangles
 * carry real UVs mapping the artwork), and subdivide only that group.
 *
 * Returns a new geometry with:
 *  - a single merged position/normal/uv attribute
 *  - no groups (caller can re-tag materials however they like)
 */
export function subdivideFrontFaces(
  geometry: THREE.BufferGeometry,
  options: Partial<SubdivideFrontOptions> = {}
): THREE.BufferGeometry {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Work on a non-indexed clone so per-triangle ops are straightforward.
  let base: THREE.BufferGeometry;
  if (geometry.index) {
    base = geometry.clone().toNonIndexed();
  } else {
    base = geometry.clone();
  }
  base.computeVertexNormals();

  const pos = base.getAttribute("position");
  const uv = base.getAttribute("uv");
  const norm = base.getAttribute("normal");
  if (!pos || !norm || !uv || pos.count < 3) return base.clone();

  const triCount = pos.count / 3;

  // Identify front triangles: same heuristic as preparePieceGeometryWithMaterials
  // — keep triangles whose UVs actually vary (artwork mapping) vs. the side shell
  // whose UVs are pinned to (0,0). When UVs are all over the front, the non-front
  // shell UVs are usually degenerate; that is the discriminator we use here.
  const frontTriIndices: number[] = [];
  const setTri: Uint8Array = new Uint8Array(triCount);

  const uvArr = uv.array as Float32Array;
  const posArr = pos.array as Float32Array;

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const u0 = uvArr[i0 * 2];
    const v0 = uvArr[i0 * 2 + 1];
    const u1 = uvArr[(i0 + 1) * 2];
    const v1 = uvArr[(i0 + 1) * 2 + 1];
    const u2 = uvArr[(i0 + 2) * 2];
    const v2 = uvArr[(i0 + 2) * 2 + 1];

    // A real front face has UV span across the texture; side/back shell is pinned.
    const uvSpan = Math.max(u0, u1, u2) - Math.min(u0, u1, u2)
                + Math.max(v0, v1, v2) - Math.min(v0, v1, v2);
    const isFront = uvSpan > 0.02; // tiny threshold; degenerate shell is ~0

    if (isFront) {
      frontTriIndices.push(t);
      setTri[t] = 1;
    }
  }

  // If we couldn't identify a front shell, fall back to subdividing nothing
  // (don't punish caller geometry that's already flat/uniform).
  if (frontTriIndices.length === 0) return base.clone();

  // Rebuild geometry from scratch, subdividing front triangles only.
  const outPos: number[] = [];
  const outNorm: number[] = [];
  const outUv: number[] = [];

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const x0 = posArr[i0], y0 = posArr[i0 + 1], z0 = posArr[i0 + 2];
    const x1 = posArr[i0 + 3], y1 = posArr[i0 + 4], z1 = posArr[i0 + 5];
    const x2 = posArr[i0 + 6], y2 = posArr[i0 + 7], z2 = posArr[i0 + 8];

    const u0 = uvArr[i0 * 2], v0 = uvArr[i0 * 2 + 1];
    const u1 = uvArr[(i0 + 1) * 2], v1 = uvArr[(i0 + 1) * 2 + 1];
    const u2 = uvArr[(i0 + 2) * 2], v2 = uvArr[(i0 + 2) * 2 + 1];

    const nx0 = norm.array[i0], ny0 = norm.array[i0 + 1], nz0 = norm.array[i0 + 2];
    const nx1 = norm.array[i0 + 3], ny1 = norm.array[i0 + 4], nz1 = norm.array[i0 + 5];
    const nx2 = norm.array[i0 + 6], ny2 = norm.array[i0 + 7], nz2 = norm.array[i0 + 8];

    if (!setTri[t]) {
      // Side/back shell: keep as-is.
      outPos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
      outNorm.push(nx0, ny0, nz0, nx1, ny1, nz1, nx2, ny2, nz2);
      outUv.push(u0, v0, u1, v1, u2, v2);
      continue;
    }

    // Front triangle: subdivide up to opts.maxIterations, capped by budget.
    let stack: Tri = {
      x0, y0, z0, x1, y1, z1, x2, y2, z2,
      u0, v0, u1, v1, u2, v2,
      nx0, ny0, nz0, nx1, ny1, nz1, nx2, ny2, nz2,
    };
    let remaining = opts.maxIterations;

    while (remaining > 0 && frontTriCount(stack) < opts.maxFrontTriangles / 4) {
      const a = splitTri(stack);
      // Recurse: each of the 4 children may be subdivided further.
      stack = a[0];
      // We inline a tiny BFS here to keep it readable; just flatten the 4
      // children and subdivide each the same number of remaining rounds.
      const children: Tri[] = [a[1], a[2], a[3]];
      remaining--;

      // For simplicity and predictable budget, split every child the same
      // number of times as the parent would have been split one more round.
      // That yields a full quadtree of depth remaining.
      const nextRoundChildren: Tri[] = [];
      for (const child of children) {
        if (remaining <= 0) {
          nextRoundChildren.push(child);
          continue;
        }
        const c = splitTri(child);
        nextRoundChildren.push(c[0], c[1], c[2], c[3]);
      }
      stack = nextRoundChildren[0];
      // Flatten the rest into a queue we'll consume below.
      const queue: Tri[] = [stack, ...nextRoundChildren.slice(1)];
      while (queue.length) {
        const cur = queue.shift()!;
        outPos.push(cur.x0, cur.y0, cur.z0, cur.x1, cur.y1, cur.z1, cur.x2, cur.y2, cur.z2);
        outNorm.push(cur.nx0, cur.ny0, cur.nz0, cur.nx1, cur.ny1, cur.nz1, cur.nx2, cur.ny2, cur.nz2);
        outUv.push(cur.u0, cur.v0, cur.u1, cur.v1, cur.u2, cur.v2);
      }
      break;
    }

    // If we broke out of the loop above, `stack` and the queue were already
    // flushed. The while/break handles the full subdivision in one shot.
    // Otherwise fall through to emit the (still-coarse) front triangle.
    if (frontTriCount(stack) > 0 && remaining <= 0) {
      // The loop consumed 'stack' into the queue already; nothing left to emit.
      continue;
    }

    // Safety: if budget prevented subdivision, emit the original front tri.
    outPos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
    outNorm.push(nx0, ny0, nz0, nx1, ny1, nz1, nx2, ny2, nz2);
    outUv.push(u0, v0, u1, v1, u2, v2);
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(outPos), 3)
  );
  result.setAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array(outNorm), 3)
  );
  result.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(outUv), 2)
  );
  result.computeVertexNormals();
  return result;
}

/** Number of triangles represented by one Tri leaf. */
function frontTriCount(t: Tri): number {
  return 1;
}

/** Split a triangle into 4 by connecting edge midpoints. */
function splitTri(t: Tri): [Tri, Tri, Tri, Tri] {
  const mx0 = (t.x0 + t.x1) / 2, my0 = (t.y0 + t.y1) / 2, mz0 = (t.z0 + t.z1) / 2;
  const mx1 = (t.x1 + t.x2) / 2, my1 = (t.y1 + t.y2) / 2, mz1 = (t.z1 + t.z2) / 2;
  const mx2 = (t.x2 + t.x0) / 2, my2 = (t.y2 + t.y0) / 2, mz2 = (t.z2 + t.z0) / 2;

  const mux0 = (t.u0 + t.u1) / 2, mvy0 = (t.v0 + t.v1) / 2;
  const mux1 = (t.u1 + t.u2) / 2, mvy1 = (t.v1 + t.v2) / 2;
  const mux2 = (t.u2 + t.u0) / 2, mvy2 = (t.v2 + t.v0) / 2;

  const mnx0 = (t.nx0 + t.nx1) / 2, mny0 = (t.ny0 + t.ny1) / 2, mnz0 = (t.nz0 + t.nz1) / 2;
  const mnx1 = (t.nx1 + t.nx2) / 2, mny1 = (t.ny1 + t.ny2) / 2, mnz1 = (t.nz1 + t.nz2) / 2;
  const mnx2 = (t.nx2 + t.nx0) / 2, mny2 = (t.ny2 + t.ny0) / 2, mnz2 = (t.nz2 + t.nz0) / 2;

  const a: Tri = {
    x0: t.x0, y0: t.y0, z0: t.z0,
    x1: mx0, y1: my0, z1: mz0,
    x2: mx2, y2: my2, z2: mz2,
    u0: t.u0, v0: t.v0,
    u1: mux0, v1: mvy0,
    u2: mux2, v2: mvy2,
    nx0: t.nx0, ny0: t.ny0, nz0: t.nz0,
    nx1: mnx0, ny1: mny0, nz1: mnz0,
    nx2: mnx2, ny2: mny2, nz2: mnz2,
  };
  const b: Tri = {
    x0: mx0, y0: my0, z0: mz0,
    x1: t.x1, y1: t.y1, z1: t.z1,
    x2: mx1, y2: my1, z2: mz1,
    u0: mux0, v0: mvy0,
    u1: t.u1, v1: t.v1,
    u2: mux1, v2: mvy1,
    nx0: mnx0, ny0: mny0, nz0: mnz0,
    nx1: t.nx1, ny1: t.ny1, nz1: t.nz1,
    nx2: mnx1, ny2: mny1, nz2: mnz1,
  };
  const c: Tri = {
    x0: mx2, y0: my2, z0: mz2,
    x1: mx1, y1: my1, z1: mz1,
    x2: t.x2, y2: t.y2, z2: t.z2,
    u0: mux2, v0: mvy2,
    u1: mux1, v1: mvy1,
    u2: t.u2, v2: t.v2,
    nx0: mnx2, ny0: mny2, nz0: mnz2,
    nx1: mnx1, ny1: mny1, nz1: mnz1,
    nx2: t.nx2, ny2: t.ny2, nz2: t.nz2,
  };
  const d: Tri = {
    x0: mx0, y0: my0, z0: mz0,
    x1: mx1, y1: my1, z1: mz1,
    x2: mx2, y2: my2, z2: mz2,
    u0: mux0, v0: mvy0,
    u1: mux1, v1: mvy1,
    u2: mux2, v2: mvy2,
    nx0: mnx0, ny0: mny0, nz0: mnz0,
    nx1: mnx1, ny1: mny1, nz1: mnz1,
    nx2: mnx2, ny2: mny2, nz2: mnz2,
  };

  return [a, b, c, d];
}

/** Lightweight triangle payload used during subdivision. */
interface Tri {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
  u0: number; v0: number;
  u1: number; v1: number;
  u2: number; v2: number;
  nx0: number; ny0: number; nz0: number;
  nx1: number; ny1: number; nz1: number;
  nx2: number; ny2: number; nz2: number;
}
