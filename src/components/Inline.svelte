<script lang="ts">
  import type { Inline } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  /** Inline Markdown runs; Cyrillic stretches are marked lang="ru" (serif font, correct pronunciation). */
  let { parts }: { parts: Inline[] } = $props();
  const split = (t: string) => t.split(/([А-ЯЁа-яё][А-ЯЁа-яё́'’-]*(?:\s+[А-ЯЁа-яё][А-ЯЁа-яё́'’-]*)*)/);
  /** note:<id>, learn:<topic>, reading:<id> are pages of the site; anything else is an outside link. */
  const target = (h: string) => {
    const [kind, id] = h.split(':') as [string, string];
    if (kind === 'note') return href({ page: 'culture', note: id });
    if (kind === 'learn') return href({ page: 'learn', topic: id });
    if (kind === 'reading') return href({ page: 'reading', text: id });
    return h;
  };
  const outside = (h: string) => /^https?:/.test(h);
</script>

{#snippet text(t: string)}{#each split(t) as s, j (j)}{#if j % 2}<span lang="ru">{s}</span>{:else}{s}{/if}{/each}{/snippet}
{#each parts as p, i (i)}{#if p.href}<a href={target(p.href)} {...outside(p.href) ? { rel: 'noopener', target: '_blank' } : {}}>{@render text(p.text)}{#if outside(p.href)}<span class="visually-hidden"> (opens in a new tab)</span>{/if}</a
  >{:else if p.code}<code>{p.text}</code>{:else if p.bold}<strong>{@render text(p.text)}</strong>{:else if p.italic}<em>{@render text(p.text)}</em>{:else}{@render text(p.text)}{/if}{/each}
