<script lang="ts">
  import { LEARN_TOPICS } from '../lib/learn.ts';
  import { DUE_DAYS, WEAK_MIN, loadProgress, summarise, today } from '../lib/progress.ts';
  import { href } from '../lib/router.ts';
  import { topicById } from '../lib/topics.ts';
  import type { Mode } from '../lib/types.ts';

  /** The Progress page (/progress/): an offer to turn it on, or (when on) weak topics, revision and history. */
  let { on, onprogress, onreview }: { on: boolean; onprogress: (on: boolean) => void; onreview: (topics: Mode[]) => void } = $props();
  const s = $derived(on ? summarise(loadProgress(), today()) : null);
  const name = (m: Mode) => topicById(m)?.title.en ?? m;
  let confirmOff = $state(false);
</script>

<h1 class="page-title">Your progress</h1>
{#if !on}
  <div class="card offer">
    <p class="small">
      Krotik can keep a record of your drill results <strong>in this browser only</strong>, to show your weak topics and
      what's due for revision. It's never sent anywhere, and turning it off deletes it.
    </p>
    <button class="btn" onclick={() => onprogress(true)}>Keep track in this browser</button>
  </div>
{:else if s}
  <section class="card progress" aria-label="Your results">
    {#if !s.all.length}
      <p class="muted small">Finish a drill round and your results will appear here. (Learn-page checks and the Grammar test aren't recorded.)</p>
    {:else}
      {#if s.weak.length}
        <h2>Weak topics</h2>
        <p class="muted small">Under 80% right first time over your recent rounds.</p>
        <ul>
          {#each s.weak as w (w.mode)}
            <li>
              <span>{name(w.mode)} <span class="muted">{w.percent}%</span></span>
              <span class="links">
                {#if LEARN_TOPICS.has(w.mode)}<a href={href({ page: 'learn', topic: w.mode })} aria-label="Learn: {name(w.mode)}">Learn</a>{/if}
                <a href={href({ page: 'drill', mode: w.mode })} aria-label="Drill: {name(w.mode)}">Drill</a>
              </span>
            </li>
          {/each}
        </ul>
        {#if s.weak.length >= 2}
          <button class="btn primary" onclick={() => onreview(s.weak.slice(0, 6).map((w) => w.mode))}>Review weak topics together</button>
        {/if}
      {:else}
        <p class="small">No weak topics. A topic shows here once you've answered at least {WEAK_MIN} of its questions in recent rounds and got under 80% right first time.</p>
      {/if}
      {#if s.due.length}
        <h2>Due for revision</h2>
        <p class="muted small">Not practised for {DUE_DAYS} days or more.</p>
        <ul>
          {#each s.due.slice(0, 5) as d (d.mode)}
            <li>
              <span>{name(d.mode)} <span class="muted">{d.days} days ago</span></span>
              <span class="links"><a href={href({ page: 'drill', mode: d.mode })} aria-label="Drill: {name(d.mode)}">Drill</a></span>
            </li>
          {/each}
        </ul>
      {/if}
      <details open>
        <summary>Everything you've practised</summary>
        <table>
          <thead><tr><th scope="col">Topic</th><th scope="col" class="num">Rounds</th><th scope="col" class="num">Right first time</th><th scope="col" class="num">Last</th></tr></thead>
          <tbody>
            {#each s.all as a (a.mode)}
              <tr><th scope="row">{name(a.mode)}</th><td class="num">{a.rounds}</td><td class="num">{a.percent}%</td><td class="num">{a.last}</td></tr>
            {/each}
          </tbody>
        </table>
      </details>
    {/if}
    <p class="muted small foot">
      Kept in this browser only.
      {#if confirmOff}
        Delete your progress and stop keeping track?
        <button class="btn small-btn" onclick={() => onprogress(false)}>Turn off and delete</button>
        <button class="btn quiet small-btn" onclick={() => (confirmOff = false)}>Cancel</button>
      {:else}
        <button class="btn quiet small-btn" onclick={() => (confirmOff = true)}>Turn off…</button>
      {/if}
    </p>
  </section>
{/if}

<style>
  .page-title {
    font-family: var(--serif);
    margin: 0 0 12px;
  }
  .small {
    margin: 4px 0 10px;
    font-size: 0.95rem;
  }
  h2 {
    margin: 12px 0 0;
    font-size: 1rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 10px;
  }
  li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .links a + a {
    margin-left: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
  }
  th,
  td {
    text-align: left;
    padding: 4px 8px 4px 0;
    border-top: 1px solid var(--border);
    font-weight: 400;
  }
  thead th {
    border-top: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .num {
    text-align: right;
  }
  details {
    margin-top: 6px;
  }
  .foot {
    margin: 12px 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
  }
</style>
