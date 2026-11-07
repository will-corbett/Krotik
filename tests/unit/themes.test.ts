/** The Words section's themes: words resolve to exactly one word, our Russian is checked, and only reviewed dialogues are published. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Report } from '../../scripts/lib/report.ts';
import { buildThemes, checkRussian, findUses, loadThemes, resolveWord, type ThemeSrc } from '../../scripts/lib/themes.ts';
import type { Lexicon } from '../../scripts/lib/literature.ts';
import type { ThemeData, ThemeIndex, WordRow } from '../../src/shared/types.ts';

const rows: WordRow[] = [
  ['n:1', 'чай', 'tea, tea-party', 'n', 'm'],
  ['v:2', 'есть', 'eat', 'v', 'impf'],
  ['o:есть', 'есть', 'there is', 'o', ''],
  ['n:3', "хлеб", 'bread', 'n', 'm'],
];
const byHead = new Map<string, WordRow[]>([['чай', [rows[0]!]], ['есть', [rows[1]!, rows[2]!]], ['хлеб', [rows[3]!]]]);

const lex: Lexicon = {
  owners: new Map([
    ['чай', new Set(['nouns:1'])],
    ['хлеб', new Set(['nouns:3'])],
    ['ем', new Set(['verbs:2'])],
    ['я', new Set(['other:я'])],
  ]),
  masks: new Map(),
  verb: () => ({ accented: 'есть', gloss: 'eat', aspect: 'impf' }),
  noun: (id) => ({ accented: id === 1 ? 'чай' : 'хлеб', gloss: id === 1 ? 'tea' : 'bread' }),
  adjective: () => undefined,
  other: (b) => (b === 'я' ? ['я', 'I'] : undefined),
  pronoun: () => [],
  wiktionary: {},
  old: new Set(),
  wordBand: () => 0,
  commonForm: () => false,
};

describe('theme words', () => {
  it('resolve to exactly one word, with :pos for a spelling that is several, and an optional meaning of our own', () => {
    expect(resolveWord('чай', byHead)).toEqual({ row: rows[0], meaning: 'tea, tea-party' });
    expect(resolveWord('чай = tea', byHead)).toEqual({ row: rows[0], meaning: 'tea' });
    expect(resolveWord('есть', byHead)).toMatch(/is 2 words/);
    expect(resolveWord('есть:v', byHead)).toMatchObject({ row: rows[1] });
    expect(resolveWord('кофейник', byHead)).toMatch(/not in the word lists/);
  });
});

describe('our own Russian', () => {
  it('passes when every word is a known form, and names only when declared', () => {
    expect(checkRussian([['Анна', 'Я ем хлеб.', 0]], new Set(), lex).problems).toEqual([]);
    expect(checkRussian([['', 'Я ем хлэб.', 0]], new Set(), lex).problems).toEqual(['«хлэб» is not a known form']);
    // Capitalised mid-sentence: read as a name, so it must be declared.
    expect(checkRussian([['', 'Я ем Хлэб.', 0]], new Set(), lex).problems).toEqual(['«хлэб» is not a known form (or add it to names)']);
    expect(checkRussian([['', 'Я ем Хлэб.', 0]], new Set(['хлэб']), lex).problems).toEqual([]);
  });
});

describe('themes', () => {
  const src = (reviewed: string): ThemeSrc => ({
    title: 'Food',
    ru: 'Хлеб',
    level: 'A1',
    blurb: 'x',
    groups: [{ title: 'Things', words: ['чай = tea', 'хлеб'] }],
    dialogues: [{ title: 'At home', reviewed, lines: [['Анна', 'Я ем хлеб.', 'I am eating bread.']] }],
  });
  const corpus = { pairs: [{ rid: 7, ru: 'Чай и хлеб.', en: 'Tea and bread.' }], owners: lex.owners };
  const build = (reviewed: string) => buildThemes([{ id: 'food', src: src(reviewed) }], { words: rows, band: () => 0, corpus, lex }, new Report());

  it('publish a dialogue only once it has been reviewed; until then it is in the review report', () => {
    const draft = build('');
    expect(draft.themes[0]!.dialogues).toEqual([]);
    expect(draft.themes[0]!.drafts).toBe(1);
    expect(JSON.stringify(draft.themes)).not.toContain('Я ем хлеб');
    expect(draft.review).toContain('| 1 | **Анна:** Я ем хлеб. | I am eating bread. |');
    const done = build('M. K., 2026-11-10');
    expect(done.themes[0]!.dialogues).toEqual([{ title: 'At home', reviewed: 'M. K., 2026-11-10', lines: [['Анна', 'Я ем хлеб.', 0]], en: ['I am eating bread.'] }]);
    expect(done.themes[0]!.words['хлеб']![0]![1]).toBe('bread');
    expect(done.review).toContain('Nothing waiting');
  });
  it('give each word a real sentence using it, and fail on a word that is not in the lists', () => {
    expect(build('').themes[0]!.uses['n:3']).toEqual([7, 'Чай и хлеб.', 'Tea and bread.', 6, 10]);
    expect(findUses(new Set(['nouns:1']), corpus).get('nouns:1')).toEqual([[7, 'Чай и хлеб.', 'Tea and bread.', 0, 3]]);
    const bad = { ...src(''), groups: [{ title: 'x', words: ['хлэб'] }] };
    expect(() => buildThemes([{ id: 'food', src: bad }], { words: rows, band: () => 0, corpus, lex }, new Report())).toThrow(/хлэб.*not in the word lists/);
  });
});

describe('the built themes', () => {
  const index = JSON.parse(readFileSync('public/data/themes.json', 'utf8')) as ThemeIndex;
  it('are all listed, and publish no unreviewed dialogue', () => {
    expect(index.themes.map((t) => t.id)).toEqual(loadThemes().map((t) => t.id));
    for (const { id, src } of loadThemes()) {
      const t = JSON.parse(readFileSync(`public/data/theme.${id}.json`, 'utf8')) as ThemeData;
      expect(t.dialogues.map((d) => d.title)).toEqual((src.dialogues ?? []).filter((d) => d.reviewed?.trim()).map((d) => d.title));
      expect(t.drafts).toBe((src.dialogues ?? []).filter((d) => !d.reviewed?.trim()).length);
    }
  });
});
