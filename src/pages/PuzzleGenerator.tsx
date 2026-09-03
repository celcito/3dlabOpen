/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, ChangeEvent, DragEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { 
  Download, Puzzle, Settings, Sliders, Box, Grid3X3, 
  Image as ImageIcon, Upload, Trash2, Loader2, Shapes, 
  Layers, RefreshCw, Eye, Sparkles, CheckCircle2, Shield,
  Wand2, LayoutGrid, FileImage, Scissors, Heart, Star,
  Egg, Play, Undo2, ZoomIn, Printer, ChevronRight, Copy, Maximize2,
  AlertCircle, X, Palette, Check
} from "lucide-react";
// @ts-ignore
import ImageTracer from "imagetracerjs";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { Evaluator, Brush, INTERSECTION, SUBTRACTION } from 'three-bvh-csg';
import { generatePuzzleImage, generateMemoryGameImages, GenerationProgress } from "../services/geminiService";
import { 
  generatePuzzleMold, 
  generateMemoryGameSheet, 
  PuzzleMoldResult, 
  MemorySheetResult, 
  MoldShapeType,
  CutStyleType,
  EdgeSegment,
  getJigsawEdgePoints,
  reverseEdgeSegments,
  seededRandom
} from "../lib/puzzleUtils";
import { generate3MfBlob, ThreeMfMeshItem, FilamentDefinition } from "../lib/threeMfExporter";

export interface FilamentSlot {
  id: string;
  name: string;
  color: string;
}

export type ColorDistributionMode = "uniform" | "checkerboard" | "ams4" | "rows" | "columns";

export const FILAMENT_PRESETS = [
  {
    name: "Madeira & Ardósia",
    desc: "Tom natural com moldura escura",
    f1: "#D4B996",
    f2: "#334155",
    f3: "#854D0E",
    f4: "#F8FAFC",
    f5: "#B45309",
  },
  {
    name: "AMS Cyber Neon (4 Cores)",
    desc: "Cores vibrantes para AMS Bambu",
    f1: "#632CE5",
    f2: "#18181B",
    f3: "#A855F7",
    f4: "#EC4899",
    f5: "#10B981",
  },
  {
    name: "Pastel Kids",
    desc: "Tons suaves e divertidos",
    f1: "#FCA5A5",
    f2: "#475569",
    f3: "#93C5FD",
    f4: "#FDE047",
    f5: "#86EFAC",
  },
  {
    name: "Monocromático Nobre",
    desc: "Gradiente de cinzas e titânio",
    f1: "#F8FAFC",
    f2: "#0F172A",
    f3: "#94A3B8",
    f4: "#475569",
    f5: "#1E293B",
  },
  {
    name: "Arco-Íris Pop Art",
    desc: "Contraste lúdico de alta saturação",
    f1: "#EF4444",
    f2: "#1E293B",
    f3: "#3B82F6",
    f4: "#10B981",
    f5: "#F59E0B",
  },
];

export function getPieceFilamentSlotIndex(
  col: number,
  row: number,
  cols: number,
  rows: number,
  mode: ColorDistributionMode
): number {
  if (mode === "uniform") return 0; // Filament Slot 1 (Peças Base)
  if (mode === "checkerboard") {
    return (col + row) % 2 === 0 ? 0 : 2; // Alternates between Slot 1 and Slot 3
  }
  if (mode === "ams4") {
    const idx = (col % 2) + (row % 2) * 2;
    const amsMap = [0, 2, 3, 4];
    return amsMap[idx % amsMap.length];
  }
  if (mode === "rows") {
    const amsMap = [0, 2, 3, 4];
    return amsMap[row % amsMap.length];
  }
  if (mode === "columns") {
    const amsMap = [0, 2, 3, 4];
    return amsMap[col % amsMap.length];
  }
  return 0;
}

interface Puzzle3DConfig {
  width: number;
  height: number;
  columns: number;
  rows: number;
  thickness: number;
  tabSize: number;
  tabType: CutStyleType;
  irregularity: number;
  explode: number;
  bevel: number;

  moldShape: MoldShapeType;
  generateTray: boolean;
  trayFloorThickness: number;
  trayRimHeight: number;
  trayRimWidth: number;
  trayTolerance: number;
  hasFingerHole: boolean;
  fingerHoleRadius: number;

  pieceColor: string;
  trayColor: string;
}

function preparePieceGeometryWithMaterials(geometry: THREE.BufferGeometry, width: number, height: number): THREE.BufferGeometry {
  geometry.computeVertexNormals();
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = nonIndexed.attributes.position;
  const norm = nonIndexed.attributes.normal;
  if (!pos || !norm || pos.count < 3) return geometry;

  const count = pos.count;
  const frontPositions: number[] = [];
  const frontNormals: number[] = [];
  const frontUVs: number[] = [];

  const backSidePositions: number[] = [];
  const backSideNormals: number[] = [];
  const backSideUVs: number[] = [];

  // Find max Z and min Z
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const z = pos.getZ(i);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const midZ = (minZ + maxZ) / 2;

  for (let i = 0; i < count; i += 3) {
    const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
    const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
    const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);

    // Compute triangle normal
    const vA = new THREE.Vector3(x0, y0, z0);
    const vB = new THREE.Vector3(x1, y1, z1);
    const vC = new THREE.Vector3(x2, y2, z2);
    const cb = new THREE.Vector3().subVectors(vC, vB);
    const ab = new THREE.Vector3().subVectors(vA, vB);
    const faceNorm = new THREE.Vector3().crossVectors(cb, ab).normalize();

    const avgZ = (z0 + z1 + z2) / 3;

    // Face is FRONT face (top printed face) if face normal points up/towards +Z and avgZ is near the top
    const isFrontFace = faceNorm.z > 0.35 && avgZ >= midZ - 0.2;

    if (isFrontFace) {
      for (let j = 0; j < 3; j++) {
        const idx = i + j;
        const x = pos.getX(idx);
        const y = pos.getY(idx);
        const z = pos.getZ(idx);
        frontPositions.push(x, y, z);
        frontNormals.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));

        const u = Math.max(0, Math.min(1, (x + width / 2) / width));
        const v = Math.max(0, Math.min(1, (y + height / 2) / height));
        frontUVs.push(u, v);
      }
    } else {
      for (let j = 0; j < 3; j++) {
        const idx = i + j;
        const x = pos.getX(idx);
        const y = pos.getY(idx);
        const z = pos.getZ(idx);
        backSidePositions.push(x, y, z);
        backSideNormals.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
        backSideUVs.push(0, 0);
      }
    }
  }

  // Fallback if needed
  if (frontPositions.length === 0) {
    const fallback = geometry.clone();
    fallback.computeVertexNormals();
    const p = fallback.attributes.position;
    if (p) {
      const uvs = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const u = Math.max(0, Math.min(1, (p.getX(i) + width / 2) / width));
        const v = Math.max(0, Math.min(1, (p.getY(i) + height / 2) / height));
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
      }
      fallback.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    }
    return fallback;
  }

  const combinedPositions = new Float32Array([...frontPositions, ...backSidePositions]);
  const combinedNormals = new Float32Array([...frontNormals, ...backSideNormals]);
  const combinedUVs = new Float32Array([...frontUVs, ...backSideUVs]);

  const resultGeom = new THREE.BufferGeometry();
  resultGeom.setAttribute("position", new THREE.BufferAttribute(combinedPositions, 3));
  resultGeom.setAttribute("normal", new THREE.BufferAttribute(combinedNormals, 3));
  resultGeom.setAttribute("uv", new THREE.BufferAttribute(combinedUVs, 2));

  const frontVertexCount = frontPositions.length / 3;
  const backSideVertexCount = backSidePositions.length / 3;

  resultGeom.clearGroups();
  if (frontVertexCount > 0) {
    resultGeom.addGroup(0, frontVertexCount, 0); // Group 0: Top Front Printed Face
  }
  if (backSideVertexCount > 0) {
    resultGeom.addGroup(frontVertexCount, backSideVertexCount, 1); // Group 1: Side & Back Base Substrate
  }

  return resultGeom;
}

function createPresetShape3D(shapeType: MoldShapeType, width: number, height: number, offset: number = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const w = width + offset * 2;
  const h = height + offset * 2;
  const hw = w / 2;
  const hh = h / 2;

  switch (shapeType) {
    case "egg": {
      // Natural organic 3D egg curve: narrow rounded top, wide body, broad bottom, centered at (0,0)
      const yTop = hh * 0.96;
      const yMid = -hh * 0.15;
      const yBot = -hh * 0.96;
      const topCpW = hw * 0.52;
      const maxW = hw * 0.96;
      const botCpW = hw * 0.58;

      shape.moveTo(0, yTop);
      shape.bezierCurveTo(topCpW, yTop, maxW, hh * 0.35, maxW, yMid);
      shape.bezierCurveTo(maxW, -hh * 0.65, botCpW, yBot, 0, yBot);
      shape.bezierCurveTo(-botCpW, yBot, -maxW, -hh * 0.65, -maxW, yMid);
      shape.bezierCurveTo(-maxW, hh * 0.35, -topCpW, yTop, 0, yTop);
      shape.closePath();
      break;
    }
    case "circle": {
      const r = Math.min(hw, hh) * 0.96;
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
      break;
    }
    case "heart": {
      const s = Math.min(w, h) / 100 * 0.95;
      shape.moveTo(0, 15 * s);
      shape.bezierCurveTo(0, 32 * s, 22 * s, 48 * s, 44 * s, 48 * s);
      shape.bezierCurveTo(72 * s, 48 * s, 72 * s, 15 * s, 72 * s, 15 * s);
      shape.bezierCurveTo(72 * s, -12 * s, 50 * s, -38 * s, 0, -60 * s);
      shape.bezierCurveTo(-50 * s, -38 * s, -72 * s, -12 * s, -72 * s, 15 * s);
      shape.bezierCurveTo(-72 * s, 15 * s, -72 * s, 48 * s, -44 * s, 48 * s);
      shape.bezierCurveTo(-22 * s, 48 * s, 0, 32 * s, 0, 15 * s);
      shape.closePath();
      break;
    }
    case "hexagon": {
      const r = Math.min(hw, hh) * 0.95;
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3 + Math.PI / 6;
        const px = r * Math.cos(ang);
        const py = r * Math.sin(ang);
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      shape.closePath();
      break;
    }
    case "shield": {
      const sW = hw * 0.94;
      const sH = hh * 0.94;
      shape.moveTo(-sW, sH);
      shape.lineTo(sW, sH);
      shape.lineTo(sW, 0);
      shape.quadraticCurveTo(sW, -sH, 0, -sH);
      shape.quadraticCurveTo(-sW, -sH, -sW, 0);
      shape.closePath();
      break;
    }
    case "star": {
      const rOuter = Math.min(hw, hh) * 0.96;
      const rInner = rOuter * 0.45;
      const points = 5;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const ang = (i * Math.PI) / points + Math.PI / 2;
        const px = r * Math.cos(ang);
        const py = r * Math.sin(ang);
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      shape.closePath();
      break;
    }
    case "square":
    case "rect":
    default: {
      const r = Math.min(6, Math.min(hw, hh) * 0.12);
      shape.moveTo(-hw + r, -hh);
      shape.lineTo(hw - r, -hh);
      shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
      shape.lineTo(hw, hh - r);
      shape.quadraticCurveTo(hw, hh, hw - r, hh);
      shape.lineTo(-hw + r, hh);
      shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
      shape.lineTo(-hw, -hh + r);
      shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      shape.closePath();
      break;
    }
  }

  return shape;
}

