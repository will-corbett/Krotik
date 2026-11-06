import { NOUN_CELLS, type Gender } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cleanCell } from './cell.ts';
import { cleanGloss, suspiciousWords } from './glosses.ts';
import { GLOSS_CHECK_TOP } from './clean-verbs.ts';
import type { Overrides } from './overrides.ts';
import type { Report } from './report.ts';

export interface Noun {
  id: number;
  bare: string;
  accented: string;
  gloss: string;
  gender: Gender | ''; // '' = missing in source or common gender (коллега): not used for agreement
  animate: 0 | 1;
  sgOnly: 0 | 1;
  cells: string[]; // NOUN_CELLS order; plural cells "" when sgOnly
  counting?: string; // form after numbers 5+ / сколько, when it differs from gen. pl. (override)
}
const S = 'Nouns';

export function cleanNouns(raw: Record<string, string>[], rowIds: Map<Record<string, string>, number>, ov: Overrides['nouns'], report: Report): Noun[] {
  const out: Noun[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const bare = r.bare!;
    const fail = (reason: string) => report.drop(S, reason, bare);
    if (/^[А-ЯЁ]/.test(bare)) { fail('proper noun / abbreviation (capitalised)'); continue; }
    if (r.indeclinable === '1') { fail('indeclinable'); continue; }
    if (r.pl_only === '1') { fail('plural-only (сутки, брюки: not drilled yet)'); continue; }
    const g0 = r.gender ?? '';
    if (g0 !== 'm' && g0 !== 'f' && g0 !== 'n' && g0 !== '' && g0 !== 'both') { fail(`gender not m/f/n ("${g0}")`); continue; }
    const g: Gender | '' = g0 === 'm' || g0 === 'f' || g0 === 'n' ? g0 : '';
    if (!g) report.count(S, `kept without gender (${g0 ? 'common gender' : 'missing'}): plural drills only, not agreement`);
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
    if (out.length < GLOSS_CHECK_TOP && !ov?.gloss?.[bare]) {
      const sus = suspiciousWords(noun.gloss);
      if (sus.length) report.anomaly(S, `gloss words not in English word list (top ${GLOSS_CHECK_TOP})`, `${bare}: "${noun.gloss}" [${sus.join(', ')}]`);
    }
    const counting = ov?.counting?.[bare];
    if (counting) {
      const c = cleanCell(counting);
      if (!c.ok) throw new Error(`counting override for ${bare}: ${c.reason}`);
      noun.counting = c.cell;
    }
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
