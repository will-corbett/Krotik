<script lang="ts">
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { TOPIC_GROUPS } from '../lib/topics.ts';
  import type { Mode } from '../lib/types.ts';

  /** Choose a drill. Once you pick one, a button appears at the bottom of the screen to go to its settings. */
  let { settings = $bindable(), onnext }: { settings: Settings; onnext: (mode: Mode) => void } = $props();
  let picked = $state(false);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onnext(settings.mode);
  }
  // Keyboard: Enter on a drill goes to its settings (a form with no submit button doesn't submit on Enter by itself).
  function onkey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onnext(settings.mode);
    }
  }
</script>

<form class="choose fade-in" class:picked onsubmit={submit}>
  <fieldset class="modes">
    <legend>Choose a drill</legend>
    {#each TOPIC_GROUPS as g (g.title.en)}
      <h2 class="group">{g.title.en} <span class="ru" lang="ru">{g.title.ru}</span></h2>
      <div class="mode-grid">
        {#each g.modes as m (m.id)}
          <label class="mode" class:selected={settings.mode === m.id}>
            <input type="radio" name="mode" value={m.id} bind:group={settings.mode} onclick={() => (picked = true)} onchange={() => (picked = true)} onkeydown={onkey} />
            <span class="mode-title">{m.title.en}</span>
            <span class="mode-ru" lang="ru">{m.title.ru}</span>
            <span class="mode-blurb">{m.blurb}</span>
          </label>
        {/each}
      </div>
    {/each}
  </fieldset>

  {#if picked}
    <a class="btn primary next" href={href({ page: 'drill', mode: settings.mode })}>
      <span aria-hidden="true">↓</span> Set up your drill
    </a>
  {/if}
</form>

<style>
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    font-weight: 700;
    margin-bottom: 8px;
    padding: 0;
  }
  /* Room below the last cards for the floating button. */
  .choose.picked {
    padding-bottom: 80px;
  }
  .modes legend {
    font-size: 1.4rem;
    font-family: var(--serif);
  }
  .group {
    font-size: 1rem;
    margin: 14px 0 8px;
  }
  .group:first-of-type {
    margin-top: 0;
  }
  .mode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .mode {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    cursor: pointer;
  }
  .mode input {
    position: absolute;
    opacity: 0;
    inset: 0;
    cursor: pointer;
  }
  .mode:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  .mode.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .mode-title {
    font-weight: 700;
  }
  .mode-ru {
    font-family: var(--serif);
    font-size: 0.95rem;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
  }
  .mode-blurb {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
  }
  .next {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    z-index: 15;
    padding: 0.7em 1.6em;
    font-size: 1.05rem;
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: no-preference) {
    .next {
      animation: rise 0.2s ease-out;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translate(-50%, 12px);
      }
    }
  }
</style>
