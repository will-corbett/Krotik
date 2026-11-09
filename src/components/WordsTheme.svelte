<script lang="ts">
  import { reviewedText } from '../lib/reviewed.ts';
  import { loadTheme, loadThemeIndex } from '../lib/data.ts';
  import { pageTitle } from '../lib/pageMeta.ts';
  import { today } from '../lib/progress.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { audioIndex, wordRecordingFrom, type Credit } from '../lib/recordings.ts';
  import { loadCollocations } from '../lib/data.ts';
  import { pairsWithNouns } from '../lib/collocations.ts';
  import type { CollocationData } from '../shared/types.ts';
  import Hear from './Hear.svelte';
  import { addWords, loadWords, saveWords } from '../lib/words.ts';
  import { bare, renderForm } from '../shared/forms.ts';
  import type { ThemeData, ThemeIndex, ThemeWord } from '../shared/types.ts';
  import type { Word } from '../lib/types.ts';
  import ExplainedText from './ExplainedText.svelte';
  import Sentence from './Sentence.svelte';
  import ReportLink from './ReportLink.svelte';

  /**
   * One theme of the Vocabulary section: its words (stress, gender or aspect, meaning, Hear it), our dialogues (published
   * once a native speaker has checked them; every word tappable, English on request), a real sentence for each word,
   * and practice rounds on just these words.
   */
  let {
    id,
    settings = $bindable(),
    onpractise,
  }: { id: string; settings: Settings; onpractise: (keys: [string, number][], direction: 'recognise' | 'recall' | 'gap', theme?: string, words?: Word[]) => void } = $props();
  let theme = $state<ThemeData | null>(null);
  let index = $state<ThemeIndex | null>(null);
  let error = $state('');
  let english = $state(false);
  /** Words that go together whose noun is one of this theme's words (принять душ in Home, сделать покупки in Shopping). */
  let together = $state<CollocationData['pairs']>([]);
  $effect(() => {
    const keys = new Set(all.map(([k]) => k));
    loadCollocations()
      .then((d) => (together = pairsWithNouns(d, keys)))
      .catch(() => (together = []));
  });
  /** Who recorded this theme's words (each credited, as their licences ask). */
  let credits = $state<Credit[]>([]);
  $effect(() => {
    const ks = all.map(([k]) => k);
    audioIndex().then((i) => {
      const seen = new Map<string, Credit>();
      for (const k of ks) {
        const c = wordRecordingFrom(i, k)?.credit;
        if (c) seen.set(c.name + c.licence, c);
      }
      credits = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    });
  });
  $effect(() => {
    theme = null;
    error = '';
    Promise.all([loadTheme(id), loadThemeIndex()])
      .then(([t, i]) => ((theme = t), (index = i)))
      .catch(() => (error = 'Couldn’t load this theme. Check your connection and reload the page.'));
  });
  $effect(() => {
    if (theme) document.title = pageTitle({ page: 'vocabulary', theme: theme.id }, undefined, () => theme!.title);
  });
  const near = $derived.by(() => {
    if (!theme || !index) return {};
    const i = index.themes.findIndex((t) => t.id === theme!.id);
    return { prev: index.themes[i - 1], next: index.themes[i + 1] };
  });
  const all = $derived(theme ? theme.groups.flatMap((g) => g.words) : []);
  const keys = $derived(all.map(([k, , , , , b]) => [k, b] as [string, number]));
  // The theme's words whole (with our meanings), so a practice round needn't load the word lists they're in.
  const words = $derived(all.map(([key, accented, gloss, pos, extra, band]): Word => ({ key, accented, gloss, pos, extra, band })));

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

  /** Each word's real sentence opens under its row from the arrow beside the word (again to close). */
  let open = $state(new Set<string>());
  function toggle(k: string) {
    const next = new Set(open);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    open = next;
  }
</script>

