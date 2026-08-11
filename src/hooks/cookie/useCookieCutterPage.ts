import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { useCookieCutterMaker } from "../useCookieCutterMaker";
import {
  createRibbonShapeFromPoints,
  getOffsetPoints,
  useCookieOutline,
  useNormalizedCookieLayers,
} from "./useCookieCutterGeometry";

export interface SVGPathLayer {
  id: string;
  name: string;
  type: "cutter" | "stamp" | "ignore";
  points: THREE.Vector2[];
  isClosed: boolean;
  length: number;
}

export interface MakerConfig {
  size: number;
  cutterHeight: number;
  wallThickness: number;
  brimWidth: number;
  brimHeight: number;
  stampPlateThickness: number;
  clearance: number;
  detailHeight: number;
  detailThickness: number;
  addHandle: boolean;
  handleHeight: number;
  coloringBaseThickness: number;
  coloringLineHeight: number;
  coloringLineWidth: number;
  materialColor: string;
  viewMode: "cutter_stamp" | "cutter_only" | "stamp_only" | "coloring_plate";
  explodedView: number;
  showWireframe: boolean;
}

export interface SavedProject {
  id: string;
  name: string;
  savedAt: string;
  presetId: string;
  config: MakerConfig;
  layers: SVGPathLayer[];
}

export interface CookiePreset { id: string; name: string; icon: string; svg: string; }

const defaultConfig: MakerConfig = {
  size: 75, cutterHeight: 14, wallThickness: 0.8, brimWidth: 4, brimHeight: 2,
  stampPlateThickness: 2, clearance: 1.2, detailHeight: 1.5, detailThickness: 1.2,
  addHandle: true, handleHeight: 10, coloringBaseThickness: 3, coloringLineHeight: 1.6,
  coloringLineWidth: 1.2, materialColor: "#e0e0e0", viewMode: "cutter_stamp",
  explodedView: 0.25, showWireframe: false,
};

