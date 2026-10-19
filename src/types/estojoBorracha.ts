export interface EstojoBorrachaConfig {
  /** Nome gravado na capa ("" = sem texto). */
  text: string;
  fontFamily: string;
  letterHeight: number;
  fontWeightScale: number;

  /** Comprimento interno = lápis máx (mm). */
  compInterno: number;
  /** Altura da caixa (mm) — define o curso da porta. */
  alturaTotal: number;
  /** Número de ripas da porta. */
  nRipas: number;

  /** Cantos verticais arredondados (mm). */
  raioCanto: number;
  /** Largura da faixa/capa ao longo do comprimento (mm). */
  capaLarg: number;

  caixaColor: string;
  capaColor: string;
  /** Relevo do nome: + saliente, − vazio. */
  textoProf: number;
}

export interface EstojoDimensions {
  dimX: number;
  dimY: number;
  dimZ: number;
  volumeCm3: number;
  weightGrams: number;
  printTimeMinutes: number;
  /** Abertura máxima da porta (mm). */
  cursoMax: number;
  /** Largura do nome na capa (mm). */
  nameWidthMm: number;
}

export interface GeneratedEstojo {
  caixaMesh: import('three').Mesh;
  portaMesh: import('three').Mesh;
  plugueMesh: import('three').Mesh;
  capaMesh: import('three').Mesh;
  dimensions: EstojoDimensions;
}
