import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from "three-bvh-csg";

const evaluator = new Evaluator();
evaluator.attributes = ["position", "normal"];
evaluator.useGroups = false;

function toBrush(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): Brush {
  const g = ensureIndexedWithNormals(geometry);
  const brush = new Brush(g.clone());
  if (matrix) brush.matrix.copy(matrix);
  brush.updateMatrixWorld(true);
  return brush;
}

// three-bvh-csg needs indexed, normal-bearing geometry to stay watertight.
function ensureIndexedWithNormals(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.clone();
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  return g;
}

export function union(a: THREE.BufferGeometry, b: THREE.BufferGeometry, matrixB?: THREE.Matrix4): THREE.BufferGeometry {
  const brushA = toBrush(a);
  const brushB = toBrush(b, matrixB);
  const result = evaluator.evaluate(brushA, brushB, ADDITION);
  result.geometry.computeVertexNormals();
  return result.geometry;
}

export function subtract(a: THREE.BufferGeometry, b: THREE.BufferGeometry, matrixB?: THREE.Matrix4): THREE.BufferGeometry {
  const brushA = toBrush(a);
  const brushB = toBrush(b, matrixB);
  const result = evaluator.evaluate(brushA, brushB, SUBTRACTION);
  result.geometry.computeVertexNormals();
  return result.geometry;
}

export function intersect(a: THREE.BufferGeometry, b: THREE.BufferGeometry, matrixB?: THREE.Matrix4): THREE.BufferGeometry {
  const brushA = toBrush(a);
  const brushB = toBrush(b, matrixB);
  const result = evaluator.evaluate(brushA, brushB, INTERSECTION);
  result.geometry.computeVertexNormals();
  return result.geometry;
}

export interface JointConfig {
  /** World-space point where the joint sits (center of the mating face). */
  position: THREE.Vector3;
  /** Direction the peg points, from the male part into the female part. */
  direction: THREE.Vector3;
  /** Peg diameter in the same units as the model. */
  pegDiameter: number;
  /** How far the peg extends into the socket. */
  pegLength: number;
  /**
   * Extra radius (per side) added to the socket vs. the peg, so printed
   * parts actually slide together. 0.1-0.2mm is a sane FDM default.
   */
  fitTolerance?: number;
}

/**
 * Fuses a single peg into `geometry`, protruding from `position` along
 * `direction`. One-sided primitive — use this directly when you're only
 * exporting one piece of a mating pair at a time (e.g. Viewer3D's per-group
 * export buttons) and don't need the other side's result in the same call.
 *
 * `segments` is the radial resolution: pass `6` for a hexagonal snap-fit peg
 * (anti-rotation) or leave the default `24` for a round peg. `embedLength`
 * buries the peg into the part behind `position` so it actually fuses with
 * the material instead of floating at the cut face — pass `position.distanceTo(maleCentroid)`
 * when exporting a male piece.
 */
export function addPeg(
  geometry: THREE.BufferGeometry,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  diameter: number,
  length: number,
  segments = 24,
  embedLength = 0
): THREE.BufferGeometry {
  const dir = direction.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const totalLength = length + embedLength;
  const pegGeom = new THREE.CylinderGeometry(diameter / 2, diameter / 2, totalLength, segments);
  const matrix = new THREE.Matrix4().compose(
    position.clone().add(dir.clone().multiplyScalar((length - embedLength) / 2)),
    quat,
    new THREE.Vector3(1, 1, 1)
  );
  return union(geometry, pegGeom, matrix);
}

/**
 * Carves a single socket/cavity out of `geometry`, opening at `position` and
 * extending into the part along `direction`. One-sided primitive — covers
 * both a snap-fit socket and a magnet cavity; the only difference between
 * those two is the diameter/length/tolerance the caller passes in.
 *
 * `segments` is the radial resolution: pass `6` for a hexagonal snap-fit
 * socket matching a hexagonal peg, or keep the default `24` for a round hole.
 */
export function addSocket(
  geometry: THREE.BufferGeometry,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  diameter: number,
  length: number,
  segments = 24
): THREE.BufferGeometry {
  const dir = direction.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const socketGeom = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, segments);
  const matrix = new THREE.Matrix4().compose(
    position.clone().add(dir.clone().multiplyScalar(length / 2)),
    quat,
    new THREE.Vector3(1, 1, 1)
  );
  return subtract(geometry, socketGeom, matrix);
}

/**
 * Adds a reinforced hexagonal boss to the outside of a mating boundary and
 * cuts the socket into the female part. The small embed keeps the boss fused
 * to the part instead of merely touching its open cut face.
 */
export function addReinforcedSocket(
  geometry: THREE.BufferGeometry,
  position: THREE.Vector3,
  directionIntoPart: THREE.Vector3,
  socketDiameter: number,
  socketLength: number,
  reinforcementDiameter: number,
  reinforcementHeight: number,
  reinforcementWall: number,
  segments = 6,
): THREE.BufferGeometry {
  const dir = directionIntoPart.clone().normalize();
  const boss = addPeg(
    geometry,
    position,
    dir.clone().negate(),
    reinforcementDiameter,
    reinforcementHeight,
    segments,
    Math.max(0.05, reinforcementWall),
  );
  return addSocket(boss, position, dir, socketDiameter, socketLength, segments);
}

