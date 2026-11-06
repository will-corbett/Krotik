import { ADJ_EXTRA_CELL_OFFSET, ADJ_EXTRA_INDEX, ADJ_INDEX, NOUN_INDEX, adjCellFor, type AdjSlot } from '../../shared/cells.ts';
import { bare, displayForms } from '../../shared/forms.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS, numberGenderTerm } from '../terms.ts';
import { partnerPicker, type PartnerPicker } from '../pairs.ts';
import type { Adjective, CompareSettings, Noun, Question } from '../types.ts';
import { adjectiveOthers, extraLabel } from './short.ts';

export function degreeQuestion(a: Adjective, kind: 'comparative' | 'superlative'): Question | null {
  const i = ADJ_EXTRA_INDEX[kind];
  const answer = a.extra[i];
  if (!answer) return null;
  return {
    key: `c:${kind}:${a.id}`,
    mode: 'compare',
    headword: a.accented,
    gloss: a.gloss,
    task: [kind === 'comparative' ? TERMS.comparative : TERMS.superlative],
    frame: kind === 'comparative' ? '___, чем…' : '___',
    answer,
    others: adjectiveOthers(a, i),
    label: extraLabel(i),
    paradigm: { kind: 'adjective', adjective: a },
    sentence: { type: 'adjectives', lemmaId: a.id, cell: ADJ_EXTRA_CELL_OFFSET + i, band: a.band },
    speak: (f) => bare(f),
  };
}

/** Every combination of the main variants of two cells, e.g. "са'мая но'вая". */
function combine(first: string, second: string): string {
  return displayForms(first).flatMap((x) => displayForms(second).map((y) => `${x} ${y}`)).join(',');
}

/** самый + adjective agreeing with a noun in the nominative. Both words come from the source paradigms. */
export function samyiQuestion(a: Adjective, samyi: Adjective, noun: Noun, plural: boolean): Question | null {
  if (!noun.gender || (plural && noun.sgOnly)) return null;
  const slot: AdjSlot = plural ? 'pl' : noun.gender;
  const k = ADJ_INDEX[adjCellFor(slot, 'nom', noun.animate)];
  const s = samyi.cells[k];
  const adj = a.cells[k];
  const nounForm = displayForms(noun.cells[NOUN_INDEX[plural ? 'pl_nom' : 'sg_nom']]!)[0];
  if (!s || !adj || !nounForm) return null;
  return {
    key: `c:samyi:${a.id}:${noun.id}:${plural ? 'p' : 's'}`,
    mode: 'compare',
    headword: a.accented,
    gloss: a.gloss,
    task: [TERMS.samyi, numberGenderTerm(slot)],
    frame: `___ ${nounForm}`,
    note: `${noun.accented} — ${noun.gloss}`,
    answer: combine(s, adj),
    others: [],
    label: `${TERMS.samyi.en} (${TERMS.samyi.ru})`,
    paradigm: { kind: 'adjective', adjective: a },
    sentence: { type: 'adjectives', lemmaId: a.id, cell: k, band: a.band },
    speak: (f) => `${bare(f)} ${bare(nounForm)}`,
  };
}

export function generateCompareQuestions(adjs: Adjective[], nouns: Noun[], s: CompareSettings, n: number, rng: Rng, partner: PartnerPicker = partnerPicker(undefined, nouns)): Question[] {
  const samyi = adjs.find((a) => bare(a.accented) === 'самый');
  const types = s.types.filter((t) => t !== 'samyi' || samyi);
  const regular = adjs.filter((a) => /(ый|ий|ой)$/.test(bare(a.accented)) && a !== samyi && !['самый', 'весь', 'сам'].includes(bare(a.accented)));
  const gendered = nouns.filter((x) => x.gender);
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && types.length && guard++ < n * 100) {
    const t = pick(rng, types);
    let q: Question | null = null;
    if (t === 'samyi') {
      if (!gendered.length || !regular.length) continue;
      const a = pick(rng, regular);
      const noun = partner({ adj: a.accented }, rng);
      if (!noun) continue;
      q = samyiQuestion(a, samyi!, noun, rng() < 0.4);
    } else {
      const pool = adjs.filter((a) => a.extra[ADJ_EXTRA_INDEX[t]]);
      if (!pool.length) continue;
      q = degreeQuestion(pick(rng, pool), t);
    }
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
