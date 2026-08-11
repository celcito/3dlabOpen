import { useRef, useState } from "react";
// @ts-ignore
import ImageTracer from "imagetracerjs";
import { toastInvalidFormat } from "@/lib/toast";

export interface ConversionResult {
  id: string;
  file: File;
  previewUrl: string;
  svgString: string;
  status: "pending" | "converting" | "done" | "error";
  progress: number;
  error?: string;
}

export function useSvgConverter() {
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [options, setOptions] = useState({ ltilesize: 128, numberofcolors: 16, pathomit: 8, blurradius: 0, blurdelta: 20, strokewidth: 1, linefilter: false, scale: 1, roundcoords: 1, colorsampling: 2, mincolorratio: 0, colorquantcycles: 3, layering: 0 });
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => ["png", "jpg", "jpeg", "webp", "bmp"].includes(file.name.split(".").pop()?.toLowerCase() || ""));
    if (validFiles.length < newFiles.length) toastInvalidFormat(["PNG", "JPG", "WEBP", "BMP"]);
    setResults((previous) => [...previous, ...validFiles.map((file) => ({ id: Math.random().toString(36).substring(2, 9), file, previewUrl: URL.createObjectURL(file), svgString: "", status: "pending" as const, progress: 0 }))]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(Array.from(event.target.files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleDragOver = (event: React.DragEvent) => event.preventDefault();
  const handleDrop = (event: React.DragEvent) => { event.preventDefault(); if (event.dataTransfer.files) addFiles(Array.from(event.dataTransfer.files)); };
  const removeResult = (id: string) => setResults((previous) => { const item = previous.find((result) => result.id === id); if (item) URL.revokeObjectURL(item.previewUrl); return previous.filter((result) => result.id !== id); });
  const clearAll = () => { results.forEach((result) => URL.revokeObjectURL(result.previewUrl)); setResults([]); };
  const convertFile = (item: ConversionResult) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => { const image = new Image(); image.onload = () => { try { const svg = ImageTracer.imageToSVG(image.src, (value: string) => resolve(value), options); if (typeof svg === "string") resolve(svg); } catch (error) { reject(error); } }; image.onerror = () => reject(new Error("Falha ao carregar imagem")); image.src = event.target?.result as string; };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(item.file);
  });
  const startConversion = async () => {
    const pending = results.filter((result) => result.status === "pending" || result.status === "error");
    if (!pending.length) return;
    setIsConverting(true);
    for (const item of pending) {
      setResults((previous) => previous.map((result) => result.id === item.id ? { ...result, status: "converting", progress: 30 } : result));
      try { const svg = await convertFile(item); setResults((previous) => previous.map((result) => result.id === item.id ? { ...result, status: "done", svgString: svg, progress: 100 } : result)); }
      catch (error: any) { setResults((previous) => previous.map((result) => result.id === item.id ? { ...result, status: "error", error: error.message || "Erro na vetorização" } : result)); }
    }
    setIsConverting(false);
  };
  const downloadSvg = (item: ConversionResult) => { const url = URL.createObjectURL(new Blob([item.svgString], { type: "image/svg+xml" })); const link = document.createElement("a"); link.href = url; link.download = `${item.file.name.split(".")[0]}.svg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); };

  return { results, isConverting, options, setOptions, showOptions, setShowOptions, fileInputRef, handleFileChange, handleDragOver, handleDrop, removeResult, clearAll, startConversion, downloadSvg };
}
