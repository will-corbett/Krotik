import type { Aspect } from '../../src/shared/cells.ts';
import { VERB_CELLS } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cleanCell } from './cell.ts';
import { cleanGloss, suspiciousWords } from './glosses.ts';
import type { Report } from './report.ts';
import type { TypeOverrides } from './overrides.ts';

export interface Verb {
  id: number; // source row number (1-based, header excluded) — stable across regenerations
  bare: string;
  accented: string;
  gloss: string;
  aspect: Aspect;
  partners: string[]; // accented infinitives
  cells: string[]; // VERB_CELLS order
}

const SRC_COLS: Record<(typeof VERB_CELLS)[number]['key'], string> = {
  pf_sg1: 'presfut_sg1', pf_sg2: 'presfut_sg2', pf_sg3: 'presfut_sg3',
  pf_pl1: 'presfut_pl1', pf_pl2: 'presfut_pl2', pf_pl3: 'presfut_pl3',
  past_m: 'past_m', past_f: 'past_f', past_n: 'past_n', past_pl: 'past_pl',
  imp_sg: 'imperative_sg', imp_pl: 'imperative_pl',
};
const ASPECT: Record<string, Aspect> = { imperfective: 'impf', perfective: 'pf', both: 'both' };
const S = 'Verbs';
export const GLOSS_CHECK_TOP = 2500;

export function cleanVerbs(raw: Record<string, string>[], rowIds: Map<Record<string, string>, number>, ov: TypeOverrides | undefined, report: Report): Verb[] {
  // Homographs share a bare form (засы'пать pf "fill" / засыпа'ть impf "fall asleep"), so keep all rows per bare.
  const byBare = new Map<string, Record<string, string>[]>();
  for (const r of raw) {
    const list = byBare.get(r.bare!);
    if (list) list.push(r);
    else byBare.set(r.bare!, [r]);
  }

  const out: Verb[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const bare = r.bare!;
    const key = r.accented || bare;
    if (seen.has(key)) {
      report.drop(S, 'duplicate entry (same accented form; kept the earlier row)', bare);
      continue;
    }
    const aspect = ASPECT[r.aspect ?? ''];
    if (!aspect) {
      report.drop(S, 'missing aspect', bare);
      continue;
    }
    const cells: string[] = [];
    let dropReason = '';
    for (const c of VERB_CELLS) {
      const v = r[SRC_COLS[c.key]] ?? '';
      if (v === '-') {
        cells.push(''); // intentionally absent (override)
        continue;
      }
      const res = cleanCell(v);
      if (res.ok) cells.push(res.cell);
      else if (c.group === 'imperative') {
        cells.push('');
        if (res.reason !== 'empty form') report.count(S, `imperative dropped (${res.reason}), verb kept`);
      } else {
        dropReason = `${c.group} ${c.person}: ${res.reason}`;
        break;
      }
    }
    if (dropReason) {
      report.drop(S, dropReason.replace(/^(\S+) \S+:/, '$1:'), bare);
      continue;
    }
    seen.add(key);
    // Keep only partners of the opposite aspect (the source has some same-aspect "partners",
    // e.g. носить → наносить); those are reported, not drilled.
    const partners: string[] = [];
    for (const p of (r.partner ?? '').split(';').map((x) => x.trim()).filter((x) => x && x !== '-')) {
      const cands = byBare.get(p) ?? [];
      const want: Aspect = aspect === 'pf' ? 'impf' : 'pf';
      const pr: Record<string, string> | undefined = cands.find((c) => ASPECT[c.aspect ?? ''] === want) ?? cands[0];
      const pAspect: Aspect | undefined = ASPECT[pr?.aspect ?? ''];
      if (!pr || !pAspect) {
        report.anomaly(S, 'partner not found in source (ignored)', `${bare} → ${p}`);
        continue;
      }
      if (aspect === 'both' || pAspect === 'both' || pAspect === aspect) {
        report.anomaly(S, 'partner not of the opposite aspect (ignored for aspect drill)', `${bare} (${aspect}) → ${p} (${pAspect})`);
        continue;
      }
      if (!partners.includes(pr.accented!)) partners.push(pr.accented!);
    }
    const gloss = ov?.gloss?.[bare] ?? cleanGloss(r.translations_en ?? '');
    if (!gloss) report.count(S, 'kept without an English gloss');
    out.push({ id: rowIds.get(r)!, bare, accented: r.accented || bare, gloss, aspect, partners, cells });
  }

  validateVerbs(out, report, ov);
  return out;
}

const MIXED_CONJ = /(хотеть|бежать|чтить|дать|есть|быть)(ся)?$/; // known mixed/irregular conjugations

function stripRefl(s: string) {
  return s.replace(/(ся|сь)$/, '');
}

function validateVerbs(verbs: Verb[], report: Report, ov?: TypeOverrides) {
  verbs.forEach((v, rank) => {
    const first = (i: number) => normalise(stripRefl(cellForms(v.cells[i]!)[0] ?? ''));
    // past tense endings
    const [m, f, n, pl] = [6, 7, 8, 9].map(first) as [string, string, string, string];
    if (m && (!f.endsWith('ла') || !n.endsWith('ло') || !pl.endsWith('ли'))) {
      report.anomaly(S, 'past f/n/pl not ending -ла/-ло/-ли', `${v.bare}: ${f}/${n}/${pl}`);
    } else if (m && !m.endsWith('л')) {
      report.count(S, 'past masculine without -л (мог/шёл type; f/n/pl checked)');
    }
    // conjugation consistency
    const p = [0, 1, 2, 3, 4, 5].map(first);
    if (p[0] && !MIXED_CONJ.test(v.bare)) {
      const sg2 = p[1]!;
      const second = /ишь$/.test(sg2);
      const firstConj = /[её]шь$/.test(sg2);
      const ok = second
        ? /ит$/.test(p[2]!) && /им$/.test(p[3]!) && /ите$/.test(p[4]!) && /[ая]т$/.test(p[5]!)
        : firstConj
          ? /[её]т$/.test(p[2]!) && /[её]м$/.test(p[3]!) && /[её]те$/.test(p[4]!) && /[ую]т$/.test(p[5]!)
          : false;
      if (!ok) report.anomaly(S, 'present/future endings not consistent with 1st or 2nd conjugation', `${v.bare}: ${p.join(' ')}`);
    }
    // partners
    if (v.aspect === 'pf' && !v.partners.length) report.count(S, 'perfective with no imperfective partner (normal for e.g. пойти, закричать)');
    if (v.cells.slice(0, 6).every((c) => c) && new Set(v.cells.slice(0, 6)).size === 1) {
      report.anomaly(S, 'all six present/future forms identical', v.bare);
    }
    if (rank < GLOSS_CHECK_TOP) {
      const sus = suspiciousWords(v.gloss);
      if (sus.length && !ov?.gloss?.[v.bare]) report.anomaly(S, `gloss words not in English word list (top ${GLOSS_CHECK_TOP})`, `${v.bare}: "${v.gloss}" [${sus.join(', ')}]`);
    }
  });
}
