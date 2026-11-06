/**
 * Level test: 60 multiple-choice questions, 12 per level from A1 to C1, easiest first. Not adaptive.
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
 * Each level draws 12 of a larger pool of question types (at most 2 per topic), ordered by a 1–3 difficulty weight;
 * words are random and graded by frequency rank (A1 commonest only, B2/C1 rarer), so no two tests are the same.
 * The level of each question type is our judgement (CEFR-style). Nothing is stored.
 */
import { ADJ_EXTRA_CELL_OFFSET, ADJ_INDEX, CASES } from '../shared/cells.ts';
import { cellForms, displayForms } from '../shared/forms.ts';
import { normalise } from '../shared/normalise.ts';
import type { ClozeRow, ParticipleRow, SentenceRow } from '../shared/types.ts';
import { checkAnswer } from './check.ts';
import { loadAdjectives, loadCloze, loadNouns, loadParticiples, loadPronouns, loadSentences, loadVerbs } from './data.ts';
import { clozeQuestion, type ClozeTopic } from './questions/cloze.ts';
import { pick, shuffle, type Rng } from './rng.ts';
import type { Mode, Question } from './types.ts';

export const TEST_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type TestLevel = (typeof TEST_LEVELS)[number];
export const PER_LEVEL = 12;
/** A level counts with at least this many of its 12 right (three quarters), and only if every level below counts. */
export const PASS = 9;
/** No topic more than this many times in one level. */
const MAX_PER_TOPIC = 2;

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
export type Slot = FormSlot | GapSlot | ChoiceSlot;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const adj = (...keys: (keyof typeof ADJ_INDEX)[]) => keys.map((k) => ADJ_INDEX[k]);
const SG = { nom: 0, gen: 1, dat: 2, acc: 3, inst: 4, prep: 5 } as const;
const PL = { nom: 6, gen: 7, dat: 8, acc: 9, inst: 10, prep: 11 } as const;
const PRESFUT = range(0, 5);
const PAST = range(6, 9);
const IMPERATIVE = [10, 11];
const SHORT = range(ADJ_EXTRA_CELL_OFFSET, ADJ_EXTRA_CELL_OFFSET + 3);
const COMPARATIVE = [ADJ_EXTRA_CELL_OFFSET + 4];
const SUPERLATIVE = [ADJ_EXTRA_CELL_OFFSET + 5];
const ADJ_NOM = adj('m_nom', 'f_nom', 'n_nom', 'pl_nom');
const ADJ_SG_OBLIQUE = adj('m_gen', 'f_gen', 'n_gen', 'm_dat', 'f_dat', 'm_acc', 'm_acc_anim', 'f_acc', 'm_inst', 'f_inst', 'm_prep', 'f_prep');
const ADJ_PL_OBLIQUE = adj('pl_gen', 'pl_dat', 'pl_inst', 'pl_prep');

const form = (level: TestLevel, w: Base['w'], type: FormSlot['type'], cells: number[], learn: Mode, extra: Partial<FormSlot> = {}): FormSlot => ({
  kind: 'form', level, w, type, cells, learn, ask: type === 'verbs' || type === 'adverb' ? ASK.verb : ASK.form, ...extra,
});
const gap = (level: TestLevel, w: Base['w'], topic: ClozeTopic, learn: Mode, kinds?: string[], extra: Partial<GapSlot> = {}): GapSlot => ({
  kind: 'gap', level, w, topic, learn, kinds, ask: ASK.form, ...extra,
});
const choice = (level: TestLevel, w: Base['w'], topic: ClozeTopic, learn: Mode, ask: string, kinds?: string[]): ChoiceSlot => ({
  kind: 'choice', level, w, topic, learn, ask, kinds,
});

