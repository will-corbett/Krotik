/** Page titles, shared by the app (document.title as you move around) and the prerendered HTML. */
import type { Route } from './router.ts';
import { topicById } from './topics.ts';

export function pageTitle(route: Route, noteTitle: (id: string) => string | undefined = () => undefined, textTitle: (id: string) => string | undefined = () => undefined): string {
  const t = (id?: string) => (id ? topicById(id) : undefined);
  switch (route.page) {
    case 'home':
      return 'Krotik: learn and practise Russian';
    case 'test':
      return 'Grammar test: find your Russian grammar level | Krotik';
    case 'start':
      return 'Start here: how to learn Russian with Krotik';
    case 'learn': {
      const topic = t(route.topic);
      return topic ? `${topic.title.en} (${topic.title.ru}): Russian grammar explained | Krotik` : 'Learn Russian grammar | Krotik';
    }
    case 'drill': {
      const topic = t(route.mode);
      return topic ? `Drill: ${topic.title.en} | Krotik` : 'Drill Russian grammar | Krotik';
    }
    case 'reading': {
      const text = route.text ? textTitle(route.text) : undefined;
      return text ? `${text}: read with every word explained | Krotik` : 'Read real Russian texts, every word explained | Krotik';
    }
    case 'vocabulary': {
      const theme = route.theme ? textTitle(route.theme) : undefined;
      return theme ? `${theme}: Russian vocabulary with examples and practice | Krotik` : 'Learn Russian vocabulary by theme | Krotik';
    }
    case 'culture': {
      const note = route.note ? noteTitle(route.note) : undefined;
      return note ? `${note} | Krotik` : 'Russian culture links for learners | Krotik';
    }
    case 'writing':
      return 'Writing in Russian: guided tasks, A1 to C1 | Krotik';
    case 'settings':
      return 'Settings | Krotik';
    case 'paths':
      return 'Learning paths: what to study, A1 to C1 | Krotik';
    case 'progress':
      return 'Your progress | Krotik';
    case 'about':
      return 'About Krotik: sources and licences';
    case 'search':
      return 'Search | Krotik';
    case 'listening':
      return 'Russian listening practice with native recordings | Krotik';
    case 'feedback':
      return 'Feedback | Krotik';
  }
}
