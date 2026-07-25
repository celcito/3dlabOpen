import { useState, useMemo } from "react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { CutLoop, detectBoundaryEdges, computeGroupCentroids, computeLoopLength } from "@/lib/geometryUtils";
import { Ruler, Printer, Download, RefreshCw, Info, Loader2 } from "lucide-react";

const TOLERANCE_PRESETS = [
  { id: "fdm_standard", label: "FDM Standard", tolerance: 0.15, xy: 0.10 },
  { id: "fdm_tight", label: "FDM Tight", tolerance: 0.08, xy: 0.05 },
  { id: "sla_standard", label: "SLA Standard", tolerance: 0.05, xy: 0.02 },
];

const CONNECTOR_TYPES = [
  { id: "dovetail", label: "Dovetail", desc: "Trapezoidal interlock" },
  { id: "plug", label: "Plug", desc: "Polygon peg + hole" },
  { id: "dowel", label: "Dowel", desc: "Separate pin + holes" },
];

const PLUG_SHAPES = [
  { id: "triangle", label: "Triangle" },
  { id: "square", label: "Square" },
  { id: "hexagon", label: "Hexagon" },
  { id: "circle", label: "Circle" },
];

interface ConnectorPanelProps {
  modelGeometry: THREE.BufferGeometry | null;
  vertexGroups: Uint8Array;
  groups: { id: number; name: string; color: string }[];
  fileName: string;
  isProcessing: boolean;
  setProcessingMessage: (msg: string) => void;
  setIsProcessing: (v: boolean) => void;
}

