import React, { useRef } from 'react';
import type { ThermoformConfig, ThermoformKitDimensions } from '../types/thermoform';
import {
  BASE_THICKNESS_MAX,
  BASE_THICKNESS_MIN,
  CLIP_COUNT_MAX,
  CLIP_COUNT_MIN,
  CLIP_GAP_MAX,
  CLIP_GAP_MIN,
  CLIP_LENGTH_MAX,
  CLIP_LENGTH_MIN,
  CLIP_THICKNESS_MAX,
  CLIP_THICKNESS_MIN,
  CLIP_WIDTH_MAX,
  CLIP_WIDTH_MIN,
  DOME_HEIGHT_MAX,
  DOME_HEIGHT_MIN,
  FLANGE_THICKNESS_MAX,
  FLANGE_THICKNESS_MIN,
  FLOOR_THICKNESS_MAX,
  FLOOR_THICKNESS_MIN,
  RIM_HEIGHT_MAX,
  RIM_HEIGHT_MIN,
  RIM_WIDTH_MAX,
  RIM_WIDTH_MIN,
  RING_HEIGHT_MAX,
  RING_HEIGHT_MIN,
  RING_WALL_MAX,
  RING_WALL_MIN,
  SIZE_MAX,
  SIZE_MIN,
  THERMOFORM_PRESETS,
} from '../lib/thermoform/presets';
import { Download, Shapes, Ruler, Layers, Palette, Upload, X } from 'lucide-react';

interface ThermoformControlsProps {
  config: ThermoformConfig;
  onChange: (newConfig: ThermoformConfig) => void;
  dimensions: ThermoformKitDimensions;
  onQuickDownloadSTL: () => void;
  onQuickDownload3MF: () => void;
  exporting?: 'stl' | '3mf' | null;
}

