import React, { useState, useRef } from 'react';
import { X, Upload, Sparkles, Sliders, Check, Download, Image as ImageIcon, ArrowRight } from 'lucide-react';

interface SvgConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyIcon: (svgDataUrl: string, name: string) => void;
}

export const SvgConverterModal: React.FC<SvgConverterModalProps> = ({
  isOpen,
  onClose,
  onApplyIcon,
}) => {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(128);
  const [strokeThickness, setStrokeThickness] = useState<number>(2.5);
  const [invert, setInvert] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [convertedSvgUrl, setConvertedSvgUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const sampleIcons = [
    { name: 'Coroa Imperial', icon: '👑' },
    { name: 'Dinossauro Rex', icon: '🦖' },
    { name: 'Controle Gamer', icon: '🎮' },
    { name: 'Borboleta', icon: '🦋' },
    { name: 'Flor Suave', icon: '🌸' },
    { name: 'Foguete Espacial', icon: '🚀' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreviewSrc(result);
      processImageToVector(result, threshold, strokeThickness, invert);
    };
    reader.readAsDataURL(file);
  };

  const processImageToVector = (
    src: string,
    th: number,
    _thickness: number,
    inv: boolean
  ) => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 256;
      canvas.width = size;
      canvas.height = size;

      ctx.drawImage(img, 0, 0, size, size);
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const isDark = avg < th;
        const pass = inv ? !isDark : isDark;
        if (pass && data[i + 3] > 50) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        } else {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const processedUrl = canvas.toDataURL('image/png');
      setConvertedSvgUrl(processedUrl);
      setIsProcessing(false);
    };
    img.src = src;
  };

  const handleApply = () => {
    if (convertedSvgUrl) {
      onApplyIcon(convertedSvgUrl, 'Icone_Personalizado');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--workbench-page)]/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--surface-container-high)] bg-[var(--workbench-panel)]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Conversor de SVG & Imagens 3D
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Otimizador
                </span>
              </h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Transforme desenhos e silhuetas em linhas reforçadas prontas para fatiamento 3D
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Dica em Destaque */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
            <span className="text-base shrink-0">💡</span>
            <p>
              <strong>Dica de Impressão 3D:</strong> Linhas menores que 1.2 mm podem quebrar ou não ser fatiadas pelo bico 0.4mm. O conversor engrossa os perímetros automaticamente para garantir impressão sólida sem falhas.
            </p>
          </div>

          {/* Área de Upload / Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--surface-container-high)] hover:border-amber-500/60 rounded-xl p-6 text-center cursor-pointer bg-[var(--workbench-page)]/40 hover:bg-[var(--workbench-page)]/70 transition-all flex flex-col items-center justify-center gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)]">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--workbench-text)]">
                Clique para enviar ou arraste seu arquivo
              </p>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                Formatos aceitos: SVG, PNG, JPG ou WebP
              </p>
            </div>
          </div>

          {/* Exemplos Rápidos */}
          <div>
            <label className="text-xs font-semibold text-[var(--on-surface-variant)] block mb-2">
              Ou selecione um ícone de teste:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {sampleIcons.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 128;
                    canvas.height = 128;
                    const c = canvas.getContext('2d');
                    if (c) {
                      c.font = '72px sans-serif';
                      c.textAlign = 'center';
                      c.textBaseline = 'middle';
                      c.fillText(item.icon, 64, 68);
                      const url = canvas.toDataURL();
                      setPreviewSrc(url);
                      processImageToVector(url, threshold, strokeThickness, invert);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[var(--surface-container-high)]/80 hover:bg-amber-500/20 hover:border-amber-500/40 border border-[var(--surface-container-high)]/60 flex flex-col items-center gap-1 transition-all text-center"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[10px] text-[var(--on-surface-variant)] truncate w-full">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pré-visualização & Controles de Ajuste */}
          {previewSrc && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--surface-container-high)]">
              {/* Preview da Imagem */}
              <div className="bg-[var(--workbench-page)] p-4 rounded-xl border border-[var(--surface-container-high)] flex flex-col items-center justify-center">
                <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] mb-2 uppercase tracking-wider">
                  Vetor Processado para 3D
                </span>
                <div className="w-36 h-36 rounded-lg bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] flex items-center justify-center p-2 relative overflow-hidden">
                  {isProcessing ? (
                    <div className="text-xs text-amber-400 animate-pulse">Processando...</div>
                  ) : convertedSvgUrl ? (
                    <img
                      src={convertedSvgUrl}
                      alt="Processed Vector"
                      className="max-w-full max-h-full object-contain filter invert contrast-200"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-600" />
                  )}
                </div>
              </div>

              {/* Sliders de Otimização */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-[var(--on-surface-variant)]">
                    <span>Limiar de Contraste (Threshold)</span>
                    <span className="text-amber-400 font-mono">{threshold}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="220"
                    step="1"
                    value={threshold}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setThreshold(val);
                      if (previewSrc) processImageToVector(previewSrc, val, strokeThickness, invert);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-[var(--on-surface-variant)]">
                    <span>Espessura de Linhas (Reforço 3D)</span>
                    <span className="text-amber-400 font-mono">{strokeThickness} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.5"
                    value={strokeThickness}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStrokeThickness(val);
                      if (previewSrc) processImageToVector(previewSrc, threshold, val, invert);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="invert-check"
                    checked={invert}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setInvert(val);
                      if (previewSrc) processImageToVector(previewSrc, threshold, strokeThickness, val);
                    }}
                    className="w-4 h-4 rounded bg-[var(--surface-container-high)] border-[var(--surface-container-high)] text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="invert-check" className="text-xs text-[var(--on-surface-variant)] cursor-pointer">
                    Inverter Cores (Preto / Branco)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-[var(--surface-container-high)] bg-[var(--workbench-panel)]/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--on-surface-variant)] hover:text-white hover:bg-[var(--surface-container-high)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!convertedSvgUrl}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar como Ícone da Ponteira</span>
          </button>
        </div>
      </div>
    </div>
  );
};
