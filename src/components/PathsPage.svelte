<script lang="ts">
  import { loadReadingIndex, loadThemeIndex } from '../lib/data.ts';
  import { stepDone, stepKind, type PathLevel, type PathStep } from '../lib/paths.ts';
  import { PATHS } from '../lib/pathsData.ts';
  import { loadProgress } from '../lib/progress.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import { isDrill, topicById } from '../lib/topics.ts';
  import { loadWords } from '../lib/words.ts';
  import type { ReadingIndex, ThemeIndex } from '../shared/types.ts';

  /**
   * Learning paths: for each level, a recommended order through grammar, vocabulary, reading and review, with why.
   * You can follow one (the home page then suggests your next step). With progress on, steps Krotik can track are
   * ticked. A guide, not a gate: everything stays open.
   */
  let { settings = $bindable() }: { settings: Settings } = $props();
  let themes = $state<ThemeIndex | null>(null);
  let reading = $state<ReadingIndex | null>(null);
  $effect(() => {
    loadThemeIndex().then((t) => (themes = t)).catch(() => {});
    loadReadingIndex().then((r) => (reading = r)).catch(() => {});
  });
  const progress = settings.progress ? loadProgress() : null;
  const words = settings.progress ? loadWords() : null;
  const themeKeys = (id: string) => themes?.themes.find((t) => t.id === id)?.keys;
  const done = (s: PathStep) => !!progress && !!words && stepDone(s, progress, words, themeKeys);

  const KIND = { learn: 'Grammar', vocab: 'Vocabulary', read: 'Reading', drill: 'Review', test: 'Test' } as const;
  function step(s: PathStep): { title: string; ru?: string; links: { label: string; href: string }[] } {
    const { kind, id } = stepKind(s);
    if (kind === 'learn') {
      const t = topicById(id)!;
      const links = [{ label: 'Learn', href: href({ page: 'learn', topic: id }) }];
      if (isDrill(t)) links.push({ label: 'Drill', href: href({ page: 'drill', mode: id }) });
      return { title: t.title.en, ru: t.title.ru, links };
    }
    if (kind === 'vocab') {
      const t = themes?.themes.find((x) => x.id === id);
      return { title: t?.title ?? id, ru: t?.ru, links: [{ label: 'Open', href: href({ page: 'vocabulary', theme: id }) }] };
    }
    if (kind === 'read') {
      const u = reading?.units.find((x) => x.id === id);
      const w = u && reading ? reading.works[u.w] : undefined;
      const title = u ? (w?.kind === 'play' ? `${w.title}: ${u.title.replace(/^Явление/, 'явление')}` : u.title) : id;
      return { title, links: [{ label: 'Read', href: href({ page: 'reading', text: id }) }] };
    }
    if (kind === 'drill') {
      const t = topicById(id)!;
      return { title: t.title.en, ru: t.title.ru, links: [{ label: 'Drill', href: href({ page: 'drill', mode: id }) }] };
    }
    return { title: 'Grammar test', ru: 'тест по грамматике', links: [{ label: 'Take it', href: href({ page: 'test' }) }] };
  }
  const follow = (l: PathLevel) => (settings.pathLevel = settings.pathLevel === l ? '' : l);
</script>

<section class="fade-in" aria-labelledby="paths-title">
  <h1 id="paths-title">Learning paths <span lang="ru" class="ru">маршруты</span></h1>
  <p>
    Not sure what to study next? Each path is a route through Krotik for one level: grammar topics, vocabulary themes,
    reading and review, in an order that builds up. It's a guide, not a gate: everything stays open, and you can skip
    what you know.
  </p>
  <p class="muted small">
    Not sure of your level? The <a href={href({ page: 'test' })}>Grammar test</a> gives a rough guide.
    {#if settings.progress}Steps you've done are ticked (grammar you've drilled, themes mostly in your words; reading isn't recorded).{:else}Turn on <a href={href({ page: 'progress' })}>progress</a> to see the steps you've done ticked off.{/if}
  </p>

  <nav class="levels" aria-label="Go to a level">
    {#each PATHS as p (p.level)}<a class="btn level-btn" class:following={settings.pathLevel === p.level} href="#path-{p.level}">{p.level}</a>{/each}
  </nav>

  {#each PATHS as p (p.level)}
    {@const count = p.steps.filter(done).length}
    <section class="path" aria-labelledby="path-{p.level}">
      <div class="p-head">
        <h2 id="path-{p.level}">{p.level} <span class="p-title">{p.title}</span></h2>
        <button class="btn small-btn" class:primary={settings.pathLevel !== p.level} aria-pressed={settings.pathLevel === p.level} onclick={() => follow(p.level)}>
          {settings.pathLevel === p.level ? 'Following ✓' : 'Follow this path'}
        </button>
      </div>
      <p class="intro">{p.intro}</p>
      {#if settings.progress}<p class="muted small">{count} of {p.steps.length} steps done.</p>{/if}
      <ol class="steps">
        {#each p.steps as s, i (i)}
          {@const v = step(s)}
          {@const k = stepKind(s).kind}
          {@const isDone = done(s)}
          <li class:done={isDone}>
            <span class="kind {k}">{KIND[k]}</span>
            <span class="what">
              <span class="t">{v.title}{#if v.ru}{' '}<span lang="ru" class="ru">{v.ru}</span>{/if}{#if isDone}<span class="tick"> ✓<span class="visually-hidden"> done</span></span>{/if}</span>
              {#if s.why}<span class="why muted">{s.why}</span>{/if}
            </span>
            <span class="links">
              {#each v.links as l (l.label)}<a href={l.href} aria-label="{l.label}: {v.title}">{l.label}</a>{/each}
            </span>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 4px 0 8px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  h1 .ru {
    font-size: 0.8em;
  }
  .small {
    font-size: 0.9rem;
  }
  .levels {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 14px 0 0;
  }
  .level-btn {
    min-width: 3.5rem;
    font-weight: 700;
  }
  .level-btn.following {
    border-color: var(--primary-bg);
    box-shadow: inset 0 0 0 2px var(--primary-bg);
  }
  .path {
    margin-top: 26px;
  }
  .p-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 1.35rem;
    scroll-margin-top: 16px;
  }
  .p-title {
    font-weight: 400;
    color: var(--muted);
  }
  .intro {
    max-width: 46rem;
    margin: 6px 0;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    counter-reset: step;
  }
  .steps li {
    counter-increment: step;
    display: grid;
    grid-template-columns: 2rem 6.5rem minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 4px 10px;
    padding: 7px 0;
    border-top: 1px solid var(--border);
  }
  .steps li::before {
    content: counter(step);
    color: var(--muted);
    font-size: 0.85rem;
    text-align: right;
  }
  .kind {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .what {
    display: flex;
    flex-direction: column;
  }
  .t {
    font-weight: 700;
  }
  .why {
    font-size: 0.88rem;
  }
  .tick {
    color: var(--correct);
  }
  .links {
    display: flex;
    gap: 12px;
    white-space: nowrap;
  }
  .small-btn {
    min-height: 36px;
    padding: 0.25em 0.9em;
  }
  @media (max-width: 560px) {
    .steps li {
      grid-template-columns: 1.6rem minmax(0, 1fr);
    }
    .kind {
      grid-column: 2;
    }
    .what,
    .links {
      grid-column: 2;
    }
  }
</style>