/**
 * The pools. Left out on purpose, because in real sentences two options can both be right: indefinite pronouns
 * (-то / -нибудь), же / ведь, and the colloquial particles (вот, ну, даже, только).
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
    form('B1', 2, 'nouns', [PL.gen, PL.dat, PL.inst, PL.prep], 'plurals', { maxRank: 1000 }),
    form('B1', 2, 'adjectives', ADJ_PL_OBLIQUE, 'adjectives', { maxRank: 1000 }),
    form('B1', 2, 'verbs', [...PRESFUT, ...PAST], 'verbs', { minRank: 300, maxRank: 1500 }),
    choice('B1', 2, 'aspectContext', 'aspectContext', ASK.aspect),
    choice('B1', 3, 'aspectContext', 'aspectContext', ASK.aspect),
    choice('B1', 2, 'position', 'position', ASK.position),
    choice('B1', 2, 'svoy', 'possessives', ASK.svoy),
    gap('B1', 2, 'conditional', 'conditional', undefined, { ask: ASK.verb }),
    gap('B1', 2, 'impersonal', 'impersonal', ['imp-noun']),
    gap('B1', 3, 'kotoryi', 'kotoryi'),
    gap('B1', 3, 'chtoby', 'chtoby', undefined, { ask: ASK.verb }),
    gap('B1', 3, 'comparison', 'comparison'),
    gap('B1', 3, 'government', 'government', undefined, { maxRank: 1000 }),
    gap('B1', 3, 'prepositions', 'prepositions', ['за:inst', 'под:inst', 'перед:inst', 'над:inst', 'между:inst', 'при:prep'], { maxRank: 1000 }),
  ],
  B2: [
    form('B2', 1, 'verbs', [...PAST, ...IMPERATIVE], 'verbs', { minRank: 1000 }),
    form('B2', 2, 'adverb', [0, 1], 'adverbs', { maxRank: 2500 }),
    form('B2', 2, 'adjectives', SUPERLATIVE, 'compare', { maxRank: 2500 }),
    form('B2', 3, 'nouns', [SG.gen, SG.dat, SG.inst, SG.prep, PL.gen, PL.dat, PL.inst, PL.prep], 'nounCases', { minRank: 1000 }),
    form('B2', 3, 'adjectives', [...ADJ_SG_OBLIQUE, ...ADJ_PL_OBLIQUE], 'adjectives', { minRank: 1000 }),
    choice('B2', 2, 'particles', 'particles', ASK.particle, ['li']),
    choice('B2', 2, 'position', 'position', ASK.position),
    gap('B2', 2, 'government', 'government', undefined, { minRank: 250 }),
    gap('B2', 3, 'specialCases', 'specialCases', ['loc']),
    gap('B2', 3, 'prepositions', 'prepositions', undefined, { minRank: 1000 }),
    gap('B2', 3, 'chtoby', 'chtoby', ['past'], { ask: ASK.verb }),
    gap('B2', 3, 'kotoryi', 'kotoryi'),
    choice('B2', 3, 'aspectContext', 'aspectContext', ASK.aspect),
    gap('B2', 2, 'impersonal', 'impersonal', ['imp-noun']),
    gap('B2', 3, 'negation', 'negation', ['net'], { minRank: 250 }),
    gap('B2', 3, 'comparison', 'comparison', undefined, { minRank: 250 }),
  ],
  C1: [
    form('C1', 1, 'adverb', [0, 1], 'adverbs', { minRank: 1000 }),
    form('C1', 2, 'adjectives', SHORT, 'short', { minRank: 1000 }),
    form('C1', 2, 'verbs', range(0, 11), 'verbs', { minRank: 1500 }),
    form('C1', 2, 'adjectives', SUPERLATIVE, 'compare', { minRank: 1000 }),
    form('C1', 3, 'nouns', [PL.gen], 'plurals', { minRank: 1000 }),
    form('C1', 3, 'nouns', [PL.gen, PL.dat, PL.inst, PL.prep], 'nounCases', { minRank: 1500 }),
    form('C1', 3, 'adjectives', [...ADJ_SG_OBLIQUE, ...ADJ_PL_OBLIQUE], 'adjectives', { minRank: 1500 }),
    gap('C1', 2, 'specialCases', 'specialCases', ['loc']),
    gap('C1', 3, 'government', 'government', undefined, { minRank: 1000 }),
    gap('C1', 3, 'prepositions', 'prepositions', undefined, { minRank: 1500 }),
    gap('C1', 3, 'negation', 'negation', ['net'], { minRank: 1000 }),
    gap('C1', 3, 'comparison', 'comparison', undefined, { minRank: 250 }),
    gap('C1', 3, 'kotoryi', 'kotoryi'),
    gap('C1', 3, 'chtoby', 'chtoby', ['past'], { ask: ASK.verb }),
    choice('C1', 3, 'aspectContext', 'aspectContext', ASK.aspect),
    gap('C1', 3, 'time', 'time', ['po-days']),
  ],
};

export interface TestItem {
  level: TestLevel;
  /** topic id = drill mode = Learn page */
  topic: Mode;
  /** what to do, in plain words */
  instruction: string;
  q: Question;
}

