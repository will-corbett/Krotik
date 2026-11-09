/**
 * Why the answer is right, for every drill question that doesn't bring its own explanation (the sentence drills,
 * collocations, idioms and Find the mistake do). Built from what the question already carries: the form asked for
 * (its label), the dictionary word, the frame (a preposition, a noun, a subject) and the word's forms. Grammar facts
 * only: every form shown comes from the data.
 */
import type { Case } from '../shared/cells.ts';
import { cellForms } from '../shared/forms.ts';
import type { PairType } from '../shared/types.ts';
import { caseReason } from './fixExplain.ts';
import type { Question } from './types.ts';

const bare = (s: string) => (cellForms(s)[0] ?? s).replace(/'/g, '');
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** What the answer adds to the word: the ending, from where the two spellings part (удобен → удобна: -а). */
function ending(word: string, form: string): string {
  // Compare with the stem: the dictionary form without its own ending (ясный → ясн-, книга → книг-).
  const a = bare(word).toLowerCase().replace(/(ый|ий|ой|ее|ое|ая|яя|ся)$/, '').replace(/[аяоеьйи]$/, '');
  const b = bare(form).toLowerCase();
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i < 2 || i >= b.length) return '';
  return `-${b.slice(i)}`;
}
const CASE_NAMES: Record<string, Case> = { nominative: 'nom', genitive: 'gen', dative: 'dat', accusative: 'acc', instrumental: 'inst', prepositional: 'prep' };
/** The case a label names ("Dative feminine singular …"), and whether it's plural. */
function caseInLabel(label: string): { c: Case; plural: boolean } | null {
  const m = /^(Nominative|Genitive|Dative|Accusative|Instrumental|Prepositional)\b/.exec(label);
  return m ? { c: CASE_NAMES[m[1]!.toLowerCase()]!, plural: /\bplural\b/.test(label) } : null;
}
/** The frame as a sentence with the answer in it, and where the answer starts. */
function inFrame(q: Question): { ru: string; start: number; after: string } {
  const frame = q.frame ?? '___';
  const i = frame.indexOf('___');
  const ans = bare(q.answer);
  return { ru: frame.replace('___', ans).replace(/'/g, ''), start: Math.max(0, i), after: frame.slice(i + 3).replace(/'/g, '').trim() };
}

// ---- verbs
const PERSON_END: Record<string, [string, string]> = {
  я: ['-у / -ю', '-у / -ю'],
  ты: ['-ешь (-ёшь)', '-ишь'],
  'он/она': ['-ет (-ёт)', '-ит'],
  мы: ['-ем (-ём)', '-им'],
  вы: ['-ете (-ёте)', '-ите'],
  они: ['-ут / -ют', '-ат / -ят'],
};
function verbForm(q: Question): string | null {
  const m = /^(Present\/future|Present|Future|Past|Imperative), (.+?) form/.exec(q.label);
  if (!m) return null;
  const [, tense, person] = m as unknown as [string, string, string];
  const verb = q.paradigm?.kind === 'verb' ? q.paradigm.verb : null;
  const reflexive = /с[яь]$/.test(bare(q.answer)) ? ' Reflexive verbs add -ся after a consonant and -сь after a vowel (решаюсь, решаемся).' : '';
  if (tense === 'Past') {
    const inf = bare(q.headword).replace(/(ть|ти|чь)(ся)?$/, '');
    const regular = bare(q.answer).startsWith(inf) && inf.length > 1;
    return `Past tense: it agrees with the subject in gender and number, not person: -л (он), -ла (она), -ло (оно), -ли (они, and вы). ${regular ? 'It is made from the infinitive’s stem.' : 'This verb’s past stem is irregular: learn it with the verb.'}${reflexive}`;
  }
  if (tense === 'Imperative') return `The imperative is made from the present (or perfective future) stem: -й after a vowel (читай), -и or -ь after a consonant (пиши, будь); add -те for вы or several people.${reflexive}`;
  const tyForm = verb ? bare(verb.cells[1] ?? '') : '';
  const second = /ишь(ся)?$/.test(tyForm);
  const first = /[её]шь(ся)?$/.test(tyForm);
  const ends = PERSON_END[person];
  const conj = second ? `It is a second-conjugation verb (ты ${tyForm}): the ${person} form ends ${ends?.[1] ?? ''}.` : first ? `It is a first-conjugation verb (ты ${tyForm}): the ${person} form ends ${ends?.[0] ?? ''}.` : `The ${person} form.`;
  // A consonant that changes only in the я form (ношу, носишь) is the commonest trap.
  const ya = verb ? bare(verb.cells[0] ?? '') : '';
  const stemTy = tyForm.replace(/[еёи]шь(ся)?$/, '');
  const stemYa = ya.replace(/[уюь]?(сь)?$/, '').replace(/[ую]$/, '');
  const shift = second && ya && stemTy && stemYa !== stemTy && person === 'я' ? ` In the я form only, the consonant changes (${ya}, but ${tyForm}).` : '';
  const when = tense === 'Present/future' ? 'This verb is both imperfective and perfective, so the same forms are present or future by context. ' : tense === 'Future' ? 'A perfective verb has no present tense: its present-tense endings give the future. ' : 'Present tense. ';
  return `${when}${conj}${shift}${reflexive}`;
}

