/**
 * Vocabulary: the commonest words (or your own, src/lib/words.ts), both ways round.
 * - Recognise: the Russian word, choose its English meaning from four. The wrong meanings are of the same word type,
 *   from words spelt differently, and share no English word with the right one (so two can't both fit).
 * - Recall: the English meaning and the word type; type the Russian word. Any word of the same type whose meaning
 *   includes the same English item is accepted too (see → видеть or увидеть), and named after answering.
 */
import { bare } from '../../shared/forms.ts';
import { normalise } from '../../shared/normalise.ts';
import type { SentenceType } from '../../shared/types.ts';
import { TERMS, type TaskPart } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { ParadigmRef, Question, VocabSettings, Word } from '../types.ts';

export const CHOICES = 4;
const MAX_ALSO = 5;
/** English words too common to say two meanings overlap. */
const STOP = new Set(['the', 'and', 'for', 'one', 'not', 'with', 'from', 'out', 'off', 'get', 'have', 'make', 'take', 'put', 'give', 'into', 'onto', 'sth', 'smb', 'someone', 'something', 'oneself', 'informal', 'colloquial']);

/** Content words of a meaning (lowercase, 3+ letters, not in STOP). */
export function meaningWords(gloss: string): Set<string> {
  return new Set(
    gloss
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}
/** A meaning's items ("see, catch sight of" → see | catch sight of), without bracketed notes. */
export function meaningItems(gloss: string): string[] {
  return gloss
    .split(/[,;]/)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim().toLowerCase())
    .filter(Boolean);
}
const headBare = (w: Word) => normalise(bare(w.accented.split(',')[0]!));

const SENTENCE_TYPE: Record<string, SentenceType> = { n: 'nouns', v: 'verbs', a: 'adjectives' };
function posParts(w: Word): TaskPart[] {
  if (w.pos === 'n') return [TERMS.nounPos];
  if (w.pos === 'a') return [TERMS.adjectivePos];
  if (w.pos === 'v') return [TERMS.verbPos, ...(w.extra === 'impf' ? [TERMS.impf] : w.extra === 'pf' ? [TERMS.pf] : [])];
  return [];
}

export interface VocabPool {
  /** every loaded word (distractors and alternatives come from here) */
  all: Word[];
  /** the full forms of a word, when its grammar data is loaded */
  paradigm?: (w: Word) => ParadigmRef | undefined;
}

function base(w: Word, pool: VocabPool): Pick<Question, 'mode' | 'others' | 'label' | 'speak' | 'word' | 'sentence' | 'paradigm'> {
  const type = SENTENCE_TYPE[w.pos];
  const id = Number(w.key.slice(2));
  const p = pool.paradigm?.(w);
  // Typing the other aspect is a near miss worth naming ("…, which is its perfective partner").
  const partner = w.extra === 'impf' ? 'perfective partner' : w.extra === 'pf' ? 'imperfective partner' : 'aspect partner';
  const others = p?.kind === 'verb' ? p.verb.partners.map((cell) => ({ label: partner, cell })) : [];
  return {
    mode: 'vocab',
    others,
    label: TERMS.vocab.en,
    speak: () => bare(w.accented.split(',')[0]!),
    word: { key: w.key, band: w.band },
    ...(type ? { sentence: { type, lemmaId: id, cell: -1, band: w.band } } : {}),
    ...(p ? { paradigm: p } : {}),
  };
}

export function recogniseQuestion(w: Word, pool: VocabPool, rng: Rng): Question | null {
  const mine = meaningWords(w.gloss);
  const head = headBare(w);
  const wrong: string[] = [];
  const used = new Set([w.gloss.toLowerCase()]);
  const usedWords = new Set(mine);
  const sameType = pool.all.filter((o) => o.pos === w.pos);
  // Random probes rather than shuffling the whole pool (it can be tens of thousands of words).
  for (let tries = 0; wrong.length < CHOICES - 1 && tries < 400; tries++) {
    const o = sameType[Math.floor(rng() * sameType.length)];
    if (!o || o.key === w.key || headBare(o) === head || used.has(o.gloss.toLowerCase())) continue;
    const ow = meaningWords(o.gloss);
    if ([...ow].some((x) => usedWords.has(x))) continue;
    wrong.push(o.gloss);
    used.add(o.gloss.toLowerCase());
    for (const x of ow) usedWords.add(x);
  }
  if (wrong.length < CHOICES - 1) return null;
  return {
    ...base(w, pool),
    key: `vr:${w.key}`,
    headword: w.accented,
    gloss: '',
    task: [TERMS.meaningTask, ...posParts(w)],
    answer: w.gloss,
    choices: shuffle(rng, [w.gloss, ...wrong]),
    meaning: true,
  };
}

