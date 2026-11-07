<script lang="ts">
  import type { SentenceRow } from '../shared/types.ts';
  import { findExamples } from '../lib/learnData.ts';
  import Sentence from './Sentence.svelte';

  /** Real sentences from a sentence drill's data, with the target word highlighted. */
  let { topic, item, count }: { topic: string; item: string; count: number } = $props();
  let rows = $state<SentenceRow[] | null>(null);
  let failed = $state(false);
  $effect(() => {
    findExamples(topic, item, count)
      .then((r) => (rows = r))
      .catch(() => (failed = true));
  });
</script>

{#if failed}
  <p class="muted">(Couldn’t load the examples. Check your connection and reload the page.)</p>
{:else if rows && rows.length}
  <div class="examples">
    {#each rows as r (r[0])}<div class="ex"><Sentence row={r} /></div>{/each}
  </div>
{:else if rows}
  <p class="muted">(No example found in the data for “{item}”.)</p>
{/if}

<style>
  .examples {
    margin: 12px 0 16px;
    display: grid;
    gap: 8px;
  }
  .ex {
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-left: 4px solid var(--primary-bg);
    border-radius: var(--radius);
    background: var(--surface);
  }
</style>
