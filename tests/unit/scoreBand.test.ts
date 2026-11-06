import { describe, expect, it } from 'vitest';
import { scoreBand } from '../../src/lib/scoreBand.ts';

describe('score colours', () => {
  it('<40 red, <60 orange, <80 yellow, 80+ green', () => {
    expect([0, 39, 40, 59, 60, 79, 80, 86, 100].map(scoreBand)).toEqual(['red', 'red', 'orange', 'orange', 'yellow', 'yellow', 'green', 'green', 'green']);
  });
});