<article class="theme fade-in" aria-labelledby="theme-title">
  <p class="crumbs"><a href={href({ page: 'vocabulary' })}>Vocabulary</a> ›</p>
  {#if error}
    <p class="muted">{error}</p>
  {:else if theme}
    <h1 id="theme-title">{theme.title} <span lang="ru" class="ru">{theme.ru}</span></h1>
    <p class="intro"><span class="level">{theme.level}</span> {theme.blurb}</p>

    <div class="practise" role="group" aria-label="Practise these words">
      <button type="button" class="btn primary" onclick={() => onpractise(keys, 'recognise', theme!.id, words)}>Practise: choose the meaning</button>
      <button type="button" class="btn" onclick={() => onpractise(keys, 'recall', theme!.id, words)}>Practise: type the word</button>
      {#if Object.keys(theme.gaps).length}<button type="button" class="btn" onclick={() => onpractise(keys, 'gap', theme!.id, words)}>Practise: fill the gap</button>{/if}
      {#if settings.progress}
        <button type="button" class="btn quiet" disabled={allIn} onclick={() => add(keys)}>{allIn ? 'All in your words ✓' : 'Add all to my words'}</button>
      {/if}
    </div>

    <p class="muted small hint">Press the arrow beside a word to see it in a real sentence.</p>

    {#each theme.groups as g, gi (gi)}
      <section class="group" aria-labelledby="g-{gi}">
        <h2 id="g-{gi}">{g.title}</h2>
        <ul class="words">
          {#each g.words as w (w[0])}
            {@const use = theme.uses[w[0]]}
            {@const isOpen = open.has(w[0])}
            <li class:open={isOpen}>
              <div class="row">
                {#if use}
                  <button
                    type="button"
                    class="arrow"
                    aria-expanded={isOpen}
                    aria-controls="ex-{w[0].replace(':', '-')}"
                    aria-label="Example: {bare(w[1].split(',')[0]!)}"
                    onclick={() => toggle(w[0])}
                    ><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></button
                  >
                {:else}
                  <span class="arrow-space" aria-hidden="true"></span>
                {/if}
                <span class="word">
                  <span class="head" lang="ru">{head(w)}</span>
                  {#if chip(w)}<span class="chip">{chip(w)}</span>{/if}
                  <span class="meaning">{w[2]}</span>
                </span>
                <Hear compact text={bare(w[1].split(',')[0]!)} wordKey={w[0]} />
              </div>
              {#if use && isOpen}
                <div id="ex-{w[0].replace(':', '-')}" class="example">
                  <Sentence row={[use[0], use[1], use[2], 0, use[3], use[4]]} />
                  <Hear text={use[1]} rid={use[0]} label="Hear the sentence" />
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    {#if together.length}
      <section class="together" aria-labelledby="together-h">
        <h2 id="together-h">Words that go together</h2>
        <p class="muted small">Verbs these nouns are used with, where English would choose another verb. More on <a href={href({ page: 'learn', topic: 'collocations' })}>the Learn page</a>.</p>
        <ul>
          {#each together as p (p.phrase)}
            <li><strong lang="ru">{renderForm(p.phrase, settings.stress)}</strong> <span>{p.en}</span></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if credits.length}
      <p class="muted small credits">
        Word recordings: {#each credits as c, i (c.name + c.licence)}{i ? ', ' : ''}<a href={c.url} target="_blank" rel="noopener">{c.name}</a> (<a href={c.licenceUrl} target="_blank" rel="noopener">{c.licence}</a>){/each},
        from Wikimedia Commons. Other words are read by your device's voice.
      </p>
    {/if}

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
            <p class="muted reviewed">{reviewedText(d.reviewed)}</p>
          </section>
        {/each}
      </section>
    {:else if theme.drafts}
      <section class="dialogues" aria-labelledby="dialogues-h">
        <h2 id="dialogues-h">Dialogues</h2>
        <p class="muted small">Dialogues for this theme are written and waiting for a native speaker's check. They'll appear here once checked.</p>
      </section>
    {/if}

    <p class="report-line"><ReportLink what="Vocabulary: {theme.title}" details={['(a word, a meaning, a sentence, a dialogue…)']} /></p>

    <nav class="pager" aria-label="Themes">
      {#if near.prev}<a href={href({ page: 'vocabulary', theme: near.prev.id })}><span class="muted small">← Previous</span> {near.prev.title}</a>{:else}<span></span>{/if}
      {#if near.next}<a class="next" href={href({ page: 'vocabulary', theme: near.next.id })}><span class="muted small">Next →</span> {near.next.title}</a>{/if}
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
    position: relative;
    border-top: 1px solid var(--border);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .word {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
    padding: 6px 0;
  }
  /* The arrow beside the word: points right when closed, down when its example is open. */
  .arrow,
  .arrow-space {
    flex: none;
    width: 32px;
    height: 32px;
  }
  /* Just the chevron: no box. The button keeps a 32px target for fingers. */
  .arrow {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .arrow svg {
    transform: rotate(-90deg);
  }
  .arrow[aria-expanded='true'] svg {
    transform: rotate(0deg);
  }
  .arrow:hover,
  .arrow[aria-expanded='true'] {
    color: var(--text);
  }
  @media (prefers-reduced-motion: no-preference) {
    .arrow svg {
      transition: transform 150ms ease;
    }
  }
  .example {
    padding: 6px 10px 10px;
    border-left: 3px solid var(--primary-bg);
    margin: 0 0 8px 38px;
  }
  .hint {
    margin: 10px 0 0;
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
  .together ul {
    list-style: none;
    padding: 0;
    margin: 6px 0 0;
  }
  .together li {
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  .together strong {
    font-family: var(--serif);
    margin-right: 8px;
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
  .small {
    font-size: 0.88rem;
  }
  .report-line {
    margin: 20px 0 0;
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
