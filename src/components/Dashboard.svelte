<script lang="ts">
  import { DUE_DAYS, loadProgress, summarise, today } from '../lib/progress.ts';
  import { dueKeys, loadWords } from '../lib/words.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { ALL_TOPICS, isDrill, topicById } from '../lib/topics.ts';

  /**
   * The landing page: the last drill (a slim strip), then four cards: Grammar test, Learn & drill, Reading, Progress.
   * The full topic map is the Learn page; progress details are the Progress page.
   */
  let {
    settings,
    loading,
    oncontinue,
    onhide,
    ongotit,
    onprogress,
  }: { settings: Settings; loading: boolean; oncontinue: () => void; onhide: () => void; ongotit: () => void; onprogress: (on: boolean) => void } = $props();
  const last = $derived(topicById(settings.mode));
  const topics = ALL_TOPICS.filter((t) => t.learn !== false).length;
  const drills = ALL_TOPICS.filter(isDrill).length;
  const progress = $derived(settings.progress ? summarise(loadProgress(), today()) : null);
  const wordsDue = $derived(settings.progress ? dueKeys(loadWords(), today()).length : 0);
</script>

<section class="dash fade-in" aria-labelledby="dash-title">
  <div class="hero">
    <img src="{import.meta.env.BASE_URL}brand/krotik-192.png" alt="Krotik the mole, reading" width="80" height="80" />
    <div>
      <h1 id="dash-title">Krotik</h1>
      <p class="muted">Learn and drill Russian grammar. <span lang="ru">Учись и тренируйся.</span></p>
      {#if settings.guideSeen}<p class="guide-link small"><a href={href({ page: 'start' })}>New here? Read the short guide →</a></p>{/if}
    </div>
  </div>

  {#if !settings.guideSeen}
    <div class="card welcome">
      <div>
        <h2>New to Krotik?</h2>
        <p class="muted small">A two-minute guide: what's here, the order to start in, and how drills work.</p>
      </div>
      <div class="strip-actions">
        <a class="btn primary" href={href({ page: 'start' })}>Start here</a>
        <button class="btn quiet small-btn" onclick={ongotit} aria-label="Got it: make this smaller (the guide stays as a link under the title)">Got it</button>
      </div>
    </div>
  {/if}

  {#if !settings.hideContinue && last}
    <div class="strip">
      <p>
        <span class="muted">Your last drill:</span> <strong>{last.title.en}</strong>
        <span class="muted small">· {settings.count === 0 ? 'unlimited' : `${settings.count} questions`}</span>
      </p>
      <div class="strip-actions">
        <button class="btn primary small-btn" onclick={oncontinue} disabled={loading}>{loading ? 'Loading…' : 'Start another round'}</button>
        <button class="btn quiet small-btn" onclick={onhide} aria-label="Hide your last drill until your next drill">Hide</button>
      </div>
    </div>
  {/if}

  <div class="cards">
    <article class="card tile" aria-labelledby="t-learn">
      <h2 id="t-learn">Learn &amp; drill <span lang="ru" class="ru">грамматика</span></h2>
      <p class="muted small">{topics} topics, from the alphabet to participles: short explanations, then {drills} drills with instant feedback, including the commonest words.</p>
      <a class="btn primary" href={href({ page: 'learn' })}>See all topics</a>
    </article>

    <article class="card tile" aria-labelledby="t-words">
      <h2 id="t-words">Words <span lang="ru" class="ru">слова</span></h2>
      <p class="muted small">Everyday vocabulary by theme (food, family, travel…): words, real sentences, dialogues and practice.</p>
      <a class="btn" href={href({ page: 'words' })}>Learn words</a>
    </article>

    <article class="card tile" aria-labelledby="t-test">
      <h2 id="t-test">Grammar test <span lang="ru" class="ru">тест</span></h2>
      <p class="muted small">60 questions from A1 to C1, about 20–25 minutes, every answer explained.</p>
      <a class="btn" href={href({ page: 'test' })}>Take the test</a>
    </article>

    <article class="card tile" aria-labelledby="t-read">
      <h2 id="t-read">Reading <span lang="ru" class="ru">чтение</span></h2>
      <p class="muted small">Tolstoy’s stories and Chekhov’s comedies, every word explained, with questions after each.</p>
      <a class="btn" href={href({ page: 'reading' })}>Start reading</a>
    </article>

    <article class="card tile" aria-labelledby="t-progress">
      <h2 id="t-progress">Your progress</h2>
      {#if !progress}
        <p class="muted small">Off. Turn it on to see weak topics, what’s due for revision and your words; it’s kept in this browser only.</p>
        <button class="btn" onclick={() => onprogress(true)}>Keep track in this browser</button>
      {:else}
        <p class="muted small">
          {#if !progress.all.length}
            Finish a drill round and your results appear here.
          {:else}
            {progress.weak.length}
            {progress.weak.length === 1 ? 'weak topic' : 'weak topics'} · {progress.due.length} due for revision ({DUE_DAYS}+ days)
          {/if}
          {#if wordsDue}<br />{wordsDue} {wordsDue === 1 ? 'word' : 'words'} due for review{/if}
        </p>
        <a class="btn" href={href({ page: 'progress' })}>See your progress</a>
      {/if}
    </article>
  </div>
</section>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }
  .hero img {
    border-radius: 18px;
  }
  h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 2.1rem;
  }
  .hero p {
    margin: 2px 0 0;
  }
  .welcome {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    margin: 0 0 14px;
    border-left: 4px solid var(--primary-bg);
  }
  .welcome h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .welcome p {
    margin: 2px 0 0;
  }
  .hero .guide-link {
    margin: 4px 0 0;
  }
  .strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding: 8px 12px;
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-left: 4px solid var(--primary-bg);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .strip p {
    margin: 0;
  }
  .strip-actions {
    display: flex;
    gap: 6px;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 640px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
  }
  /* Five cards: the last one spans the row on wide screens. */
  @media (min-width: 640px) {
    .tile:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
  }
  .tile h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .tile p {
    margin: 0;
    flex: 1;
  }
  .tile .btn {
    align-self: flex-start;
    margin-top: 4px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  .small {
    font-size: 0.92rem;
  }
  .small-btn {
    min-height: 36px;
    padding: 0.25em 0.9em;
  }
</style>
