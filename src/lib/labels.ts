import { ADJ_CELLS, CASE_LABEL, SLOT_LABEL, VERB_CELLS, type AdjCellKey, type Aspect, type Case, type AdjSlot, type VerbGroup } from '../shared/cells.ts';

/** An imperfective verb's present/future forms are "Present"; a perfective's are "Future". */
export function groupLabel(group: VerbGroup, aspect: Aspect): string {
  if (group === 'past') return 'Past';
  if (group === 'imperative') return 'Imperative';
  return aspect === 'impf' ? 'Present' : aspect === 'pf' ? 'Future' : 'Present/future';
}

export function verbCellLabel(index: number, aspect: Aspect): string {
  const c = VERB_CELLS[index]!;
  return `${groupLabel(c.group, aspect)}, ${c.person} form`;
}

export const ASPECT_LABEL: Record<Aspect, string> = { impf: 'imperfective', pf: 'perfective', both: 'bi-aspectual' };

export function parseAdjKey(key: AdjCellKey): { slot: AdjSlot; c: Case; animate: boolean | null } {
  const [slot, c, anim] = key.split('_') as [AdjSlot, Case, string | undefined];
  const split = c === 'acc' && (slot === 'm' || slot === 'pl');
  return { slot, c, animate: split ? anim === 'anim' : null };
}

export function adjCellLabel(key: AdjCellKey): string {
  const { slot, c, animate } = parseAdjKey(key);
  const num = slot === 'pl' ? 'plural' : `${SLOT_LABEL[slot]} singular`;
  const anim = animate === null ? '' : animate ? ' (animate)' : ' (inanimate)';
  return `${CASE_LABEL[c]}, ${num}${anim}`;
}

export function adjCellLabelAt(i: number): string {
  return adjCellLabel(ADJ_CELLS[i]!);
}
