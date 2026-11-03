import type { MedalConfig } from '../../types/medal';

type HandleColorInput = Pick<
  MedalConfig,
  'handleUseBodyColor' | 'handleColorSync' | 'handleColor' | 'rimColor' | 'backgroundColor'
>;

/**
 * Cor efetiva da alça/passador.
 *
 * A alça sobe da mesa até `handleThicknessZ` (por padrão igual à base). Se ela tiver
 * cor diferente da base, TODAS as camadas da base levam duas cores (corpo + alça) e o
 * fatiador troca de filamento a cada camada. Com `handleUseBodyColor` a alça usa a cor
 * do corpo: até a altura da base só existe uma cor, e a troca para a cor da borda
 * acontece uma única vez, na camada do relevo.
 */
export function resolveHandleColor(config: HandleColorInput): string {
  if (config.handleUseBodyColor) return config.backgroundColor;
  return config.handleColorSync ? config.rimColor : config.handleColor;
}
