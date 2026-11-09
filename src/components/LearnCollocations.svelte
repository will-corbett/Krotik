<script lang="ts">
  /** A Learn page's ::collocations block: words that go together, from the data (curated, each found in a real sentence). */
  import { loadCollocations } from '../lib/data.ts';
  import { pairsFor } from '../lib/collocations.ts';
  import { renderForm } from '../shared/forms.ts';
  import type { CollocationData } from '../shared/types.ts';

  let { verbs, stress }: { verbs: string[]; stress: boolean } = $props();
  let data = $state<CollocationData | null>(null);
  let error = $state(false);
  loadCollocations()
    .then((d) => (data = d))
    .catch(() => (error = true));
  const pairs = $derived(data ? pairsFor(data, verbs) : []);
</script>

{#if error}
  <p class="muted">This table didn't load. Check your connection and reload the page.</p>
{:else if data}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="md-table" tabindex="0" role="region" aria-label="Words that go together">
    <table>
      <thead><tr><th scope="col">Russian</th><th scope="col">English</th></tr></thead>
      <tbody>
        {#each pairs as p (p.phrase)}
          <tr>
            <td lang="ru">{renderForm(p.phrase, stress)}{#if p.verbs.length > 1}<span class="muted small"> ({renderForm(p.verbs[0]![1], stress)})</span>{/if}</td>
            <td>{p.en}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .md-table {
    overflow-x: auto;
    margin: 10px 0 14px;
  }
  table {
    border-collapse: collapse;
    min-width: 60%;
  }
  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 6px 12px 6px 0;
    text-align: left;
    vertical-align: top;
  }
  td[lang='ru'] {
    font-family: var(--serif);
  }
  .small {
    font-size: 0.85rem;
  }
</style>
