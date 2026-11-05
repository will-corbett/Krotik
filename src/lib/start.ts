/** Loads the data a round needs and returns a question source for it. */
import { loadAdjectives, loadMotion, loadNouns, loadVerbs, toVerb } from './data.ts';
import { generateAdjectiveQuestions } from './questions/adjectives.ts';
import { generateAspectQuestions } from './questions/aspect.ts';
import { generateMotionQuestions } from './questions/motion.ts';
import { generateVerbQuestions } from './questions/verbs.ts';
import type { Rng } from './rng.ts';
import type { Settings } from './settings.ts';
import type { Question } from './types.ts';

/** Agreement nouns come from the 1,000 most frequent, so the noun is rarely the hard part. */
export const NOUN_MAX_BAND = 1;
/** Batch size for unlimited rounds; more is generated as the queue runs low. */
export const UNLIMITED_BATCH = 30;

export type Generate = (n: number) => Question[];

/** Load the data for these settings once; the returned function generates any number of questions. */
export async function prepareRound(s: Settings, rng: Rng): Promise<Generate> {
  switch (s.mode) {
    case 'verbs': {
      const pool = await loadVerbs(s.band);
      return (n) => generateVerbQuestions(pool, s.verbs, n, rng);
    }
    case 'aspect': {
      const pool = await loadVerbs(s.band);
      return (n) => generateAspectQuestions(pool, s.aspect, n, rng);
    }
    case 'adjectives': {
      const [adjs, nouns] = await Promise.all([loadAdjectives(s.band), loadNouns(Math.min(s.band, NOUN_MAX_BAND))]);
      return (n) => generateAdjectiveQuestions(adjs, nouns, s.adjectives, n, rng);
    }
    case 'motion': {
      const m = await loadMotion();
      const verbs = new Map(m.verbs.map((r) => [r[0], toVerb(r, 0)]));
      return (n) => generateMotionQuestions(m.pairs, verbs, s.motion, n, rng);
    }
  }
}

/**
 * Next batch for an unlimited round: avoids questions still waiting in the queue and
 * the most recently asked ones, but allows older repeats so small pools never run dry.
 */
export function nextBatch(generate: Generate, pending: Set<string>, recent: string[], n = UNLIMITED_BATCH): Question[] {
  const avoid = new Set([...pending, ...recent.slice(-Math.min(recent.length, 60))]);
  const fresh = generate(n * 2).filter((q) => !avoid.has(q.key));
  const out = fresh.slice(0, n);
  if (out.length < n) {
    // Small pool (e.g. motion verbs): top up with anything not currently pending.
    const seen = new Set(out.map((q) => q.key));
    for (const q of generate(n * 2)) {
      if (out.length >= n) break;
      if (!pending.has(q.key) && !seen.has(q.key)) {
        out.push(q);
        seen.add(q.key);
      }
    }
  }
  return out;
}

/** Does the mode have at least one option selected? */
export function settingsValid(s: Settings): string | null {
  if (s.mode === 'verbs' && !s.verbs.groups.length) return 'Choose at least one tense.';
  if (s.mode === 'adjectives' && !s.adjectives.cases.length) return 'Choose at least one case.';
  if (s.mode === 'motion' && !s.motion.types.length) return 'Choose at least one question type.';
  return null;
}
