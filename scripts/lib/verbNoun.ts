/**
 * Words that go together (critique batch 5): verb + noun pairs from curated/collocations.yaml (принять решение), each
 * checked against the Tatoeba sentences, and the "Which verb?" drill items made from those sentences.
 *
 * A pair is found in a sentence when a form of one of its verbs and a form of the noun in the pair's case come within
 * three words of each other, either way round (Russian also says «решение принято … », «ошибку я сделал»), with no
 * punctuation between and each word belonging to that one lemma only.
 *
 * Drill items: the verb gapped in the sentence (its English shown), and as wrong options the same form of other verbs
 * from the list, of the same aspect, that are never used with this noun: not listed with it, and not found near it in
 * any sentence. The English decides between pairs that are both real (принять совет / дать совет).
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { NOUN_CELLS, VERB_INFINITIVE_CELL } from '../../src/shared/cells.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { CollocationData } from '../../src/shared/types.ts';
import type { Noun } from './clean-nouns.ts';
import type { Verb } from './clean-verbs.ts';
import type { Report } from './report.ts';
// The corpus shape, declared here rather than imported: sentences.ts pulls in the bzip2 stream, which has no type
// declarations where the unit tests are type-checked (svelte-check).
interface Corpus {
  pairs: { rid: number; ru: string; en: string }[];
  owners: Map<string, Set<string>>;
  masks: Map<string, number>;
}
const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

const S = 'Words that go together (curated/collocations.yaml)';
const NEAR = 3;
const PER_PAIR = 3;

interface Entry {
  noun: string;
  verbs: string[];
  case?: 'acc' | 'gen';
  pl?: boolean;
  /** only the singular counts (брать слово, take the floor; but брать слова обратно, take back what you said) */
  sg?: boolean;
  prep?: string;
  en: string;
}
export const loadCollocations = (): Entry[] => parse(readFileSync('curated/collocations.yaml', 'utf8')) as Entry[];

/**
 * Verbs never offered as wrong options: they go with almost any noun (отдал заявление, нашёл совет, взял, сделал …), so
 * a "wrong" one could well be right.
 */
const GENERIC = new Set('делать сделать брать взять давать дать получать получить находить найти искать терять потерять отдавать отдать открывать открыть держать сдержать иметь читать прочитать готовить приготовить мыть помыть снимать снять платить заплатить вести нести принимать принять подавать подать ставить поставить поднимать поднять решать решить признавать признать составлять составить спасать спасти портить испортить терпеть'.split(' '));

/** A stable pseudo-random order (so the build is deterministic). */
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

