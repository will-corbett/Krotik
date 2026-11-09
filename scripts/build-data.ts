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
import { BANDS, OUT_DIR, bandOf, writeBands, writeBandsByRank, writeJson } from './lib/shard.ts';
import { cleanGloss, hasWordList, primeGlossCorpus } from './lib/glosses.ts';
import { RAW_DIR } from './lib/sources.ts';
import { buildLevelTestPool, PER_SLOT } from '../src/lib/levelTestPool.ts';
import { buildSentences } from './lib/sentences.ts';
import { adjFormLabel, buildReading, caseLabel, literatureWords, type Lexicon } from './lib/literature.ts';
import { buildThemes, loadThemes } from './lib/themes.ts';
import { buildListening, findPairs } from './lib/listening.ts';
import { buildVerbNoun } from './lib/verbNoun.ts';
import { buildWordOrder } from './lib/wordOrderQa.ts';
import { buildIdioms } from './lib/idioms.ts';
import { withRegisters } from './lib/registers.ts';
import { buildSearch } from './lib/search.ts';
import { packAudio, wantedAudio, writeWanted } from './lib/audio.ts';
import { readTatoebaAudio } from './lib/tatoeba-audio.ts';
import { CASES } from '../src/shared/cells.ts';
import { cellForms } from '../src/shared/forms.ts';
import { normalise } from '../src/shared/normalise.ts';
import { buildCloze } from './lib/cloze.ts';
import { buildWords } from './lib/vocab.ts';
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
    registers: new Set([...V.rows, ...A.rows, ...N.rows, ...readTsv(raw('others.csv'))].map((r) => r.bare!).filter(Boolean)),
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
// Present (or perfective future) forms Wiktionary says don't exist (говаривать, светать): left blank, not drilled.
for (const v of verbs) {
  for (const i of wk.noPresent[v.bare] ?? []) {
    if (!v.cells[i]) continue;
    v.cells[i] = '';
    report.count('Verbs', 'present/future forms left out: Wiktionary has none (past-only and impersonal verbs)');
  }
}
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
// ---- Vocabulary drill: every word type, banded by rank in its own list (scripts/lib/vocab.ts)
// Words the drill data leaves out because their forms are missing or unclear (кофе, деньги, ветер, свет): no forms to
// drill, but words to learn, by headword and meaning. Names and abbreviations (no stress mark: кгб) aren't; a later
// row repeating a word is the duplicate the cleaning dropped.
const extraWords = (rows: Record<string, string>[], ids: Map<Record<string, string>, number>, kept: { id: number; bare: string }[], pos: 'n' | 'v' | 'a', extra: (r: Record<string, string>) => string) => {
  const keptIds = new Set(kept.map((k) => k.id));
  const seen = new Set(kept.map((k) => k.bare));
  const sorted = kept.map((k) => k.id).sort((x, y) => x - y);
  const before = (id: number) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! < id) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return rows.flatMap((r) => {
    const id = ids.get(r)!;
    const bare = r.bare!;
    if (keptIds.has(id) || seen.has(bare) || !/^[а-яё]+(-[а-яё]+)*$/.test(bare) || !r.translations_en?.trim()) return [];
    if (!/['ё]/.test(r.accented!) && (r.accented!.match(/[аеиоуыэюя]/g) ?? []).length !== 1) return [];
    seen.add(bare);
    return [{ pos, id, bare, accented: r.accented!, gloss: cleanGloss(r.translations_en), extra: extra(r), rank: before(id) }];
  });
};
const extras = [
  ...extraWords(N.rows, N.ids, nouns, 'n', (r) => (r.pl_only === '1' ? 'pl' : (r.gender ?? ''))),
  ...extraWords(V.rows, V.ids, verbs, 'v', (r) => r.aspect ?? ''),
  ...extraWords(A.rows, A.ids, adjectives, 'a', () => ''),
];
const words = buildWords(
  { verbs, nouns, adjectives, extras, others, pronouns: pronouns.personal.map(([w, cells]) => [w, cells] as [string, string[]]), exclude: ov.vocab?.exclude ?? {}, gloss: ov.vocab?.gloss ?? {}, keep: ov.vocab?.keep ?? {}, freq },
  report,
);
// Register labels (colloquial, bookish …) from Wiktionary, read by hand for the commonest words (scripts/lib/registers.ts).
words.rows = withRegisters(words.rows, wk.registers, report);
const wordShards = writeBandsByRank('words', words.rows, words.rank);
const wordBand = new Map(words.rows.map((r) => [r[0], bandOf(words.rank(r))]));
const wordRegister = new Map(words.rows.flatMap((r) => (r[5] ? [[r[0], r[5]] as [string, string]] : [])));
// The 3,000 commonest word forms in the independent frequency list (Reading's key words leave these out).
const commonForms = new Set([...freq].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3000).map(([w]) => w));

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

