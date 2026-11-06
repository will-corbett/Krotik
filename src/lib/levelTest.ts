/**
 * Level test: 60 multiple-choice questions, 12 per level from A1 to C1, easiest first. Not adaptive.
 *
 * The questions come ready-checked from public/data/level-test.json (built by the data pipeline from
 * src/lib/levelTestPool.ts, which explains where they come from). Here each test draws 12 question types per level
 * (at most 2 per topic), one unused candidate of each, and orders them by a 1–3 difficulty weight, so no two tests
 * are the same. Nothing is stored.
 */
import type { LevelTestData } from '../shared/types.ts';
import { loadLevelTest } from './data.ts';
import { candidateQuestion, TEST_LEVELS, type TestLevel } from './levelTestPool.ts';
import { pick, shuffle, type Rng } from './rng.ts';
import type { Mode, Question } from './types.ts';

export { ASK, TEST_LEVELS, type TestLevel } from './levelTestPool.ts';
export const PER_LEVEL = 12;
/** A level counts with at least this many of its 12 right (three quarters), and only if every level below counts. */
export const PASS = 9;
/** No topic more than this many times in one level. */
const MAX_PER_TOPIC = 2;

export interface TestItem {
  level: TestLevel;
  /** topic id = drill mode = Learn page */
  topic: Mode;
  /** what to do, in plain words */
  instruction: string;
  q: Question;
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
    const picked: { item: TestItem; w: number; tie: number }[] = [];
    for (const slot of chooseSlots<PoolSlot>(data.slots.filter((s) => s.level === level), rng)) {
      if (picked.length >= PER_LEVEL) break;
      const fresh = slot.items.filter((c) => !keys.has(c[0]));
      if (!fresh.length) continue;
      const c = pick(rng, fresh);
      keys.add(c[0]);
      const topic = slot.topic as Mode;
      picked.push({ item: { level, topic, instruction: slot.ask, q: candidateQuestion(c, topic, rng) }, w: slot.w, tie: rng() });
    }
    picked.sort((a, b) => a.w - b.w || a.tie - b.tie);
    items.push(...picked.map((p) => p.item));
  }
  return items;
}

/** Fetch the pool (one small file) and draw a test. */
export async function loadTest(rng: Rng): Promise<TestItem[]> {
  return buildTest(rng, await loadLevelTest());
}

export type Response = { correct: boolean; skipped: boolean } | undefined;

export interface TestResult {
  /** right answers per level */
  byLevel: Record<TestLevel, { right: number; total: number }>;
  /** highest level passed in order from A1 (stops at the first level not passed); null = below A1 */
  level: TestLevel | null;
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
  let level: TestLevel | null = null;
  for (const l of TEST_LEVELS) {
    const { right, total } = byLevel[l];
    // Scaled to 12 so an early-ended test is judged on the questions actually answered.
    if (total && (right / total) * PER_LEVEL >= PASS) level = l;
    else break;
  }
  return { byLevel, level, review: [...review.values()], answered };
}
