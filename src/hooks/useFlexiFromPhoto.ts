import { useState } from "react";
import type * as THREE from "three";
import type { SegmentData } from "../lib/meshSlicing";

export interface PhotoFlexiConfig {
  segments: number;
  gap: number;
  hingeSizeRatio: number;
  baseColor: string;
}

export function useFlexiFromPhoto() {
  const [config, setConfig] = useState<PhotoFlexiConfig>({
    segments: 8,
    gap: 0.15,
    hingeSizeRatio: 0.5,
    baseColor: "#00E5FF",
  });
  const [sourceGeometry, setSourceGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [segmentsPreview, setSegmentsPreview] = useState<SegmentData[]>([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "slicing" | "ready" | "error">("idle");
  const [successMsg, setSuccessMsg] = useState("");

  const showNotification = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  return {
    config, setConfig, sourceGeometry, setSourceGeometry,
    segmentsPreview, setSegmentsPreview, fileName, setFileName,
    status, setStatus, successMsg, showNotification,
  };
}
