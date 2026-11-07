<script lang="ts">
  import { tick } from 'svelte';
  import { loadReadingIndex, loadReadingUnit } from '../lib/data.ts';
  import { href } from '../lib/router.ts';
  import { pageTitle } from '../lib/pageMeta.ts';
  import type { Settings } from '../lib/settings.ts';
  import { renderForm } from '../shared/forms.ts';
  import { normalise } from '../shared/normalise.ts';
  import type { ReadingIndex, ReadingUnit, WordReading } from '../shared/types.ts';

  /**
   * One story or scene. Every word is a button: hovering, tapping or focusing it shows what it is (dictionary form,
   * meaning, which form). Arrow keys move between words, so the text is one Tab stop. Questions follow the text.
   */
  let { id, settings = $bindable() }: { id: string; settings: Settings } = $props();
  let unit = $state<ReadingUnit | null>(null);
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

  // ---- words
  type Piece = { text: string; word?: number };
  const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;
  /** Each line as text pieces, words numbered in reading order. */
  const lines = $derived.by(() => {
    let n = 0;
    return (unit?.lines ?? []).map(([speaker, text, stage]) => {
      const pieces: Piece[] = [];
      let last = 0;
      for (const m of text.matchAll(TOKEN)) {
        if (m.index! > last) pieces.push({ text: text.slice(last, m.index) });
        pieces.push({ text: m[0], word: n++ });
        last = m.index! + m[0].length;
      }
      if (last < text.length) pieces.push({ text: text.slice(last) });
      return { speaker, stage, pieces };
    });
  });
  const wordCount = $derived(lines.reduce((k, l) => k + l.pieces.filter((p) => p.word !== undefined).length, 0));
  let active = $state(0);
  let shown = $state<{ word: string; readings: WordReading[]; x: number; y: number; below: boolean } | null>(null);
  let textEl = $state<HTMLElement>();
  let buttons: HTMLButtonElement[] = [];

  function show(e: Event, word: string, i: number) {
    active = i;
    const readings = unit?.words[normalise(word)] ?? [];
    const btn = e.currentTarget as HTMLElement;
    const box = textEl!.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    // Above the word, or below it near the top of the screen; kept inside the text column (the box is at most
    // 320px wide, and never wider than the column).
    const below = r.top < 170;
    const half = Math.min(160, box.width / 2);
    shown = { word, readings, x: Math.min(Math.max(r.left + r.width / 2 - box.left, half), box.width - half), y: below ? r.bottom - box.top + 6 : r.top - box.top - 6, below };
  }
  function hide() {
    shown = null;
  }
  async function move(e: KeyboardEvent, i: number) {
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? wordCount - 1 : null;
    if (e.key === 'Escape') return hide();
    if (to === null || to < 0 || to >= wordCount) return;
    e.preventDefault();
    active = to;
    await tick();
    buttons[to]?.focus();
  }
  const FLAG: Record<string, string> = {
    o: 'Old-fashioned: Wiktionary has it only as archaic, obsolete or dated.',
    s: 'With the old polite -с (short for сударь, "sir"), added to show respect.',
    h: 'Our explanation: this word isn’t in our dictionaries.',
  };

  // ---- questions
  let answers = $state<(number | undefined)[]>([]);
  let checked = $state(false);
  const right = $derived(unit ? unit.questions.filter((q, i) => answers[i] === q.answer).length : 0);
  const lang = $derived(settings.readingLang);
</script>

<!-- A click or tap shows a word (it also counts as hover and focus, so it never toggles); anywhere else hides it. -->
<svelte:window
  onkeydown={(e) => e.key === 'Escape' && hide()}
  onclick={(e) => !(e.target as Element | null)?.closest?.('.w') && hide()}
