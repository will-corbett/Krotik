<script lang="ts">
  import { CASES } from '../shared/cells.ts';
  import { displayForms, renderForm } from '../shared/forms.ts';
  import type { PronounData, SentenceRow } from '../shared/types.ts';
  import { findNumeral, findParticiples, findParticipleSentence, findPossessive, findSentence, findWord, learnPronouns } from '../lib/learnData.ts';
  import type { NumeralRow } from '../shared/types.ts';
  import type { SentenceKind, TableKind } from '../lib/learn.ts';
  import { TERMS } from '../lib/terms.ts';
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
  }: { kind: 'table' | 'sentence'; what: TableKind | SentenceKind; word: string; cell?: string; stress: boolean } = $props();

  let ref = $state<ParadigmRef | null>(null);
  let pronouns = $state<PronounData | null>(null);
  let sentence = $state<SentenceRow | null>(null);
  let missing = $state(false);
  /** the data couldn't be fetched (offline, or a failed request) */
  let failed = $state(false);
  let numeral = $state<NumeralRow | null>(null);

  $effect(() => {
    (async () => {
      if (kind === 'table' && what === 'pronouns') {
        pronouns = await learnPronouns();
      } else if (kind === 'table' && what === 'participles') {
        const p = await findParticiples(word);
        if (p) ref = { kind: 'participles', row: p.row };
        else missing = true;
      } else if (kind === 'table' && what === 'possessive') {
        const p = await findPossessive(word);
        if (p) ref = { kind: 'adjective', adjective: { id: 0, accented: p[0], gloss: '', cells: p[1], extra: [], band: 0 } };
        else missing = true;
      } else if (kind === 'table' && what === 'numeral') {
        numeral = (await findNumeral(word)) ?? null;
        if (!numeral) missing = true;
      } else if (kind === 'sentence' && what === 'participle') {
        sentence = (await findParticipleSentence(word, cell)) ?? null;
        if (!sentence) missing = true;
      } else if (kind === 'table') {
        const w = await findWord(what as 'noun' | 'verb' | 'adjective', word);
        if (!w) missing = true;
        else ref = what === 'verb' ? { kind: 'verb', verb: w as never } : what === 'noun' ? { kind: 'noun', noun: w as never } : { kind: 'adjective', adjective: w as never };
      } else {
        sentence = (await findSentence(what as 'noun' | 'verb' | 'adjective', word, cell)) ?? null;
        if (!sentence) missing = true;
      }
    })().catch(() => (failed = true));
  });
  const show = (c: string | undefined) => (c ? displayForms(c).map((f) => renderForm(f, stress)).join(', ') : '—');
  const PERSONS = ['я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они'];
  /** Numeral columns: by gender where the numeral changes for gender (один, два, оба), else one. */
  const numCols = (r: NumeralRow): { label: string; g: string }[] => {
    const keys = Object.keys(r[2]);
    const has = (g: string) => keys.some((k) => k.split('_').includes(g));
    if (!['m', 'f', 'n'].some(has)) return [{ label: '', g: '' }];
    return [
      { label: 'masc.', g: 'm' },
      { label: 'neut.', g: 'n' },
      { label: 'fem.', g: 'f' },
      ...(has('pl') && keys.some((k) => k.startsWith('nom_pl')) && has('m') ? [{ label: 'plural', g: 'pl' }] : []),
    ];
  };
  const numCell = (r: NumeralRow, c: string, g: string, anim: string) => {
    const tries = [[c, g, anim], [c, g], [c, anim], [c], [c, 'pl', anim], [c, 'pl']].map((p) => p.filter(Boolean).join('_'));
    for (const k of tries) if (r[2][k]) return r[2][k];
    return '';
  };
</script>

{#if failed}
  <p class="muted">(Couldn’t load this {kind === 'table' ? 'table' : 'example'}. Check your connection and reload the page.)</p>
{:else if kind === 'table' && ref}
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
{:else if kind === 'table' && numeral}
  {@const cols = numCols(numeral)}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="data-block scroll" tabindex="0" role="region" aria-label="Numeral table">
    <table>
      {#if cols.length > 1}
        <thead><tr><td></td>{#each cols as c (c.g)}<th scope="col">{c.label}</th>{/each}</tr></thead>
      {/if}
      <tbody lang="ru">
        {#each CASES as c (c)}
          {#if c === 'acc' && Object.keys(numeral[2]).some((k) => k.startsWith('acc') && /anim/.test(k))}
            {#each ['inan', 'anim'] as a (a)}
              <tr>
                <th scope="row" lang="en">{CASE_ABBR.acc.en} <span lang="ru">{CASE_ABBR.acc.ru}</span> ({a === 'anim' ? TERMS.animate.en : TERMS.inanimate.en})</th>
                {#each cols as col (col.g)}<td>{show(numCell(numeral, c, col.g, a))}</td>{/each}
              </tr>
            {/each}
          {:else}
            <tr>
              <th scope="row" lang="en">{CASE_ABBR[c].en} <span lang="ru">{CASE_ABBR[c].ru}</span></th>
              {#each cols as col (col.g)}<td>{show(numCell(numeral, c, col.g, ''))}</td>{/each}
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
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
