import { useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { addPegSocketJoint } from "../../lib/csg";
import { sliceMeshIntoSegments, jointArticulatedSegments, SegmentData } from "../lib/meshSlicing";
import { toastExportError } from "@/lib/toast";
import {
  UploadCloud, Download, Sliders, Layers,
  Check, Waves, Loader2, ImageIcon
} from "lucide-react";
import { useFlexiFromPhoto } from "../hooks/useFlexiFromPhoto";

export default function FlexiFromPhoto() {
  const {
    config, setConfig, sourceGeometry, setSourceGeometry, segmentsPreview,
    setSegmentsPreview, fileName, setFileName, status, setStatus, successMsg,
    showNotification,
  } = useFlexiFromPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. Import do mesh gerado a partir da foto (saída do pipeline TripoSR/Hunyuan3D) ---
  const handleFileUpload = useCallback((file: File) => {
    setStatus("loading");
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    const ext = file.name.split(".").pop()?.toLowerCase();

    const onGeometry = (geo: THREE.BufferGeometry) => {
      geo.center(); // recentra a malha na origem antes de calcular a spine
      setSourceGeometry(geo);
      setStatus("idle");
      URL.revokeObjectURL(url);
    };

    const extractFirstGeometry = (object: THREE.Object3D): THREE.BufferGeometry | null => {
      const geoms: THREE.BufferGeometry[] = [];
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const g = mesh.geometry.clone();
          g.applyMatrix4(mesh.matrixWorld);
          geoms.push(g);
        }
      });
      if (geoms.length === 0) return null;
      return geoms.length === 1 ? geoms[0] : BufferGeometryUtils.mergeGeometries(geoms, false);
    };

    try {
      if (ext === "glb" || ext === "gltf") {
        new GLTFLoader().load(
          url,
          (gltf) => {
            const geo = extractFirstGeometry(gltf.scene);
            if (geo) onGeometry(geo);
            else { setStatus("error"); }
          },
          undefined,
          () => setStatus("error")
        );
      } else if (ext === "obj") {
        new OBJLoader().load(
          url,
          (obj) => {
            const geo = extractFirstGeometry(obj);
            if (geo) onGeometry(geo);
            else { setStatus("error"); }
          },
          undefined,
          () => setStatus("error")
        );
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  // --- 2. Fatiamento articulado ---
  const runSlicing = useCallback(() => {
    if (!sourceGeometry) return;
    setStatus("slicing");

    // roda no próximo tick pra UI atualizar o estado "slicing" antes do
    // trabalho síncrono pesado do CSG travar a thread
    setTimeout(() => {
      try {
        const sliced = sliceMeshIntoSegments(sourceGeometry, {
          segments: config.segments,
          gap: config.gap,
          hingeSizeRatio: config.hingeSizeRatio,
        });
        setSegmentsPreview(sliced);
        setStatus("ready");
      } catch (err) {
        console.error("Slicing failed:", err);
        setStatus("error");
      }
    }, 30);
  }, [sourceGeometry, config]);

  // --- 3. Junção com peg/socket + export STL ---
  const handleExportSTL = () => {
    if (segmentsPreview.length === 0) return;
    try {
      const jointed = jointArticulatedSegments(
        segmentsPreview,
        config.gap,
        config.hingeSizeRatio,
        addPegSocketJoint
      );

      const merged = BufferGeometryUtils.mergeGeometries(jointed);
      const mesh = new THREE.Mesh(merged);
      const group = new THREE.Group();
      group.add(mesh);

      const exporter = new STLExporter();
      const result = exporter.parse(group, { binary: true });
      const blob = new Blob([result], { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `flexi-from-photo-${config.segments}-segments-${Date.now()}.stl`;
      link.click();

      showNotification("STL Flexi (a partir da foto) exportado com sucesso!");
    } catch (err) {
      console.error("Export failed:", err);
      toastExportError();
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#080808]">
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-[#0c0c0c] border-r border-zinc-900 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center">
              <Waves className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Flexi From Photo</h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            Articula automaticamente um mesh gerado por foto (TripoSR/Hunyuan3D).
          </p>
        </header>

        {/* UPLOAD */}
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
            01. Importar Mesh (.glb / .obj)
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf,.obj"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-dashed border-zinc-700 hover:border-[#00E5FF]/50 rounded-xl py-6 flex flex-col items-center gap-2 text-zinc-500 hover:text-[#00E5FF] transition-all"
          >
            <UploadCloud className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {fileName || "Selecionar arquivo do pipeline foto→3D"}
            </span>
          </button>
          {status === "loading" && (
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando malha...
            </div>
          )}
          {status === "error" && (
            <div className="text-[10px] text-red-400">
              Não consegui ler esse arquivo. Confirme se é um .glb/.obj válido e manifold.
            </div>
          )}
        </section>

        {/* PARÂMETROS */}
        <section className="space-y-6 pt-4 border-t border-zinc-900">
          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#00E5FF]" />
              02. Segmentação
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Número de Segmentos</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.segments}</span>
              </div>
              <input
                type="range" min="3" max="24" step="1"
                value={config.segments}
                onChange={(e) => setConfig({ ...config, segments: parseInt(e.target.value) })}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Folga entre Segmentos</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{config.gap.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.05" max="0.5" step="0.01"
                value={config.gap}
                onChange={(e) => setConfig({ ...config, gap: parseFloat(e.target.value) })}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#00E5FF]" />
              03. Dobradiça
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-[9px] uppercase font-bold text-zinc-600">Proporção do Pino</label>
                <span className="text-[10px] font-mono text-[#00E5FF]">{Math.round(config.hingeSizeRatio * 100)}%</span>
              </div>
              <input
                type="range" min="0.3" max="0.8" step="0.05"
                value={config.hingeSizeRatio}
                onChange={(e) => setConfig({ ...config, hingeSizeRatio: parseFloat(e.target.value) })}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-[9px] text-zinc-600 leading-relaxed">
                Escala o pino como % do raio real de cada junção — se adapta a partes finas e grossas do desenho automaticamente.
              </p>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={runSlicing}
              disabled={!sourceGeometry || status === "slicing"}
              className="w-full bg-zinc-800 disabled:opacity-40 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-zinc-700 transition-all"
            >
              {status === "slicing"
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Fatiando...</>
                : "Gerar Articulação"}
            </button>

            <button
              onClick={handleExportSTL}
              disabled={segmentsPreview.length === 0}
              className="w-full bg-[#00E5FF] disabled:opacity-40 text-black py-4 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)]"
            >
              <Download className="w-4 h-4" />
              Download STL Flexi
            </button>
          </div>
        </section>
      </div>

      {/* VIEWPORT */}
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [30, 30, 30], fov: 45 }}>
            <color attach="background" args={["#080808"]} />
            <ambientLight intensity={0.5} />
            <spotLight position={[50, 50, 50]} angle={0.15} penumbra={1} castShadow />
            <pointLight position={[-50, -50, -50]} intensity={0.5} />
            <OrbitControls makeDefault />
            <Grid
              infiniteGrid
              fadeDistance={100}
              cellColor="#222"
              sectionColor="#444"
              cellSize={10}
              sectionSize={50}
              position={[0, -0.1, 0]}
            />
            <PreviewScene
              sourceGeometry={sourceGeometry}
              segments={segmentsPreview}
              baseColor={config.baseColor}
            />
          </Canvas>
        </div>

        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md border border-zinc-900 p-4 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {segmentsPreview.length > 0 ? "Preview Articulado" : "Preview do Mesh Original"}
              </span>
            </div>
            <div className="text-[16px] font-black text-white uppercase tracking-tighter">
              {segmentsPreview.length > 0
                ? `${segmentsPreview.length} Segmentos Fatiados`
                : sourceGeometry ? "Mesh carregado — clique em Gerar Articulação" : "Aguardando upload"}
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-500 text-black px-6 py-3 rounded-full flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-2xl">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewScene({
  sourceGeometry,
  segments,
  baseColor,
}: {
  sourceGeometry: THREE.BufferGeometry | null;
  segments: SegmentData[];
  baseColor: string;
}) {
  // enquanto não fatiou, mostra a malha original crua (referência visual)
  if (segments.length === 0) {
    if (!sourceGeometry) return null;
    return (
      <Center>
        <mesh geometry={sourceGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#666" roughness={0.6} metalness={0.1} wireframe={false} />
        </mesh>
      </Center>
    );
  }

  // depois de fatiado, mostra cada segmento com um leve espaçamento visual
  // artificial ao longo do eixo, só para deixar as juntas visíveis no preview
  // (o STL exportado usa as posições reais calculadas no slicing)
  return (
    <Center>
      <group>
        {segments.map((seg, idx) => (
          <mesh key={idx} geometry={seg.geometry} castShadow receiveShadow>
            <meshStandardMaterial
              color={idx % 2 === 0 ? baseColor : "#ffffff"}
              roughness={0.4}
              metalness={0.2}
            />
          </mesh>
        ))}
      </group>
    </Center>
  );
}
