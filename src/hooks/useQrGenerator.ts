import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import JSZip from "jszip";
import QRCode from "qrcode";
import { toastExportError } from "@/lib/toast";
import { svgToExtrudedGeometry } from "../lib/svgToShapes";

export type QrSupportModel = "flat" | "desk" | "slot" | "easel" | "wall" | "hang";

export interface SupportParts {
  /** Geometrias acopladas à placa (viram a mesma peça na exportação). */
  attached: THREE.BufferGeometry[];
  /** Peças independentes (ex.: base com encaixe). */
  separate: THREE.BufferGeometry[];
}

/** Profundidade do relevo da logomarca em unidades de cena (0.05 = 0,5mm). */
export const LOGO_DEPTH = 0.05;

/** Raio do furo de parede em mm, escalado pela largura da placa (1.5–2.5mm). */
export function wallHoleRadius(widthMm: number) {
  return Math.min(Math.max(widthMm * 0.025, 1.5), 2.5);
}

function roundedRectShape(w: number, h: number, radius: number): THREE.Shape {
  const r = Math.min(radius, Math.min(w, h) / 2);
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
  return shape;
}

/** Furos de parafuso nos cantos superiores (suporte "wall"). */
function addWallHoles(shape: THREE.Shape, w: number, h: number, widthMm: number) {
  const hr = wallHoleRadius(widthMm) / 10;
  const margin = hr + 0.2; // 2mm de material além do furo
  const cx = w / 2 - margin;
  const cy = h / 2 - margin;
  if (cx <= hr || cy <= hr) return;
  for (const x of [-cx, cx]) {
    const hole = new THREE.Path();
    hole.absarc(x, cy, hr, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
}

/** Constrói a geometria do suporte escolhido. Todas as medidas em unidades de cena (mm/10). */
function buildSupportParts(config: QrConfig, dims: { width: number; height: number }): SupportParts {
  const parts: SupportParts = { attached: [], separate: [] };
  if (!dims.width) return parts;
  if (config.support !== "desk" && config.support !== "slot" && config.support !== "easel" && config.support !== "hang") return parts;

  const W = dims.width / 10;
  const H = dims.height / 10;
  const t = config.thickness / 10;
  const bottom = -H / 2;
  const baseDepth = Math.min(Math.max(dims.width * 0.55, 25), 60) / 10;

  if (config.support === "desk") {
    // Pé em T sob a placa: imprime na mesma orientação da placa.
    const footH = Math.max(dims.height * 0.08, 6) / 10;
    const foot = new THREE.BoxGeometry(W * 0.9, footH, baseDepth);
    foot.translate(0, bottom - footH / 2, t / 2);
    parts.attached.push(foot);
    return parts;
  }

  if (config.support === "slot") {
    // Tenon sob a placa + base separada com fenda (2 peças).
    const tenonH = 0.8; // 8mm
    const tenonW = W * 0.5;
    const tenon = new THREE.BoxGeometry(tenonW, tenonH, t * 0.6);
    tenon.translate(0, bottom - tenonH / 2, t * 0.2);
    parts.attached.push(tenon);

    const baseH = 1; // 10mm
    const notchW = tenonW + 0.06; // folga de 0.3mm por lado
    const notchD = 0.9;
    const bw = W / 2;
    const nb = notchW / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-bw, 0);
    shape.lineTo(bw, 0);
    shape.lineTo(bw, baseH);
    shape.lineTo(nb, baseH);
    shape.lineTo(nb, baseH - notchD);
    shape.lineTo(-nb, baseH - notchD);
    shape.lineTo(-nb, baseH);
    shape.lineTo(-bw, baseH);
    shape.closePath();
    const base = new THREE.ExtrudeGeometry(shape, { depth: baseDepth, bevelEnabled: false, steps: 1 });
    base.translate(0, bottom - baseH, t / 2 - baseDepth / 2);
    parts.separate.push(base);
    return parts;
  }

  if (config.support === "easel") {
    // Cavalete retrátil: barra de eixo na traseira (acoplada à placa) + perna
    // com gancho em C que se clica sobre a barra e gira sem parafuso.
    const rodR = 0.2;                                              // barra Ø4mm
    const rodZ = -0.5;                                             // eixo 5mm atrás da placa
    const rodY = H / 2 - Math.min(Math.max(H * 0.28, 0.8), 1.8);  // ~18mm abaixo do topo
    const hookW = 0.8;                                             // perna com 8mm (X)
    const rodHalf = Math.min(Math.max(W * 0.3, 1.05), W / 2 - 0.1);

    const rod = new THREE.CylinderGeometry(rodR, rodR, rodHalf * 2, 20);
    rod.rotateZ(Math.PI / 2);
    rod.translate(0, rodY, rodZ);
    parts.attached.push(rod);

    const postW = 0.6, postH = 0.6, postD = 0.55;
    for (const sx of [-1, 1]) {
      const post = new THREE.BoxGeometry(postW, postH, postD);
      post.translate(sx * (rodHalf - postW / 2), rodY, -postD / 2 + 0.05);
      parts.attached.push(post);
    }

    const rI = rodR + 0.02;                                       // folga de 0,2mm
    const rO = rI + 0.2;                                          // parede de 2mm
    const beta = Math.asin(0.36 / (2 * rI));                      // abertura 3,6mm: clica na barra Ø4
    const t1 = Math.PI / 2 + beta;
    const t2 = Math.PI / 2 - beta + Math.PI * 2;
    const hookShape = new THREE.Shape();
    hookShape.absarc(0, 0, rO, t1, t2, false);
    hookShape.absarc(0, 0, rI, t2, t1, true);
    hookShape.closePath();

    // Perfil no plano (Y,Z), extrudado ao longo de X.
    const hookGeo = new THREE.ExtrudeGeometry(hookShape, { depth: hookW, bevelEnabled: false, steps: 1 });
    hookGeo.translate(0, 0, -hookW / 2);
    hookGeo.applyMatrix4(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 1, 0), // x local → eixo Y do modelo
        new THREE.Vector3(0, 0, 1), // y local → eixo Z do modelo
        new THREE.Vector3(1, 0, 0)  // z local (extrusão) → eixo X do modelo
      )
    );
    hookGeo.translate(0, rodY, rodZ);

    const legLen = rodY + H / 2 + 0.6;                            // chega 6mm abaixo da placa
    const bodyTop = rodY - rI - 0.02;
    const bodyGeo = new THREE.BoxGeometry(hookW, bodyTop - (rodY - legLen), 0.3);
    bodyGeo.translate(0, (bodyTop + rodY - legLen) / 2, rodZ);
    const bodyNI = bodyGeo.toNonIndexed();
    const legMerged = BufferGeometryUtils.mergeGeometries([hookGeo, bodyNI]);
    bodyGeo.dispose();
    bodyNI.dispose();
    if (legMerged) hookGeo.dispose();
    const leg = legMerged ?? hookGeo;

    // Aberta a 25°, girada em torno da própria barra.
    const open = THREE.MathUtils.degToRad(25);
    leg.applyMatrix4(
      new THREE.Matrix4()
        .makeTranslation(0, rodY, rodZ)
        .multiply(new THREE.Matrix4().makeRotationX(open))
        .multiply(new THREE.Matrix4().makeTranslation(0, -rodY, -rodZ))
    );
    parts.separate.push(leg);
    return parts;
  }

  // hang: ilhós no topo para prego ou cordão
  const tabR = Math.min(Math.max(dims.width * 0.12, 6), 14) / 10;
  const holeR = Math.min(Math.max(tabR * 0.4, 0.2), 0.45);
  const tab = new THREE.Shape();
  tab.absarc(0, 0, tabR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  tab.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(tab, { depth: t, bevelEnabled: false, steps: 1 });
  geom.translate(0, H / 2 + tabR * 0.6, 0);
  parts.attached.push(geom);
  return parts;
}

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
  /** SVG bruto enviado pelo usuário como logomarca (null = sem logo). */
  logoSvg: string | null;
  support: QrSupportModel;
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
    logoSvg: null,
    support: "flat",
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
    const shape = roundedRectShape(w, h, config.borderRadius / 10);
    if (config.support === "wall") addWallHoles(shape, w, h, width);
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
  }, [plateDimensions, config.borderRadius, config.thickness, config.support]);

  const supportParts = useMemo(
    () => buildSupportParts(config, plateDimensions),
    [config.support, config.thickness, plateDimensions]
  );

  useEffect(() => () => {
    supportParts.attached.forEach(g => g.dispose());
    supportParts.separate.forEach(g => g.dispose());
  }, [supportParts]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const handleExportSTL = async () => {
    if (!qrMatrix.length) return;
    try {
      const { width } = plateDimensions;
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

      // 1. Plate (+ suporte acoplado: pé, tenon ou ilhós)
      const plateShape = previewGeometry.shape;
      let plateGeom: THREE.BufferGeometry = new THREE.ExtrudeGeometry(plateShape, {
        steps: 1, depth: t, bevelEnabled: false,
      });
      if (supportParts.attached.length) {
        const pieces = supportParts.attached.map(g => (g.index ? g.toNonIndexed() : g));
        const merged = BufferGeometryUtils.mergeGeometries([plateGeom, ...pieces]);
        if (merged) {
          plateGeom.dispose();
          plateGeom = merged;
        }
        pieces.forEach((g, i) => { if (g !== supportParts.attached[i]) g.dispose(); });
      }
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

      // 4. Ícone (box placeholder) ou logomarca SVG enviada (relevo real, não placeholder)
      if (config.icon !== "none") {
        const iconS = config.iconSize / 10;
        const labelHalfW = config.includeText ? config.label.length * config.labelSize / 20 : 0;
        const iconX = !config.includeText ? 0
          : config.iconPosition === "left"
            ? -(labelHalfW + iconS / 2 + 0.3)
            : (labelHalfW + iconS / 2 + 0.3);
        const labelY = -(width / 20 + config.padding / 10 + config.labelSize / 20) - config.labelOffset / 10;
        const iconZ = config.includeText ? t + config.labelDepth / 20 : t + qh / 2 + 0.05;
        const logoGeom = config.icon === "logo" && config.logoSvg
          ? svgToExtrudedGeometry(config.logoSvg, { depth: LOGO_DEPTH, targetSize: iconS, bevelEnabled: false })
          : null;
        if (logoGeom) {
          logoGeom.translate(iconX, labelY, iconZ);
          objects.push({ id: nextId++, xml: geomTo3mf(logoGeom), matIndex: 2 });
          logoGeom.dispose();
        } else if (config.icon !== "logo") {
          const iconGeom = new THREE.BoxGeometry(iconS, iconS, 0.05);
          iconGeom.translate(iconX, labelY, iconZ);
          objects.push({ id: nextId++, xml: geomTo3mf(iconGeom), matIndex: 2 });
          iconGeom.dispose();
        }
      }

      // 5. Suporte independente (base com encaixe)
      supportParts.separate.forEach(geom => {
        objects.push({ id: nextId++, xml: geomTo3mf(geom), matIndex: 0 });
      });

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
    supportParts,
    handleExportSTL,
  };
}
