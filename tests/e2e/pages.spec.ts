import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { goTo, setup } from './helpers.ts';

test('the landing page has five cards; the Learn page lists every topic with its level, Learn and Drill links', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Krotik', level: 1 })).toBeVisible();
  for (const name of [/^Grammar грамматика/, /^Vocabulary/, /Grammar test тест по грамматике/, /Reading/, 'Your progress']) await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  await page.getByRole('link', { name: 'See all topics' }).click();
  await expect(page).toHaveURL(/\/Krotik\/learn\/(\?.*)?$/);
  await expect(page.getByRole('link', { name: 'Drill: Verb forms' })).toBeVisible();
  await expect(page.locator('.topic', { hasText: 'Aspect partners' })).toContainText('A2–B1');
  await expect(page.getByRole('link', { name: 'Learn: Noun cases' })).toBeVisible();
  await page.getByRole('link', { name: 'Drill: Aspect partners' }).click();
  await expect(page).toHaveURL(/\/Krotik\/drill\/aspect\/(\?.*)?$/);
  await expect(page.getByRole('heading', { name: 'Set up your drill' })).toBeVisible();
  await expect(page.getByText(/You've chosen: Aspect partners/)).toBeVisible();
});

test('choosing a drill shows "Set up your drill", which leads to that drill’s settings', async ({ page }) => {
  await page.goto('./#/drill');
  await expect(page.getByRole('link', { name: 'Set up your drill' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
  await page.getByRole('radio', { name: /Plurals/ }).check();
  await page.getByRole('link', { name: 'Set up your drill' }).click();
  await expect(page).toHaveURL(/\/Krotik\/drill\/plurals\/(\?.*)?$/);
  await expect(page.getByText(/You've chosen: Plurals/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/Krotik\/drill\/(\?.*)?$/);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('radio', { name: /Plurals/ }).check();
  await page.getByRole('link', { name: 'Set up your drill' }).click();
  await page.getByRole('link', { name: 'Choose a different drill' }).click();
  await expect(page).toHaveURL(/\/Krotik\/drill\/(\?.*)?$/);
});

test('from the menu, the choose page has no drill selected', async ({ page }) => {
  await page.goto('./#/drill/plurals');
  await goTo(page, 'Drill');
  await expect(page).toHaveURL(/\/Krotik\/drill\/(\?.*)?$/);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Set up your drill' })).toHaveCount(0);
});

test('Continue starts a round with the saved settings', async ({ page }) => {
  await setup(page, 'Motion verbs');
  await goTo(page, 'Dashboard');
  await expect(page.getByText('Motion verbs', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Start another round', exact: true }).click();
  await expect(page.getByText('0 of 10 cleared')).toBeVisible();
});

test('the Continue card can be hidden, and comes back after the next drill', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Your last drill')).toBeVisible();
  await page.getByRole('button', { name: /Hide your last drill/ }).click();
  await expect(page.getByText('Your last drill')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Your last drill')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Grammar грамматика/ })).toBeVisible();
  await page.goto('./?seed=4#/drill/verbs');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText(/of \d+ cleared/)).toBeVisible();
  await goTo(page, 'Dashboard');
  await expect(page.getByText('Your last drill')).toBeVisible();
});

test('the Dashboard has no Culture card; Culture is in the main menu', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('main').getByRole('link', { name: /Culture/ })).toHaveCount(0);
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Culture' })).toBeVisible();
});

for (const width of [1280, 1000, 720, 390]) {
  test(`at ${width}px the main menu sits level with the logo: a bar on wide screens, a dropdown below 1000px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./learn/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const logo = (await page.getByRole('link', { name: 'Krotik, dashboard' }).boundingBox())!;
    const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
    if (width >= 1000) {
      await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
      await expect(nav.getByRole('link')).toHaveText(['Dashboard', 'Grammar test', 'Learn', 'Drill', 'Vocabulary', 'Reading', 'Writing', 'Culture']);
      await expect(nav.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
      // One line, on the logo's line.
      const tops = await nav.getByRole('link').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
      expect(Math.abs(centre(logo) - centre((await nav.getByRole('link').first().boundingBox())!))).toBeLessThanOrEqual(3);
    } else {
      const menu = page.getByRole('button', { name: 'Menu' });
      await expect(menu).toBeVisible();
      await expect(nav.getByRole('link')).toHaveCount(0);
      expect(Math.abs(centre(logo) - centre((await menu.boundingBox())!))).toBeLessThanOrEqual(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('the main menu dropdown opens, shows the current page, closes on Escape and after choosing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('./#/learn');
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Dashboard', 'Grammar test', 'Learn', 'Drill', 'Vocabulary', 'Reading', 'Writing', 'Culture']);
  await expect(nav.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('link')).toHaveCount(0);
  await expect(menu).toBeFocused();
  await goTo(page, 'Culture');
  await expect(page).toHaveURL(/\/Krotik\/culture\/(\?.*)?$/);
  await expect(nav.getByRole('link')).toHaveCount(0);
});

test('a Learn page shows data tables, real sentences and a working quick check', async ({ page }) => {
  await page.goto('./#/learn/nounCases');
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
  await expect(page).toHaveURL(/\/Krotik\/drill\/nounCases\/(\?.*)?$/);
  await expect(page.getByText(/You've chosen: Noun cases/)).toBeVisible();
});

test('every written Learn page loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/learn');
  const links = await page.locator('main li a[href*="/learn/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
  expect(links.length).toBeGreaterThanOrEqual(6);
  const learnOnly = ['wordOrder', 'complexSentences', 'modals', 'reportedSpeech', 'sounds'];
  for (const l of links) {
    await page.goto(l);
    await expect(page.locator('nav.pager')).toBeVisible();
    await expect(page.locator('.drill-cta')).toHaveCount(learnOnly.some((t) => l.endsWith(`/${t}/`)) ? 0 : 1);
    await expect(page.getByText(/couldn.t load|No example found/i)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('Learn-only topics: real sentences and IPA, a Learn link but no Drill link, and not on the Drill page', async ({ page }) => {
  await page.goto('./#/learn/wordOrder');
  await expect(page.locator('figure.sentence mark').first()).toHaveText('Книга');
  await expect(page.getByRole('link', { name: /Tatoeba #2171689/ })).toBeVisible();
  await page.goto('./#/learn/sounds');
  await expect(page.getByRole('row', { name: /хлеб.*xlʲep/ })).toBeVisible();
  await page.goto('./#/learn');
  await expect(page.getByRole('link', { name: 'Learn: Word order' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Drill: Word order' })).toHaveCount(0);
  await page.goto('./#/drill');
  await expect(page.getByRole('radio', { name: /Verb forms/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Word order/ })).toHaveCount(0);
});

test('the Krotik theme is the default, and the theme picker switches it', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'krotik');
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const theme of ['krotik', 'light', 'dark'] as const) {
  test(`no axe violations on Dashboard, Learn, Culture and the level test (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await page.goto('./');
    await page.getByLabel('Theme').selectOption(theme);
    for (const url of ['./#/', './start/', './#/learn', './#/learn/pronouns', './#/learn/alphabet', './#/learn/sounds', './#/learn/wordOrder', './#/culture', './#/culture/names', './#/test']) {
      await page.goto(url);
      await expect(page.locator('main')).not.toContainText('Loading…');
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    }
    // The level test's question (with a chosen option and a chosen "I don't know") and its explained results.
    const axe = async (where: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    };
    await page.getByRole('button', { name: 'Start the test' }).click();
    await page.keyboard.press('1');
    await axe('test question, option chosen');
    await page.keyboard.press('Enter');
    await page.keyboard.press('0');
    await axe('test question, I don’t know chosen');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'End test now' }).click();
    await page.getByText('Right answers').or(page.getByText('To look at again')).first().waitFor();
    await axe('test results');
  });
}

test('Culture lists links that open in a new tab, filters them, and opens notes', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'Culture');
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
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Media').selectOption('podcast');
  await expect(page.getByRole('heading', { name: /Podcasts/, level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Videos/, level: 3 })).toHaveCount(0);
  await page.getByRole('link', { name: /Names and patronymics/ }).click();
  await expect(page).toHaveURL(/\/Krotik\/culture\/names\/(\?.*)?$/);
  await expect(page.getByRole('heading', { name: /Names and patronymics/, level: 1 })).toBeVisible();
  await expect(page.locator('main table').first()).toContainText('Иванович');
});

test('the Culture page suggests an activity for each kind of resource', async ({ page }) => {
  await page.goto('./#/culture');
  // Links come 20 to a page, so pick each type in turn.
  for (const type of ['Videos', 'Cartoons', 'Films and series', 'Podcasts', 'Reading and audiobooks', 'Tools and dictionaries']) {
    await page.getByLabel('Media').selectOption({ label: type });
    await expect(page.locator('section.group').first().locator('.activity')).toContainText('Try this:');
  }
});

test('no embedded players or third-party requests on the Culture page', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname)) external.push(r.url());
  });
  await page.goto('./#/culture');
  await expect(page.getByText(/ of \d+ links/)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('the menu and pages fit a phone screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const url of ['./#/', './#/test', './#/culture', './#/culture/russian-beyond-russia']) {
    await page.goto(url);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Culture' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});

test('Learn quick checks offer the on-screen keyboard, which types into the answer', async ({ page }) => {
  await page.goto('./#/learn/nounCases');
  const check = page.getByRole('group', { name: 'Quick check' });
  await expect(check.getByText('Question 1 of 5')).toBeVisible();
  await check.getByRole('button', { name: /Cyrillic keyboard/ }).click();
  const kb = check.getByRole('group', { name: 'Cyrillic keyboard' });
  await kb.getByRole('button', { name: 'к', exact: true }).click();
  await kb.getByRole('button', { name: 'о', exact: true }).click();
  await kb.getByRole('button', { name: 'т', exact: true }).click();
  await expect(check.getByRole('textbox', { name: 'Your answer' })).toHaveValue('кот');
  await kb.getByRole('button', { name: 'Backspace' }).click();
  await expect(check.getByRole('textbox', { name: 'Your answer' })).toHaveValue('ко');
  await check.getByRole('button', { name: 'Hide keyboard' }).click();
  await expect(kb).toHaveCount(0);
});

test('the alphabet is the first Learn page and the first topic', async ({ page }) => {
  await page.goto('./#/learn');
  await expect(page.locator('main li a').first()).toHaveAttribute('href', '/Krotik/learn/alphabet/');
  await page.locator('main li a').first().click();
  await expect(page.getByRole('heading', { name: /The alphabet/, level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Quick check' }).getByText('Question 1 of 6')).toBeVisible();
  await page.goto('./#/learn');
  await expect(page.locator('.topic').first()).toContainText('The alphabet');
});

test('level test: 60 questions, Next/Back/Submit, I don’t know, early end, explained result kept in memory', async ({ page }) => {
  await page.goto('./?seed=9');
  await page.getByRole('link', { name: 'Take the test' }).click();
  await expect(page).toHaveURL(/\/Krotik\/test\/(\?.*)?$/);
  await page.getByRole('button', { name: 'Start the test' }).click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible({ timeout: 30_000 });
  const next = page.getByRole('button', { name: 'Next' });
  const dunno = page.getByRole('button', { name: /I don't know/ });
  // Next waits for an answer; choosing selects without moving on.
  await expect(next).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled();
  await page.getByRole('group', { name: 'Options' }).getByRole('button').first().click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible();
  await next.click();
  await expect(page.getByText('Question 2 of 60')).toBeVisible();
  // Back keeps the answer; it can be changed.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Options' }).getByRole('button', { pressed: true })).toHaveCount(1);
  await dunno.click();
  await expect(dunno).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Question 2 of 60')).toBeVisible();
  for (let n = 1; n < 59; n++) {
    await dunno.click();
    await next.click();
  }
  await expect(page.getByText('Question 60 of 60')).toBeVisible();
  await dunno.click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'Your grammar level' })).toBeVisible();
  await expect(page.getByText('Starting out')).toBeVisible();
  // Below A1, no level was reached, so nothing was "made up for", and the note doesn't name a level.
  await expect(page.getByText(/You missed \d+ of the \d+ questions at/)).toHaveCount(0);
  await expect(page.getByText(/A grammar result of/)).toHaveCount(0);
  await expect(page.getByText('0 right, 60 wrong or “I don\'t know”.')).toBeVisible();
  await expect(page.getByText('The answer is').first()).toBeVisible();
  // The result is still there after visiting a Learn page.
  await page.getByRole('link', { name: /^Learn: / }).first().click();
  await expect(page).toHaveURL(/\/Krotik\/learn\//);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Your grammar level' })).toBeVisible();
  await page.getByRole('button', { name: 'Take the test again' }).click();
  await page.getByRole('button', { name: 'Start the test' }).click();
  await expect(page.getByText('Question 1 of 60')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Question 2 of 60')).toBeVisible();
  await page.getByRole('button', { name: 'End test now' }).click();
  await expect(page.getByText('Based on the 1 questions you answered.')).toBeVisible();
  await expect(page.getByText(/You chose|right, 0 wrong/).first()).toBeVisible();
});

test('the guide is big for first-timers, then a small link that never disappears', async ({ page }) => {
  await page.goto('./');
  const card = page.getByRole('heading', { name: 'New to Krotik?' });
  const small = page.getByRole('link', { name: /New here\? Read the short guide/ });
  await expect(card).toBeVisible();
  await expect(small).toHaveCount(0);
  // Browsing elsewhere doesn't count: the card is still there when you come back.
  await page.goto('./learn/');
  await page.goto('./');
  await expect(card).toBeVisible();
  // "Got it" only makes it smaller; the guide stays one click away, after a reload too.
  await page.getByRole('button', { name: /Got it/ }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(small).toBeVisible();
  await small.click();
  await expect(page).toHaveURL(/\/Krotik\/start\/(\?.*)?$/);
  await expect(page.locator('.path li')).toHaveCount(11);
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Start here' })).toBeVisible();
});

test('opening the guide, or starting a first drill round, makes the card small too', async ({ page }) => {
  await page.goto('./start/');
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'New to Krotik?' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /New here\? Read the short guide/ })).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.goto('./?seed=1#/drill/verbs');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText(/of \d+ cleared/)).toBeVisible();
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'New to Krotik?' })).toHaveCount(0);
});

