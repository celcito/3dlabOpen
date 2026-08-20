import { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Bounds, OrbitControls, Grid, Text, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { Upload, Download, Paintbrush, PaintBucket, Move, RotateCcw, Eye, EyeOff, Trash2, Sliders, Play, Plus, Info, Check, RefreshCw, Sparkles, Layers, Undo, Eraser, Ruler, Clock, Printer, Settings, FileJson, Save, BoxSelect, Loader2, Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { capBoundaryHoles, addPeg, addSocket, addReinforcedSocket } from "../../lib/csg";
import { useViewerCamera } from "../hooks/viewer3d/useViewerCamera";
import { useWatermark } from "../hooks/viewer3d/useWatermark";
import { usePrintEstimator } from "../hooks/viewer3d/usePrintEstimator";
import { useViewerModelImport } from "../hooks/viewer3d/useViewerModelImport";
import { useViewerTopology } from "../hooks/viewer3d/useViewerTopology";
import { useViewerSegmentation } from "../hooks/viewer3d/useViewerSegmentation";
import { useViewerPainting } from "../hooks/viewer3d/useViewerPainting";
import { useViewerJoints } from "../hooks/viewer3d/useViewerJoints";
import { useViewerSeparatedPreview } from "../hooks/viewer3d/useViewerSeparatedPreview";
import { useViewerExports } from "../hooks/viewer3d/useViewerExports";

// Vibrant colors for print separation groups
const GROUPS = [
  { id: 0, name: "Base Principal (Cinza / Gray)", color: "#333333", border: "border-[#E8E9E3]" },
  { id: 1, name: "Parte 1 (Ciano / Cyan)", color: "#632CE5", border: "border-[#632CE5]" },
  { id: 2, name: "Parte 2 (Vermelho / Red)", color: "#FF1744", border: "border-[#FF1744]" },
  { id: 3, name: "Parte 3 (Verde / Green)", color: "#00FF41", border: "border-[#00FF41]" },
  { id: 4, name: "Parte 4 (Roxo / Purple)", color: "#D500F9", border: "border-[#D500F9]" },
];

const PRESET_COLORS = [
  "#632CE5",
  "#FF1744",
  "#00FF41",
  "#D500F9",
  "#FF9100",
  "#FF4081",
  "#FFEA00",
  "#2979FF",
  "#FFFFFF",
];

function HelpTooltip({ text, position = "left" }: { text: string; position?: "top" | "bottom" | "left" | "right" }) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };
  return (
    <div className="relative group inline-flex items-center ml-1.5 select-none shrink-0 align-middle">
      <span className="text-zinc-500 hover:text-[#632CE5] transition-colors cursor-help focus:outline-none p-0.5">
        <Info className="w-3.5 h-3.5" />
      </span>
      <div className={`absolute hidden group-hover:block z-50 w-64 p-3 text-[10px] leading-relaxed font-sans normal-case font-medium text-zinc-300 bg-[#E8E9E3] border border-[#E8E9E3] rounded shadow-[0_6px_20px_rgba(0,0,0,0.95)] pointer-events-none transition-all duration-150 ${positionClasses[position]}`}>
        <p className="tracking-wide uppercase text-[#632CE5] font-black text-[9px] mb-1">Dica de Ajuda / Help Tip</p>
        <p>{text}</p>
      </div>
    </div>
  );
}

interface PaintableMeshProps {
  geometry: THREE.BufferGeometry;
  brushRadius: number;
  activeGroupId: number;
  paintMode: boolean;
  paintTool: "brush" | "bucket" | "eraser";
  onGeometryUpdated: () => void;
  onPaintChanged?: () => void;
  vertexGroups: Uint8Array;
  setVertexGroups: (groups: Uint8Array) => void;
  adjacencyList: Set<number>[] | null;
  onStartAction?: () => void;
  isolateGroupId: number | null;
  groups: { id: number; name: string; color: string; border?: string }[];
  placementMode?: boolean;
  onPlaceJoint?: (point: THREE.Vector3, faceGroup: number) => void;
}

