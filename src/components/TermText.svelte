<script lang="ts">
  import type { TaskPart } from '../lib/terms.ts';
  /**
   * Grammar terms with their Russian names.
   * - `chips` (drills): each term a small pill, English and Russian on one line ("Present · настоящее время"). A plain
   *   Russian word (a pronoun such as она) is a pill of its own, or left out when it's already shown in `shown`
   *   (the frame in front of the answer box), so it never appears twice.
   * - `stack` (table headings): English over Russian.
   */
  let { parts, variant = 'stack', shown = '' }: { parts: TaskPart[]; variant?: 'chips' | 'stack'; shown?: string } = $props();
  const inFrame = (w: string) => new RegExp(`(^|[^а-яё/])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^а-яё/])`, 'i').test(shown);
  const cap = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const visible = $derived(variant === 'chips' ? parts.filter((p) => !(p.ru && !p.en && shown && inFrame(p.ru))) : parts);
</script>

{#if variant === 'chips'}
  <span class="chips">
    {#each visible as p, i (i)}
      {#if p.en && p.ru}
        <span class="chip"><span class="en">{cap(p.en)}</span><span class="sep" aria-hidden="true">·</span><span class="ru" lang="ru">{p.ru}</span></span>
      {:else if p.ru}
        <span class="chip word" lang="ru">{p.ru}</span>
      {:else}
        <span class="chip"><span class="en">{cap(p.en)}</span></span>
      {/if}
    {/each}
  </span>
{:else}
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
{/if}

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
  .chips {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 6px;
    padding: 4px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text);
    font-weight: 600;
    font-size: 0.98rem;
    line-height: 1.35;
  }
  .chip .ru {
    color: var(--muted);
    font-size: 0.95em;
  }
  .sep {
    color: var(--muted);
    font-weight: 400;
  }
  .chip.word {
    font-size: 1rem;
    font-weight: 400;
  }
</style>
