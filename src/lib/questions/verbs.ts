import { VERB_CELLS } from '../../shared/cells.ts';
import { bare, displayForms } from '../../shared/forms.ts';
import { groupLabel, verbCellLabel } from '../labels.ts';
import { pick, type Rng } from '../rng.ts';
import type { Question, Verb, VerbSettings } from '../types.ts';

/** Pronoun used when speaking a form aloud ("она сказала"). */
function spokenPronoun(index: number): string {
  const c = VERB_CELLS[index]!;
  if (c.group === 'imperative') return '';
  return c.person === 'он/она' ? 'он' : c.person;
}

export function verbFormQuestion(v: Verb, cell: number, mode: Question['mode'] = 'verbs'): Question {
  const c = VERB_CELLS[cell]!;
  const others = v.cells
    .map((cellStr, i) => ({ label: verbCellLabel(i, v.aspect), cell: cellStr, i }))
    .filter((o) => o.i !== cell && o.cell)
    .map(({ label, cell: cs }) => ({ label, cell: cs }));
  const frame = c.group === 'imperative' ? `(${c.person}) ___!` : `${c.person} ___`;
  return {
    key: `v:${v.id}:${cell}`,
    mode,
    headword: v.accented,
    gloss: v.gloss,
    task: `${groupLabel(c.group, v.aspect)} · ${c.person}`,
    frame,
    answer: v.cells[cell]!,
    others,
    label: verbCellLabel(cell, v.aspect),
    paradigm: { kind: 'verb', verb: v },
    sentence: { type: 'verbs', lemmaId: v.id, cell, band: v.band },
    speak: (form) => [spokenPronoun(cell), bare(form)].filter(Boolean).join(' '),
  };
}

/** Cells of v that are in the chosen groups and present in the data. */
export function eligibleCells(v: Verb, s: VerbSettings): number[] {
  return VERB_CELLS.map((c, i) => [c, i] as const)
    .filter(([c, i]) => s.groups.includes(c.group) && v.cells[i] && displayForms(v.cells[i]).length)
    .map(([, i]) => i);
}

/**
 * n questions; each verb is used at most once per round when the pool allows it,
 * so a round doesn't drill one verb several times.
 */
export function generateVerbQuestions(pool: Verb[], s: VerbSettings, n: number, rng: Rng): Question[] {
  const usable = pool.filter((v) => eligibleCells(v, s).length);
  const out: Question[] = [];
  const usedVerbs = new Set<number>();
  const usedKeys = new Set<string>();
  let guard = 0;
  while (out.length < n && usable.length && guard++ < n * 50) {
    const v = pick(rng, usable);
    if (usedVerbs.has(v.id) && usedVerbs.size < usable.length) continue;
    const cell = pick(rng, eligibleCells(v, s));
    const q = verbFormQuestion(v, cell);
    if (usedKeys.has(q.key)) continue;
    usedVerbs.add(v.id);
    usedKeys.add(q.key);
    out.push(q);
  }
  return out;
}
