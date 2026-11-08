<script lang="ts">
  import { reportUrl } from '../lib/report.ts';

  /**
   * A small "Report a problem" link: opens a prefilled GitHub issue in a new tab. `what` names the item; `details`
   * are extra lines (the sentence, the expected answer). Nothing is sent unless the reader submits the form there.
   */
  let { what, details = [], label = 'Report a problem' }: { what: string; details?: string[]; label?: string } = $props();
</script>

<a class="report" href={reportUrl(what, details)} target="_blank" rel="noopener noreferrer external"
  >{label}<span class="visually-hidden"> (opens GitHub in a new tab)</span></a
>

<style>
  .report {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .report:hover {
    color: var(--text);
  }
</style>
