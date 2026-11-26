import React, { useRef, useState } from 'react';
import {
  Box,
  Download,
  Eye,
  Layers,
  Palette,
  Ruler,
  Shapes,
  Upload,
  X,
} from 'lucide-react';
import { MOLD_LIMITS } from '../lib/mold/constants';
import {
  MOLD_SAMPLES,
  MOLD_SHAPES,
  MOLD_TYPES,
  type MoldBounds,
  type MoldConfig,
  type MoldModelInfo,
  type MoldSampleId,
  type MoldViewMode,
} from '../types/mold';

interface MoldControlsProps {
  config: MoldConfig;
  onChange: (config: MoldConfig) => void;
  viewMode: MoldViewMode;
  onViewModeChange: (mode: MoldViewMode) => void;
  targetSizeMm: number;
  onTargetSizeChange: (size: number) => void;
  onSelectSample: (sample: MoldSampleId) => void;
  onUploadFile: (file: File) => void;
  modelInfo: MoldModelInfo | null;
  bounds: MoldBounds & { triangles: number };
  exporting: 'stl' | '3mf' | null;
  onDownloadSTL: () => void;
  onDownload3MF: () => void;
  error: string | null;
}

const VIEW_MODES: { id: MoldViewMode; label: string }[] = [
  { id: 'mold', label: 'Molde' },
  { id: 'xray', label: 'Raio-X' },
  { id: 'cast', label: 'Fundido' },
  { id: 'original', label: 'Original' },
];

const isTwoPart = (config: MoldConfig) => config.type === 'two_part';

