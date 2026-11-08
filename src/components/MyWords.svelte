<script lang="ts">
  import { renderForm } from '../shared/forms.ts';
  import { loadWordList } from '../lib/data.ts';
  import { today } from '../lib/progress.ts';
  import { href } from '../lib/router.ts';
  import type { Word } from '../lib/types.ts';
  import { clearWords, dueKeys, loadWords, removeWord, saveWords, type MyWords } from '../lib/words.ts';

  /**
   * "Your words" on the Progress page (shown only while progress is on): how many words, how many are due, a review
   * button and the list with Remove. Export and import (of all progress) are on the Progress page.
   */
  let { onreview }: { onreview: () => void } = $props();
  const SHOW = 30;

  let mine = $state<MyWords>(loadWords());
  let info = $state<Map<string, Word>>(new Map());
  let failed = $state(false);
  let showAll = $state(false);
  let message = $state('');
  let confirmDelete = $state(false);

  const date = today();
  const keys = $derived(Object.keys(mine.words).sort((a, b) => (mine.words[a]!.due < mine.words[b]!.due ? -1 : mine.words[a]!.due > mine.words[b]!.due ? 1 : a < b ? -1 : 1)));
  const due = $derived(dueKeys(mine, date).length);
  const shown = $derived(showAll ? keys : keys.slice(0, SHOW));

  // Headwords and meanings come from the word lists: only the bands your words are in.
  $effect(() => {
    const max = Math.max(-1, ...Object.values(mine.words).map((r) => r.b));
    if (max < 0) return;
    loadWordList(max)
      .then((all) => (info = new Map(all.map((w) => [w.key, w]))))
      .catch(() => (failed = true));
  });

  function update(next: MyWords) {
    mine = next;
    saveWords(next);
  }
  function remove(key: string) {
    update(removeWord(mine, key));
    message = '';
  }
  function deleteAll() {
    clearWords();
    mine = loadWords();
    confirmDelete = false;
    message = 'Your words were deleted.';
  }
  const when = (d: string) => (d <= date ? 'due' : new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
</script>

<section class="card words" aria-labelledby="words-h">
  <h2 id="words-h">Your words</h2>
  {#if !keys.length}
    <p class="muted small">
      None yet. Words you practise in the <a href={href({ page: 'drill', mode: 'vocab' })}>Vocabulary drill</a>, or add while
      reading, appear here and come back for review on a schedule.
    </p>
  {:else}
    <p class="small">
      <strong>{keys.length}</strong> {keys.length === 1 ? 'word' : 'words'} · <strong>{due}</strong> due today.
      Right first time, a word waits longer before it comes back (1, 3, 7, 14, 30, then 60 days); wrong, and it's back tomorrow.
    </p>
    {#if due}<button class="btn primary" onclick={onreview}>Review {due} due {due === 1 ? 'word' : 'words'}</button>{/if}
    {#if failed}<p class="muted small">The word list didn't load, so only the schedule is shown. Reload to try again.</p>{/if}
    <table>
      <thead><tr><th scope="col">Word</th><th scope="col">Meaning</th><th scope="col" class="num">Next</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr></thead>
      <tbody>
        {#each shown as k (k)}
          {@const w = info.get(k)}
          {@const head = w ? renderForm(w.accented.split(',')[0]!, true) : k.slice(2)}
          <tr>
            <th scope="row" lang="ru">{head}</th>
            <td class="meaning">{w?.gloss ?? ''}</td>
            <td class="num">{when(mine.words[k]!.due)}</td>
            <td class="num"><button class="btn quiet small-btn" onclick={() => remove(k)} aria-label="Remove {head}">Remove</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if keys.length > SHOW}
      <button class="btn quiet small-btn more" onclick={() => (showAll = !showAll)}>{showAll ? 'Show fewer' : `Show all ${keys.length}`}</button>
    {/if}
  {/if}

  <div class="files">
    {#if keys.length}
      {#if confirmDelete}
        <span class="small">Delete all {keys.length} words?</span>
        <button class="btn small-btn" onclick={deleteAll}>Delete</button>
        <button class="btn quiet small-btn" onclick={() => (confirmDelete = false)}>Cancel</button>
      {:else}
        <button class="btn quiet small-btn" onclick={() => (confirmDelete = true)}>Delete my words…</button>
      {/if}
    {/if}
  </div>
  <p class="status small" role="status" aria-live="polite">{message}</p>
</section>

<style>
  .words {
    margin-top: 16px;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 1.15rem;
  }
  .small {
    font-size: 0.95rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    table-layout: fixed;
  }
  th,
  td {
    text-align: left;
    padding: 4px 8px 4px 0;
    border-top: 1px solid var(--border);
    font-weight: 400;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
  thead th {
    border-top: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  tbody th {
    font-family: var(--serif);
    font-size: 1.05rem;
  }
  thead th:nth-child(1) {
    width: 28%;
  }
  thead th:nth-child(3) {
    width: 6.5em;
  }
  thead th:nth-child(4) {
    width: 7.5em;
  }
  td .small-btn {
    white-space: nowrap;
  }
  .meaning {
    font-size: 0.92rem;
  }
  .num {
    text-align: right;
    white-space: nowrap;
  }
  .more {
    margin-top: 6px;
  }
  .files {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
  }
  .small-btn {
    min-height: 36px;
    padding: 0.25em 0.9em;
  }
  .status:empty {
    display: none;
  }
  .status {
    margin: 6px 0 0;
  }
</style>
