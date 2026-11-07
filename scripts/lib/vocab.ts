/**
 * Word lists for the Vocabulary drill: every noun, verb and adjective in the drill data, plus the "other words"
 * (prepositions, adverbs, conjunctions, particles, pronouns…) from OpenRussian's others.csv, each with its English
 * meaning. Banded like the drill shards: by rank within its own list (1–250, 251–1000, 1001–2500, rest).
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
  const g = cleanGloss(raw.replace(/\s*\+\s*[a-z ]+(case)?\b/gi, ''));
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
    adjectives: Lemma[];
    others: Record<string, string>[];
    /** personal pronouns: [nominative, cells by case] */
    pronouns: [string, string[]][];
    exclude: Record<string, string>;
    /** word → English meaning to use instead of the source's (others.csv meanings can be long-winded) */
    gloss: Record<string, string>;
    /** nouns/adjectives kept although spelt like a commoner verb or other word (честь "honour", not честь "read") */
    keep: Record<string, string>;
  },
  report: Report,
): { rows: WordRow[]; rank: (row: WordRow) => number } {
  const { verbs, nouns, adjectives, others, pronouns, exclude, gloss: glossFix, keep: keepAnyway } = input;
  const rows: { row: WordRow; rank: number }[] = [];
  const drop = (reason: string, w: string) => report.drop(SECTION, reason, w);
  // A noun or adjective spelt like a verb or other word in the same band or a commoner one is left out: its rank comes
  // from the other word's frequency (тут "mulberry", мочь "power"). Rarer homographs don't matter (честь "honour").
  const homograph = new Map<string, number>();
  const note = (w: string, rank: number) => homograph.set(w, Math.min(homograph.get(w) ?? Infinity, bandOf(rank)));
  verbs.forEach((v, i) => note(normalise(v.bare), i));
  others.forEach((o, i) => o.translations_en?.trim() && note(normalise(o.bare!), i));
  const shadowed = (bare: string, rank: number) => !(bare in keepAnyway) && (homograph.get(normalise(bare)) ?? Infinity) <= bandOf(rank);
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
    if (shadowed(a.bare, i)) return report.anomaly(SECTION, 'adjective left out: spelt like a commoner verb or other word', `${a.bare} (${a.gloss})`);
    keep('a', `a:${a.id}`, a.bare, a.accented, a.gloss, '', i);
  });
  nouns.forEach((n, i) => {
    if (/^[А-ЯЁ]/.test(n.bare)) return drop('name', n.bare);
    if (shadowed(n.bare, i)) return report.anomaly(SECTION, 'noun left out: spelt like a commoner verb or other word', `${n.bare} (${n.gloss})`);
    keep('n', `n:${n.id}`, n.bare, n.accented, n.gloss, n.gender, i);
  });
  const seen = new Set<string>();
  others.forEach((o, i) => {
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
