import { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import { Upload, Download, Paintbrush, PaintBucket, Move, RotateCcw, Eye, EyeOff, Trash2, Sliders, Play, Plus, Info, Check, RefreshCw, Sparkles, Layers, Undo, Eraser, Ruler, Clock, Printer, Settings, FileJson, Save, BoxSelect, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Vibrant colors for print separation groups
const GROUPS = [
  { id: 0, name: "Base Principal (Cinza / Gray)", color: "#333333", border: "border-zinc-700" },
  { id: 1, name: "Parte 1 (Ciano / Cyan)", color: "#00E5FF", border: "border-[#00E5FF]" },
  { id: 2, name: "Parte 2 (Vermelho / Red)", color: "#FF1744", border: "border-[#FF1744]" },
  { id: 3, name: "Parte 3 (Verde / Green)", color: "#00FF41", border: "border-[#00FF41]" },
  { id: 4, name: "Parte 4 (Roxo / Purple)", color: "#D500F9", border: "border-[#D500F9]" },
];

const PRESET_COLORS = [
  "#00E5FF", // Cyan
  "#FF1744", // Red
  "#00FF41", // Green
  "#D500F9", // Purple
  "#FF9100", // Orange
  "#FF4081", // Pink
  "#FFEA00", // Yellow
  "#2979FF", // Blue
  "#FFFFFF", // White
];

// Explanatory Tooltip Component for beginners
function HelpTooltip({ text, position = "left" }: { text: string; position?: "top" | "bottom" | "left" | "right" }) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  return (
    <div className="relative group inline-flex items-center ml-1.5 select-none shrink-0 align-middle">
      <span className="text-zinc-500 hover:text-[#00E5FF] transition-colors cursor-help focus:outline-none p-0.5">
        <Info className="w-3.5 h-3.5" />
      </span>
      <div 
        className={`absolute hidden group-hover:block z-50 w-64 p-3 text-[10px] leading-relaxed font-sans normal-case font-medium text-zinc-300 bg-zinc-950 border border-zinc-800 rounded shadow-[0_6px_20px_rgba(0,0,0,0.95)] pointer-events-none transition-all duration-150 ${positionClasses[position]}`}
      >
        <p className="tracking-wide uppercase text-[#00E5FF] font-black text-[9px] mb-1">Dica de Ajuda / Help Tip</p>
        <p>{text}</p>
      </div>
    </div>
  );
}

// Helper to build adjacency list for an indexed or non-indexed BufferGeometry
function buildAdjacencyList(geometry: THREE.BufferGeometry) {
  const positionAttr = geometry.attributes.position;
  if (!positionAttr) return [];
  const count = positionAttr.count;
  const adjacency: Set<number>[] = Array.from({ length: count }, () => new Set<number>());

  const index = geometry.index;
  if (index) {
    // Indexed geometry: triangles are defined by index values
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const a = arr[i];
      const b = arr[i + 1];
      const c = arr[i + 2];
      
      adjacency[a].add(b);
      adjacency[a].add(c);
      
      adjacency[b].add(a);
      adjacency[b].add(c);
      
      adjacency[c].add(a);
      adjacency[c].add(b);
    }
  } else {
    // Non-indexed geometry: every 3 vertices define a triangle
    for (let i = 0; i < count; i += 3) {
      const a = i;
      const b = i + 1;
      const c = i + 2;
      
      adjacency[a].add(b);
      adjacency[a].add(c);
      
      adjacency[b].add(a);
      adjacency[b].add(c);
      
      adjacency[c].add(a);
      adjacency[c].add(b);
    }
  }

  return adjacency;
}

// Calculates exact physical volume of a triangulated 3D mesh (manifold) using signed tetrahedra
function calculateMeshVolume(geometry: THREE.BufferGeometry): number {
  if (!geometry) return 0;
  const position = geometry.attributes.position;
  if (!position) return 0;
  
  let totalVolume = 0;
  const count = position.count;
  const index = geometry.index;

  if (index) {
    const idxCount = index.count;
    for (let i = 0; i < idxCount; i += 3) {
      const i0 = index.getX(i);
      const i1 = index.getX(i + 1);
      const i2 = index.getX(i + 2);

      const ax = position.getX(i0);
      const ay = position.getY(i0);
      const az = position.getZ(i0);

      const bx = position.getX(i1);
      const by = position.getY(i1);
      const bz = position.getZ(i1);

      const cx = position.getX(i2);
      const cy = position.getY(i2);
      const cz = position.getZ(i2);

      const v = (
        -cx * by * az + bx * cy * az + cx * ay * bz -
        ax * cy * bz - bx * ay * cz + ax * by * cz
      ) / 6.0;
      totalVolume += v;
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      const ax = position.getX(i);
      const ay = position.getY(i);
      const az = position.getZ(i);

      const bx = position.getX(i + 1);
      const by = position.getY(i + 1);
      const bz = position.getZ(i + 1);

      const cx = position.getX(i + 2);
      const cy = position.getY(i + 2);
      const cz = position.getZ(i + 2);

      const v = (
        -cx * by * az + bx * cy * az + cx * ay * bz -
        ax * cy * bz - bx * ay * cz + ax * by * cz
      ) / 6.0;
      totalVolume += v;
    }
  }

  return Math.abs(totalVolume);
}

interface PaintableMeshProps {
  geometry: THREE.BufferGeometry;
  brushRadius: number;
  activeGroupId: number;
  paintMode: boolean;
  paintTool: "brush" | "bucket" | "eraser";
  onGeometryUpdated: () => void;
  vertexGroups: Uint8Array;
  setVertexGroups: (groups: Uint8Array) => void;
  adjacencyList: Set<number>[] | null;
  onStartAction?: () => void;
  isolateGroupId: number | null;
  groups: { id: number; name: string; color: string; border?: string }[];
}

function PaintableMesh({
  geometry,
  brushRadius,
  activeGroupId,
  paintMode,
  paintTool,
  onGeometryUpdated,
  vertexGroups,
  setVertexGroups,
  adjacencyList,
  onStartAction,
  isolateGroupId,
  groups,
}: PaintableMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Helper to get group color dynamically
  const getGroupColor = (gId: number) => {
    return groups.find((g) => g.id === gId)?.color || "#333333";
  };

  // Initialize vertex colors on load or whenever geometry changes, respecting isolateGroupId
  useEffect(() => {
    if (!geometry) return;

    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const isIsolated = isolateGroupId !== null;
    const ghostColor = new THREE.Color("#1c1c1c");

    // Populate initial colors based on existing groups and isolation state
    for (let i = 0; i < count; i++) {
      const groupId = vertexGroups[i] || 0;
      let col: THREE.Color;

      if (isIsolated) {
        if (groupId === isolateGroupId) {
          col = new THREE.Color(getGroupColor(groupId));
        } else {
          col = ghostColor;
        }
      } else {
        col = new THREE.Color(getGroupColor(groupId));
      }

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
    onGeometryUpdated();
  }, [geometry, vertexGroups, isolateGroupId, groups]);

  const paint = (event: any) => {
    if (!paintMode || !meshRef.current || !geometry) return;

    const intersection = event.point;
    const localPoint = meshRef.current.worldToLocal(intersection.clone());

    const positionAttr = geometry.attributes.position;
    const colorAttr = geometry.attributes.color;
    const count = positionAttr.count;

    const newGroups = new Uint8Array(vertexGroups);
    const isIsolated = isolateGroupId !== null;
    const ghostColor = new THREE.Color("#1c1c1c");
    const targetGroupId = paintTool === "eraser" ? 0 : activeGroupId;
    const targetColor = new THREE.Color(getGroupColor(targetGroupId));

    if (paintTool === "bucket") {
      // Find closest vertex index to localPoint
      let minDistance = Infinity;
      let clickedIdx = -1;
      for (let i = 0; i < count; i++) {
        const vx = positionAttr.getX(i);
        const vy = positionAttr.getY(i);
        const vz = positionAttr.getZ(i);

        const dx = vx - localPoint.x;
        const dy = vy - localPoint.y;
        const dz = vz - localPoint.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq < minDistance) {
          minDistance = distanceSq;
          clickedIdx = i;
        }
      }

      if (clickedIdx !== -1) {
        const startGroupId = vertexGroups[clickedIdx];
        if (startGroupId === targetGroupId) return;

        const queue: number[] = [clickedIdx];
        const visited = new Uint8Array(count);
        visited[clickedIdx] = 1;

        let fillCount = 0;
        while (queue.length > 0) {
          const u = queue.shift()!;
          newGroups[u] = targetGroupId;
          if (colorAttr) {
            const col = (!isIsolated || targetGroupId === isolateGroupId) ? targetColor : ghostColor;
            colorAttr.setXYZ(u, col.r, col.g, col.b);
          }
          fillCount++;

          if (fillCount > 250000) break; // safety threshold

          const neighbors = adjacencyList ? adjacencyList[u] : null;
          if (neighbors) {
            for (const v of neighbors) {
              if (visited[v] === 0 && vertexGroups[v] === startGroupId) {
                visited[v] = 1;
                queue.push(v);
              }
            }
          }
        }

        if (colorAttr) {
          colorAttr.needsUpdate = true;
        }
        setVertexGroups(newGroups);
        onGeometryUpdated();
      }
    } else {
      // Brush paint or Eraser
      let updated = false;
      const radiusSq = brushRadius * brushRadius;

      for (let i = 0; i < count; i++) {
        const vx = positionAttr.getX(i);
        const vy = positionAttr.getY(i);
        const vz = positionAttr.getZ(i);

        const dx = vx - localPoint.x;
        const dy = vy - localPoint.y;
        const dz = vz - localPoint.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq <= radiusSq) {
          newGroups[i] = targetGroupId;
          if (colorAttr) {
            const col = (!isIsolated || targetGroupId === isolateGroupId) ? targetColor : ghostColor;
            colorAttr.setXYZ(i, col.r, col.g, col.b);
          }
          updated = true;
        }
      }

      if (updated) {
        if (colorAttr) {
          colorAttr.needsUpdate = true;
        }
        setVertexGroups(newGroups);
        onGeometryUpdated();
      }
    }
  };

  return (
    <mesh
      ref={meshRef}
      name="paintable-model-mesh"
      geometry={geometry}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        if (paintMode && e.button === 0) {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          if (onStartAction) {
            onStartAction();
          }
          setIsDrawing(true);
          paint(e);
        }
      }}
      onPointerMove={(e) => {
        if (paintMode && isDrawing && paintTool === "brush" && e.buttons === 1) {
          e.stopPropagation();
          paint(e);
        }
      }}
      onPointerUp={(e) => {
        if (paintMode) {
          e.stopPropagation();
          try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          } catch (err) {}
          setIsDrawing(false);
        }
      }}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.4}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Interactive helper to visualize the brush size on hover
