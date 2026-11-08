/**
 * Fetches native recordings into the cache (audio-raw/), politely and within a time budget, most useful first.
 * Run `npm run data:build` first: it writes audio-raw/wanted.json. Then run the data build again to publish them.
 *
 *   npm run audio:fetch                  up to 40 minutes
 *   npm run audio:fetch -- --minutes 5
 *
 * Neither Commons nor Tatoeba has a bulk download, so files come one by one: Commons at about one a second (faster
 * gets rate-limited), Tatoeba one at a time (its server takes a few seconds a file). The two run side by side. What's
 * already cached is never fetched again; a cache built up over several runs is the normal case.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { COMMONS_FILE, WANTED_FILE, commonsLicenceOk, rawSentencePath, rawWordPath, type CommonsInfo, type Wanted } from './lib/audio.ts';

const arg = process.argv.indexOf('--minutes');
const minutes = arg > 0 ? Number(process.argv[arg + 1]) : 40;
const deadline = Date.now() + minutes * 60_000;
const UA = { 'User-Agent': 'KrotikDataBuild/1.0 (https://github.com/will-corbett/Krotik; one request at a time)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const timeLeft = () => Date.now() < deadline;

if (!existsSync(WANTED_FILE)) throw new Error(`${WANTED_FILE} missing — run npm run data:build first`);
const wanted = JSON.parse(readFileSync(WANTED_FILE, 'utf8')) as Wanted;
const commons: Record<string, CommonsInfo> = existsSync(COMMONS_FILE) ? JSON.parse(readFileSync(COMMONS_FILE, 'utf8')) : {};
// Entries without a licence (from an interrupted or older run) are asked for again.
for (const [k, v] of Object.entries(commons)) if (v && (typeof v.licence !== 'string' || typeof v.credit !== 'string')) delete commons[k];
// Sorted by file name, so the cache file is stable.
const saveCommons = () => writeFileSync(COMMONS_FILE, JSON.stringify(Object.fromEntries(Object.entries(commons).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))));

/** GET with retries; waits as asked on 429/503. Returns null on 404 or after the retries. */
async function get(url: string, json = false): Promise<Buffer | unknown | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get('retry-after')) || 30;
        console.log(`  ${res.status}: waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.log(`  ${url.slice(0, 90)}: ${(e as Error).message}, retrying`);
      await sleep(5000 * (attempt + 1));
    }
  }
  return null;
}

/** An MP3 starts with an ID3 tag or an MPEG frame sync; anything else (an HTML error page) isn't kept. */
const isMp3 = (b: Buffer) => b.length > 1000 && (b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0));

function save(path: string, b: Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path + '.part', b);
  renameSync(path + '.part', path);
}

async function commonsWorker(): Promise<number> {
  // Licence details first, 50 files a request; then the files whose licence we can use.
  const unknown = wanted.words.map((w) => w.file).filter((f) => commons[f] === undefined);
  for (let i = 0; i < unknown.length && timeLeft(); i += 50) {
    const batch = unknown.slice(i, i + 50);
    // extmetadata is costly, so the API may answer for only some files and say how to continue: follow it.
    let cont: Record<string, string> = {};
    for (let page = 0; page < 20; page++) {
      const url =
        'https://commons.wikimedia.org/w/api.php?' +
        new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit', titles: batch.map((f) => `File:${f}`).join('|'), ...cont });
      const d = (await get(url, true)) as {
        continue?: Record<string, string>;
        query?: { normalized?: { from: string; to: string }[]; pages: { title: string; missing?: boolean; imageinfo?: { extmetadata?: Record<string, { value: string }> }[] }[] };
      } | null;
      if (!d?.query) break;
      const back = new Map((d.query.normalized ?? []).map((n) => [n.to, n.from]));
      for (const p of d.query.pages) {
        const file = (back.get(p.title) ?? p.title).replace(/^File:/, '');
        const m = p.imageinfo?.[0]?.extmetadata;
        // Gone from Commons: null. Not answered in this part of the reply: left for the next part (or the next run).
        if (p.missing) commons[file] = null;
        else if (m) commons[file] = { licence: m.LicenseShortName?.value ?? '', licenceUrl: m.LicenseUrl?.value ?? '', artist: m.Artist?.value ?? '', credit: m.Credit?.value ?? '' };
      }
      if (!d.continue) break;
      cont = d.continue;
      await sleep(1000);
    }
    saveCommons();
    await sleep(1000);
  }
  let n = 0;
  for (const w of wanted.words) {
    if (!timeLeft()) break;
    const info = commons[w.file];
    if (!info || !commonsLicenceOk(info.licence) || existsSync(rawWordPath(w.file))) continue;
    const b = (await get(w.mp3)) as Buffer | null;
    if (b && isMp3(b)) {
      save(rawWordPath(w.file), b);
      n++;
    }
    await sleep(700);
  }
  return n;
}

async function tatoebaWorker(): Promise<number> {
  let n = 0;
  for (const s of wanted.sentences) {
    if (!timeLeft()) break;
    if (existsSync(rawSentencePath(s.audio))) continue;
    const b = (await get(`https://tatoeba.org/en/audio/download/${s.audio}`)) as Buffer | null;
    if (b && isMp3(b)) {
      save(rawSentencePath(s.audio), b);
      n++;
      if (n % 50 === 0) console.log(`  Tatoeba: ${n} fetched`);
    }
    await sleep(300);
  }
  return n;
}

const [words, sentences] = await Promise.all([commonsWorker(), tatoebaWorker()]);
const have = (xs: string[]) => xs.filter(existsSync).length;
const wordsHave = have(wanted.words.map((w) => rawWordPath(w.file)));
const sentencesHave = have(wanted.sentences.map((s) => rawSentencePath(s.audio)));
console.log(`fetched ${words} word and ${sentences} sentence recordings; cached ${wordsHave}/${wanted.words.length} words, ${sentencesHave}/${wanted.sentences.length} sentences`);
// For CI: whether anything new arrived (the audio workflow then saves the cache and redeploys).
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `fetched=${words + sentences}\n`, { flag: 'a' });
