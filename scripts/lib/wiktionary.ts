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
  /** words from `wanted.ipa`: [headword with stress, IPA], from the first entry giving a standard pronunciation */
  ipa: Record<string, [string, string]>;
  /**
   * Words from `wanted.check` (lower case, ё written е): found in modern use (as a headword or a form whose
   * entry and tags aren't all archaic, obsolete or dated) …
   */
  checkedModern: string[];
  /** … or found only in archaic, obsolete or dated use. A word in neither list isn't in Wiktionary at all. */
  checkedOld: string[];
  /**
   * For each checked word found: [dictionary form (stress marked), first English gloss, the form's tags ("" for a
   * headword), 1 if old]. A modern reading is kept in preference to an old one.
   */
  checkedInfo: Record<string, [string, string, string, 0 | 1]>;
  /**
   * Recordings on Wikimedia Commons, by headword: [dictionary form (stress marked), file name, MP3 address]. A file
   * that Wiktionary gives for words with different stress or spelling (за'мок / замо'к, the letter names) is left out.
   */
  audio: Record<string, [string, string, string][]>;
  /**
   * Idioms and proverbs: several words, a sense Wiktionary tags idiomatic (or a proverb), not vulgar, offensive,
   * derogatory or old: [headword, dictionary form (stress marked), first gloss, tags]. First entry per headword.
   */
  idioms: [string, string, string, string[]][];
  /**
   * Register labels for `wanted.registers` words, keyed "<word>|<n|v|a|o>": the one label (colloquial, literary …)
   * that every sense of every entry for that word and part of speech carries. Words with none aren't listed.
   */
  registers: Record<string, string>;
  /**
   * Verbs with present (or simple future) forms Wiktionary gives as "-", none at all: verb → the person cells (0 я …
   * 5 они) that don't exist. говаривать has none of the six; светать has only он/она (светает).
   */
  noPresent: Record<string, number[]>;
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
  sounds?: { ipa?: string; tags?: string[]; note?: string; audio?: string; mp3_url?: string }[];
}

