/**
 * Idioms and proverbs (public/data/idioms.json): the idiom, highlighted in a real sentence; choose what it means from
 * four meanings (the wrong ones are other idioms', of the same kind: idioms with idioms, proverbs with proverbs).
 */
import type { IdiomData } from '../../shared/types.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { IdiomSettings, Question } from '../types.ts';

export function generateIdiomQuestions(data: IdiomData, s: IdiomSettings, n: number, rng: Rng): Question[] {
  const pool = data.idioms.filter((x) => s.kinds.includes(x[2] ? 'proverbs' : 'idioms'));
  return shuffle(rng, pool)
    .slice(0, n)
    .map(([phrase, meaning, proverb, examples]) => {
      const [rid, ru, en, start, end] = examples[Math.floor(rng() * examples.length)]!;
      const wrong = shuffle(rng, data.idioms.filter((x) => x[2] === proverb && x[1] !== meaning).map((x) => x[1]));
      const choices = shuffle(rng, [meaning, ...[...new Set(wrong)].slice(0, 3)]);
      return {
        key: `id:${phrase}`,
        mode: 'idioms',
        headword: phrase,
        gloss: '',
        task: [TERMS.idiomTask],
        // The sentence, with the idiom in «», unless the sentence is just the idiom (as a proverb usually is).
        ...(/[А-ЯЁа-яё]/.test(ru.slice(0, start) + ru.slice(end)) ? { note: `${ru.slice(0, start)}«${ru.slice(start, end)}»${ru.slice(end)}` } : {}),
        answer: meaning,
        choices,
        meaning: true,
        others: [],
        label: TERMS.idioms.en,
        explain: `${ru} (${en})`,
        source: rid,
        speak: () => ru,
      } satisfies Question;
    });
}
