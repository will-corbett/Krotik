/**
 * Level test: 60 multiple-choice questions, 12 per level from A1 to C1, easiest first. Not adaptive.
 *
 * The questions come ready-checked from public/data/level-test.json (built by the data pipeline from
 * src/lib/levelTestPool.ts, which explains where they come from). Here each test draws 12 question types per level
 * (at most 2 per topic), one unused candidate of each, and orders them by a 1–3 difficulty weight and then by how
 * rare the word is, so no two tests are the same.
 *
 * Nothing is stored: the test in progress and its result live in memory (`session`) for as long as the tab is open,
 * so you can visit Learn pages from the results and come back to them. Reloading or closing the tab clears it.
 */
import type { LevelTestCandidate, LevelTestData } from '../shared/types.ts';
import { checkAnswer } from './check.ts';
import { loadLevelTest } from './data.ts';
import { candidateQuestion, TEST_LEVELS, type TestLevel } from './levelTestPool.ts';
import { pick, shuffle, type Rng } from './rng.ts';
import type { Mode, Question } from './types.ts';

export { ASK, TEST_LEVELS, type TestLevel } from './levelTestPool.ts';
export const PER_LEVEL = 12;
/**
 * Reaching a level L needs all three:
 *  - L itself: at least PASS of its 12 right;
 *  - A1 to L together: at least PASS in 12 right overall, so a slip at an easier level is made up by strong results;
 *  - no level below L under FLOOR of 12, so a real gap still stops you.
 * (Counts are scaled to 12, so an early-ended test is judged on the questions answered.)
 */
export const PASS = 10;
export const FLOOR = 8;
/** No topic more than this many times in one level. */
const MAX_PER_TOPIC = 2;

export interface TestItem {
  level: TestLevel;
  /** topic id = drill mode = Learn page */
  topic: Mode;
  /** what to do, in plain words */
  instruction: string;
  q: Question;
  /** the stored question, for the explanations on the results page */
  c: LevelTestCandidate;
}

type PoolSlot = LevelTestData['slots'][number];

/** The slots in random order, keeping at most MAX_PER_TOPIC per topic. */
export function chooseSlots<S extends { topic: string }>(pool: S[], rng: Rng): S[] {
  const count = new Map<string, number>();
  const out: S[] = [];
  for (const s of shuffle(rng, pool)) {
    if ((count.get(s.topic) ?? 0) >= MAX_PER_TOPIC) continue;
    count.set(s.topic, (count.get(s.topic) ?? 0) + 1);
    out.push(s);
  }
  return out;
}

/** Draw the 60 questions from the pool, level by level, each level ordered easier → harder. */
export function buildTest(rng: Rng, data: LevelTestData): TestItem[] {
  const items: TestItem[] = [];
  const keys = new Set<string>();
  for (const level of TEST_LEVELS) {
    const picked: { item: TestItem; w: number; order: number }[] = [];
    for (const slot of chooseSlots<PoolSlot>(data.slots.filter((s) => s.level === level), rng)) {
      if (picked.length >= PER_LEVEL) break;
      const fresh = slot.items.filter((c) => !keys.has(c[0]));
      if (!fresh.length) continue;
      const c = pick(rng, fresh);
      keys.add(c[0]);
      const topic = slot.topic as Mode;
      // Within a weight, rarer words later; questions with no single word (aspect, conjunctions …) fall in between.
      const order = c[12] >= 0 ? c[12] : rng() * 2500;
      picked.push({ item: { level, topic, instruction: slot.ask, q: candidateQuestion(c, topic, level, rng), c }, w: slot.w, order });
    }
    picked.sort((a, b) => a.w - b.w || a.order - b.order);
    items.push(...picked.map((p) => p.item));
  }
  return items;
}

/** Fetch the pool (one small file) and draw a test. */
export async function loadTest(rng: Rng): Promise<TestItem[]> {
  return buildTest(rng, await loadLevelTest());
}

/** An answer: the option chosen, or null for "I don't know"; undefined = not answered. */
export type Answer = string | null | undefined;
export type Response = { correct: boolean; skipped: boolean } | undefined;
export const responseOf = (item: TestItem, a: Answer): Response =>
  a === undefined ? undefined : a === null ? { correct: false, skipped: true } : { correct: checkAnswer(item.q, a).correct, skipped: false };

export interface TestResult {
  /** right answers per level */
  byLevel: Record<TestLevel, { right: number; total: number }>;
  /** highest level reached (see PASS); null = below A1 */
  level: TestLevel | null;
  /** levels below the result with fewer than PASS right: slips that the levels above made up for */
  slips: TestLevel[];
  /** topics with a wrong or "I don't know" answer, easiest level first, with how many were missed */
  review: { topic: Mode; level: TestLevel; missed: number }[];
  answered: number;
}

