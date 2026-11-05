import { ADJ_CELLS, ADJ_SLOTS, CASES, type AdjCellKey } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cleanCell } from './cell.ts';
import { GLOSS_CHECK_TOP } from './clean-verbs.ts';
import { cleanGloss, suspiciousWords } from './glosses.ts';
import type { TypeOverrides } from './overrides.ts';
import type { Report } from './report.ts';

export interface Adjective {
  id: number;
  bare: string;
  accented: string;
  gloss: string;
  cells: string[]; // ADJ_CELLS order
  pronominal: boolean; // тот/этот/мой… (no regular -ый/-ий/-ой ending)
}
const S = 'Adjectives';

/**
 * Split an m/pl accusative cell into inanimate and animate cells by matching each
 * variant to the nominative (inanimate) or genitive (animate). The source order of
 * "inanimate, animate" is not reliable (e.g. "большо'го,большо'й"), so position is never used.
 */
export function splitAccusative(acc: string, nom: string, gen: string): { inan: string; anim: string; filled?: 'inan' | 'anim' } | null {
  const nomSet = new Set(cellForms(nom).map(normalise));
  const genSet = new Set(cellForms(gen).map(normalise));
  const inan: string[] = [];
  const anim: string[] = [];
  for (const raw of acc.split(',')) {
    const f = raw.replace(/[()]/g, '');
    const n = normalise(f);
    const inNom = nomSet.has(n);
    const inGen = genSet.has(n);
    if (!inNom && !inGen) return null;
    if (inNom) inan.push(raw);
    if (inGen) anim.push(raw);
  }
  // Source often lists only one of the two. For m/pl long adjectives accusative is, without
  // exception, nominative (inanimate) or genitive (animate), so the missing one is the
  // source's own nom/gen cell — not a generated form. Counted in the report.
  if (!inan.length && !anim.length) return null;
  if (!anim.length) return { inan: inan.join(','), anim: gen, filled: 'anim' };
  if (!inan.length) return { inan: nom, anim: anim.join(','), filled: 'inan' };
  return { inan: inan.join(','), anim: anim.join(',') };
}

