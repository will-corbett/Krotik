import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkAnswer } from '../../src/lib/check.ts';
import { ASK, buildTest, PER_LEVEL, scoreTest, TEST_LEVELS, type TestItem } from '../../src/lib/levelTest.ts';
import { loadLexicon, POOLS, sentenceCandidate, type Lexicon } from '../../src/lib/levelTestPool.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ClozeRow, LevelTestData } from '../../src/shared/types.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { ALL_TOPICS } from '../../src/lib/topics.ts';
import { LEARN_TOPICS } from '../../src/lib/learn.ts';
import { generateAlphabetQuestions, romanise } from '../../src/lib/questions/alphabet.ts';
import { nouns } from './fixtures.ts';

const read = <T>(file: string): T => JSON.parse(readFileSync(`public/data/${file}`, 'utf8')) as T;

describe('level test question pool (public/data/level-test.json)', () => {
  const pool = read<LevelTestData>('level-test.json');
  it('has every question type of every level, with plenty of candidates for most', () => {
    for (const l of TEST_LEVELS) expect(pool.slots.filter((s) => s.level === l).length, l).toBe(POOLS[l].length);
    const thin = pool.slots.filter((s) => s.items.length < 10);
    expect(thin.map((s) => `${s.level} ${s.topic}`)).toEqual([]);
  });
  it('every candidate has exactly one right option among all its options', () => {
    let n = 0;
    for (const s of pool.slots)
      for (const [key, ru, , start, end, , right, wrong, answer] of s.items) {
        const q = { answer: answer ?? right, others: [] };
        expect(checkAnswer(q, right).correct, key).toBe(true);
        expect(wrong.length, key).toBeGreaterThanOrEqual(1);
        for (const w of wrong) expect(checkAnswer(q, w).correct, `${key} ${w}`).toBe(false);
        expect(new Set([right, ...wrong].map(normalise)).size, key).toBe(wrong.length + 1);
        expect(ru.slice(0, start) + ru.slice(end), key).toMatch(/[а-яё]{2,}/i);
        n++;
      }
    expect(n).toBeGreaterThan(1500);
  });
});

