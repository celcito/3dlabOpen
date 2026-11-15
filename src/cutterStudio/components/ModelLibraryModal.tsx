import React, { useState } from 'react';
import { ModelLineart } from '../types';
import { PRESET_MODELS } from '../data/presets';
import { X, Search, Sparkles, Check } from 'lucide-react';

interface ModelLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModelId: string;
  onSelectModel: (model: ModelLineart) => void;
}

export const ModelLibraryModal: React.FC<ModelLibraryModalProps> = ({
  isOpen,
  onClose,
  activeModelId,
  onSelectModel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'Todos os Modelos' },
    { id: 'confectionery', label: 'Confeitaria & Doces' },
    { id: 'holidays', label: 'Datas Comemorativas' },
    { id: 'animals', label: 'Animais & Pets' },
    { id: 'botanical', label: 'Botânica & Folhas' },
    { id: 'frames', label: 'Molduras & Placas' },
  ];

  const filteredModels = PRESET_MODELS.filter((m) => {
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Modelos Prontos de Cortadores e Carimbos</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Desenhos lineart vetorizados prontos com lâminas afiadas e carimbos anatômicos
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Segmented category buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Models Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredModels.map((model) => {
            const isSelected = model.id === activeModelId;
            return (
              <div
                key={model.id}
                onClick={() => {
                  onSelectModel(model);
                  onClose();
                }}
                className={`group relative p-4 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/70 shadow-md ring-1 ring-amber-500/50'
                    : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/70'
                }`}
              >
                {/* SVG Lineart Vector Preview */}
                <div className="w-full aspect-square max-h-[160px] bg-slate-950/70 rounded-md flex items-center justify-center p-3 relative overflow-hidden border border-slate-800/80">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                    {/* Outer blade path */}
                    <polygon
                      points={model.outerPerimeter.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill="#f59e0b"
                      fillOpacity="0.12"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {/* Inner detail deboss lines */}
                    {model.innerDetails.map((path, idx) => (
                      <polyline
                        key={idx}
                        points={path.map(([x, y]) => `${x},${y}`).join(' ')}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </svg>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 p-1 rounded-full shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                    <span>{model.categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>2 peças (Cortador + Carimbo)</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
                    {model.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {model.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Pronto para 3D</span>
                  <span className="text-xs font-medium text-amber-400 group-hover:underline">
                    {isSelected ? 'Em Edição' : 'Carregar Modelo →'}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredModels.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              Nenhum modelo encontrado para esta busca. Tente outro termo ou categoria.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>{filteredModels.length} modelos prontos disponíveis</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
