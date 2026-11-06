/**
 * Learn pages: every data block must resolve against the data, and every Russian word written in
 * the explanations must exist as a real form in the data (verbs, nouns, adjectives, pronouns,
 * numerals, others.csv). Nothing invented gets onto a Learn page.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { AdjRow, NounRow, NumeralRow, PronounData, SentenceRow, VerbRow } from '../../src/shared/types.ts';
import { parseMarkdown } from '../../src/lib/learn.ts';
import { ALL_TOPICS } from '../../src/lib/topics.ts';
import { DEFAULTS } from '../../src/lib/settings.ts';
import { resolveCell } from '../../src/lib/learnData.ts';
import { chooseSentence, toAdjective, toNoun, toVerb } from '../../src/lib/data.ts';

const json = <T>(f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;
const bands = [0, 1, 2, 3];
const verbs = bands.flatMap((b) => json<VerbRow[]>(`verbs.b${b}.json`).map((r) => toVerb(r, b)));
const nouns = bands.flatMap((b) => json<NounRow[]>(`nouns.b${b}.json`).map((r) => toNoun(r, b)));
const adjs = bands.flatMap((b) => json<AdjRow[]>(`adjectives.b${b}.json`).map((r) => toAdjective(r, b)));
const pron = json<PronounData>('pronouns.json');

const known = new Set<string>();
const add = (cell: string | undefined) => cell && cellForms(cell).forEach((f) => known.add(normalise(f)));
for (const v of verbs) [v.accented, ...v.cells, ...v.partners].forEach(add);
for (const n of nouns) [n.accented, ...n.cells].forEach(add);
for (const a of adjs) [a.accented, ...a.cells, ...a.extra].forEach(add);
for (const [w, a, b] of pron.personal) [w, ...a, ...b].forEach(add);
for (const [w, c] of pron.possessive) [w, ...c].forEach(add);
for (const [w, , cells] of [...json<NumeralRow[]>('numerals.json'), ...json<NumeralRow[]>('collectives.json')]) [w, ...Object.values(cells)].forEach(add);
if (existsSync('data-raw/others.csv')) {
  for (const line of readFileSync('data-raw/others.csv', 'utf8').split(/\r?\n/).slice(1)) add(line.split('\t')[0]);
}

// Extra words, each checked against Wiktionary by the data build (which fails otherwise).
for (const w of parse(readFileSync('content/learn/words.yaml', 'utf8')) as string[]) known.add(normalise(w));

const pages = readdirSync('content/learn').filter((f) => f.endsWith('.md'));

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
        if (b.kind === 'drill') {
          expect(ALL_TOPICS.map((t) => t.id), `::drill ${b.mode}`).toContain(b.mode);
          const key = b.mode === 'stress' ? 'stressDrill' : b.mode;
          const base = (DEFAULTS as unknown as Record<string, unknown>)[key];
          for (const k of Object.keys(b.settings)) expect(Object.keys(base as object), `::drill ${b.mode} setting ${k}`).toContain(k);
        } else if (b.what !== 'pronouns') {
          const lemma = (top1000[b.what] as { accented: string }[]).find((x) => x.accented.replace(/'/g, '') === b.word);
          expect(lemma, `${b.what} “${b.word}” in the top 1,000`).toBeTruthy();
          if (b.kind === 'sentence') {
            const cell = resolveCell(b.what, lemma as never, b.cell);
            expect(cell, `cell ${b.cell} of ${b.word}`).toBeTruthy();
            // …and Tatoeba has a sentence with exactly that form.
            const l = lemma as unknown as { id: number; band: number };
            const type = b.what === 'verb' ? 'verbs' : b.what === 'noun' ? 'nouns' : 'adjectives';
            const shard = json<Record<string, SentenceRow[]>>(`sentences.${type}.b${l.band}.json`);
            expect(chooseSentence(shard[l.id], cell![0], cell![1]), `a sentence with ${b.word} ${b.cell}`).toBeTruthy();
          }
        }
      }
    });

    it(`${page}: every Russian word in the text is a real form in the data`, () => {
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
      expect([...unknown], 'words not found in the data').toEqual([]);
    });
  }
});
