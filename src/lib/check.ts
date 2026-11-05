import { cellForms, cellMatches } from '../shared/forms.ts';
import { normalise } from '../shared/normalise.ts';
import type { Question } from './types.ts';

export interface CheckResult {
  correct: boolean;
  /** If wrong: the label of another form of the same word that the input equals. */
  otherForm?: string;
}

export function checkAnswer(q: Pick<Question, 'answer' | 'others'>, input: string): CheckResult {
  if (cellMatches(q.answer, input)) return { correct: true };
  const n = normalise(input);
  if (!n) return { correct: false };
  const answerSet = new Set(cellForms(q.answer).map(normalise));
  const hits = q.others.filter((o) => {
    const forms = cellForms(o.cell).map(normalise);
    // Skip cells that share a form with the answer (e.g. f gen/dat/prep "новой"): not "a different form".
    return !forms.some((f) => answerSet.has(f)) && forms.includes(n);
  });
  return hits.length ? { correct: false, otherForm: hits.map((h) => h.label).join(' / ') } : { correct: false };
}
