/** Find the mistake: every answer is explained, from what the sentence shows where it can. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { explainFix } from '../../src/lib/fixExplain.ts';
import { generateFixQuestions } from '../../src/lib/questions/fix.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import type { LevelTestCandidate, LevelTestData } from '../../src/shared/types.ts';

const c = (ru: string, word: string, right: string, rightCode: string, wrong: string, wrongCode: string, kind = ''): LevelTestCandidate => {
  const start = ru.indexOf(word);
  return ['k', ru, 'en', start, start + word.length, 'x', right, [wrong], '', kind, rightCode, [wrongCode], 0];
};

describe('Find the mistake: why the answer is right', () => {
  it('names a preposition, and says when it takes another case for another meaning', () => {
    const t = explainFix(c('Они живут в одном государстве.', 'государстве', "госуда'рстве", 'n5', 'государству', 'n2'), 'государству');
    expect(t).toMatch(/^The right form is государстве \(prepositional singular\)\. After в, meaning “in, at \(where something is\)”, the noun takes the prepositional/);
    expect(t).toMatch(/With the accusative, в means something else\./);
    expect(t).toMatch(/«государству» is the dative singular\.$/);
  });
  it('after нет, a small number, or a verb’s subject', () => {
    expect(explainFix(c('У Тома нет коллег.', 'коллег', 'колле\'г', 'n7', 'коллегах', 'n11'), 'коллегах')).toContain('After нет');
    expect(explainFix(c('Почему ты спрашиваешь?', 'спрашиваешь', "спра'шиваешь", 'v1', "спра'шивает", 'v2'), "спра'шивает")).toContain('its subject, ты');
  });
  it('short forms and comparatives get their own rules', () => {
    expect(explainFix(c('Этот диван очень удобен.', 'удобен', "удо'бен", 'a26', "удо'бна", 'a27'), "удо'бна")).toContain('short adjective');
    expect(explainFix(c('Говорите громче!', 'громче', "гро'мче", 'a30', "гро'мкие", 'a19'), "гро'мкие")).toContain('never changes');
  });
  it('every question in the real data has an explanation', () => {
    const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as LevelTestData;
    const qs = generateFixQuestions(data, { levels: ['A1', 'A2', 'B1', 'B2', 'C1'] }, 5000, mulberry32(1));
    expect(qs.length).toBeGreaterThan(500);
    for (const q of qs) expect(q.explain, q.fix!.original).toMatch(/^The right form is .+\. .+/);
  });
});
