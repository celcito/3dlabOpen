import { describe, expect, it } from 'vitest';
import { bridgeEmptyColumns, closeNarrowGaps } from '../nameTray';

const row = (s: string) => Uint8Array.from(s, (c) => (c === '#' ? 1 : 0));
const show = (a: Uint8Array) => Array.from(a, (v) => (v ? '#' : '.')).join('');

describe('nameTray/closeNarrowGaps', () => {
  it('fecha vãos estreitos entre dois sólidos', () => {
    const a = row('##..##');
    closeNarrowGaps(a, 6, 1, 2);
    expect(show(a)).toBe('######');
  });

  it('mantém vãos mais largos que o limite', () => {
    const a = row('##...##');
    closeNarrowGaps(a, 7, 1, 2);
    expect(show(a)).toBe('##...##');
  });

  it('não preenche bordas (sem sólido dos dois lados) e trata cada linha separadamente', () => {
    const a = row('..#.#..' + '.#...#.');
    closeNarrowGaps(a, 7, 2, 1);
    expect(show(a)).toBe('..###..' + '.#...#.');
  });
});

describe('nameTray/bridgeEmptyColumns', () => {
  it('une dois corpos separados por coluna vazia, só nas linhas com sólido dos dois lados', () => {
    const a = row('##....##' + '##....##' + '##......' + '........');
    expect(bridgeEmptyColumns(a, 8, 4, 3)).toBe(1);
    expect(show(a)).toBe('########' + '########' + '##......' + '........');
  });

  it('não mexe quando não há coluna vazia', () => {
    const a = row('#.#' + '###');
    expect(bridgeEmptyColumns(a, 3, 2, 3)).toBe(0);
    expect(show(a)).toBe('#.#' + '###');
  });
});
