/** Listening (critique batch 3): recordings, their licences and credits, and the four listening drills. */
import { describe, expect, it } from 'vitest';
import { artistLink, commonsAuthor, commonsLicenceOk, plainArtist, TATOEBA_OK, wantedAudio } from '../../scripts/lib/audio.ts';
import { findPairs, soundKey } from '../../scripts/lib/listening.ts';
import { dictationLength, generateDictationQuestions, generateEndingQuestions, generateListenQuestions, generatePairQuestions, wordDiff } from '../../src/lib/questions/listening.ts';
import { sameSentence } from '../../src/lib/questions/translate.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ListeningData } from '../../src/shared/types.ts';
import { Report } from '../../scripts/lib/report.ts';

describe('licences', () => {
  it('uses only recordings that allow commercial use and changes', () => {
    for (const ok of ['CC BY 2.0 fr', 'CC BY-SA 4.0', 'CC BY 3.0 us', 'CC0', 'Public domain', 'CC-BY-SA-3.0']) expect(commonsLicenceOk(ok), ok).toBe(true);
    for (const no of ['CC BY-NC 4.0', 'CC BY-NC-SA 3.0', 'CC BY-ND 4.0', 'GFDL', '']) expect(commonsLicenceOk(no), no).toBe(false);
    expect([...TATOEBA_OK].sort()).toEqual(['CC BY 4.0', 'CC0 1.0']);
  });
  it('credits the speaker (Lingua Libre), the named author, or the project that provided the file', () => {
    expect(commonsAuthor('<ul><li>Speaker: <a href="//lingualibre.org/wiki/Q1">Anna</a></li><li>Recorder: <a href="//commons.wikimedia.org/wiki/User:Bob">Bob</a></li></ul>')).toEqual({ name: 'Anna', link: 'https://lingualibre.org/wiki/Q1' });
    expect(commonsAuthor('Audio sample provided by <a href="//commons.wikimedia.org/wiki/Commons:Shtooka">The Shtooka Project</a>.')?.name).toBe('The Shtooka Project');
    expect(commonsAuthor('Сергей Сахно')).toEqual({ name: 'Сергей Сахно', link: null });
    expect(commonsAuthor('  ')).toBeNull();
    expect(plainArtist('<b>A &amp; B</b>')).toBe('A & B');
    expect(artistLink('<a href="/wiki/User:X">X</a>')).toBe('https://commons.wikimedia.org/wiki/User:X');
  });
});

describe('what to fetch', () => {
  it('wants only a recording of the same stress, CC BY / CC0 sentences of up to 10 words, shortest first', () => {
    const w = wantedAudio({
      words: [
        { key: 'n:1', accented: "за'мок", bare: 'замок' },
        { key: 'n:2', accented: 'дом', bare: 'дом' },
      ],
      commons: { замок: [["замо'к", 'Ru-замок.ogg', 'u']], дом: [['дом', 'LL-Q7737 (rus)-X-дом.wav', 'a'], ['дом', 'Ru-дом.ogg', 'b']] },
      pairs: [
        { rid: 1, ru: 'Я дома.' },
        { rid: 2, ru: 'Это мой дом.' },
        { rid: 3, ru: 'Это.' },
        { rid: 4, ru: 'Раз два три четыре пять шесть семь восемь девять десять одиннадцать.' },
      ],
      tatoeba: [
        { rid: 2, audio: 20, user: 'a', licence: 'CC BY 4.0', url: '' },
        { rid: 1, audio: 10, user: 'b', licence: 'CC0 1.0', url: '' },
        { rid: 3, audio: 30, user: 'c', licence: 'CC BY-NC 4.0', url: '' },
        { rid: 4, audio: 40, user: 'a', licence: 'CC BY 4.0', url: '' },
      ],
      report: new Report(),
    });
    // за'мок: the only file is of замо'к. дом: the Ru- recording is preferred.
    expect(w.words).toEqual([{ key: 'n:2', file: 'Ru-дом.ogg', mp3: 'b' }]);
    expect(w.sentences.map((s) => s.rid)).toEqual([1, 2]);
  });
});

