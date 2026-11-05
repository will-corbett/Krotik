import { describe, expect, it } from 'vitest';
import { answer, clearedCount, createRound, current, endRound, isFinished, isRetry, missed, score } from '../../src/lib/queue.ts';

describe('retry queue', () => {
  it('finishes after every question is answered correctly once', () => {
    let r = createRound(['a', 'b', 'c']);
    for (const _ of [1, 2, 3]) r = answer(r, true, 'x');
    expect(isFinished(r)).toBe(true);
    expect(score(r)).toEqual({ firstTry: 3, attempted: 3, total: 3, percent: 100 });
    expect(missed(r)).toEqual([]);
  });

  it('re-queues a wrong answer at the end, flagged as retry', () => {
    let r = createRound(['a', 'b', 'c']);
    r = answer(r, false, 'oops');
    expect(current(r)!.q).toBe('b');
    expect(isRetry(r)).toBe(false);
    r = answer(r, true, '');
    r = answer(r, true, '');
    expect(current(r)!.q).toBe('a');
    expect(isRetry(r)).toBe(true);
    expect(isFinished(r)).toBe(false);
    expect(clearedCount(r)).toBe(2);
  });

  it('re-queues repeated misses again and only scores first attempts', () => {
    let r = createRound(['a', 'b']);
    r = answer(r, false, 'w1'); // a wrong
    r = answer(r, true, ''); // b right
    r = answer(r, false, 'w2'); // a wrong again
    expect(current(r)!.q).toBe('a');
    r = answer(r, true, '');
    expect(isFinished(r)).toBe(true);
    expect(score(r)).toEqual({ firstTry: 1, attempted: 2, total: 2, percent: 50 });
    const m = missed(r);
    expect(m.map((e) => e.q)).toEqual(['a']);
    expect(m[0]!.wrong).toEqual(['w1', 'w2']);
    expect(m[0]!.attempts).toBe(3);
  });

  it('a retry answered correctly does not count as first-try correct', () => {
    let r = createRound(['a']);
    r = answer(r, false, 'x');
    r = answer(r, true, '');
    expect(score(r).firstTry).toBe(0);
  });

  it('End round stops early and scores only what was attempted', () => {
    let r = createRound(['a', 'b', 'c']);
    r = answer(r, true, '');
    r = endRound(r);
    expect(isFinished(r)).toBe(true);
    expect(current(r)).toBeNull();
    expect(score(r)).toEqual({ firstTry: 1, attempted: 1, total: 3, percent: 100 });
  });

  it('is immutable', () => {
    const r = createRound(['a']);
    answer(r, true, '');
    expect(r.queue).toEqual([0]);
  });
});
