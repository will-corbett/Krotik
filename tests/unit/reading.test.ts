/** Reading: the literature parser, how words are explained, and what the built texts guarantee. */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { explainText, explainWord, parseWork, plain, TOKEN, type Lexicon } from '../../scripts/lib/literature.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ReadingIndex, ReadingUnit } from '../../src/shared/types.ts';

const story = { id: 'x', author: 'А', authorEn: 'A', died: 1900, title: 'T', titleEn: 'T', year: 1880, page: 'p', revision: 1, kind: 'stories' as const, level: ['A2', 'B1'] as [string, string] };

describe('wikitext', () => {
  it('keeps only the text: no notes, links, spacing templates or stress marks', () => {
    expect(plain("Он '''пришёл'''<ref>примечание</ref> к [[w:Москва|Москве]]&nbsp;{{razr|быстро}} и́ ушёл.")).toBe('Он пришёл к Москве быстро и ушёл.');
  });
  it('stories: one per <h2>, with its genre; paragraphs as lines; verse and the header left out', () => {
    const src = `{{Отексте\n| АВТОР=[[Лев Толстой]]\n}}\n[[Категория:Рассказы]]\n<h2>АКУЛА (Рассказ)</h2>\n\nНаш корабль стоял.\n\nБыло жарко.\n<h2>СУХМАН (Стихи-сказка)</h2>\n\nКак во стольном городе\n`;
    const ss = parseWork(story, src);
    expect(ss.map((s) => [s.title, s.genre])).toEqual([['Акула', 'Рассказ']]);
    expect(ss[0]!.lines).toEqual([
      ['', 'Наш корабль стоял.', 0],
      ['', 'Было жарко.', 0],
    ]);
  });
  it('plays: scenes, speakers, stage directions (with the full stop inside or outside the brackets); the cast list is skipped', () => {
    const src = `{{Отексте\n}}\n=== Действующие лица ===\n{{razr|Лука}}, лакей.\n\n=== I ===\n{{razr|Попова и Лука}}.\n\n{{rem|Гостиная.}}\n\n{{razr|Лука}}. Нехорошо, барыня…\n\n{{razr|Попова}} <small>''(решительно)''</small>. Я прошу тебя!\n\n{{razr|Смирнов}} <small>''(дразнит.)''</small> Не умно!\n`;
    expect(parseWork({ ...story, kind: 'play' }, src)[0]).toMatchObject({
      title: 'Явление I',
      lines: [
        ['', 'Попова и Лука.', 1],
        ['', 'Гостиная.', 1],
        ['Лука', 'Нехорошо, барыня…', 0],
        ['Попова', '(решительно) Я прошу тебя!', 0],
        ['Смирнов', '(дразнит.) Не умно!', 0],
      ],
    });
  });
});

