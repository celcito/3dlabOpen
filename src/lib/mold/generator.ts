import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { MoldBounds, MoldBuildResult, MoldConfig, MoldSampleId } from '../../types/mold';

/**
 * Geometria do molde é construída em Z-up (mesmo espaço dos geradores do
 * Workbench) e centralizada em XY; a viewport gira para Y-up.
 */

function makeEvaluator(): Evaluator {
  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];
  return evaluator;
}

function evaluate(
  evaluator: Evaluator,
  a: THREE.BufferGeometry,
  b: THREE.BufferGeometry,
  operation: number
): THREE.BufferGeometry {
  const brushA = new Brush(a);
  brushA.updateMatrixWorld();
  const brushB = new Brush(b);
  brushB.updateMatrixWorld();
  const result = evaluator.evaluate(brushA, brushB, operation);
  const geometry = result.geometry.clone();
  geometry.computeVertexNormals();
  return geometry;
}

/** Amostras procedurais para testar o molde sem precisar de upload. */
export function createSampleModel(sample: MoldSampleId): THREE.BufferGeometry {
  switch (sample) {
    case 'coracao': {
      const shape = new THREE.Shape();
      shape.moveTo(0, 25);
      shape.bezierCurveTo(0, 25, -5, 0, -25, 0);
      shape.bezierCurveTo(-55, 0, -55, 35, -55, 35);
      shape.bezierCurveTo(-55, 55, -35, 77, 0, 95);
      shape.bezierCurveTo(35, 77, 55, 55, 55, 35);
      shape.bezierCurveTo(55, 35, 55, 0, 25, 0);
      shape.bezierCurveTo(10, 0, 0, 25, 0, 25);

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 18,
        bevelEnabled: true,
        bevelSegments: 8,
        steps: 2,
        bevelSize: 8,
        bevelThickness: 8,
        curveSegments: 24,
      });
      geometry.center();
      geometry.computeVertexNormals();
      return geometry;
    }

    case 'gema': {
      const geometry = new THREE.OctahedronGeometry(22, 1);
      geometry.scale(1, 1, 0.8);
      geometry.center();
      geometry.computeVertexNormals();
      return geometry;
    }

    case 'estrela': {
      const shape = new THREE.Shape();
      const points = 5;
      const outerR = 26;
      const innerR = 12;

      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      shape.closePath();

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 14,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 4,
        bevelThickness: 4,
      });
      geometry.center();
      geometry.computeVertexNormals();
      return geometry;
    }

    case 'caveira': {
      const evaluator = makeEvaluator();
      const cranium = new THREE.SphereGeometry(18, 32, 32);
      cranium.scale(1, 1.1, 1);
      const jaw = new THREE.BoxGeometry(16, 14, 16);
      jaw.translate(0, -14, 4);
      const merged = evaluate(evaluator, cranium, jaw, ADDITION);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }

    case 'urso':
    default: {
      const evaluator = makeEvaluator();
      const head = new THREE.SphereGeometry(18, 32, 32);
      head.scale(1.1, 0.95, 1);

      const earL = new THREE.SphereGeometry(7, 20, 20);
      earL.translate(-16, 15, -1);
      const earR = new THREE.SphereGeometry(7, 20, 20);
      earR.translate(16, 15, -1);
      const snout = new THREE.SphereGeometry(8, 20, 20);
      snout.scale(1, 0.8, 1.2);
      snout.translate(0, -4, 12);

      let merged = evaluate(evaluator, head, earL, ADDITION);
      merged = evaluate(evaluator, merged, earR, ADDITION);
      merged = evaluate(evaluator, merged, snout, ADDITION);
      merged.center();
      merged.computeVertexNormals();
      return merged;
    }
  }
}

/** Normaliza escala, centraliza em XY e apoia a peça em Z = 0. */
export function prepareTargetGeometry(
  geometry: THREE.BufferGeometry,
  targetMaxDim: number
): THREE.BufferGeometry {
  const cloned = geometry.clone();
  cloned.computeVertexNormals();
  cloned.computeBoundingBox();

  if (!cloned.boundingBox) return cloned;

  const size = new THREE.Vector3();
  cloned.boundingBox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const scale = targetMaxDim / maxDim;
    cloned.scale(scale, scale, scale);
  }

  cloned.computeBoundingBox();
  cloned.center();

  if (cloned.boundingBox) {
    const center = new THREE.Vector3();
    cloned.boundingBox.getCenter(center);
    cloned.translate(-center.x, -center.y, -cloned.boundingBox.min.z);
  }

  cloned.computeVertexNormals();
  return cloned;
}

