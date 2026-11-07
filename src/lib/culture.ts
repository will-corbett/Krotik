/**
 * Culture page: hand-picked links (content/culture/links.yaml) and short culture notes
 * (content/culture/notes/<id>.md, listed in content/culture/notes.yaml). Links only — nothing is embedded.
 */
import linksData from '../../content/culture/links.yaml';
import notesData from '../../content/culture/notes.yaml';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];
export const LINK_TYPES = ['video', 'cartoons', 'films', 'podcast', 'reading', 'tool'] as const;
export type LinkType = (typeof LINK_TYPES)[number];
export const REGIONS = ['russia', 'kazakhstan', 'central-asia', 'ukraine', 'caucasus', 'baltics', 'worldwide'] as const;
export type Region = (typeof REGIONS)[number];
export const TOPICS = ['learning', 'language', 'science', 'tech', 'history-culture', 'books', 'cooking', 'travel', 'lifestyle', 'games', 'sport', 'comedy', 'kids', 'films', 'reference'] as const;
export type Topic = (typeof TOPICS)[number];
export const TOPIC_LABEL: Record<Topic, string> = {
  learning: 'Learning Russian',
  language: 'The Russian language',
  science: 'Science',
  tech: 'Technology',
  'history-culture': 'History and culture',
  books: 'Literature',
  cooking: 'Cooking',
  travel: 'Travel and places',
  lifestyle: 'Lifestyle',
  games: 'Video games',
  sport: 'Sport and chess',
  comedy: 'Comedy',
  kids: 'For children',
  films: 'Films and series',
  reference: 'Dictionaries and reference',
};

export interface CultureLink {
  title: string;
  url: string;
  type: LinkType;
  kind: 'learner' | 'native';
  level: [Level, Level];
  region: Region;
  topic: Topic;
  about: string;
  note?: string;
  checked: string;
}
export interface CultureNote {
  id: string;
  title: string;
  ru: string;
  blurb: string;
}

export const LINKS = linksData as CultureLink[];
export const NOTES = notesData as CultureNote[];

/** A way to use each kind of resource for learning, shown under its heading (our own suggestions). */
export const TYPE_ACTIVITY: Record<LinkType, string> = {
  video:
    'Watch two or three minutes with Russian subtitles, then again without. Pause after a sentence you half-understood, say it aloud, and look up one new word.',
  cartoons:
    'Cartoons repeat simple phrases. Watch one episode twice, then retell what happened in five short sentences in the past tense.',
  films:
    'Choose one scene of two or three minutes. Watch it with Russian subtitles, write down two lines of dialogue and check their case endings and aspect, then watch it again without subtitles.',
  podcast:
    'Listen once for the gist, then again with the transcript if there is one. Shadow a few sentences: repeat each one straight after the speaker, copying the stress and intonation.',
  reading:
    'Read a short piece first without a dictionary, guessing from context. Then pick five verbs and say why each is perfective or imperfective.',
  tool: 'Use these alongside your drills: look up a word you got wrong, check its stress and full forms, and say it in a sentence of your own.',
};

export const TYPE_LABEL: Record<LinkType, { en: string; ru: string }> = {
  video: { en: 'Videos', ru: 'видео' },
  cartoons: { en: 'Cartoons', ru: 'мультфильмы' },
  films: { en: 'Films and series', ru: 'фильмы и сериалы' },
  podcast: { en: 'Podcasts', ru: 'подкасты' },
  reading: { en: 'Reading and audiobooks', ru: 'чтение и аудиокниги' },
  tool: { en: 'Tools and dictionaries', ru: 'словари и инструменты' },
};
export const REGION_LABEL: Record<Region, string> = {
  russia: 'Russia',
  kazakhstan: 'Kazakhstan',
  'central-asia': 'Central Asia',
  ukraine: 'Ukraine',
  caucasus: 'Caucasus',
  baltics: 'Baltic states',
  worldwide: 'Anywhere',
};

/** "youtube.com", "ru.wikisource.org" — shown so it's clear where a link goes. */
export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

export interface CultureFilter {
  level: Level | 'any';
  kind: 'learner' | 'native' | 'any';
  region: Region | 'any';
  topic: Topic | 'any';
  type: LinkType | 'any';
  /** free text, matched against title and description (case-insensitive, ё = е) */
  text: string;
}

const fold = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Links that suit the filter: the level falls in the link's range. */
export function filterLinks(links: CultureLink[], f: CultureFilter): CultureLink[] {
  return links.filter((l) => {
    if (f.kind !== 'any' && l.kind !== f.kind) return false;
    if (f.region !== 'any' && l.region !== f.region) return false;
    if (f.topic !== 'any' && l.topic !== f.topic) return false;
    if (f.type !== 'any' && l.type !== f.type) return false;
    const words = fold(f.text).split(/\s+/).filter(Boolean);
    if (words.length) {
      const hay = fold(`${l.title} ${l.about} ${l.note ?? ''} ${hostOf(l.url)}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (f.level !== 'any') {
      const i = LEVELS.indexOf(f.level);
      if (i < LEVELS.indexOf(l.level[0]) || i > LEVELS.indexOf(l.level[1])) return false;
    }
    return true;
  });
}

export const levelText = (l: CultureLink) => (l.level[0] === l.level[1] ? l.level[0] : `${l.level[0]}–${l.level[1]}`);


const files = import.meta.glob('/content/culture/notes/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
export async function loadNote(id: string): Promise<string | null> {
  const f = files[`/content/culture/notes/${id}.md`];
  return f ? f() : null;
}
