import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkAnswer } from '../../src/lib/check.ts';
import { ASK, buildTest, PER_LEVEL, scoreTest, TEST_LEVELS, type TestItem } from '../../src/lib/levelTest.ts';
import { loadLexicon, POOLS, sentenceCandidate, type Lexicon } from '../../src/lib/levelTestPool.ts';
import { formTerm } from '../../src/lib/levelTestExplain.ts';
import { ADJ_INDEX } from '../../src/shared/cells.ts';
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
        const q = { answer: answer || right, others: [] };
        expect(checkAnswer(q, right).correct, key).toBe(true);
        expect(wrong.length, key).toBeGreaterThanOrEqual(1);
        for (const w of wrong) expect(checkAnswer(q, w).correct, `${key} ${w}`).toBe(false);
        expect(new Set([right, ...wrong].map(normalise)).size, key).toBe(wrong.length + 1);
        expect(ru.slice(0, start) + ru.slice(end), key).toMatch(/[а-яё]{2,}/i);
        n++;
      }
    expect(n).toBeGreaterThan(1500);
  });
  it('every option of a word-form question says which form it is, for the explanations', () => {
    for (const s of pool.slots)
      for (const [key, , , , , , , wrong, , , rightCode, wrongCodes] of s.items) {
        expect(wrongCodes, key).toHaveLength(wrong.length);
        if (!rightCode) continue;
        expect(formTerm(rightCode), `${key} ${rightCode}`).not.toBeNull();
        for (const c of wrongCodes) expect(formTerm(c), `${key} ${c}`).not.toBeNull();
      }
  });
  it('labels forms in English with the Russian term', () => {
    expect(formTerm('n7')).toEqual({ en: 'genitive plural', ru: 'родительный падеж, множественное число' });
    expect(formTerm('v7')!.en).toBe('past feminine');
    expect(formTerm('loc')!.ru).toContain('второй предложный');
  });
  it('B2 and C1 have the harder grammar: participles, verbal adverbs, aspect in the imperative', () => {
    const topics = (l: string) => new Set(pool.slots.filter((s) => s.level === l).map((s) => s.topic));
    for (const t of ['participles', 'adverbs', 'aspectContext', 'position']) expect(topics('C1').has(t), t).toBe(true);
    expect(topics('C1').has('kotoryi')).toBe(false);
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
  it('A1–A2 offer four options, B1 and above five where the word has enough forms', () => {
    for (const { level, q, c } of items) {
      const n = level === 'A1' || level === 'A2' ? 3 : 4;
      expect(q.choices!.length, q.key).toBe(1 + Math.min(n, c[7].length));
    }
    expect(items.filter((i) => i.q.choices!.length === 5).length).toBeGreaterThan(15);
  });
  it('the answer to each question is the stored right option', () => {
    for (const { q, c } of items) expect(checkAnswer(q, c[6]).correct, q.key).toBe(true);
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
  it('scores: a level needs 10 of 12 right; misses become review topics, easiest first', () => {
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
    // 9 of 12 at A1 is no longer enough; 10 is.
    const a1 = (k: number) => scoreTest(items, items.map((it, n) => (it.level === 'A1' ? { correct: n < k, skipped: false } : undefined))).level;
    expect(a1(9)).toBeNull();
    expect(a1(10)).toBe('A1');
  });
  it('pools the levels: a slip at an easier level is made up for above it, a real gap is not', () => {
    // Right answers per level, A1 → C1 (the first k questions of each level right).
    const score = (rights: number[]) => {
      const seen: Record<string, number> = {};
      return scoreTest(items, items.map((it) => {
        const k = (seen[it.level] = (seen[it.level] ?? 0) + 1);
        return { correct: k <= rights[TEST_LEVELS.indexOf(it.level)]!, skipped: false };
      }));
    };
    const a = score([9, 12, 12, 12, 12]);
    expect(a.level).toBe('C1');
    expect(a.slips).toEqual(['A1']);
    expect(score([12, 9, 11, 10, 4]).level).toBe('B2');
    expect(score([12, 12, 6, 11, 10]).level).toBe('A2'); // B1 is a real gap
    expect(score([9, 9, 9, 9, 9]).level).toBeNull();
    expect(score([12, 12, 12, 7, 12]).level).toBe('B1'); // B2 under the floor stops C1
    expect(score([10, 10, 10, 10, 10]).level).toBe('C1');
    expect(score([10, 10, 10, 10, 10]).slips).toEqual([]);
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

describe('level test explanations', () => {
  it('a spelling that is several forms is labelled as all of them', () => {
    // новой: feminine singular genitive, dative, instrumental and prepositional (a8, a9, a12, a13 in ADJ_CELLS order)
    const f = ['f_gen', 'f_dat', 'f_inst', 'f_prep'].map((k) => `a${ADJ_INDEX[k as keyof typeof ADJ_INDEX]}`).join('+');
    expect(formTerm(f)).toEqual({ en: 'feminine singular genitive, dative, instrumental or prepositional', ru: 'женский род, единственное число; родительный, дательный, творительный или предложный падеж' });
    expect(formTerm(`a${ADJ_INDEX.m_gen}+a${ADJ_INDEX.n_gen}`)!.en).toBe('masculine singular or neuter singular genitive');
    expect(formTerm(`p:act_pres:${ADJ_INDEX.f_gen}+p:act_pres:${ADJ_INDEX.f_dat}`)!.en).toBe('present active participle, feminine singular genitive or dative');
    expect(formTerm('c4')).toEqual({ en: 'instrumental', ru: 'творительный падеж' });
  });
});

describe('every Grammar test answer is the word in its sentence', () => {
  it('holds for the whole built pool', async () => {
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as import('../../src/shared/types.ts').LevelTestData;
    const n = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/ё/g, 'е');
    const bad = data.slots.flatMap((s) => s.items).filter((c) => !c[6].split(',').map((x) => n(x.replace(/[()]/g, ''))).includes(n(c[1].slice(c[3], c[4]))));
    expect(bad.map((c) => `${c[0]}: ${c[1].slice(c[3], c[4])} vs ${c[6]}`)).toEqual([]);
  });
});

describe('sentences: ё', () => {
  // A sentence that writes ё has told us the word: отменён (cancelled) is never отменен, the short form of отменный.
  it('a highlighted word spelt with ё is always a form spelt with ё', () => {
    const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as { shards: Record<string, { file: string }[]>; sentences?: Record<string, { file: string }[]> };
    for (const type of ['verbs', 'adjectives', 'nouns'] as const) {
      const forms = new Map<number, string[]>();
      for (const s of manifest.shards[type] ?? []) {
        for (const row of JSON.parse(readFileSync(`public/data/${s.file}`, 'utf8')) as unknown[][]) {
          const cells = (type === 'nouns' ? row[6] : type === 'verbs' ? row[5] : [...(row[3] as string[]), ...(row[4] as string[])]) as string[];
          forms.set(row[0] as number, [row[1] as string, ...cells.flatMap((c) => cellForms(c))].map((f) => f.replace(/'/g, '').toLowerCase()));
        }
      }
      let checked = 0;
      for (const file of readdirSync('public/data').filter((f) => f.startsWith(`sentences.${type}.`))) {
        const shard = JSON.parse(readFileSync(`public/data/${file}`, 'utf8')) as Record<string, [number, string, string, number, number, number][]>;
        for (const [id, rows] of Object.entries(shard)) {
          for (const [rid, ru, , , start, end] of rows) {
            const token = ru.slice(start, end).toLowerCase();
            if (!token.includes('ё')) continue;
            checked++;
            expect(forms.get(Number(id))?.includes(token), `${type} ${id} #${rid}: ${token}`).toBe(true);
          }
        }
      }
      expect(checked).toBeGreaterThan(0);
    }
  });
});

describe('stage 2: the fixed questions (curated/stage2-questions.yaml)', () => {
  it('are all in the data, and every accepted answer is accepted', async () => {
    const { parse } = await import('yaml');
    const { typedQuestion } = await import('../../src/lib/levelTest.ts');
    const { questions } = parse(readFileSync('curated/stage2-questions.yaml', 'utf8')) as { questions: { key: string; answers: string[] }[] };
    const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as LevelTestData;
    expect(data.stage2?.map((q) => q.c[0])).toEqual(questions.map((q) => q.key));
    expect(questions.length).toBe(228);
    for (const [i, q] of data.stage2!.entries()) {
      const tq = typedQuestion(q.c, q.topic as never, q.level);
      for (const f of questions[i]!.answers) expect(checkAnswer(tq, f.replace(/'/g, '')).correct, `${q.c[0]}: ${f}`).toBe(true);
      // The sentence's own word is right.
      expect(checkAnswer(tq, q.c[1].slice(q.c[3], q.c[4])).correct, q.c[0]).toBe(true);
    }
  });
});

describe('gaps', () => {
  it('never uses a sentence written with stress marks (its gap positions would be off)', () => {
    const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as LevelTestData;
    for (const slot of data.slots) for (const c of slot.items) expect(c[1], c[0]).not.toMatch(/\u0301/);
  });
});

describe('stage 2: typed answers', async () => {
  const { readFileSync } = await import('node:fs');
  const { buildTypedTest, TYPED_PER_LEVEL, scoreTest } = await import('../../src/lib/levelTest.ts');
  const { checkAnswer } = await import('../../src/lib/check.ts');
  const { mulberry32 } = await import('../../src/lib/rng.ts');
  const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as import('../../src/shared/types.ts').LevelTestData;
  it(`asks ${TYPED_PER_LEVEL} per level, word in brackets, none from stage 1, the sentence's own word as the answer`, () => {
    const exclude = new Set(data.slots.flatMap((s) => s.items.slice(0, 3).map((c) => c[0])));
    const before = new Set(exclude);
    const items = buildTypedTest(mulberry32(7), data, exclude);
    expect(items.length).toBe(TYPED_PER_LEVEL * 5);
    // Only the fixed, reviewed questions.
    expect(data.stage2?.length).toBe(228);
    const listed = new Set(data.stage2!.map((q) => q.c[0]));
    for (const it of items) {
      expect(listed.has(it.c[0]), it.c[0]).toBe(true);
      expect(before.has(it.c[0])).toBe(false);
      expect(it.c[5]).not.toBe('');
      expect(it.q.choices).toBeUndefined();
      expect(it.q.frame).toContain(`___ (${it.c[5]})`);
      expect(checkAnswer(it.q, it.c[1].slice(it.c[3], it.c[4])).correct, it.c[0]).toBe(true);
    }
    // All right: C1.
    expect(scoreTest(items, items.map(() => ({ correct: true, skipped: false }))).level).toBe('C1');
  });
});

describe('a result below A1', () => {
  it('has no slips (no level was reached, so none was made up for)', async () => {
    const { scoreTest } = await import('../../src/lib/levelTest.ts');
    const items = (['A1', 'A2', 'B1', 'B2', 'C1'] as const).flatMap((level) => Array.from({ length: 12 }, () => ({ level, topic: 'verbs' as const }))) as never;
    expect(scoreTest(items, [])).toMatchObject({ level: null, slips: [], answered: 0 });
    const wrong = Array.from({ length: 60 }, () => ({ correct: false, skipped: false }));
    expect(scoreTest(items, wrong)).toMatchObject({ level: null, slips: [] });
  });
});
