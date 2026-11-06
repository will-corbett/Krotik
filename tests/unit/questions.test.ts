import { describe, expect, it } from 'vitest';
import { VERB_CELLS } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { generateAdjectiveQuestions } from '../../src/lib/questions/adjectives.ts';
import { generateAspectQuestions } from '../../src/lib/questions/aspect.ts';
import { generateMotionQuestions } from '../../src/lib/questions/motion.ts';
import { generateVerbQuestions, verbFormQuestion } from '../../src/lib/questions/verbs.ts';
import { chooseSentence, toVerb } from '../../src/lib/data.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { taskText } from '../../src/lib/terms.ts';
import { adjectives, motion, nouns, verb, verbs } from './fixtures.ts';

describe('verb form questions', () => {
  it('generates n unique questions from the selected groups only', () => {
    const qs = generateVerbQuestions(verbs, { groups: ['past'] }, 20, mulberry32(1));
    expect(qs).toHaveLength(20);
    expect(new Set(qs.map((q) => q.key)).size).toBe(20);
    for (const q of qs) expect(taskText(q.task)).toMatch(/^Past/);
    expect(new Set(qs.map((q) => q.headword)).size).toBe(20); // distinct verbs
  });

  it('is deterministic for a seed', () => {
    const a = generateVerbQuestions(verbs, { groups: ['presfut', 'past', 'imperative'] }, 10, mulberry32(7)).map((q) => q.key);
    const b = generateVerbQuestions(verbs, { groups: ['presfut', 'past', 'imperative'] }, 10, mulberry32(7)).map((q) => q.key);
    expect(a).toEqual(b);
  });

  it('labels present for imperfective and future for perfective', () => {
    expect(taskText(verbFormQuestion(verb('говорить'), 0).task)).toBe('Present · я');
    expect(taskText(verbFormQuestion(verb('сказать'), 0).task)).toBe('Future · я');
  });

  it('never asks for быть present (blanked by override)', () => {
    const b = verb('быть');
    const qs = generateVerbQuestions([b], { groups: ['presfut'] }, 5, mulberry32(3));
    expect(qs).toEqual([]);
    expect(generateVerbQuestions([b], { groups: ['past'] }, 4, mulberry32(3))).toHaveLength(4);
  });

  it('every answer is a non-empty cell with real forms', () => {
    for (const q of generateVerbQuestions(verbs, { groups: ['presfut', 'past', 'imperative'] }, 40, mulberry32(9))) {
      expect(cellForms(q.answer).length).toBeGreaterThan(0);
    }
  });

  it('speaks pronoun + form', () => {
    expect(verbFormQuestion(verb('сказать'), 7).speak("сказа'ла")).toBe('она сказала');
    expect(verbFormQuestion(verb('сказать'), 10).speak("скажи'")).toBe('скажи');
  });
});

describe('Russian grammar terms', () => {
  it('pairs every English grammar term in a task with its Russian equivalent', () => {
    const qs = [
      ...generateVerbQuestions(verbs, { groups: ['presfut', 'past', 'imperative'] }, 20, mulberry32(11)),
      ...generateAspectQuestions(verbs, { direction: 'both' }, 10, mulberry32(11)),
      ...generateAdjectiveQuestions(adjectives, nouns, { cases: ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'], number: 'both' }, 20, mulberry32(11)),
    ];
    for (const q of qs) for (const p of q.task) if (p.en && !/^→|Name the verb/.test(p.en)) expect(p.ru, p.en).toBeTruthy();
    expect(verbFormQuestion(verb('сказать'), 7).task[0]).toEqual({ en: 'Past', ru: 'прошедшее время' });
  });
  it('form labels carry the Russian term too', () => {
    expect(verbFormQuestion(verb('сказать'), 0).others.find((o) => o.label.startsWith('Past, она'))!.label).toBe('Past, она form (прошедшее время)');
  });
});

describe('aspect questions', () => {
  it('asks for the opposite-aspect partner in the chosen direction', () => {
    const qs = generateAspectQuestions(verbs, { direction: 'to-pf' }, 10, mulberry32(2));
    expect(qs).toHaveLength(10);
    for (const q of qs) expect(taskText(q.task)).toMatch(/^imperfective · → give the perfective/);
    const back = generateAspectQuestions(verbs, { direction: 'to-impf' }, 10, mulberry32(2));
    for (const q of back) expect(taskText(q.task)).toMatch(/^perfective/);
  });
});

describe('adjective questions', () => {
  it('only uses the selected cases and number', () => {
    const qs = generateAdjectiveQuestions(adjectives, nouns, { cases: ['dat', 'inst'], number: 'pl' }, 20, mulberry32(4));
    expect(qs).toHaveLength(20);
    for (const q of qs) {
      expect(taskText(q.task)).toMatch(/^(Dative|Instrumental) · plural/);
      expect(q.frame).toMatch(/^___ /);
    }
  });
});

describe('motion questions', () => {
  const vmap = new Map(motion.verbs.map((r) => [r[0], toVerb(r, 0)]));
  it('covers the 12 pairs and the selected types', () => {
    expect(motion.pairs).toHaveLength(12);
    const qs = generateMotionQuestions(motion.pairs, vmap, { types: ['meaning'] }, 10, mulberry32(5));
    expect(qs).toHaveLength(10);
    for (const q of qs) expect(q.headwordIsEnglish).toBe(true);
  });
  it('mixes types when several are selected', () => {
    const qs = generateMotionQuestions(motion.pairs, vmap, { types: ['meaning', 'partner', 'conjugate'] }, 30, mulberry32(6));
    const kinds = new Set(qs.map((q) => q.key.split(':')[1]));
    expect(kinds).toEqual(new Set(['meaning', 'partner', 'conj']));
    for (const q of qs.filter((x) => x.key.includes(':conj:'))) expect(VERB_CELLS.some((c) => taskText(q.task).endsWith(c.person))).toBe(true);
  });
});

describe('chooseSentence', () => {
  const rows: [number, string, string, number, number, number][] = [
    [1, 'Он сказал.', 'He said.', 1 << 6, 3, 9],
    [2, 'Она сказала.', 'She said.', 1 << 7, 4, 11],
  ];
  it('only returns a sentence whose highlighted word is the answer form', () => {
    expect(chooseSentence(rows, 7, "сказа'ла")![0]).toBe(2);
    expect(chooseSentence(rows, 6, "сказа'л")![0]).toBe(1);
  });
  it('never falls back to another form of the word', () => {
    expect(chooseSentence(rows, 0, "скажу'")).toBeUndefined();
    expect(chooseSentence(rows, -1, 'читающий')).toBeUndefined();
    expect(chooseSentence(undefined, 0, "сказа'л")).toBeUndefined();
  });
  it('accepts any variant of the answer', () => {
    expect(chooseSentence(rows, -1, "сказа'л,(сказа'ла)")![0]).toBe(1);
  });
});
