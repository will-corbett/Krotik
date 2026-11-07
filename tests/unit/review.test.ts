/** Batch 3: the end-screen breakdown, opt-in progress, and the translate drill's matching. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { breakdown, typeOf } from '../../src/lib/breakdown.ts';
import { PROGRESS_KEY, clearProgress, emptyProgress, loadProgress, recordRound, saveProgress, summarise, today } from '../../src/lib/progress.ts';
import { answer, createRound, endRound } from '../../src/lib/queue.ts';
import { lengthOf, sameSentence, generateTranslateQuestions } from '../../src/lib/questions/translate.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { TERMS } from '../../src/lib/terms.ts';
import type { Mode, Question } from '../../src/lib/types.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { SentenceRow } from '../../src/shared/types.ts';

let n = 0;
const q = (mode: Mode, task: Question['task']): Question => ({ key: `k${n++}`, mode, headword: 'x', gloss: '', task, answer: 'a', others: [], label: 'l', speak: () => '' });

/** Answer each question in order: true = right first time, false = wrong then right. */
function play(qs: Question[], results: boolean[]) {
  let r = createRound(qs);
  for (const ok of results) {
    r = answer(r, ok, ok ? 'a' : 'b');
  }
  return r;
}

describe('end-screen breakdown', () => {
  it('groups one topic by question type, weakest first', () => {
    const qs = [q('verbs', [TERMS.past, { ru: 'она' }]), q('verbs', [TERMS.past, { ru: 'мы' }]), q('verbs', [TERMS.presfut, { ru: 'я' }])];
    const rows = breakdown(play(qs, [true, false, true]));
    expect(rows.map((r) => [r.label.en, r.right, r.attempted])).toEqual([
      ['Past', 1, 2],
      ['Present/future', 1, 1],
    ]);
    expect(rows[0]!.topic).toBeUndefined();
  });
  it('groups a mixed round by topic, with links', () => {
    const qs = [q('verbs', [TERMS.past]), q('nounCases', [TERMS.past]), q('nounCases', [TERMS.past])];
    const rows = breakdown(play(qs, [true, false, false]));
    expect(rows.map((r) => [r.topic, r.right, r.attempted])).toEqual([
      ['nounCases', 0, 2],
      ['verbs', 1, 1],
    ]);
    expect(rows[0]!.label.en).toBe('Noun cases');
  });
  it('leaves out questions never attempted (an early End round)', () => {
    const qs = [q('verbs', [TERMS.past]), q('verbs', [TERMS.presfut])];
    let r = answer(createRound(qs), true, 'a');
    r = endRound(r);
    expect(breakdown(r).map((x) => x.label.en)).toEqual(['Past']);
  });
  it('a task with no Russian term falls back to its first English part', () => {
    expect(typeOf({ task: [{ en: 'Name the verb' }], label: 'l' }).en).toBe('Name the verb');
    expect(typeOf({ task: [{ en: 'Name the verb' }, TERMS.uni], label: 'l' }).en).toBe(TERMS.uni.en);
  });
});

