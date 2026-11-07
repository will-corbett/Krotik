/**
 * "My words": an opt-in, per-word spaced-repetition record, kept only in this browser (localStorage key
 * `krotik.words.v1`) and never sent anywhere. It exists only while progress is on (`settings.progress`); turning that
 * off deletes it. For each word: its key (e.g. "v:123"), the frequency band it's in (so a review loads only the files it
 * needs), its Leitner box and the dates it was added and is next due. Nothing else: no answers, no typed text, no times.
 */
export const WORDS_KEY = 'krotik.words.v1';
/** Days until the next review after a right first answer: moving up to box n waits INTERVALS[n - 1] days. */
export const INTERVALS = [1, 3, 7, 14, 30, 60];
/** Boxes run from 0 (new, or just missed) to MAX_BOX (60 days between reviews). */
export const MAX_BOX = INTERVALS.length;

export interface WordRecord {
  /** frequency band (0–3) */
  b: number;
  /** Leitner box, 0 (new or just missed) to MAX_BOX */
  box: number;
  /** YYYY-MM-DD: when it's next due */
  due: string;
  /** YYYY-MM-DD: when it was added */
  added: string;
}
export interface MyWords {
  v: 1;
  words: Record<string, WordRecord>;
}

const KEY_RE = /^(?:[nva]:\d+|o:[а-яё-]+)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const emptyWords = (): MyWords => ({ v: 1, words: {} });

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Only well-formed entries survive (used for storage and for imported files alike). */
function validRecord(r: unknown): r is WordRecord {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    Number.isInteger(o.b) && (o.b as number) >= 0 && (o.b as number) <= 3 &&
    Number.isInteger(o.box) && (o.box as number) >= 0 && (o.box as number) <= MAX_BOX &&
    typeof o.due === 'string' && DATE_RE.test(o.due) &&
    typeof o.added === 'string' && DATE_RE.test(o.added)
  );
}
/** Parse a stored or imported record; anything unrecognised is dropped. Returns null if it isn't a word record at all. */
export function parseWords(json: string): MyWords | null {
  try {
    const p = JSON.parse(json) as { v?: unknown; words?: unknown };
    if (p?.v !== 1 || !p.words || typeof p.words !== 'object') return null;
    const words: Record<string, WordRecord> = {};
    for (const [k, r] of Object.entries(p.words as Record<string, unknown>)) {
      if (KEY_RE.test(k) && validRecord(r)) words[k] = { b: r.b, box: r.box, due: r.due, added: r.added };
    }
    return { v: 1, words };
  } catch {
    return null;
  }
}

export function loadWords(): MyWords {
  try {
    const raw = localStorage.getItem(WORDS_KEY);
    return (raw && parseWords(raw)) || emptyWords();
  } catch {
    return emptyWords();
  }
}
export function saveWords(w: MyWords): void {
  try {
    localStorage.setItem(WORDS_KEY, JSON.stringify(w));
  } catch {
    /* storage unavailable: words just aren't kept */
  }
}
export function clearWords(): void {
  try {
    localStorage.removeItem(WORDS_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Add words (key → band) not already there; they're due today. */
export function addWords(w: MyWords, items: [string, number][], date: string): MyWords {
  const words = { ...w.words };
  for (const [k, b] of items) if (!words[k] && KEY_RE.test(k)) words[k] = { b, box: 0, due: date, added: date };
  return { v: 1, words };
}
export function removeWord(w: MyWords, key: string): MyWords {
  const words = { ...w.words };
  delete words[key];
  return { v: 1, words };
}

/**
 * After a round: right first time moves a word up a box and schedules it further ahead; a miss puts it back in box 0,
 * due tomorrow. A word not yet due that you practise anyway is only moved up if it was due (no skipping ahead).
 */
export function review(w: MyWords, results: { key: string; band: number; right: boolean }[], date: string): MyWords {
  let out = addWords(w, results.map((r) => [r.key, r.band]), date);
  const words = { ...out.words };
  for (const { key, right } of results) {
    const r = words[key]!;
    if (!right) words[key] = { ...r, box: 0, due: addDays(date, 1) };
    else if (r.due <= date) {
      const box = Math.min(r.box + 1, MAX_BOX);
      words[key] = { ...r, box, due: addDays(date, INTERVALS[box - 1]!) };
    }
  }
  out = { v: 1, words };
  return out;
}

/** Keys due on or before this date, the most overdue first. */
export function dueKeys(w: MyWords, date: string): string[] {
  return Object.entries(w.words)
    .filter(([, r]) => r.due <= date)
    .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : a[0] < b[0] ? -1 : 1))
    .map(([k]) => k);
}

/** Merge an imported record: new words are added; for a word in both, the one with the later due date wins. */
export function mergeWords(mine: MyWords, incoming: MyWords): MyWords {
  const words = { ...mine.words };
  for (const [k, r] of Object.entries(incoming.words)) if (!words[k] || r.due > words[k].due) words[k] = r;
  return { v: 1, words };
}

export const exportWords = (w: MyWords): string => JSON.stringify(w, null, 1);
