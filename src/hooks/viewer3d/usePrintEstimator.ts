import { useEffect, useState } from "react";

export const MATERIALS = [
  { id: "pla", name: "PLA (Standard)", density: 1.24, defaultCost: 110, type: "FDM" },
  { id: "petg", name: "PETG (Resistente)", density: 1.27, defaultCost: 130, type: "FDM" },
  { id: "abs", name: "ABS (Técnico)", density: 1.04, defaultCost: 100, type: "FDM" },
  { id: "resin_std", name: "Resina Standard", density: 1.10, defaultCost: 220, type: "SLA" },
  { id: "resin_tough", name: "Resina Tough/ABS-Like", density: 1.15, defaultCost: 340, type: "SLA" },
  { id: "resin_eco", name: "Resina Eco / Lavável", density: 1.05, defaultCost: 280, type: "SLA" },
] as const;

type ModelDimensions = { x: number; y: number; z: number; volume: number };

export function usePrintEstimator(fileName: string, modelDimensions: ModelDimensions, enabled = true) {
  const [estimatorType, setEstimatorType] = useState<"SLA" | "FDM">("SLA");
  const [selectedMaterialId, setSelectedMaterialId] = useState("resin_std");
  const [materialDensity, setMaterialDensity] = useState(1.10);
  const [printScale, setPrintScale] = useState(100);
  const [miniatureScaleMode, setMiniatureScaleMode] = useState<"human" | "direct">("human");
  const [customMiniatureRatio, setCustomMiniatureRatio] = useState(16);
  const [isHollow, setIsHollow] = useState(false);
  const [layerHeight, setLayerHeight] = useState(0.05);
  const [exposureTime, setExposureTime] = useState(2.5);
  const [resinCostPerKg, setResinCostPerKg] = useState(220);
  const [fdmInfill, setFdmInfill] = useState(20);
  const [fdmLayerHeight, setFdmLayerHeight] = useState(0.2);
  const [fdmPrintSpeed, setFdmPrintSpeed] = useState(60);
  const [fdmFilamentCostPerKg, setFdmFilamentCostPerKg] = useState(110);
  const [fdmWallCount, setFdmWallCount] = useState(2);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateProgress, setEstimateProgress] = useState(100);

  useEffect(() => {
    if (!enabled) return;
    setIsEstimating(true);
    setEstimateProgress(0);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 20) + 10;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setTimeout(() => setIsEstimating(false), 120);
      }
      setEstimateProgress(currentProgress);
    }, 40);
    return () => clearInterval(interval);
  }, [enabled, printScale, estimatorType, isHollow, layerHeight, exposureTime, resinCostPerKg, fdmInfill, fdmLayerHeight, fdmPrintSpeed, fdmFilamentCostPerKg, fdmWallCount, materialDensity, modelDimensions.volume]);

  const maxOriginalDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z);
  const autoScaleFactor = maxOriginalDim < 15.0 ? 10.0 : 1.0;
  const originalX = modelDimensions.x * (modelDimensions.x < 15.0 ? 10.0 : 1.0);
  const originalY = modelDimensions.y * (modelDimensions.y < 15.0 ? 10.0 : 1.0);
  const originalZ = modelDimensions.z * (modelDimensions.z < 15.0 ? 10.0 : 1.0);
  const scaledX = originalX * (printScale / 100.0);
  const scaledY = originalY * (printScale / 100.0);
  const scaledZ = originalZ * (printScale / 100.0);

  const handleDownloadCSV = () => {
    const scaleMultiplier = printScale / 100.0;
    const csvScaledX = modelDimensions.x * autoScaleFactor * scaleMultiplier;
    const csvScaledY = modelDimensions.y * autoScaleFactor * scaleMultiplier;
    const csvScaledZ = modelDimensions.z * autoScaleFactor * scaleMultiplier;
    let rawVol = modelDimensions.volume * Math.pow(autoScaleFactor, 3) * Math.pow(scaleMultiplier, 3) * 0.001;
    if (rawVol <= 0.001) rawVol = csvScaledX * csvScaledY * csvScaledZ * 0.001 * 0.40;
    let finalVol = 0, weight = 0, cost = 0, timeStr = "";
    const material = MATERIALS.find((m) => m.id === selectedMaterialId)?.name || "Desconhecido";
    if (estimatorType === "SLA") {
      finalVol = isHollow ? rawVol * 0.30 : rawVol;
      weight = finalVol * materialDensity;
      cost = (weight / 1000.0) * resinCostPerKg;
      const totalSecs = Math.max(1, Math.ceil(csvScaledZ / layerHeight)) * (exposureTime + 5.0) + 120;
      timeStr = `${Math.floor(totalSecs / 3600)}h ${Math.floor((totalSecs % 3600) / 60)}m`;
    } else {
      const shellFactor = Math.min(0.8, 0.08 * fdmWallCount);
      finalVol = rawVol * Math.max(0.05, shellFactor + (1.0 - shellFactor) * (fdmInfill / 100.0));
      weight = finalVol * materialDensity;
      cost = (weight / 1000.0) * fdmFilamentCostPerKg;
      const totalSecs = ((finalVol * 1000.0) / (0.42 * fdmLayerHeight * fdmPrintSpeed || 1.0)) * 1.30 + 900;
      timeStr = `${Math.floor(totalSecs / 3600)}h ${Math.floor((totalSecs % 3600) / 60)}m`;
    }
    const csvRows = [["Campo", "Valor"], ["Arquivo", fileName], ["Tipo de Estimador", estimatorType], ["Material", material], ["Escala de Impressao (%)", printScale], ["Dimensoes X (mm)", csvScaledX.toFixed(2)], ["Dimensoes Y (mm)", csvScaledY.toFixed(2)], ["Dimensoes Z (mm)", csvScaledZ.toFixed(2)], ["Volume Final (mL/cm3)", finalVol.toFixed(2)], ["Peso Estimado (g)", weight.toFixed(2)], ["Custo Estimado (R$)", cost.toFixed(2)], ["Tempo Estimado", timeStr]];
    csvRows.push(...(estimatorType === "SLA" ? [["Oco (Hollowed)", isHollow ? "Sim" : "Nao"], ["Altura de Camada (mm)", layerHeight], ["Tempo de Exposicao (s)", exposureTime]] : [["Infill (%)", fdmInfill], ["Altura de Camada FDM (mm)", fdmLayerHeight], ["Velocidade de Impressao (mm/s)", fdmPrintSpeed], ["Numero de Paredes", fdmWallCount]]));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvRows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" }));
    link.download = `estimativa_${fileName.replace(/\.[^/.]+$/, "")}.csv`;
    link.click();
  };

  const applyMiniatureScale = (denom: number, mode = miniatureScaleMode) => {
    if (mode === "human" && originalZ > 0) setPrintScale(Math.max(0.1, Math.min(2000, Math.round((1800.0 / denom / originalZ) * 1000) / 10)));
    else setPrintScale(Math.max(0.1, Math.min(2000, Math.round((100.0 / denom) * 10) / 10)));
  };

  const getSlicingStatus = (progress: number) => progress < 25 ? "Analisando malha 3D..." : progress < 55 ? "Calculando volumes..." : progress < 80 ? "Estimando tempo..." : "Finalizando...";

  return {
    MATERIALS, estimatorType, setEstimatorType, selectedMaterialId, setSelectedMaterialId, materialDensity, setMaterialDensity,
    printScale, setPrintScale, miniatureScaleMode, setMiniatureScaleMode, customMiniatureRatio, setCustomMiniatureRatio,
    isHollow, setIsHollow, layerHeight, setLayerHeight, exposureTime, setExposureTime, resinCostPerKg, setResinCostPerKg,
    fdmInfill, setFdmInfill, fdmLayerHeight, setFdmLayerHeight, fdmPrintSpeed, setFdmPrintSpeed, fdmFilamentCostPerKg, setFdmFilamentCostPerKg, fdmWallCount, setFdmWallCount,
    isEstimating, estimateProgress, originalX, originalY, originalZ, scaledX, scaledY, scaledZ, handleDownloadCSV, applyMiniatureScale, getSlicingStatus,
  };
}
