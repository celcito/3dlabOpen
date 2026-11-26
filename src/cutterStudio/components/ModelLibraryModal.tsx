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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--surface-container-high)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--on-surface)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--primary)]" />
              <span>Modelos Prontos de Cortadores e Carimbos</span>
            </h2>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              Desenhos lineart vetorizados prontos com lâminas afiadas e carimbos anatômicos
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-lg hover:bg-[var(--surface-container-low)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Segmented category buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[var(--on-surface-variant)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--workbench-panel)] border border-[var(--surface-container-highest)] rounded-md text-[var(--on-surface)] placeholder:text-[var(--workbench-muted)] focus:outline-none focus:border-[var(--primary)]"
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
                    ? 'bg-[var(--primary-fixed)] border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]'
                    : 'bg-[var(--surface-container-low)] border-[var(--surface-container-high)] hover:border-[var(--surface-container-highest)] hover:bg-[var(--surface-container-low)]'
                }`}
              >
                {/* SVG Lineart Vector Preview */}
                <div className="w-full aspect-square max-h-[160px] bg-[var(--workbench-page)] rounded-md flex items-center justify-center p-3 relative overflow-hidden border border-[var(--surface-container-high)]">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                    {/* Outer blade path */}
                    <polygon
                      points={model.outerPerimeter.map(([x, y]) => `${x},${y}`).join(' ')}
                      fill="#904000"
                      fillOpacity="0.12"
                      stroke="#904000"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {/* Inner detail deboss lines */}
                    {model.innerDetails.map((path, idx) => (
                      <polyline
                        key={idx}
                        points={path.map(([x, y]) => `${x},${y}`).join(' ')}
                        fill="none"
                        stroke="#7C4DFF"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </svg>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-[var(--primary)] text-[var(--on-primary)] p-1 rounded-full shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--on-surface-variant)] mb-1">
                    <span>{model.categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>2 peças (Cortador + Carimbo)</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)] group-hover:text-[var(--primary)] transition-colors">
                    {model.name}
                  </h3>
                  <p className="text-xs text-[var(--on-surface-variant)] mt-1 line-clamp-2">
                    {model.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[var(--surface-container-high)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--on-surface-variant)]">Pronto para 3D</span>
                  <span className="text-xs font-medium text-[var(--primary)] group-hover:underline">
                    {isSelected ? 'Em Edição' : 'Carregar Modelo →'}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredModels.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--on-surface-variant)] text-xs">
              Nenhum modelo encontrado para esta busca. Tente outro termo ou categoria.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
          <span>{filteredModels.length} modelos prontos disponíveis</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] rounded-md transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
