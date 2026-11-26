import * as THREE from 'three';
import { Evaluator, Brush, SUBTRACTION, ADDITION } from 'three-bvh-csg';

export type MoldType = 'single_open' | 'two_part' | 'silicone_box';
export type MoldShape = 'box' | 'cylinder' | 'rounded';

export interface MoldConfig {
  type: MoldType;
  shape: MoldShape;
  wallThickness: number; // mm (margin around object)
  floorThickness: number; // mm (bottom thickness)
  splitPlaneRatio: number; // 0 to 1 (usually 0.5 for mid-height split)
  pourSpout: boolean; // Add pour funnel in upper half
  pourSpoutDiameter: number; // mm
  airVents: boolean; // Add air release channels
  airVentDiameter: number; // mm
  alignmentPins: boolean; // Add male/female registration pins
  pinSize: number; // mm
  draftAngle: number; // degrees
  scale: number; // scale factor
  explodeDistance: number; // mm (for visual inspection)
}

export interface GeneratedMoldResult {
  moldMesh: THREE.Mesh | null; // Single cavity mold
  partAMesh: THREE.Mesh | null; // Lower half (two-part)
  partBMesh: THREE.Mesh | null; // Upper half (two-part)
  originalObjectMesh: THREE.Mesh; // The imported reference object
  bounds: { width: number; height: number; depth: number };
  trianglesCount: number;
}

/**
 * Creates built-in procedural sample 3D models for immediate testing
 */
export function createSample3DModel(sampleType: 'heart' | 'bear' | 'gem' | 'skull' | 'star'): THREE.BufferGeometry {
  switch (sampleType) {
    case 'heart': {
      // 3D smooth puffed heart
      const shape = new THREE.Shape();
      const x = 0, y = 0;
      shape.moveTo(x + 25, y + 25);
      shape.bezierCurveTo(x + 25, y + 25, x + 20, y, x, y);
      shape.bezierCurveTo(x - 30, y, x - 30, y + 35, x - 30, y + 35);
      shape.bezierCurveTo(x - 30, y + 55, x - 10, y + 77, x + 25, y + 95);
      shape.bezierCurveTo(x + 60, y + 77, x + 80, y + 55, x + 80, y + 35);
      shape.bezierCurveTo(x + 80, y + 35, x + 80, y, x + 50, y);
      shape.bezierCurveTo(x + 35, y, x + 25, y + 25, x + 25, y + 25);

      const extrudeSettings = {
        depth: 18,
        bevelEnabled: true,
        bevelSegments: 8,
        steps: 2,
        bevelSize: 8,
        bevelThickness: 8,
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.center();
      geo.scale(0.55, 0.55, 0.55);
      geo.computeVertexNormals();
      return geo;
    }

    case 'gem': {
      // Faceted brilliant gemstone
      const geo = new THREE.OctahedronGeometry(22, 1);
      geo.scale(1, 0.8, 1);
      geo.center();
      geo.computeVertexNormals();
      return geo;
    }

    case 'bear': {
      // Cute teddy bear / mascot head with ears and snout
      const head = new THREE.SphereGeometry(18, 24, 24);
      head.scale(1.1, 0.95, 1);

      const earL = new THREE.SphereGeometry(7, 16, 16);
      earL.translate(-16, 15, -1);

      const earR = new THREE.SphereGeometry(7, 16, 16);
      earR.translate(16, 15, -1);

      const snout = new THREE.SphereGeometry(8, 16, 16);
      snout.scale(1, 0.8, 1.2);
      snout.translate(0, -4, 12);

      // Merge parts with CSG
      const evaluator = new Evaluator();
      evaluator.attributes = ['position', 'normal'];

      const headB = new Brush(head);
      const earLB = new Brush(earL);
      const earRB = new Brush(earR);
      const snoutB = new Brush(snout);

      let merged = evaluator.evaluate(headB, earLB, ADDITION);
      merged = evaluator.evaluate(merged, earRB, ADDITION);
      merged = evaluator.evaluate(merged, snoutB, ADDITION);

      const finalGeo = merged.geometry.clone();
      finalGeo.center();
      finalGeo.computeVertexNormals();
      return finalGeo;
    }

    case 'star': {
      // 5-pointed 3D Star
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

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 14,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 4,
        bevelThickness: 4,
      });
      geo.center();
      geo.computeVertexNormals();
      return geo;
    }

    case 'skull':
    default: {
      // Stylized skull / mask
      const cranium = new THREE.SphereGeometry(18, 24, 24);
      cranium.scale(1, 1.1, 1);

      const jaw = new THREE.BoxGeometry(16, 14, 16);
      jaw.translate(0, -14, 4);

      const evaluator = new Evaluator();
      evaluator.attributes = ['position', 'normal'];

      const craniumB = new Brush(cranium);
      const jawB = new Brush(jaw);

      const merged = evaluator.evaluate(craniumB, jawB, ADDITION);
      const geo = merged.geometry.clone();
      geo.center();
      geo.computeVertexNormals();
      return geo;
    }
  }
}

