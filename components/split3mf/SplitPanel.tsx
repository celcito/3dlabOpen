import { useState } from "react";
import { Upload, Brush, Layers, PlugZap, Download } from "lucide-react";
import { SplitDropzone } from "./SplitDropzone";
import { CapMethodPicker } from "./CapMethodPicker";
import { ConnectorPicker } from "./ConnectorPicker";
import { SplitExportBar } from "./SplitExportBar";
import { cn } from "@/lib/utils";

export interface SplitPanelProps {
  fileName: string | null;
  onFile: (file: File) => void;
  loading?: boolean;
  error?: string | null;
  errorTone?: "error" | "warn";
  onDismissError?: () => void;
  hasRegionMask: boolean;
  brushInstructions: React.ReactNode;
  cap: React.ReactNode;
  connector: React.ReactNode;
  exportBar: React.ReactNode;
}

const TABS = [
  { id: "import", label: "Importar", icon: Upload },
  { id: "boundary", label: "Fronteira", icon: Brush },
  { id: "cap", label: "Fecho", icon: Layers },
  { id: "connector", label: "Conector", icon: PlugZap },
  { id: "export", label: "Exportar", icon: Download },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SplitPanel({
  fileName,
  onFile,
  loading,
  error,
  errorTone = "error",
  onDismissError,
  hasRegionMask,
  brushInstructions,
  cap,
  connector,
  exportBar,
}: SplitPanelProps) {
  const [tab, setTab] = useState<TabId>("import");

  return (
    <div className="w-[250px] shrink-0 border-r border-[#CAC3D8] bg-[#FFFFFF] flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-[#1A1C19]">
          Split 3MF
        </h2>
        <p className="text-[10px] text-[#7A7487] mt-0.5">Importe, pinte e divida</p>
      </div>

      {error && (
        <div
          className={`mx-4 mb-2 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] border ${
            errorTone === "error"
              ? "bg-[#FDECEC] border-[#F5C2C2] text-[#B3261E]"
              : "bg-[#FFF4E5] border-[#FFD9A8] text-[#B26A00]"
          }`}
        >
          <span className="flex-1">{error}</span>
          {onDismissError && (
            <button onClick={onDismissError} aria-label="Fechar aviso" className="shrink-0 font-bold hover:opacity-70">
              ×
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-colors",
              tab === t.id
                ? "bg-[#632CE5] text-white border-[#632CE5]"
                : "bg-white text-[#7A7487] border-[#E8E9E3] hover:border-[#CAC3D8]"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {tab === "import" && (
          <div className="space-y-4">
            <SplitDropzone fileName={fileName} onFile={onFile} disabled={loading} />
            {fileName && (
              <div className="text-[11px] text-[#494455] bg-[#F2F0F5] rounded-lg px-3 py-2 space-y-2">
                {loading
                  ? "Analisando arquivo…"
                  : hasRegionMask
                  ? "Regiões detectadas automaticamente."
                  : "Sem regiões pintadas — crie regiões na aba Fronteira para começar."}
                {!loading && !hasRegionMask && (
                  <button
                    type="button"
                    onClick={() => setTab("boundary")}
                    className="w-full rounded-md bg-[#632CE5] px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-[#7C4DFF]"
                  >
                    Ir para Fronteira
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "boundary" && <div className="space-y-4">{brushInstructions}</div>}

        {tab === "cap" && cap}

        {tab === "connector" && connector}

        {tab === "export" && exportBar}
      </div>
    </div>
  );
}
