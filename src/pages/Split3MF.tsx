import { useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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
        split.loadFile(parsed);
        setFileName(file.name);

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
        setErrorTone("error");
        setError(
          "Não foi possível interpretar este arquivo. Use um .3mf pintado, .glb com cores de vértice ou .obj com grupos."
        );
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
      const stats = segmentGeometry(parsed.geometry, { forceCpu: true });
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
        <p><b className="text-[#1A1C19]">Esquerda (arrastar)</b> — puxar para a região ativa</p>
        <p><b className="text-[#1A1C19]">Direita (arrastar)</b> — empurrar pintura da fronteira</p>
        <p>Role sobre o modelo para aplicar o pincel.</p>
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

        <div className="flex-1 relative bg-[#F3F4EE]">
          {!state.geometry ? (
            <EmptyState
              title="Nenhum modelo carregado"
              subtitle="Arraste um 3MF, GLB ou OBJ no painel Importar para começar."
            />
          ) : (
            <Canvas
              dpr={[1, 2]}
              camera={{ position: [40, 30, 40], fov: 45 }}
            >
              <SplitScene
                geometry={sceneGeom}
                regionMask={state.regionMask}
                activeRegionId={state.boundary.activeRegionId}
                brushRadius={state.boundary.brushRadius}
                onEdit={(e) => split.applyBoundaryBrush(e.kind, e.vertexIndex, brushRadiusHops)}
              />
            </Canvas>
          )}

          {/* Empty state: model loaded, nothing painted yet */}
          {state.geometry && state.regionMask && countPainted(state.regionMask) === 0 && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <EmptyState
                title="Sem regiões pintadas"
                subtitle="Pinte para começar: crie uma região e arraste o pincel (esquerda puxa, direita empurra)."
              />
            </div>
          )}

          {/* Overlay stats */}
          {state.geometry && (
            <div className="absolute top-4 right-4 pointer-events-none">
              <div className="bg-white/80 backdrop-blur-md border border-[#E2E3DD] rounded-xl px-4 py-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-[#7A7487]">
                  {state.regions.length} regiões ·{" "}
                  {state.regionMask ? countPainted(state.regionMask) : "sem máscara"}
                  % pintado
                </div>
                <div className="text-[16px] font-black text-[#1A1C19] uppercase tracking-tighter mt-0.5">
                  {fileName ?? "Split 3MF"}
                </div>
              </div>
            </div>
          )}
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

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[#E8E9E3] flex items-center justify-center text-[#632CE5]">
        <Scaff3d />
      </div>
      <div className="text-[16px] font-black text-[#1A1C19] uppercase tracking-tighter">{title}</div>
      <div className="text-[12px] text-[#7A7487] max-w-sm">{subtitle}</div>
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
  activeRegionId,
  brushRadius,
  onEdit,
}: {
  geometry: THREE.BufferGeometry;
  regionMask: Uint8Array;
  activeRegionId: number;
  brushRadius: number;
  onEdit: (e: { vertexIndex: number; kind: "pull" | "push" }) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  return (
    <group>
      <color attach="background" args={["#F3F4EE"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 50, 20]} intensity={1} />
      <pointLight position={[-30, -20, -30]} intensity={0.4} />
      <mesh
        ref={meshRef}
        geometry={geometry}
      >
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <BoundaryLines
        regionMask={regionMask}
        geometry={geometry}
        regions={undefined}
      />
      <BoundaryBrush
        geometry={geometry}
        meshRef={meshRef}
        activeRegionId={activeRegionId}
        brushRadius={brushRadius}
        onEdit={onEdit}
      />
      <OrbitControls makeDefault />
    </group>
  );
}