function aspectPartner(q: Question): string | null {
  const m = /^(perfective|imperfective) partner/.exec(q.label);
  if (!m) return null;
  const a = bare(q.headword);
  const b = bare(q.answer);
  const [impf, pf] = m[1] === 'perfective' ? [a, b] : [b, a];
  let how: string;
  if (pf.endsWith(impf) && pf.length > impf.length) how = `the perfective adds a prefix (${impf} → ${pf})`;
  else if (/(ыва|ива|ва|ну)/.test(impf) && impf.length > pf.length) how = `the imperfective is made with a suffix such as -ыва- / -ива- / -ва- (${pf} → ${impf})`;
  else if (/ну/.test(pf) && !/ну/.test(impf)) how = `the perfective adds -ну- for one quick action (${impf} → ${pf})`;
  else if (impf.slice(0, 3) !== pf.slice(0, 3)) how = `the two are different words (like брать / взять): learn them as a pair`;
  else how = `the stem changes between the two (${impf} / ${pf})`;
  return `Aspect partners mean the same; the imperfective is for a process, a habit or a repeated action, the perfective for one completed result. Here ${how}.`;
}

function motionPartner(q: Question): string | null {
  const m = /^(unidirectional|multidirectional) (partner|verb)/.exec(q.label);
  if (!m) return null;
  return `Motion verbs come in pairs. The unidirectional one (идти, ехать, нести) is one trip in one direction, often now; the multidirectional one (ходить, ездить, носить) is there and back, a habit, or moving around with no single direction. ${bare(q.headword)} / ${bare(q.answer)} are such a pair.`.replace(/ \S+ \/ \S+ are such a pair\.$/, m[2] === 'verb' ? ` Here the ${m[1]} verb is ${bare(q.answer)}.` : ` ${bare(q.headword)} / ${bare(q.answer)} are such a pair.`);
}

function verbalAdverb(q: Question): string | null {
  if (/^Imperfective verbal adverb/.test(q.label)) return `The imperfective verbal adverb (doing …, while doing …) is made from the они present stem + -я (-а after ж, ш, ч, щ): ${bare(q.answer)}. It never changes; reflexive verbs add -сь.`;
  if (/^Perfective verbal adverb/.test(q.label)) return `The perfective verbal adverb (having done …) is made from the past stem + -в (or -вши; reflexive verbs -вшись): ${bare(q.answer)}. It never changes.`;
  return null;
}

function participle(q: Question): string | null {
  const l = q.label;
  if (/^Short passive participle/.test(l)) return `The short passive participle (was done) agrees with the subject in gender and number: -н / -т (он), -на / -та (она), -но / -то (оно), -ны / -ты (они). Here ${bare(q.answer)}.`;
  if (/^Present active participle/.test(l)) return `The present active participle (who is doing) is made from the они present form: drop -т and add -щий (читают → читающий; говорят → говорящий). It then declines like an adjective.`;
  if (/^Past active participle/.test(l)) return `The past active participle (who did / was doing) is made from the past stem + -вший (or -ший after a consonant: нёс → нёсший). It declines like an adjective.`;
  if (/^Present passive participle/.test(l)) return `The present passive participle (which is being done) is made from the мы form + -ый (любим → любимый). Only some imperfective verbs have one.`;
  if (/^Past passive participle/.test(l)) return `The past passive participle (which was done) ends -нный, -енный or -тый (прочитанный, решённый, открытый), mostly from perfective verbs.`;
  return null;
}

