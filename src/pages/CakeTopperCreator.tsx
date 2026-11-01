import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { flushSync } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Center, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  useCakeTopperCreator,
} from "../hooks/useCakeTopperCreator";
import { useNamePlaqueGeometry, type NamePlaqueGeometryState } from "../hooks/useNamePlaqueGeometry";
import { usePlaqueCollection } from "../hooks/usePlaqueCollection";
import { defaultPlaqueNameConfig, derivePlaqueLabel, type Plaque, type PlaqueStyle } from "../lib/cakeTopper/plaque";
import { buildStickGeometries } from "../lib/cakeTopper/plaqueGeometry";
import {
  downloadPlaqueStl,
  downloadPlaqueStlZip,
  downloadPlaque3MF,
  sanitizeFileName,
} from "../lib/cakeTopper/plaqueExport";
import type { KeychainConfig } from "../types/keychain";
import { FontPicker } from "../components/FontPicker";
import {
  TopperConfig,
  TopperElement,
  THEMES,
  SHAPE_PRESETS,
  TOPPER_FONTS,
  createTextGeometry,
  createPlateGeometry,
  createShapeElement,
  plateShapeShape,
  plateShapeBottomYAt,
  svgPlateShape,
  PLATE_SHAPE_IDS,
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
function TopperScene({ config, modelColor, showCakePreview, showGrid, showDimensions, plaqueStyle, nameConfig, nameGeometry }: {
  config: TopperConfig;
  modelColor: string;
  showCakePreview: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  plaqueStyle: PlaqueStyle;
  nameConfig: KeychainConfig;
  nameGeometry: NamePlaqueGeometryState;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isNameStyle = plaqueStyle !== "placa";
  const showPlate = plaqueStyle !== "nome-silhueta";
  const showPlateText = plaqueStyle === "placa";

  // Plate (forma da placa: retângulo/preset/SVG — unidade de cena = 10 mm)
  const plateMesh = useMemo(() => {
    const shape = plateShapeShape(
      config.plateWidth / 10,
      config.plateHeight / 10,
      config.plateCornerRadius / 10,
      config.plateShape,
      config.plateShapeSvg
    );
    const mesh = createPlateGeometry(
      config.plateWidth / 10,
      config.plateHeight / 10,
      config.plateThickness / 10,
      config.plateCornerRadius / 10,
      modelColor,
      shape
    );
    return mesh;
  }, [config.plateWidth, config.plateHeight, config.plateThickness, config.plateCornerRadius, config.plateShape, config.plateShapeSvg, modelColor]);

  // Border
  const borderMesh = useMemo(() => {
    if (!config.showBorder || config.borderWidth <= 0) return null;
    const bw = config.borderWidth;
    const shape = plateShapeShape(
      (config.plateWidth + bw * 2) / 10,
      (config.plateHeight + bw * 2) / 10,
      (config.plateCornerRadius + bw) / 10,
      config.plateShape,
      config.plateShapeSvg
    );
    const outer = createPlateGeometry(
      config.plateWidth / 10 + bw / 5,
      config.plateHeight / 10 + bw / 5,
      config.plateThickness / 10,
      (config.plateCornerRadius + bw) / 10,
      config.borderColor,
      shape
    );
    return outer;
  }, [config.plateWidth, config.plateHeight, config.plateThickness, config.plateCornerRadius, config.plateShape, config.plateShapeSvg, config.showBorder, config.borderWidth, config.borderColor]);

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

  // Hastes em mm (renderizadas num grupo scale 0.1 — mesmo pipeline do export).
  // Placa: ancora na borda inferior real da forma; nome-placa, na placa;
  // nome-silhueta, na base do nome.
  const stickGeoms = useMemo(() => {
    const plateShapeMm = () =>
      plateShapeShape(
        config.plateWidth,
        config.plateHeight,
        config.plateCornerRadius,
        config.plateShape,
        config.plateShapeSvg
      );
    if (!isNameStyle) {
      return buildStickGeometries(config, -config.plateHeight / 2, plateShapeMm());
    }
    if (!nameGeometry.base) return [];
    let anchorY: number;
    let shape: THREE.Shape | null = null;
    if (plaqueStyle === "nome-placa") {
      anchorY = -config.plateHeight / 2;
      shape = plateShapeMm();
    } else {
      nameGeometry.base.computeBoundingBox();
      anchorY = nameGeometry.base.boundingBox?.min.y ?? 0;
    }
    return buildStickGeometries(config, anchorY, shape);
  }, [isNameStyle, plaqueStyle, nameGeometry.base, config]);

  // Descarta as hastes mm antigas quando a config muda (cleanup do useMemo acima).
  useEffect(() => {
    return () => {
      stickGeoms.forEach((g) => g.dispose());
    };
  }, [stickGeoms]);

  return (
    <group ref={groupRef}>
      {/* Border behind plate */}
      {showPlate && borderMesh && (
        <primitive object={borderMesh} position={[0, 0, -config.borderWidth / 20]} />
      )}

      {/* Main plate */}
      {showPlate && <primitive object={plateMesh} />}

      {/* Main text (estilo placa) */}
      {showPlateText && textGeom && (
        <mesh geometry={textGeom} position={[0, 0, config.plateThickness / 10]}>
          <meshStandardMaterial color={config.textColor} />
        </mesh>
      )}

      {/* Subtitle text */}
      {showPlateText && subTextGeom && (
        <mesh geometry={subTextGeom} position={[0, -(config.plateHeight / 10) * 0.3, config.plateThickness / 10]}>
          <meshStandardMaterial color={config.textColor} />
        </mesh>
      )}

      {/* Decorative elements */}
      {showPlateText && elementGeoms.map(({ el, mesh }) =>
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

      {/* Hastes — buildStickGeometries já embute +π/2 (penduram para baixo) */}
      {stickGeoms.length > 0 && (
        <group scale={0.1}>
          {stickGeoms.map((geom, i) => (
            <mesh key={`stick-${i}`} geometry={geom}>
              <meshStandardMaterial color={config.stickColor} />
            </mesh>
          ))}
        </group>
      )}

      {/* Estilos de nome: corpo + relevo + hastes (mm, escala 0.1) */}
      {isNameStyle && nameGeometry.base && (
        <group
          scale={0.1}
          position={plaqueStyle === "nome-placa" ? [0, 0, config.plateThickness / 10] : [0, 0, 0]}
        >
          <mesh geometry={nameGeometry.base}>
            <meshStandardMaterial color={nameConfig.baseColor} roughness={0.35} metalness={0.08} />
          </mesh>
          {nameGeometry.relief && (
            <mesh geometry={nameGeometry.relief}>
              <meshStandardMaterial color={nameConfig.reliefColor} roughness={0.28} metalness={0.12} />
            </mesh>
          )}
        </group>
      )}

      {/* Cake preview */}
      {showCakePreview && (
        <group position={[0, -config.plateHeight / 20 - config.stickHeight / 20 - 2 - config.stickZOffset / 10, 0]}>
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

    // Contorno da placa (retângulo / preset / SVG) em mm
    const plateShape = plateShapeShape(
      config.plateWidth,
      config.plateHeight,
      config.plateCornerRadius,
      config.plateShape,
      config.plateShapeSvg
    );
    const ph = config.plateHeight * scale;

    // Draw sticks — ancoram na borda inferior real da forma
    ctx.fillStyle = config.stickColor;
    for (const stick of config.sticks) {
      const sx = cx + stick.x * scale;
      const edgeY = plateShapeBottomYAt(plateShape, stick.x) ?? -config.plateHeight / 2;
      const sy = cy - (edgeY + config.stickZOffset) * scale;
      ctx.fillRect(
        sx - (stick.width / 2) * scale,
        sy,
        stick.width * scale,
        stick.height * scale
      );
    }

    // Draw plate
    ctx.fillStyle = modelColor;
    ctx.beginPath();
    traceShapePath(ctx, plateShape, cx, cy, scale);
    ctx.fill();

    // Border
    if (config.showBorder) {
      ctx.strokeStyle = config.borderColor;
      ctx.lineWidth = config.borderWidth * scale;
      ctx.beginPath();
      traceShapePath(ctx, plateShape, cx, cy, scale);
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

/** Traça um THREE.Shape (mm) no canvas 2D — y do three (para cima) → y do canvas. */
function traceShapePath(ctx: CanvasRenderingContext2D, shape: THREE.Shape, cx: number, cy: number, scale: number) {
  const pts = shape.getPoints(48);
  if (pts.length === 0) return;
  ctx.moveTo(cx + pts[0].x * scale, cy - pts[0].y * scale);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(cx + pts[i].x * scale, cy - pts[i].y * scale);
  }
  ctx.closePath();
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

/**
 * Pinta o rótulo "Gerando…" (commit via flushSync) antes de bloquear a main
 * thread com a geração — mesmo padrão do `KeychainCreator` [X4].
 */
function yieldForPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    const finish = () => resolve();
    requestAnimationFrame(() => setTimeout(finish, 0));
    setTimeout(finish, 250);
  });
}

// --- MAIN PAGE COMPONENT ---
export default function CakeTopperCreator() {
  const creator = useCakeTopperCreator();
  const {
    config, updateConfig, selectedElementId, setSelectedElementId,
    selectedElement, addElement, updateElement, removeElement,
    duplicateElement, printIssues,
    showIssues, setShowIssues, runValidation, viewMode, setViewMode,
    showGrid, setShowGrid, showDimensions, setShowDimensions,
    showCakePreview, setShowCakePreview, modelColor, setModelColor,
    undo, redo, canUndo, canRedo, resetConfig, loadTemplate, replaceConfig, applyTheme,
    uploadImageFile, uploadSvgFile,
  } = creator;

  const [activeTab, setActiveTab] = useState<"texto" | "numeros" | "elementos" | "temas" | "templates" | "formas" | "imagem">("texto");
  const [sidebarTab, setSidebarTab] = useState<"propriedades" | "impressao" | "colecao">("propriedades");

  // Estilos de plaquinha (T5–T6): placa com texto · nome em silhueta · nome em relevo sobre placa.
  const [plaqueStyle, setPlaqueStyle] = useState<PlaqueStyle>("placa");
  const [nameConfig, setNameConfig] = useState<KeychainConfig>(() => defaultPlaqueNameConfig());
  const nameGeometry = useNamePlaqueGeometry(nameConfig, plaqueStyle !== "placa");
  const isNameStyle = plaqueStyle !== "placa";

  /** Validação por estilo [V1, V2]: placa usa o caminho original; nome, o ramo do chaveiro + fit. */
  const handleValidate = useCallback(() => {
    runValidation({
      style: plaqueStyle,
      name: nameConfig,
      nameWidthMm: nameGeometry.dimensions?.dimX ?? null,
    });
  }, [runValidation, plaqueStyle, nameConfig, nameGeometry.dimensions]);

  // --- Coleção + downloads (T7) ---
  const collection = usePlaqueCollection();
  const [batchExporting, setBatchExporting] = useState<"zip" | "3mf" | null>(null);
  const [currentExporting, setCurrentExporting] = useState(false);

  /** Snapshot da plaquinha em edição (fonte para "Adicionar à coleção" e STL atual). */
  const currentPlaque: Plaque = useMemo(
    () => ({
      id: "current",
      label: derivePlaqueLabel({ style: plaqueStyle, topper: config, name: nameConfig }, 0),
      style: plaqueStyle,
      topper: config,
      name: nameConfig,
    }),
    [plaqueStyle, config, nameConfig]
  );

  /** Espaçamento efetivo entre hastes vizinhas (mm) — valor exibido no slider "Espaçamento X". */
  const stickXs = config.sticks.map((s) => s.x);
  const effectiveStickSpacing =
    stickXs.length > 1 ? (Math.max(...stickXs) - Math.min(...stickXs)) / (stickXs.length - 1) : 0;

  const handleAddToCollection = useCallback(() => {
    collection.addFromPlaque(currentPlaque);
    setSidebarTab("colecao");
  }, [collection, currentPlaque]);

  const handleLoadPlaque = useCallback(
    (id: string) => {
      const loaded = collection.loadPlaqueInto(id);
      if (!loaded) return;
      setPlaqueStyle(loaded.style);
      setNameConfig(loaded.name);
      replaceConfig(loaded.topper);
      setModelColor(loaded.topper.plateColor);
      setSidebarTab("propriedades");
    },
    [collection, replaceConfig, setModelColor]
  );

  const handleDownloadZip = useCallback(async () => {
    if (batchExporting || collection.plaques.length === 0) return;
    flushSync(() => setBatchExporting("zip"));
    await yieldForPaint();
    try {
      await downloadPlaqueStlZip(collection.plaques, "plaquinhas.zip");
    } catch (err) {
      console.error("Erro ao exportar ZIP de STLs:", err);
    } finally {
      setBatchExporting(null);
    }
  }, [batchExporting, collection.plaques]);

  const handleDownload3mf = useCallback(async () => {
    if (batchExporting || collection.plaques.length === 0) return;
    flushSync(() => setBatchExporting("3mf"));
    await yieldForPaint();
    try {
      await downloadPlaque3MF(collection.plaques, "plaquinhas.3mf");
    } catch (err) {
      console.error("Erro ao exportar 3MF:", err);
    } finally {
      setBatchExporting(null);
    }
  }, [batchExporting, collection.plaques]);

  const handleExportCurrent = useCallback(async () => {
    if (currentExporting) return;
    flushSync(() => setCurrentExporting(true));
    await yieldForPaint();
    try {
      const text = plaqueStyle === "placa" ? config.text : nameConfig.text;
      const fileName = `topper-${sanitizeFileName(text.toLowerCase().replace(/\s+/g, "-").slice(0, 30)) || "custom"}.stl`;
      await downloadPlaqueStl(currentPlaque, fileName);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setCurrentExporting(false);
    }
  }, [currentExporting, currentPlaque, plaqueStyle, config.text, nameConfig.text]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const plateSvgInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [plateSvgError, setPlateSvgError] = useState<string | null>(null);

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

  /** Upload de SVG como forma da placa (plateShape = "svg"). */
  const handlePlateSvgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (plateSvgInputRef.current) plateSvgInputRef.current.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      if (!svgPlateShape(text, 100, 100)) {
        setPlateSvgError("SVG inválido ou sem forma preenchida.");
        return;
      }
      setPlateSvgError(null);
      updateConfig({ plateShape: "svg", plateShapeSvg: text });
    } catch {
      setPlateSvgError("Falha ao ler o arquivo SVG.");
    }
  }, [updateConfig]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      {/* LEFT SIDEBAR - Tools */}
      <div className="w-full md:w-[400px] bg-[var(--workbench-panel)] border-r border-[var(--surface-container-high)] overflow-y-auto scrollbar-hide flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-[var(--surface-container-high)]">
          <div className="flex items-center gap-2 mb-1">
            <Cake className="w-5 h-5 text-[#632CE5]" />
            <h1 className="text-sm font-black uppercase tracking-tighter text-[var(--workbench-text)]">Topo de Bolo 3D</h1>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Crie toppers personalizados</p>
        </div>

        {/* Estilo da plaquinha */}
        <div className="p-3 border-b border-[var(--surface-container-high)]">
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Estilo da Plaquinha</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { id: "placa" as const, label: "Placa c/ Texto" },
              { id: "nome-silhueta" as const, label: "Nome (Silhueta)" },
              { id: "nome-placa" as const, label: "Nome em Placa" },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPlaqueStyle(id)}
                title={
                  id === "placa"
                    ? "Placa com texto e elementos decorativos"
                    : id === "nome-silhueta"
                      ? "Nome recortado em silhueta com hastes"
                      : "Nome em relevo sobre a placa"
                }
                className={`py-2 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all ${
                  plaqueStyle === id
                    ? "bg-[#632CE5] text-white border-[#632CE5] shadow-[0_0_10px_rgba(99,44,229,0.3)]"
                    : "bg-[var(--workbench-viewport)] text-zinc-500 border-[var(--surface-container-high)] hover:border-[#632CE5]/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tool Tabs (estilo placa) */}
        {plaqueStyle === "placa" && (
        <div className="flex border-b border-[var(--surface-container-high)]">
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
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ESTILOS DE NOME */}
          {isNameStyle ? (
            <NamePanel nameConfig={nameConfig} onChange={setNameConfig} nameGeometry={nameGeometry} />
          ) : (
          <>
          {activeTab === "texto" && (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Texto Principal</label>
                <input
                  type="text"
                  value={config.text}
                  onChange={(e) => updateConfig({ text: e.target.value })}
                  className="w-full bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] p-2.5 rounded-lg text-sm text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-all"
                  placeholder="DIGITE SEU TEXTO..."
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Subtítulo</label>
                <input
                  type="text"
                  value={config.subtitle}
                  onChange={(e) => updateConfig({ subtitle: e.target.value })}
                  className="w-full bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] p-2.5 rounded-lg text-sm text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-all"
                  placeholder="Ex: Nome, Data..."
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Fonte</label>
                <select
                  value={config.fontFamily}
                  onChange={(e) => updateConfig({ fontFamily: e.target.value })}
                  className="w-full bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold"
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
                  className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer"
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
                  className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer"
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
                  className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer"
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
                        : "bg-[var(--workbench-viewport)] text-zinc-500 border-[var(--surface-container-high)] hover:border-[#632CE5]"
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
                    className="aspect-square bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] rounded-lg text-lg font-black text-[var(--workbench-text)] hover:bg-[#632CE5] hover:text-white hover:border-[#632CE5] transition-all active:scale-95"
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
                  className="w-full bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] p-2.5 rounded-lg text-sm text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5]"
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
                  className="w-full flex items-center gap-3 p-2.5 bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] rounded-lg hover:bg-[#632CE5]/5 hover:border-[#632CE5]/30 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded bg-[#632CE5]/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#632CE5]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-[var(--workbench-text)]">{label}</span>
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
                    className="aspect-square bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-[#632CE5]/5 hover:border-[#632CE5]/30 transition-all"
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
                      : "bg-[var(--workbench-viewport)] border-[var(--surface-container-high)] hover:border-[#632CE5]/30"
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="w-5 h-5 rounded-full border border-white shadow" style={{ background: theme.plateColor }} />
                    <div className="w-5 h-5 rounded-full border border-white shadow" style={{ background: theme.textColor }} />
                    <div className="w-5 h-5 rounded-full border border-white shadow" style={{ background: theme.borderColor }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-[var(--workbench-text)] capitalize">
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
                className="w-full p-4 bg-[var(--workbench-viewport)] border-2 border-dashed border-[var(--surface-container-high)] rounded-lg flex flex-col items-center gap-2 hover:border-[#632CE5]/50 hover:bg-[#632CE5]/5 transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <RefreshCw className="w-6 h-6 text-[#632CE5] animate-spin" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-[#632CE5]" />
                )}
                <span className="text-[10px] font-bold uppercase text-[var(--workbench-text)]">
                  {isUploading ? "Processando..." : "Selecionar Imagem"}
                </span>
                <span className="text-[8px] text-zinc-400">PNG, JPG, GIF, BMP, WebP</span>
              </button>

              <div className="border-t border-[var(--surface-container-high)] pt-3">
                <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-2">Upload de SVG</label>
                <p className="text-[9px] text-zinc-400 leading-relaxed mb-2">
                  SVGs vetoriais preservam qualidade perfecta e são convertidos diretamente em formas 3D.
                </p>
                <button
                  onClick={() => svgInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full p-4 bg-[var(--workbench-viewport)] border-2 border-dashed border-[var(--surface-container-high)] rounded-lg flex flex-col items-center gap-2 hover:border-[#632CE5]/50 hover:bg-[#632CE5]/5 transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <RefreshCw className="w-6 h-6 text-[#632CE5] animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#632CE5]" />
                  )}
                  <span className="text-[10px] font-bold uppercase text-[var(--workbench-text)]">
                    {isUploading ? "Processando..." : "Selecionar SVG"}
                  </span>
                  <span className="text-[8px] text-zinc-400">Vetor SVG</span>
                </button>
              </div>

              <div className="border-t border-[var(--surface-container-high)] pt-3">
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
                  className="w-full p-3 bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] rounded-lg hover:border-[#632CE5]/30 transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 rounded-full" style={{ background: tpl.plateColor }} />
                    <span className="text-[10px] font-black uppercase text-[var(--workbench-text)]">{tpl.name}</span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-bold">{tpl.text}</span>
                </button>
              ))}
            </div>
          )}
          </>
          )}
        </div>

        {/* Undo/Redo */}
        <div className="p-3 border-t border-[var(--surface-container-high)] flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex-1 py-2 rounded-lg bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] text-[9px] font-bold uppercase flex items-center justify-center gap-1 disabled:opacity-30 hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <Undo2 className="w-3 h-3" /> Desfazer
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex-1 py-2 rounded-lg bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] text-[9px] font-bold uppercase flex items-center justify-center gap-1 disabled:opacity-30 hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <Redo2 className="w-3 h-3" /> Refazer
          </button>
        </div>
      </div>

      {/* CENTER - Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-10 bg-[var(--workbench-panel)] border-b border-[var(--surface-container-high)] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-[var(--workbench-viewport)] rounded-lg border border-[var(--surface-container-high)] p-0.5">
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
            <div className="w-px h-5 bg-[var(--surface-container-high)]" />
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
              <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 20], fov: 50 }}>
                <color attach="background" args={["#F3F4EE"]} />
                <ambientLight intensity={0.6} />
                <spotLight position={[20, 30, 20]} angle={0.15} penumbra={1} castShadow intensity={1} />
                <pointLight position={[-20, -10, -20]} intensity={0.4} />
                <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
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
                    plaqueStyle={plaqueStyle}
                    nameConfig={nameConfig}
                    nameGeometry={nameGeometry}
                  />
                </Center>
              </Canvas>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--workbench-viewport)] p-8">
              {plaqueStyle === "placa" ? (
                <Canvas2DPreview config={config} />
              ) : (
                <div className="text-center space-y-2">
                  <Eye className="w-6 h-6 text-zinc-400 mx-auto" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Preview 2D disponível apenas no estilo Placa c/ Texto
                  </p>
                  <p className="text-[9px] text-zinc-500">Use a visão 3D para o estilo {plaqueStyle === "nome-silhueta" ? "Nome (Silhueta)" : "Nome em Placa"}</p>
                </div>
              )}
            </div>
          )}

          {/* HUD Overlay */}
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md border border-[var(--surface-container-high)] p-3 rounded-xl space-y-1">
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
        <div className="h-14 bg-[var(--workbench-panel)] border-t border-[var(--surface-container-high)] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={resetConfig}
              className="px-3 py-2 rounded-lg bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] text-[9px] font-bold uppercase flex items-center gap-1.5 hover:bg-[var(--surface-container-high)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Novo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleValidate}
              className="px-4 py-2 rounded-lg bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] text-[9px] font-bold uppercase flex items-center gap-1.5 hover:bg-[var(--surface-container-high)] transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Verificar Impressão
            </button>
            <button
              onClick={handleAddToCollection}
              className="px-4 py-2 rounded-lg bg-[var(--workbench-viewport)] border border-[#632CE5]/40 text-[#632CE5] text-[9px] font-bold uppercase flex items-center gap-1.5 hover:bg-[#632CE5]/10 transition-colors"
              title="Salvar esta plaquinha na coleção"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar à coleção
            </button>
            <button
              onClick={handleExportCurrent}
              disabled={currentExporting}
              className="px-5 py-2 rounded-lg bg-[#632CE5] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-[#7C4DFF] transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(99,44,229,0.3)]"
            >
              {currentExporting ? (
                <span className="animate-pulse">Processando...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Gerar STL (atual)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - Properties */}
      <div className="w-full md:w-[400px] bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto scrollbar-hide flex flex-col shrink-0">
        {/* Sidebar Tabs */}
        <div className="flex border-b border-[var(--surface-container-high)]">
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
          <button
            onClick={() => setSidebarTab("colecao")}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              sidebarTab === "colecao"
                ? "text-[#632CE5] border-b-2 border-[#632CE5]"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Coleção ({collection.plaques.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {sidebarTab === "colecao" ? (
            <CollectionPanel
              plaques={collection.plaques}
              onLoad={handleLoadPlaque}
              onDuplicate={collection.duplicatePlaque}
              onRemove={collection.removePlaque}
              onDownloadZip={handleDownloadZip}
              onDownload3mf={handleDownload3mf}
              batchExporting={batchExporting}
            />
          ) : sidebarTab === "propriedades" ? (
            <>
              {/* Plate Properties (só placa / nome-placa) */}
              {plaqueStyle !== "nome-silhueta" && (
              <Section title="Placa" icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <PropRow label="Largura" value={`${config.plateWidth}mm`}>
                  <input type="range" min="40" max="200" step="1" value={config.plateWidth}
                    onChange={(e) => updateConfig({ plateWidth: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Altura" value={`${config.plateHeight}mm`}>
                  <input type="range" min="20" max="120" step="1" value={config.plateHeight}
                    onChange={(e) => updateConfig({ plateHeight: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Espessura" value={`${config.plateThickness}mm`}>
                  <input type="range" min="0.5" max="6" step="0.5" value={config.plateThickness}
                    onChange={(e) => updateConfig({ plateThickness: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Raio Bordas" value={`${config.plateCornerRadius}mm`}>
                  <input type="range" min="0" max="20" step="1" value={config.plateCornerRadius}
                    onChange={(e) => updateConfig({ plateCornerRadius: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>

                {/* Forma da placa: presets + upload de SVG */}
                <div className="pt-1">
                  <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1.5">Forma</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PLATE_SHAPE_IDS.filter((id) => id !== "svg").map((id) => (
                      <button
                        key={id}
                        onClick={() => { setPlateSvgError(null); updateConfig({ plateShape: id }); }}
                        className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all ${
                          config.plateShape === id
                            ? "bg-[#632CE5]/10 border-[#632CE5]"
                            : "bg-[var(--workbench-viewport)] border-[var(--surface-container-high)] hover:border-[#632CE5]/30"
                        }`}
                      >
                        <div className="w-6 h-6">
                          <svg viewBox="-25 -25 50 50" className="w-full h-full">
                            <ShapeSVG shapeType={id} />
                          </svg>
                        </div>
                        <span className="text-[7px] font-bold uppercase text-zinc-500 leading-none">{id}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] text-zinc-400 mt-1">O formato preenche as dimensões Largura × Altura da placa.</p>
                  <input
                    ref={plateSvgInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="hidden"
                    onChange={handlePlateSvgUpload}
                  />
                  <button
                    onClick={() => plateSvgInputRef.current?.click()}
                    className={`w-full mt-2 p-2 rounded-lg border flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase transition-all ${
                      config.plateShape === "svg"
                        ? "border-[#632CE5] bg-[#632CE5]/10 text-[#632CE5]"
                        : "border-dashed border-[var(--surface-container-high)] text-zinc-500 hover:border-[#632CE5]/50"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {config.plateShape === "svg" ? "Trocar SVG" : "Enviar SVG da forma"}
                  </button>
                  {plateSvgError && <p className="text-[9px] text-red-500 mt-1">{plateSvgError}</p>}
                </div>
              </Section>
              )}

              {/* Colors (contextual por estilo) */}
              <Section title="Cores" icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <div className="grid grid-cols-2 gap-2">
                  {plaqueStyle !== "nome-silhueta" && (
                    <ColorField label="Placa" value={config.plateColor} onChange={(c) => { updateConfig({ plateColor: c }); setModelColor(c); }} />
                  )}
                  {plaqueStyle === "placa" && (
                    <ColorField label="Texto" value={config.textColor} onChange={(c) => updateConfig({ textColor: c })} />
                  )}
                  {plaqueStyle !== "nome-silhueta" && (
                    <ColorField label="Borda" value={config.borderColor} onChange={(c) => updateConfig({ borderColor: c })} />
                  )}
                  <ColorField label="Hastes" value={config.stickColor} onChange={(c) => updateConfig({ stickColor: c })} />
                </div>
              </Section>

              {/* Border */}
              {plaqueStyle !== "nome-silhueta" && (
              <Section title="Borda" icon={<Layers className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <ToggleRow label="Mostrar Borda" active={config.showBorder} onToggle={() => updateConfig({ showBorder: !config.showBorder })} />
                {config.showBorder && (
                  <PropRow label="Espessura" value={`${config.borderWidth}mm`}>
                    <input type="range" min="0.5" max="5" step="0.5" value={config.borderWidth}
                      onChange={(e) => updateConfig({ borderWidth: parseFloat(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                )}
              </Section>
              )}

              {/* Sticks */}
              <Section title="Hastes" icon={<TriangleRight className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <PropRow label="Quantidade" value={`${config.stickCount}`}>
                  <input type="range" min="1" max="5" step="1" value={config.stickCount}
                    onChange={(e) => updateConfig({ stickCount: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow
                  label="Espaçamento X"
                  value={config.sticks.length > 1 ? `${effectiveStickSpacing}mm` : "—"}
                >
                  <input
                    type="range"
                    min="10"
                    max={Math.max(10, config.plateWidth - config.stickWidth)}
                    step="1"
                    value={config.sticks.length > 1 ? Math.min(effectiveStickSpacing, Math.max(10, config.plateWidth - config.stickWidth)) : 10}
                    disabled={config.sticks.length < 2}
                    onChange={(e) => updateConfig({ stickSpacing: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                  />
                </PropRow>
                <PropRow label="Altura" value={`${config.stickHeight}mm`}>
                  <input type="range" min="20" max="150" step="1" value={config.stickHeight}
                    onChange={(e) => updateConfig({ stickHeight: parseInt(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Espessura" value={`${config.stickThickness}mm`}>
                  <input type="range" min="1" max="5" step="0.5" value={config.stickThickness}
                    onChange={(e) => updateConfig({ stickThickness: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Largura" value={`${config.stickWidth}mm`}>
                  <input type="range" min="2" max="10" step="0.5" value={config.stickWidth}
                    onChange={(e) => updateConfig({ stickWidth: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
                <PropRow label="Eixo Z (subir/descer)" value={`${config.stickZOffset}mm`}>
                  <input type="range" min="-20" max="20" step="1" value={config.stickZOffset}
                    onChange={(e) => updateConfig({ stickZOffset: parseFloat(e.target.value) })}
                    className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                </PropRow>
              </Section>

              {/* Selected Element */}
              {selectedElement && (
                <Section title={`Elemento: ${selectedElement.content}`} icon={<PenTool className="w-3.5 h-3.5 text-[#632CE5]" />}>
                  <PropRow label="Posição X" value={`${selectedElement.x}mm`}>
                    <input type="range" min={-config.plateWidth / 2} max={config.plateWidth / 2} step="1" value={selectedElement.x}
                      onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <PropRow label="Posição Y" value={`${selectedElement.y}mm`}>
                    <input type="range" min={-config.plateHeight / 2} max={config.plateHeight / 2} step="1" value={selectedElement.y}
                      onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <PropRow label="Escala" value={`${selectedElement.scale.toFixed(1)}x`}>
                    <input type="range" min="0.2" max="3" step="0.1" value={selectedElement.scale}
                      onChange={(e) => updateElement(selectedElement.id, { scale: parseFloat(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <PropRow label="Rotação" value={`${selectedElement.rotation}°`}>
                    <input type="range" min="-180" max="180" step="5" value={selectedElement.rotation}
                      onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })}
                      className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                  <ColorField label="Cor" value={selectedElement.color} onChange={(c) => updateElement(selectedElement.id, { color: c })} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => duplicateElement(selectedElement.id)}
                      className="flex-1 py-1.5 rounded bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] text-[9px] font-bold flex items-center justify-center gap-1 hover:bg-[var(--surface-container-high)]">
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
                            : "bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] hover:border-[#632CE5]/30"
                        }`}
                      >
                        <div className="w-4 h-4 rounded" style={{ background: el.color }} />
                        <span className="text-[9px] font-bold text-[var(--workbench-text)] truncate flex-1">
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
                      className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer" />
                  </PropRow>
                )}
              </Section>

              <Section title="Validação" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#632CE5]" />}>
                <button
                  onClick={handleValidate}
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
                  onClick={handleExportCurrent}
                  disabled={currentExporting}
                  className="btn-primary"
                >
                  {currentExporting ? (
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
      className="flex items-center justify-between p-2.5 bg-[var(--workbench-viewport)] rounded-lg border border-[var(--surface-container-high)] cursor-pointer hover:border-[#632CE5]/30 transition-all"
    >
      <span className="text-[9px] font-bold uppercase text-[var(--workbench-text)]">{label}</span>
      <div className={`w-8 h-4.5 rounded-full transition-colors relative ${active ? "bg-[#632CE5]" : "bg-[var(--surface-container-high)]"}`}>
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
        className="w-6 h-6 rounded border border-[var(--surface-container-high)] cursor-pointer"
      />
      <div className="flex-1">
        <label className="text-[8px] uppercase font-bold text-zinc-500 block">{label}</label>
        <span className="text-[9px] font-mono text-zinc-400">{value}</span>
      </div>
    </div>
  );
}

const STYLE_LABEL: Record<PlaqueStyle, string> = {
  placa: "Placa c/ Texto",
  "nome-silhueta": "Nome (Silhueta)",
  "nome-placa": "Nome em Placa",
};

/** Aba Coleção (T7): lista da coleção + downloads em lote [C2, C5, X1, X2]. */
function CollectionPanel({ plaques, onLoad, onDuplicate, onRemove, onDownloadZip, onDownload3mf, batchExporting }: {
  plaques: Plaque[];
  onLoad: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onDownloadZip: () => void;
  onDownload3mf: () => void;
  batchExporting: "zip" | "3mf" | null;
}) {
  const empty = plaques.length === 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-black flex items-center gap-2">
          <Sticker className="w-3.5 h-3.5 text-[#632CE5]" />
          Coleção
        </h3>
        <span className="text-[10px] font-mono text-[#632CE5]">{plaques.length}</span>
      </div>

      {empty ? (
        <div className="p-5 text-center bg-[var(--workbench-viewport)] border border-dashed border-[var(--surface-container-high)] rounded-lg space-y-1.5">
          <Sticker className="w-6 h-6 text-zinc-400 mx-auto" />
          <p className="text-[10px] font-bold uppercase text-zinc-400">Nenhuma plaquinha salva</p>
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            Monte sua plaquinha e clique em <span className="font-bold text-[#632CE5]">Adicionar à coleção</span> na barra inferior.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {plaques.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] rounded-lg hover:border-[#632CE5]/30 transition-colors">
              <div
                className="w-4 h-4 rounded shrink-0 border border-white shadow"
                style={{ background: p.style === "placa" ? p.topper.plateColor : p.name.baseColor }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[var(--workbench-text)] truncate">{p.label}</div>
                <div className="text-[8px] uppercase font-bold text-zinc-400">{STYLE_LABEL[p.style]}</div>
              </div>
              <button
                title="Carregar no editor"
                onClick={() => onLoad(p.id)}
                className="p-1.5 rounded hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              <button
                title="Duplicar"
                onClick={() => onDuplicate(p.id)}
                className="p-1.5 rounded hover:bg-[#632CE5]/10 text-zinc-500 hover:text-[#632CE5] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                title="Excluir"
                onClick={() => onRemove(p.id)}
                className="p-1.5 rounded hover:bg-red-50 text-zinc-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--surface-container-high)] pt-3 space-y-2">
        <button
          onClick={onDownloadZip}
          disabled={empty || batchExporting !== null}
          className="w-full py-2.5 rounded-lg bg-[#632CE5]/10 border border-[#632CE5]/30 text-[10px] font-black uppercase text-[#632CE5] flex items-center justify-center gap-2 hover:bg-[#632CE5]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          {batchExporting === "zip" ? "Gerando..." : "Baixar ZIP (STL)"}
        </button>
        <button
          onClick={onDownload3mf}
          disabled={empty || batchExporting !== null}
          className="w-full py-2.5 rounded-lg bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] text-[10px] font-black uppercase text-[var(--workbench-text)] flex items-center justify-center gap-2 hover:bg-[var(--surface-container-high)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Box className="w-3.5 h-3.5" />
          {batchExporting === "3mf" ? "Gerando..." : "Baixar 3MF"}
        </button>
        <p className="text-[8px] text-zinc-400 text-center leading-relaxed">
          ZIP: 1 STL por plaquinha · 3MF: todas em grade, cores separadas
        </p>
      </div>
    </div>
  );
}

/** Painel esquerdo dos estilos de nome (T6): texto, fonte, 6 sliders e cores. */
function NamePanel({ nameConfig, onChange, nameGeometry }: {
  nameConfig: KeychainConfig;
  onChange: (next: KeychainConfig) => void;
  nameGeometry: NamePlaqueGeometryState;
}) {
  const slider = (
    label: string,
    value: string,
    min: string,
    max: string,
    step: string,
    field: "letterHeight" | "letterSpacing" | "fontWeightScale" | "outlineSize" | "bodyThickness" | "reliefThickness"
  ) => (
    <PropRow label={label} value={value}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={nameConfig[field]}
        onChange={(e) => onChange({ ...nameConfig, [field]: parseFloat(e.target.value) })}
        className="w-full accent-[#632CE5] h-1.5 bg-[var(--surface-container-high)] rounded-lg appearance-none cursor-pointer"
      />
    </PropRow>
  );

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between mb-1.5">
          <label className="text-[9px] uppercase font-bold text-zinc-500">Nome</label>
          <span className="text-[10px] font-mono text-[#632CE5]">{nameConfig.text.length}/18</span>
        </div>
        <input
          type="text"
          value={nameConfig.text}
          onChange={(e) => onChange({ ...nameConfig, text: e.target.value.substring(0, 18) })}
          maxLength={18}
          placeholder="Nome no bolo (ex: Milene)"
          className="w-full bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] p-2.5 rounded-lg text-sm text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-all"
        />
      </div>

      <FontPicker
        fontFamily={nameConfig.fontFamily}
        customFontName={nameConfig.customFontName}
        onChange={(patch) => onChange({ ...nameConfig, ...patch })}
      />

      {slider("Tamanho da Letra", `${nameConfig.letterHeight}mm`, "10", "28", "1", "letterHeight")}
      {slider("Espaçamento entre Letras", `${nameConfig.letterSpacing}mm`, "0", "2.5", "0.1", "letterSpacing")}
      {slider("Espessura da Fonte", `${nameConfig.fontWeightScale}x`, "0.5", "2", "0.1", "fontWeightScale")}
      {slider("Contorno", `${nameConfig.outlineSize}mm`, "1", "6", "0.2", "outlineSize")}
      {slider("Corpo", `${nameConfig.bodyThickness}mm`, "1.5", "6", "0.1", "bodyThickness")}
      {slider("Relevo", `${nameConfig.reliefThickness}mm`, "0.8", "4", "0.2", "reliefThickness")}

      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Corpo" value={nameConfig.baseColor} onChange={(c) => onChange({ ...nameConfig, baseColor: c })} />
        <ColorField label="Relevo" value={nameConfig.reliefColor} onChange={(c) => onChange({ ...nameConfig, reliefColor: c })} />
      </div>

      {nameGeometry.generating && (
        <div className="flex items-center gap-2 p-2 rounded bg-[#632CE5]/5 border border-[#632CE5]/20 text-[9px] font-bold text-[#632CE5]">
          <span className="w-3 h-3 border-2 border-[#632CE5] border-t-transparent rounded-full animate-spin shrink-0" />
          Gerando geometria do nome…
        </div>
      )}
      {nameGeometry.error && (
        <div className="flex items-start gap-2 p-2 rounded bg-red-50 text-red-700 text-[9px]">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="font-bold">{nameGeometry.error}</span>
        </div>
      )}
      {nameGeometry.dimensions && !nameGeometry.generating && (
        <div className="text-[9px] font-mono text-zinc-400">
          {nameGeometry.dimensions.dimX} × {nameGeometry.dimensions.dimY} mm · relevo {nameConfig.reliefThickness}mm
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--workbench-viewport)] border border-[var(--surface-container-high)] rounded-lg p-2">
      <label className="text-[8px] uppercase font-bold text-zinc-400 block">{label}</label>
      <span className="text-[11px] font-mono font-bold text-[#632CE5]">{value}</span>
    </div>
  );
}

function ShapeSVG({ shapeType }: { shapeType: string }) {
  switch (shapeType) {
    case "retangulo":
      return <rect x="-16" y="-10" width="32" height="20" rx="5" fill="#632CE5" opacity="0.6" />;
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
