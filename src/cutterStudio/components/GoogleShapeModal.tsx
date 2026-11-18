import React, { useState } from 'react';
import { ModelLineart, Path2D, Point2D } from '../types';
import { parseSvgStringToPaths } from '../utils/vectorStudioUtils';
import {
  X,
  Sparkles,
  Search,
  Check,
  Bot,
  Layers,
  Wand2,
  Crown,
  Rocket,
  Moon,
  Sun,
  Coffee,
  Music,
  Trophy,
  Zap,
  Bell,
  Car,
  Key,
  Camera,
  Anchor,
  Gem,
} from 'lucide-react';

interface GoogleShapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCustomModel: (model: ModelLineart) => void;
}

// Built-in Google Material / Standard Silhouettes
interface BasicShapePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  outerPerimeter: Path2D;
  innerDetails: Path2D[];
}

const GOOGLE_BASIC_SILHOUETTES: BasicShapePreset[] = [
  {
    id: 'google_crown',
    name: 'Coroa Real',
    category: 'Símbolos',
    description: 'Coroa clássica com 5 pontas, pedras nos ápices e faixa imperial com carimbo de joias.',
    outerPerimeter: [
      [14, 78], [86, 78], [94, 30], [74, 46], [50, 20], [26, 46], [6, 30]
    ],
    innerDetails: [
      [[14, 70], [86, 70]],
      [[20, 74], [24, 74]],
      [[38, 74], [42, 74]],
      [[58, 74], [62, 74]],
      [[76, 74], [80, 74]],
      // Gem circles
      [[50, 20], [50, 32]],
      [[26, 46], [32, 54]],
      [[74, 46], [68, 54]],
      [[50, 48], [46, 54], [54, 54], [50, 48]]
    ],
  },
  {
    id: 'google_rocket',
    name: 'Foguete Espacial',
    category: 'Ícones',
    description: 'Foguete retro com aletas laterais aerodinâmicas e vigia central.',
    outerPerimeter: [
      [50, 6], [64, 26], [68, 52], [84, 74], [72, 80], [64, 72],
      [58, 86], [42, 86], [36, 72], [28, 80], [16, 74], [32, 52], [36, 26]
    ],
    innerDetails: [
      // Nose cone divider
      [[36, 28], [64, 28]],
      // Porthole window
      [[44, 46], [50, 40], [56, 46], [50, 52], [44, 46]],
      // Fin accents
      [[33, 56], [22, 72]],
      [[67, 56], [78, 72]],
      // Exhaust fire
      [[44, 88], [50, 96], [56, 88]]
    ],
  },
  {
    id: 'google_crescent_moon',
    name: 'Lua Crescente',
    category: 'Astronomia',
    description: 'Lua crescente suave com carimbo de crateras e estrela cadente.',
    outerPerimeter: [
      [52, 6], [66, 14], [80, 28], [88, 48], [86, 68], [76, 82], [58, 92], [48, 94],
      [60, 80], [66, 64], [64, 46], [56, 30], [42, 18]
    ],
    innerDetails: [
      [[68, 38], [74, 38], [74, 44], [68, 44], [68, 38]],
      [[70, 56], [76, 56], [76, 62], [70, 62], [70, 56]],
      [[60, 72], [64, 72], [64, 76], [60, 76], [60, 72]],
      [[30, 42], [36, 42], [38, 36], [40, 42], [46, 42], [41, 46], [43, 52], [38, 48], [33, 52], [35, 46], [30, 42]]
    ],
  },
  {
    id: 'google_coffee_cup',
    name: 'Xícara de Café / Chá',
    category: 'Alimentos',
    description: 'Xícara de cerâmica com pires e ondas aromáticas de café quente.',
    outerPerimeter: [
      [14, 88], [86, 88], [84, 82], [78, 82], [76, 50], [92, 50], [92, 64], [75, 68],
      [73, 76], [27, 76], [24, 50], [16, 82], [14, 82]
    ],
    innerDetails: [
      [[16, 84], [84, 84]],
      [[25, 52], [75, 52]],
      // Steam swirls
      [[38, 42], [36, 32], [42, 22], [40, 12]],
      [[50, 42], [48, 30], [54, 20], [52, 10]],
      [[62, 42], [60, 32], [66, 22], [64, 12]],
      // Handle opening
      [[76, 54], [86, 54], [86, 62], [76, 64]]
    ],
  },
  {
    id: 'google_diamond',
    name: 'Diamante Lapidado',
    category: 'Símbolos',
    description: 'Joia preciosa geométrica facetada com linhas nítidas de reflexo.',
    outerPerimeter: [
      [24, 24], [76, 24], [92, 46], [50, 92], [8, 46]
    ],
    innerDetails: [
      [[8, 46], [92, 46]],
      [[24, 24], [36, 46], [50, 92]],
      [[76, 24], [64, 46], [50, 92]],
      [[24, 24], [50, 46], [76, 24]],
      [[36, 46], [50, 46], [64, 46]],
      [[50, 46], [50, 92]]
    ],
  },
  {
    id: 'google_music_note',
    name: 'Nota Musical Dupla',
    category: 'Música',
    description: 'Colcheia dupla conectada com duas cabeças ovais e carimbo de pentagrama.',
    outerPerimeter: [
      [14, 76], [32, 76], [32, 28], [78, 16], [78, 64], [94, 64], [94, 80],
      [64, 88], [58, 88], [60, 40], [24, 50], [24, 86], [8, 86], [8, 76]
    ],
    innerDetails: [
      [[26, 32], [76, 20]],
      [[26, 40], [76, 28]],
      [[16, 78], [24, 78]],
      [[68, 76], [76, 76]]
    ],
  },
  {
    id: 'google_trophy',
    name: 'Troféu Campeão',
    category: 'Símbolos',
    description: 'Taça de premiação com alças duplas, estrela da vitória e pedestal.',
    outerPerimeter: [
      [22, 16], [78, 16], [76, 44], [90, 24], [92, 54], [70, 58], [58, 72], [64, 86],
      [74, 88], [74, 94], [26, 94], [26, 88], [36, 86], [42, 72], [30, 58], [8, 54],
      [10, 24], [24, 44]
    ],
    innerDetails: [
      [[24, 20], [76, 20]],
      [[30, 90], [70, 90]],
      // Victory star inside cup
      [[50, 32], [53, 38], [60, 39], [55, 44], [57, 50], [50, 46], [43, 50], [45, 44], [40, 39], [47, 38], [50, 32]]
    ],
  },
  {
    id: 'google_lightning',
    name: 'Raio de Trovão',
    category: 'Ícones',
    description: 'Silhueta afiada de raio elétrico com facetas angulares.',
    outerPerimeter: [
      [42, 6], [74, 6], [54, 40], [84, 40], [28, 94], [44, 52], [22, 52]
    ],
    innerDetails: [
      [[44, 12], [66, 12]],
      [[40, 46], [70, 46]],
      [[46, 14], [38, 48], [48, 54], [34, 84]]
    ],
  },
];

