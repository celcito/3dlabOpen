import { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toast, toastExportError } from "@/lib/toast";
import { 
  Sparkles, Layers, Download, Plus, Trash2, Sliders, HelpCircle,
  Eye, EyeOff, RotateCcw, Copy, Folder, BookOpen, Save, FileDown,
  Info, Settings, LayoutGrid, Check, AlertTriangle, ArrowUpDown, Move, Type,
  FileCode
} from "lucide-react";
import { usePlateCreator } from "../hooks/usePlateCreator";
import { usePlateSceneGeometry, useTextGeometry } from "../hooks/plate/usePlateSceneGeometry";
// NOTA: ajuste este caminho relativo para onde os arquivos svgToShapes.ts e
// plateBridge.ts forem colocados no seu projeto (ex: lib/, utils/, etc).
import { svgToExtrudedGeometry } from "../lib/svgToShapes";
import { consumePendingSvg } from "../lib/plateBridge";
import { union, subtract, intersect } from "../../lib/csg";

// Types
interface PlateLayer {
  id: string;
  type: "text" | "icon" | "svg";
  content: string; // Texto, id do ícone procedural, ou markup SVG bruto (quando type === "svg")
  x: number;       // Position X offset
  y: number;       // Position Y offset
  size: number;    // Scale / Font Size
  depth: number;   // Z Extrusion depth
  rotation: number; // Angle in degrees
  color: string;   // Color in hex
  visible: boolean;
  style: "raised" | "engraved"; // raised = sticks out, engraved = slots inside
  fontFamily: string; // Font family ID for text layers
  booleanMode: "none" | "union" | "subtract" | "intersect"; // Boolean operation mode
  flipX?: boolean; // Mirror horizontally
  flipY?: boolean; // Mirror vertically
}

interface PlateConfig {
  shape: "rounded_rect" | "circle" | "oval" | "hexagon" | "shield" | "banner" | "text_based";
  orientation: "horizontal" | "vertical"; // Orientação da placa
  width: number;
  height: number;
  thickness: number;
  borderRadius: number;
  color: string;
  borderStyle: "none" | "relief" | "indented";
  borderWidth: number;
  borderHeight: number;
  mountingHoles: "none" | "top_center" | "two_sides" | "four_corners";
  holeSize: number;
  materialFinish: "matte" | "glossy" | "textured" | "wood" | "carbon";
}

interface SavedPlate {
  id: string;
  name: string;
  savedAt: string;
  config: PlateConfig;
  layers: PlateLayer[];
}

// Font registry — all typeface.json fonts available from Three.js examples CDN
const FONT_REGISTRY: Record<string, { name: string; url: string; style: string }> = {
  helvetiker_regular: { name: "Helvetiker Regular", url: "https://unpkg.com/three@0.150.0/examples/fonts/helvetiker_regular.typeface.json", style: "Sans-Serif" },
  helvetiker_bold: { name: "Helvetiker Bold", url: "https://unpkg.com/three@0.150.0/examples/fonts/helvetiker_bold.typeface.json", style: "Sans-Serif Bold" },
  gentilis_regular: { name: "Gentilis Regular", url: "https://unpkg.com/three@0.150.0/examples/fonts/gentilis_regular.typeface.json", style: "Serif" },
  gentilis_bold: { name: "Gentilis Bold", url: "https://unpkg.com/three@0.150.0/examples/fonts/gentilis_bold.typeface.json", style: "Serif Bold" },
  optimer_regular: { name: "Optimer Regular", url: "https://unpkg.com/three@0.150.0/examples/fonts/optimer_regular.typeface.json", style: "Slab Serif" },
  optimer_bold: { name: "Optimer Bold", url: "https://unpkg.com/three@0.150.0/examples/fonts/optimer_bold.typeface.json", style: "Slab Serif Bold" },
  droid_serif_regular: { name: "Droid Serif Regular", url: "https://unpkg.com/three@0.150.0/examples/fonts/droid/droid_serif_regular.typeface.json", style: "Serif" },
  droid_sans_regular: { name: "Droid Sans Regular", url: "https://unpkg.com/three@0.150.0/examples/fonts/droid/droid_sans_regular.typeface.json", style: "Sans-Serif" },
  droid_sans_bold: { name: "Droid Sans Bold", url: "https://unpkg.com/three@0.150.0/examples/fonts/droid/droid_sans_bold.typeface.json", style: "Sans-Serif Bold" },
};

// Procedural icons shapes generator
function getProceduralIconShape(iconId: string): THREE.Shape {
  const shape = new THREE.Shape();
  
  switch (iconId) {
    case "heart": // Coração
      shape.moveTo(0, -0.3);
      shape.bezierCurveTo(-0.6, 0.2, -0.7, 0.7, -0.4, 1.0);
      shape.bezierCurveTo(-0.1, 1.2, 0, 0.8, 0, 0.7);
      shape.bezierCurveTo(0, 0.8, 0.1, 1.2, 0.4, 1.0);
      shape.bezierCurveTo(0.7, 0.7, 0.6, 0.2, 0, -0.3);
      break;

    case "star": // Estrela
      const points = 5;
      const rOuter = 0.6;
      const rInner = 0.25;
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? rOuter : rInner;
        const currX = Math.cos(angle) * r;
        const currY = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(currX, currY);
        else shape.lineTo(currX, currY);
      }
      shape.closePath();
      break;

    case "gamepad": // Controle Gamer
      shape.moveTo(-0.5, 0.2);
      shape.bezierCurveTo(-0.6, 0.4, -0.4, 0.5, -0.2, 0.5);
      shape.lineTo(0.2, 0.5);
      shape.bezierCurveTo(0.4, 0.5, 0.6, 0.4, 0.5, 0.2);
      shape.bezierCurveTo(0.4, -0.2, 0.6, -0.4, 0.3, -0.4);
      shape.bezierCurveTo(0.1, -0.4, 0.1, -0.2, 0, -0.2);
      shape.bezierCurveTo(-0.1, -0.2, -0.1, -0.4, -0.3, -0.4);
      shape.bezierCurveTo(-0.6, -0.4, -0.4, -0.2, -0.5, 0.2);
      // D-Pad cutout representation
      break;

    case "lightning": // Raio
      shape.moveTo(-0.1, 0.6);
      shape.lineTo(0.4, 0.1);
      shape.lineTo(0.1, 0.05);
      shape.lineTo(0.3, -0.6);
      shape.lineTo(-0.2, -0.1);
      shape.lineTo(0.05, -0.05);
      shape.closePath();
      break;

    case "crown": // Coroa
      shape.moveTo(-0.5, -0.3);
      shape.lineTo(-0.5, 0.1);
      shape.lineTo(-0.25, -0.1);
      shape.lineTo(0, 0.4);
      shape.lineTo(0.25, -0.1);
      shape.lineTo(0.5, 0.1);
      shape.lineTo(0.5, -0.3);
      shape.closePath();
      break;

    case "coffee": // Caneca de Café
      shape.moveTo(-0.35, 0.4);
      shape.lineTo(0.25, 0.4);
      shape.bezierCurveTo(0.3, 0.4, 0.3, 0.35, 0.25, 0.35);
      shape.bezierCurveTo(0.2, 0.2, 0.2, -0.3, 0.15, -0.4);
      shape.lineTo(-0.25, -0.4);
      shape.bezierCurveTo(-0.3, -0.3, -0.3, 0.2, -0.35, 0.4);
      
      // Draw handle
      const handle = new THREE.Path();
      handle.moveTo(0.22, 0.2);
      handle.bezierCurveTo(0.45, 0.2, 0.45, -0.2, 0.17, -0.2);
      handle.bezierCurveTo(0.17, -0.1, 0.35, -0.1, 0.35, 0.1);
      handle.bezierCurveTo(0.35, 0.1, 0.22, 0.1, 0.22, 0.2);
      shape.holes.push(handle);
      break;

    case "gear": // Engrenagem
      const teeth = 8;
      const ro = 0.5;
      const ri = 0.4;
      const rc = 0.15;
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const r = i % 2 === 0 ? ro : ri;
        const x1 = Math.cos(angle - 0.1) * r;
        const y1 = Math.sin(angle - 0.1) * r;
        const x2 = Math.cos(angle + 0.1) * r;
        const y2 = Math.sin(angle + 0.1) * r;
        if (i === 0) shape.moveTo(x1, y1);
        else {
          shape.lineTo(x1, y1);
          shape.lineTo(x2, y2);
        }
      }
      shape.closePath();
      // Center hole
      const hole = new THREE.Path();
      hole.absarc(0, 0, rc, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      break;

    case "music": // Nota Musical
      shape.moveTo(-0.3, -0.3);
      shape.lineTo(-0.3, 0.4);
      shape.lineTo(0.2, 0.2);
      shape.lineTo(0.2, -0.4);
      
      // Note heads
      const h1 = new THREE.Path();
      h1.absarc(-0.4, -0.3, 0.15, 0, Math.PI * 2, true);
      shape.holes.push(h1);

      const h2 = new THREE.Path();
      h2.absarc(0.1, -0.4, 0.15, 0, Math.PI * 2, true);
      shape.holes.push(h2);
      break;

    case "skull": // Caveira
      shape.moveTo(-0.3, -0.4);
      shape.lineTo(-0.15, -0.4);
      shape.lineTo(-0.15, -0.5);
      shape.lineTo(0.15, -0.5);
      shape.lineTo(0.15, -0.4);
      shape.lineTo(0.3, -0.4);
      shape.bezierCurveTo(0.5, -0.2, 0.55, 0.3, 0.3, 0.55);
      shape.bezierCurveTo(0.1, 0.7, -0.1, 0.7, -0.3, 0.55);
      shape.bezierCurveTo(-0.55, 0.3, -0.5, -0.2, -0.3, -0.4);
      
      // Eye socket cutouts
      const eyeL = new THREE.Path();
      eyeL.absarc(-0.15, 0.1, 0.1, 0, Math.PI * 2, true);
      shape.holes.push(eyeL);

      const eyeR = new THREE.Path();
      eyeR.absarc(0.15, 0.1, 0.1, 0, Math.PI * 2, true);
      shape.holes.push(eyeR);
      break;

    case "flame": // Fogo
      shape.moveTo(0, -0.5);
      shape.bezierCurveTo(-0.4, -0.4, -0.5, -0.1, -0.4, 0.2);
      shape.bezierCurveTo(-0.3, 0.4, -0.4, 0.6, -0.1, 0.8);
      shape.bezierCurveTo(-0.25, 0.5, -0.1, 0.3, 0, 0.25);
      shape.bezierCurveTo(0.1, 0.3, 0.25, 0.5, 0.1, 0.8);
      shape.bezierCurveTo(0.4, 0.6, 0.3, 0.4, 0.4, 0.2);
      shape.bezierCurveTo(0.5, -0.1, 0.4, -0.4, 0, -0.5);
      break;

    case "ghost": // Fantasma Retro
      shape.moveTo(-0.4, -0.4);
      shape.lineTo(-0.4, 0.2);
      shape.bezierCurveTo(-0.4, 0.6, 0.4, 0.6, 0.4, 0.2);
      shape.lineTo(0.4, -0.4);
      // Zigzag bottom
      shape.lineTo(0.25, -0.25);
      shape.lineTo(0.1, -0.4);
      shape.lineTo(-0.05, -0.25);
      shape.lineTo(-0.2, -0.4);
      shape.closePath();
      break;

    case "rocket": // Foguete
      shape.moveTo(0, 0.6);
      shape.bezierCurveTo(0.2, 0.4, 0.25, 0, 0.2, -0.4);
      shape.lineTo(0.35, -0.5);
      shape.lineTo(0.2, -0.5);
      shape.lineTo(0.15, -0.4);
      shape.lineTo(-0.15, -0.4);
      shape.lineTo(-0.2, -0.5);
      shape.lineTo(-0.35, -0.5);
      shape.lineTo(-0.2, -0.4);
      shape.bezierCurveTo(-0.25, 0, -0.2, 0.4, 0, 0.6);
      break;

    case "shield": // Escudo decorativo
      shape.moveTo(0, 0.6);
      shape.lineTo(0.45, 0.45);
      shape.bezierCurveTo(0.45, 0, 0.4, -0.4, 0, -0.65);
      shape.bezierCurveTo(-0.4, -0.4, -0.45, 0, -0.45, 0.45);
      shape.closePath();
      break;

    default: // Quadrado padrão
      shape.moveTo(-0.4, -0.4);
      shape.lineTo(0.4, -0.4);
      shape.lineTo(0.4, 0.4);
      shape.lineTo(-0.4, 0.4);
      shape.closePath();
      break;
  }

  return shape;
}

