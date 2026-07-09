import { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  Sparkles, Layers, Download, Plus, Trash2, Sliders, HelpCircle,
  Eye, EyeOff, RotateCcw, Copy, Folder, BookOpen, Save, FileDown,
  Info, Settings, LayoutGrid, Check, AlertTriangle, ArrowUpDown, Move, Type
} from "lucide-react";

// Types
interface PlateLayer {
  id: string;
  type: "text" | "icon";
  content: string; // The text content or the icon ID
  x: number;       // Position X offset
  y: number;       // Position Y offset
  size: number;    // Scale / Font Size
  depth: number;   // Z Extrusion depth
  rotation: number; // Angle in degrees
  color: string;   // Color in hex
  visible: boolean;
  style: "raised" | "engraved"; // raised = sticks out, engraved = slots inside
}

interface PlateConfig {
  shape: "rounded_rect" | "circle" | "oval" | "hexagon" | "shield" | "banner" | "text_based";
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
  const geom = useMemo(() => {
    return new TextGeometry(layer.content, {
      font: font,
      size: layer.size / 10,
      depth: layer.depth / 10,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.015,
      bevelSegments: 3
    });
  }, [layer.content, layer.size, layer.depth, font]);

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

// 3D Canvas rendering component
function Scene({ 
  config, 
  layers, 
  activeLayerId,
  font, 
  explodedView,
  showWireframe,
  setActiveLayerId,
  updateLayerPosition,
  setControlsEnabled
}: { 
  config: PlateConfig; 
  layers: PlateLayer[]; 
  activeLayerId: string | null;
  font: Font | null;
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

  const plateBaseShape = useMemo(() => {
    return getPlateBaseShape(config, layers);
  }, [config, layers]);

  const extrudeSettings = useMemo(() => ({
    steps: 1,
    depth: config.thickness / 10,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 3,
  }), [config.thickness]);

  // Determine material texture parameters
  const materialProps = useMemo(() => {
    const base = {
      color: config.color,
      roughness: 0.4,
      metalness: 0.1,
      wireframe: showWireframe
    };

    if (config.materialFinish === "glossy") {
      base.roughness = 0.1;
      base.metalness = 0.3;
    } else if (config.materialFinish === "matte") {
      base.roughness = 0.8;
      base.metalness = 0.0;
    } else if (config.materialFinish === "textured") {
      base.roughness = 0.9;
      base.metalness = 0.05;
    } else if (config.materialFinish === "wood") {
      base.color = "#8B5A2B"; // Warm wood tone
      base.roughness = 0.7;
    } else if (config.materialFinish === "carbon") {
      base.color = "#151515"; // Dark carbon fiber base
      base.roughness = 0.3;
      base.metalness = 0.8;
    }
    return base;
  }, [config.color, config.materialFinish, showWireframe]);

  // Handle auto-render refresh on parameter changes
  useEffect(() => {
    invalidate();
  }, [config, layers, activeLayerId, font, explodedView, showWireframe, invalidate]);

  return (
    <group position={[0, 0, 0]}>
      {/* 1. BASE PLATE MESH */}
      {config.shape !== "text_based" && (
        <mesh 
          castShadow 
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            setActiveLayerId(null);
          }}
        >
          <extrudeGeometry args={[plateBaseShape, extrudeSettings]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}

      {/* Plate Border Line Relief decoration */}
      {config.borderStyle !== "none" && config.shape !== "text_based" && (
        <mesh 
          position={[0, 0, (config.thickness / 10) + (config.borderStyle === "relief" ? 0.05 : -0.05)]}
          onClick={(e) => {
            e.stopPropagation();
            setActiveLayerId(null);
          }}
        >
          <extrudeGeometry args={[
            // slightly smaller shape for borders
            getPlateBaseShape({
              ...config,
              width: config.width - (config.borderWidth * 2),
              height: config.height - (config.borderWidth * 2),
              borderRadius: Math.max(1, config.borderRadius - config.borderWidth),
              mountingHoles: "none" // no holes in border contour
            }), 
            {
              steps: 1,
              depth: config.borderHeight / 10,
              bevelEnabled: false
            }
          ]} />
          <meshStandardMaterial 
            color={config.borderStyle === "relief" ? "#00E5FF" : "#0d0d0d"}
            roughness={0.5}
            metalness={0.2}
            wireframe={showWireframe}
          />
        </mesh>
      )}

      {/* 2. OVERLAPPING TEXT AND ICON LAYERS */}
      {layers.map((layer, index) => {
        if (!layer.visible) return null;

        const isSelected = activeLayerId === layer.id;
        // Apply explosion lift factor: moves the layer out in +Z axis
        const zOffset = (config.thickness / 10) + (explodedView * index * 1.5) + (layer.style === "engraved" ? -0.1 : 0.01);
        const rotationRad = (layer.rotation * Math.PI) / 180;

        return (
          <group 
            key={layer.id} 
            position={[layer.x, layer.y, zOffset]} 
            rotation={[0, 0, rotationRad]}
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
            ) : (
              // Text Rendering: use Text from drei for high fidelity client display OR extruded TextGeometry if loaded
              font ? (
                <TextMesh 
                  layer={layer} 
                  font={font} 
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
                <meshBasicMaterial color="#00E5FF" side={THREE.DoubleSide} />
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
        color: "#00E5FF",
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
    width: 160,
    height: 100,
    thickness: 6,
    borderRadius: 10,
    color: "#1c1c1c",
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
      color: "#00E5FF",
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
  const [font, setFont] = useState<Font | null>(null);
  const [fontLoadingState, setFontLoadingState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [plateName, setPlateName] = useState<string>("Minha Placa Decorativa");
  const [savedLibrary, setSavedLibrary] = useState<SavedPlate[]>([]);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [controlsEnabled, setControlsEnabled] = useState<boolean>(true);

  // Font loading system
  useEffect(() => {
    if (fontLoadingState === "idle") {
      setFontLoadingState("loading");
      const loader = new FontLoader();
      // Fetch Helvetica-like regular json font from unpkg standard Three.js mirror
      loader.load(
        "https://unpkg.com/three@0.150.0/examples/fonts/helvetiker_regular.typeface.json",
        (loadedFont) => {
          setFont(loadedFont);
          setFontLoadingState("loaded");
        },
        undefined,
        (err) => {
          console.error("FontLoader failed to load web typeface:", err);
          setFontLoadingState("error");
        }
      );
    }
  }, [fontLoadingState]);

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
      style: "raised"
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  const handleAddIconLayer = (iconType: string) => {
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
      color: "#00E5FF",
      visible: true,
      style: "raised"
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  const handleDeleteLayer = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) {
      setActiveLayerId(null);
    }
  };

  const handleDuplicateLayer = (layer: PlateLayer, e: React.MouseEvent) => {
    e.stopPropagation();
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
    
    const reordered = [...layers];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setLayers(reordered);
  };

  // Preset loading
  const loadPreset = (preset: typeof PLATE_PRESETS[0]) => {
    setConfig({ ...preset.config });
    setLayers(preset.layers.map(l => ({ ...l, id: `${l.type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` })));
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
    setConfig(plate.config);
    setLayers(plate.layers);
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

  const showSuccessNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // STL EXPORT ENGINE (Dual Mode: Combined or Exploded separated for gluing)
  const handleExportSTL = (mode: "combined" | "separated_plate" | "separated_layers") => {
    try {
      const exporter = new STLExporter();
      
      if (mode === "combined") {
        // Mode 1: Combined full plate as one piece
        const group = new THREE.Group();
        
        // Add Base plate mesh
        const baseShape = getPlateBaseShape(config, layers);
        const extrudeSettings = {
          steps: 1,
          depth: config.thickness / 10,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 3,
        };
        const baseMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(baseShape, extrudeSettings));
        group.add(baseMesh);

        // Add border relief if enabled
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

        // Add active visible layers
        layers.forEach((layer) => {
          if (!layer.visible) return;
          const rotationRad = (layer.rotation * Math.PI) / 180;
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
          } else if (layer.type === "text" && font) {
            layerMesh = new THREE.Mesh(
              new TextGeometry(layer.content, {
                font: font,
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

          if (layerMesh) {
            layerMesh.position.set(layer.x, layer.y, (config.thickness / 10) + (layer.style === "engraved" ? -0.1 : 0.01));
            layerMesh.rotation.set(0, 0, rotationRad);
            group.add(layerMesh);
          }
        });

        // Parse and export
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
          } else if (layer.type === "text" && font) {
            guideMesh = new THREE.Mesh(
              new TextGeometry(layer.content, {
                font: font,
                size: layer.size / 10,
                depth: 0.04,
                curveSegments: 8,
                bevelEnabled: false
              })
            );
          }

          if (guideMesh) {
            // align with the face of the plate
            guideMesh.position.set(layer.x, layer.y, (config.thickness / 10) - 0.02);
            guideMesh.rotation.set(0, 0, rotationRad);
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
          } else if (layer.type === "text" && font) {
            layerMesh = new THREE.Mesh(
              new TextGeometry(layer.content, {
                font: font,
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

          if (layerMesh) {
            // Export centered on flat origin (0, 0, 0) for clean slicing!
            group.add(layerMesh);
            const result = exporter.parse(group, { binary: true });
            const label = layer.type === "text" ? layer.content.substring(0, 8) : layer.content;
            triggerDownload(result, `${plateName.toLowerCase().replace(/\s+/g, "-")}-PECA-${idx + 1}-${label}.stl`);
            exportedCount++;
          }
        });

        if (exportedCount > 0) {
          showSuccessNotification(`Exportados ${exportedCount} arquivos de peças separados!`);
        } else {
          alert("Nenhuma camada visível para exportar.");
        }
      }
    } catch (err) {
      console.error("Export generation failed:", err);
      alert("Houve um erro ao gerar o arquivo STL.");
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
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 space-y-8 font-sans bg-[#080808] text-white">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00E5FF] animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono font-extrabold text-[#00E5FF]">LABORATÓRIO 3D</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Criador de Placas Decorativas 3D
          </h1>
          <p className="text-xs text-zinc-500 max-w-xl">
            Crie placas com relevos sobrepostos, emojis e logotipos personalizados. Exporte unificado ou fatiado em partes separadas para colar após imprimir em cores diferentes!
          </p>
        </div>

        {/* Input Name Plate */}
        <div className="flex items-center gap-2 w-full md:w-auto bg-[#0d0d0d] p-1 border border-zinc-900 rounded-lg">
          <input 
            type="text" 
            value={plateName}
            onChange={(e) => setPlateName(e.target.value)}
            className="bg-black/40 text-[11px] font-bold uppercase tracking-wider px-3 py-2 border-0 outline-none focus:ring-1 focus:ring-[#00E5FF] rounded text-white w-full md:w-[220px]"
            placeholder="Nome do Projeto..."
          />
          <button 
            onClick={handleSaveToLibrary}
            className="p-2 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30 rounded transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Salvar Projeto Atual na Biblioteca"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUCCESS POPUP ALERT */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[#0d0d0d] border-2 border-emerald-500/50 text-emerald-400 font-mono text-[10px] uppercase font-black tracking-wider py-3.5 px-6 rounded-lg shadow-[0_4px_30px_rgba(16,185,129,0.15)] flex items-center gap-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: 3D INTERACTIVE VIEWPORT (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="relative aspect-[4/3] w-full bg-[#0d0d0d] border border-zinc-900 rounded-lg overflow-hidden shadow-2xl flex flex-col justify-between">
            
            {/* Viewport header tags */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur border border-zinc-800/80 px-2.5 py-1 rounded font-mono text-[8.5px] text-zinc-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>PREVIEW EM TEMPO REAL (3D)</span>
            </div>

            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
              <button
                onClick={() => setShowWireframe(!showWireframe)}
                className={`p-1.5 rounded backdrop-blur text-[8px] font-mono border transition-all cursor-pointer ${
                  showWireframe 
                    ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/40" 
                    : "bg-black/60 text-zinc-400 border-zinc-800"
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
                  font={font}
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
            <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 bg-black/80 backdrop-blur border border-zinc-900/95 p-3 rounded-md">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono text-[#00E5FF] uppercase tracking-widest block font-extrabold">Vista Explodida (Glúten Preview)</span>
                  <span className="text-[7px] text-zinc-500 uppercase">Arraste para afastar as partes</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1.5" 
                  step="0.1"
                  value={explodedView}
                  onChange={(e) => setExplodedView(parseFloat(e.target.value))}
                  className="w-24 sm:w-32 accent-[#00E5FF] cursor-pointer"
                />
                <span className="text-[9px] font-mono text-[#00E5FF] font-black">{Math.round(explodedView * 100)}%</span>
              </div>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setExplodedView(0)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 p-1 rounded cursor-pointer"
                  title="Resetar Vista"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
            </div>

          </div>

          {/* QUICK TUTORIAL OR ASSEMBLY INFO */}
          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-4 space-y-2.5">
            <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-black flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#00E5FF]" />
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
          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-5 space-y-6">
            
            {/* Base Plate Config Block */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-[#00E5FF]" />
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Geometria da Placa</h3>
                </div>
                <span className="text-[8px] font-mono text-zinc-500 uppercase">Base Plate</span>
              </div>

              {/* Grid selectors */}
              <div className="space-y-3">
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
                            ? "border-[#00E5FF] text-white bg-[#00E5FF]/5"
                            : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                        }`}
                      >
                        {shape.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimensions inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Largura (mm)</label>
                    <input 
                      type="number" 
                      min="50" 
                      max="300"
                      value={config.width}
                      onChange={(e) => setConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 100 }))}
                      className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Altura (mm)</label>
                    <input 
                      type="number" 
                      min="50" 
                      max="300"
                      value={config.height}
                      onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 100 }))}
                      className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full font-mono"
                    />
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
                      className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full font-mono"
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
                      className="bg-black/80 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-xs text-white outline-none w-full font-mono"
                    />
                  </div>
                </div>

                {/* Decorative border outline styling */}
                <div className="grid grid-cols-2 gap-3 border-t border-zinc-900/60 pt-3">
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Estilo de Borda</label>
                    <select
                      value={config.borderStyle}
                      onChange={(e) => setConfig(prev => ({ ...prev, borderStyle: e.target.value as any }))}
                      className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full cursor-pointer font-mono"
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
                      className="bg-black/80 border border-zinc-800 disabled:opacity-30 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full font-mono"
                    />
                  </div>
                </div>

                {/* Material style and Mounting holes options */}
                <div className="grid grid-cols-2 gap-3 border-t border-zinc-900/60 pt-3">
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Orifícios de Fixação</label>
                    <select
                      value={config.mountingHoles}
                      onChange={(e) => setConfig(prev => ({ ...prev, mountingHoles: e.target.value as any }))}
                      className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full cursor-pointer font-mono"
                    >
                      <option value="none">Nenhum furo</option>
                      <option value="top_center">1 furo topo centro</option>
                      <option value="two_sides">2 furos laterais</option>
                      <option value="four_corners">4 furos nos cantos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Material de Exibição</label>
                    <select
                      value={config.materialFinish}
                      onChange={(e) => setConfig(prev => ({ ...prev, materialFinish: e.target.value as any }))}
                      className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full cursor-pointer font-mono"
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
                          config.color === col ? "ring-2 ring-[#00E5FF] border-whiteScale" : "border-zinc-800 hover:scale-105"
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Visual Overlapping Layers Control Block */}
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00E5FF]" />
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Sobreposição de Camadas ({layers.length})</h3>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddTextLayer}
                    className="bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> + TEXTO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddIconLayer("heart")}
                    className="bg-zinc-900 text-zinc-300 hover:bg-zinc-800 px-2 py-1 rounded text-[8px] font-mono uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> + ÍCONE
                  </button>
                </div>
              </div>

              {/* LIST OF CURRENT OVERLAPPING LAYERS */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {layers.length === 0 ? (
                  <div className="text-center py-4 bg-black/40 border border-zinc-900/60 rounded text-[10px] text-zinc-500 uppercase">
                    Nenhuma camada sobreposta. Adicione um texto ou ícone acima!
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
                            ? "border-[#00E5FF] bg-[#00E5FF]/5 shadow-[0_0_8px_rgba(0,229,255,0.05)]" 
                            : "border-zinc-900 bg-black/20 hover:border-zinc-800"
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
                            ) : (
                              <Sparkles className="w-3 h-3 text-zinc-500 shrink-0" />
                            )}
                            <span className="text-[10px] font-bold text-white truncate max-w-[110px] font-mono uppercase">
                              {layer.type === "text" ? `"${layer.content}"` : `ÍCONE: ${layer.content}`}
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
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
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
                            className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Mover para Trás"
                          >
                            <ArrowUpDown className="w-3 h-3 rotate-180" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDuplicateLayer(layer, e)}
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
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
              <div className="space-y-4 pt-4 border-t border-zinc-900 bg-[#0d0d0d] rounded-lg">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white">Ajustes da Camada Selecionada</span>
                  </div>
                  <span className="text-[7.5px] font-mono bg-[#00E5FF]/10 text-[#00E5FF] px-1.5 py-0.5 rounded uppercase">
                    {activeLayer.type}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Layer text / icon type content editor */}
                  <div>
                    <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">
                      {activeLayer.type === "text" ? "Editar Texto" : "Tipo de Ícone"}
                    </label>
                    {activeLayer.type === "text" ? (
                      <input 
                        type="text"
                        value={activeLayer.content}
                        onChange={(e) => updateActiveLayerField("content", e.target.value.toUpperCase())}
                        className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full font-mono uppercase"
                      />
                    ) : (
                      <select
                        value={activeLayer.content}
                        onChange={(e) => updateActiveLayerField("content", e.target.value)}
                        className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none w-full cursor-pointer font-mono"
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
                    )}
                  </div>

                  {/* Sliders layout for positions X & Y */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>POSIÇÃO X (mm)</span>
                        <span className="text-[#00E5FF]">{Math.round(activeLayer.x * 10)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="-15" 
                        max="15" 
                        step="0.2"
                        value={activeLayer.x}
                        onChange={(e) => updateActiveLayerField("x", parseFloat(e.target.value))}
                        className="w-full accent-[#00E5FF] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>POSIÇÃO Y (mm)</span>
                        <span className="text-[#00E5FF]">{Math.round(activeLayer.y * 10)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="-15" 
                        max="15" 
                        step="0.2"
                        value={activeLayer.y}
                        onChange={(e) => updateActiveLayerField("y", parseFloat(e.target.value))}
                        className="w-full accent-[#00E5FF] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Font Size & Extrusion thickness sliders */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>TAMANHO / ESCALA</span>
                        <span className="text-[#00E5FF]">{activeLayer.size}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="8.0" 
                        step="0.1"
                        value={activeLayer.size}
                        onChange={(e) => updateActiveLayerField("size", parseFloat(e.target.value))}
                        className="w-full accent-[#00E5FF] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                        <span>ALTURA RELEVO (Z)</span>
                        <span className="text-[#00E5FF]">{activeLayer.depth}mm</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="15" 
                        step="0.5"
                        value={activeLayer.depth}
                        onChange={(e) => updateActiveLayerField("depth", parseFloat(e.target.value))}
                        className="w-full accent-[#00E5FF] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Rotation Angle slider */}
                  <div>
                    <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-1">
                      <span>ROTAÇÃO (GRAUS)</span>
                      <span className="text-[#00E5FF]">{activeLayer.rotation}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="5"
                      value={activeLayer.rotation}
                      onChange={(e) => updateActiveLayerField("rotation", parseInt(e.target.value))}
                      className="w-full accent-[#00E5FF] cursor-pointer"
                    />
                  </div>

                  {/* Extruded vs Engraved selector styles */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block font-bold mb-1">Tipo de Junção</label>
                      <select
                        value={activeLayer.style}
                        onChange={(e) => updateActiveLayerField("style", e.target.value as any)}
                        className="bg-black/80 border border-zinc-800 rounded px-2.5 py-1 text-[10px] text-white outline-none w-full cursor-pointer font-mono"
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
                          "#00E5FF", // Cyan
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
                              activeLayer.color === col ? "ring-2 ring-white scale-110" : "border-zinc-800 hover:scale-105"
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
          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
              <BookOpen className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Modelos e Presets de Inspiração</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {PLATE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="bg-black/40 hover:bg-zinc-900/60 border border-zinc-900 hover:border-zinc-800 p-2.5 rounded text-left transition-all cursor-pointer flex flex-col justify-between h-[65px]"
                >
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-white truncate w-full">{preset.name}</span>
                  <p className="text-[8px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* EXPORTING PANEL FOR 3D PRINTING */}
          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
              <Download className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Exportação e Slicing 3D</h3>
            </div>

            <div className="space-y-3 text-[10.5px] text-zinc-400">
              <p className="leading-relaxed">
                Nossos arquivos são exportados no formato binário <strong>STL universal</strong> compatível com fatiadores populares (Cura, Bambu Studio, PrusaSlicer).
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleExportSTL("combined")}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 px-3 py-2.5 rounded font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-[#00E5FF]" />
                  <span>Exportar Placa Unificada (Uma só Peça)</span>
                </button>

                <div className="border-t border-zinc-900/60 my-2 pt-2">
                  <div className="flex items-center gap-1 mb-2 text-[#00E5FF] text-[9.5px] uppercase font-bold tracking-widest">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fatiamento Modular para Colar</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportSTL("separated_plate")}
                      className="bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 px-3 py-2 rounded text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Baixar apenas a base com slots guia de montagem"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>1. Baixar Base</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSTL("separated_layers")}
                      className="bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 px-3 py-2 rounded text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
          <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-zinc-400" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Minhas Placas Salvas Localmente</h3>
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
                    className="group bg-black/40 hover:bg-zinc-900/40 p-2.5 rounded border border-zinc-900 hover:border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-white group-hover:text-[#00E5FF] transition-colors uppercase truncate block">
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

    </div>
  );
}
