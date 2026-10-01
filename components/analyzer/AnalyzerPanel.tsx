import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Download, FileBox, Loader2, RotateCcw, Upload, X } from "lucide-react";
import type { FixId, Issue, PackageInfo, PresetId } from "../../src/lib/threeMfAnalyzer/types";
import { MESH_FIXES, SETTINGS_FIXES } from "../../src/lib/threeMfAnalyzer/storage";
import { PRESETS } from "../../src/lib/threeMfAnalyzer/settingsApply";
import { IssueList, fixLabel } from "./IssueList";
import type { OverlayFlags } from "./AnalyzerCanvas";

const SOFT_LIMIT = 50 * 1024 * 1024;
const HARD_LIMIT = 200 * 1024 * 1024;

const GROUPS = [
  { id: "package", label: "Pacote" },
  { id: "mesh", label: "Malha" },
  { id: "settings", label: "Impressão" },
] as const;

export interface ExportReport {
  fileName: string;
  errors: number;
  warnings: number;
  refatizar: boolean;
}

export interface AnalyzerPanelProps {
  fileName: string | null;
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
  issues: Issue[];
  info: PackageInfo | null;
  totalTriangles: number;
  activeFixes: FixId[];
  onToggleFix: (fix: FixId) => void;
  onSelectAllFixes: (enabled: boolean) => void;
  preset: PresetId;
  onPresetChange: (preset: PresetId) => void;
  overlays: OverlayFlags;
  onToggleOverlay: (key: keyof OverlayFlags) => void;
  exporting: boolean;
  canExport: boolean;
  onExport: () => void;
  canRestore: boolean;
  onRestore: () => void;
  report: ExportReport | null;
}

