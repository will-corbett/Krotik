/**
 * Phase E: data built from small hand-made lists in curated/ (grammar facts only), each entry checked
 * against the word data. Forms always come from OpenRussian / Wiktionary.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { NumeralRow, VerbRow } from '../../src/shared/types.ts';
import type { Adjective } from './clean-adjectives.ts';
import type { Verb } from './clean-verbs.ts';
import type { Report } from './report.ts';
import type { WkExtract } from './wiktionary.ts';
import { buildNumeralRow } from './phase-b.ts';

const S = 'Hand-made lists (curated/)';
const load = <T>(f: string) => parse(readFileSync(`curated/${f}`, 'utf8')) as T;

export interface GovEntry { verb: string; pattern: string; en: string }
export interface PositionFamily { family: string; en: string; state: string; put: string[]; get: string[] }
export interface TimeWords { days: string[]; months: string[]; units: string[]; impersonal: string[] }

export const curated = {
  government: () => load<GovEntry[]>('government.yaml'),
  motion: () => load<{ prefixes: Record<string, { en: string; ru: string }>; bases: { uni: string; after_vowel: string; after_consonant: string; impf: string; en: string }[] }>('motion-prefixes.yaml'),
  position: () => load<PositionFamily[]>('position-verbs.yaml'),
  time: () => load<TimeWords>('time-words.yaml'),
};

/** Verb government rows: [verb id, accented, pattern, English]. Only verbs present in the data. */
export function buildGovernment(verbs: Verb[], report: Report): [number, string, string, string][] {
  const byBare = new Map<string, Verb>();
  for (const v of verbs) if (!byBare.has(v.bare)) byBare.set(v.bare, v);
  const out: [number, string, string, string][] = [];
  for (const g of curated.government()) {
    const v = byBare.get(g.verb);
    if (!v) {
      report.anomaly(S, 'government: verb not in the verb data (left out)', g.verb);
      continue;
    }
    out.push([v.id, v.accented, g.pattern, g.en]);
  }
  report.count(S, 'government: verb + pattern entries', out.length);
  return out;
}

export interface PrefixedPair {
  prefix: string;
  en: string; // prefix meaning
  ru: string;
  base: string; // e.g. "on foot"
  pf: number; // verb ids
  impf: number;
}

const VOICELESS = /^[кпстфхцчшщ]/;

/**
 * Prefixed motion verbs: build the candidate spellings from prefix + base (with the о/ъ links and раз-/рас-),
 * and keep a pair only if both verbs exist in the data with the expected aspect (pf / impf).
 */
export function buildPrefixedMotion(verbs: Verb[], report: Report): { pairs: PrefixedPair[]; verbs: VerbRow[] } {
  const { prefixes, bases } = curated.motion();
  const byBare = new Map<string, Verb[]>();
  for (const v of verbs) (byBare.get(v.bare) ?? byBare.set(v.bare, []).get(v.bare)!).push(v);
  const find = (cands: string[], aspect: 'pf' | 'impf') => {
    for (const c of cands) {
      const v = byBare.get(c)?.find((x) => x.aspect === aspect);
      if (v) return v;
    }
    return undefined;
  };
  const pairs: PrefixedPair[] = [];
  const missing: string[] = [];
  for (const [p, meaning] of Object.entries(prefixes)) {
    for (const b of bases) {
      const cons = /[бвгджзклмнпрстфхцчшщ]$/.test(p);
      const pfStem = cons ? b.after_consonant : b.after_vowel;
      const impfStem = cons && b.impf.startsWith('е') ? `ъ${b.impf}` : b.impf;
      const pre = (stem: string) => (p === 'раз' && VOICELESS.test(stem) ? ['рас', 'раз'] : [p]);
      const refl = (w: string) => w + (/[аеиоуыэюя]$/.test(w) ? 'сь' : 'ся');
      const spell = (stem: string) => pre(stem).flatMap((x) => [x + stem, refl(x + stem)]).reverse();
      const pfCands = p === 'раз' ? spell(pfStem) : [p + pfStem];
      const impfCands = p === 'раз' ? spell(impfStem) : [p + impfStem];
      const pf = find(pfCands, 'pf');
      const impf = find(impfCands, 'impf');
      if (pf && impf) pairs.push({ prefix: p, en: meaning.en, ru: meaning.ru, base: b.en, pf: pf.id, impf: impf.id });
      else missing.push(`${pfCands[0]}/${impfCands[0]}`);
    }
  }
  report.count(S, 'prefixed motion verbs: pairs found in the verb data', pairs.length);
  if (missing.length) report.anomaly(S, 'prefixed motion verbs: combination not in the data (left out)', missing.join(', '));
  const ids = new Set(pairs.flatMap((x) => [x.pf, x.impf]));
  const rows: VerbRow[] = verbs.filter((v) => ids.has(v.id)).map((v) => [v.id, v.accented, v.gloss, v.aspect, v.partners, v.cells]);
  return { pairs, verbs: rows };
}

export const ORDINALS: [string, number][] = [
  ['первый', 1], ['второй', 2], ['третий', 3], ['четвёртый', 4], ['пятый', 5], ['шестой', 6], ['седьмой', 7], ['восьмой', 8],
  ['девятый', 9], ['десятый', 10], ['одиннадцатый', 11], ['двенадцатый', 12], ['тринадцатый', 13], ['четырнадцатый', 14],
  ['пятнадцатый', 15], ['шестнадцатый', 16], ['семнадцатый', 17], ['восемнадцатый', 18], ['девятнадцатый', 19], ['двадцатый', 20],
  ['тридцатый', 30], ['сороковой', 40], ['пятидесятый', 50], ['шестидесятый', 60], ['семидесятый', 70], ['восьмидесятый', 80],
  ['девяностый', 90], ['сотый', 100], ['тысячный', 1000],
];

/** Ordinals from the adjective data: [accented, value, ADJ_CELLS]. */
export function buildOrdinals(adjs: Adjective[], report: Report): [string, number, string[]][] {
  const by = new Map(adjs.map((a) => [a.bare, a]));
  const out: [string, number, string[]][] = [];
  for (const [w, n] of ORDINALS) {
    const a = by.get(w);
    if (a && a.cells.every(Boolean)) out.push([a.accented, n, a.cells]);
    else report.anomaly(S, 'ordinal not in the adjective data with a full table (left out)', w);
  }
  report.count(S, 'ordinal numbers', out.length);
  return out;
}

export const COLLECTIVES: [string, number][] = [['двое', 2], ['трое', 3], ['четверо', 4], ['пятеро', 5], ['шестеро', 6], ['семеро', 7]];

export function buildCollectives(wk: WkExtract, report: Report): NumeralRow[] {
  const out: NumeralRow[] = [];
  for (const [w, n] of COLLECTIVES) {
    const row = buildNumeralRow(wk, w, n, report);
    if (row) out.push(row);
  }
  report.count(S, 'collective numerals', out.length);
  return out;
}
