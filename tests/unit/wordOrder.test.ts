/** Word order practice: our own items are word-checked, and published only once a native speaker has reviewed them. */
import { describe, expect, it } from 'vitest';
import { buildWordOrder } from '../../scripts/lib/wordOrderQa.ts';
import { Report } from '../../scripts/lib/report.ts';
import { generateWordOrderQuestions } from '../../src/lib/questions/wordOrder.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { normalise } from '../../src/shared/normalise.ts';

// A tiny vocabulary: every word below is a known "other" word.
const known = ['кто', 'разбил', 'окно', 'где', 'книга', 'на', 'столе'];
const lex = {
  owners: new Map(known.map((w) => [w, new Set([`other:${w}`])])),
  masks: new Map(),
  verb: () => undefined,
  noun: () => undefined,
  adjective: () => undefined,
  other: (b: string) => (known.includes(b) ? ([b, 'x'] as [string, string]) : undefined),
  pronoun: () => [],
  wiktionary: {},
  old: new Set<string>(),
  wordBand: () => undefined,
  commonForm: () => false,
};
const item = (reviewed = '') => ({ q: 'Кто разбил окно?', qen: 'Who broke the window?', right: 'Окно разбил Том.', other: 'Том разбил окно.', en: 'Tom broke the window.', reviewed });

describe('word order practice', () => {
  it('publishes only reviewed items; the rest are listed for the reviewer', () => {
    const { data, review } = buildWordOrder(lex as never, new Report(), { names: ['Том'], items: [item(), item('a native speaker, 2026-11-08')] });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]![5]).toBe('a native speaker, 2026-11-08');
    expect(review).toContain('| 1 | Кто разбил окно?');
    expect(review).not.toContain('| 2 |');
  });
  it('refuses unknown words, undeclared names, answers that are not the same words, and a bad review note', () => {
    const build = (items: object[], names = ['Том']) => () => buildWordOrder(lex as never, new Report(), { names, items: items as never });
    expect(build([item()], [])).toThrow(/том/i);
    expect(build([{ ...item(), other: 'Том разбил дверь.' }])).toThrow(/same words/);
    expect(build([{ ...item(), q: 'Кто разбил стекло?' }])).toThrow(/стекло/);
    expect(build([item('yesterday')])).toThrow(/reviewed/);
  });
  it('asks the question and offers both orders; the natural one is right', () => {
    const qs = generateWordOrderQuestions({ items: [['Где книга?', 'Where is the book?', 'Книга на столе.', 'На столе книга.', 'The book is on the table.', 'x, 2026-11-08']] }, 5, mulberry32(1));
    expect(qs[0]).toMatchObject({ mode: 'wordOrder', headword: 'Где книга?', answer: 'Книга на столе.', optionsLang: 'ru' });
    expect([...qs[0]!.choices!].sort()).toEqual(['Книга на столе.', 'На столе книга.']);
    expect(normalise('Где')).toBe('где');
  });
});
