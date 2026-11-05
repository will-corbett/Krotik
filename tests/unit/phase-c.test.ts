import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ClozeRow } from '../../src/shared/types.ts';
import { checkAnswer } from '../../src/lib/check.ts';
import { clozeQuestion, explainFor, generateClozeQuestions, kindGroup, type ClozeTopic } from '../../src/lib/questions/cloze.ts';
import { mulberry32 } from '../../src/lib/rng.ts';

const TOPICS: ClozeTopic[] = ['kotoryi', 'chtoby', 'conditional', 'negation', 'indefinite', 'particles', 'prepositions', 'aspectContext', 'svoy', 'government', 'position', 'impersonal', 'comparison', 'conjunctions', 'time'];
const load = (t: ClozeTopic) => JSON.parse(readFileSync(`public/data/cloze.${t}.json`, 'utf8')) as ClozeRow[];

describe('sentence drill data integrity', () => {
  for (const t of TOPICS) {
    it(`${t}: every answer is the word actually in the sentence`, () => {
      const rows = load(t);
      expect(rows.length).toBeGreaterThan(250);
      for (const [id, ru, en, start, end, answer, hint, kind, options] of rows) {
        const blank = normalise(ru.slice(start, end));
        expect(cellForms(answer).map(normalise), `${id}`).toContain(blank);
        expect(en.length).toBeGreaterThan(0);
        expect(explainFor(kind), `explanation for ${kind}`).toBeTruthy();
        if (options.length) {
          expect(options.map(normalise), `${id}`).toContain(blank);
          expect(new Set(options).size).toBe(options.length);
        } else {
          expect(hint, `typed item ${id} needs a lemma hint`).toBeTruthy();
        }
      }
    });
  }
});

describe('sentence questions', () => {
  it('puts the blank and the lemma hint in the sentence', () => {
    const row: ClozeRow = [1, 'Скажи ему, чтобы оставил меня в покое.', 'Tell him to leave me alone.', 17, 24, "оста'вил", "оста'вить", 'past', []];
    const q = clozeQuestion(row, 'chtoby');
    expect(q.frame).toBe("Скажи ему, чтобы ___ (оста'вить) меня в покое.");
    expect(q.headword).toBe('Tell him to leave me alone.');
    expect(checkAnswer(q, 'оставил').correct).toBe(true);
    expect(checkAnswer(q, 'оставить').correct).toBe(false);
    expect(q.explain).toMatch(/different/);
    expect(q.speak("оста'вил")).toBe('Скажи ему, чтобы оставил меня в покое.');
  });
  it('multiple choice carries the options', () => {
    const row: ClozeRow = [2, 'Ты ведь любишь музыку?', 'You like music, don’t you?', 3, 7, 'ведь', '', 'zhe-ved:ведь', ['же', 'ведь', 'ли', 'бы']];
    const q = clozeQuestion(row, 'particles');
    expect(q.choices).toEqual(['же', 'ведь', 'ли', 'бы']);
    expect(checkAnswer(q, 'ведь').correct).toBe(true);
    expect(checkAnswer(q, 'же').correct).toBe(false);
  });
  it('нет accepts the other number too', () => {
    const net = load('negation').find((r) => r[7] === 'net' && r[5].includes('('))!;
    const q = clozeQuestion(net, 'negation');
    for (const f of cellForms(net[5])) expect(checkAnswer(q, f).correct).toBe(true);
  });
  it('balances kinds and respects the chosen groups', () => {
    const rows = load('particles');
    const qs = generateClozeQuestions(rows, 'particles', ['colloquial'], 40, mulberry32(1));
    expect(qs).toHaveLength(40);
    const kinds = new Set(qs.map((q) => rows.find((r) => `cz:particles:${r[0]}:${r[3]}` === q.key)![7]));
    for (const k of kinds) expect(kindGroup(k)).toBe('colloquial');
    expect(kinds.size).toBeGreaterThanOrEqual(4); // вот, ну, даже, только, -ка all get a share
    const neg = generateClozeQuestions(load('negation'), 'negation', ['ne-ni'], 10, mulberry32(2));
    for (const q of neg) expect(q.choices).toEqual(['не', 'ни']);
  });
  it('чтобы covers both infinitive and past-tense items', () => {
    const kinds = new Set(load('chtoby').map((r) => r[7]));
    expect(kinds).toEqual(new Set(['inf', 'past']));
  });
});
