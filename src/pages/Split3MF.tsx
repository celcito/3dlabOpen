import { useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSplit3MFState } from "../hooks/useSplit3MFState";
import { parseSplitFile } from "../lib/split3mf/parsers";
import { segmentGeometry } from "../lib/split3mf/segmentation/gpuSegmenter";
import { exportSplit, splitPieces } from "../lib/split3mf/exporters";
import type { ExportPiece } from "../lib/split3mf/exporters";
import { buildConnectorPrimitive, findBoundaryEdges, placementMatrix, planConnectorPlacements } from "../lib/split3mf/engines/connectorEngine";
import { buildDisplayGeometry } from "../lib/split3mf/display/displayGeometry";
import { SplitPanel } from "../../components/split3mf/SplitPanel";
import { CapMethodPicker } from "../../components/split3mf/CapMethodPicker";
import { ConnectorPicker } from "../../components/split3mf/ConnectorPicker";
import { SplitExportBar } from "../../components/split3mf/SplitExportBar";
import BoundaryBrush from "../../components/split3mf/BoundaryBrush";
import BoundaryLines from "../../components/split3mf/BoundaryLines";
import type { ParsedSplitFile } from "../lib/split3mf/state/splitTypes";
import type { ConnectorConfig } from "../lib/split3mf/state/splitTypes";
import { RotateCcw, Loader2, Brush, MousePointer2, Check, X } from "lucide-react";

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
  const [selectionMode, setSelectionMode] = useState<"paint" | "click">("paint");
  const [platePreview, setPlatePreview] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<number[]>([]);
  const previewPieces = useMemo(() => splitPieces(state), [state]);

  const sceneGeom = useMemo(() => {
    const display = buildDisplayGeometry({
        geometry: state.geometry,
        regionMask: state.regionMask,
        regions: state.regions,
        rawColors: state.regionMask ? null : state.geometry?.colors ?? null,
      });

    // 3MF uses Z as the print-up axis while Three.js displays Y up.
    if (display.attributes.position && fileName?.toLowerCase().endsWith(".3mf")) {
      display.setAttribute("position", display.attributes.position.clone());
      if (display.attributes.normal) display.setAttribute("normal", display.attributes.normal.clone());
      display.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    }
    return display;
  }, [state.geometry, state.regionMask, state.regions, fileName]);

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
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-pressed={selectionMode === "paint"}
          onClick={() => {
            setSelectionMode("paint");
            setPendingSelection([]);
          }}
          className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors ${selectionMode === "paint" ? "border-[#632CE5] bg-[#632CE5] text-white" : "border-[#D8D0F0] bg-white text-[#632CE5] hover:bg-[#F7F4FF]"}`}
        >
          Pintura
        </button>
        <button
          type="button"
          aria-pressed={selectionMode === "click"}
          onClick={() => {
            setSelectionMode("click");
            setPendingSelection([]);
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors ${selectionMode === "click" ? "border-[#632CE5] bg-[#632CE5] text-white" : "border-[#D8D0F0] bg-white text-[#632CE5] hover:bg-[#F7F4FF]"}`}
        >
          <MousePointer2 className="h-3.5 w-3.5" /> Clique
        </button>
      </div>
      <div className="rounded-lg border border-[#D8D0F0] bg-[#F7F4FF] p-3 text-[11px] text-[#494455]">
        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#632CE5]">Como separar</div>
        <ol className="space-y-1.5">
          <li><b>1.</b> Crie uma região para cada peça.</li>
          <li><b>2.</b> Selecione a região e clique na peça ou pinte sua superfície.</li>
          <li><b>3.</b> Repita para as outras peças e exporte.</li>
        </ol>
      </div>
      {selectionMode === "click" && pendingSelection.length > 0 && (
        <div className="rounded-lg border border-[#FFD166] bg-[#FFF8E1] p-3 text-[11px] text-[#5C4810] space-y-2">
          <p><b>{pendingSelection.length} parte(s) selecionada(s).</b> Você pode clicar em outras partes antes de confirmar.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                split.selectComponents(pendingSelection);
                setPendingSelection([]);
                setPlatePreview(true);
              }}
              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-[#00C853] px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-white hover:bg-[#00B34A]"
            >
              <Check className="h-3.5 w-3.5" /> Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPendingSelection([])}
              className="flex-1 flex items-center justify-center gap-1 rounded-md border border-[#D4B45C] px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#5C4810] hover:bg-[#FFF1BD]"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}
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
        {selectionMode === "click" && <p><b className="text-[#1A1C19]">Clique esquerdo</b> — selecionar a peça conectada inteira</p>}
        {selectionMode === "paint" && <p><b className="text-[#1A1C19]">Esquerda (arrastar)</b> — pintar a região ativa</p>}
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
          openBoundaryKey={geometryEpoch}
        />

        <div data-testid="split3mf-viewport" className="workbench-viewport flex-1 min-w-0 min-h-0 relative bg-[#F3F4EE] h-full flex flex-col">
          <div className="workbench-viewport flex-1 w-full relative overflow-hidden bg-[#F3F4EE]">
          {/* Viewport header — anchors the 3D area as a clearly bounded viewport. */}
          <div className="absolute top-6 left-6 z-20 px-3.5 py-2.5 bg-[#F9FAF4]/85 border border-[#E8E9E3] backdrop-blur-md rounded text-[10px] uppercase tracking-wider text-zinc-500 space-y-1.5 pointer-events-none select-none">
            <div className="text-[#632CE5] font-bold text-[11px] mb-1">3D Navigation Guide</div>
            <div>Left Click + Drag: <span className="font-bold">{selectionMode === "click" ? "Select Connected Piece" : state.regions.length ? "Paint Model" : "Rotate Camera"}</span></div>
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
              {platePreview && previewPieces.length > 0 ? (
                <PlateScene
                  pieces={previewPieces}
                  is3mf={fileName?.toLowerCase().endsWith(".3mf") ?? false}
                  sourceGeometry={state.geometry}
                  regionMask={state.regionMask}
                  connectorConfig={state.connectorConfig}
                />
              ) : (
              <SplitScene
                key={`${sceneGeom.uuid}-${geometryEpoch}`}
                geometry={sceneGeom}
                regionMask={state.regionMask}
                activeRegionColor={activeRegionColor(state)}
                brushRadius={state.boundary.brushRadius}
                brushEnabled={selectionMode === "click" || state.regions.length > 0}
                selectMode={selectionMode === "click"}
                onEdit={(e) => split.applyBoundaryBrush(e.kind, e.vertexIndex, brushRadiusHops)}
                onEditComplete={() => {
                  if (state.regionMask && countPainted(state.regionMask) > 0) setPlatePreview(true);
                }}
                onSelect={(vertexIndex) =>
                  setPendingSelection((current) =>
                    current.includes(vertexIndex)
                      ? current.filter((index) => index !== vertexIndex)
                      : [...current, vertexIndex]
                  )
                }
                selectedVertices={pendingSelection}
              />
              )}
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
              {platePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPlatePreview(false);
                    setPendingSelection([]);
                  }}
                  className="rounded-xl border border-[#3A3C38] bg-[#2A2C28]/90 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#E8E9E3] hover:bg-[#3A3C38]"
                >
                  Editar separação
                </button>
              )}
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
  brushEnabled,
  selectMode,
  onEdit,
  onEditComplete,
  onSelect,
  selectedVertices,
}: {
  geometry: THREE.BufferGeometry;
  regionMask: Uint8Array;
  activeRegionColor: string;
  brushRadius: number;
  brushEnabled: boolean;
  selectMode: boolean;
  onEdit: (e: { vertexIndex: number; kind: "pull" | "push" }) => void;
  onEditComplete: () => void;
  onSelect: (vertexIndex: number) => void;
  selectedVertices: number[];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  return (
    <>
      {/* Bounds + model + boundary lines live inside one tree so the camera
          fits the geometry on every fresh model load (Canvas re-mounts). The
          brush sphere stays outside so its motion never distorts the bounds. */}
      <Bounds fit clip margin={1.15} maxDuration={0.2}>
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
        <SelectionMarkers geometry={geometry} vertexIndices={selectedVertices} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          dampingFactor={0}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          panSpeed={0.8}
        />
      </Bounds>
      <Grid infiniteGrid fadeDistance={100} cellColor="#222" sectionColor="#444" cellSize={10} sectionSize={50} />
      <BoundaryBrush
        geometry={geometry}
        meshRef={meshRef}
        activeRegionColor={activeRegionColor}
        brushRadius={brushRadius}
        enabled={brushEnabled}
        selectMode={selectMode}
        onEdit={onEdit}
        onEditComplete={onEditComplete}
        onSelect={onSelect}
      />
    </>
  );
}

