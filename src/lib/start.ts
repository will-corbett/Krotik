/** Loads the data a round needs and returns a question source for it. */
import { loadAdjectives, loadCloze, loadDiminutives, loadMotion, loadNouns, loadNumerals, loadParticiples, loadVerbs, toVerb } from './data.ts';
import { generateAdverbQuestions } from './questions/adverbs.ts';
import { generateParticipleQuestions } from './questions/participles.ts';
import { generateNumberQuestions } from './questions/numbers.ts';
import { generateDiminutiveQuestions } from './questions/diminutives.ts';
import { generateClozeQuestions } from './questions/cloze.ts';
import { generateAdjectiveQuestions } from './questions/adjectives.ts';
import { generateAspectQuestions } from './questions/aspect.ts';
import { generateMotionQuestions } from './questions/motion.ts';
import { generateVerbQuestions, isReflexive } from './questions/verbs.ts';
import { generateShortQuestions } from './questions/short.ts';
import { generateCompareQuestions } from './questions/compare.ts';
import { generatePluralQuestions } from './questions/plurals.ts';
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
    case 'reflexive': {
      const pool = (await loadVerbs(s.band)).filter(isReflexive);
      return (n) => generateVerbQuestions(pool, s.reflexive, n, rng, 'reflexive');
    }
    case 'short': {
      const pool = await loadAdjectives(s.band);
      return (n) => generateShortQuestions(pool, n, rng);
    }
    case 'compare': {
      const [adjs, nouns] = await Promise.all([loadAdjectives(s.band), loadNouns(Math.min(s.band, NOUN_MAX_BAND))]);
      return (n) => generateCompareQuestions(adjs, nouns, s.compare, n, rng);
    }
    case 'plurals': {
      const pool = await loadNouns(s.band);
      return (n) => generatePluralQuestions(pool, s.plurals, n, rng);
    }
    case 'adverbs': {
      const rows = await loadParticiples(s.band);
      return (n) => generateAdverbQuestions(rows, s.adverbs, n, rng);
    }
    case 'participles': {
      const [rows, nouns] = await Promise.all([loadParticiples(s.band), loadNouns(Math.min(s.band, NOUN_MAX_BAND))]);
      return (n) => generateParticipleQuestions(rows, nouns, s.participles, n, rng);
    }
    case 'numbers': {
      const [nums, nouns] = await Promise.all([loadNumerals(), loadNouns(NOUN_MAX_BAND)]);
      return (n) => generateNumberQuestions(nums, nouns, s.numbers, n, rng);
    }
    case 'diminutives': {
      const rows = (await loadDiminutives(s.band)).map((r) => r.row);
      return (n) => generateDiminutiveQuestions(rows, s.diminutives, n, rng);
    }
    case 'kotoryi':
    case 'chtoby':
    case 'conditional':
    case 'indefinite': {
      const rows = await loadCloze(s.mode);
      const topic = s.mode;
      return (n) => generateClozeQuestions(rows, topic, null, n, rng);
    }
    case 'negation': {
      const rows = await loadCloze('negation');
      return (n) => generateClozeQuestions(rows, 'negation', s.negation.kinds, n, rng);
    }
    case 'particles': {
      const rows = await loadCloze('particles');
      return (n) => generateClozeQuestions(rows, 'particles', s.particles.groups, n, rng);
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
  if (s.mode === 'reflexive' && !s.reflexive.groups.length) return 'Choose at least one tense.';
  if (s.mode === 'compare' && !s.compare.types.length) return 'Choose at least one question type.';
  if (s.mode === 'adverbs' && !s.adverbs.aspects.length) return 'Choose at least one aspect.';
  if (s.mode === 'participles' && (!s.participles.kinds.length || !s.participles.types.length)) return 'Choose at least one participle and one question type.';
  if (s.mode === 'numbers' && (!s.numbers.types.length || !s.numbers.ranges.length || !s.numbers.cases.length)) return 'Choose at least one question type, range and case.';
  if (s.mode === 'negation' && !s.negation.kinds.length) return 'Choose at least one kind of negation.';
  if (s.mode === 'particles' && !s.particles.groups.length) return 'Choose at least one group of particles.';
  if (s.mode === 'diminutives' && !s.diminutives.directions.length) return 'Choose at least one direction.';
  if (s.mode === 'plurals' && !s.plurals.contexts.length) return 'Choose at least one context.';
  if (s.mode === 'plurals' && s.plurals.contexts.length === 1 && s.plurals.contexts[0] === 'cases' && !s.plurals.cases.length) return 'Choose at least one case.';
  if (s.mode === 'adjectives' && !s.adjectives.cases.length) return 'Choose at least one case.';
  if (s.mode === 'motion' && !s.motion.types.length) return 'Choose at least one question type.';
  return null;
}