// Draw base plate shape with proper dimensions
function getPlateBaseShape(config: PlateConfig, layers?: PlateLayer[]): THREE.Shape {
  const shape = new THREE.Shape();
  const w = config.width / 10; // scale down for viewport (e.g. 200mm = 20 units)
  const h = config.height / 10;
  const r = config.borderRadius / 10;

  if (config.shape === "text_based") {
    if (!layers || layers.length === 0) {
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.closePath();
    } else {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      layers.forEach(layer => {
        if (!layer.visible) return;
        const padding = layer.size * 0.8;
        minX = Math.min(minX, layer.x - padding);
        maxX = Math.max(maxX, layer.x + padding);
        minY = Math.min(minY, layer.y - padding);
        maxY = Math.max(maxY, layer.y + padding);
      });
      const padding = 2;
      minX -= padding; maxX += padding;
      minY -= padding; maxY += padding;
      shape.moveTo(minX, minY);
      shape.lineTo(maxX, minY);
      shape.lineTo(maxX, maxY);
      shape.lineTo(minX, maxY);
      shape.closePath();
    }
  } else {
    switch (config.shape) {
      case "rounded_rect":
        shape.moveTo(-w / 2 + r, -h / 2);
        shape.lineTo(w / 2 - r, -h / 2);
        shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        shape.lineTo(w / 2, h / 2 - r);
        shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        shape.lineTo(-w / 2 + r, h / 2);
        shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        shape.lineTo(-w / 2, -h / 2 + r);
        shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        break;

      case "circle":
        const rad = w / 2;
        shape.absarc(0, 0, rad, 0, Math.PI * 2, false);
        break;

      case "oval":
        const rx = w / 2;
        const ry = h / 2;
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          const x = Math.cos(angle) * rx;
          const y = Math.sin(angle) * ry;
          if (i === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        }
        break;

      case "hexagon":
        const hexW = w / 2;
        const hexH = h / 2;
        shape.moveTo(0, hexH);
        shape.lineTo(hexW, hexH * 0.5);
        shape.lineTo(hexW, -hexH * 0.5);
        shape.moveTo(0, -hexH); // Fix connection
        shape.lineTo(0, -hexH);
        shape.lineTo(-hexW, -hexH * 0.5);
        shape.lineTo(-hexW, hexH * 0.5);
        shape.closePath();
        break;

      case "shield":
        const sW = w / 2;
        const sH = h / 2;
        shape.moveTo(0, sH);
        shape.lineTo(sW, sH * 0.7);
        shape.bezierCurveTo(sW, 0, sW * 0.8, -sH * 0.7, 0, -sH);
        shape.bezierCurveTo(-sW * 0.8, -sH * 0.7, -sW, 0, -sW, sH * 0.7);
        shape.closePath();
        break;

      case "banner":
        const bW = w / 2;
        const bH = h / 2;
        shape.moveTo(-bW, bH);
        shape.lineTo(bW, bH);
        shape.lineTo(bW - (bW * 0.15), 0); // Indented right
        shape.lineTo(bW, -bH);
        shape.lineTo(-bW, -bH);
        shape.lineTo(-bW + (bW * 0.15), 0); // Indented left
        shape.closePath();
        break;
    }
  }


  // Handle Mounting Holes directly in the shape (Subtractive Path)
  if (config.mountingHoles !== "none") {
    const hr = config.holeSize / 20; // scaled down
    const margin = Math.max(w * 0.08, hr * 2);

    if (config.mountingHoles === "top_center") {
      const hole = new THREE.Path();
      hole.absarc(0, h/2 - margin, hr, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    } 
    else if (config.mountingHoles === "two_sides") {
      const holeL = new THREE.Path();
      holeL.absarc(-w/2 + margin, 0, hr, 0, Math.PI * 2, true);
      shape.holes.push(holeL);

      const holeR = new THREE.Path();
      holeR.absarc(w/2 - margin, 0, hr, 0, Math.PI * 2, true);
      shape.holes.push(holeR);
    } 
    else if (config.mountingHoles === "four_corners") {
      const cX = w/2 - margin;
      const cY = h/2 - margin;
      
      const h1 = new THREE.Path(); h1.absarc(-cX, cY, hr, 0, Math.PI * 2, true); shape.holes.push(h1);
      const h2 = new THREE.Path(); h2.absarc(cX, cY, hr, 0, Math.PI * 2, true); shape.holes.push(h2);
      const h3 = new THREE.Path(); h3.absarc(-cX, -cY, hr, 0, Math.PI * 2, true); shape.holes.push(h3);
      const h4 = new THREE.Path(); h4.absarc(cX, -cY, hr, 0, Math.PI * 2, true); shape.holes.push(h4);
    }
  }

  return shape;
}

// Component to render 3D Text with manual cached geometry to avoid TS JSX errors
function TextMesh({ 
  layer, 
  font, 
  isSelected, 
  showWireframe 
}: { 
  layer: PlateLayer; 
  font: Font; 
  isSelected: boolean; 
  showWireframe: boolean; 
}) {
  const geom = useTextGeometry(layer.content, layer.size, layer.depth, font);

  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial 
        color={layer.color}
        roughness={0.3}
        metalness={0.1}
        wireframe={showWireframe}
        emissive={layer.color}
        emissiveIntensity={isSelected ? 0.25 : 0.0}
      />
    </mesh>
  );
}

// Component to render an imported SVG layer (vindo do Design Editor ou de upload manual)
// as extruded, watertight-ready geometry, memoized so re-parsing only happens when the
// underlying SVG markup, depth, or scale actually change.
function SvgLayerMesh({
  layer,
  isSelected,
  showWireframe
}: {
  layer: PlateLayer;
  isSelected: boolean;
  showWireframe: boolean;
}) {
  const geometry = useMemo(() => {
    return svgToExtrudedGeometry(layer.content, {
      depth: layer.depth / 10,
      targetSize: layer.size,
    });
  }, [layer.content, layer.depth, layer.size]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial 
        color={layer.color}
        roughness={0.3}
        metalness={0.1}
        wireframe={showWireframe}
        emissive={layer.color}
        emissiveIntensity={isSelected ? 0.25 : 0.0}
      />
    </mesh>
  );
}

