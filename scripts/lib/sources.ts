import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export const RAW_DIR = 'data-raw';

/** Public-domain literature (curated/literature.yaml), each text at a fixed Wikisource revision. */
export interface LiteratureWork {
  id: string;
  author: string;
  authorEn: string;
  died: number;
  title: string;
  titleEn: string;
  year: number;
  page: string;
  revision: number;
  kind: 'stories' | 'play';
  level: [string, string];
}
const literatureYaml = parse(readFileSync('curated/literature.yaml', 'utf8')) as { works: LiteratureWork[]; notOld?: Record<string, string>; glosses?: Record<string, string> };
/** English meanings written by hand for words in the texts that neither our data nor Wiktionary has. */
export const LITERATURE_GLOSSES = literatureYaml.glosses ?? {};
export const LITERATURE = literatureYaml.works;
/** Words Wiktionary mis-tags as old, each with the reason (curated/literature.yaml). */
export const LITERATURE_NOT_OLD = literatureYaml.notOld ?? {};
export const literatureFile = (w: LiteratureWork) => `literature-${w.id}.wiki`;
export const literatureUrl = (w: LiteratureWork) => `https://ru.wikisource.org/w/index.php?oldid=${w.revision}&action=raw`;

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
  // Wiktionary via kaikki.org (CC BY-SA 4.0 / GFDL, as Wiktionary): participles, verbal adverbs,
  // numerals, diminutives, noun gender. 91 MB gzipped (~950 MB uncompressed), streamed.
  { file: 'kaikki-russian.jsonl.gz', url: 'https://kaikki.org/dictionary/Russian/kaikki.org-dictionary-Russian.jsonl.gz' },
  // Independent frequency list (OpenSubtitles 2018 word forms). Build-time check only; not shipped.
  {
    file: 'ru_50k.txt',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt',
  },
  // Public-domain texts (Tolstoy, Chekhov) from Russian Wikisource, at the revisions in curated/literature.yaml.
  ...LITERATURE.map((w) => ({ file: literatureFile(w), url: literatureUrl(w) })),
];