export const MoldControls: React.FC<MoldControlsProps> = ({
  config,
  onChange,
  viewMode,
  onViewModeChange,
  targetSizeMm,
  onTargetSizeChange,
  onSelectSample,
  onUploadFile,
  modelInfo,
  bounds,
  exporting,
  onDownloadSTL,
  onDownload3MF,
  error,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const set = <K extends keyof MoldConfig>(key: K, value: MoldConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <aside className="w-full md:w-[400px] h-full bg-[var(--workbench-panel)] border-l border-[var(--surface-container-high)] overflow-y-auto p-6 space-y-7 scrollbar-hide shrink-0">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[var(--primary-fixed)] border border-[var(--primary-fixed-dim)] flex items-center justify-center">
            <Box className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--workbench-text)]">
            Criador de Moldes
          </h1>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--workbench-muted)] leading-relaxed">
          Malha do objeto → cavidade por subtração booleana. STL por peça.
        </p>
      </header>

      {/* 01. Modelo */}
      <section className="space-y-3">
        <SectionTitle icon={<Shapes className="w-3.5 h-3.5" />}>01. Modelo</SectionTitle>

        <div className="grid grid-cols-3 gap-1.5">
          {MOLD_SAMPLES.map((sample) => {
            const selected = modelInfo?.name === sample.label;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSelectSample(sample.id)}
                className={`px-2 py-2 rounded border text-[9px] font-mono uppercase tracking-[0.08em] ${
                  selected
                    ? 'border-[var(--primary)] bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]'
                    : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[var(--primary)]/50'
                }`}
              >
                {sample.label}
              </button>
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.obj"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUploadFile(file);
            event.target.value = '';
          }}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) onUploadFile(file);
          }}
          className={`p-3 rounded border border-dashed flex flex-col items-center gap-2 text-center ${
            isDragging
              ? 'border-[var(--primary)] bg-[var(--primary-fixed)]'
              : 'border-[var(--workbench-line)]'
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
          >
            <Upload className="w-3.5 h-3.5" />
            Enviar STL / OBJ
          </button>
          <span className="text-[9px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">
            ou arraste o arquivo aqui
          </span>
        </div>

        {modelInfo ? (
          <div className="p-2.5 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-[var(--workbench-text)] truncate">
                {modelInfo.name}
              </span>
              <span className="text-[9px] font-mono uppercase text-[var(--workbench-muted)] shrink-0">
                {modelInfo.sizeLabel}
              </span>
            </div>
            <p className="text-[9px] font-mono uppercase tracking-[0.06em] text-[var(--workbench-muted)]">
              {modelInfo.dimensions.width} × {modelInfo.dimensions.height} ×{' '}
              {modelInfo.dimensions.depth} mm · {modelInfo.triangles.toLocaleString('pt-BR')} tri
            </p>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-[var(--workbench-muted)]">
            Nenhum modelo carregado.
          </p>
        )}
      </section>

      {/* 02. Tipo e escala */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Layers className="w-3.5 h-3.5" />}>02. Tipo de molde</SectionTitle>

        <div className="space-y-1.5">
          {MOLD_TYPES.map((type) => {
            const selected = config.type === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => set('type', type.id)}
                className={`w-full px-3 py-2 rounded border text-left ${
                  selected
                    ? 'border-[var(--primary)] bg-[var(--primary-fixed)]'
                    : 'border-[var(--workbench-line)] hover:border-[var(--primary)]/50'
                }`}
              >
                <span
                  className={`block text-[10px] font-mono uppercase tracking-[0.08em] ${
                    selected
                      ? 'text-[var(--on-primary-fixed-variant)]'
                      : 'text-[var(--workbench-text)]'
                  }`}
                >
                  {type.label}
                </span>
                <span className="block text-[9px] text-[var(--workbench-muted)] mt-0.5">
                  {type.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {MOLD_SHAPES.map((shape) => (
            <Chip
              key={shape.id}
              label={shape.label}
              active={config.shape === shape.id}
              onClick={() => set('shape', shape.id)}
            />
          ))}
        </div>

        <RangeControl
          label="Tamanho (maior lado)"
          unit="mm"
          {...MOLD_LIMITS.targetSize}
          value={targetSizeMm}
          onChange={onTargetSizeChange}
        />
      </section>

      {/* 03. Geometria do molde */}
      <section className="space-y-4 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Ruler className="w-3.5 h-3.5" />}>03. Geometria</SectionTitle>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <RangeControl
            label="Parede"
            unit="mm"
            {...MOLD_LIMITS.wallThickness}
            value={config.wallThickness}
            onChange={(value) => set('wallThickness', value)}
          />
          <RangeControl
            label="Fundo"
            unit="mm"
            {...MOLD_LIMITS.floorThickness}
            value={config.floorThickness}
            onChange={(value) => set('floorThickness', value)}
          />
          {isTwoPart(config) && (
            <RangeControl
              label="Plano de divisão"
              unit="%"
              {...MOLD_LIMITS.splitPlane}
              value={Math.round(config.splitPlaneRatio * 100)}
              onChange={(value) => set('splitPlaneRatio', value / 100)}
            />
          )}
          <RangeControl
            label="Ângulo de saída"
            unit="°"
            {...MOLD_LIMITS.draftAngle}
            value={config.draftAngle}
            onChange={(value) => set('draftAngle', value)}
          />
        </div>
      </section>

      {/* 04. Recursos */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Shapes className="w-3.5 h-3.5" />}>04. Recursos</SectionTitle>

        {isTwoPart(config) ? (
          <>
            <ToggleField
              label="Pinos de encaixe"
              checked={config.alignmentPins}
              onChange={(checked) => set('alignmentPins', checked)}
            />
            {config.alignmentPins && (
              <RangeControl
                label="Diâmetro do pino"
                unit="mm"
                {...MOLD_LIMITS.pinSize}
                value={config.pinSize}
                onChange={(value) => set('pinSize', value)}
              />
            )}
            <ToggleField
              label="Canal de despejo"
              checked={config.pourSpout}
              onChange={(checked) => set('pourSpout', checked)}
            />
            {config.pourSpout && (
              <RangeControl
                label="Diâmetro do canal"
                unit="mm"
                {...MOLD_LIMITS.pourSpoutDiameter}
                value={config.pourSpoutDiameter}
                onChange={(value) => set('pourSpoutDiameter', value)}
              />
            )}
            <ToggleField
              label="Respiros de ar"
              checked={config.airVents}
              onChange={(checked) => set('airVents', checked)}
            />
            {config.airVents && (
              <RangeControl
                label="Diâmetro do respiro"
                unit="mm"
                {...MOLD_LIMITS.airVentDiameter}
                value={config.airVentDiameter}
                onChange={(value) => set('airVentDiameter', value)}
              />
            )}
            <RangeControl
              label="Vista explodida"
              unit="mm"
              {...MOLD_LIMITS.explodeDistance}
              value={config.explodeDistance}
              onChange={(value) => set('explodeDistance', value)}
            />
          </>
        ) : (
          <p className="text-[10px] font-mono text-[var(--workbench-muted)] leading-relaxed">
            Pinos, canal de despejo e respiros ficam disponíveis no molde bipartido. A caixa para
            silicone usa a parede extra como borda de vazamento.
          </p>
        )}
      </section>

      {/* 05. Visualização */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Eye className="w-3.5 h-3.5" />}>05. Visualização</SectionTitle>

        <div className="grid grid-cols-2 gap-1.5">
          {VIEW_MODES.map((mode) => (
            <Chip
              key={mode.id}
              label={mode.label}
              active={viewMode === mode.id}
              onClick={() => onViewModeChange(mode.id)}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ColorField
            label="Molde"
            value={config.moldColor}
            onChange={(color) => set('moldColor', color)}
          />
          {isTwoPart(config) && (
            <ColorField
              label="Tampa"
              value={config.topColor}
              onChange={(color) => set('topColor', color)}
            />
          )}
        </div>
      </section>

      {/* 06. Exportar */}
      <section className="space-y-3 pt-4 border-t border-[var(--surface-container-high)]">
        <SectionTitle icon={<Download className="w-3.5 h-3.5" />}>06. Exportar</SectionTitle>

        <div className="p-3 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">
              Caixa do molde
            </span>
            <span className="text-[13px] font-mono font-bold text-[var(--primary)]">
              {bounds.width} × {bounds.height} × {bounds.depth} mm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">
              Triângulos gerados
            </span>
            <span className="text-[11px] font-mono font-bold text-[var(--workbench-text)]">
              {bounds.triangles.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded border border-[var(--error)]/40 bg-[var(--error-container)] flex items-start gap-2">
            <span className="text-[10px] font-mono text-[var(--on-error-container)] leading-relaxed">
              {error}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onDownload3MF}
          disabled={exporting !== null || bounds.triangles === 0}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          {exporting === '3mf' ? 'Gerando 3MF…' : 'Baixar 3MF (Bambu, cor por peça)'}
        </button>

        <button
          type="button"
          onClick={onDownloadSTL}
          disabled={exporting !== null || bounds.triangles === 0}
          className="w-full py-2.5 rounded border border-[var(--workbench-line)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--on-surface-variant)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          {exporting === 'stl' ? 'Gerando STL…' : 'Baixar STL (zip por peça)'}
        </button>
      </section>
    </aside>
  );
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--workbench-muted)] font-bold flex items-center gap-2">
      {icon}
      {children}
    </h3>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1.5 rounded border text-[9px] font-mono uppercase tracking-[0.06em] ${
        active
          ? 'border-[var(--primary)] bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]'
          : 'border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[var(--primary)]/50'
      }`}
    >
      {label}
    </button>
  );
}

