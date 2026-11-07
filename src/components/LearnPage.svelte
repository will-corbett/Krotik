<script lang="ts">
  import { loadLearn, parseMarkdown, type Block } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { neighbours, topicById } from '../lib/topics.ts';
  import MarkdownBlocks from './MarkdownBlocks.svelte';

  let { topic, settings = $bindable() }: { topic: string; settings: Settings } = $props();
  const t = $derived(topicById(topic));
  const near = $derived(neighbours(topic));
  const related = $derived((t?.related ?? []).map(topicById).filter((r) => !!r));
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
  {#if t}
    <p class="level muted">
      {t.level[0] === t.level[1] ? `Level ${t.level[0]}` : `First met at ${t.level[0]} · core by ${t.level[1]}`}
    </p>
  {/if}

  {#if error}
    <p class="muted">{error}</p>
  {:else if blocks}
    <MarkdownBlocks {blocks} bind:settings />
    {#if t}
      <div class="drill-cta">
        <p>Ready to practise properly?</p>
        <a class="btn primary" href={href({ page: 'drill', mode: t.id })}>Drill: {t.title.en}</a>
      </div>
      {#if related.length}
        <section class="related" aria-labelledby="related-h">
          <h2 id="related-h">Related topics</h2>
          <ul>
            {#each related as r (r!.id)}
              <li><a href={href({ page: 'learn', topic: r!.id })}>{r!.title.en}</a> <span lang="ru" class="ru">{r!.title.ru}</span></li>
            {/each}
          </ul>
        </section>
      {/if}
      <nav class="pager" aria-label="Lessons">
        {#if near.prev}<a class="prev" href={href({ page: 'learn', topic: near.prev.id })}><span class="muted small">← Previous</span> {near.prev.title.en}</a>{:else}<span></span>{/if}
        {#if near.next}<a class="next" href={href({ page: 'learn', topic: near.next.id })}><span class="muted small">Next →</span> {near.next.title.en}</a>{/if}
      </nav>
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
  .level {
    margin: -6px 0 14px;
    font-size: 0.9rem;
  }
  .related h2 {
    font-size: 1.05rem;
    margin: 24px 0 6px;
  }
  .related ul {
    margin: 0;
    padding-left: 1.2em;
  }
  .related li {
    line-height: 1.7;
  }
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .pager a {
    display: flex;
    flex-direction: column;
    max-width: 48%;
  }
  .pager .next {
    text-align: right;
    margin-left: auto;
  }
  .small {
    font-size: 0.85rem;
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
