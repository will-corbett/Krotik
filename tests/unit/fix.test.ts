/** Find the mistake: a real sentence with one checked wrong form of the same word; tap it, type the right form. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../../src/lib/check.ts';
import { fixPieces, fixQuestion, generateFixQuestions } from '../../src/lib/questions/fix.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import type { LevelTestData } from '../../src/shared/types.ts';
import { normalise } from '../../src/shared/normalise.ts';

const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as LevelTestData;

describe('find the mistake', () => {
  it('puts the wrong form in place of the right one, keeping a sentence-initial capital', () => {
    expect(fixPieces('Вы остановитесь.', 3, 15, "остано'вится")).toEqual({ pieces: [{ text: 'Вы', word: 0 }, { text: ' ' }, { text: 'остановится', word: 1 }, { text: '.' }], wrongWord: 1 });
    expect(fixPieces('Слушайте его!', 0, 8, "слу'шаете").pieces[0]).toEqual({ text: 'Слушаете', word: 0 });
  });
  it('uses only form-of-the-word items, and the right form is the answer', () => {
    const qs = generateFixQuestions(data, { levels: ['A1', 'A2', 'B1', 'B2', 'C1'] }, 200, mulberry32(4));
    expect(qs.length).toBe(200);
    for (const q of qs) {
      const wrongPiece = q.fix!.pieces.find((p) => p.word === q.fix!.wrong)!;
      expect(normalise(wrongPiece.text)).toBe(normalise(q.fix!.wrongForm));
      expect(checkAnswer(q, q.fix!.wrongForm).correct, q.key).toBe(false);
      expect(normalise(q.fix!.original)).toContain(normalise(q.answer.split(',')[0]!.replace(/[()]/g, '')));
    }
    // A choice item (no word in brackets) is never used.
    const choice = data.slots.flatMap((s) => s.items).find((c) => !c[5])!;
    expect(fixQuestion(choice, 'B1', mulberry32(1))).toBeNull();
  });
  it('keeps to the chosen levels', () => {
    for (const q of generateFixQuestions(data, { levels: ['B2'] }, 30, mulberry32(1))) expect(q.label).toMatch(/\(B2\)$/);
  });
});
