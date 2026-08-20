import * as THREE from "three";
import { csgSubtract } from "../fastener/boolean";
import { buildHandleGeometry, mergeCompatible } from "./canOpenerGeometry";
import type { TracedRegion } from "./traceImage";
import type { ExportPiece } from "../split3mf/exporters/types";

/**
 * Tab-lifter ("puxador de aba de lata") geometry.
 *
 * The piece is the traced silhouette extruded as a solid slab. Near the top
 * edge, a vertical slot ("rasgo") is carved out, open at the border, where
 * the pull-tab ring of a can is lowered in from above so the piece can lever
 * it open. The slot is a closed pocket: `slotWall` of material is left on the
 * front and back faces, so both sides stay solid ("tampado") and only the
 * top-edge slit ("fresta") admits the tab.
 *
 * When the drawing has coloured regions, each region is extruded as a thin
 * relief on the front face with its own colour — one `ExportPiece` per
 * colour, exported together as a multi-colour 3MF (each object = a filament).
 *
 * Layout: X = width (centred on 0), Y = height (base at 0), Z = depth.
 */
export interface TabLifterConfig {
  /** Outer silhouette (in mm, after trace). */
  outer: THREE.Shape;
  /** Coloured inner regions from the drawing (background excluded). */
  regions: TracedRegion[];
  /** Handle extrusion depth (front-to-back thickness). */
  handleThickness: number;
  /** Edge bevel radius (disabled automatically when reliefs are present so
   *  the coloured layers sit flush on a flat front face). */
  bevel: number;
  /** Vertical depth of the slot, measured down from the top edge (mm). */
  slotDepth: number;
  /** Horizontal opening (width) of the slot in mm — fits the tab ring
   *  (~10mm) so the piece can be lowered onto it from above. */
  slotGap: number;
  /** Horizontal position of the slot centre as a fraction of the piece width
   *  (0 = left, 1 = right). Default 0.5 = middle. */
  slotX: number;
  /** Material (mm) left on the front and back faces of the slot, making it a
   *  closed pocket — "tampado dos dois lados" — instead of a see-through
   *  notch. The pull-tab enters through the narrow slit on the top edge. */
  slotWall: number;
  /** Height of the coloured relief layers on the front face (mm). */
  reliefDepth: number;
  /** Fill the silhouette's internal holes with the base colour, producing a
   *  solid slab instead of a perforated ("vazada") base. */
  fillBackground: boolean;
  /** Mirror the coloured reliefs onto the back face so the drawing shows on
   *  both sides of the piece. */
  repeatBack: boolean;
  /** Hex colour of the base slab. */
  baseColor: string;
  /** Add a vertical keyring hole near the top of the handle. */
  keyring: boolean;
  /** Keyring hole diameter in mm. */
  keyringDiameter: number;
}

/** Minimum material (mm) that must remain between the slot and the opposite edge. */
const MIN_WALL = 2;
/** How far the slot tool pokes past the top edge so the notch is open. */
const EDGE_MARGIN = 2;

/**
 * Build the tab lifter as one base piece plus one relief piece per coloured
 * region. Pieces are returned in-place (already assembled), ready for
 * `exportThreeMF` / a multi-material preview.
 */
