import { ADJ_CELLS, ADJ_INDEX, CASE_LABEL, NOUN_INDEX, SLOT_LABEL, adjCellFor, type AdjSlot, type Case } from '../../shared/cells.ts';
import { bare, displayForms } from '../../shared/forms.ts';
import { adjCellLabel } from '../labels.ts';
import { pick, type Rng } from '../rng.ts';
import type { AdjSettings, Adjective, Noun, Question } from '../types.ts';

export function adjectiveQuestion(a: Adjective, noun: Noun, c: Case, plural: boolean): Question | null {
  const slot: AdjSlot = plural ? 'pl' : noun.gender;
  const key = adjCellFor(slot, c, noun.animate);
  const answer = a.cells[ADJ_INDEX[key]]!;
  const nounCell = noun.cells[NOUN_INDEX[`${plural ? 'pl' : 'sg'}_${c}`]]!;
  const nounForm = displayForms(nounCell)[0];
  if (!answer || !nounForm) return null;
  const others = ADJ_CELLS.map((k, i) => ({ label: adjCellLabel(k), cell: a.cells[i]!, k }))
    .filter((o) => o.k !== key && o.cell)
    .map(({ label, cell }) => ({ label, cell }));
  const num = plural ? 'plural' : `${SLOT_LABEL[noun.gender]} singular`;
  const anim = c === 'acc' && (plural || noun.gender === 'm') ? (noun.animate ? ' · animate' : ' · inanimate') : '';
  return {
    key: `j:${a.id}:${noun.id}:${c}:${plural ? 'p' : 's'}`,
    mode: 'adjectives',
    headword: a.accented,
    gloss: a.gloss,
    task: `${CASE_LABEL[c]} · ${num}${anim}`,
    frame: `___ ${nounForm}`,
    note: `${noun.accented} — ${noun.gloss}`,
    answer,
    others,
    label: adjCellLabel(key),
    paradigm: { kind: 'adjective', adjective: a },
    sentence: { type: 'adjectives', lemmaId: a.id, cell: ADJ_INDEX[key], band: a.band },
    speak: (form) => `${bare(form)} ${bare(nounForm)}`,
  };
}

export function generateAdjectiveQuestions(adjs: Adjective[], nouns: Noun[], s: AdjSettings, n: number, rng: Rng): Question[] {
  const out: Question[] = [];
  const usedAdj = new Set<number>();
  const keys = new Set<string>();
  if (!adjs.length || !nouns.length || !s.cases.length) return out;
  let guard = 0;
  while (out.length < n && guard++ < n * 100) {
    const a = pick(rng, adjs);
    if (usedAdj.has(a.id) && usedAdj.size < adjs.length) continue;
    const plural = s.number === 'pl' || (s.number === 'both' && rng() < 0.5);
    const noun = pick(rng, nouns);
    if (plural && noun.sgOnly) continue;
    const q = adjectiveQuestion(a, noun, pick(rng, s.cases), plural);
    if (!q || keys.has(q.key)) continue;
    usedAdj.add(a.id);
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
