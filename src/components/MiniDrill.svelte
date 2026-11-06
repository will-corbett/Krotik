<script lang="ts">
  import { tick } from 'svelte';
  import { displayForms, renderForm } from '../shared/forms.ts';
  import { checkAnswer, type CheckResult } from '../lib/check.ts';
  import { mulberry32 } from '../lib/rng.ts';
  import { DEFAULTS, type Settings } from '../lib/settings.ts';
  import { prepareRound } from '../lib/start.ts';
  import { href } from '../lib/router.ts';
  import { toCyrillic } from '../lib/translit.ts';
  import type { Mode, Question } from '../lib/types.ts';
  import TermText from './TermText.svelte';

  /** A short check on a Learn page: a few questions, answer shown after each, nothing stored. */
  let { mode, overrides, count, settings }: { mode: Mode; overrides: Record<string, unknown>; count: number; settings: Settings } = $props();

  let questions = $state<Question[]>([]);
  let i = $state(0);
  let input = $state('');
  let result = $state<CheckResult | null>(null);
  let typed = $state('');
  let right = $state(0);
  let error = $state('');
  let field = $state<HTMLInputElement>();
  let nextBtn = $state<HTMLButtonElement>();

  async function load() {
    error = '';
    const key = (mode === 'stress' ? 'stressDrill' : mode) as keyof Settings;
    const base = structuredClone(DEFAULTS) as Settings;
    const s = { ...base, stress: settings.stress, translit: settings.translit, mode, band: 1, count } as Settings;
    if (key in s && typeof s[key] === 'object') (s as unknown as Record<string, unknown>)[key] = { ...(s[key] as object), ...overrides };
    try {
      const gen = await prepareRound(s, mulberry32(Math.floor(Math.random() * 2 ** 31)));
      questions = gen(count);
      i = 0;
      right = 0;
      result = null;
      input = '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  $effect(() => {
    load();
  });

  const q = $derived(questions[i]);
  const done = $derived(questions.length > 0 && i >= questions.length);
  const r = (f: string) => renderForm(f, settings.stress);

  function grade(value: string) {
    if (!q || result) return;
    typed = value.trim();
    result = checkAnswer(q, value);
    if (result.correct) right++;
    tick().then(() => nextBtn?.focus());
  }
  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (result) return next();
    if (input.trim()) grade(input);
  }
  function next() {
    i++;
    result = null;
    input = '';
    tick().then(() => field?.focus());
  }
  const parts = $derived((q?.frame ?? '___').split('___'));
</script>

<div class="mini" role="group" aria-label="Quick check">
  {#if !done && questions.length}<p class="head muted">Question {Math.min(i + 1, questions.length)} of {questions.length}</p>{/if}
  {#if error}
    <p class="muted">Couldn't load this check: {error}</p>
  {:else if done}
    <p>You got <strong>{right} of {questions.length}</strong> right.</p>
    <div class="row">
      <button class="btn" onclick={load}>Another set</button>
      <a class="btn primary" href={href({ page: 'drill', mode })}>Drill this topic</a>
    </div>
  {:else if q}
    <p class="task"><TermText parts={q.task} /></p>
    <p class="word" lang={q.headwordIsEnglish ? 'en' : 'ru'}>{q.headwordIsEnglish ? q.headword : r(q.headword)}</p>
    {#if q.gloss}<p class="muted gloss">{q.gloss}</p>{/if}
    <form onsubmit={submit} autocomplete="off">
      {#if q.choices}
        <p class="frame" lang="ru">{parts[0]}<span class="blank">{result ? displayForms(q.answer)[0] : '___'}</span>{parts[1]}</p>
        <div class="row">
          {#each q.choices as c (c)}
            <button type="button" class="btn choice" lang="ru" disabled={!!result} onclick={() => grade(c)}>{c}</button>
          {/each}
        </div>
      {:else}
        <label class="frame" lang="ru">
          <span class="visually-hidden" lang="en">Your answer</span>
          {#if parts[0]}<span>{parts[0]}</span>{/if}
          <input
            bind:this={field}
            bind:value={input}
            oninput={() => {
              if (settings.translit) input = toCyrillic(input);
            }}
            readonly={!!result}
            class:right={result?.correct}
            class:wrong={result && !result.correct}
            lang="ru"
            autocapitalize="off"
            spellcheck="false"
          />
          {#if parts[1]}<span>{parts[1]}</span>{/if}
        </label>
      {/if}
      <div class="row">
        {#if !result}
          {#if !q.choices}<button class="btn primary" type="submit" disabled={!input.trim()}>Check</button>{/if}
        {:else}
          <button class="btn primary" type="submit" bind:this={nextBtn}>{i + 1 < questions.length ? 'Next' : 'Finish'}</button>
        {/if}
      </div>
    </form>
    <div role="status" aria-live="polite">
      {#if result}
        <p class:ok={result.correct} class:bad={!result.correct} class="verdict">
          {result.correct ? 'Correct' : 'Not quite'} — <span lang="ru">{displayForms(q.answer).map(r).join(' / ')}</span>
          {#if !result.correct && result.otherForm}<span class="muted">(you typed the {result.otherForm})</span>{/if}
        </p>
        {#if q.explain}<p class="muted small">{q.explain}</p>{/if}
      {/if}
    </div>
  {:else}
    <p class="muted">Loading…</p>
  {/if}
</div>

<style>
  .mini {
    margin: 16px 0 20px;
    padding: 14px 16px;
    border: 2px solid var(--primary-bg);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .head {
    margin: 0 0 6px;
  }
  .task {
    margin: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.9rem;
  }
  .word {
    font-family: var(--serif);
    font-size: 1.5rem;
    font-weight: 700;
    margin: 2px 0 0;
  }
  .word:lang(en) {
    font-family: var(--sans);
    font-size: 1.05rem;
    font-weight: 400;
  }
  .gloss {
    margin: 0;
  }
  .frame {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-family: var(--serif);
    font-size: 1.2rem;
    margin: 10px 0 0;
  }
  input {
    flex: 1 1 8ch;
    min-width: 0;
    font-family: var(--serif);
    font-size: 1.2rem;
    padding: 4px 8px;
    border: 2px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
  }
  input.right {
    border-color: var(--correct);
  }
  input.wrong {
    border-color: var(--wrong);
  }
  .blank {
    border-bottom: 2px solid var(--primary-bg);
    min-width: 3ch;
    font-weight: 700;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .row a {
    text-decoration: none;
  }
  .choice {
    font-family: var(--serif);
    font-weight: 400;
  }
  .verdict {
    margin: 10px 0 0;
    font-weight: 700;
  }
  .ok {
    color: var(--correct);
  }
  .bad {
    color: var(--wrong);
  }
  .small {
    font-size: 0.9rem;
    margin: 4px 0 0;
  }
</style>