// ---- Reading: public-domain literature with every word explained (scripts/lib/literature.ts)
const verbById = new Map(verbs.map((v) => [v.id, v]));
const nounById = new Map(nouns.map((n) => [n.id, n]));
const adjById = new Map(adjectives.map((a) => [a.id, a]));
const otherByBare = new Map(others.map((o) => [normalise(o.bare!), [o.accented || o.bare!, o.translations_en ?? ''] as [string, string]]));
const pronounForms = new Map<string, [string, string][]>();
const addPronoun = (cell: string, dict: string, label: string) => {
  for (const f of cellForms(cell)) {
    const k = normalise(f);
    const list = pronounForms.get(k) ?? [];
    if (!list.some(([d, l]) => d === dict && l === label)) list.push([dict, label]);
    pronounForms.set(k, list);
  }
};
for (const [w, plainCells, afterPrep] of pronouns.personal) {
  CASES.forEach((c, i) => {
    addPronoun(plainCells[i]!, w, caseLabel(c));
    if (afterPrep[i] !== plainCells[i]) addPronoun(afterPrep[i]!, w, `${caseLabel(c)}, after a preposition`);
  });
}
for (const [w, cells] of pronouns.possessive) cells.forEach((cell, i) => addPronoun(cell, w, adjFormLabel(i)));
const lexicon: Lexicon = {
    owners: corpus.owners,
    masks: corpus.masks,
    verb: (id) => verbById.get(id),
    noun: (id) => nounById.get(id),
    adjective: (id) => adjById.get(id),
    other: (b) => otherByBare.get(b),
    pronoun: (f) => pronounForms.get(f) ?? [],
    wiktionary: wk.checkedInfo,
    old: new Set(wk.checkedOld),
    wordBand: (k) => wordBand.get(k),
    commonForm: (f) => commonForms.has(f),
    register: (k) => wordRegister.get(k),
};
const reading = buildReading(lexicon, report);
let readingBytes = writeJson('reading.json', reading.index);
for (const u of reading.units) readingBytes += writeJson(`reading.${u.id}.json`, u);

// ---- Words section: themed lessons; dialogues published only once reviewed (scripts/lib/themes.ts)
// Our own Russian may use words the sentence index doesn't have (кафе, деньги; by their dictionary form only): a copy
// that has them.
const themeOwners = new Map([...corpus.owners].map(([k, v]) => [k, new Set(v)]));
const TYPE = { n: 'nouns', v: 'verbs', a: 'adjectives' } as const;
const extraById = new Map(extras.map((x) => [`${TYPE[x.pos]}:${x.id}`, x]));
for (const x of extras) {
  const k = normalise(x.bare);
  themeOwners.set(k, new Set([...(themeOwners.get(k) ?? []), `${TYPE[x.pos]}:${x.id}`]));
}
const themeLex: Lexicon = {
  ...lexicon,
  owners: themeOwners,
  noun: (id) => nounById.get(id) ?? extraById.get(`nouns:${id}`),
  verb: (id) => verbById.get(id) ?? (extraById.has(`verbs:${id}`) ? { ...extraById.get(`verbs:${id}`)!, aspect: extraById.get(`verbs:${id}`)!.extra as 'impf' } : undefined),
  adjective: (id) => adjById.get(id) ?? extraById.get(`adjectives:${id}`),
};
const themes = buildThemes(loadThemes(), { words: words.rows, band: (r) => bandOf(words.rank(r)), corpus: { pairs: corpus.pairs, owners: themeOwners }, lex: themeLex }, report);
let themesBytes = writeJson('themes.json', themes.index);
for (const t of themes.themes) themesBytes += writeJson(`theme.${t.id}.json`, t);
writeFileSync('reports/dialogues-for-review.md', themes.review);

