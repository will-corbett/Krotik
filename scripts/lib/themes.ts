/**
 * The Vocabulary section: themed lessons (content/words/<id>.yaml, listed in content/words/themes.yaml).
 *
 * - Words are named by dictionary form ("чай", or "есть:v" where a spelling is several words, "не'бо" with the stress
 *   where that tells them apart; "рука = hand, arm" gives our own English meaning). Each must be exactly one word in the vocabulary lists, or the build fails.
 * - "In use": for each word, the shortest real Tatoeba sentence (with its English) where the word appears and the
 *   matched form belongs to no other word.
 * - Dialogues are our own Russian. Every word must be explained by the Reading machinery (a real form in the data), and
 *   a capitalised unknown word must be a declared name, or the build fails. Only dialogues with `reviewed` set
 *   ("<who>, YYYY-MM-DD": a native speaker has checked them) are published; the rest go to
 *   reports/dialogues-for-review.md for the reviewer.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { bare } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ReadingLine, ThemeData, ThemeIndex, ThemeWord, WordPos, WordReading, WordRow } from '../../src/shared/types.ts';
import { explainText, type Lexicon } from './literature.ts';
import type { Report } from './report.ts';

/** What's needed of the sentence corpus (scripts/lib/sentences.ts). */
interface Corpus {
  pairs: { rid: number; ru: string; en: string }[];
  owners: Map<string, Set<string>>;
}

const S = 'Words section (themes)';
export const THEMES_DIR = 'content/words';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

interface DialogueSrc {
  title: string;
  /** "" until a native speaker has checked it; then "<who>, YYYY-MM-DD" */
  reviewed: string;
  lines: [string, string, string][];
}
export interface ThemeSrc {
  title: string;
  ru: string;
  level: (typeof LEVELS)[number];
  blurb: string;
  /** names used in the dialogues (each form as written), so they aren't taken for misspelt words */
  names?: string[];
  groups: { title: string; words: string[] }[];
  /** word (as in groups, without "= meaning") → Tatoeba id of the sentence to show in In use, instead of the shortest */
  use?: Record<string, number>;
  dialogues?: DialogueSrc[];
}

export function loadThemes(dir = THEMES_DIR): { id: string; src: ThemeSrc }[] {
  const listFile = join(dir, 'themes.yaml');
  if (!existsSync(listFile)) return [];
  const ids = parse(readFileSync(listFile, 'utf8')) as string[];
  return ids.map((id) => ({ id, src: parse(readFileSync(join(dir, `${id}.yaml`), 'utf8')) as ThemeSrc }));
}

const head = (accented: string) => normalise(bare(accented.split(',')[0]!));

