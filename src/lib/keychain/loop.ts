import type { KeychainConfig } from '../../types/keychain';
import { LOOP_GAP_MAX, LOOP_GAP_MIN } from './presets';

/** Espessura mínima de ligação (mm) entre a aba da argola e o corpo. */
const LOOP_MIN_JOINT_MM = 1.5;

type LoopGapInput = Pick<KeychainConfig, 'loopLetterGap' | 'outlineSize' | 'loopWallThickness'>;

/**
 * Folga efetiva (mm) entre a borda do furo e a letra mais próxima.
 *
 * O corpo se estende `outline` além da letra e a aba da argola precisa continuar
 * grudada nele: a parte da aba que sobrepõe o corpo vale `outline + parede - folga`
 * e não pode ficar abaixo de max(1,5 mm, parede). Acima disso a aba se soltaria
 * do corpo, então a folga é limitada.
 */
export function resolveLoopGapMm(config: LoopGapInput): number {
  const outlineMm = Math.max(1.5, config.outlineSize);
  const wall = config.loopWallThickness;
  const requested = Number.isFinite(config.loopLetterGap) ? config.loopLetterGap : 0;
  const jointLimit = outlineMm + wall - Math.max(LOOP_MIN_JOINT_MM, wall);
  return Math.max(LOOP_GAP_MIN, Math.min(requested, LOOP_GAP_MAX, jointLimit));
}

/**
 * Deslocamento horizontal (mm) do centro do furo em relação à borda do corpo,
 * medido para DENTRO do corpo (negativo = o furo fica fora do corpo).
 * Com folga `g`, a borda do furo fica a `outline - g` da borda do corpo, ou seja,
 * a `g` mm da letra (a letra começa `outline` mm depois da borda do corpo).
 */
export function loopCenterInsetMm(config: LoopGapInput & Pick<KeychainConfig, 'loopHoleDiameter'>): number {
  const outlineMm = Math.max(1.5, config.outlineSize);
  return outlineMm - resolveLoopGapMm(config) - config.loopHoleDiameter / 2;
}
