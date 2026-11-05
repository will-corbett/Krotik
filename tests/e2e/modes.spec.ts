import { expect, test } from '@playwright/test';
import { playRetryRound, setup, type ModeName } from './helpers.ts';

const modes: ModeName[] = ['Verb forms', 'Aspect partners', 'Adjective agreement', 'Motion verbs'];

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
