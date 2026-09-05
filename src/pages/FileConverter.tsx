import React from "react";
import { Upload, Download, FileBox, RefreshCw, FileText, CheckCircle2, AlertCircle, X, Layers, Play } from "lucide-react";
import { useFileConverter } from "../hooks/useFileConverter";

export default function FileConverter() {
  const { files, outputFormat, isConverting, isLoading, loadingFileId, fileInputRef, handleFileChange, handleDragOver, handleDrop, removeFile, clearAll, convertBatch, changeOutputFormat, getOutputFilename, pendingCount } = useFileConverter();
  const isBusy = isLoading || isConverting;

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#1A1C19] flex items-center gap-3">
              <Layers className="w-8 h-8 text-[#632CE5]" />
              Conversor 3D Batch
            </h1>
            <p className="text-zinc-400 mt-2 text-sm max-w-xl">
              Converta modelos 3D instantaneamente em lote. Suporte para STL, OBJ e FBX. 
              Exporte para STL, OBJ, GLTF ou GLB sem depender da nuvem (nota: FBX não possui exportador nativo em web, recomendamos GLB).
            </p>
          </div>
          
          <div className="bg-[#E8E9E3] border border-[#E8E9E3] rounded-lg p-4 flex gap-4">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Formato de Saída</h3>
              <div className="flex gap-1 mt-1">
                {(["stl", "obj", "gltf", "glb"] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => {
                      if (fmt !== outputFormat) {
                        // Clear converted files when format changes
                        changeOutputFormat(fmt);
                      }
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      outputFormat === fmt 
                        ? "bg-[#632CE5] text-white" 
                        : "bg-[#E8E9E3] text-zinc-400 hover:text-[#212121]"
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          {/* Upload Area */}
          <div 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all relative ${
              isBusy ? "border-[#632CE5] bg-[#632CE5]/5 cursor-wait" : "border-[#E8E9E3] bg-[#E8E9E3] hover:border-[#632CE5] cursor-pointer"
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => { if (!isBusy) fileInputRef.current?.click(); }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".stl,.obj,.fbx" 
              multiple
              className="hidden" 
            />
            
            <div className="w-12 h-12 rounded-full bg-[#E8E9E3] flex items-center justify-center mb-4">
              {isBusy ? (
                <RefreshCw className="w-6 h-6 text-[#632CE5] animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-[#632CE5]" />
              )}
            </div>
            <h3 className="text-lg font-bold text-[#1A1C19] mb-2">
              {isLoading ? "Carregando arquivos..." : isConverting ? "Convertendo arquivos..." : "Adicionar Modelos 3D"}
            </h3>
            <p className="text-sm text-zinc-500">
              {isBusy
                ? "Lendo e interpretando o modelo 3D — aguarde..."
                : "Arraste arquivos ou clique para selecionar (STL, OBJ, FBX). Você pode adicionar múltiplos arquivos de uma vez."}
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-[#E8E9E3] border border-[#E8E9E3] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <FileBox className="w-4 h-4" />
                  Fila de Arquivos ({files.length})
                </h3>
                
                <div className="flex gap-2">
                  <button 
                    onClick={clearAll}
                    className="px-3 py-1.5 rounded-lg border border-[#E8E9E3] text-zinc-400 hover:text-[#212121] hover:bg-[#F9FAF4] text-xs font-bold transition-all"
                  >
                    Limpar Todos
                  </button>
                  <button
                    disabled={pendingCount === 0 || isConverting}
                    onClick={convertBatch}
                    className={`px-4 py-1.5 rounded-lg font-black uppercase tracking-wider text-xs flex items-center gap-2 transition-all ${
                      pendingCount === 0 
                        ? "bg-[#F9FAF4] text-zinc-600 cursor-not-allowed" 
                        : isConverting 
                          ? "bg-[#632CE5]/50 text-[#1A1C19] cursor-wait" 
                          : "bg-[#632CE5] text-[#1A1C19] hover:bg-[#632CE5]/90"
                    }`}
                  >
                    {isConverting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {isLoading ? "Carregando..." : "Convertendo..."}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Converter {pendingCount} Arquivos
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
                {files.map(f => (
                  <div key={f.id} className="flex items-center justify-between bg-[#E8E9E3] border border-[#E8E9E3] rounded-lg p-3 group">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded bg-[#F9FAF4] flex items-center justify-center shrink-0">
                        {f.status === "done" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : f.status === "error" ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : f.status === "converting" ? (
                          <RefreshCw className="w-5 h-5 text-[#632CE5] animate-spin" />
                        ) : (
                          <FileText className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>
                      
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-sm text-[#1A1C19] truncate">{f.file.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase font-mono text-zinc-500 bg-[#F9FAF4] px-1.5 rounded">
                            {f.inputFormat} → {outputFormat}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-600">
                            {(f.file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                          {f.error && (
                            <span className="text-[10px] text-red-400 truncate">{f.error}</span>
                          )}
                        </div>
                        {f.status === "converting" && f.progress !== undefined && (
                          <div className="w-full bg-[#F9FAF4] h-1.5 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="bg-[#632CE5] h-full transition-all duration-300"
                              style={{ width: `${f.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {f.status === "done" && f.convertedUrl ? (
                        <a 
                          href={f.convertedUrl}
                          download={getOutputFilename(f.file)}
                          className="bg-green-500 hover:bg-green-400 text-black px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Baixar
                        </a>
                      ) : (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                          f.status === "pending" ? "text-zinc-500 bg-[#F9FAF4]" :
                          f.status === "converting" && loadingFileId === f.id ? "text-[#632CE5] bg-[#632CE5]/10" :
                          f.status === "converting" ? "text-[#632CE5] bg-[#632CE5]/10" :
                          "text-red-500 bg-red-500/10"
                        }`}>
                          {f.status === "pending" ? "Pendente" : 
                           f.status === "converting" && loadingFileId === f.id ? "Carregando" : 
                           f.status === "converting" ? "Convertendo" : 
                           "Erro"}
                        </span>
                      )}
                      
                      <button 
                        onClick={() => removeFile(f.id)}
                        disabled={isConverting && f.status === "converting"}
                        className="w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
