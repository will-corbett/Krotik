/**
 * "Read and fill in": passages of public-domain literature (curated/literature.yaml) with gaps.
 *
 * - Texts come from Wikisource wikitext at fixed revisions; only the author's text is kept (no notes, no headers).
 * - Stories are split by section (<h2>), plays by scene (=== I ===), then into passages of about PASSAGE_WORDS words.
 * - A passage is left out if any word isn't in our data or in Wiktionary, if Wiktionary has the word only as
 *   archaic, obsolete or dated, if it uses the old polite -с particle (слушаю-с), or if it has Latin script.
 *   Every exclusion is listed in the report: the text is never changed.
 * - Gaps: words whose form belongs to exactly one verb, noun or adjective in our data (top 2,500), and differs from
 *   the dictionary form given as the hint. The answer is always the author's word.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalise } from '../../src/shared/normalise.ts';
import type { ReadingData, ReadingGap, ReadingLine } from '../../src/shared/types.ts';
import type { Report } from './report.ts';
import { LITERATURE, LITERATURE_NOT_OLD, RAW_DIR, literatureFile, type LiteratureWork } from './sources.ts';

const S = 'Read and fill in';
export const PASSAGE_WORDS = 120;
export const GAPS_PER_PASSAGE = 5;
const GAP_SPACING = 4; // tokens between gaps
const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

/** Words in all texts (lower case, ё as е), for the Wiktionary check. */
export function literatureWords(): Set<string> {
  const out = new Set<string>();
  for (const w of LITERATURE) for (const p of parseWork(w)) for (const l of p.lines) for (const m of l[1].matchAll(TOKEN)) out.add(fold(m[0]));
  return out;
}
const fold = (w: string) => normalise(w);

