import type { KeychainConfig } from '../../types/keychain';

export type KeychainThemePatch = Pick<
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

export interface KeychainThemePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  patch: KeychainThemePatch;
}

/** Temas do chaveiro: o ícone vai nas duas pontas, com o nome no meio. */
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
      fontFamily: 'Fredoka',
      customFontName: undefined,
      customFontBase64: undefined,
      fontWeightScale: 1.3,
      outlineSize: 3.5,
      baseColor: '#0E7490',
      reliefColor: '#A5F3FC',
    },
  },
];
