<script lang="ts">
  import { ADJ_EXTRA_INDEX, ADJ_INDEX, CASES, NOUN_INDEX, VERB_CELLS, type AdjCellKey, type AdjSlot } from '../shared/cells.ts';
  import { CASE_ABBR, SLOT_ABBR, TERMS, groupTerm } from '../lib/terms.ts';
  import { displayForms, renderForm } from '../shared/forms.ts';
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
          <caption lang="en">{groupTerm(g, v.aspect).en} <span lang="ru">{groupTerm(g, v.aspect).ru}</span></caption>
          <tbody>
            {#each rows as { c, i } (i)}
              <tr class:hl={highlight === `v${i}`}><th scope="row">{c.person}</th><td>{show(v.cells[i])}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/each}
  </div>
{:else if ref.kind === 'noun'}
  {@const n = ref.noun}
  <table>
    <thead lang="en">
      <tr><td></td><th scope="col">{TERMS.singular.en}<br /><span lang="ru">ед. ч.</span></th><th scope="col">{TERMS.plural.en}<br /><span lang="ru">мн. ч.</span></th></tr>
    </thead>
    <tbody lang="ru">
      {#each CASES as c (c)}
        <tr>
          <th scope="row" lang="en">{CASE_ABBR[c].en} <span lang="ru">{CASE_ABBR[c].ru}</span></th>
          <td>{show(n.cells[NOUN_INDEX[`sg_${c}`]])}</td>
          <td>{n.sgOnly ? '—' : show(n.cells[NOUN_INDEX[`pl_${c}`]])}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if n.counting}<p class="note muted">After numbers 5+ and сколько/несколько: <span lang="ru">{show(n.counting)}</span></p>{/if}
{:else}
  {@const a = ref.adjective}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="scroll" tabindex="0" role="region" aria-label="Adjective forms table">
    <table class="adj">
      <thead lang="en">
        <tr>
          <td></td>
          {#each SLOTS as s (s)}<th scope="col">{SLOT_ABBR[s].en}<br /><span lang="ru">{SLOT_ABBR[s].ru}</span></th>{/each}
        </tr>
      </thead>
      <tbody lang="ru">
        {#each CASES as c (c)}
          <tr>
            <th scope="row" lang="en">{CASE_ABBR[c].en} <span lang="ru">{CASE_ABBR[c].ru}</span></th>
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
    <p class="note muted">
      Accusative masculine and plural: inanimate (<span lang="ru">{TERMS.inanimate.ru}</span>), then
      <span class="anim">animate (<span lang="ru">{TERMS.animate.ru}</span>)</span>.
    </p>
  </div>
  {#if a.extra.some(Boolean)}
    <table class="extra">
      <tbody>
        {#if a.extra[0]}
          <tr>
            <th scope="row">{TERMS.shortForm.en} <span lang="ru">{TERMS.shortForm.ru}</span></th>
            <td lang="ru">{(['short_m', 'short_f', 'short_n', 'short_pl'] as const).map((k) => show(a.extra[ADJ_EXTRA_INDEX[k]])).join(' · ')}</td>
          </tr>
        {/if}
        {#if a.extra[ADJ_EXTRA_INDEX.comparative]}
          <tr><th scope="row">{TERMS.comparative.en} <span lang="ru">{TERMS.comparative.ru}</span></th><td lang="ru">{show(a.extra[ADJ_EXTRA_INDEX.comparative])}</td></tr>
        {/if}
        {#if a.extra[ADJ_EXTRA_INDEX.superlative]}
          <tr><th scope="row">{TERMS.superlative.en} <span lang="ru">{TERMS.superlative.ru}</span></th><td lang="ru">{show(a.extra[ADJ_EXTRA_INDEX.superlative])}</td></tr>
        {/if}
      </tbody>
    </table>
  {/if}
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
  .extra {
    margin-top: 10px;
  }
  .extra th {
    font-size: 0.85rem;
  }
  .note {
    font-size: 0.85rem;
    margin: 6px 0 0;
  }
</style>
