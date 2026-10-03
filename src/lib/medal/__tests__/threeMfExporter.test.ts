import { unzipSync } from "fflate";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { exportMedal3MF, type Medal3MFItem } from "../threeMfExporter";

function makeItems(count: number): Medal3MFItem[] {
  const colors = ["#1A1A1A", "#E2A829", "#E2A829"];
  const names = ["1_Base_da_Medalha", "2_Borda_e_Relevo", "3_Passador_de_Fita"];
  return Array.from({ length: count }, (_, i) => ({
    geom: new THREE.BoxGeometry(10, 10, 3),
    color: colors[i],
    name: names[i],
  }));
}

async function exportAndRead(items: Medal3MFItem[]): Promise<Record<string, Uint8Array>> {
  const blob = await exportMedal3MF(items, "Medalha_teste");
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

describe("exportMedal3MF — pacote", () => {
  it("gera um ZIP íntegro com as 3 entradas obrigatórias", async () => {
    const output = await exportAndRead(makeItems(3));
    expect(Object.keys(output).sort()).toEqual(["3D/3dmodel.model", "[Content_Types].xml", "_rels/.rels"]);
    for (const name of Object.keys(output)) {
      expect(output[name].length).toBeGreaterThan(0);
    }
  });

  it("todos os documentos têm exatamente uma declaração XML", async () => {
    const output = await exportAndRead(makeItems(3));
    for (const name of Object.keys(output)) {
      const xml = new TextDecoder().decode(output[name]);
      expect(xml.match(/<\?xml/g)?.length ?? 0).toBe(1);
    }
  });
});

describe("exportMedal3MF — modelo", () => {
  it("declara 3 objetos, 3 cores e 3 build items", async () => {
    const output = await exportAndRead(makeItems(3));
    const xml = new TextDecoder().decode(output["3D/3dmodel.model"]);

    expect(xml.match(/<m:color /g)?.length).toBe(3);
    expect(xml.match(/<object /g)?.length).toBe(3);
    expect(xml.match(/<item /g)?.length).toBe(3);

    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();

    const names = Array.from(doc.getElementsByTagName("object")).map((o) => o.getAttribute("name"));
    expect(names).toEqual(["1_Base_da_Medalha", "2_Borda_e_Relevo", "3_Passador_de_Fita"]);
  });

  it("omite o passador quando a medalha não tem alça (2 objetos)", async () => {
    const output = await exportAndRead(makeItems(2));
    const xml = new TextDecoder().decode(output["3D/3dmodel.model"]);

    expect(xml.match(/<m:color /g)?.length).toBe(2);
    expect(xml.match(/<object /g)?.length).toBe(2);
    expect(xml.match(/<item /g)?.length).toBe(2);

    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    const objectIds = Array.from(doc.getElementsByTagName("object")).map((o) => o.getAttribute("id"));
    expect(objectIds).toEqual(["2", "3"]);
  });

  it("todas as referências de triângulo estão dentro da faixa de vértices", async () => {
    const output = await exportAndRead(makeItems(3));
    const xml = new TextDecoder().decode(output["3D/3dmodel.model"]);
    const doc = new DOMParser().parseFromString(xml, "application/xml");

    const objects = Array.from(doc.getElementsByTagName("object"));
    expect(objects.length).toBe(3);

    for (const object of objects) {
      const vertices = object.getElementsByTagName("vertex").length;
      const triangles = Array.from(object.getElementsByTagName("triangle"));
      expect(vertices).toBeGreaterThan(0);
      expect(triangles.length).toBeGreaterThan(0);
      for (const triangle of triangles) {
        for (const attr of ["v1", "v2", "v3"]) {
          const index = Number(triangle.getAttribute(attr));
          expect(Number.isInteger(index)).toBe(true);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(vertices);
        }
      }
    }
  });

  it("deduplica vértices compartilhados (menos vértices que 36 num box)", async () => {
    const output = await exportAndRead([{ geom: new THREE.BoxGeometry(10, 10, 3), color: "#1A1A1A", name: "1_Base" }]);
    const xml = new TextDecoder().decode(output["3D/3dmodel.model"]);
    const doc = new DOMParser().parseFromString(xml, "application/xml");

    const vertices = doc.getElementsByTagName("vertex").length;
    const triangles = doc.getElementsByTagName("triangle").length;
    expect(triangles).toBe(12);
    expect(vertices).toBeLessThanOrEqual(24);
    expect(vertices).toBeGreaterThanOrEqual(8);
  });
});
