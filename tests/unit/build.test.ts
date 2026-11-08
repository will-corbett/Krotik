/** Build the sentence: the words of a real sentence, shuffled; the original order is right, others self-marked. */
import { describe, expect, it } from 'vitest';
import { buildLength, buildQuestion, generateBuildQuestions, wordsOf } from '../../src/lib/questions/build.ts';
import { sameSentence } from '../../src/lib/questions/translate.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { SentenceRow } from '../../src/shared/types.ts';

const row = (id: number, ru: string, en = 'x'): SentenceRow => [id, ru, en, 0, 0, 0];

describe('build the sentence', () => {
  it('takes the words without punctuation, names keep their capital', () => {
    expect(wordsOf('Том, я спрошу у Тома!')).toEqual(['Том', 'я', 'спрошу', 'у', 'Тома']);
    expect(buildLength('Я спрошу у Тома.')).toBe('short');
    expect(buildLength('Я тебя люблю, а ты меня нет, и это очень грустно.')).toBeNull();
    expect(buildLength('Он сказал — нет.')).toBeNull();
  });
  it('never offers the words already in order, and the original order is marked right', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = buildQuestion(row(1, 'Я спрошу у Тома.', "I'll ask Tom."), mulberry32(seed))!;
      expect(q.build!.join(' ')).not.toBe('Я спрошу у Тома');
      expect([...q.build!].sort()).toEqual(['Тома', 'Я', 'спрошу', 'у'].sort());
      expect(q).toMatchObject({ mode: 'build', headword: "I'll ask Tom.", answer: 'Я спрошу у Тома.', selfMark: true });
    }
    expect(sameSentence('Я спрошу у Тома', 'Я спрошу у Тома.', normalise)).toBe(true);
    expect(sameSentence('У Тома я спрошу', 'Я спрошу у Тома.', normalise)).toBe(false);
  });
  it('keeps to the chosen lengths, once per sentence', () => {
    const rows = [row(1, 'Я спрошу у Тома.'), row(1, 'Я спрошу у Тома.'), row(2, 'Мы долго гуляли в парке вчера вечером.'), row(3, 'Да.')];
    expect(generateBuildQuestions(rows, { lengths: ['short'] }, 10, mulberry32(1)).map((q) => q.source)).toEqual([1]);
    expect(generateBuildQuestions(rows, { lengths: ['short', 'long'] }, 10, mulberry32(1))).toHaveLength(2);
  });
});
