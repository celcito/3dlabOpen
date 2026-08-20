import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { csgUnion, csgSubtract } from "../fastener/boolean";

export type EngravingMode = "none" | "raised" | "recessed";
export type TipStyle = "none" | "hook_only" | "hook_wheel";

export interface CanOpenerConfig {
  /** Outer silhouette (in mm, after trace). The shape's bounding-box height
   *  becomes the handle's length. */
  outer: THREE.Shape;
  /** Inner detail shapes (text, lines). */
  details: THREE.Shape[];
  /** Handle extrusion depth (front-to-back thickness). */
  handleThickness: number;
  /** Edge bevel radius. */
  bevel: number;
  /** Engraving mode for inner details. */
  engraving: EngravingMode;
  /** Engraving depth (raised) or carve depth (recessed). */
  engravingDepth: number;
  /** Cutting tip style. */
  tip: TipStyle;
  /** Length of the cutting tip below the handle. */
  tipLength: number;
  /** Hook width (base) in mm. */
  hookWidth: number;
  /** Hook depth (how far the wedge sits above the apex). */
  hookDepth: number;
  /** Wheel outer radius in mm. */
  wheelRadius: number;
  /** Wheel tube radius in mm. */
  wheelTube: number;
  /** Arm thickness connecting the handle to the wheel in mm. */
  armWidth: number;
  /** Arm thickness in the depth direction. */
  armDepth: number;
  /** Add a vertical keyring hole near the top of the handle. */
  keyring: boolean;
  /** Keyring hole diameter in mm. */
  keyringDiameter: number;
  /** Place the keyring hole near the BOTTOM edge instead of the top — used by
   *  the tab lifter, where the top edge is already taken by the rasgo. */
  keyringBottom?: boolean;
}

/**
 * Build a vertical cylindrical hole geometry (used as the CSG subtract tool
 * for the keyring and any other through-holes).
 */
function verticalHole(diameter: number, length: number): THREE.BufferGeometry {
  const radius = diameter / 2;
  const g = new THREE.CylinderGeometry(radius, radius, length, 24);
  // Default cylinder is along Y — which is exactly what we want.
  return g;
}

/** Ray-casting point-in-polygon test against a list of 2D points. */
function pointInContour(p: { x: number; y: number }, pts: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = (yi > p.y) !== (yj > p.y) &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * True when the whole circle (centre cx,cy, radius r) lies strictly inside
 * the outer contour and clear of every existing hole. Used to guard the
 * keyring hole so a bad position can never break ExtrudeGeometry.
 */
function circleInsideShape(cx: number, cy: number, r: number, outer: THREE.Vector2[], holes: THREE.Path[]): boolean {
  const SAMPLES = 16;
  for (let s = 0; s < SAMPLES; s++) {
    const a = (s / SAMPLES) * Math.PI * 2;
    const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    if (!pointInContour(p, outer)) return false;
    for (const hole of holes) {
      const hpts = hole.getPoints();
      if (hpts.length >= 3 && pointInContour(p, hpts)) return false;
    }
  }
  return true;
}

/**
 * Extrude the handle silhouette as a solid prism. The shape is offset
 * outward by `bevel` (visually rounds the rim) and bevelled top/bottom.
 *
 * If `cfg.keyring` is on, the keyring hole is added as a Path hole in the
 * Shape so the extruded geometry is naturally pierced — no CSG needed.
 *
 * Layout: X = width (centred on 0), Y = height of the shape (base at 0,
 * top at shape max y), Z = depth (centred on 0).
 */
export function buildHandleGeometry(cfg: CanOpenerConfig): THREE.BufferGeometry {
  // Centre the silhouette in X so the handle is balanced.
  const box = new THREE.Box2();
  cfg.outer.getPoints().forEach((p) => box.expandByPoint(p));
  const cx = (box.min.x + box.max.x) / 2;

  const shape = new THREE.Shape();
  const pts = cfg.outer.getPoints();
  shape.moveTo(pts[0].x - cx, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x - cx, pts[i].y);
  shape.closePath();
  for (const hole of cfg.outer.holes) {
    const hpts = hole.getPoints();
    const newHole = new THREE.Path();
    newHole.moveTo(hpts[0].x - cx, hpts[0].y);
    for (let i = 1; i < hpts.length; i++) newHole.lineTo(hpts[i].x - cx, hpts[i].y);
    newHole.closePath();
    shape.holes.push(newHole);
  }

  if (cfg.keyring && cfg.keyringDiameter > 0) {
    const handleLength = box.max.y - box.min.y;
    // Clamp the radius so the hole can never exceed the handle height, and
    // only add it when the full circle lies inside the silhouette — a hole
    // outside (or partially outside) the contour makes ExtrudeGeometry
    // throw "Unable to find proper cut" or emit open, non-manifold output.
    const holeRadius = Math.min(cfg.keyringDiameter / 2, handleLength / 2 - 0.1);
    // Keep the whole circle at least 0.5mm below the silhouette top (or above
    // its bottom, for the rasgo's opposite edge) so it can never poke outside
    // the contour; the containment check still guards against concave/narrow
    // silhouettes where no safe spot exists.
    const holeY = cfg.keyringBottom
      ? box.min.y + holeRadius + 0.5
      : box.max.y - holeRadius - 0.5;
    if (holeRadius > 0 && circleInsideShape(0, holeY, holeRadius, shape.getPoints(), shape.holes)) {
      const hole = new THREE.Path();
      hole.absarc(0, holeY, holeRadius, 0, Math.PI * 2, false);
      shape.holes.push(hole);
    }
  }

  const handleLength = box.max.y - box.min.y;
  const bevel = Math.max(0, Math.min(cfg.bevel, handleLength / 4 - 0.1));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: cfg.handleThickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 24,
  });
  // Centred on Z so the handle is balanced front-to-back. Shift Y so the
  // handle base sits at y=0 (instead of y=min.y).
  g.translate(0, -box.min.y, -cfg.handleThickness / 2);
  return g;
}

