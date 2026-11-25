import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type * as THREE from "three";
import { generateKeychainModel } from "../lib/keychain/geometry";
import type { KeychainConfig } from "../types/keychain";
import type { Model3DDimensions } from "../types/pencilTopper";

/** Uma camada do nome (cor própria) pronta para render/export. */
export interface NamePlaqueReliefLayer {
  geometry: THREE.BufferGeometry;
  color: string;
  name: string;
}

export interface NamePlaqueGeometryState {
  /** Corpo (silhueta) em mm, centrado em XY, z ∈ [0, bodyThickness]. */
  base: THREE.BufferGeometry | null;
  /** Camadas do nome, da base (mais larga) para o topo (relevo visível). */
  reliefs: NamePlaqueReliefLayer[];
  /** Dimensões geradas (mm) — usado no fit check `nome-placa` [V2]. */
  dimensions: Model3DDimensions | null;
  generating: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 150;

function meshColorHex(mesh: THREE.Mesh): string {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const color = (material as THREE.MeshStandardMaterial | undefined)?.color;
  return color ? `#${color.getHexString()}` : "#F9FAFB";
}

function disposeReliefs(reliefs: NamePlaqueReliefLayer[]) {
  reliefs.forEach((layer) => layer.geometry.dispose());
}

/**
 * Geração assíncrona (debounce ~150 ms) do corpo+camadas do nome no
 * estilo chaveiro — a CSG é pesada (canvas 20 px/mm) e não pode travar a UI.
 * `loopEnabled` é forçado false: plaquinha de bolo não tem argola [R6].
 */
export function useNamePlaqueGeometry(config: KeychainConfig, enabled: boolean): NamePlaqueGeometryState {
  const [state, setState] = useState<NamePlaqueGeometryState>({
    base: null,
    reliefs: [],
    dimensions: null,
    generating: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((prev) =>
        prev.base || prev.reliefs.length > 0 || prev.generating || prev.error
          ? { base: null, reliefs: [], dimensions: null, generating: false, error: null }
          : prev
      );
      return;
    }

    let cancelled = false;
    setState((prev) => (prev.generating ? prev : { ...prev, generating: true }));

    const timer = setTimeout(async () => {
      try {
        const model = await generateKeychainModel({ ...config, loopEnabled: false });
        const base = model.baseMesh.geometry;
        // Mesmas cores dos materiais da prévia 3D do chaveiro, camada por camada.
        const reliefs: NamePlaqueReliefLayer[] =
          model.reliefMeshes.length > 0
            ? model.reliefMeshes.map((mesh, index) => ({
                geometry: mesh.geometry,
                color: meshColorHex(mesh),
                name: mesh.name || `camada-${index + 1}`,
              }))
            : [{ geometry: base, color: meshColorHex(model.baseMesh), name: "relevo" }];
        if (cancelled) {
          base.dispose();
          disposeReliefs(reliefs);
          return;
        }
        flushSync(() =>
          setState((prev) => {
            prev.base?.dispose();
            disposeReliefs(prev.reliefs);
            return { base, reliefs, dimensions: model.dimensions, generating: false, error: null };
          })
        );
      } catch (err) {
        if (cancelled) return;
        console.warn("Falha ao gerar geometria do nome:", err);
        flushSync(() =>
          setState((prev) => {
            prev.base?.dispose();
            disposeReliefs(prev.reliefs);
            return {
              base: null,
              reliefs: [],
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
