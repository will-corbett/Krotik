/**
 * Grammar terminology, always shown in English with its Russian equivalent.
 * Russian terms follow standard school-grammar usage.
 */
import type { AdjSlot, Aspect, Case, VerbGroup } from '../shared/cells.ts';

export interface Term {
  en: string;
  ru: string;
}
const t = (en: string, ru: string): Term => ({ en, ru });

export const TERMS = {
  present: t('Present', 'настоящее время'),
  future: t('Future', 'будущее время'),
  presfut: t('Present/future', 'настоящее/будущее время'),
  past: t('Past', 'прошедшее время'),
  imperative: t('Imperative', 'повелительное наклонение'),
  infinitive: t('Infinitive', 'инфинитив'),
  tense: t('Tense', 'время'),
  impf: t('imperfective', 'несовершенный вид'),
  pf: t('perfective', 'совершенный вид'),
  both: t('bi-aspectual', 'двувидовой глагол'),
  aspect: t('Aspect', 'вид'),
  aspectPair: t('aspect partner', 'видовая пара'),
  case: t('Case', 'падеж'),
  number: t('Number', 'число'),
  singular: t('singular', 'единственное число'),
  plural: t('plural', 'множественное число'),
  gender: t('Gender', 'род'),
  animate: t('animate', 'одушевлённое'),
  inanimate: t('inanimate', 'неодушевлённое'),
  uni: t('unidirectional', 'однонаправленный'),
  multi: t('multidirectional', 'разнонаправленный'),
  verbForms: t('Verb forms', 'формы глагола'),
  agreement: t('Adjective agreement', 'согласование прилагательных'),
  motionVerbs: t('Motion verbs', 'глаголы движения'),
  aspectPartners: t('Aspect partners', 'видовые пары'),
  conjugation: t('Conjugate', 'спряжение'),
  verb: t('verb', 'глагол'),
  // groups
  verbs: t('Verbs', 'глаголы'),
  adjectives: t('Adjectives', 'прилагательные'),
  nouns: t('Nouns', 'существительные'),
  // Phase A sections
  reflexive: t('Reflexive verbs', 'возвратные глаголы'),
  shortForms: t('Short-form adjectives', 'краткие прилагательные'),
  shortForm: t('Short form', 'краткая форма'),
  degrees: t('Comparatives & superlatives', 'степени сравнения'),
  comparative: t('Comparative', 'сравнительная степень'),
  superlative: t('Superlative', 'превосходная степень'),
  samyi: t('Superlative with самый', 'составная превосходная степень'),
  plurals: t('Plurals', 'множественное число'),
  afterNumber: t('after a number', 'после числительного'),
  afterQuantity: t('after a quantity word', 'после слов количества'),
  // Phase B
  nounsNumbers: t('Nouns & numbers', 'существительные и числительные'),
  adverbs: t('Verbal adverbs', 'деепричастия'),
  verbalAdverb: t('Verbal adverb', 'деепричастие'),
  advImpf: t('Imperfective verbal adverb', 'деепричастие несовершенного вида'),
  advPf: t('Perfective verbal adverb', 'деепричастие совершенного вида'),
  participles: t('Participles', 'причастия'),
  act_pres: t('Present active participle', 'действительное причастие настоящего времени'),
  act_past: t('Past active participle', 'действительное причастие прошедшего времени'),
  pass_pres: t('Present passive participle', 'страдательное причастие настоящего времени'),
  pass_past: t('Past passive participle', 'страдательное причастие прошедшего времени'),
  shortPassive: t('Short passive participle', 'краткое страдательное причастие'),
  numbers: t('Numbers', 'числительные'),
  numeral: t('Numeral', 'числительное'),
  numeralNoun: t('Numeral + noun', 'числительное с существительным'),
  diminutives: t('Diminutives', 'уменьшительно-ласкательные формы'),
  diminutive: t('Diminutive', 'уменьшительная форма'),
  baseNoun: t('Base noun', 'исходное слово'),
  // Phase C
  sentences: t('Sentences', 'предложения'),
  kotoryi: t('Relative clauses with который', 'определительные придаточные'),
  chtoby: t('Purpose with чтобы', 'придаточные цели'),
  conditional: t('Conditional', 'условное наклонение'),
  negation: t('Negation', 'отрицание'),
  indefinite: t('Indefinite pronouns', 'неопределённые местоимения'),
  particlesTopic: t('Particles', 'частицы'),
  negativePronoun: t('Negative pronoun', 'отрицательное местоимение'),
  // Phase D
  pronounsGroup: t('Pronouns', 'местоимения'),
  personal: t('Personal pronouns', 'личные местоимения'),
  possessives: t('Possessive & demonstrative pronouns', 'притяжательные и указательные местоимения'),
  afterPrep: t('after a preposition', 'после предлога'),
  nounCases: t('Noun cases', 'склонение существительных'),
  prepositionsMode: t('Prepositions and cases', 'предлоги и падежи'),
  aspectContext: t('Aspect in context', 'вид глагола в контексте'),
  svoy: t('свой or его/её/их', 'возвратное притяжательное местоимение'),
  stress: t('Stress', 'ударение'),
  pronunciation: t('Pronunciation', 'произношение'),
  // Phase E
  government: t('Verb government', 'управление глаголов'),
  prefixedMotion: t('Prefixed motion verbs', 'приставочные глаголы движения'),
  position: t('Verbs of position', 'глаголы положения'),
  impersonal: t('Impersonal constructions', 'безличные предложения'),
  modals: t('Can, must, need', 'модальность'),
  complexSentences: t('Complex sentences', 'сложные предложения'),
  reportedSpeech: t('Reported speech', 'косвенная речь'),
  wordOrder: t('Word order', 'порядок слов'),
  wordOrderTask: t('Which answer sounds natural?', 'какой ответ естественнее?'),
  aspectNuance: t('Aspect: finer points', 'вид глагола: тонкости'),
  discourse: t('Linking ideas', 'связность текста'),
  register: t('Formal and informal', 'стиль речи'),
  sounds: t('Sounds and spelling', 'произношение'),
  review: t('Review', 'повторение'),
  collocations: t('Words that go together', 'сочетаемость'),
  collocTask: t('Which verb goes with it?', 'какой глагол?'),
  listening: t('Listening', 'аудирование'),
  listen: t('Listen and choose', 'слушайте и выбирайте'),
  listenMeaning: t('What does it mean?', 'что это значит?'),
  listenText: t('What did you hear?', 'что вы услышали?'),
  dictation: t('Dictation', 'диктант'),
  dictationTask: t('Write what you hear', 'запишите, что слышите'),
  endings: t('Hear the ending', 'окончания на слух'),
  endingsTask: t('Which form did you hear?', 'какую форму вы услышали?'),
  pairs: t('Minimal pairs', 'минимальные пары'),
  pairsTask: t('Which word did you hear?', 'какое слово вы услышали?'),
  words: t('Words', 'слова'),
  vocab: t('Vocabulary', 'лексика'),
  meaningTask: t('What does it mean?', 'значение'),
  recallTask: t('Say it in Russian', 'как по-русски?'),
  gapTask: t('Fill the gap', 'вставьте слово'),
  nounPos: t('noun', 'существительное'),
  verbPos: t('verb', 'глагол'),
  adjectivePos: t('adjective', 'прилагательное'),
  mixed: t('Mixed review', 'смешанное повторение'),
  translate: t('Translate and compare', 'перевод'),
  translateTask: t('Translate into Russian', 'переведите на русский'),
  fix: t('Find the mistake', 'найдите ошибку'),
  fixTask: t('Find the wrong word and correct it', 'найдите ошибку и исправьте'),
  build: t('Build the sentence', 'составьте предложение'),
  buildTask: t('Put the words in order', 'составьте предложение'),
  translateToEnglish: t('Translate into English', 'переведите на английский'),
  reading: t('Reading', 'чтение'),
  comparison: t('Comparisons', 'сравнительные конструкции'),
  conjunctions: t('Conjunctions', 'союзы'),
  time: t('Time expressions', 'выражение времени'),
  ordinal: t('Ordinal numbers', 'порядковые числительные'),
  compound: t('Compound numbers', 'составные числительные'),
  collective: t('Collective numbers', 'собирательные числительные'),
  // Batch 4
  narechiya: t('Adverbs', 'наречия'),
  adverb: t('Adverb', 'наречие'),
  adjective: t('Adjective', 'прилагательное'),
  adverbOrAdjective: t('Adverb or adjective?', 'наречие или прилагательное?'),
  questionWords: t('Question words', 'вопросительные местоимения'),
  ordinalsTopic: t('Ordinals and dates', 'порядковые числительные и даты'),
  date: t('Date', 'дата'),
  onDate: t('On a date', 'когда? (дата)'),
  century: t('Century', 'век'),
  inCentury: t('In a century', 'в каком веке?'),
  specialCases: t('Special case forms', 'особые формы падежей'),
  locative: t('Second prepositional (location)', 'второй предложный (местный) падеж'),
  gettingStarted: t('Getting started', 'начало'),
  alphabet: t('The alphabet', 'алфавит'),
  letterSound: t('Which sound?', 'какой звук?'),
  readWord: t('Read the word', 'прочитайте слово'),
  writeWord: t('Write it in Cyrillic', 'напишите по-русски'),
  partitive: t('Partitive', 'второй родительный (количественный) падеж'),
} satisfies Record<string, Term>;