export function AnalyzerPanel(props: AnalyzerPanelProps) {
  const {
    fileName,
    onFile,
    busy,
    error,
    onDismissError,
    issues,
    info,
    totalTriangles,
    activeFixes,
    onToggleFix,
    onSelectAllFixes,
    preset,
    onPresetChange,
    overlays,
    onToggleOverlay,
    exporting,
    canExport,
    onExport,
    canRestore,
    onRestore,
    report,
  } = props;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const hints = issues.filter((i) => i.severity === "info");
  const hasSettings = !!info?.projectSettings;
  const activeCount = activeFixes.length;

  return (
    <aside className="w-full md:w-[400px] shrink-0 bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-[var(--surface-container-high)] shrink-0">
        <h2 className="font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-[#1A1C19]">
          Analisador 3MF
        </h2>
        <p className="text-[11px] text-[#7A7487] mt-0.5">Malha + configuração de impressão</p>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-[#F5C2C2] bg-[#FDECEC] px-3 py-2 text-[11px] text-[#B3261E]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={onDismissError} aria-label="Fechar aviso" className="shrink-0 font-bold hover:opacity-70">
            ×
          </button>
        </div>
      )}

      <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <Dropzone fileName={fileName} onFile={onFile} disabled={busy || exporting} />

        {report && (
          <div className="space-y-2">
            <div
              className={`rounded-lg border px-3 py-2 text-[11px] ${
                report.errors === 0
                  ? "border-[#B7E4D0] bg-[#E6F9F1] text-[#0B6B4F]"
                  : "border-[#FFD9A8] bg-[#FFF4E5] text-[#B26A00]"
              }`}
            >
              <div className="font-mono text-[10px] font-black uppercase tracking-[0.15em]">
                Re-análise · {report.fileName}
              </div>
              <div className="mt-1 font-bold">
                {report.errors} erro(s) · {report.warnings} aviso(s)
              </div>
            </div>
            {report.refatizar && (
              <div className="rounded-lg border border-[#FFD9A8] bg-[#FFF4E5] px-3 py-2 text-[11px] text-[#B26A00]">
                <b>G-code removido.</b> Reabra o arquivo no Bambu Studio e refatize antes de mandar para a impressora.
              </div>
            )}
          </div>
        )}

        <section className="space-y-2">
          <SectionTitle>Resumo</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Counter label="erros" value={errors.length} tone="error" />
            <Counter label="avisos" value={warnings.length} tone="warning" />
            <Counter label="dicas" value={hints.length} tone="info" />
          </div>
          {issues.length > 0 && (
            <p className="text-[11px] text-[#494455]">
              {errors.length === 0 ? (
                <b className="text-[#0B6B4F]">Sem problemas estruturais.</b>
              ) : (
                <>Corrija os {errors.length} erro(s) antes de fatiar.</>
              )}
            </p>
          )}
          {info && (
            <dl className="rounded-lg border border-[var(--surface-container-high)] bg-white px-3 py-2 text-[11px] text-[#494455] space-y-1">
              <Meta label="Tipo" value={info.kindLabel} />
              <Meta label="Unidade" value={info.unit} />
              <Meta label="Objetos" value={String(info.model.objects.length)} />
              <Meta label="Triângulos" value={totalTriangles.toLocaleString("pt-BR")} />
              <Meta label="Aplicação" value={info.application || "—"} />
            </dl>
          )}
        </section>

        <section className="space-y-2">
          <SectionTitle>Relatório</SectionTitle>
          {issues.length === 0 && (
            <p className="text-[11px] text-[#7A7487]">Envie um .3mf para gerar o relatório.</p>
          )}
          {GROUPS.map((group) => (
            <IssueList
              key={group.id}
              label={group.label}
              issues={issues.filter((issue) => issue.category === group.id)}
              activeFixes={activeFixes}
            />
          ))}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Correções</SectionTitle>
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#632CE5]">
              {activeCount} ativas
            </span>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onSelectAllFixes(true)}
              className="flex-1 rounded-md border border-[#E8E9E3] bg-white px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#494455] hover:border-[#632CE5] hover:text-[#632CE5]"
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => onSelectAllFixes(false)}
              className="flex-1 rounded-md border border-[#E8E9E3] bg-white px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#494455] hover:border-[#632CE5] hover:text-[#632CE5]"
            >
              Nenhuma
            </button>
          </div>

          <FixGroup title="Malha" fixes={MESH_FIXES} active={activeFixes} onToggle={onToggleFix} />
          <FixGroup
            title="Impressão"
            fixes={SETTINGS_FIXES}
            active={activeFixes}
            onToggle={onToggleFix}
            locked={hasSettings ? ["S4"] : SETTINGS_FIXES}
            lockedReason={
              hasSettings
                ? "S4 é automático: remove o G-code fatiado sempre que S1, S2, S3 ou S5 mudar a configuração."
                : "Sem Metadata/project_settings.config neste pacote."
            }
          />

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-black text-[#7A7487]">
              Preset S1
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={preset === id}
                  onClick={() => onPresetChange(id)}
                  className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                    preset === id
                      ? "border-[#632CE5] bg-[#632CE5]/10"
                      : "border-[#E8E9E3] bg-white hover:border-[#CAC3D8]"
                  }`}
                >
                  <div className="text-[11px] font-black text-[#1A1C19]">{PRESETS[id].label}</div>
                  <div className="font-mono text-[9px] text-[#7A7487]">{PRESETS[id].settings.layer_height} mm</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle>Sobreposições</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            <OverlayToggle
              label="Bordas abertas"
              color="#FF1744"
              active={overlays.boundary}
              onClick={() => onToggleOverlay("boundary")}
            />
            <OverlayToggle
              label="Overhang"
              color="#FF9100"
              active={overlays.overhang}
              onClick={() => onToggleOverlay("overhang")}
            />
            <OverlayToggle
              label="Fora da mesa"
              color="#FFD166"
              active={overlays.placement}
              onClick={() => onToggleOverlay("placement")}
            />
          </div>
        </section>

        <section className="space-y-2 pb-2">
          <SectionTitle>Exportar</SectionTitle>
          <button type="button" className="btn-primary" disabled={!canExport || exporting} onClick={onExport}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Download className="mr-2 inline h-3.5 w-3.5" />
                Baixar 3MF corrigido
              </>
            )}
          </button>
          <p className="text-[10px] leading-snug text-[#7A7487]">
            {canExport
              ? "Somente as entradas alteradas são reescritas — o resto do ZIP (thumbnails, metadados) é preservado byte a byte."
              : "Envie um .3mf para habilitar a exportação."}
          </p>
          {canRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E8E9E3] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#494455] hover:border-[#632CE5] hover:text-[#632CE5]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar original
            </button>
          )}
        </section>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] font-black text-[#7A7487]">{children}</h3>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-[#7A7487]">{label}</dt>
      <dd className="truncate font-mono text-[11px] font-bold text-[#1A1C19]">{value}</dd>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "error" | "warning" | "info" }) {
  const classes =
    tone === "error"
      ? "border-[#F5C2C2] bg-[#FDECEC] text-[#B3261E]"
      : tone === "warning"
      ? "border-[#FFD9A8] bg-[#FFF4E5] text-[#B26A00]"
      : "border-[#E8E9E3] bg-[#F2F0F5] text-[#494455]";
  return (
    <div className={`rounded-lg border px-2 py-2 text-center ${classes}`}>
      <div className="font-mono text-[18px] font-black leading-none">{value}</div>
      <div className="mt-1 font-mono text-[9px] font-black uppercase tracking-wider">{label}</div>
    </div>
  );
}

function FixGroup({
  title,
  fixes,
  active,
  onToggle,
  locked = [],
  lockedReason,
}: {
  title: string;
  fixes: FixId[];
  active: FixId[];
  onToggle: (fix: FixId) => void;
  locked?: FixId[];
  lockedReason?: string;
}) {
  const disabled = locked.length > 0;
  return (
    <div className="space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-black text-[#7A7487]">{title}</span>
      <div className="grid grid-cols-2 gap-1.5">
        {fixes.map((fix) => {
          const isLocked = locked.includes(fix);
          const isActive = isLocked ? false : active.includes(fix);
          return (
            <button
              key={fix}
              type="button"
              aria-pressed={isActive}
              disabled={isLocked}
              onClick={() => onToggle(fix)}
              className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                isLocked
                  ? "cursor-not-allowed border-[#E8E9E3] bg-[#F2F0F5] opacity-60"
                  : isActive
                  ? "border-[#632CE5] bg-[#632CE5]/10"
                  : "border-[#E8E9E3] bg-white hover:border-[#CAC3D8]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[11px] font-black text-[#1A1C19]">{fix}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-[#632CE5]" : "bg-[#CAC3D8]"}`}
                  aria-hidden
                />
              </div>
              <div className="mt-0.5 text-[9px] leading-tight text-[#494455]">
                {isLocked ? "automático" : fixLabel(fix)}
              </div>
            </button>
          );
        })}
      </div>
      {disabled && lockedReason && (
        <p className="text-[10px] leading-snug text-[#B26A00]">
          <b>Impressão desativada:</b> {lockedReason}
        </p>
      )}
    </div>
  );
}

