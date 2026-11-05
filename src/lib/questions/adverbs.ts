import { bare } from '../../shared/forms.ts';
import type { ParticipleRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { AdverbSettings, Question } from '../types.ts';
import { participleOthers } from './participles.ts';

/** Imperfective → present verbal adverb (читая); perfective → past (прочитав). */
export function adverbQuestion(row: ParticipleRow, band: number, want: 'impf' | 'pf'): Question | null {
  const [id, accented, gloss, aspect, advPres, advPast] = row;
  if (want === 'impf' && (aspect === 'pf' || !advPres)) return null;
  if (want === 'pf' && (aspect === 'impf' || !advPast)) return null;
  const answer = want === 'impf' ? advPres : advPast;
  const term = want === 'impf' ? TERMS.advImpf : TERMS.advPf;
  return {
    key: `adv:${id}:${want}`,
    mode: 'adverbs',
    headword: accented,
    gloss,
    task: [term],
    frame: '___, …',
    answer,
    others: participleOthers(row, want === 'impf' ? 'adv_pres' : 'adv_past'),
    label: `${term.en} (${term.ru})`,
    paradigm: { kind: 'participles', row },
    sentence: { type: 'verbs', lemmaId: id, cell: -1, band },
    speak: (f) => bare(f),
  };
}

export function generateAdverbQuestions(rows: { row: ParticipleRow; band: number }[], s: AdverbSettings, n: number, rng: Rng): Question[] {
  const out: Question[] = [];
  const keys = new Set<string>();
  if (!s.aspects.length || !rows.length) return out;
  let guard = 0;
  while (out.length < n && guard++ < n * 100) {
    const { row, band } = pick(rng, rows);
    const q = adverbQuestion(row, band, pick(rng, s.aspects));
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
