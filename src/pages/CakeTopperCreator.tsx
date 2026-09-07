import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Center, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  useCakeTopperCreator,
} from "../hooks/useCakeTopperCreator";
import {
  TopperConfig,
  TopperElement,
  THEMES,
  SHAPE_PRESETS,
  TOPPER_FONTS,
  createTextGeometry,
  createPlateGeometry,
  createStickGeometry,
  createShapeElement,
} from "../lib/cakeTopper/cakeTopperGeometry";
import {
  Cake, Download, Type, Hash, Shapes, Palette, LayoutTemplate,
  Settings, Sliders, Eye, RotateCcw, Check, Info, Sparkles, Box,
  Maximize, Minimize, Move, Trash2, Copy, Undo2, Redo2, Grid3x3,
  Ruler, Mountain, Flower, Heart, Star, Crown, Circle, Triangle,
  Square, Hexagon, Cloud, Sun, Moon, Plus, Minus, AlignLeft,
  AlignCenter, AlignRight, Group, Ungroup, AlertTriangle, CheckCircle2,
  XCircle, Layers, Sticker, Wand2, RefreshCw, Save, FolderOpen,
  ZoomIn, ZoomOut, RotateCw, EyeOff, PenTool, ArrowRight,
  ChevronDown, ChevronRight, TriangleRight, Diamond, Snowflake,
  ImagePlus, Upload, Image,
} from "lucide-react";

