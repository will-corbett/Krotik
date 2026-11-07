/**
 * Data pipeline: raw sources (data-raw/) → cleaned, validated, sharded JSON (public/data/)
 * plus reports/validation.md. Deterministic: the same inputs give byte-identical output.
 *
 *   npm run data:build
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AdjRow, LearnExtras, Manifest, NounRow, VerbRow } from '../src/shared/types.ts';
import { readTsv } from './lib/csv.ts';
import { parse as parseYaml } from 'yaml';
import { cleanVerbs } from './lib/clean-verbs.ts';
import { cleanAdjectives } from './lib/clean-adjectives.ts';
import { cleanNouns } from './lib/clean-nouns.ts';
import { applyOverrides, loadOverrides } from './lib/overrides.ts';
import { Report } from './lib/report.ts';
import { checkOrder, loadFreq } from './lib/frequency.ts';
import { buildMotion } from './lib/motion.ts';
import { BANDS, OUT_DIR, writeBands, writeBandsByRank, writeJson } from './lib/shard.ts';
import { hasWordList, primeGlossCorpus } from './lib/glosses.ts';
import { RAW_DIR } from './lib/sources.ts';
import { buildLevelTestPool, PER_SLOT } from '../src/lib/levelTestPool.ts';
import { buildSentences } from './lib/sentences.ts';
import { buildReading, literatureWords } from './lib/literature.ts';
import { buildCloze } from './lib/cloze.ts';
import { buildCollocations } from './lib/collocations.ts';
import { KAIKKI_FILE, loadWiktionary } from './lib/wiktionary.ts';
import { POSSESSIVES, buildPronouns } from './lib/phase-d.ts';
import { COLLECTIVES, buildCollectives, buildGovernment, buildOrdinals, buildPrefixedMotion, curated } from './lib/phase-e.ts';
import { adverbCandidates, buildAdverbs, buildDates, buildSpecialCases } from './lib/phase-f.ts';
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

// ---- Learn page vocabulary that isn't drill data: must be attested in Wiktionary (checked below)
const learnWords = existsSync('content/learn/words.yaml') ? ((parseYaml(readFileSync('content/learn/words.yaml', 'utf8')) ?? []) as string[]) : [];
// What Learn pages quote: `::tatoeba <id>…` (real sentences, by Tatoeba id) and `::ipa <word>…` (Wiktionary IPA).
const learnBlocks = (kind: string) =>
  readdirSync('content/learn')
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) => readFileSync(join('content/learn', f), 'utf8').split('\n'))
    .map((l) => new RegExp(`^::${kind}\\s+(.*)$`).exec(l.trim())?.[1])
    .flatMap((rest) => (rest ? rest.split(/\s+/) : []));
const learnIpa = [...new Set(learnBlocks('ipa'))].sort();
const learnTatoeba = [...new Set(learnBlocks('tatoeba').map((x) => x.split(':')[0]!))].sort((a, b) => Number(a) - Number(b));

// ---- Wiktionary (Phase B)
const sourcesJson = JSON.parse(readFileSync(join(RAW_DIR, 'sources.json'), 'utf8')) as Record<string, { sha256: string }>;
raw(KAIKKI_FILE);
const wk = await loadWiktionary(
  {
    verbs: new Set(verbs.map((v) => v.bare)),
    nouns: new Set(nouns.map((n) => n.bare)),
    adjectives: new Set(adjectives.map((a) => a.bare)),
    numerals: new Set([...NUMERALS, ...COLLECTIVES].map(([w]) => w)),
    pronouns: new Set(['никто', 'ничто', 'я', 'кто', 'что', ...POSSESSIVES]),
    adverbs: adverbCandidates(adjectives),
    attest: new Set(learnWords),
    ipa: new Set(learnIpa),
    check: literatureWords(),
  },
  sourcesJson[KAIKKI_FILE]?.sha256 ?? '',
  console.log,
);
const unattested = learnWords.filter((w) => !wk.attested.includes(w));
if (unattested.length) throw new Error(`content/learn/words.yaml: not found in Wiktionary: ${unattested.join(', ')}`);
report.count('Learn pages', 'extra words in content/learn/words.yaml, all found in Wiktionary', learnWords.length);
const noIpa = learnIpa.filter((w) => !wk.ipa[w]);
if (noIpa.length) throw new Error(`content/learn: ::ipa words with no standard IPA in Wiktionary: ${noIpa.join(', ')}`);
report.count('Learn pages', '::ipa words, each with its IPA from Wiktionary', learnIpa.length);
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
const adjectiveBares = new Set(adjectives.map((a) => a.bare));
// Participle and verbal-adverb forms, per verb, for example sentences (order fixed: adverbs, then each participle).
const participleLemmas = participleRows.map((r) => ({
  id: r[0],
  bare: '',
  rank: verbRank.get(r[0])!,
  cells: [
    r[4],
    r[5],
    // A participle that is also an adjective in the data (любимый, известный) is the same word: index it once, as the adjective.
    ...r[6].filter(([, nom]) => !adjectiveBares.has(nom.split(',')[0]!.replace(/[()']/g, ''))).flatMap(([, nom, cells, short]) => [nom, ...cells, ...short]),
  ].filter(Boolean),
}));
const { shards: sentences, corpus } = await buildSentences({ verbs, adjectives, nouns, participles: participleLemmas, others, properNouns, deny: ov.sentences?.deny ?? {}, report });

// ---- Read and fill in: public-domain literature, passages with any archaic or unknown word left out
const adjRank = new Map(adjectives.map((a, i) => [a.id, i]));
const byOwner = (owner: string) => {
  const [type, idS] = owner.split(':');
  const id = Number(idS);
  const [list, rank] = type === 'verbs' ? [verbs, verbRank] : type === 'nouns' ? [nouns, nounRank] : type === 'adjectives' ? [adjectives, adjRank] : [null, null];
  const l = list?.find((x) => x.id === id);
  return l && rank ? { accented: l.accented, gloss: l.gloss, rank: rank.get(id)! } : undefined;
};
const reading = buildReading({ owners: corpus.owners, lemma: byOwner, modern: new Set(wk.checkedModern), old: new Set(wk.checkedOld), report });
const readingBytes = writeJson('reading.json', reading);

const government = buildGovernment(verbs, report);
writeJson('government.json', government);
const prefixedMotion = buildPrefixedMotion(verbs, report);
writeJson('prefixed-motion.json', prefixedMotion);
writeJson('ordinals.json', buildOrdinals(adjectives, report));
writeJson('collectives.json', buildCollectives(wk, report));
const adverbRows = buildAdverbs(adjectives, wk, ov.adverbs?.exclude ?? {}, report);
writeJson('adverbs.json', adverbRows);
const specialRows = buildSpecialCases(nouns, wk, report);
writeJson('special-cases.json', specialRows);
writeJson('dates.json', buildDates(nouns, numeralRows, curated.time().months, report));
writeJson('collocations.json', buildCollocations(corpus, adjectives, nouns, participleRows, curated.time().months, report));
const cloze = buildCloze({ corpus, verbs, nouns, adjectives, wk, pronouns, government, positions: curated.position(), time: curated.time(), adverbs: adverbRows, specialCases: specialRows, report });

const sources = JSON.parse(readFileSync(join(RAW_DIR, 'sources.json'), 'utf8')) as Manifest['sources'];
const manifest: Manifest = {
  built: Object.values(sources).map((s) => s.fetched).sort().at(-1) ?? '',
  bands: BANDS.map((b) => (Number.isFinite(b) ? b : 0)),
  shards: Object.fromEntries(Object.entries(shards).map(([k, v]) => [k, v.map(({ bytes: _b, ...s }) => s)])),
  numerals: 'numerals.json',
  pronouns: 'pronouns.json',
  government: 'government.json',
  prefixedMotion: 'prefixed-motion.json',
  ordinals: 'ordinals.json',
  collectives: 'collectives.json',
  adverbs: 'adverbs.json',
  specialCases: 'special-cases.json',
  dates: 'dates.json',
  collocations: 'collocations.json',
  levelTest: 'level-test.json',
  learn: 'learn.json',
  reading: 'reading.json',
  cloze,
  sentences: Object.fromEntries(Object.entries(sentences).map(([k, v]) => [k, v.map(({ bytes: _b, ...s }) => s)])),
  motion: 'motion.json',
  sources: Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, { url: s.url, sha256: s.sha256, fetched: s.fetched }])),
};
writeJson('manifest.json', manifest);

// ---- what Learn pages quote: each sentence must be in the filtered corpus (with an English translation)
const byId = new Map(corpus.pairs.map((p) => [p.rid, p]));
const missingSentences = learnTatoeba.filter((id) => !byId.has(Number(id)));
if (missingSentences.length) throw new Error(`content/learn: ::tatoeba ids not in the corpus (or denied): ${missingSentences.join(', ')}`);
const learnExtras: LearnExtras = {
  sentences: Object.fromEntries(learnTatoeba.map((id) => [id, [byId.get(Number(id))!.ru, byId.get(Number(id))!.en]])),
  ipa: Object.fromEntries(learnIpa.map((w) => [w, wk.ipa[w]!])),
};
report.count('Learn pages', '::tatoeba sentences, each found in the corpus', learnTatoeba.length);
const learnBytes = writeJson('learn.json', learnExtras);

// The level test's questions, made here from the files just written so the browser needn't load the shards.
const levelTest = buildLevelTestPool(<T>(file: string) => JSON.parse(readFileSync(join(OUT_DIR, file), 'utf8')) as T);
for (const s of levelTest.slots) {
  report.count('Level test', `${s.level} question types`);
  report.count('Level test', 'candidate questions', s.items.length);
  if (s.items.length < PER_SLOT) report.anomaly('Level test', `question types with fewer than ${PER_SLOT} candidates`, `${s.level} ${s.topic} (w${s.w}): ${s.items.length}`);
}
const levelTestBytes = writeJson('level-test.json', levelTest);

for (const list of Object.values(shards)) for (const s of list) sizes.push(`| ${s.file} | ${s.count} | ${(s.bytes / 1024).toFixed(0)} KB |`);
for (const list of Object.values(sentences)) for (const s of list) sizes.push(`| ${s.file} | ${s.lemmas} lemmas, ${s.sentences} sentences | ${(s.bytes / 1024).toFixed(0)} KB |`);
sizes.push(`| numerals.json | ${numeralRows.length} | ${(numeralBytes / 1024).toFixed(1)} KB |`);
sizes.push(`| level-test.json | ${levelTest.slots.reduce((n, s) => n + s.items.length, 0)} questions | ${(levelTestBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| learn.json | ${learnTatoeba.length} sentences, ${learnIpa.length} pronunciations | ${(learnBytes / 1024).toFixed(1)} KB |`);
sizes.push(`| reading.json | ${reading.passages.length} passages, ${reading.passages.reduce((n, p) => n + p.gaps.length, 0)} gaps | ${(readingBytes / 1024).toFixed(0)} KB |`);
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
