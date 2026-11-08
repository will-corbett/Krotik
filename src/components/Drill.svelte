<script lang="ts">
  import { tick } from 'svelte';
  import { displayForms, renderForm } from '../shared/forms.ts';
  import type { SentenceShard, SentenceType } from '../shared/types.ts';
  import { checkAnswer, type CheckResult } from '../lib/check.ts';
  import { sameSentence } from '../lib/questions/translate.ts';
  import { normalise } from '../shared/normalise.ts';
  import { toCyrillic } from '../lib/translit.ts';
  import { chooseSentence, loadSentences } from '../lib/data.ts';
  import { answer, clearedCount, current, endRound, extendRound, isFinished, RETRY_GAP, type Round } from '../lib/queue.ts';
  import { nextBatch, type Generate } from '../lib/start.ts';
  import type { Settings } from '../lib/settings.ts';
  import { hasRussianVoice, speak } from '../lib/speech.ts';
  import type { Question } from '../lib/types.ts';
  import Keyboard from './Keyboard.svelte';
  import Paradigm from './Paradigm.svelte';
  import Sentence from './Sentence.svelte';
  import TermText from './TermText.svelte';
  import ReportLink from './ReportLink.svelte';
  import { taskText } from '../lib/terms.ts';

  let {
    round: initial,
    settings = $bindable(),
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
  /** Translate drill: the model is shown and we're waiting for you to mark your answer. */
  let selfPending = $state(false);
  let markButton = $state<HTMLButtonElement>();
  let field = $state<HTMLInputElement>();
  let canSpeak = $state(false);
  let shards = $state<Record<string, SentenceShard>>({});
  let choiceButtons = $state<HTMLButtonElement[]>([]);
  let nextButton = $state<HTMLButtonElement>();

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
      const [type, band] = k.split(':') as [SentenceType, string];
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
    return chooseSentence(shards[`${s.type}:${s.band}`]?.[s.lemmaId], s.cell, q.meaning ? q.headword : q.answer);
  });

  async function focusField() {
    await tick();
    if (selfPending) markButton?.focus();
    else if (q?.build && phase === 'answering') poolButtons.find(Boolean)?.focus();
    else if (q?.build) nextButton?.focus();
    else if (q?.choices || q?.stress) (phase === 'feedback' ? nextButton : choiceButtons.find(Boolean))?.focus();
    else field?.focus();
  }

  // Multiple choice: number keys pick an option.
  function onKey(e: KeyboardEvent) {
    if (!q?.choices || phase !== 'answering' || e.altKey || e.ctrlKey || e.metaKey) return;
    const i = Number(e.key) - 1;
    if (Number.isInteger(i) && i >= 0 && i < q.choices.length) {
      e.preventDefault();
      grade(q.choices[i]!);
    }
  }
  $effect(() => {
    void q?.key;
    focusField();
  });

  function submit(e?: SubmitEvent) {
    e?.preventDefault();
    if (!q) return;
    if (phase === 'feedback') return selfPending ? undefined : next();
    if (q.build) {
      if (built.length === q.build.length) grade(built.map((i) => q!.build![i]).join(' '));
      return;
    }
    if (!input.trim()) return;
    grade(input);
  }

  // Build the sentence: the words placed so far (indices into q.build), in order.
  let built = $state<number[]>([]);
  let poolButtons = $state<HTMLButtonElement[]>([]);
  $effect(() => {
    void q?.key;
    built = [];
  });
  async function place(i: number) {
    if (phase !== 'answering' || built.includes(i)) return;
    built = [...built, i];
    await tick();
    // Focus the next unused word, or Check when all are placed.
    (poolButtons.find((b, j) => b && !built.includes(j)) ?? checkButton)?.focus();
  }
  function unplace(at: number) {
    if (phase !== 'answering') return;
    built = built.filter((_, k) => k !== at);
  }
  let checkButton = $state<HTMLButtonElement>();

  function grade(value: string) {
    if (!q) return;
    typed = value.trim();
    wasRetry = (entry?.attempts ?? 0) > 0;
    if (q.selfMark) {
      // Only an exact match is marked right automatically; otherwise you compare and decide.
      const exact = sameSentence(value, q.answer, normalise);
      result = { correct: exact };
      selfPending = !exact;
      phase = 'feedback';
      focusField();
      return;
    }
    // A meaning (English) is one of the options as given, so it's compared as it is.
    result = q.meaning ? { correct: value === q.answer } : checkAnswer(q, value);
    phase = 'feedback';
    if (q.choices || q.stress) focusField();
  }
  const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

  function dontKnow() {
    if (phase !== 'answering' || !q) return;
    typed = '';
    result = { correct: false };
    wasRetry = (entry?.attempts ?? 0) > 0;
    phase = 'feedback';
    focusField();
  }

  /** Translate drill: your own verdict after comparing with the model. */
  function mark(correct: boolean) {
    if (!result) return;
    result = { correct };
    selfPending = false;
    next();
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
  const answers = $derived(q ? (q.selfMark || q.meaning ? [q.answer] : q.display ? displayForms(q.display) : displayForms(q.answer)) : []);
</script>

<svelte:window onkeydown={onKey} />

{#if q && entry}
  {#snippet answerInput()}
    <input
      bind:this={field}
      bind:value={input}
      oninput={() => {
        if (settings.translit && q?.answerLang !== 'en') input = toCyrillic(input);
      }}
      class:right={phase === 'feedback' && !selfPending && result?.correct}
      class:wrong={phase === 'feedback' && !selfPending && !result?.correct}
      readonly={phase === 'feedback'}
      inputmode={settings.keyboard && q?.answerLang !== 'en' ? 'none' : 'text'}
      lang={q?.answerLang ?? 'ru'}
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint={phase === 'feedback' ? 'next' : 'done'}
      aria-describedby="feedback"
      />
  {/snippet}
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
      <p class="task"><TermText parts={q.task} variant="chips" shown={q.frame ?? ''} /></p>
      <h1 id="prompt-word" class="word" class:translation={!!q.source && !q.selfMark} class:to-translate={q.selfMark} lang={q.headwordIsEnglish ? 'en' : 'ru'}>
        {q.headwordIsEnglish ? q.headword : r(q.headword)}
      </h1>
      {#if q.gloss}<p class="gloss" lang="en">{q.gloss}</p>{/if}
      {#if q.note}<p class="note" lang="ru">{q.note.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w))}</p>{/if}

      <form class="answer" onsubmit={submit} autocomplete="off">
        {#if q.stress}
          <div class="stress-word" role="group" aria-label="Tap the stressed vowel" lang="ru">
            {#each [...q.stress.word] as ch, i (i)}
              {#if /[аеиоуыэюяё]/i.test(ch)}
                <button
                  type="button"
                  class="vowel"
                  class:correct-choice={phase === 'feedback' && q.stress.positions.includes(i)}
                  class:picked={phase === 'feedback' && typed === String(i) && !q.stress.positions.includes(i)}
                  disabled={phase === 'feedback'}
                  aria-label="{ch}, letter {i + 1}"
                  onclick={() => grade(String(i))}
                  bind:this={choiceButtons[i]}>{ch}</button
                >
              {:else}
                <span class="cons">{ch}</span>
              {/if}
            {/each}
          </div>
        {:else if q.build}
          <div class="build">
            <p class="built" lang="ru">
              <span class="visually-hidden" lang="en">Your sentence: </span>
              {#if !built.length}<span class="muted placeholder" lang="en">Tap the words in order</span>{/if}
              {#each built as bi, k (bi)}<button type="button" class="wchip placed" disabled={phase === 'feedback'} onclick={() => unplace(k)} aria-label="{q.build[bi]} (take it out)">{q.build[bi]}</button>{/each}
            </p>
            <div class="pool" role="group" aria-label="Words to put in order" lang="ru">
              {#each q.build as w, bi (bi)}
                <button type="button" class="wchip" disabled={built.includes(bi) || phase === 'feedback'} onclick={() => place(bi)} bind:this={poolButtons[bi]}>{w}</button>
              {/each}
            </div>
            {#if built.length && phase === 'answering'}<button type="button" class="btn quiet small-btn" onclick={() => (built = [])}>Start again</button>{/if}
          </div>
        {:else if q.choices && q.meaning}
          <div class="choices meanings" role="group" aria-label="Choose the meaning">
            {#each q.choices as c, i (c)}
              <button
                type="button"
                class="btn choice"
                class:picked={phase === 'feedback' && typed === c}
                class:correct-choice={phase === 'feedback' && c === q.answer}
                disabled={phase === 'feedback'}
                lang="en"
                onclick={() => grade(c)}
                bind:this={choiceButtons[i]}
              >
                <span class="num" aria-hidden="true">{i + 1}</span> {c}
              </button>
            {/each}
          </div>
        {:else if q.choices}
          <p class="frame" lang="ru">
            {#if frameParts[0]}<span class="frame-text">{frameParts[0]}</span>{/if}
            <span class="blank" class:right={phase === 'feedback' && result?.correct} class:wrong={phase === 'feedback' && !result?.correct}>
              {phase === 'feedback' ? (answers[0] ?? '') : '___'}
            </span>
            {#if frameParts[1]}<span class="frame-text">{frameParts[1]}</span>{/if}
          </p>
          <div class="choices" role="group" aria-label="Choose the missing word">
            {#each q.choices as c, i (c)}
              <button
                type="button"
                class="btn choice"
                class:picked={phase === 'feedback' && typed === c}
                class:correct-choice={phase === 'feedback' && answers.includes(c)}
                disabled={phase === 'feedback'}
                lang="ru"
                onclick={() => grade(c)}
                bind:this={choiceButtons[i]}
              >
                <span class="num" aria-hidden="true">{i + 1}</span> {c}
              </button>
            {/each}
          </div>
        {:else}
        <label class="frame" class:sentence-answer={q.selfMark} lang={q.answerLang ?? 'ru'}>
          <span class="visually-hidden" lang="en">Your answer</span>
          {#if frameParts[0]}<span class="frame-text">{frameParts[0]}</span>{/if}
          {@render answerInput()}
          {#if frameParts[1]}<span class="frame-text">{frameParts[1]}</span>{/if}
        </label>
        {/if}
        <div class="actions">
          {#if phase === 'answering'}
            {#if q.build}<button class="btn primary" type="submit" bind:this={checkButton} disabled={built.length < q.build.length}>Check</button>
            {:else if !q.choices && !q.stress}<button class="btn primary" type="submit" disabled={!input.trim()}>Check</button>{/if}
            <button class="btn quiet" type="button" onclick={dontKnow}>I don't know</button>
            {#if q.choices}<span class="muted kbd-hint">or press 1–{q.choices.length}</span>{/if}
            {#if !q.choices && !q.stress && !q.build && q.answerLang !== 'en'}
              <button
                class="btn quiet kb-toggle"
                type="button"
                aria-pressed={settings.keyboard}
                onclick={() => {
                  settings.keyboard = !settings.keyboard;
                  focusField();
                }}
              >
                <span aria-hidden="true">⌨</span> {settings.keyboard ? 'Hide keyboard' : 'Cyrillic keyboard'}
              </button>
            {/if}
          {:else if selfPending}
            <span class="muted kbd-hint">Compare your sentence with the model below, then mark it.</span>
          {:else}
            <button class="btn primary" type="submit" bind:this={nextButton}>{!unlimited && isFinished(answer(round, !!result?.correct, typed)) ? 'See results' : 'Next'}</button>
            <span class="muted kbd-hint">or press Enter</span>
          {/if}
        </div>
      </form>

      {#if settings.keyboard && phase === 'answering' && !q.choices && !q.stress && !q.build && q.answerLang !== 'en'}
        <Keyboard oninsert={insert} onbackspace={backspace} />
      {/if}
    </div>

    <div id="feedback" class="feedback-region" role="status" aria-live="polite">
      {#if phase === 'feedback' && result}
        <div class="card feedback fade-in" class:ok={!selfPending && result.correct} class:bad={!selfPending && !result.correct}>
          <p class="verdict">
            {#if selfPending}A model translation{:else if result.correct}{q.selfMark && typed ? 'Right' : 'Correct'}{:else if typed}Not quite{:else}Answer{/if}
          </p>
          {#if q.meaning}
            <p class="solution meaning-solution"><span lang="ru">{r(q.headword)}</span> <span class="muted" aria-hidden="true">=</span><span class="visually-hidden">means</span> <strong lang="en">{q.answer}</strong></p>
          {:else}
            <p class="solution" lang={q.answerLang ?? 'ru'}>
              {#each answers as a, i (a)}{#if i}<span class="or" lang="en"> or </span>{/if}<strong>{q.stress ? renderForm(a, true) : q.answerLang === 'en' ? a : r(a)}</strong>{/each}
            </p>
          {/if}
          {#if q.selfMark && typed}
            <p class="typed">You wrote <span lang={q.answerLang ?? 'ru'}>{typed}</span>{selfPending ? '' : '.'}</p>
            {#if selfPending}
              <p class="hint muted">Other word orders and words can be just as right. Count it as right if it says the same thing with correct grammar.</p>
              <div class="mark">
                <button class="btn primary" type="button" bind:this={markButton} onclick={() => mark(true)}>I got it right</button>
                <button class="btn" type="button" onclick={() => mark(false)}>Not quite: ask again later</button>
              </div>
            {/if}
          {:else if !result.correct && typed}
            <p class="typed">
              You {q.choices || q.stress ? 'chose' : 'typed'} <span lang={q.meaning ? 'en' : 'ru'}>{q.stress ? `the ${ordinal(Number(typed) + 1)} letter` : typed}</span>{#if result.otherForm}, which is the <strong>{result.otherForm}</strong>{/if}.
              {#if !wasRetry}It comes back {round.queue.length > RETRY_GAP ? `in ${RETRY_GAP} cards` : 'at the end of the round'}.{/if}
            </p>
          {:else if !result.correct}
            <p class="typed">It comes back {round.queue.length > RETRY_GAP ? `in ${RETRY_GAP} cards` : 'at the end of the round'}.</p>
          {/if}

          {#if q.explain}<p class="explain">{q.explain}</p>{/if}

          {#if canSpeak}
            <button class="btn" type="button" onclick={() => speak(q.speak(answers[0] ?? ''))}>
              <span aria-hidden="true">🔊</span> Hear it
            </button>
          {/if}

          {#if sentence}
            <div class="example"><Sentence row={sentence} /></div>
          {/if}

          {#if q.source}
            <p class="src muted">
              Sentence: <a href="https://tatoeba.org/en/sentences/show/{q.source}" rel="noopener" target="_blank">Tatoeba #{q.source}</a>
            </p>
          {/if}
          <p class="report-line"><ReportLink what="Drill question ({q.label})" details={[`Question: ${taskText(q.task)}: ${q.headword}${q.frame ? ` (${q.frame})` : ''}`, `Answer given as right: ${q.answer}`, ...(q.source ? [`Tatoeba #${q.source}`] : [])]} /></p>

          {#if q.paradigm}
            <details class="forms">
              <summary>Full forms</summary>
              <Paradigm ref={q.paradigm} {stress} highlight={q.key.startsWith('v:') || q.key.startsWith('m:conj') ? `v${q.key.split(':').at(-1)}` : undefined} />
            </details>
          {/if}
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
    background: var(--primary-bg);
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
    margin: 0 0 6px;
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
  .sentence-answer input {
    flex-basis: 100%;
    font-size: 1.25rem;
  }
  .mark {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 4px;
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
  .word.to-translate {
    font-size: clamp(1.3rem, 5vw, 1.6rem);
    font-weight: 600;
  }
  .word.translation {
    font-family: var(--sans);
    font-size: 1.15rem;
    font-weight: 400;
    color: var(--muted);
  }
  .blank {
    display: inline-block;
    min-width: 3ch;
    padding: 0 6px;
    border-bottom: 2px solid var(--accent);
    font-weight: 700;
  }
  .blank.right {
    color: var(--correct);
    border-color: var(--correct);
  }
  .blank.wrong {
    color: var(--wrong);
    border-color: var(--wrong);
  }
  .stress-word {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    font-family: var(--serif);
    font-size: 2.2rem;
    margin-top: 6px;
  }
  .vowel {
    font: inherit;
    min-width: 44px;
    min-height: 52px;
    padding: 0 4px;
    border: 2px solid var(--border);
    border-radius: 8px;
    background: var(--accent-soft);
    cursor: pointer;
  }
  .vowel:hover {
    border-color: var(--accent);
  }
  .vowel:disabled {
    cursor: default;
  }
  .vowel.correct-choice {
    border-color: var(--correct);
    background: var(--correct-soft);
  }
  .vowel.picked {
    border-color: var(--wrong);
    background: var(--wrong-soft);
  }
  .cons {
    padding: 0 1px;
  }
  .build {
    margin-top: 12px;
  }
  .build .small-btn {
    min-height: 36px;
    padding: 0.25em 0.9em;
  }
  .built {
    min-height: 2.6rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    margin: 0 0 10px;
    border-bottom: 2px solid var(--border);
  }
  .placeholder {
    font-size: 0.95rem;
  }
  .pool {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .wchip {
    font-family: var(--serif);
    font-size: 1.15rem;
    padding: 4px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }
  .wchip:disabled {
    cursor: default;
  }
  .pool .wchip:disabled {
    opacity: 0.35;
  }
  .wchip.placed {
    background: var(--surface-2);
  }
  .wchip.placed:disabled {
    opacity: 1;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .choice {
    font-family: var(--serif);
    font-size: 1.15rem;
    font-weight: 400;
    min-width: 88px;
  }
  /* Meanings are English and can be long: one per line, left-aligned. */
  .meanings {
    flex-direction: column;
    align-items: stretch;
  }
  .meanings .choice {
    font-family: var(--sans);
    font-size: 1rem;
    text-align: left;
    justify-content: flex-start;
  }
  .meaning-solution strong {
    font-family: var(--sans);
    font-size: 1.1rem;
  }
  .choice .num {
    font-family: var(--sans);
    font-size: 0.8rem;
    color: var(--muted);
  }
  .choice:disabled {
    opacity: 1;
  }
  .choice.picked {
    border-color: var(--wrong);
    background: var(--wrong-soft);
  }
  .choice.correct-choice {
    border-color: var(--correct);
    background: var(--correct-soft);
  }
  .report-line {
    margin: 8px 0 0;
  }
  .src {
    font-size: 0.85rem;
    margin: 10px 0 0;
  }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 12px;
  }
  .kb-toggle {
    margin-left: auto;
  }
  .kb-toggle[aria-pressed='true'] {
    color: var(--text);
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
  .explain {
    margin: 0 0 10px;
    padding: 8px 10px;
    background: var(--surface-2);
    border-radius: 8px;
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
