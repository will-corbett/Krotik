<script lang="ts">
  /**
   * Listening: the four listening drills, and a "listen and read" player for the recorded sentences (hear one, then
   * show its Russian and English, and record yourself to compare). Everything heard is a native speaker's recording,
   * hosted with the site and credited; nothing you record leaves the page.
   */
  import { loadAudioIndex, loadListening } from '../lib/data.ts';
  import { href } from '../lib/router.ts';
  import type { ListeningData } from '../shared/types.ts';
  import ListenPlayer from './ListenPlayer.svelte';
  import RecordCompare from './RecordCompare.svelte';

  let data = $state<ListeningData | null>(null);
  let words = $state(0);
  let error = $state(false);
  $effect(() => {
    Promise.all([loadListening(), loadAudioIndex()])
      .then(([l, a]) => {
        data = l;
        words = Object.keys(a.words).length;
        next();
        first = at;
      })
      .catch(() => (error = true));
  });

  // Listen and read: one recorded sentence at a time, text hidden until asked for.
  let at = $state(-1);
  /** The sentence shown when the page opens doesn't play by itself; the next ones do (you asked for them). */
  let first = $state(-1);
  let shown = $state<'none' | 'ru' | 'both'>('none');
  const current = $derived(data && at >= 0 ? data.sentences[at] : undefined);
  function next() {
    if (!data?.sentences.length) return;
    let i = Math.floor(Math.random() * data.sentences.length);
    if (i === at && data.sentences.length > 1) i = (i + 1) % data.sentences.length;
    at = i;
    shown = 'none';
  }

  const DRILLS = $derived([
    { mode: 'listen', title: 'Listen and choose', ru: 'слушайте и выбирайте', what: 'Hear a sentence; choose what you heard, or what it means.', n: data?.sentences.length },
    { mode: 'dictation', title: 'Dictation', ru: 'диктант', what: 'Hear a sentence and write it down. Punctuation, capitals and ё don’t count.', n: data?.sentences.length },
    { mode: 'endings', title: 'Hear the ending', ru: 'окончания на слух', what: 'A sentence with one word missing: which form did you hear?', n: data?.endings.length },
    { mode: 'pairs', title: 'Minimal pairs', ru: 'минимальные пары', what: 'брат or брать, был or бил: which word did you hear?', n: data?.pairs.length },
  ]);
</script>

<section class="fade-in" aria-labelledby="listening-title">
  <h1 id="listening-title">Listening <span lang="ru" class="ru">аудирование</span></h1>
  <p>
    Native speakers' recordings of real sentences and words: practise hearing Russian at its real speed, then slower,
    and compare your own voice with theirs.
  </p>
  <p class="muted small">
    {#if data}{data.sentences.length.toLocaleString('en')} sentences from Tatoeba and {words.toLocaleString('en')} words from Wikimedia Commons, each credited when it plays (and on the
      <a href={href({ page: 'about' })}>About</a> page).{:else if error}The recordings didn't load. Check your connection and reload the page.{:else}Loading…{/if}
  </p>

  <h2>Drills</h2>
  <div class="cards">
    {#each DRILLS as d (d.mode)}
      <a class="card drill" href={href({ page: 'drill', mode: d.mode })}>
        <span class="d-title">{d.title} <span lang="ru" class="ru small">{d.ru}</span></span>
        <span class="muted small">{d.what}</span>
        {#if d.n !== undefined}<span class="count small">{d.n.toLocaleString('en')} items</span>{/if}
      </a>
    {/each}
  </div>

  <h2>Listen and read</h2>
  <p class="muted small">Listen first; then show the Russian, then the English. Record yourself and compare.</p>
  {#if current}
    <div class="card lr">
      {#key current[0]}<ListenPlayer where={{ rid: current[0] }} text={current[1]} reveal={shown !== 'none'} autoplay={at !== first} />{/key}
      <div class="lr-actions">
        {#if shown === 'none'}<button type="button" class="btn" onclick={() => (shown = 'ru')}>Show the Russian</button>
        {:else if shown === 'ru'}<button type="button" class="btn" onclick={() => (shown = 'both')}>Show the English</button>{/if}
        <button type="button" class="btn quiet" onclick={next}>Another sentence</button>
      </div>
      {#if shown !== 'none'}<p class="lr-ru" lang="ru">{current[1]}</p>{/if}
      {#if shown === 'both'}<p class="muted" lang="en">{current[2]}</p>{/if}
      <RecordCompare onplayoriginal={() => document.querySelector<HTMLButtonElement>('.lr .player .play')?.click()} />
    </div>
  {:else if data && !data.sentences.length}
    <p class="muted">The recordings are still being collected. Please come back in a few days.</p>
  {/if}

  <h2>Sounds and stress</h2>
  <ul class="links">
    <li><a href={href({ page: 'learn', topic: 'sounds' })}>Sounds and spelling</a>: how Russian letters are said, with IPA.</li>
    <li><a href={href({ page: 'learn', topic: 'stress' })}>Stress</a>, and the <a href={href({ page: 'drill', mode: 'stress' })}>stress drill</a>.</li>
    <li><a href={href({ page: 'vocabulary' })}>Vocabulary</a>: every theme's words can be heard, most of them recorded.</li>
  </ul>
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 0 0 8px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.25rem;
    margin: 26px 0 8px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .drill {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-decoration: none;
    color: var(--text);
  }
  .drill:hover .d-title {
    text-decoration: underline;
  }
  .d-title {
    font-weight: 700;
  }
  .count {
    color: var(--accent);
  }
  .lr-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }
  .lr-ru {
    font-family: var(--serif);
    font-size: 1.3rem;
    margin: 8px 0 2px;
  }
  .links li {
    margin-bottom: 6px;
  }
  .small {
    font-size: 0.88rem;
  }
</style>