describe('opt-in progress', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  });

  it('records each attempted question under its own topic, so a mixed round splits up', () => {
    const qs = [q('verbs', [TERMS.past]), q('nounCases', [TERMS.past]), q('nounCases', [TERMS.past])];
    const p = recordRound(emptyProgress(), play(qs, [true, false, true]), '2026-11-07');
    expect(p.topics.verbs).toEqual({ rounds: 1, attempted: 1, right: 1, last: '2026-11-07', recent: [[1, 1]] });
    expect(p.topics.nounCases).toEqual({ rounds: 1, attempted: 2, right: 1, last: '2026-11-07', recent: [[1, 2]] });
  });
  it('keeps only the last five rounds for "recent"', () => {
    let p = emptyProgress();
    for (let i = 0; i < 7; i++) p = recordRound(p, play([q('verbs', [TERMS.past])], [i % 2 === 0]), '2026-11-07');
    expect(p.topics.verbs!.recent).toHaveLength(5);
    expect(p.topics.verbs!.rounds).toBe(7);
  });
  it('weak = under 80% over at least 8 recent questions; due = 14+ days; translation is never suggested', () => {
    const many = (mode: Mode, right: number, total: number) => play(Array.from({ length: total }, () => q(mode, [TERMS.past])), Array.from({ length: total }, (_, i) => i < right));
    let p = emptyProgress();
    p = recordRound(p, many('verbs', 5, 10), '2026-11-07'); // 50%: weak
    p = recordRound(p, many('nounCases', 4, 6), '2026-11-07'); // too few to judge
    p = recordRound(p, many('aspect', 9, 10), '2026-10-01'); // fine, but 37 days ago: due
    p = recordRound(p, many('translate', 0, 10), '2026-10-01'); // self-marked: never weak or due
    const s = summarise(p, '2026-11-07');
    expect(s.weak).toEqual([{ mode: 'verbs', percent: 50 }]);
    expect(s.due).toEqual([{ mode: 'aspect', days: 37 }]);
    expect(s.all.map((a) => a.mode)).toContain('translate');
  });
  it('is stored under its own key, survives a reload, and is deleted by clearProgress', () => {
    const p = recordRound(emptyProgress(), play([q('verbs', [TERMS.past])], [true]), today());
    saveProgress(p);
    expect(store.has(PROGRESS_KEY)).toBe(true);
    expect(loadProgress()).toEqual(p);
    clearProgress();
    expect(store.has(PROGRESS_KEY)).toBe(false);
    expect(loadProgress()).toEqual(emptyProgress());
  });
  it('a broken or unavailable store gives an empty record, never an error', () => {
    store.set(PROGRESS_KEY, '{not json');
    expect(loadProgress()).toEqual(emptyProgress());
    vi.stubGlobal('localStorage', undefined);
    expect(loadProgress()).toEqual(emptyProgress());
    expect(() => saveProgress(emptyProgress())).not.toThrow();
  });
});

describe('translate and compare', () => {
  it('only an exact match counts, ignoring case, stress, ё, spaces and punctuation', () => {
    expect(sameSentence('я не знаю', 'Я не знаю.', normalise)).toBe(true);
    expect(sameSentence('  Поговори́те  с ним ', 'Поговорите с ним.', normalise)).toBe(true);
    expect(sameSentence('Ещё раз', 'Еще раз!', normalise)).toBe(true);
    expect(sameSentence('Поговори с ним', 'Поговорите с ним.', normalise)).toBe(false);
    expect(sameSentence('', '.', normalise)).toBe(false);
  });
  it('sentence lengths: short up to 5 words, longer 6–9, longer still left out', () => {
    expect(lengthOf('Том сказал, что он беден.')).toBe('short');
    expect(lengthOf('Я буду ждать здесь, пока она не придёт.')).toBe('long');
    expect(lengthOf('Это очень длинное предложение, в котором больше девяти разных слов.')).toBeNull();
  });
  it('questions are distinct sentences of the chosen length, shown whole as the model', () => {
    const rows: SentenceRow[] = [
      [1, 'Я не знаю.', "I don't know.", 0, 0, 0],
      [1, 'Я не знаю.', "I don't know.", 0, 0, 0],
      [2, 'Я буду ждать здесь, пока она не придёт.', "I'll wait here until she comes.", 0, 0, 0],
    ];
    const qs = generateTranslateQuestions(rows, { lengths: ['short'] }, 10, mulberry32(1));
    expect(qs.map((x) => [x.source, x.answer, x.selfMark, x.headwordIsEnglish])).toEqual([[1, 'Я не знаю.', true, true]]);
    expect(generateTranslateQuestions(rows, { lengths: ['short', 'long'] }, 10, mulberry32(1))).toHaveLength(2);
  });
});
