/**
 * Modelos de topo de bolo inspirados na Bluey.
 *
 * - Silhuetas dos personagens de perfil (de frente para a direita) no grid
 *   170×120, y para baixo. Cada uma é um contorno único e fechado — união de
 *   corpo, cabeça, focinho, orelhas, patas e rabo — porque o preview 3D do topo
 *   de bolo extrusa apenas a maior forma preenchida de cada elemento.
 * - Modelos prontos usam a fonte local `public/fonts/Bluey.ttf`.
 */
import type { TopperConfig, TopperElement } from "./cakeTopperGeometry";

/** Arquivo da fonte da Bluey (colocar em `public/fonts/Bluey.ttf`). */
export const BLUEY_FONT_URL = "/fonts/Bluey.ttf";

/** Corpo de filhote (Bluey / Bingo): cabeça grande, patas curtas. */
const PUPPY_HEAD = "M 101.6 -4 L 104.1 -1.5 L 117.5 22 L 119.8 22 L 134 -1.6 L 136.3 -4 L 139.5 -5 L 142.8 -4.4 L 145.4 -2.4 L 146.9 0.9 L 150.9 26.9 L 150.6 30.3 L 147.1 34.4 L 148 44 L 155.2 44.4 L 161.9 42.3 L 166 48 L 160.5 70.5 L 152 74 L 143.4 74 L 131.4 79.9 L 105.8 78 L 103.5 77 L 95.9 87.5 L 90 94 L 84 112 L 76 106 L 77.5 90 L 58 92 L 52 112 L 44 106 L 44.5 88.7 L 35.3 79.5 L 34.2 70.4 L 19.2 63 L 8 48.9 L 2.7 33.7 L 2.7 30.3 L 4.2 27.2 L 7 25.1 L 10.4 24.5 L 13.7 25.5 L 16.2 27.8 L 24.7 47.4 L 35.2 55 L 43.7 57.7 L 51 56 L 93.5 57.3 L 96 58.6 L 96 40.4 L 89.9 40.7 L 87.1 39 L 85.3 36.2 L 85.1 32.7 L 91.1 0.7 L 92.5 -2.3 L 95.1 -4.4 L 98.4 -5 Z";

/** Corpo adulto (Bandit / Chilli): mais comprido, orelhas e focinho maiores. */
const GROWN_HEAD = "M 22 63.9 L 6.1 57.3 L -4.9 45.7 L -11.9 26.6 L -12.2 19.7 L -10.4 16.4 L -7.5 14.3 L -3.9 13.5 L -0.3 14.3 L 2.6 16.6 L 10.7 38.4 L 21 46 L 30.6 48.7 L 40 46 L 96 47 L 96 37.5 L 89.7 37.7 L 86.6 35.9 L 84.6 33 L 84.2 28.1 L 92.2 -3.9 L 93.9 -7.1 L 96.7 -9.3 L 100.2 -10 L 103.6 -9.1 L 106.7 -6.3 L 121.1 16 L 139.7 -6.9 L 142.5 -9.2 L 145.9 -10 L 149.4 -9.2 L 152.2 -7 L 153.9 -3.3 L 157.9 20.7 L 157.7 24.2 L 156 27.3 L 151.3 29.9 L 152 38 L 158.7 38.2 L 165 35.6 L 170.2 40 L 164.9 67.4 L 155 72 L 145.3 71.5 L 133 76 L 107.4 74.4 L 102 84 L 112 90 L 106 114 L 96 108 L 96.9 86.6 L 90 92 L 84 114 L 74 108 L 75.5 88 L 56 90 L 50 114 L 40 108 L 40 88 L 38 92 L 32 114 L 22 108 L 28 86 L 31.8 86 L 22.9 75.6 Z";

function asSvg(path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -8 190 130"><path d="${path}" fill="#111111" /></svg>`;
}

export interface BlueyCharacter {
  id: string;
  name: string;
  /** Cor do corpo (aplicada no material do elemento). */
  color: string;
  /** Contorno no grid 170×120, usado nos thumbnails. */
  path: string;
  /** Markup SVG do elemento adicionado ao topper. */
  svg: string;
  defaultWidthMm: number;
}

export const BLUEY_CHARACTERS: BlueyCharacter[] = [
  { id: "bluey", name: "Bluey", color: "#5B9FCE", path: PUPPY_HEAD, svg: asSvg(PUPPY_HEAD), defaultWidthMm: 34 },
  { id: "bingo", name: "Bingo", color: "#DE7A45", path: PUPPY_HEAD, svg: asSvg(PUPPY_HEAD), defaultWidthMm: 32 },
  { id: "bandit", name: "Bandit", color: "#3E6F91", path: GROWN_HEAD, svg: asSvg(GROWN_HEAD), defaultWidthMm: 36 },
  { id: "chilli", name: "Chilli", color: "#C35A46", path: GROWN_HEAD, svg: asSvg(GROWN_HEAD), defaultWidthMm: 36 },
];

