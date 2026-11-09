/**
 * Learn pages: every data block must resolve against the data, and every Russian word written in
 * the explanations must exist as a real form in the data (verbs, nouns, adjectives, pronouns,
 * numerals, others.csv). Nothing invented gets onto a Learn page.
 */
import { pairsFor } from '../../src/lib/collocations.ts';
import type { CollocationData } from '../../src/shared/types.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { AdjRow, AdverbRow, ClozeRow, LearnExtras, DatesData, NounRow, NumeralRow, ParticipleRow, PronounData, SentenceRow, SpecialCaseRow, VerbRow } from '../../src/shared/types.ts';
import { parseMarkdown } from '../../src/lib/learn.ts';
import { ALL_TOPICS, isDrill } from '../../src/lib/topics.ts';
import { DEFAULTS } from '../../src/lib/settings.ts';
import { resolveCell } from '../../src/lib/learnData.ts';
import { chooseSentence, toAdjective, toNoun, toVerb } from '../../src/lib/data.ts';

const json = <T>(f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;
const bands = [0, 1, 2, 3];
const verbs = bands.flatMap((b) => json<VerbRow[]>(`verbs.b${b}.json`).map((r) => toVerb(r, b)));
const nouns = bands.flatMap((b) => json<NounRow[]>(`nouns.b${b}.json`).map((r) => toNoun(r, b)));
const adjs = bands.flatMap((b) => json<AdjRow[]>(`adjectives.b${b}.json`).map((r) => toAdjective(r, b)));
const pron = json<PronounData>('pronouns.json');
const extras = json<LearnExtras>('learn.json');
const participles = [0, 1].flatMap((b) => json<ParticipleRow[]>(`participles.b${b}.json`).map((row) => ({ row, band: b })));

const known = new Set<string>();
const add = (cell: string | undefined) => cell && cellForms(cell).forEach((f) => known.add(normalise(f)));
for (const v of verbs) [v.accented, ...v.cells, ...v.partners].forEach(add);
for (const n of nouns) [n.accented, ...n.cells].forEach(add);
for (const a of adjs) [a.accented, ...a.cells, ...a.extra].forEach(add);
for (const [w, a, b] of pron.personal) [w, ...a, ...b].forEach(add);
for (const [w, c] of pron.possessive) [w, ...c].forEach(add);
for (const b of bands) for (const r of json<ParticipleRow[]>(`participles.b${b}.json`)) [r[4], r[5], ...r[6].flatMap(([, n, c, sh]) => [n, ...c, ...sh])].forEach(add);
for (const [w, , c] of json<[string, number, string[]][]>('ordinals.json')) [w, ...c].forEach(add);
for (const [w, , cells] of [...json<NumeralRow[]>('numerals.json'), ...json<NumeralRow[]>('collectives.json')]) [w, ...Object.values(cells)].forEach(add);
for (const r of json<AdverbRow[]>('adverbs.json')) [r[2], r[3]].forEach(add);
for (const r of json<SpecialCaseRow[]>('special-cases.json')) [r[3], r[5], r[6]].forEach(add);
for (const m of json<DatesData>('dates.json').months) [m[0], m[1]].forEach(add);
if (existsSync('data-raw/others.csv')) {
  for (const line of readFileSync('data-raw/others.csv', 'utf8').split(/\r?\n/).slice(1)) add(line.split('\t')[0]);
}

// Extra words, each checked against Wiktionary by the data build (which fails otherwise).
for (const w of parse(readFileSync('content/learn/words.yaml', 'utf8')) as string[]) known.add(normalise(w));

const pages = readdirSync('content/learn').filter((f) => f.endsWith('.md'));

/** Russian words in a page's text (data-block lines aside) that aren't real forms in the data. */
function unknownWords(src: string): string[] {
  const text = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('::'))
    .join('\n');
  const unknown = new Set<string>();
  for (const m of text.matchAll(/(^|[^А-ЯЁа-яё-])([А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*)/g)) {
    const w = m[2]!;
    if (m[1] === '-') continue; // endings like -ешь
    if (w.length === 1) continue; // letters named as letters (after г, к, х …)
    if (!known.has(normalise(w))) unknown.add(w);
  }
  return [...unknown];
}

describe('Culture notes', () => {
  const notes = readdirSync('content/culture/notes').filter((f) => f.endsWith('.md'));
  const listed = (parse(readFileSync('content/culture/notes.yaml', 'utf8')) as { id: string }[]).map((n) => n.id);
  it('every note is listed, and every listed note exists', () => {
    expect(notes.map((f) => f.replace(/\.md$/, '')).sort()).toEqual([...listed].sort());
  });
  for (const f of notes) {
    it(`${f}: every Russian word is a real form in the data`, () => {
      expect(unknownWords(readFileSync(`content/culture/notes/${f}`, 'utf8')), 'words not found in the data').toEqual([]);
    });
  }
});

describe('Reading questions', () => {
  // Our Russian, like the Learn pages: each word a real form in the data, or a word of the text the question is about.
  const qs = parse(readFileSync('content/reading/questions.yaml', 'utf8')) as { id: string; questions: { ru: { q: string; options: string[] } }[] }[];
  // Words of the same work count (осьмушку is in another scene), and characters' names in any case (Ломову).
  type Unit = { words: Record<string, [string, string, string, string][]> };
  const byWork = new Map<string, { words: Set<string>; names: string[] }>();
  for (const entry of qs as unknown as { id: string; work: string }[]) {
    const file = `public/data/reading.${entry.id}.json`;
    if (!existsSync(file)) continue;
    const u = JSON.parse(readFileSync(file, 'utf8')) as Unit;
    const w = byWork.get(entry.work) ?? { words: new Set<string>(), names: [] };
    for (const [k, r] of Object.entries(u.words)) {
      w.words.add(k);
      if (r.some((x) => x[3] === 'n')) w.names.push(k);
    }
    byWork.set(entry.work, w);
  }
  for (const entry of qs as unknown as { id: string; work: string; questions: { ru: { q: string; options: string[] } }[] }[]) {
    it(`${entry.id}: every Russian word in the questions is real`, () => {
      const w = byWork.get(entry.work) ?? { words: new Set<string>(), names: [] };
      const isName = (k: string) => w.names.some((n) => n.length >= 4 && k.startsWith(n.replace(/[ауоыяеи]$/, '')) && k.length - n.length <= 3);
      const text = entry.questions.flatMap((q) => [q.ru.q, ...q.ru.options]).join('\n');
      expect(unknownWords(text).filter((x) => !w.words.has(normalise(x)) && !isName(normalise(x)))).toEqual([]);
    });
  }
});

describe('Learn pages', () => {
  it('there are Learn pages, each for a real topic', () => {
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) expect(ALL_TOPICS.map((t) => t.id), p).toContain(p.replace(/\.md$/, ''));
  });

  for (const page of pages) {
    const src = readFileSync(`content/learn/${page}`, 'utf8');
    const blocks = parseMarkdown(src);
    const top1000 = { verb: verbs.filter((v) => v.band <= 1), noun: nouns.filter((n) => n.band <= 1), adjective: adjs.filter((a) => a.band <= 1) };

    it(`${page}: every data block resolves`, () => {
      for (const b of blocks) {
        if (b.type !== 'data') continue;
        if (b.kind === 'examples') {
          const rows = json<ClozeRow[]>(`cloze.${b.topic}.json`).filter((r) => r[7] === b.item);
          expect(rows.length, `::examples ${b.topic} ${b.item}`).toBeGreaterThanOrEqual(b.count);
          continue;
        }
        if (b.kind === 'tatoeba') {
          for (const { id, mark } of b.items) {
            const s = extras.sentences[id];
            expect(s, `::tatoeba ${id}`).toBeTruthy();
            if (mark) expect([...s![0].matchAll(/[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g)].map((m) => normalise(m[0])), `::tatoeba ${id}:${mark}`).toContain(normalise(mark));
          }
          continue;
        }
        if (b.kind === 'collocations') {
          const vn = json<CollocationData>('verb-noun.json');
          for (const v of b.verbs) expect(pairsFor(vn, [v]).length, `::collocations ${v}`).toBeGreaterThan(0);
          continue;
        }
        if (b.kind === 'ipa') {
          for (const w of b.words) expect(extras.ipa[w], `::ipa ${w}`).toBeTruthy();
          continue;
        }
        if (b.kind === 'drill') {
          expect(ALL_TOPICS.filter(isDrill).map((t) => t.id), `::drill ${b.mode}`).toContain(b.mode);
          const key = b.mode === 'stress' ? 'stressDrill' : b.mode;
          const base = (DEFAULTS as unknown as Record<string, unknown>)[key];
          for (const k of Object.keys(b.settings)) expect(Object.keys(base as object), `::drill ${b.mode} setting ${k}`).toContain(k);
        } else if (b.kind === 'table' && b.what === 'pronouns') {
          expect(pron.personal.length).toBeGreaterThan(5);
        } else if (b.kind === 'table' && b.what === 'possessive') {
          expect(pron.possessive.find(([w]) => w.replace(/'/g, '') === b.word), `possessive ${b.word}`).toBeTruthy();
        } else if (b.kind === 'table' && b.what === 'numeral') {
          const nums = [...json<NumeralRow[]>('numerals.json'), ...json<NumeralRow[]>('collectives.json')];
          expect(nums.find((r) => r[0].replace(/'/g, '') === b.word), `numeral ${b.word}`).toBeTruthy();
        } else if (b.what === 'participles' || b.what === 'participle') {
          const row = participles.find((p) => p.row[1].replace(/'/g, '') === b.word);
          expect(row, `participles of ${b.word} (top 1,000 verbs)`).toBeTruthy();
          if (b.kind === 'sentence') {
            const shard = json<Record<string, SentenceRow[]>>(`sentences.participles.b${row!.band}.json`);
            const hit = (shard[row!.row[0]] ?? []).find((r) => normalise(r[1].slice(r[4], r[5])) === normalise(b.cell));
            expect(hit, `a sentence with ${b.cell} (${b.word})`).toBeTruthy();
          }
        } else {
          const what = b.what as 'verb' | 'noun' | 'adjective';
          const lemma = (top1000[what] as { accented: string }[]).find((x) => x.accented.replace(/'/g, '') === b.word);
          expect(lemma, `${what} “${b.word}” in the top 1,000`).toBeTruthy();
          if (b.kind === 'sentence') {
            const cell = resolveCell(what, lemma as never, b.cell);
            expect(cell, `cell ${b.cell} of ${b.word}`).toBeTruthy();
            // …and Tatoeba has a sentence with exactly that form.
            const l = lemma as unknown as { id: number; band: number };
            const type = what === 'verb' ? 'verbs' : what === 'noun' ? 'nouns' : 'adjectives';
            const shard = json<Record<string, SentenceRow[]>>(`sentences.${type}.b${l.band}.json`);
            expect(chooseSentence(shard[l.id], cell![0], cell![1]), `a sentence with ${b.word} ${b.cell}`).toBeTruthy();
          }
        }
      }
    });

    it(`${page}: every Russian word in the text is a real form in the data`, () => {
      expect(unknownWords(src), 'words not found in the data').toEqual([]);
    });
  }
});

describe('Markdown reader', () => {
  it('reads numbered lists, bullets, tips, tables and data blocks', () => {
    const b = parseMarkdown('1. one\n2. two\n\n- a\n- b\n\n> tip\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n::table noun книга\n::examples chtoby past 2');
    expect(b.map((x) => x.type)).toEqual(['list', 'list', 'tip', 'table', 'data', 'data']);
    expect((b[0] as { ordered?: boolean }).ordered).toBe(true);
    expect((b[1] as { ordered?: boolean }).ordered).toBeUndefined();
  });
});

describe('Writing prompts', () => {
  const levels = parse(readFileSync('content/writing.yaml', 'utf8')) as { level: string; prompts: { id: string; title: string; task: string; checklist: string[]; learn: string[]; vocab: string[] }[] }[];
  const themes = (JSON.parse(readFileSync('public/data/themes.json', 'utf8')) as { themes: { id: string }[] }).themes.map((t) => t.id);
  it('cover A1 to C1, each prompt linking real topics and themes', () => {
    expect(levels.map((l) => l.level)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    for (const p of levels.flatMap((l) => l.prompts)) {
      for (const id of p.learn) expect(ALL_TOPICS.some((t) => t.id === id && t.learn !== false), `${p.id}: ${id}`).toBe(true);
      for (const id of p.vocab) expect(themes, `${p.id}: ${id}`).toContain(id);
    }
  });
  it('every Russian word in them is a real form in the data', () => {
    const text = levels.flatMap((l) => l.prompts.flatMap((p) => [p.title, p.task, ...p.checklist])).join('\n');
    expect(unknownWords(text), 'words not found in the data').toEqual([]);
  });
});
