/** Loads the data a round needs and generates its questions. */
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

export async function buildRound(s: Settings, rng: Rng): Promise<Question[]> {
  switch (s.mode) {
    case 'verbs':
      return generateVerbQuestions(await loadVerbs(s.band), s.verbs, s.count, rng);
    case 'aspect':
      return generateAspectQuestions(await loadVerbs(s.band), s.aspect, s.count, rng);
    case 'adjectives': {
      const [adjs, nouns] = await Promise.all([loadAdjectives(s.band), loadNouns(Math.min(s.band, NOUN_MAX_BAND))]);
      return generateAdjectiveQuestions(adjs, nouns, s.adjectives, s.count, rng);
    }
    case 'motion': {
      const m = await loadMotion();
      const verbs = new Map(m.verbs.map((r) => [r[0], toVerb(r, 0)]));
      return generateMotionQuestions(m.pairs, verbs, s.motion, s.count, rng);
    }
  }
}

/** Does the mode have at least one option selected? */
export function settingsValid(s: Settings): string | null {
  if (s.mode === 'verbs' && !s.verbs.groups.length) return 'Choose at least one tense.';
  if (s.mode === 'adjectives' && !s.adjectives.cases.length) return 'Choose at least one case.';
  if (s.mode === 'motion' && !s.motion.types.length) return 'Choose at least one question type.';
  return null;
}
