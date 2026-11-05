<script lang="ts">
  import { tick } from 'svelte';
  import { displayForms, renderForm } from '../shared/forms.ts';
  import type { LexType, SentenceShard } from '../shared/types.ts';
  import { checkAnswer, type CheckResult } from '../lib/check.ts';
  import { chooseSentence, loadSentences } from '../lib/data.ts';
  import { answer, clearedCount, current, endRound, extendRound, isFinished, type Round } from '../lib/queue.ts';
  import { nextBatch, type Generate } from '../lib/start.ts';
  import type { Settings } from '../lib/settings.ts';
  import { hasRussianVoice, speak } from '../lib/speech.ts';
  import type { Question } from '../lib/types.ts';
  import Keyboard from './Keyboard.svelte';
  import Paradigm from './Paradigm.svelte';
  import Sentence from './Sentence.svelte';
  import TermText from './TermText.svelte';

  let {
    round: initial,
    settings,
    notice,
    more = null,
    onfinish,
  }: { round: Round<Question>; settings: Settings; notice: string; more?: Generate | null; onfinish: (r: Round<Question>) => void } = $props();

  // Unlimited rounds top up the queue whenever it runs low.
  // svelte-ignore state_referenced_locally
  const unlimited = !!more;
  const LOW_WATER = 5;

  // svelte-ignore state_referenced_locally
  let round = $state(initial);
  let input = $state('');
  let phase = $state<'answering' | 'feedback'>('answering');
  let result = $state<CheckResult | null>(null);
  let typed = $state('');
  let wasRetry = $state(false);
  let field = $state<HTMLInputElement>();
  let canSpeak = $state(false);
  let shards = $state<Record<string, SentenceShard>>({});

  const entry = $derived(current(round));
  const q = $derived(entry?.q);
  const total = $derived(round.entries.length);
  const cleared = $derived(clearedCount(round));
  const stress = $derived(settings.stress);
  const r = (f: string) => renderForm(f, stress);

  hasRussianVoice().then((ok) => (canSpeak = ok));

  // Lazy-load sentence shards after the first question is on screen.
  $effect(() => {
    const need = new Set(initial.entries.map((e) => e.q.sentence).filter((s) => !!s).map((s) => `${s!.type}:${s!.band}`));
    for (const k of need) {
      const [type, band] = k.split(':') as [LexType, string];
      loadSentences(type, Number(band))
        .then((s) => (shards[k] = s))
        .catch(() => {
          /* sentences are optional; the drill works without them */
        });
    }
  });

  const sentence = $derived.by(() => {
    const s = q?.sentence;
    if (!s) return undefined;
    return chooseSentence(shards[`${s.type}:${s.band}`]?.[s.lemmaId], s.cell);
  });

  async function focusField() {
    await tick();
    field?.focus();
  }
  $effect(() => {
    void q?.key;
    focusField();
  });

  function submit(e?: SubmitEvent) {
    e?.preventDefault();
    if (!q) return;
    if (phase === 'feedback') return next();
    if (!input.trim()) return;
    grade(input);
  }

  function grade(value: string) {
    if (!q) return;
    typed = value.trim();
    result = checkAnswer(q, value);
    wasRetry = (entry?.attempts ?? 0) > 0;
    phase = 'feedback';
  }

  function dontKnow() {
    if (phase !== 'answering' || !q) return;
    typed = '';
    result = { correct: false };
    wasRetry = (entry?.attempts ?? 0) > 0;
    phase = 'feedback';
    focusField();
  }

  function next() {
    if (!result) return;
    round = answer(round, result.correct, typed || '—');
    if (more && round.queue.length < LOW_WATER) {
      const pending = new Set(round.queue.map((i) => round.entries[i]!.q.key));
      const recent = round.entries.filter((e) => e.attempts > 0).map((e) => e.q.key);
      round = extendRound(round, nextBatch(more, pending, recent));
    }
    input = '';
    result = null;
    phase = 'answering';
    if (isFinished(round)) onfinish(round);
  }

  function end() {
    onfinish(endRound(round));
  }

  // On-screen keys always type at the end. Using the DOM caret made letters land at the front
  // when the box had been tapped near its left edge (the caret moves there on touch).
  function insert(ch: string) {
    if (phase !== 'answering') return;
    input += ch;
    placeCaretAtEnd();
  }
  function backspace() {
    if (phase !== 'answering') return;
    input = [...input].slice(0, -1).join('');
    placeCaretAtEnd();
  }
  function placeCaretAtEnd() {
    tick().then(() => field?.setSelectionRange(input.length, input.length));
  }

  const frameParts = $derived((q?.frame ?? '___').split('___').map((p) => p.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w))));
  const answers = $derived(q ? displayForms(q.answer) : []);
