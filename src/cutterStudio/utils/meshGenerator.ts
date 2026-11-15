import * as THREE from 'three';
import { ModelLineart, ModelSettings, Path2D, Point2D } from '../types';
import {
  scaleAndCenterPath,
  offsetClosedPolygon,
  expandLineToRibbon,
  smoothPath,
  getBounds,
  isPointInPolygon,
} from './vectorMath';
import { vectorizeText } from './imageTracer';
import { generate3DTextShapes } from './text3DGenerator';

export interface GeneratedMeshes {
  cutterMesh: THREE.Mesh | null;
  stampMesh: THREE.Mesh | null;
  doughMesh: THREE.Mesh | null;
  dimensions: { width: number; height: number; depth: number };
  trianglesCount: number;
}

/**
 * Builds a watertight tubular ribbon wall between two parallel 2D polygon loops
 */
function buildWallBetweenLoops(
  loopBottom: Point2D[],
  loopTop: Point2D[],
  zBottom: number,
  zTop: number,
  reverseFacing: boolean = false
): { vertices: number[]; indices: number[] } {
  const n = Math.min(loopBottom.length, loopTop.length);
  const vertices: number[] = [];
  const indices: number[] = [];

  // Bottom vertices [0 .. n-1]
  for (let i = 0; i < n; i++) {
    vertices.push(loopBottom[i][0], loopBottom[i][1], zBottom);
  }
  // Top vertices [n .. 2n-1]
  for (let i = 0; i < n; i++) {
    vertices.push(loopTop[i][0], loopTop[i][1], zTop);
  }

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const b0 = i;
    const b1 = next;
    const t0 = i + n;
    const t1 = next + n;

    if (reverseFacing) {
      indices.push(b0, t0, b1);
      indices.push(b1, t0, t1);
    } else {
      indices.push(b0, b1, t0);
      indices.push(b1, t1, t0);
    }
  }

  return { vertices, indices };
}

/**
 * Creates the 3D Cutter Mesh (Outer silhouette blade + comfort lip flange)
 */
export function generateCutterMesh(
  model: ModelLineart,
  settings: ModelSettings,
  material: THREE.Material
): THREE.Mesh {
  // 1. Prepare smoothed, scaled outer path
  const sourceBounds = getBounds(model.outerPerimeter);
  const scaledOuter = scaleAndCenterPath(
    model.outerPerimeter,
    settings.targetWidth,
    settings.targetHeight,
    sourceBounds
  );
  const baseContour = smoothPath(scaledOuter, 2, true);

  const edgeThick = settings.bladeEdgeThickness;
  const baseThick = settings.bladeBaseThickness;
  const lipW = settings.lipWidth;
  const hBlade = settings.bladeHeight;
  const hLip = settings.lipThickness;

  // Blade loops
  // Bottom cutting tip: from outer contour to inner offset
  const tipOuter = baseContour;
  const tipInner = offsetClosedPolygon(baseContour, -edgeThick);

  // Upper blade level (at z = hBlade)
  const topBladeOuter = offsetClosedPolygon(baseContour, baseThick - edgeThick);
  const topBladeInner = offsetClosedPolygon(baseContour, -edgeThick);

  // Lip flange loops (at z = hBlade and z = hBlade + hLip)
  const lipOuter = offsetClosedPolygon(baseContour, baseThick - edgeThick + lipW);
  const lipInner = topBladeInner;

  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  function appendGeometry(verts: number[], inds: number[]) {
    positions.push(...verts);
    for (let i = 0; i < inds.length; i++) {
      indices.push(inds[i] + vertexOffset);
    }
    vertexOffset += verts.length / 3;
  }

  // A. Outer blade wall (from z=0 to z=hBlade)
  const outerWall = buildWallBetweenLoops(tipOuter, topBladeOuter, 0, hBlade, false);
  appendGeometry(outerWall.vertices, outerWall.indices);

  // B. Inner blade wall (from z=0 to z=hBlade + hLip)
  const innerWall = buildWallBetweenLoops(tipInner, lipInner, 0, hBlade + hLip, true);
  appendGeometry(innerWall.vertices, innerWall.indices);

  // C. Bottom cutting edge cap (knife bevel at z=0)
  const bottomEdgeCap = buildWallBetweenLoops(tipInner, tipOuter, 0, 0, false);
  appendGeometry(bottomEdgeCap.vertices, bottomEdgeCap.indices);

  // D. Lip bottom step (from topBladeOuter to lipOuter at z=hBlade)
  const lipUnderneath = buildWallBetweenLoops(topBladeOuter, lipOuter, hBlade, hBlade, false);
  appendGeometry(lipUnderneath.vertices, lipUnderneath.indices);

  // E. Lip outer vertical wall (from z=hBlade to z=hBlade + hLip)
  const lipVertical = buildWallBetweenLoops(lipOuter, lipOuter, hBlade, hBlade + hLip, false);
  appendGeometry(lipVertical.vertices, lipVertical.indices);

  // F. Lip top horizontal cap (from lipInner to lipOuter at z=hBlade + hLip)
  const lipTopCap = buildWallBetweenLoops(lipOuter, lipInner, hBlade + hLip, hBlade + hLip, false);
  appendGeometry(lipTopCap.vertices, lipTopCap.indices);

  // Build Three.js BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'cutter';

  return mesh;
}

