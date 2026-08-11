import { useRef } from "react";

export function useViewerCamera() {
  const controlsRef = useRef<any>(null);

  const zoomIn = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    if (camera.isPerspectiveCamera) camera.position.multiplyScalar(0.85);
    else if (camera.isOrthographicCamera) {
      camera.zoom *= 1.15;
      camera.updateProjectionMatrix();
    }
    controls.update();
  };

  const zoomOut = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    if (camera.isPerspectiveCamera) camera.position.multiplyScalar(1.15);
    else if (camera.isOrthographicCamera) {
      camera.zoom *= 0.85;
      camera.updateProjectionMatrix();
    }
    controls.update();
  };

  const resetCamera = () => controlsRef.current?.reset();

  return { controlsRef, zoomIn, zoomOut, resetCamera };
}
