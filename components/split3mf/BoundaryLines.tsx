import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { RegionId } from "../../src/lib/split3mf/state/splitTypes";

interface BoundaryLinesProps {
  regionMask?: Uint8Array | null;
  /** Indexed BufferGeometry whose `.position` array maps 1:1 to mask entries. */
  geometry?: import("three").BufferGeometry;
  regions?: { id: RegionId }[];
  color?: string;
}

/**
 * Renders boundary edges between regions as magenta LineSegments with
 * depthTest disabled so they show through geometry (overdraw).
 * Uses the linked `useBridge` R3F scene; geometry + mask come from props.
 */
export default function BoundaryLines({ regionMask, geometry, color = "#D500F9" }: BoundaryLinesProps) {
  const { lineGeometry, pairCount } = useMemo(() => {
    if (!regionMask || !geometry) return { lineGeometry: null, pairCount: 0 };
    const idx = geometry.index;
    const pos = geometry.attributes.position;
    if (!idx || !pos) return { lineGeometry: null, pairCount: 0 };

    const seen = new Set<number>();
    const verts: number[] = [];
    for (let i = 0; i + 2 < idx.count; i += 3) {
      const a = idx.getX(i);
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      checkPair(a, b);
      checkPair(b, c);
      checkPair(c, a);
    }
    function checkPair(x: number, y: number) {
      if (x >= regionMask.length || y >= regionMask.length) return;
      if (regionMask[x] === regionMask[y]) return;
      const key = x < y ? x * 1000000 + y : y * 1000000 + x;
      if (seen.has(key)) return;
      seen.add(key);
      verts.push(pos.getX(x), pos.getY(x), pos.getZ(x), pos.getX(y), pos.getY(y), pos.getZ(y));
    }
    if (verts.length === 0) return { lineGeometry: null, pairCount: 0 };
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(verts, 3));
    return { lineGeometry: g, pairCount: verts.length / 6 };
  }, [regionMask, geometry]);

  if (!lineGeometry || pairCount === 0) return null;

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial
        color={color}
        depthTest={false}
        transparent
        opacity={0.9}
        toneMapped={false}
      />
    </lineSegments>
  );
}