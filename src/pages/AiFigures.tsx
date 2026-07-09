import { useState, useEffect } from "react";
import { Sparkles, History, Loader2, Copy, Bookmark, Save, Trash2, Plus, Check, Image, Download, RefreshCw, Eye, Info, AlertTriangle, Upload, Camera, Link, Activity, Layers, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  isDefault?: boolean;
}

// Explanatory Tooltip Component
function HelpTooltip({ text, position = "top" }: { text: string; position?: "top" | "bottom" | "left" | "right" }) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  return (
    <div className="relative group inline-flex items-center ml-1.5 select-none shrink-0 align-middle">
      <span className="text-zinc-500 hover:text-[#00E5FF] transition-colors cursor-help focus:outline-none p-0.5">
        <Info className="w-3.5 h-3.5" />
      </span>
      <div 
        className={`absolute hidden group-hover:block z-50 w-64 p-3 text-[10px] leading-relaxed font-sans normal-case font-medium text-zinc-300 bg-zinc-950 border border-zinc-800 rounded shadow-[0_6px_20px_rgba(0,0,0,0.95)] pointer-events-none transition-all duration-150 ${positionClasses[position]}`}
      >
        <p className="tracking-wide uppercase text-[#00E5FF] font-black text-[9px] mb-1 font-sans">Dica de Ajuda / Help Tip</p>
        <p className="font-sans normal-case font-medium">{text}</p>
      </div>
    </div>
  );
}

