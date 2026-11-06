<script lang="ts">
  import Setup from './components/Setup.svelte';
  import Drill from './components/Drill.svelte';
  import EndScreen from './components/EndScreen.svelte';
  import About from './components/About.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import LearnIndex from './components/LearnIndex.svelte';
  import LearnPage from './components/LearnPage.svelte';
  import Culture from './components/Culture.svelte';
  import CultureNote from './components/CultureNote.svelte';
  import { loadSettings, saveSettings, type Settings } from './lib/settings.ts';
  import { nextBatch, prepareRound, UNLIMITED_BATCH, type Generate } from './lib/start.ts';
  import { createRound, type Round } from './lib/queue.ts';
  import { mulberry32 } from './lib/rng.ts';
  import { href, parseRoute, type Route } from './lib/router.ts';
  import { topicById } from './lib/topics.ts';
  import type { Mode, Question } from './lib/types.ts';

  type Screen = 'setup' | 'drill' | 'end';

  const initialRoute = parseRoute(location.hash);
  const initialSettings = loadSettings();
  // A deep link to a drill (#/drill/aspect) selects that drill on first load.
  if (initialRoute.page === 'drill' && initialRoute.mode && topicById(initialRoute.mode)) initialSettings.mode = initialRoute.mode as Mode;
  let settings = $state<Settings>(initialSettings);
  let route = $state<Route>(initialRoute);
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

  /** Follow the address bar (links, back/forward). Entering the Drill page shows its setup screen. */
  function applyRoute(next: Route) {
    if (next.page === 'drill' && route.page !== 'drill') screen = 'setup';
    if (next.page === 'drill' && next.mode) {
      if (topicById(next.mode)) settings.mode = next.mode as Mode;
      screen = 'setup';
    }
    route = next;
    window.scrollTo({ top: 0 });
  }
  $effect(() => {
    const onHash = () => applyRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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

  /** Dashboard "Continue": go to the Drill page and start a round with the saved settings. */
  async function continueDrill() {
    if (route.page !== 'drill') {
      route = { page: 'drill' };
      history.pushState(null, '', href(route));
    }
    screen = 'setup';
    await start();
  }

  function finish(r: Round<Question>) {
    round = r;
    screen = 'end';
  }

  const NAV: { label: string; route: Route }[] = [
    { label: 'Dashboard', route: { page: 'home' } },
    { label: 'Learn', route: { page: 'learn' } },
    { label: 'Drill', route: { page: 'drill' } },
    { label: 'Culture', route: { page: 'culture' } },
  ];
</script>

<div class="shell">
  <header class="top">
    <a class="brand" href="#/" aria-label="Krotik, dashboard">
      <img src="./brand/krotik-128.png" alt="" width="40" height="40" />
      <span>Krotik</span>
    </a>
    <nav aria-label="Main">
      {#each NAV as n (n.label)}
        <a
          class="nav-link"
          href={href(n.route)}
          aria-current={route.page === n.route.page ? 'page' : undefined}
          onclick={() => {
            // Already on the Drill page (mid-round or results): the address doesn't change, so go back to setup here.
            if (n.route.page === 'drill' && route.page === 'drill') screen = 'setup';
          }}>{n.label}</a
        >
      {/each}
    </nav>
  </header>

  <main id="main">
    {#if route.page === 'home'}
      <Dashboard {settings} {loading} oncontinue={continueDrill} />
    {:else if route.page === 'learn' && route.topic}
      <LearnPage topic={route.topic} {settings} />
    {:else if route.page === 'learn'}
      <LearnIndex />
    {:else if route.page === 'culture' && route.note}
      <CultureNote id={route.note} {settings} />
    {:else if route.page === 'culture'}
      <Culture />
    {:else if route.page === 'about'}
      <About onback={() => (location.hash = '#/')} />
    {:else if screen === 'drill' && round}
      <Drill {round} bind:settings notice={shortfall} more={generate} onfinish={finish} />
    {:else if screen === 'end' && round}
      <EndScreen {round} stress={settings.stress} unlimited={settings.count === 0} onagain={start} onsettings={() => (screen = 'setup')} />
    {:else}
      <Setup bind:settings {loading} {error} onstart={start} />
    {/if}
  </main>

  <footer class="foot">
    <a class="btn quiet" href="#/about">About &amp; sources</a>
    <label class="theme">
      Theme
      <select bind:value={settings.theme}>
        <option value="krotik">Krotik</option>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    <p class="credit muted">
      Data: <a href="https://en.openrussian.org" rel="noopener">OpenRussian.org</a> (CC BY-SA 4.0) ·
      <a href="https://en.wiktionary.org" rel="noopener">Wiktionary</a> via kaikki.org (CC BY-SA 4.0) ·
      <a href="https://tatoeba.org" rel="noopener">Tatoeba</a> (CC BY 2.0 FR)
    </p>
  </footer>
</div>

<style>
  .shell {
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 16px 32px;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 4px 0 16px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 1.2rem;
    color: var(--text);
    text-decoration: none;
  }
  .brand img {
    border-radius: 10px;
  }
  nav {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  .nav-link {
    padding: 8px 12px;
    border-radius: 999px;
    color: var(--text);
    text-decoration: none;
    font-weight: 700;
  }
  .nav-link:hover {
    background: var(--surface-2);
  }
  .nav-link[aria-current='page'] {
    background: var(--primary-bg);
    color: var(--primary-text);
  }
  main {
    flex: 1;
  }
  .foot {
    margin-top: 32px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .foot .btn {
    text-decoration: none;
  }
  .theme {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  .theme select {
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
  }
  .credit {
    flex-basis: 100%;
    margin: 4px 0 0;
    font-size: 0.85rem;
  }
</style>
