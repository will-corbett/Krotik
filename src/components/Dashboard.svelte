<script lang="ts">
  import { LEARN_TOPICS } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { TOPIC_GROUPS, topicById } from '../lib/topics.ts';

  let { settings, loading, oncontinue, onhide }: { settings: Settings; loading: boolean; oncontinue: () => void; onhide: () => void } = $props();
  const last = $derived(topicById(settings.mode));
</script>

<section class="dash fade-in" aria-labelledby="dash-title">
  <div class="hero">
    <img src="./brand/krotik-192.png" alt="Krotik the mole, reading" width="96" height="96" />
    <div>
      <h1 id="dash-title">Krotik</h1>
      <p class="muted">Learn and drill Russian grammar. <span lang="ru">Учись и тренируйся.</span></p>
    </div>
  </div>

  {#if !settings.hideContinue}
  <div class="card continue">
    <div class="c-text">
      <p class="label muted">Continue drilling</p>
      {#if last}
        <p class="what"><strong>{last.title.en}</strong> <span lang="ru" class="ru">{last.title.ru}</span></p>
        <p class="muted small">{settings.count === 0 ? 'Unlimited' : `${settings.count} questions`}, with your last settings.</p>
      {/if}
    </div>
    <div class="c-actions">
      <button class="btn primary" onclick={oncontinue} disabled={loading}>{loading ? 'Loading…' : 'Continue'}</button>
      <button class="btn quiet" onclick={onhide} aria-label="Hide Continue drilling until your next drill">Hide</button>
    </div>
  </div>
  {/if}

  <div class="card continue test-card">
    <div class="c-text">
      <p class="label muted">Level test</p>
      <p class="what"><strong>Find your level</strong> <span lang="ru" class="ru">тест на уровень</span></p>
      <p class="muted small">60 multiple-choice questions from A1 to C1, about 15–20 minutes, with Learn pages to review at the end.</p>
    </div>
    <a class="btn" href={href({ page: 'test' })}>Take the test</a>
  </div>

  <h2 class="map-title">All topics</h2>
  {#each TOPIC_GROUPS as g (g.title.en)}
    <section class="group" aria-labelledby="g-{g.title.en}">
      <h3 id="g-{g.title.en}">{g.title.en} <span lang="ru" class="ru">{g.title.ru}</span></h3>
      <ul>
        {#each g.modes as t (t.id)}
          <li class="topic">
            <div class="names">
              <span class="t-en">{t.title.en}</span>
              <span class="t-ru" lang="ru">{t.title.ru}</span>
            </div>
            <div class="links">
              {#if LEARN_TOPICS.has(t.id)}
                <a class="btn small-btn" href={href({ page: 'learn', topic: t.id })} aria-label="Learn: {t.title.en}">Learn</a>
              {/if}
              <a class="btn small-btn" href={href({ page: 'drill', mode: t.id })} aria-label="Drill: {t.title.en}">Drill</a>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</section>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
  }
  .hero img {
    border-radius: 20px;
  }
  h1 {
    margin: 0;
    font-family: var(--serif);
    font-size: 2.2rem;
  }
  .hero p {
    margin: 4px 0 0;
  }
  .c-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .continue {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .label {
    margin: 0;
    font-size: 0.9rem;
  }
  .what {
    margin: 2px 0;
    font-size: 1.15rem;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  .small {
    margin: 0;
    font-size: 0.9rem;
  }
  .map-title {
    margin: 28px 0 4px;
    font-family: var(--serif);
  }
  .group h3 {
    margin: 18px 0 6px;
    font-size: 1.05rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .topic {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    flex-wrap: wrap;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .topic:first-child {
    border-top: 0;
  }
  .names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .t-en {
    font-weight: 700;
  }
  .t-ru {
    font-family: var(--serif);
    color: var(--muted);
    font-size: 0.95rem;
  }
  .links {
    display: flex;
    gap: 6px;
  }
  .small-btn {
    min-height: 38px;
    padding: 0.3em 0.9em;
    text-decoration: none;
    color: var(--text);
  }
</style>
