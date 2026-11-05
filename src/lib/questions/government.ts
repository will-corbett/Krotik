import { bare } from '../../shared/forms.ts';
import { pick, shuffle, type Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { Question } from '../types.ts';
import { PATTERN_LABEL } from './cloze.ts';

export type GovRow = [number, string, string, string]; // [verb id, accented, pattern, English]

/** Which case (or preposition + case) does the verb take? Multiple choice from the hand-made list. */
export function governmentChoiceQuestion(row: GovRow, all: GovRow[], rng: Rng): Question {
  const [id, accented, pattern, en] = row;
  // Never offer another pattern the same verb also takes (отвечать кому / на что) as a wrong answer.
  const own = new Set(all.filter((r) => r[0] === id).map((r) => r[2]));
  const distractors = shuffle(rng, Object.keys(PATTERN_LABEL).filter((p) => !own.has(p))).slice(0, 3);
  const options = shuffle(rng, [pattern, ...distractors]).map((p) => PATTERN_LABEL[p]!);
  return {
    key: `gov:${id}:${pattern}`,
    mode: 'government',
    headword: accented,
    gloss: en,
    task: [TERMS.government],
    answer: PATTERN_LABEL[pattern]!,
    choices: options,
    others: [],
    label: `${bare(accented)} ${PATTERN_LABEL[pattern]}`,
    explain: `${bare(accented)} ${PATTERN_LABEL[pattern]} — ${en}. The list of verbs and cases is hand-made; examples are checked in Tatoeba.`,
    speak: () => bare(accented),
  };
}

export function generateGovernmentChoice(rows: GovRow[], n: number, rng: Rng): Question[] {
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && rows.length && guard++ < n * 30) {
    const q = governmentChoiceQuestion(pick(rng, rows), rows, rng);
    if (keys.has(q.key) && keys.size < rows.length) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
