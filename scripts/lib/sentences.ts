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
import { normalise } from '../../src/shared/normalise.ts';
import type { SentenceRow } from '../../src/shared/types.ts';
import { RAW_DIR } from './sources.ts';
import { bandOf, writeJson } from './shard.ts';
import type { Report } from './report.ts';

interface Lemma {
  id: number;
  bare: string;
  cells: string[];
}
interface Input {
  verbs: Lemma[];
  adjectives: Lemma[];
  nouns: Lemma[];
  others: Record<string, string>[];
  properNouns: Record<string, string>[];
  deny: Record<string, string>;
  report: Report;
}
export type SentenceShardInfo = { band: number; file: string; lemmas: number; sentences: number; bytes: number };

const PER_LEMMA = 6;
const S = 'Sentences';

async function* lines(file: string): AsyncGenerator<string> {
  const stream = createReadStream(join(RAW_DIR, file)).pipe(bz2());
  yield* createInterface({ input: stream, crlfDelay: Infinity });
}

const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

export async function buildSentences(inp: Input): Promise<Record<string, SentenceShardInfo[]>> {
  const { report } = inp;

  // ---- form index: normalised form → owners ("type:id") and per-owner cell mask
  const owners = new Map<string, Set<string>>();
  const masks = new Map<string, number>(); // `${form}|${type}:${id}` → mask
  const addOwner = (form: string, owner: string, cell: number) => {
    const n = normalise(form);
    if (!n) return;
    let o = owners.get(n);
    if (!o) owners.set(n, (o = new Set()));
    o.add(owner);
    if (cell >= 0) {
      const k = `${n}|${owner}`;
      masks.set(k, (masks.get(k) ?? 0) | (1 << cell));
    }
  };
  for (const [type, list] of [['verbs', inp.verbs], ['adjectives', inp.adjectives], ['nouns', inp.nouns]] as const) {
    for (const l of list) {
      addOwner(l.bare, `${type}:${l.id}`, -1);
      l.cells.forEach((c, i) => cellForms(c).forEach((f) => addOwner(f, `${type}:${l.id}`, i)));
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
  for (const [rid, ru] of rus) {
    const en = links.get(rid)!.map((e) => eng.get(e)).filter((x): x is string => !!x).sort((a, b) => a.length - b.length)[0];
    if (!en) continue;
    kept++;
    let first = true;
    for (const m of ru.matchAll(TOKEN)) {
      const tok = m[0];
      const isFirst = first;
      first = false;
      if (tok.replace(/-/g, '').length < 3) continue;
      const n = normalise(tok);
      const capital = /^[А-ЯЁ]/.test(tok);
      if (capital && (!isFirst || capitalisedMid.has(n))) continue;
      const o = owners.get(n);
      if (!o) continue;
      if (o.size !== 1) {
        skippedAmbiguous++;
        continue;
      }
      const owner = [...o][0]!;
      if (!/^(verbs|adjectives|nouns):/.test(owner)) continue;
      const mask = masks.get(`${n}|${owner}`) ?? 0;
      if (!mask) continue; // matched the infinitive / headword only
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
  for (const [type, list] of [['verbs', inp.verbs], ['adjectives', inp.adjectives]] as const) {
    const bands: Record<string, SentenceRow[]>[] = [];
    let withAny = 0;
    list.forEach((l, rank) => {
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
    const top = list.slice(0, 1000).filter((l) => hits.has(`${type}:${l.id}`)).length;
    report.note(S, `${type}: ${top} of the top ${Math.min(1000, list.length)} have at least one sentence.`);
  }
  return out;
}