export function buildVerbNoun(inp: { corpus: Corpus; verbs: Verb[]; nouns: Noun[]; entries?: Entry[]; report: Report }): CollocationData {
  const { corpus, report } = inp;
  const entries = inp.entries ?? loadCollocations();
  // The most common lemma for each spelling (the lists are in frequency order).
  const verbByBare = new Map<string, Verb>();
  for (const v of inp.verbs) if (!verbByBare.has(v.bare)) verbByBare.set(v.bare, v);
  const nounByBare = new Map<string, Noun>();
  for (const n of inp.nouns) if (!nounByBare.has(n.bare)) nounByBare.set(n.bare, n);

  type Pair = { e: Entry; noun: Noun; verbs: Verb[] };
  const pairs: Pair[] = [];
  for (const e of entries) {
    const noun = nounByBare.get(e.noun);
    const verbs = e.verbs.map((b) => verbByBare.get(b));
    if (!noun || verbs.some((v) => !v)) {
      report.anomaly(S, 'pairs whose noun or verb is not in the data (left out)', `${e.verbs.join('/')} ${e.noun}`);
      continue;
    }
    pairs.push({ e, noun, verbs: verbs as Verb[] });
  }

  // Tokens of every sentence, each with its one owner (or none).
  const only = (n: string) => {
    const o = corpus.owners.get(n);
    return o?.size === 1 ? [...o][0]! : '';
  };
  const caseMask = (c: 'acc' | 'gen', only?: 'sg' | 'pl') => NOUN_CELLS.reduce((m, k, i) => (k.endsWith(`_${c}`) && (!only || k.startsWith(only)) ? m | (1 << i) : m), 0);
  const sentences = corpus.pairs.map((p) => {
    const toks = [...p.ru.matchAll(TOKEN)].map((m) => {
      const n = normalise(m[0]);
      const owner = only(n);
      return { text: m[0], start: m.index!, end: m.index! + m[0].length, owner, mask: owner ? (corpus.masks.get(`${n}|${owner}`) ?? 0) : 0 };
    });
    return { p, toks };
  });
  const near = (ru: string, a: { start: number; end: number }, b: { start: number; end: number }) => {
    const [x, y] = a.start < b.start ? [a, b] : [b, a];
    return !/[.,;:!?—–()«»"]/.test(ru.slice(x.end, y.start));
  };

  // Every verb from the list found near every noun from the list (in any case): what can't be a wrong option.
  const listVerbs = new Map<number, Verb>();
  for (const pr of pairs) for (const v of pr.verbs) listVerbs.set(v.id, v);
  const listNouns = new Set(pairs.map((pr) => pr.noun.id));
  const seenWith = new Map<number, Set<number>>(); // noun id → verb ids
  for (const { p, toks } of sentences) {
    toks.forEach((t, i) => {
      if (!t.owner.startsWith('verbs:')) return;
      const vid = Number(t.owner.slice(6));
      if (!listVerbs.has(vid)) return;
      for (let j = Math.max(0, i - NEAR); j <= Math.min(toks.length - 1, i + NEAR); j++) {
        const u = toks[j]!;
        if (j === i || !u.owner.startsWith('nouns:') || !near(p.ru, t, u)) continue;
        const nid = Number(u.owner.slice(6));
        if (listNouns.has(nid)) (seenWith.get(nid) ?? seenWith.set(nid, new Set()).get(nid)!).add(vid);
      }
    });
  }
  for (const pr of pairs) for (const v of pr.verbs) (seenWith.get(pr.noun.id) ?? seenWith.set(pr.noun.id, new Set()).get(pr.noun.id)!).add(v.id);

  const out: CollocationData = { pairs: [], items: [] };
  for (const pr of pairs) {
    const cm = caseMask(pr.e.case ?? 'acc', pr.e.sg ? 'sg' : undefined);
    const vids = new Set(pr.verbs.map((v) => v.id));
    const found: { rid: number; ru: string; en: string; tok: { text: string; start: number; end: number; mask: number }; verb: Verb }[] = [];
    for (const { p, toks } of sentences) {
      toks.forEach((t, i) => {
        if (!t.owner.startsWith('verbs:') || !vids.has(Number(t.owner.slice(6)))) return;
        for (let j = Math.max(0, i - NEAR); j <= Math.min(toks.length - 1, i + NEAR); j++) {
          const u = toks[j]!;
          if (j === i || u.owner !== `nouns:${pr.noun.id}` || !(u.mask & cm) || !near(p.ru, t, u)) continue;
          if (!found.some((f) => f.rid === p.rid)) found.push({ rid: p.rid, ru: p.ru, en: p.en, tok: t, verb: pr.verbs.find((v) => v.id === Number(t.owner.slice(6)))! });
        }
      });
    }
    if (!found.length) {
      report.anomaly(S, 'pairs not found in any sentence (left out)', `${pr.e.verbs.join('/')} ${pr.e.noun}`);
      continue;
    }
    const idx = out.pairs.length;
    // The pair as it's said: the last verb (the perfective, where there are two) and the noun in its case and number.
    const cell = pr.noun.cells[NOUN_CELLS.indexOf(`${pr.e.pl ? 'pl' : 'sg'}_${pr.e.case ?? 'acc'}` as (typeof NOUN_CELLS)[number])];
    const nounForm = cell ? cellForms(cell)[0] : undefined;
    if (!nounForm) {
      report.anomaly(S, 'pairs whose noun has no form in that case (left out)', `${pr.e.verbs.join('/')} ${pr.e.noun}`);
      continue;
    }
    out.pairs.push({
      phrase: `${pr.verbs.at(-1)!.accented} ${nounForm}${pr.e.prep ? ` ${pr.e.prep}` : ''}`,
      noun: [`n:${pr.noun.id}`, pr.noun.accented],
      verbs: pr.verbs.map((v) => [`v:${v.id}`, v.accented]),
      en: pr.e.en,
      case: pr.e.case ?? 'acc',
      ...(pr.e.pl ? { pl: true } : {}),
      ...(pr.e.prep ? { prep: pr.e.prep } : {}),
      sentences: found.length,
    });
    report.count(S, 'pairs found in the sentences');
    // The shortest sentences make the drill items.
    for (const f of [...found].sort((a, b) => a.ru.length - b.ru.length || a.rid - b.rid).slice(0, PER_PAIR)) {
      // A spelling that is several forms (заводите: you start / start!): at the start of a sentence it's the imperative
      // (cells 10–11), otherwise the first form it can be. The wrong options are then all that same form.
      const bits = [...Array(VERB_INFINITIVE_CELL + 1).keys()].filter((b) => f.tok.mask & (1 << b));
      const atStart = !/[А-ЯЁа-яё]/.test(f.ru.slice(0, f.tok.start));
      const bit = (atStart ? bits.find((b) => b === 10 || b === 11) : undefined) ?? bits[0];
      if (bit === undefined) continue;
      const formOf = (v: Verb) => {
        const cell = bit === VERB_INFINITIVE_CELL ? v.accented : v.cells[bit];
        const form = cell ? cellForms(cell)[0] : undefined;
        if (!form) return null;
        const plain = form.replace(/'/g, '');
        return /^[А-ЯЁ]/.test(f.tok.text) ? plain[0]!.toUpperCase() + plain.slice(1) : plain;
      };
      const banned = seenWith.get(pr.noun.id)!;
      const wrong = [...listVerbs.values()]
        .filter((v) => v.aspect === f.verb.aspect && !banned.has(v.id) && !GENERIC.has(v.bare))
        .sort((a, b) => hash(`${f.rid}:${a.bare}`) - hash(`${f.rid}:${b.bare}`))
        .map(formOf)
        .filter((x): x is string => !!x && normalise(x) !== normalise(f.tok.text));
      const options = [...new Set([f.tok.text, ...wrong])].slice(0, 4);
      if (options.length < 4) continue;
      out.items.push([idx, f.rid, f.ru, f.en, f.tok.start, f.tok.end, options.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))]);
    }
  }
  report.count(S, 'pairs in the list', entries.length);
  report.count(S, '"Which verb?" items (real sentences, the verb gapped)', out.items.length);
  return out;
}
