/**
 * Modelos de topo de bolo inspirados na Bluey.
 *
 * - Silhueta da personagem (curvas de Bézier, viewBox 170×246). É um contorno
 *   único e fechado porque o preview 3D do topo de bolo extrusa apenas a maior
 *   forma preenchida de cada elemento.
 * - Os quatro personagens usam a mesma silhueta, diferenciados pela cor e pela
 *   altura (filhotes menores, adultos maiores).
 * - Modelos prontos usam a fonte local `public/fonts/Bluey.ttf`.
 */
import type { TopperConfig, TopperElement } from "./cakeTopperGeometry";

/** Arquivo da fonte da Bluey (`public/fonts/Bluey.ttf` ou `.otf`). */
export const BLUEY_FONT_URL = "/fonts/Bluey.ttf";

/** viewBox da silhueta. */
export const BLUEY_VIEW_BOX = "0 0 170 246";

const BLUEY_PATH = `M 83.0 246.0 C 80.1 245.0 76.0 241.2 74.1 237.8 C 73.0 235.8 72.0 233.4 71.6 231.9 C 71.4 230.9 71.3 229.4 71.2 226.1 C 71.0 216.6 70.4 199.1 70.2 193.0 C 70.1 191.2 70.1 189.1 70.1 188.5 L 70.1 187.3 L 67.7 189.8 C 62.7 194.8 57.7 198.7 51.2 202.4 C 44.8 206.1 39.5 208.0 33.1 209.1 C 32.4 209.2 27.7 209.2 27.1 209.1 C 24.6 208.6 22.3 207.5 21.2 206.3 L 20.7 205.8 L 19.4 205.9 C 15.8 206.1 12.8 204.4 11.3 201.3 C 10.9 200.6 10.8 198.4 11.0 197.3 C 11.1 196.9 11.1 196.8 10.7 196.7 C 10.0 196.6 9.1 195.8 8.7 195.0 C 7.4 192.4 9.6 188.6 13.3 187.1 C 14.5 186.7 17.0 186.0 17.6 186.0 C 17.8 186.0 18.1 185.7 18.5 185.0 C 19.4 183.8 19.8 183.3 20.6 182.9 C 22.5 181.8 25.1 181.3 31.1 180.9 C 34.5 180.6 36.0 180.5 38.7 179.9 C 42.3 179.2 47.1 177.5 49.9 175.9 C 50.6 175.5 51.2 175.2 51.2 175.2 C 51.4 175.2 53.1 173.9 53.9 173.1 C 55.3 171.7 55.5 171.4 55.2 170.8 C 54.7 170.1 53.1 164.9 52.4 161.8 C 50.9 155.9 50.7 154.6 50.2 150.8 C 50.1 149.5 49.9 147.9 49.8 147.3 C 49.7 146.7 49.6 145.0 49.5 143.5 L 49.4 140.7 L 46.7 139.8 C 44.4 139.1 40.7 137.7 39.5 137.2 C 39.3 137.1 38.8 136.9 38.4 136.7 C 37.6 136.4 36.9 136.1 35.4 135.4 C 28.1 132.2 19.0 126.9 12.5 122.1 L 11.7 121.5 L 10.1 122.0 C 5.3 123.6 2.2 123.0 0.9 120.5 C 0.0 118.8 0.8 116.6 2.7 115.5 L 3.3 115.2 L 2.1 114.0 C 0.3 112.2 0.0 111.6 0.0 109.3 C 0.0 107.4 0.2 107.0 1.1 106.1 C 2.0 105.3 4.6 104.7 5.7 105.0 C 6.2 105.1 6.2 105.1 6.1 104.8 C 5.4 102.5 5.3 101.7 6.0 100.4 C 7.3 97.6 10.6 97.5 13.4 100.3 C 14.1 101.0 14.6 101.6 14.7 101.7 C 14.9 102.0 15.0 102.0 16.0 101.4 C 18.4 100.2 19.8 100.1 21.2 101.0 C 23.2 102.3 23.5 104.7 22.1 106.8 C 21.8 107.3 21.5 107.8 21.5 107.8 C 21.5 108.0 24.5 110.3 26.2 111.5 C 28.5 113.1 30.4 114.3 32.9 115.6 C 34.4 116.5 38.2 118.4 38.3 118.4 C 38.3 118.4 38.8 118.6 39.3 118.8 C 42.2 120.2 44.7 121.1 44.7 120.9 C 44.7 120.8 44.1 118.7 43.5 116.3 C 42.8 113.8 42.2 111.7 42.2 111.6 C 42.1 111.2 41.5 109.2 40.9 107.0 C 40.6 105.8 40.1 103.9 39.7 102.7 C 39.4 101.4 38.6 98.7 38.0 96.5 C 37.5 94.4 36.8 92.0 36.6 91.2 C 36.4 90.4 36.0 89.1 35.8 88.3 C 35.6 87.5 35.1 86.0 34.8 84.9 C 34.6 83.8 34.0 81.6 33.5 80.1 C 33.1 78.5 32.6 76.9 32.5 76.3 C 31.4 72.5 31.3 71.6 31.2 67.7 C 31.0 62.5 32.0 57.8 34.5 52.0 C 34.8 51.3 35.2 50.4 35.3 49.9 C 35.5 49.5 36.0 48.3 36.5 47.2 C 36.9 46.1 37.8 44.0 38.3 42.6 C 38.9 41.2 39.5 39.8 39.6 39.4 C 39.8 39.1 39.9 38.8 39.9 38.8 C 40.0 38.6 40.6 36.9 41.2 35.5 C 41.6 34.7 41.9 34.0 41.9 33.9 C 41.9 33.8 42.0 33.5 42.1 33.2 C 42.3 32.9 42.9 31.5 43.5 30.0 C 44.1 28.5 44.7 26.9 44.9 26.5 C 45.1 26.1 45.4 25.3 45.6 24.8 C 45.8 24.3 46.0 23.7 46.0 23.7 C 46.1 23.6 46.9 21.5 47.9 19.1 C 48.9 16.6 49.8 14.3 50.0 14.0 C 50.2 13.6 50.5 12.9 50.6 12.5 C 51.8 8.7 54.2 7.2 55.8 9.4 C 56.3 10.1 56.8 11.5 57.8 14.7 C 58.2 15.9 58.8 17.8 59.2 19.0 C 59.6 20.2 60.3 22.3 60.8 23.8 C 61.2 25.3 61.9 27.4 62.3 28.5 C 62.7 29.7 63.7 32.9 64.7 35.7 C 66.0 40.0 66.4 40.9 66.6 40.8 C 67.9 40.4 68.4 40.4 70.1 40.4 C 72.0 40.4 73.1 40.6 74.3 41.1 C 74.5 41.2 74.6 41.1 74.6 40.8 C 74.7 40.6 75.0 40.0 75.3 39.4 C 75.6 38.7 76.0 37.8 76.2 37.3 C 76.4 36.8 77.0 35.4 77.6 34.1 C 78.1 32.9 78.6 31.8 78.6 31.8 C 78.6 31.7 78.9 31.1 79.3 30.3 C 79.6 29.5 80.0 28.6 80.2 28.2 C 80.3 27.8 80.5 27.3 80.6 27.3 C 80.7 27.2 80.9 26.6 81.2 25.9 C 81.5 25.3 81.9 24.4 82.0 24.0 C 82.2 23.7 82.6 22.7 83.0 21.8 C 83.4 20.9 84.0 19.6 84.3 18.9 C 84.7 18.1 85.0 17.3 85.1 17.0 C 85.3 16.7 85.6 15.9 85.9 15.3 C 86.2 14.6 86.6 13.8 86.7 13.4 C 88.3 9.5 92.1 2.3 93.6 0.6 L 94.1 0.0 L 96.3 0.0 C 98.4 0.0 98.4 0.0 98.6 0.4 C 98.7 0.7 99.0 1.8 99.0 2.0 C 99.0 2.0 99.1 2.2 99.2 2.5 C 99.3 2.7 99.6 3.6 99.8 4.5 C 100.2 5.9 100.9 8.2 101.4 10.2 C 101.5 10.5 102.0 12.2 102.5 14.0 C 103.0 15.7 103.8 18.4 104.2 19.8 C 104.6 21.3 105.0 22.6 105.0 22.8 C 105.0 23.0 105.3 24.0 105.6 24.9 C 105.9 25.8 106.5 27.9 106.9 29.6 C 107.4 31.3 107.9 33.1 108.1 33.6 C 108.2 34.1 108.5 34.9 108.6 35.4 C 108.9 36.5 109.2 37.2 109.5 37.5 C 110.0 38.0 111.2 40.0 111.5 40.8 C 112.2 42.7 112.3 44.8 111.7 46.0 L 111.4 46.6 L 112.2 48.0 C 114.6 52.1 117.2 59.5 117.8 64.1 C 117.8 64.6 117.9 65.1 117.9 65.1 C 118.0 65.3 119.2 65.0 121.7 64.2 C 126.5 62.7 132.9 61.3 134.1 61.5 C 136.0 61.9 137.0 65.2 136.6 70.1 C 136.5 71.4 136.4 72.7 136.3 73.0 C 136.3 73.3 136.1 74.2 135.9 75.0 L 135.7 76.4 L 136.1 78.1 C 137.2 83.3 137.2 90.2 136.1 96.1 C 135.3 99.8 133.7 104.2 132.1 106.5 C 131.2 107.7 131.2 108.1 132.0 107.0 C 132.4 106.6 132.7 106.3 132.7 106.2 C 132.8 106.1 138.1 99.7 139.3 98.2 C 139.9 97.4 140.6 96.5 140.9 96.2 C 141.2 95.8 142.2 94.7 143.0 93.6 L 144.6 91.7 L 144.0 91.3 C 140.9 88.8 140.2 85.5 142.3 83.2 C 143.4 82.0 144.9 81.6 146.7 81.9 L 147.3 82.1 L 147.3 81.4 C 147.3 78.4 149.7 75.8 152.1 76.1 C 153.6 76.4 154.6 77.3 155.7 79.8 L 156.1 80.6 L 156.9 80.0 C 158.4 78.8 160.4 78.3 162.0 78.7 C 163.0 79.0 164.1 80.0 164.5 81.3 C 164.8 82.1 164.9 82.4 164.8 83.5 L 164.7 84.8 L 165.7 85.0 C 167.5 85.3 168.5 86.1 169.1 87.7 C 170.0 90.2 169.1 92.7 166.9 94.0 C 165.9 94.6 164.4 95.1 163.4 95.1 L 162.8 95.1 L 161.8 97.0 C 158.7 102.5 151.8 111.8 145.8 118.3 C 145.4 118.7 144.6 119.5 144.1 120.1 C 141.5 123.0 136.0 128.2 133.9 129.7 C 133.2 130.2 133.0 130.4 133.0 130.7 C 133.0 131.0 133.5 134.3 134.0 137.5 C 134.1 138.5 134.2 139.2 134.3 140.0 C 134.3 140.5 134.4 141.0 134.4 141.2 C 134.5 141.4 134.5 142.0 134.6 142.5 C 134.6 143.1 134.7 144.0 134.8 144.7 C 135.4 149.5 135.7 155.1 135.8 160.9 C 135.8 166.9 135.5 168.7 134.4 170.3 L 133.9 171.1 L 134.4 171.7 C 134.8 172.1 135.7 173.1 136.5 174.0 C 137.4 174.8 138.5 176.0 139.1 176.7 C 139.7 177.3 140.7 178.4 141.5 179.2 C 142.2 180.0 143.5 181.3 144.2 182.1 C 144.9 182.9 146.2 184.2 147.0 185.0 C 147.8 185.8 149.0 187.1 149.7 187.9 C 150.4 188.6 151.5 189.8 152.2 190.5 C 152.8 191.2 153.8 192.2 154.3 192.7 L 155.2 193.7 L 155.7 193.4 C 156.0 193.3 156.4 193.0 156.7 192.9 C 158.7 191.7 162.2 191.7 164.8 192.9 C 166.5 193.7 168.3 195.2 169.1 196.6 C 169.5 197.3 169.5 197.3 169.5 199.8 L 169.5 202.3 L 168.9 203.5 C 168.0 205.5 166.7 207.2 164.3 209.6 C 162.1 211.7 161.5 212.2 159.1 213.8 C 156.6 215.6 151.1 218.0 149.5 218.2 C 148.9 218.2 147.9 217.5 146.7 216.2 C 145.3 214.7 144.0 213.2 143.1 212.3 C 142.7 211.9 141.7 210.8 141.0 210.0 C 140.2 209.1 139.3 208.2 139.1 208.0 C 138.9 207.7 137.9 206.7 136.9 205.7 C 136.0 204.6 134.8 203.4 134.4 203.0 C 134.0 202.6 133.3 201.8 132.9 201.4 C 132.4 200.9 131.2 199.6 130.1 198.4 C 129.1 197.3 127.7 195.9 127.1 195.2 C 126.5 194.6 125.1 193.0 124.0 191.8 C 122.9 190.6 121.4 189.1 120.8 188.4 C 120.1 187.7 118.8 186.3 117.8 185.2 C 116.9 184.2 115.7 183.0 115.3 182.5 L 114.4 181.6 L 112.8 182.1 C 107.3 183.6 100.8 184.8 94.1 185.5 L 93.0 185.6 L 93.1 189.9 C 93.1 192.2 93.3 199.1 93.4 205.1 C 93.7 220.6 93.9 223.4 94.1 223.9 C 98.0 231.4 97.1 241.1 92.2 244.9 C 90.5 246.1 90.8 246.1 86.8 246.1 C 84.8 246.0 83.1 246.0 83.0 246.0 Z`;