export function scoreTest(items: TestItem[], responses: Response[]): TestResult {
  const byLevel = Object.fromEntries(TEST_LEVELS.map((l) => [l, { right: 0, total: 0 }])) as TestResult['byLevel'];
  const review = new Map<Mode, { topic: Mode; level: TestLevel; missed: number }>();
  let answered = 0;
  items.forEach((it, i) => {
    const r = responses[i];
    if (!r) return;
    answered++;
    byLevel[it.level].total++;
    if (r.correct) byLevel[it.level].right++;
    else {
      const e = review.get(it.topic) ?? { topic: it.topic, level: it.level, missed: 0 };
      e.missed++;
      review.set(it.topic, e);
    }
  });
  const scaled = (l: TestLevel) => (byLevel[l].total ? (byLevel[l].right / byLevel[l].total) * PER_LEVEL : 0);
  const reaches = (at: number) => {
    const upTo = TEST_LEVELS.slice(0, at + 1);
    const right = upTo.reduce((n, l) => n + byLevel[l].right, 0);
    const total = upTo.reduce((n, l) => n + byLevel[l].total, 0);
    return scaled(TEST_LEVELS[at]!) >= PASS && (right / total) * PER_LEVEL >= PASS && upTo.every((l) => byLevel[l].total && scaled(l) >= FLOOR);
  };
  let reached = -1;
  for (let at = 0; at < TEST_LEVELS.length; at++) if (reaches(at)) reached = at;
  const level = reached < 0 ? null : TEST_LEVELS[reached]!;
  // Slips are levels below the one reached; with none reached there are none (slice(0, -1) would be all but C1).
  const slips = reached < 0 ? [] : TEST_LEVELS.slice(0, reached).filter((l) => scaled(l) < PASS);
  return { byLevel, level, slips, review: [...review.values()], answered };
}

/** The test in progress or finished, kept in memory only (never in storage) until the tab is closed or reloaded. */
export const session: {
  items: TestItem[];
  answers: Answer[];
  at: number;
  finished: boolean;
  /** stage 2, typed (see buildTypedTest) */
  typed: { items: TestItem[]; answers: Answer[]; at: number; finished: boolean };
} = { items: [], answers: [], at: 0, finished: false, typed: { items: [], answers: [], at: 0, finished: false } };

// ---- Stage 2: typed answers (productive grammar)
/**
 * Stage 2 is off the site (2026-11-10) until a native speaker has reviewed its questions: a word in brackets often
 * doesn't pin down one form (я ел / я ела, a different tense, singular or plural), so right answers were marked wrong.
 * Its questions are fixed in curated/stage2-questions.yaml; the review file is made from it (`npm run review:stage2`).
 */
export const STAGE2_PUBLISHED = false;
/** Typed questions per level in stage 2. */
export const TYPED_PER_LEVEL = 6;

/** A pool question as a typed one: the sentence with a gap and the word in brackets; type the form. */
export function typedQuestion(c: LevelTestCandidate, topic: Mode, level: TestLevel): Question {
  const [key, ru, en, start, end, hint, right, , , , , , , also = []] = c;
  const before = ru.slice(0, start);
  const after = ru.slice(end);
  return {
    key: `ty:${key}`,
    mode: topic,
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [],
    frame: `${before}___ (${hint})${after}`,
    // Every form that is also right here (я ел / я ела …), as cell variants.
    answer: [right, ...also].join(','),
    others: [],
    label: `${level} ${topic}`,
    speak: (f) => `${before}${f.replace(/'/g, '')}${after}`,
  };
}

/**
 * Stage 2: TYPED_PER_LEVEL questions per level from its fixed, reviewed list (`data.stage2`, from
 * curated/stage2-questions.yaml), none used in stage 1 (`exclude`), each of a different question type where there are
 * enough, easiest level first. Typing the form shows whether you can produce it, not just recognise it.
 */
export function buildTypedTest(rng: Rng, data: LevelTestData, exclude: Set<string>): TestItem[] {
  const items: TestItem[] = [];
  for (const level of TEST_LEVELS) {
    const byTopic = new Map<string, LevelTestCandidate[]>();
    for (const q of data.stage2 ?? []) if (q.level === level && !exclude.has(q.c[0])) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q.c]);
    let n = 0;
    // One of each type in a random order, then round again if there aren't enough types.
    while (n < TYPED_PER_LEVEL && [...byTopic.values()].some((l) => l.length)) {
      for (const topic of shuffle(rng, [...byTopic.keys()])) {
        if (n >= TYPED_PER_LEVEL) break;
        const fresh = byTopic.get(topic)!.filter((c) => !exclude.has(c[0]));
        if (!fresh.length) continue;
        const c = pick(rng, fresh);
        exclude.add(c[0]);
        byTopic.set(topic, fresh.filter((x) => x !== c));
        items.push({ level, topic: topic as Mode, instruction: 'Type the right form of the word in brackets.', q: typedQuestion(c, topic as Mode, level), c });
        n++;
      }
    }
  }
  return items;
}

