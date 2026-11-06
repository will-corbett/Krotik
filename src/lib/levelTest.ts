/**
 * Level test: 60 multiple-choice questions, 12 per level from A1 to C1, easiest first. Not adaptive.
 *
 * Each level has a pool of question types (more than 12); every test draws 12 of them at random, with no topic more
 * than twice, then orders them from easier to harder within the level. Words are drawn at random too, so no two tests
 * are the same.
 *
 * Where the questions come from (so every form is from the data):
 *  - drill questions, made multiple choice by offering other real forms of the same word as the wrong options;
 *  - real sentences (Tatoeba) with a gap and the dictionary form in brackets ("Я живу в ___ (Москва)"), where the
 *    options are forms of that word. The case is not named: working it out is the point. Forms that would also fit
 *    (в школу / в школе) are never offered as wrong options.
 * Vocabulary is graded by frequency: A1 uses only the commonest words, B2 and C1 rarer ones.
 *
 * The level given to each question type is our judgement of where it is usually learnt (CEFR-style). The result is an
 * estimate of grammar and reading only. Nothing is stored.
 */
import { CASES } from '../shared/cells.ts';
import { cellForms, displayForms } from '../shared/forms.ts';
import { normalise } from '../shared/normalise.ts';
import type { ClozeRow } from '../shared/types.ts';
import { checkAnswer } from './check.ts';
import { loadAdjectives, loadCloze, loadNouns, loadVerbs } from './data.ts';
import { clozeQuestion, type ClozeTopic } from './questions/cloze.ts';
import { pick, shuffle, type Rng } from './rng.ts';
import { DEFAULTS, type Settings } from './settings.ts';
import { prepareRound, type Generate } from './start.ts';
import type { Mode, Question } from './types.ts';

export const TEST_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type TestLevel = (typeof TEST_LEVELS)[number];
export const PER_LEVEL = 12;
/** A level counts with at least this many of its 12 right (three quarters), and only if every level below counts. */
export const PASS = 9;
/** No topic more than this many times in one level. */
const MAX_PER_TOPIC = 2;

interface Base {
  level: TestLevel;
  /** 1 = easier … 3 = harder, within the level (questions are ordered by this) */
  w: 1 | 2 | 3;
  /** frequency rank of the word: only words ranked below maxRank / at or above minRank (0 = most common) */
  maxRank?: number;
  minRank?: number;
}
/** A question from a drill generator. */
export interface DrillSlot extends Base {
  kind: 'drill';
  mode: Mode;
  set?: Record<string, unknown>;
  band: 0 | 1 | 2;
  fit?: (q: Question) => Question | null;
}
/** A real sentence with a gap; the options are forms of the word in brackets. */
export interface SentenceSlot extends Base {
  kind: 'sentence';
  topic: ClozeTopic;
  /** which sentence kinds (e.g. "в:prep"); all if absent */
  kinds?: string[];
  /** the Learn page to recommend (defaults to the topic) */
  learn?: Mode;
}
export type Slot = DrillSlot | SentenceSlot;

const d = (level: TestLevel, w: Base['w'], mode: Mode, set?: Record<string, unknown>, band: 0 | 1 | 2 = 0, extra: Partial<DrillSlot> = {}): DrillSlot => ({ kind: 'drill', level, w, mode, set, band, ...extra });
const sn = (level: TestLevel, w: Base['w'], topic: ClozeTopic, kinds?: string[], extra: Partial<SentenceSlot> = {}): SentenceSlot => ({ kind: 'sentence', level, w, topic, kinds, ...extra });

