import { useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { toastInvalidFormat } from "@/lib/toast";

export interface FileItem { id: string; file: File; inputFormat: string; status: "pending" | "converting" | "done" | "error"; progress?: number; convertedUrl?: string; error?: string; }
type OutputFormat = "stl" | "obj" | "gltf" | "glb";

export function useFileConverter() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("stl");
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = (newFiles: File[]) => { const valid = newFiles.filter((file) => ["stl", "obj", "fbx"].includes(file.name.split(".").pop()?.toLowerCase() || "")); if (valid.length < newFiles.length) toastInvalidFormat(["STL", "OBJ", "FBX"]); setFiles((previous) => [...previous, ...valid.map((file) => ({ id: Math.random().toString(36).substring(2, 9), file, inputFormat: file.name.split(".").pop()?.toLowerCase() || "", status: "pending" as const }))]); };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(Array.from(event.target.files)); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const handleDragOver = (event: React.DragEvent) => event.preventDefault();
  const handleDrop = (event: React.DragEvent) => { event.preventDefault(); if (event.dataTransfer.files) addFiles(Array.from(event.dataTransfer.files)); };
  const removeFile = (id: string) => setFiles((previous) => { const item = previous.find((file) => file.id === id); if (item?.convertedUrl) URL.revokeObjectURL(item.convertedUrl); return previous.filter((file) => file.id !== id); });
  const clearAll = () => { files.forEach((file) => file.convertedUrl && URL.revokeObjectURL(file.convertedUrl)); setFiles([]); };
  const parseFile = (file: File, ext: string, onProgress: (progress: number) => void) => new Promise<THREE.Group | THREE.Mesh>((resolve, reject) => { const reader = new FileReader(); reader.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 50)); }; reader.onload = (event) => { onProgress(50); setTimeout(() => { const contents = event.target?.result; if (!contents) return reject(new Error("Empty file")); try { if (ext === "stl") resolve(new THREE.Mesh(new STLLoader().parse(contents as ArrayBuffer), new THREE.MeshBasicMaterial())); else if (ext === "obj") resolve(new OBJLoader().parse(new TextDecoder().decode(contents as ArrayBuffer))); else if (ext === "fbx") resolve(new FBXLoader().parse(contents as ArrayBuffer, "")); else reject(new Error("Formato de entrada não suportado")); } catch (error) { reject(error); } }, 10); }; reader.onerror = () => reject(new Error("Falha ao ler o arquivo")); reader.readAsArrayBuffer(file); });
  const convertSingleFile = async (item: FileItem, updateProgress: (progress: number) => void) => { const object = await parseFile(item.file, item.inputFormat, updateProgress); updateProgress(60); await new Promise((resolve) => setTimeout(resolve, 10)); let blob: Blob; if (outputFormat === "stl") blob = new Blob([new STLExporter().parse(object, { binary: true })], { type: "application/octet-stream" }); else if (outputFormat === "obj") blob = new Blob([new OBJExporter().parse(object)], { type: "text/plain" }); else { updateProgress(75); const binary = outputFormat === "glb"; const data = await new Promise<unknown>((resolve, reject) => new GLTFExporter().parse(object, (result) => resolve(binary ? result : JSON.stringify(result, null, 2)), reject, { binary })); blob = new Blob([data as BlobPart], { type: binary ? "application/octet-stream" : "text/plain" }); } updateProgress(100); return URL.createObjectURL(blob); };
  const convertBatch = async () => { const pending = files.filter((file) => file.status === "pending" || file.status === "error"); if (!pending.length) return; setIsConverting(true); for (const item of pending) { setFiles((previous) => previous.map((file) => file.id === item.id ? { ...file, status: "converting", progress: 0, error: undefined } : file)); const updateProgress = (progress: number) => setFiles((previous) => previous.map((file) => file.id === item.id ? { ...file, progress } : file)); await new Promise((resolve) => setTimeout(resolve, 50)); try { const url = await convertSingleFile(item, updateProgress); setFiles((previous) => previous.map((file) => file.id === item.id ? { ...file, status: "done", convertedUrl: url, progress: 100 } : file)); } catch (error: any) { console.error(`Erro ao converter ${item.file.name}:`, error); setFiles((previous) => previous.map((file) => file.id === item.id ? { ...file, status: "error", error: error.message || "Erro desconhecido" } : file)); } } setIsConverting(false); };
  const changeOutputFormat = (format: OutputFormat) => { if (format === outputFormat) return; setFiles((previous) => previous.map((file) => { if (file.convertedUrl) URL.revokeObjectURL(file.convertedUrl); return { ...file, status: "pending", convertedUrl: undefined }; })); setOutputFormat(format); };
  const getOutputFilename = (file: File) => `${file.name.substring(0, file.name.lastIndexOf("."))}.${outputFormat}`;
  return { files, outputFormat, isConverting, fileInputRef, handleFileChange, handleDragOver, handleDrop, removeFile, clearAll, convertBatch, changeOutputFormat, getOutputFilename, pendingCount: files.filter((file) => file.status === "pending" || file.status === "error").length };
}
