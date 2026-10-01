import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Loader2 } from "lucide-react";
import { AnalyzerCanvas } from "../../components/analyzer/AnalyzerCanvas";
import type { OverlayFlags } from "../../components/analyzer/AnalyzerCanvas";
import { AnalyzerPanel } from "../../components/analyzer/AnalyzerPanel";
import type { ExportReport } from "../../components/analyzer/AnalyzerPanel";
import { analyzePackage } from "../lib/threeMfAnalyzer/packageReader";
import { applyMeshRepairs } from "../lib/threeMfAnalyzer/repair";
import { applySettingsFixes } from "../lib/threeMfAnalyzer/settingsApply";
import { exportFixed3mf } from "../lib/threeMfAnalyzer/exporter";
import { loadPreferences, savePreferences, TOGGLABLE_FIXES } from "../lib/threeMfAnalyzer/storage";
import type { AnalyzerPreferences } from "../lib/threeMfAnalyzer/storage";
import type { AnalysisResult, FixId, PackageInfo, PresetId } from "../lib/threeMfAnalyzer/types";

const EMPTY_F32 = new Float32Array(0);

interface Session {
  fileName: string;
  buffer: ArrayBuffer;
  sourceBuffer: ArrayBuffer;
  info: PackageInfo;
  result: AnalysisResult;
}