export function cleanAdjectives(raw: Record<string, string>[], rowIds: Map<Record<string, string>, number>, ov: TypeOverrides | undefined, report: Report): Adjective[] {
  const out: Adjective[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const bare = r.bare!;
    const declCols = ADJ_SLOTS.flatMap((s) => CASES.map((c) => `decl_${s}_${c}`));
    if (declCols.every((c) => !r[c])) {
      report.drop(S, 'no declension in source (not an adjective, e.g. как)', bare);
      continue;
    }
    if (seen.has(bare)) {
      report.drop(S, 'duplicate bare form (kept the earlier row)', bare);
      continue;
    }
    const src: Record<string, string> = {};
    let dropReason = '';
    for (const col of declCols) {
      const res = cleanCell(r[col] ?? '');
      if (!res.ok) {
        dropReason = `${col.replace('decl_', '')}: ${res.reason}`;
        break;
      }
      src[col.replace('decl_', '')] = res.cell;
    }
    if (dropReason) {
      report.drop(S, dropReason.replace(/^\S+:/, (m) => m.replace(/_(nom|gen|dat|acc|inst|prep)/, ' $1')), bare);
      continue;
    }
    seen.add(bare);
    const cells: Record<AdjCellKey, string> = {} as Record<AdjCellKey, string>;
    for (const k of ADJ_CELLS) cells[k] = src[k] ?? '';
    for (const slot of ['m', 'pl'] as const) {
      const split = splitAccusative(src[`${slot}_acc`]!, src[`${slot}_nom`]!, src[`${slot}_gen`]!);
      if (split) {
        if (split.filled) report.count(S, `${slot} accusative: ${split.filled === 'anim' ? 'animate taken from genitive' : 'inanimate taken from nominative'} (source listed one variant)`);
        cells[`${slot}_acc`] = split.inan;
        cells[`${slot}_acc_anim`] = split.anim;
      } else {
        // Can't tell which is which: drop both accusative cells for this slot (questions skip them).
        cells[`${slot}_acc`] = '';
        cells[`${slot}_acc_anim`] = '';
        report.anomaly(S, `${slot} accusative not resolvable to nom (inanimate) + gen (animate); cells disabled`, `${bare}: acc "${src[`${slot}_acc`]}" nom "${src[`${slot}_nom`]}" gen "${src[`${slot}_gen`]}"`);
      }
    }
    const nNom = new Set(cellForms(src.n_nom!).map(normalise));
    if (!cellForms(src.n_acc!).some((f) => nNom.has(normalise(f)))) {
      report.drop(S, 'neuter accusative differs from neuter nominative (likely shifted columns)', `${bare}: ${src.n_acc} / ${src.n_nom}`);
      continue;
    }
    const mNom = normalise(cellForms(src.m_nom!)[0]!);
    const fNom = normalise(cellForms(src.f_nom!)[0]!);
    // Pronominal (тот, этот, мой…) and possessive -ий/-ья (третий, божий) declensions are not regular.
    const pronominal = !/(ый|ий|ой)$/.test(mNom) || PRONOMINAL.has(bare) || (/ий$/.test(mNom) && /ья$/.test(fNom));
    if (!pronominal) {
      const bad = patternErrors(src);
      if (bad.length) {
        report.drop(S, 'forms not following the adjective gender/case pattern', `${bare} (${bad.join(' ')})`);
        continue;
      }
    }
    const gloss = ov?.gloss?.[bare] ?? cleanGloss(r.translations_en ?? '');
    if (out.length < GLOSS_CHECK_TOP) {
      const sus = suspiciousWords(gloss);
      if (sus.length && !ov?.gloss?.[bare]) report.anomaly(S, `gloss words not in English word list (top ${GLOSS_CHECK_TOP})`, `${bare}: "${gloss}" [${sus.join(', ')}]`);
    }
    out.push({ id: rowIds.get(r)!, bare, accented: r.accented || bare, gloss, cells: ADJ_CELLS.map((k) => cells[k]), pronominal });
  }
  report.count(S, 'pronominal or possessive -ий declension (pattern check skipped)', out.filter((a) => a.pronominal).length);
  return out;
}

/** Expected endings for regular long-form adjectives (first variant, ё→е, reflexive-free). */
const PATTERN: Record<string, RegExp> = {
  m_nom: /(ый|ий|ой)$/, m_gen: /(ого|его)$/, m_dat: /(ому|ему)$/, m_inst: /(ым|им)$/, m_prep: /(ом|ем)$/,
  f_nom: /(ая|яя)$/, f_gen: /(ой|ей)$/, f_dat: /(ой|ей)$/, f_acc: /(ую|юю)$/, f_inst: /(ой|ою|ей|ею)$/, f_prep: /(ой|ей)$/,
  n_nom: /(ое|ее)$/, n_gen: /(ого|его)$/, n_dat: /(ому|ему)$/, n_inst: /(ым|им)$/, n_prep: /(ом|ем)$/,
  pl_nom: /(ые|ие)$/, pl_gen: /(ых|их)$/, pl_dat: /(ым|им)$/, pl_inst: /(ыми|ими)$/, pl_prep: /(ых|их)$/,
};
function patternErrors(src: Record<string, string>): string[] {
  const bad: string[] = [];
  for (const [k, re] of Object.entries(PATTERN)) {
    const forms = cellForms(src[k]!).map(normalise);
    if (!forms.every((f) => re.test(f))) bad.push(`${k}=${forms.join('/')}`);
  }
  return bad;
}
const PRONOMINAL = new Set(['мой', 'твой', 'свой', 'кой', 'сам', 'сей', 'весь', 'наш', 'ваш', 'чей']);