function comparison(q: Question): string | null {
  const l = q.label;
  if (/^Comparative/.test(l)) return `The comparative (-ее, or -е with a changed consonant: громче, выше, дороже) never changes: ${bare(q.answer)}, чем … . A few are irregular (лучше, хуже, больше, меньше).`;
  if (/^Superlative with самый/.test(l)) return 'The everyday superlative is самый + the adjective, and самый agrees with the noun too: самый новый дом, самая новая книга.';
  if (/^Superlative/.test(l)) return `The one-word superlative ends -ейший, or -айший after ж, ш, ч, щ (новейший, величайший). It is bookish; in speech, самый + adjective is commoner.`;
  return null;
}

function shortForm(q: Question): string | null {
  if (!/^Short form/.test(q.label)) return null;
  return `A short adjective comes after the subject and agrees with it in gender and number: masculine with no ending (a vowel can appear: удобен), feminine -а, neuter -о, plural -ы / -и. Here ${bare(q.answer)} (${ending(q.headword, q.answer) || 'no ending'}).`;
}

function diminutive(q: Question): string | null {
  if (/^Diminutive/.test(q.label)) return `Diminutives add a suffix: -ик, -ок, -ек, -чик (masculine), -ка, -очка, -ечка (feminine), -ко, -це (neuter). Here ${bare(q.headword)} → ${bare(q.answer)} (${ending(q.headword, q.answer) || 'a new suffix'}). They make something small, or dear.`;
  if (/^Base noun/.test(q.label)) return `${bare(q.headword)} is a diminutive of ${bare(q.answer)}: take the suffix off to find the base noun.`;
  return null;
}

