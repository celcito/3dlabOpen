import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  Sparkles, Download, Upload, Check, Info, Save, Trash2, Folder,
  Eye, EyeOff, FileText
} from "lucide-react";
import { useDesignEditor } from "../hooks/cookie/useDesignEditor";
import { DesignElement, createPathElement, ElementRole, migrateLegacy } from "../lib/cookie-cutter/designElements";
import { PrimitiveShape } from "../lib/cookie-cutter/primitives";
import { BooleanOp } from "../lib/cookie-cutter/booleanOps";
import { DesignViewport } from "../components/cookie-cutter/DesignViewport";
import { Toolbar } from "../components/cookie-cutter/Toolbar";
import { LayersPanel } from "../components/cookie-cutter/LayersPanel";
import { PropertiesPanel } from "../components/cookie-cutter/PropertiesPanel";
import { ShapePalette } from "../components/cookie-cutter/ShapePalette";

interface MakerConfig {
  size: number;
  cutterHeight: number;
  wallThickness: number;
  brimWidth: number;
  brimHeight: number;
  stampPlateThickness: number;
  clearance: number;
  detailHeight: number;
  detailThickness: number;
  addHandle: boolean;
  handleHeight: number;
  detailScale: number;
  coloringBaseThickness: number;
  coloringLineHeight: number;
  coloringLineWidth: number;
  materialColor: string;
  viewMode: "cutter_stamp" | "cutter_only" | "stamp_only" | "coloring_plate";
  explodedView: number;
  showWireframe: boolean;
}

interface SavedProject {
  id: string;
  name: string;
  savedAt: string;
  elements: DesignElement[];
  config: MakerConfig;
}

interface CookiePreset {
  id: string;
  name: string;
  icon: string;
  svg: string;
}

const defaultConfig: MakerConfig = {
  size: 75, cutterHeight: 14, wallThickness: 0.8, brimWidth: 4, brimHeight: 2,
  stampPlateThickness: 2, clearance: 1.2, detailHeight: 1.5, detailThickness: 1.2,
  addHandle: true, handleHeight: 10, detailScale: 1.0, coloringBaseThickness: 3, coloringLineHeight: 1.6,
  coloringLineWidth: 1.2, materialColor: "#e0e0e0", viewMode: "cutter_stamp",
  explodedView: 0.25, showWireframe: false,
};

function parseSVGToDesignElements(svgText: string): DesignElement[] {
  const elements: DesignElement[] = [];
  try {
    const svgData = new SVGLoader().parse(svgText);
    if (!svgData?.paths?.length) return elements;

    svgData.paths.forEach((pathObj, pathIdx) => {
      const node = pathObj.userData?.node as any;
      const nodeId = node ? (node.getAttribute("id") || node.getAttribute("class") || `path-${pathIdx}`) : `path-${pathIdx}`;
      pathObj.subPaths.forEach((subPath, subIdx) => {
        const points = subPath.getPoints(45);
        if (points.length < 2) return;
        let d = `M ${points[0].x} ${points[0].y} `;
        for (let i = 1; i < points.length; i++) {
          d += `L ${points[i].x} ${points[i].y} `;
        }
        if (points[0].distanceTo(points[points.length - 1]) < 0.1) d += "Z";
        const element = createPathElement(d, `${nodeId.toUpperCase()} (${subIdx + 1})`);
        elements.push(element);
      });
    });

    if (elements.length > 0) {
      let largestIdx = 0;
      let maxArea = -1;
      elements.forEach((el, index) => {
        if (el.type === "path") {
          const coords = el.pathData.match(/[-+]?\d*\.?\d+/g)?.map(Number) || [];
          if (coords.length >= 4) {
            let minX = coords[0], maxX = coords[0], minY = coords[1], maxY = coords[1];
            for (let i = 2; i < coords.length; i += 2) {
              minX = Math.min(minX, coords[i]);
              maxX = Math.max(maxX, coords[i]);
              minY = Math.min(minY, coords[i + 1]);
              maxY = Math.max(maxY, coords[i + 1]);
            }
            const area = (maxX - minX) * (maxY - minY);
            if (area > maxArea) { maxArea = area; largestIdx = index; }
          }
        }
      });
      elements[largestIdx].role = "cutter";
    }
  } catch (error) {
    console.error(error);
  }
  return elements;
}

