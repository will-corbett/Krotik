import { VERB_CELLS, VERB_INFINITIVE_CELL } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import type { VerbRow } from '../../shared/types.ts';
import { pick, shuffle, type Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { PrefixedMotionSettings, Question, Verb } from '../types.ts';
import { toVerb } from '../data.ts';
import { verbFormQuestion } from './verbs.ts';

export interface PrefixedPair { prefix: string; en: string; ru: string; base: string; pf: number; impf: number }
export interface PrefixedData { pairs: PrefixedPair[]; verbs: VerbRow[]; bands: Record<string, number> }

export function prefixedMeaningQuestion(p: PrefixedPair, v: Verb, partner: Verb): Question {
  const aspect = v.aspect === 'pf' ? TERMS.pf : TERMS.impf;
  return {
    key: `pm:meaning:${v.id}`,
    mode: 'prefixedMotion',
    headword: `${p.en} — ${p.base}`,
    headwordIsEnglish: true,
    gloss: `prefix ${p.prefix}- (${p.ru})`,
    task: [aspect],
    answer: v.accented,
    others: [{ label: `the ${v.aspect === 'pf' ? 'imperfective' : 'perfective'} partner (${v.aspect === 'pf' ? TERMS.impf.ru : TERMS.pf.ru})`, cell: partner.accented }],
    label: `${p.prefix}-: ${p.en}, ${p.base}, ${aspect.en}`,
    explain: `${p.prefix}- = ${p.en} (${p.ru}). Prefix + unidirectional verb → perfective (${bare(p.pf === v.id ? v.accented : partner.accented)}); prefix + multidirectional stem → imperfective (${bare(p.impf === v.id ? v.accented : partner.accented)}).`,
    paradigm: { kind: 'verb', verb: v },
    sentence: { type: 'verbs', lemmaId: v.id, cell: VERB_INFINITIVE_CELL, band: v.band },
    speak: (f) => bare(f),
  };
}

export function prefixedPairQuestion(p: PrefixedPair, from: Verb, to: Verb): Question {
  const target = to.aspect === 'pf' ? TERMS.pf : TERMS.impf;
  return {
    key: `pm:pair:${from.id}`,
    mode: 'prefixedMotion',
    headword: from.accented,
    gloss: from.gloss,
    task: [from.aspect === 'pf' ? TERMS.pf : TERMS.impf, { en: `→ give the ${target.en} partner`, ru: `→ ${target.ru}` }],
    answer: to.accented,
    others: [],
    label: `${target.en} partner (${target.ru})`,
    explain: `${p.prefix}- = ${p.en} (${p.ru}).`,
    paradigm: { kind: 'verb', verb: to },
    sentence: { type: 'verbs', lemmaId: to.id, cell: VERB_INFINITIVE_CELL, band: to.band },
    speak: (f) => bare(f),
  };
}

export function generatePrefixedMotion(data: PrefixedData, s: PrefixedMotionSettings, n: number, rng: Rng): Question[] {
  const verbs = new Map(data.verbs.map((r) => [r[0], toVerb(r, data.bands[r[0]] ?? 0)]));
  const all: Question[] = [];
  for (const p of data.pairs) {
    const pf = verbs.get(p.pf);
    const impf = verbs.get(p.impf);
    if (!pf || !impf) continue;
    if (s.types.includes('meaning')) all.push(prefixedMeaningQuestion(p, pf, impf), prefixedMeaningQuestion(p, impf, pf));
    if (s.types.includes('pair')) all.push(prefixedPairQuestion(p, pf, impf), prefixedPairQuestion(p, impf, pf));
    if (s.types.includes('conjugate')) {
      for (const v of [pf, impf]) {
        const groups = s.groups?.length ? s.groups : (['presfut', 'past'] as const);
        const cells = VERB_CELLS.map((c, i) => [c, i] as const).filter(([c, i]) => (groups as readonly string[]).includes(c.group) && v.cells[i]);
        if (cells.length) {
          const [, i] = pick(rng, cells);
          all.push({ ...verbFormQuestion(v, i, 'prefixedMotion'), key: `pm:conj:${v.id}:${i}` });
        }
      }
    }
  }
  return shuffle(rng, all).slice(0, n);
}
