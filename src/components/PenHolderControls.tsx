import React from 'react';
import type { PenHolderConfig, PenHolderDimensions } from '../types/penHolder';
import {
  PENCIL_COLOR_PALETTES,
  CUP_HEIGHT_MIN,
  CUP_HEIGHT_MAX,
  CUP_WALL_MIN,
  CUP_WALL_MAX,
  CUP_FLOOR_MIN,
  CUP_FLOOR_MAX,
  RIM_MIN,
  RIM_MAX,
} from '../lib/penHolder/presets';
import { computeHolderMetrics } from '../lib/penHolder/geometry';
import { FontPicker } from './FontPicker';
import {
  Download,
  PenLine,
  Palette,
  Box,
  CupSoda,
  Type,
} from 'lucide-react';

interface PenHolderControlsProps {
  config: PenHolderConfig;
  onChange: (newConfig: PenHolderConfig) => void;
  dimensions: PenHolderDimensions;
  onQuickDownloadSTL: () => void;
  onQuickDownload3MF: () => void;
  exporting?: 'stl' | '3mf' | null;
}

export const PenHolderControls: React.FC<PenHolderControlsProps> = ({
  config,
  onChange,
  dimensions,
  onQuickDownloadSTL,
  onQuickDownload3MF,
  exporting = null,
}) => {
  const handleApplyPalette = (palette: (typeof PENCIL_COLOR_PALETTES)[0]) => {
    onChange({
      ...config,
      baseColor: palette.baseColor,
      reliefColor: palette.reliefColor,
    });
  };

  const metrics = computeHolderMetrics(config);
  const wallMargin = Number(metrics.cavityMarginMm.toFixed(1));
  const multipleBodies = dimensions.bodyCount > 1;

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <PenLine className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Porta Canetas com Nome
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Silhueta do nome extrudada, oca, em 2 cores.
        </p>
      </header>

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
            onChange={(e) => onChange({ ...config, text: e.target.value.substring(0, 18) })}
            placeholder="Nome no porta-canetas (ex: Milene)"
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
          min="10"
          max="60"
          step="1"
          number={config.letterHeight}
          onChange={(value) => onChange({ ...config, letterHeight: value })}
        />

        <RangeControl
          label="Espaçamento entre Letras"
          unit="mm"
          min="0"
          max="2.5"
          step="0.1"
          number={config.letterSpacing}
          onChange={(value) => onChange({ ...config, letterSpacing: value })}
        />

        <RangeControl
          label="Espessura da Fonte"
          unit="x"
          min="0.5"
          max="2.0"
          step="0.1"
          number={config.fontWeightScale}
          onChange={(value) => onChange({ ...config, fontWeightScale: value })}
        />
      </section>

      {/* 02. Contorno & Aro */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Contorno & Aro
        </SectionTitle>

        <RangeControl
          label="Borda / Contorno do Nome"
          unit="mm"
          min="1.0"
          max="6.0"
          step="0.2"
          number={config.outlineSize}
          onChange={(value) => onChange({ ...config, outlineSize: value })}
        />

        <RangeControl
          label="Espessura do Aro Colorido"
          unit="mm"
          min={String(RIM_MIN)}
          max={String(RIM_MAX)}
          step="0.2"
          number={config.rimThickness}
          onChange={(value) => onChange({ ...config, rimThickness: value })}
        />
      </section>

      {/* 03. Altura & Parede */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<CupSoda className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Altura & Parede
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          {([['tray', 'Placa + Bandeja'], ['cup', 'Copo do Nome']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...config, layout: value })}
              className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-colors ${
                (config.layout ?? 'tray') === value
                  ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                  : 'border-[var(--surface-container-high)] text-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(config.layout ?? 'tray') === 'tray' && (
          <>
            <RangeControl label="Profundidade" unit="mm" min="15" max="80" step="1"
              number={config.trayDepth ?? Math.round(config.letterHeight * 0.9)} onChange={(value) => onChange({ ...config, trayDepth: value })} />
            <RangeControl label="Altura extra (para canetas)" unit="mm" min="0" max="80" step="1"
              number={config.extraHeight ?? 30} onChange={(value) => onChange({ ...config, extraHeight: value })} />
            <RangeControl label="Largura mín. da célula" unit="mm" min="6" max="30" step="1"
              number={config.minCellWidth ?? 10} onChange={(value) => onChange({ ...config, minCellWidth: value })} />
          </>
        )}

        {config.layout === 'cup' && (
        <RangeControl
          label="Altura da Peça"
          unit="mm"
          min={String(CUP_HEIGHT_MIN)}
          max={String(CUP_HEIGHT_MAX)}
          step="1"
          number={config.cupHeight}
          onChange={(value) => onChange({ ...config, cupHeight: value })}
        />
        )}

        <RangeControl
          label="Parede da Cavidade"
          unit="mm"
          min={String(CUP_WALL_MIN)}
          max={String(CUP_WALL_MAX)}
          step="0.1"
          number={config.wallThickness}
          onChange={(value) => onChange({ ...config, wallThickness: value })}
        />

        <RangeControl
          label="Espessura do Fundo"
          unit="mm"
          min={String(CUP_FLOOR_MIN)}
          max={String(CUP_FLOOR_MAX)}
          step="0.5"
          number={config.floorThickness}
          onChange={(value) => onChange({ ...config, floorThickness: value })}
        />

        <div className="p-3 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">Parede efetiva</span>
            <span className="text-[14px] font-black text-[#632CE5] tracking-tighter font-mono">
              {wallMargin} mm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">
              Cascas disjuntas
            </span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              {dimensions.bodyCount || 1}
            </span>
          </div>
        </div>

        {metrics.wallClamped && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-amber-500">
              Parede limitada pelo contorno
            </span>
            <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
              A parede pedida é maior que o contorno permite. A cavidade foi reduzida ao mínimo
              para manter a peça válida — aumente o contorno ou reduza a parede.
            </p>
          </div>
        )}

        {multipleBodies && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wide text-amber-500">
              Letras separadas
            </span>
            <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
              A silhueta gerou {dimensions.bodyCount} peças disjuntas apoiadas na chapa. Use uma
              fonte cursiva ou reduza o espaçamento para unir as letras.
            </p>
          </div>
        )}
      </section>

      {/* 04. Cores do Modelo */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Cores do Modelo
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="1. Corpo da Peça"
            value={config.baseColor}
            onChange={(color) => onChange({ ...config, baseColor: color })}
          />
          <ColorField
            label="2. Aro Colorido"
            value={config.reliefColor}
            onChange={(color) => onChange({ ...config, reliefColor: color })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">
            Paletas Recomendadas
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {PENCIL_COLOR_PALETTES.map((palette) => {
              const isSelected =
                config.baseColor.toLowerCase() === palette.baseColor.toLowerCase() &&
                config.reliefColor.toLowerCase() === palette.reliefColor.toLowerCase();

              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => handleApplyPalette(palette)}
                  className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-center ${
                    isSelected
                      ? 'border-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] hover:border-[#632CE5]/40'
                  }`}
                >
                  <div className="flex items-center -space-x-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: palette.baseColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: palette.reliefColor }}
                    />
                  </div>
                  <span className="text-[9px] font-black uppercase truncate w-full">
                    {palette.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dimensões & Exportação */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <div className="p-3 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">Dimensões 3D</span>
            <span className="text-[14px] font-black text-[#632CE5] tracking-tighter font-mono">
              {dimensions.dimX} <span className="text-[10px] text-zinc-600 font-bold">×</span>{' '}
              {dimensions.dimY} <span className="text-[10px] text-zinc-600 font-bold">×</span>{' '}
              {dimensions.dimZ} <span className="text-[10px] text-zinc-600 font-bold">mm</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">Largura do nome</span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              {dimensions.nameWidthMm} mm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">
              Volume & Peso estimado
            </span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              {dimensions.volumeCm3} cm³ • ~{dimensions.weightGrams}g PLA
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">
              Tempo de impressão
            </span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              ~{dimensions.printTimeMinutes} min
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onQuickDownloadSTL}
          disabled={exporting !== null}
          className="btn-primary"
        >
          <Download className="w-4 h-4" />
          {exporting === 'stl' ? 'Gerando STL…' : 'Baixar STL (1 peça)'}
        </button>

        <button
          type="button"
          onClick={onQuickDownload3MF}
          disabled={exporting !== null}
          className="btn-primary"
        >
          <Download className="w-4 h-4" />
          {exporting === '3mf' ? 'Gerando 3MF…' : 'Baixar 3MF (Multicolor)'}
        </button>
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] flex flex-col gap-1.5">
      <span className="text-[9px] uppercase font-bold text-zinc-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-[10px] font-mono font-bold text-[var(--workbench-text)] uppercase">
          {value}
        </span>
      </div>
    </div>
  );
}
