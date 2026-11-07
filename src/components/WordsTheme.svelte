<script lang="ts">
  import { loadTheme, loadThemeIndex } from '../lib/data.ts';
  import { pageTitle } from '../lib/pageMeta.ts';
  import { today } from '../lib/progress.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { hasRussianVoice, speak } from '../lib/speech.ts';
  import { addWords, loadWords, saveWords } from '../lib/words.ts';
  import { bare, renderForm } from '../shared/forms.ts';
  import type { ThemeData, ThemeIndex, ThemeWord } from '../shared/types.ts';
  import ExplainedText from './ExplainedText.svelte';
  import Sentence from './Sentence.svelte';

  /**
   * One theme of the Words section: its words (stress, gender or aspect, meaning, Hear it), our dialogues (published
   * once a native speaker has checked them; every word tappable, English on request), a real sentence for each word,
   * and practice rounds on just these words.
   */
  let {
    id,
    settings = $bindable(),
    onpractise,
  }: { id: string; settings: Settings; onpractise: (keys: [string, number][], direction: 'recognise' | 'recall') => void } = $props();
  let theme = $state<ThemeData | null>(null);
  let index = $state<ThemeIndex | null>(null);
  let error = $state('');
  let canSpeak = $state(false);
  let english = $state(false);
  hasRussianVoice().then((ok) => (canSpeak = ok));
  $effect(() => {
    theme = null;
    error = '';
    Promise.all([loadTheme(id), loadThemeIndex()])
      .then(([t, i]) => ((theme = t), (index = i)))
      .catch(() => (error = 'Couldn’t load this theme. Check your connection and reload the page.'));
  });
  $effect(() => {
    if (theme) document.title = pageTitle({ page: 'words', theme: theme.id }, undefined, () => theme!.title);
  });
  const near = $derived.by(() => {
    if (!theme || !index) return {};
    const i = index.themes.findIndex((t) => t.id === theme!.id);
    return { prev: index.themes[i - 1], next: index.themes[i + 1] };
  });
  const all = $derived(theme ? theme.groups.flatMap((g) => g.words) : []);
  const keys = $derived(all.map(([k, , , , , b]) => [k, b] as [string, number]));

  // Your words (opt-in: only while progress is on).
  let mine = $state(new Set(Object.keys(loadWords().words)));
  function add(items: [string, number][]) {
    if (!settings.progress) return;
    const w = addWords(loadWords(), items, today());
    saveWords(w);
    mine = new Set(Object.keys(w.words));
  }
  const allIn = $derived(all.length > 0 && all.every(([k]) => mine.has(k)));

  const CHIP: Record<string, string> = { m: 'masculine', f: 'feminine', n: 'neuter', impf: 'imperfective', pf: 'perfective', both: 'both aspects' };
  const chip = (w: ThemeWord) => (w[3] === 'n' || w[3] === 'v' ? (CHIP[w[4]] ?? '') : '');
  const head = (w: ThemeWord) => renderForm(w[1].split(',')[0]!, settings.stress);
</script>

