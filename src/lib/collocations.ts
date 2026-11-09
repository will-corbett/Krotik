import type { CollocationData } from '../shared/types.ts';

const bare = (s: string) => s.replace(/'/g, '');
/** The pairs for these verbs (by dictionary form, either aspect), or every pair; in the list's order. */
export function pairsFor(data: CollocationData, verbs: string[]): CollocationData['pairs'] {
  if (!verbs.length) return data.pairs;
  const want = new Set(verbs);
  return data.pairs.filter((p) => p.verbs.some(([, v]) => want.has(bare(v))));
}
/** The pairs whose noun is one of these word keys (a Vocabulary theme's words). */
export const pairsWithNouns = (data: CollocationData, keys: Set<string>) => data.pairs.filter((p) => keys.has(p.noun[0]));
