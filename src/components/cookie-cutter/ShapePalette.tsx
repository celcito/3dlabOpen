"use client";

import { PRIMITIVE_DEFAULTS, PRIMITIVE_METADATA, PrimitiveShape, PrimitiveParams } from "../../lib/cookie-cutter/primitives";

interface ShapePaletteProps {
  onAddPrimitive: (shape: PrimitiveShape, params: Record<string, number>) => void;
}

export function ShapePalette({ onAddPrimitive }: ShapePaletteProps) {
  const primitives = [
    { shape: "circle" as const, params: PRIMITIVE_DEFAULTS.circle },
    { shape: "rect" as const, params: PRIMITIVE_DEFAULTS.rect },
    { shape: "rounded-rect" as const, params: PRIMITIVE_DEFAULTS["rounded-rect"] },
    { shape: "triangle" as const, params: PRIMITIVE_DEFAULTS.triangle },
    { shape: "star" as const, params: PRIMITIVE_DEFAULTS.star },
    { shape: "polygon" as const, params: PRIMITIVE_DEFAULTS.polygon },
    { shape: "heart" as const, params: PRIMITIVE_DEFAULTS.heart },
  ] as const;

  return (
    <div className="bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg p-4 space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 border-b border-[#E2E3DD] pb-2">
        Formas Primitivas
      </h4>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {primitives.map(({ shape, params }) => {
          const meta = PRIMITIVE_METADATA[shape];
          return (
            <button
              key={shape}
              onClick={() => onAddPrimitive(shape, params)}
              className="bg-white border border-[#E2E3DD] p-2 rounded hover:border-[#632CE5]/50 hover:bg-[#632CE5]/5 transition-all cursor-pointer flex flex-col items-center gap-1.5"
              title={meta.description}
            >
              <span className="text-[18px]">{meta.icon}</span>
              <span className="text-[9px] font-bold text-zinc-400 uppercase">{meta.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}