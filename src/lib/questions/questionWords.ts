/** Question words (вопросительные местоимения): кто/что in every case, чей/какой agreeing with a noun, and real questions. */
import { CASES, type Case } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import type { ClozeRow, PronounData } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { Adjective, Noun, Question, QuestionWordSettings } from '../types.ts';
import { clozeQuestion } from './cloze.ts';
import { personalQuestion, possessiveQuestion } from './pronouns.ts';

const GLOSS: Record<string, string> = { чей: 'whose', какой: 'which, what kind of' };

export interface QuestionWordData {
  pronouns: PronounData;
  kakoy: Adjective | undefined;
  nouns: Noun[];
  cloze: ClozeRow[];
}

/** кто / что in one case; the prepositional is always shown after о (о ком, о чём). */
function ktoChtoQuestion(data: QuestionWordData, rng: Rng): Question | null {
  const rows = data.pronouns.personal.filter(([w]) => ['кто', 'что'].includes(bare(w)));
  if (!rows.length) return null;
  const c = pick(rng, CASES.filter((x) => x !== 'nom')) as Exclude<Case, 'nom'>;
  const q = personalQuestion(pick(rng, rows), c, c === 'prep');
  return q && { ...q, key: `qw:${q.key}`, mode: 'questionWords', explain: 'кто and что decline like pronouns: кого, кому, кем, о ком; чего, чему, чем, о чём.' };
}

/** чей / какой agreeing with a noun (чью книгу, в каком доме). */
function agreeQuestion(data: QuestionWordData, rng: Rng): Question | null {
  const chey = data.pronouns.possessive.find(([w]) => bare(w) === 'чей');
  const rows: [string, string[]][] = [...(chey ? [chey] : []), ...(data.kakoy ? [[data.kakoy.accented, data.kakoy.cells] as [string, string[]]] : [])];
  const nouns = data.nouns.filter((x) => x.gender);
  if (!rows.length || !nouns.length) return null;
  const row = pick(rng, rows);
  const q = possessiveQuestion(row, pick(rng, nouns), pick(rng, CASES), rng() < 0.3);
  return q && { ...q, key: `qw:${q.key}`, mode: 'questionWords', gloss: GLOSS[bare(row[0])] ?? q.gloss };
}

export function generateQuestionWordQuestions(data: QuestionWordData, s: QuestionWordSettings, n: number, rng: Rng): Question[] {
  const types = s.types.filter((t) => t !== 'sentence' || data.cloze.length);
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && types.length && guard++ < n * 50) {
    const t = pick(rng, types);
    const q = t === 'sentence' ? clozeQuestion(pick(rng, data.cloze), 'questionWords') : rng() < 0.5 ? ktoChtoQuestion(data, rng) : agreeQuestion(data, rng);
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
