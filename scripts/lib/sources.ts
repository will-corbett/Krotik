export const RAW_DIR = 'data-raw';

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
  // Independent frequency list (OpenSubtitles 2018 word forms). Build-time check only; not shipped.
  {
    file: 'ru_50k.txt',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt',
  },
] as const;
