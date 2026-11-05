import { CASES, NOUN_CELLS, NOUN_INDEX, type Case } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import { pick, type Rng } from '../rng.ts';
import { CASE_TERM, TERMS, type Term } from '../terms.ts';
import type { Noun, PluralSettings, Question } from '../types.ts';

const cell = (n: Noun, k: (typeof NOUN_CELLS)[number]) => n.cells[NOUN_INDEX[k]] ?? '';

export function nounCellLabel(k: (typeof NOUN_CELLS)[number]): string {
  const [num, c] = k.split('_') as ['sg' | 'pl', Case];
  const nt = num === 'sg' ? TERMS.singular : TERMS.plural;
  return `${CASE_TERM[c].en} ${nt.en} (${CASE_TERM[c].ru}, ${nt.ru})`;
}

function nounOthers(n: Noun, except: string[]): Question['others'] {
  return NOUN_CELLS.filter((k) => !except.includes(k) && cell(n, k)).map((k) => ({ label: nounCellLabel(k), cell: cell(n, k) }));
}

const both = (a: Term, b: Term): Term => ({ en: `${a.en} ${b.en}`, ru: `${a.ru}, ${b.ru}` });
const GEN_SG = both(CASE_TERM.gen, TERMS.singular);
const GEN_PL = both(CASE_TERM.gen, TERMS.plural);
const NOM_SG = both(CASE_TERM.nom, TERMS.singular);

function base(n: Noun, key: string, task: Question['task'], answer: string, cellKeys: (typeof NOUN_CELLS)[number][], frame: string, explain?: string): Question {
  const target = cellKeys[0]!;
  return {
    key,
    mode: 'plurals',
    headword: n.accented,
    gloss: n.gloss,
    task,
    frame,
    answer,
    others: nounOthers(n, cellKeys),
    label: explain ?? nounCellLabel(target),
    explain,
    paradigm: { kind: 'noun', noun: n },
    sentence: { type: 'nouns', lemmaId: n.id, cell: NOUN_INDEX[target], band: n.band },
    speak: (f) => [frame.replace('___', '').trim(), bare(f)].filter(Boolean).join(' '),
  };
}

export function nominativePluralQuestion(n: Noun): Question | null {
  const a = cell(n, 'pl_nom');
  if (n.sgOnly || !a) return null;
  return base(n, `p:nom:${n.id}`, [both(CASE_TERM.nom, TERMS.plural)], a, ['pl_nom'], '___');
}

export function casePluralQuestion(n: Noun, c: Case): Question | null {
  const a = cell(n, `pl_${c}`);
  if (n.sgOnly || !a) return null;
  return base(n, `p:case:${n.id}:${c}`, [both(CASE_TERM[c], TERMS.plural)], a, [`pl_${c}`], '___');
}

/** Numbers a learner meets often, covering every agreement pattern (1, 2–4, 5–20, 21, 22–24, 25…). */
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 14, 15, 20, 21, 22, 23, 24, 25, 30, 31, 33, 40, 51, 52, 100, 101, 102, 105];

/** The rule: …1 (not 11) → nom. sg.; …2–4 (not 12–14) → gen. sg.; everything else → gen. pl. (or counting form). */
export function numberRule(num: number): 'nom-sg' | 'gen-sg' | 'gen-pl' {
  const last = num % 10;
  const lastTwo = num % 100;
  if (last === 1 && lastTwo !== 11) return 'nom-sg';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'gen-sg';
  return 'gen-pl';
}

export function numberQuestion(n: Noun, num: number): Question | null {
  if (n.sgOnly) return null;
  const rule = numberRule(num);
  const key = rule === 'nom-sg' ? 'sg_nom' : rule === 'gen-sg' ? 'sg_gen' : 'pl_gen';
  const answer = rule === 'gen-pl' && n.counting ? n.counting : cell(n, key);
  if (!answer) return null;
  const explain =
    rule === 'nom-sg'
      ? `After 1, 21, 31… (not 11): ${NOM_SG.en} (${NOM_SG.ru})`
      : rule === 'gen-sg'
        ? `After 2–4, 22–24… (not 12–14): ${GEN_SG.en} (${GEN_SG.ru})`
        : `After 5–20, 25–30, 11–14…: ${GEN_PL.en} (${GEN_PL.ru})${n.counting ? `; counting form ${bare(n.counting)}` : ''}`;
  return base(n, `p:num:${n.id}:${num}`, [TERMS.afterNumber], answer, [key], `${num} ___`, explain);
}

export const QUANTITY_WORDS = ['много', 'мало', 'несколько', 'сколько', 'нет'] as const;

export function quantityQuestion(n: Noun, word: (typeof QUANTITY_WORDS)[number]): Question | null {
  const genSg = cell(n, 'sg_gen');
  const genPl = cell(n, 'pl_gen');
  let answer = '';
  let keys: (typeof NOUN_CELLS)[number][] = [];
  let explain = '';
  if (n.sgOnly) {
    // Uncountable (singular-only) nouns take the genitive singular: много воды, нет времени.
    if (word === 'несколько' || !genSg) return null;
    answer = genSg;
    keys = ['sg_gen'];
    explain = `Singular-only noun after ${word}: ${GEN_SG.en} (${GEN_SG.ru})`;
  } else if (word === 'нет') {
    // нет книги / нет книг: both are correct.
    if (!genPl || !genSg) return null;
    answer = `${genPl},${genSg}`;
    keys = ['pl_gen', 'sg_gen'];
    explain = `After нет: genitive (${CASE_TERM.gen.ru}), plural or singular`;
  } else {
    answer = (word === 'сколько' || word === 'несколько') && n.counting ? n.counting : genPl;
    if (!answer) return null;
    keys = ['pl_gen'];
    explain = `After ${word}: ${GEN_PL.en} (${GEN_PL.ru})`;
  }
  return base(n, `p:qty:${n.id}:${word}`, [TERMS.afterQuantity], answer, keys, `${word} ___`, explain);
}

export function generatePluralQuestions(nouns: Noun[], s: PluralSettings, n: number, rng: Rng): Question[] {
  const contexts = s.contexts.filter((c) => c !== 'cases' || s.cases.length);
  const out: Question[] = [];
  const usedNouns = new Set<number>();
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && contexts.length && nouns.length && guard++ < n * 100) {
    const noun = pick(rng, nouns);
    if (usedNouns.has(noun.id) && usedNouns.size < nouns.length) continue;
    const ctx = pick(rng, contexts);
    const q =
      ctx === 'nom'
        ? nominativePluralQuestion(noun)
        : ctx === 'cases'
          ? casePluralQuestion(noun, pick(rng, s.cases.length ? s.cases : CASES))
          : ctx === 'numbers'
            ? numberQuestion(noun, pick(rng, NUMBERS))
            : quantityQuestion(noun, pick(rng, QUANTITY_WORDS));
    if (!q || keys.has(q.key)) continue;
    usedNouns.add(noun.id);
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