describe('level test', () => {
  const pool = read<LevelTestData>('level-test.json');
  let items: TestItem[] = [];
  let lex: Lexicon;
  beforeAll(() => {
    items = buildTest(mulberry32(42), pool);
    lex = loadLexicon(read);
  });

  it('has 60 questions, 12 per level, easiest level first', () => {
    expect(items).toHaveLength(60);
    for (const l of TEST_LEVELS) expect(items.filter((i) => i.level === l), l).toHaveLength(PER_LEVEL);
    const order = items.map((i) => TEST_LEVELS.indexOf(i.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it('every question is multiple choice with exactly one right option', () => {
    for (const { q } of items) {
      expect(q.choices!.length, q.key).toBeGreaterThanOrEqual(2);
      expect(q.choices!.filter((c) => checkAnswer(q, c).correct), q.key).toHaveLength(1);
      expect(new Set(q.choices).size, q.key).toBe(q.choices!.length);
    }
  });
  it('every question is a whole sentence with a plain instruction, and no grammar terms', () => {
    const asks = Object.values(ASK) as string[];
    const grammar = /nominative|genitive|dative|accusative|instrumental|prepositional|case|tense|singular|plural|aspect|participle|imperative|perfective|падеж|время/i;
    for (const { q, instruction } of items) {
      expect(asks, q.key).toContain(instruction);
      expect(instruction, q.key).not.toMatch(grammar);
      expect(q.task, q.key).toEqual([]);
      expect(q.headwordIsEnglish, q.key).toBe(true); // the English translation is the cue
      const [before, after] = q.frame!.split('___');
      // A real sentence around the gap: Russian words outside the gap and any bracketed dictionary form.
      expect(`${before} ${after!.replace(/^\s*\([^)]*\)/, '')}`, q.key).toMatch(/[а-яё]{2,}/i);
    }
  });
  it('no question appears twice', () => {
    expect(new Set(items.map((i) => i.q.key)).size).toBe(items.length);
  });
  it('every topic tested has a Learn page to recommend', () => {
    for (const i of items) {
      expect(ALL_TOPICS.map((t) => t.id)).toContain(i.topic);
      expect(LEARN_TOPICS.has(i.topic), i.topic).toBe(true);
    }
  });
  it('varies from test to test: different words and a different mix of question types', () => {
    const other = buildTest(mulberry32(7), pool);
    const keysA = new Set(items.map((i) => i.q.key));
    const shared = other.filter((i) => keysA.has(i.q.key)).length;
    expect(shared).toBeLessThan(10);
    const mix = (xs: TestItem[]) => xs.map((i) => i.topic).join(',');
    expect(mix(other)).not.toBe(mix(items));
  });
  it('each level has more question types than it uses, so the mix changes', () => {
    for (const l of TEST_LEVELS) expect(POOLS[l].length, l).toBeGreaterThan(PER_LEVEL);
  });
  it('sentence questions never offer a second form the preposition could also take (в школе / в школу)', () => {
    const rows = JSON.parse(readFileSync('public/data/cloze.prepositions.json', 'utf8')) as ClozeRow[];
    let checked = 0;
    for (const row of rows.filter((r) => r[7] === 'в:prep' || r[7] === 'на:prep').slice(0, 300)) {
      const res = sentenceCandidate(row, 'prepositions', lex, mulberry32(row[0]));
      if (!res) continue;
      checked++;
      const [, , , , , , right, wrong] = res.c;
      const noun = lex.byAccented.get(row[6])!;
      const at = noun.cells.findIndex((c) => cellForms(c).some((f) => normalise(f) === normalise(row[1].slice(row[3], row[4]))));
      const acc = cellForms(noun.cells[at >= 6 ? 9 : 3]!).map(normalise);
      for (const c of wrong) expect(acc, `${row[1]} / ${c}`).not.toContain(normalise(c));
      expect(checkAnswer({ answer: right, others: [] }, right).correct).toBe(true);
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('a spelling shared by two cells is read in the case the sentence needs (верят в сказки: accusative plural)', () => {
    const rows = JSON.parse(readFileSync('public/data/cloze.government.json', 'utf8')) as ClozeRow[];
    const row = rows.find((r) => r[7].startsWith('v+acc|') && normalise(r[1].slice(r[3], r[4])) === 'сказки');
    if (!row) return;
    const res = sentenceCandidate(row, 'government', lex, mulberry32(1))!;
    expect(res.c[7]).not.toContain('ска\'зку');
  });
  it('scores: a level counts while 9 of 12 are right; misses become review topics, easiest first', () => {
    const all = scoreTest(items, items.map(() => ({ correct: true, skipped: false })));
    expect(all.level).toBe('C1');
    expect(all.review).toEqual([]);
    // A1 and A2 right, everything else "I don't know"
    const r = scoreTest(items, items.map((i) => (['A1', 'A2'].includes(i.level) ? { correct: true, skipped: false } : { correct: false, skipped: true })));
    expect(r.level).toBe('A2');
    expect(r.review[0]!.level).toBe('B1');
    // Nothing right: below A1
    expect(scoreTest(items, items.map(() => ({ correct: false, skipped: true }))).level).toBeNull();
    // A gap stops the climb: A1 passed, A2 failed, B1 passed → A1
    const gap = scoreTest(items, items.map((i) => ({ correct: i.level !== 'A2', skipped: false })));
    expect(gap.level).toBe('A1');
  });
  it('an early-ended test is judged on what was answered', () => {
    const first12 = items.map((_, i) => (i < 12 ? { correct: true, skipped: false } : undefined));
    const r = scoreTest(items, first12);
    expect(r.answered).toBe(12);
    expect(r.level).toBe('A1');
  });
});

describe('alphabet drill', () => {
  it('romanises words simply, with primes for the signs', () => {
    expect(romanise("шко'ла")).toBe('shkola');
    expect(romanise('соль')).toBe('solʹ');
    expect(romanise('чай')).toBe('chay');
  });
  it('reading questions offer the right romanisation and look-alike misreadings', () => {
    const qs = generateAlphabetQuestions(nouns, { types: ['read'] }, 20, mulberry32(3));
    expect(qs.length).toBe(20);
    for (const q of qs) expect(q.choices!.filter((c) => checkAnswer(q, c).correct)).toHaveLength(1);
  });
  it('letter and writing questions', () => {
    const qs = generateAlphabetQuestions(nouns, { types: ['letters', 'write'] }, 30, mulberry32(4));
    expect(qs.length).toBe(30);
    for (const q of qs) {
      if (q.choices) expect(q.choices.filter((c) => checkAnswer(q, c).correct)).toHaveLength(1);
      else expect(checkAnswer(q, q.answer).correct).toBe(true);
    }
  });
});
