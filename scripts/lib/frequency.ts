import { readFileSync } from 'node:fs';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { Report } from './report.ts';

/**
 * Checks whether source row order behaves like a frequency ranking, against an independent
 * word-form frequency list (OpenSubtitles 2018, hermitdave/FrequencyWords). A lemma's score
 * is the summed count of its distinct forms. Shared forms across lemmas (стали: стать/сталь)
 * inflate some scores, so this is a sanity check, not a re-ranking.
 */
export function loadFreq(path: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [w, c] = line.trim().split(' ');
    if (!w || !c) continue;
    const k = normalise(w);
    m.set(k, (m.get(k) ?? 0) + Number(c));
  }
  return m;
}

export function checkOrder(section: string, lemmas: { bare: string; cells: string[] }[], freq: Map<string, number>, report: Report, n = 2000) {
  const sample = lemmas.slice(0, n);
  const scores = sample.map((l) => {
    const forms = new Set([normalise(l.bare), ...l.cells.flatMap((c) => cellForms(c).map(normalise))]);
    let s = 0;
    for (const f of forms) s += freq.get(f) ?? 0;
    return s;
  });
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const freqRank = new Array<number>(sample.length);
  order.forEach(([, i], r) => (freqRank[i] = r));
  const N = sample.length;
  let d2 = 0;
  for (let i = 0; i < N; i++) d2 += (i - freqRank[i]!) ** 2;
  const rho = 1 - (6 * d2) / (N * (N * N - 1));
  const zero = scores.filter((s) => s === 0).length;
  report.note(section, `**Frequency check** (first ${N} kept lemmas vs OpenSubtitles word-form counts): Spearman ρ = ${rho.toFixed(2)}; ${zero} lemmas have no form in the 50k list.`);
  const lowInTop: string[] = [];
  for (let i = 0; i < Math.min(250, N); i++) if (freqRank[i]! > 1000) lowInTop.push(`${sample[i]!.bare} (#${i + 1} → #${freqRank[i]! + 1})`);
  const highLow: string[] = [];
  for (let i = 1000; i < N; i++) if (freqRank[i]! < 250) highLow.push(`${sample[i]!.bare} (#${i + 1} → #${freqRank[i]! + 1})`);
  if (lowInTop.length) report.anomaly(section, 'source top-250 but outside frequency top-1000', lowInTop.join(', '));
  if (highLow.length) report.anomaly(section, 'source rank > 1000 but frequency top-250', highLow.join(', '));
  return rho;
}
