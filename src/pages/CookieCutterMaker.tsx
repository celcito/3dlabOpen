import { useState, useRef, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  Sparkles, Download, Upload, Sliders, HelpCircle, Eye, EyeOff, 
  RotateCcw, Info, Settings, LayoutGrid, Check, Play, Scissors,
  Layers, Hammer, Palette, ArrowRight, Save, Trash2, Heart, RefreshCw, FileText, Folder
} from "lucide-react";

// --- TYPES & INTERFACES ---
interface SVGPathLayer {
  id: string;
  name: string;
  type: "cutter" | "stamp" | "ignore";
  points: THREE.Vector2[];
  isClosed: boolean;
  length: number;
}

interface MakerConfig {
  size: number;              // Target width/height in mm (e.g. 75)
  
  // Cutter
  cutterHeight: number;      // Height of cutting wall (mm)
  wallThickness: number;     // Width of cutting blade (mm)
  brimWidth: number;         // Support brim width (mm)
  brimHeight: number;        // Support brim height (mm)
  
  // Stamp
  stampPlateThickness: number; // Backing plate thickness (mm)
  clearance: number;           // Safety gap inside cutter wall (mm)
  detailHeight: number;        // Extrusion height of details (mm)
  detailThickness: number;     // Width of detail lines (mm)
  addHandle: boolean;          // Add grip handle on stamp back
  handleHeight: number;        // Stamp handle depth
  
  // Coloring / Painting Plate
  coloringBaseThickness: number; // Base plate height for coloring board
  coloringLineHeight: number;    // Outline height
  coloringLineWidth: number;     // Outline width
  
  // Materials & Display
  materialColor: string;       // Color of cutter/stamp (Hex)
  viewMode: "cutter_stamp" | "cutter_only" | "stamp_only" | "coloring_plate";
  explodedView: number;        // Separator between cutter and stamp (0 to 1)
  showWireframe: boolean;
}

interface SavedProject {
  id: string;
  name: string;
  savedAt: string;
  presetId: string;
  config: MakerConfig;
  layers: SVGPathLayer[];
}

// --- MITER OFFSET ALGORITHM FOR VECTOR CONTOURS ---
// Offsets a 2D closed polygon outward or inward using vertex normals.
// Includes miter limit clamping to prevent wild spikes on sharp corners.
function getOffsetPoints(points: THREE.Vector2[], offset: number): THREE.Vector2[] {
  const result: THREE.Vector2[] = [];
  const n = points.length;
  if (n < 3) return points.map(p => p.clone()); // Fallback for simple line/point arrays

  // Check if first and last are coincident, strip for normal calculation
  let cleanPoints = [...points];
  const start = points[0];
  const end = points[points.length - 1];
  if (start.distanceTo(end) < 0.001) {
    cleanPoints.pop();
  }
  const m = cleanPoints.length;

  for (let i = 0; i < m; i++) {
    const prev = cleanPoints[(i - 1 + m) % m];
    const curr = cleanPoints[i];
    const next = cleanPoints[(i + 1) % m];

    // Directions
    const dir1 = new THREE.Vector2().subVectors(curr, prev).normalize();
    const dir2 = new THREE.Vector2().subVectors(next, curr).normalize();

    // Perpendicular segment normals
    const norm1 = new THREE.Vector2(-dir1.y, dir1.x);
    const norm2 = new THREE.Vector2(-dir2.y, dir2.x);

    // Vertex bisector normal
    const bisectorNorm = new THREE.Vector2().addVectors(norm1, norm2).normalize();

    // Miter scaling factor (1 / cos(theta/2))
    const cosHalfTheta = norm1.dot(bisectorNorm);
    let scale = 1.0;
    if (cosHalfTheta > 0.1) {
      scale = 1.0 / cosHalfTheta;
    }
    // Safeguard to prevent giant spikes on sharp angles
    scale = Math.min(scale, 2.5);

    const offsetPt = new THREE.Vector2()
      .copy(curr)
      .addScaledVector(bisectorNorm, offset * scale);
    result.push(offsetPt);
  }

  // Ensure closed loop
  if (result.length > 0) {
    result.push(result[0].clone());
  }
  return result;
}

// --- CONVERTS THIN 2D CURVES TO CLOSED RIBBONS ---
// Creates a closed loop shape tracing an open or closed line with a given thickness.
function createRibbonShapeFromPoints(points: THREE.Vector2[], thickness: number, isClosed: boolean): THREE.Shape {
  const shape = new THREE.Shape();
  const n = points.length;
  if (n < 2) return shape;

  if (isClosed) {
    const outer = getOffsetPoints(points, thickness / 2);
    const inner = getOffsetPoints(points, -thickness / 2);
    
    shape.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i].x, inner[i].y);
    hole.closePath();
    shape.holes.push(hole);
  } else {
    const forward: THREE.Vector2[] = [];
    const backward: THREE.Vector2[] = [];

    for (let i = 0; i < n; i++) {
      let tangent = new THREE.Vector2();
      if (i === 0) {
        tangent.subVectors(points[1], points[0]).normalize();
      } else if (i === n - 1) {
        tangent.subVectors(points[n - 1], points[n - 2]).normalize();
      } else {
        const t1 = new THREE.Vector2().subVectors(points[i], points[i - 1]).normalize();
        const t2 = new THREE.Vector2().subVectors(points[i + 1], points[i]).normalize();
        tangent.addVectors(t1, t2).normalize();
      }

      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      
      forward.push(new THREE.Vector2().copy(points[i]).addScaledVector(normal, thickness / 2));
      backward.unshift(new THREE.Vector2().copy(points[i]).addScaledVector(normal, -thickness / 2));
    }

    const combined = [...forward, ...backward];
    shape.moveTo(combined[0].x, combined[0].y);
    for (let i = 1; i < combined.length; i++) {
      shape.lineTo(combined[i].x, combined[i].y);
    }
    shape.closePath();
  }
  return shape;
}