/**
 * Adds a cylindrical peg to `malePart` and carves the matching socket out of
 * `femalePart` in a single call, both centered on `config.position`. Use
 * this when you have both mating pieces in hand at once (e.g.
 * FlexiModelCreator, which builds every segment before exporting). If you
 * only have one side available per call, use addPeg/addSocket directly
 * instead — see Viewer3D's exportSeparatedPart.
 */
export function addPegSocketJoint(
  malePart: THREE.BufferGeometry,
  femalePart: THREE.BufferGeometry,
  config: JointConfig
): { male: THREE.BufferGeometry; female: THREE.BufferGeometry } {
  const { position, direction, pegDiameter, pegLength, fitTolerance = 0.15 } = config;
  const dir = direction.clone().normalize();

  const male = addPeg(malePart, position, dir, pegDiameter, pegLength);
  const female = addSocket(
    femalePart,
    position,
    dir,
    pegDiameter + fitTolerance * 2,
    pegLength + fitTolerance // slightly deeper so the peg can seat fully
  );

  return { male, female };
}

/**
 * Closes open boundaries left after filtering a mesh's triangles by an
 * arbitrary (non-planar) selection — e.g. a freeform painted region. Unlike
 * splitByPlane, this works on any boundary shape: it finds every edge used
 * by exactly one triangle, chains those into loops, and fans each loop from
 * its centroid to seal the hole. Needed before any boolean op (peg/socket,
 * magnet cavity) touches a piece produced this way, since those ops require
 * a manifold, watertight brush to behave correctly.
 *
 * Geometry must be indexed. Returns a new geometry; the input is untouched.
 */
export function capBoundaryHoles(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry.clone() : mergeVerticesToIndex(geometry.clone());
  const posAttr = g.attributes.position;
  const index = g.index!;
  const idx = index.array;

  // Count how many times each directed edge (a->b) appears. A manifold
  // interior edge shows up once in each direction (once per adjacent
  // triangle); a boundary edge shows up only once, in one direction.
  const edgeUse = new Map<string, { a: number; b: number; count: number }>();
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

  for (let i = 0; i < idx.length; i += 3) {
    const tri = [idx[i], idx[i + 1], idx[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const k = key(a, b);
      const existing = edgeUse.get(k);
      if (existing) existing.count++;
      else edgeUse.set(k, { a, b, count: 1 });
    }
  }

  // Boundary edges: used exactly once. Keep them directed as originally
  // wound so loop-chaining preserves the winding needed for outward caps.
  const boundaryNext = new Map<number, number>();
  for (const { a, b, count } of edgeUse.values()) {
    if (count === 1) boundaryNext.set(a, b);
  }

  if (boundaryNext.size === 0) return g; // already watertight

  // Chain directed boundary edges into closed loops.
  const loops: number[][] = [];
  const consumed = new Set<number>();
  for (const start of boundaryNext.keys()) {
    if (consumed.has(start)) continue;
    const loop: number[] = [start];
    consumed.add(start);
    let cur = boundaryNext.get(start)!;
    let guard = 0;
    while (cur !== start && guard++ < boundaryNext.size + 1) {
      loop.push(cur);
      consumed.add(cur);
      const next = boundaryNext.get(cur);
      if (next === undefined) break; // malformed/open loop, bail out safely
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }

  const newPositions: number[] = Array.from(posAttr.array as ArrayLike<number>);
  const newIndices: number[] = Array.from(idx as ArrayLike<number>);
  let nextVertex = posAttr.count;

  for (const loop of loops) {
    const centroid = new THREE.Vector3();
    for (const vi of loop) {
      centroid.x += posAttr.getX(vi);
      centroid.y += posAttr.getY(vi);
      centroid.z += posAttr.getZ(vi);
    }
    centroid.divideScalar(loop.length);

    const centroidIdx = nextVertex++;
    newPositions.push(centroid.x, centroid.y, centroid.z);

    // Fan from centroid, reversing each boundary edge's direction: a
    // directed boundary edge (a->b) belongs to the triangle that used to
    // sit on the OTHER side of the hole, so the cap needs (b, a, centroid)
    // to face the same way outward. Verified against a signed-volume test.
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      newIndices.push(b, a, centroidIdx);
    }
  }

  const capped = new THREE.BufferGeometry();
  capped.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));
  capped.setIndex(newIndices);
  capped.computeVertexNormals();
  return capped;
}

function mergeVerticesToIndex(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  // Real position-based vertex welding, needed because capBoundaryHoles's
  // edge-use counting only works if shared vertices actually share an
  // index. A trivial 0..n index (no welding) would make every edge look
  // like a boundary edge, since nothing would be shared between triangles.
  return mergeVertices(geometry, 1e-5);
}

export interface MagnetJointConfig {
  position: THREE.Vector3;
  /** Direction from partA's mating face into partA's body. */
  direction: THREE.Vector3;
  diameter: number;
  depth: number;
}

