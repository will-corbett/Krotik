import { bare } from '../../shared/forms.ts';
import { ASPECT_TERM, TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { AspectSettings, Question, Verb } from '../types.ts';

export function aspectQuestion(v: Verb): Question {
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
    sentence: { type: 'verbs', lemmaId: v.id, cell: -1, band: v.band },
    speak: (form) => bare(form),
  };
}

export function generateAspectQuestions(pool: Verb[], s: AspectSettings, n: number, rng: Rng): Question[] {
  const ok = pool.filter(
    (v) =>
      v.partners.length > 0 &&
      ((s.direction !== 'to-impf' && v.aspect === 'impf') || (s.direction !== 'to-pf' && v.aspect === 'pf')),
  );
  return shuffle(rng, ok).slice(0, n).map(aspectQuestion);
}