// --- PRESET SVG BANK ---
const PRESETS: { id: string; name: string; icon: string; svg: string }[] = [
  {
    id: "duck",
    name: "Patinho Fofinho",
    icon: "🦆",
    svg: `
<svg viewBox="0 0 100 100">
  <!-- OUTLINE -->
  <path id="outline" d="M 50 15 C 32 15 22 25 22 40 C 22 45 25 50 28 54 C 18 57 12 65 12 75 C 12 85 22 90 35 90 L 70 90 C 82 90 88 82 88 72 C 88 60 78 52 70 50 C 74 42 74 33 68 25 C 62 18 56 15 50 15 Z" />
  <!-- DETAILS -->
  <path id="details_eye" d="M 44 32 A 3 3 0 1 1 44 31.9 Z" />
  <path id="details_beak" d="M 24 40 C 18 40 14 44 16 48 C 19 50 24 47 24 44" />
  <path id="details_wing" d="M 52 58 C 43 58 38 64 40 72 C 43 78 55 80 64 74 C 70 68 66 58 52 58 Z" />
</svg>`
  },
  {
    id: "astronaut",
    name: "Astronauta",
    icon: "🧑‍🚀",
    svg: `
<svg viewBox="0 0 100 100">
  <path id="outline" d="M 50 10 C 65 10 75 20 75 35 C 75 42 71 48 65 52 L 70 78 L 57 78 L 57 90 L 43 90 L 43 78 L 30 78 L 35 52 C 29 48 25 42 25 35 C 25 20 35 10 50 10 Z" />
  <path id="details_visor" d="M 50 18 C 62 18 66 22 66 29 C 66 36 62 40 50 40 C 38 40 34 36 34 29 C 34 22 38 18 50 18 Z" />
  <path id="details_pocket" d="M 43 57 L 57 57 L 57 70 L 43 70 Z" />
  <path id="details_symbol" d="M 50 63 A 3 3 0 1 1 50 62.9 Z" />
</svg>`
  },
  {
    id: "saturn",
    name: "Saturno",
    icon: "🪐",
    svg: `
<svg viewBox="0 0 100 100">
  <path id="outline" d="M 50 22 C 62 22 72 28 75 35 C 84 34 92 38 92 43 C 92 48 83 52 72 53 C 67 64 52 72 38 70 C 24 67 15 55 16 42 C 11 42 8 45 8 48 C 8 53 18 58 30 59 C 34 53 42 49 50 48 Z" />
  <path id="details_planet" d="M 50 25 A 22 22 0 1 0 50 69 A 22 22 0 1 0 50 25 Z" />
  <path id="details_ring" d="M 10 46 C 20 54 80 54 90 46" />
</svg>`
  },
  {
    id: "rocket",
    name: "Foguete Espacial",
    icon: "🚀",
    svg: `
<svg viewBox="0 0 100 100">
  <path id="outline" d="M 50 10 C 60 25 65 40 65 65 L 75 80 L 65 80 L 65 85 C 65 88 62 90 58 90 L 42 90 C 38 90 35 88 35 85 L 35 80 L 25 80 L 35 65 C 35 40 40 25 50 10 Z" />
  <path id="details_window" d="M 50 35 A 8 8 0 1 1 50 34.9 Z" />
  <path id="details_stripe" d="M 37 55 L 63 55" />
  <path id="details_exhaust" d="M 45 90 L 50 100 L 55 90 Z" />
</svg>`
  },
  {
    id: "dino",
    name: "Dinossauro",
    icon: "🦖",
    svg: `
<svg viewBox="0 0 100 100">
  <path id="outline" d="M 35 15 C 50 15 62 18 68 25 C 73 31 71 43 62 46 C 66 50 75 52 84 50 C 88 56 84 70 72 78 C 64 83 50 83 40 78 C 30 73 24 60 24 48 C 24 35 28 15 35 15 Z" />
  <path id="details_eye" d="M 45 25 A 3 3 0 1 1 45 24.9 Z" />
  <path id="details_mouth" d="M 50 33 C 54 36 60 36 62 33" />
  <path id="details_plates" d="M 30 18 L 26 23 L 29 28 M 24 35 L 20 40 L 23 45" />
</svg>`
  },
  {
    id: "gingerbread",
    name: "Boneco de Natal",
    icon: "🧸",
    svg: `
<svg viewBox="0 0 100 100">
  <path id="outline" d="M 50 10 C 58 10 65 17 65 25 C 65 30 61 35 57 37 C 65 42 75 42 85 37 C 90 42 88 50 82 53 C 78 55 73 53 70 51 C 73 60 76 70 80 80 C 75 85 67 85 62 80 C 58 75 54 68 50 63 C 46 68 42 75 38 80 C 33 85 25 85 20 80 C 24 70 27 60 30 51 C 27 53 22 55 18 53 C 12 50 10 42 15 37 C 25 42 35 42 43 37 C 39 35 35 30 35 25 C 35 17 42 10 50 10 Z" />
  <path id="details_eye1" d="M 44 22 A 2 2 0 1 1 44 21.9 Z" />
  <path id="details_eye2" d="M 56 22 A 2 2 0 1 1 56 21.9 Z" />
  <path id="details_mouth" d="M 45 28 C 48 31 52 31 55 28" />
  <path id="details_button" d="M 50 46 A 2.5 2.5 0 1 1 50 45.9 Z" />
  <path id="details_button2" d="M 50 56 A 2.5 2.5 0 1 1 50 55.9 Z" />
</svg>`
  },
  {
    id: "heart",
    name: "Coração Amoroso",
    icon: "❤️",
    svg: `
<svg viewBox="0 0 100 100">
  <path id="outline" d="M 50 25 C 50 25 42 12 28 12 C 15 12 8 22 8 36 C 8 52 25 68 50 88 C 75 68 92 52 92 36 C 92 22 85 12 72 12 C 58 12 50 25 50 25 Z" />
  <path id="details_smile" d="M 38 42 C 43 45 47 45 52 42" />
  <path id="details_spark" d="M 72 26 L 76 30 M 76 26 L 72 30" />
</svg>`
  }
];