/** "чай", "есть:v", "рука = hand, arm" → the one word it names, or an error. */
export function resolveWord(item: string, byHead: Map<string, WordRow[]>): { row: WordRow; meaning: string } | string {
  const [name, meaning] = item.split(/\s+=\s+/) as [string, string | undefined];
  const [w, pos] = name.trim().split(':') as [string, WordPos | undefined];
  // A stress mark or ё in the name picks between words spelt alike (не'бо "sky", нёбо "palate").
  const exact = /['ё]/.test(w) ? w : null;
  const hits = (byHead.get(normalise(w)) ?? []).filter((r) => (!pos || r[3] === pos) && (!exact || r[1].split(',').some((v) => v.replace(/[()]/g, '').trim() === exact)));
  if (hits.length === 1) return { row: hits[0]!, meaning: meaning?.trim() || hits[0]![2] };
  if (!hits.length) return `«${item}» is not in the word lists`;
  return `«${item}» is ${hits.length} words (${hits.map((r) => `${r[3]}: ${r[2]}`).join('; ')}): add :n, :v, :a or :o`;
}

/** Owner in the sentence corpus for a word-list key. */
const ownerOf = (key: string) => {
  const [p, id] = key.split(':') as [WordPos, string];
  return p === 'o' ? `other:${id}` : `${p === 'n' ? 'nouns' : p === 'v' ? 'verbs' : 'adjectives'}:${id}`;
};

/** Sentences never shown as a word's example: crude or violent ones (Tatoeba has them, and the shortest can be one). */
const CRUDE = /(^|[^а-яё])(дерьм|говн|сук[аи]|бля|хуй|хуё|пизд|жоп|задниц|ублюд|сволоч|мудак|трах|секс|убью|убил|убей)/i;

/**
 * For each owner, the shortest sentences (then lowest Tatoeba id) where one of its forms appears unambiguously, best
 * first (up to `keep`).
 */
export function findUses(owners: Set<string>, corpus: Pick<Corpus, 'pairs' | 'owners'>, keep = 1): Map<string, [number, string, string, number, number][]> {
  const best = new Map<string, [number, string, string, number, number][]>();
  for (const { rid, ru, en } of corpus.pairs) {
    if (CRUDE.test(ru)) continue;
    let first = true;
    for (const m of ru.matchAll(TOKEN)) {
      const isFirst = first;
      first = false;
      if (/^[А-ЯЁ]/.test(m[0]) && !isFirst) continue; // a name, most likely
      const o = corpus.owners.get(normalise(m[0]));
      if (!o || o.size !== 1) continue;
      const owner = [...o][0]!;
      if (!owners.has(owner)) continue;
      const list = best.get(owner) ?? [];
      if (list.some((x) => x[0] === rid)) continue;
      list.push([rid, ru, en, m.index!, m.index! + m[0].length]);
      list.sort((a, b) => a[1].length - b[1].length || a[0] - b[0]);
      if (list.length > keep) list.pop();
      best.set(owner, list);
    }
  }
  return best;
}
/** A chosen sentence: it must use the word (a form that belongs to it alone). */
export function useById(rid: number, owner: string, corpus: Pick<Corpus, 'pairs' | 'owners'>): [number, string, string, number, number] | undefined {
  const p = corpus.pairs.find((x) => x.rid === rid);
  if (!p) return undefined;
  for (const m of p.ru.matchAll(TOKEN)) {
    const o = corpus.owners.get(normalise(m[0]));
    if (o?.size === 1 && o.has(owner)) return [p.rid, p.ru, p.en, m.index!, m.index! + m[0].length];
  }
  return undefined;
}

/** Russian we wrote (a title, a dialogue): the readings of its words, or what couldn't be explained. */
export function checkRussian(lines: ReadingLine[], names: Set<string>, lex: Lexicon): { words: Record<string, WordReading[]>; problems: string[] } {
  const { words, unexplained } = explainText(lines, lex);
  const speakers = new Set(lines.flatMap((l) => (l[0] ? l[0].split(/\s+/).map(normalise) : [])));
  const problems = unexplained.map((w) => `«${w}» is not a known form`);
  for (const [w, rs] of Object.entries(words)) {
    // A capitalised word nobody knows is read as a name: in our own Russian, only declared names and speakers may be.
    if (rs.length === 1 && rs[0]![3] === 'n' && !names.has(w) && !speakers.has(w)) problems.push(`«${w}» is not a known form (or add it to names)`);
  }
  return { words, problems };
}

export function buildThemes(
  themes: { id: string; src: ThemeSrc }[],
  input: { words: WordRow[]; band: (row: WordRow) => number; corpus: Pick<Corpus, 'pairs' | 'owners'>; lex: Lexicon },
  report: Report,
): { index: ThemeIndex; themes: ThemeData[]; review: string } {
  const byHead = new Map<string, WordRow[]>();
  for (const r of input.words) {
    const k = head(r[1]);
    const list = byHead.get(k);
    if (list) list.push(r);
    else byHead.set(k, [r]);
  }
  const errors: string[] = [];
  const resolved = themes.map(({ id, src }) => ({
    id,
    src,
    groups: src.groups.map((g) => ({
      title: g.title,
      words: g.words.flatMap((item): ThemeWord[] => {
        const r = resolveWord(item, byHead);
        if (typeof r === 'string') {
          errors.push(`${id}: ${r}`);
          return [];
        }
        return [[r.row[0], r.row[1], r.meaning, r.row[3], r.row[4], input.band(r.row)]];
      }),
    })),
  }));
  const uses = findUses(new Set(resolved.flatMap((t) => t.groups.flatMap((g) => g.words.map((w) => ownerOf(w[0]))))), input.corpus, process.env.THEMES_DEBUG ? 8 : 1);
  // THEMES_DEBUG=file: write each word's candidate sentences there, to choose better ones by hand (`use:`).
  if (process.env.THEMES_DEBUG) {
    const lines = resolved.flatMap((t) => t.groups.flatMap((g) => g.words.map((w) => `${t.id} ${w[1]}\n${(uses.get(ownerOf(w[0])) ?? []).map((u) => `   ${u[0]} ${u[1]} — ${u[2]}`).join('\n')}`)));
    writeFileSync(process.env.THEMES_DEBUG, lines.join('\n') + '\n');
  }

  const review: string[] = ['# Dialogues for review', '', 'Written for Krotik\'s Vocabulary section. Each needs a native speaker\'s check before it is published: is it natural, everyday Russian? Please mark changes by line number. When a dialogue is approved, its `reviewed` field in `content/words/<theme>.yaml` gets the reviewer\'s name and the date.', ''];
  let drafts = 0;
  const out: ThemeData[] = [];
  for (const t of resolved) {
    if (!LEVELS.includes(t.src.level)) errors.push(`${t.id}: level ${t.src.level} is not one of ${LEVELS.join(', ')}`);
    const names = new Set((t.src.names ?? []).map(normalise));
    const title = checkRussian([['', t.src.ru, 0]], names, input.lex);
    for (const p of title.problems) errors.push(`${t.id} title: ${p}`);
    const seen = new Set<string>();
    for (const g of t.groups) for (const w of g.words) {
      if (seen.has(w[0])) errors.push(`${t.id}: «${w[1].replace(/'/g, '')}» is listed twice`);
      seen.add(w[0]);
    }
    const published: ThemeData['dialogues'] = [];
    const words: Record<string, WordReading[]> = {};
    for (const [di, d] of (t.src.dialogues ?? []).entries()) {
      const lines: ReadingLine[] = d.lines.map(([sp, ru]) => [sp, ru, 0]);
      const { words: w, problems } = checkRussian(lines, names, input.lex);
      for (const p of problems) errors.push(`${t.id}, dialogue «${d.title}»: ${p}`);
      if (d.reviewed?.trim()) {
        published.push({ title: d.title, reviewed: d.reviewed.trim(), lines, en: d.lines.map((l) => l[2]) });
        Object.assign(words, w);
      } else {
        drafts++;
        review.push(`## ${t.src.title}: ${d.title}`, '', `\`content/words/${t.id}.yaml\`, dialogue ${di + 1}`, '', '| # | Russian | English |', '|---:|---|---|');
        d.lines.forEach(([sp, ru, en], i) => review.push(`| ${i + 1} | ${sp ? `**${sp}:** ` : ''}${ru} | ${en} |`));
        review.push('');
      }
    }
    const themeUses: ThemeData['uses'] = {};
    const chosen = new Map<string, number>();
    for (const [name, rid] of Object.entries(t.src.use ?? {})) {
      const r = resolveWord(name, byHead);
      if (typeof r === 'string') errors.push(`${t.id} use: ${r}`);
      else chosen.set(r.row[0], rid);
    }
    for (const g of t.groups) for (const w of g.words) {
      const rid = chosen.get(w[0]);
      if (rid !== undefined) {
        const u = useById(rid, ownerOf(w[0]), input.corpus);
        if (u) themeUses[w[0]] = u;
        else errors.push(`${t.id} use: Tatoeba #${rid} isn't in the corpus or doesn't use «${w[1].replace(/'/g, '')}»`);
        continue;
      }
      const u = uses.get(ownerOf(w[0]))?.[0];
      if (u) themeUses[w[0]] = u;
    }
    const count = t.groups.reduce((n, g) => n + g.words.length, 0);
    report.count(S, `${t.id}: words`, count);
    report.count(S, `${t.id}: words with a real sentence in use`, Object.keys(themeUses).length);
    report.note(S, `${t.id}: ${published.length} dialogue(s) published, ${(t.src.dialogues ?? []).length - published.length} waiting for review.`);
    out.push({
      id: t.id,
      title: t.src.title,
      ru: t.src.ru,
      level: t.src.level,
      blurb: t.src.blurb,
      groups: t.groups,
      uses: themeUses,
      dialogues: published,
      words: Object.fromEntries(Object.entries(words).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
      drafts: (t.src.dialogues ?? []).length - published.length,
    });
  }
  if (errors.length) throw new Error(`content/words:\n  ${errors.join('\n  ')}`);
  if (!drafts) review.push('Nothing waiting: every dialogue has been reviewed.');
  return {
    index: { themes: out.map((t) => ({ id: t.id, title: t.title, ru: t.ru, level: t.level, blurb: t.blurb, words: t.groups.reduce((n, g) => n + g.words.length, 0), dialogues: t.dialogues.length, keys: t.groups.flatMap((g) => g.words.map((w) => w[0])) })) },
    themes: out,
    review: review.join('\n') + '\n',
  };
}