// ---- wikitext → plain text
/** Remove a {{template …}} with nested braces, starting at index i (which points at "{{"). */
function skipTemplate(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length - 1; j++) {
    if (s[j] === '{' && s[j + 1] === '{') (depth++, j++);
    else if (s[j] === '}' && s[j + 1] === '}') {
      depth--;
      j++;
      if (depth === 0) return j + 1;
    }
  }
  return s.length;
}
function stripHeader(s: string): string {
  const i = s.indexOf('{{Отексте');
  return i < 0 ? s : s.slice(0, i) + s.slice(skipTemplate(s, i));
}
/** Inline wiki markup to plain text. {{razr|X}} (spaced letters) and {{rem|X}} keep their text. */
export function plain(s: string): string {
  let t = s
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/́/g, '');
  for (let k = 0; k < 3; k++) t = t.replace(/\{\{(?:razr|rem|r|разрядка)\|([^{}]*)\}\}/g, '$1');
  t = t.replace(/\{\{[^{}]*\}\}/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

interface RawPassage {
  work: number;
  section: string;
  lines: ReadingLine[];
}

/** Sections of a work, each a list of lines, split into passages of about PASSAGE_WORDS words. */
export function parseWork(w: LiteratureWork, src = readFileSync(join(RAW_DIR, literatureFile(w)), 'utf8')): RawPassage[] {
  const work = LITERATURE.indexOf(w);
  const body = stripHeader(src).replace(/\[\[Категория:[^\]]*\]\]/g, '').replace(/__[A-Z]+__/g, '');
  const sections: { title: string; lines: ReadingLine[] }[] = [];
  if (w.kind === 'stories') {
    for (const part of body.split(/<h2>/).slice(1)) {
      const [head = '', ...rest] = part.split('</h2>');
      const title = plain(head).replace(/\s*\(([^)]*)\)\s*$/, '');
      // Verse is left out: the drill is about prose.
      if (/\((Стихи[^)]*)\)/i.test(head)) continue;
      const lines = rest
        .join('</h2>')
        .split(/\n\s*\n/)
        .map(plain)
        .filter((l) => /[А-ЯЁа-яё]/.test(l))
        .map((text): ReadingLine => ['', text, 0]);
      if (lines.length) sections.push({ title: title.charAt(0) + title.slice(1).toLowerCase(), lines });
    }
  } else {
    // Plays: "=== I ===" scenes; "{{razr|Name}} (…). Speech" lines; "{{rem|…}}" stage directions. The cast list
    // before the first scene is skipped.
    for (const part of body.split(/^===\s*([IVXLC]+)\s*===\s*$/m).slice(1).reduce<string[][]>((acc, x, i) => (i % 2 ? acc[acc.length - 1]!.push(x) : acc.push([x]), acc), [])) {
      const [num = '', text = ''] = part;
      const lines: ReadingLine[] = [];
      for (const raw of text.split(/\n\s*\n|\n(?=\{\{razr)/)) {
        const l = raw.trim();
        if (!l) continue;
        const m = /^\{\{razr\|([^}]*)\}\}\s*(?:<small>([\s\S]*?)<\/small>)?\s*\.\s*([\s\S]*)$/.exec(l);
        if (m) {
          const speaker = plain(m[1]!);
          const how = m[2] ? `${plain(m[2])} ` : '';
          lines.push([speaker, (how + plain(m[3]!)).trim(), 0]);
        } else if (/^\{\{rem\|/.test(l)) lines.push(['', plain(l), 1]);
      }
      if (lines.length) sections.push({ title: `Явление ${num}`, lines });
    }
  }
  const out: RawPassage[] = [];
  const words = (l: ReadingLine) => (l[1].match(TOKEN) ?? []).length;
  for (const s of sections) {
    let cur: ReadingLine[] = [];
    let n = 0;
    for (const l of s.lines) {
      if (cur.length && n + words(l) > PASSAGE_WORDS) {
        out.push({ work, section: s.title, lines: cur });
        cur = [];
        n = 0;
      }
      cur.push(l);
      n += words(l);
    }
    if (cur.length) out.push({ work, section: s.title, lines: cur });
  }
  return out;
}

export interface LiteratureInput {
  /** normalised form → owners, as in the sentence corpus ("verbs:12", "other:как", "name:Том") */
  owners: Map<string, Set<string>>;
  lemma: (owner: string) => { accented: string; gloss: string; rank: number } | undefined;
  modern: Set<string>;
  old: Set<string>;
  report: Report;
}

/** Why a word stops a passage being used, or null if it's fine. */
function problem(token: string, i: number, prev: string, inp: Pick<LiteratureInput, 'owners' | 'modern' | 'old'>): string | null {
  if (/-с$/i.test(token)) return 'the old polite -с particle';
  const f = fold(token);
  const capitalised = /^[А-ЯЁ]/.test(token);
  const sentenceStart = i === 0 || /[.!?…—:«"]\s*$/.test(prev);
  // A capitalised word inside a sentence that isn't a known word is a name (Лука, Смирнов): fine, never a gap.
  if (capitalised && !sentenceStart && !inp.owners.has(f)) return null;
  // Old in Wiktionary wins even when our data has the form: the data doesn't mark archaic words.
  if (inp.old.has(f) && !inp.modern.has(f) && !(f in LITERATURE_NOT_OLD)) return 'archaic, obsolete or dated in Wiktionary';
  if (!inp.owners.has(f) && !inp.modern.has(f)) return capitalised && sentenceStart ? null : 'not in our data or Wiktionary';
  return null;
}

/** Everything in a passage that keeps it out: Latin script, and each flagged word with the reason. */
export function problemsIn(lines: ReadingLine[], inp: Pick<LiteratureInput, 'owners' | 'modern' | 'old'>): { word: string; why: string }[] {
  const out: { word: string; why: string }[] = [];
  if (lines.some((l) => /[A-Za-z]/.test(l[1]))) out.push({ word: '', why: 'Latin script' });
  for (const l of lines) {
    let i = 0;
    for (const m of l[1].matchAll(TOKEN)) {
      const why = problem(m[0], i++, l[1].slice(0, m.index), inp);
      if (why) out.push({ word: m[0], why });
    }
  }
  return out;
}

export function buildReading(inp: LiteratureInput): ReadingData {
  const { report } = inp;
  const data: ReadingData = {
    works: LITERATURE.map((w) => ({
      id: w.id,
      author: w.author,
      authorEn: w.authorEn,
      title: w.title,
      titleEn: w.titleEn,
      year: w.year,
      kind: w.kind,
      level: w.level,
      source: `https://ru.wikisource.org/w/index.php?oldid=${w.revision}`,
    })),
    passages: [],
  };
  const flagged = new Map<string, { why: string; n: number }>();
  for (const w of LITERATURE) {
    const raw = parseWork(w);
    report.count(S, `${w.authorEn}, ${w.title}: passages`, raw.length);
    let kept = 0;
    for (const p of raw) {
      const bad = problemsIn(p.lines, inp);
      for (const { word, why } of bad) {
        if (why === 'Latin script') continue;
        const k = fold(word);
        flagged.set(k, { why, n: (flagged.get(k)?.n ?? 0) + 1 });
      }
      if (bad.length) continue;
      const gaps = chooseGaps(p.lines, inp);
      if (!gaps.length) continue;
      kept++;
      data.passages.push({ w: p.work, s: p.section, lines: p.lines, gaps });
    }
    report.count(S, `${w.authorEn}, ${w.title}: passages used (no flagged words, at least one gap)`, kept);
  }
  report.count(S, 'gaps', data.passages.reduce((n, p) => n + p.gaps.length, 0));
  report.count(S, 'words Wiktionary mis-tags as old, accepted by hand (curated/literature.yaml notOld)', Object.keys(LITERATURE_NOT_OLD).length);
  for (const kind of ['v', 'n', 'a'] as const) report.count(S, `gaps: ${{ v: 'verbs', n: 'nouns', a: 'adjectives' }[kind]}`, data.passages.reduce((n, p) => n + p.gaps.filter((g) => g[3] === kind).length, 0));
  for (const [word, { why, n }] of [...flagged].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1))) {
    report.anomaly(S, `words that left a passage out (${why})`, `${word} (${n}×)`);
  }
  return data;
}

/** Up to GAPS_PER_PASSAGE gaps, spaced out and mixing verbs, nouns and adjectives; deterministic. */
export function chooseGaps(lines: ReadingLine[], inp: Pick<LiteratureInput, 'owners' | 'lemma'>): ReadingGap[] {
  type Cand = { line: number; start: number; end: number; kind: 'v' | 'n' | 'a'; lemma: string; gloss: string; pos: number };
  const cands: Cand[] = [];
  let pos = 0;
  const speakers = new Set(lines.map((l) => fold(l[0])).filter(Boolean));
  lines.forEach((l, li) => {
    for (const m of l[1].matchAll(TOKEN)) {
      pos++;
      const f = fold(m[0]);
      if (f.length < 3) continue;
      // Never a name: a capitalised word inside a sentence (Лука is also a form of лук), or a character's name.
      const sentenceStart = /(^|[.!?…—:«"(]\s*)$/.test(l[1].slice(0, m.index));
      if ((/^[А-ЯЁ]/.test(m[0]) && !sentenceStart) || speakers.has(f)) continue;
      const owners = inp.owners.get(f);
      if (!owners || owners.size !== 1) continue;
      const owner = [...owners][0]!;
      const type = owner.split(':')[0];
      const kind = type === 'verbs' ? 'v' : type === 'nouns' ? 'n' : type === 'adjectives' ? 'a' : null;
      if (!kind) continue;
      const lemma = inp.lemma(owner);
      if (!lemma || lemma.rank >= 2500) continue;
      if (fold(lemma.accented) === f) continue; // the hint would give it away
      cands.push({ line: li, start: m.index!, end: m.index! + m[0].length, kind, lemma: lemma.accented, gloss: lemma.gloss, pos });
    }
  });
  const out: Cand[] = [];
  const per: Record<string, number> = { v: 0, n: 0, a: 0 };
  // Two passes: first at most two of each kind, then fill up, always keeping gaps apart.
  for (const cap of [2, GAPS_PER_PASSAGE]) {
    for (const c of cands) {
      if (out.length >= GAPS_PER_PASSAGE) break;
      if (out.includes(c) || per[c.kind]! >= cap) continue;
      if (out.some((o) => Math.abs(o.pos - c.pos) < GAP_SPACING)) continue;
      out.push(c);
      per[c.kind]!++;
    }
  }
  return out.sort((a, b) => a.pos - b.pos).map((c) => [c.line, c.start, c.end, c.kind, c.lemma, c.gloss]);
}
