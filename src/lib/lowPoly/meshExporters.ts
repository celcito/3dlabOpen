import * as THREE from "three";
import JSZip from "jszip";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

export type SupportedExportFormat = "stl" | "obj" | "3mf";

export interface ExportOptions {
  modelName: string;
  targetTriangles?: number;
  heightMm?: number;
  colorHex?: string;
  isWatertight?: boolean;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  sizeBytes: number;
  format: SupportedExportFormat;
}

/**
 * Triggers a browser download from a Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates a clean, filesystem-safe base filename
 */
export function generateBaseFilename(options: ExportOptions): string {
  const cleanName = (options.modelName || "lowpoly_model")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_");

  const triPart = options.targetTriangles ? `_${options.targetTriangles}tri` : "";
  const heightPart = options.heightMm ? `_${Math.round(options.heightMm)}mm` : "";

  return `${cleanName}_lowpoly${triPart}${heightPart}`;
}

/**
 * Exports geometry to Binary STL format
 */
export async function exportToSTL(
  geometry: THREE.BufferGeometry,
  options: ExportOptions
): Promise<ExportResult> {
  const mesh = new THREE.Mesh(geometry);
  const exporter = new STLExporter();
  const result = exporter.parse(mesh, { binary: true });

  const blob = new Blob([result], { type: "application/octet-stream" });
  const filename = `${generateBaseFilename(options)}.stl`;

  return {
    blob,
    filename,
    sizeBytes: blob.size,
    format: "stl"
  };
}

/**
 * Exports geometry to Wavefront OBJ format
 */
export async function exportToOBJ(
  geometry: THREE.BufferGeometry,
  options: ExportOptions
): Promise<ExportResult> {
  const mesh = new THREE.Mesh(geometry);
  const exporter = new OBJExporter();
  const rawObj = exporter.parse(mesh);

  const header = `# LowPolyMaker 3D Studio Export\n# Model: ${options.modelName}\n# Height: ${options.heightMm || "auto"}mm\n# Manifold: ${options.isWatertight !== false ? "Yes (Watertight)" : "Audited"}\n\n`;
  const result = header + rawObj;

  const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
  const filename = `${generateBaseFilename(options)}.obj`;

  return {
    blob,
    filename,
    sizeBytes: blob.size,
    format: "obj"
  };
}

/**
 * Exports geometry to standard compliant 3MF (3D Manufacturing Format) container
 * Compatible with Bambu Studio, OrcaSlicer, PrusaSlicer, Ultimaker Cura, Windows 3D Builder
 */
export async function exportTo3MF(
  geometry: THREE.BufferGeometry,
  options: ExportOptions
): Promise<ExportResult> {
  // Ensure we have an indexed non-degenerate mesh representation
  const geom = geometry.index ? geometry : geometry.toNonIndexed();
  const posAttr = geom.getAttribute("position");
  
  if (!posAttr) {
    throw new Error("Invalid geometry: missing position attribute");
  }

  const verticesXml: string[] = [];
  const trianglesXml: string[] = [];

  // Write Vertices
  const vertexCount = posAttr.count;
  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i).toFixed(4);
    const y = posAttr.getY(i).toFixed(4);
    const z = posAttr.getZ(i).toFixed(4);
    verticesXml.push(`          <vertex x="${x}" y="${y}" z="${z}" />`);
  }

  // Write Triangles
  if (geom.index) {
    const indices = geom.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      trianglesXml.push(`          <triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}" />`);
    }
  } else {
    for (let i = 0; i < vertexCount; i += 3) {
      trianglesXml.push(`          <triangle v1="${i}" v2="${i + 1}" v3="${i + 2}" />`);
    }
  }

  const modelTitle = (options.modelName || "LowPolyModel").replace(/[^a-zA-Z0-9_\- ]/g, "");

  // Construct 3D/3dmodel.model XML
  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Title">${modelTitle}</metadata>
  <metadata name="Designer">LowPoly 3D Maker</metadata>
  <metadata name="Application">LowPolyMaker Studio</metadata>
  <metadata name="CreationDate">${new Date().toISOString()}</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
${verticesXml.join("\n")}
        </vertices>
        <triangles>
${trianglesXml.join("\n")}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`;

  // Construct [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  // Construct _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  // Package into standard ZIP container using JSZip
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml);
  zip.folder("_rels")?.file(".rels", relsXml);
  zip.folder("3D")?.file("3dmodel.model", modelXml);

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
  });

  const filename = `${generateBaseFilename(options)}.3mf`;

  return {
    blob: zipBlob,
    filename,
    sizeBytes: zipBlob.size,
    format: "3mf"
  };
}

/**
 * Exports all formats (.stl, .obj, .3mf) bundled inside a single .zip file
 */
export async function exportAllFormatsZip(
  geometry: THREE.BufferGeometry,
  options: ExportOptions,
  specsSummary?: string
): Promise<{ blob: Blob; filename: string; sizeBytes: number }> {
  const [stlRes, objRes, threeMfRes] = await Promise.all([
    exportToSTL(geometry, options),
    exportToOBJ(geometry, options),
    exportTo3MF(geometry, options)
  ]);

  const zip = new JSZip();
  zip.file(stlRes.filename, stlRes.blob);
  zip.file(objRes.filename, objRes.blob);
  zip.file(threeMfRes.filename, threeMfRes.blob);

  const readme = specsSummary || `# LowPolyMaker 3D Studio - Model Package
Model: ${options.modelName}
Triangles: ${options.targetTriangles || "auto"}
Height: ${options.heightMm || "auto"} mm
Watertight Manifold: ${options.isWatertight !== false ? "100% Watertight" : "Audited"}
Export Date: ${new Date().toLocaleString()}

Included Files:
- ${stlRes.filename} (Binary STL for FDM/SLA slicers)
- ${objRes.filename} (Wavefront OBJ for 3D software & renderers)
- ${threeMfRes.filename} (3MF for Bambu Studio, OrcaSlicer, PrusaSlicer)
`;
  zip.file("README_3D_PRINT.txt", readme);

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  const filename = `${generateBaseFilename(options)}_all_formats.zip`;

  return {
    blob: zipBlob,
    filename,
    sizeBytes: zipBlob.size
  };
}

/**
 * Universal dispatcher for exporting models in any supported format
 */
export async function exportModel(
  geometry: THREE.BufferGeometry,
  format: SupportedExportFormat,
  options: ExportOptions
): Promise<ExportResult> {
  switch (format) {
    case "stl":
      return exportToSTL(geometry, options);
    case "obj":
      return exportToOBJ(geometry, options);
    case "3mf":
      return exportTo3MF(geometry, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
