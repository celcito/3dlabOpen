import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { Box, Check, Download, FileCode, Image as ImageIcon, Loader2, Sliders, UploadCloud } from "lucide-react";
import { toastExportError } from "@/lib/toast";
import { generateKeycapBaseGeometry, getTopFootprint, CHERRY_MX_DEFAULTS, type KeycapBaseConfig } from "../lib/keycapBase";
import { buildCustomizedKeycap, type CustomizationInputType, type CustomizationMode } from "../lib/keycapCustomizer";

const KEYCAP_CONFIG: KeycapBaseConfig = {
  bottomWidth: 18,
  bottomDepth: 18,
  topWidth: 13.5,
  topDepth: 13.5,
  height: 9,
  wallThickness: 1.2,
  ...CHERRY_MX_DEFAULTS,
};

export default function KeycapCustomizer() {
  const [inputType, setInputType] = useState<CustomizationInputType>("image");
  const [mode, setMode] = useState<CustomizationMode>("engrave");
  const [scale, setScale] = useState(0.75);
  const [reliefHeight, setReliefHeight] = useState(0.6);
  const [invertImage, setInvertImage] = useState(false);
  const [imageThreshold, setImageThreshold] = useState(128);
  const [file, setFile] = useState<File | null>(null);
  const [resultGeometry, setResultGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseGeometry = useMemo(() => generateKeycapBaseGeometry(KEYCAP_CONFIG), []);
  const footprint = useMemo(() => getTopFootprint(KEYCAP_CONFIG), []);
  const displayedGeometry = resultGeometry ?? baseGeometry;

  useEffect(() => () => baseGeometry.dispose(), [baseGeometry]);
  useEffect(() => () => resultGeometry?.dispose(), [resultGeometry]);

  const accept = inputType === "image" ? ".png,.jpg,.jpeg,.webp" : inputType === "svg" ? ".svg" : ".glb,.gltf,.obj";

  const selectInputType = (type: CustomizationInputType) => {
    setInputType(type);
    setFile(null);
    setResultGeometry(null);
    setStatus("idle");
    setErrorMessage("");
  };

  const handleGenerate = useCallback(async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMessage("");
    try {
      const { geometry } = await buildCustomizedKeycap(file, inputType, baseGeometry, footprint, {
        mode,
        reliefHeight,
        scale,
        invertImage,
        imageThreshold,
      });
      setResultGeometry(geometry);
      setStatus("idle");
    } catch (error) {
      console.error("Keycap customization failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Falha ao aplicar a customização.");
      setStatus("error");
    }
  }, [baseGeometry, file, footprint, imageThreshold, inputType, invertImage, mode, reliefHeight, scale]);

  const handleExport = () => {
    try {
      const exporter = new STLExporter();
      const mesh = new THREE.Mesh(displayedGeometry);
      const result = exporter.parse(mesh, { binary: true });
      const url = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `keycap-custom-${Date.now()}.stl`;
      link.click();
      URL.revokeObjectURL(url);
      setSuccessMessage("STL da keycap exportado");
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch (error) {
      console.error("Keycap export failed:", error);
      toastExportError();
    }
  };

  return (
    <div className="workbench-page flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--workbench-page)]">
      <aside className="w-full md:w-80 bg-[var(--workbench-panel)] border-r border-[var(--workbench-line)] overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
              <Box className="w-5 h-5 text-[#632CE5]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-[#1A1C19]">Keycap customizer</h1>
          </div>
          <p className="text-[10px] text-[#687064] font-bold uppercase tracking-widest">Crie uma keycap MX e aplique arte no topo.</p>
        </header>

        <section className="space-y-4">
          <SectionTitle>01. Tipo de arte</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["image", ImageIcon, "Imagem"],
              ["svg", FileCode, "SVG"],
              ["model", Box, "Modelo 3D"],
            ] as const).map(([type, Icon, label]) => (
              <button key={type} type="button" onClick={() => selectInputType(type)} className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-[9px] font-bold uppercase tracking-wide ${inputType === type ? "border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10" : "border-[var(--workbench-line)] text-[#687064] hover:border-[#632CE5]/40"}`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border border-dashed border-[var(--workbench-line)] hover:border-[#632CE5]/50 rounded-xl py-6 flex flex-col items-center gap-2 text-[#687064] hover:text-[#632CE5]">
            <UploadCloud className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-center px-2">{file?.name || `Selecionar ${inputType === "image" ? "imagem" : inputType === "svg" ? "SVG" : "modelo 3D"}`}</span>
          </button>
        </section>

        <section className="space-y-6 pt-4 border-t border-[var(--workbench-line)]">
          <SectionTitle icon={<Sliders className="w-3.5 h-3.5 text-[#632CE5]" />}>02. Aplicação</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton active={mode === "engrave"} onClick={() => setMode("engrave")}>Gravado</ModeButton>
            <ModeButton active={mode === "emboss"} onClick={() => setMode("emboss")}>Relevo</ModeButton>
          </div>
          <RangeControl label="Tamanho da arte" value={`${Math.round(scale * 100)}%`} min="0.2" max="1" step="0.05" number={scale} onChange={setScale} />
          <RangeControl label={mode === "engrave" ? "Profundidade" : "Altura do relevo"} value={`${reliefHeight.toFixed(2)} mm`} min="0.2" max="2" step="0.1" number={reliefHeight} onChange={setReliefHeight} />
          {inputType === "image" && (
            <div className="space-y-4 pt-4 border-t border-[var(--workbench-line)]">
              <SectionTitle>03. Imagem</SectionTitle>
              <RangeControl label="Threshold P&B" value={String(imageThreshold)} min="0" max="255" step="1" number={imageThreshold} onChange={setImageThreshold} />
              <label className="flex items-center gap-2 text-[9px] uppercase font-bold text-[#687064] cursor-pointer">
                <input type="checkbox" checked={invertImage} onChange={(event) => setInvertImage(event.target.checked)} className="accent-[#632CE5]" />
                Inverter áreas claras
              </label>
            </div>
          )}
          <div className="space-y-3 pt-2">
            <button type="button" onClick={handleGenerate} disabled={!file || status === "processing"} className="w-full bg-[#632CE5] disabled:opacity-40 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#5420C9]">
              {status === "processing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando</> : "Aplicar na keycap"}
            </button>
            {status === "error" && <p className="text-[10px] text-red-600 leading-relaxed">{errorMessage}</p>}
            <button type="button" onClick={handleExport} className="w-full bg-[#1A1C19] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#343832]">
              <Download className="w-4 h-4" /> Download STL
            </button>
          </div>
        </section>
      </aside>

      <main className="workbench-viewport flex-1 relative min-w-0">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [30, 30, 30], fov: 45 }}>
            <color attach="background" args={["#F1F3ED"]} />
            <ambientLight intensity={0.6} />
            <spotLight position={[50, 50, 50]} angle={0.15} penumbra={1} castShadow />
            <pointLight position={[-50, -50, -50]} intensity={0.4} />
            <OrbitControls makeDefault />
            <Grid infiniteGrid fadeDistance={100} cellColor="#222" sectionColor="#444" cellSize={10} sectionSize={50} position={[0, -0.1, 0]} />
            <Center><mesh geometry={displayedGeometry} castShadow receiveShadow><meshStandardMaterial color="#632CE5" roughness={0.4} metalness={0.15} /></mesh></Center>
          </Canvas>
        </div>
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-white/85 backdrop-blur-md border border-[var(--workbench-line)] p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#632CE5] animate-pulse" /><span className="text-[10px] font-black text-[#1A1C19] uppercase tracking-widest">{resultGeometry ? "Keycap customizada" : "Base MX"}</span></div>
            <div className="text-[11px] font-mono text-[#687064]">18 × 18 × 9 mm</div>
          </div>
        </div>
        {successMessage && <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 bg-[#632CE5] text-white px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest"><Check className="w-4 h-4" />{successMessage}</div>}
      </main>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#687064] font-black flex items-center gap-2">{icon}{children}</h2>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wide border ${active ? "border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10" : "border-[var(--workbench-line)] text-[#687064] hover:border-[#632CE5]/40"}`}>{children}</button>;
}

function RangeControl({ label, value, min, max, step, number, onChange }: { label: string; value: string; min: string; max: string; step: string; number: number; onChange: (value: number) => void }) {
  return <div className="space-y-3"><div className="flex justify-between"><label className="text-[9px] uppercase font-bold text-[#687064]">{label}</label><span className="text-[10px] font-mono text-[#632CE5]">{value}</span></div><input type="range" min={min} max={max} step={step} value={number} onChange={(event) => onChange(Number(event.target.value))} className="w-full h-1.5 bg-[var(--workbench-subtle)] rounded-lg appearance-none cursor-pointer" /></div>;
}
