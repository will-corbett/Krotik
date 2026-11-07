<script lang="ts">
  let { onback }: { onback: () => void } = $props();
</script>

<article class="card about fade-in">
  <h1>About</h1>
  <p>
    Krotik is a no-login drill for Russian grammar: verb forms, aspect, motion verbs, participles and verbal adverbs,
    adjectives, plurals, numbers, diminutives, and sentence drills (который, чтобы, conditional, negation,
    indefinite pronouns, particles), with a vocabulary drill of the commonest words. There are no accounts, no analytics and no cookies. Your drill settings are
    remembered in this browser.
  </p>
  <h2>Your progress</h2>
  <p>
    Progress tracking is <strong>off</strong> unless you turn it on (on the home page or the Progress page). When it's
    on, this browser keeps two things:
  </p>
  <ul>
    <li>
      For each topic you drill: how many rounds you've done, how many questions you got right first time, the results of
      your last five rounds, and the date you last practised (<code>krotik.progress.v1</code>).
    </li>
    <li>
      Your words: for each word you practise in the Vocabulary drill or add while reading, which word it is (a reference
      to the word list), which frequency band it's in, how well you know it (a step from 0 to 6) and the dates you added
      it and it's next due (<code>krotik.words.v1</code>).
    </li>
  </ul>
  <p>
    That's all: no answers, nothing you type, and no times are kept, and Learn-page checks and the Grammar test aren't
    recorded. Both are stored in this browser's local storage, are never sent anywhere, and aren't shared between your
    devices. You can move your words to another device yourself: <em>Export to a file</em> on the Progress page saves
    them as a file on your device, and <em>Import from a file</em> reads one; nothing is uploaded. To delete everything,
    choose <em>Turn off…</em> on the Progress page (or <em>Delete my words…</em> for the words alone), or clear this
    site's data in your browser.
  </p>
  <p>
    A wrong answer comes back about ten cards later (or at the end, if fewer are left, so it also works in unlimited rounds), and a round finishes only when every question has been answered
    correctly. The score counts answers that were right the first time.
  </p>

  <h2>Sources and licences</h2>
  <ul>
    <li>
      Word forms, stress and glosses: <a href="https://en.openrussian.org" rel="noopener">OpenRussian.org</a>
      dictionary export (<a href="https://github.com/Badestrand/russian-dictionary" rel="noopener">Badestrand/russian-dictionary</a>),
      licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a> and built on
      <a href="https://en.wiktionary.org" rel="noopener">Wiktionary</a>. A few forms were corrected by hand after checking
      them against Wiktionary.
    </li>
    <li>
      Participles, verbal adverbs, numerals, diminutives, some comparatives and noun genders, and the pronunciations (IPA) on the Learn pages:
      <a href="https://en.wiktionary.org" rel="noopener">Wiktionary</a> contributors, via the machine-readable extract at
      <a href="https://kaikki.org" rel="noopener">kaikki.org</a> (Tatu Ylonen, wiktextract). Wiktionary text is licensed
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a> and GFDL.
    </li>
    <li>
      Example sentences, translations and the sentence drills: <a href="https://tatoeba.org" rel="noopener">Tatoeba</a> contributors, licensed
      <a href="https://creativecommons.org/licenses/by/2.0/fr/" rel="noopener">CC BY 2.0 FR</a>. Each sentence links to its
      Tatoeba page.
    </li>
    <li>
      Reading: stories for children by Leo Tolstoy (from his <span lang="ru">Вторая русская книга для чтения</span>, 1875)
      and Anton Chekhov's one-act comedies <span lang="ru">Медведь</span> and <span lang="ru">Предложение</span> (1888), in
      modern spelling, from <a href="https://ru.wikisource.org" rel="noopener">Russian Wikisource</a>, unchanged. Both
      authors died over a century ago, so the texts are in the public domain. Word meanings come from the sources above
      (OpenRussian, Wiktionary); where neither has a word, the meaning is ours and is marked as such. The comprehension
      questions are ours.
    </li>
    <li>
      A few small grammar lists were written by hand for this site (which case a verb takes, what a motion prefix
      means, verbs of position, time words). They contain grammar facts only; every word form still comes from the
      sources above.
    </li>
    <li>
      Vocabulary: words and meanings from OpenRussian (above); the order of the "other words" (prepositions, adverbs,
      pronouns…) by how often they occur in film and TV subtitles, from
      <a href="https://github.com/hermitdave/FrequencyWords" rel="noopener">FrequencyWords</a> by Hermit Dave
      (OpenSubtitles 2018), licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a>.
    </li>
    <li>Fonts: PT Serif and PT Sans by ParaType, SIL Open Font License 1.1.</li>
  </ul>
  <p>
    The derived word data published with this site is itself available under CC BY-SA 4.0 (share-alike), and the
    sentence data under CC BY 2.0 FR.
  </p>
  <p>
    The Culture page links to other people's channels and sites. Krotik doesn't host, copy or embed their content, isn't
    connected with them, and loads nothing from them until you follow a link.
  </p>
  <p class="muted">
    Example sentences are matched to words automatically and conservatively; a mismatch is possible. Speech uses your
    device's own Russian voice, if it has one.
  </p>
  <button class="btn" onclick={onback}>Back</button>
</article>

<style>
  h1 {
    margin-top: 0;
    font-family: var(--serif);
  }
  h2 {
    font-size: 1.15rem;
  }
  li {
    margin-bottom: 8px;
  }
</style>
