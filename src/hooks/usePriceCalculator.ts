import { useState } from "react";

export function usePriceCalculator() {
  const [tab, setTab] = useState("fdm");
  const [meta, setMeta] = useState(2000);
  return { tab, setTab, meta, setMeta };
}
