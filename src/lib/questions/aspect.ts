import { VERB_INFINITIVE_CELL } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import { ASPECT_TERM, TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { AspectSettings, Question, Verb } from '../types.ts';

/** byAccented: the loaded verbs, to find the partner's own example sentences. */
export function aspectQuestion(v: Verb, byAccented?: Map<string, Verb>): Question {
  const partner = v.partners.map((p) => byAccented?.get(p)).find(Boolean);
  const target = v.aspect === 'impf' ? TERMS.pf : TERMS.impf;
  return {
    key: `a:${v.id}`,
    mode: 'aspect',
    headword: v.accented,
    gloss: v.gloss,
    task: [ASPECT_TERM[v.aspect], { en: `→ give the ${target.en} partner`, ru: `→ ${target.ru}` }],
    answer: v.partners.join(','),
    others: [],
    label: `${target.en} partner (${TERMS.aspectPair.ru}, ${target.ru})`,
    paradigm: { kind: 'verb', verb: v },
    ...(partner ? { sentence: { type: 'verbs' as const, lemmaId: partner.id, cell: VERB_INFINITIVE_CELL, band: partner.band } } : {}),
    speak: (form) => bare(form),
  };
}

export function generateAspectQuestions(pool: Verb[], s: AspectSettings, n: number, rng: Rng): Question[] {
  const ok = pool.filter(
    (v) =>
      v.partners.length > 0 &&
      ((s.direction !== 'to-impf' && v.aspect === 'impf') || (s.direction !== 'to-pf' && v.aspect === 'pf')),
  );
  const byAccented = new Map(pool.map((v) => [v.accented, v]));
  return shuffle(rng, ok).slice(0, n).map((v) => aspectQuestion(v, byAccented));
}
