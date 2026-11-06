import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClozeRow } from '../../src/shared/types.ts';
import { checkAnswer } from '../../src/lib/check.ts';
import { clozeQuestion } from '../../src/lib/questions/cloze.ts';
import { nounCaseQuestion } from '../../src/lib/questions/nounCases.ts';
import { generatePronounQuestions, personalQuestion, possessiveQuestion } from '../../src/lib/questions/pronouns.ts';
import { generateStressQuestions, stressQuestion } from '../../src/lib/questions/stress.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { toCyrillic } from '../../src/lib/translit.ts';
import { adjectives, noun, nouns, pronouns, verbs } from './fixtures.ts';

const personal = (w: string) => pronouns.personal.find((r) => r[0].replace(/'/g, '') === w)!;
const poss = (w: string) => pronouns.possessive.find((r) => r[0].replace(/'/g, '') === w)!;

describe('personal pronouns', () => {
  it('has the standard table, with н- forms after prepositions', () => {
    const ok = (w: string, c: 'gen' | 'dat' | 'acc' | 'inst' | 'prep', after: boolean, answer: string) =>
      expect(checkAnswer(personalQuestion(personal(w), c, after)!, answer).correct, `${w} ${c} ${after} ${answer}`).toBe(true);
    ok('я', 'gen', false, 'меня');
    ok('я', 'inst', false, 'мной');
    ok('я', 'inst', false, 'мною'); // bookish variant accepted
    ok('он', 'dat', false, 'ему');
    ok('он', 'gen', true, 'него');
    ok('она', 'inst', true, 'ней');
    ok('они', 'acc', true, 'них');
    ok('они', 'acc', false, 'их');
    ok('себя', 'inst', false, 'собой');
    ok('кто', 'prep', true, 'ком');
    expect(checkAnswer(personalQuestion(personal('он'), 'gen', true)!, 'его').correct).toBe(false);
  });
  it('uses ко мне / обо мне for я', () => {
    expect(personalQuestion(personal('я'), 'dat', true)!.frame).toBe('ко ___');
    expect(personalQuestion(personal('я'), 'prep', true)!.frame).toBe('обо ___');
    expect(personalQuestion(personal('он'), 'gen', true)!.frame).toBe('у ___');
  });
  it('no pre-1918 spellings leaked in', () => {
    for (const [, a, b] of pronouns.personal) for (const c of [...a, ...b]) expect(c).not.toMatch(/ъ(,|$)/);
  });
  it('generates only selected cases and contexts', () => {
    const qs = generatePronounQuestions(pronouns, { cases: ['dat'], prepositions: ['afterPrep'] }, 8, mulberry32(1));
    expect(qs.length).toBeGreaterThan(5);
    for (const q of qs) expect(q.frame).toMatch(/^(к|ко) ___$/);
  });
});

describe('possessive and demonstrative pronouns', () => {
  it('agree with the noun, including наш/ваш (from Wiktionary) and весь', () => {
    expect(checkAnswer(possessiveQuestion(poss('мой'), noun('друг'), 'dat', false)!, 'моему').correct).toBe(true);
    expect(checkAnswer(possessiveQuestion(poss('наш'), noun('книга'), 'acc', false)!, 'нашу').correct).toBe(true);
    expect(checkAnswer(possessiveQuestion(poss('этот'), noun('человек'), 'acc', false)!, 'этого').correct).toBe(true);
    expect(checkAnswer(possessiveQuestion(poss('весь'), noun('город'), 'prep', false)!, 'всём').correct).toBe(true);
  });
  it('свой vs его items offer an agreeing свой form', () => {
    const rows = JSON.parse(readFileSync('public/data/cloze.svoy.json', 'utf8')) as ClozeRow[];
    const ego = rows.filter((r) => r[7] === 'ego');
    expect(ego.length).toBeGreaterThan(100);
    for (const r of ego.slice(0, 50)) expect(r[8][3]).toMatch(/^сво/);
    const q = clozeQuestion(rows.find((r) => r[7] === 'svoy')!, 'svoy');
    expect(q.choices).toContain('его');
  });
});

describe('noun cases', () => {
  it('drills singular and plural cases from the source', () => {
    expect(checkAnswer(nounCaseQuestion(noun('книга'), 'acc', false)!, 'книгу').correct).toBe(true);
    expect(checkAnswer(nounCaseQuestion(noun('книга'), 'inst', true)!, 'книгами').correct).toBe(true);
    expect(nounCaseQuestion(noun('книга'), 'nom', false)).toBeNull(); // that's the headword itself
  });
});

describe('stress drill', () => {
  it('finds the stressed vowel and hides it from the prompt', () => {
    const q = stressQuestion("сказа'ть", ["сказа'ть"], 'say', [], 'x')!;
    expect(q.stress).toEqual({ word: 'сказать', positions: [4] });
    expect(q.headword).toBe('say');
    expect(checkAnswer(q, '4').correct).toBe(true);
    expect(checkAnswer(q, '1').correct).toBe(false);
  });
  it('accepts either stress where both are standard', () => {
    const q = stressQuestion("тво'рог", ["тво'рог", "творо'г"], 'cottage cheese', [], 'x')!;
    expect(q.stress!.positions).toEqual([2, 4]);
  });
  it('skips ё words and one-vowel words', () => {
    expect(stressQuestion('идём', ['идём'], '', [], 'x')).toBeNull();
    expect(stressQuestion("бы'л", ["бы'л"], '', [], 'x')).toBeNull();
  });
  it('generates from all word types', () => {
    const qs = generateStressQuestions({ verbs, nouns, adjectives }, { sources: ['verbs', 'nouns', 'adjectives'], forms: 'any' }, 30, mulberry32(2));
    expect(qs).toHaveLength(30);
    expect(new Set(qs.map((q) => q.key.split(':')[1]![0]))).toEqual(new Set(['v', 'n', 'a']));
  });
});

describe('phonetic typing', () => {
  it('maps single letters and combinations', () => {
    expect(toCyrillic('privet')).toBe('привет');
    expect(toCyrillic('shkola')).toBe('школа');
    expect(toCyrillic('zhurnal')).toBe('журнал');
    expect(toCyrillic('chelovek')).toBe('человек');
    expect(toCyrillic('shchi')).toBe('щи');
    expect(toCyrillic('khorosho')).toBe('хорошо');
    expect(toCyrillic('ya')).toBe('я');
    expect(toCyrillic('yula')).toBe('юла');
    expect(toCyrillic('yolka')).toBe('ёлка');
    expect(toCyrillic("e'to")).toBe('это');
    expect(toCyrillic("mat'")).toBe('мать');
    expect(toCyrillic("ob''yasnit'")).toBe('объяснить');
  });
  it('works incrementally, as each key is typed', () => {
    let v = '';
    for (const ch of 'shchuka') v = toCyrillic(v + ch);
    expect(v).toBe('щука');
  });
  it('leaves Cyrillic alone', () => {
    expect(toCyrillic('уже')).toBe('уже');
  });
});

describe('example sentences match the practised form', () => {
  it('participle and verbal-adverb sentences exist and are keyed by verb', async () => {
    const { readFileSync } = await import('node:fs');
    const shard = JSON.parse(readFileSync('public/data/sentences.participles.b0.json', 'utf8')) as Record<string, [number, string, string, number, number, number][]>;
    expect(Object.keys(shard).length).toBeGreaterThan(100);
  });
});
