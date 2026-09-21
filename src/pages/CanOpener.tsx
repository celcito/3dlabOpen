import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError, toastActionSuccess, toastInvalidFormat } from "@/lib/toast";
import { Image as ImageIcon, Upload, Settings, Download, Hammer, Scissors, Layers, Palette, Sparkles } from "lucide-react";
import {
  type EngravingMode,
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
  keyring: boolean;
  keyringDiameter: number;
}

const DEFAULT_UI: UiConfig = {
  targetWidthMm: 60,
  handleThickness: 8,
  bevel: 0.6,
  engraving: "raised",
  engravingDepth: 0.8,
  keyring: true,
  keyringDiameter: 3,
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
  const [presetSilhouette, setPresetSilhouette] = useState(false);
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
      // Preset drawings can either sit on a rectangular base (default) or
      // make the opener follow the drawing's own silhouette.
      silhouetteMode: presetSilhouette && activePresetId !== null,
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
      if (!tabCfg) return;
      const geometry = await buildTabLifterSingleColor(tabCfg);
      const mesh = new THREE.Mesh(geometry);
      const exporter = new STLExporter();
      const output = exporter.parse(mesh, { binary: true });
      downloadBlob(new Blob([output], { type: "application/octet-stream" }), `${slugName()}_tablifter.stl`);
      toastActionSuccess(`STL "${slugName()}_tablifter.stl" exportado!`);
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
    setPresetSilhouette(false);
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
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-viewport)]">
      {/* ─── LEFT: 3D PREVIEW ─── */}
      <div className="flex-1 flex flex-col h-full bg-[var(--workbench-viewport)] relative">
        <div className="absolute top-4 left-6 z-10 flex items-center gap-2">
          <Hammer className="w-4 h-4 text-[#632CE5]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-surface-variant)]">Preview 3D</span>
        </div>

        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 30, 80], fov: 35 }}>
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

          {piecesError ? (
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
          )}

          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </Canvas>

        {piecesError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold px-4 py-2 rounded-lg border border-[#FCA5A5]">
            Erro ao gerar geometria: {piecesError}
          </div>
        )}
        {!traced && !piecesError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/80 backdrop-blur text-[var(--on-surface-variant)] text-[10px] font-bold px-4 py-2 rounded-lg border border-[var(--surface-container-high)]">
            Envie uma imagem para começar
          </div>
        )}
      </div>

      {/* ─── RIGHT: SIDEBAR ─── */}
      <div className="w-full md:w-[400px] bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] flex flex-col">
        <header className="p-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">Image Opener</h1>
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)] font-bold tracking-widest uppercase leading-relaxed">
            Imagem → Abridor de Latas 3D
          </p>
        </header>

        <div className="px-6 pb-2 shrink-0">
          <p className="text-[9px] text-[var(--on-surface-variant)] font-bold tracking-widest uppercase">
            Silhueta (sempre) + rasgo vertical no topo + cores
          </p>
        </div>

        <div className="px-6 pb-2 shrink-0">
          <div className="flex bg-white p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("geral")}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                activeTab === "geral" ? "bg-[#E2E3DD] text-[var(--workbench-text)] shadow" : "text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)]"
              }`}
            >
              Imagem
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                activeTab === "config" ? "bg-[#E2E3DD] text-[var(--workbench-text)] shadow" : "text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)]"
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
              <div className="border-2 border-dashed border-[var(--surface-container-high)] hover:border-[#632CE5]/40 rounded-xl p-4 text-center transition-colors relative group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {imageUrl ? (
                  <div className="space-y-2">
                    <img src={imageUrl} alt="preview" className="w-full h-32 object-contain bg-white rounded-lg border border-[var(--surface-container-high)]" />
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--workbench-text)]">
                      {imageFile?.name}
                    </span>
                    <span className="block text-[9px] text-[var(--on-surface-variant)]">Clique para trocar a imagem</span>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <Upload className="w-8 h-8 text-[var(--on-surface-variant)] group-hover:text-[#632CE5] mx-auto transition-colors" />
                    <span className="block text-[11px] font-bold text-[var(--workbench-text)]">Enviar imagem (PNG/JPG)</span>
                    <span className="block text-[9px] text-[var(--on-surface-variant)]">Poucas cores, fundo limpo — ideal!</span>
                  </div>
                )}
              </div>

              {/* Preset library */}
              <div className="pt-2 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />
                  Biblioteca de abridores
                </h3>
                <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed mb-3">
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
                            : "border-[var(--surface-container-high)] bg-white hover:border-[#632CE5]/40"
                        }`}
                      >
                        <span
                          className="w-full h-12 block [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                          dangerouslySetInnerHTML={{ __html: preset.svg }}
                        />
                        <span className={`text-[8px] font-bold uppercase tracking-wide ${active ? "text-[#632CE5]" : "text-[var(--on-surface-variant)]"}`}>
                          {preset.icon} {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--surface-container-high)] mt-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--on-surface-variant)] block">Seguir a silhueta do desenho</label>
                    <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                      A base acompanha o contorno do desenho em vez do retângulo.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={presetSilhouette}
                    onChange={(e) => setPresetSilhouette(e.target.checked)}
                    className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[var(--surface-container-high)]"
                  />
                </div>
              </div>

              {/* Project name */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Nome do projeto</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-white border border-[var(--surface-container-high)] rounded-lg p-2 text-[11px] text-[var(--workbench-text)] outline-none focus:border-[#632CE5]"
                />
              </div>

              {/* Preprocessing controls */}
              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  Vetorização
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Cores</label>
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
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Tolerância de ruído</label>
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
                  <label htmlFor="remove-bg" className="text-[10px] font-bold text-[var(--on-surface-variant)] cursor-pointer">Remover fundo</label>
                  <input
                    id="remove-bg"
                    type="checkbox"
                    checked={trace.removeBackground}
                    onChange={(e) => updateTrace("removeBackground", e.target.checked)}
                    className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[var(--surface-container-high)]"
                  />
                </div>
                <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                  Marcado: fundo branco é removido da vetorização para extrair cores limpas. Desmarcado: mantém o fundo da imagem no desenho — a base continua seguindo a silhueta.
                </p>

                {isTracing && (
                  <div className="text-[9px] uppercase tracking-wider font-bold text-[#632CE5] animate-pulse">
                    Vetorizando...
                  </div>
                )}
                {traced && !isTracing && (
                  <div className="text-[9px] uppercase tracking-wider font-bold text-[var(--on-surface-variant)]">
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
                className="w-full py-2 text-[10px] uppercase font-bold tracking-wider text-[var(--on-surface-variant)] hover:text-[var(--workbench-text)] border border-[var(--surface-container-high)] rounded-lg"
              >
                Reset
              </button>
            </section>
          ) : (
            <section className="space-y-6 pb-10">
              {/* Handle */}
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-[#632CE5]" />
                  01. Cabo
                </h3>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)] block">
                    Formato da base: silhueta (segue o desenho)
                  </label>
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    Sempre segue a silhueta, com ou sem "Remover fundo"; o rasgo e a argola de chaveiro são aplicados sobre ela.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Espessura</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.handleThickness}mm</span>
                  </div>
                  <input type="range" min="4" max="16" step="0.5"
                    value={tabUi.handleThickness}
                    onChange={(e) => updateTabUi("handleThickness", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Bevel</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.bevel}mm</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.1"
                    value={tabUi.bevel}
                    onChange={(e) => updateTabUi("bevel", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-2 pt-1">
                  <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)] block">
                    Fundo / verso
                  </label>
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-[10px] font-bold text-[var(--on-surface-variant)]">Fechar o fundo com a cor</label>
                    <input type="checkbox" checked={tabUi.fillBackground}
                      onChange={(e) => updateTabUi("fillBackground", e.target.checked)}
                      className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[var(--surface-container-high)]" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-[10px] font-bold text-[var(--on-surface-variant)]">Repetir o desenho no verso</label>
                    <input type="checkbox" checked={tabUi.repeatBack}
                      onChange={(e) => updateTabUi("repeatBack", e.target.checked)}
                      className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[var(--surface-container-high)]" />
                  </div>
                  <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                    "Fechar o fundo" apaga os vazios internos da silhueta (a base fica sólida e o furo some). "Repetir no verso" espelha o desenho colorido na face traseira.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="text-[10px] font-bold text-[var(--on-surface-variant)]">Furo para chaveiro</label>
                  <input type="checkbox" checked={tabUi.keyring}
                    onChange={(e) => updateTabUi("keyring", e.target.checked)}
                    className="accent-[#632CE5] w-4 h-4 rounded bg-[#F3F4EE] border-[var(--surface-container-high)]" />
                </div>
                {tabUi.keyring && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Diâmetro do furo</label>
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
              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-[#632CE5]" />
                  02. Rasgo
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Profundidade (desce do topo)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.slotDepth}mm</span>
                  </div>
                  <input type="range" min="6" max="30" step="1"
                    value={tabUi.slotDepth}
                    onChange={(e) => updateTabUi("slotDepth", parseInt(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Abertura (mm)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.slotGap}mm</span>
                  </div>
                  <input type="range" min="6" max="20" step="0.5"
                    value={tabUi.slotGap}
                    onChange={(e) => updateTabUi("slotGap", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Posição horizontal</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{Math.round(tabUi.slotX * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="0.9" step="0.01"
                    value={tabUi.slotX}
                    onChange={(e) => updateTabUi("slotX", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Parede nas faces (tampado)</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.slotWall}mm</span>
                  </div>
                  <input type="range" min="0.5" max="4" step="0.1"
                    value={tabUi.slotWall}
                    onChange={(e) => updateTabUi("slotWall", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                  Fenda vertical fechada na borda superior, centrada em {Math.round(tabUi.slotX * 100)}% da largura. As faces ficam tampadas ("parede nas faces") e a aba (202, ~10mm) entra pela fresta do topo.
                </p>
              </div>

              {/* Relief */}
              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#632CE5]" />
                  03. Relevo das cores
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">Espessura do relevo</label>
                    <span className="text-[10px] font-mono text-[#632CE5]">{tabUi.reliefDepth}mm</span>
                  </div>
                  <input type="range" min="0.2" max="2.5" step="0.1"
                    value={tabUi.reliefDepth}
                    onChange={(e) => updateTabUi("reliefDepth", parseFloat(e.target.value))}
                    className="w-full accent-[#632CE5] h-1.5 bg-[#E2E3DD] rounded-lg appearance-none cursor-pointer" />
                </div>
                {traced && (
                  <div className="text-[9px] uppercase tracking-wider font-bold text-[var(--on-surface-variant)]">
                    {traced.regions.length} região(ões) colorida(s) · {traced.heightMm.toFixed(1)}mm de altura
                  </div>
                )}
              </div>

              {/* Colours */}
              <div className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)] font-black flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-[#632CE5]" />
                  04. Cores / Filamentos
                </h3>
                <div className="space-y-2">
                  {palette.map((color, index) => (
                    <div key={index} className="flex items-center gap-3 bg-white border border-[var(--surface-container-high)] p-2 rounded-lg">
                      <input type="color" value={color}
                        onChange={(e) => updatePaletteColor(index, e.target.value)}
                        className="w-9 h-9 rounded-lg border border-[var(--surface-container-high)] cursor-pointer" />
                      <div className="flex-1">
                        <span className="block text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">
                          {index === 0 ? "Base (corpo)" : `Cor ${index}`}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--workbench-text)]">{color}</span>
                      </div>
                      <span className="text-[9px] text-[var(--on-surface-variant)] font-bold uppercase">
                        {index === 0 ? "Filamento 1" : `Filamento ${index + 1}`}
                      </span>
                    </div>
                  ))}
                  {palette.length <= 1 && (
                    <p className="text-[9px] text-[var(--on-surface-variant)] leading-relaxed">
                      Nenhuma cor interna detectada — a peça será de cor única.
                    </p>
                  )}
                </div>
              </div>

              {/* Export */}
              <div className="pt-4 border-t border-[var(--surface-container-high)] pb-10 space-y-2">
                <button
                  onClick={handleExport3MF}
                  disabled={!pieces?.length}
                  className="btn-primary"
                >
                  <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                  Download 3MF Multi-cor (.3mf)
                </button>
                <button
                  onClick={handleExportSTL}
                  disabled={!tabCfg}
                  className="w-full bg-white text-[var(--on-surface-variant)] py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 border border-[var(--surface-container-high)] hover:border-[#632CE5]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Download STL (.stl)
                </button>
                <p className="text-[9px] text-[var(--on-surface-variant)] mt-3 leading-relaxed">
                  O 3MF multi-cor exporta 1 objeto por filamento. No slicer, atribua cada cor ao filamento correspondente (AMS/Bambu) — a peça imprime em camadas de relevo.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}