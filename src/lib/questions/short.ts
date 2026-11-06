import { ADJ_CELLS, ADJ_EXTRA, ADJ_EXTRA_CELL_OFFSET, ADJ_EXTRA_INDEX, type AdjSlot } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import { adjCellLabel } from '../labels.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS, numberGenderTerm, type Term } from '../terms.ts';
import type { Adjective, Question } from '../types.ts';

export const SHORT_SLOTS: AdjSlot[] = ['m', 'f', 'n', 'pl'];
const PRONOUN: Record<AdjSlot, string> = { m: 'он', f: 'она', n: 'оно', pl: 'они' };

export function extraLabel(i: number): string {
  const key = ADJ_EXTRA[i]!;
  if (key.startsWith('short_')) {
    const ng = numberGenderTerm(key.slice(6) as AdjSlot);
    return `${TERMS.shortForm.en}, ${ng.en} (${TERMS.shortForm.ru}, ${ng.ru})`;
  }
  const t: Term = key === 'comparative' ? TERMS.comparative : TERMS.superlative;
  return `${t.en} (${t.ru})`;
}

/** All other forms of the adjective (long and short), for "what you typed is the … form". */
export function adjectiveOthers(a: Adjective, exceptExtra: number): Question['others'] {
  return [
    ...a.extra.map((cell, i) => ({ label: extraLabel(i), cell, i })).filter((o) => o.i !== exceptExtra && o.cell),
    ...ADJ_CELLS.map((k, i) => ({ label: adjCellLabel(k), cell: a.cells[i]! })).filter((o) => o.cell),
  ].map(({ label, cell }) => ({ label, cell }));
}

export function shortQuestion(a: Adjective, slot: AdjSlot): Question | null {
  const i = ADJ_EXTRA_INDEX[`short_${slot}` as 'short_m'];
  const answer = a.extra[i];
  if (!answer) return null;
  return {
    key: `s:${a.id}:${slot}`,
    mode: 'short',
    headword: a.accented,
    gloss: a.gloss,
    task: [TERMS.shortForm, numberGenderTerm(slot)],
    frame: `${PRONOUN[slot]} ___`,
    answer,
    others: adjectiveOthers(a, i),
    label: extraLabel(i),
    paradigm: { kind: 'adjective', adjective: a },
    sentence: { type: 'adjectives', lemmaId: a.id, cell: ADJ_EXTRA_CELL_OFFSET + i, band: a.band },
    speak: (f) => `${PRONOUN[slot]} ${bare(f)}`,
  };
}

export function generateShortQuestions(pool: Adjective[], n: number, rng: Rng): Question[] {
  const usable = pool.filter((a) => a.extra[0]);
  const out: Question[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (out.length < n && usable.length && guard++ < n * 50) {
    const a = pick(rng, usable);
    if (used.has(a.id) && used.size < usable.length) continue;
    const q = shortQuestion(a, pick(rng, SHORT_SLOTS));
    if (!q || out.some((x) => x.key === q.key)) continue;
    used.add(a.id);
    out.push(q);
  }
  return out;
}
