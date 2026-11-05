<script lang="ts">
  import { displayForms, renderForm } from '../shared/forms.ts';
  import { missed, score, type Round } from '../lib/queue.ts';
  import type { Question } from '../lib/types.ts';

  let { round, stress, onagain, onsettings }: { round: Round<Question>; stress: boolean; onagain: () => void; onsettings: () => void } = $props();

  const s = $derived(score(round));
  const misses = $derived(missed(round));
  const r = (f: string) => renderForm(f, stress);
  let heading = $state<HTMLHeadingElement>();
  $effect(() => heading?.focus());
</script>

<section class="end fade-in" aria-labelledby="end-title">
  <div class="card">
    <h1 id="end-title" tabindex="-1" bind:this={heading}>{round.ended && s.attempted < s.total ? 'Round ended' : 'Round complete'}</h1>
    <p class="score">
      <span class="big">{s.percent}%</span>
      <span>right first time: {s.firstTry} of {s.attempted}{s.attempted < s.total ? ` attempted (${s.total} in the round)` : ''}</span>
    </p>
    <div class="actions">
      <button class="btn primary" onclick={onagain}>New round</button>
      <button class="btn" onclick={onsettings}>Change settings</button>
    </div>
  </div>

  {#if misses.length}
    <div class="card missed">
      <h2>Missed at least once</h2>
      <ul>
        {#each misses as e (e.q.key)}
          <li>
            <div class="what">
              <span class="hw" lang={e.q.headwordIsEnglish ? 'en' : 'ru'}>{e.q.headwordIsEnglish ? e.q.headword : r(e.q.headword)}</span>
              <span class="muted">{e.q.task}</span>
            </div>
            <div class="ans" lang="ru">{displayForms(e.q.answer).map(r).join(', ')}</div>
            <div class="you muted">You typed: <span lang="ru">{e.wrong.join(' · ')}</span></div>
          </li>
        {/each}
      </ul>
    </div>
  {:else if s.attempted}
    <p class="muted">Nothing missed.</p>
  {/if}
</section>

<style>
  .end {
    display: grid;
    gap: 14px;
  }
  h1 {
    margin: 0 0 6px;
    font-family: var(--serif);
  }
  h1:focus {
    outline: none;
  }
  .score {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
    margin: 0 0 14px;
  }
  .big {
    font-size: 2.6rem;
    font-weight: 700;
    color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 1.15rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: baseline;
  }
  .hw {
    font-weight: 700;
  }
  .ans {
    font-size: 1.25rem;
    color: var(--correct);
  }
  .you {
    font-size: 0.95rem;
  }
</style>