// ---------------------------------------------------------------- the words

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

export async function loadLexicon(): Promise<Lexicon> {
  const [nouns, verbs, adjs, pronouns, parts] = await Promise.all([loadNouns(2), loadVerbs(2), loadAdjectives(2), loadPronouns(), loadParticiples(2)]);
  const byAccented = new Map<string, Entry>();
  const byId: Lexicon['byId'] = { nouns: new Map(), verbs: new Map(), adjectives: new Map() };
  // Shards are in frequency order, band by band, so the index is the frequency rank.
  nouns.forEach((n, i) => {
    const e: Entry = { type: 'noun', id: n.id, accented: n.accented, cells: n.cells, rank: i, band: n.band };
    byId.nouns.set(n.id, e);
    if (!byAccented.has(n.accented)) byAccented.set(n.accented, e);
  });
  verbs.forEach((v, i) => {
    const e: Entry = { type: 'verb', id: v.id, accented: v.accented, cells: v.cells, rank: i, band: v.band };
    byId.verbs.set(v.id, e);
    if (!byAccented.has(v.accented)) byAccented.set(v.accented, e);
  });
  adjs.forEach((a, i) => {
    const e: Entry = { type: 'adj', id: a.id, accented: a.accented, cells: [...a.cells, ...a.extra], rank: i, band: a.band };
    byId.adjectives.set(a.id, e);
    if (!byAccented.has(a.accented)) byAccented.set(a.accented, e);
  });
  for (const [who, cells] of pronouns.personal) if (who) byAccented.set(who, { type: 'pron', id: -1, accented: who, cells, rank: 0, band: 0 });
  return { byAccented, byId, participles: new Map(parts.map((p) => [p.row[0], p.row])) };
}

/** First displayed form of each cell, skipping any that equal an excluded form or each other. */
function distinctForms(cells: string[], exclude: Set<string>): string[] {
  const seen = new Set(exclude);
  const out: string[] = [];
  for (const c of cells) {
    const f = displayForms(c)[0];
    if (!f || seen.has(normalise(f))) continue;
    seen.add(normalise(f));
    out.push(f);
  }
  return out;
}
const formsOf = (cells: (string | undefined)[]) => new Set(cells.flatMap((c) => cellForms(c ?? '')).map(normalise));
/** The variant of a cell that the sentence actually uses (keeps the source stress). */
const usedForm = (cell: string, token: string) => cellForms(cell).find((f) => normalise(f) === normalise(token)) ?? displayForms(cell)[0] ?? token;

function gapQuestion(key: string, ru: string, en: string, start: number, end: number, hint: string, right: string, wrong: string[], mode: Mode, rng: Rng): Question {
  const before = ru.slice(0, start);
  const after = ru.slice(end);
  return {
    key,
    mode,
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [],
    frame: `${before}___${hint ? ` (${hint})` : ''}${after}`,
    answer: right,
    others: [],
    label: '',
    choices: shuffle(rng, [right, ...shuffle(rng, wrong).slice(0, 3)]),
    speak: (f) => `${before}${f.replace(/'/g, '')}${after}`,
  };
}

// ---------------------------------------------------------------- form questions (a word's own sentences)

const NOUN_CASE = (i: number) => CASES[i % 6]!;

