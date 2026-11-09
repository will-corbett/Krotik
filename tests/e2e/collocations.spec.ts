/** Words that go together (critique batch 5): the Learn page's tables, the "Which verb?" drill, theme pages. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the Learn page lists the pairs from the data, with a quick check', async ({ page }) => {
  await page.goto('learn/collocations/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Words that go together');
  const table = page.getByRole('region', { name: 'Words that go together' }).first();
  await expect(table).toContainText('make a mistake');
  await expect(page.getByText('принять решение', { exact: false }).first()).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test('Which verb? A real sentence with its verb gapped, the English as the cue, the pair explained after', async ({ page }) => {
  await page.goto('drill/collocations/?seed=3');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('radio', { name: '10', exact: true }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task')).toContainText('Which verb goes with it?');
  await expect(page.locator('#prompt-word')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.frame .blank')).toHaveText('___');
  const options = page.getByRole('group', { name: 'Choose the missing word' }).getByRole('button');
  await expect(options).toHaveCount(4);
  await page.keyboard.press('1');
  await expect(page.locator('.feedback .explain')).toContainText(/: [a-z]/);
  await expect(page.locator('.feedback')).toContainText('Tatoeba #');
});

test('a Vocabulary theme lists the words that go together with its nouns', async ({ page }) => {
  await page.goto('vocabulary/health/');
  const section = page.getByRole('region', { name: 'Words that go together' });
  await expect(section.getByRole('listitem').first()).toBeVisible();
  await expect(section.getByRole('link', { name: 'the Learn page' })).toHaveAttribute('href', /learn\/collocations\/$/);
});
