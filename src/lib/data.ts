/** Loads the generated shards from public/data, cumulatively by frequency band, with caching. */
import type { AdjRow, ClozeRow, PronounData, DiminutiveRow, LexType, Manifest, MotionData, NounRow, NumeralRow, ParticipleRow, SentenceRow, SentenceShard, ShardType, VerbRow } from '../shared/types.ts';
import type { Adjective, Noun, Verb } from './types.ts';

const BASE = `${import.meta.env?.BASE_URL ?? "/"}data/`;
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined;
  if (!p) {
    p = fetch(BASE + file).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${file} (HTTP ${r.status})`);
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
export async function loadExtraJson<T>(key: 'government' | 'prefixedMotion' | 'ordinals' | 'collectives'): Promise<T> {
  return getJson<T>((await loadManifest())[key]);
}
export async function loadCloze(topic: string): Promise<ClozeRow[]> {
  const m = await loadManifest();
  const c = m.cloze[topic];
  return c ? getJson<ClozeRow[]>(c.file) : [];
}
export async function loadMotion(): Promise<MotionData> {
  return getJson<MotionData>((await loadManifest()).motion);
}

/** Lazily fetch one sentence shard (never blocks the first question). */
export async function loadSentences(type: LexType, band: number): Promise<SentenceShard> {
  const m = await loadManifest();
  const s = m.sentences[type]?.find((x) => x.band === band);
  return s ? getJson<SentenceShard>(s.file) : {};
}

/** Prefer a sentence containing the exact target cell; else any form of the lemma. */
export function chooseSentence(rows: SentenceRow[] | undefined, cell: number): SentenceRow | undefined {
  if (!rows?.length) return undefined;
  if (cell >= 0) {
    const exact = rows.find((r) => (r[3] & (1 << cell)) !== 0);
    if (exact) return exact;
  }
  return rows[0];
}
