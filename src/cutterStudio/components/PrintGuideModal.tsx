import React from 'react';
import { X, CheckCircle2, ShieldCheck, Flame, Cpu, Sparkles } from 'lucide-react';

interface PrintGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintGuideModal: React.FC<PrintGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--inverse-surface)]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--surface-container-high)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--primary-fixed)] border border-[var(--primary)] text-[var(--primary)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--on-surface)]">
                Guia de Impressão 3D e Segurança Alimentar
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Como fatiar, imprimir e utilizar cortadores de biscoito com acabamento profissional
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[var(--on-surface-variant)]">
          {/* Section 1: Slicer Settings */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--primary)] flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              <span>1. Configuração no Fatiador (Bambu Studio / Cura / PrusaSlicer)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--workbench-page)] p-4 rounded-lg border border-[var(--surface-container-high)]">
              <div>
                <span className="text-[var(--on-surface-variant)] block text-[11px]">Posição na Mesa</span>
                <p className="font-medium text-[var(--on-surface)] mt-0.5">
                  Aba/borda de apoio larga colada na mesa, lâmina apontada para cima.
                </p>
              </div>
              <div>
                <span className="text-[var(--on-surface-variant)] block text-[11px]">Altura de Camada</span>
                <p className="font-medium text-[var(--on-surface)] mt-0.5">
                  0.20 mm para o Cortador / 0.16 mm para o Carimbo (detalhes nítidos).
                </p>
              </div>
              <div>
                <span className="text-[var(--on-surface-variant)] block text-[11px]">Paredes (Perímetros)</span>
                <p className="font-medium text-[var(--on-surface)] mt-0.5">
                  3 a 4 voltas de parede. Garante que a lâmina seja 100% maciça.
                </p>
              </div>
              <div>
                <span className="text-[var(--on-surface-variant)] block text-[11px]">Suportes</span>
                <p className="font-medium text-[var(--on-surface)] mt-0.5">
                  Desativados! O modelo possui ângulos projetados para dispensar suportes.
                </p>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-[var(--surface-container-high)]">
                <span className="text-[var(--on-surface-variant)] block text-[11px]">Preenchimento Interno (Infill)</span>
                <p className="font-medium text-[var(--on-surface)] mt-0.5">
                  15% a 20% (Padrão Gyroid ou Grade) é o ideal para leveza e economia. Use 40% a 100% apenas se precisar de rigidez extrema para massas ultracongeladas.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Confectionery & Food Safety */}
          <div>
            <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>2. Segurança Alimentar (Food-Safe) & Higiene</span>
            </h3>
            <ul className="space-y-2 bg-[var(--workbench-page)] p-4 rounded-lg border border-[var(--surface-container-high)] text-[var(--on-surface-variant)]">
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">•</span>
                <span>
                  <strong>Filamento PLA Virgem ou PETG:</strong> O PLA é de origem vegetal (amido de milho) e biodegradável. Prefira marcas com laudo de atoxidade.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">•</span>
                <span>
                  <strong>Técnica do Filme Plástico (Padrão Confeitaria):</strong> Coloque uma película de plástico filme (PVC) sobre a massa esticada antes de estampar com o carimbo. O carimbo nunca entra em contato direto com a massa, garantindo higiene hospitalar e zero sujeira entre os relevos!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">•</span>
                <span>
                  <strong>Lavagem:</strong> Lave sempre com água fria ou morna e detergente neutro. <strong>NUNCA</strong> coloque peças de PLA em lava-louças ou água fervente, pois o calor pode deformar a geometria.
                </span>
              </li>
            </ul>
          </div>

          {/* Section 3: Professional Baking Tips */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--primary)] flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" />
              <span>3. Segredos para o Biscoito Perfeito</span>
            </h3>
            <div className="bg-[var(--workbench-page)] p-4 rounded-lg border border-[var(--surface-container-high)] space-y-2 text-[var(--on-surface-variant)]">
              <p>
                <strong>Massa Firme e Gelada:</strong> Deixe a massa amanteigada descansar na geladeira por pelo menos 1 hora antes de abrir e cortar. Massa gelada não deforma e mantém os traços do carimbo perfeitamente nítidos após assar.
              </p>
              <p>
                <strong>Farinha de Trigo ou Amido:</strong> Dê uma leve batidinha do cortador e carimbo na farinha ou amido de milho antes de cada corte para soltar sem esforço.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-page)] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)] text-xs font-medium rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
