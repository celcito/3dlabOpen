import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { AnalysisResult, WorldMesh } from "../../src/lib/threeMfAnalyzer/types";

const BED = 256;
const ACCENT = "#632CE5";
const BOUNDARY = "#FF1744";
const OVERHANG = "#FF9100";
const FLOATING = "#FFD166";

export interface OverlayFlags {
  boundary: boolean;
  overhang: boolean;
  placement: boolean;
}

interface AnalyzerCanvasProps {
  meshes: WorldMesh[];
  boundarySegments: Float32Array;
  overhangTriangles: Float32Array;
  highlights: AnalysisResult["highlights"];
  overlays: OverlayFlags;
  epoch: number;
}

export function AnalyzerCanvas({
  meshes,
  boundarySegments,
  overhangTriangles,
  highlights,
  overlays,
  epoch,
}: AnalyzerCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [180, 140, 180], fov: 40 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0, 0);
        gl.setClearColor("#F1F3ED", 1);
      }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[80, 140, 60]} intensity={1} />
      <directionalLight position={[-60, 40, -40]} intensity={0.35} />

      {meshes.length > 0 && (
        <Bounds key={epoch} fit clip margin={1.15} maxDuration={0.3}>
          {/* 3MF é Z-up; o grupo rotaciona +Z do modelo para +Y da cena. */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {meshes.map((mesh, index) => (
              <ModelMesh key={`${mesh.name}-${index}`} mesh={mesh} />
            ))}
            {overlays.boundary && boundarySegments.length >= 6 && <BoundaryOverlay positions={boundarySegments} />}
            {overlays.overhang && overhangTriangles.length >= 9 && <OverhangOverlay positions={overhangTriangles} />}
            {overlays.placement &&
              highlights.map((highlight, index) => (
                <HighlightBox key={index} highlight={highlight} />
              ))}
          </group>
        </Bounds>
      )}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <BedOutline />
      </group>
      <Grid
        infiniteGrid
        fadeDistance={600}
        cellColor="#DDE1D8"
        sectionColor="#CAC3D8"
        cellSize={10}
        sectionSize={50}
      />
      <OrbitControls makeDefault enableDamping={false} rotateSpeed={0.7} zoomSpeed={0.8} panSpeed={0.8} />
    </Canvas>
  );
}

function ModelMesh({ mesh }: { mesh: WorldMesh }) {
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }, [mesh]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#C6CBBD" roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

function BoundaryOverlay({ positions }: { positions: Float32Array }) {
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} renderOrder={20}>
      <lineBasicMaterial color={BOUNDARY} depthTest={false} transparent opacity={0.95} />
    </lineSegments>
  );
}

function OverhangOverlay({ positions }: { positions: Float32Array }) {
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={15}>
      <meshBasicMaterial
        color={OVERHANG}
        transparent
        opacity={0.45}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function HighlightBox({
  highlight,
}: {
  highlight: { min: [number, number, number]; max: [number, number, number]; kind: "offBed" | "floating" | "below" };
}) {
  const size: [number, number, number] = [
    Math.max(highlight.max[0] - highlight.min[0], 1),
    Math.max(highlight.max[1] - highlight.min[1], 1),
    Math.max(highlight.max[2] - highlight.min[2], 1),
  ];
  const center: [number, number, number] = [
    (highlight.min[0] + highlight.max[0]) / 2,
    (highlight.min[1] + highlight.max[1]) / 2,
    (highlight.min[2] + highlight.max[2]) / 2,
  ];
  const color = highlight.kind === "floating" ? FLOATING : BOUNDARY;

  return (
    <mesh position={center} renderOrder={30}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.85} depthTest={false} />
    </mesh>
  );
}

function BedOutline() {
  const geometry = useMemo(() => {
    const half = BED / 2;
    const points = [
      new THREE.Vector3(-half, -half, 0),
      new THREE.Vector3(half, -half, 0),
      new THREE.Vector3(half, half, 0),
      new THREE.Vector3(-half, half, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineLoop geometry={geometry} renderOrder={5}>
      <lineBasicMaterial color={ACCENT} transparent opacity={0.8} />
    </lineLoop>
  );
}
