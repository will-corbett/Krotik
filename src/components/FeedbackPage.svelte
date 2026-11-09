<script lang="ts">
  /**
   * Feedback: Krotik is in beta, and what testers notice is the most useful thing. An email link (the reader's own
   * email app, with a few optional prompts) for anyone, and GitHub for those who use it. Nothing is sent from the site.
   */
  import { FEEDBACK_BODY, mailto } from '../lib/report.ts';
  import { CONTACT_EMAIL, ISSUES_URL } from '../shared/site.ts';
  import { href } from '../lib/router.ts';
</script>

<section class="fade-in" aria-labelledby="feedback-title">
  <h1 id="feedback-title">Feedback <span lang="ru" class="ru">отзывы</span></h1>
  <p>
    Krotik is new and still being tested. Every Russian form comes from a dictionary source and the tests check a great
    deal, but only learners can say where it's confusing, too hard, too easy, or missing something. Whatever you notice
    helps, however small.
  </p>

  <h2>What helps most</h2>
  <ul>
    <li><strong>Anything wrong:</strong> a form, a translation, a stress mark, an explanation that doesn't make sense.</li>
    <li><strong>Anything confusing:</strong> where you got stuck, didn't know what to do next, or gave up.</li>
    <li><strong>What you used and what's missing:</strong> what you came back to, and what you looked for and didn't find.</li>
    <li>If you like: your level, and whether you used a phone or a computer.</li>
  </ul>

  <p class="send">
    <a class="btn primary" href={mailto('Krotik feedback', FEEDBACK_BODY)}>Email your feedback</a>
    <span class="muted small">to <span class="addr">{CONTACT_EMAIL}</span></span>
  </p>
  <p class="muted small">
    A mistake in one question, sentence or text? Use <strong>Report a problem</strong> beside it: the email then says
    which one. If you use GitHub, you can also <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer external">open an issue there<span class="visually-hidden"> (opens in a new tab)</span></a>.
  </p>

  <h2>Privacy</h2>
  <p class="muted small">
    Nothing is sent from this site: the button only opens your own email app, and you choose what to write. Your email
    address is used only to reply to you. Krotik has no accounts and no server that keeps anything about you, as the <a href={href({ page: 'about' })}>About</a> page
    explains.
  </p>
</section>

<style>
  h1 {
    font-family: var(--serif);
    margin: 0 0 8px;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
    font-weight: 400;
  }
  h2 {
    font-family: var(--serif);
    font-size: 1.25rem;
    margin: 24px 0 8px;
  }
  li {
    margin-bottom: 6px;
  }
  .send {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin: 20px 0 8px;
  }
  .send .btn {
    text-decoration: none;
  }
  .addr {
    overflow-wrap: anywhere;
  }
  .small {
    font-size: 0.88rem;
  }
</style>
