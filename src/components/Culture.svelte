<script lang="ts">
  import { filterLinks, hostOf, levelText, LEVELS, LINK_TYPES, LINKS, NOTES, REGION_LABEL, REGIONS, TYPE_LABEL, type CultureFilter } from '../lib/culture.ts';
  import { href } from '../lib/router.ts';

  /** The filter is page state only (not saved): it describes what you're browsing, not your progress. */
  let filter = $state<CultureFilter>({ level: 'any', kind: 'any', region: 'any' });
  const shown = $derived(filterLinks(LINKS, filter));
  const groups = $derived(LINK_TYPES.map((t) => ({ type: t, links: shown.filter((l) => l.type === t) })).filter((g) => g.links.length));
</script>

<section class="culture fade-in" aria-labelledby="culture-h1">
  <h1 id="culture-h1">Culture <span lang="ru" class="ru">культура</span></h1>
  <p class="muted intro">
    Russian outside the drills: videos, cartoons, podcasts, books and tools, from Russia, Kazakhstan, Ukraine, Georgia and
    beyond. Every link goes to the creator's or rights holder's own channel or site, and opens in a new tab.
  </p>

  <h2>Culture notes</h2>
  <ul class="notes">
    {#each NOTES as n (n.id)}
      <li>
        <a class="card note" href={href({ page: 'culture', note: n.id })}>
          <span class="n-title">{n.title}</span>
          <span class="n-ru" lang="ru">{n.ru}</span>
          <span class="muted small">{n.blurb}</span>
        </a>
      </li>
    {/each}
  </ul>

  <h2>Watch, listen, read</h2>
  <form class="filters" aria-label="Filter links" onsubmit={(e) => e.preventDefault()}>
    <label>
      My level
      <select bind:value={filter.level}>
        <option value="any">Any</option>
        {#each LEVELS as l (l)}<option value={l}>{l}</option>{/each}
      </select>
    </label>
    <label>
      Made for
      <select bind:value={filter.kind}>
        <option value="any">Anyone</option>
        <option value="learner">Learners</option>
        <option value="native">Native speakers</option>
      </select>
    </label>
    <label>
      From
      <select bind:value={filter.region}>
        <option value="any">Anywhere</option>
        {#each REGIONS.filter((r) => r !== 'worldwide') as r (r)}<option value={r}>{REGION_LABEL[r]}</option>{/each}
      </select>
    </label>
  </form>
  <p class="muted small" aria-live="polite">{shown.length} of {LINKS.length} links</p>

  {#each groups as g (g.type)}
    <section class="group" aria-labelledby="t-{g.type}">
      <h3 id="t-{g.type}">{TYPE_LABEL[g.type].en} <span lang="ru" class="ru">{TYPE_LABEL[g.type].ru}</span></h3>
      <ul class="links">
        {#each g.links as l (l.url)}
          <li class="link">
            <a href={l.url} target="_blank" rel="noopener noreferrer external">
              <span class="l-title">{l.title}</span><span class="visually-hidden"> (opens in a new tab)</span>
            </a>
            <span class="meta">
              <span class="tag">{levelText(l)}</span>
              <span class="tag">{l.kind === 'learner' ? 'For learners' : 'Native'}</span>
              {#if l.region !== 'worldwide'}<span class="tag">{REGION_LABEL[l.region]}</span>{/if}
              <span class="host">{hostOf(l.url)}</span>
            </span>
            <span class="about">{l.about}</span>
            {#if l.note}<span class="note-text muted small">{l.note}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="muted">No links match. Try a different level or region.</p>
  {/each}

  <p class="muted small fine">
    Krotik links to these sites; it doesn't host or embed their content, and isn't connected with them. Links are checked
    monthly. Music is left out on purpose.
  </p>
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 4px 0 8px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8em;
  }
  h2 {
    font-size: 1.3rem;
    margin: 24px 0 10px;
  }
  h3 {
    font-size: 1.1rem;
    margin: 20px 0 8px;
  }
  .intro {
    line-height: 1.6;
  }
  .notes {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }
  .note {
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    text-decoration: none;
    color: inherit;
    margin: 0;
  }
  .note:hover .n-title {
    text-decoration: underline;
  }
  .n-title {
    font-weight: 700;
    color: var(--accent);
  }
  .n-ru {
    font-family: var(--serif);
    color: var(--muted);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 6px;
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
  .links {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .link {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .l-title {
    font-weight: 700;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
  }
  .tag {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .host {
    color: var(--muted);
  }
  .about {
    line-height: 1.5;
  }
  .small {
    font-size: 0.85rem;
  }
  .fine {
    margin-top: 24px;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
