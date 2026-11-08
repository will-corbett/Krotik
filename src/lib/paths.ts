/**
 * Learning paths (content/paths.yaml): a recommended route for each level through grammar (Learn + Drill),
 * vocabulary themes, reading and review. A guide, not a gate. With progress on, a step counts as done when its topic
 * has been drilled, half its theme's words are in your words, or (review drills) a round has been played; reading
 * isn't recorded, so it's never ticked.
 */
import type { Progress } from './progress.ts';
import type { MyWords } from './words.ts';
import type { Mode } from './types.ts';

export type PathLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type PathStep = ({ learn: string } | { vocab: string } | { read: string } | { drill: Mode } | { test: true }) & { why?: string };
export interface Path {
  level: PathLevel;
  title: string;
  intro: string;
  steps: PathStep[];
}

/** What a step is, for keys and links. */
export function stepKind(s: PathStep): { kind: 'learn' | 'vocab' | 'read' | 'drill' | 'test'; id: string } {
  if ('learn' in s) return { kind: 'learn', id: s.learn };
  if ('vocab' in s) return { kind: 'vocab', id: s.vocab };
  if ('read' in s) return { kind: 'read', id: s.read };
  if ('drill' in s) return { kind: 'drill', id: s.drill };
  return { kind: 'test', id: 'test' };
}

/**
 * Done, as far as Krotik can tell from the opt-in records: a topic drilled at least once; at least half a theme's words
 * in your words (`themeKeys` gives a theme's word keys); a review drill played. Reading and the test aren't recorded.
 */
export function stepDone(s: PathStep, progress: Progress, words: MyWords, themeKeys: (id: string) => string[] | undefined): boolean {
  const { kind, id } = stepKind(s);
  if (kind === 'learn' || kind === 'drill') return !!progress.topics[id as Mode]?.rounds;
  if (kind === 'vocab') {
    const keys = themeKeys(id);
    return !!keys?.length && keys.filter((k) => words.words[k]).length * 2 >= keys.length;
  }
  return false;
}

/** The first step of a path that isn't done and can be tracked (reading and the test are skipped over). */
export function nextStep(path: Path, done: (s: PathStep) => boolean): PathStep | undefined {
  return path.steps.find((s) => !done(s) && ['learn', 'vocab', 'drill'].includes(stepKind(s).kind));
}
