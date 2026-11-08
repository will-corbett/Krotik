/** Reading: real texts with every word explained (hover, tap, keyboard), then comprehension questions. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { goTo } from './helpers.ts';
import type { Page } from '@playwright/test';

/** Open a text and wait until its words are laid out: web fonts load late on slow machines and reflow the text, so
 * a tap measured before then can land between words. */
async function openText(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('.text button.w').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test('the Reading page lists Tolstoy stories, Chekhov scenes and stories, and news, from the menu', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'Reading');
  await expect(page).toHaveURL(/\/Krotik\/reading\/$/);
  await expect(page.getByRole('heading', { name: /Лев Толстой/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Антон Чехов, «Медведь»/ })).toBeVisible();
  await page.getByRole('link', { name: 'Акула' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Акула');
  await expect(page).toHaveTitle(/Акула/);
});

test('hovering or tapping a word shows its dictionary form, meaning and form', async ({ page }) => {
  await openText(page, 'reading/akula/');
  const word = page.locator('button.w', { hasText: /^корабль$/ }).first();
  if (test.info().project.name === 'mobile') await word.tap();
  else await word.hover();
  const pop = page.getByRole('tooltip');
  await expect(pop).toContainText('кора́бль');
  await expect(pop).toContainText('ship');
  await expect(pop).toContainText('nominative singular');
  // A word at the left edge of a phone screen keeps its box on screen.
  await openText(page, 'reading/predlozhenie-6/');
  await page.locator('button.w', { hasText: /^подуздоват$/ }).first().click();
  const box = (await page.getByRole('tooltip').boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});

test('old-fashioned words, the polite -с and names are labelled', async ({ page }) => {
  await openText(page, 'reading/medved-1/');
  await page.locator('button.w', { hasText: /^ежели$/ }).first().click();
  await expect(page.getByRole('tooltip')).toContainText('Old-fashioned');
  await page.locator('button.w', { hasText: /^Слушаю-с$/ }).first().click();
  await expect(page.getByRole('tooltip')).toContainText('polite -с');
  await page.locator('.text button.w', { hasText: /^Лука$/ }).first().click();
  await expect(page.getByRole('tooltip')).toContainText('a name');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Медведь: явление I');
});

test('keyboard: one Tab stop for the text, arrow keys move from word to word and show each one', async ({ page }) => {
  await openText(page, 'reading/akula/');
  const words = page.locator('.text button.w');
  await words.first().focus();
  await expect(page.getByRole('tooltip')).toContainText('наш');
  await page.keyboard.press('ArrowRight');
  await expect(words.nth(1)).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('ship');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  // Only the current word is in the Tab order.
  expect(await words.evaluateAll((bs) => bs.filter((b) => (b as HTMLElement).tabIndex === 0).length)).toBe(1);
});

test('questions: in Russian by default; answer, check, see the right answers; switch to English; try again', async ({ page }) => {
  await openText(page, 'reading/akula/');
  const check = page.getByRole('button', { name: 'Check answers' });
  await expect(check).toBeDisabled();
  const groups = page.locator('.questions fieldset');
  const n = await groups.count();
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole('radio').first().check();
  await check.click();
  await expect(page.getByRole('status')).toContainText(`of ${n} right`);
  await expect(page.locator('.opt.right')).toHaveCount(n);
  await expect(groups.first().locator('legend')).toContainText('Где плавали мальчики');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(groups.first().locator('legend')).toContainText('Where were the two boys swimming');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(check).toBeDisabled();
  // The choice of language is remembered.
  await page.reload();
  await expect(page.locator('.questions fieldset legend').first()).toContainText('Where were the two boys swimming');
});

test('each text page is prerendered with its full text for search engines', async ({ request }) => {
  const html = await (await request.get('reading/lev-i-sobachka/')).text();
  expect(html).toContain('<title>Лев и собачка: read with every word explained | Krotik</title>');
  expect(html).toContain('Собачка поджала хвост');
  const sitemap = await (await request.get('sitemap.xml')).text();
  expect(sitemap).toContain('/reading/predlozhenie-6/');
});

for (const theme of ['krotik', 'light', 'dark'] as const) {
  test(`no axe violations on Reading, with a word open and questions checked (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
    await page.goto('./');
    await page.getByLabel('Theme').selectOption(theme === 'krotik' ? 'krotik' : 'system');
    const scan = async (where: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${where} ${v.id}: ${v.nodes.map((x) => x.target).join(' ')}`)).toEqual([]);
    };
    await page.goto('reading/');
    await expect(page.locator('main')).not.toContainText('Loading…');
    await scan('index');
    await openText(page, 'reading/medved-1/');
    await page.locator('button.w', { hasText: /^ежели$/ }).first().click();
    await scan('text, word open');
    const groups = page.locator('.questions fieldset');
    for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Check answers' }).click();
    await scan('questions checked');
  });
}

test('batch 4: Chekhov stories and Wikinews science news, each credited; B2 questions read between the lines', async ({ page }) => {
  await page.goto('reading/');
  await expect(page.getByRole('heading', { name: /Антон Чехов, «Рассказы»/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Новости науки/ })).toBeVisible();
  // A story: credited with its own title and year, public domain.
  await openText(page, 'reading/khameleon/');
  await expect(page.locator('article .credit')).toContainText('Антон Чехов, «Хамелеон» (1884). Public domain');
  await expect(page.getByText('между строк')).toBeVisible();
  await expect(page.getByText('тон', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Reading between the lines')).toBeVisible();
  // A made-up surname is a name, with a note on what it's made from.
  await openText(page, 'reading/loshadinaya-familiya/');
  await page.locator('.text button.w', { hasText: /^Кобылин\?$|^Кобылин$/ }).first().click();
  await expect(page.getByRole('tooltip')).toContainText('a name');
  await expect(page.getByRole('tooltip')).toContainText('mare');
  // A news article: Wikinews contributors, CC BY 4.0, linked to the revision used.
  await openText(page, 'reading/tri-obitaemye-planety/');
  await expect(page.locator('article .credit')).toContainText('20 апреля 2013');
  await expect(page.getByRole('link', { name: 'Wikinews contributors, CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
  await expect(page.getByRole('link', { name: 'Russian Wikinews' })).toHaveAttribute('href', /ru\.wikinews\.org\/w\/index\.php\?oldid=\d+$/);
});
