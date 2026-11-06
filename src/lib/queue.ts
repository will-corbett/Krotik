/**
 * Round state with the retry rule: a wrong answer comes back RETRY_GAP cards later (or at the end,
 * if fewer cards are left), flagged retry, so it also comes back in unlimited rounds. The round only
 * finishes when every question has been answered correctly once.
 * Score = share answered correctly on the first attempt. Pure and immutable.
 */
export interface Entry<Q> {
  q: Q;
  attempts: number;
  firstTryCorrect: boolean | null;
  /** Wrong inputs, in order. */
  wrong: string[];
  cleared: boolean;
}

export interface Round<Q> {
  entries: Entry<Q>[];
  /** Indices into entries, front = current question. */
  queue: number[];
  ended: boolean;
}

export function createRound<Q>(questions: Q[]): Round<Q> {
  return {
    entries: questions.map((q) => ({ q, attempts: 0, firstTryCorrect: null, wrong: [], cleared: false })),
    queue: questions.map((_, i) => i),
    ended: false,
  };
}

export function current<Q>(r: Round<Q>): Entry<Q> | null {
  if (r.ended) return null;
  const i = r.queue[0];
  return i === undefined ? null : r.entries[i]!;
}

/** Is the current question a retry? */
export function isRetry<Q>(r: Round<Q>): boolean {
  return (current(r)?.attempts ?? 0) > 0;
}

/** How many cards later a missed card comes back. */
export const RETRY_GAP = 10;

export function answer<Q>(r: Round<Q>, correct: boolean, typed: string): Round<Q> {
  const [i, ...rest] = r.queue;
  if (i === undefined || r.ended) return r;
  const e = r.entries[i]!;
  const updated: Entry<Q> = {
    ...e,
    attempts: e.attempts + 1,
    firstTryCorrect: e.firstTryCorrect ?? correct,
    wrong: correct ? e.wrong : [...e.wrong, typed],
    cleared: correct,
  };
  const entries = r.entries.map((x, j) => (j === i ? updated : x));
  if (correct) return { entries, queue: rest, ended: false };
  const at = Math.min(RETRY_GAP, rest.length);
  return { entries, queue: [...rest.slice(0, at), i, ...rest.slice(at)], ended: false };
}

/** Append new questions (unlimited rounds). */
export function extendRound<Q>(r: Round<Q>, questions: Q[]): Round<Q> {
  const start = r.entries.length;
  return {
    entries: [...r.entries, ...questions.map((q) => ({ q, attempts: 0, firstTryCorrect: null, wrong: [], cleared: false }))],
    queue: [...r.queue, ...questions.map((_, i) => start + i)],
    ended: r.ended,
  };
}

export function endRound<Q>(r: Round<Q>): Round<Q> {
  return { ...r, ended: true };
}

export function isFinished<Q>(r: Round<Q>): boolean {
  return r.ended || r.queue.length === 0;
}

export function clearedCount<Q>(r: Round<Q>): number {
  return r.entries.filter((e) => e.cleared).length;
}

export interface Score {
  firstTry: number;
  /** Questions attempted at least once (an early "End round" can leave some unattempted). */
  attempted: number;
  total: number;
  percent: number;
}
export function score<Q>(r: Round<Q>): Score {
  const attempted = r.entries.filter((e) => e.attempts > 0);
  const firstTry = attempted.filter((e) => e.firstTryCorrect).length;
  return {
    firstTry,
    attempted: attempted.length,
    total: r.entries.length,
    percent: attempted.length ? Math.round((100 * firstTry) / attempted.length) : 0,
  };
}

/** Everything missed at least once. */
export function missed<Q>(r: Round<Q>): Entry<Q>[] {
  return r.entries.filter((e) => e.wrong.length > 0);
}
