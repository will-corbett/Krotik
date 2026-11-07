import { describe, expect, it } from 'vitest';
import { href, parseHash, parsePath, pathOf, type Route } from '../../src/lib/router.ts';
import { SITE_BASE } from '../../src/shared/site.ts';

const routes: Route[] = [
  { page: 'home' },
  { page: 'test' },
  { page: 'learn' },
  { page: 'learn', topic: 'aspect' },
  { page: 'drill' },
  { page: 'drill', mode: 'verbs' },
  { page: 'culture' },
  { page: 'culture', note: 'names' },
  { page: 'about' },
];

describe('page addresses', () => {
  it('every route has a real path under the site base, and reads back the same', () => {
    for (const r of routes) {
      expect(href(r).startsWith(SITE_BASE)).toBe(true);
      expect(parsePath(href(r))).toEqual(r);
    }
    expect(href({ page: 'learn', topic: 'aspect' })).toBe(`${SITE_BASE}learn/aspect/`);
    expect(pathOf({ page: 'home' })).toBe('');
  });
  it('a path without the trailing slash means the same page', () => {
    expect(parsePath(`${SITE_BASE}learn/aspect`)).toEqual({ page: 'learn', topic: 'aspect' });
  });
  it('old hash addresses map to the same pages', () => {
    for (const r of routes) expect(parseHash(`#/${pathOf(r).replace(/\/$/, '')}`)).toEqual(r);
    expect(parseHash('#/')).toEqual({ page: 'home' });
  });
  it('anything else is the Dashboard', () => {
    expect(parsePath('/elsewhere/learn/aspect/')).toEqual({ page: 'home' });
    expect(parsePath(`${SITE_BASE}no-such-page/`)).toEqual({ page: 'home' });
  });
});
