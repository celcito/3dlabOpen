import { useMemo, useState } from "react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { toastExportError } from "@/lib/toast";

export interface VaseConfig {
  height: number;
  baseRadius: number;
  midRadius: number;
  topRadius: number;
  midPosition: number;
  twist: number;
  sides: number;
  waves: number;
  waveIntensity: number;
  baseThickness: number;
  wallThickness: number;
  baseColor: string;
}

export function useVaseGenerator(createGeometry: (config: VaseConfig) => THREE.BufferGeometry) {
  const [config, setConfig] = useState<VaseConfig>({ height: 120, baseRadius: 30, midRadius: 45, topRadius: 25, midPosition: 0.5, twist: 45, sides: 32, waves: 0, waveIntensity: 2, baseThickness: 2, wallThickness: 2, baseColor: "#e0e0e0" });
  const [successMsg, setSuccessMsg] = useState("");
  const geometry = useMemo(() => createGeometry(config), [config, createGeometry]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const handleExportSTL = () => {
    try {
      const mesh = new THREE.Mesh(createGeometry(config));
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrixWorld();
      const result = new STLExporter().parse(mesh, { binary: true });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([result], { type: "application/octet-stream" }));
      link.download = `custom-vase-${Date.now()}.stl`;
      link.click();
      showNotification("Vaso exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toastExportError();
    }
  };

  return { config, setConfig, geometry, successMsg, handleExportSTL };
}
