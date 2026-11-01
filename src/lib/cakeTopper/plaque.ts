import type * as THREE from "three";
import type { KeychainConfig } from "../../types/keychain";
import { DEFAULT_KEYCHAIN_CONFIG } from "../keychain/presets";
import {
  DEFAULT_TOPPER_CONFIG,
  defaultSticks,
  type TopperConfig,
} from "./cakeTopperGeometry";

/** Estilo visual da plaquinha de topo de bolo. */
export type PlaqueStyle = "placa" | "nome-silhueta" | "nome-placa";

/** Uma plaquinha da coleção: placa com texto OU estilo chaveiro (silhueta/placa). */
export interface Plaque {
  id: string;
  /** Nome do arquivo no zip/3MF (sanitizado no export). */
  label: string;
  style: PlaqueStyle;
  /** Config da placa com texto + hastes + cores (usado em todos os estilos). */
  topper: TopperConfig;
  /** Config do nome (estilos `nome-*`); `loopEnabled` sempre false. */
  name: KeychainConfig;
}

/** Cascas fechadas de uma peça colorida — mesmo formato dos itens do thermoform. */
export interface PlaquePart {
  geoms: THREE.BufferGeometry[];
  name: string;
  color: string;
}

export const PLAQUE_STYLES: PlaqueStyle[] = ["placa", "nome-silhueta", "nome-placa"];

export function isPlaqueStyle(value: unknown): value is PlaqueStyle {
  return typeof value === "string" && (PLAQUE_STYLES as string[]).includes(value);
}

/** Defaults do chaveiro adaptados a plaquinha de bolo (sem argola, sem símbolo). */
export function defaultPlaqueNameConfig(): KeychainConfig {
  return {
    ...DEFAULT_KEYCHAIN_CONFIG,
    text: "Nome",
    symbolId: "none",
    loopEnabled: false,
    baseColor: DEFAULT_TOPPER_CONFIG.plateColor,
    reliefColor: DEFAULT_TOPPER_CONFIG.textColor,
  };
}

export function cloneTopperConfig(config: TopperConfig): TopperConfig {
  return {
    ...config,
    elements: config.elements.map((el) => ({ ...el })),
    sticks: config.sticks.map((stick) => ({ ...stick })),
  };
}

export function cloneNameConfig(config: KeychainConfig): KeychainConfig {
  return { ...config, loopEnabled: false };
}

export function plaqueUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultPlaque(style: PlaqueStyle = "placa"): Plaque {
  const topper = cloneTopperConfig(DEFAULT_TOPPER_CONFIG);
  topper.sticks = defaultSticks(
    topper.stickCount,
    topper.plateWidth,
    topper.stickHeight,
    topper.stickThickness,
    topper.stickWidth
  );
  return {
    id: plaqueUid(),
    label: topper.text,
    style,
    topper,
    name: defaultPlaqueNameConfig(),
  };
}

/** Label padrão derivado do texto/nome da plaquinha (fallback `plaquinha-N`). */
export function derivePlaqueLabel(plaque: Pick<Plaque, "style" | "topper" | "name">, index: number): string {
  const raw = plaque.style === "placa" ? plaque.topper.text : plaque.name.text;
  const cleaned = raw.trim().replace(/\s+/g, "-").slice(0, 24);
  return cleaned || `plaquinha-${index + 1}`;
}
