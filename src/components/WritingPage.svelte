<script lang="ts">
  import { loadThemeIndex } from '../lib/data.ts';
  import { href } from '../lib/router.ts';
  import { topicById } from '../lib/topics.ts';
  import { WRITING } from '../lib/writing.ts';
  import type { ThemeIndex } from '../shared/types.ts';

  /**
   * Guided writing: prompts by level, each with a checklist to check your own text against and the grammar and
   * vocabulary it uses. What you write stays on the page: it's never stored or sent anywhere (copy it to keep it).
   * There are no model answers yet: they'd be our own Russian, and need a native speaker's review first.
   */
  let themes = $state<ThemeIndex | null>(null);
  $effect(() => {
    loadThemeIndex().then((t) => (themes = t)).catch(() => {});
  });
  let texts = $state<Record<string, string>>({});
  const count = (s: string | undefined) => (s ?? '').split(/\s+/).filter((w) => /[А-ЯЁа-яёA-Za-z]/.test(w)).length;
</script>

<section class="fade-in" aria-labelledby="writing-title">
  <h1 id="writing-title">Writing <span lang="ru" class="ru">письмо</span></h1>
  <p>
    Short writing tasks for each level. Write your text, then go through the checklist to check it yourself. Each task
    links to the grammar and vocabulary it uses, if you want to revise first.
  </p>
  <p class="muted small">
    What you write here isn't saved or sent anywhere: copy it if you want to keep it. There's no automatic marking: open
    writing has many right answers, so the checklist helps you judge your own.
  </p>
  <nav class="levels" aria-label="Go to a level">
    {#each WRITING as l (l.level)}<a class="btn level-btn" href="#write-{l.level}">{l.level}</a>{/each}
  </nav>

  {#each WRITING as l (l.level)}
    <section class="level" aria-labelledby="write-{l.level}">
      <h2 id="write-{l.level}">{l.level}</h2>
      {#each l.prompts as p (p.id)}
        <details class="card prompt">
          <summary><span class="p-title">{p.title}</span> <span class="muted small">{p.words} words</span></summary>
          <p class="task">{p.task}</p>
          <label class="write">
            <span class="visually-hidden">Your text for “{p.title}”</span>
            <textarea bind:value={texts[p.id]} rows="7" lang="ru" spellcheck="false" placeholder="Пишите здесь…"></textarea>
          </label>
          <p class="muted small">{count(texts[p.id])} words</p>
          <fieldset class="check">
            <legend>Check your text</legend>
            {#each p.checklist as c, ci (ci)}<label><input type="checkbox" /> <span>{c}</span></label>{/each}
          </fieldset>
          <p class="links small">
            Revise:
            {#each p.learn as id, k (id)}{#if k}, {/if}<a href={href({ page: 'learn', topic: id })}>{topicById(id)?.title.en ?? id}</a>{/each}{#if p.vocab.length}; vocabulary:
              {#each p.vocab as id, k (id)}{#if k}, {/if}<a href={href({ page: 'vocabulary', theme: id })}>{themes?.themes.find((t) => t.id === id)?.title ?? id}</a>{/each}{/if}
          </p>
        </details>
      {/each}
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
    font-size: 0.8em;
  }
  .small {
    font-size: 0.9rem;
  }
  .levels {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 0;
  }
  .level-btn {
    min-width: 3.5rem;
    font-weight: 700;
  }
  h2 {
    margin: 22px 0 8px;
    font-size: 1.3rem;
    scroll-margin-top: 16px;
  }
  .prompt {
    margin: 0 0 10px;
  }
  summary {
    cursor: pointer;
  }
  .p-title {
    font-weight: 700;
  }
  .task {
    margin: 8px 0;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--serif);
    font-size: 1.1rem;
    line-height: 1.5;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text);
  }
  .check {
    border: 0;
    padding: 0;
    margin: 6px 0;
  }
  .check legend {
    font-weight: 700;
    margin-bottom: 4px;
  }
  .check label {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 3px 0;
  }
</style>
