import type { Aspect, Case, Gender, VerbGroup } from '../shared/cells.ts';
import type { PairType, ParticipleKind, ParticipleRow, SentenceType, WordPos } from '../shared/types.ts';
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
  | 'diminutives'
  | 'kotoryi'
  | 'chtoby'
  | 'conditional'
  | 'negation'
  | 'indefinite'
  | 'particles'
  | 'pronouns'
  | 'possessives'
  | 'nounCases'
  | 'prepositions'
  | 'aspectContext'
  | 'stress'
  | 'government'
  | 'prefixedMotion'
  | 'position'
  | 'impersonal'
  | 'comparison'
  | 'conjunctions'
  | 'time'
  | 'narechiya'
  | 'questionWords'
  | 'ordinals'
  | 'specialCases'
  | 'alphabet'
  | 'mixed'
  | 'translate'
  | 'vocab'
  | 'build'
  | 'fix'
  | 'listen'
  | 'dictation'
  | 'endings'
  | 'pairs'
  | 'collocations'
  | 'wordOrder';

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
  /** Full forms shown after answering (absent for sentence drills). */
  paradigm?: ParadigmRef;
  /** Multiple choice: the options (the answer cell is one of them). */
  choices?: string[];
  /** Tatoeba sentence id, for sentence drills. */
  source?: number;
  /** Stress drill: the unstressed word and the accepted stressed-vowel positions. */
  stress?: { word: string; positions: number[] };
  /** Shown as the solution instead of the answer cell (stress drill: the accented word). */
  display?: string;
  /** Where to look for an example sentence; only one containing the exact answer form is shown. */
  sentence?: { type: SentenceType; lemmaId: number; cell: number; band: number };
  /**
   * Translate drill: there's no single right answer, so you compare yours with the Tatoeba sentence (`answer`, shown
   * whole) and mark it yourself; only an exact match is marked right automatically.
   */
  selfMark?: boolean;
  /**
   * Error correction: the sentence (with one wrong form) as pieces, words numbered; which word is wrong, its form, and
   * the original sentence.
   */
  fix?: { pieces: { text: string; word?: number }[]; wrong: number; wrongForm: string; original: string };
  /** Build the sentence: the sentence's words, shuffled, to put in order (the answer is the original sentence). */
  build?: string[];
  /** The answer is typed in English (translate Russian → English): no Cyrillic keyboard, English normalisation. */
  answerLang?: 'en';
  /** Vocabulary "choose the meaning": the options and the answer are English meanings, compared exactly. */
  meaning?: true;
  /**
   * Listening: the prompt is a recording, not text: a Tatoeba sentence (`rid`) or a word (`key`). After answering,
   * the sentence's Russian and English (`text`, `en`) are shown.
   */
  listen?: { rid?: number; key?: string; text: string; en?: string };
  /** Dictation: the answer is a whole sentence, compared ignoring case, stress, ё, spacing and punctuation. */
  dictation?: true;
  /** Multiple-choice options in Russian, shown as a list like meanings (listen and choose, minimal pairs). */
  optionsLang?: 'ru';
  /** Vocabulary: the word asked about (for the opt-in word record, src/lib/words.ts). */
  word?: { key: string; band: number };
  /** Text for speech synthesis, built from the first answer variant. */
  speak: (answerForm: string) => string;
}

/** Listen and choose: what you heard (the Russian) and/or what it means (the English). */
export interface ListenSettings {
  tasks: ('meaning' | 'text')[];
}
/** Dictation: short (1–5 words) and/or longer (6–10) recorded sentences. */
export interface DictationSettings {
  lengths: ('short' | 'long')[];
}
/** Minimal pairs: which contrasts. */
export interface PairSettings {
  types: PairType[];
}
/** Mixed review: questions from several topics in one round, each with that topic's own settings. */
export interface MixedSettings {
  topics: Mode[];
}
/** Error correction: sentences from these Grammar test levels. */
export interface FixSettings {
  levels: ('A1' | 'A2' | 'B1' | 'B2' | 'C1')[];
}
/** Build the sentence: short (3–5 words) and/or longer (6–9) sentences. */
export interface BuildSettings {
  lengths: ('short' | 'long')[];
}
/** Vocabulary: which way round, which word types, and where the words come from. */
export interface VocabSettings {
  direction: 'recognise' | 'recall' | 'both';
  types: WordPos[];
  /** common = the commonest words up to the chosen band; mine = your words that are due (opt-in record) */
  source: 'common' | 'mine';
}
/** A word in the vocabulary lists (public/data/words.b*.json). */
export interface Word {
  key: string;
  accented: string;
  gloss: string;
  pos: WordPos;
  /** aspect (verbs) or gender (nouns), "" otherwise */
  extra: string;
  band: number;
}
/** Translate and compare: short (up to 5 words) and/or longer (6–9 words) sentences. */
export interface TranslateSettings {
  lengths: ('short' | 'long')[];
  /** en-ru: English shown, type the Russian; ru-en: Russian shown, type the English; both: either, at random. */
  direction: 'en-ru' | 'ru-en' | 'both';
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
  types: ('alone' | 'withNoun' | 'ordinal' | 'compound' | 'collective')[];
  ranges: ('1-4' | '5-20' | 'tens')[];
  cases: Case[];
}
export interface DiminutiveSettings {
  directions: ('to' | 'from')[];
}
export interface NegationSettings {
  kinds: ('net' | 'nipron' | 'ne-ni')[];
}
export interface ParticleTopicSettings {
  groups: ('li' | 'zhe-ved' | 'ne-ni' | 'colloquial')[];
}
export interface PronounSettings {
  cases: Case[];
  prepositions: ('plain' | 'afterPrep')[];
}
export interface PossessiveSettings {
  types: ('agree' | 'svoy')[];
}
export interface NounCaseSettings {
  cases: Case[];
  number: 'sg' | 'pl' | 'both';
}
export interface StressSettings {
  sources: ('verbs' | 'nouns' | 'adjectives')[];
  forms: 'headword' | 'any';
}
export interface GovernmentSettings {
  types: ('choice' | 'sentence')[];
}
export interface PrefixedMotionSettings {
  types: ('meaning' | 'pair' | 'conjugate')[];
  /** tenses for "conjugate" (present/future and past if absent) */
  groups?: VerbGroup[];
}
/** Sentence drills whose verb can be in any tense: which ones to practise (inf = the infinitive). */
export interface TenseSettings {
  tenses: ('presfut' | 'past' | 'imperative' | 'inf')[];
}
export interface ChtobySettings {
  kinds: ('inf' | 'past')[];
}
export interface NarechiyaSettings {
  types: ('form' | 'comparative' | 'sentence')[];
}
export interface QuestionWordSettings {
  types: ('table' | 'sentence')[];
}
export interface OrdinalSettings {
  types: ('agree' | 'dates' | 'centuries')[];
}
export interface SpecialCaseSettings {
  types: ('form' | 'sentence')[];
}
export interface AlphabetSettings {
  types: ('letters' | 'read' | 'write')[];
}
export interface MotionSettings {
  types: ('meaning' | 'partner' | 'conjugate')[];
  /** tenses for "conjugate" (present/future and past if absent) */
  groups?: VerbGroup[];
}
