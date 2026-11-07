import { expect, test } from '@playwright/test';

// Stress is stored as an apostrophe (буты'лка); on screen it must always be a stress mark (буты́лка), never the raw apostrophe.
test('no raw stress apostrophes in the level test, culture notes or quick checks', async ({ page }, info) => {
  if (info.project.name !== 'desktop') return;
  const hits = new Set<string>();
  const scan = async (where: string) => {
    const txt = await page.locator('main').innerText();
    for (const m of txt.matchAll(/[^\s]*[а-яёА-ЯЁ]'[^\s]*/g)) hits.add(`${where}: ${m[0]}`);
  };
  for (const seed of [1, 2]) {
    await page.goto(`./?seed=${seed}&t=${Date.now()}#/test`);
    await page.getByRole('button', { name: 'Start the test' }).click();
    await page.getByText('Question 1 of 60').waitFor({ timeout: 30000 });
    for (let i = 0; i < 60; i++) {
      await scan(`test q${i}`);
      // Choose the first option, so the results explain wrong answers (and their forms) too.
      await page.keyboard.press('1');
      await page.getByRole('button', { name: i === 59 ? 'Submit' : 'Next' }).click();
    }
    await scan('test results');
  }
  for (const n of ['names', 'ty-vy', 'holidays', 'russian-beyond-russia', 'food', 'visiting', 'superstitions', 'idioms', 'slang', 'cartoons-films']) {
    await page.goto(`./#/culture/${n}`);
    await page.waitForTimeout(400);
    await scan(`note ${n}`);
  }
  for (const t of ['nounCases', 'verbs', 'adjectives', 'pronouns', 'kotoryi', 'specialCases', 'ordinals']) {
    await page.goto(`./#/learn/${t}`);
    const check = page.getByRole('group', { name: 'Quick check' });
    await check.getByText(/Question 1 of/).waitFor();
    for (let i = 0; i < 6; i++) {
      const box = check.getByRole('textbox', { name: 'Your answer' });
      if (await box.isVisible().catch(() => false)) { await box.fill('ъ'); await check.getByRole('button', { name: 'Check' }).click(); }
      else { const c = check.getByRole('button').first(); await c.click(); }
      await scan(`quick ${t} ${i}`);
      const nx = check.getByRole('button', { name: /Next|Finish/ });
      if (!(await nx.isVisible().catch(() => false))) break;
      await nx.click();
    }
  }
  expect([...hits]).toEqual([]);
});
