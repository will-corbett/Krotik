/**
 * "Report a problem": a link to a new GitHub issue, prefilled with the page and the item (a question, a sentence, a
 * text). It only opens the form; nothing is sent unless the reader submits it there, and nothing about the reader
 * (settings, progress, answers) is included.
 */
import { ISSUES_URL, SITE_URL } from '../shared/site.ts';

const MAX = 1500;

export function reportUrl(what: string, details: string[] = [], path = typeof location === 'undefined' ? '' : location.pathname): string {
  const page = new URL(SITE_URL).origin + path;
  const body = [`Page: ${page}`, `About: ${what}`, ...details, '', "What's wrong:", ''].join('\n').slice(0, MAX);
  const title = `Problem: ${what}`.slice(0, 120);
  return `${ISSUES_URL}?${new URLSearchParams({ title, body }).toString()}`;
}
