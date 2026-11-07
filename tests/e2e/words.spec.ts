/** The Words section: themes by level, a theme's words, sentences, dialogues (once reviewed) and practice. */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { goTo } from './helpers.ts';
import type { ThemeData } from '../../src/shared/types.ts';

/** Serve the Food theme with one reviewed dialogue (the real data has none reviewed yet). */
async function withDialogue(page: Page) {
  const t = JSON.parse(readFileSync('public/data/theme.food.json', 'utf8')) as ThemeData;
  t.dialogues = [{ title: 'Breakfast', reviewed: 'Test reviewer, 2026-11-08', lines: [['Мама', 'Хлеб с маслом.', 0], ['Сын', 'Спасибо!', 0]], en: ['Bread and butter.', 'Thanks!'] }];
  t.words = { хлеб: [["хлеб", 'bread', 'nominative singular', '', 'n:227', 0]], с: [['с', 'with', '', '']], маслом: [["ма'сло", 'butter, oil', 'instrumental singular', '']], спасибо: [["спаси'бо", 'thanks', '', '']] };
  t.drafts = 1;
  await page.route('**/data/theme.food.json', (route) => route.fulfill({ json: t }));
}

test('Words is in the menu and on the home page; themes are grouped by level', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /^Words/ })).toBeVisible();
  await goTo(page, 'Words');
  await expect(page).toHaveURL(/\/Krotik\/words\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Words');
  for (const lvl of ['A1', 'A2', 'B1']) await expect(page.getByRole('heading', { name: lvl, exact: true })).toBeVisible();
  await expect(page.locator('a.theme')).toHaveCount(16);
  await page.getByRole('link', { name: /Food and drink/ }).click();
  await expect(page).toHaveURL(/\/words\/food\/$/);
  await expect(page).toHaveTitle(/Food and drink/);
});

test('a theme: its words with gender or aspect and meaning, a real sentence for each, dialogues waiting for review', async ({ page }) => {
  await page.goto('words/food/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Еда и напитки');
  const bread = page.locator('.words li', { hasText: 'хлеб' }).first();
  await expect(bread).toContainText('masculine');
  await expect(bread).toContainText('bread');
  await expect(page.locator('.words li', { hasText: /^есть/ })).toContainText('imperfective');
  await expect(page.locator('.uses li').first()).toContainText('Tatoeba #');
  await expect(page.getByText(/waiting for a native speaker's check/)).toBeVisible();
  // Nothing unreviewed is ever served.
  const data = await page.evaluate(() => fetch(`${location.pathname.replace(/words\/food\/$/, '')}data/theme.food.json`).then((r) => r.json()));
  expect(data.dialogues).toEqual([]);
  // No sideways scrolling on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a reviewed dialogue: tap a word for its meaning, show the English, add a word to your words', async ({ page }) => {
  await withDialogue(page);
  await page.goto('./');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('krotik.settings.v1') ?? '{}');
    localStorage.setItem('krotik.settings.v1', JSON.stringify({ ...s, progress: true }));
  });
  await page.goto('words/food/');
  const d = page.getByRole('group', { name: /Dialogue: Breakfast/ });
  await expect(d).toContainText('Хлеб с маслом.');
  await expect(page.getByText('Bread and butter.')).toHaveCount(0);
  await page.getByLabel('Show English').check();
  await expect(page.getByText('Bread and butter.')).toBeVisible();
  await d.locator('button.w', { hasText: 'маслом' }).click();
  await expect(page.getByRole('tooltip')).toContainText('instrumental singular');
  await d.locator('button.w', { hasText: 'Хлеб' }).click();
  await page.locator('.pop').getByRole('button', { name: 'Add to my words' }).click();
  await expect(page.locator('.pop')).toContainText('In your words ✓');
  await expect(page.getByText(/checked by a native speaker \(Test reviewer/)).toBeVisible();
});

test('practise a theme both ways round, and add all its words', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('krotik.settings.v1') ?? '{}');
    localStorage.setItem('krotik.settings.v1', JSON.stringify({ ...s, progress: true }));
  });
  await page.goto('words/greetings/');
  await page.getByRole('button', { name: 'Add all to my words' }).click();
  await expect(page.getByRole('button', { name: 'All in your words ✓' })).toBeDisabled();
  expect(Object.keys(JSON.parse((await page.evaluate(() => localStorage.getItem('krotik.words.v1')))!).words)).toHaveLength(19);
  await page.getByRole('button', { name: 'Practise: type the word' }).click();
  await expect(page).toHaveURL(/\/drill\/vocab\//);
  await expect(page.getByText('0 of 19 cleared')).toBeVisible();
  await expect(page.locator('.task')).toContainText('Say it in Russian');
  await page.goBack();
  await page.getByRole('button', { name: 'Practise: choose the meaning' }).click();
  await expect(page.getByRole('group', { name: 'Choose the meaning' })).toBeVisible();
});

test('the Words pages are prerendered and in the sitemap', async ({ request }) => {
  const html = await (await request.get('words/food/')).text();
  expect(html).toContain('<title>Food and drink: Russian words, dialogues and practice | Krotik</title>');
  expect(html).toContain('хлеб');
  expect(html).not.toContain('noindex');
  const sitemap = await (await request.get('sitemap.xml')).text();
  expect(sitemap).toContain('/words/food/</loc>');
  expect(sitemap).toContain('/words/</loc>');
});

for (const theme of ['krotik', 'light', 'dark'] as const) {
  test(`no axe violations on the Words pages (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await withDialogue(page);
    await page.goto('./');
    await page.getByLabel('Theme').selectOption(theme);
    for (const url of ['words/', 'words/food/']) {
      await page.goto(url);
      await expect(page.locator('main')).not.toContainText('Loading…');
      if (url === 'words/food/') {
        await page.getByLabel('Show English').check();
        await page.getByRole('group', { name: /Dialogue/ }).locator('button.w').first().click();
      }
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    }
  });
}
