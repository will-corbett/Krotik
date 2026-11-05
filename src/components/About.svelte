<script lang="ts">
  let { onback }: { onback: () => void } = $props();
</script>

<article class="card about fade-in">
  <h1>About</h1>
  <p>
    Russian Grammar Drills is a no-login drill for Russian grammar: verb forms, aspect, motion verbs, participles and verbal adverbs,
    adjectives, plurals, numbers, diminutives, and sentence drills (который, чтобы, conditional, negation,
    indefinite pronouns, particles). Nothing
    about your answers is stored; only display settings are remembered in this browser.
  </p>
  <p>
    A wrong answer comes back at the end of the round, and a round finishes only when every question has been answered
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
      Participles, verbal adverbs, numerals, diminutives, some comparatives and noun genders:
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
      A few small grammar lists were written by hand for this site (which case a verb takes, what a motion prefix
      means, verbs of position, time words). They contain grammar facts only; every word form still comes from the
      sources above.
    </li>
    <li>Fonts: PT Serif and PT Sans by ParaType, SIL Open Font License 1.1.</li>
  </ul>
  <p>
    The derived word data published with this site is itself available under CC BY-SA 4.0 (share-alike), and the
    sentence data under CC BY 2.0 FR.
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
