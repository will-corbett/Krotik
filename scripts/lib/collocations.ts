/**
 * Real adjective + noun pairs, so agreement drills pair words that actually go together (новая книга, not *ваш мол).
 *
 * From the Tatoeba sentences: an adjective (or participle) form directly followed by a noun form, each belonging to
 * exactly one lemma and agreeing: some case/gender/number reading of the one matches a reading of the other.
 * Names and month names never count (a date like тридцатого мая isn't a pair to drill).
 *
 * Output: { adj: { <adjective, bare>: [noun id, …] }, part: { <verb id>: [noun id, …] } }, most frequent pair first.
 */
import { ADJ_CELLS, CASES } from '../../src/shared/cells.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cellForms } from '../../src/shared/forms.ts';
import type { Collocations, ParticipleRow } from '../../src/shared/types.ts';
import type { Adjective } from './clean-adjectives.ts';
import type { Noun } from './clean-nouns.ts';
import type { Report } from './report.ts';
import { TOKEN, type Corpus } from './sentences.ts';

/** Most partners kept per word. */
const CAP = 40;

export function buildCollocations(corpus: Corpus, adjectives: Adjective[], nouns: Noun[], participles: ParticipleRow[], months: string[], report: Report): Collocations {
  const S = 'Adjective + noun pairs (Tatoeba)';
  const adjById = new Map(adjectives.map((a) => [a.id, a]));
  const nounById = new Map(nouns.map((n) => [n.id, n]));
  const only = (n: string, map: Map<string, Set<string>>) => {
    const o = map.get(n);
    return o?.size === 1 ? [...o][0]! : '';
  };
  /** Does this adjective form (mask over ADJ_CELLS) agree with this noun form (mask over NOUN_CELLS)? */
  const agrees = (adjMask: number, noun: Noun, nounMask: number) =>
    ADJ_CELLS.some((key, i) => {
      if (!(adjMask & (1 << i))) return false;
      const [slot, c] = key.split('_') as [string, string];
      const ci = CASES.indexOf(c as (typeof CASES)[number]);
      if (slot === 'pl') return !!(nounMask & (1 << (6 + ci)));
      return slot === noun.gender && !!(nounMask & (1 << ci));
    });

  // Month names are left out: тридцатого мая is a date (число is understood), not a pair to drill as *тридцатый май.
  const monthIds = new Set(nouns.filter((n) => months.includes(n.bare)).map((n) => n.id));
  // Participle forms → the ADJ_CELLS they fill (verbal adverbs aren't included: бросив чемодан is verb + object).
  const partCells = new Map<string, { verb: number; mask: number }[]>();
  for (const row of participles) {
    for (const [, , cells] of row[6]) {
      cells.forEach((cell, i) => {
        for (const f of cellForms(cell)) {
          const k = normalise(f);
          const list = partCells.get(k) ?? partCells.set(k, []).get(k)!;
          const e = list.find((x) => x.verb === row[0]);
          if (e) e.mask |= 1 << i;
          else list.push({ verb: row[0], mask: 1 << i });
        }
      });
    }
  }

  const adj = new Map<string, Map<number, number>>();
  const part = new Map<string, Map<number, number>>();
  const bump = (m: Map<string, Map<number, number>>, k: string, noun: number) => {
    const inner = m.get(k) ?? m.set(k, new Map()).get(k)!;
    inner.set(noun, (inner.get(noun) ?? 0) + 1);
  };
  for (const { ru } of corpus.pairs) {
    const toks = [...ru.matchAll(TOKEN)].map((m) => ({ text: m[0], n: normalise(m[0]), start: m.index!, end: m.index! + m[0].length }));
    toks.forEach((t, i) => {
      const next = toks[i + 1];
      if (!next || /[,.;:!?—–()«»"]/.test(ru.slice(t.end, next.start))) return;
      if (/^[А-ЯЁ]/.test(next.text) || corpus.capitalisedMid.has(next.n)) return; // names
      const nOwner = only(next.n, corpus.owners);
      if (!nOwner.startsWith('nouns:')) return;
      const nounId = Number(nOwner.split(':')[1]);
      const noun = nounById.get(nounId);
      if (!noun || monthIds.has(nounId)) return;
      const aOwner = only(t.n, corpus.owners);
      if (aOwner.startsWith('adjectives:')) {
        const a = adjById.get(Number(aOwner.split(':')[1]));
        const aMask = corpus.masks.get(`${t.n}|${aOwner}`) ?? 0;
        const nMask = corpus.masks.get(`${next.n}|${nOwner}`) ?? 0;
        if (a && noun.gender && agrees(aMask & 0x3ffffff, noun, nMask)) bump(adj, a.bare, nounId);
        return;
      }
      // A participle form of exactly one verb, agreeing with the noun.
      const p = partCells.get(t.n);
      if (p?.length === 1 && noun.gender && agrees(p[0]!.mask, noun, corpus.masks.get(`${next.n}|${nOwner}`) ?? 0)) bump(part, String(p[0]!.verb), nounId);
    });
  }
  const top = (m: Map<string, Map<number, number>>) =>
    Object.fromEntries(
      [...m]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([k, inner]) => [k, [...inner].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, CAP).map(([id]) => id)]),
    );
  const out: Collocations = { adj: top(adj), part: top(part) };
  report.count(S, 'adjectives with at least one attested noun', Object.keys(out.adj).length);
  report.count(S, 'adjectives with at least three', Object.values(out.adj).filter((l) => l.length >= 3).length);
  report.count(S, 'verbs whose participles have an attested noun', Object.keys(out.part).length);
  report.note(S, 'Agreement drills pair an adjective, possessive, ordinal or participle only with nouns it is seen with in these sentences.');
  return out;
}