function asSvg(path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BLUEY_VIEW_BOX}"><path d="${path}" fill="#111111" /></svg>`;
}

export interface BlueyCharacter {
  id: string;
  name: string;
  /** Cor do corpo (aplicada no material do elemento). */
  color: string;
  /** Altura padrão no topper, em mm (o desenho é mais alto que largo). */
  defaultHeightMm: number;
  /** Contorno no viewBox da silhueta, usado nos thumbnails. */
  path: string;
  /** Markup SVG do elemento adicionado ao topper. */
  svg: string;
}

export const BLUEY_CHARACTERS: BlueyCharacter[] = [
  { id: "bluey", name: "Bluey", color: "#5B9FCE", defaultHeightMm: 34, path: BLUEY_PATH, svg: asSvg(BLUEY_PATH) },
  { id: "bingo", name: "Bingo", color: "#DE7A45", defaultHeightMm: 30, path: BLUEY_PATH, svg: asSvg(BLUEY_PATH) },
  { id: "bandit", name: "Bandit", color: "#3E6F91", defaultHeightMm: 40, path: BLUEY_PATH, svg: asSvg(BLUEY_PATH) },
  { id: "chilli", name: "Chilli", color: "#C35A46", defaultHeightMm: 38, path: BLUEY_PATH, svg: asSvg(BLUEY_PATH) },
];

