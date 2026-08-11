import { useMemo, useState } from "react";

type ModelDimensions = { x: number; y: number; z: number; volume: number };
type WatermarkPlacement = "base" | "top" | "front" | "back" | "left" | "right";
type WatermarkStyle = "raised" | "recessed" | "overlay";

export function useWatermark(modelDimensions: ModelDimensions) {
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("VERTICE");
  const [placement, setPlacement] = useState<WatermarkPlacement>("base");
  const [size, setSize] = useState(0.25);
  const [depth, setDepth] = useState(0.04);
  const [color, setColor] = useState("#00E5FF");
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [offsetZ, setOffsetZ] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [style, setStyle] = useState<WatermarkStyle>("raised");

  const params = useMemo(() => {
    if (!modelDimensions.x || !modelDimensions.y || !modelDimensions.z) {
      return { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
    }

    let px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0;
    const hx = modelDimensions.x / 2, hy = modelDimensions.y / 2, hz = modelDimensions.z / 2;
    switch (placement) {
      case "base": py = -hy; rx = Math.PI / 2; break;
      case "top": py = hy; rx = -Math.PI / 2; break;
      case "front": pz = hz; break;
      case "back": pz = -hz; ry = Math.PI; break;
      case "left": px = -hx; ry = -Math.PI / 2; break;
      case "right": px = hx; ry = Math.PI / 2; break;
    }
    px += offsetX; py += offsetY; pz += offsetZ;
    rx += (rotationX * Math.PI) / 180;
    ry += (rotationY * Math.PI) / 180;
    rz += (rotationZ * Math.PI) / 180;
    return { position: [px, py, pz] as [number, number, number], rotation: [rx, ry, rz] as [number, number, number] };
  }, [modelDimensions, placement, offsetX, offsetY, offsetZ, rotationX, rotationY, rotationZ]);

  return {
    watermarkEnabled: enabled,
    setWatermarkEnabled: setEnabled,
    watermarkText: text,
    setWatermarkText: setText,
    watermarkPlacement: placement,
    setWatermarkPlacement: setPlacement,
    watermarkSize: size,
    setWatermarkSize: setSize,
    watermarkDepth: depth,
    setWatermarkDepth: setDepth,
    watermarkColor: color,
    setWatermarkColor: setColor,
    watermarkOffsetX: offsetX,
    setWatermarkOffsetX: setOffsetX,
    watermarkOffsetY: offsetY,
    setWatermarkOffsetY: setOffsetY,
    watermarkOffsetZ: offsetZ,
    setWatermarkOffsetZ: setOffsetZ,
    watermarkRotationX: rotationX,
    setWatermarkRotationX: setRotationX,
    watermarkRotationY: rotationY,
    setWatermarkRotationY: setRotationY,
    watermarkRotationZ: rotationZ,
    setWatermarkRotationZ: setRotationZ,
    watermarkStyle: style,
    setWatermarkStyle: setStyle,
    watermarkParams: params,
  };
}
