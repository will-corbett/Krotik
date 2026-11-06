/** Data lookups for Learn pages: words are looked up among the 1,000 most frequent of each type. */
import { ADJ_CELLS, ADJ_EXTRA, ADJ_EXTRA_CELL_OFFSET, NOUN_CELLS, VERB_CELLS, VERB_INFINITIVE_CELL } from '../shared/cells.ts';
import { bare } from '../shared/forms.ts';
import type { SentenceRow } from '../shared/types.ts';
import { chooseSentence, loadAdjectives, loadCloze, loadExtraJson, loadNouns, loadNumerals, loadParticiples, loadPronouns, loadSentences, loadVerbs } from './data.ts';
import { normalise } from '../shared/normalise.ts';
import type { ClozeRow, NumeralRow, ParticipleRow } from '../shared/types.ts';
import type { Adjective, Noun, Verb } from './types.ts';

const LEARN_BAND = 1; // top 1,000

let cache: Promise<{ verbs: Verb[]; nouns: Noun[]; adjectives: Adjective[] }> | null = null;
export function learnWords() {
  cache ??= Promise.all([loadVerbs(LEARN_BAND), loadNouns(LEARN_BAND), loadAdjectives(LEARN_BAND)]).then(([verbs, nouns, adjectives]) => ({ verbs, nouns, adjectives }));
  return cache;
}
export const learnPronouns = () => loadPronouns();

export async function findWord(what: 'noun' | 'verb' | 'adjective', word: string): Promise<Verb | Noun | Adjective | undefined> {
  const w = await learnWords();
  const list = what === 'verb' ? w.verbs : what === 'noun' ? w.nouns : w.adjectives;
  return (list as { accented: string }[]).find((x) => bare(x.accented) === word) as Verb | Noun | Adjective | undefined;
}

/** Resolve a cell key ("past_f", "sg_acc", "m_gen", "short_f", "inf") to [mask bit, cell string]. */
export function resolveCell(what: 'noun' | 'verb' | 'adjective', lemma: Verb | Noun | Adjective, key: string): [number, string] | null {
  if (what === 'verb') {
    const v = lemma as Verb;
    if (key === 'inf') return [VERB_INFINITIVE_CELL, v.accented];
    const i = VERB_CELLS.findIndex((c) => c.key === key);
    return i >= 0 && v.cells[i] ? [i, v.cells[i]!] : null;
  }
  if (what === 'noun') {
    const i = (NOUN_CELLS as readonly string[]).indexOf(key);
    return i >= 0 && lemma.cells[i] ? [i, lemma.cells[i]!] : null;
  }
  const a = lemma as Adjective;
  const i = (ADJ_CELLS as readonly string[]).indexOf(key);
  if (i >= 0 && a.cells[i]) return [i, a.cells[i]!];
  const e = (ADJ_EXTRA as readonly string[]).indexOf(key);
  return e >= 0 && a.extra[e] ? [ADJ_EXTRA_CELL_OFFSET + e, a.extra[e]!] : null;
}

/** The participles and verbal adverbs of a verb (top 1,000 verbs). */
export async function findParticiples(verb: string): Promise<{ row: ParticipleRow; band: number } | undefined> {
  const rows = await loadParticiples(LEARN_BAND);
  return rows.find((r) => bare(r.row[1]) === verb);
}

/** A numeral's case table (cardinal or collective). */
export async function findNumeral(word: string): Promise<NumeralRow | undefined> {
  const [nums, coll] = await Promise.all([loadNumerals(), loadExtraJson<NumeralRow[]>('collectives')]);
  return [...nums, ...coll].find((r) => bare(r[0]) === word);
}

/** A possessive/demonstrative pronoun's table, in adjective cell order. */
export async function findPossessive(word: string): Promise<[string, string[]] | undefined> {
  return (await loadPronouns()).possessive.find(([w]) => bare(w) === word);
}

/** A sentence containing exactly this participle or verbal-adverb form of the verb. */
export async function findParticipleSentence(verb: string, form: string): Promise<SentenceRow | undefined> {
  const p = await findParticiples(verb);
  if (!p) return undefined;
  const shard = await loadSentences('participles', p.band);
  return (shard[p.row[0]] ?? []).find((r) => normalise(r[1].slice(r[4], r[5])) === normalise(form));
}

/**
 * The shortest real sentences of one sentence-drill kind (e.g. chtoby/past), as example rows with the
 * target word highlighted. Shortest first: they are usually the clearest.
 */
export async function findExamples(topic: string, item: string, count: number): Promise<SentenceRow[]> {
  const rows = (await loadCloze(topic)).filter((r) => r[7] === item);
  return pickExamples(rows, count);
}
export function pickExamples(rows: ClozeRow[], count: number): SentenceRow[] {
  // Skip near-repeats: the same highlighted word after the same word (С кем ты живёшь? / С кем Вы живёте?).
  const seen = new Set<string>();
  const out: ClozeRow[] = [];
  for (const r of [...rows].sort((a, b) => a[1].length - b[1].length || a[0] - b[0])) {
    const key = normalise(`${r[1].slice(0, r[3]).trim().split(/\s+/).at(-1) ?? ''} ${r[1].slice(r[3], r[4])}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= count) break;
  }
  return out.map(([id, ru, en, start, end]) => [id, ru, en, 0, start, end]);
}

/** A Tatoeba sentence containing exactly that form of the word, or undefined. */
export async function findSentence(what: 'noun' | 'verb' | 'adjective', word: string, key: string): Promise<SentenceRow | undefined> {
  const lemma = await findWord(what, word);
  if (!lemma) return undefined;
  const cell = resolveCell(what, lemma, key);
  if (!cell) return undefined;
  const type = what === 'verb' ? 'verbs' : what === 'noun' ? 'nouns' : 'adjectives';
  const shard = await loadSentences(type, lemma.band);
  return chooseSentence(shard[lemma.id], cell[0], cell[1]);
}
