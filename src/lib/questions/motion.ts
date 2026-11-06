import { VERB_CELLS, VERB_INFINITIVE_CELL } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import type { MotionPair } from '../../shared/types.ts';
import { pick, shuffle, type Rng } from '../rng.ts';
import type { MotionSettings, Question, Verb } from '../types.ts';
import { verbFormQuestion } from './verbs.ts';
import { TERMS } from '../terms.ts';

const UNI = 'one direction, one trip in progress';
const MULTI = 'round trips, habitual, or no set direction';

function meaningQuestion(p: MotionPair, uni: boolean, verb: Verb): Question {
  return {
    key: `m:meaning:${p.uniId}:${uni}`,
    mode: 'motion',
    headword: p.meaning,
    gloss: uni ? UNI : MULTI,
    task: [{ en: 'Name the verb' }, uni ? TERMS.uni : TERMS.multi],
    answer: uni ? p.uni : p.multi,
    others: [{ label: uni ? `multidirectional verb (${TERMS.multi.ru})` : `unidirectional verb (${TERMS.uni.ru})`, cell: uni ? p.multi : p.uni }],
    label: `${(uni ? TERMS.uni : TERMS.multi).en} verb for “${p.meaning}” (${(uni ? TERMS.uni : TERMS.multi).ru})`,
    paradigm: { kind: 'verb', verb },
    sentence: { type: 'verbs', lemmaId: verb.id, cell: VERB_INFINITIVE_CELL, band: verb.band },
    speak: (f) => bare(f),
    headwordIsEnglish: true,
  };
}

function partnerQuestion(fromUni: boolean, from: Verb, to: Verb): Question {
  return {
    key: `m:partner:${from.id}`,
    mode: 'motion',
    headword: from.accented,
    gloss: from.gloss,
    task: [fromUni ? TERMS.uni : TERMS.multi, { en: `→ give the ${(fromUni ? TERMS.multi : TERMS.uni).en} partner`, ru: `→ ${(fromUni ? TERMS.multi : TERMS.uni).ru}` }],
    answer: to.accented,
    others: [],
    label: `${(fromUni ? TERMS.multi : TERMS.uni).en} partner (${(fromUni ? TERMS.multi : TERMS.uni).ru})`,
    paradigm: { kind: 'verb', verb: to },
    sentence: { type: 'verbs', lemmaId: to.id, cell: VERB_INFINITIVE_CELL, band: to.band },
    speak: (f) => bare(f),
  };
}

export function generateMotionQuestions(pairs: MotionPair[], verbs: Map<number, Verb>, s: MotionSettings, n: number, rng: Rng): Question[] {
  if (!s.types.length) return [];
  const all: Question[] = [];
  for (const p of pairs) {
    const u = verbs.get(p.uniId);
    const m = verbs.get(p.multiId);
    if (!u || !m) continue;
    if (s.types.includes('meaning')) all.push(meaningQuestion(p, true, u), meaningQuestion(p, false, m));
    if (s.types.includes('partner')) all.push(partnerQuestion(true, u, m), partnerQuestion(false, m, u));
    if (s.types.includes('conjugate')) {
      for (const v of [u, m]) {
        const cells = VERB_CELLS.map((c, i) => [c, i] as const).filter(([c, i]) => c.group !== 'imperative' && v.cells[i]);
        // two random cells per verb keeps the candidate list balanced against the other types
        for (const [, i] of shuffle(rng, cells).slice(0, 2)) all.push({ ...verbFormQuestion(v, i, 'motion'), key: `m:conj:${v.id}:${i}` });
      }
    }
  }
  // Balance across selected types, then shuffle.
  const byType = s.types.map((t) => shuffle(rng, all.filter((q) => q.key.startsWith(`m:${t === 'conjugate' ? 'conj' : t}`))));
  const out: Question[] = [];
  while (out.length < n && byType.some((l) => l.length)) {
    const nonEmpty = byType.filter((l) => l.length);
    out.push(pick(rng, nonEmpty).shift()!);
  }
  return shuffle(rng, out);
}
