<script lang="ts">
  import { loadLearnExtras } from '../lib/data.ts';
  import { renderForm } from '../shared/forms.ts';
  import { normalise } from '../shared/normalise.ts';
  import type { LearnExtras, SentenceRow } from '../shared/types.ts';
  import Sentence from './Sentence.svelte';

  /**
   * What a Learn page quotes from learn.json: real Tatoeba sentences by id (`items`, optionally highlighting one
   * word), or words with their IPA from Wiktionary (`words`). Both are checked by the data build.
   */
  let { items = [], words = [] }: { items?: { id: string; mark?: string }[]; words?: string[] } = $props();
  let data = $state<LearnExtras | null>(null);
  let failed = $state(false);
  $effect(() => {
    loadLearnExtras()
      .then((d) => (data = d))
      .catch(() => (failed = true));
  });

  /** A sentence as a SentenceRow, with the first token equal to `mark` highlighted. */
  function row(id: string, mark?: string): SentenceRow | null {
    const s = data?.sentences[id];
    if (!s) return null;
    const [ru, en] = s;
    if (mark) {
      for (const m of ru.matchAll(/[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g)) {
        if (normalise(m[0]) === normalise(mark)) return [Number(id), ru, en, 0, m.index!, m.index! + m[0].length];
      }
    }
    return [Number(id), ru, en, 0, 0, 0];
  }
</script>

{#if failed}
  <p class="muted">(Couldn’t load the examples. Check your connection and reload.)</p>
{:else if data && items.length}
  <div class="examples">
    {#each items as it (it.id)}
      {@const r = row(it.id, it.mark)}
      {#if r}<div class="ex"><Sentence row={r} /></div>{/if}
    {/each}
  </div>
{:else if data && words.length}
  <div class="table-wrap">
    <table class="ipa">
      <thead><tr><th scope="col">Word</th><th scope="col">Pronunciation (IPA)</th></tr></thead>
      <tbody>
        {#each words as w (w)}
          {@const p = data.ipa[w]}
          {#if p}
            <tr><td lang="ru">{renderForm(p[0], true)}</td><td class="ipa-text">{p[1]}</td></tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
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
  .table-wrap {
    overflow-x: auto;
    margin: 12px 0 16px;
  }
  table {
    border-collapse: collapse;
    min-width: 260px;
  }
  th,
  td {
    text-align: left;
    padding: 6px 14px 6px 0;
    border-bottom: 1px solid var(--border);
  }
  td[lang='ru'] {
    font-size: 1.1rem;
  }
  .ipa-text {
    font-family: 'Charis SIL', 'Doulos SIL', 'Gentium Plus', 'Noto Serif', 'DejaVu Sans', serif;
    font-size: 1.05rem;
  }
</style>
