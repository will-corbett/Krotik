/**
 * Word lists for the Vocabulary drill: every noun, verb and adjective in the drill data, plus the "other words"
 * (prepositions, adverbs, conjunctions, particles, pronouns…) from OpenRussian's others.csv, each with its English
 * meaning. Banded like the drill shards: by rank within its own list (1–250, 251–1000, 1001–2500, rest); other words
 * are ranked by their count in an independent frequency list (FrequencyWords).
 *
 * Only words that make a fair card are kept: no names, no empty or non-English meanings, no meaning that is really a
 * grammar note ("dative of I"), no case form of a pronoun, and no noun or adjective that is spelt like a verb or other
 * word (тут "mulberry", уж "grass snake": the frequency rank belongs to the other word). Headwords are as the source
 * gives them; nothing is generated.
 */
import type { WordPos, WordRow } from '../../src/shared/types.ts';
import { normalise } from '../../src/shared/normalise.ts';
import { cellForms } from '../../src/shared/forms.ts';
import { cleanGloss, suspiciousWords } from './glosses.ts';
import { bandOf } from './shard.ts';
import type { Report } from './report.ts';

const SECTION = 'Words (vocabulary drill)';
/** A meaning that describes a form rather than translating a word. */
const GRAMMAR_NOTE = /\b(nominative|genitive|genetive|dative|accusative|instrumental|prepositional|form of|short form)\b/i;

interface Lemma {
  id: number;
  bare: string;
  accented: string;
  gloss: string;
}

/** Clean an others.csv meaning: the usual cleaning, minus bracket-only items and "+case" notes. */
export function cleanOtherGloss(raw: string): string {
  // Bracket-only senses ("(possession)" for у) go first, so the real meanings behind them are kept.
  const senses = raw.replace(/\s*\+\s*[a-z ]+(case)?\b/gi, '').split(';').filter((x) => !/^\s*\([^)]*\)\s*$/.test(x));
  const g = cleanGloss(senses.join(';'));
  return g
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .map((s) => (/^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s)) // "Probably" → "probably"
    .join(', ');
}

