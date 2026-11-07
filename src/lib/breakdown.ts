/**
 * The end screen's breakdown: first-attempt results grouped by question type (the first grammar term of each
 * question's task line), or by topic when the round mixed several topics. Weakest first.
 */
import type { Round } from './queue.ts';
import type { Term } from './terms.ts';
import { topicById } from './topics.ts';
import type { Mode, Question } from './types.ts';

export interface BreakdownRow {
  key: string;
  label: Term | { en: string; ru?: undefined };
  /** set when rows are topics (mixed rounds), for Learn/Drill links */
  topic?: Mode;
  right: number;
  attempted: number;
}

/** A question's type: the first term in its task line that has both English and Russian, else the first part. */
export function typeOf(q: Pick<Question, 'task' | 'label'>): BreakdownRow['label'] {
  const term = q.task.find((p): p is Term => !!p.en && !!p.ru);
  if (term) return term;
  const first = q.task.find((p) => !!p.en);
  return { en: first?.en ?? q.label };
}

export function breakdown(round: Round<Question>): BreakdownRow[] {
  const attempted = round.entries.filter((e) => e.attempts > 0);
  const byTopic = new Set(attempted.map((e) => e.q.mode)).size > 1;
  const rows = new Map<string, BreakdownRow>();
  for (const e of attempted) {
    const label = byTopic ? (topicById(e.q.mode)?.title ?? { en: e.q.mode }) : typeOf(e.q);
    const key = byTopic ? e.q.mode : label.en;
    let row = rows.get(key);
    if (!row) rows.set(key, (row = { key, label, ...(byTopic ? { topic: e.q.mode } : {}), right: 0, attempted: 0 }));
    row.attempted++;
    if (e.firstTryCorrect) row.right++;
  }
  return [...rows.values()].sort((a, b) => a.right / a.attempted - b.right / b.attempted || b.attempted - a.attempted || (a.key < b.key ? -1 : 1));
}