</script>

{#if q && entry}
  <section class="drill" aria-labelledby="prompt-word">
    <div class="bar">
      <p class="count">
        {#if unlimited}<strong>{cleared}</strong> cleared <span class="muted">· unlimited round</span>{:else}<strong>{cleared}</strong> of {total} cleared{/if}
      </p>
      {#if phase === 'answering' ? entry.attempts > 0 : wasRetry}
        <span class="retry">Retry</span>
      {/if}
      <button class="btn end" type="button" onclick={end}>End round</button>
    </div>
    {#if !unlimited}
      <div class="progress" aria-hidden="true"><span style="width: {(100 * cleared) / total}%"></span></div>
    {:else}
      <div class="progress-gap"></div>
    {/if}
    {#if notice}<p class="notice muted">{notice}</p>{/if}

    <div class="card prompt">
      <p class="task"><TermText parts={q.task} /></p>
      <h1 id="prompt-word" class="word" lang={q.headwordIsEnglish ? 'en' : 'ru'}>
        {q.headwordIsEnglish ? q.headword : r(q.headword)}
      </h1>
      {#if q.gloss}<p class="gloss" lang="en">{q.gloss}</p>{/if}
      {#if q.note}<p class="note" lang="ru">{q.note.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w))}</p>{/if}

      <form class="answer" onsubmit={submit} autocomplete="off">
        <label class="frame" lang="ru">
          <span class="visually-hidden" lang="en">Your answer</span>
          {#if frameParts[0]}<span class="frame-text">{frameParts[0]}</span>{/if}
          <input
            bind:this={field}
            bind:value={input}
            class:right={phase === 'feedback' && result?.correct}
            class:wrong={phase === 'feedback' && !result?.correct}
            readonly={phase === 'feedback'}
            inputmode={settings.keyboard ? 'none' : 'text'}
            lang="ru"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint={phase === 'feedback' ? 'next' : 'done'}
            aria-describedby="feedback"
          />
          {#if frameParts[1]}<span class="frame-text">{frameParts[1]}</span>{/if}
        </label>
        <div class="actions">
          {#if phase === 'answering'}
            <button class="btn primary" type="submit" disabled={!input.trim()}>Check</button>
            <button class="btn quiet" type="button" onclick={dontKnow}>I don't know</button>
          {:else}
            <button class="btn primary" type="submit">{!unlimited && isFinished(answer(round, !!result?.correct, typed)) ? 'See results' : 'Next'}</button>
            <span class="muted kbd-hint">or press Enter</span>
          {/if}
        </div>
      </form>

      {#if settings.keyboard && phase === 'answering'}
        <Keyboard oninsert={insert} onbackspace={backspace} />
      {/if}
    </div>

    <div id="feedback" class="feedback-region" role="status" aria-live="polite">
      {#if phase === 'feedback' && result}
        <div class="card feedback fade-in" class:ok={result.correct} class:bad={!result.correct}>
          <p class="verdict">
            {#if result.correct}Correct{:else if typed}Not quite{:else}Answer{/if}
          </p>
          <p class="solution" lang="ru">
            {#each answers as a, i (a)}{#if i}<span class="or" lang="en"> or </span>{/if}<strong>{r(a)}</strong>{/each}
          </p>
          {#if !result.correct && typed}
            <p class="typed">
              You typed <span lang="ru">{typed}</span>{#if result.otherForm}, which is the <strong>{result.otherForm}</strong>{/if}.
              {#if !wasRetry}It comes back at the end of the round.{/if}
            </p>
          {:else if !result.correct}
            <p class="typed">It comes back at the end of the round.</p>
          {/if}

          {#if canSpeak}
            <button class="btn" type="button" onclick={() => speak(q.speak(answers[0] ?? ''))}>
              <span aria-hidden="true">🔊</span> Hear it
            </button>
          {/if}

          {#if sentence}
            <div class="example"><Sentence row={sentence} /></div>
          {/if}

          <details class="forms">
            <summary>Full forms</summary>
            <Paradigm ref={q.paradigm} {stress} highlight={q.key.startsWith('v:') || q.key.startsWith('m:conj') ? `v${q.key.split(':').at(-1)}` : undefined} />
          </details>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .count {
    margin: 0;
  }
  .retry {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--wrong);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 1px 8px;
  }
  .end {
    margin-left: auto;
    min-height: 38px;
    padding: 0.3em 0.9em;
    font-weight: 400;
  }
  .progress-gap {
    height: 14px;
  }
  .progress {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 6px 0 14px;
    overflow: hidden;
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  @media (prefers-reduced-motion: no-preference) {
    .progress span {
      transition: width 200ms ease;
    }
  }
  .notice {
    margin: -6px 0 10px;
    font-size: 0.9rem;
  }
  .task {
    margin: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.95rem;
  }
  .word {
    font-family: var(--serif);
    font-size: clamp(2rem, 8vw, 2.8rem);
    font-weight: 700;
    margin: 4px 0 0;
    overflow-wrap: anywhere;
  }
  .word:lang(en) {
    font-family: var(--sans);
    font-size: clamp(1.6rem, 6vw, 2.1rem);
  }
  .gloss {
    margin: 2px 0 0;
    color: var(--muted);
  }
  .note {
    margin: 4px 0 0;
    color: var(--muted);
  }
  .answer {
    margin-top: 18px;
  }
  .frame {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    font-size: 1.5rem;
  }
  .frame-text {
    font-family: var(--serif);
  }
  input {
    flex: 1 1 10ch;
    min-width: 0;
    max-width: 100%;
    font-family: var(--serif);
    font-size: 1.5rem;
    padding: 6px 10px;
    border: 2px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
  }
  input:focus-visible {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  input.right {
    border-color: var(--correct);
    background: var(--correct-soft);
  }
  input.wrong {
    border-color: var(--wrong);
    background: var(--wrong-soft);
  }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 12px;
  }
  .kbd-hint {
    font-size: 0.9rem;
  }
  .feedback-region {
    margin-top: 14px;
  }
  .feedback {
    border-left: 5px solid var(--border);
  }
  .feedback.ok {
    border-left-color: var(--correct);
  }
  .feedback.bad {
    border-left-color: var(--wrong);
  }
  .verdict {
    margin: 0;
    font-weight: 700;
  }
  .ok .verdict {
    color: var(--correct);
  }
  .bad .verdict {
    color: var(--wrong);
  }
  .solution {
    font-family: var(--serif);
    font-size: 1.6rem;
    margin: 2px 0 6px;
  }
  .or {
    font-family: var(--sans);
    font-size: 1rem;
    color: var(--muted);
  }
  .typed {
    margin: 0 0 10px;
  }
  .example {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .forms {
    margin-top: 12px;
  }
  .forms summary {
    cursor: pointer;
    font-weight: 700;
    color: var(--accent);
    padding: 6px 0;
  }
</style>