/** Other words of the same type sharing an English item with this one (accepted in Recall). */
export function alsoRight(w: Word, byItem: Map<string, Word[]>): Word[] {
  const head = headBare(w);
  const out = new Map<string, Word>();
  for (const item of meaningItems(w.gloss)) {
    for (const o of byItem.get(`${w.pos}|${item}`) ?? []) {
      // A verb's aspect is part of the question, so only verbs of the same aspect count.
      if (o.key === w.key || headBare(o) === head || (w.pos === 'v' && o.extra !== w.extra)) continue;
      out.set(o.key, o);
    }
  }
  return [...out.values()].slice(0, MAX_ALSO);
}

const indexCache = new WeakMap<Word[], Map<string, Word[]>>();
/** word type + English item → the words with it (cached per pool). */
export function indexByItem(all: Word[]): Map<string, Word[]> {
  const cached = indexCache.get(all);
  if (cached) return cached;
  const m = new Map<string, Word[]>();
  indexCache.set(all, m);
  for (const w of all) {
    for (const item of meaningItems(w.gloss)) {
      const k = `${w.pos}|${item}`;
      const list = m.get(k);
      if (list) list.push(w);
      else m.set(k, [w]);
    }
  }
  return m;
}

export function recallQuestion(w: Word, pool: VocabPool, byItem: Map<string, Word[]>): Question {
  const also = alsoRight(w, byItem);
  // Accepted but not shown: "(x)" variants of the answer cell.
  const hidden = also.flatMap((o) => o.accented.split(',').map((v) => `(${v.trim().replace(/[()]/g, '')})`));
  return {
    ...base(w, pool),
    key: `vc:${w.key}`,
    headword: w.gloss,
    headwordIsEnglish: true,
    gloss: '',
    task: [TERMS.recallTask, ...posParts(w)],
    answer: [w.accented, ...hidden].join(','),
    ...(also.length ? { explain: `Also right: ${also.map((o) => `${bare(o.accented.split(',')[0]!)} (${o.gloss})`).join('; ')}.` } : {}),
  };
}

/**
 * Questions about `targets` (in the order given when `ordered`, else shuffled), each asked one way round: the chosen
 * direction, or at random for "both".
 */
export function generateVocabQuestions(targets: Word[], pool: VocabPool, s: VocabSettings, n: number, rng: Rng, ordered = false): Question[] {
  const byItem = indexByItem(pool.all);
  const out: Question[] = [];
  const list = ordered ? targets : shuffle(rng, targets);
  for (const w of list) {
    if (out.length >= n) break;
    const dir = s.direction === 'both' ? (rng() < 0.5 ? 'recognise' : 'recall') : s.direction;
    const q = dir === 'recognise' ? recogniseQuestion(w, pool, rng) : recallQuestion(w, pool, byItem);
    if (q) out.push(q);
  }
  return out;
}

/**
 * Gap-fill: a real sentence with the word missing, its English translation as the cue and the word's dictionary form in
 * brackets; type the form the sentence uses. One question per word (one of its sentences, at random).
 */
export function generateGapQuestions(words: Word[], gaps: Record<string, [number, string, string, number, number][]>, n: number, rng: Rng): Question[] {
  const out: Question[] = [];
  for (const w of shuffle(rng, words.filter((x) => gaps[x.key]?.length))) {
    if (out.length >= n) break;
    const list = gaps[w.key]!;
    const [id, ru, en, start, end] = list[Math.floor(rng() * list.length)]!;
    const before = ru.slice(0, start);
    const after = ru.slice(end);
    out.push({
      key: `vg:${w.key}:${id}`,
      mode: 'vocab',
      headword: en,
      headwordIsEnglish: true,
      gloss: '',
      task: [TERMS.gapTask],
      frame: `${before}___ (${w.accented.split(',')[0]})${after}`,
      answer: ru.slice(start, end).toLowerCase() === ru.slice(start, end) ? ru.slice(start, end) : ru.slice(start, end).toLowerCase(),
      others: [],
      label: TERMS.gapTask.en,
      source: id,
      word: { key: w.key, band: w.band },
      speak: (f) => `${before}${f.replace(/'/g, '')}${after}`,
    });
  }
  return out;
}
