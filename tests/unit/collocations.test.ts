/** Words that go together (critique batch 5): pairs found in real sentences, and fair "Which verb?" options. */
import { describe, expect, it } from 'vitest';
import { NOUN_INDEX } from '../../src/shared/cells.ts';
import { buildVerbNoun } from '../../scripts/lib/verbNoun.ts';
import { Report } from '../../scripts/lib/report.ts';
import { generateCollocationQuestions } from '../../src/lib/questions/collocations.ts';
import { pairsFor, pairsWithNouns } from '../../src/lib/collocations.ts';
import { mulberry32 } from '../../src/lib/rng.ts';

// Twelve verb cells (present 1sg…3pl, past m f n pl, imperative sg pl): only the past masculine matters here.
const verb = (id: number, bare: string, past: string, aspect: 'pf' | 'impf' = 'pf') => ({
  id,
  bare,
  accented: bare,
  gloss: '',
  aspect,
  partners: [],
  cells: ['', '', '', '', '', '', past, '', '', '', '', ''],
});
const noun = (id: number, bare: string, acc: string) => {
  const cells = Array(12).fill('');
  cells[NOUN_INDEX.sg_nom] = bare;
  cells[NOUN_INDEX.sg_acc] = acc;
  return { id, bare, accented: bare, gloss: '', gender: 'n' as const, animate: false, sgOnly: false, cells };
};
const verbs = [verb(1, 'принять', "при'нял"), verb(2, 'задать', "за'дал"), verb(3, 'оказать', "оказа'л"), verb(4, 'привлечь', "привлёк"), verb(5, 'одержать', "одержа'л"), verb(6, 'сделать', "сде'лал")];
const nouns = [noun(10, 'решение', "реше'ние"), noun(11, 'вопрос', "вопро'с"), noun(12, 'помощь', "по'мощь"), noun(13, 'победа', "побе'ду")];
function corpus(sentences: [number, string, string][]) {
  const owners = new Map<string, Set<string>>();
  const masks = new Map<string, number>();
  const own = (form: string, owner: string, mask: number) => {
    owners.set(form, new Set([owner]));
    masks.set(`${form}|${owner}`, mask);
  };
  own('принял', 'verbs:1', 1 << 6);
  own('задал', 'verbs:2', 1 << 6);
  own('оказал', 'verbs:3', 1 << 6);
  own('привлек', 'verbs:4', 1 << 6);
  own('одержал', 'verbs:5', 1 << 6);
  own('сделал', 'verbs:6', 1 << 6);
  own('решение', 'nouns:10', (1 << NOUN_INDEX.sg_nom) | (1 << NOUN_INDEX.sg_acc));
  own('вопрос', 'nouns:11', (1 << NOUN_INDEX.sg_nom) | (1 << NOUN_INDEX.sg_acc));
  return { pairs: sentences.map(([rid, ru, en]) => ({ rid, ru, en })), owners, masks, capitalisedMid: new Set() };
}

describe('words that go together', () => {
  const entries = [
    { noun: 'решение', verbs: ['принять'], en: 'make a decision' },
    { noun: 'вопрос', verbs: ['задать'], en: 'ask a question' },
    { noun: 'вопрос', verbs: ['привлечь'], en: 'never in a sentence' },
    // Not in any sentence either, but their verbs can be wrong options for the others.
    { noun: 'помощь', verbs: ['оказать'], en: 'give help' },
    { noun: 'победа', verbs: ['одержать'], en: 'win a victory' },
  ];
  const data = buildVerbNoun({
    corpus: corpus([
      [1, 'Я принял решение.', 'I made a decision.'],
      [2, 'Решение он принял быстро.', 'He made the decision quickly.'],
      [3, 'Том задал вопрос.', 'Tom asked a question.'],
      [4, 'Том одержал, вопрос.', 'Punctuation between: not a pair.'],
    ]),
    verbs: verbs as never,
    nouns: nouns as never,
    entries,
    report: new Report(),
  });
  it('keeps only pairs found in a sentence, either way round, with no punctuation between', () => {
    expect(data.pairs.map((p) => p.phrase)).toEqual(["принять реше'ние", "задать вопро'с"]);
    expect(data.pairs[0]!.sentences).toBe(2);
  });
  it('gaps the verb; the wrong options are the same form of listed verbs never used with the noun, and never generic ones', () => {
    for (const [pi, , ru, , s, e, options] of data.items) {
      expect(options).toContain(ru.slice(s, e));
      expect(new Set(options).size).toBe(options.length);
      expect(options).not.toContain('сделал');
      if (data.pairs[pi]!.phrase === 'задать вопрос') expect(options).not.toContain('привлёк');
    }
  });
  it('makes questions with the English as the cue, and lists pairs by verb or by a theme’s nouns', () => {
    const qs = generateCollocationQuestions(data, 5, mulberry32(1));
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q).toMatchObject({ mode: 'collocations', headwordIsEnglish: true });
    expect(pairsFor(data, ['задать']).map((p) => p.phrase)).toEqual(["задать вопро'с"]);
    expect(pairsWithNouns(data, new Set(['n:10'])).map((p) => p.phrase)).toEqual(["принять реше'ние"]);
  });
});