export async function buildTabLifterParts(cfg: TabLifterConfig): Promise<ExportPiece[]> {
  const outer = cfg.outer;
  const regions = cfg.regions;

  const box = new THREE.Box2();
  outer.getPoints().forEach((p) => box.expandByPoint(p));
  const size = new THREE.Vector2();
  box.getSize(size);
  const width = size.x;
  const height = size.y;
  const cx = (box.min.x + box.max.x) / 2;
  const minY = box.min.y;

  // Reliefs sit on a flat front face; a bevel would leave them overhanging.
  const useBevel = regions.length === 0 ? cfg.bevel : 0;

  // "Fechar o fundo": the base becomes a solid slab (silhouette without its
  // internal holes) so no see-through areas remain. The base colour fills the
  // closed background.
  const baseOuter = cfg.fillBackground ? closeShapeHoles(outer) : outer;

  let body = buildHandleGeometry({
    outer: baseOuter,
    details: [],
    handleThickness: cfg.handleThickness,
    bevel: useBevel,
    engraving: "none",
    engravingDepth: 0,
    tip: "none",
    tipLength: 12,
    hookWidth: 4,
    hookDepth: 4,
    wheelRadius: 4,
    wheelTube: 0.6,
    armWidth: 3,
    armDepth: 2,
    keyring: cfg.keyring,
    keyringDiameter: cfg.keyringDiameter,
    // The top edge is where the rasgo sits; keep the keyring hole on the
    // opposite (bottom) edge so they never overlap.
    keyringBottom: true,
  });

  const slot = buildSlotTool(cfg, outer, cx, minY, width, height);
  if (slot) {
    const res = await csgSubtract(body, slot);
    body.dispose();
    slot.dispose();
    body = res.geometry;
  }

  const pieces: ExportPiece[] = [];
  pieces.push({ geometry: body, regionId: 1, color: cfg.baseColor, name: "base" });

  let id = 2;
  for (const region of regions) {
    if (region.shapes.length === 0) continue;
    const reliefs = region.shapes.map((shape) =>
      buildReliefGeometry(shape, cx, minY, cfg.handleThickness, cfg.reliefDepth)
    );
    // "Repetir o desenho do outro lado": mirror the relief onto the back
    // face (z = -thickness/2) so the drawing shows on both sides.
    if (cfg.repeatBack) {
      for (const shape of region.shapes) {
        reliefs.push(buildBackReliefGeometry(shape, cx, minY, cfg.handleThickness, cfg.reliefDepth));
      }
    }
    const merged = mergeCompatible(reliefs);
    if (!merged) continue;
    pieces.push({ geometry: merged, regionId: id, color: region.color, name: `cor_${id}` });
    id++;
  }

  return pieces;
}

/**
 * Merge every piece (base + reliefs) into a single geometry — used for the
 * single-colour STL export and for previews that do not need per-colour meshes.
 */
export async function buildTabLifterSingleColor(cfg: TabLifterConfig): Promise<THREE.BufferGeometry> {
  const pieces = await buildTabLifterParts(cfg);
  const geoms = pieces.map((p) => p.geometry);
  const merged = mergeCompatible(geoms);
  return merged ?? geoms[0];
}

/**
 * Casts a vertical ray through the traced contour at a given X (in the
 * shape's original, uncentred coordinate frame) and returns the lowest and
 * highest Y where the boundary crosses that line — i.e. the real material
 * span at that exact column. Works the same whether the edge there is a flat
 * wall, an angled taper, or a pointed apex.
 */
function verticalEdgeSpan(outer: THREE.Shape, x: number): { bottom: number | null; top: number | null } {
  const pts = outer.getPoints(256);
  let minY: number | null = null;
  let maxY: number | null = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.x === b.x) continue; // vertical segment — ignore
    if ((a.x - x) * (b.x - x) > 0) continue; // segment doesn't cross x
    const t = (x - a.x) / (b.x - a.x);
    const y = a.y + t * (b.y - a.y);
    if (minY === null || y < minY) minY = y;
    if (maxY === null || y > maxY) maxY = y;
  }
  return { bottom: minY, top: maxY };
}

/** Open notch carved from the piece's top edge at the chosen column, with an
 *  opening and depth that stay within the material that actually exists at
 *  that exact column — not the piece's overall bounding box — so it never
 *  eats through a narrow waist and splits the piece in two. */
