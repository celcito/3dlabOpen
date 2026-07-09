import React, { useState, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Upload, Download, FileBox, RefreshCw, FileText, CheckCircle2, AlertCircle, X, Layers, Play } from "lucide-react";

interface FileItem {
  id: string;
  file: File;
  inputFormat: string;
  status: "pending" | "converting" | "done" | "error";
  progress?: number;
  convertedUrl?: string;
  error?: string;
}

export default function FileConverter() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [outputFormat, setOutputFormat] = useState<"stl" | "obj" | "gltf" | "glb">("stl");
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const supportedExts = ['stl', 'obj', 'fbx'];
    const validFiles = newFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || "";
      return supportedExts.includes(ext);
    });

    if (validFiles.length < newFiles.length) {
      alert("Alguns arquivos foram ignorados. Apenas STL, OBJ e FBX são permitidos.");
    }

    const newItems: FileItem[] = validFiles.map(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || "";
      return {
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        inputFormat: ext,
        status: "pending"
      };
    });
    setFiles(prev => [...prev, ...newItems]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRm = prev.find(f => f.id === id);
      if (fileToRm?.convertedUrl) {
        URL.revokeObjectURL(fileToRm.convertedUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => {
      if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
    });
    setFiles([]);
  };

  const parseFile = async (file: File, ext: string, onProgress: (p: number) => void): Promise<THREE.Group | THREE.Mesh> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 50); // Reading is 0-50%
          onProgress(percent);
        }
      };

      reader.onload = (e) => {
        onProgress(50); // Read complete
        
        // Timeout to let UI render the progress
        setTimeout(() => {
          const contents = e.target?.result;
          if (!contents) return reject(new Error("Empty file"));
          
          try {
            if (ext === "stl") {
              const loader = new STLLoader();
              const geometry = loader.parse(contents as ArrayBuffer);
              const material = new THREE.MeshBasicMaterial();
              resolve(new THREE.Mesh(geometry, material));
            } else if (ext === "obj") {
              const loader = new OBJLoader();
              const text = new TextDecoder().decode(contents as ArrayBuffer);
              const group = loader.parse(text);
              resolve(group);
            } else if (ext === "fbx") {
              const loader = new FBXLoader();
              const group = loader.parse(contents as ArrayBuffer, "");
              resolve(group);
            } else {
              reject(new Error("Formato de entrada não suportado"));
            }
          } catch (err) {
            reject(err);
          }
        }, 10);
      };
      
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const convertSingleFile = async (fileItem: FileItem, updateProgress: (p: number) => void): Promise<string> => {
    const object3D = await parseFile(fileItem.file, fileItem.inputFormat, updateProgress);
    
    updateProgress(60);
    
    await new Promise(r => setTimeout(r, 10)); // UI yield
    
    let blob: Blob;
    
    if (outputFormat === "stl") {
      const exporter = new STLExporter();
      const stlData = exporter.parse(object3D, { binary: true });
      blob = new Blob([stlData], { type: "application/octet-stream" });
    } else if (outputFormat === "obj") {
      const exporter = new OBJExporter();
      const objData = exporter.parse(object3D);
      blob = new Blob([objData], { type: "text/plain" });
    } else if (outputFormat === "gltf" || outputFormat === "glb") {
      updateProgress(75);
      const exporter = new GLTFExporter();
      const isGLB = outputFormat === "glb";
      const gltfData = await new Promise((resolve, reject) => {
        exporter.parse(
          object3D,
          (result) => {
            if (isGLB) resolve(result);
            else resolve(JSON.stringify(result, null, 2));
          },
          (error) => reject(error),
          { binary: isGLB }
        );
      });
      blob = new Blob([gltfData as any], { type: isGLB ? "application/octet-stream" : "text/plain" });
    } else {
      throw new Error("Formato de saída não suportado");
    }

    updateProgress(100);
    return URL.createObjectURL(blob);
  };

  const convertBatch = async () => {
    const pendingFiles = files.filter(f => f.status === "pending" || f.status === "error");
    if (pendingFiles.length === 0) return;
    
    setIsConverting(true);

    for (const fileItem of pendingFiles) {
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "converting", progress: 0, error: undefined } : f));
      
      const updateProgress = (p: number) => {
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, progress: p } : f));
      };

      // Yield to let UI update
      await new Promise(r => setTimeout(r, 50));

      try {
        const url = await convertSingleFile(fileItem, updateProgress);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "done", convertedUrl: url, progress: 100 } : f));
      } catch (err: any) {
        console.error(`Erro ao converter ${fileItem.file.name}:`, err);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "error", error: err.message || "Erro desconhecido" } : f));
      }
    }

    setIsConverting(false);
  };

  const getOutputFilename = (file: File) => {
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
    return `${nameWithoutExt}.${outputFormat}`;
  };

  const pendingCount = files.filter(f => f.status === "pending" || f.status === "error").length;

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <Layers className="w-8 h-8 text-[#00E5FF]" />
              Conversor 3D Batch
            </h1>
            <p className="text-zinc-400 mt-2 text-sm max-w-xl">
              Converta modelos 3D instantaneamente em lote. Suporte para STL, OBJ e FBX. 
              Exporte para STL, OBJ, GLTF ou GLB sem depender da nuvem (nota: FBX não possui exportador nativo em web, recomendamos GLB).
            </p>
          </div>
          
          <div className="bg-[#151515] border border-zinc-800 rounded-lg p-4 flex gap-4">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Formato de Saída</h3>
              <div className="flex gap-1 mt-1">
                {(["stl", "obj", "gltf", "glb"] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => {
                      if (fmt !== outputFormat) {
                        // Clear converted files when format changes
                        setFiles(prev => prev.map(f => {
                          if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
                          return { ...f, status: "pending", convertedUrl: undefined };
                        }));
                        setOutputFormat(fmt);
                      }
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      outputFormat === fmt 
                        ? "bg-[#00E5FF] text-black" 
                        : "bg-zinc-900 text-zinc-400 hover:text-white"
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
            className={`border-2 border-dashed border-zinc-800 bg-[#151515] hover:border-[#00E5FF] rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".stl,.obj,.fbx" 
              multiple
              className="hidden" 
            />
            
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Adicionar Modelos 3D</h3>
            <p className="text-sm text-zinc-500">
              Arraste arquivos ou clique para selecionar (STL, OBJ, FBX). Você pode adicionar múltiplos arquivos de uma vez.
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-[#151515] border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <FileBox className="w-4 h-4" />
                  Fila de Arquivos ({files.length})
                </h3>
                
                <div className="flex gap-2">
                  <button 
                    onClick={clearAll}
                    className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold transition-all"
                  >
                    Limpar Todos
                  </button>
                  <button
                    disabled={pendingCount === 0 || isConverting}
                    onClick={convertBatch}
                    className={`px-4 py-1.5 rounded-lg font-black uppercase tracking-wider text-xs flex items-center gap-2 transition-all ${
                      pendingCount === 0 
                        ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                        : isConverting 
                          ? "bg-[#00E5FF]/50 text-white cursor-wait" 
                          : "bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90"
                    }`}
                  >
                    {isConverting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processando...
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
                  <div key={f.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-3 group">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                        {f.status === "done" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : f.status === "error" ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : f.status === "converting" ? (
                          <RefreshCw className="w-5 h-5 text-[#00E5FF] animate-spin" />
                        ) : (
                          <FileText className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>
                      
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-sm text-white truncate">{f.file.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase font-mono text-zinc-500 bg-zinc-800 px-1.5 rounded">
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
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="bg-[#00E5FF] h-full transition-all duration-300"
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
                          f.status === "pending" ? "text-zinc-500 bg-zinc-800" :
                          f.status === "converting" ? "text-[#00E5FF] bg-[#00E5FF]/10" :
                          "text-red-500 bg-red-500/10"
                        }`}>
                          {f.status === "pending" ? "Pendente" : 
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
