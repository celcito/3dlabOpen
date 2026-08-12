import React from "react";
import { Upload, Download, FileImage, RefreshCw, CheckCircle2, AlertCircle, X, ArrowRightLeft, Settings, Sliders, Image as ImageIcon, Play, Undo } from "lucide-react";
import { useSvgConverter } from "../hooks/useSvgConverter";

export default function SvgConverter() {
  const { results, isConverting, options, setOptions, showOptions, setShowOptions, fileInputRef, handleFileChange, handleDragOver, handleDrop, removeResult, clearAll, startConversion, downloadSvg } = useSvgConverter();

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#F9FAF4]">
      <div className="max-w-5xl mx-auto w-full">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#1A1C19] flex items-center gap-3">
              <ArrowRightLeft className="w-8 h-8 text-[#632CE5]" />
              Vetorizador de Imagens
            </h1>
            <p className="text-zinc-400 mt-2 text-sm max-w-xl font-sans font-medium uppercase tracking-tight">
              Transforme PNG, JPG ou WEBP em arquivos SVG vetoriais prontos para impressão 3D ou corte a laser.
              Processamento 100% local e seguro.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center gap-2 px-4 py-2 rounded border transition-all text-[10px] font-black uppercase tracking-widest ${
                showOptions ? "bg-[#632CE5]/10 border-[#632CE5] text-[#632CE5]" : "bg-[#E8E9E3] border-[#E8E9E3] text-zinc-400 hover:text-[#212121]"
              }`}
            >
              <Settings className={`w-3.5 h-3.5 ${showOptions ? 'animate-spin-slow' : ''}`} />
              Opções de Vetorização
            </button>
          </div>
        </header>

        {showOptions && (
          <div className="mb-8 bg-white border border-[#E2E3DD] rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Número de Cores</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{options.numberofcolors}</span>
                </div>
                <input 
                  type="range" min="2" max="64" step="1" 
                  value={options.numberofcolors} 
                  onChange={(e) => setOptions({...options, numberofcolors: parseInt(e.target.value)})}
                  className="w-full accent-[#632CE5] h-1 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Suavização (Blur)</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{options.blurradius}px</span>
                </div>
                <input 
                  type="range" min="0" max="10" step="1" 
                  value={options.blurradius} 
                  onChange={(e) => setOptions({...options, blurradius: parseInt(e.target.value)})}
                  className="w-full accent-[#632CE5] h-1 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Detalhe (Omitir Caminhos)</label>
                  <span className="text-[10px] font-mono text-[#632CE5]">{options.pathomit}px</span>
                </div>
                <input 
                  type="range" min="0" max="64" step="1" 
                  value={options.pathomit} 
                  onChange={(e) => setOptions({...options, pathomit: parseInt(e.target.value)})}
                  className="w-full accent-[#632CE5] h-1 bg-[#F9FAF4] rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[8px] text-zinc-600 uppercase font-bold italic">Caminhos menores que esse valor serão ignorados.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Modo de Camadas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setOptions({...options, layering: 0})}
                    className={`py-2 text-[9px] font-black uppercase border rounded transition-all ${options.layering === 0 ? 'bg-[#632CE5]/10 text-[#632CE5] border-[#632CE5]/30' : 'bg-[#E8E9E3] text-zinc-500 border-[#E2E3DD] hover:text-[#212121]'}`}
                  >
                    Sobrepostas
                  </button>
                  <button 
                    onClick={() => setOptions({...options, layering: 1})}
                    className={`py-2 text-[9px] font-black uppercase border rounded transition-all ${options.layering === 1 ? 'bg-[#632CE5]/10 text-[#632CE5] border-[#632CE5]/30' : 'bg-[#E8E9E3] text-zinc-500 border-[#E2E3DD] hover:text-[#212121]'}`}
                  >
                    Recortadas
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div 
            className="border-2 border-dashed border-[#E8E9E3] bg-white hover:border-[#632CE5] rounded-xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group relative overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {/* Background Accent */}
            <div className="absolute inset-0 bg-[#632CE5]/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              multiple
              className="hidden" 
            />
            
            <div className="w-16 h-16 rounded-2xl bg-[#E8E9E3] border border-[#E8E9E3] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-[#632CE5]/40 transition-all duration-500">
              <Upload className="w-8 h-8 text-[#632CE5]" />
            </div>
            <h3 className="text-xl font-black text-[#1A1C19] mb-2 uppercase tracking-tight">Solte suas imagens aqui</h3>
            <p className="text-sm text-zinc-500 max-w-md font-medium uppercase tracking-tight leading-relaxed">
              Arraste arquivos PNG ou JPG ou clique para selecionar. Converta logos e artes em vetores escaláveis instantaneamente.
            </p>
          </div>

          {results.length > 0 && (
            <div className="bg-white border border-[#E2E3DD] rounded-xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#632CE5]">Fila de Processamento</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{results.length} arquivo(s) prontos</p>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={clearAll}
                    className="px-4 py-2 rounded bg-[#E8E9E3] border border-[#E8E9E3] text-zinc-500 hover:text-[#212121] hover:border-[#E8E9E3] text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Limpar Tudo
                  </button>
                  <button
                    disabled={results.filter(r => r.status === "pending" || r.status === "error").length === 0 || isConverting}
                    onClick={startConversion}
                    className={`px-6 py-2 rounded font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 transition-all ${
                      results.filter(r => r.status === "pending" || r.status === "error").length === 0 
                        ? "bg-[#F9FAF4] text-zinc-600 cursor-not-allowed border border-transparent" 
                        : isConverting 
                          ? "bg-[#632CE5]/20 text-[#632CE5] cursor-wait border border-[#632CE5]/30" 
                          : "bg-[#632CE5] text-[#1A1C19] hover:bg-[#632CE5]/90 border border-[#632CE5]"
                    }`}
                  >
                    {isConverting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Convertendo...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Vetorizar Agora
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {results.map(r => (
                  <div key={r.id} className="flex items-center gap-6 bg-white border border-[#E2E3DD] rounded-xl p-4 group hover:border-[#E8E9E3] transition-all">
                    <div className="w-24 h-24 rounded-lg bg-[#E8E9E3] border border-[#E8E9E3] flex items-center justify-center shrink-0 overflow-hidden relative">
                      {r.status === "done" && r.svgString ? (
                        <div className="w-full h-full p-2 bg-white flex items-center justify-center" dangerouslySetInnerHTML={{ __html: r.svgString }} />
                      ) : (
                        <img src={r.previewUrl} className="w-full h-full object-contain opacity-50" alt="Preview" />
                      )}
                      
                      {r.status === "converting" && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-[#632CE5] animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col flex-1 min-w-0 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-xs text-[#1A1C19] truncate uppercase tracking-tight">{r.file.name}</span>
                        {r.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        {r.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 bg-[#E8E9E3] px-2 py-0.5 border border-[#E2E3DD] rounded">
                          {r.file.type.split('/')[1]} → SVG
                        </span>
                        <span className="text-[9px] font-mono text-zinc-700">
                          {(r.file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      {r.status === "converting" && (
                        <div className="w-full bg-[#E8E9E3] h-1.5 rounded-full mt-4 overflow-hidden border border-[#E8E9E3]">
                          <div 
                            className="bg-[#632CE5] h-full transition-all duration-300 shadow-[0_0_10px_#632CE5]"
                            style={{ width: `${r.progress}%` }}
                          />
                        </div>
                      )}

                      {r.error && (
                        <p className="text-[10px] text-red-500 mt-2 font-bold uppercase tracking-tight">{r.error}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 py-2">
                      {r.status === "done" ? (
                        <button 
                          onClick={() => downloadSvg(r)}
                          className="bg-[#E8E9E3] border border-[#E8E9E3] hover:border-[#632CE5]/40 text-[#212121] hover:text-[#632CE5] px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Salvar SVG
                        </button>
                      ) : (
                        <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded border ${
                          r.status === "pending" ? "text-zinc-600 border-[#E2E3DD] bg-[#E8E9E3]" :
                          r.status === "converting" ? "text-[#632CE5] border-[#632CE5]/20 bg-[#632CE5]/5" :
                          "text-red-500 border-red-500/20 bg-red-500/5"
                        }`}>
                          {r.status === "pending" ? "Aguardando" : 
                           r.status === "converting" ? "Processando" : 
                           "Falhou"}
                        </div>
                      )}
                      
                      <button 
                        onClick={() => removeResult(r.id)}
                        disabled={isConverting && r.status === "converting"}
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-700 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                      >
                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-8 border-t border-[#E2E3DD] flex justify-center">
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.3em] flex items-center gap-3">
                  <ImageIcon className="w-3 h-3" />
                  Vértice Studio Digital Pro Processing Engine
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
