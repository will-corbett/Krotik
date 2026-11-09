/** Site search: Russian or English, stress and ё ignored, another form of a Russian word finds it. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fold, searchDocs, searchWords, terms } from '../../src/lib/search.ts';
import type { SearchIndex } from '../../src/shared/types.ts';
import type { Word } from '../../src/lib/types.ts';

const index = JSON.parse(readFileSync('public/data/search.json', 'utf8')) as SearchIndex;

describe('site search', () => {
  it('folds case, stress marks and ё', () => {
    expect(fold("Ещё КНИ'ГА")).toBe('еще книга');
    expect(terms('книги')).toEqual([{ term: 'книги', stem: 'книг' }]);
  });
  it('finds lessons, drills, themes, idioms and texts, in English or Russian', () => {
    const top = (q: string) => searchDocs(index.docs, q).slice(0, 5).map((h) => `${h.doc.k}:${h.doc.title}`);
    expect(top('aspect')).toContain('learn:Aspect partners');
    expect(top('видовые пары')).toContain('learn:Aspect partners');
    expect(top('weather')[0]).toBe('theme:Weather and seasons');
    expect(top('лапшу').some((x) => x.startsWith('idiom:'))).toBe(true);
    expect(top('Хамелеон')[0]).toBe('reading:Хамелеон');
    expect(searchDocs(index.docs, 'zzzzqqq')).toEqual([]);
  });
  it('the index has every kind of page, and no stress marks or table headers in its text', () => {
    const kinds = new Set(index.docs.map((d) => d.k));
    for (const k of ['page', 'learn', 'drill', 'theme', 'reading', 'note', 'link', 'idiom', 'pair', 'writing']) expect(kinds.has(k as never), k).toBe(true);
    for (const d of index.docs) {
      expect(d.text, d.title).not.toMatch(/[а-яё]'/i);
      expect(d.text, d.title).not.toContain('Not this But this');
    }
  });
  it('finds a word by another of its forms, or by its meaning', () => {
    const words: Word[] = [
      { key: 'n:1', accented: "кни'га", gloss: 'book, volume', pos: 'n', extra: 'f', band: 0 },
      { key: 'n:2', accented: "пого'да", gloss: 'weather', pos: 'n', extra: 'f', band: 0 },
      { key: 'n:3', accented: 'книжка', gloss: 'little book', pos: 'n', extra: 'f', band: 1 },
    ];
    expect(searchWords(words, 'книги').map((w) => w.key)).toEqual(['n:1']);
    expect(searchWords(words, 'weather').map((w) => w.key)).toEqual(['n:2']);
    expect(searchWords(words, 'book').map((w) => w.key)).toEqual(['n:1', 'n:3']);
  });
});