/>

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

    <!-- Hover is for a real mouse only: touch screens send imitation mouse events that differ between browsers. A tap,
         a click or keyboard focus shows a word; it closes on Escape, a tap elsewhere, or focus leaving the text. -->
    <div
      class="text"
      bind:this={textEl}
      role="group"
      aria-label="The text: each word shows its meaning"
      lang="ru"
      onfocusout={(e) => !textEl?.contains(e.relatedTarget as Node | null) && hide()}
    >
      {#each lines as l, li (li)}
        <p class:stage={l.stage === 1}>
          {#if l.speaker}<strong class="speaker">{l.speaker}.</strong>{' '}{/if}{#each l.pieces as p, pi (pi)}{#if p.word === undefined}{p.text}{:else}{@const wi = p.word}<button
                type="button"
                class="w"
                class:on={shown && active === wi}
                tabindex={active === wi ? 0 : -1}
                bind:this={buttons[wi]}
                onpointerenter={(e) => e.pointerType === 'mouse' && show(e, p.text, wi)}
                onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
                onfocus={(e) => show(e, p.text, wi)}
                onclick={(e) => show(e, p.text, wi)}
                onkeydown={(e) => move(e, wi)}
                aria-describedby={shown && active === wi ? 'word-info' : undefined}>{p.text}</button
              >{/if}{/each}
        </p>
      {/each}

      {#if shown}
        <div id="word-info" class="pop" class:below={shown.below} role="tooltip" style="left: {shown.x}px; top: {shown.y}px" lang="en">
          {#if !shown.readings.length}
            <p><strong lang="ru">{shown.word}</strong></p>
          {/if}
          {#each shown.readings as [dict, meaning, form, flags], ri (ri)}
            <div class="reading-item">
              {#if flags.includes('n')}
                <p><strong lang="ru">{dict}</strong> <span class="muted">a name</span></p>
              {:else}
                <p><strong lang="ru">{renderForm(dict, true)}</strong>{#if meaning} <span>{meaning}</span>{/if}</p>
                {#if form}<p class="form muted">{form}</p>{/if}
                {#each [...flags].filter((f) => FLAG[f]) as f (f)}<p class="flag">{FLAG[f]}</p>{/each}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if unit.questions.length}
      <section class="questions" aria-labelledby="q-title">
        <div class="q-head">
          <h2 id="q-title">Did you follow it?</h2>
          <div class="lang" role="group" aria-label="Language of the questions">
            <button type="button" class="btn small-btn" aria-pressed={lang === 'en'} onclick={() => (settings.readingLang = 'en')}>English</button>
            <button type="button" class="btn small-btn" aria-pressed={lang === 'ru'} onclick={() => (settings.readingLang = 'ru')} lang="ru">Русский</button>
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

    <nav class="pager" aria-label="Texts">
      {#if near.prev}<a href={href({ page: 'reading', text: near.prev.id })}><span class="muted small">← Previous</span> <span lang="ru">{near.prev.title}</span></a>{:else}<span></span>{/if}
      {#if near.next}<a class="next" href={href({ page: 'reading', text: near.next.id })}><span class="muted small">Next →</span> <span lang="ru">{near.next.title}</span></a>{/if}
    </nav>
  {:else}
    <p class="muted">Loading…</p>
  {/if}
</article>

<style>
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
  .text {
    position: relative;
    margin: 16px 0 8px;
    font-family: var(--serif);
    font-size: 1.2rem;
    line-height: 1.75;
  }
  .text p {
    margin: 0 0 10px;
  }
  .stage {
    font-style: italic;
    color: var(--muted);
  }
  .speaker {
    font-family: var(--sans);
    font-size: 0.95rem;
  }
  .w {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: help;
    border-radius: 3px;
  }
  .w:hover,
  .w.on {
    background: var(--mark);
  }
  .pop {
    position: absolute;
    transform: translate(-50%, -100%);
    width: max-content;
    max-width: min(320px, 100%);
    z-index: 20;
    padding: 8px 12px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
    font-family: var(--sans);
    font-size: 0.95rem;
    line-height: 1.4;
    pointer-events: none;
  }
  .pop.below {
    transform: translate(-50%, 0);
  }
  .pop p {
    margin: 0;
  }
  .reading-item + .reading-item {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
  }
  .pop strong {
    font-family: var(--serif);
    font-size: 1.05rem;
    margin-right: 4px;
  }
  .form {
    font-size: 0.88rem;
  }
  .flag {
    font-size: 0.85rem;
    color: var(--accent);
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
