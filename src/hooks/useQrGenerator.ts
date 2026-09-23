import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import JSZip from "jszip";
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

  const handleExportSTL = async () => {
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

      // Scale factor: preview units → mm
      const S = 10;

      // Helper: THREE.BufferGeometry → 3MF mesh XML
      const geomTo3mf = (geom: THREE.BufferGeometry, scale: number) => {
        const pos = geom.getAttribute("position");
        const idx = geom.getIndex();
        let verts = "";
        let tris = "";
        for (let i = 0; i < pos.count; i++) {
          verts += `<vertex x="${pos.getX(i) * scale}" y="${pos.getY(i) * scale}" z="${pos.getZ(i) * scale}"/>`;
        }
        if (idx) {
          for (let i = 0; i < idx.count; i += 3) {
            tris += `<triangle v1="${idx.getX(i)}" v2="${idx.getX(i + 1)}" v3="${idx.getX(i + 2)}"/>`;
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            tris += `<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`;
          }
        }
        return `<vertices>${verts}</vertices><triangles>${tris}</triangles>`;
      };

      // Helper: hex color → ARGB string for3MF
      const hexToArgb = (hex: string) => {
        const c = hex.replace("#", "");
        return "FF" + c.toUpperCase();
      };

      // 1. Plate geometry
      const plateShape = new THREE.Shape();
      plateShape.moveTo(-w / 2 + r, -h / 2);
      plateShape.lineTo(w / 2 - r, -h / 2);
      plateShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      plateShape.lineTo(w / 2, h / 2 - r);
      plateShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      plateShape.lineTo(-w / 2 + r, h / 2);
      plateShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      plateShape.lineTo(-w / 2, -h / 2 + r);
      plateShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

      const plateGeom = new THREE.ExtrudeGeometry(plateShape, {
        steps: 1, depth: t, bevelEnabled: true,
        bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3,
      });

      // 2. QR modules geometry (merged)
      const qrGeometries: THREE.BoxGeometry[] = [];
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
            qrGeometries.push(box);
          }
        })
      );
      const qrMerged = qrGeometries.length
        ? BufferGeometryUtils.mergeGeometries(qrGeometries)
        : null;

      // 3. Label geometry (if text enabled)
      let labelMeshXml = "";
      if (config.includeText && config.label) {
        // We'll export label as a simple box placeholder since font loading is async
        // The actual label geometry comes from the scene — we rebuild it here
        const labelW = config.label.length * config.labelSize / 10 * 0.6;
        const labelH = config.labelSize / 10;
        const labelD = config.labelDepth / 10;
        const labelY = -(width / 20 + config.padding / 10 + config.labelSize / 20) - config.labelOffset / 10;
        const labelZ = t + labelD / 2;
        const labelGeom = new THREE.BoxGeometry(labelW, labelH, labelD);
        labelGeom.translate(0, labelY, labelZ);
        labelMeshXml = `<object id="4" type="model"><mesh>${geomTo3mf(labelGeom, S)}</mesh></object>`;
        labelGeom.dispose();
      }

      // 4. Icon geometry (if selected)
      let iconMeshXml = "";
      if (config.icon !== "none") {
        // Icon placeholder as box
        const iconS = config.iconSize / 10;
        const labelHalfW = config.includeText ? config.label.length * config.labelSize / 20 : 0;
        const iconX = !config.includeText ? 0
          : config.iconPosition === "left"
            ? -(labelHalfW + iconS / 2 + 0.3)
            : (labelHalfW + iconS / 2 + 0.3);
        const labelY = -(width / 20 + config.padding / 10 + config.labelSize / 20) - config.labelOffset / 10;
        const iconZ = config.includeText ? t + config.labelDepth / 20 : t + qh / 2 + 0.05;
        const iconGeom = new THREE.BoxGeometry(iconS, iconS, 0.05);
        iconGeom.translate(iconX, labelY, iconZ);
        iconMeshXml = `<object id="5" type="model"><mesh>${geomTo3mf(iconGeom, S)}</mesh></object>`;
        iconGeom.dispose();
      }

      // Build 3MF XML
      const baseColor = hexToArgb(config.baseColor);
      const qrColor = hexToArgb(config.qrColor);
      const labelColor = hexToArgb(config.labelColor);

      const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">3D Lab QR Generator</metadata>
  <resources>
    <basematerials id="1">
      <base name="Plate" displaycolor="${baseColor}" />
      <base name="QR Code" displaycolor="${qrColor}" />
      <base name="Label" displaycolor="${labelColor}" />
    </basematerials>
    <object id="2" type="model">
      <mesh>${geomTo3mf(plateGeom, S)}</mesh>
    </object>
    <object id="3" type="model">
      <mesh>${qrMerged ? geomTo3mf(qrMerged, S) : "<vertices></vertices><triangles></triangles>"}</mesh>
    </object>
    ${labelMeshXml}
    ${iconMeshXml}
  </resources>
  <build>
    <item objectid="2" pid="1" pindex="0" />
    <item objectid="3" pid="1" pindex="1" />
    ${config.includeText && config.label ? '<item objectid="4" pid="1" pindex="2" />' : ""}
    ${config.icon !== "none" ? '<item objectid="5" pid="1" pindex="2" />' : ""}
  </build>
</model>`;

      // Build 3MF ZIP
      const zip = new JSZip();
      zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`);
      zip.file("[Metadata]/_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`);
      zip.file("3D/3dmodel.model", modelXml);

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `qrcode-plate-${Date.now()}.3mf`;
      link.click();
      showNotification("3MF exportado com cores e objetos separados!");
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
