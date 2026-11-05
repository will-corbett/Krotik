import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OUT_DIR = 'public/data';
/** Upper rank bounds of each band; the last band is "everything else". */
export const BANDS = [250, 1000, 2500, Infinity];

export function bandOf(rank: number): number {
  return BANDS.findIndex((b) => rank < b);
}

export function writeJson(file: string, data: unknown): number {
  mkdirSync(OUT_DIR, { recursive: true });
  const s = JSON.stringify(data);
  writeFileSync(join(OUT_DIR, file), s + '\n');
  return Buffer.byteLength(s);
}

/** Split rows into band shards by the rank of the underlying lemma (rows may skip lemmas). */
export function writeBandsByRank<T>(type: string, rows: T[], rankOf: (row: T) => number): { band: number; file: string; count: number; bytes: number }[] {
  const out = [];
  for (let b = 0; b < BANDS.length; b++) {
    const slice = rows.filter((r) => bandOf(rankOf(r)) === b);
    const file = `${type}.b${b}.json`;
    out.push({ band: b, file, count: slice.length, bytes: writeJson(file, slice) });
  }
  return out;
}

/** Split rank-ordered rows into band shards. */
export function writeBands<T>(type: string, rows: T[]): { band: number; file: string; count: number; bytes: number }[] {
  const out = [];
  let start = 0;
  for (let b = 0; b < BANDS.length; b++) {
    const end = Math.min(BANDS[b]!, rows.length);
    const slice = rows.slice(start, end);
    const file = `${type}.b${b}.json`;
    out.push({ band: b, file, count: slice.length, bytes: writeJson(file, slice) });
    start = end;
  }
  return out;
}
