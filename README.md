# Krotik

Learn and drill Russian grammar and vocabulary. There are no accounts and no analytics; progress tracking (topic results
and your words) is optional, off by default, and kept only in your browser.

- **Home**: your last drill, and cards for Grammar (Learn & drill), Vocabulary, the Grammar test, Reading and (if you turn it on) your progress,
  whose details (weak topics, topics due for revision, a mixed review of them) are on their own page.
- **Learn & drill**: every topic, easiest first in each group, with its level, Learn page and drill.
- **Grammar test**: 60 multiple-choice questions from A1 to C1, an approximate grammar level with what it means, every
  wrong answer explained, and the Learn pages worth reviewing.
- **Learn**: short explanations with tables and real sentences from the data, and a quick check on each page
  (`content/learn/*.md`).
- **Drill**: the drills below, with retries, example sentences and audio, plus a mixed review of several topics and a
  translate-and-compare drill. A **Vocabulary** drill covers the commonest words both ways round; with progress on, the
  words you practise (or add while reading) come back for review on a spaced-repetition schedule. The end screen breaks results down by question type or topic.
- **Vocabulary**: words in 47 themes from A1 to C1 (food, family, travel, work, the law, science, formal Russian, shades of meaning…): words with stress and meaning,
  a real sentence for each, short dialogues where every word can be tapped (published once a native speaker has
  checked them), and practice rounds (`content/words/*.yaml`).
- **Reading**: short stories by Tolstoy and comedies by Chekhov (public domain), with every word explained on hover or
  tap and comprehension questions in English or Russian (`curated/literature.yaml`, `content/reading/questions.yaml`).
- **Culture**: about 120 hand-picked links to videos, cartoons, films, podcasts, books and tools, each type with a suggested activity, filterable by level, topic and region (`content/culture/links.yaml`),
  and short culture notes (`content/culture/notes/*.md`). `npm run links:check` checks the links (monthly in CI).

Modes are grouped as follows:
- **Getting started:** the alphabet.
- **Verbs:** forms, reflexives, aspect partners and aspect in context, motion verbs (plain and prefixed), verbal adverbs, participles, government, verbs of position.
- **Pronouns:** personal, possessive and demonstrative, question words.
- **Adjectives:** agreement, short forms, comparatives and superlatives, adverbs.
- **Nouns & numbers:** cases, plurals, numbers, ordinals and dates, special case forms, diminutives.
- **Sentences:** который, чтобы, conditional, negation, indefinite pronouns, particles, prepositions, impersonal constructions, comparisons, conjunctions, time.
- **Pronunciation:** stress.
- **Words:** vocabulary (nouns, verbs, adjectives and other words, by frequency; or your words that are due).

## Run locally

Needs Node 22.12 or newer.

```bash
npm install
npm run data       # first time: downloads the sources (~140 MB, cached in data-raw/) and builds public/data/
npm run dev        # http://localhost:5173
```

The generated data isn't committed. `npm run data` rebuilds it from the sources, and so does CI.

## Tests

```bash
npm test                          # unit tests (need the data built)
npx playwright install chromium   # once
npm run e2e                       # browser smoke tests (desktop + mobile)
npm run check                     # type checks
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which:
1. downloads the sources (cached for a month);
2. builds and validates the data;
3. runs the type checks, unit tests and browser tests;
4. deploys `dist/` to GitHub Pages.

The validation report is attached to each run as an artifact.

## Data

Hand corrections live in `overrides/overrides.yaml`; small hand-made grammar lists live in `curated/`.
See `CLAUDE.md` for the rules.

Sources:
- [OpenRussian.org](https://en.openrussian.org) (CC BY-SA 4.0, built on Wiktionary)
- [Wiktionary](https://en.wiktionary.org) via [kaikki.org](https://kaikki.org) (CC BY-SA 4.0)
- [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR)

Derived data keeps those licences.