describe('sounds alike', () => {
  it('reduces unstressed vowels and devoices a final consonant', () => {
    expect(soundKey("кни'ге")).toBe(soundKey("кни'ги"));
    expect(soundKey("молоко'")).toBe('малако');
    expect(soundKey('хлеб')).toBe('хлеп');
    expect(soundKey("кни'гу")).not.toBe(soundKey("кни'ге"));
    expect(soundKey("рука'")).not.toBe(soundKey("ру'ку"));
  });
  it('pairs real words that differ only in a final soft sign, ы/и or ш/щ', () => {
    const p = findPairs(['брат', 'брать', 'был', 'бил', 'жил', 'жыл', 'дом'].map((accented, i) => ({ key: `k${i}`, accented })));
    expect(p.map((x) => [x[0], x[2], x[4]])).toEqual([
      ['soft', 'брат', 'брать'],
      ['yi', 'был', 'бил'],
    ]);
  });
});

const DATA: ListeningData = {
  sentences: [
    [1, 'Я дома.', "I'm at home."],
    [2, 'Это мой дом.', 'This is my house.'],
    [3, 'Где твой дом?', 'Where is your house?'],
    [4, 'Мы пошли в кино, а потом домой.', 'We went to the cinema and then home.'],
    [5, 'Кошка спит.', 'The cat is sleeping.'],
  ],
  endings: [[2, 8, 11, ['дом', 'дома', 'дому']]],
  pairs: [['soft', 'k1', 'брат', 'k2', 'брать']],
};

describe('listening questions', () => {
  it('listen and choose: four different options, the recording is the prompt', () => {
    const qs = generateListenQuestions(DATA, { tasks: ['text', 'meaning'] }, 5, mulberry32(1));
    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(q.listen?.rid).toBe(q.source);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices).toContain(q.answer);
      expect(q.headword).toBe('');
    }
  });
  it('"what did you hear?" prefers sentences sharing words with the recorded one', () => {
    const q = generateListenQuestions(DATA, { tasks: ['text'] }, 5, mulberry32(2)).find((x) => x.source === 2)!;
    expect(q.choices).toContain('Где твой дом?');
  });
  it('dictation keeps to the chosen lengths and ignores punctuation and capitals', () => {
    expect(dictationLength('Это мой дом.')).toBe('short');
    expect(generateDictationQuestions(DATA, { lengths: ['long'] }, 9, mulberry32(1)).map((q) => q.source)).toEqual([4]);
    expect(sameSentence('это мой дом', 'Это мой дом.', normalise)).toBe(true);
  });
  it('dictation feedback marks the words you missed or spelt differently', () => {
    expect(wordDiff('это дом', 'Это мой дом.', normalise)).toEqual([
      { word: 'Это', ok: true },
      { word: 'мой', ok: false },
      { word: 'дом', ok: true },
    ]);
  });
  it('hear the ending: the sentence with a gap, the form in the sentence among the options', () => {
    const [q] = generateEndingQuestions(DATA, 5, mulberry32(1));
    expect(q).toMatchObject({ frame: 'Это мой ___.', answer: 'дом', mode: 'endings' });
    expect([...q!.choices!].sort()).toEqual(['дом', 'дома', 'дому']);
  });
  it('minimal pairs: each word of a pair comes up, with both as the options', () => {
    const qs = generatePairQuestions(DATA, { types: ['soft'] }, 5, mulberry32(1));
    expect(qs.map((q) => q.answer).sort()).toEqual(['брат', 'брать']);
    for (const q of qs) expect(q.choices).toEqual(['брат', 'брать']);
    expect(generatePairQuestions(DATA, { types: ['yi'] }, 5, mulberry32(1))).toEqual([]);
  });
});
