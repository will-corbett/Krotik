/**
 * Phase D pronoun data from Wiktionary:
 *  - personal pronouns from the table on the я entry (я ты он оно она мы вы они себя), plus кто, что;
 *    third-person н- forms (него, ней, них…) are kept separately for "after a preposition";
 *  - possessive/demonstrative pronouns (мой, наш, свой, этот, тот, весь, чей, сам) in ADJ_CELLS order.
 */
import { CASES } from '../../src/shared/cells.ts';
import type { PronounData, PersonalRow } from '../../src/shared/types.ts';
import { cleanCell } from './cell.ts';
import { declensionCells } from './phase-b.ts';
import type { Report } from './report.ts';
import type { Form, WkExtract } from './wiktionary.ts';

export const POSSESSIVES = ['мой', 'твой', 'свой', 'наш', 'ваш', 'этот', 'тот', 'весь', 'чей', 'сам'];
const CASE_TAG = { nom: 'nominative', gen: 'genitive', dat: 'dative', acc: 'accusative', inst: 'instrumental', prep: 'prepositional' } as const;
const S = 'Pronouns (Wiktionary)';

const plain = (f: string) => f.replace(/'/g, '');
function cell(forms: string[]): string {
  const ok = [...new Set(forms)].map((f) => cleanCell(f)).filter((c): c is { ok: true; cell: string } => c.ok).map((c) => c.cell);
  // мною/тобою/ею/нею/собою are the bookish instrumental variants: accepted, not shown, when a short form exists.
  return ok.map((f) => (/ю$/.test(plain(f)) && ok.some((o) => !/ю$/.test(plain(o))) ? `(${f})` : f)).join(',');
}

/** Which personal pronoun a form in the я-table belongs to. First/second person are told apart by the
 *  forms themselves (Wiktionary tags мы and я identically), third person by gender/number tags. */
function personOf(f: string, t: string[]): string | null {
  const p = plain(f);
  if (t.includes('reflexive')) return 'себя';
  if (t.includes('first-person')) return /^(мы|нас|нам|нами)$/.test(p) ? 'мы' : 'я';
  if (t.includes('second-person')) return /^(вы|вас|вам|вами)$/.test(p) ? 'вы' : 'ты';
  if (t.includes('third-person')) {
    // Singular third-person forms carry a "singular" tag in the modern table; an older table on the same
    // entry (онѣ, ихъ…) doesn't, so gendered forms without it are ignored.
    const gendered = t.includes('feminine') || t.includes('masculine') || t.includes('neuter');
    if (gendered && !t.includes('singular')) return null;
    if (t.includes('feminine')) return 'она';
    if (t.includes('masculine') && t.includes('neuter')) return 'он/оно';
    if (t.includes('masculine')) return 'он';
    if (t.includes('neuter')) return 'оно';
    return 'они';
  }
  return null;
}

export function buildPronouns(wk: WkExtract, adjectives: { bare: string; accented: string; cells: string[] }[], report: Report): PronounData {
  const personal: PersonalRow[] = [];
  const table = wk.pronouns['я']?.find((e) => e.forms.length > 50);
  if (!table) report.anomaly(S, 'personal pronoun table missing', 'я');
  const order = ['я', 'ты', 'он', 'оно', 'она', 'мы', 'вы', 'они', 'себя'];
  const by = new Map<string, Record<string, string[]>>();
  for (const [f, t] of table?.forms ?? []) {
    const who = personOf(f, t);
    const c = Object.entries(CASE_TAG).find(([, tag]) => t.includes(tag))?.[0];
    // Pre-1918 spellings end in ъ (онъ, насъ); modern Russian never does.
    if (!who || !c || f === '-' || /ъ$/.test(f)) continue;
    for (const w of who === 'он/оно' ? ['он', 'оно'] : [who]) {
      const m = by.get(w) ?? by.set(w, {}).get(w)!;
      (m[c] ??= []).push(f);
    }
  }
  for (const who of order) {
    const m = by.get(who);
    if (!m) continue;
    const plainCells: string[] = [];
    const prepCells: string[] = [];
    for (const c of CASES) {
      const fs = m[c] ?? [];
      // н- forms: start with н where a sibling form doesn't (его/него). Prepositional has only н- forms.
      const third = ['он', 'оно', 'она', 'они'].includes(who);
      const nForms = third ? fs.filter((f) => /^н/.test(f) && fs.some((g) => !/^н/.test(g))) : [];
      const regular = fs.filter((f) => !nForms.includes(f));
      // Third-person prepositional exists only as н- forms (о нём), used for both.
      plainCells.push(cell(regular.length ? regular : nForms));
      prepCells.push(cell(nForms.length ? nForms : regular));
    }
    if (who !== 'себя' && !plainCells[0]) {
      report.anomaly(S, 'personal pronoun without nominative', who);
      continue;
    }
    personal.push([who, plainCells, prepCells]);
  }
  for (const w of ['кто', 'что']) {
    const e = wk.pronouns[w]?.find((x) => x.forms.some(([, t]) => t.includes('genitive')));
    if (!e) {
      report.anomaly(S, 'pronoun table missing', w);
      continue;
    }
    const cells = CASES.map((c) => cell(e.forms.filter(([f, t]) => t.includes(CASE_TAG[c]) && !/\s/.test(f)).map(([f]) => f)));
    personal.push([e.canonical, cells, cells]);
  }
  report.count(S, 'personal and interrogative pronouns', personal.length);

  const possessive: PronounData['possessive'] = [];
  for (const w of POSSESSIVES) {
    const e = wk.pronouns[w]?.find((x) => x.forms.some(([, t]) => t.includes('genitive')));
    const cells = e ? declensionCells(e.forms as Form[]) : [];
    if (!e || !cells.length) {
      // Fall back to the OpenRussian table (validated by the adjective checks), e.g. весь.
      const a = adjectives.find((x) => x.bare === w);
      if (a && a.cells.every(Boolean)) {
        possessive.push([a.accented, a.cells]);
        report.count(S, 'possessive/demonstrative taken from OpenRussian (Wiktionary table not usable)');
      } else report.anomaly(S, 'possessive/demonstrative table missing (left out)', w);
      continue;
    }
    possessive.push([e.canonical, cells]);
  }
  report.count(S, 'possessive and demonstrative pronouns', possessive.length);
  return { personal, possessive };
}
