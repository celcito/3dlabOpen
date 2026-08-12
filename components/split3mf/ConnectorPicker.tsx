import { PlugZap, GitCompareArrows } from "lucide-react";
import type { ConnectorConfig, ConnectorType } from "../../src/lib/split3mf/state/splitTypes";
import { cn } from "@/lib/utils";

export interface ConnectorPickerProps {
  connectorConfig: ConnectorConfig;
  onChange: (patch: Partial<ConnectorConfig>) => void;
}

const TYPES: { id: ConnectorType; label: string }[] = [
  { id: "none", label: "Nenhum" },
  { id: "cylinder", label: "Cilindro" },
  { id: "triangular_prism", label: "Prisma Tri." },
  { id: "rectangular_prism", label: "Prisma Ret." },
];

export function ConnectorPicker({ connectorConfig, onChange }: ConnectorPickerProps) {
  const slider = (label: string, value: number, min: number, max: number, step: number, field: "areaPercent" | "socketToleranceMm" | "depthMm", suffix = "") => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-wider text-[#7A7487] font-bold">{label}</span>
        <span className="font-mono text-[11px] text-[#1A1C19]">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange({ [field]: Number(e.target.value) })}
        className="w-full accent-[#632CE5]"
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[#1A1C19]">
        <PlugZap className="w-4 h-4 text-[#632CE5]" />
        <span className="text-[11px] font-bold uppercase tracking-wider">Conector</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange({ type: t.id })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors",
              connectorConfig.type === t.id
                ? "bg-[#632CE5] text-white border-[#632CE5]"
                : "bg-white text-[#494455] border-[#E8E9E3] hover:border-[#CAC3D8]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <GitCompareArrows className="w-4 h-4 text-[#7A7487]" />
        <span className="text-[10px] uppercase tracking-wider text-[#7A7487] font-bold">Lado do plugue</span>
        <div className="flex rounded-lg border border-[#E8E9E3] overflow-hidden ml-auto">
          {(["part_plug", "body_plug"] as const).map((side) => (
            <button
              key={side}
              onClick={() => onChange({ side })}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold transition-colors",
                connectorConfig.side === side ? "bg-[#632CE5] text-white" : "bg-white text-[#494455]"
              )}
            >
              {side === "part_plug" ? "Peca" : "Corpo"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {slider("Área % (1–20)", connectorConfig.areaPercent, 1, 20, 1, "areaPercent", "%")}
        {slider("Tolerância encaixe", connectorConfig.socketToleranceMm, 0.05, 1, 0.05, "socketToleranceMm", " mm")}
        {slider("Profundidade", connectorConfig.depthMm, 1, 12, 0.5, "depthMm", " mm")}
      </div>
    </div>
  );
}