/** Personal pronouns only (себя and кто/что are tested elsewhere, at their own level). */
const personalOnly = (q: Question) => (['себя', 'кто', 'что'].includes(q.headword.replace(/'/g, '')) ? null : q);

/**
 * The pools. Indefinite pronouns are left out on purpose: in real sentences -то and -нибудь often both fit, which
 * is fine in a drill but not in a test.
 */
export const POOLS: Record<TestLevel, Slot[]> = {
  A1: [
    d('A1', 1, 'alphabet', { types: ['read'] }, 0, { maxRank: 150 }),
    d('A1', 1, 'adjectives', { cases: ['nom'], number: 'sg' }, 0, { maxRank: 150 }),
    d('A1', 1, 'verbs', { groups: ['presfut'] }, 0, { maxRank: 80 }),
    d('A1', 1, 'pronouns', { cases: ['acc'], prepositions: ['plain'] }, 0, { fit: personalOnly }),
    d('A1', 2, 'pronouns', { cases: ['dat'], prepositions: ['plain'] }, 0, { fit: personalOnly }),
    d('A1', 2, 'nounCases', { cases: ['prep'], number: 'sg' }, 0, { maxRank: 150 }),
    d('A1', 2, 'nounCases', { cases: ['acc'], number: 'sg' }, 0, { maxRank: 150 }),
    d('A1', 2, 'plurals', { contexts: ['nom'] }, 0, { maxRank: 150 }),
    d('A1', 2, 'verbs', { groups: ['past'] }, 0, { maxRank: 80 }),
    d('A1', 2, 'narechiya', { types: ['form'] }, 0, { maxRank: 150 }),
    d('A1', 3, 'questionWords', { types: ['sentence'] }),
    sn('A1', 3, 'prepositions', ['в:prep', 'на:prep'], { maxRank: 250 }),
    sn('A1', 3, 'prepositions', ['в:acc', 'на:acc'], { maxRank: 250 }),
  ],
  A2: [
    d('A2', 1, 'pronouns', { cases: ['gen', 'dat', 'inst', 'prep'], prepositions: ['afterPrep'] }, 0, { fit: personalOnly }),
    d('A2', 1, 'nounCases', { cases: ['gen'], number: 'sg' }, 0, { maxRank: 250 }),
    d('A2', 2, 'nounCases', { cases: ['dat', 'inst'], number: 'sg' }, 0, { maxRank: 250 }),
    d('A2', 2, 'adjectives', { cases: ['acc', 'gen', 'prep'], number: 'sg' }, 0),
    d('A2', 2, 'verbs', { groups: ['imperative'] }, 0),
    d('A2', 2, 'plurals', { contexts: ['numbers', 'quantity'] }, 0),
    d('A2', 2, 'possessives', { types: ['agree'] }),
    d('A2', 2, 'compare', { types: ['comparative'] }, 0),
    d('A2', 2, 'questionWords', { types: ['table'] }),
    d('A2', 2, 'narechiya', { types: ['sentence'] }),
    d('A2', 3, 'negation', { kinds: ['ne-ni'] }),
    d('A2', 3, 'conjunctions'),
    sn('A2', 3, 'prepositions', ['у:gen', 'из:gen', 'для:gen', 'без:gen', 'к:dat', 'по:dat', 'с:inst', 'о:prep'], { maxRank: 1000 }),
    sn('A2', 3, 'time', ['v-day', 'v-month', 'cherez', 'nazad']),
    sn('A2', 3, 'negation', ['net']),
    sn('A2', 3, 'prepositions', ['от:gen', 'до:gen', 'после:gen', 'за:acc', 'через:acc'], { maxRank: 1000 }),
  ],
  B1: [
    d('B1', 1, 'short', undefined, 0),
    d('B1', 1, 'reflexive', { groups: ['presfut', 'past'] }, 1),
    d('B1', 2, 'nounCases', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'pl' }, 1),
    d('B1', 2, 'adjectives', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'pl' }, 0),
    d('B1', 2, 'possessives', { types: ['svoy'] }),
    d('B1', 2, 'ordinals', { types: ['agree'] }),
    d('B1', 2, 'plurals', { contexts: ['cases'], cases: ['gen', 'dat', 'inst', 'prep'] }, 1),
    d('B1', 2, 'aspectContext'),
    d('B1', 3, 'aspectContext'),
    d('B1', 3, 'position'),
    sn('B1', 2, 'conditional'),
    sn('B1', 2, 'impersonal', ['imp-noun']),
    sn('B1', 3, 'kotoryi'),
    sn('B1', 3, 'chtoby'),
    sn('B1', 3, 'comparison'),
    sn('B1', 3, 'government', undefined, { maxRank: 1000 }),
    sn('B1', 3, 'prepositions', ['за:inst', 'под:inst', 'перед:inst', 'над:inst', 'между:inst', 'при:prep'], { maxRank: 1000 }),
  ],
  B2: [
    d('B2', 1, 'adverbs', { aspects: ['impf', 'pf'] }, 1),
    d('B2', 1, 'verbs', { groups: ['past', 'imperative'] }, 2, { minRank: 1000 }),
    d('B2', 2, 'participles', { kinds: ['act_pres', 'act_past'], types: ['form'] }, 1),
    d('B2', 2, 'participles', { kinds: ['pass_past'], types: ['short'] }, 1),
    d('B2', 2, 'government', { types: ['choice'] }),
    d('B2', 2, 'particles', { groups: ['li', 'zhe-ved'] }),
    d('B2', 2, 'compare', { types: ['superlative'] }, 1),
    d('B2', 2, 'position'),
    d('B2', 3, 'nounCases', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'both' }, 2, { minRank: 1000 }),
    d('B2', 3, 'adjectives', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'both' }, 2, { minRank: 1000 }),
    d('B2', 3, 'participles', { kinds: ['act_pres', 'act_past'], types: ['decline'] }, 1),
    sn('B2', 2, 'government', undefined, { minRank: 250 }),
    sn('B2', 3, 'specialCases', ['loc'], { learn: 'specialCases' }),
    sn('B2', 3, 'prepositions', undefined, { minRank: 1000 }),
    sn('B2', 3, 'chtoby', ['past']),
    sn('B2', 3, 'kotoryi'),
  ],
  C1: [
    d('C1', 1, 'adverbs', { aspects: ['impf', 'pf'] }, 2, { minRank: 1000 }),
    d('C1', 1, 'reflexive', { groups: ['presfut', 'past', 'imperative'] }, 2, { minRank: 1000 }),
    d('C1', 2, 'participles', { kinds: ['act_pres', 'act_past', 'pass_pres', 'pass_past'], types: ['decline'] }, 2),
    d('C1', 2, 'participles', { kinds: ['pass_pres', 'pass_past'], types: ['form'] }, 2),
    d('C1', 2, 'specialCases', { types: ['form'] }, 2),
    d('C1', 2, 'particles', { groups: ['colloquial'] }),
    d('C1', 3, 'plurals', { contexts: ['cases'], cases: ['gen'] }, 2, { minRank: 1000 }),
    d('C1', 3, 'short', undefined, 2, { minRank: 1000 }),
    d('C1', 3, 'verbs', { groups: ['presfut', 'past', 'imperative'] }, 2, { minRank: 1000 }),
    d('C1', 3, 'nounCases', { cases: ['gen', 'dat', 'inst', 'prep'], number: 'pl' }, 2, { minRank: 1000 }),
    d('C1', 3, 'compare', { types: ['superlative'] }, 2, { minRank: 1000 }),
    sn('C1', 2, 'specialCases', ['loc'], { learn: 'specialCases' }),
    sn('C1', 3, 'government', undefined, { minRank: 1000 }),
    sn('C1', 3, 'prepositions', undefined, { minRank: 1000 }),
    sn('C1', 3, 'negation', ['net'], { minRank: 1000 }),
    sn('C1', 3, 'comparison', undefined, { minRank: 250 }),
  ],
};

