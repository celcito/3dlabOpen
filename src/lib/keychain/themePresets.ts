import type { KeychainConfig } from '../../types/keychain';

type KeychainThemeVisual = Pick<
  KeychainConfig,
  | 'fontFamily'
  | 'customFontName'
  | 'customFontBase64'
  | 'fontWeightScale'
  | 'outlineSize'
  | 'baseColor'
  | 'reliefColor'
  | 'symbolId'
  | 'symbolPosition'
  | 'symbolSeparated'
>;

export type KeychainThemePatch = KeychainThemeVisual &
  Partial<Pick<KeychainConfig, 'letterHeight' | 'letterSpacing' | 'loopEnabled' | 'tagShape'>>;

export interface KeychainThemePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  patch: KeychainThemePatch;
}

/** Temas do chaveiro: dois com ícone nas pontas e dois de tag, com a borda em osso/peixinho. */
export const KEYCHAIN_THEME_PRESETS: KeychainThemePreset[] = [
  {
    id: 'caozinho',
    name: 'Cãozinho',
    emoji: '🐶',
    description: 'Osso nas duas pontas com o nome no meio',
    patch: {
      symbolId: 'bone',
      symbolPosition: 'both',
      symbolSeparated: false,
      tagShape: undefined,
      fontFamily: 'Fredoka',
      customFontName: undefined,
      customFontBase64: undefined,
      fontWeightScale: 1.3,
      outlineSize: 3.5,
      baseColor: '#92400E',
      reliefColor: '#FDE68A',
    },
  },
  {
    id: 'gatinho',
    name: 'Gatinho',
    emoji: '🐱',
    description: 'Peixinho nas duas pontas com o nome no meio',
    patch: {
      symbolId: 'fish',
      symbolPosition: 'both',
      symbolSeparated: false,
      tagShape: undefined,
      fontFamily: 'Fredoka',
      customFontName: undefined,
      customFontBase64: undefined,
      fontWeightScale: 1.3,
      outlineSize: 3.5,
      baseColor: '#0E7490',
      reliefColor: '#A5F3FC',
    },
  },
  {
    id: 'tag-osso',
    name: 'Tag Osso',
    emoji: '🦴',
    description: 'A borda é o osso, com o nome dentro e argola no topo',
    patch: {
      tagShape: 'bone',
      symbolId: 'none',
      symbolPosition: 'left',
      symbolSeparated: false,
      fontFamily: 'Fredoka',
      customFontName: undefined,
      customFontBase64: undefined,
      fontWeightScale: 1.2,
      outlineSize: 2.8,
      letterHeight: 9,
      letterSpacing: 0.8,
      loopEnabled: true,
      baseColor: '#92400E',
      reliefColor: '#FDE68A',
    },
  },
  {
    id: 'tag-peixinho',
    name: 'Tag Peixinho',
    emoji: '🐟',
    description: 'A borda é o peixinho, com o nome dentro e argola no topo',
    patch: {
      tagShape: 'fish',
      symbolId: 'none',
      symbolPosition: 'left',
      symbolSeparated: false,
      fontFamily: 'Fredoka',
      customFontName: undefined,
      customFontBase64: undefined,
      fontWeightScale: 1.2,
      outlineSize: 2.8,
      letterHeight: 9,
      letterSpacing: 0.8,
      loopEnabled: true,
      baseColor: '#0E7490',
      reliefColor: '#A5F3FC',
    },
  },
];
