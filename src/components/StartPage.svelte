<script lang="ts">
  import { href } from '../lib/router.ts';
  import { topicById } from '../lib/topics.ts';
  import type { Mode } from '../lib/types.ts';

  /** The beginner's guide (/start/): what Krotik is, a path for new and returning learners, how drills work. */
  const FIRST: Mode[] = ['alphabet', 'stress', 'pronouns', 'verbs', 'nounCases', 'prepositions', 'adjectives', 'plurals', 'questionWords', 'numbers', 'time'];
  const first = FIRST.map((id) => topicById(id)!).filter(Boolean);
</script>

<article class="start fade-in" aria-labelledby="start-title">
  <h1 id="start-title">Start here <span lang="ru" class="ru">с чего начать</span></h1>
  <p class="lead">
    Krotik is a free place to learn Russian and practise it until it's automatic: grammar, vocabulary and reading. There's
    no account to make and
    nothing to install: everything works in your browser.
  </p>

  <section aria-labelledby="parts">
    <h2 id="parts">What's here</h2>
    <dl class="parts">
      <div><dt><a href={href({ page: 'learn' })}>Learn &amp; drill</a></dt><dd>Every grammar topic, easiest first. <strong>Learn</strong> is a short explanation with real examples; <strong>Drill</strong> is practice with instant feedback.</dd></div>
      <div><dt><a href={href({ page: 'vocabulary' })}>Vocabulary</a></dt><dd>Words by theme from A1 to C1 (food, family, travel, work…), with real sentences and practice. The <a href={href({ page: 'drill', mode: 'vocab' })}>Vocabulary drill</a> covers the commonest words.</dd></div>
      <div><dt><a href={href({ page: 'test' })}>Grammar test</a></dt><dd>Sixty questions from A1 to C1 that estimate your grammar level and point you to what to review.</dd></div>
      <div><dt><a href={href({ page: 'reading' })}>Reading</a></dt><dd>Short stories by Tolstoy and comedies by Chekhov. Tap any word to see what it means.</dd></div>
      <div><dt><a href={href({ page: 'culture' })}>Culture</a></dt><dd>Hand-picked films, cartoons, podcasts and books, and short notes on names, holidays and more.</dd></div>
    </dl>
  </section>

  <section aria-labelledby="new">
    <h2 id="new">New to Russian? Try this order</h2>
    <ol class="path">
      {#each first as t (t.id)}
        <li>
          <span class="t-name">{t.title.en} <span lang="ru" class="ru">{t.title.ru}</span></span>
          <span class="links">
            <a class="btn small-btn" href={href({ page: 'learn', topic: t.id })} aria-label="Learn: {t.title.en}">Learn</a>
            <a class="btn small-btn" href={href({ page: 'drill', mode: t.id })} aria-label="Drill: {t.title.en}">Drill</a>
          </span>
        </li>
      {/each}
    </ol>
    <p>
      Read each Learn page, do its quick check, then drill until most answers are right first time. When you know the
      alphabet, read your first story: <a href={href({ page: 'reading', text: 'kuritsa-i-lastochka' })} lang="ru">Курица и ласточка</a> is only 24 words.
    </p>
  </section>

  <section aria-labelledby="back">
    <h2 id="back">Already know some Russian?</h2>
    <ul>
      <li>Take the <a href={href({ page: 'test' })}>Grammar test</a> (20–25 minutes). The results explain every wrong answer and list the Learn pages worth reading.</li>
      <li>Follow a <a href={href({ page: 'paths' })}>learning path</a> for your level: grammar, vocabulary and reading in a recommended order.</li>
      <li>Pick topics from <a href={href({ page: 'learn' })}>Learn &amp; drill</a>: each shows the level at which learners usually meet it.</li>
      <li>Turn on <a href={href({ page: 'progress' })}>progress</a> (kept in this browser only) to see your weak topics, then review them together in a <a href={href({ page: 'drill', mode: 'mixed' })}>mixed review</a>. It also keeps a list of the words you practise, and brings each back for review when it's due.</li>
    </ul>
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How drills work</h2>
    <ul>
      <li>Type the answer and press <kbd>Enter</kbd> to check it; <kbd>Enter</kbd> again goes on. In multiple-choice questions, press a number key.</li>
      <li>A wrong answer comes back about ten cards later, and the round ends only when everything has been answered right. Your score counts what you got right the first time.</li>
      <li>
        No Russian keyboard? Turn on the <strong>on-screen keyboard</strong>, or <strong>phonetic typing</strong>, which turns
        Latin letters into Russian ones as you type: <kbd>zh</kbd> → ж, <kbd>ch</kbd> → ч, <kbd>sh</kbd> → ш,
        <kbd>ya</kbd> → я, <kbd>'</kbd> → ь. Both are under <em>Display</em> on any drill's settings.
      </li>
      <li>Stress is marked with an accent (молоко́), as in learners' dictionaries; you never need to type it. You can turn the marks off.</li>
      <li>After each answer you can see the word's full forms, a real example sentence, and (if your device has a Russian voice) hear it.</li>
    </ul>
  </section>

  <section aria-labelledby="levels">
    <h2 id="levels">What the levels mean</h2>
    <p>
      Krotik uses the familiar CEFR level names, from A1 (beginner) to C1 (advanced), for grammar only. A topic marked
      “A2–B1” is usually first met at A2 and expected to be secure by B1; it's a guide, not a rule.
    </p>
  </section>

  <section aria-labelledby="good">
    <h2 id="good">Good to know</h2>
    <ul>
      <li>There are no accounts, adverts or tracking. Your settings are remembered in this browser.</li>
      <li>Every Russian form comes from a dictionary source, and every example sentence is real (see <a href={href({ page: 'about' })}>About &amp; sources</a>).</li>
    </ul>
  </section>

  <div class="cta">
    <a class="btn primary" href={href({ page: 'learn', topic: 'alphabet' })}>Start with the alphabet</a>
    <a class="btn" href={href({ page: 'test' })}>Take the grammar test</a>
  </div>
</article>

<style>
  h1 {
    font-family: var(--serif);
    margin: 0 0 8px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  .lead {
    font-size: 1.08rem;
  }
  h2 {
    font-size: 1.2rem;
    margin: 26px 0 8px;
  }
  .parts div {
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .parts dt {
    font-weight: 700;
  }
  .parts dd {
    margin: 2px 0 0;
  }
  .path {
    padding: 0;
    margin: 0 0 10px;
    list-style: none;
    counter-reset: step;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .path li {
    counter-increment: step;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px 12px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
  }
  .path li:first-child {
    border-top: 0;
  }
  .path li::before {
    content: counter(step);
    font-weight: 700;
    color: var(--accent);
    min-width: 1.5em;
  }
  .t-name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .links {
    display: flex;
    gap: 6px;
    white-space: nowrap;
  }
  .small-btn {
    min-height: 36px;
    padding: 0.25em 0.8em;
  }
  ul li {
    margin: 4px 0;
  }
  kbd {
    font-family: var(--sans);
    font-size: 0.9em;
    padding: 0 5px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 28px;
  }
</style>
