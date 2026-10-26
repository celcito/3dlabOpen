import type { LetterBoxConfig } from '../types/letterBox';
import type { KeychainConfig } from '../types/keychain';

export interface TextStylePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;

  // Tipografia
  fontFamily: string;

  // Efeito / 2 camadas (chaveiro & ponteira de lápis)
  fontWeightScale: number;
  outlineSize: number;
  baseColor: string;
  reliefColor: string;

  // 3 camadas (letra caixa)
  backColor: string;
  midColor: string;
  frontColor: string;
  backContour: number;
  midContour: number;
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: 'pokemon',
    name: 'Pokémon',
    emoji: '⚡',
    description: 'Letras amarelas gordas com contorno azul grosso',
    fontFamily: 'Pokemon Solid',
    fontWeightScale: 1.4,
    outlineSize: 4.5,
    baseColor: '#2A75BB',
    reliefColor: '#FFCB05',
    backColor: '#1A3A6B',
    midColor: '#2A75BB',
    frontColor: '#FFCB05',
    backContour: 12,
    midContour: 5,
  },
  {
    id: 'arcade-gamer',
    name: 'Arcade Gamer',
    emoji: '🕹️',
    description: 'Ciano neon sobre preto, tecnológica',
    fontFamily: 'Orbitron',
    fontWeightScale: 1.1,
    outlineSize: 3.2,
    baseColor: '#09090B',
    reliefColor: '#22D3EE',
    backColor: '#09090B',
    midColor: '#155E75',
    frontColor: '#67E8F9',
    backContour: 9.5,
    midContour: 4,
  },
  {
    id: 'doce-candy',
    name: 'Doce Candy',
    emoji: '🍬',
    description: 'Rosa e branco, arredondada e fofa',
    fontFamily: 'Fredoka',
    fontWeightScale: 1.3,
    outlineSize: 3.5,
    baseColor: '#DB2777',
    reliefColor: '#FDF2F8',
    backColor: '#831843',
    midColor: '#F472B6',
    frontColor: '#FDF2F8',
    backContour: 9.5,
    midContour: 4,
  },
  {
    id: 'dourado-classico',
    name: 'Dourado Clássico',
    emoji: '👑',
    description: 'Ouro sobre preto, elegante e encorpada',
    fontFamily: 'Bowlby One SC',
    fontWeightScale: 1.2,
    outlineSize: 3.2,
    baseColor: '#111827',
    reliefColor: '#FBBF24',
    backColor: '#1C1917',
    midColor: '#B45309',
    frontColor: '#FDE68A',
    backContour: 9.5,
    midContour: 4,
  },
  {
    id: 'super-mario',
    name: 'Super Mario',
    emoji: '🍄',
    description: 'Vermelho Mario, filete branco e fundo azul, estilo logo',
    fontFamily: 'Super Mario 256',
    fontWeightScale: 1.3,
    outlineSize: 4,
    baseColor: '#1E3A8A',
    reliefColor: '#E52521',
    backColor: '#1E3A8A',
    midColor: '#FFFFFF',
    frontColor: '#E52521',
    backContour: 12,
    midContour: 5,
  },
  {
    id: 'sega',
    name: 'SEGA',
    emoji: '🎮',
    description: 'Azul SEGA sobre prata, retrô dos anos 90',
    fontFamily: 'SEGA LOGO FONT',
    fontWeightScale: 1.2,
    outlineSize: 3.8,
    baseColor: '#C9D0DC',
    reliefColor: '#0033A0',
    backColor: '#0A1B3D',
    midColor: '#C9D0DC',
    frontColor: '#0033A0',
    backContour: 12,
    midContour: 5,
  },
];

type TwoLayerStylePatch = Pick<
  KeychainConfig,
  'fontFamily' | 'customFontName' | 'customFontBase64' | 'fontWeightScale' | 'outlineSize' | 'baseColor' | 'reliefColor'
>;

type LetterBoxStylePatch = Pick<
  LetterBoxConfig,
  | 'fontFamily'
  | 'customFontName'
  | 'customFontBase64'
  | 'backColor'
  | 'midColor'
  | 'frontColor'
  | 'backContour'
  | 'midContour'
>;

export function stylePatch2Camadas(preset: TextStylePreset): TwoLayerStylePatch {
  return {
    fontFamily: preset.fontFamily,
    customFontName: undefined,
    customFontBase64: undefined,
    fontWeightScale: preset.fontWeightScale,
    outlineSize: preset.outlineSize,
    baseColor: preset.baseColor,
    reliefColor: preset.reliefColor,
  };
}

export function stylePatchLetterBox(preset: TextStylePreset): LetterBoxStylePatch {
  return {
    fontFamily: preset.fontFamily,
    customFontName: undefined,
    customFontBase64: undefined,
    backColor: preset.backColor,
    midColor: preset.midColor,
    frontColor: preset.frontColor,
    backContour: preset.backContour,
    midContour: preset.midContour,
  };
}
