/**
 * Register labels for the vocabulary lists (critique batch 5): colloquial, slang, bookish (literary), poetic, formal,
 * humorous, derogatory, vulgar, offensive. From Wiktionary (the extract's `registers`), corrected by
 * curated/registers.yaml. Added to each word row as its sixth field.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { WordRow } from '../../src/shared/types.ts';
import type { Report } from './report.ts';

const S = 'Register labels (Wiktionary, curated/registers.yaml)';
export const REGISTER_LABELS = ['colloquial', 'slang', 'literary', 'poetic', 'formal', 'humorous', 'derogatory', 'vulgar', 'offensive'] as const;

export function withRegisters(rows: WordRow[], wk: Record<string, string>, report: Report, cur = parse(readFileSync('curated/registers.yaml', 'utf8')) as { exclude?: Record<string, string>; set?: Record<string, string> }): WordRow[] {
  for (const l of Object.values(cur.set ?? {})) if (!(REGISTER_LABELS as readonly string[]).includes(l)) throw new Error(`curated/registers.yaml: unknown label ${l}`);
  return rows.map((r) => {
    const bare = r[1].replace(/'/g, '').split(',')[0]!;
    const label = cur.exclude?.[bare] !== undefined ? undefined : (cur.set?.[bare] ?? wk[`${bare}|${r[3]}`]);
    if (!label) return r;
    report.count(S, `words labelled ${label}`);
    return [r[0], r[1], r[2], r[3], r[4], label] as WordRow;
  });
}
