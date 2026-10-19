import type { EstojoBorrachaConfig } from '../../types/estojoBorracha';

export const CAIXA_MIN = 60;
export const CAIXA_MAX = 200;
export const ALTURA_MIN = 40;
export const ALTURA_MAX = 90;
export const RIPAS_MIN = 5;
export const RIPAS_MAX = 14;

export const DEFAULT_ESTOJO_BORRACHA_CONFIG: EstojoBorrachaConfig = {
  text: 'ANA',
  fontFamily: 'Montserrat',
  letterHeight: 9,
  fontWeightScale: 1.0,

  compInterno: 180,
  alturaTotal: 60,
  nRipas: 9,

  raioCanto: 6,
  capaLarg: 80,

  caixaColor: '#C8894B',
  capaColor: '#5B9BD5',
  textoProf: 1.0,
};

/** Parâmetros fixos do mecanismo (iguais ao .scad — não mexer). */
export const FIXO = {
  passo: 10,
  espessura: 5.2,
  raioCurva: 16,
  folga: 0.35,
  folgaPorta: 1.2,
  capaEsp: 2.0,
  capaFolga: 0.35,
  fw: 3,
  bw: 3,
  fl: 2.4,
  pw: 2.0,
  gd: 3.0,
  pegD: 3.6,
  gx: 0.6,
  e: 3.0,
  gy: 0.4,
  hd: 4.0,
  pd: 2.6,
  ye: 0.5,
  ph: 4.0,
  borda: 3.0,
} as const;

export interface EstojoDerived {
  compInterno: number;
  alturaTotal: number;
  nRipas: number;
  raioCanto: number;
  capaLarg: number;

  re: number;
  R: number;
  cc: number;
  Rd: number;
  Ro: number;
  arco: number;
  gw: number;
  pl: number;
  wy: number;
  Ly: number;
  Yo: number;
  Lt: number;
  x_p0: number;
  xa: number;
  zt: number;
  zc: number;
  ztc: number;
  Xo: number;
  mch: number;
  curso_max: number;
  Hb: number;
  capaLargEff: number;
}

/** Porta fiel do bloco "Geometria derivada" do .scad. */
export function computeDerived(config: EstojoBorrachaConfig): EstojoDerived {
  const F = FIXO;
  const comp = config.compInterno;
  const altura = config.alturaTotal;
  const n = Math.min(RIPAS_MAX, Math.max(RIPAS_MIN, Math.round(config.nRipas)));
  const raioCanto = config.raioCanto;
  const capaLarg = config.capaLarg;

  const re = F.espessura / 2;
  const R = F.raioCurva;
  const cc = F.folgaPorta;
  const Rd = R - re - cc;
  const Ro = R + re + cc;
  const arco = (Math.PI / 2) * R;
  const gw = F.pegD + 2 * F.folga;
  const pl = F.gd - 0.6;
  const wy = F.gd + 3;
  const Ly = comp - 2 * F.ye;
  const Yo = comp + 2 * wy;
  const Lt = n * F.passo - arco;
  const x_p0 = F.fw + re + 0.5;
  const xa = x_p0 + Lt;
  const zt = altura - re;
  const zc = zt - R;
  const ztc = zt - re - cc;
  const Xo = xa + Ro + F.bw;
  const mch = F.pw * Math.sqrt(2);
  const curso_max = zc - F.ph - re - 0.9;
  const Hb = altura + F.borda;

  return {
    compInterno: comp,
    alturaTotal: altura,
    nRipas: n,
    raioCanto,
    capaLarg,
    re,
    R,
    cc,
    Rd,
    Ro,
    arco,
    gw,
    pl,
    wy,
    Ly,
    Yo,
    Lt,
    x_p0,
    xa,
    zt,
    zc,
    ztc,
    Xo,
    mch,
    curso_max,
    Hb,
    capaLargEff: Math.min(capaLarg, Yo),
  };
}