function BrushIndicator({
  brushRadius,
  paintMode,
  paintTool,
}: {
  brushRadius: number;
  paintMode: boolean;
  paintTool: "brush" | "bucket" | "eraser";
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { pointer, camera, raycaster, scene } = useThree();

  useFrame(() => {
    if (!paintMode || !meshRef.current) return;

    const modelMesh = scene.getObjectByName("paintable-model-mesh");
    if (!modelMesh) {
      meshRef.current.visible = false;
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(modelMesh);
    const validIntersect = intersects[0];

    if (validIntersect) {
      meshRef.current.position.copy(validIntersect.point);
      meshRef.current.visible = true;
    } else {
      meshRef.current.visible = false;
    }
  });

  if (!paintMode) return null;

  const indicatorRadius = paintTool === "bucket" ? 0.03 : brushRadius;
  const color = paintTool === "eraser" ? "#FF1744" : "#00E5FF";

  return (
    <mesh 
      ref={meshRef} 
      name="brush-indicator" 
      visible={false} 
      scale={[indicatorRadius, indicatorRadius, indicatorRadius]}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={paintTool === "bucket" ? 0.6 : 0.2}
        wireframe={paintTool !== "bucket"}
      />
    </mesh>
  );
}

// Fallback merger when BufferGeometryUtils is not fully functional or for custom needs
function mergeGeometriesFallback(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  try {
    if (BufferGeometryUtils && typeof BufferGeometryUtils.mergeGeometries === 'function') {
      const merged = BufferGeometryUtils.mergeGeometries(geometries, true);
      if (merged) return merged;
    }
  } catch (e) {
    console.warn("BufferGeometryUtils.mergeGeometries failed, using manual fallback:", e);
  }

  const mergedPos: number[] = [];
  const mergedNorm: number[] = [];
  
  for (const geom of geometries) {
    const posAttr = geom.attributes.position;
    const normAttr = geom.attributes.normal;
    if (!posAttr) continue;
    
    for (let i = 0; i < posAttr.count; i++) {
      mergedPos.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) {
        mergedNorm.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      } else {
        mergedNorm.push(0, 1, 0);
      }
    }
  }

  const finalGeom = new THREE.BufferGeometry();
  finalGeom.setAttribute("position", new THREE.Float32BufferAttribute(mergedPos, 3));
  finalGeom.setAttribute("normal", new THREE.Float32BufferAttribute(mergedNorm, 3));
  return finalGeom;
}

export default function Viewer3D() {
  const [groups, setGroups] = useState([
    { id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-zinc-700" },
    { id: 1, name: "Parte 1 (Ciano)", color: "#00E5FF", border: "border-[#00E5FF]" },
    { id: 2, name: "Parte 2 (Vermelho)", color: "#FF1744", border: "border-[#FF1744]" },
    { id: 3, name: "Parte 3 (Verde)", color: "#00FF41", border: "border-[#00FF41]" },
    { id: 4, name: "Parte 4 (Roxo)", color: "#D500F9", border: "border-[#D500F9]" },
  ]);

  const updateGroupColor = (id: number, color: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, color } : g))
    );
  };

  const updateGroupName = (id: number, name: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name } : g))
    );
  };

  const addCustomGroup = () => {
    const nextId = groups.length;
    const defaultColors = [
      "#FF9100", // Orange
      "#FF4081", // Pink
      "#FFEA00", // Yellow
      "#2979FF", // Blue
      "#00E676", // Light Green
      "#3D5AFE", // Indigo
      "#FF3D00", // Deep Orange
    ];
    const color = defaultColors[(nextId - 5) % defaultColors.length] || "#FFFFFF";
    const newGroup = {
      id: nextId,
      name: `Parte ${nextId}`,
      color: color,
      border: `border-[${color}]`
    };
    setGroups((prev) => [...prev, newGroup]);
    setActiveGroupId(nextId);
    setPaintMode(true);
  };

  const getGroupColor = (gId: number, currentGroups = groups) => {
    return currentGroups.find((g) => g.id === gId)?.color || "#333333";
  };

  const getGroupName = (gId: number, currentGroups = groups) => {
    return currentGroups.find((g) => g.id === gId)?.name || `Parte ${gId}`;
  };

  const [modelGeometry, setModelGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [fileName, setFileName] = useState("NONE");
  const [vertexGroups, setVertexGroups] = useState<Uint8Array>(new Uint8Array(0));
  const [history, setHistory] = useState<Uint8Array[]>([]);
  const [activeGroupId, setActiveGroupId] = useState(1);
  const [paintMode, setPaintMode] = useState(true);
  const [paintTool, setPaintTool] = useState<"brush" | "bucket" | "eraser">("brush");
  const [brushRadius, setBrushRadius] = useState(0.2);
  const [stats, setStats] = useState({ faces: 0, vertices: 0 });
  const [isExporting, setIsExporting] = useState<number | null>(null);
  const [loadingCap, setLoadingCap] = useState(false);
  const [capSelection, setCapSelection] = useState<"base" | "top">("top");
  const [isCapped, setIsCapped] = useState(false);
  const [isDownloadingCapped, setIsDownloadingCapped] = useState(false);
  const [isolateGroupId, setIsolateGroupId] = useState<number | null>(null);
  const [autoIsolateActive, setAutoIsolateActive] = useState(false);

  // General processing states for long-running geometry operations
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");

  // Separation Preview States
  const [previewSeparated, setPreviewSeparated] = useState(false);
  const [separationDistance, setSeparationDistance] = useState(1.0);

  // Anatomical Segmentation Options
  const [segmentLegs, setSegmentLegs] = useState(true);
  const [segmentArms, setSegmentArms] = useState(true);
  const [segmentTorso, setSegmentTorso] = useState(true);
  const [jointType, setJointType] = useState<"default" | "magnet">("default");
  const [showSuppliers, setShowSuppliers] = useState(false);

  // Conversion & Import Settings
  const [importUnit, setImportUnit] = useState<"mm" | "inch">("mm");
  const [importScale, setImportScale] = useState(1.0);
  const [showConversionSettings, setShowConversionSettings] = useState(false);

  // SLA & FDM Estimator States
  const [estimatorType, setEstimatorType] = useState<"SLA" | "FDM">("SLA");
  
  // Material Profiles
  const MATERIALS = [
    { id: "pla", name: "PLA (Standard)", density: 1.24, defaultCost: 110, type: "FDM" },
    { id: "petg", name: "PETG (Resistente)", density: 1.27, defaultCost: 130, type: "FDM" },
    { id: "abs", name: "ABS (Técnico)", density: 1.04, defaultCost: 100, type: "FDM" },
    { id: "resin_std", name: "Resina Standard", density: 1.10, defaultCost: 220, type: "SLA" },
    { id: "resin_tough", name: "Resina Tough/ABS-Like", density: 1.15, defaultCost: 340, type: "SLA" },
    { id: "resin_eco", name: "Resina Eco / Lavável", density: 1.05, defaultCost: 280, type: "SLA" },
  ];

  const [selectedMaterialId, setSelectedMaterialId] = useState("resin_std");
  const [materialDensity, setMaterialDensity] = useState(1.10);
  const [modelDimensions, setModelDimensions] = useState({ x: 0, y: 0, z: 0, volume: 0 });
  const [printScale, setPrintScale] = useState(100);
  
  // Miniature scaling states
  const [miniatureScaleMode, setMiniatureScaleMode] = useState<"human" | "direct">("human");
  const [customMiniatureRatio, setCustomMiniatureRatio] = useState(16);
  
  // SLA specific
  const [isHollow, setIsHollow] = useState(false);
  const [layerHeight, setLayerHeight] = useState(0.05); // in mm
  const [exposureTime, setExposureTime] = useState(2.5); // in seconds
  const [resinCostPerKg, setResinCostPerKg] = useState(220); // Average BRL per kg

  // FDM specific
  const [fdmInfill, setFdmInfill] = useState(20); // in %
  const [fdmLayerHeight, setFdmLayerHeight] = useState(0.2); // in mm
  const [fdmPrintSpeed, setFdmPrintSpeed] = useState(60); // in mm/s
  const [fdmFilamentCostPerKg, setFdmFilamentCostPerKg] = useState(110); // Average BRL per kg
  const [fdmWallCount, setFdmWallCount] = useState(2); // number of walls/perimeters

  const handleDownloadCSV = () => {
    if (!modelDimensions) return;

    const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
    const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
    const scaleMultiplier = printScale / 100.0;
    
    const scaledX = modelDimensions.x * autoScaleFactor * scaleMultiplier;
    const scaledY = modelDimensions.y * autoScaleFactor * scaleMultiplier;
    const scaledZ = modelDimensions.z * autoScaleFactor * scaleMultiplier;

    let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
    if (rawVol <= 0.001) {
      rawVol = (scaledX * scaledY * scaledZ) * 0.001 * 0.40;
    }

    let finalVol = 0, weight = 0, cost = 0, timeStr = "";
    const material = MATERIALS.find(m => m.id === selectedMaterialId)?.name || "Desconhecido";

    if (estimatorType === "SLA") {
      finalVol = isHollow ? rawVol * 0.30 : rawVol;
      weight = finalVol * materialDensity;
      cost = (weight / 1000.0) * resinCostPerKg;
      
      const totalLayers = Math.max(1, Math.ceil(scaledZ / layerHeight));
      const totalSecs = totalLayers * (exposureTime + 5.0) + 120;
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      timeStr = `${hours}h ${minutes}m`;
    } else {
      const shellFactor = Math.min(0.8, 0.08 * fdmWallCount);
      const infillFactor = fdmInfill / 100.0;
      const fdmVolRatio = shellFactor + (1.0 - shellFactor) * infillFactor;
      finalVol = rawVol * Math.max(0.05, fdmVolRatio);
      weight = finalVol * materialDensity;
      cost = (weight / 1000.0) * fdmFilamentCostPerKg;

      const volumetricFlow = 0.42 * fdmLayerHeight * fdmPrintSpeed;
      const printSecs = (finalVol * 1000.0) / (volumetricFlow || 1.0);
      const totalSecs = printSecs * 1.30 + 900;
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      timeStr = `${hours}h ${minutes}m`;
    }

    const csvRows = [
      ["Campo", "Valor"],
      ["Arquivo", fileName],
      ["Tipo de Estimador", estimatorType],
      ["Material", material],
      ["Escala de Impressao (%)", printScale],
      ["Dimensoes X (mm)", scaledX.toFixed(2)],
      ["Dimensoes Y (mm)", scaledY.toFixed(2)],
      ["Dimensoes Z (mm)", scaledZ.toFixed(2)],
      ["Volume Final (mL/cm3)", finalVol.toFixed(2)],
      ["Peso Estimado (g)", weight.toFixed(2)],
      ["Custo Estimado (R$)", cost.toFixed(2)],
      ["Tempo Estimado", timeStr],
      ["Densidade do Material (g/cm3)", materialDensity],
      ["Custo por Kg (R$)", estimatorType === "SLA" ? resinCostPerKg : fdmFilamentCostPerKg],
    ];

    if (estimatorType === "SLA") {
      csvRows.push(["Oco (Hollowed)", isHollow ? "Sim" : "Nao"]);
      csvRows.push(["Altura de Camada (mm)", layerHeight]);
      csvRows.push(["Tempo de Exposicao (s)", exposureTime]);
    } else {
      csvRows.push(["Infill (%)", fdmInfill]);
      csvRows.push(["Altura de Camada FDM (mm)", fdmLayerHeight]);
      csvRows.push(["Velocidade de Impressao (mm/s)", fdmPrintSpeed]);
      csvRows.push(["Numero de Paredes", fdmWallCount]);
    }

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `estimativa_${fileName.replace(/\.[^/.]+$/, "")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Perceived performance simulation for print estimator calculations
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateProgress, setEstimateProgress] = useState(100);

  useEffect(() => {
    // Only run if we actually have a model loaded
    if (!modelGeometry) return;

    setIsEstimating(true);
    setEstimateProgress(0);

    let currentProgress = 0;
    const interval = setInterval(() => {
      // Simulate random chunks of calculation progress
      currentProgress += Math.floor(Math.random() * 20) + 10;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsEstimating(false);
        }, 120);
      }
      setEstimateProgress(currentProgress);
    }, 40);

    return () => clearInterval(interval);
  }, [
    printScale,
    estimatorType,
    isHollow,
    layerHeight,
    exposureTime,
    resinCostPerKg,
    fdmInfill,
    fdmLayerHeight,
    fdmPrintSpeed,
    fdmFilamentCostPerKg,
    fdmWallCount,
    materialDensity,
    modelDimensions.volume // trigger when a new model is uploaded or changed
  ]);

  // Settings Import/Export States
  const [settingsNotification, setSettingsNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const settingsInputRef = useRef<HTMLInputElement>(null);

  const exportSettingsJSON = () => {
    try {
      const configData = {
        appName: "Vértice Studio - Print Slicer & Estimator",
        exportDate: new Date().toISOString(),
        estimatorType,
        printScale,
        isHollow,
        layerHeight,
        exposureTime,
        resinCostPerKg,
        fdmInfill,
        fdmLayerHeight,
        fdmPrintSpeed,
        fdmFilamentCostPerKg,
        fdmWallCount,
        groups: groups.map(g => ({ id: g.id, name: g.name, color: g.color }))
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(configData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `vertice_project_settings_${estimatorType.toLowerCase()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSettingsNotification({
        message: "Configurações exportadas com sucesso! / Settings exported successfully!",
        type: "success"
      });
      setTimeout(() => setSettingsNotification(null), 4000);
    } catch (err) {
      setSettingsNotification({
        message: "Erro ao exportar configurações. / Error exporting settings.",
        type: "error"
      });
      setTimeout(() => setSettingsNotification(null), 4000);
    }
  };

  const importSettingsJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Apply values if they exist in the parsed object
        if (parsed.estimatorType === "SLA" || parsed.estimatorType === "FDM") {
          setEstimatorType(parsed.estimatorType);
        }
        if (typeof parsed.printScale === "number") setPrintScale(parsed.printScale);
        if (typeof parsed.isHollow === "boolean") setIsHollow(parsed.isHollow);
        if (typeof parsed.layerHeight === "number") setLayerHeight(parsed.layerHeight);
        if (typeof parsed.exposureTime === "number") setExposureTime(parsed.exposureTime);
        if (typeof parsed.resinCostPerKg === "number") setResinCostPerKg(parsed.resinCostPerKg);
        
        if (typeof parsed.fdmInfill === "number") setFdmInfill(parsed.fdmInfill);
        if (typeof parsed.fdmLayerHeight === "number") setFdmLayerHeight(parsed.fdmLayerHeight);
        if (typeof parsed.fdmPrintSpeed === "number") setFdmPrintSpeed(parsed.fdmPrintSpeed);
        if (typeof parsed.fdmFilamentCostPerKg === "number") setFdmFilamentCostPerKg(parsed.fdmFilamentCostPerKg);
        if (typeof parsed.fdmWallCount === "number") setFdmWallCount(parsed.fdmWallCount);

        if (Array.isArray(parsed.groups)) {
          // Reconstruct groups state, merging with template properties like border
          const updatedGroups = parsed.groups.map((g: any) => ({
            id: Number(g.id),
            name: String(g.name || `Parte ${g.id}`),
            color: String(g.color || "#00E5FF"),
            border: g.border || `border-[${g.color || "#00E5FF"}]`
          }));
          setGroups(updatedGroups);
        }

        setSettingsNotification({
          message: "Configurações importadas com sucesso! / Settings imported successfully!",
          type: "success"
        });
        setTimeout(() => setSettingsNotification(null), 5000);
      } catch (err) {
        setSettingsNotification({
          message: "Arquivo de configuração inválido ou corrompido. / Invalid JSON profile file.",
          type: "error"
        });
        setTimeout(() => setSettingsNotification(null), 5000);
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be uploaded again
    e.target.value = "";
  };

  const applyPresetProfile = (presetKey: string) => {
    switch (presetKey) {
      case "sla_standard":
        setEstimatorType("SLA");
        setIsHollow(false);
        setLayerHeight(0.05);
        setExposureTime(2.5);
        setResinCostPerKg(35);
        break;
      case "sla_high_detail":
        setEstimatorType("SLA");
        setIsHollow(false);
        setLayerHeight(0.02);
        setExposureTime(2.0);
        setResinCostPerKg(45);
        break;
      case "sla_draft_hollow":
        setEstimatorType("SLA");
        setIsHollow(true);
        setLayerHeight(0.10);
        setExposureTime(3.5);
        setResinCostPerKg(30);
        break;
      case "fdm_standard":
        setEstimatorType("FDM");
        setFdmInfill(20);
        setFdmLayerHeight(0.20);
        setFdmPrintSpeed(60);
        setFdmFilamentCostPerKg(25);
        setFdmWallCount(3);
        break;
      case "fdm_draft":
        setEstimatorType("FDM");
        setFdmInfill(15);
        setFdmLayerHeight(0.28);
        setFdmPrintSpeed(120);
        setFdmFilamentCostPerKg(20);
        setFdmWallCount(2);
        break;
      case "fdm_strong":
        setEstimatorType("FDM");
        setFdmInfill(40);
        setFdmLayerHeight(0.16);
        setFdmPrintSpeed(50);
        setFdmFilamentCostPerKg(28);
        setFdmWallCount(4);
        break;
      default:
        break;
    }
    setSettingsNotification({
      message: "Perfil pré-definido aplicado! / Preset profile applied!",
      type: "success"
    });
    setTimeout(() => setSettingsNotification(null), 3000);
  };

  // Watermark / Marca d'água States
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("VERTICE");
  const [watermarkPlacement, setWatermarkPlacement] = useState<"base" | "top" | "front" | "back" | "left" | "right">("base");
  const [watermarkSize, setWatermarkSize] = useState(0.25);
  const [watermarkDepth, setWatermarkDepth] = useState(0.04);
  const [watermarkColor, setWatermarkColor] = useState("#00E5FF");
  const [watermarkOffsetX, setWatermarkOffsetX] = useState(0);
  const [watermarkOffsetY, setWatermarkOffsetY] = useState(0);
  const [watermarkOffsetZ, setWatermarkOffsetZ] = useState(0);
  const [watermarkRotationX, setWatermarkRotationX] = useState(0);
  const [watermarkRotationY, setWatermarkRotationY] = useState(0);
  const [watermarkRotationZ, setWatermarkRotationZ] = useState(0);
  const [watermarkStyle, setWatermarkStyle] = useState<"raised" | "recessed" | "overlay">("raised");

  const watermarkParams = useMemo(() => {
    if (!modelDimensions.x || !modelDimensions.y || !modelDimensions.z) {
      return { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
    }

    let px = 0;
    let py = 0;
    let pz = 0;

    // Rotation angles in radians
    let rx = 0;
    let ry = 0;
    let rz = 0;

    const hx = modelDimensions.x / 2;
    const hy = modelDimensions.y / 2;
    const hz = modelDimensions.z / 2;

    switch (watermarkPlacement) {
      case "base":
        py = -hy;
        rx = Math.PI / 2; // Lie flat under the bottom surface
        break;
      case "top":
        py = hy;
        rx = -Math.PI / 2; // Lie flat on top surface
        break;
      case "front":
        pz = hz;
        rx = 0;
        ry = 0;
        break;
      case "back":
        pz = -hz;
        rx = 0;
        ry = Math.PI; // Face backwards
        break;
      case "left":
        px = -hx;
        rx = 0;
        ry = -Math.PI / 2; // Face left
        break;
      case "right":
        px = hx;
        rx = 0;
        ry = Math.PI / 2; // Face right
        break;
    }

    // Add user defined offsets
    px += watermarkOffsetX;
    py += watermarkOffsetY;
    pz += watermarkOffsetZ;

    // Add extra rotations
    rx += (watermarkRotationX * Math.PI) / 180;
    ry += (watermarkRotationY * Math.PI) / 180;
    rz += (watermarkRotationZ * Math.PI) / 180;

    return {
      position: [px, py, pz] as [number, number, number],
      rotation: [rx, ry, rz] as [number, number, number]
    };
  }, [
    modelDimensions,
    watermarkPlacement,
    watermarkOffsetX,
    watermarkOffsetY,
    watermarkOffsetZ,
    watermarkRotationX,
    watermarkRotationY,
    watermarkRotationZ
  ]);

  const effectiveIsolateGroupId = autoIsolateActive ? activeGroupId : isolateGroupId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<any>(null);

  const pushStateToHistory = (customState?: Uint8Array) => {
    const stateToPush = customState || vertexGroups;
    if (!stateToPush || stateToPush.length === 0) return;
    setHistory((prev) => {
      // Create a copy of the Uint8Array
      const copy = new Uint8Array(stateToPush);
      const next = [...prev, copy];
      // Limit to 20 states to conserve memory
      if (next.length > 20) {
        next.shift();
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    
    // Set the vertexGroups back to previousState
    setVertexGroups(previousState);
    
    // Pop from history
    setHistory((prev) => prev.slice(0, -1));

    // Also update colors in the active geometry so the 3D canvas updates immediately!
    if (modelGeometry && previousState) {
      const colorAttr = modelGeometry.attributes.color;
      if (colorAttr) {
        const isIsolated = effectiveIsolateGroupId !== null;
        const ghostColor = new THREE.Color("#1c1c1c");
        for (let i = 0; i < previousState.length; i++) {
          const groupId = previousState[i];
          const color = (isIsolated && groupId !== effectiveIsolateGroupId) ? ghostColor : new THREE.Color(getGroupColor(groupId));
          colorAttr.setXYZ(i, color.r, color.g, color.b);
        }
        colorAttr.needsUpdate = true;
      }
      handleGeometryUpdated();
    }
  };

  // Memoized adjacency list for fast topological mesh traversal and 3D Flood Fill
  const adjacencyList = useMemo(() => {
    if (!modelGeometry) return null;
    return buildAdjacencyList(modelGeometry);
  }, [modelGeometry]);

  // Memoized geometries for separated parts preview (Exploded View)
  const subGeometries = useMemo(() => {
    if (!previewSeparated || !modelGeometry) return [];

    const positionAttr = modelGeometry.attributes.position;
    if (!positionAttr) return [];

    const indexAttr = modelGeometry.index;
    const normalAttr = modelGeometry.attributes.normal;

    // First, calculate model center using a sampled subset of vertices for maximum performance
    let modelSumX = 0, modelSumY = 0, modelSumZ = 0, modelCount = 0;
    const totalCount = positionAttr.count;
    const sampleStep = Math.max(1, Math.floor(totalCount / 1000));
    for (let i = 0; i < totalCount; i += sampleStep) {
      modelSumX += positionAttr.getX(i);
      modelSumY += positionAttr.getY(i);
      modelSumZ += positionAttr.getZ(i);
      modelCount++;
    }
    const modelCenter = new THREE.Vector3(
      modelSumX / (modelCount || 1),
      modelSumY / (modelCount || 1),
      modelSumZ / (modelCount || 1)
    );

    const results: {
      groupId: number;
      color: string;
      name: string;
      geometry: THREE.BufferGeometry;
      direction: THREE.Vector3;
    }[] = [];

    const activeIds = Array.from(new Set([0, ...groups.map((g) => g.id)]));

    activeIds.forEach((gId) => {
      const exportPositions: number[] = [];
      const exportNormals: number[] = [];

      let sumX = 0, sumY = 0, sumZ = 0, groupVertCount = 0;

      if (indexAttr) {
        const arr = indexAttr.array;
        const indexCount = arr.length;
        for (let i = 0; i < indexCount; i += 3) {
          const idx0 = arr[i];
          const idx1 = arr[i + 1];
          const idx2 = arr[i + 2];

          const g0 = vertexGroups[idx0] || 0;
          const g1 = vertexGroups[idx1] || 0;
          const g2 = vertexGroups[idx2] || 0;

          let belongs = false;
          if (gId === 0) {
            belongs = g0 === 0 && g1 === 0 && g2 === 0;
          } else {
            belongs = g0 === gId || g1 === gId || g2 === gId;
          }

          if (belongs) {
            const px0 = positionAttr.getX(idx0), py0 = positionAttr.getY(idx0), pz0 = positionAttr.getZ(idx0);
            const px1 = positionAttr.getX(idx1), py1 = positionAttr.getY(idx1), pz1 = positionAttr.getZ(idx1);
            const px2 = positionAttr.getX(idx2), py2 = positionAttr.getY(idx2), pz2 = positionAttr.getZ(idx2);

            exportPositions.push(px0, py0, pz0, px1, py1, pz1, px2, py2, pz2);

            sumX += px0 + px1 + px2;
            sumY += py0 + py1 + py2;
            sumZ += pz0 + pz1 + pz2;
            groupVertCount += 3;

            if (normalAttr) {
              exportNormals.push(
                normalAttr.getX(idx0), normalAttr.getY(idx0), normalAttr.getZ(idx0),
                normalAttr.getX(idx1), normalAttr.getY(idx1), normalAttr.getZ(idx1),
                normalAttr.getX(idx2), normalAttr.getY(idx2), normalAttr.getZ(idx2)
              );
            }
          }
        }
      } else {
        const vertexCount = positionAttr.count;
        for (let i = 0; i < vertexCount; i += 3) {
          if (i + 2 >= vertexCount) break;
          const g0 = vertexGroups[i] || 0;
          const g1 = vertexGroups[i + 1] || 0;
          const g2 = vertexGroups[i + 2] || 0;

          let belongs = false;
          if (gId === 0) {
            belongs = g0 === 0 && g1 === 0 && g2 === 0;
          } else {
            belongs = g0 === gId || g1 === gId || g2 === gId;
          }

          if (belongs) {
            const px0 = positionAttr.getX(i), py0 = positionAttr.getY(i), pz0 = positionAttr.getZ(i);
            const px1 = positionAttr.getX(i + 1), py1 = positionAttr.getY(i + 1), pz1 = positionAttr.getZ(i + 1);
            const px2 = positionAttr.getX(i + 2), py2 = positionAttr.getY(i + 2), pz2 = positionAttr.getZ(i + 2);

            exportPositions.push(px0, py0, pz0, px1, py1, pz1, px2, py2, pz2);

            sumX += px0 + px1 + px2;
            sumY += py0 + py1 + py2;
            sumZ += pz0 + pz1 + pz2;
            groupVertCount += 3;

            if (normalAttr) {
              exportNormals.push(
                normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i),
                normalAttr.getX(i + 1), normalAttr.getY(i + 1), normalAttr.getZ(i + 1),
                normalAttr.getX(i + 2), normalAttr.getY(i + 2), normalAttr.getZ(i + 2)
              );
            }
          }
        }
      }

      if (exportPositions.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(exportPositions, 3));
        if (exportNormals.length > 0) {
          geom.setAttribute("normal", new THREE.Float32BufferAttribute(exportNormals, 3));
        }

        const groupCenter = new THREE.Vector3(
          sumX / (groupVertCount || 1),
          sumY / (groupVertCount || 1),
          sumZ / (groupVertCount || 1)
        );

        const direction = new THREE.Vector3().subVectors(groupCenter, modelCenter);
        if (direction.lengthSq() < 0.0001) {
          direction.set((gId % 3 - 1) * 0.5, ((gId + 1) % 3 - 1) * 0.5, ((gId + 2) % 3 - 1) * 0.5);
        }
        direction.normalize();

        const groupColor = groups.find((g) => g.id === gId)?.color || "#888888";
        const groupName = groups.find((g) => g.id === gId)?.name || "Restante";

        results.push({
          groupId: gId,
          color: groupColor,
          name: groupName,
          geometry: geom,
          direction,
        });
      }
    });

    return results;
  }, [previewSeparated, modelGeometry, vertexGroups, groups]);

  // Cleanup sub-geometries to avoid memory leaks
  useEffect(() => {
    return () => {
      subGeometries.forEach((sub) => {
        sub.geometry.dispose();
      });
    };
  }, [subGeometries]);

  const handleZoomIn = () => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      if (camera.isPerspectiveCamera) {
        camera.position.multiplyScalar(0.85);
      } else if (camera.isOrthographicCamera) {
        camera.zoom *= 1.15;
        camera.updateProjectionMatrix();
      }
      controls.update();
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      if (camera.isPerspectiveCamera) {
        camera.position.multiplyScalar(1.15);
      } else if (camera.isOrthographicCamera) {
        camera.zoom *= 0.85;
        camera.updateProjectionMatrix();
      }
      controls.update();
    }
  };

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const setupGeometry = (geometry: THREE.BufferGeometry) => {
    setIsProcessing(true);
    setProcessingMessage("Preparando geometria e otimizando vértices...");

    setTimeout(() => {
      try {
        let weldedGeom = geometry;
        try {
          weldedGeom = BufferGeometryUtils.mergeVertices(geometry);
        } catch (e) {
          console.warn("Failed to merge vertices:", e);
        }

        // Apply scale and unit conversion
        const unitFactor = importUnit === "inch" ? 25.4 : 1.0;
        const totalFactor = unitFactor * importScale;
        
        if (totalFactor !== 1.0) {
          weldedGeom.scale(totalFactor, totalFactor, totalFactor);
        }

        weldedGeom.center();
        weldedGeom.computeVertexNormals();
        
        // Compute bounding box dimensions
        weldedGeom.computeBoundingBox();
        const bbox = weldedGeom.boundingBox;
        let sizeX = 0, sizeY = 0, sizeZ = 0;
        if (bbox) {
          const size = new THREE.Vector3();
          bbox.getSize(size);
          sizeX = size.x;
          sizeY = size.y;
          sizeZ = size.z;
        }
        
        // Calculate volume
        const volume = calculateMeshVolume(weldedGeom);
        setModelDimensions({ x: sizeX, y: sizeY, z: sizeZ, volume });

        const count = weldedGeom.attributes.position.count;
        setVertexGroups(new Uint8Array(count));
        setHistory([]);
        setModelGeometry(weldedGeom);
        setStats({
          faces: weldedGeom.index ? Math.floor(weldedGeom.index.count / 3) : Math.floor(count / 3),
          vertices: count,
        });
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  // Generate high-quality Torus Knot geometry for the demo model
  const loadDemoModel = () => {
    const geometry = new THREE.TorusKnotGeometry(1.5, 0.45, 120, 24);
    setupGeometry(geometry);
    setFileName("DEMO_TORUS_KNOT.STL");
  };

  // No auto-loading on mount so users can upload their own or select a demo

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingMessage(`Lendo arquivo: ${file.name}...`);

    const name = file.name.toUpperCase();
    setFileName(name);

    if (name.endsWith(".STL")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const contents = e.target?.result as ArrayBuffer;
          const loader = new STLLoader();
          const geometry = loader.parse(contents);
          setupGeometry(geometry);
        } catch (err) {
          console.error("Error loading STL:", err);
          alert("Failed to parse STL file. Please verify the format.");
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (name.endsWith(".OBJ")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const contents = e.target?.result as string;
          const loader = new OBJLoader();
          const obj = loader.parse(contents);
          
          const geometries: THREE.BufferGeometry[] = [];
          obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (mesh.geometry) {
                geometries.push(mesh.geometry.clone());
              }
            }
          });

          if (geometries.length === 0) {
            alert("No 3D meshes found in this OBJ file.");
            setIsProcessing(false);
            return;
          }

          let finalGeometry: THREE.BufferGeometry;
          if (geometries.length === 1) {
            finalGeometry = geometries[0];
          } else {
            finalGeometry = mergeGeometriesFallback(geometries);
          }

          setupGeometry(finalGeometry);
        } catch (err) {
          console.error("Error loading OBJ:", err);
          alert("Failed to parse OBJ file.");
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    } else if (name.endsWith(".FBX")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const contents = e.target?.result as ArrayBuffer;
          const loader = new FBXLoader();
          const fbx = loader.parse(contents, "");
          
          const geometries: THREE.BufferGeometry[] = [];
          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (mesh.geometry) {
                geometries.push(mesh.geometry.clone());
              }
            }
          });

          if (geometries.length === 0) {
            alert("No 3D meshes found in this FBX file.");
            setIsProcessing(false);
            return;
          }

          let finalGeometry: THREE.BufferGeometry;
          if (geometries.length === 1) {
            finalGeometry = geometries[0];
          } else {
            finalGeometry = mergeGeometriesFallback(geometries);
          }

          setupGeometry(finalGeometry);
        } catch (err) {
          console.error("Error loading FBX:", err);
          alert("Failed to parse FBX file.");
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Unsupported format. Please upload .STL, .OBJ, or .FBX files.");
      setIsProcessing(false);
    }
  };

  const handleGeometryUpdated = () => {
    // Simply trigger state updates if necessary
  };

  const capHollowVase = async () => {
    if (!modelGeometry) return;
    setLoadingCap(true);
    setIsProcessing(true);
    setProcessingMessage("Fechando furos e gerando tampa (Watertight)...");
    
    // Allow UI to update before heavy computation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      let geom = modelGeometry.clone();
      geom = BufferGeometryUtils.mergeVertices(geom);
      
      const index = geom.getIndex();
      if (!index) {
        alert("Não foi possível processar a geometria (sem índices).");
        setLoadingCap(false);
        return;
      }

      const posAttr = geom.getAttribute('position');
      
      const MULT = 100000000;
      const boundaryEdges = new Set<number>();
      
      const idxCount = index.count;
      for (let i = 0; i < idxCount; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        
        const e1_ab = a * MULT + b;
        const e1_ba = b * MULT + a;
        if (boundaryEdges.has(e1_ba)) boundaryEdges.delete(e1_ba);
        else if (boundaryEdges.has(e1_ab)) boundaryEdges.delete(e1_ab);
        else boundaryEdges.add(e1_ab);
        
        const e2_bc = b * MULT + c;
        const e2_cb = c * MULT + b;
        if (boundaryEdges.has(e2_cb)) boundaryEdges.delete(e2_cb);
        else if (boundaryEdges.has(e2_bc)) boundaryEdges.delete(e2_bc);
        else boundaryEdges.add(e2_bc);
        
        const e3_ca = c * MULT + a;
        const e3_ac = a * MULT + c;
        if (boundaryEdges.has(e3_ac)) boundaryEdges.delete(e3_ac);
        else if (boundaryEdges.has(e3_ca)) boundaryEdges.delete(e3_ca);
        else boundaryEdges.add(e3_ca);
      }
      
      const nextVertex = new Map();
      for (const edge of boundaryEdges) {
        const u = Math.floor(edge / MULT);
        const v = edge % MULT;
        nextVertex.set(u, v);
      }
      
      if (nextVertex.size === 0) {
        alert("Nenhum buraco encontrado (a malha já está fechada).");
        setLoadingCap(false);
        setIsProcessing(false);
        return;
      }
      
      const loops = [];
      const visited = new Set();
      for (const [startNode, _] of nextVertex.entries()) {
        if (visited.has(startNode)) continue;
        
        const loop = [];
        let current = startNode;
        while (current !== undefined && !visited.has(current)) {
          visited.add(current);
          loop.push(current);
          current = nextVertex.get(current);
        }
        if (loop.length > 2) {
          loops.push(loop);
        }
      }
      
      geom.computeBoundingBox();
      const bbox = geom.boundingBox;
      if (!bbox) {
         setLoadingCap(false);
         return;
      }
      
      const extX = bbox.max.x - bbox.min.x;
      const extY = bbox.max.y - bbox.min.y;
      const extZ = bbox.max.z - bbox.min.z;
      
      let getAxisVal = (v) => posAttr.getY(v);
      let minVal = bbox.min.y;
      let ext = extY;
      
      if (extZ > extY && extZ > extX) {
         getAxisVal = (v) => posAttr.getZ(v);
         minVal = bbox.min.z;
         ext = extZ;
      } else if (extX > extY && extX > extZ) {
         getAxisVal = (v) => posAttr.getX(v);
         minVal = bbox.min.x;
         ext = extX;
      }
      
      let targetLoops = [];
      if (capSelection === "top") {
        targetLoops = loops.filter(loop => {
          let avg = 0;
          loop.forEach(v => avg += getAxisVal(v));
          return (avg / loop.length) > minVal + ext * 0.5;
        });
      } else {
        targetLoops = loops.filter(loop => {
          let avg = 0;
          loop.forEach(v => avg += getAxisVal(v));
          return (avg / loop.length) < minVal + ext * 0.5;
        });
      }
      
      if (targetLoops.length === 0) {
        if (loops.length === 0) {
           alert("Nenhum buraco aberto encontrado. Se o vaso tem paredes grossas, a malha já está fechada!");
        } else {
           alert(`Nenhum buraco encontrado na parte "${capSelection}". (Buracos totais: ${loops.length}). Tente a outra opção.`);
        }
        setLoadingCap(false);
        setIsProcessing(false);
        return;
      }
      
      let newTrianglesCount = 0;
      targetLoops.forEach(loop => {
        newTrianglesCount += loop.length;
      });
      
      const newVertexCount = posAttr.count + targetLoops.length;
      const newPositions = new Float32Array(newVertexCount * 3);
      newPositions.set(posAttr.array);
      
      const oldColorsAttr = geom.getAttribute('color');
      const newColors = new Float32Array(newVertexCount * 3);
      if (oldColorsAttr) {
        newColors.set(oldColorsAttr.array);
      } else {
        newColors.fill(1);
      }
      
      const newIndices = new Uint32Array(index.count + newTrianglesCount * 3);
      newIndices.set(index.array);
      
      let currentVertexCount = posAttr.count;
      let currentIndexCount = index.count;
      
      targetLoops.forEach(loop => {
        let cx = 0, cy = 0, cz = 0;
        let cR = 0, cG = 0, cB = 0;
        
        loop.forEach(v => {
          cx += posAttr.getX(v);
          cy += posAttr.getY(v);
          cz += posAttr.getZ(v);
          if (oldColorsAttr) {
             cR += oldColorsAttr.getX(v);
             cG += oldColorsAttr.getY(v);
             cB += oldColorsAttr.getZ(v);
          }
        });
        cx /= loop.length;
        cy /= loop.length;
        cz /= loop.length;
        
        if (oldColorsAttr) {
           cR /= loop.length;
           cG /= loop.length;
           cB /= loop.length;
        } else {
           cR = 1; cG = 1; cB = 1;
        }
        
        const centerIndex = currentVertexCount;
        newPositions[centerIndex * 3] = cx;
        newPositions[centerIndex * 3 + 1] = cy;
        newPositions[centerIndex * 3 + 2] = cz;
        
        newColors[centerIndex * 3] = cR;
        newColors[centerIndex * 3 + 1] = cG;
        newColors[centerIndex * 3 + 2] = cB;
        
        currentVertexCount++;
        
        for (let i = 0; i < loop.length; i++) {
          const v1 = loop[i];
          const v2 = loop[(i + 1) % loop.length];
          // Reversed winding order to point normals outwards
          newIndices[currentIndexCount++] = v2;
          newIndices[currentIndexCount++] = v1;
          newIndices[currentIndexCount++] = centerIndex;
        }
      });
      
      const cappedGeom = new THREE.BufferGeometry();
      cappedGeom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      cappedGeom.setIndex(new THREE.BufferAttribute(newIndices, 1));
      cappedGeom.computeVertexNormals();
      
      cappedGeom.setAttribute("color", new THREE.BufferAttribute(newColors, 3));
      
      setModelGeometry(cappedGeom);
      
      const newGroups = new Uint8Array(currentVertexCount);
      setVertexGroups(newGroups);
      setHistory([]);
      
      setStats({
        faces: newIndices.length / 3,
        vertices: currentVertexCount
      });
      
      setIsCapped(true);
      alert(`Parte "${capSelection}" fechada com sucesso! O modelo na tela foi atualizado.`);
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao tentar fechar o vaso.");
    } finally {
      setLoadingCap(false);
      setIsProcessing(false);
    }
  };

  const downloadCappedModel = () => {
    if (!modelGeometry) return;
    setIsDownloadingCapped(true);
    setIsProcessing(true);
    setProcessingMessage("Preparando download do modelo otimizado...");

    setTimeout(() => {
        const workerScript = `
        self.onmessage = function(e) {
            const positions = e.data.positions;
            const indices = e.data.indices;
            
            const numTriangles = indices ? indices.length / 3 : positions.length / 9;
            const bufferLength = 84 + (50 * numTriangles);
            const arrayBuffer = new ArrayBuffer(bufferLength);
            const dataView = new DataView(arrayBuffer);
            
            dataView.setUint32(80, numTriangles, true);
            
            let offset = 84;
            let i = 0;
            
            while (i < (indices ? indices.length : (positions.length / 3))) {
                let a, b, c;
                if (indices) {
                    a = indices[i] * 3;
                    b = indices[i+1] * 3;
                    c = indices[i+2] * 3;
                    i += 3;
                } else {
                    a = i * 3;
                    b = (i+1) * 3;
                    c = (i+2) * 3;
                    i += 3;
                }
                
                const pAx = positions[a], pAy = positions[a+1], pAz = positions[a+2];
                const pBx = positions[b], pBy = positions[b+1], pBz = positions[b+2];
                const pCx = positions[c], pCy = positions[c+1], pCz = positions[c+2];
                
                const cbX = pCx - pBx, cbY = pCy - pBy, cbZ = pCz - pBz;
                const abX = pAx - pBx, abY = pAy - pBy, abZ = pAz - pBz;
                
                let nx = cbY * abZ - cbZ * abY;
                let ny = cbZ * abX - cbX * abZ;
                let nz = cbX * abY - cbY * abX;
                
                let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                if (len > 0) { nx /= len; ny /= len; nz /= len; }
                
                dataView.setFloat32(offset, nx, true); offset += 4;
                dataView.setFloat32(offset, ny, true); offset += 4;
                dataView.setFloat32(offset, nz, true); offset += 4;
                
                dataView.setFloat32(offset, pAx, true); offset += 4;
                dataView.setFloat32(offset, pAy, true); offset += 4;
                dataView.setFloat32(offset, pAz, true); offset += 4;
                
                dataView.setFloat32(offset, pBx, true); offset += 4;
                dataView.setFloat32(offset, pBy, true); offset += 4;
                dataView.setFloat32(offset, pBz, true); offset += 4;
                
                dataView.setFloat32(offset, pCx, true); offset += 4;
                dataView.setFloat32(offset, pCy, true); offset += 4;
                dataView.setFloat32(offset, pCz, true); offset += 4;
                
                dataView.setUint16(offset, 0, true); offset += 2;
            }
            
            self.postMessage({ buffer: arrayBuffer }, [arrayBuffer]);
        };
        `;
        
        try {
            const blobScript = new Blob([workerScript], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blobScript));
            
            const positions = modelGeometry.getAttribute('position').array;
            const indices = modelGeometry.getIndex() ? modelGeometry.getIndex().array : null;
            
            worker.postMessage({ positions, indices });
            
            worker.onmessage = (e) => {
                const outBlob = new Blob([e.data.buffer], { type: "application/octet-stream" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(outBlob);
                link.download = `vaso_fechado_${capSelection}.stl`;
                link.click();
                
                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                setIsCapped(false);
                setIsDownloadingCapped(false);
                setIsProcessing(false);
                worker.terminate();
            };
            
            worker.onerror = (e) => {
                console.error(e);
                alert("Erro ao exportar STL");
                setIsDownloadingCapped(false);
                setIsProcessing(false);
                worker.terminate();
            };
        } catch (e) {
            console.error(e);
            alert("Erro ao inicializar exportação");
            setIsDownloadingCapped(false);
            setIsProcessing(false);
        }
    }, 100);
  };

  // Keyboard listener for Ctrl+Z / Cmd+Z Undo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  const resetPainting = () => {
    if (!modelGeometry) return;
    pushStateToHistory();
    const count = modelGeometry.attributes.position.count;
    setVertexGroups(new Uint8Array(count));
    
    const colorAttr = modelGeometry.attributes.color;
    if (colorAttr) {
      const baseColor = new THREE.Color(getGroupColor(0));
      for (let i = 0; i < count; i++) {
        colorAttr.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
      }
      colorAttr.needsUpdate = true;
    }
  };

  const fillRemainingWithActiveGroup = () => {
    if (!modelGeometry) return;
    pushStateToHistory();
    const count = modelGeometry.attributes.position.count;
    const newGroups = new Uint8Array(vertexGroups);
    const targetColor = new THREE.Color(getGroupColor(activeGroupId));
    const colorAttr = modelGeometry.attributes.color;

    let updated = false;
    for (let i = 0; i < count; i++) {
      if (newGroups[i] === 0) {
        newGroups[i] = activeGroupId;
        if (colorAttr) {
          colorAttr.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
        }
        updated = true;
      }
    }

    if (updated) {
      if (colorAttr) {
        colorAttr.needsUpdate = true;
      }
      setVertexGroups(newGroups);
      handleGeometryUpdated();
    }
  };

  const fillAllWithActiveGroup = () => {
    if (!modelGeometry) return;
    pushStateToHistory();
    const count = modelGeometry.attributes.position.count;
    const newGroups = new Uint8Array(count);
    newGroups.fill(activeGroupId);
    
    const targetColor = new THREE.Color(getGroupColor(activeGroupId));
    const colorAttr = modelGeometry.attributes.color;
    if (colorAttr) {
      for (let i = 0; i < count; i++) {
        colorAttr.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
      }
      colorAttr.needsUpdate = true;
    }

    setVertexGroups(newGroups);
    handleGeometryUpdated();
  };

  const expandConnectedPaint = () => {
    if (!modelGeometry) return;
    
    // Find all seed vertices currently painted with activeGroupId
    const count = modelGeometry.attributes.position.count;
    const initialSeeds: number[] = [];
    for (let i = 0; i < count; i++) {
      if (vertexGroups[i] === activeGroupId) {
        initialSeeds.push(i);
      }
    }

    if (initialSeeds.length === 0) {
      alert("Por favor, pinte primeiro uma pequena parte do modelo com o pincel para servir de base!");
      return;
    }

    const adjacency = adjacencyList;
    if (!adjacency) {
      alert("Erro ao construir lista de conexões do modelo.");
      return;
    }

    pushStateToHistory();
    const newGroups = new Uint8Array(vertexGroups);
    const targetColor = new THREE.Color(getGroupColor(activeGroupId));
    const colorAttr = modelGeometry.attributes.color;

    // Run BFS starting from seed vertices, flowing strictly into unpainted (group 0) vertices
    const queue = [...initialSeeds];
    const visited = new Uint8Array(count);
    for (const seed of initialSeeds) {
      visited[seed] = 1;
    }

    let expandedCount = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      
      const neighbors = adjacency[u];
      if (neighbors) {
        for (const v of neighbors) {
          if (visited[v] === 0 && vertexGroups[v] === 0) {
            visited[v] = 1;
            newGroups[v] = activeGroupId;
            if (colorAttr) {
              colorAttr.setXYZ(v, targetColor.r, targetColor.g, targetColor.b);
            }
            queue.push(v);
            expandedCount++;
          }
        }
      }
    }

    if (expandedCount > 0) {
      if (colorAttr) {
        colorAttr.needsUpdate = true;
      }
      setVertexGroups(newGroups);
      handleGeometryUpdated();
    } else {
      alert("Nenhuma parte não pintada está conectada à sua pintura ativa atual!");
    }
  };

  const autoSegmentAnatomy = () => {
    if (!modelGeometry) return;
    setIsProcessing(true);
    setProcessingMessage("Executando Segmentação Anatômica...");

    setTimeout(() => {
      try {
        pushStateToHistory();
        const count = modelGeometry.attributes.position.count;
        const positionAttr = modelGeometry.attributes.position;
        const colorAttr = modelGeometry.attributes.color;
        const newGroups = new Uint8Array(count);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < count; i++) {
          const x = positionAttr.getX(i);
          const y = positionAttr.getY(i);
          const z = positionAttr.getZ(i);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }

        const height = maxY - minY;
        const width = maxX - minX;

        for (let i = 0; i < count; i++) {
          const x = positionAttr.getX(i);
          const y = positionAttr.getY(i);

          if (y < minY + height * 0.36) {
            newGroups[i] = segmentLegs ? 1 : 0;
          } else if (x < minX + width * 0.33) {
            newGroups[i] = segmentArms ? 3 : 0;
          } else if (x > maxX - width * 0.33) {
            newGroups[i] = segmentArms ? 4 : 0;
          } else {
            newGroups[i] = segmentTorso ? 2 : 0;
          }
        }

        if (colorAttr) {
          for (let i = 0; i < count; i++) {
            const gId = newGroups[i];
            const color = new THREE.Color(getGroupColor(gId));
            colorAttr.setXYZ(i, color.r, color.g, color.b);
          }
          colorAttr.needsUpdate = true;
        }

        setVertexGroups(newGroups);
        handleGeometryUpdated();
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const autoSegmentShells = () => {
    if (!modelGeometry) return;
    if (!adjacencyList) {
      alert("Aguarde a geração das conexões 3D do modelo...");
      return;
    }

    setIsProcessing(true);
    setProcessingMessage("Detectando peças soltas (shells)...");

    const faceCount = stats.faces;
    if (faceCount > 200000) {
      if (!confirm(`Este modelo é muito complexo (${faceCount.toLocaleString()} faces). A detecção de peças soltas pode ser lenta e, em modelos unificados, pode resultar em uma única peça. Deseja continuar?`)) {
        setIsProcessing(false);
        return;
      }
    }

    setTimeout(() => {
      try {
        pushStateToHistory();
        const count = modelGeometry.attributes.position.count;
        const newGroups = new Uint8Array(count);
        const visited = new Uint8Array(count);

        let currentGroup = 1;
        const maxGroups = 4;
        let shellCount = 0;

        for (let i = 0; i < count; i++) {
          if (visited[i] === 0) {
            shellCount++;
            const queue: number[] = [i];
            visited[i] = 1;

            const component: number[] = [];
            while (queue.length > 0) {
              const u = queue.shift()!;
              component.push(u);

              // Increased safety limit for very large parts
              if (component.length > 500000) break;

              const neighbors = adjacencyList[u];
              if (neighbors) {
                for (const v of neighbors) {
                  if (visited[v] === 0) {
                    visited[v] = 1;
                    queue.push(v);
                  }
                }
              }
            }

            for (const idx of component) {
              newGroups[idx] = currentGroup;
            }

            currentGroup = currentGroup < maxGroups ? currentGroup + 1 : 1;
          }
        }

        if (shellCount <= 1) {
          alert("Apenas uma peça única foi detectada. Este modelo provavelmente é uma malha unificada. Tente usar a 'Divisão Inteligente' para separar por posição (rodas, teto, etc).");
        }

        // Reset groups to default names for shell mode
        setGroups([
          { id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-zinc-700" },
          { id: 1, name: "Grupo 1", color: "#00E5FF", border: "border-[#00E5FF]" },
          { id: 2, name: "Grupo 2", color: "#FF1744", border: "border-[#FF1744]" },
          { id: 3, name: "Grupo 3", color: "#00FF41", border: "border-[#00FF41]" },
          { id: 4, name: "Grupo 4", color: "#D500F9", border: "border-[#D500F9]" },
        ]);

        const colorAttr = modelGeometry.attributes.color;
        if (colorAttr) {
          for (let i = 0; i < count; i++) {
            const gId = newGroups[i];
            const color = new THREE.Color(getGroupColor(gId));
            colorAttr.setXYZ(i, color.r, color.g, color.b);
          }
          colorAttr.needsUpdate = true;
        }

        setVertexGroups(newGroups);
        handleGeometryUpdated();
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const autoSegmentSmart = () => {
    if (!modelGeometry) return;
    if (!adjacencyList) {
      alert("Construindo conexões... Aguarde.");
      return;
    }

    setIsProcessing(true);
    setProcessingMessage("Analisando topologia e identificando componentes principais...");

    setTimeout(() => {
      try {
        pushStateToHistory();
        const count = modelGeometry.attributes.position.count;
        const positionAttr = modelGeometry.attributes.position;
        const newGroups = new Uint8Array(count);
        const visited = new Uint8Array(count);

        const shells: { vertices: number[]; center: THREE.Vector3; count: number }[] = [];

        for (let i = 0; i < count; i++) {
          if (visited[i] === 0) {
            const queue: number[] = [i];
            visited[i] = 1;
            const component: number[] = [];
            const sum = new THREE.Vector3();

            while (queue.length > 0) {
              const u = queue.shift()!;
              component.push(u);
              sum.x += positionAttr.getX(u);
              sum.y += positionAttr.getY(u);
              sum.z += positionAttr.getZ(u);

              if (component.length > 200000) break;

              const neighbors = adjacencyList[u];
              if (neighbors) {
                for (const v of neighbors) {
                  if (visited[v] === 0) {
                    visited[v] = 1;
                    queue.push(v);
                  }
                }
              }
            }
            
            shells.push({
              vertices: component,
              center: sum.divideScalar(component.length),
              count: component.length
            });
          }
        }

        shells.sort((a, b) => b.count - a.count);

        const modelBBox = modelGeometry.boundingBox;
        if (!modelBBox) modelGeometry.computeBoundingBox();
        const minY = modelGeometry.boundingBox!.min.y;
        const maxY = modelGeometry.boundingBox!.max.y;
        const height = maxY - minY;

        shells.forEach((shell, index) => {
          let gId = 4;
          if (index === 0) {
            gId = 1;
          } else if (shell.count > count * 0.05) {
            if (shell.center.y < minY + height * 0.3) {
              gId = 2;
            } else if (shell.center.y > maxY - height * 0.3) {
              gId = 3;
            } else {
              gId = 1;
            }
          } else {
            if (shell.center.y < minY + height * 0.2) {
              gId = 2;
            } else {
              gId = 4;
            }
          }
          for (const vIdx of shell.vertices) {
            newGroups[vIdx] = gId;
          }
        });

        setGroups([
          { id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-zinc-700" },
          { id: 1, name: "Estrutura / Corpo Principal", color: "#00E5FF", border: "border-[#00E5FF]" },
          { id: 2, name: "Base / Rodas / Inferior", color: "#FF1744", border: "border-[#FF1744]" },
          { id: 3, name: "Topo / Teto / Superior", color: "#00FF41", border: "border-[#00FF41]" },
          { id: 4, name: "Detalhes / Acessórios", color: "#D500F9", border: "border-[#D500F9]" },
        ]);

        const colorAttr = modelGeometry.attributes.color;
        if (colorAttr) {
          for (let i = 0; i < count; i++) {
            const gId = newGroups[i];
            const color = new THREE.Color(getGroupColor(gId, [
              { id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-zinc-700" },
              { id: 1, name: "Estrutura / Corpo Principal", color: "#00E5FF", border: "border-[#00E5FF]" },
              { id: 2, name: "Base / Rodas / Inferior", color: "#FF1744", border: "border-[#FF1744]" },
              { id: 3, name: "Topo / Teto / Superior", color: "#00FF41", border: "border-[#00FF41]" },
              { id: 4, name: "Detalhes / Acessórios", color: "#D500F9", border: "border-[#D500F9]" },
            ]));
            colorAttr.setXYZ(i, color.r, color.g, color.b);
          }
          colorAttr.needsUpdate = true;
        }

        setVertexGroups(newGroups);
        handleGeometryUpdated();
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const exportSeparatedPart = (groupId: number) => {
    if (!modelGeometry) return;
    setIsExporting(groupId);
    setIsProcessing(true);
    setProcessingMessage(`Exportando ${groupId === 0 ? "Peça Principal" : getGroupName(groupId)} para STL...`);

    setTimeout(() => {
      try {
        const positionAttr = modelGeometry.attributes.position;
        const indexAttr = modelGeometry.index;
        const normalAttr = modelGeometry.attributes.normal;

        const exportPositions: number[] = [];
        const exportNormals: number[] = [];

        if (indexAttr) {
          // Indexed geometry: read triangles from index array
          const arr = indexAttr.array;
          const indexCount = arr.length;
          for (let i = 0; i < indexCount; i += 3) {
            const idx0 = arr[i];
            const idx1 = arr[i + 1];
            const idx2 = arr[i + 2];

            const g0 = vertexGroups[idx0];
            const g1 = vertexGroups[idx1];
            const g2 = vertexGroups[idx2];

            let belongs = false;
            if (groupId === 0) {
              belongs = (g0 === 0 || g0 === undefined) && (g1 === 0 || g1 === undefined) && (g2 === 0 || g2 === undefined);
            } else {
              belongs = g0 === groupId || g1 === groupId || g2 === groupId;
            }

            if (belongs) {
              exportPositions.push(
                positionAttr.getX(idx0), positionAttr.getY(idx0), positionAttr.getZ(idx0),
                positionAttr.getX(idx1), positionAttr.getY(idx1), positionAttr.getZ(idx1),
                positionAttr.getX(idx2), positionAttr.getY(idx2), positionAttr.getZ(idx2)
              );

              if (normalAttr) {
                exportNormals.push(
                  normalAttr.getX(idx0), normalAttr.getY(idx0), normalAttr.getZ(idx0),
                  normalAttr.getX(idx1), normalAttr.getY(idx1), normalAttr.getZ(idx1),
                  normalAttr.getX(idx2), normalAttr.getY(idx2), normalAttr.getZ(idx2)
                );
              }
            }
          }
        } else {
          // Non-indexed geometry: read triangles from sequential position vertices
          const vertexCount = positionAttr.count;
          for (let i = 0; i < vertexCount; i += 3) {
            const g0 = vertexGroups[i];
            const g1 = vertexGroups[i + 1];
            const g2 = vertexGroups[i + 2];

            let belongs = false;
            if (groupId === 0) {
              belongs = (g0 === 0 || g0 === undefined) && (g1 === 0 || g1 === undefined) && (g2 === 0 || g2 === undefined);
            } else {
              belongs = g0 === groupId || g1 === groupId || g2 === groupId;
            }

            if (belongs) {
              exportPositions.push(
                positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i),
                positionAttr.getX(i+1), positionAttr.getY(i+1), positionAttr.getZ(i+1),
                positionAttr.getX(i+2), positionAttr.getY(i+2), positionAttr.getZ(i+2)
              );

              if (normalAttr) {
                exportNormals.push(
                  normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i),
                  normalAttr.getX(i+1), normalAttr.getY(i+1), normalAttr.getZ(i+1),
                  normalAttr.getX(i+2), normalAttr.getY(i+2), normalAttr.getZ(i+2)
                );
              }
            }
          }
        }

        if (exportPositions.length === 0) {
          alert("No parts of the model have been painted with this group yet.");
          setIsExporting(null);
          setIsProcessing(false);
          return;
        }

        // Reconstruct BufferGeometry
        const exportGeometry = new THREE.BufferGeometry();
        exportGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(exportPositions, 3)
        );
        if (exportNormals.length > 0) {
          exportGeometry.setAttribute(
            "normal",
            new THREE.Float32BufferAttribute(exportNormals, 3)
          );
        }

        const exportMesh = new THREE.Mesh(exportGeometry, new THREE.MeshBasicMaterial());
        const exporter = new STLExporter();
        const result = exporter.parse(exportMesh, { binary: true });

        // Trigger file download
        const blob = new Blob([result], { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const jointSuffix = jointType === "magnet" ? "_ENCAIXE_IMA" : "_ENCAIXE_PINO_DEFAULT";
        const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
        link.download = `${cleanName}_${getGroupName(groupId).replace(/\s+/g, "_")}${jointSuffix}.stl`;
        link.click();
      } catch (err) {
        console.error("Export error:", err);
      } finally {
        setIsExporting(null);
        setIsProcessing(false);
      }
    }, 100);
  };

  const getSlicingStatus = (progress: number) => {
    if (progress < 25) return "Analisando malha 3D / Analyzing mesh...";
    if (progress < 55) return "Calculando volumes e fatiamento / Computing volume...";
    if (progress < 80) return "Estipulando tempo de impressão / Estimating print time...";
    return "Finalizando estimativas / Finalizing estimates...";
  };

  // Calcule as dimensões originais e escalonadas do objeto para exibição em mm/cm
  const originalX = modelDimensions.x * (modelDimensions.x < 15.0 ? 10.0 : 1.0);
  const originalY = modelDimensions.y * (modelDimensions.y < 15.0 ? 10.0 : 1.0);
  const originalZ = modelDimensions.z * (modelDimensions.z < 15.0 ? 10.0 : 1.0);

  const scaledX = originalX * (printScale / 100.0);
  const scaledY = originalY * (printScale / 100.0);
  const scaledZ = originalZ * (printScale / 100.0);

  const applyMiniatureScale = (denom: number, mode = miniatureScaleMode) => {
    if (mode === "human") {
      if (originalZ > 0) {
        const targetZ = 1800.0 / denom; // standard 180cm human height scaled
        const calculatedScale = (targetZ / originalZ) * 100.0;
        setPrintScale(Math.max(0.1, Math.min(2000, Math.round(calculatedScale * 10) / 10)));
      }
    } else {
      const calculatedScale = 100.0 / denom;
      setPrintScale(Math.max(0.1, Math.min(2000, Math.round(calculatedScale * 10) / 10)));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-white bg-[#080808]">
      {/* HEADER AREA */}
      <header className="p-8 flex justify-between items-end border-b border-[#222] shrink-0 bg-[#080808]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#00E5FF] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.4.2</p>
          <h1 className="text-6xl font-black tracking-tighter leading-none uppercase">3D Print Painter</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Loaded File</div>
          <div className="font-mono text-sm text-[#00E5FF] tracking-wider">{fileName}</div>
        </div>
      </header>

      {/* CORE INTERFACE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        
        {/* 3D VIEWPORT CONTAINER */}
        <div className="relative bg-[#050505] p-6 h-full flex flex-col">
          <div className="flex-1 w-full border border-zinc-800 rounded-lg relative overflow-hidden bg-[#050505] bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
            {modelGeometry ? (
              <>
                <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
                  <color attach="background" args={["#0a0a0a"]} />
                  <ambientLight intensity={0.8} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} />
                  <pointLight position={[-10, 5, -10]} intensity={0.8} color="#00E5FF" />
                  <directionalLight position={[5, 10, 5]} intensity={2.0} castShadow />
                  <directionalLight position={[-5, -10, -5]} intensity={0.6} />
                  
                  {previewSeparated ? (
                    subGeometries.map((sub, idx) => (
                      <mesh
                        key={idx}
                        geometry={sub.geometry}
                        castShadow
                        receiveShadow
                        position={[
                          sub.direction.x * separationDistance,
                          sub.direction.y * separationDistance,
                          sub.direction.z * separationDistance
                        ]}
                      >
                        <meshStandardMaterial
                          color={sub.color}
                          roughness={0.4}
                          metalness={0.2}
                          side={THREE.DoubleSide}
                        />
                      </mesh>
                    ))
                  ) : (
                    <PaintableMesh
                      geometry={modelGeometry}
                      brushRadius={brushRadius}
                      activeGroupId={activeGroupId}
                      paintMode={paintMode}
                      paintTool={paintTool}
                      onGeometryUpdated={handleGeometryUpdated}
                      vertexGroups={vertexGroups}
                      setVertexGroups={setVertexGroups}
                      adjacencyList={adjacencyList}
                      onStartAction={pushStateToHistory}
                      isolateGroupId={effectiveIsolateGroupId}
                      groups={groups}
                    />
                  )}

                  {!previewSeparated && (
                    <BrushIndicator brushRadius={brushRadius} paintMode={paintMode} paintTool={paintTool} />
                  )}

                  <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    enabled={true}
                    mouseButtons={{
                      LEFT: (paintMode && !previewSeparated) ? null : THREE.MOUSE.ROTATE,
                      MIDDLE: THREE.MOUSE.PAN,
                      RIGHT: (paintMode && !previewSeparated) ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
                    }}
                    touches={{
                      ONE: (paintMode && !previewSeparated) ? null : THREE.TOUCH.ROTATE,
                      TWO: THREE.TOUCH.DOLLY_PAN,
                    }}
                  />
                  <Grid infiniteGrid fadeDistance={30} sectionColor="#333" cellColor="#111" />

                  {/* 3D TEXT WATERMARK / MARCA D'ÁGUA 3D */}
                  {watermarkEnabled && watermarkText.trim() !== "" && (
                    <Text
                      position={watermarkParams.position}
                      rotation={watermarkParams.rotation}
                      fontSize={watermarkSize}
                      color={watermarkStyle === "recessed" ? "#0a0a0a" : watermarkColor}
                      maxWidth={Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z) * 1.5}
                      textAlign="center"
                      anchorX="center"
                      anchorY="middle"
                      depthOffset={watermarkStyle === "overlay" ? -1 : 0}
                      outlineWidth={watermarkStyle === "recessed" ? 0.012 : 0}
                      outlineColor={watermarkStyle === "recessed" ? watermarkColor : "transparent"}
                    >
                      {watermarkText}
                      <meshStandardMaterial
                        color={watermarkStyle === "recessed" ? "#151515" : watermarkColor}
                        roughness={0.4}
                        metalness={watermarkStyle === "overlay" ? 0.0 : 0.4}
                        transparent={watermarkStyle === "overlay"}
                        opacity={watermarkStyle === "overlay" ? 0.4 : 1.0}
                        depthWrite={watermarkStyle !== "overlay"}
                        side={THREE.DoubleSide}
                      />
                    </Text>
                  )}
                </Canvas>

                {/* FLOATING CONTROLS GUIDE */}
                <div className="absolute top-6 left-6 bg-[#0A0A0A]/85 border border-zinc-800 backdrop-blur-md p-3.5 max-w-xs rounded text-[10px] uppercase tracking-wider text-zinc-400 space-y-1.5 pointer-events-none select-none z-10">
                  <div className="text-[#00E5FF] font-bold text-[11px] mb-1">3D Navigation Guide</div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-zinc-300">Left Click + Drag:</span>
                    <span>{paintMode ? "Paint Model" : "Rotate Camera"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-zinc-300">Right Click + Drag:</span>
                    <span>Rotate Camera</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-zinc-300">Scroll Wheel:</span>
                    <span>Zoom In / Out</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-zinc-300">Middle Click + Drag:</span>
                    <span>Pan Camera</span>
                  </div>
                  {paintMode && (
                    <div className="text-[9px] text-[#00FF41] mt-1 border-t border-zinc-800/60 pt-1.5 normal-case italic">
                      * Tip: Paint & navigate the camera seamlessly!
                    </div>
                  )}
                </div>

                {/* FLOATING CAMERA CONTROL HUD */}
                <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
                  <button
                    title="Zoom In"
                    onClick={handleZoomIn}
                    className="w-10 h-10 flex items-center justify-center bg-[#0A0A0A]/90 border border-zinc-800 text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF] backdrop-blur-md transition-all active:scale-95 rounded"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    title="Zoom Out"
                    onClick={handleZoomOut}
                    className="w-10 h-10 flex items-center justify-center bg-[#0A0A0A]/90 border border-zinc-800 text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF] backdrop-blur-md transition-all active:scale-95 rounded"
                  >
                    <span className="text-xl font-bold leading-none select-none">-</span>
                  </button>
                  <button
                    title="Reset Camera"
                    onClick={handleResetCamera}
                    className="w-10 h-10 flex items-center justify-center bg-[#0A0A0A]/90 border border-zinc-800 text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF] backdrop-blur-md transition-all active:scale-95 rounded"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-zinc-500 max-w-sm p-8 bg-[#0A0A0A] border border-zinc-800">
                  <Upload className="w-12 h-12 mx-auto mb-4 opacity-50 text-[#00E5FF]" />
                  <p className="font-bold tracking-widest uppercase text-[10px] mb-4 text-[#00E5FF]">No 3D Model Loaded</p>
                  <button onClick={loadDemoModel} className="bg-white text-black font-black uppercase text-xs px-6 py-3 tracking-widest hover:bg-[#00E5FF] transition-colors">
                    Load Demo Model
                  </button>
                </div>
              </div>
            )}

            {/* FLOATING CONTROL BAR */}
            {modelGeometry && (
              <div className="absolute bottom-6 left-6 right-6 bg-[#0A0A0A]/90 border border-zinc-800 backdrop-blur-md p-4 flex flex-wrap items-center justify-between gap-4 z-10">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPaintMode(true);
                      setPaintTool("brush");
                      setPreviewSeparated(false);
                    }}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors ${
                      paintMode && paintTool === "brush" && !previewSeparated
                        ? "bg-[#00E5FF] text-black border-[#00E5FF]"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    Pincel / Brush
                  </button>
                  <button
                    onClick={() => {
                      setPaintMode(true);
                      setPaintTool("bucket");
                      setPreviewSeparated(false);
                    }}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors ${
                      paintMode && paintTool === "bucket" && !previewSeparated
                        ? "bg-[#00E5FF] text-black border-[#00E5FF]"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                    title="Preenchimento inteligente 3D / Balde de Tinta"
                  >
                    <PaintBucket className="w-3.5 h-3.5" />
                    Balde / Bucket
                  </button>
                  <button
                    onClick={() => {
                      setPaintMode(true);
                      setPaintTool("eraser");
                      setPreviewSeparated(false);
                    }}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors ${
                      paintMode && paintTool === "eraser" && !previewSeparated
                        ? "bg-[#FF1744] text-white border-[#FF1744]"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                    title="Borracha para apagar partes pintadas / Erase painted areas back to base"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Apagar / Eraser
                  </button>
                  <button
                    onClick={() => {
                      setPaintMode(false);
                      setPreviewSeparated(false);
                    }}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors ${
                      !paintMode && !previewSeparated
                        ? "bg-[#00E5FF] text-black border-[#00E5FF]"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    Rotacionar / Rotate
                  </button>
                  <button
                    onClick={() => {
                      const next = !previewSeparated;
                      setPreviewSeparated(next);
                      if (next) {
                        setPaintMode(false);
                      }
                    }}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors ${
                      previewSeparated
                        ? "bg-emerald-400 text-black border-emerald-400 font-bold"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                    title="Visualizar as peças separadas no espaço 3D / Preview separated parts"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Preview Separar
                  </button>
                </div>

                {previewSeparated ? (
                  <div className="flex items-center gap-6 flex-1 max-w-xs px-4">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider whitespace-nowrap flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Explosão / Offset
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <Slider
                        value={[separationDistance]}
                        onValueChange={(val) => setSeparationDistance(val[0])}
                        min={0.0}
                        max={4.0}
                        step={0.05}
                        className="flex-1"
                      />
                      <span className="font-mono text-xs text-emerald-400 w-12 text-right font-bold">
                        {separationDistance.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-6 flex-1 max-w-xs px-4">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider whitespace-nowrap">
                      Brush Size
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <Slider
                        value={[brushRadius ?? 0.2]}
                        onValueChange={(val) => {
                          if (Array.isArray(val)) {
                            if (val.length > 0 && typeof val[0] === "number" && !isNaN(val[0])) {
                              setBrushRadius(val[0]);
                            }
                          } else if (typeof val === "number" && !isNaN(val)) {
                            setBrushRadius(val);
                          }
                        }}
                        min={0.05}
                        max={1.0}
                        step={0.01}
                        className="flex-1"
                      />
                      <span className="font-mono text-xs text-[#00E5FF] w-12 text-right">
                        {(brushRadius ?? 0.2).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-all ${
                      history.length > 0
                        ? "bg-[#0A0A0A] border-zinc-700 text-zinc-100 hover:text-white hover:border-[#00E5FF] hover:bg-zinc-900 active:scale-95"
                        : "bg-zinc-950/40 border-zinc-900 text-zinc-600 cursor-not-allowed"
                    }`}
                    title="Desfazer a última ação de pintura ou segmentação / Undo last stroke or segmentation"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    Desfazer / Undo {history.length > 0 && `(${history.length})`}
                  </button>

                  <button
                    onClick={resetPainting}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear All Paint
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR INSPECTOR */}
        <aside className="bg-[#0A0A0A] border-l border-[#222] p-6 flex flex-col gap-8 overflow-y-auto">
          {/* FILE UPLOAD & MODEL DATA */}
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">01. Model Input</h3>
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".stl,.obj,.fbx"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#151515] border border-zinc-800 hover:border-[#00E5FF] text-white py-4 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <Upload className="w-4 h-4 text-[#00E5FF]" />
                Upload STL, OBJ or FBX
              </button>

              {/* CONVERSION SETTINGS PANEL */}
              <div className="bg-[#111] border border-zinc-900 rounded overflow-hidden">
                <button
                  onClick={() => setShowConversionSettings(!showConversionSettings)}
                  className="w-full flex items-center justify-between p-3 text-[10px] uppercase font-black tracking-widest text-zinc-400 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className={`w-3.5 h-3.5 ${showConversionSettings ? 'text-[#00E5FF]' : 'text-zinc-600'}`} />
                    Configurações de Conversão
                  </div>
                  <Plus className={`w-3 h-3 transition-transform duration-300 ${showConversionSettings ? 'rotate-45 text-[#00E5FF]' : ''}`} />
                </button>

                {showConversionSettings && (
                  <div className="p-4 border-t border-zinc-900 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-bold text-zinc-500 block">Unidade de Medida (Importação)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setImportUnit("mm")}
                          className={`py-2 text-[10px] font-bold uppercase border rounded transition-all ${
                            importUnit === "mm"
                              ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30"
                              : "bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-white"
                          }`}
                        >
                          Milímetros (mm)
                        </button>
                        <button
                          onClick={() => setImportUnit("inch")}
                          className={`py-2 text-[10px] font-bold uppercase border rounded transition-all ${
                            importUnit === "inch"
                              ? "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30"
                              : "bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-white"
                          }`}
                        >
                          Polegadas (in)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500">
                        <span>Escala de Importação</span>
                        <span className="text-[#00E5FF] font-mono">{importScale.toFixed(2)}x</span>
                      </div>
                      <Slider
                        value={[importScale]}
                        onValueChange={(val) => setImportScale(val[0])}
                        min={0.01}
                        max={10.0}
                        step={0.01}
                      />
                      <p className="text-[8px] text-zinc-600 italic">
                        * A escala e unidade serão aplicadas no próximo upload ou recarregamento do modelo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {modelGeometry && (
                <div className="mt-2 bg-[#151515] p-3 border border-zinc-800">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setCapSelection("base")}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase ${capSelection === 'base' ? 'bg-[#00FF41] text-black' : 'bg-zinc-800 text-white'}`}
                    >
                      Base
                    </button>
                    <button
                      onClick={() => setCapSelection("top")}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase ${capSelection === 'top' ? 'bg-[#00FF41] text-black' : 'bg-zinc-800 text-white'}`}
                    >
                      Topo
                    </button>
                  </div>
                  <button
                    onClick={capHollowVase}
                    disabled={loadingCap}
                    className={`w-full bg-[#151515] border border-zinc-800 hover:border-[#00FF41] text-zinc-300 hover:text-white py-4 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${loadingCap ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <BoxSelect className={`w-4 h-4 text-[#00FF41] ${loadingCap ? 'animate-spin' : ''}`} />
                    {loadingCap ? "Processando..." : "Fechar Vaso Oco (Cap)"}
                  </button>
                  {isCapped && (
                    <button
                      onClick={downloadCappedModel}
                      disabled={isDownloadingCapped}
                      className={`w-full bg-[#00FF41] text-black border border-zinc-800 hover:bg-[#00CC33] py-4 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all mt-2 ${isDownloadingCapped ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Download className={`w-4 h-4 ${isDownloadingCapped ? 'animate-bounce' : ''}`} />
                      {isDownloadingCapped ? "Gerando Arquivo..." : "Baixar Vaso Fechado (STL)"}
                    </button>
                  )}
                </div>
              )}

              {modelGeometry && (
                <div className="grid grid-cols-2 gap-2 bg-[#151515] p-3 border border-zinc-800 mt-2">
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 block">Triangles</span>
                    <span className="font-mono text-sm text-white">{stats.faces.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 block">Status</span>
                    <span className="font-mono text-sm text-[#00FF41]">LOADED</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 02. SLA & FDM RESIN / FILAMENT ESTIMATOR */}
          {modelGeometry && (
            <section className="border-t border-zinc-900 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#00E5FF]" />
                  02. Calculadora de Preços & Estimativas
                </h3>
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[9px] uppercase font-bold text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF]/30 transition-all group"
                  title="Exportar estimativa para CSV"
                >
                  <FileJson className="w-3 h-3 group-hover:scale-110 transition-transform" />
                  CSV
                </button>
              </div>

              {/* ESTIMATOR TYPE TOGGLE */}
              <div className="flex bg-[#111] p-1 rounded border border-zinc-900 mb-4 font-sans">
                <button
                  onClick={() => {
                    setEstimatorType("SLA");
                    const defResin = MATERIALS.find(m => m.type === "SLA");
                    if (defResin) {
                      setSelectedMaterialId(defResin.id);
                      setMaterialDensity(defResin.density);
                      setResinCostPerKg(defResin.defaultCost);
                    }
                  }}
                  className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${
                    estimatorType === "SLA"
                      ? "bg-cyan-500/10 text-[#00E5FF] border border-cyan-500/20"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  SLA (Resina)
                </button>
                <button
                  onClick={() => {
                    setEstimatorType("FDM");
                    const defFilament = MATERIALS.find(m => m.type === "FDM");
                    if (defFilament) {
                      setSelectedMaterialId(defFilament.id);
                      setMaterialDensity(defFilament.density);
                      setFdmFilamentCostPerKg(defFilament.defaultCost);
                    }
                  }}
                  className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${
                    estimatorType === "FDM"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  FDM (Filamento)
                </button>
              </div>

              {/* MATERIAL DROPDOWN */}
              <div className="mb-4 space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-500 block px-1">Perfil de Material / Insumo</label>
                <div className="relative group/mat">
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => {
                      const mat = MATERIALS.find(m => m.id === e.target.value);
                      if (mat) {
                        setSelectedMaterialId(mat.id);
                        setMaterialDensity(mat.density);
                        if (mat.type === "SLA") setResinCostPerKg(mat.defaultCost);
                        else setFdmFilamentCostPerKg(mat.defaultCost);
                      }
                    }}
                    className="w-full bg-[#111] border border-zinc-800 p-2.5 rounded text-[10px] text-zinc-200 font-bold uppercase focus:outline-none focus:border-[#00E5FF] appearance-none cursor-pointer"
                  >
                    {MATERIALS.filter(m => m.type === estimatorType).map(mat => (
                      <option key={mat.id} value={mat.id}>{mat.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                    <Play className="w-2.5 h-2.5 rotate-90" />
                  </div>
                </div>
                <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-black px-1">
                  <span>Densidade: {materialDensity.toFixed(2)} g/cm³</span>
                  <span>Preço Sugerido: R$ {(estimatorType === "SLA" ? resinCostPerKg : fdmFilamentCostPerKg).toFixed(0)}/kg</span>
                </div>
              </div>

              {/* ESTIMATES RESULTS BOX */}
              <div className="bg-[#111] border border-zinc-900 rounded p-4 space-y-4 mb-4 font-sans relative overflow-hidden transition-all duration-300">
                {/* Thin top edge glowing progress bar */}
                {isEstimating && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-950 z-20">
                    <div 
                      className={`h-full transition-all duration-100 ease-out ${
                        estimatorType === "SLA" 
                          ? "bg-gradient-to-r from-cyan-500 to-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.8)]" 
                          : "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      }`}
                      style={{ width: `${estimateProgress}%` }}
                    />
                  </div>
                )}

                {/* Animated Scanner Overloading Layer */}
                {isEstimating && (
                  <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-3 z-10 select-none">
                    {/* Glowing light sweep */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded">
                      <div className={`w-full h-1/2 bg-gradient-to-b ${
                        estimatorType === "SLA" ? "from-[#00E5FF]/5 to-transparent" : "from-emerald-400/5 to-transparent"
                      } absolute top-0 left-0 right-0 animate-scanner-loop border-b ${
                        estimatorType === "SLA" ? "border-[#00E5FF]/20" : "border-emerald-400/20"
                      }`} />
                    </div>

                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 animate-spin ${estimatorType === "SLA" ? "text-[#00E5FF]" : "text-emerald-400"}`} />
                      <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-300">
                        {estimatorType === "SLA" ? "Fatiando SLA..." : "Fatiando FDM..."}
                      </span>
                    </div>

                    <div className="text-center space-y-1 w-full max-w-[220px] px-4">
                      <div className="flex justify-between items-center text-[8px] uppercase font-mono text-zinc-500">
                        <span>Status</span>
                        <span className={`${estimatorType === "SLA" ? "text-[#00E5FF]" : "text-emerald-400"} font-bold`}>
                          {estimateProgress}%
                        </span>
                      </div>
                      <div className="w-full h-[3px] bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-75 ${estimatorType === "SLA" ? "bg-[#00E5FF]" : "bg-emerald-400"}`}
                          style={{ width: `${estimateProgress}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-medium text-zinc-400 uppercase tracking-wider text-center pt-1.5 truncate">
                        {getSlicingStatus(estimateProgress)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Print Size Dimensions */}
                <div className="grid grid-cols-3 gap-2 text-center pb-3 border-b border-zinc-900">
                  <div className="bg-zinc-950/40 p-2 rounded border border-zinc-900/40">
                    <span className="text-[8px] uppercase text-zinc-500 block font-bold">X (Largura)</span>
                    <span className="font-mono text-xs text-white font-black block mt-1">
                      {scaledX.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">mm</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#00E5FF] font-bold block mt-0.5">
                      {(scaledX / 10.0).toFixed(2)} <span className="text-[8px] text-[#00E5FF]/60 font-normal">cm</span>
                    </span>
                  </div>
                  <div className="bg-zinc-950/40 p-2 rounded border border-zinc-900/40">
                    <span className="text-[8px] uppercase text-zinc-500 block font-bold">Y (Comprimento)</span>
                    <span className="font-mono text-xs text-white font-black block mt-1">
                      {scaledY.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">mm</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#00E5FF] font-bold block mt-0.5">
                      {(scaledY / 10.0).toFixed(2)} <span className="text-[8px] text-[#00E5FF]/60 font-normal">cm</span>
                    </span>
                  </div>
                  <div className="bg-zinc-950/40 p-2 rounded border border-zinc-900/40">
                    <span className="text-[8px] uppercase text-zinc-500 block font-bold">Z (Altura)</span>
                    <span className="font-mono text-xs text-white font-black block mt-1">
                      {scaledZ.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">mm</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#00E5FF] font-bold block mt-0.5">
                      {(scaledZ / 10.0).toFixed(2)} <span className="text-[8px] text-[#00E5FF]/60 font-normal">cm</span>
                    </span>
                  </div>
                </div>

                {/* Main numbers: Volume & Weight & Cost & Time */}
                {estimatorType === "SLA" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-emerald-400" /> Volume Resina
                      </span>
                      <span className="font-mono text-sm text-emerald-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          const finalVol = isHollow ? rawVol * 0.30 : rawVol;
                          return finalVol.toFixed(2);
                        })()} mL
                      </span>
                    </div>

                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Layers className="w-3 h-3 text-cyan-400" /> Peso Estimado
                      </span>
                      <span className="font-mono text-sm text-cyan-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          const finalVol = isHollow ? rawVol * 0.30 : rawVol;
                          const weight = finalVol * materialDensity;
                          return weight.toFixed(1);
                        })()} g
                      </span>
                    </div>

                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-400" /> Tempo Impressão
                      </span>
                      <span className="font-mono text-sm text-purple-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                          const totalLayers = Math.max(1, Math.ceil(pz / layerHeight));
                          const totalSecs = totalLayers * (exposureTime + 5.0) + 120; // 5s lift overhead, 120s burn-in
                          const hours = Math.floor(totalSecs / 3600);
                          const minutes = Math.floor((totalSecs % 3600) / 60);
                          return `${hours}h ${minutes}m`;
                        })()}
                      </span>
                    </div>

                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-yellow-400" /> Custo Resina
                      </span>
                      <span className="font-mono text-sm text-yellow-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          const finalVol = isHollow ? rawVol * 0.30 : rawVol;
                          const weight = finalVol * materialDensity;
                          const cost = (weight / 1000.0) * resinCostPerKg;
                          return `$${cost.toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-emerald-400" /> Vol. Filamento
                      </span>
                      <span className="font-mono text-sm text-emerald-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          // FDM printed volume ratio calculation (walls + infill)
                          const shellFactor = Math.min(0.8, 0.08 * fdmWallCount);
                          const infillFactor = fdmInfill / 100.0;
                          const fdmVolRatio = shellFactor + (1.0 - shellFactor) * infillFactor;
                          const finalVol = rawVol * Math.max(0.05, fdmVolRatio);
                          return finalVol.toFixed(2);
                        })()} cm³
                      </span>
                    </div>

                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Layers className="w-3 h-3 text-cyan-400" /> Peso Filamento
                      </span>
                      <span className="font-mono text-sm text-cyan-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          const shellFactor = Math.min(0.8, 0.08 * fdmWallCount);
                          const infillFactor = fdmInfill / 100.0;
                          const fdmVolRatio = shellFactor + (1.0 - shellFactor) * infillFactor;
                          const finalVol = rawVol * Math.max(0.05, fdmVolRatio);
                          const weight = finalVol * materialDensity;
                          return weight.toFixed(1);
                        })()} g
                      </span>
                    </div>

                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-400" /> Tempo Impressão
                      </span>
                      <span className="font-mono text-sm text-purple-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          const shellFactor = Math.min(0.8, 0.08 * fdmWallCount);
                          const infillFactor = fdmInfill / 100.0;
                          const fdmVolRatio = shellFactor + (1.0 - shellFactor) * infillFactor;
                          const finalVol = rawVol * Math.max(0.05, fdmVolRatio); // in mL or cm3
                          
                          // Volumetric flow speed: extrusion width (0.42mm) * layerHeight * printSpeed
                          const volumetricFlow = 0.42 * fdmLayerHeight * fdmPrintSpeed; // mm3/s
                          const printSecs = (finalVol * 1000.0) / (volumetricFlow || 1.0);
                          const totalSecs = printSecs * 1.30 + 900; // 30% overhead travel, 15min warm up
                          
                          const hours = Math.floor(totalSecs / 3600);
                          const minutes = Math.floor((totalSecs % 3600) / 60);
                          return `${hours}h ${minutes}m`;
                        })()}
                      </span>
                    </div>

                    <div className="bg-zinc-950/80 p-3 rounded border border-zinc-900/60 flex flex-col justify-between">
                      <span className="text-[8px] uppercase text-zinc-500 block flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-yellow-400" /> Custo Filamento
                      </span>
                      <span className="font-mono text-sm text-yellow-400 font-bold mt-1">
                        {(() => {
                          const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
                          const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
                          const scaleMultiplier = printScale / 100.0;
                          let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
                          if (rawVol <= 0.001) {
                            const px = modelDimensions.x * autoScaleFactor * scaleMultiplier;
                            const py = modelDimensions.y * autoScaleFactor * scaleMultiplier;
                            const pz = modelDimensions.z * autoScaleFactor * scaleMultiplier;
                            rawVol = (px * py * pz) * 0.001 * 0.40;
                          }
                          const shellFactor = Math.min(0.8, 0.08 * fdmWallCount);
                          const infillFactor = fdmInfill / 100.0;
                          const fdmVolRatio = shellFactor + (1.0 - shellFactor) * infillFactor;
                          const finalVol = rawVol * Math.max(0.05, fdmVolRatio);
                          const weight = finalVol * materialDensity;
                          const cost = (weight / 1000.0) * fdmFilamentCostPerKg;
                          return `$${cost.toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Info Tip based on current mode */}
                {estimatorType === "SLA" ? (
                  isHollow ? (
                    <div className="text-[9px] text-[#00FF41] bg-[#00FF41]/5 p-2 rounded border border-[#00FF41]/20">
                      💡 <strong>Modelo Oco (Hollowed):</strong> Economia de aproximadamente 70% de resina! Lembre-se de adicionar furos de escape no fatiador.
                    </div>
                  ) : (
                    <div className="text-[9px] text-zinc-500 bg-zinc-950 p-2 rounded border border-zinc-900">
                      💡 <strong>Dica SLA:</strong> Modelos ocos economizam muita resina. Ative a opção abaixo para ver a estimativa correspondente.
                    </div>
                  )
                ) : (
                  <div className="text-[9px] text-zinc-500 bg-zinc-950 p-2 rounded border border-zinc-900">
                    💡 <strong>Dica FDM:</strong> Preenchimento (Infill) de 15% a 25% é o ideal para a maioria das peças decorativas ou protótipos.
                  </div>
                )}
              </div>

              {/* ESTIMATES CONTROL SLIDERS */}
              <div className="space-y-4 bg-zinc-950 p-3.5 border border-zinc-900 rounded font-sans">
                {/* Print Scale - Shared between SLA & FDM */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                    <span className="flex items-center">
                      Escala / Scale
                      <HelpTooltip text="Ajusta o tamanho final do modelo impresso. Alterar a escala afeta proporcionalmente o volume, tempo e peso da peça." />
                    </span>
                    <div className="flex items-center bg-zinc-900 border border-zinc-850 rounded px-1.5 py-0.5 w-24">
                      <input
                        type="number"
                        value={printScale}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            setPrintScale(Math.max(1, Math.min(2000, val)));
                          }
                        }}
                        className="w-full bg-transparent text-right text-xs font-mono text-[#00E5FF] focus:outline-none"
                        min="1"
                        max="2000"
                        step="0.1"
                      />
                      <span className="text-[10px] text-zinc-500 font-bold ml-1">%</span>
                    </div>
                  </div>
                  
                  <Slider
                    value={[printScale]}
                    onValueChange={(v) => setPrintScale(v[0])}
                    min={1}
                    max={500}
                    step={1}
                  />

                  {/* Escalas Rápidas / Quick Percent Presets */}
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase font-bold text-zinc-500 block">Atalhos de Escala (%):</span>
                    <div className="grid grid-cols-6 gap-1">
                      {[25, 50, 75, 100, 150, 200].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setPrintScale(preset)}
                          className={`py-1 text-[8px] font-mono uppercase border rounded transition-all cursor-pointer text-center ${
                            printScale === preset
                              ? "bg-[#00E5FF] text-black border-[#00E5FF] font-bold"
                              : "bg-zinc-950 text-zinc-400 border-zinc-900 hover:text-white"
                          }`}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* RPG / Miniature Height Targets */}
                  <div className="space-y-3 pt-2.5 border-t border-zinc-900/60">
                    <span className="text-[8px] uppercase font-bold text-[#00E5FF] flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> 
                      <span>Proporções de Miniatura (Mercado de Estatuetas & RPG)</span>
                      <HelpTooltip text="Atalhos rápidos para escalar estatuetas e personagens de acordo com escalas de RPG consagradas no mercado." />
                    </span>

                    {/* Mode Selector */}
                    <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-900">
                      <button
                        type="button"
                        onClick={() => {
                          setMiniatureScaleMode("human");
                        }}
                        className={`py-1 px-1 text-[8px] font-bold uppercase rounded transition-all cursor-pointer text-center ${
                          miniatureScaleMode === "human"
                            ? "bg-[#00E5FF] text-black"
                            : "text-zinc-400 hover:text-white"
                        }`}
                        title="Mantém a proporção real de um humano de 1.80m na escala selecionada"
                      >
                        Base Humana (1.80m)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMiniatureScaleMode("direct");
                        }}
                        className={`py-1 px-1 text-[8px] font-bold uppercase rounded transition-all cursor-pointer text-center ${
                          miniatureScaleMode === "direct"
                            ? "bg-[#00E5FF] text-black"
                            : "text-zinc-400 hover:text-white"
                        }`}
                        title="Escalona as dimensões do arquivo diretamente pela fração (Ex: 1/16 do tamanho do arquivo original)"
                      >
                        Direto do Arquivo (1:1)
                      </button>
                    </div>

                    {/* Explanatory subtitle */}
                    <p className="text-[7.5px] text-zinc-500 uppercase tracking-wide leading-normal">
                      {miniatureScaleMode === "human" 
                        ? "Ajusta a altura final (Z) com base na proporção que um humano de 1.80m teria nesta escala."
                        : "Divide o tamanho original do arquivo STL diretamente pelo denominador selecionado."
                      }
                    </p>

                    {/* Miniature Presets Grid */}
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { label: "1/8 (22.5cm)", value: 8, subtitle: "Estátua Grande" },
                        { label: "1/12 (15cm)", value: 12, subtitle: "Dollhouse / Ação" },
                        { label: "1/16 (11.25cm)", value: 16, subtitle: "Colecionável" },
                        { label: "1/24 (7.5cm)", value: 24, subtitle: "Estatuetas 75mm" },
                        { label: "1/32 (5.6cm)", value: 32, subtitle: "Históricos 54mm" },
                        { label: "1/35 (5.1cm)", value: 35, subtitle: "Plastimodelismo" },
                        { label: "1/48 (3.75cm)", value: 48, subtitle: "Aeromodelos" },
                        { label: "1/56 (3.2cm)", value: 56, subtitle: "Heroic 32mm" },
                        { label: "1/64 (2.8cm)", value: 64, subtitle: "RPG de Mesa 28mm" },
                        { label: "1/72 (2.5cm)", value: 72, subtitle: "Históricos Micro" },
                        { label: "1/100 (1.8cm)", value: 100, subtitle: "Wargame 15mm" }
                      ].map((item) => {
                        // Calculate corresponding target scale percentage to see if it matches current printScale
                        let targetScale = 0;
                        if (miniatureScaleMode === "human" && originalZ > 0) {
                          const targetZ = 1800.0 / item.value;
                          targetScale = (targetZ / originalZ) * 100.0;
                        } else {
                          targetScale = 100.0 / item.value;
                        }
                        const isCurrentActive = Math.abs(printScale - targetScale) < 0.2;

                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              applyMiniatureScale(item.value);
                            }}
                            disabled={miniatureScaleMode === "human" && !originalZ}
                            className={`p-1 border rounded transition-all cursor-pointer text-left flex flex-col justify-between h-[36px] ${
                              isCurrentActive
                                ? "bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF]"
                                : "bg-zinc-950 text-zinc-400 border-zinc-900 hover:text-white disabled:opacity-30"
                            }`}
                          >
                            <span className="text-[9px] font-black leading-tight block">{item.label.split(" ")[0]}</span>
                            <span className="text-[7px] text-zinc-500 block truncate font-medium">{item.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Miniature Ratio Input */}
                    <div className="flex gap-2 items-center bg-zinc-950 p-2 rounded border border-zinc-900 mt-1">
                      <span className="text-[8px] uppercase font-bold text-zinc-500">Razão Custom:</span>
                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 flex-1">
                        <span className="text-[10px] text-zinc-500 font-bold mr-1">1 /</span>
                        <input
                          type="number"
                          value={customMiniatureRatio}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              setCustomMiniatureRatio(val);
                            }
                          }}
                          className="w-full bg-transparent text-xs font-mono text-[#00E5FF] focus:outline-none"
                          min="1"
                          max="1000"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => applyMiniatureScale(customMiniatureRatio)}
                        className="px-2 py-1 text-[8px] uppercase font-black tracking-wider bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/35 border border-[#00E5FF]/40 rounded cursor-pointer transition-all"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mode Specific Controls */}
                {estimatorType === "SLA" ? (
                  <>
                    {/* Hollow model Toggle */}
                    <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center">
                          <span>Modelo Oco / Hollow</span>
                          <HelpTooltip text="Cria paredes de 2mm no modelo em vez de imprimi-lo maciço, gerando uma enorme economia de até 70% de resina líquida." />
                        </span>
                        <span className="text-[9px] text-zinc-500">Parede de 2mm (economiza resina)</span>
                      </div>
                      <button
                        onClick={() => setIsHollow(!isHollow)}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded border transition-all ${
                          isHollow
                            ? "bg-emerald-400/20 border-emerald-400 text-emerald-400"
                            : "bg-[#111] border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {isHollow ? "Ativo / Yes" : "Não / Solid"}
                      </button>
                    </div>

                    {/* Layer Height Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Camada / Layer Height
                          <HelpTooltip text="Determina a espessura de cada camada de cura. Valores menores (ex: 20μm) geram mais detalhes, mas aumentam o tempo total de impressão." />
                        </span>
                        <span className="text-purple-400 font-mono">{(layerHeight * 1000).toFixed(0)} μm ({layerHeight} mm)</span>
                      </div>
                      <Slider
                        value={[layerHeight]}
                        onValueChange={(v) => setLayerHeight(v[0])}
                        min={0.02}
                        max={0.15}
                        step={0.01}
                      />
                    </div>

                    {/* Exposure Time Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Exposição / Exposure
                          <HelpTooltip text="Tempo em segundos que a tela UV fica acesa por camada para curar a resina líquida. Ajuste de acordo com a resina utilizada." />
                        </span>
                        <span className="text-yellow-400 font-mono">{exposureTime}s</span>
                      </div>
                      <Slider
                        value={[exposureTime]}
                        onValueChange={(v) => setExposureTime(v[0])}
                        min={1.0}
                        max={10.0}
                        step={0.1}
                      />
                    </div>

                    {/* Resin Cost */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Preço da Resina / Resin Cost
                          <HelpTooltip text="Custo por quilograma da resina líquida. Usado para calcular a estimativa de preço final de consumo da peça." />
                        </span>
                        <span className="text-zinc-300 font-mono">${resinCostPerKg} / kg</span>
                      </div>
                      <Slider
                        value={[resinCostPerKg]}
                        onValueChange={(v) => setResinCostPerKg(v[0])}
                        min={15}
                        max={120}
                        step={1}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Infill Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Preenchimento / Infill
                          <HelpTooltip text="Densidade da estrutura interna da peça em grade. 0% é oca, 100% é totalmente sólida. Valores de 15-20% são ideais para miniaturas e decorativos." />
                        </span>
                        <span className="text-emerald-400 font-mono">{fdmInfill}%</span>
                      </div>
                      <Slider
                        value={[fdmInfill]}
                        onValueChange={(v) => setFdmInfill(v[0])}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </div>

                    {/* Wall/Shell count Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Paredes / Wall Count (Perímetros)
                          <HelpTooltip text="Quantidade de voltas externas (perímetros/casca) que a impressora faz antes de preencher o interior. Mais paredes aumentam a resistência da peça." />
                        </span>
                        <span className="text-cyan-400 font-mono">{fdmWallCount} linhas</span>
                      </div>
                      <Slider
                        value={[fdmWallCount]}
                        onValueChange={(v) => setFdmWallCount(v[0])}
                        min={1}
                        max={8}
                        step={1}
                      />
                    </div>

                    {/* Layer Height Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Altura de Camada / Layer Height
                          <HelpTooltip text="Altura de cada linha de filamento depositado. Camadas mais finas (ex: 0.12mm) dão excelente acabamento, mas demoram mais para fatiar e imprimir." />
                        </span>
                        <span className="text-purple-400 font-mono">{fdmLayerHeight} mm</span>
                      </div>
                      <Slider
                        value={[fdmLayerHeight]}
                        onValueChange={(v) => setFdmLayerHeight(v[0])}
                        min={0.08}
                        max={0.36}
                        step={0.02}
                      />
                    </div>

                    {/* Printing Speed Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Velocidade / Print Speed
                          <HelpTooltip text="Velocidade de deslocamento do bocal de extrusão durante a impressão. Velocidades muito altas podem reduzir a precisão dos detalhes." />
                        </span>
                        <span className="text-yellow-400 font-mono">{fdmPrintSpeed} mm/s</span>
                      </div>
                      <Slider
                        value={[fdmPrintSpeed]}
                        onValueChange={(v) => setFdmPrintSpeed(v[0])}
                        min={30}
                        max={300}
                        step={10}
                      />
                    </div>

                    {/* Filament Cost Slider */}
                    <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                        <span className="flex items-center">
                          Preço do Filamento / Filament Cost
                          <HelpTooltip text="Preço por quilograma do rolo de filamento (PLA/ABS/PETG). Usado para calcular o custo estimado de matéria-prima." />
                        </span>
                        <span className="text-zinc-300 font-mono">${fdmFilamentCostPerKg} / kg</span>
                      </div>
                      <Slider
                        value={[fdmFilamentCostPerKg]}
                        onValueChange={(v) => setFdmFilamentCostPerKg(v[0])}
                        min={10}
                        max={80}
                        step={1}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* PROFILE PRESETS & SETTINGS EXPORT/IMPORT */}
          {modelGeometry && (
            <section className="border-t border-zinc-900 pt-6">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-[#00E5FF]" />
                Perfis & Configurações / Profiles & Settings
              </h3>
              
              <div className="bg-[#111] border border-zinc-900 rounded p-4 space-y-4 font-sans">
                {/* PRESET PROFILES DROPDOWN SELECTOR */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-zinc-400 flex items-center">
                    <span>Carregar Perfil Pré-definido / Load Preset</span>
                    <HelpTooltip text="Carregue conjuntos de configurações pré-testadas para impressões rápidas, detalhadas ou resistentes, otimizando o seu tempo." />
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        applyPresetProfile(e.target.value);
                        e.target.value = ""; // Reset
                      }
                    }}
                    defaultValue=""
                    className="w-full bg-[#151515] border border-zinc-800 text-zinc-300 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-[#00E5FF] transition-all"
                  >
                    <option value="" disabled>-- Selecione um Perfil / Select Profile --</option>
                    <optgroup label="SLA (Resina / Resin)">
                      <option value="sla_standard">SLA Padrão (Standard Resin - 50μm)</option>
                      <option value="sla_high_detail">SLA Alta Definição (High Detail - 20μm)</option>
                      <option value="sla_draft_hollow">SLA Rápido & Oco (Draft Hollow - 100μm)</option>
                    </optgroup>
                    <optgroup label="FDM (Filamento / Filament)">
                      <option value="fdm_standard">FDM Padrão PLA (Standard 0.20mm - 20%)</option>
                      <option value="fdm_draft">FDM Rápido / Rascunho (Draft 0.28mm - 15%)</option>
                      <option value="fdm_strong">FDM Peça Resistente (Solid/Strong 0.16mm - 40%)</option>
                    </optgroup>
                  </select>
                </div>

                {/* NOTIFICATION STATUS INDICATOR */}
                {settingsNotification && (
                  <div className={`p-2.5 rounded text-[10px] uppercase font-bold tracking-wide flex items-center gap-2 transition-all ${
                    settingsNotification.type === "success" 
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                      : "bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744]"
                  }`}>
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-relaxed">{settingsNotification.message}</span>
                  </div>
                )}

                {/* ACTIONS GRID */}
                <div className="grid grid-cols-2 gap-2">
                  {/* EXPORT CURRENT CONFIGS */}
                  <button
                    onClick={exportSettingsJSON}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-zinc-950 border border-zinc-800 hover:border-[#00E5FF] hover:bg-zinc-900 text-zinc-300 hover:text-white rounded transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    title="Exportar parâmetros atuais para arquivo JSON / Export current parameters to JSON file"
                  >
                    <FileJson className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Exportar JSON
                  </button>

                  {/* IMPORT CONFIGS */}
                  <button
                    onClick={() => settingsInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-400 hover:bg-zinc-900 text-zinc-300 hover:text-white rounded transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    title="Importar configurações de um arquivo JSON / Import parameters from JSON file"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    Importar JSON
                  </button>
                  <input
                    type="file"
                    ref={settingsInputRef}
                    onChange={importSettingsJSON}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
            </section>
          )}

          {/* 03. FORNECEDORES & INSUMOS (ALWAYS VISIBLE) */}
          <section className="border-t border-zinc-900 pt-6">
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Fornecedores / Suggested Suppliers
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowSuppliers(!showSuppliers)}
                className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900 rounded text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#00E5FF] hover:border-[#00E5FF]/30 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 group-hover:animate-bounce" />
                  Ver Lista de Fornecedores
                </div>
                {showSuppliers ? <Undo className="w-3 h-3 rotate-90 text-[#00E5FF]" /> : <Plus className="w-3 h-3" />}
              </button>

              {showSuppliers && (
                <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      onClick={() => setEstimatorType("SLA")}
                      className={`py-1.5 text-[8px] font-bold uppercase rounded border transition-all ${
                        estimatorType === "SLA" ? "bg-cyan-500/10 text-[#00E5FF] border-cyan-500/30" : "bg-zinc-900 text-zinc-600 border-zinc-800"
                      }`}
                    >
                      Resina (SLA)
                    </button>
                    <button
                      onClick={() => setEstimatorType("FDM")}
                      className={`py-1.5 text-[8px] font-bold uppercase rounded border transition-all ${
                        estimatorType === "FDM" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-900 text-zinc-600 border-zinc-800"
                      }`}
                    >
                      Filamento (FDM)
                    </button>
                  </div>

                  {(estimatorType === "SLA" ? [
                    { name: "3D PRIME", url: "https://3dprime.com.br/resinas", desc: "Resinas premium e técnicas" },
                    { name: "GTMAX 3D", url: "https://gtmax3d.com.br/", desc: "Especialista em insumos industriais" },
                    { name: "ANYCUBIC BRASIL", url: "https://anycubic.com.br/", desc: "Revenda oficial e custo-benefício" },
                    { name: "SLA7", url: "https://sla7.com.br/", desc: "Foco em odontologia e joalheria" }
                  ] : [
                    { name: "3D FILA", url: "https://3dfila.com.br/", desc: "Pioneira nacional em filamentos" },
                    { name: "VOOLT3D", url: "https://www.voolt3d.com.br/", desc: "Grande variedade de cores e tipos" },
                    { name: "CLIEVER", url: "https://www.cliever.com/", desc: "Filamentos profissionais de alta performance" },
                    { name: "3D PRIME", url: "https://3dprime.com.br/filamentos", desc: "Opções de PLA, ABS e PETG" }
                  ]).map((sup, idx) => (
                    <a
                      key={idx}
                      href={sup.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-zinc-900 rounded hover:border-[#00E5FF]/40 hover:bg-[#111] transition-all group/item"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-black text-zinc-300 group-hover/item:text-white flex items-center gap-2">
                          {sup.name}
                          <Play className="w-2 h-2 text-zinc-700 group-hover/item:text-[#00E5FF]" />
                        </div>
                        <div className="text-[8px] text-zinc-600 uppercase tracking-tighter">
                          {sup.desc}
                        </div>
                      </div>
                      <Download className="w-3 h-3 text-zinc-800 group-hover/item:text-[#00E5FF] rotate-[-90deg]" />
                    </a>
                  ))}
                  <p className="text-[7px] text-zinc-700 uppercase font-bold text-center pt-1 italic">
                    * Os links levam para sites externos de fornecedores reconhecidos no mercado brasileiro.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* COLOR SELECTION GROUPS */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center">
                <span>04. Active Paint Part / Parte Ativa</span>
                <HelpTooltip text="Gerencie e selecione os componentes ou partes do seu boneco/peça para aplicar cores diferentes de forma isolada." />
              </h3>
              
              <button
                onClick={() => {
                  setAutoIsolateActive(!autoIsolateActive);
                  setIsolateGroupId(null); // Clear manual override when toggling auto-highlight
                }}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border rounded transition-all ${
                  autoIsolateActive
                    ? "bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF]"
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
                }`}
                title="Sempre isolar a parte atualmente selecionada no visualizador 3D / Automatically isolate currently selected part"
              >
                <Layers className="w-3 h-3" />
                Destaque Ativo / Auto Highlight
              </button>
            </div>
            {modelGeometry ? (
              <div className="space-y-2.5">
                {groups.filter((g) => g.id > 0).map((group) => {
                  const isActive = activeGroupId === group.id;
                  const isIsolated = effectiveIsolateGroupId === group.id;
                  return (
                    <div key={group.id} className="bg-[#111111] border border-zinc-900 rounded p-2.5 space-y-2.5 transition-all">
                      <div className="flex gap-1.5 items-stretch">
                        <button
                          onClick={() => {
                            setActiveGroupId(group.id);
                            setPaintMode(true);
                          }}
                          className={`flex-1 flex items-center justify-between p-2.5 bg-[#161616] border transition-all rounded ${
                            isActive ? "border-[#00E5FF]" : "border-zinc-800 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-4 h-4 rounded-full border border-white/10 shadow-inner shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className={`text-[11px] font-bold uppercase tracking-wider text-left ${isActive ? "text-[#00E5FF]" : "text-zinc-300"}`}>
                              {group.name}
                            </span>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (autoIsolateActive) {
                              setAutoIsolateActive(false);
                              setIsolateGroupId(isIsolated ? null : group.id);
                            } else {
                              setIsolateGroupId(isIsolated ? null : group.id);
                            }
                          }}
                          className={`px-3 border rounded transition-colors flex items-center justify-center ${
                            isIsolated 
                              ? "bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF]" 
                              : "bg-[#161616] border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700"
                          }`}
                          title={isIsolated ? "Mostrar modelo completo / Show full model" : "Isolar/Destacar esta peça / Isolate/Highlight this piece"}
                        >
                          {isIsolated ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Dynamic Color Palette & Name Editor when active */}
                      {isActive && (
                        <div className="bg-[#161616] p-3 border border-zinc-850 space-y-3 rounded">
                          {/* Name input */}
                          <div>
                            <label className="text-[9px] uppercase text-zinc-500 font-bold flex items-center mb-1">
                              <span>Nome da Peça / Part Name</span>
                              <HelpTooltip text="Altere o nome identificador deste componente (ex: Capa, Espada, Cabelo) para facilitar a pintura 3D." />
                            </label>
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => updateGroupName(group.id, e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-zinc-800 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00E5FF] transition-all font-bold uppercase tracking-wider"
                              placeholder="Nome da peça..."
                            />
                          </div>

                          {/* Color Palette & Custom picker */}
                          <div>
                            <label className="text-[9px] uppercase text-zinc-500 font-bold flex items-center mb-2">
                              <span>Paleta de Cores / Color Palette</span>
                              <HelpTooltip text="Selecione a cor que será aplicada a este componente. Você também pode clicar no botão colorido '+' para escolher um tom personalizado." />
                            </label>
                            <div className="flex flex-wrap gap-2 items-center">
                              {PRESET_COLORS.map((presetColor) => (
                                <button
                                  key={presetColor}
                                  onClick={() => updateGroupColor(group.id, presetColor)}
                                  className={`w-5.5 h-5.5 rounded-full border transition-transform hover:scale-115 ${
                                    group.color.toLowerCase() === presetColor.toLowerCase()
                                      ? "border-white scale-110 shadow-md ring-2 ring-[#00E5FF]"
                                      : "border-transparent"
                                  }`}
                                  style={{ backgroundColor: presetColor }}
                                  title={presetColor}
                                />
                              ))}
                              
                              {/* Custom Color Picker Button */}
                              <label className="relative w-5.5 h-5.5 rounded-full cursor-pointer border border-zinc-700 hover:border-zinc-400 bg-linear-to-tr from-red-500 via-green-500 to-blue-500 transition-transform hover:scale-115 flex items-center justify-center overflow-hidden" title="Cor personalizada / Custom color...">
                                <input
                                  type="color"
                                  value={group.color}
                                  onChange={(e) => updateGroupColor(group.id, e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                                />
                                <span className="text-[10px] text-white font-bold pointer-events-none drop-shadow-md">+</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ADD NEW CUSTOM GROUP */}
                <button
                  onClick={addCustomGroup}
                  className="w-full mt-2 border border-dashed border-zinc-800 hover:border-[#00E5FF] bg-zinc-950/40 hover:bg-[#00E5FF]/5 p-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all rounded shadow-sm"
                >
                  <Plus className="w-4 h-4 text-[#00E5FF]" />
                  Adicionar Nova Peça / Add Part
                </button>

                {/* ADVANCED FILL / PREENCHIMENTO */}
                <div className="space-y-2 mt-4 pt-4 border-t border-zinc-900">
                  <button
                    onClick={expandConnectedPaint}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-zinc-900 border border-zinc-800 hover:border-[#00E5FF] hover:bg-zinc-800 text-zinc-100 text-[10px] font-bold uppercase tracking-wider transition-all rounded shadow-md"
                    title="Expande a cor atual para preencher toda a região conectada que ainda está cinza"
                  >
                    <PaintBucket className="w-4 h-4 text-[#00E5FF]" />
                    Preencher Parte Conectada (Braço/Etc)
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={fillRemainingWithActiveGroup}
                      className="flex items-center justify-center gap-2 p-2.5 bg-[#121212] border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-900/40 text-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-all rounded"
                      title="Pinta todas as partes cinzas restantes com a cor selecionada"
                    >
                      <Paintbrush className="w-3.5 h-3.5 text-zinc-400" />
                      Completar Restante
                    </button>
                    <button
                      onClick={fillAllWithActiveGroup}
                      className="flex items-center justify-center gap-2 p-2.5 bg-[#121212] border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-900/40 text-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-all rounded"
                      title="Pinta o modelo inteiro com a cor selecionada"
                    >
                      <Check className="w-3.5 h-3.5 text-zinc-400" />
                      Preencher Tudo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-zinc-800 rounded bg-[#0b0b0b] text-center text-[10px] text-zinc-500 uppercase tracking-wider">
                Upload a 3D model first to enable painting
              </div>
            )}
          </section>

          {/* AUTO-DETECTION FEATURES */}
          {modelGeometry && (
            <section className="border-t border-zinc-900 pt-6">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                05. Auto-Detecção de Peças
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 leading-relaxed">
                Use inteligência geométrica para segmentar braços, pernas, tronco ou identificar peças soltas automaticamente.
              </p>

              {/* CONFIGURAÇÃO DE ARTICULAÇÕES */}
              <div className="bg-[#0b0b0b] border border-zinc-900 rounded p-3 mb-4 space-y-3">
                <div>
                  <span className="text-[8px] font-mono text-[#00E5FF] uppercase tracking-widest block font-extrabold">Filtro de Articulação Anatômica</span>
                  <span className="text-[9.5px] text-zinc-500 leading-relaxed block mt-0.5">Escolha quais partes deseja segmentar na análise automática:</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSegmentLegs(!segmentLegs)}
                    className={`py-1.5 px-1 rounded border text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                      segmentLegs
                        ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_8px_rgba(0,229,255,0.05)]"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                    }`}
                  >
                    <span>Pernas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentArms(!segmentArms)}
                    className={`py-1.5 px-1 rounded border text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                      segmentArms
                        ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_8px_rgba(0,229,255,0.05)]"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                    }`}
                  >
                    <span>Braços</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentTorso(!segmentTorso)}
                    className={`py-1.5 px-1 rounded border text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                      segmentTorso
                        ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_8px_rgba(0,229,255,0.05)]"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                    }`}
                  >
                    <span>Tronco/Cabeça</span>
                  </button>
                </div>

                <div className="border-t border-zinc-900/60 pt-2.5 space-y-2">
                  <div>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-extrabold">Tipo de Encaixe / Joint Style</span>
                    <span className="text-[9px] text-zinc-500 block">Especificação técnica para o encaixe pós-processado:</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJointType("default")}
                      className={`py-2 px-2 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        jointType === "default"
                          ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_8px_rgba(0,229,255,0.05)]"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                      }`}
                    >
                      <Settings className="w-3 h-3 text-[#00E5FF]/60" />
                      <span>Snap-Fit (Padrão)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setJointType("magnet")}
                      className={`py-2 px-2 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        jointType === "magnet"
                          ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_8px_rgba(0,229,255,0.05)]"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-[#00E5FF]" />
                      <span>Encaixe com Ímã</span>
                    </button>
                  </div>

                  <div className="bg-black/40 p-2 rounded border border-zinc-900 text-[8.5px] leading-relaxed text-zinc-400 font-sans">
                    {jointType === "magnet" ? (
                      <p className="text-[#00E5FF]">
                        ✨ <strong>Modo Ímã Ativo:</strong> Cria cavidades cilíndricas de 3.2mm de diâmetro por 1.6mm de profundidade para inserção de micro-ímãs de neodímio de 3x1.5mm pós-impressão.
                      </p>
                    ) : (
                      <p className="text-zinc-400">
                        📦 <strong>Modo Snap-Fit:</strong> Cria conectores macho-fêmea tolerantes cilíndricos (0.2mm de folga) para junção mecânica direta por pressão.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                {/* Complexidade Analysis Badge */}
                {stats.faces > 50000 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-amber-500 tracking-tight">Modelo Complexo Detectado</p>
                      <p className="text-[9px] text-zinc-400 leading-relaxed">
                        Este modelo possui alta densidade de faces ({stats.faces.toLocaleString()}). 
                        Recomendamos a <strong>Divisão Inteligente</strong> para facilitar a pintura de partes comuns como rodas, teto ou estrutura.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={autoSegmentSmart}
                  className="w-full flex flex-col items-start gap-1.5 p-3 bg-gradient-to-r from-zinc-900 to-[#111] border border-[#00E5FF]/30 hover:border-[#00E5FF] hover:bg-[#151515] transition-all rounded text-left group relative overflow-hidden"
                  title="Análise heurística para separar corpo, rodas e detalhes"
                >
                  <div className="absolute top-0 right-0 p-1">
                    <Sparkles className="w-3 h-3 text-[#00E5FF] opacity-30 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-[#00E5FF] group-hover:text-white transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />
                    Divisão Inteligente (Carros / Casas)
                  </div>
                  <span className="text-[9px] text-zinc-400 uppercase tracking-wider">
                    Sugerir separação por partes comuns baseada em volume e posição.
                  </span>
                </button>

                <button
                  onClick={autoSegmentAnatomy}
                  className="w-full flex flex-col items-start gap-1.5 p-3 bg-[#111] border border-zinc-800 hover:border-[#00E5FF] hover:bg-[#151515] transition-all rounded text-left group"
                  title="Detecta e separa pernas, tronco e braços com base em inteligência espacial"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-200 group-hover:text-white transition-colors">
                    <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Segmentação Anatômica (Braços/Pernas/Tronco)
                  </div>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                    Análise espacial de membros. Ideal para bonecos e miniaturas em pé.
                  </span>
                </button>

                <div className="relative group/shell">
                  <button
                    onClick={autoSegmentShells}
                    className="w-full flex flex-col items-start gap-1.5 p-3 bg-[#111] border border-zinc-800 hover:border-[#00E5FF] hover:bg-[#151515] transition-all rounded text-left group"
                    title="Detecta ilhas 3D e cascas isoladas que não se encostam"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-200 group-hover:text-white transition-colors">
                      <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
                      Detectar Peças Desconectadas (Shells)
                    </div>
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                      Identifica partes e objetos físicos independentes carregados juntos.
                    </span>
                  </button>
                  
                  {stats.faces > 150000 && (
                    <div className="mt-1 flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
                      <Info className="w-3 h-3 text-amber-500" />
                      <span className="text-[8px] text-amber-500 uppercase font-black tracking-tighter">
                        Alta densidade detectada: Pode falhar em malhas unificadas.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 3D WATERMARK CONTROLS */}
          {modelGeometry && (
            <section className="border-t border-zinc-900 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-[#00E5FF]" />
                  06. Marca d'água 3D / 3D Watermark
                </h3>
                
                <button
                  onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border rounded transition-all cursor-pointer ${
                    watermarkEnabled
                      ? "bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF]"
                      : "bg-[#151515] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {watermarkEnabled ? "Ativado" : "Desativado"}
                </button>
              </div>

              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 leading-relaxed">
                Adicione uma assinatura, logo ou identificação 3D na base ou em qualquer superfície do seu modelo.
              </p>

              {watermarkEnabled && (
                <div className="bg-[#111] border border-zinc-900 rounded p-4 space-y-4 font-sans">
                  {/* WATERMARK TEXT INPUT */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Texto da Marca d'água / Text</label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value.toUpperCase().slice(0, 32))}
                      placeholder="Ex: VERTICE, COPYRIGHT..."
                      className="w-full bg-[#151515] border border-zinc-850 focus:border-[#00E5FF] text-xs text-white rounded px-3 py-2 outline-none transition-all"
                    />
                  </div>

                  {/* PLACEMENT SELECTOR */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Superfície / Placement</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["base", "top", "front", "back", "left", "right"] as const).map((place) => (
                        <button
                          key={place}
                          onClick={() => setWatermarkPlacement(place)}
                          className={`py-1.5 px-1 text-[8px] font-bold uppercase border rounded transition-all cursor-pointer truncate ${
                            watermarkPlacement === place
                              ? "bg-[#00E5FF] text-black border-[#00E5FF]"
                              : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-white"
                          }`}
                        >
                          {place === "base" ? "Base" : place === "top" ? "Topo" : place === "front" ? "Frente" : place === "back" ? "Trás" : place === "left" ? "Esq" : "Dir"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* STYLE SELECTOR */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Efeito Visual / Style</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["raised", "recessed", "overlay"] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => setWatermarkStyle(style)}
                          className={`py-1.5 px-1 text-[8px] font-bold uppercase border rounded transition-all cursor-pointer truncate ${
                            watermarkStyle === style
                              ? "bg-[#00E5FF] text-black border-[#00E5FF]"
                              : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-white"
                          }`}
                        >
                          {style === "raised" ? "Em Relevo" : style === "recessed" ? "Baixo Relevo" : "Sobreposição"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SIZE SLIDER */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400">
                      <span>Tamanho do Texto / Font Size</span>
                      <span className="text-[#00E5FF] font-mono">{(watermarkSize).toFixed(2)}x</span>
                    </div>
                    <Slider
                      value={[watermarkSize]}
                      onValueChange={(val) => setWatermarkSize(val[0])}
                      min={0.05}
                      max={1.5}
                      step={0.01}
                    />
                  </div>

                  {/* POSITIONAL OFFSETS */}
                  <div className="border-t border-zinc-900/60 pt-3 space-y-3">
                    <span className="text-[9px] uppercase font-black tracking-wider text-zinc-500 block">Ajuste Fino de Posição / Position Offsets</span>
                    
                    {/* OFFSET X */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                        <span>Deslocamento X / Shift X</span>
                        <span className="text-zinc-500 font-mono">{(watermarkOffsetX).toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[watermarkOffsetX]}
                        onValueChange={(val) => setWatermarkOffsetX(val[0])}
                        min={-Math.max(2, modelDimensions.x)}
                        max={Math.max(2, modelDimensions.x)}
                        step={0.02}
                      />
                    </div>

                    {/* OFFSET Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                        <span>Deslocamento Y / Shift Y</span>
                        <span className="text-zinc-500 font-mono">{(watermarkOffsetY).toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[watermarkOffsetY]}
                        onValueChange={(val) => setWatermarkOffsetY(val[0])}
                        min={-Math.max(2, modelDimensions.y)}
                        max={Math.max(2, modelDimensions.y)}
                        step={0.02}
                      />
                    </div>

                    {/* OFFSET Z */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                        <span>Deslocamento Z / Shift Z</span>
                        <span className="text-zinc-500 font-mono">{(watermarkOffsetZ).toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[watermarkOffsetZ]}
                        onValueChange={(val) => setWatermarkOffsetZ(val[0])}
                        min={-Math.max(2, modelDimensions.z)}
                        max={Math.max(2, modelDimensions.z)}
                        step={0.02}
                      />
                    </div>
                  </div>

                  {/* ROTATIONAL OFFSETS */}
                  <div className="border-t border-zinc-900/60 pt-3 space-y-3">
                    <span className="text-[9px] uppercase font-black tracking-wider text-zinc-500 block">Rotação Personalizada / Custom Rotation</span>
                    
                    {/* ROTATION X */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                        <span>Rotação X (Inclinar)</span>
                        <span className="text-zinc-500 font-mono">{watermarkRotationX}°</span>
                      </div>
                      <Slider
                        value={[watermarkRotationX]}
                        onValueChange={(val) => setWatermarkRotationX(val[0])}
                        min={-180}
                        max={180}
                        step={1}
                      />
                    </div>

                    {/* ROTATION Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                        <span>Rotação Y (Girar)</span>
                        <span className="text-zinc-500 font-mono">{watermarkRotationY}°</span>
                      </div>
                      <Slider
                        value={[watermarkRotationY]}
                        onValueChange={(val) => setWatermarkRotationY(val[0])}
                        min={-180}
                        max={180}
                        step={1}
                      />
                    </div>

                    {/* ROTATION Z */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                        <span>Rotação Z (Incline Lat)</span>
                        <span className="text-zinc-500 font-mono">{watermarkRotationZ}°</span>
                      </div>
                      <Slider
                        value={[watermarkRotationZ]}
                        onValueChange={(val) => setWatermarkRotationZ(val[0])}
                        min={-180}
                        max={180}
                        step={1}
                      />
                    </div>
                  </div>

                  {/* COLOR SELECTOR */}
                  <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Cor da Pré-visualização / Color</label>
                    <div className="flex gap-2">
                      {["#00E5FF", "#FF1744", "#00E676", "#FFEB3B", "#FFFFFF", "#888888"].map((c) => (
                        <button
                          key={c}
                          onClick={() => setWatermarkColor(c)}
                          className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                            watermarkColor === c ? "border-white scale-110 shadow" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* EXPORT PARTS FOR PRINT */}
          {modelGeometry && (
            <section className="flex-1 flex flex-col justify-end border-t border-zinc-900 pt-6">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">07. Generate Separated Prints / Exportar</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 leading-relaxed">
                Export each colored region as an independent watertight STL mesh file, perfect for multi-extruder printing or separate part printing.
              </p>

              {/* SEPARATION PREVIEW ACTION BOX */}
              <div className="bg-[#111] border border-zinc-900 rounded p-4 mb-5 space-y-4 font-sans">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-300 block">Explodir Peças / Exploded View</span>
                    <span className="text-[9px] text-zinc-500">Visualize as partes separadas no espaço 3D</span>
                  </div>
                  <button
                    onClick={() => {
                      const next = !previewSeparated;
                      setPreviewSeparated(next);
                      if (next) {
                        setPaintMode(false);
                      }
                    }}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded border transition-all ${
                      previewSeparated
                        ? "bg-emerald-400/20 border-emerald-400 text-emerald-400"
                        : "bg-[#151515] border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {previewSeparated ? "ATIVADO" : "DESATIVADO"}
                  </button>
                </div>

                {previewSeparated && (
                  <div className="space-y-2 border-t border-zinc-900/60 pt-3">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400">
                      <span>Distância / Separation</span>
                      <span className="text-emerald-400 font-mono font-bold">{separationDistance.toFixed(2)}x</span>
                    </div>
                    <Slider
                      value={[separationDistance]}
                      onValueChange={(val) => setSeparationDistance(val[0])}
                      min={0.0}
                      max={4.0}
                      step={0.05}
                    />
                    <span className="text-[8px] text-zinc-500 block leading-relaxed">
                      Arraste o slider para afastar ou aproximar as partes identificadas e verificar os encaixes.
                    </span>
                  </div>
                )}
              </div>

              {/* BATCH EXPORT BUTTON */}
              <button
                onClick={() => {
                  groups.forEach((g) => {
                    const countOfGroup = vertexGroups.filter((vg) => vg === g.id).length;
                    if (countOfGroup > 0 || g.id === 0) {
                      exportSeparatedPart(g.id);
                    }
                  });
                }}
                disabled={!modelGeometry || isExporting !== null}
                className="w-full bg-[#00E5FF] hover:bg-[#00B8D4] text-black font-black uppercase text-[11px] py-4 px-4 tracking-widest flex items-center justify-center gap-2 transition-all mb-4 shadow-[0_0_15px_rgba(0,229,255,0.2)] disabled:opacity-40 disabled:hover:bg-[#00E5FF]"
              >
                <Download className="w-4 h-4 text-black" />
                Exportar Todas as Peças (.stl)
              </button>

              <div className="space-y-2">
                {groups.map((group) => {
                  const countOfGroup = vertexGroups.filter((g) => g === group.id).length;
                  const isGroupPainted = countOfGroup > 0 || group.id === 0;

                  return (
                    <button
                      key={group.id}
                      disabled={!isGroupPainted || !modelGeometry || isExporting !== null}
                      onClick={() => exportSeparatedPart(group.id)}
                      className="w-full flex items-center justify-between p-3.5 bg-[#111] border border-zinc-800 hover:border-[#00E5FF] hover:bg-[#151515] transition-all group disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:bg-[#111]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-xs font-bold uppercase text-zinc-300 group-hover:text-white transition-colors">
                          {group.id === 0 ? "Exportar Restante (Cinza)" : `Exportar ${group.name}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {countOfGroup > 0 ? `${((countOfGroup / vertexGroups.length) * 100).toFixed(0)}%` : "0%"}
                        </span>
                        {isExporting === group.id ? (
                          <RefreshCw className="w-4 h-4 text-[#00E5FF] animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 text-zinc-500 group-hover:text-[#00E5FF] transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* FOOTER BAR */}
      <footer className="h-12 border-t border-[#222] px-8 flex items-center justify-between bg-[#0A0A0A] shrink-0">
        <div className="flex gap-6 items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Status: <span className="text-[#00FF41]">Watertight Export Ready</span></span>
          <span>GPU Mesh Painting: ACTIVE</span>
          <span>Subdivisions: {modelGeometry ? "Multi-layer" : "None"}</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
          © VÉRTICE STUDIO
        </div>
      </footer>

      {/* GLOBAL PROCESSING OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6 p-10 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl max-w-sm w-full text-center">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-[#00E5FF] animate-spin" />
              <div className="absolute inset-0 blur-xl bg-[#00E5FF]/20 animate-pulse"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Processando Geometria</h3>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed">
                {processingMessage || "Aguarde enquanto analisamos os dados 3D do modelo..."}
              </p>
            </div>
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#00B8D4] animate-progress-indefinite"></div>
            </div>
            <p className="text-[8px] text-zinc-600 uppercase font-bold">Não feche a página durante esta operação.</p>
          </div>
        </div>
      )}
    </div>
  );
}
