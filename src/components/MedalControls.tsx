import React from 'react';
import type { MedalConfig, Model3DDimensions } from '../types/medal';
import {
  MEDAL_PALETTES,
  DIAMETER_MIN,
  DIAMETER_MAX,
  DIAMETER_PRESETS,
  THICKNESS_PRESETS,
  ART_RELIEF_MIN,
  ART_RELIEF_MAX,
  ART_SCALE_MIN,
  ART_SCALE_MAX,
  ARC_SIZE_MIN,
  ARC_SIZE_MAX,
  ARC_RADIUS_MIN,
  ARC_RADIUS_MAX,
  RIM_WIDTH_MIN,
  RIM_WIDTH_MAX,
  RIM_HEIGHT_MIN,
  RIM_HEIGHT_MAX,
  RIBBON_WIDTH_OPTIONS,
  SLOT_HEIGHT_MIN,
  SLOT_HEIGHT_MAX,
  HOLE_DIAMETER_MIN,
  HOLE_DIAMETER_MAX,
  HANDLE_WALL_MIN,
  HANDLE_WALL_MAX,
  HANDLE_THICKNESS_MIN,
  HANDLE_THICKNESS_MAX,
  INNER_RING_MAX,
  INNER_RING_RADIUS_MIN,
  INNER_RING_RADIUS_MAX,
  INNER_RING_WIDTH_MIN,
  INNER_RING_WIDTH_MAX,
} from '../lib/medal/presets';
import { FontPicker } from './FontPicker';
import {
  Check,
  Download,
  Award,
  Image as ImageIcon,
  Type,
  Box,
  Circle,
  Link2,
  Palette,
  Upload,
} from 'lucide-react';

interface MedalControlsProps {
  config: MedalConfig;
  onChange: (newConfig: MedalConfig) => void;
  dimensions: Model3DDimensions;
  onQuickDownload3MF: () => void;
  onOpenSvgConverter: () => void;
  exporting?: '3mf' | null;
}

const SHAPE_LABELS: Record<MedalConfig['bodyShape'], string> = {
  redonda: 'Redonda',
  hexagonal: 'Hexagonal',
  octogonal: 'Octogonal',
  escudo: 'Escudo',
};

const HANDLE_LABELS: Record<MedalConfig['handleMode'], string> = {
  passante: 'Passante',
  'furo-redondo': 'Furo Redondo',
  fita: 'Fita Retangular',
  nenhuma: 'Sem Alça',
};

const HANDLE_RIM_STYLES: Record<MedalConfig['rimHandleStyle'], { sub: string; help: string }> = {
  'canal-duplo': {
    sub: 'Estilo da Foto',
    help: 'A moldura contorna a alça e o vão da fita na cor da borda, deixando o canal central na cor da base.',
  },
  macica: {
    sub: 'Preenchida',
    help: 'Toda a almofada da alça preenchida na cor da borda, do contorno até o vão.',
  },
  contorno: {
    sub: 'Só Externo',
    help: 'Só o filete externo da alça na cor da borda.',
  },
};

