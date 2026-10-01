import type { FixId, Issue, Severity } from "../../src/lib/threeMfAnalyzer/types";

const SEVERITY: Record<Severity, { label: string; className: string }> = {
  error: { label: "erro", className: "bg-[#FDECEC] border-[#F5C2C2] text-[#B3261E]" },
  warning: { label: "aviso", className: "bg-[#FFF4E5] border-[#FFD9A8] text-[#B26A00]" },
  info: { label: "dica", className: "bg-[#F2F0F5] border-[#E8E9E3] text-[#494455]" },
};

const FIX_LABELS: Record<FixId, string> = {
  M1: "Weld de vértices",
  M2: "Limpar triângulos",
  M3: "Corrigir normais",
  M4: "Assar transforms",
  M5: "Converter para mm",
  M6: "Assentar em Z=0",
  M7: "Remover objetos vazios",
  S1: "Preset de fatiamento",
  S2: "Suportes",
  S3: "Pé de elefante",
  S4: "Remover G-code obsoleto",
  S5: "Brim",
};

export function fixLabel(fixId: FixId): string {
  return FIX_LABELS[fixId];
}

export function IssueList({
  label,
  issues,
  activeFixes,
}: {
  label: string;
  issues: Issue[];
  activeFixes: FixId[];
}) {
  if (issues.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--surface-container-high)] bg-white overflow-hidden">
      <div className="px-3 py-2 bg-[#F2F0F5] flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-black text-[#494455]">{label}</span>
        <span className="font-mono text-[10px] font-bold text-[#7A7487]">{issues.length}</span>
      </div>
      <ul>
        {issues.map((issue, index) => (
          <IssueRow key={`${issue.id}-${index}`} issue={issue} activeFixes={activeFixes} />
        ))}
      </ul>
    </div>
  );
}

function IssueRow({ issue, activeFixes }: { issue: Issue; activeFixes: FixId[] }) {
  const severity = SEVERITY[issue.severity];
  const fixActive = issue.fixId ? activeFixes.includes(issue.fixId) : false;
  return (
    <li className="px-3 py-2.5 border-t border-[#E8E9E3] first:border-t-0">
      <div className="flex items-start gap-2">
        <span
          className={`shrink-0 font-mono text-[9px] font-black uppercase tracking-wider border rounded px-1.5 py-0.5 mt-0.5 ${severity.className}`}
        >
          {severity.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[10px] font-black text-[#7A7487]">{issue.id}</span>
            <span className="text-[12px] font-bold text-[#1A1C19] leading-snug">{issue.title}</span>
          </div>
          <p className="text-[11px] text-[#494455] mt-1 leading-snug">{issue.detail}</p>
          <p className="text-[11px] text-[#1A1C19] bg-[#F2F0F5] rounded px-2 py-1.5 mt-1.5 leading-snug">
            <b className="font-black">Dica:</b> {issue.hint}
          </p>
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#7A7487] leading-snug">
              {issue.source}
            </span>
            {issue.fixId && (
              <span
                className={`shrink-0 font-mono text-[9px] font-black uppercase tracking-wider ${
                  fixActive ? "text-[#632CE5]" : "text-[#7A7487]"
                }`}
              >
                {issue.fixId} · {fixActive ? "ativa" : "inativa"}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
