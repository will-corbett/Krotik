/**
 * Hash routes, so every page works on any static host (GitHub Pages included):
 *   #/                 Dashboard
 *   #/test             Level test
 *   #/learn            Learn index        #/learn/<topic>   a Learn page
 *   #/drill            Drill setup        #/drill/<topic>   setup with that drill selected
 *   #/culture          Culture links      #/culture/<note>  a culture note
 *   #/about            About and sources
 */
export type Route =
  | { page: 'home' }
  | { page: 'test' }
  | { page: 'learn'; topic?: string }
  | { page: 'drill'; mode?: string }
  | { page: 'culture'; note?: string }
  | { page: 'about' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'test':
      return { page: 'test' };
    case 'learn':
      return parts[1] ? { page: 'learn', topic: parts[1] } : { page: 'learn' };
    case 'drill':
      return parts[1] ? { page: 'drill', mode: parts[1] } : { page: 'drill' };
    case 'culture':
      return parts[1] ? { page: 'culture', note: parts[1] } : { page: 'culture' };
    case 'about':
      return { page: 'about' };
    default:
      return { page: 'home' };
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case 'home':
      return '#/';
    case 'test':
      return '#/test';
    case 'learn':
      return route.topic ? `#/learn/${route.topic}` : '#/learn';
    case 'drill':
      return route.mode ? `#/drill/${route.mode}` : '#/drill';
    case 'culture':
      return route.note ? `#/culture/${route.note}` : '#/culture';
    case 'about':
      return '#/about';
  }
}
