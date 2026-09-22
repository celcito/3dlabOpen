import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import QRCode from "qrcode";
import { toastExportError } from "@/lib/toast";

export interface QrConfig {
  text: string;
  size: number;
  thickness: number;
  qrHeight: number;
  padding: number;
  borderRadius: number;
  baseColor: string;
  qrColor: string;
  labelColor: string;
  includeText: boolean;
  label: string;
  labelSize: number;
  labelDepth: number;
  labelOffset: number;
  icon: string;
  iconSize: number;
  iconPosition: string;
}

export function useQrGenerator() {
  const [config, setConfig] = useState<QrConfig>({
    text: "@m2crstudio",
    size: 3,
    thickness: 4,
    qrHeight: 3,
    padding: 15,
    borderRadius: 5,
    baseColor: "#ffffff",
    qrColor: "#000000",
    labelColor: "#000000",
    includeText: true,
    label: "SCAN ME",
    labelSize: 6,
    labelDepth: 1.5,
    labelOffset: 0,
    icon: "none",
    iconSize: 8,
    iconPosition: "below",
  });

  const [qrMatrix, setQrMatrix] = useState<number[][]>([]);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!config.text) {
      setQrMatrix([]);
      return;
    }
    try {
      const matrix = QRCode.create(config.text, { errorCorrectionLevel: "M" });
      const result: number[][] = [];
      for (let y = 0; y < matrix.modules.size; y++) {
        const row: number[] = [];
        for (let x = 0; x < matrix.modules.size; x++) {
          row.push(matrix.modules.get(x, y) ? 1 : 0);
        }
        result.push(row);
      }
      setQrMatrix(result);
    } catch (err) {
      console.error("QR Generation failed:", err);
    }
  }, [config.text]);

  const plateDimensions = useMemo(() => {
    if (!qrMatrix.length) return { width: 0, height: 0 };
    const qrDim = qrMatrix.length * config.size;
    const totalDim = qrDim + config.padding * 2;
    const labelExtra = config.includeText ? config.labelSize * 2 : 0;
    return { width: totalDim, height: totalDim + labelExtra, qrDim };
  }, [qrMatrix, config.size, config.padding, config.includeText, config.labelSize]);

  const previewGeometry = useMemo(() => {
    const { width, height } = plateDimensions;
    if (!width) return { shape: new THREE.Shape(), extrudeSettings: {} as THREE.ExtrudeGeometryOptions };
    const w = width / 10;
    const h = height / 10;
    const maxR = Math.min(w, h) / 2;
    const r = Math.min(config.borderRadius / 10, maxR);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return {
      shape,
      extrudeSettings: {
        steps: 1,
        depth: config.thickness / 10,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 3,
      },
    };
  }, [plateDimensions, config.borderRadius, config.thickness]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const handleExportSTL = () => {
    if (!qrMatrix.length) return;
    try {
      const { width, height } = plateDimensions;
      const w = width / 10;
      const h = height / 10;
      const maxR = Math.min(w, h) / 2;
      const r = Math.min(config.borderRadius / 10, maxR);
      const t = config.thickness / 10;
      const qh = config.qrHeight / 10;
      const module = config.size / 10;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

      const group = new THREE.Group();
      group.add(
        new THREE.Mesh(
          new THREE.ExtrudeGeometry(shape, {
            steps: 1,
            depth: t,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 3,
          })
        )
      );

      const geometries: THREE.BoxGeometry[] = [];
      const offset = -(qrMatrix.length * module) / 2;
      const yShift = config.includeText ? config.labelSize / 10 : 0;
      qrMatrix.forEach((row, y) =>
        row.forEach((active, x) => {
          if (active) {
            const box = new THREE.BoxGeometry(module, module, qh);
            box.translate(
              offset + x * module + module / 2,
              -(offset + y * module + module / 2) + yShift,
              t + qh / 2
            );
            geometries.push(box);
          }
        })
      );
      if (geometries.length) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        if (merged) {
          group.add(new THREE.Mesh(merged));
        }
      }

      // Scale 10x: preview units (1=10mm) → STL mm
      group.scale.setScalar(10);

      const result = new STLExporter().parse(group, { binary: true });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([result], { type: "application/octet-stream" })
      );
      link.download = `qrcode-plate-${Date.now()}.stl`;
      link.click();
      showNotification("STL exportado com sucesso!");
    } catch (err) {
      console.error("Export failed:", err);
      toastExportError();
    }
  };

  return {
    config,
    setConfig,
    qrMatrix,
    successMsg,
    plateDimensions,
    previewGeometry,
    handleExportSTL,
  };
}
