/**
 * Level test: a fixed, non-adaptive sequence of 60 multiple-choice questions, 12 per level from A1 to C1,
 * easiest first. Questions come from the drill generators (so every form is from the data); typed questions
 * become multiple choice by offering other real forms of the same word as the wrong options.
 *
 * The level given to each slot is our judgement of where that point is usually learnt (CEFR-style); the result
 * is an estimate of grammar and reading only. Nothing is stored.
 */
import { cellForms, displayForms } from '../shared/forms.ts';
import { normalise } from '../shared/normalise.ts';
import { checkAnswer } from './check.ts';
import { shuffle, type Rng } from './rng.ts';
import { DEFAULTS, type Settings } from './settings.ts';
import { prepareRound, type Generate } from './start.ts';
import type { Mode, Question } from './types.ts';

export const TEST_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type TestLevel = (typeof TEST_LEVELS)[number];
export const PER_LEVEL = 12;
/** A level counts as reached with at least this many of its 12 right (about two thirds). */
export const PASS = 8;

export interface Slot {
  level: TestLevel;
  mode: Mode;
  /** settings for that mode (merged into its defaults) */
  set?: Record<string, unknown>;
  /** vocabulary band: 0 = top 250 … 2 = top 2,500 */
  band?: 0 | 1 | 2;
  /** reject or adjust a generated question for this slot (e.g. leave out a form that belongs to another level) */
  fit?: (q: Question) => Question | null;
}

const s = (level: TestLevel, mode: Mode, set?: Record<string, unknown>, band: 0 | 1 | 2 = 0, fit?: Slot['fit']): Slot => ({ level, mode, set, band, fit });

/** Personal pronouns only (себя and кто/что are tested elsewhere, at their own level). */
const personalOnly: Slot['fit'] = (q) => (['себя', 'кто', 'что'].includes(q.headword.replace(/'/g, '')) ? null : q);

/**
 * Indefinite pronouns are left out on purpose: in real sentences -то and -нибудь often both fit, which is fine in a
 * drill but not in a test.
 *
 * Candidate slots per level, in order. The first 12 that produce a usable question are used; the rest are spares
 * (for a topic whose data happens not to yield a multiple-choice question).
 */
export const SLOTS: Record<TestLevel, Slot[]> = {
  A1: [
    s('A1', 'alphabet', { types: ['read'] }),
    s('A1', 'pronouns', { cases: ['acc'], prepositions: ['plain'] }, 0, personalOnly),
    s('A1', 'verbs', { groups: ['presfut'] }),
    s('A1', 'nounCases', { cases: ['prep'], number: 'sg' }),
    s('A1', 'adjectives', { cases: ['nom'], number: 'sg' }),
    s('A1', 'plurals', { contexts: ['nom'] }),
    s('A1', 'pronouns', { cases: ['dat'], prepositions: ['plain'] }, 0, personalOnly),
    s('A1', 'nounCases', { cases: ['acc'], number: 'sg' }),
    s('A1', 'conjunctions'),
    s('A1', 'verbs', { groups: ['past'] }),
    s('A1', 'questionWords', { types: ['sentence'] }),
    s('A1', 'narechiya', { types: ['form'] }),
    s('A1', 'alphabet', { types: ['letters'] }),
    s('A1', 'verbs', { groups: ['presfut'] }),
  ],
  A2: [
    s('A2', 'nounCases', { cases: ['gen'], number: 'sg' }),
    s('A2', 'pronouns', { cases: ['gen', 'dat', 'inst', 'prep'], prepositions: ['afterPrep'] }, 0, personalOnly),
    s('A2', 'adjectives', { cases: ['acc', 'gen', 'prep'], number: 'sg' }, 1),
    s('A2', 'nounCases', { cases: ['dat'], number: 'sg' }),
    s('A2', 'verbs', { groups: ['imperative'] }),
    s('A2', 'plurals', { contexts: ['numbers', 'quantity'] }),
    s('A2', 'possessives', { types: ['agree'] }),
    s('A2', 'nounCases', { cases: ['inst'], number: 'sg' }),
    s('A2', 'narechiya', { types: ['sentence'] }),
    s('A2', 'compare', { types: ['comparative'] }),
    s('A2', 'negation', { kinds: ['ne-ni'] }),
    s('A2', 'questionWords', { types: ['table'] }),
    s('A2', 'verbs', { groups: ['past'] }, 1),
    s('A2', 'conjunctions'),
  ],
  B1: [
    s('B1', 'aspectContext'),
    s('B1', 'nounCases', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'pl' }),
    s('B1', 'reflexive', { groups: ['presfut', 'past'] }, 1),
    s('B1', 'adjectives', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'pl' }, 0),
    s('B1', 'possessives', { types: ['svoy'] }),
    s('B1', 'short'),
    s('B1', 'position'),
    s('B1', 'ordinals', { types: ['agree'] }),
    s('B1', 'plurals', { contexts: ['cases'], cases: ['gen', 'dat', 'inst', 'prep'] }, 1),
    s('B1', 'narechiya', { types: ['comparative'] }, 1),
    s('B1', 'aspectContext'),
    s('B1', 'compare', { types: ['comparative'] }, 1),
    s('B1', 'nounCases', { cases: ['gen', 'inst'], number: 'pl' }, 1),
    s('B1', 'verbs', { groups: ['presfut'] }, 2),
  ],
  B2: [
    s('B2', 'adverbs', { aspects: ['impf', 'pf'] }, 1),
    s('B2', 'participles', { kinds: ['act_pres', 'act_past'], types: ['form'] }, 1),
    s('B2', 'government', { types: ['choice'] }),
    s('B2', 'particles', { groups: ['li', 'zhe-ved'] }),
    s('B2', 'compare', { types: ['superlative'] }, 1),
    s('B2', 'nounCases', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'both' }, 2),
    s('B2', 'participles', { kinds: ['pass_past'], types: ['short'] }, 1),
    s('B2', 'adjectives', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'both' }, 2),
    s('B2', 'participles', { kinds: ['act_pres', 'act_past'], types: ['decline'] }, 1),
    s('B2', 'reflexive', { groups: ['imperative'] }, 1),
    s('B2', 'verbs', { groups: ['past', 'imperative'] }, 2),
    s('B2', 'position'),
    s('B2', 'adverbs', { aspects: ['pf'] }, 2),
    s('B2', 'government', { types: ['choice'] }),
  ],
  C1: [
    s('C1', 'participles', { kinds: ['act_pres', 'act_past', 'pass_pres', 'pass_past'], types: ['decline'] }, 1),
    s('C1', 'specialCases', { types: ['form'] }, 2),
    s('C1', 'particles', { groups: ['colloquial'] }),
    s('C1', 'plurals', { contexts: ['cases'], cases: ['gen'] }, 2),
    s('C1', 'participles', { kinds: ['pass_pres', 'pass_past'], types: ['form'] }, 2),
    s('C1', 'adverbs', { aspects: ['impf', 'pf'] }, 2),
    s('C1', 'short', undefined, 2),
    s('C1', 'verbs', { groups: ['presfut', 'past', 'imperative'] }, 2),
    s('C1', 'particles', { groups: ['li', 'zhe-ved', 'colloquial'] }),
    s('C1', 'nounCases', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'pl' }, 2),
    s('C1', 'specialCases', { types: ['form'] }, 1),
    s('C1', 'participles', { kinds: ['act_pres', 'act_past'], types: ['decline'] }, 2),
    s('C1', 'compare', { types: ['superlative'] }, 2),
    s('C1', 'reflexive', { groups: ['presfut', 'past', 'imperative'] }, 2),
  ],
};