export function findBlueyCharacter(id: string): BlueyCharacter | undefined {
  return BLUEY_CHARACTERS.find((character) => character.id === id);
}

export function blueyCharacterElement(
  character: BlueyCharacter,
  opts: { x: number; y?: number; heightMm?: number; color?: string; id?: string; zIndex?: number }
): TopperElement {
  // `extractSvgShape` escala o maior lado do desenho para `widthMm`; como a
  // silhueta é mais alta que larga, o maior lado é a altura.
  const heightMm = opts.heightMm ?? character.defaultHeightMm;
  return {
    id: opts.id ?? `bluey-${character.id}`,
    type: "image",
    content: character.name,
    x: opts.x,
    y: opts.y ?? -10,
    scale: 1,
    rotation: 0,
    color: opts.color ?? character.color,
    svgData: character.svg,
    widthMm: heightMm,
    heightMm,
    zIndex: opts.zIndex ?? 0,
  };
}

function characters(placements: Array<{ id: string; x: number; y?: number; heightMm?: number }>): TopperElement[] {
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
    description: "Bluey e Bingo na placa clara",
    colors: ["#5B9FCE", "#DE7A45"],
    config: {
      ...BASE,
      text: "Bluey",
      subtitle: "Aniversário",
      fontSize: 16,
      letterSpacing: 0.4,
      plateWidth: 150,
      plateHeight: 70,
      plateColor: "#EAF4FA",
      textColor: "#2B5F86",
      borderColor: "#5B9FCE",
      stickColor: "#5B9FCE",
      elements: characters([
        { id: "bluey", x: -55, heightMm: 36 },
        { id: "bingo", x: 55, heightMm: 31 },
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
        { id: "bluey", x: -66, heightMm: 32 },
        { id: "bingo", x: 66, heightMm: 28 },
      ]),
    },
  },
  {
    id: "bingo-parabens",
    name: "Bingo Parabéns",
    description: "Bingo e Bluey na placa quentinha",
    colors: ["#DE7A45", "#5B9FCE"],
    config: {
      ...BASE,
      text: "Bingo",
      subtitle: "Parabéns",
      fontSize: 16,
      letterSpacing: 0.4,
      plateWidth: 130,
      plateHeight: 66,
      plateColor: "#FFF1E6",
      textColor: "#A8502A",
      borderColor: "#DE7A45",
      stickColor: "#DE7A45",
      elements: characters([
        { id: "bingo", x: -48, heightMm: 32 },
        { id: "bluey", x: 48, heightMm: 30 },
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
        { id: "bandit", x: -78, heightMm: 38 },
        { id: "chilli", x: -48, heightMm: 34 },
        { id: "bluey", x: 48, heightMm: 30 },
        { id: "bingo", x: 78, heightMm: 26 },
      ]),
    },
  },
];
