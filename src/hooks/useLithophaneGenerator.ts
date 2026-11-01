import { useMemo, useState } from "react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError } from "@/lib/toast";
import { buildFrameGeometry, CUSTOM_PRESET_ID, PORTRAIT_PRESETS } from "@/src/lib/lithophane/frame";

export type LithophaneShape = "flat" | "curved";
export interface ImagePixels { data: Uint8ClampedArray; w: number; h: number; }
export function useLithophaneGenerator(createGeometry: (pixels: ImagePixels, shape: LithophaneShape, width: number, height: number, minThick: number, maxThick: number, curveAngle: number) => THREE.BufferGeometry) {
  const [imageUrl, setImageUrl] = useState<string | null>(null), [imagePixels, setImagePixels] = useState<ImagePixels | null>(null), [shape, setShape] = useState<LithophaneShape>("flat"), [width, setWidth] = useState(100), [height, setHeight] = useState(100), [minThick, setMinThick] = useState(0.8), [maxThick, setMaxThick] = useState(3), [curveAngle, setCurveAngle] = useState(180), [isLoading, setIsLoading] = useState(false), [isImageLoading, setIsImageLoading] = useState(false);
  const [frameEnabled, setFrameEnabled] = useState(false), [framePreset, setFramePreset] = useState<string>(CUSTOM_PRESET_ID), [frameBorder, setFrameBorder] = useState(12), [frameDepth, setFrameDepth] = useState(6), [frameRadius, setFrameRadius] = useState(6);
  /** Aplica um preset de porta-retrato: define a abertura e liga a moldura. */
  const applyFramePreset = (id: string) => {
    setFramePreset(id);
    const preset = PORTRAIT_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setWidth(preset.width);
    setHeight(preset.height);
    setFrameEnabled(true);
  };
  // Mexer nas medidas na mão deixa de ser preset.
  const setPanelWidth = (v: number) => { setWidth(v); setFramePreset(CUSTOM_PRESET_ID); };
  const setPanelHeight = (v: number) => { setHeight(v); setFramePreset(CUSTOM_PRESET_ID); };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); setImageUrl(url); setIsImageLoading(true); const img = new Image(); img.onload = () => { const canvas = document.createElement("canvas"), target = 300; let w = img.width, h = img.height; if (w > h && w > target) { h = Math.round(h * target / w); w = target; } else if (h >= w && h > target) { w = Math.round(w * target / h); h = target; } canvas.width = w; canvas.height = h; const ctx = canvas.getContext("2d"); if (!ctx) { setIsImageLoading(false); return; } ctx.drawImage(img, 0, 0, w, h); setImagePixels({ data: ctx.getImageData(0, 0, w, h).data, w, h }); if (framePreset === CUSTOM_PRESET_ID) { const aspect = w / h; if (aspect > 1) { setWidth(150); setHeight(Math.round(150 / aspect)); } else { setHeight(150); setWidth(Math.round(150 * aspect)); } } setIsImageLoading(false); }; img.src = url; };
  const frameGeometry = useMemo(() => !frameEnabled ? null : buildFrameGeometry({ openingWidth: width, openingHeight: height, border: frameBorder, depth: frameDepth, radius: frameRadius, panelThickness: maxThick }), [frameEnabled, width, height, frameBorder, frameDepth, frameRadius, maxThick]);
  const handleExportSTL = () => { if (!imagePixels) return; setIsLoading(true); setTimeout(() => { try { const scene = new THREE.Scene(); const add = (geom: THREE.BufferGeometry) => { const mesh = new THREE.Mesh(geom); mesh.rotation.x = -Math.PI / 2; mesh.updateMatrixWorld(); scene.add(mesh); }; add(createGeometry(imagePixels, shape, width, height, minThick, maxThick, curveAngle)); if (frameGeometry) add(frameGeometry); const result = new STLExporter().parse(scene, { binary: true }), link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `lithophane-${shape}${frameGeometry ? "-moldura" : ""}-${Date.now()}.stl`; link.click(); } catch (err) { console.error(err); toastExportError(); } setIsLoading(false); }, 100); };
  const geometry = useMemo(() => imagePixels ? createGeometry(imagePixels, shape, width, height, minThick, maxThick, curveAngle) : null, [createGeometry, imagePixels, shape, width, height, minThick, maxThick, curveAngle]);
  return { imageUrl, imagePixels, shape, setShape, width, setWidth: setPanelWidth, height, setHeight: setPanelHeight, minThick, setMinThick, maxThick, setMaxThick, curveAngle, setCurveAngle, isLoading, isImageLoading, geometry, handleImageUpload, handleExportSTL, frameEnabled, setFrameEnabled, framePreset, setFramePreset, applyFramePreset, frameBorder, setFrameBorder, frameDepth, setFrameDepth, frameRadius, setFrameRadius, frameGeometry };
}
