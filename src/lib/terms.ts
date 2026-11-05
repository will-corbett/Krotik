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
