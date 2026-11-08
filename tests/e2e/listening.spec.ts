/**
 * Listening (critique batch 3). The recordings are collected a little at a time (scripts/fetch-audio.ts), so how many a
 * build has depends on its cache: these tests serve a small fixed set instead (made-up test data, not shipped), with a
 * short silent sound for every recording.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AudioIndex, ListeningData } from '../../src/shared/types.ts';

/** A tenth of a second of silence, as a WAV file. */
function silence(): Buffer {
  const n = 800;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}

const LISTENING: ListeningData = {
  sentences: [
    [101, 'Я дома.', "I'm at home."],
    [102, 'Это мой дом.', 'This is my house.'],
    [103, 'Где твой дом?', 'Where is your house?'],
    [104, 'Кошка спит.', 'The cat is sleeping.'],
    [105, 'Мы идём домой.', "We're going home."],
  ],
  endings: [
    [102, 8, 11, ['дом', 'дома', 'дому']],
    [104, 0, 5, ['Кошка', 'Кошки', 'Кошку']],
    [103, 9, 12, ['дом', 'дома', 'дому']],
    [101, 2, 6, ['дом', 'дома', 'дому']],
  ],
  pairs: [
    ['soft', 'v:1', 'брат', 'v:2', 'брать'],
    ['yi', 'v:3', 'был', 'v:4', 'бил'],
    ['soft', 'v:5', "у'гол", 'v:6', "у'голь"],
    ['soft', 'v:7', 'кон', 'v:8', 'конь'],
  ],
};
const AUDIO: AudioIndex = {
  credits: [
    ['Reader One', 'CC BY 4.0', 'https://tatoeba.org/user/profile/x', 'tatoeba', 'https://creativecommons.org/licenses/by/4.0/'],
    ['Speaker Two', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/User:Y', 'commons', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ],
  words: Object.fromEntries(['v:1', 'v:2', 'v:3', 'v:4', 'v:5', 'v:6', 'v:7', 'v:8'].map((k) => [k, [k.replace(':', ''), 1]])),
  sentences: { 101: 0, 102: 0, 103: 0, 104: 0, 105: 0 },
};

async function serve(page: Page, listening = LISTENING, audio = AUDIO) {
  await page.route('**/data/listening.json', (r) => r.fulfill({ json: listening }));
  await page.route('**/data/audio.json', (r) => r.fulfill({ json: audio }));
  await page.route('**/audio/**', (r) => r.fulfill({ body: silence(), contentType: 'audio/wav' }));
}
const played = (page: Page) => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/audio/')).map((e) => e.name.replace(/.*\/audio\//, '')));

async function start(page: Page, mode: string) {
  await page.goto(`drill/${mode}/?seed=5`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('radio', { name: '10', exact: true }).check();
  await page.getByRole('button', { name: 'Start' }).click();
}

test('listen and choose: the recording plays at once; after answering, the sentence, its English and the reader', async ({ page }) => {
  await serve(page);
  await start(page, 'listen');
  await expect(page.getByRole('button', { name: /Play/ })).toBeVisible();
  await expect.poll(() => played(page)).toHaveLength(1);
  await expect(page.getByRole('heading', { name: 'Listen' })).toBeAttached();
  await page.getByRole('button', { name: 'Slower' }).click();
  await axe(page, 'listen');
  await page.keyboard.press('1');
  await expect(page.locator('.feedback .solution')).toBeVisible();
  await expect(page.locator('.feedback .listen-en')).toBeVisible();
  await expect(page.getByText('Recording:').first()).toContainText('Reader One (CC BY 4.0, Tatoeba)');
  await expect(page.getByRole('link', { name: 'CC BY 4.0' }).first()).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
  // Record yourself: on the device only.
  await expect(page.getByRole('button', { name: 'Record yourself' })).toBeVisible();
  await expect(page.getByText("it's never saved or sent anywhere")).toBeVisible();
});

test('dictation: write what you hear; the words you missed are marked', async ({ page }) => {
  await serve(page);
  await start(page, 'dictation');
  const box = page.getByRole('textbox', { name: 'Your answer' });
  await expect(box).toBeFocused();
  await box.fill('ъъъ');
  await box.press('Enter');
  await expect(page.locator('.feedback .verdict')).toHaveText('Not quite');
  await expect(page.locator('.feedback .diff .missed').first()).toBeVisible();
});

test("dictation: punctuation and capitals don't count", async ({ page }) => {
  // Every recording here is of the same sentence, so we know what's being said.
  await serve(page, { ...LISTENING, sentences: LISTENING.sentences.map(([id, , en]) => [id, 'Это мой дом.', en]) });
  await start(page, 'dictation');
  const box = page.getByRole('textbox', { name: 'Your answer' });
  await box.fill('это мой дом');
  await box.press('Enter');
  await expect(page.locator('.feedback .verdict')).toHaveText('Correct');
});

test('hear the ending: the sentence with a gap, options to choose from', async ({ page }) => {
  await serve(page);
  await start(page, 'endings');
  await expect(page.locator('.frame .blank')).toHaveText('___');
  await expect(page.getByRole('group', { name: 'Choose the missing word' }).getByRole('button')).toHaveCount(3);
  await page.keyboard.press('1');
  await expect(page.locator('.feedback .solution')).toBeVisible();
});

test('minimal pairs: a word is played, two to choose from', async ({ page }) => {
  await serve(page);
  await start(page, 'pairs');
  const options = page.getByRole('group', { name: 'Choose what you heard' }).getByRole('button');
  await expect(options).toHaveCount(2);
  await expect.poll(() => played(page)).toEqual([expect.stringMatching(/^w\/v\d\.mp3$/)]);
  await options.first().click();
  await expect(page.getByText('Recording:').first()).toContainText('Speaker Two (CC BY-SA 4.0, Wikimedia Commons)');
});

test('before any recordings are collected, the drill says so', async ({ page }) => {
  await serve(page, { sentences: [], endings: [], pairs: [] }, { credits: [], words: {}, sentences: {} });
  await page.goto('drill/dictation/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('The recordings for this drill are still being collected')).toBeVisible();
});

test('About credits everyone whose recordings are used', async ({ page }) => {
  await serve(page);
  await page.goto('about/');
  await expect(page.getByRole('heading', { name: 'Who recorded the words and sentences' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Reader One' })).toContainText('5 recordings (CC BY 4.0, Tatoeba)');
  await expect(page.getByRole('listitem').filter({ hasText: 'Speaker Two' })).toContainText('8 recordings (CC BY-SA 4.0, Wikimedia Commons)');
});

async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
}
