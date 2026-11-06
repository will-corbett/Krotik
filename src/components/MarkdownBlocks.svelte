<script lang="ts">
  /** Renders parsed Markdown blocks (Learn pages and culture notes), including data blocks. */
  import type { Block } from '../lib/learn.ts';
  import type { Settings } from '../lib/settings.ts';
  import type { Mode } from '../lib/types.ts';
  import Inline from './Inline.svelte';
  import LearnData from './LearnData.svelte';
  import MiniDrill from './MiniDrill.svelte';
  import LearnExamples from './LearnExamples.svelte';

  let { blocks, settings }: { blocks: Block[]; settings: Settings } = $props();
</script>

{#each blocks as b, i (i)}
  {#if b.type === 'heading' && b.level === 2}
    <h2><Inline parts={b.text} /></h2>
  {:else if b.type === 'heading'}
    <h3><Inline parts={b.text} /></h3>
  {:else if b.type === 'para'}
    <p><Inline parts={b.text} /></p>
  {:else if b.type === 'tip'}
    <aside class="tip"><Inline parts={b.text} /></aside>
  {:else if b.type === 'list' && b.ordered}
    <ol>
      {#each b.items as it, j (j)}<li><Inline parts={it} /></li>{/each}
    </ol>
  {:else if b.type === 'list'}
    <ul>
      {#each b.items as it, j (j)}<li><Inline parts={it} /></li>{/each}
    </ul>
  {:else if b.type === 'table'}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="md-table" tabindex="0" role="region" aria-label="Table">
      <table>
        <thead><tr>{#each b.head as h, j (j)}<th scope="col"><Inline parts={h} /></th>{/each}</tr></thead>
        <tbody>
          {#each b.rows as row, j (j)}<tr>{#each row as c, k (k)}<td><Inline parts={c} /></td>{/each}</tr>{/each}
        </tbody>
      </table>
    </div>
  {:else if b.type === 'data' && b.kind === 'drill'}
    <MiniDrill mode={b.mode as Mode} overrides={b.settings} count={b.count} {settings} />
  {:else if b.type === 'data' && b.kind === 'table'}
    <LearnData kind="table" what={b.what} word={b.word} stress={settings.stress} />
  {:else if b.type === 'data' && b.kind === 'examples'}
    <LearnExamples topic={b.topic} item={b.item} count={b.count} />
  {:else if b.type === 'data' && b.kind === 'sentence'}
    <LearnData kind="sentence" what={b.what} word={b.word} cell={b.cell} stress={settings.stress} />
  {/if}
{/each}

<style>
  h2 {
    font-size: 1.3rem;
    margin: 26px 0 8px;
  }
  h3 {
    font-size: 1.1rem;
    margin: 18px 0 6px;
  }
  p,
  li {
    line-height: 1.6;
  }
  .tip {
    margin: 12px 0;
    padding: 10px 14px;
    background: var(--accent-soft);
    border-radius: var(--radius);
  }
  .md-table {
    overflow-x: auto;
    margin: 10px 0 14px;
  }
  .md-table table {
    border-collapse: collapse;
    min-width: 60%;
  }
  .md-table th,
  .md-table td {
    border-bottom: 1px solid var(--border);
    padding: 6px 12px 6px 0;
    text-align: left;
    vertical-align: top;
  }
</style>
