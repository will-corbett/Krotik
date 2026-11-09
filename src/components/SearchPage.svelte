<script lang="ts">
  /**
   * Search the whole site: lessons, drills, vocabulary themes and words, Reading, idioms, words that go together,
   * culture and writing. Pages you can go to come first; the dictionary-style list of words comes after them. The query is in the address (?q=), so a search can be bookmarked or shared; nothing is stored
   * or sent anywhere (the index is a file the page loads).
   */
  import { onMount, tick } from 'svelte';
  import { getSearchIndex, loadThemeIndex, loadWordList } from '../lib/data.ts';
  import { registerName } from '../lib/register.ts';
  import { searchDocs, searchWords, type Hit } from '../lib/search.ts';
  import { SITE_BASE } from '../shared/site.ts';
  import { renderForm } from '../shared/forms.ts';
  import type { SearchDoc, SearchIndex, ThemeIndex } from '../shared/types.ts';
  import type { Settings } from '../lib/settings.ts';
  import type { Word } from '../lib/types.ts';

  let { settings }: { settings: Settings } = $props();
  let query = $state(new URLSearchParams(location.search).get('q') ?? '');
  let index = $state<SearchIndex | null>(null);
  let words = $state<Word[]>([]);
  let themes = $state<ThemeIndex | null>(null);
  let error = $state('');
  let box = $state<HTMLInputElement>();

  onMount(async () => {
    await tick();
    box?.focus();
    try {
      [index, themes] = await Promise.all([getSearchIndex(), loadThemeIndex()]);
      // The most common words of every type (bands 0–2): enough for a dictionary-style lookup, without the rare ones.
      words = await loadWordList(2);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });

  // Keep the address in step with the query (no new history entry per keystroke).
  $effect(() => {
    const url = new URL(location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  });

  const hits = $derived(index && query.trim() ? searchDocs(index.docs, query) : []);
  const wordHits = $derived(words.length && query.trim() ? searchWords(words, query) : []);
  const GROUPS: { k: SearchDoc['k']; title: string }[] = [
    { k: 'learn', title: 'Learn' },
    { k: 'drill', title: 'Drills' },
    { k: 'theme', title: 'Vocabulary themes' },
    { k: 'reading', title: 'Reading' },
    { k: 'idiom', title: 'Idioms and proverbs' },
    { k: 'pair', title: 'Words that go together' },
    { k: 'note', title: 'Culture notes' },
    { k: 'link', title: 'Culture links' },
    { k: 'writing', title: 'Writing' },
    { k: 'page', title: 'Pages' },
  ];
  // Groups ordered by their best hit, so the most relevant kind comes first.
  const groups = $derived(
    GROUPS.map((g) => ({ ...g, hits: hits.filter((h) => h.doc.k === g.k) }))
      .filter((g) => g.hits.length)
      .sort((a, b) => b.hits[0]!.score - a.hits[0]!.score),
  );
  const total = $derived(hits.length + wordHits.length);
  const themeOf = (key: string) => themes?.themes.find((t) => t.keys.includes(key));
  const POS: Record<string, string> = { n: 'noun', v: 'verb', a: 'adjective', o: '' };
  const linkOf = (h: Hit) => h.doc.url ?? `${SITE_BASE}${h.doc.path ?? ''}`;
</script>

<section class="search fade-in" aria-labelledby="search-title">
  <h1 id="search-title">Search <span lang="ru" class="ru">поиск</span></h1>
  <form role="search" onsubmit={(e) => e.preventDefault()}>
    <label for="search-box" class="visually-hidden">Search Krotik</label>
    <input id="search-box" type="search" bind:value={query} bind:this={box} placeholder="Search in English or Russian: aspect, винительный, книга, weather…" autocomplete="off" spellcheck="false" />
  </form>
  <p class="muted small" role="status" aria-live="polite">
    {#if error}{error}{:else if !query.trim()}Lessons, drills, words, idioms, texts and more. Stress marks and ё don't matter.{:else if !index}Loading…{:else if !total}Nothing found for “{query.trim()}”.{:else}{total} {total === 1 ? 'result' : 'results'}{/if}
  </p>

  {#each groups as g (g.k)}
    <section aria-labelledby="g-{g.k}">
      <h2 id="g-{g.k}">{g.title}</h2>
      <ul class="hits">
        {#each g.hits as h (linkOf(h) + h.doc.title)}
          <li>
            <a href={linkOf(h)} lang={/[а-яё]/i.test(h.doc.title) ? 'ru' : 'en'} {...h.doc.url ? { rel: 'noopener', target: '_blank' } : {}}>{renderForm(h.doc.title, settings.stress)}</a>
            {#if h.doc.ru}<span lang="ru" class="muted">{h.doc.ru}</span>{/if}
            {#if h.doc.level}<span class="level">{h.doc.level}</span>{/if}
            {#if h.doc.url}<span class="muted small">(another site)</span>{/if}
            {#if h.snippet && (g.k !== 'idiom' && g.k !== 'pair')}<p class="snippet muted small">{h.snippet}</p>{:else if h.snippet}<span class="small">{h.doc.text}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  {#if wordHits.length}
    <section aria-labelledby="g-words">
      <h2 id="g-words">Words</h2>
      <ul class="words">
        {#each wordHits as w (w.key)}
          {@const t = themeOf(w.key)}
          <li>
            <strong lang="ru">{renderForm(w.accented.split(',')[0]!, settings.stress)}</strong>
            <span class="muted small">{[POS[w.pos], w.register ? registerName(w.register) : ''].filter(Boolean).join(' · ')}</span>
            <span>{w.gloss}</span>
            {#if t}<a class="small" href="{SITE_BASE}vocabulary/{t.id}/">in {t.title}</a>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 0 0 12px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  input {
    width: 100%;
    font-size: 1.15rem;
    padding: 10px 14px;
    border: 2px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--text);
  }
  input:focus-visible {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.2rem;
    margin: 22px 0 6px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .words li {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: baseline;
  }
  .words strong {
    font-family: var(--serif);
    font-size: 1.1rem;
  }
  .hits a {
    font-weight: 600;
    margin-right: 6px;
  }
  .level {
    font-size: 0.75rem;
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted);
    margin-left: 4px;
  }
  .snippet {
    margin: 2px 0 0;
  }
  .small {
    font-size: 0.85rem;
  }
</style>
