/**
 * Special case forms: the second prepositional (в лесу́, на мосту́) of masculine nouns, contrasted with the ordinary
 * prepositional after о (о ле'се), plus real sentences. Forms come from Wiktionary (locative) and OpenRussian.
 */
import { bare } from '../../shared/forms.ts';
import type { ClozeRow, SpecialCaseRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, TERMS } from '../terms.ts';
import type { Question, SpecialCaseSettings } from '../types.ts';
import { clozeQuestion, EXPLAIN } from './cloze.ts';

const LOC = `${TERMS.locative.en} (${TERMS.locative.ru})`;
const PREP = `${CASE_TERM.prep.en} (${CASE_TERM.prep.ru})`;

export function locativeQuestion(r: SpecialCaseRow): Question | null {
  if (!r[3]) return null;
  const prep = r[4].length === 1 ? r[4][0]! : 'в/на';
  return {
    key: `sc:loc:${r[0]}`,
    mode: 'specialCases',
    headword: r[1],
    gloss: r[2],
    task: [TERMS.locative],
    frame: `${prep} ___`,
    answer: r[3],
    others: r[5] ? [{ label: `${PREP}, used after о`, cell: r[5] }] : [],
    label: LOC,
    explain: EXPLAIN.loc,
    paradigm: { kind: 'list', rows: [{ label: [TERMS.locative], cell: r[3] }, ...(r[5] ? [{ label: [CASE_TERM.prep], cell: r[5] }] : []), ...(r[6] ? [{ label: [TERMS.partitive], cell: r[6] }] : [])] },
    speak: (f) => `${prep === 'в/на' ? 'в' : prep} ${bare(f)}`,
  };
}

/** The contrast: about the same noun, after о, it is the ordinary prepositional. */
export function aboutQuestion(r: SpecialCaseRow): Question | null {
  if (!r[3] || !r[5]) return null;
  return {
    key: `sc:o:${r[0]}`,
    mode: 'specialCases',
    headword: r[1],
    gloss: r[2],
    task: [CASE_TERM.prep],
    frame: /^[аеиоуэ]/.test(bare(r[5])) ? 'об ___' : 'о ___',
    answer: r[5],
    others: [{ label: `${LOC}, used after в/на`, cell: r[3] }],
    label: `${PREP} after о`,
    explain: EXPLAIN['o-prep'],
    paradigm: { kind: 'list', rows: [{ label: [TERMS.locative], cell: r[3] }, { label: [CASE_TERM.prep], cell: r[5] }] },
    speak: (f) => `о ${bare(f)}`,
  };
}

export function generateSpecialCaseQuestions(rows: SpecialCaseRow[], cloze: ClozeRow[], s: SpecialCaseSettings, maxBand: number, n: number, rng: Rng): Question[] {
  const pool = rows.filter((r) => r[3] && r[7] <= maxBand);
  const types = s.types.filter((t) => (t === 'sentence' ? cloze.length : pool.length));
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && types.length && guard++ < n * 50) {
    const t = pick(rng, types);
    const r = pool.length ? pick(rng, pool) : undefined;
    const q = t === 'sentence' ? clozeQuestion(pick(rng, cloze), 'specialCases') : r ? (rng() < 0.7 ? locativeQuestion(r) : aboutQuestion(r)) : null;
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
