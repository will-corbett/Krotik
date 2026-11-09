/**
 * Reading: whole stories and scenes of public-domain literature (curated/literature.yaml), with every word explained.
 *
 * - Texts come from Wikisource wikitext at fixed revisions; only the author's text is kept (no notes, no headers).
 *   Stories are split by section (<h2>), plays by scene (=== I ===); a collection (`pages`) has one text per page
 *   (a single story, or a Russian Wikinews article without its sources, pictures and categories). The text is never
 *   changed.
 * - Each word gets its readings: from our data (dictionary form, English meaning, which form it is), else from
 *   Wiktionary (dictionary form and meaning). Words Wiktionary has only as archaic, obsolete or dated are labelled
 *   old-fashioned; the old polite -с (слушаю-с) is explained; names inside a sentence are marked as names.
 * - A text is published only when it has comprehension questions (content/reading/questions.yaml) and every word in
 *   it can be explained. The report lists every text with its size and the words that couldn't be.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ADJ_CELLS, NOUN_CELLS, VERB_CELLS, type Aspect, type Case } from '../../src/shared/cells.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ReadingIndex, ReadingLine, ReadingQuestion, ReadingQuestionKind, ReadingUnit, WordReading } from '../../src/shared/types.ts';
import { CASE_TERM, groupTerm, numberGenderTerm } from '../../src/lib/terms.ts';
import { parseAdjKey } from '../../src/lib/labels.ts';
import { REGISTER } from '../../src/lib/register.ts';
import type { Report } from './report.ts';
import { LITERATURE, LITERATURE_GLOSSES, LITERATURE_NOT_OLD, RAW_DIR, literatureFile, literatureSource, type LiteratureWork } from './sources.ts';

const S = 'Reading';
export const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;
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
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/́/g, '');
  for (let k = 0; k < 3; k++) t = t.replace(/\{\{(?:razr|rem|r|разрядка)\|([^{}]*)\}\}/g, '$1');
  t = t.replace(/\{\{[^{}]*\}\}/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

export interface Section {
  work: number;
  /** story title, or "Явление I" for a scene */
  title: string;
  /** the story's genre as the book gives it (Быль, Басня …), stories only */
  genre: string;
  lines: ReadingLine[];
  /** a collection's page: which one (its source, date and level) */
  page?: number;
}

