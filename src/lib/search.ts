/**
 * Site search, in the browser: the index (search.json: pages, Learn, drills, themes, Reading, culture, idioms, words
 * that go together, writing tasks) and the most common words of the vocabulary lists. Russian or English; case, stress
 * marks and ё don't matter, and a Russian word is also found from another of its forms (книги finds книга) by
 * matching the start of words.
 */
import type { SearchDoc } from '../shared/types.ts';
import type { Word } from './types.ts';

/** Lower case, no stress marks, ё as е, letters and digits only. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ']/g, '')
    .normalize('NFC')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A query's terms; a Russian word of four or more letters also stands for its stem (книги → книг). */
export function terms(query: string): { term: string; stem: string }[] {
  return fold(query)
    .split(' ')
    .filter(Boolean)
    .map((term) => ({ term, stem: /^[а-я]{4,}$/.test(term) ? term.replace(/[аяоеуюыиьй]+$/, '') : term }));
}

const startsWord = (hay: string, t: string) => hay.startsWith(t) || hay.includes(` ${t}`) || hay.includes(`-${t}`);

export interface Hit {
  doc: SearchDoc;
  score: number;
  snippet: string;
}

/** Every document matching all the terms, best first: a match in the title counts most, then the Russian name. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 60): Hit[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const out: Hit[] = [];
  for (const doc of docs) {
    const title = fold(doc.title);
    const ru = fold(doc.ru ?? '');
    const text = fold(doc.text);
    let score = 0;
    let ok = true;
    for (const { term, stem } of ts) {
      const s =
        (title === term ? 40 : 0) +
        (startsWord(title, term) ? 20 : title.includes(term) ? 10 : startsWord(title, stem) ? 8 : 0) +
        (startsWord(ru, term) ? 12 : startsWord(ru, stem) ? 6 : 0) +
        (startsWord(text, term) ? 3 : text.includes(term) ? 1 : startsWord(text, stem) ? 1 : 0);
      if (!s) {
        ok = false;
        break;
      }
      score += s;
    }
    if (ok) out.push({ doc, score: score + KIND_BONUS[doc.k], snippet: snippetOf(doc.text, ts) });
  }
  return out.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title)).slice(0, limit);
}
/** Lessons first when scores tie: they're what most searches are for. */
const KIND_BONUS: Record<SearchDoc['k'], number> = { learn: 3, drill: 2, theme: 2, page: 2, reading: 1, idiom: 1, pair: 1, note: 1, writing: 1, link: 0 };

/** About 140 characters of the text around the first term found, or its start. */
export function snippetOf(text: string, ts: { term: string; stem: string }[]): string {
  const low = fold(text);
  // fold() keeps positions only for plain letters; good enough to centre the snippet near the match.
  const at = Math.max(...ts.map(({ term, stem }) => Math.max(low.indexOf(term), low.indexOf(stem))), -1);
  const from = at > 60 ? text.lastIndexOf(' ', at - 50) + 1 : 0;
  const s = text.slice(from, from + 140);
  return `${from > 0 ? '… ' : ''}${s}${from + 140 < text.length ? ' …' : ''}`;
}

/** Words from the vocabulary lists: the Russian word (any form's start) or a word of its meaning. */
export function searchWords(words: Word[], query: string, limit = 24): Word[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const scored: { w: Word; s: number }[] = [];
  for (const w of words) {
    const ru = fold(w.accented.split(',')[0]!);
    const en = fold(w.gloss);
    let s = 0;
    for (const { term, stem } of ts) {
      const one = (ru === term ? 30 : ru.startsWith(term) ? 15 : stem.length >= 3 && ru.startsWith(stem) ? 8 : 0) + (startsWord(en, term) ? (en === term || en.startsWith(`${term} `) || en.startsWith(`${term},`) ? 12 : 6) : 0);
      if (!one) {
        s = 0;
        break;
      }
      s += one;
    }
    if (s) scored.push({ w, s: s - w.band });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.w);
}
