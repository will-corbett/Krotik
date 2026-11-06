import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AdverbRow, ClozeRow, DatesData, PronounData, SpecialCaseRow } from '../../src/shared/types.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { checkAnswer } from '../../src/lib/check.ts';
import { adverbSource } from '../../scripts/lib/wiktionary.ts';
import { adverbComparativeQuestion, adverbFormQuestion, generateNarechiyaQuestions } from '../../src/lib/questions/narechiya.ts';
import { centuryQuestion, dateQuestion, generateOrdinalQuestions } from '../../src/lib/questions/ordinals.ts';
import { aboutQuestion, generateSpecialCaseQuestions, locativeQuestion } from '../../src/lib/questions/specialCases.ts';
import { generateQuestionWordQuestions } from '../../src/lib/questions/questionWords.ts';
import type { OrdinalRow } from '../../src/lib/questions/numbers.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { nouns1000 } from './fixtures.ts';

const json = <T>(f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;
const adverbs = json<AdverbRow[]>('adverbs.json');
const special = json<SpecialCaseRow[]>('special-cases.json');
const dates = json<DatesData>('dates.json');
const ordinals = json<OrdinalRow[]>('ordinals.json');
const plain = (s: string) => s.replace(/'/g, '');
const adv = (adj: string) => adverbs.find((r) => plain(r[1]) === adj)!;
const sc = (noun: string) => special.find((r) => plain(r[1]) === noun)!;

describe('adverbs (наречия)', () => {
  it('reads the adjective from a Wiktionary etymology', () => {
    expect(adverbSource('бы́стрый (býstryj, “fast, quick”) + -о (-o, “-ly”, adverb-forming suffix)')).toBe('быстрый');
    expect(adverbSource('Adverbial form of ру́сский (rússkij), "Russian".')).toBe('русский');
    expect(adverbSource('Inherited from Proto-Slavic *poslě.')).toBeNull();
  });
  it('pairs common adjectives with their adverbs, stress from Wiktionary', () => {
    expect(adv('хороший')[2]).toBe("хорошо'");
    expect(adv('русский')[2]).toBe("по-ру'сски");
    expect(adv('тяжёлый')[2]).toBe("тяжело'");
    expect(adv('хороший')[3]).toContain("лу'чше");
    expect(adverbs.find((r) => plain(r[1]) === 'должный')).toBeUndefined(); // excluded by override
  });
  it('asks adjective → adverb and adverb → comparative', () => {
    const q = adverbFormQuestion(adv('быстрый'));
    expect(checkAnswer(q, 'быстро').correct).toBe(true);
    const c = adverbComparativeQuestion(adv('быстрый'))!;
    expect(checkAnswer(c, 'быстрее').correct).toBe(true);
    expect(checkAnswer(c, 'побыстрее').correct).toBe(true);
  });
  it('adverb-or-adjective sentences offer both, and the answer is the sentence’s own word', () => {
    const rows = json<ClozeRow[]>('cloze.narechiya.json');
    expect(new Set(rows.map((r) => r[7]))).toEqual(new Set(['adv', 'adj']));
    for (const r of rows.slice(0, 300)) {
      expect(r[8]).toHaveLength(2);
      expect(r[8]).toContain(r[5]);
      expect(normalise(r[1].slice(r[3], r[4]))).toBe(normalise(r[5]));
    }
  });
  it('generates a mixed round', () => {
    const cz = json<ClozeRow[]>('cloze.narechiya.json');
    expect(generateNarechiyaQuestions(adverbs, cz, { types: ['form', 'comparative', 'sentence'] }, 1, 20, mulberry32(3))).toHaveLength(20);
  });
});

describe('question words', () => {
  const pronouns = json<PronounData>('pronouns.json');
  const cloze = json<ClozeRow[]>('cloze.questionWords.json');
  it('real questions: the answer is the sentence’s word, options are forms of the same word', () => {
    for (const r of cloze.slice(0, 300)) {
      expect(r[1]).toMatch(/\?\s*$/);
      expect(r[8]).toContain(r[5]);
      expect(normalise(r[1].slice(r[3], r[4]))).toBe(normalise(r[5]));
    }
    // что and чего are never offered against each other (Что/Чего ты хочешь? are both possible)
    for (const r of cloze.filter((x) => ['что', 'чего'].includes(x[5]))) expect(r[8].filter((o) => ['что', 'чего'].includes(o))).toHaveLength(1);
  });
  it('generates table and sentence questions', () => {
    const qs = generateQuestionWordQuestions({ pronouns, kakoy: undefined, nouns: nouns1000, cloze }, { types: ['table', 'sentence'] }, 20, mulberry32(5));
    expect(qs).toHaveLength(20);
    for (const q of qs) expect(q.mode).toBe('questionWords');
  });
});

describe('ordinals and dates', () => {
  it('builds dates from the ordinal and the month’s genitive', () => {
    expect(checkAnswer(dateQuestion(ordinals, dates, 5, 4, true)!, 'пятого мая').correct).toBe(true);
    expect(checkAnswer(dateQuestion(ordinals, dates, 5, 4, false)!, 'пятое мая').correct).toBe(true);
    // compound: only the last word is an ordinal
    expect(checkAnswer(dateQuestion(ordinals, dates, 21, 0, true)!, 'двадцать первого января').correct).toBe(true);
    expect(dateQuestion(ordinals, dates, 31, 1, true)).toBeNull(); // no 31 February
  });
  it('centuries: в + prepositional', () => {
    expect(checkAnswer(centuryQuestion(ordinals, dates, 20, true)!, 'двадцатом веке').correct).toBe(true);
    expect(checkAnswer(centuryQuestion(ordinals, dates, 21, false)!, 'двадцать первый век').correct).toBe(true);
  });
  it('generates a round of every type', () => {
    const qs = generateOrdinalQuestions(ordinals, dates, nouns1000, { types: ['agree', 'dates', 'centuries'] }, 20, mulberry32(2));
    expect(qs).toHaveLength(20);
    for (const q of qs) expect(q.mode).toBe('ordinals');
  });
});

describe('special case forms', () => {
  it('second prepositional differs from the ordinary prepositional', () => {
    expect(cellForms(sc('лес')[3]).map(plain)).toContain('лесу');
    expect(cellForms(sc('лес')[5]).map(plain)).toContain('лесе');
    expect(checkAnswer(locativeQuestion(sc('лес'))!, 'лесу').correct).toBe(true);
    expect(checkAnswer(aboutQuestion(sc('лес'))!, 'лесе').correct).toBe(true);
    // typing the о-form for в/на is named as the other form
    expect(checkAnswer(locativeQuestion(sc('лес'))!, 'лесе').otherForm).toBeTruthy();
  });
  it('only masculine nouns, and only -у/-ю forms', () => {
    for (const r of special) for (const f of [...cellForms(r[3]), ...cellForms(r[6])]) expect(normalise(f)).toMatch(/[ую]$/);
  });
  it('sentence items: в/на + the -у form, typed', () => {
    const rows = json<ClozeRow[]>('cloze.specialCases.json');
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) {
      expect(r[8]).toEqual([]);
      expect(r[1].slice(0, r[3])).toMatch(/(^|\s)(в|во|на|В|Во|На)\s$/);
    }
  });
  it('generates a round', () => {
    const cz = json<ClozeRow[]>('cloze.specialCases.json');
    expect(generateSpecialCaseQuestions(special, cz, { types: ['form', 'sentence'] }, 3, 20, mulberry32(4))).toHaveLength(20);
  });
});