/** Remove whole [[Файл:…]] links (their captions can hold links of their own). */
function stripFiles(s: string): string {
  let out = s;
  for (;;) {
    const i = out.search(/\[\[(?:Файл|File|Изображение|Image):/i);
    if (i < 0) return out;
    let depth = 0;
    let j = i;
    for (; j < out.length - 1; j++) {
      if (out[j] === '[' && out[j + 1] === '[') (depth++, j++);
      else if (out[j] === ']' && out[j + 1] === ']') {
        depth--;
        j++;
        if (depth === 0) break;
      }
    }
    out = out.slice(0, i) + out.slice(j + 1);
  }
}
/** Remove every {{template}}, nested ones included. */
function stripTemplates(s: string): string {
  let out = s;
  for (let i = out.indexOf('{{'); i >= 0; i = out.indexOf('{{')) out = out.slice(0, i) + out.slice(skipTemplate(out, i));
  return out;
}

/**
 * One page's text as paragraphs: a Wikisource story (the text inside its <div>, without notes) or a Wikinews article
 * (without its date and topic templates, pictures, quote tables, sources and categories).
 */
export function parsePage(src: string, site: 'wikisource' | 'wikinews'): ReadingLine[] {
  let body = stripHeader(src).replace(/\[\[Категория:[^\]]*\]\]/g, '').replace(/__[A-Z]+__/g, '');
  body = body.split(/^==\s*(?:Примечания|Источники|Ссылки|См\. также)\s*==/m)[0]!;
  body = stripFiles(body)
    .replace(/\{\|[\s\S]*?\|\}/g, '')
    .replace(/^=+[^=\n]*=+\s*$/gm, '')
    .replace(/<\/?(?:div|center|p)[^>]*>/g, '\n\n');
  if (site === 'wikinews') {
    // Templates that hold the article's own words keep them: a quotation as its own paragraph; a foreign name, a
    // number kept on one line, a Wikipedia link as plain text. Everything else (date, topics, notices) goes.
    body = body.replace(/\{\{цитата\|([^{}]*)\}\}/gi, '\n\n«$1»\n\n');
    body = body.replace(/\{\{(?:lang-[a-z]+|nobr)\|([^{}]*)\}\}/gi, '$1').replace(/\{\{w\|(?:[^{}|]*\|)?([^{}|]*)\}\}/gi, '$1');
    body = stripTemplates(body);
  }
  return body
    .split(/\n\s*\n/)
    .map(plain)
    .filter((l) => /[А-ЯЁа-яё]/.test(l) && !/^\*\s*\*\s*\*$/.test(l))
    .map((text): ReadingLine => ['', text, 0]);
}

/** The stories or scenes of a work, as plain lines. */
export function parseWork(w: LiteratureWork, given?: string): Section[] {
  const work = LITERATURE.indexOf(w);
  const src = given ?? (w.kind === 'pages' ? '' : readFileSync(join(RAW_DIR, literatureFile(w)), 'utf8'));
  const body = stripHeader(src).replace(/\[\[Категория:[^\]]*\]\]/g, '').replace(/__[A-Z]+__/g, '');
  const out: Section[] = [];
  if (w.kind === 'pages') {
    w.pages!.forEach((pg, i) => {
      const lines = parsePage(readFileSync(join(RAW_DIR, literatureFile(w, i)), 'utf8'), w.site ?? 'wikisource');
      if (lines.length) out.push({ work, title: pg.title, genre: '', lines, page: i });
    });
  } else if (w.kind === 'stories') {
    for (const part of body.split(/<h2>/).slice(1)) {
      const [head = '', ...rest] = part.split('</h2>');
      const h = plain(head);
      const genre = /\(([^)]*)\)\s*$/.exec(h)?.[1] ?? '';
      // Verse is left out: these are prose readings.
      if (/^Стихи/i.test(genre)) continue;
      const title = h.replace(/\s*\([^)]*\)\s*$/, '');
      const lines = rest
        .join('</h2>')
        .split(/\n\s*\n/)
        .map(plain)
        .filter((l) => /[А-ЯЁа-яё]/.test(l))
        .map((text): ReadingLine => ['', text, 0]);
      if (lines.length) out.push({ work, title: title.charAt(0) + title.slice(1).toLowerCase(), genre, lines });
    }
  } else {
    // Plays: "=== I ===" scenes; "{{razr|Name}} (…). Speech" lines; "{{rem|…}}" stage directions. The cast list
    // before the first scene is skipped.
    const parts = body.split(/^===\s*([IVXLC]+)\s*===\s*$/m);
    for (let k = 1; k < parts.length; k += 2) {
      const num = parts[k]!;
      const lines: ReadingLine[] = [];
      for (const raw of (parts[k + 1] ?? '').split(/\n\s*\n|\n(?=\{\{razr)/)) {
        const l = raw.trim();
        if (!l) continue;
        // "{{razr|Name}}. Speech" or "{{razr|Name}} <small>(how)</small>. Speech" (the full stop is sometimes inside the brackets)
        const m = /^\{\{razr\|([^}]*)\}\}\s*(?:<small>([\s\S]*?)<\/small>)?\s*\.?\s*([\s\S]*)$/.exec(l);
        const speech = m ? `${m[2] ? `${plain(m[2])} ` : ''}${plain(m[3]!)}`.trim() : '';
        // A name with nothing said is a scene heading written without its stage-direction template.
        if (m && !speech) lines.push(['', `${plain(m[1]!)}.`, 1]);
        else if (m) lines.push([plain(m[1]!), speech, 0]);
        else if (/^\{\{rem\|/.test(l)) lines.push(['', plain(l), 1]);
      }
      if (lines.length) out.push({ work, title: `Явление ${num}`, genre: '', lines });
    }
  }
  return out;
}

/** Every word in every text (lower case, ё as е, without a polite -с), for the Wiktionary check. */
export function literatureWords(): Set<string> {
  const out = new Set<string>();
  for (const w of LITERATURE) for (const s of parseWork(w)) for (const l of s.lines) for (const m of l[1].matchAll(TOKEN)) out.add(fold(m[0]).replace(/-с$/, ''));
  return out;
}

// ---- explaining words
export interface Lexicon {
  /** normalised form → owners, as in the sentence corpus ("verbs:12", "other:как", "name:Том") */
  owners: Map<string, Set<string>>;
  /** `${form}|${owner}` → bitmask of cells */
  masks: Map<string, number>;
  verb: (id: number) => { accented: string; gloss: string; aspect: Aspect } | undefined;
  noun: (id: number) => { accented: string; gloss: string } | undefined;
  adjective: (id: number) => { accented: string; gloss: string } | undefined;
  /** others.csv: bare → [accented, English] */
  other: (bare: string) => [string, string] | undefined;
  /** personal and possessive pronoun forms → [dictionary form, which form] */
  pronoun: (form: string) => [string, string][];
  /** Wiktionary, for words not in our data: word → [dictionary form, gloss, form tags, 1 if old] */
  wiktionary: Record<string, [string, string, string, 0 | 1]>;
  /** words Wiktionary has only as archaic, obsolete or dated */
  old: Set<string>;
  /** vocabulary list key → its band, for words in the lists (scripts/lib/vocab.ts) */
  wordBand: (key: string) => number | undefined;
  /** among the most common word forms in the independent frequency list (guards against the source's misplaced ranks) */
  commonForm: (form: string) => boolean;
  /** vocabulary list key → its register label (colloquial, literary …), if it has one */
  register?: (key: string) => string | undefined;
}
/** A reading with its vocabulary key and band, when the word is in the lists. */
const withKey = (r: [string, string, string, string], key: string, lex: Lexicon): WordReading => {
  const b = lex.wordBand(key);
  // A register label (colloquial, bookish …) rides in the flags as its letter.
  const reg = lex.register?.(key);
  const flagged: [string, string, string, string] = reg && REGISTER[reg] ? [r[0], r[1], r[2], r[3] + REGISTER[reg]!.letter] : r;
  return b === undefined ? flagged : [...flagged, key, b];
};

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const bits = (m: number) => [...Array(31).keys()].filter((i) => m & (1 << i));
const ADJ_EXTRA = ['short form, masculine', 'short form, feminine', 'short form, neuter', 'short form, plural', 'comparative', 'superlative'];
const caseName = (c: Case) => lower(CASE_TERM[c].en);

export function formLabels(type: string, mask: number, aspect?: Aspect): string[] {
  return bits(mask).map((i) => {
    if (type === 'verbs') {
      if (i >= VERB_CELLS.length) return 'infinitive';
      const c = VERB_CELLS[i]!;
      return `${lower(groupTerm(c.group, aspect ?? 'impf').en)}, ${c.person}`;
    }
    if (type === 'nouns') {
      const [num, c] = NOUN_CELLS[i]!.split('_') as ['sg' | 'pl', Case];
      return `${caseName(c)} ${num === 'sg' ? 'singular' : 'plural'}`;
    }
    if (i >= ADJ_CELLS.length) return ADJ_EXTRA[i - ADJ_CELLS.length] ?? '';
    const { slot, c } = parseAdjKey(ADJ_CELLS[i]!);
    return `${caseName(c)} ${lower(numberGenderTerm(slot).en)}`;
  });
}
/** "genitive", for pronoun forms. */
export const caseLabel = caseName;
/** "accusative feminine singular", for possessive pronoun forms (ADJ_CELLS order). */
export const adjFormLabel = (i: number) => formLabels('adjectives', 1 << i)[0]!;
const join3 = (xs: string[]) => {
  const u = [...new Set(xs.filter(Boolean))];
  return u.length > 3 ? `${u.slice(0, 3).join(' / ')} …` : u.join(' / ');
};

/**
 * The readings of one word of the text; empty when it can't be explained. `name`: capitalised inside a sentence (a
 * name, unless it's also a known word). Flags: o = old-fashioned, s = with the old polite -с, n = a name.
 */
export function explain(token: string, name: boolean, lex: Lexicon): WordReading[] {
  const polite = /-с$/i.test(token) && !lex.owners.has(fold(token));
  const f = polite ? fold(token).replace(/-с$/, '') : fold(token);
  const old = lex.old.has(f) && !(f in LITERATURE_NOT_OLD);
  const flags = `${old ? 'o' : ''}${polite ? 's' : ''}`;
  const out: WordReading[] = [];
  for (const owner of lex.owners.get(f) ?? []) {
    const [type, idS] = owner.split(':') as [string, string];
    const mask = lex.masks.get(`${f}|${owner}`) ?? 0;
    if (type === 'verbs' || type === 'nouns' || type === 'adjectives') {
      const id = Number(idS);
      const l = type === 'verbs' ? lex.verb(id) : type === 'nouns' ? lex.noun(id) : lex.adjective(id);
      if (!l) continue;
      out.push(withKey([l.accented, l.gloss, join3(formLabels(type, mask, (l as { aspect?: Aspect }).aspect)), flags], `${type[0]}:${id}`, lex));
    } else if (type === 'other') {
      const o = lex.other(idS);
      if (o) out.push(withKey([o[0], o[1], '', flags], `o:${normalise(idS)}`, lex));
    }
  }
  for (const [dict, form] of lex.pronoun(f)) {
    const o = lex.other(normalise(dict));
    out.push(withKey([dict, o?.[1] ?? '', form, flags], `o:${normalise(dict)}`, lex));
  }
  if (!out.length && lex.wiktionary[f]) {
    const [dict, gloss, tags] = lex.wiktionary[f]!;
    out.push([dict, gloss, tags, flags]);
  }
  // A capitalised word inside a sentence that we can't explain is a name.
  if (!out.length && name) out.push([token, '', '', 'n']);
  // The same dictionary form and meaning twice (one spelling, several forms): keep one, forms joined.
  const seen = new Map<string, WordReading>();
  for (const r of out) {
    const k = `${r[0]}|${r[1]}`;
    const prev = seen.get(k);
    if (prev) prev[2] = join3([prev[2], r[2]]);
    else seen.set(k, [...r] as WordReading);
  }
  return [...seen.values()].slice(0, 4);
}

const PARTICLES: Record<string, string> = { то: 'with the particle -то (emphasis)', ка: 'with the particle -ка (softens a request)', таки: 'with the particle -таки (after all)' };
const note = (r: WordReading[], n: string): WordReading[] => r.map((x) => {
  const y = [...x] as WordReading;
  y[2] = x[2] ? `${x[2]}; ${n}` : n;
  return y;
});

/**
 * A word, including the hyphenated shapes of speech in the texts: a particle (красота-то), a word said twice
 * (скакали-скакали), spelt out (при-ни-ма-ю), stammered (ба-барьеру), or two words joined (барыня-матушка). Last of
 * all, a meaning written by hand (curated/literature.yaml glosses), flagged h.
 */
export function explainWord(token: string, name: boolean, lex: Lexicon): WordReading[] {
  const direct = explain(token, name, lex);
  if (direct.length && direct[0]![3] !== 'n') return direct;
  const parts = token.split('-');
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!.toLowerCase();
    const base = parts.slice(0, -1).join('-');
    if (PARTICLES[last]) {
      const r = explainWord(base, name, lex);
      if (r.length) return note(r, PARTICLES[last]!);
    }
    if (parts.every((x) => fold(x) === fold(parts[0]!))) {
      const r = explainWord(parts[0]!, name, lex);
      if (r.length) return note(r, 'said twice, for emphasis');
    }
    const joined = explain(parts.join(''), name, lex);
    if (joined.length && joined[0]![3] !== 'n') return note(joined, 'said syllable by syllable');
    if (parts.length === 2 && fold(parts[1]!).startsWith(fold(parts[0]!))) {
      const r = explainWord(parts[1]!, name, lex);
      if (r.length) return note(r, 'stammered');
    }
    const each = parts.map((x) => explainWord(x, name, lex));
    if (each.every((r) => r.length && r[0]![3] !== 'n')) return each.map((r) => r[0]!).slice(0, 4);
  }
  const hand = LITERATURE_GLOSSES[fold(token)];
  // "(name) …": a name (the made-up horse surnames in Лошадиная фамилия), with a note on what it is.
  if (hand?.startsWith('(name) ')) return [[token, hand.slice(7), '', 'nh']];
  if (hand) return [[token.toLowerCase(), hand.replace(/^\(old\) /, ''), '', hand.startsWith('(old) ') ? 'ho' : 'h']];
  return direct;
}

export const KEY_WORDS_MAX = 15;
/**
 * The text's words worth learning before you read: in the vocabulary lists but outside the 1,000 most common of their
 * type (band 2 or 3) and not among the most common forms in the frequency list, not names or old-fashioned words, with
 * one clear reading, in order of first appearance.
 */
export function keyWords(lines: ReadingLine[], words: Record<string, WordReading[]>, commonForm: (form: string) => boolean = () => false): [string, number, string, string][] {
  const out = new Map<string, [string, number, string, string]>();
  for (const l of lines) {
    if (l[2]) continue; // stage directions
    for (const m of l[1].matchAll(TOKEN)) {
      const rs = words[fold(m[0])] ?? [];
      const keyed = rs.filter((r) => r.length === 6);
      if (keyed.length !== 1 || rs.length !== 1) continue;
      const [dict, meaning, , flags, key, band] = keyed[0] as [string, string, string, string, string, number];
      // The source ranks a few common words as rare (стать, белый): the frequency list overrules it here.
      if (band < 2 || /[onh]/.test(flags) || out.has(key) || commonForm(normalise(dict.split(',')[0]!.replace(/'/g, '')))) continue;
      out.set(key, [key, band, dict, meaning]);
      if (out.size >= KEY_WORDS_MAX) return [...out.values()];
    }
  }
  return [...out.values()];
}

/** Each distinct word of a text with its readings, and the words that couldn't be explained. */
export function explainText(lines: ReadingLine[], lex: Lexicon): { words: Record<string, WordReading[]>; unexplained: string[] } {
  const words: Record<string, WordReading[]> = {};
  const unexplained = new Set<string>();
  const speakers = new Set(lines.flatMap((l) => (l[0] ? l[0].split(/\s+/).map(fold) : [])));
  // A character's name in another case (Ломову, from Ломов) is the name too.
  const isSpeaker = (k: string) => speakers.has(k) || [...speakers].some((sp) => sp.length >= 4 && k.startsWith(sp) && k.length - sp.length <= 3);
  for (const l of [...lines.map((x) => x[0]).filter(Boolean).map((sp): ReadingLine => ['', sp, 0]), ...lines]) {
    for (const m of l[1].matchAll(TOKEN)) {
      const before = l[1].slice(0, m.index);
      const sentenceStart = /(^|[.!?…—:«"(]\s*)$/.test(before);
      const key = fold(m[0]);
      if (words[key]) continue;
      // Characters' names (Лука is also a form of лук) are always names.
      const r = isSpeaker(key) ? [[m[0], '', '', 'n'] as WordReading] : explainWord(m[0], /^[А-ЯЁ]/.test(m[0]) && !sentenceStart, lex);
      if (r.length) words[key] = r;
      else unexplained.add(m[0]);
    }
  }
  return { words: Object.fromEntries(Object.entries(words).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), unexplained: [...unexplained].sort() };
}

// ---- questions and publishing
interface QuestionEntry {
  id: string;
  work: string;
  section: string;
  /** which section of that title (1 = first), where a book repeats a title (Тепло) */
  part?: number;
  /** the title shown, where the book's own would be ambiguous */
  title?: string;
  questions: { answer: number; en: ReadingQuestion; ru: ReadingQuestion; kind?: ReadingQuestionKind }[];
}
export const loadQuestions = (): QuestionEntry[] => (parse(readFileSync('content/reading/questions.yaml', 'utf8')) as QuestionEntry[] | null) ?? [];
const wordCount = (lines: ReadingLine[]) => lines.reduce((k, l) => k + (l[1].match(TOKEN) ?? []).length, 0);

export function buildReading(lex: Lexicon, report: Report): { index: ReadingIndex; units: ReadingUnit[] } {
  const all = LITERATURE.flatMap((w) => parseWork(w));
  // Every text, so the report helps choose the next ones (all words explained, shortest first).
  for (const s of all) {
    const w = LITERATURE[s.work]!;
    const { unexplained } = explainText(s.lines, lex);
    report.count(S, `${w.id} «${s.title}»${s.genre ? ` (${s.genre})` : ''}, ${wordCount(s.lines)} words: words not explained`, unexplained.length);
    for (const u of unexplained) report.anomaly(S, 'words not explained (their text stays unpublished)', `${u} (${w.id} «${s.title}»)`);
    if (process.env.READING_DEBUG && unexplained.length) console.log(`${w.id} «${s.title}»: ${unexplained.join(', ')}`);
  }
  const units: ReadingUnit[] = [];
  const ids = new Set<string>();
  for (const q of loadQuestions()) {
    const wi = LITERATURE.findIndex((w) => w.id === q.work);
    const s = all.filter((x) => x.work === wi && x.title === q.section)[(q.part ?? 1) - 1];
    if (!s) throw new Error(`content/reading/questions.yaml: ${q.id}: no section «${q.section}» in ${q.work}`);
    if (ids.has(q.id) || !/^[a-z0-9-]+$/.test(q.id)) throw new Error(`content/reading/questions.yaml: bad or repeated id ${q.id}`);
    ids.add(q.id);
    const { words, unexplained } = explainText(s.lines, lex);
    if (unexplained.length) throw new Error(`content/reading/questions.yaml: ${q.id}: words that can't be explained: ${unexplained.join(', ')}`);
    for (const x of q.questions) {
      if (x.en.options.length !== x.ru.options.length || x.answer < 0 || x.answer >= x.en.options.length) throw new Error(`content/reading/questions.yaml: ${q.id}: question options don't match`);
    }
    const w = LITERATURE[wi]!;
    const pg = s.page !== undefined ? w.pages![s.page] : undefined;
    const extra = pg ? { source: literatureSource(w, s.page), ...(pg.date ? { date: pg.date } : {}), ...(pg.level ? { level: pg.level } : {}), ...(pg.year ? { year: pg.year } : {}) } : {};
    units.push({ id: q.id, w: wi, title: q.title ?? s.title, genre: s.genre, lines: s.lines, words, keyWords: keyWords(s.lines, words, lex.commonForm), questions: q.questions, ...extra });
  }
  const index: ReadingIndex = {
    works: LITERATURE.map((w) => ({ id: w.id, author: w.author, authorEn: w.authorEn, title: w.title, titleEn: w.titleEn, year: w.year, kind: w.kind, level: w.level, site: w.site ?? 'wikisource', source: w.pages ? '' : literatureSource(w) })),
    units: units.map((u) => ({ id: u.id, w: u.w, title: u.title, genre: u.genre, words: wordCount(u.lines), questions: u.questions.length, ...(u.date ? { date: u.date } : {}), ...(u.level ? { level: u.level } : {}) })),
  };
  report.count(S, 'texts published (with questions, every word explained)', units.length);
  report.count(S, 'comprehension questions', units.reduce((n, u) => n + u.questions.length, 0));
  report.count(S, 'words labelled old-fashioned (Wiktionary has them only as archaic, obsolete or dated)', units.reduce((n, u) => n + Object.values(u.words).filter((r) => r.some((x) => x[3].includes('o'))).length, 0));
  report.count(S, 'words Wiktionary mis-tags as old, accepted by hand (curated/literature.yaml notOld)', Object.keys(LITERATURE_NOT_OLD).length);
  return { index, units };
}
