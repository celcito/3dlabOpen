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
    size: 1.2,
    thickness: 1.6,
    qrHeight: 1.2,
    padding: 6,
    borderRadius: 2,
    baseColor: "#ffffff",
    qrColor: "#000000",
    labelColor: "#000000",
    includeText: true,
    label: "SCAN ME",
    labelSize: 2.4,
    labelDepth: 0.6,
    labelOffset: 0,
    icon: "none",
    iconSize: 3.2,
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
      const S = 10; // scale: preview → mm

      const round = (v: number) => Math.round(v * 10000) / 10000;

      // THREE.BufferGeometry → 3MF mesh XML string
      const geomTo3mf = (geom: THREE.BufferGeometry) => {
        const pos = geom.getAttribute("position");
        const idx = geom.getIndex();
        let verts = "";
        let tris = "";
        for (let i = 0; i < pos.count; i++) {
          verts += `<vertex x="${round(pos.getX(i) * S)}" y="${round(pos.getY(i) * S)}" z="${round(pos.getZ(i) * S)}"/>`;
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
        return `<mesh><vertices>${verts}</vertices><triangles>${tris}</triangles></mesh>`;
      };

      const hexToArgb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();

      // Collect objects and their material indices
      const objects: { id: number; xml: string; matIndex: number }[] = [];
      let nextId = 2;

      // 1. Plate
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
        steps: 1, depth: t, bevelEnabled: false,
      });
      objects.push({ id: nextId++, xml: geomTo3mf(plateGeom), matIndex: 0 });
      plateGeom.dispose();

      // 2. QR modules
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
      if (qrGeometries.length) {
        const qrMerged = BufferGeometryUtils.mergeGeometries(qrGeometries);
        if (qrMerged) {
          objects.push({ id: nextId++, xml: geomTo3mf(qrMerged), matIndex: 1 });
          qrMerged.dispose();
        }
      }
      qrGeometries.forEach(g => g.dispose());

      // 3. Label (box placeholder)
      if (config.includeText && config.label) {
        const labelW = config.label.length * config.labelSize / 10 * 0.6;
        const labelH = config.labelSize / 10;
        const labelD = config.labelDepth / 10;
        const labelY = -(width / 20 + config.padding / 10 + config.labelSize / 20) - config.labelOffset / 10;
        const labelGeom = new THREE.BoxGeometry(labelW, labelH, labelD);
        labelGeom.translate(0, labelY, t + labelD / 2);
        objects.push({ id: nextId++, xml: geomTo3mf(labelGeom), matIndex: 2 });
        labelGeom.dispose();
      }

      // 4. Icon (box placeholder)
      if (config.icon !== "none") {
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
        objects.push({ id: nextId++, xml: geomTo3mf(iconGeom), matIndex: 2 });
        iconGeom.dispose();
      }

      // Build3MF model XML
      const colors = [
        hexToArgb(config.baseColor),
        hexToArgb(config.qrColor),
        hexToArgb(config.labelColor),
      ];

      const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">3D Lab QR Generator</metadata>
  <resources>
    <basematerials id="1">
      ${colors.map((c, i) => `<base name="Material ${i + 1}" displaycolor="${c}" />`).join("\n      ")}
    </basematerials>
${objects.map(o => `    <object id="${o.id}" type="model">\n      ${o.xml}\n    </object>`).join("\n")}
  </resources>
  <build>
${objects.map(o => `    <item objectid="${o.id}" pid="1" pindex="${o.matIndex}" />`).join("\n")}
  </build>
</model>`;

      // Build ZIP
      const zip = new JSZip();
      zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`);
      zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`);
      zip.file("3D/3dmodel.model", modelXml);

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `qrcode-plate-${Date.now()}.3mf`;
      link.click();
      showNotification("3MF exportado com sucesso!");
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