function PaintableMesh({
  geometry, brushRadius, activeGroupId, paintMode, paintTool,
  onGeometryUpdated, vertexGroups, setVertexGroups, adjacencyList,
  onStartAction, onPaintChanged, isolateGroupId, groups, placementMode = false, onPlaceJoint,
}: PaintableMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getGroupColor = (gId: number) => groups.find((g) => g.id === gId)?.color || "#333333";

  useEffect(() => {
    if (!geometry) return;
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const isIsolated = isolateGroupId !== null;
    const ghostColor = new THREE.Color("#1c1c1c");
    for (let i = 0; i < count; i++) {
      const groupId = vertexGroups[i] || 0;
      const col = isIsolated
        ? (groupId === isolateGroupId ? new THREE.Color(getGroupColor(groupId)) : ghostColor)
        : new THREE.Color(getGroupColor(groupId));
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
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
      let minDistance = Infinity, clickedIdx = -1;
      for (let i = 0; i < count; i++) {
        const dx = positionAttr.getX(i) - localPoint.x;
        const dy = positionAttr.getY(i) - localPoint.y;
        const dz = positionAttr.getZ(i) - localPoint.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < minDistance) { minDistance = d; clickedIdx = i; }
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
          if (fillCount > 250000) break;
          const neighbors = adjacencyList ? adjacencyList[u] : null;
          if (neighbors) {
            for (const v of neighbors) {
              if (visited[v] === 0 && vertexGroups[v] === startGroupId) {
                visited[v] = 1; queue.push(v);
              }
            }
          }
        }
        if (colorAttr) colorAttr.needsUpdate = true;
        onPaintChanged?.();
        setVertexGroups(newGroups);
        onGeometryUpdated();
      }
    } else {
      let updated = false;
      const radiusSq = brushRadius * brushRadius;
      for (let i = 0; i < count; i++) {
        const dx = positionAttr.getX(i) - localPoint.x;
        const dy = positionAttr.getY(i) - localPoint.y;
        const dz = positionAttr.getZ(i) - localPoint.z;
        if (dx * dx + dy * dy + dz * dz <= radiusSq) {
          newGroups[i] = targetGroupId;
          if (colorAttr) {
            const col = (!isIsolated || targetGroupId === isolateGroupId) ? targetColor : ghostColor;
            colorAttr.setXYZ(i, col.r, col.g, col.b);
          }
          updated = true;
        }
      }
      if (updated) {
        if (colorAttr) colorAttr.needsUpdate = true;
        onPaintChanged?.();
        setVertexGroups(newGroups);
        onGeometryUpdated();
      }
    }
  };

  return (
    <mesh ref={meshRef} name="paintable-model-mesh" geometry={geometry} castShadow receiveShadow
      onPointerDown={(e) => {
        if (placementMode && e.button === 0) {
          e.stopPropagation();
          const face = (e as any).face;
          let faceGroup = activeGroupId;
          if (face) {
            const ga = vertexGroups[face.a] ?? 0;
            const gb = vertexGroups[face.b] ?? 0;
            const gc = vertexGroups[face.c] ?? 0;
            faceGroup = ga === gb ? ga : gb === gc ? gb : gc === ga ? gc : ga;
          }
          onPlaceJoint?.(e.point.clone(), faceGroup);
          return;
        }
        if (paintMode && e.button === 0) {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          onStartAction?.();
          setIsDrawing(true);
          paint(e);
        }
      }}
      onPointerMove={(e) => {
        if (paintMode && isDrawing && paintTool === "brush" && e.buttons === 1) {
          e.stopPropagation(); paint(e);
        }
      }}
      onPointerUp={(e) => {
        if (paintMode) {
          e.stopPropagation();
          try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
          setIsDrawing(false);
        }
      }}>
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BrushIndicator({ brushRadius, paintMode, paintTool }: { brushRadius: number; paintMode: boolean; paintTool: "brush" | "bucket" | "eraser" }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { pointer, camera, raycaster, scene } = useThree();
  useFrame(() => {
    if (!paintMode || !meshRef.current) return;
    const modelMesh = scene.getObjectByName("paintable-model-mesh");
    if (!modelMesh) { meshRef.current.visible = false; return; }
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(modelMesh);
    if (intersects[0]) { meshRef.current.position.copy(intersects[0].point); meshRef.current.visible = true; }
    else meshRef.current.visible = false;
  });
  if (!paintMode) return null;
  const indicatorRadius = paintTool === "bucket" ? 0.03 : brushRadius;
  const color = paintTool === "eraser" ? "#FF1744" : "#632CE5";
  return (
    <mesh ref={meshRef} name="brush-indicator" visible={false} scale={[indicatorRadius, indicatorRadius, indicatorRadius]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={paintTool === "bucket" ? 0.6 : 0.2} wireframe={paintTool !== "bucket"} />
    </mesh>
  );
}

function PlacementIndicator({ placementMode }: { placementMode: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { pointer, camera, raycaster, scene } = useThree();
  const quatRef = useRef(new THREE.Quaternion());
  useFrame(() => {
    if (!placementMode || !meshRef.current) return;
    const modelMesh = scene.getObjectByName("paintable-model-mesh");
    if (!modelMesh) { meshRef.current.visible = false; return; }
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(modelMesh);
    if (intersects[0]) {
      meshRef.current.position.copy(intersects[0].point);
      const n = intersects[0].face?.normal;
      if (n && n.lengthSq() > 0.0001) quatRef.current.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
      meshRef.current.quaternion.copy(quatRef.current);
      meshRef.current.visible = true;
    } else {
      meshRef.current.visible = false;
    }
  });
  if (!placementMode) return null;
  return (
    <mesh ref={meshRef} visible={false}>
      <cylinderGeometry args={[0.8, 0.8, 1.0, 6]} />
      <meshBasicMaterial color="#FFD700" transparent opacity={0.55} />
    </mesh>
  );
}

// CORREÇÃO: classifyTriangleGroup agora aceita targetGroup
function classifyTriangleGroup(g0: number, g1: number, g2: number, targetGroup: number): boolean {
  if (targetGroup === 0) return g0 === 0 && g1 === 0 && g2 === 0;
  // A painted vertex must not make the same triangle belong to two exported
  // pieces. Give a mixed triangle to the majority group instead.
  const targetCount = [g0, g1, g2].filter((group) => group === targetGroup).length;
  return targetCount >= 2;
}

function snapPointToGeometryBoundary(geometry: THREE.BufferGeometry, point: THREE.Vector3): THREE.Vector3 {
  const indexed = BufferGeometryUtils.mergeVertices(geometry.clone(), 1e-5);
  const position = indexed.attributes.position;
  const index = indexed.index;
  if (!index) return point.clone();
  const edgeCounts = new Map<string, { a: number; b: number; count: number }>();
  const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const addEdge = (a: number, b: number) => {
    const key = edgeKey(a, b);
    const edge = edgeCounts.get(key);
    if (edge) edge.count++;
    else edgeCounts.set(key, { a, b, count: 1 });
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    addEdge(a, b); addEdge(b, c); addEdge(c, a);
  }
  let closest = point.clone();
  let distance = Infinity;
  for (const edge of edgeCounts.values()) {
    if (edge.count !== 1) continue;
    const midpoint = new THREE.Vector3(
      (position.getX(edge.a) + position.getX(edge.b)) / 2,
      (position.getY(edge.a) + position.getY(edge.b)) / 2,
      (position.getZ(edge.a) + position.getZ(edge.b)) / 2,
    );
    const candidateDistance = midpoint.distanceToSquared(point);
    if (candidateDistance < distance) {
      distance = candidateDistance;
      closest = midpoint;
    }
  }
  return closest;
}

// NOVO: Encaixe posicionado manualmente pelo usuário na fronteira entre dois grupos.
// normalA aponta do grupoA (host) para dentro do grupoB (vizinho).
interface ManualJoint {
  id: string;
  groupA: number;
  groupB: number;
  position: THREE.Vector3;
  normalA: THREE.Vector3;
  scale?: number;
}

interface JointSpec {
  position: THREE.Vector3;
  normalFrom: THREE.Vector3;
  manualId?: string;
  scale?: number;
}

export default function Viewer3D() {
  const [groups, setGroups] = useState([
    { id: 0, name: "Base Principal (Cinza)", color: "#333333", border: "border-[#E8E9E3]" },
    { id: 1, name: "Parte 1 (Ciano)", color: "#632CE5", border: "border-[#632CE5]" },
    { id: 2, name: "Parte 2 (Vermelho)", color: "#FF1744", border: "border-[#FF1744]" },
    { id: 3, name: "Parte 3 (Verde)", color: "#00FF41", border: "border-[#00FF41]" },
    { id: 4, name: "Parte 4 (Roxo)", color: "#D500F9", border: "border-[#D500F9]" },
  ]);

  // NOVO: Sistema de marcação manual Macho/Fêmea por grupo
  const [groupJointTypes, setGroupJointTypes] = useState<Record<number, 'male' | 'female' | 'auto'>>({});

  const setGroupJointType = (groupId: number, type: 'male' | 'female' | 'auto') => {
    setGroupJointTypes(prev => ({ ...prev, [groupId]: type }));
  };

  const getEffectiveJointType = (groupId: number, neighborId: number): 'male' | 'female' => {
    const groupType = groupJointTypes[groupId];
    const neighborType = groupJointTypes[neighborId];
    if (groupType === 'male' || groupType === 'female') return groupType;
    if (neighborType === 'male') return 'female';
    if (neighborType === 'female') return 'male';
    return groupId < neighborId ? 'female' : 'male';
  };

  const updateGroupColor = (id: number, color: string) => setGroups(prev => prev.map(g => g.id === id ? { ...g, color } : g));
  const updateGroupName = (id: number, name: string) => setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));

  const addCustomGroup = () => {
    const nextId = groups.length;
    const defaultColors = ["#FF9100", "#FF4081", "#FFEA00", "#2979FF", "#00E676", "#3D5AFE", "#FF3D00"];
    const color = defaultColors[(nextId - 5) % defaultColors.length] || "#FFFFFF";
    setGroups(prev => [...prev, { id: nextId, name: `Parte ${nextId}`, color, border: `border-[${color}]` }]);
    setActiveGroupId(nextId);
    setPaintMode(true);
  };

  const getGroupColor = (gId: number, currentGroups = groups) => currentGroups.find(g => g.id === gId)?.color || "#333333";
  const getGroupName = (gId: number, currentGroups = groups) => currentGroups.find(g => g.id === gId)?.name || `Parte ${gId}`;

  const [vertexGroups, setVertexGroups] = useState<Uint8Array>(new Uint8Array(0));
  const [history, setHistory] = useState<Uint8Array[]>([]);
  const [activeGroupId, setActiveGroupId] = useState(1);
  const [paintMode, setPaintMode] = useState(true);
  const [paintTool, setPaintTool] = useState<"brush" | "bucket" | "eraser">("brush");
  const [brushRadius, setBrushRadius] = useState(0.2);
  const [isExporting, setIsExporting] = useState<number | null>(null);
  const [loadingCap, setLoadingCap] = useState(false);
  const [capSelection, setCapSelection] = useState<"base" | "top">("top");
  const [isCapped, setIsCapped] = useState(false);
  const [isDownloadingCapped, setIsDownloadingCapped] = useState(false);
  const [isolateGroupId, setIsolateGroupId] = useState<number | null>(null);
  const [autoIsolateActive, setAutoIsolateActive] = useState(false);
  const [previewSeparated, setPreviewSeparated] = useState(false);
  const [finalizedPreview, setFinalizedPreview] = useState(false);
  const [previewValidation, setPreviewValidation] = useState<"idle" | "valid" | "warning">("idle");
  const [separationDistance, setSeparationDistance] = useState<number>(1.0);
  const [jointType, setJointType] = useState<"default" | "magnet">("default");
  const [jointSizes, setJointSizes] = useState({ pegDiameter: 3.0, pegLength: 4.0, fitTolerance: 0.2, magnetDiameter: 3.2, magnetDepth: 1.6, reinforcementDiameter: 7.0, reinforcementHeight: 2.5, reinforcementWall: 1.2 });
  const [manualJoints, setManualJoints] = useState<ManualJoint[]>([]);
  const [selectedManualJointId, setSelectedManualJointId] = useState<string | null>(null);
   const [placementMode, setPlacementMode] = useState(false);
   const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [importUnit, setImportUnit] = useState<"mm" | "inch">("mm");
  const [importScale, setImportScale] = useState(1.0);
  const [showConversionSettings, setShowConversionSettings] = useState(false);
  const [viewportEpoch, setViewportEpoch] = useState(0);
   const modelImport = useViewerModelImport({
     importUnit,
     importScale,
     onResetDomain: (vertexCount) => { setVertexGroups(new Uint8Array(vertexCount)); setHistory([]); setGroupJointTypes({}); setManualJoints([]); setPlacementMode(false); },
   });
   const { modelGeometry, setModelGeometry, fileName, modelDimensions, stats, setStats, isProcessing, setIsProcessing, processingMessage, setProcessingMessage, loadDemoModel, handleFileUpload } = modelImport;
   const estimator = usePrintEstimator(fileName, modelDimensions, Boolean(modelGeometry));
   const {
     MATERIALS, estimatorType, setEstimatorType, selectedMaterialId, setSelectedMaterialId, materialDensity, setMaterialDensity,
     printScale, setPrintScale, miniatureScaleMode, setMiniatureScaleMode, isHollow, setIsHollow, layerHeight, setLayerHeight,
     exposureTime, setExposureTime, resinCostPerKg, setResinCostPerKg, fdmInfill, setFdmInfill, fdmLayerHeight, setFdmLayerHeight,
     fdmPrintSpeed, setFdmPrintSpeed, fdmFilamentCostPerKg, setFdmFilamentCostPerKg, fdmWallCount, setFdmWallCount,
     isEstimating, estimateProgress, originalX, originalY, originalZ, scaledX, scaledY, scaledZ, handleDownloadCSV, applyMiniatureScale, getSlicingStatus,
   } = estimator;

   const {
     watermarkEnabled, watermarkText, watermarkPlacement, watermarkSize, watermarkDepth, watermarkColor,
     watermarkOffsetX, watermarkOffsetY, watermarkOffsetZ, watermarkRotationX, watermarkRotationY,
     watermarkRotationZ, watermarkStyle, watermarkParams, setWatermarkEnabled, setWatermarkText,
     setWatermarkPlacement, setWatermarkSize, setWatermarkColor, setWatermarkOffsetX, setWatermarkOffsetY,
     setWatermarkOffsetZ, setWatermarkRotationX, setWatermarkRotationY, setWatermarkRotationZ, setWatermarkStyle,
   } = useWatermark(modelDimensions);

   const effectiveIsolateGroupId = autoIsolateActive ? activeGroupId : isolateGroupId;
   const fileInputRef = useRef<HTMLInputElement>(null);
   const { controlsRef, zoomIn, zoomOut, resetCamera } = useViewerCamera();

    const adjacencyList = useViewerTopology(modelGeometry);
    const { pushStateToHistory, handleUndo, resetPainting, fillRemainingWithActiveGroup, fillAllWithActiveGroup, expandConnectedPaint } = useViewerPainting({ geometry: modelGeometry, vertexGroups, setVertexGroups, history, setHistory, activeGroupId, effectiveIsolateGroupId, groupColor: (id) => getGroupColor(id), adjacencyList });
    const { segmentLegs, setSegmentLegs, segmentArms, setSegmentArms, segmentTorso, setSegmentTorso, autoSegmentAnatomy, autoSegmentShells, autoSegmentSmart } = useViewerSegmentation({ geometry: modelGeometry, adjacencyList, groups, setGroups, setVertexGroups, pushHistory: () => pushStateToHistory(), onProcessing: (message) => { setIsProcessing(Boolean(message)); if (message) setProcessingMessage(message); } });
    const extractedJoints = useViewerJoints({ modelGeometry, vertexGroups, adjacencyList, groups, jointType, jointSizes });
    const extractedPreview = useViewerSeparatedPreview({ previewSeparated, modelGeometry, vertexGroups, groups, jointType, jointSizes, findNeighborGroups: extractedJoints.findNeighborGroups, getPairJointSpecs: extractedJoints.getPairJointSpecs, getEffectiveJointType: extractedJoints.getEffectiveJointType, getGroupName: extractedJoints.getGroupName, setPlacementMode: extractedJoints.setPlacementMode });
    const extractedExports = useViewerExports({ modelGeometry, setModelGeometry, vertexGroups, setVertexGroups, groups, fileName, jointType, jointSizes, capSelection, setIsProcessing, setProcessingMessage, setStats, setHistory, setGroupJointTypes: extractedJoints.setGroupJointTypes, setManualJoints: extractedJoints.setManualJoints, setPlacementMode: extractedJoints.setPlacementMode, getGroupName: extractedJoints.getGroupName, findNeighborGroups: extractedJoints.findNeighborGroups, getPairJointSpecs: extractedJoints.getPairJointSpecs, getEffectiveJointType: extractedJoints.getEffectiveJointType, jointConfigurationWarning: null });
    void extractedJoints; void extractedPreview; void extractedExports;

  // ATUALIZADO: groupJointRoles agora respeita marcação manual e usa adjacencyList
  const groupJointRoles = useMemo(() => {
    const roles = new Map<number, string>();
    if (!modelGeometry || !adjacencyList) return roles;
    const count = modelGeometry.attributes.position.count;
    const neighborsByGroup = new Map<number, Set<number>>();
    for (let i = 0; i < count; i++) {
      const g = vertexGroups[i] || 0;
      const adj = adjacencyList[i];
      if (adj) {
        for (const neighborIdx of adj) {
          const ng = vertexGroups[neighborIdx] || 0;
          if (ng !== g) {
            if (!neighborsByGroup.has(g)) neighborsByGroup.set(g, new Set());
            neighborsByGroup.get(g)!.add(ng);
          }
        }
      }
    }
    neighborsByGroup.forEach((neighborSet, groupId) => {
      const label = Array.from(neighborSet).map(n => {
        const myType = getEffectiveJointType(groupId, n);
        const tag = jointType === "magnet" ? "Ímã" : myType === 'female' ? "Fêmea" : "Macho";
        return `${tag} c/ ${getGroupName(n)}`;
      }).join(" • ");
      roles.set(groupId, label);
    });
    return roles;
  }, [modelGeometry, vertexGroups, groups, jointType, groupJointTypes, adjacencyList]);

  // CORREÇÃO: findNeighborGroups usa adjacencyList
  const findNeighborGroups = (groupId: number): number[] => {
    if (!modelGeometry || !adjacencyList) return [];
    const neighbors = new Set<number>();
    const count = modelGeometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
      if ((vertexGroups[i] || 0) === groupId) {
        for (const neighborIdx of adjacencyList[i] || []) {
          const ng = vertexGroups[neighborIdx] || 0;
          if (ng !== groupId) neighbors.add(ng);
        }
      }
    }
    if (neighbors.size === 0) {
      // Separate shells may have no shared topology. Use proximity as a
      // fallback so touching pieces still expose a connector candidate.
      const modelSize = modelGeometry.boundingBox?.getSize(new THREE.Vector3()).length() || 1;
      const maxDistanceSq = Math.pow(modelSize * 0.15, 2);
      const source: THREE.Vector3[] = [];
      const step = Math.max(1, Math.floor(count / 400));
      for (let i = 0; i < count; i += step) {
        if ((vertexGroups[i] || 0) === groupId) source.push(new THREE.Vector3(modelGeometry.attributes.position.getX(i), modelGeometry.attributes.position.getY(i), modelGeometry.attributes.position.getZ(i)));
      }
      groups.forEach((candidate) => {
        if (candidate.id === groupId) return;
        let nearest = Infinity;
        for (let i = 0; i < count; i += step) {
          if ((vertexGroups[i] || 0) !== candidate.id) continue;
          const point = new THREE.Vector3(modelGeometry.attributes.position.getX(i), modelGeometry.attributes.position.getY(i), modelGeometry.attributes.position.getZ(i));
          for (const sourcePoint of source) nearest = Math.min(nearest, sourcePoint.distanceToSquared(point));
        }
        if (nearest <= maxDistanceSq) neighbors.add(candidate.id);
      });
    }
    for (const joint of manualJoints) {
      if (joint.groupA === groupId) neighbors.add(joint.groupB);
      if (joint.groupB === groupId) neighbors.add(joint.groupA);
    }
    const result = Array.from(neighbors);
    console.log(`[encaixe] grupo ${groupId}: vizinhos =`, result);
    return result;
  };

  // NOVO: centroide de um grupo (null se o grupo não tiver vértices)
  const computeGroupCentroid = (groupId: number): THREE.Vector3 | null => {
    if (!modelGeometry) return null;
    const positionAttr = modelGeometry.attributes.position;
    const count = positionAttr.count;
    const centroid = new THREE.Vector3();
    let countGroup = 0;
    for (let i = 0; i < count; i++) {
      if ((vertexGroups[i] || 0) === groupId) {
        centroid.x += positionAttr.getX(i); centroid.y += positionAttr.getY(i); centroid.z += positionAttr.getZ(i);
        countGroup++;
      }
    }
    if (countGroup === 0) return null;
    centroid.divideScalar(countGroup);
    return centroid;
  };

  // Encontra uma aresta real da fronteira pintada. O ponto médio dos centroides
  // pode ficar dentro da peça ou no vazio entre as peças, impedindo o CSG de
  // fundir o pino ou abrir o furo.
  const computeGroupPairAnchor = (groupId: number, neighborId: number): { position: THREE.Vector3; normalA: THREE.Vector3 } | null => {
    const centroidA = computeGroupCentroid(groupId);
    const centroidB = computeGroupCentroid(neighborId);
    if (!centroidA || !centroidB) { console.warn(`[encaixe] par ${groupId}x${neighborId}: grupo sem vértices`); return null; }
    let normalA = new THREE.Vector3().subVectors(centroidB, centroidA);
    if (normalA.lengthSq() < 1e-12) return null;
    normalA.normalize();

    const positionAttr = modelGeometry!.attributes.position;
    const target = centroidA.clone().add(centroidB).multiplyScalar(0.5);
    let bestPosition: THREE.Vector3 | null = null;
    let bestDistance = Infinity;
    const localDirection = new THREE.Vector3();
    let localDirectionCount = 0;
    for (let i = 0; i < positionAttr.count; i++) {
      if ((vertexGroups[i] || 0) !== groupId) continue;
      for (const neighborIdx of adjacencyList![i] || []) {
        if ((vertexGroups[neighborIdx] || 0) !== neighborId) continue;
        const boundaryPosition = new THREE.Vector3(
          (positionAttr.getX(i) + positionAttr.getX(neighborIdx)) / 2,
          (positionAttr.getY(i) + positionAttr.getY(neighborIdx)) / 2,
          (positionAttr.getZ(i) + positionAttr.getZ(neighborIdx)) / 2,
        );
        const distance = boundaryPosition.distanceToSquared(target);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPosition = boundaryPosition;
        }
        localDirection.add(new THREE.Vector3(
          positionAttr.getX(neighborIdx) - positionAttr.getX(i),
          positionAttr.getY(neighborIdx) - positionAttr.getY(i),
          positionAttr.getZ(neighborIdx) - positionAttr.getZ(i),
        ));
        localDirectionCount++;
      }
    }
    if (localDirectionCount > 0 && localDirection.lengthSq() > 1e-12) {
      localDirection.normalize();
      if (localDirection.dot(normalA) < 0) localDirection.negate();
      normalA = localDirection;
    }
    if (!bestPosition) {
      // Imported meshes often contain separate shells that touch visually but
      // do not share indexed vertices. Find the closest geometric pair so a
      // connector can still be placed between those shells.
      let closestA: THREE.Vector3 | null = null;
      let closestB: THREE.Vector3 | null = null;
      let closestDistance = Infinity;
      const samplesA: THREE.Vector3[] = [];
      const samplesB: THREE.Vector3[] = [];
      const stepA = Math.max(1, Math.floor(positionAttr.count / 600));
      for (let i = 0; i < positionAttr.count; i += stepA) {
        if ((vertexGroups[i] || 0) === groupId) samplesA.push(new THREE.Vector3(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i)));
        if ((vertexGroups[i] || 0) === neighborId) samplesB.push(new THREE.Vector3(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i)));
      }
      for (const a of samplesA) {
        for (const b of samplesB) {
          const distance = a.distanceToSquared(b);
          if (distance < closestDistance) { closestDistance = distance; closestA = a; closestB = b; }
        }
      }
      if (closestA && closestB) {
        bestPosition = closestA.clone().add(closestB).multiplyScalar(0.5);
        const localNormal = new THREE.Vector3().subVectors(closestB, closestA);
        if (localNormal.lengthSq() > 1e-12) normalA = localNormal.normalize();
      }
    }
    if (!bestPosition) {
      console.warn(`[encaixe] par ${groupId}x${neighborId}: nenhuma fronteira geométrica`);
      return null;
    }
    return { position: bestPosition, normalA };
  };

  // NOVO: especs de encaixe de um par. Usa encaixes manuais se existirem para o par,
  // senão cai no posicionamento automático por centroides.
  const getPairJointSpecs = (groupId: number, neighborId: number): JointSpec[] => {
    const manual = manualJoints.filter(j =>
      (j.groupA === groupId && j.groupB === neighborId) ||
      (j.groupA === neighborId && j.groupB === groupId)
    );
    if (manual.length > 0) {
      return manual.map(j => ({
        position: j.position.clone(),
        normalFrom: j.groupA === groupId ? j.normalA.clone() : j.normalA.clone().negate(),
        manualId: j.id,
        scale: j.scale ?? 1,
      }));
    }
    const anchor = computeGroupPairAnchor(groupId, neighborId);
    if (!anchor) return [];
    return [{ position: anchor.position, normalFrom: anchor.normalA }];
  };

  // NOVO: coloca um encaixe manual na fronteira mais próxima do clique.
  const placeJointAt = (clickPoint: THREE.Vector3, clickGroupId: number) => {
    if (!modelGeometry || !adjacencyList) return;
    const posAttr = modelGeometry.attributes.position;
    let bestPosition: THREE.Vector3 | null = null, bestGroupA = -1, bestGroupB = -1, bestDist = Infinity;
    for (let i = 0; i < posAttr.count; i++) {
      const gA = vertexGroups[i] || 0;
      const adj = adjacencyList[i];
      if (!adj) continue;
      for (const neighborIdx of adj) {
        const gB = vertexGroups[neighborIdx] || 0;
        if (gB === gA) continue;
        if (clickGroupId !== 0 && gA !== clickGroupId && gB !== clickGroupId) continue;
        const boundaryPosition = new THREE.Vector3(
          (posAttr.getX(i) + posAttr.getX(neighborIdx)) / 2,
          (posAttr.getY(i) + posAttr.getY(neighborIdx)) / 2,
          (posAttr.getZ(i) + posAttr.getZ(neighborIdx)) / 2,
        );
        const d = boundaryPosition.distanceToSquared(clickPoint);
        if (d < bestDist) { bestDist = d; bestPosition = boundaryPosition; bestGroupA = gA; bestGroupB = gB; }
      }
    }
    if (!bestPosition) {
      const candidates = findNeighborGroups(clickGroupId)
        .map((neighborId) => ({ neighborId, anchor: computeGroupPairAnchor(clickGroupId, neighborId) }))
        .filter((candidate): candidate is { neighborId: number; anchor: { position: THREE.Vector3; normalA: THREE.Vector3 } } => !!candidate.anchor)
        .sort((a, b) => a.anchor.position.distanceToSquared(clickPoint) - b.anchor.position.distanceToSquared(clickPoint));
      const closest = candidates[0];
      if (closest) {
        bestPosition = closest.anchor.position;
        bestGroupA = clickGroupId;
        bestGroupB = closest.neighborId;
      }
    }
    if (!bestPosition) { alert("Não foi encontrada outra peça próxima para conectar."); return; }
    const existingJoint = manualJoints.find((joint) =>
      (joint.groupA === bestGroupA && joint.groupB === bestGroupB) ||
      (joint.groupA === bestGroupB && joint.groupB === bestGroupA)
    );
    if (existingJoint) {
      setSelectedManualJointId(existingJoint.id);
      return;
    }
    const centroidA = computeGroupCentroid(bestGroupA);
    const centroidB = computeGroupCentroid(bestGroupB);
    if (!centroidA || !centroidB) return;
    const anchor = computeGroupPairAnchor(bestGroupA, bestGroupB);
    const normalA = anchor?.normalA || new THREE.Vector3().subVectors(centroidB, centroidA).normalize();
    const id = typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `j${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setManualJoints(prev => [...prev, { id, groupA: bestGroupA, groupB: bestGroupB, position: bestPosition!, normalA }]);
   setSelectedManualJointId(id);
  };

  // An automatic preview joint becomes editable on its first click. Reusing
  // the same pair keeps the automatic preview from turning into a duplicate.
  const selectPreviewJoint = (joint: {
    id?: string;
    groupId: number;
    neighborId: number;
    type: 'peg' | 'socket' | 'magnet';
    position: THREE.Vector3;
    direction: THREE.Vector3;
  }) => {
    if (joint.id) {
      setSelectedManualJointId(joint.id);
      return joint.id;
    }

    const existingJoint = manualJoints.find((manual) =>
      (manual.groupA === joint.groupId && manual.groupB === joint.neighborId) ||
      (manual.groupA === joint.neighborId && manual.groupB === joint.groupId)
    );
    if (existingJoint) {
      setSelectedManualJointId(existingJoint.id);
      return existingJoint.id;
    }

    const id = typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `j${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const normalA = (joint.type === 'peg' ? joint.direction : joint.direction.clone().negate()).clone().normalize();
    setManualJoints((prev) => [...prev, {
      id,
      groupA: joint.groupId,
      groupB: joint.neighborId,
      position: joint.position.clone(),
      normalA,
    }]);
    setSelectedManualJointId(id);
    return id;
  };

  const updateManualJointPosition = (axis: "x" | "y" | "z", value: number) => {
    if (!selectedManualJointId || !Number.isFinite(value)) return;
    setManualJoints(prev => prev.map(j => {
      if (j.id !== selectedManualJointId) return j;
      const position = j.position.clone();
      if (axis === "x") position.x = value;
      else if (axis === "y") position.y = value;
      else position.z = value;
      return { ...j, position };
    }));
  };

  const updateManualJointTransform = (position: THREE.Vector3, normalA: THREE.Vector3, scale: number) => {
    if (!selectedManualJointId) return;
    setManualJoints(prev => prev.map(j => j.id === selectedManualJointId
      ? { ...j, position: position.clone(), normalA: normalA.clone().normalize(), scale: Math.max(0.1, scale) }
      : j
    ));
  };

  const moveManualJointToBoundary = (jointId: string, point: THREE.Vector3, groupId: number) => {
    if (!modelGeometry || !adjacencyList) return;
    const positionAttr = modelGeometry.attributes.position;
    let bestPosition: THREE.Vector3 | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < positionAttr.count; i++) {
      const firstGroup = vertexGroups[i] || 0;
      if (firstGroup !== groupId) continue;
      for (const neighborIdx of adjacencyList[i] || []) {
        const secondGroup = vertexGroups[neighborIdx] || 0;
        if (secondGroup === firstGroup) continue;
        const boundaryPosition = new THREE.Vector3(
          (positionAttr.getX(i) + positionAttr.getX(neighborIdx)) / 2,
          (positionAttr.getY(i) + positionAttr.getY(neighborIdx)) / 2,
          (positionAttr.getZ(i) + positionAttr.getZ(neighborIdx)) / 2,
        );
        const distance = boundaryPosition.distanceToSquared(point);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPosition = boundaryPosition;
        }
      }
    }
    if (!bestPosition) return;
    setManualJoints((joints) => joints.map((joint) => joint.id === jointId ? { ...joint, position: bestPosition! } : joint));
  };

  const moveManualJointFromRay = (jointId: string, ray: THREE.Ray, groupId: number, offset: THREE.Vector3) => {
    const current = manualJoints.find((joint) => joint.id === jointId);
    if (!current) return;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      ray.direction,
      current.position.clone().add(offset),
    );
    const point = ray.intersectPlane(plane, new THREE.Vector3());
    if (point) moveManualJointToBoundary(jointId, point.sub(offset), groupId);
  };

  const subGeometries = useMemo(() => {
    if (!previewSeparated || !modelGeometry) return [];
    const positionAttr = modelGeometry.attributes.position;
    if (!positionAttr) return [];
    const indexAttr = modelGeometry.index;
    const normalAttr = modelGeometry.attributes.normal;
    let modelSumX = 0, modelSumY = 0, modelSumZ = 0, modelCount = 0;
    const totalCount = positionAttr.count;
    const sampleStep = Math.max(1, Math.floor(totalCount / 1000));
    for (let i = 0; i < totalCount; i += sampleStep) {
      modelSumX += positionAttr.getX(i); modelSumY += positionAttr.getY(i); modelSumZ += positionAttr.getZ(i); modelCount++;
    }
    const modelCenter = new THREE.Vector3(modelSumX / (modelCount || 1), modelSumY / (modelCount || 1), modelSumZ / (modelCount || 1));
    const results: { groupId: number; color: string; name: string; geometry: THREE.BufferGeometry; direction: THREE.Vector3; }[] = [];
    const activeIds = Array.from(new Set([0, ...groups.map(g => g.id)]));
    activeIds.forEach(gId => {
      const exportPositions: number[] = [], exportNormals: number[] = [];
      let sumX = 0, sumY = 0, sumZ = 0, groupVertCount = 0;
      if (indexAttr) {
        const arr = indexAttr.array;
        for (let i = 0; i < arr.length; i += 3) {
          const idx0 = arr[i], idx1 = arr[i + 1], idx2 = arr[i + 2];
          const g0 = vertexGroups[idx0] || 0, g1 = vertexGroups[idx1] || 0, g2 = vertexGroups[idx2] || 0;
           const belongs = classifyTriangleGroup(g0, g1, g2, gId);
          if (belongs) {
            const px0 = positionAttr.getX(idx0), py0 = positionAttr.getY(idx0), pz0 = positionAttr.getZ(idx0);
            const px1 = positionAttr.getX(idx1), py1 = positionAttr.getY(idx1), pz1 = positionAttr.getZ(idx1);
            const px2 = positionAttr.getX(idx2), py2 = positionAttr.getY(idx2), pz2 = positionAttr.getZ(idx2);
            exportPositions.push(px0, py0, pz0, px1, py1, pz1, px2, py2, pz2);
            sumX += px0 + px1 + px2; sumY += py0 + py1 + py2; sumZ += pz0 + pz1 + pz2; groupVertCount += 3;
            if (normalAttr) exportNormals.push(normalAttr.getX(idx0), normalAttr.getY(idx0), normalAttr.getZ(idx0), normalAttr.getX(idx1), normalAttr.getY(idx1), normalAttr.getZ(idx1), normalAttr.getX(idx2), normalAttr.getY(idx2), normalAttr.getZ(idx2));
          }
        }
      } else {
        const vertexCount = positionAttr.count;
        for (let i = 0; i < vertexCount; i += 3) {
          if (i + 2 >= vertexCount) break;
          const g0 = vertexGroups[i] || 0, g1 = vertexGroups[i + 1] || 0, g2 = vertexGroups[i + 2] || 0;
           const belongs = classifyTriangleGroup(g0, g1, g2, gId);
          if (belongs) {
            const px0 = positionAttr.getX(i), py0 = positionAttr.getY(i), pz0 = positionAttr.getZ(i);
            const px1 = positionAttr.getX(i + 1), py1 = positionAttr.getY(i + 1), pz1 = positionAttr.getZ(i + 1);
            const px2 = positionAttr.getX(i + 2), py2 = positionAttr.getY(i + 2), pz2 = positionAttr.getZ(i + 2);
            exportPositions.push(px0, py0, pz0, px1, py1, pz1, px2, py2, pz2);
            sumX += px0 + px1 + px2; sumY += py0 + py1 + py2; sumZ += pz0 + pz1 + pz2; groupVertCount += 3;
            if (normalAttr) exportNormals.push(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i), normalAttr.getX(i + 1), normalAttr.getY(i + 1), normalAttr.getZ(i + 1), normalAttr.getX(i + 2), normalAttr.getY(i + 2), normalAttr.getZ(i + 2));
          }
        }
      }
      if (exportPositions.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(exportPositions, 3));
        if (exportNormals.length > 0) geom.setAttribute("normal", new THREE.Float32BufferAttribute(exportNormals, 3));
        const groupCenter = new THREE.Vector3(sumX / (groupVertCount || 1), sumY / (groupVertCount || 1), sumZ / (groupVertCount || 1));
        const direction = new THREE.Vector3().subVectors(groupCenter, modelCenter);
        if (direction.lengthSq() < 0.0001) direction.set((gId % 3 - 1) * 0.5, ((gId + 1) % 3 - 1) * 0.5, ((gId + 2) % 3 - 1) * 0.5);
        direction.normalize();
        results.push({ groupId: gId, color: groups.find(g => g.id === gId)?.color || "#888888", name: groups.find(g => g.id === gId)?.name || "Restante", geometry: geom, direction });
      }
    });
    return results;
  }, [previewSeparated, modelGeometry, vertexGroups, groups]);

  // NOVO: Geometrias dos encaixes para preview no modo separado.
  // Usa os MESMOS specs do export (manual + auto), então o preview reflete o STL final.
  const jointGeometries = useMemo(() => {
    if (!previewSeparated || !modelGeometry) return [];
     const joints: { id?: string; groupId: number; neighborId: number; type: 'peg' | 'socket' | 'magnet'; position: THREE.Vector3; direction: THREE.Vector3; color: string; neighborName: string; scale: number; reinforcement?: { diameter: number; height: number; wall: number } }[] = [];

    groups.forEach((group) => {
      const groupId = group.id;
      if (groupId === 0) return;
      findNeighborGroups(groupId).forEach((neighborId) => {
        getPairJointSpecs(groupId, neighborId).forEach((spec) => {
          const myType = getEffectiveJointType(groupId, neighborId);
          const intoGroup = spec.normalFrom.clone().negate();
          const neighborName = getGroupName(neighborId);
          if (jointType === "magnet") {
             joints.push({ id: spec.manualId, groupId, neighborId, type: 'magnet', position: spec.position.clone(), direction: intoGroup, color: "#FFD700", neighborName, scale: spec.scale ?? 1 });
          } else if (myType === 'female') {
                joints.push({ id: spec.manualId, groupId, neighborId, type: 'socket', position: spec.position.clone(), direction: intoGroup, color: "#FF1744", neighborName, scale: spec.scale ?? 1, reinforcement: { diameter: jointSizes.reinforcementDiameter, height: jointSizes.reinforcementHeight, wall: jointSizes.reinforcementWall } });
          } else {
             joints.push({ id: spec.manualId, groupId, neighborId, type: 'peg', position: spec.position.clone(), direction: spec.normalFrom.clone(), color: "#632CE5", neighborName, scale: spec.scale ?? 1 });
          }
        });
      });
    });
    return joints;
  }, [previewSeparated, modelGeometry, groups, vertexGroups, jointType, groupJointTypes, manualJoints, jointSizes]);

  const validatePreviewJoints = () => {
    const pairs = new Map<string, { peg: number; socket: number; magnet: number }>();
    for (const joint of jointGeometries) {
      const key = [joint.groupId, joint.neighborId].sort((a, b) => a - b).join(":");
      const pair = pairs.get(key) || { peg: 0, socket: 0, magnet: 0 };
      if (joint.type === "peg") pair.peg++;
      if (joint.type === "socket") pair.socket++;
      if (joint.type === "magnet") pair.magnet++;
      pairs.set(key, pair);
    }
    const valid = pairs.size > 0 && Array.from(pairs.values()).every((pair) =>
      jointType === "magnet" ? pair.magnet >= 2 : pair.peg > 0 && pair.socket > 0,
    );
    setPreviewValidation(valid ? "valid" : "warning");
    setFinalizedPreview(true);
    setSeparationDistance(0);
    setPlacementMode(false);
    if (!valid) alert("Atenção: o preview não encontrou um par completo de macho e fêmea. Ajuste a fronteira ou o tipo das peças.");
  };

  useEffect(() => { return () => { subGeometries.forEach(sub => sub.geometry.dispose()); }; }, [subGeometries]);

  const handleGeometryUpdated = () => {};

  const capHollowVase = async () => {
    if (!modelGeometry) return;
    setLoadingCap(true); setIsProcessing(true); setProcessingMessage("Fechando furos...");
    await new Promise(r => setTimeout(r, 50));
    try {
      let geom = modelGeometry.clone(); geom = BufferGeometryUtils.mergeVertices(geom);
      const index = geom.getIndex();
      if (!index) { alert("Sem índices."); setLoadingCap(false); return; }
      const posAttr = geom.getAttribute('position');
      const MULT = 100000000;
      const boundaryEdges = new Set<number>();
      const idxCount = index.count;
      for (let i = 0; i < idxCount; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        [[a, b], [b, c], [c, a]].forEach(([u, v]) => { const e1 = u * MULT + v, e2 = v * MULT + u; if (boundaryEdges.has(e2)) boundaryEdges.delete(e2); else if (boundaryEdges.has(e1)) boundaryEdges.delete(e1); else boundaryEdges.add(e1); });
      }
      const nextVertex = new Map<number, number>();
      for (const edge of boundaryEdges) nextVertex.set(Math.floor(edge / MULT), edge % MULT);
      if (nextVertex.size === 0) { alert("Malha já fechada."); setLoadingCap(false); setIsProcessing(false); return; }
      const loops: number[][] = []; const visited = new Set<number>();
      for (const [startNode] of nextVertex.entries()) {
        if (visited.has(startNode)) continue;
        const loop: number[] = []; let current: number | undefined = startNode;
        while (current !== undefined && !visited.has(current)) { visited.add(current); loop.push(current); current = nextVertex.get(current); }
        if (loop.length > 2) loops.push(loop);
      }
      geom.computeBoundingBox(); const bbox = geom.boundingBox!;
      const extX = bbox.max.x - bbox.min.x, extY = bbox.max.y - bbox.min.y, extZ = bbox.max.z - bbox.min.z;
      let getAxisVal = (v: number) => posAttr.getY(v), minVal = bbox.min.y, ext = extY;
      if (extZ > extY && extZ > extX) { getAxisVal = (v: number) => posAttr.getZ(v); minVal = bbox.min.z; ext = extZ; }
      else if (extX > extY && extX > extZ) { getAxisVal = (v: number) => posAttr.getX(v); minVal = bbox.min.x; ext = extX; }
      const targetLoops = capSelection === "top" ? loops.filter(l => { let avg = 0; l.forEach(v => avg += getAxisVal(v)); return (avg / l.length) > minVal + ext * 0.5; }) : loops.filter(l => { let avg = 0; l.forEach(v => avg += getAxisVal(v)); return (avg / l.length) < minVal + ext * 0.5; });
      if (targetLoops.length === 0) { alert("Nenhum buraco encontrado."); setLoadingCap(false); setIsProcessing(false); return; }
      let newTrianglesCount = 0; targetLoops.forEach(l => newTrianglesCount += l.length);
      const newVertexCount = posAttr.count + targetLoops.length;
      const newPositions = new Float32Array(newVertexCount * 3); newPositions.set(posAttr.array);
      const oldColorsAttr = geom.getAttribute('color');
      const newColors = new Float32Array(newVertexCount * 3); if (oldColorsAttr) newColors.set(oldColorsAttr.array); else newColors.fill(1);
      const newIndices = new Uint32Array(index.count + newTrianglesCount * 3); newIndices.set(index.array);
      let currentVertexCount = posAttr.count, currentIndexCount = index.count;
      targetLoops.forEach(loop => {
        let cx = 0, cy = 0, cz = 0, cR = 0, cG = 0, cB = 0;
        loop.forEach(v => { cx += posAttr.getX(v); cy += posAttr.getY(v); cz += posAttr.getZ(v); if (oldColorsAttr) { cR += oldColorsAttr.getX(v); cG += oldColorsAttr.getY(v); cB += oldColorsAttr.getZ(v); } });
        cx /= loop.length; cy /= loop.length; cz /= loop.length;
        if (!oldColorsAttr) { cR = 1; cG = 1; cB = 1; } else { cR /= loop.length; cG /= loop.length; cB /= loop.length; }
        const ci = currentVertexCount;
        newPositions[ci * 3] = cx; newPositions[ci * 3 + 1] = cy; newPositions[ci * 3 + 2] = cz;
        newColors[ci * 3] = cR; newColors[ci * 3 + 1] = cG; newColors[ci * 3 + 2] = cB;
        currentVertexCount++;
        for (let i = 0; i < loop.length; i++) { const v1 = loop[i], v2 = loop[(i + 1) % loop.length]; newIndices[currentIndexCount++] = v2; newIndices[currentIndexCount++] = v1; newIndices[currentIndexCount++] = ci; }
      });
      const cappedGeom = new THREE.BufferGeometry();
      cappedGeom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      cappedGeom.setIndex(new THREE.BufferAttribute(newIndices, 1));
      cappedGeom.computeVertexNormals(); cappedGeom.setAttribute("color", new THREE.BufferAttribute(newColors, 3));
      setModelGeometry(cappedGeom); setVertexGroups(new Uint8Array(currentVertexCount));
      setHistory([]); setGroupJointTypes({}); setManualJoints([]); setPlacementMode(false);
      setStats({ faces: newIndices.length / 3, vertices: currentVertexCount });
      setIsCapped(true); alert(`Parte "${capSelection}" fechada!`);
    } catch (err) { console.error(err); alert("Erro ao fechar vaso."); }
    finally { setLoadingCap(false); setIsProcessing(false); }
  };

  const downloadCappedModel = () => {
    if (!modelGeometry) return;
    setIsDownloadingCapped(true); setIsProcessing(true);
    setTimeout(() => {
      const workerScript = `self.onmessage=function(e){const p=e.data.positions,i=e.data.indices,n=i?i.length/3:p.length/9,b=new ArrayBuffer(84+50*n),d=new DataView(b);d.setUint32(80,n,true);let o=84,j=0;while(j<(i?i.length:p.length/3)){let a,b,c;i?(a=i[j]*3,b=i[j+1]*3,c=i[j+2]*3,j+=3):(a=j*3,b=(j+1)*3,c=(j+2)*3,j+=3);const pAx=p[a],pAy=p[a+1],pAz=p[a+2],pBx=p[b],pBy=p[b+1],pBz=p[b+2],pCx=p[c],pCy=p[c+1],pCz=p[c+2];let nx=(pCy-pBy)*(pAz-pBz)-(pCz-pBz)*(pAy-pBy),ny=(pCz-pBz)*(pAx-pBx)-(pCx-pBx)*(pAz-pBz),nz=(pCx-pBx)*(pAy-pBy)-(pCy-pBy)*(pAx-pBx);const l=Math.sqrt(nx*nx+ny*ny+nz*nz);if(l>0){nx/=l;ny/=l;nz/=l;}d.setFloat32(o,nx,true);o+=4;d.setFloat32(o,ny,true);o+=4;d.setFloat32(o,nz,true);o+=4;d.setFloat32(o,pAx,true);o+=4;d.setFloat32(o,pAy,true);o+=4;d.setFloat32(o,pAz,true);o+=4;d.setFloat32(o,pBx,true);o+=4;d.setFloat32(o,pBy,true);o+=4;d.setFloat32(o,pBz,true);o+=4;d.setFloat32(o,pCx,true);o+=4;d.setFloat32(o,pCy,true);o+=4;d.setFloat32(o,pCz,true);o+=4;d.setUint16(o,0,true);o+=2;}self.postMessage({buffer:b},[b]);};`;
      try {
        const worker = new Worker(URL.createObjectURL(new Blob([workerScript], { type: 'application/javascript' })));
        worker.postMessage({ positions: modelGeometry.getAttribute('position').array, indices: modelGeometry.getIndex()?.array || null });
        worker.onmessage = (e) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([e.data.buffer], { type: "application/octet-stream" })); link.download = `vaso_fechado_${capSelection}.stl`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); setIsCapped(false); setIsDownloadingCapped(false); setIsProcessing(false); worker.terminate(); };
        worker.onerror = () => { alert("Erro ao exportar."); setIsDownloadingCapped(false); setIsProcessing(false); worker.terminate(); };
      } catch { alert("Erro."); setIsDownloadingCapped(false); setIsProcessing(false); }
    }, 100);
  };

  const forEachTriangle = (cb: (a: number, b: number, c: number) => void) => {
    if (!modelGeometry) return;
    const indexAttr = modelGeometry.index;
    if (indexAttr) { const idx = indexAttr.array; for (let i = 0; i < idx.length; i += 3) cb(idx[i], idx[i + 1], idx[i + 2]); }
    else { const count = modelGeometry.attributes.position.count; for (let i = 0; i < count; i += 3) cb(i, i + 1, i + 2); }
  };

  const exportSeparatedPart = async (groupId: number) => {
    if (!modelGeometry) return;
    if (jointType === "default" && jointConfigurationWarning) {
      alert(jointConfigurationWarning);
      return;
    }
    setIsExporting(groupId); setIsProcessing(true);
    setProcessingMessage(`Exportando ${groupId === 0 ? "Peça Principal" : getGroupName(groupId)}...`);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
        const histogram: Record<number, number> = {};
        for (let i = 0; i < vertexGroups.length; i++) { const g = vertexGroups[i] || 0; histogram[g] = (histogram[g] || 0) + 1; }
        console.log(`[encaixe] exportando grupo ${groupId} — histograma:`, histogram);
        const positionAttr = modelGeometry.attributes.position;
        const indexAttr = modelGeometry.index;
        const exportPositions: number[] = [];
        if (indexAttr) {
          const arr = indexAttr.array;
          for (let i = 0; i < arr.length; i += 3) {
            const idx0 = arr[i], idx1 = arr[i + 1], idx2 = arr[i + 2];
            const g0 = vertexGroups[idx0] || 0, g1 = vertexGroups[idx1] || 0, g2 = vertexGroups[idx2] || 0;
            if (!classifyTriangleGroup(g0, g1, g2, groupId)) continue;
            exportPositions.push(positionAttr.getX(idx0), positionAttr.getY(idx0), positionAttr.getZ(idx0), positionAttr.getX(idx1), positionAttr.getY(idx1), positionAttr.getZ(idx1), positionAttr.getX(idx2), positionAttr.getY(idx2), positionAttr.getZ(idx2));
          }
        } else {
          const vertexCount = positionAttr.count;
          for (let i = 0; i < vertexCount; i += 3) {
            if (i + 2 >= vertexCount) break;
            const g0 = vertexGroups[i] || 0, g1 = vertexGroups[i + 1] || 0, g2 = vertexGroups[i + 2] || 0;
            if (!classifyTriangleGroup(g0, g1, g2, groupId)) continue;
            exportPositions.push(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i), positionAttr.getX(i + 1), positionAttr.getY(i + 1), positionAttr.getZ(i + 1), positionAttr.getX(i + 2), positionAttr.getY(i + 2), positionAttr.getZ(i + 2));
          }
        }
        if (exportPositions.length === 0) {
          // Group 0 is optional: a fully painted model has no remaining gray
          // piece, so skip it without interrupting the other exports.
          setIsExporting(null); setIsProcessing(false); return;
        }
        const rawGeometry = new THREE.BufferGeometry();
        rawGeometry.setAttribute("position", new THREE.Float32BufferAttribute(exportPositions, 3));
        let exportGeometry = capBoundaryHoles(rawGeometry);
        const maleCentroid = jointType === "default" ? computeGroupCentroid(groupId) : null;
         findNeighborGroups(groupId).forEach((neighborId) => {
           getPairJointSpecs(groupId, neighborId).forEach((spec) => {
              const myType = getEffectiveJointType(groupId, neighborId);
              const intoGroup = spec.normalFrom.clone().negate();
              const connectorPosition = snapPointToGeometryBoundary(rawGeometry, spec.position);
              const transformScale = spec.scale ?? 1;
              if (jointType === "magnet") {
                exportGeometry = addSocket(exportGeometry, connectorPosition, intoGroup, jointSizes.magnetDiameter * transformScale, jointSizes.magnetDepth * transformScale, 6);
              } else if (myType === 'female') {
                exportGeometry = addReinforcedSocket(
                  exportGeometry,
                  connectorPosition,
                  intoGroup,
                 (jointSizes.pegDiameter + jointSizes.fitTolerance * 2) * transformScale,
                 (jointSizes.pegLength + jointSizes.fitTolerance) * transformScale,
                 jointSizes.reinforcementDiameter * transformScale,
                 jointSizes.reinforcementHeight * transformScale,
                 jointSizes.reinforcementWall * transformScale,
                 6,
               );
              } else {
                const pegLength = jointSizes.pegLength * transformScale;
                const embed = maleCentroid ? Math.max(0.5, Math.min(pegLength, connectorPosition.distanceTo(maleCentroid))) : 0.5;
                exportGeometry = addPeg(exportGeometry, connectorPosition, spec.normalFrom, jointSizes.pegDiameter * transformScale, pegLength, 6, embed);
             }
          });
        });
        exportGeometry.computeVertexNormals();
        const exportMesh = new THREE.Mesh(exportGeometry, new THREE.MeshBasicMaterial());
        const exporter = new STLExporter();
        const result = exporter.parse(exportMesh, { binary: true });
        const blob = new Blob([result], { type: "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const roleLabel = findNeighborGroups(groupId).map(n => { const type = getEffectiveJointType(groupId, n); const tag = jointType === "magnet" ? "IMA" : type === 'female' ? "FEMEA" : "MACHO"; return `${tag}-vs-${getGroupName(n).replace(/\s+/g, "")}`; }).join("_");
        const jointSuffix = roleLabel ? `_${roleLabel}` : "_SEM_ENCAIXE";
        const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
        link.download = `${cleanName}_${getGroupName(groupId).replace(/\s+/g, "_")}${jointSuffix}.stl`;
        link.click();
    } catch (err) { console.error("Export error:", err); }
    finally { setIsExporting(null); setIsProcessing(false); }
  };

  const exportAllSeparatedParts = async () => {
    if (!modelGeometry || isExporting !== null) return;
    for (const group of groups) {
      const count = vertexGroups.filter(vg => vg === group.id).length;
      if (count > 0 || group.id === 0) await exportSeparatedPart(group.id);
    }
  };

  const selectedManualJoint = manualJoints.find(j => j.id === selectedManualJointId) ?? null;
  const jointBounds = modelGeometry?.boundingBox;
  const jointConfigurationWarning = jointSizes.reinforcementDiameter < jointSizes.pegDiameter + jointSizes.fitTolerance * 2 + jointSizes.reinforcementWall * 2
    ? "A saliência está estreita demais para a parede configurada. Aumente o diâmetro externo."
    : jointSizes.reinforcementHeight < jointSizes.pegLength * 0.5
      ? "A saliência está mais curta que metade do pino. Verifique a profundidade do encaixe."
      : null;

  const handleGizmoChange = (event: any) => {
    const object = event?.target?.object as THREE.Object3D | undefined;
    if (!object || !selectedManualJoint) return;
    const subGeometry = subGeometries.find((sub) => sub.groupId === selectedManualJoint.groupA);
    if (!subGeometry) return;
    const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance);
    const normalA = new THREE.Vector3(0, 1, 0).applyQuaternion(object.quaternion).normalize();
    updateManualJointTransform(object.position.clone().sub(offset), normalA, object.scale.x);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-[#212121] bg-[#F9FAF4]">
      <header className="p-8 flex justify-between items-end border-b border-[#E2E3DD] shrink-0 bg-[#F9FAF4]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#632CE5] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.5.0</p>
          <h1 className="text-6xl font-black tracking-tighter leading-none uppercase">3D Print Painter</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Loaded File</div>
          <div className="font-mono text-sm text-[#632CE5] tracking-wider">{fileName}</div>
        </div>
      </header>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        <div className="workbench-viewport relative bg-[#F3F4EE] h-full flex flex-col">
          <div className="workbench-viewport flex-1 w-full relative overflow-hidden bg-[#F3F4EE]">
            {modelGeometry ? (
              <>
                <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
                  <color attach="background" args={["#F3F4EE"]} />
                  <ambientLight intensity={0.8} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} />
                  <pointLight position={[-10, 5, -10]} intensity={0.8} color="#632CE5" />
                  <directionalLight position={[5, 10, 5]} intensity={2.0} castShadow />
                  <directionalLight position={[-5, -10, -5]} intensity={0.6} />
                  <Bounds key={`${modelGeometry.uuid}-${viewportEpoch}`} fit clip margin={1.2} maxDuration={0.2}>
                    <group>
                  {previewSeparated ? (
                    <>
                      {subGeometries.map((sub, idx) => (
                        <mesh
                          key={idx}
                          geometry={sub.geometry}
                          castShadow
                          receiveShadow
                          position={[sub.direction.x * separationDistance, sub.direction.y * separationDistance, sub.direction.z * separationDistance]}
                          onPointerDown={(event) => {
                            if (!placementMode) return;
                            event.stopPropagation();
                            const offset = new THREE.Vector3(sub.direction.x * separationDistance, sub.direction.y * separationDistance, sub.direction.z * separationDistance);
                            placeJointAt(event.point.clone().sub(offset), sub.groupId);
                          }}
                        >
                          <meshStandardMaterial color={sub.color} roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
                        </mesh>
                      ))}
                      {jointGeometries.map((joint, idx) => {
                        const subGeometry = subGeometries.find(s => s.groupId === joint.groupId);
                        if (!subGeometry) return null;
                        const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance);
                        const finalPosition = joint.position.clone().add(offset);
                        const quaternion = new THREE.Quaternion();
                        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), joint.direction);
                        if (joint.type === 'peg') {
                          const r = jointSizes.pegDiameter / 2;
                          const l = jointSizes.pegLength;
                          const pos = finalPosition.clone().add(joint.direction.clone().multiplyScalar(l / 2));
                          return (
                               <mesh key={`peg-${idx}`} geometry={new THREE.CylinderGeometry(r, r, l, 6)} position={pos} scale={[joint.scale, joint.scale, joint.scale]} quaternion={quaternion} onPointerDown={(event) => { event.stopPropagation(); const id = selectPreviewJoint(joint); (event.target as any).setPointerCapture?.(event.pointerId); if (id) setSelectedManualJointId(id); }} onPointerMove={(event) => { const id = joint.id || selectedManualJointId; if (id && event.buttons === 1) { const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance); moveManualJointFromRay(id, event.ray, joint.groupId, offset); } }}>
                                <meshStandardMaterial color={joint.color} emissive={joint.color} emissiveIntensity={joint.id === selectedManualJointId ? 0.9 : 0.4} transparent opacity={joint.id === selectedManualJointId ? 1 : 0.85} />
                            </mesh>
                          );
                        } else if (joint.type === 'socket') {
                          const r = jointSizes.pegDiameter / 2 + jointSizes.fitTolerance;
                          const l = jointSizes.pegLength + jointSizes.fitTolerance;
                          const pos = finalPosition.clone().add(joint.direction.clone().multiplyScalar(l / 2));
                          const reinforcement = joint.reinforcement!;
                          const bossLength = reinforcement.height + reinforcement.wall;
                          const bossPos = finalPosition.clone().add(joint.direction.clone().multiplyScalar(-(reinforcement.height - reinforcement.wall) / 2));
                          return (
                             <group key={`socket-${idx}`} scale={[joint.scale, joint.scale, joint.scale]}>
                               <mesh geometry={new THREE.CylinderGeometry(reinforcement.diameter / 2, reinforcement.diameter / 2, bossLength, 6)} position={bossPos} quaternion={quaternion} onPointerDown={(event) => { event.stopPropagation(); const id = selectPreviewJoint(joint); (event.target as any).setPointerCapture?.(event.pointerId); if (id) setSelectedManualJointId(id); }} onPointerMove={(event) => { const id = joint.id || selectedManualJointId; if (id && event.buttons === 1) { const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance); moveManualJointFromRay(id, event.ray, joint.groupId, offset); } }}>
                                <meshStandardMaterial color="#FF1744" transparent opacity={joint.id === selectedManualJointId ? 0.5 : 0.25} wireframe />
                              </mesh>
                               <mesh geometry={new THREE.CylinderGeometry(r, r, l, 6, 1, true)} position={pos} quaternion={quaternion} onPointerDown={(event) => { event.stopPropagation(); const id = selectPreviewJoint(joint); (event.target as any).setPointerCapture?.(event.pointerId); if (id) setSelectedManualJointId(id); }} onPointerMove={(event) => { const id = joint.id || selectedManualJointId; if (id && event.buttons === 1) { const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance); moveManualJointFromRay(id, event.ray, joint.groupId, offset); } }}>
                                <meshBasicMaterial color={joint.color} wireframe transparent opacity={joint.id === selectedManualJointId ? 1 : 0.75} />
                              </mesh>
                            </group>
                          );
                        } else {
                          const r = jointSizes.magnetDiameter / 2;
                          const l = jointSizes.magnetDepth;
                          const pos = finalPosition.clone().add(joint.direction.clone().multiplyScalar(l / 2));
                          return (
                             <mesh key={`magnet-${idx}`} geometry={new THREE.CylinderGeometry(r, r, l, 6)} position={pos} scale={[joint.scale, joint.scale, joint.scale]} quaternion={quaternion} onPointerDown={(event) => { event.stopPropagation(); const id = selectPreviewJoint(joint); (event.target as any).setPointerCapture?.(event.pointerId); if (id) setSelectedManualJointId(id); }} onPointerMove={(event) => { const id = joint.id || selectedManualJointId; if (id && event.buttons === 1) { const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance); moveManualJointFromRay(id, event.ray, joint.groupId, offset); } }}>
                              <meshStandardMaterial color={joint.color} emissive={joint.color} emissiveIntensity={joint.id === selectedManualJointId ? 1 : 0.5} transparent opacity={joint.id === selectedManualJointId ? 1 : 0.9} metalness={0.8} roughness={0.2} />
                            </mesh>
                          );
                       }
                      })}
                      {selectedManualJoint && (() => {
                        const subGeometry = subGeometries.find((sub) => sub.groupId === selectedManualJoint.groupA);
                        if (!subGeometry) return null;
                        const offset = new THREE.Vector3(subGeometry.direction.x * separationDistance, subGeometry.direction.y * separationDistance, subGeometry.direction.z * separationDistance);
                        const position = selectedManualJoint.position.clone().add(offset);
                        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), selectedManualJoint.normalA);
                        const scale = selectedManualJoint.scale ?? 1;
                        return (
                          <TransformControls
                            mode={transformMode}
                            position={position}
                            quaternion={quaternion}
                            onObjectChange={handleGizmoChange}
                          >
                            <mesh visible={false} scale={[scale, scale, scale]}>
                              <sphereGeometry args={[0.35, 8, 8]} />
                              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                            </mesh>
                          </TransformControls>
                        );
                      })()}
                    </>
                  ) : (
                    <PaintableMesh geometry={modelGeometry} brushRadius={brushRadius} activeGroupId={activeGroupId} paintMode={paintMode} paintTool={paintTool} onGeometryUpdated={handleGeometryUpdated} onPaintChanged={() => { setManualJoints([]); setSelectedManualJointId(null); }} vertexGroups={vertexGroups} setVertexGroups={setVertexGroups} adjacencyList={adjacencyList} onStartAction={pushStateToHistory} isolateGroupId={effectiveIsolateGroupId} groups={groups} placementMode={placementMode} onPlaceJoint={placeJointAt} />
                  )}
                  {!previewSeparated && paintMode && !placementMode && <BrushIndicator brushRadius={brushRadius} paintMode={paintMode} paintTool={paintTool} />}
                  {!previewSeparated && placementMode && <PlacementIndicator placementMode={placementMode} />}
                  {!previewSeparated && manualJoints.length > 0 && (
                    <group>
                      {manualJoints.map(j => (
                        <mesh key={j.id} position={j.position} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), j.normalA)}>
                          <cylinderGeometry args={[0.6, 0.6, 0.8, 6]} />
                          <meshBasicMaterial color="#FFD700" />
                        </mesh>
                      ))}
                    </group>
                  )}
                    </group>
                  </Bounds>
                  <OrbitControls ref={controlsRef} makeDefault enabled={true} mouseButtons={{ LEFT: (placementMode || (paintMode && !previewSeparated)) ? null : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: (paintMode && !previewSeparated) ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN }} touches={{ ONE: (placementMode || (paintMode && !previewSeparated)) ? null : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
                  <Grid infiniteGrid fadeDistance={100} cellColor="#222" sectionColor="#444" cellSize={10} sectionSize={50} />
                  {watermarkEnabled && watermarkText.trim() !== "" && (
                    <Text position={watermarkParams.position} rotation={watermarkParams.rotation} fontSize={watermarkSize} color={watermarkStyle === "recessed" ? "#0a0a0a" : watermarkColor} maxWidth={Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z) * 1.5} textAlign="center" anchorX="center" anchorY="middle" depthOffset={watermarkStyle === "overlay" ? -1 : 0} outlineWidth={watermarkStyle === "recessed" ? 0.012 : 0} outlineColor={watermarkStyle === "recessed" ? watermarkColor : "transparent"}>
                      {watermarkText}
                      <meshStandardMaterial color={watermarkStyle === "recessed" ? "#151515" : watermarkColor} roughness={0.4} metalness={watermarkStyle === "overlay" ? 0.0 : 0.4} transparent={watermarkStyle === "overlay"} opacity={watermarkStyle === "overlay" ? 0.4 : 1.0} depthWrite={watermarkStyle !== "overlay"} side={THREE.DoubleSide} />
                    </Text>
                  )}
                </Canvas>
                <div className="absolute top-6 left-6 bg-[#F9FAF4]/85 border border-[#E8E9E3] backdrop-blur-md p-3.5 max-w-xs rounded text-[10px] uppercase tracking-wider text-zinc-400 space-y-1.5 pointer-events-none select-none z-10">
                  <div className="text-[#632CE5] font-bold text-[11px] mb-1">3D Navigation Guide</div>
                  <div className="flex justify-between gap-4"><span className="font-bold text-zinc-300">Left Click + Drag:</span><span>{placementMode ? "Place Joint" : paintMode ? "Paint Model" : "Rotate Camera"}</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold text-zinc-300">Right Click + Drag:</span><span>Rotate Camera</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold text-zinc-300">Scroll Wheel:</span><span>Zoom In / Out</span></div>
                  <div className="flex justify-between gap-4"><span className="font-bold text-zinc-300">Middle Click + Drag:</span><span>Pan Camera</span></div>
                  {placementMode && <div className="text-[9px] text-[#FFD700] mt-1 border-t border-[#E8E9E3]/60 pt-1.5 normal-case italic">* Clique na fronteira entre a parte ativa e a vizinha para fixar o encaixe.</div>}
                  {paintMode && !placementMode && <div className="text-[9px] text-[#00FF41] mt-1 border-t border-[#E8E9E3]/60 pt-1.5 normal-case italic">* Tip: Paint & navigate the camera seamlessly!</div>}
                </div>
                <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
                  <button title="Zoom In" onClick={zoomIn} className="w-10 h-10 flex items-center justify-center bg-[#F9FAF4]/90 border border-[#E8E9E3] text-zinc-400 hover:text-[#632CE5] hover:border-[#632CE5] backdrop-blur-md transition-all active:scale-95 rounded"><Plus className="w-5 h-5" /></button>
                  <button title="Zoom Out" onClick={zoomOut} className="w-10 h-10 flex items-center justify-center bg-[#F9FAF4]/90 border border-[#E8E9E3] text-zinc-400 hover:text-[#632CE5] hover:border-[#632CE5] backdrop-blur-md transition-all active:scale-95 rounded"><span className="text-xl font-bold leading-none select-none">-</span></button>
                   <button title="Reset Camera" onClick={() => { resetCamera(); setViewportEpoch((epoch) => epoch + 1); }} className="w-10 h-10 flex items-center justify-center bg-[#F9FAF4]/90 border border-[#E8E9E3] text-zinc-400 hover:text-[#632CE5] hover:border-[#632CE5] backdrop-blur-md transition-all active:scale-95 rounded"><RotateCcw className="w-4 h-4" /></button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-zinc-500 max-w-sm p-8 bg-[#F9FAF4] border border-[#E8E9E3]">
                  <Upload className="w-12 h-12 mx-auto mb-4 opacity-50 text-[#632CE5]" />
                  <p className="font-bold tracking-widest uppercase text-[10px] mb-4 text-[#632CE5]">No 3D Model Loaded</p>
                  <button onClick={loadDemoModel} className="bg-white text-black font-black uppercase text-xs px-6 py-3 tracking-widest hover:bg-[#632CE5] transition-colors">Load Demo Model</button>
                </div>
              </div>
            )}
            {modelGeometry && (
              <div className="absolute bottom-6 left-6 right-6 bg-[#F9FAF4]/90 border border-[#E8E9E3] backdrop-blur-md p-4 flex flex-wrap items-center justify-between gap-4 z-10">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={() => { setPaintMode(true); setPlacementMode(false); setPaintTool("brush"); setPreviewSeparated(false); }} className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors ${paintMode && paintTool === "brush" && !previewSeparated && !placementMode ? "bg-[#632CE5] text-[#212121] border-[#632CE5]" : "bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]"}`}><Paintbrush className="w-3 h-3" /> Brush</button>
                  <button onClick={() => { setPaintMode(true); setPlacementMode(false); setPaintTool("bucket"); setPreviewSeparated(false); }} className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors ${paintMode && paintTool === "bucket" && !previewSeparated && !placementMode ? "bg-[#632CE5] text-[#212121] border-[#632CE5]" : "bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]"}`} title="Preenchimento inteligente 3D"><PaintBucket className="w-3 h-3" /> Bucket</button>
                  <button onClick={() => { setPaintMode(true); setPlacementMode(false); setPaintTool("eraser"); setPreviewSeparated(false); }} className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors ${paintMode && paintTool === "eraser" && !previewSeparated && !placementMode ? "bg-[#FF1744] text-[#212121] border-[#FF1744]" : "bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]"}`} title="Borracha"><Eraser className="w-3 h-3" /> Eraser</button>
                  <button onClick={() => { setPaintMode(false); setPlacementMode(false); setPreviewSeparated(false); }} className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors ${!paintMode && !previewSeparated && !placementMode ? "bg-[#632CE5] text-[#212121] border-[#632CE5]" : "bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]"}`}><Move className="w-3 h-3" /> Rotate</button>
                   <button onClick={() => { const next = !previewSeparated; setPreviewSeparated(next); setFinalizedPreview(false); setPreviewValidation("idle"); if (next) { setPaintMode(false); setPlacementMode(false); } }} className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-colors ${previewSeparated ? "bg-[#632CE5] text-white border-[#632CE5] font-bold" : "bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]"}`} title="Visualizar peças separadas"><Layers className="w-3 h-3" /> Preview Separar</button>
                  <span className="w-px self-stretch bg-[#F9FAF4] mx-0.5" />
                  <button onClick={expandConnectedPaint} className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-[#E8E9E3] border border-[#E8E9E3] text-zinc-400 hover:text-[#212121] hover:border-[#632CE5] transition-colors" title="Preencher Parte Conectada"><PaintBucket className="w-3 h-3 text-[#632CE5]" /> Fill Connected</button>
                  <button onClick={fillRemainingWithActiveGroup} className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-[#E8E9E3] border border-[#E8E9E3] text-zinc-400 hover:text-[#212121] hover:border-[#632CE5] transition-colors"><Paintbrush className="w-3 h-3" /> Fill Remaining</button>
                  <button onClick={fillAllWithActiveGroup} className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-[#E8E9E3] border border-[#E8E9E3] text-zinc-400 hover:text-[#212121] hover:border-[#632CE5] transition-colors"><Check className="w-3 h-3" /> Fill All</button>
                </div>
                {previewSeparated ? (
                  <div className="flex items-center gap-6 flex-1 max-w-xs px-4">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider whitespace-nowrap flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Explosão / Offset</span>
                   <div className="flex-1 flex items-center gap-2">
                     <Slider value={[separationDistance]} onValueChange={(val) => setSeparationDistance(val[0])} min={0.0} max={4.0} step={0.05} className="flex-1" />
                     <span className="font-mono text-xs text-emerald-400 w-12 text-right font-bold">{(separationDistance ?? 1.0).toFixed(2)}x</span>
                   </div>
                   <button onClick={validatePreviewJoints} className={`px-3 py-2 text-[9px] font-black uppercase tracking-wider border transition-colors whitespace-nowrap ${finalizedPreview ? "bg-[#632CE5] text-white border-[#632CE5]" : "bg-[#632CE5] text-white border-[#632CE5] hover:bg-[#632CE5]"}`}><Check className="w-3.5 h-3.5 inline mr-1" /> {finalizedPreview ? "Finalizado" : "Finalizar"}</button>
                   {finalizedPreview && <span className={`text-[9px] font-bold uppercase whitespace-nowrap ${previewValidation === "valid" ? "text-emerald-400" : "text-amber-400"}`}>{previewValidation === "valid" ? "Encaixe OK" : "Revisar encaixe"}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-6 flex-1 max-w-xs px-4">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider whitespace-nowrap">Brush Size</span>
                    <div className="flex-1 flex items-center gap-2">
                      <Slider value={[brushRadius ?? 0.2]} onValueChange={(val) => { if (Array.isArray(val)) { if (val.length > 0 && typeof val[0] === "number" && !isNaN(val[0])) setBrushRadius(val[0]); } else if (typeof val === "number" && !isNaN(val)) setBrushRadius(val); }} min={0.05} max={1.0} step={0.01} className="flex-1" />
                      <span className="font-mono text-xs text-[#632CE5] w-12 text-right">{(brushRadius ?? 0.2).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={handleUndo} disabled={history.length === 0} className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${history.length > 0 ? "bg-[#F9FAF4] border-[#E8E9E3] text-zinc-100 hover:text-[#212121] hover:border-[#632CE5] hover:bg-[#E8E9E3] active:scale-95" : "bg-[#E8E9E3]/40 border-[#E2E3DD] text-zinc-600 cursor-not-allowed"}`}><Undo className="w-3 h-3" /> Undo {history.length > 0 && `(${history.length})`}</button>
                  <button onClick={resetPainting} className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-[#E8E9E3] border border-[#E8E9E3] text-zinc-400 hover:text-[#212121] transition-colors"><RotateCcw className="w-3 h-3" /> Clear All Paint</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <aside className="bg-[#F9FAF4] border-l border-[#E2E3DD] p-6 flex flex-col gap-8 overflow-y-auto">
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">01. Model Input</h3>
            <div className="space-y-4">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".stl,.obj,.fbx" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#E8E9E3] border border-[#E8E9E3] hover:border-[#632CE5] text-[#212121] py-4 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"><Upload className="w-4 h-4 text-[#632CE5]" /> Upload STL, OBJ or FBX</button>
              <div className="bg-white border border-[#E2E3DD] rounded overflow-hidden">
                <button onClick={() => setShowConversionSettings(!showConversionSettings)} className="w-full flex items-center justify-between p-3 text-[10px] uppercase font-black tracking-widest text-zinc-400 hover:text-[#1A1C19] transition-colors">
                  <div className="flex items-center gap-2"><Settings className={`w-3.5 h-3.5 ${showConversionSettings ? 'text-[#632CE5]' : 'text-zinc-600'}`} /> Configurações de Conversão</div>
                  <Plus className={`w-3 h-3 transition-transform duration-300 ${showConversionSettings ? 'rotate-45 text-[#632CE5]' : ''}`} />
                </button>
                {showConversionSettings && (
                  <div className="p-4 border-t border-[#E2E3DD] space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-bold text-zinc-500 block">Unidade de Medida</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setImportUnit("mm")} className={`py-2 text-[10px] font-bold uppercase border rounded transition-all ${importUnit === "mm" ? "bg-[#632CE5]/10 text-[#632CE5] border-[#632CE5]/30" : "bg-[#E8E9E3] text-zinc-500 border-[#E2E3DD] hover:text-[#212121]"}`}>Milímetros (mm)</button>
                        <button onClick={() => setImportUnit("inch")} className={`py-2 text-[10px] font-bold uppercase border rounded transition-all ${importUnit === "inch" ? "bg-[#632CE5]/10 text-[#632CE5] border-[#632CE5]/30" : "bg-[#E8E9E3] text-zinc-500 border-[#E2E3DD] hover:text-[#212121]"}`}>Polegadas (in)</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500"><span>Escala de Importação</span><span className="text-[#632CE5] font-mono">{importScale.toFixed(2)}x</span></div>
                      <Slider value={[importScale]} onValueChange={(val) => setImportScale(val[0])} min={0.01} max={10.0} step={0.01} />
                      <p className="text-[8px] text-zinc-600 italic">* Aplicada no próximo upload.</p>
                    </div>
                  </div>
                )}
              </div>
              {modelGeometry && (
                <div className="mt-2 bg-[#E8E9E3] p-3 border border-[#E8E9E3]">
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setCapSelection("base")} className={`flex-1 py-2 text-[10px] font-bold uppercase ${capSelection === 'base' ? 'bg-[#632CE5] text-white' : 'bg-[#F9FAF4] text-[#212121]'}`}>Base</button>
                    <button onClick={() => setCapSelection("top")} className={`flex-1 py-2 text-[10px] font-bold uppercase ${capSelection === 'top' ? 'bg-[#632CE5] text-white' : 'bg-[#F9FAF4] text-[#212121]'}`}>Topo</button>
                  </div>
                  <button onClick={capHollowVase} disabled={loadingCap} className={`w-full bg-[#E8E9E3] border border-[#E8E9E3] hover:border-[#00FF41] text-zinc-300 hover:text-[#212121] py-4 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${loadingCap ? 'opacity-50 cursor-not-allowed' : ''}`}><BoxSelect className={`w-4 h-4 text-[#00FF41] ${loadingCap ? 'animate-spin' : ''}`} /> {loadingCap ? "Processando..." : "Fechar Vaso Oco (Cap)"}</button>
                  {isCapped && (
                    <button onClick={downloadCappedModel} disabled={isDownloadingCapped} className={`w-full bg-[#00FF41] text-black border border-[#E8E9E3] hover:bg-[#00CC33] py-4 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all mt-2 ${isDownloadingCapped ? 'opacity-50 cursor-not-allowed' : ''}`}><Download className={`w-4 h-4 ${isDownloadingCapped ? 'animate-bounce' : ''}`} /> {isDownloadingCapped ? "Gerando..." : "Baixar Vaso Fechado (STL)"}</button>
                  )}
                </div>
              )}
              {modelGeometry && (
                <div className="grid grid-cols-2 gap-2 bg-[#E8E9E3] p-3 border border-[#E8E9E3] mt-2">
                  <div><span className="text-[9px] uppercase text-zinc-500 block">Triangles</span><span className="font-mono text-sm text-[#1A1C19]">{stats.faces.toLocaleString()}</span></div>
                  <div><span className="text-[9px] uppercase text-zinc-500 block">Status</span><span className="font-mono text-sm text-[#00FF41]">LOADED</span></div>
                </div>
              )}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center"><span>04. Parte Ativa</span><HelpTooltip text="Gerencie as partes." /></h3>
              <button onClick={() => { setAutoIsolateActive(!autoIsolateActive); setIsolateGroupId(null); }} className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 border rounded transition-all ${autoIsolateActive ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-500 hover:text-zinc-300"}`}><Layers className="w-3 h-3" /> Auto Highlight</button>
            </div>
            {modelGeometry ? (
              <div className="space-y-2.5">
                {groups.filter(g => g.id > 0).map(group => {
                  const isActive = activeGroupId === group.id;
                  const isIsolated = effectiveIsolateGroupId === group.id;
                  const jointTypeSetting = groupJointTypes[group.id] || 'auto';
                  return (
                    <div key={group.id} className="bg-white border border-[#E2E3DD] rounded p-2.5 space-y-2.5 transition-all">
                      <div className="flex gap-1.5 items-stretch">
                        <button onClick={() => { setActiveGroupId(group.id); setPaintMode(true); }} className={`flex-1 flex items-center justify-between p-2.5 bg-[#E8E9E3] border transition-all rounded ${isActive ? "border-[#632CE5]" : "border-[#E8E9E3] hover:border-[#E8E9E3]"}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded-full border border-white/10 shadow-inner shrink-0" style={{ backgroundColor: group.color }} />
                            <span className={`text-[11px] font-bold uppercase tracking-wider text-left ${isActive ? "text-[#632CE5]" : "text-zinc-300"}`}>{group.name}</span>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-[#632CE5] shrink-0" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); if (autoIsolateActive) { setAutoIsolateActive(false); setIsolateGroupId(isIsolated ? null : group.id); } else { setIsolateGroupId(isIsolated ? null : group.id); } }} className={`px-3 border rounded transition-colors flex items-center justify-center ${isIsolated ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-500 hover:text-[#212121]"}`} title={isIsolated ? "Mostrar tudo" : "Isolar"}>
                          {isIsolated ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                      {isActive && (
                        <div className="bg-[#E8E9E3] p-3 border border-[#E2E3DD] space-y-3 rounded">
                          <div>
                            <label className="text-[9px] uppercase text-zinc-500 font-bold flex items-center mb-1"><span>Nome da Peça</span><HelpTooltip text="Altere o nome." /></label>
                            <input type="text" value={group.name} onChange={(e) => updateGroupName(group.id, e.target.value)} className="w-full bg-[#F9FAF4] border border-[#E8E9E3] text-[#212121] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#632CE5] transition-all font-bold uppercase tracking-wider" placeholder="Nome..." />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase text-zinc-500 font-bold flex items-center mb-2"><span>Paleta de Cores</span><HelpTooltip text="Selecione a cor." /></label>
                            <div className="flex flex-wrap gap-2 items-center">
                              {PRESET_COLORS.map(c => (
                                <button key={c} onClick={() => updateGroupColor(group.id, c)} className={`w-5 h-5 rounded-full border transition-transform hover:scale-115 ${group.color.toLowerCase() === c.toLowerCase() ? "border-white scale-110 shadow-md ring-2 ring-[#632CE5]" : "border-transparent"}`} style={{ backgroundColor: c }} title={c} />
                              ))}
                              <label className="relative w-5 h-5 rounded-full cursor-pointer border border-[#E8E9E3] hover:border-zinc-400 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 transition-transform hover:scale-115 flex items-center justify-center overflow-hidden" title="Cor personalizada">
                                <input type="color" value={group.color} onChange={(e) => updateGroupColor(group.id, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150" />
                                <span className="text-[10px] text-[#1A1C19] font-bold pointer-events-none drop-shadow-md">+</span>
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase text-zinc-500 font-bold flex items-center mb-2">
                              <span>Tipo de Encaixe / Joint Type</span>
                              <HelpTooltip text="Defina se esta peça será MACHO (pino) ou FÊMEA (furo). 'Auto' usa menor ID = fêmea." />
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              <button onClick={() => setGroupJointType(group.id, 'female')} className={`py-2 text-[9px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-1 ${jointTypeSetting === 'female' ? 'bg-[#D500F9]/20 text-[#D500F9] border-[#D500F9]' : 'bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]'}`}>
                                <Circle className="w-3 h-3" /> Fêmea
                              </button>
                              <button onClick={() => setGroupJointType(group.id, 'auto')} className={`py-2 text-[9px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-1 ${jointTypeSetting === 'auto' ? 'bg-[#F9FAF4] text-[#212121] border-[#E8E9E3]' : 'bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]'}`}>
                                <Settings className="w-3 h-3" /> Auto
                              </button>
                              <button onClick={() => setGroupJointType(group.id, 'male')} className={`py-2 text-[9px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-1 ${jointTypeSetting === 'male' ? 'bg-[#632CE5]/20 text-[#632CE5] border-[#632CE5]' : 'bg-[#E8E9E3] text-zinc-400 border-[#E8E9E3] hover:text-[#212121]'}`}>
                                <Square className="w-3 h-3" /> Macho
                              </button>
                            </div>
                            <p className="text-[8px] text-zinc-600 mt-1.5 leading-relaxed">
                              {jointTypeSetting === 'female' && '⚬ Esta peça receberá o FURO (socket)'}
                              {jointTypeSetting === 'male' && '⚲ Esta peça terá o PINO (peg)'}
                              {jointTypeSetting === 'auto' && ' Automático: menor ID = fêmea'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={addCustomGroup} className="w-full mt-2 border border-dashed border-[#E8E9E3] hover:border-[#632CE5] bg-[#E8E9E3]/40 hover:bg-[#632CE5]/5 p-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-[#212121] flex items-center justify-center gap-1.5 transition-all rounded shadow-sm"><Plus className="w-4 h-4 text-[#632CE5]" /> Adicionar Nova Peça</button>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-[#E8E9E3] rounded bg-[#F9FAF4] text-center text-[10px] text-zinc-500 uppercase tracking-wider">Upload a 3D model first</div>
            )}
          </section>
          {modelGeometry && (
            <section className="border-t border-[#E2E3DD] pt-6">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-[#632CE5]" /> 05. Encaixes & Conectores</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 leading-relaxed">Snap-fit hexagonal com folga configurável, ímãs ou posicionamento manual.</p>
                <div className="bg-[#632CE5]/5 border border-[#632CE5]/20 rounded p-2 text-[8px] leading-relaxed text-zinc-400">
                  <strong className="text-[#632CE5]">Fluxo recomendado:</strong> pinte as partes, selecione uma fronteira, crie o encaixe e confira o pino e o reforço no Preview Separar antes de exportar.
                </div>
                {jointConfigurationWarning && <div className="bg-[#FF1744]/10 border border-[#FF1744]/30 rounded p-2 text-[8px] leading-relaxed text-[#FF8A9A]">{jointConfigurationWarning}</div>}
                <div className="bg-white border border-[#E2E3DD] rounded p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setJointType("default")} className={`py-2 px-2 rounded border text-[9px] font-bold uppercase flex items-center justify-center gap-1.5 ${jointType === "default" ? "border-[#632CE5] text-[#212121] bg-[#632CE5]/5" : "border-[#E8E9E3] text-zinc-500 bg-white/40"}`}><Settings className="w-3 h-3 text-[#632CE5]/60" /> Snap-Fit Hex</button>
                  <button onClick={() => setJointType("magnet")} className={`py-2 px-2 rounded border text-[9px] font-bold uppercase flex items-center justify-center gap-1.5 ${jointType === "magnet" ? "border-[#632CE5] text-[#212121] bg-[#632CE5]/5" : "border-[#E8E9E3] text-zinc-500 bg-white/40"}`}><Sparkles className="w-3 h-3 text-[#632CE5]" /> Ímã</button>
                </div>
                <div className="bg-white/40 p-2 rounded border border-[#E2E3DD] text-[8.5px] text-zinc-400">
                  {jointType === "magnet"
                    ? <p className="text-[#632CE5]">✨ Cavidades para ímã em ambos os lados da junta</p>
                    : <p>📦 Pino/furo hexagonal (6 lados) com folga ajustável</p>}
                </div>
                {jointType === "magnet" ? (
                  <>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-2.5">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Diâmetro Ímã</span><span className="text-[#FFD700] font-mono">{jointSizes.magnetDiameter.toFixed(2)} mm</span></div>
                      <Slider value={[jointSizes.magnetDiameter]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, magnetDiameter: n })); }} min={1.0} max={12.0} step={0.1} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-2.5">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Profundidade Ímã</span><span className="text-[#FFD700] font-mono">{jointSizes.magnetDepth.toFixed(2)} mm</span></div>
                      <Slider value={[jointSizes.magnetDepth]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, magnetDepth: n })); }} min={0.5} max={8.0} step={0.1} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-2.5">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Diâmetro Pino</span><span className="text-[#632CE5] font-mono">{jointSizes.pegDiameter.toFixed(2)} mm</span></div>
                      <Slider value={[jointSizes.pegDiameter]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, pegDiameter: n })); }} min={1.0} max={12.0} step={0.1} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-2.5">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Profundidade Pino</span><span className="text-[#632CE5] font-mono">{jointSizes.pegLength.toFixed(2)} mm</span></div>
                      <Slider value={[jointSizes.pegLength]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, pegLength: n })); }} min={1.0} max={20.0} step={0.1} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-2.5">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Folga / Tolerância</span><span className="text-[#00FF41] font-mono">{jointSizes.fitTolerance.toFixed(2)} mm</span></div>
                      <Slider value={[jointSizes.fitTolerance]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, fitTolerance: n })); }} min={0.0} max={0.8} step={0.01} />
                      <p className="text-[8px] text-zinc-600">Soma 2× ao diâmetro e 1× à profundidade do furo.</p>
                    </div>
                    <div className="border-t border-[#E2E3DD]/60 pt-2.5 space-y-2">
                      <p className="text-[9px] uppercase font-bold text-[#FF1744]">Reforço da Fêmea</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Diâmetro externo</span><span className="text-[#FF1744] font-mono">{jointSizes.reinforcementDiameter.toFixed(2)} mm</span></div>
                        <Slider value={[jointSizes.reinforcementDiameter]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, reinforcementDiameter: n })); }} min={jointSizes.pegDiameter + 2} max={20} step={0.1} />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Altura</span><span className="text-[#FF1744] font-mono">{jointSizes.reinforcementHeight.toFixed(2)} mm</span></div>
                        <Slider value={[jointSizes.reinforcementHeight]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, reinforcementHeight: n })); }} min={0.8} max={8} step={0.1} />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Parede mínima</span><span className="text-[#FF1744] font-mono">{jointSizes.reinforcementWall.toFixed(2)} mm</span></div>
                        <Slider value={[jointSizes.reinforcementWall]} onValueChange={(val) => { const n = Array.isArray(val) ? val[0] : val; if (typeof n === "number" && !isNaN(n)) setJointSizes(prev => ({ ...prev, reinforcementWall: n })); }} min={0.6} max={3} step={0.1} />
                      </div>
                      <p className="text-[8px] text-zinc-600">A saliência reforçada será exportada junto com a peça fêmea.</p>
                    </div>
                  </>
                )}
                <div className="border-t border-[#E2E3DD]/60 pt-3 space-y-2">
                  <button onClick={() => { const next = !placementMode; setPlacementMode(next); if (next) setPaintMode(false); }} className={`w-full flex items-center justify-center gap-2 p-2.5 rounded border text-[10px] font-bold uppercase tracking-wider transition-all ${placementMode ? "bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700]" : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-300 hover:border-[#FFD700] hover:text-[#212121]"}`}>
                    <Circle className="w-3.5 h-3.5" /> {placementMode ? "Colocando... Clique na junta (Ativo)" : "Colocar Encaixe Manual"}
                  </button>
                  <p className="text-[8px] text-zinc-600 leading-relaxed">No Preview Separar, clique diretamente na superfície da peça para criar o encaixe nessa fronteira. Clique num marcador dourado/ciano/vermelho para selecioná-lo e ajustar a posição.</p>
                </div>
                {manualJoints.length > 0 && (
                  <div className="border-t border-[#E2E3DD]/60 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-[#FFD700] flex items-center gap-1"><Sparkles className="w-3 h-3" /> Encaixes Manuais ({manualJoints.length})</span>
                      <button onClick={() => setManualJoints([])} className="flex items-center gap-1 px-2 py-1 rounded border border-[#E8E9E3] bg-[#E8E9E3] text-zinc-400 hover:text-[#FF1744] hover:border-[#FF1744]/40 text-[8px] font-bold uppercase transition-all"><Trash2 className="w-3 h-3" /> Limpar</button>
                    </div>
                    {manualJoints.map(j => (
                      <div key={j.id} className="flex items-center justify-between gap-2 p-2 bg-[#E8E9E3] rounded border border-[#E2E3DD] text-[9px] font-mono text-zinc-300">
                        <span className="truncate">{getGroupName(j.groupA)} ⇄ {getGroupName(j.groupB)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setSelectedManualJointId(j.id)} className={`px-1.5 py-1 rounded border text-[8px] uppercase font-bold ${selectedManualJointId === j.id ? "border-[#FFD700] text-[#FFD700]" : "border-[#E8E9E3] text-zinc-500 hover:text-[#1A1C19]"}`}>Ajustar</button>
                          <button onClick={() => { setManualJoints(prev => prev.filter(x => x.id !== j.id)); if (selectedManualJointId === j.id) setSelectedManualJointId(null); }} className="p-1 rounded text-zinc-500 hover:text-[#FF1744] transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                    {selectedManualJoint && jointBounds && (
                      <div className="space-y-2 p-2 bg-[#FFD700]/5 rounded border border-[#FFD700]/30">
                         <div className="flex items-center justify-between text-[8px] uppercase font-bold text-[#FFD700]"><span>Ajustar encaixe</span><button onClick={() => setSelectedManualJointId(null)} className="text-zinc-500 hover:text-[#1A1C19]">Fechar</button></div>
                         <div className="grid grid-cols-3 gap-1">
                           {([
                             ["translate", "Mover"],
                             ["rotate", "Rotacionar"],
                             ["scale", "Escalar"],
                           ] as const).map(([mode, label]) => (
                             <button key={mode} onClick={() => setTransformMode(mode)} className={`py-1.5 rounded border text-[8px] font-bold uppercase ${transformMode === mode ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]" : "border-[#E8E9E3] text-zinc-500 hover:text-[#1A1C19]"}`}>
                               {label}
                             </button>
                           ))}
                         </div>
                         <p className="text-[8px] text-zinc-500">Use o gizmo no preview para ajustar os eixos X, Y e Z.</p>
                        {(["x", "y", "z"] as const).map(axis => {
                          const min = jointBounds.min[axis];
                          const max = jointBounds.max[axis];
                          const value = selectedManualJoint.position[axis];
                          return (
                            <div key={axis} className="space-y-1">
                              <div className="flex justify-between items-center text-[8px] uppercase text-zinc-400"><span>Eixo {axis.toUpperCase()}</span><input type="number" value={value.toFixed(2)} onChange={event => updateManualJointPosition(axis, Number(event.target.value))} step="0.01" className="w-20 bg-[#E8E9E3] border border-[#E8E9E3] rounded px-1 py-0.5 text-right font-mono text-[#FFD700]" /></div>
                              <input
                                type="range"
                                value={Math.min(max, Math.max(min, value))}
                                onChange={event => updateManualJointPosition(axis, Number(event.currentTarget.value))}
                                min={min}
                                max={max}
                                step="0.01"
                                className="w-full h-1.5 accent-[#FFD700] cursor-pointer"
                                aria-label={`Posição ${axis.toUpperCase()} do encaixe`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
          {modelGeometry && (
            <section className="border-t border-[#E2E3DD] pt-6">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-[#632CE5]" /> 06. Auto-Detecção</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 leading-relaxed">Segmentação automática.</p>
              <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded p-3 mb-4 space-y-3">
                <div><span className="text-[8px] font-mono text-[#632CE5] uppercase tracking-widest block font-extrabold">Filtro Anatômico</span><span className="text-[9.5px] text-zinc-500 block mt-0.5">Escolha as partes:</span></div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => setSegmentLegs(!segmentLegs)} className={`py-1.5 px-1 rounded border text-[8.5px] font-bold uppercase ${segmentLegs ? "border-[#632CE5] text-[#212121] bg-[#632CE5]/5" : "border-[#E8E9E3] text-zinc-500 bg-white/40"}`}>Pernas</button>
                  <button onClick={() => setSegmentArms(!segmentArms)} className={`py-1.5 px-1 rounded border text-[8.5px] font-bold uppercase ${segmentArms ? "border-[#632CE5] text-[#212121] bg-[#632CE5]/5" : "border-[#E8E9E3] text-zinc-500 bg-white/40"}`}>Braços</button>
                  <button onClick={() => setSegmentTorso(!segmentTorso)} className={`py-1.5 px-1 rounded border text-[8.5px] font-bold uppercase ${segmentTorso ? "border-[#632CE5] text-[#212121] bg-[#632CE5]/5" : "border-[#E8E9E3] text-zinc-500 bg-white/40"}`}>Tronco</button>
                </div>
              </div>
              <div className="space-y-2">
                {stats.faces > 50000 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div><p className="text-[10px] font-bold uppercase text-amber-500">Modelo Complexo</p><p className="text-[9px] text-zinc-400">{stats.faces.toLocaleString()} faces. Use Divisão Inteligente.</p></div>
                  </div>
                )}
                <button onClick={autoSegmentSmart} className="w-full flex flex-col items-start gap-1.5 p-3 bg-gradient-to-r from-zinc-900 to-[#111] border border-[#632CE5]/30 hover:border-[#632CE5] hover:bg-[#E8E9E3] transition-all rounded text-left">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-[#632CE5]"><Sparkles className="w-3.5 h-3.5" /> Divisão Inteligente</div>
                  <span className="text-[9px] text-zinc-400 uppercase">Separação por posição.</span>
                </button>
                <button onClick={autoSegmentAnatomy} className="w-full flex flex-col items-start gap-1.5 p-3 bg-white border border-[#E8E9E3] hover:border-[#632CE5] hover:bg-[#E8E9E3] transition-all rounded text-left">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-200"><Sparkles className="w-3.5 h-3.5 text-[#632CE5]" /> Segmentação Anatômica</div>
                  <span className="text-[9px] text-zinc-500 uppercase">Braços/Pernas/Tronco.</span>
                </button>
                <button onClick={autoSegmentShells} className="w-full flex flex-col items-start gap-1.5 p-3 bg-white border border-[#E8E9E3] hover:border-[#632CE5] hover:bg-[#E8E9E3] transition-all rounded text-left">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-200"><Layers className="w-3.5 h-3.5 text-[#632CE5]" /> Detectar Shells</div>
                  <span className="text-[9px] text-zinc-500 uppercase">Peças desconectadas.</span>
                </button>
              </div>
            </section>
          )}
          {modelGeometry && (
            <section className="border-t border-[#E2E3DD] pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2"><Ruler className="w-3.5 h-3.5 text-[#632CE5]" /> 07. Marca d'água 3D</h3>
                <button onClick={() => setWatermarkEnabled(!watermarkEnabled)} className={`px-2.5 py-1 text-[9px] font-black uppercase border rounded ${watermarkEnabled ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-500"}`}>{watermarkEnabled ? "Ativado" : "Desativado"}</button>
              </div>
              {watermarkEnabled && (
                <div className="bg-white border border-[#E2E3DD] rounded p-4 space-y-4 font-sans">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Texto</label>
                    <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value.toUpperCase().slice(0, 32))} placeholder="VERTICE..." className="w-full bg-[#E8E9E3] border border-[#E2E3DD] focus:border-[#632CE5] text-xs text-[#212121] rounded px-3 py-2 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Superfície</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["base", "top", "front", "back", "left", "right"] as const).map(p => (
                        <button key={p} onClick={() => setWatermarkPlacement(p)} className={`py-1.5 px-1 text-[8px] font-bold uppercase border rounded ${watermarkPlacement === p ? "bg-[#632CE5] text-[#212121] border-[#632CE5]" : "bg-[#E8E9E3] text-zinc-400 border-[#E2E3DD] hover:text-[#212121]"}`}>{p === "base" ? "Base" : p === "top" ? "Topo" : p === "front" ? "Frente" : p === "back" ? "Trás" : p === "left" ? "Esq" : "Dir"}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Estilo</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["raised", "recessed", "overlay"] as const).map(s => (
                        <button key={s} onClick={() => setWatermarkStyle(s)} className={`py-1.5 px-1 text-[8px] font-bold uppercase border rounded ${watermarkStyle === s ? "bg-[#632CE5] text-[#212121] border-[#632CE5]" : "bg-[#E8E9E3] text-zinc-400 border-[#E2E3DD] hover:text-[#212121]"}`}>{s === "raised" ? "Relevo" : s === "recessed" ? "Baixo Relevo" : "Overlay"}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400"><span>Tamanho</span><span className="text-[#632CE5] font-mono">{watermarkSize.toFixed(2)}x</span></div>
                    <Slider value={[watermarkSize]} onValueChange={(val) => setWatermarkSize(val[0])} min={0.05} max={1.5} step={0.01} />
                  </div>
                  <div className="border-t border-[#E2E3DD]/60 pt-3 space-y-3">
                    <span className="text-[9px] uppercase font-black text-zinc-500 block">Posição</span>
                    {(["X", "Y", "Z"] as const).map(axis => {
                      const val = axis === "X" ? watermarkOffsetX : axis === "Y" ? watermarkOffsetY : watermarkOffsetZ;
                      const setVal = axis === "X" ? setWatermarkOffsetX : axis === "Y" ? setWatermarkOffsetY : setWatermarkOffsetZ;
                      const dim = axis === "X" ? modelDimensions.x : axis === "Y" ? modelDimensions.y : modelDimensions.z;
                      return (
                        <div key={axis} className="space-y-1">
                          <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400"><span>Offset {axis}</span><span className="text-zinc-500 font-mono">{val.toFixed(2)}</span></div>
                          <Slider value={[val]} onValueChange={(v) => setVal(v[0])} min={-Math.max(2, dim)} max={Math.max(2, dim)} step={0.02} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#E2E3DD]/60 pt-3 space-y-3">
                    <span className="text-[9px] uppercase font-black text-zinc-500 block">Rotação</span>
                    {(["X", "Y", "Z"] as const).map(axis => {
                      const val = axis === "X" ? watermarkRotationX : axis === "Y" ? watermarkRotationY : watermarkRotationZ;
                      const setVal = axis === "X" ? setWatermarkRotationX : axis === "Y" ? setWatermarkRotationY : setWatermarkRotationZ;
                      return (
                        <div key={axis} className="space-y-1">
                          <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400"><span>Rotação {axis}</span><span className="text-zinc-500 font-mono">{val}°</span></div>
                          <Slider value={[val]} onValueChange={(v) => setVal(v[0])} min={-180} max={180} step={1} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                    <label className="text-[9px] uppercase font-bold text-zinc-400 block">Cor</label>
                    <div className="flex gap-2">
                      {["#632CE5", "#FF1744", "#00E676", "#FFEB3B", "#FFFFFF", "#888888"].map(c => (
                        <button key={c} onClick={() => setWatermarkColor(c)} className={`w-5 h-5 rounded-full border ${watermarkColor === c ? "border-white scale-110 shadow" : "border-transparent opacity-60 hover:opacity-100"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          {modelGeometry && (
            <section className="flex-1 flex flex-col justify-end border-t border-[#E2E3DD] pt-6">
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold"> 08. Exportar</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 leading-relaxed">Export each colored region as STL.</p>
              <div className="bg-white border border-[#E2E3DD] rounded p-4 mb-5 space-y-4 font-sans">
                <div className="flex justify-between items-center">
                  <div><span className="text-[10px] uppercase font-bold text-zinc-300 block">Explodir Peças</span><span className="text-[9px] text-zinc-500">Visualize separadas</span></div>
                  <button onClick={() => { const next = !previewSeparated; setPreviewSeparated(next); if (next) setPaintMode(false); }} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded border ${previewSeparated ? "bg-emerald-400/20 border-emerald-400 text-emerald-400" : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-400 hover:text-[#212121]"}`}>{previewSeparated ? "ATIVADO" : "DESATIVADO"}</button>
                </div>
                {previewSeparated && (
                  <div className="space-y-2 border-t border-[#E2E3DD]/60 pt-3">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Distância</span><span className="text-emerald-400 font-mono font-bold">{(separationDistance ?? 1.0).toFixed(2)}x</span></div>
                    <Slider value={[separationDistance]} onValueChange={(val) => setSeparationDistance(val[0])} min={0.0} max={4.0} step={0.05} />
                    <span className="text-[8px] text-zinc-500 block leading-relaxed">Arraste o slider para afastar ou aproximar as partes e verificar os encaixes.</span>
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-[#E2E3DD]/60">
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-400"><div className="w-3 h-3 rounded-full bg-[#632CE5]" /> Pino Hex (Macho)</div>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-400"><div className="w-3 h-3 rounded-full bg-[#FF1744]" /> Furo Hex (Fêmea)</div>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-400"><div className="w-3 h-3 rounded-full bg-[#FFD700]" /> Ímã</div>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={exportAllSeparatedParts} disabled={!modelGeometry || isExporting !== null} className="w-full bg-[#632CE5] hover:bg-[#632CE5] text-black font-black uppercase text-[11px] py-4 px-4 tracking-widest flex items-center justify-center gap-2 transition-all mb-4 shadow-[0_0_15px_rgba(124,58,237,0.2)] disabled:opacity-40"><Download className="w-4 h-4 text-black" /> Exportar Todas as Peças (.stl)</button>
              <div className="space-y-2">
                {groups.map(group => {
                  const countOfGroup = vertexGroups.filter(g => g === group.id).length;
                  const isGroupPainted = countOfGroup > 0 || group.id === 0;
                  return (
                    <button key={group.id} disabled={!isGroupPainted || !modelGeometry || isExporting !== null} onClick={() => exportSeparatedPart(group.id)} className="w-full flex flex-col p-3.5 bg-white border border-[#E8E9E3] hover:border-[#632CE5] hover:bg-[#E8E9E3] transition-all group disabled:opacity-40 disabled:hover:border-[#E8E9E3] disabled:hover:bg-white">
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: group.color }} />
                          <span className="text-xs font-bold uppercase text-zinc-300 group-hover:text-[#1A1C19] transition-colors">{group.id === 0 ? "Exportar Restante (Cinza)" : `Exportar ${group.name}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-500 font-mono">{countOfGroup > 0 ? `${((countOfGroup / vertexGroups.length) * 100).toFixed(0)}%` : "0%"}</span>
                          {isExporting === group.id ? <RefreshCw className="w-4 h-4 text-[#632CE5] animate-spin" /> : <Download className="w-4 h-4 text-zinc-500 group-hover:text-[#632CE5] transition-colors" />}
                        </div>
                      </div>
                      {groupJointRoles.get(group.id) && (
                        <span className="text-[8px] text-[#632CE5] font-mono mt-1.5 ml-6 text-left">{groupJointRoles.get(group.id)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {modelGeometry && (
            <section className="border-t border-[#E2E3DD] pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2"><Printer className="w-4 h-4 text-[#632CE5]" /> 02. Calculadora de Preços</h3>
                <button onClick={handleDownloadCSV} className="flex items-center gap-1.5 px-2 py-1 bg-[#E8E9E3] border border-[#E8E9E3] rounded text-[9px] uppercase font-bold text-zinc-400 hover:text-[#632CE5] hover:border-[#632CE5]/30 transition-all group"><FileJson className="w-3 h-3 group-hover:scale-110 transition-transform" /> CSV</button>
              </div>
              <div className="flex bg-white p-1 rounded border border-[#E2E3DD] mb-4 font-sans">
                <button onClick={() => { setEstimatorType("SLA"); const d = MATERIALS.find(m => m.type === "SLA"); if (d) { setSelectedMaterialId(d.id); setMaterialDensity(d.density); setResinCostPerKg(d.defaultCost); } }} className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${estimatorType === "SLA" ? "bg-cyan-500/10 text-[#632CE5] border border-cyan-500/20" : "text-zinc-500 hover:text-zinc-300 border border-transparent"}`}><Printer className="w-3.5 h-3.5" /> SLA (Resina)</button>
                <button onClick={() => { setEstimatorType("FDM"); const d = MATERIALS.find(m => m.type === "FDM"); if (d) { setSelectedMaterialId(d.id); setMaterialDensity(d.density); setFdmFilamentCostPerKg(d.defaultCost); } }} className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${estimatorType === "FDM" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-zinc-500 hover:text-zinc-300 border border-transparent"}`}><Sliders className="w-3.5 h-3.5" /> FDM (Filamento)</button>
              </div>
              <div className="mb-4 space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-500 block px-1">Perfil de Material</label>
                <select value={selectedMaterialId} onChange={(e) => { const m = MATERIALS.find(x => x.id === e.target.value); if (m) { setSelectedMaterialId(m.id); setMaterialDensity(m.density); if (m.type === "SLA") setResinCostPerKg(m.defaultCost); else setFdmFilamentCostPerKg(m.defaultCost); } }} className="w-full bg-white border border-[#E8E9E3] p-2.5 rounded text-[10px] text-zinc-200 font-bold uppercase focus:outline-none focus:border-[#632CE5]">
                  {MATERIALS.filter(m => m.type === estimatorType).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-black px-1">
                  <span>Densidade: {materialDensity.toFixed(2)} g/cm³</span>
                  <span>Preço: R$ {(estimatorType === "SLA" ? resinCostPerKg : fdmFilamentCostPerKg).toFixed(0)}/kg</span>
                </div>
              </div>
              <div className="bg-white border border-[#E2E3DD] rounded p-4 space-y-4 mb-4 font-sans relative overflow-hidden">
                {isEstimating && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E8E9E3] z-20"><div className={`h-full transition-all duration-100 ease-out ${estimatorType === "SLA" ? "bg-gradient-to-r from-cyan-500 to-[#632CE5]" : "bg-gradient-to-r from-emerald-500 to-emerald-400"}`} style={{ width: `${estimateProgress}%` }} /></div>
                    <div className="absolute inset-0 bg-[#E8E9E3]/85 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-3 z-10 select-none">
                      <div className="flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 animate-spin ${estimatorType === "SLA" ? "text-[#632CE5]" : "text-emerald-400"}`} /><span className="text-[9px] uppercase font-bold tracking-widest text-zinc-300">{estimatorType === "SLA" ? "Fatiando SLA..." : "Fatiando FDM..."}</span></div>
                      <div className="text-center space-y-1 w-full max-w-[220px] px-4">
                        <div className="flex justify-between items-center text-[8px] uppercase font-mono text-zinc-500"><span>Status</span><span className={`${estimatorType === "SLA" ? "text-[#632CE5]" : "text-emerald-400"} font-bold`}>{estimateProgress}%</span></div>
                        <div className="w-full h-[3px] bg-[#E8E9E3] rounded-full overflow-hidden"><div className={`h-full transition-all duration-75 ${estimatorType === "SLA" ? "bg-[#632CE5]" : "bg-emerald-400"}`} style={{ width: `${estimateProgress}%` }} /></div>
                        <p className="text-[8px] font-medium text-zinc-400 uppercase tracking-wider text-center pt-1.5 truncate">{getSlicingStatus(estimateProgress)}</p>
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-3 gap-2 text-center pb-3 border-b border-[#E2E3DD]">
                  <div className="bg-[#E8E9E3]/40 p-2 rounded border border-[#E2E3DD]/40"><span className="text-[8px] uppercase text-zinc-500 block font-bold">X</span><span className="font-mono text-xs text-[#212121] font-black block mt-1">{scaledX.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">mm</span></span></div>
                  <div className="bg-[#E8E9E3]/40 p-2 rounded border border-[#E2E3DD]/40"><span className="text-[8px] uppercase text-zinc-500 block font-bold">Y</span><span className="font-mono text-xs text-[#212121] font-black block mt-1">{scaledY.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">mm</span></span></div>
                  <div className="bg-[#E8E9E3]/40 p-2 rounded border border-[#E2E3DD]/40"><span className="text-[8px] uppercase text-zinc-500 block font-bold">Z</span><span className="font-mono text-xs text-[#212121] font-black block mt-1">{scaledZ.toFixed(1)} <span className="text-[9px] text-zinc-500 font-normal">mm</span></span></div>
                </div>
                {estimatorType === "SLA" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Volume</span><span className="font-mono text-sm text-emerald-400 font-bold">{(isHollow ? modelDimensions.volume * 0.30 : modelDimensions.volume).toFixed(2)} mL</span></div>
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Peso</span><span className="font-mono text-sm text-cyan-400 font-bold">{((isHollow ? modelDimensions.volume * 0.30 : modelDimensions.volume) * materialDensity).toFixed(1)} g</span></div>
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Tempo</span><span className="font-mono text-sm text-purple-400 font-bold">{Math.floor((Math.ceil(scaledZ / layerHeight) * (exposureTime + 5.0) + 120) / 3600)}h</span></div>
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Custo</span><span className="font-mono text-sm text-yellow-400 font-bold">${(((isHollow ? modelDimensions.volume * 0.30 : modelDimensions.volume) * materialDensity) / 1000.0 * resinCostPerKg).toFixed(2)}</span></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Volume</span><span className="font-mono text-sm text-emerald-400 font-bold">{(modelDimensions.volume * Math.max(0.05, Math.min(0.8, 0.08 * fdmWallCount) + (1.0 - Math.min(0.8, 0.08 * fdmWallCount)) * fdmInfill / 100.0)).toFixed(2)} cm³</span></div>
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Peso</span><span className="font-mono text-sm text-cyan-400 font-bold">{(modelDimensions.volume * Math.max(0.05, Math.min(0.8, 0.08 * fdmWallCount) + (1.0 - Math.min(0.8, 0.08 * fdmWallCount)) * fdmInfill / 100.0) * materialDensity).toFixed(1)} g</span></div>
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Tempo</span><span className="font-mono text-sm text-purple-400 font-bold">~{Math.floor(((modelDimensions.volume * 1000.0) / (0.42 * fdmLayerHeight * fdmPrintSpeed || 1.0)) * 1.30 / 3600)}h</span></div>
                    <div className="bg-[#E8E9E3]/80 p-3 rounded border border-[#E2E3DD]/60"><span className="text-[8px] uppercase text-zinc-500 block">Custo</span><span className="font-mono text-sm text-yellow-400 font-bold">${((modelDimensions.volume * Math.max(0.05, Math.min(0.8, 0.08 * fdmWallCount) + (1.0 - Math.min(0.8, 0.08 * fdmWallCount)) * fdmInfill / 100.0) * materialDensity) / 1000.0 * fdmFilamentCostPerKg).toFixed(2)}</span></div>
                  </div>
                )}
              </div>
              <div className="space-y-4 bg-[#E8E9E3] p-3.5 border border-[#E2E3DD] rounded font-sans">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-400">
                    <span className="flex items-center">Escala / Scale<HelpTooltip text="Ajusta o tamanho final." /></span>
                    <div className="flex items-center bg-[#E8E9E3] border border-[#E2E3DD] rounded px-1.5 py-0.5 w-24">
                      <input type="number" value={printScale} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setPrintScale(Math.max(1, Math.min(2000, v))); }} className="w-full bg-transparent text-right text-xs font-mono text-[#632CE5] focus:outline-none" min="1" max="2000" step="0.1" />
                      <span className="text-[10px] text-zinc-500 font-bold ml-1">%</span>
                    </div>
                  </div>
                  <Slider value={[printScale]} onValueChange={(v) => setPrintScale(v[0])} min={1} max={500} step={1} />
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase font-bold text-zinc-500 block">Atalhos:</span>
                    <div className="grid grid-cols-6 gap-1">
                      {[25, 50, 75, 100, 150, 200].map(p => (
                        <button key={p} onClick={() => setPrintScale(p)} className={`py-1 text-[8px] font-mono uppercase border rounded transition-all cursor-pointer text-center ${printScale === p ? "bg-[#632CE5] text-[#212121] border-[#632CE5] font-bold" : "bg-[#E8E9E3] text-zinc-400 border-[#E2E3DD] hover:text-[#212121]"}`}>{p}%</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 pt-2.5 border-t border-[#E2E3DD]/60">
                    <span className="text-[8px] uppercase font-bold text-[#632CE5] flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> Proporções de Miniatura</span>
                    <div className="grid grid-cols-2 gap-1 bg-[#E8E9E3] p-0.5 rounded border border-[#E2E3DD]">
                      <button onClick={() => setMiniatureScaleMode("human")} className={`py-1 px-1 text-[8px] font-bold uppercase rounded transition-all cursor-pointer text-center ${miniatureScaleMode === "human" ? "bg-[#632CE5] text-white" : "text-zinc-400 hover:text-white"}`}>Base Humana (1.80m)</button>
                      <button onClick={() => setMiniatureScaleMode("direct")} className={`py-1 px-1 text-[8px] font-bold uppercase rounded transition-all cursor-pointer text-center ${miniatureScaleMode === "direct" ? "bg-[#632CE5] text-white" : "text-zinc-400 hover:text-white"}`}>Direto do Arquivo (1:1)</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[{ label: "1/8", value: 8 }, { label: "1/12", value: 12 }, { label: "1/16", value: 16 }, { label: "1/24", value: 24 }, { label: "1/32", value: 32 }, { label: "1/35", value: 35 }, { label: "1/48", value: 48 }, { label: "1/56", value: 56 }, { label: "1/64", value: 64 }, { label: "1/72", value: 72 }, { label: "1/100", value: 100 }].map(item => {
                        const targetScale = miniatureScaleMode === "human" && originalZ > 0 ? (1800.0 / item.value / originalZ) * 100.0 : 100.0 / item.value;
                        return <button key={item.label} onClick={() => applyMiniatureScale(item.value)} className={`p-1 border rounded text-[9px] font-black ${Math.abs(printScale - targetScale) < 0.2 ? "bg-[#632CE5]/20 border-[#632CE5] text-[#632CE5]" : "bg-[#E8E9E3] text-zinc-400 border-[#E2E3DD] hover:text-[#212121]"}`}>{item.label}</button>;
                      })}
                    </div>
                  </div>
                </div>
                {estimatorType === "SLA" ? (
                  <>
                    <div className="flex items-center justify-between border-t border-[#E2E3DD]/60 pt-3">
                      <div><span className="text-[10px] uppercase font-bold text-zinc-400">Modelo Oco</span><span className="text-[9px] text-zinc-500 block">Parede de 2mm</span></div>
                      <button onClick={() => setIsHollow(!isHollow)} className={`px-3 py-1.5 text-[9px] font-bold uppercase rounded border ${isHollow ? "bg-emerald-400/20 border-emerald-400 text-emerald-400" : "bg-white border-[#E8E9E3] text-zinc-400"}`}>{isHollow ? "Ativo" : "Não"}</button>
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Camada</span><span className="text-purple-400 font-mono">{(layerHeight * 1000).toFixed(0)} μm</span></div>
                      <Slider value={[layerHeight]} onValueChange={(v) => setLayerHeight(v[0])} min={0.02} max={0.15} step={0.01} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Exposição</span><span className="text-yellow-400 font-mono">{exposureTime}s</span></div>
                      <Slider value={[exposureTime]} onValueChange={(v) => setExposureTime(v[0])} min={1.0} max={10.0} step={0.1} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Preço Resina</span><span className="text-zinc-300 font-mono">${resinCostPerKg}/kg</span></div>
                      <Slider value={[resinCostPerKg]} onValueChange={(v) => setResinCostPerKg(v[0])} min={15} max={120} step={1} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Infill</span><span className="text-emerald-400 font-mono">{fdmInfill}%</span></div>
                      <Slider value={[fdmInfill]} onValueChange={(v) => setFdmInfill(v[0])} min={0} max={100} step={5} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Paredes</span><span className="text-cyan-400 font-mono">{fdmWallCount}</span></div>
                      <Slider value={[fdmWallCount]} onValueChange={(v) => setFdmWallCount(v[0])} min={1} max={8} step={1} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Camada</span><span className="text-purple-400 font-mono">{fdmLayerHeight} mm</span></div>
                      <Slider value={[fdmLayerHeight]} onValueChange={(v) => setFdmLayerHeight(v[0])} min={0.08} max={0.36} step={0.02} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Velocidade</span><span className="text-yellow-400 font-mono">{fdmPrintSpeed} mm/s</span></div>
                      <Slider value={[fdmPrintSpeed]} onValueChange={(v) => setFdmPrintSpeed(v[0])} min={30} max={300} step={10} />
                    </div>
                    <div className="space-y-1.5 border-t border-[#E2E3DD]/60 pt-3">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-400"><span>Preço Filamento</span><span className="text-zinc-300 font-mono">${fdmFilamentCostPerKg}/kg</span></div>
                      <Slider value={[fdmFilamentCostPerKg]} onValueChange={(v) => setFdmFilamentCostPerKg(v[0])} min={10} max={80} step={1} />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
      <footer className="h-12 border-t border-[#E2E3DD] px-8 flex items-center justify-between bg-[#F9FAF4] shrink-0">
        <div className="flex gap-6 items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Status: <span className="text-[#00FF41]">Watertight Export Ready</span></span>
          <span>GPU Mesh Painting: ACTIVE</span>
          <span>Subdivisions: {modelGeometry ? "Multi-layer" : "None"}</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">© VÉRTICE STUDIO</div>
      </footer>
      {isProcessing && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-all animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6 p-10 bg-[#E8E9E3] border border-[#E8E9E3] rounded-lg shadow-2xl max-w-sm w-full text-center">
            <div className="relative"><Loader2 className="w-12 h-12 text-[#632CE5] animate-spin" /><div className="absolute inset-0 blur-xl bg-[#632CE5]/20 animate-pulse"></div></div>
            <div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#1A1C19]">Processando</h3><p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed">{processingMessage || "Aguarde..."}</p></div>
            <div className="w-full h-1 bg-[#E8E9E3] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#632CE5] to-[#00B8D4] animate-progress-indefinite"></div></div>
            <p className="text-[8px] text-zinc-600 uppercase font-bold">Não feche a página.</p>
          </div>
        </div>
      )}
    </div>
  );
}