export function useCookieCutterPage(presets: CookiePreset[]) {
  const [activePresetId, setActivePresetId] = useState("duck");
  const [projectName, setProjectName] = useState("MEU CORTADOR");
  const { successMsg, triggerSuccess } = useCookieCutterMaker();
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"geral" | "cutter" | "stamp" | "coloring" | "biblioteca">("geral");
  const [config, setConfig] = useState<MakerConfig>(defaultConfig);
  const [layers, setLayers] = useState<SVGPathLayer[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseSVGContent = (svgText: string) => {
    try {
      const svgData = new SVGLoader().parse(svgText);
      if (!svgData?.paths?.length) {
        setErrorMsg("Não foi possível encontrar nenhum caminho vetorial (path) no SVG.");
        return;
      }
      const parsedLayers: SVGPathLayer[] = [];
      svgData.paths.forEach((pathObj, pathIdx) => {
        const node = pathObj.userData?.node as any;
        const nodeId = node ? (node.getAttribute("id") || node.getAttribute("class") || `path-${pathIdx}`) : `path-${pathIdx}`;
        pathObj.subPaths.forEach((subPath, subIdx) => {
          const points = subPath.getPoints(45);
          if (points.length < 2) return;
          const isClosed = points[0].distanceTo(points[points.length - 1]) < 0.1;
          let length = 0;
          for (let i = 0; i < points.length - 1; i++) length += points[i].distanceTo(points[i + 1]);
          parsedLayers.push({ id: `${nodeId}-${subIdx}`, name: `${nodeId.toUpperCase()} (Parte ${subIdx + 1})`, type: "stamp", points, isClosed, length });
        });
      });
      if (!parsedLayers.length) {
        setErrorMsg("Nenhuma linha ou curva válida foi encontrada.");
        return;
      }
      let largestIdx = 0;
      let maxArea = -1;
      parsedLayers.forEach((layer, index) => {
        const box = new THREE.Box2();
        layer.points.forEach(point => box.expandByPoint(point));
        const area = (box.max.x - box.min.x) * (box.max.y - box.min.y);
        if (area > maxArea) { maxArea = area; largestIdx = index; }
      });
      setLayers(parsedLayers.map((layer, index) => ({ ...layer, type: index === largestIdx ? "cutter" : "stamp" })));
      setErrorMsg("");
    } catch (error) {
      console.error(error);
      setErrorMsg("Falha ao analisar o arquivo SVG. Certifique-se de que é um formato válido.");
    }
  };

  useEffect(() => {
    const preset = presets.find(item => item.id === activePresetId);
    if (preset) parseSVGContent(preset.svg);
  }, [activePresetId]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cookie_cutter_projects");
      if (stored) setSavedProjects(JSON.parse(stored));
    } catch (error) {}
  }, []);

  const normalizedLayers = useNormalizedCookieLayers(layers, config.size);
  const outlinePoints = useCookieOutline(normalizedLayers);
  const detailRibbonShapes = useMemo(() => normalizedLayers
    .filter(layer => layer.type === "stamp")
    .map(layer => ({ shape: createRibbonShapeFromPoints(layer.points, config.detailThickness, layer.isClosed), isClosed: layer.isClosed })), [normalizedLayers, config.detailThickness]);

  const handleSvgUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProjectName(file.name.replace(/\.svg$/i, "").toUpperCase());
    setActivePresetId("");
    const reader = new FileReader();
    reader.onload = result => {
      parseSVGContent(result.target?.result as string);
      triggerSuccess("Desenho SVG importado com sucesso!");
    };
    reader.readAsText(file);
  };

  const toggleLayerType = (layerId: string, type: SVGPathLayer["type"]) => {
    setLayers(previous => previous.map(layer => layer.id === layerId ? { ...layer, type } : layer));
  };

  const handleSaveToLibrary = () => {
    if (!layers.length) return;
    const project: SavedProject = {
      id: crypto.randomUUID(), name: projectName || "CORTADOR SEM NOME",
      savedAt: new Date().toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      presetId: activePresetId, config: { ...config }, layers: [...layers],
    };
    const updated = [project, ...savedProjects];
    setSavedProjects(updated);
    localStorage.setItem("cookie_cutter_projects", JSON.stringify(updated));
    triggerSuccess("Cortador salvo na biblioteca com sucesso!");
  };

  const handleDeleteProject = (projectId: string, event: MouseEvent) => {
    event.stopPropagation();
    const updated = savedProjects.filter(project => project.id !== projectId);
    setSavedProjects(updated);
    localStorage.setItem("cookie_cutter_projects", JSON.stringify(updated));
    triggerSuccess("Cortador removido da biblioteca.");
  };

  const handleLoadProject = (project: SavedProject) => {
    setProjectName(project.name);
    setActivePresetId(project.presetId);
    setConfig(project.config);
    setLayers(project.layers);
    triggerSuccess(`Projeto "${project.name}" carregado!`);
  };

  const exportToSTL = (target: "cutter" | "stamp" | "coloring_plate" | "all") => {
    const exportScene = new THREE.Scene();
    const sc = 0.1;
    const buildCutterMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      if (!outlinePoints.length) return meshes;
      const outer = getOffsetPoints(outlinePoints, config.wallThickness / 2);
      const inner = getOffsetPoints(outlinePoints, -config.wallThickness / 2);
      const wallShape = new THREE.Shape();
      wallShape.moveTo(outer[0].x * sc, outer[0].y * sc);
      for (let i = 1; i < outer.length; i++) wallShape.lineTo(outer[i].x * sc, outer[i].y * sc);
      wallShape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(inner[0].x * sc, inner[0].y * sc);
      for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i].x * sc, inner[i].y * sc);
      hole.closePath();
      wallShape.holes.push(hole);
      meshes.push(new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: config.cutterHeight * sc, bevelEnabled: false }), material));
      const brimShape = new THREE.Shape();
      const brim = getOffsetPoints(outlinePoints, config.wallThickness / 2 + config.brimWidth);
      brimShape.moveTo(brim[0].x * sc, brim[0].y * sc);
      for (let i = 1; i < brim.length; i++) brimShape.lineTo(brim[i].x * sc, brim[i].y * sc);
      brimShape.closePath();
      brimShape.holes.push(hole);
      meshes.push(new THREE.Mesh(new THREE.ExtrudeGeometry(brimShape, { depth: config.brimHeight * sc, bevelEnabled: false }), material));
      return meshes;
    };
    const scaledRibbon = (ribbon: THREE.Shape) => {
      const shape = new THREE.Shape();
      shape.moveTo(ribbon.currentPoint.x * sc, ribbon.currentPoint.y * sc);
      ribbon.curves.forEach(curve => { const point = curve.getPoint(1).multiplyScalar(sc); shape.lineTo(point.x, point.y); });
      ribbon.holes.forEach(hole => {
        const scaledHole = new THREE.Path();
        scaledHole.moveTo(hole.currentPoint.x * sc, hole.currentPoint.y * sc);
        hole.curves.forEach(curve => { const point = curve.getPoint(1).multiplyScalar(sc); scaledHole.lineTo(point.x, point.y); });
        shape.holes.push(scaledHole);
      });
      return shape;
    };
    const buildStampMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      if (!outlinePoints.length) return meshes;
      const points = getOffsetPoints(outlinePoints, -(config.wallThickness / 2) - config.clearance);
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x * sc, points[0].y * sc);
      for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x * sc, points[i].y * sc);
      shape.closePath();
      meshes.push(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: config.stampPlateThickness * sc, bevelEnabled: false }), material));
      if (config.addHandle) {
        const height = config.handleHeight * sc;
        const geometry = new THREE.BoxGeometry(2.4, 0.8, height);
        geometry.translate(0, 0, -height / 2);
        meshes.push(new THREE.Mesh(geometry, material));
      }
      detailRibbonShapes.forEach(({ shape: ribbon }) => {
        const geometry = new THREE.ExtrudeGeometry(scaledRibbon(ribbon), { depth: config.detailHeight * sc, bevelEnabled: false });
        geometry.translate(0, 0, config.stampPlateThickness * sc);
        meshes.push(new THREE.Mesh(geometry, material));
      });
      return meshes;
    };
    const buildColoringPlateMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      if (!outlinePoints.length) return meshes;
      const base = new THREE.Shape();
      base.moveTo(outlinePoints[0].x * sc, outlinePoints[0].y * sc);
      for (let i = 1; i < outlinePoints.length; i++) base.lineTo(outlinePoints[i].x * sc, outlinePoints[i].y * sc);
      base.closePath();
      meshes.push(new THREE.Mesh(new THREE.ExtrudeGeometry(base, { depth: config.coloringBaseThickness * sc, bevelEnabled: false }), material));
      try {
        const outline = scaledRibbon(createRibbonShapeFromPoints(outlinePoints, config.coloringLineWidth, true));
        const geometry = new THREE.ExtrudeGeometry(outline, { depth: config.coloringLineHeight * sc, bevelEnabled: false });
        geometry.translate(0, 0, config.coloringBaseThickness * sc);
        meshes.push(new THREE.Mesh(geometry, material));
      } catch (error) {}
      detailRibbonShapes.forEach(({ shape: ribbon }) => {
        try {
          const geometry = new THREE.ExtrudeGeometry(scaledRibbon(ribbon), { depth: config.coloringLineHeight * sc, bevelEnabled: false });
          geometry.translate(0, 0, config.coloringBaseThickness * sc);
          meshes.push(new THREE.Mesh(geometry, material));
        } catch (error) {}
      });
      return meshes;
    };
    if (target === "cutter" || target === "all") {
      const group = new THREE.Group(); group.name = "cutter"; buildCutterMeshes().forEach(mesh => group.add(mesh)); exportScene.add(group);
    }
    if (target === "stamp" || target === "all") {
      const group = new THREE.Group(); group.name = "stamp"; buildStampMeshes().forEach(mesh => group.add(mesh));
      if (target === "all") group.position.x = config.size / 10 + 1.5;
      exportScene.add(group);
    }
    if (target === "coloring_plate") {
      const group = new THREE.Group(); group.name = "coloring_plate"; buildColoringPlateMeshes().forEach(mesh => group.add(mesh)); exportScene.add(group);
    }
    try {
      const output = new STLExporter().parse(exportScene, { binary: true });
      const slug = (projectName || "cortador").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "");
      const fileName = `${slug}_${target}.stl`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([output], { type: "application/octet-stream" }));
      link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      triggerSuccess(`Arquivo STL "${fileName}" gerado com sucesso!`);
    } catch (error) {
      console.error(error);
      setErrorMsg("Erro ao compilar modelo 3D para STL.");
    }
  };

  return {
    activePresetId, setActivePresetId, projectName, setProjectName, successMsg, triggerSuccess,
    errorMsg, activeTab, setActiveTab, config, setConfig, layers, savedProjects, fileInputRef,
    normalizedLayers, outlinePoints, detailRibbonShapes, handleSvgUpload, toggleLayerType,
    handleSaveToLibrary, handleDeleteProject, handleLoadProject, exportToSTL,
  };
}
