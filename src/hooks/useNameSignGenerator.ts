import { useMemo, useState } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { toastExportError } from "@/lib/toast";

export interface SignConfig { text: string; font: string; fontSize: number; textHeight: number; letterSpacing: number; plateThickness: number; paddingX: number; paddingY: number; borderRadius: number; baseColor: string; textColor: string; mountingHoles: boolean; holeSize: number; holePadding: number; }
export const FONTS = [{ name: "Inter Black", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_bold.typeface.json" }, { name: "Modern Sans", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/helvetiker_regular.typeface.json" }, { name: "Gentilis", url: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/fonts/gentilis_bold.typeface.json" }];

export function useNameSignGenerator() {
  const [config, setConfig] = useState<SignConfig>({ text: "VERTICE", font: FONTS[0].url, fontSize: 20, textHeight: 4, letterSpacing: 1, plateThickness: 3, paddingX: 10, paddingY: 10, borderRadius: 5, baseColor: "#e0e0e0", textColor: "#00E5FF", mountingHoles: true, holeSize: 4, holePadding: 6 });
  const [successMsg, setSuccessMsg] = useState(""), [isExporting, setIsExporting] = useState(false);
  const plateDimensions = useMemo(() => ({ width: config.text.length * (config.fontSize * 0.7 + config.letterSpacing) + config.paddingX * 2, height: config.fontSize + config.paddingY * 2 }), [config]);
  const previewGeometry = useMemo(() => {
    const textW = config.text.length * (config.fontSize * 0.6) / 10;
    const textH = config.fontSize / 10;
    const pW = textW + (config.paddingX / 5);
    const pH = textH + (config.paddingY / 5);
    const pR = config.borderRadius / 10;
    const shape = new THREE.Shape();
    shape.moveTo(-pW / 2 + pR, -pH / 2); shape.lineTo(pW / 2 - pR, -pH / 2);
    shape.quadraticCurveTo(pW / 2, -pH / 2, pW / 2, -pH / 2 + pR); shape.lineTo(pW / 2, pH / 2 - pR);
    shape.quadraticCurveTo(pW / 2, pH / 2, pW / 2 - pR, pH / 2); shape.lineTo(-pW / 2 + pR, pH / 2);
    shape.quadraticCurveTo(-pW / 2, pH / 2, -pW / 2, pH / 2 - pR); shape.lineTo(-pW / 2, -pH / 2 + pR);
    shape.quadraticCurveTo(-pW / 2, -pH / 2, -pW / 2 + pR, -pH / 2);
    if (config.mountingHoles) {
      const hR = config.holeSize / 20, hPad = config.holePadding / 10;
      [[-pW / 2 + hPad, -pH / 2 + hPad], [pW / 2 - hPad, -pH / 2 + hPad], [pW / 2 - hPad, pH / 2 - hPad], [-pW / 2 + hPad, pH / 2 - hPad]].forEach(([hx, hy]) => {
        const hole = new THREE.Path(); hole.absarc(hx, hy, hR, 0, Math.PI * 2, true); shape.holes.push(hole);
      });
    }
    return { shape, textW, textH, pW, pT: config.plateThickness / 10 };
  }, [config]);
  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };
  const handleExportSTL = async () => { setIsExporting(true); try { const font = await new Promise<any>((resolve) => new FontLoader().load(config.font, resolve)); const textGeom = new TextGeometry(config.text, { font, size: config.fontSize / 10, depth: config.textHeight / 10, curveSegments: 12, bevelEnabled: false }); textGeom.computeBoundingBox(); const bbox = textGeom.boundingBox!; const textW = bbox.max.x - bbox.min.x, textH = bbox.max.y - bbox.min.y; textGeom.translate(-textW / 2, -textH / 2, config.plateThickness / 10); const pW = textW + config.paddingX / 5, pH = textH + config.paddingY / 5, pR = config.borderRadius / 10, pT = config.plateThickness / 10; const shape = new THREE.Shape(); shape.moveTo(-pW / 2 + pR, -pH / 2); shape.lineTo(pW / 2 - pR, -pH / 2); shape.quadraticCurveTo(pW / 2, -pH / 2, pW / 2, -pH / 2 + pR); shape.lineTo(pW / 2, pH / 2 - pR); shape.quadraticCurveTo(pW / 2, pH / 2, pW / 2 - pR, pH / 2); shape.lineTo(-pW / 2 + pR, pH / 2); shape.quadraticCurveTo(-pW / 2, pH / 2, -pW / 2, pH / 2 - pR); shape.lineTo(-pW / 2, -pH / 2 + pR); shape.quadraticCurveTo(-pW / 2, -pH / 2, -pW / 2 + pR, -pH / 2); if (config.mountingHoles) for (const [x, y] of [[-pW / 2 + config.holePadding / 10, -pH / 2 + config.holePadding / 10], [pW / 2 - config.holePadding / 10, -pH / 2 + config.holePadding / 10], [pW / 2 - config.holePadding / 10, pH / 2 - config.holePadding / 10], [-pW / 2 + config.holePadding / 10, pH / 2 - config.holePadding / 10]]) { const hole = new THREE.Path(); hole.absarc(x, y, config.holeSize / 20, 0, Math.PI * 2, true); shape.holes.push(hole); } const plate = new THREE.ExtrudeGeometry(shape, { depth: pT, bevelEnabled: false }); const result = new STLExporter().parse(new THREE.Mesh(BufferGeometryUtils.mergeGeometries([plate, textGeom])), { binary: true }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `name-sign-${config.text.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.stl`; link.click(); showNotification("STL exportado com sucesso!"); } catch (err) { console.error("Export failed:", err); toastExportError(); } finally { setIsExporting(false); } };
  return { config, setConfig, plateDimensions, previewGeometry, successMsg, isExporting, handleExportSTL };
}
