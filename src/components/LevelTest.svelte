<script lang="ts">
  import { tick } from 'svelte';
  import { renderForm } from '../shared/forms.ts';
  import { checkAnswer } from '../lib/check.ts';
  import { buildTest, PASS, PER_LEVEL, scoreTest, TEST_LEVELS, type Response, type TestItem, type TestLevel } from '../lib/levelTest.ts';
  import { mulberry32 } from '../lib/rng.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { topicById } from '../lib/topics.ts';
  import TermText from './TermText.svelte';

  /** Nothing here is stored: the result exists only on this page until you leave it. */
  let { settings }: { settings: Settings } = $props();

  type Phase = 'intro' | 'loading' | 'question' | 'results';
  let phase = $state<Phase>('intro');
  let items = $state<TestItem[]>([]);
  let responses = $state<Response[]>([]);
  let i = $state(0);
  let built = $state(0);
  let error = $state('');
  let heading = $state<HTMLElement>();

  const LEVEL_NAME: Record<TestLevel, string> = {
    A1: 'Beginner',
    A2: 'Elementary',
    B1: 'Intermediate',
    B2: 'Upper intermediate',
    C1: 'Advanced',
  };

  const seed = () => {
    const p = new URLSearchParams(location.search).get('seed');
    return p ? Number(p) : Math.floor(Math.random() * 2 ** 31);
  };

  async function start() {
    phase = 'loading';
    error = '';
    built = 0;
    try {
      items = await buildTest(mulberry32(seed()), (n) => (built = n));
      responses = [];
      i = 0;
      phase = 'question';
      focusTop();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      phase = 'intro';
    }
  }

  function focusTop() {
    tick().then(() => heading?.focus());
  }

  function choose(choice: string | null) {
    const it = items[i];
    if (!it || phase !== 'question') return;
    responses[i] = choice === null ? { correct: false, skipped: true } : { correct: checkAnswer(it.q, choice).correct, skipped: false };
    i++;
    if (i >= items.length) {
      phase = 'results';
    }
    focusTop();
  }

  function finishNow() {
    phase = 'results';
    focusTop();
  }

  // 1–4 pick an option, 0 = I don't know.
  function onKey(e: KeyboardEvent) {
    if (phase !== 'question' || e.altKey || e.ctrlKey || e.metaKey) return;
    const q = items[i]?.q;
    if (!q?.choices) return;
    if (e.key === '0') {
      e.preventDefault();
      choose(null);
      return;
    }
    const n = Number(e.key) - 1;
    if (Number.isInteger(n) && n >= 0 && n < q.choices.length) {
      e.preventDefault();
      choose(q.choices[n]!);
    }
  }

  const q = $derived(items[i]?.q);
  const r = (f: string) => renderForm(f, settings.stress);
  /** Russian words in source notation (буты'лка) inside running text → stress marks (or plain, if stress is off). */
  const stressText = (t: string) => t.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w));
  const parts = $derived((q?.frame ?? '___').split('___').map((p) => p.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w))));
  const result = $derived(phase === 'results' ? scoreTest(items, responses) : null);
  const cyr = (s: string) => /[а-яё]/i.test(s);
  // Review what's within reach first: topics up to one level above the result; the rest can wait.
  const reach = $derived(result ? TEST_LEVELS.indexOf(result.level ?? 'A1') + (result.level ? 1 : 0) : 0);
  const now = $derived(result?.review.filter((r) => TEST_LEVELS.indexOf(r.level) <= reach) ?? []);
  const later = $derived(result?.review.filter((r) => TEST_LEVELS.indexOf(r.level) > reach) ?? []);
</script>

<svelte:window onkeydown={onKey} />

