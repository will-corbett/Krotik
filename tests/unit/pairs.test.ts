import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AdjRow, Collocations } from '../../src/shared/types.ts';
import { toAdjective } from '../../src/lib/data.ts';
import { partnerPicker } from '../../src/lib/pairs.ts';
import { generateAdjectiveQuestions } from '../../src/lib/questions/adjectives.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { DEFAULTS } from '../../src/lib/settings.ts';
import { nouns1000 } from './fixtures.ts';

const pairs = JSON.parse(readFileSync('public/data/collocations.json', 'utf8')) as Collocations;
const adjs = (JSON.parse(readFileSync('public/data/adjectives.b0.json', 'utf8')) as AdjRow[]).map((r) => toAdjective(r, 0));
const name = (id: number) => nouns1000.find((n) => n.id === id)?.accented.replace(/'/g, '');

describe('real adjective + noun pairs', () => {
  it('common adjectives have common partners from real sentences', () => {
    expect((pairs.adj['новый'] ?? []).map(name)).toContain('машина');
    expect((pairs.adj['первый'] ?? []).map(name)).toContain('этаж');
  });
  it('agreement questions only pair an adjective with one of its partners', () => {
    const qs = generateAdjectiveQuestions(adjs, nouns1000, DEFAULTS.adjectives, 60, mulberry32(4), partnerPicker(pairs, nouns1000));
    expect(qs.length).toBe(60);
    for (const q of qs) {
      const adj = q.headword.replace(/'/g, '');
      const noun = nouns1000.find((n) => q.note?.startsWith(n.accented + ' '))!;
      expect(pairs.adj[adj], `${adj} + ${noun.accented}`).toContain(noun.id);
    }
  });
  it('наш and ваш borrow the partners of мой and твой', () => {
    const pick = partnerPicker(pairs, nouns1000);
    const n = pick({ adj: 'ваш' }, mulberry32(1));
    expect(n).toBeTruthy();
    expect(pairs.adj['твой']).toContain(n!.id);
  });
  it('no month names (dates are their own question type)', () => {
    const months = ['январь', 'май', 'август'].map((m) => nouns1000.find((n) => n.accented.replace(/'/g, '') === m)?.id);
    for (const list of Object.values(pairs.adj)) for (const m of months) if (m) expect(list).not.toContain(m);
  });
});
