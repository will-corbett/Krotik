import { existsSync, readFileSync } from 'node:fs';

/**
 * English gloss cleaning: keep the first sense (";"-separated), plus the second if the
 * first is very short; at most 4 comma items. Words not found in an English word list
 * are flagged (not removed) so contamination like "speak, talk gapirish" shows up in the
 * report and gets a hand fix in overrides.yaml.
 */
const DICT_PATH = '/usr/share/dict/words';
let dict: Set<string> | null | undefined;

function englishWords(): Set<string> | null {
  if (dict !== undefined) return dict;
  dict = existsSync(DICT_PATH)
    ? new Set(readFileSync(DICT_PATH, 'utf8').split('\n').map((w) => w.trim().toLowerCase()))
    : null;
  return dict;
}
export function hasWordList(): boolean {
  return englishWords() !== null;
}

export function cleanGloss(raw: string): string {
  const senses = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!senses.length) return '';
  let items = senses[0]!.split(',').map((s) => s.trim()).filter(Boolean);
  if (items.join(', ').length < 12 && senses[1]) {
    items = [...items, ...senses[1].split(',').map((s) => s.trim()).filter(Boolean)];
  }
  // Source items sometimes start with a stray capital ("get, Be obtained").
  items = items.map((i) => i.replace(/^(Be|To|Get|Have|Make|Do|Go|Become|Take|Put|Give)\b/, (w) => w.toLowerCase()));
  return [...new Set(items)].slice(0, 4).join(', ');
}

/** Words seen in at least 3 different source glosses count as English (catches what the word list lacks). */
let corpus = new Set<string>();
export function primeGlossCorpus(glosses: string[]) {
  const n = new Map<string, number>();
  for (const g of glosses) for (const w of new Set(tokens(g))) n.set(w, (n.get(w) ?? 0) + 1);
  corpus = new Set([...n].filter(([, c]) => c >= 3).map(([w]) => w));
}
function tokens(g: string): string[] {
  return g
    .split(/[\s,;()/.\-–—!?"]+/)
    .map((raw) => raw.replace(/^[^\p{L}]+|[^\p{L}']+$/gu, '').toLowerCase())
    .filter(Boolean);
}

const KNOWN_OK = new Set(['sb', 'sth', 'smb', 'smth', 'oneself', "one's", 'etc', 'ok', 'tv']);

/** Return words in the gloss that don't look English (non-ASCII letters, or not in the word list). */
export function suspiciousWords(gloss: string): string[] {
  const words = englishWords();
  const out: string[] = [];
  for (const w of new Set(tokens(gloss))) {
    if (KNOWN_OK.has(w) || /^[а-яё']+$/.test(w)) continue; // Cyrillic is fine ("Adjective of мех")
    if (/[^\x00-\x7f]/.test(w)) {
      out.push(w);
      continue;
    }
    if (corpus.has(w) || !words) continue;
    const base = w.replace(/'s$/, '');
    if (variants(base).some((v) => known(words, v))) continue;
    out.push(w);
  }
  return out;
}

/** British → American spellings the word list may lack. */
function variants(w: string): string[] {
  return [...new Set([
    w,
    w.replace(/our/g, 'or'),
    w.replace(/is(e|ed|es|ing|ation)$/, 'iz$1'),
    w.replace(/yse$/, 'yze'),
    w.replace(/tre$/, 'ter'),
    w.replace(/ence$/, 'ense'),
    w.replace(/ogue$/, 'og'),
    w.replace(/ll(ed|ing|er)$/, 'l$1'),
    w.replace(/([^l])l$/, '$1ll'),
    w.replace(/ae/g, 'e'),
  ])];
}

function known(words: Set<string>, base: string): boolean {
    const stems = [base, base.replace(/s$/, ''), base.replace(/es$/, ''), base.replace(/ed$/, ''), base.replace(/d$/, ''),
      base.replace(/ing$/, ''), base.replace(/ing$/, 'e'), base.replace(/ied$/, 'y'), base.replace(/ies$/, 'y'),
      base.replace(/ly$/, ''), base.replace(/er$/, ''), base.replace(/est$/, ''), base.replace(/(.)\1ed$/, '$1'), base.replace(/(.)\1ing$/, '$1'),
      base.replace(/est$/, 'e'), base.replace(/er$/, 'e'), base.replace(/iest$/, 'y'), base.replace(/ier$/, 'y'),
      base.replace(/ness$/, ''), base.replace(/ment$/, ''), base.replace(/ful$/, '')];
    return stems.some((s) => s.length > 0 && words.has(s));
}
