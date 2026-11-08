/**
 * Tatoeba's list of recorded sentences (who recorded each, under what licence). Kept apart from audio.ts so the unit
 * tests (type-checked by svelte-check) needn't import the bzip2 stream, which has no type declarations there.
 */
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import bz2 from 'unbzip2-stream';
import { RAW_DIR } from './sources.ts';

/** The one file in Tatoeba's sentences_with_audio.tar.bz2, as rows: sentence id, audio id, user, licence, attribution. */
export async function readTatoebaAudio(): Promise<{ rid: number; audio: number; user: string; licence: string; url: string }[]> {
  // unbzip2-stream is an old-style stream (not async-iterable): collect it with events.
  const tar = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(join(RAW_DIR, 'sentences_with_audio.tar.bz2'))
      .pipe(bz2())
      .on('data', (c: Buffer) => chunks.push(c))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
  // A tar archive: a 512-byte header (size in octal at 124), then the file, padded to 512 bytes.
  const size = parseInt(tar.subarray(124, 136).toString('ascii').replace(/\0/g, '').trim(), 8);
  const text = tar.subarray(512, 512 + size).toString('utf8');
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'))
    .map(([rid, audio, user, licence, url]) => ({ rid: Number(rid), audio: Number(audio), user: user ?? '', licence: licence ?? '', url: url && url !== '\\N' ? url : '' }));
}
