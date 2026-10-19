import React from 'react';
import type { EstojoBorrachaConfig, EstojoDimensions } from '../types/estojoBorracha';
import {
  ALTURA_MAX,
  ALTURA_MIN,
  CAIXA_MAX,
  CAIXA_MIN,
  RIPAS_MAX,
  RIPAS_MIN,
} from '../lib/estojoBorracha/presets';
import { FontPicker } from './FontPicker';
import { Download, FileText, NotebookPen, Type, Ruler, Palette, Layers } from 'lucide-react';

interface Props {
  config: EstojoBorrachaConfig;
  onChange: (newConfig: EstojoBorrachaConfig) => void;
  dimensions: EstojoDimensions;
  onQuickDownloadSTL: () => void;
  onQuickDownload3MF: () => void;
  exporting?: 'stl' | '3mf' | null;
}

export const EstojoBorrachaControls: React.FC<Props> = ({
  config,
  onChange,
  dimensions,
  onQuickDownloadSTL,
  onQuickDownload3MF,
  exporting = null,
}) => {
  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <NotebookPen className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Estojo Borracha com Nome
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Porta de enrolar print-in-place, 4 peças, capa personalizada.
        </p>
      </header>

      {/* 01. Nome & Tipografia */}
      <section className="space-y-4">
        <SectionTitle icon={<Type className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01. Nome na Capa
        </SectionTitle>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Nome / Texto</label>
            <span className="text-[10px] font-mono text-[#632CE5]">{config.text || '(sem texto)'}</span>
          </div>
          <input
            type="text"
            value={config.text}
            onChange={(e) => onChange({ ...config, text: e.target.value.substring(0, 14) })}
            placeholder="Nome do aluno (ex: Ana)"
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-colors"
          />
        </div>

        <FontPicker fontFamily={config.fontFamily} onChange={(patch) => onChange({ ...config, ...patch })} />

        <RangeControl
          label="Altura da Letra"
          unit="mm"
          min="6"
          max="14"
          step="1"
          number={config.letterHeight}
          onChange={(v) => onChange({ ...config, letterHeight: v })}
        />

        <RangeControl
          label="Relevo (+) / Vazio (−)"
          unit="mm"
          min="-2"
          max="2"
          step="0.5"
          number={config.textoProf}
          onChange={(v) => onChange({ ...config, textoProf: v })}
        />
      </section>

      {/* 02. Dimensões */}
      <section className="space-y-4">
        <SectionTitle icon={<Ruler className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Dimensões
        </SectionTitle>

        <RangeControl
          label="Comprimento Interno (lápis)"
          unit="mm"
          min={String(CAIXA_MIN)}
          max={String(CAIXA_MAX)}
          step="5"
          number={config.compInterno}
          onChange={(v) => onChange({ ...config, compInterno: v })}
        />

        <RangeControl
          label="Altura da Caixa (abertura)"
          unit="mm"
          min={String(ALTURA_MIN)}
          max={String(ALTURA_MAX)}
          step="2"
          number={config.alturaTotal}
          onChange={(v) => onChange({ ...config, alturaTotal: v })}
        />

        <RangeControl
          label="Número de Ripas"
          unit=""
          min={String(RIPAS_MIN)}
          max={String(RIPAS_MAX)}
          step="1"
          number={config.nRipas}
          onChange={(v) => onChange({ ...config, nRipas: v })}
        />

        <RangeControl
          label="Largura da Capa"
          unit="mm"
          min="30"
          max="120"
          step="2"
          number={config.capaLarg}
          onChange={(v) => onChange({ ...config, capaLarg: v })}
        />
      </section>

      {/* 03. Cores */}
      <section className="space-y-4">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Cores (2 filamentos)
        </SectionTitle>
        <ColorField
          label="Caixa / Porta / Plugue"
          value={config.caixaColor}
          onChange={(c) => onChange({ ...config, caixaColor: c })}
        />
        <ColorField
          label="Capa (faixa deslizante)"
          value={config.capaColor}
          onChange={(c) => onChange({ ...config, capaColor: c })}
        />
      </section>

      {/* 04. Resumo & Download */}
      <section className="space-y-4">
        <SectionTitle icon={<Layers className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Resumo & Download
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <Stat label="Dimensões" value={`${dimensions.dimX} × ${dimensions.dimY} × ${dimensions.dimZ} mm`} />
          <Stat label="Volume" value={`${dimensions.volumeCm3} cm³`} />
          <Stat label="Peso" value={`${dimensions.weightGrams} g`} />
          <Stat label="Tempo" value={`${dimensions.printTimeMinutes} min`} />
          <Stat label="Curso da porta" value={`${dimensions.cursoMax} mm`} />
          <Stat label="Largura do nome" value={`${dimensions.nameWidthMm} mm`} />
        </div>

        <button
          type="button"
          onClick={onQuickDownloadSTL}
          disabled={exporting !== null}
          className="btn-primary w-full"
        >
          <Download className="w-4 h-4" />
          {exporting === 'stl' ? 'Gerando STL…' : 'Baixar 4 STLs'}
        </button>
        <button
          type="button"
          onClick={onQuickDownload3MF}
          disabled={exporting !== null}
          className="btn-primary w-full"
        >
          <Download className="w-4 h-4" />
          {exporting === '3mf' ? 'Gerando 3MF…' : 'Baixar 3MF (Multicolor)'}
        </button>
        <a
          href="/estojo_borracha_instrucoes.pdf"
          download="Estojo_Borracha_Instrucoes.pdf"
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Baixar Instruções (PDF)
        </a>
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
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 px-2 py-1 bg-white border border-[var(--surface-container-high)] rounded text-[10px] font-mono text-right text-[#632CE5] focus:outline-none focus:border-[#632CE5] transition-colors"
          />
          {unit && <span className="text-[10px] font-mono text-[#632CE5]">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={number}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#632CE5] h-1.5 bg-[var(--workbench-viewport)] rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)]">
      <div className="text-[8px] uppercase font-bold text-zinc-500">{label}</div>
      <div className="font-mono font-bold text-[var(--workbench-text)]">{value}</div>
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
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
        />
        <span className="text-[10px] font-mono font-bold text-[var(--workbench-text)] uppercase">{value}</span>
      </div>
    </div>
  );
}