export const ThermoformControls: React.FC<ThermoformControlsProps> = ({
  config,
  onChange,
  dimensions,
  onQuickDownloadSTL,
  onQuickDownload3MF,
  exporting = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSvgFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (text.trim()) onChange({ ...config, svgPathData: text });
    };
    reader.readAsText(file);
  };

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <Shapes className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Kit Termoformado
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Molde + prensa + folha + encaixes, a partir de um contorno.
        </p>
      </header>

      {/* 01. Forma */}
      <section className="space-y-4">
        <SectionTitle icon={<Shapes className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01. Forma
        </SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {THERMOFORM_PRESETS.map((preset) => {
            const isSelected = !config.svgPathData && config.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ ...config, preset: preset.id, svgPathData: null })}
                className={`p-2 rounded-lg border transition-all text-center ${
                  isSelected
                    ? 'border-[#632CE5] bg-[#632CE5]/10'
                    : 'border-[var(--workbench-line)] hover:border-[#632CE5]/40'
                }`}
              >
                <span className="text-[9px] font-black uppercase">{preset.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSvgFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-3 rounded-lg border border-dashed border-[var(--workbench-line)] hover:border-[#632CE5]/50 transition-colors flex items-center justify-center gap-2 text-[10px] uppercase font-bold text-[var(--on-surface-variant)] hover:text-[#632CE5]"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar SVG (maior contorno)
          </button>
          {config.svgPathData && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#632CE5]/10 border border-[#632CE5]/30">
              <span className="text-[9px] font-black uppercase text-[#632CE5] truncate">
                SVG custom em uso
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...config, svgPathData: null })}
                className="p-1 rounded hover:bg-[#632CE5]/20 text-[var(--on-surface-variant)]"
                title="Voltar ao preset"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 02. Escala */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Ruler className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Escala
        </SectionTitle>

        <RangeControl
          label="Tamanho (maior lado)"
          unit="mm"
          min={String(SIZE_MIN)}
          max={String(SIZE_MAX)}
          step="1"
          number={config.sizeMm}
          onChange={(value) => onChange({ ...config, sizeMm: value })}
        />

        <div className="grid grid-cols-2 gap-2">
          <RangeControl
            label="Base do molde"
            unit="mm"
            min={String(BASE_THICKNESS_MIN)}
            max={String(BASE_THICKNESS_MAX)}
            step="0.5"
            number={config.baseThickness}
            onChange={(value) => onChange({ ...config, baseThickness: value })}
          />
          <RangeControl
            label="Altura do domo"
            unit="mm"
            min={String(DOME_HEIGHT_MIN)}
            max={String(DOME_HEIGHT_MAX)}
            step="1"
            number={config.domeHeight}
            onChange={(value) => onChange({ ...config, domeHeight: value })}
          />
          <RangeControl
            label="Flange da prensa"
            unit="mm"
            min={String(FLANGE_THICKNESS_MIN)}
            max={String(FLANGE_THICKNESS_MAX)}
            step="0.5"
            number={config.flangeThickness}
            onChange={(value) => onChange({ ...config, flangeThickness: value })}
          />
          <RangeControl
            label="Parede da prensa"
            unit="mm"
            min={String(RING_WALL_MIN)}
            max={String(RING_WALL_MAX)}
            step="0.5"
            number={config.ringWallThickness}
            onChange={(value) => onChange({ ...config, ringWallThickness: value })}
          />
          <RangeControl
            label="Altura do anel"
            unit="mm"
            min={String(RING_HEIGHT_MIN)}
            max={String(RING_HEIGHT_MAX)}
            step="1"
            number={config.ringHeight}
            onChange={(value) => onChange({ ...config, ringHeight: value })}
          />
          <RangeControl
            label="Piso da folha"
            unit="mm"
            min={String(FLOOR_THICKNESS_MIN)}
            max={String(FLOOR_THICKNESS_MAX)}
            step="0.2"
            number={config.floorThickness}
            onChange={(value) => onChange({ ...config, floorThickness: value })}
          />
          <RangeControl
            label="Largura do aro"
            unit="mm"
            min={String(RIM_WIDTH_MIN)}
            max={String(RIM_WIDTH_MAX)}
            step="0.5"
            number={config.rimWidth}
            onChange={(value) => onChange({ ...config, rimWidth: value })}
          />
          <RangeControl
            label="Altura do aro"
            unit="mm"
            min={String(RIM_HEIGHT_MIN)}
            max={String(RIM_HEIGHT_MAX)}
            step="0.5"
            number={config.rimHeight}
            onChange={(value) => onChange({ ...config, rimHeight: value })}
          />
        </div>
      </section>

      {/* 03. Peças */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Layers className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Peças
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          <ToggleField
            label="Molde"
            checked={config.parts.mold}
            onChange={(checked) => onChange({ ...config, parts: { ...config.parts, mold: checked } })}
          />
          <ToggleField
            label="Prensa"
            checked={config.parts.press}
            onChange={(checked) => onChange({ ...config, parts: { ...config.parts, press: checked } })}
          />
          <ToggleField
            label="Folha"
            checked={config.parts.folha}
            onChange={(checked) => onChange({ ...config, parts: { ...config.parts, folha: checked } })}
          />
          <ToggleField
            label="Encaixes"
            checked={config.parts.encaixe}
            onChange={(checked) => onChange({ ...config, parts: { ...config.parts, encaixe: checked } })}
          />
        </div>

        {config.parts.encaixe && (
          <div className="grid grid-cols-2 gap-2">
            <RangeControl
              label="Quantidade"
              unit="x"
              min={String(CLIP_COUNT_MIN)}
              max={String(CLIP_COUNT_MAX)}
              step="1"
              number={config.clipCount}
              onChange={(value) => onChange({ ...config, clipCount: value })}
            />
            <RangeControl
              label="Comprimento"
              unit="mm"
              min={String(CLIP_LENGTH_MIN)}
              max={String(CLIP_LENGTH_MAX)}
              step="0.5"
              number={config.clipLength}
              onChange={(value) => onChange({ ...config, clipLength: value })}
            />
            <RangeControl
              label="Largura"
              unit="mm"
              min={String(CLIP_WIDTH_MIN)}
              max={String(CLIP_WIDTH_MAX)}
              step="0.2"
              number={config.clipWidth}
              onChange={(value) => onChange({ ...config, clipWidth: value })}
            />
            <RangeControl
              label="Fala"
              unit="mm"
              min={String(CLIP_GAP_MIN)}
              max={String(CLIP_GAP_MAX)}
              step="0.2"
              number={config.clipGap}
              onChange={(value) => onChange({ ...config, clipGap: value })}
            />
            <RangeControl
              label="Espessura"
              unit="mm"
              min={String(CLIP_THICKNESS_MIN)}
              max={String(CLIP_THICKNESS_MAX)}
              step="0.1"
              number={config.clipThickness}
              onChange={(value) => onChange({ ...config, clipThickness: value })}
            />
          </div>
        )}
      </section>

      {/* 04. Cores */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Cores
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="1. Molde"
            value={config.moldColor}
            onChange={(color) => onChange({ ...config, moldColor: color })}
          />
          <ColorField
            label="2. Prensa"
            value={config.pressColor}
            onChange={(color) => onChange({ ...config, pressColor: color })}
          />
          <ColorField
            label="3. Folha"
            value={config.folhaColor}
            onChange={(color) => onChange({ ...config, folhaColor: color })}
          />
          <ColorField
            label="4. Encaixes"
            value={config.clipColor}
            onChange={(color) => onChange({ ...config, clipColor: color })}
          />
        </div>
      </section>

      {/* 05. Exportar */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Download className="w-3.5 h-3.5 text-[#632CE5]" />}>
          05. Exportar
        </SectionTitle>

        <div className="p-3 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">Layout do kit</span>
            <span className="text-[14px] font-black text-[#632CE5] tracking-tighter font-mono">
              {dimensions.dimX} <span className="text-[10px] text-zinc-600 font-bold">×</span>{' '}
              {dimensions.dimY} <span className="text-[10px] text-zinc-600 font-bold">×</span>{' '}
              {dimensions.dimZ} <span className="text-[10px] text-zinc-600 font-bold">mm</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-zinc-600">Peças geradas</span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              {dimensions.partCount}
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
          {exporting === 'stl' ? 'Gerando STL…' : 'Baixar STL (zip por peça)'}
        </button>

        <button
          type="button"
          onClick={onQuickDownload3MF}
          disabled={exporting !== null}
          className="btn-primary"
        >
          <Download className="w-4 h-4" />
          {exporting === '3mf' ? 'Gerando 3MF…' : 'Baixar 3MF (Bambu)'}
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

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
        checked
          ? 'border-[#632CE5] bg-[#632CE5]/10'
          : 'border-[var(--workbench-line)] hover:border-[#632CE5]/40'
      }`}
    >
      <span className="text-[9px] font-black uppercase text-[var(--workbench-text)]">{label}</span>
      <span
        className={`w-3.5 h-3.5 rounded-full border-2 ${
          checked ? 'bg-[#632CE5] border-[#632CE5]' : 'bg-transparent border-zinc-400'
        }`}
      />
    </button>
  );
}
