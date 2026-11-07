<script lang="ts">
  import { loadThemeIndex } from '../lib/data.ts';
  import { href } from '../lib/router.ts';
  import type { ThemeIndex } from '../shared/types.ts';

  /** The Words section: everyday vocabulary by theme, grouped by level. */
  let index = $state<ThemeIndex | null>(null);
  let error = $state('');
  $effect(() => {
    loadThemeIndex()
      .then((d) => (index = d))
      .catch(() => (error = 'Couldn’t load the themes. Check your connection and reload the page.'));
  });
  const levels = $derived(index ? [...new Set(index.themes.map((t) => t.level))] : []);
</script>

<section class="fade-in" aria-labelledby="words-title">
  <h1 id="words-title">Words <span lang="ru" class="ru">слова</span></h1>
  <p>
    Everyday Russian vocabulary, one theme at a time. Each theme has its words with stress and meaning, real example
    sentences, short dialogues where you can tap any word, and practice rounds.
  </p>
  <p class="muted small">
    Want the commonest words, whatever the theme? Try the <a href={href({ page: 'drill', mode: 'vocab' })}>Vocabulary drill</a>.
  </p>

  {#if error}
    <p class="muted">{error}</p>
  {:else if index}
    {#each levels as level (level)}
      <section aria-labelledby="lvl-{level}">
        <h2 id="lvl-{level}">{level}</h2>
        <ul class="themes">
          {#each index.themes.filter((t) => t.level === level) as t (t.id)}
            <li>
              <a class="card theme" href={href({ page: 'words', theme: t.id })}>
                <span class="t-title">{t.title}</span>
                <span class="t-ru" lang="ru">{t.ru}</span>
                <span class="muted small">{t.blurb}</span>
                <span class="muted small count">{t.words} words{#if t.dialogues} · {t.dialogues} {t.dialogues === 1 ? 'dialogue' : 'dialogues'}{/if}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {:else}
    <p class="muted">Loading…</p>
  {/if}
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
    font-size: 1.2rem;
    margin: 22px 0 8px;
  }
  .themes {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }
  .theme {
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    margin: 0;
    text-decoration: none;
    color: inherit;
  }
  .theme:hover .t-title {
    text-decoration: underline;
  }
  .t-title {
    font-weight: 700;
    color: var(--accent);
  }
  .t-ru {
    font-family: var(--serif);
    color: var(--muted);
  }
  .small {
    font-size: 0.88rem;
  }
  .count {
    margin-top: auto;
    padding-top: 4px;
  }
</style>
