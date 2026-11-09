/**
 * The main menu: five items on the bar, three of them groups with a dropdown (Study, Practice, Skills), so related
 * pages sit together and new ones can be added without crowding the header. Used by the app's header and the
 * prerendered pages' plain menu.
 */
import type { Route } from './router.ts';

export interface NavLink {
  label: string;
  route: Route;
  /** A few words under the link in a dropdown. */
  what?: string;
}
export interface NavGroup {
  id: string;
  label: string;
  /** The line at the top of the dropdown. */
  tag: string;
  links: NavLink[];
}
export type NavItem = NavLink | NavGroup;

export const NAV: NavItem[] = [
  { label: 'Dashboard', route: { page: 'home' } },
  {
    id: 'study',
    label: 'Study',
    tag: 'Learn new material',
    links: [
      { label: 'Learn', route: { page: 'learn' }, what: 'Grammar explained, topic by topic' },
      { label: 'Vocabulary', route: { page: 'vocabulary' }, what: 'Words by theme, with dialogues' },
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    tag: 'Test and consolidate',
    links: [
      { label: 'Grammar test', route: { page: 'test' }, what: 'Find your grammar level' },
      { label: 'Drill', route: { page: 'drill' }, what: 'Targeted practice on any topic' },
    ],
  },
  {
    id: 'skills',
    label: 'Skills',
    tag: 'Develop language skills',
    links: [
      { label: 'Reading', route: { page: 'reading' }, what: 'Stories and news, every word explained' },
      { label: 'Writing', route: { page: 'writing' }, what: 'Tasks for each level, with a checklist' },
      { label: 'Listening', route: { page: 'listening' }, what: 'Native recordings to hear and repeat' },
    ],
  },
  { label: 'Culture', route: { page: 'culture' } },
];

export const isGroup = (n: NavItem): n is NavGroup => 'links' in n;

/** Every page in the menu, in menu order. */
export const NAV_LINKS: NavLink[] = NAV.flatMap((n) => (isGroup(n) ? n.links : [n]));

/** Is this menu link the page you're on (or a page under it)? */
export const isCurrent = (link: NavLink, route: Route) => link.route.page === route.page;
