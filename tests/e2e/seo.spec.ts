/** Real addresses and the prerendered HTML (scripts/prerender.ts), as a search engine sees it: no JavaScript. */
import { expect, test } from '@playwright/test';

test('each page is its own HTML file with title, description, canonical address and text', async ({ request }) => {
  const res = await request.get('learn/aspect/');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('<title>Aspect partners (видовые пары): Russian grammar explained | Krotik</title>');
  expect(html).toContain('<link rel="canonical" href="https://will-corbett.github.io/Krotik/learn/aspect/" />');
  expect(html).toMatch(/<meta name="description" content="Most Russian verbs come in pairs/);
  expect(html).toContain('<h2>What each aspect says</h2>');
  expect(html).not.toContain('name="robots"');
  // Real example sentences are in the page itself, with their Tatoeba links.
  const ro = await (await request.get('learn/reportedSpeech/')).text();
  expect(ro).toContain('Tatoeba #3769451');
  // …and the pages carry the data credits, as the app's footer does.
  expect(ro).toMatch(/Wiktionary<\/a> via kaikki\.org \(CC BY-SA 4\.0\).*Tatoeba<\/a> \(CC BY 2\.0 FR\)/);
});

test('drill pages exist but are kept out of search results; the sitemap lists the pages worth finding', async ({ request }) => {
  const drill = await (await request.get('drill/verbs/')).text();
  expect(drill).toContain('<meta name="robots" content="noindex" />');
  const sitemap = await (await request.get('sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://will-corbett.github.io/Krotik/learn/wordOrder/</loc>');
  expect(sitemap).toContain('<loc>https://will-corbett.github.io/Krotik/culture/names/</loc>');
  expect(sitemap).not.toContain('/drill/verbs/');
});

test('the app replaces the prerendered copy, and page titles follow you around', async ({ page }) => {
  await page.goto('learn/aspect/');
  await expect(page.locator('.prerendered')).toHaveCount(0);
  await expect(page.locator('.drill-cta')).toBeVisible();
  await page.getByRole('link', { name: /Next →/ }).click();
  await expect(page).toHaveURL(/\/Krotik\/learn\/motion\/$/);
  await expect(page).toHaveTitle('Motion verbs (глаголы движения): Russian grammar explained | Krotik');
});

test('old #/ links still work: they move to the real address', async ({ page }) => {
  await page.goto('./#/learn/government');
  await expect(page).toHaveURL(/\/Krotik\/learn\/government\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Verb government');
  // …and so does an old link followed on a page that's already open.
  await page.evaluate(() => (location.hash = '#/culture'));
  await expect(page).toHaveURL(/\/Krotik\/culture\/$/);
});
