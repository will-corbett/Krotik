<script lang="ts">
  import { PATHS } from '../lib/pathsData.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';

  /**
   * Settings (/settings/): your level (the learning path the home page follows; A1 unless you say otherwise), display,
   * reading and theme, and whether Krotik keeps track of your progress. All remembered in this browser only.
   */
  let { settings = $bindable(), onprogress }: { settings: Settings; onprogress: (on: boolean) => void } = $props();
  let confirmOff = $state(false);
</script>

<section class="settings fade-in" aria-labelledby="settings-title">
  <h1 id="settings-title">Settings <span lang="ru" class="ru">настройки</span></h1>
  <p class="muted small">Remembered in this browser only.</p>

  <fieldset>
    <legend>Your level</legend>
    <p class="hint">
      Everyone starts on A1. If you already know some Russian, choose your level: the home page will suggest steps from
      that level's <a href={href({ page: 'paths' })}>learning path</a>. Not sure? The <a href={href({ page: 'test' })}>Grammar test</a>
      gives a rough guide. Everything stays open whatever you choose.
    </p>
    <div class="levels">
      {#each PATHS as p (p.level)}
        <label class="level" class:on={settings.pathLevel === p.level}>
          <input type="radio" name="level" value={p.level} bind:group={settings.pathLevel} />
          <span class="l">{p.level}</span>
          <span class="t">{p.title}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>Display</legend>
    <div class="checks">
      <label><input type="checkbox" bind:checked={settings.stress} /> Stress marks <span class="muted">(молоко́)</span></label>
      <label><input type="checkbox" bind:checked={settings.keyboard} /> On-screen Cyrillic keyboard in drills</label>
      <label><input type="checkbox" bind:checked={settings.translit} /> Phonetic typing <span class="muted">(Latin letters become Cyrillic as you type)</span></label>
    </div>
    <label class="select">
      Theme
      <select bind:value={settings.theme}>
        <option value="krotik">Krotik</option>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  </fieldset>

  <fieldset>
    <legend>Reading</legend>
    <div class="checks">
      <label><input type="radio" name="qlang" value="ru" bind:group={settings.questionLang} /> Questions in Russian</label>
      <label><input type="radio" name="qlang" value="en" bind:group={settings.questionLang} /> Questions in English</label>
    </div>
  </fieldset>

  <fieldset>
    <legend>Your progress</legend>
    {#if settings.progress}
      <p class="hint">
        Krotik keeps a record of your drill results and your words in this browser only (never sent anywhere). See it on
        the <a href={href({ page: 'progress' })}>Progress page</a>.
      </p>
      {#if confirmOff}
        <p class="hint">Delete your progress and your words, and stop keeping track?</p>
        <div class="row">
          <button class="btn" onclick={() => ((confirmOff = false), onprogress(false))}>Turn off and delete</button>
          <button class="btn quiet" onclick={() => (confirmOff = false)}>Cancel</button>
        </div>
      {:else}
        <button class="btn quiet" onclick={() => (confirmOff = true)}>Turn off…</button>
      {/if}
    {:else}
      <p class="hint">
        Off. Turn it on to see weak topics, what's due for revision, your words and your next steps. It's kept in this
        browser only, never sent anywhere, and turning it off deletes it.
      </p>
      <button class="btn" onclick={() => onprogress(true)}>Keep track in this browser</button>
    {/if}
  </fieldset>
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 4px 0 4px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8em;
  }
  .small {
    font-size: 0.9rem;
    margin: 0 0 8px;
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 12px 16px 16px;
    margin: 14px 0 0;
  }
  legend {
    font-weight: 700;
    padding: 0 6px;
  }
  .hint {
    margin: 2px 0 10px;
    font-size: 0.95rem;
  }
  .levels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .level {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0 8px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .level.on {
    border-color: var(--primary-bg);
    box-shadow: inset 0 0 0 2px var(--primary-bg);
  }
  .level input {
    grid-row: span 2;
  }
  .l {
    font-weight: 700;
  }
  .t {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .checks {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }
  .select {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.95rem;
    max-width: 12rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
