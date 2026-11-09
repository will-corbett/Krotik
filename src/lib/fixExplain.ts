/**
 * Find the mistake: why the right form is right, for every question. Specific where the sentence shows the reason (a
 * preposition before the word, a number, нет, the subject a verb agrees with, the sentence drill's own rule), and the
 * general rule for that kind of form otherwise. Grammar facts only: the forms themselves come from the data.
 */
import { ADJ_EXTRA_CELL_OFFSET, CASES, VERB_CELLS, type Case } from '../shared/cells.ts';
import { normalise } from '../shared/normalise.ts';
import type { LevelTestCandidate } from '../shared/types.ts';
import { formTerm, ruleFor } from './levelTestExplain.ts';
import { CASE_TERM } from './terms.ts';

const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;

/** Prepositions and the cases they take, with what each pairing means. */
export const PREP: Record<string, Partial<Record<Case, string>>> = {
  без: { gen: 'without' },
  для: { gen: 'for' },
  из: { gen: 'out of, from' },
  от: { gen: 'from (a person), away from' },
  до: { gen: 'up to, until' },
  у: { gen: 'at someone’s, by' },
  около: { gen: 'near, about' },
  после: { gen: 'after' },
  кроме: { gen: 'except' },
  вокруг: { gen: 'around' },
  против: { gen: 'against' },
  мимо: { gen: 'past' },
  к: { dat: 'to, towards (a person or place)' },
  ко: { dat: 'to, towards (a person or place)' },
  по: { dat: 'along, around, by (phone, post)' },
  благодаря: { dat: 'thanks to' },
  через: { acc: 'through, across, in (a time from now)' },
  про: { acc: 'about' },
  с: { inst: 'with, together with', gen: 'off, down from, since' },
  со: { inst: 'with, together with', gen: 'off, down from, since' },
  над: { inst: 'above, over' },
  перед: { inst: 'in front of, just before' },
  между: { inst: 'between' },
  под: { inst: 'under (where something is)', acc: 'under (where something goes)' },
  за: { inst: 'behind, to fetch (where something is)', acc: 'behind (where something goes), for (in exchange, in thanks)' },
  в: { prep: 'in, at (where something is)', acc: 'into, to (where something goes), on (a day)' },
  во: { prep: 'in, at (where something is)', acc: 'into, to (where something goes), on (a day)' },
  на: { prep: 'on, at (where something is)', acc: 'onto, to (where something goes), for (a time)' },
  о: { prep: 'about' },
  об: { prep: 'about' },
  обо: { prep: 'about' },
  при: { prep: 'in the presence of, in the time of' },
};
/** What each case is mostly for, when nothing in the sentence points to it. */
export const CASE_USE: Record<Case, string> = {
  nom: 'the subject of the sentence, or what something is',
  gen: 'of, possession, after нет, after quantities, and after many verbs and prepositions',
  dat: 'to or for someone, and after verbs like помогать, звонить, нравиться',
  acc: 'the direct object of the verb (what is done to), and direction after в / на',
  inst: 'with, by means of, and after быть, стать, работать (as), заниматься',
  prep: 'after о (about) and в / на (where something is)',
};
const SMALL_NUMBERS = new Set(['два', 'две', 'три', 'четыре', 'оба', 'обе', 'полтора', 'полторы']);
const MANY = new Set(['пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'двадцать', 'тридцать', 'сто', 'сколько', 'несколько', 'много', 'мало', 'немного']);
const PRONOUN_PERSON: Record<string, number> = { я: 0, ты: 1, он: 2, она: 2, оно: 2, мы: 3, вы: 4, они: 5 };

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** The case and number a noun or adjective code is in ("n9" → acc plural), if it's one. */
function caseOf(code: string): { c: Case; plural: boolean } | null {
  const m = /^n(\d+)$/.exec(code.split('+')[0] ?? '');
  if (m) return { c: CASES[Number(m[1]) % 6]!, plural: Number(m[1]) >= 6 };
  return null;
}

/**
 * Why a word in a sentence is in this case: the preposition, number or нет before it (from where the word starts),
 * else what the case is for. Shared with every drill's explanations (explain.ts).
 */
export function caseReason(ru: string, start: number, c: Case, plural: boolean, what = 'the noun'): string {
  const before = [...ru.slice(0, start).matchAll(TOKEN)].map((m) => normalise(m[0]));
  const prev = before.at(-1) ?? '';
  const prev2 = before.at(-2) ?? '';
  const name = `the ${lc(CASE_TERM[c].en)} (${CASE_TERM[c].ru})`;
  const prep = PREP[prev] ?? (SMALL_NUMBERS.has(prev) || MANY.has(prev) ? undefined : PREP[prev2]);
  const viaPrep = PREP[prev] ? prev : prev2;
  if (prep?.[c]) {
    const others = Object.keys(prep).filter((x) => x !== c).map((x) => lc(CASE_TERM[x as Case].en));
    const both = others.length ? ` With the ${others.join(' or ')}, ${viaPrep} means something else.` : '';
    return `After ${viaPrep}, meaning “${prep[c]}”, ${what} takes ${name}.${both}`;
  }
  if (SMALL_NUMBERS.has(prev) && c === 'gen' && !plural) return `After ${prev} (and два, три, четыре, оба), a noun takes the genitive singular.`;
  if (MANY.has(prev) && c === 'gen' && plural) return `After ${prev} (and five or more, сколько, несколько, много), a noun takes the genitive plural.`;
  if (prev === 'нет' && c === 'gen') return 'After нет (there is no …), a noun takes the genitive.';
  return `Here ${what} is ${name}: ${CASE_USE[c]}.`;
}

/** The reason, in a sentence, or null when the sentence shows nothing in particular. */
function reasonFrom(ru: string, start: number, end: number, rightCode: string): string | null {
  const before = [...ru.slice(0, start).matchAll(TOKEN)].map((m) => normalise(m[0]));
  const after = [...ru.slice(end).matchAll(TOKEN)].map((m) => normalise(m[0]));
  const k = caseOf(rightCode);
  if (k) return caseReason(ru, start, k.c, k.plural);

  const v = /^v(\d+)$/.exec(rightCode.split('+')[0] ?? '');
  if (v) {
    const cell = VERB_CELLS[Number(v[1])]!;
    if (cell.group === 'presfut') {
      const subject = [...before, ...after].find((w) => PRONOUN_PERSON[w] === Number(v[1]));
      return subject ? `The verb agrees with its subject, ${subject}: the ${cell.person} form.` : `The verb agrees with its subject: here the ${cell.person} form.`;
    }
    if (cell.group === 'past') return 'In the past tense the verb agrees with its subject in gender and number (он сказал, она сказала, они сказали).';
    return 'An instruction takes the imperative: the ты form for one person you call ты, the вы form for вы or several people.';
  }
  if (rightCode === 'inf') return 'After verbs like хотеть, мочь, начать, нужно or надо, the next verb is in the infinitive.';
  const a = /^a(\d+)/.exec(rightCode);
  if (a) {
    const i = Number(a[1]);
    if (i >= ADJ_EXTRA_CELL_OFFSET && i < ADJ_EXTRA_CELL_OFFSET + 4)
      return 'A short adjective, after the subject, agrees with it in gender and number: masculine with no ending (удобен), feminine -а, neuter -о, plural -ы/-и. Вы, even to one person, takes the plural.';
    if (i === ADJ_EXTRA_CELL_OFFSET + 4) return 'A comparison takes the comparative (быстрее, лучше), which never changes for gender, number or case.';
    if (i === ADJ_EXTRA_CELL_OFFSET + 5) return 'This is the superlative: the most …, the best.';
    return 'An adjective agrees with its noun in gender, number and case.';
  }
  if (/^p:/.test(rightCode)) return 'A participle agrees with the noun it describes in gender, number and case, like an adjective.';
  if (rightCode === 'adv') return 'A verbal adverb (деепричастие) never changes: it describes a second action of the same subject.';
  return null;
}

/** "The right form is X (dative singular): after к …. «Y» is the genitive singular." */
export function explainFix(c: LevelTestCandidate, wrong: string): string {
  const [, ru, , start, end, , right, wrongs, , kind, rightCode, wrongCodes] = c;
  const rightTerm = formTerm(rightCode);
  const wrongTerm = formTerm(wrongCodes[wrongs.indexOf(wrong)] ?? '');
  const why = ruleFor(kind) ?? reasonFrom(ru, start, end, rightCode);
  const bare = (s: string) => s.replace(/'/g, '');
  return [
    `The right form is ${bare(right)}${rightTerm ? ` (${lc(rightTerm.en)})` : ''}.`,
    why,
    wrongTerm ? `«${bare(wrong)}» is the ${lc(wrongTerm.en)}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
