import { useMemo, useState } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError } from "@/lib/toast";

export interface ClickerConfig { rows: number; cols: number; switchSize: number; wallThickness: number; height: number; plateThickness: number; cornerRadius: number; keychainHole: boolean; holeDiameter: number; baseColor: string; }

export function useFidgetClickerMaker() {
  const [config, setConfig] = useState<ClickerConfig>({ rows: 1, cols: 1, switchSize: 14, wallThickness: 2.5, height: 12, plateThickness: 1.5, cornerRadius: 3, keychainHole: true, holeDiameter: 4, baseColor: "#e0e0e0" });
  const [successMsg, setSuccessMsg] = useState("");
  const dimensions = useMemo(() => ({ width: config.cols * config.switchSize + (config.cols + 1) * config.wallThickness, depth: config.rows * config.switchSize + (config.rows + 1) * config.wallThickness, height: config.height }), [config]);
  const housingShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = dimensions.width / 10, d = dimensions.depth / 10, r = config.cornerRadius / 10;
    shape.moveTo(-w / 2 + r, -d / 2); shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); shape.lineTo(-w / 2 + r, d / 2); shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    return shape;
  }, [config.cornerRadius, dimensions.depth, dimensions.width]);
  const extrudeSettings = useMemo(() => ({ steps: 1, depth: dimensions.height / 10, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }), [dimensions.height]);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };
  const handleExportSTL = () => {
    try {
      const { width, depth, height } = dimensions;
      const w = width / 10, d = depth / 10, h = height / 10, r = config.cornerRadius / 10, sw = config.switchSize / 10, t = config.wallThickness / 10, pt = config.plateThickness / 10;
      const outerShape = new THREE.Shape();
      outerShape.moveTo(-w / 2 + r, -d / 2); outerShape.lineTo(w / 2 - r, -d / 2); outerShape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); outerShape.lineTo(w / 2, d / 2 - r); outerShape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); outerShape.lineTo(-w / 2 + r, d / 2); outerShape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); outerShape.lineTo(-w / 2, -d / 2 + r); outerShape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
      const plateShape = outerShape.clone();
      for (let row = 0; row < config.rows; row++) for (let col = 0; col < config.cols; col++) { const x = -width / 20 + t + col * (sw + t), y = -depth / 20 + t + row * (sw + t); const hole = new THREE.Path(); hole.moveTo(x, y); hole.lineTo(x + sw, y); hole.lineTo(x + sw, y + sw); hole.lineTo(x, y + sw); hole.lineTo(x, y); plateShape.holes.push(hole); }
      if (config.keychainHole) { const hole = new THREE.Path(); hole.absarc(width / 20 - config.wallThickness / 10, depth / 20 - config.wallThickness / 10, config.holeDiameter / 20, 0, Math.PI * 2, true); plateShape.holes.push(hole); }
      const frameShape = outerShape.clone(), innerW = w - t * 2, innerD = d - t * 2, innerR = Math.max(0, r - t), innerPath = new THREE.Path();
      innerPath.moveTo(-innerW / 2 + innerR, -innerD / 2); innerPath.lineTo(innerW / 2 - innerR, -innerD / 2); innerPath.quadraticCurveTo(innerW / 2, -innerD / 2, innerW / 2, -innerD / 2 + innerR); innerPath.lineTo(innerW / 2, innerD / 2 - innerR); innerPath.quadraticCurveTo(innerW / 2, innerD / 2, innerW / 2 - innerR, innerD / 2); innerPath.lineTo(-innerW / 2 + innerR, innerD / 2); innerPath.quadraticCurveTo(-innerW / 2, innerD / 2, -innerW / 2, innerD / 2 - innerR); innerPath.lineTo(-innerW / 2, -innerD / 2 + innerR); innerPath.quadraticCurveTo(-innerW / 2, -innerD / 2, -innerW / 2 + innerR, -innerD / 2); frameShape.holes.push(innerPath);
      const base = new THREE.ExtrudeGeometry(outerShape, { depth: 0.2, bevelEnabled: false }); const plate = new THREE.ExtrudeGeometry(plateShape, { depth: pt, bevelEnabled: false }); plate.translate(0, 0, h - pt); const walls = new THREE.ExtrudeGeometry(frameShape, { depth: h - 0.2, bevelEnabled: false }); walls.translate(0, 0, 0.2);
      const merged = BufferGeometryUtils.mergeGeometries([base, plate, walls]); const result = new STLExporter().parse(new THREE.Mesh(merged), { binary: true }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" })); link.download = `fidget-clicker-${config.cols}x${config.rows}-${Date.now()}.stl`; link.click(); showNotification("STL exportado com sucesso!");
    } catch (err) { console.error("Export failed:", err); toastExportError(); }
  };
  return { config, setConfig, dimensions, housingShape, extrudeSettings, successMsg, handleExportSTL };
}
