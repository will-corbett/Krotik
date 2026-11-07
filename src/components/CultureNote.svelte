<script lang="ts">
  import { LINKS, loadNote, NOTES, TYPE_LABEL } from '../lib/culture.ts';
  import { href } from '../lib/router.ts';
  import { parseMarkdown, type Block } from '../lib/learn.ts';
  import type { Settings } from '../lib/settings.ts';
  import MarkdownBlocks from './MarkdownBlocks.svelte';

  let { id, settings = $bindable() }: { id: string; settings: Settings } = $props();
  const meta = $derived(NOTES.find((n) => n.id === id));
  const parent = $derived(meta?.parent ? NOTES.find((n) => n.id === meta.parent) : undefined);
  const children = $derived(NOTES.filter((n) => n.parent === id));
  const regionLinks = $derived(meta?.region ? LINKS.filter((l) => l.region === meta.region) : []);
  let blocks = $state<Block[] | null>(null);
  let error = $state('');

  $effect(() => {
    blocks = null;
    error = '';
    loadNote(id)
      .then((src) => {
        if (src === null) error = 'There is no such culture note.';
        else blocks = parseMarkdown(src);
      })
      .catch((e) => (error = e instanceof Error ? e.message : String(e)));
  });
</script>

<article class="note fade-in" aria-labelledby="note-h1">
  <p class="crumbs">
    <a href={href({ page: 'culture' })}>Culture</a> ›
    {#if parent}<a href={href({ page: 'culture', note: parent.id })}>{parent.title}</a> ›{/if}
  </p>
  <h1 id="note-h1">{meta?.title ?? id} {#if meta}<span lang="ru" class="ru">{meta.ru}</span>{/if}</h1>
  {#if error}
    <p class="muted">{error}</p>
  {:else if blocks}
    <MarkdownBlocks {blocks} bind:settings />
    {#if children.length}
      <section class="children" aria-labelledby="children-h">
        <h2 id="children-h">Country by country</h2>
        <ul>
          {#each children as c (c.id)}
            <li><a href={href({ page: 'culture', note: c.id })}>{c.title}</a> <span class="muted">{c.blurb}</span></li>
          {/each}
        </ul>
      </section>
    {/if}
    {#if regionLinks.length}
      <section class="children" aria-labelledby="links-h">
        <h2 id="links-h">Watch, read and listen</h2>
        <ul>
          {#each regionLinks as l (l.url)}
            <li>
              <a href={l.url} target="_blank" rel="noopener noreferrer external">{l.title}<span class="visually-hidden"> (opens in a new tab)</span></a>
              <span class="muted">{TYPE_LABEL[l.type].en}: {l.about}</span>
            </li>
          {/each}
        </ul>
      </section>
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
  .children h2 {
    font-size: 1.2rem;
    margin: 26px 0 8px;
  }
  .children ul {
    padding-left: 1.2em;
  }
  .children li {
    margin: 6px 0;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8em;
  }
</style>
