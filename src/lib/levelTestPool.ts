/**
 * Level test question pool, built by the data pipeline (`npm run data:build` → public/data/level-test.json).
 *
 * Every question is a real sentence (Tatoeba) with one gap, a plain instruction, and the English translation as a
 * cue. No grammar terms are shown: the sentence itself has to tell you which form is needed.
 *
 * Three sources, all from the data (nothing is invented):
 *  - form: a word's own example sentences (the drills' sentence files), the word in brackets, and other real forms of
 *    that word as wrong options ("Я давно не видел ___ (брат)" → брата / брату / братом / брат);
 *  - gap: the sentence drills with a word in brackets (prepositions, government, чтобы, который …), same idea;
 *  - choice: the multiple-choice sentence drills (aspect, conjunctions, question words …), with their own options.
 * Forms that would also fit a gap — the same spelling in another case, or a case the preposition could also take —
 * are never offered as wrong options. Every question has exactly one right option.
 *
 * Building this in the browser meant downloading several MB of shards before the test could start, so the pipeline
 * makes up to PER_SLOT candidates for each question type here, and the app (levelTest.ts) draws 60 of them at random.
 * The level of each question type is our judgement (CEFR-style).
 */
import { ADJ_EXTRA_CELL_OFFSET, ADJ_INDEX, CASES } from '../shared/cells.ts';
import { cellForms, displayForms } from '../shared/forms.ts';
import { normalise } from '../shared/normalise.ts';
import type { AdjRow, ClozeRow, LevelTestCandidate, LevelTestData, Manifest, NounRow, ParticipleKind, ParticipleRow, PronounData, SentenceRow, SentenceShard, VerbRow } from '../shared/types.ts';
import { checkAnswer } from './check.ts';
import { clozeQuestion, type ClozeTopic } from './questions/cloze.ts';
import { mulberry32, pick, shuffle, type Rng } from './rng.ts';
import type { Mode, Question } from './types.ts';

export const TEST_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type TestLevel = (typeof TEST_LEVELS)[number];
/** Candidates kept per question type. A test uses at most one or two per type, so tests rarely share a question. */
export const PER_SLOT = 30;
/** Wrong options kept per candidate, closest first; the app shows three or four of them. */
const MAX_WRONG = 6;

// ---------------------------------------------------------------- instructions (no grammar terms)

export const ASK = {
  form: 'Choose the right form of the word in brackets to complete the sentence.',
  pronoun: 'Choose the right form of the pronoun in brackets to complete the sentence.',
  verb: 'Choose the right form of the verb in brackets to complete the sentence.',
  aspect: 'Choose the verb that fits the sentence.',
  position: 'Choose the verb that fits the sentence.',
  conjunction: 'Choose the word that links the two parts of the sentence.',
  question: 'Choose the question word that completes the question.',
  adverbOrAdjective: 'Choose the word that fits the sentence.',
  svoy: 'Choose the word for “his”, “her”, “its” or “their” that fits the sentence.',
  neNi: 'Choose не or ни to complete the sentence.',
  particle: 'Choose the small word that completes the question.',
} as const;

// ---------------------------------------------------------------- slots

interface Base {
  level: TestLevel;
  /** 1 = easier … 3 = harder, within the level (questions are ordered by this) */
  w: 1 | 2 | 3;
  /** the Learn page to recommend if missed */
  learn: Mode;
  ask: string;
  /** frequency rank of the word: only ranks below maxRank / at or above minRank (0 = most common) */
  maxRank?: number;
  minRank?: number;
}
/** A word's own example sentence: the gap is one of `cells` (indices into the word's table; adjectives' extra
 *  forms from ADJ_EXTRA_CELL_OFFSET). `adverb` = a verbal adverb from the participle sentences. */
export interface FormSlot extends Base {
  kind: 'form';
  type: 'nouns' | 'verbs' | 'adjectives' | 'adverb';
  cells: number[];
}
/** A sentence drill with the word in brackets. */
export interface GapSlot extends Base {
  kind: 'gap';
  topic: ClozeTopic;
  kinds?: string[];
}
/** A multiple-choice sentence drill. */
export interface ChoiceSlot extends Base {
  kind: 'choice';
  topic: ClozeTopic;
  kinds?: string[];
}
/** A participle in its own sentence (the verb in brackets): the options are other forms of the same participle. */
export interface ParticipleSlot extends Base {
  kind: 'participle';
  pkinds: ParticipleKind[];
}
export type Slot = FormSlot | GapSlot | ChoiceSlot | ParticipleSlot;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const adj = (...keys: (keyof typeof ADJ_INDEX)[]) => keys.map((k) => ADJ_INDEX[k]);
const SG = { nom: 0, gen: 1, dat: 2, acc: 3, inst: 4, prep: 5 } as const;
const PL = { nom: 6, gen: 7, dat: 8, acc: 9, inst: 10, prep: 11 } as const;
const PRESFUT = range(0, 5);
const PAST = range(6, 9);
const IMPERATIVE = [10, 11];
const SHORT = range(ADJ_EXTRA_CELL_OFFSET, ADJ_EXTRA_CELL_OFFSET + 3);
const COMPARATIVE = [ADJ_EXTRA_CELL_OFFSET + 4];
const ADJ_NOM = adj('m_nom', 'f_nom', 'n_nom', 'pl_nom');
const ADJ_SG_OBLIQUE = adj('m_gen', 'f_gen', 'n_gen', 'm_dat', 'f_dat', 'm_acc', 'm_acc_anim', 'f_acc', 'm_inst', 'f_inst', 'm_prep', 'f_prep');
const ADJ_PL_OBLIQUE = adj('pl_gen', 'pl_dat', 'pl_inst', 'pl_prep');