// ---- Native recordings (scripts/lib/audio.ts): what we'd like (for `npm run audio:fetch`) and what's cached so far.
// Words: every word among the 2,500 commonest of each type that has a recording of its own stress (about 7,700), most
// useful first: Vocabulary theme words, minimal-pair words, then the rest by frequency. (Until 2026-11-09, only the
// commonest 1,000 of each type.)
const rowByKey = new Map(words.rows.map((r) => [r[0], r]));
const byRank = [...words.rows].sort((a, b) => words.rank(a) - words.rank(b));
const audioWords = themes.index.themes
  .flatMap((t) => t.keys)
  .flatMap((k) => (rowByKey.has(k) ? [rowByKey.get(k)!] : []))
  .map((r) => ({ key: r[0], accented: r[1], bare: r[1].replace(/'/g, '') }));
const recordable = byRank
  .filter((r) => (wk.audio[r[1].replace(/'/g, '')] ?? []).some(([canon]) => canon === r[1]))
  .map((r) => ({ key: r[0], accented: r[1], bare: r[1].replace(/'/g, '') }));
const pairWords = new Set(findPairs(recordable).flatMap((p) => [p[1], p[3]]));
audioWords.push(...recordable.filter((w) => pairWords.has(w.key)), ...recordable.filter((w) => bandOf(words.rank(rowByKey.get(w.key)!)) <= 2));
const wanted = wantedAudio({ words: audioWords, commons: wk.audio, pairs: corpus.pairs, tatoeba: await readTatoebaAudio(), report });
writeWanted(wanted);
const audioIndex = packAudio(wanted, report);
const audioBytes = writeJson('audio.json', audioIndex);
const listening = buildListening({
  sentences: corpus.pairs.filter((p) => audioIndex.sentences[p.rid] !== undefined),
  owners: corpus.owners,
  masks: corpus.masks,
  noun: (id) => nounById.get(id),
  adjective: (id) => adjById.get(id),
  words: words.rows.filter((r) => audioIndex.words[r[0]]).map((r) => ({ key: r[0], accented: r[1] })),
  report,
});
const listeningBytes = writeJson('listening.json', listening);

// ---- Words that go together: curated verb + noun pairs, checked against the sentences (scripts/lib/verbNoun.ts)
const verbNoun = buildVerbNoun({ corpus, verbs, nouns, report });
const verbNounBytes = writeJson('verb-noun.json', verbNoun);
// ---- Idioms and proverbs: Wiktionary's, kept when a real sentence uses them (scripts/lib/idioms.ts)
const verbForms = new Map(verbs.map((v) => [v.bare, new Set([v.bare, ...v.cells.flatMap((c) => (c ? cellForms(c) : [])).map(normalise)])]));
const idioms = buildIdioms({ idioms: wk.idioms, pairs: corpus.pairs, verbForms, report });
const idiomBytes = writeJson('idioms.json', idioms);
// ---- Word order practice: our own question-and-answer items, published once reviewed (scripts/lib/wordOrderQa.ts)
const wordOrder = buildWordOrder(themeLex, report);
writeJson('word-order.json', wordOrder.data);
writeFileSync('reports/word-order-for-review.md', wordOrder.review);

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
  shards: Object.fromEntries(Object.entries({ ...shards, words: wordShards }).map(([k, v]) => [k, v.map(({ bytes: _b, ...s }) => s)])),
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
  themes: 'themes.json',
  audio: 'audio.json',
  listening: 'listening.json',
  verbNoun: 'verb-noun.json',
  wordOrder: 'word-order.json',
  idioms: 'idioms.json',
  search: 'search.json',
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

// The site search's index, from everything written above (scripts/lib/search.ts).
const search = buildSearch();
const searchBytes = writeJson('search.json', search);
sizes.push(`| search.json | ${search.docs.length} entries | ${(searchBytes / 1024).toFixed(0)} KB |`);

// The level test's questions, made here from the files just written so the browser needn't load the shards.
const levelTest = buildLevelTestPool(<T>(file: string) => JSON.parse(readFileSync(join(OUT_DIR, file), 'utf8')) as T);
for (const s of levelTest.slots) {
  report.count('Level test', `${s.level} question types`);
  report.count('Level test', 'candidate questions', s.items.length);
  if (s.items.length < PER_SLOT) report.anomaly('Level test', `question types with fewer than ${PER_SLOT} candidates`, `${s.level} ${s.topic} (w${s.w}): ${s.items.length}`);
}
const levelTestBytes = writeJson('level-test.json', levelTest);

for (const list of [...Object.values(shards), wordShards]) for (const s of list) sizes.push(`| ${s.file} | ${s.count} | ${(s.bytes / 1024).toFixed(0)} KB |`);
for (const list of Object.values(sentences)) for (const s of list) sizes.push(`| ${s.file} | ${s.lemmas} lemmas, ${s.sentences} sentences | ${(s.bytes / 1024).toFixed(0)} KB |`);
sizes.push(`| numerals.json | ${numeralRows.length} | ${(numeralBytes / 1024).toFixed(1)} KB |`);
sizes.push(`| level-test.json | ${levelTest.slots.reduce((n, s) => n + s.items.length, 0)} questions | ${(levelTestBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| learn.json | ${learnTatoeba.length} sentences, ${learnIpa.length} pronunciations | ${(learnBytes / 1024).toFixed(1)} KB |`);
sizes.push(`| reading.json, reading.*.json | ${reading.units.length} texts, ${reading.units.reduce((n, u) => n + u.questions.length, 0)} questions | ${(readingBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| themes.json, theme.*.json | ${themes.themes.length} themes, ${themes.themes.reduce((n, t) => n + t.dialogues.length, 0)} dialogues published | ${(themesBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| audio.json | ${Object.keys(audioIndex.words).length} words, ${Object.keys(audioIndex.sentences).length} sentences recorded | ${(audioBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| listening.json | ${listening.sentences.length} sentences, ${listening.endings.length} endings, ${listening.pairs.length} pairs | ${(listeningBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| verb-noun.json | ${verbNoun.pairs.length} pairs, ${verbNoun.items.length} items | ${(verbNounBytes / 1024).toFixed(0)} KB |`);
sizes.push(`| idioms.json | ${idioms.idioms.length} idioms and proverbs | ${(idiomBytes / 1024).toFixed(0)} KB |`);
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
