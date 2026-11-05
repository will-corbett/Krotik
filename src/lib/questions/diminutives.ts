import { bare, displayForms } from '../../shared/forms.ts';
import type { DiminutiveRow } from '../../shared/types.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { DiminutiveSettings, Question } from '../types.ts';

function paradigm(row: DiminutiveRow): Question['paradigm'] {
  return {
    kind: 'list',
    rows: [
      { label: [TERMS.baseNoun], cell: row[1] },
      { label: [TERMS.diminutive], cell: row[3] },
    ],
  };
}

/** Noun → any diminutive Wiktionary lists (дом → до'мик, домо'к). */
export function toDiminutiveQuestion(row: DiminutiveRow): Question {
  return {
    key: `dim:to:${row[0]}`,
    mode: 'diminutives',
    headword: row[1],
    gloss: row[2],
    task: [TERMS.diminutive],
    frame: '___',
    answer: row[3],
    others: [],
    label: `${TERMS.diminutive.en} (${TERMS.diminutive.ru})`,
    paradigm: paradigm(row),
    speak: (f) => bare(f),
  };
}

/** Diminutive → the noun it comes from. */
export function fromDiminutiveQuestion(row: DiminutiveRow, dim: string): Question {
  return {
    key: `dim:from:${row[0]}:${dim}`,
    mode: 'diminutives',
    headword: dim,
    gloss: `diminutive of “${row[2]}”`,
    task: [TERMS.baseNoun],
    frame: '___',
    answer: row[1],
    others: [],
    label: `${TERMS.baseNoun.en} (${TERMS.baseNoun.ru})`,
    paradigm: paradigm(row),
    speak: (f) => bare(f),
  };
}

export function generateDiminutiveQuestions(rows: DiminutiveRow[], s: DiminutiveSettings, n: number, rng: Rng): Question[] {
  const out: Question[] = [];
  const used = new Set<number>();
  if (!rows.length || !s.directions.length) return out;
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const row = pick(rng, rows);
    if (used.has(row[0]) && used.size < rows.length) continue;
    const dir = pick(rng, s.directions);
    const q = dir === 'to' ? toDiminutiveQuestion(row) : fromDiminutiveQuestion(row, pick(rng, displayForms(row[3])));
    used.add(row[0]);
    out.push(q);
  }
  return out;
}
