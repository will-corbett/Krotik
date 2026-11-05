/** UI settings only (never progress), remembered in localStorage when available. */
import type { Case, VerbGroup } from '../shared/cells.ts';
import type { AdjSettings, AspectSettings, CompareSettings, Mode, MotionSettings, PluralSettings, VerbSettings } from './types.ts';

export interface Settings {
  mode: Mode;
  band: 0 | 1 | 2 | 3; // top 250 / 1,000 / 2,500 / everything
  /** 0 = unlimited (play until End round). */
  count: 0 | 10 | 20 | 40;
  stress: boolean;
  keyboard: boolean;
  theme: 'system' | 'light' | 'dark';
  verbs: VerbSettings;
  reflexive: VerbSettings;
  compare: CompareSettings;
  plurals: PluralSettings;
  aspect: AspectSettings;
  adjectives: AdjSettings;
  motion: MotionSettings;
}

export const DEFAULTS: Settings = {
  mode: 'verbs',
  band: 0,
  count: 20,
  stress: true,
  keyboard: false,
  theme: 'system',
  verbs: { groups: ['presfut', 'past'] as VerbGroup[] },
  reflexive: { groups: ['presfut', 'past'] as VerbGroup[] },
  compare: { types: ['comparative', 'superlative', 'samyi'] },
  plurals: { contexts: ['nom', 'cases', 'numbers', 'quantity'], cases: ['gen', 'dat', 'inst', 'prep'] as Case[] },
  aspect: { direction: 'both' },
  adjectives: { cases: ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'] as Case[], number: 'sg' },
  motion: { types: ['meaning', 'partner', 'conjugate'] },
};

const KEY = 'drilbur.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      ...structuredClone(DEFAULTS),
      ...saved,
      verbs: { ...DEFAULTS.verbs, ...saved.verbs },
      reflexive: { ...DEFAULTS.reflexive, ...saved.reflexive },
      compare: { ...DEFAULTS.compare, ...saved.compare },
      plurals: { ...DEFAULTS.plurals, ...saved.plurals },
      aspect: { ...DEFAULTS.aspect, ...saved.aspect },
      adjectives: { ...DEFAULTS.adjectives, ...saved.adjectives },
      motion: { ...DEFAULTS.motion, ...saved.motion },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode etc.) — settings just won't persist */
  }
}
