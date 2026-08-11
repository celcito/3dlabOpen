import { useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

type ModelDimensions = { x: number; y: number; z: number; volume: number };

export function calculateMeshVolume(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position;
  if (!position) return 0;
  let volume = 0;
  const index = geometry.index;
  const readTriangle = (a: number, b: number, c: number) => {
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a);
    const bx = position.getX(b), by = position.getY(b), bz = position.getZ(b);
    const cx = position.getX(c), cy = position.getY(c), cz = position.getZ(c);
    volume += (-cx * by * az + bx * cy * az + cx * ay * bz - ax * cy * bz - bx * ay * cz + ax * by * cz) / 6;
  };
  if (index) for (let i = 0; i < index.count; i += 3) readTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  else for (let i = 0; i < position.count; i += 3) readTriangle(i, i + 1, i + 2);
  return Math.abs(volume);
}

function mergeGeometries(geometries: THREE.BufferGeometry[]) {
  const positions: number[] = [], normals: number[] = [];
  geometries.forEach((geometry) => {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal ? normal.getX(i) : 0, normal ? normal.getY(i) : 1, normal ? normal.getZ(i) : 0);
    }
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

export function useViewerModelImport({
  importUnit,
  importScale,
  onResetDomain,
}: {
  importUnit: "mm" | "inch";
  importScale: number;
  onResetDomain: () => void;
}) {
  const [modelGeometry, setModelGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [fileName, setFileName] = useState("NONE");
  const [modelDimensions, setModelDimensions] = useState<ModelDimensions>({ x: 0, y: 0, z: 0, volume: 0 });
  const [stats, setStats] = useState({ faces: 0, vertices: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");

  const setupGeometry = (geometry: THREE.BufferGeometry) => {
    setIsProcessing(true); setProcessingMessage("Preparando geometria...");
    setTimeout(() => {
      try {
        let prepared = geometry;
        try { prepared = BufferGeometryUtils.mergeVertices(geometry); } catch (error) { console.warn("Failed to merge vertices:", error); }
        const unitFactor = importUnit === "inch" ? 25.4 : 1;
        const totalFactor = unitFactor * importScale;
        if (totalFactor !== 1) prepared.scale(totalFactor, totalFactor, totalFactor);
        prepared.center(); prepared.computeVertexNormals(); prepared.computeBoundingBox();
        const size = prepared.boundingBox?.getSize(new THREE.Vector3()) || new THREE.Vector3();
        setModelDimensions({ x: size.x, y: size.y, z: size.z, volume: calculateMeshVolume(prepared) });
        const count = prepared.attributes.position.count;
        onResetDomain(); setModelGeometry(prepared);
        setStats({ faces: prepared.index ? Math.floor(prepared.index.count / 3) : Math.floor(count / 3), vertices: count });
      } finally { setIsProcessing(false); }
    }, 100);
  };

  const loadDemoModel = () => { setupGeometry(new THREE.TorusKnotGeometry(1.5, 0.45, 120, 24)); setFileName("DEMO_TORUS_KNOT.STL"); };
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setIsProcessing(true); setProcessingMessage(`Lendo arquivo: ${file.name}...`); setFileName(file.name.toUpperCase());
    const name = file.name.toUpperCase();
    const finish = (geometry: THREE.BufferGeometry) => setupGeometry(geometry);
    if (name.endsWith(".STL")) {
      const reader = new FileReader(); reader.onload = (e) => { try { finish(new STLLoader().parse(e.target?.result as ArrayBuffer)); } catch { alert("Failed to parse STL."); setIsProcessing(false); } }; reader.readAsArrayBuffer(file);
    } else if (name.endsWith(".OBJ")) {
      const reader = new FileReader(); reader.onload = (e) => { try { const object = new OBJLoader().parse(e.target?.result as string); const geometries: THREE.BufferGeometry[] = []; object.traverse((child) => { if ((child as THREE.Mesh).isMesh) geometries.push((child as THREE.Mesh).geometry.clone()); }); if (!geometries.length) throw new Error("No meshes found."); finish(geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)); } catch { alert("Failed to parse OBJ."); setIsProcessing(false); } }; reader.readAsText(file);
    } else if (name.endsWith(".FBX")) {
      const reader = new FileReader(); reader.onload = (e) => { try { const object = new FBXLoader().parse(e.target?.result as ArrayBuffer, ""); const geometries: THREE.BufferGeometry[] = []; object.traverse((child) => { if ((child as THREE.Mesh).isMesh) geometries.push((child as THREE.Mesh).geometry.clone()); }); if (!geometries.length) throw new Error("No meshes found."); finish(geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)); } catch { alert("Failed to parse FBX."); setIsProcessing(false); } }; reader.readAsArrayBuffer(file);
    } else { alert("Unsupported format."); setIsProcessing(false); }
  };
  return { modelGeometry, setModelGeometry, fileName, setFileName, modelDimensions, stats, setStats, isProcessing, setIsProcessing, processingMessage, setProcessingMessage, setupGeometry, loadDemoModel, handleFileUpload };
}
