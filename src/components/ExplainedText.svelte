<script lang="ts">
  import { REGISTER } from '../lib/register.ts';
  import { tick } from 'svelte';
  import { renderForm } from '../shared/forms.ts';
  import { normalise } from '../shared/normalise.ts';
  import type { ReadingLine, WordReading } from '../shared/types.ts';

  /**
   * Russian text where every word is a button: hovering (mouse), tapping, clicking or focusing it shows what it is
   * (dictionary form, meaning, which form). Arrow keys move between words, so the text is one Tab stop. Used by Reading
   * and by the Vocabulary section's dialogues. `translations`, when given and `showTranslation` is on, puts each line's
   * English under it.
   */
  let {
    lines: source,
    words,
    label,
    uid,
    progress,
    mine,
    onadd,
    translations,
    showTranslation = false,
  }: {
    lines: ReadingLine[];
    words: Record<string, WordReading[]>;
    label: string;
    /** unique on the page (the word box's id) */
    uid: string;
    /** with progress on, a pinned word's box offers Add to my words */
    progress: boolean;
    /** keys already in your words */
    mine: Set<string>;
    onadd: (items: [string, number][]) => void;
    translations?: string[];
    showTranslation?: boolean;
  } = $props();

  type Piece = { text: string; word?: number };
  const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;
  /** Each line as text pieces, words numbered in reading order. */
  const lines = $derived.by(() => {
    let n = 0;
    return source.map(([speaker, text, stage]) => {
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
  type Shown = { word: string; readings: WordReading[]; x: number; y: number; below: boolean };
  let shown = $state<Shown | null>(null);
  /** While the box is being taken off the page its bindings can run once more after `shown` is null ("reading 'below'"). */
  const NONE: Shown = { word: '', readings: [], x: 0, y: 0, below: false };
  let textEl = $state<HTMLElement>();
  let buttons: HTMLButtonElement[] = [];
  /**
   * A word clicked, tapped or focused is pinned: its box stays while the mouse moves (over other words too) and takes
   * clicks, so Add can be pressed. Hovering only shows a box that ignores the mouse, so the words under it still work.
   */
  let pinned = $state(false);
  const boxId = $derived(`word-info-${uid}`);

  function show(e: Event, word: string, i: number, pin = true) {
    pinned = pin;
    active = i;
    const readings = words[normalise(word)] ?? [];
    const btn = e.currentTarget as HTMLElement;
    const box = textEl!.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    // Above the word, or below it when there's no room above: near the top of the screen, or near the top of the
    // text (above it are the page's own controls, such as Reading's key words, which the box mustn't cover). Kept
    // inside the text column (the box is at most 320px wide, and never wider than the column).
    const below = r.top < 170 || r.top - box.top < 170;
    const half = Math.min(160, box.width / 2);
    shown = { word, readings, x: Math.min(Math.max(r.left + r.width / 2 - box.left, half), box.width - half), y: below ? r.bottom - box.top + 6 : r.top - box.top - 6, below };
  }
  /** Add a word; the button becomes "In your words ✓", so focus goes back to the word (the box stays open). */
  async function add(keys: Parameters<typeof onadd>[0]) {
    onadd(keys);
    await tick();
    buttons[active]?.focus();
  }
  function hide() {
    shown = null;
    pinned = false;
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
    // Register labels (colloquial, bookish …), by their letters.
    ...Object.fromEntries(Object.values(REGISTER).map((r) => [r.letter, `${r.en[0]!.toUpperCase()}${r.en.slice(1)} (${r.ru}): ${r.note}.`])),
  };
  const keyed = (r: WordReading): r is [string, string, string, string, string, number] => r.length === 6;
</script>

<!-- A click or tap shows a word (it also counts as hover and focus, so it never toggles); anywhere else hides it. -->
<svelte:window
  onkeydown={(e) => e.key === 'Escape' && hide()}
  onclick={(e) => {
    // Only a click on one of this text's words, or its box, keeps the box (another text on the page has its own).
    // The path is where the click happened: the button pressed may be gone by now (Add becomes "In your words ✓").
    const path = e.composedPath();
    const inside = textEl !== undefined && path.includes(textEl) && path.some((n) => n instanceof Element && n.matches('.w, .pop'));
    if (!inside) hide();
  }}
/>

<!-- Hover is for a real mouse only: touch screens send imitation mouse events that differ between browsers. A tap,
     a click or keyboard focus shows a word; it closes on Escape, a tap elsewhere, or focus leaving the text. -->
<div
  class="text"
  bind:this={textEl}
  role="group"
  aria-label={label}
  lang="ru"
  onfocusout={(e) => (e.target as Node).isConnected && !textEl?.contains(e.relatedTarget as Node | null) && hide()}
>
  {#each lines as l, li (li)}
    <p class:stage={l.stage === 1}>
      {#if l.speaker}<strong class="speaker">{l.speaker}.</strong>{' '}{/if}{#each l.pieces as p, pi (pi)}{#if p.word === undefined}{p.text}{:else}{@const wi = p.word}<button
            type="button"
            class="w"
            class:on={shown && active === wi}
            tabindex={active === wi ? 0 : -1}
            bind:this={buttons[wi]}
            onpointerenter={(e) => e.pointerType === 'mouse' && !pinned && show(e, p.text, wi, false)}
            onpointerleave={(e) => e.pointerType === 'mouse' && !pinned && hide()}
            onfocus={(e) => show(e, p.text, wi)}
            onclick={(e) => show(e, p.text, wi)}
            onkeydown={(e) => move(e, wi)}
            aria-describedby={shown && active === wi ? boxId : undefined}>{p.text}</button
          >{/if}{/each}
      {#if showTranslation && translations?.[li]}<span class="tr" lang="en">{translations[li]}</span>{/if}
    </p>
  {/each}

  {#if shown}
    {@const box = shown ?? NONE}
    {@const addable = progress && pinned ? box.readings.filter(keyed).filter((r) => !r[3].includes('n')) : []}
    <div class="pop" class:below={box.below} class:pinned style="left: {box.x}px; top: {box.y}px" lang="en">
      <div id={boxId} role="tooltip">
        {#if !box.readings.length}
          <p><strong lang="ru">{box.word}</strong></p>
        {/if}
        {#each box.readings as [dict, meaning, form, flags], ri (ri)}
          <div class="reading-item">
            {#if flags.includes('n')}
              <p><strong lang="ru">{dict}</strong> <span class="muted">a name</span>{#if meaning}: <span>{meaning}</span>{/if}</p>
            {:else}
              <p><strong lang="ru">{renderForm(dict, true)}</strong>{#if meaning} <span>{meaning}</span>{/if}</p>
              {#if form}<p class="form muted">{form}</p>{/if}
              {#each [...flags].filter((f) => FLAG[f]) as f (f)}<p class="flag">{FLAG[f]}</p>{/each}
            {/if}
          </div>
        {/each}
      </div>
      {#each addable as r (r[4])}
        {#if mine.has(r[4])}
          <p class="added muted">In your words ✓</p>
        {:else}
          <button type="button" class="btn small-btn add" onclick={() => add([[r[4], r[5]]])}>Add {addable.length > 1 ? renderForm(r[0].split(',')[0]!, true) : ''} to my words</button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
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
  .tr {
    display: block;
    font-family: var(--sans);
    font-size: 0.92rem;
    line-height: 1.4;
    color: var(--muted);
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
  .pop.pinned {
    pointer-events: auto;
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
  .pop .add {
    margin-top: 6px;
  }
  .pop .added {
    margin: 6px 0 0;
    font-size: 0.9rem;
  }
</style>
