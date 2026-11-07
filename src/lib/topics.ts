/**
 * Every topic, in its group: the single list behind the Dashboard, the Learn index and the Drill setup.
 * Within each group, topics run from the most basic and most needed to the more advanced or less essential.
 * A topic's id is its drill mode; its Learn page (if written yet) is content/learn/<id>.md.
 */
import { TERMS, type Term } from './terms.ts';
import type { Mode } from './types.ts';

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export interface Topic {
  id: Mode;
  title: Term;
  blurb: string;
  /**
   * When learners usually first meet the topic, and the level by which the core of it is expected. Our judgement
   * (CEFR-style): a topic keeps developing after that (aspect takes years), so it's a guide, not a gate.
   */
  level: [Cefr, Cefr];
  /** closely connected topics, shown at the end of the Learn page */
  related: Mode[];
}
export interface TopicGroup {
  title: Term;
  modes: Topic[];
}

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    title: TERMS.gettingStarted,
    modes: [{ id: 'alphabet', title: TERMS.alphabet, blurb: 'Letters and sounds; read and type Cyrillic', level: ['A1', 'A1'], related: ['stress'] }],
  },
  {
    title: TERMS.verbs,
    modes: [
      { id: 'verbs', title: TERMS.verbForms, blurb: 'Present/future, past, imperative', level: ['A1', 'A2'], related: ['aspect', 'reflexive', 'conditional'] },
      { id: 'aspect', title: TERMS.aspectPartners, blurb: 'Imperfective ↔ perfective', level: ['A2', 'B1'], related: ['aspectContext', 'verbs', 'prefixedMotion'] },
      { id: 'motion', title: TERMS.motionVerbs, blurb: 'идти/ходить and 11 more pairs', level: ['A2', 'B1'], related: ['prefixedMotion', 'prepositions', 'position'] },
      { id: 'reflexive', title: TERMS.reflexive, blurb: '-ся after consonants, -сь after vowels', level: ['A1', 'A2'], related: ['verbs', 'government'] },
      { id: 'aspectContext', title: TERMS.aspectContext, blurb: 'видел or увидел? in real sentences', level: ['A2', 'B2'], related: ['aspect', 'verbs'] },
      { id: 'position', title: TERMS.position, blurb: 'стоять / ставить / встать', level: ['A2', 'B1'], related: ['motion', 'prepositions'] },
      { id: 'government', title: TERMS.government, blurb: 'помогать кому, бояться чего, думать о ком', level: ['A2', 'B1'], related: ['nounCases', 'prepositions', 'pronouns'] },
      { id: 'prefixedMotion', title: TERMS.prefixedMotion, blurb: 'прийти / приходить, выйти, перейти', level: ['B1', 'B2'], related: ['motion', 'aspect'] },
      { id: 'adverbs', title: TERMS.adverbs, blurb: 'читая, прочитав', level: ['B1', 'B2'], related: ['participles', 'aspect'] },
      { id: 'participles', title: TERMS.participles, blurb: 'читающий, прочитанный, прочитана', level: ['B1', 'B2'], related: ['adverbs', 'adjectives', 'kotoryi'] },
    ],
  },
  {
    title: TERMS.adjectives,
    modes: [
      { id: 'adjectives', title: TERMS.agreement, blurb: 'Gender, number, case, animacy', level: ['A1', 'A2'], related: ['nounCases', 'possessives', 'short'] },
      { id: 'narechiya', title: TERMS.narechiya, blurb: 'быстрый → быстро, по-русски, быстрее', level: ['A1', 'A2'], related: ['adjectives', 'compare'] },
      { id: 'compare', title: TERMS.degrees, blurb: 'новее, новейший, самый новый', level: ['A2', 'B1'], related: ['comparison', 'short', 'narechiya'] },
      { id: 'short', title: TERMS.shortForms, blurb: 'он нов, она нова́, они новы', level: ['A2', 'B1'], related: ['adjectives', 'participles'] },
    ],
  },
  {
    title: TERMS.pronounsGroup,
    modes: [
      { id: 'pronouns', title: TERMS.personal, blurb: 'меня, ему, у него, с ней', level: ['A1', 'A2'], related: ['nounCases', 'prepositions', 'possessives'] },
      { id: 'questionWords', title: TERMS.questionWords, blurb: 'кому, о чём, чью, в каком', level: ['A1', 'A2'], related: ['pronouns', 'kotoryi'] },
      { id: 'possessives', title: TERMS.possessives, blurb: 'моему другу, эту книгу, свой / его', level: ['A1', 'B1'], related: ['pronouns', 'adjectives'] },
    ],
  },
  {
    title: TERMS.nounsNumbers,
    modes: [
      { id: 'nounCases', title: TERMS.nounCases, blurb: 'книгу, книге, книгой', level: ['A1', 'B1'], related: ['prepositions', 'plurals', 'adjectives'] },
      { id: 'plurals', title: TERMS.plurals, blurb: 'Plural forms, after numbers and quantity words', level: ['A1', 'A2'], related: ['nounCases', 'numbers'] },
      { id: 'numbers', title: TERMS.numbers, blurb: 'пяти, двум книгам, тремя друзьями', level: ['A1', 'B2'], related: ['plurals', 'ordinals'] },
      { id: 'ordinals', title: TERMS.ordinalsTopic, blurb: 'на третьем этаже, пятого мая, в двадцатом веке', level: ['A2', 'B1'], related: ['numbers', 'time'] },
      { id: 'diminutives', title: TERMS.diminutives, blurb: 'дом → домик, сын → сынок', level: ['B1', 'B2'], related: ['nounCases'] },
      { id: 'specialCases', title: TERMS.specialCases, blurb: 'в лесу, в аэропорту, чашка чаю', level: ['A2', 'B1'], related: ['nounCases', 'prepositions'] },
    ],
  },
  {
    title: TERMS.sentences,
    modes: [
      { id: 'prepositions', title: TERMS.prepositionsMode, blurb: 'в школе, в школу, к другу, с другом', level: ['A1', 'A2'], related: ['nounCases', 'government', 'time'] },
      { id: 'time', title: TERMS.time, blurb: 'в пятницу, в январе, через неделю, час назад', level: ['A1', 'A2'], related: ['prepositions', 'ordinals'] },
      { id: 'negation', title: TERMS.negation, blurb: 'нет времени, никого не вижу, не / ни', level: ['A2', 'B1'], related: ['nounCases', 'indefinite'] },
      { id: 'conjunctions', title: TERMS.conjunctions, blurb: 'что, чтобы, если, когда', level: ['A1', 'A2'], related: ['chtoby', 'kotoryi', 'conditional'] },
      { id: 'comparison', title: TERMS.comparison, blurb: 'старше брата', level: ['A2', 'B1'], related: ['compare'] },
      { id: 'impersonal', title: TERMS.impersonal, blurb: 'мне холодно, Тому надо идти', level: ['A1', 'A2'], related: ['pronouns', 'government'] },
      { id: 'chtoby', title: TERMS.chtoby, blurb: 'чтобы помочь / чтобы ты помог', level: ['A2', 'B1'], related: ['conjunctions', 'conditional'] },
      { id: 'kotoryi', title: TERMS.kotoryi, blurb: 'книга, которую я читаю', level: ['A2', 'B1'], related: ['conjunctions', 'participles'] },
      { id: 'conditional', title: TERMS.conditional, blurb: 'я бы пошёл', level: ['A2', 'B1'], related: ['chtoby', 'verbs'] },
      { id: 'indefinite', title: TERMS.indefinite, blurb: 'кто-то, кто-нибудь, кое-кто', level: ['A2', 'B1'], related: ['negation', 'questionWords'] },
      { id: 'particles', title: TERMS.particlesTopic, blurb: 'ли, же, ведь, вот, ну, даже, только, -ка', level: ['B1', 'B2'], related: ['conjunctions'] },
    ],
  },
  {
    title: TERMS.pronunciation,
    modes: [{ id: 'stress', title: TERMS.stress, blurb: 'Tap the stressed vowel', level: ['A1', 'B1'], related: ['alphabet'] }],
  },
];
export const ALL_TOPICS: Topic[] = TOPIC_GROUPS.flatMap((g) => g.modes);
export const topicById = (id: string): Topic | undefined => ALL_TOPICS.find((t) => t.id === id);
/** The topics before and after this one in the Learn order (the order of this list). */
export function neighbours(id: string): { prev?: Topic; next?: Topic } {
  const i = ALL_TOPICS.findIndex((t) => t.id === id);
  return i < 0 ? {} : { prev: ALL_TOPICS[i - 1], next: ALL_TOPICS[i + 1] };
}
