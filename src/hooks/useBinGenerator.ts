import { useState } from "react";

export type BatteryType = "aa" | "aaa" | "9v" | "cr";
export type SlotStyle = "hole" | "cradle";
export interface BatterySlotGroup {
  id: string;
  batteryType: BatteryType;
  style: SlotStyle;
  cols: number;
  rows: number;
  crDiameter: number;
}
export interface BinConfig {
  width: number; depth: number; height: number; thickness: number; radius: number;
  dividersX: number; dividersY: number; divPositionsX?: number[]; divPositionsY?: number[];
  innerFillet: number; stackable: boolean; baseColor: string; slotGroups: BatterySlotGroup[];
}

export function useBinGenerator() {
  const [config, setConfig] = useState<BinConfig>({
    width: 80, depth: 80, height: 40, thickness: 1.6, radius: 6,
    dividersX: 1, dividersY: 1, innerFillet: 2, stackable: false,
    baseColor: "#e0e0e0", slotGroups: [],
  });
  const [successMsg, setSuccessMsg] = useState("");
  const showNotification = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(""), 3500);
  };
  return { config, setConfig, successMsg, showNotification };
}
