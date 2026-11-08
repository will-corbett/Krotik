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

## Learn section (agreed 2026-11-06)
Three pages: Dashboard, Learn, Drill. Learn pages are written in batches for review:
1. **Batch 1 (done):** noun cases, verb forms, aspect, motion verbs, adjective agreement, personal pronouns.
2. **Batch 2 (done):** reflexive verbs, aspect in context, verbal adverbs, participles, verb government,
   prefixed motion verbs, verbs of position, short forms, comparatives, possessives, plurals, numbers, diminutives.
3. **Batch 3 (done):** prepositions, который, чтобы, conditional, negation, indefinite pronouns, particles,
   impersonal constructions, comparisons, conjunctions, time expressions, stress. Every topic now has a Learn page.

## Still planned from the original brief
- All folded into phases D and E above.

## Syllabus review (agreed 2026-11-06)
An outside review of the Learn pages found verb grammar well covered and sentence-level and some noun grammar
thin. Aim: comfortably A1–B2, with selected C1. Topics that can't be drilled from verified data get
Learn-only pages (marked as such on the Dashboard). Words first, then sentences, then deeper existing pages.

4. **Batch 4 — word-level topics (done 2026-11-06):** each with a drill and a Learn page.
   - **Adverbs** (наречия): adjective → adverb (Wiktionary, paired by etymology or the short neuter form),
     adverb → comparative, and "adverb or adjective?" in Tatoeba sentences.
   - **Question words** (вопросительные местоимения): кто/что in every case, чей/какой agreeing with a noun,
     real Tatoeba questions to complete (multiple choice among forms of the same word).
   - **Ordinals and dates** (порядковые числительные): agreement, dates (пятого мая), centuries
     (в двадцатом веке); fractions explained on the Learn page.
   - **Special case forms**: the second prepositional (в лесу / о лесе; ~100 masculine nouns from
     Wiktionary) drilled; the partitive (чашка чаю) explained only, because it is optional.
5. **Batch 5 — sentence-level (next):** Learn-only pages where a drill can't be verified:
   complex and subordinate clauses (cause, concession, consequence, contrast; потому что, хотя, поэтому,
   несмотря на то что — these can get a Tatoeba multiple-choice drill), passive constructions,
   word order (тема и рема), reported speech.
6. **Batch 6 — deeper existing pages:** noun declension patterns, verb conjugation and spelling rules, aspect
   with modals and negation, more on prepositions and negation, irregular adjectives.
- Left out for now: interjections and introductory words, vocative forms (мам, пап).

## Level test and alphabet (done 2026-11-06)
- Level test: 60 multiple-choice questions (A1–C1), approximate level, review list.
- The alphabet: first Learn page and first topic, with its own drill (letters, reading, writing).
- Topics ordered easiest first within each group; on-screen keyboard in Learn quick checks.
- Next from the syllabus review: batch 5 (sentence-level, Learn-only where needed) and batch 6.

## External audit (2026-11-07): plan agreed with the owner
Done in batches, each reviewed before the next.
1. **Quick fixes (done):** "Grammar test" naming and wording (grammar, not a full CEFR level); Dashboard "Start
   another round"; menu as a bar on desktop; Learn pages show a topic level, related topics and previous/next links;
   aspect (several perfectives, both-aspect and one-aspect verbs) and participle formation explained more fully;
   Common mistakes in ten lessons.
2. **New Learn pages (done):** word order (тема и рема), complex sentences (an overview linking который/чтобы/
   conditionals/conjunctions), modal constructions, reported speech, sounds and spelling (IPA from Wiktionary). These
   are Learn-only topics; their examples are real Tatoeba sentences quoted by id (`::tatoeba`).
3. **Exercises (done):** mixed review drill; translate-and-compare drill (the Tatoeba sentence as the model, self-marked);
   end-screen breakdown by question type; **opt-in, browser-only progress** (off by default, never sent anywhere) for
   weak topics and revision suggestions. The owner chose this; it changes the "never store progress" rule, so the
   rule and the About page must say exactly what is kept and how to clear it.
4. **Culture and tests (done):** a suggested activity per resource type, more Kazakh and Central Asian links (checked by
   hand); e2e for failed data requests, reload mid-drill and Back/Forward.
