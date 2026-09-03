/**
 * Ponte simples entre o Design Editor (2D) e o Plate Creator (3D).
 * O Design Editor grava a arte exportada em SVG aqui; o Plate Creator lê e
 * consome (remove) o valor assim que a página carrega, criando uma nova camada.
 *
 * Não depende de backend — usa localStorage, então só funciona no mesmo domínio/origem.
 */

const BRIDGE_KEY = "vertice_bridge_pending_svg";

export interface PendingSvgPayload {
  svg: string;
  name: string;
  createdAt: string;
}

/** Chamado pelo Design Editor ao clicar em "Enviar para Placa 3D". */
export function sendSvgToPlateCreator(svg: string, name: string) {
  if (typeof window === "undefined") return;
  const payload: PendingSvgPayload = {
    svg,
    name,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(BRIDGE_KEY, JSON.stringify(payload));
}

/**
 * Chamado pelo Plate Creator ao montar a página. Lê e IMEDIATAMENTE apaga o valor
 * (consumo único), pra não reimportar a mesma arte se o usuário recarregar a página.
 */
export function consumePendingSvg(): PendingSvgPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BRIDGE_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(BRIDGE_KEY);
  try {
    return JSON.parse(raw) as PendingSvgPayload;
  } catch (err) {
    console.error("Payload da ponte Design Editor -> Plate Creator corrompido:", err);
    return null;
  }
}