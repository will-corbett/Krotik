<script lang="ts">
  import { loadReadingIndex, loadReadingUnit } from '../lib/data.ts';
  import { href } from '../lib/router.ts';
  import { pageTitle } from '../lib/pageMeta.ts';
  import type { Settings } from '../lib/settings.ts';
  import { renderForm } from '../shared/forms.ts';
  import type { ReadingIndex, ReadingUnit } from '../shared/types.ts';
  import ExplainedText from './ExplainedText.svelte';
  import type { Word } from '../lib/types.ts';
  import ReportLink from './ReportLink.svelte';
  import { today } from '../lib/progress.ts';
  import { addWords, loadWords, saveWords } from '../lib/words.ts';

  /**
   * One story or scene. Every word is a button: hovering, tapping or focusing it shows what it is (dictionary form,
   * meaning, which form). Arrow keys move between words, so the text is one Tab stop. Questions follow the text.
   */
  let { id, settings = $bindable(), onpractise }: { id: string; settings: Settings; onpractise: (keys: [string, number][], direction?: 'recognise', theme?: string, words?: Word[]) => void } = $props();
  let unit = $state<ReadingUnit | null>(null);
  // The key words whole (meaning and band), so practising them needn't download the rare-word lists they're in.
  const keyWordList = $derived((unit?.keyWords ?? []).map(([key, band, accented, gloss]): Word => ({ key, accented, gloss, pos: key[0] as Word['pos'], extra: '', band })));
  let index = $state<ReadingIndex | null>(null);
  let error = $state('');
  $effect(() => {
    unit = null;
    error = '';
    answers = [];
    checked = false;
    Promise.all([loadReadingUnit(id), loadReadingIndex()])
      .then(([u, i]) => ((unit = u), (index = i)))
      .catch(() => (error = 'Couldn’t load this text. Check your connection and reload the page.'));
  });
  const work = $derived(unit && index ? index.works[unit.w] : undefined);
  /** A story's title, or "Медведь: явление I" for a scene. */
  const heading = $derived(unit && work ? (work.kind === 'play' ? `${work.title}: ${unit.title.replace(/^Явление/, 'явление')}` : unit.title) : '');
  // The tab title needs the text's title, which arrives with the text.
  $effect(() => {
    if (unit && heading) document.title = pageTitle({ page: 'reading', text: unit.id }, undefined, () => heading);
  });
  const near = $derived.by(() => {
    if (!unit || !index) return {};
    const list = index.units.filter((u) => u.w === unit!.w);
    const i = list.findIndex((u) => u.id === unit!.id);
    return { prev: list[i - 1], next: list[i + 1] };
  });

  // ---- your words (opt-in: only while progress is on)
  let mineKeys = $state(new Set(Object.keys(loadWords().words)));
  function add(items: [string, number][]) {
    if (!settings.progress) return;
    const w = addWords(loadWords(), items, today());
    saveWords(w);
    mineKeys = new Set(Object.keys(w.words));
  }
  const allIn = $derived(!!unit && unit.keyWords.every(([k]) => mineKeys.has(k)));

  // ---- questions
  let answers = $state<(number | undefined)[]>([]);
  let checked = $state(false);
  const right = $derived(unit ? unit.questions.filter((q, i) => answers[i] === q.answer).length : 0);
  const lang = $derived(settings.questionLang);
</script>

