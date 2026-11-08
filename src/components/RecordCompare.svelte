<script lang="ts">
  /**
   * Record yourself and compare with the native recording. The recording stays in this tab's memory only: it is never
   * stored, uploaded or analysed (no speech recognition), and it's discarded when you move on.
   */
  import { onDestroy } from 'svelte';
  import { play } from '../lib/recordings.ts';

  let { originalUrl, onplayoriginal }: { originalUrl?: string; onplayoriginal?: () => void } = $props();

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  let status = $state<'idle' | 'recording' | 'done' | 'denied'>('idle');
  let mine = $state<string | null>(null);
  let recorder: MediaRecorder | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const MAX_MS = 10_000;

  async function record() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (mine) URL.revokeObjectURL(mine);
        mine = URL.createObjectURL(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
        status = 'done';
      };
      recorder.start();
      status = 'recording';
      timer = setTimeout(stop, MAX_MS);
    } catch {
      status = 'denied';
    }
  }
  function stop() {
    clearTimeout(timer);
    if (recorder?.state === 'recording') recorder.stop();
  }
  onDestroy(() => {
    stop();
    if (mine) URL.revokeObjectURL(mine);
  });
</script>

{#if supported}
  <div class="rc" role="group" aria-label="Say it yourself and compare">
    <span class="lead">Your turn:</span>
    {#if status === 'recording'}
      <button type="button" class="btn rec on" onclick={stop}><span aria-hidden="true">■</span> Stop</button>
      <span class="muted small" role="status">Recording… (up to 10 seconds)</span>
    {:else}
      <button type="button" class="btn rec" onclick={record}><span aria-hidden="true">●</span> {status === 'done' ? 'Record again' : 'Record yourself'}</button>
    {/if}
    {#if mine && status !== 'recording'}
      <button type="button" class="btn" onclick={() => play(mine!)}>Play mine</button>
      {#if originalUrl || onplayoriginal}<button type="button" class="btn" onclick={() => (onplayoriginal ? onplayoriginal() : play(originalUrl!))}>Play the original</button>{/if}
    {/if}
    {#if status === 'denied'}<span class="muted small">The microphone isn't available (or permission was refused).</span>{/if}
    <p class="muted small note">Your recording stays on this device, in this page only: it's never saved or sent anywhere.</p>
  </div>
{/if}

<style>
  .rc {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
  }
  .lead {
    font-weight: 600;
  }
  .rec.on {
    border-color: var(--wrong);
    color: var(--wrong);
  }
  .small {
    font-size: 0.85rem;
  }
  .note {
    flex-basis: 100%;
    margin: 0;
  }
</style>
