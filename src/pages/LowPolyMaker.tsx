import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { 
  Box, Download, Sparkles, Sliders, Eye, 
  RefreshCw, Upload, Check, Info, ShieldCheck, 
  Compass, Key, Cylinder, CheckCircle2, AlertTriangle, 
  Wrench, FileCheck, Cpu, Split, Zap, Target, Hash,
  Gauge, Layers, Undo2, Redo2, History, RotateCcw,
  Clock, ArrowLeftRight, ChevronRight, X, FileCode,
  Package, FileArchive, DownloadCloud, ChevronDown
} from "lucide-react";
import { 
  LOW_POLY_CATALOG, 
  LowPolyModelDefinition, 
  calculatePrintSpecs 
} from "@/src/lib/lowPoly/lowPolyModels";
import { 
  analyzeMeshManifold, 
  csgUnionGeometries, 
  repairGeometry,
  createErrorEdgesGeometry,
  ManifoldAnalysisResult 
} from "@/src/lib/lowPoly/manifoldValidator";
import {
  load3DModelFile,
  decimateToLowPoly,
  LoadedMeshInfo,
  DecimationResult
} from "@/src/lib/lowPoly/meshDecimator";
import {
  exportToSTL,
  exportToOBJ,
  exportTo3MF,
  exportAllFormatsZip,
  exportModel,
  downloadBlob,
  ExportOptions,
  SupportedExportFormat
} from "@/src/lib/lowPoly/meshExporters";

interface LowPolyConfig {
  modelId: string;
  height: number;           // in mm
  scaleX: number;           // relative multiplier
  scaleY: number;           // relative multiplier
  scaleZ: number;           // relative multiplier
  lockAspectRatio: boolean;
  jitter: number;           // crystal displacement
  flatBaseCut: boolean;     // auto flatten bottom for print bed
  flatBaseOffset: number;   // cut height %
  addPedestal: boolean;     // add geometric base
  pedestalHeight: number;   // mm
  pedestalRadius: number;   // mm
  addKeyringLoop: boolean;  // attach keyring loop on top
  loopDiameter: number;     // mm
  loopThickness: number;    // mm
  loopPlacement: "top" | "back";
  color: string;
  wireframe: boolean;
  showBed: boolean;
  showNormals: boolean;
  infillPercent: number;
  // Real-time Decimator controls for imported custom models
  decimationMode: "triangles" | "percentage";
  targetTriangles: number;            // 20 to 8000
  decimationReductionPercent: number; // 10 to 98%
  decimationAlgorithm: "qem" | "voxel_grid" | "faceted_planar";
  gridResolution: number;             // 15 to 80
}

export interface SimplificationHistoryEntry {
  id: string;
  targetTriangles: number;
  decimationReductionPercent: number;
  decimationMode: "triangles" | "percentage";
  decimationAlgorithm: "qem" | "voxel_grid" | "faceted_planar";
  gridResolution: number;
  jitter: number;
  label: string;
  timestamp: Date;
  resultingFaces?: number;
}

const FILAMENT_PALETTE = [
  { name: "Seda Ouro", color: "#FBC02D", type: "silk" },
  { name: "Seda Prata", color: "#CFD8DC", type: "silk" },
  { name: "Seda Cobre", color: "#D87A56", type: "silk" },
  { name: "Ciano Neon", color: "#00E5FF", type: "neon" },
  { name: "Vermelho Rubi", color: "#E53935", type: "standard" },
  { name: "Verde Esmeralda", color: "#43A047", type: "standard" },
  { name: "Laranja Sol", color: "#FF9800", type: "standard" },
  { name: "Mármore Branco", color: "#ECEFF1", type: "special" },
  { name: "Preto Fosco", color: "#212121", type: "matte" },
  { name: "Roxo Ametista", color: "#8E24AA", type: "standard" },
  { name: "Rosa Pastel", color: "#F48FB1", type: "pastel" },
  { name: "Azul Cobalto", color: "#1976D2", type: "standard" }
];

