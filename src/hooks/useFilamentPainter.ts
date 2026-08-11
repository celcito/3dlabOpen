import { useState } from "react";
import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { toastExportError } from "@/lib/toast";

export interface ColorLayer { id: string; zHeight: number; color: string; filamentName: string; }
export interface ImagePixels { data: Uint8ClampedArray; w: number; h: number; }

export function useFilamentPainter(createGeometry: (pixels: ImagePixels | null, width: number, height: number, maxZ: number, baseThickness: number, layers: ColorLayer[]) => { geometry: THREE.BufferGeometry }) {
  const [layers, setLayers] = useState<ColorLayer[]>([{ id: "1", zHeight: 0, color: "#000000", filamentName: "Black PLA" }, { id: "2", zHeight: 0.6, color: "#ff0000", filamentName: "Red PLA" }, { id: "3", zHeight: 1.2, color: "#ffff00", filamentName: "Yellow PLA" }, { id: "4", zHeight: 1.8, color: "#ffffff", filamentName: "White PLA" }]);
  const [width, setWidth] = useState(100); const [height, setHeight] = useState(100); const [maxZ, setMaxZ] = useState(2.4); const [baseThickness, setBaseThickness] = useState(0.4);
  const [imageUrl, setImageUrl] = useState<string | null>(null); const [imagePixels, setImagePixels] = useState<ImagePixels | null>(null); const [successMsg, setSuccessMsg] = useState("");
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); setImageUrl(url); const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); const max = 256; let w = image.width; let h = image.height; if (w > h) { h = Math.round((h / w) * max); w = max; } else { w = Math.round((w / h) * max); h = max; } canvas.width = w; canvas.height = h; const context = canvas.getContext("2d"); if (context) { context.drawImage(image, 0, 0, w, h); setImagePixels({ data: context.getImageData(0, 0, w, h).data, w, h }); setHeight(Math.round((h / w) * width)); } }; image.src = url; };
  const addLayer = () => setLayers((previous) => [...previous, { id: Date.now().toString(), zHeight: Math.round(((previous[previous.length - 1]?.zHeight || 0) + 0.4) * 10) / 10, color: "#00E5FF", filamentName: "New Color" }].sort((a, b) => a.zHeight - b.zHeight));
  const removeLayer = (id: string) => setLayers((previous) => previous.filter((layer) => layer.id !== id));
  const updateLayer = (id: string, updates: Partial<ColorLayer>) => setLayers((previous) => previous.map((layer) => layer.id === id ? { ...layer, ...updates } : layer).sort((a, b) => a.zHeight - b.zHeight));
  const showNotification = (message: string) => { setSuccessMsg(message); setTimeout(() => setSuccessMsg(""), 3500); };
  const handleExportOBJ = () => { try { const scene = new THREE.Scene(); const { geometry } = createGeometry(imagePixels, width, height, maxZ, baseThickness, layers); const mesh = new THREE.Mesh(geometry); mesh.rotation.x = -Math.PI / 2; mesh.updateMatrixWorld(); scene.add(mesh); const result = new OBJExporter().parse(scene); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "text/plain" })); link.download = `filament-painting-${Date.now()}.obj`; link.click(); showNotification("STL Exportado! Veja as instruções de troca abaixo."); } catch (error) { console.error(error); toastExportError(); } };
  return { layers, width, setWidth, height, setHeight, maxZ, setMaxZ, baseThickness, setBaseThickness, imageUrl, imagePixels, successMsg, handleImageUpload, addLayer, removeLayer, updateLayer, handleExportOBJ, setHeightValue: setHeight };
}
