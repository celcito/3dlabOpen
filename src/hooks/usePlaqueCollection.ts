import { useCallback, useEffect, useState } from "react";
import {
  cloneNameConfig,
  cloneTopperConfig,
  derivePlaqueLabel,
  plaqueUid,
  type Plaque,
} from "../lib/cakeTopper/plaque";
import { loadPlaqueCollection, savePlaqueCollection } from "../lib/cakeTopper/storage";

function clonePlaque(plaque: Plaque): Plaque {
  return JSON.parse(JSON.stringify(plaque)) as Plaque;
}

function dedupeLabel(base: string, existing: Plaque[]): string {
  let candidate = base;
  let n = 1;
  while (existing.some((p) => p.label === candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * Coleção persistente de plaquinhas (localStorage `topo_bolo_placas_v1`).
 * O hook NÃO guarda a plaquinha em edição — isso fica no componente da página;
 * aqui ficam apenas os snapshots salvos.
 */
export function usePlaqueCollection() {
  const [plaques, setPlaques] = useState<Plaque[]>(() => loadPlaqueCollection());

  useEffect(() => {
    savePlaqueCollection(plaques);
  }, [plaques]);

  /** Snapshot da plaquinha atual na coleção (novo id; label automático ou informado). */
  const addFromPlaque = useCallback(
    (source: Plaque, label?: string): Plaque => {
      const base = label?.trim() || derivePlaqueLabel(source, 0);
      const snapshot: Plaque = {
        id: plaqueUid(),
        label: dedupeLabel(base, plaques),
        style: source.style,
        topper: cloneTopperConfig(source.topper),
        name: cloneNameConfig(source.name),
      };
      setPlaques((prev) => [...prev, snapshot]);
      return snapshot;
    },
    [plaques]
  );

  const updatePlaque = useCallback((id: string, changes: Partial<Omit<Plaque, "id">>) => {
    setPlaques((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }, []);

  const removePlaque = useCallback((id: string) => {
    setPlaques((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const duplicatePlaque = useCallback(
    (id: string): Plaque | null => {
      const source = plaques.find((p) => p.id === id);
      if (!source) return null;
      const copy: Plaque = {
        ...clonePlaque(source),
        id: plaqueUid(),
        label: dedupeLabel(`${source.label}-copia`, plaques),
      };
      setPlaques((prev) => [...prev, copy]);
      return copy;
    },
    [plaques]
  );

  /** Clone isolado da plaquinha salva, para carregar no editor. */
  const loadPlaqueInto = useCallback(
    (id: string): Plaque | null => {
      const source = plaques.find((p) => p.id === id);
      return source ? clonePlaque(source) : null;
    },
    [plaques]
  );

  return { plaques, addFromPlaque, updatePlaque, removePlaque, duplicatePlaque, loadPlaqueInto };
}
