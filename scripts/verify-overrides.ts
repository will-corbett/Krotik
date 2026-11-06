/**
 * Checks every form in overrides.yaml `fix` entries against Wiktionary (kaikki.org per-word
 * JSONL extracts, cached in data-raw/kaikki-words/). Exits 1 if any form is not attested.
 *
 *   npm run data:verify-overrides
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalise } from '../src/shared/normalise.ts';
import { vowelCount } from '../src/shared/forms.ts';
import { loadOverrides } from './lib/overrides.ts';
import { RAW_DIR } from './lib/sources.ts';

const CACHE = join(RAW_DIR, 'kaikki-words');
mkdirSync(CACHE, { recursive: true });

async function wiktionaryForms(word: string): Promise<{ accented: Set<string>; plain: Set<string> }> {
  const file = join(CACHE, `${word}.jsonl`);
  if (!existsSync(file)) {
    const url = `https://kaikki.org/dictionary/Russian/meaning/${encodeURIComponent(word[0]!)}/${encodeURIComponent(word.slice(0, 2))}/${encodeURIComponent(word)}.jsonl`;
    const res = await fetch(url, { headers: { 'User-Agent': 'krotik-data-pipeline' } });
    if (!res.ok) throw new Error(`${word}: HTTP ${res.status} from ${url}`);
    writeFileSync(file, await res.text());
  }
  const accented = new Set<string>();
  const plain = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as { word: string; forms?: { form: string }[] };
    for (const f of [{ form: entry.word }, ...(entry.forms ?? [])]) {
      const a = f.form.normalize('NFC').replace(/́/g, "'").replace(/̀/g, '');
      accented.add(a.toLowerCase());
      plain.add(normalise(a));
    }
  }
  return { accented, plain };
}

const ov = loadOverrides();
let failures = 0;
for (const type of ['verbs', 'adjectives', 'nouns'] as const) {
  for (const [bare, cols] of Object.entries(ov[type]?.fix ?? {})) {
    const wk = await wiktionaryForms(bare);
    for (const [col, val] of Object.entries(cols)) {
      if (val === '-') continue;
      for (const v of val.split(',').map((x) => x.trim().replace(/^\((.*)\)$/, '$1'))) {
        // Stress must match exactly, except on one-vowel forms, where Wiktionary may omit the mark.
        const ok = wk.accented.has(v) || (vowelCount(v) <= 1 && wk.plain.has(normalise(v)));
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${type}/${bare}.${col}: ${v}`);
        if (!ok) failures++;
      }
    }
  }
}
for (const [bare, val] of Object.entries(ov.nouns?.counting ?? {})) {
  const wk = await wiktionaryForms(bare);
  for (const v of val.split(',').map((x) => x.trim())) {
    const ok = wk.accented.has(v) || (vowelCount(v) <= 1 && wk.plain.has(normalise(v)));
    console.log(`${ok ? 'ok  ' : 'FAIL'} nouns/${bare}.counting: ${v}`);
    if (!ok) failures++;
  }
}
if (failures) {
  console.error(`${failures} override form(s) not attested in Wiktionary`);
  process.exit(1);
}
console.log('all override forms attested in Wiktionary');
