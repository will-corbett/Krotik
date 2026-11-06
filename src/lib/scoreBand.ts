/** Colour band for a score: <40 red, <60 orange, <80 yellow, 80+ green (CSS classes score-red … score-green). */
export type ScoreBand = 'red' | 'orange' | 'yellow' | 'green';
export function scoreBand(percent: number): ScoreBand {
  if (percent < 40) return 'red';
  if (percent < 60) return 'orange';
  if (percent < 80) return 'yellow';
  return 'green';
}
