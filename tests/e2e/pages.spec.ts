import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('dashboard lists every topic with Drill links, and Learn links where written', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Krotik', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Drill: Verb forms' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Learn: Noun cases' })).toBeVisible();
  await page.getByRole('link', { name: 'Drill: Aspect partners' }).click();
  await expect(page).toHaveURL(/#\/drill\/aspect$/);
  await expect(page.getByRole('radio', { name: /Aspect partners/ })).toBeChecked();
});

test('Continue starts a round with the saved settings', async ({ page }) => {
  await page.goto('/?seed=3#/drill');
  await page.getByRole('radio', { name: /Motion verbs/ }).check();
  await page.getByRole('radio', { name: '10', exact: true }).check();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Motion verbs', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('0 of 10 cleared')).toBeVisible();
});

test('a Learn page shows data tables, real sentences and a working quick check', async ({ page }) => {
  await page.goto('/#/learn/nounCases');
  await expect(page.getByRole('heading', { name: /Noun cases/, level: 1 })).toBeVisible();
  await expect(page.locator('.data-block table').first()).toContainText('кни\u0301га'); // shown with stress
  await expect(page.locator('.example').first()).toContainText('Tatoeba');
  const check = page.getByRole('group', { name: 'Quick check' });
  await expect(check.getByText('Question 1 of 5')).toBeVisible();
  await check.getByRole('textbox', { name: 'Your answer' }).fill('ъъъ');
  await check.getByRole('button', { name: 'Check' }).click();
  await expect(check.getByText(/Not quite/)).toBeVisible();
  await check.getByRole('button', { name: 'Next' }).click();
  await expect(check.getByText('Question 2 of 5')).toBeVisible();
  await page.getByRole('link', { name: 'Drill: Noun cases' }).click();
  await expect(page.getByRole('radio', { name: /Noun cases/ })).toBeChecked();
});

test('every written Learn page loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/learn');
  const links = await page.locator('main li a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
  expect(links.length).toBeGreaterThanOrEqual(6);
  for (const l of links) {
    await page.goto('/' + l);
    await expect(page.locator('.drill-cta')).toBeVisible();
    await expect(page.getByText(/couldn't load|No example found/i)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('the Krotik theme is the default, and the theme picker switches it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'krotik');
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const theme of ['krotik', 'light', 'dark'] as const) {
  test(`no axe violations on Dashboard, Learn and Culture (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await page.goto('/');
    await page.getByLabel('Theme').selectOption(theme);
    for (const url of ['/#/', '/#/learn', '/#/learn/pronouns', '/#/culture', '/#/culture/names']) {
      await page.goto(url);
      await expect(page.locator('main')).not.toContainText('Loading…');
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    }
  });
}

test('Culture lists links that open in a new tab, filters them, and opens notes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Culture', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Culture/, level: 1 })).toBeVisible();
  const max = page.getByRole('link', { name: /Russian With Max/ }).first();
  await expect(max).toHaveAttribute('target', '_blank');
  await expect(max).toHaveAttribute('rel', /noopener/);
  const count = page.getByText(/ of \d+ links/);
  const all = await count.innerText();
  await page.getByLabel('From').selectOption('kazakhstan');
  await expect(count).not.toHaveText(all);
  await expect(page.getByRole('link', { name: /AIRAN/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Russian With Max/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(count).toHaveText(all);
  await page.getByLabel('Search').fill('chess');
  await expect(page.getByRole('link', { name: /Crestbook Chess/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Russian With Max/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Topic').selectOption('cooking');
  await expect(page.getByRole('link', { name: /Stalic/ })).toBeVisible();
  await page.getByRole('link', { name: /Names and patronymics/ }).click();
  await expect(page).toHaveURL(/#\/culture\/names$/);
  await expect(page.getByRole('heading', { name: /Names and patronymics/, level: 1 })).toBeVisible();
  await expect(page.locator('main table').first()).toContainText('Иванович');
});

test('no embedded players or third-party requests on the Culture page', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname)) external.push(r.url());
  });
  await page.goto('/#/culture');
  await expect(page.getByText(/ of \d+ links/)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('the four-tab menu fits a phone screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const url of ['/#/', '/#/culture', '/#/culture/russian-beyond-russia']) {
    await page.goto(url);
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Culture' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
