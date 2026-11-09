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

/** Vocabulary: n = noun, v = verb, a = adjective, o = other word (preposition, adverb, conjunction, pronoun…). */
export type WordPos = 'n' | 'v' | 'a' | 'o';
/**
 * words.b{0..3}.json: [key ("n:<id>", "v:<id>", "a:<id>", "o:<word>"), accented headword, English meaning, word type,
 * aspect (verbs) or gender (nouns), "" otherwise]
 */
export type WordRow = [string, string, string, WordPos, string];

export type LexType = 'verbs' | 'adjectives' | 'nouns';
export type ShardType = LexType | 'participles' | 'diminutives' | 'words';
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
  /** level test question pool */
  levelTest: string;
  learn: string;
  reading: string;
  /** the Vocabulary section's index (theme.<id>.json per theme) */
  themes: string;
  audio: string;
  listening: string;
  verbNoun: string;
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

/**
 * A level test candidate: [key, Russian sentence, English translation, gap start, gap end, word in brackets ("" if
 * none), right option, wrong options (closest to the right one first), answer cell ("" = the right option), sentence
 * drill kind ("" if none), code of the right option's form, codes of the wrong options, frequency rank of the word
 * (-1 if none)]. Codes are explained in src/lib/levelTestPool.ts.
 */
export type LevelTestCandidate = [string, string, string, number, number, string, string, string[], string, string, string, string[], number];
/**
 * public/data/learn.json: what Learn pages quote, by block. `sentences`: Tatoeba id → [Russian, English] for
 * `::tatoeba`; `ipa`: word → [headword with stress, IPA from Wiktionary] for `::ipa`.
 */
export interface LearnExtras {
  sentences: Record<string, [string, string]>;
  ipa: Record<string, [string, string]>;
}

/** public/data/level-test.json: candidates for each question type, by level (built by src/lib/levelTestPool.ts). */
export interface LevelTestData {
  slots: { level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'; w: 1 | 2 | 3; topic: string; ask: string; items: LevelTestCandidate[] }[];
}

/** A line of a reading text: [speaker ('' for narration), text, 1 for a stage direction]. */
export type ReadingLine = [string, string, 0 | 1];
/**
 * What a word in a reading text can be: [dictionary form (stress marked), English meaning, which form ("" if none),
 * flags: o = old-fashioned (Wiktionary has it only as archaic, obsolete or dated), s = with the old polite -с, n = a name,
 * and, when the word is in the vocabulary lists, its key and band (so it can be added to your words)].
 */
export type WordReading = [string, string, string, string] | [string, string, string, string, string, number];
export interface ReadingQuestion {
  q: string;
  options: string[];
}
/** public/data/reading.<id>.json: one story or scene, every word explained, with its comprehension questions. */
export interface ReadingUnit {
  id: string;
  /** index into ReadingIndex.works */
  w: number;
  title: string;
  genre: string;
  lines: ReadingLine[];
  /** normalised word → its readings */
  words: Record<string, WordReading[]>;
  /**
   * Key words: words of the text outside the 1,000 commonest of their type, in order of first appearance (at most
   * KEY_WORDS_MAX): [word key, band, dictionary form, meaning].
   */
  keyWords: [string, number, string, string][];
  /** options in the same order in both languages; `answer` is the right one's index */
  questions: { answer: number; en: ReadingQuestion; ru: ReadingQuestion; kind?: ReadingQuestionKind }[];
  /** a collection's page: the exact revision used, the article's date, the story's own level and year */
  source?: string;
  date?: string;
  level?: [string, string];
  year?: number;
}
/**
 * What a question asks: what happens (the default), what you can infer that the text doesn't say (`inference`), or
 * the writer's or a character's attitude and tone (`tone`). B2 and C1 texts have both of the last two.
 */
export type ReadingQuestionKind = 'inference' | 'tone';
/** public/data/reading.json: the works and the published texts. */
export interface ReadingIndex {
  works: { id: string; author: string; authorEn: string; title: string; titleEn: string; year: number; kind: 'stories' | 'play' | 'pages'; level: [string, string]; site: 'wikisource' | 'wikinews'; source: string }[];
  units: { id: string; w: number; title: string; genre: string; words: number; questions: number; date?: string; level?: [string, string] }[];
}

/** A word in a Words-section theme: [word-list key, accented, meaning, word type, aspect or gender, band]. */
export type ThemeWord = [string, string, string, WordPos, string, number];
/** public/data/theme.<id>.json: one theme of the Vocabulary section. */
export interface ThemeData {
  id: string;
  title: string;
  ru: string;
  level: string;
  blurb: string;
  groups: { title: string; words: ThemeWord[] }[];
  /** word key → a real Tatoeba sentence using it: [Tatoeba id, Russian, English, word start, word end] */
  uses: Record<string, [number, string, string, number, number]>;
  /** word key → up to 3 real sentences using it, for the gap-fill practice (same shape as `uses`) */
  gaps: Record<string, [number, string, string, number, number][]>;
  /** our own dialogues, published only once a native speaker has reviewed them ("<who>, YYYY-MM-DD") */
  dialogues: { title: string; reviewed: string; lines: ReadingLine[]; en: string[] }[];
  /** the dialogues' words, explained as in Reading */
  words: Record<string, WordReading[]>;
  /** dialogues written but not yet reviewed (not published) */
  drafts: number;
}
/**
 * public/data/audio.json: the native recordings the site hosts (public/audio/), each credited.
 * credits: [name, licence, link (the person's or project's page, or the file's), source, the licence's address].
 */
export interface AudioIndex {
  credits: [string, string, string, 'commons' | 'tatoeba', string][];
  /** word list key → [file name in audio/w/ without .mp3, credit index] */
  words: Record<string, [string, number]>;
  /** Tatoeba sentence id → credit index (the file is audio/s/<id>.mp3) */
  sentences: Record<string, number>;
}
/** public/data/verb-noun.json: words that go together (curated/collocations.yaml) and the "Which verb?" items. */
export interface CollocationData {
  /** noun [word key, accented]; verbs [[key, accented]] (imperfective, perfective); our English; the noun's case */
  /** phrase: the pair as it's said, stress marked (приня'ть реше'ние, обрати'ть внима'ние на) */
  pairs: { phrase: string; noun: [string, string]; verbs: [string, string][]; en: string; case: 'acc' | 'gen'; pl?: true; prep?: string; sentences: number }[];
  /** [pair index, Tatoeba id, Russian, English, verb start, verb end, options (the sentence's verb among them)] */
  items: [number, number, string, string, number, number, string[]][];
}
export type PairType = 'soft' | 'yi' | 'shsch';
/** public/data/listening.json: listening drills, from the published recordings only. */
export interface ListeningData {
  /** recorded sentences: [Tatoeba id, Russian, English] */
  sentences: [number, string, string][];
  /** which ending did you hear: [Tatoeba id, word start, word end, options (the sentence's word among them)] */
  endings: [number, number, number, string[]][];
  /** minimal pairs: [type, key, word (stress marked), key, word] */
  pairs: [PairType, string, string, string, string][];
}
/** public/data/themes.json: the Vocabulary section's themes, in order. */
export interface ThemeIndex {
  /** keys: the theme's word keys (for learning paths: is the theme in your words?) */
  themes: { id: string; title: string; ru: string; level: string; blurb: string; words: number; dialogues: number; keys: string[] }[];
}
