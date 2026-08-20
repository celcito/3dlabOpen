import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export interface KeycapBaseConfig {
  bottomWidth: number;
  bottomDepth: number;
  topWidth: number;
  topDepth: number;
  height: number;
  wallThickness: number;
  stemArmWidth: number;
  stemArmLength: number;
  stemDepth: number;
}

export const CHERRY_MX_DEFAULTS: Pick<KeycapBaseConfig, "stemArmWidth" | "stemArmLength" | "stemDepth"> = {
  stemArmWidth: 1.35,
  stemArmLength: 4.15,
  stemDepth: 3.5,
};

function createFrustumGeometry(bottomW: number, bottomD: number, topW: number, topD: number, height: number) {
  const hw0 = bottomW / 2;
  const hd0 = bottomD / 2;
  const hw1 = topW / 2;
  const hd1 = topD / 2;
  const vertices = new Float32Array([
    -hw0, 0, -hd0, hw0, 0, -hd0, hw0, 0, hd0, -hw0, 0, hd0,
    -hw1, height, -hd1, hw1, height, -hd1, hw1, height, hd1, -hw1, height, hd1,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCrossPrismGeometry(armWidth: number, armLength: number, depth: number) {
  const shape = new THREE.Shape();
  const a = armWidth / 2;
  const l = armLength / 2;
  shape.moveTo(-a, -l);
  shape.lineTo(a, -l);
  shape.lineTo(a, -a);
  shape.lineTo(l, -a);
  shape.lineTo(l, a);
  shape.lineTo(a, a);
  shape.lineTo(a, l);
  shape.lineTo(-a, l);
  shape.lineTo(-a, a);
  shape.lineTo(-l, a);
  shape.lineTo(-l, -a);
  shape.lineTo(-a, -a);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function generateKeycapBaseGeometry(config: KeycapBaseConfig): THREE.BufferGeometry {
  const { bottomWidth, bottomDepth, topWidth, topDepth, height, wallThickness, stemArmWidth, stemArmLength, stemDepth } = config;
  const evaluator = new Evaluator();
  const outerBrush = new Brush(createFrustumGeometry(bottomWidth, bottomDepth, topWidth, topDepth, height));
  const inner = createFrustumGeometry(
    bottomWidth - wallThickness * 2,
    bottomDepth - wallThickness * 2,
    Math.max(topWidth - wallThickness * 2, 1),
    Math.max(topDepth - wallThickness * 2, 1),
    height - wallThickness,
  );
  inner.translate(0, wallThickness, 0);
  const innerBrush = new Brush(inner);
  outerBrush.updateMatrixWorld();
  innerBrush.updateMatrixWorld();
  let result = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);

  const stem = createCrossPrismGeometry(stemArmWidth, stemArmLength, stemDepth + 0.5);
  stem.translate(0, -0.5, 0);
  const resultBrush = new Brush(result.geometry);
  const stemBrush = new Brush(stem);
  resultBrush.updateMatrixWorld();
  stemBrush.updateMatrixWorld();
  result = evaluator.evaluate(resultBrush, stemBrush, SUBTRACTION);
  result.geometry.computeVertexNormals();
  return result.geometry;
}

export function getTopFootprint(config: KeycapBaseConfig) {
  const margin = config.wallThickness * 1.5;
  return {
    width: Math.max(config.topWidth - margin * 2, 1),
    depth: Math.max(config.topDepth - margin * 2, 1),
    surfaceY: config.height,
  };
}
