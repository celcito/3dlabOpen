import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { loadNameSignFont } from "../useNameSignGenerator";

const BLUEY_TTF_PATH = "public/fonts/Bluey.ttf";

function blueyBuffer(): ArrayBuffer {
  const buf = readFileSync(BLUEY_TTF_PATH);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function stubBluey() {
  const bytes = blueyBuffer();
  vi.stubGlobal("fetch", async (url: string) =>
    String(url) === "/fonts/Bluey.ttf"
      ? new Response(bytes, { status: 200 })
      : new Response(null, { status: 404 })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fonte Bluey no gerador de placas", () => {
  it("carrega /fonts/Bluey.ttf e gera o texto 3D", async () => {
    stubBluey();
    const font = await loadNameSignFont("/fonts/Bluey.ttf");
    const geometry = new TextGeometry("BLUEY", {
      font,
      size: 2,
      depth: 0.4,
      curveSegments: 12,
      bevelEnabled: false,
    });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(geometry.getAttribute("position")?.count ?? 0).toBeGreaterThan(0);
    expect(box.max.x - box.min.x).toBeGreaterThan(0);
    expect(box.max.y - box.min.y).toBeGreaterThan(0);
    expect(box.max.z - box.min.z).toBeCloseTo(0.4, 5);
  });

  it("exporta o texto Bluey no STL binário", async () => {
    stubBluey();
    const font = await loadNameSignFont("/fonts/Bluey.ttf");
    const text = new TextGeometry("BLUEY", {
      font,
      size: 2,
      depth: 0.4,
      curveSegments: 12,
      bevelEnabled: false,
    });
    text.computeBoundingBox();
    const box = text.boundingBox!;
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    text.translate(-width / 2, -height / 2, 0);
    const plate = new THREE.ExtrudeGeometry(
      new THREE.Shape()
        .moveTo(-width, -height)
        .lineTo(width, -height)
        .lineTo(width, height)
        .lineTo(-width, height),
      { depth: 0.3, bevelEnabled: false }
    );
    const merged = BufferGeometryUtils.mergeGeometries([plate, text])!;
    const stl = new STLExporter().parse(new THREE.Mesh(merged), { binary: true }) as DataView;
    const triangles = stl.getUint32(80, true);
    expect(triangles).toBeGreaterThan(0);
    expect(stl.byteLength).toBe(84 + triangles * 50);
  });
});
