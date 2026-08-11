import { useEffect, useState } from "react";

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  isDefault?: boolean;
}

export interface ExportedFileInfo {
  solidName: string;
  format: string;
  style: string;
  dimensions: string;
  triangles: number;
  note: string;
}

const loadingMessages = [
  "Conectando ao modelo neural da Vértice...",
  "Esculpindo polígonos virtuais 3D...",
  "Analisando poses e dinâmica do personagem...",
  "Aplicando materiais, resina e sombreamento...",
  "Renderizando iluminação cinematográfica de estúdio...",
  "Finalizando imagem de alta fidelidade...",
];

export function useAiFigures() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [loadingStep, setLoadingStep] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<"rpg" | "chibi" | "cyberpunk" | "classic">("rpg");
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "photo" | "lineart">("text");
  const [physicalFormat, setPhysicalFormat] = useState<"statue" | "articulated" | "keychain" | "articulated_keychain" | "drawing_plate">("statue");
  const [isExporting3D, setIsExporting3D] = useState(false);
  const [export3DSuccess, setExport3DSuccess] = useState(false);
  const [export3DError, setExport3DError] = useState("");
  const [exportedFileInfo, setExportedFileInfo] = useState<ExportedFileInfo | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<PromptTemplate[]>(() => {
    try {
      const stored = localStorage.getItem("vertice_prompt_templates");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isGeneratingImage) {
      setLoadingStep(0);
      interval = setInterval(() => setLoadingStep((prev) => (prev + 1) % loadingMessages.length), 3500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGeneratingImage]);

  return {
    prompt, setPrompt, isGenerating, setIsGenerating, result, setResult, error, setError,
    isGeneratingImage, setIsGeneratingImage, generatedImage, setGeneratedImage,
    aspectRatio, setAspectRatio, loadingStep, uploadedImage, setUploadedImage,
    isAnalyzingImage, setIsAnalyzingImage, analysisResult, setAnalysisResult,
    selectedStyle, setSelectedStyle, isDragActive, setIsDragActive, activeTab, setActiveTab,
    physicalFormat, setPhysicalFormat, isExporting3D, setIsExporting3D, export3DSuccess,
    setExport3DSuccess, export3DError, setExport3DError, exportedFileInfo, setExportedFileInfo,
    savedTemplates, setSavedTemplates, newTemplateName, setNewTemplateName, saveSuccess, setSaveSuccess,
    loadingMessages,
  };
}
