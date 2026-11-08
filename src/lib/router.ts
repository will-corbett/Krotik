/**
 * Page addresses: real paths under SITE_BASE, so each page can be found and prerendered.
 *   /                   Dashboard
 *   /start/             Start here (the beginner's guide)
 *   /test/              Grammar test
 *   /learn/             Learn index        /learn/<topic>/   a Learn page
 *   /drill/             Choose a drill     /drill/<topic>/   that drill's settings
 *   /reading/           Reading index      /reading/<text>/  one story or scene
 *   /progress/          Your progress (opt-in, this browser only)
 *   /culture/           Culture links      /culture/<note>/  a culture note
 *   /about/             About and sources
 * Old hash addresses (#/learn/aspect) are still understood (parseHash) and rewritten on load.
 */
import { SITE_BASE } from '../shared/site.ts';

export type Route =
  | { page: 'home' }
  | { page: 'test' }
  | { page: 'start' }
  | { page: 'learn'; topic?: string }
  | { page: 'drill'; mode?: string }
  | { page: 'reading'; text?: string }
  | { page: 'vocabulary'; theme?: string }
  | { page: 'progress' }
  | { page: 'paths' }
  | { page: 'settings' }
  | { page: 'culture'; note?: string }
  | { page: 'about' };

function fromParts(parts: string[]): Route {
  switch (parts[0]) {
    case 'test':
      return { page: 'test' };
    case 'start':
      return { page: 'start' };
    case 'learn':
      return parts[1] ? { page: 'learn', topic: parts[1] } : { page: 'learn' };
    case 'drill':
      return parts[1] ? { page: 'drill', mode: parts[1] } : { page: 'drill' };
    case 'reading':
      return parts[1] ? { page: 'reading', text: parts[1] } : { page: 'reading' };
    case 'vocabulary':
      return parts[1] ? { page: 'vocabulary', theme: parts[1] } : { page: 'vocabulary' };
    case 'progress':
      return { page: 'progress' };
    case 'paths':
      return { page: 'paths' };
    case 'settings':
      return { page: 'settings' };
    case 'culture':
      return parts[1] ? { page: 'culture', note: parts[1] } : { page: 'culture' };
    case 'about':
      return { page: 'about' };
    default:
      return { page: 'home' };
  }
}
const split = (s: string) => s.split('/').filter(Boolean).map(decodeURIComponent);

/** A page path ("/Krotik/learn/aspect/") as a route; anything outside the site is the Dashboard. */
export function parsePath(pathname: string): Route {
  return pathname.startsWith(SITE_BASE) ? fromParts(split(pathname.slice(SITE_BASE.length))) : { page: 'home' };
}
/** An old hash address ("#/learn/aspect"). */
export function parseHash(hash: string): Route {
  return fromParts(split(hash.replace(/^#\/?/, '')));
}

/** The path of a route below the site base: "", "learn/", "learn/aspect/". */
export function pathOf(route: Route): string {
  switch (route.page) {
    case 'home':
      return '';
    case 'test':
      return 'test/';
    case 'start':
      return 'start/';
    case 'learn':
      return route.topic ? `learn/${route.topic}/` : 'learn/';
    case 'drill':
      return route.mode ? `drill/${route.mode}/` : 'drill/';
    case 'reading':
      return route.text ? `reading/${route.text}/` : 'reading/';
    case 'vocabulary':
      return route.theme ? `vocabulary/${route.theme}/` : 'vocabulary/';
    case 'progress':
      return 'progress/';
    case 'paths':
      return 'paths/';
    case 'settings':
      return 'settings/';
    case 'culture':
      return route.note ? `culture/${route.note}/` : 'culture/';
    case 'about':
      return 'about/';
  }
}
export const href = (route: Route): string => SITE_BASE + pathOf(route);

/**
 * Go to a page inside the app without reloading. The query (e.g. ?seed=) is kept unless the target sets its own,
 * as it was with hash links. App listens for popstate, which this fires too.
 */
export function navigate(target: string, replace = false): void {
  const url = new URL(target, location.href);
  const next = url.pathname + (url.search || location.search) + url.hash;
  if (replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
  dispatchEvent(new PopStateEvent('popstate'));
}
