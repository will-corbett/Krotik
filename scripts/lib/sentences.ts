/**
 * Example sentences from Tatoeba (CC BY 2.0 FR), matched to lemma forms.
 *
 * Filters: Russian 16–70 chars, ends in . ! or ?, no Latin letters or digits, has an English
 * translation, deduplicated by Russian text.
 *
 * Matching is deliberately conservative — a token is used only if:
 *  - it has ≥ 3 letters;
 *  - its normalised form belongs to exactly one lemma across verbs, adjectives, nouns,
 *    others.csv and proper nouns (homographs like тому/Тому, стали, мой are skipped);
 *  - it is lowercase in the sentence, or sentence-initial and never seen capitalised
 *    mid-sentence anywhere in the corpus (so names like Том never match the pronoun тот).
 * Each stored hit records which cells of the lemma the token can be (a bitmask), so a
 * question can prefer a sentence with the exact target form.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import bz2 from 'unbzip2-stream';
import { cellForms } from '../../src/shared/forms.ts';
import { ADJ_EXTRA_CELL_OFFSET, VERB_INFINITIVE_CELL } from '../../src/shared/cells.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { SentenceRow } from '../../src/shared/types.ts';
import { RAW_DIR } from './sources.ts';
import { bandOf, writeJson } from './shard.ts';
import type { Report } from './report.ts';

interface Lemma {
  id: number;
  bare: string;
  cells: string[];
  /** Adjectives: short forms, comparative, superlative — indexed as cells 26–31. */
  extra?: string[];
  /** Frequency rank when it isn't the position in the list (participles follow their verb's rank). */
  rank?: number;
}
interface Input {
  verbs: Lemma[];
  adjectives: Lemma[];
  nouns: Lemma[];
  /** Verbal adverbs and participles per verb: every form, in a fixed order (bit = index mod 31). */
  participles?: Lemma[];
  others: Record<string, string>[];
  properNouns: Record<string, string>[];
  deny: Record<string, string>;
  report: Report;
}
export type SentenceShardInfo = { band: number; file: string; lemmas: number; sentences: number; bytes: number };

/** The filtered Tatoeba corpus and form index, reused by the cloze builder. */
export interface Corpus {
  pairs: { rid: number; ru: string; en: string }[];
  /** normalised form → owners ("verbs:12", "adjectives:3", "other:как", "name:Том") */
  owners: Map<string, Set<string>>;
  /** `${form}|${owner}` → bitmask of cells */
  masks: Map<string, number>;
  /** normalised tokens seen capitalised mid-sentence (likely names) */
  capitalisedMid: Set<string>;
}

/** Up to this many sentences per lemma, chosen to cover as many different forms as possible. */
const PER_LEMMA = 10;
/** Bit used for a verb's infinitive in sentence masks (the 12 verb cells are bits 0–11). */
const INFINITIVE_BIT = VERB_INFINITIVE_CELL;
const S = 'Sentences';

async function* lines(file: string): AsyncGenerator<string> {
  const stream = createReadStream(join(RAW_DIR, file)).pipe(bz2());
  yield* createInterface({ input: stream, crlfDelay: Infinity });
}

export const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

