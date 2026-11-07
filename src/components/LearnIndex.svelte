<script lang="ts">
  import { LEARN_TOPICS } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import { TOPIC_GROUPS, isDrill } from '../lib/topics.ts';

  /** Every topic, by group, easiest first: its level, its Learn page and its drill. The site's topic map. */
  const level = (l: [string, string]) => (l[0] === l[1] ? l[0] : `${l[0]}–${l[1]}`);
</script>

<section class="fade-in" aria-labelledby="learn-title">
  <h1 id="learn-title">Learn &amp; drill <span lang="ru" class="ru">учить</span></h1>
  <p class="muted">
    Every topic, easiest first in each group. <strong>Learn</strong> is a short explanation with real examples and a
    quick check; <strong>Drill</strong> practises it as much as you like. The level is when learners usually meet the
    topic and when it's core.
  </p>
  {#each TOPIC_GROUPS as g (g.title.en)}
    <section class="group" aria-labelledby="g-{g.title.en}">
      <h2 id="g-{g.title.en}">{g.title.en} <span lang="ru" class="ru">{g.title.ru}</span></h2>
      <ul>
        {#each g.modes as t (t.id)}
          <li class="topic">
            <div class="names">
              <span class="t-en">{t.title.en}</span>
              <span class="t-ru" lang="ru">{t.title.ru}</span>
            </div>
            <div class="links">
              {#if t.learn !== false}<span class="lvl muted" aria-label="Level {level(t.level)}">{level(t.level)}</span>{/if}
              {#if LEARN_TOPICS.has(t.id)}
                <a class="btn small-btn" href={href({ page: 'learn', topic: t.id })} aria-label="Learn: {t.title.en}">Learn</a>
              {/if}
              {#if isDrill(t)}
                <a class="btn small-btn" href={href({ page: 'drill', mode: t.id })} aria-label="Drill: {t.title.en}">Drill</a>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 0 0 6px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  h2 {
    font-size: 1.05rem;
    margin: 22px 0 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  /* Text wraps; the level and buttons never do, so they stay lined up down the right-hand side. */
  .topic {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px 12px;
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
    overflow-wrap: anywhere;
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
    align-items: center;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .lvl {
    font-size: 0.85rem;
    margin-right: 4px;
  }
  .small-btn {
    min-height: 38px;
    padding: 0.3em 0.9em;
    text-decoration: none;
    color: var(--text);
  }
</style>