// ---- declined words: case from the label, reason from the frame
const DECLINES: Partial<Record<string, string>> = {
  ordinals: 'Ordinal numbers decline like adjectives',
  possessives: 'мой, твой, наш, ваш, свой, этот, тот, весь and сам change like adjectives to agree with their noun (его, её, их never change)',
  questionWords: 'какой, чей and который agree with their noun like adjectives',
};
function declined(q: Question): string | null {
  const k = caseInLabel(q.label);
  if (!k) return null;
  const { ru, start, after } = inFrame(q);
  const noun = after.split(/\s+/)[0]?.replace(/[.,!?…]/g, '');
  const isAgreement = q.paradigm?.kind === 'adjective' || !!DECLINES[q.mode];
  const animacy = /inanimate/.test(q.label) ? ' Masculine and plural accusative: like the nominative for things (inanimate), like the genitive for people and animals.' : /animate/.test(q.label) ? ' Masculine and plural accusative: like the genitive for people and animals (animate).' : '';
  const end = ending(q.headword, q.answer);
  if (isAgreement) {
    const what = DECLINES[q.mode] ?? 'An adjective agrees with its noun in gender, number and case';
    const formName = lc(q.label.replace(/\s*\(.*$/, '').replace(/, (in)?animate$/, ''));
    // Possessives and question words are short words with their own tables: their "endings" would mislead (твоя).
    const showEnd = end && !DECLINES[q.mode];
    return `${what}${noun ? `: here with ${noun}, ${formName}` : `: ${formName}`}${showEnd ? `, ending ${end}` : ''}.${animacy}`;
  }
  if (q.mode === 'pronouns') {
 const thirdPerson = /^(он|она|оно|они)$/.test(bare(q.headword));
    const prepNote = /after a preposition/.test(q.label) && thirdPerson ? ' After a preposition, он, она, оно, они add н-: к нему, у неё, с ними.' : '';
    return `${caseReason(ru, start, k.c, k.plural, 'the pronoun')}${prepNote}`;
  }
  if (q.mode === 'numbers') {
    const head = bare(q.headword);
    const rule = /^(сорок|девяносто|сто)$/.test(head)
      ? 'сорок, девяносто and сто have just one other form, in -а (сорока, ста), in every case but the nominative and accusative.'
      : /десят$/.test(head) || /сот$|ста$|сти$/.test(head)
        ? 'Numbers like пятьдесят and двести change both parts: пятидесяти, двухсот.'
        : /^(пять|шесть|семь|восемь|девять|десять|.*надцать|двадцать|тридцать)$/.test(head)
          ? 'Numbers from пять to двадцать, and тридцать, decline like a feminine noun in -ь: -и in most cases, -ью in the instrumental.'
          : 'один, два, три and четыре have their own forms: learn them as a table.';
    return `Numbers decline too. ${rule}`;
  }
  const reason = caseReason(ru, start, k.c, k.plural);
  return `${reason}${end ? ` The ending is ${end}.` : ''}`;
}

function nominativePlural(q: Question): string | null {
  if (!/^Nominative plural/.test(q.label)) return null;
  return `The nominative plural is -ы for most masculine and feminine nouns, -и after г, к, х, ж, ш, ч, щ and soft consonants, and -а / -я for neuter ones; some masculine nouns take a stressed -а (дома, города). Here ${bare(q.answer)} (${ending(q.headword, q.answer) || 'its own form'}).`;
}

function stress(q: Question): string | null {
  if (q.mode !== 'stress' || !q.display) return null;
  const word = q.display.replace(/'/g, '́');
  return `The stress falls on ${word}. Russian stress has to be learnt with each word, and it can move between forms (го́род, города́), so learn it with the form too.`;
}

const PAIR_NOTE: Record<PairType, string> = {
  soft: 'A soft sign (ь) makes the consonant before it soft, said with the tongue raised as for и: брат ends hard, брать soft.',
  yi: 'ы is said further back, with the tongue drawn in; и is said at the front, and softens the consonant before it: был / бил.',
  shsch: 'ш is hard, said with the tongue back; щ is a long, soft sound, like a soft шш: ш in шёл, щ in щи.',
};
function listening(q: Question): string | null {
  if (q.mode === 'pairs') {
    // Which sound the pair turns on, from how the two words differ.
    const [a, b] = (q.choices ?? []).map(bare) as [string, string];
    const type: PairType = a + 'ь' === b || b + 'ь' === a ? 'soft' : [...a].some((ch, i) => (ch === 'ш' && b[i] === 'щ') || (ch === 'щ' && b[i] === 'ш')) ? 'shsch' : 'yi';
    return `You heard ${bare(q.answer)}. ${PAIR_NOTE[type]}`;
  }
  if (q.mode === 'endings') return q.explain ?? null;
  // The sentence and its English are shown with the answer; the explanation adds how to hear it.
  if (q.mode === 'listen' || q.mode === 'dictation') return 'Play it again, slower if you need: listen for the stressed syllables, then the endings, which are said quickly and can sound alike.';
  return null;
}

function other(q: Question): string | null {
  if (q.mode === 'vocab' && q.word) {
    const pos = q.task.some((t) => typeof t === 'object' && t && 'en' in t && t.en === 'verb') ? 'verb' : '';
    return q.meaning ? `${bare(q.headword)} means “${q.answer}”${pos ? ` (a ${pos})` : ''}.` : `“${q.headword}” is ${bare(q.answer)} in Russian.`;
  }
  if (q.mode === 'translate') return 'This is the translation Tatoeba gives. Other wordings and word orders can be just as right: compare the meaning and the grammar, not the exact words.';
  if (q.mode === 'build') return 'This is the order of the original sentence. Russian word order is free, but it isn’t random: the end of a sentence carries the new information (see Word order).';
  return null;
}

/** An explanation for a question that has none of its own; undefined only when there's nothing to say. */
export function explainQuestion(q: Question): string | undefined {
  if (q.explain) return q.explain;
  return (
    verbForm(q) ??
    aspectPartner(q) ??
    motionPartner(q) ??
    verbalAdverb(q) ??
    participle(q) ??
    comparison(q) ??
    shortForm(q) ??
    diminutive(q) ??
    nominativePlural(q) ??
    declined(q) ??
    stress(q) ??
    listening(q) ??
    other(q) ??
    undefined
  );
}
/** Every question with an explanation. */
export const withExplanations = (qs: Question[]): Question[] => qs.map((q) => (q.explain ? q : { ...q, explain: explainQuestion(q) }));
