import { M2crLogo } from "@/components/M2crLogo";

type Variant = "full-screen" | "overlay" | "inline" | "button";

interface M2crLoadingProps {
  variant?: Variant;
  progress?: number;
}

function CubeSpinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-80 -92 160 152"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
      style={{ animationDuration: "2s" }}
      aria-hidden="true"
    >
      <polygon points="0,-72 62,-36 62,0 0,36 -62,0 -62,-36" fill="#E8F4FD" opacity="0.3" />
      <polygon points="-62,-36 0,0 0,36 -62,0" fill="#F97316" />
      <polygon points="62,-36 0,0 0,36 62,0" fill="#3B82F6" />
      <polygon points="0,-72 62,-36 0,0 -62,-36" fill="#8B5CF6" />
      <line x1="0" y1="-72" x2="0" y2="0" stroke="white" strokeWidth="2" opacity="0.6" />
      <line x1="0" y1="0" x2="-62" y2="-36" stroke="white" strokeWidth="1.5" opacity="0.4" />
      <line x1="0" y1="0" x2="62" y2="-36" stroke="white" strokeWidth="1.5" opacity="0.4" />
      <line x1="0" y1="0" x2="0" y2="36" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="62" y1="-26" x2="0" y2="10" stroke="white" strokeWidth="1" opacity="0.3" />
      <line x1="62" y1="-16" x2="0" y2="20" stroke="white" strokeWidth="1" opacity="0.3" />
      <line x1="62" y1="-6" x2="0" y2="30" stroke="white" strokeWidth="1" opacity="0.3" />
      <circle cx="0" cy="-72" r="5" fill="#F59E0B" />
    </svg>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1 rounded-full bg-[var(--surface-container-high)] overflow-hidden mt-3">
      <div
        className="h-full rounded-full bg-[var(--workbench-accent)] transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function M2crLoading({ variant = "inline", progress }: M2crLoadingProps) {
  if (variant === "full-screen") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-[var(--workbench-page)]">
        <M2crLogo size={44} withWordmark={true} />
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--outline)] font-bold">
          Carregando&hellip;
        </span>
        {progress != null && <ProgressBar value={progress} />}
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--workbench-page)]/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-[var(--workbench-panel)]/90 border border-[var(--surface-container-high)]">
          <M2crLogo size={32} withWordmark={true} />
          {progress != null && <ProgressBar value={progress} />}
        </div>
      </div>
    );
  }

  if (variant === "button") {
    return <CubeSpinner size={16} />;
  }

  return <CubeSpinner size={20} />;
}
