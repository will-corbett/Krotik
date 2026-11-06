/**
 * Batch 4 data from Wiktionary:
 *  - adverbs (наречия) paired with the adjective they come from, by the adverb entry's etymology
 *    (бы́стрый + -о → бы́стро) or, where it gives none, by matching OpenRussian's short neuter form;
 *  - second prepositional (в лесу́) and partitive (ча́ю) forms of masculine nouns, kept only where they differ
 *    from the ordinary prepositional / genitive.
 * Every form shown comes from Wiktionary; the matching only decides which entries belong together.
 */
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { AdverbRow, DatesData, NumeralRow, SpecialCaseRow } from '../../src/shared/types.ts';
import { ADJ_EXTRA_INDEX } from '../../src/shared/cells.ts';
import { cleanCell } from './cell.ts';
import type { Adjective } from './clean-adjectives.ts';
import type { Noun } from './clean-nouns.ts';
import { degreeCell, expandPrefix } from './phase-b.ts';
import type { Report } from './report.ts';
import { bandOf } from './shard.ts';
import type { WkAdverb, WkExtract } from './wiktionary.ts';

const plain = (f: string) => f.replace(/[()']/g, '');
const forms = (cell: string) => new Set(cellForms(cell).map(normalise));

/** Short neuter forms (бы'стро) of the adjectives, to look up as adverbs. */
export function adverbCandidates(adjs: Adjective[]): Set<string> {
  const out = new Set<string>();
  for (const a of adjs) for (const f of cellForms(a.extra[ADJ_EXTRA_INDEX.short_n] ?? '')) out.add(plain(f));
  return out;
}

/** "fast, quickly, rapidly" → "fast, quickly, rapidly"; long glosses are cut at the first semicolon or bracket. */
const shortGloss = (g: string) => g.split(/;|\(/)[0]!.trim().slice(0, 60);

export function buildAdverbs(adjs: Adjective[], wk: WkExtract, exclude: Record<string, string>, report: Report): AdverbRow[] {
  const S = 'Adverbs (Wiktionary)';
  const byAdj = new Map<string, WkAdverb[]>();
  const byWord = new Map<string, WkAdverb[]>();
  for (const [word, list] of Object.entries(wk.adverbs)) {
    for (const a of list) {
      if (a.of) (byAdj.get(a.of) ?? byAdj.set(a.of, []).get(a.of)!).push(a);
      else (byWord.get(word) ?? byWord.set(word, []).get(word)!).push(a);
    }
  }
  const used = new Set<string>();
  const out: AdverbRow[] = [];
  let viaEtymology = 0;
  let viaShort = 0;
  let fromAdj = 0;
  adjs.forEach((a, rank) => {
    if (a.pronominal) return;
    if (a.bare in exclude) {
      report.anomaly(S, 'excluded by override', `${a.bare} (${exclude[a.bare]})`);
      return;
    }
    const shortN = cellForms(a.extra[ADJ_EXTRA_INDEX.short_n] ?? '').map(plain);
    const ety = byAdj.get(a.bare) ?? [];
    // Prefer the adverb that is also the short neuter (хорошо́ over хоро́шенько), then -ски (по-ру́сски).
    const pickEty = ety.find((x) => shortN.includes(plain(x.canonical))) ?? ety.find((x) => /ски$/.test(plain(x.canonical))) ?? ety.find((x) => /о$/.test(plain(x.canonical)));
    const viaS = pickEty ? undefined : shortN.map((w) => byWord.get(w)?.[0]).find(Boolean);
    const adv = pickEty ?? viaS;
    if (!adv || used.has(adv.canonical)) return;
    const c = cleanCell(adv.canonical);
    if (!c.ok) {
      report.drop(S, c.reason, adv.canonical);
      return;
    }
    used.add(adv.canonical);
    // Comparative: "(по)быстре́е" gives быстре́е plus optional побыстре́е; -ей is accepted but not shown.
    const cmpForms = expandPrefix(adv.comparative, 'по').filter(([f]) => !/\s/.test(f) && /(е|ей)$/.test(plain(f)));
    const own = degreeCell(cmpForms, (f, main) => /ей$/.test(plain(f)) && main.some((m) => /ее$/.test(plain(m))));
    // An adverb's comparative is the same word as its adjective's (быстро, быстрый → быстрее), so where the adverb
    // entry lists none, the adjective's comparative (OpenRussian / Wiktionary) is used. -ски adverbs have none.
    const cmp = own || (/ски$/.test(plain(adv.canonical)) ? '' : (a.extra[ADJ_EXTRA_INDEX.comparative] ?? ''));
    if (!own && cmp) fromAdj++;
    out.push([a.id, a.accented, c.cell, cmp, shortGloss(adv.gloss), bandOf(rank)]);
    if (pickEty) viaEtymology++;
    else viaShort++;
  });
  report.count(S, 'adverbs paired with their adjective by Wiktionary etymology', viaEtymology);
  report.count(S, 'adverbs paired by matching the OpenRussian short neuter form', viaShort);
  report.count(S, 'adverbs with a comparative', out.filter((r) => r[3]).length);
  report.count(S, '… of which taken from the adjective (the adverb entry lists none)', fromAdj);
  return out;
}

export function buildSpecialCases(nouns: Noun[], wk: WkExtract, report: Report): SpecialCaseRow[] {
  const S = 'Second prepositional and partitive (Wiktionary)';
  const out: SpecialCaseRow[] = [];
  let nonMasc = 0;
  nouns.forEach((n, rank) => {
    const list = wk.nouns[n.bare];
    const w = list?.find((x) => x.canonical === n.accented) ?? (list?.length === 1 ? list[0] : undefined);
    if (!w || (!w.loc.length && !w.part.length)) return;
    // Feminine nouns (в крови́, в тени́) differ from the prepositional only in stress; left out.
    if (n.gender !== 'm') {
      nonMasc++;
      return;
    }
    const preps = new Set<string>();
    const locForms: string[] = [];
    for (const f of w.loc) {
      const m = /^(в|во|на) (.+)$/.exec(f);
      if (m) preps.add(m[1] === 'во' ? 'в' : m[1]!);
      locForms.push(m ? m[2]! : f);
    }
    // OpenRussian sometimes lists the locative as a second prepositional variant (го'де, году'): the ordinary
    // prepositional is what remains once the Wiktionary locative forms are taken out.
    const locN = new Set(locForms.map(normalise));
    const partN = new Set(w.part.map(normalise));
    const keep = (cell: string, drop: Set<string>) => cellForms(cell).filter((f) => !drop.has(normalise(f))).join(',');
    const prepCell = keep(n.cells[5] ?? '', locN);
    const genCell = keep(n.cells[1] ?? '', partN);
    // Masculine second prepositional / partitive forms end in -у/-ю; the ordinary form must differ.
    const cellOf = (fs: string[], regular: string) => {
      const reg = forms(regular);
      const ok = fs.filter((f) => !/\s/.test(f) && /[ую]$/.test(normalise(f)) && !reg.has(normalise(f))).map((f) => cleanCell(f)).filter((c) => c.ok).map((c) => (c as { cell: string }).cell);
      return [...new Set(ok)].join(',');
    };
    const loc = cellOf(locForms, prepCell);
    const part = genCell ? cellOf(w.part, genCell) : '';
    if (!loc && !part) return;
    out.push([n.id, n.accented, n.gloss, loc, loc ? [...preps].sort() : [], prepCell, part, bandOf(rank)]);
  });
  report.count(S, 'masculine nouns with a second prepositional form', out.filter((r) => r[3]).length);
  report.count(S, 'masculine nouns with a partitive form', out.filter((r) => r[6]).length);
  report.count(S, 'non-masculine nouns with such forms (left out: they differ only in stress)', nonMasc);
  return out;
}

const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Month genitives (пя'того ма'я), век for centuries, and двадцать/тридцать for days 21–31. */
export function buildDates(nouns: Noun[], numerals: NumeralRow[], months: string[], report: Report): DatesData {
  const S = 'Hand-made lists (curated/)';
  const by = new Map<string, Noun>();
  for (const n of nouns) if (!by.has(n.bare)) by.set(n.bare, n);
  const out: DatesData = { months: [], century: ['', '', ''], tens: {} };
  months.forEach((m, i) => {
    const n = by.get(m);
    if (n?.cells[1]) out.months.push([n.accented, n.cells[1], MONTH_EN[i]!]);
    else report.anomaly(S, 'dates: month not in the noun data (left out)', m);
  });
  const vek = by.get('век');
  if (vek?.cells[0] && vek.cells[5]) out.century = [vek.accented, vek.cells[0], vek.cells[5]];
  else report.anomaly(S, 'dates: век not in the noun data', 'век');
  for (const v of [20, 30]) {
    const r = numerals.find((x) => x[1] === v);
    if (r?.[2].nom) out.tens[String(v)] = r[2].nom;
    else report.anomaly(S, 'dates: numeral missing', String(v));
  }
  report.count(S, 'dates: months with a genitive', out.months.length);
  return out;
}
