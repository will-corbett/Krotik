<script lang="ts">
  /** "Recording: Inego (CC BY 4.0, Tatoeba)", with links to the person and the licence, as the licences ask. */
  import { sourceName, type Credit } from '../lib/recordings.ts';
  let { credit }: { credit: Credit } = $props();
</script>

<span class="credit muted"
  >Recording: <a href={credit.url} target="_blank" rel="noopener">{credit.name}</a> ({#if credit.licenceUrl}<a href={credit.licenceUrl} target="_blank" rel="noopener">{credit.licence}</a
    >{:else}{credit.licence}{/if}, {sourceName(credit)})</span
>

<style>
  .credit {
    font-size: 0.8rem;
  }
</style>
