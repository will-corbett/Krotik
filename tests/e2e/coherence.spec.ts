/** Coherence (critique batch 1): learning paths, the home page's next steps, Learn filters, the wider layout. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function withProgress(page: Page, extra: Record<string, unknown> = {}, topics: Record<string, unknown> = {}) {
  await page.goto('./');
  await page.evaluate(
    ([extra, topics]) => {
      const s = JSON.parse(localStorage.getItem('krotik.settings.v1') ?? '{}');
      localStorage.setItem('krotik.settings.v1', JSON.stringify({ ...s, progress: true, ...extra }));
      localStorage.setItem('krotik.progress.v1', JSON.stringify({ v: 1, topics }));
    },
    [extra, topics] as const,
  );
  await page.reload();
}
const rec = (right: number, attempted: number, last = '2026-11-01') => ({ rounds: 1, attempted, right, last, recent: [[right, attempted]] });

test('learning paths: a route per level, followed from the page, linked from Start here', async ({ page }) => {
  await page.goto('start/');
  await page.getByRole('link', { name: 'learning path' }).click();
  await expect(page).toHaveURL(/\/paths\/$/);
  for (const l of ['A1', 'A2', 'B1', 'B2', 'C1']) await expect(page.getByRole('heading', { name: new RegExp(`^${l} `) })).toBeVisible();
  const a1 = page.locator('section.path').first();
  await expect(a1.locator('li').first()).toContainText('The alphabet');
  await expect(a1.getByRole('link', { name: 'Learn: The alphabet' })).toHaveAttribute('href', /\/learn\/alphabet\/$/);
  await page.getByRole('navigation', { name: 'Go to a level' }).getByRole('link', { name: 'B2' }).click();
  await expect(page.getByRole('heading', { name: /^B2 / })).toBeInViewport();
  // Everyone starts on A1; a learner further on chooses their level, and it's remembered.
  await expect(a1).toContainText('Your level ✓');
  await expect(page.locator('p.you')).toContainText('Your level is A1');
  const b2 = page.locator('section.path', { has: page.getByRole('heading', { name: /^B2 / }) });
  await b2.getByRole('button', { name: 'This is my level' }).click();
  await expect(b2).toContainText('Your level ✓');
  await expect(a1.getByRole('button', { name: 'This is my level' })).toBeVisible();
  await page.reload();
  await expect(page.locator('p.you')).toContainText('Your level is B2');
  expect(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
});

test('with progress on, path steps you have done are ticked', async ({ page }) => {
  await withProgress(page, {}, { alphabet: rec(9, 10) });
  await page.goto('paths/');
  const a1 = page.locator('section.path').first();
  await expect(a1.locator('li', { hasText: 'The alphabet' })).toContainText('✓');
  await expect(a1).toContainText(/1 of \d+ steps done/);
});

test('home page: your next steps (weak topics, words due, next on your path); nothing extra with progress off', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your next steps' })).toHaveCount(0);
  await withProgress(page, {}, { alphabet: rec(9, 10), verbs: rec(2, 10), nounCases: rec(3, 10) });
  const next = page.getByRole('region', { name: 'Your next steps' });
  await expect(next).toContainText('Needs attention: Verb forms, Noun cases');
  await expect(next).toContainText('Next on your A1 path: Learn: Sounds and spelling');
  await next.getByRole('link', { name: 'Go' }).click();
  await expect(page).toHaveURL(/\/learn\/sounds\/$/);
  // A learner who set a higher level gets steps from that path.
  await withProgress(page, { pathLevel: 'B2' });
  await expect(page.getByRole('region', { name: 'Your next steps' })).toContainText('Next on your B2 path: Vocabulary: Opinions and arguments');
});

test('Learn page filters: by level and group, and by your progress when it is on', async ({ page }) => {
  await page.goto('learn/');
  await expect(page.getByRole('combobox', { name: 'Your progress' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Level' }).selectOption('C1');
  await expect(page.locator('li.topic')).toContainText(['Word order']);
  await expect(page.getByText(/of \d+ topics/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('combobox', { name: 'Group' }).selectOption('Pronouns');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  await withProgress(page, {}, { verbs: rec(2, 10) });
  await page.goto('learn/');
  await page.getByRole('combobox', { name: 'Your progress' }).selectOption('revise');
  await expect(page.locator('li.topic')).toHaveCount(1);
  await expect(page.locator('li.topic')).toContainText('Verb forms');
});

test('wide screens use the room: lists and tables go wider, drills stay compact', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('learn/');
  expect((await page.locator('main').boundingBox())!.width).toBeGreaterThan(900);
  await page.goto('drill/verbs/');
  expect((await page.locator('main').boundingBox())!.width).toBeLessThanOrEqual(760);
});

test('Settings: your level (A1 by default), display, reading and progress, all remembered in this browser', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/$/);
  await expect(page.getByRole('radio', { name: /^A1/ })).toBeChecked();
  await page.getByRole('radio', { name: /^B1/ }).check();
  await page.getByLabel('Stress marks').uncheck();
  await page.getByRole('radio', { name: 'Questions in English' }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: /^B1/ })).toBeChecked();
  await expect(page.getByLabel('Stress marks')).not.toBeChecked();
  await expect(page.getByRole('radio', { name: 'Questions in English' })).toBeChecked();
  await page.goto('paths/');
  await expect(page.locator('p.you')).toContainText('Your level is B1');
  // Progress: on from here, and off again (deleting it) after a confirmation.
  await page.goto('settings/');
  await page.getByRole('button', { name: 'Keep track in this browser' }).click();
  await expect(page.getByRole('link', { name: 'Progress page' })).toBeVisible();
  await page.getByRole('button', { name: 'Turn off…' }).click();
  await page.getByRole('button', { name: 'Turn off and delete' }).click();
  await expect(page.getByRole('button', { name: 'Keep track in this browser' })).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.getByRole('combobox', { name: 'Theme' }).first().selectOption(theme);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  }
});

test('an old saved setting with no level chosen becomes A1', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('krotik.settings.v1') ?? '{}');
    localStorage.setItem('krotik.settings.v1', JSON.stringify({ ...s, pathLevel: '' }));
  });
  await page.goto('settings/');
  await expect(page.getByRole('radio', { name: /^A1/ })).toBeChecked();
});
