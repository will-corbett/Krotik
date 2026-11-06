/** Data lookups for Learn pages: words are looked up among the 1,000 most frequent of each type. */
import { ADJ_CELLS, ADJ_EXTRA, ADJ_EXTRA_CELL_OFFSET, NOUN_CELLS, VERB_CELLS, VERB_INFINITIVE_CELL } from '../shared/cells.ts';
import { bare } from '../shared/forms.ts';
import type { SentenceRow } from '../shared/types.ts';
import { chooseSentence, loadAdjectives, loadNouns, loadPronouns, loadSentences, loadVerbs } from './data.ts';
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
