import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { csgUnionGeometries, repairGeometry } from "./manifoldValidator";

export interface LowPolyModelDefinition {
  id: string;
  name: string;
  category: "animals" | "symbols" | "decor" | "functional";
  description: string;
  iconName: string;
  defaultHeight: number; // in mm
  defaultColor: string;
  defaultWallThickness?: number;
  printabilityTips: string;
  generateGeometry: (polyLevel?: number, jitter?: number) => THREE.BufferGeometry;
}

// -------------------------------------------------------------
// HELPER: CREATE WATERTIGHT MESH FROM VERTICES & FACES
// -------------------------------------------------------------
export function createWatertightMeshFromFaces(
  vertices: number[][],
  faces: number[][],
  jitterAmount: number = 0
): THREE.BufferGeometry {
  const processedVertices = vertices.map((v, idx) => {
    if (jitterAmount <= 0) return [...v];
    const seed = Math.sin(idx * 12.9898 + 78.233) * 43758.5453;
    const jx = (Math.sin(seed) - 0.5) * jitterAmount;
    const jy = (Math.cos(seed * 1.5) - 0.5) * jitterAmount;
    const jz = (Math.sin(seed * 2.3) - 0.5) * jitterAmount;
    return [v[0] + jx, v[1] + jy, v[2] + jz];
  });

  const positions: number[] = [];
  const indices: number[] = [];

  // Flatten vertex positions
  for (const v of processedVertices) {
    positions.push(v[0], v[1], v[2]);
  }

  // Triangulate faces
  for (const face of faces) {
    if (face.length === 3) {
      indices.push(face[0], face[1], face[2]);
    } else if (face.length === 4) {
      // Quad triangulation
      indices.push(face[0], face[1], face[2]);
      indices.push(face[0], face[2], face[3]);
    } else if (face.length > 4) {
      // Fan triangulation for convex n-gons
      for (let i = 1; i < face.length - 1; i++) {
        indices.push(face[0], face[i], face[i + 1]);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return repairGeometry(geom);
}

// -------------------------------------------------------------
// 1. CORAÇÃO LOW POLY (Faceted Low Poly Heart) - 100% Watertight Closed Polyhedron
// -------------------------------------------------------------
export function createLowPolyHeartGeometry(_polyLevel: number = 1, jitter: number = 0): THREE.BufferGeometry {
  const v = [
    // 0: Bottom Apex Tip
    [0, -22, 0],
    
    // 1-8: Lower Body Ring
    [0, -8, 12],    // 1: front center lower
    [-14, -6, 8],   // 2: front left lower
    [-18, -4, 0],   // 3: side left lower
    [-14, -6, -8],  // 4: back left lower
    [0, -8, -12],   // 5: back center lower
    [14, -6, -8],   // 6: back right lower
    [18, -4, 0],    // 7: side right lower
    [14, -6, 8],    // 8: front right lower
    
    // 9-16: Mid Equatorial Bulge Ring
    [0, 4, 15],     // 9: front mid center
    [-18, 6, 12],   // 10: front left mid
    [-24, 8, 0],    // 11: left waist apex
    [-18, 6, -12],  // 12: back left mid
    [0, 4, -15],    // 13: back mid center
    [18, 6, -12],   // 14: back right mid
    [24, 8, 0],     // 15: right waist apex
    [18, 6, 12],    // 16: front right mid
    
    // 17-25: Upper Shoulder & Lobes
    [0, 8, 7],      // 17: Cleft Front V-notch
    [-12, 18, 7],   // 18: Left Lobe Top-Front
    [-15, 20, 0],   // 19: Left Lobe Crest Apex
    [-12, 18, -7],  // 20: Left Lobe Top-Back
    [0, 8, -7],     // 21: Cleft Back V-notch
    [12, 18, -7],   // 22: Right Lobe Top-Back
    [15, 20, 0],    // 23: Right Lobe Crest Apex
    [12, 18, 7],    // 24: Right Lobe Top-Front
    [0, 11, 0],     // 25: Center Saddle Cleft Valley
  ];

  const f = [
    // Bottom cone to lower ring
    [0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 5, 4],
    [0, 6, 5], [0, 7, 6], [0, 8, 7], [0, 1, 8],

    // Lower to mid ring (front left)
    [1, 2, 10], [1, 10, 9], [2, 3, 11], [2, 11, 10],
    // Lower to mid ring (back left)
    [3, 4, 12], [3, 12, 11], [4, 5, 13], [4, 13, 12],
    // Lower to mid ring (back right)
    [5, 6, 14], [5, 14, 13], [6, 7, 15], [6, 15, 14],
    // Lower to mid ring (front right)
    [7, 8, 16], [7, 16, 15], [8, 1, 9], [8, 9, 16],

    // Mid to Upper Cleft & Left Lobe (Front)
    [9, 10, 18], [9, 18, 17], [10, 11, 19], [10, 19, 18],
    // Mid to Upper Left Lobe (Back)
    [11, 12, 20], [11, 20, 19], [12, 13, 20], [13, 21, 20],

    // Mid to Upper Cleft & Right Lobe (Front)
    [9, 17, 24], [9, 24, 16], [16, 24, 23], [16, 23, 15],
    // Mid to Upper Right Lobe (Back)
    [15, 23, 22], [15, 22, 14], [14, 22, 13], [13, 22, 21],

    // Cleft Valley Facets (Top center - perfectly sealed)
    [17, 18, 25], [18, 19, 25], [19, 20, 25], [20, 21, 25],
    [17, 25, 24], [24, 25, 23], [23, 25, 22], [22, 25, 21]
  ];

  return createWatertightMeshFromFaces(v, f, jitter);
}

// -------------------------------------------------------------
// 2. GIRAFA LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyGiraffeGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Torso / Body (faceted cylinder tilted)
  const body = new THREE.CylinderGeometry(8, 11, 26, 6);
  body.rotateX(Math.PI / 4);
  body.translate(0, 32, 0);
  parts.push(body);

  // 2. Front Legs
  const flLeg = new THREE.CylinderGeometry(2.5, 3.5, 34, 5);
  flLeg.translate(-6, 17, 8);
  parts.push(flLeg);

  const frLeg = new THREE.CylinderGeometry(2.5, 3.5, 34, 5);
  frLeg.translate(6, 17, 8);
  parts.push(frLeg);

  // 3. Back Legs
  const blLeg = new THREE.CylinderGeometry(2.2, 3.8, 28, 5);
  blLeg.translate(-6, 14, -10);
  parts.push(blLeg);

  const brLeg = new THREE.CylinderGeometry(2.2, 3.8, 28, 5);
  brLeg.translate(6, 14, -10);
  parts.push(brLeg);

  // 4. Long Faceted Neck
  const neck = new THREE.CylinderGeometry(3.5, 6, 42, 6);
  neck.rotateX(-Math.PI / 10);
  neck.translate(0, 56, 8);
  parts.push(neck);

  // 5. Head & Muzzle
  const head = new THREE.DodecahedronGeometry(6, 0);
  head.scale(0.9, 1.2, 1.6);
  head.rotateX(-Math.PI / 8);
  head.translate(0, 76, 14);
  parts.push(head);

  // 6. Ears
  const leftEar = new THREE.ConeGeometry(2, 6, 4);
  leftEar.rotateZ(Math.PI / 3);
  leftEar.translate(-6, 79, 11);
  parts.push(leftEar);

  const rightEar = new THREE.ConeGeometry(2, 6, 4);
  rightEar.rotateZ(-Math.PI / 3);
  rightEar.translate(6, 79, 11);
  parts.push(rightEar);

  // 7. Horns (Ossicones)
  const leftHorn = new THREE.CylinderGeometry(1, 0.8, 7, 4);
  leftHorn.translate(-2.5, 83, 13);
  parts.push(leftHorn);

  const rightHorn = new THREE.CylinderGeometry(1, 0.8, 7, 4);
  rightHorn.translate(2.5, 83, 13);
  parts.push(rightHorn);

  // 8. Tail
  const tail = new THREE.CylinderGeometry(0.8, 1.5, 16, 4);
  tail.rotateX(-Math.PI / 6);
  tail.translate(0, 22, -14);
  parts.push(tail);

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 3. RAPOSA SENTADA LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyFoxGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Seated Haunches / Lower Base
  const base = new THREE.CylinderGeometry(14, 18, 14, 7);
  base.translate(0, 7, 0);
  parts.push(base);

  // 2. Chest & Torso (Tapered faceted cone)
  const torso = new THREE.CylinderGeometry(7, 13, 20, 6);
  torso.translate(0, 22, 2);
  parts.push(torso);

  // 3. Fluffy Bib Chest (Front prism)
  const bib = new THREE.ConeGeometry(8, 16, 4);
  bib.rotateX(Math.PI / 4);
  bib.translate(0, 20, 10);
  parts.push(bib);

  // 4. Head & Cheeks
  const head = new THREE.IcosahedronGeometry(9, 0);
  head.scale(1.1, 0.95, 1.2);
  head.translate(0, 36, 4);
  parts.push(head);

  // 5. Snout / Muzzle
  const snout = new THREE.ConeGeometry(4.5, 12, 4);
  snout.rotateX(-Math.PI / 2);
  snout.translate(0, 34, 14);
  parts.push(snout);

  // 6. Big Triangle Fox Ears
  const leftEar = new THREE.ConeGeometry(4, 14, 4);
  leftEar.rotateZ(Math.PI / 7);
  leftEar.rotateX(-Math.PI / 12);
  leftEar.translate(-7, 46, 3);
  parts.push(leftEar);

  const rightEar = new THREE.ConeGeometry(4, 14, 4);
  rightEar.rotateZ(-Math.PI / 7);
  rightEar.rotateX(-Math.PI / 12);
  rightEar.translate(7, 46, 3);
  parts.push(rightEar);

  // 7. Bushy Tail wrapping around
  const tail1 = new THREE.CylinderGeometry(4, 7, 18, 6);
  tail1.rotateZ(Math.PI / 3);
  tail1.rotateX(Math.PI / 5);
  tail1.translate(11, 7, -3);
  parts.push(tail1);

  const tailTip = new THREE.ConeGeometry(5, 14, 5);
  tailTip.rotateZ(Math.PI / 2);
  tailTip.rotateY(-Math.PI / 4);
  tailTip.translate(12, 4, 8);
  parts.push(tailTip);

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 4. ELEFANTE DA SORTE LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyElephantGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Massive Torso
  const body = new THREE.DodecahedronGeometry(17, 0);
  body.scale(1.1, 0.95, 1.3);
  body.translate(0, 24, 0);
  parts.push(body);

  // 2. Columnar 4 Legs (Stable flat bases)
  const flLeg = new THREE.CylinderGeometry(4, 4.5, 18, 6);
  flLeg.translate(-8, 9, 8);
  parts.push(flLeg);

  const frLeg = new THREE.CylinderGeometry(4, 4.5, 18, 6);
  frLeg.translate(8, 9, 8);
  parts.push(frLeg);

  const blLeg = new THREE.CylinderGeometry(4, 4.5, 18, 6);
  blLeg.translate(-8, 9, -8);
  parts.push(blLeg);

  const brLeg = new THREE.CylinderGeometry(4, 4.5, 18, 6);
  brLeg.translate(8, 9, -8);
  parts.push(brLeg);

  // 3. Head
  const head = new THREE.IcosahedronGeometry(11, 0);
  head.scale(1, 1, 1.1);
  head.translate(0, 28, 14);
  parts.push(head);

  // 4. Big Low Poly Fan Ears
  const leftEar = new THREE.CylinderGeometry(11, 8, 2.5, 5);
  leftEar.rotateZ(Math.PI / 2);
  leftEar.rotateY(-Math.PI / 6);
  leftEar.translate(-14, 28, 10);
  parts.push(leftEar);

  const rightEar = new THREE.CylinderGeometry(11, 8, 2.5, 5);
  rightEar.rotateZ(-Math.PI / 2);
  rightEar.rotateY(Math.PI / 6);
  rightEar.translate(14, 28, 10);
  parts.push(rightEar);

  // 5. Upward Curved Lucky Trunk (Tromba para Cima)
  const trunkBase = new THREE.CylinderGeometry(3.5, 5, 12, 5);
  trunkBase.rotateX(Math.PI / 3);
  trunkBase.translate(0, 20, 20);
  parts.push(trunkBase);

  const trunkMid = new THREE.CylinderGeometry(2.5, 3.5, 12, 5);
  trunkMid.rotateX(-Math.PI / 4);
  trunkMid.translate(0, 18, 26);
  parts.push(trunkMid);

  const trunkTip = new THREE.ConeGeometry(2.2, 10, 5);
  trunkTip.rotateX(Math.PI);
  trunkTip.translate(0, 24, 28);
  parts.push(trunkTip);

  // 6. Tusks
  const leftTusk = new THREE.ConeGeometry(1.2, 10, 4);
  leftTusk.rotateX(-Math.PI / 3);
  leftTusk.rotateZ(Math.PI / 8);
  leftTusk.translate(-5, 20, 20);
  parts.push(leftTusk);

  const rightTusk = new THREE.ConeGeometry(1.2, 10, 4);
  rightTusk.rotateX(-Math.PI / 3);
  rightTusk.rotateZ(-Math.PI / 8);
  rightTusk.translate(5, 20, 20);
  parts.push(rightTusk);

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 5. CERVO / ALCE NOBRE LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyStagGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Torso
  const body = new THREE.CylinderGeometry(7, 9, 24, 6);
  body.rotateX(Math.PI / 2.2);
  body.translate(0, 30, 0);
  parts.push(body);

  // 2. Slender Legs
  const fl = new THREE.CylinderGeometry(1.8, 2.5, 30, 5);
  fl.translate(-5, 15, 8);
  parts.push(fl);

  const fr = new THREE.CylinderGeometry(1.8, 2.5, 30, 5);
  fr.translate(5, 15, 8);
  parts.push(fr);

  const bl = new THREE.CylinderGeometry(2, 2.8, 30, 5);
  bl.translate(-5, 15, -8);
  parts.push(bl);

  const br = new THREE.CylinderGeometry(2, 2.8, 30, 5);
  br.translate(5, 15, -8);
  parts.push(br);

  // 3. Elevated Neck
  const neck = new THREE.CylinderGeometry(3.5, 5.5, 22, 6);
  neck.rotateX(-Math.PI / 5);
  neck.translate(0, 46, 6);
  parts.push(neck);

  // 4. Head & Snout
  const head = new THREE.IcosahedronGeometry(6, 0);
  head.scale(0.9, 0.9, 1.3);
  head.translate(0, 56, 10);
  parts.push(head);

  const snout = new THREE.ConeGeometry(3, 8, 4);
  snout.rotateX(-Math.PI / 2.3);
  snout.translate(0, 54, 16);
  parts.push(snout);

  // 5. Ears
  const leftEar = new THREE.ConeGeometry(2, 7, 4);
  leftEar.rotateZ(Math.PI / 3);
  leftEar.translate(-6, 59, 7);
  parts.push(leftEar);

  const rightEar = new THREE.ConeGeometry(2, 7, 4);
  rightEar.rotateZ(-Math.PI / 3);
  rightEar.translate(6, 59, 7);
  parts.push(rightEar);

  // 6. Branching Antlers (Galhadas multifacetadas sólidas)
  const antlerL1 = new THREE.CylinderGeometry(1.2, 1.8, 16, 5);
  antlerL1.rotateZ(Math.PI / 5);
  antlerL1.rotateX(Math.PI / 10);
  antlerL1.translate(-7, 65, 8);
  parts.push(antlerL1);

  const antlerL2 = new THREE.CylinderGeometry(0.9, 1.3, 10, 4);
  antlerL2.rotateZ(Math.PI / 2.5);
  antlerL2.translate(-11, 68, 11);
  parts.push(antlerL2);

  const antlerR1 = new THREE.CylinderGeometry(1.2, 1.8, 16, 5);
  antlerR1.rotateZ(-Math.PI / 5);
  antlerR1.rotateX(Math.PI / 10);
  antlerR1.translate(7, 65, 8);
  parts.push(antlerR1);

  const antlerR2 = new THREE.CylinderGeometry(0.9, 1.3, 10, 4);
  antlerR2.rotateZ(-Math.PI / 2.5);
  antlerR2.translate(11, 68, 11);
  parts.push(antlerR2);

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 6. LEÃO MAJESTOSO LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyLionGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Torso
  const body = new THREE.CylinderGeometry(10, 13, 26, 7);
  body.rotateX(Math.PI / 3);
  body.translate(0, 24, -2);
  parts.push(body);

  // 2. Muscular Legs
  const fl = new THREE.CylinderGeometry(3.5, 4.5, 22, 5);
  fl.translate(-7, 11, 8);
  parts.push(fl);

  const fr = new THREE.CylinderGeometry(3.5, 4.5, 22, 5);
  fr.translate(7, 11, 8);
  parts.push(fr);

  const bl = new THREE.CylinderGeometry(3.5, 5, 20, 5);
  bl.translate(-7, 10, -10);
  parts.push(bl);

  const br = new THREE.CylinderGeometry(3.5, 5, 20, 5);
  br.translate(7, 10, -10);
  parts.push(br);

  // 3. Voluminous Radial Faceted Mane (Juba geométrica)
  const mane = new THREE.IcosahedronGeometry(18, 0);
  mane.scale(1.2, 1.2, 0.9);
  mane.translate(0, 36, 6);
  parts.push(mane);

  // 4. Lion Face & Muzzle
  const head = new THREE.DodecahedronGeometry(8, 0);
  head.scale(1, 1, 1.2);
  head.translate(0, 36, 12);
  parts.push(head);

  const snout = new THREE.ConeGeometry(5, 9, 5);
  snout.rotateX(-Math.PI / 2);
  snout.translate(0, 33, 19);
  parts.push(snout);

  // 5. Tail
  const tail = new THREE.CylinderGeometry(1.2, 1.8, 20, 4);
  tail.rotateX(-Math.PI / 4);
  tail.translate(0, 16, -16);
  parts.push(tail);

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 7. CAVEIRA GEOMÉTRICA LOW POLY (Solid Watertight Polyhedron)
// -------------------------------------------------------------
export function createLowPolySkullGeometry(_polyLevel: number = 1, jitter: number = 0): THREE.BufferGeometry {
  const v = [
    // 0: Apex Top Crown
    [0, 24, 0],
    // 1-5: Cranium Dome Ring
    [-14, 20, 6],   // 1: Cranium Front-Left
    [14, 20, 6],    // 2: Cranium Front-Right
    [-16, 18, -10], // 3: Cranium Back-Left
    [16, 18, -10],  // 4: Cranium Back-Right
    [0, 18, -16],   // 5: Occipital Back

    // 6-10: Brow & Temples
    [0, 16, 15],    // 6: Glabella (Between Brows)
    [-12, 14, 14],  // 7: Left Brow
    [12, 14, 14],   // 8: Right Brow
    [-18, 10, 0],   // 9: Left Temple
    [18, 10, 0],    // 10: Right Temple

    // 11-16: Eye Cavities & Nose
    [-6, 8, 8],     // 11: Left Socket Inner
    [-12, 6, 9],    // 12: Left Socket Outer
    [6, 8, 8],      // 13: Right Socket Inner
    [12, 6, 9],     // 14: Right Socket Outer
    [0, 4, 14],     // 15: Nasal Bone
    [0, 0, 10],     // 16: Nasal Cavity

    // 17-21: Cheekbones & Maxilla
    [-16, 2, 8],    // 17: Left Cheekbone
    [16, 2, 8],     // 18: Right Cheekbone
    [-8, -2, 13],   // 19: Left Upper Teeth
    [8, -2, 13],    // 20: Right Upper Teeth
    [0, -2, 14],    // 21: Incisor Center

    // 22-27: Mandible Jaw & Flat Bed Base
    [-7, -10, 11],  // 22: Left Chin Front
    [7, -10, 11],   // 23: Right Chin Front
    [0, -12, 12],   // 24: Chin Center
    [-12, -8, 2],   // 25: Left Jaw Angle
    [12, -8, 2],    // 26: Right Jaw Angle
    [0, -12, 0],    // 27: Bottom Center Base
  ];

  const f = [
    // Cranium Dome
    [0, 1, 6], [0, 6, 2], [0, 3, 1], [0, 2, 4], [0, 5, 3], [0, 4, 5],
    [1, 7, 6], [2, 6, 8], [1, 9, 7], [2, 8, 10], [1, 3, 9], [2, 10, 4],
    [3, 5, 9], [4, 10, 5],

    // Brow & Eye Sockets
    [6, 7, 11], [6, 13, 8], [7, 12, 11], [8, 13, 14],
    [7, 9, 17], [8, 18, 10], [7, 17, 12], [8, 14, 18],

    // Nose & Cheeks
    [6, 11, 15], [6, 15, 13], [11, 16, 15], [13, 15, 16],
    [11, 12, 19], [13, 20, 14], [11, 19, 16], [13, 16, 20],
    [12, 17, 19], [14, 20, 18], [16, 19, 21], [16, 21, 20],

    // Jaw / Teeth
    [19, 22, 21], [20, 21, 23], [21, 22, 24], [21, 24, 23],
    [17, 25, 19], [18, 20, 26], [19, 25, 22], [20, 23, 26],

    // Bottom Base Closure
    [22, 25, 27], [23, 27, 26], [22, 27, 24], [23, 24, 27],
    [25, 9, 27], [26, 27, 10], [9, 5, 27], [10, 27, 5]
  ];

  return createWatertightMeshFromFaces(v, f, jitter);
}

// -------------------------------------------------------------
// 8. VASO CACHEPOT LOW POLY (Hollow 100% Watertight Solid Manifold)
// -------------------------------------------------------------
export function createLowPolyPlanterGeometry(_polyLevel: number = 1, jitter: number = 0): THREE.BufferGeometry {
  const sides = 8;
  const height = 40;
  const rBottom = 16;
  const rWaist = 24;
  const rTop = 20;
  const rInner = 15;
  const innerFloor = 5;

  const v: number[][] = [];
  const f: number[][] = [];

  // 0: Bottom Center
  v.push([0, 0, 0]);

  // 1..sides: Outer Bottom Ring
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    v.push([Math.cos(a) * rBottom, 0, Math.sin(a) * rBottom]);
  }

  // sides+1 .. 2*sides: Outer Waist Ring (twisted)
  const twist1 = Math.PI / sides;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + twist1;
    v.push([Math.cos(a) * rWaist, height * 0.45, Math.sin(a) * rWaist]);
  }

  // 2*sides+1 .. 3*sides: Outer Top Rim Ring
  const twist2 = twist1 * 2;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + twist2;
    v.push([Math.cos(a) * rTop, height, Math.sin(a) * rTop]);
  }

  // 3*sides+1 .. 4*sides: Inner Top Rim Ring
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + twist2;
    v.push([Math.cos(a) * rInner, height, Math.sin(a) * rInner]);
  }

  // 4*sides+1 .. 5*sides: Inner Chamber Floor Ring
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    v.push([Math.cos(a) * (rInner * 0.8), innerFloor, Math.sin(a) * (rInner * 0.8)]);
  }

  // Inner Floor Center
  const innerCenterIdx = v.length;
  v.push([0, innerFloor, 0]);

  // 1. Bottom Outer Disc (Faces point down)
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    f.push([0, 1 + i, 1 + next]);
  }

  // 2. Outer Wall: Bottom to Waist
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const b1 = 1 + i, b2 = 1 + next;
    const w1 = 1 + sides + i, w2 = 1 + sides + next;
    f.push([b1, w1, w2]);
    f.push([b1, w2, b2]);
  }

  // 3. Outer Wall: Waist to Top Rim
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const w1 = 1 + sides + i, w2 = 1 + sides + next;
    const t1 = 1 + sides * 2 + i, t2 = 1 + sides * 2 + next;
    f.push([w1, t1, t2]);
    f.push([w1, t2, w2]);
  }

  // 4. Top Rim Lip (Bridge between outer and inner)
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const t1 = 1 + sides * 2 + i, t2 = 1 + sides * 2 + next;
    const in1 = 1 + sides * 3 + i, in2 = 1 + sides * 3 + next;
    f.push([t1, in2, in1]);
    f.push([t1, t2, in2]);
  }

  // 5. Inner Cavity Wall (Descending down)
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const in1 = 1 + sides * 3 + i, in2 = 1 + sides * 3 + next;
    const ib1 = 1 + sides * 4 + i, ib2 = 1 + sides * 4 + next;
    f.push([in1, ib1, ib2]);
    f.push([in1, ib2, in2]);
  }

  // 6. Inner Chamber Floor Disc (Faces point up into container)
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const ib1 = 1 + sides * 4 + i, ib2 = 1 + sides * 4 + next;
    f.push([innerCenterIdx, ib2, ib1]);
  }

  return createWatertightMeshFromFaces(v, f, jitter);
}