export default function ConnectorPanel({
  modelGeometry,
  vertexGroups,
  groups,
  fileName,
  isProcessing,
  setProcessingMessage,
  setIsProcessing,
}: ConnectorPanelProps) {
  const [connectorType, setConnectorType] = useState("dovetail");
  const [sizeMm, setSizeMm] = useState(8.0);
  const [depthMm, setDepthMm] = useState(6.0);
  const [count, setCount] = useState(1);
  const [distribution, setDistribution] = useState("uniform");
  const [tolerancePreset, setTolerancePreset] = useState("fdm_standard");
  const [customTolerance, setCustomTolerance] = useState(0.15);
  const [customXY, setCustomXY] = useState(0.10);
  const [draftAngle, setDraftAngle] = useState(15);
  const [plugShape, setPlugShape] = useState("hexagon");
  const [placementMode, setPlacementMode] = useState("auto");
  const [exportStatus, setExportStatus] = useState<null | "loading" | "done" | "error">(null);
  const [exportError, setExportError] = useState("");

  const loops = useMemo(() => {
    if (!modelGeometry || vertexGroups.length === 0) return [];
    return detectBoundaryEdges(modelGeometry, vertexGroups, groups);
  }, [modelGeometry, vertexGroups, groups]);

  const loopInfo = useMemo(() => {
    return loops.map((loop, i) => ({
      index: i,
      groupA: groups.find((g) => g.id === loop.groupA),
      groupB: groups.find((g) => g.id === loop.groupB),
      length: computeLoopLength(loop),
      count: Math.min(count, Math.max(1, Math.floor(computeLoopLength(loop) / (sizeMm * 1.5)))),
    }));
  }, [loops, groups, count, sizeMm]);

  const handleExport = async () => {
    if (!modelGeometry) return;
    setExportStatus("loading");
    setProcessingMessage("Generating connectors...");
    setIsProcessing(true);

    try {
      const centroids = computeGroupCentroids(modelGeometry, vertexGroups);
      const vg: Record<string, [number, number, number]> = {};
      for (const [gid, pos] of Object.entries(centroids)) {
        vg[String(gid)] = pos;
      }

      const formData = new FormData();
      const exporter = new STLExporter();
      const stlData = exporter.parse(
        new THREE.Mesh(modelGeometry, new THREE.MeshBasicMaterial()),
        { binary: true }
      );
      const blob = new Blob([stlData], { type: "application/octet-stream" });
      formData.append("file", blob, `${fileName.replace(/\.[^/.]+$/, "")}.stl`);

      const tolerance = tolerancePreset === "custom"
        ? { tolerance_mm: customTolerance, xy_compensation_mm: customXY }
        : {};

      const config = {
        connector_config: {
          type: connectorType,
          size_mm: sizeMm,
          depth_mm: depthMm,
          count,
          distribution,
          tolerance_preset: tolerancePreset,
          ...tolerance,
          draft_angle_deg: draftAngle,
          ...(connectorType === "plug" ? { plug_shape: plugShape } : {}),
        },
        vertex_groups: vg,
        model_name: fileName.replace(/\.[^/.]+$/, ""),
        placement_mode: placementMode,
      };

      formData.append("config", JSON.stringify(config));

      const response = await fetch("/api/generate-connectors", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const { jobId } = await response.json();
      setProcessingMessage(`Connector job started: ${jobId}`);

      const result = await pollJobResult(jobId);
      if (result.status === "done") {
        await downloadResult(jobId, fileName);
        setExportStatus("done");
      } else {
        throw new Error(result.error || "Job failed");
      }
    } catch (err: any) {
      setExportError(err.message || "Export failed");
      setExportStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const pollJobResult = (jobId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const maxAttempts = 120;
      let attempt = 0;

      const poll = () => {
        if (attempt >= maxAttempts) {
          reject(new Error("Timeout waiting for connector generation"));
          return;
        }

        fetch(`/api/jobs/${jobId}/status`)
          .then((res) => res.json())
          .then((data) => {
            if (data.status === "done" || data.status === "error") {
              resolve(data);
            } else {
              attempt++;
              setProcessingMessage(`Connectors: ${data.step || "processing"} (${data.progress}%)`);
              setTimeout(poll, 1000);
            }
          })
          .catch(reject);
      };

      poll();
    });
  };

  const downloadResult = async (jobId: string, name: string) => {
    try {
      const fileRes = await fetch(`/api/jobs/${jobId}/file/zip`);
      const blob = await fileRes.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${name.replace(/\.[^/.]+$/, "")}_connectors.zip`;
      link.click();
    } catch (err: any) {
      throw new Error(`Download failed: ${err.message}`);
    }
  };

  const maxCount = Math.max(1, Math.min(8, loops.reduce((sum, l) => sum + Math.max(1, Math.floor(computeLoopLength(l) / (sizeMm * 1.5))), 0) || 1));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>08. Connectors / Encaixes</span>
        </h3>
      </div>

      <div className="space-y-4">
        <div className="bg-[#111] border border-zinc-900 rounded p-3 space-y-3">
          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold text-zinc-400 block">Type / Tipo</label>
            <div className="grid grid-cols-3 gap-1">
              {CONNECTOR_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setConnectorType(ct.id)}
                  className={`py-1.5 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                    connectorType === ct.id
                      ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.05)]"
                      : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {connectorType === "plug" && (
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-zinc-400 block">Shape / Forma</label>
              <div className="grid grid-cols-4 gap-1">
                {PLUG_SHAPES.map((ps) => (
                  <button
                    key={ps.id}
                    onClick={() => setPlugShape(ps.id)}
                    className={`py-1 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                      plugShape === ps.id
                        ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]"
                        : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    }`}
                  >
                    {ps.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#111] border border-zinc-900 rounded p-3 space-y-3">
          <span className="text-[9px] uppercase font-black tracking-wider text-zinc-500 block">Dimensions / Dimensões</span>

          <div className="space-y-2">
            <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400">
              <span>Size / Tamanho (mm)</span>
              <span className="text-[#00E5FF] font-mono">{sizeMm.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={2}
              max={30}
              step={0.5}
              value={sizeMm}
              onChange={(e) => setSizeMm(parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400">
              <span>Depth / Profundidade (mm)</span>
              <span className="text-[#00E5FF] font-mono">{depthMm.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={depthMm}
              onChange={(e) => setDepthMm(parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400">
              <span>Count / Quantidade (max: {maxCount})</span>
              <span className="text-[#00E5FF] font-mono">{count}</span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.min(8, maxCount)}
              step={1}
              value={Math.min(count, Math.min(8, maxCount))}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
            />
          </div>

          {connectorType === "dovetail" && (
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-400">
                <span>Draft Angle / Ângulo (°)</span>
                <span className="text-[#00E5FF] font-mono">{draftAngle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                step={1}
                value={draftAngle}
                onChange={(e) => setDraftAngle(parseInt(e.target.value))}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="bg-[#111] border border-zinc-900 rounded p-3 space-y-3">
          <span className="text-[9px] uppercase font-black tracking-wider text-zinc-500 block">Tolerance / Tolerância</span>
          <div className="grid grid-cols-2 gap-1">
            {TOLERANCE_PRESETS.map((tp) => (
              <button
                key={tp.id}
                onClick={() => setTolerancePreset(tp.id)}
                className={`py-1.5 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                  tolerancePreset === tp.id
                    ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]"
                    : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                {tp.label}
                <br />
                <span className="text-[7px] opacity-70">{tp.tolerance}mm / {tp.xy}mm</span>
              </button>
            ))}
            <button
              onClick={() => setTolerancePreset("custom")}
              className={`py-1.5 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                tolerancePreset === "custom"
                  ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]"
                  : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700"
              }`}
            >
              Custom
            </button>
          </div>

          {tolerancePreset === "custom" && (
            <div className="space-y-2 pt-2 border-t border-zinc-900/60">
              <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                <span>Tolerance (mm)</span>
                <span className="font-mono">{customTolerance.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={0.02}
                max={0.5}
                step={0.01}
                value={customTolerance}
                onChange={(e) => setCustomTolerance(parseFloat(e.target.value))}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] uppercase font-bold text-zinc-400">
                <span>XY Comp (mm)</span>
                <span className="font-mono">{customXY.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.3}
                step={0.01}
                value={customXY}
                onChange={(e) => setCustomXY(parseFloat(e.target.value))}
                className="w-full accent-[#00E5FF] h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="bg-[#111] border border-zinc-900 rounded p-3 space-y-3">
          <span className="text-[9px] uppercase font-black tracking-wider text-zinc-500 block">Placement / Posicionamento</span>

          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setPlacementMode("auto")}
              className={`py-1.5 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                placementMode === "auto"
                  ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]"
                  : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700"
              }`}
            >
              Auto (Alternate)
            </button>
            <button
              onClick={() => setPlacementMode("manual")}
              className={`py-1.5 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                placementMode === "manual"
                  ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]"
                  : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700"
              }`}
            >
              Manual
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-zinc-400 block">Distribution</label>
            <div className="grid grid-cols-3 gap-1">
              {["uniform", "curvature", "corners"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDistribution(d)}
                  className={`py-1 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all text-center ${
                    distribution === d
                      ? "bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]"
                      : "bg-[#0A0A0A] border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loops.length > 0 && (
          <div className="bg-[#0b0b0b] border border-zinc-900 rounded p-3 space-y-2">
            <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest font-extrabold">
              {loops.length} boundary loop(s) detected
            </span>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {loopInfo.map((li) => (
                <div key={li.index} className="text-[8px] text-zinc-500 font-mono flex justify-between">
                  <span>
                    [{li.groupA?.color || "?"}] {li.groupA?.name?.split("(")[0] ?? `Group ${li.groupA}`}
                    {" ⇄ "}
                    [{li.groupB?.color || "?"}] {li.groupB?.name?.split("(")[0] ?? `Group ${li.groupB}`}
                  </span>
                  <span>{li.count} conn.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={!modelGeometry || loops.length === 0 || exportStatus === "loading" || isProcessing}
          className="w-full bg-[#00E5FF] hover:bg-[#00B8D4] text-black font-black uppercase text-[11px] py-4 px-4 tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,229,255,0.2)] disabled:opacity-40 disabled:hover:bg-[#00E5FF]"
        >
          {exportStatus === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Generate & Export Connectors (.zip)
        </button>

        {exportStatus === "done" && (
          <p className="text-[9px] text-emerald-400 uppercase font-bold text-center">Connectors generated successfully!</p>
        )}
        {exportStatus === "error" && (
          <p className="text-[9px] text-red-400 uppercase font-bold text-center">{exportError}</p>
        )}

        {loops.length === 0 && modelGeometry && (
          <p className="text-[9px] text-zinc-500 uppercase text-center">Paint at least 2 groups with adjacent areas to create connectors.</p>
        )}
      </div>
    </section>
  );
}