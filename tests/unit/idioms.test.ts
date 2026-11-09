/** Idioms and proverbs: Wiktionary's, kept only when a real sentence uses them; the verb may be in any form. */
import { describe, expect, it } from 'vitest';
import { buildIdioms, shortGloss } from '../../scripts/lib/idioms.ts';
import { Report } from '../../scripts/lib/report.ts';
import { generateIdiomQuestions } from '../../src/lib/questions/idioms.ts';
import { mulberry32 } from '../../src/lib/rng.ts';

const pairs = [
  { rid: 1, ru: 'Не вешай мне лапшу на уши!', en: "Don't pull my leg!" },
  { rid: 2, ru: 'Это капля в море, конечно.', en: "It's a drop in the ocean." },
  { rid: 3, ru: 'Куй железо, пока горячо.', en: 'Strike while the iron is hot.' },
  { rid: 4, ru: 'Он купил новую головную боль.', en: 'Literal, and left out by hand.' },
];
const verbForms = new Map([['вешать', new Set(['вешать', 'вешаю', 'вешай', 'вешает'])]]);
const wk: [string, string, string, string[]][] = [
  ['вешать лапшу на уши', 'ве́шать лапшу́ на́ уши', 'to deceive', ['idiomatic']],
  ['капля в море', 'ка́пля в мо́ре', 'a drop in the bucket', ['idiomatic']],
  ['куй железо, пока горячо', 'куй желе́зо', 'strike while the iron is hot', ['proverb']],
  ['головная боль', 'головна́я боль', 'pain in the neck', ['idiomatic']],
  ['гром среди ясного неба', 'гром среди́ я́сного не́ба', 'a bolt from the blue', ['idiomatic']],
];

describe('idioms', () => {
  const data = buildIdioms({ idioms: wk, pairs, verbForms, curated: { exclude: { 'головная боль': 'literal' }, gloss: { 'вешать лапшу на уши': "to pull someone's leg" } }, report: new Report() });
  it('keeps an idiom only when a sentence uses it (a verb in any form, one word between allowed)', () => {
    expect(data.idioms.map((x) => x[0].replace(/'/g, ''))).toEqual(['вешать лапшу на уши', 'капля в море', 'куй железо, пока горячо']);
    const lapsha = data.idioms.find((x) => x[0].startsWith('ве'))!;
    expect(lapsha[1]).toBe("to pull someone's leg");
    const [, ru, , s, e] = lapsha[3][0]!;
    expect(ru.slice(s, e)).toBe('вешай мне лапшу на уши');
  });
  it('a proverb keeps its whole wording when the stress-marked form is cut short', () => {
    expect(data.idioms.find((x) => x[2] === 1)![0]).toBe('куй железо, пока горячо');
    expect(shortGloss('to read between the lines (to infer a meaning); to guess')).toBe('to read between the lines');
  });
  it('asks what an idiom means, with other idioms’ meanings as the wrong options', () => {
    const qs = generateIdiomQuestions(data, { kinds: ['idioms'] }, 5, mulberry32(1));
    expect(qs).toHaveLength(2);
    for (const q of qs) expect(q.choices).toContain(q.answer);
    expect(qs.find((q) => q.headword.startsWith('ве'))!.note).toBe('Не «вешай мне лапшу на уши»!');
    expect(generateIdiomQuestions(data, { kinds: ['proverbs'] }, 5, mulberry32(1))).toHaveLength(1);
  });
});
