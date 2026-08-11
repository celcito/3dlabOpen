import * as THREE from "three";

export interface SegmentData {
  geometry: THREE.BufferGeometry;
  index: number;
}

interface SliceOptions {
  segments: number;
  gap: number;
  hingeSizeRatio: number;
}

type JointFn = (
  male: THREE.BufferGeometry,
  female: THREE.BufferGeometry,
  config: {
    position: THREE.Vector3;
    direction: THREE.Vector3;
    pegDiameter: number;
    pegLength: number;
    fitTolerance?: number;
  }
) => { male: THREE.BufferGeometry; female: THREE.BufferGeometry };

/** Splits triangles by horizontal bands while retaining the original mesh data. */
export function sliceMeshIntoSegments(
  source: THREE.BufferGeometry,
  options: SliceOptions
): SegmentData[] {
  const segments = Math.max(2, Math.round(options.segments));
  const position = source.getAttribute("position");
  if (!position || position.count < 3) return [];

  source.computeBoundingBox();
  const bounds = source.boundingBox;
  if (!bounds || bounds.max.y <= bounds.min.y) return [{ geometry: source.clone(), index: 0 }];

  const buckets: number[][] = Array.from({ length: segments }, () => []);
  const index = source.index;
  const indices = index ? index.array : Array.from({ length: position.count }, (_, i) => i);
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = Number(indices[i]);
    const b = Number(indices[i + 1]);
    const c = Number(indices[i + 2]);
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const t = (y - bounds.min.y) / (bounds.max.y - bounds.min.y);
    const bucket = Math.min(segments - 1, Math.max(0, Math.floor(t * segments)));
    buckets[bucket].push(a, b, c);
  }

  return buckets.flatMap((triangles, index) => {
    if (triangles.length === 0) return [];
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    for (const vertex of triangles) {
      vertices.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return [{ geometry, index }];
  });
}

export function jointArticulatedSegments(
  segments: SegmentData[],
  gap: number,
  hingeSizeRatio: number,
  joint: JointFn
): THREE.BufferGeometry[] {
  if (segments.length < 2) return segments.map((segment) => segment.geometry);
  const output = segments.map((segment) => segment.geometry);
  for (let i = 0; i < output.length - 1; i++) {
    output[i].computeBoundingBox();
    output[i + 1].computeBoundingBox();
    const a = output[i].boundingBox;
    const b = output[i + 1].boundingBox;
    if (!a || !b) continue;
    const position = new THREE.Vector3((a.max.x + b.min.x) / 2, (a.max.y + b.min.y) / 2, (a.max.z + b.min.z) / 2);
    const radius = Math.max(0.5, Math.min(a.getSize(new THREE.Vector3()).x, a.getSize(new THREE.Vector3()).z) * hingeSizeRatio * 0.5);
    const result = joint(output[i], output[i + 1], {
      position,
      direction: new THREE.Vector3(0, 1, 0),
      pegDiameter: radius * 2,
      pegLength: Math.max(1, gap),
      fitTolerance: 0.15,
    });
    output[i] = result.male;
    output[i + 1] = result.female;
  }
  return output;
}