const DEFAULT_SAMPLE_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="60%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <linearGradient id="eggGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF4081" />
      <stop offset="25%" stop-color="#FF9100" />
      <stop offset="50%" stop-color="#FFD600" />
      <stop offset="75%" stop-color="#00E676" />
      <stop offset="100%" stop-color="#632CE5" />
    </linearGradient>
    <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFE082" />
      <stop offset="50%" stop-color="#FFF9C4" />
      <stop offset="100%" stop-color="#FFD54F" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="800" height="1000" fill="url(#bgGrad)" />
  <g fill="#FFF" opacity="0.6">
    <circle cx="150" cy="180" r="3" />
    <circle cx="650" cy="220" r="4" />
    <circle cx="120" cy="780" r="3" />
    <circle cx="680" cy="720" r="4" />
    <circle cx="200" cy="880" r="2.5" />
    <circle cx="600" cy="120" r="3.5" />
  </g>
  <g transform="translate(400, 500)">
    <path d="M 0 -360 C 130 -360 250 -120 250 50 C 250 240 145 360 0 360 C -145 360 -250 240 -250 50 C -250 -120 -130 -360 0 -360 Z" fill="url(#eggGrad)" stroke="url(#goldRibbon)" stroke-width="8" />
    <path d="M -235 -40 Q 0 -90 235 -40" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.85" />
    <path d="M -245 40 Q 0 -10 245 40" fill="none" stroke="url(#goldRibbon)" stroke-width="14" stroke-linecap="round" />
    <path d="M -225 120 Q 0 70 225 120" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.85" />
    <g fill="#FFF" opacity="0.9">
      <circle cx="0" cy="-220" r="26" fill="#FFF8E1" />
      <circle cx="-100" cy="-160" r="20" fill="#FF80AB" />
      <circle cx="100" cy="-160" r="20" fill="#80D8FF" />
      <circle cx="-130" cy="210" r="22" fill="#B9F6CA" />
      <circle cx="0" cy="240" r="24" fill="#FFE57F" />
      <circle cx="130" cy="210" r="22" fill="#FF80AB" />
    </g>
    <polygon points="0,-20 18,30 -28,-6 28,-6 -18,30" fill="url(#goldRibbon)" transform="scale(1.8)" filter="url(#glow)" />
  </g>
</svg>
`)}`;