function exportElementsToSVG(elements: DesignElement[], config: MakerConfig): string {
  const size = config.size;
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-size/2} ${-size/2} ${size} ${size}" width="${size}" height="${size}">\n`;

  const cutterElements = elements.filter(e => e.visible && e.role === "cutter");
  const stampElements = elements.filter(e => e.visible && e.role === "stamp");

  if (cutterElements.length > 0) {
    svg += `  <g id="cutter" fill="none" stroke="#ff5722" stroke-width="0.5">\n`;
    for (const el of cutterElements) {
      if (el.type === "path" && el.pathData) {
        const transform = buildTransformAttr(el.transform);
        svg += `    <path d="${el.pathData}"${transform ? ` transform="${transform}"` : ""} />\n`;
      }
    }
    svg += `  </g>\n`;
  }

  if (stampElements.length > 0) {
    svg += `  <g id="stamp" fill="none" stroke="#632CE5" stroke-width="0.3">\n`;
    for (const el of stampElements) {
      if (el.type === "path" && el.pathData) {
        const transform = buildTransformAttr(el.transform);
        svg += `    <path d="${el.pathData}"${transform ? ` transform="${transform}"` : ""} />\n`;
      }
    }
    svg += `  </g>\n`;
  }

  svg += `</svg>`;
  return svg;
}

