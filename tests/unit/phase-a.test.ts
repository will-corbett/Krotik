import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../../src/lib/check.ts';
import { degreeQuestion, generateCompareQuestions, samyiQuestion } from '../../src/lib/questions/compare.ts';
import { generatePluralQuestions, nominativePluralQuestion, numberQuestion, numberRule, quantityQuestion } from '../../src/lib/questions/plurals.ts';
import { generateShortQuestions, shortQuestion } from '../../src/lib/questions/short.ts';
import { generateVerbQuestions, isReflexive } from '../../src/lib/questions/verbs.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { taskText } from '../../src/lib/terms.ts';
import { reflexiveErrors } from '../../scripts/lib/clean-verbs.ts';
import { adjective, adjectives, adjectives1000, noun, nouns, verbs1000 } from './fixtures.ts';

describe('reflexive verbs', () => {
  it('only drills -ся/-сь verbs', () => {
    const pool = verbs1000.filter(isReflexive);
    expect(pool.length).toBeGreaterThan(50);
    const qs = generateVerbQuestions(pool, { groups: ['presfut', 'past', 'imperative'] }, 30, mulberry32(1), 'reflexive');
    expect(qs).toHaveLength(30);
    for (const q of qs) expect(q.headword.replace(/'/g, '')).toMatch(/(ся|сь)$/);
  });
  it('checks -сь after vowels and -ся after consonants', () => {
    expect(reflexiveErrors(["учу'сь", "у'чится", "учи'лся", "учи'лась", "учи'тесь"])).toEqual([]);
    expect(reflexiveErrors(["учу'ся", "учи'лсь"])).toEqual(['учуся', 'училсь']);
  });
});

describe('short-form adjectives', () => {
  it('asks for the form agreeing with the pronoun, with stress shift data', () => {
    const q = shortQuestion(adjective('новый'), 'f')!;
    expect(q.frame).toBe('она ___');
    expect(checkAnswer(q, 'нова').correct).toBe(true);
    expect(checkAnswer(q, 'новая').otherForm).toMatch(/^Nominative feminine singular/);
    expect(checkAnswer(q, 'новы').otherForm).toMatch(/^Short form, plural \(краткая форма, множественное число\)/);
  });
  it('generates only adjectives that have short forms', () => {
    const qs = generateShortQuestions(adjectives, 20, mulberry32(2));
    expect(qs).toHaveLength(20);
    for (const q of qs) expect(taskText(q.task)).toMatch(/^Short form/);
  });
});

describe('comparatives and superlatives', () => {
  it('uses the source comparative and superlative', () => {
    const c = degreeQuestion(adjective('хороший'), 'comparative')!;
    expect(checkAnswer(c, 'лучше').correct).toBe(true);
    const s = degreeQuestion(adjective('новый'), 'superlative')!;
    expect(checkAnswer(s, 'новейший').correct).toBe(true);
  });
  it('builds самый + adjective from both source paradigms, agreeing with the noun', () => {
    const q = samyiQuestion(adjective('новый'), adjective('самый'), noun('книга'), false)!;
    expect(checkAnswer(q, 'самая новая').correct).toBe(true);
    expect(checkAnswer(q, 'самый новый').correct).toBe(false);
    const pl = samyiQuestion(adjective('новый'), adjective('самый'), noun('дом'), true)!;
    expect(checkAnswer(pl, 'самые новые').correct).toBe(true);
  });
  it('generates a mix of the selected types', () => {
    const qs = generateCompareQuestions(adjectives1000, nouns, { types: ['comparative', 'superlative', 'samyi'] }, 30, mulberry32(3));
    expect(qs.length).toBe(30);
    expect(new Set(qs.map((q) => q.key.split(':')[1]))).toEqual(new Set(['comparative', 'superlative', 'samyi']));
  });
});

describe('plurals', () => {
  it('knows the number rule, including 11–14', () => {
    const cases: [number, string][] = [
      [1, 'nom-sg'], [2, 'gen-sg'], [4, 'gen-sg'], [5, 'gen-pl'], [11, 'gen-pl'], [12, 'gen-pl'], [14, 'gen-pl'],
      [21, 'nom-sg'], [22, 'gen-sg'], [25, 'gen-pl'], [101, 'nom-sg'], [111, 'gen-pl'], [112, 'gen-pl'], [122, 'gen-sg'],
    ];
    for (const [n, r] of cases) expect(numberRule(n), String(n)).toBe(r);
  });
  it('uses real noun forms after numbers', () => {
    const stol = noun('стол');
    expect(checkAnswer(numberQuestion(stol, 1)!, 'стол').correct).toBe(true);
    expect(checkAnswer(numberQuestion(stol, 3)!, 'стола').correct).toBe(true);
    expect(checkAnswer(numberQuestion(stol, 5)!, 'столов').correct).toBe(true);
    expect(checkAnswer(numberQuestion(stol, 5)!, 'стола').otherForm).toMatch(/^Genitive singular/);
  });
  it('uses the counting form where Wiktionary has one (пять человек, пять лет)', () => {
    expect(checkAnswer(numberQuestion(noun('человек'), 5)!, 'человек').correct).toBe(true);
    expect(checkAnswer(numberQuestion(noun('человек'), 5)!, 'людей').correct).toBe(false);
    expect(checkAnswer(numberQuestion(noun('человек'), 2)!, 'человека').correct).toBe(true);
    expect(checkAnswer(numberQuestion(noun('год'), 5)!, 'лет').correct).toBe(true);
    expect(checkAnswer(quantityQuestion(noun('человек'), 'много')!, 'людей').correct).toBe(true);
    expect(checkAnswer(quantityQuestion(noun('человек'), 'сколько')!, 'человек').correct).toBe(true);
  });
  it('quantity words take genitive plural; нет accepts either number; mass nouns take genitive singular', () => {
    expect(checkAnswer(quantityQuestion(noun('книга'), 'много')!, 'книг').correct).toBe(true);
    const net = quantityQuestion(noun('книга'), 'нет')!;
    expect(checkAnswer(net, 'книг').correct).toBe(true);
    expect(checkAnswer(net, 'книги').correct).toBe(true);
    const mass = nouns.find((n) => n.sgOnly && n.cells[1])!;
    const q = quantityQuestion(mass, 'много')!;
    expect(q.answer).toBe(mass.cells[1]);
    expect(quantityQuestion(mass, 'несколько')).toBeNull();
    expect(numberQuestion(mass, 5)).toBeNull();
  });
  it('drills irregular nominative plurals from the source', () => {
    expect(checkAnswer(nominativePluralQuestion(noun('друг'))!, 'друзья').correct).toBe(true);
    expect(checkAnswer(nominativePluralQuestion(noun('дом'))!, 'дома').correct).toBe(true);
    expect(checkAnswer(nominativePluralQuestion(noun('человек'))!, 'люди').correct).toBe(true);
  });
  it('includes nouns whose gender is missing in the source', () => {
    const noGender = nouns.filter((n) => !n.gender);
    expect(noGender.length).toBeGreaterThan(0);
    const qs = generatePluralQuestions(noGender, { contexts: ['nom', 'cases', 'numbers', 'quantity'], cases: ['gen', 'dat'] }, 20, mulberry32(4));
    expect(qs.length).toBe(20);
  });
  it('explains the rule after number and quantity questions', () => {
    expect(numberQuestion(noun('стол'), 3)!.explain).toMatch(/2–4.*Genitive singular \(родительный падеж, единственное число\)/);
  });
});
