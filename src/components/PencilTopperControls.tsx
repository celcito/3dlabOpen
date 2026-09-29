import React from 'react';
import type { PencilTopperConfig, Model3DDimensions } from '../types/pencilTopper';
import { PENCIL_MODELS, PENCIL_COLOR_PALETTES, PRESET_SYMBOLS } from '../lib/pencilTopper/presets';
import { FontPicker } from './FontPicker';
import {
  Download,
  Sparkles,
  Upload,
  Circle,
  Hexagon,
  Box,
  Palette,
  PenTool,
  Sliders,
  Type,
} from 'lucide-react';

interface PencilTopperControlsProps {
  config: PencilTopperConfig;
  onChange: (newConfig: PencilTopperConfig) => void;
  dimensions: Model3DDimensions;
  onQuickDownload3MF: () => void;
  onOpenSvgConverter: () => void;
}

export const PencilTopperControls: React.FC<PencilTopperControlsProps> = ({
  config,
  onChange,
  dimensions,
  onQuickDownload3MF,
  onOpenSvgConverter,
}) => {
  const effectiveDiameter = Number((config.pencilDiameter + config.clearance).toFixed(1));
  const selectedModel = PENCIL_MODELS.find((model) => model.id === config.pencilModel);

  // Seleciona um modelo pré-definido de lápis / caneta
  const handleSelectModel = (modelId: PencilTopperConfig['pencilModel']) => {
    const selected = PENCIL_MODELS.find((m) => m.id === modelId);
    if (!selected) return;

    onChange({
      ...config,
      pencilModel: selected.id,
      pencilDiameter: selected.defaultDiameter,
      holeShape: selected.defaultHoleShape,
    });
  };

  // Aplica paleta recomendada de 2 cores
  const handleApplyPalette = (palette: (typeof PENCIL_COLOR_PALETTES)[0]) => {
    onChange({
      ...config,
      baseColor: palette.baseColor,
      reliefColor: palette.reliefColor,
    });
  };

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <PenTool className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Ponteira de Lápis
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Clips de lápis & canetas em 2 cores.
        </p>
      </header>

      {/* 01. Diâmetro & Encaixe */}
      <section className="space-y-4">
        <SectionTitle icon={<Sliders className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01. Diâmetro & Encaixe
        </SectionTitle>

        <div className="space-y-1.5">
          <label
            htmlFor="pencil-model"
            className="text-[9px] uppercase font-bold text-zinc-600 block"
          >
            Modelo do Lápis / Caneta
          </label>
          <select
            id="pencil-model"
            value={config.pencilModel}
            onChange={(event) => handleSelectModel(event.target.value as PencilTopperConfig['pencilModel'])}
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] cursor-pointer"
          >
            {PENCIL_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.emoji} {model.name} — Ø {model.defaultDiameter} mm
              </option>
            ))}
          </select>
          <p className="text-[9px] leading-snug text-zinc-600">{selectedModel?.description}</p>
        </div>

        <RangeControl
          label="Diâmetro do Lápis/Caneta"
          unit="mm"
          min="5.0"
          max="15.0"
          step="0.1"
          number={config.pencilDiameter}
          onChange={(value) =>
            onChange({ ...config, pencilDiameter: value, pencilModel: 'personalizado' })
          }
        />

        <RangeControl
          label="Folga de Encaixe (Clearance)"
          unit="mm"
          min="0"
          max="1.5"
          step="0.05"
          number={config.clearance}
          onChange={(value) => onChange({ ...config, clearance: value })}
        />

        <div className="flex items-center justify-between p-3 bg-[var(--surface-container-high)]/50 rounded-lg border border-[var(--surface-container-high)]">
          <span className="text-[9px] uppercase font-bold text-zinc-600">
            Diâmetro interno do furo
          </span>
          <span className="text-[14px] font-black text-[#632CE5] tracking-tighter font-mono">
            {effectiveDiameter} mm
            <span className="text-[10px] text-zinc-600 font-bold"> (+{config.clearance.toFixed(1)} folga)</span>
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">
            Formato do Furo
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...config, holeShape: 'round' })}
              className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                config.holeShape === 'round'
                  ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                  : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              Redondo
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...config, holeShape: 'hexagonal' })}
              className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                config.holeShape === 'hexagonal'
                  ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                  : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
              }`}
            >
              <Hexagon className="w-3.5 h-3.5" />
              Hexagonal
            </button>
          </div>
        </div>
      </section>

      {/* 02. Texto & Tipografia */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Type className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Texto & Tipografia
        </SectionTitle>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Texto / Nomes</label>
            <span className="text-[10px] font-mono text-[#632CE5]">{config.text}</span>
          </div>
          <input
            type="text"
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value.substring(0, 18) })}
            placeholder="Nome na ponteira (ex: Milene)"
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
          max="28"
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

      {/* 03. Ícone Lateral / Símbolo */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Ícone Lateral / Símbolo
        </SectionTitle>

        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_SYMBOLS.map((sym) => {
            const isSelected = config.symbolId === sym.id;
            return (
              <button
                key={sym.id}
                type="button"
                onClick={() => onChange({ ...config, symbolId: sym.id })}
                title={sym.name}
                className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                    : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                }`}
              >
                <span className="text-lg">{sym.emoji}</span>
                <span className="text-[9px] font-black uppercase truncate w-full text-center mt-0.5">
                  {sym.name}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenSvgConverter}
          className="w-full py-2.5 rounded-lg border border-[var(--workbench-line)] text-[9px] font-black uppercase tracking-wide text-[var(--on-surface-variant)] hover:border-[#632CE5]/50 hover:text-[#632CE5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Ícone (PNG/JPG/SVG)
        </button>

        <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/30 space-y-2">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-orange-500">
            <Sparkles className="w-3.5 h-3.5" />
            Conversor de SVG 3D
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)] leading-relaxed">
            <strong>DICA:</strong> transforme um desenho ou imagem em vetor com linhas reforçadas e
            prontas para impressão 3D.
          </p>
          <button
            type="button"
            onClick={onOpenSvgConverter}
            className="text-[9px] font-black uppercase tracking-wide text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            Abrir Conversor de SVG →
          </button>
        </div>
      </section>

      {/* 04. Base & Espessura */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Base & Espessura
        </SectionTitle>

        <RangeControl
          label="Borda / Contorno da Base"
          unit="mm"
          min="1.0"
          max="6.0"
          step="0.2"
          number={config.outlineSize}
          onChange={(value) => onChange({ ...config, outlineSize: value })}
        />

        <RangeControl
          label="Espessura da Parede da Base"
          unit="mm"
          min="1.0"
          max="4.5"
          step="0.2"
          number={config.baseWallThickness}
          onChange={(value) => onChange({ ...config, baseWallThickness: value })}
        />

        <RangeControl
          label="Espessura das Letras em Relevo"
          unit="mm"
          min="0.8"
          max="4.0"
          step="0.2"
          number={config.reliefThickness}
          onChange={(value) => onChange({ ...config, reliefThickness: value })}
        />
      </section>

      {/* 05. Cores do Modelo */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          05. Cores do Modelo
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="1. Corpo da Base"
            value={config.baseColor}
            onChange={(color) => onChange({ ...config, baseColor: color })}
          />
          <ColorField
            label="2. Letras em Relevo"
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
            <span className="text-[9px] uppercase font-bold text-zinc-600">
              Volume & Peso estimado
            </span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              {dimensions.volumeCm3} cm³ • ~{dimensions.weightGrams}g PLA
            </span>
          </div>
        </div>

        <button type="button" onClick={onQuickDownload3MF} className="btn-primary">
          <Download className="w-4 h-4" />
          Baixar 3MF (Multicolor)
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
