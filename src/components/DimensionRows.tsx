import React from 'react';

interface DimensionRowsProps {
  dimX: number;
  dimY: number;
  dimZ: number;
}

/** Largura (X), altura (Y) e profundidade (Z) do modelo, em mm. */
export const DimensionRows: React.FC<DimensionRowsProps> = ({ dimX, dimY, dimZ }) => {
  const rows = [
    { label: 'Largura (X)', value: dimX },
    { label: 'Altura (Y)', value: dimY },
    { label: 'Profundidade (Z)', value: dimZ },
  ];

  return (
    <>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase font-bold text-zinc-600">{row.label}</span>
          <span className="text-[12px] font-black text-[#632CE5] tracking-tighter font-mono">
            {row.value} <span className="text-[10px] text-zinc-600 font-bold">mm</span>
          </span>
        </div>
      ))}
    </>
  );
};
