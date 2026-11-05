import { expect, type Page } from '@playwright/test';

export type ModeName = 'Verb forms' | 'Aspect partners' | 'Adjective agreement' | 'Motion verbs';

export async function setup(page: Page, mode: ModeName, count: 10 | 20 | 40 = 10) {
  await page.goto('/?seed=42');
  await page.getByRole('radio', { name: new RegExp(mode) }).check();
  await page.getByRole('radio', { name: String(count), exact: true }).check();
}

/** Identify the current question by what's on screen. */
async function questionId(page: Page): Promise<string> {
  const task = await page.locator('.task').innerText();
  const word = await page.locator('#prompt-word').innerText();
  const frame = await page.locator('.frame').innerText();
  return `${task}|${word}|${frame}`;
}

/** Strip stress marks from a displayed answer. */
const plain = (s: string) => s.normalize('NFC').replace(/́/g, '');

/**
 * Play a full retry round: every question is answered wrong the first time (learning the
 * answer from the feedback), and correctly when it comes back. Returns the number of questions.
 */
export async function playRetryRound(page: Page): Promise<number> {
  const learned = new Map<string, string>();
  const seen = new Set<string>();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  for (let step = 0; step < 200; step++) {
    if (await page.getByRole('heading', { name: /Round (complete|ended)/ }).isVisible()) break;
    await expect(input).toBeEditable();
    const id = await questionId(page);
    const known = learned.get(id);
    if (known) {
      await expect(page.locator('.retry')).toBeVisible();
      await input.fill(known);
    } else {
      await input.fill('ъъъ');
    }
    await input.press('Enter');
    const feedback = page.locator('.feedback');
    await expect(feedback).toBeVisible();
    if (known) {
      await expect(feedback.locator('.verdict')).toHaveText('Correct');
    } else {
      await expect(feedback.locator('.verdict')).toHaveText('Not quite');
      learned.set(id, plain(await feedback.locator('.solution strong').first().innerText()));
      seen.add(id);
    }
    await input.press('Enter');
  }
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible();
  return seen.size;
}