// -------------------------------------------------------------
// 9. DIAMANTE / CRISTAL LAPIDADO (100% Watertight Polyhedron)
// -------------------------------------------------------------
export function createLowPolyGemGeometry(_polyLevel: number = 1, jitter: number = 0): THREE.BufferGeometry {
  const sides = 8;
  const tableR = 12;
  const girdleR = 20;
  const girdleHeight = 0;
  const tableHeight = 10;
  const pavilionHeight = -22;

  const v: number[][] = [];
  const f: number[][] = [];

  // Table Center (0)
  v.push([0, tableHeight, 0]);

  // Table Ring (1..8)
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    v.push([Math.cos(a) * tableR, tableHeight, Math.sin(a) * tableR]);
  }

  // Girdle Ring (9..16)
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (Math.PI / sides);
    v.push([Math.cos(a) * girdleR, girdleHeight, Math.sin(a) * girdleR]);
  }

  // Culet (Bottom Point)
  const culetIdx = v.length;
  v.push([0, pavilionHeight, 0]);

  // Table Flat Faces
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    f.push([0, 1 + next, 1 + i]);
  }

  // Crown Kite/Triangular Facets
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const t1 = 1 + i, t2 = 1 + next;
    const g1 = 1 + sides + i, g2 = 1 + sides + next;
    f.push([t1, t2, g1]);
    f.push([g1, t2, g2]);
  }

  // Pavilion Facets
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const g1 = 1 + sides + i, g2 = 1 + sides + next;
    f.push([culetIdx, g1, g2]);
  }

  return createWatertightMeshFromFaces(v, f, jitter);
}