/**
 * Engraved (raised or recessed) detail shapes. Returns geometries positioned
 * to be unioned/subtracted against the handle face at z = +handleThickness/2.
 */
export function buildEngravingGeometries(cfg: CanOpenerConfig): THREE.BufferGeometry[] {
  if (cfg.engraving === "none" || cfg.details.length === 0) return [];
  const depth = cfg.engravingDepth;

  return cfg.details.map((shape) => {
    // Centre the detail the same way as the handle.
    const box = new THREE.Box2();
    shape.getPoints().forEach((p) => box.expandByPoint(p));
    const cx = (box.min.x + box.max.x) / 2;

    const centred = new THREE.Shape();
    const pts = shape.getPoints();
    centred.moveTo(pts[0].x - cx, pts[0].y);
    for (let i = 1; i < pts.length; i++) centred.lineTo(pts[i].x - cx, pts[i].y);
    centred.closePath();
    for (const hole of shape.holes) {
      const hpts = hole.getPoints();
      const newHole = new THREE.Path();
      newHole.moveTo(hpts[0].x - cx, hpts[0].y);
      for (let i = 1; i < hpts.length; i++) newHole.lineTo(hpts[i].x - cx, hpts[i].y);
      newHole.closePath();
      centred.holes.push(newHole);
    }

    const geom = new THREE.ExtrudeGeometry(centred, {
      depth,
      bevelEnabled: false,
      curveSegments: 18,
    });
    // The extruded prism sits in [0, depth]. Position it against the front
    // face (z = +handleThickness/2):
    //   - raised:   [T/2, T/2 + depth]  → sticks out, union adds relief.
    //   - recessed: [T/2 - depth, T/2]  → digs into the face, subtract carves.
    geom.translate(0, 0, cfg.engraving === "recessed" ? cfg.handleThickness / 2 - depth : cfg.handleThickness / 2);
    return geom;
  });
}

/**
 * Build the plastic cutting tip (hook + wheel + arm). All parts are
 * extruded along Z so the assembly can be unioned with the handle (also
 * built along Z) in one consistent coordinate space.
 */
export function buildCuttingTipGeometry(cfg: CanOpenerConfig): THREE.BufferGeometry {
  if (cfg.tip === "none") return new THREE.BufferGeometry();
  const armW = Math.max(0.1, cfg.armWidth);
  const armD = Math.max(0.1, cfg.armDepth);
  // Guard the extreme combos the sliders allow: a wheel larger than the tip
  // length would make the arm (and hook) negative, and a tube >= radius
  // makes the torus self-intersect. Clamp to safe ranges.
  const tipLen = Math.max(1, cfg.tipLength);
  const wheelR = Math.min(Math.max(0.2, cfg.wheelRadius), tipLen - 0.5);
  const wheelT = Math.min(Math.max(0.05, cfg.wheelTube), wheelR * 0.8);
  const hookW = Math.max(0.2, cfg.hookWidth);
  const hookDepth = Math.max(0, cfg.hookDepth);

  // The arm sits at z = 0 with its top at y = 0 (handle base). It reaches
  // down to y = -armLength where the wheel sits.
  const armLength = tipLen - wheelR; // >= 0.5 by the wheelR clamp above
  const arm = new THREE.BoxGeometry(armW, armLength, armD);
  arm.translate(0, -armLength / 2, 0);

  // The wheel: torus oriented with its axis vertical (along Y).
  const wheel = new THREE.TorusGeometry(wheelR, wheelT, 12, 24);
  wheel.rotateX(Math.PI / 2); // torus axis along Y → vertical
  wheel.translate(0, -armLength, 0);

  // The hook: a wedge pointing down. Use an extruded triangle. Clamp the
  // height so the triangle can't invert when hookDepth eats the whole tip.
  const hookHeight = Math.max(0.5, tipLen - wheelR - hookDepth);
  const hookShape = new THREE.Shape();
  hookShape.moveTo(-hookW / 2, 0);
  hookShape.lineTo(hookW / 2, 0);
  hookShape.lineTo(0, -hookHeight);
  hookShape.closePath();
  const hook = new THREE.ExtrudeGeometry(hookShape, {
    depth: armD,
    bevelEnabled: false,
    curveSegments: 8,
  });
  hook.translate(0, -wheelR, -armD / 2); // centred on Z, top of hook at wheel centre

  const merged = mergeCompatible([arm, wheel, hook]);
  return merged ?? arm;
}

