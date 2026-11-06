import { expect, test } from '@playwright/test';
import { setup, goTo } from './helpers.ts';

test('on-screen keys type at the end even after tapping the answer box', async ({ page }) => {
  await setup(page, 'Verb forms');
  await page.getByRole('checkbox', { name: 'On-screen Cyrillic keyboard' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  const kb = page.getByRole('group', { name: 'Cyrillic keyboard' });
  const mobile = test.info().project.name === 'mobile';
  const press = (ch: string) => (mobile ? kb.getByRole('button', { name: ch, exact: true }).tap() : kb.getByRole('button', { name: ch, exact: true }).click());
  for (const ch of 'при') await press(ch);
  // tap near the left edge of the box, as a thumb often does
  await (mobile ? input.tap({ position: { x: 4, y: 10 } }) : input.click({ position: { x: 4, y: 10 } }));
  for (const ch of 'вет') await press(ch);
  await expect(input).toHaveValue('привет');
});

test('the on-screen keyboard can be switched on and off during a drill', async ({ page }) => {
  await setup(page, 'Verb forms');
  await page.getByRole('checkbox', { name: 'On-screen Cyrillic keyboard' }).uncheck();
  await page.getByRole('button', { name: 'Start' }).click();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  const kb = page.getByRole('group', { name: 'Cyrillic keyboard' });
  const toggle = page.getByRole('button', { name: /Cyrillic keyboard|Hide keyboard/ });
  await expect(kb).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(kb).toBeVisible();
  await expect(input).toHaveAttribute('inputmode', 'none');
  await expect(input).toBeFocused();
  await kb.getByRole('button', { name: 'д', exact: true }).click();
  await expect(input).toHaveValue('д');
  await toggle.click();
  await expect(kb).toHaveCount(0);
  await expect(input).toHaveAttribute('inputmode', 'text');
  // The choice is remembered for the next round.
  await goTo(page, 'Drill');
  await expect(page.getByRole('checkbox', { name: 'On-screen Cyrillic keyboard' })).not.toBeChecked();
});
