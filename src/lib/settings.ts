/** UI settings, remembered in localStorage when available. The opt-in progress record is separate (progress.ts). */
import type { Case, VerbGroup } from '../shared/cells.ts';
import type { AlphabetSettings, ChtobySettings, TenseSettings, GovernmentSettings, NarechiyaSettings, OrdinalSettings, PrefixedMotionSettings, QuestionWordSettings, SpecialCaseSettings } from './types.ts';
import type { NegationSettings, NounCaseSettings, ParticleTopicSettings, PossessiveSettings, PronounSettings, StressSettings } from './types.ts';
import type { BuildSettings, FixSettings, MixedSettings, TranslateSettings, VocabSettings } from './types.ts';
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
  /** krotik = the logo's colours (default); system follows the device's light/dark setting. */
  theme: 'krotik' | 'system' | 'light' | 'dark';
  /** The Dashboard's "Continue drilling" card was dismissed; it comes back when the next round starts. */
  hideContinue: boolean;
  /**
   * The beginner's guide is shown big ("New to Krotik?" card) until you've found your way: opened the guide, started a
   * drill round, or pressed "Got it". After that it's a small link under the title (and always in the footer); it never
   * disappears, so a misclick can't lose it.
   */
  guideSeen: boolean;
  /**
   * Keep a record of your rounds in this browser (src/lib/progress.ts). Off by default; turning it off deletes the record.
   * The setting itself is a UI setting; the record is stored under its own key and never leaves the browser.
   */
  progress: boolean;
  mixed: MixedSettings;
  translate: TranslateSettings;
  build: BuildSettings;
  fix: FixSettings;
  vocab: VocabSettings;
  /**
   * Reading: the language of the comprehension questions; Russian unless you choose English. (Stored under a new name:
   * the old `readingLang` was saved as 'en' for everyone, before Russian became the default.)
   */
  questionLang: 'en' | 'ru';
  /**
   * Your level: the learning path you follow (A1 unless you say you're further on, in Settings or on the Paths page),
   * so the home page can suggest your next step.
   */
  pathLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
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
  narechiya: NarechiyaSettings;
  questionWords: QuestionWordSettings;
  ordinals: OrdinalSettings;
  specialCases: SpecialCaseSettings;
  alphabet: AlphabetSettings;
  aspectContext: TenseSettings;
  position: TenseSettings;
  chtoby: ChtobySettings;
}

export const DEFAULTS: Settings = {
  mode: 'verbs',
  band: 0,
  count: 20,
  stress: true,
  keyboard: false,
  translit: false,
  theme: 'krotik',
  hideContinue: false,
  guideSeen: false,
  progress: false,
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
  prefixedMotion: { types: ['meaning', 'pair', 'conjugate'], groups: ['presfut', 'past'] as VerbGroup[] },
  particles: { groups: ['li', 'zhe-ved', 'ne-ni', 'colloquial'] },
  aspect: { direction: 'both' },
  adjectives: { cases: ['nom', 'gen', 'dat', 'acc', 'inst', 'prep'] as Case[], number: 'sg' },
  motion: { types: ['meaning', 'partner', 'conjugate'], groups: ['presfut', 'past'] as VerbGroup[] },
  narechiya: { types: ['form', 'comparative', 'sentence'] },
  questionWords: { types: ['table', 'sentence'] },
  ordinals: { types: ['agree', 'dates', 'centuries'] },
  specialCases: { types: ['form', 'sentence'] },
  alphabet: { types: ['letters', 'read', 'write'] },
  aspectContext: { tenses: ['presfut', 'past', 'imperative', 'inf'] },
  position: { tenses: ['presfut', 'past', 'imperative', 'inf'] },
  chtoby: { kinds: ['inf', 'past'] },
  mixed: { topics: ['verbs', 'nounCases', 'adjectives', 'pronouns', 'prepositions'] },
  translate: { lengths: ['short'], direction: 'en-ru' },
  build: { lengths: ['short'] },
  fix: { levels: ['A1', 'A2'] },
  vocab: { direction: 'both', types: ['n', 'v', 'a', 'o'], source: 'common' },
  questionLang: 'ru',
  pathLevel: 'A1',
};

const KEY = 'krotik.settings.v1';
/** Earlier names of the key: read once, then removed, so saved settings survive the rename. */
const OLD_KEYS = ['rgd.settings.v1'];

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY) ?? OLD_KEYS.map((k) => localStorage.getItem(k)).find((v) => v !== null) ?? null;
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw) as Partial<Settings>;
    // Retired settings, so they aren't carried along and saved again. Hiding the guide card (hideStart) now means
    // the small link instead.
    const old = saved as Record<string, unknown>;
    if (old.hideStart === true) saved.guideSeen = true;
    delete old.hideStart;
    delete old.readingLang;
    // "No path chosen" is gone: everyone starts on A1.
    if (!['A1', 'A2', 'B1', 'B2', 'C1'].includes(old.pathLevel as string)) delete old.pathLevel;
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
      narechiya: { ...DEFAULTS.narechiya, ...saved.narechiya },
      questionWords: { ...DEFAULTS.questionWords, ...saved.questionWords },
      ordinals: { ...DEFAULTS.ordinals, ...saved.ordinals },
      specialCases: { ...DEFAULTS.specialCases, ...saved.specialCases },
      alphabet: { ...DEFAULTS.alphabet, ...saved.alphabet },
      aspectContext: { ...DEFAULTS.aspectContext, ...saved.aspectContext },
      position: { ...DEFAULTS.position, ...saved.position },
      chtoby: { ...DEFAULTS.chtoby, ...saved.chtoby },
      mixed: { ...DEFAULTS.mixed, ...saved.mixed },
      translate: { ...DEFAULTS.translate, ...saved.translate },
      build: { ...DEFAULTS.build, ...saved.build },
      fix: { ...DEFAULTS.fix, ...saved.fix },
      vocab: { ...DEFAULTS.vocab, ...saved.vocab },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    for (const k of OLD_KEYS) localStorage.removeItem(k);
  } catch {
    /* storage unavailable (private mode etc.) — settings just won't persist */
  }
}
