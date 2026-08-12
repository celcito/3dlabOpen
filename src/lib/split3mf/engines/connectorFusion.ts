import * as THREE from "three";
import { Evaluator, Brush, SUBTRACTION, ADDITION } from "three-bvh-csg";
import { buildConnectorPrimitive, placementMatrix, type ConnectorPlacement, type ConnectorType } from "./connectorEngine";

export interface FusionOptions {
  type: ConnectorType;
  depthMm: number;
  socketToleranceMm: number;
  /** Scale applied to the socket relative to the plug cross-section. */
  socketScale?: number;
}

const EVAL = new Evaluator();

function csg(a: THREE.BufferGeometry, b: THREE.BufferGeometry, op: number): THREE.BufferGeometry {
  const a2 = normalizeGeometry(a);
  const b2 = normalizeGeometry(b);
  const brushA = new Brush(a2);
  brushA.updateMatrixWorld();
  const brushB = new Brush(b2);
  brushB.updateMatrixWorld();
  const result = EVAL.evaluate(brushA, brushB, op);
  const geo = result.geometry.clone();
  a2 !== a && a2.dispose();
  b2 !== b && b2.dispose();
  return geo;
}

function normalizeGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.attributes.uv) return g;
  const copy = g.clone();
  copy.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(copy.attributes.position.count * 2), 2));
  copy.computeVertexNormals();
  return copy;
}

/**
 * Fuses a plug connector into a piece via CSG union. The connector prism is
 * translated so half its depth sits inside the piece and half protrudes.
 */
export function fusePlug(
  piece: THREE.BufferGeometry,
  placement: ConnectorPlacement,
  options: FusionOptions
): THREE.BufferGeometry {
  const prim = buildConnectorPrimitive(options.type, placement.area, placement.depth);
  if (!prim.attributes.position || prim.attributes.position.count === 0) return piece.clone();
  const m = placementMatrix(placement);
  // Translate so the prism straddles the boundary (centered on the point).
  m.setPosition(placement.point);
  prim.applyMatrix4(m);
  const merged = csg(piece, prim, ADDITION);
  prim.dispose();
  return merged;
}

/**
 * Carves a socket into a piece via CSG subtraction. The socket prism is
 * slightly larger than the plug (tolerance) so the fit is a snap-fit.
 */
export function carveSocket(
  piece: THREE.BufferGeometry,
  placement: ConnectorPlacement,
  options: FusionOptions
): THREE.BufferGeometry {
  const area = placement.area * (1 + options.socketToleranceMm / Math.sqrt(placement.area));
  const socketPlacement: ConnectorPlacement = {
    ...placement,
    area: Math.max(area, placement.area * 1.01),
    depth: placement.depth + options.socketToleranceMm,
  };
  const prim = buildConnectorPrimitive(options.type, socketPlacement.area, socketPlacement.depth);
  if (!prim.attributes.position || prim.attributes.position.count === 0) return piece.clone();
  const m = placementMatrix(socketPlacement);
  m.setPosition(placement.point);
  prim.applyMatrix4(m);
  const merged = csg(piece, prim, SUBTRACTION);
  prim.dispose();
  return merged;
}

/** Builds a connector piece that fills the gap (bridge) between parts. */
export function buildBridge(
  placement: ConnectorPlacement,
  options: FusionOptions
): THREE.BufferGeometry {
  const prim = buildConnectorPrimitive(options.type, placement.area, placement.depth);
  if (!prim.attributes.position || prim.attributes.position.count === 0) return prim;
  const m = placementMatrix(placement);
  m.setPosition(placement.point);
  prim.applyMatrix4(m);
  return prim;
}