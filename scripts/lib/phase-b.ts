/**
 * Phase B data from Wiktionary: verbal adverbs, participles, numerals, diminutives, plus
 * filling gaps in OpenRussian (noun gender where both sources agree on animacy; comparatives).
 * Rule-based expectations are used only to FLAG disagreements in the report, never as data.
 */
import { ADJ_CELLS, ADJ_EXTRA_INDEX, type AdjCellKey } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { DiminutiveRow, NumeralRow, ParticipleKind, ParticipleRow } from '../../src/shared/types.ts';
import type { Adjective } from './clean-adjectives.ts';
import type { Noun } from './clean-nouns.ts';
import type { Verb } from './clean-verbs.ts';
import { cleanCell } from './cell.ts';
import type { Report } from './report.ts';
import type { Form, WkExtract, WkParticiple, WkVerb } from './wiktionary.ts';

const plain = (s: string) => normalise(s);
const bareOf = (s: string) => s.replace(/'/g, '');

/** Pick the Wiktionary entry matching our accented headword (homographs: засы'пать / засыпа'ть). */
function match<T extends { canonical: string }>(list: T[] | undefined, accented: string): T | undefined {
  if (!list?.length) return undefined;
  return list.find((x) => x.canonical === accented) ?? (list.length === 1 ? list[0] : undefined);
}

/** Variants → canonical cell; -вши past adverbs are optional when a -в form exists. */
function toCell(forms: string[], optional: (f: string, all: string[]) => boolean = () => false): string {
  const ok = forms.map((f) => cleanCell(f)).filter((c): c is { ok: true; cell: string } => c.ok).map((c) => c.cell);
  const uniq = [...new Set(ok)];
  return uniq.map((f) => (optional(f, uniq) ? `(${f})` : f)).join(',');
}
const vshiOptional = (f: string, all: string[]) => /вши(сь)?$/.test(bareOf(f)) && all.some((x) => /в(шись)?$/.test(bareOf(x)) && !/вши(сь)?$/.test(bareOf(x)));

const SLOT_TAG = { m: 'masculine', f: 'feminine', n: 'neuter', pl: 'plural' } as const;
const CASE_TAG = { nom: 'nominative', gen: 'genitive', dat: 'dative', acc: 'accusative', inst: 'instrumental', prep: 'prepositional' } as const;

/** Full declension in ADJ_CELLS order from tagged forms; [] if any cell is missing. */
export function declensionCells(forms: Form[]): string[] {
  const cells: string[] = [];
  for (const key of ADJ_CELLS as readonly AdjCellKey[]) {
    const [slot, c, anim] = key.split('_') as ['m' | 'f' | 'n' | 'pl', keyof typeof CASE_TAG, string | undefined];
    const animTag = c === 'acc' && (slot === 'm' || slot === 'pl') ? (anim === 'anim' ? 'animate' : 'inanimate') : null;
    const fs = forms
      .filter(([, t]) => t.includes(CASE_TAG[c]) && t.includes(SLOT_TAG[slot]) && !t.includes('short-form') && (!animTag || t.includes(animTag)))
      .map(([f]) => f);
    if (!fs.length) return [];
    // feminine instrumental -ою is the archaic/poetic variant
    cells.push(toCell(fs, (f, all) => c === 'inst' && slot === 'f' && /ю$/.test(bareOf(f)) && all.length > 1));
  }
  return cells;
}

export function shortCells(forms: Form[]): string[] {
  const out = (['m', 'f', 'n', 'pl'] as const).map((s) => toCell(forms.filter(([, t]) => t.includes('short-form') && t.includes(SLOT_TAG[s])).map(([f]) => f)));
  return out.every(Boolean) ? out : [];
}

const KINDS: [ParticipleKind, keyof WkVerb][] = [
  ['act_pres', 'act_pres'],
  ['act_past', 'act_past'],
  ['pass_pres', 'pass_pres'],
  ['pass_past', 'pass_past'],
];

export function buildParticiples(verbs: Verb[], wk: WkExtract, report: Report): ParticipleRow[] {
  const S = 'Participles and verbal adverbs (Wiktionary)';
  const rows: ParticipleRow[] = [];
  let unmatched = 0;
  for (const v of verbs) {
    const w = match(wk.verbs[v.bare], v.accented);
    if (!w) {
      unmatched++;
      continue;
    }
    const advPres = toCell(w.adv_pres);
    const advPast = toCell(w.adv_past, vshiOptional);
    const parts: ParticipleRow[6] = [];
    for (const [kind, k] of KINDS) {
      const noms = w[k] as string[];
      if (!noms.length) continue;
      const nom = toCell(noms);
      if (!nom) continue;
      // Declension from the participle's own entry (matched by its nominative form).
      const entry: WkParticiple | undefined = noms.map((n) => match(wk.participles[bareOf(n)], n)).find(Boolean);
      const cells = entry ? declensionCells(entry.forms) : [];
      const short = entry && kind === 'pass_past' ? shortCells(entry.forms) : [];
      if (!entry) report.count(S, `participle without its own declension entry (${kind})`);
      else if (!cells.length) report.count(S, `participle declension incomplete (${kind})`);
      parts.push([kind, nom, cells, short]);
    }
    if (!advPres && !advPast && !parts.length) continue;
    crossCheck(v, advPres, advPast, parts, report, S);
    rows.push([v.id, v.accented, v.gloss, v.aspect, advPres, advPast, parts]);
  }
  report.count(S, 'verbs not matched to a Wiktionary entry', unmatched);
  report.count(S, 'verbs with Wiktionary participles or verbal adverbs', rows.length);
  report.count(S, '… with a present verbal adverb', rows.filter((r) => r[4]).length);
  report.count(S, '… with a past verbal adverb', rows.filter((r) => r[5]).length);
  for (const [kind] of KINDS) {
    report.count(S, `… with ${kind} (any)`, rows.filter((r) => r[6].some((p) => p[0] === kind)).length);
    report.count(S, `… with ${kind} full declension`, rows.filter((r) => r[6].some((p) => p[0] === kind && p[2].length)).length);
  }
  report.count(S, '… with short passive participles', rows.filter((r) => r[6].some((p) => p[3].length)).length);
  return rows;
}

/** Rule-based expectations, used ONLY to flag disagreements with Wiktionary (never as data). */
function crossCheck(v: Verb, advPres: string, advPast: string, parts: ParticipleRow[6], report: Report, S: string) {
  const first = (cell: string) => plain(cellForms(cell)[0] ?? '');
  const refl = /(ся|сь)$/.test(v.bare);
  const strip = (s: string) => s.replace(/(ся|сь)$/, '');
  const pl3 = strip(first(v.cells[5] ?? ''));
  const pastM = strip(first(v.cells[6] ?? ''));
  const flag = (what: string, got: string, expected: string) => report.anomaly(S, `differs from the regular pattern (${what}; Wiktionary kept)`, `${v.bare}: ${got} (pattern: ${expected})`);
  if (advPres && pl3) {
    const exp = pl3.replace(/(ют|ут|ят|ат)$/, (m) => (m === 'ут' || m === 'ат' ? 'а' : 'я')) + (refl ? 'сь' : '');
    const got = cellForms(advPres).map(plain);
    if (!got.includes(exp)) flag('present verbal adverb', got.join('/'), exp);
  }
  const act = parts.find((p) => p[0] === 'act_pres');
  if (act && pl3) {
    const exp = pl3.replace(/т$/, 'щий') + (refl ? 'ся' : '');
    const got = cellForms(act[1]).map(plain);
    if (!got.includes(exp)) flag('present active participle', got.join('/'), exp);
  }
  const actPast = parts.find((p) => p[0] === 'act_past');
  if (actPast && pastM) {
    const exp = (pastM.endsWith('л') ? pastM.slice(0, -1) + 'вший' : pastM + 'ший') + (refl ? 'ся' : '');
    const got = cellForms(actPast[1]).map(plain);
    if (!got.includes(exp)) flag('past active participle', got.join('/'), exp);
  }
  if (v.aspect === 'pf' && (advPres || act)) report.anomaly(S, 'perfective verb listed with a present participle/adverb (kept, not drilled for pf)', v.bare);
  void advPast;
}

/** Numerals drilled: 1–20, tens, hundreds, and оба. Values for display. */
export const NUMERALS: [string, number][] = [
  ['один', 1], ['два', 2], ['три', 3], ['четыре', 4], ['пять', 5], ['шесть', 6], ['семь', 7], ['восемь', 8], ['девять', 9], ['десять', 10],
  ['одиннадцать', 11], ['двенадцать', 12], ['тринадцать', 13], ['четырнадцать', 14], ['пятнадцать', 15], ['шестнадцать', 16],
  ['семнадцать', 17], ['восемнадцать', 18], ['девятнадцать', 19], ['двадцать', 20], ['тридцать', 30], ['сорок', 40],
  ['пятьдесят', 50], ['шестьдесят', 60], ['семьдесят', 70], ['восемьдесят', 80], ['девяносто', 90], ['сто', 100],
  ['двести', 200], ['триста', 300], ['четыреста', 400], ['пятьсот', 500], ['шестьсот', 600], ['семьсот', 700],
  ['восемьсот', 800], ['девятьсот', 900], ['оба', 2],
];

const GENDER_KEYS = { masculine: 'm', feminine: 'f', neuter: 'n', plural: 'pl' } as const;

/**
 * Numeral forms keyed generically from Wiktionary tags: "gen", "nom_f", "acc_m_anim", "acc_anim" …
 * Lookup tries the most specific key first (see src/lib/questions/numbers.ts).
 */
export function buildNumerals(wk: WkExtract, report: Report): NumeralRow[] {
  const rows: NumeralRow[] = [];
  for (const [word, value] of NUMERALS) {
    const r = buildNumeralRow(wk, word, value, report);
    if (r) rows.push(r);
  }
  report.count('Numerals (Wiktionary)', 'numerals with full case tables', rows.length);
  return rows;
}

/** One numeral's case table from Wiktionary, keyed generically from tags ("gen", "nom_f", "acc_m_anim" …). */
export function buildNumeralRow(wk: WkExtract, word: string, value: number, report: Report): NumeralRow | null {
  const S = 'Numerals (Wiktionary)';
  const e = wk.numerals[word]?.[0];
  if (!e) {
    report.anomaly(S, 'numeral not found in Wiktionary (left out)', word);
    return null;
  }
  const forms: Record<string, string[]> = {};
  for (const [f, tags] of e.forms) {
    const cases = Object.entries(CASE_TAG).filter(([, t]) => tags.includes(t)).map(([c]) => c);
    if (!cases.length) continue;
    const genders = Object.entries(GENDER_KEYS).filter(([t]) => tags.includes(t)).map(([, g]) => g);
    const anim = tags.includes('animate') ? 'anim' : tags.includes('inanimate') ? 'inan' : '';
    for (const c of cases) {
      for (const g of genders.length ? genders : ['']) {
        const key = [c, g, anim].filter(Boolean).join('_');
        (forms[key] ??= []).includes(f) || forms[key]!.push(f);
      }
    }
  }
  const cells: Record<string, string> = {};
  for (const [k, fs] of Object.entries(forms)) {
    const cell = toCell(fs, (f, all) => k.startsWith('inst') && /ю$/.test(bareOf(f)) && all.length > 1);
    if (cell) cells[k] = cell;
  }
  const missing = Object.keys(CASE_TAG).filter((c) => !Object.keys(cells).some((k) => k === c || k.startsWith(`${c}_`)));
  if (missing.length) {
    report.anomaly(S, 'numeral missing cases (left out)', `${word}: ${missing.join(', ')}`);
    return null;
  }
  return [e.canonical, value, cells];
}

export function buildDiminutives(nouns: Noun[], wk: WkExtract, report: Report): DiminutiveRow[] {
  const S = 'Diminutives (Wiktionary)';
  const rows: DiminutiveRow[] = [];
  for (const n of nouns) {
    const w = match(wk.nouns[n.bare], n.accented);
    if (!w?.diminutives.length) continue;
    const cell = toCell(w.diminutives.filter((d) => !/\s/.test(d)));
    if (!cell) continue;
    rows.push([n.id, n.accented, n.gloss, cell]);
  }
  report.count(S, 'nouns with at least one diminutive', rows.length);
  return rows;
}

/** Fill missing noun gender from Wiktionary, only where both sources agree on animacy. */
export function fillNounGender(nouns: Noun[], wk: WkExtract, report: Report) {
  const S = 'Nouns';
  let filled = 0;
  let disagreed = 0;
  for (const n of nouns) {
    if (n.gender) continue;
    const w = match(wk.nouns[n.bare], n.accented);
    const g = w?.gender;
    if (!w || !g || !/^(m|f|n)$/.test(g)) continue; // skip "m or f" (common gender) and plurale tantum
    const wkAnimate = w.animacy === 'anim' ? 1 : w.animacy === 'inan' ? 0 : -1;
    if (wkAnimate !== n.animate) {
      disagreed++;
      continue;
    }
    n.gender = g as 'm' | 'f' | 'n';
    filled++;
  }
  report.count(S, 'gender filled from Wiktionary (animacy agrees in both sources)', filled);
  report.count(S, 'gender not filled: Wiktionary animacy disagrees', disagreed);
}

/** Add Wiktionary comparatives/superlatives where OpenRussian has none (same validation patterns). */
export function fillDegrees(adjs: Adjective[], wk: WkExtract, report: Report) {
  const S = 'Adjectives';
  let cmp = 0;
  let sup = 0;
  for (const a of adjs) {
    const w = match(wk.adjectives[a.bare], a.accented);
    if (!w) continue;
    const ci = ADJ_EXTRA_INDEX.comparative;
    const si = ADJ_EXTRA_INDEX.superlative;
    if (!a.extra[ci]) {
      // Analytic "бо́лее X" is skipped; "(по)краси'вее" gives краси'вее plus optional покраси'вее;
      // the colloquial -ей ending is accepted but not shown when -ее exists.
      const forms = expandPrefix(w.comparative, 'по').filter(([f]) => !/\s/.test(f) && /(е|ей)$/.test(plain(f)));
      const cell = degreeCell(forms, (f, main) => /ей$/.test(plain(f)) && main.some((m) => /ее$/.test(plain(m))));
      if (cell) {
        a.extra[ci] = cell;
        cmp++;
      }
    }
    if (!a.extra[si]) {
      const forms = expandPrefix(w.superlative, 'наи').filter(([f]) => !/\s/.test(f) && /ший$/.test(plain(f)));
      const cell = degreeCell(forms, () => false);
      if (cell) {
        a.extra[si] = cell;
        sup++;
      }
    }
  }
  report.count(S, 'comparative added from Wiktionary', cmp);
  report.count(S, 'superlative added from Wiktionary', sup);
}

/** "(по)краси'вее" → [["краси'вее", main], ["покраси'вее", optional]] */
function expandPrefix(forms: string[], prefix: string): [string, boolean][] {
  const out: [string, boolean][] = [];
  for (const f of forms) {
    const m = new RegExp(`^\\(${prefix}\\)(.+)$`).exec(f);
    if (m) out.push([m[1]!, false], [prefix + m[1]!, true]);
    else if (!f.includes('(')) out.push([f, false]);
  }
  return out;
}
function degreeCell(forms: [string, boolean][], alsoOptional: (f: string, main: string[]) => boolean): string {
  const main = forms.filter(([, o]) => !o).map(([f]) => f);
  const cells: string[] = [];
  for (const [f, opt] of forms) {
    const c = cleanCell(f);
    if (!c.ok) continue;
    const v = opt || alsoOptional(f, main) ? `(${c.cell})` : c.cell;
    if (!cells.includes(v) && !cells.includes(c.cell)) cells.push(v);
  }
  // Need at least one shown (non-optional) form.
  return cells.some((x) => !x.startsWith('(')) ? cells.join(',') : '';
}
