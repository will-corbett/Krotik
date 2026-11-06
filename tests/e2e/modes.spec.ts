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
  'Relative clauses with который',
  'Purpose with чтобы',
  'Conditional',
  'Negation',
  'Indefinite pronouns',
  'Particles',
  'Personal pronouns',
  'Possessive & demonstrative pronouns',
  'Noun cases',
  'Prepositions and cases',
  'Aspect in context',
  'Stress',
  'Verb government',
  'Prefixed motion verbs',
  'Verbs of position',
  'Impersonal constructions',
  'Comparisons',
  'Conjunctions',
  'Time expressions',
  'Adverbs',
  'Question words',
  'Ordinals and dates',
  'Special case forms',
  'The alphabet',
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
    await expect(page.locator('.missed li').first()).toContainText(/You typed: (ъъъ|—)/);
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
  await page.getByRole('link', { name: 'Return to dashboard' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'All topics' })).toBeVisible();
});

test('unlimited round keeps going until End round', async ({ page }) => {
  await setup(page, 'Motion verbs');
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

test('multiple choice works from the keyboard', async ({ page }) => {
  await setup(page, 'Particles');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('group', { name: 'Choose the missing word' })).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.locator('.feedback .verdict')).toHaveText(/Correct|Not quite/);
  await expect(page.locator('.src a')).toHaveAttribute('href', /tatoeba\.org/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback')).toHaveCount(0);
});

test('numbers: ordinal, compound and collective types run', async ({ page }) => {
  await setup(page, 'Numbers');
  for (const name of [/Decline the number/, /Numeral \+ noun/]) await page.getByRole('checkbox', { name }).uncheck();
  for (const name of [/Ordinal numbers/, /Compound numbers/, /Collective numbers/]) await page.getByRole('checkbox', { name }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task')).toContainText(/Ordinal|Compound|Collective/);
  const n = await (await import('./helpers.ts')).playRetryRound(page);
  expect(n).toBe(10);
});

test('phonetic typing turns Latin into Cyrillic', async ({ page }) => {
  await setup(page, 'Verb forms');
  await page.getByRole('checkbox', { name: /Phonetic typing/ }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await input.pressSequentially('shchuka');
  await expect(input).toHaveValue('щука');
});

test('grammar terms show their Russian names', async ({ page }) => {
  await setup(page, 'Adjective agreement');
  await expect(page.getByText('дательный', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.task [lang="ru"]').first()).toContainText(/падеж/);
});