export function findBlueyCharacter(id: string): BlueyCharacter | undefined {
  return BLUEY_CHARACTERS.find((character) => character.id === id);
}

export function blueyCharacterElement(
  character: BlueyCharacter,
  opts: { x: number; y?: number; widthMm?: number; color?: string; id?: string; zIndex?: number }
): TopperElement {
  const widthMm = opts.widthMm ?? character.defaultWidthMm;
  return {
    id: opts.id ?? `bluey-${character.id}`,
    type: "image",
    content: character.name,
    x: opts.x,
    y: opts.y ?? -4,
    scale: 1,
    rotation: 0,
    color: opts.color ?? character.color,
    svgData: character.svg,
    widthMm,
    heightMm: widthMm,
    zIndex: opts.zIndex ?? 0,
  };
}

function characters(placements: Array<{ id: string; x: number; y?: number; widthMm?: number }>): TopperElement[] {
  return placements.map((placement, index) => {
    const character = findBlueyCharacter(placement.id);
    if (!character) throw new Error(`Personagem Bluey desconhecido: ${placement.id}`);
    return blueyCharacterElement(character, { ...placement, zIndex: index });
  });
}

export interface BlueyTemplate {
  id: string;
  name: string;
  description: string;
  /** Cores exibidas no cartão do modelo. */
  colors: string[];
  config: Partial<TopperConfig>;
}

const BASE: Partial<TopperConfig> = {
  fontFamily: BLUEY_FONT_URL,
  textThickness: 2,
  plateThickness: 2.2,
  plateCornerRadius: 10,
  borderWidth: 2.4,
  showBorder: true,
  theme: "bluey",
};

export const BLUEY_TEMPLATES: BlueyTemplate[] = [
  {
    id: "bluey-aniversario",
    name: "Bluey Aniversário",
    description: "Bluey e Bingo na placa azul",
    colors: ["#5B9FCE", "#DE7A45"],
    config: {
      ...BASE,
      text: "Bluey",
      subtitle: "Aniversário",
      fontSize: 16,
      letterSpacing: 0.4,
      plateWidth: 150,
      plateHeight: 70,
      plateColor: "#5B9FCE",
      textColor: "#FFFFFF",
      borderColor: "#2B5F86",
      stickColor: "#5B9FCE",
      elements: characters([
        { id: "bluey", x: -52 },
        { id: "bingo", x: 52 },
      ]),
    },
  },
  {
    id: "bluey-e-bingo",
    name: "Bluey & Bingo",
    description: "Placa clara com os dois filhotes",
    colors: ["#5B9FCE", "#DE7A45", "#EAF4FA"],
    config: {
      ...BASE,
      text: "Bluey & Bingo",
      fontSize: 12,
      letterSpacing: 0.3,
      plateWidth: 170,
      plateHeight: 70,
      plateColor: "#EAF4FA",
      textColor: "#2B5F86",
      borderColor: "#5B9FCE",
      stickColor: "#5B9FCE",
      elements: characters([
        { id: "bluey", x: -64 },
        { id: "bingo", x: 64, widthMm: 32 },
      ]),
    },
  },
  {
    id: "bingo-parabens",
    name: "Bingo Parabéns",
    description: "Placa laranja da Bingo",
    colors: ["#DE7A45", "#5B9FCE"],
    config: {
      ...BASE,
      text: "Bingo",
      subtitle: "Parabéns",
      fontSize: 16,
      letterSpacing: 0.4,
      plateWidth: 130,
      plateHeight: 66,
      plateColor: "#DE7A45",
      textColor: "#FFFFFF",
      borderColor: "#A8502A",
      stickColor: "#DE7A45",
      elements: characters([
        { id: "bingo", x: -46, widthMm: 32 },
        { id: "bluey", x: 46 },
      ]),
    },
  },
  {
    id: "familia-bluey",
    name: "Família Bluey",
    description: "Bandit, Chilli, Bluey e Bingo",
    colors: ["#3E6F91", "#C35A46", "#5B9FCE", "#DE7A45"],
    config: {
      ...BASE,
      text: "Família",
      fontSize: 14,
      letterSpacing: 0.4,
      plateWidth: 190,
      plateHeight: 78,
      plateColor: "#EAF4FA",
      textColor: "#2B5F86",
      borderColor: "#5B9FCE",
      stickColor: "#5B9FCE",
      elements: characters([
        { id: "bandit", x: -80, widthMm: 30 },
        { id: "chilli", x: -44, widthMm: 30 },
        { id: "bluey", x: 44, widthMm: 30 },
        { id: "bingo", x: 80, widthMm: 28 },
      ]),
    },
  },
];
