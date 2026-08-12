import { useCallback, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sphere } from "@react-three/drei";
import * as THREE from "three";
import type { RegionId } from "../../src/lib/split3mf/state/splitTypes";

export interface BrushEditEvent {
  vertexIndex: number;
  kind: "pull" | "push";
}

interface BoundaryBrushProps {
  geometry?: import("three").BufferGeometry;
  meshRef?: React.RefObject<THREE.Mesh | null>;
  activeRegionId: RegionId;
  brushRadius: number; // mm for visual indicator; 1..6 topological hops
  onEdit?: (event: BrushEditEvent) => void;
  onHover?: (vertexIndex: number | null, point: THREE.Vector3 | null) => void;
}

/**
 * Interactive paint brush over an indexed mesh. Left-drag = pull (assign to
 * activeRegion), right-drag = push (erase target region paint at frontier).
 * Restricts hits to the model mesh via a vertical Raycaster.
 */
export default function BoundaryBrush({
  geometry,
  meshRef,
  activeRegionId,
  brushRadius,
  onEdit,
  onHover,
}: BoundaryBrushProps) {
  const { camera, raycaster, pointer } = useThree();
  const hoverPos = useRef<THREE.Vector3 | null>(null);
  const dragging = useRef<null | { buttons: number }>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  const mesh = useMemo(() => {
    if (!geometry) return null;
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  }, [geometry]);

  const hitVertex = useCallback(
    (point: THREE.Vector3): number | null => {
      if (!geometry) return null;
      const pos = geometry.attributes.position;
      const index = geometry.index;
      if (!pos || !index) return null;
      // Brute-force nearest vertex among referenced indices (brush preview).
      let best = -1;
      let bestDist = Infinity;
      const p = point;
      for (let i = 0; i < index.count; i++) {
        const vi = index.getX(i);
        const dx = pos.getX(vi) - p.x;
        const dy = pos.getY(vi) - p.y;
        const dz = pos.getZ(vi) - p.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          best = vi;
        }
      }
      return best >= 0 ? best : null;
    },
    [geometry]
  );

  useFrame(() => {
    if (!mesh || !meshRef?.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(meshRef.current, false);
    if (hits.length === 0) {
      hoverPos.current = null;
      onHover?.(null, null);
      return;
    }
    const point = hits[0].point;
    hoverPos.current = point;
    const vi = hitVertex(point);
    onHover?.(vi, point);
  });

  const dispatchEdit = useCallback(
    (kind: "pull" | "push") => {
      if (!hoverPos.current) return;
      const vi = hitVertex(hoverPos.current);
      if (vi !== null) onEdit?.({ vertexIndex: vi, kind });
    },
    [hitVertex, onEdit]
  );

  const lastDispatch = useRef(0);
  const throttledDrag = useCallback(
    (kind: "pull" | "push") => {
      const now = performance.now();
      if (now - lastDispatch.current < 16) return;
      lastDispatch.current = now;
      dispatchEdit(kind);
    },
    [dispatchEdit]
  );

  return (
    <group>
      {/* Invisible geometry used for crisp raycasting; actual mesh renders separately. */}
      {mesh && <primitive object={mesh} />}
      <Sphere
        args={[brushRadius * 1.5, 12, 12]}
        position={hoverPos.current ?? [0, -1000, 0]}
        visible={hoverPos.current !== null}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = { buttons: e.buttons };
          (e.target as { setPointerCapture?: (id: number) => void })?.setPointerCapture?.(e.pointerId);
          dispatchEdit(e.buttons === 2 ? "push" : "pull");
        }}
        onPointerMove={(e) => {
          if (dragging.current && e.buttons === 1) throttledDrag("pull");
          else if (dragging.current && e.buttons === 2) throttledDrag("push");
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onContextMenu={(e) => e.nativeEvent.preventDefault()}
      >
        <meshBasicMaterial color={activeRegionId ? "#FFFFFF" : "#888888"} transparent opacity={0.25} depthWrite={false} toneMapped={false} />
      </Sphere>
    </group>
  );
}

export function brushRadiusToHops(brushRadiusMm: number, bbox: THREE.Box3 | undefined): number {
  void brushRadiusMm;
  void bbox;
  return 1;
}