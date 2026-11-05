import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../../src/lib/check.ts';
import { adjectiveQuestion } from '../../src/lib/questions/adjectives.ts';
import { verbFormQuestion } from '../../src/lib/questions/verbs.ts';
import { adjective, noun, verb } from './fixtures.ts';

describe('checkAnswer', () => {
  const q = { answer: "сказа'ла", others: [{ label: 'Past, он form', cell: "сказа'л" }, { label: 'Future, я form', cell: "скажу'" }] };

  it('accepts the form regardless of stress marks, case and ё', () => {
    expect(checkAnswer(q, 'сказала').correct).toBe(true);
    expect(checkAnswer(q, 'СКАЗА́ЛА').correct).toBe(true);
    expect(checkAnswer(q, "сказа'ла").correct).toBe(true);
    expect(checkAnswer({ answer: "идё'м", others: [] }, 'идем').correct).toBe(true);
  });

  it('accepts any comma-separated variant', () => {
    expect(checkAnswer({ answer: "уда'лось,удало'сь", others: [] }, 'удалось').correct).toBe(true);
  });

  it('names a different form of the same word', () => {
    expect(checkAnswer(q, 'сказал')).toEqual({ correct: false, otherForm: 'Past, он form' });
  });

  it('gives no form name for unrelated input', () => {
    expect(checkAnswer(q, 'говорила')).toEqual({ correct: false });
    expect(checkAnswer(q, '')).toEqual({ correct: false });
  });

  it('does not call a syncretic form "a different form"', () => {
    // f gen = f dat for новый: "новой" typed for dative is simply correct
    const r = checkAnswer({ answer: "но'вой", others: [{ label: 'Genitive, feminine singular', cell: "но'вой" }] }, 'новой');
    expect(r.correct).toBe(true);
  });

  it('works on real verb data (сказать, past она)', () => {
    const v = verb('сказать');
    const qq = verbFormQuestion(v, 7);
    expect(checkAnswer(qq, 'сказала').correct).toBe(true);
    expect(checkAnswer(qq, 'скажу').otherForm).toBe('Future, я form (будущее время)');
  });
});

describe('accusative animacy', () => {
  it('uses the genitive-like form for animate masculine nouns', () => {
    const a = adjective('новый');
    const animate = noun('человек');
    const inanimate = noun('дом');
    expect(animate.animate).toBe(true);
    expect(inanimate.animate).toBe(false);
    const qa = adjectiveQuestion(a, animate, 'acc', false)!;
    const qi = adjectiveQuestion(a, inanimate, 'acc', false)!;
    expect(checkAnswer(qa, 'нового').correct).toBe(true);
    expect(checkAnswer(qa, 'новый').correct).toBe(false);
    expect(checkAnswer(qi, 'новый').correct).toBe(true);
    expect(checkAnswer(qi, 'нового').correct).toBe(false);
    expect(qa.task).toContainEqual({ en: 'animate', ru: 'одушевлённое' });
  });

  it('resolves source variants by matching, not position (большой lists animate first)', () => {
    const a = adjective('большой');
    const qa = adjectiveQuestion(a, noun('человек'), 'acc', false)!;
    const qi = adjectiveQuestion(a, noun('дом'), 'acc', false)!;
    expect(checkAnswer(qa, 'большого').correct).toBe(true);
    expect(checkAnswer(qi, 'большой').correct).toBe(true);
  });

  it('applies animacy in the plural for every gender', () => {
    const a = adjective('новый');
    const q = adjectiveQuestion(a, noun('женщина'), 'acc', true)!;
    expect(checkAnswer(q, 'новых').correct).toBe(true);
    const q2 = adjectiveQuestion(a, noun('книга'), 'acc', true)!;
    expect(checkAnswer(q2, 'новые').correct).toBe(true);
  });

  it('feminine accusative ignores animacy', () => {
    const q = adjectiveQuestion(adjective('новый'), noun('женщина'), 'acc', false)!;
    expect(checkAnswer(q, 'новую').correct).toBe(true);
    expect(q.task.map((p) => p.en)).not.toContain('animate');
  });
});
