import { expect, test } from '@playwright/test';
import { playRetryRound, setup, type ModeName } from './helpers.ts';

const modes: ModeName[] = [
  'Verb forms',
  'Reflexive verbs',
  'Aspect partners',
  'Motion verbs',
  'Adjective agreement',
  'Short-form adjectives',
  'Comparatives & superlatives',
  'Plurals',
  'Verbal adverbs',
  'Participles',
  'Numbers',
  'Diminutives',
];

for (const mode of modes) {
  test(`${mode}: full retry round`, async ({ page }) => {
    await setup(page, mode);
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('0 of 10 cleared')).toBeVisible();
    const n = await playRetryRound(page);
    expect(n).toBe(10);
    // Every question was missed once: score 0%, all ten listed with the typed answer.
    await expect(page.locator('.big')).toHaveText('0%');
    await expect(page.locator('.missed li')).toHaveCount(10);
    await expect(page.locator('.missed li').first()).toContainText('You typed: ъъъ');
  });
}

test('names another form of the same word', async ({ page }) => {
  // The same seed gives the same first question, so look up a different form, then reload and type it.
  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: "I don't know" }).click();
  await page.locator('.forms summary').click();
  const plain = (x: string) => x.replace(/\u0301/g, '').trim();
  const answer = plain(await page.locator('.solution strong').first().innerText());
  const cells = (await page.locator('.forms td').allInnerTexts()).map((c) => plain(c.split(',')[0]!));
  const other = cells.find((c) => c && c !== '—' && c.replace(/ё/g, 'е') !== answer.replace(/ё/g, 'е'))!;

  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await input.fill(other);
  await input.press('Enter');
  await expect(page.locator('.typed')).toContainText(/which is the (Present|Future|Past|Imperative)/);
});

test('End round shows the score so far', async ({ page }) => {
  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: "I don't know" }).click();
  await page.getByRole('textbox', { name: 'Your answer' }).press('Enter');
  await page.getByRole('button', { name: 'End round' }).click();
  await expect(page.getByRole('heading', { name: 'Round ended' })).toBeVisible();
  await expect(page.locator('.missed li')).toHaveCount(1);
});

test('unlimited round keeps going until End round', async ({ page }) => {
  await page.goto('/?seed=5');
  await page.getByRole('radio', { name: /Motion verbs/ }).check();
  await page.getByRole('radio', { name: 'Unlimited' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('unlimited round')).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  // Answer 60 questions with "I don't know" — more than one batch, and more than the motion pool.
  for (let i = 0; i < 60; i++) {
    await page.getByRole('button', { name: "I don't know" }).click();
    await input.press('Enter');
  }
  await expect(input).toBeVisible();
  await page.getByRole('button', { name: 'End round' }).click();
  await expect(page.getByRole('heading', { name: 'Round ended' })).toBeVisible();
  await expect(page.locator('.big')).toHaveText('0%');
});

test('plurals after numbers explain the rule', async ({ page }) => {
  await setup(page, 'Plurals');
  for (const name of [/Nominative plural/, /other cases/, /After много/]) await page.getByRole('checkbox', { name }).uncheck();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.frame-text').first()).toHaveText(/^\d+ ?$/);
  await page.getByRole('button', { name: "I don't know" }).click();
  await expect(page.locator('.explain')).toContainText(/After (1|2–4|5–20)/);
  await page.locator('.forms summary').click();
  await expect(page.locator('.forms table')).toContainText('мн. ч.');
});

test('grammar terms show their Russian names', async ({ page }) => {
  await setup(page, 'Adjective agreement');
  await expect(page.getByText('дательный', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task [lang="ru"]').first()).toContainText(/падеж/);
});
