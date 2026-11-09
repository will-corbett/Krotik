/**
 * Word order practice (public/data/word-order.json, reviewed items only): a question, and two orders of one answer;
 * choose the one that answers it naturally (the new information last).
 */
import type { WordOrderData } from '../../shared/types.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { Question } from '../types.ts';

export function generateWordOrderQuestions(data: WordOrderData, n: number, rng: Rng): Question[] {
  return shuffle(rng, data.items)
    .slice(0, n)
    .map(([q, qen, right, other, en]) => ({
      key: `wo:${q}`,
      mode: 'wordOrder',
      headword: q,
      gloss: qen,
      task: [TERMS.wordOrderTask],
      answer: right,
      choices: shuffle(rng, [right, other]),
      meaning: true,
      optionsLang: 'ru',
      others: [],
      label: TERMS.wordOrder.en,
      explain: `${en} The new information, what the question asks for, comes last.`,
      speak: () => right,
    }));
}