export function geometryStats(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox?.getSize(size);
  const position = geometry.getAttribute('position');
  const triangles = geometry.index ? geometry.index.count / 3 : (position?.count ?? 0) / 3;

  return {
    width: Math.round(size.x * 10) / 10,
    height: Math.round(size.y * 10) / 10,
    depth: Math.round(size.z * 10) / 10,
    triangles: Math.round(triangles),
  };
}

/** Taper nas paredes externas: afina conforme se afasta do plano de apoio. */
function applyDraft(
  geometry: THREE.BufferGeometry,
  angleDeg: number,
  growTowards: 'top' | 'bottom'
): THREE.BufferGeometry {
  if (angleDeg <= 0) return geometry;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;

  const height = box.max.z - box.min.z;
  if (height <= 0) return geometry;

  const tan = Math.tan((angleDeg * Math.PI) / 180);
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const position = geometry.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    const ratio =
      growTowards === 'top' ? (z - box.min.z) / height : (box.max.z - z) / height;
    const scale = 1 + tan * ratio;
    position.setX(i, cx + (position.getX(i) - cx) * scale);
    position.setY(i, cy + (position.getY(i) - cy) * scale);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function buildBlockGeometry(
  shape: MoldConfig['shape'],
  width: number,
  height: number,
  depth: number,
  wallThickness: number
): THREE.BufferGeometry {
  if (shape === 'cylinder') {
    const radius = Math.max(width, height) / 2;
    const geometry = new THREE.CylinderGeometry(radius, radius, depth, 64);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }

  if (shape === 'rounded') {
    const r = Math.min(10, Math.max(2, wallThickness));
    const halfW = width / 2;
    const halfH = height / 2;

    const rounded = new THREE.Shape();
    rounded.moveTo(-halfW + r, -halfH);
    rounded.lineTo(halfW - r, -halfH);
    rounded.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    rounded.lineTo(halfW, halfH - r);
    rounded.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    rounded.lineTo(-halfW + r, halfH);
    rounded.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    rounded.lineTo(-halfW, -halfH + r);
    rounded.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

    const geometry = new THREE.ExtrudeGeometry(rounded, {
      depth,
      bevelEnabled: false,
      curveSegments: 12,
    });
    geometry.center();
    return geometry;
  }

  return new THREE.BoxGeometry(width, height, depth);
}

function geometryTriangleCount(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  return geometry.index ? geometry.index.count / 3 : (position?.count ?? 0) / 3;
}

/**
 * Calcula o molde (CSG) a partir da geometria alvo já preparada.
 */
export function generateMold(
  targetGeometry: THREE.BufferGeometry,
  config: MoldConfig
): MoldBuildResult {
  const evaluator = makeEvaluator();

  targetGeometry.computeBoundingBox();
  const objBox =
    targetGeometry.boundingBox ??
    new THREE.Box3(new THREE.Vector3(-25, -25, 0), new THREE.Vector3(25, 25, 30));

  const objSize = new THREE.Vector3();
  objBox.getSize(objSize);

  const blockW = objSize.x + config.wallThickness * 2;
  const blockH = objSize.y + config.wallThickness * 2;
  const rim = config.type === 'silicone_box' ? config.wallThickness : 0;
  const blockD = objSize.z + config.floorThickness + 2 + rim;

  const originalGeometry = targetGeometry.clone();

  const parts: MoldBuildResult['parts'] = [];

  if (config.type === 'single_open' || config.type === 'silicone_box') {
    const block = buildBlockGeometry(config.shape, blockW, blockH, blockD, config.wallThickness);
        // O topo do bloco deve ficar no Z máximo do objeto + margem, de forma que a
// subtração rompa o tampo do bloco e a cavidade sia aberta por cima. O bloco tem
// altura blockD em Y; seu topo está a blockD/2 acima do centro, então para ter o
// topo em (objSize.z + 1 + rim) o centro deve ser:
//   (objSize.z + 1 + rim) - blockD/2.
    const blockCenterZ = objSize.z + 1 + rim - blockD / 2;
    block.translate(0, 0, blockCenterZ);
    applyDraft(block, config.draftAngle, "top");
    // P2: ao posicionar o bloco acima do Z do objeto e subtrair, a cavidade rompe o
    // tampo do bloco — o molde de cavidade fica aberto e nunca selado com um teto
    // sólido sobre o modelo.



    const mold = evaluate(evaluator, block, targetGeometry, SUBTRACTION);

    parts.push({ id: 'single', geoms: [mold] });
  } else {
    const splitZ = objSize.z * config.splitPlaneRatio;
    const lowerD = splitZ + config.floorThickness;
    const upperD = objSize.z - splitZ + config.floorThickness;

    const lowerBlock = new THREE.BoxGeometry(blockW, blockH, lowerD);
    lowerBlock.translate(0, 0, splitZ - lowerD / 2);
    applyDraft(lowerBlock, config.draftAngle, 'top');

    const upperBlock = new THREE.BoxGeometry(blockW, blockH, upperD);
    upperBlock.translate(0, 0, splitZ + upperD / 2);
    applyDraft(upperBlock, config.draftAngle, 'bottom');

    let lower = evaluate(evaluator, lowerBlock, targetGeometry, SUBTRACTION);
    let upper = evaluate(evaluator, upperBlock, targetGeometry, SUBTRACTION);

    if (config.alignmentPins) {
      const pinR = config.pinSize / 2;
      const pinH = Math.min(8, Math.max(2, lowerD * 0.4));
      const tipR = Math.max(0.6, pinR * 0.7);
      const pinOffsetX = blockW / 2 - config.wallThickness * 0.75;
      const pinOffsetY = blockH / 2 - config.wallThickness * 0.75;

      const pinCoords: [number, number][] = [
        [-pinOffsetX, -pinOffsetY],
        [pinOffsetX, -pinOffsetY],
        [pinOffsetX, pinOffsetY],
        [-pinOffsetX, pinOffsetY],
      ];

      for (const [px, py] of pinCoords) {
        const pinGeo = new THREE.CylinderGeometry(tipR, pinR, pinH, 20);
        pinGeo.rotateX(Math.PI / 2);
        pinGeo.translate(px, py, splitZ - pinH / 2);
        upper = evaluate(evaluator, upper, pinGeo, ADDITION);

        const holeGeo = new THREE.CylinderGeometry(tipR + 0.3, pinR + 0.3, pinH + 0.6, 20);
        holeGeo.rotateX(Math.PI / 2);
        holeGeo.translate(px, py, splitZ - (pinH + 0.6) / 2);
        lower = evaluate(evaluator, lower, holeGeo, SUBTRACTION);
      }
    }

    if (config.pourSpout) {
      const spoutTopR = config.pourSpoutDiameter / 2 + 3;
      const spoutBottomR = config.pourSpoutDiameter / 2;
      const spoutH = upperD + 4;

      const spout = new THREE.CylinderGeometry(spoutTopR, spoutBottomR, spoutH, 24);
      spout.rotateX(Math.PI / 2);
      spout.translate(0, 0, splitZ + upperD / 2);
      upper = evaluate(evaluator, upper, spout, SUBTRACTION);
    }

    if (config.airVents) {
      const ventR = config.airVentDiameter / 2;
      const ventH = upperD + 4;
      const ventOffset = Math.min(objSize.x * 0.3, blockW * 0.25);

      for (const offset of [ventOffset, -ventOffset]) {
        const vent = new THREE.CylinderGeometry(ventR, ventR, ventH, 12);
        vent.rotateX(Math.PI / 2);
        vent.translate(offset, 0, splitZ + upperD / 2);
        upper = evaluate(evaluator, upper, vent, SUBTRACTION);
      }
    }

    parts.push({ id: 'partA', geoms: [lower] });
    parts.push({ id: 'partB', geoms: [upper] });
  }

  const bounds: MoldBounds = {
    width: Math.round(blockW),
    height: Math.round(blockH),
    depth: Math.round(
      config.type === 'two_part'
        ? objSize.z * config.splitPlaneRatio +
            config.floorThickness +
            (objSize.z - objSize.z * config.splitPlaneRatio) +
            config.floorThickness
        : blockD
    ),
  };

  const triangles = parts.reduce(
    (total, part) =>
      total + part.geoms.reduce((sum, geom) => sum + geometryTriangleCount(geom), 0),
    0
  );

  return {
    parts,
    originalGeometry,
    bounds,
    triangles: Math.round(triangles),
  };
}

/** Move a peça para o canto da mesa: centrada em XY e apoiada em Z = 0. */
export function normalizeForPrint(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = geometry.clone();
  cloned.computeBoundingBox();
  if (!cloned.boundingBox) return cloned;
  const center = new THREE.Vector3();
  cloned.boundingBox.getCenter(center);
  cloned.translate(-center.x, -center.y, -cloned.boundingBox.min.z);
  cloned.computeBoundingBox();
  return cloned;
}