export interface TestItem {
  level: TestLevel;
  /** topic id = drill mode = Learn page */
  topic: Mode;
  q: Question;
}

function settingsFor(slot: DrillSlot): Settings {
  const st = { ...structuredClone(DEFAULTS), mode: slot.mode, band: slot.band, count: 10 } as Settings;
  const key = (slot.mode === 'stress' ? 'stressDrill' : slot.mode) as keyof Settings;
  if (slot.set && key in st && typeof st[key] === 'object') (st as unknown as Record<string, unknown>)[key] = { ...(st[key] as object), ...slot.set };
  return st;
}

/** First displayed form of each cell, skipping any that equal an answer form or each other. */
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

/**
 * The question as multiple choice: its own options if it has them (trimmed to 4), otherwise the answer plus up to
 * three other real forms of the same word. Null if there aren't enough wrong options.
 */
export function toChoice(q: Question, rng: Rng): Question | null {
  const answerSet = new Set(cellForms(q.answer).map(normalise));
  let right: string;
  let wrong: string[];
  if (q.choices?.length) {
    const ok = q.choices.find((c) => checkAnswer(q, c).correct);
    if (!ok) return null;
    right = ok;
    wrong = q.choices.filter((c) => c !== ok && !checkAnswer(q, c).correct);
  } else {
    right = displayForms(q.answer)[0] ?? '';
    wrong = distinctForms(q.others.map((o) => o.cell), answerSet);
  }
  // Built-in choices may be a real either/or (видел or увидел?); converted ones need at least two wrong forms.
  if (!right || wrong.length < (q.choices?.length ? 1 : 2)) return null;
  const options = shuffle(rng, [right, ...shuffle(rng, wrong).slice(0, 3)]);
  return { ...q, choices: options, frame: q.frame ?? '___' };
}