<article class="theme fade-in" aria-labelledby="theme-title">
  <p class="crumbs"><a href={href({ page: 'words' })}>Words</a> ›</p>
  {#if error}
    <p class="muted">{error}</p>
  {:else if theme}
    <h1 id="theme-title">{theme.title} <span lang="ru" class="ru">{theme.ru}</span></h1>
    <p class="intro"><span class="level">{theme.level}</span> {theme.blurb}</p>

    <div class="practise" role="group" aria-label="Practise these words">
      <button type="button" class="btn primary" onclick={() => onpractise(keys, 'recognise')}>Practise: choose the meaning</button>
      <button type="button" class="btn" onclick={() => onpractise(keys, 'recall')}>Practise: type the word</button>
      {#if settings.progress}
        <button type="button" class="btn quiet" disabled={allIn} onclick={() => add(keys)}>{allIn ? 'All in your words ✓' : 'Add all to my words'}</button>
      {/if}
    </div>

    {#each theme.groups as g, gi (gi)}
      <section class="group" aria-labelledby="g-{gi}">
        <h2 id="g-{gi}">{g.title}</h2>
        <ul class="words">
          {#each g.words as w (w[0])}
            <li>
              <span class="head" lang="ru">{head(w)}</span>
              {#if chip(w)}<span class="chip">{chip(w)}</span>{/if}
              <span class="meaning">{w[2]}</span>
              {#if canSpeak}
                <button type="button" class="btn quiet hear" onclick={() => speak(bare(w[1].split(',')[0]!))} aria-label="Hear {bare(w[1].split(',')[0]!)}"><span aria-hidden="true">🔊</span></button>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    {#if theme.dialogues.length}
      <section class="dialogues" aria-labelledby="dialogues-h">
        <div class="d-head">
          <h2 id="dialogues-h">Dialogues</h2>
          <label class="toggle"><input type="checkbox" bind:checked={english} /> Show English</label>
        </div>
        <p class="muted small">Tap or hover over any word to see what it means.</p>
        {#each theme.dialogues as d, di (di)}
          <section class="dialogue" aria-labelledby="d-{di}">
            <h3 id="d-{di}">{d.title}</h3>
            <ExplainedText lines={d.lines} words={theme.words} label="Dialogue: {d.title}. Each word shows its meaning" uid="d{di}" progress={settings.progress} {mine} onadd={add} translations={d.en} showTranslation={english} />
            <p class="muted reviewed">Written for Krotik; checked by a native speaker ({d.reviewed}).</p>
          </section>
        {/each}
      </section>
    {:else if theme.drafts}
      <section class="dialogues" aria-labelledby="dialogues-h">
        <h2 id="dialogues-h">Dialogues</h2>
        <p class="muted small">Dialogues for this theme are written and waiting for a native speaker's check. They'll appear here once checked.</p>
      </section>
    {/if}

    {#if Object.keys(theme.uses).length}
      <section class="uses" aria-labelledby="uses-h">
        <h2 id="uses-h">In use</h2>
        <p class="muted small">Real sentences from Tatoeba, one for each word.</p>
        <ul>
          {#each all.filter(([k]) => theme!.uses[k]) as w (w[0])}
            {@const [rid, ru, en, start, end] = theme.uses[w[0]]!}
            <li><Sentence row={[rid, ru, en, 0, start, end]} /></li>
          {/each}
        </ul>
      </section>
    {/if}

    <nav class="pager" aria-label="Themes">
      {#if near.prev}<a href={href({ page: 'words', theme: near.prev.id })}><span class="muted small">← Previous</span> {near.prev.title}</a>{:else}<span></span>{/if}
      {#if near.next}<a class="next" href={href({ page: 'words', theme: near.next.id })}><span class="muted small">Next →</span> {near.next.title}</a>{/if}
    </nav>
  {:else}
    <p class="muted">Loading…</p>
  {/if}
</article>

<style>
  .crumbs {
    margin: 0;
    font-size: 0.9rem;
  }
  h1 {
    font-family: var(--serif);
    margin: 4px 0 6px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8em;
  }
  .intro {
    margin: 0 0 12px;
  }
  .level {
    display: inline-block;
    padding: 0 8px;
    margin-right: 6px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.85rem;
    font-weight: 700;
  }
  .practise {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 1.2rem;
    margin: 22px 0 6px;
  }
  h3 {
    font-size: 1.05rem;
    margin: 18px 0 0;
  }
  .words {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .words li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .head {
    font-family: var(--serif);
    font-size: 1.2rem;
    min-width: 8rem;
  }
  .chip {
    font-size: 0.78rem;
    padding: 0 7px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .meaning {
    flex: 1 1 12rem;
  }
  .hear {
    min-height: 32px;
    padding: 0 8px;
  }
  .d-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .toggle {
    font-size: 0.95rem;
  }
  .reviewed {
    font-size: 0.8rem;
    margin: -4px 0 0;
  }
  .uses ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .uses li {
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .small {
    font-size: 0.88rem;
  }
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .pager .next {
    text-align: right;
  }
</style>
