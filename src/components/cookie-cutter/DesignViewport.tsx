"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { DesignElement, toPathData, elementBounds } from "../../lib/cookie-cutter/designElements";
import { primitiveToShape } from "../../lib/cookie-cutter/primitives";
import { textToShapeGeometry } from "../../lib/cookie-cutter/textToShape";

interface DesignViewportProps {
  elements: DesignElement[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onTransform: (id: string, transform: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>) => void;
  onTransformCommit: (id: string, transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }) => void;
  snapGrid: number;
  transformMode: "translate" | "rotate" | "scale";
  viewMode: "cutter_stamp" | "cutter_only" | "stamp_only" | "coloring_plate";
  config: {
    size: number;
    stampPlateThickness: number;
    wallThickness: number;
    clearance: number;
    materialColor: string;
    explodedView: number;
    showWireframe: boolean;
  };
  outlinePoints: THREE.Vector2[];
  detailRibbonShapes: { shape: THREE.Shape; isClosed: boolean }[];
}

const SC = 0.1;

function ViewportContent({
  elements,
  selectedIds,
  onSelect,
  onTransform,
  onTransformCommit,
  snapGrid,
  transformMode,
  viewMode,
  config,
  outlinePoints,
  detailRibbonShapes,
}: DesignViewportProps) {
  const { camera, gl } = useThree();
  const transformControlsRef = useRef<any>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const dragStart = useRef<{ ids: string[]; transforms: Map<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number }> } | null>(null);

  const elementRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  const registerRef = (id: string, mesh: THREE.Mesh | null) => {
    if (mesh) elementRefs.current.set(id, mesh);
    else elementRefs.current.delete(id);
  };

  const getMeshesForIds = (ids: string[]) => {
    return ids.map(id => elementRefs.current.get(id)).filter(Boolean) as THREE.Mesh[];
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse.current, camera);
    const meshes = Array.from(elementRefs.current.values());
    const intersects = raycaster.current.intersectObjects(meshes, false);

    const shift = event.shiftKey;
    const clickedId = intersects[0]?.object.userData?.elementId;

    if (clickedId) {
      if (shift) {
        onSelect(selectedIds.includes(clickedId)
          ? selectedIds.filter(id => id !== clickedId)
          : [...selectedIds, clickedId]
        );
      } else {
        onSelect(selectedIds.includes(clickedId) && selectedIds.length === 1
          ? [clickedId]
          : [clickedId]
        );
      }

      dragStart.current = {
        ids: selectedIds.includes(clickedId) && shift
          ? [...selectedIds, clickedId].filter((v, i, a) => a.indexOf(v) === i)
          : selectedIds.includes(clickedId)
            ? selectedIds
            : [clickedId],
        transforms: new Map(),
      };
      dragStart.current.ids.forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) dragStart.current!.transforms.set(id, { ...el.transform });
      });
    } else if (!shift) {
      onSelect([]);
    }
  };

  const handlePointerUp = () => {
    if (dragStart.current) {
      dragStart.current.ids.forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) onTransformCommit(id, el.transform);
      });
      dragStart.current = null;
    }
  };

  useEffect(() => {
    gl.domElement.addEventListener("pointerdown", handlePointerDown as any);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown as any);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const selectedMeshes = useMemo(() => getMeshesForIds(selectedIds), [selectedIds]);

  // Create selection group with clones for TransformControls
  const selectionGroup = useMemo(() => {
    if (selectedMeshes.length === 0) return null;
    if (selectedMeshes.length === 1) return selectedMeshes[0];

    const group = new THREE.Group();
    selectedMeshes.forEach(m => {
      const clone = m.clone();
      clone.position.copy(m.position);
      clone.rotation.copy(m.rotation);
      clone.scale.copy(m.scale);
      group.add(clone);
    });
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.copy(center);
    group.children.forEach(child => child.position.sub(center));
    return group;
  }, [selectedMeshes]);

  const applySnap = (val: number) => {
    if (snapGrid > 0) return Math.round(val / snapGrid) * snapGrid;
    return val;
  };

  const handleTransformChange = (state: any) => {
    if (!dragStart.current || !transformControlsRef.current) return;
    const obj = transformControlsRef.current.object;
    if (!obj) return;
    
    dragStart.current.ids.forEach((id, i) => {
      const el = elements.find(e => e.id === id);
      if (!el) return;
      const mesh = selectedMeshes[i];
      if (!mesh) return;

      const newPos = new THREE.Vector3();
      const newRot = new THREE.Quaternion();
      const newScale = new THREE.Vector3();
      obj.matrixWorld.decompose(newPos, newRot, newScale);

      onTransform(id, {
        x: applySnap(newPos.x / SC),
        y: applySnap(newPos.y / SC),
        rotation: new THREE.Euler().setFromQuaternion(newRot).z,
        scaleX: newScale.x,
        scaleY: newScale.y,
      });
    });
  };

  return (
    <>
      <group position={[0, 0, 0]}>
        {elements
          .filter(e => e.visible && e.role !== "ignore" && e.type !== "group")
          .map(element => {
            const isSelected = selectedIds.includes(element.id);
            
            let geometry: THREE.BufferGeometry | null = null;
            if (element.type === "path" && element.pathData) {
              const pathData = element.pathData;
              const shape = new THREE.Shape();
              const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/g) || [];
              let currentX = 0, currentY = 0;
              for (const cmd of commands) {
                const type = cmd[0];
                const values = cmd.slice(1).trim().split(/\s+/).filter(Boolean).map(Number);
                if (type === "M") {
                  shape.moveTo(values[0], values[1]);
                  currentX = values[0];
                  currentY = values[1];
                } else if (type === "L") {
                  for (let i = 0; i < values.length; i += 2) {
                    shape.lineTo(values[i], values[i + 1]);
                    currentX = values[i];
                    currentY = values[i + 1];
                  }
                } else if (type === "H") {
                  shape.lineTo(values[0], currentY);
                  currentX = values[0];
                } else if (type === "V") {
                  shape.lineTo(currentX, values[0]);
                  currentY = values[0];
                } else if (type === "Z") {
                  shape.closePath();
                }
              }
              if (shape.curves.length > 0) {
                geometry = new THREE.ShapeGeometry(shape);
              }
            } else if (element.type === "primitive") {
              const shape = primitiveToShape(element.primitiveData.shape, element.primitiveData.params);
              geometry = new THREE.ShapeGeometry(shape);
            } else if (element.type === "text" && element.textData) {
              const font = (window as any).opentypeFontCache?.[element.textData.font];
              if (font) {
                geometry = textToShapeGeometry(element.textData.text, font, element.textData.fontSize);
              }
            }

            if (!geometry) return null;

            geometry.computeBoundingBox();
            const bbox = geometry.boundingBox!;
            const cx = (bbox.max.x + bbox.min.x) / 2;
            const cy = (bbox.max.y + bbox.min.y) / 2;
            geometry.translate(-cx, -cy, 0);

            const z = viewMode === "cutter_stamp" || viewMode === "stamp_only"
              ? config.stampPlateThickness * SC + 0.05
              : 0;

            const materialColor = new THREE.Color(config.materialColor);
            const mat = new THREE.MeshStandardMaterial({
              color: isSelected ? 0x632CE5 : materialColor,
              roughness: 0.2,
              metalness: 0.15,
              wireframe: config.showWireframe,
              emissive: isSelected ? 0x632CE5 : materialColor,
              emissiveIntensity: isSelected ? 0.3 : 0.12,
              transparent: isSelected,
              opacity: isSelected ? 0.8 : 1,
            });

            return (
              <mesh
                key={element.id}
                ref={mesh => registerRef(element.id, mesh)}
                geometry={geometry}
                position={[element.transform.x * SC, element.transform.y * SC, z]}
                rotation={[0, 0, element.transform.rotation]}
                scale={[element.transform.scaleX, element.transform.scaleY, 1]}
                userData={{ elementId: element.id }}
                onPointerDown={e => e.stopPropagation()}
                castShadow
                receiveShadow
                material={mat}
              />
            );
          })}
      </group>

      <TransformControls
        ref={transformControlsRef}
        mode={transformMode}
        object={selectionGroup}
        enabled={selectedIds.length > 0}
        onObjectChange={handleTransformChange}
        onMouseUp={handlePointerUp}
      >
        {selectionGroup && selectionGroup !== selectedMeshes[0] && (
          <mesh
            geometry={new THREE.BoxGeometry(1, 1, 1)}
            material={new THREE.MeshBasicMaterial({ color: 0x632CE5, transparent: true, opacity: 0.1, wireframe: true })}
            scale={new THREE.Vector3().copy(selectionGroup.scale).multiplyScalar(1.1)}
          />
        )}
      </TransformControls>
    </>
  );
}

function registerRef(id: string, mesh: THREE.Mesh | null) {
  // This is a placeholder - actual registration happens via ref prop
}

function getMeshesForIds(ids: string[]): THREE.Mesh[] {
  // This is a placeholder - actual implementation uses elementRefs
  return [];
}

export function DesignViewport(props: DesignViewportProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 30 }}
      style={{ width: "100%", height: "100%", display: "block" }}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
    >
      <color attach="background" args={["#F9FAF4"]} />
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[5, 5, 10]} intensity={1} color="#ffffff" castShadow />
      <directionalLight position={[-5, -5, 5]} intensity={0.3} color="#ffffff" />
      
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#E2E3DD"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#632CE5"
        position={[0, 0, -0.1]}
        fadeDistance={30}
      />
      
      <ViewportContent {...props} />
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minZoom={0.5}
        maxZoom={50}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
}