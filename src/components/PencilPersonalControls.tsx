import React from 'react';
import type {
  PencilFace,
  PencilFilamentIndex,
  PencilPersonalConfig,
  PencilVariantId,
} from '../types/pencilPersonal';
import type { GeneratedPencilPersonal } from '../types/pencilPersonal';
import {
  FILAMENT_COLORS,
  FILAMENT_NAMES,
  MIN_LETTER_THICKNESS,
  VARIANTS,
  WALL_RESERVE,
} from '../lib/pencilPersonal/presets';
import { FontPicker } from './FontPicker';
import { SymbolPicker } from './SymbolPicker';
import { Type, Crosshair, Layers, Palette, Download, Ruler, Boxes, Sparkles } from 'lucide-react';

const FACES: PencilFace[] = [1, 2, 3, 4, 5, 6];
const FILAMENTS: PencilFilamentIndex[] = [1, 2, 3, 4, 5];

interface PencilPersonalControlsProps {
  config: PencilPersonalConfig;
  onChange: (config: PencilPersonalConfig) => void;
  generated: GeneratedPencilPersonal | null;
  onExport: () => void;
  exporting: boolean;
}

export const PencilPersonalControls: React.FC<PencilPersonalControlsProps> = ({
  config,
  onChange,
  generated,
  onExport,
  exporting,
}) => {
  const wallThickness = generated?.wallThickness ?? null;
  const maxDepth = wallThickness
    ? Math.max(MIN_LETTER_THICKNESS, wallThickness - WALL_RESERVE)
    : null;
  const variant = VARIANTS[config.variant];
  const bodyHalfLength = variant.bodyLength / 2;
  // A posição varia para o centro do texto, não para a sua borda: meia largura
  // em cada ponta mantém o texto inteiro dentro da área de gravação.
  const halfTextWidth = (generated?.textWidth ?? 0) / 2;
  const engraveRangeMin = variant.engraveMinY + bodyHalfLength + halfTextWidth;
  const engraveRangeMax = variant.engraveMaxY + bodyHalfLength - halfTextWidth;

  const handleVariantChange = (id: PencilVariantId) => {
    if (id === config.variant) return;
    const next = VARIANTS[id];
    const half = next.bodyLength / 2;
    const min = next.engraveMinY + half;
    const max = next.engraveMaxY + half;
    const fallback = (next.engraveMinY + next.engraveMaxY) / 2 + half;
    const positionAlongAxis = Number.isFinite(config.positionAlongAxis)
      ? Math.min(max, Math.max(min, config.positionAlongAxis))
      : fallback;
    onChange({ ...config, variant: id, positionAlongAxis });
  };

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <Type className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Personalizar Lápis
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Nome gravado no {variant.label.toLowerCase()} + placa nova.
        </p>
      </header>

      {/* 00. Modelo */}
      <section className="space-y-4">
        <SectionTitle icon={<Boxes className="w-3.5 h-3.5 text-[#632CE5]" />}>
          00. Modelo
        </SectionTitle>

        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(VARIANTS).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleVariantChange(item.id)}
              className={`py-2.5 px-2 rounded-lg text-[10px] font-black uppercase leading-tight transition-colors ${
                config.variant === item.id
                  ? 'bg-[#632CE5] text-white'
                  : 'bg-[var(--surface-container-high)]/60 text-zinc-500 hover:text-[var(--workbench-text)]'
              }`}
              title={item.label}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 01. Nome & Tipografia */}
      <section className="space-y-4">
        <SectionTitle icon={<Type className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01. Nome & Tipografia
        </SectionTitle>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Nome / Texto</label>
            <span className="text-[10px] font-mono text-[#632CE5]">{config.text}</span>
          </div>
          <input
            type="text"
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value.substring(0, 24) })}
            placeholder="Nome no lápis (ex: Milene)"
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-colors"
          />
        </div>

        <FontPicker
          fontFamily={config.fontFamily}
          customFontName={config.customFontName}
          onChange={(patch) => onChange({ ...config, ...patch })}
        />

        <RangeControl
          label="Tamanho da Letra"
          unit="mm"
          min="6"
          max="40"
          step="1"
          number={config.letterHeight}
          onChange={(value) => onChange({ ...config, letterHeight: value })}
        />

        <RangeControl
          label="Espaçamento entre Letras"
          unit="mm"
          min="0"
          max="6"
          step="0.1"
          number={config.letterSpacing}
          onChange={(value) => onChange({ ...config, letterSpacing: value })}
        />

        <RangeControl
          label="Espessura da Fonte"
          unit="x"
          min="0.2"
          max="2.0"
          step="0.1"
          number={config.fontWeightScale}
          onChange={(value) => onChange({ ...config, fontWeightScale: value })}
        />
      </section>

      {/* 02. Posição */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Crosshair className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Posição
        </SectionTitle>

        {variant.placement === 'face' ? (
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Face do Hexágono</label>
            <div className="grid grid-cols-6 gap-1.5">
              {FACES.map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => onChange({ ...config, face })}
                  className={`py-2 rounded-lg text-[11px] font-black transition-colors ${
                    config.face === face
                      ? 'bg-[#632CE5] text-white'
                      : 'bg-[var(--surface-container-high)]/60 text-zinc-500 hover:text-[var(--workbench-text)]'
                  }`}
                  title={`Face ${face}`}
                >
                  {face}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <RangeControl
            label="Posição angular"
            unit="°"
            min="0"
            max="359"
            step="1"
            number={config.angleDeg}
            onChange={(value) =>
              onChange({
                ...config,
                angleDeg: Math.min(359, Math.max(0, Math.round(value))),
              })
            }
          />
        )}

        <RangeControl
          label="Posição ao longo do eixo"
          unit="mm"
          min={String(engraveRangeMin)}
          max={String(engraveRangeMax)}
          step="0.5"
          number={config.positionAlongAxis}
          onChange={(value) => onChange({ ...config, positionAlongAxis: value })}
        />

        <button
          type="button"
          onClick={() =>
            onChange({
              ...config,
              positionAlongAxis: (engraveRangeMin + engraveRangeMax) / 2,
            })
          }
          className="w-full py-2.5 rounded-lg border border-[var(--workbench-line)] text-[9px] font-black uppercase tracking-wide text-[var(--on-surface-variant)] hover:border-[#632CE5]/50 hover:text-[#632CE5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5" />
          Centralizar no lápis
        </button>

        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] text-[10px]">
          <span className="text-zinc-500 font-bold uppercase tracking-wider">Centro</span>
          <span className="font-mono font-bold text-[#632CE5]">
            {(config.positionAlongAxis - bodyHalfLength).toFixed(1)} mm
          </span>
        </div>
      </section>

      {/* 03. Ícone & Posição */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Ícone & Posição
        </SectionTitle>

        <SymbolPicker
          symbolId={config.symbolId}
          symbolPosition={config.symbolPosition}
          onChange={(patch) => onChange({ ...config, ...patch })}
        />
      </section>

      {/* 04. Gravação */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Ruler className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Gravação
        </SectionTitle>

        <RangeControl
          label="Profundidade"
          unit="mm"
          min="0.4"
          max={maxDepth ? maxDepth.toFixed(1) : '1.4'}
          step="0.1"
          number={Math.min(config.depth, maxDepth ?? 1.4)}
          onChange={(value) => onChange({ ...config, depth: value })}
        />

        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="Parede" value={wallThickness ? `${wallThickness.toFixed(2)} mm` : '—'} />
          <Metric
            label="Prof. aplicada"
            value={generated ? `${generated.clampedDepth.toFixed(2)} mm` : '—'}
          />
        </div>

        <p className="text-[10px] leading-relaxed text-zinc-500">
          A profundidade é limitada pela parede da peça ({wallThickness ? `${wallThickness.toFixed(2)}` : '1.80'} mm)
          menos 0.4 mm de reserva. Mínimo de {MIN_LETTER_THICKNESS.toFixed(1)} mm.
        </p>
      </section>

      {/* 05. Cores */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          05. Cores
        </SectionTitle>

        <div className="space-y-1.5">
          <label className="text-[9px] uppercase font-bold text-zinc-600">
            Filamento das letras
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {FILAMENTS.map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => onChange({ ...config, filamentIndex: index })}
                className={`flex flex-col items-center gap-1.5 py-2 rounded-lg border transition-colors ${
                  config.filamentIndex === index
                    ? 'border-[#632CE5] bg-[#632CE5]/10'
                    : 'border-[var(--surface-container-high)] hover:border-zinc-400'
                }`}
                title={FILAMENT_NAMES[index]}
              >
                <span
                  className="w-5 h-5 rounded-full border border-black/15"
                  style={{ backgroundColor: FILAMENT_COLORS[index] }}
                />
                <span className="text-[8px] font-bold text-zinc-500">{index}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 06. Export */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Download className="w-3.5 h-3.5 text-[#632CE5]" />}>
          06. Export
        </SectionTitle>

        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-colors ${
            exporting
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait'
              : 'bg-[#632CE5] text-white hover:bg-[#5224c4]'
          }`}
        >
          {exporting ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-amber-300 border-t-transparent animate-spin" />
              Gerando…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Baixar 3MF
            </>
          )}
        </button>

        <p className="text-[10px] leading-relaxed text-zinc-500">
          Gera um copy do projeto com o nome gravado, letras como peça inlay e uma prancha nova
          (id {variant.letterPlateId}).
        </p>
      </section>
    </aside>
  );
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-black flex items-center gap-2">
      {icon}
      {children}
    </h3>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-2 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] flex flex-col gap-0.5">
      <span className="text-[9px] uppercase font-bold text-zinc-600">{label}</span>
      <span className="text-[11px] font-mono font-bold text-[#632CE5]">{value}</span>
    </div>
  );
}

function RangeControl({
  label,
  unit,
  min,
  max,
  step,
  number,
  onChange,
}: {
  label: string;
  unit: string;
  min: string;
  max: string;
  step: string;
  number: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3">
        <label className="text-[9px] uppercase font-bold text-zinc-600">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={number}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-16 px-2 py-1 bg-white border border-[var(--surface-container-high)] rounded text-[10px] font-mono text-right text-[#632CE5] focus:outline-none focus:border-[#632CE5] transition-colors"
          />
          <span className="text-[10px] font-mono text-[#632CE5]">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={number}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#632CE5] h-1.5 bg-[var(--workbench-viewport)] rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
