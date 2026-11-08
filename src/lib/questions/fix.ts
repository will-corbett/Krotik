/**
 * Error correction: a real Tatoeba sentence with one word replaced by another real form of the same word (the Grammar
 * test's checked wrong options: a different person, case, gender or number that can't fit). Find the wrong word, then
 * type the right form. Only "form of the word in brackets" items are used: in the choice items (aspect, adverb or
 * adjective) the other option can sometimes also be grammatical.
 */
import { bare } from '../../shared/forms.ts';
import type { LevelTestCandidate, LevelTestData } from '../../shared/types.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { FixSettings, Question } from '../types.ts';

const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

/** The sentence with the wrong form in the gap, as text pieces; words numbered, and which one is wrong. */
export function fixPieces(ru: string, start: number, end: number, wrong: string): { pieces: { text: string; word?: number }[]; wrongWord: number } {
  const first = ru.slice(start, end);
  const w = bare(wrong);
  // Keep a capital at the start of the sentence.
  const shown = /^[А-ЯЁ]/.test(first) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  const text = ru.slice(0, start) + shown + ru.slice(end);
  const pieces: { text: string; word?: number }[] = [];
  let last = 0;
  let n = 0;
  let wrongWord = -1;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) pieces.push({ text: text.slice(last, m.index) });
    if (m.index === start) wrongWord = n;
    pieces.push({ text: m[0], word: n++ });
    last = m.index! + m[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  return { pieces, wrongWord };
}

export function fixQuestion(c: LevelTestCandidate, level: string, rng: Rng): Question | null {
  const [key, ru, en, start, end, bracket, right, wrongs] = c;
  if (!bracket || !wrongs.length) return null;
  // One of the two closest wrong forms (the options are listed closest first).
  const wrong = wrongs[Math.floor(rng() * Math.min(2, wrongs.length))]!;
  if (bare(wrong) === bare(right)) return null;
  const { pieces, wrongWord } = fixPieces(ru, start, end, wrong);
  if (wrongWord < 0) return null;
  return {
    key: `fx:${key}`,
    mode: 'fix',
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [TERMS.fixTask],
    answer: right,
    others: [],
    label: `${TERMS.fix.en} (${level})`,
    fix: { pieces, wrong: wrongWord, wrongForm: bare(wrong), original: ru },
    source: Number(key.split(':').find((x) => /^\d{4,}$/.test(x)) ?? 0) || undefined,
    speak: () => ru,
  };
}

export function generateFixQuestions(data: LevelTestData, s: FixSettings, n: number, rng: Rng): Question[] {
  const items = data.slots.filter((slot) => s.levels.includes(slot.level)).flatMap((slot) => slot.items.map((c) => ({ c, level: slot.level })));
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const { c, level } of shuffle(rng, items)) {
    if (out.length >= n) break;
    const q = fixQuestion(c, level, rng);
    if (q && !seen.has(q.headword)) {
      seen.add(q.headword);
      out.push(q);
    }
  }
  return out;
}
