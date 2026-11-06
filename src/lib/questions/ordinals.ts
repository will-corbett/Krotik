/**
 * Ordinals (порядковые числительные): agreement with a noun, dates (пя'того ма'я) and centuries (в двадца'том ве'ке).
 * Every word comes from the data: the ordinal's own adjective table, the month's genitive, век, and двадцать/тридцать
 * for compound days (only the last word of a compound ordinal changes: два'дцать пе'рвого).
 */
import { ADJ_INDEX, CASES } from '../../shared/cells.ts';
import { bare, cellForms } from '../../shared/forms.ts';
import { partnerPicker, type PartnerPicker } from '../pairs.ts';
import type { DatesData } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, TERMS, type TaskPart } from '../terms.ts';
import type { Noun, OrdinalSettings, Question } from '../types.ts';
import { ordinalQuestion, type OrdinalRow } from './numbers.ts';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const first = (cell: string) => cellForms(cell)[0] ?? '';
const suffix = (n: number) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

/** The ordinal for 1–31 in one cell of its table: a plain ordinal, or двадцать/тридцать + the unit's ordinal. */
function ordinalPhrase(ordinals: OrdinalRow[], tens: DatesData['tens'], n: number, cell: number): string | null {
  const exact = ordinals.find((r) => r[1] === n);
  if (exact) return first(exact[2][cell] ?? '') || null;
  const t = tens[String(n - (n % 10))];
  const unit = ordinals.find((r) => r[1] === n % 10);
  const u = unit && first(unit[2][cell] ?? '');
  return t && u ? `${first(t)} ${u}` : null;
}

export function dateQuestion(ordinals: OrdinalRow[], dates: DatesData, day: number, month: number, on: boolean): Question | null {
  const m = dates.months[month];
  if (!m || day > DAYS[month]!) return null;
  // Dates use the neuter ordinal (число is understood): nominative for "the date is", genitive for "on".
  const ord = ordinalPhrase(ordinals, dates.tens, day, ADJ_INDEX[on ? 'n_gen' : 'n_nom']);
  if (!ord) return null;
  const answer = `${ord} ${first(m[1])}`;
  return {
    key: `ord:date:${day}:${month}:${on ? 'on' : 'is'}`,
    mode: 'ordinals',
    headword: on ? `on ${m[2]} ${day}${suffix(day)}` : `${m[2]} ${day}${suffix(day)}`,
    headwordIsEnglish: true,
    gloss: '',
    task: [on ? TERMS.onDate : TERMS.date] as TaskPart[],
    frame: on ? 'Я приеду ___' : 'Сегодня ___',
    answer,
    others: [],
    label: on ? `${TERMS.onDate.en}: genitive (${CASE_TERM.gen.ru})` : `${TERMS.date.en}: nominative (${CASE_TERM.nom.ru})`,
    explain: on
      ? 'On a date: the ordinal in the genitive (родительный падеж), neuter, then the month in the genitive: пятого мая.'
      : 'The date: the ordinal in the nominative, neuter (число is understood), then the month in the genitive: сегодня пятое мая.',
    speak: (f) => bare(f),
  };
}

export function centuryQuestion(ordinals: OrdinalRow[], dates: DatesData, n: number, inCentury: boolean): Question | null {
  const [, nom, prep] = dates.century;
  if (!nom || !prep) return null;
  const ord = ordinalPhrase(ordinals, dates.tens, n, ADJ_INDEX[inCentury ? 'm_prep' : 'm_nom']);
  if (!ord) return null;
  return {
    key: `ord:cent:${n}:${inCentury ? 'in' : 'is'}`,
    mode: 'ordinals',
    headword: inCentury ? `in the ${n}${suffix(n)} century (${ROMAN[n]})` : `the ${n}${suffix(n)} century (${ROMAN[n]})`,
    headwordIsEnglish: true,
    gloss: '',
    task: [inCentury ? TERMS.inCentury : TERMS.century] as TaskPart[],
    frame: inCentury ? 'в ___' : '___',
    answer: inCentury ? `${ord} ${first(prep)}` : `${ord} ${first(nom)}`,
    others: [],
    label: inCentury ? `в + ${CASE_TERM.prep.en.toLowerCase()} (${CASE_TERM.prep.ru})` : `${CASE_TERM.nom.en} (${CASE_TERM.nom.ru})`,
    explain: inCentury
      ? 'In a century: в + prepositional (предложный падеж), both words: в двадцатом веке. Written with Roman numerals: в XX веке.'
      : 'Centuries use the masculine ordinal (век is masculine): двадцатый век.',
    speak: (f) => (inCentury ? `в ${bare(f)}` : bare(f)),
  };
}

export function generateOrdinalQuestions(ordinals: OrdinalRow[], dates: DatesData, nouns: Noun[], s: OrdinalSettings, n: number, rng: Rng, partner: PartnerPicker = partnerPicker(undefined, nouns)): Question[] {
  const gendered = nouns.filter((x) => x.gender);
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && s.types.length && guard++ < n * 50) {
    const t = pick(rng, s.types);
    let q: Question | null = null;
    if (t === 'agree' && gendered.length) {
      const row = pick(rng, ordinals.filter((r) => r[1] <= 100));
      const noun = partner({ adj: row[0] }, rng);
      const base = noun ? ordinalQuestion(row, noun, pick(rng, CASES), rng() < 0.2) : null;
      q = base && { ...base, key: `ord:${base.key}`, mode: 'ordinals' };
    } else if (t === 'dates') q = dateQuestion(ordinals, dates, 1 + Math.floor(rng() * 31), Math.floor(rng() * 12), rng() < 0.6);
    else if (t === 'centuries') q = centuryQuestion(ordinals, dates, 1 + Math.floor(rng() * 21), rng() < 0.6);
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
