/** Vocabulary: the word drill both ways round, the opt-in record of your words, and Reading's key words. */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { playRetryRound, setup } from './helpers.ts';

const stored = (page: Page) => page.evaluate(() => localStorage.getItem('krotik.words.v1'));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Progress on, and these words in the record (due today unless given). */
async function withWords(page: Page, words: Record<string, string | undefined>) {
  await page.goto('./');
  await page.evaluate(
    ([w, d]) => {
      const s = JSON.parse(localStorage.getItem('krotik.settings.v1') ?? '{}');
      localStorage.setItem('krotik.settings.v1', JSON.stringify({ ...s, progress: true }));
      const rec = Object.fromEntries(Object.entries(w).map(([k, due]) => [k, { b: 0, box: 0, due: due ?? d, added: d }]));
      localStorage.setItem('krotik.words.v1', JSON.stringify({ v: 1, words: rec }));
    },
    [words, today()] as const,
  );
  // The open page still has the old settings in memory (and would save them back): load it again.
  await page.reload();
}

test('a vocabulary round, both ways round, with retries', async ({ page }) => {
  await setup(page, 'Vocabulary');
  await expect(page.getByRole('radio', { name: 'Both' })).toBeChecked();
  await page.getByRole('button', { name: 'Start' }).click();
  expect(await playRetryRound(page)).toBe(10);
  // Off by default: nothing about the words is kept.
  expect(await stored(page)).toBeNull();
});

