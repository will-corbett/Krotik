# Roadmap

Agreed 2026-11-05. Each phase ends with tests passing and an updated `reports/validation.md`
covering the new data (what's kept, dropped and why). Every form comes from a source; sentence answers
are the word actually used in a real Tatoeba sentence.

## Done (milestone 1 and follow-ups)
- Verb forms, aspect partners, adjective agreement, motion verbs; retry queue; sentences; audio; keyboard.
- Unlimited rounds; End round always visible.
- Grammar terms shown with their Russian equivalents.

## Setup screen
Grouped mode picker (done for Phase A):
**Verbs** (forms, reflexive, aspect, motion, verbal adverbs, participles, conditional, чтобы) ·
**Adjectives** (agreement, short forms, comparatives/superlatives) ·
**Nouns & numbers** (plurals, diminutives, numbers) ·
**Sentences** (который, negation, indefinite pronouns, particles).

## Phase A — from data already in the repo (OpenRussian) — done 2026-11-05
1. **Reflexive verbs** (возвратные глаголы): verb forms restricted to -ся/-сь verbs; validation that
   -сь follows vowels and -ся consonants.
2. **Short-form adjectives** (краткие прилагательные): short_m/f/n/pl columns; stress shifts included.
3. **Comparatives and superlatives** (сравнительная и превосходная степень): source comparative
   (быстрее) and superlative (быстрейший) columns; compound самый + adjective from existing forms.
4. **Plurals in context** (множественное число):
   - nominative plural formation, including irregulars (дом → дома́, друг → друзья́);
   - plural in every case (genitive plural especially);
   - after numbers: 1 → nom. sg., 2–4 → gen. sg., 5+ → gen. pl.;
   - after quantity words: много, мало, несколько, сколько, нет → gen. pl.
   Plural drills don't need gender, so the ~5,100 nouns without gender in the source can be used here.

   Phase A notes: comparatives exist for only ~290 adjectives and -ейший superlatives for ~180 in OpenRussian
   (149 and 115 of the top 1,000) — Phase B can add more from Wiktionary. Substantivised adjectives
   (будущее, управляющий) count as nouns in the source, so a few quantity questions read oddly (много будущего).

## Phase B — Wiktionary import (kaikki.org JSONL, 91 MB gzipped, streamed; CC BY-SA) — done 2026-11-05
1. **Verbal adverbs** (деепричастия): present (читая) and past (прочитав).
2. **Participles** (причастия): active present/past, passive present/past; short passive participles;
   then full declension.
3. **Numbers** (склонение числительных): один, два–четыре, пять–двадцать, тридцать, сорок, девяносто,
   сто, сотни, тысяча — in all cases, and with nouns (links to A4).
4. **Diminutives** (уменьшительно-ласкательные): noun → any listed diminutive (дом → домик, домок).
5. Bonus: fill missing noun genders from Wiktionary where both sources agree.

## Phase C — sentence drills from Tatoeba — done 2026-11-05
1. **Engine**: real sentence with a blank, lemma in brackets; typed answers for form topics, multiple
   choice for meaning topics. Only tokens that map unambiguously to one lemma and form; sentence deny list
   in overrides.
2. **который** (relative clauses): type the right form; gender/number from the antecedent, case from its role.
3. **чтобы** (purpose): infinitive (same subject) or past tense (different subject).
4. **Conditional** (условное наклонение): past tense + бы.
5. **Negation** (отрицание): нет + genitive (typed); никто/ничто/никогда … не (typed); не vs ни (choice).
6. **Indefinite pronouns** (неопределённые местоимения): -то / -нибудь / кое- (multiple choice).
7. **Particles** (частицы), multiple choice: ли (incl. indirect questions); же, ведь; не vs ни;
   -ка, вот, ну, даже, только.

Phase C notes: up to 1,500 sentences per item kind (e.g. чтобы + infinitive, чтобы + past), chosen
deterministically; a round picks the kind first so rare kinds (чтобы + past, ну, -ка) get a fair share.
-ка has only ~100 sentences. In multiple choice some distractors can also fit (же/ведь, -то/-нибудь); only
the sentence's own word counts, and the English translation is the cue.

## Still planned from the original brief
- Stress-marking drill (tap the stressed vowel).
- Phonetic typing (Latin → Cyrillic as you type).
- Verb + case government (помогать + dative), prefixed motion verbs.
- Full noun and adjective declension drills.