/** Bump when the extract's shape changes, so an old cache is rebuilt. */
const EXTRACT_VERSION = 9;
const LOOSE_TAGS = new Set(['colloquial', 'regional', 'dialectal', 'rare', 'poetic']);
/** Register labels worth showing a learner, most telling first (a word tagged both is labelled by the first). */
const REGISTERS = ['vulgar', 'offensive', 'derogatory', 'slang', 'colloquial', 'informal', 'literary', 'formal', 'poetic', 'humorous'];
/** Wiktionary's parts of speech, as the word lists' types (n, v, a; o for the rest). */
const REGISTER_POS: Record<string, string> = { noun: 'n', verb: 'v', adj: 'a', adv: 'o', prep: 'o', conj: 'o', particle: 'o', intj: 'o', pron: 'o', det: 'o', num: 'o' };
/** Idioms with these tags are left out. */
const IDIOM_BAD = new Set(['vulgar', 'offensive', 'derogatory', 'obsolete', 'archaic', 'dated', 'slur', 'ethnic', 'pejorative']);
/** Tags that mark a word or form as not modern Russian. */
const OLD_TAGS = new Set(['archaic', 'obsolete', 'dated']);

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
  /** words whose pronunciation (IPA) a Learn page shows */
  ipa: Set<string>;
  /** words to check for modern or only old use (literature texts), lower case with ё written е */
  check: Set<string>;
  /** words to find register labels for (every word in the vocabulary lists) */
  registers?: Set<string>;
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
  const out: WkExtract = { sha256: key, verbs: {}, participles: {}, nouns: {}, adjectives: {}, numerals: {}, pronouns: {}, adverbs: {}, attested: [], ipa: {}, checkedModern: [], checkedOld: [], checkedInfo: {}, audio: {}, idioms: [], registers: {}, noPresent: {} };
  // verb → person cell → every present/future form Wiktionary gives for it (all entries).
  const presentForms = new Map<string, string[][]>();
  const senseTags = new Map<string, Set<string>[]>();
  const idiomSeen = new Set<string>();
  // Commons file → the words (dictionary form) Wiktionary gives it for, and its MP3 address.
  const audioWords = new Map<string, { words: Set<string>; heads: Set<string>; mp3: string }>();
  const attested = new Set<string>();
  const checkModern = new Set<string>();
  const checkOld = new Set<string>();
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
    if (wanted.check.size) {
      // An entry is old when every sense is archaic, obsolete or dated; a form is old when its entry is, or its tags say so.
      const senses = e.senses ?? [];
      const entryOld = senses.length > 0 && senses.every((x) => (x.tags ?? []).some((t) => OLD_TAGS.has(t)));
      const fold = (w: string) => w.normalize('NFC').replace(/[\u0301\u0300]/g, '').toLowerCase().replace(/ё/g, 'е');
      const hw = fold(word);
      const gloss = senses.flatMap((x) => x.glosses ?? [])[0] ?? '';
      const note = (w: string, old: boolean, tags: string) => {
        const cur = out.checkedInfo[w];
        if (!cur || (cur[3] && !old)) out.checkedInfo[w] = [canonical(e), gloss, tags, old ? 1 : 0];
      };
      if (wanted.check.has(hw)) {
        (entryOld ? checkOld : checkModern).add(hw);
        note(hw, entryOld, '');
      }
      for (const f of e.forms ?? []) {
        const tags = f.tags ?? [];
        if (tags.some((t) => t === 'romanization' || t === 'table-tags' || t === 'inflection-template' || t === 'canonical')) continue;
        const ff = fold(f.form);
        if (!wanted.check.has(ff)) continue;
        const old = entryOld || tags.some((t) => OLD_TAGS.has(t));
        (old ? checkOld : checkModern).add(ff);
        note(ff, old, tags.filter((t) => !OLD_TAGS.has(t)).join(' '));
      }
    }
    if (wanted.registers?.has(word)) {
      const p = REGISTER_POS[e.pos];
      if (p) {
        const list = senseTags.get(`${word}|${p}`) ?? [];
        for (const sense of e.senses ?? []) if (sense.glosses?.length && !sense.form_of?.length) list.push(new Set(sense.tags ?? []));
        senseTags.set(`${word}|${p}`, list);
      }
    }
    if (/ /.test(word) && /^[а-яё ,-]+$/.test(word) && !idiomSeen.has(word)) {
      const senses = e.senses ?? [];
      const idiomatic = e.pos === 'proverb' ? senses : senses.filter((x) => (x.tags ?? []).includes('idiomatic'));
      const first = idiomatic[0];
      const tags = first?.tags ?? [];
      const gloss = first?.glosses?.[0];
      if (first && gloss && !tags.some((t) => IDIOM_BAD.has(t))) {
        idiomSeen.add(word);
        out.idioms.push([word, canonical(e), gloss, e.pos === 'proverb' ? [...tags, 'proverb'] : tags]);
      }
    }
    if (e.pos !== 'name' && /^[а-яё-]+$/.test(word)) {
      for (const x of e.sounds ?? []) {
        if (!x.audio || !x.mp3_url) continue;
        const a = audioWords.get(x.audio) ?? { words: new Set<string>(), heads: new Set<string>(), mp3: x.mp3_url };
        a.words.add(canonical(e));
        a.heads.add(word);
        audioWords.set(x.audio, a);
      }
    }
    // The standard pronunciation is the IPA with no regional tag or note; the headword's first entry wins.
    if (wanted.ipa.has(word) && !out.ipa[word] && e.pos !== 'name') {
      const ipa = (e.sounds ?? []).find((x) => x.ipa && !x.tags?.length && !x.note)?.ipa;
      if (ipa) out.ipa[word] = [canonical(e), ipa];
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
      const cellsOf = presentForms.get(word) ?? [[], [], [], [], [], []];
      for (const f of e.forms ?? []) {
        const t = f.tags ?? [];
        if (!(t.includes('present') || t.includes('future')) || t.includes('participle') || / /.test(f.form)) continue;
        const person = t.includes('first-person') ? 0 : t.includes('second-person') ? 1 : t.includes('third-person') ? 2 : -1;
        if (person < 0) continue;
        cellsOf[person + (t.includes('plural') ? 3 : 0)]!.push(f.form.trim());
      }
      presentForms.set(word, cellsOf);
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
  out.checkedModern = [...checkModern].sort();
  out.checkedOld = [...checkOld].filter((w) => !checkModern.has(w)).sort();
  for (const [verb, cells] of [...presentForms].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const absent = cells.flatMap((forms, i) => (forms.length && forms.every((f) => f === '-') ? [i] : []));
    if (absent.length) out.noPresent[verb] = absent;
  }
  for (const [k, list] of [...senseTags].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!list.length) continue;
    const label = REGISTERS.find((t) => list.every((tags) => tags.has(t)));
    if (label) out.registers[k] = label === 'informal' ? 'colloquial' : label;
  }
  for (const [file, a] of [...audioWords].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) {
    if (a.words.size !== 1 || a.heads.size !== 1) continue;
    (out.audio[[...a.heads][0]!] ??= []).push([[...a.words][0]!, file, a.mp3]);
  }
  writeFileSync(EXTRACT, JSON.stringify(out));
  return out;
}
