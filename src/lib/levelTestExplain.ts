/**
 * Explanations for the level test results: which form each option is ("genitive plural (родительный падеж,
 * множественное число)"), and the rule behind the sentence where the data has one. Labels are built from the form
 * codes stored with each question (see levelTestPool.ts); every term comes from terms.ts with its Russian name.
 */
import { ADJ_CELLS, ADJ_EXTRA, ADJ_EXTRA_CELL_OFFSET, CASES, VERB_CELLS, type AdjSlot, type Case } from '../shared/cells.ts';
import type { ParticipleKind } from '../shared/types.ts';
import { explainFor } from './questions/cloze.ts';
import { CASE_TERM, GENDER_TERM, TERMS, numberGenderTerm, type Term } from './terms.ts';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const join = (...ts: Term[]): Term => ({ en: ts.map((t) => lower(t.en)).join(' '), ru: ts.map((t) => t.ru).join(', ') });

function adjCell(i: number): Term {
  const key = ADJ_CELLS[i];
  if (!key) return { en: '', ru: '' };
  const [slot, c] = key.split('_') as [AdjSlot, Case];
  return join(numberGenderTerm(slot), CASE_TERM[c]);
}

const listEn = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
const listRu = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} или ${xs.at(-1)}`);
/** A case + number/gender cell, split so several can be listed together. */
function parts(code: string): { slot: Term; c: Case } | null {
  let m = /^n(\d+)$/.exec(code);
  if (m) return { slot: Number(m[1]) < 6 ? TERMS.singular : TERMS.plural, c: CASES[Number(m[1]) % 6]! };
  m = /^a(\d+)$/.exec(code);
  const key = m && Number(m[1]) < ADJ_EXTRA_CELL_OFFSET ? ADJ_CELLS[Number(m[1])] : undefined;
  if (key) {
    const [slot, c] = key.split('_') as [AdjSlot, Case];
    return { slot: numberGenderTerm(slot), c };
  }
  return null;
}
const caseRu = (c: Case) => CASE_TERM[c].ru.replace(/ падеж$/, '');

/**
 * What form a code names, or null if it names none (the options are different words). Several codes joined with "+"
 * (one spelling, several cells) are listed together: "feminine singular genitive, dative or prepositional".
 */
export function formTerm(code: string): Term | null {
  const all = [...new Set(code.split('+'))];
  // Participle cells: the participle's name, then its cells labelled like an adjective's.
  const pk = /^p:([a-z_]+):/.exec(all[0] ?? '')?.[1];
  if (all.length > 1 && pk && all.every((c) => c.startsWith(`p:${pk}:`))) {
    const inner = formTerm(all.map((c) => `a${c.split(':')[2]}`).join('+'));
    const kind = TERMS[pk as ParticipleKind];
    return inner ? { en: `${lower(kind.en)}, ${inner.en}`, ru: `${kind.ru}; ${inner.ru}` } : null;
  }
  if (all.length > 1) {
    const ps = all.map(parts);
    if (ps.every((p): p is { slot: Term; c: Case } => !!p)) {
      const slots = [...new Map(ps.map((p) => [p.slot.en, p.slot])).values()];
      const cases = [...new Set(ps.map((p) => p.c))];
      if (slots.length === 1)
        return { en: `${lower(slots[0]!.en)} ${listEn(cases.map((c) => lower(CASE_TERM[c].en)))}`, ru: `${slots[0]!.ru}; ${listRu(cases.map(caseRu))} падеж` };
      if (cases.length === 1)
        return { en: `${listEn(slots.map((s) => lower(s.en)))} ${lower(CASE_TERM[cases[0]!].en)}`, ru: `${listRu(slots.map((s) => s.ru))}; ${CASE_TERM[cases[0]!].ru}` };
    }
    const ts = all.map(formTerm).filter((t): t is Term => !!t);
    return ts.length ? { en: ts.map((t) => t.en).join(' / '), ru: ts.map((t) => t.ru).join(' / ') } : null;
  }
  let m: RegExpExecArray | null;
  if ((m = /^n(\d+)$/.exec(code))) {
    const i = Number(m[1]);
    return join(CASE_TERM[CASES[i % 6]!], i < 6 ? TERMS.singular : TERMS.plural);
  }
  if ((m = /^c(\d)$/.exec(code))) return join(CASE_TERM[CASES[Number(m[1])]!]);
  if (code === 'inf') return TERMS.infinitive;
  if (code === 'adv') return TERMS.verbalAdverb;
  if (code === 'loc') return TERMS.locative;
  if ((m = /^v(\d+)$/.exec(code))) {
    const cell = VERB_CELLS[Number(m[1])];
    if (!cell) return null;
    if (cell.group === 'presfut') return { en: `${cell.person} form, ${lower(TERMS.presfut.en)}`, ru: `${cell.person}, ${TERMS.presfut.ru}` };
    if (cell.group === 'imperative') return { en: `${lower(TERMS.imperative.en)}, ${cell.person} form`, ru: `${TERMS.imperative.ru}, ${cell.person}` };
    const g = cell.key.slice(5);
    return g === 'pl' ? join(TERMS.past, TERMS.plural) : join(TERMS.past, GENDER_TERM[g as 'm' | 'f' | 'n']);
  }
  if ((m = /^a(\d+)$/.exec(code))) {
    const i = Number(m[1]);
    if (i < ADJ_EXTRA_CELL_OFFSET) return adjCell(i);
    const extra = ADJ_EXTRA[i - ADJ_EXTRA_CELL_OFFSET];
    if (extra === 'comparative') return TERMS.comparative;
    if (extra === 'superlative') return TERMS.superlative;
    if (extra) {
      const slot = extra.slice(6) as AdjSlot;
      return join(TERMS.shortForm, numberGenderTerm(slot));
    }
    return null;
  }
  if ((m = /^p:([a-z_]+):(\d+)$/.exec(code))) {
    const kind = TERMS[m[1] as ParticipleKind];
    const cell = adjCell(Number(m[2]));
    return { en: `${lower(kind.en)}, ${cell.en}`, ru: `${kind.ru}; ${cell.ru}` };
  }
  return null;
}

export const termText = (t: Term) => `${t.en} (${t.ru})`;

/** The rule behind a sentence drill question ("в + prepositional: location"), if there is one. */
export const ruleFor = (kind: string) => (kind ? explainFor(kind) : undefined);
