<script lang="ts">
  /** A Learn page's ::idioms block: the idioms or the proverbs, each with its meaning and a real sentence using it. */
  import { loadIdioms } from '../lib/data.ts';
  import { renderForm } from '../shared/forms.ts';
  import type { IdiomData } from '../shared/types.ts';
  import Sentence from './Sentence.svelte';

  let { which, stress }: { which: 'idioms' | 'proverbs'; stress: boolean } = $props();
  let data = $state<IdiomData | null>(null);
  let error = $state(false);
  loadIdioms()
    .then((d) => (data = d))
    .catch(() => (error = true));
  const items = $derived(data ? data.idioms.filter((x) => (which === 'proverbs') === (x[2] === 1)) : []);
  let open = $state(new Set<string>());
  function toggle(k: string) {
    const next = new Set(open);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    open = next;
  }
</script>

{#if error}
  <p class="muted">This list didn't load. Check your connection and reload the page.</p>
{:else if data}
  <ul class="idioms" aria-label={which === 'proverbs' ? 'Proverbs' : 'Idioms'}>
    {#each items as [phrase, meaning, , ex] (phrase)}
      {@const id = `idiom-${phrase.replace(/[^а-яё]+/gi, '-')}`}
      <li>
        <div class="row">
          <button type="button" class="arrow" aria-expanded={open.has(phrase)} aria-controls={id} aria-label="Example: {phrase.replace(/'/g, '')}" onclick={() => toggle(phrase)}
            ><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></button
          >
          <strong lang="ru">{renderForm(phrase, stress)}</strong>
          <span>{meaning}</span>
        </div>
        {#if open.has(phrase) && ex[0]}
          <div {id} class="example"><Sentence row={[ex[0][0], ex[0][1], ex[0][2], 0, ex[0][3], ex[0][4]]} /></div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .idioms {
    list-style: none;
    padding: 0;
    margin: 10px 0 14px;
  }
  li {
    border-bottom: 1px solid var(--border);
    padding: 4px 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  strong {
    font-family: var(--serif);
  }
  .arrow {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    min-width: 32px;
    min-height: 32px;
    padding: 0;
    align-self: center;
  }
  .arrow[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }
  .example {
    margin: 4px 0 8px 36px;
  }
</style>
