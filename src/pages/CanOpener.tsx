import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError, toastActionSuccess, toastInvalidFormat } from "@/lib/toast";
import { Image as ImageIcon, Upload, Settings, Download, Hammer, Scissors, Layers, Palette, Sparkles, Dna } from "lucide-react";
import {
  buildCanOpenerGeometry,
  type CanOpenerConfig,
  type EngravingMode,
  type TipStyle,
} from "../lib/imageTools/canOpenerGeometry";
import {
  buildTabLifterParts,
  buildTabLifterSingleColor,
  type TabLifterConfig,
} from "../lib/imageTools/tabLifterGeometry";
import { traceImage, type TraceOptions, type TracedImage } from "../lib/imageTools/traceImage";
import { OPENER_PRESETS, buildOpenerPreset, type OpenerPreset } from "../lib/imageTools/openerPresets";
import { exportThreeMF, type ExportPiece } from "../lib/split3mf/exporters";

const DEFAULT_TRACE: TraceOptions = {
  numberOfColors: 5,
  pathOmit: 64,
  removeBackground: true,
};

const SCALE = 0.1; // mm → scene units (Three)

interface UiConfig {
  targetWidthMm: number;
  handleThickness: number;
  bevel: number;
  engraving: EngravingMode;
  engravingDepth: number;
  tip: TipStyle;
  tipLength: number;
  hookWidth: number;
  hookDepth: number;
  wheelRadius: number;
  wheelTube: number;
  armWidth: number;
  armDepth: number;
  keyring: boolean;
  keyringDiameter: number;
  materialColor: string;
}

const DEFAULT_UI: UiConfig = {
  targetWidthMm: 60,
  handleThickness: 8,
  bevel: 0.6,
  engraving: "raised",
  engravingDepth: 0.8,
  tip: "hook_wheel",
  tipLength: 14,
  hookWidth: 5,
  hookDepth: 5,
  wheelRadius: 4,
  wheelTube: 0.6,
  armWidth: 3.5,
  armDepth: 2,
  keyring: true,
  keyringDiameter: 3,
  materialColor: "#fcd34d",
};

const DEFAULT_PROJECT_NAME = "MEU ABRIDOR";

type OpenerMode = "rasgo" | "gancho";

interface TabUiConfig {
  handleThickness: number;
  bevel: number;
  slotDepth: number;
  slotGap: number;
  slotX: number;
  slotWall: number;
  reliefDepth: number;
  fillBackground: boolean;
  repeatBack: boolean;
  keyring: boolean;
  keyringDiameter: number;
  baseColor: string;
}

const DEFAULT_TAB_UI: TabUiConfig = {
  handleThickness: 6,
  bevel: 0.6,
  slotDepth: 14,
  slotGap: 12,
  slotX: 0.5,
  slotWall: 1.5,
  reliefDepth: 0.8,
  fillBackground: false,
  repeatBack: false,
  keyring: true,
  keyringDiameter: 3,
  baseColor: "#ffffff",
};

