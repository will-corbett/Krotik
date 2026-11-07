/** Loads the generated shards from public/data, cumulatively by frequency band, with caching. */
import { cellForms } from '../shared/forms.ts';
import { normalise } from '../shared/normalise.ts';
import type { SentenceType } from '../shared/types.ts';
import type { AdjRow, ClozeRow, LearnExtras, LevelTestData, ReadingData, PronounData, DiminutiveRow, LexType, Manifest, MotionData, NounRow, NumeralRow, ParticipleRow, SentenceRow, SentenceShard, ShardType, VerbRow } from '../shared/types.ts';
import type { Adjective, Noun, Verb } from './types.ts';

// (import.meta.env is Vite's; build scripts importing this file run without it)
const BASE = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}data/`;
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined;
  if (!p) {
    // A failed request is forgotten (below), so trying again really fetches again.
    p = fetch(BASE + file)
      .catch(() => {
        throw new Error(`Couldn't load the data (${file}). Check your connection and try again.`);
      })
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn't load the data (${file}, HTTP ${r.status}). Try again in a moment.`);
        return r.json() as Promise<T>;
      });
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

export const loadManifest = () => getJson<Manifest>('manifest.json');

async function loadRows<R>(type: ShardType, maxBand: number): Promise<{ row: R; band: number }[]> {
  const m = await loadManifest();
  const shards = (m.shards[type] ?? []).filter((s) => s.band <= maxBand);
  const parts = await Promise.all(shards.map((s) => getJson<R[]>(s.file).then((rows) => rows.map((row) => ({ row, band: s.band })))));
  return parts.flat();
}

export const toVerb = ([id, accented, gloss, aspect, partners, cells]: VerbRow, band: number): Verb => ({ id, accented, gloss, aspect, partners, cells, band });

export const toAdjective = ([id, accented, gloss, cells, extra]: AdjRow, band: number): Adjective => ({ id, accented, gloss, cells, extra, band });
export const toNoun = ([id, accented, gloss, gender, animate, sgOnly, cells, counting]: NounRow, band: number): Noun => ({
  id, accented, gloss, gender, animate: animate === 1, sgOnly: sgOnly === 1, cells, band, ...(counting ? { counting } : {}),
});

export async function loadVerbs(maxBand: number): Promise<Verb[]> {
  return (await loadRows<VerbRow>('verbs', maxBand)).map(({ row, band }) => toVerb(row, band));
}
export async function loadAdjectives(maxBand: number): Promise<Adjective[]> {
  return (await loadRows<AdjRow>('adjectives', maxBand)).map(({ row, band }) => toAdjective(row, band));
}
export async function loadNouns(maxBand: number): Promise<Noun[]> {
  return (await loadRows<NounRow>('nouns', maxBand)).map(({ row, band }) => toNoun(row, band));
}
export async function loadParticiples(maxBand: number): Promise<{ row: ParticipleRow; band: number }[]> {
  return loadRows<ParticipleRow>('participles', maxBand);
}
export async function loadDiminutives(maxBand: number): Promise<{ row: DiminutiveRow; band: number }[]> {
  return loadRows<DiminutiveRow>('diminutives', maxBand);
}
export async function loadNumerals(): Promise<NumeralRow[]> {
  return getJson<NumeralRow[]>((await loadManifest()).numerals);
}
export async function loadPronouns(): Promise<PronounData> {
  return getJson<PronounData>((await loadManifest()).pronouns);
}
export async function loadExtraJson<T>(key: 'government' | 'prefixedMotion' | 'ordinals' | 'collectives' | 'adverbs' | 'specialCases' | 'dates' | 'collocations'): Promise<T> {
  return getJson<T>((await loadManifest())[key]);
}
export async function loadCloze(topic: string): Promise<ClozeRow[]> {
  const m = await loadManifest();
  const c = m.cloze[topic];
  return c ? getJson<ClozeRow[]>(c.file) : [];
}
/** The level test's ready-made question pool. */
let learnExtras: Promise<LearnExtras> | null = null;
/** Sentences and pronunciations quoted by Learn pages (one small file, fetched once). */
export function loadLearnExtras(): Promise<LearnExtras> {
  learnExtras ??= loadManifest().then((m) => getJson<LearnExtras>(m.learn));
  learnExtras.catch(() => (learnExtras = null));
  return learnExtras;
}
export async function loadReading(): Promise<ReadingData> {
  return getJson<ReadingData>((await loadManifest()).reading);
}
export async function loadLevelTest(): Promise<LevelTestData> {
  return getJson<LevelTestData>((await loadManifest()).levelTest);
}
export async function loadMotion(): Promise<MotionData> {
  return getJson<MotionData>((await loadManifest()).motion);
}

/** Lazily fetch one sentence shard (never blocks the first question). */
export async function loadSentences(type: SentenceType, band: number): Promise<SentenceShard> {
  const m = await loadManifest();
  const s = m.sentences[type]?.find((x) => x.band === band);
  return s ? getJson<SentenceShard>(s.file) : {};
}

/**
 * A sentence whose highlighted word is exactly one of the answer's forms (never another form of the
 * same word). Among those, prefer one tagged with the target cell. None found → no example shown.
 */
export function chooseSentence(rows: SentenceRow[] | undefined, cell: number, answer: string): SentenceRow | undefined {
  if (!rows?.length) return undefined;
  const forms = new Set(cellForms(answer).map(normalise));
  const exact = rows.filter((r) => forms.has(normalise(r[1].slice(r[4], r[5]))));
  if (cell >= 0) {
    const tagged = exact.find((r) => (r[3] & (1 << cell)) !== 0);
    if (tagged) return tagged;
  }
  return exact[0];
}
