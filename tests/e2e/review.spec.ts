import { expect, test } from '@playwright/test';
import { playRetryRound, setup } from './helpers.ts';

test('translate and compare: the model is shown, you mark yourself, and "not quite" comes back', async ({ page }) => {
  await setup(page, 'Translate and compare');
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  const first = await page.locator('#prompt-word').innerText();
  await input.fill('ъъъ');
  await input.press('Enter');
  await expect(page.locator('.verdict')).toHaveText('A model translation');
  await expect(page.getByText('You wrote ъъъ')).toBeVisible();
  // Enter doesn't skip marking; the first mark button has focus.
  await expect(page.getByRole('button', { name: 'I got it right' })).toBeFocused();
  await page.getByRole('button', { name: /Not quite/ }).click();
  await expect(page.locator('#prompt-word')).not.toHaveText(first);
  // The next one: marked right by Enter on the focused button.
  await input.fill('ъъъ');
  await input.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByText('1 of 10 cleared')).toBeVisible();
  await page.getByRole('button', { name: 'End round' }).click();
  await expect(page.getByText('right first time: 1 of 2')).toBeVisible();
  await expect(page.locator('.missed li')).toContainText('You wrote: ъъъ');
});

test('progress is off by default, kept only after you turn it on, and deleted when you turn it off', async ({ page }) => {
  const stored = () => page.evaluate(() => localStorage.getItem('krotik.progress.v1'));
  // Off: a finished round leaves nothing behind.
  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  await playRetryRound(page);
  expect(await stored()).toBeNull();

  await page.goto('./#/');
  await page.getByRole('button', { name: 'Keep track in this browser' }).click();
  await expect(page.getByText('Finish a drill round')).toBeVisible();

  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  await playRetryRound(page);
  const p = JSON.parse((await stored())!);
  expect(p.topics.verbs).toMatchObject({ rounds: 1, attempted: 10, right: 0 });

  // Ten wrong first time: the landing card counts one weak topic; the Progress page lists it, with links.
  await page.goto('./#/');
  await expect(page.locator('article', { hasText: 'Your progress' })).toContainText('1 weak topic');
  await page.getByRole('link', { name: 'See your progress' }).click();
  await expect(page).toHaveURL(/\/Krotik\/progress\/(\?.*)?$/);
  await expect(page.getByRole('heading', { name: 'Weak topics' })).toBeVisible();
  await expect(page.locator('.progress li').first()).toContainText('Verb forms');
  await expect(page.locator('.progress table')).toContainText('Verb forms');

  await page.getByRole('button', { name: 'Turn off…' }).click();
  await page.getByRole('button', { name: 'Turn off and delete' }).click();
  expect(await stored()).toBeNull();
  await expect(page.getByRole('button', { name: 'Keep track in this browser' })).toBeVisible();
});
