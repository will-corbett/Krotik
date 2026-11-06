<script lang="ts">
  import type { Inline } from '../lib/learn.ts';
  /** Inline Markdown runs; Cyrillic stretches are marked lang="ru" (serif font, correct pronunciation). */
  let { parts }: { parts: Inline[] } = $props();
  const split = (t: string) => t.split(/([А-ЯЁа-яё][А-ЯЁа-яё́'’-]*(?:\s+[А-ЯЁа-яё][А-ЯЁа-яё́'’-]*)*)/);
</script>

{#each parts as p, i (i)}{#if p.code}<code>{p.text}</code>{:else if p.bold}<strong
      >{#each split(p.text) as s, j (j)}{#if j % 2}<span lang="ru">{s}</span>{:else}{s}{/if}{/each}</strong
    >{:else if p.italic}<em>{#each split(p.text) as s, j (j)}{#if j % 2}<span lang="ru">{s}</span>{:else}{s}{/if}{/each}</em
    >{:else}{#each split(p.text) as s, j (j)}{#if j % 2}<span lang="ru">{s}</span>{:else}{s}{/if}{/each}{/if}{/each}