/**
 * Creates the 3D Stamp Mesh (Base plate + relief lines + handle + air holes)
 */
export function generateStampMesh(
  model: ModelLineart,
  settings: ModelSettings,
  material: THREE.Material
): THREE.Mesh {
  const sourceBounds = getBounds(model.outerPerimeter);
  const scaledOuter = scaleAndCenterPath(
    model.outerPerimeter,
    settings.targetWidth,
    settings.targetHeight,
    sourceBounds
  );
  const baseContour = smoothPath(scaledOuter, 2, true);

  // Inset contour for stamp base plate clearance so it slides smoothly
  const stampPlateContour = offsetClosedPolygon(baseContour, -settings.stampClearance);
  const plateThick = settings.stampPlateThickness;
  const reliefDepth = settings.stampDepth;

  // We will build a composite Three.js geometry using Group or BufferGeometry merging
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Stamp Base Plate using THREE.Shape & ExtrudeGeometry
  const shape = new THREE.Shape();
  if (stampPlateContour.length > 0) {
    shape.moveTo(stampPlateContour[0][0], stampPlateContour[0][1]);
    for (let i = 1; i < stampPlateContour.length; i++) {
      shape.lineTo(stampPlateContour[i][0], stampPlateContour[i][1]);
    }
    shape.closePath();
  }

  // Air release holes (vital for confectionery dough desolidification)
  if (settings.airReleaseHoles) {
    const holeRadius = settings.airHoleDiameter / 2;
    // Determine 2 to 3 balanced air hole positions
    const holeOffsets: [number, number][] = [
      [0, -settings.targetHeight * 0.22],
      [-settings.targetWidth * 0.2, settings.targetHeight * 0.15],
      [settings.targetWidth * 0.2, settings.targetHeight * 0.15],
    ];

    holeOffsets.forEach(([hx, hy]) => {
      const holePath = new THREE.Path();
      holePath.absarc(hx, hy, holeRadius, 0, Math.PI * 2, true);
      shape.holes.push(holePath);
    });
  }

  const plateGeo = new THREE.ExtrudeGeometry(shape, {
    depth: plateThick,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.5,
    bevelThickness: 0.5,
  });
  // Position plate so its bottom face sits at z = reliefDepth
  plateGeo.translate(0, 0, reliefDepth);
  geometries.push(plateGeo);

  // 2. Interior Lineart Detail Ribbons from Model
  // Safety guard: Compute inset safe boundary so all embossed lines are 100% physically supported by base plate
  const safePlateBoundary = offsetClosedPolygon(stampPlateContour, -0.6);

  for (const detailPath of model.innerDetails) {
    if (detailPath.length < 2) continue;

    const scaledPath = scaleAndCenterPath(
      detailPath,
      settings.targetWidth,
      settings.targetHeight,
      sourceBounds
    );
    const smoothedPath = smoothPath(scaledPath, 2, false);

    // Safeguard: clamp any points that would cross the plate edge and float in mid-air
    const clampedPath: Point2D[] = smoothedPath.map(([px, py]) => {
      if (isPointInPolygon([px, py], safePlateBoundary)) {
        return [px, py];
      }
      // Nudge towards center (0, 0) so it firmly roots on top of the solid backing plate
      const dist = Math.hypot(px, py) || 1;
      const factor = Math.max(0, (dist - 1.2) / dist);
      return [px * factor, py * factor];
    });

    // Detect if this path forms a closed loop (e.g. circle, oval, heart, pupil)
    const isClosed =
      clampedPath.length > 2 &&
      Math.hypot(
        clampedPath[0][0] - clampedPath[clampedPath.length - 1][0],
        clampedPath[0][1] - clampedPath[clampedPath.length - 1][1]
      ) < 1.2;

    // Expand polyline into ribbon polygon
    const ribbonPoly = expandLineToRibbon(clampedPath, settings.stampLineThickness, isClosed);
    if (ribbonPoly.length < 3) continue;

    const ribbonShape = new THREE.Shape();
    ribbonShape.moveTo(ribbonPoly[0][0], ribbonPoly[0][1]);
    for (let i = 1; i < ribbonPoly.length; i++) {
      ribbonShape.lineTo(ribbonPoly[i][0], ribbonPoly[i][1]);
    }
    ribbonShape.closePath();

    // Extrude from z = 0 up into the base plate
    try {
      const lineGeo = new THREE.ExtrudeGeometry(ribbonShape, {
        depth: reliefDepth + 0.8, // Slightly overlap into plate for clean Boolean union
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.25,
        bevelThickness: 0.25,
      });
      if (lineGeo.getAttribute('position') && lineGeo.getAttribute('position').count > 0) {
        geometries.push(lineGeo);
      }
    } catch {
      // Skip singular/degenerate ribbon paths gracefully
    }
  }

  // 2b. Solid High-Fidelity 3D Text Typography Geometry
  if (settings.customText && settings.customText.trim()) {
    try {
      const textShapes = generate3DTextShapes(settings, false);
      for (const textShape of textShapes) {
        const textGeo = new THREE.ExtrudeGeometry(textShape, {
          depth: reliefDepth + 0.8, // Fused solidly into base plate
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.2,
          bevelThickness: 0.2,
        });
        if (textGeo.getAttribute('position') && textGeo.getAttribute('position').count > 0) {
          geometries.push(textGeo);
        }
      }
    } catch (e) {
      console.error('Failed to generate 3D text geometry:', e);
    }
  }

  // 3. Ergonomic Handle on back of stamp
  const topPlateZ = reliefDepth + plateThick + 0.5;
  if (settings.handleType === 'knob') {
    // Elegant flared knob
    const knobRadiusTop = Math.min(12, settings.targetWidth * 0.16);
    const knobRadiusBase = Math.min(8, settings.targetWidth * 0.1);
    const knobHeight = settings.handleHeight;

    const lathePoints: THREE.Vector2[] = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(knobRadiusBase, 0),
      new THREE.Vector2(knobRadiusBase * 0.85, knobHeight * 0.35),
      new THREE.Vector2(knobRadiusBase * 0.7, knobHeight * 0.65),
      new THREE.Vector2(knobRadiusTop, knobHeight * 0.9),
      new THREE.Vector2(knobRadiusTop * 0.9, knobHeight),
      new THREE.Vector2(0, knobHeight),
    ];

    const knobGeo = new THREE.LatheGeometry(lathePoints, 24);
    knobGeo.rotateX(Math.PI / 2);
    knobGeo.translate(0, 0, topPlateZ);
    geometries.push(knobGeo);
  } else if (settings.handleType === 'bar') {
    // Ribbed bridge bar handle
    const barLength = Math.min(settings.targetWidth * 0.6, 50);
    const barHeight = settings.handleHeight;
    const barWidth = 10;

    const barGeo = new THREE.BoxGeometry(barLength, barWidth, barHeight);
    barGeo.translate(0, 0, topPlateZ + barHeight / 2);
    geometries.push(barGeo);
  } else if (settings.handleType === 'ring') {
    // Pull ring handle
    const ringRadius = Math.min(14, settings.targetWidth * 0.18);
    const ringTube = 3.5;
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 16, 32);
    ringGeo.rotateY(Math.PI / 2);
    ringGeo.translate(0, 0, topPlateZ + ringRadius + 2);
    geometries.push(ringGeo);
  }

  // Merge all geometries into a single watertight BufferGeometry
  const mergedGeometry = mergeBufferGeometries(geometries);
  mergedGeometry.computeVertexNormals();

  const mesh = new THREE.Mesh(mergedGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'stamp';

  return mesh;
}