// -------------------------------------------------------------
// 10. PINHEIRO / ÁRVORE LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyTreeGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Trunk
  const trunk = new THREE.CylinderGeometry(4.5, 5.5, 14, 6);
  trunk.translate(0, 7, 0);
  parts.push(trunk);

  // Tier 1 (Bottom conifer tier)
  const tier1 = new THREE.ConeGeometry(22, 22, 7);
  tier1.translate(0, 20, 0);
  parts.push(tier1);

  // Tier 2 (Mid conifer tier)
  const tier2 = new THREE.ConeGeometry(16, 20, 6);
  tier2.translate(0, 32, 0);
  parts.push(tier2);

  // Tier 3 (Top conifer tier)
  const tier3 = new THREE.ConeGeometry(10, 18, 5);
  tier3.translate(0, 43, 0);
  parts.push(tier3);

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 11. FOGUETE ESPACIAL LOW POLY (Solid CSG Manifold)
// -------------------------------------------------------------
export function createLowPolyRocketGeometry(_polyLevel: number = 1, _jitter: number = 0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 1. Engine Nozzle & Fuselage Lower
  const nozzle = new THREE.CylinderGeometry(8, 5, 8, 6);
  nozzle.translate(0, 4, 0);
  parts.push(nozzle);

  // 2. Fuselage Main Body
  const body = new THREE.CylinderGeometry(11, 10, 32, 6);
  body.translate(0, 22, 0);
  parts.push(body);

  // 3. Nose Cone
  const nose = new THREE.ConeGeometry(11, 20, 6);
  nose.translate(0, 48, 0);
  parts.push(nose);

  // 4. Tripod Solid Stabilizer Fins
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const fin = new THREE.BoxGeometry(3, 16, 12);
    fin.rotateY(a);
    fin.translate(Math.sin(a) * 12, 10, Math.cos(a) * 12);
    parts.push(fin);
  }

  return csgUnionGeometries(parts);
}