// ---------------------------------------------------------------- sentence questions

/** Cases each preposition can take (standard grammar). A form in another of these cases could also fit. */
const PREP_CASES: Record<string, string[]> = { в: ['acc', 'prep'], на: ['acc', 'prep'], за: ['acc', 'inst'], под: ['acc', 'inst'], с: ['gen', 'inst'] };
const caseOf = (i: number) => CASES[i % 6]!;
const GOV_CASE: Record<string, string> = { dat: 'dat', gen: 'gen', inst: 'inst', acc: 'acc', 'o+prep': 'prep', 'na+acc': 'acc', 'na+prep': 'prep', 'v+acc': 'acc', 'v+prep': 'prep', 'ot+gen': 'gen', 'k+dat': 'dat', 's+inst': 'inst' };
const KIND_CASES: Record<string, string[]> = { 'v-day': ['acc'], 'v-month': ['prep'], 'po-days': ['dat'], cherez: ['acc'], nazad: ['acc', 'gen'], net: ['gen'], 'cmp-gen': ['gen'], 'imp-noun': ['dat'] };
/** The case(s) a sentence kind calls for: "в:prep", "dat|помога'ть", "v-day" … ([] if not known). */
function expectedCases(kind: string): string[] {
  const prep = /^[а-я]+:([a-z+]+)$/.exec(kind);
  if (prep) return prep[1]!.split('+');
  const gov = /^([a-z+]+)\|/.exec(kind);
  if (gov) return [GOV_CASE[gov[1]!] ?? ''];
  return KIND_CASES[kind] ?? [];
}

export interface Lexicon {
  /** accented lemma → its cells and frequency rank (0 = most common), for nouns, verbs and adjectives */
  byAccented: Map<string, { type: 'noun' | 'verb' | 'adj'; cells: string[]; rank: number }>;
}

export async function loadLexicon(): Promise<Lexicon> {
  const [nouns, verbs, adjs] = await Promise.all([loadNouns(2), loadVerbs(2), loadAdjectives(2)]);
  const byAccented: Lexicon['byAccented'] = new Map();
  // Shards are in frequency order, band by band, so the index is the frequency rank.
  nouns.forEach((n, i) => byAccented.has(n.accented) || byAccented.set(n.accented, { type: 'noun', cells: n.cells, rank: i }));
  verbs.forEach((v, i) => byAccented.has(v.accented) || byAccented.set(v.accented, { type: 'verb', cells: v.cells, rank: i }));
  adjs.forEach((a, i) => byAccented.has(a.accented) || byAccented.set(a.accented, { type: 'adj', cells: a.cells, rank: i }));
  return { byAccented };
}

/**
 * A gapped sentence as multiple choice: the options are forms of the bracketed word. For nouns, wrong options are
 * the same number in other cases, leaving out any case the preposition (or нет) could also take.
 */
