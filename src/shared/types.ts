import type { Aspect, Gender } from './cells.ts';

/** Row formats in the generated shards (compact arrays keep the JSON small). */

/** [id, accented infinitive, gloss, aspect, partner infinitives (accented), cells (VERB_CELLS order; "" = absent)] */
export type VerbRow = [number, string, string, Aspect, string[], string[]];

/** [id, accented, gloss, cells (ADJ_CELLS order; "" = not available)] */
export type AdjRow = [number, string, string, string[]];

/** [id, accented, gloss, gender, animate (0|1), number restriction (0 both, 1 sg only), cells (NOUN_CELLS order)] */
export type NounRow = [number, string, string, Gender, 0 | 1, 0 | 1, string[]];

/** [tatoeba rus id, russian, english, cell index, token start, token end] */
export type SentenceRow = [number, string, string, number, number, number];
/** lemma id → sentences */
export type SentenceShard = Record<string, SentenceRow[]>;

export type LexType = 'verbs' | 'adjectives' | 'nouns';

export interface Manifest {
  built: string;
  bands: number[]; // upper rank bounds, last = Infinity represented as null in JSON
  shards: Record<LexType, { band: number; file: string; count: number }[]>;
  sentences: Record<string, { band: number; file: string; lemmas: number; sentences: number }[]>;
  motion: string;
  sources: Record<string, { url: string; sha256: string; fetched: string }>;
}

export interface MotionPair {
  meaning: string; // English, e.g. "go (on foot)"
  uni: string; // accented unidirectional infinitive
  multi: string;
  uniId: number; // verb ids in the verb shards
  multiId: number;
}
