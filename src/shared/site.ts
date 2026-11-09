/**
 * Where the site lives. Pages have real addresses under SITE_BASE (/Krotik/learn/aspect/), each prerendered as its
 * own HTML file by scripts/prerender.ts; SITE_URL is the public address, for canonical links and the sitemap.
 * Moving to another host or a custom domain means changing these two lines.
 */
export const SITE_BASE = '/Krotik/';
export const SITE_URL = 'https://will-corbett.github.io/Krotik/';
/**
 * Where problems are reported: a new GitHub issue, prefilled with the page and the item (see ReportLink.svelte).
 * Nothing is sent unless the reader submits it there. Moving the repository means changing this line.
 */
export const ISSUES_URL = 'https://github.com/will-corbett/Krotik/issues/new';
/** Feedback and problem reports by email, for readers without a GitHub account (the Feedback page, Report a problem). */
export const CONTACT_EMAIL = 'krotik.feedback@gmail.com';