export interface TestItem {
  level: TestLevel;
  /** topic id = drill mode = Learn page */
  topic: Mode;
  q: Question;
}

function settingsFor(slot: Slot): Settings {
  const base = structuredClone(DEFAULTS);
  const st = { ...base, mode: slot.mode, band: slot.band ?? 0, count: 10 } as Settings;
  const key = (slot.mode === 'stress' ? 'stressDrill' : slot.mode) as keyof Settings;
  if (slot.set && key in st && typeof st[key] === 'object') (st as unknown as Record<string, unknown>)[key] = { ...(st[key] as object), ...slot.set };
  return st;
}

/**
 * The question as multiple choice: its own options if it has them (trimmed to 4), otherwise the answer plus up to
 * three other real forms of the same word. Null if there aren't enough wrong options.
 */
export function toChoice(q: Question, rng: Rng): Question | null {
  const answerSet = new Set(cellForms(q.answer).map(normalise));
  let right: string;
  let wrong: string[];
  if (q.choices?.length) {
    const ok = q.choices.find((c) => checkAnswer(q, c).correct);
    if (!ok) return null;
    right = ok;
    wrong = q.choices.filter((c) => c !== ok && !checkAnswer(q, c).correct);
  } else {
    right = displayForms(q.answer)[0] ?? '';
    const seen = new Set<string>();
    wrong = [];
    for (const o of q.others) {
      const f = displayForms(o.cell)[0];
      if (!f) continue;
      const n = normalise(f);
      if (answerSet.has(n) || seen.has(n)) continue;
      seen.add(n);
      wrong.push(f);
    }
  }
  // Built-in choices may be a real either/or (видел or увидел?); converted ones need at least two wrong forms.
  if (!right || wrong.length < (q.choices?.length ? 1 : 2)) return null;
  const options = shuffle(rng, [right, ...shuffle(rng, wrong).slice(0, 3)]);
  return { ...q, choices: options, frame: q.frame ?? '___' };
}

/** Build the 60 questions, level by level, easiest first. */
export async function buildTest(rng: Rng, onProgress?: (done: number) => void): Promise<TestItem[]> {
  const items: TestItem[] = [];
  const keys = new Set<string>();
  const gens = new Map<string, Generate>();
  for (const level of TEST_LEVELS) {
    let got = 0;
    for (const slot of SLOTS[level]) {
      if (got >= PER_LEVEL) break;
      const id = JSON.stringify([slot.mode, slot.set, slot.band]);
      let gen = gens.get(id);
      if (!gen) {
        try {
          gen = await prepareRound(settingsFor(slot), rng);
        } catch {
          continue;
        }
        gens.set(id, gen);
      }
      // A few tries: some questions have no usable wrong options, or repeat an earlier one.
      for (const cand of gen(8)) {
        if (keys.has(cand.key)) continue;
        const fitted = slot.fit ? slot.fit(cand) : cand;
        const q = fitted && toChoice(fitted, rng);
        if (!q) continue;
        keys.add(cand.key);
        items.push({ level, topic: slot.mode, q });
        got++;
        onProgress?.(items.length);
        break;
      }
    }
  }
  return items;
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
