/**
 * Build the sentence: the English of a real Tatoeba sentence, and its Russian words shuffled; put them in order. The
 * exact order of the original is marked right automatically. Russian word order is freer than English, so any other
 * order is shown beside the original and you mark it yourself (as in Translate and compare).
 */
import type { SentenceRow } from '../../shared/types.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { BuildSettings, Question } from '../types.ts';

const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

/**
 * The sentence's words, without punctuation, spelt as in the sentence. The first keeps its capital (lower-casing it
 * would also lower-case names like Том); comparing ignores case anyway.
 */
export function wordsOf(ru: string): string[] {
  return [...ru.matchAll(TOKEN)].map((m) => m[0]);
}
/** Short: 3–5 words; longer: 6–9. A sentence with a hyphen dash or digits isn't used (the corpus has no digits). */
export function buildLength(ru: string): 'short' | 'long' | null {
  if (/[—–]/.test(ru)) return null;
  const n = wordsOf(ru).length;
  return n >= 3 && n <= 5 ? 'short' : n >= 6 && n <= 9 ? 'long' : null;
}

export function buildQuestion(row: SentenceRow, rng: Rng): Question | null {
  const [id, ru, en] = row;
  const words = wordsOf(ru);
  if (new Set(words.map((w) => w.toLowerCase())).size < 3) return null;
  // Shuffled, but never in the original order.
  let chips = shuffle(rng, words);
  for (let i = 0; i < 5 && chips.join(' ') === words.join(' '); i++) chips = shuffle(rng, words);
  if (chips.join(' ') === words.join(' ')) chips = [...words.slice(1), words[0]!];
  return {
    key: `bd:${id}`,
    mode: 'build',
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [TERMS.buildTask],
    answer: ru,
    build: chips,
    others: [],
    label: TERMS.build.en,
    source: id,
    selfMark: true,
    speak: () => ru,
  };
}

export function generateBuildQuestions(rows: SentenceRow[], s: BuildSettings, n: number, rng: Rng): Question[] {
  const seen = new Set<number>();
  const pool = rows.filter((r) => {
    if (seen.has(r[0])) return false;
    seen.add(r[0]);
    const len = buildLength(r[1]);
    return len !== null && s.lengths.includes(len);
  });
  const out: Question[] = [];
  for (const r of shuffle(rng, pool)) {
    if (out.length >= n) break;
    const q = buildQuestion(r, rng);
    if (q) out.push(q);
  }
  return out;
}
