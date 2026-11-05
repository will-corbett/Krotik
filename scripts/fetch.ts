/**
 * Downloads raw source data into data-raw/ (gitignored) and records provenance
 * (URL, byte size, sha256, fetch date) in data-raw/sources.json.
 *
 *   npm run data:fetch            fetch anything missing
 *   npm run data:fetch -- --force re-download everything
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_DIR, SOURCES } from './lib/sources.ts';

const force = process.argv.includes('--force');
mkdirSync(RAW_DIR, { recursive: true });

const manifestPath = join(RAW_DIR, 'sources.json');
const manifest: Record<string, { url: string; bytes: number; sha256: string; fetched: string }> =
  existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

for (const src of SOURCES) {
  const dest = join(RAW_DIR, src.file);
  if (!force && existsSync(dest) && manifest[src.file]) {
    console.log(`have   ${src.file}`);
    continue;
  }
  process.stdout.write(`fetch  ${src.file} … `);
  const res = await fetch(src.url, { headers: { 'User-Agent': 'drilbur-data-pipeline' } });
  if (!res.ok) throw new Error(`${src.url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  manifest[src.file] = {
    url: src.url,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    fetched: new Date().toISOString(),
  };
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
