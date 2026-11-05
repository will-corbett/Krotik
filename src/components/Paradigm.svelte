<script lang="ts">
  import { ADJ_INDEX, CASES, CASE_LABEL, VERB_CELLS, type AdjCellKey, type AdjSlot } from '../shared/cells.ts';
  import { displayForms, renderForm } from '../shared/forms.ts';
  import { groupLabel } from '../lib/labels.ts';
  import type { ParadigmRef } from '../lib/types.ts';

  let { ref, stress, highlight }: { ref: ParadigmRef; stress: boolean; highlight?: string } = $props();

  const show = (cell: string | undefined) => (cell ? displayForms(cell).map((f) => renderForm(f, stress)).join(', ') : '—');
  const groups = ['presfut', 'past', 'imperative'] as const;
  const SLOTS: AdjSlot[] = ['m', 'f', 'n', 'pl'];
  const adj = (slot: AdjSlot, c: (typeof CASES)[number], suffix = '') =>
    ref.kind === 'adjective' ? ref.adjective.cells[ADJ_INDEX[`${slot}_${c}${suffix}` as AdjCellKey]] : '';
</script>

{#if ref.kind === 'verb'}
  {@const v = ref.verb}
  <div class="tables" lang="ru">
    {#each groups as g (g)}
      {@const rows = VERB_CELLS.map((c, i) => ({ c, i })).filter((x) => x.c.group === g)}
      {#if rows.some((x) => v.cells[x.i])}
        <table>
          <caption lang="en">{groupLabel(g, v.aspect)}</caption>
          <tbody>
            {#each rows as { c, i } (i)}
              <tr class:hl={highlight === `v${i}`}><th scope="row">{c.person}</th><td>{show(v.cells[i])}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/each}
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="scroll" tabindex="0" role="region" aria-label="Adjective forms table">
    <table class="adj">
      <thead lang="en">
        <tr><td></td><th scope="col">masc.</th><th scope="col">fem.</th><th scope="col">neut.</th><th scope="col">plural</th></tr>
      </thead>
      <tbody lang="ru">
        {#each CASES as c (c)}
          <tr>
            <th scope="row" lang="en">{CASE_LABEL[c].slice(0, 4)}.</th>
            {#each SLOTS as s (s)}
              {#if c === 'acc' && (s === 'm' || s === 'pl')}
                <td>{show(adj(s, c))}<br /><span class="anim">{show(adj(s, c, '_anim'))}</span></td>
              {:else}
                <td>{show(adj(s, c))}</td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="note muted">Accusative masculine and plural: inanimate, then <span class="anim">animate</span>.</p>
  </div>
{/if}

<style>
  .tables {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
  }
  table {
    border-collapse: collapse;
  }
  caption {
    text-align: left;
    font-weight: 700;
    font-family: var(--sans);
    font-size: 0.9rem;
    color: var(--muted);
    padding-bottom: 2px;
  }
  th,
  td {
    text-align: left;
    padding: 3px 10px 3px 0;
    vertical-align: top;
  }
  th {
    font-weight: 400;
    color: var(--muted);
  }
  tr.hl td {
    font-weight: 700;
  }
  .scroll {
    max-width: 100%;
    overflow-x: auto;
  }
  .adj thead th {
    font-family: var(--sans);
    font-size: 0.85rem;
  }
  .adj tbody th {
    font-family: var(--sans);
    font-size: 0.85rem;
  }
  .anim {
    color: var(--muted);
  }
  .note {
    font-size: 0.85rem;
    margin: 6px 0 0;
  }
</style>
