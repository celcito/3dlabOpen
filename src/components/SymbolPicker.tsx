import React from 'react';
import { PRESET_SYMBOLS } from '../lib/pencilTopper/presets';
import { SymbolGlyph } from './SymbolGlyph';
import { ArrowLeft, ArrowRight, ArrowLeftRight } from 'lucide-react';

export type SymbolPosition = 'left' | 'right' | 'both';

const POSITION_OPTIONS: { id: SymbolPosition; label: string; icon: React.ReactNode }[] = [
  { id: 'left', label: 'Início', icon: <ArrowLeft className="w-3.5 h-3.5" /> },
  { id: 'right', label: 'Fim', icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { id: 'both', label: 'Ambos', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
];

interface SymbolPickerProps {
  symbolId: string;
  symbolPosition: SymbolPosition;
  onChange: (patch: { symbolId: string } | { symbolPosition: SymbolPosition }) => void;
  /** Mostra o seletor de posição mesmo sem símbolo preset (ex: ícone customizado). */
  showPosition?: boolean;
}

/** Grade de ícones + seletor de posição (início / fim / ambos). */
export const SymbolPicker: React.FC<SymbolPickerProps> = ({
  symbolId,
  symbolPosition,
  onChange,
  showPosition,
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-5 gap-1.5">
      {PRESET_SYMBOLS.map((sym) => {
        const isSelected = symbolId === sym.id;
        return (
          <button
            key={sym.id}
            type="button"
            onClick={() => onChange({ symbolId: sym.id })}
            title={sym.name}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              isSelected
                ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
            }`}
          >
            <SymbolGlyph id={sym.id} fallback={sym.emoji} />
            <span className="text-[9px] font-black uppercase truncate w-full text-center mt-0.5">
              {sym.name}
            </span>
          </button>
        );
      })}
    </div>

    {(showPosition ?? symbolId !== 'none') && (
      <div className="space-y-1.5">
        <label className="text-[9px] uppercase font-bold text-zinc-600 block">
          Posição do Ícone
        </label>
        <div className="grid grid-cols-3 gap-2">
          {POSITION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ symbolPosition: option.id })}
              className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                symbolPosition === option.id
                  ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                  : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);