/** Wrong options for a word's form, all real forms of the same word, none that could also be right. */
function wrongForms(e: Entry, bit: number, rowMask: number): string[] {
  const alsoRight = formsOf(e.cells.filter((_, i) => rowMask & (1 << i)));
  alsoRight.add(normalise(displayForms(e.cells[bit] ?? '')[0] ?? ''));
  let pool: string[];
  if (e.type === 'noun') {
    const plural = bit >= 6;
    pool = e.cells.filter((_, i) => i !== bit && i >= (plural ? 6 : 0) && i < (plural ? 12 : 6));
  } else if (e.type === 'verb') {
    // Present/future: the other persons. Past: present forms and the infinitive (not the other genders: я/ты/вы could
    // be either). Imperative: present forms, infinitive and past (not the other imperative: скажи / скажите).
    if (bit <= 5) pool = e.cells.slice(0, 6);
    else if (bit <= 9) pool = [...e.cells.slice(0, 6), e.accented];
    else pool = [...e.cells.slice(0, 6), e.accented, e.cells[6] ?? ''];
  } else {
    const nom = ADJ_NOM.map((i) => e.cells[i] ?? '');
    if (bit < ADJ_EXTRA_CELL_OFFSET) pool = e.cells.slice(0, ADJ_EXTRA_CELL_OFFSET);
    // Short forms: the other short forms only — a long form is often also right as a predicate (она жирная).
    else if (bit < ADJ_EXTRA_CELL_OFFSET + 4) pool = e.cells.slice(ADJ_EXTRA_CELL_OFFSET, ADJ_EXTRA_CELL_OFFSET + 4);
    else pool = [...nom, ...e.cells.slice(ADJ_EXTRA_CELL_OFFSET + 4, ADJ_EXTRA_CELL_OFFSET + 6)];
  }
  return distinctForms(pool, alsoRight);
}

interface Ctx {
  lex: Lexicon;
  shards: Map<string, Record<string, SentenceRow[]>>;
  cloze: Map<string, ClozeRow[]>;
  rng: Rng;
}
async function shard(ctx: Ctx, type: 'nouns' | 'verbs' | 'adjectives' | 'participles', band: number) {
  const k = `${type}:${band}`;
  let s = ctx.shards.get(k);
  if (!s) {
    s = await loadSentences(type, band);
    ctx.shards.set(k, s);
  }
  return s;
}
const inRank = (slot: Slot, rank: number) => (slot.maxRank === undefined || rank < slot.maxRank) && (slot.minRank === undefined || rank >= slot.minRank);

