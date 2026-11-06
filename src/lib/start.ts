/** Loads the data a round needs and returns a question source for it. */
import { loadAdjectives, loadCloze, loadDiminutives, loadExtraJson, loadPronouns, loadMotion, loadNouns, loadNumerals, loadParticiples, loadVerbs, toVerb } from './data.ts';
import { generateAdverbQuestions } from './questions/adverbs.ts';
import { generateParticipleQuestions } from './questions/participles.ts';
import { generateNumberQuestions } from './questions/numbers.ts';
import { generateDiminutiveQuestions } from './questions/diminutives.ts';
import { generateClozeQuestions } from './questions/cloze.ts';
import { generatePossessiveAgreement, generatePronounQuestions } from './questions/pronouns.ts';
import { generateNounCaseQuestions } from './questions/nounCases.ts';
import { generateStressQuestions } from './questions/stress.ts';
import { generateGovernmentChoice, type GovRow } from './questions/government.ts';
import { generatePrefixedMotion, type PrefixedData } from './questions/prefixedMotion.ts';
import { generateExtraNumberQuestions, type OrdinalRow } from './questions/numbers.ts';
import type { NumeralRow } from '../shared/types.ts';
import { pick } from './rng.ts';
import type { Question } from './types.ts';

/** Interleave several question lists into one of length n, drawing from a random non-empty list each time. */
function mix(rng: Rng, n: number, ...lists: Question[][]): Question[] {
  const queues = lists.filter((l) => l.length).map((l) => [...l]);
  const out: Question[] = [];
  while (out.length < n && queues.some((q) => q.length)) out.push(pick(rng, queues.filter((q) => q.length)).shift()!);
  return out;
}
import { generateAdjectiveQuestions } from './questions/adjectives.ts';
import { generateAspectQuestions } from './questions/aspect.ts';
import { generateMotionQuestions } from './questions/motion.ts';
import { generateVerbQuestions, isReflexive } from './questions/verbs.ts';
import { generateShortQuestions } from './questions/short.ts';
import { generateCompareQuestions } from './questions/compare.ts';
import { generatePluralQuestions } from './questions/plurals.ts';
import type { Rng } from './rng.ts';
import type { Settings } from './settings.ts';

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
      const [nums, nouns, ordinals, collectives] = await Promise.all([
        loadNumerals(),
        loadNouns(NOUN_MAX_BAND),
        loadExtraJson<OrdinalRow[]>('ordinals'),
        loadExtraJson<NumeralRow[]>('collectives'),
      ]);
      return (n) => {
        const basic = s.numbers.types.filter((t) => t === 'alone' || t === 'withNoun');
        const lists = [
          basic.length ? generateNumberQuestions(nums, nouns, { ...s.numbers, types: basic }, n, rng) : [],
          ...(['ordinal', 'compound', 'collective'] as const)
            .filter((k) => s.numbers.types.includes(k))
            .map((k) => generateExtraNumberQuestions(k, { numerals: nums, ordinals, collectives, nouns }, s.numbers.cases.length ? s.numbers.cases : ['gen'], n, rng)),
        ];
        return mix(rng, n, ...lists);
      };
    }
    case 'diminutives': {
      const rows = (await loadDiminutives(s.band)).map((r) => r.row);
      return (n) => generateDiminutiveQuestions(rows, s.diminutives, n, rng);
    }
    case 'kotoryi':
    case 'chtoby':
    case 'conditional':
    case 'indefinite':
    case 'prepositions':
    case 'aspectContext':
    case 'position':
    case 'impersonal':
    case 'comparison':
    case 'conjunctions':
    case 'time': {
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
    case 'pronouns': {
      const data = await loadPronouns();
      return (n) => generatePronounQuestions(data, s.pronouns, n, rng);
    }
    case 'possessives': {
      const [data, nouns, svoyRows] = await Promise.all([loadPronouns(), loadNouns(NOUN_MAX_BAND), s.possessives.types.includes('svoy') ? loadCloze('svoy') : Promise.resolve([])]);
      return (n) => {
        const types = s.possessives.types;
        const agree = types.includes('agree') ? generatePossessiveAgreement(data, nouns, n, rng) : [];
        const svoy = types.includes('svoy') ? generateClozeQuestions(svoyRows, 'svoy', null, n, rng).map((q) => ({ ...q, mode: 'possessives' as const })) : [];
        // Interleave the two types evenly.
        const out = [];
        for (let i = 0; out.length < n && (i < agree.length || i < svoy.length); i++) {
          if (agree[i] && (!svoy.length || rng() < 0.5 || !svoy[i])) out.push(agree[i]!);
          else if (svoy[i]) out.push(svoy[i]!);
        }
        return out.slice(0, n);
      };
    }
    case 'nounCases': {
      const pool = await loadNouns(s.band);
      return (n) => generateNounCaseQuestions(pool, s.nounCases, n, rng);
    }
    case 'stress': {
      const [verbs, nouns, adjectives] = await Promise.all([
        s.stressDrill.sources.includes('verbs') ? loadVerbs(s.band) : Promise.resolve([]),
        s.stressDrill.sources.includes('nouns') ? loadNouns(s.band) : Promise.resolve([]),
        s.stressDrill.sources.includes('adjectives') ? loadAdjectives(s.band) : Promise.resolve([]),
      ]);
      return (n) => generateStressQuestions({ verbs, nouns, adjectives }, s.stressDrill, n, rng);
    }
    case 'government': {
      const [rows, cz] = await Promise.all([loadExtraJson<GovRow[]>('government'), s.government.types.includes('sentence') ? loadCloze('government') : Promise.resolve([])]);
      return (n) => mix(
        rng,
        n,
        s.government.types.includes('choice') ? generateGovernmentChoice(rows, n, rng) : [],
        s.government.types.includes('sentence') ? generateClozeQuestions(cz, 'government', null, n, rng) : [],
      );
    }
    case 'prefixedMotion': {
      const data = await loadExtraJson<PrefixedData>('prefixedMotion');
      return (n) => generatePrefixedMotion(data, s.prefixedMotion, n, rng);
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
      const verbs = new Map(m.verbs.map((r) => [r[0], toVerb(r, m.bands[r[0]] ?? 0)]));
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
  if (s.mode === 'numbers' && (!s.numbers.types.length || !s.numbers.cases.length || (s.numbers.types.some((t) => t === 'alone' || t === 'withNoun') && !s.numbers.ranges.length))) return 'Choose at least one question type, range and case.';
  if (s.mode === 'pronouns' && (!s.pronouns.cases.filter((c) => c !== 'nom').length || !s.pronouns.prepositions.length)) return 'Choose at least one case and one context.';
  if (s.mode === 'possessives' && !s.possessives.types.length) return 'Choose at least one question type.';
  if (s.mode === 'government' && !s.government.types.length) return 'Choose at least one question type.';
  if (s.mode === 'prefixedMotion' && !s.prefixedMotion.types.length) return 'Choose at least one question type.';
  if (s.mode === 'stress' && !s.stressDrill.sources.length) return 'Choose at least one kind of word.';
  if (s.mode === 'negation' && !s.negation.kinds.length) return 'Choose at least one kind of negation.';
  if (s.mode === 'particles' && !s.particles.groups.length) return 'Choose at least one group of particles.';
  if (s.mode === 'diminutives' && !s.diminutives.directions.length) return 'Choose at least one direction.';
  if (s.mode === 'plurals' && !s.plurals.contexts.length) return 'Choose at least one context.';
  if (s.mode === 'plurals' && s.plurals.contexts.length === 1 && s.plurals.contexts[0] === 'cases' && !s.plurals.cases.length) return 'Choose at least one case.';
  if (s.mode === 'adjectives' && !s.adjectives.cases.length) return 'Choose at least one case.';
  if (s.mode === 'motion' && !s.motion.types.length) return 'Choose at least one question type.';
  return null;
}
