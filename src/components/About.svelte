<script lang="ts">
  import { audioIndex } from '../lib/recordings.ts';

  let { onback }: { onback: () => void } = $props();

  /** Everyone whose recordings the site uses, with how many and under what licence (from audio.json). */
  let people = $state<{ name: string; licence: string; licenceUrl: string; url: string; source: string; n: number }[]>([]);
  audioIndex().then((i) => {
    if (!i) return;
    const count = new Map<number, number>();
    for (const [, c] of Object.values(i.words)) count.set(c, (count.get(c) ?? 0) + 1);
    for (const c of Object.values(i.sentences)) count.set(c, (count.get(c) ?? 0) + 1);
    const byPerson = new Map<string, { name: string; licence: string; licenceUrl: string; url: string; source: string; n: number }>();
    i.credits.forEach(([name, licence, url, source, licenceUrl], k) => {
      const id = `${name}|${licence}|${source}`;
      const p = byPerson.get(id) ?? { name, licence, licenceUrl, url, source: source === 'tatoeba' ? 'Tatoeba' : 'Wikimedia Commons', n: 0 };
      p.n += count.get(k) ?? 0;
      byPerson.set(id, p);
    });
    people = [...byPerson.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  });
</script>

<article class="card about fade-in">
  <h1>About</h1>
  <p>
    Krotik is a free, no-login site for learning and practising Russian: grammar explained and drilled (verb forms,
    aspect, motion verbs, participles, cases, numbers and sentence drills), vocabulary by theme from A1 to C1, a
    grammar test, real literature with every word explained, and culture links. There are no accounts, no analytics and no cookies. Your drill settings are
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
    devices. You can move both to another device yourself: <em>Export to a file</em> on the Progress page
    saves them as one file on your device, and <em>Import from a file</em> reads one and adds it to what's there;
    nothing is uploaded. To delete everything,
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
      and Anton Chekhov's short stories (1883–1886) and one-act comedies <span lang="ru">Медведь</span> and
      <span lang="ru">Предложение</span> (1888), in modern spelling, from
      <a href="https://ru.wikisource.org" rel="noopener">Russian Wikisource</a>, unchanged. Both authors died over a
      century ago, so the texts are in the public domain. Science news: articles written by
      <a href="https://ru.wikinews.org" rel="noopener">Russian Wikinews</a> contributors, licensed
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0</a>, unchanged; each links to the
      version used. Word meanings come from the sources above (OpenRussian, Wiktionary); where neither has a word, the
      meaning is ours and is marked as such. The comprehension questions are ours.
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
    <li>
      Vocabulary section: the words and meanings come from OpenRussian (above), with some meanings shortened by us; each
      example sentence is from Tatoeba (above). The themes, the choice of words and the dialogues are ours. The
      dialogues are written for Krotik and each one is checked by a native speaker before it's published.
    </li>
    <li>
      Recordings: native speakers' recordings of words from
      <a href="https://commons.wikimedia.org" rel="noopener">Wikimedia Commons</a> (found through Wiktionary) and of
      sentences from <a href="https://tatoeba.org" rel="noopener">Tatoeba</a>. Each recording has its own licence; we use
      only those under CC0, CC BY or CC BY-SA (never ones that forbid commercial use or changes), and credit each person
      (below, and beside a recording when it plays). The files are served from this site, unchanged except converted to MP3.
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
  {#if people.length}
    <h2>Who recorded the words and sentences</h2>
    <ul class="people">
      {#each people as p (p.name + p.licence + p.source)}
        <li><a href={p.url} rel="noopener">{p.name}</a>: {p.n} recording{p.n === 1 ? '' : 's'} ({#if p.licenceUrl}<a href={p.licenceUrl} rel="noopener">{p.licence}</a>{:else}{p.licence}{/if}, {p.source})</li>
      {/each}
    </ul>
  {/if}
  <p class="muted">
    Example sentences are matched to words automatically and conservatively; a mismatch is possible. Where there's no
    native recording, "Hear it" uses your device's own Russian voice, if it has one. Recording yourself (in the
    listening drills) uses your microphone only while you record; what you record stays in the page and is never
    saved or sent.
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
