import { NOUN_CELLS, type Gender } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cleanCell } from './cell.ts';
import { cleanGloss } from './glosses.ts';
import type { TypeOverrides } from './overrides.ts';
import type { Report } from './report.ts';

export interface Noun {
  id: number;
  bare: string;
  accented: string;
  gloss: string;
  gender: Gender;
  animate: 0 | 1;
  sgOnly: 0 | 1;
  cells: string[]; // NOUN_CELLS order; plural cells "" when sgOnly
}
const S = 'Nouns';

export function cleanNouns(raw: Record<string, string>[], rowIds: Map<Record<string, string>, number>, ov: TypeOverrides | undefined, report: Report): Noun[] {
  const out: Noun[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const bare = r.bare!;
    const fail = (reason: string) => report.drop(S, reason, bare);
    if (/^[А-ЯЁ]/.test(bare)) { fail('proper noun / abbreviation (capitalised)'); continue; }
    if (r.indeclinable === '1') { fail('indeclinable'); continue; }
    if (r.pl_only === '1') { fail('plural-only (no gender for agreement)'); continue; }
    const g = r.gender;
    if (g !== 'm' && g !== 'f' && g !== 'n') { fail(`gender missing or not m/f/n ("${g}")`); continue; }
    if (r.animate !== '0' && r.animate !== '1') { fail('animacy missing'); continue; }
    if (seen.has(bare)) { fail('duplicate bare form (kept the earlier row)'); continue; }
    const sgOnly = r.sg_only === '1' ? 1 : 0;
    const cells: string[] = [];
    let reason = '';
    for (const k of NOUN_CELLS) {
      if (sgOnly && k.startsWith('pl_')) { cells.push(''); continue; }
      const res = cleanCell(r[k] ?? '');
      if (!res.ok) { reason = `${k.replace('_', ' ')}: ${res.reason}`; break; }
      cells.push(res.cell);
    }
    if (reason) { fail(reason.replace(/^(sg|pl) \S+:/, '$1:')); continue; }
    seen.add(bare);
    const noun: Noun = {
      id: rowIds.get(r)!, bare, accented: r.accented || bare,
      gloss: ov?.gloss?.[bare] ?? cleanGloss(r.translations_en ?? ''),
      gender: g, animate: r.animate === '1' ? 1 : 0, sgOnly, cells,
    };
    const bad = animacyErrors(noun);
    if (bad.length) {
      fail(`animacy flag contradicts the noun's own accusative forms`);
      report.anomaly(S, 'animacy flag contradicts own accusative (dropped)', `${bare} (${noun.animate ? 'animate' : 'inanimate'}): ${bad.join(', ')}`);
      continue;
    }
    out.push(noun);
  }
  return out;
}

/**
 * Accusative should equal genitive (animate) or nominative (inanimate) for masculine
 * singular (except -а/-я nouns like мужчина, папа) and for all plurals.
 */
function animacyErrors(n: Noun): string[] {
  const eq = (a: number, b: number) => {
    const A = new Set(cellForms(n.cells[a]!).map(normalise));
    return cellForms(n.cells[b]!).some((f) => A.has(normalise(f)));
  };
  const checks: [string, number, number, number][] = [];
  const nom = normalise(cellForms(n.cells[0]!)[0] ?? '');
  if (n.gender === 'm' && !/[ая]$/.test(nom)) checks.push(['sg', 3, 1, 0]);
  if (!n.sgOnly) checks.push(['pl', 9, 7, 6]);
  const bad: string[] = [];
  for (const [num, acc, gen, nomI] of checks) {
    // When nom = gen (rare), either flag is consistent.
    const ok = n.animate ? eq(acc, gen) : eq(acc, nomI);
    if (!ok) bad.push(`${num} acc ${n.cells[acc]}`);
  }
  return bad;
}
