<script lang="ts">
  import { loadNote, NOTES } from '../lib/culture.ts';
  import { href } from '../lib/router.ts';
  import { parseMarkdown, type Block } from '../lib/learn.ts';
  import type { Settings } from '../lib/settings.ts';
  import MarkdownBlocks from './MarkdownBlocks.svelte';

  let { id, settings = $bindable() }: { id: string; settings: Settings } = $props();
  const meta = $derived(NOTES.find((n) => n.id === id));
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
  <p class="crumbs"><a href={href({ page: 'culture' })}>Culture</a> ›</p>
  <h1 id="note-h1">{meta?.title ?? id} {#if meta}<span lang="ru" class="ru">{meta.ru}</span>{/if}</h1>
  {#if error}
    <p class="muted">{error}</p>
  {:else if blocks}
    <MarkdownBlocks {blocks} bind:settings />
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
</style>
