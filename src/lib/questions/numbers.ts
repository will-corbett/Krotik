import { CASES, NOUN_INDEX, type Case, type Gender } from '../../shared/cells.ts';
import { bare, displayForms } from '../../shared/forms.ts';
import type { NumeralRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, GENDER_TERM, TERMS, type TaskPart } from '../terms.ts';
import type { Noun, NumberSettings, Question } from '../types.ts';

type Slot = Gender | 'pl';

/** Most specific Wiktionary key first: "acc_m_anim", "acc_m", "acc_anim", "acc", then plural keys (сто/двести are tagged plural). */
export function numeralForm(row: NumeralRow, c: Case, g: Slot, animate: boolean | null): string {
  const a = animate === null ? '' : animate ? 'anim' : 'inan';
  const keys = [`${c}_${g}_${a}`, `${c}_${g}`, `${c}_${a}`, c, `${c}_pl_${a}`, `${c}_pl`].filter((k) => !k.endsWith('_'));
  for (const k of keys) if (row[2][k]) return row[2][k]!;
  return '';
}

/** Does the numeral change with gender (один, два, оба)? */
export const isGendered = (row: NumeralRow) => Object.keys(row[2]).some((k) => /_(m|f|n)(_|$)/.test(k));
/** Does its accusative depend on animacy? */
export const hasAnimacy = (row: NumeralRow) => Object.keys(row[2]).some((k) => /_(anim|inan)$/.test(k));

export function inRange(row: NumeralRow, ranges: NumberSettings['ranges']): boolean {
  const v = row[1];
  return (ranges.includes('1-4') && v <= 4) || (ranges.includes('5-20') && v >= 5 && v <= 20) || (ranges.includes('tens') && v >= 30);
}

const isFew = (row: NumeralRow) => row[1] >= 2 && row[1] <= 4; // два, три, четыре, оба

export function numeralAloneQuestion(row: NumeralRow, c: Case, g: Gender, animate: boolean): Question | null {
  const gendered = isGendered(row);
  const animRelevant = c === 'acc' && hasAnimacy(row);
  const answer = numeralForm(row, c, gendered ? g : 'm', animRelevant ? animate : null);
  if (!answer) return null;
  const task: TaskPart[] = [CASE_TERM[c]];
  if (gendered) task.push(GENDER_TERM[g]);
  if (animRelevant) task.push(animate ? TERMS.animate : TERMS.inanimate);
  const others = CASES.filter((x) => x !== c)
    .map((x) => ({ label: `${CASE_TERM[x].en} (${CASE_TERM[x].ru})`, cell: numeralForm(row, x, gendered ? g : 'm', x === 'acc' ? animate : null) }))
    .filter((o) => o.cell);
  return {
    key: `num:alone:${row[1]}:${row[0]}:${c}:${gendered ? g : ''}:${animRelevant ? animate : ''}`,
    mode: 'numbers',
    headword: row[0],
    gloss: String(row[1]),
    task,
    frame: '___',
    answer,
    others,
    label: `${CASE_TERM[c].en} (${CASE_TERM[c].ru})`,
    paradigm: numeralParadigm(row, g),
    speak: (f) => bare(f),
  };
}

function numeralParadigm(row: NumeralRow, g: Gender): Question['paradigm'] {
  const gendered = isGendered(row);
  return {
    kind: 'list',
    rows: CASES.flatMap((c) =>
      c === 'acc' && hasAnimacy(row)
        ? [
            { label: [CASE_TERM.acc, TERMS.inanimate], cell: numeralForm(row, c, gendered ? g : 'm', false) },
            { label: [CASE_TERM.acc, TERMS.animate], cell: numeralForm(row, c, gendered ? g : 'm', true) },
          ]
        : [{ label: [CASE_TERM[c]], cell: numeralForm(row, c, gendered ? g : 'm', null) }],
    ),
  };
}

/** Every combination of main variants: "двум кни'гам". */
function combine(a: string, b: string): string {
  return displayForms(a).flatMap((x) => displayForms(b).map((y) => `${x} ${y}`)).join(',');
}

