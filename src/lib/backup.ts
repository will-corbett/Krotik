/**
 * Moving your progress to another device or browser: one file with both opt-in records (topic progress and your
 * words), saved on your own device and read back there. Nothing is uploaded. Importing merges with what's already in
 * this browser, and anything malformed is dropped. A word list exported before topic progress was included
 * ({ v: 1, words }) still imports.
 */
import { emptyProgress, type Progress, type TopicRecord } from './progress.ts';
import { emptyWords, mergeWords, parseWords, type MyWords } from './words.ts';
import type { Mode } from './types.ts';

export interface Backup {
  krotik: 1;
  progress: Progress;
  words: MyWords;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const nat = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;

function validTopic(r: unknown): r is TopicRecord {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    nat(o.rounds) && nat(o.attempted) && nat(o.right) && (o.right as number) <= (o.attempted as number) &&
    typeof o.last === 'string' && DATE_RE.test(o.last) &&
    Array.isArray(o.recent) && o.recent.length <= 5 &&
    o.recent.every((x) => Array.isArray(x) && x.length === 2 && nat(x[0]) && nat(x[1]) && x[0] <= x[1])
  );
}

/** Only well-formed topic records, for topics that exist (`isMode`). */
export function parseProgressData(p: unknown, isMode: (m: string) => boolean): Progress {
  const out = emptyProgress();
  const topics = (p as { topics?: unknown } | null)?.topics;
  if (!topics || typeof topics !== 'object') return out;
  for (const [m, r] of Object.entries(topics as Record<string, unknown>)) {
    if (isMode(m) && validTopic(r)) out.topics[m as Mode] = { rounds: r.rounds, attempted: r.attempted, right: r.right, last: r.last, recent: r.recent.map(([a, b]) => [a, b]) };
  }
  return out;
}

/** For a topic in both, keep the record practised more recently (then the one with more rounds). */
export function mergeProgress(mine: Progress, incoming: Progress): Progress {
  const topics = { ...mine.topics };
  for (const [m, r] of Object.entries(incoming.topics) as [Mode, TopicRecord][]) {
    const old = topics[m];
    if (!old || r.last > old.last || (r.last === old.last && r.rounds > old.rounds)) topics[m] = r;
  }
  return { v: 1, topics };
}

export const exportBackup = (progress: Progress, words: MyWords): string => JSON.stringify({ krotik: 1, progress, words } satisfies Backup, null, 1);

/** A backup file, or an old words-only file; null if it's neither. */
export function parseBackup(json: string, isMode: (m: string) => boolean): Backup | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const o = data as Record<string, unknown> | null;
  if (o && o.krotik === 1) {
    return { krotik: 1, progress: parseProgressData(o.progress, isMode), words: parseWords(JSON.stringify(o.words ?? {})) ?? emptyWords() };
  }
  const words = parseWords(json);
  return words ? { krotik: 1, progress: emptyProgress(), words } : null;
}

export function mergeBackup(mine: { progress: Progress; words: MyWords }, incoming: Backup): { progress: Progress; words: MyWords } {
  return { progress: mergeProgress(mine.progress, incoming.progress), words: mergeWords(mine.words, incoming.words) };
}
