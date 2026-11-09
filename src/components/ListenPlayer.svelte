<script lang="ts">
  /**
   * The prompt of a listening question: a native recording, played when the question appears (and on request, at
   * normal speed or slower). Once answered (`reveal`), the reader is credited.
   */
  import { play, recordingFor, stopPlaying, type Recording } from '../lib/recordings.ts';
  import CreditLine from './CreditLine.svelte';
  import { speak } from '../lib/speech.ts';

  let { where, text, reveal = false, autoplay = true }: { where: { rid?: number; key?: string }; text: string; reveal?: boolean; autoplay?: boolean } = $props();

  let rec = $state<Recording | null>(null);
  let blocked = $state(false);

  async function go(rate = 1) {
    if (!rec) {
      speak(text);
      return;
    }
    try {
      await play(rec.url, rate);
      blocked = false;
    } catch {
      // Autoplay can be refused until the page has been used: the Play button then does it.
      blocked = true;
    }
  }

  $effect(() => {
    const w = { rid: where.rid, key: where.key };
    let gone = false;
    recordingFor(w).then((r) => {
      if (gone) return;
      rec = r;
      if (autoplay) go();
      else blocked = true;
    });
    return () => {
      gone = true;
      stopPlaying();
    };
  });
</script>

<div class="player">
  <button type="button" class="btn primary play" onclick={() => go()}>
    <span aria-hidden="true">▶</span> {blocked ? 'Play' : 'Play again'}
  </button>
  <button type="button" class="btn" onclick={() => go(0.7)}>Slower</button>
  {#if reveal && rec}
    <p class="credit"><CreditLine credit={rec.credit} /></p>
  {/if}
</div>

<style>
  .player {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 10px 0 4px;
  }
  .play {
    min-width: 9em;
  }
  .credit {
    flex-basis: 100%;
    margin: 0;
  }
</style>
