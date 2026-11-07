/**
 * Translate and compare: an English sentence to put into Russian. There's rarely only one right translation, so
 * the Tatoeba sentence is shown as a model afterwards and you mark yourself (an exact match counts as right).
 */
import type { SentenceRow } from '../../shared/types.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { Question, TranslateSettings } from '../types.ts';

const words = (s: string) => s.split(/\s+/).filter((w) => /[А-ЯЁа-яё]/.test(w)).length;
/** Short: up to 5 words; longer: 6–9. Longer sentences than that are too open to compare usefully. */
export function lengthOf(ru: string): 'short' | 'long' | null {
  const n = words(ru);
  return n <= 5 ? 'short' : n <= 9 ? 'long' : null;
}

export function translateQuestion(row: SentenceRow): Question {
  const [id, ru, en] = row;
  return {
    key: `tr:${id}`,
    mode: 'translate',
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [TERMS.translateTask],
    answer: ru,
    others: [],
    label: TERMS.translate.en,
    source: id,
    selfMark: true,
    speak: () => ru,
  };
}

/** Distinct sentences (by Tatoeba id) of the chosen lengths, in random order. */
export function generateTranslateQuestions(rows: SentenceRow[], s: TranslateSettings, n: number, rng: Rng): Question[] {
  const seen = new Set<number>();
  const pool = rows.filter((r) => {
    if (seen.has(r[0])) return false;
    seen.add(r[0]);
    const len = lengthOf(r[1]);
    return len !== null && s.lengths.includes(len);
  });
  return shuffle(rng, pool).slice(0, n).map(translateQuestion);
}

/** Does a typed translation match the model exactly (ignoring case, stress, ё, spacing and punctuation)? */
export function sameSentence(a: string, b: string, norm: (s: string) => string): boolean {
  const clean = (s: string) => norm(s.replace(/[.,!?;:«»"„“”—–()-]/g, ' ')).replace(/\s+/g, ' ').trim();
  return clean(a) !== '' && clean(a) === clean(b);
}