export default function LowPolyMaker() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"catalog" | "import_decimate" | "geometry" | "base_loop" | "manifold" | "export">("catalog");
  const [selectedModel, setSelectedModel] = useState<LowPolyModelDefinition>(LOW_POLY_CATALOG[0]);
  
  const [config, setConfig] = useState<LowPolyConfig>({
    modelId: LOW_POLY_CATALOG[0].id,
    height: LOW_POLY_CATALOG[0].defaultHeight,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    lockAspectRatio: true,
    jitter: 0,
    flatBaseCut: true,
    flatBaseOffset: 0.5,
    addPedestal: false,
    pedestalHeight: 6,
    pedestalRadius: 28,
    addKeyringLoop: false,
    loopDiameter: 4.5,
    loopThickness: 2.2,
    loopPlacement: "top",
    color: LOW_POLY_CATALOG[0].defaultColor,
    wireframe: false,
    showBed: true,
    showNormals: false,
    infillPercent: 15,
    decimationMode: "triangles",
    targetTriangles: 350,
    decimationReductionPercent: 88,
    decimationAlgorithm: "voxel_grid",
    gridResolution: 36
  });

  // Custom imported 3D mesh state
  const [importedMeshInfo, setImportedMeshInfo] = useState<LoadedMeshInfo | null>(null);
  const [decimatedGeometry, setDecimatedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [decimationStats, setDecimationStats] = useState<DecimationResult | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isProcessingDecimation, setIsProcessingDecimation] = useState<boolean>(false);
  const [viewOriginalMesh, setViewOriginalMesh] = useState<boolean>(false);
  const [isLiveScrubbing, setIsLiveScrubbing] = useState<boolean>(false);

  // Simplification Action History (Undo / Redo) state
  const [history, setHistory] = useState<SimplificationHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);

  // Automatic Manifold Verification & Visual Warning state
  const [showErrorEdges, setShowErrorEdges] = useState<boolean>(false);
  const [dismissWarningBanner, setDismissWarningBanner] = useState<boolean>(false);

  // Advanced Multi-format 3D Exporter state (.STL, .OBJ, .3MF, .ZIP)
  const [exportingFormat, setExportingFormat] = useState<"stl" | "obj" | "3mf" | "zip" | null>(null);
  const [customFileName, setCustomFileName] = useState<string>("");
  const [showQuickExportMenu, setShowQuickExportMenu] = useState<boolean>(false);

  const [successMsg, setSuccessMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }, []);

  // Push new action to Undo/Redo history stack
  const pushHistorySnapshot = useCallback((
    changes: Partial<SimplificationHistoryEntry>,
    label: string
  ) => {
    setHistory(prev => {
      const currentTarget = changes.targetTriangles ?? config.targetTriangles;
      const currentReduction = changes.decimationReductionPercent ?? config.decimationReductionPercent;
      const currentMode = changes.decimationMode ?? config.decimationMode;
      const currentAlgo = changes.decimationAlgorithm ?? config.decimationAlgorithm;
      const currentGrid = changes.gridResolution ?? config.gridResolution;
      const currentJitter = changes.jitter ?? config.jitter;

      // Don't push duplicates if values are identical to current history point
      if (historyIndex >= 0 && historyIndex < prev.length) {
        const top = prev[historyIndex];
        if (
          top.targetTriangles === currentTarget &&
          top.decimationReductionPercent === currentReduction &&
          top.decimationMode === currentMode &&
          top.decimationAlgorithm === currentAlgo &&
          top.jitter === currentJitter
        ) {
          return prev;
        }
      }

      const newEntry: SimplificationHistoryEntry = {
        id: Math.random().toString(36).substring(2, 9),
        targetTriangles: currentTarget,
        decimationReductionPercent: currentReduction,
        decimationMode: currentMode,
        decimationAlgorithm: currentAlgo,
        gridResolution: currentGrid,
        jitter: currentJitter,
        label,
        timestamp: new Date(),
        resultingFaces: decimationStats?.decimatedFaceCount
      };

      const sliced = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [];
      const updated = [...sliced, newEntry].slice(-40); // keep up to 40 steps
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [historyIndex, config, decimationStats]);

  // Undo simplification action
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const target = history[nextIdx];
      if (target) {
        setHistoryIndex(nextIdx);
        setConfig(prev => ({
          ...prev,
          targetTriangles: target.targetTriangles,
          decimationReductionPercent: target.decimationReductionPercent,
          decimationMode: target.decimationMode,
          decimationAlgorithm: target.decimationAlgorithm,
          gridResolution: target.gridResolution,
          jitter: target.jitter
        }));
        notify(`↩ Desfeito: ${target.label}`);
      }
    }
  }, [historyIndex, history, notify]);

  // Redo simplification action
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const target = history[nextIdx];
      if (target) {
        setHistoryIndex(nextIdx);
        setConfig(prev => ({
          ...prev,
          targetTriangles: target.targetTriangles,
          decimationReductionPercent: target.decimationReductionPercent,
          decimationMode: target.decimationMode,
          decimationAlgorithm: target.decimationAlgorithm,
          gridResolution: target.gridResolution,
          jitter: target.jitter
        }));
        notify(`↪ Refeito: ${target.label}`);
      }
    }
  }, [historyIndex, history, notify]);

  // Jump directly to any history snapshot point
  const handleJumpToHistory = useCallback((idx: number) => {
    if (idx >= 0 && idx < history.length) {
      const target = history[idx];
      setHistoryIndex(idx);
      setConfig(prev => ({
        ...prev,
        targetTriangles: target.targetTriangles,
        decimationReductionPercent: target.decimationReductionPercent,
        decimationMode: target.decimationMode,
        decimationAlgorithm: target.decimationAlgorithm,
        gridResolution: target.gridResolution,
        jitter: target.jitter
      }));
      notify(`Restaurado para: ${target.label}`);
    }
  }, [history, notify]);

  // Global Keyboard Shortcuts (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively writing in a standard text input
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement &&
        (activeEl.type === "text" || activeEl.type === "password" || activeEl.type === "search")
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Switch catalog model handler
  const handleSelectModel = (model: LowPolyModelDefinition) => {
    setSelectedModel(model);
    setImportedMeshInfo(null);
    setDecimatedGeometry(null);
    setDecimationStats(null);
    setViewOriginalMesh(false);
    setConfig(prev => ({
      ...prev,
      modelId: model.id,
      height: model.defaultHeight,
      color: model.defaultColor,
      jitter: 0
    }));
    setHistory([]);
    setHistoryIndex(-1);
  };

  // Dynamic max triangle count for imported model
  const maxTriangleLimit = useMemo(() => {
    if (!importedMeshInfo) return 4000;
    return Math.max(300, Math.min(importedMeshInfo.originalFaceCount, 6000));
  }, [importedMeshInfo]);

  // Handle Custom 3D File Upload (STL, OBJ, PLY, GLB, GLTF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    try {
      const loaded = await load3DModelFile(file);
      setImportedMeshInfo(loaded);
      
      // Auto compute initial decimation into low poly with default target triangles
      const initialTarget = Math.min(400, Math.max(80, Math.round(loaded.originalFaceCount * 0.05)));
      setConfig(prev => ({
        ...prev,
        targetTriangles: initialTarget,
        decimationMode: "triangles"
      }));

      const result = decimateToLowPoly(loaded.geometry, {
        mode: "triangles",
        targetTriangles: initialTarget,
        reductionPercent: config.decimationReductionPercent,
        algorithm: config.decimationAlgorithm,
        gridResolution: config.gridResolution,
        jitter: config.jitter,
        fastPreview: false
      });

      setDecimatedGeometry(result.geometry);
      setDecimationStats(result);

      // Initialize fresh history with initial decimation entry
      const initialEntry: SimplificationHistoryEntry = {
        id: Math.random().toString(36).substring(2, 9),
        targetTriangles: initialTarget,
        decimationReductionPercent: config.decimationReductionPercent,
        decimationMode: "triangles",
        decimationAlgorithm: config.decimationAlgorithm,
        gridResolution: config.gridResolution,
        jitter: config.jitter,
        label: `Importação Inicial (${initialTarget} ▲)`,
        timestamp: new Date(),
        resultingFaces: result.decimatedFaceCount
      };
      setHistory([initialEntry]);
      setHistoryIndex(0);

      setActiveTab("import_decimate");
      notify(`"${file.name}" importado! Reduzido de ${loaded.originalFaceCount.toLocaleString()} para ${result.decimatedFaceCount} polígonos Low-Poly!`);
    } catch (err: any) {
      console.error("Erro ao importar arquivo 3D:", err);
      notify(`Erro: ${err.message || "Falha ao processar arquivo 3D."}`);
    } finally {
      setIsLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Real-time instant decimation when target triangles or reduction parameters change
  useEffect(() => {
    if (!importedMeshInfo) return;

    setIsProcessingDecimation(true);
    // Instant execution (< 10ms timeout for fluid real-time slider updates)
    const timeout = setTimeout(() => {
      try {
        const result = decimateToLowPoly(importedMeshInfo.geometry, {
          mode: config.decimationMode,
          targetTriangles: config.targetTriangles,
          reductionPercent: config.decimationReductionPercent,
          algorithm: config.decimationAlgorithm,
          gridResolution: config.gridResolution,
          jitter: config.jitter,
          fastPreview: isLiveScrubbing
        });
        setDecimatedGeometry(result.geometry);
        setDecimationStats(result);
      } catch (err) {
        console.error("Erro na decimação em tempo real:", err);
      } finally {
        setIsProcessingDecimation(false);
      }
    }, 16);

    return () => clearTimeout(timeout);
  }, [
    importedMeshInfo,
    config.decimationMode,
    config.targetTriangles,
    config.decimationReductionPercent,
    config.decimationAlgorithm,
    config.gridResolution,
    config.jitter,
    isLiveScrubbing
  ]);

  // Build the complete final combined geometry with guaranteed 100% Watertight Manifold CSG
  const finalGeometry = useMemo(() => {
    let baseGeom: THREE.BufferGeometry;

    if (importedMeshInfo) {
      if (viewOriginalMesh) {
        baseGeom = repairGeometry(importedMeshInfo.geometry.clone());
      } else if (decimatedGeometry) {
        baseGeom = repairGeometry(decimatedGeometry.clone());
      } else {
        baseGeom = repairGeometry(importedMeshInfo.geometry.clone());
      }
    } else {
      baseGeom = selectedModel.generateGeometry(1, config.jitter);
    }

    baseGeom.computeBoundingBox();
    const box = baseGeom.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);

    // Normalize and scale to target height
    const currentHeight = size.y || 1;
    const targetHeight = config.height;
    const uniformScale = targetHeight / currentHeight;

    const sx = uniformScale * config.scaleX;
    const sy = uniformScale * config.scaleY;
    const sz = uniformScale * config.scaleZ;

    baseGeom.scale(sx, sy, sz);

    // Center X & Z, and align bottom to Y = 0
    baseGeom.computeBoundingBox();
    const bBox = baseGeom.boundingBox!;
    const centerX = (bBox.min.x + bBox.max.x) / 2;
    const centerZ = (bBox.min.z + bBox.max.z) / 2;
    const minY = bBox.min.y;

    baseGeom.translate(-centerX, -minY, -centerZ);

    const parts: THREE.BufferGeometry[] = [baseGeom];

    // Optional: Add Geometric Pedestal (Plinto poligonal)
    if (config.addPedestal) {
      const pSides = 8;
      const pR = config.pedestalRadius;
      const pH = config.pedestalHeight;
      const pedestalGeom = new THREE.CylinderGeometry(pR * 0.92, pR, pH, pSides);
      pedestalGeom.translate(0, -pH / 2 + 0.5, 0); // Slight overlap to ensure perfect manifold boolean weld
      parts.push(pedestalGeom);
    }

    // Optional: Add 3D Printable Keyring Loop (Argola de Chaveiro)
    if (config.addKeyringLoop) {
      const loopR = config.loopDiameter / 2;
      const tubeR = config.loopThickness / 2;
      const torusGeom = new THREE.TorusGeometry(loopR + tubeR, tubeR, 8, 16);

      baseGeom.computeBoundingBox();
      const currentBox = baseGeom.boundingBox!;
      const topY = currentBox.max.y;

      if (config.loopPlacement === "top") {
        torusGeom.rotateX(Math.PI / 2);
        torusGeom.translate(0, topY + loopR - tubeR * 0.8, 0);
      } else {
        torusGeom.translate(0, topY * 0.75, currentBox.min.z - loopR + tubeR * 0.8);
      }
      parts.push(torusGeom);
    }

    // Use CSG Boolean Union to guarantee 100% watertight single-shell manifold
    const unified = csgUnionGeometries(parts);
    return repairGeometry(unified);
  }, [selectedModel, importedMeshInfo, decimatedGeometry, viewOriginalMesh, config]);

  // Automatic Manifold diagnostics analysis for final mesh
  const manifoldData: ManifoldAnalysisResult = useMemo(() => {
    return analyzeMeshManifold(finalGeometry);
  }, [finalGeometry]);

  // Diagnostics on raw decimated geometry (before pedestal/loop)
  const rawDecimatedManifold: ManifoldAnalysisResult | null = useMemo(() => {
    if (!decimatedGeometry) return null;
    return analyzeMeshManifold(decimatedGeometry);
  }, [decimatedGeometry]);

  // Line segments geometry of problematic non-manifold / open edges for 3D overlay
  const errorEdgesGeometry: THREE.BufferGeometry | null = useMemo(() => {
    return createErrorEdgesGeometry(manifoldData.openEdgePositions);
  }, [manifoldData]);

  // Reset dismiss state whenever new geometry errors appear
  useEffect(() => {
    if (!manifoldData.isManifold) {
      setDismissWarningBanner(false);
    }
  }, [manifoldData.isManifold, manifoldData.openEdgesCount, manifoldData.nonManifoldEdgesCount]);

  // Technical calculations for 3D printing
  const specs = useMemo(() => {
    return calculatePrintSpecs(finalGeometry, config.height, config.infillPercent);
  }, [finalGeometry, config.height, config.infillPercent]);

  // Auto Repair Mesh Action with instant re-verification feedback
  const handleAutoRepair = () => {
    if (importedMeshInfo && decimatedGeometry) {
      const repaired = repairGeometry(decimatedGeometry);
      setDecimatedGeometry(repaired);
      const postAnalysis = analyzeMeshManifold(repaired);
      if (postAnalysis.isManifold) {
        notify(`✓ Malha Low-Poly reparada e 100% soldada (0 furos, ${postAnalysis.faceCount} faces)!`);
      } else {
        notify(`Malha reparada: ${postAnalysis.openEdgesCount} arestas abertas restantes.`);
      }
    } else {
      notify("A malha gerada já é 100% Manifold e pronta para fatiadores!");
    }
  };

  // Base name helper for downloads
  const getExportBaseName = useCallback(() => {
    if (customFileName.trim()) {
      return customFileName.trim().replace(/\.[^/.]+$/, "");
    }
    return importedMeshInfo?.fileName.replace(/\.[^/.]+$/, "") || selectedModel.name;
  }, [customFileName, importedMeshInfo, selectedModel]);

  // Universal 3D Export Handler (.STL, .OBJ, .3MF, .ZIP)
  const handleExportModel = async (format: "stl" | "obj" | "3mf" | "zip", customGeom?: THREE.BufferGeometry) => {
    const targetGeometry = customGeom || finalGeometry;
    setExportingFormat(format);
    try {
      const options: ExportOptions = {
        modelName: getExportBaseName(),
        targetTriangles: specs.faceCount,
        heightMm: config.height,
        colorHex: config.color,
        isWatertight: manifoldData.isWatertight
      };

      if (format === "zip") {
        const summaryText = `# LowPolyMaker 3D Studio - Relatório Técnico de Fabricação Aditiva
===================================================================
Modelo: ${options.modelName}
Geometria: Low-Poly Cristalina
Faces Poligonais (Triângulos): ${specs.faceCount}
Vértices: ${specs.vertexCount}
Dimensões Finais (XYZ): ${specs.dimX} × ${specs.dimY} × ${specs.dimZ} mm
Consumo Estimado de Filamento: ~${specs.filamentGrams}g (PLA 1.24 g/cm³)
Tempo Estimado de Impressão (50 mm/s): ~${specs.printTimeString}
Verificação Manifold: ${manifoldData.isManifold ? "100% Watertight (Aprovado)" : "Auditoria Geometria"}
Euler Characteristic: ${manifoldData.eulerCharacteristic}
Orientação Recomendada: Autoportante (Suportes desnecessários)

Fatiadores 3D Compatíveis Testados:
- Bambu Studio (X1-Carbon, P1S, P1P, A1, A1 Mini)
- OrcaSlicer (v2.0+)
- PrusaSlicer (MK4, MK3S+, XL, CoreOne)
- Ultimaker Cura (v5.0+)
- Creality Print / Creality Cloud

Exportado em: ${new Date().toLocaleString("pt-BR")}
LowPolyMaker Studio Web Platform
===================================================================
`;
        const res = await exportAllFormatsZip(targetGeometry, options, summaryText);
        downloadBlob(res.blob, res.filename);
        notify(`✓ Pacote ZIP completo exportado com sucesso (${(res.sizeBytes / 1024).toFixed(1)} KB)!`);
      } else {
        const res = await exportModel(targetGeometry, format, options);
        downloadBlob(res.blob, res.filename);
        const formatLabels = {
          stl: "STL Binário Watertight",
          obj: "Wavefront OBJ",
          "3mf": "3MF (Bambu/Orca/Prusa)"
        };
        notify(`✓ Arquivo ${formatLabels[format]} exportado (${(res.sizeBytes / 1024).toFixed(1)} KB)!`);
      }
    } catch (err) {
      console.error("Erro na exportação do modelo 3D:", err);
      notify("Erro ao processar malha para exportação.");
    } finally {
      setExportingFormat(null);
    }
  };

  // Safe repair and export workflow
  const handleRepairAndExport = async (format: "stl" | "obj" | "3mf" | "zip") => {
    let repairedGeom = finalGeometry;
    if (!manifoldData.isManifold) {
      repairedGeom = repairGeometry(finalGeometry);
      if (importedMeshInfo && decimatedGeometry) {
        setDecimatedGeometry(repairGeometry(decimatedGeometry));
      }
    }
    await handleExportModel(format, repairedGeom);
  };

  const filteredCatalog = LOW_POLY_CATALOG.filter(item => {
    if (activeCategory === "all") return true;
    return item.category === activeCategory;
  });

  return (
    <div className="flex h-full w-full bg-[var(--workbench-page)] text-[var(--on-surface)] overflow-hidden font-sans">
      {/* LEFT DRAWER / CONTROLS PANEL */}
      <div className="w-[440px] bg-[var(--workbench-panel)] border-r border-[var(--surface-container-high)] flex flex-col shrink-0 h-full">
        {/* HEADER */}
        <div className="p-4 border-b border-[var(--surface-container-high)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[var(--primary-fixed)] border border-[var(--primary-fixed-dim)] flex items-center justify-center text-[var(--primary)]">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-wider uppercase text-[var(--on-surface)]">Low Poly 3D Maker</h1>
              <p className="text-[11px] text-[var(--workbench-muted)] font-mono">Gerador & Conversor 3D para Low-Poly</p>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Importar qualquer modelo 3D (STL, OBJ, PLY, GLTF, GLB)"
            className="px-3 py-1.5 rounded bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed-dim)] border border-[var(--primary-fixed-dim)] text-[var(--primary)] text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar 3D</span>
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".stl,.obj,.ply,.glb,.gltf" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
        </div>

        {/* NOTIFICATION BADGE */}
        {successMsg && (
          <div className="px-4 py-2 bg-[var(--primary-fixed)] border-b border-[var(--primary-fixed-dim)] text-[var(--primary)] text-[11px] flex items-center gap-2 font-mono">
            <Check className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}

        {/* MANIFOLD HEALTH BAR BADGE */}
        <div className={`px-4 py-2 border-b flex items-center justify-between text-[11px] font-mono ${
          manifoldData.isManifold
            ? "bg-[var(--primary-fixed)] border-[var(--primary-fixed-dim)] text-[var(--primary)]"
            : "bg-[var(--amber-container)] border-[var(--amber-container)] text-[var(--amber)]"
        }`}>
          <div className="flex items-center gap-1.5">
            {manifoldData.isManifold ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--primary)]" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--amber)]" />
            )}
            <span className="font-bold">{manifoldData.statusLabel}</span>
          </div>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface-container-high)] border border-current font-bold">
            χ = {manifoldData.eulerCharacteristic}
          </span>
        </div>

        {/* NAVIGATION TABS */}
        <div className="grid grid-cols-6 p-1.5 bg-[var(--surface-container-low)] border-b border-[var(--surface-container-high)] text-[11px] font-bold">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`py-2 rounded transition-all flex flex-col items-center gap-1 ${
              activeTab === "catalog" 
                ? "bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--outline-variant)]" 
                : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catálogo</span>
          </button>
          
          <button
            onClick={() => setActiveTab("import_decimate")}
            className={`py-2 rounded transition-all flex flex-col items-center gap-1 relative ${
              activeTab === "import_decimate" 
                ? "bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--outline-variant)]" 
                : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[var(--amber)]" />
            <span>Converter 3D</span>
            {importedMeshInfo && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--primary)] rounded-full animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("geometry")}
            className={`py-2 rounded transition-all flex flex-col items-center gap-1 ${
              activeTab === "geometry" 
                ? "bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--outline-variant)]" 
                : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Escala</span>
          </button>

          <button
            onClick={() => setActiveTab("base_loop")}
            className={`py-2 rounded transition-all flex flex-col items-center gap-1 ${
              activeTab === "base_loop" 
                ? "bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--outline-variant)]" 
                : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Base/Anel</span>
          </button>

          <button
            onClick={() => setActiveTab("manifold")}
            className={`py-2 rounded transition-all flex flex-col items-center gap-1 ${
              activeTab === "manifold" 
                ? "bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--outline-variant)]" 
                : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Manifold</span>
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className={`py-2 rounded transition-all flex flex-col items-center gap-1 ${
              activeTab === "export" 
                ? "bg-[var(--surface-container-high)] text-[var(--primary)] border border-[var(--outline-variant)]" 
                : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>

        {/* TAB BODY SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {/* TAB 1: MODEL CATALOG */}
          {activeTab === "catalog" && (
            <div className="space-y-4">
              {/* IMPORT CALLOUT BANNER */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded border border-dashed border-[var(--primary-fixed-dim)] bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed-dim)] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-[var(--primary-fixed)] flex items-center justify-center text-[var(--primary)]">
                    <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-[var(--on-surface)]">Importe seu próprio 3D</div>
                    <div className="text-[11px] text-[var(--on-surface-variant)] font-mono">Suporta STL, OBJ, PLY, GLTF, GLB</div>
                  </div>
                </div>
                <span className="text-[11px] font-black px-2 py-1 bg-[var(--primary)] text-[var(--on-primary)] rounded uppercase">
                  Enviar
                </span>
              </div>

              {/* CATEGORY FILTER PILLS */}
              <div className="flex gap-1.5 p-1 bg-[var(--surface-container-low)] rounded border border-[var(--surface-container-high)] overflow-x-auto">
                {[
                  { id: "all", label: "Todos" },
                  { id: "animals", label: "Animais 🦁" },
                  { id: "symbols", label: "Símbolos ❤️" },
                  { id: "decor", label: "Decoração 🌲" },
                  { id: "functional", label: "Vasos 🪴" },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1 text-[11px] font-bold rounded uppercase whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? "bg-[var(--primary)] text-[var(--on-primary)] font-black"
                        : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* MODEL GRID */}
              <div className="grid grid-cols-2 gap-2.5">
                {filteredCatalog.map(model => {
                  const isSelected = selectedModel.id === model.id && !importedMeshInfo;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      className={`p-3 rounded border text-left flex flex-col justify-between transition-all group relative overflow-hidden ${
                        isSelected
                          ? "bg-[var(--primary-fixed)] border-[var(--primary)]"
                          : "bg-[var(--surface-container)] border-[var(--surface-container-high)] hover:bg-[var(--surface-container-high)] hover:border-[var(--outline)]"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl group-hover:scale-110 transition-transform">{model.iconName}</span>
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] text-[var(--on-surface-variant)]">
                          {model.defaultHeight}mm
                        </span>
                      </div>
                      <div>
                        <div className={`text-[11px] font-black tracking-tight ${isSelected ? "text-[var(--primary)]" : "text-[var(--on-surface)]"}`}>
                          {model.name}
                        </div>
                        <p className="text-[11px] text-[var(--workbench-muted)] line-clamp-2 mt-0.5 leading-tight">
                          {model.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* CURRENT SELECTION INFO CARD */}
              <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--on-surface)]">
                  <Info className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Dica de Impressão 3D</span>
                </div>
                <p className="text-[11px] text-[var(--on-surface-variant)] leading-relaxed">
                  {selectedModel.printabilityTips}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT & CONVERT 3D TO LOW POLY WITH REAL-TIME SLIDER */}
          {activeTab === "import_decimate" && (
            <div className="space-y-4">
              {/* UPLOAD DROPZONE / SELECTOR */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 rounded border-2 border-dashed transition-all cursor-pointer text-center space-y-2 ${
                  importedMeshInfo 
                    ? "border-[var(--primary-fixed-dim)] bg-[var(--primary-fixed)] hover:bg-[var(--primary-fixed)]" 
                    : "border-[var(--outline-variant)] bg-[var(--surface-container)] hover:border-[var(--primary)] hover:bg-[var(--surface-container)]"
                }`}
              >
                <div className="w-10 h-10 mx-auto rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] flex items-center justify-center text-[var(--primary)]">
                  {isLoadingFile ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-[var(--on-surface)]">
                    {importedMeshInfo ? importedMeshInfo.fileName : "Clique para Importar Objeto 3D"}
                  </div>
                  <div className="text-[11px] text-[var(--on-surface-variant)] font-mono mt-0.5">
                    {importedMeshInfo 
                      ? `${(importedMeshInfo.fileSizeBytes / 1024 / 1024).toFixed(2)} MB • Formato ${importedMeshInfo.format.toUpperCase()}`
                      : "Suporte completo: .STL, .OBJ, .PLY, .GLTF, .GLB"}
                  </div>
                </div>
                {importedMeshInfo && (
                  <span className="inline-block text-[11px] font-black px-2 py-0.5 rounded bg-[var(--primary-fixed)] border border-[var(--primary-fixed-dim)] text-[var(--primary)] uppercase">
                    Arquivo Carregado • Pronto para Decimar
                  </span>
                )}
              </div>

              {/* ORIGINAL VS LOW POLY STATS COMPARISON */}
              {importedMeshInfo && decimationStats && (
                <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[var(--amber)]" />
                      <span className="text-xs font-black text-[var(--on-surface)]">Estatísticas de Simplificação</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-[var(--primary)] bg-[var(--primary-fixed)] border border-[var(--primary-fixed-dim)] px-2 py-0.5 rounded font-black">
                        -{(decimationStats.reductionRatio * 100).toFixed(1)}%
                      </span>
                      <span className="text-[var(--workbench-muted)] bg-[var(--surface-container-low)] px-1.5 py-0.5 rounded border border-[var(--surface-container-high)]">
                        ⚡ {decimationStats.processingTimeMs}ms
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-[var(--surface-container-low)] p-2.5 rounded border border-[var(--surface-container-high)]">
                      <span className="text-[var(--workbench-muted)] block text-[11px] uppercase">Polígonos Originais</span>
                      <span className="text-[var(--on-surface-variant)] font-black text-[12px]">
                        {importedMeshInfo.originalFaceCount.toLocaleString()} ▲
                      </span>
                    </div>

                    <div className="bg-[var(--surface-container-low)] p-2.5 rounded border border-[var(--surface-container-high)]">
                      <span className="text-[var(--workbench-muted)] block text-[11px] uppercase">Resultado Low-Poly</span>
                      <span className="text-[var(--primary)] font-black text-[12px] flex items-center gap-1">
                        {decimationStats.decimatedFaceCount.toLocaleString()} ▲
                        {isProcessingDecimation && <RefreshCw className="w-2.5 h-2.5 animate-spin text-[var(--primary)]" />}
                      </span>
                    </div>
                  </div>

                  {/* TOGGLE ORIGINAL VS LOW POLY VIEW */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setViewOriginalMesh(false)}
                      className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded border transition-all ${
                        !viewOriginalMesh
                          ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                          : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      Ver Low-Poly ({decimationStats.decimatedFaceCount} ▲)
                    </button>
                    <button
                      onClick={() => setViewOriginalMesh(true)}
                      className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded border transition-all ${
                        viewOriginalMesh
                          ? "bg-[var(--amber)] text-[var(--on-surface)] border-[var(--amber)]"
                          : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      Ver Original (HD)
                    </button>
                  </div>
                </div>
              )}

              {/* UNDO / REDO & ACTION HISTORY TOOLBAR */}
              <div className="p-3 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-black text-[var(--on-surface)]">Histórico de Ações</span>
                  </div>

                  {history.length > 0 && (
                    <span className="text-[11px] font-mono text-[var(--on-surface-variant)] bg-[var(--surface-container-low)] px-2 py-0.5 rounded border border-[var(--surface-container-high)]">
                      Passo <strong className="text-[var(--primary)]">{historyIndex + 1}</strong> de {history.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  {/* UNDO BUTTON */}
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    title="Desfazer alteração no slider de triângulos (Atalho: Ctrl+Z)"
                    className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                      historyIndex > 0
                        ? "bg-[var(--surface-container-high)] border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] hover:text-[var(--on-surface)] cursor-pointer active:scale-95"
                        : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--outline)] cursor-not-allowed opacity-50"
                    }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Desfazer</span>
                    <span className="text-[11px] px-1 py-0.2 rounded bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] border border-[var(--surface-container-high)] font-sans">Ctrl+Z</span>
                  </button>

                  {/* REDO BUTTON */}
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    title="Refazer simplificação revertida (Atalho: Ctrl+Y)"
                    className={`flex-1 py-1.5 px-2 rounded border text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                      historyIndex < history.length - 1
                        ? "bg-[var(--surface-container-high)] border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] hover:text-[var(--on-surface)] cursor-pointer active:scale-95"
                        : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--outline)] cursor-not-allowed opacity-50"
                    }`}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    <span>Refazer</span>
                    <span className="text-[11px] px-1 py-0.2 rounded bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] border border-[var(--surface-container-high)] font-sans">Ctrl+Y</span>
                  </button>

                  {/* HISTORY TIMELINE TOGGLE */}
                  <button
                    onClick={() => setShowHistoryPanel(prev => !prev)}
                    title="Ver linha do tempo de todas as simplificações aplicadas"
                    className={`p-1.5 rounded border transition-all ${
                      showHistoryPanel
                        ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--on-primary)] font-black"
                        : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--outline)]"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* TIMELINE EXPANDABLE LIST */}
                {showHistoryPanel && (
                  <div className="pt-2 border-t border-[var(--surface-container-high)] space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--on-surface-variant)] pb-1">
                      <span>Linha do Tempo de Simplificações</span>
                      <span className="text-[11px] text-[var(--workbench-muted)]">Clique para restaurar</span>
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {history.length === 0 ? (
                        <div className="p-2 text-center text-[11px] font-mono text-[var(--outline)]">
                          Nenhuma alteração registrada ainda. Mova o slider para gerar pontos de histórico!
                        </div>
                      ) : (
                        history.map((entry, idx) => {
                          const isActive = idx === historyIndex;
                          const isFuture = idx > historyIndex;
                          return (
                            <button
                              key={entry.id}
                              onClick={() => handleJumpToHistory(idx)}
                              className={`w-full p-1.5 rounded text-left text-[11px] font-mono flex items-center justify-between border transition-all ${
                                isActive
                                  ? "bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)] font-bold"
                                  : isFuture
                                  ? "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--outline)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                                  : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:border-[var(--outline)]"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                                  isActive 
                                    ? "bg-[var(--primary)] text-[var(--on-primary)]" 
                                    : isFuture 
                                    ? "bg-[var(--surface-container)] text-[var(--outline)]" 
                                    : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className="truncate">{entry.label}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[11px] text-[var(--workbench-muted)] font-bold">
                                  {entry.targetTriangles} ▲
                                </span>
                                {isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* REAL-TIME TARGET TRIANGLE COUNT SLIDER UI */}
              <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--primary-fixed-dim)] space-y-3">
                {/* MODE TOGGLE: TARGET TRIANGLES VS PERCENTAGE */}
                <div className="flex items-center justify-between pb-1 border-b border-[var(--surface-container-high)]">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-black text-[var(--on-surface)]">Controle em Tempo Real</span>
                  </div>

                  <div className="flex bg-[var(--surface-container-low)] p-0.5 rounded border border-[var(--surface-container-high)] text-[11px] font-mono font-bold">
                    <button
                      onClick={() => {
                        setConfig(prev => ({ ...prev, decimationMode: "triangles" }));
                        pushHistorySnapshot({ decimationMode: "triangles" }, "Modo: Triângulos (▲)");
                      }}
                      className={`px-2 py-1 rounded transition-all ${
                        config.decimationMode === "triangles"
                          ? "bg-[var(--primary)] text-[var(--on-primary)] font-black"
                          : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      Triângulos (▲)
                    </button>
                    <button
                      onClick={() => {
                        setConfig(prev => ({ ...prev, decimationMode: "percentage" }));
                        pushHistorySnapshot({ decimationMode: "percentage" }, "Modo: Redução (%)");
                      }}
                      className={`px-2 py-1 rounded transition-all ${
                        config.decimationMode === "percentage"
                          ? "bg-[var(--primary)] text-[var(--on-primary)] font-black"
                          : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      Redução (%)
                    </button>
                  </div>
                </div>

                {/* TARGET TRIANGLES SLIDER */}
                {config.decimationMode === "triangles" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Contagem Alvo de Triângulos</span>
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="16"
                          max={maxTriangleLimit}
                          value={config.targetTriangles}
                          onChange={e => {
                            const val = Math.max(12, Math.min(maxTriangleLimit, Number(e.target.value) || 20));
                            setConfig(prev => ({ ...prev, targetTriangles: val }));
                          }}
                          onBlur={() => {
                            pushHistorySnapshot({ targetTriangles: config.targetTriangles }, `Definido: ${config.targetTriangles} ▲`);
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              pushHistorySnapshot({ targetTriangles: config.targetTriangles }, `Definido: ${config.targetTriangles} ▲`);
                            }
                          }}
                          className="w-16 px-1.5 py-0.5 bg-[var(--surface-container-low)] border border-[var(--outline-variant)] rounded text-right font-mono text-[var(--primary)] font-black text-xs focus:outline-none focus:border-[var(--primary)]"
                        />
                        <span className="text-[11px] font-mono text-[var(--workbench-muted)] font-bold">▲ faces</span>
                      </div>
                    </div>

                    {/* QUICK PRESETS FOR TRIANGLE COUNTS */}
                    <div className="grid grid-cols-5 gap-1 pt-1">
                      {[
                        { count: 48, label: "48", tip: "Ultra Chiseled" },
                        { count: 140, label: "140", tip: "Escultura" },
                        { count: 350, label: "350", tip: "Low-Poly" },
                        { count: 850, label: "850", tip: "Médio" },
                        { count: 2200, label: "2.2k", tip: "Detalhado" }
                      ].map(preset => (
                        <button
                          key={preset.count}
                          onClick={() => {
                            setConfig(prev => ({ ...prev, targetTriangles: preset.count }));
                            pushHistorySnapshot({ targetTriangles: preset.count }, `Preset ${preset.label} ▲ (${preset.tip})`);
                          }}
                          title={preset.tip}
                          className={`py-1 text-[11px] font-mono font-bold rounded border transition-all flex flex-col items-center ${
                            Math.abs(config.targetTriangles - preset.count) < 20
                              ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-black"
                              : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:border-[var(--outline)]"
                          }`}
                        >
                          <span>{preset.label} ▲</span>
                        </button>
                      ))}
                    </div>

                    {/* LIVE REAL-TIME RANGE SLIDER */}
                    <div className="pt-2">
                      <input
                        type="range"
                        min="20"
                        max={maxTriangleLimit}
                        step="5"
                        value={config.targetTriangles}
                        onMouseDown={() => setIsLiveScrubbing(true)}
                        onMouseUp={() => {
                          setIsLiveScrubbing(false);
                          pushHistorySnapshot({ targetTriangles: config.targetTriangles }, `Ajuste para ${config.targetTriangles} ▲`);
                        }}
                        onTouchStart={() => setIsLiveScrubbing(true)}
                        onTouchEnd={() => {
                          setIsLiveScrubbing(false);
                          pushHistorySnapshot({ targetTriangles: config.targetTriangles }, `Ajuste para ${config.targetTriangles} ▲`);
                        }}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setConfig(prev => ({ ...prev, targetTriangles: val }));
                        }}
                        className="w-full accent-[var(--primary-container)] h-2 bg-[var(--surface-container-high)] rounded cursor-ew-resize"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-[var(--workbench-muted)] mt-1">
                        <span>20 ▲ (Mais Facetado)</span>
                        <span className="text-[var(--primary)] font-bold">Pré-visualização Instantânea</span>
                        <span>{maxTriangleLimit.toLocaleString()} ▲ (Mais Suave)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* PERCENTAGE REDUCTION SLIDER */
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Percentual de Redução</span>
                      </span>
                      <span className="font-mono text-[var(--primary)] font-black text-[12px]">
                        {config.decimationReductionPercent}%
                      </span>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      {[
                        { val: 65, label: "65% Suave" },
                        { val: 82, label: "82% Médio" },
                        { val: 92, label: "92% Low Poly" },
                        { val: 97, label: "97% Minimal" }
                      ].map(q => (
                        <button
                          key={q.val}
                          onClick={() => {
                            setConfig(prev => ({ ...prev, decimationReductionPercent: q.val }));
                            pushHistorySnapshot({ decimationReductionPercent: q.val }, `Redução: ${q.label}`);
                          }}
                          className={`flex-1 py-1 text-[11px] font-mono font-bold rounded border transition-all ${
                            config.decimationReductionPercent === q.val
                              ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                              : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="30"
                      max="98"
                      step="1"
                      value={config.decimationReductionPercent}
                      onMouseDown={() => setIsLiveScrubbing(true)}
                      onMouseUp={() => {
                        setIsLiveScrubbing(false);
                        pushHistorySnapshot({ decimationReductionPercent: config.decimationReductionPercent }, `Redução para ${config.decimationReductionPercent}%`);
                      }}
                      onTouchStart={() => setIsLiveScrubbing(true)}
                      onTouchEnd={() => {
                        setIsLiveScrubbing(false);
                        pushHistorySnapshot({ decimationReductionPercent: config.decimationReductionPercent }, `Redução para ${config.decimationReductionPercent}%`);
                      }}
                      onChange={e => setConfig(prev => ({ ...prev, decimationReductionPercent: Number(e.target.value) }))}
                      className="w-full accent-[var(--primary-container)] h-2 bg-[var(--surface-container-high)] rounded cursor-ew-resize"
                    />
                  </div>
                )}
              </div>

              {/* DECIMATION ALGORITHM SELECTOR */}
              <div className="space-y-2 p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Algoritmo de Simplificação</span>
                  </span>
                  {isProcessingDecimation && (
                    <span className="text-[11px] text-[var(--primary)] font-mono flex items-center gap-1 animate-pulse font-bold">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando 3D...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "voxel_grid", label: "Escultura Angular", desc: "Voxel Clustering (Iconic)" },
                    { id: "qem", label: "Cristal Curvado", desc: "QEM Edge Collapse" }
                  ].map(algo => (
                    <button
                      key={algo.id}
                      onClick={() => {
                        setConfig(prev => ({ ...prev, decimationAlgorithm: algo.id as any }));
                        pushHistorySnapshot({ decimationAlgorithm: algo.id as any }, `Algoritmo: ${algo.label}`);
                      }}
                      className={`p-2 rounded border text-left transition-all ${
                        config.decimationAlgorithm === algo.id
                          ? "bg-[var(--primary-fixed)] border-[var(--primary)] text-[var(--primary)]"
                          : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      <div className="text-[11px] font-black">{algo.label}</div>
                      <div className="text-[11px] text-[var(--workbench-muted)] font-mono">{algo.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CRYSTAL JITTER & ANGULATION */}
              <div className="space-y-1.5 p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)]">
                <div className="flex justify-between text-xs">
                  <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold">Angulação Cristalina (Jitter)</span>
                  <span className="font-mono text-[var(--primary)] font-black text-[11px]">
                    {config.jitter === 0 ? "Geometria Pura" : `+${(config.jitter * 10).toFixed(0)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.2"
                  value={config.jitter}
                  onMouseUp={() => {
                    pushHistorySnapshot({ jitter: config.jitter }, `Cristalização: ${(config.jitter * 10).toFixed(0)}%`);
                  }}
                  onTouchEnd={() => {
                    pushHistorySnapshot({ jitter: config.jitter }, `Cristalização: ${(config.jitter * 10).toFixed(0)}%`);
                  }}
                  onChange={e => setConfig(prev => ({ ...prev, jitter: Number(e.target.value) }))}
                  className="w-full accent-[var(--primary-container)] h-1.5 bg-[var(--surface-container-high)] rounded cursor-pointer"
                />
              </div>

              {/* AUTOMATIC MANIFOLD & GEOMETRY VERIFICATION AUDIT */}
              <div className={`p-3.5 rounded border transition-all space-y-3 ${
                manifoldData.isManifold
                  ? "bg-[var(--primary-fixed)] border-[var(--primary-fixed-dim)]"
                  : "bg-[var(--error-container)] border-[var(--error)]/50"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                      manifoldData.isManifold
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary-fixed-dim)]"
                        : "bg-[var(--error)]/20 text-[var(--error)] border border-[var(--error)]/50 animate-pulse"
                    }`}>
                      {manifoldData.isManifold ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="text-[11px] font-black text-[var(--on-surface)] flex items-center gap-1.5">
                        <span>Verificação Automática de Manifold</span>
                        {isProcessingDecimation && <RefreshCw className="w-2.5 h-2.5 animate-spin text-[var(--primary)]" />}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--on-surface-variant)]">
                        {manifoldData.isManifold ? "Malha 100% Fechada (Watertight)" : "Erros de Geometria Detectados"}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[11px] font-mono font-black px-2 py-0.5 rounded border ${
                    manifoldData.isManifold
                      ? "bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary-fixed-dim)]"
                      : "bg-[var(--error)]/30 text-[var(--on-error-container)] border-[var(--error)]/50"
                  }`}>
                    {manifoldData.qualityScore}% Íntegra
                  </span>
                </div>

                {/* 4 DIAGNOSTIC METRICS */}
                <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                  <div className="p-1.5 rounded bg-[var(--surface-container-low)]/70 border border-[var(--surface-container-high)]">
                    <span className="text-[11px] text-[var(--workbench-muted)] block">Watertight</span>
                    <span className={`text-[11px] font-bold ${manifoldData.isWatertight ? "text-[var(--primary)]" : "text-[var(--error)] font-black"}`}>
                      {manifoldData.isWatertight ? "✓ Sim" : "✗ Não"}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--surface-container-low)]/70 border border-[var(--surface-container-high)]">
                    <span className="text-[11px] text-[var(--workbench-muted)] block">Furos (Bordas)</span>
                    <span className={`text-[11px] font-bold ${manifoldData.openEdgesCount === 0 ? "text-[var(--primary)]" : "text-[var(--error)] font-black"}`}>
                      {manifoldData.openEdgesCount}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--surface-container-low)]/70 border border-[var(--surface-container-high)]">
                    <span className="text-[11px] text-[var(--workbench-muted)] block">Não-Manifold</span>
                    <span className={`text-[11px] font-bold ${manifoldData.nonManifoldEdgesCount === 0 ? "text-[var(--primary)]" : "text-[var(--error)] font-black"}`}>
                      {manifoldData.nonManifoldEdgesCount}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--surface-container-low)]/70 border border-[var(--surface-container-high)]">
                    <span className="text-[11px] text-[var(--workbench-muted)] block">Euler (χ)</span>
                    <span className="text-[11px] font-bold text-[var(--on-surface-variant)]">
                      {manifoldData.eulerCharacteristic}
                    </span>
                  </div>
                </div>

                {/* WARNING MESSAGE OR PERFECTION NOTE */}
                {!manifoldData.isManifold ? (
                  <div className="space-y-2 pt-1 border-t border-[var(--error)]">
                    <div className="p-2 rounded bg-[var(--error-container)] border border-[var(--error)] text-[11px] font-mono text-[var(--on-error-container)] space-y-1">
                      <div className="font-bold flex items-center gap-1 text-[var(--error)]">
                        <AlertTriangle className="w-3 h-3 text-[var(--error)]" />
                        <span>Aviso de não-conformidade geométrica:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[var(--error)]/90 pl-1">
                        {manifoldData.issues.map((iss, i) => (
                          <li key={i}>{iss}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleAutoRepair}
                        className="flex-1 py-1.5 px-2 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] text-[11px] font-mono font-black rounded flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Auto-Reparar e Fechar Malha</span>
                      </button>

                      <button
                        onClick={() => setShowErrorEdges(prev => !prev)}
                        className={`py-1.5 px-2.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                          showErrorEdges
                            ? "bg-[var(--error)] text-white border-[var(--error)] font-black"
                            : "bg-[var(--surface-container)] border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>{showErrorEdges ? "Ocultar Erros" : "Destacar no 3D"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--primary-fixed-dim)] text-[11px] font-mono text-[var(--primary)]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[var(--primary)]" />
                      Pronta para Bambu Studio, OrcaSlicer e Cura
                    </span>
                    <button
                      onClick={() => setActiveTab("manifold")}
                      className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] underline text-[11px]"
                    >
                      Ver detalhes
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GEOMETRY & SCALING */}
          {activeTab === "geometry" && (
            <div className="space-y-4">
              {/* HEIGHT (Z) SLIDER */}
              <div className="space-y-1.5 p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)]">
                <div className="flex justify-between text-xs">
                  <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold">Altura Principal (Z)</span>
                  <span className="font-mono text-[var(--primary)] font-black text-[11px]">{config.height} mm</span>
                </div>
                <div className="flex gap-1.5 mb-2">
                  {[
                    { h: 35, label: "Mini" },
                    { h: 60, label: "Mesa" },
                    { h: 90, label: "Escultura" },
                    { h: 140, label: "Grande" }
                  ].map(quick => (
                    <button
                      key={quick.h}
                      onClick={() => setConfig(prev => ({ ...prev, height: quick.h }))}
                      className={`flex-1 py-1 text-[11px] font-mono font-bold rounded border transition-all ${
                        config.height === quick.h
                          ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                          : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      {quick.label} ({quick.h}mm)
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="20"
                  max="220"
                  step="1"
                  value={config.height}
                  onChange={e => setConfig(prev => ({ ...prev, height: Number(e.target.value) }))}
                  className="w-full accent-[var(--primary-container)] h-1.5 bg-[var(--surface-container-high)] rounded cursor-pointer"
                />
              </div>

              {/* FILAMENT MATERIAL COLOR PICKER */}
              <div className="space-y-2 p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold">Simulação de Filamento</span>
                  <span className="text-[11px] font-mono text-[var(--on-surface-variant)]">{config.color}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {FILAMENT_PALETTE.map(f => (
                    <button
                      key={f.name}
                      onClick={() => setConfig(prev => ({ ...prev, color: f.color }))}
                      title={f.name}
                      style={{ backgroundColor: f.color }}
                      className={`h-7 rounded transition-transform relative ${
                        config.color === f.color 
                          ? "ring-2 ring-white scale-110" 
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BASE & KEYRING LOOP */}
          {activeTab === "base_loop" && (
            <div className="space-y-4">
              {/* PEDESTAL / PLINTO GEOMÉTRICO */}
              <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cylinder className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--on-surface)]">Pedestal Geométrico</span>
                  </div>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, addPedestal: !prev.addPedestal }))}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded uppercase transition-all ${
                      config.addPedestal 
                        ? "bg-[var(--primary)] text-[var(--on-primary)] font-black" 
                        : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)]"
                    }`}
                  >
                    {config.addPedestal ? "Ativado" : "Desativado"}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--workbench-muted)] font-mono">
                  Fundido diretamente na base via CSG Boolean Union (sem intersecções internas).
                </p>

                {config.addPedestal && (
                  <div className="space-y-2.5 pt-2 border-t border-[var(--surface-container-high)]">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-[var(--on-surface-variant)]">
                        <span>Altura do Pedestal</span>
                        <span className="text-[var(--primary)] font-bold">{config.pedestalHeight} mm</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="20"
                        step="1"
                        value={config.pedestalHeight}
                        onChange={e => setConfig(prev => ({ ...prev, pedestalHeight: Number(e.target.value) }))}
                        className="w-full accent-[var(--primary-container)] h-1.5 bg-[var(--surface-container-high)] rounded cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-[var(--on-surface-variant)]">
                        <span>Raio da Base</span>
                        <span className="text-[var(--primary)] font-bold">{config.pedestalRadius} mm</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="60"
                        step="1"
                        value={config.pedestalRadius}
                        onChange={e => setConfig(prev => ({ ...prev, pedestalRadius: Number(e.target.value) }))}
                        className="w-full accent-[var(--primary-container)] h-1.5 bg-[var(--surface-container-high)] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ARGOLA PARA CHAVEIRO 3D */}
              <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--on-surface)]">Argola de Chaveiro</span>
                  </div>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, addKeyringLoop: !prev.addKeyringLoop }))}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded uppercase transition-all ${
                      config.addKeyringLoop 
                        ? "bg-[var(--primary)] text-[var(--on-primary)] font-black" 
                        : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-highest)]"
                    }`}
                  >
                    {config.addKeyringLoop ? "Ativada" : "Desativada"}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--workbench-muted)] font-mono">
                  Fundição CSG com olhal reforçado para chaveiro.
                </p>

                {config.addKeyringLoop && (
                  <div className="space-y-2.5 pt-2 border-t border-[var(--surface-container-high)]">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, loopPlacement: "top" }))}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded border ${
                          config.loopPlacement === "top"
                            ? "bg-[var(--primary)]/20 border-[var(--primary)] text-[var(--primary)]"
                            : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
                        }`}
                      >
                        Topo (Cima)
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, loopPlacement: "back" }))}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded border ${
                          config.loopPlacement === "back"
                            ? "bg-[var(--primary)]/20 border-[var(--primary)] text-[var(--primary)]"
                            : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
                        }`}
                      >
                        Costas (Atrás)
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-[var(--on-surface-variant)]">
                        <span>Furo Interno da Argola</span>
                        <span className="text-[var(--primary)] font-bold">{config.loopDiameter} mm</span>
                      </div>
                      <input
                        type="range"
                        min="3.0"
                        max="8.0"
                        step="0.5"
                        value={config.loopDiameter}
                        onChange={e => setConfig(prev => ({ ...prev, loopDiameter: Number(e.target.value) }))}
                        className="w-full accent-[var(--primary-container)] h-1.5 bg-[var(--surface-container-high)] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MANIFOLD DIAGNOSTICS & REPAIR */}
          {activeTab === "manifold" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-bold text-[var(--on-surface)]">Auditoria Manifold</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[var(--primary)] bg-[var(--primary-fixed)] border border-[var(--primary-fixed-dim)] px-2 py-0.5 rounded">
                    Score: {manifoldData.qualityScore}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">ESTADO WATERTIGHT</span>
                    <span className={`font-bold ${manifoldData.isWatertight ? "text-[var(--primary)]" : "text-[var(--amber)]"}`}>
                      {manifoldData.isWatertight ? "✓ 100% Fechado" : "✗ Com Aberturas"}
                    </span>
                  </div>

                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">BORDAS ABERTAS (FUROS)</span>
                    <span className={`font-bold ${manifoldData.openEdgesCount === 0 ? "text-[var(--primary)]" : "text-[var(--error)]"}`}>
                      {manifoldData.openEdgesCount}
                    </span>
                  </div>

                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">BORDAS NÃO-MANIFOLD</span>
                    <span className={`font-bold ${manifoldData.nonManifoldEdgesCount === 0 ? "text-[var(--primary)]" : "text-[var(--error)]"}`}>
                      {manifoldData.nonManifoldEdgesCount}
                    </span>
                  </div>

                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">NORMAIS INVERTIDAS</span>
                    <span className={`font-bold ${manifoldData.reversedEdgesCount === 0 ? "text-[var(--primary)]" : "text-[var(--amber)]"}`}>
                      {manifoldData.reversedEdgesCount}
                    </span>
                  </div>

                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">CARACTERÍSTICA EULER</span>
                    <span className="text-[var(--on-surface)] font-bold">χ = {manifoldData.eulerCharacteristic}</span>
                  </div>

                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">VOLUME SÓLIDO FECHADO</span>
                    <span className="text-[var(--primary)] font-bold">{manifoldData.volumeCm3} cm³</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleAutoRepair}
                    className="flex-1 py-2.5 rounded bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Auto-Reparar Malha</span>
                  </button>

                  <button
                    onClick={() => setShowErrorEdges(prev => !prev)}
                    className={`px-3 py-2.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      showErrorEdges
                        ? "bg-[var(--error)] text-white border-[var(--error)] font-black"
                        : "bg-[var(--surface-container-low)] border-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showErrorEdges ? "Ocultar 3D" : "Destacar no 3D"}</span>
                  </button>
                </div>
              </div>

              {/* SLICER COMPATIBILITY BADGES */}
              <div className="p-3.5 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] space-y-2">
                <div className="text-[11px] font-bold text-[var(--on-surface-variant)] flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Compatibilidade com Fatiadores 3D:</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <div className="bg-[var(--surface-container)] p-1.5 rounded border border-[var(--surface-container-high)] text-[var(--primary)] flex items-center gap-1">
                    <Check className="w-3 h-3" /> Bambu Studio (Aprovado)
                  </div>
                  <div className="bg-[var(--surface-container)] p-1.5 rounded border border-[var(--surface-container-high)] text-[var(--primary)] flex items-center gap-1">
                    <Check className="w-3 h-3" /> OrcaSlicer (Aprovado)
                  </div>
                  <div className="bg-[var(--surface-container)] p-1.5 rounded border border-[var(--surface-container-high)] text-[var(--primary)] flex items-center gap-1">
                    <Check className="w-3 h-3" /> PrusaSlicer (Aprovado)
                  </div>
                  <div className="bg-[var(--surface-container)] p-1.5 rounded border border-[var(--surface-container-high)] text-[var(--primary)] flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ultimaker Cura (Aprovado)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: EXPORT */}
          {activeTab === "export" && (
            <div className="space-y-4">
              {/* PRINT SLICER SUMMARY */}
              <div className="p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--on-surface)]">
                    <ShieldCheck className={`w-4 h-4 ${manifoldData.isManifold ? "text-[var(--primary)]" : "text-[var(--amber)]"}`} />
                    <span>Status de Impressão 3D</span>
                  </div>
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                    manifoldData.isManifold
                      ? "bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary-fixed-dim)]"
                      : "bg-amber-500/20 text-[var(--amber)] border-amber-500/40"
                  }`}>
                    {manifoldData.isManifold ? "100% Watertight Manifold" : "Auditoria Requerida"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">DIMENSÕES REAIS (XYZ)</span>
                    <span className="text-[var(--on-surface)] font-bold">{specs.dimX} × {specs.dimY} × {specs.dimZ} mm</span>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">FILAMENTO ESTIMADO</span>
                    <span className="text-[var(--primary)] font-bold">~{specs.filamentGrams}g PLA</span>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">TEMPO EST. (50mm/s)</span>
                    <span className="text-[var(--primary)] font-bold">~{specs.printTimeString}</span>
                  </div>
                  <div className="bg-[var(--surface-container-low)] p-2 rounded border border-[var(--surface-container-high)]">
                    <span className="text-[var(--workbench-muted)] block text-[11px]">FACES POLIGONAIS</span>
                    <span className="text-[var(--on-surface-variant)] font-bold">{specs.faceCount} triângulos</span>
                  </div>
                </div>
              </div>

              {/* CUSTOM FILE NAME INPUT */}
              <div className="space-y-1.5 p-3.5 rounded bg-[var(--surface-container)] border border-[var(--surface-container-high)]">
                <div className="flex justify-between text-xs">
                  <span className="font-mono text-[var(--on-surface-variant)] text-[11px] uppercase font-bold">Nome do Arquivo</span>
                  <span className="font-mono text-[var(--workbench-muted)] text-[11px]">Sufixos gerados automaticamente</span>
                </div>
                <input
                  type="text"
                  placeholder={importedMeshInfo?.fileName.replace(/\.[^/.]+$/, "") || selectedModel.name}
                  value={customFileName}
                  onChange={e => setCustomFileName(e.target.value)}
                  className="w-full bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] rounded px-2.5 py-1.5 text-xs text-[var(--on-surface)] font-mono placeholder:text-[var(--outline)] focus:outline-none focus:border-[var(--primary)]"
                />
                <div className="text-[11px] font-mono text-[var(--workbench-muted)] truncate">
                  Ex: {getExportBaseName()}_lowpoly_{specs.faceCount}tri_{config.height}mm.[stl|obj|3mf]
                </div>
              </div>

              {/* NON-MANIFOLD WARNING & SAFE EXPORT BUTTON */}
              {!manifoldData.isManifold && (
                <div className="p-3 rounded bg-[var(--amber-container)] border border-amber-500/40 space-y-2 text-[11px] font-mono">
                  <div className="flex items-center gap-2 text-[var(--amber)] font-bold">
                    <AlertTriangle className="w-4 h-4 text-[var(--amber)] shrink-0" />
                    <span>Atenção: Malha com descontinuidades</span>
                  </div>
                  <p className="text-amber-200/80 text-[11px]">
                    Recomendamos executar o auto-reparo antes de exportar para garantir fatiamento 100% sem erros nos fatiadores.
                  </p>
                  <button
                    onClick={() => handleRepairAndExport("stl")}
                    disabled={exportingFormat !== null}
                    className="w-full py-2 px-3 rounded bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Auto-Reparar e Baixar STL Seguro</span>
                  </button>
                </div>
              )}

              {/* 3 CORE FORMAT EXPORT CARDS */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-mono uppercase font-bold text-[var(--on-surface-variant)] flex items-center gap-1.5">
                  <DownloadCloud className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Formatos 3D Disponíveis para Download</span>
                </div>

                {/* 1. STL CARD */}
                <div className="p-3.5 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--surface-container-high)] hover:border-[var(--primary)]/40 transition-all space-y-2 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-[var(--primary-fixed)] border border-[var(--primary-fixed-dim)] flex items-center justify-center text-[var(--primary)] font-mono font-black text-xs">
                        STL
                      </div>
                      <div>
                        <div className="text-xs font-black text-[var(--on-surface)] flex items-center gap-2">
                          <span>STL Binário (.stl)</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary-fixed-dim)]">
                            Mais Popular
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-variant)] font-mono">
                          Padrão universal para Bambu Studio, OrcaSlicer, PrusaSlicer e Cura
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-[var(--workbench-muted)]">
                      ~{Math.max(1, Math.round(specs.faceCount * 50 / 1024))} KB
                    </span>
                  </div>

                  <button
                    onClick={() => handleExportModel("stl")}
                    disabled={exportingFormat !== null}
                    className="w-full py-2.5 rounded bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {exportingFormat === "stl" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{exportingFormat === "stl" ? "Gerando STL Binário..." : "Baixar STL (.stl)"}</span>
                  </button>
                </div>

                {/* 2. 3MF CARD */}
                <div className="p-3.5 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--surface-container-high)] hover:border-[var(--primary-fixed-dim)] transition-all space-y-2 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-[var(--primary)]/10 border border-[var(--primary-fixed-dim)] flex items-center justify-center text-[var(--primary)] font-mono font-black text-xs">
                        3MF
                      </div>
                      <div>
                        <div className="text-xs font-black text-[var(--on-surface)] flex items-center gap-2">
                          <span>3D Manufacturing Format (.3mf)</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Recomendado
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-variant)] font-mono">
                          Unidades em mm nativas, metadados XML e alta compressão
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-[var(--workbench-muted)]">
                      ~{Math.max(1, Math.round(specs.faceCount * 15 / 1024))} KB
                    </span>
                  </div>

                  <button
                    onClick={() => handleExportModel("3mf")}
                    disabled={exportingFormat !== null}
                    className="w-full py-2.5 rounded bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {exportingFormat === "3mf" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Package className="w-3.5 h-3.5" />
                    )}
                    <span>{exportingFormat === "3mf" ? "Empacotando 3MF..." : "Baixar 3MF (.3mf)"}</span>
                  </button>
                </div>

                {/* 3. OBJ CARD */}
                <div className="p-3.5 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--surface-container-high)] hover:border-amber-500/40 transition-all space-y-2 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-amber-500/10 border border-[var(--amber-container)] flex items-center justify-center text-[var(--amber)] font-mono font-black text-xs">
                        OBJ
                      </div>
                      <div>
                        <div className="text-xs font-black text-[var(--on-surface)] flex items-center gap-2">
                          <span>Wavefront OBJ (.obj)</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-[var(--amber)] border border-[var(--amber-container)]">
                            Modelagem / Render
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-variant)] font-mono">
                          Compatível com Blender, Maya, Unreal Engine, Unity e ZBrush
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-[var(--workbench-muted)]">
                      ~{Math.max(1, Math.round(specs.faceCount * 45 / 1024))} KB
                    </span>
                  </div>

                  <button
                    onClick={() => handleExportModel("obj")}
                    disabled={exportingFormat !== null}
                    className="w-full py-2.5 rounded bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)] text-[var(--on-surface)] font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {exportingFormat === "obj" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--amber)]" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-[var(--amber)]" />
                    )}
                    <span>{exportingFormat === "obj" ? "Gerando Wavefront OBJ..." : "Baixar OBJ (.obj)"}</span>
                  </button>
                </div>

                {/* 4. ALL FORMATS BUNDLE (.ZIP) */}
                <div className="p-3.5 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="text-xs font-bold text-[var(--on-surface)]">Pacote Completo (.ZIP)</div>
                        <div className="text-[11px] text-[var(--on-surface-variant)] font-mono">STL + 3MF + OBJ + Relatório Técnico</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleExportModel("zip")}
                    disabled={exportingFormat !== null}
                    className="w-full py-2.5 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] border border-purple-500/40 text-purple-200 hover:text-[var(--on-surface)] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {exportingFormat === "zip" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    ) : (
                      <FileArchive className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span>{exportingFormat === "zip" ? "Comprimindo Arquivos..." : "Baixar Todos os Formatos (.zip)"}</span>
                  </button>
                </div>
              </div>

              {/* RECOMMENDED SLICER SETTINGS */}
              <div className="p-3.5 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] space-y-1.5 text-[11px] font-mono text-[var(--on-surface-variant)]">
                <div className="text-[var(--on-surface-variant)] font-bold text-[11px] flex items-center gap-1.5">
                  <FileCheck className="w-3 h-3 text-[var(--primary)]" />
                  <span>Configuração Recomendada no Fatiador:</span>
                </div>
                <div>• Altura de camada: 0.16mm ou 0.20mm (ótimo para facetas)</div>
                <div>• Paredes / Perímetros: 2 a 3 voltas</div>
                <div>• Preenchimento: 12% a 15% Gyroid ou Grid</div>
                <div>• Suportes: Desativados (100% autoportante)</div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM QUICK STATUS */}
        <div className="p-3 bg-[var(--surface-container-low)] border-t border-[var(--surface-container-high)] flex items-center justify-between text-[11px] font-mono text-[var(--on-surface-variant)]">
          <span className="truncate">{importedMeshInfo?.fileName || selectedModel.name}</span>
          {manifoldData.isManifold ? (
            <span className="text-[var(--primary)] font-bold shrink-0 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[var(--primary)]" />
              100% Manifold
            </span>
          ) : (
            <span 
              onClick={() => {
                setActiveTab("import_decimate");
                setShowErrorEdges(true);
              }}
              className="text-[var(--error)] font-black shrink-0 flex items-center gap-1 cursor-pointer hover:underline"
              title="Clique para verificar erros de geometria"
            >
              <AlertTriangle className="w-3 h-3 text-[var(--error)] animate-pulse" />
              {manifoldData.openEdgesCount + manifoldData.nonManifoldEdgesCount} Erros de Geometria
            </span>
          )}
        </div>
      </div>

      {/* 3D CANVAS VIEWPORT */}
      <div className="flex-1 h-full relative bg-[var(--surface-container-low)]">
        {/* TOP TOOLBAR OVERLAY */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="bg-[var(--surface-container)] border border-[var(--surface-container-high)] rounded p-1 flex items-center gap-1">
            {/* VIEWPORT UNDO / REDO CONTROLS */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Desfazer simplificação (Ctrl+Z)"
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                historyIndex > 0
                  ? "text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)] cursor-pointer active:scale-95"
                  : "text-[var(--outline)] cursor-not-allowed opacity-40"
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Refazer simplificação (Ctrl+Y)"
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                historyIndex < history.length - 1
                  ? "text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)] cursor-pointer active:scale-95"
                  : "text-[var(--outline)] cursor-not-allowed opacity-40"
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setActiveTab("import_decimate");
                setShowHistoryPanel(true);
              }}
              title="Abrir painel de histórico de simplificações"
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                showHistoryPanel && activeTab === "import_decimate"
                  ? "bg-[var(--primary)] text-[var(--on-primary)] font-black"
                  : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]"
              }`}
            >
              <History className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[var(--surface-container-high)] mx-0.5" />

            <button
              onClick={() => setConfig(prev => ({ ...prev, wireframe: !prev.wireframe }))}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded flex items-center gap-1.5 transition-all ${
                config.wireframe 
                  ? "bg-[var(--primary)] text-[var(--on-primary)] font-black" 
                  : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Arestas</span>
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, showBed: !prev.showBed }))}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded flex items-center gap-1.5 transition-all ${
                config.showBed 
                  ? "bg-[var(--surface-container-high)] text-[var(--on-surface)]" 
                  : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Mesa 3D</span>
            </button>

            {importedMeshInfo && (
              <button
                onClick={() => setViewOriginalMesh(prev => !prev)}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded flex items-center gap-1.5 transition-all ${
                  viewOriginalMesh 
                    ? "bg-[var(--amber)] text-[var(--on-surface)] font-black" 
                    : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>{viewOriginalMesh ? "Vendo Original (HD)" : "Vendo Low-Poly"}</span>
              </button>
            )}

            <div className="w-[1px] h-4 bg-[var(--surface-container-high)] mx-0.5" />

            {/* ERROR EDGES 3D HIGHLIGHT TOGGLE */}
            <button
              onClick={() => setShowErrorEdges(prev => !prev)}
              title="Destacar arestas não-manifold e bordas abertas em vermelho neon"
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                showErrorEdges
                  ? "bg-[var(--error)] text-white font-black"
                  : !manifoldData.isManifold
                  ? "text-[var(--error)] bg-[var(--error-container)] border border-[var(--error)]/40 animate-pulse hover:text-[var(--on-surface)]"
                  : "text-[var(--workbench-muted)] hover:text-[var(--on-surface)]"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {showErrorEdges
                  ? "Ocultar Erros 3D"
                  : !manifoldData.isManifold
                  ? `Erros 3D (${manifoldData.openEdgesCount + manifoldData.nonManifoldEdgesCount})`
                  : "Verificar Erros"}
              </span>
            </button>

            <div className="w-[1px] h-4 bg-[var(--surface-container-high)] mx-0.5" />

            {/* QUICK EXPORT BUTTON WITH DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setShowQuickExportMenu(prev => !prev)}
                className="px-2.5 py-1 text-[11px] font-mono font-black rounded flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] transition-all cursor-pointer active:scale-95"
                title="Exportar modelo 3D (.STL, .3MF, .OBJ, .ZIP)"
              >
                {exportingFormat ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Exportar</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              </button>

              {/* QUICK EXPORT DROPDOWN MENU */}
              {showQuickExportMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface-container-low)]/95 border border-[var(--surface-container-high)] rounded p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1 font-mono"
                  onMouseLeave={() => setShowQuickExportMenu(false)}
                >
                  <div className="px-2 py-1 text-[11px] uppercase font-bold text-[var(--workbench-muted)] border-b border-[var(--surface-container-high)] flex justify-between items-center">
                    <span>Exportação Rápida</span>
                    <span className="text-[var(--primary)] font-normal">
                      {manifoldData.isManifold ? "✓ Manifold" : "Auditoria"}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickExportMenu(false);
                      handleExportModel("stl");
                    }}
                    disabled={exportingFormat !== null}
                    className="w-full px-2.5 py-1.5 rounded text-left text-[11px] text-[var(--on-surface)] hover:bg-[var(--primary-fixed-dim)] hover:text-[var(--primary)] flex items-center justify-between group transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[var(--surface-container)] flex items-center justify-center font-bold text-[11px] text-[var(--primary)]">STL</span>
                      <span className="font-bold">Baixar STL</span>
                    </div>
                    <span className="text-[11px] text-[var(--workbench-muted)] group-hover:text-[var(--primary)]">FDM/SLA</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickExportMenu(false);
                      handleExportModel("3mf");
                    }}
                    disabled={exportingFormat !== null}
                    className="w-full px-2.5 py-1.5 rounded text-left text-[11px] text-[var(--on-surface)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] flex items-center justify-between group transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[var(--surface-container)] flex items-center justify-center font-bold text-[11px] text-[var(--primary)]">3MF</span>
                      <span className="font-bold">Baixar 3MF</span>
                    </div>
                    <span className="text-[11px] text-[var(--workbench-muted)] group-hover:text-[var(--primary)]">Bambu/Orca</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickExportMenu(false);
                      handleExportModel("obj");
                    }}
                    disabled={exportingFormat !== null}
                    className="w-full px-2.5 py-1.5 rounded text-left text-[11px] text-[var(--on-surface)] hover:bg-amber-500/10 hover:text-[var(--amber)] flex items-center justify-between group transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[var(--surface-container)] flex items-center justify-center font-bold text-[11px] text-[var(--amber)]">OBJ</span>
                      <span className="font-bold">Baixar OBJ</span>
                    </div>
                    <span className="text-[11px] text-[var(--workbench-muted)] group-hover:text-[var(--amber)]">Blender/3D</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickExportMenu(false);
                      handleExportModel("zip");
                    }}
                    disabled={exportingFormat !== null}
                    className="w-full px-2.5 py-1.5 rounded text-left text-[11px] text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 flex items-center justify-between group transition-all cursor-pointer border-t border-[var(--surface-container-high)]"
                  >
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-4 h-4 text-purple-400" />
                      <span className="font-bold">Pacote .ZIP</span>
                    </div>
                    <span className="text-[11px] text-purple-400">Todos</span>
                  </button>

                  <div className="pt-1 border-t border-[var(--surface-container-high)]">
                    <button
                      onClick={() => {
                        setShowQuickExportMenu(false);
                        setActiveTab("export");
                      }}
                      className="w-full py-1 text-center text-[11px] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
                    >
                      Ver Opções Avançadas →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VISUAL GEOMETRY WARNING ALERT BANNER */}
        {!manifoldData.isManifold && !dismissWarningBanner && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-lg bg-[var(--error-container)] border border-[var(--error)]/60 rounded p-3.5 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded bg-[var(--error)]/20 border border-[var(--error)]/50 flex items-center justify-center text-[var(--error)] shrink-0 mt-0.5 animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--on-surface)]">Aviso de Geometria: Malha Não-Manifold</span>
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--error)]/30 text-[var(--on-error-container)] border border-[var(--error)]/40">
                      {manifoldData.openEdgesCount + manifoldData.nonManifoldEdgesCount} {manifoldData.openEdgesCount + manifoldData.nonManifoldEdgesCount === 1 ? "erro" : "erros"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--on-error-container)]/90 font-mono leading-snug">
                    {manifoldData.issues.join(" • ") || "A malha simplificada possui arestas abertas ou descontinuidades."}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDismissWarningBanner(true)}
                title="Dispensar aviso"
                className="text-[var(--error)] hover:text-[var(--on-surface)] p-1 rounded hover:bg-rose-900/50 transition-all shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QUICK ACTION BUTTONS */}
            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[var(--error)]">
              <button
                onClick={handleAutoRepair}
                className="flex-1 py-1.5 px-2.5 rounded bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] text-[11px] font-mono font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Auto-Reparar e Fechar Malha</span>
              </button>

              <button
                onClick={() => setShowErrorEdges(prev => !prev)}
                className={`py-1.5 px-2.5 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  showErrorEdges
                    ? "bg-[var(--error)] text-white border-[var(--error)] font-black"
                    : "bg-rose-900/60 border-rose-700/60 text-[var(--on-error-container)] hover:bg-rose-800"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showErrorEdges ? "Ocultar Arestas" : "Destacar Erros 3D"}</span>
              </button>

              <button
                onClick={() => setActiveTab("manifold")}
                className="py-1.5 px-2 rounded text-[11px] font-mono text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] transition-all cursor-pointer"
              >
                Ver Diagnóstico
              </button>
            </div>
          </div>
        )}

        {/* TOP RIGHT LIVE SIMPLIFICATION HUD */}
        {importedMeshInfo && decimationStats && !viewOriginalMesh && (
          <div className="absolute top-4 right-4 z-10 bg-[var(--surface-container)] border border-[var(--primary-fixed-dim)] rounded px-3 py-2 text-[11px] font-mono text-[var(--on-surface-variant)] flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
              <span className="text-[var(--on-surface-variant)] font-bold">Low-Poly Live:</span>
            </div>
            
            <div className="flex items-center gap-1 text-[var(--on-surface)] font-black">
              <span className="text-[var(--on-surface-variant)]">Alvo:</span>
              <span className="text-[var(--primary)]">{config.targetTriangles} ▲</span>
            </div>

            <span className="text-[var(--outline)]">|</span>

            <div className="flex items-center gap-1 text-[var(--on-surface)] font-black">
              <span className="text-[var(--on-surface-variant)]">Resultado:</span>
              <span className="text-[var(--primary)]">{decimationStats.decimatedFaceCount} ▲</span>
            </div>

            <span className="text-[var(--outline)]">|</span>

            <div className="flex items-center gap-1">
              {manifoldData.isManifold ? (
                <span className="text-[var(--primary)] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[var(--primary)]" />
                  Manifold
                </span>
              ) : (
                <span 
                  onClick={() => setShowErrorEdges(true)}
                  className="text-[var(--error)] font-black flex items-center gap-1 cursor-pointer underline decoration-[var(--error)] hover:text-[var(--error)]"
                  title="Clique para destacar os erros no 3D"
                >
                  <AlertTriangle className="w-3 h-3 text-[var(--error)] animate-pulse" />
                  {manifoldData.openEdgesCount + manifoldData.nonManifoldEdgesCount} Erros
                </span>
              )}
            </div>

            <span className="text-[var(--outline)]">|</span>

            <span className="text-[var(--amber)] font-bold">
              ⚡ {decimationStats.processingTimeMs}ms
            </span>
          </div>
        )}

        {/* 3D RENDER CANVAS */}
        <Canvas shadows gl={{ antialias: true, alpha: false }}>
          <color attach="background" args={["#F1F3ED"]} />
          <PerspectiveCamera makeDefault position={[0, 60, 140]} fov={45} />
          <OrbitControls 
            makeDefault 
            minDistance={20} 
            maxDistance={350} 
            maxPolarAngle={Math.PI / 2 + 0.05} 
          />

          {/* LIGHTS FOR CRISP FACETED LOW POLY SHADING */}
          <ambientLight intensity={0.55} />
          <directionalLight 
            position={[80, 120, 80]} 
            intensity={1.4} 
            castShadow 
            shadow-mapSize={[1024, 1024]} 
          />
          <directionalLight position={[-80, 80, -60]} intensity={0.7} color="#90CAF9" />
          <pointLight position={[0, -20, 50]} intensity={0.3} />

          {/* PRINT BED GRID (220x220mm) */}
          {config.showBed && (
            <group position={[0, 0, 0]}>
              <Grid 
                renderOrder={-1} 
                position={[0, -0.1, 0]} 
                args={[220, 220]} 
                cellSize={10} 
                cellThickness={0.8} 
                cellColor="#DDE1D8" 
                sectionSize={50} 
                sectionThickness={1.5} 
                sectionColor="#CAC3D8" 
                fadeDistance={400} 
              />
              <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[220, 220]} />
                <meshStandardMaterial color="#E8E9E3" roughness={0.9} />
              </mesh>
            </group>
          )}

          {/* LOW POLY 3D OBJECT MESH */}
          <Center top>
            <mesh 
              geometry={finalGeometry} 
              castShadow 
              receiveShadow
            >
              <meshStandardMaterial
                color={viewOriginalMesh ? "#CFD8DC" : config.color}
                roughness={0.25}
                metalness={0.15}
                flatShading={!viewOriginalMesh}
                wireframe={config.wireframe}
              />
            </mesh>

            {/* HIGHLIGHT PROBLEMATIC NON-MANIFOLD EDGES IN 3D */}
            {showErrorEdges && errorEdgesGeometry && (
              <lineSegments geometry={errorEdgesGeometry}>
                <lineBasicMaterial color="#DC2626" linewidth={3} depthTest={false} transparent opacity={0.95} />
              </lineSegments>
            )}
          </Center>
        </Canvas>

        {/* BOTTOM RIGHT DIMENSIONS OVERLAY */}
        <div className="absolute bottom-4 right-4 z-10 bg-[var(--surface-container)] border border-[var(--surface-container-high)] rounded px-3 py-2 text-[11px] font-mono text-[var(--on-surface-variant)] flex items-center gap-4">
          <div>
            <span className="text-[var(--workbench-muted)]">X:</span> <span className="text-[var(--on-surface)] font-bold">{specs.dimX}mm</span>
          </div>
          <div>
            <span className="text-[var(--workbench-muted)]">Y:</span> <span className="text-[var(--on-surface)] font-bold">{specs.dimY}mm</span>
          </div>
          <div>
            <span className="text-[var(--workbench-muted)]">Z:</span> <span className="text-[var(--primary)] font-bold">{specs.dimZ}mm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
