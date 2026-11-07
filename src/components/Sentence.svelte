<script lang="ts">
  import type { SentenceRow } from '../shared/types.ts';
  let { row }: { row: SentenceRow } = $props();
  const [id, ru, en, , start, end] = $derived(row);
</script>

<figure class="sentence">
  <blockquote lang="ru">{#if end > start}{ru.slice(0, start)}<mark>{ru.slice(start, end)}</mark>{ru.slice(end)}{:else}{ru}{/if}</blockquote>
  <figcaption>
    {en}
    <a class="src" href="https://tatoeba.org/en/sentences/show/{id}" rel="noopener" target="_blank">Tatoeba #{id}</a>
  </figcaption>
</figure>

<style>
  .sentence {
    margin: 0;
  }
  blockquote {
    margin: 0;
    font-size: 1.15rem;
  }
  mark {
    background: var(--mark);
    color: inherit;
    padding: 0 2px;
    border-radius: 3px;
  }
  figcaption {
    color: var(--muted);
    margin-top: 2px;
  }
  .src {
    font-size: 0.8rem;
    margin-left: 6px;
    color: var(--muted);
  }
</style>