// -------------------------------------------------------------
// 12. ESTRELA 3D MULTIFACETADA (100% Watertight Closed Polyhedron)
// -------------------------------------------------------------
export function createLowPolyStarGeometry(_polyLevel: number = 1, jitter: number = 0): THREE.BufferGeometry {
  const points = 5;
  const outerR = 24;
  const innerR = 10;
  const thickness = 9;

  const v: number[][] = [];
  const f: number[][] = [];

  // Front Apex (0) & Back Apex (1)
  v.push([0, 0, thickness]);
  v.push([0, 0, -thickness]);

  // Star Points Ring (2..11)
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    v.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }

  const ringCount = points * 2;
  for (let i = 0; i < ringCount; i++) {
    const next = (i + 1) % ringCount;
    const p1 = 2 + i;
    const p2 = 2 + next;
    // Front pyramid facets
    f.push([0, p2, p1]);
    // Back pyramid facets
    f.push([1, p1, p2]);
  }

  return createWatertightMeshFromFaces(v, f, jitter);
}

// -------------------------------------------------------------
// CATALOG REGISTRY
// -------------------------------------------------------------
export const LOW_POLY_CATALOG: LowPolyModelDefinition[] = [
  {
    id: "giraffe",
    name: "Girafa Low Poly",
    category: "animals",
    description: "Pescoço elegante, manchas facetadas e base estável 100% autoportante para impressão sem suportes.",
    iconName: "🦒",
    defaultHeight: 90,
    defaultColor: "#FFA726",
    printabilityTips: "Excelente para PLA Amarelo ou Cobre. Orientação recomendada: em pé na vertical com base plana.",
    generateGeometry: createLowPolyGiraffeGeometry
  },
  {
    id: "heart",
    name: "Coração Low Poly",
    category: "symbols",
    description: "Coração geométrico multifacetado com cristas poligonais fechadas para chaveiro ou mesa.",
    iconName: "❤️",
    defaultHeight: 45,
    defaultColor: "#E53935",
    printabilityTips: "Imprime super rápido em PLA Seda Vermelho. 100% Watertight Manifold para chaveiro.",
    generateGeometry: createLowPolyHeartGeometry
  },
  {
    id: "fox",
    name: "Raposa Sentada",
    category: "animals",
    description: "Raposa estilizada em pose sentada com cauda espessa envolvendo o corpo e peito em destaque.",
    iconName: "🦊",
    defaultHeight: 65,
    defaultColor: "#FF7043",
    printabilityTips: "Formato compacto sem saliências frágeis. Fica maravilhosa em filamento laranja/terracota.",
    generateGeometry: createLowPolyFoxGeometry
  },
  {
    id: "elephant",
    name: "Elefante da Sorte",
    category: "animals",
    description: "Elefante imponente com tromba curvada para cima (símbolo de prosperidade) e orelhas facetadas.",
    iconName: "🐘",
    defaultHeight: 60,
    defaultColor: "#78909C",
    printabilityTips: "Tromba voltada para cima autoportante. Quatro patas sólidas para ótima aderência à mesa.",
    generateGeometry: createLowPolyElephantGeometry
  },
  {
    id: "stag",
    name: "Cervo / Alce Nobre",
    category: "animals",
    description: "Cervo esbelto com postura altiva e galhadas geométricas facetadas impressionantes.",
    iconName: "🦌",
    defaultHeight: 80,
    defaultColor: "#8D6E63",
    printabilityTips: "Ideal para 3 a 4 perímetros de parede para reforçar as galhadas superiores.",
    generateGeometry: createLowPolyStagGeometry
  },
  {
    id: "lion",
    name: "Leão Majestoso",
    category: "animals",
    description: "Leão com juba volumosa e imponente em facetas angulares que refletem a luz da impressão.",
    iconName: "🦁",
    defaultHeight: 70,
    defaultColor: "#FBC02D",
    printabilityTips: "Destaque espetacular com filamento PLA Silk Gold / Dourado Seda.",
    generateGeometry: createLowPolyLionGeometry
  },
  {
    id: "skull",
    name: "Caveira Geométrica",
    category: "decor",
    description: "Escultura de crânio estilizado low poly com cavidades oculares e queixo plano para apoio perfeito.",
    iconName: "💀",
    defaultHeight: 50,
    defaultColor: "#ECEFF1",
    printabilityTips: "Perfeito para PLA Mármore ou Branco Fosco. Base plana autoportante.",
    generateGeometry: createLowPolySkullGeometry
  },
  {
    id: "planter",
    name: "Vaso Cachepot Low Poly",
    category: "functional",
    description: "Vaso geométrico oco com paredes espessas para suculentas ou porta-canetas de mesa.",
    iconName: "🪴",
    defaultHeight: 55,
    defaultColor: "#26A69A",
    defaultWallThickness: 2.4,
    printabilityTips: "Imprimir com 3 a 4 perímetros para garantir vedação total contra água.",
    generateGeometry: createLowPolyPlanterGeometry
  },
  {
    id: "gem",
    name: "Diamante / Cristal Lapidado",
    category: "decor",
    description: "Gema lapidada de múltiplas facetas cintilantes, ideal para chaveiros, penduricalhos e troféus.",
    iconName: "💎",
    defaultHeight: 40,
    defaultColor: "#00E5FF",
    printabilityTips: "Excelente em PLA Translúcido / PETG Transparente ou Seda Azul.",
    generateGeometry: createLowPolyGemGeometry
  },
  {
    id: "tree",
    name: "Pinheiro / Árvore Low Poly",
    category: "decor",
    description: "Pinheiro natalino em 3 camadas cônicas facetadas com tronco cilíndrico estável.",
    iconName: "🌲",
    defaultHeight: 75,
    defaultColor: "#43A047",
    printabilityTips: "100% sem suportes. Fica ótimo em verde floresta ou com troca de filamento branco no topo.",
    generateGeometry: createLowPolyTreeGeometry
  },
  {
    id: "rocket",
    name: "Foguete Espacial Retro",
    category: "decor",
    description: "Foguete espacial clássico com aletas estabilizadoras em tripé e bocal propulsor.",
    iconName: "🚀",
    defaultHeight: 80,
    defaultColor: "#00E5FF",
    printabilityTips: "O tripé inferior atua como base de apoio estável na mesa de impressão.",
    generateGeometry: createLowPolyRocketGeometry
  },
  {
    id: "star",
    name: "Estrela 3D Multifacetada",
    category: "decor",
    description: "Estrela tridimensional de 5 pontas com relevo em prisma central para enfeites e árvores.",
    iconName: "⭐",
    defaultHeight: 50,
    defaultColor: "#FFD600",
    printabilityTips: "Pode ser impressa em pé ou deitada com base.",
    generateGeometry: createLowPolyStarGeometry
  }
];

