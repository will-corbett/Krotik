import { expect, type Page } from '@playwright/test';

export type ModeName =
  | 'Verb forms'
  | 'Reflexive verbs'
  | 'Aspect partners'
  | 'Motion verbs'
  | 'Adjective agreement'
  | 'Short-form adjectives'
  | 'Comparatives & superlatives'
  | 'Plurals'
  | 'Verbal adverbs'
  | 'Participles'
  | 'Numbers'
  | 'Diminutives'
  | 'Relative clauses with который'
  | 'Purpose with чтобы'
  | 'Conditional'
  | 'Negation'
  | 'Indefinite pronouns'
  | 'Particles';

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
  const choices = page.getByRole('group', { name: 'Choose the missing word' });
  for (let step = 0; step < 200; step++) {
    if (await page.getByRole('heading', { name: /Round (complete|ended)/ }).isVisible()) break;
    await expect(page.locator('.task')).toBeVisible();
    const isChoice = await choices.isVisible();
    const id = await questionId(page);
    const known = learned.get(id);
    if (known) await expect(page.locator('.retry')).toBeVisible();
    if (isChoice) {
      // Wrong first time via "I don't know"; on the retry, pick the learned option.
      if (known) await choices.getByRole('button').filter({ hasText: new RegExp(`^\\d\\s*${known.replace(/[-]/g, '\\-')}$`) }).click();
      else await page.getByRole('button', { name: "I don't know" }).click();
    } else {
      await expect(input).toBeEditable();
      await input.fill(known ?? 'ъъъ');
      await input.press('Enter');
    }
    const feedback = page.locator('.feedback');
    await expect(feedback).toBeVisible();
    if (known) {
      await expect(feedback.locator('.verdict')).toHaveText('Correct');
    } else {
      await expect(feedback.locator('.verdict')).toHaveText(isChoice ? 'Answer' : 'Not quite');
      learned.set(id, plain(await feedback.locator('.solution strong').first().innerText()));
      seen.add(id);
    }
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible();
  return seen.size;
}