/**
 * Creates 3D Cookie Dough Simulation Mesh (Baked sugar biscuit with stamped impressions)
 */
export function generateDoughMesh(
  model: ModelLineart,
  settings: ModelSettings,
  material: THREE.Material
): THREE.Mesh {
  const sourceBounds = getBounds(model.outerPerimeter);
  const scaledOuter = scaleAndCenterPath(
    model.outerPerimeter,
    settings.targetWidth,
    settings.targetHeight,
    sourceBounds
  );
  const baseContour = smoothPath(scaledOuter, 2, true);

  const doughShape = new THREE.Shape();
  if (baseContour.length > 0) {
    doughShape.moveTo(baseContour[0][0], baseContour[0][1]);
    for (let i = 1; i < baseContour.length; i++) {
      doughShape.lineTo(baseContour[i][0], baseContour[i][1]);
    }
    doughShape.closePath();
  }

  // Extrude dough with soft rounded bevel
  const doughGeo = new THREE.ExtrudeGeometry(doughShape, {
    depth: 6, // 6mm cookie thickness
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 1.2,
    bevelThickness: 1.2,
  });

  const geometries: THREE.BufferGeometry[] = [doughGeo];

  // Imprinted darker stamp lines on top face of dough from Model
  for (const detailPath of model.innerDetails) {
    if (detailPath.length < 2) continue;
    const scaledPath = scaleAndCenterPath(
      detailPath,
      settings.targetWidth,
      settings.targetHeight,
      sourceBounds
    );
    const smoothedPath = smoothPath(scaledPath, 2, false);
    const ribbonPoly = expandLineToRibbon(smoothedPath, settings.stampLineThickness * 1.1, false);
    if (ribbonPoly.length < 3) continue;

    const lineShape = new THREE.Shape();
    lineShape.moveTo(ribbonPoly[0][0], ribbonPoly[0][1]);
    for (let i = 1; i < ribbonPoly.length; i++) {
      lineShape.lineTo(ribbonPoly[i][0], ribbonPoly[i][1]);
    }
    lineShape.closePath();

    // Subtle debossed groove
    try {
      const markGeo = new THREE.ExtrudeGeometry(lineShape, {
        depth: 0.8,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.2,
        bevelThickness: 0.2,
      });
      if (markGeo.getAttribute('position') && markGeo.getAttribute('position').count > 0) {
        // Position on top surface of dough (z = 6 + 1.2)
        markGeo.translate(0, 0, 7.1);
        geometries.push(markGeo);
      }
    } catch {
      // Skip singular paths gracefully
    }
  }

  // 2b. Solid High-Fidelity 3D Text Impression on Dough (Readable left to right)
  if (settings.customText && settings.customText.trim()) {
    try {
      const doughTextShapes = generate3DTextShapes(settings, true);
      for (const textShape of doughTextShapes) {
        const textMarkGeo = new THREE.ExtrudeGeometry(textShape, {
          depth: 0.8,
          bevelEnabled: true,
          bevelSegments: 1,
          steps: 1,
          bevelSize: 0.15,
          bevelThickness: 0.15,
        });
        if (textMarkGeo.getAttribute('position') && textMarkGeo.getAttribute('position').count > 0) {
          textMarkGeo.translate(0, 0, 7.1);
          geometries.push(textMarkGeo);
        }
      }
    } catch (e) {
      console.error('Failed to generate dough text impression:', e);
    }
  }

  const merged = mergeBufferGeometries(geometries);
  merged.computeVertexNormals();

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'dough';

  return mesh;
}

/**
 * Robust utility to merge multiple BufferGeometries into one
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) return geometries[0].clone();

  // Convert all valid geometries to non-indexed representation
  const validGeos: THREE.BufferGeometry[] = [];
  let totalFloats = 0;

  for (const g of geometries) {
    if (!g || !g.getAttribute('position')) continue;
    const nonIndexed = g.index ? g.toNonIndexed() : g.clone();
    const pos = nonIndexed.getAttribute('position');
    if (pos && pos.array.length > 0) {
      validGeos.push(nonIndexed);
      totalFloats += pos.array.length;
    }
  }

  if (validGeos.length === 0) return new THREE.BufferGeometry();

  const mergedPositions = new Float32Array(totalFloats);
  let posOffset = 0;

  for (const g of validGeos) {
    const pos = g.getAttribute('position');
    if (pos) {
      mergedPositions.set(pos.array, posOffset);
      posOffset += pos.array.length;
    }
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  merged.computeVertexNormals();
  return merged;
}