function OverlayToggle({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
        active ? "border-[#632CE5] bg-[#632CE5]/10 text-[#1A1C19]" : "border-[#E8E9E3] bg-white text-[#7A7487]"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? color : "#CAC3D8" }} aria-hidden />
      {label}
    </button>
  );
}

function Dropzone({
  fileName,
  onFile,
  disabled,
}: {
  fileName: string | null;
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (candidate: File) => {
      if (!candidate.name.toLowerCase().endsWith(".3mf")) {
        setWarning("Formato não suportado. Envie um arquivo .3mf.");
        return;
      }
      if (candidate.size > HARD_LIMIT) {
        setWarning(`Arquivo muito grande (${Math.round(candidate.size / 1024 / 1024)} MB). Limite é 200 MB.`);
        return;
      }
      setWarning(candidate.size > SOFT_LIMIT ? "Arquivo > 50 MB — a análise pode demorar." : null);
      onFile(candidate);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const candidate = event.dataTransfer.files?.[0];
      if (candidate) acceptFile(candidate);
    },
    [acceptFile, disabled]
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragOver
            ? "border-[#632CE5] bg-[#632CE5]/5"
            : disabled
            ? "border-[#E8E9E3] bg-[#E8E9E3] opacity-50"
            : "border-[#CAC3D8] bg-[#F2F0F5] hover:border-[#632CE5]"
        }`}
      >
        {fileName ? (
          <div className="flex items-center justify-center gap-2 text-[#1A1C19]">
            <FileBox className="h-5 w-5 text-[#632CE5]" />
            <span className="max-w-[240px] truncate font-mono text-[12px] font-semibold">{fileName}</span>
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-2 h-6 w-6 text-[#632CE5]" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#494455]">
              {disabled ? "Processando" : "Arraste ou clique"}
            </p>
            <p className="mt-1 text-[10px] text-[#7A7487]">Somente .3mf · até 200 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".3mf"
          onChange={(event) => {
            const candidate = event.target.files?.[0];
            if (candidate) acceptFile(candidate);
          }}
          className="hidden"
          disabled={disabled}
        />
      </div>
      {warning && (
        <div className="flex items-center gap-2 rounded-lg border border-[#FFD9A8] bg-[#FFF4E5] px-3 py-2 text-[11px] text-[#B26A00]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{warning}</span>
          <button type="button" onClick={() => setWarning(null)} aria-label="Fechar aviso" className="ml-auto shrink-0 font-bold hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
