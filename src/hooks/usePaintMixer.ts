import { useState } from "react";
import colorConvert from "color-convert";

export const MOCK_PAINTS = [
  { id: 1, name: "Mephiston Red", brand: "Citadel", hex: "#9a1115", type: "Base" }, { id: 2, name: "Macragge Blue", brand: "Citadel", hex: "#0d2a59", type: "Base" }, { id: 3, name: "Averland Sunset", brand: "Citadel", hex: "#fbb81c", type: "Base" }, { id: 4, name: "Abaddon Black", brand: "Citadel", hex: "#000000", type: "Base" }, { id: 5, name: "Corax White", brand: "Citadel", hex: "#ffffff", type: "Base" }, { id: 6, name: "Ultramarine", brand: "Vallejo", hex: "#152069", type: "Model Color" }, { id: 7, name: "Flat Red", brand: "Vallejo", hex: "#990000", type: "Model Color" },
];
export function usePaintMixer() {
  const [targetHex, setTargetHex] = useState("#800080");
  const closest = (() => { try { const target = colorConvert.hex.lab(targetHex.replace("#", "")); return MOCK_PAINTS.map((paint) => { const lab = colorConvert.hex.lab(paint.hex.replace("#", "")); return { ...paint, distance: Math.sqrt(Math.pow(target[0] - lab[0], 2) + Math.pow(target[1] - lab[1], 2) + Math.pow(target[2] - lab[2], 2)) }; }).sort((a, b) => a.distance - b.distance).slice(0, 3); } catch { return []; } })();
  return { targetHex, setTargetHex, closest };
}