function buildSlotTool(
  cfg: TabLifterConfig,
  outer: THREE.Shape,
  cx: number,
  minY: number,
  width: number,
  height: number
): THREE.BufferGeometry | null {
  const depth = cfg.slotDepth;
  const gap = cfg.slotGap;
  if (!(depth > 0) || !(gap > 0)) return null;
  if (height <= MIN_WALL * 2) return null;

  // Desired opening, capped to a sane fraction of the piece width — this is
  // independent of contour sampling, so it can't blow up on flat edges.
  let safeGap = Math.min(gap, width * 0.8);
  if (safeGap <= 0.5) return null;

  const xCenterLocal = (Math.min(Math.max(cfg.slotX, 0.05), 0.95) - 0.5) * width; // centred frame
  const xOrig = xCenterLocal + cx; // back to outer's original coordinate frame

  // Find the real material span at the slot's X — this puts the notch on the
  // piece's actual top edge and limits its depth to what is really there.
  let span = verticalEdgeSpan(outer, xOrig);
  if (span.bottom === null || span.top === null) {
    for (const dx of [1, 2, 4, 8, 16]) {
      const alt = verticalEdgeSpan(outer, xOrig + dx);
      if (alt.bottom !== null && alt.top !== null) {
        span = alt;
        break;
      }
      const alt2 = verticalEdgeSpan(outer, xOrig - dx);
      if (alt2.bottom !== null && alt2.top !== null) {
        span = alt2;
        break;
      }
    }
  }
  const topYOrig = span.top ?? minY + height;
  const bottomYOrig = span.bottom ?? minY;

  // Shrink the gap if either side of the opening would poke past the
  // silhouette (e.g. near a narrowing column), instead of cutting into thin
  // air on one side.
  for (let i = 0; i < 6; i++) {
    const left = verticalEdgeSpan(outer, xOrig - safeGap / 2);
    const right = verticalEdgeSpan(outer, xOrig + safeGap / 2);
    if (
      left.bottom !== null && left.top !== null &&
      right.bottom !== null && right.top !== null
    ) break;
    safeGap *= 0.7;
    if (safeGap <= 0.5) return null;
  }

  const topYLocal = topYOrig - minY; // top edge Y in the final centred frame (0..height)
  const bottomYLocal = bottomYOrig - minY;
  const localSpan = Math.max(0, topYLocal - bottomYLocal); // real material height at this column

  // Depth is capped by the LOCAL material span at this column (not the
  // piece's global height) — prevents the cut from eating through a narrow
  // waist and splitting the piece into two.
  const maxDepth = Math.max(0.5, localSpan - MIN_WALL);
  const safeDepth = Math.min(depth, maxDepth);
  if (safeDepth <= 0.5) return null;

  const toolHeight = safeDepth + EDGE_MARGIN;
  // Closed pocket: the slot is recessed from BOTH faces, so the piece stays
  // solid on the front and back ("tampado dos dois lados"). Only the top edge
  // stays open — a narrow slit ("fresta") the pull-tab slides into.
  const wall = Math.max(0.4, Math.min(cfg.slotWall, cfg.handleThickness / 2 - 0.4));
  const pocketZ = Math.max(0.8, cfg.handleThickness - 2 * wall);

  const g = new THREE.BoxGeometry(safeGap, toolHeight, pocketZ);
  g.translate(xCenterLocal, topYLocal - safeDepth + toolHeight / 2, 0);
  return g;
}

/** Extrude one traced region shape as a relief sitting on the front face. */
function buildReliefGeometry(
  shape: THREE.Shape,
  cx: number,
  minY: number,
  thickness: number,
  reliefDepth: number
): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: reliefDepth,
    bevelEnabled: false,
    curveSegments: 12,
  });
  // Same centring as buildHandleGeometry: X centred on the outer silhouette,
  // base at y=0, relief against the front face (z = +thickness/2).
  g.translate(-cx, -minY, thickness / 2);
  return g;
}

/** Rebuild a Shape from the same contour but without its holes — used to
 *  close the "fundo" (background) so the base becomes a solid slab. */
function closeShapeHoles(shape: THREE.Shape): THREE.Shape {
  const pts = shape.getPoints();
  const s = new THREE.Shape();
  s.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
  s.closePath();
  return s;
}

/** Horizontal mirror of a Shape around the vertical line x = cx. When the
 *  mirrored shape is later centred with the usual `-cx` translate, the result
 *  is the drawing flipped left-right around the piece's centre — so viewed
 *  from the back face it reads exactly like the front. */
function mirrorShapeX(shape: THREE.Shape, cx: number): THREE.Shape {
  const s = new THREE.Shape();
  const pts = shape.getPoints();
  s.moveTo(2 * cx - pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) s.lineTo(2 * cx - pts[i].x, pts[i].y);
  s.closePath();
  for (const hole of shape.holes) {
    const hpts = hole.getPoints();
    const h = new THREE.Path();
    h.moveTo(2 * cx - hpts[0].x, hpts[0].y);
    for (let i = 1; i < hpts.length; i++) h.lineTo(2 * cx - hpts[i].x, hpts[i].y);
    h.closePath();
    s.holes.push(h);
  }
  return s;
}

/** Extrude one traced region shape as a mirrored relief on the back face
 *  (z = -thickness/2), so the drawing repeats on the other side. */
function buildBackReliefGeometry(
  shape: THREE.Shape,
  cx: number,
  minY: number,
  thickness: number,
  reliefDepth: number
): THREE.BufferGeometry {
  const mirrored = mirrorShapeX(shape, cx);
  const g = new THREE.ExtrudeGeometry(mirrored, {
    depth: reliefDepth,
    bevelEnabled: false,
    curveSegments: 12,
  });
  // The extruded prism sits in [0, reliefDepth]; place it against the back
  // face so it sticks out on the far side: z in [-thickness/2 - depth, -thickness/2].
  g.translate(-cx, -minY, -thickness / 2 - reliefDepth);
  return g;
}
