<script lang="ts">
  import { displayForms, renderForm } from '../shared/forms.ts';
  import { missed, score, type Round } from '../lib/queue.ts';
  import { scoreBand } from '../lib/scoreBand.ts';
  import { breakdown } from '../lib/breakdown.ts';
  import { LEARN_TOPICS } from '../lib/learn.ts';
  import { href } from '../lib/router.ts';
  import type { Question } from '../lib/types.ts';
  import TermText from './TermText.svelte';

  let { round, stress, unlimited = false, onagain, onsettings }: { round: Round<Question>; stress: boolean; unlimited?: boolean; onagain: () => void; onsettings: () => void } = $props();

  const s = $derived(score(round));
  const misses = $derived(missed(round));
  const rows = $derived(breakdown(round));
  const pct = (a: number, b: number) => Math.round((100 * a) / b);
  const r = (f: string) => renderForm(f, stress);
  let heading = $state<HTMLHeadingElement>();
  $effect(() => heading?.focus());
</script>

<section class="end fade-in" aria-labelledby="end-title">
  <div class="card">
    <h1 id="end-title" tabindex="-1" bind:this={heading}>{unlimited || (round.ended && s.attempted < s.total) ? 'Round ended' : 'Round complete'}</h1>
    <p class="score">
      <span class="big score-{scoreBand(s.percent)}">{s.percent}%</span>
      <span>right first time: {s.firstTry} of {s.attempted}{!unlimited && s.attempted < s.total ? ` attempted (${s.total} in the round)` : ''}</span>
    </p>
    <div class="actions">
      <button class="btn primary" onclick={onagain}>New round</button>
      <button class="btn" onclick={onsettings}>Change settings</button>
      <a class="btn" href={href({ page: 'home' })}>Return to dashboard</a>
    </div>
  </div>

  {#if rows.length > 1}
    <div class="card breakdown">
      <h2>{rows[0]!.topic ? 'By topic' : 'By question type'}</h2>
      <table>
        <thead><tr><th scope="col">{rows[0]!.topic ? 'Topic' : 'Type'}</th><th scope="col" class="num">Right first time</th>{#if rows[0]!.topic}<th scope="col"><span class="visually-hidden">Links</span></th>{/if}</tr></thead>
        <tbody>
          {#each rows as b (b.key)}
            <tr>
              <th scope="row">{b.label.en}{#if b.label.ru} <span class="ru muted" lang="ru">{b.label.ru}</span>{/if}</th>
              <td class="num"><span class="score-{scoreBand(pct(b.right, b.attempted))}">{b.right} of {b.attempted}</span></td>
              {#if b.topic}
                <td class="links">
                  {#if LEARN_TOPICS.has(b.topic)}<a href={href({ page: 'learn', topic: b.topic })} aria-label="Learn: {b.label.en}">Learn</a>{/if}
                  <a href={href({ page: 'drill', mode: b.topic })} aria-label="Drill: {b.label.en}">Drill</a>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if misses.length}
    <div class="card missed">
      <h2>Missed at least once</h2>
      <ul>
        {#each misses as e, i (i)}
          <li>
            <div class="what">
              <span class="hw" lang={e.q.headwordIsEnglish ? 'en' : 'ru'}>{e.q.headwordIsEnglish ? e.q.headword : r(e.q.headword)}</span>
              <TermText parts={e.q.task} variant="chips" />
            </div>
            {#if e.q.selfMark}
              <div class="ans" lang="ru">{e.q.answer}</div>
            {:else if e.q.source && e.q.frame}
              <div class="ans" lang="ru">{e.q.frame.replace(/___( \([^)]*\))?/, displayForms(e.q.answer).map(r).join(' / '))}</div>
            {:else}
              <div class="ans" lang="ru">{e.q.display ? displayForms(e.q.display).map((f) => renderForm(f, true)).join(', ') : displayForms(e.q.answer).map(r).join(', ')}</div>
            {/if}
            <div class="you muted">{e.q.selfMark ? 'You wrote' : 'You typed'}: <span lang="ru">{e.wrong.join(' · ')}</span></div>
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
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px 6px 0;
    border-top: 1px solid var(--border);
    font-weight: 400;
  }
  thead th {
    border-top: 0;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .num {
    text-align: right;
    white-space: nowrap;
  }
  .links {
    text-align: right;
    white-space: nowrap;
  }
  .links a + a {
    margin-left: 10px;
  }
  .ru {
    font-family: var(--serif);
  }
</style>
