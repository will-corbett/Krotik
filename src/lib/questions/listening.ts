/**
 * Listening drills (public/data/listening.json, from the recordings the site hosts):
 *  - listen and choose: hear a sentence; choose what you heard (four recorded sentences of about the same length) or
 *    what it means (four English translations);
 *  - dictation: hear a sentence, write it down (compared ignoring case, stress, ё, spacing and punctuation);
 *  - hear the ending: a recorded sentence with one word gapped; choose the form you heard (options sound different);
 *  - minimal pairs: hear a word; which of two was it (брат / брать)?
 */
import type { ListeningData, PairType } from '../../shared/types.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { DictationSettings, ListenSettings, PairSettings, Question } from '../types.ts';

const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;
export const wordCount = (ru: string) => [...ru.matchAll(TOKEN)].length;
type Sentence = ListeningData['sentences'][number];

const base = (key: string, mode: Question['mode'], s: Sentence) => ({
  key,
  mode,
  headword: '',
  gloss: '',
  others: [],
  source: s[0],
  listen: { rid: s[0], text: s[1], en: s[2] },
  speak: () => s[1],
});

const wordsOf = (ru: string) => new Set([...ru.matchAll(TOKEN)].map((m) => m[0].toLowerCase().replace(/ё/g, 'е')));

/**
 * Other sentences to offer beside `s`, all different from it and each other: those sharing most words with it first
 * (so "what did you hear?" needs listening, not just a glance), then the closest in length.
 */
function near(pool: Sentence[], s: Sentence, rng: Rng, pick: (x: Sentence) => string, n = 3): string[] {
  const len = wordCount(s[1]);
  const mine = wordsOf(s[1]);
  const shared = (x: Sentence) => [...wordsOf(x[1])].filter((w) => mine.has(w)).length;
  const want = pick(s).toLowerCase();
  const seen = new Set([want]);
  const out: string[] = [];
  const score = new Map(pool.map((x) => [x, shared(x) * 10 - Math.abs(wordCount(x[1]) - len)]));
  const sorted = shuffle(rng, pool).sort((a, b) => score.get(b)! - score.get(a)!);
  for (const x of sorted) {
    const v = pick(x);
    if (seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

export function generateListenQuestions(data: ListeningData, s: ListenSettings, n: number, rng: Rng): Question[] {
  const pool = data.sentences;
  if (pool.length < 4 || !s.tasks.length) return [];
  return shuffle(rng, pool)
    .slice(0, n)
    .map((x): Question => {
      const task = s.tasks[Math.floor(rng() * s.tasks.length)]!;
      if (task === 'meaning') {
        return {
          ...base(`lm:${x[0]}`, 'listen', x),
          task: [TERMS.listenMeaning],
          answer: x[2],
          choices: shuffle(rng, [x[2], ...near(pool, x, rng, (y) => y[2])]),
          meaning: true,
          label: TERMS.listenMeaning.en,
        };
      }
      return {
        ...base(`lt:${x[0]}`, 'listen', x),
        task: [TERMS.listenText],
        answer: x[1],
        choices: shuffle(rng, [x[1], ...near(pool, x, rng, (y) => y[1])]),
        meaning: true,
        optionsLang: 'ru',
        label: TERMS.listenText.en,
      };
    });
}

export const dictationLength = (ru: string): 'short' | 'long' => (wordCount(ru) <= 5 ? 'short' : 'long');

export function generateDictationQuestions(data: ListeningData, s: DictationSettings, n: number, rng: Rng): Question[] {
  return shuffle(
    rng,
    data.sentences.filter((x) => s.lengths.includes(dictationLength(x[1]))),
  )
    .slice(0, n)
    .map((x) => ({
      ...base(`dc:${x[0]}`, 'dictation', x),
      task: [TERMS.dictationTask],
      answer: x[1],
      dictation: true,
      label: TERMS.dictation.en,
    }));
}

export function generateEndingQuestions(data: ListeningData, n: number, rng: Rng): Question[] {
  const byId = new Map(data.sentences.map((x) => [x[0], x]));
  return shuffle(rng, data.endings)
    .slice(0, n)
    .flatMap(([rid, start, end, options]): Question[] => {
      const x = byId.get(rid);
      if (!x) return [];
      const word = x[1].slice(start, end);
      return [
        {
          ...base(`en:${rid}`, 'endings', x),
          task: [TERMS.endingsTask],
          frame: `${x[1].slice(0, start)}___${x[1].slice(end)}`,
          answer: word,
          choices: shuffle(rng, options),
          label: TERMS.endings.en,
        },
      ];
    });
}

export const PAIR_LABELS: Record<PairType, string> = {
  soft: 'Hard or soft at the end (брат / брать)',
  yi: 'ы or и (был / бил)',
  shsch: 'ш or щ',
};

export function generatePairQuestions(data: ListeningData, s: PairSettings, n: number, rng: Rng): Question[] {
  const pairs = data.pairs.filter((p) => s.types.includes(p[0]));
  if (!pairs.length) return [];
  const out: Question[] = [];
  // Each pair can come up twice (one word each time), so a short list still fills a round.
  const items = shuffle(rng, pairs.flatMap((p) => [[p, 0] as const, [p, 1] as const]));
  for (const [[, ka, a, kb, b], which] of items) {
    if (out.length >= n) break;
    const [key, word] = which ? [kb, b] : [ka, a];
    out.push({
      key: `mp:${key}`,
      mode: 'pairs',
      headword: '',
      gloss: '',
      task: [TERMS.pairsTask],
      answer: word,
      choices: [a, b],
      meaning: true,
      optionsLang: 'ru',
      others: [],
      label: TERMS.pairs.en,
      listen: { key, text: word.replace(/'/g, '') },
      speak: () => word.replace(/'/g, ''),
    });
  }
  return out;
}

/**
 * Dictation feedback: the sentence's words, each marked whether your text had it (in order: the longest common
 * subsequence of words, compared normalised), so the words you missed or got wrong stand out.
 */
export function wordDiff(typed: string, answer: string, norm: (s: string) => string): { word: string; ok: boolean }[] {
  const a = [...answer.matchAll(TOKEN)].map((m) => m[0]);
  const b = [...typed.matchAll(TOKEN)].map((m) => norm(m[0]));
  const an = a.map(norm);
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i]![j] = an[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: { word: string; ok: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length) {
    if (j < b.length && an[i] === b[j]) {
      out.push({ word: a[i]!, ok: true });
      i++;
      j++;
    } else if (j < b.length && L[i]![j + 1]! >= L[i + 1]![j]!) j++;
    else out.push({ word: a[i++]!, ok: false });
  }
  return out;
}
