/**
 * Check every Culture link still answers (npm run links:check; monthly in CI).
 * A dead link (404/410, DNS failure, or a YouTube channel that no longer exists) fails the run.
 * Sites behind bot protection answer automated requests with 401/403/429; those are listed as
 * "couldn't check" and should be opened by hand, but don't fail the run.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

interface Link { title: string; url: string }
const links = parse(readFileSync('content/culture/links.yaml', 'utf8')) as Link[];
const UA = 'Mozilla/5.0 (compatible; krotik-link-check)';

async function check(l: Link): Promise<{ l: Link; status: 'ok' | 'dead' | 'unchecked'; detail: string }> {
  try {
    const res = await fetch(l.url, { redirect: 'follow', headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(30_000) });
    if ([401, 403, 429].includes(res.status)) return { l, status: 'unchecked', detail: `HTTP ${res.status} (bot protection?)` };
    if (!res.ok) return { l, status: 'dead', detail: `HTTP ${res.status}` };
    // YouTube answers 200 with an error page for some removed channels: the channel's own name must be in the page.
    if (/youtube\.com\/@/.test(l.url)) {
      const html = await res.text();
      if (!/"channelMetadataRenderer"/.test(html)) return { l, status: 'dead', detail: 'YouTube channel page without channel data' };
    }
    return { l, status: 'ok', detail: `HTTP ${res.status}` };
  } catch (e) {
    return { l, status: 'dead', detail: e instanceof Error ? e.message : String(e) };
  }
}

const results: Awaited<ReturnType<typeof check>>[] = [];
for (let i = 0; i < links.length; i += 6) results.push(...(await Promise.all(links.slice(i, i + 6).map(check))));
const dead = results.filter((r) => r.status === 'dead');
const unchecked = results.filter((r) => r.status === 'unchecked');
console.log(`${results.length} links: ${results.length - dead.length - unchecked.length} ok, ${unchecked.length} couldn't be checked, ${dead.length} dead`);
for (const r of unchecked) console.log(`  ? ${r.l.title} — ${r.l.url} — ${r.detail}`);
for (const r of dead) console.log(`  ✗ ${r.l.title} — ${r.l.url} — ${r.detail}`);
if (dead.length) process.exit(1);
