import type { Aspect, Gender } from './cells.ts';

/** Row formats in the generated shards (compact arrays keep the JSON small). */

/** [id, accented infinitive, gloss, aspect, partner infinitives (accented), cells (VERB_CELLS order; "" = absent)] */
export type VerbRow = [number, string, string, Aspect, string[], string[]];

/** [id, accented, gloss, cells (ADJ_CELLS order; "" = not available), extra cells (ADJ_EXTRA order)] */
export type AdjRow = [number, string, string, string[], string[]];

/**
 * [id, accented, gloss, gender ("" = unknown or common gender), animate (0|1), singular only (0|1),
 *  cells (NOUN_CELLS order), counting form after numbers (optional; e.g. челове'к, ле'т)]
 */
export type NounRow = [number, string, string, Gender | '', 0 | 1, 0 | 1, string[], string?];

/** [tatoeba rus id, russian, english, bitmask of cells the token can be, token start, token end] */
export type SentenceRow = [number, string, string, number, number, number];
/** lemma id → sentences */
export type SentenceShard = Record<string, SentenceRow[]>;

export type LexType = 'verbs' | 'adjectives' | 'nouns';
export type ShardType = LexType | 'participles' | 'diminutives';
/** Example-sentence shards: per word type, plus participle/verbal-adverb forms (keyed by verb id). */
export type SentenceType = LexType | 'participles';

export interface Manifest {
  built: string;
  bands: number[]; // upper rank bounds, last = Infinity represented as null in JSON
  /** verbs, adjectives, nouns, participles, diminutives */
  shards: Record<string, { band: number; file: string; count: number }[]>;
  numerals: string;
  pronouns: string;
  government: string;
  prefixedMotion: string;
  ordinals: string;
  collectives: string;
  adverbs: string;
  specialCases: string;
  dates: string;
  collocations: string;
  /** sentence drills: topic → file */
  cloze: Record<string, { file: string; count: number; kinds: Record<string, number> }>;
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

export interface MotionData {
  pairs: MotionPair[];
  verbs: VerbRow[];
  /** verb id → frequency band (to find its example sentences) */
  bands: Record<string, number>;
}

/** Participle kinds: active/passive × present/past. */
export type ParticipleKind = 'act_pres' | 'act_past' | 'pass_pres' | 'pass_past';
/**
 * [verb id, verb accented, gloss, aspect, present verbal adverb cell, past verbal adverb cell,
 *  participles: [kind, nominative masc. cell, full declension cells (ADJ_CELLS order, [] if incomplete),
 *  short forms m/f/n/pl ([] unless passive past)][]]
 */
export type ParticipleRow = [number, string, string, Aspect, string, string, [ParticipleKind, string, string[], string[]][]];
/** [accented numeral, value, cells keyed "case" / "case_gender" / "case_anim" / "case_gender_anim"] */
export type NumeralRow = [string, number, Record<string, string>];
/**
 * Sentence drill item: [tatoeba id, russian, english, blank start, blank end, answer cell,
 *  hint (lemma, accented; "" for multiple choice), kind, options ([] = typed answer)]
 */
export type ClozeRow = [number, string, string, number, number, string, string, string, string[]];

/** [pronoun (accented nominative; "себя" has no nominative), cells by case, cells by case after a preposition] */
export type PersonalRow = [string, string[], string[]];
export interface PronounData {
  personal: PersonalRow[];
  /** [accented, cells in ADJ_CELLS order] — мой, наш, свой, этот, тот, весь, чей, сам */
  possessive: [string, string[]][];
}

/** [noun id, accented, gloss, diminutives cell] */
export type DiminutiveRow = [number, string, string, string];

/** [adjective id, adjective accented, adverb cell, comparative cell ("" if none), adverb gloss, frequency band of the adjective] */
export type AdverbRow = [number, string, string, string, string, number];
/**
 * Nouns with a second prepositional (locative) or partitive form:
 * [noun id, accented, gloss, locative cell, prepositions Wiktionary gives with it (в/на), ordinary prepositional cell,
 *  partitive cell, band]; locative/partitive "" when absent.
 */
export type SpecialCaseRow = [number, string, string, string, string[], string, string, number];

/** Dates and centuries: month genitives, век, and the tens used in compound ordinals (двадцать первое). */
export interface DatesData {
  /** [month accented, genitive singular cell, English] */
  months: [string, string, string][];
  /** век: [accented, nominative cell, prepositional cell] */
  century: [string, string, string];
  /** "20" / "30" → nominative cell of the cardinal (двадцать) */
  tens: Record<string, string>;
}

/** Real pairs from Tatoeba: adjective (bare) → noun ids; verb id → noun ids its participles go with. */
export interface Collocations {
  adj: Record<string, number[]>;
  part: Record<string, number[]>;
}