export function buildWords(
  input: {
    verbs: (Lemma & { aspect: string })[];
    nouns: (Lemma & { gender: string })[];
    /** indeclinable nouns (кофе, метро), left out of the drill data but words to learn; rank = place among the nouns */
    indeclinable?: (Lemma & { gender: string; rank: number })[];
    adjectives: Lemma[];
    others: Record<string, string>[];
    /** personal pronouns: [nominative, cells by case] */
    pronouns: [string, string[]][];
    exclude: Record<string, string>;
    /** word → English meaning to use instead of the source's (others.csv meanings can be long-winded) */
    gloss: Record<string, string>;
    /** nouns/adjectives kept although spelt like a verb or other word (честь "honour", not честь "read") */
    keep: Record<string, string>;
    /** word form → count in the independent frequency list (FrequencyWords, OpenSubtitles 2018) */
    freq: Map<string, number>;
  },
  report: Report,
): { rows: WordRow[]; rank: (row: WordRow) => number } {
  const { verbs, nouns, adjectives, indeclinable = [], others, pronouns, exclude, gloss: glossFix, keep: keepAnyway, freq } = input;
  const rows: { row: WordRow; rank: number }[] = [];
  const drop = (reason: string, w: string) => report.drop(SECTION, reason, w);
  // A noun or adjective spelt like a verb or other word is left out unless overrides.yaml keeps it: the source's
  // order can't say which word the rank belongs to (тут "mulberry", уж "grass snake", мочь "power"), and its order is
  // unreliable for some of them anyway (the verb стать is ranked near the end). Kept: честь "honour" and the like.
  const homograph = new Set([...verbs.map((v) => normalise(v.bare)), ...others.filter((o) => o.translations_en?.trim()).map((o) => normalise(o.bare!))]);
  const shadowed = (bare: string) => !(bare in keepAnyway) && homograph.has(normalise(bare));
  const nominatives = new Set(pronouns.map(([w]) => normalise(w)));
  const pronounForms = new Set(pronouns.flatMap(([, cells]) => cells.flatMap((c) => cellForms(c).map(normalise))).filter((f) => !nominatives.has(f)));

  const keep = (pos: WordPos, key: string, bare: string, accented: string, gloss: string, extra: string, rank: number) => {
    if (bare in exclude) return drop('excluded by override', `${bare} (${exclude[bare]})`);
    if (bare in glossFix) {
      gloss = glossFix[bare]!;
      report.count(SECTION, 'meaning given in overrides.yaml');
    }
    if (!gloss) return drop('no English meaning', bare);
    if (GRAMMAR_NOTE.test(gloss)) return drop('meaning is a grammar note', `${bare} (${gloss})`);
    if (suspiciousWords(gloss).some((w) => /[^\x00-\x7f]/.test(w))) return drop('meaning not in English', `${bare} (${gloss})`);
    rows.push({ row: [key, accented, gloss, pos, extra], rank });
    report.count(SECTION, `kept: ${POS_NAME[pos]}`);
  };

  verbs.forEach((v, i) => keep('v', `v:${v.id}`, v.bare, v.accented, v.gloss, v.aspect, i));
  adjectives.forEach((a, i) => {
    if (shadowed(a.bare)) return report.anomaly(SECTION, 'adjective left out: spelt like a verb or other word', `${a.bare} (${a.gloss})`);
    keep('a', `a:${a.id}`, a.bare, a.accented, a.gloss, '', i);
  });
  nouns.forEach((n, i) => {
    if (/^[А-ЯЁ]/.test(n.bare)) return drop('name', n.bare);
    if (shadowed(n.bare)) return report.anomaly(SECTION, 'noun left out: spelt like a verb or other word', `${n.bare} (${n.gloss})`);
    keep('n', `n:${n.id}`, n.bare, n.accented, n.gloss, n.gender, i);
  });
  // Other words barely inflect, so their own count in the frequency list ranks them well; the source's order doesn't
  // (тут and уж come last). Words the list doesn't have follow, in source order.
  const count = (o: Record<string, string>) => freq.get(normalise(o.bare!)) ?? 0;
  const ranked = others.map((o, i) => ({ o, i })).sort((x, y) => count(y.o) - count(x.o) || x.i - y.i);
  for (const n of indeclinable) {
    if (shadowed(n.bare)) {
      report.anomaly(SECTION, 'noun left out: spelt like a verb or other word', `${n.bare} (${n.gloss})`);
      continue;
    }
    keep('n', `n:${n.id}`, n.bare, n.accented, n.gloss, n.gender, n.rank);
  }
  const seen = new Set<string>();
  ranked.forEach(({ o }, i) => {
    const bare = o.bare!;
    const k = normalise(bare);
    if (seen.has(k)) return drop('repeated in the source', bare);
    seen.add(k);
    if (/^[А-ЯЁA-Z]/.test(bare) || /[.\s]/.test(bare)) return drop('name, abbreviation or phrase', bare);
    if (pronounForms.has(k)) return drop('case form of a pronoun', bare);
    keep('o', `o:${k}`, bare, o.accented || bare, cleanOtherGloss(o.translations_en ?? ''), '', i);
  });

  const rankOf = new Map(rows.map(({ row, rank }) => [row[0], rank]));
  // Deterministic order: by band, then by type (n, v, a, o), then rank within the type.
  const order: WordPos[] = ['n', 'v', 'a', 'o'];
  rows.sort((x, y) => bandOf(x.rank) - bandOf(y.rank) || order.indexOf(x.row[3]) - order.indexOf(y.row[3]) || x.rank - y.rank);
  return { rows: rows.map((r) => r.row), rank: (row) => rankOf.get(row[0])! };
}

const POS_NAME: Record<WordPos, string> = { n: 'nouns', v: 'verbs', a: 'adjectives', o: 'other words' };
