<script lang="ts">
  import { LEARN_TOPICS } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import { TOPIC_GROUPS } from '../lib/topics.ts';
</script>

<section class="fade-in" aria-labelledby="learn-title">
  <h1 id="learn-title">Learn <span lang="ru" class="ru">учить</span></h1>
  <p class="muted">Short explanations with real examples, each ending with a quick check. Then drill the topic as much as you like.</p>
  {#each TOPIC_GROUPS as g (g.title.en)}
    <h2>{g.title.en} <span lang="ru" class="ru">{g.title.ru}</span></h2>
    <ul>
      {#each g.modes as t (t.id)}
        <li>
          {#if LEARN_TOPICS.has(t.id)}
            <a href={href({ page: 'learn', topic: t.id })}>{t.title.en}</a> <span lang="ru" class="ru">{t.title.ru}</span>
          {:else}
            <span class="soon">{t.title.en}</span> <span lang="ru" class="ru">{t.title.ru}</span>
            <span class="tag">coming soon</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 0 0 6px;
  }
  h2 {
    font-size: 1.1rem;
    margin: 22px 0 6px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  ul {
    margin: 0;
    padding-left: 1.1em;
  }
  li {
    margin: 6px 0;
  }
  li a {
    font-weight: 700;
  }
  .soon {
    color: var(--muted);
  }
  .tag {
    font-size: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 8px;
    color: var(--muted);
    margin-left: 4px;
  }
</style>
