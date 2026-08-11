import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import QRCode from "qrcode";
import { toastExportError } from "@/lib/toast";

export interface QrConfig { text: string; size: number; thickness: number; qrHeight: number; padding: number; borderRadius: number; baseColor: string; qrColor: string; includeText: boolean; label: string; labelSize: number; labelDepth: number; }
export function useQrGenerator() {
  const [config, setConfig] = useState<QrConfig>({ text: "https://verticestudio.com.br", size: 2, thickness: 4, qrHeight: 2, padding: 10, borderRadius: 5, baseColor: "#ffffff", qrColor: "#FFFFFF", includeText: true, label: "SCAN ME", labelSize: 6, labelDepth: 1.5 });
  const [qrMatrix, setQrMatrix] = useState<number[][]>([]), [successMsg, setSuccessMsg] = useState("");
  useEffect(() => { if (!config.text) { setQrMatrix([]); return; } try { const matrix = QRCode.create(config.text, { errorCorrectionLevel: "M" }); const result: number[][] = []; for (let y = 0; y < matrix.modules.size; y++) { const row: number[] = []; for (let x = 0; x < matrix.modules.size; x++) row.push(matrix.modules.get(x, y) ? 1 : 0); result.push(row); } setQrMatrix(result); } catch (err) { console.error("QR Generation failed:", err); } }, [config.text]);
  const plateDimensions = useMemo(() => { if (!qrMatrix.length) return { width: 0, height: 0 }; const qrDim = qrMatrix.length * config.size, totalDim = qrDim + config.padding * 2; return { width: totalDim, height: totalDim + (config.includeText ? config.labelSize * 2 : 0) }; }, [qrMatrix, config.size, config.padding, config.includeText, config.labelSize]);
  const previewGeometry = useMemo(() => {
    const { width, height } = plateDimensions, w = width / 10, h = height / 10, r = config.borderRadius / 10;
    const shape = new THREE.Shape(); shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return { shape, extrudeSettings: { steps: 1, depth: config.thickness / 10, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 } };
  }, [plateDimensions, config.borderRadius, config.thickness]);
  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };
  const handleExportSTL = () => { if (!qrMatrix.length) return; try { const { width, height } = plateDimensions, w = width / 10, h = height / 10, r = config.borderRadius / 10, t = config.thickness / 10, qh = config.qrHeight / 10, module = config.size / 10, shape = new THREE.Shape(); shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); const group = new THREE.Group(); group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { steps: 1, depth: t, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }))); const geometries: THREE.BoxGeometry[] = [], offset = -(qrMatrix.length * module) / 2, yShift = config.includeText ? config.labelSize / 10 : 0; qrMatrix.forEach((row, y) => row.forEach((active, x) => { if (active) { const box = new THREE.BoxGeometry(module, module, qh); box.translate(offset + x * module + module / 2, -(offset + y * module + module / 2) + yShift, t + qh / 2); geometries.push(box); } })); if (geometries.length) group.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(geometries))); const result = new STLExporter().parse(group, { binary: true }), link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `qrcode-plate-${Date.now()}.stl`; link.click(); showNotification("STL exportado com sucesso!"); } catch (err) { console.error("Export failed:", err); toastExportError(); } };
  return { config, setConfig, qrMatrix, successMsg, plateDimensions, previewGeometry, handleExportSTL };
}
