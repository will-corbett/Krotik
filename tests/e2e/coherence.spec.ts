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
  // Follow a path: remembered.
  const b2 = page.locator('section.path', { has: page.getByRole('heading', { name: /^B2 / }) });
  await b2.getByRole('button', { name: 'Follow this path' }).click();
  await expect(b2.getByRole('button', { name: 'Following ✓' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('section.path', { has: page.getByRole('heading', { name: /^B2 / }) }).getByRole('button', { name: 'Following ✓' })).toBeVisible();
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
  await withProgress(page, { pathLevel: 'A1' }, { alphabet: rec(9, 10), verbs: rec(2, 10), nounCases: rec(3, 10) });
  const next = page.getByRole('region', { name: 'Your next steps' });
  await expect(next).toContainText('Needs attention: Verb forms, Noun cases');
  await expect(next).toContainText('Next on your A1 path: Learn: Sounds and spelling');
  await next.getByRole('link', { name: 'Go' }).click();
  await expect(page).toHaveURL(/\/learn\/sounds\/$/);
  // No path chosen: an invitation.
  await withProgress(page, { pathLevel: '' });
  await expect(page.getByRole('region', { name: 'Your next steps' }).getByRole('link', { name: 'Choose a path' })).toBeVisible();
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
