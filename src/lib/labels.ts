import { ADJ_CELLS, VERB_CELLS, type AdjCellKey, type AdjSlot, type Aspect, type Case, type VerbGroup } from '../shared/cells.ts';
import { ASPECT_TERM, CASE_TERM, TERMS, groupTerm, numberGenderTerm } from './terms.ts';

export function groupLabel(group: VerbGroup, aspect: Aspect): string {
  return groupTerm(group, aspect).en;
}

/** "Past, она form (прошедшее время)" */
export function verbCellLabel(index: number, aspect: Aspect): string {
  const c = VERB_CELLS[index]!;
  const g = groupTerm(c.group, aspect);
  return `${g.en}, ${c.person} form (${g.ru})`;
}

export const ASPECT_LABEL: Record<Aspect, string> = { impf: ASPECT_TERM.impf.en, pf: ASPECT_TERM.pf.en, both: ASPECT_TERM.both.en };

export function parseAdjKey(key: AdjCellKey): { slot: AdjSlot; c: Case; animate: boolean | null } {
  const [slot, c, anim] = key.split('_') as [AdjSlot, Case, string | undefined];
  const split = c === 'acc' && (slot === 'm' || slot === 'pl');
  return { slot, c, animate: split ? anim === 'anim' : null };
}

/** "Accusative masculine singular, animate (винительный падеж, мужской род, единственное число, одушевлённое)" */
export function adjCellLabel(key: AdjCellKey): string {
  const { slot, c, animate } = parseAdjKey(key);
  const cs = CASE_TERM[c];
  const ng = numberGenderTerm(slot);
  const an = animate === null ? null : animate ? TERMS.animate : TERMS.inanimate;
  return `${cs.en} ${ng.en}${an ? `, ${an.en}` : ''} (${cs.ru}, ${ng.ru}${an ? `, ${an.ru}` : ''})`;
}

export function adjCellLabelAt(i: number): string {
  return adjCellLabel(ADJ_CELLS[i]!);
}
