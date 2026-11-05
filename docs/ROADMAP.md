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

## Phase D — core grammar from data we have — done 2026-11-05
1. **Personal pronouns** (личные местоимения): я…они, себя, кто, что in every case; н- forms after
   prepositions (у него, к ней). Tables from Wiktionary.
2. **Noun declension** (склонение существительных): singular and plural, chosen cases.
3. **Prepositions with cases** (предлоги и падежи): Tatoeba sentences, noun after a preposition blanked.
4. **Aspect in context** (вид глагола в контексте): Tatoeba sentence, choose between the verb and its
   partner in the same form.
5. **Possessive and demonstrative pronouns** (мой, наш, свой, этот, тот, весь, чей) agreeing with a noun;
   **свой vs его/её/их** as multiple choice from Tatoeba.
6. **Stress drill** (ударение): tap the stressed vowel.
7. **Phonetic typing**: Latin → Cyrillic as you type (shch → щ, ya → я …), a Display toggle.

## Phase E — topics needing small hand-made lists — done 2026-11-05
1. **Verb government** (управление глаголов): ~80 verbs with their case/preposition (hand-made list,
   each verb checked in the data and illustrated by Tatoeba sentences where the noun really is in that case).
2. **Prefixed motion verbs** (приставочные глаголы движения): при-, у-, в-, вы-, за-, пере-, про-, под-,
   от-, до-, об-, с-, раз- … with meanings (hand-made meaning table; verbs from the data).
3. **Verbs of position** (стоять/ставить/встать, лежать/класть/лечь, сидеть/сажать/сесть, висеть/вешать):
   multiple choice from Tatoeba.
4. **Impersonal constructions** (безличные предложения): dative subject with надо/нужно/можно/нельзя/холодно…
5. **Comparisons**: genitive after a comparative (старше брата) vs чем.
6. **Conjunctions** (союзы): что / чтобы / если / когда, multiple choice. (if vs whether can't be one
   blank, because ли sits after the verb; "whether" stays in the particles drill.)
7. **Time expressions** (выражение времени): в + day (acc.), в + month (prep.), через / назад, from Tatoeba.
8. **Numbers**: ordinals (первый … сотый), compound numbers (двадцать пять, every part declines), collective
   numerals (двое, трое …).

Phase D/E notes: hand-made lists live in `curated/` (grammar facts only). Prefixed motion verbs: 89 pairs
found in the data; combinations missing from OpenRussian (e.g. вплыть/вплывать, провезти/провозить) are left
out and listed in the report. Compound numbers skip the animate accusative (usage is unsettled).

## Still planned from the original brief
- All folded into phases D and E above.
