import { useState } from "react";

export interface FlexiConfig {
  segments: number;
  width: number;
  height: number;
  segmentGap: number;
  hingeGap: number;
  baseColor: string;
  taper: number;
  hingeSize: number;
}

export function useFlexiModelCreator() {
  const [config, setConfig] = useState<FlexiConfig>({
    segments: 8,
    width: 20,
    height: 15,
    segmentGap: 1.5,
    hingeGap: 0.4,
    baseColor: "#00E5FF",
    taper: 0.7,
    hingeSize: 4,
  });
  const [successMsg, setSuccessMsg] = useState("");

  const showNotification = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  return { config, setConfig, successMsg, showNotification };
}
