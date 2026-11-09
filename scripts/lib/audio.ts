/**
 * Native recordings (critique batch 3): words from Wikimedia Commons (found through Wiktionary) and sentences from
 * Tatoeba. Only recordings whose own licence allows commercial use (CC0, CC BY, CC BY-SA, public domain) are used, and
 * every one is credited.
 *
 * The recordings are fetched one by one (neither site has a bulk download), so `npm run audio:fetch` fills a cache
 * (`audio-raw/`, gitignored, kept between CI runs) a little at a time, and the data build packs whatever is cached:
 *   1. the data build writes `audio-raw/wanted.json`: the recordings we'd like, most useful first;
 *   2. `npm run audio:fetch` fetches licence details (Commons) and files, within a time budget;
 *   3. the next data build copies the cached, licensed files to `public/audio/` and lists them in `audio.json`.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AudioIndex } from '../../src/shared/types.ts';
import type { Report } from './report.ts';

export const AUDIO_RAW = 'audio-raw';
export const AUDIO_OUT = 'public/audio';
export const WANTED_FILE = join(AUDIO_RAW, 'wanted.json');
export const COMMONS_FILE = join(AUDIO_RAW, 'commons.json');
const R = 'Recordings';

/** A word recording we'd like: the word list key, the Commons file and its MP3 address. */
export interface WantedWord {
  key: string;
  file: string;
  mp3: string;
}
/** A sentence recording we'd like: the Tatoeba sentence id, its audio id, the reader and the licence. */
export interface WantedSentence {
  rid: number;
  audio: number;
  user: string;
  licence: string;
  url: string;
}
export interface Wanted {
  words: WantedWord[];
  sentences: WantedSentence[];
}
/** Licence details for a Commons file, as the Commons API gives them; `null` = the file isn't there any more. */
export type CommonsInfo = { licence: string; licenceUrl: string; artist: string; credit: string } | null;

/** Where a cached file lives. Word files are named by a hash of the Commons title (titles are Cyrillic). */
export const wordFile = (commonsFile: string) => `${createHash('sha1').update(commonsFile).digest('hex').slice(0, 12)}.mp3`;
export const rawWordPath = (commonsFile: string) => join(AUDIO_RAW, 'w', wordFile(commonsFile));
export const rawSentencePath = (audioId: number) => join(AUDIO_RAW, 's', `${audioId}.mp3`);

/** Tatoeba licences we can use commercially. (CC BY-NC, CC BY-NC-ND and recordings with no licence are left out.) */
export const TATOEBA_OK = new Set(['CC BY 4.0', 'CC0 1.0']);
const TATOEBA_LICENCE_URL: Record<string, string> = { 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/', 'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/' };
/** Commons licences we can use commercially: CC0, public domain, CC BY and CC BY-SA (any version). */
export function commonsLicenceOk(licence: string): boolean {
  const l = licence.replace(/-/g, ' ').toUpperCase();
  if (/\bNC\b|\bND\b/.test(l)) return false;
  return /^(CC0|PUBLIC DOMAIN|PD\b|CC BY( SA)? \d)/.test(l);
}

/** Up to this many words: sentences longer than this are hard to take in by ear at the levels we teach. */
export const MAX_SENTENCE_WORDS = 10;
const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

/**
 * The recordings we'd like, most useful first (the fetch stops when its time is up, so order matters):
 * words in the Vocabulary themes, then the most common words of each type; sentences shortest first.
 */
export function wantedAudio(inp: {
  /** word list rows in priority order: [key, accented, bare] */
  words: { key: string; accented: string; bare: string }[];
  /** Wiktionary's Commons recordings by headword */
  commons: Record<string, [string, string, string][]>;
  /** the filtered corpus: sentences with an English translation */
  pairs: { rid: number; ru: string }[];
  tatoeba: { rid: number; audio: number; user: string; licence: string; url: string }[];
  report: Report;
}): Wanted {
  const words: WantedWord[] = [];
  const seenKey = new Set<string>();
  for (const w of inp.words) {
    if (seenKey.has(w.key)) continue;
    seenKey.add(w.key);
    // Only a recording of exactly this word with this stress (Wiktionary's stressed headword = our accented form).
    const files = (inp.commons[w.bare] ?? []).filter(([canon]) => canon === w.accented);
    if (!files.length) {
      inp.report.count(R, 'wanted words with no Commons recording of that stress');
      continue;
    }
    // Prefer the older Ru- recordings (made for Wiktionary, clean), then Lingua Libre's; then by name.
    const [, file, mp3] = [...files].sort(([, a], [, b]) => Number(a.startsWith('LL-')) - Number(b.startsWith('LL-')) || (a < b ? -1 : 1))[0]!;
    words.push({ key: w.key, file, mp3 });
  }
  const recorded = new Map<number, (typeof inp.tatoeba)[number]>();
  for (const t of inp.tatoeba) {
    if (!TATOEBA_OK.has(t.licence)) continue;
    // A sentence recorded twice: the first recording listed.
    if (!recorded.has(t.rid)) recorded.set(t.rid, t);
  }
  const sentences = inp.pairs
    .map((p) => ({ p, n: [...p.ru.matchAll(TOKEN)].length, t: recorded.get(p.rid) }))
    .filter((x) => x.t && x.n >= 1 && x.n <= MAX_SENTENCE_WORDS)
    .sort((a, b) => a.n - b.n || a.p.rid - b.p.rid)
    .map(({ p, t }) => ({ rid: p.rid, audio: t!.audio, user: t!.user, licence: t!.licence, url: t!.url }));
  inp.report.count(R, 'word recordings wanted (Commons)', words.length);
  inp.report.count(R, `sentence recordings wanted (Tatoeba, CC BY / CC0, up to ${MAX_SENTENCE_WORDS} words, with English)`, sentences.length);
  return { words, sentences };
}

/**
 * Who to credit, from Commons' "Artist" or "Credit" HTML: Lingua Libre lists "Speaker: … Recorder: …" (the speaker is
 * credited); "Audio sample provided by The Shtooka Project." gives the project. Null when there's no one named.
 */
export function commonsAuthor(html: string): { name: string; link: string | null } | null {
  if (!html.trim()) return null;
  const speaker = /Speaker:\s*(<a [^>]*>[^<]*<\/a>|[^<\n]+)/.exec(html)?.[1];
  const part = speaker ?? html;
  const provided = /provided by\s*(.*?)\.?\s*$/s.exec(plainArtist(part));
  const name = (provided ? provided[1]! : plainArtist(part)).trim();
  return name ? { name, link: artistLink(part) } : null;
}

/** The first link in Commons' "Artist" HTML (the person's user page), made absolute. */
export function artistLink(html: string): string | null {
  const m = /href="([^"]+)"/.exec(html);
  if (!m) return null;
  const h = m[1]!.replace(/&amp;/g, '&');
  return h.startsWith('//') ? `https:${h}` : h.startsWith('/') ? `https://commons.wikimedia.org${h}` : /^https?:/.test(h) ? h : null;
}

