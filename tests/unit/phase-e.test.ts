import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClozeRow, NumeralRow } from '../../src/shared/types.ts';
import { checkAnswer } from '../../src/lib/check.ts';
import { explainFor } from '../../src/lib/questions/cloze.ts';
import { generateGovernmentChoice, governmentChoiceQuestion, type GovRow } from '../../src/lib/questions/government.ts';
import { compoundQuestion, generateExtraNumberQuestions, ordinalQuestion, type OrdinalRow } from '../../src/lib/questions/numbers.ts';
import { generatePrefixedMotion, type PrefixedData } from '../../src/lib/questions/prefixedMotion.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { noun, nouns, nouns1000, numeral, numerals } from './fixtures.ts';

const json = <T>(f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;
const gov = json<GovRow[]>('government.json');
const pm = json<PrefixedData>('prefixed-motion.json');
const ordinals = json<OrdinalRow[]>('ordinals.json');
const collectives = json<NumeralRow[]>('collectives.json');

describe('verb government', () => {
  it('asks which case the verb takes, from the hand-made list', () => {
    const row = gov.find((r) => r[1].replace(/'/g, '') === 'помогать')!;
    const q = governmentChoiceQuestion(row, gov, mulberry32(1));
    expect(q.choices).toHaveLength(4);
    expect(q.choices).toContain('+ дательный (кому? чему?)');
    expect(checkAnswer(q, '+ дательный (кому? чему?)').correct).toBe(true);
  });
  it('never offers a verb’s other valid pattern as a wrong option (отвечать кому / на что)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const row = gov.find((r) => r[1].replace(/'/g, '') === 'отвечать' && r[2] === 'dat')!;
      const q = governmentChoiceQuestion(row, gov, mulberry32(seed));
      expect(q.choices).not.toContain('на + винительный (на кого? на что?)');
    }
  });
  it('sentence items name the verb and pattern', () => {
    expect(explainFor("dat|помога'ть")).toBe('помогать + дательный (кому? чему?).');
    const rows = json<ClozeRow[]>('cloze.government.json');
    expect(new Set(rows.map((r) => r[7].split('|')[0])).size).toBeGreaterThanOrEqual(8);
  });
  it('generates n questions', () => {
    expect(generateGovernmentChoice(gov, 20, mulberry32(9))).toHaveLength(20);
  });
});

describe('prefixed motion verbs', () => {
  const bare = (id: number) => pm.verbs.find((r) => r[0] === id)![1].replace(/'/g, '');
  it('builds pairs only from verbs in the data, with the о/ъ links', () => {
    const pairs = pm.pairs.map((p) => `${bare(p.pf)}/${bare(p.impf)}`);
    for (const p of ['прийти/приходить', 'войти/входить', 'подойти/подходить', 'въехать/въезжать', 'выйти/выходить', 'перейти/переходить']) {
      expect(pairs).toContain(p);
    }
    for (const p of pm.pairs) {
      expect(pm.verbs.find((r) => r[0] === p.pf)![3]).toBe('pf');
      expect(pm.verbs.find((r) => r[0] === p.impf)![3]).toBe('impf');
    }
  });
  it('generates all three types', () => {
    const qs = generatePrefixedMotion(pm, { types: ['meaning', 'pair', 'conjugate'] }, 60, mulberry32(3));
    expect(new Set(qs.map((q) => q.key.split(':')[1]))).toEqual(new Set(['meaning', 'pair', 'conj']));
  });
});

describe('ordinal, compound and collective numbers', () => {
  it('ordinals agree with the noun (на третьем этаже)', () => {
    const third = ordinals.find((r) => r[1] === 3)!;
    expect(checkAnswer(ordinalQuestion(third, nouns1000.find((n) => n.accented.replace(/'/g, '') === 'этаж')!, 'prep', false)!, 'третьем').correct).toBe(true);
    const first = ordinals.find((r) => r[1] === 1)!;
    expect(checkAnswer(ordinalQuestion(first, noun('книга'), 'acc', false)!, 'первую').correct).toBe(true);
  });
  it('compound numbers decline every part', () => {
    expect(checkAnswer(compoundQuestion(numeral('двадцать'), numeral('пять'), 'gen', 'm')!, 'двадцати пяти').correct).toBe(true);
    expect(checkAnswer(compoundQuestion(numeral('двадцать'), numeral('пять'), 'inst', 'm')!, 'двадцатью пятью').correct).toBe(true);
    expect(checkAnswer(compoundQuestion(numeral('тридцать'), numeral('один'), 'nom', 'f')!, 'тридцать одна').correct).toBe(true);
    expect(checkAnswer(compoundQuestion(numeral('сорок'), numeral('два'), 'dat', 'm')!, 'сорока двум').correct).toBe(true);
  });
  it('collective numerals decline (двое → двоих)', () => {
    expect(collectives.map((r) => r[0].replace(/'/g, ''))).toEqual(['двое', 'трое', 'четверо', 'пятеро', 'шестеро', 'семеро']);
    const qs = generateExtraNumberQuestions('collective', { numerals, ordinals, collectives, nouns }, ['gen'], 4, mulberry32(4));
    expect(qs.length).toBeGreaterThan(0);
    const two = qs.find((q) => q.headword.replace(/'/g, '') === 'двое');
    if (two) expect(checkAnswer(two, 'двоих').correct).toBe(true);
  });
});

describe('verbs of position', () => {
  it('offers state / put / get-into-position in the same form, keeping ё', () => {
    const rows = json<ClozeRow[]>('cloze.position.json');
    const lyog = rows.find((r) => r[8].includes('лёг'))!;
    expect(lyog[8]).toEqual(expect.arrayContaining(['лежал', 'положил', 'лёг']));
    expect(new Set(rows.map((r) => r[7].split(':')[0]))).toEqual(new Set(['stand', 'lie', 'sit', 'hang']));
  });
});
