import * as THREE from "three";

export interface ThreadOptions {
  /** Nominal thread outer diameter (crest-to-crest), mm. */
  major: number;
  /** Thread pitch in mm per turn. */
  pitch: number;
  /** Axial length of the threaded region, mm. */
  length: number;
  /** Radial segments per turn. */
  segments?: number;
  /** Axial subdivisions per pitch. */
  stepsPerPitch?: number;
  /** 1 = right-hand thread, -1 = left-hand. */
  hand?: 1 | -1;
  /** Thread depth override. Default: 0.54127 * pitch (ISO basic profile). */
  depth?: number;
  /** Radial clearance added to the whole profile (used for internal threads). */
  clearance?: number;
}

/** Radius factor within one pitch. 0 = root (minor), 1 = crest (major). */
export function threadRadiusFactor(t: number): number {
  const tt = ((t % 1) + 1) % 1;
  if (tt < 0.25) return tt / 0.25;
  if (tt < 0.5) return 1 - (tt - 0.25) / 0.25;
  return 0;
}

/**
 * Builds a watertight threaded-rod solid along +Y (three.js Y-up
 * convention): a helix-wrapped profile whose radius oscillates between
 * `minor` and `major` with one ridge per pitch. The result is a closed
 * indexed mesh (side surface + two end disks), suitable as a CSG brush or
 * for direct STL export.
 *
 * Used directly for external threads (screw shank) and as the removal solid
 * for internal threads (nut hole): pass `major = holeDia + 2*depth` so the
 * crests land exactly on the hole wall and the grooves bite `depth` outward.
 */
export function buildThreadedRod(opts: ThreadOptions): THREE.BufferGeometry {
  const { major, pitch, length } = opts;
  const segments = Math.max(8, opts.segments ?? 48);
  const stepsPerPitch = Math.max(3, opts.stepsPerPitch ?? 12);
  const hand = opts.hand ?? 1;
  const depth = opts.depth ?? 0.54127 * pitch;
  const clearance = opts.clearance ?? 0;

  if (length <= 0 || pitch <= 0 || major <= 0) {
    return new THREE.BufferGeometry();
  }

  const R = major / 2 + clearance / 2;
  const r0 = Math.max(R - depth - clearance / 2, R * 0.25);
  const N = segments;
  const M = Math.max(4, Math.ceil((length / pitch) * stepsPerPitch));

  const pos: number[] = [];
  const idx: number[] = [];

  const thetaFor = (i: number) => (i / N) * Math.PI * 2;
  const yFor = (j: number) => (j / M) * length;

  // Grid vertices: N x (M+1), wrapping around the seam (i % N).
  for (let j = 0; j <= M; j++) {
    const y = yFor(j);
    const phase = y / pitch;
    const t = phase - Math.floor(phase);
    const r = r0 + (R - r0) * threadRadiusFactor(t);
    const offset = hand * phase * Math.PI * 2;
    for (let i = 0; i < N; i++) {
      const th = thetaFor(i) + offset;
      pos.push(r * Math.cos(th), y, r * Math.sin(th));
    }
  }
  const vid = (i: number, j: number) => j * N + (i % N);

  // Side quads between consecutive rings, closing the seam.
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const a = vid(i, j);
      const b = vid(i + 1, j);
      const c = vid(i + 1, j + 1);
      const d = vid(i, j + 1);
      idx.push(a, c, b, a, d, c);
    }
  }

  // Bottom disk (outward -Y).
  const bottomCenter = pos.length / 3;
  pos.push(0, 0, 0);
  for (let i = 0; i < N; i++) {
    idx.push(bottomCenter, vid(i, 0), vid(i + 1, 0));
  }

  // Top disk (outward +Y).
  const topCenter = pos.length / 3;
  pos.push(0, length, 0);
  for (let i = 0; i < N; i++) {
    idx.push(topCenter, vid(i + 1, M), vid(i, M));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}

export interface InternalThreadOptions {
  /** Nominal hole diameter (internal thread crest-to-crest), mm. */
  holeDiameter: number;
  pitch: number;
  length: number;
  segments?: number;
  stepsPerPitch?: number;
  clearance?: number;
}

/** Removal solid for an internal thread (nut hole). Subtract from the body. */
export function buildInternalThreadRemoval(opts: InternalThreadOptions): THREE.BufferGeometry {
  const { holeDiameter, pitch, length, clearance = 0 } = opts;
  const depth = 0.54127 * pitch;
  return buildThreadedRod({
    major: holeDiameter + 2 * depth,
    pitch,
    length,
    segments: opts.segments,
    stepsPerPitch: opts.stepsPerPitch,
    clearance,
  });
}

/** Metrics for the thread profile of a given size. */
export function threadDepth(pitch: number): number {
  return 0.54127 * pitch;
}

export function minorDiameter(major: number, pitch: number): number {
  return Math.max(major - 2 * threadDepth(pitch), major * 0.5);
}

/**
 * Verifies a geometry is a closed 2-manifold: every undirected edge must be
 * shared by exactly two triangles. Works on indexed and non-indexed
 * geometries (non-indexed vertices are matched by position). Returns the
 * count of boundary edges.
 */
export function countBoundaryEdges(geometry: THREE.BufferGeometry): number {
  const position = geometry.attributes.position;
  if (!position) return Infinity;

  // Canonicalize every triangle's corners to a unique vertex id derived from
  // position. three.js primitives (and CSG output) often duplicate vertices
  // at shared corners, so raw index edges would mis-match across faces. Snap
  // to 0.1 µm so CSG split-point micro-noise still merges.
  const snap = (v: number) => Math.round(v * 1e6) / 1e6;
  const map = new Map<string, number>();
  const canon = (i: number) => {
    const k = `${snap(position.getX(i))}:${snap(position.getY(i))}:${snap(position.getZ(i))}`;
    let id = map.get(k);
    if (id === undefined) {
      id = map.size;
      map.set(k, id);
    }
    return id;
  };

  const index = geometry.index;
  const nTris = Math.floor((index ? index.count : position.count) / 3);
  const edgeCount = new Map<string, number>();
  const ekey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const addTri = (i0: number, i1: number, i2: number) => {
    const t = [canon(i0), canon(i1), canon(i2)];
    for (let e = 0; e < 3; e++) {
      const k = ekey(t[e], t[(e + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  };

  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) addTri(arr[i], arr[i + 1], arr[i + 2]);
  } else {
    for (let i = 0; i < position.count; i += 3) addTri(i, i + 1, i + 2);
  }
  void nTris;

  let boundary = 0;
  for (const c of edgeCount.values()) {
    if (c !== 2) boundary += 1;
  }
  return boundary;
}

export function isWatertight(geometry: THREE.BufferGeometry): boolean {
  return countBoundaryEdges(geometry) === 0;
}

/** Signed volume of a triangle mesh (>0 for outward winding). */
export function signedVolume(geometry: THREE.BufferGeometry): number {
  const position = geometry.attributes.position;
  if (!position) return 0;
  const p = position;
  let vol = 0;
  const addTri = (i0: number, i1: number, i2: number) => {
    const ax = p.getX(i0), ay = p.getY(i0), az = p.getZ(i0);
    const bx = p.getX(i1), by = p.getY(i1), bz = p.getZ(i1);
    const cx = p.getX(i2), cy = p.getY(i2), cz = p.getZ(i2);
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  };
  const index = geometry.index;
  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) addTri(arr[i], arr[i + 1], arr[i + 2]);
  } else {
    for (let i = 0; i < position.count; i += 3) addTri(i, i + 1, i + 2);
  }
  return vol / 6;
}
