import React, { useState, useRef } from 'react';
import { FONT_CATALOG } from '../lib/letterBox/presets';
import { ensureGoogleFonts } from '../lib/fonts/googleFonts';
import { Type, Upload, ChevronDown } from 'lucide-react';

export interface FontPatch {
  fontFamily: string;
  customFontName?: string;
  customFontBase64?: string;
}

interface FontPickerProps {
  fontFamily: string;
  customFontName?: string;
  onChange: (patch: FontPatch) => void;
}

export const FontPicker: React.FC<FontPickerProps> = ({ fontFamily, customFontName, onChange }) => {
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategoryFilter, setFontCategoryFilter] = useState<string>('all');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Abre/fecha o seletor e pré-carrega as fontes do catálogo para as prévias
  const toggleFontDropdown = () => {
    const willOpen = !isFontDropdownOpen;
    setIsFontDropdownOpen(willOpen);
    if (!willOpen || previewLoading) return;

    setPreviewLoading(true);
    ensureGoogleFonts(FONT_CATALOG.filter((f) => !f.isSystem).map((f) => f.id)).finally(() =>
      setPreviewLoading(false)
    );
  };

  // Upload de Fonte Customizada (.ttf, .otf, .woff)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const customName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Fonte_Customizada';

      const fontFace = new FontFace(customName, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);

      // Converte para base64 se o arquivo for razoável (<2.5MB) para persistir no localStorage
      let base64String: string | undefined = undefined;
      if (file.size < 2.5 * 1024 * 1024) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64String = window.btoa(binary);
      }

      onChange({
        fontFamily: customName,
        customFontName: customName,
        customFontBase64: base64String,
      });
      setIsFontDropdownOpen(false);
    } catch (err) {
      console.error('Erro ao carregar fonte:', err);
      alert('Não foi possível carregar o arquivo de fonte. Tente outro arquivo .ttf ou .otf.');
    }
  };

  // Filtragem do catálogo de fontes
  const filteredFonts = FONT_CATALOG.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(fontSearch.toLowerCase()) ||
      f.description.toLowerCase().includes(fontSearch.toLowerCase());
    const matchesCat = fontCategoryFilter === 'all' || f.category === fontCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[9px] uppercase font-bold text-zinc-600">Família da Fonte</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[9px] font-black uppercase tracking-wide text-[#632CE5] hover:text-purple-400 flex items-center gap-1 transition-colors"
        >
          <Upload className="w-3 h-3" />
          Upload Fonte (.ttf)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      <button
        type="button"
        onClick={toggleFontDropdown}
        className="w-full px-3 py-2.5 bg-white border border-[var(--surface-container-high)] hover:border-[#632CE5]/40 rounded flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex flex-col truncate pr-2">
          <span
            className="text-[11px] font-bold text-[var(--workbench-text)] truncate"
            style={{ fontFamily }}
          >
            {customFontName || fontFamily}
          </span>
          <span className="text-[9px] uppercase font-bold text-zinc-600 truncate">
            {customFontName
              ? 'Fonte Personalizada Carregada'
              : FONT_CATALOG.find((f) => f.id === fontFamily)?.description || 'Fonte Selecionada'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-[var(--on-surface-variant)] shrink-0" />
      </button>

      {isFontDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2.5 bg-[var(--workbench-panel)] border border-[var(--surface-container-high)] rounded-xl shadow-2xl z-30 space-y-2 max-h-80 overflow-y-auto">
          <input
            type="text"
            placeholder="Buscar fonte..."
            value={fontSearch}
            onChange={(e) => setFontSearch(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-[var(--surface-container-high)] rounded text-[10px] text-[var(--workbench-text)] placeholder-slate-500 focus:outline-none focus:border-[#632CE5]"
          />

          {previewLoading && (
            <div className="flex items-center gap-2 text-[9px] uppercase font-bold text-zinc-600">
              <span className="w-3 h-3 border-2 border-[#632CE5] border-t-transparent rounded-full animate-spin shrink-0" />
              Carregando prévias das fontes…
            </div>
          )}

          <div className="flex gap-1 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'Todas (50+)' },
              { id: 'geom', label: 'Geométrica' },
              { id: 'bold', label: 'Destaque 3D' },
              { id: 'condensed', label: 'Condensada' },
              { id: 'fun', label: 'Divertida' },
              { id: 'script', label: 'Script' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFontCategoryFilter(cat.id)}
                className={`px-2 py-0.5 rounded whitespace-nowrap transition-all text-[9px] font-black uppercase tracking-wide ${
                  fontCategoryFilter === cat.id
                    ? 'border border-[#632CE5] text-[#632CE5] bg-[#632CE5]/10'
                    : 'border border-[var(--workbench-line)] text-[var(--on-surface-variant)] hover:border-[#632CE5]/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {filteredFonts.map((font) => {
              const isSelected = fontFamily === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => {
                    onChange({
                      fontFamily: font.id,
                      customFontName: undefined,
                      customFontBase64: undefined,
                    });
                    setIsFontDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'border border-[#632CE5] bg-[#632CE5]/10 text-[var(--workbench-text)]'
                      : 'border border-transparent hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-semibold" style={{ fontFamily: font.id }}>
                      {font.name}
                    </div>
                    <div className="text-[10px] text-[var(--on-surface-variant)]">
                      {font.description}
                    </div>
                  </div>
                  {isSelected && <Type className="w-3.5 h-3.5 text-[#632CE5] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
