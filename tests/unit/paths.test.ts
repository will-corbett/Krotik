/** Learning paths: every step points at something that exists, at a sensible level, and "done" follows the records. */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { nextStep, stepDone, stepKind, type Path } from '../../src/lib/paths.ts';
import { topicById, isDrill } from '../../src/lib/topics.ts';
import type { ReadingIndex, ThemeIndex } from '../../src/shared/types.ts';

const PATHS = parse(readFileSync('content/paths.yaml', 'utf8')) as Path[];
const themes = JSON.parse(readFileSync('public/data/themes.json', 'utf8')) as ThemeIndex;
const reading = JSON.parse(readFileSync('public/data/reading.json', 'utf8')) as ReadingIndex;
const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'];

describe('learning paths', () => {
  it('cover A1 to C1, in order', () => {
    expect(PATHS.map((p) => p.level)).toEqual(ORDER);
  });
  for (const p of PATHS) {
    it(`${p.level}: every step exists, and isn't from a later level`, () => {
      for (const s of p.steps) {
        const { kind, id } = stepKind(s);
        if (kind === 'learn') {
          const t = topicById(id);
          expect(t, id).toBeDefined();
          expect(t!.learn, id).not.toBe(false);
          expect(ORDER.indexOf(t!.level[0]), `${id} is first met at ${t!.level[0]}`).toBeLessThanOrEqual(ORDER.indexOf(p.level));
        } else if (kind === 'vocab') {
          const t = themes.themes.find((x) => x.id === id);
          expect(t, id).toBeDefined();
          expect(ORDER.indexOf(t!.level), `${id} is ${t!.level}`).toBeLessThanOrEqual(ORDER.indexOf(p.level));
        } else if (kind === 'read') {
          expect(reading.units.some((u) => u.id === id), id).toBe(true);
        } else if (kind === 'drill') {
          const t = topicById(id);
          expect(t && isDrill(t), id).toBe(true);
        }
      }
    });
  }
  it('every Vocabulary theme is on the path for its level', () => {
    for (const t of themes.themes) expect(PATHS.find((p) => p.level === t.level)!.steps.some((s) => 'vocab' in s && s.vocab === t.id), t.id).toBe(true);
  });
  it('tick a step when its topic was drilled or most of its theme is in your words; next is the first one not done', () => {
    const p = PATHS[0]!;
    const greet = themes.themes.find((t) => t.id === 'greetings')!;
    const progress = { v: 1 as const, topics: { alphabet: { rounds: 1, attempted: 10, right: 9, last: '2026-11-08', recent: [] } } };
    const half = Object.fromEntries(greet.keys.slice(0, Math.ceil(greet.keys.length / 2)).map((k) => [k, { b: 0, box: 0, due: '2026-11-08', added: '2026-11-08' }]));
    const words = { v: 1 as const, words: half };
    const keys = (id: string) => themes.themes.find((t) => t.id === id)?.keys;
    const done = (s: Path['steps'][number]) => stepDone(s, progress, words, keys);
    expect(done({ learn: 'alphabet' })).toBe(true);
    expect(done({ vocab: 'greetings' })).toBe(true);
    expect(done({ learn: 'sounds' })).toBe(false);
    expect(done({ read: 'kuritsa-i-lastochka' })).toBe(false);
    expect(nextStep(p, done)).toEqual(p.steps.find((s) => 'learn' in s && s.learn === 'sounds'));
  });
});