export default function AiFigures() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // New states for image generation
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [loadingStep, setLoadingStep] = useState(0);

  // Photo-to-Figurine states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<"rpg" | "chibi" | "cyberpunk" | "classic">("rpg");
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "photo" | "lineart">("text");
  const [physicalFormat, setPhysicalFormat] = useState<"statue" | "articulated" | "keychain" | "articulated_keychain" | "drawing_plate">("statue");
  
  // 3D Model Exporter States
  const [isExporting3D, setIsExporting3D] = useState(false);
  const [export3DSuccess, setExport3DSuccess] = useState(false);
  const [export3DError, setExport3DError] = useState("");
  const [exportedFileInfo, setExportedFileInfo] = useState<{
    solidName: string;
    format: string;
    style: string;
    dimensions: string;
    triangles: number;
    note: string;
  } | null>(null);

  const defaultTemplates: PromptTemplate[] = [
    {
      id: "preset-orc",
      name: "Guerreiro Orc / Orc Warrior",
      prompt: "Detailed Miniature of a brutal Orc Barbarian, holding a giant battleaxe, battle-scarred leather armor, standing on a rocky base, fantasy tabletop RPG style, extreme high detail, ready for 3D printing.",
      isDefault: true
    },
    {
      id: "preset-chibi",
      name: "Mago Chibi / Chibi Wizard",
      prompt: "Cute chibi wizard character, wearing an oversized wizard hat and holding a glowing magical staff, friendly face with big eyes, clean smooth surfaces optimized for SLA printing, tabletop miniature.",
      isDefault: true
    },
    {
      id: "preset-cyber",
      name: "Mercenária Cyberpunk / Cyberpunk Merc",
      prompt: "Futuristic cyberpunk mercenary female, high-tech tactical gear, holding dual laser pistols, dynamic action pose, standing on a grated industrial deck base, detailed sci-fi model.",
      isDefault: true
    },
    {
      id: "preset-gothic",
      name: "Vampiro Gótico / Gothic Vampire",
      prompt: "Elegant Gothic Vampire Count in a flowing high-collar cape, ornate Victorian suit, holding an antique chalice, standing on a gothic stone floor base, spooky classic horror style.",
      isDefault: true
    }
  ];

  const [savedTemplates, setSavedTemplates] = useState<PromptTemplate[]>(() => {
    try {
      const stored = localStorage.getItem("vertice_prompt_templates");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [newTemplateName, setNewTemplateName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic loading phase texts for immersive experience
  const loadingMessages = [
    "Conectando ao modelo neural da Vértice...",
    "Esculpindo polígonos virtuais 3D...",
    "Analisando poses e dinâmica do personagem...",
    "Aplicando materiais, resina e sombreamento...",
    "Renderizando iluminação cinematográfica de estúdio...",
    "Finalizando imagem de alta fidelidade..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingImage) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isGeneratingImage]);

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !newTemplateName.trim()) return;

    const newTemplate: PromptTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      prompt: prompt.trim()
    };

    const updated = [newTemplate, ...savedTemplates];
    setSavedTemplates(updated);
    localStorage.setItem("vertice_prompt_templates", JSON.stringify(updated));
    setNewTemplateName("");
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem("vertice_prompt_templates", JSON.stringify(updated));
  };

  const handleLoadTemplate = (text: string) => {
    setPrompt(text);
  };

  // 1. Optimize textual prompt for 3D Slicing/Meshing engines
  const handleOptimizePrompt = async () => {
    if (!prompt) return;
    
    setIsGenerating(true);
    setError("");
    setResult("");
    
    try {
      const response = await fetch("/api/ai-figures/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, physicalFormat })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to optimize prompt");
      }
      
      setResult(data.optimizedPrompt);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Generate preview image representing the figurine
  const handleGenerateImage = async (promptToUse?: string, overrideFormat?: string) => {
    const targetPrompt = promptToUse || result || prompt;
    if (!targetPrompt) return;

    setIsGeneratingImage(true);
    setError("");

    try {
      const response = await fetch("/api/ai-figures/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: targetPrompt,
          aspectRatio,
          physicalFormat: overrideFormat || physicalFormat
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível gerar o render visual.");
      }

      setGeneratedImage(data.imageUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `vertice-figurine-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport3D = async () => {
    const activePrompt = result || prompt;
    if (!activePrompt) {
      setExport3DError("Gere ou selecione uma imagem analisada primeiro.");
      return;
    }

    setIsExporting3D(true);
    setExport3DError("");
    setExport3DSuccess(false);
    setExportedFileInfo(null);

    try {
      const response = await fetch("/api/ai-figures/export-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          style: selectedStyle,
          physicalFormat
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao gerar malha 3D.");
      }

      setExportedFileInfo(data.info);
      setExport3DSuccess(true);

      // Trigger automatic STL browser download using base64 encoded payload
      if (data.fileContentBase64 && data.fileName) {
        const link = document.createElement("a");
        link.href = `data:text/plain;base64,${data.fileContentBase64}`;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      setExport3DError(err.message || "Houve uma falha ao gerar a malha 3D.");
    } finally {
      setIsExporting3D(false);
    }
  };

  // Photo-to-Figurine helper functions
  const handleImageUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
      setAnalysisResult("");
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!uploadedImage) return;

    setIsAnalyzingImage(true);
    setError("");
    setAnalysisResult("");

    try {
      const response = await fetch("/api/ai-figures/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: uploadedImage,
          style: selectedStyle,
          physicalFormat
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível analisar a imagem.");
      }

      setAnalysisResult(data.analysis);
      setResult(data.optimizedPrompt);

      // Automatically trigger 3D visual preview generation!
      setIsGeneratingImage(true);
      try {
        const imgResponse = await fetch("/api/ai-figures/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: data.optimizedPrompt,
            aspectRatio,
            physicalFormat
          })
        });

        const imgData = await imgResponse.json();

        if (!imgResponse.ok) {
          throw new Error(imgData.error || "Não foi possível gerar o render visual.");
        }

        setGeneratedImage(imgData.imageUrl);
      } catch (imgErr: any) {
        setError("Imagem analisada, mas falhou ao renderizar visual: " + imgErr.message);
      } finally {
        setIsGeneratingImage(false);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const aspectRatios = [
    { label: "1:1", value: "1:1", desc: "Quadrado (Miniatura)" },
    { label: "3:4", value: "3:4", desc: "Carta / Colecionável" },
    { label: "4:3", value: "4:3", desc: "Cartão de Estúdio" },
    { label: "9:16", value: "9:16", desc: "Vertical" },
    { label: "16:9", value: "16:9", desc: "Wallpaper / Banner" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden text-white bg-[#050505]">
      {/* HEADER AREA */}
      <header className="p-8 flex justify-between items-end border-b border-zinc-900 shrink-0 bg-[#0d0d0d]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#00E5FF] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.4.2</p>
          <h1 className="text-6xl font-black tracking-tighter leading-none uppercase">AI Figures</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-bold">Gerador Neural</div>
          <div className="font-mono text-sm text-[#00FF41] font-bold flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ONLINE
          </div>
        </div>
      </header>

      {/* CORE CONTENT DUAL PANE */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDE: CONTROLS & TEMPLATES (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Custom Vértice Tab Selector */}
            <div className="flex border-b border-zinc-900 gap-4 mb-2">
              <button
                onClick={() => setActiveTab("text")}
                className={`pb-3 px-1 text-[10px] uppercase font-black tracking-widest border-b-2 transition-all cursor-pointer ${
                  activeTab === "text"
                    ? "border-[#00E5FF] text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Criar de Texto / Prompt-to-3D
              </button>
              <button
                onClick={() => setActiveTab("photo")}
                className={`pb-3 px-1 text-[10px] uppercase font-black tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "photo"
                    ? "border-[#00E5FF] text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Foto para Boneco (Selfie 3D)
              </button>
              <button
                onClick={() => setActiveTab("lineart")}
                className={`pb-3 px-1 text-[10px] uppercase font-black tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "lineart"
                    ? "border-[#00E5FF] text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Placas de Desenhar
              </button>
            </div>

            {/* FORMATO FÍSICO / PHYSICAL FORMAT SELECTOR */}
            <div className="bg-[#111] border border-zinc-900 p-6 rounded-lg space-y-4">
              <div>
                <label className="text-[10px] uppercase text-[#00E5FF] font-black tracking-widest flex items-center">
                  <span>Escolha o Formato de Fabricação / Physical Format</span>
                  <HelpTooltip text="Determine se a figura será uma estátua estática com riqueza de detalhes, um modelo com articulações flexíveis sensoriais, ou um mini chaveiro compacto." />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  {
                    id: "statue",
                    label: "Estátua Estática",
                    desc: "Foco em detalhes. Montado em pedestal de exibição rígido.",
                    icon: Layers,
                    badge: "Colecionável",
                    color: "border-zinc-800 hover:border-zinc-700 bg-[#0d0d0d]"
                  },
                  {
                    id: "articulated",
                    label: "Boneco Articulado",
                    desc: "Articulações móveis (flexi). Brinquedo sensorial livre.",
                    icon: Activity,
                    badge: "Sensorial / Fidget",
                    color: "border-zinc-800 hover:border-zinc-700 bg-[#0d0d0d]"
                  },
                  {
                    id: "keychain",
                    label: "Mini Chaveiro",
                    desc: "Tamanho reduzido com olhal/anel de fixação superior.",
                    icon: Link,
                    badge: "Compacto",
                    color: "border-zinc-800 hover:border-zinc-700 bg-[#0d0d0d]"
                  },
                  {
                    id: "articulated_keychain",
                    label: "Chaveiro Flex",
                    desc: "Corpo flexível com articulações e anel superior integrado.",
                    icon: Sparkles,
                    badge: "Híbrido",
                    color: "border-zinc-800 hover:border-zinc-700 bg-[#0d0d0d]"
                  },
                  {
                    id: "drawing_plate",
                    label: "Placa 2D",
                    desc: "Placa de desenhar. Relevo 2D estilo lineart para pintura.",
                    icon: PenTool,
                    badge: "Lineart",
                    color: "border-zinc-800 hover:border-zinc-700 bg-[#0d0d0d]"
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = physicalFormat === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPhysicalFormat(item.id as any)}
                      className={`text-left p-4 rounded-lg border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[120px] ${
                        isSelected
                          ? "border-[#00E5FF] bg-gradient-to-br from-[#00E5FF]/10 to-transparent text-white"
                          : item.color + " text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`p-1.5 rounded-md ${isSelected ? "bg-[#00E5FF]/15 text-[#00E5FF]" : "bg-zinc-900 text-zinc-500"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isSelected ? "bg-[#00E5FF] text-black" : "bg-zinc-900 text-zinc-500"
                        }`}>
                          {item.badge}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider block">{item.label}</span>
                        <span className="text-[8px] text-zinc-500 leading-relaxed font-medium block">{item.desc}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === "text" ? (
              <div className="space-y-6">
                {/* Target Concept Form */}
                <div className="bg-[#111] border border-zinc-900 p-6 rounded-lg space-y-5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase text-[#00E5FF] font-black tracking-widest flex items-center">
                      <span>01. Conceito do Personagem / Target Concept</span>
                      <HelpTooltip text="Descreva o personagem que deseja gerar. Pode ser simples (ex: 'Orc com machado') e depois otimizado pelo modelo de linguagem." />
                    </label>
                  </div>

                  <div className="space-y-4">
                    <input 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ex: guerreiro elfo arqueiro, armadura dourada, pose dinâmica..."
                      className="w-full bg-transparent border-b border-zinc-800 outline-none text-xl font-mono text-white py-2 focus:border-[#00E5FF] transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && prompt) {
                          handleOptimizePrompt();
                        }
                      }}
                    />

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button 
                        onClick={handleOptimizePrompt} 
                        disabled={isGenerating || !prompt}
                        className="flex-1 bg-zinc-900 text-zinc-300 border border-zinc-800 font-bold uppercase text-[10px] py-3 px-6 tracking-widest hover:border-[#00E5FF] hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded cursor-pointer"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" /> : <Sparkles className="w-4 h-4 text-[#00E5FF]" />}
                        {isGenerating ? "Otimizando..." : "Otimizar Prompt (3D)"}
                      </button>

                      <button 
                        onClick={() => handleGenerateImage()} 
                        disabled={isGeneratingImage || !prompt}
                        className="flex-1 bg-white text-black font-black uppercase text-[10px] py-3 px-6 tracking-widest hover:bg-[#00E5FF] hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded cursor-pointer"
                      >
                        {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                        {isGeneratingImage ? "Renderizando..." : "Gerar Render Visual"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Presets and Custom Templates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recommended Presets */}
                  <div className="bg-[#111] border border-zinc-900 rounded-lg p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                      <Bookmark className="w-4 h-4 text-[#00E5FF]" />
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Presets Recomendados</h3>
                      <HelpTooltip text="Ideias prontas de figuras 3D otimizadas e testadas para você carregar de forma instantânea." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {defaultTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => handleLoadTemplate(tpl.prompt)}
                          className="text-left bg-[#0d0d0d] hover:bg-[#151515] border border-zinc-900 hover:border-[#00E5FF] p-3 rounded transition-all group flex flex-col justify-between h-20"
                        >
                          <span className="text-[9px] font-bold text-zinc-300 group-hover:text-[#00E5FF] transition-colors line-clamp-1 uppercase tracking-wide">
                            {tpl.name}
                          </span>
                          <span className="text-[8px] text-zinc-600 line-clamp-2 mt-1 leading-relaxed font-mono">
                            {tpl.prompt}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Saved Templates */}
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                        <div className="flex items-center gap-2">
                          <Save className="w-4 h-4 text-[#00E5FF]" />
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Meus Modelos / Templates</h3>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500 uppercase font-black">{savedTemplates.length} Salvos</span>
                      </div>

                      {/* Save current template form */}
                      <form onSubmit={handleSaveTemplate} className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder="Nome personalizado..."
                            disabled={!prompt.trim()}
                            className="flex-1 bg-[#0d0d0d] border border-zinc-900 focus:border-[#00E5FF] text-xs text-white rounded px-3 py-2 outline-none transition-all disabled:opacity-50"
                          />
                          <button
                            type="submit"
                            disabled={!prompt.trim() || !newTemplateName.trim()}
                            className="px-3 py-2 bg-[#00E5FF] text-black text-[9px] font-black uppercase tracking-wider rounded hover:bg-[#00B4CC] disabled:opacity-50 disabled:bg-zinc-900 disabled:text-zinc-600 transition-all cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            {saveSuccess ? "Salvo" : "Salvar"}
                          </button>
                        </div>
                      </form>

                      {/* List of custom templates */}
                      <div className="max-h-[100px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        {savedTemplates.length === 0 ? (
                          <div className="text-center py-5 text-zinc-600 text-[8px] uppercase font-black tracking-widest border border-dashed border-zinc-900 rounded">
                            Sem templates salvos
                          </div>
                        ) : (
                          savedTemplates.map((tpl) => (
                            <div
                              key={tpl.id}
                              className="bg-[#0d0d0d] border border-zinc-900 rounded p-2 flex items-center justify-between gap-3 group hover:border-zinc-800 transition-all"
                            >
                              <button
                                onClick={() => handleLoadTemplate(tpl.prompt)}
                                className="flex-1 text-left min-w-0"
                              >
                                <div className="text-[9px] font-bold text-zinc-400 group-hover:text-[#00E5FF] transition-colors truncate">
                                  {tpl.name}
                                </div>
                                <div className="text-[8px] text-zinc-600 truncate font-mono">
                                  {tpl.prompt}
                                </div>
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(tpl.id)}
                                className="p-1 text-zinc-600 hover:text-[#FF1744] hover:bg-[#FF1744]/10 rounded transition-all shrink-0"
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "photo" ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Upload block */}
                <div className="bg-[#111] border border-zinc-900 p-6 rounded-lg space-y-5">
                  <div>
                    <label className="text-[10px] uppercase text-[#00E5FF] font-black tracking-widest flex items-center">
                      <span>01. Carregar Sua Foto / Upload Photo</span>
                      <HelpTooltip text="Arraste ou selecione uma foto sua de rosto ou corpo inteiro. O modelo analisará seus traços, roupas e acessórios para estilizá-lo em miniatura." />
                    </label>
                  </div>

                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all min-h-[180px] ${
                      isDragActive 
                        ? "border-[#00E5FF] bg-[#00E5FF]/5" 
                        : uploadedImage 
                          ? "border-zinc-800 bg-zinc-950/40" 
                          : "border-zinc-850 hover:border-zinc-750 bg-[#0c0c0c]"
                    }`}
                  >
                    {uploadedImage ? (
                      <div className="space-y-4 w-full flex flex-col items-center">
                        <div className="relative group w-32 h-32 rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
                          <img 
                            src={uploadedImage} 
                            alt="Sua foto de referência" 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => { setUploadedImage(null); setAnalysisResult(""); }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold text-red-400 cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-mono">Foto carregada com sucesso. Pronto para modelagem!</p>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center space-y-3.5 w-full h-full py-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-500 hover:text-[#00E5FF] hover:border-[#00E5FF] transition-all">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Arraste e solte ou clique para fazer upload</p>
                          <p className="text-[9px] text-zinc-600 font-medium">Formatos aceitos: JPG, PNG, WEBP de até 10MB</p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                          className="hidden" 
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Style selector */}
                <div className="bg-[#111] border border-zinc-900 p-6 rounded-lg space-y-5">
                  <div>
                    <label className="text-[10px] uppercase text-[#00E5FF] font-black tracking-widest flex items-center">
                      <span>02. Escolha o Estilo do Seu Bonequinho / Miniature Style</span>
                      <HelpTooltip text="Selecione o tema/estilo para a estátua 3D resultante da sua foto." />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: "rpg", label: "RPG Fantasia", desc: "Guerreiro, mago, bardo", color: "from-purple-500/20 to-indigo-500/10" },
                      { id: "chibi", label: "Chibi Fofo", desc: "Mini-fofo e estilizado", color: "from-pink-500/20 to-rose-500/10" },
                      { id: "cyberpunk", label: "Cyberpunk", desc: "Futurista e high-tech", color: "from-cyan-500/20 to-blue-500/10" },
                      { id: "classic", label: "Clássico", desc: "Estátua de mármore", color: "from-amber-500/20 to-orange-500/10" }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStyle(st.id as any)}
                        className={`text-left p-4 rounded-lg border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-24 bg-[#0d0d0d] bg-gradient-to-br ${st.color} ${
                          selectedStyle === st.id 
                            ? "border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.15)] text-white" 
                            : "border-zinc-900 text-zinc-400 hover:border-zinc-800"
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">{st.label}</span>
                        <span className="text-[8px] text-zinc-500 leading-relaxed font-medium">{st.desc}</span>
                        {selectedStyle === st.id && (
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAnalyzeImage}
                      disabled={isAnalyzingImage || !uploadedImage}
                      className="w-full bg-white text-black font-black uppercase text-[10px] py-3.5 px-6 tracking-widest hover:bg-[#00E5FF] hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded cursor-pointer"
                    >
                      {isAnalyzingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-black" />
                      )}
                      {isAnalyzingImage ? "Analisando Traços & Renderizando..." : "Analisar Foto e Criar Bonequinho"}
                    </button>
                  </div>
                </div>

                {/* Analysis result */}
                {analysisResult && (
                  <div className="bg-[#111] border border-zinc-850 p-6 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                      <Camera className="w-4 h-4 text-[#00E5FF]" />
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono">Avatar Traduzido em 3D:</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans font-medium">
                      {analysisResult}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-[#111] border border-zinc-900 p-6 rounded-lg space-y-5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase text-[#00E5FF] font-black tracking-widest flex items-center">
                      <span>01. Descrever Placa / Lineart Concept</span>
                      <HelpTooltip text="Descreva o que será desenhado em lineart na sua placa." />
                    </label>
                  </div>

                  <div className="space-y-4">
                    <input 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ex: carro esportivo, dinossauro t-rex, castelo..."
                      className="w-full bg-transparent border-b border-zinc-800 outline-none text-xl font-mono text-white py-2 focus:border-[#00E5FF] transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && prompt) {
                          handleOptimizePrompt();
                        }
                      }}
                    />

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button 
                        onClick={() => {
                          setPhysicalFormat("drawing_plate");
                          const basePrompt = prompt.trim() || "figura simples";
                          const lineartPrompt = `${basePrompt}, simple lineart drawing plate, black outlines on white background, coloring book style, minimal details, vector style flat 2d design, single color continuous line, high contrast`;
                          handleGenerateImage(lineartPrompt, "drawing_plate");
                        }} 
                        disabled={isGeneratingImage || !prompt}
                        className="flex-1 bg-white text-black font-black uppercase text-[10px] py-3 px-6 tracking-widest hover:bg-[#00E5FF] hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded cursor-pointer"
                      >
                        {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                        {isGeneratingImage ? "Desenhando..." : "Gerar Placa de Desenhar"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error container */}
            {error && (
              <div className="bg-red-950/20 border border-red-900/50 p-4 rounded text-red-500 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>ERRO DO SERVIDOR:</strong> {error}</span>
              </div>
            )}

            {/* Prompt Otimizado Output Block */}
            {result && (
              <div className="bg-[#111] border border-zinc-800 p-6 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-[#00E5FF] uppercase tracking-widest flex items-center">
                    <span>Prompt Otimizado para Modelador 3D / Optimized Prompt</span>
                    <HelpTooltip text="Este prompt foi reescrito para conter instruções específicas de geometria e materiais para mecanismos de inteligência artificial 3D." />
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigator.clipboard.writeText(result)} 
                      className="text-[9px] uppercase font-black tracking-widest text-zinc-400 hover:text-white flex items-center gap-1 border border-zinc-850 px-3 py-1.5 rounded bg-[#0d0d0d] transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copiar Prompt
                    </button>
                  </div>
                </div>
                
                <div className="bg-[#0d0d0d] border border-zinc-900 p-4 rounded font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap select-all">
                  {result}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleGenerateImage(result)}
                    disabled={isGeneratingImage}
                    className="bg-[#00E5FF] hover:bg-[#00B4CC] text-black font-black uppercase text-[10px] py-2.5 px-5 tracking-wider rounded transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Renderizar este Prompt Otimizado
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: IMAGE PREVIEW & ASPECT RATIO (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Visual Preview Container */}
            <div className="bg-[#111] border border-zinc-900 rounded-lg p-6 flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-[10px] uppercase text-zinc-400 font-bold tracking-widest border-b border-zinc-900 pb-3 flex items-center">
                  <span>02. Visualização do Modelo / 3D Style Preview</span>
                  <HelpTooltip text="Simulação visual de estúdio do personagem impresso e pós-processado. Útil para prever proporções antes de fabricar fisicamente." />
                </h3>
              </div>

              {/* Rendering Stage */}
              <div className="relative bg-[#0d0d0d] border border-zinc-900 rounded-lg overflow-hidden flex items-center justify-center min-h-[340px] shadow-inner">
                {isGeneratingImage ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="relative flex items-center justify-center">
                      {/* Stylized loader halo */}
                      <div className="w-16 h-16 rounded-full border-4 border-zinc-900 border-t-[#00E5FF] animate-spin" />
                      <div className="absolute w-10 h-10 rounded-full border-2 border-dashed border-zinc-800 border-b-[#A855F7] animate-spin-slow" style={{ animationDuration: "6s" }} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase font-bold animate-pulse">MODELANDO FIGURA 3D</p>
                      <p className="text-[10px] text-[#00E5FF] font-medium h-4 transition-all duration-300">{loadingMessages[loadingStep]}</p>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full h-full flex items-center justify-center p-3">
                    <img 
                      src={generatedImage} 
                      alt="3D Figurine Neural Render" 
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-[420px] rounded object-contain shadow-2xl border border-zinc-800"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 space-y-3.5">
                    <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-600">
                      <Image className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-[240px]">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Aguardando Prompt</p>
                      <p className="text-[9px] text-zinc-600 leading-relaxed font-sans font-medium">Escreva uma ideia ou escolha um modelo acima e clique em "Gerar Render Visual" para exibir o modelo digital.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Aspect Ratio Config */}
              <div className="space-y-3">
                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black flex items-center">
                  <span>Proporção do Render / Aspect Ratio</span>
                  <HelpTooltip text="Determine o formato dimensional para a imagem gerada (ex: Quadrado para retratar cabeças, horizontal para dioramas)." />
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {aspectRatios.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`py-2 text-[9px] font-black uppercase tracking-wider rounded border transition-all text-center cursor-pointer ${
                        aspectRatio === ar.value 
                          ? "bg-[#00E5FF] text-black border-transparent" 
                          : "bg-[#0d0d0d] border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300"
                      }`}
                      title={ar.desc}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Download & Utility Actions */}
              {generatedImage && (
                <div className="flex gap-3 pt-3 border-t border-zinc-900">
                  <button
                    onClick={handleDownloadImage}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-850 py-2.5 rounded font-bold uppercase text-[9px] tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar Render
                  </button>
                  
                  <button
                    onClick={() => handleGenerateImage()}
                    disabled={isGeneratingImage}
                    className="bg-transparent border border-zinc-900 hover:border-zinc-750 text-zinc-500 hover:text-zinc-300 p-2.5 rounded transition-all cursor-pointer"
                    title="Gerar Variação / Regenerate"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* EXPORTADOR DE MALHA 3D / 3D MESH EXPORTER */}
            <div className="bg-[#111] border border-zinc-900 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
                  <span>Exportar Malha Geométrica 3D (.STL)</span>
                </h3>
                <HelpTooltip text="Gere a malha geométrica real fatiável e imprimível (.STL) baseada na imagem estilizada e formato de fabricação escolhido." />
              </div>

              <p className="text-[10px] text-zinc-500 leading-relaxed font-sans font-medium">
                Gere e exporte a malha volumétrica 3D watertight compatível com Cura, PrusaSlicer e fatiadores de resina para fabricação direta.
              </p>

              <button
                type="button"
                onClick={handleExport3D}
                disabled={isExporting3D || !(result || prompt)}
                className="w-full bg-[#00E5FF] hover:bg-[#00B4CC] disabled:opacity-50 disabled:bg-zinc-900 disabled:text-zinc-600 text-black font-black uppercase text-[10px] py-3.5 px-4 tracking-widest rounded transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isExporting3D ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Calculando Vértices & Fatias...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-black" />
                    <span>Gerar e Baixar Malha (.STL)</span>
                  </>
                )}
              </button>

              {/* Status indicators */}
              {export3DSuccess && exportedFileInfo && (
                <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-lg space-y-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                    <Check className="w-4 h-4" />
                    <span>Malha Gerada e Baixada com Sucesso!</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-zinc-400 bg-black/40 p-2.5 rounded border border-zinc-900">
                    <div>
                      <span className="text-zinc-600 block uppercase">Sólido:</span>
                      <span className="text-[#00E5FF] font-bold truncate block">{exportedFileInfo.solidName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block uppercase">Dimensões:</span>
                      <span className="text-white font-bold block">{exportedFileInfo.dimensions}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-zinc-600 block uppercase">Triângulos:</span>
                      <span className="text-white font-bold block">{exportedFileInfo.triangles} fatias</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-zinc-600 block uppercase">Formato Físico:</span>
                      <span className="text-white font-bold uppercase block">{exportedFileInfo.format}</span>
                    </div>
                  </div>

                  <p className="text-[8px] text-zinc-500 leading-relaxed font-sans font-medium italic">
                    * {exportedFileInfo.note}
                  </p>
                </div>
              )}

              {export3DError && (
                <div className="bg-red-950/20 border border-red-900/50 p-4 rounded text-red-500 text-[10px] font-mono flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{export3DError}</span>
                </div>
              )}
            </div>

            {/* Printable Model Slicing Advice */}
            <div className="bg-[#111] border border-zinc-900 p-5 rounded-lg space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Como obter o STL & Fatiamento 3D</h4>
                </div>
                <span className="text-[8px] font-mono text-[#00E5FF] uppercase font-black px-1.5 py-0.5 rounded bg-[#00E5FF]/10">
                  {physicalFormat === "articulated" && "Articulado Flexi"}
                  {physicalFormat === "articulated_keychain" && "Chaveiro Articulado"}
                  {physicalFormat === "keychain" && "Chaveiro Mini"}
                  {physicalFormat === "statue" && "Estátua Estática"}
                  {physicalFormat === "drawing_plate" && "Placa de Desenhar 2D"}
                </span>
              </div>
              <ul className="space-y-3 text-[10px] leading-relaxed text-zinc-500 font-sans font-medium">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#00E5FF] font-black font-mono shrink-0">1.</span>
                  <span>
                    <strong>Geração do Arquivo STL/OBJ:</strong> Copie o <strong>Prompt Otimizado</strong> gerado à esquerda e cole em geradores de malha 3D volumétricos como <strong>Meshy.ai</strong>, <strong>Tripo3D.ai</strong>, ou <strong>Luma Genie</strong>. Eles processarão o texto ou a foto e fornecerão o arquivo .STL/.OBJ para download instantâneo.
                  </span>
                </li>

                {physicalFormat === "drawing_plate" && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">2.</span>
                      <span><strong>Conversão 2D para 3D (SVG para STL):</strong> A imagem gerada (Placa de Desenhar) pode ser baixada e convertida em SVG usando conversores online, e importada em softwares CAD (Tinkercad, Fusion360) para extrusão e geração do STL final.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">3.</span>
                      <span><strong>Fatiamento de Relevo (Lithophane/Hueforge):</strong> Em vez de malha 3D, você também pode usar a imagem lineart diretamente em softwares como Hueforge para impressão multicor em 2D.</span>
                    </li>
                  </>
                )}

                {physicalFormat === "statue" && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">2.</span>
                      <span><strong>Para Impressoras de Resina (SLA):</strong> Certifique-se de esvaziar (hollow) a estátua no fatiador (ex: Chitubox) e adicionar furos de drenagem para economizar resina.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">3.</span>
                      <span><strong>Para Filamento (FDM):</strong> Ative suportes do tipo 'árvore' (Tree Supports) no Cura ou PrusaSlicer para os braços, armas e partes suspensas.</span>
                    </li>
                  </>
                )}

                {(physicalFormat === "articulated" || physicalFormat === "articulated_keychain") && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-black font-mono shrink-0">⚠️</span>
                      <span><strong>PROIBIDO USAR SUPORTES (No Supports):</strong> Como este é um modelo articulado móvel do tipo <i>print-in-place</i> (imprime montado), adicionar suportes nas juntas vai fundir os elos, travando o boneco sensorial!</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">3.</span>
                      <span><strong>Configuração do Fatiador:</strong> Use altura de camada baixa (0.12mm a 0.16mm) e velocidade reduzida nas primeiras camadas para garantir folga perfeita nas juntas flexíveis e excelente aderência na mesa.</span>
                    </li>
                  </>
                )}

                {physicalFormat === "keychain" && (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">2.</span>
                      <span><strong>Resistência do Chaveiro:</strong> Configure o preenchimento (Infill) para pelo menos 30% a 50% e adicione 3 a 4 perímetros de parede para garantir que o olhal/anel de fixação na cabeça não quebre no uso diário.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#00E5FF] font-black font-mono shrink-0">3.</span>
                      <span><strong>SLA vs FDM:</strong> Devido ao tamanho mini reduzido de chaveiros, a impressão em resina (SLA) trará traços de rosto e cabelos muito mais nítidos. Se usar FDM, prefira um bico fino de 0.2mm.</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

          </div>

        </div>
      </div>

      {/* FOOTER BAR */}
      <footer className="h-12 border-t border-zinc-900 px-8 flex items-center justify-between bg-[#0d0d0d] shrink-0 font-sans">
        <div className="flex gap-6 items-center text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Engine: <span className="text-[#00E5FF]">Gemini Imagen & Flash</span></span>
          <span>Slicing Optimization: Enabled</span>
        </div>
      </footer>
    </div>
  );
}
