import { useEffect, useState } from "react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError } from "@/lib/toast";

export interface FaceConfig { intensity: number; baseThickness: number; size: number; resolution: number; invert: boolean; contrast: number; baseColor: string; }
export function useFaceMeshGeometry(meshRef: React.RefObject<THREE.Mesh | null>, heightData: Float32Array, intensity: number, resolution: number) {
  useEffect(() => {
    if (!meshRef.current) return;
    const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < resolution * resolution; i++) positions[i * 3 + 2] = heightData[i] * intensity;
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [heightData, intensity, resolution, meshRef]);
}
export function useFace3DGenerator() {
  const [config, setConfig] = useState<FaceConfig>({ intensity: 8, baseThickness: 3, size: 100, resolution: 128, invert: false, contrast: 1.2, baseColor: "#ffffff" });
  const [image, setImage] = useState<string | null>(null), [heightData, setHeightData] = useState<Float32Array | null>(null), [isProcessing, setIsProcessing] = useState(false), [successMsg, setSuccessMsg] = useState("");
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => setImage(event.target?.result as string); reader.readAsDataURL(file); };
  useEffect(() => { if (!image) { setHeightData(null); return; } setIsProcessing(true); const img = new Image(); img.src = image; img.onload = () => { const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d"); if (!ctx) return; const res = config.resolution; canvas.width = res; canvas.height = res; ctx.drawImage(img, 0, 0, res, res); const data = ctx.getImageData(0, 0, res, res).data, heights = new Float32Array(res * res); for (let i = 0; i < data.length; i += 4) { let avg = ((data[i] + data[i + 1] + data[i + 2]) / 3 / 255 - 0.5) * config.contrast + 0.5; avg = Math.max(0, Math.min(1, avg)); heights[i / 4] = config.invert ? 1 - avg : avg; } setHeightData(heights); setIsProcessing(false); }; }, [image, config.resolution, config.contrast, config.invert]);
  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };
  const handleExportSTL = () => { if (!heightData) return; try { const res = config.resolution, size = config.size / 10, intensity = config.intensity / 10, base = config.baseThickness / 10, relief = new THREE.PlaneGeometry(size, size, res - 1, res - 1), positions = relief.attributes.position.array as Float32Array; for (let i = 0; i < res * res; i++) positions[i * 3 + 2] = heightData[i] * intensity; relief.computeVertexNormals(); const baseGeom = new THREE.BoxGeometry(size, size, base); baseGeom.translate(0, 0, -base / 2); const group = new THREE.Group(); group.add(new THREE.Mesh(relief), new THREE.Mesh(baseGeom)); group.rotation.x = -Math.PI / 2; group.updateMatrixWorld(); const result = new STLExporter().parse(group, { binary: true }), link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `face-3d-${Date.now()}.stl`; link.click(); showNotification("STL da Face exportado!"); } catch (err) { console.error(err); toastExportError(); } };
  return { config, setConfig, image, setImage, heightData, isProcessing, successMsg, handleImageUpload, handleExportSTL };
}
