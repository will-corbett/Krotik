/** Register labels: Wiktionary's, corrected by hand, on the word rows. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { withRegisters } from '../../scripts/lib/registers.ts';
import { Report } from '../../scripts/lib/report.ts';
import type { WordRow } from '../../src/shared/types.ts';

describe('register labels', () => {
  it('adds Wiktionary’s label, unless the curated list excludes or replaces it', () => {
    const rows: WordRow[] = [
      ['n:1', "карто'шка", 'potato', 'n', 'f'],
      ['n:2', "челове'к", 'person', 'n', 'm'],
      ['n:3', 'башка', 'head', 'n', 'f'],
      ['n:4', "дом", 'house', 'n', 'm'],
    ];
    const wk = { 'картошка|n': 'colloquial', 'человек|n': 'poetic', 'башка|n': 'derogatory' };
    const out = withRegisters(rows, wk, new Report(), { exclude: { человек: 'a note, not a register' }, set: { башка: 'colloquial' } });
    expect(out.map((r) => r[5])).toEqual(['colloquial', undefined, 'colloquial', undefined]);
    expect(() => withRegisters(rows, wk, new Report(), { set: { башка: 'rude' } })).toThrow(/unknown label/);
  });
  it('the built word lists carry labels, and the hand corrections hold', () => {
    const rows = [0, 1, 2].flatMap((b) => JSON.parse(readFileSync(`public/data/words.b${b}.json`, 'utf8')) as WordRow[]);
    const by = (w: string) => rows.find((r) => r[1].replace(/'/g, '') === w);
    expect(by('картошка')?.[5]).toBe('colloquial');
    expect(by('человек')?.[5]).toBeUndefined();
    expect(rows.filter((r) => r[5]).length).toBeGreaterThan(100);
  });
});
