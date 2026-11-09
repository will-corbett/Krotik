/**
 * Idioms and proverbs (critique batch 5): from Wiktionary (the extract's `idioms`), kept only when a real Tatoeba
 * sentence uses them: the idiom's words in order, a verb in any of its forms, at most one other word between them.
 * curated/idioms.yaml leaves some out (literal uses, not idioms) and gives clearer meanings. Crude sentences are never
 * examples.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { IdiomData } from '../../src/shared/types.ts';
import type { Report } from './report.ts';
import { CRUDE } from './themes.ts';
import { wkToApostrophe } from './wiktionary.ts';

const S = 'Idioms (Wiktionary, found in Tatoeba)';
const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;
const EXAMPLES = 3;

/** Wiktionary's first gloss, shortened: the first of several meanings, without its explanation in brackets. */
export function shortGloss(g: string): string {
  return g.split(';')[0]!.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

export function buildIdioms(inp: {
  idioms: [string, string, string, string[]][];
  pairs: { rid: number; ru: string; en: string }[];
  /** verb infinitive → every form (so an idiom's verb matches however it's conjugated) */
  verbForms: Map<string, Set<string>>;
  curated?: { exclude?: Record<string, string>; gloss?: Record<string, string> };
  report: Report;
}): IdiomData {
  const cur = inp.curated ?? (parse(readFileSync('curated/idioms.yaml', 'utf8')) as { exclude?: Record<string, string>; gloss?: Record<string, string> });
  const sentences = inp.pairs
    .filter((p) => !CRUDE.test(p.ru))
    .map((p) => ({ p, toks: [...p.ru.matchAll(TOKEN)].map((m) => ({ n: normalise(m[0]), start: m.index!, end: m.index! + m[0].length })) }));
  const byWord = new Map<string, number[]>();
  sentences.forEach((s, i) => {
    for (const n of new Set(s.toks.map((t) => t.n))) {
      const list = byWord.get(n);
      if (list) list.push(i);
      else byWord.set(n, [i]);
    }
  });
  const out: IdiomData = { idioms: [] };
  for (const [word, canon, gloss, tags] of inp.idioms) {
    if (cur.exclude?.[word] !== undefined) {
      inp.report.count(S, 'left out by hand (curated/idioms.yaml)');
      continue;
    }
    if (/^(misspelling|ellipsis|alternative|abbreviation|initialism)\b/i.test(gloss)) continue;
    const words = [...word.matchAll(/[а-яё]+(?:-[а-яё]+)*/g)].map((m) => normalise(m[0]));
    const options = words.map((w) => inp.verbForms.get(w) ?? new Set([w]));
    const fixed = words.filter((_, i) => options[i]!.size === 1);
    let cands = fixed.length ? (byWord.get(fixed[0]!) ?? []) : sentences.map((_, i) => i);
    for (const f of fixed.slice(1)) {
      const has = new Set(byWord.get(f) ?? []);
      cands = cands.filter((i) => has.has(i));
    }
    const found: IdiomData['idioms'][number][3] = [];
    for (const i of cands) {
      const { p, toks } = sentences[i]!;
      for (let st = 0; st < toks.length; st++) {
        let j = st;
        let first = -1;
        let last = -1;
        let ok = true;
        for (const o of options) {
          const k = [j, j + 1].find((x) => x < toks.length && o.has(toks[x]!.n) && (first >= 0 || x === st));
          if (k === undefined) {
            ok = false;
            break;
          }
          if (first < 0) first = k;
          last = k;
          j = k + 1;
        }
        if (ok) {
          found.push([p.rid, p.ru, p.en, toks[first]!.start, toks[last]!.end]);
          break;
        }
      }
    }
    if (!found.length) continue;
    found.sort((a, b) => a[1].length - b[1].length || a[0] - b[0]);
    // Wiktionary's stress-marked form, unless it isn't the whole idiom (a proverb's stops at its first comma).
    const stressed = wkToApostrophe(canon).replace(/\s+'/g, "'");
    const phrase = normalise(stressed.replace(/[,—–-]/g, ' ')).replace(/\s+/g, ' ').trim() === normalise(word.replace(/[,—–-]/g, ' ')).replace(/\s+/g, ' ').trim() ? stressed : word;
    out.idioms.push([phrase, cur.gloss?.[word] ?? shortGloss(gloss), tags.includes('proverb') ? 1 : 0, found.slice(0, EXAMPLES)]);
    inp.report.count(S, tags.includes('proverb') ? 'proverbs found in a sentence' : 'idioms found in a sentence');
  }
  out.idioms.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  inp.report.count(S, 'idioms and proverbs in Wiktionary (several words, idiomatic, not crude or old)', inp.idioms.length);
  for (const k of Object.keys(cur.gloss ?? {})) if (!out.idioms.some((x) => normalise(x[0]) === normalise(k))) inp.report.anomaly(S, 'curated meanings for idioms not published (check the spelling)', k);
  return out;
}
