/**
 * Words that go together (public/data/verb-noun.json): a real sentence with its verb gapped and its English as the
 * cue; choose the verb that goes with the noun (принять решение, not *сделать решение). The wrong options are the same
 * form of other verbs from the list that are never used with that noun.
 */
import type { CollocationData } from '../../shared/types.ts';
import { renderForm } from '../../shared/forms.ts';
import { TERMS } from '../terms.ts';
import { shuffle, type Rng } from '../rng.ts';
import type { Question } from '../types.ts';

export function generateCollocationQuestions(data: CollocationData, n: number, rng: Rng): Question[] {
  // One item per pair at a time, so a round meets as many pairs as it can.
  const byPair = new Map<number, CollocationData['items']>();
  for (const it of data.items) byPair.set(it[0], [...(byPair.get(it[0]) ?? []), it]);
  const out: Question[] = [];
  for (const items of shuffle(rng, [...byPair.values()])) {
    if (out.length >= n) break;
    const [pi, rid, ru, en, start, end, options] = items[Math.floor(rng() * items.length)]!;
    const pair = data.pairs[pi]!;
    out.push({
      key: `vn:${rid}:${start}`,
      mode: 'collocations',
      headword: en,
      headwordIsEnglish: true,
      gloss: '',
      task: [TERMS.collocTask],
      frame: `${ru.slice(0, start)}___${ru.slice(end)}`,
      answer: ru.slice(start, end),
      choices: shuffle(rng, options),
      others: [],
      label: TERMS.collocations.en,
      explain: `${renderForm(pair.phrase, true)}: ${pair.en}${pair.verbs.length > 1 ? ` (also ${renderForm(pair.verbs[0]![1], true)}, imperfective)` : ''}.`,
      source: rid,
      speak: () => ru,
    });
  }
  return out;
}
