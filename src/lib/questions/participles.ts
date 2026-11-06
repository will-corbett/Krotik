import { partnerPicker, type PartnerPicker } from '../pairs.ts';
import type { AdjSlot } from '../../shared/cells.ts';
import { CASES } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import type { ParticipleKind, ParticipleRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS, numberGenderTerm } from '../terms.ts';
import type { Noun, ParticipleSettings, Question } from '../types.ts';
import { adjectiveQuestion } from './adjectives.ts';

const KIND_TERM: Record<ParticipleKind | 'adv_pres' | 'adv_past', { en: string; ru: string }> = {
  act_pres: TERMS.act_pres,
  act_past: TERMS.act_past,
  pass_pres: TERMS.pass_pres,
  pass_past: TERMS.pass_past,
  adv_pres: TERMS.advImpf,
  adv_past: TERMS.advPf,
};
export const participleTerm = (k: ParticipleKind) => KIND_TERM[k];

/** Other participles/adverbs of the same verb, for "what you typed is the … form". */
export function participleOthers(row: ParticipleRow, except: ParticipleKind | 'adv_pres' | 'adv_past'): Question['others'] {
  const out: Question['others'] = [];
  const label = (k: keyof typeof KIND_TERM) => `${KIND_TERM[k].en} (${KIND_TERM[k].ru})`;
  if (except !== 'adv_pres' && row[4]) out.push({ label: label('adv_pres'), cell: row[4] });
  if (except !== 'adv_past' && row[5]) out.push({ label: label('adv_past'), cell: row[5] });
  for (const [k, nom] of row[6]) if (k !== except) out.push({ label: label(k), cell: nom });
  return out;
}

/** Present participles are formed from imperfective verbs only. */
function allowed(row: ParticipleRow, k: ParticipleKind): boolean {
  return !(row[3] === 'pf' && (k === 'act_pres' || k === 'pass_pres'));
}

export function participleFormQuestion(row: ParticipleRow, band: number, k: ParticipleKind): Question | null {
  const p = row[6].find((x) => x[0] === k);
  if (!p || !allowed(row, k)) return null;
  return {
    key: `pt:form:${row[0]}:${k}`,
    mode: 'participles',
    headword: row[1],
    gloss: row[2],
    task: [KIND_TERM[k]],
    frame: '___',
    answer: p[1],
    others: participleOthers(row, k),
    label: `${KIND_TERM[k].en} (${KIND_TERM[k].ru})`,
    paradigm: { kind: 'participles', row },
    sentence: { type: 'participles', lemmaId: row[0], cell: -1, band },
    speak: (f) => bare(f),
  };
}

const PRONOUN: Record<AdjSlot, string> = { m: 'он', f: 'она', n: 'оно', pl: 'они' };
const SLOTS: AdjSlot[] = ['m', 'f', 'n', 'pl'];

export function shortPassiveQuestion(row: ParticipleRow, band: number, slot: AdjSlot): Question | null {
  const p = row[6].find((x) => x[0] === 'pass_past' && x[3].length);
  if (!p) return null;
  const i = SLOTS.indexOf(slot);
  const answer = p[3][i]!;
  const ng = numberGenderTerm(slot);
  return {
    key: `pt:short:${row[0]}:${slot}`,
    mode: 'participles',
    headword: row[1],
    gloss: row[2],
    task: [TERMS.shortPassive, ng],
    frame: `${PRONOUN[slot]} ___`,
    note: `${TERMS.pass_past.en}: ${p[1].split(',')[0]}`,
    answer,
    others: [
      ...p[3].map((cell, j) => ({ label: `${TERMS.shortPassive.en}, ${numberGenderTerm(SLOTS[j]!).en} (${TERMS.shortPassive.ru})`, cell, j })).filter((o) => o.j !== i).map(({ label, cell }) => ({ label, cell })),
      ...participleOthers(row, 'adv_pres').filter((o) => !o.label.startsWith(TERMS.advImpf.en)),
    ],
    label: `${TERMS.shortPassive.en}, ${ng.en} (${TERMS.shortPassive.ru}, ${ng.ru})`,
    paradigm: { kind: 'participles', row },
    sentence: { type: 'participles', lemmaId: row[0], cell: -1, band },
    speak: (f) => `${PRONOUN[slot]} ${bare(f)}`,
  };
}

/** Participle agreeing with a noun, built from the participle's own Wiktionary declension. */
export function participleDeclineQuestion(row: ParticipleRow, band: number, k: ParticipleKind, noun: Noun, c: (typeof CASES)[number], plural: boolean): Question | null {
  const p = row[6].find((x) => x[0] === k);
  if (!p || !p[2].length || !allowed(row, k)) return null;
  const pseudo = { id: row[0], accented: p[1].split(',')[0]!.replace(/[()]/g, ''), gloss: row[2], cells: p[2], extra: [], band };
  const q = adjectiveQuestion(pseudo, noun, c, plural);
  if (!q) return null;
  return {
    ...q,
    key: `pt:decl:${row[0]}:${k}:${noun.id}:${c}:${plural ? 'p' : 's'}`,
    mode: 'participles',
    task: [KIND_TERM[k], ...q.task],
    note: `${q.note} · ${TERMS.verb.en} ${row[1].replace(/'/g, '')}`,
    sentence: { type: 'participles', lemmaId: row[0], cell: -1, band },
  };
}

export function generateParticipleQuestions(rows: { row: ParticipleRow; band: number }[], nouns: Noun[], s: ParticipleSettings, n: number, rng: Rng, partner: PartnerPicker = partnerPicker(undefined, nouns)): Question[] {
  const out: Question[] = [];
  const keys = new Set<string>();
  const gendered = nouns.filter((x) => x.gender);
  if (!rows.length || !s.types.length || !s.kinds.length) return out;
  let guard = 0;
  while (out.length < n && guard++ < n * 150) {
    const { row, band } = pick(rng, rows);
    const t = pick(rng, s.types);
    let q: Question | null = null;
    if (t === 'form') q = participleFormQuestion(row, band, pick(rng, s.kinds));
    else if (t === 'short') q = s.kinds.includes('pass_past') ? shortPassiveQuestion(row, band, pick(rng, SLOTS)) : null;
    else if (gendered.length) {
      const noun = partner({ verb: row[0] }, rng);
      q = noun ? participleDeclineQuestion(row, band, pick(rng, s.kinds), noun, pick(rng, CASES), rng() < 0.4) : null;
    }
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