export async function buildSentences(inp: Input): Promise<{ shards: Record<string, SentenceShardInfo[]>; corpus: Corpus }> {
  const { report } = inp;

  // ---- form index: normalised form → owners ("type:id") and per-owner cell mask
  const owners = new Map<string, Set<string>>();
  const masks = new Map<string, number>(); // `${form}|${type}:${id}` → mask
  // Participle/adverb forms live in their own index, consulted only for tokens that aren't a form of any
  // other word, so adding them never makes an existing match ambiguous (будущее the noun stays a noun).
  const pOwners = new Map<string, Set<string>>();
  // Normalising folds ё into е, but a sentence that writes ё has told us the word: отменён (cancelled) is not
  // отменен, the short form of отменный (excellent). `yo` holds each owner's normalised forms spelt with ё.
  const yo = new Set<string>();
  // (Only real forms count: a few headwords are spelt with ё where their forms aren't, крёстный / кре́стный.)
  const addOwner = (form: string, owner: string, cell: number, headword = false) => {
    const n = normalise(form);
    if (!n) return;
    if (/ё/i.test(form) && !headword) yo.add(`${n}|${owner}`);
    const map = owner.startsWith('participles:') ? pOwners : owners;
    let o = map.get(n);
    if (!o) map.set(n, (o = new Set()));
    o.add(owner);
    if (cell >= 0) {
      const k = `${n}|${owner}`;
      masks.set(k, (masks.get(k) ?? 0) | (1 << cell));
    }
  };
  for (const [type, list] of [['verbs', inp.verbs], ['adjectives', inp.adjectives], ['nouns', inp.nouns], ['participles', inp.participles ?? []]] as const) {
    for (const l of list) {
      // Verb infinitives are cell 12 (after the 12 verb cells), so infinitive answers can find sentences too.
      addOwner(l.bare, `${type}:${l.id}`, type === 'verbs' ? INFINITIVE_BIT : -1, type !== 'verbs');
      const cells = type === 'adjectives' ? [...l.cells, ...(l.extra ?? [])] : l.cells;
      cells.forEach((c, i) => cellForms(c).forEach((f) => addOwner(f, `${type}:${l.id}`, type === 'participles' ? i % 31 : i)));
    }
  }
  for (const o of inp.others) addOwner(o.bare!, `other:${o.bare}`, -1);
  for (const p of inp.properNouns) {
    for (const [k, v] of Object.entries(p)) {
      if (/^(sg|pl)_(nom|gen|dat|acc|inst|prep)$/.test(k) || k === 'bare') for (const f of v.split(/,|\/\//)) addOwner(f.replace(/[()*]/g, ''), `name:${p.bare}`, -1);
    }
  }

  // ---- Tatoeba
  const links = new Map<number, number[]>();
  for await (const l of lines('rus-eng_links.tsv.bz2')) {
    const [r, e] = l.split('\t').map(Number) as [number, number];
    const a = links.get(r);
    if (a) a.push(e);
    else links.set(r, [e]);
  }
  const rus = new Map<number, string>();
  const seenText = new Set<string>();
  const capitalisedMid = new Set<string>();
  let total = 0;
  for await (const l of lines('rus_sentences.tsv.bz2')) {
    const [idS, , text0] = l.split('\t');
    total++;
    const text = (text0 ?? '').normalize('NFC').trim();
    // corpus-wide name detection uses every sentence, not just kept ones
    let first = true;
    for (const m of text.matchAll(TOKEN)) {
      if (!first && /^[А-ЯЁ]/.test(m[0])) capitalisedMid.add(normalise(m[0]));
      first = false;
    }
    const id = Number(idS);
    if (text.length < 16 || text.length > 70) continue;
    if (!/[.!?]$/.test(text) || /[A-Za-z0-9]/.test(text)) continue;
    if (!links.has(id) || id in inp.deny) continue;
    if (seenText.has(text)) continue;
    seenText.add(text);
    rus.set(id, text);
  }
  const wantEng = new Set<number>();
  for (const id of rus.keys()) for (const e of links.get(id)!) wantEng.add(e);
  const eng = new Map<number, string>();
  for await (const l of lines('eng_sentences.tsv.bz2')) {
    const tab = l.indexOf('\t');
    const id = Number(l.slice(0, tab));
    if (!wantEng.has(id)) continue;
    const text = l.slice(l.indexOf('\t', tab + 1) + 1).trim();
    if (text.length <= 120) eng.set(id, text);
  }
  report.count(S, 'Russian sentences in Tatoeba export', total);

  // ---- match
  type Hit = { rid: number; ru: string; en: string; mask: number; start: number; end: number };
  const hits = new Map<string, Hit[]>(); // owner → hits
  let kept = 0;
  let skippedAmbiguous = 0;
  const pairs: Corpus['pairs'] = [];
  for (const [rid, ru] of rus) {
    const en = links.get(rid)!.map((e) => eng.get(e)).filter((x): x is string => !!x).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0];
    if (!en) continue;
    kept++;
    pairs.push({ rid, ru, en });
    let first = true;
    for (const m of ru.matchAll(TOKEN)) {
      const tok = m[0];
      const isFirst = first;
      first = false;
      if (tok.replace(/-/g, '').length < 3) continue;
      const n = normalise(tok);
      const capital = /^[А-ЯЁ]/.test(tok);
      if (capital && (!isFirst || capitalisedMid.has(n))) continue;
      // A token with ё only matches forms with ё (see `yo`).
      const withYo = (set: Set<string> | undefined) => (set && /ё/i.test(tok) ? new Set([...set].filter((x) => yo.has(`${n}|${x}`))) : set);
      const main = withYo(owners.get(n));
      const o = main?.size ? main : withYo(pOwners.get(n));
      if (!o?.size) continue;
      if (o.size !== 1) {
        skippedAmbiguous++;
        continue;
      }
      const owner = [...o][0]!;
      if (!/^(verbs|adjectives|nouns|participles):/.test(owner)) continue;
      const mask = masks.get(`${n}|${owner}`) ?? 0;
      if (!mask) continue; // matched the infinitive / headword only
      // A short adjective that differs from a participle only by ё (отменен, of отменный "excellent", against отменён
      // "cancelled") can't be told apart when a sentence leaves out the dots, and is nearly always the participle:
      // treat it as ambiguous. (уверен, занят: same spelling and stress for both, so left alone.)
      const yoParticiple = [...(pOwners.get(n) ?? [])].some((p) => yo.has(`${n}|${p}`)) && !yo.has(`${n}|${owner}`);
      if (owner.startsWith('adjectives:') && (mask & ((1 << ADJ_EXTRA_CELL_OFFSET) - 1)) === 0 && yoParticiple) {
        skippedAmbiguous++;
        continue;
      }
      const list = hits.get(owner);
      const h = { rid, ru, en, mask, start: m.index!, end: m.index! + tok.length };
      if (list) list.push(h);
      else hits.set(owner, [h]);
    }
  }
  report.count(S, 'kept after filters (with an English translation)', kept);
  report.count(S, 'token occurrences skipped as ambiguous (form of >1 lemma)', skippedAmbiguous);

  // ---- choose up to PER_LEMMA per lemma: shortest sentences that cover new cells first
  const out: Record<string, SentenceShardInfo[]> = {};
  for (const [type, list] of [['verbs', inp.verbs], ['adjectives', inp.adjectives], ['nouns', inp.nouns], ['participles', inp.participles ?? []]] as const) {
    const bands: Record<string, SentenceRow[]>[] = [];
    let withAny = 0;
    list.forEach((l, index) => {
      const rank = l.rank ?? index;
      const hs = hits.get(`${type}:${l.id}`);
      if (!hs) return;
      withAny++;
      hs.sort((a, b) => a.ru.length - b.ru.length || a.rid - b.rid);
      const chosen: Hit[] = [];
      let covered = 0;
      const used = new Set<number>();
      for (const h of hs) {
        if (chosen.length >= PER_LEMMA) break;
        if ((h.mask & ~covered) && !used.has(h.rid)) {
          chosen.push(h);
          used.add(h.rid);
          covered |= h.mask;
        }
      }
      for (const h of hs) {
        if (chosen.length >= Math.min(PER_LEMMA, 3)) break;
        if (!used.has(h.rid)) {
          chosen.push(h);
          used.add(h.rid);
        }
      }
      const b = bandOf(rank);
      (bands[b] ??= {})[l.id] = chosen.map((h) => [h.rid, h.ru, h.en, h.mask, h.start, h.end]);
    });
    report.count(S, `${type}: lemmas with ≥1 sentence`, withAny);
    out[type] = [];
    for (let b = 0; b < 4; b++) {
      const shard = bands[b] ?? {};
      const file = `sentences.${type}.b${b}.json`;
      const n = Object.values(shard).reduce((a, s) => a + s.length, 0);
      out[type].push({ band: b, file, lemmas: Object.keys(shard).length, sentences: n, bytes: writeJson(file, shard) });
    }
    const top = list.filter((l, i) => (l.rank ?? i) < 1000).filter((l) => hits.has(`${type}:${l.id}`)).length;
    report.note(S, `${type}: ${top} of the top-1000 lemmas have at least one sentence.`);
  }
  return { shards: out, corpus: { pairs, owners, masks, capitalisedMid } };
}
