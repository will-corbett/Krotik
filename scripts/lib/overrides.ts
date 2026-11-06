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
    const fix = ov.fix?.[bare];
    if (fix && !seenFix.has(bare)) {
      seenFix.add(bare); // only the first (most frequent) row with this bare form
      for (const [col, val] of Object.entries(fix)) {
        if (!(col in row)) throw new Error(`override for ${bare}: unknown column ${col}`);
        row[col] = val;
      }
      log('fixed by override', `${bare}: ${Object.keys(fix).join(', ')}`);
    }
    out.push(row);
  }
  for (const k of Object.keys(ov.fix ?? {})) if (!seenFix.has(k)) log('override target not found', k);
  return out;
}
