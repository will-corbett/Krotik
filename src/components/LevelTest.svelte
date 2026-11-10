<script lang="ts">
  import ReportLink from './ReportLink.svelte';
  import LevelTestTyped from './LevelTestTyped.svelte';
  import { tick } from 'svelte';
  import { renderForm } from '../shared/forms.ts';
  import { loadLevelTest } from '../lib/data.ts';
  import { formTerm, ruleFor, termText } from '../lib/levelTestExplain.ts';
  import { FLOOR, loadTest, PASS, PER_LEVEL, responseOf, scoreTest, session, STAGE2_PUBLISHED, TEST_LEVELS, type Answer, type TestItem, type TestLevel } from '../lib/levelTest.ts';
  import { mulberry32 } from '../lib/rng.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { topicById } from '../lib/topics.ts';

  /**
   * Nothing here is stored: the test and its result are kept in memory (`session`) so you can visit Learn pages and
   * come back to them, until the tab is closed or reloaded.
   */
  let { settings = $bindable() }: { settings: Settings } = $props();

  type Phase = 'intro' | 'loading' | 'question' | 'results';
  let phase = $state<Phase>(session.finished ? 'results' : session.items.length ? 'question' : 'intro');
  let items = $state<TestItem[]>(session.items);
  let answers = $state<Answer[]>([...session.answers]);
  let i = $state(session.at);
  let error = $state('');
  let heading = $state<HTMLElement>();

  const LEVEL_NAME: Record<TestLevel, string> = {
    A1: 'Beginner',
    A2: 'Elementary',
    B1: 'Intermediate',
    B2: 'Upper intermediate',
    C1: 'Advanced',
  };
  /**
   * The grammar learners can usually handle at each level: our own description, based on where Krotik's topics sit
   * (topics.ts levels). Not the Council of Europe's CEFR descriptors, which are their copyright; only the level names
   * are shared.
   */
  const LEVEL_CAN: Record<TestLevel, string[]> = {
    A1: [
      'Present and past tense verbs, and the infinitive after хочу, могу and люблю.',
      'Nouns in the nominative, accusative and prepositional (я читаю книгу, в школе), and the personal pronouns.',
      'Adjectives that agree with their noun, and simple questions with кто, что, где and когда.',
    ],
    A2: [
      'All six cases in the singular, the common plurals, and nouns after numbers (два стола, пять столов).',
      'Everyday aspect pairs (делать / сделать), the future and the imperative.',
      'Verbs of motion such as идти / ходить, time expressions, and impersonal phrases like мне надо and мне холодно.',
    ],
    B1: [
      'Choosing the aspect from the context, prefixed verbs of motion (прийти, уйти), and verbs that take a particular case.',
      'Clauses with который, чтобы and если, and the conditional with бы.',
      'Comparatives, short adjectives, and negation with нет and the ни- words.',
    ],
    B2: [
      'Participles and verbal adverbs (читающий, прочитанный, прочитав) when you read, and the commoner ones when you write.',
      'Aspect in the harder cases: imperatives, negation, and single against repeated actions.',
      'Numbers in every case, word order for emphasis, and reported speech.',
    ],
    C1: [
      'Almost all grammar used accurately, including participles and verbal adverbs in your own writing.',
      'Fine distinctions of aspect, case and word order that change the emphasis or the tone.',
      'Less common and irregular forms, and the grammar of formal and literary Russian.',
    ],
  };

  const seed = () => {
    const p = new URLSearchParams(location.search).get('seed');
    return p ? Number(p) : Math.floor(Math.random() * 2 ** 31);
  };

  // Fetch the question pool (one small file) while the introduction is being read.
  $effect(() => {
    loadLevelTest().catch(() => {});
  });

  /** Keep the in-memory session in step, so leaving the page and coming back finds the test where it was. */
  function save() {
    session.items = items;
    session.answers = [...answers];
    session.at = i;
    session.finished = phase === 'results';
  }

  async function start() {
    phase = 'loading';
    error = '';
    try {
      items = await loadTest(mulberry32(seed()));
      answers = [];
      i = 0;
      phase = 'question';
      save();
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
    if (phase !== 'question' || !items[i]) return;
    answers[i] = choice;
    save();
  }

  function next() {
    if (answers[i] === undefined) return;
    if (i + 1 >= items.length) {
      finish();
      return;
    }
    i++;
    save();
    focusTop();
  }

  function back() {
    if (i === 0) return;
    i--;
    save();
    focusTop();
  }

  function finish() {
    phase = 'results';
    save();
    tick().then(() => window.scrollTo(0, 0));
    focusTop();
  }

  function again() {
    session.typed = { items: [], answers: [], at: 0, finished: false };
    items = [];
    answers = [];
    i = 0;
    phase = 'intro';
    save();
  }

  // 1–5 choose an option, 0 = I don't know, Enter = next (on Back, End test now or a link, Enter presses that instead).
  function onKey(e: KeyboardEvent) {
    if (phase !== 'question' || e.altKey || e.ctrlKey || e.metaKey) return;
    const q = items[i]?.q;
    if (!q?.choices) return;
    if (e.key === 'Enter') {
      // On an option Enter goes on (Space chooses it); on any other button or link it presses that.
      const onOption = e.target instanceof HTMLElement && e.target.closest('.choice');
      if (!onOption && (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) return;
      e.preventDefault();
      next();
      return;
    }
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
  const stressed = (s: string) => s.replace(/[а-яё]+'[а-яё']*/gi, (w) => r(w));
  const parts = $derived((q?.frame ?? '___').split('___').map(stressed));
  const responses = $derived(items.map((it, n) => responseOf(it, answers[n])));
  const result = $derived(phase === 'results' ? scoreTest(items, responses) : null);
  const cyr = (s: string) => /[а-яё]/i.test(s);
  // Review what's within reach first: topics up to one level above the result; the rest can wait.
  const reach = $derived(result ? TEST_LEVELS.indexOf(result.level ?? 'A1') + (result.level ? 1 : 0) : 0);
  const now = $derived(result?.review.filter((r) => TEST_LEVELS.indexOf(r.level) <= reach) ?? []);
  const later = $derived(result?.review.filter((r) => TEST_LEVELS.indexOf(r.level) > reach) ?? []);
  const answered = $derived(items.map((it, n) => ({ it, n, a: answers[n], res: responses[n] })).filter((x) => x.res));
  const missed = $derived(answered.filter((x) => !x.res!.correct));
  const right = $derived(answered.filter((x) => x.res!.correct));
  const last = $derived(i + 1 >= items.length);

  /** The option's form, e.g. "genitive plural (родительный падеж, множественное число)", or "". */
  function formOf(it: TestItem, option: string): string {
    const [, , , , , , rightF, wrong, , , rightCode, wrongCodes] = it.c;
    const code = option === rightF ? rightCode : (wrongCodes[wrong.indexOf(option)] ?? '');
    const t = formTerm(code);
    return t ? termText(t) : '';
  }
</script>

<svelte:window onkeydown={onKey} />

{#snippet sentence(it: TestItem)}
  {@const [, ru, , start, end, , rightF] = it.c}
  <span lang="ru" class="sent">{ru.slice(0, start)}<strong class="ans">{r(rightF)}</strong>{ru.slice(end)}</span>
{/snippet}

<section class="test fade-in" aria-labelledby="test-h1">
  {#if phase === 'intro' || phase === 'loading'}
    <h1 id="test-h1">Grammar test <span lang="ru" class="ru">тест по грамматике</span></h1>
    <p>
      Sixty multiple-choice questions on Russian grammar, starting easy and getting harder: twelve each at A1, A2,
      B1, B2 and C1. Every question is a gap in a real sentence, with the English meaning as a clue: you work out which
      form fits from the sentence itself. The questions are different every time. It takes about 20–25 minutes; at the
      end you get an approximate grammar level, every answer explained, and a list of Learn pages worth reviewing.
    </p>
    <p>
      It measures grammar only. A full CEFR level also covers listening, reading, speaking and writing, which a
      multiple-choice test can't measure, so your overall level may be higher or lower than your grammar level.
    </p>
    <ul class="muted">
      <li>If you don't know, choose <strong>I don't know</strong> rather than guessing: guesses make the result less useful.</li>
      <li>You can go back and change an answer before you submit.</li>
      <li>Keys: 1–5 choose an option, 0 means "I don't know", Enter goes to the next question.</li>
      <li>
        Nothing is saved: your result stays here until you close or reload the tab.
      </li>
    </ul>
    {#if error}<p class="err">Couldn't prepare the test: {error}</p>{/if}
    <button class="btn primary" onclick={start} disabled={phase === 'loading'}>
      {phase === 'loading' ? 'Loading…' : 'Start the test'}
    </button>
  {:else if phase === 'question' && q}
    <div class="top">
      <p class="muted progress-text" bind:this={heading} tabindex="-1" id="test-h1">Question {i + 1} of {items.length}</p>
      <button class="btn quiet" onclick={finish}>End test now</button>
    </div>
    <div class="bar" aria-hidden="true"><span style="width: {(i / items.length) * 100}%"></span></div>

    <div class="card question">
      <p class="instruction">{items[i]!.instruction}</p>
      <p class="meaning muted" lang="en">“{q.headword}”</p>
      {#if q.frame && q.frame !== '___'}
        <p class="frame" lang="ru">{parts[0]}<span class="blank">___</span>{parts[1]}</p>
      {/if}
      <div class="choices" role="group" aria-label="Options">
        {#each q.choices ?? [] as c, n (c)}
          <button class="btn choice" class:chosen={answers[i] === c} aria-pressed={answers[i] === c} lang={cyr(c) ? 'ru' : 'en'} onclick={() => choose(c)}>
            <span class="num" aria-hidden="true">{n + 1}</span> <span class="opt">{cyr(c) ? r(c) : c}</span>
            {#if answers[i] === c}<span class="tick" aria-hidden="true">✓</span>{/if}
          </button>
        {/each}
        <button class="btn choice dunno" class:chosen={answers[i] === null} aria-pressed={answers[i] === null} onclick={() => choose(null)}>
          <span class="num" aria-hidden="true">0</span> <span class="opt">I don't know</span>
          {#if answers[i] === null}<span class="tick" aria-hidden="true">✓</span>{/if}
        </button>
      </div>
      <div class="nav">
        <button class="btn" onclick={back} disabled={i === 0}>Back</button>
        <button class="btn primary" onclick={next} disabled={answers[i] === undefined}>{last ? 'Submit' : 'Next'}</button>
      </div>
      {#if answers[i] === undefined}<p class="muted small hint">Choose an answer, or “I don't know”, to go on.</p>{/if}
    </div>
  {:else if result}
    <h1 id="test-h1" bind:this={heading} tabindex="-1">Your grammar level</h1>
    <div class="card verdict">
      <div class="scope" role="note" aria-label="What this result measures">
        <p><strong>Grammar only: this is not your overall Russian level.</strong></p>
        <p>
          The test checks whether you recognise the right grammatical form among several. Producing forms yourself,
          reading, listening, speaking, writing and conversation are separate skills, and yours may be well ahead of this
          result or behind it.{#if result.level}{' '}A grammar result of {result.level} doesn't mean {result.level} Russian overall.{/if}
        </p>
      </div>
      {#if result.level}
        <p class="big">{result.level === 'C1' ? 'C1 or above' : result.level}</p>
        <p><strong>{LEVEL_NAME[result.level]}</strong>, approximately: your grammar and word forms are secure up to this level.</p>
        <p>At {result.level}, learners can usually handle the grammar below.</p>
        <ul class="can">
          {#each LEVEL_CAN[result.level] as line (line)}<li>{line}</li>{/each}
        </ul>
      {:else}
        <p class="big">Starting out</p>
        <p>
          Below A1 for now: you know some words and forms, but not yet enough to get by. Start with
          <a href={href({ page: 'learn', topic: 'alphabet' })}>the alphabet</a>, then the first topics in each group.
        </p>
      {/if}
      {#each result.slips as l (l)}
        {@const b = result.byLevel[l]}
        <p class="slip">
          You missed {b.total - b.right} of the {b.total} questions at {l}; your results at the levels above made up for
          it, but they're worth a quick look (they're in the list below).
        </p>
      {/each}
      {#if result.answered < items.length}<p class="muted small">Based on the {result.answered} questions you answered.</p>{/if}
      {#if result.level}
        {@const lvl = result.level}
        <div class="set-level" role="status" aria-live="polite">
          {#if settings.pathLevel === lvl}
            <p class="small">Your level is set to <strong>{lvl}</strong>: the home page suggests steps from the <a href={href({ page: 'paths' })}>{lvl} learning path</a>. You can change it in <a href={href({ page: 'settings' })}>Settings</a>.</p>
          {:else}
            <p class="small">Your level is set to {settings.pathLevel}. Start from the {lvl} learning path instead?</p>
            <button class="btn" onclick={() => (settings.pathLevel = lvl)}>Set my level to {lvl}</button>
          {/if}
        </div>
      {/if}
      <p class="muted small">
        You reach a level when you get at least {PASS} of its {PER_LEVEL} questions right, at least {PASS} in {PER_LEVEL}
        right across it and all the levels below, and no level below it under {FLOOR} of {PER_LEVEL}. So a slip at an
        easier level is made up for by strong results above it, but a real gap isn't. This is a rough guide to grammar,
        not an official CEFR result. The level names follow the Council of Europe's CEFR; the descriptions of the grammar
        at each level are our own.
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

    {#if STAGE2_PUBLISHED}
      <LevelTestTyped bind:settings receptive={result.level} exclude={items.map((x) => x.c[0])} />
    {/if}

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
      <p class="muted">Topics at or just above your level where you missed a question, easiest first. Your result stays here while you look at them.</p>
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

    <h2>Your answers</h2>
    <p class="muted">{right.length} right, {missed.length} wrong or “I don't know”{result.answered < items.length ? `, ${items.length - result.answered} not answered` : ''}.</p>
    {#if missed.length}
      <h3>To look at again</h3>
      <ol class="answers">
        {#each missed as { it, n, a } (it.q.key)}
          {@const rightF = it.c[6]}
          {@const rule = ruleFor(it.c[9])}
          {@const t = topicById(it.topic)}
          <li class="miss">
            <p class="a-head"><span class="muted small">{n + 1} · {it.level}</span> <span class="mark bad" aria-hidden="true">✗</span> {@render sentence(it)}</p>
            <p class="muted small en">“{it.q.headword}”</p>
            <p>
              {#if a === null}
                You chose “I don't know”.
              {:else}
                You chose <strong lang="ru">{r(a!)}</strong>{#if formOf(it, a!)}: {formOf(it, a!)}{/if}.
              {/if}
              The answer is <strong lang="ru">{r(rightF)}</strong>{#if formOf(it, rightF)}: {formOf(it, rightF)}{/if}.
            </p>
            {#if rule}<p class="rule">{rule}</p>{/if}
            <p class="small"><a href={href({ page: 'learn', topic: it.topic })}>Learn: {t?.title.en ?? it.topic}</a> · <ReportLink what="Grammar test question ({it.level}, {t?.title.en ?? it.topic})" details={[`Sentence: ${it.c[1]}`, `English: ${it.q.headword}`, `Answer given as right: ${rightF}`, `Options: ${it.q.choices?.join(', ') ?? ''}`]} label="Report this question" /></p>
          </li>
        {/each}
      </ol>
    {/if}
    {#if right.length}
      <details class="later">
        <summary>Right answers ({right.length})</summary>
        <ol class="answers">
          {#each right as { it, n } (it.q.key)}
            <li><p class="a-head"><span class="muted small">{n + 1} · {it.level}</span> <span class="mark good" aria-hidden="true">✓</span> {@render sentence(it)}</p></li>
          {/each}
        </ol>
      </details>
    {/if}
    <button class="btn" onclick={again}>Take the test again</button>
  {/if}
</section>

<style>
  .set-level {
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .set-level p {
    margin: 0 0 6px;
  }
  .scope {
    margin: 0 0 14px;
    padding: 10px 14px;
    border-left: 4px solid var(--primary-bg);
    background: var(--surface-2);
    border-radius: var(--radius);
  }
  .scope p {
    margin: 0 0 4px;
  }
  .scope p:last-child {
    margin: 0;
  }
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
  .instruction {
    margin: 0 0 6px;
    font-weight: 700;
  }
  .meaning {
    margin: 0;
    font-style: italic;
  }
  .frame {
    font-family: var(--serif);
    font-size: 1.35rem;
    line-height: 1.5;
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
  .choice .opt {
    flex: 1;
  }
  .choice.chosen {
    border: 2px solid var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }
  .tick {
    color: var(--accent);
  }
  /* "I don't know" is a button like the options, but plainly set apart: dashed outline, no fill, ordinary weight. */
  .dunno {
    margin-top: 6px;
    border-style: dashed;
    background: transparent;
    color: var(--muted);
    font-weight: 400;
    font-style: italic;
  }
  .dunno.chosen {
    border-style: dashed;
    color: var(--text);
  }
  .num {
    display: inline-block;
    min-width: 1.4em;
    color: var(--muted);
    font-size: 0.85em;
    font-style: normal;
  }
  .nav {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 18px;
  }
  .nav .btn {
    min-width: 7rem;
  }
  .hint {
    margin: 8px 0 0;
    text-align: right;
  }
  .verdict .big {
    font-family: var(--serif);
    font-size: 2.4rem;
    margin: 0;
  }
  .slip {
    border-left: 3px solid var(--accent);
    padding-left: 10px;
  }
  .can {
    margin: 0 0 8px;
    padding-left: 1.2em;
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
  .answers {
    list-style: none;
    padding: 0;
    margin: 0 0 18px;
  }
  .answers li {
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .answers p {
    margin: 0 0 4px;
  }
  .sent {
    font-family: var(--serif);
    font-size: 1.1rem;
  }
  .ans {
    color: var(--accent);
  }
  .mark.good {
    color: var(--correct);
  }
  .mark.bad {
    color: var(--wrong);
  }
  .rule {
    border-left: 3px solid var(--border);
    padding-left: 10px;
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
