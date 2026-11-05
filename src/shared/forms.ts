/**
 * Form cells. Source notation: stress is an apostrophe after the stressed vowel
 * ("сказа'л"); ё carries implicit stress. A cell may hold several variants.
 *
 * Canonical cell string (what the pipeline writes into shards):
 *   variants separated by ","; an optional / archaic variant is wrapped in "( )".
 *   e.g. "до'лжной,(до'лжною)"   "уда'лось,удало'сь"
 * Optional variants are accepted as correct but not shown as the main answer.
 */
import { normalise } from './normalise.ts';

export interface Variant {
  form: string;
  optional: boolean;
}

export function parseCell(cell: string): Variant[] {
  if (!cell) return [];
  return cell
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) =>
      v.startsWith('(') && v.endsWith(')')
        ? { form: v.slice(1, -1).trim(), optional: true }
        : { form: v, optional: false },
    );
}

/** All forms in a cell, including optional ones. */
export function cellForms(cell: string): string[] {
  return parseCell(cell).map((v) => v.form);
}

/** Forms to display as the answer (optional variants omitted unless nothing else exists). */
export function displayForms(cell: string): string[] {
  const vs = parseCell(cell);
  const main = vs.filter((v) => !v.optional).map((v) => v.form);
  return main.length ? main : vs.map((v) => v.form);
}

/** Does normalised input equal any variant of this cell? */
export function cellMatches(cell: string, input: string): boolean {
  const n = normalise(input);
  if (!n) return false;
  return cellForms(cell).some((f) => normalise(f) === n);
}

const VOWELS = /[аеёиоуыэюя]/gi;

export function vowelCount(word: string): number {
  return (word.replace(/'/g, '').match(VOWELS) ?? []).length;
}

/**
 * Render a form for display. With stress on, the apostrophe becomes U+0301 on the
 * preceding vowel. Marks are dropped on ё (already stressed) and on one-vowel words.
 */
export function renderForm(form: string, showStress: boolean): string {
  if (!showStress || vowelCount(form) <= 1) return form.replace(/'/g, '');
  return form.replace(/(.)'/g, (_, ch: string) => (ch === 'ё' || ch === 'Ё' ? ch : ch + '́'));
}

/** Plain form without stress apostrophes (keeps ё). */
export function bare(form: string): string {
  return form.replace(/'/g, '');
}

/** Character indices of stressed vowels in the bare form (for the stress drill, M2). */
export function stressPositions(form: string): number[] {
  const out: number[] = [];
  let bareIndex = 0;
  for (let i = 0; i < form.length; i++) {
    const ch = form[i]!;
    if (ch === "'") {
      out.push(bareIndex - 1);
      continue;
    }
    if (ch === 'ё' || ch === 'Ё') out.push(bareIndex);
    bareIndex++;
  }
  return [...new Set(out)];
}