const form = (level: TestLevel, w: Base['w'], type: FormSlot['type'], cells: number[], learn: Mode, extra: Partial<FormSlot> = {}): FormSlot => ({
  kind: 'form', level, w, type, cells, learn, ask: type === 'verbs' || type === 'adverb' ? ASK.verb : ASK.form, ...extra,
});
const gap = (level: TestLevel, w: Base['w'], topic: ClozeTopic, learn: Mode, kinds?: string[], extra: Partial<GapSlot> = {}): GapSlot => ({
  kind: 'gap', level, w, topic, learn, kinds, ask: ASK.form, ...extra,
});
const participle = (level: TestLevel, w: Base['w'], pkinds: ParticipleKind[], extra: Partial<ParticipleSlot> = {}): ParticipleSlot => ({
  kind: 'participle', level, w, pkinds, learn: 'participles', ask: ASK.verb, ...extra,
});
const choice = (level: TestLevel, w: Base['w'], topic: ClozeTopic, learn: Mode, ask: string, kinds?: string[]): ChoiceSlot => ({
  kind: 'choice', level, w, topic, learn, ask, kinds,
});

/**
 * The pools. Left out on purpose, because in real sentences two options can both be right: indefinite pronouns
 * (-то / -нибудь), же / ведь, and the colloquial particles (вот, ну, даже, только). Superlatives are left out
 * because no sentence can be tied to one word: the common ones (лучший, старший) are dictionary words of their own
 * and the rest (новейший) don't occur in the sentences.
 */
