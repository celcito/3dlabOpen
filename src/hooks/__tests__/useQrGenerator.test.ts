import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import JSZip from "jszip";
import { useQrGenerator, wallHoleRadius, type QrSupportModel } from "../useQrGenerator";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Generator = ReturnType<typeof useQrGenerator>;
type Vert = [number, number, number];
interface ParsedObject { verts: Vert[] }

let gen: Generator;

function Probe() {
  gen = useQrGenerator();
  return null;
}

let container: HTMLDivElement;
let root: Root;
let captured: Blob | null;
let originalClick: () => void;

function parseObjects(xml: string): ParsedObject[] {
  const objects: ParsedObject[] = [];
  const objRe = /<object id="\d+"[\s\S]*?<\/object>/g;
  let obj: RegExpExecArray | null;
  while ((obj = objRe.exec(xml))) {
    // regex novo a cada objeto: o flag "g" guarda lastIndex entre chamadas
    const vertRe = /<vertex x="(-?[\d.]+)" y="(-?[\d.]+)" z="(-?[\d.]+)"\/>/g;
    const verts: Vert[] = [];
    let v: RegExpExecArray | null;
    while ((v = vertRe.exec(obj[0]))) verts.push([+v[1], +v[2], +v[3]]);
    objects.push({ verts });
  }
  return objects;
}

function bounds(verts: Vert[]) {
  return verts.reduce(
    (b, [x, y, z]) => ({
      minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x),
      minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y),
      minZ: Math.min(b.minZ, z), maxZ: Math.max(b.maxZ, z),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
}

async function exportModel(support: QrSupportModel) {
  await act(async () => { gen.setConfig(c => ({ ...c, support })); });
  await act(async () => { await gen.handleExportSTL(); });
  expect(captured).not.toBeNull();
  const buffer = await captured!.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("3D/3dmodel.model");
  expect(file).not.toBeNull();
  const xml = await file!.async("string");
  expect(xml, "3MF com coordenadas NaN").not.toContain("NaN");
  return parseObjects(xml);
}

beforeEach(async () => {
  captured = null;
  originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = vi.fn();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn((blob: Blob) => {
    captured = blob;
    return "blob:test";
  });
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(createElement(Probe)); });
  expect(gen.qrMatrix.length).toBeGreaterThan(0);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  HTMLAnchorElement.prototype.click = originalClick;
  vi.restoreAllMocks();
});