<section class="test fade-in" aria-labelledby="test-h1">
  {#if phase === 'intro' || phase === 'loading'}
    <h1 id="test-h1">Level test <span lang="ru" class="ru">тест на уровень</span></h1>
    <p>
      Sixty multiple-choice questions on grammar and reading, starting easy and getting harder: twelve each at A1, A2,
      B1, B2 and C1. Many are gaps in real sentences, where you work out the right form yourself. The questions are
      different every time. It takes about 15–20 minutes; at the end you get an approximate level and a list of Learn
      pages worth reviewing.
    </p>
    <ul class="muted">
      <li>If you don't know, choose <strong>I don't know</strong> rather than guessing: guesses make the result less useful.</li>
      <li>Keys: 1–4 choose an option, 0 means "I don't know".</li>
      <li>It measures grammar and word forms only, not listening, speaking or writing. Nothing is saved.</li>
    </ul>
    {#if error}<p class="err">Couldn't prepare the test: {error}</p>{/if}
    <button class="btn primary" onclick={start} disabled={phase === 'loading'}>
      {phase === 'loading' ? `Preparing… ${built} of 60` : 'Start the test'}
    </button>
  {:else if phase === 'question' && q}
    <div class="top">
      <p class="muted progress-text" bind:this={heading} tabindex="-1" id="test-h1">Question {i + 1} of {items.length}</p>
      <button class="btn quiet" onclick={finishNow}>End test now</button>
    </div>
    <div class="bar" aria-hidden="true"><span style="width: {(i / items.length) * 100}%"></span></div>

    <div class="card question">
      <p class="task"><TermText parts={q.task} /></p>
      <p class="word" lang={q.headwordIsEnglish ? 'en' : 'ru'}>{q.headwordIsEnglish ? q.headword : r(q.headword)}</p>
      {#if q.gloss}<p class="muted gloss">{q.gloss}</p>{/if}
      {#if q.note}<p class="muted gloss">{stressText(q.note)}</p>{/if}
      {#if q.frame && q.frame !== '___'}
        <p class="frame" lang="ru">{parts[0]}<span class="blank">___</span>{parts[1]}</p>
      {/if}
      <div class="choices" role="group" aria-label="Options">
        {#each q.choices ?? [] as c, n (c)}
          <button class="btn choice" lang={cyr(c) ? 'ru' : 'en'} onclick={() => choose(c)}>
            <span class="num" aria-hidden="true">{n + 1}</span> {cyr(c) ? r(c) : c}
          </button>
        {/each}
        <button class="btn quiet dunno" onclick={() => choose(null)}><span class="num" aria-hidden="true">0</span> I don't know</button>
      </div>
    </div>
  {:else if result}
    <h1 id="test-h1" bind:this={heading} tabindex="-1">Your result</h1>
    <div class="card verdict">
      {#if result.level}
        <p class="big">{result.level === 'C1' ? 'C1 or above' : result.level}</p>
        <p><strong>{LEVEL_NAME[result.level]}</strong>, approximately: your grammar and word forms are secure up to this level.</p>
      {:else}
        <p class="big">Starting out</p>
        <p>Below A1 for now. Start with <a href={href({ page: 'learn', topic: 'alphabet' })}>the alphabet</a>, then the first topics in each group.</p>
      {/if}
      {#if result.answered < items.length}<p class="muted small">Based on the {result.answered} questions you answered.</p>{/if}
      <p class="muted small">
        A level counts when three quarters of its questions ({PASS} of {PER_LEVEL}) are right, and every level below it
        counts too. This is a rough guide to grammar and reading, not an official CEFR result.
      </p>
    </div>

    <table class="levels">
      <caption class="visually-hidden">Right answers by level</caption>
      <thead><tr><th scope="col">Level</th><th scope="col">Right</th></tr></thead>
      <tbody>
        {#each TEST_LEVELS as l (l)}
          {@const b = result.byLevel[l]}
          <tr>
            <th scope="row">{l} <span class="muted small">{LEVEL_NAME[l]}</span></th>
            <td>{b.total ? `${b.right} of ${b.total}` : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#snippet reviewList(list: typeof now)}
      <ul class="review">
        {#each list as rv (rv.topic)}
          {@const t = topicById(rv.topic)}
          <li>
            <span class="r-name">{t?.title.en ?? rv.topic} <span lang="ru" class="ru">{t?.title.ru}</span></span>
            <span class="muted small">{rv.level} · missed {rv.missed}</span>
            <span class="r-links">
              <a class="btn small-btn" href={href({ page: 'learn', topic: rv.topic })} aria-label="Learn: {t?.title.en}">Learn</a>
              <a class="btn small-btn" href={href({ page: 'drill', mode: rv.topic })} aria-label="Drill: {t?.title.en}">Drill</a>
            </span>
          </li>
        {/each}
      </ul>
    {/snippet}
    {#if now.length}
      <h2>Worth reviewing</h2>
      <p class="muted">Topics at or just above your level where you missed a question, easiest first.</p>
      {@render reviewList(now)}
    {:else if !result.review.length}
      <p>No mistakes: nothing to review.</p>
    {/if}
    {#if later.length}
      <details class="later">
        <summary>Later: {later.length} more advanced {later.length === 1 ? 'topic' : 'topics'}</summary>
        {@render reviewList(later)}
      </details>
    {/if}
    <button class="btn" onclick={() => (phase = 'intro')}>Take the test again</button>
  {/if}
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 4px 0 12px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8em;
  }
  p,
  li {
    line-height: 1.6;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .progress-text {
    margin: 0;
    outline: none;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
    margin: 8px 0 14px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--primary-bg);
  }
  .task {
    margin: 0 0 6px;
  }
  .word {
    font-family: var(--serif);
    font-size: 1.8rem;
    margin: 0;
  }
  .gloss {
    margin: 2px 0 0;
  }
  .frame {
    font-size: 1.15rem;
    margin: 12px 0 0;
  }
  .blank {
    padding: 0 6px;
    border-bottom: 2px solid var(--accent);
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }
  .choice {
    justify-content: flex-start;
    text-align: left;
  }
  .num {
    display: inline-block;
    min-width: 1.4em;
    color: var(--muted);
    font-size: 0.85em;
  }
  .dunno {
    align-self: flex-start;
  }
  .verdict .big {
    font-family: var(--serif);
    font-size: 2.4rem;
    margin: 0;
  }
  .levels {
    border-collapse: collapse;
    margin: 16px 0;
  }
  .levels th,
  .levels td {
    text-align: left;
    padding: 6px 16px 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .review {
    list-style: none;
    padding: 0;
    margin: 0 0 18px;
  }
  .review li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .r-name {
    font-weight: 700;
    flex: 1 1 14rem;
  }
  .r-links {
    display: flex;
    gap: 6px;
  }
  .small {
    font-size: 0.85rem;
  }
  .later {
    margin: 0 0 18px;
  }
  .later summary {
    cursor: pointer;
    padding: 6px 0;
  }
  .err {
    color: var(--bad, #b00020);
  }
</style>
