/** UI settings only (never progress), remembered in localStorage when available. */
import type { Case, VerbGroup } from '../shared/cells.ts';
import type { GovernmentSettings, PrefixedMotionSettings } from './types.ts';
import type { NegationSettings, NounCaseSettings, ParticleTopicSettings, PossessiveSettings, PronounSettings, StressSettings } from './types.ts';
import type { AdjSettings, AdverbSettings, AspectSettings, CompareSettings, DiminutiveSettings, Mode, MotionSettings, NumberSettings, ParticipleSettings, PluralSettings, VerbSettings } from './types.ts';

export interface Settings {
  mode: Mode;
  band: 0 | 1 | 2 | 3; // top 250 / 1,000 / 2,500 / everything
  /** 0 = unlimited (play until End round). */
  count: 0 | 10 | 20 | 40;
  stress: boolean;
  keyboard: boolean;
  /** Phonetic typing: Latin letters become Cyrillic as you type. */
  translit: boolean;
  theme: 'system' | 'light' | 'dark';
  verbs: VerbSettings;
  reflexive: VerbSettings;
  compare: CompareSettings;
  plurals: PluralSettings;
  adverbs: AdverbSettings;
  participles: ParticipleSettings;
  numbers: NumberSettings;
  diminutives: DiminutiveSettings;
  negation: NegationSettings;
  pronouns: PronounSettings;
  possessives: PossessiveSettings;
  nounCases: NounCaseSettings;
  stressDrill: StressSettings;
  government: GovernmentSettings;
  prefixedMotion: PrefixedMotionSettings;
  particles: ParticleTopicSettings;
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
  translit: false,
  theme: 'system',
  verbs: { groups: ['presfut', 'past'] as VerbGroup[] },
  reflexive: { groups: ['presfut', 'past'] as VerbGroup[] },
  compare: { types: ['comparative', 'superlative', 'samyi'] },
  plurals: { contexts: ['nom', 'cases', 'numbers', 'quantity'], cases: ['gen', 'dat', 'inst', 'prep'] as Case[] },
  adverbs: { aspects: ['impf', 'pf'] },
  participles: { kinds: ['act_pres', 'act_past', 'pass_pres', 'pass_past'], types: ['form', 'short', 'decline'] },
  numbers: { types: ['alone', 'withNoun'], ranges: ['1-4', '5-20', 'tens'], cases: ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'] as Case[] },
  diminutives: { directions: ['to', 'from'] },
  negation: { kinds: ['net', 'nipron', 'ne-ni'] },
  pronouns: { cases: ['gen', 'dat', 'acc', 'inst', 'prep'] as Case[], prepositions: ['plain', 'afterPrep'] },
  possessives: { types: ['agree', 'svoy'] },
  nounCases: { cases: ['gen', 'dat', 'acc', 'inst', 'prep'] as Case[], number: 'sg' },
  stressDrill: { sources: ['verbs', 'nouns', 'adjectives'], forms: 'any' },
  government: { types: ['choice', 'sentence'] },
  prefixedMotion: { types: ['meaning', 'pair', 'conjugate'] },
  particles: { groups: ['li', 'zhe-ved', 'ne-ni', 'colloquial'] },
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
      adverbs: { ...DEFAULTS.adverbs, ...saved.adverbs },
      participles: { ...DEFAULTS.participles, ...saved.participles },
      numbers: { ...DEFAULTS.numbers, ...saved.numbers },
      diminutives: { ...DEFAULTS.diminutives, ...saved.diminutives },
      negation: { ...DEFAULTS.negation, ...saved.negation },
      pronouns: { ...DEFAULTS.pronouns, ...saved.pronouns },
      possessives: { ...DEFAULTS.possessives, ...saved.possessives },
      nounCases: { ...DEFAULTS.nounCases, ...saved.nounCases },
      stressDrill: { ...DEFAULTS.stressDrill, ...saved.stressDrill },
      government: { ...DEFAULTS.government, ...saved.government },
      prefixedMotion: { ...DEFAULTS.prefixedMotion, ...saved.prefixedMotion },
      particles: { ...DEFAULTS.particles, ...saved.particles },
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
