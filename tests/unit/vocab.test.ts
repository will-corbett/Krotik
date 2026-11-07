/** Vocabulary: the word drill's questions and the opt-in "My words" record. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkAnswer } from '../../src/lib/check.ts';
import { alsoRight, generateVocabQuestions, indexByItem, meaningWords, recallQuestion, recogniseQuestion } from '../../src/lib/questions/vocab.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import type { Word } from '../../src/lib/types.ts';
import { addDays, addWords, dueKeys, emptyWords, INTERVALS, mergeWords, parseWords, removeWord, review } from '../../src/lib/words.ts';
import type { WordRow } from '../../src/shared/types.ts';

const rows = (b: number) => JSON.parse(readFileSync(`public/data/words.b${b}.json`, 'utf8')) as WordRow[];
const toWord = ([key, accented, gloss, pos, extra]: WordRow, band: number): Word => ({ key, accented, gloss, pos, extra, band });
const all = [...rows(0).map((r) => toWord(r, 0)), ...rows(1).map((r) => toWord(r, 1))];
const byKey = new Map(all.map((w) => [w.key, w]));
const find = (head: string, pos: string) => all.find((w) => w.accented.replace(/'/g, '') === head && w.pos === pos)!;

describe('word lists', () => {
  it('cover every word type in the top band, without homograph noise or pronoun case forms', () => {
    const b0 = rows(0);
    for (const pos of ['n', 'v', 'a', 'o']) expect(b0.filter((r) => r[3] === pos).length).toBeGreaterThan(150);
    const heads = new Set(b0.map((r) => `${r[3]}:${r[1].replace(/'/g, '')}`));
    expect(heads.has('n:тут')).toBe(false); // "mulberry": the rank belongs to the adverb тут
    expect([0, 1, 2, 3].some((b) => rows(b).some((r) => r[0] === 'o:тут'))).toBe(true);
    expect(heads.has('o:меня')).toBe(false); // a case form of я, not a word to learn on its own
    expect(heads.has('v:видеть')).toBe(true);
  });
  it('have unique keys', () => {
    const keys = [0, 1, 2, 3].flatMap((b) => rows(b).map((r) => r[0]));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('recognise (choose the meaning)', () => {
  it('offers four meanings, the wrong ones of the same word type and sharing no English word with the right one', () => {
    const rng = mulberry32(3);
    for (const w of all.filter((x) => x.band === 0).slice(0, 300)) {
      const q = recogniseQuestion(w, { all }, rng);
      if (!q) continue;
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(w.gloss);
      expect(new Set(q.choices).size).toBe(4);
      const mine = meaningWords(w.gloss);
      for (const c of q.choices!.filter((c) => c !== w.gloss)) {
        const other = all.find((o) => o.gloss === c && o.pos === w.pos);
        expect(other, c).toBeDefined();
        expect([...meaningWords(c)].filter((x) => mine.has(x)), `${w.accented}: ${c}`).toEqual([]);
      }
    }
  });
});

describe('recall (type the word)', () => {
  it('accepts other words of the same type (and aspect) with the same meaning, and names them', () => {
    const idx = indexByItem(all);
    const w = all.find((x) => x.pos === 'v' && alsoRight(x, idx).length)!;
    const also = alsoRight(w, idx);
    const q = recallQuestion(w, { all }, idx);
    expect(checkAnswer(q, w.accented.replace(/'/g, '')).correct).toBe(true);
    expect(checkAnswer(q, also[0]!.accented.replace(/'/g, '').split(',')[0]!).correct).toBe(true);
    expect(q.explain).toContain(also[0]!.accented.replace(/'/g, '').split(',')[0]!);
    for (const o of also) expect(o.extra).toBe(w.extra);
  });
  it('names the aspect partner when you type it', () => {
    const vidit = find('видеть', 'v');
    const verb = { id: 1, accented: vidit.accented, gloss: vidit.gloss, aspect: 'impf' as const, partners: ["уви'деть"], cells: [], band: 0 };
    const q = recallQuestion(vidit, { all, paradigm: () => ({ kind: 'verb', verb }) }, indexByItem(all));
    expect(checkAnswer(q, 'видеть').correct).toBe(true);
    expect(checkAnswer(q, 'увидеть')).toEqual({ correct: false, otherForm: 'perfective partner' });
  });
  it('never offers the same word as an alternative', () => {
    const idx = indexByItem(all);
    for (const w of all.slice(0, 500)) for (const o of alsoRight(w, idx)) expect(o.key).not.toBe(w.key);
  });
});

describe('generateVocabQuestions', () => {
  it('asks the chosen way round, with the word recorded on each question', () => {
    const qs = generateVocabQuestions(all.filter((w) => w.band === 0), { all }, { direction: 'recall', types: ['n', 'v', 'a', 'o'], source: 'common' }, 20, mulberry32(1));
    expect(qs).toHaveLength(20);
    for (const q of qs) {
      expect(q.headwordIsEnglish).toBe(true);
      expect(byKey.get(q.word!.key)).toBeDefined();
    }
  });
  it('keeps the given order for due words', () => {
    const targets = all.slice(0, 5);
    const qs = generateVocabQuestions(targets, { all }, { direction: 'recall', types: [], source: 'mine' }, 5, mulberry32(1), true);
    expect(qs.map((q) => q.word!.key)).toEqual(targets.map((w) => w.key));
  });
});

describe('my words (spaced repetition)', () => {
  const day = '2026-11-07';
  it('adds new words due today, and schedules by the Leitner boxes', () => {
    let w = addWords(emptyWords(), [['v:1', 0]], day);
    expect(w.words['v:1']).toEqual({ b: 0, box: 0, due: day, added: day });
    w = review(w, [{ key: 'v:1', band: 0, right: true }], day);
    expect(w.words['v:1']).toMatchObject({ box: 1, due: addDays(day, INTERVALS[1]!) });
    // Practised again before it's due: right answers don't skip ahead.
    w = review(w, [{ key: 'v:1', band: 0, right: true }], day);
    expect(w.words['v:1']!.box).toBe(1);
    // A miss: back to box 0, due tomorrow.
    w = review(w, [{ key: 'v:1', band: 0, right: false }], day);
    expect(w.words['v:1']).toMatchObject({ box: 0, due: '2026-11-08' });
  });
  it('lists due words most overdue first', () => {
    const w = { v: 1 as const, words: { 'n:1': { b: 0, box: 2, due: '2026-11-05', added: day }, 'n:2': { b: 0, box: 0, due: '2026-11-01', added: day }, 'n:3': { b: 0, box: 0, due: '2026-12-01', added: day } } };
    expect(dueKeys(w, day)).toEqual(['n:2', 'n:1']);
    expect(Object.keys(removeWord(w, 'n:1').words)).toEqual(['n:2', 'n:3']);
  });
  it('dates cross months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  });
  it('reads only well-formed records (stored or imported), dropping anything else', () => {
    expect(parseWords('not json')).toBeNull();
    expect(parseWords('{"v":2,"words":{}}')).toBeNull();
    const p = parseWords(JSON.stringify({ v: 1, words: { 'v:1': { b: 0, box: 1, due: day, added: day, extra: 'x' }, 'bad key': { b: 0, box: 0, due: day, added: day }, 'n:2': { b: 9, box: 0, due: day, added: day }, 'o:тут': { b: 0, box: 7, due: day, added: day } } }));
    expect(p).toEqual({ v: 1, words: { 'v:1': { b: 0, box: 1, due: day, added: day } } });
  });
  it('merges an import, keeping the later due date for words in both', () => {
    const mine = { v: 1 as const, words: { 'n:1': { b: 0, box: 1, due: '2026-11-08', added: day } } };
    const inc = { v: 1 as const, words: { 'n:1': { b: 0, box: 3, due: '2026-11-20', added: day }, 'n:2': { b: 1, box: 0, due: day, added: day } } };
    expect(mergeWords(mine, inc).words).toEqual(inc.words);
    expect(mergeWords(inc, mine).words['n:1']!.box).toBe(3);
  });
});