/** Commons "Artist" is HTML: the text only. */
export function plainArtist(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Copies the cached, licensed recordings to public/audio/ and returns the index the app loads (audio.json). What
 * isn't cached yet is simply left out: the app falls back to the device's voice, and listening drills use what's there.
 */
export function packAudio(wanted: Wanted, report: Report): AudioIndex {
  // public/audio is synced, not deleted and rebuilt: copy what's new or changed, then remove what's no longer wanted
  // (deleting the folder races with a dev server watching public/).
  mkdirSync(join(AUDIO_OUT, 'w'), { recursive: true });
  mkdirSync(join(AUDIO_OUT, 's'), { recursive: true });
  const kept = new Set<string>();
  const put = (from: string, to: string) => {
    kept.add(to);
    if (!existsSync(to) || statSync(to).size !== statSync(from).size) copyFileSync(from, to);
  };
  const commons: Record<string, CommonsInfo> = existsSync(COMMONS_FILE) ? JSON.parse(readFileSync(COMMONS_FILE, 'utf8')) : {};
  const index: AudioIndex = { credits: [], words: {}, sentences: {} };
  const creditIds = new Map<string, number>();
  const credit = (c: AudioIndex['credits'][number]) => {
    const k = JSON.stringify(c);
    if (!creditIds.has(k)) {
      creditIds.set(k, index.credits.length);
      index.credits.push(c);
    }
    return creditIds.get(k)!;
  };
  for (const w of wanted.words) {
    const info = commons[w.file];
    if (info === undefined || (info && typeof info.credit !== 'string') || !existsSync(rawWordPath(w.file))) {
      report.count(R, 'word recordings not fetched yet');
      continue;
    }
    if (info === null || !commonsLicenceOk(info.licence)) {
      report.count(R, 'word recordings left out: licence not usable commercially (or file gone)');
      if (info) report.anomaly(R, 'Commons recordings left out for their licence', `${w.file}: ${info.licence}`);
      continue;
    }
    const out = wordFile(w.file);
    put(rawWordPath(w.file), join(AUDIO_OUT, 'w', out));
    // Credited to the author (Commons "Artist"; for Lingua Libre recordings, the speaker), else to whoever Commons
    // credits (the Shtooka Project), linking to their page; failing both, to the file's page.
    const filePage = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(w.file.replace(/ /g, '_'))}`;
    const who = commonsAuthor(info.artist) ?? commonsAuthor(info.credit);
    if (!who) report.anomaly(R, 'Commons recordings with no author or credit (credited to the file page)', w.file);
    index.words[w.key] = [out.replace(/\.mp3$/, ''), credit([who?.name ?? 'Wikimedia Commons contributor', info.licence, who?.link ?? filePage, 'commons', info.licenceUrl])];
  }
  for (const s of wanted.sentences) {
    if (!existsSync(rawSentencePath(s.audio))) {
      report.count(R, 'sentence recordings not fetched yet');
      continue;
    }
    put(rawSentencePath(s.audio), join(AUDIO_OUT, 's', `${s.rid}.mp3`));
    index.sentences[s.rid] = credit([s.user, s.licence, s.url || `https://tatoeba.org/user/profile/${encodeURIComponent(s.user)}`, 'tatoeba', TATOEBA_LICENCE_URL[s.licence]!]);
  }
  for (const dir of ['w', 's']) for (const f of readdirSync(join(AUDIO_OUT, dir))) if (!kept.has(join(AUDIO_OUT, dir, f))) rmSync(join(AUDIO_OUT, dir, f), { force: true });
  report.count(R, 'word recordings published', Object.keys(index.words).length);
  report.count(R, 'sentence recordings published', Object.keys(index.sentences).length);
  report.count(R, 'people credited', index.credits.length);
  return index;
}

export function writeWanted(w: Wanted): void {
  mkdirSync(AUDIO_RAW, { recursive: true });
  writeFileSync(WANTED_FILE, JSON.stringify(w));
}