export const POOLS: Record<TestLevel, Slot[]> = {
  A1: [
    form('A1', 1, 'verbs', PRESFUT, 'verbs', { maxRank: 150 }),
    form('A1', 1, 'nouns', [SG.prep], 'nounCases', { maxRank: 300 }),
    form('A1', 1, 'adjectives', ADJ_NOM, 'adjectives', { maxRank: 300 }),
    form('A1', 2, 'nouns', [SG.acc], 'nounCases', { maxRank: 300 }),
    form('A1', 2, 'verbs', PAST, 'verbs', { maxRank: 150 }),
    form('A1', 2, 'nouns', [PL.nom], 'plurals', { maxRank: 300 }),
    gap('A1', 2, 'impersonal', 'pronouns', ['imp-pron'], { ask: ASK.pronoun }),
    gap('A1', 3, 'prepositions', 'prepositions', ['в:prep', 'на:prep'], { maxRank: 300 }),
    gap('A1', 3, 'prepositions', 'prepositions', ['в:acc', 'на:acc'], { maxRank: 300 }),
    choice('A1', 3, 'questionWords', 'questionWords', ASK.question, ['kto', 'chto', 'kakoy']),
    form('A1', 2, 'verbs', PRESFUT, 'verbs', { minRank: 150, maxRank: 300 }),
    form('A1', 3, 'nouns', [SG.gen], 'nounCases', { maxRank: 200 }),
    form('A1', 2, 'adjectives', adj('m_acc', 'f_acc', 'm_prep', 'f_prep'), 'adjectives', { maxRank: 150 }),
    form('A1', 3, 'nouns', [PL.nom], 'plurals', { maxRank: 600 }),
    gap('A1', 3, 'time', 'time', ['v-day', 'v-month']),
    choice('A1', 3, 'narechiya', 'narechiya', ASK.adverbOrAdjective),
    choice('A1', 3, 'conjunctions', 'conjunctions', ASK.conjunction, ['conj:что', 'conj:когда', 'conj:если']),
  ],
  A2: [
    form('A2', 1, 'nouns', [SG.gen], 'nounCases', { maxRank: 1000 }),
    form('A2', 2, 'nouns', [SG.dat, SG.inst], 'nounCases', { maxRank: 1000 }),
    form('A2', 2, 'adjectives', ADJ_SG_OBLIQUE, 'adjectives', { maxRank: 1000 }),
    form('A2', 2, 'verbs', IMPERATIVE, 'verbs', { maxRank: 500 }),
    form('A2', 2, 'adjectives', COMPARATIVE, 'compare', { maxRank: 1000 }),
    gap('A2', 2, 'impersonal', 'pronouns', ['imp-pron'], { ask: ASK.pronoun }),
    gap('A2', 3, 'time', 'time', ['v-day', 'v-month', 'cherez', 'nazad']),
    gap('A2', 3, 'negation', 'negation', ['net'], { maxRank: 1000 }),
    gap('A2', 3, 'prepositions', 'prepositions', ['у:gen', 'из:gen', 'для:gen', 'без:gen', 'к:dat', 'по:dat', 'с:inst', 'о:prep'], { maxRank: 1000 }),
    choice('A2', 2, 'conjunctions', 'conjunctions', ASK.conjunction),
    choice('A2', 2, 'narechiya', 'narechiya', ASK.adverbOrAdjective),
    choice('A2', 3, 'negation', 'negation', ASK.neNi, ['ne-ni']),
    choice('A2', 3, 'questionWords', 'questionWords', ASK.question, ['kto-prep', 'chto-prep', 'kakoy-prep']),
    form('A2', 3, 'verbs', PAST, 'verbs', { minRank: 150, maxRank: 1000 }),
  ],
  B1: [
    form('B1', 1, 'adjectives', SHORT, 'short', { maxRank: 1000 }),
    form('B1', 1, 'verbs', [...PRESFUT, ...PAST], 'verbs', { minRank: 300, maxRank: 1500 }),
    form('B1', 2, 'nouns', [PL.gen, PL.dat, PL.inst, PL.prep], 'plurals', { maxRank: 1000 }),
    form('B1', 2, 'adjectives', ADJ_PL_OBLIQUE, 'adjectives', { maxRank: 1000 }),
    choice('B1', 2, 'aspectContext', 'aspectContext', ASK.aspect, ['impf@past', 'pf@past']),
    choice('B1', 3, 'aspectContext', 'aspectContext', ASK.aspect, ['impf@presfut', 'pf@presfut']),
    choice('B1', 2, 'position', 'position', ASK.position, ['sit:state', 'lie:state', 'stand:state']),
    choice('B1', 2, 'svoy', 'possessives', ASK.svoy),
    gap('B1', 2, 'conditional', 'conditional', undefined, { ask: ASK.verb }),
    gap('B1', 2, 'impersonal', 'impersonal', ['imp-noun']),
    gap('B1', 3, 'kotoryi', 'kotoryi'),
    gap('B1', 3, 'chtoby', 'chtoby', ['inf'], { ask: ASK.verb }),
    gap('B1', 3, 'comparison', 'comparison', undefined, { maxRank: 1000 }),
    gap('B1', 3, 'government', 'government', undefined, { maxRank: 500 }),
    gap('B1', 3, 'prepositions', 'prepositions', ['за:inst', 'под:inst', 'перед:inst', 'над:inst', 'между:inst', 'при:prep'], { maxRank: 1000 }),
  ],
  // B2 and C1 test grammar that only advanced learners control (participles, verbal adverbs, aspect in the
  // imperative and infinitive, verbs of position, the rarer cases after verbs and prepositions), with rarer words.
  B2: [
    form('B2', 1, 'verbs', [...PAST, ...IMPERATIVE], 'verbs', { minRank: 1000 }),
    form('B2', 1, 'nouns', [SG.gen, SG.dat, SG.inst, SG.prep, PL.gen, PL.dat, PL.inst, PL.prep], 'nounCases', { minRank: 1000 }),
    form('B2', 2, 'adjectives', [...ADJ_SG_OBLIQUE, ...ADJ_PL_OBLIQUE], 'adjectives', { minRank: 1000 }),
    form('B2', 2, 'adverb', [0, 1], 'adverbs', { maxRank: 1000 }),
    choice('B2', 2, 'particles', 'particles', ASK.particle, ['li']),
    gap('B2', 2, 'government', 'government', undefined, { minRank: 500 }),
    gap('B2', 2, 'chtoby', 'chtoby', ['past'], { ask: ASK.verb }),
    gap('B2', 2, 'comparison', 'comparison', undefined, { minRank: 1000 }),
    gap('B2', 3, 'negation', 'negation', ['net'], { minRank: 1000 }),
    gap('B2', 3, 'specialCases', 'specialCases', ['loc']),
    gap('B2', 3, 'prepositions', 'prepositions', undefined, { minRank: 1000 }),
    choice('B2', 3, 'aspectContext', 'aspectContext', ASK.aspect, ['impf@past', 'pf@past', 'impf@presfut', 'pf@presfut']),
    choice('B2', 3, 'position', 'position', ASK.position),
    participle('B2', 3, ['act_pres', 'act_past'], { maxRank: 1000 }),
    gap('B2', 3, 'time', 'time', ['po-days', 'nazad']),
  ],
  C1: [
    // Only grammar that advanced learners control: no familiar grammar on rare words (для туристов is B1 grammar).
    form('C1', 1, 'verbs', range(0, 11), 'verbs', { minRank: 1500 }),
    form('C1', 1, 'adverb', [0, 1], 'adverbs', { minRank: 1000 }),
    form('C1', 2, 'adjectives', SHORT, 'short', { minRank: 1000 }),
    form('C1', 2, 'nouns', [PL.gen], 'plurals', { minRank: 1000 }),
    participle('C1', 2, ['act_pres', 'act_past'], { minRank: 1000 }),
    participle('C1', 3, ['pass_pres', 'pass_past']),
    gap('C1', 2, 'chtoby', 'chtoby', ['past'], { ask: ASK.verb, minRank: 1000 }),
    gap('C1', 3, 'government', 'government', undefined, { minRank: 1000 }),
    gap('C1', 3, 'government', 'government', undefined, { minRank: 1500 }),
    gap('C1', 3, 'specialCases', 'specialCases', ['loc'], { minRank: 1000 }),
    choice('C1', 3, 'aspectContext', 'aspectContext', ASK.aspect, ['impf@imperative', 'pf@imperative']),
    // Not aspect after an infinitive-taking word (трудно заставить / заставлять): there both are often acceptable.
    choice('C1', 3, 'aspectContext', 'aspectContext', ASK.aspect, ['impf@presfut', 'pf@presfut']),
    choice('C1', 2, 'position', 'position', ASK.position),
    choice('C1', 3, 'position', 'position', ASK.position, ['sit:put', 'lie:put', 'stand:put', 'hang:put', 'sit:get', 'lie:get', 'stand:get']),
  ],
};
// ---------------------------------------------------------------- the data (read from public/data at build time)

