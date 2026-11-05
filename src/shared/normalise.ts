/**
 * Answer normalisation, shared by the app's answer checker and the data pipeline
 * (sentence matching, ambiguity checks), so both use identical rules.
 */

/** Characters people type (or the data uses) to mark stress. */
const STRESS_MARKS = /['’`´́̀]/g;

/**
 * lowercase → NFC → strip stress marks → ё→е → trim and collapse internal whitespace.
 * NFC runs first so a decomposed ё (е + U+0308) is composed before the ё→е step.
 */
export function normalise(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(STRESS_MARKS, '')
    .replace(/ё/g, 'е')
    .trim()
    .replace(/\s+/g, ' ');
}