// --- 3D CANVAS SCENE COMPONENT ---
function CookieCutterScene({
  config,
  layers,
  outlinePoints,
  detailRibbonShapes,
  miterBracePoints,
}: {
  config: MakerConfig;
  layers: SVGPathLayer[];
  outlinePoints: THREE.Vector2[];
  detailRibbonShapes: { shape: THREE.Shape; isClosed: boolean }[];
  miterBracePoints: THREE.Vector2[];
}) {
  const { viewMode, materialColor, explodedView, showWireframe } = config;

  // 3D Extrusions (derived values in mm, scaled by 1/10 to map to Three units smoothly)
  const sc = 0.1; // Scale factor: 1 unit = 10mm

  // 1. CUTTER BLADE GEOMETRY
  const bladeGeom = useMemo(() => {
    if (outlinePoints.length === 0) return null;
    try {
      const shape = new THREE.Shape();
      const outerPts = getOffsetPoints(outlinePoints, config.wallThickness / 2);
      const innerPts = getOffsetPoints(outlinePoints, -config.wallThickness / 2);

      shape.moveTo(outerPts[0].x * sc, outerPts[0].y * sc);
      for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i].x * sc, outerPts[i].y * sc);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(innerPts[0].x * sc, innerPts[0].y * sc);
      for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i].x * sc, innerPts[i].y * sc);
      hole.closePath();
      shape.holes.push(hole);

      return new THREE.ExtrudeGeometry(shape, {
        depth: config.cutterHeight * sc,
        bevelEnabled: false,
      });
    } catch (e) {
      console.error("Erro ao gerar lâmina:", e);
      return null;
    }
  }, [outlinePoints, config.wallThickness, config.cutterHeight]);

  // 2. CUTTER BASE BRIM GEOMETRY (Support handle at bottom)
  const brimGeom = useMemo(() => {
    if (outlinePoints.length === 0) return null;
    try {
      const shape = new THREE.Shape();
      const outerPts = getOffsetPoints(outlinePoints, config.wallThickness / 2 + config.brimWidth);
      const innerPts = getOffsetPoints(outlinePoints, -config.wallThickness / 2);

      shape.moveTo(outerPts[0].x * sc, outerPts[0].y * sc);
      for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i].x * sc, outerPts[i].y * sc);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(innerPts[0].x * sc, innerPts[0].y * sc);
      for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i].x * sc, innerPts[i].y * sc);
      hole.closePath();
      shape.holes.push(hole);

      return new THREE.ExtrudeGeometry(shape, {
        depth: config.brimHeight * sc,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.01,
        bevelSegments: 2,
      });
    } catch (e) {
      console.error("Erro ao gerar aba:", e);
      return null;
    }
  }, [outlinePoints, config.wallThickness, config.brimWidth, config.brimHeight]);

  // 3. STAMP BACKING PLATE GEOMETRY
  const stampPlateGeom = useMemo(() => {
    if (outlinePoints.length === 0) return null;
    try {
      const shape = new THREE.Shape();
      // Clearance: offset inside the cutter blade
      const offsetAmount = - (config.wallThickness / 2) - config.clearance;
      const platePts = getOffsetPoints(outlinePoints, offsetAmount);

      shape.moveTo(platePts[0].x * sc, platePts[0].y * sc);
      for (let i = 1; i < platePts.length; i++) shape.lineTo(platePts[i].x * sc, platePts[i].y * sc);
      shape.closePath();

      return new THREE.ExtrudeGeometry(shape, {
        depth: config.stampPlateThickness * sc,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.015,
        bevelSegments: 3,
      });
    } catch (e) {
      console.error("Erro ao gerar placa do carimbo:", e);
      return null;
    }
  }, [outlinePoints, config.wallThickness, config.clearance, config.stampPlateThickness]);

  // 4. STAMP HANDLE GEOMETRY (Rear grip)
  const stampHandleGeom = useMemo(() => {
    if (!config.addHandle) return null;
    // A nice bar shape across the center
    const width = 2.4; // 24mm
    const depth = 0.8; // 8mm
    const height = config.handleHeight * sc;
    const geom = new THREE.BoxGeometry(width, depth, height);
    // Offset so it extrudes backwards from the back of the stamp plate
    geom.translate(0, 0, -height / 2);
    return geom;
  }, [config.addHandle, config.handleHeight]);

  // 5. STAMP DETAIL ENGRAVING LINES
  const detailsGeomList = useMemo(() => {
    return detailRibbonShapes.map(({ shape }) => {
      // Scale coordinates down to scene units
      const scaledShape = new THREE.Shape();
      scaledShape.moveTo(shape.currentPoint.x * sc, shape.currentPoint.y * sc);
      shape.curves.forEach(curve => {
        const p1 = curve.getPoint(0).multiplyScalar(sc);
        const p2 = curve.getPoint(1).multiplyScalar(sc);
        scaledShape.lineTo(p2.x, p2.y);
      });
      shape.holes.forEach(hole => {
        const scaledHole = new THREE.Path();
        scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
        hole.curves.forEach(curve => {
          const p2 = curve.getPoint(1).multiplyScalar(sc);
          scaledHole.lineTo(p2.x, p2.y);
        });
        scaledShape.holes.push(scaledHole);
      });

      return new THREE.ExtrudeGeometry(scaledShape, {
        depth: config.detailHeight * sc,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.007,
        bevelSegments: 2,
      });
    });
  }, [detailRibbonShapes, config.detailHeight]);

  // 6. COLORING BOARD BASE PLATE
  const coloringBaseGeom = useMemo(() => {
    if (outlinePoints.length === 0) return null;
    try {
      const shape = new THREE.Shape();
      shape.moveTo(outlinePoints[0].x * sc, outlinePoints[0].y * sc);
      for (let i = 1; i < outlinePoints.length; i++) shape.lineTo(outlinePoints[i].x * sc, outlinePoints[i].y * sc);
      shape.closePath();

      return new THREE.ExtrudeGeometry(shape, {
        depth: config.coloringBaseThickness * sc,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.02,
        bevelSegments: 3,
      });
    } catch (e) {
      console.error("Erro ao gerar base de pintura:", e);
      return null;
    }
  }, [outlinePoints, config.coloringBaseThickness]);

  // 7. COLORING BOARD ELEVATED BORDERS (Both outline & details)
  const coloringBordersGeomList = useMemo(() => {
    if (outlinePoints.length === 0) return [];
    
    const list: THREE.ExtrudeGeometry[] = [];
    
    // Add outline as a ribbon
    try {
      const outlineRibbon = createRibbonShapeFromPoints(outlinePoints, config.coloringLineWidth, true);
      const scaledShape = new THREE.Shape();
      scaledShape.moveTo(outlineRibbon.currentPoint.x * sc, outlineRibbon.currentPoint.y * sc);
      outlineRibbon.curves.forEach(curve => {
        const p2 = curve.getPoint(1).multiplyScalar(sc);
        scaledShape.lineTo(p2.x, p2.y);
      });
      outlineRibbon.holes.forEach(hole => {
        const scaledHole = new THREE.Path();
        scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
        hole.curves.forEach(curve => {
          const p2 = curve.getPoint(1).multiplyScalar(sc);
          scaledHole.lineTo(p2.x, p2.y);
        });
        scaledShape.holes.push(scaledHole);
      });

      list.push(new THREE.ExtrudeGeometry(scaledShape, {
        depth: config.coloringLineHeight * sc,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.007,
        bevelSegments: 2,
      }));
    } catch (e) {}

    // Add detail ribbons
    detailRibbonShapes.forEach(({ shape }) => {
      try {
        const scaledShape = new THREE.Shape();
        scaledShape.moveTo(shape.currentPoint.x * sc, shape.currentPoint.y * sc);
        shape.curves.forEach(curve => {
          const p2 = curve.getPoint(1).multiplyScalar(sc);
          scaledShape.lineTo(p2.x, p2.y);
        });
        shape.holes.forEach(hole => {
          const scaledHole = new THREE.Path();
          scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
          hole.curves.forEach(curve => {
            const p2 = curve.getPoint(1).multiplyScalar(sc);
            scaledHole.lineTo(p2.x, p2.y);
          });
          scaledShape.holes.push(scaledHole);
        });

        list.push(new THREE.ExtrudeGeometry(scaledShape, {
          depth: config.coloringLineHeight * sc,
          bevelEnabled: true,
          bevelThickness: 0.015,
          bevelSize: 0.007,
          bevelSegments: 2,
        }));
      } catch (e) {}
    });

    return list;
  }, [outlinePoints, detailRibbonShapes, config.coloringLineHeight, config.coloringLineWidth]);

  // Rotates scene to lay flat on XY grid with Z pointing UP
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      
      {/* 3D GRIDS AND GROUND INDICATORS */}
      <Grid 
        renderOrder={-1} 
        position={[0, 0, -0.01]} 
        args={[15, 15]} 
        cellSize={0.5} 
        cellThickness={0.5} 
        cellColor="#1a1a1a" 
        sectionSize={2.5} 
        sectionThickness={1.0} 
        sectionColor="#2a2a2a" 
        fadeDistance={20} 
      />

      {/* --- RENDER OPTION 1: CUTTER & STAMP ASSEMBLED / SPLIT --- */}
      {viewMode === "cutter_stamp" && (
        <>
          {/* Cutter: placed flat on the print bed */}
          <group name="cutter_mesh_group">
            {bladeGeom && (
              <mesh geometry={bladeGeom} castShadow receiveShadow>
                <meshStandardMaterial 
                  color={materialColor} 
                  roughness={0.25} 
                  metalness={0.08} 
                  wireframe={showWireframe}
                  transparent
                  opacity={0.95}
                />
              </mesh>
            )}
            {brimGeom && (
              <mesh geometry={brimGeom} castShadow receiveShadow>
                <meshStandardMaterial 
                  color={materialColor} 
                  roughness={0.25} 
                  metalness={0.08} 
                  wireframe={showWireframe} 
                />
              </mesh>
            )}
          </group>

          {/* Stamp: shifted up according to the Exploded View slider */}
          {/* Base Z is at stampPlateThickness. Z height is separated by explodedView offset */}
          <group 
            name="stamp_mesh_group" 
            position={[0, 0, (config.cutterHeight + 5) * sc * explodedView]}
          >
            {/* The backing plate, flipped slightly or kept on top */}
            {stampPlateGeom && (
              <mesh geometry={stampPlateGeom} castShadow receiveShadow position={[0, 0, 0.05]}>
                <meshStandardMaterial 
                  color={materialColor} 
                  roughness={0.3} 
                  metalness={0.1} 
                  wireframe={showWireframe} 
                  emissive={materialColor}
                  emissiveIntensity={0.05}
                />
              </mesh>
            )}

            {/* Rear handle on back of the stamp plate */}
            {stampHandleGeom && (
              <mesh geometry={stampHandleGeom} castShadow receiveShadow position={[0, 0, 0.05]}>
                <meshStandardMaterial 
                  color={materialColor} 
                  roughness={0.3} 
                  metalness={0.1} 
                  wireframe={showWireframe} 
                />
              </mesh>
            )}

            {/* Raised stamp detail engraving ridges (starting on top of stamp plate) */}
            {detailsGeomList.map((geom, idx) => (
              <mesh 
                key={`stamp-detail-${idx}`} 
                geometry={geom} 
                castShadow 
                receiveShadow 
                position={[0, 0, config.stampPlateThickness * sc + 0.05]}
              >
                <meshStandardMaterial 
                  color={materialColor} 
                  roughness={0.2} 
                  metalness={0.15} 
                  wireframe={showWireframe} 
                  emissive={materialColor}
                  emissiveIntensity={0.12}
                />
              </mesh>
            ))}
          </group>
        </>
      )}

      {/* --- RENDER OPTION 2: CUTTER ONLY --- */}
      {viewMode === "cutter_only" && (
        <group name="cutter_mesh_group">
          {bladeGeom && (
            <mesh geometry={bladeGeom} castShadow receiveShadow>
              <meshStandardMaterial 
                color={materialColor} 
                roughness={0.25} 
                metalness={0.08} 
                wireframe={showWireframe} 
              />
            </mesh>
          )}
          {brimGeom && (
            <mesh geometry={brimGeom} castShadow receiveShadow>
              <meshStandardMaterial 
                color={materialColor} 
                roughness={0.25} 
                metalness={0.08} 
                wireframe={showWireframe} 
              />
            </mesh>
          )}
        </group>
      )}

      {/* --- RENDER OPTION 3: STAMP ONLY --- */}
      {viewMode === "stamp_only" && (
        <group name="stamp_mesh_group">
          {stampPlateGeom && (
            <mesh geometry={stampPlateGeom} castShadow receiveShadow>
              <meshStandardMaterial 
                color={materialColor} 
                roughness={0.3} 
                metalness={0.1} 
                wireframe={showWireframe} 
              />
            </mesh>
          )}
          {stampHandleGeom && (
            <mesh geometry={stampHandleGeom} castShadow receiveShadow>
              <meshStandardMaterial 
                color={materialColor} 
                roughness={0.3} 
                metalness={0.1} 
                wireframe={showWireframe} 
              />
            </mesh>
          )}
          {detailsGeomList.map((geom, idx) => (
            <mesh 
              key={`stamp-only-detail-${idx}`} 
              geometry={geom} 
              castShadow 
              receiveShadow 
              position={[0, 0, config.stampPlateThickness * sc]}
            >
              <meshStandardMaterial 
                color={materialColor} 
                roughness={0.2} 
                metalness={0.15} 
                wireframe={showWireframe} 
              />
            </mesh>
          ))}
        </group>
      )}

      {/* --- RENDER OPTION 4: COLORING BOARD (Pintar / Colorir) --- */}
      {/* High-contrast coloring plate: white backing plate, charcoal black outline lines! */}
      {viewMode === "coloring_plate" && (
        <group name="coloring_plate_mesh_group">
          {coloringBaseGeom && (
            <mesh geometry={coloringBaseGeom} castShadow receiveShadow>
              <meshStandardMaterial 
                color="#fbfbfb" // Pristine white plastic / drawing board
                roughness={0.35} 
                metalness={0.02} 
                wireframe={showWireframe} 
              />
            </mesh>
          )}
          {coloringBordersGeomList.map((geom, idx) => (
            <mesh 
              key={`coloring-border-${idx}`} 
              geometry={geom} 
              castShadow 
              receiveShadow 
              position={[0, 0, config.coloringBaseThickness * sc]}
            >
              <meshStandardMaterial 
                color="#121214" // Solid charcoal black details
                roughness={0.15} 
                metalness={0.2} 
                wireframe={showWireframe} 
                emissive="#000000"
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export default function CookieCutterMaker() {
  // --- STATE MANAGEMENT ---
  const [activePresetId, setActivePresetId] = useState<string>("duck");
  const [projectName, setProjectName] = useState<string>("MEU CORTADOR");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"geral" | "cutter" | "stamp" | "coloring" | "biblioteca">("geral");

  // Configuration sliders with high-utility default settings for watertight 3D printing
  const [config, setConfig] = useState<MakerConfig>({
    size: 75,
    cutterHeight: 14,
    wallThickness: 0.8,
    brimWidth: 4.0,
    brimHeight: 2.0,
    stampPlateThickness: 2.0,
    clearance: 1.2,
    detailHeight: 1.5,
    detailThickness: 1.2,
    addHandle: true,
    handleHeight: 10,
    coloringBaseThickness: 3.0,
    coloringLineHeight: 1.6,
    coloringLineWidth: 1.2,
    materialColor: "#ff5722", // Bright orange PLA
    viewMode: "cutter_stamp",
    explodedView: 0.25,
    showWireframe: false
  });

  // Vector layers parsed from SVG
  const [layers, setLayers] = useState<SVGPathLayer[]>([]);
  
  // Local project list stored in localStorage
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

  // Hidden file upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- POP ALERT BANNER ---
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // --- COMPUTE LAYER SHAPES & NORMALIZATION ---
  // Calculates combined bounding box of layers to center and scale them perfectly to config.size
  const normalizedLayers = useMemo(() => {
    if (layers.length === 0) return [];

    // 1. Compute collective bounding box for layers classified as "cutter" (or fallback to all if none)
    const activeLayers = layers.filter(l => l.type !== "ignore");
    if (activeLayers.length === 0) return [];

    const cutterLayers = activeLayers.filter(l => l.type === "cutter");
    const targetBoundsLayers = cutterLayers.length > 0 ? cutterLayers : activeLayers;

    const box = new THREE.Box2();
    targetBoundsLayers.forEach(layer => {
      layer.points.forEach(pt => box.expandByPoint(pt));
    });

    const sizeX = box.max.x - box.min.x;
    const sizeY = box.max.y - box.min.y;
    const center = new THREE.Vector2((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2);
    const maxDimension = Math.max(sizeX, sizeY);

    if (maxDimension <= 0) return layers;

    // 2. Scale factor so the largest dimension is exactly config.size in millimeters
    const scaleFactor = config.size / maxDimension;

    // 3. Return layers with centered and scaled points
    return layers.map(layer => {
      const normalizedPts = layer.points.map(pt => {
        // Shift to origin, scale, and flip Y-axis for standard 3D printers coordinate systems
        return new THREE.Vector2()
          .subVectors(pt, center)
          .multiplyScalar(scaleFactor)
          .multiply(new THREE.Vector2(1, -1)); // Flip Y so standard SVG rendering aligns with ThreeJS
      });

      return {
        ...layer,
        points: normalizedPts
      };
    });
  }, [layers, config.size]);

  // Combined outline coordinates for extrusion (single closed loop for outer wall cutter)
  const outlinePoints = useMemo(() => {
    const cutterLayer = normalizedLayers.find(l => l.type === "cutter");
    if (cutterLayer) return cutterLayer.points;

    // Fallback: Use the layer with the largest bounding box area
    if (normalizedLayers.length === 0) return [];
    let largestLayer = normalizedLayers[0];
    let maxArea = -1;

    normalizedLayers.forEach(layer => {
      if (layer.type === "ignore") return;
      const b = new THREE.Box2();
      layer.points.forEach(pt => b.expandByPoint(pt));
      const area = (b.max.x - b.min.x) * (b.max.y - b.min.y);
      if (area > maxArea) {
        maxArea = area;
        largestLayer = layer;
      }
    });
    return largestLayer.points;
  }, [normalizedLayers]);

  // Convert "stamp" layers to Ribbon shapes
  const detailRibbonShapes = useMemo(() => {
    const stampLayers = normalizedLayers.filter(l => l.type === "stamp");
    return stampLayers.map(layer => {
      const shape = createRibbonShapeFromPoints(layer.points, config.detailThickness, layer.isClosed);
      return {
        shape,
        isClosed: layer.isClosed
      };
    });
  }, [normalizedLayers, config.detailThickness]);

  // --- PARSE SVG STRINGS INTO GEOMETRIES ---
  const parseSVGContent = (svgText: string) => {
    try {
      const loader = new SVGLoader();
      const svgData = loader.parse(svgText);
      
      if (!svgData || !svgData.paths || svgData.paths.length === 0) {
        setErrorMsg("Não foi possível encontrar nenhum caminho vetorial (path) no SVG.");
        return;
      }

      const parsedLayers: SVGPathLayer[] = [];

      svgData.paths.forEach((pathObj, pathIdx) => {
        const node = pathObj.userData?.node as any;
        const nodeId = node ? (node.getAttribute("id") || node.getAttribute("class") || `path-${pathIdx}`) : `path-${pathIdx}`;
        
        pathObj.subPaths.forEach((subPath, subIdx) => {
          // Get fine-sampled points for high resolution curves
          const pts = subPath.getPoints(45);
          if (pts.length < 2) return;

          // Check if closed
          const startPt = pts[0];
          const endPt = pts[pts.length - 1];
          const isClosed = startPt.distanceTo(endPt) < 0.1;

          // Calculate total length
          let pathLen = 0;
          for (let i = 0; i < pts.length - 1; i++) {
            pathLen += pts[i].distanceTo(pts[i + 1]);
          }

          parsedLayers.push({
            id: `${nodeId}-${subIdx}`,
            name: `${nodeId.toUpperCase()} (Parte ${subIdx + 1})`,
            type: "stamp", // Default fallback
            points: pts,
            isClosed,
            length: pathLen
          });
        });
      });

      if (parsedLayers.length === 0) {
        setErrorMsg("Nenhuma linha ou curva válida foi encontrada.");
        return;
      }

      // Auto-classify: The layer with the largest bounding box gets designated as "cutter" outline,
      // all other layers are assigned as "stamp" details!
      let largestIdx = 0;
      let maxArea = -1;

      parsedLayers.forEach((layer, idx) => {
        const b = new THREE.Box2();
        layer.points.forEach(pt => b.expandByPoint(pt));
        const area = (b.max.x - b.min.x) * (b.max.y - b.min.y);
        if (area > maxArea) {
          maxArea = area;
          largestIdx = idx;
        }
      });

      parsedLayers.forEach((layer, idx) => {
        layer.type = idx === largestIdx ? "cutter" : "stamp";
      });

      setLayers(parsedLayers);
      setErrorMsg("");
    } catch (err) {
      console.error(err);
      setErrorMsg("Falha ao analisar o arquivo SVG. Certifique-se de que é um formato válido.");
    }
  };

  // Load preset SVG on start or preset click
  useEffect(() => {
    const preset = PRESETS.find(p => p.id === activePresetId);
    if (preset) {
      parseSVGContent(preset.svg);
    }
  }, [activePresetId]);

  // Load library from localstorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cookie_cutter_projects");
      if (stored) {
        setSavedProjects(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  // --- SVG UPLOAD HANDLER ---
  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProjectName(file.name.replace(/\.svg$/i, "").toUpperCase());
    setActivePresetId(""); // Clear active preset tag

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseSVGContent(text);
      triggerSuccess("Desenho SVG importado com sucesso!");
    };
    reader.readAsText(file);
  };

  // --- LAYER TOGGLES ---
  const toggleLayerType = (layerId: string, newType: "cutter" | "stamp" | "ignore") => {
    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      return { ...l, type: newType };
    }));
  };

  // --- SAVE CURRENT PROJECT TO LOCAL LIBRARY ---
  const handleSaveToLibrary = () => {
    if (layers.length === 0) return;

    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      name: projectName || "CORTADOR SEM NOME",
      savedAt: new Date().toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      presetId: activePresetId,
      config: { ...config },
      layers: [...layers]
    };

    const updated = [newProject, ...savedProjects];
    setSavedProjects(updated);
    localStorage.setItem("cookie_cutter_projects", JSON.stringify(updated));
    triggerSuccess("Cortador salvo na biblioteca com sucesso!");
  };

  // --- DELETE PROJECT FROM LIBRARY ---
  const handleDeleteProject = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedProjects.filter(p => p.id !== projId);
    setSavedProjects(updated);
    localStorage.setItem("cookie_cutter_projects", JSON.stringify(updated));
    triggerSuccess("Cortador removido da biblioteca.");
  };

  // --- LOAD PROJECT FROM LIBRARY ---
  const handleLoadProject = (proj: SavedProject) => {
    setProjectName(proj.name);
    setActivePresetId(proj.presetId);
    setConfig(proj.config);
    setLayers(proj.layers);
    triggerSuccess(`Projeto "${proj.name}" carregado!`);
  };

  // --- STL EXPORT MODULE ---
  const exportToSTL = (target: "cutter" | "stamp" | "coloring_plate" | "all") => {
    // Construct a temporary ThreeJS scene specifically for watertight STL export
    const exportScene = new THREE.Scene();
    const sc = 0.1; // scale factor to translate mm to Three units

    // Helper to generate extrusions exactly like in the preview scene
    const buildCutterMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });

      if (outlinePoints.length > 0) {
        // Blade
        const wallShape = new THREE.Shape();
        const outerWallPts = getOffsetPoints(outlinePoints, config.wallThickness / 2);
        const innerWallPts = getOffsetPoints(outlinePoints, -config.wallThickness / 2);

        wallShape.moveTo(outerWallPts[0].x * sc, outerWallPts[0].y * sc);
        for (let i = 1; i < outerWallPts.length; i++) wallShape.lineTo(outerWallPts[i].x * sc, outerWallPts[i].y * sc);
        wallShape.closePath();

        const hole = new THREE.Path();
        hole.moveTo(innerWallPts[0].x * sc, innerWallPts[0].y * sc);
        for (let i = 1; i < innerWallPts.length; i++) hole.lineTo(innerWallPts[i].x * sc, innerWallPts[i].y * sc);
        hole.closePath();
        wallShape.holes.push(hole);

        const bladeGeom = new THREE.ExtrudeGeometry(wallShape, { depth: config.cutterHeight * sc, bevelEnabled: false });
        meshes.push(new THREE.Mesh(bladeGeom, mat));

        // Brim
        const brimShape = new THREE.Shape();
        const outerBrimPts = getOffsetPoints(outlinePoints, config.wallThickness / 2 + config.brimWidth);
        brimShape.moveTo(outerBrimPts[0].x * sc, outerBrimPts[0].y * sc);
        for (let i = 1; i < outerBrimPts.length; i++) brimShape.lineTo(outerBrimPts[i].x * sc, outerBrimPts[i].y * sc);
        brimShape.closePath();
        brimShape.holes.push(hole); // share same hole contour

        const brimGeom = new THREE.ExtrudeGeometry(brimShape, { depth: config.brimHeight * sc, bevelEnabled: false });
        meshes.push(new THREE.Mesh(brimGeom, mat));
      }
      return meshes;
    };

    const buildStampMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });

      if (outlinePoints.length > 0) {
        // Stamp plate
        const shape = new THREE.Shape();
        const offsetAmount = - (config.wallThickness / 2) - config.clearance;
        const platePts = getOffsetPoints(outlinePoints, offsetAmount);

        shape.moveTo(platePts[0].x * sc, platePts[0].y * sc);
        for (let i = 1; i < platePts.length; i++) shape.lineTo(platePts[i].x * sc, platePts[i].y * sc);
        shape.closePath();

        const plateGeom = new THREE.ExtrudeGeometry(shape, { depth: config.stampPlateThickness * sc, bevelEnabled: false });
        meshes.push(new THREE.Mesh(plateGeom, mat));

        // Rear Handle
        if (config.addHandle) {
          const width = 2.4;
          const depth = 0.8;
          const height = config.handleHeight * sc;
          const handleGeom = new THREE.BoxGeometry(width, depth, height);
          handleGeom.translate(0, 0, -height / 2);
          meshes.push(new THREE.Mesh(handleGeom, mat));
        }

        // Details
        detailRibbonShapes.forEach(({ shape: ribbonShape }) => {
          const scaledShape = new THREE.Shape();
          scaledShape.moveTo(ribbonShape.currentPoint.x * sc, ribbonShape.currentPoint.y * sc);
          ribbonShape.curves.forEach(curve => {
            const p2 = curve.getPoint(1).multiplyScalar(sc);
            scaledShape.lineTo(p2.x, p2.y);
          });
          ribbonShape.holes.forEach(hole => {
            const scaledHole = new THREE.Path();
            scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
            hole.curves.forEach(curve => {
              const p2 = curve.getPoint(1).multiplyScalar(sc);
              scaledHole.lineTo(p2.x, p2.y);
            });
            scaledShape.holes.push(scaledHole);
          });

          const detGeom = new THREE.ExtrudeGeometry(scaledShape, { depth: config.detailHeight * sc, bevelEnabled: false });
          // Align Z on top of stamp plate
          detGeom.translate(0, 0, config.stampPlateThickness * sc);
          meshes.push(new THREE.Mesh(detGeom, mat));
        });
      }
      return meshes;
    };

    const buildColoringPlateMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });

      if (outlinePoints.length > 0) {
        // Base plate
        const baseShape = new THREE.Shape();
        baseShape.moveTo(outlinePoints[0].x * sc, outlinePoints[0].y * sc);
        for (let i = 1; i < outlinePoints.length; i++) baseShape.lineTo(outlinePoints[i].x * sc, outlinePoints[i].y * sc);
        baseShape.closePath();

        const baseGeom = new THREE.ExtrudeGeometry(baseShape, { depth: config.coloringBaseThickness * sc, bevelEnabled: false });
        meshes.push(new THREE.Mesh(baseGeom, mat));

        // Outlines
        try {
          const outlineRibbon = createRibbonShapeFromPoints(outlinePoints, config.coloringLineWidth, true);
          const scaledShape = new THREE.Shape();
          scaledShape.moveTo(outlineRibbon.currentPoint.x * sc, outlineRibbon.currentPoint.y * sc);
          outlineRibbon.curves.forEach(curve => {
            const p2 = curve.getPoint(1).multiplyScalar(sc);
            scaledShape.lineTo(p2.x, p2.y);
          });
          outlineRibbon.holes.forEach(hole => {
            const scaledHole = new THREE.Path();
            scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
            hole.curves.forEach(curve => {
              const p2 = curve.getPoint(1).multiplyScalar(sc);
              scaledHole.lineTo(p2.x, p2.y);
            });
            scaledShape.holes.push(scaledHole);
          });

          const outGeom = new THREE.ExtrudeGeometry(scaledShape, { depth: config.coloringLineHeight * sc, bevelEnabled: false });
          outGeom.translate(0, 0, config.coloringBaseThickness * sc);
          meshes.push(new THREE.Mesh(outGeom, mat));
        } catch (e) {}

        // Detail curves
        detailRibbonShapes.forEach(({ shape: ribbonShape }) => {
          try {
            const scaledShape = new THREE.Shape();
            scaledShape.moveTo(ribbonShape.currentPoint.x * sc, ribbonShape.currentPoint.y * sc);
            ribbonShape.curves.forEach(curve => {
              const p2 = curve.getPoint(1).multiplyScalar(sc);
              scaledShape.lineTo(p2.x, p2.y);
            });
            ribbonShape.holes.forEach(hole => {
              const scaledHole = new THREE.Path();
              scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
              hole.curves.forEach(curve => {
                const p2 = curve.getPoint(1).multiplyScalar(sc);
                scaledHole.lineTo(p2.x, p2.y);
              });
              scaledShape.holes.push(scaledHole);
            });

            const detGeom = new THREE.ExtrudeGeometry(scaledShape, { depth: config.coloringLineHeight * sc, bevelEnabled: false });
            detGeom.translate(0, 0, config.coloringBaseThickness * sc);
            meshes.push(new THREE.Mesh(detGeom, mat));
          } catch (e) {}
        });
      }
      return meshes;
    };

    // Build targeted components
    if (target === "cutter" || target === "all") {
      const cutterGroup = new THREE.Group();
      cutterGroup.name = "cutter";
      buildCutterMeshes().forEach(mesh => cutterGroup.add(mesh));
      // Position on bed
      exportScene.add(cutterGroup);
    }
    if (target === "stamp" || target === "all") {
      const stampGroup = new THREE.Group();
      stampGroup.name = "stamp";
      buildStampMeshes().forEach(mesh => stampGroup.add(mesh));
      // If exporting 'all' unmerged, offset stamp side by side
      if (target === "all") {
        stampGroup.position.x = (config.size / 10) + 1.5;
      }
      exportScene.add(stampGroup);
    }
    if (target === "coloring_plate") {
      const coloringGroup = new THREE.Group();
      coloringGroup.name = "coloring_plate";
      buildColoringPlateMeshes().forEach(mesh => coloringGroup.add(mesh));
      exportScene.add(coloringGroup);
    }

    // Export scene to STL
    try {
      const exporter = new STLExporter();
      const options = { binary: true };
      const output = exporter.parse(exportScene, options);
      
      const slugifiedName = (projectName || "cortador")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_+|_+$)/g, "");

      const fileName = `${slugifiedName}_${target}.stl`;
      const blob = new Blob([output], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerSuccess(`Arquivo STL "${fileName}" gerado com sucesso!`);
    } catch (e) {
      console.error(e);
      setErrorMsg("Erro ao compilar modelo 3D para STL.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 space-y-8 font-sans bg-[#080808] text-white">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00E5FF] animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono font-extrabold text-[#00E5FF]">BISCOITO CUT MAKER</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Gerador de Cortadores de Biscoito 3D
          </h1>
          <p className="text-xs text-zinc-500 max-w-xl">
            Crie cortadores e carimbos personalizados a partir de arquivos SVG. Ajuste espessuras, alturas de corte, folgas e crie placas decorativas para imprimir e colorir!
          </p>
        </div>

        {/* Input Name Plate */}
        <div className="flex items-center gap-2 w-full md:w-auto bg-[#0d0d0d] p-1 border border-zinc-900 rounded-lg">
          <input 
            type="text" 
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-black/40 text-[11px] font-bold uppercase tracking-wider px-3 py-2 border-0 outline-none focus:ring-1 focus:ring-[#00E5FF] rounded text-white w-full md:w-[180px]"
            placeholder="Nome do Projeto..."
          />
          <button 
            onClick={handleSaveToLibrary}
            className="p-2 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/25 border border-[#00E5FF]/30 rounded transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Salvar Projeto na Biblioteca"
          >
            <Save className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* POPUP MESSAGES */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[#0d0d0d] border-2 border-emerald-500/50 text-emerald-400 font-mono text-[10px] uppercase font-black tracking-wider py-3.5 px-6 rounded-lg shadow-[0_4px_30px_rgba(16,185,129,0.15)] flex items-center gap-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: 3D REAL-TIME VIEWPORT (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* Real-time 3D Viewport Box */}
          <div className="relative aspect-[4/3] w-full bg-[#0d0d0d] border border-zinc-900 rounded-lg overflow-hidden shadow-2xl flex flex-col justify-between">
            
            {/* Viewport header tags */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur border border-zinc-800/80 px-2.5 py-1 rounded font-mono text-[8.5px] text-zinc-400">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
              <span>VISUALIZADOR 3D INTERATIVO (ESC. 10:1)</span>
            </div>

            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
              <button
                onClick={() => setConfig(prev => ({ ...prev, showWireframe: !prev.showWireframe }))}
                className={`p-1.5 rounded backdrop-blur text-[8.5px] font-mono border transition-all cursor-pointer ${
                  config.showWireframe 
                    ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/40" 
                    : "bg-black/60 text-zinc-400 border-zinc-800"
                }`}
              >
                WIREFRAME
              </button>
            </div>

            {/* THREE.JS CANVAS */}
            <div className="w-full h-full">
              <Canvas 
                orthographic 
                camera={{ zoom: 14, position: [0, 0, 35] }} 
                shadows
              >
                <ambientLight intensity={1.4} />
                <directionalLight 
                  position={[15, 20, 25]} 
                  intensity={2.0} 
                  castShadow 
                  shadow-mapSize-width={1024} 
                  shadow-mapSize-height={1024} 
                />
                <pointLight position={[-15, -15, 20]} intensity={0.4} />
                
                <CookieCutterScene 
                  config={config} 
                  layers={normalizedLayers} 
                  outlinePoints={outlinePoints}
                  detailRibbonShapes={detailRibbonShapes}
                  miterBracePoints={[]}
                />

                <OrbitControls 
                  enableDamping 
                  dampingFactor={0.05} 
                  maxPolarAngle={Math.PI / 1.8} 
                  minZoom={8}
                  maxZoom={32}
                />
              </Canvas>
            </div>

            {/* Viewport bottom controls HUD */}
            <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 bg-black/85 backdrop-blur border border-zinc-900/90 p-3 rounded-md">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex flex-col">
                  <span className="text-[8.5px] font-mono text-[#00E5FF] uppercase tracking-widest block font-extrabold">Vista Explodida (Folga Visual)</span>
                  <span className="text-[7px] text-zinc-500 uppercase">Arraste para separar o carimbo</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1.5" 
                  step="0.05"
                  value={config.explodedView}
                  disabled={config.viewMode !== "cutter_stamp"}
                  onChange={(e) => setConfig(prev => ({ ...prev, explodedView: parseFloat(e.target.value) }))}
                  className="w-24 sm:w-32 accent-[#00E5FF] cursor-pointer disabled:opacity-30"
                />
                <span className="text-[9px] font-mono text-[#00E5FF] font-black">{Math.round(config.explodedView * 100)}%</span>
              </div>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, explodedView: 0 }))}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-1.5 rounded cursor-pointer"
                  title="Unir Peças"
                  disabled={config.viewMode !== "cutter_stamp"}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE SELECTION BUTTONS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#09090b] border border-zinc-900 p-1.5 rounded-lg">
            <button
              onClick={() => setConfig(prev => ({ ...prev, viewMode: "cutter_stamp" }))}
              className={`py-2.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                config.viewMode === "cutter_stamp"
                  ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/40 shadow-lg shadow-[#00E5FF]/5"
                  : "bg-black/35 text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>Cortador + Carimbo</span>
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, viewMode: "cutter_only" }))}
              className={`py-2.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                config.viewMode === "cutter_only"
                  ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/40 shadow-lg shadow-[#00E5FF]/5"
                  : "bg-black/35 text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>Apenas Cortador</span>
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, viewMode: "stamp_only" }))}
              className={`py-2.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                config.viewMode === "stamp_only"
                  ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/40 shadow-lg shadow-[#00E5FF]/5"
                  : "bg-black/35 text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>Apenas Carimbo</span>
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, viewMode: "coloring_plate" }))}
              className={`py-2.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                config.viewMode === "coloring_plate"
                  ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/40 shadow-lg shadow-[#00E5FF]/5"
                  : "bg-black/35 text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
              }`}
              title="Perfeito para criar placas de pintura de plástico para crianças"
            >
              <Palette className="w-4 h-4" />
              <span>Placa de Pintar 🎨</span>
            </button>
          </div>

          {/* 3D STL PRINT DOWNLOADING AREA */}
          <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#00E5FF]" />
              <span>Ficheiros para Impressão 3D (STL)</span>
            </h3>
            <p className="text-[11px] text-zinc-500">
              Todos os modelos são exportados como ficheiros STL estanques (watertight), perfeitamente limpos e compatíveis com qualquer fatiador de impressão 3D (Cura, Bambu Studio, PrusaSlicer, Orca, etc).
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {config.viewMode === "coloring_plate" ? (
                <button
                  onClick={() => exportToSTL("coloring_plate")}
                  className="sm:col-span-3 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Placa de Pintar 3D (.STL)</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => exportToSTL("cutter")}
                    className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Cortador (.STL)</span>
                  </button>
                  <button
                    onClick={() => exportToSTL("stamp")}
                    className="py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Carimbo (.STL)</span>
                  </button>
                  <button
                    onClick={() => exportToSTL("all")}
                    className="py-2.5 px-3 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 rounded font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Ambos Lado a Lado</span>
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: CONTROLS & SVG VECTORS (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* CONTROL TABS */}
          <div className="flex bg-[#0c0c0e] border border-zinc-900 rounded-lg p-1">
            {(["geral", "cutter", "stamp", "coloring", "biblioteca"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded text-[9.5px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-[#00E5FF]/10 text-[#00E5FF]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB 1: GERAL (PRESETS & UPLOAD) */}
          {activeTab === "geral" && (
            <div className="space-y-6">
              
              {/* SVG IMPORT DROPZONE */}
              <div className="bg-[#0c0c0e] border-2 border-dashed border-zinc-800 hover:border-[#00E5FF]/45 p-6 rounded-lg text-center transition-colors relative group">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".svg"
                  onChange={handleSvgUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <Upload className="w-8 h-8 text-zinc-500 group-hover:text-[#00E5FF] mx-auto mb-3 transition-colors" />
                <span className="block text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">
                  Fazer Upload de SVG Próprio
                </span>
                <span className="block text-[10px] text-zinc-500 mt-1 font-mono">
                  Arraste ou clique para selecionar (.svg)
                </span>
              </div>

              {/* QUICK ACCESSIBLE PRESETS */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Modelos Rápidos (Presets)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePresetId(p.id);
                        setProjectName(p.name.toUpperCase());
                        triggerSuccess(`Preset "${p.name}" carregado!`);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        activePresetId === p.id
                          ? "bg-[#00E5FF]/5 border-[#00E5FF]/30 text-white shadow-lg shadow-[#00E5FF]/2"
                          : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      <span className="text-xl">{p.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate leading-tight">{p.name}</span>
                        <span className="text-[9px] text-zinc-500 uppercase leading-none mt-0.5">Vetor limpo</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* OVERALL SLIDER: SIZE */}
              <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-900/50 pb-2">
                  <span className="text-[10px] font-black tracking-widest uppercase text-zinc-400">Dimensões do Biscoito</span>
                  <span className="text-[11px] font-mono text-[#00E5FF] font-bold">{config.size} mm</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Largura Máxima (mm)</span>
                    <span>40mm - 120mm</span>
                  </div>
                  <input 
                    type="range" 
                    min="40" 
                    max="120" 
                    value={config.size}
                    onChange={(e) => setConfig(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                    className="w-full accent-[#00E5FF] cursor-pointer"
                  />
                  <p className="text-[9.5px] text-zinc-500 italic">
                    *Gera automaticamente uma proporção perfeita e normalizada baseada no maior eixo do vetor de entrada.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-black tracking-widest uppercase text-zinc-400 block mb-2">Cor do PLA (Filamento)</span>
                  <div className="flex gap-2">
                    {["#ff5722", "#4caf50", "#2196f3", "#9c27b0", "#e91e63", "#ffeb3b", "#795548"].map((color) => (
                      <button
                        key={color}
                        onClick={() => setConfig(prev => ({ ...prev, materialColor: color }))}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                          config.materialColor === color ? "border-white scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CUTTER (CORTADOR SPECIFIC) */}
          {activeTab === "cutter" && (
            <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                <Scissors className="w-4 h-4 text-[#00E5FF]" />
                <span>Geometria da Lâmina de Corte</span>
              </h3>

              {/* SLIDER: HEIGHT */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Altura da Lâmina (Z)</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.cutterHeight} mm</span>
                </div>
                <input 
                  type="range" 
                  min="8" 
                  max="20" 
                  step="0.5"
                  value={config.cutterHeight}
                  onChange={(e) => setConfig(prev => ({ ...prev, cutterHeight: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
                <span className="block text-[9px] text-zinc-500 uppercase">Espessura padrão para massas altas: 14mm</span>
              </div>

              {/* SLIDER: WALL THICKNESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Espessura do Fio de Corte</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.wallThickness} mm</span>
                </div>
                <input 
                  type="range" 
                  min="0.6" 
                  max="1.6" 
                  step="0.1"
                  value={config.wallThickness}
                  onChange={(e) => setConfig(prev => ({ ...prev, wallThickness: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
                <span className="block text-[9px] text-zinc-500 uppercase">Ideal para bicos 0.4mm: 0.8mm (duas paredes)</span>
              </div>

              {/* SLIDER: BRIM WIDTH */}
              <div className="space-y-2 border-t border-zinc-950 pt-4">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Largura da Aba de Apoio</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.brimWidth} mm</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="6" 
                  step="0.5"
                  value={config.brimWidth}
                  onChange={(e) => setConfig(prev => ({ ...prev, brimWidth: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
                <span className="block text-[9px] text-zinc-500 uppercase">Aba de apoio confortável para pressionar a mão</span>
              </div>

              {/* SLIDER: BRIM HEIGHT */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Altura da Aba de Apoio</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.brimHeight} mm</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="4" 
                  step="0.5"
                  value={config.brimHeight}
                  onChange={(e) => setConfig(prev => ({ ...prev, brimHeight: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

            </div>
          )}

          {/* TAB 3: STAMP (CARIMBO SPECIFIC) */}
          {activeTab === "stamp" && (
            <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                <Hammer className="w-4 h-4 text-[#00E5FF]" />
                <span>Geometria do Carimbo (Massa)</span>
              </h3>

              {/* SLIDER: STAMP PLATE THICKNESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Espessura da Placa Base</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.stampPlateThickness} mm</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="4.0" 
                  step="0.5"
                  value={config.stampPlateThickness}
                  onChange={(e) => setConfig(prev => ({ ...prev, stampPlateThickness: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

              {/* SLIDER: DETAIL RIDGES HEIGHT */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Altura das Linhas de Gravação</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.detailHeight} mm</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="4.0" 
                  step="0.2"
                  value={config.detailHeight}
                  onChange={(e) => setConfig(prev => ({ ...prev, detailHeight: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
                <span className="block text-[9px] text-zinc-500 uppercase">Profundidade das linhas na massa de biscoito</span>
              </div>

              {/* SLIDER: DETAIL THICKNESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Espessura do Relevo (Linha)</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.detailThickness} mm</span>
                </div>
                <input 
                  type="range" 
                  min="0.6" 
                  max="2.5" 
                  step="0.1"
                  value={config.detailThickness}
                  onChange={(e) => setConfig(prev => ({ ...prev, detailThickness: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

              {/* SLIDER: CLEARANCE GAP */}
              <div className="space-y-2 border-t border-zinc-950 pt-4">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Folga de Tolerância (Corte-Carimbo)</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.clearance} mm</span>
                </div>
                <input 
                  type="range" 
                  min="0.4" 
                  max="2.5" 
                  step="0.1"
                  value={config.clearance}
                  onChange={(e) => setConfig(prev => ({ ...prev, clearance: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
                <p className="text-[9.5px] text-zinc-500">
                  *A folga é crucial para que o carimbo deslize livremente dentro do cortador sem agarrar na massa.
                </p>
              </div>

              {/* OPTION: ADD GRIP HANDLE */}
              <div className="space-y-3 border-t border-zinc-950 pt-4">
                <label className="flex items-center gap-3 text-xs text-zinc-300 font-bold cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={config.addHandle}
                    onChange={(e) => setConfig(prev => ({ ...prev, addHandle: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#00E5FF] bg-black border-zinc-800 accent-[#00E5FF]"
                  />
                  <span>Adicionar Alça/Puxador Traseiro</span>
                </label>

                {config.addHandle && (
                  <div className="space-y-2 pl-7">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400">
                      <span>Profundidade/Altura do Puxador</span>
                      <span className="font-mono text-[#00E5FF] font-bold">{config.handleHeight} mm</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="15" 
                      value={config.handleHeight}
                      onChange={(e) => setConfig(prev => ({ ...prev, handleHeight: parseInt(e.target.value) }))}
                      className="w-full accent-[#00E5FF] cursor-pointer"
                    />
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: COLORING DRAWING (IMPRIMIR E PINTAR SPECIFIC) */}
          {activeTab === "coloring" && (
            <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                <Palette className="w-4 h-4 text-[#00E5FF]" />
                <span>Configurar Placa para Colorir 🎨</span>
              </h3>
              
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                As placas para colorir geram moldes 3D maciços, com a base plana branca e as linhas de relevo salientes, exatamente como na segunda imagem anexada. Podem ser pintados por crianças com canetas alimentares ou tintas normais de artesanato após a impressão!
              </p>

              {/* SLIDER: BASE THICKNESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Espessura da Placa de Base</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.coloringBaseThickness} mm</span>
                </div>
                <input 
                  type="range" 
                  min="1.5" 
                  max="5.0" 
                  step="0.5"
                  value={config.coloringBaseThickness}
                  onChange={(e) => setConfig(prev => ({ ...prev, coloringBaseThickness: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

              {/* SLIDER: OUTLINES HEIGHT */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Altura das Linhas Salientes</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.coloringLineHeight} mm</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="4.0" 
                  step="0.2"
                  value={config.coloringLineHeight}
                  onChange={(e) => setConfig(prev => ({ ...prev, coloringLineHeight: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

              {/* SLIDER: OUTLINES WIDTH */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-zinc-400">Largura das Linhas de Relevo</span>
                  <span className="font-mono text-[#00E5FF] font-bold">{config.coloringLineWidth} mm</span>
                </div>
                <input 
                  type="range" 
                  min="0.8" 
                  max="3.0" 
                  step="0.2"
                  value={config.coloringLineWidth}
                  onChange={(e) => setConfig(prev => ({ ...prev, coloringLineWidth: parseFloat(e.target.value) }))}
                  className="w-full accent-[#00E5FF] cursor-pointer"
                />
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded p-3 text-[10px] text-zinc-400 font-mono space-y-1">
                <div className="text-white font-bold mb-1 flex items-center gap-1.5 text-[10.5px]">
                  <Palette className="w-3.5 h-3.5 text-yellow-500" />
                  Dica de Impressão (Fatiador):
                </div>
                <div>1. Defina a cor principal como Branco (Base).</div>
                <div>2. Crie uma pausa ou troca automática de cor por altura na camada do relevo para Preto.</div>
                <div>3. Obtenha placas idênticas às fotos enviadas com apenas um bico (Single Extruder)!</div>
              </div>
            </div>
          )}

          {/* TAB 5: BIBLIOTECA (SAVED SAVES) */}
          {activeTab === "biblioteca" && (
            <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                <Folder className="w-4 h-4 text-[#00E5FF]" />
                <span>Meus Cortadores Salvos</span>
              </h3>

              {savedProjects.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 space-y-2">
                  <Folder className="w-8 h-8 mx-auto opacity-30 text-zinc-400" />
                  <p className="text-xs">Nenhum projeto salvo no armazenamento local.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {savedProjects.map((proj) => (
                    <div 
                      key={proj.id}
                      onClick={() => handleLoadProject(proj)}
                      className="group bg-zinc-950 border border-zinc-900 hover:border-[#00E5FF]/40 p-3 rounded-lg flex justify-between items-center transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg bg-zinc-900 p-2 border border-zinc-850 rounded">
                          {PRESETS.find(p => p.id === proj.presetId)?.icon || "🍪"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white group-hover:text-[#00E5FF] transition-colors">
                            {proj.name}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono mt-0.5">
                            Salvo em: {proj.savedAt}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Eliminar projeto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VECTOR LAYER PATH MANAGER (STRICT CONTROL) */}
          <div className="bg-[#0c0c0e] border border-zinc-900 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <span>Gestão de Camadas do Vetor (SVG)</span>
              </h3>
              <span className="bg-[#00E5FF]/10 text-[#00E5FF] px-2 py-0.5 rounded font-mono text-[9px] font-bold">
                {layers.length} Caminhos
              </span>
            </div>

            <p className="text-[10px] text-zinc-500">
              Personalize o comportamento de cada traço do vetor importado. Escolha qual representa a lâmina de corte externa (Outline) e quais representam os relevos de gravação do carimbo (Stamp).
            </p>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {layers.map((layer) => (
                <div 
                  key={layer.id} 
                  className="bg-black/30 border border-zinc-900 p-2.5 rounded flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10.5px] font-mono text-zinc-300 font-bold truncate">
                      {layer.name}
                    </span>
                    <span className="text-[8px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                      <span>{Math.round(layer.length)}px</span>
                      <span>•</span>
                      <span>{layer.isClosed ? "Loop Fechado" : "Linha Aberta"}</span>
                    </span>
                  </div>

                  {/* Symmetrical Layer toggle handles */}
                  <div className="flex border border-zinc-900 p-0.5 bg-black/45 rounded shrink-0">
                    <button
                      onClick={() => toggleLayerType(layer.id, "cutter")}
                      className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        layer.type === "cutter"
                          ? "bg-[#ff5722]/15 text-[#ff5722]"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      title="Define este traço como a faca de corte externa"
                    >
                      Corte
                    </button>
                    <button
                      onClick={() => toggleLayerType(layer.id, "stamp")}
                      className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        layer.type === "stamp"
                          ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      title="Define este traço como detalhes de carimbo interno"
                    >
                      Gravar
                    </button>
                    <button
                      onClick={() => toggleLayerType(layer.id, "ignore")}
                      className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        layer.type === "ignore"
                          ? "bg-zinc-800 text-zinc-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      title="Ignora este traço na geração de 3D"
                    >
                      Omitir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
