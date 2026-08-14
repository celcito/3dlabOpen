import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sphere } from "@react-three/drei";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

export interface BrushEditEvent {
  vertexIndex: number;
  kind: "pull" | "push";
}

export interface BrushHoverEvent {
  vertexIndex: number | null;
  point: THREE.Vector3 | null;
}

interface BoundaryBrushProps {
  geometry?: import("three").BufferGeometry;
  meshRef?: React.RefObject<THREE.Mesh | null>;
  activeRegionColor?: string;
  brushRadius: number; // mm for visual indicator; 1..6 topological hops
  enabled?: boolean;
  onEdit?: (event: BrushEditEvent) => void;
  onEditComplete?: () => void;
  selectMode?: boolean;
  onSelect?: (vertexIndex: number) => void;
  onHover?: (event: BrushHoverEvent) => void;
}

/**
 * Interactive paint brush over an indexed mesh. Left-drag = pull (assign to
 * activeRegion), right-drag = push (erase target region paint at frontier).
 *
 * Uses two spheres: a large invisible hit-test sphere anchored at the model
 * centroid so pointer events reliably land even before Bounds.fit has settled
 * after a fresh model load; and a smaller visible indicator that tracks the
 * precise cursor position.
 */
export default function BoundaryBrush({
  geometry,
  meshRef,
  activeRegionColor,
  brushRadius,
  enabled = true,
  onEdit,
  onEditComplete,
  selectMode = false,
  onSelect,
  onHover,
}: BoundaryBrushProps) {
  const { camera, raycaster, pointer } = useThree();
  const hoverPos = useRef<THREE.Vector3 | null>(null);
  const dragging = useRef<null | { buttons: number }>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const indicatorVisible = useRef(false);

  const bvh = useMemo(() => (geometry?.index ? new MeshBVH(geometry) : null), [geometry]);
  const indicatorColor = useMemo(() => new THREE.Color(activeRegionColor ?? "#FFFFFF"), [activeRegionColor]);
  const modelScale = useMemo(() => {
    if (!geometry) return 1;
    geometry.computeBoundingSphere();
    const r = geometry.boundingSphere?.radius ?? 1;
    return r > 0 ? r : 1;
  }, [geometry]);
  const indicatorRadius = Math.max(modelScale * 0.06, brushRadius * modelScale * 0.018);
  // Hit-test radius: covers the whole model from any reasonable click angle so
  // pointer events never miss the brush during the initial fit animation.
  const hitRadius = Math.max(modelScale * 1.5, 1.0);

  const hitVertex = useCallback(
    (point: THREE.Vector3): number | null => {
      if (!geometry) return null;
      const pos = geometry.attributes.position;
      const index = geometry.index;
      if (!pos || !index) return null;
      if (!bvh) return null;
      const hit = bvh.closestPointToPoint(point);
      if (!hit) return null;
      const triangleStart = hit.faceIndex * 3;
      let best = index.getX(triangleStart);
      let bestDist = Infinity;
      for (let i = triangleStart; i < triangleStart + 3; i++) {
        const vi = index.getX(i);
        const dx = pos.getX(vi) - point.x;
        const dy = pos.getY(vi) - point.y;
        const dz = pos.getZ(vi) - point.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          best = vi;
        }
      }
      return best;
    },
    [bvh, geometry]
  );

  // Re-derive the cursor hit point fresh on every pointer event so a stale
  // hoverPos (e.g. before Bounds.fit settled) never sends the brush to the
  // wrong vertex.
  const raycastModel = useCallback((): THREE.Vector3 | null => {
    if (!meshRef?.current) return null;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(meshRef.current, false);
    return hits.length > 0 ? hits[0].point : null;
  }, [camera, meshRef, pointer, raycaster]);

  useFrame(() => {
    const point = raycastModel();
    const indicator = indicatorRef.current;
    if (!point) {
      hoverPos.current = null;
      if (indicator && indicatorVisible.current) {
        indicator.visible = false;
        indicatorVisible.current = false;
      }
      onHover?.({ vertexIndex: null, point: null });
      return;
    }
    hoverPos.current = point;
    if (indicator) {
      indicator.position.copy(point);
      if (!indicatorVisible.current) {
        indicator.visible = true;
        indicatorVisible.current = true;
      }
    }
    const vi = hitVertex(point);
    onHover?.({ vertexIndex: vi, point });
  });

  const dispatchEdit = useCallback(
    (kind: "pull" | "push") => {
      // Always re-raycast so the vertex index matches the click, not a stale frame.
      const point = raycastModel() ?? hoverPos.current;
      if (!point) return;
      const vi = hitVertex(point);
      if (vi !== null) onEdit?.({ vertexIndex: vi, kind });
    },
    [hitVertex, onEdit, raycastModel]
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

  // Initial hit-test position: model centroid (approximated by mesh world position).
  // Bounds.fit moves the model so useFrame updates the actual hit position over time.
  const initialPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (meshRef?.current) meshRef.current.getWorldPosition(initialPos);
  }, [meshRef, geometry, initialPos]);

  return (
    <group>
      {/* Large invisible hit-test sphere, anchored at the model centroid. */}
      <Sphere
        args={[hitRadius, 12, 12]}
        position={initialPos}
        visible={false}
        onPointerDown={(e) => {
          if (!enabled) return;
          if (selectMode) {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (e.button === 0) {
              const point = raycastModel() ?? hoverPos.current;
              const vi = point ? hitVertex(point) : null;
              if (vi !== null) onSelect?.(vi);
            }
            return;
          }
          // Let OrbitControls own the middle button for camera panning.
          if (e.button === 1) return;
          e.stopPropagation();
          dragging.current = { buttons: e.button === 2 ? 2 : 1 };
          dispatchEdit(e.button === 2 ? "push" : "pull");
        }}
        onPointerMove={(e) => {
          if (!enabled) return;
          if (selectMode) return;
          if (dragging.current && e.buttons === 1) throttledDrag("pull");
          else if (dragging.current && e.buttons === 2) throttledDrag("push");
        }}
        onPointerUp={() => {
          const wasDragging = dragging.current !== null;
          dragging.current = null;
          if (wasDragging) onEditComplete?.();
        }}
        onContextMenu={(e) => e.nativeEvent.preventDefault()}
      />
      {/* Visual brush indicator. Tracks the cursor precisely. */}
      <Sphere
        ref={indicatorRef}
        args={[indicatorRadius, 16, 16]}
        position={[0, -1000, 0]}
        visible={false}
        renderOrder={999}
      >
        <meshBasicMaterial
          color={indicatorColor}
          transparent
          opacity={0.28}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </Sphere>
    </group>
  );
}

export function brushRadiusToHops(brushRadiusMm: number, bbox: THREE.Box3 | undefined): number {
  void brushRadiusMm;
  void bbox;
  return 1;
}
