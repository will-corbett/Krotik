import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export const RAW_DIR = 'data-raw';

/** Public-domain literature (curated/literature.yaml), each text at a fixed Wikisource revision. */
/** One page of a collection: a single story or a news article, at a fixed revision. */
export interface LiteraturePage {
  title: string;
  page: string;
  revision: number;
  /** news: the article's date as Wikinews gives it */
  date?: string;
  /** a story's own level where it differs from the collection's */
  level?: [string, string];
  /** a story's year of first publication */
  year?: number;
}
export interface LiteratureWork {
  id: string;
  author: string;
  authorEn: string;
  /** the author's death year (public-domain works); absent for Wikinews */
  died?: number;
  title: string;
  titleEn: string;
  year: number;
  /** one page for the whole work (stories split by section, plays by scene) … */
  page?: string;
  revision?: number;
  /** … or a collection of single pages, one text each (`kind: pages`) */
  pages?: LiteraturePage[];
  kind: 'stories' | 'play' | 'pages';
  level: [string, string];
  /** where it comes from (Wikisource unless said) */
  site?: 'wikisource' | 'wikinews';
}
const literatureYaml = parse(readFileSync('curated/literature.yaml', 'utf8')) as { works: LiteratureWork[]; notOld?: Record<string, string>; glosses?: Record<string, string> };
/** English meanings written by hand for words in the texts that neither our data nor Wiktionary has. */
export const LITERATURE_GLOSSES = literatureYaml.glosses ?? {};
export const LITERATURE = literatureYaml.works;
/** Words Wiktionary mis-tags as old, each with the reason (curated/literature.yaml). */
export const LITERATURE_NOT_OLD = literatureYaml.notOld ?? {};
const host = (w: LiteratureWork) => (w.site === 'wikinews' ? 'ru.wikinews.org' : 'ru.wikisource.org');
/** The raw file for a work, or for page `i` of a collection. */
export const literatureFile = (w: LiteratureWork, i?: number) => (i === undefined ? `literature-${w.id}.wiki` : `literature-${w.id}-${w.pages![i]!.revision}.wiki`);
const revisionOf = (w: LiteratureWork, i?: number) => (i === undefined ? w.revision! : w.pages![i]!.revision);
export const literatureUrl = (w: LiteratureWork, i?: number) => `https://${host(w)}/w/index.php?oldid=${revisionOf(w, i)}&action=raw`;
/** The page people can read the source at (the exact revision used). */
export const literatureSource = (w: LiteratureWork, i?: number) => `https://${host(w)}/w/index.php?oldid=${revisionOf(w, i)}`;

const OR = 'https://raw.githubusercontent.com/Badestrand/russian-dictionary/master';
const TATOEBA = 'https://downloads.tatoeba.org/exports/per_language';

export const SOURCES = [
  // OpenRussian.org export, CC BY-SA 4.0 (built on Wiktionary).
  { file: 'verbs.csv', url: `${OR}/verbs.csv` },
  { file: 'nouns.csv', url: `${OR}/nouns.csv` },
  { file: 'adjectives.csv', url: `${OR}/adjectives.csv` },
  { file: 'others.csv', url: `${OR}/others.csv` },
  // Tatoeba, CC BY 2.0 FR.
  { file: 'rus_sentences.tsv.bz2', url: `${TATOEBA}/rus/rus_sentences.tsv.bz2` },
  { file: 'eng_sentences.tsv.bz2', url: `${TATOEBA}/eng/eng_sentences.tsv.bz2` },
  { file: 'rus-eng_links.tsv.bz2', url: `${TATOEBA}/rus/rus-eng_links.tsv.bz2` },
  // Which Tatoeba sentences have a recording, by whom and under what licence (each recording has its own; we use
  // only CC BY and CC0 ones). The recordings themselves are fetched by `npm run audio:fetch`.
  { file: 'sentences_with_audio.tar.bz2', url: 'https://downloads.tatoeba.org/exports/sentences_with_audio.tar.bz2' },
  // Wiktionary via kaikki.org (CC BY-SA 4.0 / GFDL, as Wiktionary): participles, verbal adverbs,
  // numerals, diminutives, noun gender. 91 MB gzipped (~950 MB uncompressed), streamed.
  { file: 'kaikki-russian.jsonl.gz', url: 'https://kaikki.org/dictionary/Russian/kaikki.org-dictionary-Russian.jsonl.gz' },
  // Independent frequency list (OpenSubtitles 2018 word forms). Build-time check only; not shipped.
  {
    file: 'ru_50k.txt',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt',
  },
  // Public-domain texts (Tolstoy, Chekhov) from Russian Wikisource, at the revisions in curated/literature.yaml.
  ...LITERATURE.flatMap((w) => (w.pages ? w.pages.map((_, i) => ({ file: literatureFile(w, i), url: literatureUrl(w, i) })) : [{ file: literatureFile(w), url: literatureUrl(w) }])),
];