<article class="reading fade-in" aria-labelledby="text-title">
  <p class="crumbs"><a href={href({ page: 'reading' })}>Reading</a> ›</p>
  {#if error}
    <p class="muted">{error}</p>
  {:else if unit && work}
    <h1 id="text-title" lang="ru">{heading}</h1>
    <p class="muted credit">
      <span lang="ru">{work.author}, «{work.title}»</span>
      ({work.year}). Public domain, from <a href={work.source} rel="noopener" target="_blank">Russian Wikisource</a>.
    </p>
    <p class="hint muted">Hover over or tap a word to see what it means. With a keyboard, Tab into the text and use the arrow keys.</p>

    {#if unit.keyWords.length >= 3}
      <details class="key-words">
        <summary>Key words before you read <span class="muted">({unit.keyWords.length})</span></summary>
        <p class="muted small">Words in this text that aren't among the 1,000 commonest.</p>
        <ul>
          {#each unit.keyWords as [key, , dict, meaning] (key)}
            <li><strong lang="ru">{renderForm(dict.split(',')[0]!, true)}</strong> <span>{meaning}</span></li>
          {/each}
        </ul>
        <div class="kw-actions">
          <button type="button" class="btn" onclick={() => onpractise(unit!.keyWords.map(([k, b]) => [k, b]), 'recognise', undefined, keyWordList)}>Practise these</button>
          {#if settings.progress}
            <button type="button" class="btn quiet" disabled={allIn} onclick={() => add(unit!.keyWords.map(([k, b]) => [k, b]))}>{allIn ? 'All in your words ✓' : 'Add all to my words'}</button>
          {/if}
        </div>
      </details>
    {/if}

    <ExplainedText lines={unit.lines} words={unit.words} label="The text: each word shows its meaning" uid="reading" progress={settings.progress} mine={mineKeys} onadd={add} />

    {#if unit.questions.length}
      <section class="questions" aria-labelledby="q-title">
        <div class="q-head">
          <h2 id="q-title">Did you follow it?</h2>
          <div class="lang" role="group" aria-label="Language of the questions">
            <button type="button" class="btn small-btn" aria-pressed={lang === 'en'} onclick={() => (settings.questionLang = 'en')}>English</button>
            <button type="button" class="btn small-btn" aria-pressed={lang === 'ru'} onclick={() => (settings.questionLang = 'ru')} lang="ru">Русский</button>
          </div>
        </div>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            checked = true;
          }}
        >
          {#each unit.questions as q, qi (qi)}
            {@const t = q[lang]}
            <fieldset class="q" lang={lang}>
              <legend>{qi + 1}. {t.q}</legend>
              {#each t.options as o, oi (oi)}
                <label
                  class="opt"
                  class:right={checked && oi === q.answer}
                  class:wrong={checked && answers[qi] === oi && oi !== q.answer}
                >
                  <input type="radio" name="q{qi}" value={oi} checked={answers[qi] === oi} disabled={checked} onchange={() => (answers[qi] = oi)} />
                  {o}
                  {#if checked && oi === q.answer}<span class="mark" lang="en">✓ right answer</span>{/if}
                </label>
              {/each}
            </fieldset>
          {/each}
          <div class="q-actions" role="status" aria-live="polite">
            {#if checked}
              <p class="score"><strong>{right} of {unit.questions.length}</strong> right.</p>
              <button
                type="button"
                class="btn"
                onclick={() => {
                  answers = [];
                  checked = false;
                }}>Try again</button
              >
            {:else}
              <button class="btn primary" type="submit" disabled={answers.filter((a) => a !== undefined).length < unit.questions.length}>Check answers</button>
            {/if}
          </div>
        </form>
      </section>
    {/if}

    <p class="report-line"><ReportLink what="Reading: {heading}" details={['(a word explained wrongly, a question, the text…)']} /></p>

    <nav class="pager" aria-label="Texts">
      {#if near.prev}<a href={href({ page: 'reading', text: near.prev.id })}><span class="muted small">← Previous</span> <span lang="ru">{near.prev.title}</span></a>{:else}<span></span>{/if}
      {#if near.next}<a class="next" href={href({ page: 'reading', text: near.next.id })}><span class="muted small">Next →</span> <span lang="ru">{near.next.title}</span></a>{/if}
    </nav>
  {:else}
    <p class="muted">Loading…</p>
  {/if}
</article>

<style>
  .key-words {
    margin: 10px 0 0;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .key-words summary {
    cursor: pointer;
    font-weight: 700;
  }
  .key-words ul {
    list-style: none;
    padding: 0;
    margin: 6px 0;
    columns: 2 16rem;
    column-gap: 24px;
  }
  .key-words li {
    break-inside: avoid;
    padding: 2px 0;
    font-size: 0.95rem;
  }
  .key-words li strong {
    font-family: var(--serif);
    font-size: 1.05rem;
  }
  .key-words .small {
    margin: 4px 0;
    font-size: 0.9rem;
  }
  .kw-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 4px;
  }
  .crumbs {
    margin: 0;
    font-size: 0.9rem;
  }
  h1 {
    font-family: var(--serif);
    margin: 4px 0 4px;
  }
  .credit,
  .hint {
    margin: 0 0 6px;
    font-size: 0.92rem;
  }
  .questions {
    margin-top: 26px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .q-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .q-head h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  .lang {
    display: flex;
    gap: 6px;
  }
  .lang [aria-pressed='true'] {
    background: var(--primary-bg);
    color: var(--primary-text);
  }
  .q {
    border: 0;
    padding: 0;
    margin: 16px 0 0;
  }
  .q legend {
    font-weight: 700;
    margin-bottom: 6px;
  }
  .opt {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 5px 8px;
    border-radius: var(--radius);
  }
  .opt.right {
    background: var(--correct-soft);
  }
  .opt.wrong {
    background: var(--wrong-soft);
  }
  .mark {
    font-size: 0.85rem;
    color: var(--correct);
    margin-left: 4px;
  }
  .q-actions {
    margin-top: 14px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .score {
    margin: 0;
  }
  .report-line {
    margin: 20px 0 0;
  }
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .pager .next {
    text-align: right;
  }
  .small {
    font-size: 0.85rem;
  }
</style>
