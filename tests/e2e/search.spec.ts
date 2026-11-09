/** Site search: from the header button or "/", results grouped, the query kept in the address. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('search from the header: words, lessons and themes, with the query in the address', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Search the site' }).click();
  await expect(page).toHaveURL(/\/search\/$/);
  const box = page.getByRole('searchbox', { name: 'Search Krotik' });
  await expect(box).toBeFocused();
  await box.fill('погода');
  await expect(page).toHaveURL(/\?q=%D0%BF/);
  await expect(page.getByRole('heading', { name: 'Words' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vocabulary themes' })).toBeVisible();
  await page.getByRole('link', { name: 'Weather and seasons' }).first().click();
  await expect(page).toHaveURL(/\/vocabulary\/weather\/$/);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test('"/" opens the search; nothing found is said plainly', async ({ page }) => {
  await page.goto('learn/');
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/\/search\/$/);
  await page.getByRole('searchbox', { name: 'Search Krotik' }).fill('zzzzqqq');
  await expect(page.getByRole('status')).toContainText('Nothing found');
  await page.goto('search/?q=aspect');
  await expect(page.getByRole('link', { name: 'Aspect partners' }).first()).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test('register labels show on Vocabulary words', async ({ page }) => {
  await page.goto('vocabulary/food/');
  await expect(page.locator('.words li', { hasText: /карто.?шка/ }).first()).toContainText('colloquial (разговорное)');
});
