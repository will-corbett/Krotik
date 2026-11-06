import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClozeRow, MotionData } from '../../src/shared/types.ts';
import { VERB_CELLS } from '../../src/shared/cells.ts';
import { toVerb } from '../../src/lib/data.ts';
import { generateClozeQuestions, kindTense } from '../../src/lib/questions/cloze.ts';
import { generateMotionQuestions } from '../../src/lib/questions/motion.ts';
import { mulberry32 } from '../../src/lib/rng.ts';

const json = <T>(f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;

describe('choosing tenses', () => {
  it('aspect in context and verbs of position: every sentence is tagged with its verb’s tense', () => {
    for (const topic of ['aspectContext', 'position']) {
      const rows = json<ClozeRow[]>(`cloze.${topic}.json`);
      for (const r of rows) expect(['presfut', 'past', 'imperative', 'inf'], r[7]).toContain(kindTense(r[7]));
    }
  });
  it('only the chosen tenses are asked', () => {
    const rows = json<ClozeRow[]>('cloze.aspectContext.json');
    const qs = generateClozeQuestions(rows, 'aspectContext', null, 30, mulberry32(3), ['past']);
    expect(qs.length).toBe(30);
    const byId = new Map(rows.map((r) => [`cz:aspectContext:${r[0]}:${r[3]}`, r]));
    for (const q of qs) expect(kindTense(byId.get(q.key)![7])).toBe('past');
  });
  it('motion verbs: conjugation only in the chosen tenses', () => {
    const motion = json<MotionData>('motion.json');
    const vmap = new Map(motion.verbs.map((r) => [r[0], toVerb(r, 0)]));
    const qs = generateMotionQuestions(motion.pairs, vmap, { types: ['conjugate'], groups: ['past'] }, 20, mulberry32(4));
    expect(qs.length).toBeGreaterThan(5);
    for (const q of qs) {
      const cell = Number(q.key.split(':').at(-1));
      expect(VERB_CELLS[cell]!.group).toBe('past');
    }
  });
  it('чтобы: infinitive or past only, as chosen', () => {
    const rows = json<ClozeRow[]>('cloze.chtoby.json');
    const qs = generateClozeQuestions(rows, 'chtoby', ['past'], 20, mulberry32(5));
    expect(qs.length).toBe(20);
    for (const q of qs) expect(q.explain).toMatch(/past tense/);
  });
});
