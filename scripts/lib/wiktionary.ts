/**
 * Wiktionary (via kaikki.org's gzipped JSONL extract, CC BY-SA) — streamed once, and only the entries we need are
 * cached in data-raw/kaikki-extract.json (keyed to the dump's sha256 so a new dump re-extracts).
 *
 * Forms keep Wiktionary's stress, converted to our apostrophe notation (U+0301 → ').
 * Forms tagged "dated" (pre-1918 spelling) are skipped.
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { join } from 'node:path';
import { RAW_DIR } from './sources.ts';

export const KAIKKI_FILE = 'kaikki-russian.jsonl.gz';
const EXTRACT = join(RAW_DIR, 'kaikki-extract.json');

export type Form = [form: string, tags: string[]];

export interface WkVerb {
  canonical: string;
  /** adverbial participles (деепричастия) and participles (причастия), nominative masculine */
  adv_pres: string[];
  adv_past: string[];
  act_pres: string[];
  act_past: string[];
  pass_pres: string[];
  pass_past: string[];
}
export interface WkParticiple {
  canonical: string;
  of: string; // verb lemma (bare)
  forms: Form[];
}
export interface WkNoun {
  canonical: string;
  gender: string; // "m" | "f" | "n" | "m-p" … as in the head line; "" if absent
  animacy: string; // "anim" | "inan" | ""
  diminutives: string[];
  /** second prepositional (locative) forms, sometimes with their preposition ("в чаю'"); colloquial/regional left out */
  loc: string[];
  /** partitive (second genitive) forms (ча'ю) */
  part: string[];
}
/** An adverb whose Wiktionary etymology names the adjective it comes from (бы'стрый + -о → бы'стро). */
export interface WkAdverb {
  canonical: string;
  /** adjective lemma (bare) named by the etymology; "" when the etymology names none */
  of: string;
  comparative: string[];
  gloss: string;
}
export interface WkAdjective {
  canonical: string;
  comparative: string[];
  superlative: string[];
}
export interface WkNumeral {
  canonical: string;
  forms: Form[];
}
export interface WkExtract {
  sha256: string;
  verbs: Record<string, WkVerb[]>;
  participles: Record<string, WkParticiple[]>;
  nouns: Record<string, WkNoun[]>;
  adjectives: Record<string, WkAdjective[]>;
  numerals: Record<string, WkNumeral[]>;
  /** pronoun case tables (никто, ничто) — same shape as numerals */
  pronouns: Record<string, WkNumeral[]>;
  /** adverbs (keyed by the adverb) that come from an adjective by their etymology, or that were asked for */
  adverbs: Record<string, WkAdverb[]>;
  /** words from `wanted.attest` found in Wiktionary as a headword or as a form of one */
  attested: string[];
}

/** "прочи́танный" → "прочи'танный"; drops grave (secondary) stress. */
export function wkToApostrophe(s: string): string {
  return s.normalize('NFC').replace(/́/g, "'").replace(/̀/g, '');
}

const SKIP_TAGS = new Set(['dated', 'romanization', 'table-tags', 'inflection-template', 'class', 'alternative', 'obsolete', 'archaic']);

interface RawEntry {
  word: string;
  pos: string;
  forms?: { form: string; tags?: string[] }[];
  senses?: { glosses?: string[]; form_of?: { word: string }[]; tags?: string[] }[];
  head_templates?: { expansion?: string }[];
  etymology_text?: string;
}

/** Bump when the extract's shape changes, so an old cache is rebuilt. */
const EXTRACT_VERSION = 2;
const LOOSE_TAGS = new Set(['colloquial', 'regional', 'dialectal', 'rare', 'poetic']);

/**
 * The adjective an adverb comes from, by its etymology: "бы́стрый (býstryj) + -о" or "Adverbial form of ру́сский".
 * Returns the bare adjective, or null.
 */
export function adverbSource(ety: string | undefined): string | null {
  const t = ety?.trim() ?? '';
  const m = /^Adverbial form of ([а-яё\u0301\u0300-]+)/i.exec(t) ?? /^([а-яё\u0301\u0300-]+)(?: \([^)]*\))*\s*\+ -[а-яё\u0301]+(?: \([^)]*\))*\.?$/i.exec(t);
  return m ? m[1]!.normalize('NFC').replace(/[\u0301\u0300]/g, '').toLowerCase() : null;
}

function canonical(e: RawEntry): string {
  const c = e.forms?.find((f) => f.tags?.includes('canonical'));
  return wkToApostrophe(c?.form ?? e.word);
}

function usableForms(e: RawEntry): Form[] {
  return (e.forms ?? [])
    .filter((f) => f.form && f.form !== '-' && !(f.tags ?? []).some((t) => SKIP_TAGS.has(t)) && !(f.tags ?? []).includes('canonical'))
    // Footnote markers in tables ("него́ ²") are dropped; romanisations (Latin) are skipped.
    .map((f): Form => [wkToApostrophe(f.form).replace(/\s*[¹²³⁴⁵]+$/, '').trim(), f.tags ?? []])
    .filter(([f]) => /[а-яё]/i.test(f) && !/[a-z]/i.test(f));
}

const has = (tags: string[], ...want: string[]) => want.every((w) => tags.includes(w));

export interface Wanted {
  verbs: Set<string>;
  nouns: Set<string>;
  adjectives: Set<string>;
  numerals: Set<string>;
  pronouns: Set<string>;
  /** adverbs to look up even without an etymology link (adjectives' short neuter forms: бы'стро) */
  adverbs: Set<string>;
  /** words that only need to be shown to exist (Learn page vocabulary) */
  attest: Set<string>;
}

