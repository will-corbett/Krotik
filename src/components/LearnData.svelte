<script lang="ts">
  import { CASES } from '../shared/cells.ts';
  import { displayForms, renderForm } from '../shared/forms.ts';
  import type { PronounData, SentenceRow } from '../shared/types.ts';
  import { findSentence, findWord, learnPronouns } from '../lib/learnData.ts';
  import { CASE_ABBR } from '../lib/terms.ts';
  import type { ParadigmRef } from '../lib/types.ts';
  import Paradigm from './Paradigm.svelte';
  import Sentence from './Sentence.svelte';

  /** A ::table or ::sentence block on a Learn page; everything shown comes from the data. */
  let {
    kind,
    what,
    word,
    cell = '',
    stress,
  }: { kind: 'table' | 'sentence'; what: 'noun' | 'verb' | 'adjective' | 'pronouns'; word: string; cell?: string; stress: boolean } = $props();

  let ref = $state<ParadigmRef | null>(null);
  let pronouns = $state<PronounData | null>(null);
  let sentence = $state<SentenceRow | null>(null);
  let missing = $state(false);

  $effect(() => {
    (async () => {
      if (kind === 'table' && what === 'pronouns') {
        pronouns = await learnPronouns();
      } else if (kind === 'table') {
        const w = await findWord(what as 'noun', word);
        if (!w) missing = true;
        else ref = what === 'verb' ? { kind: 'verb', verb: w as never } : what === 'noun' ? { kind: 'noun', noun: w as never } : { kind: 'adjective', adjective: w as never };
      } else {
        sentence = (await findSentence(what as 'noun', word, cell)) ?? null;
        if (!sentence) missing = true;
      }
    })();
  });
  const show = (c: string | undefined) => (c ? displayForms(c).map((f) => renderForm(f, stress)).join(', ') : '—');
  const PERSONS = ['я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они'];
</script>

{#if kind === 'table' && ref}
  <div class="data-block"><Paradigm {ref} {stress} /></div>
{:else if kind === 'table' && pronouns}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="data-block scroll" tabindex="0" role="region" aria-label="Personal pronoun table">
    <table>
      <thead>
        <tr><td></td>{#each PERSONS as p (p)}<th scope="col" lang="ru">{p}</th>{/each}</tr>
      </thead>
      <tbody lang="ru">
        {#each CASES.slice(1) as c, i (c)}
          <tr>
            <th scope="row" lang="en">{CASE_ABBR[c].en} <span lang="ru">{CASE_ABBR[c].ru}</span></th>
            {#each PERSONS as p (p)}
              {@const row = pronouns.personal.find((r) => r[0].replace(/'/g, '') === p)}
              <td>
                {show(row?.[1][i + 1])}{#if row && row[2][i + 1] !== row[1][i + 1]}<br /><span class="n">({show(row[2][i + 1])})</span>{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="note muted">In brackets: the form after a preposition (у него, к ней).</p>
  </div>
{:else if kind === 'sentence' && sentence}
  <div class="data-block example"><Sentence row={sentence} /></div>
{:else if missing}
  <p class="muted note">(No example found in the data for “{word}”.)</p>
{/if}

<style>
  .data-block {
    margin: 12px 0 16px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
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
    font-size: 0.85rem;
    white-space: nowrap;
  }
  thead th {
    font-family: var(--serif);
    font-size: 1rem;
    color: var(--text);
    font-weight: 700;
  }
  td {
    font-family: var(--serif);
  }
  .n {
    color: var(--muted);
  }
  .note {
    font-size: 0.85rem;
    margin: 6px 0 0;
  }
  .example {
    border-left: 4px solid var(--primary-bg);
  }
</style>
