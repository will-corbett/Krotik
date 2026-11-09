/** Every drill explains every answer: the question's own explanation, or the shared one (src/lib/explain.ts). */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { explainQuestion } from '../../src/lib/explain.ts';
import { prepareRound } from '../../src/lib/start.ts';
import { DEFAULTS } from '../../src/lib/settings.ts';
import { ALL_TOPICS, isDrill } from '../../src/lib/topics.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import type { Question } from '../../src/lib/types.ts';

beforeAll(() => {
  // The data files stand in for the network.
  (globalThis as { fetch: unknown }).fetch = async (url: string) => {
    const body = readFileSync(`public/data/${String(url).replace(/^.*\/data\//, '')}`, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
});

describe('every drill explains every answer', () => {
  for (const t of ALL_TOPICS.filter(isDrill)) {
    it(t.id, async () => {
      let qs: Question[];
      try {
        const gen = await prepareRound({ ...structuredClone(DEFAULTS), mode: t.id, band: 1, progress: false } as never, mulberry32(4));
        qs = gen(60);
      } catch (e) {
        // Drills whose items wait for recordings or a native speaker's review have nothing to ask yet.
        expect((e as Error).message).toMatch(/being collected|native speaker/);
        return;
      }
      for (const q of qs) expect(q.explain, `${t.id}: ${q.label} → ${q.answer}`).toBeTruthy();
    }, 60_000);
  }
});

describe('the shared explanations', () => {
  const q = (o: Partial<Question>): Question => ({ key: 'k', mode: 'verbs', headword: '', gloss: '', task: [], answer: '', others: [], label: '', speak: () => '', ...o }) as Question;
  it('verbs: the conjugation from the ты form, and a consonant that changes only in the я form', () => {
    const verb = { id: 1, accented: "носи'ть", gloss: '', aspect: 'impf' as const, partners: [], cells: ["ношу'", "но'сишь", "но'сит", "но'сим", "но'сите", "но'сят", '', '', '', '', '', ''], band: 0 };
    const t = explainQuestion(q({ label: 'Present, я form (настоящее время)', headword: "носи'ть", answer: "ношу'", paradigm: { kind: 'verb', verb } }));
    expect(t).toContain('second-conjugation verb (ты носишь)');
    expect(t).toContain('the consonant changes (ношу, but носишь)');
  });
  it('short forms and adjectives name the ending, from the stem', () => {
    expect(explainQuestion(q({ mode: 'short', label: 'Short form, plural (краткая форма, множественное число)', headword: "я'сный", answer: "ясны'" }))).toContain('Here ясны (-ы)');
    expect(explainQuestion(q({ mode: 'adjectives', label: 'Instrumental masculine singular (творительный падеж …)', headword: "за'втрашний", frame: "___ враго'м", answer: "за'втрашним", paradigm: { kind: 'adjective' } as never }))).toBe(
      'An adjective agrees with its noun in gender, number and case: here with врагом, instrumental masculine singular, ending -им.',
    );
  });
  it('a pronoun after a preposition: the reason, and н- only for он, она, оно, они', () => {
    const k = explainQuestion(q({ mode: 'pronouns', label: 'Dative, after a preposition (дательный падеж)', headword: 'он', frame: 'к ___', answer: "нему'" }))!;
    expect(k).toMatch(/^After к, meaning “to, towards/);
    expect(k).toContain('add н-');
    expect(explainQuestion(q({ mode: 'pronouns', label: 'Instrumental, after a preposition (творительный падеж)', headword: 'кто', frame: 'с ___', answer: "кем" }))).not.toContain('add н-');
  });
  it('minimal pairs: the sound the pair turns on', () => {
    expect(explainQuestion(q({ mode: 'pairs', choices: ["отбыва'ть", "отбива'ть"], answer: "отбыва'ть" }))).toContain('ы is said further back');
    expect(explainQuestion(q({ mode: 'pairs', choices: ['брат', 'брать'], answer: 'брать' }))).toContain('soft sign');
  });
});