export async function loadWiktionary(wanted: Wanted, sha256: string, log: (s: string) => void): Promise<WkExtract> {
  // The cache key covers both the dump and what we ask for, so adding words re-extracts.
  const key = createHash('sha256')
    .update(sha256)
    .update(String(EXTRACT_VERSION))
    .update(JSON.stringify(Object.entries(wanted).map(([k, v]) => [k, [...(v as Set<string>)].sort()])))
    .digest('hex');
  if (existsSync(EXTRACT)) {
    const cached = JSON.parse(readFileSync(EXTRACT, 'utf8')) as WkExtract;
    if (cached.sha256 === key) return cached;
  }
  log('extracting from the Wiktionary dump (one pass, ~1–2 min)…');
  const out: WkExtract = { sha256: key, verbs: {}, participles: {}, nouns: {}, adjectives: {}, numerals: {}, pronouns: {}, adverbs: {}, attested: [] };
  const attested = new Set<string>();
  const push = <T>(m: Record<string, T[]>, k: string, v: T) => (m[k] ??= []).push(v);
  const rl = createInterface({ input: createReadStream(join(RAW_DIR, KAIKKI_FILE)).pipe(createGunzip()), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    n++;
    // Only cheap check possible: nested objects also have "word" keys, so parse every line.
    if (!line.includes('"pos"')) continue;
    const e = JSON.parse(line) as RawEntry;
    const word = e.word;
    if (wanted.attest.size) {
      if (wanted.attest.has(word)) attested.add(word);
      for (const f of e.forms ?? []) {
        const plain = f.form.normalize('NFC').replace(/[\u0301\u0300]/g, '');
        if (wanted.attest.has(plain)) attested.add(plain);
      }
    }
    if (e.pos === 'adv') {
      const src = adverbSource(e.etymology_text);
      const of = src && src !== word && wanted.adjectives.has(src) ? src : '';
      if ((of || wanted.adverbs.has(word)) && /[оеи]$/.test(word)) {
        const fs = usableForms(e);
        const gloss = (e.senses ?? []).flatMap((x) => x.glosses ?? [])[0] ?? '';
        push(out.adverbs, word, { canonical: canonical(e), of, comparative: [...new Set(fs.filter(([, t]) => t.includes('comparative')).map(([f]) => f))], gloss });
      }
      continue;
    }
    const isParticiple = e.pos === 'verb' && (e.senses ?? []).some((s) => (s.glosses ?? []).some((g) => / participle of /.test(g)));
    if (!isParticiple && !wanted.verbs.has(word) && !wanted.nouns.has(word) && !wanted.adjectives.has(word) && !wanted.numerals.has(word) && !wanted.pronouns.has(word)) continue;
    if (e.pos === 'verb' && isParticiple) {
      const of = e.senses?.flatMap((s) => s.form_of ?? []).map((f) => f.word.normalize('NFC').replace(/[́̀]/g, ''))[0];
      if (of && wanted.verbs.has(of) && (e.forms ?? []).some((f) => f.tags?.includes('nominative'))) {
        push(out.participles, e.word, { canonical: canonical(e), of, forms: usableForms(e) });
      }
      continue;
    }
    if (e.pos === 'verb' && wanted.verbs.has(word)) {
      const v: WkVerb = { canonical: canonical(e), adv_pres: [], adv_past: [], act_pres: [], act_past: [], pass_pres: [], pass_past: [] };
      for (const [f, t] of usableForms(e)) {
        if (!t.includes('participle')) continue;
        const k = t.includes('adverbial')
          ? t.includes('present') ? 'adv_pres' : t.includes('past') ? 'adv_past' : null
          : has(t, 'active') ? (t.includes('present') ? 'act_pres' : t.includes('past') ? 'act_past' : null)
          : has(t, 'passive') ? (t.includes('present') ? 'pass_pres' : t.includes('past') ? 'pass_past' : null)
          : null;
        if (k && !v[k].includes(f)) v[k].push(f);
      }
      push(out.verbs, word, v);
    } else if (e.pos === 'noun' && wanted.nouns.has(word)) {
      const head = e.head_templates?.[0]?.expansion ?? '';
      const g = /\) ((?:m|f|n)(?:-p)?(?: or (?:m|f|n))?)\b(?: (anim|inan))?/.exec(head);
      const fs = usableForms(e);
      const dims = fs.filter(([, t]) => t.includes('diminutive')).map(([f]) => f);
      const strict = (t: string[], tag: string) => t.includes(tag) && t.includes('singular') && !t.some((x) => LOOSE_TAGS.has(x));
      const loc = [...new Set(fs.filter(([, t]) => strict(t, 'locative')).map(([f]) => f))];
      const part = [...new Set(fs.filter(([, t]) => strict(t, 'partitive')).map(([f]) => f))];
      push(out.nouns, word, { canonical: canonical(e), gender: g?.[1] ?? '', animacy: g?.[2] ?? '', diminutives: [...new Set(dims)], loc, part });
    } else if (e.pos === 'adj' && wanted.adjectives.has(word)) {
      const fs = usableForms(e);
      push(out.adjectives, word, {
        canonical: canonical(e),
        comparative: [...new Set(fs.filter(([, t]) => t.includes('comparative')).map(([f]) => f))],
        superlative: [...new Set(fs.filter(([, t]) => t.includes('superlative')).map(([f]) => f))],
      });
    } else if ((e.pos === 'pron' || e.pos === 'det') && wanted.pronouns.has(word)) {
      push(out.pronouns, word, { canonical: canonical(e), forms: usableForms(e) });
    } else if (e.pos === 'num' && wanted.numerals.has(word)) {
      push(out.numerals, word, { canonical: canonical(e), forms: usableForms(e) });
    }
  }
  log(`  ${n} lines read`);
  out.attested = [...attested].sort();
  writeFileSync(EXTRACT, JSON.stringify(out));
  return out;
}
