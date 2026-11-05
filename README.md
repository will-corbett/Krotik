# Russian Grammar Drills

Instant drills for Russian grammar. Open the page, pick options and start. There are no accounts and no tracking.

Modes are grouped as follows:
- **Verbs:** forms, reflexives, aspect partners and aspect in context, motion verbs (plain and prefixed), verbal adverbs, participles, government, verbs of position.
- **Pronouns:** personal, possessive and demonstrative.
- **Adjectives:** agreement, short forms, comparatives and superlatives.
- **Nouns & numbers:** cases, plurals, numbers, diminutives.
- **Sentences:** который, чтобы, conditional, negation, indefinite pronouns, particles, prepositions, impersonal constructions, comparisons, conjunctions, time.
- **Pronunciation:** stress.

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
