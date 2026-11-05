# Drilbur

Instant drills for Russian: verb forms, aspect partners, adjective agreement and verbs of motion.
Open the page, pick options and start. There are no accounts and no tracking.

## Run locally

Needs Node 22.12 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build: `npm run build`, then serve `dist/` with any static host (`npm run preview` to try it).

## Tests

```bash
npm test                          # unit tests
npx playwright install chromium   # once
npm run e2e                       # browser smoke tests (desktop + mobile)
npm run check                     # type checks
```

## Data

`npm run data` downloads the sources and regenerates `public/data/` and `reports/validation.md`.
Hand corrections live in `overrides/overrides.yaml`. See `CLAUDE.md` for the rules.

Sources: [OpenRussian.org](https://en.openrussian.org) (CC BY-SA 4.0, built on Wiktionary) and
[Tatoeba](https://tatoeba.org) (CC BY 2.0 FR). Derived data in `public/data/` keeps those licences.