/**
 * Normalise a set of geometries so they can be safely merged. Three.js's
 * `mergeGeometries` requires every geometry to have the same set of
 * attributes (position always; normal/index/uv/colour only if present in
 * all of them) AND the same `index` status (all indexed or all non-indexed).
 * BoxGeometry, TorusGeometry and ExtrudeGeometry disagree on UVs and sometimes
 * on the index attribute, so we strip extras and convert to a uniform layout.
 */
export function mergeCompatible(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null;
  const allIndexed = geometries.every((g) => g.index !== null);
  const normalised = geometries.map((g) => {
    const c = g.clone();
    if (allIndexed && !c.index) {
      // Need to add an index — easiest is to expand via toNonIndexed then
      // back. Simpler: just keep positions + normals, drop index.
      const flat = c.toNonIndexed();
      flat.copy(new THREE.BufferGeometry().setAttribute("position", flat.getAttribute("position")).setAttribute("normal", flat.getAttribute("normal")));
      return flat;
    }
    // Strip attributes that not all geometries share (uv is the usual culprit).
    for (const key of ["uv", "uv1", "uv2", "color", "tangent"]) {
      if (c.attributes[key as keyof typeof c.attributes]) c.deleteAttribute(key);
    }
    if (!allIndexed && c.index) {
      const flat = c.toNonIndexed();
      return flat;
    }
    return c;
  });
  const merged = BufferGeometryUtils.mergeGeometries(normalised, false);
  // Dispose the clones to avoid leaking GPU resources.
  for (const n of normalised) n.dispose();
  return merged;
}

/**
 * Build the entire can opener as handle + (optional) tip. The cutting tip is
 * NOT CSG-unioned with the handle — instead it is returned as a separate
 * mesh so the STL exporter can write both solids side by side. This avoids
 * fragile boolean operations on complex traced silhouettes where the
 * manifold CSG can reject the input.
 *
 *   - Handle: extruded silhouette, optionally with engraved details.
 *   - Cutting tip: hook + wheel + arm, as its own watertight geometry.
 *   - Keyring hole: optional vertical cylinder, CSG-subtracted from the handle.
 *
 * All parts live in a coordinate space where Y is the handle's length
 * (handle base at y=0, top at y=handleLength), X is width, Z is depth.
 */
export interface CanOpenerResult {
  handle: THREE.BufferGeometry;
  tip: THREE.BufferGeometry | null;
}

export async function buildCanOpenerGeometry(cfg: CanOpenerConfig): Promise<THREE.BufferGeometry> {
  const parts = await buildCanOpenerParts(cfg);
  return combineForExport(parts);
}

/** Build the handle and the tip as separate geometries. */
export async function buildCanOpenerParts(cfg: CanOpenerConfig): Promise<CanOpenerResult> {
  let handle = buildHandleGeometry(cfg);

  // Engraving (raised → mergeCompatible/union, recessed → CSG subtract).
  const engravings = buildEngravingGeometries(cfg);
  if (engravings.length > 0) {
    if (cfg.engraving === "raised") {
      for (const e of engravings) {
        const merged = mergeCompatible([handle, e]);
        if (merged) handle = merged;
      }
    } else if (cfg.engraving === "recessed") {
      let merged = mergeCompatible(engravings);
      if (!merged) merged = engravings[0];
      handle = (await csgSubtract(handle, merged)).geometry;
    }
  }

  // Keyring hole is baked into the handle Shape itself (see
  // buildHandleGeometry) so no CSG is required here.

  // Tip stays as its own geometry — see file comment for why we skip CSG here.
  let tip: THREE.BufferGeometry | null = null;
  if (cfg.tip !== "none") {
    const t = buildCuttingTipGeometry(cfg);
    if (t.attributes.position.count > 0) tip = t;
  }

  handle.computeBoundingBox();
  if (tip) tip.computeBoundingBox();
  return { handle, tip };
}

/**
 * Merge the handle and tip into a single BufferGeometry for STL export.
 * Both parts are independently watertight; concatenating their index
 * buffers preserves that without any boolean ops.
 */
function combineForExport({ handle, tip }: CanOpenerResult): THREE.BufferGeometry {
  if (!tip) return handle;
  const merged = mergeCompatible([handle, tip]);
  return merged ?? handle;
}