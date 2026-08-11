import { useEffect, useState } from "react";

export interface MarketingDetails {
  title: string;
  description: string;
  specifications: string[];
  suggestedPrice: string;
  socialPost: string;
  videoPrompt: string;
}

export interface SavedPackage {
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

export function useMarketingGenerator() {
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState<SavedPackage["productType"]>("articulated");
  const [targetAudience, setTargetAudience] = useState("Colecionadores e Amantes de Geek");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [marketingDetails, setMarketingDetails] = useState<MarketingDetails | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState("");
  const [videoProgressStep, setVideoProgressStep] = useState(0);
  const [operationName, setOperationName] = useState("");
  const [videoAspectRatio, setVideoAspectRatio] = useState<SavedPackage["videoAspectRatio"]>("16:9");
  const [videoCameraStyle, setVideoCameraStyle] = useState<SavedPackage["videoCameraStyle"]>("cinematico");
  const [videoResolution, setVideoResolution] = useState<SavedPackage["videoResolution"]>("720p");
  const [showreelActive, setShowreelActive] = useState(false);
  const [showreelPlaying, setShowreelPlaying] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savedPackages, setSavedPackages] = useState<SavedPackage[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("vertice_saved_marketing_packages");
    if (saved) {
      try { setSavedPackages(JSON.parse(saved)); } catch (error) { console.error("Erro ao carregar pacotes salvos", error); }
    }
  }, []);

  return {
    productName, setProductName, productType, setProductType, targetAudience, setTargetAudience,
    imageFile, setImageFile, imagePreview, setImagePreview, isDragActive, setIsDragActive,
    isGeneratingDetails, setIsGeneratingDetails, marketingDetails, setMarketingDetails,
    detailsError, setDetailsError, isGeneratingVideo, setIsGeneratingVideo, videoUrl, setVideoUrl,
    videoError, setVideoError, videoProgressStep, setVideoProgressStep, operationName, setOperationName,
    videoAspectRatio, setVideoAspectRatio, videoCameraStyle, setVideoCameraStyle, videoResolution, setVideoResolution,
    showreelActive, setShowreelActive, showreelPlaying, setShowreelPlaying, copiedField, setCopiedField,
    savedPackages, setSavedPackages, saveSuccessMessage, setSaveSuccessMessage,
  };
}
