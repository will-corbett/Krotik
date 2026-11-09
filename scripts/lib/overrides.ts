import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * Hand-maintained corrections applied to raw source rows before cleaning,
 * so they survive regeneration. Keys are the source `bare` field.
 */
export interface TypeOverrides {
  /** bare → reason */
  exclude?: Record<string, string>;
  /** bare → { source column: replacement raw value ("-" = intentionally absent) } */
  fix?: Record<string, Record<string, string>>;
  /** bare → English gloss to use instead of the cleaned source gloss */
  gloss?: Record<string, string>;
}
export interface Overrides {
  verbs?: TypeOverrides;
  adjectives?: TypeOverrides;
  /** counting: bare → form used after numbers / сколько / несколько (пять челове'к, пять ле'т) */
  nouns?: TypeOverrides & { counting?: Record<string, string> };
  sentences?: { deny?: Record<string, string> };
  /** adverbs.exclude: adjective bare → reason; that adjective gets no adverb question (the pairing is wrong or misleading) */
  adverbs?: { exclude?: Record<string, string> };
  /** vocab.exclude: word (bare, as in the source) → reason; left out of the Vocabulary drill's word lists */
  vocab?: { exclude?: Record<string, string>; gloss?: Record<string, string>; keep?: Record<string, string> };
}

export function loadOverrides(path = 'overrides/overrides.yaml'): Overrides {
  return (parse(readFileSync(path, 'utf8')) ?? {}) as Overrides;
}

/** Apply exclude/fix to raw rows. Returns rows with overrides merged; records what was applied. */
export function applyOverrides(
  rows: Record<string, string>[],
  ov: TypeOverrides | undefined,
  log: (kind: string, item: string) => void,
): Record<string, string>[] {
  if (!ov) return rows;
  const seenFix = new Set<string>();
  const out: Record<string, string>[] = [];
  for (const row of rows) {
    const bare = row.bare!;
    if (ov.exclude && bare in ov.exclude) {
      log('excluded by override', `${bare} (${ov.exclude[bare]})`);
      continue;
    }
    // A key "bare@accented" fixes that exact row (where two source rows share a spelling and the first is the wrong
    // one); a plain "bare" key fixes the first (most frequent) row with that spelling.
    const exactKey = `${bare}@${row.accented}`;
    const key = ov.fix?.[exactKey] && !seenFix.has(exactKey) ? exactKey : ov.fix?.[bare] && !seenFix.has(bare) ? bare : '';
    const fix = key ? ov.fix![key] : undefined;
    if (fix) {
      seenFix.add(key);
      for (const [col, val] of Object.entries(fix)) {
        if (!(col in row)) throw new Error(`override for ${bare}: unknown column ${col}`);
        row[col] = val;
      }
      log('fixed by override', `${key}: ${Object.keys(fix).join(', ')}`);
    }
    out.push(row);
  }
  for (const k of Object.keys(ov.fix ?? {})) if (!seenFix.has(k)) log('override target not found', k);
  return out;
}
