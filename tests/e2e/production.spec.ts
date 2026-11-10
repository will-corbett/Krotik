/** Production (critique batch 2): translate both ways, gap-fill, build the sentence, find the mistake, typed test, writing. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axe = async (page: Page, where: string) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
};
async function startDrill(page: Page, mode: string) {
  await page.goto(`drill/${mode}/?seed=5`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

test('translate Russian → English: the Russian shown, English typed, compared with the real translation', async ({ page }) => {
  await startDrill(page, 'translate');
  await page.getByRole('radio', { name: 'Russian → English' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task')).toContainText('Translate into English');
  await expect(page.locator('#prompt-word')).toHaveAttribute('lang', 'ru');
  const box = page.getByRole('textbox', { name: 'Your answer' });
  await expect(box).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: /Cyrillic keyboard/ })).toHaveCount(0);
  await box.fill('something else entirely');
  await box.press('Enter');
  await expect(page.locator('.feedback')).toContainText('A model translation');
  await page.getByRole('button', { name: 'I got it right' }).click();
  await expect(page.getByText(/^1 of \d+ cleared/)).toBeVisible();
});

test('vocabulary gap-fill: the word missing from a real sentence, typed in the form the sentence uses', async ({ page }) => {
  await page.goto('vocabulary/food/?seed=5');
  await page.getByRole('button', { name: 'Practise: fill the gap' }).click();
  await expect(page.locator('.task')).toContainText('Fill the gap');
  await expect(page.locator('.frame')).toContainText(/___|\(/);
  await page.getByRole('button', { name: "I don't know" }).click();
  await expect(page.locator('.feedback')).toContainText('Tatoeba #');
});

test('build the sentence: tap the words in order; the original order is right, another is self-marked', async ({ page }) => {
  await startDrill(page, 'build');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task')).toContainText('Put the words in order');
  const pool = page.getByRole('group', { name: 'Words to put in order' });
  const n = await pool.getByRole('button').count();
  expect(n).toBeGreaterThanOrEqual(3);
  const check = page.getByRole('button', { name: 'Check' });
  await expect(check).toBeDisabled();
  // Place one, take it out again, then place them all in the order shown (never the original order).
  await pool.getByRole('button').first().click();
  await page.locator('.built').getByRole('button').first().click();
  await expect(page.locator('.built').getByRole('button')).toHaveCount(0);
  for (let k = 0; k < n; k++) await pool.getByRole('button').nth(k).click();
  await expect(check).toBeEnabled();
  await axe(page, 'build');
  await check.click();
  await expect(page.locator('.feedback')).toContainText('A model translation');
  await page.getByRole('button', { name: 'Not quite: ask again later' }).click();
  await expect(page.getByText(/^0 of \d+ cleared/)).toBeVisible();
});

test('find the mistake: tap the wrong word, type the right form', async ({ page }) => {
  await startDrill(page, 'fix');
  await page.getByRole('button', { name: 'Start' }).click();
  const sentence = page.getByRole('group', { name: 'The sentence: tap the wrong word' });
  await expect(sentence.getByRole('button').first()).toBeVisible();
  const check = page.getByRole('button', { name: 'Check' });
  const box = page.getByRole('textbox', { name: /Tap the wrong word/ });
  // The answer box is a normal one-line box, not a tall square.
  expect((await box.boundingBox())!.height).toBeLessThan(80);
  await box.fill('ъъъ');
  await expect(check).toBeDisabled();
  await sentence.getByRole('button').first().click();
  await expect(sentence.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
  await axe(page, 'fix');
  await check.click();
  await expect(page.locator('.feedback')).toContainText('The wrong word was');
  await expect(page.locator('.feedback .verdict')).toHaveText('Not quite');
  // Every answer is explained.
  await expect(page.locator('.feedback .explain')).toContainText('The right form is');
});

test('Grammar test stage 2 (typed answers) is off the site until its questions are reviewed', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('test/');
  await page.getByRole('button', { name: 'Start the test' }).click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'End test now' }).click();
  await expect(page.getByRole('heading', { name: 'Your grammar level' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start stage 2' })).toHaveCount(0);
  await expect(page.getByText(/stage 2/i)).toHaveCount(0);
});

test('Writing: tasks by level with a checklist; nothing typed is stored', async ({ page }) => {
  await page.goto('start/');
  await page.getByRole('main').getByRole('link', { name: 'Writing', exact: true }).click();
  await expect(page).toHaveURL(/\/writing\/$/);
  for (const l of ['A1', 'A2', 'B1', 'B2', 'C1']) await expect(page.getByRole('heading', { name: l, exact: true })).toBeVisible();
  await page.getByText('About me', { exact: true }).click();
  const box = page.getByRole('textbox', { name: 'Your text for “About me”' });
  await box.fill('Меня зовут Анна. Я живу в Москве.');
  await expect(page.getByText('7 words')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Check your text' }).getByRole('checkbox')).toHaveCount(5);
  const stored = await page.evaluate(() => Object.values(localStorage).join(' '));
  expect(stored).not.toContain('Анна');
  await axe(page, 'writing');
});
