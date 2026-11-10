<script lang="ts">
  import ListeningPage from './components/ListeningPage.svelte';
  import SearchPage from './components/SearchPage.svelte';
  import Setup from './components/Setup.svelte';
  import DrillChoose from './components/DrillChoose.svelte';
  import Drill from './components/Drill.svelte';
  import EndScreen from './components/EndScreen.svelte';
  import ReadingIndex from './components/ReadingIndex.svelte';
  import ProgressPage from './components/ProgressPage.svelte';
  import StartPage from './components/StartPage.svelte';
  import ReadingText from './components/ReadingText.svelte';
  import WordsIndex from './components/WordsIndex.svelte';
  import WordsTheme from './components/WordsTheme.svelte';
  import PathsPage from './components/PathsPage.svelte';
  import SettingsPage from './components/SettingsPage.svelte';
  import WritingPage from './components/WritingPage.svelte';
  import About from './components/About.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import LearnIndex from './components/LearnIndex.svelte';
  import LearnPage from './components/LearnPage.svelte';
  import Culture from './components/Culture.svelte';
  import LevelTest from './components/LevelTest.svelte';
  import CultureNote from './components/CultureNote.svelte';
  import { loadSettings, saveSettings, type Settings } from './lib/settings.ts';
  import { nextBatch, prepareRound, UNLIMITED_BATCH, type Generate } from './lib/start.ts';
  import { createRound, type Round } from './lib/queue.ts';
  import { clearProgress, loadProgress, recordRound, saveProgress, today } from './lib/progress.ts';
  import { mulberry32 } from './lib/rng.ts';
  import { clearWords, loadWords, review as scheduleWords, saveWords } from './lib/words.ts';
  import { href, navigate, parseHash, parsePath, type Route } from './lib/router.ts';
  import { pageTitle } from './lib/pageMeta.ts';
  import { NOTES } from './lib/culture.ts';
  import { SITE_BASE } from './shared/site.ts';
  import FeedbackPage from './components/FeedbackPage.svelte';
  import ReportLink from './components/ReportLink.svelte';
  import { isDrill, topicById } from './lib/topics.ts';
  import MainNav from './components/MainNav.svelte';
  const isDrillId = (id: string) => {
    const t = topicById(id);
    return !!t && isDrill(t);
  };
  import type { Mode, Question, Word } from './lib/types.ts';

  type Screen = 'setup' | 'drill' | 'end';

  // Old hash addresses (#/learn/aspect, from links and bookmarks made before pages had real paths) move to the path.
  if (location.hash.startsWith('#/')) history.replaceState(null, '', href(parseHash(location.hash)) + location.search);
  const initialRoute = parsePath(location.pathname);
  const initialSettings = loadSettings();
  // A deep link to a drill (/drill/aspect/) selects that drill on first load.
  if (initialRoute.page === 'drill' && initialRoute.mode && isDrillId(initialRoute.mode)) initialSettings.mode = initialRoute.mode as Mode;
  // Arriving straight on the guide (a link, a search result) counts as having seen it.
  if (initialRoute.page === 'start') initialSettings.guideSeen = true;
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
  /** Pages visited inside the app this session, so Back can return to the previous one. */
  let visited = 0;
  function goBack() {
    if (visited > 0) history.back();
    else navigate(href({ page: 'drill' }));
  }

  function applyRoute(next: Route) {
    visited++;
    practice = null;
    // Arriving at a Drill address (a link, Back or Forward) always shows that page, choose or settings: a round
    // in progress is left (starting a round never changes the address, so this can't end one by accident).
    if (next.page === 'drill') screen = 'setup';
    if (next.page === 'drill' && next.mode && isDrillId(next.mode)) settings.mode = next.mode as Mode;
    route = next;
    if (next.page === 'start') settings.guideSeen = true;
    window.scrollTo({ top: 0 });
  }
  $effect(() => {
    const onPop = () => applyRoute(parsePath(location.pathname));
    // An old-style #/ link followed on an open page: move to its real address.
    const onHash = () => {
      if (location.hash.startsWith('#/')) navigate(href(parseHash(location.hash)), true);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
    };
  });
  $effect(() => {
    document.title = pageTitle(route, (id) => NOTES.find((n) => n.id === id)?.title);
  });

  /**
   * Links inside the site change page without reloading (the prerendered HTML files are for first visits and
   * search engines). New-tab clicks, other sites, downloads and in-page anchors (the skip link) are left alone.
   */
  function onLinkClick(e: MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(SITE_BASE)) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  }

  // Seed from a URL parameter (?seed=123) for reproducible rounds in tests; otherwise random.
  function seed(): number {
    const p = new URLSearchParams(location.search).get('seed');
    return p ? Number(p) : Math.floor(Math.random() * 2 ** 31);
  }

  /** Reading's key words: a "choose the meaning" round on just these words (kept for "again" until you leave). */
  let practice = $state<{ keys: [string, number][]; direction: 'recognise' | 'recall' | 'gap'; theme?: string; words?: Word[] } | null>(null);
  function practise(keys: [string, number][], direction: 'recognise' | 'recall' | 'gap' = 'recognise', theme?: string, words?: Word[]) {
    navigate(href({ page: 'drill', mode: 'vocab' }));
    practice = { keys, direction, theme, words };
    start();
  }

  async function start() {
    loading = true;
    error = '';
    shortfall = '';
    try {
      const s = $state.snapshot(settings) as Settings;
      const gen = practice
        ? await prepareRound({ ...s, mode: 'vocab', vocab: { ...s.vocab, direction: practice.direction === 'gap' ? 'recognise' : practice.direction } }, mulberry32(seed()), { keys: practice.words ? undefined : practice.keys, words: practice.words, gapTheme: practice.direction === 'gap' ? practice.theme : undefined })
        : await prepareRound(s, mulberry32(seed()));
      const unlimited = settings.count === 0 && !practice;
      const qs = unlimited ? nextBatch(gen, new Set(), [], UNLIMITED_BATCH) : gen(practice ? practice.keys.length : settings.count);
      generate = unlimited ? gen : null;
      if (!qs.length) {
        error = 'No questions match these settings. Try a larger vocabulary or more options.';
        return;
      }
      if (!unlimited && !practice && qs.length < settings.count)
        shortfall = settings.mode === 'vocab' && settings.vocab.source === 'mine' ? `${qs.length} of your words ${qs.length === 1 ? 'is' : 'are'} due.` : `Only ${qs.length} questions match these settings.`;
      round = createRound(qs);
      screen = 'drill';
      settings.hideContinue = false;
      if (!practice) settings.lastDrill = settings.mode;
      // Someone who has started a drill has found their way: the guide becomes a small link on the home page.
      settings.guideSeen = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  /** The settings page for the current drill (from the round's end screen). */
  function openSettings() {
    screen = 'setup';
    practice = null;
    const target = href({ page: 'drill', mode: settings.mode });
    if (location.pathname !== target) navigate(target);
  }

  /** Dashboard "Continue": go to the drill's page and start a round with the saved settings. */
  async function continueDrill() {
    if (settings.lastDrill) settings.mode = settings.lastDrill;
    if (route.page !== 'drill') {
      route = { page: 'drill', mode: settings.mode };
      history.pushState(null, '', href(route) + location.search);
    }
    screen = 'setup';
    await start();
  }

  function finish(r: Round<Question>) {
    round = r;
    screen = 'end';
    // Opt-in only: kept in this browser, never sent anywhere (src/lib/progress.ts).
    if (settings.progress) {
      saveProgress(recordRound(loadProgress(), r, today()));
      // Vocabulary: each word answered goes into your words, scheduled by whether it was right first time.
      const words = r.entries.filter((e) => e.attempts > 0 && e.q.word).map((e) => ({ key: e.q.word!.key, band: e.q.word!.band, right: e.firstTryCorrect === true }));
      if (words.length) saveWords(scheduleWords(loadWords(), words, today()));
    }
  }

  function setProgress(on: boolean) {
    settings.progress = on;
    if (!on) {
      clearProgress();
      clearWords();
    }
  }
  /** Your due words: the Vocabulary drill's settings, set to "My words that are due". */
  function reviewWords() {
    settings.vocab.source = 'mine';
    navigate(href({ page: 'drill', mode: 'vocab' }));
  }
  /** Start setting up a mixed review of these topics. */
  function review(topics: Mode[]) {
    settings.mixed.topics = topics;
    navigate(href({ page: 'drill', mode: 'mixed' }));
  }

  function onWindowKey(e: KeyboardEvent) {
    // "/" opens the search from anywhere, unless you're typing.
    const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && route.page !== 'search') {
      e.preventDefault();
      navigate(href({ page: 'search' }));
      return;
    }
  }

  const narrow = $derived(
    route.page === 'drill' || route.page === 'test' || route.page === 'progress' || route.page === 'settings' || route.page === 'writing' || route.page === 'feedback' || route.page === 'about' || route.page === 'start' || (route.page === 'reading' && !!route.text) || (route.page === 'culture' && !!route.note),
  );
</script>

<svelte:window onkeydown={onWindowKey} />
<svelte:document onclick={onLinkClick} />

<div class="shell">
  <header class="top">
    <a class="brand" href={href({ page: 'home' })} aria-label="Krotik, dashboard">
      <img src="{import.meta.env.BASE_URL}brand/krotik-128.png" alt="" width="40" height="40" />
      <span>Krotik</span>
    </a>
    <a class="btn quiet search-btn" href={href({ page: 'search' })} aria-label="Search the site" title="Search the site (press /)" aria-current={route.page === 'search' ? 'page' : undefined}
      ><svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" /><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></a
    >
    <MainNav
      {route}
      onchoose={(l) => {
        // Already on the Drill page (mid-round or results): the address doesn't change, so go back to setup here.
        if (l.route.page === 'drill' && route.page === 'drill') screen = 'setup';
      }}
    />
  </header>

  {#if !settings.betaNoteHidden && route.page !== 'feedback'}
    <aside class="beta" aria-label="Beta">
      <p><strong>Krotik is new and still being tested.</strong> Something wrong, confusing or missing? <a href={href({ page: 'feedback' })}>Tell us</a>.</p>
      <button type="button" class="beta-close" aria-label="Hide this note" onclick={() => (settings.betaNoteHidden = true)}>×</button>
    </aside>
  {/if}

  <main id="main" class:narrow>
    {#if route.page === 'home'}
      <Dashboard {settings} {loading} oncontinue={continueDrill} onhide={() => (settings.hideContinue = true)} ongotit={() => (settings.guideSeen = true)} onprogress={setProgress} onreviewwords={reviewWords} onreview={review} />
    {:else if route.page === 'start'}
      <StartPage />
    {:else if route.page === 'progress'}
      <ProgressPage on={settings.progress} onprogress={setProgress} onreview={review} onreviewwords={reviewWords} />
    {:else if route.page === 'learn' && route.topic}
      <LearnPage topic={route.topic} bind:settings />
    {:else if route.page === 'learn'}
      <LearnIndex progressOn={settings.progress} />
    {:else if route.page === 'test'}
      <LevelTest bind:settings />
    {:else if route.page === 'reading' && route.text}
      <ReadingText id={route.text} bind:settings onpractise={practise} />
    {:else if route.page === 'vocabulary' && route.theme}
      <WordsTheme id={route.theme} bind:settings onpractise={practise} />
    {:else if route.page === 'vocabulary'}
      <WordsIndex />
    {:else if route.page === 'paths'}
      <PathsPage bind:settings />
    {:else if route.page === 'writing'}
      <WritingPage />
    {:else if route.page === 'settings'}
      <SettingsPage bind:settings onprogress={setProgress} />
    {:else if route.page === 'reading'}
      <ReadingIndex />
    {:else if route.page === 'culture' && route.note}
      <CultureNote id={route.note} bind:settings />
    {:else if route.page === 'culture'}
      <Culture />
    {:else if route.page === 'listening'}
      <ListeningPage />
    {:else if route.page === 'feedback'}
      <FeedbackPage />
    {:else if route.page === 'search'}
      <SearchPage {settings} />
    {:else if route.page === 'about'}
      <About onback={() => navigate(href({ page: 'home' }))} />
    {:else if screen === 'drill' && round}
      <Drill {round} bind:settings notice={shortfall} more={generate} onfinish={finish} />
    {:else if screen === 'end' && round}
      <EndScreen {round} stress={settings.stress} unlimited={settings.count === 0 && !practice} onagain={start} onsettings={openSettings} />
    {:else if route.page === 'drill' && !route.mode}
      <DrillChoose bind:settings onnext={(m) => navigate(href({ page: 'drill', mode: m }))} />
    {:else}
      <Setup bind:settings {loading} {error} onstart={start} onback={goBack} />
    {/if}
  </main>

  <footer class="foot">
    <a class="btn quiet" href={href({ page: 'start' })}>Start here</a>
    <a class="btn quiet" href={href({ page: 'settings' })}>Settings</a>
    <a class="btn quiet" href={href({ page: 'about' })}>About &amp; sources</a>
    <a class="btn quiet" href={href({ page: 'feedback' })}>Feedback</a>
    <span class="foot-report"><ReportLink what="this page" path={href(route)} /></span>
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
    max-width: 1000px;
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
  /* The search button sits after the menu (bar or dropdown), at the end of the logo's line. */
  .search-btn {
    order: 3;
    min-width: 40px;
    min-height: 40px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
  }
  .search-btn[aria-current='page'] {
    background: var(--primary-bg);
    color: var(--primary-fg, var(--text));
  }
  main {
    flex: 1;
  }
  .beta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: -6px 0 16px;
    padding: 6px 6px 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 0.9rem;
  }
  .beta p {
    margin: 0;
    flex: 1;
  }
  .beta-close {
    flex: none;
    min-width: 36px;
    min-height: 36px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
  }
  .beta-close:hover {
    background: var(--surface);
    color: var(--text);
  }
  .foot-report {
    padding: 0 8px;
  }
  /* Drills, the test, progress and pages of running text keep a compact width; lists and tables use the full frame. */
  main.narrow {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
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
  .credit {
    flex-basis: 100%;
    margin: 4px 0 0;
    font-size: 0.85rem;
  }
</style>
