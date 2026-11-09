/**
 * "Report a problem": prefilled with the page and the item (a question, a sentence, a text), either as an email
 * (mailto: it opens the reader's own email app) or as a new GitHub issue. Each only opens a form; nothing is sent
 * unless the reader sends it, and nothing about the reader (settings, progress, answers) is included.
 */
import { CONTACT_EMAIL, ISSUES_URL, SITE_URL } from '../shared/site.ts';

const MAX = 1500;
const here = () => (typeof location === 'undefined' ? '' : location.pathname);

function report(what: string, details: string[], path: string) {
  const page = new URL(SITE_URL).origin + path;
  return { title: `Problem: ${what}`.slice(0, 120), body: [`Page: ${page}`, `About: ${what}`, ...details, '', "What's wrong:", ''].join('\n').slice(0, MAX) };
}

/** A new GitHub issue, prefilled. */
export function reportUrl(what: string, details: string[] = [], path = here()): string {
  const { title, body } = report(what, details, path);
  return `${ISSUES_URL}?${new URLSearchParams({ title, body }).toString()}`;
}

/** An email to CONTACT_EMAIL (spaces as %20, not +, which some email apps show as it is). */
export function mailto(subject: string, body: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The same report as an email. */
export function reportMail(what: string, details: string[] = [], path = here()): string {
  const { title, body } = report(what, details, path);
  return mailto(`Krotik: ${title}`, body);
}

/** The Feedback page's email: a few prompts, all optional. */
export const FEEDBACK_BODY = [
  'Your level (if you know it):',
  'Phone or computer:',
  '',
  'Something wrong (a form, a translation, an explanation)?',
  '',
  'Something confusing, or where you got stuck?',
  '',
  'What you used, what you liked, what is missing?',
  '',
].join('\n');
