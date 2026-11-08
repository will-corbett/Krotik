<script lang="ts">
  import { loadReadingIndex } from '../lib/data.ts';
  import { href } from '../lib/router.ts';
  import type { ReadingIndex } from '../shared/types.ts';

  /**
   * The Reading section: real Russian texts, every word explained, questions after each: public-domain literature
   * (Tolstoy, Chekhov) and science news from Russian Wikinews (CC BY).
   */
  let index = $state<ReadingIndex | null>(null);
  let error = $state('');
  $effect(() => {
    loadReadingIndex()
      .then((d) => (index = d))
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
  });
  const minutes = (words: number) => Math.max(1, Math.round(words / 80));
</script>

<section class="fade-in" aria-labelledby="reading-title">
  <h1 id="reading-title">Reading <span lang="ru" class="ru">чтение</span></h1>
  <p>
    Real Russian texts: short stories Leo Tolstoy wrote for children learning to read, Anton Chekhov's comic stories and
    two of his one-act comedies, and science news. Hover over or tap any word to see its dictionary form, what it means
    and which form it is; then answer a few questions to check you followed it. From B2, some questions ask you to read
    between the lines or to judge the tone.
  </p>
  <p class="muted small">
    The literature is in the public domain and comes from Russian Wikisource, in modern spelling, unchanged. A few words
    are old-fashioned (they're marked when you look them up). The news articles are by Russian Wikinews contributors
    (CC BY 4.0), also unchanged.
  </p>

  {#if error}
    <p class="muted">Couldn’t load the texts. Check your connection and reload the page.</p>
  {:else if index}
    {#each index.works as w, wi (w.id)}
      {@const units = index.units.filter((u) => u.w === wi)}
      {#if units.length}
        <section class="work" aria-labelledby="work-{w.id}">
          <h2 id="work-{w.id}">
            <span lang="ru">{w.site === 'wikinews' ? w.title : `${w.author}, «${w.title}»`}</span>
            <span class="meta muted">{w.site === 'wikinews' ? 'Wikinews' : w.year} · {w.level[0]}–{w.level[1]}</span>
          </h2>
          <p class="muted small">{w.titleEn}.</p>
          <ul>
            {#each w.kind === 'stories' ? [...units].sort((a, b) => a.words - b.words) : units as u (u.id)}
              <li>
                <a href={href({ page: 'reading', text: u.id })} lang="ru">{u.title}</a>
                <span class="muted small">
                  {#if u.level}{u.level[0]}–{u.level[1]} ·{/if}
                  {#if u.date}<span lang="ru">{u.date}</span> ·{/if}
                  {#if u.genre}<span lang="ru">{u.genre.toLowerCase()}</span> ·{/if}
                  {u.words} words, about {minutes(u.words)} min · {u.questions}
                  {u.questions === 1 ? 'question' : 'questions'}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  {:else}
    <p class="muted">Loading…</p>
  {/if}
</section>

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
  h2 {
    font-family: var(--serif);
    font-size: 1.25rem;
    margin: 24px 0 2px;
  }
  .meta {
    font-family: var(--sans);
    font-size: 0.9rem;
    font-weight: 400;
    margin-left: 6px;
  }
  .small {
    font-size: 0.92rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 6px 0 0;
  }
  li {
    padding: 7px 0;
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    align-items: baseline;
  }
  li a {
    font-family: var(--serif);
    font-size: 1.1rem;
  }
</style>
