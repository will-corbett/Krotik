<script lang="ts">
  import { loadLearn, parseMarkdown, type Block } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { topicById } from '../lib/topics.ts';
  import MarkdownBlocks from './MarkdownBlocks.svelte';

  let { topic, settings }: { topic: string; settings: Settings } = $props();
  const t = $derived(topicById(topic));
  let blocks = $state<Block[] | null>(null);
  let error = $state('');

  $effect(() => {
    blocks = null;
    error = '';
    loadLearn(topic)
      .then((src) => {
        if (src === null) error = 'This Learn page hasn’t been written yet.';
        else blocks = parseMarkdown(src);
      })
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
  });
</script>

<article class="learn fade-in" aria-labelledby="learn-h1">
  <p class="crumbs"><a href="#/learn">Learn</a> ›</p>
  <h1 id="learn-h1">{t?.title.en ?? topic} {#if t}<span lang="ru" class="ru">{t.title.ru}</span>{/if}</h1>

  {#if error}
    <p class="muted">{error}</p>
  {:else if blocks}
    <MarkdownBlocks {blocks} {settings} />
    {#if t}
      <div class="drill-cta">
        <p>Ready to practise properly?</p>
        <a class="btn primary" href={href({ page: 'drill', mode: t.id })}>Drill: {t.title.en}</a>
      </div>
    {/if}
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
    margin: 4px 0 12px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8em;
  }
  .drill-cta {
    margin-top: 28px;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .drill-cta p {
    margin: 0;
    font-weight: 700;
  }
  .drill-cta a {
    text-decoration: none;
  }
</style>