/**
 * Numeral + noun in a case. Both words come from their own source tables; the rule only picks
 * which noun cell follows the numeral:
 *  - 1: noun singular in the same case (acc follows animacy);
 *  - nominative / inanimate accusative: 2–4 → genitive singular; 5+ → genitive plural;
 *  - animate accusative: 2–4 → genitive-like numeral + genitive plural (двух друзей); 5+ → nominative numeral + genitive plural;
 *  - other cases: numeral in that case + noun plural in that case (двум книгам, пятью книгами).
 */
export function numeralNounQuestion(row: NumeralRow, noun: Noun, c: Case): Question | null {
  if (!noun.gender || noun.sgOnly || noun.counting) return null;
  const v = row[1];
  const anim = c === 'acc' ? noun.animate : null;
  const numCell = numeralForm(row, c, v === 1 ? noun.gender : noun.gender, anim);
  let nounKey: keyof typeof NOUN_INDEX;
  let rule: string;
  if (v === 1) {
    nounKey = `sg_${c}`;
    rule = 'один agrees with the noun, which stays singular in the same case';
  } else if (c === 'nom' || (c === 'acc' && !noun.animate)) {
    nounKey = isFew(row) ? 'sg_gen' : 'pl_gen';
    rule = isFew(row)
      ? `After 2–4 in the nominative/inanimate accusative: noun in the genitive singular (${CASE_TERM.gen.ru}, ${TERMS.singular.ru})`
      : `After 5+ in the nominative/accusative: noun in the genitive plural (${CASE_TERM.gen.ru}, ${TERMS.plural.ru})`;
  } else if (c === 'acc') {
    nounKey = 'pl_acc';
    rule = isFew(row)
      ? 'Animate accusative after 2–4: numeral and noun take genitive-like forms (двух друзей)'
      : 'Animate accusative after 5+: numeral as in the nominative, noun in the genitive plural (пять друзей)';
  } else {
    nounKey = `pl_${c}`;
    rule = `In the ${CASE_TERM[c].en.toLowerCase()} (${CASE_TERM[c].ru}) numeral and noun both take the case; the noun is plural`;
  }
  const nounCell = noun.cells[NOUN_INDEX[nounKey]];
  if (!numCell || !nounCell) return null;
  const task: TaskPart[] = [CASE_TERM[c], TERMS.numeralNoun];
  if (c === 'acc') task.push(noun.animate ? TERMS.animate : TERMS.inanimate);
  return {
    key: `num:noun:${row[0]}:${noun.id}:${c}`,
    mode: 'numbers',
    headword: `${v} + ${noun.accented}`,
    gloss: noun.gloss,
    task,
    frame: '___',
    note: `${row[0]} (${v})`,
    answer: combine(numCell, nounCell),
    others: [],
    label: `${v} + ${bare(noun.accented)}, ${CASE_TERM[c].en} (${CASE_TERM[c].ru})`,
    explain: rule,
    paradigm: numeralParadigm(row, noun.gender),
    sentence: { type: 'nouns', lemmaId: noun.id, cell: -1, band: noun.band },
    speak: (f) => bare(f),
  };
}

export function generateNumberQuestions(numerals: NumeralRow[], nouns: Noun[], s: NumberSettings, n: number, rng: Rng): Question[] {
  const pool = numerals.filter((r) => inRange(r, s.ranges));
  const cases = s.cases.length ? s.cases : [...CASES];
  const usableNouns = nouns.filter((x) => x.gender && !x.sgOnly && !x.counting);
  const out: Question[] = [];
  const keys = new Set<string>();
  if (!pool.length || !s.types.length) return out;
  let guard = 0;
  while (out.length < n && guard++ < n * 100) {
    const row = pick(rng, pool);
    const t = pick(rng, s.types);
    const q =
      t === 'alone'
        ? numeralAloneQuestion(row, pick(rng, cases), pick(rng, ['m', 'f', 'n'] as Gender[]), rng() < 0.5)
        : usableNouns.length
          ? numeralNounQuestion(row, pick(rng, usableNouns), pick(rng, cases))
          : null;
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
