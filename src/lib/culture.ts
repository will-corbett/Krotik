/**
 * Culture page: hand-picked links (content/culture/links.yaml) and short culture notes
 * (content/culture/notes/<id>.md, listed in content/culture/notes.yaml). Links only — nothing is embedded.
 */
import linksData from '../../content/culture/links.yaml';
import notesData from '../../content/culture/notes.yaml';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];
export const LINK_TYPES = ['video', 'cartoons', 'podcast', 'reading', 'tool'] as const;
export type LinkType = (typeof LINK_TYPES)[number];
export const REGIONS = ['russia', 'kazakhstan', 'ukraine', 'georgia', 'worldwide'] as const;
export type Region = (typeof REGIONS)[number];

export interface CultureLink {
  title: string;
  url: string;
  type: LinkType;
  kind: 'learner' | 'native';
  level: [Level, Level];
  region: Region;
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

export const TYPE_LABEL: Record<LinkType, { en: string; ru: string }> = {
  video: { en: 'Videos', ru: 'видео' },
  cartoons: { en: 'Cartoons', ru: 'мультфильмы' },
  podcast: { en: 'Podcasts', ru: 'подкасты' },
  reading: { en: 'Reading and audiobooks', ru: 'чтение и аудиокниги' },
  tool: { en: 'Tools and dictionaries', ru: 'словари и инструменты' },
};
export const REGION_LABEL: Record<Region, string> = {
  russia: 'Russia',
  kazakhstan: 'Kazakhstan',
  ukraine: 'Ukraine',
  georgia: 'Georgia',
  worldwide: 'Anywhere',
};

export interface CultureFilter {
  level: Level | 'any';
  kind: 'learner' | 'native' | 'any';
  region: Region | 'any';
}

/** Links that suit the filter: the level falls in the link's range. */
export function filterLinks(links: CultureLink[], f: CultureFilter): CultureLink[] {
  return links.filter((l) => {
    if (f.kind !== 'any' && l.kind !== f.kind) return false;
    if (f.region !== 'any' && l.region !== f.region) return false;
    if (f.level !== 'any') {
      const i = LEVELS.indexOf(f.level);
      if (i < LEVELS.indexOf(l.level[0]) || i > LEVELS.indexOf(l.level[1])) return false;
    }
    return true;
  });
}

export const levelText = (l: CultureLink) => (l.level[0] === l.level[1] ? l.level[0] : `${l.level[0]}–${l.level[1]}`);

/** "youtube.com", "ru.wikisource.org" — shown so it's clear where a link goes. */
export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

const files = import.meta.glob('/content/culture/notes/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
export async function loadNote(id: string): Promise<string | null> {
  const f = files[`/content/culture/notes/${id}.md`];
  return f ? f() : null;
}
