/** Idioms and proverbs: the Learn page's lists with real sentences, and the drill. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the Learn page lists idioms and proverbs; the arrow opens a real sentence', async ({ page }) => {
  await page.goto('learn/idioms/');
  const idioms = page.getByRole('list', { name: 'Idioms' });
  await expect(idioms.getByRole('listitem').first()).toBeVisible();
  await expect(page.getByRole('list', { name: 'Proverbs' })).toContainText('strike while the iron is hot');
  const arrow = idioms.getByRole('button', { name: /^Example:/ }).first();
  await arrow.click();
  await expect(arrow).toHaveAttribute('aria-expanded', 'true');
  await expect(idioms.locator('.example')).toContainText('Tatoeba #');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test('the idioms drill: the idiom in a sentence, four meanings', async ({ page }) => {
  await page.goto('drill/idioms/?seed=2');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('radio', { name: '10', exact: true }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task')).toContainText('What does it mean?');
  await expect(page.getByRole('group', { name: 'Choose the meaning' }).getByRole('button')).toHaveCount(4);
  await page.keyboard.press('1');
  await expect(page.locator('.feedback')).toContainText('Tatoeba #');
});
