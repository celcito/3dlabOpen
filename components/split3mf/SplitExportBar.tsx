import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { SplitExportOptions } from "../../src/lib/split3mf/state/splitTypes";
import { cn } from "@/lib/utils";

export interface SplitExportBarProps {
  disabled?: boolean;
  onExport: (options: { format: SplitExportOptions["format"]; includeConnectors: boolean; capPieces: boolean }) => Promise<void>;
}

const FORMATS: SplitExportOptions["format"][] = ["3mf", "glb", "obj", "stl"];

export function SplitExportBar({ disabled, onExport }: SplitExportBarProps) {
  const [format, setFormat] = useState<SplitExportOptions["format"]>("3mf");
  const [capPieces, setCapPieces] = useState(true);
  const [includeConnectors, setIncludeConnectors] = useState(true);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {FORMATS.map((fmt) => (
          <button
            key={fmt}
            onClick={() => setFormat(fmt)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide border transition-colors flex-1",
              format === fmt
                ? "bg-[#632CE5] text-white border-[#632CE5]"
                : "bg-white text-[#494455] border-[#E8E9E3] hover:border-[#CAC3D8]"
            )}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-[#494455] cursor-pointer">
          <input
            type="checkbox"
            checked={capPieces}
            onChange={(e) => setCapPieces(e.target.checked)}
            className="accent-[#632CE5]"
          />
          Fechar superfícies abertas (cap)
        </label>
        <label className="flex items-center gap-2 text-[11px] text-[#494455] cursor-pointer">
          <input
            type="checkbox"
            checked={includeConnectors}
            onChange={(e) => setIncludeConnectors(e.target.checked)}
            className="accent-[#632CE5]"
          />
          Fusionar conectores (CSG)
        </label>
      </div>

      <button
        onClick={async () => {
          setBusy(true);
          try {
            await onExport({ format, includeConnectors, capPieces });
          } finally {
            setBusy(false);
          }
        }}
        disabled={disabled || busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00C853] text-white font-mono text-[11px] font-bold tracking-[0.05em] hover:bg-[#00B34A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busy ? "Exportando…" : "Exportar"}
      </button>
    </div>
  );
}