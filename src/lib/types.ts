import type { Aspect, Case, Gender, VerbGroup } from '../shared/cells.ts';
import type { LexType, ParticipleKind, ParticipleRow } from '../shared/types.ts';
import type { TaskPart } from './terms.ts';

export type Mode =
  | 'verbs'
  | 'reflexive'
  | 'aspect'
  | 'motion'
  | 'adverbs'
  | 'participles'
  | 'adjectives'
  | 'short'
  | 'compare'
  | 'plurals'
  | 'numbers'
  | 'diminutives';

export interface Verb {
  id: number;
  accented: string;
  gloss: string;
  aspect: Aspect;
  partners: string[];
  cells: string[];
  band: number;
}
export interface Adjective {
  id: number;
  accented: string;
  gloss: string;
  cells: string[];
  /** ADJ_EXTRA order: short m/f/n/pl, comparative, superlative ("" = absent). */
  extra: string[];
  band: number;
}
export interface Noun {
  id: number;
  accented: string;
  gloss: string;
  gender: Gender | '';
  animate: boolean;
  sgOnly: boolean;
  cells: string[];
  /** Form after numbers 5+ / сколько / несколько when it differs from gen. pl. (челове'к). */
  counting?: string;
  band: number;
}

/** Which word's paradigm to show after answering. */
export type ParadigmRef =
  | { kind: 'verb'; verb: Verb }
  | { kind: 'adjective'; adjective: Adjective }
  | { kind: 'noun'; noun: Noun }
  | { kind: 'participles'; row: ParticipleRow }
  /** Simple list of labelled forms (numerals, diminutives). */
  | { kind: 'list'; rows: { label: TaskPart[]; cell: string }[] };

export interface Question {
  /** Unique within a round (used to avoid duplicates). */
  key: string;
  mode: Mode;
  /** Headword (accented source notation). */
  headword: string;
  /** True when the headword is an English meaning (motion "name the verb" questions). */
  headwordIsEnglish?: boolean;
  gloss: string;
  /** Task line: grammar terms (English + Russian) and Russian words, e.g. [Past/прошедшее время, она]. */
  task: TaskPart[];
  /** The frame the answer goes into, with ___ as the slot, e.g. "она ___" or "___ кни'гу". */
  frame?: string;
  /** Secondary line, e.g. the noun's gloss. */
  note?: string;
  /** Canonical answer cell (comma-separated variants; any variant is correct). */
  answer: string;
  /** Other forms of the same word, for "what you typed is the … form". */
  others: { label: string; cell: string }[];
  /** Rule shown after answering (e.g. why 2–4 take genitive singular). */
  explain?: string;
  /** Label of the target form, for the end screen. */
  label: string;
  paradigm: ParadigmRef;
  sentence?: { type: LexType; lemmaId: number; cell: number; band: number };
  /** Text for speech synthesis, built from the first answer variant. */
  speak: (answerForm: string) => string;
}

export interface VerbSettings {
  groups: VerbGroup[];
}
export interface AspectSettings {
  direction: 'to-pf' | 'to-impf' | 'both';
}
export interface AdjSettings {
  cases: Case[];
  number: 'sg' | 'pl' | 'both';
}
export interface CompareSettings {
  types: ('comparative' | 'superlative' | 'samyi')[];
}
export interface PluralSettings {
  contexts: ('nom' | 'cases' | 'numbers' | 'quantity')[];
  cases: Case[];
}
export interface AdverbSettings {
  aspects: ('impf' | 'pf')[];
}
export interface ParticipleSettings {
  kinds: ParticipleKind[];
  types: ('form' | 'short' | 'decline')[];
}
export interface NumberSettings {
  types: ('alone' | 'withNoun')[];
  ranges: ('1-4' | '5-20' | 'tens')[];
  cases: Case[];
}
export interface DiminutiveSettings {
  directions: ('to' | 'from')[];
}
export interface MotionSettings {
  types: ('meaning' | 'partner' | 'conjugate')[];
}
