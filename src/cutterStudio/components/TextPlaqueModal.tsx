import React, { useState } from 'react';
import { ModelLineart } from '../types';
import { PREDEFINED_TEXT_SHAPES } from '../data/textShapes';
import { X, Type, Sparkles, Check, Stamp } from 'lucide-react';

interface TextPlaqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCustomModel: (model: ModelLineart) => void;
  onApplyTextToCurrentStamp: (text: string, font: 'cursive' | 'bold' | 'serif' | 'rounded') => void;
  currentModelName: string;
}

export const TextPlaqueModal: React.FC<TextPlaqueModalProps> = ({
  isOpen,
  onClose,
  onApplyCustomModel,
  onApplyTextToCurrentStamp,
  currentModelName,
}) => {
  const [text, setText] = useState<string>('Parabéns');
  const [fontFamily, setFontFamily] = useState<'cursive' | 'bold' | 'serif' | 'rounded'>('cursive');
  const [selectedShapeId, setSelectedShapeId] = useState<string>('scalloped_plaque');

  if (!isOpen) return null;

  const selectedPreset =
    PREDEFINED_TEXT_SHAPES.find((s) => s.id === selectedShapeId) || PREDEFINED_TEXT_SHAPES[0];

  const handleCreateNewPlaque = () => {
    onApplyCustomModel(selectedPreset.model);
    onApplyTextToCurrentStamp(text.trim() || 'Parabéns', fontFamily);
    onClose();
  };

  const handleApplyToCurrent = () => {
    onApplyTextToCurrentStamp(text.trim() || 'Parabéns', fontFamily);
    onClose();
  };

  const fonts = [
    { id: 'cursive', label: 'Cursiva', sub: 'Caligráfica' },
    { id: 'bold', label: 'Moderna', sub: 'Bold limpa' },
    { id: 'serif', label: 'Serifada', sub: 'Romana clássica' },
    { id: 'rounded', label: 'Arredondada', sub: 'Kawaii / Fofa' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base lg:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Type className="w-5 h-5 text-amber-500" />
              <span>Formas Pré-definidas para Cortador com Texto</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha uma forma base, digite seu texto personalizado e gere o carimbo 3D pronto
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* 1. Escolha da Forma Pré-definida */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Stamp className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Escolha a Forma Base do Cortador ({PREDEFINED_TEXT_SHAPES.length} opções):</span>
              </label>
              <span className="text-[11px] text-amber-400 font-mono">
                {selectedPreset.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PREDEFINED_TEXT_SHAPES.map((shape) => {
                const isSelected = selectedShapeId === shape.id;
                return (
                  <button
                    key={shape.id}
                    onClick={() => setSelectedShapeId(shape.id)}
                    className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <svg viewBox="0 0 100 100" className="w-7 h-7 overflow-visible">
                      <polygon
                        points={shape.model.outerPerimeter.map(([x, y]) => `${x},${y}`).join(' ')}
                        className={
                          isSelected
                            ? 'fill-amber-500/25 stroke-amber-400'
                            : 'fill-slate-800/40 stroke-slate-400'
                        }
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[10px] font-medium truncate w-full text-center">
                      {shape.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {selectedPreset.description}
            </p>
          </div>

          {/* 2. Digite o Texto */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              2. Digite o Texto ou Frase:
            </label>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none font-medium"
              placeholder="Ex: Parabéns, Feito com Amor, 15 Anos, Gratidão..."
            />
          </div>

          {/* 3. Estilo da Fonte */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              3. Estilo da Tipografia:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {fonts.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontFamily(f.id as any)}
                  className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                    fontFamily === f.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs">{f.label}</div>
                  <div className="text-[10px] text-slate-500">{f.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Pré-visualização do Cortador com Texto */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-center gap-4">
            <div className="w-24 h-24 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center p-2 relative shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow">
                <polygon
                  points={selectedPreset.model.outerPerimeter.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="#f59e0b"
                  fillOpacity="0.12"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {selectedPreset.model.innerDetails.map((path, idx) => (
                  <polyline
                    key={idx}
                    points={path.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center p-1 pointer-events-none">
                <span
                  className={`text-[11px] font-bold text-amber-300 leading-tight drop-shadow truncate max-w-[85px] ${
                    fontFamily === 'cursive'
                      ? 'italic font-serif'
                      : fontFamily === 'serif'
                      ? 'font-serif'
                      : 'font-sans'
                  }`}
                >
                  {text || 'Texto'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-200 block">Prévia 2D da Placa</span>
              <p className="text-[11px] leading-relaxed">
                Linha âmbar = <strong className="text-amber-400">Lâmina de corte</strong> externa.
                <br />
                Centro = <strong className="text-cyan-400">Relevo 3D do carimbo</strong> com texto.
              </p>
            </div>
          </div>

          {/* Sugestões Rápidas */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Ideias Rápidas com 1 Clique:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Parabéns!',
                'Com Amor',
                '1 Aninho',
                'Feito com Amor',
                'Biscoito Caseiro',
                'Gratidão',
                'Baby Shower',
                'Feliz Natal',
              ].map((quick) => (
                <button
                  key={quick}
                  onClick={() => setText(quick)}
                  className="px-2.5 py-1 text-[11px] bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-300 rounded hover:text-amber-300 transition-colors cursor-pointer"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dual Actions Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center gap-2 justify-between">
          <button
            onClick={handleApplyToCurrent}
            disabled={!text.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold rounded-lg shadow transition-all cursor-pointer"
            title={`Gravar este texto no carimbo do modelo atual (${currentModelName})`}
          >
            <Stamp className="w-4 h-4 text-amber-400" />
            <span>Gravar no Carimbo Atual</span>
          </button>

          <button
            onClick={handleCreateNewPlaque}
            disabled={!text.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Criar Cortador com {selectedPreset.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
