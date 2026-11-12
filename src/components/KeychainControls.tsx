import React from 'react';
import type { KeychainConfig, Model3DDimensions } from '../types/keychain';
import {
  PENCIL_COLOR_PALETTES,
  LOOP_GAP_MAX,
  LOOP_WALL_MIN,
} from '../lib/keychain/presets';
import { SYMBOL_GAP_FACTOR_MIN, SYMBOL_GAP_FACTOR_MAX } from '../lib/keychain/storage';
import { resolveLoopGapMm } from '../lib/keychain/loop';
import { TEXT_STYLE_PRESETS, stylePatch2Camadas } from '../lib/textStyles';
import { KEYCHAIN_THEME_PRESETS } from '../lib/keychain/themePresets';
import { FontPicker } from './FontPicker';
import { SymbolPicker } from './SymbolPicker';
import {
  Check,
  Download,
  KeyRound,
  Palette,
  Box,
  Link2,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react';

interface KeychainControlsProps {
  config: KeychainConfig;
  onChange: (newConfig: KeychainConfig) => void;
  dimensions: Model3DDimensions;
  onQuickDownloadSTL: () => void;
  onQuickDownload3MF: () => void;
  onOpenSvgConverter: () => void;
  exporting?: 'stl' | '3mf' | null;
}

export const KeychainControls: React.FC<KeychainControlsProps> = ({
  config,
  onChange,
  dimensions,
  onQuickDownloadSTL,
  onQuickDownload3MF,
  onOpenSvgConverter,
  exporting = null,
}) => {
  const handleApplyPalette = (palette: (typeof PENCIL_COLOR_PALETTES)[0]) => {
    onChange({
      ...config,
      baseColor: palette.baseColor,
      reliefColor: palette.reliefColor,
    });
  };

  const loopOuterDiameter = Number((config.loopHoleDiameter + 2 * config.loopWallThickness).toFixed(1));
  // Limite real da folga: acima dele a aba se soltaria do corpo (depende de outline e parede).
  const loopGapMax = Number(resolveLoopGapMm({ ...config, loopLetterGap: LOOP_GAP_MAX }).toFixed(1));
  const loopMinOuterDiameter = Number((config.loopHoleDiameter + 2 * LOOP_WALL_MIN).toFixed(1));

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Chaveiro Personalizado
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Nome em relevo + argola em 2 cores.
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
            placeholder="Nome no chaveiro (ex: Milene)"
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-colors"
          />
        </div>

        <FontPicker
          fontFamily={config.fontFamily}
          customFontName={config.customFontName}
          onChange={(patch) => onChange({ ...config, ...patch })}
        />

        <div className="space-y-2">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">
            Estilos Prontos
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TEXT_STYLE_PRESETS.map((style) => {
              const isSelected =
                config.fontFamily === style.fontFamily &&
                config.fontWeightScale === style.fontWeightScale &&
                config.outlineSize === style.outlineSize &&
                config.baseColor.toLowerCase() === style.baseColor.toLowerCase() &&
                config.reliefColor.toLowerCase() === style.reliefColor.toLowerCase();

              return (
                <button
                  key={style.id}
                  type="button"
                  title={style.description}
                  onClick={() => onChange({ ...config, ...stylePatch2Camadas(style) })}
                  className={`p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] hover:border-[#632CE5]/40'
                  }`}
                >
                  <span className="text-[9px] font-black uppercase text-[var(--on-surface-variant)] truncate">
                    {style.emoji} {style.name}
                  </span>
                  <div className="flex -space-x-1.5 shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: style.baseColor }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: style.reliefColor }}
                    />
                  </div>
                </button>
              );
            })}
            {KEYCHAIN_THEME_PRESETS.map((theme) => {
              const isSelected =
                config.symbolId === theme.patch.symbolId &&
                config.symbolPosition === theme.patch.symbolPosition &&
                config.baseColor.toLowerCase() === theme.patch.baseColor.toLowerCase() &&
                config.reliefColor.toLowerCase() === theme.patch.reliefColor.toLowerCase();

              return (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.description}
                  onClick={() => onChange({ ...config, ...theme.patch })}
                  className={`p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] hover:border-[#632CE5]/40'
                  }`}
                >
                  <span className="text-[9px] font-black uppercase text-[var(--on-surface-variant)] truncate">
                    {theme.emoji} {theme.name}
                  </span>
                  <div className="flex -space-x-1.5 shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: theme.patch.baseColor }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: theme.patch.reliefColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

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

      {/* 02. Ícone / Símbolo */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Sparkles className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Ícone & Posição
        </SectionTitle>

        <SymbolPicker
          symbolId={config.symbolId}
          symbolPosition={config.symbolPosition}
          showPosition={(config.symbolId !== 'none' || !!config.customIconUrl) && !config.symbolSeparated}
          onChange={(patch) => onChange({ ...config, ...patch })}
        />

        {(config.symbolId !== 'none' || !!config.customIconUrl) && config.symbolPosition !== 'both' && (
          <>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  symbolSeparated: !config.symbolSeparated,
                  // Separado, o ícone vira a peça do início (argola à esquerda).
                  ...(config.symbolSeparated ? {} : { symbolPosition: 'left' as const }),
                })
              }
              className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--surface-container-high)] bg-[var(--surface-container-high)]/50 hover:border-[#632CE5]/40 transition-all cursor-pointer"
            >
              <span className="text-[9px] uppercase font-bold text-zinc-600">Ícone separado do nome</span>
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  config.symbolSeparated
                    ? 'bg-[#632CE5] border-[#632CE5]'
                    : 'border-[var(--surface-container-high)]'
                }`}
              >
                {config.symbolSeparated && <Check className="w-3 h-3 text-black" />}
              </div>
            </button>
            {config.symbolSeparated && (
              <p className="text-[9px] text-zinc-600 leading-snug -mt-2">
                O ícone vira a peça do início, com argola à esquerda; o nome ganha argola no começo
                e no fim.
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onOpenSvgConverter}
          className="w-full py-2.5 rounded-lg border border-[var(--workbench-line)] text-[9px] font-black uppercase tracking-wide text-[var(--on-surface-variant)] hover:border-[#632CE5]/50 hover:text-[#632CE5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Ícone (PNG/JPG/SVG)
        </button>

        {config.customIconUrl && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)]">
            <img
              src={config.customIconUrl}
              alt="Ícone aplicado"
              className="w-9 h-9 object-contain rounded border border-[var(--workbench-line)] bg-white"
            />
            <span className="text-[10px] font-bold text-[var(--on-surface-variant)] flex-1">
              Ícone personalizado aplicado (substitui o símbolo).
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...config, customIconUrl: undefined })}
              className="text-[9px] font-black uppercase tracking-wide text-red-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              Remover ícone
            </button>
          </div>
        )}

        <RangeControl
          label="Espaço do Ícone"
          unit="x"
          min={String(SYMBOL_GAP_FACTOR_MIN)}
          max={String(SYMBOL_GAP_FACTOR_MAX)}
          step="0.05"
          number={config.symbolGapFactor}
          onChange={(value) => onChange({ ...config, symbolGapFactor: value })}
        />

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

      {/* 03. Corpo & Relevo */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Corpo & Relevo
        </SectionTitle>

        <RangeControl
          label="Borda / Contorno do Corpo"
          unit="mm"
          min="1.0"
          max="6.0"
          step="0.2"
          number={config.outlineSize}
          onChange={(value) => onChange({ ...config, outlineSize: value })}
        />

        <RangeControl
          label="Espessura do Corpo"
          unit="mm"
          min="1.5"
          max="6.0"
          step="0.1"
          number={config.bodyThickness}
          onChange={(value) => onChange({ ...config, bodyThickness: value })}
        />

        <RangeControl
          label="Espessura do Relevo"
          unit="mm"
          min="0.8"
          max="4.0"
          step="0.2"
          number={config.reliefThickness}
          onChange={(value) => onChange({ ...config, reliefThickness: value })}
        />
      </section>

      {/* 04. Argola */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Link2 className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Argola
        </SectionTitle>

        <button
          type="button"
          onClick={() => onChange({ ...config, loopEnabled: !config.loopEnabled })}
          className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--surface-container-high)] bg-[var(--surface-container-high)]/50 hover:border-[#632CE5]/40 transition-all"
        >
          <span className="text-[9px] uppercase font-bold text-zinc-600">Ativar Argola</span>
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              config.loopEnabled
                ? 'bg-[#632CE5] border-[#632CE5]'
                : 'border-[var(--surface-container-high)]'
            }`}
          >
            {config.loopEnabled && <Check className="w-3 h-3 text-black" />}
          </div>
        </button>

        {config.loopEnabled && (
          <>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block">
                Lado da Argola
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, loopSide: 'left' })}
                  className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                    config.loopSide === 'left'
                      ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                  }`}
                >
                  ◀ Esquerda
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, loopSide: 'right' })}
                  className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                    config.loopSide === 'right'
                      ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                  }`}
                >
                  Direita ▶
                </button>
              </div>
            </div>

            <RangeControl
              label="Diâmetro do Furo"
              unit="mm"
              min="3"
              max="10"
              step="0.5"
              number={config.loopHoleDiameter}
              onChange={(value) => onChange({ ...config, loopHoleDiameter: value })}
            />

            <RangeControl
              label="Parede da Argola"
              unit="mm"
              min="1.2"
              max="4"
              step="0.1"
              number={config.loopWallThickness}
              onChange={(value) => onChange({ ...config, loopWallThickness: value })}
            />

            <RangeControl
              label="Folga até a Letra"
              unit="mm"
              min="0"
              max={String(loopGapMax)}
              step="0.1"
              number={Math.min(config.loopLetterGap, loopGapMax)}
              onChange={(value) => onChange({ ...config, loopLetterGap: value })}
            />
            <p className="text-[9px] text-zinc-600 leading-snug -mt-2">
              Distância entre a borda do furo e a letra mais próxima. Aumente para afastar a argola do nome.
            </p>

            <div className="p-3 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-zinc-600">
                  Ø externo da aba
                </span>
                <span className="text-[14px] font-black text-[#632CE5] tracking-tighter font-mono">
                  {loopOuterDiameter} mm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-zinc-600">
                  Ø mínimo de argola
                </span>
                <span className="text-[10px] font-mono font-bold text-[#632CE5]">
                  {loopMinOuterDiameter} mm
                  <span className="text-[9px] text-zinc-600 font-bold"> (parede mín.)</span>
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 05. Cores do Modelo */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          05. Cores do Modelo
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="1. Corpo"
            value={config.baseColor}
            onChange={(color) => onChange({ ...config, baseColor: color })}
          />
          <ColorField
            label="2. Nome em Relevo"
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