- Prerendering for search engines (done, 2026-11-07): real page addresses, an HTML file per page, sitemap.
- Reading (pilot, 2026-11-07): the owner tried a gap-fill drill on literature and rejected it (it rewards memorising
  the author's choice, e.g. tense, over what's grammatical). Replaced by a Reading section: 15 Tolstoy stories and both
  Chekhov comedies scene by scene, every word explained on hover/tap, 2–3 comprehension questions per text in English
  or Russian. Then (2026-11-07) the rest of Tolstoy's book: 60 stories in all; four stay out (Уж, Лозина and Ермак have too many dialect words to gloss reliably; Воробей и ласточки has a transcription error, всб for всё, and the text is never edited).
- Vocabulary (2026-11-08): the owner agreed to relax "never store words", opt-in only. A Vocabulary drill of the
  commonest words (choose the meaning / type the word); "My words", a per-word spaced-repetition record (word key,
  band, box, dates; off by default, browser only, export/import as a file, deleted with progress); Reading's key words
  (practise them, add them) and Add to my words from any explained word.
- Vocabulary section (2026-11-08; first called Words, owner's choices: our own dialogues, reviewed by a native speaker; the full set of
  themes; its own menu item and home card): 16 themes, 436 words, a real sentence for each, 32 dialogues written and
  waiting for review (`reports/dialogues-for-review.md`); they appear on the site only once marked reviewed.
- Vocabulary section, expanded (2026-11-08): 38 themes from A1 to B2 (B1 grown to nine, B2 new with nine), about 900
  words, 76 dialogues waiting for review; buttons at the top jump to a level.
- C1 (2026-11-08): nine themes, five about the language (formal style, argument, shades of meaning, word families,
  describing people) and four topics (ethics, information, negotiation, history); 94 dialogues now wait for review.
  Idioms and set phrases are left for later: the word lists hold single words, so they need a phrase source.
- Next for vocabulary: curated English meanings for the top 2,500 (the source's are sometimes long-winded); audio from
  Wikimedia Commons for the top 1,000 (self-hosted, credited), for devices without a Russian voice; themed sets from
  Wiktionary categories; word families.
- Known source problem: OpenRussian's lists put some common words near the end (the verb стать, белый, правило, весь,
  лёгкий), so they land in the "Everything" band in every drill, not just Vocabulary. Re-ranking those from the
  frequency list would change every drill's "Top N"; not done yet.
- Not doing: model-answer writing.

## External critique (2026-11-08): plan agreed with the owner
Verdict 8/10: strong grammar and engineering; the main gap is coherence (a curriculum, not just a topic map), then
listening, production and reading breadth. Owner's decisions: desktop nav = a bar on wide screens only (about
1000px and up, on the logo's line), dropdown below; host native audio from Mozilla Common Voice (CC0) and Wikimedia
Commons (CC BY-SA, credited; only files whose licence allows commercial use); reading = more public-domain literature
and Ru Wikinews (CC BY; politics only as history before 2014, nothing on the war); no own graded texts for now. Batches, in order:
1. Quick fixes and coherence (done 2026-11-08): Vocabulary wording only promises published dialogues; prominent "grammar only, not a
   full CEFR level" note on the test results; wider layout (about 960px; reading stays narrow); export/import of all
   progress; a Report a problem link (GitHub issue or email, prefilled, nothing sent automatically); desktop nav bar on
   wide screens; learning paths A1 to C1 (Learn topics, Vocabulary themes and Reading in a recommended order); a
   personalised home page when progress is on; Learn index filters (level, group, studied, needs revision).
2. Production (done 2026-11-08; guided writing without model answers until native review): vocabulary gap-fill per theme; build the sentence (self-marked, Russian order is free); translate
   Russian to English; error correction (a real form swapped for another real form of the same word); a typed stage
   of the grammar test (receptive vs productive results); guided writing with a checklist and model answer.
3. Listening (done 2026-11-08; owner's decision: Tatoeba sentence recordings instead of Common Voice, whose download
   now needs an account and has no translations; Common Voice may come later for advanced no-translation listening):
   Tatoeba sentence recordings (listen and choose, dictation, hear the ending), Commons word recordings (instead of the
   device voice where available, minimal pairs), about 4,000 words and 5,700 sentences, fetched gradually by a
   scheduled workflow; record-and-compare kept on the device (no speech recognition: it sends audio to third
   parties). Possible later: more word recordings (all 7,700 available), Common Voice.
4. Reading: more public-domain literature, then Wikinews; inference and tone questions at B2 and C1.
5. Depth: fuller syntax lessons (word order with a drill, reported speech, register, discourse, aspect nuance);
   register labels from Wiktionary; curated collocations from Tatoeba co-occurrence; idioms from Wiktionary.
Not doing: accounts or sync, social features, leaderboards, gamification, animations, a chatbot, speech recognition.

