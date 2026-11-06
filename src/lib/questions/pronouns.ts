import { ADJ_CELLS, CASES, type Case } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import { partnerPicker, type PartnerPicker } from '../pairs.ts';
import type { PersonalRow, PronounData } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, TERMS, type TaskPart } from '../terms.ts';
import type { Noun, PossessiveSettings, PronounSettings, Question } from '../types.ts';
import { adjectiveQuestion } from './adjectives.ts';

/**
 * One common preposition per case, to show the н- forms (у него, к ней…). я takes the extended
 * preposition forms ко мне, обо мне — a fixed spelling rule.
 */
export const PREP: Record<Exclude<Case, 'nom'>, string> = { gen: 'у', dat: 'к', acc: 'про', inst: 'за', prep: 'о' };
function prepFor(pronoun: string, c: Exclude<Case, 'nom'>): string {
  const p = bare(pronoun);
  if (p === 'я' && c === 'dat') return 'ко';
  if (p === 'я' && c === 'prep') return 'обо';
  if (p === 'что' && c === 'prep') return 'о';
  return PREP[c];
}

const GLOSS: Record<string, string> = {
  я: 'I', ты: 'you (singular, informal)', он: 'he, it', оно: 'it', она: 'she, it', мы: 'we', вы: 'you (plural, formal)',
  они: 'they', себя: 'oneself (reflexive)', кто: 'who', что: 'what',
};

export function personalQuestion(row: PersonalRow, c: Exclude<Case, 'nom'>, afterPrep: boolean): Question | null {
  const [who, plainCells, prepCells] = row;
  const i = CASES.indexOf(c);
  const answer = (afterPrep ? prepCells : plainCells)[i];
  if (!answer) return null;
  const prep = prepFor(who, c);
  const task: TaskPart[] = [CASE_TERM[c]];
  if (afterPrep) task.push(TERMS.afterPrep);
  const headword = who || 'себя';
  return {
    key: `pr:${bare(headword)}:${c}:${afterPrep ? 'p' : ''}`,
    mode: 'pronouns',
    headword,
    gloss: GLOSS[bare(headword)] ?? '',
    task,
    frame: afterPrep ? `${prep} ___` : '___',
    answer,
    others: CASES.map((x, j) => ({ label: `${CASE_TERM[x].en} (${CASE_TERM[x].ru})`, cell: plainCells[j]!, j }))
      .filter((o) => o.j !== i && o.cell)
      .map(({ label, cell }) => ({ label, cell })),
    label: `${CASE_TERM[c].en}${afterPrep ? ', after a preposition' : ''} (${CASE_TERM[c].ru})`,
    explain:
      afterPrep && plainCells[i] !== prepCells[i]
        ? 'After a preposition, он/она/оно/они take н-: у него, к ней, с ними (not after derived prepositions like благодаря).'
        : undefined,
    paradigm: {
      kind: 'list',
      rows: CASES.map((x, j) => ({ label: [CASE_TERM[x]] as TaskPart[], cell: plainCells[j]! })).concat(
        prepCells.some((p, j) => p !== plainCells[j]) ? [{ label: [TERMS.afterPrep], cell: prepCells.filter((p, j) => p !== plainCells[j]).join(',') }] : [],
      ).filter((r) => r.cell),
    },
    speak: (f) => (afterPrep ? `${prep} ${bare(f)}` : bare(f)),
  };
}

export function generatePronounQuestions(data: PronounData, s: PronounSettings, n: number, rng: Rng): Question[] {
  const cases = s.cases.filter((c): c is Exclude<Case, 'nom'> => c !== 'nom');
  const out: Question[] = [];
  const keys = new Set<string>();
  if (!cases.length || !s.prepositions.length) return out;
  let guard = 0;
  while (out.length < n && guard++ < n * 100) {
    const q = personalQuestion(pick(rng, data.personal), pick(rng, cases), pick(rng, s.prepositions) === 'afterPrep');
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}

const POSS_GLOSS: Record<string, string> = {
  мой: 'my', твой: 'your (singular)', свой: 'one’s own', наш: 'our', ваш: 'your (plural, formal)', этот: 'this', тот: 'that',
  весь: 'all, the whole', чей: 'whose', сам: '-self (emphatic: сам директор)',
};

export function possessiveQuestion(row: [string, string[]], noun: Noun, c: Case, plural: boolean): Question | null {
  if (row[1].length !== ADJ_CELLS.length) return null;
  const pseudo = { id: 0, accented: row[0], gloss: POSS_GLOSS[bare(row[0])] ?? '', cells: row[1], extra: [], band: 0 };
  const q = adjectiveQuestion(pseudo, noun, c, plural);
  if (!q) return null;
  return { ...q, key: `poss:${bare(row[0])}:${noun.id}:${c}:${plural ? 'p' : 's'}`, mode: 'possessives', sentence: undefined };
}

export function generatePossessiveAgreement(data: PronounData, nouns: Noun[], n: number, rng: Rng, partner: PartnerPicker = partnerPicker(undefined, nouns)): Question[] {
  const gendered = nouns.filter((x) => x.gender);
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && gendered.length && guard++ < n * 100) {
    const row = pick(rng, data.possessive);
    const noun = partner({ adj: row[0] }, rng);
    const q = noun ? possessiveQuestion(row, noun, pick(rng, CASES), rng() < 0.35) : null;
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}

export type { PossessiveSettings };