// --- 3D SCENE COMPONENT ---
function TopperScene({ config, modelColor, showCakePreview, showGrid, showDimensions }: {
  config: TopperConfig;
  modelColor: string;
  showCakePreview: boolean;
  showGrid: boolean;
  showDimensions: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Plate
  const plateMesh = useMemo(() => {
    const mesh = createPlateGeometry(
      config.plateWidth / 10,
      config.plateHeight / 10,
      config.plateThickness / 10,
      config.plateCornerRadius / 10,
      modelColor
    );
    return mesh;
  }, [config.plateWidth, config.plateHeight, config.plateThickness, config.plateCornerRadius, modelColor]);

  // Border
  const borderMesh = useMemo(() => {
    if (!config.showBorder || config.borderWidth <= 0) return null;
    const outer = createPlateGeometry(
      config.plateWidth / 10 + config.borderWidth / 5,
      config.plateHeight / 10 + config.borderWidth / 5,
      config.plateThickness / 10,
      (config.plateCornerRadius + config.borderWidth) / 10,
      config.borderColor
    );
    return outer;
  }, [config.plateWidth, config.plateHeight, config.plateThickness, config.plateCornerRadius, config.showBorder, config.borderWidth, config.borderColor]);

  // Text geometry (main text + subtitle)
  const [textGeom, setTextGeom] = useState<THREE.BufferGeometry | null>(null);
  const [subTextGeom, setSubTextGeom] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (config.text) {
      createTextGeometry(config.text, config.fontFamily, config.fontSize / 10, config.textThickness / 10, config.letterSpacing / 10)
        .then(({ geometry }) => {
          if (!cancelled) setTextGeom(geometry);
        })
        .catch(() => { if (!cancelled) setTextGeom(null); });
    } else {
      setTextGeom(null);
    }
    if (config.subtitle) {
      createTextGeometry(config.subtitle, config.fontFamily, (config.fontSize * 0.6) / 10, config.textThickness / 10, config.letterSpacing / 10)
        .then(({ geometry }) => {
          if (!cancelled) setSubTextGeom(geometry);
        })
        .catch(() => { if (!cancelled) setSubTextGeom(null); });
    } else {
      setSubTextGeom(null);
    }
    return () => { cancelled = true; };
  }, [config.text, config.subtitle, config.fontFamily, config.fontSize, config.textThickness, config.letterSpacing]);

  // Element geometries
  const elementGeoms = useMemo(() => {
    return config.elements.map((el) => {
      if (el.type === "shape" && el.shapeType) {
        return { el, mesh: createShapeElement(el.shapeType, (el.fontSize || 10) / 10, config.textThickness / 10, el.color) };
      }
      if (el.type === "image" && el.svgData) {
        try {
          const parser = new SVGLoader();
          const svgData = parser.parse(el.svgData);
          const allPoints: THREE.Vector2[] = [];
          for (const path of svgData.paths) {
            for (const sub of path.subPaths) {
              const pts = sub.getPoints(20);
              pts.forEach((p) => allPoints.push(p));
            }
          }
          if (allPoints.length === 0) return { el, mesh: null };
          const box = new THREE.Box2();
          allPoints.forEach((p) => box.expandByPoint(p));
          const sizeX = box.max.x - box.min.x;
          const sizeY = box.max.y - box.min.y;
          const maxDim = Math.max(sizeX, sizeY) || 1;
          const targetSize = (el.widthMm || 30) / 10;
          const scaleF = targetSize / maxDim;
          const cx = (box.min.x + box.max.x) / 2;
          const cy = (box.min.y + box.max.y) / 2;

          // Find the largest filled shape
          let bestShape: THREE.Shape | null = null;
          let bestArea = 0;
          for (const path of svgData.paths) {
            const isFilled = !!(path.userData as any)?.style?.fill;
            if (!isFilled) continue;
            for (const sub of path.subPaths) {
              const pts = sub.getPoints(20);
              if (pts.length < 3) continue;
              const shape = new THREE.Shape();
              shape.moveTo((pts[0].x - cx) * scaleF, -(pts[0].y - cy) * scaleF);
              for (let i = 1; i < pts.length; i++) {
                shape.lineTo((pts[i].x - cx) * scaleF, -(pts[i].y - cy) * scaleF);
              }
              shape.closePath();
              const bbox = new THREE.Box2();
              shape.getPoints().forEach((p) => bbox.expandByPoint(p));
              const sz = new THREE.Vector2();
              bbox.getSize(sz);
              const area = sz.x * sz.y;
              if (area > bestArea) { bestArea = area; bestShape = shape; }
            }
          }
          if (!bestShape) return { el, mesh: null };

          const geom = new THREE.ExtrudeGeometry(bestShape, {
            depth: config.textThickness / 10,
            bevelEnabled: false,
          });
          geom.computeVertexNormals();
          const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: el.color, side: THREE.DoubleSide }));
          return { el, mesh };
        } catch {
          return { el, mesh: null };
        }
      }
      return { el, mesh: null };
    });
  }, [config.elements, config.textThickness]);

  // Sticks
  const stickMeshes = useMemo(() => {
    return config.sticks.map((stick) => ({
      stick,
      mesh: createStickGeometry(stick.height / 10, stick.thickness / 10, stick.width / 10, config.stickColor),
    }));
  }, [config.sticks, config.stickColor]);

  return (
    <group ref={groupRef}>
      {/* Border behind plate */}
      {borderMesh && (
        <primitive object={borderMesh} position={[0, 0, -config.borderWidth / 20]} />
      )}

      {/* Main plate */}
      <primitive object={plateMesh} />

      {/* Main text */}
      {textGeom && (
        <mesh geometry={textGeom} position={[0, 0, config.plateThickness / 10]}>
          <meshStandardMaterial color={config.textColor} />
        </mesh>
      )}

      {/* Subtitle text */}
      {subTextGeom && (
        <mesh geometry={subTextGeom} position={[0, -(config.plateHeight / 10) * 0.3, config.plateThickness / 10]}>
          <meshStandardMaterial color={config.textColor} />
        </mesh>
      )}

      {/* Decorative elements */}
      {elementGeoms.map(({ el, mesh }) =>
        mesh ? (
          <primitive
            key={el.id}
            object={mesh}
            position={[el.x / 10, el.y / 10, config.plateThickness / 10]}
            scale={[el.scale, el.scale, el.scale]}
            rotation={[0, 0, (el.rotation * Math.PI) / 180]}
          />
        ) : null
      )}

      {/* Sticks */}
      {stickMeshes.map(({ stick, mesh }) => (
        <primitive
          key={stick.id}
          object={mesh}
          position={[stick.x / 10, -config.plateHeight / 20, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}

      {/* Cake preview */}
      {showCakePreview && (
        <group position={[0, -config.plateHeight / 20 - config.stickHeight / 20 - 2, 0]}>
          <mesh>
            <cylinderGeometry args={[3, 3, 2, 32]} />
            <meshStandardMaterial color="#F5E6D3" />
          </mesh>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[3.1, 3, 0.3, 32]} />
            <meshStandardMaterial color="#FFF5E6" />
          </mesh>
        </group>
      )}

      {/* Dimensions display */}
      {showDimensions && (
        <group>
          {/* Width indicator */}
          <mesh position={[0, -(config.plateHeight / 10 + 1) / 2 - 0.5, 0]}>
            <boxGeometry args={[config.plateWidth / 10, 0.05, 0.05]} />
            <meshBasicMaterial color="#632CE5" />
          </mesh>
          {/* Height indicator */}
          <mesh position={[config.plateWidth / 10 / 2 + 0.5, 0, 0]}>
            <boxGeometry args={[0.05, config.plateHeight / 10, 0.05]} />
            <meshBasicMaterial color="#632CE5" />
          </mesh>
        </group>
      )}
    </group>
  );
}

// --- 2D CANVAS PREVIEW ---
function Canvas2DPreview({ config }: { config: TopperConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 600;
    const h = 400;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#F9FAF4";
    ctx.fillRect(0, 0, w, h);

    const scale = Math.min(w / (config.plateWidth + 20), h / (config.plateHeight + config.stickHeight + 20));
    const cx = w / 2;
    const cy = h / 2 - config.stickHeight * scale * 0.2;

    // Draw sticks
    ctx.fillStyle = config.stickColor;
    for (const stick of config.sticks) {
      const sx = cx + stick.x * scale;
      const sy = cy + (config.plateHeight / 2) * scale;
      ctx.fillRect(
        sx - (stick.width / 2) * scale,
        sy,
        stick.width * scale,
        stick.height * scale
      );
    }

    // Draw plate
    const pw = config.plateWidth * scale;
    const ph = config.plateHeight * scale;
    const pr = config.plateCornerRadius * scale;

    ctx.fillStyle = modelColor;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    ctx.fill();

    // Border
    if (config.showBorder) {
      ctx.strokeStyle = config.borderColor;
      ctx.lineWidth = config.borderWidth * scale;
      ctx.beginPath();
      ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = config.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fs = config.fontSize * scale * 0.8;
    ctx.font = `bold ${fs}px Arial`;
    ctx.fillText(config.text, cx, cy - ph * 0.1);

    // Subtitle
    if (config.subtitle) {
      ctx.font = `bold ${fs * 0.6}px Arial`;
      ctx.fillText(config.subtitle, cx, cy + ph * 0.2);
    }

    // Elements
    for (const el of config.elements) {
      const ex = cx + el.x * scale;
      const ey = cy - el.y * scale;
      ctx.fillStyle = el.color;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.scale(el.scale, el.scale);

      if (el.type === "shape") {
        drawShapeOnCanvas(ctx, el.shapeType || "circulo", (el.fontSize || 10) * scale * 0.5);
      } else if (el.type === "image" && el.svgData) {
        // Draw SVG silhouette on canvas
        try {
          const parser = new SVGLoader();
          const svgData = parser.parse(el.svgData);
          const allPoints: THREE.Vector2[] = [];
          for (const path of svgData.paths) {
            for (const sub of path.subPaths) {
              const pts = sub.getPoints(12);
              pts.forEach((p) => allPoints.push(p));
            }
          }
          if (allPoints.length > 0) {
            const box = new THREE.Box2();
            allPoints.forEach((p) => box.expandByPoint(p));
            const sizeX = box.max.x - box.min.x;
            const sizeY = box.max.y - box.min.y;
            const maxDim = Math.max(sizeX, sizeY) || 1;
            const targetSize = (el.widthMm || 30) * scale * 0.5;
            const sc = targetSize / maxDim;
            const centerX = (box.min.x + box.max.x) / 2;
            const centerY = (box.min.y + box.max.y) / 2;

            for (const path of svgData.paths) {
              const isFilled = !!(path.userData as any)?.style?.fill;
              if (!isFilled) continue;
              for (const sub of path.subPaths) {
                const pts = sub.getPoints(12);
                if (pts.length < 3) continue;
                ctx.beginPath();
                ctx.moveTo((pts[0].x - centerX) * sc, -(pts[0].y - centerY) * sc);
                for (let i = 1; i < pts.length; i++) {
                  ctx.lineTo((pts[i].x - centerX) * sc, -(pts[i].y - centerY) * sc);
                }
                ctx.closePath();
                ctx.fill();
              }
            }
          }
        } catch { /* SVG parse failed silently in 2D preview */ }
      } else {
        const efs = (el.fontSize || config.fontSize) * scale * 0.8;
        ctx.font = `bold ${efs}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.content, 0, 0);
      }
      ctx.restore();
    }
  }, [config]);

  const modelColor = config.plateColor;

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain"
      style={{ maxWidth: "100%", maxHeight: "100%" }}
    />
  );
}

function drawShapeOnCanvas(ctx: CanvasRenderingContext2D, shapeType: string, size: number) {
  ctx.beginPath();
  switch (shapeType) {
    case "estrela": {
      const spikes = 5;
      const outerR = size / 2;
      const innerR = size / 4.5;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case "coracao": {
      const r = size / 4;
      ctx.moveTo(0, -r * 0.5);
      ctx.bezierCurveTo(0, -r * 1.5, -r * 2, -r * 1.5, -r * 2, -r * 0.5);
      ctx.bezierCurveTo(-r * 2, r * 0.5, 0, r * 1.2, 0, r * 1.8);
      ctx.bezierCurveTo(0, r * 1.2, r * 2, r * 0.5, r * 2, -r * 0.5);
      ctx.bezierCurveTo(r * 2, -r * 1.5, 0, -r * 1.5, 0, -r * 0.5);
      break;
    }
    case "circulo":
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      break;
    case "quadrado":
      ctx.rect(-size / 2, -size / 2, size, size);
      break;
    case "losango":
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size / 2, 0);
      ctx.lineTo(0, -size / 2);
      ctx.lineTo(-size / 2, 0);
      ctx.closePath();
      break;
    case "triangulo":
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size / 2, -size / 2);
      ctx.lineTo(-size / 2, -size / 2);
      ctx.closePath();
      break;
    case "coroa": {
      const w = size, h = size * 0.6;
      ctx.moveTo(-w / 2, -h / 3);
      ctx.lineTo(-w / 2, h / 3);
      ctx.lineTo(-w / 4, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(w / 4, 0);
      ctx.lineTo(w / 2, h / 3);
      ctx.lineTo(w / 2, -h / 3);
      ctx.closePath();
      break;
    }
    case "balao": {
      const r2 = size / 3;
      ctx.arc(0, -r2 * 0.3, r2, 0, Math.PI * 2);
      ctx.moveTo(-r2 * 0.3, r2 * 0.5);
      ctx.lineTo(0, r2 * 1.2);
      ctx.lineTo(r2 * 0.3, r2 * 0.5);
      break;
    }
    default:
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  }
  ctx.fill();
}

// --- TEMPLATES ---
const TEMPLATES = [
  { name: "Feliz Aniversário", text: "Feliz Aniversário!", subtitle: "", plateColor: "#FF6B9D", textColor: "#FFFFFF", theme: "aniversario" },
  { name: "Parabéns", text: "Parabéns!", subtitle: "", plateColor: "#FFD93D", textColor: "#1A1C19", theme: "aniversario" },
  { name: "Feliz 15 Anos", text: "Feliz 15 Anos", subtitle: "Quinze Anos", plateColor: "#E8B4F8", textColor: "#FFFFFF", theme: "quinze_anos" },
  { name: "Nosso Casamento", text: "Nosso Casamento", subtitle: "Amor Eterno", plateColor: "#F5E6D3", textColor: "#C9A96E", theme: "casamento" },
  { name: "Chá de Bebê", text: "Chá de Bebê", subtitle: "É Menino!", plateColor: "#B8E6D0", textColor: "#5B8C5A", theme: "cha_bebe" },
  { name: "1 Ano", text: "1 Ano", subtitle: "Feliz Aniversário", plateColor: "#7EC8E3", textColor: "#FFFFFF", theme: "infantil" },
  { name: "50 Anos", text: "50 Anos", subtitle: "Meio Século", plateColor: "#1A1A2E", textColor: "#FFD700", theme: "formatura" },
  { name: "Feliz Natal", text: "Feliz Natal", subtitle: "Paz e Amor", plateColor: "#CC0000", textColor: "#FFD700", theme: "natal" },
];

// --- MAIN PAGE COMPONENT ---
export default function CakeTopperCreator() {
  const creator = useCakeTopperCreator();
  const {
    config, updateConfig, selectedElementId, setSelectedElementId,
    selectedElement, addElement, updateElement, removeElement,
    duplicateElement, isExporting, exportSTL, printIssues,
    showIssues, setShowIssues, runValidation, viewMode, setViewMode,
    showGrid, setShowGrid, showDimensions, setShowDimensions,
    showCakePreview, setShowCakePreview, modelColor, setModelColor,
    undo, redo, canUndo, canRedo, resetConfig, loadTemplate, applyTheme,
    uploadImageFile, uploadSvgFile,
  } = creator;

  const [activeTab, setActiveTab] = useState<"texto" | "numeros" | "elementos" | "temas" | "templates" | "formas" | "imagem">("texto");
  const [sidebarTab, setSidebarTab] = useState<"propriedades" | "impressao">("propriedades");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAddShape = useCallback((shapeType: string) => {
    addElement("shape", shapeType, shapeType);
  }, [addElement]);

  const handleAddNumber = useCallback((num: string) => {
    addElement("number", num);
  }, [addElement]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadImageFile(file);
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, [uploadImageFile]);

  const handleSvgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadSvgFile(file);
    } finally {
      setIsUploading(false);
      if (svgInputRef.current) svgInputRef.current.value = "";
    }
  }, [uploadSvgFile]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* LEFT SIDEBAR - Tools */}
      <div className="w-full md:w-72 bg-[#FFFFFF] border-r border-[#E2E3DD] overflow-y-auto scrollbar-hide flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E3DD]">
          <div className="flex items-center gap-2 mb-1">
            <Cake className="w-5 h-5 text-[#632CE5]" />
            <h1 className="text-sm font-black uppercase tracking-tighter text-[#1A1C19]">Topo de Bolo 3D</h1>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Crie toppers personalizados</p>
        </div>

        {/* Tool Tabs */}
        <div className="flex border-b border-[#E2E3DD]">
          {([
            { id: "texto" as const, icon: Type, label: "Texto" },
            { id: "numeros" as const, icon: Hash, label: "Números" },
            { id: "elementos" as const, icon: Shapes, label: "Elem." },
            { id: "formas" as const, icon: Star, label: "Formas" },
            { id: "imagem" as const, icon: ImagePlus, label: "Imagem" },
            { id: "temas" as const, icon: Palette, label: "Temas" },
            { id: "templates" as const, icon: LayoutTemplate, label: "Models" },
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-1 text-[8px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === id
                  ? "text-[#632CE5] border-b-2 border-[#632CE5] bg-[#632CE5]/5"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* TEXTO TAB */}
          {activeTab === "texto" && (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Texto Principal</label>
                <input
                  type="text"
                  value={config.text}
                  onChange={(e) => updateConfig({ text: e.target.value })}
                  className="w-full bg-[#F9FAF4] border border-[#E2E3DD] p-2.5 rounded-lg text-sm text-[#1A1C19] font-bold focus:outline-none focus:border-[#632CE5] transition-all"
                  placeholder="DIGITE SEU TEXTO..."
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Subtítulo</label>
                <input
                  type="text"
                  value={config.subtitle}
                  onChange={(e) => updateConfig({ subtitle: e.target.value })}
                  className="w-full bg-[#F9FAF4] border border-[#E2E3DD] p-2.5 rounded-lg text-sm text-[#1A1C19] font-bold focus:outline-none focus:border-[#632CE5] transition-all"
                  placeholder="Ex: Nome, Data..."
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Fonte</label>
                <select
                  value={config.fontFamily}
                  onChange={(e) => updateConfig({ fontFamily: e.target.value })}
                  className="w-full bg-[#F9FAF4] border border-[#E2E3DD] p-2 rounded text-[10px] text-[#1A1C19] font-bold"
                >
                  {TOPPER_FONTS.map((f) => (
                    <option key={f.url} value={f.url}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-500">Tamanho</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.fontSize}mm</span>
                </div>
                <input
                  type="range" min="6" max="30" step="1"
                  value={config.fontSize}
                  onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) })}
                  className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-500">Espessura</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.textThickness}mm</span>
                </div>
                <input
                  type="range" min="0.5" max="8" step="0.5"
                  value={config.textThickness}
                  onChange={(e) => updateConfig({ textThickness: parseFloat(e.target.value) })}
                  className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[9px] uppercase font-bold text-zinc-500">Espaçamento</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{config.letterSpacing}mm</span>
                </div>
                <input
                  type="range" min="0" max="5" step="0.2"
                  value={config.letterSpacing}
                  onChange={(e) => updateConfig({ letterSpacing: parseFloat(e.target.value) })}
                  className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex gap-1.5">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateConfig({ alignment: align })}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase border transition-colors ${
                      config.alignment === align
                        ? "bg-[#632CE5] text-white border-[#632CE5]"
                        : "bg-[#F9FAF4] text-zinc-500 border-[#E2E3DD] hover:border-[#632CE5]"
                    }`}
                  >
                    {align === "left" ? <AlignLeft className="w-3 h-3 mx-auto" /> : align === "center" ? <AlignCenter className="w-3 h-3 mx-auto" /> : <AlignRight className="w-3 h-3 mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* NUMEROS TAB */}
          {activeTab === "numeros" && (
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold text-zinc-500 block">Adicionar Números</label>
              <div className="grid grid-cols-5 gap-1.5">
                {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleAddNumber(num)}
                    className="aspect-square bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg text-lg font-black text-[#1A1C19] hover:bg-[#632CE5] hover:text-white hover:border-[#632CE5] transition-all active:scale-95"
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Ou digite uma idade</label>
                <input
                  type="text"
                  placeholder="Ex: 18, 50, 1..."
                  className="w-full bg-[#F9FAF4] border border-[#E2E3DD] p-2.5 rounded-lg text-sm text-[#1A1C19] font-bold focus:outline-none focus:border-[#632CE5]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) { addElement("number", val); (e.target as HTMLInputElement).value = ""; }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ELEMENTOS TAB */}
          {activeTab === "elementos" && (
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold text-zinc-500 block">Elementos Decorativos</label>
              {[
                { label: "Coração", icon: Heart, shape: "coracao" },
                { label: "Estrela 5", icon: Star, shape: "estrela" },
                { label: "Estrela 6", icon: Sparkles, shape: "estrela6" },
                { label: "Flor", icon: Flower, shape: "flor" },
                { label: "Coroa", icon: Crown, shape: "coroa" },
                { label: "Balão", icon: Circle, shape: "balao" },
                { label: "Círculo", icon: Circle, shape: "circulo" },
                { label: "Quadrado", icon: Square, shape: "quadrado" },
                { label: "Losango", icon: Diamond, shape: "losango" },
                { label: "Triângulo", icon: Triangle, shape: "triangulo" },
              ].map(({ label, icon: Icon, shape }) => (
                <button
                  key={shape}
                  onClick={() => handleAddShape(shape)}
                  className="w-full flex items-center gap-3 p-2.5 bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg hover:bg-[#632CE5]/5 hover:border-[#632CE5]/30 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded bg-[#632CE5]/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#632CE5]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-[#1A1C19]">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* FORMAS TAB */}
          {activeTab === "formas" && (
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold text-zinc-500 block">Formas Geométricas</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(SHAPE_PRESETS).map((shapeType) => (
                  <button
                    key={shapeType}
                    onClick={() => handleAddShape(shapeType)}
                    className="aspect-square bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-[#632CE5]/5 hover:border-[#632CE5]/30 transition-all"
                  >
                    <div className="w-8 h-8">
                      <svg viewBox="-25 -25 50 50" className="w-full h-full">
                        <ShapeSVG shapeType={shapeType} />
                      </svg>
                    </div>
                    <span className="text-[8px] font-bold uppercase text-zinc-500">{shapeType}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TEMAS TAB */}
          {activeTab === "temas" && (
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold text-zinc-500 block">Temas Predefinidos</label>
              {Object.entries(THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => applyTheme(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    config.theme === key
                      ? "bg-[#632CE5]/10 border-[#632CE5]"
                      : "bg-[#F9FAF4] border-[#E2E3DD] hover:border-[#632CE5]/30"
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="w-5 h-5 rounded-full border border-white shadow" style={{ background: theme.plateColor }} />
                    <div className="w-5 h-5 rounded-full border border-white shadow" style={{ background: theme.textColor }} />
                    <div className="w-5 h-5 rounded-full border border-white shadow" style={{ background: theme.borderColor }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-[#1A1C19] capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* IMAGEM TAB */}
          {activeTab === "imagem" && (
            <div className="space-y-3">
              <input
                ref={imageInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.bmp,.webp"
                onChange={handleImageUpload}
                className="hidden"
              />
              <input
                ref={svgInputRef}
                type="file"
                accept=".svg"
                onChange={handleSvgUpload}
                className="hidden"
              />

              <label className="text-[9px] uppercase font-bold text-zinc-500 block">Upload de Imagem</label>
              <p className="text-[9px] text-zinc-400 leading-relaxed">
                Faça upload de uma imagem (PNG, JPG) para usar o contorno/silueta como elemento decorativo no topper.
              </p>
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading}
                className="w-full p-4 bg-[#F9FAF4] border-2 border-dashed border-[#E2E3DD] rounded-lg flex flex-col items-center gap-2 hover:border-[#632CE5]/50 hover:bg-[#632CE5]/5 transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <RefreshCw className="w-6 h-6 text-[#632CE5] animate-spin" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-[#632CE5]" />
                )}
                <span className="text-[10px] font-bold uppercase text-[#1A1C19]">
                  {isUploading ? "Processando..." : "Selecionar Imagem"}
                </span>
                <span className="text-[8px] text-zinc-400">PNG, JPG, GIF, BMP, WebP</span>
              </button>

              <div className="border-t border-[#E2E3DD] pt-3">
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-2">Upload de SVG</label>
                <p className="text-[9px] text-zinc-400 leading-relaxed mb-2">
                  SVGs vetoriais preservam qualidade perfecta e são convertidos diretamente em formas 3D.
                </p>
                <button
                  onClick={() => svgInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full p-4 bg-[#F9FAF4] border-2 border-dashed border-[#E2E3DD] rounded-lg flex flex-col items-center gap-2 hover:border-[#632CE5]/50 hover:bg-[#632CE5]/5 transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <RefreshCw className="w-6 h-6 text-[#632CE5] animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#632CE5]" />
                  )}
                  <span className="text-[10px] font-bold uppercase text-[#1A1C19]">
                    {isUploading ? "Processando..." : "Selecionar SVG"}
                  </span>
                  <span className="text-[8px] text-zinc-400">Vetor SVG</span>
                </button>
              </div>

              <div className="border-t border-[#E2E3DD] pt-3">
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-2">Dicas</label>
                <ul className="text-[8px] text-zinc-400 space-y-1 list-disc list-inside">
                  <li>Imagens com fundo claro e contours nítidos funcionam melhor</li>
                  <li>O fundo é removido automaticamente</li>
                  <li>SVGs produzem resultados mais limpos</li>
                  <li>O elemento adicionado pode ser movido, girado e redimensionado</li>
                </ul>
              </div>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === "templates" && (
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-bold text-zinc-500 block">Modelos Prontos</label>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => loadTemplate(tpl)}
                  className="w-full p-3 bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg hover:border-[#632CE5]/30 transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 rounded-full" style={{ background: tpl.plateColor }} />
                    <span className="text-[10px] font-black uppercase text-[#1A1C19]">{tpl.name}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-bold">{tpl.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Undo/Redo */}
        <div className="p-3 border-t border-[#E2E3DD] flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex-1 py-2 rounded-lg bg-[#F9FAF4] border border-[#E2E3DD] text-[9px] font-bold uppercase flex items-center justify-center gap-1 disabled:opacity-30 hover:bg-[#E8E9E3] transition-colors"
          >
            <Undo2 className="w-3 h-3" /> Desfazer
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex-1 py-2 rounded-lg bg-[#F9FAF4] border border-[#E2E3DD] text-[9px] font-bold uppercase flex items-center justify-center gap-1 disabled:opacity-30 hover:bg-[#E8E9E3] transition-colors"
          >
            <Redo2 className="w-3 h-3" /> Refazer
          </button>
        </div>
      </div>

      {/* CENTER - Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-10 bg-[#FFFFFF] border-b border-[#E2E3DD] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-[#F9FAF4] rounded-lg border border-[#E2E3DD] p-0.5">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                  viewMode === "2d" ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                  viewMode === "3d" ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                3D
              </button>
            </div>
            <div className="w-px h-5 bg-[#E2E3DD]" />
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded transition-colors ${showGrid ? "bg-[#632CE5]/10 text-[#632CE5]" : "text-zinc-400 hover:text-zinc-600"}`}
              title="Grade"
            >
              <Grid3x3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowDimensions(!showDimensions)}
              className={`p-1.5 rounded transition-colors ${showDimensions ? "bg-[#632CE5]/10 text-[#632CE5]" : "text-zinc-400 hover:text-zinc-600"}`}
              title="Dimensões"
            >
              <Ruler className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCakePreview(!showCakePreview)}
              className={`p-1.5 rounded transition-colors ${showCakePreview ? "bg-[#632CE5]/10 text-[#632CE5]" : "text-zinc-400 hover:text-zinc-600"}`}
              title="Preview no Bolo"
            >
              <Cake className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Dimensions display */}
            <span className="text-[9px] font-mono text-zinc-400">
              {config.plateWidth}×{config.plateHeight}mm + {config.stickHeight}mm haste
            </span>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="flex-1 relative">
          {viewMode === "3d" ? (
            <div className="absolute inset-0">
              <Canvas shadows camera={{ position: [0, 0, 20], fov: 50 }}>
                <color attach="background" args={["#F3F4EE"]} />
                <ambientLight intensity={0.6} />
                <spotLight position={[20, 30, 20]} angle={0.15} penumbra={1} castShadow intensity={1} />
                <pointLight position={[-20, -10, -20]} intensity={0.4} />
                <OrbitControls makeDefault enableDamping />
                {showGrid && (
                  <Grid
                    infiniteGrid
                    fadeDistance={100}
                    cellColor="#222"
                    sectionColor="#444"
                    cellSize={1}
                    sectionSize={5}
                    position={[0, -0.01, 0]}
                  />
                )}
                <Center>
                  <TopperScene
                    config={config}
                    modelColor={modelColor}
                    showCakePreview={showCakePreview}
                    showGrid={showGrid}
                    showDimensions={showDimensions}
                  />
                </Center>
              </Canvas>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#F9FAF4] p-8">
              <Canvas2DPreview config={config} />
            </div>
          )}

          {/* HUD Overlay */}
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md border border-[#E2E3DD] p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#632CE5] animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
                  {viewMode === "3d" ? "Visualização 3D" : "Preview 2D"}
                </span>
              </div>
              <div className="text-[9px] font-mono text-zinc-400">
                {config.plateWidth}×{config.plateHeight}mm
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="h-14 bg-[#FFFFFF] border-t border-[#E2E3DD] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={resetConfig}
              className="px-3 py-2 rounded-lg bg-[#F9FAF4] border border-[#E2E3DD] text-[9px] font-bold uppercase flex items-center gap-1.5 hover:bg-[#E8E9E3] transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Novo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runValidation}
              className="px-4 py-2 rounded-lg bg-[#F9FAF4] border border-[#E2E3DD] text-[9px] font-bold uppercase flex items-center gap-1.5 hover:bg-[#E8E9E3] transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Verificar Impressão
            </button>
            <button
              onClick={exportSTL}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-[#632CE5] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-[#7C4DFF] transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(99,44,229,0.3)]"
            >
              {isExporting ? (
                <span className="animate-pulse">Processando...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Gerar STL
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - Properties */}
      <div className="w-full md:w-72 bg-[#FFFFFF] border-l border-[#E2E3DD] overflow-y-auto scrollbar-hide flex flex-col shrink-0">
        {/* Sidebar Tabs */}
        <div className="flex border-b border-[#E2E3DD]">
          <button
            onClick={() => setSidebarTab("propriedades")}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              sidebarTab === "propriedades"
                ? "text-[#632CE5] border-b-2 border-[#632CE5]"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Propriedades
          </button>
          <button
            onClick={() => setSidebarTab("impressao")}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              sidebarTab === "impressao"
                ? "text-[#632CE5] border-b-2 border-[#632CE5]"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Impressão 3D
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {sidebarTab === "propriedades" ? (
            <>
              {/* Plate Properties */}
              <Section title="Placa" icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <PropRow label="Largura" value={`${config.plateWidth}mm`}>
                  <input type="range" min="40" max="200" step="1" value={config.plateWidth}
                    onChange={(e) => updateConfig({ plateWidth: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Altura" value={`${config.plateHeight}mm`}>
                  <input type="range" min="20" max="120" step="1" value={config.plateHeight}
                    onChange={(e) => updateConfig({ plateHeight: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Espessura" value={`${config.plateThickness}mm`}>
                  <input type="range" min="0.5" max="6" step="0.5" value={config.plateThickness}
                    onChange={(e) => updateConfig({ plateThickness: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Raio Bordas" value={`${config.plateCornerRadius}mm`}>
                  <input type="range" min="0" max="20" step="1" value={config.plateCornerRadius}
                    onChange={(e) => updateConfig({ plateCornerRadius: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
              </Section>

              {/* Colors */}
              <Section title="Cores" icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <div className="grid grid-cols-2 gap-2">
                  <ColorField label="Placa" value={config.plateColor} onChange={(c) => { updateConfig({ plateColor: c }); setModelColor(c); }} />
                  <ColorField label="Texto" value={config.textColor} onChange={(c) => updateConfig({ textColor: c })} />
                  <ColorField label="Borda" value={config.borderColor} onChange={(c) => updateConfig({ borderColor: c })} />
                  <ColorField label="Hastes" value={config.stickColor} onChange={(c) => updateConfig({ stickColor: c })} />
                </div>
              </Section>

              {/* Border */}
              <Section title="Borda" icon={<Layers className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <ToggleRow label="Mostrar Borda" active={config.showBorder} onToggle={() => updateConfig({ showBorder: !config.showBorder })} />
                {config.showBorder && (
                  <PropRow label="Espessura" value={`${config.borderWidth}mm`}>
                    <input type="range" min="0.5" max="5" step="0.5" value={config.borderWidth}
                      onChange={(e) => updateConfig({ borderWidth: parseFloat(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                )}
              </Section>

              {/* Sticks */}
              <Section title="Hastes" icon={<TriangleRight className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <PropRow label="Quantidade" value={`${config.stickCount}`}>
                  <input type="range" min="1" max="5" step="1" value={config.stickCount}
                    onChange={(e) => updateConfig({ stickCount: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Altura" value={`${config.stickHeight}mm`}>
                  <input type="range" min="20" max="150" step="1" value={config.stickHeight}
                    onChange={(e) => updateConfig({ stickHeight: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Espessura" value={`${config.stickThickness}mm`}>
                  <input type="range" min="1" max="5" step="0.5" value={config.stickThickness}
                    onChange={(e) => updateConfig({ stickThickness: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Largura" value={`${config.stickWidth}mm`}>
                  <input type="range" min="2" max="10" step="0.5" value={config.stickWidth}
                    onChange={(e) => updateConfig({ stickWidth: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
              </Section>

              {/* Selected Element */}
              {selectedElement && (
                <Section title={`Elemento: ${selectedElement.content}`} icon={<PenTool className="w-3.5 h-3.5 text-[#632CE5]" />}>
                  <PropRow label="Posição X" value={`${selectedElement.x}mm`}>
                    <input type="range" min={-config.plateWidth / 2} max={config.plateWidth / 2} step="1" value={selectedElement.x}
                      onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <PropRow label="Posição Y" value={`${selectedElement.y}mm`}>
                    <input type="range" min={-config.plateHeight / 2} max={config.plateHeight / 2} step="1" value={selectedElement.y}
                      onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <PropRow label="Escala" value={`${selectedElement.scale.toFixed(1)}x`}>
                    <input type="range" min="0.2" max="3" step="0.1" value={selectedElement.scale}
                      onChange={(e) => updateElement(selectedElement.id, { scale: parseFloat(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <PropRow label="Rotação" value={`${selectedElement.rotation}°`}>
                    <input type="range" min="-180" max="180" step="5" value={selectedElement.rotation}
                      onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <ColorField label="Cor" value={selectedElement.color} onChange={(c) => updateElement(selectedElement.id, { color: c })} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => duplicateElement(selectedElement.id)}
                      className="flex-1 py-1.5 rounded bg-[#F9FAF4] border border-[#E2E3DD] text-[9px] font-bold flex items-center justify-center gap-1 hover:bg-[#E8E9E3]">
                      <Copy className="w-3 h-3" /> Duplicar
                    </button>
                    <button onClick={() => removeElement(selectedElement.id)}
                      className="flex-1 py-1.5 rounded bg-red-50 border border-red-200 text-[9px] font-bold text-red-600 flex items-center justify-center gap-1 hover:bg-red-100">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  </div>
                </Section>
              )}

              {/* Elements List */}
              {config.elements.length > 0 && (
                <Section title="Elementos" icon={<Shapes className="w-3.5 h-3.5 text-[#632CE5]" />}>
                  <div className="space-y-1">
                    {config.elements.map((el) => (
                      <button
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded text-left transition-colors ${
                          selectedElementId === el.id
                            ? "bg-[#632CE5]/10 border border-[#632CE5]"
                            : "bg-[#F9FAF4] border border-[#E2E3DD] hover:border-[#632CE5]/30"
                        }`}
                      >
                        <div className="w-4 h-4 rounded" style={{ background: el.color }} />
                        <span className="text-[9px] font-bold text-[#1A1C19] truncate flex-1">
                          {el.type === "shape" ? el.shapeType : el.content}
                        </span>
                        <span className="text-[8px] text-zinc-400 font-mono">{el.type}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
            </>
          ) : (
            /* PRINT SETTINGS TAB */
            <>
              <Section title="Dimensões Totais" icon={<Ruler className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <div className="grid grid-cols-2 gap-2">
                  <InfoBox label="Largura" value={`${config.plateWidth}mm`} />
                  <InfoBox label="Altura Total" value={`${config.plateHeight + config.stickHeight}mm`} />
                  <InfoBox label="Placa" value={`${config.plateHeight}mm`} />
                  <InfoBox label="Hastes" value={`${config.stickHeight}mm`} />
                  <InfoBox label="Espessura" value={`${config.plateThickness}mm`} />
                  <InfoBox label="Relevo" value={`${config.textThickness}mm`} />
                </div>
              </Section>

              <Section title="Impressão 3D" icon={<Settings className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <ToggleRow label="Suavizar Bordas" active={config.smoothEdges}
                  onToggle={() => updateConfig({ smoothEdges: !config.smoothEdges })} />
                <ToggleRow label="Base de Reforço" active={config.addReinforcement}
                  onToggle={() => updateConfig({ addReinforcement: !config.addReinforcement })} />
                {config.addReinforcement && (
                  <PropRow label="Espessura Reforço" value={`${config.reinforcementThickness}mm`}>
                    <input type="range" min="1" max="5" step="0.5" value={config.reinforcementThickness}
                      onChange={(e) => updateConfig({ reinforcementThickness: parseFloat(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                )}
              </Section>

              <Section title="Validação" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <button
                  onClick={runValidation}
                  className="w-full py-2.5 rounded-lg bg-[#632CE5]/10 border border-[#632CE5]/30 text-[10px] font-bold uppercase text-[#632CE5] flex items-center justify-center gap-2 hover:bg-[#632CE5]/20 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Executar Verificação
                </button>
                {showIssues && printIssues.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {printIssues.map((issue, i) => (
                      <div key={i} className={`flex items-start gap-2 p-2 rounded text-[9px] ${
                        issue.type === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {issue.type === "error" ? <XCircle className="w-3 h-3 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
                        <span className="font-bold">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {showIssues && printIssues.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded bg-green-50 text-green-700 text-[9px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="font-bold">Modelo pronto para impressão!</span>
                  </div>
                )}
              </Section>

              <Section title="Exportar" icon={<Download className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <button
                  onClick={exportSTL}
                  disabled={isExporting}
                  className="w-full py-3 rounded-lg bg-[#632CE5] text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#7C4DFF] transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(99,44,229,0.3)]"
                >
                  {isExporting ? (
                    <span className="animate-pulse">Processando...</span>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Gerar Modelo 3D (STL)
                    </>
                  )}
                </button>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- HELPER COMPONENTS ---
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-black flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function PropRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <label className="text-[9px] uppercase font-bold text-zinc-500">{label}</label>
        <span className="text-[10px] font-mono text-[#632CE5]">{value}</span>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center justify-between p-2.5 bg-[#F9FAF4] rounded-lg border border-[#E2E3DD] cursor-pointer hover:border-[#632CE5]/30 transition-all"
    >
      <span className="text-[9px] font-bold uppercase text-[#1A1C19]">{label}</span>
      <div className={`w-8 h-4.5 rounded-full transition-colors relative ${active ? "bg-[#632CE5]" : "bg-[#E2E3DD]"}`}>
        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${active ? "left-4" : "left-0.5"}`} />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded border border-[#E2E3DD] cursor-pointer"
      />
      <div className="flex-1">
        <label className="text-[8px] uppercase font-bold text-zinc-500 block">{label}</label>
        <span className="text-[9px] font-mono text-zinc-400">{value}</span>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg p-2">
      <label className="text-[8px] uppercase font-bold text-zinc-400 block">{label}</label>
      <span className="text-[11px] font-mono font-bold text-[#632CE5]">{value}</span>
    </div>
  );
}

function ShapeSVG({ shapeType }: { shapeType: string }) {
  switch (shapeType) {
    case "estrela":
      return <polygon points="0,-20 4.7,-6.2 19,-6.2 7.6,3.8 11.8,18.2 0,10 -11.8,18.2 -7.6,3.8 -19,-6.2 -4.7,-6.2" fill="#632CE5" opacity="0.6" />;
    case "coracao":
      return <path d="M0,5 C0,-5 -15,-10 -15,-2 C-15,5 0,15 0,20 C0,15 15,5 15,-2 C15,-10 0,-5 0,5Z" fill="#632CE5" opacity="0.6" />;
    case "flor":
      return <polygon points="0,-18 5,-6 18,-6 8,3 12,17 0,10 -12,17 -8,3 -18,-6 -5,-6" fill="#632CE5" opacity="0.6" />;
    case "coroa":
      return <polygon points="-15,8 -15,-5 -7,2 0,-10 7,2 15,-5 15,8" fill="#632CE5" opacity="0.6" />;
    case "balao":
      return <><circle cx="0" cy="-3" r="10" fill="#632CE5" opacity="0.6" /><polygon points="-3,7 0,15 3,7" fill="#632CE5" opacity="0.6" /></>;
    case "circulo":
      return <circle cx="0" cy="0" r="14" fill="#632CE5" opacity="0.6" />;
    case "quadrado":
      return <rect x="-12" y="-12" width="24" height="24" fill="#632CE5" opacity="0.6" />;
    case "losango":
      return <polygon points="0,-15 15,0 0,15 -15,0" fill="#632CE5" opacity="0.6" />;
    case "triangulo":
      return <polygon points="0,15 15,-10 -15,-10" fill="#632CE5" opacity="0.6" />;
    case "estrela6":
      return <polygon points="0,-18 5,-6 18,-6 8,3 12,17 0,10 -12,17 -8,3 -18,-6 -5,-6" fill="#632CE5" opacity="0.6" />;
    case "nuvem":
      return <ellipse cx="0" cy="0" rx="16" ry="10" fill="#632CE5" opacity="0.6" />;
    default:
      return <circle cx="0" cy="0" r="14" fill="#632CE5" opacity="0.6" />;
  }
}
