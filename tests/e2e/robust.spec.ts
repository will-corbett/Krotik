/** What happens when things go wrong: failed data requests, a reload mid-drill, and the browser's Back/Forward. */
import { expect, test } from '@playwright/test';
import { goTo, setup } from './helpers.ts';

test('a failed data request says so, and Start works once the data is back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page, 'Verb forms');
  await page.route('**/data/verbs.b*.json', (r) => r.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('status')).toContainText(/Couldn.t load the data \(verbs\.b\d\.json\)\. Check your connection/);
  await expect(page.getByRole('button', { name: 'Start' })).toBeEnabled();
  await page.unroute('**/data/verbs.b*.json');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('0 of 10 cleared')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a server error (HTTP 500) is reported too', async ({ page }) => {
  await setup(page, 'Noun cases');
  await page.route('**/data/nouns.b0.json', (r) => r.fulfill({ status: 500, body: 'oops' }));
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('status')).toContainText('nouns.b0.json, HTTP 500');
});

test('the drill still works when example sentences fail to load', async ({ page }) => {
  await page.route('**/data/sentences.*.json', (r) => r.abort());
  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await input.fill('ъъъ');
  await input.press('Enter');
  await expect(page.locator('.verdict')).toHaveText('Not quite');
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toHaveCount(0);
  await expect(input).toBeEditable();
});

test('the Grammar test reports a failed load and can be started again', async ({ page }) => {
  await page.route('**/data/level-test.json', (r) => r.abort());
  await page.goto('./?seed=1#/test');
  await page.getByRole('button', { name: 'Start the test' }).click();
  await expect(page.getByText(/Couldn.t prepare the test: Couldn.t load the data \(level-test\.json\)/)).toBeVisible();
  await page.unroute('**/data/level-test.json');
  await page.getByRole('button', { name: 'Start the test' }).click();
  await expect(page.getByText(/Question 1 of 60/)).toBeVisible();
});

test('a Learn page whose data fails says so instead of leaving gaps', async ({ page }) => {
  await page.route('**/data/nouns.b*.json', (r) => r.abort());
  await page.goto('./#/learn/nounCases');
  await expect(page.getByText(/Couldn.t load this table/).first()).toBeVisible();
  // The explanation itself still shows.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Noun cases');
});

test('reloading mid-drill returns to that drill’s settings, ready to start again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page, 'Verb forms');
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await input.fill('ъъъ');
  await input.press('Enter');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Set up your drill' })).toBeVisible();
  await expect(page.getByText(/You've chosen: Verb forms/)).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText(/0 of \d+ cleared/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Back and Forward move between pages and Learn lessons', async ({ page }) => {
  await page.goto('./#/');
  await goTo(page, 'Learn');
  await expect(page).toHaveURL(/\/Krotik\/learn\/(\?.*)?$/);
  await page.getByRole('link', { name: 'Noun cases' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Noun cases');
  await page.getByRole('link', { name: /Next →/ }).click();
  await expect(page).toHaveURL(/\/Krotik\/learn\/plurals\/(\?.*)?$/);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Noun cases');
  await page.goBack();
  await expect(page).toHaveURL(/\/Krotik\/learn\/(\?.*)?$/);
  await expect(page.getByRole('heading', { name: /^Learn/, level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Krotik', level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/Krotik\/learn\/(\?.*)?$/);
});

test('Back from a round leaves it for the choose page; Forward opens the settings, not the old round', async ({ page }) => {
  await page.goto('./?seed=2#/drill');
  await page.getByRole('radio', { name: /Verb forms/ }).click();
  await page.getByRole('link', { name: 'Set up your drill' }).click();
  await expect(page).toHaveURL(/\/Krotik\/drill\/verbs\/(\?.*)?$/);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText(/0 of \d+ cleared/)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/Krotik\/drill\/(\?.*)?$/);
  await expect(page.getByText('Choose a drill')).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Set up your drill' })).toBeVisible();
  await expect(page.getByText(/You've chosen: Verb forms/)).toBeVisible();
});
