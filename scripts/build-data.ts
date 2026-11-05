/**
 * Data pipeline: raw sources (data-raw/) → cleaned, validated, sharded JSON (public/data/)
 * plus reports/validation.md. Deterministic: the same inputs give byte-identical output.
 *
 *   npm run data:build
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AdjRow, Manifest, NounRow, VerbRow } from '../src/shared/types.ts';
import { readTsv } from './lib/csv.ts';
import { cleanVerbs } from './lib/clean-verbs.ts';
import { cleanAdjectives } from './lib/clean-adjectives.ts';
import { cleanNouns } from './lib/clean-nouns.ts';
import { applyOverrides, loadOverrides } from './lib/overrides.ts';
import { Report } from './lib/report.ts';
import { checkOrder, loadFreq } from './lib/frequency.ts';
import { buildMotion } from './lib/motion.ts';
import { BANDS, writeBands, writeBandsByRank, writeJson } from './lib/shard.ts';
import { hasWordList, primeGlossCorpus } from './lib/glosses.ts';
import { RAW_DIR } from './lib/sources.ts';
import { buildSentences } from './lib/sentences.ts';
import { buildCloze } from './lib/cloze.ts';
import { KAIKKI_FILE, loadWiktionary } from './lib/wiktionary.ts';
import { POSSESSIVES, buildPronouns } from './lib/phase-d.ts';
import { NUMERALS, buildDiminutives, buildNumerals, buildParticiples, fillDegrees, fillNounGender } from './lib/phase-b.ts';

const raw = (f: string) => {
  const p = join(RAW_DIR, f);
  if (!existsSync(p)) throw new Error(`${p} missing — run npm run data:fetch first`);
  return p;
};

const report = new Report();
const ov = loadOverrides();

function load(file: string, section: string) {
  const rows = readTsv(raw(file));
  const ids = new Map(rows.map((r, i) => [r, i + 1] as const));
  report.count(section, 'rows in source', rows.length);
  const merged = applyOverrides(rows, ov[section.toLowerCase() as 'verbs' | 'adjectives' | 'nouns'], (k, item) => report.anomaly(section, k, item));
  return { rows: merged, ids };
}

const V = load('verbs.csv', 'Verbs');
const A = load('adjectives.csv', 'Adjectives');
const N = load('nouns.csv', 'Nouns');
primeGlossCorpus([...V.rows, ...A.rows, ...N.rows].map((r) => r.translations_en ?? ''));

const verbs = cleanVerbs(V.rows, V.ids, ov.verbs, report);
report.count('Verbs', 'kept', verbs.length);

const adjectives = cleanAdjectives(A.rows, A.ids, ov.adjectives, report);
report.count('Adjectives', 'kept', adjectives.length);

const nouns = cleanNouns(N.rows, N.ids, ov.nouns, report);
report.count('Nouns', 'kept', nouns.length);

const freq = loadFreq(raw('ru_50k.txt'));
checkOrder('Verbs', verbs, freq, report);
checkOrder('Adjectives', adjectives, freq, report);
checkOrder('Nouns', nouns, freq, report);

const motion = buildMotion(verbs, report);

// ---- Wiktionary (Phase B)
const sourcesJson = JSON.parse(readFileSync(join(RAW_DIR, 'sources.json'), 'utf8')) as Record<string, { sha256: string }>;
raw(KAIKKI_FILE);
const wk = await loadWiktionary(
  {
    verbs: new Set(verbs.map((v) => v.bare)),
    nouns: new Set(nouns.map((n) => n.bare)),
    adjectives: new Set(adjectives.map((a) => a.bare)),
    numerals: new Set(NUMERALS.map(([w]) => w)),
    pronouns: new Set(['никто', 'ничто', 'я', 'кто', 'что', ...POSSESSIVES]),
  },
  sourcesJson[KAIKKI_FILE]?.sha256 ?? '',
  console.log,
);
fillNounGender(nouns, wk, report);
fillDegrees(adjectives, wk, report);
const participleRows = buildParticiples(verbs, wk, report);
const numeralRows = buildNumerals(wk, report);
const diminutiveRows = buildDiminutives(nouns, wk, report);
const verbRank = new Map(verbs.map((v, i) => [v.id, i]));
const nounRank = new Map(nouns.map((n, i) => [n.id, i]));

// ---- shards
const sizes: string[] = [];
const verbRows: VerbRow[] = verbs.map((v) => [v.id, v.accented, v.gloss, v.aspect, v.partners, v.cells]);
const adjRows: AdjRow[] = adjectives.map((a) => [a.id, a.accented, a.gloss, a.cells, a.extra]);
const nounRows: NounRow[] = nouns.map((n) => (n.counting ? [n.id, n.accented, n.gloss, n.gender, n.animate, n.sgOnly, n.cells, n.counting] : [n.id, n.accented, n.gloss, n.gender, n.animate, n.sgOnly, n.cells]));
const shards = {
  verbs: writeBands('verbs', verbRows),
  adjectives: writeBands('adjectives', adjRows),
  nouns: writeBands('nouns', nounRows),
  participles: writeBandsByRank('participles', participleRows, (r) => verbRank.get(r[0])!),
  diminutives: writeBandsByRank('diminutives', diminutiveRows, (r) => nounRank.get(r[0])!),
};
const numeralBytes = writeJson('numerals.json', numeralRows);
const pronouns = buildPronouns(wk, adjectives, report);
writeJson('pronouns.json', pronouns);
const motionBytes = writeJson('motion.json', motion);

const others = readTsv(raw('others.csv'));
const properNouns = N.rows.filter((r) => /^[А-ЯЁ]/.test(r.bare!));
const { shards: sentences, corpus } = await buildSentences({ verbs, adjectives, nouns, others, properNouns, deny: ov.sentences?.deny ?? {}, report });

const cloze = buildCloze({ corpus, verbs, nouns, adjectives, wk, pronouns, report });

const sources = JSON.parse(readFileSync(join(RAW_DIR, 'sources.json'), 'utf8')) as Manifest['sources'];
const manifest: Manifest = {
  built: Object.values(sources).map((s) => s.fetched).sort().at(-1) ?? '',
  bands: BANDS.map((b) => (Number.isFinite(b) ? b : 0)),
  shards: Object.fromEntries(Object.entries(shards).map(([k, v]) => [k, v.map(({ bytes: _b, ...s }) => s)])),
  numerals: 'numerals.json',
  pronouns: 'pronouns.json',
  cloze,
  sentences: Object.fromEntries(Object.entries(sentences).map(([k, v]) => [k, v.map(({ bytes: _b, ...s }) => s)])),
  motion: 'motion.json',
  sources: Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, { url: s.url, sha256: s.sha256, fetched: s.fetched }])),
};
writeJson('manifest.json', manifest);

for (const list of Object.values(shards)) for (const s of list) sizes.push(`| ${s.file} | ${s.count} | ${(s.bytes / 1024).toFixed(0)} KB |`);
for (const list of Object.values(sentences)) for (const s of list) sizes.push(`| ${s.file} | ${s.lemmas} lemmas, ${s.sentences} sentences | ${(s.bytes / 1024).toFixed(0)} KB |`);
sizes.push(`| numerals.json | ${numeralRows.length} | ${(numeralBytes / 1024).toFixed(1)} KB |`);
sizes.push(`| motion.json | ${motion.pairs.length} pairs | ${(motionBytes / 1024).toFixed(1)} KB |`);

const md = report.toMarkdown('Data validation report', [
  'Generated by `npm run data:build`. Do not edit by hand; fix data in `overrides/overrides.yaml`.',
  '',
  `Sources: ${Object.entries(sources).map(([k, s]) => `\`${k}\` (sha256 ${s.sha256.slice(0, 12)}…, fetched ${s.fetched.slice(0, 10)})`).join(', ')}.`,
  hasWordList() ? '' : '> Gloss check skipped: no /usr/share/dict/words on this machine.',
  '## Output shards',
  '',
  '| file | rows / lemmas | size (uncompressed) |',
  '|---|---:|---:|',
  ...sizes,
]);
mkdirSync('reports', { recursive: true });
writeFileSync('reports/validation.md', md + '\n');
console.log(`verbs ${verbs.length}, adjectives ${adjectives.length}, nouns ${nouns.length}, motion pairs ${motion.pairs.length}`);
console.log('wrote public/data/ and reports/validation.md');