async function formSlotQuestion(slot: FormSlot, ctx: Ctx, keys: Set<string>): Promise<Question | null> {
  const { lex, rng } = ctx;
  if (slot.type === 'adverb') return adverbQuestion(slot, ctx, keys);
  const map = lex.byId[slot.type];
  const lemmas = [...map.values()].filter((e) => inRank(slot, e.rank));
  const want = slot.cells.reduce((m, c) => m | (1 << c), 0);
  for (let tries = 0; tries < 80 && lemmas.length; tries++) {
    const e = pick(rng, lemmas);
    const rows = ((await shard(ctx, slot.type, e.band))[e.id] ?? []).filter((r) => r[3] & want);
    if (!rows.length) continue;
    const row = pick(rng, rows);
    const key = `lt:${slot.type}:${row[0]}:${row[4]}`;
    if (keys.has(key)) continue;
    const bits = slot.cells.filter((c) => row[3] & (1 << c));
    const bit = pick(rng, bits);
    const token = row[1].slice(row[4], row[5]);
    // An adjective ending the sentence is a predicate (Я богатый / богатая): with я, ты or вы its gender depends on
    // who is speaking, so two options could both be right. Only adjectives before more of the sentence are used.
    if (slot.type === 'adjectives' && bit < ADJ_EXTRA_CELL_OFFSET && /^[\s.,!?…»"]*$/.test(row[1].slice(row[5]))) continue;
    // A masculine or feminine short form with я or ты: either gender could be right (я готов / готова).
    if (slot.type === 'adjectives' && (bit === ADJ_EXTRA_CELL_OFFSET || bit === ADJ_EXTRA_CELL_OFFSET + 1) && /(^|[^а-яё])(я|ты)([^а-яё]|$)/i.test(row[1])) continue;
    const right = usedForm(e.cells[bit] ?? '', token);
    const wrong = wrongForms(e, bit, row[3]);
    if (wrong.length < 2) continue;
    return gapQuestion(key, row[1], row[2], row[4], row[5], e.accented, right, wrong, slot.learn, rng);
  }
  return null;
}

/** A verbal adverb in its own sentence: читая / прочитав vs the verb's other forms and its participles. */
async function adverbQuestion(slot: FormSlot, ctx: Ctx, keys: Set<string>): Promise<Question | null> {
  const { lex, rng } = ctx;
  const verbs = [...lex.participles.keys()].map((id) => lex.byId.verbs.get(id)).filter((v): v is Entry => !!v && inRank(slot, v.rank));
  for (let tries = 0; tries < 80 && verbs.length; tries++) {
    const v = pick(rng, verbs);
    const p = lex.participles.get(v.id)!;
    // The sentence index lists a verb's verbal adverbs first, skipping an empty one, so bit 0 is the first that exists.
    const advs = [p[4], p[5]].filter(Boolean);
    const advMask = (1 << advs.length) - 1;
    const rows = ((await shard(ctx, 'participles', v.band))[v.id] ?? []).filter((r) => r[3] & advMask);
    if (!rows.length) continue;
    const row = pick(rng, rows);
    const key = `lt:adv:${row[0]}:${row[4]}`;
    if (keys.has(key)) continue;
    const token = row[1].slice(row[4], row[5]);
    const cell = row[3] & 1 ? advs[0]! : advs[1]!;
    const right = usedForm(cell, token);
    // The verb's other adverb could also be acceptable, so it isn't offered; participles and finite forms are wrong.
    const exclude = formsOf([p[4], p[5]]);
    const pool = [v.accented, v.cells[2] ?? '', v.cells[6] ?? '', ...p[6].filter(([k]) => k.startsWith('act')).map(([, nom]) => nom)];
    const wrong = distinctForms(pool, exclude);
    if (wrong.length < 2) continue;
    return gapQuestion(key, row[1], row[2], row[4], row[5], v.accented, right, wrong, slot.learn, rng);
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
export function sentenceQuestion(row: ClozeRow, topic: ClozeTopic, lex: Lexicon, rng: Rng, mode: Mode = topic as Mode): { q: Question; rank: number } | null {
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
  let pool: string[];
  if (nounLike) {
    const plural = entry.type === 'noun' && at >= 6;
    const prep = /^([а-я]+):/.exec(row[7])?.[1];
    const fits = new Set(prep ? (PREP_CASES[prep] ?? []) : []);
    entry.cells.forEach((c, i) => {
      const sameNumber = i >= (plural ? 6 : 0) && i < (plural ? 12 : 6);
      const netOther = row[7] === 'net' && i === (plural ? 1 : 7); // нет книги / нет книг
      if ((sameNumber && fits.has(NOUN_CASE(i))) || netOther) for (const f of cellForms(c)) alsoRight.add(normalise(f));
    });
    pool = entry.cells.filter((_, i) => i !== at && i >= (plural ? 6 : 0) && i < (plural ? 12 : 6));
  } else if (entry.type === 'verb') {
    // After чтобы and бы: a past form or the infinitive. Wrong options are forms that can never fit there (present
    // tense; the infinitive where a past form is needed, and vice versa) — never another gender of the past, which
    // could be right for a speaker of the other sex (чтобы я пришёл / пришла).
    pool = isInfinitive ? [entry.cells[6] ?? '', entry.cells[2] ?? '', entry.cells[5] ?? ''] : [hint, ...entry.cells.slice(0, 6)];
  } else {
    pool = entry.cells.slice(0, ADJ_EXTRA_CELL_OFFSET).filter((_, i) => i !== at);
  }
  const wrong = distinctForms(pool, alsoRight);
  if (wrong.length < 2) return null;
  const right = usedForm(row[5], token);
  const key = `lt:gap:${topic}:${row[0]}:${row[3]}`;
  return { q: gapQuestion(key, row[1], row[2], row[3], row[4], hint, right, wrong, mode, rng), rank: entry.rank };
}

async function clozeRows(ctx: Ctx, topic: ClozeTopic) {
  let rows = ctx.cloze.get(topic);
  if (!rows) {
    rows = await loadCloze(topic);
    ctx.cloze.set(topic, rows);
  }
  return rows;
}
const kindOf = (row: ClozeRow) => row[7].split('@')[0]!;

async function gapSlotQuestion(slot: GapSlot, ctx: Ctx, keys: Set<string>): Promise<Question | null> {
  const rows = (await clozeRows(ctx, slot.topic)).filter((r) => !slot.kinds || slot.kinds.includes(kindOf(r)));
  for (let tries = 0; tries < 80 && rows.length; tries++) {
    const res = sentenceQuestion(pick(ctx.rng, rows), slot.topic, ctx.lex, ctx.rng, slot.learn);
    if (!res || keys.has(res.q.key) || !inRank(slot, res.rank)) continue;
    return res.q;
  }
  return null;
}

async function choiceSlotQuestion(slot: ChoiceSlot, ctx: Ctx, keys: Set<string>): Promise<Question | null> {
  const rows = (await clozeRows(ctx, slot.topic)).filter((r) => r[8].length && (!slot.kinds || slot.kinds.includes(kindOf(r))));
  for (let tries = 0; tries < 40 && rows.length; tries++) {
    const row = pick(ctx.rng, rows);
    const base = clozeQuestion(row, slot.topic);
    const key = `lt:choice:${slot.topic}:${row[0]}:${row[3]}`;
    if (keys.has(key)) continue;
    const right = base.choices!.find((c) => checkAnswer(base, c).correct);
    const wrong = base.choices!.filter((c) => c !== right && !checkAnswer(base, c).correct);
    if (!right || !wrong.length) continue;
    return { ...base, key, mode: slot.learn, task: [], label: '', explain: undefined, choices: shuffle(ctx.rng, [right, ...shuffle(ctx.rng, wrong).slice(0, 3)]) };
  }
  return null;
}

// ---------------------------------------------------------------- building the test

/** The pool in random order, keeping at most MAX_PER_TOPIC slots per topic. */
export function chooseSlots(pool: Slot[], rng: Rng): Slot[] {
  const count = new Map<string, number>();
  const out: Slot[] = [];
  for (const s of shuffle(rng, pool)) {
    if ((count.get(s.learn) ?? 0) >= MAX_PER_TOPIC) continue;
    count.set(s.learn, (count.get(s.learn) ?? 0) + 1);
    out.push(s);
  }
  return out;
}

/** Build the 60 questions, level by level, each level ordered easier → harder. */
export async function buildTest(rng: Rng, onProgress?: (done: number) => void): Promise<TestItem[]> {
  const ctx: Ctx = { lex: await loadLexicon(), shards: new Map(), cloze: new Map(), rng };
  const items: TestItem[] = [];
  const keys = new Set<string>();
  for (const level of TEST_LEVELS) {
    const picked: { item: TestItem; w: number; tie: number }[] = [];
    for (const slot of chooseSlots(POOLS[level], rng)) {
      if (picked.length >= PER_LEVEL) break;
      const q = slot.kind === 'form' ? await formSlotQuestion(slot, ctx, keys) : slot.kind === 'gap' ? await gapSlotQuestion(slot, ctx, keys) : await choiceSlotQuestion(slot, ctx, keys);
      if (!q) continue;
      keys.add(q.key);
      picked.push({ item: { level, topic: slot.learn, instruction: slot.ask, q }, w: slot.w, tie: rng() });
      onProgress?.(items.length + picked.length);
    }
    picked.sort((a, b) => a.w - b.w || a.tie - b.tie);
    items.push(...picked.map((p) => p.item));
  }
  return items;
}

export type Response = { correct: boolean; skipped: boolean } | undefined;

export interface TestResult {
  /** right answers per level */
  byLevel: Record<TestLevel, { right: number; total: number }>;
  /** highest level passed in order from A1 (stops at the first level not passed); null = below A1 */
  level: TestLevel | null;
  /** topics with a wrong or "I don't know" answer, easiest level first, with how many were missed */
  review: { topic: Mode; level: TestLevel; missed: number }[];
  answered: number;
}

export function scoreTest(items: TestItem[], responses: Response[]): TestResult {
  const byLevel = Object.fromEntries(TEST_LEVELS.map((l) => [l, { right: 0, total: 0 }])) as TestResult['byLevel'];
  const review = new Map<Mode, { topic: Mode; level: TestLevel; missed: number }>();
  let answered = 0;
  items.forEach((it, i) => {
    const r = responses[i];
    if (!r) return;
    answered++;
    byLevel[it.level].total++;
    if (r.correct) byLevel[it.level].right++;
    else {
      const e = review.get(it.topic) ?? { topic: it.topic, level: it.level, missed: 0 };
      e.missed++;
      review.set(it.topic, e);
    }
  });
  let level: TestLevel | null = null;
  for (const l of TEST_LEVELS) {
    const { right, total } = byLevel[l];
    // Scaled to 12 so an early-ended test is judged on the questions actually answered.
    if (total && (right / total) * PER_LEVEL >= PASS) level = l;
    else break;
  }
  return { byLevel, level, review: [...review.values()], answered };
}
