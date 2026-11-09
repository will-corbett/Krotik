/**
 * Word order practice (critique batch 5): content/word-order.yaml, a question and two orders of one answer. Our own
 * Russian, so every word must be a real form (or a declared name), and an item is published only once a native speaker
 * has reviewed it; the rest go to reports/word-order-for-review.md.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { normalise } from '../../src/shared/normalise.ts';
import { REVIEWED } from '../../src/lib/reviewed.ts';
import type { ReadingLine, WordOrderData } from '../../src/shared/types.ts';
import type { Lexicon } from './literature.ts';
import type { Report } from './report.ts';
import { checkRussian } from './themes.ts';

const S = 'Word order practice (content/word-order.yaml)';
interface Item {
  q: string;
  qen: string;
  right: string;
  other: string;
  en: string;
  reviewed?: string;
}

export function buildWordOrder(lex: Lexicon, report: Report, src = parse(readFileSync('content/word-order.yaml', 'utf8')) as { names?: string[]; items: Item[] }): { data: WordOrderData; review: string } {
  const names = new Set((src.names ?? []).map(normalise));
  const errors: string[] = [];
  const data: WordOrderData = { items: [] };
  const review = ['# Word order practice for review', '', 'Each item: a question and two orders of the same answer. The first answer is the one we think sounds natural as a reply (the new information last). Please check both: is the first natural, and is the second really the less natural reply? Mark changes by number. When an item is approved, its `reviewed` field in `content/word-order.yaml` gets the reviewer\'s name and the date.', '', '| # | Question | Natural answer | Other order |', '|---:|---|---|---|'];
  src.items.forEach((it, i) => {
    const sorted = (s: string) => normalise(s.replace(/[.,!?]/g, '')).split(/\s+/).sort().join(' ');
    if (sorted(it.right) !== sorted(it.other) || it.right === it.other) errors.push(`item ${i + 1}: the two answers must be the same words in another order`);
    const lines: ReadingLine[] = [it.q, it.right, it.other].map((t) => ['', t, 0]);
    for (const p of checkRussian(lines, names, lex).problems) errors.push(`item ${i + 1}: ${p}`);
    const r = it.reviewed?.trim();
    if (r && !REVIEWED.test(r)) errors.push(`item ${i + 1}: reviewed must be "<who>, YYYY-MM-DD"`);
    if (r) data.items.push([it.q, it.qen, it.right, it.other, it.en, r]);
    else review.push(`| ${i + 1} | ${it.q} *(${it.qen})* | ${it.right} | ${it.other} |`);
  });
  if (errors.length) throw new Error(`content/word-order.yaml:\n  ${errors.join('\n  ')}`);
  const waiting = src.items.length - data.items.length;
  if (!waiting) review.push('', 'Nothing waiting: every item has been reviewed.');
  report.count(S, 'items written', src.items.length);
  report.count(S, 'items published (reviewed by a native speaker)', data.items.length);
  report.count(S, 'items waiting for review (reports/word-order-for-review.md)', waiting);
  return { data, review: review.join('\n') + '\n' };
}
