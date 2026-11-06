/**
 * Every topic, in its group: the single list behind the Dashboard, the Learn index and the Drill setup.
 * A topic's id is its drill mode; its Learn page (if written yet) is content/learn/<id>.md.
 */
import { TERMS, type Term } from './terms.ts';
import type { Mode } from './types.ts';

export interface Topic {
  id: Mode;
  title: Term;
  blurb: string;
}
export interface TopicGroup {
  title: Term;
  modes: Topic[];
}

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    title: TERMS.verbs,
    modes: [
      { id: 'verbs', title: TERMS.verbForms, blurb: 'Present/future, past, imperative' },
      { id: 'reflexive', title: TERMS.reflexive, blurb: '-ся after consonants, -сь after vowels' },
      { id: 'aspect', title: TERMS.aspectPartners, blurb: 'Imperfective ↔ perfective' },
      { id: 'aspectContext', title: TERMS.aspectContext, blurb: 'видел or увидел? in real sentences' },
      { id: 'motion', title: TERMS.motionVerbs, blurb: 'идти/ходить and 11 more pairs' },
      { id: 'adverbs', title: TERMS.adverbs, blurb: 'читая, прочитав' },
      { id: 'participles', title: TERMS.participles, blurb: 'читающий, прочитанный, прочитана' },
      { id: 'government', title: TERMS.government, blurb: 'помогать кому, бояться чего, думать о ком' },
      { id: 'prefixedMotion', title: TERMS.prefixedMotion, blurb: 'прийти / приходить, выйти, перейти' },
      { id: 'position', title: TERMS.position, blurb: 'стоять / ставить / встать' },
    ],
  },
  {
    title: TERMS.adjectives,
    modes: [
      { id: 'adjectives', title: TERMS.agreement, blurb: 'Gender, number, case, animacy' },
      { id: 'short', title: TERMS.shortForms, blurb: 'он нов, она нова́, они новы' },
      { id: 'compare', title: TERMS.degrees, blurb: 'новее, новейший, самый новый' },
    ],
  },
  {
    title: TERMS.pronounsGroup,
    modes: [
      { id: 'pronouns', title: TERMS.personal, blurb: 'меня, ему, у него, с ней' },
      { id: 'possessives', title: TERMS.possessives, blurb: 'моему другу, эту книгу, свой / его' },
    ],
  },
  {
    title: TERMS.nounsNumbers,
    modes: [
      { id: 'nounCases', title: TERMS.nounCases, blurb: 'книгу, книге, книгой' },
      { id: 'plurals', title: TERMS.plurals, blurb: 'Plural forms, after numbers and quantity words' },
      { id: 'numbers', title: TERMS.numbers, blurb: 'пяти, двум книгам, тремя друзьями' },
      { id: 'diminutives', title: TERMS.diminutives, blurb: 'дом → домик, сын → сынок' },
    ],
  },
  {
    title: TERMS.sentences,
    modes: [
      { id: 'prepositions', title: TERMS.prepositionsMode, blurb: 'в школе, в школу, к другу, с другом' },
      { id: 'kotoryi', title: TERMS.kotoryi, blurb: 'книга, которую я читаю' },
      { id: 'chtoby', title: TERMS.chtoby, blurb: 'чтобы помочь / чтобы ты помог' },
      { id: 'conditional', title: TERMS.conditional, blurb: 'я бы пошёл' },
      { id: 'negation', title: TERMS.negation, blurb: 'нет времени, никого не вижу, не / ни' },
      { id: 'indefinite', title: TERMS.indefinite, blurb: 'кто-то, кто-нибудь, кое-кто' },
      { id: 'particles', title: TERMS.particlesTopic, blurb: 'ли, же, ведь, вот, ну, даже, только, -ка' },
      { id: 'impersonal', title: TERMS.impersonal, blurb: 'мне холодно, Тому надо идти' },
      { id: 'comparison', title: TERMS.comparison, blurb: 'старше брата' },
      { id: 'conjunctions', title: TERMS.conjunctions, blurb: 'что, чтобы, если, когда' },
      { id: 'time', title: TERMS.time, blurb: 'в пятницу, в январе, через неделю, час назад' },
    ],
  },
  {
    title: TERMS.pronunciation,
    modes: [{ id: 'stress', title: TERMS.stress, blurb: 'Tap the stressed vowel' }],
  },
];
export const ALL_TOPICS: Topic[] = TOPIC_GROUPS.flatMap((g) => g.modes);
export const topicById = (id: string): Topic | undefined => ALL_TOPICS.find((t) => t.id === id);
