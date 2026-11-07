/** Read and fill in: the literature parser, the archaic check, the built passages, and the round generator. */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { chooseGaps, parseWork, plain, problemsIn } from '../../scripts/lib/literature.ts';
import { generateReadingQuestions } from '../../src/lib/questions/reading.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ReadingData, ReadingLine } from '../../src/shared/types.ts';

const story = (id = 'x') => ({ id, author: 'А', authorEn: 'A', died: 1900, title: 'T', titleEn: 'T', year: 1880, page: 'p', revision: 1, kind: 'stories' as const, level: ['A2', 'B1'] as [string, string] });

describe('wikitext', () => {
  it('keeps only the text: no notes, links, spacing templates or stress marks', () => {
    expect(plain("Он '''пришёл'''<ref>примечание</ref> к [[w:Москва|Москве]]&nbsp;{{razr|быстро}} и́ ушёл.")).toBe('Он пришёл к Москве быстро и ушёл.');
  });
  it('stories: one section per <h2>, paragraphs as lines, verse and the header left out', () => {
    const src = `{{Отексте\n| АВТОР=[[Лев Толстой]]\n}}\n[[Категория:Рассказы]]\n<h2>АКУЛА (Рассказ)</h2>\n\nНаш корабль стоял.\n\nБыло жарко.\n<h2>СУХМАН (Стихи-сказка)</h2>\n\nКак во стольном городе\n`;
    const ps = parseWork(story(), src);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.section).toBe('Акула');
    expect(ps[0]!.lines).toEqual([
      ['', 'Наш корабль стоял.', 0],
      ['', 'Было жарко.', 0],
    ]);
  });
  it('plays: scenes, speakers, inline stage directions, and stage lines; the cast list is skipped', () => {
    const src = `{{Отексте\n}}\n=== Действующие лица ===\n{{razr|Лука}}, лакей.\n\n=== I ===\n{{rem|Гостиная.}}\n\n{{razr|Лука}}. Нехорошо, барыня…\n\n{{razr|Попова}} <small>''(решительно)''</small>. Я прошу тебя!\n`;
    const ps = parseWork({ ...story(), kind: 'play' }, src);
    expect(ps[0]!.section).toBe('Явление I');
    expect(ps[0]!.lines).toEqual([
      ['', 'Гостиная.', 1],
      ['Лука', 'Нехорошо, барыня…', 0],
      ['Попова', '(решительно) Я прошу тебя!', 0],
    ]);
  });
});

describe('archaic forms are flagged and the passage left out', () => {
  const owners = new Map<string, Set<string>>([
    ['он', new Set(['other:он'])],
    ['пошел', new Set(['verbs:1'])],
    ['к', new Set(['other:к'])],
    ['лука', new Set(['nouns:2'])],
  ]);
  const inp = { owners, modern: new Set(['дому']), old: new Set(['подле', 'чрез']) };
  const why = (text: string) => problemsIn([['', text, 0]], inp).map((p) => `${p.word}: ${p.why}`);
  it('a word Wiktionary has only as archaic, obsolete or dated', () => {
    expect(why('Он пошел подле дому.')).toEqual(['подле: archaic, obsolete or dated in Wiktionary']);
  });
  it('the old polite -с particle', () => {
    expect(why('Пошел-с.')).toEqual(['Пошел-с: the old polite -с particle']);
  });
  it('a word in neither our data nor Wiktionary', () => {
    expect(why('Он пошел подуздоват.')).toEqual(['подуздоват: not in our data or Wiktionary']);
  });
  it('Latin script', () => {
    expect(why('Он пошел, Nicolas.')).toEqual([': Latin script']);
  });
  it('names inside a sentence are fine (and are never gaps)', () => {
    expect(why('Он пошел к Ивану.')).toEqual([]);
    const lemma = (o: string) => (o === 'nouns:2' ? { accented: 'лук', gloss: 'onion', rank: 10 } : { accented: "пойти'", gloss: 'go', rank: 10 });
    const text = 'Он пошел к Лука.';
    const gaps = chooseGaps([['', text, 0]] as ReadingLine[], { owners, lemma });
    expect(gaps.map(([, s, e]) => text.slice(s, e))).toEqual(['пошел']);
  });
});

const built = existsSync('public/data/reading.json');
describe.skipIf(!built)('the built passages', () => {
  const data = JSON.parse(readFileSync('public/data/reading.json', 'utf8')) as ReadingData;
  const cfg = parse(readFileSync('curated/literature.yaml', 'utf8')) as { works: { died: number; revision: number; year: number }[] };
  it('every work is in the public domain (author died 70+ years ago, published in their lifetime) at a pinned revision', () => {
    for (const w of cfg.works) {
      expect(w.died + 70).toBeLessThan(new Date().getFullYear());
      expect(w.year).toBeLessThanOrEqual(w.died);
      expect(Number.isInteger(w.revision)).toBe(true);
    }
  });
  it('there are passages from each kind of text, in modern spelling, with no Latin and no -с forms', () => {
    expect(data.passages.filter((p) => data.works[p.w]!.kind === 'stories').length).toBeGreaterThan(40);
    expect(data.passages.filter((p) => data.works[p.w]!.kind === 'play').length).toBeGreaterThan(10);
    for (const p of data.passages) {
      for (const l of p.lines) {
        expect(l[1]).not.toMatch(/[ѣіѳѵA-Za-z]/);
        expect(l[1]).not.toMatch(/[А-ЯЁа-яё]-с\b/);
      }
    }
  });
  it('every gap is a real word of the passage and differs from its hint', () => {
    for (const p of data.passages) {
      expect(p.gaps.length).toBeGreaterThan(0);
      for (const [line, start, end, kind, hint] of p.gaps) {
        const word = p.lines[line]![1].slice(start, end);
        expect(word).toMatch(/^[А-ЯЁа-яё-]+$/);
        expect(['v', 'n', 'a']).toContain(kind);
        expect(normalise(word)).not.toBe(normalise(hint));
      }
    }
  });
  it('a round reads on through the text, gap by gap, with the chosen kinds only', () => {
    const qs = generateReadingQuestions(data, { works: ['stories'], kinds: ['v'] }, 12, mulberry32(3));
    expect(qs).toHaveLength(12);
    expect(new Set(qs.map((q) => q.key)).size).toBe(12);
    for (const q of qs) {
      expect(q.task[0]!.en).toMatch(/verb/);
      expect(q.passage!.lines[q.passage!.line]![1].slice(q.passage!.start, q.passage!.end)).toBe(q.answer);
    }
    const order = qs.map((q) => q.key.split(':').map(Number));
    for (let k = 1; k < order.length; k++) {
      const [, p0, g0] = order[k - 1]!;
      const [, p1, g1] = order[k]!;
      expect(p1! > p0! || (p1 === p0 && g1! > g0!) || p1! < p0!).toBe(true); // forward, or wrapped round
    }
    expect(generateReadingQuestions(data, { works: ['play'], kinds: ['n', 'a'] }, 5, mulberry32(1)).every((q) => q.passage!.credit.includes('Чехов'))).toBe(true);
  });
});
