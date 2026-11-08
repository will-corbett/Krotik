<script lang="ts">
  import { tick } from 'svelte';
  import { renderForm } from '../shared/forms.ts';
  import { checkAnswer } from '../lib/check.ts';
  import { loadLevelTest } from '../lib/data.ts';
  import { buildTypedTest, scoreTest, session, TEST_LEVELS, TYPED_PER_LEVEL, type Answer, type TestItem, type TestLevel } from '../lib/levelTest.ts';
  import { mulberry32 } from '../lib/rng.ts';
  import type { Settings } from '../lib/settings.ts';
  import { toCyrillic } from '../lib/translit.ts';
  import Keyboard from './Keyboard.svelte';

  /**
   * Stage 2 of the Grammar test: type the form instead of choosing it. Recognising the right form (stage 1) and
   * producing it are different skills; this gives a separate, productive result. Kept in memory only, like stage 1.
   */
  let { settings = $bindable(), receptive, exclude }: { settings: Settings; receptive: TestLevel | null; exclude: string[] } = $props();
  const st = session.typed;
  let phase = $state<'intro' | 'question' | 'results'>(st.finished ? 'results' : st.items.length ? 'question' : 'intro');
  let items = $state<TestItem[]>(st.items);
  let answers = $state<Answer[]>([...st.answers]);
  let i = $state(st.at);
  let input = $state('');
  let error = $state('');
  let field = $state<HTMLInputElement>();
  let heading = $state<HTMLElement>();
  const it = $derived(items[i]);
  const r = (f: string) => renderForm(f, settings.stress);
  const frameParts = $derived((it?.q.frame ?? '___').split('___').map((p) => p.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w))));

  function save() {
    st.items = items;
    st.answers = [...answers];
    st.at = i;
    st.finished = phase === 'results';
  }
  async function start() {
    error = '';
    try {
      const data = await loadLevelTest();
      items = buildTypedTest(mulberry32(Math.floor(Math.random() * 2 ** 31)), data, new Set(exclude));
      answers = items.map(() => undefined);
      i = 0;
      input = '';
      phase = 'question';
      save();
      await tick();
      field?.focus();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  async function answer(a: string | null) {
    answers[i] = a;
    input = '';
    if (i + 1 < items.length) i++;
    else phase = 'results';
    save();
    await tick();
    if (phase === 'question') field?.focus();
    else heading?.focus();
  }
  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (input.trim()) answer(input.trim());
  }
  function finishNow() {
    phase = 'results';
    save();
  }
  const responses = $derived(items.map((x, k) => (answers[k] === undefined ? undefined : answers[k] === null ? { correct: false, skipped: true } : { correct: checkAnswer(x.q, answers[k]!).correct, skipped: false })));
  const result = $derived(phase === 'results' ? scoreTest(items, responses) : null);
  const ORDER: (TestLevel | null)[] = [null, ...TEST_LEVELS];
</script>

<section class="card typed" aria-labelledby="typed-h">
  {#if phase === 'intro'}
    <h2 id="typed-h">Stage 2: type the forms</h2>
    <p>
      The test above checks whether you <strong>recognise</strong> the right form among several. This part checks whether
      you can <strong>produce</strong> it: {TYPED_PER_LEVEL * TEST_LEVELS.length} new sentences ({TYPED_PER_LEVEL} per level),
      each with the word in brackets; type the form the sentence needs. About 10–15 minutes. You'll get a separate result.
    </p>
    {#if error}<p class="muted">{error}</p>{/if}
    <button class="btn primary" onclick={start}>Start stage 2</button>
  {:else if phase === 'question' && it}
    <h2 id="typed-h">Stage 2: type the forms</h2>
    <p class="muted small">Question {i + 1} of {items.length} · {it.level}</p>
    <p class="en">“{it.q.headword}”</p>
    <form onsubmit={submit} autocomplete="off">
      <label class="frame" lang="ru">
        <span class="visually-hidden" lang="en">Your answer</span>
        {#if frameParts[0]}<span>{frameParts[0]}</span>{/if}
        <input
          bind:this={field}
          bind:value={input}
          oninput={() => settings.translit && (input = toCyrillic(input))}
          inputmode={settings.keyboard ? 'none' : 'text'}
          lang="ru"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
        />
        {#if frameParts[1]}<span>{frameParts[1]}</span>{/if}
      </label>
      <div class="actions">
        <button class="btn primary" type="submit" disabled={!input.trim()}>Next</button>
        <button class="btn quiet" type="button" onclick={() => answer(null)}>I don't know</button>
        <button class="btn quiet" type="button" aria-pressed={settings.keyboard} onclick={() => ((settings.keyboard = !settings.keyboard), field?.focus())}>⌨ {settings.keyboard ? 'Hide keyboard' : 'Cyrillic keyboard'}</button>
        <button class="btn quiet end" type="button" onclick={finishNow}>End stage 2 now</button>
      </div>
      {#if settings.keyboard}<Keyboard oninsert={(ch) => ((input += ch), field?.focus())} onbackspace={() => ((input = [...input].slice(0, -1).join('')), field?.focus())} />{/if}
    </form>
  {:else if result}
    <h2 id="typed-h" bind:this={heading} tabindex="-1">Stage 2 result: producing the forms</h2>
    <p class="big">{result.level ?? 'Below A1'}</p>
    <p>
      Choosing the form (stage 1): <strong>{receptive ?? 'below A1'}</strong> · Typing it (stage 2): <strong>{result.level ?? 'below A1'}</strong>.
      {#if ORDER.indexOf(result.level) < ORDER.indexOf(receptive)}
        Producing forms usually lags behind recognising them; the gap shows where drilling (typing the forms) will help most.
      {:else}
        You can produce the forms as well as you recognise them.
      {/if}
    </p>
    <table class="levels">
      <caption class="visually-hidden">Typed answers right, by level</caption>
      <thead><tr><th scope="col">Level</th>{#each TEST_LEVELS as l (l)}<th scope="col">{l}</th>{/each}</tr></thead>
      <tbody><tr><th scope="row">Right</th>{#each TEST_LEVELS as l (l)}<td>{result.byLevel[l].right} / {result.byLevel[l].total}</td>{/each}</tr></tbody>
    </table>
    {#if items.some((x, k) => responses[k] && !responses[k]!.correct)}
      <h3>To look at again</h3>
      <ol class="misses">
        {#each items as x, k (x.q.key)}
          {#if responses[k] && !responses[k]!.correct}
            <li>
              <span class="muted small">{x.level}</span>
              <span lang="ru">{x.c[1].slice(0, x.c[3])}<strong>{r(x.c[6])}</strong>{x.c[1].slice(x.c[4])}</span>
              <span class="muted small">{answers[k] === null ? '(I don’t know)' : `You typed: ${answers[k]}`}</span>
            </li>
          {/if}
        {/each}
      </ol>
    {/if}
    <p class="muted small">A rough guide to grammar only, judged the same way as stage 1 (at least 10 in 12 at a level, scaled to the questions answered).</p>
  {/if}
</section>

<style>
  .typed {
    margin-top: 18px;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 1.2rem;
  }
  .small {
    font-size: 0.88rem;
  }
  .en {
    font-style: italic;
    margin: 4px 0 8px;
  }
  .frame {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-family: var(--serif);
    font-size: 1.25rem;
  }
  .frame input {
    font: inherit;
    width: 10rem;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 8px;
  }
  .end {
    margin-left: auto;
  }
  .big {
    font-family: var(--serif);
    font-size: 2rem;
    margin: 0;
  }
  .levels {
    border-collapse: collapse;
    margin: 8px 0;
  }
  .levels th,
  .levels td {
    padding: 4px 10px;
    border-top: 1px solid var(--border);
    text-align: center;
  }
  .misses {
    padding-left: 1.2rem;
  }
  .misses li {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    padding: 4px 0;
  }
</style>