describe("QR Generator — modelos de suporte (plaquinhas)", () => {
  it("exporta placa + QR + label sem geometria extra quando não há suporte", async () => {
    const { width, height } = gen.plateDimensions;
    const objects = await exportModel("flat");

    expect(objects).toHaveLength(3);
    expect(gen.previewGeometry.shape.holes).toHaveLength(0);

    const plate = bounds(objects[0].verts);
    expect(plate.minY).toBeCloseTo(-height / 2, 3);
    expect(plate.maxY).toBeCloseTo(height / 2, 3);
    expect(plate.minZ).toBeCloseTo(0, 3);
    expect(plate.maxZ).toBeCloseTo(gen.config.thickness, 3);
    expect(plate.maxX).toBeCloseTo(width / 2, 3);
  });

  it("base de mesa: pé em T acoplado à placa", async () => {
    const { height } = gen.plateDimensions;
    const objects = await exportModel("desk");

    expect(objects).toHaveLength(3); // pé vai dentro do objeto da placa
    expect(gen.supportParts.attached).toHaveLength(1);
    expect(gen.supportParts.separate).toHaveLength(0);

    const plate = bounds(objects[0].verts);
    expect(plate.minY).toBeLessThan(-height / 2 - 1);   // pé desce abaixo da placa
    expect(plate.minZ).toBeLessThan(-1);                // pé tem profundidade na Z
    expect(plate.maxZ).toBeGreaterThan(gen.config.thickness + 1);
  });

  it("encaixe: placa com tenon + base independente com fenda", async () => {
    const { height } = gen.plateDimensions;
    const objects = await exportModel("slot");

    expect(objects).toHaveLength(4); // placa, QR, label + base
    expect(gen.supportParts.attached).toHaveLength(1);
    expect(gen.supportParts.separate).toHaveLength(1);

    const plate = bounds(objects[0].verts);
    expect(plate.minY).toBeCloseTo(-height / 2 - 8, 3); // tenon de 8mm

    const base = bounds(objects[3].verts);
    expect(base.maxY).toBeCloseTo(-height / 2, 3);      // base encosta na placa
    expect(base.maxY - base.minY).toBeCloseTo(10, 3);   // altura de 10mm
    expect(base.maxZ - base.minZ).toBeGreaterThan(20);  // profundidade de apoio
    expect(objects[3].verts.length).toBeGreaterThan(8); // perfil U (fenda)
  });

  it("cavalete: barra traseira + perna retrátil articulada", async () => {
    const { height } = gen.plateDimensions;
    const objects = await exportModel("easel");

    expect(objects).toHaveLength(4);                       // placa, QR, label + perna
    expect(gen.supportParts.attached).toHaveLength(3);     // barra + 2 coxins
    expect(gen.supportParts.separate).toHaveLength(1);

    const rodY = height / 2 - Math.min(Math.max(height * 0.28, 8), 18);
    const rodZ = -5;
    const rodR = 2;

    // a barra de eixo sai para trás da placa (não é só o coxim)
    expect(objects[0].verts.some(([, , z]) => z < rodZ - rodR + 0.1)).toBe(true);

    const leg = objects[3];
    expect(leg.verts.every(([, , z]) => z < 0)).toBe(true);      // toda atrás da placa
    expect(Math.min(...leg.verts.map(([, y]) => y))).toBeLessThan(-height / 2); // alcança a mesa

    // gancho em C em torno da barra: a distância ao eixo não muda com a rotação
    const dists = leg.verts.map(([, y, z]) => Math.hypot(y - rodY, z - rodZ));
    expect(Math.min(...dists)).toBeGreaterThan(rodR);             // não atravessa a barra
    expect(dists.some(d => Math.abs(d - 2.2) < 0.05)).toBe(true); // raio interno (folga)
    expect(dists.some(d => Math.abs(d - 4.2) < 0.05)).toBe(true); // raio externo (parede)
  });

  it("parede: dois furos de parafuso fora da área do QR", async () => {
    const { width, height } = gen.plateDimensions;
    const objects = await exportModel("wall");

    expect(objects).toHaveLength(3);
    expect(gen.previewGeometry.shape.holes).toHaveLength(2);

    const hr = wallHoleRadius(width);
    const margin = hr + 2;
    const cy = height / 2 - margin;
    for (const cx of [-(width / 2 - margin), width / 2 - margin]) {
      const onHole = objects[0].verts.some(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - hr) < 0.05);
      expect(onHole, `furo em (${cx}, ${cy}) ausente`).toBe(true);
    }
    // furos são internos: o contorno externo continua igual
    const plate = bounds(objects[0].verts);
    expect(plate.maxY).toBeCloseTo(height / 2, 3);
    expect(plate.maxX).toBeCloseTo(width / 2, 3);
  });

  it("pendurado: ilhós com furo acima da placa", async () => {
    const { width, height } = gen.plateDimensions;
    const objects = await exportModel("hang");

    expect(objects).toHaveLength(3);
    expect(gen.supportParts.attached).toHaveLength(1);

    const tabR = Math.min(Math.max(width * 0.12, 6), 14);
    const holeR = Math.min(Math.max((tabR / 10) * 0.4, 0.2), 0.45) * 10;
    const cy = height / 2 + (tabR / 10) * 0.6 * 10;

    const plate = bounds(objects[0].verts);
    expect(plate.maxY).toBeGreaterThan(height / 2 + tabR); // topo do ilhós

    const onHole = objects[0].verts.some(([x, y]) => Math.abs(Math.hypot(x, y - cy) - holeR) < 0.05);
    expect(onHole, "furo do ilhós ausente").toBe(true);
    expect(cy - holeR).toBeGreaterThan(height / 2); // furo não invade a placa
  });

  it("logomarca SVG: relevo real no slot do ícone", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 H90 V90 H10 Z" fill="#000000"/></svg>';
    await act(async () => { gen.setConfig(c => ({ ...c, icon: "logo", logoSvg: svg, iconSize: 6 })); });

    const { height } = gen.plateDimensions;
    const objects = await exportModel("flat");

    expect(objects).toHaveLength(4); // placa, QR, label + logomarca

    const logo = bounds(objects[3].verts);
    expect(logo.maxX - logo.minX).toBeCloseTo(6, 1);   // normalizada para iconSize
    expect(logo.maxY - logo.minY).toBeCloseTo(6, 1);
    expect(logo.minZ).toBeCloseTo(gen.config.thickness + gen.config.labelDepth / 2, 3); // sobre a placa
    expect(logo.maxZ - logo.minZ).toBeCloseTo(0.5, 2);  // relevo de 0,5mm
    expect(logo.minX).toBeGreaterThan(0);                // lado direito, linha do texto
    expect(logo.maxY).toBeLessThan(height / 2);          // fora da área do QR
  });
});
