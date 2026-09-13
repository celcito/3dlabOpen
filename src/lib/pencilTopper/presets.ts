import type { PencilModelOption, PencilColorPalette, PresetSymbol, PencilTopperConfig } from '../../types/pencilTopper';

export const PENCIL_MODELS: PencilModelOption[] = [
  {
    id: 'bic-cristal',
    name: 'Caneta BIC Cristal',
    emoji: '🖊️',
    defaultDiameter: 8.3,
    description: 'Diâmetro padrão 8.3 mm para canetas esferográficas BIC Cristal',
    defaultHoleShape: 'round',
  },
  {
    id: 'lapis-redondo',
    name: 'Lápis Comum Redondo',
    emoji: '✏️',
    defaultDiameter: 7.7,
    description: 'Diâmetro padrão 7.7 mm para lápis escolares redondos',
    defaultHoleShape: 'round',
  },
  {
    id: 'lapis-hexagonal',
    name: 'Lápis Hexagonal (Sextavado)',
    emoji: '⬡',
    defaultDiameter: 7.8,
    description: 'Diâmetro padrão 7.8 mm para lápis sextavados (Faber-Castell, etc.)',
    defaultHoleShape: 'hexagonal',
  },
  {
    id: 'personalizado',
    name: 'Personalizado / Outro',
    emoji: '⚙️',
    defaultDiameter: 8.3,
    description: 'Diâmetro livremente ajustável de 5.0 a 15.0 mm',
    defaultHoleShape: 'round',
  },
];

export const PENCIL_COLOR_PALETTES: PencilColorPalette[] = [
  { id: 'padrao-escuro', name: 'Preto & Ouro', baseColor: '#111827', reliefColor: '#FBBF24' },
  { id: 'princesas', name: 'Princesas', baseColor: '#831843', reliefColor: '#FDF2F8' },
  { id: 'classic-disney', name: 'Classic Disney', baseColor: '#111827', reliefColor: '#EF4444' },
  { id: 'cyberpunk', name: 'Cyberpunk', baseColor: '#09090B', reliefColor: '#06B6D4' },
  { id: 'candy', name: 'Candy', baseColor: '#F472B6', reliefColor: '#A7F3D0' },
  { id: 'minimal-white', name: 'Minimal White', baseColor: '#F8FAFC', reliefColor: '#0F172A' },
  { id: 'emerald', name: 'Emerald', baseColor: '#064E3B', reliefColor: '#FBBF24' },
  { id: 'ruby', name: 'Ruby', baseColor: '#881337', reliefColor: '#FBBF24' },
];

export const PRESET_SYMBOLS: PresetSymbol[] = [
  { id: 'none', name: 'Nenhum', emoji: '🚫' },
  { id: 'heart', name: 'Coração', emoji: '❤️' },
  { id: 'star', name: 'Estrela', emoji: '⭐' },
  { id: 'crown', name: 'Coroa', emoji: '👑' },
  { id: 'butterfly', name: 'Borboleta', emoji: '🦋' },
  { id: 'flower', name: 'Flor', emoji: '🌸' },
  { id: 'dino', name: 'Dino', emoji: '🦖' },
  { id: 'gamepad', name: 'Gamer', emoji: '🎮' },
  { id: 'ball', name: 'Futebol', emoji: '⚽' },
  { id: 'gradcap', name: 'Formatura', emoji: '🎓' },
];

export const DEFAULT_PENCIL_CONFIG: PencilTopperConfig = {
  pencilModel: 'bic-cristal',
  pencilDiameter: 8.3,
  clearance: 0.0,
  holeShape: 'round',
  holeOrientation: 'horizontal',
  socketHeight: 12.5,
  text: 'Helena',
  fontFamily: 'Pacifico',
  letterHeight: 16,
  letterSpacing: 1.8,
  symbolId: 'none',
  symbolPosition: 'left',
  outlineSize: 2.8,
  baseWallThickness: 2.1,
  reliefThickness: 2.0,
  baseColor: '#111827',
  reliefColor: '#FBBF24',
  showPencilGuide: false,
  showDimensionsOverlay: true,
  environmentMode: 'plate',
};
