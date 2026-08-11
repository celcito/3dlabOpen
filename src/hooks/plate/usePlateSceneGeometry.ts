import { useMemo } from "react";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

export function useTextGeometry(content: string, size: number, depth: number, font: Font) {
  return useMemo(() => new TextGeometry(content, {
    font, size: size / 10, depth: depth / 10, curveSegments: 12,
    bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.015, bevelSegments: 3,
  }), [content, size, depth, font]);
}

export function usePlateSceneGeometry<T>(
  config: any,
  layers: T[],
  showWireframe: boolean,
  getBaseShape: (config: any, layers?: T[]) => THREE.Shape,
) {
  const plateBaseShape = useMemo(() => getBaseShape(config, layers), [config, layers, getBaseShape]);
  const extrudeSettings = useMemo(() => ({
    steps: 1, depth: config.thickness / 10, bevelEnabled: true,
    bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3,
  }), [config.thickness]);
  const materialProps = useMemo(() => {
    const base = { color: config.color, roughness: 0.4, metalness: 0.1, wireframe: showWireframe };
    if (config.materialFinish === "glossy") Object.assign(base, { roughness: 0.1, metalness: 0.3 });
    if (config.materialFinish === "matte") Object.assign(base, { roughness: 0.8, metalness: 0 });
    if (config.materialFinish === "textured") Object.assign(base, { roughness: 0.9, metalness: 0.05 });
    if (config.materialFinish === "wood") Object.assign(base, { color: "#8B5A2B", roughness: 0.7 });
    if (config.materialFinish === "carbon") Object.assign(base, { color: "#151515", roughness: 0.3, metalness: 0.8 });
    return base;
  }, [config.color, config.materialFinish, showWireframe]);
  return { plateBaseShape, extrudeSettings, materialProps };
}
