import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../../src/lib/check.ts';
import { adverbQuestion, generateAdverbQuestions } from '../../src/lib/questions/adverbs.ts';
import { fromDiminutiveQuestion, generateDiminutiveQuestions, toDiminutiveQuestion } from '../../src/lib/questions/diminutives.ts';
import { generateNumberQuestions, numeralAloneQuestion, numeralForm, numeralNounQuestion } from '../../src/lib/questions/numbers.ts';
import { generateParticipleQuestions, participleDeclineQuestion, participleFormQuestion, shortPassiveQuestion } from '../../src/lib/questions/participles.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { taskText } from '../../src/lib/terms.ts';
import { diminutives, noun, nouns1000, numeral, numerals, participle, participles } from './fixtures.ts';

describe('verbal adverbs (деепричастия)', () => {
  it('imperfective → present, perfective → past', () => {
    const chit = participle('читать');
    const q = adverbQuestion(chit.row, chit.band, 'impf')!;
    expect(checkAnswer(q, 'читая').correct).toBe(true);
    const pro = participle('прочитать');
    const p = adverbQuestion(pro.row, pro.band, 'pf')!;
    expect(checkAnswer(p, 'прочитав').correct).toBe(true);
    expect(checkAnswer(p, 'прочитавши').correct).toBe(true); // optional -вши
    expect(adverbQuestion(pro.row, pro.band, 'impf')).toBeNull();
  });
  it('keeps irregulars from Wiktionary (идти → идя)', () => {
    const q = adverbQuestion(participle('идти').row, 0, 'impf')!;
    expect(checkAnswer(q, 'идя').correct).toBe(true);
  });
  it('generates the selected aspects only', () => {
    const qs = generateAdverbQuestions(participles, { aspects: ['pf'] }, 20, mulberry32(1));
    expect(qs).toHaveLength(20);
    for (const q of qs) expect(taskText(q.task)).toBe('Perfective verbal adverb');
  });
});

describe('participles (причастия)', () => {
  it('forms each kind from Wiktionary', () => {
    const c = participle('читать');
    expect(checkAnswer(participleFormQuestion(c.row, 0, 'act_pres')!, 'читающий').correct).toBe(true);
    expect(checkAnswer(participleFormQuestion(c.row, 0, 'act_past')!, 'читавший').correct).toBe(true);
    expect(checkAnswer(participleFormQuestion(c.row, 0, 'pass_pres')!, 'читаемый').correct).toBe(true);
    const p = participle('прочитать');
    expect(checkAnswer(participleFormQuestion(p.row, 0, 'pass_past')!, 'прочитанный').correct).toBe(true);
    expect(participleFormQuestion(p.row, 0, 'act_pres')).toBeNull(); // no present participle from a perfective
  });
  it('drills short passive participles with the pronoun', () => {
    const q = shortPassiveQuestion(participle('прочитать').row, 0, 'f')!;
    expect(q.frame).toBe('она ___');
    expect(checkAnswer(q, 'прочитана').correct).toBe(true);
    expect(checkAnswer(q, 'прочитано').otherForm).toMatch(/Short passive participle, neuter/);
  });
  it('declines a participle to agree with a noun, using its own table and animacy', () => {
    const p = participle('читать');
    const q = participleDeclineQuestion(p.row, 0, 'act_pres', noun('человек'), 'acc', false)!;
    expect(checkAnswer(q, 'читающего').correct).toBe(true);
    const f = participleDeclineQuestion(p.row, 0, 'act_pres', noun('женщина'), 'inst', false)!;
    expect(checkAnswer(f, 'читающей').correct).toBe(true);
    expect(checkAnswer(f, 'читающею').correct).toBe(true); // archaic variant accepted
    expect(taskText(q.task)).toMatch(/^Present active participle · Accusative/);
  });
  it('generates a mix of the selected types', () => {
    const qs = generateParticipleQuestions(participles, nouns1000, { kinds: ['act_pres', 'act_past', 'pass_pres', 'pass_past'], types: ['form', 'short', 'decline'] }, 30, mulberry32(2));
    expect(qs).toHaveLength(30);
    expect(new Set(qs.map((q) => q.key.split(':')[1]))).toEqual(new Set(['form', 'short', 'decl']));
  });
});

describe('numbers (числительные)', () => {
  it('has full tables for 1–20, tens, hundreds and оба', () => {
    expect(numerals.length).toBe(37);
  });
  it('declines numerals with gender and animacy where they matter', () => {
    expect(numeralForm(numeral('пять'), 'inst', 'm', null)).toBe("пятью'");
    expect(numeralForm(numeral('два'), 'nom', 'f', null)).toBe('две');
    expect(numeralForm(numeral('два'), 'acc', 'm', true)).toBe('двух');
    expect(numeralForm(numeral('два'), 'acc', 'm', false)).toBe('два');
    expect(numeralForm(numeral('один'), 'acc', 'f', null)).toBe("одну'");
    expect(numeralForm(numeral('сто'), 'gen', 'm', null)).toMatch(/ста/);
    const q = numeralAloneQuestion(numeral('сорок'), 'dat', 'm', false)!;
    expect(checkAnswer(q, 'сорока').correct).toBe(true);
  });
  it('combines numeral and noun with the right case and number', () => {
    const kniga = noun('книга');
    const drug = noun('друг');
    const check = (num: string, n: typeof kniga, c: Parameters<typeof numeralNounQuestion>[2], answer: string) =>
      expect(checkAnswer(numeralNounQuestion(numeral(num), n, c)!, answer).correct, `${num} ${answer}`).toBe(true);
    check('два', kniga, 'nom', 'две книги');
    check('пять', kniga, 'nom', 'пять книг');
    check('два', kniga, 'dat', 'двум книгам');
    check('пять', kniga, 'inst', 'пятью книгами');
    check('один', kniga, 'acc', 'одну книгу');
    check('два', drug, 'acc', 'двух друзей');
    check('пять', drug, 'acc', 'пять друзей');
    check('три', kniga, 'prep', 'трёх книгах');
  });
  it('generates both types within the chosen ranges', () => {
    const qs = generateNumberQuestions(numerals, nouns1000, { types: ['alone', 'withNoun'], ranges: ['1-4'], cases: ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'] }, 20, mulberry32(3));
    expect(qs).toHaveLength(20);
    for (const q of qs) expect(q.key).toMatch(/^num:(alone:[1-4]|noun:)/);
  });
});

describe('diminutives', () => {
  it('accepts any listed diminutive, and goes back to the noun', () => {
    const dom = diminutives.find((r) => r[1].replace(/'/g, '') === 'дом')!;
    expect(checkAnswer(toDiminutiveQuestion(dom), 'домик').correct).toBe(true);
    expect(checkAnswer(fromDiminutiveQuestion(dom, "до'мик"), 'дом').correct).toBe(true);
  });
  it('generates both directions', () => {
    const qs = generateDiminutiveQuestions(diminutives, { directions: ['to', 'from'] }, 20, mulberry32(4));
    expect(new Set(qs.map((q) => q.key.split(':')[1]))).toEqual(new Set(['to', 'from']));
  });
});
