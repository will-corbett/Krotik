/**
 * Register labels on words (from Wiktionary, checked: curated/registers.yaml): what they're called, in English and
 * Russian, what they mean for a learner, and the letter that marks them in Reading's word flags.
 */
export const REGISTER: Record<string, { en: string; ru: string; note: string; letter: string }> = {
  colloquial: { en: 'colloquial', ru: 'разговорное', note: 'everyday speech; avoid it in formal writing', letter: 'C' },
  slang: { en: 'slang', ru: 'сленг', note: 'informal, among friends', letter: 'G' },
  literary: { en: 'bookish', ru: 'книжное', note: 'written and formal Russian; it sounds stiff in conversation', letter: 'B' },
  poetic: { en: 'poetic', ru: 'поэтическое', note: 'poetry and high style', letter: 'P' },
  formal: { en: 'formal', ru: 'официальное', note: 'formal and official situations', letter: 'F' },
  humorous: { en: 'humorous', ru: 'шутливое', note: 'said jokingly', letter: 'U' },
  derogatory: { en: 'derogatory', ru: 'пренебрежительное', note: 'expresses contempt: use with care', letter: 'D' },
  vulgar: { en: 'vulgar', ru: 'грубое', note: 'coarse: avoid it unless you know the company', letter: 'V' },
  offensive: { en: 'offensive', ru: 'оскорбительное', note: 'offensive: don’t use it', letter: 'X' },
};
export const REGISTER_BY_LETTER = Object.fromEntries(Object.entries(REGISTER).map(([k, v]) => [v.letter, k]));
/** "colloquial (разговорное)" */
export const registerName = (label: string) => (REGISTER[label] ? `${REGISTER[label]!.en} (${REGISTER[label]!.ru})` : label);
