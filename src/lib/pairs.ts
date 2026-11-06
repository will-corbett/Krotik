/**
 * Choosing the noun for an agreement question: only nouns the word is really used with (Tatoeba pairs, built by
 * scripts/lib/collocations.ts), so drills say новая книга, not *ваш мол.
 */
import { bare } from '../shared/forms.ts';
import type { Collocations } from '../shared/types.ts';
import { pick, type Rng } from './rng.ts';
import type { Noun } from './types.ts';

/** A partner noun for an adjective-like word (by its dictionary form) or for a verb's participles (by verb id). */
export type PartnerPicker = (word: { adj: string } | { verb: number }, rng: Rng) => Noun | undefined;

/**
 * наш and ваш aren't adjectives in the word data, so the sentence scan can't see them; they go with whatever their
 * singular counterparts мой and твой go with.
 */
const SAME_AS: Record<string, string> = { наш: 'мой', ваш: 'твой' };

/** With pairs: a random attested partner from the loaded nouns (or none). Without: any noun with a gender. */
export function partnerPicker(pairs: Collocations | undefined, nouns: Noun[]): PartnerPicker {
  const gendered = nouns.filter((n) => n.gender);
  if (!pairs) return (_w, rng) => (gendered.length ? pick(rng, gendered) : undefined);
  const byId = new Map(gendered.map((n) => [n.id, n]));
  const cache = new Map<string, Noun[]>();
  return (w, rng) => {
    const key = 'adj' in w ? `a:${bare(w.adj)}` : `v:${w.verb}`;
    let list = cache.get(key);
    if (!list) {
      const ids = 'adj' in w ? (pairs.adj[bare(w.adj)] ?? pairs.adj[SAME_AS[bare(w.adj)] ?? ''] ?? []) : (pairs.part[String(w.verb)] ?? []);
      list = ids.map((id) => byId.get(id)).filter((n): n is Noun => !!n);
      cache.set(key, list);
    }
    return list.length ? pick(rng, list) : undefined;
  };
}