// 3D Canvas rendering component
function Scene({ 
  config, 
  layers, 
  activeLayerId,
  fonts, 
  explodedView,
  showWireframe,
  setActiveLayerId,
  updateLayerPosition,
  setControlsEnabled
}: { 
  config: PlateConfig; 
  layers: PlateLayer[]; 
  activeLayerId: string | null;
  fonts: Record<string, Font>;
  explodedView: number;
  showWireframe: boolean;
  setActiveLayerId: (id: string | null) => void;
  updateLayerPosition: (id: string, x: number, y: number) => void;
  setControlsEnabled: (enabled: boolean) => void;
}) {
  const { invalidate, raycaster, camera, scene } = useThree();
  const draggingLayerId = useRef<string | null>(null);

  // Helper to calculate plane intersection
  const getPointerPosition = (e: any) => {
    raycaster.setFromCamera(e.pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return target;
  };

  const { plateBaseShape, extrudeSettings, materialProps } = usePlateSceneGeometry(
    config,
    layers,
    showWireframe,
    getPlateBaseShape,
  );

  // Compute base plate geometry (memoized)
  const basePlateGeometry = useMemo(() => {
    if (config.shape === "text_based") return null;
    return new THREE.ExtrudeGeometry(plateBaseShape, extrudeSettings);
  }, [plateBaseShape, extrudeSettings, config.shape]);

  // Compute border geometry if applicable
  const borderGeometry = useMemo(() => {
    if (config.borderStyle === "none" || config.shape === "text_based") return null;
    const borderShape = getPlateBaseShape({
      ...config,
      width: config.width - (config.borderWidth * 2),
      height: config.height - (config.borderWidth * 2),
      borderRadius: Math.max(1, config.borderRadius - config.borderWidth),
      mountingHoles: "none"
    });
    return new THREE.ExtrudeGeometry(borderShape, {
      steps: 1,
      depth: config.borderHeight / 10,
      bevelEnabled: false
    });
  }, [config, getPlateBaseShape]);

  // Apply CSG boolean operations from layers to base plate
  const finalBaseGeometry = useMemo(() => {
    if (!basePlateGeometry) return null;
    let result = basePlateGeometry.clone();

    // Collect all boolean operations and apply them in order
    const booleanLayers = layers.filter(l => l.visible && l.booleanMode !== "none");
    for (const layer of booleanLayers) {
      let layerGeom: THREE.BufferGeometry | null = null;

      if (layer.type === "text" && fonts[layer.fontFamily || "helvetiker_regular"]) {
        layerGeom = new TextGeometry(layer.content, {
          font: fonts[layer.fontFamily || "helvetiker_regular"],
          size: layer.size / 10,
          depth: layer.depth / 10,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.015,
          bevelSegments: 3,
        });
      } else if (layer.type === "icon") {
        const iconShape = getProceduralIconShape(layer.content);
        layerGeom = new THREE.ExtrudeGeometry(iconShape, {
          steps: 1,
          depth: layer.depth / 10,
          bevelEnabled: true,
          bevelThickness: 0.04,
          bevelSize: 0.02,
          bevelSegments: 2,
        });
      } else if (layer.type === "svg") {
        layerGeom = svgToExtrudedGeometry(layer.content, {
          depth: layer.depth / 10,
          targetSize: layer.size,
        });
      }

      if (!layerGeom) continue;

      // Transform layer geometry to world position
      const matrix = new THREE.Matrix4();
      const rotationRad = (layer.rotation * Math.PI) / 180;
      const flipX = (layer as any).flipX ? -1 : 1;
      const flipY = (layer as any).flipY ? -1 : 1;
      matrix.makeRotationZ(rotationRad);
      matrix.scale(new THREE.Vector3(flipX, flipY, 1));
      matrix.setPosition(layer.x, layer.y, (config.thickness / 10) - (layer.style === "engraved" ? 0.1 : 0));

      try {
        if (layer.booleanMode === "subtract") {
          result = subtract(result, layerGeom, matrix);
        } else if (layer.booleanMode === "union") {
          result = union(result, layerGeom, matrix);
        } else if (layer.booleanMode === "intersect") {
          result = intersect(result, layerGeom, matrix);
        }
      } catch (err) {
        console.warn(`CSG operation failed for layer "${layer.content}":`, err);
      }
    }

    result.computeVertexNormals();
    return result;
  }, [basePlateGeometry, layers, fonts, config.thickness, config.shape]);

  // Handle auto-render refresh on parameter changes
  useEffect(() => {
    invalidate();
  }, [config, layers, activeLayerId, fonts, explodedView, showWireframe, invalidate]);

  return (
    <group position={[0, 0, 0]}>
      {/* 1. BASE PLATE MESH (with CSG boolean operations applied) */}
      {finalBaseGeometry && (
        <mesh 
          geometry={finalBaseGeometry}
          castShadow 
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            setActiveLayerId(null);
          }}
        >
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}

      {/* Plate Border Line Relief decoration */}
      {borderGeometry && (
        <mesh 
          position={[0, 0, (config.thickness / 10) + (config.borderStyle === "relief" ? 0.05 : -0.05)]}
          geometry={borderGeometry}
          onClick={(e) => {
            e.stopPropagation();
            setActiveLayerId(null);
          }}
        >
          <meshStandardMaterial 
            color={config.borderStyle === "relief" ? "#121212" : "#0d0d0d"}
            roughness={0.5}
            metalness={0.2}
            wireframe={showWireframe}
          />
        </mesh>
      )}

      {/* Orientation indicator — subtle arrow showing plate direction */}
      <group position={[0, 0, (config.thickness / 10) + 0.02]}>
        <mesh rotation={[0, 0, config.orientation === "horizontal" ? 0 : Math.PI / 2]}>
          <planeGeometry args={[0.8, 0.15]} />
          <meshBasicMaterial color="#632CE5" opacity={0.3} transparent />
        </mesh>
        <mesh position={[config.orientation === "horizontal" ? 0.45 : 0, config.orientation === "vertical" ? 0.45 : 0, 0]} rotation={[0, 0, config.orientation === "horizontal" ? 0 : Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.2, 4]} />
          <meshBasicMaterial color="#632CE5" opacity={0.3} transparent />
        </mesh>
      </group>

      {/* 2. OVERLAPPING TEXT AND ICON LAYERS */}
      {layers.map((layer, index) => {
        if (!layer.visible) return null;
        // Skip layers that are already applied to the base via CSG
        if (layer.booleanMode && layer.booleanMode !== "none") return null;

        const isSelected = activeLayerId === layer.id;
        // Apply explosion lift factor: moves the layer out in +Z axis
        const zOffset = (config.thickness / 10) + (explodedView * index * 1.5) + (layer.style === "engraved" ? -0.1 : 0.01);
        const rotationRad = (layer.rotation * Math.PI) / 180;
        const flipX = (layer as any).flipX ? -1 : 1;
        const flipY = (layer as any).flipY ? -1 : 1;

        return (
          <group 
            key={layer.id} 
            position={[layer.x, layer.y, zOffset]} 
            rotation={[0, 0, rotationRad]}
            scale={[flipX, flipY, 1]}
            onClick={(e) => {
              e.stopPropagation();
              setActiveLayerId(layer.id);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              draggingLayerId.current = layer.id;
              setControlsEnabled(false);
            }}
            onPointerMove={(e) => {
              if (draggingLayerId.current === layer.id) {
                const pos = getPointerPosition(e);
                updateLayerPosition(layer.id, pos.x, pos.y);
                invalidate();
              }
            }}
            onPointerUp={() => {
              draggingLayerId.current = null;
              setControlsEnabled(true);
            }}
            onPointerLeave={() => {
              if (draggingLayerId.current === layer.id) {
                draggingLayerId.current = null;
                setControlsEnabled(true);
              }
            }}
          >
            {layer.type === "icon" ? (
              // Icon Extrusion Geometry
              <mesh castShadow receiveShadow>
                <extrudeGeometry args={[
                  getProceduralIconShape(layer.content), 
                  {
                    steps: 1,
                    depth: layer.depth / 10,
                    bevelEnabled: true,
                    bevelThickness: 0.04,
                    bevelSize: 0.02,
                    bevelSegments: 2
                  }
                ]} />
                <meshStandardMaterial 
                  color={layer.color} 
                  roughness={0.3} 
                  metalness={0.1}
                  wireframe={showWireframe}
                  emissive={layer.color}
                  emissiveIntensity={isSelected ? 0.35 : 0.0}
                />
              </mesh>
            ) : layer.type === "svg" ? (
              // Imported vector art (from Design Editor or manual .svg upload)
              <SvgLayerMesh layer={layer} isSelected={isSelected} showWireframe={showWireframe} />
            ) : (
              // Text Rendering: use TextGeometry with per-layer font, fallback to drei Text
              fonts[layer.fontFamily || "helvetiker_regular"] ? (
                <TextMesh 
                  layer={layer} 
                  font={fonts[layer.fontFamily || "helvetiker_regular"]} 
                  isSelected={isSelected} 
                  showWireframe={showWireframe} 
                />
              ) : (
                // Fallback rendering while font loads / alternative display
                <group>
                  <Text
                    fontSize={layer.size / 10}
                    color={layer.color}
                    anchorX="center"
                    anchorY="middle"
                    depthOffset={-1}
                    position={[0, 0, (layer.depth / 20)]}
                  >
                    {layer.content}
                  </Text>
                  {/* Flat extruded stand-in for STL backup */}
                  <mesh>
                    <boxGeometry args={[layer.content.length * (layer.size / 12), layer.size / 10, layer.depth / 10]} />
                    <meshStandardMaterial color={layer.color} opacity={0.6} transparent wireframe />
                  </mesh>
                </group>
              )
            )}

            {/* Selection indicator widget wire frame */}
            {isSelected && (
              <mesh position={[0, 0, (layer.depth / 10) + 0.05]}>
                <ringGeometry args={[0.3, 0.35, 16]} />
                <meshBasicMaterial color="#632CE5" side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Preset Library
const PLATE_PRESETS: { name: string; desc: string; config: PlateConfig; layers: PlateLayer[] }[] = [
  {
    name: "Gamer Tag 'Player 1'",
    desc: "Placa sextavada neon estilo cibernético com ícone gamer e letras sobrepostas.",
    config: {
      shape: "hexagon",
      width: 180,
      height: 120,
      thickness: 6,
      borderRadius: 5,
      color: "#08080c",
      borderStyle: "relief",
      borderWidth: 6,
      borderHeight: 4,
      mountingHoles: "two_sides",
      holeSize: 4.5,
      materialFinish: "carbon"
    },
    layers: [
      {
        id: "l-gamepad",
        type: "icon",
        content: "gamepad",
        x: 0,
        y: 2.2,
        size: 5,
        depth: 3.5,
        rotation: 0,
        color: "#D500F9",
        visible: true,
        style: "raised"
      },
      {
        id: "l-text1",
        type: "text",
        content: "PLAYER 1",
        x: -4.0,
        y: -1.8,
        size: 1.5,
        depth: 4.5,
        rotation: 0,
        color: "#121212",
        visible: true,
        style: "raised"
      }
    ]
  },
  {
    name: "Cantinho do Café",
    desc: "Estilo rústico em imitação de madeira, ideal para cozinha ou cafeterias.",
    config: {
      shape: "rounded_rect",
      width: 200,
      height: 100,
      thickness: 8,
      borderRadius: 15,
      color: "#5C3A21",
      borderStyle: "indented",
      borderWidth: 5,
      borderHeight: 3,
      mountingHoles: "top_center",
      holeSize: 5.0,
      materialFinish: "wood"
    },
    layers: [
      {
        id: "l-mug",
        type: "icon",
        content: "coffee",
        x: -4.5,
        y: 0.5,
        size: 5,
        depth: 3.0,
        rotation: 0,
        color: "#FFEA00",
        visible: true,
        style: "raised"
      },
      {
        id: "l-textcafe",
        type: "text",
        content: "COFFEE",
        x: 1.0,
        y: 1.0,
        size: 1.6,
        depth: 4.0,
        rotation: -2,
        color: "#FFFFFF",
        visible: true,
        style: "raised"
      },
      {
        id: "l-textcafe2",
        type: "text",
        content: "TIME",
        x: 1.2,
        y: -1.2,
        size: 1.1,
        depth: 3.5,
        rotation: 0,
        color: "#FFEA00",
        visible: true,
        style: "raised"
      }
    ]
  },
  {
    name: " Stay Focused",
    desc: "Placa motivacional de alta performance preta e amarela estilo escudo técnico.",
    config: {
      shape: "shield",
      width: 140,
      height: 160,
      thickness: 6,
      borderRadius: 0,
      color: "#121212",
      borderStyle: "relief",
      borderWidth: 4,
      borderHeight: 4,
      mountingHoles: "four_corners",
      holeSize: 4.0,
      materialFinish: "matte"
    },
    layers: [
      {
        id: "l-lightning",
        type: "icon",
        content: "lightning",
        x: 0,
        y: 3.0,
        size: 4,
        depth: 4.0,
        rotation: 0,
        color: "#FFEA00",
        visible: true,
        style: "raised"
      },
      {
        id: "l-t1",
        type: "text",
        content: "STAY",
        x: -2.3,
        y: -1.0,
        size: 1.4,
        depth: 3.5,
        rotation: 0,
        color: "#FFFFFF",
        visible: true,
        style: "raised"
      },
      {
        id: "l-t2",
        type: "text",
        content: "FOCUS",
        x: -2.8,
        y: -3.0,
        size: 1.4,
        depth: 4.5,
        rotation: 0,
        color: "#FFEA00",
        visible: true,
        style: "raised"
      }
    ]
  },
  {
    name: "Placa 'Não Perturbe'",
    desc: "Sinalizador clássico bicolor de alerta de privacidade para escritório ou reuniões.",
    config: {
      shape: "rounded_rect",
      width: 180,
      height: 90,
      thickness: 5,
      borderRadius: 10,
      color: "#990000",
      borderStyle: "none",
      borderWidth: 3,
      borderHeight: 2,
      mountingHoles: "none",
      holeSize: 4.0,
      materialFinish: "glossy"
    },
    layers: [
      {
        id: "l-tno",
        type: "text",
        content: "NO ENTRY",
        x: -4.5,
        y: 1.0,
        size: 1.4,
        depth: 4.0,
        rotation: 0,
        color: "#FFFFFF",
        visible: true,
        style: "raised"
      },
      {
        id: "l-tsignal",
        type: "text",
        content: "LIVE MEETING",
        x: -5.0,
        y: -1.8,
        size: 0.9,
        depth: 3.0,
        rotation: 0,
        color: "#FFEA00",
        visible: true,
        style: "raised"
      }
    ]
  }
];

export default function PlateCreator() {
  // Base config state
  const [config, setConfig] = useState<PlateConfig>({
    shape: "rounded_rect",
    orientation: "horizontal",
    width: 160,
    height: 100,
    thickness: 6,
    borderRadius: 10,
    color: "#e0e0e0",
    borderStyle: "relief",
    borderWidth: 5,
    borderHeight: 3,
    mountingHoles: "two_sides",
    holeSize: 4.0,
    materialFinish: "carbon"
  });

  // Overlapping Layers list
  const [layers, setLayers] = useState<PlateLayer[]>([
    {
      id: "text-1",
      type: "text",
      content: "OFFICE",
      x: -3.5,
      y: 1.0,
      size: 1.5,
      depth: 4.0,
      rotation: 0,
      color: "#121212",
      visible: true,
      style: "raised"
    },
    {
      id: "icon-1",
      type: "icon",
      content: "crown",
      x: 0,
      y: -2.0,
      size: 3.5,
      depth: 3.5,
      rotation: 0,
      color: "#FFEA00",
      visible: true,
      style: "raised"
    }
  ]);

  const [activeLayerId, setActiveLayerId] = useState<string | null>("text-1");
  const [explodedView, setExplodedView] = useState<number>(0.0); // 0 = flat, 1 = maximum separated
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [fonts, setFonts] = useState<Record<string, Font>>({});
  const [fontLoadingStates, setFontLoadingStates] = useState<Record<string, "idle" | "loading" | "loaded" | "error">>({});
  const [plateName, setPlateName] = useState<string>("Minha Placa Decorativa");
  const [savedLibrary, setSavedLibrary] = useState<SavedPlate[]>([]);
  const { successMsg, showSuccessNotification } = usePlateCreator();
  const [controlsEnabled, setControlsEnabled] = useState<boolean>(true);
  const svgFileInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo history for layer operations
  const [layersHistory, setLayersHistory] = useState<PlateLayer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const pushToHistory = (currentLayers: PlateLayer[]) => {
    setLayersHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(currentLayers)));
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const prevLayers = layersHistory[historyIndex - 1];
    if (prevLayers) {
      setLayers(prevLayers);
      setHistoryIndex(prev => prev - 1);
    }
  };

  const redo = () => {
    if (historyIndex >= layersHistory.length - 1) return;
    const nextLayers = layersHistory[historyIndex + 1];
    if (nextLayers) {
      setLayers(nextLayers);
      setHistoryIndex(prev => prev + 1);
    }
  };

  // Multi-font loading system — loads fonts on demand
  const loadFont = (fontId: string) => {
    if (fonts[fontId] || fontLoadingStates[fontId] === "loading") return;
    const entry = FONT_REGISTRY[fontId];
    if (!entry) return;
    setFontLoadingStates(prev => ({ ...prev, [fontId]: "loading" }));
    const loader = new FontLoader();
    loader.load(
      entry.url,
      (loadedFont) => {
        setFonts(prev => ({ ...prev, [fontId]: loadedFont }));
        setFontLoadingStates(prev => ({ ...prev, [fontId]: "loaded" }));
      },
      undefined,
      (err) => {
        console.error(`FontLoader failed to load ${entry.name}:`, err);
        setFontLoadingStates(prev => ({ ...prev, [fontId]: "error" }));
      }
    );
  };

  // Load default font on mount
  useEffect(() => {
    loadFont("helvetiker_regular");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load fonts used by text layers
  useEffect(() => {
    layers.forEach(layer => {
      if (layer.type === "text" && layer.fontFamily) {
        loadFont(layer.fontFamily);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // Load user saved plates library
  useEffect(() => {
    const saved = localStorage.getItem("vertice_saved_plates_library");
    if (saved) {
      try {
        setSavedLibrary(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar placas salvas:", e);
      }
    }
  }, []);

  // Ponte com o Design Editor: se o usuário clicou em "Enviar para Placa 3D" lá,
  // consome a arte pendente e já cria a camada automaticamente ao entrar aqui.
  useEffect(() => {
    const pending = consumePendingSvg();
    if (pending) {
      handleAddSvgLayer(pending.svg, pending.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y = redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIndex, layersHistory]);

  // Selected active layer helper
  const activeLayer = useMemo(() => {
    return layers.find(l => l.id === activeLayerId) || null;
  }, [layers, activeLayerId]);

  // Layer manipulation handlers
  const updateActiveLayerField = (field: keyof PlateLayer, value: any) => {
    if (!activeLayerId) return;
    setLayers(prev => prev.map(layer => {
      if (layer.id === activeLayerId) {
        return { ...layer, [field]: value };
      }
      return layer;
    }));
  };

  const updateLayerPosition = (id: string, x: number, y: number) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === id) {
        return { 
          ...layer, 
          x: Math.max(-15, Math.min(15, parseFloat(x.toFixed(2)))), 
          y: Math.max(-15, Math.min(15, parseFloat(y.toFixed(2)))) 
        };
      }
      return layer;
    }));
  };

  const handleAddTextLayer = () => {
    pushToHistory(layers);
    const newId = `text-${Date.now()}`;
    const newLayer: PlateLayer = {
      id: newId,
      type: "text",
      content: "TEXTO 3D",
      x: 0,
      y: 0,
      size: 1.2,
      depth: 3.5,
      rotation: 0,
      color: "#FFFFFF",
      visible: true,
      style: "raised",
      fontFamily: "helvetiker_regular",
      booleanMode: "none"
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  const handleAddIconLayer = (iconType: string) => {
    pushToHistory(layers);
    const newId = `icon-${Date.now()}`;
    const newLayer: PlateLayer = {
      id: newId,
      type: "icon",
      content: iconType,
      x: 0,
      y: 0,
      size: 4.0,
      depth: 3.5,
      rotation: 0,
      color: "#121212",
      visible: true,
      style: "raised",
      fontFamily: "helvetiker_regular",
      booleanMode: "none"
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  // Cria uma nova camada vetorial a partir de markup SVG bruto — usado tanto pelo
  // upload manual de arquivo .svg quanto pela ponte automática vinda do Design Editor.
  const handleAddSvgLayer = (svgMarkup: string, label?: string) => {
    pushToHistory(layers);
    const newId = `svg-${Date.now()}`;
    const newLayer: PlateLayer = {
      id: newId,
      type: "svg",
      content: svgMarkup,
      x: 0,
      y: 0,
      size: 3.5,
      depth: 3.5,
      rotation: 0,
      color: "#121212",
      visible: true,
      style: "raised",
      fontFamily: "helvetiker_regular",
      booleanMode: "none"
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
    showSuccessNotification(label ? `Arte "${label}" importada!` : "Arte SVG importada!");
  };

  const handleSvgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (typeof text === "string") {
        handleAddSvgLayer(text, file.name);
      }
    };
    reader.onerror = () => {
      toast.warning("Não foi possível ler o arquivo SVG.");
    };
    reader.readAsText(file);
    e.target.value = ""; // allow re-selecting the same file later
  };

  const handleDeleteLayer = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    pushToHistory(layers);
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) {
      setActiveLayerId(null);
    }
  };

  const handleDuplicateLayer = (layer: PlateLayer, e: React.MouseEvent) => {
    e.stopPropagation();
    pushToHistory(layers);
    const newId = `${layer.type}-${Date.now()}`;
    const duplicated: PlateLayer = {
      ...layer,
      id: newId,
      x: layer.x + 1, // slight shift
      y: layer.y - 1,
    };
    setLayers(prev => [...prev, duplicated]);
    setActiveLayerId(newId);
  };

  const moveLayerOrder = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layers.length) return;
    pushToHistory(layers);
    const reordered = [...layers];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setLayers(reordered);
  };

  // Preset loading
  const loadPreset = (preset: typeof PLATE_PRESETS[0]) => {
    setConfig({ 
      ...preset.config,
      orientation: preset.config.orientation || (preset.config.width >= preset.config.height ? "horizontal" : "vertical")
    });
    setLayers(preset.layers.map(l => ({
      ...l,
      id: `${l.type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fontFamily: l.fontFamily || "helvetiker_regular",
      booleanMode: l.booleanMode || "none"
    })));
    setPlateName(`Placa ${preset.name}`);
    setActiveLayerId(preset.layers[0]?.id || null);
    setExplodedView(0);
    showSuccessNotification(`Preset "${preset.name}" carregado!`);
  };

  // Database / Local Storage Persistence
  const handleSaveToLibrary = () => {
    const newSaved: SavedPlate = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      name: plateName || "Placa Sem Nome",
      savedAt: new Date().toISOString(),
      config,
      layers
    };

    const updated = [newSaved, ...savedLibrary];
    setSavedLibrary(updated);
    localStorage.setItem("vertice_saved_plates_library", JSON.stringify(updated));
    showSuccessNotification("Placa decorativa salva na biblioteca local!");
  };

  const loadSavedPlate = (plate: SavedPlate) => {
    setConfig({
      ...plate.config,
      orientation: plate.config.orientation || (plate.config.width >= plate.config.height ? "horizontal" : "vertical")
    });
    setLayers(plate.layers.map(l => ({
      ...l,
      fontFamily: l.fontFamily || "helvetiker_regular",
      booleanMode: l.booleanMode || "none"
    })));
    setPlateName(plate.name);
    setActiveLayerId(plate.layers[0]?.id || null);
    showSuccessNotification(`Placa "${plate.name}" carregada!`);
  };

  const deleteSavedPlate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir esta placa da sua biblioteca local?")) {
      const updated = savedLibrary.filter(p => p.id !== id);
      setSavedLibrary(updated);
      localStorage.setItem("vertice_saved_plates_library", JSON.stringify(updated));
      showSuccessNotification("Placa excluída.");
    }
  };

  // STL EXPORT ENGINE (Dual Mode: Combined or Exploded separated for gluing)
  const handleExportSTL = (mode: "combined" | "separated_plate" | "separated_layers") => {
    try {
      const exporter = new STLExporter();
      
      if (mode === "combined") {
        // Mode 1: Combined full plate — apply CSG boolean operations, then export as single mesh
        const baseShape = getPlateBaseShape(config, layers);
        const extrudeOpts = {
          steps: 1,
          depth: config.thickness / 10,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 3,
        };
        let combinedGeom = new THREE.ExtrudeGeometry(baseShape, extrudeOpts);

        // Add border as union if enabled
        if (config.borderStyle !== "none") {
          const borderShape = getPlateBaseShape({
            ...config,
            width: config.width - (config.borderWidth * 2),
            height: config.height - (config.borderWidth * 2),
            borderRadius: Math.max(1, config.borderRadius - config.borderWidth),
            mountingHoles: "none"
          });
          const borderGeom = new THREE.ExtrudeGeometry(borderShape, { steps: 1, depth: config.borderHeight / 10, bevelEnabled: false });
          const borderMatrix = new THREE.Matrix4();
          borderMatrix.setPosition(0, 0, (config.thickness / 10) + (config.borderStyle === "relief" ? 0.05 : -0.05));
          try { combinedGeom = union(combinedGeom, borderGeom, borderMatrix); } catch {}
        }

        // Apply boolean operations from layers
        layers.forEach((layer) => {
          if (!layer.visible || !layer.booleanMode || layer.booleanMode === "none") return;
          let layerGeom: THREE.BufferGeometry | null = null;

          if (layer.type === "text") {
            const layerFont = fonts[layer.fontFamily || "helvetiker_regular"];
            if (layerFont) {
              layerGeom = new TextGeometry(layer.content, {
                font: layerFont, size: layer.size / 10, depth: layer.depth / 10,
                curveSegments: 12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.015, bevelSegments: 3,
              });
            }
          } else if (layer.type === "icon") {
            layerGeom = new THREE.ExtrudeGeometry(getProceduralIconShape(layer.content), {
              steps: 1, depth: layer.depth / 10, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.02, bevelSegments: 2,
            });
          } else if (layer.type === "svg") {
            layerGeom = svgToExtrudedGeometry(layer.content, { depth: layer.depth / 10, targetSize: layer.size });
          }

          if (!layerGeom) return;
          const matrix = new THREE.Matrix4();
          const rotationRad = (layer.rotation * Math.PI) / 180;
          const flipX = (layer as any).flipX ? -1 : 1;
          const flipY = (layer as any).flipY ? -1 : 1;
          matrix.makeRotationZ(rotationRad);
          matrix.scale(new THREE.Vector3(flipX, flipY, 1));
          matrix.setPosition(layer.x, layer.y, (config.thickness / 10) - (layer.style === "engraved" ? 0.1 : 0));

          try {
            if (layer.booleanMode === "subtract") combinedGeom = subtract(combinedGeom, layerGeom, matrix);
            else if (layer.booleanMode === "union") combinedGeom = union(combinedGeom, layerGeom, matrix);
            else if (layer.booleanMode === "intersect") combinedGeom = intersect(combinedGeom, layerGeom, matrix);
          } catch (err) { console.warn(`CSG export failed for "${layer.content}":`, err); }
        });

        // Add non-boolean visible layers as separate meshes
        layers.forEach((layer) => {
          if (!layer.visible) return;
          if (layer.booleanMode && layer.booleanMode !== "none") return; // already applied via CSG
          const rotationRad = (layer.rotation * Math.PI) / 180;
          const flipX = (layer as any).flipX ? -1 : 1;
          const flipY = (layer as any).flipY ? -1 : 1;
          let layerMesh: THREE.Mesh | null = null;

          if (layer.type === "icon") {
            layerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(getProceduralIconShape(layer.content), {
              steps: 1, depth: layer.depth / 10, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.02, bevelSegments: 2
            }));
          } else if (layer.type === "svg") {
            const geo = svgToExtrudedGeometry(layer.content, { depth: layer.depth / 10, targetSize: layer.size });
            if (geo) layerMesh = new THREE.Mesh(geo);
          } else if (layer.type === "text") {
            const layerFont = fonts[layer.fontFamily || "helvetiker_regular"];
            if (layerFont) {
              layerMesh = new THREE.Mesh(new TextGeometry(layer.content, {
                font: layerFont, size: layer.size / 10, depth: layer.depth / 10,
                curveSegments: 12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.015, bevelSegments: 3
              }));
            }
          }
          if (layerMesh) {
            layerMesh.position.set(layer.x, layer.y, (config.thickness / 10) + (layer.style === "engraved" ? -0.1 : 0.01));
            layerMesh.rotation.set(0, 0, rotationRad);
            layerMesh.scale.set(flipX, flipY, 1);
          }
        });

        combinedGeom.computeVertexNormals();
        const group = new THREE.Group();
        group.add(new THREE.Mesh(combinedGeom));
        const result = exporter.parse(group, { binary: true });
        triggerDownload(result, `${plateName.toLowerCase().replace(/\s+/g, "-")}-placa-completa.stl`);
        showSuccessNotification("STL Unificado exportado com sucesso!");

      } else if (mode === "separated_plate") {
        // Mode 2a: Export just the Plate Base, WITH slots carved out as guides
        const group = new THREE.Group();
        const baseShape = getPlateBaseShape(config);
        const baseMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(baseShape, {
          steps: 1,
          depth: config.thickness / 10,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 3,
        }));
        group.add(baseMesh);

        // Add border
        if (config.borderStyle !== "none") {
          const borderMesh = new THREE.Mesh(
            new THREE.ExtrudeGeometry(
              getPlateBaseShape({
                ...config,
                width: config.width - (config.borderWidth * 2),
                height: config.height - (config.borderWidth * 2),
                borderRadius: Math.max(1, config.borderRadius - config.borderWidth),
                mountingHoles: "none"
              }), 
              { steps: 1, depth: config.borderHeight / 10, bevelEnabled: false }
            )
          );
          borderMesh.position.set(0, 0, (config.thickness / 10) + (config.borderStyle === "relief" ? 0.05 : -0.05));
          group.add(borderMesh);
        }

        // Add helper lines indicating slots/engravings where layers should be glued
        layers.forEach((layer) => {
          if (!layer.visible) return;
          // Render thin embossed guides (0.4mm height) on the base plate for precise gluing alignment!
          const rotationRad = (layer.rotation * Math.PI) / 180;
          let guideMesh: THREE.Mesh | null = null;

          if (layer.type === "icon") {
            guideMesh = new THREE.Mesh(
              new THREE.ExtrudeGeometry(getProceduralIconShape(layer.content), {
                steps: 1,
                depth: 0.04, // very thin guide line (0.4mm)
                bevelEnabled: false
              })
            );
          } else if (layer.type === "svg") {
            const geo = svgToExtrudedGeometry(layer.content, {
              depth: 0.04,
              targetSize: layer.size,
              bevelEnabled: false
            });
            if (geo) guideMesh = new THREE.Mesh(geo);
          } else if (layer.type === "text") {
            const layerFont = fonts[layer.fontFamily || "helvetiker_regular"];
            if (layerFont) {
              guideMesh = new THREE.Mesh(
                new TextGeometry(layer.content, {
                  font: layerFont,
                  size: layer.size / 10,
                  depth: 0.04,
                  curveSegments: 8,
                  bevelEnabled: false
                })
              );
            }
          }

          if (guideMesh) {
            // align with the face of the plate
            const flipX = (layer as any).flipX ? -1 : 1;
            const flipY = (layer as any).flipY ? -1 : 1;
            guideMesh.position.set(layer.x, layer.y, (config.thickness / 10) - 0.02);
            guideMesh.rotation.set(0, 0, rotationRad);
            guideMesh.scale.set(flipX, flipY, 1);
            group.add(guideMesh);
          }
        });

        const result = exporter.parse(group, { binary: true });
        triggerDownload(result, `${plateName.toLowerCase().replace(/\s+/g, "-")}-BASE-PLACA.stl`);
        showSuccessNotification("Base de Placa com Guias exportada!");

      } else if (mode === "separated_layers") {
        // Mode 2b: Export each individual text/icon layer as separate flat-back STLs
        let exportedCount = 0;
        layers.forEach((layer, idx) => {
          if (!layer.visible) return;
          const group = new THREE.Group();
          let layerMesh: THREE.Mesh | null = null;

          if (layer.type === "icon") {
            const shape = getProceduralIconShape(layer.content);
            layerMesh = new THREE.Mesh(
              new THREE.ExtrudeGeometry(shape, {
                steps: 1,
                depth: layer.depth / 10,
                bevelEnabled: true,
                bevelThickness: 0.04,
                bevelSize: 0.02,
                bevelSegments: 2
              })
            );
          } else if (layer.type === "svg") {
            const geo = svgToExtrudedGeometry(layer.content, {
              depth: layer.depth / 10,
              targetSize: layer.size,
            });
            if (geo) layerMesh = new THREE.Mesh(geo);
          } else if (layer.type === "text") {
            const layerFont = fonts[layer.fontFamily || "helvetiker_regular"];
            if (layerFont) {
              layerMesh = new THREE.Mesh(
                new TextGeometry(layer.content, {
                  font: layerFont,
                  size: layer.size / 10,
                  depth: layer.depth / 10,
                  curveSegments: 12,
                  bevelEnabled: true,
                  bevelThickness: 0.03,
                  bevelSize: 0.015,
                  bevelSegments: 3
                })
              );
            }
          }

          if (layerMesh) {
            // Export centered on flat origin (0, 0, 0) for clean slicing!
            group.add(layerMesh);
            const result = exporter.parse(group, { binary: true });
            const label = layer.type === "text" 
              ? layer.content.substring(0, 8) 
              : layer.type === "svg" 
                ? "arte-svg" 
                : layer.content;
            triggerDownload(result, `${plateName.toLowerCase().replace(/\s+/g, "-")}-PECA-${idx + 1}-${label}.stl`);
            exportedCount++;
          }
        });

        if (exportedCount > 0) {
          showSuccessNotification(`Exportados ${exportedCount} arquivos de peças separados!`);
        } else {
          toast.warning("Nenhuma camada visível para exportar.");
        }
      }
    } catch (err) {
      console.error("Export generation failed:", err);
      toastExportError();
    }
  };

  const triggerDownload = (data: any, filename: string) => {
    const blob = new Blob([data], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 space-y-8 font-sans bg-[#F9FAF4] text-[#212121]">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#E2E3DD]">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#632CE5] animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono font-extrabold text-[#632CE5]">LABORATÓRIO 3D</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1A1C19] mt-1">
            Criador de Placas Decorativas 3D
          </h1>
          <p className="text-xs text-zinc-500 max-w-xl">
            Crie placas com relevos sobrepostos, emojis e logotipos personalizados. Exporte unificado ou fatiado em partes separadas para colar após imprimir em cores diferentes!
          </p>
        </div>

        {/* Input Name Plate */}
        <div className="flex items-center gap-2 w-full md:w-auto bg-white p-1 border border-[#E2E3DD] rounded-lg">
          <input 
            type="text" 
            value={plateName}
            onChange={(e) => setPlateName(e.target.value)}
            className="bg-white/40 text-[11px] font-bold uppercase tracking-wider px-3 py-2 border-0 outline-none focus:ring-1 focus:ring-[#632CE5] rounded text-[#212121] w-full md:w-[220px]"
            placeholder="Nome do Projeto..."
          />
          <button 
            onClick={handleSaveToLibrary}
            className="p-2 bg-[#632CE5]/10 text-[#632CE5] hover:bg-[#632CE5]/20 border border-[#632CE5]/30 rounded transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Salvar Projeto Atual na Biblioteca"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUCCESS POPUP ALERT */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border-2 border-emerald-500/50 text-emerald-400 font-mono text-[10px] uppercase font-black tracking-wider py-3.5 px-6 rounded-lg shadow-[0_4px_30px_rgba(16,185,129,0.15)] flex items-center gap-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: 3D INTERACTIVE VIEWPORT (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="relative aspect-[4/3] w-full bg-white border border-[#E2E3DD] rounded-lg overflow-hidden shadow-2xl flex flex-col justify-between">
            
            {/* Viewport header tags */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-white/60 backdrop-blur border border-[#E8E9E3]/80 px-2.5 py-1 rounded font-mono text-[8.5px] text-zinc-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>PREVIEW EM TEMPO REAL (3D)</span>
            </div>

            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
              <button
                onClick={() => setShowWireframe(!showWireframe)}
                className={`p-1.5 rounded backdrop-blur text-[8px] font-mono border transition-all cursor-pointer ${
                  showWireframe 
                    ? "bg-[#632CE5]/10 text-[#632CE5] border-[#632CE5]/40" 
                    : "bg-white/60 text-zinc-400 border-[#E8E9E3]"
                }`}
                title="Alternar Modo de Grade"
              >
                WIREFRAME
              </button>
            </div>

            {/* THREE.JS CANVAS */}
            <div className="w-full h-full">
              <Canvas 
                orthographic 
                camera={{ zoom: 12, position: [0, 0, 30] }} 
                shadows
              >
                <ambientLight intensity={1.5} />
                <directionalLight 
                  position={[10, 15, 20]} 
                  intensity={2.2} 
                  castShadow 
                  shadow-mapSize-width={1024} 
                  shadow-mapSize-height={1024} 
                />
                <pointLight position={[-10, -10, 15]} intensity={0.5} />
                
                <Scene 
                  config={config} 
                  layers={layers} 
                  activeLayerId={activeLayerId}
                  fonts={fonts}
                  explodedView={explodedView}
                  showWireframe={showWireframe}
                  setActiveLayerId={setActiveLayerId}
                  updateLayerPosition={updateLayerPosition}
                  setControlsEnabled={setControlsEnabled}
                />

                <OrbitControls 
                  enabled={controlsEnabled}
                  enableDamping 
                  dampingFactor={0.05} 
                  maxPolarAngle={Math.PI / 2} 
                  minZoom={6}
                  maxZoom={30}
                />
              </Canvas>
            </div>

            {/* Viewport bottom controls HUD */}
            <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur border border-[#E2E3DD]/95 p-3 rounded-md">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono text-[#632CE5] uppercase tracking-widest block font-extrabold">Vista Explodida (Glúten Preview)</span>
                  <span className="text-[7px] text-zinc-500 uppercase">Arraste para afastar as partes</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1.5" 
                  step="0.1"
                  value={explodedView}
                  onChange={(e) => setExplodedView(parseFloat(e.target.value))}
                  className="w-24 sm:w-32 accent-[#632CE5] cursor-pointer"
                />
                <span className="text-[9px] font-mono text-[#632CE5] font-black">{Math.round(explodedView * 100)}%</span>
              </div>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setExplodedView(0)}
                  className="bg-[#E8E9E3] hover:bg-[#F9FAF4] border border-[#E8E9E3] hover:border-[#E8E9E3] p-1 rounded cursor-pointer"
                  title="Resetar Vista"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
            </div>

          </div>

          {/* QUICK TUTORIAL OR ASSEMBLY INFO */}
          <div className="bg-white border border-[#E2E3DD] rounded-lg p-4 space-y-2.5">
            <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-black flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#632CE5]" />
              Manual de Encaixes e Cola
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10.5px] text-zinc-500 leading-relaxed font-sans">
              <p>
                <strong>Montagem Tradicional (Unificado):</strong> Prático para impressoras de bico duplo (MMU/AMS) ou pintura manual pós-impressão. Imprime-se tudo em uma única peça rígida.
              </p>
              <p>
                <strong>Montagem Modular (Fatiado):</strong> Exporte a base e as partes separadas. Imprima a base em preto/carbono e as letras/ícones em neon/branco. Os relevos possuem rebaixos que se alinham perfeitamente para aplicação de cola rápida.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TABBED PARAMETERS & LAYERS CONFIG (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* CONFIGURATION TABS CONTROL */}
          <div className="bg-white border border-[#E2E3DD] rounded-lg p-5 space-y-6">
            
            {/* Base Plate Config Block */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E3DD] pb-2">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-[#632CE5]" />
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1C19]">Geometria da Placa</h3>
                </div>
                <span className="text-[8px] font-mono text-zinc-500 uppercase">Base Plate</span>
              </div>

              {/* Grid selectors */}
              <div className="space-y-3">
                {/* Orientation selector */}
                <div>
                  <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1.5">Orientação da Placa</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfig(prev => ({
                          ...prev,
                          orientation: "horizontal",
                          width: Math.max(prev.width, prev.height),
                          height: Math.min(prev.width, prev.height)
                        }));
                      }}
                      className={`py-2.5 px-2 rounded border text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        config.orientation === "horizontal"
                          ? "border-[#632CE5] text-[#632CE5] bg-[#632CE5]/5"
                          : "border-[#E8E9E3] text-zinc-500 hover:border-[#E8E9E3] bg-white/40"
                      }`}
                    >
                      <span className="text-base">▬</span> Horizontal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfig(prev => ({
                          ...prev,
                          orientation: "vertical",
                          width: Math.min(prev.width, prev.height),
                          height: Math.max(prev.width, prev.height)
                        }));
                      }}
                      className={`py-2.5 px-2 rounded border text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        config.orientation === "vertical"
                          ? "border-[#632CE5] text-[#632CE5] bg-[#632CE5]/5"
                          : "border-[#E8E9E3] text-zinc-500 hover:border-[#E8E9E3] bg-white/40"
                      }`}
                    >
                      <span className="text-base">▮</span> Vertical
                    </button>
                  </div>
                  <p className="text-[7px] text-zinc-500 mt-1 leading-relaxed">
                    {config.orientation === "horizontal"
                      ? "Placa horizontal — ideal para nomes, frases e textos longos."
                      : "Placa vertical — ideal para listas, placas de identificação e colunas."}
                  </p>
                </div>

                <div>
                  <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1.5">Formato da Placa</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "rounded_rect", label: "Retângulo" },
                      { id: "circle", label: "Círculo" },
                      { id: "oval", label: "Elipse/Oval" },
                      { id: "hexagon", label: "Hexágono" },
                      { id: "shield", label: "Escudo" },
                      { id: "banner", label: "Estandarte" },
                      { id: "text_based", label: "Texto Base" }
                    ].map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        onClick={() => {
                          setConfig(prev => ({
                            ...prev,
                            shape: shape.id as any,
                            borderRadius: shape.id === "rounded_rect" ? 12 : 0 // auto radius defaults
                          }));
                        }}
                        className={`py-2 px-1.5 rounded border text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                          config.shape === shape.id
                            ? "border-[#632CE5] text-[#632CE5] bg-[#632CE5]/5"
                            : "border-[#E8E9E3] text-zinc-500 hover:border-[#E8E9E3] bg-white/40"
                        }`}
                      >
                        {shape.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimensions inputs */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Dimensões (mm)</label>
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        width: prev.height,
                        height: prev.width
                      }))}
                      className="bg-[#E8E9E3] hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] border border-[#E8E9E3] hover:border-[#632CE5]/30 px-2 py-0.5 rounded text-[7px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer"
                      title="Inverter largura e altura"
                    >
                      ⇄ Inverter
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[7.5px] font-mono text-zinc-400 block mb-0.5">Largura</label>
                      <input 
                        type="number" 
                        min="50" 
                        max="300"
                        value={config.width}
                        onChange={(e) => setConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 100 }))}
                        className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[7.5px] font-mono text-zinc-400 block mb-0.5">Altura</label>
                      <input 
                        type="number" 
                        min="50" 
                        max="300"
                        value={config.height}
                        onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 100 }))}
                        className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full font-mono"
                      />
                    </div>
                  </div>
                  {/* Quick size presets */}
                  <div className="flex gap-1 mt-1.5">
                    {[
                      { label: "Peq", w: 120, h: 80 },
                      { label: "Méd", w: 160, h: 100 },
                      { label: "Gra", w: 200, h: 120 },
                      { label: "XG", w: 250, h: 150 }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          width: config.orientation === "horizontal" ? preset.w : preset.h,
                          height: config.orientation === "horizontal" ? preset.h : preset.w
                        }))}
                        className="flex-1 bg-[#E8E9E3] hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] border border-[#E8E9E3] hover:border-[#632CE5]/30 py-0.5 rounded text-[7px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                  </div>
                </div>

                {/* Thickness and round corners */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Espessura (mm)</label>
                    <input 
                      type="number" 
                      min="2" 
                      max="20"
                      value={config.thickness}
                      onChange={(e) => setConfig(prev => ({ ...prev, thickness: parseInt(e.target.value) || 6 }))}
                      className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Cantos Arredondados (mm)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="40"
                      disabled={config.shape !== "rounded_rect"}
                      value={config.borderRadius}
                      onChange={(e) => setConfig(prev => ({ ...prev, borderRadius: parseInt(e.target.value) || 0 }))}
                      className="bg-white/80 border border-[#E8E9E3] disabled:opacity-30 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full font-mono"
                    />
                  </div>
                </div>

                {/* Decorative border outline styling */}
                <div className="grid grid-cols-2 gap-3 border-t border-[#E2E3DD]/60 pt-3">
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Estilo de Borda</label>
                    <select
                      value={config.borderStyle}
                      onChange={(e) => setConfig(prev => ({ ...prev, borderStyle: e.target.value as any }))}
                      className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full cursor-pointer font-mono"
                    >
                      <option value="none">Nenhuma</option>
                      <option value="relief">Borda em Relevo</option>
                      <option value="indented">Borda Escavada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Largura Borda (mm)</label>
                    <input 
                      type="number" 
                      min="2" 
                      max="15"
                      disabled={config.borderStyle === "none"}
                      value={config.borderWidth}
                      onChange={(e) => setConfig(prev => ({ ...prev, borderWidth: parseInt(e.target.value) || 5 }))}
                      className="bg-white/80 border border-[#E8E9E3] disabled:opacity-30 rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full font-mono"
                    />
                  </div>
                </div>

                {/* Material style and Mounting holes options */}
                <div className="grid grid-cols-2 gap-3 border-t border-[#E2E3DD]/60 pt-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Orifícios</label>
                      <button
                        type="button"
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          mountingHoles: prev.orientation === "horizontal" ? "two_sides" : "top_center"
                        }))}
                        className="bg-[#E8E9E3] hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] border border-[#E8E9E3] hover:border-[#632CE5]/30 px-1.5 py-0 rounded text-[6.5px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer"
                        title="Recomendado para orientação atual"
                      >
                        Auto
                      </button>
                    </div>
                    <select
                      value={config.mountingHoles}
                      onChange={(e) => setConfig(prev => ({ ...prev, mountingHoles: e.target.value as any }))}
                      className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full cursor-pointer font-mono"
                    >
                      <option value="none">Nenhum furo</option>
                      <option value="top_center">1 furo topo centro</option>
                      <option value="two_sides">2 furos laterais</option>
                      <option value="four_corners">4 furos nos cantos</option>
                    </select>
                    <p className="text-[6.5px] text-zinc-500 mt-0.5 leading-relaxed">
                      {config.orientation === "horizontal" 
                        ? "Recomendado: 2 furos laterais para fixação em parede horizontal."
                        : "Recomendado: 1 furo topo centro para fixação em parede vertical."}
                    </p>
                  </div>
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Material</label>
                    <select
                      value={config.materialFinish}
                      onChange={(e) => setConfig(prev => ({ ...prev, materialFinish: e.target.value as any }))}
                      className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full cursor-pointer font-mono"
                    >
                      <option value="carbon">Fibra de Carbono (Preto)</option>
                      <option value="matte">Fosco Orgânico (Matte)</option>
                      <option value="glossy">Polido Brilhante (Glossy)</option>
                      <option value="wood">Fibra Amadeirada (Wood)</option>
                      <option value="textured">Texturizado FDM (Grip)</option>
                    </select>
                  </div>
                </div>

                {/* Base Plate Color Preset Picker */}
                <div className="space-y-1.5">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">Paleta de Cor da Placa Base</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "#1c1c1c", // Charcoal Dark
                      "#2A2A35", // Technical Blue
                      "#442A2A", // Dark Crimson
                      "#122B21", // Forest Green
                      "#D4AF37", // Gold
                      "#FFFFFF", // Pure White
                    ].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, color: col }))}
                        className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                          config.color === col ? "ring-2 ring-[#632CE5] border-whiteScale" : "border-[#E8E9E3] hover:scale-105"
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>

            {/* Visual Overlapping Layers Control Block */}
            <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#632CE5]" />
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1C19]">Sobreposição de Camadas ({layers.length})</h3>
                </div>
                <div className="flex gap-1.5">
                  {/* Undo/Redo buttons */}
                  <button
                    type="button"
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="bg-white border border-[#E8E9E3] text-zinc-400 hover:text-[#632CE5] hover:border-[#632CE5]/30 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider cursor-pointer"
                    title="Desfazer (Ctrl+Z)"
                  >
                    ↩
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={historyIndex >= layersHistory.length - 1}
                    className="bg-white border border-[#E8E9E3] text-zinc-400 hover:text-[#632CE5] hover:border-[#632CE5]/30 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider cursor-pointer"
                    title="Refazer (Ctrl+Y)"
                  >
                    ↪
                  </button>
                  <input
                    ref={svgFileInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={handleSvgFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddTextLayer}
                    className="bg-[#632CE5]/10 text-[#632CE5] hover:bg-[#632CE5]/20 px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> + TEXTO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddIconLayer("heart")}
                    className="bg-[#E8E9E3] text-zinc-300 hover:bg-[#F9FAF4] px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> + ÍCONE
                  </button>
                  <button
                    type="button"
                    onClick={() => svgFileInputRef.current?.click()}
                    title="Importar um arquivo .svg (ex: exportado do Design Editor)"
                    className="bg-[#E8E9E3] text-zinc-300 hover:bg-[#F9FAF4] px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <FileCode className="w-3 h-3" /> + SVG
                  </button>
                </div>
              </div>

              {/* LIST OF CURRENT OVERLAPPING LAYERS */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {layers.length === 0 ? (
                  <div className="text-center py-4 bg-white/40 border border-[#E2E3DD]/60 rounded text-[10px] text-zinc-500 uppercase">
                    Nenhuma camada sobreposta. Adicione um texto, ícone ou SVG acima!
                  </div>
                ) : (
                  layers.map((layer, idx) => {
                    const isSelected = activeLayerId === layer.id;
                    return (
                      <div
                        key={layer.id}
                        onClick={() => setActiveLayerId(layer.id)}
                        className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                          isSelected 
                            ? "border-[#632CE5] bg-[#632CE5]/5 shadow-[0_0_8px_rgba(124,58,237,0.05)]" 
                            : "border-[#E2E3DD] bg-white/20 hover:border-[#E8E9E3]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Color bubble */}
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: layer.color }} 
                          />
                          <div className="flex items-center gap-1">
                            {layer.type === "text" ? (
                              <Type className="w-3 h-3 text-zinc-500 shrink-0" />
                            ) : layer.type === "icon" ? (
                              <Sparkles className="w-3 h-3 text-zinc-500 shrink-0" />
                            ) : (
                              <FileCode className="w-3 h-3 text-zinc-500 shrink-0" />
                            )}
                            <span className="text-[10px] font-bold text-[#1A1C19] truncate max-w-[110px] font-mono uppercase">
                              {layer.type === "text" 
                                ? `"${layer.content}"` 
                                : layer.type === "icon" 
                                  ? `ÍCONE: ${layer.content}` 
                                  : "ARTE SVG"}
                            </span>
                          </div>
                        </div>

                        {/* Layer order & action controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateActiveLayerField("visible", !layer.visible);
                            }}
                            className="p-1 text-zinc-500 hover:text-[#1A1C19] transition-colors"
                          >
                            {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-red-500" />}
                          </button>
                          
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveLayerOrder(idx, "up");
                            }}
                            className="p-0.5 text-zinc-500 hover:text-[#1A1C19] disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Mover para Trás"
                          >
                            <ArrowUpDown className="w-3 h-3 rotate-180" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDuplicateLayer(layer, e)}
                            className="p-1 text-zinc-500 hover:text-[#1A1C19] transition-colors"
                            title="Duplicar"
                          >
                            <Copy className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteLayer(layer.id, e)}
                            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* SELECTED LAYER PROPERTIES CONTROL */}
            {activeLayer && (
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD] bg-white rounded-lg">
                <div className="flex items-center justify-between border-b border-[#E2E3DD] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#632CE5]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1A1C19]">Ajustes da Camada Selecionada</span>
                  </div>
                  <span className="text-[7.5px] font-mono bg-[#632CE5]/10 text-[#632CE5] px-1.5 py-0.5 rounded uppercase">
                    {activeLayer.type}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Layer text / icon / svg content editor */}
                  <div>
                    <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">
                      {activeLayer.type === "text" ? "Editar Texto" : activeLayer.type === "icon" ? "Tipo de Ícone" : "Arte Importada"}
                    </label>
                    {activeLayer.type === "text" ? (
                      <input 
                        type="text"
                        value={activeLayer.content}
                        onChange={(e) => updateActiveLayerField("content", e.target.value.toUpperCase())}
                        className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full font-mono uppercase"
                      />
                    ) : activeLayer.type === "icon" ? (
                      <select
                        value={activeLayer.content}
                        onChange={(e) => updateActiveLayerField("content", e.target.value)}
                        className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full cursor-pointer font-mono"
                      >
                        <option value="heart">Coração (Love)</option>
                        <option value="star">Estrela (Star)</option>
                        <option value="gamepad">Controle Gamer (Console)</option>
                        <option value="lightning">Raio de Força (Lightning)</option>
                        <option value="crown">Realeza (Crown)</option>
                        <option value="coffee">Copo/Caneca (Coffee)</option>
                        <option value="gear">Engrenagem (Gear)</option>
                        <option value="music">Símbolo de Música</option>
                        <option value="skull">Caveira (Skull)</option>
                        <option value="flame">Fogo/Chama (Flame)</option>
                        <option value="ghost">Fantasma Retro (Ghost)</option>
                        <option value="rocket">Foguete Espacial (Rocket)</option>
                        <option value="shield">Brasão de Escudo</option>
                      </select>
                    ) : (
                      <div className="bg-white/60 border border-[#E8E9E3] rounded px-2.5 py-2 text-[9.5px] text-zinc-500 font-mono uppercase">
                        Vetor importado (~{Math.max(1, Math.round(activeLayer.content.length / 1024))} KB de dados SVG). Exclua e importe novamente para trocar.
                      </div>
                    )}
                  </div>

                  {/* Font family picker (text layers only) */}
                  {activeLayer.type === "text" && (
                    <div>
                      <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">
                        Família da Fonte
                      </label>
                      <select
                        value={activeLayer.fontFamily || "helvetiker_regular"}
                        onChange={(e) => {
                          updateActiveLayerField("fontFamily", e.target.value);
                          loadFont(e.target.value);
                        }}
                        className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full cursor-pointer font-mono"
                      >
                        {Object.entries(FONT_REGISTRY).map(([id, font]) => (
                          <option key={id} value={id}>
                            {font.name} — {font.style}
                            {fontLoadingStates[id] === "loading" ? " (carregando...)" : ""}
                            {fontLoadingStates[id] === "error" ? " (falhou)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Boolean operation mode */}
                  <div>
                    <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">
                      Modo Booleano
                    </label>
                    <select
                      value={activeLayer.booleanMode || "none"}
                      onChange={(e) => updateActiveLayerField("booleanMode", e.target.value)}
                      className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1.5 text-xs text-[#212121] outline-none w-full cursor-pointer font-mono"
                    >
                      <option value="none">Nenhum (sobrepor)</option>
                      <option value="union">Unir (solder com base)</option>
                      <option value="subtract">Subtrair (escavar na base)</option>
                      <option value="intersect">Interseção (apenas sobreposição)</option>
                    </select>
                    <p className="text-[7px] text-zinc-500 mt-1 leading-relaxed">
                      {activeLayer.booleanMode === "subtract"
                        ? "Esta camada será escavada/cortada da placa base."
                        : activeLayer.booleanMode === "union"
                          ? "Esta camada será fundida à placa base em uma peça única."
                          : activeLayer.booleanMode === "intersect"
                            ? "Apenas a interseção desta camada com a base será mantida."
                            : "Camada independente, sobreposta à base."}
                    </p>
                  </div>

                  {/* Position X & Y with numeric inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>POSIÇÃO X (mm)</span>
                        <input
                          type="number"
                          value={Math.round(activeLayer.x * 10)}
                          onChange={(e) => updateActiveLayerField("x", parseFloat(e.target.value) / 10 || 0)}
                          className="w-12 text-right bg-transparent text-[#632CE5] outline-none font-mono text-[8px]"
                          step="1"
                        />
                      </div>
                      <input 
                        type="range" 
                        min="-15" 
                        max="15" 
                        step="0.1"
                        value={activeLayer.x}
                        onChange={(e) => updateActiveLayerField("x", parseFloat(e.target.value))}
                        className="w-full accent-[#632CE5] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>POSIÇÃO Y (mm)</span>
                        <input
                          type="number"
                          value={Math.round(activeLayer.y * 10)}
                          onChange={(e) => updateActiveLayerField("y", parseFloat(e.target.value) / 10 || 0)}
                          className="w-12 text-right bg-transparent text-[#632CE5] outline-none font-mono text-[8px]"
                          step="1"
                        />
                      </div>
                      <input 
                        type="range" 
                        min="-15" 
                        max="15" 
                        step="0.1"
                        value={activeLayer.y}
                        onChange={(e) => updateActiveLayerField("y", parseFloat(e.target.value))}
                        className="w-full accent-[#632CE5] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Alignment tools */}
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => updateActiveLayerField("x", 0)}
                      className="flex-1 bg-[#E8E9E3] hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] border border-[#E8E9E3] hover:border-[#632CE5]/30 px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer"
                      title="Centralizar horizontalmente"
                    >
                      ← Centro X →
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveLayerField("y", 0)}
                      className="flex-1 bg-[#E8E9E3] hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] border border-[#E8E9E3] hover:border-[#632CE5]/30 px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer"
                      title="Centralizar verticalmente"
                    >
                      ↓ Centro Y ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => { updateActiveLayerField("x", 0); updateActiveLayerField("y", 0); }}
                      className="flex-1 bg-[#632CE5]/10 hover:bg-[#632CE5]/20 text-[#632CE5] border border-[#632CE5]/30 px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer"
                      title="Centralizar ambos os eixos"
                    >
                      ⊕ Centro
                    </button>
                  </div>

                  {/* Scale & Depth with numeric inputs + flip buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>ESCALA</span>
                        <input
                          type="number"
                          value={activeLayer.size}
                          onChange={(e) => updateActiveLayerField("size", Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                          className="w-12 text-right bg-transparent text-[#632CE5] outline-none font-mono text-[8px]"
                          step="0.1"
                          min="0.1"
                        />
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="12.0" 
                        step="0.05"
                        value={activeLayer.size}
                        onChange={(e) => updateActiveLayerField("size", parseFloat(e.target.value))}
                        className="w-full accent-[#632CE5] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>ALTURA (Z mm)</span>
                        <input
                          type="number"
                          value={activeLayer.depth}
                          onChange={(e) => updateActiveLayerField("depth", Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                          className="w-12 text-right bg-transparent text-[#632CE5] outline-none font-mono text-[8px]"
                          step="0.5"
                          min="0.1"
                        />
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="15" 
                        step="0.1"
                        value={activeLayer.depth}
                        onChange={(e) => updateActiveLayerField("depth", parseFloat(e.target.value))}
                        className="w-full accent-[#632CE5] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Rotation with numeric input + quick angle buttons */}
                  <div>
                    <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                      <span>ROTAÇÃO (GRAUS)</span>
                      <input
                        type="number"
                        value={activeLayer.rotation}
                        onChange={(e) => updateActiveLayerField("rotation", parseInt(e.target.value) || 0)}
                        className="w-12 text-right bg-transparent text-[#632CE5] outline-none font-mono text-[8px]"
                        step="1"
                      />
                    </div>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="1"
                      value={activeLayer.rotation}
                      onChange={(e) => updateActiveLayerField("rotation", parseInt(e.target.value))}
                      className="w-full accent-[#632CE5] cursor-pointer"
                    />
                    <div className="flex gap-1 mt-1">
                      {[-90, -45, 0, 45, 90, 180].map(angle => (
                        <button
                          key={angle}
                          type="button"
                          onClick={() => updateActiveLayerField("rotation", angle)}
                          className={`flex-1 py-0.5 rounded text-[7px] font-mono font-bold transition-all cursor-pointer ${
                            activeLayer.rotation === angle 
                              ? "bg-[#632CE5] text-white" 
                              : "bg-[#E8E9E3] text-zinc-500 hover:bg-[#632CE5]/10 hover:text-[#632CE5]"
                          }`}
                        >
                          {angle}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Flip / Mirror buttons */}
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => updateActiveLayerField("flipX" as any, !(activeLayer as any).flipX)}
                      className={`flex-1 border px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer ${
                        (activeLayer as any).flipX 
                          ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" 
                          : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-500 hover:text-[#632CE5] hover:border-[#632CE5]/30"
                      }`}
                      title="Espelhar horizontalmente"
                    >
                      ⇔ Espelhar X
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveLayerField("flipY" as any, !(activeLayer as any).flipY)}
                      className={`flex-1 border px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer ${
                        (activeLayer as any).flipY 
                          ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" 
                          : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-500 hover:text-[#632CE5] hover:border-[#632CE5]/30"
                      }`}
                      title="Espelhar verticalmente"
                    >
                      ⇕ Espelhar Y
                    </button>
                  </div>

                  {/* Extruded vs Engraved selector styles */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Tipo de Junção</label>
                      <select
                        value={activeLayer.style}
                        onChange={(e) => updateActiveLayerField("style", e.target.value as any)}
                        className="bg-white/80 border border-[#E8E9E3] rounded px-2.5 py-1 text-[10px] text-[#212121] outline-none w-full cursor-pointer font-mono"
                      >
                        <option value="raised">Relevo Sobressaído</option>
                        <option value="engraved">Baixo Relevo (Escavado)</option>
                      </select>
                    </div>
                    
                    {/* Layer Color Picker presets */}
                    <div>
                      <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Cor da Peça</label>
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {[
                          "#632CE5", // Cyan
                          "#FF1744", // Red
                          "#00FF41", // Green
                          "#FFEA00", // Yellow
                          "#FFFFFF", // White
                          "#FF9100", // Orange
                        ].map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => updateActiveLayerField("color", col)}
                            className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                              activeLayer.color === col ? "ring-2 ring-white scale-110" : "border-[#E8E9E3] hover:scale-105"
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* TEMPLATE/PRESETS SECTION */}
          <div className="bg-white border border-[#E2E3DD] rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E2E3DD] pb-2">
              <BookOpen className="w-4 h-4 text-[#632CE5]" />
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1C19]">Modelos e Presets de Inspiração</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {PLATE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="bg-white/40 hover:bg-[#E8E9E3]/60 border border-[#E2E3DD] hover:border-[#E8E9E3] p-2.5 rounded text-left transition-all cursor-pointer flex flex-col justify-between h-[65px]"
                >
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-[#1A1C19] truncate w-full">{preset.name}</span>
                  <p className="text-[8px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* EXPORTING PANEL FOR 3D PRINTING */}
          <div className="bg-white border border-[#E2E3DD] rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E2E3DD] pb-2">
              <Download className="w-4 h-4 text-[#632CE5]" />
              <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1C19]">Exportação e Slicing 3D</h3>
            </div>

            <div className="space-y-3 text-[10.5px] text-zinc-400">
              <p className="leading-relaxed">
                Nossos arquivos são exportados no formato binário <strong>STL universal</strong> compatível com fatiadores populares (Cura, Bambu Studio, PrusaSlicer).
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleExportSTL("combined")}
                  className="w-full bg-[#E8E9E3] hover:bg-[#F9FAF4] text-zinc-300 hover:text-[#212121] border border-[#E8E9E3] px-3 py-2.5 rounded font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-[#632CE5]" />
                  <span>Exportar Placa Unificada (Uma só Peça)</span>
                </button>

                <div className="border-t border-[#E2E3DD]/60 my-2 pt-2">
                  <div className="flex items-center gap-1 mb-2 text-[#632CE5] text-[9.5px] uppercase font-bold tracking-widest">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fatiamento Modular para Colar</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportSTL("separated_plate")}
                      className="bg-[#632CE5]/10 hover:bg-[#632CE5]/20 text-[#632CE5] border border-[#632CE5]/30 px-3 py-2 rounded text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Baixar apenas a base com slots guia de montagem"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>1. Baixar Base</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSTL("separated_layers")}
                      className="bg-[#632CE5]/10 hover:bg-[#632CE5]/20 text-[#632CE5] border border-[#632CE5]/30 px-3 py-2 rounded text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Baixar cada letra ou ícone como STL individual plano para colar"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>2. Baixar Letras</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SAVED PLATES LIBRARY PANEL */}
          <div className="bg-white border border-[#E2E3DD] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E3DD] pb-2">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-zinc-400" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A1C19]">Minhas Placas Salvas Localmente</h3>
              </div>
              {savedLibrary.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Deseja realmente limpar seus projetos salvos?")) {
                      setSavedLibrary([]);
                      localStorage.removeItem("vertice_saved_plates_library");
                    }
                  }}
                  className="text-[8px] font-mono text-red-400 hover:underline"
                >
                  Limpar Biblioteca
                </button>
              )}
            </div>

            {savedLibrary.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 font-mono text-[9px] uppercase">
                Nenhum projeto salvo na biblioteca ainda.
              </div>
            ) : (
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {savedLibrary.map((plate) => (
                  <div
                    key={plate.id}
                    onClick={() => loadSavedPlate(plate)}
                    className="group bg-white/40 hover:bg-[#E8E9E3]/40 p-2.5 rounded border border-[#E2E3DD] hover:border-[#E8E9E3] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-[#1A1C19] group-hover:text-[#632CE5] transition-colors uppercase truncate block">
                        {plate.name}
                      </span>
                      <span className="text-[7.5px] font-mono text-zinc-500 block uppercase mt-0.5">
                        {plate.config.shape} • {plate.layers.length} camadas
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSavedPlate(plate.id, e)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 rounded hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

    </div>
  );
}