/** Reads a file from public/data (the pipeline and the unit tests read from disk). */
export type ReadJson = <T>(file: string) => T;

interface Entry {
  type: 'noun' | 'verb' | 'adj' | 'pron';
  id: number;
  accented: string;
  /** main table; adjectives also get their extra forms appended from ADJ_EXTRA_CELL_OFFSET */
  cells: string[];
  rank: number;
  band: number;
}
export interface Lexicon {
  byAccented: Map<string, Entry>;
  byId: { nouns: Map<number, Entry>; verbs: Map<number, Entry>; adjectives: Map<number, Entry> };
  participles: Map<number, ParticipleRow>;
}

/** The words of frequency bands 0–2 (top 2,500), with their frequency rank. */
export function loadLexicon(read: ReadJson): Lexicon {
  const m = read<Manifest>('manifest.json');
  const rows = <R>(type: string) => (m.shards[type] ?? []).filter((s) => s.band <= 2).flatMap((s) => read<R[]>(s.file).map((row) => ({ row, band: s.band })));
  const byAccented = new Map<string, Entry>();
  const byId: Lexicon['byId'] = { nouns: new Map(), verbs: new Map(), adjectives: new Map() };
  const add = (map: Map<number, Entry>, e: Entry) => {
    map.set(e.id, e);
    if (!byAccented.has(e.accented)) byAccented.set(e.accented, e);
  };
  // Shards are in frequency order, band by band, so the index is the frequency rank.
  rows<NounRow>('nouns').forEach(({ row, band }, i) => add(byId.nouns, { type: 'noun', id: row[0], accented: row[1], cells: row[6], rank: i, band }));
  rows<VerbRow>('verbs').forEach(({ row, band }, i) => add(byId.verbs, { type: 'verb', id: row[0], accented: row[1], cells: row[5], rank: i, band }));
  rows<AdjRow>('adjectives').forEach(({ row, band }, i) => add(byId.adjectives, { type: 'adj', id: row[0], accented: row[1], cells: [...row[3], ...row[4]], rank: i, band }));
  for (const [who, cells] of read<PronounData>(m.pronouns).personal) if (who) byAccented.set(who, { type: 'pron', id: -1, accented: who, cells, rank: 0, band: 0 });
  const participles = new Map(rows<ParticipleRow>('participles').map(({ row }) => [row[0], row]));
  return { byAccented, byId, participles };
}

/**
 * Codes naming which form an option is, so the results page can explain it ("genitive plural"): n<cell> noun,
 * c<case> pronoun, v<cell> verb, inf infinitive, a<cell> adjective (extra forms from ADJ_EXTRA_CELL_OFFSET),
 * p:<kind>:<cell> participle, adv verbal adverb, loc second prepositional (в лесу). A spelling that is several cells
 * (новой) has all their codes, joined with "+". "" = no label (the options are different words).
 */
const code = (e: Entry, cell: number) => (e.type === 'noun' ? `n${cell}` : e.type === 'pron' ? `c${cell % 6}` : e.type === 'verb' ? `v${cell}` : `a${cell}`);

type Opt = { f: string; code: string };
/** First displayed form of each cell, skipping any that equal an excluded form or each other. */
function distinctForms(cells: Opt[], exclude: Set<string>): Opt[] {
  const out = new Map<string, Opt>();
  for (const { f: c, code } of cells) {
    const f = displayForms(c)[0];
    if (!f || exclude.has(normalise(f))) continue;
    const had = out.get(normalise(f));
    // A spelling shared by several cells is all of them (новой: genitive, dative, instrumental, prepositional).
    if (had) had.code = had.code && code ? `${had.code}+${code}` : had.code;
    else out.set(normalise(f), { f, code });
  }
  return [...out.values()];
}
/** Codes of every cell spelt like `form` (only cells in `among`, if given), joined with "+". */
function codesFor(e: Entry, form: string, among?: number[]): string {
  const n = normalise(form);
  return e.cells
    .map((c, i) => i)
    .filter((i) => (!among || among.includes(i)) && cellForms(e.cells[i] ?? '').some((f) => normalise(f) === n))
    .map((i) => code(e, i))
    .join('+');
}
const sameNumber = (e: Entry, cell: number) => (e.type === 'noun' ? range(cell >= 6 ? 6 : 0, cell >= 6 ? 11 : 5) : e.type === 'adj' && cell < ADJ_EXTRA_CELL_OFFSET ? range(0, ADJ_EXTRA_CELL_OFFSET - 1) : [cell]);
const cellsOf = (e: Entry, idx: number[]): Opt[] => idx.map((i) => ({ f: e.cells[i] ?? '', code: code(e, i) }));
const formsOf = (cells: (string | undefined)[]) => new Set(cells.flatMap((c) => cellForms(c ?? '')).map(normalise));
/** The variant of a cell that the sentence actually uses (keeps the source stress). */
const usedForm = (cell: string, token: string) => cellForms(cell).find((f) => normalise(f) === normalise(token)) ?? displayForms(cell)[0] ?? token;

