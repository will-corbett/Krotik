<script lang="ts">
  /**
   * "Hear it": a native recording when the site has one for this word (`wordKey`) or sentence (`rid`), credited once
   * played; otherwise the device's own voice, if it has a Russian one. Shows nothing when neither is available.
   */
  import { hear, recordingFor, type Credit } from '../lib/recordings.ts';
  import CreditLine from './CreditLine.svelte';
  import { hasRussianVoice } from '../lib/speech.ts';

  let {
    text,
    wordKey,
    rid,
    label = 'Hear it',
    compact = false,
  }: { text: string; wordKey?: string; rid?: number; label?: string; compact?: boolean } = $props();

  let recorded = $state(false);
  let voice = $state(false);
  let credit = $state<Credit | null>(null);
  hasRussianVoice().then((ok) => (voice = ok));
  $effect(() => {
    const where = { key: wordKey, rid };
    credit = null;
    recordingFor(where).then((r) => (recorded = !!r));
  });

  async function go() {
    credit = await hear(text, { key: wordKey, rid });
  }
</script>

{#if recorded || voice}
  <span class="hear" class:compact>
    <button type="button" class={compact ? 'btn quiet icon' : 'btn'} onclick={go} aria-label={compact ? `${label}: ${text}` : undefined} title={recorded ? 'A native speaker’s recording' : 'Your device’s voice'}>
      <span aria-hidden="true">🔊</span>{#if !compact}&nbsp;{label}{/if}
    </button>
    {#if credit}
      <span class="credit"><CreditLine {credit} /></span>
    {/if}
  </span>
{/if}

<style>
  .hear {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .compact .credit {
    display: none;
  }
  .icon {
    min-height: 32px;
    padding: 0 8px;
  }
</style>
