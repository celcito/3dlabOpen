import { useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSplit3MFState } from "../hooks/useSplit3MFState";
import { parseSplitFile } from "../lib/split3mf/parsers";
import { segmentGeometry } from "../lib/split3mf/segmentation/gpuSegmenter";
import { exportSplit } from "../lib/split3mf/exporters";
import { buildDisplayGeometry } from "../lib/split3mf/display/displayGeometry";
import { SplitPanel } from "../../components/split3mf/SplitPanel";
import { CapMethodPicker } from "../../components/split3mf/CapMethodPicker";
import { ConnectorPicker } from "../../components/split3mf/ConnectorPicker";
import { SplitExportBar } from "../../components/split3mf/SplitExportBar";
import BoundaryBrush from "../../components/split3mf/BoundaryBrush";
import BoundaryLines from "../../components/split3mf/BoundaryLines";
import type { ParsedSplitFile } from "../lib/split3mf/state/splitTypes";
import { RotateCcw, Loader2, Brush } from "lucide-react";

const BRUSH_COLORS = ["#632CE5", "#FF1744", "#00FF41", "#D500F9", "#FF9100", "#FFEA00", "#2979FF", "#FF4081"];

export default function Split3MF() {
  const split = useSplit3MFState();
  const { state } = split;
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTone, setErrorTone] = useState<"error" | "warn">("error");
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem("split3mf.onboardingSeen");
    } catch {
      return false;
    }
  });
  // Counter that bumps when a new model is loaded so <Bounds> re-fits the camera.
  const [geometryEpoch, setGeometryEpoch] = useState(0);

  const sceneGeom = useMemo(
    () =>
      buildDisplayGeometry({
        geometry: state.geometry,
        regionMask: state.regionMask,
        regions: state.regions,
        rawColors: state.regionMask ? null : state.geometry?.colors ?? null,
      }),
    [state.geometry, state.regionMask, state.regions]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
         const parsed = await parseSplitFile(file);
         const position = parsed.geometry.getAttribute("position");
         if (!position || position.count === 0 || parsed.geometry.index?.count === 0) {
           throw new Error("The file contains no renderable triangles");
         }
         split.loadFile(parsed);
        setFileName(file.name);
        setGeometryEpoch((n) => n + 1);

        // Auto-segment by color when the parser didn't produce a region mask
        // but the mesh carries vertex colors (e.g. GLB with painted colors).
        if (!parsed.regionMask && parsed.geometry.attributes.color) {
          const segOk = await autoSegment(parsed);
          if (!segOk) {
            setParserHint(file);
          }
        } else if (!parsed.regionMask) {
          setParserHint(file);
        }
      } catch (err) {
        console.error("Split3MF parse failed:", err);
        split.reset();
        setFileName(null);
        setErrorTone("error");
        const reason = err instanceof Error ? err.message : "erro desconhecido";
        setError(`Não foi possível interpretar o arquivo: ${reason}`);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [split.loadFile]
  );

  const setParserHint = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "obj") {
      setErrorTone("warn");
      setError("OBJ sem grupos detectados — crie regiões manualmente na aba Fronteira.");
    } else {
      setErrorTone("warn");
      setError("Sem regiões pintadas — crie regiões manualmente na aba Fronteira.");
    }
  };

  const autoSegment = async (parsed: ParsedSplitFile): Promise<boolean> => {
    try {
      const stats = segmentGeometry(parsed.geometry);
      if (stats.regionCount === 0) return false;
      const regions = stats.regionColors.map((color, i) => ({
        id: i + 1,
        color,
        name: `Região ${i + 1}`,
        vertexCount: stats.regionSizes[i] ?? 0,
        boundaryEdges: stats.boundaryEdgeCount,
      }));
      split.setRegionMask(stats.regionMask, regions);
      return true;
    } catch (err) {
      console.error("Auto-segmentation failed:", err);
      setErrorTone("error");
      setError("Segmentação por cor falhou. Crie regiões manualmente na aba Fronteira.");
      return false;
    }
  };

  const brushRadiusHops = Math.max(1, Math.round(state.boundary.brushRadius / 3));

  const handleExport = useCallback(
    async (options: { format: "3mf" | "glb" | "obj" | "stl"; includeConnectors: boolean; capPieces: boolean }) => {
      setExporting(true);
      try {
        const blob = await exportSplit(state, {
          format: options.format,
          includeConnectors: options.includeConnectors,
          capPieces: options.capPieces,
          filename: "split",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `split.${options.format === "obj" ? "zip" : options.format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (err) {
        console.error("Split3MF export failed:", err);
        setErrorTone("error");
        setError("A exportação falhou. Reduza os conectores/caps ou tente outro formato.");
      } finally {
        setExporting(false);
      }
    },
    [state]
  );

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem("split3mf.onboardingSeen", "1");
    } catch {
      /* noop */
    }
  };

  const addRegion = () => {
    const id = state.regions.length + 1;
    const color = BRUSH_COLORS[(id - 1) % BRUSH_COLORS.length];
    const next = [...state.regions, { id, color, name: `Região ${id}`, vertexCount: 0, boundaryEdges: 0 }];
    // Painting needs a mask; initialize an empty one (all base) on first region.
    if (!state.regionMask && state.geometry) {
      split.setRegionMask(new Uint8Array(state.geometry.positions.length / 3), next);
    } else {
      split.setRegions(next);
    }
    split.setBoundary({ activeRegionId: id });
  };

  const brushControls = (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#D8D0F0] bg-[#F7F4FF] p-3 text-[11px] text-[#494455]">
        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#632CE5]">Como separar</div>
        <ol className="space-y-1.5">
          <li><b>1.</b> Crie uma região para cada peça.</li>
          <li><b>2.</b> Selecione a região e pinte sua superfície.</li>
          <li><b>3.</b> Repita para as outras peças e exporte.</li>
        </ol>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[#7A7487] font-bold mb-2">Região ativa</div>
        <div className="flex flex-wrap gap-1.5">
          {state.regions.length === 0 && (
            <span className="text-[11px] text-[#7A7487] italic">Nenhuma região pintada ainda</span>
          )}
          {state.regions.map((r) => (
            <button
              key={r.id}
              onClick={() => split.setBoundary({ activeRegionId: r.id })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                state.boundary.activeRegionId === r.id
                  ? "border-[#632CE5] bg-[#632CE5]/10 text-[#1A1C19]"
                  : "border-[#E8E9E3] bg-white text-[#494455]"
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: r.color }} />
              {r.name}
            </button>
          ))}
        </div>
        {state.regions.length < 8 && (
          <button
            onClick={addRegion}
            className="mt-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[#632CE5] text-[#632CE5] hover:bg-[#632CE5]/5"
          >
            + Nova região
          </button>
        )}
      </div>

      <div className="bg-[#F2F0F5] rounded-lg p-3 text-[11px] text-[#494455] space-y-1">
        <p><b className="text-[#1A1C19]">Esquerda (arrastar)</b> — pintar a região ativa</p>
        <p><b className="text-[#1A1C19]">Direita (arrastar)</b> — apagar pintura da fronteira</p>
        <p><b className="text-[#1A1C19]">Botão direito + arrastar</b> — girar a câmera</p>
        <p>Roda do mouse — zoom. Botão do meio — mover.</p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-wider text-[#7A7487] font-bold">Raio do pincel</span>
          <span className="font-mono text-[11px] text-[#1A1C19]">{state.boundary.brushRadius} mm</span>
        </div>
        <input
          type="range"
          min={1}
          max={18}
          step={1}
          value={state.boundary.brushRadius}
          onChange={(e) => split.setBoundary({ brushRadius: Number(e.target.value) })}
          className="w-full accent-[#632CE5]"
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-wider text-[#7A7487] font-bold">Suavização</span>
          <span className="font-mono text-[11px] text-[#1A1C19]">{state.boundary.smoothness}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={state.boundary.smoothness}
          onChange={(e) => split.setBoundary({ smoothness: Number(e.target.value) })}
          className="w-full accent-[#632CE5]"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={split.smoothBoundaries}
          disabled={!state.regionMask}
          className="flex-1 py-1.5 rounded-lg bg-[#632CE5] text-white text-[11px] font-bold hover:bg-[#7C4DFF] disabled:opacity-40"
        >
          Suavizar bordas
        </button>
        <button
          onClick={split.undo}
          disabled={!split.canUndo}
          className="flex-1 py-1.5 rounded-lg border border-[#CAC3D8] text-[#494455] text-[11px] font-bold hover:bg-[#F2F0F5] disabled:opacity-40"
        >
          Desfazer
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showOnboarding && (
        <div className="shrink-0 bg-[#632CE5] text-white px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-[12px]">
            <b>Bem-vindo ao Split 3MF</b> — importe um modelo colorido, pinte fronteiras e exporte peças
            separadas em 3MF / GLB / OBJ / STL.
          </p>
          <button
            onClick={dismissOnboarding}
            className="shrink-0 text-[11px] font-bold uppercase tracking-wider bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5"
          >
            Entendi
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <SplitPanel
          fileName={fileName}
          onFile={handleFile}
          loading={loading}
          error={error}
          errorTone={errorTone}
          onDismissError={() => setError(null)}
          hasRegionMask={!!state.regionMask}
          brushInstructions={brushControls}
          cap={<CapMethodPicker capConfig={state.capConfig} onChange={split.setCapConfig} />}
          connector={
            <ConnectorPicker connectorConfig={state.connectorConfig} onChange={split.setConnectorConfig} />
          }
          exportBar={
            <SplitExportBar disabled={!state.geometry || exporting} onExport={handleExport} />
          }
        />

        <div data-testid="split3mf-viewport" className="flex-1 min-w-0 min-h-0 relative bg-[#F9FAF4] p-3 h-full flex flex-col">
          <div className="flex-1 w-full border border-[#E8E9E3] rounded-lg relative overflow-hidden bg-[#F9FAF4] bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:20px_20px]">
          {/* Viewport header — anchors the 3D area as a clearly bounded viewport. */}
          <div className="absolute top-6 left-6 z-20 px-3.5 py-2.5 bg-[#F9FAF4]/85 border border-[#E8E9E3] backdrop-blur-md rounded text-[10px] uppercase tracking-wider text-zinc-500 space-y-1.5 pointer-events-none select-none">
            <div className="text-[#632CE5] font-bold text-[11px] mb-1">3D Navigation Guide</div>
            <div>Left Click + Drag: <span className="font-bold">{state.regions.length ? "Paint Model" : "Rotate Camera"}</span></div>
            <div>Right Click + Drag: <span className="font-bold">Rotate Camera</span></div>
            <div>Scroll Wheel: <span className="font-bold">Zoom In / Out</span></div>
            <div>Middle Click + Drag: <span className="font-bold">Pan Camera</span></div>
          </div>
          {!state.geometry ? (
            loading ? (
              <LoadingOverlay message={`Processando ${fileName ?? "arquivo"}…`} />
            ) : (
              <EmptyState
                title="Nenhum modelo carregado"
                subtitle="Arraste um 3MF, GLB ou OBJ no painel Importar para começar."
              />
            )
          ) : (
            <Canvas
              shadows
              dpr={[1, 2]}
              className="absolute inset-0"
              camera={{ position: [4, 3, 4], fov: 45 }}
              onCreated={({ camera, gl }) => {
                camera.lookAt(0, 0, 0);
                gl.setClearColor("#F3F4EE", 1);
              }}
              frameloop="always"
            >
              <SplitScene
                key={`${sceneGeom.uuid}-${geometryEpoch}`}
                geometry={sceneGeom}
                regionMask={state.regionMask}
                activeRegionColor={activeRegionColor(state)}
                brushRadius={state.boundary.brushRadius}
                onEdit={(e) => split.applyBoundaryBrush(e.kind, e.vertexIndex, brushRadiusHops)}
              />
            </Canvas>
          )}

          {/* Loading overlay while geometry is being re-meshed (e.g. segmenting). */}
          {state.geometry && loading && <LoadingOverlay message="Segmentando modelo…" />}

          {/* Hint when the model is loaded but nothing is painted yet. Positioned to the
              bottom-left so it never covers the 3D viewport. */}
          {state.geometry && !loading && countPaintedOrEmpty(state.regionMask, state.regions.length) === 0 && (
            <div className="absolute left-4 bottom-4 max-w-xs pointer-events-none">
              <div className="bg-[#2A2C28]/90 backdrop-blur-md border border-[#3A3C38] rounded-xl px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2 text-[#00C853]">
                  <Brush size={14} strokeWidth={2.5} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Pronto para pintar</span>
                </div>
                <div className="text-[11px] text-[#E8E9E3] mt-1 leading-snug">
                  Crie uma região na aba <b className="text-white">Fronteira</b> e arraste o pincel sobre o modelo
                  (esquerda puxa, direita empurra).
                </div>
              </div>
            </div>
          )}

          {/* Overlay stats + actions */}
          {state.geometry && (
            <div className="absolute top-4 right-4 flex items-start gap-2 z-20">
              <button
                type="button"
                title="Recentrar câmera"
                onClick={() => setGeometryEpoch((n) => n + 1)}
                className="shrink-0 bg-[#2A2C28]/90 hover:bg-[#3A3C38] backdrop-blur-md border border-[#3A3C38] rounded-xl w-10 h-10 flex items-center justify-center text-[#E8E9E3] hover:text-white shadow-lg"
              >
                <RotateCcw size={16} strokeWidth={2.2} />
              </button>
              <div className="bg-[#2A2C28]/90 backdrop-blur-md border border-[#3A3C38] rounded-xl px-4 py-3 shadow-lg">
                <div className="text-[9px] font-black uppercase tracking-widest text-[#A5A59F]">
                  {state.regions.length} regiões ·{" "}
                  {state.regions.length === 0
                    ? "sem regiões"
                    : state.regionMask
                    ? `${countPainted(state.regionMask)}% pintado`
                    : "pronto para pintar"}
                </div>
                <div className="text-[16px] font-black text-white uppercase tracking-tighter mt-0.5">
                  {fileName ?? "Split 3MF"}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function countPainted(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) if (v !== 0) n++;
  return Math.round((n / mask.length) * 100);
}

/** True when the user hasn't painted anything yet: either no regions exist,
 *  no mask is set, or every vertex is still region 0 (base). */
function countPaintedOrEmpty(mask: Uint8Array | null, regionCount: number): number {
  if (regionCount === 0) return 0;
  if (!mask) return 0;
  return countPainted(mask);
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#1A1C19]/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-3 bg-[#2A2C28] border border-[#3A3C38] rounded-xl px-5 py-3 shadow-md">
        <Loader2 className="w-5 h-5 text-[#00C853] animate-spin" />
        <span className="text-[12px] font-semibold text-[#E8E9E3]">{message}</span>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 pointer-events-none">
      <div className="w-16 h-16 rounded-2xl bg-[#2A2C28] border border-[#3A3C38] flex items-center justify-center text-[#00C853]">
        <Scaff3d />
      </div>
      <div className="text-[16px] font-black text-[#E8E9E3] uppercase tracking-tighter">{title}</div>
      <div className="text-[12px] text-[#A5A59F] max-w-sm">{subtitle}</div>
    </div>
  );
}

function Scaff3d() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  );
}

/** Simple imported-model scene (no mask yet, shows raw colors). */
function SplitScene({
  geometry,
  regionMask,
  activeRegionColor,
  brushRadius,
  onEdit,
}: {
  geometry: THREE.BufferGeometry;
  regionMask: Uint8Array;
  activeRegionColor: string;
  brushRadius: number;
  onEdit: (e: { vertexIndex: number; kind: "pull" | "push" }) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  return (
    <>
      {/* Bounds + model + boundary lines live inside one tree so the camera
          fits the geometry on every fresh model load (Canvas re-mounts). The
          brush sphere stays outside so its motion never distorts the bounds. */}
      <Bounds fit clip margin={1.9} maxDuration={0.2}>
        <color attach="background" args={["#F3F4EE"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[30, 50, 20]} intensity={1} />
        <pointLight position={[-30, -20, -30]} intensity={0.4} />
        <mesh ref={meshRef} geometry={geometry}>
          <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} side={THREE.DoubleSide} />
        </mesh>
        <BoundaryLines
          regionMask={regionMask}
          geometry={geometry}
          regions={undefined}
        />
        <OrbitControls makeDefault />
      </Bounds>
      <Grid infiniteGrid fadeDistance={30} sectionColor="#333" cellColor="#111" />
      <BoundaryBrush
        geometry={geometry}
        meshRef={meshRef}
        activeRegionColor={activeRegionColor}
        brushRadius={brushRadius}
        onEdit={onEdit}
      />
    </>
  );
}

function activeRegionColor(state: ReturnType<typeof useSplit3MFState>["state"]): string {
  const id = state.boundary.activeRegionId;
  const found = state.regions.find((r) => r.id === id);
  return found?.color ?? "#FFFFFF";
}