/** Edit distance between two forms (stress and ё ignored): the closest wrong forms are the hardest to rule out. */
function distance(a: string, b: string): number {
  const x = normalise(a);
  const y = normalise(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length]!;
}

interface Made {
  key: string;
  ru: string;
  en: string;
  start: number;
  end: number;
  hint: string;
  right: Opt;
  wrong: Opt[];
  answer?: string;
  kind?: string;
  rank?: number;
}
/** A candidate, its wrong options closest to the right one first (the app shows the closest at B1 and above). */
function candidate(m: Made, rng: Rng): LevelTestCandidate {
  const wrong = shuffle(rng, m.wrong)
    .map((o, i) => ({ o, d: distance(o.f, m.right.f), i }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, MAX_WRONG)
    .map(({ o }) => o);
  return [m.key, m.ru, m.en, m.start, m.end, m.hint, m.right.f, wrong.map((o) => o.f), m.answer !== undefined && m.answer !== m.right.f ? m.answer : '', m.kind ?? '', m.right.code, wrong.map((o) => o.code), m.rank ?? -1];
}

// ---------------------------------------------------------------- form questions (a word's own sentences)

const NOUN_CASE = (i: number) => CASES[i % 6]!;

/** Wrong options for a word's form, all real forms of the same word, none that could also be right. */
function wrongForms(e: Entry, bit: number, rowMask: number): Opt[] {
  const alsoRight = formsOf(e.cells.filter((_, i) => rowMask & (1 << i)));
  alsoRight.add(normalise(displayForms(e.cells[bit] ?? '')[0] ?? ''));
  let pool: Opt[];
  if (e.type === 'noun') {
    const plural = bit >= 6;
    pool = cellsOf(e, range(plural ? 6 : 0, plural ? 11 : 5).filter((i) => i !== bit));
  } else if (e.type === 'verb') {
    // Present/future: the other persons. Past: present forms and the infinitive (not the other genders: я/ты/вы could
    // be either). Imperative: present forms, infinitive and past (not the other imperative: скажи / скажите).
    const inf = { f: e.accented, code: 'inf' };
    if (bit <= 5) pool = cellsOf(e, PRESFUT);
    else if (bit <= 9) pool = [...cellsOf(e, PRESFUT), inf];
    else pool = [...cellsOf(e, PRESFUT), inf, ...cellsOf(e, [6])];
  } else {
    if (bit < ADJ_EXTRA_CELL_OFFSET) pool = cellsOf(e, range(0, ADJ_EXTRA_CELL_OFFSET - 1));
    // Short forms: the other short forms only — a long form is often also right as a predicate (она жирная).
    else if (bit < ADJ_EXTRA_CELL_OFFSET + 4) pool = cellsOf(e, SHORT);
    else pool = cellsOf(e, [...ADJ_NOM, ADJ_EXTRA_CELL_OFFSET + 4, ADJ_EXTRA_CELL_OFFSET + 5]);
  }
  return distinctForms(pool, alsoRight);
}

interface Ctx {
  read: ReadJson;
  lex: Lexicon;
  shards: Map<string, SentenceShard>;
  cloze: Map<string, ClozeRow[]>;
  rng: Rng;
}
function shard(ctx: Ctx, type: 'nouns' | 'verbs' | 'adjectives' | 'participles', band: number): SentenceShard {
  const k = `${type}:${band}`;
  let s = ctx.shards.get(k);
  if (!s) {
    const file = ctx.read<Manifest>('manifest.json').sentences[type]?.find((x) => x.band === band)?.file;
    s = file ? ctx.read<SentenceShard>(file) : {};
    ctx.shards.set(k, s);
  }
  return s;
}
const inRank = (slot: Slot, rank: number) => (slot.maxRank === undefined || rank < slot.maxRank) && (slot.minRank === undefined || rank >= slot.minRank);
/** An adjective or participle ending the sentence is a predicate (Я богатый / богатая): with я, ты or вы its gender
 *  depends on who is speaking, so two options could both be right. */
const endsSentence = (ru: string, end: number) => /^[\s.,!?…»"]*$/.test(ru.slice(end));

function formSlotCandidate(slot: FormSlot, ctx: Ctx, keys: Set<string>): LevelTestCandidate | null {
  const { lex, rng } = ctx;
  if (slot.type === 'adverb') return adverbCandidate(slot, ctx, keys);
  const map = lex.byId[slot.type];
  const lemmas = [...map.values()].filter((e) => inRank(slot, e.rank));
  const want = slot.cells.reduce((m, c) => m | (1 << c), 0);
  for (let tries = 0; tries < 80 && lemmas.length; tries++) {
    const e = pick(rng, lemmas);
    const rows = (shard(ctx, slot.type, e.band)[e.id] ?? []).filter((r: SentenceRow) => r[3] & want);
    if (!rows.length) continue;
    const row = pick(rng, rows);
    const key = `lt:${slot.type}:${row[0]}:${row[4]}`;
    if (keys.has(key)) continue;
    const bits = slot.cells.filter((c) => row[3] & (1 << c));
    const bit = pick(rng, bits);
    const token = row[1].slice(row[4], row[5]);
    if (slot.type === 'adjectives' && bit < ADJ_EXTRA_CELL_OFFSET && endsSentence(row[1], row[5])) continue;
    // A masculine or feminine short form with я or ты: either gender could be right (я готов / готова).
    if (slot.type === 'adjectives' && (bit === ADJ_EXTRA_CELL_OFFSET || bit === ADJ_EXTRA_CELL_OFFSET + 1) && /(^|[^а-яё])(я|ты)([^а-яё]|$)/i.test(row[1])) continue;
    const wrong = wrongForms(e, bit, row[3]);
    if (wrong.length < 2) continue;
    const rightF = usedForm(e.cells[bit] ?? '', token);
    const right = { f: rightF, code: codesFor(e, rightF, sameNumber(e, bit)) || code(e, bit) };
    return candidate({ key, ru: row[1], en: row[2], start: row[4], end: row[5], hint: e.accented, right, wrong, rank: e.rank }, rng);
  }
  return null;
}

/** A verbal adverb in its own sentence: читая / прочитав vs the verb's other forms and its participles. */
function adverbCandidate(slot: FormSlot, ctx: Ctx, keys: Set<string>): LevelTestCandidate | null {
  const { lex, rng } = ctx;
  const verbs = [...lex.participles.keys()].map((id) => lex.byId.verbs.get(id)).filter((v): v is Entry => !!v && inRank(slot, v.rank));
  for (let tries = 0; tries < 80 && verbs.length; tries++) {
    const v = pick(rng, verbs);
    const p = lex.participles.get(v.id)!;
    // The sentence index lists a verb's verbal adverbs first, skipping an empty one, so bit 0 is the first that exists.
    const advs = [p[4], p[5]].filter(Boolean);
    const advMask = (1 << advs.length) - 1;
    const rows = (shard(ctx, 'participles', v.band)[v.id] ?? []).filter((r) => r[3] & advMask);
    if (!rows.length) continue;
    const row = pick(rng, rows);
    const key = `lt:adv:${row[0]}:${row[4]}`;
    if (keys.has(key)) continue;
    const token = row[1].slice(row[4], row[5]);
    const cell = row[3] & 1 ? advs[0]! : advs[1]!;
    // The answer is always the word in the sentence: skip a row whose word isn't one of the adverb's forms.
    if (!formsOf([cell]).has(normalise(token))) continue;
    // The verb's other adverb could also be acceptable, so it isn't offered; participles and finite forms are wrong.
    const exclude = formsOf([p[4], p[5]]);
    const pool: Opt[] = [{ f: v.accented, code: 'inf' }, ...cellsOf(v, [2, 6]), ...p[6].filter(([k]) => k.startsWith('act')).map(([k, nom]) => ({ f: nom, code: `p:${k}:0` }))];
    const wrong = distinctForms(pool, exclude);
    if (wrong.length < 2) continue;
    return candidate({ key, ru: row[1], en: row[2], start: row[4], end: row[5], hint: v.accented, right: { f: usedForm(cell, token), code: 'adv' }, wrong, rank: v.rank }, rng);
  }
  return null;
}

/**
 * A participle in its own sentence, the verb in brackets: знающего vs знающий / знающему / знающим … The wrong options
 * are the same participle in other genders, numbers and cases, leaving out every cell spelt like the answer. Participles
 * that are also adjectives in the data (любимый) aren't in the participle sentences, so they never come up.
 */
function participleCandidate(slot: ParticipleSlot, ctx: Ctx, keys: Set<string>): LevelTestCandidate | null {
  const { lex, rng } = ctx;
  const verbs = [...lex.participles.keys()].map((id) => lex.byId.verbs.get(id)).filter((v): v is Entry => !!v && inRank(slot, v.rank));
  // Every verb and sentence, in a shuffled (seeded) order, until one makes a fair question. (Random tries used to run
  // out before the rarer C1 participles were found, leaving that question type short.)
  for (const v of shuffle(rng, verbs)) {
    const p = lex.participles.get(v.id)!;
    for (const row of shuffle(rng, shard(ctx, 'participles', v.band)[v.id] ?? [])) {
      const key = `lt:part:${row[0]}:${row[4]}`;
      // Ending the sentence it is a predicate, and next to я, ты or вы its gender depends on who is meant (я, знающий /
      // знающая): two options could both be right.
      if (keys.has(key) || endsSentence(row[1], row[5]) || /(^|[^а-яё])(я|ты|вы)([^а-яё]|$)/i.test(row[1])) continue;
      const token = normalise(row[1].slice(row[4], row[5]));
      // The participle(s) the token is a full form of; it must be exactly one.
      const hits = p[6].filter(([, , cells]) => cells.some((c) => cellForms(c).some((f) => normalise(f) === token)));
      if (hits.length !== 1) continue;
      const [kind, , cells] = hits[0]!;
      if (!slot.pkinds.includes(kind)) continue;
      const at = cells.findIndex((c) => cellForms(c).some((f) => normalise(f) === token));
      const alsoRight = formsOf(cells.filter((c) => cellForms(c).some((f) => normalise(f) === token)));
      const wrong = distinctForms(cells.map((c, i) => ({ f: c, code: `p:${kind}:${i}` })), alsoRight);
      if (wrong.length < 3) continue;
      const right = {
        f: usedForm(cells[at]!, row[1].slice(row[4], row[5])),
        code: cells.map((c, i) => (cellForms(c).some((f) => normalise(f) === token) ? `p:${kind}:${i}` : '')).filter(Boolean).join('+'),
      };
      return candidate({ key, ru: row[1], en: row[2], start: row[4], end: row[5], hint: v.accented, right, wrong, rank: v.rank }, rng);
    }
  }
  return null;
}

// ---------------------------------------------------------------- gap questions (sentence drills with a word in brackets)

/** Cases each preposition can take (standard grammar). A form in another of these cases could also fit. */
const PREP_CASES: Record<string, string[]> = { в: ['acc', 'prep'], на: ['acc', 'prep'], за: ['acc', 'inst'], под: ['acc', 'inst'], с: ['gen', 'inst'] };
const GOV_CASE: Record<string, string> = { dat: 'dat', gen: 'gen', inst: 'inst', acc: 'acc', 'o+prep': 'prep', 'na+acc': 'acc', 'na+prep': 'prep', 'v+acc': 'acc', 'v+prep': 'prep', 'ot+gen': 'gen', 'k+dat': 'dat', 's+inst': 'inst' };
const KIND_CASES: Record<string, string[]> = { 'v-day': ['acc'], 'v-month': ['prep'], 'po-days': ['dat'], cherez: ['acc'], nazad: ['acc', 'gen'], net: ['gen'], 'cmp-gen': ['gen'], 'imp-noun': ['dat'], 'imp-pron': ['dat'] };
/** The case(s) a sentence kind calls for: "в:prep", "dat|помога'ть", "v-day" … ([] if not known). */
function expectedCases(kind: string): string[] {
  const prep = /^[а-я]+:([a-z+]+)$/.exec(kind);
  if (prep) return prep[1]!.split('+');
  const gov = /^([a-z+]+)\|/.exec(kind);
  if (gov) return [GOV_CASE[gov[1]!] ?? ''];
  return KIND_CASES[kind] ?? [];
}

/**
 * A gapped sentence drill row as multiple choice: the options are forms of the bracketed word. For nouns and
 * pronouns, wrong options are the same number in other cases, leaving out any case the preposition (or нет) could
 * also take; a spelling shared by two cells is read in the case the sentence needs.
 */
export function sentenceCandidate(row: ClozeRow, topic: ClozeTopic, lex: Lexicon, rng: Rng): { c: LevelTestCandidate; rank: number } | null {
  const hint = row[6];
  const entry = lex.byAccented.get(hint);
  if (!entry) return null;
  const token = row[1].slice(row[3], row[4]);
  const answerSet = new Set(cellForms(row[5]).map(normalise));
  answerSet.add(normalise(token));
  const matches = entry.cells.map((c, i) => (cellForms(c).some((f) => answerSet.has(normalise(f))) ? i : -1)).filter((i) => i >= 0);
  const isInfinitive = entry.type === 'verb' && answerSet.has(normalise(hint));
  if (!matches.length && !isInfinitive) return null;
  const want = expectedCases(row[7]);
  const nounLike = entry.type === 'noun' || entry.type === 'pron';
  const at = isInfinitive ? -1 : ((nounLike ? matches.find((i) => want.includes(NOUN_CASE(i))) : undefined) ?? matches[0]!);
  // Forms that would also fit the gap, whatever case they are listed under (закат is both nominative and accusative).
  const alsoRight = new Set(answerSet);
  let pool: Opt[];
  if (nounLike) {
    const plural = entry.type === 'noun' && at >= 6;
    const prep = /^([а-я]+):/.exec(row[7])?.[1];
    const fits = new Set(prep ? (PREP_CASES[prep] ?? []) : []);
    entry.cells.forEach((c, i) => {
      const sameNumber = i >= (plural ? 6 : 0) && i < (plural ? 12 : 6);
      const netOther = row[7] === 'net' && i === (plural ? 1 : 7); // нет книги / нет книг
      if ((sameNumber && fits.has(NOUN_CASE(i))) || netOther) for (const f of cellForms(c)) alsoRight.add(normalise(f));
    });
    pool = cellsOf(entry, entry.cells.map((_, i) => i).filter((i) => i !== at && i >= (plural ? 6 : 0) && i < (plural ? 12 : 6)));
  } else if (entry.type === 'verb') {
    // After чтобы and бы: a past form or the infinitive. Wrong options are forms that can never fit there (present
    // tense; the infinitive where a past form is needed, and vice versa) — never another gender of the past, which
    // could be right for a speaker of the other sex (чтобы я пришёл / пришла).
    pool = isInfinitive ? cellsOf(entry, [6, 2, 5]) : [{ f: hint, code: 'inf' }, ...cellsOf(entry, PRESFUT)];
  } else {
    pool = cellsOf(entry, range(0, ADJ_EXTRA_CELL_OFFSET - 1).filter((i) => i !== at));
  }
  const wrong = distinctForms(pool, alsoRight);
  if (wrong.length < 2) return null;
  // The в лесу form is spelt like the dative (лесу), but it is the second prepositional: label it as such.
  const rightF = usedForm(row[5], token);
  // Nouns: the case the sentence needs (the gap's preposition or verb fixes it). Adjectives: every cell spelt so.
  const rightCode = isInfinitive ? 'inf' : row[7] === 'loc' ? 'loc' : nounLike && want.includes(NOUN_CASE(at)) ? code(entry, at) : codesFor(entry, rightF, sameNumber(entry, at)) || code(entry, at);
  const right = { f: rightF, code: rightCode };
  const key = `lt:gap:${topic}:${row[0]}:${row[3]}`;
  return { c: candidate({ key, ru: row[1], en: row[2], start: row[3], end: row[4], hint, right, wrong, kind: row[7], rank: entry.type === 'pron' ? -1 : entry.rank }, rng), rank: entry.rank };
}

function clozeRows(ctx: Ctx, topic: ClozeTopic): ClozeRow[] {
  let rows = ctx.cloze.get(topic);
  if (!rows) {
    const file = ctx.read<Manifest>('manifest.json').cloze[topic]?.file;
    rows = file ? ctx.read<ClozeRow[]>(file) : [];
    ctx.cloze.set(topic, rows);
  }
  return rows;
}
/** A slot's kinds match a row's kind with or without its tense (impf, or impf@past). */
const kindMatches = (slot: GapSlot | ChoiceSlot, row: ClozeRow) => !slot.kinds || slot.kinds.includes(row[7]) || slot.kinds.includes(row[7].split('@')[0]!);

function gapSlotCandidate(slot: GapSlot, ctx: Ctx, keys: Set<string>): LevelTestCandidate | null {
  const rows = clozeRows(ctx, slot.topic).filter((r) => kindMatches(slot, r));
  for (let tries = 0; tries < 80 && rows.length; tries++) {
    const res = sentenceCandidate(pick(ctx.rng, rows), slot.topic, ctx.lex, ctx.rng);
    if (!res || keys.has(res.c[0]) || !inRank(slot, res.rank)) continue;
    return res.c;
  }
  return null;
}

function choiceSlotCandidate(slot: ChoiceSlot, ctx: Ctx, keys: Set<string>): LevelTestCandidate | null {
  const rows = clozeRows(ctx, slot.topic).filter((r) => r[8].length && kindMatches(slot, r));
  for (let tries = 0; tries < 40 && rows.length; tries++) {
    const row = pick(ctx.rng, rows);
    const key = `lt:choice:${slot.topic}:${row[0]}:${row[3]}`;
    if (keys.has(key)) continue;
    const base = clozeQuestion(row, slot.topic);
    const right = base.choices!.find((c) => checkAnswer(base, c).correct);
    const wrong = base.choices!.filter((c) => c !== right && !checkAnswer(base, c).correct);
    if (!right || !wrong.length) continue;
    const opt = (f: string) => ({ f, code: '' });
    return candidate({ key, ru: row[1], en: row[2], start: row[3], end: row[4], hint: row[6], right: opt(right), wrong: wrong.map(opt), answer: base.answer, kind: row[7] }, ctx.rng);
  }
  return null;
}

// ---------------------------------------------------------------- the pool

/**
 * Up to PER_SLOT candidates for every question type, in a fixed order (seeded), so the same data gives the same file.
 * Slots that find fewer are listed by the pipeline in the validation report.
 */
export function buildLevelTestPool(read: ReadJson, seed = 1): LevelTestData {
  const ctx: Ctx = { read, lex: loadLexicon(read), shards: new Map(), cloze: new Map(), rng: mulberry32(seed) };
  const slots: LevelTestData['slots'] = [];
  for (const level of TEST_LEVELS) {
    for (const slot of POOLS[level]) {
      const keys = new Set<string>();
      const items: LevelTestCandidate[] = [];
      let misses = 0;
      while (items.length < PER_SLOT && misses < 3) {
        const c =
          slot.kind === 'form' ? formSlotCandidate(slot, ctx, keys)
          : slot.kind === 'participle' ? participleCandidate(slot, ctx, keys)
          : slot.kind === 'gap' ? gapSlotCandidate(slot, ctx, keys)
          : choiceSlotCandidate(slot, ctx, keys);
        if (!c) {
          misses++;
          continue;
        }
        keys.add(c[0]);
        // A sentence written with stress marks (горла́) has gap positions counted without them, so the gap would land
        // on the wrong letters: leave it out.
        if (/\u0301/.test(c[1])) continue;
        items.push(c);
      }
      slots.push({ level, w: slot.w, topic: slot.learn, ask: slot.ask, items });
    }
  }
  return { slots };
}

/** Options shown: three wrong ones at A1–A2 (any three), four at B1 and above (the closest to the right one). */
export const wrongShown = (level: TestLevel) => (level === 'A1' || level === 'A2' ? 3 : 4);

/** A candidate as a multiple-choice question, options shuffled. */
export function candidateQuestion(c: LevelTestCandidate, mode: Mode, level: TestLevel, rng: Rng): Question {
  const [key, ru, en, start, end, hint, right, wrong, answer] = c;
  const before = ru.slice(0, start);
  const after = ru.slice(end);
  const n = wrongShown(level);
  const shown = n === 3 ? shuffle(rng, wrong).slice(0, 3) : wrong.slice(0, 4);
  return {
    key,
    mode,
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [],
    frame: `${before}___${hint ? ` (${hint})` : ''}${after}`,
    answer: answer || right,
    others: [],
    label: '',
    choices: shuffle(rng, [right, ...shown]),
    speak: (f) => `${before}${f.replace(/'/g, '')}${after}`,
  };
}