test('choose the meaning: four English meanings, number keys, the word and its meaning after answering', async ({ page }) => {
  await setup(page, 'Vocabulary');
  await page.getByRole('radio', { name: /Russian → English/ }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  const group = page.getByRole('group', { name: 'Choose the meaning' });
  await expect(group.getByRole('button')).toHaveCount(4);
  await expect(page.locator('.task')).toContainText('What does it mean?');
  await page.keyboard.press('1');
  await expect(page.locator('.feedback .meaning-solution')).toContainText('=');
});

test('type the word: other words with the same meaning count, and the aspect partner is named', async ({ page }) => {
  await setup(page, 'Vocabulary');
  await page.getByRole('radio', { name: /English → Russian/ }).check();
  await page.getByRole('checkbox', { name: /Nouns/ }).uncheck();
  await page.getByRole('checkbox', { name: /Adjectives/ }).uncheck();
  await page.getByRole('checkbox', { name: /Other words/ }).uncheck();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task')).toContainText('Say it in Russian');
  await expect(page.locator('.task')).toContainText(/Verb/);
  await expect(page.locator('#prompt-word')).toHaveAttribute('lang', 'en');
});

test('your words: kept only with progress on, reviewed when due, removed, exported, imported and deleted', async ({ page }) => {
  // With progress on, a round puts every word answered into your words.
  await withWords(page, {});
  await setup(page, 'Vocabulary');
  await page.getByRole('button', { name: 'Start' }).click();
  await playRetryRound(page);
  const rec = JSON.parse((await stored(page))!);
  expect(Object.keys(rec.words)).toHaveLength(10);
  // All wrong first time: back tomorrow, so none due today.
  for (const r of Object.values(rec.words) as { box: number; due: string }[]) expect(r).toMatchObject({ box: 0 });

  // Three words, two due today.
  await withWords(page, { 'n:1': undefined, 'v:2': undefined, 'n:2': '2099-01-01' });
  await page.goto('./');
  await expect(page.locator('article', { hasText: 'Your progress' })).toContainText('2 words due for review');
  await page.goto('progress/');
  const words = page.locator('section', { has: page.getByRole('heading', { name: 'Your words' }) });
  await expect(words).toContainText('3 words · 2 due today');
  await expect(words.locator('tbody tr').first()).toContainText('челове́к');
  await expect(words).toContainText('person, people');

  // Review: the drill set to your due words, two questions.
  await words.getByRole('button', { name: 'Review 2 due words' }).click();
  await expect(page).toHaveURL(/\/drill\/vocab\//);
  await expect(page.getByRole('radio', { name: 'My words that are due' })).toBeChecked();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('0 of 2 cleared')).toBeVisible();
  await expect(page.getByText('2 of your words are due.')).toBeVisible();

  await page.goto('progress/');
  await words.getByRole('button', { name: /^Remove год/ }).click();
  await expect(words).toContainText('2 words');
  expect(Object.keys(JSON.parse((await stored(page))!).words).sort()).toEqual(['n:1', 'v:2']);

  // Export: one file with topics and words, on this device.
  const move = page.locator('section', { has: page.getByRole('heading', { name: 'Move to another device' }) });
  const [download] = await Promise.all([page.waitForEvent('download'), move.getByRole('button', { name: 'Export to a file' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^krotik-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(saved.krotik).toBe(1);
  expect(Object.keys(saved.words.words).sort()).toEqual(['n:1', 'v:2']);
  // Import: merged in (an old words-only file works too); a file that isn't Krotik's is refused.
  await move.getByLabel('Import from a file').setInputFiles({ name: 'w.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 1, words: { 'n:3': { b: 0, box: 2, due: '2099-01-01', added: '2026-01-01' } } })) });
  await expect(move.getByRole('status')).toContainText('1 new word');
  await expect(words).toContainText('3 words');
  await move.getByLabel('Import from a file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(move.getByRole('status')).toContainText("isn't a Krotik progress file");

  await words.getByRole('button', { name: 'Delete my words…' }).click();
  await words.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await stored(page)).toBeNull();

  // Turning progress off deletes your words too.
  await withWords(page, { 'n:1': undefined });
  await page.goto('progress/');
  await page.getByRole('button', { name: 'Turn off…' }).click();
  await page.getByRole('button', { name: 'Turn off and delete' }).click();
  expect(await stored(page)).toBeNull();
});

test('my due words need progress on and a word that is due', async ({ page }) => {
  await setup(page, 'Vocabulary');
  await page.getByRole('radio', { name: 'My words that are due' }).check();
  await expect(page.locator('.hint', { hasText: /only when progress is on/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Top 250' })).toHaveCount(0);
});

test('Reading: key words before you read, practised in a round; words added from the text', async ({ page }) => {
  await withWords(page, {});
  await page.goto('reading/akula/');
  await page.getByText('Key words before you read').click();
  const kw = page.locator('details.key-words');
  await expect(kw.locator('li')).toHaveCount(15);
  await expect(kw).toContainText('я́корь');
  await kw.getByRole('button', { name: 'Add all to my words' }).click();
  await expect(kw.getByRole('button', { name: 'All in your words ✓' })).toBeDisabled();
  expect(Object.keys(JSON.parse((await stored(page))!).words)).toHaveLength(15);

  // One word from the text, from its box.
  const word = page.locator('button.w', { hasText: /^корабль$/ }).first();
  await word.click();
  await page.locator('.pop').getByRole('button', { name: 'Add to my words' }).click();
  await expect(page.locator('.pop')).toContainText('In your words ✓');
  expect(Object.keys(JSON.parse((await stored(page))!).words)).toHaveLength(16);

  await kw.getByRole('button', { name: 'Practise these' }).click();
  await expect(page).toHaveURL(/\/drill\/vocab\//);
  await expect(page.getByText('0 of 15 cleared')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose the meaning' })).toBeVisible();
});

for (const theme of ['krotik', 'light', 'dark'] as const) {
  test(`no axe violations on the vocabulary drill, your words and Reading's key words (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await withWords(page, { 'n:1': undefined, 'v:2': '2099-01-01' });
    await page.getByLabel('Theme').selectOption(theme);
    const axe = async (where: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    };
    await setup(page, 'Vocabulary');
    await page.getByRole('radio', { name: /Russian → English/ }).check();
    await axe('setup');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('group', { name: 'Choose the meaning' })).toBeVisible();
    await axe('question');
    await page.keyboard.press('1');
    await axe('feedback');
    await page.goto('progress/');
    await expect(page.getByRole('heading', { name: 'Your words' })).toBeVisible();
    await expect(page.locator('tbody th').first()).toContainText('челове́к');
    await axe('progress');
    await page.goto('reading/akula/');
    await page.getByText('Key words before you read').click();
    await page.locator('button.w', { hasText: /^корабль$/ }).first().click();
    await expect(page.locator('.pop').getByRole('button', { name: 'Add to my words' })).toBeVisible();
    await axe('reading');
  });
}