function buildTransformAttr(t: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }): string {
  const parts: string[] = [];
  if (t.x !== 0 || t.y !== 0) parts.push(`translate(${t.x} ${t.y})`);
  if (t.rotation !== 0) parts.push(`rotate(${t.rotation * 180 / Math.PI})`);
  if (t.scaleX !== 1 || t.scaleY !== 1) parts.push(`scale(${t.scaleX} ${t.scaleY})`);
  return parts.join(" ");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const PRESETS: CookiePreset[] = [
  {
    id: "duck", name: "Patinho", icon: "🦆",
    svg: `<svg viewBox="0 0 100 100"><path id="outline" d="M 50 15 C 32 15 22 25 22 40 C 22 45 25 50 28 54 C 18 57 12 65 12 75 C 12 85 22 90 35 90 L 70 90 C 82 90 88 82 88 72 C 88 60 78 52 70 50 C 74 42 74 33 68 25 C 62 18 56 15 50 15 Z" /><path id="details_eye" d="M 44 32 A 3 3 0 1 1 44 31.9 Z" /><path id="details_beak" d="M 24 40 C 18 40 14 44 16 48 C 19 50 24 47 24 44" /><path id="details_wing" d="M 52 58 C 43 58 38 64 40 72 C 43 78 55 80 64 74 C 70 68 66 58 52 58 Z" /></svg>`
  },
  {
    id: "astronaut", name: "Astronauta", icon: "🧑‍🚀",
    svg: `<svg viewBox="0 0 100 100"><path id="outline" d="M 50 10 C 65 10 75 20 75 35 C 75 42 71 48 65 52 L 70 78 L 57 78 L 57 90 L 43 90 L 43 78 L 30 78 L 35 52 C 29 48 25 42 25 35 C 25 20 35 10 50 10 Z" /><path id="details_visor" d="M 50 18 C 62 18 66 22 66 29 C 66 36 62 40 50 40 C 38 40 34 36 34 29 C 34 22 38 18 50 18 Z" /></svg>`
  },
  {
    id: "rocket", name: "Foguete", icon: "🚀",
    svg: `<svg viewBox="0 0 100 100"><path id="outline" d="M 50 10 C 60 25 65 40 65 65 L 75 80 L 65 80 L 65 85 C 65 88 62 90 58 90 L 42 90 C 38 90 35 88 35 85 L 35 80 L 25 80 L 35 65 C 35 40 40 25 50 10 Z" /><path id="details_window" d="M 50 35 A 8 8 0 1 1 50 34.9 Z" /></svg>`
  },
  {
    id: "heart", name: "Coração", icon: "❤️",
    svg: `<svg viewBox="0 0 100 100"><path id="outline" d="M 50 25 C 50 25 42 12 28 12 C 15 12 8 22 8 36 C 8 52 25 68 50 88 C 75 68 92 52 92 36 C 92 22 85 12 72 12 C 58 12 50 25 50 25 Z" /></svg>`
  },
  {
    id: "circle", name: "Círculo", icon: "⭕",
    svg: `<svg viewBox="0 0 100 100"><path id="outline" d="M 50 10 A 40 40 0 1 1 49.99 10 Z" /></svg>`
  }
];

export default function CookieCutterDesignEditor() {
  const editor = useDesignEditor();
  const {
    elements, selectedIds, setSelectedIds, canUndo, canRedo,
    undo, redo, addPath, addPrimitive, addText, addGroup, ungroup,
    deleteSelected, duplicateSelected, copySelected, cutSelected, paste,
    updateTransform, commitTransform, updateTextData, updatePrimitiveData,
    updateRole, updateVisibility, updateLock, reorder, alignElements,
    booleanOp, setElementsDirect,
  } = editor;

  const [projectName, setProjectName] = useState("MEU CORTADOR");
  const [config, setConfig] = useState<MakerConfig>(defaultConfig);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [snapGrid, setSnapGrid] = useState<number>(1);
  const [showGrid, setShowGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activePresetId, setActivePresetId] = useState("duck");
  const [showShapePalette, setShowShapePalette] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cookie_cutter_projects_v2");
      if (stored) setSavedProjects(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const preset = PRESETS.find(p => p.id === activePresetId);
    if (preset) {
      const parsed = parseSVGToDesignElements(preset.svg);
      if (parsed.length > 0) setElementsDirect(parsed);
    }
  }, [activePresetId, setElementsDirect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && shift && e.key === "z") {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (ctrl && e.key === "c") {
        e.preventDefault();
        copySelected();
      } else if (ctrl && e.key === "x") {
        e.preventDefault();
        cutSelected();
      } else if (ctrl && e.key === "v") {
        e.preventDefault();
        paste();
      } else if (ctrl && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (ctrl && e.key === "g" && !shift) {
        e.preventDefault();
        if (selectedIds.length >= 2) addGroup(selectedIds);
      } else if (ctrl && shift && e.key === "G") {
        e.preventDefault();
        if (selectedIds.length === 1) ungroup(selectedIds[0]);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (!ctrl && !shift) {
        switch (e.key.toLowerCase()) {
          case "v": setTransformMode("translate"); break;
          case "m": setTransformMode("translate"); break;
          case "r": setTransformMode("rotate"); break;
          case "s": setTransformMode("scale"); break;
          case "a":
            e.preventDefault();
            setSelectedIds(elements.map(el => el.id));
            break;
          case "escape":
            setSelectedIds([]);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, copySelected, cutSelected, paste, duplicateSelected, addGroup, ungroup, deleteSelected, elements, selectedIds, setSelectedIds]);

  const triggerSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }, []);

  const handleSvgUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProjectName(file.name.replace(/\.svg$/i, "").toUpperCase());
    setActivePresetId("");
    const reader = new FileReader();
    reader.onload = result => {
      const parsed = parseSVGToDesignElements(result.target?.result as string);
      if (parsed.length > 0) {
        setElementsDirect(parsed);
        triggerSuccess("SVG importado com sucesso!");
      } else {
        setErrorMsg("Nenhum caminho vetorial encontrado no SVG.");
      }
    };
    reader.readAsText(file);
  }, [setElementsDirect, triggerSuccess]);

  const handleSaveToLibrary = useCallback(() => {
    if (elements.length === 0) return;
    const project: SavedProject = {
      id: crypto.randomUUID(),
      name: projectName || "SEM NOME",
      savedAt: new Date().toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      elements: [...elements],
      config: { ...config },
    };
    const updated = [project, ...savedProjects];
    setSavedProjects(updated);
    localStorage.setItem("cookie_cutter_projects_v2", JSON.stringify(updated));
    triggerSuccess("Projeto salvo na biblioteca!");
  }, [elements, projectName, config, savedProjects, triggerSuccess]);

  const handleDeleteProject = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedProjects.filter(p => p.id !== projectId);
    setSavedProjects(updated);
    localStorage.setItem("cookie_cutter_projects_v2", JSON.stringify(updated));
  }, [savedProjects]);

  const handleLoadProject = useCallback((project: SavedProject) => {
    setProjectName(project.name);
    setConfig(project.config);
    setElementsDirect(project.elements);
    triggerSuccess(`Projeto "${project.name}" carregado!`);
  }, [setElementsDirect, triggerSuccess]);

  const handleExportSVG = useCallback(() => {
    const svg = exportElementsToSVG(elements, config);
    const slug = (projectName || "design").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    downloadFile(svg, `${slug}.svg`, "image/svg+xml");
    triggerSuccess("SVG exportado com sucesso!");
  }, [elements, config, projectName, triggerSuccess]);

  const handleAddText = useCallback(() => {
    addText("Texto", "Arial", 16);
    triggerSuccess("Texto adicionado!");
  }, [addText, triggerSuccess]);

  const [booleanPreview, setBooleanPreview] = useState<DesignElement | null>(null);
  const booleanPreviewTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleBooleanHover = useCallback(async (op: BooleanOp | null) => {
    if (booleanPreviewTimerRef.current) {
      clearTimeout(booleanPreviewTimerRef.current);
      booleanPreviewTimerRef.current = null;
    }

    if (!op || selectedIds.length < 2) {
      setBooleanPreview(null);
      return;
    }

    booleanPreviewTimerRef.current = setTimeout(async () => {
      try {
        const selected = elements.filter(e => selectedIds.includes(e.id));
        const { booleanOperation } = await import("../lib/cookie-cutter/booleanOps");
        const result = await booleanOperation(selected, op);
        if (result.pathData) {
          const preview = createPathElement(result.pathData, `Preview ${op}`);
          preview.role = "ignore";
          setBooleanPreview(preview);
        }
      } catch (e) {
        console.error("Boolean preview failed:", e);
      }
    }, 150);
  }, [elements, selectedIds]);

  const previewElements = booleanPreview ? [...elements, booleanPreview] : elements;

  const selectedElement = elements.find(e => e.id === selectedIds[0]) || null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--workbench-viewport)] text-[var(--workbench-text)]">
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border-2 border-emerald-500/50 text-emerald-500 font-mono text-[10px] uppercase font-black tracking-wider py-3 px-5 rounded-lg shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-6 right-6 z-50 bg-red-50 border border-red-300 text-red-600 font-mono text-[10px] py-3 px-5 rounded-lg shadow-lg flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--surface-container-high)] bg-white/50">
          <Sparkles className="w-4 h-4 text-[#632CE5]" />
          <span className="text-[10px] tracking-[0.15em] uppercase font-mono font-extrabold text-[#632CE5]">
            Design Editor
          </span>
          <div className="w-px h-5 bg-[var(--surface-container-high)]" />
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            className="bg-white/60 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 border border-[var(--surface-container-high)] rounded focus:outline-none focus:ring-1 focus:ring-[#632CE5] w-48"
          />
          <button
            onClick={handleSaveToLibrary}
            className="p-1.5 bg-[#632CE5]/10 text-[#632CE5] hover:bg-[#632CE5]/20 border border-[#632CE5]/30 rounded transition-colors"
            title="Salvar"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportSVG}
            className="p-1.5 bg-white border border-[var(--surface-container-high)] text-zinc-500 hover:text-[#632CE5] hover:border-[#632CE5]/30 rounded transition-colors"
            title="Exportar SVG"
          >
            <FileText className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <div className="flex gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 bg-white border border-[var(--surface-container-high)] text-zinc-500 hover:text-[#632CE5] hover:border-[#632CE5]/30 rounded transition-colors"
              title="Importar SVG"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              onChange={handleSvgUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-2 py-1 border-b border-[var(--surface-container-high)]">
              <Toolbar
                transformMode={transformMode}
                onModeChange={setTransformMode}
                snapGrid={snapGrid}
                onSnapChange={setSnapGrid}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onBooleanOp={booleanOp}
                onBooleanHover={handleBooleanHover}
                onAlign={alignElements}
                onZoomFit={() => {}}
                onAddPrimitive={(shape) => {
                  addPrimitive(shape as PrimitiveShape, {});
                  triggerSuccess(`Forma "${shape}" adicionada!`);
                }}
                onAddText={handleAddText}
                onDelete={deleteSelected}
                onDuplicate={duplicateSelected}
                onGroup={() => {
                  if (selectedIds.length >= 2) {
                    addGroup(selectedIds);
                    triggerSuccess("Elementos agrupados!");
                  }
                }}
                onUngroup={() => {
                  if (selectedIds.length === 1) {
                    ungroup(selectedIds[0]);
                    triggerSuccess("Grupo desfeito!");
                  }
                }}
                onCopy={copySelected}
                onPaste={paste}
                onCut={cutSelected}
                wireframe={wireframe}
                onWireframeToggle={() => setWireframe(w => !w)}
                showGrid={showGrid}
                onGridToggle={() => setShowGrid(g => !g)}
                onSnapGridChange={setSnapGrid}
              />
            </div>

            <div className="flex-1 relative">
              <DesignViewport
                elements={previewElements}
                selectedIds={selectedIds}
                onSelect={setSelectedIds}
                onTransform={(id, t) => updateTransform(id, t, true)}
                onTransformCommit={commitTransform}
                snapGrid={snapGrid}
                transformMode={transformMode}
                viewMode={config.viewMode}
                config={{
                  size: config.size,
                  stampPlateThickness: config.stampPlateThickness,
                  wallThickness: config.wallThickness,
                  clearance: config.clearance,
                  materialColor: config.materialColor,
                  explodedView: config.explodedView,
                  showWireframe: wireframe,
                }}
                outlinePoints={[]}
                detailRibbonShapes={[]}
              />

              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-white/90 backdrop-blur border border-[var(--surface-container-high)] rounded-lg p-2">
                <span className="text-[9px] font-mono text-zinc-500 uppercase">Vista:</span>
                {(["cutter_stamp", "cutter_only", "stamp_only", "coloring_plate"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setConfig(prev => ({ ...prev, viewMode: mode }))}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                      config.viewMode === mode
                        ? "bg-[#632CE5]/10 text-[#632CE5]"
                        : "text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    {mode === "cutter_stamp" && "C+K"}
                    {mode === "cutter_only" && "Cortador"}
                    {mode === "stamp_only" && "Carimbo"}
                    {mode === "coloring_plate" && "Colorir"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="w-80 flex flex-col border-l border-[var(--surface-container-high)] overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 border-b border-[var(--surface-container-high)]">
                <button
                  onClick={() => setShowShapePalette(s => !s)}
                  className="w-full py-2 px-3 bg-[#632CE5]/10 text-[#632CE5] hover:bg-[#632CE5]/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  {showShapePalette ? "Fechar Formas" : "Adicionar Formas"}
                </button>
                {showShapePalette && (
                  <div className="mt-2">
                    <ShapePalette
                      onAddPrimitive={(shape, params) => {
                        addPrimitive(shape, params);
                        triggerSuccess(`Forma adicionada!`);
                      }}
                    />
                  </div>
                )}
              </div>

              <LayersPanel
                elements={elements}
                selectedIds={selectedIds}
                onSelect={setSelectedIds}
                onReorder={reorder}
                onRoleChange={updateRole}
                onVisibilityToggle={updateVisibility}
                onLockToggle={updateLock}
                onRename={(id, name) => {}}
                onDuplicate={(ids) => {
                  setSelectedIds(ids);
                  duplicateSelected();
                }}
                onDelete={(ids) => {
                  setSelectedIds(ids);
                  deleteSelected();
                }}
                onGroup={addGroup}
                onUngroup={ungroup}
              />
            </div>

            <div className="border-t border-[var(--surface-container-high)] overflow-y-auto max-h-[40vh]">
              <PropertiesPanel
                element={selectedElement}
                onTransformChange={(id, t) => updateTransform(id, t)}
                onTextChange={updateTextData}
                onPrimitiveChange={updatePrimitiveData}
                onRoleChange={updateRole}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
