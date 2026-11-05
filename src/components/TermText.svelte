<script lang="ts">
  import type { TaskPart } from '../lib/terms.ts';
  /** Grammar terms stacked as English over Russian; plain words (e.g. "она") stand alone. */
  let { parts }: { parts: TaskPart[] } = $props();
</script>

<span class="terms">
  {#each parts as p, i (i)}
    {#if p.en && p.ru}
      <span class="term"><span class="en">{p.en}</span><span class="ru" lang="ru">{p.ru}</span></span>
    {:else if p.ru}
      <span class="term word" lang="ru">{p.ru}</span>
    {:else}
      <span class="term"><span class="en">{p.en}</span></span>
    {/if}
  {/each}
</span>

<style>
  .terms {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 2px 16px;
  }
  .term {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .ru {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 0.92em;
  }
  .word {
    font-family: var(--serif);
  }
</style>
