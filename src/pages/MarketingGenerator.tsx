import { useState, useRef, useEffect } from "react";
import { 
  Sparkles, Upload, Download, Loader2, Check, Copy, 
  DollarSign, FileVideo, RefreshCw, Trash2, HelpCircle, 
  MessageSquare, Layers, Coins, Play, Pause, AlertTriangle,
  Save, Folder, FileDown, BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MarketingDetails {
  title: string;
  description: string;
  specifications: string[];
  suggestedPrice: string;
  socialPost: string;
  videoPrompt: string;
}

interface SavedPackage {
  id: string;
  savedAt: string;
  productName: string;
  productType: "articulated" | "articulated_keychain" | "keychain" | "statue" | "domestic_utensil";
  targetAudience: string;
  imagePreview: string;
  details: MarketingDetails;
  videoAspectRatio: "16:9" | "9:16";
  videoCameraStyle: "cinematico" | "produto" | "exposição técnica";
  videoResolution: "1080p" | "720p" | "480p";
  videoUrl: string;
}

export default function MarketingGenerator() {
  // Input states
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState<"articulated" | "articulated_keychain" | "keychain" | "statue" | "domestic_utensil">("articulated");
  const [targetAudience, setTargetAudience] = useState("Colecionadores e Amantes de Geek");
  
  // Image Upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Marketing Generator states
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [marketingDetails, setMarketingDetails] = useState<MarketingDetails | null>(null);
  const [detailsError, setDetailsError] = useState("");

  // Video Generation states (Veo Model)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoError, setVideoError] = useState("");
  const [videoProgressStep, setVideoProgressStep] = useState(0);
  const [operationName, setOperationName] = useState("");
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [videoCameraStyle, setVideoCameraStyle] = useState<"cinematico" | "produto" | "exposição técnica">("cinematico");
  const [videoResolution, setVideoResolution] = useState<"1080p" | "720p" | "480p">("720p");

  // Fallback / Instant Showreel Simulator states
  const [showreelActive, setShowreelActive] = useState(false);
  const [showreelPlaying, setShowreelPlaying] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Saved Packages states
  const [savedPackages, setSavedPackages] = useState<SavedPackage[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");

  // Load saved packages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("vertice_saved_marketing_packages");
    if (saved) {
      try {
        setSavedPackages(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar pacotes salvos", e);
      }
    }
  }, []);

  // Polling list of reassuring messages for video generation
  const videoLoadingSteps = [
    "Analisando proporções e contornos do produto...",
    "Planejando iluminação volumétrica e estúdio fotográfico...",
    "Configurando rotação suave do prato giratório de vidro...",
    "Iniciando renderização de quadros por inteligência artificial...",
    "Unindo quadros para fluxo de movimento fluido (30fps)...",
    "Finalizando efeitos de brilho e nitidez cinematográfica...",
    "Compactando showreel para streaming instantâneo..."
  ];

  // Rotate video loading messages every 6 seconds during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingVideo) {
      interval = setInterval(() => {
        setVideoProgressStep((prev) => (prev < videoLoadingSteps.length - 1 ? prev + 1 : prev));
      }, 6000);
    } else {
      setVideoProgressStep(0);
    }
    return () => clearInterval(interval);
  }, [isGeneratingVideo]);

  // Video Operation Polling logic
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (operationName && isGeneratingVideo) {
      const checkStatus = async () => {
        try {
          const res = await fetch("/api/marketing/video-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationName })
          });
          const data = await res.json();

          if (data.error) {
            throw new Error(data.error.message || "Falha na geração do vídeo.");
          }

          if (data.done) {
            clearInterval(pollInterval);
            // Download video
            downloadVideo(operationName);
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setIsGeneratingVideo(false);
          setVideoError(err.message || "Erro de conexão ao verificar status do vídeo.");
        }
      };

      // Poll every 5 seconds
      pollInterval = setInterval(checkStatus, 5000);
    }

    return () => clearInterval(pollInterval);
  }, [operationName, isGeneratingVideo]);

  // Download video once generation is completed
  const downloadVideo = async (opName: string) => {
    try {
      setVideoProgressStep(videoLoadingSteps.length - 1); // final step
      const res = await fetch("/api/marketing/video-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName: opName })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Não foi possível baixar o vídeo gerado.");
      }

      const blobUrl = `data:video/mp4;base64,${data.base64Video}`;
      setVideoUrl(blobUrl);
    } catch (err: any) {
      setVideoError(err.message || "Erro ao obter o vídeo final.");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImage(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImage(files[0]);
    }
  };

  const processImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione apenas arquivos de imagem.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setVideoUrl("");
    setVideoError("");
    setShowreelActive(false);
  };

  // Main generator trigger
  const handleGenerateMarketing = async () => {
    if (!productName.trim() && !imagePreview) {
      setDetailsError("Digite o nome do produto ou faça o upload de uma foto.");
      return;
    }

    setIsGeneratingDetails(true);
    setDetailsError("");
    setMarketingDetails(null);

    try {
      const response = await fetch("/api/marketing/generate-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          productType,
          targetAudience,
          baseImage: imagePreview || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao gerar materiais de marketing.");
      }

      setMarketingDetails(data);
      
      // Auto-set product name if it was empty
      if (!productName.trim() && data.title) {
        setProductName(data.title);
      }
    } catch (err: any) {
      setDetailsError(err.message || "Ocorreu uma falha na geração dos detalhes de marketing.");
    } finally {
      setIsGeneratingDetails(false);
    }
  };

  // Trigger Veo short video generation
  const handleGenerateVeoVideo = async () => {
    if (!imagePreview) {
      setVideoError("Faça o upload da foto do produto antes de gerar o vídeo.");
      return;
    }

    setIsGeneratingVideo(true);
    setVideoError("");
    setVideoUrl("");
    setVideoProgressStep(0);

    let styleModifier = "";
    if (videoCameraStyle === "cinematico") {
      styleModifier = ", dramatic cinematic camera lens pan, golden hour backlight, cinematic mood, epic camera movement, high dramatic contrast";
    } else if (videoCameraStyle === "produto") {
      styleModifier = ", commercial clean showcase style, bright studio lights, soft shadows, steady clean turntable spin, white pristine tabletop reflection";
    } else if (videoCameraStyle === "exposição técnica") {
      styleModifier = ", blueprint layout wireframe visual style, laser scan lines running over the product, dark mechanical background with technical readouts, high detail precise blueprint render";
    }

    const basePrompt = marketingDetails?.videoPrompt || 
      `Premium product commercial, detailed 3D figure of ${productName || "custom object"} rotating on a luxury dark display table, professional studio lighting, depth of field, 4k`;

    const videoPromptText = `${basePrompt}${styleModifier}`;

    try {
      const response = await fetch("/api/marketing/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBytes: imagePreview,
          prompt: videoPromptText,
          aspectRatio: videoAspectRatio,
          resolution: videoResolution
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Falha ao iniciar o motor de vídeo Veo.");
      }

      setOperationName(data.operationName);
    } catch (err: any) {
      setVideoError(err.message || "Erro ao iniciar geração do vídeo. Tente novamente mais tarde.");
      setIsGeneratingVideo(false);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Save the current package state to local storage library
  const handleSavePackage = () => {
    if (!marketingDetails) {
      setDetailsError("Gere os detalhes do marketing antes de salvar o pacote.");
      return;
    }

    const newPkg: SavedPackage = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      savedAt: new Date().toISOString(),
      productName: productName || marketingDetails.title || "Produto Sem Nome",
      productType,
      targetAudience,
      imagePreview,
      details: marketingDetails,
      videoAspectRatio,
      videoCameraStyle,
      videoResolution,
      videoUrl
    };

    const updated = [newPkg, ...savedPackages];
    setSavedPackages(updated);
    localStorage.setItem("vertice_saved_marketing_packages", JSON.stringify(updated));
    setSaveSuccessMessage("Pacote de marketing salvo com sucesso!");
    setTimeout(() => setSaveSuccessMessage(""), 4000);
  };

  // Download package as JSON
  const handleDownloadPackageJSON = (pkg: SavedPackage | null = null) => {
    const isCustom = pkg !== null;
    const targetPkg = pkg || {
      productName: productName || marketingDetails?.title || "Produto Sem Nome",
      productType,
      targetAudience,
      imagePreview,
      details: marketingDetails,
      videoAspectRatio,
      videoCameraStyle,
      videoResolution,
      videoUrl,
      exportedAt: new Date().toISOString()
    };

    if (!isCustom && !marketingDetails) {
      setDetailsError("Gere os detalhes do marketing antes de exportar.");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetPkg, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    const filename = `${(targetPkg.productName || "pacote-marketing").toLowerCase().replace(/\s+/g, "-")}-marketing-pack.json`;
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Load a saved package into state
  const handleLoadPackage = (pkg: SavedPackage) => {
    setProductName(pkg.productName);
    setProductType(pkg.productType);
    setTargetAudience(pkg.targetAudience);
    setImagePreview(pkg.imagePreview);
    setMarketingDetails(pkg.details);
    setVideoAspectRatio(pkg.videoAspectRatio);
    setVideoCameraStyle(pkg.videoCameraStyle);
    setVideoResolution(pkg.videoResolution);
    setVideoUrl(pkg.videoUrl);
    
    // Smooth scroll to results
    setTimeout(() => {
      const el = document.getElementById("marketing-results-container");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 400, behavior: "smooth" });
      }
    }, 100);
  };

  // Delete a saved package
  const handleDeletePackage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir este pacote salvo?")) {
      const updated = savedPackages.filter((p) => p.id !== id);
      setSavedPackages(updated);
      localStorage.setItem("vertice_saved_marketing_packages", JSON.stringify(updated));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 space-y-8 font-sans bg-[#080808] text-white">
      
      {/* HEADER */}
      <div className="border-b border-zinc-900 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#00E5FF] animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono font-extrabold text-[#00E5FF]">VÉRTICE STUDIO ENGINE</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Gerador de Marketing do Produto
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl uppercase font-bold tracking-tight">
            Gere títulos de vendas, descrições persuasivas, precificação recomendada e um showreel de vídeo curto demonstrativo baseado em inteligência artificial.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="text-[9px] font-mono font-bold text-zinc-600 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded uppercase">
            Série Gemini 3.5 & Veo v3.1
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: UPLOAD & CONTROLS (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* UPLOAD CARD */}
          <div className="bg-[#0d0d0d] border border-zinc-900 p-5 rounded-lg space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#00E5FF]" />
              <span>Foto do Produto (3D ou Físico)</span>
            </h3>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !imagePreview && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer relative overflow-hidden ${
                imagePreview 
                  ? "border-zinc-800 bg-[#060606]" 
                  : isDragActive 
                    ? "border-[#00E5FF] bg-[#00E5FF]/5" 
                    : "border-zinc-800 hover:border-zinc-700 bg-black/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="space-y-4 relative z-10">
                  <div className="relative w-full max-w-[240px] aspect-square mx-auto rounded-md overflow-hidden border border-zinc-800 bg-black shadow-[0_8px_30px_rgb(0,0,0,0.6)]">
                    <img 
                      src={imagePreview} 
                      alt="Preview do Produto" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                      <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-white">Visualização de Origem</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="text-[9px] font-bold uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded text-zinc-400 hover:text-white transition-colors"
                    >
                      Alterar Foto
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage();
                      }}
                      className="text-[9px] font-bold uppercase tracking-wider border border-red-950 hover:bg-red-950/20 px-3 py-1.5 rounded text-red-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto border border-zinc-800 group-hover:border-[#00E5FF] transition-all">
                    <Upload className="w-5 h-5 text-zinc-500 group-hover:text-[#00E5FF]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Arraste a foto do seu produto aqui</p>
                    <p className="text-[9px] text-zinc-500 mt-1 uppercase font-semibold">Ou clique para navegar pelo arquivo (.PNG, .JPG)</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SPECIFICATIONS & TARGET INPUTS */}
          <div className="bg-[#0d0d0d] border border-zinc-900 p-5 rounded-lg space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00E5FF]" />
              <span>Configurações do Produto</span>
            </h3>

            <div className="space-y-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Nome do Produto ou Ideia Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dragão Articulado Cristal, Estátua Arthas"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-[#060606] border border-zinc-800 focus:border-[#00E5FF] rounded px-3 py-2.5 text-[11px] font-medium outline-none text-white placeholder-zinc-700 transition-colors"
                />
              </div>

              {/* Physical Format */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Formato Físico de Fabricação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "articulated", label: "Articulado Flexi" },
                    { id: "articulated_keychain", label: "Chaveiro Articulado" },
                    { id: "keychain", label: "Chaveiro Mini" },
                    { id: "statue", label: "Estátua Estática" },
                    { id: "domestic_utensil", label: "Utensílios Domésticos" },
                  ].map((format) => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => setProductType(format.id as any)}
                      className={`text-[10px] font-bold uppercase tracking-wider py-2.5 px-3 border rounded text-left transition-all ${
                        productType === format.id
                          ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_15px_rgba(0,229,255,0.1)]"
                          : "border-zinc-800 text-zinc-500 bg-black/30 hover:border-zinc-700"
                      }`}
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Público Alvo Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Crianças, Gamers de RPG, Decoração Geek, Presentes"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-[#060606] border border-zinc-800 focus:border-[#00E5FF] rounded px-3 py-2.5 text-[11px] font-medium outline-none text-white placeholder-zinc-700 transition-colors"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateMarketing}
              disabled={isGeneratingDetails || (!productName.trim() && !imagePreview)}
              className="w-full bg-[#00E5FF] hover:bg-[#00B4CC] disabled:bg-zinc-900 disabled:text-zinc-600 text-black font-black uppercase text-[10px] tracking-widest py-3.5 rounded transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {isGeneratingDetails ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Gerando Cópia e Estudo Comercial...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Gerar Pacote de Marketing</span>
                </>
              )}
            </button>

            {detailsError && (
              <div className="bg-red-950/20 border border-red-900/50 p-4 rounded text-red-500 text-[10px] font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{detailsError}</span>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: GENERATED PACK & VIDEO (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <AnimatePresence mode="wait">
            {!marketingDetails && !isGeneratingDetails ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="border border-zinc-900 rounded-lg p-10 text-center bg-[#0d0d0d] space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto border border-zinc-800">
                  <Sparkles className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-300">Aguardando Informações do Produto</h3>
                  <p className="text-[10px] text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed font-sans normal-case">
                    Insira o nome do seu produto, configure o formato físico de fabricação, e faça o upload de uma imagem do modelo para gerar o estudo completo de marketing e vídeo demonstrativo.
                  </p>
                </div>
              </motion.div>
            ) : isGeneratingDetails ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="border border-zinc-900 rounded-lg p-10 text-center bg-[#0d0d0d] space-y-6"
              >
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 border-2 border-t-[#00E5FF] border-zinc-800 rounded-full animate-spin"></div>
                  <Sparkles className="w-5 h-5 text-[#00E5FF] absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#00E5FF] font-mono">Processando Análise do Produto...</h3>
                  <p className="text-[10px] text-zinc-400 max-w-sm mx-auto leading-relaxed font-sans normal-case">
                    A IA do Gemini 3.5 está analisando a foto, projetando o apelo de vendas para o público-alvo e calculando preços de acordo com tendências atuais de mercado de impressão 3D.
                  </p>
                </div>
                <div className="w-full max-w-xs mx-auto bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-900">
                  <div className="bg-[#00E5FF] h-full rounded-full animate-pulse" style={{ width: "80%" }}></div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                id="marketing-results-container"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                
                {/* CORE MARKETING DATA BLOCK */}
                <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-6 space-y-5">
                  
                  {/* Save Success Alert */}
                  {saveSuccessMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3.5 rounded text-[10px] font-mono flex items-center gap-2"
                    >
                      <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{saveSuccessMessage}</span>
                    </motion.div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#00E5FF]" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Análise Comercial e Cópia do Produto</h3>
                    </div>
                    
                    {/* Package Save & Export Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSavePackage}
                        className="bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 hover:border-[#00E5FF] px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Salvar este pacote na Biblioteca Local"
                      >
                        <Save className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span>Salvar Pacote</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPackageJSON()}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Baixar o pacote em arquivo JSON"
                      >
                        <FileDown className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Baixar JSON</span>
                      </button>

                      <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 px-2 py-1 rounded">
                        Geração Concluída
                      </span>
                    </div>
                  </div>

                  {/* Title & Suggested Price Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 bg-black/40 border border-zinc-900 p-4 rounded-md space-y-1 relative group">
                      <span className="text-[8px] font-mono text-zinc-600 uppercase block">Título Comercial Sugerido</span>
                      <p className="text-sm font-black text-white">{marketingDetails?.title}</p>
                      <button
                        onClick={() => copyToClipboard(marketingDetails?.title || "", "title")}
                        className="absolute top-3 right-3 text-zinc-500 hover:text-[#00E5FF] transition-colors p-1"
                        title="Copiar Título"
                      >
                        {copiedField === "title" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="md:col-span-4 bg-black/40 border border-zinc-900 p-4 rounded-md space-y-1 relative group">
                      <div className="flex items-center gap-1.5 text-zinc-600 block">
                        <DollarSign className="w-3 h-3 text-[#00E5FF]" />
                        <span className="text-[8px] font-mono uppercase">Preço Recomendado</span>
                      </div>
                      <p className="text-sm font-black text-emerald-400">{marketingDetails?.suggestedPrice}</p>
                      <button
                        onClick={() => copyToClipboard(marketingDetails?.suggestedPrice || "", "price")}
                        className="absolute top-3 right-3 text-zinc-500 hover:text-emerald-400 transition-colors p-1"
                        title="Copiar Preço"
                      >
                        {copiedField === "price" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Persuasive Description */}
                  <div className="bg-black/40 border border-zinc-900 p-4 rounded-md space-y-2 relative group">
                    <span className="text-[8px] font-mono text-zinc-600 uppercase block">Descrição de Vendas / Copia Persuasiva</span>
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-sans font-medium normal-case">
                      {marketingDetails?.description}
                    </p>
                    <button
                      onClick={() => copyToClipboard(marketingDetails?.description || "", "desc")}
                      className="absolute top-3 right-3 text-zinc-500 hover:text-[#00E5FF] transition-colors p-1"
                      title="Copiar Descrição"
                    >
                      {copiedField === "desc" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Technical Specs List */}
                  <div className="space-y-2">
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">Especificações e Recomendações Técnicas</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {marketingDetails?.specifications.map((spec, idx) => (
                        <div key={idx} className="bg-[#111] border border-zinc-900/60 p-2.5 rounded flex items-start gap-2">
                          <span className="text-[#00E5FF] font-black font-mono text-[9px] shrink-0 mt-0.5">{idx + 1}.</span>
                          <span className="text-[9.5px] text-zinc-400 font-sans font-medium">{spec}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Social Post Template */}
                  <div className="bg-black/40 border border-zinc-900 p-4 rounded-md space-y-2.5 relative group">
                    <div className="flex items-center gap-1.5 border-b border-zinc-900/60 pb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span className="text-[8px] font-mono text-zinc-500 uppercase block">Publicação Social (Pronto para Postar)</span>
                    </div>
                    <pre className="text-[10px] text-zinc-400 leading-relaxed font-sans font-medium normal-case whitespace-pre-wrap">
                      {marketingDetails?.socialPost}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(marketingDetails?.socialPost || "", "social")}
                      className="absolute top-3 right-3 text-zinc-500 hover:text-[#00E5FF] transition-colors p-1"
                      title="Copiar Post Social"
                    >
                      {copiedField === "social" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                </div>

                {/* DEMONSTRATION VIDEO MODULE (Veo v3.1 + Interactive fallback Simulator) */}
                <div className="bg-[#0d0d0d] border border-zinc-900 rounded-lg p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <div className="flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-[#00E5FF]" />
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-white">Geração de Vídeo Demonstrativo Curto</h3>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-cyan-400 bg-cyan-950/20 border border-cyan-900/40 px-2 py-0.5 rounded">
                      Veo 3.1 Lite Engine
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans font-medium">
                    Transforme a foto estática do seu produto em um vídeo curto de demonstração comercial rotativo (Looping de Showcase). A IA gera luzes, sombras e movimento de câmera de cinema.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* VIDEO CONTAINER */}
                    <div className={`border border-zinc-900 rounded-lg bg-black flex flex-col items-center justify-center overflow-hidden relative shadow-[inset_0_4px_30px_rgba(0,0,0,0.8)] transition-all duration-300 w-full ${
                      videoAspectRatio === "16:9" 
                        ? "aspect-video" 
                        : "aspect-[9/16] h-[360px] max-w-[220px] mx-auto"
                    }`}>
                      
                      {isGeneratingVideo ? (
                        <div className="p-4 text-center space-y-3.5 w-full h-full flex flex-col items-center justify-center bg-[#050505]">
                          <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-white font-mono uppercase tracking-wider">Criando Vídeo Comercial...</p>
                            <p className="text-[8px] text-[#00E5FF] font-semibold max-w-xs mx-auto animate-pulse uppercase tracking-tight">
                              {videoLoadingSteps[videoProgressStep]}
                            </p>
                          </div>
                          <p className="text-[7px] text-zinc-600 font-mono italic max-w-[200px]">
                            * A geração de vídeo é uma tarefa de IA pesada e pode levar de 30 a 90 segundos.
                          </p>
                        </div>
                      ) : videoUrl ? (
                        <div className="w-full h-full relative group">
                          <video
                            src={videoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 bg-black/60 border border-zinc-800/80 px-2 py-1 rounded text-[8px] font-mono text-zinc-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Demonstração Veo 3.1</span>
                          </div>
                          
                          <a 
                            href={videoUrl} 
                            download={`comercial_figura_3d.mp4`}
                            className="absolute top-2 right-2 bg-[#00E5FF] hover:bg-[#00B4CC] text-black p-1.5 rounded transition-all shadow-md opacity-0 group-hover:opacity-100"
                            title="Baixar Vídeo MP4"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : showreelActive && imagePreview ? (
                        /* INTERACTIVE SHOWREEL SIMULATOR (Instant 3D CSS scanner preview) */
                        <div className="w-full h-full relative bg-radial-gradient from-zinc-950 to-black overflow-hidden flex items-center justify-center p-3">
                          
                          {/* Radial glowing rings and particles in CSS */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:14px_24px] opacity-20"></div>
                          
                          {/* 3D Rotating card simulation */}
                          <motion.div
                            animate={showreelPlaying ? {
                              rotateY: [0, 180, 360],
                              scale: videoAspectRatio === "16:9" ? [0.95, 1.05, 0.95] : [0.85, 0.95, 0.85],
                            } : {}}
                            transition={{
                              duration: 8,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                            className={`${
                              videoAspectRatio === "16:9" ? "w-[140px] h-[140px]" : "w-[120px] h-[180px]"
                            } rounded-lg border-2 border-[#00E5FF]/40 bg-zinc-900 overflow-hidden relative shadow-[0_0_30px_rgba(0,229,255,0.15)] flex items-center justify-center`}
                            style={{ transformStyle: "preserve-3d", perspective: "600px" }}
                          >
                            <img
                              src={imagePreview}
                              alt="Showreel Sim"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {/* Scanning green laser effect */}
                            <div className="absolute inset-x-0 h-1 bg-[#00E5FF] shadow-[0_0_12px_#00E5FF] animate-bounce" style={{ top: "10%" }}></div>
                          </motion.div>

                          {/* Dynamic Overlays */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                            <span className="text-[7px] bg-black/70 border border-zinc-800 text-zinc-400 font-mono px-1.5 py-0.5 rounded tracking-wide uppercase">
                              Showreel Instatâneo
                            </span>
                            <span className="text-[7.5px] bg-[#00E5FF]/10 text-[#00E5FF] font-mono px-1.5 py-0.5 rounded tracking-wider uppercase font-extrabold animate-pulse">
                              {productType === "articulated" || productType === "articulated_keychain" ? "Flexi-Wiggle" : productType === "domestic_utensil" ? "Home-Showcase" : "Studio-Spin"}
                            </span>
                          </div>

                          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                            <button
                              onClick={() => setShowreelPlaying(!showreelPlaying)}
                              className="bg-black/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
                            >
                              {showreelPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 space-y-2 text-zinc-600">
                          <FileVideo className="w-8 h-8 mx-auto stroke-[1.5]" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Nenhum vídeo gerado ainda</p>
                            <p className="text-[8px] max-w-xs mx-auto">Clique no botão para gerar o comercial real ou usar o renderizador instantâneo.</p>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* VEO BUTTONS BLOCK */}
                    <div className="space-y-3.5">
                      {/* ASPECT RATIO SELECTION BUTTONS */}
                      <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-2">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-extrabold">Formato de Proporção</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setVideoAspectRatio("16:9");
                              setVideoUrl("");
                            }}
                            className={`py-2 px-2.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              videoAspectRatio === "16:9"
                                ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_10px_rgba(0,229,255,0.1)]"
                                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                            }`}
                          >
                            <span className="w-3 h-2 bg-current opacity-65 rounded-sm"></span>
                            <span>Horizontal (16:9)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVideoAspectRatio("9:16");
                              setVideoUrl("");
                            }}
                            className={`py-2 px-2.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              videoAspectRatio === "9:16"
                                ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_10px_rgba(0,229,255,0.1)]"
                                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                            }`}
                          >
                            <span className="w-2 h-3 bg-current opacity-65 rounded-sm"></span>
                            <span>Vertical (9:16)</span>
                          </button>
                        </div>
                      </div>

                      {/* VIDEO RESOLUTION SELECTION BUTTONS */}
                      <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-2">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-extrabold">Resolução de Saída</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "1080p", label: "1080p", desc: "Alta Definição" },
                            { id: "720p", label: "720p", desc: "Equilibrado" },
                            { id: "480p", label: "480p", desc: "Compacto" },
                          ].map((res) => (
                            <button
                              key={res.id}
                              type="button"
                              onClick={() => {
                                setVideoResolution(res.id as any);
                                setVideoUrl("");
                              }}
                              className={`py-2 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center ${
                                videoResolution === res.id
                                  ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_10px_rgba(0,229,255,0.1)]"
                                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                              }`}
                            >
                              <span className="font-extrabold">{res.label}</span>
                              <span className="text-[6.5px] text-zinc-500 normal-case">{res.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CAMERA STYLE SELECTION BUTTONS */}
                      <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-2">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-extrabold">Estilo Visual da Câmera</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "cinematico", label: "Cinemático" },
                            { id: "produto", label: "Produto" },
                            { id: "exposição técnica", label: "Exposição Técnica" },
                          ].map((style) => (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => {
                                setVideoCameraStyle(style.id as any);
                              }}
                              className={`py-2 px-1 rounded border text-[8px] font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 cursor-pointer text-center ${
                                videoCameraStyle === style.id
                                  ? "border-[#00E5FF] text-white bg-[#00E5FF]/5 shadow-[0_0_10px_rgba(0,229,255,0.1)]"
                                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700 bg-black/40"
                              }`}
                            >
                              <span>{style.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-zinc-950 p-3 rounded border border-zinc-900 space-y-1.5">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-extrabold">Prompt do Vídeo AI</span>
                        <p className="text-[9px] text-zinc-400 italic font-sans leading-relaxed line-clamp-3">
                          "{marketingDetails?.videoPrompt || "Product commercial showreel, slow turntable rotation, studio presentation background..."}"
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Veo Geração de Vídeo Real */}
                        <button
                          type="button"
                          onClick={handleGenerateVeoVideo}
                          disabled={isGeneratingVideo || !imagePreview}
                          className="w-full bg-[#00E5FF] hover:bg-[#00B4CC] disabled:opacity-50 disabled:bg-zinc-900 disabled:text-zinc-600 text-black font-black uppercase text-[9px] tracking-widest py-3 rounded cursor-pointer transition-all flex items-center justify-center gap-2"
                        >
                          {isGeneratingVideo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                              <span>Processando na Nuvem...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-black" />
                              <span>Gerar Vídeo Comercial (Veo AI)</span>
                            </>
                          )}
                        </button>

                        {/* Instant Simulator Toggle */}
                        {imagePreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setVideoUrl("");
                              setShowreelActive(true);
                            }}
                            className="w-full bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold uppercase text-[9px] tracking-widest py-3 rounded cursor-pointer transition-all"
                          >
                            Showreel Simulador 3D Instantâneo
                          </button>
                        )}
                      </div>

                      {videoError && (
                        <div className="bg-red-950/20 border border-red-900/50 p-3 rounded text-red-500 text-[9px] font-mono flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{videoError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* BIBLIOTECA DE PACOTES SALVOS */}
      <div className="border-t border-zinc-900 pt-8 mt-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-[10px] tracking-[0.2em] uppercase font-mono font-extrabold text-[#00E5FF]">BIBLIOTECA LOCAL</span>
            </div>
            <h2 className="text-lg font-black tracking-tight text-white mt-1">
              Pacotes de Marketing Salvos
            </h2>
            <p className="text-xs text-zinc-500 max-w-xl">
              Gerencie e carregue estudos de marketing e vídeos que você salvou anteriormente neste navegador.
            </p>
          </div>
          {savedPackages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Deseja realmente limpar toda a biblioteca de pacotes salvos?")) {
                  setSavedPackages([]);
                  localStorage.removeItem("vertice_saved_marketing_packages");
                }
              }}
              className="bg-red-950/25 hover:bg-red-950/40 text-red-400 border border-red-900/40 hover:border-red-800 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 self-start sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Biblioteca</span>
            </button>
          )}
        </div>

        {savedPackages.length === 0 ? (
          <div className="border border-zinc-900 rounded-lg p-8 text-center bg-[#0d0d0d]/40">
            <Folder className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nenhum Pacote Salvo Ainda</p>
            <p className="text-[10px] text-zinc-600 mt-1 max-w-sm mx-auto leading-relaxed">
              Gere um pacote de marketing para seu modelo e clique em "Salvar Pacote" para que ele apareça aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedPackages.map((pkg) => (
              <div 
                key={pkg.id}
                onClick={() => handleLoadPackage(pkg)}
                className="group bg-[#0d0d0d] hover:bg-[#121212] border border-zinc-900 hover:border-[#00E5FF]/40 rounded-lg p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden shadow-lg hover:shadow-[0_4px_20px_rgba(0,229,255,0.05)]"
              >
                {/* Accent glow on hover */}
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="space-y-3">
                  {/* Thumbnail and Title Header */}
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded border border-zinc-800 bg-black overflow-hidden shrink-0 flex items-center justify-center">
                      {pkg.imagePreview ? (
                        <img 
                          src={pkg.imagePreview} 
                          alt={pkg.productName} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Sparkles className="w-5 h-5 text-zinc-700" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-white truncate group-hover:text-[#00E5FF] transition-colors">{pkg.productName}</h4>
                      <p className="text-[8px] font-mono text-zinc-500 uppercase mt-0.5 tracking-wider">
                        {pkg.productType === "articulated" ? "Chaveiro Articulado" : pkg.productType === "articulated_keychain" ? "Chaveiro Articulado Mini" : pkg.productType === "keychain" ? "Chaveiro Mini" : pkg.productType === "statue" ? "Estátua Estática" : "Utensílio Doméstico"}
                      </p>
                      <span className="text-[7.5px] bg-[#00E5FF]/10 text-[#00E5FF] font-mono px-1 py-0.5 rounded uppercase mt-1 inline-block">
                        {pkg.videoResolution} • {pkg.videoAspectRatio}
                      </span>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="bg-black/30 p-2.5 rounded border border-zinc-950 space-y-1.5">
                    <div className="flex items-center justify-between text-[8px] font-mono">
                      <span className="text-zinc-600">Preço Sugerido:</span>
                      <span className="text-emerald-400 font-extrabold">{pkg.details.suggestedPrice}</span>
                    </div>
                    <p className="text-[9.5px] text-zinc-400 font-sans line-clamp-2 leading-relaxed italic">
                      "{pkg.details.description}"
                    </p>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="flex items-center justify-between border-t border-zinc-900/80 pt-3 mt-4">
                  <span className="text-[7.5px] font-mono text-zinc-600">
                    Salvo em: {new Date(pkg.savedAt).toLocaleDateString("pt-BR")}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPackageJSON(pkg);
                      }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Baixar JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeletePackage(pkg.id, e)}
                      className="p-1.5 rounded hover:bg-red-950/40 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Excluir Pacote"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
