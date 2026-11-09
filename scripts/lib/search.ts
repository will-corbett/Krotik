/**
 * Site search (public/data/search.json): one entry per thing worth finding (a Learn page, a drill, a Vocabulary theme,
 * a Reading text, a culture note or link, an idiom, a pair of words that go together, a writing task, a main page),
 * with what it's called and the text to search. Words from the vocabulary lists are searched in the app from the word
 * list shards, so they aren't repeated here. Built at the end of the data build, from content/ and the data just
 * written, so the index always matches the site.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ALL_TOPICS, isDrill } from '../../src/lib/topics.ts';
import type { CollocationData, IdiomData, ReadingIndex, SearchDoc, SearchIndex, ThemeData, ThemeIndex } from '../../src/shared/types.ts';
import { OUT_DIR } from './shard.ts';

const json = <T>(file: string) => JSON.parse(readFileSync(join(OUT_DIR, file), 'utf8')) as T;
// Stress marks are apostrophes after a Cyrillic vowel; English apostrophes (don't) stay.
const plain = (s: string) => s.replace(/([а-яё])'/gi, '$1').replace(/\s+/g, ' ').trim();
/** Markdown to plain text: no data blocks, tables' pipes or markup. */
function mdText(src: string): { headings: string[]; text: string } {
  // Data blocks, comments and tables' header and divider rows (Not this | But this | Why) aren't searchable text.
  const lines = src.split('\n').filter((l) => !l.trim().startsWith('::') && !l.trim().startsWith('<!--') && !/^\|\s*(Not this|---|Formal|Everyday)\b/.test(l.trim()) && !/^\|[\s|:-]+\|$/.test(l.trim()));
  const headings = lines.filter((l) => /^#{2,3}\s/.test(l)).map((l) => l.replace(/^#+\s*/, '').trim());
  const text = lines
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*`|>]/g, ' ')
    .replace(/-{3,}/g, ' ');
  return { headings, text: plain(text) };
}

export function buildSearch(): SearchIndex {
  const docs: SearchDoc[] = [];
  const add = (d: SearchDoc) => docs.push({ ...d, title: plain(d.title), text: plain(d.text).slice(0, 4000) });

  // Main pages.
  const PAGES: [string, string, string][] = [
    ['start/', 'Start here', 'A beginner’s guide: what’s here, a first path through the site, how drills work, levels.'],
    ['paths/', 'Learning paths', 'A recommended order of topics, vocabulary and reading for each level, A1 to C1.'],
    ['test/', 'Grammar test', 'Sixty questions from A1 to C1, then a typed stage: an estimate of your grammar level.'],
    ['learn/', 'Learn', 'Every grammar topic with its level: short explanations with real sentences.'],
    ['drill/', 'Drill', 'Choose a drill: verbs, cases, adjectives, sentences, listening, words and review.'],
    ['vocabulary/', 'Vocabulary', 'Words by theme from A1 to C1, with real sentences, dialogues and practice.'],
    ['reading/', 'Reading', 'Stories by Tolstoy and Chekhov, Chekhov’s comedies and science news, every word explained.'],
    ['writing/', 'Writing', 'Writing tasks for each level, with a checklist.'],
    ['listening/', 'Listening', 'Native recordings: listen and choose, dictation, hear the ending, minimal pairs, listen and read.'],
    ['culture/', 'Culture', 'Hand-picked videos, films, podcasts, books and tools, and short culture notes.'],
    ['settings/', 'Settings', 'Your level, stress marks, the Cyrillic keyboard, phonetic typing, theme, progress.'],
    ['progress/', 'Your progress', 'Rounds, scores and your words, kept only in this browser if you turn progress on.'],
    ['feedback/', 'Feedback', 'Tell us what is wrong, confusing or missing: by email or on GitHub. Report a problem.'],
    ['about/', 'About and sources', 'Where the data comes from, licences, privacy and the people who recorded the audio.'],
  ];
  for (const [path, title, text] of PAGES) add({ k: 'page', path, title, text });

  // Learn pages (their full text) and drills.
  for (const t of ALL_TOPICS) {
    const f = join('content/learn', `${t.id}.md`);
    if (t.learn !== false && existsSync(f)) {
      const { headings, text } = mdText(readFileSync(f, 'utf8'));
      add({ k: 'learn', path: `learn/${t.id}/`, title: t.title.en, ru: t.title.ru, level: t.level.join('–'), text: `${t.blurb} ${headings.join(' ')} ${text}` });
    }
    if (isDrill(t)) add({ k: 'drill', path: `drill/${t.id}/`, title: t.title.en, ru: t.title.ru, level: t.level.join('–'), text: t.blurb });
  }

  // Vocabulary themes, with their words and meanings.
  for (const t of json<ThemeIndex>('themes.json').themes) {
    const data = json<ThemeData>(`theme.${t.id}.json`);
    const words = data.groups.flatMap((g) => [g.title, ...g.words.map((w) => `${w[1]} ${w[2]}`)]).join(' ');
    add({ k: 'theme', path: `vocabulary/${t.id}/`, title: t.title, ru: t.ru, level: t.level, text: `${t.blurb} ${words}` });
  }

  // Reading texts.
  const reading = json<ReadingIndex>('reading.json');
  for (const u of reading.units) {
    const w = reading.works[u.w]!;
    const level = (u.level ?? w.level).join('–');
    add({ k: 'reading', path: `reading/${u.id}/`, title: w.kind === 'play' ? `${w.title}: ${u.title.replace(/^Явление/, 'явление')}` : u.title, ru: w.site === 'wikinews' ? 'Викиновости' : w.author, level, text: `${w.authorEn} ${w.titleEn} ${u.genre} ${u.date ?? ''}` });
  }

  // Culture notes and links.
  const notes = (parse(readFileSync('content/culture/notes.yaml', 'utf8')) ?? []) as { id: string; title: string; ru?: string; blurb?: string }[];
  for (const n of notes) {
    const f = join('content/culture/notes', `${n.id}.md`);
    const { text } = existsSync(f) ? mdText(readFileSync(f, 'utf8')) : { text: '' };
    add({ k: 'note', path: `culture/${n.id}/`, title: n.title, ...(n.ru ? { ru: n.ru } : {}), text: `${n.blurb ?? ''} ${text}` });
  }
  const links = (parse(readFileSync('content/culture/links.yaml', 'utf8')) ?? []) as { title: string; url: string; type: string; about: string; level?: string[] }[];
  for (const l of links) add({ k: 'link', url: l.url, title: l.title, level: (l.level ?? []).join('–'), text: `${l.type} ${l.about}` });

  // Idioms and words that go together (each links to its Learn page).
  for (const [phrase, meaning] of json<IdiomData>('idioms.json').idioms) add({ k: 'idiom', path: 'learn/idioms/', title: phrase, text: meaning });
  for (const p of json<CollocationData>('verb-noun.json').pairs) add({ k: 'pair', path: 'learn/collocations/', title: p.phrase, text: p.en });

  // Writing tasks.
  const writing = (parse(readFileSync('content/writing.yaml', 'utf8')) ?? []) as { level: string; prompts: { id: string; title: string; task: string }[] }[];
  for (const lv of writing) for (const p of lv.prompts) add({ k: 'writing', path: 'writing/', title: p.title, level: lv.level, text: p.task });

  return { docs };
}
