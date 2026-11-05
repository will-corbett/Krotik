import { CASES, NOUN_INDEX, type Case } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, TERMS } from '../terms.ts';
import type { Noun, NounCaseSettings, Question } from '../types.ts';
import { nounCellLabel } from './plurals.ts';

export function nounCaseQuestion(n: Noun, c: Case, plural: boolean): Question | null {
  if (plural && n.sgOnly) return null;
  const key = `${plural ? 'pl' : 'sg'}_${c}` as const;
  const answer = n.cells[NOUN_INDEX[key]];
  if (!answer || (c === 'nom' && !plural)) return null; // nominative singular is the headword itself
  return {
    key: `nc:${n.id}:${key}`,
    mode: 'nounCases',
    headword: n.accented,
    gloss: n.gloss,
    task: [CASE_TERM[c], plural ? TERMS.plural : TERMS.singular],
    frame: '___',
    answer,
    others: (Object.keys(NOUN_INDEX) as (keyof typeof NOUN_INDEX)[])
      .filter((k) => k !== key && n.cells[NOUN_INDEX[k]])
      .map((k) => ({ label: nounCellLabel(k), cell: n.cells[NOUN_INDEX[k]]! })),
    label: nounCellLabel(key),
    paradigm: { kind: 'noun', noun: n },
    sentence: { type: 'nouns', lemmaId: n.id, cell: NOUN_INDEX[key], band: n.band },
    speak: (f) => bare(f),
  };
}

export function generateNounCaseQuestions(nouns: Noun[], s: NounCaseSettings, n: number, rng: Rng): Question[] {
  const cases = s.cases.length ? s.cases : [...CASES];
  const out: Question[] = [];
  const used = new Set<number>();
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && nouns.length && guard++ < n * 100) {
    const noun = pick(rng, nouns);
    if (used.has(noun.id) && used.size < nouns.length) continue;
    const plural = s.number === 'pl' || (s.number === 'both' && rng() < 0.5);
    const q = nounCaseQuestion(noun, pick(rng, cases), plural);
    if (!q || keys.has(q.key)) continue;
    used.add(noun.id);
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