function RangeControl({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <label className="text-[9px] font-mono uppercase tracking-[0.06em] text-[var(--workbench-muted)]">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-16 px-1.5 py-1 bg-[var(--surface-pure)] border border-[var(--surface-container-high)] rounded text-[10px] font-mono text-right text-[var(--primary)] focus:outline-none focus:border-[var(--primary)]"
          />
          <span className="text-[9px] font-mono text-[var(--workbench-muted)]">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full h-1.5 bg-[var(--workbench-viewport)] rounded-full appearance-none cursor-pointer"
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
    <div className="p-2.5 rounded bg-[var(--surface-container-low)] border border-[var(--surface-container-high)] flex flex-col gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-[0.06em] text-[var(--workbench-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
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
      className={`w-full px-3 py-2 rounded border flex items-center justify-between ${
        checked
          ? 'border-[var(--primary)] bg-[var(--primary-fixed)]'
          : 'border-[var(--workbench-line)] hover:border-[var(--primary)]/50'
      }`}
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--workbench-text)]">
        {label}
      </span>
      <span
        className={`w-3.5 h-3.5 rounded-full border-2 ${
          checked
            ? 'bg-[var(--primary)] border-[var(--primary)]'
            : 'bg-transparent border-[var(--outline)]'
        }`}
      />
    </button>
  );
}