function SelectionMarkers({ geometry, vertexIndices }: { geometry: THREE.BufferGeometry; vertexIndices: number[] }) {
  const position = geometry.attributes.position;
  const radius = useMemo(() => {
    geometry.computeBoundingSphere();
    return Math.max((geometry.boundingSphere?.radius ?? 1) * 0.045, 0.03);
  }, [geometry]);

  return (
    <group>
      {vertexIndices.map((vertexIndex) => (
        <mesh
          key={vertexIndex}
          position={[position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex)]}
          renderOrder={1000}
        >
          <sphereGeometry args={[radius, 12, 12]} />
          <meshBasicMaterial color="#FFD166" depthTest={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function PlateScene({
  pieces,
  is3mf,
  sourceGeometry,
  regionMask,
  connectorConfig,
}: {
  pieces: ExportPiece[];
  is3mf: boolean;
  sourceGeometry: ReturnType<typeof useSplit3MFState>["state"]["geometry"];
  regionMask: Uint8Array | null;
  connectorConfig: ConnectorConfig;
}) {
  const layout = useMemo(() => {
    const rotation = new THREE.Matrix4().makeRotationX(is3mf ? Math.PI / 2 : 0);
    const prepared = pieces.map((piece) => {
      const geometry = piece.geometry.clone();
      if (is3mf) {
        geometry.setAttribute("position", geometry.attributes.position.clone());
        if (geometry.attributes.normal) geometry.setAttribute("normal", geometry.attributes.normal.clone());
        geometry.applyMatrix4(rotation);
      }
      geometry.computeBoundingBox();
      return { piece, geometry, box: geometry.boundingBox!.clone() };
    });
    const maxWidth = Math.max(10, ...prepared.map(({ box }) => box.max.x - box.min.x));
    const maxDepth = Math.max(10, ...prepared.map(({ box }) => box.max.z - box.min.z));
    const columns = Math.min(3, Math.max(1, prepared.length));
    const rows = Math.ceil(prepared.length / columns);
    const slotX = maxWidth * 1.45;
    const slotZ = maxDepth * 1.45;
    const plateWidth = Math.max(20, columns * slotX + maxWidth * 0.5);
    const plateDepth = Math.max(20, rows * slotZ + maxDepth * 0.5);
    return {
      plateWidth,
      plateDepth,
      pieces: prepared.map((entry, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = (column - (columns - 1) / 2) * slotX;
        const z = (row - (rows - 1) / 2) * slotZ;
        const center = entry.box.getCenter(new THREE.Vector3());
        const bottom = entry.box.min.y;
        entry.geometry.translate(x - center.x, 0.12 - bottom, z - center.z);
        return { ...entry, translation: new THREE.Vector3(x - center.x, 0.12 - bottom, z - center.z) };
      }),
    };
  }, [pieces, is3mf]);

  const connectorPreview = useMemo(() => {
    if (connectorConfig.type === "none" || !sourceGeometry?.indices || !regionMask) return [];
    const edges = findBoundaryEdges(sourceGeometry.positions, sourceGeometry.indices, regionMask);
    const placements = planConnectorPlacements(edges, Math.min(4, edges.length), {
      type: connectorConfig.type,
      areaPercent: connectorConfig.areaPercent,
      depthMm: connectorConfig.depthMm,
      socketToleranceMm: connectorConfig.socketToleranceMm,
      side: connectorConfig.side,
      manualPositions: connectorConfig.position === "manual"
        ? connectorConfig.manualPositions?.map((position) => ({
            ...position,
            point: new THREE.Vector3(...position.point),
          }))
        : undefined,
    });
    const translations = new Map(layout.pieces.map(({ piece, translation }) => [piece.regionId, translation]));
    return placements.flatMap((placement, index) => {
      const plugTranslation = translations.get(connectorConfig.side === "part_plug" ? placement.regionA : placement.regionB);
      const socketTranslation = translations.get(connectorConfig.side === "part_plug" ? placement.regionB : placement.regionA);
      if (!plugTranslation || !socketTranslation) return [];
      const socketArea = placement.area * (1 + connectorConfig.socketToleranceMm / Math.sqrt(placement.area));
      const makeGeometry = (area: number, depth: number, translation: THREE.Vector3) => {
        const geometry = buildConnectorPrimitive(connectorConfig.type, area, depth);
        const point = placement.point.clone().add(translation);
        const matrix = placementMatrix({ ...placement, point });
        geometry.applyMatrix4(matrix);
        return geometry;
      };
      return [
        { key: `plug-${index}`, geometry: makeGeometry(placement.area, placement.depth, plugTranslation), color: "#00C853", opacity: 0.9 },
        { key: `socket-${index}`, geometry: makeGeometry(socketArea, placement.depth + connectorConfig.socketToleranceMm, socketTranslation), color: "#FF9100", opacity: 0.38 },
      ];
    });
  }, [connectorConfig, layout.pieces, regionMask, sourceGeometry]);

  return (
    <Bounds fit clip margin={1.15} maxDuration={0.2}>
      <color attach="background" args={["#F3F4EE"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[30, 50, 20]} intensity={1.2} />
      <group>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[layout.plateWidth, 0.2, layout.plateDepth]} />
          <meshStandardMaterial color="#D8DAD2" roughness={0.85} />
        </mesh>
        {layout.pieces.map(({ piece, geometry }) => (
          <mesh key={piece.regionId} geometry={geometry}>
            <meshStandardMaterial color={piece.color} roughness={0.48} metalness={0.08} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {connectorPreview.map(({ key, geometry, color, opacity }) => (
          <mesh key={key} geometry={geometry} renderOrder={20}>
            <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <Grid infiniteGrid fadeDistance={100} cellColor="#222" sectionColor="#444" cellSize={10} sectionSize={50} />
      <OrbitControls makeDefault enableDamping={false} dampingFactor={0} rotateSpeed={0.7} zoomSpeed={0.8} panSpeed={0.8} />
    </Bounds>
  );
}

function activeRegionColor(state: ReturnType<typeof useSplit3MFState>["state"]): string {
  const id = state.boundary.activeRegionId;
  const found = state.regions.find((r) => r.id === id);
  return found?.color ?? "#FFFFFF";
}