export default function ThreeMfAnalyzer() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ExportReport | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [overlays, setOverlays] = useState<OverlayFlags>({ boundary: true, overhang: true, placement: true });
  const [preferences, setPreferences] = useState<AnalyzerPreferences>(() => loadPreferences());

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const handleFile = async (file: File) => {
    setError(null);
    setReport(null);
    flushSync(() => setBusy(true));
    await nextFrame();
    try {
      const buffer = await file.arrayBuffer();
      const { info, result } = await analyzePackage(buffer);
      flushSync(() => {
        setSession({ fileName: file.name, buffer, sourceBuffer: buffer, info, result });
        setEpoch((n) => n + 1);
      });
    } catch (err) {
      console.error("Analisador 3MF: falha ao ler o pacote:", err);
      flushSync(() => {
        setSession(null);
        setError(`Não foi possível ler o arquivo: ${err instanceof Error ? err.message : "erro desconhecido"}`);
      });
    } finally {
      flushSync(() => setBusy(false));
    }
  };

  const handleExport = async () => {
    if (!session) return;
    setError(null);
    flushSync(() => setExporting(true));
    await nextFrame();
    try {
      // Rele do buffer atual: repairs mutam o DOM dos documentos.
      const { info, result } = await analyzePackage(session.buffer);
      applyMeshRepairs(info.model, preferences.fixes);
      const settingsFixes = applySettingsFixes(
        info.projectSettings,
        [...preferences.fixes, "S4"] as FixId[],
        preferences.preset,
        result.issues.some((issue) => issue.id === "B7")
      );
      const blob = exportFixed3mf(session.buffer, {
        model: info.model,
        settings: settingsFixes.settings,
        removeStaleSlice: settingsFixes.removeStaleSlice,
      });

      const fileName = `${session.fileName.replace(/\.3mf$/i, "")}_corrigido.3mf`;
      downloadBlob(blob, fileName);

      const fixedBuffer = await blob.arrayBuffer();
      const { info: nextInfo, result: nextResult } = await analyzePackage(fixedBuffer);
      flushSync(() => {
        setSession({ ...session, buffer: fixedBuffer, info: nextInfo, result: nextResult });
        setReport({
          fileName,
          errors: nextResult.issues.filter((issue) => issue.severity === "error").length,
          warnings: nextResult.issues.filter((issue) => issue.severity === "warning").length,
          refatizar: settingsFixes.refatizar,
        });
        setEpoch((n) => n + 1);
      });
    } catch (err) {
      console.error("Analisador 3MF: exportação falhou:", err);
      setError(`A exportação falhou: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      flushSync(() => setExporting(false));
    }
  };

  const handleRestore = async () => {
    if (!session) return;
    try {
      const { info, result } = await analyzePackage(session.sourceBuffer);
      flushSync(() => {
        setSession({ ...session, buffer: session.sourceBuffer, info, result });
        setReport(null);
        setEpoch((n) => n + 1);
      });
    } catch (err) {
      console.error("Analisador 3MF: restauração falhou:", err);
      setError("Não foi possível restaurar o arquivo original.");
    }
  };

  const toggleFix = (fix: FixId) =>
    setPreferences((current) => ({
      ...current,
      fixes: current.fixes.includes(fix) ? current.fixes.filter((id) => id !== fix) : [...current.fixes, fix],
    }));

  const selectAllFixes = (enabled: boolean) =>
    setPreferences((current) => ({ ...current, fixes: enabled ? [...TOGGLABLE_FIXES] : [] }));

  const changePreset = (preset: PresetId) => setPreferences((current) => ({ ...current, preset }));

  const toggleOverlay = (key: keyof OverlayFlags) =>
    setOverlays((current) => ({ ...current, [key]: !current[key] }));

  const issues = session?.result.issues ?? [];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return (
    <div className="flex w-full flex-1 min-h-0 overflow-hidden">
      <div className="relative min-w-0 flex-1">
        <div className="workbench-viewport absolute inset-0">
          <AnalyzerCanvas
            meshes={session?.result.meshes ?? []}
            boundarySegments={session?.result.boundarySegments ?? EMPTY_F32}
            overhangTriangles={session?.result.overhangTriangles ?? EMPTY_F32}
            highlights={session?.result.highlights ?? []}
            overlays={overlays}
            epoch={epoch}
          />

          <div className="pointer-events-none absolute left-6 top-6 z-20 select-none space-y-1.5 rounded border border-[var(--surface-container-high)] bg-[var(--workbench-panel)] px-3.5 py-2.5 text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
            <div className="mb-1 text-[11px] font-bold text-[var(--workbench-accent)]">Analisador 3MF</div>
            <div>
              Arquivo: <b className="text-[#1A1C19]">{session?.fileName ?? "—"}</b>
            </div>
            <div>
              Erros: <b className="text-[#B3261E]">{errorCount}</b> · Avisos:{" "}
              <b className="text-[#B26A00]">{warningCount}</b>
            </div>
            <div className="text-[#7A7487]">Left drag: girar · Scroll: zoom · Right drag: mover</div>
          </div>

          {!session && !busy && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-xl border border-[var(--surface-container-high)] bg-[var(--workbench-panel)] px-6 py-5">
                <div className="text-[14px] font-black uppercase tracking-tighter text-[#1A1C19]">
                  Nenhum arquivo carregado
                </div>
                <div className="mt-1 max-w-xs text-[11px] text-[#7A7487]">
                  Envie um <b>.3mf</b> no painel lateral para checar malha, unidade e configuração de impressão.
                </div>
              </div>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--workbench-panel)]/80 backdrop-blur-sm">
              <Loader2 className="h-9 w-9 animate-spin text-[var(--workbench-accent)]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#494455]">
                Analisando…
              </span>
            </div>
          )}
        </div>
      </div>

      <AnalyzerPanel
        fileName={session?.fileName ?? null}
        onFile={handleFile}
        busy={busy}
        error={error}
        onDismissError={() => setError(null)}
        issues={issues}
        info={session?.info ?? null}
        totalTriangles={session?.result.totalTriangles ?? 0}
        activeFixes={preferences.fixes}
        onToggleFix={toggleFix}
        onSelectAllFixes={selectAllFixes}
        preset={preferences.preset}
        onPresetChange={changePreset}
        overlays={overlays}
        onToggleOverlay={toggleOverlay}
        exporting={exporting}
        canExport={!!session && !busy && !exporting}
        onExport={handleExport}
        canRestore={!!session && report !== null}
        onRestore={handleRestore}
        report={report}
      />
    </div>
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
