<script lang="ts">
  import { LEARN_TOPICS } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import { TOPIC_GROUPS, isDrill, type Topic } from '../lib/topics.ts';
  import { loadProgress, summarise, today } from '../lib/progress.ts';

  /**
   * Every topic, by group, easiest first: its level, its Learn page and its drill. The site's topic map, with filters
   * (level, group, and with progress on: not practised, practised, needs revision). Filters are page state only.
   */
  let { progressOn = false }: { progressOn?: boolean } = $props();
  const level = (l: [string, string]) => (l[0] === l[1] ? l[0] : `${l[0]}–${l[1]}`);
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
  let lvl = $state('any');
  let group = $state('any');
  let status = $state<'any' | 'new' | 'done' | 'revise'>('any');
  const summary = $derived(progressOn ? summarise(loadProgress(), today()) : null);
  const practised = $derived(new Set<string>(summary?.all.map((a) => a.mode) ?? []));
  const revise = $derived(new Set<string>([...(summary?.weak.map((w) => w.mode) ?? []), ...(summary?.due.map((d) => d.mode) ?? [])]));
  // A topic is "for" a level when that level falls between when it's first met and when it's core.
  const atLevel = (t: Topic, l: string) => LEVELS.indexOf(t.level[0]) <= LEVELS.indexOf(l) && LEVELS.indexOf(l) <= LEVELS.indexOf(t.level[1]);
  const keep = (t: Topic) =>
    (lvl === 'any' || atLevel(t, lvl)) &&
    (status === 'any' ||
      (status === 'new' && isDrill(t) && !practised.has(t.id)) ||
      (status === 'done' && practised.has(t.id)) ||
      (status === 'revise' && revise.has(t.id)));
  const groups = $derived(TOPIC_GROUPS.filter((g) => group === 'any' || g.title.en === group).map((g) => ({ ...g, modes: g.modes.filter(keep) })).filter((g) => g.modes.length));
  const total = TOPIC_GROUPS.reduce((n, g) => n + g.modes.length, 0);
  const shown = $derived(groups.reduce((n, g) => n + g.modes.length, 0));
  const filtered = $derived(lvl !== 'any' || group !== 'any' || status !== 'any');
  const reset = () => ((lvl = 'any'), (group = 'any'), (status = 'any'));
</script>

<section class="fade-in" aria-labelledby="learn-title">
  <h1 id="learn-title">Learn &amp; drill <span lang="ru" class="ru">учить</span></h1>
  <p class="muted">
    Every topic, easiest first in each group. <strong>Learn</strong> is a short explanation with real examples and a
    quick check; <strong>Drill</strong> practises it as much as you like. The level is when learners usually meet the
    topic and when it's core.
  </p>
  <p class="muted small">Not sure where to start? Follow a <a href={href({ page: 'paths' })}>learning path</a> for your level.</p>

  <form class="filters" aria-label="Filter topics" onsubmit={(e) => e.preventDefault()}>
    <label>
      Level
      <select bind:value={lvl}>
        <option value="any">Any level</option>
        {#each LEVELS as l (l)}<option value={l}>{l}</option>{/each}
      </select>
    </label>
    <label>
      Group
      <select bind:value={group}>
        <option value="any">All groups</option>
        {#each TOPIC_GROUPS as g (g.title.en)}<option value={g.title.en}>{g.title.en}</option>{/each}
      </select>
    </label>
    {#if progressOn}
      <label>
        Your progress
        <select bind:value={status}>
          <option value="any">Any</option>
          <option value="new">Not practised yet</option>
          <option value="done">Practised</option>
          <option value="revise">Needs revision</option>
        </select>
      </label>
    {/if}
  </form>
  <p class="muted small count" aria-live="polite">
    {#if filtered}{shown} of {total} topics <button type="button" class="btn quiet small-btn" onclick={reset}>Clear filters</button>{/if}
  </p>
  {#if !groups.length}<p class="muted">No topics match. Try another level or fewer filters.</p>{/if}
  {#each groups as g (g.title.en)}
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
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 10px 0 0;
  }
  .filters label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9rem;
  }
  .filters select {
    min-width: 9rem;
  }
  .count {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 1.5em;
    margin: 6px 0 0;
  }
  .small {
    font-size: 0.9rem;
  }
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
