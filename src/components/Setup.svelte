<script lang="ts">
  import { CASES, CASE_LABEL, type Case, type VerbGroup } from '../shared/cells.ts';
  import type { Settings } from '../lib/settings.ts';
  import { settingsValid } from '../lib/start.ts';
  import type { Mode, MotionSettings } from '../lib/types.ts';

  let { settings = $bindable(), loading, error, onstart }: { settings: Settings; loading: boolean; error: string; onstart: () => void } = $props();

  const MODES: { id: Mode; title: string; blurb: string }[] = [
    { id: 'verbs', title: 'Verb forms', blurb: 'Present/future, past, imperative' },
    { id: 'aspect', title: 'Aspect partners', blurb: 'Imperfective ↔ perfective' },
    { id: 'adjectives', title: 'Adjective agreement', blurb: 'Gender, number, case, animacy' },
    { id: 'motion', title: 'Motion verbs', blurb: 'идти/ходить and 11 more pairs' },
  ];
  const GROUPS: { id: VerbGroup; label: string }[] = [
    { id: 'presfut', label: 'Present / future' },
    { id: 'past', label: 'Past' },
    { id: 'imperative', label: 'Imperative' },
  ];
  const MOTION_TYPES: { id: MotionSettings['types'][number]; label: string }[] = [
    { id: 'meaning', label: 'Name the verb from its meaning' },
    { id: 'partner', label: 'Give the partner' },
    { id: 'conjugate', label: 'Conjugate' },
  ];
  const BANDS = ['Top 250', 'Top 1,000', 'Top 2,500', 'Everything'];

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  const invalid = $derived(settingsValid(settings));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!invalid && !loading) onstart();
  }
</script>

<form class="setup fade-in" onsubmit={submit}>
  <fieldset class="modes">
    <legend>Practise</legend>
    <div class="mode-grid">
      {#each MODES as m (m.id)}
        <label class="mode" class:selected={settings.mode === m.id}>
          <input type="radio" name="mode" value={m.id} bind:group={settings.mode} />
          <span class="mode-title">{m.title}</span>
          <span class="mode-blurb">{m.blurb}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="card options">
    {#if settings.mode === 'verbs'}
      <fieldset>
        <legend>Tenses</legend>
        <div class="chips">
          {#each GROUPS as g (g.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.verbs.groups.includes(g.id)} onchange={() => (settings.verbs.groups = toggle(settings.verbs.groups, g.id))} />
              {g.label}
            </label>
          {/each}
        </div>
        <p class="hint muted">An imperfective verb's forms are present tense; a perfective verb's are future.</p>
      </fieldset>
    {:else if settings.mode === 'aspect'}
      <fieldset>
        <legend>Direction</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="dir" value="to-pf" bind:group={settings.aspect.direction} /> Imperfective → perfective</label>
          <label class="chip"><input type="radio" name="dir" value="to-impf" bind:group={settings.aspect.direction} /> Perfective → imperfective</label>
          <label class="chip"><input type="radio" name="dir" value="both" bind:group={settings.aspect.direction} /> Both</label>
        </div>
        <p class="hint muted">Where a verb has several partners, any of them is accepted.</p>
      </fieldset>
    {:else if settings.mode === 'adjectives'}
      <fieldset>
        <legend>Cases</legend>
        <div class="chips">
          {#each CASES as c (c)}
            <label class="chip">
              <input type="checkbox" checked={settings.adjectives.cases.includes(c)} onchange={() => (settings.adjectives.cases = toggle<Case>(settings.adjectives.cases, c))} />
              {CASE_LABEL[c]}
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Number</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="num" value="sg" bind:group={settings.adjectives.number} /> Singular</label>
          <label class="chip"><input type="radio" name="num" value="pl" bind:group={settings.adjectives.number} /> Plural</label>
          <label class="chip"><input type="radio" name="num" value="both" bind:group={settings.adjectives.number} /> Both</label>
        </div>
        <p class="hint muted">Nouns come from the 1,000 most frequent. Accusative follows the noun's animacy.</p>
      </fieldset>
    {:else}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          {#each MOTION_TYPES as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.motion.types.includes(t.id)} onchange={() => (settings.motion.types = toggle(settings.motion.types, t.id))} />
              {t.label}
            </label>
          {/each}
        </div>
      </fieldset>
    {/if}

    {#if settings.mode !== 'motion'}
      <fieldset>
        <legend>Vocabulary (by frequency)</legend>
        <div class="chips">
          {#each BANDS as b, i (b)}
            <label class="chip"><input type="radio" name="band" value={i} bind:group={settings.band} /> {b}</label>
          {/each}
        </div>
      </fieldset>
    {/if}

    <fieldset>
      <legend>Questions</legend>
      <div class="chips">
        {#each [10, 20, 40] as n (n)}
          <label class="chip"><input type="radio" name="count" value={n} bind:group={settings.count} /> {n}</label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Display</legend>
      <div class="chips">
        <label class="chip"><input type="checkbox" bind:checked={settings.stress} /> Stress marks</label>
        <label class="chip"><input type="checkbox" bind:checked={settings.keyboard} /> On-screen Cyrillic keyboard</label>
      </div>
    </fieldset>
  </div>

  <div class="go">
    <button class="btn primary start" type="submit" disabled={!!invalid || loading}>
      {loading ? 'Loading…' : 'Start'}
    </button>
    <p class="status" role="status" aria-live="polite">
      {#if invalid}<span class="err">{invalid}</span>{:else if error}<span class="err">{error}</span>{/if}
    </p>
  </div>
</form>

<style>
  fieldset {
    border: 0;
    margin: 0 0 18px;
    padding: 0;
    min-width: 0;
  }
  fieldset:last-child {
    margin-bottom: 0;
  }
  legend {
    font-weight: 700;
    margin-bottom: 8px;
    padding: 0;
  }
  .modes legend {
    font-size: 1.4rem;
    font-family: var(--serif);
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
  .mode-blurb {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .options {
    margin-top: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    cursor: pointer;
  }
  .chip:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chip input {
    accent-color: var(--accent);
    margin: 0;
    width: 18px;
    height: 18px;
  }
  .hint {
    margin: 8px 0 0;
    font-size: 0.9rem;
  }
  .go {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 18px;
    flex-wrap: wrap;
  }
  .start {
    min-width: 160px;
    font-size: 1.1rem;
  }
  .status {
    margin: 0;
  }
  .err {
    color: var(--wrong);
  }
</style>
