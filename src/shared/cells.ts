/** Fixed cell layouts for each lexical type. Shards store cells as arrays in this order. */

export type Aspect = 'impf' | 'pf' | 'both';

export const VERB_CELLS = [
  { key: 'pf_sg1', group: 'presfut', person: 'я' },
  { key: 'pf_sg2', group: 'presfut', person: 'ты' },
  { key: 'pf_sg3', group: 'presfut', person: 'он/она' },
  { key: 'pf_pl1', group: 'presfut', person: 'мы' },
  { key: 'pf_pl2', group: 'presfut', person: 'вы' },
  { key: 'pf_pl3', group: 'presfut', person: 'они' },
  { key: 'past_m', group: 'past', person: 'он' },
  { key: 'past_f', group: 'past', person: 'она' },
  { key: 'past_n', group: 'past', person: 'оно' },
  { key: 'past_pl', group: 'past', person: 'они' },
  { key: 'imp_sg', group: 'imperative', person: 'ты' },
  { key: 'imp_pl', group: 'imperative', person: 'вы' },
] as const;
export type VerbGroup = (typeof VERB_CELLS)[number]['group'];
/** In example-sentence masks a verb's infinitive is bit 12, after its 12 cells. */
export const VERB_INFINITIVE_CELL = 12;
/** In example-sentence masks an adjective's extra cells (short forms, degrees) follow its 26 declension cells. */
export const ADJ_EXTRA_CELL_OFFSET = 26;

export const CASES = ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'] as const;
export type Case = (typeof CASES)[number];
export const CASE_LABEL: Record<Case, string> = {
  nom: 'Nominative',
  gen: 'Genitive',
  dat: 'Dative',
  acc: 'Accusative',
  inst: 'Instrumental',
  prep: 'Prepositional',
};

export type Gender = 'm' | 'f' | 'n';
export type AdjSlot = Gender | 'pl';
export const ADJ_SLOTS: readonly AdjSlot[] = ['m', 'f', 'n', 'pl'];
export const SLOT_LABEL: Record<AdjSlot, string> = {
  m: 'masculine',
  f: 'feminine',
  n: 'neuter',
  pl: 'plural',
};

/**
 * Adjective cells: for m and pl the accusative is split into inanimate/animate cells,
 * resolved at build time by matching the source accusative variants against nom/gen.
 */
export type AdjCellKey = `${AdjSlot}_${Case}` | 'm_acc_anim' | 'pl_acc_anim';
export const ADJ_CELLS: readonly AdjCellKey[] = ADJ_SLOTS.flatMap((s) => {
  const keys: AdjCellKey[] = CASES.map((c) => `${s}_${c}` as AdjCellKey);
  if (s === 'm' || s === 'pl') keys.splice(4, 0, `${s}_acc_anim` as AdjCellKey);
  return keys;
});
export const ADJ_INDEX = Object.fromEntries(ADJ_CELLS.map((k, i) => [k, i])) as Record<AdjCellKey, number>;

/** Extra adjective cells (short forms, degrees of comparison); "" = not in the source. */
export const ADJ_EXTRA = ['short_m', 'short_f', 'short_n', 'short_pl', 'comparative', 'superlative'] as const;
export type AdjExtraKey = (typeof ADJ_EXTRA)[number];
export const ADJ_EXTRA_INDEX = Object.fromEntries(ADJ_EXTRA.map((k, i) => [k, i])) as Record<AdjExtraKey, number>;

/** Noun cells: sg nom..prep then pl nom..prep. */
export const NOUN_CELLS = (['sg', 'pl'] as const).flatMap((num) => CASES.map((c) => `${num}_${c}` as const));
export type NounCellKey = (typeof NOUN_CELLS)[number];
export const NOUN_INDEX = Object.fromEntries(NOUN_CELLS.map((k, i) => [k, i])) as Record<NounCellKey, number>;

/** Key for the adjective cell that agrees with a noun of this slot/case/animacy. */
export function adjCellFor(slot: AdjSlot, c: Case, animate: boolean): AdjCellKey {
  if (c === 'acc' && (slot === 'm' || slot === 'pl') && animate) return `${slot}_acc_anim`;
  return `${slot}_${c}`;
}