export default function CanOpener() {
  const [mode, setMode] = useState<OpenerMode>("rasgo");
  const [ui, setUi] = useState<UiConfig>(DEFAULT_UI);
  const [tabUi, setTabUi] = useState<TabUiConfig>(DEFAULT_TAB_UI);
  const [trace, setTrace] = useState<TraceOptions>(DEFAULT_TRACE);
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [traced, setTraced] = useState<TracedImage | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"geral" | "config">("geral");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paletteCustomized = useRef(false);

  // Colour palette: [base, ...region colours]. Editable via swatches.
  const [palette, setPalette] = useState<string[]>([]);
  useEffect(() => {
    if (!traced) {
      setPalette([]);
      paletteCustomized.current = false;
      return;
    }
    if (paletteCustomized.current) return;
    setPalette([traced.backgroundColor, ...traced.regions.map((r) => r.color)]);
  }, [traced]);

  // Region shapes with the (possibly edited) palette colours applied.
  const colorRegions = useMemo(() => {
    if (!traced) return [];
    return traced.regions.map((r, i) => ({ ...r, color: palette[i + 1] ?? r.color }));
  }, [traced, palette]);

  // Trace the image whenever the file or trace options change.
  useEffect(() => {
    if (!imageFile) {
      // No uploaded file: a preset supplies the drawing instead.
      return;
    }
    let cancelled = false;
    setIsTracing(true);
    setErrorMsg("");
    traceImage(imageFile, ui.targetWidthMm, trace)
      .then((result) => {
        if (cancelled) return;
        setTraced(result);
        setIsTracing(false);
        toastActionSuccess("Imagem vetorizada com sucesso!");
      })
      .catch((err) => {
        if (cancelled) return;
        setIsTracing(false);
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setErrorMsg(`Falha ao vetorizar: ${msg}`);
      });
    return () => {
      cancelled = true;
    };
  }, [imageFile, trace, ui.targetWidthMm]);

  // Build the drawing straight from a preset (rectangular base).
  useEffect(() => {
    if (!activePresetId) return;
    const preset = OPENER_PRESETS.find((p) => p.id === activePresetId);
    if (!preset) return;
    try {
      setTraced(buildOpenerPreset(preset, ui.targetWidthMm));
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar preset");
    }
  }, [activePresetId, ui.targetWidthMm]);

  const handleSelectPreset = (preset: OpenerPreset) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImageFile(null);
    setActivePresetId(preset.id);
    setProjectName(preset.name.toUpperCase());
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const valid = ["png", "jpg", "jpeg", "webp", "bmp"];
    if (!valid.includes(file.name.split(".").pop()?.toLowerCase() || "")) {
      toastInvalidFormat(["PNG", "JPG", "WEBP", "BMP"]);
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setActivePresetId(null);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setProjectName(file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 32) || DEFAULT_PROJECT_NAME);
  };

  // Build the 3D geometry whenever inputs change.
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);

  useEffect(() => {
    if (!traced || mode !== "gancho") {
      setGeometry(null);
      return;
    }
    let cancelled = false;
    setGeometry(null);
    setGeometryError(null);
    const cfg: CanOpenerConfig = {
      outer: traced.outer,
      details: traced.details,
      ...ui,
    };
    buildCanOpenerGeometry(cfg)
      .then((g) => {
        if (cancelled) return;
        setGeometry(g);
      })
      .catch((err) => {
        if (!cancelled) setGeometryError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [traced, ui, mode]);

  // Tab-lifter (rasgo) mode: per-colour pieces in place, ready for 3MF.
  const [pieces, setPieces] = useState<ExportPiece[] | null>(null);
  const [piecesError, setPiecesError] = useState<string | null>(null);

  const tabCfg = useMemo<TabLifterConfig | null>(() => {
    if (!traced) return null;
    // The base always follows the drawing silhouette; "Remover fundo" only
    // refines the vectorization (whitens the image background), it never
    // swaps the base for the image's square box.
    return {
      outer: traced.outer,
      regions: colorRegions,
      handleThickness: tabUi.handleThickness,
      bevel: tabUi.bevel,
      slotDepth: tabUi.slotDepth,
      slotGap: tabUi.slotGap,
      slotX: tabUi.slotX,
      slotWall: tabUi.slotWall,
      reliefDepth: tabUi.reliefDepth,
      fillBackground: tabUi.fillBackground,
      repeatBack: tabUi.repeatBack,
      baseColor: palette[0] ?? DEFAULT_TAB_UI.baseColor,
      keyring: tabUi.keyring,
      keyringDiameter: tabUi.keyringDiameter,
    };
  }, [traced, colorRegions, palette, tabUi]);

  useEffect(() => {
    if (!traced || mode !== "rasgo" || !tabCfg) {
      setPieces(null);
      return;
    }
    let cancelled = false;
    setPieces(null);
    setPiecesError(null);
    buildTabLifterParts(tabCfg)
      .then((result) => {
        if (cancelled) return;
        setPieces(result);
      })
      .catch((err) => {
        if (!cancelled) setPiecesError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [traced, tabCfg, mode]);

  const slugName = () =>
    projectName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "") || "abridor";

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSTL = async () => {
    try {
      if (mode === "rasgo") {
        if (!tabCfg) return;
        const geometry = await buildTabLifterSingleColor(tabCfg);
        const mesh = new THREE.Mesh(geometry);
        const exporter = new STLExporter();
        const output = exporter.parse(mesh, { binary: true });
        downloadBlob(new Blob([output], { type: "application/octet-stream" }), `${slugName()}_tablifter.stl`);
        toastActionSuccess(`STL "${slugName()}_tablifter.stl" exportado!`);
        return;
      }
      if (!geometry) return;
      const mesh = new THREE.Mesh(geometry);
      const exporter = new STLExporter();
      const output = exporter.parse(mesh, { binary: true });
      downloadBlob(new Blob([output], { type: "application/octet-stream" }), `${slugName()}_canopener.stl`);
      toastActionSuccess(`STL "${slugName()}_canopener.stl" exportado!`);
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  const handleExport3MF = async () => {
    if (mode !== "rasgo" || !pieces?.length) return;
    try {
      const file = await exportThreeMF({ pieces, filename: `${slugName()}_tablifter` });
      downloadBlob(file, `${slugName()}_tablifter.3mf`);
      toastActionSuccess(`3MF multi-cor "${slugName()}_tablifter.3mf" exportado!`);
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  const handleReset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    setActivePresetId(null);
    setTraced(null);
    setUi(DEFAULT_UI);
    setTabUi(DEFAULT_TAB_UI);
    setTrace(DEFAULT_TRACE);
    setProjectName(DEFAULT_PROJECT_NAME);
    setErrorMsg("");
    setPalette([]);
    paletteCustomized.current = false;
  };

  const updateUi = <K extends keyof UiConfig>(key: K, value: UiConfig[K]) => setUi((p) => ({ ...p, [key]: value }));
  const updateTabUi = <K extends keyof TabUiConfig>(key: K, value: TabUiConfig[K]) => setTabUi((p) => ({ ...p, [key]: value }));
  const updateTrace = <K extends keyof TraceOptions>(key: K, value: TraceOptions[K]) => setTrace((p) => ({ ...p, [key]: value }));

  const updatePaletteColor = (index: number, color: string) => {
    paletteCustomized.current = true;
    setPalette((p) => p.map((c, i) => (i === index ? color : c)));
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F9FAF4]">
      {/* ─── LEFT SIDEBAR ─── */}
      <div className="w-full md:w-[400px] bg-[#F9FAF4] border-r border-[#E2E3DD] flex flex-col">
        <header className="p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Image Opener</h1>
          </div>
          <p className="text-[10px] text-[#687064] font-bold tracking-widest uppercase leading-relaxed">
            Imagem → Abridor de Latas 3D
          </p>
        </header>

        {/* Mode selector */}
        <div className="px-6 pb-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("rasgo")}
              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                mode === "rasgo"
                  ? "bg-[#632CE5] text-white border-[#632CE5] shadow-md"
                  : "bg-white text-[#687064] border-[#E2E3DD] hover:border-[#632CE5]/40 hover:text-[#1A1C19]"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5"><Dna className="w-3.5 h-3.5" />Puxador de Aba</span>
            </button>
            <button
              onClick={() => setMode("gancho")}
              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                mode === "gancho"
                  ? "bg-[#632CE5] text-white border-[#632CE5] shadow-md"
                  : "bg-white text-[#687064] border-[#E2E3DD] hover:border-[#632CE5]/40 hover:text-[#1A1C19]"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5"><Scissors className="w-3.5 h-3.5" />Gancho + Roda</span>
            </button>
          </div>
          <p className="mt-2 text-[9px] text-[#687064] font-bold tracking-widest uppercase">
            {mode === "rasgo"
              ? "Silhueta (sempre) + rasgo vertical no topo + cores"
              : "Cabo + ponta gancho/roda (clássico)"}
          </p>
        </div>

        <div className="px-6 pb-2 shrink-0">
          <div className="flex bg-white p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("geral")}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                activeTab === "geral" ? "bg-[#E2E3DD] text-[#1A1C19] shadow" : "text-[#687064] hover:text-[#1A1C19]"
              }`}
            >
              Imagem
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                activeTab === "config" ? "bg-[#E2E3DD] text-[#1A1C19] shadow" : "text-[#687064] hover:text-[#1A1C19]"
              }`}
            >
              Config
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-2">
          {activeTab === "geral" ? (
            <section className="space-y-6 pb-10">
              {/* Upload zone */}
              <div className="border-2 border-dashed border-[#E2E3DD] hover:border-[#632CE5]/40 rounded-xl p-4 text-center transition-colors relative group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {imageUrl ? (
                  <div className="space-y-2">
                    <img src={imageUrl} alt="preview" className="w-full h-32 object-contain bg-white rounded-lg border border-[#E2E3DD]" />
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1A1C19]">
                      {imageFile?.name}
                    </span>
                    <span className="block text-[9px] text-[#687064]">Clique para trocar a imagem</span>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <Upload className="w-8 h-8 text-[#687064] group-hover:text-[#632CE5] mx-auto transition-colors" />
                    <span className="block text-[11px] font-bold text-[#1A1C19]">Enviar imagem (PNG/JPG)</span>
                    <span className="block text-[9px] text-[#687064]">Poucas cores, fundo limpo — ideal!</span>
                  </div>
                )}
              </div>

              {/* Preset library */}
              <div className="pt-2 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />
                  Biblioteca de abridores
                </h3>
                <p className="text-[9px] text-[#687064] leading-relaxed mb-3">
                  Prontos em formato retangular — a base acompanha o retângulo e o desenho vira relevo colorido.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {OPENER_PRESETS.map((preset) => {
                    const active = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        title={preset.description}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          active
                            ? "border-[#632CE5] bg-[#632CE5]/10 shadow"
                            : "border-[#E2E3DD] bg-white hover:border-[#632CE5]/40"
                        }`}
                      >
                        <span
                          className="w-full h-12 block [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                          dangerouslySetInnerHTML={{ __html: preset.svg }}
                        />
                        <span className={`text-[8px] font-bold uppercase tracking-wide ${active ? "text-[#632CE5]" : "text-[#687064]"}`}>
                          {preset.icon} {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Project name */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-[#494455]">Nome do projeto</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-[11px] text-[#1A1C19] outline-none focus:border-[#632CE5]"
                />
              </div>

              {/* Preprocessing controls */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  Vetorização
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Cores</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{trace.numberOfColors}</span>
                  </div>
                  <input
                    type="range" min="2" max="8" step="1"
                    value={trace.numberOfColors}
                    onChange={(e) => updateTrace("numberOfColors", parseInt(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Tolerância de ruído</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{trace.pathOmit}</span>
                  </div>
                  <input
                    type="range" min="0" max="200" step="1"
                    value={trace.pathOmit}
                    onChange={(e) => updateTrace("pathOmit", parseInt(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label htmlFor="remove-bg" className="text-[10px] font-bold text-[#494455] cursor-pointer">Remover fundo</label>
                  <input
                    id="remove-bg"
                    type="checkbox"
                    checked={trace.removeBackground}
                    onChange={(e) => updateTrace("removeBackground", e.target.checked)}
                    className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]"
                  />
                </div>
                <p className="text-[9px] text-[#687064] leading-relaxed">
                  Marcado: fundo branco é removido da vetorização para extrair cores limpas. Desmarcado: mantém o fundo da imagem no desenho — a base continua seguindo a silhueta.
                </p>

                {isTracing && (
                  <div className="text-[9px] uppercase tracking-wider font-bold text-[#632CE5] animate-pulse">
                    Vetorizando...
                  </div>
                )}
                {traced && !isTracing && (
                  <div className="text-[9px] uppercase tracking-wider font-bold text-[#494455]">
                    {traced.details.length} detalhe(s) · {traced.heightMm.toFixed(1)}mm de altura
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] px-3 py-2 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full py-2 text-[10px] uppercase font-bold tracking-wider text-[#687064] hover:text-[#1A1C19] border border-[#E2E3DD] rounded-lg"
              >
                Reset
              </button>
            </section>
          ) : mode === "rasgo" ? (
            <section className="space-y-6 pb-10">
              {/* Handle */}
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                  01. Corpo
                </h3>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-[#494455] block">
                    Formato da base: silhueta (segue o desenho)
                  </label>
                  <p className="text-[9px] text-[#687064] leading-relaxed">
                    Sempre segue a silhueta, com ou sem "Remover fundo"; o rasgo e a argola de chaveiro são aplicados sobre ela.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Espessura</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.handleThickness}mm</span>
                  </div>
                  <input type="range" min="4" max="16" step="0.5"
                    value={tabUi.handleThickness}
                    onChange={(e) => updateTabUi("handleThickness", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Bevel</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.bevel}mm</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.1"
                    value={tabUi.bevel}
                    onChange={(e) => updateTabUi("bevel", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-2 pt-1">
                  <label className="text-[9px] uppercase font-bold text-[#494455] block">
                    Fundo / verso
                  </label>
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-[10px] font-bold text-[#494455]">Fechar o fundo com a cor</label>
                    <input type="checkbox" checked={tabUi.fillBackground}
                      onChange={(e) => updateTabUi("fillBackground", e.target.checked)}
                      className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-[10px] font-bold text-[#494455]">Repetir o desenho no verso</label>
                    <input type="checkbox" checked={tabUi.repeatBack}
                      onChange={(e) => updateTabUi("repeatBack", e.target.checked)}
                      className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]" />
                  </div>
                  <p className="text-[9px] text-[#687064] leading-relaxed">
                    "Fechar o fundo" apaga os vazios internos da silhueta (a base fica sólida e o furo some). "Repetir no verso" espelha o desenho colorido na face traseira.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="text-[10px] font-bold text-[#494455]">Furo para chaveiro</label>
                  <input type="checkbox" checked={tabUi.keyring}
                    onChange={(e) => updateTabUi("keyring", e.target.checked)}
                    className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]" />
                </div>
                {tabUi.keyring && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Diâmetro do furo</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.keyringDiameter}mm</span>
                    </div>
                    <input type="range" min="2" max="6" step="0.5"
                      value={tabUi.keyringDiameter}
                      onChange={(e) => updateTabUi("keyringDiameter", parseFloat(e.target.value))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                )}
              </div>

              {/* Slot (rasgo) */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-[#632CE5]" />
                  02. Rasgo
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Profundidade (desce do topo)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.slotDepth}mm</span>
                  </div>
                  <input type="range" min="6" max="30" step="1"
                    value={tabUi.slotDepth}
                    onChange={(e) => updateTabUi("slotDepth", parseInt(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Abertura (mm)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.slotGap}mm</span>
                  </div>
                  <input type="range" min="6" max="20" step="0.5"
                    value={tabUi.slotGap}
                    onChange={(e) => updateTabUi("slotGap", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Posição horizontal</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{Math.round(tabUi.slotX * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="0.9" step="0.01"
                    value={tabUi.slotX}
                    onChange={(e) => updateTabUi("slotX", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Parede nas faces (tampado)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.slotWall}mm</span>
                  </div>
                  <input type="range" min="0.5" max="4" step="0.1"
                    value={tabUi.slotWall}
                    onChange={(e) => updateTabUi("slotWall", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <p className="text-[9px] text-[#687064] leading-relaxed">
                  Fenda vertical fechada na borda superior, centrada em {Math.round(tabUi.slotX * 100)}% da largura. As faces ficam tampadas ("parede nas faces") e a aba (202, ~10mm) entra pela fresta do topo.
                </p>
              </div>

              {/* Relief */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  03. Relevo das cores
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Espessura do relevo</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.reliefDepth}mm</span>
                  </div>
                  <input type="range" min="0.2" max="2.5" step="0.1"
                    value={tabUi.reliefDepth}
                    onChange={(e) => updateTabUi("reliefDepth", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                {traced && (
                  <div className="text-[9px] uppercase tracking-wider font-bold text-[#494455]">
                    {traced.regions.length} região(ões) colorida(s) · {traced.heightMm.toFixed(1)}mm de altura
                  </div>
                )}
              </div>

              {/* Colours */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-[#632CE5]" />
                  04. Cores / Filamentos
                </h3>
                <div className="space-y-2">
                  {palette.map((color, index) => (
                    <div key={index} className="flex items-center gap-3 bg-white border border-[#E2E3DD] p-2 rounded-lg">
                      <input type="color" value={color}
                        onChange={(e) => updatePaletteColor(index, e.target.value)}
                        className="w-9 h-9 rounded-lg border border-[#E2E3DD] cursor-pointer" />
                      <div className="flex-1">
                        <span className="block text-[9px] uppercase font-bold text-[#494455]">
                          {index === 0 ? "Base (corpo)" : `Cor ${index}`}
                        </span>
                        <span className="text-[10px] font-mono text-[#1A1C19]">{color}</span>
                      </div>
                      <span className="text-[9px] text-[#687064] font-bold uppercase">
                        {index === 0 ? "Filamento 1" : `Filamento ${index + 1}`}
                      </span>
                    </div>
                  ))}
                  {palette.length <= 1 && (
                    <p className="text-[9px] text-[#687064] leading-relaxed">
                      Nenhuma cor interna detectada — a peça será de cor única.
                    </p>
                  )}
                </div>
              </div>

              {/* Export */}
              <div className="pt-4 border-t border-[#E2E3DD] pb-10 space-y-2">
                <button
                  onClick={handleExport3MF}
                  disabled={!pieces?.length}
                  className="w-full bg-[#632CE5] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#7C4DFF] transition-all shadow-md group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                  Download 3MF Multi-cor (.3mf)
                </button>
                <button
                  onClick={handleExportSTL}
                  disabled={!tabCfg}
                  className="w-full bg-white text-[#494455] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 border border-[#E2E3DD] hover:border-[#632CE5]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Download STL (.stl)
                </button>
                <p className="text-[9px] text-[#687064] mt-3 leading-relaxed">
                  O 3MF multi-cor exporta 1 objeto por filamento. No slicer, atribua cada cor ao filamento correspondente (AMS/Bambu) — a peça imprime em camadas de relevo.
                </p>
              </div>
            </section>
          ) : (
            <section className="space-y-6 pb-10">
              {/* Handle */}
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                  01. Cabo
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Largura (mm)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{ui.targetWidthMm}</span>
                  </div>
                  <input type="range" min="30" max="120" step="1"
                    value={ui.targetWidthMm}
                    onChange={(e) => updateUi("targetWidthMm", parseInt(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Espessura</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{ui.handleThickness}mm</span>
                  </div>
                  <input type="range" min="4" max="16" step="0.5"
                    value={ui.handleThickness}
                    onChange={(e) => updateUi("handleThickness", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#494455]">Bevel</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{ui.bevel}mm</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.1"
                    value={ui.bevel}
                    onChange={(e) => updateUi("bevel", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="text-[10px] font-bold text-[#494455]">Furo para chaveiro</label>
                  <input type="checkbox" checked={ui.keyring}
                    onChange={(e) => updateUi("keyring", e.target.checked)}
                    className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[#E2E3DD]" />
                </div>
                {ui.keyring && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Diâmetro do furo</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{ui.keyringDiameter}mm</span>
                    </div>
                    <input type="range" min="2" max="6" step="0.5"
                      value={ui.keyringDiameter}
                      onChange={(e) => updateUi("keyringDiameter", parseFloat(e.target.value))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                )}
              </div>

              {/* Engraving */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />
                  02. Detalhes
                </h3>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-[#494455] block">Modo</label>
                  <select value={ui.engraving} onChange={(e) => updateUi("engraving", e.target.value as EngravingMode)}
                    className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-[11px] outline-none focus:border-[#632CE5]">
                    <option value="none">Sem detalhes</option>
                    <option value="raised">Relevo alto</option>
                    <option value="recessed">Gravado</option>
                  </select>
                </div>
                {ui.engraving !== "none" && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[#494455]">Profundidade</label>
                      <span className="text-[10px] font-mono text-[#632CE5]">{ui.engravingDepth}mm</span>
                    </div>
                    <input type="range" min="0.2" max="2.0" step="0.1"
                      value={ui.engravingDepth}
                      onChange={(e) => updateUi("engravingDepth", parseFloat(e.target.value))}
                      className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                  </div>
                )}
              </div>

              {/* Tip */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-[#632CE5]" />
                  03. Ponta
                </h3>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-[#494455] block">Estilo</label>
                  <select value={ui.tip} onChange={(e) => updateUi("tip", e.target.value as TipStyle)}
                    className="w-full bg-white border border-[#E2E3DD] rounded-lg p-2 text-[11px] outline-none focus:border-[#632CE5]">
                    <option value="none">Sem ponta</option>
                    <option value="hook_only">Apenas gancho</option>
                    <option value="hook_wheel">Gancho + roda</option>
                  </select>
                </div>
                {ui.tip !== "none" && (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[9px] uppercase font-bold text-[#494455]">Comprimento</label>
                        <span className="text-[10px] font-mono text-[#632CE5]">{ui.tipLength}mm</span>
                      </div>
                      <input type="range" min="6" max="25" step="0.5"
                        value={ui.tipLength}
                        onChange={(e) => updateUi("tipLength", parseFloat(e.target.value))}
                        className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[9px] uppercase font-bold text-[#494455]">Gancho (largura)</label>
                        <span className="text-[10px] font-mono text-[#632CE5]">{ui.hookWidth}mm</span>
                      </div>
                      <input type="range" min="2" max="10" step="0.5"
                        value={ui.hookWidth}
                        onChange={(e) => updateUi("hookWidth", parseFloat(e.target.value))}
                        className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                    </div>
                    {ui.tip === "hook_wheel" && (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <label className="text-[9px] uppercase font-bold text-[#494455]">Raio da roda</label>
                            <span className="text-[10px] font-mono text-[#632CE5]">{ui.wheelRadius}mm</span>
                          </div>
                          <input type="range" min="2" max="8" step="0.5"
                            value={ui.wheelRadius}
                            onChange={(e) => updateUi("wheelRadius", parseFloat(e.target.value))}
                            className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <label className="text-[9px] uppercase font-bold text-[#494455]">Braço (largura)</label>
                            <span className="text-[10px] font-mono text-[#632CE5]">{ui.armWidth}mm</span>
                          </div>
                          <input type="range" min="2" max="6" step="0.5"
                            value={ui.armWidth}
                            onChange={(e) => updateUi("armWidth", parseFloat(e.target.value))}
                            className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Material */}
              <div className="space-y-4 pt-4 border-t border-[#E2E3DD]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#494455] font-black flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-[#632CE5]" />
                  04. Cor
                </h3>
                <div className="flex items-center gap-3">
                  <input type="color" value={ui.materialColor} onChange={(e) => updateUi("materialColor", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-[#E2E3DD] cursor-pointer" />
                  <span className="text-[10px] font-mono text-[#1A1C19]">{ui.materialColor}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E3DD] pb-10">
                <button
                  onClick={handleExportSTL}
                  disabled={!geometry}
                  className="w-full bg-[#632CE5] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#7C4DFF] transition-all shadow-md group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                  Download STL (.stl)
                </button>
                <p className="text-[9px] text-[#687064] mt-3 leading-relaxed">
                  Para uso real: imprima em <strong>PETG ou ABS</strong> e afie manualmente a ponta do gancho com uma lima fina. A roda precisa de folga suficiente para a borda da tampa entrar.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ─── RIGHT: 3D PREVIEW ─── */}
      <div className="flex-1 flex flex-col h-full bg-[#F1F3ED] relative">
        <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
          <Hammer className="w-4 h-4 text-[#632CE5]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#494455]">Preview 3D</span>
        </div>

        <Canvas shadows camera={{ position: [0, 30, 80], fov: 35 }}>
          <color attach="background" args={["#F1F3ED"]} />
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#ffffff", "#666666", 0.6]} />
          <directionalLight position={[40, 40, 40]} intensity={1.4} castShadow />
          <pointLight position={[-40, -40, -20]} intensity={0.6} />

          <Grid
            infiniteGrid
            fadeDistance={120}
            sectionColor="#632CE5"
            cellColor="#E2E3DD"
            cellSize={2}
            sectionSize={10}
          />

          {mode === "rasgo" ? (
            piecesError ? (
              <Center>
                <mesh>
                  <boxGeometry args={[10, 10, 10]} />
                  <meshStandardMaterial color="#ef4444" wireframe />
                </mesh>
              </Center>
            ) : pieces?.length ? (
              <Center>
                <group>
                  {pieces.map((p) => (
                    <mesh key={p.regionId} geometry={p.geometry} castShadow receiveShadow scale={[SCALE, SCALE, SCALE]}>
                      <meshStandardMaterial color={p.color} metalness={0.25} roughness={0.45} />
                    </mesh>
                  ))}
                </group>
              </Center>
            ) : (
              <Center>
                <mesh>
                  <boxGeometry args={[12, 18, 1.5]} />
                  <meshStandardMaterial color="#d4d4d8" wireframe />
                </mesh>
              </Center>
            )
          ) : geometryError ? (
            <Center>
              <mesh>
                <boxGeometry args={[10, 10, 10]} />
                <meshStandardMaterial color="#ef4444" wireframe />
              </mesh>
            </Center>
          ) : geometry ? (
            <Center>
              <mesh geometry={geometry} castShadow receiveShadow scale={[SCALE, SCALE, SCALE]}>
                <meshStandardMaterial
                  color={ui.materialColor}
                  metalness={0.25}
                  roughness={0.45}
                />
              </mesh>
            </Center>
          ) : (
            <Center>
              <mesh>
                <boxGeometry args={[12, 18, 1.5]} />
                <meshStandardMaterial color="#d4d4d8" wireframe />
              </mesh>
            </Center>
          )}

          <OrbitControls makeDefault />
        </Canvas>

        {(geometryError || (mode === "rasgo" && piecesError)) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold px-4 py-2 rounded-lg border border-[#FCA5A5]">
            Erro ao gerar geometria: {geometryError || piecesError}
          </div>
        )}
        {!traced && !geometryError && !piecesError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/80 backdrop-blur text-[#494455] text-[10px] font-bold px-4 py-2 rounded-lg border border-[#E2E3DD]">
            Envie uma imagem para começar
          </div>
        )}
      </div>
    </div>
  );
}