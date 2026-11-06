/**
 * The alphabet (алфавит): letter → sound, read a word (choose its romanisation), write a word (type it in Cyrillic).
 * Words are common nouns from the data; romanisation is a fixed, simple scheme (not a Russian form).
 */
import { bare } from '../../shared/forms.ts';
import { normalise } from '../../shared/normalise.ts';
import { pick, shuffle, type Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { AlphabetSettings, Noun, Question } from '../types.ts';

export interface Letter {
  upper: string;
  lower: string;
  roman: string;
  /** English approximation */
  sound: string;
  group: 'same' | 'false-friend' | 'new' | 'sign';
}

export const ALPHABET: Letter[] = [
  { upper: 'А', lower: 'а', roman: 'a', sound: 'a as in father', group: 'same' },
  { upper: 'Б', lower: 'б', roman: 'b', sound: 'b as in bag', group: 'new' },
  { upper: 'В', lower: 'в', roman: 'v', sound: 'v as in van', group: 'false-friend' },
  { upper: 'Г', lower: 'г', roman: 'g', sound: 'g as in go', group: 'new' },
  { upper: 'Д', lower: 'д', roman: 'd', sound: 'd as in dog', group: 'new' },
  { upper: 'Е', lower: 'е', roman: 'ye', sound: 'ye as in yes', group: 'false-friend' },
  { upper: 'Ё', lower: 'ё', roman: 'yo', sound: 'yo as in yoghurt; always stressed', group: 'new' },
  { upper: 'Ж', lower: 'ж', roman: 'zh', sound: 's as in measure', group: 'new' },
  { upper: 'З', lower: 'з', roman: 'z', sound: 'z as in zoo', group: 'new' },
  { upper: 'И', lower: 'и', roman: 'i', sound: 'ee as in meet', group: 'new' },
  { upper: 'Й', lower: 'й', roman: 'y', sound: 'y as in boy', group: 'new' },
  { upper: 'К', lower: 'к', roman: 'k', sound: 'k as in kit', group: 'same' },
  { upper: 'Л', lower: 'л', roman: 'l', sound: 'l as in milk', group: 'new' },
  { upper: 'М', lower: 'м', roman: 'm', sound: 'm as in map', group: 'same' },
  { upper: 'Н', lower: 'н', roman: 'n', sound: 'n as in net', group: 'false-friend' },
  { upper: 'О', lower: 'о', roman: 'o', sound: 'o as in more (when stressed)', group: 'same' },
  { upper: 'П', lower: 'п', roman: 'p', sound: 'p as in pen', group: 'new' },
  { upper: 'Р', lower: 'р', roman: 'r', sound: 'a rolled r', group: 'false-friend' },
  { upper: 'С', lower: 'с', roman: 's', sound: 's as in sun', group: 'false-friend' },
  { upper: 'Т', lower: 'т', roman: 't', sound: 't as in top', group: 'same' },
  { upper: 'У', lower: 'у', roman: 'u', sound: 'oo as in boot', group: 'false-friend' },
  { upper: 'Ф', lower: 'ф', roman: 'f', sound: 'f as in fun', group: 'new' },
  { upper: 'Х', lower: 'х', roman: 'kh', sound: 'ch as in Scottish loch', group: 'false-friend' },
  { upper: 'Ц', lower: 'ц', roman: 'ts', sound: 'ts as in cats', group: 'new' },
  { upper: 'Ч', lower: 'ч', roman: 'ch', sound: 'ch as in chat', group: 'new' },
  { upper: 'Ш', lower: 'ш', roman: 'sh', sound: 'sh as in shop (harder)', group: 'new' },
  { upper: 'Щ', lower: 'щ', roman: 'shch', sound: 'a long, soft sh', group: 'new' },
  { upper: 'Ъ', lower: 'ъ', roman: 'hard sign', sound: 'no sound: keeps the next vowel separate', group: 'sign' },
  { upper: 'Ы', lower: 'ы', roman: 'y (as in ы)', sound: 'like i in ill, said further back', group: 'new' },
  { upper: 'Ь', lower: 'ь', roman: 'soft sign', sound: 'no sound: softens the consonant before it', group: 'sign' },
  { upper: 'Э', lower: 'э', roman: 'e', sound: 'e as in met', group: 'new' },
  { upper: 'Ю', lower: 'ю', roman: 'yu', sound: 'you', group: 'new' },
  { upper: 'Я', lower: 'я', roman: 'ya', sound: 'ya as in yard', group: 'new' },
];

/** Romanisation used for whole words: simple and readable (й and ы both y; ь and ъ as the primes ʹ and ʺ, which,
 *  unlike an apostrophe, aren't read as a stress mark). */
const WORD_ROMAN: Record<string, string> = {
  ...Object.fromEntries(ALPHABET.map((l) => [l.lower, l.roman])),
  е: 'e', ъ: 'ʺ', ь: 'ʹ', ы: 'y',
};
export function romanise(word: string): string {
  return [...bare(word).toLowerCase()].map((c) => WORD_ROMAN[c] ?? c).join('');
}

/** Latin letters that look like a Cyrillic letter but aren't its sound: the classic reading mistakes. */
const FALSE_READING: Record<string, string> = { в: 'b', н: 'h', р: 'p', с: 'c', у: 'y', х: 'x', и: 'n', я: 'r', ш: 'w', п: 'n', ч: 'u', д: 'a', г: 'r' };

const usable = (n: Noun) => {
  const w = bare(n.accented);
  return /^[а-яё]{3,7}$/.test(w) && !!n.gloss;
};

export function letterQuestion(l: Letter, rng: Rng): Question {
  const others = shuffle(rng, ALPHABET.filter((x) => x !== l)).slice(0, 3).map((x) => x.roman);
  return {
    key: `abc:letter:${l.lower}`,
    mode: 'alphabet',
    headword: `${l.upper} ${l.lower}`,
    gloss: '',
    task: [TERMS.letterSound],
    answer: l.roman,
    others: [],
    choices: shuffle(rng, [l.roman, ...others]),
    label: `${l.upper} ${l.lower}`,
    explain: `${l.upper} ${l.lower}: ${l.sound}.`,
    speak: () => l.lower,
  };
}

export function readQuestion(n: Noun, rng: Rng): Question | null {
  const w = bare(n.accented).toLowerCase();
  const right = romanise(w);
  const wrong = new Set<string>();
  // Misread one letter as its Latin look-alike, at each position where that can happen.
  const letters = [...w];
  for (const i of shuffle(rng, letters.map((_, i) => i))) {
    const f = FALSE_READING[letters[i]!];
    if (!f) continue;
    const alt = letters.map((c, j) => (j === i ? f : (WORD_ROMAN[c] ?? c))).join('');
    if (normalise(alt) !== normalise(right)) wrong.add(alt);
    if (wrong.size >= 3) break;
  }
  if (wrong.size < 2) return null;
  return {
    key: `abc:read:${n.id}`,
    mode: 'alphabet',
    headword: n.accented,
    gloss: n.gloss,
    task: [TERMS.readWord],
    answer: right,
    others: [],
    choices: shuffle(rng, [right, ...[...wrong].slice(0, 3)]),
    label: `${TERMS.readWord.en} (${TERMS.readWord.ru})`,
    explain: 'Watch the false friends: В is v, Н is n, Р is r, С is s, У is u, Х is kh.',
    speak: () => w,
  };
}

export function writeQuestion(n: Noun): Question {
  return {
    key: `abc:write:${n.id}`,
    mode: 'alphabet',
    headword: romanise(n.accented),
    headwordIsEnglish: true,
    gloss: n.gloss,
    task: [TERMS.writeWord],
    frame: '___',
    answer: n.accented,
    others: [],
    label: `${TERMS.writeWord.en} (${TERMS.writeWord.ru})`,
    explain: 'Use the Cyrillic keyboard, or switch on phonetic typing on the Drill page (zh → ж, ch → ч, sh → ш, ya → я).',
    speak: (f) => bare(f),
  };
}

export function generateAlphabetQuestions(nouns: Noun[], s: AlphabetSettings, n: number, rng: Rng): Question[] {
  const words = nouns.filter(usable);
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && s.types.length && guard++ < n * 50) {
    const t = pick(rng, s.types);
    const q = t === 'letters' ? letterQuestion(pick(rng, ALPHABET), rng) : !words.length ? null : t === 'read' ? readQuestion(pick(rng, words), rng) : writeQuestion(pick(rng, words));
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