test('someone who hid the old guide card gets the small link, not nothing', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('krotik.settings.v1', JSON.stringify({ hideStart: true })));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New to Krotik?' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /New here\? Read the short guide/ })).toBeVisible();
});

test('Russian beyond Russia: the hub lists every country note; a country note has sources and its region\'s links', async ({ page }) => {
  await page.goto('culture/russian-beyond-russia/');
  const countries = page.getByRole('region', { name: 'Country by country' }).getByRole('link');
  await expect(countries).toHaveCount(10);
  await countries.filter({ hasText: 'Kazakhstan' }).click();
  await expect(page.getByRole('heading', { name: /Russian in Kazakhstan/, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Constitution of Kazakhstan/ })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('region', { name: 'Watch, read and listen' }).getByRole('link').first()).toBeVisible();
  await expect(page.locator('.crumbs')).toContainText('Russian beyond Russia');
  // Country notes aren't listed separately on the Culture page.
  await page.goto('culture/');
  await expect(page.locator('.notes').getByRole('link', { name: /Russian in Kazakhstan/ })).toHaveCount(0);
});

test('Culture links come 20 to a page, with Previous/Next and page numbers; a filter starts again at page 1', async ({ page }) => {
  await page.goto('culture/');
  await expect(page.locator('li.link')).toHaveCount(20);
  await expect(page.getByText(/^1–20 of \d+ links/)).toBeVisible();
  const pager = page.getByRole('navigation', { name: 'Pages of links' });
  await expect(pager.getByRole('button', { name: '← Previous' })).toBeDisabled();
  await pager.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByText(/^21–40 of \d+ links/)).toBeVisible();
  await expect(pager.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  await pager.getByRole('button', { name: /Page \d+/ }).last().click();
  await expect(pager.getByRole('button', { name: 'Next →' })).toBeDisabled();
  await page.getByLabel('From').selectOption('kazakhstan');
  await expect(page.getByRole('navigation', { name: 'Pages of links' })).toHaveCount(0);
  await expect(page.locator('li.link').first()).toBeVisible();
});

test('Report a problem opens a prefilled GitHub issue for the page or item, and sends nothing itself', async ({ page }) => {
  await page.goto('./learn/nounCases/');
  const footer = page.getByRole('link', { name: /^Report a problem/ }).last();
  const url = new URL((await footer.getAttribute('href'))!);
  expect(url.origin + url.pathname).toBe('https://github.com/will-corbett/Krotik/issues/new');
  expect(url.searchParams.get('body')).toContain('/Krotik/learn/nounCases/');
  await expect(footer).toHaveAttribute('target', '_blank');
  // The footer follows you to other pages.
  await page.getByRole('link', { name: /Next →/ }).click();
  expect(new URL((await page.getByRole('link', { name: /^Report a problem/ }).last().getAttribute('href'))!).searchParams.get('body')).not.toContain('nounCases');
  // A drill answer: the question and the expected answer go in the report.
  await page.goto('./drill/verbs/?seed=3');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: "I don't know" }).click();
  const q = new URL((await page.locator('.feedback').getByRole('link', { name: /^Report a problem/ }).getAttribute('href'))!);
  expect(q.searchParams.get('body')).toMatch(/Question: .*\nAnswer given as right: /);
});
