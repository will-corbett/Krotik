/**
 * Downloads raw source data into data-raw/ (gitignored) and records provenance
 * (URL, byte size, sha256, fetch date) in data-raw/sources.json. Streams to disk, so the
 * ~950 MB Wiktionary dump never sits in memory.
 *
 *   npm run data:fetch            fetch anything missing
 *   npm run data:fetch -- --force re-download everything
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { RAW_DIR, SOURCES } from './lib/sources.ts';

const force = process.argv.includes('--force');
mkdirSync(RAW_DIR, { recursive: true });

const manifestPath = join(RAW_DIR, 'sources.json');
const manifest: Record<string, { url: string; bytes: number; sha256: string; fetched: string }> =
  existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

async function sha256(path: string): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('hex');
}

for (const src of SOURCES) {
  const dest = join(RAW_DIR, src.file);
  if (!force && existsSync(dest) && manifest[src.file]) {
    console.log(`have   ${src.file}`);
    continue;
  }
  if (!force && existsSync(dest)) {
    // Downloaded by hand / interrupted bookkeeping: record it rather than download again.
    manifest[src.file] = { url: src.url, bytes: statSync(dest).size, sha256: await sha256(dest), fetched: statSync(dest).mtime.toISOString() };
    console.log(`record ${src.file}`);
    continue;
  }
  process.stdout.write(`fetch  ${src.file} … `);
  const res = await fetch(src.url, { headers: { 'User-Agent': 'krotik-data-pipeline (https://github.com/will-corbett/Krotik)' } });
  if (!res.ok || !res.body) throw new Error(`${src.url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as ReadableStream), createWriteStream(dest + '.part'));
  renameSync(dest + '.part', dest);
  manifest[src.file] = { url: src.url, bytes: statSync(dest).size, sha256: await sha256(dest), fetched: new Date().toISOString() };
  console.log(`${(manifest[src.file]!.bytes / 1e6).toFixed(1)} MB`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
