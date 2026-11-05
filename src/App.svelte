<script lang="ts">
  import Setup from './components/Setup.svelte';
  import Drill from './components/Drill.svelte';
  import EndScreen from './components/EndScreen.svelte';
  import About from './components/About.svelte';
  import { loadSettings, saveSettings, type Settings } from './lib/settings.ts';
  import { nextBatch, prepareRound, UNLIMITED_BATCH, type Generate } from './lib/start.ts';
  import { createRound, type Round } from './lib/queue.ts';
  import { mulberry32 } from './lib/rng.ts';
  import type { Question } from './lib/types.ts';

  type Screen = 'setup' | 'drill' | 'end' | 'about';

  let settings = $state<Settings>(loadSettings());
  let screen = $state<Screen>('setup');
  let round = $state<Round<Question> | null>(null);
  let loading = $state(false);
  let error = $state('');
  let shortfall = $state('');
  let generate = $state<Generate | null>(null);

  $effect(() => {
    saveSettings($state.snapshot(settings) as Settings);
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  });

  // Seed from a URL parameter (?seed=123) for reproducible rounds in tests; otherwise random.
  function seed(): number {
    const p = new URLSearchParams(location.search).get('seed');
    return p ? Number(p) : Math.floor(Math.random() * 2 ** 31);
  }

  async function start() {
    loading = true;
    error = '';
    shortfall = '';
    try {
      const gen = await prepareRound($state.snapshot(settings) as Settings, mulberry32(seed()));
      const unlimited = settings.count === 0;
      const qs = unlimited ? nextBatch(gen, new Set(), [], UNLIMITED_BATCH) : gen(settings.count);
      generate = unlimited ? gen : null;
      if (!qs.length) {
        error = 'No questions match these settings. Try a larger vocabulary or more options.';
        return;
      }
      if (!unlimited && qs.length < settings.count) shortfall = `Only ${qs.length} questions match these settings.`;
      round = createRound(qs);
      screen = 'drill';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function finish(r: Round<Question>) {
    round = r;
    screen = 'end';
  }

  const THEMES = ['system', 'light', 'dark'] as const;
  function cycleTheme() {
    settings.theme = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length]!;
  }
</script>

<div class="shell">
  <header class="top">
    <button class="brand" onclick={() => (screen = 'setup')} aria-label="Drilbur, back to settings">
      <span class="mark" aria-hidden="true">Ж</span> Drilbur
    </button>
    <span class="tag">Russian drills</span>
  </header>

  <main id="main">
    {#if screen === 'setup'}
      <Setup bind:settings {loading} {error} onstart={start} />
    {:else if screen === 'drill' && round}
      <Drill {round} {settings} notice={shortfall} more={generate} onfinish={finish} />
    {:else if screen === 'end' && round}
      <EndScreen {round} stress={settings.stress} unlimited={settings.count === 0} onagain={start} onsettings={() => (screen = 'setup')} />
    {:else if screen === 'about'}
      <About onback={() => (screen = 'setup')} />
    {/if}
  </main>

  <footer class="foot">
    <button class="btn quiet" onclick={() => (screen = 'about')}>About &amp; sources</button>
    <button class="btn quiet" onclick={cycleTheme} aria-label="Theme: {settings.theme}. Change theme">
      Theme: {settings.theme}
    </button>
    <p class="credit muted">
      Data: <a href="https://en.openrussian.org" rel="noopener">OpenRussian.org</a> (CC BY-SA 4.0) ·
      <a href="https://tatoeba.org" rel="noopener">Tatoeba</a> (CC BY 2.0 FR)
    </p>
  </footer>
</div>

<style>
  .shell {
    max-width: 720px;
    margin: 0 auto;
    padding: 12px 16px 32px;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0 16px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: none;
    padding: 4px;
    font-weight: 700;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .mark {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-text);
    font-family: var(--serif);
  }
  .tag {
    color: var(--muted);
    font-size: 0.95rem;
  }
  main {
    flex: 1;
  }
  .foot {
    margin-top: 32px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .credit {
    flex-basis: 100%;
    margin: 4px 0 0;
    font-size: 0.85rem;
  }
</style>