/**
 * Carves a matching cylindrical recess into each side of a mating pair, for
 * gluing in a magnet post-print — no male/female geometry, both cavities are
 * the same size. `direction` is the recess direction for partA; partB gets
 * the mirrored direction so both pockets open onto the same seam.
 */
export function addMagnetCavities(
  partA: THREE.BufferGeometry,
  partB: THREE.BufferGeometry,
  config: MagnetJointConfig
): { partA: THREE.BufferGeometry; partB: THREE.BufferGeometry } {
  const { position, direction, diameter, depth } = config;
  const dirA = direction.clone().normalize();
  const dirB = dirA.clone().negate();

  const cavityGeom = () => new THREE.CylinderGeometry(diameter / 2, diameter / 2, depth, 24);
  const quatA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirA);
  const quatB = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirB);

  const matrixA = new THREE.Matrix4().compose(
    position.clone().add(dirA.clone().multiplyScalar(depth / 2)),
    quatA,
    new THREE.Vector3(1, 1, 1)
  );
  const matrixB = new THREE.Matrix4().compose(
    position.clone().add(dirB.clone().multiplyScalar(depth / 2)),
    quatB,
    new THREE.Vector3(1, 1, 1)
  );

  return {
    partA: subtract(partA, cavityGeom(), matrixA),
    partB: subtract(partB, cavityGeom(), matrixB),
  };
}

/**
 * Splits `source` into two watertight, capped pieces using a cutting plane.
 * Only useful for straight-plane cuts — freeform painted regions in
 * Viewer3D go through capBoundaryHoles instead, since their boundary isn't
 * planar.
 *
 * `plane` is in the same local space as `source`. Everything on the
 * positive side of the plane's normal goes into `partA`.
 */
export function splitByPlane(
  source: THREE.BufferGeometry,
  plane: THREE.Plane,
  boxSize = 1000
): { partA: THREE.BufferGeometry; partB: THREE.BufferGeometry } {
  const halfSpaceA = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  const quatA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
  const centerA = plane.normal.clone().multiplyScalar(boxSize / 2 - plane.constant);
  const matrixA = new THREE.Matrix4().compose(centerA, quatA, new THREE.Vector3(1, 1, 1));

  const halfSpaceB = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  const negNormal = plane.normal.clone().negate();
  const quatB = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), negNormal);
  const centerB = negNormal.clone().multiplyScalar(boxSize / 2 + plane.constant);
  const matrixB = new THREE.Matrix4().compose(centerB, quatB, new THREE.Vector3(1, 1, 1));

  const partA = intersect(source, halfSpaceA, matrixA);
  const partB = intersect(source, halfSpaceB, matrixB);

  return { partA, partB };
}

/**
 * Performs a CSG boolean difference with tolerance: expands `tool` by
 * `tolerance` uniformly (via vertex displacement along normals) before
 * subtracting it from `base`. This creates a cavity in `base` that
 * matches `tool`'s shape with a configurable gap for FDM/SLA print fit.
 *
 * Returns the resulting geometry (base with cavity carved out).
 */
export function booleanDifferenceWithTolerance(
  base: THREE.BufferGeometry,
  tool: THREE.BufferGeometry,
  tolerance: number
): THREE.BufferGeometry {
  if (tolerance <= 0) return subtract(base, tool);

  const expanded = tool.clone();
  expanded.computeVertexNormals();
  const posAttr = expanded.attributes.position;
  const normAttr = expanded.attributes.normal;
  const center = new THREE.Vector3();
  expanded.computeBoundingBox();
  expanded.boundingBox!.getCenter(center);

  for (let i = 0; i < posAttr.count; i++) {
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);
    posAttr.setX(i, posAttr.getX(i) + nx * tolerance);
    posAttr.setY(i, posAttr.getY(i) + ny * tolerance);
    posAttr.setZ(i, posAttr.getZ(i) + nz * tolerance);
  }
  posAttr.needsUpdate = true;
  expanded.computeVertexNormals();

  return subtract(base, expanded);
}

/**
 * Fuses `tool` into `base` via CSG union, after expanding `tool` by
 * `tolerance` along its vertex normals. Used on the male part to absorb
 * the overlapping volume so the exported piece is a single watertight mesh.
 */
export function booleanUnionWithTolerance(
  base: THREE.BufferGeometry,
  tool: THREE.BufferGeometry,
  tolerance: number
): THREE.BufferGeometry {
  if (tolerance <= 0) return union(base, tool);

  const expanded = tool.clone();
  expanded.computeVertexNormals();
  const posAttr = expanded.attributes.position;
  const normAttr = expanded.attributes.normal;

  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setX(i, posAttr.getX(i) + normAttr.getX(i) * tolerance);
    posAttr.setY(i, posAttr.getY(i) + normAttr.getY(i) * tolerance);
    posAttr.setZ(i, posAttr.getZ(i) + normAttr.getZ(i) * tolerance);
  }
  posAttr.needsUpdate = true;
  expanded.computeVertexNormals();

  return union(base, expanded);
}
