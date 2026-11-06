import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { setup } from './helpers.ts';

for (const scheme of ['light', 'dark', 'krotik'] as const) {
  test(`no axe violations (${scheme})`, async ({ page }) => {
    // Reduced motion: scans never catch a fade-in mid-animation (and this exercises that path).
    await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
    await setup(page, 'Short-form adjectives');
    await page.getByLabel('Theme').selectOption(scheme === 'krotik' ? 'krotik' : 'system');
    const scan = async () => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    };
    await scan();
    await page.getByRole('button', { name: 'Start' }).click();
    await scan();
    await page.getByRole('textbox', { name: 'Your answer' }).fill('ъъъ');
    await page.getByRole('textbox', { name: 'Your answer' }).press('Enter');
    await page.locator('.forms summary').click();
    await scan();
    await page.getByRole('button', { name: 'End round' }).click();
    await scan();
  });
}

test('keyboard only: choose a mode, start, answer, continue', async ({ page }) => {
  await page.goto('/?seed=1#/drill');
  // Focus the mode radios and move to the next mode ("Aspect partners") with an arrow key.
  await page.getByRole('radio', { name: /Verb forms/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /Aspect partners/ })).toBeChecked();
  // Enter in a form control submits the setup form, starting the round.
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await expect(input).toBeFocused();
  await page.keyboard.type('ъъъ');
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toHaveText('Not quite');
  await expect(input).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback')).toHaveCount(0);
  await expect(input).toBeFocused();
});

test('on-screen keyboard types into the answer and suppresses the phone keyboard', async ({ page }) => {
  await setup(page, 'Verb forms');
  await page.getByRole('checkbox', { name: 'On-screen Cyrillic keyboard' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await expect(input).toHaveAttribute('inputmode', 'none');
  const kb = page.getByRole('group', { name: 'Cyrillic keyboard' });
  for (const ch of ['д', 'а', 'й']) await kb.getByRole('button', { name: ch, exact: true }).click();
  await kb.getByRole('button', { name: 'Backspace' }).click();
  await expect(input).toHaveValue('да');
});

test('settings are remembered, progress is not', async ({ page }) => {
  await setup(page, 'Motion verbs', 40);
  await page.getByRole('checkbox', { name: 'Stress marks' }).uncheck();
  await page.reload();
  await expect(page.getByRole('radio', { name: /Motion verbs/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: '40', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Stress marks' })).not.toBeChecked();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(['krotik.settings.v1']);
});

test('no horizontal scroll', async ({ page }) => {
  for (const mode of ['Verb forms', 'Adjective agreement', 'Relative clauses with который'] as const) {
    await setup(page, mode);
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: "I don't know" }).click();
    if (await page.locator('.forms summary').count()) await page.locator('.forms summary').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('settings saved under the previous name carry over', async ({ page }) => {
  await page.goto('/#/drill');
  // A returning visitor: only the old key exists.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('rgd.settings.v1', JSON.stringify({ mode: 'motion', count: 40 }));
  });
  await page.reload();
  await expect(page.getByRole('radio', { name: /Motion verbs/ })).toBeChecked();
  await page.getByRole('radio', { name: '10', exact: true }).check();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['krotik.settings.v1']);
});
