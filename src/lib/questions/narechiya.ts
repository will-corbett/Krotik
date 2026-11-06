/** Adverbs (наречия): adjective → adverb, adverb → comparative, and adverb-or-adjective in real sentences. */
import { ADJ_EXTRA_CELL_OFFSET, ADJ_EXTRA_INDEX } from '../../shared/cells.ts';
import { bare } from '../../shared/forms.ts';
import type { AdverbRow, ClozeRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS, type TaskPart } from '../terms.ts';
import type { NarechiyaSettings, Question } from '../types.ts';
import { clozeQuestion } from './cloze.ts';

function paradigm(r: AdverbRow): Question['paradigm'] {
  const rows: { label: TaskPart[]; cell: string }[] = [
    { label: [TERMS.adjective], cell: r[1] },
    { label: [TERMS.adverb], cell: r[2] },
  ];
  if (r[3]) rows.push({ label: [TERMS.comparative], cell: r[3] });
  return { kind: 'list', rows };
}

export function adverbFormQuestion(r: AdverbRow): Question {
  return {
    key: `adv:form:${r[0]}`,
    mode: 'narechiya',
    headword: r[1],
    gloss: r[4],
    task: [TERMS.adverb],
    frame: '___',
    answer: r[2],
    others: r[3] ? [{ label: `${TERMS.comparative.en} (${TERMS.comparative.ru})`, cell: r[3] }] : [],
    label: `${TERMS.adverb.en} (${TERMS.adverb.ru})`,
    explain: /ски$/.test(bare(r[2]))
      ? 'Adjectives in -ский / -цкий give adverbs in по-…ски: русский → по-русски.'
      : 'Most adverbs from adjectives end in -о (быстрый → быстро); some soft-stem adjectives give -е (похожий → похоже). Watch the stress: it can move.',
    paradigm: paradigm(r),
    // The adverb is usually the same word as the short neuter form, so its example sentences are the adjective's.
    sentence: { type: 'adjectives', lemmaId: r[0], cell: ADJ_EXTRA_CELL_OFFSET + ADJ_EXTRA_INDEX.short_n, band: r[5] },
    speak: (f) => bare(f),
  };
}

export function adverbComparativeQuestion(r: AdverbRow): Question | null {
  if (!r[3]) return null;
  return {
    key: `adv:cmp:${r[0]}`,
    mode: 'narechiya',
    headword: r[2],
    gloss: r[4],
    task: [TERMS.comparative],
    frame: '___',
    answer: r[3],
    others: [{ label: `${TERMS.adverb.en} (${TERMS.adverb.ru})`, cell: r[2] }],
    label: `${TERMS.comparative.en} of the adverb (${TERMS.comparative.ru})`,
    explain: 'An adverb’s comparative is the same word as the adjective’s: быстро → быстрее (он бегает быстрее меня). по- adds “a little”: побыстрее.',
    paradigm: paradigm(r),
    sentence: { type: 'adjectives', lemmaId: r[0], cell: ADJ_EXTRA_CELL_OFFSET + ADJ_EXTRA_INDEX.comparative, band: r[5] },
    speak: (f) => bare(f),
  };
}

export function generateNarechiyaQuestions(rows: AdverbRow[], cloze: ClozeRow[], s: NarechiyaSettings, maxBand: number, n: number, rng: Rng): Question[] {
  const pool = rows.filter((r) => r[5] <= maxBand);
  const withCmp = pool.filter((r) => r[3]);
  const types = s.types.filter((t) => (t === 'sentence' ? cloze.length : t === 'comparative' ? withCmp.length : pool.length));
  const out: Question[] = [];
  const keys = new Set<string>();
  let guard = 0;
  while (out.length < n && types.length && guard++ < n * 50) {
    const t = pick(rng, types);
    const q =
      t === 'form' ? adverbFormQuestion(pick(rng, pool))
      : t === 'comparative' ? adverbComparativeQuestion(pick(rng, withCmp))
      : { ...clozeQuestion(pick(rng, cloze), 'narechiya'), task: [TERMS.adverbOrAdjective] };
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}
