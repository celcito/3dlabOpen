import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type * as THREE from "three";
import { generateKeychainModel } from "../lib/keychain/geometry";
import type { KeychainConfig } from "../types/keychain";
import type { Model3DDimensions } from "../types/pencilTopper";

export interface NamePlaqueGeometryState {
  /** Corpo (silhueta) em mm, centrado em XY, z ∈ [0, bodyThickness]. */
  base: THREE.BufferGeometry | null;
  /** Relevo em mm, empilhado acima do corpo. */
  relief: THREE.BufferGeometry | null;
  /** Dimensões geradas (mm) — usado no fit check `nome-placa` [V2]. */
  dimensions: Model3DDimensions | null;
  generating: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 150;

/**
 * Geração assíncrona (debounce ~150 ms) do corpo+relevo de um nome no
 * estilo chaveiro — a CSG é pesada (canvas 20 px/mm) e não pode travar a UI.
 * `loopEnabled` é forçado false: plaquinha de bolo não tem argola [R6].
 */
export function useNamePlaqueGeometry(config: KeychainConfig, enabled: boolean): NamePlaqueGeometryState {
  const [state, setState] = useState<NamePlaqueGeometryState>({
    base: null,
    relief: null,
    dimensions: null,
    generating: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((prev) =>
        prev.base || prev.generating || prev.error
          ? { base: null, relief: null, dimensions: null, generating: false, error: null }
          : prev
      );
      return;
    }

    let cancelled = false;
    setState((prev) => (prev.generating ? prev : { ...prev, generating: true }));

    const timer = setTimeout(async () => {
      try {
        const model = await generateKeychainModel({ ...config, loopEnabled: false });
        if (cancelled) {
          model.baseMesh.geometry.dispose();
          model.reliefMesh.geometry.dispose();
          return;
        }
        const base = model.baseMesh.geometry;
        const relief = model.reliefMesh.geometry;
        flushSync(() =>
          setState((prev) => {
            prev.base?.dispose();
            prev.relief?.dispose();
            return { base, relief, dimensions: model.dimensions, generating: false, error: null };
          })
        );
      } catch (err) {
        if (cancelled) return;
        console.warn("Falha ao gerar geometria do nome:", err);
        flushSync(() =>
          setState((prev) => {
            prev.base?.dispose();
            prev.relief?.dispose();
            return {
              base: null,
              relief: null,
              dimensions: null,
              generating: false,
              error: "Não foi possível gerar o nome. Verifique a fonte e tente novamente.",
            };
          })
        );
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [config, enabled]);

  return state;
}
