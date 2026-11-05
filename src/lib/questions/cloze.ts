import type { ClozeRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, TERMS, type Term } from '../terms.ts';
import type { Mode, Question } from '../types.ts';

export type ClozeTopic = 'kotoryi' | 'chtoby' | 'conditional' | 'negation' | 'indefinite' | 'particles';

export const TOPIC_TERM: Record<ClozeTopic, Term> = {
  kotoryi: TERMS.kotoryi,
  chtoby: TERMS.chtoby,
  conditional: TERMS.conditional,
  negation: TERMS.negation,
  indefinite: TERMS.indefinite,
  particles: TERMS.particlesTopic,
};

/** Short rule shown after answering, by item kind. Grammar terms carry their Russian names. */
export const EXPLAIN: Record<string, string> = {
  kotoryi: 'который takes gender and number from the noun it refers to, and its case from its role in its own clause.',
  inf: 'чтобы + infinitive (инфинитив): the purpose has the same subject as the main clause (Я пришёл, чтобы помочь).',
  past: 'чтобы + past tense (прошедшее время): the subject is different (Скажи ей, чтобы ждала).',
  cond: 'Conditional (условное наклонение): past tense + бы; the past form agrees with the subject.',
  net: `нет / не было / не будет + genitive (${CASE_TERM.gen.ru}). Singular or plural can both be possible.`,
  nipron: `Negative pronouns (${TERMS.negativePronoun.ru}) decline like кто/что and need не with the verb (никого не вижу).`,
  'ne-ni': 'ни: “not a single”, ни … ни (neither … nor), ни с кем, ни разу; не: ordinary negation.',
  то: '-то: someone/something specific but unknown or unnamed (кто-то звонил).',
  нибудь: '-нибудь: anyone/anything, unspecified — questions, requests, the future, conditions.',
  либо: '-либо: like -нибудь, more formal or bookish.',
  koe: 'кое-: something the speaker knows but isn’t naming (мне надо кое-что сказать).',
  li: 'ли: yes/no questions and “whether” in indirect questions (не знаю, придёт ли он).',
  'zhe-ved:же': 'же: emphasis, “after all”, or “the same” (тот же).',
  'zhe-ved:ведь': 'ведь: “after all, you know” — appeals to something both people know.',
  'colloquial:вот': 'вот: “here is / there” — pointing or emphasis.',
  'colloquial:ну': 'ну: “well…”, hesitation or urging.',
  'colloquial:даже': 'даже: “even”.',
  'colloquial:только': 'только: “only, just”; как только = “as soon as”.',
  ka: '-ка softens an imperative (повелительное наклонение): дай-ка, скажи-ка.',
};

/** Which settings group a kind belongs to (negation kinds and particle groups). */
export function kindGroup(kind: string): string {
  if (kind.startsWith('zhe-ved')) return 'zhe-ved';
  if (kind.startsWith('colloquial') || kind === 'ka') return 'colloquial';
  return kind;
}

export function clozeQuestion(row: ClozeRow, topic: ClozeTopic): Question {
  const [id, ru, en, start, end, answer, hint, kind, options] = row;
  const before = ru.slice(0, start);
  const after = ru.slice(end);
  const frame = `${before}___${hint ? ` (${hint})` : ''}${after}`;
  return {
    key: `cz:${topic}:${id}:${start}`,
    mode: topic as Mode,
    headword: en,
    headwordIsEnglish: true,
    gloss: '',
    task: [TOPIC_TERM[topic]],
    frame,
    answer,
    others: [],
    label: `${TOPIC_TERM[topic].en} (${TOPIC_TERM[topic].ru})`,
    explain: EXPLAIN[kind],
    ...(options.length ? { choices: options } : {}),
    source: id,
    speak: (f) => `${before}${f.replace(/'/g, '')}${after}`,
  };
}

/**
 * Pick a kind first (uniformly among the allowed ones), then a sentence of that kind, so rare
 * kinds (чтобы + past, ну, -ка) aren't swamped by common ones.
 */
export function generateClozeQuestions(rows: ClozeRow[], topic: ClozeTopic, groups: string[] | null, n: number, rng: Rng): Question[] {
  const byKind = new Map<string, ClozeRow[]>();
  for (const r of rows) {
    if (groups && !groups.includes(kindGroup(r[7]))) continue;
    (byKind.get(r[7]) ?? byKind.set(r[7], []).get(r[7])!).push(r);
  }
  const kinds = [...byKind.keys()].sort();
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && kinds.length && guard++ < n * 50) {
    const q = clozeQuestion(pick(rng, byKind.get(pick(rng, kinds))!), topic);
    if (keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
