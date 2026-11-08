/**
 * Opt-in progress, kept only in this browser (localStorage key `krotik.progress.v1`), never sent anywhere.
 * Off by default (`settings.progress`); turning it off deletes the record. Learn-page quick checks and the Grammar
 * test aren't recorded. Per topic: rounds, first-attempt results, the date last practised, and the last five
 * rounds' results (for weak topics). Nothing about individual words or answers is kept.
 */
import type { Round } from './queue.ts';
import type { Mode, Question } from './types.ts';

export const PROGRESS_KEY = 'krotik.progress.v1';
/** How many recent rounds per topic count towards "weak". */
export const RECENT = 5;
/** A topic is weak when its recent first-attempt score is under this… */
export const WEAK_BELOW = 0.8;
/** …over at least this many recent questions. */
export const WEAK_MIN = 8;
/** A topic is due for revision this many days after you last practised it. */
export const DUE_DAYS = 14;

export interface TopicRecord {
  rounds: number;
  attempted: number;
  right: number;
  /** YYYY-MM-DD, local time */
  last: string;
  /** [right, attempted] for the last RECENT rounds, oldest first */
  recent: [number, number][];
}
export interface Progress {
  v: 1;
  topics: Partial<Record<Mode, TopicRecord>>;
}

export const emptyProgress = (): Progress => ({ v: 1, topics: {} });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const p = raw ? (JSON.parse(raw) as Progress) : null;
    return p && p.v === 1 && typeof p.topics === 'object' ? p : emptyProgress();
  } catch {
    return emptyProgress();
  }
}
export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress just isn't kept */
  }
}
export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* nothing to clear */
  }
}

export const today = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Add a finished round (each attempted question counted under its own topic, so mixed rounds split up). */
export function recordRound(p: Progress, round: Round<Question>, date: string): Progress {
  const byTopic = new Map<Mode, [number, number]>();
  for (const e of round.entries) {
    if (e.attempts === 0) continue;
    const t = byTopic.get(e.q.mode) ?? [0, 0];
    byTopic.set(e.q.mode, [t[0] + (e.firstTryCorrect ? 1 : 0), t[1] + 1]);
  }
  const topics = { ...p.topics };
  for (const [mode, [right, attempted]] of byTopic) {
    const old = topics[mode] ?? { rounds: 0, attempted: 0, right: 0, last: date, recent: [] };
    topics[mode] = {
      rounds: old.rounds + 1,
      attempted: old.attempted + attempted,
      right: old.right + right,
      last: date,
      recent: [...old.recent, [right, attempted] as [number, number]].slice(-RECENT),
    };
  }
  return { v: 1, topics };
}

export interface Summary {
  /** recent score under WEAK_BELOW, weakest first */
  weak: { mode: Mode; percent: number }[];
  /** not practised for DUE_DAYS or more (and not weak), longest ago first */
  due: { mode: Mode; days: number }[];
  /** every topic practised, most recent first */
  all: { mode: Mode; rounds: number; percent: number; last: string }[];
}

/** Translation and sentence building are self-marked, so they're listed but never suggested as weak or due. */
export function summarise(p: Progress, date: string): Summary {
  const entries = Object.entries(p.topics) as [Mode, TopicRecord][];
  const recentPct = (r: TopicRecord) => {
    const [right, n] = r.recent.reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
    return { n, pct: n ? right / n : 1 };
  };
  const weak = entries
    .filter(([m, r]) => m !== 'translate' && m !== 'build' && recentPct(r).n >= WEAK_MIN && recentPct(r).pct < WEAK_BELOW)
    .map(([mode, r]) => ({ mode, percent: Math.round(100 * recentPct(r).pct) }))
    .sort((a, b) => a.percent - b.percent || (a.mode < b.mode ? -1 : 1));
  const weakSet = new Set(weak.map((w) => w.mode));
  const due = entries
    .filter(([m, r]) => m !== 'translate' && m !== 'build' && !weakSet.has(m) && daysBetween(r.last, date) >= DUE_DAYS)
    .map(([mode, r]) => ({ mode, days: daysBetween(r.last, date) }))
    .sort((a, b) => b.days - a.days || (a.mode < b.mode ? -1 : 1));
  const all = entries
    .map(([mode, r]) => ({ mode, rounds: r.rounds, percent: r.attempted ? Math.round((100 * r.right) / r.attempted) : 0, last: r.last }))
    .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : a.mode < b.mode ? -1 : 1));
  return { weak, due, all };
}