export function sentenceQuestion(row: ClozeRow, topic: ClozeTopic, lex: Lexicon, rng: Rng): { q: Question; rank: number } | null {
  const hint = row[6];
  const entry = lex.byAccented.get(hint);
  if (!entry) return null;
  const q = clozeQuestion(row, topic);
  const answerSet = new Set(cellForms(q.answer).map(normalise));
  // The same spelling can be several cells (сказки: genitive singular and accusative plural); take the one in the case
  // the sentence calls for (в + accusative here), so the wrong options are in the right number.
  const matches = entry.cells.map((c, i) => (cellForms(c).some((f) => answerSet.has(normalise(f))) ? i : -1)).filter((i) => i >= 0);
  if (!matches.length) return null;
  const want = expectedCases(row[7]);
  const at = (entry.type === 'noun' ? matches.find((i) => want.includes(caseOf(i))) : undefined) ?? matches[0]!;
  let pool: string[];
  // Forms that would also fit the gap, whatever case they are listed under (закат is both nominative and accusative).
  const alsoRight = new Set(answerSet);
  if (entry.type === 'noun') {
    const plural = at >= 6;
    const prep = /^([а-я]+):/.exec(row[7])?.[1];
    const fits = new Set(prep ? (PREP_CASES[prep] ?? []) : []);
    entry.cells.forEach((c, i) => {
      const sameNumber = i >= (plural ? 6 : 0) && i < (plural ? 12 : 6);
      // нет книги / нет книг: either number's genitive can be right.
      const netOther = row[7] === 'net' && i === (plural ? 1 : 7);
      if ((sameNumber && fits.has(caseOf(i))) || netOther) for (const f of cellForms(c)) alsoRight.add(normalise(f));
    });
    pool = entry.cells.filter((_, i) => i !== at && i >= (plural ? 6 : 0) && i < (plural ? 12 : 6));
  } else if (entry.type === 'verb') {
    // Past forms (gender/number) and the infinitive: чтобы он пришёл / пришла / прийти.
    pool = [...entry.cells.slice(6, 10), hint];
  } else {
    pool = entry.cells.filter((_, i) => i !== at);
  }
  const wrong = distinctForms(pool, alsoRight);
  if (wrong.length < 2) return null;
  const right = displayForms(q.answer)[0]!;
  return { q: { ...q, choices: shuffle(rng, [right, ...shuffle(rng, wrong).slice(0, 3)]) }, rank: entry.rank };
}

// ---------------------------------------------------------------- building the test

/** The pool in random order, keeping at most MAX_PER_TOPIC slots per topic. */
export function chooseSlots(pool: Slot[], rng: Rng): Slot[] {
  const topicOf = (s: Slot) => (s.kind === 'drill' ? s.mode : (s.learn ?? s.topic));
  const count = new Map<string, number>();
  const out: Slot[] = [];
  for (const s of shuffle(rng, pool)) {
    const t = topicOf(s);
    if ((count.get(t) ?? 0) >= MAX_PER_TOPIC) continue;
    count.set(t, (count.get(t) ?? 0) + 1);
    out.push(s);
  }
  return out;
}

const inRank = (slot: Slot, rank: number | undefined) =>
  rank === undefined || ((slot.maxRank === undefined || rank < slot.maxRank) && (slot.minRank === undefined || rank >= slot.minRank));

/** Build the 60 questions, level by level, each level ordered easier → harder. */
export async function buildTest(rng: Rng, onProgress?: (done: number) => void): Promise<TestItem[]> {
  const lex = await loadLexicon();
  const items: TestItem[] = [];
  const keys = new Set<string>();
  const gens = new Map<string, Generate>();
  const cloze = new Map<string, ClozeRow[]>();
  for (const level of TEST_LEVELS) {
    const picked: { item: TestItem; w: number; tie: number }[] = [];
    for (const slot of chooseSlots(POOLS[level], rng)) {
      if (picked.length >= PER_LEVEL) break;
      let made: { q: Question; topic: Mode } | null = null;
      if (slot.kind === 'drill') {
        const id = JSON.stringify([slot.mode, slot.set, slot.band]);
        let gen = gens.get(id);
        if (!gen) {
          try {
            gen = await prepareRound(settingsFor(slot), rng);
          } catch {
            continue;
          }
          gens.set(id, gen);
        }
        for (const cand of gen(20)) {
          if (keys.has(cand.key) || !inRank(slot, lex.byAccented.get(cand.headword)?.rank)) continue;
          const fitted = slot.fit ? slot.fit(cand) : cand;
          const q = fitted && toChoice(fitted, rng);
          if (q) {
            made = { q, topic: slot.mode };
            break;
          }
        }
      } else {
        let rows = cloze.get(slot.topic);
        if (!rows) {
          rows = await loadCloze(slot.topic);
          cloze.set(slot.topic, rows);
        }
        const usable = slot.kinds ? rows.filter((r) => slot.kinds!.includes(r[7])) : rows;
        for (let tries = 0; tries < 60 && usable.length; tries++) {
          const res = sentenceQuestion(pick(rng, usable), slot.topic, lex, rng);
          if (!res || keys.has(res.q.key) || !inRank(slot, res.rank)) continue;
          made = { q: res.q, topic: slot.learn ?? (slot.topic as Mode) };
          break;
        }
      }
      if (!made) continue;
      keys.add(made.q.key);
      picked.push({ item: { level, topic: made.topic, q: made.q }, w: slot.w, tie: rng() });
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
