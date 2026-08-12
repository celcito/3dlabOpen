import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { parseGLB } from "../glbParser";

function makeGlb(vertices: THREE.BufferGeometry[]): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const scene = new THREE.Scene();
  vertices.forEach((g, i) => {
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: `Mesh ${i}` }));
    mesh.name = `Mesh ${i}`;
    scene.add(mesh);
  });
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result as ArrayBuffer),
      (err) => reject(err),
      { binary: true }
    );
  });
}

const COLORED_CUBE = (() => {
  const g = new THREE.BoxGeometry(2, 2, 2);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) {
    const r = g.attributes.position.getY(i);
    colors[i * 3] = r > 0 ? 1 : 0; // top faces red, bottom black
    colors[i * 3 + 1] = 0;
    colors[i * 3 + 2] = 0;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
})();

describe("parseGLB", () => {
  it("parses geometry and object names", async () => {
    const buf = await makeGlb([new THREE.BoxGeometry(1, 1, 1)]);
    const parsed = await parseGLB(buf);
    expect(parsed.geometry.attributes.position.count).toBeGreaterThan(0);
    expect(parsed.objects.length).toBe(1);
    expect(parsed.objects[0].name).toBe("Mesh_0");
  });

  it("merges multiple meshes into one geometry", async () => {
    const buf = await makeGlb([new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(0.5)]);
    const parsed = await parseGLB(buf);
    expect(parsed.objects.length).toBe(2);
    expect(parsed.geometry.getAttribute("position").count).toBeGreaterThan(24);
  });

  it("preserves vertex colors as suggested color", async () => {
    const buf = await makeGlb([COLORED_CUBE]);
    const parsed = await parseGLB(buf);
    expect(parsed.geometry.getAttribute("color")).toBeDefined();
    expect(parsed.suggestedColors).toBeDefined();
    expect(parsed.suggestedColors!.length).toBeGreaterThan(0);
  });

  it("centers geometry", async () => {
    const buf = await makeGlb([new THREE.BoxGeometry(2, 2, 2)]);
    const parsed = await parseGLB(buf);
    const box = new THREE.Box3().setFromObject(new THREE.Mesh(parsed.geometry));
    const center = box.getCenter(new THREE.Vector3());
    expect(Math.abs(center.x)).toBeLessThan(0.01);
    expect(Math.abs(center.y)).toBeLessThan(0.01);
    expect(Math.abs(center.z)).toBeLessThan(0.01);
  });

  it("throws on GLB with no mesh primitives", async () => {
    // A GLB containing only a camera/light (no meshes) has no primitives.
    const exporter = new GLTFExporter();
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff));
    const buf = await new Promise<ArrayBuffer>((resolve, reject) =>
      exporter.parse(scene, (r) => resolve(r as ArrayBuffer), reject, { binary: true })
    );
    await expect(parseGLB(buf)).rejects.toThrow(/no mesh/);
  });
});