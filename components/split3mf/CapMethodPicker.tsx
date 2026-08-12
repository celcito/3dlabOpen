import { Layers } from "lucide-react";
import type { CapConfig, CapMethod } from "../../src/lib/split3mf/state/splitTypes";
import { cn } from "@/lib/utils";

export interface CapMethodPickerProps {
  capConfig: CapConfig;
  onChange: (patch: Partial<CapConfig>) => void;
}

const METHODS: { id: CapMethod; label: string; hint: string }[] = [
  { id: "soap_film", label: "Película", hint: "Fecho fino (CSG fallback)" },
  { id: "cdt_boundary", label: "CDT", hint: "Triangulação constr." },
  { id: "winding_fill", label: "Winding Fill", hint: "Preenchim. paridade" },
  { id: "projected_normal", label: "Projeção", hint: "Cobre por normal" },
  { id: "centroid_cap", label: "Centróide", hint: "Leque central" },
];

export function CapMethodPicker({ capConfig, onChange }: CapMethodPickerProps) {
  const slider = (label: string, value: number, min: number, max: number, step: number, field: "thickness" | "resolution", suffix = "") => (
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
        <Layers className="w-4 h-4 text-[#632CE5]" />
        <span className="text-[11px] font-bold uppercase tracking-wider">Método de Fecho</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange({ method: m.id })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors",
              capConfig.method === m.id
                ? "bg-[#632CE5] text-white border-[#632CE5]"
                : "bg-white text-[#494455] border-[#E8E9E3] hover:border-[#CAC3D8]"
            )}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="space-y-3 pt-1">
        {slider("Espessura", capConfig.thickness, 0.1, 5, 0.1, "thickness", " mm")}
        {slider("Resolução", capConfig.resolution, 8, 128, 4, "resolution", " seg")}
      </div>
    </div>
  );
}