/**
 * Normalizes, centers and scales an arbitrary 3D geometry to fit nicely in mm workspace
 */
export function prepareTargetGeometry(geo: THREE.BufferGeometry, targetMaxDim: number = 60): THREE.BufferGeometry {
  const cloned = geo.clone();
  cloned.computeVertexNormals();
  cloned.computeBoundingBox();

  if (!cloned.boundingBox) {
    return cloned;
  }

  const box = cloned.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim > 0) {
    const s = targetMaxDim / maxDim;
    cloned.scale(s, s, s);
  }

  cloned.computeBoundingBox();
  cloned.center();

  // Rest bottom on Z = 0
  if (cloned.boundingBox) {
    const minZ = cloned.boundingBox.min.z;
    cloned.translate(0, 0, -minZ);
  }

  return cloned;
}

/**
 * Core function that computes the 3D Mold using Boolean CSG
 */
export async function generateMoldFromObject(
  targetGeometry: THREE.BufferGeometry,
  config: MoldConfig,
  moldMaterial: THREE.Material,
  partAMaterial: THREE.Material,
  partBMaterial: THREE.Material,
  refMaterial: THREE.Material
): Promise<GeneratedMoldResult> {
  // Ensure bounding box
  targetGeometry.computeBoundingBox();
  const objBox = targetGeometry.boundingBox || new THREE.Box3(
    new THREE.Vector3(-25, -25, 0),
    new THREE.Vector3(25, 25, 30)
  );

  const objSize = new THREE.Vector3();
  objBox.getSize(objSize);
  const objCenter = new THREE.Vector3();
  objBox.getCenter(objCenter);

  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];

  // Base dimensions of the mold block
  const blockW = objSize.x + config.wallThickness * 2;
  const blockH = objSize.y + config.wallThickness * 2;
  const blockD = objSize.z + config.floorThickness + 2; // +2 for clearance

  // Reference mesh of the original object
  const originalMesh = new THREE.Mesh(targetGeometry.clone(), refMaterial);
  originalMesh.castShadow = true;
  originalMesh.receiveShadow = true;

  if (config.type === 'single_open' || config.type === 'silicone_box') {
    // -------------------------------------------------------------
    // 1. SINGLE OPEN-CAVITY MOLD (Fôrma de Cavidade Aberta)
    // -------------------------------------------------------------
    let blockGeo: THREE.BufferGeometry;

    if (config.shape === 'cylinder') {
      const radius = Math.max(blockW, blockH) / 2;
      blockGeo = new THREE.CylinderGeometry(radius, radius, blockD, 48);
      blockGeo.rotateX(Math.PI / 2);
    } else if (config.shape === 'rounded') {
      // Rounded box using 2D shape extrusion
      const r = Math.min(10, config.wallThickness);
      const halfW = blockW / 2;
      const halfH = blockH / 2;

      const shape = new THREE.Shape();
      shape.moveTo(-halfW + r, -halfH);
      shape.lineTo(halfW - r, -halfH);
      shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
      shape.lineTo(halfW, halfH - r);
      shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
      shape.lineTo(-halfW + r, halfH);
      shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
      shape.lineTo(-halfW, -halfH + r);
      shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

      blockGeo = new THREE.ExtrudeGeometry(shape, {
        depth: blockD,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 1,
        bevelThickness: 1,
      });
      blockGeo.center();
    } else {
      // Standard rectangular block
      blockGeo = new THREE.BoxGeometry(blockW, blockH, blockD);
    }

    // Position block so its top face aligns with the top of the object
    // Object extends from z = 0 to z = objSize.z
    // Block center should be at z = (objSize.z + 2) - blockD / 2
    const blockCenterZ = objSize.z + 1 - blockD / 2;
    blockGeo.translate(0, 0, blockCenterZ);

    const blockBrush = new Brush(blockGeo);
    blockBrush.updateMatrixWorld();

    const objectBrush = new Brush(targetGeometry);
    objectBrush.updateMatrixWorld();

    // Subtract object from block
    const resultBrush = evaluator.evaluate(blockBrush, objectBrush, SUBTRACTION);
    resultBrush.geometry.computeVertexNormals();

    const moldMesh = new THREE.Mesh(resultBrush.geometry, moldMaterial);
    moldMesh.castShadow = true;
    moldMesh.receiveShadow = true;
    moldMesh.name = 'mold_single';

    const triCount = resultBrush.geometry.index
      ? resultBrush.geometry.index.count / 3
      : (resultBrush.geometry.attributes.position?.count || 0) / 3;

    return {
      moldMesh,
      partAMesh: null,
      partBMesh: null,
      originalObjectMesh: originalMesh,
      bounds: { width: Math.round(blockW), height: Math.round(blockH), depth: Math.round(blockD) },
      trianglesCount: Math.round(triCount),
    };
  } else {
    // -------------------------------------------------------------
    // 2. TWO-PART SPLIT MOLD (Molde Bipartido: Base + Tampa com Pinos)
    // -------------------------------------------------------------
    const splitZ = objSize.z * config.splitPlaneRatio;
    const lowerD = splitZ + config.floorThickness;
    const upperD = (objSize.z - splitZ) + config.floorThickness;

    // --- PART A (LOWER HALF / BASE) ---
    const lowerBlockGeo = new THREE.BoxGeometry(blockW, blockH, lowerD);
    // Lower block extends from z = -config.floorThickness to z = splitZ
    lowerBlockGeo.translate(0, 0, splitZ - lowerD / 2);

    let lowerBrush = new Brush(lowerBlockGeo);
    lowerBrush.updateMatrixWorld();

    const objectBrush = new Brush(targetGeometry);
    objectBrush.updateMatrixWorld();

    // Subtract object from lower block
    lowerBrush = evaluator.evaluate(lowerBrush, objectBrush, SUBTRACTION);

    // --- PART B (UPPER HALF / TOP) ---
    const upperBlockGeo = new THREE.BoxGeometry(blockW, blockH, upperD);
    // Upper block extends from z = splitZ to z = objSize.z + config.floorThickness
    upperBlockGeo.translate(0, 0, splitZ + upperD / 2);

    let upperBrush = new Brush(upperBlockGeo);
    upperBrush.updateMatrixWorld();

    // Subtract object from upper block
    upperBrush = evaluator.evaluate(upperBrush, objectBrush, SUBTRACTION);

    // --- ALIGNMENT PINS & SOCKETS (Pinos Macho / Fêmea Cônicos) ---
    if (config.alignmentPins) {
      const pinR = config.pinSize / 2;
      const pinH = Math.min(8, lowerD * 0.4);
      const pinOffsetX = blockW / 2 - config.wallThickness / 2;
      const pinOffsetY = blockH / 2 - config.wallThickness / 2;

      const pinCoords = [
        [-pinOffsetX, -pinOffsetY],
        [pinOffsetX, -pinOffsetY],
        [pinOffsetX, pinOffsetY],
        [-pinOffsetX, pinOffsetY],
      ];

      for (const [px, py] of pinCoords) {
        // Tapered cone pin
        const pinGeo = new THREE.CylinderGeometry(pinR * 0.7, pinR, pinH, 16);
        pinGeo.rotateX(Math.PI / 2);

        // Add pin to Upper Part B (male)
        const malePinGeo = pinGeo.clone();
        malePinGeo.translate(px, py, splitZ - pinH / 2);
        const maleBrush = new Brush(malePinGeo);
        maleBrush.updateMatrixWorld();
        upperBrush = evaluator.evaluate(upperBrush, maleBrush, ADDITION);

        // Subtract hole from Lower Part A with 0.3mm tolerance (female)
        const femalePinGeo = new THREE.CylinderGeometry(
          (pinR * 0.7) + 0.3,
          pinR + 0.3,
          pinH + 0.6,
          16
        );
        femalePinGeo.rotateX(Math.PI / 2);
        femalePinGeo.translate(px, py, splitZ - (pinH + 0.6) / 2);
        const femaleBrush = new Brush(femalePinGeo);
        femaleBrush.updateMatrixWorld();
        lowerBrush = evaluator.evaluate(lowerBrush, femaleBrush, SUBTRACTION);
      }
    }

    // --- POUR SPOUT / FUNNEL (Canal de Despejo) ---
    if (config.pourSpout) {
      const spoutTopR = config.pourSpoutDiameter / 2 + 3;
      const spoutBottomR = config.pourSpoutDiameter / 2;
      const spoutH = upperD + 4;

      const spoutGeo = new THREE.CylinderGeometry(spoutTopR, spoutBottomR, spoutH, 20);
      spoutGeo.rotateX(Math.PI / 2);
      // Position at top center leading into cavity
      spoutGeo.translate(0, 0, splitZ + upperD / 2);

      const spoutBrush = new Brush(spoutGeo);
      spoutBrush.updateMatrixWorld();
      upperBrush = evaluator.evaluate(upperBrush, spoutBrush, SUBTRACTION);
    }

    // --- AIR VENTS (Canais de Saída de Ar) ---
    if (config.airVents) {
      const ventR = config.airVentDiameter / 2;
      const ventH = upperD + 4;
      const ventOffset = Math.min(objSize.x * 0.3, blockW * 0.25);

      const ventGeo1 = new THREE.CylinderGeometry(ventR, ventR, ventH, 12);
      ventGeo1.rotateX(Math.PI / 2);
      ventGeo1.translate(ventOffset, 0, splitZ + upperD / 2);

      const ventGeo2 = new THREE.CylinderGeometry(ventR, ventR, ventH, 12);
      ventGeo2.rotateX(Math.PI / 2);
      ventGeo2.translate(-ventOffset, 0, splitZ + upperD / 2);

      const ventB1 = new Brush(ventGeo1);
      const ventB2 = new Brush(ventGeo2);
      upperBrush = evaluator.evaluate(upperBrush, ventB1, SUBTRACTION);
      upperBrush = evaluator.evaluate(upperBrush, ventB2, SUBTRACTION);
    }

    lowerBrush.geometry.computeVertexNormals();
    upperBrush.geometry.computeVertexNormals();

    const partAMesh = new THREE.Mesh(lowerBrush.geometry, partAMaterial);
    partAMesh.castShadow = true;
    partAMesh.receiveShadow = true;
    partAMesh.name = 'mold_part_a';

    const partBMesh = new THREE.Mesh(upperBrush.geometry, partBMaterial);
    partBMesh.castShadow = true;
    partBMesh.receiveShadow = true;
    partBMesh.name = 'mold_part_b';

    // Apply explode distance if specified
    if (config.explodeDistance > 0) {
      partAMesh.position.z = -config.explodeDistance;
      partBMesh.position.z = config.explodeDistance;
    }

    const countA = lowerBrush.geometry.index
      ? lowerBrush.geometry.index.count / 3
      : (lowerBrush.geometry.attributes.position?.count || 0) / 3;

    const countB = upperBrush.geometry.index
      ? upperBrush.geometry.index.count / 3
      : (upperBrush.geometry.attributes.position?.count || 0) / 3;

    return {
      moldMesh: null,
      partAMesh,
      partBMesh,
      originalObjectMesh: originalMesh,
      bounds: { width: Math.round(blockW), height: Math.round(blockH), depth: Math.round(lowerD + upperD) },
      trianglesCount: Math.round(countA + countB),
    };
  }
}