export const MedalControls: React.FC<MedalControlsProps> = ({
  config,
  onChange,
  dimensions,
  onQuickDownload3MF,
  onOpenSvgConverter,
  exporting = null,
}) => {
  const handleApplyPalette = (palette: (typeof MEDAL_PALETTES)[0]) => {
    onChange({
      ...config,
      backgroundColor: palette.backgroundColor,
      rimColor: palette.rimColor,
      handleColor: config.handleMode === 'fita' ? palette.backgroundColor : palette.handleColor,
    });
  };

  // fita nasce com campo na cor do corpo (referência); demais modos, sincronizados com a borda
  const handleSelectMode = (mode: MedalConfig['handleMode']) => {
    if (mode === config.handleMode) return;
    onChange(
      mode === 'fita'
        ? { ...config, handleMode: mode, handleColorSync: false, handleColor: config.backgroundColor }
        : { ...config, handleMode: mode, handleColorSync: true }
    );
  };

  const showHandleRimStyle = config.rimEnabled && config.rimCoverage === 'geral' && config.handleMode !== 'nenhuma';

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-8 scrollbar-hide shrink-0 select-none">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#632CE5]/10 border border-[#632CE5]/20 flex items-center justify-center">
            <Award className="w-6 h-6 text-[#632CE5]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Medalhas 3D
          </h1>
        </div>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          Texto circular, borda e passador de fita.
        </p>
      </header>

      {/* 01. Arte da Medalha */}
      <section className="space-y-4">
        <SectionTitle icon={<ImageIcon className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01. Arte da Medalha (SVG ou Imagem)
        </SectionTitle>

        <button
          type="button"
          onClick={onOpenSvgConverter}
          className="w-full py-2.5 rounded-lg border border-[var(--workbench-line)] text-[9px] font-black uppercase tracking-wide text-[var(--on-surface-variant)] hover:border-[#632CE5]/50 hover:text-[#632CE5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          {config.artUrl ? 'Trocar Arte (SVG/PNG/JPG)' : 'Enviar Arte (SVG/PNG/JPG)'}
        </button>

        {config.artUrl && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--surface-container-high)]/50 border border-[var(--surface-container-high)]">
            <img
              src={config.artUrl}
              alt="Arte aplicada"
              className="w-9 h-9 object-contain rounded border border-[var(--workbench-line)] bg-white"
            />
            <span className="text-[10px] font-bold text-[var(--on-surface-variant)] flex-1 truncate">
              {config.artName || 'Arte personalizada aplicada'}
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...config, artUrl: undefined, artName: undefined })}
              className="text-[9px] font-black uppercase tracking-wide text-red-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              Remover arte
            </button>
          </div>
        )}

        <RangeControl
          label="Altura do Relevo da Arte"
          unit="mm"
          min={String(ART_RELIEF_MIN)}
          max={String(ART_RELIEF_MAX)}
          step="0.1"
          number={config.artReliefHeight}
          onChange={(value) => onChange({ ...config, artReliefHeight: value })}
        />

        <RangeControl
          label="Escala da Arte"
          unit="%"
          min={String(ART_SCALE_MIN)}
          max={String(ART_SCALE_MAX)}
          step="1"
          number={config.artScale}
          onChange={(value) => onChange({ ...config, artScale: value })}
        />
      </section>

      {/* 01b. Texto Circular */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Type className="w-3.5 h-3.5 text-[#632CE5]" />}>
          01b. Texto Circular
        </SectionTitle>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Texto Superior</label>
            <span className="text-[10px] font-mono text-[#632CE5] truncate max-w-[140px]">
              {config.topText}
            </span>
          </div>
          <input
            type="text"
            value={config.topText}
            onChange={(e) => onChange({ ...config, topText: e.target.value.substring(0, 28) })}
            placeholder="Ex: MEDALHA DE OURO"
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Texto Inferior</label>
            <span className="text-[10px] font-mono text-[#632CE5] truncate max-w-[140px]">
              {config.bottomText}
            </span>
          </div>
          <input
            type="text"
            value={config.bottomText}
            onChange={(e) => onChange({ ...config, bottomText: e.target.value.substring(0, 28) })}
            placeholder="Ex: CAMPEONATO 2026"
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] uppercase font-bold text-zinc-600">Texto Central (reto)</label>
            <span className="text-[10px] font-mono text-[#632CE5] truncate max-w-[140px]">
              {config.centerText}
            </span>
          </div>
          <input
            type="text"
            value={config.centerText}
            onChange={(e) => onChange({ ...config, centerText: e.target.value.substring(0, 14) })}
            placeholder="Ex: 1º LUGAR"
            className="w-full bg-white border border-[var(--surface-container-high)] p-2 rounded text-[10px] text-[var(--workbench-text)] font-bold focus:outline-none focus:border-[#632CE5] transition-colors"
          />
        </div>

        <FontPicker
          fontFamily={config.fontFamily}
          customFontName={config.customFontName}
          onChange={(patch) => onChange({ ...config, ...patch })}
        />

        <RangeControl
          label="Tamanho do Texto Superior"
          unit="mm"
          min={String(ARC_SIZE_MIN)}
          max={String(ARC_SIZE_MAX)}
          step="0.5"
          number={config.topArcSize}
          onChange={(value) => onChange({ ...config, topArcSize: value })}
        />

        <RangeControl
          label="Tamanho do Texto Inferior"
          unit="mm"
          min={String(ARC_SIZE_MIN)}
          max={String(ARC_SIZE_MAX)}
          step="0.5"
          number={config.bottomArcSize}
          onChange={(value) => onChange({ ...config, bottomArcSize: value })}
        />

        <RangeControl
          label="Tamanho do Texto Central"
          unit="mm"
          min={String(ARC_SIZE_MIN)}
          max={String(ARC_SIZE_MAX)}
          step="0.5"
          number={config.centerTextSize}
          onChange={(value) => onChange({ ...config, centerTextSize: value })}
        />

        <RangeControl
          label="Raio do Arco"
          unit="%"
          min={String(ARC_RADIUS_MIN)}
          max={String(ARC_RADIUS_MAX)}
          step="1"
          number={config.arcRadiusPct}
          onChange={(value) => onChange({ ...config, arcRadiusPct: value })}
        />
      </section>

      {/* 02. Dimensões & Formato */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Box className="w-3.5 h-3.5 text-[#632CE5]" />}>
          02. Dimensões & Formato
        </SectionTitle>

        <div className="grid grid-cols-6 gap-1.5">
          {DIAMETER_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...config, diameter: d })}
              className={`py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${
                config.diameter === d
                  ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                  : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <RangeControl
          label="Diâmetro Externo"
          unit="mm"
          min={String(DIAMETER_MIN)}
          max={String(DIAMETER_MAX)}
          step="1"
          number={config.diameter}
          onChange={(value) => onChange({ ...config, diameter: value })}
        />

        <div className="space-y-1.5">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">
            Espessura da Base
          </label>
          <div className="grid grid-cols-3 gap-2">
            {THICKNESS_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ ...config, baseThickness: t })}
                className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                  config.baseThickness === t
                    ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                    : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                }`}
              >
                {t.toFixed(1)} mm
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">Formato do Corpo</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SHAPE_LABELS) as MedalConfig['bodyShape'][]).map((shape) => (
              <button
                key={shape}
                type="button"
                onClick={() => onChange({ ...config, bodyShape: shape })}
                className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                  config.bodyShape === shape
                    ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                    : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                }`}
              >
                {SHAPE_LABELS[shape]}
              </button>
            ))}
          </div>
        </div>

        <ColorField
          label="Cor do Fundo"
          value={config.backgroundColor}
          onChange={(color) => onChange({ ...config, backgroundColor: color })}
        />
      </section>

      {/* 03. Borda Perimetral */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Circle className="w-3.5 h-3.5 text-[#632CE5]" />}>
          03. Borda Perimetral
        </SectionTitle>

        <button
          type="button"
          onClick={() => onChange({ ...config, rimEnabled: !config.rimEnabled })}
          className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--surface-container-high)] bg-[var(--surface-container-high)]/50 hover:border-[#632CE5]/40 transition-all"
        >
          <span className="text-[9px] uppercase font-bold text-zinc-600">Ativar Borda (Rim)</span>
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              config.rimEnabled ? 'bg-[#632CE5] border-[#632CE5]' : 'border-[var(--surface-container-high)]'
            }`}
          >
            {config.rimEnabled && <Check className="w-3 h-3 text-black" />}
          </div>
        </button>

        {config.rimEnabled && (
          <>
            <RangeControl
              label="Largura da Borda"
              unit="mm"
              min={String(RIM_WIDTH_MIN)}
              max={String(RIM_WIDTH_MAX)}
              step="0.1"
              number={config.rimWidth}
              onChange={(value) => onChange({ ...config, rimWidth: value })}
            />

            <RangeControl
              label="Altura do Relevo da Borda"
              unit="mm"
              min={String(RIM_HEIGHT_MIN)}
              max={String(RIM_HEIGHT_MAX)}
              step="0.1"
              number={config.rimHeight}
              onChange={(value) => onChange({ ...config, rimHeight: value })}
            />

            <ColorField
              label="Cor da Borda"
              value={config.rimColor}
              onChange={(color) => onChange({ ...config, rimColor: color })}
            />

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block">Abrangência da Borda</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, rimCoverage: 'disco' })}
                  className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                    config.rimCoverage === 'disco'
                      ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                  }`}
                >
                  <span className="block">Apenas no Disco</span>
                  <span className="block mt-1 text-[8px] font-bold normal-case tracking-normal opacity-70">
                    Borda clássica ao redor do corpo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, rimCoverage: 'geral' })}
                  className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                    config.rimCoverage === 'geral'
                      ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                      : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                  }`}
                >
                  <span className="block">Borda Geral (Corpo + Alça)</span>
                  <span className="block mt-1 text-[8px] font-bold normal-case tracking-normal opacity-70">
                    Contorno na alça estilo esportivo
                  </span>
                </button>
              </div>
            </div>

            {showHandleRimStyle && (
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-zinc-600 block">
                  Estilo da Borda na Alça
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, rimHandleStyle: 'canal-duplo' })}
                    className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                      config.rimHandleStyle === 'canal-duplo'
                        ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                        : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                    }`}
                  >
                    <span className="block">Canal Duplo</span>
                    <span className="block mt-1 text-[8px] font-bold normal-case tracking-normal opacity-70">
                      {HANDLE_RIM_STYLES['canal-duplo'].sub}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, rimHandleStyle: 'macica' })}
                    className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                      config.rimHandleStyle === 'macica'
                        ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                        : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                    }`}
                  >
                    <span className="block">Maciça</span>
                    <span className="block mt-1 text-[8px] font-bold normal-case tracking-normal opacity-70">
                      {HANDLE_RIM_STYLES.macica.sub}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, rimHandleStyle: 'contorno' })}
                    className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                      config.rimHandleStyle === 'contorno'
                        ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                        : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                    }`}
                  >
                    <span className="block">Contorno</span>
                    <span className="block mt-1 text-[8px] font-bold normal-case tracking-normal opacity-70">
                      {HANDLE_RIM_STYLES.contorno.sub}
                    </span>
                  </button>
                </div>
                <p className="text-[9px] leading-snug text-[var(--on-surface-variant)]">
                  {HANDLE_RIM_STYLES[config.rimHandleStyle].help}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* 04. Passador de Fita */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Link2 className="w-3.5 h-3.5 text-[#632CE5]" />}>
          04. Passador de Fita
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(HANDLE_LABELS) as MedalConfig['handleMode'][]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleSelectMode(mode)}
              className={`py-2.5 rounded-lg border text-[9px] font-black uppercase tracking-wide transition-all ${
                config.handleMode === mode
                  ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                  : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
              }`}
            >
              {HANDLE_LABELS[mode]}
            </button>
          ))}
        </div>

        {(config.handleMode === 'passante' || config.handleMode === 'fita') && (
          <>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-zinc-600 block">Vão para a Fita</label>
              <div className="grid grid-cols-4 gap-1.5">
                {RIBBON_WIDTH_OPTIONS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onChange({ ...config, ribbonWidth: w })}
                    className={`py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${
                      config.ribbonWidth === w
                        ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                        : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                    }`}
                  >
                    {w} mm
                  </button>
                ))}
              </div>
            </div>

            <RangeControl
              label="Altura da Fenda"
              unit="mm"
              min={String(SLOT_HEIGHT_MIN)}
              max={String(SLOT_HEIGHT_MAX)}
              step="0.5"
              number={config.slotHeight}
              onChange={(value) => onChange({ ...config, slotHeight: value })}
            />
          </>
        )}

        {config.handleMode === 'furo-redondo' && (
          <RangeControl
            label="Diâmetro do Furo"
            unit="mm"
            min={String(HOLE_DIAMETER_MIN)}
            max={String(HOLE_DIAMETER_MAX)}
            step="0.5"
            number={config.holeDiameter}
            onChange={(value) => onChange({ ...config, holeDiameter: value })}
          />
        )}

        {config.handleMode !== 'nenhuma' && (
          <>
            <RangeControl
              label="Parede da Alça"
              unit="mm"
              min={String(HANDLE_WALL_MIN)}
              max={String(HANDLE_WALL_MAX)}
              step="0.1"
              number={config.handleWall}
              onChange={(value) =>
                onChange({ ...config, handleWall: Math.max(HANDLE_WALL_MIN, value) })
              }
            />

            <RangeControl
              label="Espessura da Alça (Z)"
              unit="mm"
              min={String(HANDLE_THICKNESS_MIN)}
              max={String(HANDLE_THICKNESS_MAX)}
              step="0.1"
              number={config.handleThicknessZ}
              onChange={(value) => onChange({ ...config, handleThicknessZ: value })}
            />

            <button
              type="button"
              onClick={() => onChange({ ...config, handleColorSync: !config.handleColorSync })}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--surface-container-high)] bg-[var(--surface-container-high)]/50 hover:border-[#632CE5]/40 transition-all"
            >
              <span className="text-[9px] uppercase font-bold text-zinc-600">
                Sincronizar Cor com a Borda
              </span>
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  config.handleColorSync ? 'bg-[#632CE5] border-[#632CE5]' : 'border-[var(--surface-container-high)]'
                }`}
              >
                {config.handleColorSync && <Check className="w-3 h-3 text-black" />}
              </div>
            </button>

            {!config.handleColorSync && (
              <ColorField
                label="Cor do Passador"
                value={config.handleColor}
                onChange={(color) => onChange({ ...config, handleColor: color })}
              />
            )}
          </>
        )}
      </section>

      {/* 05. Círculos Internos */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Circle className="w-3.5 h-3.5 text-[#632CE5]" />}>
          05. Círculos Internos
        </SectionTitle>

        <div className="space-y-1.5">
          <label className="text-[9px] uppercase font-bold text-zinc-600 block">Quantidade de Anéis</label>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: INNER_RING_MAX + 1 }, (_, i) => i).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onChange({ ...config, innerRingCount: count })}
                className={`py-2 rounded-lg border text-[9px] font-black uppercase transition-all ${
                  config.innerRingCount === count
                    ? 'border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                    : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {config.innerRingCount > 0 && (
          <>
            <RangeControl
              label="Raio dos Anéis"
              unit="%"
              min={String(INNER_RING_RADIUS_MIN)}
              max={String(INNER_RING_RADIUS_MAX)}
              step="1"
              number={config.innerRingRadiusPct}
              onChange={(value) => onChange({ ...config, innerRingRadiusPct: value })}
            />

            <RangeControl
              label="Espessura do Anel"
              unit="mm"
              min={String(INNER_RING_WIDTH_MIN)}
              max={String(INNER_RING_WIDTH_MAX)}
              step="0.1"
              number={config.innerRingWidth}
              onChange={(value) => onChange({ ...config, innerRingWidth: value })}
            />
          </>
        )}
      </section>

      {/* 06. Paletas Rápidas */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Palette className="w-3.5 h-3.5 text-[#632CE5]" />}>
          06. Paletas Rápidas
        </SectionTitle>

        <div className="grid grid-cols-2 gap-1.5">
          {MEDAL_PALETTES.map((palette) => {
            const isSelected =
              config.backgroundColor.toLowerCase() === palette.backgroundColor.toLowerCase() &&
              config.rimColor.toLowerCase() === palette.rimColor.toLowerCase() &&
              config.handleColor.toLowerCase() === palette.handleColor.toLowerCase();

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
                    style={{ backgroundColor: palette.backgroundColor }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: palette.rimColor }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: palette.handleColor }}
                  />
                </div>
                <span className="text-[9px] font-black uppercase truncate w-full">{palette.name}</span>
              </button>
            );
          })}
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
            <span className="text-[9px] uppercase font-bold text-zinc-600">Tempo de impressão</span>
            <span className="text-[10px] font-mono font-bold text-[#632CE5]">
              ~{dimensions.printTimeMinutes} min
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onQuickDownload3MF}
          disabled={exporting !== null}
          className="btn-primary"
        >
          <Download className="w-4 h-4" />
          {exporting === '3mf' ? 'Gerando 3MF…' : 'Baixar 3MF (3 Objetos)'}
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