export const GoogleShapeModal: React.FC<GoogleShapeModalProps> = ({
  isOpen,
  onClose,
  onApplyCustomModel,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'ai'>('ai');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  // Handles Google Gemini API shape generation
  const handleGenerateWithGoogleApi = async () => {
    if (!aiPrompt.trim()) return;

    setIsLoadingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/flexi/generate-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: Falha ao processar forma.`);
      }

      const data = await response.json();

      if (!data.svgCode || typeof data.svgCode !== 'string') {
        throw new Error('A API não retornou um SVG válido.');
      }

      const parsedPaths = parseSvgStringToPaths(data.svgCode);
      if (!parsedPaths || parsedPaths.length === 0 || parsedPaths[0].length < 3) {
        throw new Error('A API não retornou uma silhueta de contorno válida.');
      }

      const generatedModel: ModelLineart = {
        id: `google_ai_${Date.now()}`,
        name: aiPrompt.trim(),
        category: 'frames',
        categoryLabel: 'Google API',
        description: `Forma gerada via API do Google para "${aiPrompt}".`,
        iconName: 'Sparkles',
        outerPerimeter: parsedPaths[0],
        innerDetails: parsedPaths.slice(1),
      };

      onApplyCustomModel(generatedModel);
      onClose();
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Erro ao conectar à API do Google.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const filteredSilhouettes = GOOGLE_BASIC_SILHOUETTES.filter(
    (s) =>
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.description.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--surface-container-high)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--primary-fixed)] border border-[var(--primary)] text-[var(--primary)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base lg:text-lg font-bold text-[var(--on-surface)] flex items-center gap-2">
                <span>Silhuetas e Ícones via API do Google</span>
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Gere ou escolha formas e ícones para converter automaticamente em cortadores e carimbos 3D
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded-lg hover:bg-[var(--surface-container-low)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)] p-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'ai'
                ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm border border-[var(--surface-container-highest)]'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            <Wand2 className="w-4 h-4 text-[var(--primary)]" />
            <span>Gerador Inteligente (Google Gemini API)</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'catalog'
                ? 'bg-[var(--surface-container-low)] text-[var(--primary)] shadow-sm border border-[var(--surface-container-highest)]'
                : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            <Layers className="w-4 h-4 text-[var(--primary)]" />
            <span>Catálogo de Silhuetas Google ({GOOGLE_BASIC_SILHOUETTES.length})</span>
          </button>
        </div>

        {/* Tab 1: AI Prompt Generator */}
        {activeTab === 'ai' && (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="bg-[var(--workbench-page)] p-4 rounded-xl border border-[var(--surface-container-high)] space-y-3">
              <label className="block text-xs font-semibold text-[var(--on-surface)]">
                O que você gostaria de transformar em cortador e carimbo?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoadingAi && aiPrompt.trim()) {
                      handleGenerateWithGoogleApi();
                    }
                  }}
                  placeholder="Ex: Coroa de princesa, dinossauro t-rex, foguete espacial, guitarra elétrica..."
                  className="w-full pl-3.5 pr-10 py-2.5 bg-[var(--workbench-panel)] border border-[var(--surface-container-highest)] rounded-lg text-xs text-[var(--on-surface)] placeholder:text-[var(--workbench-muted)] focus:outline-none focus:border-[var(--primary)] font-medium"
                />
                <button
                  onClick={handleGenerateWithGoogleApi}
                  disabled={isLoadingAi || !aiPrompt.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] rounded-md text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isLoadingAi ? 'Criando...' : 'Gerar 3D'}
                </button>
              </div>

              {aiError && (
                <div className="p-3 bg-[#FEE2E2] border border-[var(--error)] rounded-lg text-[var(--error)] text-xs">
                  {aiError}
                </div>
              )}

              <p className="text-[11px] text-[var(--on-surface-variant)]">
                A API do Google Gemini calcula automaticamente o contorno fechado para a lâmina afiada e as linhas internas ideais para o carimbo de relevo.
              </p>
            </div>

            {/* Quick Inspiration Prompts */}
            <div>
              <span className="text-xs text-[var(--on-surface-variant)] block mb-2 font-medium">
                Ideias Prontas para Testar com 1 Clique:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  'Dinossauro T-Rex fofo',
                  'Foguete com aletas',
                  'Coroa de rainha com joias',
                  'Xícara de chá com vapor',
                  'Guitarra elétrica rock',
                  'Castelo medieval com torres',
                  'Unicórnio com chifre mágico',
                  'Borboleta com asas rendadas',
                  'Folha de bordo canadense',
                ].map((idea) => (
                  <button
                    key={idea}
                    onClick={() => {
                      setAiPrompt(idea);
                    }}
                    className="p-2 bg-[var(--workbench-page)] border border-[var(--surface-container-high)] hover:border-[var(--primary)] text-[var(--on-surface-variant)] hover:text-[var(--primary)] rounded-lg text-left transition-colors truncate"
                  >
                    ✦ {idea}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingAi && (
              <div className="p-6 bg-[var(--workbench-page)] border border-[var(--primary)] rounded-xl flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
                <div>
                  <p className="text-xs font-semibold text-[var(--on-surface)]">
                    Processando com a API do Google...
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)] mt-0.5">
                    Calculando perímetro do cortador e lâminas do carimbo.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Curated Silhouettes Catalog */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Search filter */}
            <div className="p-4 border-b border-[var(--surface-container-high)] bg-[var(--workbench-page)]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--on-surface-variant)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar silhuetas..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--workbench-panel)] border border-[var(--surface-container-highest)] rounded-md text-[var(--on-surface)] placeholder:text-[var(--workbench-muted)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[50vh]">
              {filteredSilhouettes.map((shape) => (
                <div
                  key={shape.id}
                  onClick={() => {
                    const customModel: ModelLineart = {
                      id: shape.id,
                      name: shape.name,
                      category: 'frames',
                      categoryLabel: shape.category,
                      description: shape.description,
                      iconName: 'Sparkles',
                      outerPerimeter: shape.outerPerimeter,
                      innerDetails: shape.innerDetails,
                    };
                    onApplyCustomModel(customModel);
                    onClose();
                  }}
                  className="group p-3 bg-[var(--workbench-page)] border border-[var(--surface-container-high)] hover:border-[var(--primary)] rounded-lg cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="w-full aspect-square bg-[var(--workbench-panel)] rounded-md p-2 flex items-center justify-center border border-[var(--surface-container-high)] group-hover:border-[var(--primary)]">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow">
                      <polygon
                        points={shape.outerPerimeter.map(([x, y]) => `${x},${y}`).join(' ')}
                        fill="#904000"
                        fillOpacity="0.15"
                        stroke="#904000"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      {shape.innerDetails.map((path, idx) => (
                        <polyline
                          key={idx}
                          points={path.map(([x, y]) => `${x},${y}`).join(' ')}
                          fill="none"
                          stroke="#7C4DFF"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="mt-2.5">
                    <h4 className="text-xs font-semibold text-[var(--on-surface)] group-hover:text-[var(--primary)] transition-colors">
                      {shape.name}
                    </h4>
                    <span className="text-[10px] text-[var(--workbench-muted)] block truncate">
                      {shape.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
          <span>Pronto para impressão 3D (Cortador + Carimbo)</span>
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