export default function PuzzleGenerator() {
  // Main Studio Tabs
  const [activeTab, setActiveTab] = useState<"2d" | "3d">("2d");
  const [gameType, setGameType] = useState<"puzzle" | "memory">("puzzle");
  const [imageSource, setImageSource] = useState<"ai" | "upload">("ai");

  // AI Inputs
  const [aiPrompt, setAiPrompt] = useState("Ovo de Páscoa mágico decorado com flores e cores vivas");
  const [aiStyle, setAiStyle] = useState("Desenho infantil");
  const [aiModel, setAiModel] = useState("gemini-3.1-flash-lite-image");
  const [difficulty, setDifficulty] = useState({ rows: 3, cols: 3 });
  const [memoryPairsCount, setMemoryPairsCount] = useState(6);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({ current: 0, total: 0 });
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ text: string; type: "info" | "success" | "warning" } | null>(null);

  // Current Assets
  const [currentImage, setCurrentImage] = useState<string>(DEFAULT_SAMPLE_IMAGE);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [memoryCards, setMemoryCards] = useState<string[]>([]);
  const [moldShape, setMoldShape] = useState<MoldShapeType>("egg");
  const [previewMode2D, setPreviewMode2D] = useState<"withMold" | "moldOnly" | "clean">("withMold");

  // 2D Mold Outputs
  const [puzzleResult, setPuzzleResult] = useState<PuzzleMoldResult | null>(null);
  const [memoryResult, setMemoryResult] = useState<MemorySheetResult | null>(null);
  const [isProcessing2D, setIsProcessing2D] = useState(false);

  // 3D Parameters & States
  const [config3D, setConfig3D] = useState<Puzzle3DConfig>({
    width: 130,
    height: 165,
    columns: 3,
    rows: 3,
    thickness: 3.0,
    tabSize: 0.28,
    tabType: "classic",
    irregularity: 0.35,
    explode: 1.5,
    bevel: 0.3,

    moldShape: "egg",
    generateTray: false,
    trayFloorThickness: 2.0,
    trayRimHeight: 3.5,
    trayRimWidth: 6.0,
    trayTolerance: 1.2,
    hasFingerHole: true,
    fingerHoleRadius: 14,

    pieceColor: "#D4B996",
    trayColor: "#334155"
  });

  const [seed3D, setSeed3D] = useState(42);
  const [isProcessing3D, setIsProcessing3D] = useState(false);
  const [isExporting3MF, setIsExporting3MF] = useState(false);
  const [viewMode3D, setViewMode3D] = useState<"both" | "pieces" | "tray">("pieces");
  const [shadingMode3D, setShadingMode3D] = useState<"textured" | "solid">("textured");
  const [puzzleTexture, setPuzzleTexture] = useState<THREE.Texture | null>(null);

  // Multi-Filament 3MF configuration
  const [colorDistributionMode, setColorDistributionMode] = useState<ColorDistributionMode>("uniform");
  const [filaments, setFilaments] = useState<FilamentSlot[]>([
    { id: "slot1", name: "Filamento 1 (Peças / Base)", color: "#D4B996" },
    { id: "slot2", name: "Filamento 2 (Bandeja / Moldura)", color: "#334155" },
    { id: "slot3", name: "Filamento 3 (Acento Ciano)", color: "#632CE5" },
    { id: "slot4", name: "Filamento 4 (Acento Magenta)", color: "#EC4899" },
    { id: "slot5", name: "Filamento 5 (Acento Amarelo)", color: "#FACC15" },
  ]);

  const [finalPieces3D, setFinalPieces3D] = useState<{ 
    geom: THREE.BufferGeometry; 
    x: number; 
    y: number;
    col: number;
    row: number;
    index: number;
    pairIndex?: number;
  }[]>([]);
  const [trayFloorGeom3D, setTrayFloorGeom3D] = useState<THREE.BufferGeometry | null>(null);
  const [trayRimGeom3D, setTrayRimGeom3D] = useState<THREE.BufferGeometry | null>(null);
  const [memoryTileTextures, setMemoryTileTextures] = useState<(THREE.Texture | null)[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const piecesGroupRef = useRef<THREE.Group>(null);
  const trayGroupRef = useRef<THREE.Group>(null);
  const combinedGroupRef = useRef<THREE.Group>(null);

  // Sync filament slot colors with config3D piece and tray color
  const updateFilamentColor = (slotIdx: number, newColor: string) => {
    setFilaments(prev => {
      const next = [...prev];
      if (next[slotIdx]) {
        next[slotIdx] = { ...next[slotIdx], color: newColor };
      }
      return next;
    });
    if (slotIdx === 0) {
      setConfig3D(p => ({ ...p, pieceColor: newColor }));
    } else if (slotIdx === 1) {
      setConfig3D(p => ({ ...p, trayColor: newColor }));
    }
  };

  const applyFilamentPreset = (preset: typeof FILAMENT_PRESETS[0]) => {
    setFilaments([
      { id: "slot1", name: "Filamento 1 (Peças / Base)", color: preset.f1 },
      { id: "slot2", name: "Filamento 2 (Bandeja / Moldura)", color: preset.f2 },
      { id: "slot3", name: "Filamento 3 (Acento 1)", color: preset.f3 },
      { id: "slot4", name: "Filamento 4 (Acento 2)", color: preset.f4 },
      { id: "slot5", name: "Filamento 5 (Acento 3)", color: preset.f5 },
    ]);
    setConfig3D(p => ({ ...p, pieceColor: preset.f1, trayColor: preset.f2 }));
  };

  // Multi-material setup: Material 0 (Front face) gets the printed artwork, Material 1 (Sides & Back) is solid MDF/substrate/filament
  const pieceMaterials = useMemo(() => {
    const frontMat = (shadingMode3D === "textured" && puzzleTexture)
      ? new THREE.MeshStandardMaterial({
          map: puzzleTexture,
          roughness: 0.35,
          metalness: 0.05,
        })
      : new THREE.MeshStandardMaterial({
          color: config3D.pieceColor,
          roughness: 0.45,
          metalness: 0.12,
        });

    const sideBackMat = new THREE.MeshStandardMaterial({
      color: config3D.pieceColor,
      roughness: 0.65,
      metalness: 0.08,
    });

    return [frontMat, sideBackMat];
  }, [shadingMode3D, puzzleTexture, config3D.pieceColor]);

  // Load 3D textures for memory game cards
  useEffect(() => {
    if (gameType !== "memory" || memoryCards.length === 0) {
      setMemoryTileTextures([]);
      return;
    }
    const loader = new THREE.TextureLoader();
    let isCancelled = false;

    memoryCards.forEach((cardUrl, idx) => {
      loader.load(
        cardUrl,
        (tex) => {
          if (isCancelled) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          setMemoryTileTextures(prev => {
            const next = [...prev];
            next[idx] = tex;
            return next;
          });
        },
        undefined,
        () => {}
      );
    });

    return () => {
      isCancelled = true;
    };
  }, [memoryCards, gameType]);

  // Load 3D texture for jigsaw puzzle when current image updates
  useEffect(() => {
    if (!currentImage) return;
    const loader = new THREE.TextureLoader();
    loader.load(
      currentImage,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setPuzzleTexture(tex);
      },
      undefined,
      () => {}
    );
  }, [currentImage]);

  // Synchronize 3D config when difficulty, mold shape, or gameType changes
  useEffect(() => {
    setConfig3D(prev => {
      let w = prev.width;
      let h = prev.height;
      if (gameType === "puzzle") {
        if (moldShape === "egg" && prev.width === 140 && prev.height === 100) {
          w = 130;
          h = 165;
        }
      }
      return {
        ...prev,
        columns: difficulty.cols,
        rows: difficulty.rows,
        moldShape: moldShape,
        width: w,
        height: h
      };
    });
  }, [difficulty, moldShape, gameType]);

  // Recalculate 2D Puzzle Mold whenever image, difficulty, cut settings, or shape changes
  useEffect(() => {
    if (gameType === "puzzle" && currentImage) {
      setIsProcessing2D(true);
      generatePuzzleMold(currentImage, difficulty.rows, difficulty.cols, {
        moldShape,
        tabSize: config3D.tabSize,
        tabType: config3D.tabType,
        irregularity: config3D.irregularity,
        seed: seed3D,
        lineColor: "#632CE5",
        lineWidth: 2.5
      })
        .then(res => setPuzzleResult(res))
        .catch(err => console.error("Erro gerando molde 2D:", err))
        .finally(() => setIsProcessing2D(false));
    }
  }, [currentImage, difficulty, moldShape, gameType, config3D.tabSize, config3D.tabType, config3D.irregularity, seed3D]);

  // Recalculate 2D Memory Sheet whenever memory cards list changes
  useEffect(() => {
    if (gameType === "memory" && memoryCards.length > 0) {
      setIsProcessing2D(true);
      generateMemoryGameSheet(memoryCards, {
        title: `Jogo da Memória • ${aiPrompt || "Vértice Studio"}`,
        cardSize: 220,
        gap: 20
      })
        .then(res => setMemoryResult(res))
        .catch(err => console.error("Erro gerando folha de memória:", err))
        .finally(() => setIsProcessing2D(false));
    }
  }, [memoryCards, gameType, aiPrompt]);

  // 3D CSG Geometry calculation
  useEffect(() => {
    let active = true;

    const generate3D = async () => {
      setIsProcessing3D(true);
      await new Promise(r => setTimeout(r, 40));

      try {
        const { width, height, columns, rows, thickness, tabSize, tabType, irregularity, bevel, explode } = config3D;

        // -------------------------------------------------------------
        // MEMORY GAME 3D GENERATION PATH (GRID OF TOKENS / CARDS)
        // -------------------------------------------------------------
        if (gameType === "memory") {
          const pairsCount = memoryCards.length > 0 ? memoryCards.length : memoryPairsCount;
          const totalCards = pairsCount * 2;

          let cols = 4;
          if (totalCards <= 8) cols = 4;
          else if (totalCards <= 12) cols = 4;
          else if (totalCards <= 16) cols = 4;
          else if (totalCards <= 24) cols = 6;
          else cols = 8;
          const numRows = Math.ceil(totalCards / cols);

          const tileW = 34; // mm
          const tileH = 34; // mm
          const gap = 4 + (explode > 0 ? explode * 2.5 : 0);

          const totalGridW = cols * tileW + (cols - 1) * gap;
          const totalGridH = numRows * tileH + (numRows - 1) * gap;

          // Non-puzzle shape for memory tokens (default to square/rounded square if egg was selected)
          const effectiveShape = (config3D.moldShape === "egg") ? "square" : config3D.moldShape;
          const tileShape = createPresetShape3D(effectiveShape, tileW, tileH, 0);

          const extrudeSettings = {
            depth: thickness,
            bevelEnabled: bevel > 0,
            bevelSegments: 2,
            steps: 1,
            bevelSize: Math.min(bevel, 0.6),
            bevelThickness: Math.min(bevel, 0.6),
            curveSegments: 24,
          };

          const rawTileGeom = new THREE.ExtrudeGeometry(tileShape, extrudeSettings);
          rawTileGeom.computeBoundingBox();
          if (rawTileGeom.boundingBox) {
            const cx = (rawTileGeom.boundingBox.min.x + rawTileGeom.boundingBox.max.x) / 2;
            const cy = (rawTileGeom.boundingBox.min.y + rawTileGeom.boundingBox.max.y) / 2;
            rawTileGeom.translate(-cx, -cy, 0);
          }

          const preparedTileGeom = preparePieceGeometryWithMaterials(rawTileGeom, tileW, tileH);
          const memoryPieces: typeof finalPieces3D = [];

          for (let i = 0; i < totalCards; i++) {
            const c = i % cols;
            const r = Math.floor(i / cols);
            const pairIdx = i % pairsCount;

            const posX = -totalGridW / 2 + c * (tileW + gap) + tileW / 2;
            const posY = totalGridH / 2 - r * (tileH + gap) - tileH / 2;

            memoryPieces.push({
              geom: preparedTileGeom.clone(),
              x: posX,
              y: posY,
              col: c,
              row: r,
              index: i,
              pairIndex: pairIdx
            });
          }

          if (!active) return;
          setFinalPieces3D(memoryPieces);

          // Tray / Storage Base for Memory Game Tokens
          if (config3D.generateTray) {
            const trayMargin = config3D.trayRimWidth + config3D.trayTolerance + 4;
            const trayOuterW = totalGridW + trayMargin * 2;
            const trayOuterH = totalGridH + trayMargin * 2;
            const trayOuterShape = createPresetShape3D("rect", trayOuterW, trayOuterH, 6);

            const floorExtrude = new THREE.ExtrudeGeometry(trayOuterShape, {
              depth: config3D.trayFloorThickness,
              bevelEnabled: true,
              bevelSegments: 2,
              bevelSize: 0.3,
              bevelThickness: 0.3,
              curveSegments: 24
            });

            const rimOuterExtrude = new THREE.ExtrudeGeometry(trayOuterShape, {
              depth: config3D.trayRimHeight,
              bevelEnabled: true,
              bevelSegments: 2,
              bevelSize: 0.3,
              bevelThickness: 0.3,
              curveSegments: 24
            });

            const cavityShape = createPresetShape3D("rect", totalGridW + config3D.trayTolerance * 2, totalGridH + config3D.trayTolerance * 2, 4);
            const cavityCutter = new THREE.ExtrudeGeometry(cavityShape, {
              depth: config3D.trayRimHeight * 2,
              bevelEnabled: false,
              curveSegments: 24
            });
            cavityCutter.translate(0, 0, -config3D.trayRimHeight * 0.5);

            const evaluator = new Evaluator();
            const rimBrush = new Brush(rimOuterExtrude);
            const cavityBrush = new Brush(cavityCutter);
            rimBrush.updateMatrixWorld();
            cavityBrush.updateMatrixWorld();

            const evaluatedRim = evaluator.evaluate(rimBrush, cavityBrush, SUBTRACTION);
            evaluatedRim.geometry.computeVertexNormals();

            setTrayFloorGeom3D(floorExtrude);
            setTrayRimGeom3D(evaluatedRim.geometry);
          } else {
            setTrayFloorGeom3D(null);
            setTrayRimGeom3D(null);
          }
          return;
        }

        // -------------------------------------------------------------
        // JIGSAW PUZZLE 3D GENERATION PATH (INTERLOCKING CUTS + MOLDS)
        // -------------------------------------------------------------
        const pieceW = width / columns;
        const pieceH = height / rows;

        const edgesH: number[][] = [];
        for (let r = 0; r <= rows; r++) {
          const row = [];
          for (let c = 0; c < columns; c++) {
            if (r === 0 || r === rows) row.push(0);
            else {
              const rnd = seededRandom(seed3D * 73.7 + r * 37.1 + c * 13.9);
              row.push(rnd > 0.5 ? 1 : -1);
            }
          }
          edgesH.push(row);
        }

        const edgesV: number[][] = [];
        for (let r = 0; r < rows; r++) {
          const row = [];
          for (let c = 0; c <= columns; c++) {
            if (c === 0 || c === columns) row.push(0);
            else {
              const rnd = seededRandom(seed3D * 89.3 + r * 19.7 + c * 43.1);
              row.push(rnd > 0.5 ? 1 : -1);
            }
          }
          edgesV.push(row);
        }

        // Canonical segments for each horizontal edge: from (0, 0) to (pieceW, 0)
        const segsH: EdgeSegment[][][] = [];
        for (let r = 0; r <= rows; r++) {
          const rowSegs: EdgeSegment[][] = [];
          for (let c = 0; c < columns; c++) {
            const edgeSeed = seed3D * 1000 + r * 31 + c;
            const s = getJigsawEdgePoints(0, 0, pieceW, 0, edgesH[r][c], {
              tabSize,
              tabType,
              irregularity,
              seed: edgeSeed,
            });
            rowSegs.push(s);
          }
          segsH.push(rowSegs);
        }

        // Canonical segments for each vertical edge: from (0, 0) to (0, pieceH)
        const segsV: EdgeSegment[][][] = [];
        for (let r = 0; r < rows; r++) {
          const rowSegs: EdgeSegment[][] = [];
          for (let c = 0; c <= columns; c++) {
            const edgeSeed = seed3D * 2000 + r * 47 + c;
            const s = getJigsawEdgePoints(0, 0, 0, pieceH, edgesV[r][c], {
              tabSize,
              tabType,
              irregularity,
              seed: edgeSeed,
            });
            rowSegs.push(s);
          }
          segsV.push(rowSegs);
        }

        const baseGeoms: { geom: THREE.ExtrudeGeometry; col: number; row: number; cx: number; cy: number }[] = [];
        const extrudeSettings = {
          depth: thickness,
          bevelEnabled: bevel > 0,
          bevelSegments: 2,
          steps: 1,
          bevelSize: bevel,
          bevelThickness: bevel,
        };

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < columns; c++) {
            const shape = new THREE.Shape();
            const px = c * pieceW - width / 2;
            const py = r * pieceH - height / 2;

            // Top edge: (0,0) to (pieceW, 0)
            const topSegs = segsH[r][c];

            // Right edge: from (pieceW, 0) to (pieceW, pieceH)
            const rightSegs = segsV[r][c + 1].map(s => {
              if (s.type === "L") {
                return { type: "L" as const, points: [s.points[0] + pieceW, s.points[1]] };
              } else {
                return {
                  type: "C" as const,
                  points: [
                    s.points[0] + pieceW, s.points[1],
                    s.points[2] + pieceW, s.points[3],
                    s.points[4] + pieceW, s.points[5],
                  ],
                };
              }
            });

            // Bottom edge: from (pieceW, pieceH) to (0, pieceH)
            const bottomFwd = segsH[r + 1][c].map(s => {
              if (s.type === "L") {
                return { type: "L" as const, points: [s.points[0], s.points[1] + pieceH] };
              } else {
                return {
                  type: "C" as const,
                  points: [
                    s.points[0], s.points[1] + pieceH,
                    s.points[2], s.points[3] + pieceH,
                    s.points[4], s.points[5] + pieceH,
                  ],
                };
              }
            });
            const bottomSegs = reverseEdgeSegments(bottomFwd, 0, pieceH);

            // Left edge: from (0, pieceH) to (0, 0)
            const leftFwd = segsV[r][c];
            const leftSegs = reverseEdgeSegments(leftFwd, 0, 0);

            shape.moveTo(0, 0);
            for (const s of topSegs) {
              if (s.type === "L") shape.lineTo(s.points[0], s.points[1]);
              else shape.bezierCurveTo(s.points[0], s.points[1], s.points[2], s.points[3], s.points[4], s.points[5]);
            }
            for (const s of rightSegs) {
              if (s.type === "L") shape.lineTo(s.points[0], s.points[1]);
              else shape.bezierCurveTo(s.points[0], s.points[1], s.points[2], s.points[3], s.points[4], s.points[5]);
            }
            for (const s of bottomSegs) {
              if (s.type === "L") shape.lineTo(s.points[0], s.points[1]);
              else shape.bezierCurveTo(s.points[0], s.points[1], s.points[2], s.points[3], s.points[4], s.points[5]);
            }
            for (const s of leftSegs) {
              if (s.type === "L") shape.lineTo(s.points[0], s.points[1]);
              else shape.bezierCurveTo(s.points[0], s.points[1], s.points[2], s.points[3], s.points[4], s.points[5]);
            }
            shape.closePath();

            const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            baseGeoms.push({ geom, col: c, row: r, cx: px, cy: py });
          }
        }

        const isCustomShape = config3D.moldShape !== "rect";
        let piecesOutput: { 
          geom: THREE.BufferGeometry; 
          x: number; 
          y: number;
          col: number;
          row: number;
          index: number;
        }[] = [];

        // All custom shapes (egg, heart, star, circle, shield, hexagon, square) are precisely clipped
        if (isCustomShape) {
          const cutterShape = createPresetShape3D(config3D.moldShape, config3D.width, config3D.height, 0);
          const moldExtrude = new THREE.ExtrudeGeometry(cutterShape, {
            depth: config3D.thickness * 4,
            bevelEnabled: false,
            curveSegments: 36
          });
          // Center along Z
          moldExtrude.translate(0, 0, -config3D.thickness * 1.5);

          const evaluator = new Evaluator();
          const moldBrush = new Brush(moldExtrude);
          moldBrush.updateMatrixWorld();

          for (const base of baseGeoms) {
            const translatedBase = base.geom.clone();
            translatedBase.translate(base.cx, base.cy, 0);
            const pieceBrush = new Brush(translatedBase);
            pieceBrush.updateMatrixWorld();

            const intersected = evaluator.evaluate(pieceBrush, moldBrush, INTERSECTION);
            const hasVertices = (intersected.geometry.index && intersected.geometry.index.count > 0) ||
                                (intersected.geometry.attributes.position && intersected.geometry.attributes.position.count > 0);
            if (hasVertices) {
              const pieceGeom = preparePieceGeometryWithMaterials(intersected.geometry, config3D.width, config3D.height);
              const cx = (base.col - (config3D.columns - 1) / 2) * explode;
              const cy = (base.row - (config3D.rows - 1) / 2) * explode;
              piecesOutput.push({ 
                geom: pieceGeom, 
                x: cx, 
                y: cy,
                col: base.col,
                row: base.row,
                index: piecesOutput.length
              });
            }
          }
        } else {
          for (const base of baseGeoms) {
            const geom = base.geom.clone();
            geom.translate(base.cx, base.cy, 0);
            const pieceGeom = preparePieceGeometryWithMaterials(geom, config3D.width, config3D.height);
            const cx = (base.col - (config3D.columns - 1) / 2) * explode;
            const cy = (base.row - (config3D.rows - 1) / 2) * explode;
            piecesOutput.push({ 
              geom: pieceGeom, 
              x: cx, 
              y: cy,
              col: base.col,
              row: base.row,
              index: piecesOutput.length
            });
          }
        }

        if (!active) return;
        setFinalPieces3D(piecesOutput);

        // Tray Generation (Berço e Borda 3D com Cavidade CSG Perfeita)
        if (config3D.generateTray) {
          const outerShape = createPresetShape3D(
            config3D.moldShape,
            config3D.width,
            config3D.height,
            config3D.trayRimWidth + config3D.trayTolerance
          );
          const innerShape = createPresetShape3D(
            config3D.moldShape,
            config3D.width,
            config3D.height,
            config3D.trayTolerance
          );

          const evaluator = new Evaluator();

          // 1. Solid Outer Rim
          const outerRimExtrude = new THREE.ExtrudeGeometry(outerShape, {
            depth: config3D.trayRimHeight,
            bevelEnabled: true,
            bevelSegments: 2,
            bevelSize: 0.3,
            bevelThickness: 0.3,
            curveSegments: 36
          });

          // 2. Inner Cavity Cutter (extruded deeper and translated to guarantee complete through-cut)
          const innerCutterExtrude = new THREE.ExtrudeGeometry(innerShape, {
            depth: config3D.trayRimHeight * 2,
            bevelEnabled: false,
            curveSegments: 36
          });
          innerCutterExtrude.translate(0, 0, -config3D.trayRimHeight * 0.5);

          const outerBrush = new Brush(outerRimExtrude);
          const innerBrush = new Brush(innerCutterExtrude);
          outerBrush.updateMatrixWorld();
          innerBrush.updateMatrixWorld();

          // 3. Exact hollow rim calculation
          const rimResult = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
          const rimGeom = rimResult.geometry;
          rimGeom.computeVertexNormals();

          // 4. Floor Base
          const floorShape = outerShape.clone();
          const floorExtrude = new THREE.ExtrudeGeometry(floorShape, {
            depth: config3D.trayFloorThickness,
            bevelEnabled: true,
            bevelSegments: 2,
            bevelSize: 0.3,
            bevelThickness: 0.3,
            curveSegments: 36
          });

          let finalFloorGeom: THREE.BufferGeometry = floorExtrude;
          if (config3D.hasFingerHole && config3D.fingerHoleRadius > 4) {
            const holeGeom = new THREE.CylinderGeometry(
              config3D.fingerHoleRadius,
              config3D.fingerHoleRadius,
              config3D.trayFloorThickness * 4,
              32
            );
            holeGeom.rotateX(Math.PI / 2);
            holeGeom.translate(0, 0, config3D.trayFloorThickness / 2);

            const floorBrush = new Brush(floorExtrude);
            const holeBrush = new Brush(holeGeom);
            floorBrush.updateMatrixWorld();
            holeBrush.updateMatrixWorld();

            const floorSub = evaluator.evaluate(floorBrush, holeBrush, SUBTRACTION);
            finalFloorGeom = floorSub.geometry;
          }
          finalFloorGeom.computeVertexNormals();

          setTrayFloorGeom3D(finalFloorGeom);
          setTrayRimGeom3D(rimGeom);
        } else {
          setTrayFloorGeom3D(null);
          setTrayRimGeom3D(null);
        }
      } catch (err) {
        console.error("Erro no cálculo 3D:", err);
      } finally {
        if (active) setIsProcessing3D(false);
      }
    };

    generate3D();
    return () => { active = false; };
  }, [config3D, seed3D, gameType, memoryCards, memoryPairsCount]);

  // Handle Image Upload
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    if (gameType === "puzzle") {
      const file = fileArray[0];
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = ev.target?.result as string;
        if (res) {
          setCurrentImage(res);
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Memory game: load all selected images
      const newCardUrls: string[] = [];
      let pending = fileArray.length;
      setUploadedFileName(`${fileArray.length} imagem(ns) selecionada(s)`);

      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const res = ev.target?.result as string;
          if (res) {
            newCardUrls.push(res);
          }
          pending--;
          if (pending === 0) {
            setMemoryCards(prev => [...prev, ...newCardUrls].slice(0, 16));
            if (newCardUrls.length > 0) {
              setCurrentImage(newCardUrls[0]);
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so re-uploading the same file works every time
      e.target.value = "";
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // AI Generation Trigger
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAI(true);
    setAiNotice(null);
    setGenerationProgress({ current: 0, total: 1, message: "Iniciando geração inteligente de arte..." });

    try {
      if (gameType === "puzzle") {
        const imgUrl = await generatePuzzleImage(aiPrompt, aiStyle, aiModel, "1:1");
        setCurrentImage(imgUrl);
        setUploadedFileName(null);
        setAiNotice({
          type: "success",
          text: "Arte gerada com sucesso e aplicada ao quebra-cabeça 2D e 3D!"
        });
      } else {
        const cards = await generateMemoryGameImages(
          aiPrompt,
          memoryPairsCount,
          aiStyle,
          aiModel,
          (prog) => setGenerationProgress(prog)
        );
        setMemoryCards(cards);
        if (cards.length > 0) {
          setCurrentImage(cards[0]);
        }
        setAiNotice({
          type: "success",
          text: `${cards.length} cartas geradas com sucesso para o Jogo da Memória!`
        });
      }
    } catch (err: any) {
      console.error("Erro na geração AI:", err);
      setAiNotice({
        type: "warning",
        text: err.message || "Não foi possível conectar ao modelo de IA no momento. Tente novamente ou use uma arte pré-definida."
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // File Download Helpers
  const downloadFile = (dataUrlOrSvg: string, filename: string, isSvg: boolean = false) => {
    let url = dataUrlOrSvg;
    let cleanup = false;

    if (isSvg) {
      const blob = new Blob([dataUrlOrSvg], { type: "image/svg+xml;charset=utf-8" });
      url = URL.createObjectURL(blob);
      cleanup = true;
    }

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (cleanup) {
      URL.revokeObjectURL(url);
    }
  };

  const exportMesh = (targetGroup: THREE.Group | null, filename: string) => {
    if (!targetGroup) return;
    const exporter = new STLExporter();
    const stlString = exporter.parse(targetGroup);
    const blob = new Blob([stlString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 3MF Multi-Color Export Handlers
  const export3MFPiecesOnly = async () => {
    if (finalPieces3D.length === 0) return;
    setIsExporting3MF(true);
    try {
      const isMemory = gameType === "memory";
      const items: ThreeMfMeshItem[] = finalPieces3D.map((p) => {
        const filIdx = getPieceFilamentSlotIndex(
          p.col,
          p.row,
          config3D.columns,
          config3D.rows,
          colorDistributionMode
        );
        const name = isMemory
          ? `Ficha_${p.index + 1}_Par_${(p.pairIndex !== undefined ? p.pairIndex + 1 : 1)}`
          : `Peca_Linha${p.row + 1}_Col${p.col + 1}`;
        return {
          geometry: p.geom,
          name,
          filamentIndex: filIdx,
        };
      });

      const title = isMemory
        ? `Jogo da Memoria ${finalPieces3D.length} Fichas Multi-Color`
        : `Quebra-Cabeca ${config3D.columns}x${config3D.rows} Multi-Color`;

      const blob = await generate3MfBlob({
        title,
        designer: "Puzzle Studio 3D",
        filaments: filaments.map(f => ({ name: f.name, color: f.color })),
        items,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = isMemory
        ? `jogomemoria_3mf_fichas_multicor_${finalPieces3D.length}pecas.3mf`
        : `quebracabeca_3mf_pecas_multicor_${config3D.columns}x${config3D.rows}.3mf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro exportando 3MF de peças:", err);
    } finally {
      setIsExporting3MF(false);
    }
  };

  const export3MFTrayOnly = async () => {
    if (!trayFloorGeom3D && !trayRimGeom3D) return;
    setIsExporting3MF(true);
    try {
      const isMemory = gameType === "memory";
      const items: ThreeMfMeshItem[] = [];
      if (trayFloorGeom3D) {
        items.push({
          geometry: trayFloorGeom3D,
          name: isMemory ? "Estojo_Fundo_Base" : "Bandeja_Fundo_Base",
          filamentIndex: 1, // Tray filament slot
        });
      }
      if (trayRimGeom3D) {
        items.push({
          geometry: trayRimGeom3D,
          name: isMemory ? "Estojo_Moldura_Borda" : "Bandeja_Moldura_Borda",
          filamentIndex: 1, // Tray filament slot
        });
      }

      const title = isMemory
        ? `Estojo Organizador Jogo da Memoria 3D`
        : `Bandeja Molde Quebra-Cabeca 3D`;

      const blob = await generate3MfBlob({
        title,
        designer: "Puzzle Studio 3D",
        filaments: filaments.map(f => ({ name: f.name, color: f.color })),
        items,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = isMemory
        ? `jogomemoria_3mf_estojo_organizador.3mf`
        : `quebracabeca_3mf_bandeja_molde.3mf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro exportando 3MF da bandeja:", err);
    } finally {
      setIsExporting3MF(false);
    }
  };

  const export3MFCompleteSet = async () => {
    if (finalPieces3D.length === 0) return;
    setIsExporting3MF(true);
    try {
      const isMemory = gameType === "memory";
      const items: ThreeMfMeshItem[] = [];

      // Add each piece with its assigned filament
      finalPieces3D.forEach((p) => {
        const filIdx = getPieceFilamentSlotIndex(
          p.col,
          p.row,
          config3D.columns,
          config3D.rows,
          colorDistributionMode
        );
        const name = isMemory
          ? `Ficha_${p.index + 1}_Par_${(p.pairIndex !== undefined ? p.pairIndex + 1 : 1)}`
          : `Peca_Linha${p.row + 1}_Col${p.col + 1}`;
        items.push({
          geometry: p.geom,
          name,
          filamentIndex: filIdx,
        });
      });

      // Add tray elements if enabled
      if (config3D.generateTray) {
        if (trayFloorGeom3D) {
          items.push({
            geometry: trayFloorGeom3D,
            name: isMemory ? "Estojo_Fundo_Base" : "Bandeja_Fundo_Base",
            filamentIndex: 1,
          });
        }
        if (trayRimGeom3D) {
          items.push({
            geometry: trayRimGeom3D,
            name: isMemory ? "Estojo_Moldura_Borda" : "Bandeja_Moldura_Borda",
            filamentIndex: 1,
          });
        }
      }

      const title = isMemory
        ? `Jogo da Memoria Conjunto Completo Multi-Color ${finalPieces3D.length} Fichas`
        : `Quebra-Cabeca Conjunto Completo Multi-Color ${config3D.columns}x${config3D.rows}`;

      const blob = await generate3MfBlob({
        title,
        designer: "Puzzle Studio 3D",
        filaments: filaments.map(f => ({ name: f.name, color: f.color })),
        items,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = isMemory
        ? `jogomemoria_3mf_conjunto_completo_${finalPieces3D.length}pecas.3mf`
        : `quebracabeca_3mf_conjunto_completo_${config3D.columns}x${config3D.rows}.3mf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro exportando 3MF Completo:", err);
    } finally {
      setIsExporting3MF(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F9FAF4] text-[#1A1C19] font-sans overflow-hidden">
      
      {/* TOP HEADER & STUDIO MODE SWITCHER */}
      <header className="h-14 px-6 bg-white border-b border-[#E2E3DD] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#632CE5]/10 border border-[#632CE5]/40 flex items-center justify-center text-[#632CE5]">
            <Puzzle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-black uppercase tracking-wider text-[#1A1C19]">
                Puzzle & Memory Game AI Studio
              </h1>
              <span className="bg-[#632CE5]/10 text-[#632CE5] border border-[#632CE5]/30 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                2D & 3D
              </span>
            </div>
            <p className="text-[10px] text-[#687064] font-mono">
              Gere com IA, aplique moldes cortantes, exporte para impressão, laser ou 3D
            </p>
          </div>
        </div>

        {/* 2D vs 3D STUDIO TAB */}
        <div className="flex items-center gap-1.5 bg-[#F3F4EE] p-1 rounded-xl border border-[#E2E3DD]">
          <button
            onClick={() => setActiveTab("2d")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "2d"
                ? "bg-[#632CE5] text-white shadow-md shadow-[#632CE5]/20"
                : "text-[#687064] hover:text-[#1A1C19] hover:bg-white"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Estúdio 2D / Laser & Print</span>
          </button>

          <button
            onClick={() => setActiveTab("3d")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "3d"
                ? "bg-[#632CE5] text-white shadow-md shadow-[#632CE5]/20"
                : "text-[#687064] hover:text-[#1A1C19] hover:bg-white"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Estúdio 3D / FDM & Bandeja</span>
          </button>
        </div>
      </header>

      {/* MAIN STUDIO WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* LEFT WORKSPACE: PREVIEW CANVAS */}
        <div className="flex-1 flex flex-col bg-[#F3F4EE] relative overflow-hidden border-r border-[#E2E3DD]">
          
          {/* TAB 2D VIEWPORT */}
          {activeTab === "2d" && (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 flex flex-col p-6 items-center justify-center relative overflow-y-auto transition-colors ${
                isDragging ? "bg-[#632CE5]/5 border-2 border-dashed border-[#632CE5]/40" : ""
              }`}
            >
              
              {/* SUBVIEW CONTROLS FOR 2D */}
              {gameType === "puzzle" && (
                <div className="absolute top-4 left-6 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-[#E2E3DD]">
                  {[
                    { id: "withMold", label: "Imagem com Molde", icon: Eye },
                    { id: "moldOnly", label: "Apenas Linhas de Corte (SVG)", icon: Scissors },
                    { id: "clean", label: "Arte Limpa", icon: FileImage },
                  ].map(b => {
                    const Icon = b.icon;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setPreviewMode2D(b.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          previewMode2D === b.id
                            ? "bg-[#632CE5] text-white shadow-sm"
                            : "text-[#687064] hover:text-[#1A1C19] hover:bg-[#E8E9E3]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* LOADING OVERLAY */}
              {(isProcessing2D || isGeneratingAI) && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md">
                  <Loader2 className="w-12 h-12 text-[#632CE5] animate-spin mb-3" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1A1C19]">
                    {isGeneratingAI ? "Gerando Imagem com IA..." : "Renderizando Molde Vetorial..."}
                  </h3>
                  {generationProgress.message && (
                    <p className="text-[11px] text-[#632CE5] font-mono mt-1 font-bold">
                      {generationProgress.message}
                    </p>
                  )}
                </div>
              )}

              {/* PUZZLE 2D PREVIEW */}
              {gameType === "puzzle" && (
                <div className="flex flex-col items-center justify-center max-w-full max-h-full">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-[#E2E3DD] max-w-[500px] max-h-[500px] bg-white flex items-center justify-center">
                    {previewMode2D === "withMold" && puzzleResult?.imageWithMoldPNG && (
                      <img 
                        src={puzzleResult.imageWithMoldPNG} 
                        alt="Quebra-Cabeça com Molde" 
                        className="w-full h-full object-contain"
                      />
                    )}
                    {previewMode2D === "clean" && (
                      <img 
                        src={currentImage} 
                        alt="Arte Limpa" 
                        className="w-full h-full object-contain"
                      />
                    )}
                    {previewMode2D === "moldOnly" && puzzleResult?.moldSVGOnly && (
                      <div 
                        className="w-[450px] h-[450px] p-6 flex items-center justify-center bg-[#F3F4EE]"
                        dangerouslySetInnerHTML={{ __html: puzzleResult.moldSVGOnly }}
                      />
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-[#687064] font-mono">
                    <span className="bg-white px-2 py-1 rounded border border-[#E2E3DD] text-[#1A1C19]">
                      {difficulty.cols}x{difficulty.rows} ({difficulty.cols * difficulty.rows} Peças)
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-[#E2E3DD] text-[#632CE5] capitalize font-bold">
                      Molde: {moldShape}
                    </span>
                  </div>
                </div>
              )}

              {/* MEMORY GAME 2D PREVIEW */}
              {gameType === "memory" && (
                <div className="flex flex-col items-center justify-center w-full max-w-2xl max-h-full">
                  {memoryResult?.memorySheetPNG ? (
                    <div className="rounded-xl overflow-hidden shadow-2xl border border-[#E2E3DD] max-h-[520px] overflow-y-auto">
                      <img 
                        src={memoryResult.memorySheetPNG} 
                        alt="Folha Jogo da Memória" 
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[#E2E3DD] rounded-2xl text-center">
                      <LayoutGrid className="w-12 h-12 text-[#B0B5A8] mb-3" />
                      <h3 className="text-xs font-bold text-[#1A1C19]">Nenhuma folha gerada ainda</h3>
                      <p className="text-[10px] text-[#687064] mt-1 max-w-sm">
                        Clique em "Gerar Jogo da Memória com IA" ou envie imagens para criar a grade de pares imprimível.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* BOTTOM 2D EXPORT BAR */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 z-20">
                {gameType === "puzzle" && puzzleResult && (
                  <>
                    <button
                      onClick={() => downloadFile(puzzleResult.imageWithMoldPNG, `puzzle_${difficulty.cols}x${difficulty.rows}_com_molde.png`)}
                      className="px-3.5 py-2 rounded-xl bg-[#632CE5] hover:bg-[#7C4DFF] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#632CE5]/20"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar PNG com Molde</span>
                    </button>

                    <button
                      onClick={() => downloadFile(puzzleResult.imageWithMoldSVG, `puzzle_${difficulty.cols}x${difficulty.rows}_laser_print.svg`, true)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3F4EE] text-[#1A1C19] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#E2E3DD]"
                    >
                      <Scissors className="w-3.5 h-3.5 text-[#632CE5]" />
                      <span>SVG Vetorial com Molde</span>
                    </button>

                    <button
                      onClick={() => downloadFile(puzzleResult.moldSVGOnly, `linhas_de_corte_${difficulty.cols}x${difficulty.rows}.svg`, true)}
                      className="px-3 py-2 rounded-xl bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#494455] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#E2E3DD]"
                      title="Linhas vetoriais de corte puras para Cricut, Silhouette, Laser, etc."
                    >
                      <Scissors className="w-3.5 h-3.5 text-red-400" />
                      <span>Apenas Molde de Corte (SVG)</span>
                    </button>
                  </>
                )}

                {gameType === "memory" && memoryResult && (
                  <>
                    <button
                      onClick={() => downloadFile(memoryResult.memorySheetPNG, `jogo_memoria_${memoryResult.pairsCount}_pares.png`)}
                      className="px-4 py-2 rounded-xl bg-[#632CE5] hover:bg-[#7C4DFF] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#632CE5]/20"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Folha do Jogo (PNG)</span>
                    </button>

                    <button
                      onClick={() => downloadFile(memoryResult.memorySheetSVG, `jogo_memoria_${memoryResult.pairsCount}_pares.svg`, true)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3F4EE] text-[#1A1C19] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#E2E3DD]"
                    >
                      <Download className="w-4 h-4 text-[#632CE5]" />
                      <span>Baixar Folha Vetorial (SVG)</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3D VIEWPORT */}
          {activeTab === "3d" && (
            <div className="flex-1 relative">
              {isProcessing3D && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/75 backdrop-blur-md">
                  <Loader2 className="w-12 h-12 text-[#632CE5] animate-spin mb-3" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1A1C19]">Calculando Geometria 3D CSG</h3>
                  <p className="text-[10px] text-[#687064] mt-1">Gerando encaixes e molde dimensional...</p>
                </div>
              )}

              <Canvas shadows camera={{ position: [0, 0, 240], fov: 45 }}>
                <color attach="background" args={["#F3F4EE"]} />
                <ambientLight intensity={0.85} />
                <directionalLight position={[100, 140, 120]} castShadow intensity={1.8} shadow-bias={-0.0001} />
                <directionalLight position={[-100, -80, -60]} intensity={0.5} />
                <directionalLight position={[0, -100, 80]} intensity={0.3} />

                <Center>
                  <group ref={combinedGroupRef} rotation={[0, 0, 0]}>
                    {/* TRAY GEOMETRY */}
                    {config3D.generateTray && (viewMode3D === "both" || viewMode3D === "tray") && (
                      <group 
                        ref={trayGroupRef} 
                        position={[0, 0, -(config3D.explode > 0 ? config3D.explode * 0.8 : 0)]}
                      >
                        {trayFloorGeom3D && (
                          <mesh castShadow receiveShadow geometry={trayFloorGeom3D} position={[0, 0, -config3D.trayFloorThickness]}>
                            <meshStandardMaterial color={filaments[1]?.color || config3D.trayColor} roughness={0.55} metalness={0.15} />
                          </mesh>
                        )}
                        {trayRimGeom3D && (
                          <mesh castShadow receiveShadow geometry={trayRimGeom3D} position={[0, 0, 0]}>
                            <meshStandardMaterial color={filaments[1]?.color || config3D.trayColor} roughness={0.5} metalness={0.2} />
                          </mesh>
                        )}
                      </group>
                    )}

                    {/* PUZZLE / MEMORY PIECES WITH MULTI-FILAMENT COLOR & TEXTURE SUPPORT */}
                    {(viewMode3D === "both" || viewMode3D === "pieces") && (
                      <group ref={piecesGroupRef} position={[0, 0, 0]}>
                        {finalPieces3D.map((g, i) => {
                          const filIdx = getPieceFilamentSlotIndex(
                            g.col,
                            g.row,
                            config3D.columns,
                            config3D.rows,
                            colorDistributionMode
                          );
                          const pieceFilColor = filaments[filIdx]?.color || config3D.pieceColor;
                          
                          // In memory game mode, pick the texture belonging to this card pair
                          const pieceTexture = (gameType === "memory" && g.pairIndex !== undefined)
                            ? (memoryTileTextures[g.pairIndex] || puzzleTexture)
                            : puzzleTexture;

                          const customPieceMat = (shadingMode3D === "textured" && pieceTexture)
                            ? [
                                new THREE.MeshStandardMaterial({
                                  map: pieceTexture,
                                  roughness: 0.35,
                                  metalness: 0.05,
                                }),
                                new THREE.MeshStandardMaterial({
                                  color: filaments[0]?.color || config3D.pieceColor,
                                  roughness: 0.65,
                                  metalness: 0.08,
                                })
                              ]
                            : [
                                new THREE.MeshStandardMaterial({
                                  color: pieceFilColor,
                                  roughness: 0.45,
                                  metalness: 0.12,
                                }),
                                new THREE.MeshStandardMaterial({
                                  color: pieceFilColor,
                                  roughness: 0.65,
                                  metalness: 0.08,
                                })
                              ];

                          return (
                            <mesh 
                              key={i} 
                              castShadow 
                              receiveShadow 
                              geometry={g.geom} 
                              material={customPieceMat}
                              position={[g.x, g.y, (config3D.explode > 0 ? config3D.explode * 1.5 : 0)]}
                            >
                              <lineSegments>
                                <edgesGeometry args={[g.geom, 25]} />
                                <lineBasicMaterial color="#000000" opacity={0.35} transparent />
                              </lineSegments>
                            </mesh>
                          );
                        })}
                      </group>
                    )}
                  </group>
                </Center>

                <ContactShadows position={[0, -110, 0]} opacity={0.5} scale={450} blur={2.5} far={240} />
                <OrbitControls makeDefault />
              </Canvas>

              {/* 3D VIEW & SHADING TOGGLES */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-[#E2E3DD] flex items-center gap-1">
                  <button
                    onClick={() => setShadingMode3D(shadingMode3D === "textured" ? "solid" : "textured")}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      shadingMode3D === "textured"
                        ? "bg-amber-400 text-[#1A1C19] shadow-sm"
                        : "text-[#687064] hover:text-[#1A1C19] hover:bg-[#F3F4EE]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{shadingMode3D === "textured" ? "Arte Real" : "Filamentos"}</span>
                  </button>
                </div>

                <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-[#E2E3DD] flex items-center gap-1">
                  {[
                    { id: "pieces", label: "Peças (Sem Fundo)", icon: Puzzle },
                    { id: "both", label: "Conjunto 3D", icon: Layers },
                    { id: "tray", label: "Apenas Molde / Bandeja", icon: Box }
                  ].map(v => {
                    const Icon = v.icon;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setViewMode3D(v.id as any)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          viewMode3D === v.id
                            ? "bg-[#632CE5] text-white shadow-sm"
                            : "text-[#687064] hover:text-[#1A1C19] hover:bg-[#F3F4EE]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3D BOTTOM ACTIONS (3MF MULTI-COLOR & STL) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center flex-wrap justify-center gap-2 bg-white/95 backdrop-blur-md p-2.5 rounded-2xl border border-[#E2E3DD] shadow-2xl max-w-[95%]">
                {/* 3MF Multi-Color Primary Export */}
                <button
                  onClick={export3MFPiecesOnly}
                  disabled={isProcessing3D || isExporting3MF || finalPieces3D.length === 0}
                  className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#632CE5] to-[#7C4DFF] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-[#632CE5]/20"
                  title="Exporta todas as peças/fichas com metadados de cor de filamento e tags AMS compatíveis com Bambu Studio, OrcaSlicer e PrusaSlicer"
                >
                  {isExporting3MF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" />}
                  <span>{gameType === "memory" ? "Exportar Fichas (.3MF Multi-Cor)" : "Exportar Peças (.3MF Multi-Cor)"}</span>
                </button>

                {config3D.generateTray && (
                  <button
                    onClick={export3MFCompleteSet}
                    disabled={isProcessing3D || isExporting3MF || finalPieces3D.length === 0}
                    className="px-3.5 py-2.5 rounded-xl bg-[#632CE5]/15 hover:bg-[#632CE5]/25 text-[#632CE5] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border border-[#632CE5]/30"
                    title="Exporta o conjunto completo (fichas/peças + estojo/bandeja) com cores de cada filamento atribuídas"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Conjunto (.3MF)</span>
                  </button>
                )}

                {config3D.generateTray && (
                  <button
                    onClick={export3MFTrayOnly}
                    disabled={isProcessing3D || isExporting3MF}
                    className="px-3 py-2.5 rounded-xl bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#494455] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-[#E2E3DD] disabled:opacity-50"
                    title="Exporta apenas o estojo/bandeja em 3MF com a cor do filamento 2"
                  >
                    <Box className="w-3.5 h-3.5 text-[#632CE5]" />
                    <span>{gameType === "memory" ? "Estojo (.3MF)" : "Bandeja (.3MF)"}</span>
                  </button>
                )}

                <div className="h-5 w-px bg-[#E8E9E3] mx-1 hidden sm:block" />

                {/* STL Fallbacks */}
                <button
                  onClick={() => exportMesh(
                    piecesGroupRef.current, 
                    gameType === "memory"
                      ? `jogomemoria_3d_fichas_${finalPieces3D.length}pecas.stl`
                      : `quebracabeca_3d_pecas_${config3D.columns}x${config3D.rows}.stl`
                  )}
                  disabled={isProcessing3D || finalPieces3D.length === 0}
                  className="px-2.5 py-2 rounded-xl bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#687064] hover:text-[#1A1C19] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-[#E2E3DD] disabled:opacity-50"
                  title="Exporta em formato STL clássico (monocromático)"
                >
                  <Download className="w-3 h-3" />
                  <span>STL</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CONTROLS PANEL */}
        <div className="w-full md:w-[400px] bg-white flex flex-col overflow-hidden shrink-0">
          
          {/* GAME TYPE SELECTOR (Puzzle vs Memory) */}
          <div className="p-4 border-b border-[#E2E3DD]">
            <div className="grid grid-cols-2 gap-2 bg-[#F3F4EE] p-1.5 rounded-xl border border-[#E2E3DD]">
              <button
                type="button"
                onClick={() => {
                  setGameType("puzzle");
                  if (moldShape === "square") {
                    setMoldShape("egg");
                  }
                }}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  gameType === "puzzle"
                    ? "bg-[#632CE5] text-white shadow-sm"
                    : "text-[#687064] hover:text-[#1A1C19]"
                }`}
              >
                <Puzzle className="w-4 h-4" />
                <span>Quebra-Cabeça</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGameType("memory");
                  if (moldShape === "egg") {
                    setMoldShape("square");
                  }
                }}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  gameType === "memory"
                    ? "bg-[#632CE5] text-white shadow-sm"
                    : "text-[#687064] hover:text-[#1A1C19]"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Jogo da Memória</span>
              </button>
            </div>
          </div>

          {/* SCROLLABLE SETTINGS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">

            {/* SOURCE SELECTOR: AI vs Upload */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black uppercase tracking-wider text-[#687064] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#632CE5]" /> Origem da Imagem
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImageSource("ai")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    imageSource === "ai"
                      ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]"
                      : "bg-[#F3F4EE]/50 border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Gerar com IA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImageSource("upload")}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    imageSource === "upload"
                      ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]"
                      : "bg-[#F3F4EE]/50 border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Enviar Imagem</span>
                </button>
              </div>

              {/* AI GENERATOR PANEL */}
              {imageSource === "ai" && (
                <div className="p-3.5 rounded-2xl bg-[#F3F4EE]/80 border border-[#632CE5]/30 space-y-3">
                  
                  {/* AI NOTICE BANNER IF ANY */}
                  {aiNotice && (
                    <div className={`p-2.5 rounded-xl border flex items-start gap-2 text-[11px] leading-tight ${
                      aiNotice.type === "success" 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : aiNotice.type === "warning"
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-blue-50 border-blue-300 text-blue-700"
                    }`}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p>{aiNotice.text}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setAiNotice(null)}
                        className="text-[#687064] hover:text-[#1A1C19] p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black uppercase text-[#687064] block mb-1">
                      {gameType === "puzzle" ? "Descreva a Imagem do Quebra-Cabeça" : "Tema do Jogo da Memória"}
                    </label>
                    <textarea
                      rows={2}
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder={gameType === "puzzle" ? "Ex: Ovo de Páscoa mágico decorado com flores e cores vivas..." : "Ex: Animais da Fazenda, Frutas Tropicais, Veículos..."}
                      className="w-full bg-white border border-[#E2E3DD] rounded-xl p-2.5 text-xs text-[#1A1C19] placeholder:text-[#B0B5A8] focus:border-[#632CE5] outline-none resize-none"
                    />
                  </div>

                  {/* QUICK THEME PROMPTS & INSPIRATIONS */}
                  <div>
                    <span className="text-[9px] font-bold text-[#687064] uppercase tracking-wider block mb-1">Temas Rápidos Populares</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { title: "🥚 Ovo de Páscoa Floral", prompt: "Ovo de Páscoa decorado com padrões florais, laço dourado e cores vibrantes", style: "Páscoa / Ovo Decorado", shape: "egg" as MoldShapeType },
                        { title: "🐰 Coelho da Páscoa 3D", prompt: "Coelhinho da Páscoa fofo segurando ovo colorido", style: "3D Cute / Pixar", shape: "egg" as MoldShapeType },
                        { title: "🦁 Leão Safari Fofo", prompt: "Leãozinho simpático na savana com flores tropicais", style: "Desenho infantil", shape: "square" as MoldShapeType },
                        { title: "🚀 Foguete no Espaço", prompt: "Foguete espacial veloz viajando entre planetas e estrelas", style: "Vetor / Cartoon", shape: "star" as MoldShapeType },
                        { title: "🦖 Dinossauro T-Rex", prompt: "Dinossauro T-Rex verde amigável na floresta pré-histórica", style: "Desenho infantil", shape: "rect" as MoldShapeType },
                        { title: "🏰 Castelo Encantado", prompt: "Castelo de conto de fadas sobre as nuvens com arco-íris", style: "Aquarela", shape: "heart" as MoldShapeType },
                      ].map(preset => (
                        <button
                          key={preset.title}
                          type="button"
                          onClick={() => {
                            setAiPrompt(preset.prompt);
                            setAiStyle(preset.style);
                            if (gameType === "puzzle" && preset.shape) {
                              setMoldShape(preset.shape);
                            }
                          }}
                          className="text-[10px] text-left p-1.5 rounded-lg bg-white hover:bg-[#E8E9E3]/90 text-[#1A1C19] hover:text-[#1A1C19] border border-[#E2E3DD] hover:border-[#632CE5]/50 transition-all truncate cursor-pointer"
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI STYLE SELECTION */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-[#687064] block mb-1">Estilo Artístico</label>
                      <select
                        value={aiStyle}
                        onChange={e => setAiStyle(e.target.value)}
                        className="w-full bg-white border border-[#E2E3DD] rounded-xl p-2 text-[11px] text-[#1A1C19] focus:border-[#632CE5] outline-none"
                      >
                        <option value="Desenho infantil">Desenho Infantil</option>
                        <option value="Páscoa / Ovo Decorado">Páscoa / Ovo Decorado</option>
                        <option value="3D Cute / Pixar">3D Pixar</option>
                        <option value="Aquarela">Aquarela Suave</option>
                        <option value="Vetor / Cartoon">Vetor Cartoon</option>
                        <option value="Realista">Realista</option>
                        <option value="Pixel Art">Pixel Art</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-[#687064] block mb-1">Modelo de IA</label>
                      <select
                        value={aiModel}
                        onChange={e => setAiModel(e.target.value)}
                        className="w-full bg-white border border-[#E2E3DD] rounded-xl p-2 text-[11px] text-[#1A1C19] focus:border-[#632CE5] outline-none"
                      >
                        <option value="gemini-3.1-flash-lite-image">Gemini Flash Lite (Rápido)</option>
                        <option value="gemini-3.1-flash-image">Gemini Flash Image (HD)</option>
                      </select>
                    </div>
                  </div>

                  {/* PROGRESS BAR & CURRENT STATUS */}
                  {isGeneratingAI && generationProgress && (
                    <div className="p-3 bg-white/80 rounded-xl border border-[#632CE5]/40 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-[#632CE5] flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{generationProgress.message || "Gerando com IA..."}</span>
                        </span>
                        <span className="font-mono text-[#687064]">
                          {generationProgress.current} / {generationProgress.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E8E9E3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#632CE5] to-purple-500 transition-all duration-300 rounded-full"
                          style={{
                            width: `${Math.max(5, (generationProgress.current / Math.max(1, generationProgress.total)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* GENERATE BUTTON */}
                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI || !aiPrompt.trim()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#632CE5] to-[#7C4DFF] hover:from-[#7C4DFF] hover:to-[#632CE5] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md active:scale-[0.99]"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando Cartas com IA ({generationProgress?.current || 0}/{generationProgress?.total || memoryPairsCount})...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>{gameType === "puzzle" ? "Gerar Imagem com IA" : `Gerar ${memoryPairsCount} Pares Distintos com IA`}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* UPLOAD PANEL */}
              {imageSource === "upload" && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png, image/jpeg, image/webp, image/svg+xml, image/*"
                    multiple={gameType === "memory"}
                    className="hidden"
                  />

                  {/* DROPZONE BOX */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer ${
                      isDragging
                        ? "border-[#632CE5] bg-[#632CE5]/15 scale-[1.01] shadow-lg shadow-[#632CE5]/20"
                        : "border-[#E2E3DD] hover:border-[#632CE5]/70 bg-[#F3F4EE]/50 hover:bg-[#F3F4EE]/80"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#632CE5]/15 border border-[#632CE5]/30 flex items-center justify-center text-[#632CE5]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-[#1A1C19]">
                        {gameType === "memory"
                          ? "Arraste ou clique para enviar fotos das cartas"
                          : "Arraste ou clique para subir sua imagem"}
                      </p>
                      <p className="text-[10px] text-[#687064] mt-1">
                        {gameType === "memory"
                          ? "Selecione uma ou várias imagens (PNG, JPG, WEBP, SVG)"
                          : "Suporta PNG, JPG, WEBP, SVG • Preserva cores e artes internas"}
                      </p>
                    </div>
                  </div>

                  {/* CURRENT UPLOADED PREVIEW THUMBNAIL (PUZZLE) */}
                  {gameType === "puzzle" && currentImage && (
                    <div className="p-3 bg-white rounded-xl border border-[#E2E3DD] flex items-center gap-3">
                      <img
                        src={currentImage}
                        alt="Miniatura"
                        className="w-12 h-12 object-cover rounded-lg border border-[#E2E3DD] shrink-0 bg-[#F3F4EE]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#632CE5] shrink-0" />
                          <p className="text-[11px] font-bold text-[#1A1C19] truncate">
                            {uploadedFileName || "Imagem ativa carregada"}
                          </p>
                        </div>
                        <p className="text-[9px] text-[#687064] font-mono mt-0.5">Pronta para aplicar moldes e corte</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#632CE5] hover:text-[#1A1C19] text-[10px] font-bold border border-[#E2E3DD] transition-colors cursor-pointer shrink-0"
                      >
                        Trocar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CURRENT MEMORY CARDS LIST (AI OR UPLOAD) */}
              {gameType === "memory" && memoryCards.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-[#E2E3DD] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#1A1C19]">
                      {memoryCards.length} {memoryCards.length === 1 ? "Carta Carregada" : "Cartas Geradas/Carregadas"} ({memoryCards.length} Pares)
                    </span>
                    <button
                      type="button"
                      onClick={() => setMemoryCards([])}
                      className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Limpar Todas</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {memoryCards.map((card, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setCurrentImage(card)}
                        className="relative group rounded-lg overflow-hidden border border-[#E2E3DD] hover:border-[#632CE5] aspect-square bg-[#F3F4EE] cursor-pointer"
                        title={`Clique para selecionar como ativa ou remover • Carta ${idx + 1}`}
                      >
                        <img src={card} alt={`Carta ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-white/70 text-[8px] font-mono text-[#1A1C19]">
                          #{idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMemoryCards(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute inset-0 bg-white/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400 cursor-pointer"
                          title="Remover esta carta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {imageSource === "upload" && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-1.5 rounded-lg bg-[#F3F4EE] hover:bg-[#E8E9E3] text-[#632CE5] text-[10px] font-bold border border-[#E2E3DD] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Adicionar Mais Cartas</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* MOLD / TOKEN SHAPE SELECTOR */}
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black uppercase tracking-wider text-[#687064] flex items-center gap-1.5">
                  <Shapes className="w-3.5 h-3.5 text-[#632CE5]" /> {gameType === "puzzle" ? "Formato do Molde" : "Formato das Fichas 3D"}
                </span>
                <span className="text-[10px] text-[#632CE5] font-bold uppercase">
                  {moldShape}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                {(gameType === "puzzle"
                  ? [
                      { id: "egg", label: "Ovo", icon: "🥚" },
                      { id: "rect", label: "Retângulo", icon: "⬛" },
                      { id: "square", label: "Quadrado", icon: "⏹️" },
                      { id: "circle", label: "Círculo", icon: "⚪" },
                      { id: "heart", label: "Coração", icon: "❤️" },
                      { id: "star", label: "Estrela", icon: "⭐" },
                      { id: "hexagon", label: "Hexágono", icon: "⬡" },
                      { id: "shield", label: "Escudo", icon: "🛡️" },
                    ]
                  : [
                      { id: "square", label: "Quadrado", icon: "⏹️" },
                      { id: "circle", label: "Ficha / Moeda", icon: "⚪" },
                      { id: "hexagon", label: "Hexágono", icon: "⬡" },
                      { id: "rect", label: "Retângulo", icon: "⬛" },
                      { id: "shield", label: "Escudo", icon: "🛡️" },
                      { id: "heart", label: "Coração", icon: "❤️" },
                      { id: "star", label: "Estrela", icon: "⭐" },
                      { id: "egg", label: "Ovo", icon: "🥚" },
                    ]
                ).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setMoldShape(s.id as MoldShapeType)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      moldShape === s.id
                        ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5] font-bold"
                        : "bg-white border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                    }`}
                  >
                    <span className="text-base">{s.icon}</span>
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* DIFFICULTY / PIECES COUNT */}
            {gameType === "puzzle" ? (
              <div className="space-y-3 p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black uppercase tracking-wider text-[#687064] flex items-center gap-1.5">
                    <Grid3X3 className="w-3.5 h-3.5 text-[#632CE5]" /> Dificuldade / Peças
                  </span>
                  <span className="text-[10px] text-[#632CE5] font-mono font-bold">
                    {difficulty.cols * difficulty.rows} Peças
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                  {[
                    { label: "Fácil", r: 2, c: 2, count: 4 },
                    { label: "Infantil", r: 3, c: 3, count: 9 },
                    { label: "Médio", r: 4, c: 4, count: 16 },
                    { label: "Avançado", r: 5, c: 5, count: 25 },
                  ].map(d => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setDifficulty({ rows: d.r, cols: d.c })}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                        difficulty.rows === d.r && difficulty.cols === d.c
                          ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5] font-bold"
                          : "bg-white border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                      }`}
                    >
                      <span className="font-black">{d.count} pcs</span>
                      <span className="text-[8px] text-[#687064] font-mono">{d.c}x{d.r}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black uppercase tracking-wider text-[#687064] flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-[#632CE5]" /> Quantidade de Pares
                  </span>
                  <span className="text-[10px] text-[#632CE5] font-mono font-bold">
                    {memoryPairsCount} Pares ({memoryPairsCount * 2} Cartas)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                  {[4, 6, 8, 12].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMemoryPairsCount(count)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                        memoryPairsCount === count
                          ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5] font-bold"
                          : "bg-white border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                      }`}
                    >
                      <span className="font-black">{count} Pares</span>
                      <span className="text-[8px] text-[#687064] font-mono">{count * 2} Cartas</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CUT STYLES & RICH VARIATIONS (PUZZLE) */}
            {gameType === "puzzle" && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black uppercase tracking-wider text-[#687064] flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-[#632CE5]" /> Variação dos Cortes
                  </span>
                  <button
                    type="button"
                    onClick={() => setSeed3D(s => s + 1)}
                    className="px-2 py-1 rounded-lg bg-[#E8E9E3] hover:bg-[#E2E3DD] text-[#632CE5] hover:text-[#1A1C19] text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-[#E2E3DD] shadow-sm active:scale-95"
                    title="Gerar nova variação de formatos e curvas"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Embaralhar Cortes</span>
                  </button>
                </div>

                {/* CUT STYLE SELECTOR */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-bold text-[#687064]">Estilo das Abas e Encaixes</span>
                    <span className="text-[9px] text-[#632CE5] font-mono capitalize">
                      {config3D.tabType === "classic" && "Clássico"}
                      {config3D.tabType === "organic" && "Orgânico Sinuoso"}
                      {config3D.tabType === "wave" && "Ondulado Suave"}
                      {config3D.tabType === "round" && "Arredondado"}
                      {config3D.tabType === "spiral" && "Espiral Gótico"}
                      {config3D.tabType === "victorian" && "Vitoriano Nobre"}
                      {config3D.tabType === "mixed" && "Misto (Ultra Variado)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    {[
                      { id: "classic", label: "Clássico", desc: "Encaixe firme", icon: "🧩" },
                      { id: "organic", label: "Orgânico", desc: "Curvas fluidas", icon: "🌿" },
                      { id: "wave", label: "Ondulado", desc: "Ondas suaves", icon: "🌊" },
                      { id: "round", label: "Botão", desc: "Arredondado", icon: "🔘" },
                      { id: "spiral", label: "Espiral", desc: "Orelha gótica", icon: "🌀" },
                      { id: "victorian", label: "Vitoriano", desc: "Vintage nobre", icon: "👑" },
                    ].map(style => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setConfig3D(p => ({ ...p, tabType: style.id as CutStyleType }))}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 text-center transition-all cursor-pointer ${
                          config3D.tabType === style.id
                            ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5] font-bold shadow-sm ring-1 ring-[#632CE5]/40"
                            : "bg-white border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                        }`}
                      >
                        <span className="text-sm">{style.icon}</span>
                        <span className="font-bold leading-tight">{style.label}</span>
                        <span className="text-[8px] text-[#687064] truncate leading-tight">{style.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* ULTRA VARIED (MIXED) HERO BUTTON */}
                  <button
                    type="button"
                    onClick={() => setConfig3D(p => ({ ...p, tabType: "mixed" }))}
                    className={`w-full mt-1.5 p-2 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                      config3D.tabType === "mixed"
                        ? "bg-gradient-to-r from-[#632CE5]/20 to-purple-500/20 border-[#632CE5] text-[#632CE5] font-bold shadow-sm ring-1 ring-[#632CE5]/40"
                        : "bg-white border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">✨</span>
                      <div className="text-left">
                        <p className="font-bold text-[11px] leading-tight">Misto & Único (Ultra Variado)</p>
                        <p className="text-[9px] text-[#687064] leading-tight">Cada borda recebe uma forma e curvatura diferente</p>
                      </div>
                    </div>
                    {config3D.tabType === "mixed" && (
                      <CheckCircle2 className="w-4 h-4 text-[#632CE5]" />
                    )}
                  </button>
                </div>

                {/* IRREGULARITY & ASSYMETRY SLIDER */}
                <div className="space-y-2 pt-2 border-t border-[#E2E3DD]/60 text-[10px]">
                  <div className="flex justify-between text-[#687064]">
                    <span className="font-medium">Assimetria & Deformação Orgânica</span>
                    <span className="text-[#632CE5] font-bold">
                      {Math.round(config3D.irregularity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0" max="1" step="0.05"
                    value={config3D.irregularity}
                    onChange={e => setConfig3D(p => ({ ...p, irregularity: parseFloat(e.target.value) }))}
                    className="w-full accent-[#632CE5]"
                  />
                  <div className="flex justify-between text-[8px] text-[#687064] font-mono">
                    <span>0% (Grade Padrão)</span>
                    <span>50% (Equilibrado)</span>
                    <span>100% (Artesanal Livre)</span>
                  </div>

                  {/* TAB SIZE SLIDER */}
                  <div className="flex justify-between text-[#687064] pt-1.5">
                    <span className="font-medium">Proporção dos Encaixes (Abas)</span>
                    <span className="text-[#632CE5] font-bold">{Math.round(config3D.tabSize * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.15" max="0.45" step="0.01"
                    value={config3D.tabSize}
                    onChange={e => setConfig3D(p => ({ ...p, tabSize: parseFloat(e.target.value) }))}
                    className="w-full accent-[#632CE5]"
                  />
                </div>
              </div>
            )}

            {/* 3D TRAY & DIMENSIONS SETTINGS (WHEN IN 3D TAB) */}
            {activeTab === "3d" && (
              <div className="space-y-3">
                {/* 3D PIECES & DIMENSIONS */}
                <div className="p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1C19] text-xs flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-[#632CE5]" /> Dimensões e Peças 3D
                    </span>
                    <span className="text-[10px] text-[#632CE5] font-mono font-bold">
                      {config3D.width} × {config3D.height} mm
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1 text-[10px]">
                    <div className="flex justify-between text-[#687064]">
                      <span>Largura</span>
                      <span className="text-[#632CE5] font-bold">{config3D.width} mm</span>
                    </div>
                    <input
                      type="range"
                      min="80" max="220" step="5"
                      value={config3D.width}
                      onChange={e => setConfig3D(p => ({ ...p, width: parseInt(e.target.value) }))}
                      className="w-full accent-[#632CE5]"
                    />

                    <div className="flex justify-between text-[#687064]">
                      <span>Altura</span>
                      <span className="text-[#632CE5] font-bold">{config3D.height} mm</span>
                    </div>
                    <input
                      type="range"
                      min="80" max="220" step="5"
                      value={config3D.height}
                      onChange={e => setConfig3D(p => ({ ...p, height: parseInt(e.target.value) }))}
                      className="w-full accent-[#632CE5]"
                    />

                    <div className="flex justify-between text-[#687064]">
                      <span>Espessura das Peças</span>
                      <span className="text-[#632CE5] font-bold">{config3D.thickness} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.5" max="8.0" step="0.5"
                      value={config3D.thickness}
                      onChange={e => setConfig3D(p => ({ ...p, thickness: parseFloat(e.target.value) }))}
                      className="w-full accent-[#632CE5]"
                    />

                    <div className="flex justify-between text-[#687064]">
                      <span>Explosão / Separação</span>
                      <span className="text-[#632CE5] font-bold">{config3D.explode} mm</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="20" step="0.5"
                      value={config3D.explode}
                      onChange={e => setConfig3D(p => ({ ...p, explode: parseFloat(e.target.value) }))}
                      className="w-full accent-[#632CE5]"
                    />

                    {/* Cor do Verso / Substrato das Peças */}
                    <div className="pt-2 border-t border-[#E2E3DD]/80">
                      <span className="text-[#687064] block mb-1.5 font-medium">Cor do Verso e Laterais (MDF / Filamento)</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { name: "MDF Cru", color: "#D4B996" },
                          { name: "Madeira Escura", color: "#854D0E" },
                          { name: "Branco", color: "#F8FAFC" },
                          { name: "Carvão", color: "#1E293B" },
                          { name: "Ciano Neon", color: "#632CE5" },
                          { name: "Terracota", color: "#C2410C" }
                        ].map(c => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => setConfig3D(p => ({ ...p, pieceColor: c.color }))}
                            className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                              config3D.pieceColor === c.color ? "ring-2 ring-[#632CE5] scale-110 border-white" : "border-[#E2E3DD] opacity-80"
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* MULTI-FILAMENT & 3MF COLOR MANAGEMENT */}
                <div className="p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1C19] text-xs flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-[#632CE5]" /> Filamentos & Cores (.3MF)
                    </span>
                    <span className="text-[9px] bg-[#632CE5]/20 text-[#632CE5] px-1.5 py-0.5 rounded font-black">
                      AMS / Multi-Cor
                    </span>
                  </div>

                  {/* PRESET PALETTES */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-[#687064] font-medium block">Paletas de Cores Rápidas:</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {FILAMENT_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => applyFilamentPreset(preset)}
                          className="w-full p-2 rounded-xl bg-white hover:bg-[#E8E9E3]/80 border border-[#E2E3DD] flex items-center justify-between transition-all cursor-pointer group"
                        >
                          <div className="text-left">
                            <span className="text-[11px] font-bold text-[#1A1C19] block group-hover:text-[#632CE5]">
                              {preset.name}
                            </span>
                            <span className="text-[9px] text-[#687064] block">
                              {preset.desc}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[preset.f1, preset.f2, preset.f3, preset.f4].map((c, ci) => (
                              <div
                                key={ci}
                                className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* COLOR DISTRIBUTION MODE */}
                  <div className="space-y-1.5 pt-2 border-t border-[#E2E3DD]/80 text-[10px]">
                    <span className="text-[#687064] font-medium block">Distribuição de Cores nas Peças:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "uniform", label: "Mono-Cor (Slot 1)", desc: "1 filamento" },
                        { id: "checkerboard", label: "Xadrez (2 Cores)", desc: "Slot 1 e 3" },
                        { id: "ams4", label: "AMS Quad (4 Cores)", desc: "Slots 1, 3, 4, 5" },
                        { id: "rows", label: "Listrado por Linha", desc: "Slots alternados" },
                        { id: "columns", label: "Listrado por Coluna", desc: "Slots alternados" },
                      ].map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setColorDistributionMode(mode.id as any)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            colorDistributionMode === mode.id
                              ? "bg-[#632CE5]/15 border-[#632CE5] text-[#632CE5] ring-1 ring-[#632CE5]/30 font-bold"
                              : "bg-white border-[#E2E3DD] text-[#687064] hover:text-[#1A1C19]"
                          } ${mode.id === "ams4" ? "col-span-2" : ""}`}
                        >
                          <span className="text-[10px] font-bold block">{mode.label}</span>
                          <span className="text-[8px] opacity-70 block">{mode.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CUSTOM FILAMENT SLOTS */}
                  <div className="space-y-2 pt-2 border-t border-[#E2E3DD]/80 text-[10px]">
                    <span className="text-[#687064] font-medium block">Slots de Filamento Individuais:</span>
                    <div className="space-y-1.5">
                      {filaments.map((slot, idx) => (
                        <div 
                          key={slot.id} 
                          className="flex items-center justify-between p-1.5 rounded-xl bg-white border border-[#E2E3DD]/80"
                        >
                          <div className="flex items-center gap-2">
                            <label className="relative cursor-pointer">
                              <input
                                type="color"
                                value={slot.color}
                                onChange={(e) => updateFilamentColor(idx, e.target.value)}
                                className="w-6 h-6 rounded-lg opacity-0 absolute inset-0 cursor-pointer"
                              />
                              <div 
                                className="w-6 h-6 rounded-lg border border-white/20 shadow-inner flex items-center justify-center text-[10px] font-bold"
                                style={{ backgroundColor: slot.color }}
                              />
                            </label>
                            <div>
                              <span className="font-bold text-[#1A1C19] block text-[10px]">{slot.name}</span>
                              <span className="text-[8px] font-mono text-[#687064] uppercase">{slot.color}</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-[#687064] font-mono px-2 py-0.5 rounded bg-[#F3F4EE] border border-[#E2E3DD]">
                            Slot #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3MF SLICER INFO */}
                  <div className="p-2.5 rounded-xl bg-[#632CE5]/5 border border-[#632CE5]/20 text-[9px] text-[#687064] space-y-1">
                    <p className="font-bold text-[#632CE5] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[#632CE5]" /> 100% Compatível com:
                    </p>
                    <p className="text-[#687064] leading-relaxed">
                      Bambu Studio (AMS 4 Cores), OrcaSlicer, PrusaSlicer (MMU), Creality Print e Anycubic. O arquivo .3MF já contém os IDs e cores de cada material.
                    </p>
                  </div>
                </div>

                {/* TRAY & CLEARANCE */}
                <div className="p-3.5 rounded-2xl bg-[#F3F4EE]/60 border border-[#E2E3DD] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1C19] text-xs flex items-center gap-1.5">
                      <Box className="w-4 h-4 text-[#632CE5]" /> Molde e Bandeja 3D
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfig3D(p => ({ ...p, generateTray: !p.generateTray }))}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                        config3D.generateTray ? "bg-[#632CE5] text-white" : "bg-[#E8E9E3] text-[#687064]"
                      }`}
                    >
                      {config3D.generateTray ? "Ativado" : "Desativado"}
                    </button>
                  </div>

                  {config3D.generateTray && (
                    <div className="space-y-2.5 pt-2 border-t border-[#E2E3DD]/80 text-[10px]">
                      {/* Cor da Bandeja */}
                      <div>
                        <span className="text-[#687064] block mb-1">Cor do Molde / Bandeja</span>
                        <div className="flex items-center gap-1.5">
                          {[
                            { name: "Slate", color: "#334155" },
                            { name: "Madeira", color: "#B45309" },
                            { name: "Carvão", color: "#1E293B" },
                            { name: "Gelo", color: "#E2E8F0" },
                            { name: "Ciano", color: "#632CE5" }
                          ].map(c => (
                            <button
                              key={c.color}
                              type="button"
                              onClick={() => setConfig3D(p => ({ ...p, trayColor: c.color }))}
                              className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                                config3D.trayColor === c.color ? "ring-2 ring-[#632CE5] scale-110 border-white" : "border-[#E2E3DD] opacity-80"
                              }`}
                              style={{ backgroundColor: c.color }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between text-[#687064]">
                        <span>Altura da Borda</span>
                        <span className="text-[#632CE5] font-bold">{config3D.trayRimHeight} mm</span>
                      </div>
                      <input
                        type="range"
                        min="2.0" max="8.0" step="0.5"
                        value={config3D.trayRimHeight}
                        onChange={e => setConfig3D(p => ({ ...p, trayRimHeight: parseFloat(e.target.value) }))}
                        className="w-full accent-[#632CE5]"
                      />

                      <div className="flex justify-between text-[#687064]">
                        <span>Folga de Encaixe (Tolerância)</span>
                        <span className="text-[#632CE5] font-bold">{config3D.trayTolerance} mm</span>
                      </div>
                      <input
                        type="range"
                        min="0.4" max="3.0" step="0.2"
                        value={config3D.trayTolerance}
                        onChange={e => setConfig3D(p => ({ ...p, trayTolerance: parseFloat(e.target.value) }))}
                        className="w-full accent-[#632CE5]"
                      />

                      <div className="flex items-center justify-between pt-1 border-t border-[#E2E3DD]/60">
                        <span className="text-[#687064]">Furo de Extração Traseiro</span>
                        <button
                          type="button"
                          onClick={() => setConfig3D(p => ({ ...p, hasFingerHole: !p.hasFingerHole }))}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            config3D.hasFingerHole ? "bg-[#632CE5]/20 text-[#632CE5] border border-[#632CE5]/40" : "bg-[#E8E9E3] text-[#687064]"
                          }`}
                        >
                          {config3D.hasFingerHole ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
