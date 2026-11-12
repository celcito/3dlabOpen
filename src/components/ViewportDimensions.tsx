import React from 'react';

interface ViewportDimensionsProps {
  dimX: number;
  dimY: number;
  dimZ: number;
}

/** Cartão com largura, altura e profundidade do modelo, sobre o viewport 3D. */
export const ViewportDimensions: React.FC<ViewportDimensionsProps> = ({ dimX, dimY, dimZ }) => {
  const rows = [
    { label: 'Largura', axis: 'X', value: dimX },
    { label: 'Altura', axis: 'Y', value: dimY },
    { label: 'Profundidade', axis: 'Z', value: dimZ },
  ];

  return (
    <div className="bg-[var(--workbench-panel)]/90 backdrop-blur-md border border-[var(--surface-container-high)] rounded-2xl px-3 py-2 shadow-xl min-w-[172px]">
      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--on-surface-variant)] block mb-1">
        Dimensões 3D
      </span>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase font-bold text-[var(--on-surface-variant)]">
            {row.label} ({row.axis})
          </span>
          <span className="text-[12px] font-mono font-bold text-[var(--workbench-text)]">
            {row.value}
            <span className="text-[9px] font-sans text-[var(--on-surface-variant)]"> mm</span>
          </span>
        </div>
      ))}
    </div>
  );
};
