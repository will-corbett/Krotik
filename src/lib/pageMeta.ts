/** Page titles, shared by the app (document.title as you move around) and the prerendered HTML. */
import type { Route } from './router.ts';
import { topicById } from './topics.ts';

export function pageTitle(route: Route, noteTitle: (id: string) => string | undefined = () => undefined): string {
  const t = (id?: string) => (id ? topicById(id) : undefined);
  switch (route.page) {
    case 'home':
      return 'Krotik: learn and drill Russian grammar';
    case 'test':
      return 'Grammar test: find your Russian grammar level | Krotik';
    case 'learn': {
      const topic = t(route.topic);
      return topic ? `${topic.title.en} (${topic.title.ru}): Russian grammar explained | Krotik` : 'Learn Russian grammar | Krotik';
    }
    case 'drill': {
      const topic = t(route.mode);
      return topic ? `Drill: ${topic.title.en} | Krotik` : 'Drill Russian grammar | Krotik';
    }
    case 'culture': {
      const note = route.note ? noteTitle(route.note) : undefined;
      return note ? `${note} | Krotik` : 'Russian culture links for learners | Krotik';
    }
    case 'about':
      return 'About Krotik: sources and licences';
  }
}
