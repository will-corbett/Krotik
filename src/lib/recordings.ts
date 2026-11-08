/**
 * Native recordings hosted with the site (public/audio/, listed in audio.json): Wikimedia Commons word recordings and
 * Tatoeba sentence recordings, each credited. Nothing is fetched from anywhere else; where there's no recording, "Hear
 * it" falls back to the device's own voice (speech.ts).
 */
import type { AudioIndex } from '../shared/types.ts';
import { loadAudioIndex } from './data.ts';
import { speak } from './speech.ts';

const AUDIO = `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'}audio/`;

export interface Credit {
  name: string;
  licence: string;
  url: string;
  source: 'commons' | 'tatoeba';
  licenceUrl: string;
}
export interface Recording {
  url: string;
  credit: Credit;
}

let index: AudioIndex | null = null;
let loading: Promise<AudioIndex | null> | null = null;
/** The index, or null when it couldn't be loaded (then everything falls back to the device voice). */
export function audioIndex(): Promise<AudioIndex | null> {
  if (index) return Promise.resolve(index);
  loading ??= loadAudioIndex()
    .then((i) => (index = i))
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

const credit = (i: AudioIndex, n: number): Credit => {
  const [name, licence, url, source, licenceUrl] = i.credits[n]!;
  return { name, licence, url, source, licenceUrl };
};
export function wordRecordingFrom(i: AudioIndex | null, key: string): Recording | null {
  const w = i?.words[key];
  return w ? { url: `${AUDIO}w/${w[0]}.mp3`, credit: credit(i!, w[1]) } : null;
}
export function sentenceRecordingFrom(i: AudioIndex | null, rid: number): Recording | null {
  const c = i?.sentences[rid];
  return c === undefined ? null : { url: `${AUDIO}s/${rid}.mp3`, credit: credit(i!, c) };
}

/** One player for the whole page, so a new sound stops the last one. */
let player: HTMLAudioElement | null = null;
/** Starts a recording (slower on request); resolves once it's playing, rejects if it can't be played. */
export function play(url: string, rate = 1): Promise<void> {
  player?.pause();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  const a = new Audio(url);
  a.playbackRate = rate;
  // Slower speech keeps its pitch (the default in current browsers).
  a.preservesPitch = true;
  player = a;
  return a.play();
}
export function stopPlaying(): void {
  player?.pause();
}

/** The recording of a word (list key) or a Tatoeba sentence, if the site has one. */
export async function recordingFor(where: { key?: string; rid?: number }): Promise<Recording | null> {
  const i = await audioIndex();
  return where.rid !== undefined ? sentenceRecordingFrom(i, where.rid) : where.key ? wordRecordingFrom(i, where.key) : null;
}
/** Plays the recording if there is one, else says the text with the device voice. Returns the credit, if any. */
export async function hear(text: string, where: { key?: string; rid?: number }): Promise<Credit | null> {
  const rec = await recordingFor(where);
  if (rec) {
    try {
      await play(rec.url);
      return rec.credit;
    } catch {
      // A file that won't play: the device voice instead.
    }
  }
  speak(text);
  return null;
}

export const sourceName = (c: Pick<Credit, 'source'>) => (c.source === 'tatoeba' ? 'Tatoeba' : 'Wikimedia Commons');