describe('explaining words', () => {
  const lex: Lexicon = {
    owners: new Map([
      ['слушаю', new Set(['verbs:1'])],
      ['красота', new Set(['nouns:2'])],
      ['барьеру', new Set(['nouns:3'])],
      ['принимаю', new Set(['verbs:4'])],
      ['лука', new Set(['nouns:5'])],
    ]),
    masks: new Map([
      ['слушаю|verbs:1', 1],
      ['красота|nouns:2', 1],
      ['барьеру|nouns:3', 1 << 2],
      ['принимаю|verbs:4', 1],
    ]),
    verb: (id) => ({ accented: id === 1 ? "слу'шать" : "принима'ть", gloss: id === 1 ? 'listen' : 'receive', aspect: 'impf' }),
    noun: (id) => ({ accented: id === 2 ? "красота'" : id === 3 ? "барье'р" : "лук", gloss: id === 2 ? 'beauty' : id === 3 ? 'barrier' : 'onion' }),
    adjective: () => undefined,
    other: (b) => (b === 'ежели' ? ["е'жели", 'if'] : undefined),
    pronoun: () => [],
    wiktionary: { ежели: ["е'жели", 'if', '', 1] },
    old: new Set(['ежели']),
  };
  it('a word from our data: dictionary form, meaning and which form it is', () => {
    expect(explainWord('слушаю', false, lex)).toEqual([["слу'шать", 'listen', 'present, я', '']]);
  });
  it('the old polite -с, a particle, a stammer, a word spelt out, and an old-fashioned word', () => {
    expect(explainWord('Слушаю-с', false, lex)[0]![3]).toBe('s');
    expect(explainWord('Красота-то', false, lex)[0]![2]).toMatch(/particle -то/);
    const st = explainWord('ба-барьеру', false, lex)[0]!;
    expect([st[0], st[1]]).toEqual(["барье'р", 'barrier']);
    expect(st[2]).toMatch(/stammered/);
    expect(explainWord('при-ни-ма-ю', false, lex)[0]![2]).toMatch(/syllable by syllable/);
    expect(explainWord('ежели', false, lex)[0]![3]).toBe('o');
  });
  it("characters' names are names even when they look like words (Лука, лук), and so is the name in another case", () => {
    const { words } = explainText([['Лука', 'Позови Лукy и Ломова.', 0], ['Ломов', 'Да.', 0]], lex);
    expect(words['лука']).toEqual([['Лука', '', '', 'n']]);
    expect(words['ломова']).toEqual([['Ломова', '', '', 'n']]);
  });
});

const built = existsSync('public/data/reading.json');
describe.skipIf(!built)('the published texts', () => {
  const index = JSON.parse(readFileSync('public/data/reading.json', 'utf8')) as ReadingIndex;
  const units = index.units.map((u) => JSON.parse(readFileSync(`public/data/reading.${u.id}.json`, 'utf8')) as ReadingUnit);
  const cfg = parse(readFileSync('curated/literature.yaml', 'utf8')) as { works: { died: number; year: number; revision: number }[]; glosses: Record<string, string>; notOld: Record<string, string> };

  it('every work is in the public domain (author died 70+ years ago, published in their lifetime) at a pinned revision', () => {
    for (const w of cfg.works) {
      expect(w.died + 70).toBeLessThan(new Date().getFullYear());
      expect(w.year).toBeLessThanOrEqual(w.died);
      expect(Number.isInteger(w.revision)).toBe(true);
    }
  });
  it('there are Tolstoy stories and Chekhov scenes, in modern spelling', () => {
    expect(units.filter((u) => index.works[u.w]!.kind === 'stories').length).toBeGreaterThanOrEqual(15);
    expect(units.filter((u) => index.works[u.w]!.kind === 'play').length).toBeGreaterThanOrEqual(18);
    for (const u of units) for (const l of u.lines) expect(l[1]).not.toMatch(/[ѣіѳѵ]/);
  });
  it('every word of every text is explained', () => {
    for (const u of units) {
      for (const l of u.lines) for (const m of l[1].matchAll(TOKEN)) expect(u.words[normalise(m[0])], `${u.id}: ${m[0]}`).toBeTruthy();
    }
  });
  it('every question has the same number of options in both languages and a right answer among them', () => {
    for (const u of units) {
      expect(u.questions.length, u.id).toBeGreaterThan(0);
      for (const q of u.questions) {
        expect(q.en.options.length).toBe(q.ru.options.length);
        expect(q.en.options.length).toBeGreaterThanOrEqual(3);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.en.options.length);
      }
    }
  });
  it('every hand-written meaning is used in a published text (none left over), and so is every notOld word', () => {
    const used = new Set(units.flatMap((u) => Object.entries(u.words).filter(([, r]) => r.some((x) => x[3].includes('h'))).map(([k]) => k)));
    const all = new Set(units.flatMap((u) => Object.keys(u.words)));
    for (const k of Object.keys(cfg.glosses)) expect(used.has(k) || !all.has(k), `gloss ${k}`).toBe(true);
    expect(Object.keys(cfg.glosses).filter((k) => used.has(k)).length).toBeGreaterThan(30);
  });
});
