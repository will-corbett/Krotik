<script lang="ts">
  let { oninsert, onbackspace }: { oninsert: (ch: string) => void; onbackspace: () => void } = $props();
  const ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];
  // pointerdown + preventDefault keeps focus (and the caret) in the answer field.
  const keep = (e: PointerEvent) => e.preventDefault();
</script>

<div class="kb" role="group" aria-label="Cyrillic keyboard">
  {#each ROWS as row, r (row)}
    <div class="row">
      {#each [...row] as ch (ch)}
        <button type="button" class="key" lang="ru" onpointerdown={keep} onclick={() => oninsert(ch)}>{ch}</button>
      {/each}
      {#if r === 2}
        <button type="button" class="key wide" onpointerdown={keep} onclick={onbackspace} aria-label="Backspace">⌫</button>
      {/if}
    </div>
  {/each}
  <div class="row">
    <button type="button" class="key" lang="ru" onpointerdown={keep} onclick={() => oninsert('ё')}>ё</button>
    <button type="button" class="key space" onpointerdown={keep} onclick={() => oninsert(' ')} aria-label="Space">space</button>
  </div>
</div>

<style>
  .kb {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .row {
    display: flex;
    justify-content: center;
    gap: 4px;
  }
  .key {
    flex: 1 1 0;
    max-width: 48px;
    min-width: 0;
    height: 46px;
    padding: 0;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 1.15rem;
    cursor: pointer;
  }
  .key:active {
    background: var(--accent-soft);
  }
  .wide {
    max-width: 72px;
    flex-grow: 1.5;
  }
  .space {
    max-width: 200px;
    flex-grow: 4;
    font-family: var(--sans);
    font-size: 0.9rem;
    color: var(--muted);
  }
</style>
