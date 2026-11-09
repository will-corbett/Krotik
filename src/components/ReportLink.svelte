<script lang="ts">
  import { reportMail, reportUrl } from '../lib/report.ts';

  /**
   * A small "Report a problem" control: it opens to two links, an email (the reader's own email app) or a GitHub
   * issue, both prefilled with the page and the item. `what` names the item; `details` are extra lines (the sentence,
   * the expected answer). Nothing is sent unless the reader sends it.
   */
  let { what, details = [], label = 'Report a problem', path }: { what: string; details?: string[]; label?: string; path?: string } = $props();
</script>

<details class="report">
  <summary>{label}</summary>
  <span class="ways">
    <a href={reportMail(what, details, path)}>By email</a>
    ·
    <a href={reportUrl(what, details, path)} target="_blank" rel="noopener noreferrer external">On GitHub<span class="visually-hidden"> (opens in a new tab)</span></a>
  </span>
</details>

<style>
  .report {
    display: inline-block;
    font-size: 0.8rem;
    color: var(--muted);
  }
  summary {
    display: inline;
    list-style: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  summary:hover {
    color: var(--text);
  }
  .ways {
    margin-left: 6px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .report {
    white-space: nowrap;
  }
</style>