export const CASE_TERM: Record<Case, Term> = {
  nom: t('Nominative', 'именительный падеж'),
  gen: t('Genitive', 'родительный падеж'),
  dat: t('Dative', 'дательный падеж'),
  acc: t('Accusative', 'винительный падеж'),
  inst: t('Instrumental', 'творительный падеж'),
  prep: t('Prepositional', 'предложный падеж'),
};
/** Short forms for table headers. */
export const CASE_ABBR: Record<Case, Term> = {
  nom: t('Nom.', 'им.'),
  gen: t('Gen.', 'род.'),
  dat: t('Dat.', 'дат.'),
  acc: t('Acc.', 'вин.'),
  inst: t('Inst.', 'твор.'),
  prep: t('Prep.', 'предл.'),
};

export const GENDER_TERM: Record<'m' | 'f' | 'n', Term> = {
  m: t('masculine', 'мужской род'),
  f: t('feminine', 'женский род'),
  n: t('neuter', 'средний род'),
};
export const SLOT_ABBR: Record<AdjSlot, Term> = {
  m: t('masc.', 'м. р.'),
  f: t('fem.', 'ж. р.'),
  n: t('neut.', 'ср. р.'),
  pl: t('plural', 'мн. ч.'),
};

/** "feminine singular" / "plural" as one term. */
export function numberGenderTerm(slot: AdjSlot): Term {
  if (slot === 'pl') return TERMS.plural;
  const g = GENDER_TERM[slot];
  return t(`${g.en} singular`, `${g.ru}, ${TERMS.singular.ru}`);
}

export const ASPECT_TERM: Record<Aspect, Term> = { impf: TERMS.impf, pf: TERMS.pf, both: TERMS.both };

export function groupTerm(group: VerbGroup, aspect: Aspect): Term {
  if (group === 'past') return TERMS.past;
  if (group === 'imperative') return TERMS.imperative;
  return aspect === 'impf' ? TERMS.present : aspect === 'pf' ? TERMS.future : TERMS.presfut;
}

/** Inline form for running text: "Past (прошедшее время)". */
export function inline(term: Term): string {
  return `${term.en} (${term.ru})`;
}

/**
 * A question's task line: grammar terms (English + Russian) and plain Russian words
 * such as the person pronoun.
 */
export type TaskPart = Term | { ru: string; en?: undefined } | { en: string; ru?: undefined };

/** English-only text of a task (used as an identifier in tests and for compact display). */
export function taskText(parts: TaskPart[]): string {
  return parts.map((p) => p.en ?? p.ru).join(' · ');
}