export function calculatePrintSpecs(
  geometry: THREE.BufferGeometry,
  _scaleZ: number,
  infillPercent: number = 15,
  filamentDensity: number = 1.24
) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);

  const dimX = Math.round(size.x * 10) / 10;
  const dimY = Math.round(size.y * 10) / 10;
  const dimZ = Math.round(size.z * 10) / 10;

  const pos = geometry.attributes.position;
  const vertexCount = pos ? pos.count : 0;
  const faceCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3;

  const bboxVolumeCm3 = (dimX * dimY * dimZ) / 1000;
  const solidVolumeCm3 = Math.max(0.5, bboxVolumeCm3 * 0.45);

  const shellFactor = 0.35;
  const internalFactor = 0.65 * (infillPercent / 100);
  const actualVolumeCm3 = solidVolumeCm3 * (shellFactor + internalFactor);

  const filamentGrams = Math.max(1, Math.round(actualVolumeCm3 * filamentDensity * 10) / 10);
  const printTimeMinutes = Math.max(8, Math.round(filamentGrams * 2.4));
  const hours = Math.floor(printTimeMinutes / 60);
  const mins = printTimeMinutes % 60;
  const printTimeString = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  return {
    dimX,
    dimY,
    dimZ,
    vertexCount,
    faceCount: Math.round(faceCount),
    volumeCm3: Math.round(actualVolumeCm3 * 10) / 10,
    filamentGrams,
    printTimeString
  };
}
